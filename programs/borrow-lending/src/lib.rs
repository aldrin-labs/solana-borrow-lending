// We use zero copy for obligation. Zero copy uses
// [repr(packed)](https://doc.rust-lang.org/nomicon/other-reprs.html). In future
// releases, taking a reference to a field which is packed will not compile.
// We will need to, eventually, copy out fields we want to use, or create
// pointers [manually](https://github.com/rust-lang/rust/issues/82523).
#![allow(unaligned_references, renamed_and_removed_lints, safe_packed_borrows)]

#[cfg(test)]
#[macro_use]
extern crate memoffset;

#[macro_use]
extern crate shrinkwraprs;

pub mod endpoints;
pub mod err;
pub mod math;
pub mod models;
pub mod prelude;

use endpoints::*;
use prelude::*;

// TODO: pull this from ENV
declare_id!("HH6BiQtvsL6mh7En2knBeTDqmGjYCJFiXiqixrG8nndB");

#[program]
pub mod borrow_lending {
    use super::*;

    pub fn init_lending_market(
        ctx: Context<InitLendingMarket>,
        currency: UniversalAssetCurrency,
        leveraged_compound_fee: PercentageInt,
        vault_compound_fee: PercentageInt,
        min_collateral_uac_value_for_leverage: SDecimal,
    ) -> ProgramResult {
        endpoints::init_lending_market::handle(
            ctx,
            currency,
            leveraged_compound_fee,
            vault_compound_fee,
            min_collateral_uac_value_for_leverage,
        )
    }

    pub fn update_lending_market(
        ctx: Context<UpdateLendingMarket>,
        leveraged_compound_fee: PercentageInt,
        vault_compound_fee: PercentageInt,
        min_collateral_uac_value_for_leverage: SDecimal,
    ) -> ProgramResult {
        endpoints::update_lending_market::handle(
            ctx,
            leveraged_compound_fee,
            vault_compound_fee,
            min_collateral_uac_value_for_leverage,
        )
    }

    pub fn set_lending_market_owner(
        ctx: Context<SetLendingMarketOwner>,
    ) -> ProgramResult {
        endpoints::set_lending_market_owner::handle(ctx)
    }

    pub fn init_reserve(
        ctx: Context<InitReserve>,
        lending_market_bump_seed: u8,
        liquidity_amount: u64,
        config: InputReserveConfig,
    ) -> ProgramResult {
        endpoints::init_reserve::handle(
            ctx,
            lending_market_bump_seed,
            liquidity_amount,
            config,
        )
    }

    pub fn update_reserve_config(
        ctx: Context<UpdateReserveConfig>,
        config: InputReserveConfig,
    ) -> ProgramResult {
        endpoints::update_reserve_config::handle(ctx, config)
    }

    pub fn refresh_reserve(ctx: Context<RefreshReserve>) -> ProgramResult {
        endpoints::refresh_reserve::handle(ctx)
    }

    pub fn deposit_reserve_liquidity(
        ctx: Context<DepositReserveLiquidity>,
        lending_market_bump_seed: u8,
        liquidity_amount: u64,
    ) -> ProgramResult {
        endpoints::deposit_reserve_liquidity::handle(
            ctx,
            lending_market_bump_seed,
            liquidity_amount,
        )
    }

    pub fn redeem_reserve_collateral(
        ctx: Context<RedeemReserveCollateral>,
        lending_market_bump_seed: u8,
        collateral_amount: u64,
    ) -> ProgramResult {
        endpoints::redeem_reserve_collateral::handle(
            ctx,
            lending_market_bump_seed,
            collateral_amount,
        )
    }

    /// Creates a new obligation with up to 10 possible different reserves from
    /// which to borrow or to which to deposit.
    pub fn init_obligation_r10(ctx: Context<InitObligation>) -> ProgramResult {
        endpoints::init_obligation::handle(ctx)
    }

    pub fn refresh_obligation(
        ctx: Context<RefreshObligation>,
    ) -> ProgramResult {
        endpoints::refresh_obligation::handle(ctx)
    }

