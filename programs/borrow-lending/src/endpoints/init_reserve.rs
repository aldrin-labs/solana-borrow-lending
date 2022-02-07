//! [`Reserve`] is in many-to-one relationship to [`LendingMarket`] and allows
//! the market owner to add new tokens which can be borrowed. When a funder
//! lends an asset they get a collateral mint token in return as a proof of
//! their deposit.

use crate::prelude::*;
use crate::pyth::{self, Load};
use anchor_spl::token::{self, Mint, Token, TokenAccount};
use std::convert::TryFrom;

#[derive(Accounts)]
#[instruction(lending_market_bump_seed: u8, liquidity_amount: u64)]
pub struct InitReserve<'info> {
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
        constraint = oracle_product.owner == oracle_price.owner
            @ err::oracle("Product's owner must be prices's owner"),
    )]
    pub oracle_product: AccountInfo<'info>,
    pub oracle_price: AccountInfo<'info>,
    /// From what wallet will liquidity tokens be transferred to the reserve
    /// wallet for the initial liquidity amount.
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
    ctx: Context<InitReserve>,
    lending_market_bump_seed: u8,
    liquidity_amount: u64,
    config: InputReserveConfig,
) -> ProgramResult {
    let accounts = ctx.accounts;

    let config = config.validate()?;

    if liquidity_amount == 0 {
        msg!("Reserve must be initialized with liquidity");
        return Err(ErrorCode::InvalidAmount.into());
    }

    let oracle_product_data = accounts.oracle_product.try_borrow_data()?;
    let oracle_product =
        pyth::Product::load(&oracle_product_data)?.validate()?;
    if oracle_product.px_acc.val != accounts.oracle_price.key().to_bytes() {
        return Err(err::oracle(
            "Pyth product price account does not match the Pyth price provided",
        ));
    }

    let currency = UniversalAssetCurrency::try_from(oracle_product)?;
    if currency != accounts.lending_market.currency {
        return Err(err::oracle(
            "Lending market quote currency does not match \
            the oracle quote currency",
        ));
    }

    let oracle_price_data = accounts.oracle_price.try_borrow_data()?;
    let oracle_price = pyth::Price::load(&oracle_price_data)?.validate()?;
    let market_price =
        pyth::calculate_market_price(oracle_price, &accounts.clock)?;

    accounts.reserve.last_update = LastUpdate::new(accounts.clock.slot);
    accounts.reserve.lending_market = accounts.lending_market.key();
    accounts.reserve.snapshots = accounts.snapshots.key();
    accounts.reserve.config = config;
    accounts.reserve.liquidity = ReserveLiquidity {
        mint: accounts.reserve_liquidity_mint.key(),
        mint_decimals: accounts.reserve_liquidity_mint.decimals,
        supply: accounts.reserve_liquidity_wallet.key(),
        fee_receiver: accounts.reserve_liquidity_fee_recv_wallet.key(),
        oracle: Oracle::simple_pyth(accounts.oracle_price.key()),
        market_price: market_price.into(),
        ..Default::default()
    };
    accounts.reserve.collateral = ReserveCollateral {
        mint: accounts.reserve_collateral_mint.key(),
        supply: accounts.reserve_collateral_wallet.key(),
        ..Default::default()
    };

    let freeze_authority = None;
    token::initialize_mint(
        accounts.into_init_collateral_mint_context(),
        accounts.reserve_liquidity_mint.decimals,
        &accounts.lending_market_pda.key(),
        freeze_authority,
    )?;

    token::initialize_account(accounts.into_init_fee_recv_wallet_context())?;
    token::initialize_account(accounts.into_init_liquidity_wallet_context())?;
    token::initialize_account(
        accounts.into_init_reserve_collateral_wallet_context(),
    )?;

    let pda_seeds = &[
        &accounts.lending_market.key().to_bytes()[..],
        &[lending_market_bump_seed],
    ];

    // a wallet for the funder
    token::initialize_account(
        accounts.into_init_destination_collateral_wallet_context(),
    )?;
    // to get their collateral token
    let collateral_amount =
        accounts.reserve.deposit_liquidity(liquidity_amount)?;
    token::mint_to(
        accounts
            .into_mint_collateral_for_liquidity_context()
            .with_signer(&[&pda_seeds[..]]),
        collateral_amount,
    )?;
    // in exchange for the deposited initial liquidity
    token::transfer(
        accounts.into_liquidity_deposit_context(),
        liquidity_amount,
    )?;

    let mut snapshots = accounts.snapshots.load_init()?;
    snapshots.ring_buffer[0] = ReserveCap {
        slot: accounts.clock.slot,
        borrowed_amount: 0,
        available_amount: accounts.reserve.liquidity.available_amount,
    };
    snapshots.reserve = accounts.reserve.key();

    Ok(())
}

impl<'info> InitReserve<'info> {
    pub fn into_init_collateral_mint_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::InitializeMint<'info>> {
        let cpi_accounts = token::InitializeMint {
            mint: self.reserve_collateral_mint.clone(),
            rent: self.rent.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn into_init_fee_recv_wallet_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::InitializeAccount<'info>> {
        let cpi_accounts = token::InitializeAccount {
            mint: self.reserve_liquidity_mint.to_account_info(),
            authority: self.lending_market_pda.clone(),
            account: self.reserve_liquidity_fee_recv_wallet.to_account_info(),
            rent: self.rent.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn into_init_liquidity_wallet_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::InitializeAccount<'info>> {
        let cpi_accounts = token::InitializeAccount {
            mint: self.reserve_liquidity_mint.to_account_info(),
            authority: self.lending_market_pda.clone(),
            account: self.reserve_liquidity_wallet.to_account_info(),
            rent: self.rent.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn into_init_reserve_collateral_wallet_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::InitializeAccount<'info>> {
        let cpi_accounts = token::InitializeAccount {
            mint: self.reserve_collateral_mint.to_account_info(),
            authority: self.lending_market_pda.clone(),
            account: self.reserve_collateral_wallet.to_account_info(),
            rent: self.rent.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn into_init_destination_collateral_wallet_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::InitializeAccount<'info>> {
        let cpi_accounts = token::InitializeAccount {
            mint: self.reserve_collateral_mint.to_account_info(),
            authority: self.funder.clone(),
            account: self.destination_collateral_wallet.clone(),
            rent: self.rent.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn into_liquidity_deposit_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.source_liquidity_wallet.to_account_info(),
            to: self.reserve_liquidity_wallet.to_account_info(),
            authority: self.funder.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }

    pub fn into_mint_collateral_for_liquidity_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::MintTo<'info>> {
        let cpi_accounts = token::MintTo {
            mint: self.reserve_collateral_mint.clone(),
            to: self.destination_collateral_wallet.clone(),
            authority: self.lending_market_pda.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}
