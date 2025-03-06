use crate::prelude::*;
use borrow_lending::err::ErrorCode as BorrowLendingErrorCode;

#[error_code]
#[derive(PartialEq, Eq)]
pub enum ErrorCode {
    #[msg("Operation would result in an overflow")]
    MathOverflow,
    #[msg("Provided configuration isn't in the right format or range")]
    InvalidConfig,
    #[msg("Invalid account combination provided")]
    InvalidAccountInput,
    #[msg("Provided amount is in invalid range")]
    InvalidAmount,
    #[msg("Cannot withdraw more than allowed amount of collateral")]
    WithdrawTooLarge,
    #[msg("Cannot borrow that amount of liquidity against this obligation")]
    BorrowTooLarge,
    #[msg(
        "The admin must increase mint allowance for this type of collateral"
    )]
    MintAllowanceTooSmall,
    #[msg("Component's mint doesn't match reserve's liquidity nor collateral")]
    ComponentReserveMismatch,
    #[msg("Receipt is not beyond max collateral ration threshold")]
    CannotLiquidateHealthyReceipt,
    #[msg("Provided wanted collateral cannot be more than configured max")]
    CannotGoOverMaxCollateralRatio,
    #[msg("Check the logs for borrow lending related error")]
    BorrowLendingRethrow,
}

impl From<decimal::ErrorCode> for ErrorCode {
    fn from(_e: decimal::ErrorCode) -> Self {
        ErrorCode::MathOverflow
    }
}

impl From<BorrowLendingErrorCode> for ErrorCode {
    fn from(e: BorrowLendingErrorCode) -> Self {
        match e {
            BorrowLendingErrorCode::MathOverflow => Self::MathOverflow,
            other => {
                msg!("[BorrowLending] {}", other);
                Self::BorrowLendingRethrow
            }
        }
    }
}

pub fn acc(msg: impl AsRef<str>) -> ErrorCode {
    msg!("[InvalidAccountInput] {}", msg.as_ref());

    ErrorCode::InvalidAccountInput
}

pub fn admin_mismatch() -> ErrorCode {
    acc("[IllegalOwner] Stable coin's admin mismatches signer")
}

pub fn stable_coin_mismatch() -> ErrorCode {
    acc("[InvalidAccountInput] Stable coin's key doesn't match expected one")
}

pub fn stable_coin_mint_mismatch() -> ErrorCode {
    acc("[InvalidAccountInput] Stable coin's mint doesn't match expected one")
}

pub fn reserve_mismatch() -> ErrorCode {
    acc("Reserve account does not match component's config")
}

pub fn freeze_wallet_mismatch() -> ErrorCode {
    acc("Freeze wallet doesn't match component's configuration")
}

pub fn aldrin_amm_program_mismatch() -> ErrorCode {
    acc("Market's AMM program ID must match provided account id")
}
