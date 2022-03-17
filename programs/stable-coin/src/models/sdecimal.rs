//! TODO: deduplicate with borrow lending's SDecimal

use crate::prelude::*;
use decimal::U192;

/// We use storable decimal (hence [`SDecimal`]) when storing stuff into account
/// because at the moment Anchor's IDL TS library doesn't work with tuple
/// structs. That's why we cannot just use [`Decimal`].
///
/// The number is encoded as three u64s in little-endian. To create a
/// [`BN`][web3-bn] from the inner value you can use following typescript
/// method:
///
/// ```typescript
/// type U64 = BN;
/// type U192 = [U64, U64, U64];
///
/// function u192ToBN(u192: U192): BN {
///     return new BN(
///         [
///             ...u192[0].toArray("le", 8),
///             ...u192[1].toArray("le", 8),
///             ...u192[2].toArray("le", 8),
///         ],
///         "le"
///     );
/// }
/// ```
///
/// [web3-bn]: https://web3js.readthedocs.io/en/v1.5.2/web3-utils.html#bn
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
#[cfg_attr(
    feature = "serde",
    derive(serde_crate::Serialize, serde_crate::Deserialize),
    serde(crate = "serde_crate")
)]
#[cfg_attr(feature = "serde", serde(rename_all = "camelCase"))]
pub struct SDecimal {
    u192: [u64; 3],
}

impl From<SDecimal> for Decimal {
    fn from(dec: SDecimal) -> Self {
        Self(U192(dec.u192))
    }
}

impl From<&mut SDecimal> for Decimal {
    fn from(dec: &mut SDecimal) -> Self {
        Self(U192(dec.u192))
    }
}

impl From<Decimal> for SDecimal {
    fn from(dec: Decimal) -> Self {
        Self { u192: dec.0 .0 }
    }
}

impl From<u64> for SDecimal {
    fn from(v: u64) -> Self {
        Decimal::from(v).into()
    }
}

impl SDecimal {
    pub fn to_dec(self) -> Decimal {
        self.into()
    }

    #[cfg(test)]
    pub fn fill(with: u64) -> Self {
        Self {
            u192: [with, with, with],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_is_created_from_u64() {
        let n: u64 = 17_890;

        let sdec = SDecimal::from(n);
        let dec = Decimal::from(sdec);

        assert_eq!(dec.try_round_u64().unwrap(), n);
        assert_eq!(dec.try_ceil_u64().unwrap(), n);
        assert_eq!(dec.try_floor_u64().unwrap(), n);
    }

    #[test]
    fn test_basic_operations() {
        let dec = Decimal::one().try_div(Decimal::from(2u128)).unwrap();
        let mut sdec = SDecimal::from(dec);
        assert_eq!(sdec, sdec.clone());
        let dec = Decimal::from(&mut sdec);
        assert_eq!(dec.to_string(), sdec.to_dec().to_string());
    }

    #[test]
    fn it_represents_one_permill() {
        let dec = SDecimal {
            u192: [1000000000000000, 0, 0],
        };
        assert_eq!(dec.to_dec().to_string(), "0.001000000000000000");
    }

    #[test]
    fn it_represents_percents() {
        assert_eq!(
            SDecimal::from(Decimal::from_percent(90u64)),
            SDecimal {
                u192: [900000000000000000, 0, 0],
            }
        );
        assert_eq!(
            SDecimal::from(Decimal::from_percent(90u64)).u192[0].to_le_bytes(),
            [0, 0, 218, 73, 59, 113, 125, 12]
        );
    }
}
