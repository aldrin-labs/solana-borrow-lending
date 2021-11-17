mod decimal;
mod sdecimal;

use crate::prelude::*;
pub use decimal::*;
pub use sdecimal::*;

/// Try to subtract, return an error on underflow
pub trait TrySub: Sized {
    /// Subtract
    fn try_sub(self, rhs: Self) -> Result<Self>;
}

/// Try to subtract, return an error on overflow
pub trait TryAdd: Sized {
    /// Add
    fn try_add(self, rhs: Self) -> Result<Self>;
}

/// Try to divide, return an error on overflow or divide by zero
pub trait TryDiv<RHS>: Sized {
    /// Divide
    fn try_div(self, rhs: RHS) -> Result<Self>;
}

/// Try to multiply, return an error on overflow
pub trait TryMul<RHS>: Sized {
    /// Multiply
    fn try_mul(self, rhs: RHS) -> Result<Self>;
}

/// Number in range [0; 100]
#[derive(
    AnchorSerialize,
    AnchorDeserialize,
    Default,
    Debug,
    Shrinkwrap,
    Copy,
    Clone,
    PartialEq,
    Eq,
)]
pub struct PercentageInt {
    percent: u8,
}

impl From<PercentageInt> for Decimal {
    fn from(p: PercentageInt) -> Self {
        Self::from_percent(p.percent)
    }
}

impl From<PercentageInt> for u8 {
    fn from(p: PercentageInt) -> Self {
        p.percent
    }
}

impl From<u8> for PercentageInt {
    fn from(p: u8) -> Self {
        Self { percent: p }
    }
}

/// Amount of liquidity that is settled from the obligation and amount of tokens
/// to transfer to the reserve's liquidity wallet from borrower's source wallet.
pub fn calculate_repay_amounts(
    liquidity_amount: u64,
    borrowed_amount: Decimal,
) -> Result<(u64, Decimal)> {
    let settle_amount = Decimal::from(liquidity_amount).min(borrowed_amount);
    let repay_amount = settle_amount.try_ceil_u64()?;

    Ok((repay_amount, settle_amount))
}
