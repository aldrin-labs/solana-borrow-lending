//! Toggles flash loan feature on if off and off if on. If toggled off then
//! flash loan endpoint always errors. The feature is disabled by default.

use crate::prelude::*;

#[derive(Accounts)]
pub struct ToggleFlashLoans<'info> {
    #[account(signer)]
    pub owner: AccountInfo<'info>,
    #[account(mut, has_one = owner @ ErrorCode::InvalidMarketOwner)]
    pub lending_market: Account<'info, LendingMarket>,
}

pub fn handle(ctx: Context<ToggleFlashLoans>) -> ProgramResult {
    let accounts = ctx.accounts;

    accounts.lending_market.enable_flash_loans =
        !accounts.lending_market.enable_flash_loans;

    Ok(())
}
