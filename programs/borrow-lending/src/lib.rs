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

    /// Initializes a new lending market with global configuration.
    /// 
    /// A lending market serves as the root account that manages all reserves
    /// and global settings like fees and oracle configuration.
    /// 
    /// # Arguments
    /// * `currency` - Universal asset currency (e.g., USD) for price calculations
    /// * `leveraged_compound_fee` - Fee percentage for leveraged compound operations
    /// * `vault_compound_fee` - Fee percentage for vault compound operations
    /// * `min_collateral_uac_value_for_leverage` - Minimum collateral value required for leverage
    /// 
    /// # Example
    /// ```ignore
    /// let currency = UniversalAssetCurrency::Usd;
    /// let leveraged_fee = PercentageInt::from_percent(0.5); // 0.5%
    /// let vault_fee = PercentageInt::from_percent(0.5);     // 0.5%
    /// let min_collateral = SDecimal::from(1000);            // $1000 minimum
    /// 
    /// program.init_lending_market(ctx, currency, leveraged_fee, vault_fee, min_collateral)?;
    /// ```
    pub fn init_lending_market(
        ctx: Context<InitLendingMarket>,
        currency: UniversalAssetCurrency,
        leveraged_compound_fee: PercentageInt,
        vault_compound_fee: PercentageInt,
        min_collateral_uac_value_for_leverage: SDecimal,
    ) -> Result<()> {
        endpoints::init_lending_market::handle(
            ctx,
            currency,
            leveraged_compound_fee,
            vault_compound_fee,
            min_collateral_uac_value_for_leverage,
        )
    }

    /// Updates the configuration of an existing lending market.
    /// 
    /// Only the market owner can update these settings. This allows for
    /// dynamic adjustment of fees and leverage requirements.
    /// 
    /// # Arguments
    /// * `leveraged_compound_fee` - Updated fee percentage for leveraged operations
    /// * `vault_compound_fee` - Updated fee percentage for vault operations  
    /// * `min_collateral_uac_value_for_leverage` - Updated minimum collateral requirement
    pub fn update_lending_market(
        ctx: Context<UpdateLendingMarket>,
        leveraged_compound_fee: PercentageInt,
        vault_compound_fee: PercentageInt,
        min_collateral_uac_value_for_leverage: SDecimal,
    ) -> Result<()> {
        endpoints::update_lending_market::handle(
            ctx,
            leveraged_compound_fee,
            vault_compound_fee,
            min_collateral_uac_value_for_leverage,
        )
    }

    /// Transfers ownership of a lending market to a new owner.
    /// 
    /// This is a security-critical operation that permanently changes
    /// who has control over the market configuration.
    pub fn set_lending_market_owner(
        ctx: Context<SetLendingMarketOwner>,
    ) -> Result<()> {
        endpoints::set_lending_market_owner::handle(ctx)
    }

    /// Initializes a new reserve for a specific token in the lending market.
    /// 
    /// A reserve represents a token pool that users can deposit into for lending
    /// or borrow from using collateral. Each reserve has its own configuration
    /// including interest rates, loan-to-value ratios, and liquidation parameters.
    /// 
    /// # Arguments
    /// * `lending_market_bump_seed` - Bump seed for the lending market PDA
    /// * `liquidity_amount` - Initial amount of liquidity to deposit
    /// * `config` - Reserve configuration including rates and ratios
    /// 
    /// # Reserve Configuration
    /// The config parameter includes:
    /// - `optimal_utilization_rate`: Target utilization for optimal rates (0-100)
    /// - `loan_to_value_ratio`: Max borrow ratio against collateral (0-100)
    /// - `liquidation_threshold`: Unhealthy borrow threshold (0-100)
    /// - `liquidation_bonus`: Bonus for liquidators (0-100)
    /// - Interest rate parameters (min/optimal/max borrow rates)
    /// - Fee structure (borrow fees, flash loan fees, host fees)
    pub fn init_reserve(
        ctx: Context<InitReserve>,
        lending_market_bump_seed: u8,
        liquidity_amount: u64,
        config: InputReserveConfig,
    ) -> Result<()> {
        endpoints::init_reserve::handle(
            ctx,
            lending_market_bump_seed,
            liquidity_amount,
            config,
        )
    }

    /// A reserve which stores LP tokens from Aldrin's AMM and thereby allows
    /// the user to use them as collateral. This only works for non stable pools
    /// in which the amount of tokens in both vaults is of equal value.
    pub fn init_reserve_aldrin_unstable_lp_token(
        ctx: Context<InitReserveAldrinUnstableLpToken>,
        lending_market_bump_seed: u8,
        liquidity_amount: u64,
        config: InputReserveConfig,
        is_oracle_for_base_vault: bool,
    ) -> Result<()> {
        endpoints::amm::aldrin::init_reserve_aldrin_unstable_lp_token::handle(
            ctx,
            lending_market_bump_seed,
            liquidity_amount,
            config,
            is_oracle_for_base_vault,
        )
    }

    /// Updates the configuration parameters of an existing reserve.
    /// 
    /// Allows the market owner to modify reserve settings such as interest rates,
    /// loan-to-value ratios, and fee structures. Changes take effect immediately.
    /// 
    /// # Arguments
    /// * `config` - New reserve configuration to apply
    pub fn update_reserve_config(
        ctx: Context<UpdateReserveConfig>,
        config: InputReserveConfig,
    ) -> Result<()> {
        endpoints::update_reserve_config::handle(ctx, config)
    }

    /// Updates a reserve's state with current market conditions and interest accrual.
    /// 
    /// This instruction must be called periodically to ensure accurate interest
    /// calculations and current market prices from oracles. Many other instructions
    /// require reserves to be "fresh" (recently refreshed).
    /// 
    /// # Oracle Integration
    /// This instruction reads from Pyth price oracles to update the reserve's
    /// market price, which affects collateral valuations and health calculations.
    pub fn refresh_reserve(ctx: Context<RefreshReserve>) -> Result<()> {
        endpoints::refresh_reserve::handle(ctx)
    }

    /// Refreshes a reserve that holds Aldrin AMM LP tokens.
    /// 
    /// Similar to `refresh_reserve` but includes special logic for calculating
    /// the value of LP tokens based on the underlying pool assets.
    pub fn refresh_reserve_aldrin_unstable_lp_token(
        ctx: Context<RefreshReserveAldrinUnstableLpToken>,
    ) -> Result<()> {
        endpoints::refresh_reserve_aldrin_unstable_lp_token::handle(ctx)
    }

    /// Deposits liquidity tokens into a reserve in exchange for collateral tokens.
    /// 
    /// This is the primary lending operation. Users deposit tokens to earn interest,
    /// receiving collateral tokens that represent their share of the reserve.
    /// The exchange rate between liquidity and collateral improves over time as
    /// borrowers pay interest.
    /// 
    /// # Arguments
    /// * `lending_market_bump_seed` - Bump seed for the lending market PDA
    /// * `liquidity_amount` - Amount of liquidity tokens to deposit
    /// 
    /// # Process
    /// 1. Transfer liquidity tokens from user to reserve
    /// 2. Calculate collateral tokens to mint based on current exchange rate
    /// 3. Mint collateral tokens to user's wallet
    /// 4. Update reserve state with new liquidity and collateral amounts
    /// 
    /// # Exchange Rate
    /// The exchange rate starts at 1:5 (1 liquidity = 5 collateral) and improves
    /// as interest accumulates in the reserve's liquidity supply.
    pub fn deposit_reserve_liquidity(
        ctx: Context<DepositReserveLiquidity>,
        lending_market_bump_seed: u8,
        liquidity_amount: u64,
    ) -> Result<()> {
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
    ) -> Result<()> {
        endpoints::redeem_reserve_collateral::handle(
            ctx,
            lending_market_bump_seed,
            collateral_amount,
        )
    }

    /// Creates a new obligation with up to 10 possible different reserves from
    /// which to borrow or to which to deposit.
    pub fn init_obligation_r10(ctx: Context<InitObligation>) -> Result<()> {
        endpoints::init_obligation::handle(ctx)
    }

    pub fn refresh_obligation(ctx: Context<RefreshObligation>) -> Result<()> {
        endpoints::refresh_obligation::handle(ctx)
    }

    pub fn deposit_obligation_collateral(
        ctx: Context<DepositObligationCollateral>,
        collateral_amount: u64,
    ) -> Result<()> {
        endpoints::deposit_obligation_collateral::handle(ctx, collateral_amount)
    }

    /// As long as borrower's obligation stays healthy they withdraw given
    /// amount of collateral from a specific reserve.
    pub fn withdraw_obligation_collateral(
        ctx: Context<WithdrawObligationCollateral>,
        lending_market_bump_seed: u8,
        collateral_amount: u64,
    ) -> Result<()> {
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
    ) -> Result<()> {
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
    ) -> Result<()> {
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
    ) -> Result<()> {
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
    ) -> Result<()> {
        endpoints::flash_loan::handle(
            ctx,
            lending_market_bump_seed,
            liquidity_amount,
            target_data_prefix,
        )
    }

    /// Used by the market owner to conditionally turn off/on flash loans.
    pub fn toggle_flash_loans(ctx: Context<ToggleFlashLoans>) -> Result<()> {
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
    ) -> Result<()> {
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
    ) -> Result<()> {
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
    ) -> Result<()> {
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
    ) -> Result<()> {
        endpoints::emit::take_reserve_cap_snapshot::handle(ctx)
    }

    /// Closes emission account and transfers wallets with emitted tokens which
    /// were not collected back to the market owner.
    pub fn close_emission<'info>(
        ctx: Context<'_, '_, '_, 'info, CloseEmission<'info>>,
        lending_market_bump_seed: u8,
    ) -> Result<()> {
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
    ) -> Result<()> {
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
    ) -> Result<()> {
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
    ) -> Result<()> {
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
    ) -> Result<()> {
        endpoints::amm::aldrin::close_vault_position_on_aldrin::handle(
            ctx, bump_seed,
        )
    }
}