    pub fn deposit_obligation_collateral(
        ctx: Context<DepositObligationCollateral>,
        collateral_amount: u64,
    ) -> ProgramResult {
        endpoints::deposit_obligation_collateral::handle(ctx, collateral_amount)
    }

    /// As long as borrower's obligation stays healthy they withdraw given
    /// amount of collateral from a specific reserve.
    pub fn withdraw_obligation_collateral(
        ctx: Context<WithdrawObligationCollateral>,
        lending_market_bump_seed: u8,
        collateral_amount: u64,
    ) -> ProgramResult {
        endpoints::withdraw_obligation_collateral::handle(
            ctx,
            lending_market_bump_seed,
            collateral_amount,
        )
    }

    /// Borrower makes a loan of a specific reserve liquidity against all
    /// collateral they deposited.
    pub fn borrow_obligation_liquidity<'info>(
        ctx: Context<'_, '_, '_, 'info, BorrowObligationLiquidity<'info>>,
        lending_market_bump_seed: u8,
        liquidity_amount: u64,
    ) -> ProgramResult {
        endpoints::borrow_obligation_liquidity::handle(
            ctx,
            lending_market_bump_seed,
            liquidity_amount,
        )
    }

    /// Borrowed repays part or all of their loan of a specific reserve.
    pub fn repay_obligation_liquidity(
        ctx: Context<RepayObligationLiquidity>,
        liquidity_amount: u64,
        loan_kind: LoanKind,
    ) -> ProgramResult {
        endpoints::repay_obligation_liquidity::handle(
            ctx,
            liquidity_amount,
            loan_kind,
        )
    }

    /// Any user can repay part of loan of a specific reserve for advantageous
    /// market value and receive collateral in lieu.
    pub fn liquidate_obligation(
        ctx: Context<LiquidateObligation>,
        lending_market_bump_seed: u8,
        liquidity_amount: u64,
        loan_kind: LoanKind,
    ) -> ProgramResult {
        endpoints::liquidate_obligation::handle(
            ctx,
            lending_market_bump_seed,
            liquidity_amount,
            loan_kind,
        )
    }

    /// Flash loan feature as designed by the solana team. Any user can borrow
    /// any amount of liquidity as long as at the end of the instruction
    /// all liquidity is repaid and fees are paid too. This endpoint is for SDK
    /// only, it won't show in the UI.
    pub fn flash_loan(
        ctx: Context<FlashLoan>,
        lending_market_bump_seed: u8,
        liquidity_amount: u64,
        target_data_prefix: Vec<u8>,
    ) -> ProgramResult {
        endpoints::flash_loan::handle(
            ctx,
            lending_market_bump_seed,
            liquidity_amount,
            target_data_prefix,
        )
    }

    /// Used by the market owner to conditionally turn off/on flash loans.
    pub fn toggle_flash_loans(ctx: Context<ToggleFlashLoans>) -> ProgramResult {
        endpoints::toggle_flash_loans::handle(ctx)
    }

    /// Communicates with Aldrin's AMM contract to start leverage yield farming.
    ///
    /// We stake `stake_lp_amount` of LP tokens in a farming ticket.
    ///
    /// We borrow `liquidity_amount` from the reserve's supply, and the
    /// liquidity amount can be higher than collateralized max borrow
    /// value by the leverage factor.
    ///
    /// Optionally, we swap `swap_amount` of the liquidity token (mint of
    /// `reserve.liquidity.mint`) and provided slippage `min_swap_return`
    /// dictates how many tokens at least to expect for the `swap_amount` in
    /// the other constituent token mint.
    ///
    /// Whether the base or quote token mint is the borrowed liquidity token
    /// is given by which one matches the above mentioned
    /// `reserve.liquidity.mint`.
    #[allow(clippy::too_many_arguments)]
    pub fn open_leveraged_position_on_aldrin(
        ctx: Context<OpenLeveragedPositionOnAldrin>,
        lending_market_bump_seed: u8,
        market_obligation_bump_seed: u8,
        stake_lp_amount: u64,
        liquidity_amount: u64,
        swap_amount: u64,
        min_swap_return: u64,
        leverage: Leverage,
    ) -> ProgramResult {
        endpoints::amm::aldrin::open_leveraged_position_on_aldrin::handle(
            ctx,
            lending_market_bump_seed,
            market_obligation_bump_seed,
            stake_lp_amount,
            liquidity_amount,
            swap_amount,
            min_swap_return,
            leverage,
        )
    }

    pub fn close_leveraged_position_on_aldrin(
        ctx: Context<CloseLeveragedPositionOnAldrin>,
        market_obligation_bump_seed: u8,
        leverage: Leverage,
    ) -> ProgramResult {
        endpoints::amm::aldrin::close_leveraged_position_on_aldrin::handle(
            ctx,
            market_obligation_bump_seed,
            leverage,
        )
    }

    /// Used for both leverage yield farming and vaults. Can only be called by
    /// the aldrin's admin bot. However, should we want to remove this
    /// constraint in future, the endpoint is designed to be safe similarly to
    /// liquidation.
    pub fn compound_position_on_aldrin(
        ctx: Context<CompoundPositionOnAldrin>,
        stake_lp_amount: u64,
        seeds: Vec<Vec<u8>>,
    ) -> ProgramResult {
        endpoints::amm::aldrin::compound_position_on_aldrin::handle(
            ctx,
            stake_lp_amount,
            seeds,
        )
    }

    /// Admin bot only endpoint which records the borrowed and available funds
    /// at present time for a reserve.
    pub fn take_reserve_cap_snapshot(
        ctx: Context<TakeReserveCapSnapshot>,
    ) -> ProgramResult {
        endpoints::emit::take_reserve_cap_snapshot::handle(ctx)
    }

    /// Closes emission account and transfers wallets with emitted tokens which
    /// were not collected back to the market owner.
    pub fn close_emission<'info>(
        ctx: Context<'_, '_, '_, 'info, CloseEmission<'info>>,
        lending_market_bump_seed: u8,
    ) -> ProgramResult {
        endpoints::emit::close_emission::handle(ctx, lending_market_bump_seed)
    }

    /// Creates new account with up to [`consts::EMISSION_TOKENS_COUNT`]
    /// different emission tokens. The wallet for each token must be
    /// provided in as remaining account in the same order as given in the input
    /// vector.
    pub fn create_emission<'info>(
        ctx: Context<'_, '_, '_, 'info, CreateEmission<'info>>,
        lending_market_bump_seed: u8,
        starts_at_slot: u64,
        ends_at_slot: u64,
        min_slots_elapsed_before_claim: u64,
        tokens: Vec<EmittedToken>,
    ) -> ProgramResult {
        endpoints::emit::create_emission::handle(
            ctx,
            lending_market_bump_seed,
            starts_at_slot,
            ends_at_slot,
            min_slots_elapsed_before_claim,
            tokens,
        )
    }

    /// Intended for users to claim emissions from their open positions, be it
    /// borrows or deposits.
    pub fn claim_emission<'info>(
        ctx: Context<'_, '_, '_, 'info, ClaimEmission<'info>>,
        lending_market_bump_seed: u8,
        reserve_index: u8,
    ) -> ProgramResult {
        endpoints::emit::claim_emission::handle(
            ctx,
            lending_market_bump_seed,
            reserve_index,
        )
    }

    /// Stakes LP tokens on behalf of the user, the benefit to the user being
    /// auto compounding our bot does.
    ///
    /// The user pubkey is in the PDA of the ticket authority.
    pub fn open_vault_position_on_aldrin(
        ctx: Context<OpenVaultPositionOnAldrin>,
        bump_seed: u8,
        stake_lp_amount: u64,
    ) -> ProgramResult {
        endpoints::amm::aldrin::open_vault_position_on_aldrin::handle(
            ctx,
            bump_seed,
            stake_lp_amount,
        )
    }

    /// Closes given vault position by unstaking the LP tokens and returning
    /// them to the user's wallet. The user must be a signer and their pubkey is
    /// in the PDA seed of the ticket owner.
    pub fn close_vault_position_on_aldrin(
        ctx: Context<CloseVaultPositionOnAldrin>,
        bump_seed: u8,
    ) -> ProgramResult {
        endpoints::amm::aldrin::close_vault_position_on_aldrin::handle(
            ctx, bump_seed,
        )
    }
}
