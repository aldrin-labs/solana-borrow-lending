//! This endpoint can be called only by Aldrin compounding bot. Depending on the
//! seed, it either charges leveraged position fee
//! ([`super::LEVERAGED_POSITION_PDA_SEEDS_LEN`]) or vault position fee
//! ([`super::VAULT_POSITION_PDA_SEEDS_LEN`]).
//!
//! ## Steps
//! 1. Harvest farmed tokens into caller's wallet
//!
//! 2. Check that the suggested number of LP tokens to take from the caller's
//! wallet and stake is worth as much as the farmed tokens.
//!
//! 3. Stake caller's LP tokens, let them keep the harvested ones.

use super::{StakeCpi, WithdrawFarmCpi};
use crate::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct CompoundPositionOnAldrin<'info> {
    #[account(
        constraint = lending_market.admin_bot == *caller.key
            @ err::acc("Only designated bot account can call compound"),
    )]
    pub lending_market: Box<Account<'info, LendingMarket>>,
    #[account(signer)]
    pub caller: AccountInfo<'info>,
    /// We don't check for correctness of the PDA in constraints because it
    /// will be checked when we invoke signed CPI on AMM. The farming
    /// ticket's authority is the PDA, and therefore the pubkey here must
    /// be valid. The seeds are provided as argument because they vary for
    /// leveraged position and for vaults position.
    ///
    /// All endpoints for creating a position on AMM use different seeds to
    /// create the PDA, but for compounding we don't really care. It's
    /// because this endpoint doesn't have much influence on the position,
    /// it cannot move the funds out of it. This endpoint is meant to be
    /// called by Aldrin's bot. If you provide incorrectly generated PDA
    /// with wrong seed, the endpoint will fail because AMM returns an
    /// error about authority mismatch.
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
    mut ctx: Context<CompoundPositionOnAldrin>,
    stake_lp_amount: u64,
    seeds: Vec<Vec<u8>>,
) -> ProgramResult {
    let fee = if seeds.len() == super::LEVERAGED_POSITION_PDA_SEEDS_LEN {
        ctx.accounts.lending_market.leveraged_compound_fee
    } else if seeds.len() == super::VAULT_POSITION_PDA_SEEDS_LEN {
        ctx.accounts.lending_market.vault_compound_fee
    } else {
        msg!("Unexpected seed length {}", seeds.len());
        return Err(ProgramError::InvalidArgument);
    };

    ctx.accounts.compound(fee, stake_lp_amount, seeds)
}

/// Abstracts out the calculation of whether the compound bot offered a fair
/// price for farmed tokens and the CPI calls.
///
/// This might become handy in future should we need some special compounding
/// logic for which we would need a new endpoint. Also, it's one step towards
/// more comprehensive unit testing.
trait Compoundable<'info> {
    fn compound(
        &mut self,
        compound_fee: PercentageInt,
        stake_lp_amount: u64,
        seeds: Vec<Vec<u8>>,
    ) -> ProgramResult {
        let farm_mint = self.caller_farm_wallet().mint;
        let lp_mint = self.caller_lp_wallet().mint;
        if farm_mint == lp_mint {
            msg!("Farm wallet mint cannot be the same as the LP token mint");
            return Err(ProgramError::InvalidArgument);
        }

        let farm_token_amount_before_withdraw =
            self.caller_farm_wallet().amount;

        let seeds: Vec<_> = seeds.iter().map(|s| s.as_slice()).collect();

        //
        // 1.
        //
        self.withdraw_farm_cpi().withdraw_farm(&seeds)?;

        //
        // 2.
        //
        self.reload_caller_farm_wallet()?;
        let farmed_amount = self
            .caller_farm_wallet()
            .amount
            .checked_sub(farm_token_amount_before_withdraw)
            .ok_or(ErrorCode::MathOverflow)?;

        self.assert_lp_tokens_value_is_fair_for_farmed_rewards(
            compound_fee,
            farmed_amount,
            stake_lp_amount,
        )?;

        //
        // 3.
        //
        self.stake_cpi().stake(&seeds, stake_lp_amount)?;

        Ok(())
    }

    fn assert_lp_tokens_value_is_fair_for_farmed_rewards(
        &self,
        compound_fee: PercentageInt,
        farmed_amount: u64,
        lp_token_amount: u64,
    ) -> ProgramResult {
        let pool = self.pool();
        let amm_pool_data = pool.try_borrow_data()?;
        let amm = aldrin_amm::Pool::load(&amm_pool_data)?;
        if amm.pool_mint != self.pool_mint().key() {
            msg!("Pool mint doesn't match AMM pool account data");
            return Err(ErrorCode::InvalidAccountInput.into());
        }

        let lp_token_price = aldrin_amm::lp_token_market_price(
            self.pool_mint().supply,
            self.base_token_market_price(),
            self.base_token_vault_amount(),
            self.quote_token_market_price(),
            self.quote_token_vault_amount(),
        )?;

        let lp_total_price =
            Decimal::from(lp_token_amount).try_mul(lp_token_price)?;
        let farmed_total_price = Decimal::from(farmed_amount)
            .try_mul(self.farm_token_market_price())?;
        let fee =
            farmed_total_price.try_mul(Decimal::from_percent(compound_fee))?;

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

    fn caller_farm_wallet(&self) -> &Account<'info, TokenAccount>;
    fn reload_caller_farm_wallet(&mut self) -> ProgramResult;
    fn caller_lp_wallet(&self) -> &Account<'info, TokenAccount>;
    fn pool_mint(&self) -> &Account<'info, Mint>;
    fn pool(&self) -> &AccountInfo<'info>;
    fn base_token_vault_amount(&self) -> u64;
    fn quote_token_vault_amount(&self) -> u64;
    fn farm_token_market_price(&self) -> Decimal;
    fn base_token_market_price(&self) -> Decimal;
    fn quote_token_market_price(&self) -> Decimal;
    fn withdraw_farm_cpi(&self) -> WithdrawFarmCpi<'info>;
    fn stake_cpi(&self) -> StakeCpi<'info>;
}

