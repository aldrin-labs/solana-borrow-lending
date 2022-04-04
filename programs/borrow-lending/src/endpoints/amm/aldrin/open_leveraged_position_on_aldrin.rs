//! Start farming with borrowed liquidity. Optionally, some of the liquidity can
//! be swapped for the other token via Aldrin's AMM. Only a fraction of the
//! liquidity amount borrowed will have to be collateralized. This fraction is
//! given by the leverage.
//!
//! This is intended to be called multiple times for the same LP pool if the
//! borrower wants to increase their position.
//!
//! ## Steps
//! 1. Borrow given amount of liquidity from the reserve. The amount can be
//! higher than allowed borrow amount by the leverage factor.
//!
//! 2. (optionally) Exchange fraction of the borrowed liquidity for the other
//! constituent token.
//!
//! 3. Create basket, a.k.a deposit constituent tokens and get LP tokens in
//! return.
//!
//! 4. Start farming which creates a new farming ticket. IMPORTANT:
//! owner of this ticket is a PDA    `market_obligation_pda`. This means that
//! the user cannot touch the funds other way but via    the BLp. We then in
//! code guarantee that the leveraged funds cannot be defaulted on.
//!
//! ## Example
//! To farm SOL/USDC with liquidity amount of 100 SOL, we swap 50 SOL for USDC.
//! With leverage of 3x the user's collateral covers only 100/3 SOL. Leverage
//! 3x is 300%.

use crate::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};
use cpis::aldrin::{GetLpTokensCpi, StakeCpi, SwapCpi};

/// Contains market pubkey, obligation pubkey, reserve pubkey, leverage and bump
/// seed.
pub const LEVERAGED_POSITION_PDA_SEEDS_LEN: usize = 5;

#[derive(Accounts)]
#[instruction(
    lending_market_bump_seed: u8,
    market_obligation_bump_seed: u8,
    _stake_lp_amount: u64,
    _liquidity_amount: u64,
    _swap_amount: u64,
    _min_swap_return: u64,
    leverage: Leverage
)]
pub struct OpenLeveragedPositionOnAldrin<'info> {
    pub lending_market: Box<Account<'info, LendingMarket>>,
    #[account(signer)]
    pub borrower: AccountInfo<'info>,
    #[account(mut)]
    pub obligation: AccountLoader<'info, Obligation>,
    #[account(
        mut,
        constraint = !reserve.is_stale(&clock) @ err::reserve_stale(),
        constraint = reserve.lending_market == lending_market.key()
            @ err::acc("Lending market doesn't match reserve's config")
    )]
    pub reserve: Box<Account<'info, Reserve>>,
    #[account(
        seeds = [reserve.lending_market.as_ref()],
        bump = lending_market_bump_seed,
    )]
    pub lending_market_pda: AccountInfo<'info>,
    /// The reserve which is going to be borrowed with leverage. Half of the
    /// borrowed funds are going to be swapped for the other constituent
    /// liquidity token.
    #[account(
        mut,
        constraint = reserve_liquidity_wallet.key() == reserve.liquidity.supply
            @ err::acc("Source liq. wallet must eq. reserve's liq. supply"),
    )]
    pub reserve_liquidity_wallet: AccountInfo<'info>,
    /// We have the lending market in the seed to not conflate them. We have
    /// the obligation in the seed to know which borrower has access to the
    /// farming ticket. We have the reserve in the seed to know which
    /// resource was lent to stake the LPs. We have the leverage in the
    /// seed because that uniquely identifies loans.
    ///
    /// Without the leverage info a user could create two leveraged position in
    /// the same reserve, one small and other large. And then close the small
    /// position with the farming ticket from the large one, thereby running
    /// away with the difference. Using this PDA helps us associate the
    /// specific loan ([`ObligationLiquidity`]) exactly.
    #[account(
        seeds = [
            reserve.lending_market.as_ref(), obligation.key().as_ref(),
            reserve.key().as_ref(), leverage.to_le_bytes().as_ref()
        ],
        bump = market_obligation_bump_seed,
    )]
    pub market_obligation_pda: AccountInfo<'info>,
    /// Allows us to search the blockchain accounts for associated farming
    /// ticket since the PDA is hard to work with.
    #[account(zero)]
    pub farming_receipt: Box<Account<'info, AldrinFarmingReceipt>>,
    // -------------- AMM Accounts ----------------
    #[account(
        executable,
        constraint = lending_market.aldrin_amm == amm_program.key()
            @ err::aldrin_amm_program_mismatch(),
    )]
    pub amm_program: AccountInfo<'info>,
    pub pool: AccountInfo<'info>,
    pub pool_signer: AccountInfo<'info>,
    #[account(mut)]
    pub pool_mint: AccountInfo<'info>,
    #[account(mut)]
    pub base_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub quote_token_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub fee_pool_wallet: AccountInfo<'info>,
    #[account(mut)]
    pub borrower_base_wallet: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub borrower_quote_wallet: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub borrower_lp_wallet: Box<Account<'info, TokenAccount>>,
    pub farming_state: AccountInfo<'info>,
    #[account(mut)]
    pub farming_ticket: AccountInfo<'info>,
    #[account(mut)]
    pub lp_token_freeze_vault: AccountInfo<'info>,
    // -------------- Other ----------------
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
    pub rent: AccountInfo<'info>,
}

