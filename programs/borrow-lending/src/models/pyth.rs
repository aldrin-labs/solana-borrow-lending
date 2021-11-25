//! Reexports types from [pyth.network client crate][pyth-client-crate] and
//! implements some convenience traits over them.
//!
//! # Risk
//! We depend on an oracle (e.g. https://pyth.network) which frequently updates
//! (e.g.) USD prices of tokens. We define which oracle program to use when we
//! create a new market.
//!
//! Then which specific price account (which must be updated by that
//! oracle program maintainer) is followed depends on reserve configuration
//! (reserve = token liquidity supply and collateral supply). The BLp will not
//! work if the oracle maintainer stops updating the prices. Current solution to
//! this issue would be to upgrade BLp with a patch which allows us to change
//! the oracle settings. Until this patch is on the chain, no user can perform
//! any action.
//!
//! [pyth-client-crate]: https://github.com/pyth-network/pyth-client-rs

use crate::prelude::*;
pub use pyth_client::*;
use std::convert::{TryFrom, TryInto};

pub trait Load {
    fn load(data: &[u8]) -> Result<Unvalidated<&Self>>
    where
        Self: Sized,
    {
        Ok(Unvalidated::new(cast::<Self>(data)))
    }
}

impl Load for Price {}
impl Load for Product {}

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

pub fn calculate_market_price(pyth: &Price, clock: &Clock) -> Result<Decimal> {
    let slots_elapsed = clock.slot.saturating_sub(pyth.valid_slot);
    if slots_elapsed >= consts::ORACLE_STALE_AFTER_SLOTS_ELAPSED {
        msg!(
            "Oracle price at slot {} is stale ({} slots behind)",
            pyth.valid_slot,
            slots_elapsed
        );
        return Err(ErrorCode::InvalidOracleConfig.into());
    }

    let price: u64 = pyth.agg.price.try_into().map_err(|_| {
        msg!("Oracle price cannot be negative");
        ErrorCode::InvalidOracleConfig
    })?;

    let market_price = if pyth.expo >= 0 {
        let exponent =
            pyth.expo.try_into().map_err(|_| ErrorCode::MathOverflow)?;
        let zeros = 10u64.checked_pow(exponent).ok_or_else(|| {
            msg!("An overflow of u64 with 10^{}", exponent);
            ErrorCode::MathOverflow
        })?;
        Decimal::from(price).try_mul(zeros)?
    } else {
        let exponent = pyth
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

        let price = Price::load(&data);
        assert!(price.is_ok());
        let price = price.unwrap().validate();
        assert!(price.is_ok());
        let price = price.unwrap();

        assert_eq!(price.agg.price, 7382500000);
    }

    #[test]
    fn it_has_stable_price_offset() {
        assert_eq!(offset_of!(Price, agg), 208);
    }

    #[test]
    fn it_has_stable_price_slot_offset() {
        assert_eq!(offset_of!(Price, valid_slot), 40);
    }

    #[test]
    fn it_has_stable_product_price_offset() {
        assert_eq!(offset_of!(Product, px_acc), 16);
    }
}
