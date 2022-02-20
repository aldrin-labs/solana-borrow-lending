//! Similar to the [`crate::endpoints::init_reserve`] endpoint but works with
//! an automated market maker (amm) ecosystem. An amm has liquidity pools of
//! two currencies. Base currency (e.g. SOL) and quote currency (e.g. USDC).
//!
//! The difference to a standard reserve is that LP reserve works with two
//! currencies and therefore needs two oracle price accounts. These two
//! currencies can be used together to value LP tokens in USD.
//!
//! Liquidity in context of LP reserve are the amm's LP tokens.

use crate::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
#[instruction(lending_market_bump_seed: u8, liquidity_amount: u64)]
pub struct InitReserveAldrinUnstableLpToken<'info> {
    /// The entity which created the [`LendingMarket`].
    #[account(signer)]
    pub owner: AccountInfo<'info>,
    /// The entity which owns the source liquidity wallet, can be the same as
    /// owner.
    #[account(signer)]
    pub funder: AccountInfo<'info>,
    #[account(
        seeds = [lending_market.to_account_info().key.as_ref()],
        bump = lending_market_bump_seed,
    )]
    pub lending_market_pda: AccountInfo<'info>,
    #[account(has_one = owner @ ErrorCode::InvalidMarketOwner)]
    pub lending_market: Box<Account<'info, LendingMarket>>,
    /// Create a new reserve config which is linked to a lending market.
    #[account(zero)]
    pub reserve: Box<Account<'info, Reserve>>,
    #[account(
        constraint = lending_market.aldrin_amm == *pool.owner
            @ err::acc("Pool must be owned Aldrin's AMM program"),
    )]
    pub pool: AccountInfo<'info>,
    #[account(
        constraint = oracle_product.owner == oracle_price.owner
            @ err::oracle("Product's owner must be prices's owner"),
    )]
    pub oracle_product: AccountInfo<'info>,
    pub oracle_price: AccountInfo<'info>,
    /// From what wallet will liquidity tokens be transferred to the reserve
    /// wallet for the initial liquidity amount.
    ///
    /// Liquidity are the AMM LP tokens.
    #[account(
        mut,
        constraint = source_liquidity_wallet.amount >= liquidity_amount
            @ err::insufficient_funds(
                liquidity_amount,
                source_liquidity_wallet.amount
            ),
    )]
    pub source_liquidity_wallet: Account<'info, TokenAccount>,
    /// In exchange for the deposited initial liquidity, the owner gets
    /// collateral tokens into this wallet. A new token account will be
    /// initialized on this address first.
    #[account(zero)]
    pub destination_collateral_wallet: AccountInfo<'info>,
    /// The reserve wallet in which liquidity tokens will be stored. The
    /// ownership of this account will be transferred to the PDA.
    ///
    /// Since `reserve_liquidity_wallet` requires an uninitialized account
    /// while `source_liquidity_wallet` requires an initialized account,
    /// they can never be the same.
    #[account(
        zero,
        constraint = source_liquidity_wallet.key() !=
            reserve_liquidity_wallet.key()
            @ err::acc("Source liq. wallet mustn't eq. reserve's liq. wallet"),
    )]
    pub reserve_liquidity_wallet: AccountInfo<'info>,
    /// This is the AMM LP mint.
    pub reserve_liquidity_mint: Account<'info, Mint>,
    #[account(zero)]
    pub reserve_liquidity_fee_recv_wallet: AccountInfo<'info>,
    /// We will create a new mint on this account.
    #[account(zero)]
    pub reserve_collateral_mint: AccountInfo<'info>,
    /// We will create a new token wallet on this account.
    #[account(zero)]
    pub reserve_collateral_wallet: AccountInfo<'info>,
    /// Here's where we store recent history of the reserve funds.
    #[account(zero)]
    pub snapshots: AccountLoader<'info, ReserveCapSnapshots>,
    /// Used to create collateral mint token, collateral token wallet, mint
    /// adequate amount of collateral (based on `liquidity_amount`). Then to
    /// create liquidity token wallet and transfer liquidity into it.
    pub token_program: Program<'info, Token>,
    /// Helps us determine freshness of the oracle price estimate.
    pub clock: Sysvar<'info, Clock>,
    pub rent: AccountInfo<'info>,
}

