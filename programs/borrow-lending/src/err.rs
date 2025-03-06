use crate::prelude::*;
use std::fmt::Display;

#[error_code]
#[derive(PartialEq, Eq)]
pub enum ErrorCode {
    #[msg("Provided owner does not match the market owner")]
    InvalidMarketOwner, // 6000
    #[msg("Operation would result in an overflow")]
    MathOverflow,
    #[msg("Provided configuration isn't in the right format or range")]
    InvalidConfig,
    #[msg("Provided oracle configuration isn't in the right format or range")]
    InvalidOracleConfig,
    #[msg(
        "Cannot read oracle Pyth data because they have an unexpected format"
    )]
    InvalidOracleDataLayout,
    #[msg("Provided amount is in invalid range")]
    InvalidAmount,
    #[msg("Reserve account needs to be refreshed")]
    ReserveStale,
    #[msg("Obligation account needs to be refreshed")]
    ObligationStale,
    #[msg("A reserve accounts linked to an obligation was not provided")]
    MissingReserveAccount,
    #[msg("Interest rate cannot be negative")]
    NegativeInterestRate,
    #[msg("Provided accounts must belong to the same market")]
    LendingMarketMismatch, // 6010
    #[msg("Reserve cannot be used as a collateral")]
    ReserveCollateralDisabled,
    #[msg("Number of reserves associated with a single obligation is limited")]
    ObligationReserveLimit,
    #[msg("No collateral deposited in this obligation")]
    ObligationCollateralEmpty,
    #[msg("Not enough collateral to perform this action")]
    ObligationCollateralTooLow,
    #[msg("No liquidity borrowed in this obligation")]
    ObligationLiquidityEmpty,
    #[msg("Cannot withdraw zero collateral")]
    WithdrawTooSmall,
    #[msg("Cannot withdraw more than allowed amount of collateral")]
    WithdrawTooLarge,
    #[msg("Cannot borrow that amount of liquidity against this obligation")]
    BorrowTooLarge,
    #[msg("Not enough liquidity borrowed to cover the fees")]
    BorrowTooSmall,
    #[msg("The amount to repay cannot be zero")]
    RepayTooSmall,
    #[msg("Healthy obligation cannot be liquidated")]
    ObligationHealthy,
    #[msg(
        "To receive some collateral or repay liquidity \
        the amount of liquidity to repay must be higher"
    )]
    LiquidationTooSmall,
    #[msg("Flash loan target program cannot be BLp")]
    InvalidFlashLoanTargetProgram,
    #[msg("Flash loans feature currently not enabled")]
    FlashLoansDisabled,
    #[msg("Cannot unstake given amount of LP without restaking them")]
    FarmingTicketHasMoreLpTokensThanRequested,
    #[msg(
        "Cannot unstake given amount of LP because the amount is insufficient"
    )]
    FarmingTicketHasLessLpTokensThanRequested,
    #[msg(
        "The compounding caller mustn't keep any LP tokens, all compounded \
        tokens must be restaked. Similarly, the caller shouldn't lose any
        LP tokens."
    )]
    AllFarmedLpTokensMustBeCompounded,
    #[msg(
        "When opening a leveraged position, all borrowed tokens must be \
        deposited, meaning they cannot have more tokens than at the beginning of
        the instruction"
    )]
    OpeningLeveragePositionMustNotLeaveTokensInUserPossession,
    #[msg("Expected AMM pool account")]
    NotAmmPoolAccount,
    #[msg(
        "The total UAC worth of LP tokens to stake during compounding must be \
        at least as much as the UAC worth of farmed tokens minus fee"
    )]
    CompoundingLpPriceMustNotBeLessThanFarmPrice,
    #[msg("Utilization rate cannot go over a threshold value")]
    BorrowWouldHitCriticalUtilizationRate,
    #[msg("You must wait some minimum period before taking this action")]
    MinDelayPeriodNotPassed,
    #[msg("Invalid account combination provided")]
    InvalidAccountInput,
    #[msg("Either the position doesn't exist, or it's not available for claiming yet")]
    CannotClaimEmissionFromReserveIndex,
    #[msg("Minimum waiting time to claim emissions didn't pass")]
    MustWaitBeforeEmissionBecomeClaimable,
    #[msg("All emission already claimed")]
    EmissionEnded,
    #[msg("More snapshots have to be taken for the reserve before emissions can work")]
    NotEnoughSnapshots,
    #[msg("Illegal owner")]
    IllegalOwner,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Invalid argument")]
    InvalidArgument,
}

impl From<decimal::ErrorCode> for ErrorCode {
    fn from(_e: decimal::ErrorCode) -> Self {
        ErrorCode::MathOverflow
    }
}

pub fn illegal_owner(msg: impl AsRef<str>) -> ErrorCode {
    msg!("[IllegalOwner] {}", msg.as_ref());

    ErrorCode::IllegalOwner
}

pub fn acc(msg: impl AsRef<str>) -> ErrorCode {
    msg!("[InvalidAccountInput] {}", msg.as_ref());

    ErrorCode::InvalidAccountInput
}

pub fn aldrin_amm_program_mismatch() -> ErrorCode {
    acc("Market's AMM program ID must match provided account id")
}

pub fn reserve_stale() -> ErrorCode {
    msg!("[ReserveStale] Account needs to be refreshed");

    ErrorCode::ReserveStale
}

pub fn obligation_stale() -> ErrorCode {
    msg!("[ObligationStale] Account needs to be refreshed");

    ErrorCode::ObligationStale
}

pub fn cannot_use_as_collateral() -> ErrorCode {
    msg!(
        "[ReserveCollateralDisabled] This reserve was configured to not \
            be used as a collateral"
    );

    ErrorCode::ReserveCollateralDisabled
}

pub fn market_mismatch() -> ErrorCode {
    msg!(
        "[LendingMarketMismatch] All accounts must belong to the same \
            lending market"
    );

    ErrorCode::LendingMarketMismatch
}

pub fn obligation_healthy() -> ErrorCode {
    msg!(
        "[ObligationHealthy] Obligation's unhealthy borrow value is zero \
        hence there's nothing to be liquidated"
    );

    ErrorCode::ObligationHealthy
}

pub fn empty_liquidity(msg: impl AsRef<str>) -> ErrorCode {
    msg!("[ObligationLiquidityEmpty] {}", msg.as_ref());

    ErrorCode::ObligationLiquidityEmpty
}

pub fn empty_collateral(msg: impl AsRef<str>) -> ErrorCode {
    msg!("[ObligationCollateralEmpty] {}", msg.as_ref());

    ErrorCode::ObligationCollateralEmpty
}

pub fn insufficient_funds(
    required: impl Display,
    got: impl Display,
) -> ErrorCode {
    msg!("[InsufficientFunds] Required {} but got {}", required, got);

    ErrorCode::InsufficientFunds
}

pub fn oracle(msg: impl AsRef<str>) -> ErrorCode {
    msg!("[InvalidOracleConfig] {}", msg.as_ref());

    ErrorCode::InvalidOracleConfig
}

pub fn flash_loans_disabled() -> ErrorCode {
    msg!(
        "[FlashLoansDisabled] You cannot use flash loans as \
        this feature is currently not enabled"
    );

    ErrorCode::FlashLoansDisabled
}