impl<'info> Compoundable<'info> for &mut CompoundPositionOnAldrin<'info> {
    fn caller_farm_wallet(&self) -> &Account<'info, TokenAccount> {
        &self.caller_farm_wallet
    }
    fn reload_caller_farm_wallet(&mut self) -> ProgramResult {
        self.caller_farm_wallet.reload()?;
        Ok(())
    }
    fn caller_lp_wallet(&self) -> &Account<'info, TokenAccount> {
        &self.caller_lp_wallet
    }
    fn pool_mint(&self) -> &Account<'info, Mint> {
        &self.pool_mint
    }
    fn pool(&self) -> &AccountInfo<'info> {
        &self.pool
    }
    fn base_token_vault_amount(&self) -> u64 {
        self.base_token_vault.amount
    }
    fn quote_token_vault_amount(&self) -> u64 {
        self.quote_token_vault.amount
    }
    fn farm_token_market_price(&self) -> Decimal {
        self.farm_token_reserve.liquidity.market_price.to_dec()
    }
    fn base_token_market_price(&self) -> Decimal {
        self.base_token_reserve.liquidity.market_price.to_dec()
    }
    fn quote_token_market_price(&self) -> Decimal {
        self.quote_token_reserve.liquidity.market_price.to_dec()
    }

    fn withdraw_farm_cpi(&self) -> WithdrawFarmCpi<'info> {
        WithdrawFarmCpi {
            amm_program: *self.amm_program.key,
            pool: self.pool.to_account_info(),
            farming_state: self.farming_state.to_account_info(),
            farming_calc: self.farming_calc.to_account_info(),
            farm_token_vault: self.farm_token_vault.to_account_info(),
            pool_signer: self.pool_signer.to_account_info(),
            caller_farm_wallet: self.caller_farm_wallet.to_account_info(),
            farming_ticket_owner_pda: self
                .farming_ticket_owner_pda
                .to_account_info(),
            token_program: self.token_program.to_account_info(),
            clock: self.clock.to_account_info(),
        }
    }

    fn stake_cpi(&self) -> StakeCpi<'info> {
        StakeCpi {
            amm_program: *self.amm_program.key,
            pool: self.pool.to_account_info(),
            farming_state: self.farming_state.to_account_info(),
            farming_ticket: self.new_farming_ticket.to_account_info(),
            lp_token_freeze_vault: self.lp_token_freeze_vault.to_account_info(),
            borrower_lp_wallet: self.caller_lp_wallet.to_account_info(),
            borrower: self.caller.to_account_info(),
            market_obligation_pda: self
                .farming_ticket_owner_pda
                .to_account_info(),
            token_program: self.token_program.to_account_info(),
            clock: self.clock.to_account_info(),
            rent: self.rent.to_account_info(),
        }
    }
}
