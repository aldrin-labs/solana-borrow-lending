//! Math for preserving precision of token amounts which are limited
//! by the SPL Token program to be at most u64::MAX.
//!
//! Decimals are internally scaled by a WAD (10^18) to preserve
//! precision up to 18 decimal places. Decimals are sized to support
//! both serialization and precise math for the full range of
//! unsigned 64-bit integers. The underlying representation is a
//! u192 rather than u256 to reduce compute cost while losing
//! support for arithmetic operations at the high end of u64 range.

#![allow(clippy::assign_op_pattern)]
#![allow(clippy::ptr_offset_with_cast)]
#![allow(clippy::manual_range_contains)]

use anchor_lang::prelude::*;
use std::{convert::TryFrom, fmt};

pub mod consts {
    /// Scale of precision.
    pub const SCALE: usize = 18;

    /// Identity
    pub const WAD: u64 = 1_000_000_000_000_000_000;

    pub const HALF_WAD: u64 = WAD / 2;

    pub const PERCENT_SCALER: u64 = 10_000_000_000_000_000;
}

#[error]
#[derive(PartialEq, Eq)]
pub enum ErrorCode {
    MathOverflow,
}

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

mod custom_u192 {
    use uint::construct_uint;

    // U192 with 192 bits consisting of 3 x 64-bit words
    construct_uint! {
        pub struct U192(3);
    }
}

pub use custom_u192::U192;

/// Large decimal values, precise to 18 digits
#[derive(Clone, Copy, Debug, Default, PartialEq, PartialOrd, Eq, Ord)]
pub struct Decimal(pub U192);

impl Decimal {
    pub fn one() -> Self {
        Self(Self::wad())
    }

    pub fn zero() -> Self {
        Self(U192::zero())
    }

    // OPTIMIZE: use const slice when fixed in BPF toolchain
    fn wad() -> U192 {
        U192::from(consts::WAD)
    }

    // OPTIMIZE: use const slice when fixed in BPF toolchain
    fn half_wad() -> U192 {
        U192::from(consts::HALF_WAD)
    }

    /// Create scaled decimal from percent value
    pub fn from_percent(percent: impl Into<u64>) -> Self {
        Self(U192::from(percent.into() * consts::PERCENT_SCALER))
    }

    /// Return raw scaled value if it fits within u128
    #[allow(clippy::wrong_self_convention)]
    pub fn to_scaled_val(&self) -> Result<u128> {
        Ok(
            u128::try_from(self.0)
                .map_err(|_| ProgramError::InvalidArgument)?,
        )
    }

    pub fn from_scaled_val(scaled_val: u128) -> Self {
        Self(U192::from(scaled_val))
    }

    pub fn try_round_u64(&self) -> Result<u64> {
        let rounded_val = Self::half_wad()
            .checked_add(self.0)
            .ok_or(ProgramError::InvalidArgument)?
            .checked_div(Self::wad())
            .ok_or(ProgramError::InvalidArgument)?;
        Ok(u64::try_from(rounded_val)
            .map_err(|_| ProgramError::InvalidArgument)?)
    }

    pub fn try_ceil_u64(&self) -> Result<u64> {
        let ceil_val = Self::wad()
            .checked_sub(U192::from(1u64))
            .ok_or(ProgramError::InvalidArgument)?
            .checked_add(self.0)
            .ok_or(ProgramError::InvalidArgument)?
            .checked_div(Self::wad())
            .ok_or(ProgramError::InvalidArgument)?;
        Ok(u64::try_from(ceil_val)
            .map_err(|_| ProgramError::InvalidArgument)?)
    }

    pub fn try_floor_u64(&self) -> Result<u64> {
        let ceil_val = self
            .0
            .checked_div(Self::wad())
            .ok_or(ProgramError::InvalidArgument)?;
        Ok(u64::try_from(ceil_val)
            .map_err(|_| ProgramError::InvalidArgument)?)
    }

    /// Calculates base^exp
    pub fn try_pow(&self, mut exp: u64) -> Result<Self> {
        let mut base = *self;
        let mut ret = if exp % 2 != 0 { base } else { Self::one() };

        while exp > 0 {
            exp /= 2;
            base = base.try_mul(base)?;

            if exp % 2 != 0 {
                ret = ret.try_mul(base)?;
            }
        }

        Ok(ret)
    }
}

