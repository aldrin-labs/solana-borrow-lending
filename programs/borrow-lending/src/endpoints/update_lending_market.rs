//! Updates configuration for lending market.

use crate::prelude::*;

#[derive(Accounts)]
pub struct UpdateLendingMarket<'info> {
    #[account(signer)]
    pub owner: AccountInfo<'info>,
    pub admin_bot: AccountInfo<'info>,
    #[account(mut, has_one = owner @ ErrorCode::InvalidMarketOwner)]
    pub lending_market: Account<'info, LendingMarket>,
}

pub fn handle(
    ctx: Context<UpdateLendingMarket>,
    compound_fee: PercentageInt,
    min_collateral_uac_value_for_leverage: SDecimal,
) -> ProgramResult {
    let accounts = ctx.accounts;
    msg!("update lending market '{}'", accounts.lending_market.key());

    accounts.lending_market.admin_bot = accounts.admin_bot.key();
    accounts.lending_market.compound_fee = compound_fee;
    accounts
        .lending_market
        .min_collateral_uac_value_for_leverage =
        min_collateral_uac_value_for_leverage;

    Ok(())
}
