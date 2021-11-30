use crate::prelude::*;

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
}
