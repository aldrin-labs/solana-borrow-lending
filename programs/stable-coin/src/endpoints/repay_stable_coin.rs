//! After accruing interest, it burns given amount of stable coin tokens. The
//! amount provided as argument is a max, so the user can provide huge number if
//! they want to repay everything.

use crate::prelude::*;
use anchor_spl::token::{self, Token};

#[derive(Accounts)]
pub struct RepayStableCoin<'info> {
    pub borrower: Signer<'info>,
    #[account(
        constraint = stable_coin.key() == component.stable_coin
            @ err::stable_coin_mismatch(),
        constraint = stable_coin.mint == stable_coin_mint.key()
            @ err::stable_coin_mint_mismatch(),
    )]
    pub stable_coin: Box<Account<'info, StableCoin>>,
    /// We need to mutate mint allowance in config.
    #[account(mut)]
    pub component: Box<Account<'info, Component>>,
    #[account(
        mut,
        constraint = interest_wallet.key() == component.interest_wallet
            @ err::acc("Interest wallet must match component's config"),
    )]
    pub interest_wallet: AccountInfo<'info>,
    #[account(
        mut,
        constraint = borrow_fee_wallet.key() == component.borrow_fee_wallet
            @ err::acc("Borrow fee wallet must match component's config"),
    )]
    pub borrow_fee_wallet: AccountInfo<'info>,
    #[account(mut)]
    pub stable_coin_mint: AccountInfo<'info>,
    #[account(
        mut,
        constraint = receipt.component == component.key()
            @ err::acc("Receipt belongs to a different component"),
        constraint = receipt.borrower == borrower.key()
            @ err::acc("Receipt's borrower doesn't match"),
    )]
    pub receipt: Account<'info, Receipt>,
    /// Some tokens in this wallet are burned.
    #[account(mut)]
    pub borrower_stable_coin_wallet: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

/// The max amount to repay might be ceiled up by 3 tokens, one for interest,
/// one for borrow fee and one for borrow amount. Since the amount is
/// represented in a millionth of UAC, which is USD, it's not critical to rename
/// this variable.
pub fn handle(
    ctx: Context<RepayStableCoin>,
    max_amount_to_repay: u64,
) -> ProgramResult {
    let accounts = ctx.accounts;

    if max_amount_to_repay == 0 {
        msg!("Stable coin amount to repay mustn't be zero");
        return Err(ErrorCode::InvalidAmount.into());
    }

    let RepaidShares {
        repaid_borrow_fee,
        repaid_interest,
        repaid_borrow,
    } = accounts.receipt.repay(
        &mut accounts.component.config,
        accounts.clock.slot,
        max_amount_to_repay.into(),
    )?;

    // burn what's been minted to the user
    token::burn(accounts.as_burn_stable_coin_context(), repaid_borrow)?;
    // pay borrow fee into a dedicated wallet
    token::transfer(accounts.as_pay_borrow_fee_context(), repaid_borrow_fee)?;
    // pay interest into a dedicated wallet
    token::transfer(accounts.as_pay_interest_context(), repaid_interest)?;

    Ok(())
}

impl<'info> RepayStableCoin<'info> {
    pub fn as_burn_stable_coin_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Burn<'info>> {
        let cpi_accounts = token::Burn {
            mint: self.stable_coin_mint.to_account_info(),
            to: self.borrower_stable_coin_wallet.to_account_info(),
            authority: self.borrower.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn as_pay_borrow_fee_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.borrower_stable_coin_wallet.clone(),
            to: self.borrow_fee_wallet.to_account_info(),
            authority: self.borrower.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn as_pay_interest_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.borrower_stable_coin_wallet.to_account_info(),
            to: self.interest_wallet.to_account_info(),
            authority: self.borrower.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}
