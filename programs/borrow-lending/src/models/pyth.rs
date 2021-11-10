//! TODO: write docs for this and refer to code from where the structs were
//! copied
//!
//! <https://pyth.network>
//!
//! <https://github.com/project-serum/anchor/blob/master/tests/pyth/programs/pyth>
//! <https://github.com/pyth-network/pyth-client-rs>
//! <https://github.com/solana-labs/solana-program-library/blob/master/borrow-lending/program/src/pyth.rs>

use crate::prelude::*;
use bytemuck::{cast_slice, from_bytes, try_cast_slice, Pod, Zeroable};
use std::convert::{TryFrom, TryInto};
use std::mem;

pub const MAGIC: u32 = 0xa1b2c3d4;
pub const VERSION_2: u32 = 2;
pub const PROD_ACCT_SIZE: usize = 512;
pub const PROD_HDR_SIZE: usize = 48;
pub const PROD_ATTR_SIZE: usize = PROD_ACCT_SIZE - PROD_HDR_SIZE;

#[derive(Copy, Clone)]
#[repr(C)]
pub struct Product {
    pub magic: u32,                 // pyth magic number
    pub ver: u32,                   // program version
    pub atype: u32,                 // account type
    pub size: u32,                  // price account size
    pub px_acc: AccKey,             // first price account in list
    pub attr: [u8; PROD_ATTR_SIZE], // key/value pairs of reference attr.
}

#[derive(Copy, Clone)]
#[repr(C)]
pub enum AccountType {
    Unknown,
    Mapping,
    Product,
    Price,
}

#[derive(Default, Copy, Clone)]
#[repr(C)]
pub struct AccKey {
    pub val: [u8; 32],
}

#[derive(Copy, Clone)]
#[repr(C)]
pub enum PriceStatus {
    Unknown,
    Trading,
    Halted,
    Auction,
}

impl Default for PriceStatus {
    fn default() -> Self {
        PriceStatus::Trading
    }
}

#[derive(Copy, Clone)]
#[repr(C)]
pub enum CorpAction {
    NoCorpAct,
}

impl Default for CorpAction {
    fn default() -> Self {
        CorpAction::NoCorpAct
    }
}

#[derive(Default, Copy, Clone)]
#[repr(C)]
pub struct PriceInfo {
    pub price: i64,
    pub conf: u64,
    pub status: PriceStatus,
    pub corp_act: CorpAction,
    pub pub_slot: u64,
}

#[derive(Default, Copy, Clone)]
#[repr(C)]
pub struct PriceComp {
    publisher: AccKey,
    agg: PriceInfo,
    latest: PriceInfo,
}

#[derive(Copy, Clone)]
#[repr(C)]
pub enum PriceType {
    Unknown,
    Price,
    TWAP,
    Volatility,
}

impl Default for PriceType {
    fn default() -> Self {
        PriceType::Price
    }
}

#[derive(Default, Copy, Clone)]
#[repr(C)]
pub struct Price {
    pub magic: u32,       // Pyth magic number.
    pub ver: u32,         // Program version.
    pub atype: u32,       // Account type.
    pub size: u32,        // Price account size.
    pub ptype: PriceType, // Price or calculation type.
    pub expo: i32,        // Price exponent.
    pub num: u32,         // Number of component prices.
    pub unused: u32,
    pub curr_slot: u64,  // Currently accumulating price slot.
    pub valid_slot: u64, // Valid slot-time of agg. price.
    pub twap: i64,       // Time-weighted average price.
    pub avol: u64,       // Annualized price volatility.
    pub drv0: i64,       // Space for future derived values.
    pub drv1: i64,       // Space for future derived values.
    pub drv2: i64,       // Space for future derived values.
    pub drv3: i64,       // Space for future derived values.
    pub drv4: i64,       // Space for future derived values.
    pub drv5: i64,       // Space for future derived values.
    pub prod: AccKey,    // Product account key.
    pub next: AccKey,    // Next Price account in linked list.
    pub agg_pub: AccKey, // Quoter who computed last aggregate price.
    pub agg: PriceInfo,  // Aggregate price info.
    pub comp: [PriceComp; 32], // Price components one per quoter.
}

pub trait Load {
    fn load(data: &[u8]) -> Result<Unvalidated<&Self>>
    where
        Self: Pod,
    {
        let size = mem::size_of::<Self>();
        let constructed = from_bytes(cast_slice::<u8, u8>(
            try_cast_slice(&data[0..size]).map_err(|byte_err| {
                msg!("Cannot cast data to struct due to: {}", byte_err);
                ErrorCode::InvalidOracleDataLayout
            })?,
        ));

        Ok(Unvalidated::new(constructed))
    }
}

impl Load for Price {}
impl Load for Product {}

#[cfg(target_endian = "little")]
unsafe impl Zeroable for Price {}

#[cfg(target_endian = "little")]
unsafe impl Pod for Price {}

#[cfg(target_endian = "little")]
unsafe impl Zeroable for Product {}