impl fmt::Display for Decimal {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut scaled_val = self.0.to_string();
        if scaled_val.len() <= consts::SCALE {
            scaled_val.insert_str(
                0,
                &vec!["0"; consts::SCALE - scaled_val.len()].join(""),
            );
            scaled_val.insert_str(0, "0.");
        } else {
            scaled_val.insert(scaled_val.len() - consts::SCALE, '.');
        }
        f.write_str(&scaled_val)
    }
}

impl From<u64> for Decimal {
    fn from(val: u64) -> Self {
        Self(Self::wad() * U192::from(val))
    }
}

impl From<u128> for Decimal {
    fn from(val: u128) -> Self {
        Self(Self::wad() * U192::from(val))
    }
}

impl TryAdd for Decimal {
    fn try_add(self, rhs: Self) -> Result<Self> {
        Ok(Self(
            self.0
                .checked_add(rhs.0)
                .ok_or(ProgramError::InvalidArgument)?,
        ))
    }
}

impl TrySub for Decimal {
    fn try_sub(self, rhs: Self) -> Result<Self> {
        Ok(Self(
            self.0
                .checked_sub(rhs.0)
                .ok_or(ProgramError::InvalidArgument)?,
        ))
    }
}

impl TryDiv<u64> for Decimal {
    fn try_div(self, rhs: u64) -> Result<Self> {
        Ok(Self(
            self.0
                .checked_div(U192::from(rhs))
                .ok_or(ProgramError::InvalidArgument)?,
        ))
    }
}

impl TryDiv<Decimal> for Decimal {
    fn try_div(self, rhs: Self) -> Result<Self> {
        Ok(Self(
            self.0
                .checked_mul(Self::wad())
                .ok_or(ProgramError::InvalidArgument)?
                .checked_div(rhs.0)
                .ok_or(ProgramError::InvalidArgument)?,
        ))
    }
}

impl TryMul<u64> for Decimal {
    fn try_mul(self, rhs: u64) -> Result<Self> {
        Ok(Self(
            self.0
                .checked_mul(U192::from(rhs))
                .ok_or(ProgramError::InvalidArgument)?,
        ))
    }
}

impl TryMul<Decimal> for Decimal {
    fn try_mul(self, rhs: Self) -> Result<Self> {
        Ok(Self(
            self.0
                .checked_mul(rhs.0)
                .ok_or(ProgramError::InvalidArgument)?
                .checked_div(Self::wad())
                .ok_or(ProgramError::InvalidArgument)?,
        ))
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_scaler() {
        assert_eq!(U192::exp10(consts::SCALE), Decimal::wad());
    }

    #[test]
    fn test_checked_pow() {
        assert_eq!(Decimal::one(), Decimal::one().try_pow(u64::MAX).unwrap());
    }

    #[test]
    fn test_from_percent() {
        assert_eq!(
            Decimal::from_percent(200u64),
            Decimal::one().try_mul(2).unwrap()
        );
    }

    #[test]
    fn test_try_mul() {
        let a = Decimal(408000003381369883327u128.into());
        let b = Decimal(1000000007436580456u128.into());

        assert_eq!(
            Decimal(408000006415494734520u128.into()),
            a.try_mul(b).unwrap()
        );
    }

    mod custom_u128 {
        use uint::construct_uint;
        construct_uint! {
            pub struct U128(2);
        }
    }

    // Solana team's implementation had two number types: U192 and U128. We
    // removed the latter. This test makes sure that they two were
    // interchangeable in usage of `from_scaled_val`.
    #[test]
    fn test_decimal_same_as_rate() {
        use custom_u128::U128;

        fn ceil_u192(v: u128) -> u64 {
            let one = U192::from(consts::WAD);
            let v = U192::from(v).checked_div(one).unwrap();
            u64::try_from(v).unwrap()
        }

        fn ceil_u128(v: u64) -> u64 {
            let one = U128::from(consts::WAD);
            let v = U128::from(v).checked_div(one).unwrap();
            u64::try_from(v).unwrap()
        }

        assert_eq!(ceil_u128(0), ceil_u192(0));
        assert_eq!(ceil_u128(1), ceil_u192(1));
        assert_eq!(ceil_u128(10), ceil_u192(10));
        assert_eq!(ceil_u128(1_000), ceil_u192(1_000));
    }
}