pub fn handle(
    ctx: Context<InitReserveAldrinUnstableLpToken>,
    lending_market_bump_seed: u8,
    liquidity_amount: u64,
    config: InputReserveConfig,
    is_oracle_for_base_vault: bool,
) -> ProgramResult {
    let mut accounts = ctx.accounts;

    let config = config.validate()?;

    if liquidity_amount == 0 {
        msg!("Reserve must be initialized with liquidity");
        return Err(ErrorCode::InvalidAmount.into());
    }

    // we validate that the oracle accounts meet expectations
    let oracle_market_price = pyth::token_market_price(
        &accounts.clock,
        accounts.lending_market.currency,
        accounts.oracle_product.try_borrow_data()?,
        accounts.oracle_price.key(),
        accounts.oracle_price.try_borrow_data()?,
    )?;

    let pool_data = accounts.pool.try_borrow_data()?;
    let pool = aldrin_amm::Pool::load(&pool_data)?;
    if pool.pool_mint != accounts.reserve_liquidity_mint.key() {
        return Err(err::acc("AMM pool mint doesn't match liquidity mint"));
    }

    let oracle = Oracle::AldrinAmmLpPyth {
        vault: if is_oracle_for_base_vault {
            pool.base_token_vault
        } else {
            pool.quote_token_vault
        },
        lp_token_mint: pool.pool_mint,
        price: accounts.oracle_price.key(),
    };
    drop(pool_data); // we're moving accounts, so need to destruct borrow

    accounts.init_reserve_data(
        oracle,
        config,
        oracle_market_price.into(),
        liquidity_amount,
    )?;

    let liq_decimals = accounts.reserve_liquidity_mint.decimals;
    accounts.init_token_accounts_and_fund_initial_liquidity(
        liquidity_amount,
        liq_decimals,
        lending_market_bump_seed,
    )?;

    Ok(())
}

impl<'info> InitReserveOps<'info>
    for &mut InitReserveAldrinUnstableLpToken<'info>
{
    fn slot(&self) -> u64 {
        self.clock.slot
    }

    fn reserve_mut(&mut self) -> &mut Reserve {
        &mut self.reserve
    }

    fn snapshots_mut(
        &mut self,
    ) -> &mut AccountLoader<'info, ReserveCapSnapshots> {
        &mut self.snapshots
    }

    fn token_program(&self) -> AccountInfo<'info> {
        self.token_program.to_account_info()
    }

    fn rent(&self) -> AccountInfo<'info> {
        self.rent.clone()
    }

    fn fee_receiver(&self) -> AccountInfo<'info> {
        self.reserve_liquidity_fee_recv_wallet.to_account_info()
    }

    fn funder(&self) -> AccountInfo<'info> {
        self.funder.clone()
    }

    fn collateral_mint(&self) -> AccountInfo<'info> {
        self.reserve_collateral_mint.clone()
    }

    fn reserve_collateral_wallet(&self) -> AccountInfo<'info> {
        self.reserve_collateral_wallet.to_account_info()
    }

    fn destination_collateral_wallet(&self) -> AccountInfo<'info> {
        self.destination_collateral_wallet.clone()
    }

    fn liquidity_mint(&self) -> AccountInfo<'info> {
        self.reserve_liquidity_mint.to_account_info()
    }

    fn liquidity_mint_decimals(&self) -> u8 {
        self.reserve_liquidity_mint.decimals
    }

    fn reserve_liquidity_wallet(&self) -> AccountInfo<'info> {
        self.reserve_liquidity_wallet.to_account_info()
    }

    fn source_liquidity_wallet(&self) -> AccountInfo<'info> {
        self.source_liquidity_wallet.to_account_info()
    }

    fn lending_market_pda(&self) -> AccountInfo<'info> {
        self.lending_market_pda.clone()
    }

    fn lending_market_key(&self) -> Pubkey {
        self.lending_market.key()
    }

    fn snapshots_key(&self) -> Pubkey {
        self.snapshots.key()
    }
}
