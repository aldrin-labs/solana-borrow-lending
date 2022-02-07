//! Closes a farming ticket and swaps all withdrawn liquidity into the same mint
//! via swap.
//!
//! If the value of the position is larger than the loan, or if the loan has
//! been repaid by other means, the extra funds will remain in the borrowers
//! liquidity wallet with the same mint as the reserve.
//!
//! ## Steps
//! 1. Unstake all LPs from given farming ticket, record how many LPs were
//! unstaked.
//!
//! 2. Exchange those unstaked LPs for constituent base and quote tokens.
//!
//! 3. Swap base or quote token into the other, based on which one was borrowed.
//! We want to end up with all liquidity in the same mint as the borrowed
//! reserve.
//!
//! 4. Repay what's due and keep the difference in the borrower's wallet if any.
//!
//! ## Liquidation
//! If all borrower's collateral gets liquidated and there're only loans on the
//! obligation, then this endpoint can be called by anyone. The unstaked funds
//! will repay the loan if there's something extra, it will stay in the caller's
//! wallets.

use super::{EndFarming, RedeemBasket, Side, SwapCpi};
use crate::prelude::*;
use anchor_lang::solana_program::{
    instruction::Instruction, program::invoke_signed,
};
use anchor_spl::token::{self, Token, TokenAccount};

#[derive(Accounts)]
#[instruction(
    market_obligation_bump_seed: u8,
    leverage: Leverage,
)]
pub struct CloseLeveragedPositionOnAldrin<'info> {
    pub lending_market: Box<Account<'info, LendingMarket>>,
    /// It's mut because we are closing farming receipt account and returning
    /// lamports to caller.
    ///
    /// # Important
    /// Usually, this would be the borrower, i.e. owner of the obligation.
    /// However, if the obligation's collateral has been completely
    /// liquidated, then the only way to repay the loan is to close some
    /// open positions. Any liquidator can call this endpoint to repay the user
    /// loan if the collateral UAC value goes below a threshold (e.g. $10).
    /// Liquidator can call this with difference farming tickets until the loan
    /// is repaid, and gets to keep the difference plus the lamports which
    /// were used to pay the rent on the [`FarmingReceipt`].
    #[account(mut, signer)]
    pub caller: AccountInfo<'info>,
    #[account(mut)]
    pub obligation: AccountLoader<'info, Obligation>,
    #[account(
        mut,
        constraint = !reserve.is_stale(&clock) @ err::reserve_stale(),
        constraint = reserve.lending_market == lending_market.key()
            @ err::acc("Lending market doesn't match reserve's config")
    )]
    pub reserve: Box<Account<'info, Reserve>>,
    /// Loan in repaid into this wallet.
    #[account(
        mut,
        constraint = reserve_liquidity_wallet.key() == reserve.liquidity.supply
            @ err::acc("Source liq. wallet must eq. reserve's liq. supply"),
    )]
    pub reserve_liquidity_wallet: AccountInfo<'info>,
    /// See the [`crate::endpoints::leverage_farming::aldrin::open`] module for
    /// documentation on the rational behind these seeds, or the README.
    #[account(
        seeds = [
            reserve.lending_market.as_ref(), obligation.key().as_ref(),
            reserve.key().as_ref(), &leverage.to_le_bytes()
        ],
        bump = market_obligation_bump_seed,
    )]
    pub market_obligation_pda: AccountInfo<'info>,
    /// We no longer need the receipt as the farming ticket is closed.
    /// Therefore we return the rent back to borrower.
    #[account(mut, close = caller)]
    pub farming_receipt: Account<'info, FarmingReceipt>,
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
    #[account(mut)]
    pub pool_mint: AccountInfo<'info>,
    #[account(mut)]
    pub base_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub quote_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub caller_base_wallet: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub caller_quote_wallet: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub caller_lp_wallet: Box<Account<'info, TokenAccount>>,
    /// This is not used in the AMM but still required as an input by the AMM.
    #[account(mut)]
    pub caller_sol_wallet: AccountInfo<'info>,
    #[account(mut)]
    pub fee_base_wallet: AccountInfo<'info>,
    #[account(mut)]
    pub fee_quote_wallet: AccountInfo<'info>,
    pub farming_state: AccountInfo<'info>,
    #[account(mut)]
    pub farming_ticket: AccountInfo<'info>,
    pub farming_snapshots: AccountInfo<'info>,
    #[account(mut)]
    pub lp_token_freeze_vault: AccountInfo<'info>,
    #[account(mut)]
    pub fee_pool_wallet: AccountInfo<'info>,
    // -------------- Other ----------------
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
    pub rent: AccountInfo<'info>,
}

