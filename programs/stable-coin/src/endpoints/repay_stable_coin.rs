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

pub fn handle(
    ctx: Context<RepayStableCoin>,
    max_amount_to_repay: u64,
) -> ProgramResult {
    let accounts = ctx.accounts;

    if max_amount_to_repay == 0 {
        msg!("Stable coin amount to repay mustn't be zero");
        return Err(ErrorCode::InvalidAmount.into());
    }

    let amount_to_burn = accounts.receipt.repay(
        &accounts.component.config,
        accounts.clock.slot,
        max_amount_to_repay,
    )?;

    // A surprising behavior here is that the allowance is increased
    // by the borrow fee and interest here, whereas its not decreased by these
    // amounts when borrowing. That is not a big deal and it'd be annoying
    // to untangle the borrow fee from the borrowed amount, so we just keep it
    // this way. We can easily tolerate this behavior because we're manually
    // adjusting the allowance.
    accounts.component.config.mint_allowance = accounts
        .component
        .config
        .mint_allowance
        .checked_add(amount_to_burn)
        .ok_or(ErrorCode::MathOverflow)?;

    token::burn(accounts.as_burn_stable_coin_context(), amount_to_burn)?;

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
}