#[allow(clippy::too_many_arguments)]
pub fn handle(
    ctx: Context<OpenLeveragedPositionOnAldrin>,
    lending_market_bump_seed: u8,
    market_obligation_bump_seed: u8,
    stake_lp_amount: u64,
    liquidity_amount: u64,
    swap_amount: u64,
    min_swap_return: u64,
    leverage: Leverage,
) -> ProgramResult {
    let accounts = ctx.accounts;

    if stake_lp_amount == 0 {
        msg!("Cannot stake 0 LP tokens");
        return Err(ErrorCode::InvalidAmount.into());
    }

    if liquidity_amount == 0 {
        msg!("Must borrow some liquidity");
        return Err(ErrorCode::InvalidAmount.into());
    }

    // we note user amounts before the call so that we can assert that after the
    // call the user didn't end up with borrowed funds in their possession
    //
    // if the user does not have more tokens at the end of the call than at the
    // beginning, that means they must have staked them
    let borrower_initial_base_amount = accounts.borrower_base_wallet.amount;
    let borrower_initial_quote_amount = accounts.borrower_quote_wallet.amount;
    let borrower_initial_lp_amount = accounts.borrower_lp_wallet.amount;

    let side = aldrin_amm::Side::try_from(
        &accounts.reserve,
        &accounts.base_token_vault,
        &accounts.quote_token_vault,
    )?;

    if *leverage > *accounts.reserve.config.max_leverage {
        msg!(
            "Requested leverage can be at most {}",
            *accounts.reserve.config.max_leverage
        );
        return Err(ErrorCode::InvalidAmount.into());
    }

    let mut obligation = accounts.obligation.load_mut()?;

    if obligation.deposited_value.to_dec()
        < accounts
            .lending_market
            .min_collateral_uac_value_for_leverage
            .to_dec()
    {
        return Err(ErrorCode::ObligationCollateralTooLow.into());
    }
    if accounts.borrower.key() != obligation.owner {
        return Err(ProgramError::IllegalOwner);
    }
    if obligation.is_stale_for_leverage(&accounts.clock) {
        return Err(err::obligation_stale());
    }
    if accounts.reserve.lending_market != obligation.lending_market {
        return Err(err::market_mismatch());
    }

    let remaining_borrow_value =
        obligation.remaining_collateralized_borrow_value();
    if remaining_borrow_value == Decimal::zero() {
        msg!("Remaining borrow value is zero");
        return Err(ErrorCode::BorrowTooLarge.into());
    }
    // user can borrow more than usual, given by the leverage factor
    let remaining_leveraged_borrow_value =
        remaining_borrow_value.try_mul(Decimal::from(leverage))?;

    //
    // 1.
    //
    let (borrow_amount, _) = accounts.reserve.borrow_amount_with_fees(
        liquidity_amount,
        remaining_leveraged_borrow_value,
        LoanKind::YieldFarming { leverage },
    )?;

    // marks the funds including as borrowed
    accounts.reserve.liquidity.borrow(borrow_amount)?;

    // and takes note of that in the obligation
    obligation.borrow(
        accounts.reserve.key(),
        borrow_amount,
        LoanKind::YieldFarming { leverage },
        accounts.clock.slot,
    )?;

    accounts.reserve.last_update.mark_stale();
    obligation.last_update.mark_stale();
    drop(obligation);

    let pda_seeds = &[
        &accounts.reserve.lending_market.to_bytes()[..],
        &[lending_market_bump_seed],
    ];

    token::transfer(
        accounts
            .as_borrow_liquidity_context(side)
            .with_signer(&[&pda_seeds[..]]),
        liquidity_amount,
    )?;

    //
    // 2.
    //
    if swap_amount > 0 {
        if swap_amount > liquidity_amount {
            msg!("Cannot swap more tokens than borrowed");
            return Err(ErrorCode::InvalidAmount.into());
        }

        // ~50k CU
        SwapCpi::from(&accounts).swap(
            swap_amount,
            min_swap_return,
            side.is_ask(),
        )?;
    }

    // refresh because upcoming logic depends on the latest amounts in the
    // borrower's wallet, specifically the [`CreateBasket`] instruction
    accounts.borrower_base_wallet.reload()?;
    accounts.borrower_quote_wallet.reload()?;

    //
    // 3.
    //
    // ~36k CU
    GetLpTokensCpi::from(&accounts).exchange_constituent_tokens_for_lp_tokens(
        stake_lp_amount,
        accounts.borrower_base_wallet.amount,
        accounts.borrower_quote_wallet.amount,
    )?;

    //
    // 4.
    //
    StakeCpi::from(&accounts).stake(
        &[
            &accounts.reserve.lending_market.to_bytes()[..],
            &accounts.obligation.key().to_bytes()[..],
            &accounts.reserve.key().to_bytes()[..],
            &leverage.to_le_bytes()[..],
            &[market_obligation_bump_seed],
        ],
        stake_lp_amount,
    )?;
    accounts.farming_receipt.owner = accounts.obligation.key();
    accounts.farming_receipt.leverage = leverage;
    accounts.farming_receipt.association = accounts.reserve.key();
    accounts.farming_receipt.ticket = accounts.farming_ticket.key();

    // Doesn't let the user to exit the instruction with either token ending up
    // in their possession. They must perform the calculation before calling the
    // endpoint to set the parameters right to stake all borrowed funds.
    accounts.borrower_base_wallet.reload()?;
    if borrower_initial_base_amount < accounts.borrower_base_wallet.amount {
        msg!("The user would end up with more tokens in their base wallet");
        return Err(ErrorCode::OpeningLeveragePositionMustNotLeaveTokensInUserPossession.into());
    }
    accounts.borrower_quote_wallet.reload()?;
    if borrower_initial_quote_amount < accounts.borrower_quote_wallet.amount {
        msg!("The user would end up with more tokens in their quote wallet");
        return Err(ErrorCode::OpeningLeveragePositionMustNotLeaveTokensInUserPossession.into());
    }
    accounts.borrower_lp_wallet.reload()?;
    if borrower_initial_lp_amount < accounts.borrower_lp_wallet.amount {
        msg!("The user would end up with more tokens in their lp wallet");
        return Err(ErrorCode::OpeningLeveragePositionMustNotLeaveTokensInUserPossession.into());
    }

    Ok(())
}

