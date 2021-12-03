use crate::prelude::*;
use std::fmt::Display;

#[error]
#[derive(PartialEq, Eq)]
pub enum ErrorCode {
    #[msg("Provided owner does not match the market owner")]
    InvalidMarketOwner, // 300
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
    LendingMarketMismatch, // 310
    #[msg("Reserve cannot be used as a collateral")]
    ReserveCollateralDisabled,
    #[msg("Number of reserves associated with a single obligation is limited")]
    ObligationReserveLimit,
    #[msg("No collateral deposited in this obligation")]
    ObligationCollateralEmpty,
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
}

impl PartialEq for Error {
    fn eq(&self, other: &Self) -> bool {
        self == other
    }
}

pub fn acc(msg: impl AsRef<str>) -> ProgramError {
    msg!("[InvalidAccountInput] {}", msg.as_ref());

    ProgramError::InvalidAccountData
}

pub fn reserve_stale() -> ProgramError {
    msg!("[ReserveStale] Account needs to be refreshed");

    ErrorCode::ReserveStale.into()
}

pub fn obligation_stale() -> ProgramError {
    msg!("[ObligationStale] Account needs to be refreshed");

    ErrorCode::ObligationStale.into()
}

pub fn cannot_use_as_collateral() -> ProgramError {
    msg!(
        "[ReserveCollateralDisabled] This reserve was configured to not \
            be used as a collateral"
    );

    ErrorCode::ReserveCollateralDisabled.into()
}

pub fn market_mismatch() -> ProgramError {
    msg!(
        "[LendingMarketMismatch] All accounts must belong to the same \
            lending market"
    );

    ErrorCode::LendingMarketMismatch.into()
}

pub fn obligation_healthy() -> ProgramError {
    msg!(
        "[ObligationHealthy] Obligation's unhealthy borrow value is zero \
        hence there's nothing to be liquidated"
    );

    ErrorCode::ObligationHealthy.into()
}

pub fn empty_liquidity(msg: impl AsRef<str>) -> ProgramError {
    msg!("[ObligationLiquidityEmpty] {}", msg.as_ref());

    ErrorCode::ObligationLiquidityEmpty.into()
}

pub fn empty_collateral(msg: impl AsRef<str>) -> ProgramError {
    msg!("[ObligationCollateralEmpty] {}", msg.as_ref());

    ErrorCode::ObligationCollateralEmpty.into()
}

pub fn insufficient_funds(
    required: impl Display,
    got: impl Display,
) -> ProgramError {
    msg!("[InsufficientFunds] Required {} but got {}", required, got);

    ProgramError::InsufficientFunds
}

pub fn oracle(msg: impl AsRef<str>) -> ProgramError {
    msg!("[InvalidOracleConfig] {}", msg.as_ref());

    ErrorCode::InvalidOracleConfig.into()
}

#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::solana_program::program_error::ProgramError;

    #[test]
    fn test_error_conversion() {
        assert_eq!(
            ProgramError::Custom(300),
            ErrorCode::InvalidMarketOwner.into()
        );
    }
}
