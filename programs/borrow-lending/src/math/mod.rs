mod common;
mod decimal;
mod rate;
mod wad;

use crate::prelude::*;
pub use common::*;
pub use decimal::*;
pub use rate::*;
pub use wad::*;

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