impl<'info> From<&&mut OpenLeveragedPositionOnAldrin<'info>>
    for StakeCpi<'info>
{
    fn from(a: &&mut OpenLeveragedPositionOnAldrin<'info>) -> Self {
        Self {
            amm_program: *a.amm_program.key,
            pool: a.pool.to_account_info(),
            farming_state: a.farming_state.to_account_info(),
            farming_ticket: a.farming_ticket.to_account_info(),
            lp_token_freeze_vault: a.lp_token_freeze_vault.to_account_info(),
            user_lp_wallet: a.borrower_lp_wallet.to_account_info(),
            user: a.borrower.to_account_info(),
            market_obligation_pda: a.market_obligation_pda.to_account_info(),
            token_program: a.token_program.to_account_info(),
            clock: a.clock.to_account_info(),
            rent: a.rent.to_account_info(),
        }
    }
}

impl<'info> From<&&mut OpenLeveragedPositionOnAldrin<'info>>
    for SwapCpi<'info>
{
    fn from(a: &&mut OpenLeveragedPositionOnAldrin<'info>) -> Self {
        Self {
            amm_program: *a.amm_program.key,
            pool: a.pool.to_account_info(),
            pool_signer: a.pool_signer.to_account_info(),
            pool_mint: a.pool_mint.to_account_info(),
            fee_pool_wallet: a.fee_pool_wallet.to_account_info(),
            base_token_vault: a.base_token_vault.to_account_info(),
            quote_token_vault: a.quote_token_vault.to_account_info(),
            user_base_wallet: a.borrower_base_wallet.to_account_info(),
            user_quote_wallet: a.borrower_quote_wallet.to_account_info(),
            user: a.borrower.to_account_info(),
            token_program: a.token_program.to_account_info(),
        }
    }
}

impl<'info> From<&&mut OpenLeveragedPositionOnAldrin<'info>>
    for GetLpTokensCpi<'info>
{
    fn from(a: &&mut OpenLeveragedPositionOnAldrin<'info>) -> Self {
        Self {
            amm_program: *a.amm_program.key,
            pool: a.pool.to_account_info(),
            pool_signer: a.pool_signer.to_account_info(),
            pool_mint: a.pool_mint.to_account_info(),
            user_lp_wallet: a.borrower_lp_wallet.to_account_info(),
            base_token_vault: a.base_token_vault.to_account_info(),
            quote_token_vault: a.quote_token_vault.to_account_info(),
            user_base_wallet: a.borrower_base_wallet.to_account_info(),
            user_quote_wallet: a.borrower_quote_wallet.to_account_info(),
            user: a.borrower.to_account_info(),
            token_program: a.token_program.to_account_info(),
            clock: a.clock.to_account_info(),
            rent: a.rent.to_account_info(),
        }
    }
}

impl<'info> OpenLeveragedPositionOnAldrin<'info> {
    fn as_borrow_liquidity_context(
        &self,
        side: aldrin_amm::Side,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: self.reserve_liquidity_wallet.clone(),
            to: if matches!(side, aldrin_amm::Side::Ask) {
                self.borrower_base_wallet.to_account_info()
            } else {
                self.borrower_quote_wallet.to_account_info()
            },
            authority: self.lending_market_pda.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}
