//! This endpoint serves for funders who lent liquidity to the borrow-lending
//! program previously. In exchange for their liquidity they got collateral
//! token in the [`crate::endpoints::deposit_reserve_liquidity`] endpoint. Here,
//! they redeem given amount of those collateral tokens for liquidity.
//!
//! Because the reserve may have been accruing interest, they will receive their
//! share of that interest. The share is calculated with the exchange rate {eq.
//! (2)} because the exchange rate factors in amount of existing collateral (how
//! much other funders deposited) and liquidity (whose total includes the
//! interest gains).

use crate::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

#[derive(Accounts)]
#[instruction(lending_market_bump_seed: u8, liquidity_amount: u64)]
pub struct RedeemReserveCollateral<'info> {
    #[account(signer)]
    pub funder: AccountInfo<'info>,
    /// Funder's token account which will be deposited with liquidity that they
    /// funder plus accrued interest. The interest they receive is given by the
    /// exchange rate between the collateral token and liquidity token. See
    /// eq. (2).
    ///
    /// TBD: Should the funder be the accounts authority?
    #[account(
        mut,
        constraint = destination_liquidity_wallet.mint == reserve.liquidity.mint
            @ err::acc("Dest. liq. wallet mint must match reserve conf"),
        constraint = destination_liquidity_wallet.key() !=
            reserve.liquidity.supply @ err::acc("Dest. liq. wallet musn't \
            equal to reserve liq. wallet"),
    )]
    pub destination_liquidity_wallet: Account<'info, TokenAccount>,
    #[account(
        seeds = [reserve.lending_market.as_ref()],
        bump = lending_market_bump_seed,
    )]
    pub lending_market_pda: AccountInfo<'info>,
    #[account(
        mut,
        constraint = !reserve.last_update.is_stale(clock.slot).unwrap_or(true)
            @ err::reserve_stale(),
    )]
    pub reserve: Account<'info, Reserve>,
    #[account(
        mut,
        constraint = reserve.collateral.mint == reserve_collateral_mint.key()
            @ err::acc("Reserve col. mint must match reserve conf"),
    )]
    pub reserve_collateral_mint: AccountInfo<'info>,
    /// When the funder called [`crate::endpoints::deposit_reserve_liquidity`],
    /// they got collateral token in exchange for their liquidity.
    ///
    /// In this endpoint we burn these tokens.
    #[account(
        mut,
        constraint = source_collateral_wallet.key() != reserve.collateral.supply
            @ err::acc("Source col. wallet mustn't equal to reserve col. wallet"),
    )]
    pub source_collateral_wallet: AccountInfo<'info>,
    /// All assets are deposited into this wallet, and we pay the funder from
    /// this wallet too.
    #[account(
        mut,
        constraint = reserve_liquidity_wallet.key() == reserve.liquidity.supply
            @ err::acc("Reserve liq. wallet must match reserve conf"),
    )]
    pub reserve_liquidity_wallet: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(
    ctx: Context<RedeemReserveCollateral>,
    lending_market_bump_seed: u8,
    collateral_amount: u64,
) -> ProgramResult {
    let accounts = ctx.accounts;

    if collateral_amount == 0 {
        msg!("Collateral amount provided cannot be zero");
        return Err(ErrorCode::InvalidAmount.into());
    }

    let liquidity_amount =
        accounts.reserve.redeem_collateral(collateral_amount)?;
    accounts.reserve.last_update.mark_stale();

    let pda_seeds = &[
        &accounts.reserve.lending_market.to_bytes()[..],
        &[lending_market_bump_seed],
    ];
    token::transfer(
        accounts
            .into_return_funders_liquidity_context()
            .with_signer(&[&pda_seeds[..]]),
        liquidity_amount,
    )?;

    token::burn(
        accounts.into_burn_collateral_token_context(),
        collateral_amount,
    )?;

    Ok(())
}

impl<'info> RedeemReserveCollateral<'info> {
    pub fn into_burn_collateral_token_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Burn<'info>> {
        let cpi_accounts = token::Burn {
            mint: self.reserve_collateral_mint.clone(),
            to: self.source_collateral_wallet.clone(),
            authority: self.funder.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn into_return_funders_liquidity_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.reserve_liquidity_wallet.to_account_info(),
            to: self.destination_liquidity_wallet.to_account_info(),
            authority: self.lending_market_pda.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}
