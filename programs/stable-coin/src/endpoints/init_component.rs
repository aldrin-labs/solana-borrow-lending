//! Adds a new token which can be used as a collateral to mint stable coin. The
//! token must exist as a reserve in some BLp first. The token mint can also be
//! a collateral token mint from a BLp.

use crate::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

#[derive(Accounts)]
#[instruction(component_bump_seed: u8)]
pub struct InitComponent<'info> {
    pub admin: Signer<'info>,
    /// The root stable coin account to associate the new component with.
    #[account(
        constraint = stable_coin.admin == admin.key() @ err::admin_mismatch(),
    )]
    pub stable_coin: Box<Account<'info, StableCoin>>,
    #[account(zero)]
    pub component: Box<Account<'info, Component>>,
    /// The liquidity mint which will be used as collateral.
    pub mint: Account<'info, Mint>,
    /// We piggyback on the borrow lending logic to avoid duplicating oracle
    /// behavior.
    ///
    /// The component mint can either be the reserve's liquidity mint, or the
    /// reserve's collateral mint. When calculating component token price, we
    /// use the correct formula based on which one of the two equals to the
    /// component mint.
    pub blp_reserve: Box<Account<'info, borrow_lending::models::Reserve>>,
    /// We store the collateral here.
    #[account(
        constraint = freeze_wallet.mint == mint.key()
            @ err::acc("Freeze wallet mint must match component mint"),
        constraint = freeze_wallet.close_authority.is_none()
            @ err::acc("Freeze wallet mustn't have a close authority"),
        constraint = freeze_wallet.owner == component_pda.key()
            @ err::acc("Freeze wallet owner must be a PDA"),
    )]
    pub freeze_wallet: Account<'info, TokenAccount>,
    #[account(
        constraint = fee_wallet.mint == mint.key()
            @ err::acc("Fee wallet mint must match component mint"),
        constraint = fee_wallet.close_authority.is_none()
            @ err::acc("Fee wallet mustn't have a close authority"),
    )]
    pub fee_wallet: Account<'info, TokenAccount>,
    /// The owner of wallets associated with this component.
    #[account(
        seeds = [component.to_account_info().key.as_ref()],
        bump = component_bump_seed,
    )]
    pub component_pda: AccountInfo<'info>,
}

pub fn handle(
    ctx: Context<InitComponent>,
    _component_bump_seed: u8,
    config: InputComponentConfig,
) -> ProgramResult {
    let accounts = ctx.accounts;

    accounts.component.blp_reserve = accounts.blp_reserve.key();
    accounts.component.config = config.validate()?;
    accounts.component.freeze_wallet = accounts.freeze_wallet.key();
    accounts.component.mint = accounts.mint.key();
    accounts.component.decimals = accounts.mint.decimals;
    accounts.component.fee_wallet = accounts.fee_wallet.key();
    accounts.component.stable_coin = accounts.stable_coin.key();

    Ok(())
}
