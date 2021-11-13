use crate::prelude::*;

#[error]
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
    LendingMarketMismatch,
    #[msg("Reserve cannot be used as a collateral")]
    ReserveCollateralDisabled,
    #[msg("Number of reserves associated with a single obligation is limited")]
    ObligationReserveLimit,
    #[msg("No collateral deposited in obligation")]
    ObligationCollateralEmpty,
    #[msg("No deposited value in collateral")]
    ObligationDepositsZero,
    #[msg("Cannot withdraw more than allowed amount of collateral")]
    WithdrawTooLarge,
    #[msg("Cannot borrow that amount of liquidity against this obligation")]
    BorrowTooLarge,
    #[msg("Not enough liquidity borrowed to cover the fees")]
    BorrowTooSmall,
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
