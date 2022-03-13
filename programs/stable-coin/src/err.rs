use crate::prelude::*;
use borrow_lending::err::{
    Error as BorrowLendingError, ErrorCode as BorrowLendingErrorCode,
};

#[error]
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
}

impl PartialEq for Error {
    fn eq(&self, other: &Self) -> bool {
        self == other
    }
}

impl From<decimal::Error> for Error {
    fn from(_e: decimal::Error) -> Self {
        ErrorCode::MathOverflow.into()
    }
}

impl From<BorrowLendingError> for Error {
    fn from(e: BorrowLendingError) -> Self {
        match e {
            BorrowLendingError::ProgramError(program_err) => {
                Self::ProgramError(program_err)
            }
            BorrowLendingError::ErrorCode(err_code) => match err_code {
                BorrowLendingErrorCode::MathOverflow => {
                    ErrorCode::MathOverflow.into()
                }
                other => Self::ProgramError(other.into()),
            },
        }
    }
}

pub fn admin_mismatch() -> ProgramError {
    msg!("[IllegalOwner] Stable coin's admin mismatches signer");

    ProgramError::IllegalOwner
}

pub fn stable_coin_mismatch() -> ProgramError {
    acc("[InvalidAccountInput] Stable coin's key doesn't match expected one")
}

pub fn stable_coin_mint_mismatch() -> ProgramError {
    acc("[InvalidAccountInput] Stable coin's mint doesn't match expected one")
}

pub fn acc(msg: impl AsRef<str>) -> ProgramError {
    msg!("[InvalidAccountInput] {}", msg.as_ref());

    ErrorCode::InvalidAccountInput.into()
}

pub fn reserve_mismatch() -> ProgramError {
    acc("Reserve account does not match component's config")
}
