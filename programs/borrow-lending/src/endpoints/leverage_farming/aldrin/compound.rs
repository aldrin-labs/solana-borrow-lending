//! This endpoint can be called only by Aldrin compouding bot. It was made
//! PDA agnostic, and so it it can be used also for other features, not just
//! LYF.
//!
//! ## Steps
//! 1. Harvest farmed tokens into caller's wallet
//!
//! 2. Check that the suggested number of LP tokens to take from the caller's
//! wallet and stake is worth as much as the farmed tokens.
//!
//! 3. Stake caller's LP tokens, let them keep the harvested ones.

use super::{StakeCpi, WithdrawFarmed};
use crate::prelude::*;
use anchor_lang::solana_program::{
    instruction::Instruction, program::invoke_signed,
};
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct CompoundLeveragedPositionOnAldrin<'info> {
    #[account(
        constraint = lending_market.admin_bot == *caller.key
            @ err::acc("Only designated bot account can call compound"),
    )]
    pub lending_market: Box<Account<'info, LendingMarket>>,
    #[account(signer)]
    pub caller: AccountInfo<'info>,
    pub farming_ticket_owner_pda: AccountInfo<'info>,
    // -------------- AMM Accounts ----------------
    #[account(executable)]
    pub amm_program: AccountInfo<'info>,
    #[account(
        constraint = *pool.owner == amm_program.key()
            @ err::illegal_owner("Amm pool account \
            must be owned by amm program"),
    )]
    pub pool: AccountInfo<'info>,
    pub pool_signer: AccountInfo<'info>,
    pub pool_mint: Box<Account<'info, Mint>>,
    pub base_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        constraint = base_token_reserve.liquidity.mint == base_token_vault.mint
            @ err::acc("Base token vault and base reserve mint mismatch"),
        constraint = !base_token_reserve.is_stale(&clock) @ err::reserve_stale(),
    )]
    pub base_token_reserve: Box<Account<'info, Reserve>>,
    pub quote_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        constraint = quote_token_reserve.liquidity.mint == quote_token_vault.mint
            @ err::acc("Quote token vault and quote reserve mint mismatch"),
        constraint = !quote_token_reserve.is_stale(&clock) @ err::reserve_stale(),
    )]
    pub quote_token_reserve: Box<Account<'info, Reserve>>,
    #[account(mut)]
    pub caller_lp_wallet: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub caller_farm_wallet: Box<Account<'info, TokenAccount>>,
    pub farming_state: AccountInfo<'info>,
    #[account(mut)]
    pub farming_calc: AccountInfo<'info>,
    #[account(mut)]
    pub new_farming_ticket: AccountInfo<'info>,
    pub farming_snapshots: AccountInfo<'info>,
    #[account(mut)]
    pub farm_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        constraint = farm_token_reserve.liquidity.mint == farm_token_vault.mint
            @ err::acc("Farm token vault and farm reserve mint mismatch"),
        constraint = !farm_token_reserve.is_stale(&clock) @ err::reserve_stale(),
    )]
    pub farm_token_reserve: Box<Account<'info, Reserve>>,
    #[account(mut)]
    pub lp_token_freeze_vault: AccountInfo<'info>,
    // -------------- Other ----------------
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
    pub rent: AccountInfo<'info>,
}

pub fn handle(
    ctx: Context<CompoundLeveragedPositionOnAldrin>,
    stake_lp_amount: u64,
    seeds: Vec<Vec<u8>>,
) -> ProgramResult {
    let accounts = ctx.accounts;

    msg!("compound position at slot {}", accounts.clock.slot);

    if accounts.caller_farm_wallet.mint == accounts.caller_lp_wallet.mint {
        msg!("Farm wallet mint cannot be the same as the LP token mint");
        return Err(ProgramError::InvalidArgument);
    }

    let farm_token_amount_before_withdraw = accounts.caller_farm_wallet.amount;

    let seeds: Vec<_> = seeds.iter().map(|s| s.as_slice()).collect();

    //
    // 1.
    //
    accounts.withdraw_farmed(&seeds)?;

    //
    // 2.
    //
    accounts.caller_farm_wallet.reload()?;
    let farmed_amount = accounts
        .caller_farm_wallet
        .amount
        .checked_sub(farm_token_amount_before_withdraw)
        .ok_or_else(|| ErrorCode::MathOverflow)?;

    accounts.assert_lp_tokens_value_is_fair_for_farmed_rewards(
        farmed_amount,
        stake_lp_amount,
    )?;

    //
    // 3.
    //
    StakeCpi::from(accounts).stake(&seeds, stake_lp_amount)?;

    Ok(())
}

