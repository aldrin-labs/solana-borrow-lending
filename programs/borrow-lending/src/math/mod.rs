mod sdecimal;

use crate::prelude::*;
pub use decimal::*;
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
#[cfg_attr(
    feature = "serde",
    derive(serde_crate::Serialize, serde_crate::Deserialize),
    serde(crate = "serde_crate")
)]
#[cfg_attr(feature = "serde", serde(rename_all = "camelCase"))]
pub struct PercentageInt {
    pub percent: u8,
}

impl PercentageInt {
    pub const fn new(percent: u8) -> Self {
        Self { percent }
    }
}

impl From<PercentageInt> for Decimal {
    fn from(p: PercentageInt) -> Self {
        Self::from_percent(p.percent as u64)
    }
}

impl From<PercentageInt> for u64 {
    fn from(p: PercentageInt) -> Self {
        p.percent as u64
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

/// Leverage is given as a percentage value, for example to achieve 3x leverage
/// you should submit percent: 300.
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
#[cfg_attr(
    feature = "serde",
    derive(serde_crate::Serialize, serde_crate::Deserialize),
    serde(crate = "serde_crate")
)]
#[cfg_attr(feature = "serde", serde(rename_all = "camelCase"))]
pub struct Leverage {
    pub percent: u64,
}

impl Leverage {
    pub fn new(percent: u64) -> Self {
        Self { percent }
    }
}

impl From<Leverage> for Decimal {
    fn from(l: Leverage) -> Self {
        Decimal::from_percent(l.percent)
    }
}

impl From<u64> for Leverage {
    fn from(percent: u64) -> Self {
        Self { percent }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_compares_percentages() {
        assert!(PercentageInt::new(10) == PercentageInt::new(10));
        assert!(PercentageInt::new(11) != PercentageInt::new(10));
    }

    #[test]
    fn it_converts_leverage_to_decimal() {
        assert_eq!(
            Decimal::from(250u64).try_div(100u64).unwrap(),
            Leverage::new(250).into()
        );
    }

    #[test]
    fn it_converts_leverage_to_bytes() {
        let leverage = Leverage { percent: 250 };
        assert_eq!(&leverage.to_le_bytes(), &[250, 0, 0, 0, 0, 0, 0, 0])
    }
}
