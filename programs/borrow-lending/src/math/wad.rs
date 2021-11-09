use crate::prelude::*;
use std::convert::TryFrom;

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

impl TryFrom<Wads> for Rate {
    type Error = Error;

    fn try_from(wads: Wads) -> Result<Self> {
        Self::try_from(Decimal::from(wads))
    }
}

impl From<Rate> for Wads {
    fn from(rate: Rate) -> Self {
        Decimal::from(rate).into()
    }
}

impl Wads {
    pub fn to_dec(self) -> Decimal {
        self.into()
    }
}