#[cfg(target_endian = "little")]
unsafe impl Pod for Product {}

impl PartialEq<Pubkey> for AccKey {
    fn eq(&self, pubkey: &Pubkey) -> bool {
        &self.val == pubkey.as_ref()
    }
}

impl Validate for &Product {
    fn validate(&self) -> Result<()> {
        if self.magic != MAGIC {
            msg!("Pyth product account provided is not a valid Pyth account");
            return Err(ErrorCode::InvalidOracleConfig.into());
        }
        if self.ver != VERSION_2 {
            msg!("Pyth product account provided has a different version than expected");
            return Err(ErrorCode::InvalidOracleConfig.into());
        }
        if self.atype != AccountType::Product as u32 {
            msg!("Pyth product account provided is not a valid Pyth product account");
            return Err(ErrorCode::InvalidOracleConfig.into());
        }

        Ok(())
    }
}

impl Validate for &Price {
    fn validate(&self) -> Result<()> {
        if !matches!(self.ptype, PriceType::Price) {
            msg!("Oracle price type is invalid");
            return Err(ErrorCode::InvalidOracleConfig.into());
        }

        Ok(())
    }
}

impl TryFrom<&Product> for UniversalAssetCurrency {
    type Error = Error;

    fn try_from(pyth_product: &Product) -> Result<Self> {
        const LEN: usize = 14;
        const KEY: &[u8; LEN] = b"quote_currency";

        let mut start = 0;
        while start < pyth::PROD_ATTR_SIZE {
            let mut length = pyth_product.attr[start] as usize;
            start += 1;

            if length == LEN {
                let mut end = start + length;
                if end > pyth::PROD_ATTR_SIZE {
                    msg!("Pyth product attribute key length too long");
                    return Err(ErrorCode::InvalidOracleConfig.into());
                }

                let key = &pyth_product.attr[start..end];
                if key == KEY {
                    start += length;
                    length = pyth_product.attr[start] as usize;
                    start += 1;

                    end = start + length;
                    if length > 32 || end > pyth::PROD_ATTR_SIZE {
                        msg!("Pyth product quote currency value too long");
                        return Err(ErrorCode::InvalidOracleConfig.into());
                    }

                    let mut value = [0u8; 32];
                    value[0..length]
                        .copy_from_slice(&pyth_product.attr[start..end]);
                    return match value {
                        Self::USD_RAW => Ok(Self::Usd),
                        pubkey => Ok(Self::Pubkey {
                            address: Pubkey::new_from_array(pubkey),
                        }),
                    };
                }
            }

            start += length;
            start += 1 + pyth_product.attr[start] as usize;
        }

        msg!("Pyth product quote currency not found");
        Err(ErrorCode::InvalidOracleConfig.into())
    }
}

impl Price {
    pub fn calculate_market_price(&self, clock: &Clock) -> Result<Decimal> {
        let slots_elapsed =
            clock.slot.checked_sub(self.valid_slot).unwrap_or(0);
        if slots_elapsed >= consts::ORACLE_STALE_AFTER_SLOTS_ELAPSED {
            msg!(
                "Oracle price at slot {} is stale ({} slots behind)",
                self.valid_slot,
                slots_elapsed
            );
            return Err(ErrorCode::InvalidOracleConfig.into());
        }

        let price: u64 = self.agg.price.try_into().map_err(|_| {
            msg!("Oracle price cannot be negative");
            ErrorCode::InvalidOracleConfig
        })?;

        let market_price = if self.expo >= 0 {
            let exponent =
                self.expo.try_into().map_err(|_| ErrorCode::MathOverflow)?;
            let zeros = 10u64.checked_pow(exponent).ok_or_else(|| {
                msg!("An overflow of u64 with 10^{}", exponent);
                ErrorCode::MathOverflow
            })?;
            Decimal::from(price).try_mul(zeros)?
        } else {
            let exponent = self
                .expo
                .checked_abs()
                .ok_or(ErrorCode::MathOverflow)?
                .try_into()
                .map_err(|_| ErrorCode::MathOverflow)?;
            let decimals = 10u64.checked_pow(exponent).ok_or_else(|| {
                msg!("An overflow of u64 with 10^{}", exponent);
                ErrorCode::MathOverflow
            })?;
            Decimal::from(price).try_div(decimals)?
        };

        Ok(market_price)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{fs, mem};

    #[test]
    fn account_size_sanity_check() {
        assert_eq!(mem::size_of::<Product>(), 512);
        assert_eq!(mem::size_of::<Price>(), 3312);
    }

    #[test]
    fn it_loads_product() {
        let data =
            fs::read("../../tests/fixtures/srm_usd_product.bin").unwrap();

        assert!(Product::load(&data).is_ok());
    }

    #[test]
    fn it_loads_price() {
        let data = fs::read("../../tests/fixtures/srm_usd_price.bin").unwrap();

        assert!(Price::load(&data).is_ok());
    }
}