impl<'info> CompoundLeveragedPositionOnAldrin<'info> {
    fn withdraw_farmed(&self, seeds: &[&[u8]]) -> ProgramResult {
        let withdraw_farmed_instruction_accounts = vec![
            AccountMeta::new_readonly(*self.pool.key, false),
            AccountMeta::new_readonly(*self.farming_state.key, false),
            AccountMeta::new(*self.farming_calc.key, false),
            AccountMeta::new(self.farm_token_vault.key(), false),
            AccountMeta::new_readonly(*self.pool_signer.key, false),
            AccountMeta::new(self.caller_farm_wallet.key(), false),
            AccountMeta::new_readonly(*self.farming_ticket_owner_pda.key, true),
            AccountMeta::new_readonly(*self.token_program.key, false),
            AccountMeta::new_readonly(self.clock.key(), false),
        ];
        let withdraw_farmed_instruction_account_infos: Vec<AccountInfo> = vec![
            self.pool.to_account_info(),
            self.farming_state.to_account_info(),
            self.farming_calc.to_account_info(),
            self.farm_token_vault.to_account_info(),
            self.pool_signer.to_account_info(),
            self.caller_farm_wallet.to_account_info(),
            self.farming_ticket_owner_pda.to_account_info(),
            self.token_program.to_account_info(),
            self.clock.to_account_info(),
        ];
        invoke_signed(
            &Instruction {
                program_id: self.amm_program.key(),
                accounts: withdraw_farmed_instruction_accounts,
                data: WithdrawFarmed::instruction_data(),
            },
            &withdraw_farmed_instruction_account_infos[..],
            &[seeds],
        )?;

        Ok(())
    }

    fn assert_lp_tokens_value_is_fair_for_farmed_rewards(
        &self,
        farmed_amount: u64,
        lp_token_amount: u64,
    ) -> ProgramResult {
        let amm_pool_data = self.pool.try_borrow_data()?;
        let amm = amm::Pool::load(&amm_pool_data)?;
        if amm.pool_mint != self.pool_mint.key() {
            msg!("Pool mint doesn't match AMM pool account data");
            return Err(ErrorCode::InvalidAccountInput.into());
        }

        let lp_token_price = amm::lp_token_market_price(
            self.pool_mint.supply,
            self.base_token_reserve.liquidity.market_price.into(),
            self.base_token_vault.amount,
            self.quote_token_reserve.liquidity.market_price.into(),
            self.quote_token_vault.amount,
        )?;

        let lp_total_price =
            Decimal::from(lp_token_amount).try_mul(lp_token_price)?;
        let farmed_total_price = Decimal::from(farmed_amount)
            .try_mul(self.farm_token_reserve.liquidity.market_price.to_dec())?;
        let fee = farmed_total_price
            .try_mul(Decimal::from_percent(self.lending_market.compound_fee))?;

        if lp_total_price < farmed_total_price.try_sub(fee)? {
            msg!(
                "Price of LP tokens ({}) is less than the price of \
                farmed tokens ({}) minus fees ({}) ",
                lp_total_price,
                farmed_total_price,
                fee
            );
            Err(ErrorCode::CompoundingLpPriceMustNotBeLessThanFarmPrice.into())
        } else {
            Ok(())
        }
    }
}

impl<'info> From<&mut CompoundLeveragedPositionOnAldrin<'info>>
    for StakeCpi<'info>
{
    fn from(a: &mut CompoundLeveragedPositionOnAldrin<'info>) -> Self {
        Self {
            amm_program: *a.amm_program.key,
            pool: a.pool.to_account_info(),
            farming_state: a.farming_state.to_account_info(),
            farming_ticket: a.new_farming_ticket.to_account_info(),
            lp_token_freeze_vault: a.lp_token_freeze_vault.to_account_info(),
            borrower_lp_wallet: a.caller_lp_wallet.to_account_info(),
            borrower: a.caller.to_account_info(),
            market_obligation_pda: a.farming_ticket_owner_pda.to_account_info(),
            token_program: a.token_program.to_account_info(),
            clock: a.clock.to_account_info(),
            rent: a.rent.to_account_info(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_scales_down_decimal_when_multiplied_by_percent() {
        let compound_fee = PercentageInt::new(10);
        let farmed_market_price = Decimal::from(150u64);

        let uac_fee = farmed_market_price
            .try_mul(Decimal::from_percent(compound_fee))
            .unwrap();

        assert_eq!(uac_fee, Decimal::from(15u64));
    }
}
