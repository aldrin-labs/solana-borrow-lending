mod common;
mod decimal;
mod rate;
mod sdecimal;

use crate::prelude::*;
pub use common::*;
pub use decimal::*;
pub use rate::*;
pub use sdecimal::*;

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

impl From<PercentageInt> for Rate {
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
    repay_amount: u64,
    borrowed_amount: Decimal,
) -> Result<(u64, Decimal)> {
    let settle_amount = Decimal::from(repay_amount).min(borrowed_amount);
    let repay_amount = settle_amount.try_ceil_u64()?;

    Ok((repay_amount, settle_amount))
}
