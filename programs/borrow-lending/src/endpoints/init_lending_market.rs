//! Creates a new [`crate::models::LendingMarket`] account which is the base
//! config that relates reserves (tokens that can be borrowed/lent) to each
//! other and obligations (borrows) to these reserves.

use crate::prelude::*;

#[derive(Accounts)]
pub struct InitLendingMarket<'info> {
    pub owner: Signer<'info>,
    /// Will be used to authorize admin only endpoints, such as
    /// [`crate::endpoints::compound_position_on_aldrin`].
    ///
    /// CHECK: UNSAFE_CODES.md#signer
    pub admin_bot: AccountInfo<'info>,
    /// CHECK: The admin must provide correct id.
    #[account(executable)]
    pub aldrin_amm: AccountInfo<'info>,
    #[account(zero)]
    pub lending_market: Account<'info, LendingMarket>,
}

pub fn handle(
    ctx: Context<InitLendingMarket>,
    currency: UniversalAssetCurrency,
    leveraged_compound_fee: PercentageInt,
    vault_compound_fee: PercentageInt,
    min_collateral_uac_value_for_leverage: SDecimal,
) -> Result<()> {
    let accounts = ctx.accounts;
    msg!("init lending market '{}'", accounts.lending_market.key());

    accounts.lending_market.owner = accounts.owner.key();
    accounts.lending_market.currency = currency;
    accounts.lending_market.admin_bot = accounts.admin_bot.key();
    accounts.lending_market.aldrin_amm = accounts.aldrin_amm.key();
    accounts.lending_market.leveraged_compound_fee = leveraged_compound_fee;
    accounts.lending_market.vault_compound_fee = vault_compound_fee;
    accounts
        .lending_market
        .min_collateral_uac_value_for_leverage =
        min_collateral_uac_value_for_leverage;

    Ok(())
}
