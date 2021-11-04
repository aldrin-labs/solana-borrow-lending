mod last_update;
mod lending_market;
pub mod pyth;
mod reserve;

use crate::prelude::*;
pub use last_update::*;
pub use lending_market::*;
pub use reserve::*;

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

#[derive(
    AnchorSerialize,
    AnchorDeserialize,
    Default,
    Debug,
    Copy,
    Clone,
    PartialEq,
    Eq,
)]
pub struct Wads {
    wad: [u64; 3],
}

impl From<Wads> for Decimal {
    fn from(wads: Wads) -> Self {
        Self(U192(wads.wad))
    }
}

impl From<Decimal> for Wads {
    fn from(dec: Decimal) -> Self {
        Self { wad: dec.0 .0 }
    }
}

impl Wads {
    pub fn to_dec(self) -> Decimal {
        self.into()
    }
}

pub trait Validate {
    fn validate(&self) -> Result<()>;
}

pub struct Unvalidated<T>(T);

impl<T: Validate> Unvalidated<T> {
    pub fn validate(self) -> Result<T> {
        let Self(inner) = self;
        inner.validate()?;
        Ok(inner)
    }
}

impl<T> Unvalidated<T> {
    pub fn new(inner: T) -> Self {
        Self(inner)
    }
}

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Debug, Copy, PartialEq, Eq,
)]
pub enum UniversalAssetCurrency {
    Usd,
    Pubkey { address: Pubkey },
}

impl UniversalAssetCurrency {
    const USD_RAW: [u8; 32] =
        *b"USD\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0";
}
