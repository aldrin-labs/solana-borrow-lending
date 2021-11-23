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

impl PercentageInt {
    pub const fn new(percent: u8) -> Self {
        Self { percent }
    }
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