pub fn handle(
    ctx: Context<CloseLeveragedPositionOnAldrin>,
    market_obligation_bump_seed: u8,
    leverage: Leverage,
) -> ProgramResult {
    let accounts = ctx.accounts;

    // whether user borrowed base or quote
    let side = Side::try_from(
        &accounts.reserve,
        &accounts.base_token_vault,
        &accounts.quote_token_vault,
    )?;

    //
    // 1.
    //
    let unstaked_lp_amount =
        accounts.unstake(market_obligation_bump_seed, leverage)?;

    //
    // 2.
    //
    let token_amount_before_withdraw = if matches!(side, Side::Ask) {
        // The reserve mint matches base token mint, therefore user borrowed
        // the base token. Which means that we want to swap quote tokens back
        // to base tokens.
        accounts.caller_quote_wallet.amount
    } else {
        accounts.caller_base_wallet.amount
    };

    accounts.exchange_lp_tokens_for_constituent_tokens(
        market_obligation_bump_seed,
        leverage,
        unstaked_lp_amount,
    )?;

    //
    // 3.
    //
    let tokens_to_swap = if matches!(side, Side::Ask) {
        // see the `token_amount_before_withdraw` declaration above
        accounts.caller_quote_wallet.reload()?;
        accounts.caller_quote_wallet.amount - token_amount_before_withdraw
    } else {
        accounts.caller_base_wallet.reload()?;
        accounts.caller_base_wallet.amount - token_amount_before_withdraw
    };

    if tokens_to_swap > 0 {
        // TBD: accept any exchange rate?
        // we want to change side because if we borrowed base, we want to swap
        // quote for base, and vice versa
        let min_swap_return = 0;
        SwapCpi::from(&accounts).swap(
            tokens_to_swap,
            min_swap_return,
            !side,
        )?;
    }

    //
    // 4.
    //
    accounts.repay(leverage, side, token_amount_before_withdraw)?;

    Ok(())
}

