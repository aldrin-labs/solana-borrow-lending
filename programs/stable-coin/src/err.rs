use crate::prelude::*;

#[error]
#[derive(PartialEq, Eq)]
pub enum ErrorCode {
    #[msg("Operation would result in an overflow")]
    MathOverflow,
    #[msg("Provided configuration isn't in the right format or range")]
    InvalidConfig,
    #[msg("Invalid account combination provided")]
    InvalidAccountInput,
}

pub fn admin_mismatch() -> ProgramError {
    msg!("[IllegalOwner] Stable coin's admin mismatches signer");

    ProgramError::IllegalOwner
}

pub fn stable_coin_mismatch() -> ProgramError {
    msg!("[InvalidAccountInput] Stable coin's key doesn't match expected one");

    ErrorCode::InvalidAccountInput.into()
}

pub fn acc(msg: impl AsRef<str>) -> ProgramError {
    msg!("[InvalidAccountInput] {}", msg.as_ref());

    ErrorCode::InvalidAccountInput.into()
}
