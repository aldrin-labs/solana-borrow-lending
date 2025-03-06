pub mod aldrin_amm;
pub mod emissions;
pub mod farming_receipt;
pub mod last_update;
pub mod lending_market;
pub mod obligation;
pub mod oracle;
pub mod pyth;
pub mod reserve;

use crate::prelude::*;
pub use emissions::*;
pub use farming_receipt::*;
pub use last_update::*;
pub use lending_market::*;
pub use obligation::*;
pub use oracle::*;
pub use reserve::*;

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

impl Default for UniversalAssetCurrency {
    fn default() -> Self {
        Self::Usd
    }
}