impl<'info> CloseLeveragedPositionOnAldrin<'info> {
    fn unstake(
        &mut self,
        market_obligation_bump_seed: u8,
        leverage: Leverage,
    ) -> Result<u64> {
        let lp_tokens_before = self.caller_lp_wallet.amount;

        let end_farming_instruction_accounts = vec![
            AccountMeta::new_readonly(*self.pool.key, false),
            AccountMeta::new_readonly(*self.farming_state.key, false),
            AccountMeta::new_readonly(*self.farming_snapshots.key, false),
            AccountMeta::new(*self.farming_ticket.key, false),
            AccountMeta::new(*self.lp_token_freeze_vault.key, false),
            AccountMeta::new_readonly(*self.pool_signer.key, false),
            AccountMeta::new(self.caller_lp_wallet.key(), false),
            AccountMeta::new_readonly(*self.market_obligation_pda.key, true),
            AccountMeta::new_readonly(*self.token_program.key, false),
            AccountMeta::new_readonly(self.clock.key(), false),
            AccountMeta::new_readonly(*self.rent.key, false),
        ];
        let end_farming_instruction_account_infos: Vec<AccountInfo> = vec![
            self.pool.to_account_info(),
            self.pool_signer.to_account_info(),
            self.farming_state.to_account_info(),
            self.farming_ticket.to_account_info(),
            self.farming_snapshots.to_account_info(),
            self.lp_token_freeze_vault.to_account_info(),
            self.caller_lp_wallet.to_account_info(),
            self.market_obligation_pda.to_account_info(),
            self.token_program.to_account_info(),
            self.clock.to_account_info(),
            self.rent.to_account_info(),
        ];

        // ~35k units
        invoke_signed(
            &Instruction {
                program_id: self.amm_program.key(),
                accounts: end_farming_instruction_accounts,
                data: EndFarming.instruction_data(),
            },
            &end_farming_instruction_account_infos[..],
            &[&[
                &self.reserve.lending_market.to_bytes()[..],
                &self.obligation.key().to_bytes()[..],
                &self.reserve.key().to_bytes()[..],
                &leverage.to_le_bytes()[..],
                &[market_obligation_bump_seed],
            ]],
        )?;

        self.caller_lp_wallet.reload()?;
        let unstaked_lp_amount = self
            .caller_lp_wallet
            .amount
            .checked_sub(lp_tokens_before)
            .ok_or_else(|| ErrorCode::MathOverflow)?;

        Ok(unstaked_lp_amount)
    }

    fn exchange_lp_tokens_for_constituent_tokens(
        &self,
        market_obligation_bump_seed: u8,
        leverage: Leverage,
        unstake_lp_amount: u64,
    ) -> ProgramResult {
        let redeem_basket_instruction_accounts = vec![
            AccountMeta::new_readonly(*self.pool.key, false),
            AccountMeta::new(self.pool_mint.key(), false),
            AccountMeta::new(self.base_token_vault.key(), false),
            AccountMeta::new(self.quote_token_vault.key(), false),
            AccountMeta::new_readonly(*self.pool_signer.key, false),
            AccountMeta::new(self.caller_lp_wallet.key(), false),
            AccountMeta::new(self.caller_base_wallet.key(), false),
            AccountMeta::new(self.caller_quote_wallet.key(), false),
            AccountMeta::new_readonly(*self.caller.key, true),
            AccountMeta::new(self.caller_sol_wallet.key(), false),
            AccountMeta::new_readonly(*self.token_program.key, false),
            AccountMeta::new(self.fee_base_wallet.key(), false),
            AccountMeta::new(self.fee_quote_wallet.key(), false),
            AccountMeta::new_readonly(self.clock.key(), false),
        ];
        let redeem_basket_instruction_account_infos: Vec<AccountInfo> = vec![
            self.pool.to_account_info(),
            self.pool_mint.to_account_info(),
            self.base_token_vault.to_account_info(),
            self.quote_token_vault.to_account_info(),
            self.pool_signer.to_account_info(),
            self.caller_sol_wallet.to_account_info(),
            self.caller_base_wallet.to_account_info(),
            self.caller_quote_wallet.to_account_info(),
            self.caller_lp_wallet.to_account_info(),
            self.fee_base_wallet.to_account_info(),
            self.fee_quote_wallet.to_account_info(),
            self.caller.clone(),
            self.token_program.to_account_info(),
            self.clock.to_account_info(),
        ];
        // ~50k units
        invoke_signed(
            &Instruction {
                program_id: self.amm_program.key(),
                accounts: redeem_basket_instruction_accounts,
                data: RedeemBasket {
                    redemption_size: unstake_lp_amount,
                    base_token_returned_min: 0,
                    quote_token_returned_min: 0,
                }
                .instruction_data(),
            },
            &redeem_basket_instruction_account_infos[..],
            &[&[
                &self.reserve.lending_market.to_bytes()[..],
                &self.obligation.key().to_bytes()[..],
                &self.reserve.key().to_bytes()[..],
                &leverage.to_le_bytes()[..],
                &[market_obligation_bump_seed],
            ]],
        )?;

        Ok(())
    }

    fn repay(
        &mut self,
        leverage: Leverage,
        side: Side,
        token_amount_before_withdraw: u64,
    ) -> ProgramResult {
        let mut obligation = self.obligation.load_mut()?;

        // Checks whether this loan exists. If it doesn't that means the loan
        // has been repaid already and the borrower is just withdrawing
        // their extra earned liquidity.
        let loan_info = obligation
            .get_liquidity(
                self.reserve.key(),
                LoanKind::YieldFarming { leverage },
            )
            .ok();

        // if the obligation contains no more collateral that can be used
        // for liquidation, but the loan still exists (i.e. this isn't a
        // position still active after repaying all loan)
        let is_being_liquidated =
            !obligation.has_deposits() && loan_info.is_some();
        // then we allow liquidators (i.e. not the borrower, owner of
        // obligation) to call this action which will repay the loan
        if !is_being_liquidated && self.caller.key() != obligation.owner {
            return Err(ProgramError::IllegalOwner);
        }

        if obligation.is_stale_for_leverage(&self.clock) {
            return Err(err::obligation_stale());
        }
        if self.reserve.lending_market != obligation.lending_market {
            return Err(err::market_mismatch());
        }

        if let Some((liquidity_index, liquidity)) = loan_info {
            let tokens_withdrawn = if matches!(side, Side::Ask) {
                // we will be repaying the loan from the base wallet because
                // reserve matched the base token mint
                self.caller_base_wallet.reload()?;
                self.caller_base_wallet.amount - token_amount_before_withdraw
            } else {
                self.caller_quote_wallet.reload()?;
                self.caller_quote_wallet.amount - token_amount_before_withdraw
            };

            // if `repay_amount` is less than `tokens_withdrawn`, the difference
            // will stay in the user wallet
            let (repay_amount, settle_amount) = calculate_repay_amounts(
                tokens_withdrawn,
                liquidity.borrowed_amount.to_dec(),
            )?;

            if repay_amount == 0 {
                msg!("Repay amount is too small to transfer liquidity");
                return Err(ErrorCode::RepayTooSmall.into());
            }

            // increases the available amount in the reserve
            self.reserve.liquidity.repay(repay_amount, settle_amount)?;

            // and removes the owed amount from the obligation
            obligation.repay(
                settle_amount,
                liquidity_index,
                self.clock.slot,
            )?;

            self.reserve.last_update.mark_stale();
            obligation.last_update.mark_stale();

            token::transfer(
                self.into_repay_liquidity_context(side),
                repay_amount,
            )?;
        }

        Ok(())
    }
}

impl<'info> From<&&mut CloseLeveragedPositionOnAldrin<'info>>
    for SwapCpi<'info>
{
    fn from(a: &&mut CloseLeveragedPositionOnAldrin<'info>) -> Self {
        Self {
            amm_program: *a.amm_program.key,
            pool: a.pool.to_account_info(),
            pool_signer: a.pool_signer.to_account_info(),
            pool_mint: a.pool_mint.to_account_info(),
            fee_pool_wallet: a.fee_pool_wallet.to_account_info(),
            base_token_vault: a.base_token_vault.to_account_info(),
            quote_token_vault: a.quote_token_vault.to_account_info(),
            borrower_base_wallet: a.caller_base_wallet.to_account_info(),
            borrower_quote_wallet: a.caller_quote_wallet.to_account_info(),
            borrower: a.caller.to_account_info(),
            token_program: a.token_program.to_account_info(),
        }
    }
}

impl<'info> CloseLeveragedPositionOnAldrin<'info> {
    fn into_repay_liquidity_context(
        &self,
        side: Side,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: if matches!(side, Side::Ask) {
                self.caller_base_wallet.to_account_info()
            } else {
                self.caller_quote_wallet.to_account_info()
            },
            to: self.reserve_liquidity_wallet.to_account_info(),
            authority: self.caller.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}
