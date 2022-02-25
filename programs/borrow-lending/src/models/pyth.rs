//! Reexports types from [pyth.network client crate][pyth-client-crate] and
//! implements some convenience traits over them.
//!
//! # Risk
//! We depend on an oracle (e.g. <https://pyth.network>) which frequently updates
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
use std::cell::Ref;
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

/// Returns the market price in the UAC of 1 token described by the product
/// data.
pub fn token_market_price<'info>(
    clock: &Clock,
    uac: UniversalAssetCurrency,
    product_data: Ref<'info, &mut [u8]>,
    price_key: Pubkey,
    price_data: Ref<'info, &mut [u8]>,
) -> Result<Decimal> {
    let oracle_product = Product::load(&product_data)?.validate()?;
    if oracle_product.px_acc.val != price_key.to_bytes() {
        return Err(err::oracle(
            "Pyth product price account does not match the Pyth price provided",
        )
        .into());
    }

    let currency = UniversalAssetCurrency::try_from(oracle_product)?;
    if currency != uac {
        return Err(err::oracle(
            "Lending market quote currency does not match \
            the oracle quote currency",
        )
        .into());
    }

    let oracle_price = Price::load(&price_data)?.validate()?;
    let market_price = calculate_market_price(oracle_price, clock)?;

    Ok(market_price)
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
    use crate::models::Unvalidated;
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
    fn it_validates_product() {
        let data =
            fs::read("../../tests/fixtures/srm_usd_product.bin").unwrap();

        let product = Product::load(&data).unwrap().validate().unwrap();

        let mut product2 = clone_product(product);
        product2.magic += 1;
        let unvalidated_product2 = Unvalidated(&product2);
        assert!(unvalidated_product2.validate().is_err());

        let mut product2 = clone_product(product);
        product2.ver += 1;
        let unvalidated_product2 = Unvalidated(&product2);
        assert!(unvalidated_product2.validate().is_err());

        let mut product2 = clone_product(product);
        product2.atype = AccountType::Price as u32;
        let unvalidated_product2 = Unvalidated(&product2);
        assert!(unvalidated_product2.validate().is_err());
    }

    #[test]
    fn it_gets_universal_asset_currency_from_product() {
        let data =
            fs::read("../../tests/fixtures/srm_usd_product.bin").unwrap();

        let product = Product::load(&data).unwrap().validate().unwrap();
        assert_eq!(
            UniversalAssetCurrency::Usd,
            UniversalAssetCurrency::try_from(product).unwrap()
        );

        let mut product2 = clone_product(product);
        let uac = Pubkey::new_unique();

        let key = b"quote_currency".to_vec();
        let mut attrs = [0u8; PROD_ATTR_SIZE];
        attrs[0] = key.len() as u8; // length of the attribute name
        attrs[1..(key.len() + 1)].copy_from_slice(&key); // attribute name
        attrs[key.len() + 1] = 32; // pubkey length
        attrs[(key.len() + 2)..(key.len() + 2 + 32)]
            .copy_from_slice(&uac.to_bytes()); // insert pubkey

        product2.attr = attrs;

        assert_eq!(
            UniversalAssetCurrency::Pubkey { address: uac },
            UniversalAssetCurrency::try_from(&product2).unwrap()
        );
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
    fn it_calculates_market_price() {
        let data = fs::read("../../tests/fixtures/srm_usd_price.bin").unwrap();

        let price = Price::load(&data).unwrap().validate().unwrap();
        let mut clock = Clock::default();
        clock.slot = price.valid_slot;

        assert_eq!(
            Decimal::from(7_3825u128)
                .try_div(Decimal::from(10_000u128))
                .unwrap(),
            calculate_market_price(price, &clock).unwrap()
        );
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

    fn clone_product(product: &Product) -> Product {
        Product {
            magic: product.magic,
            ver: product.ver,
            atype: product.atype,
            size: product.size,
            px_acc: AccKey {
                val: product.px_acc.val.clone(),
            },
            attr: product.attr.clone(),
        }
    }
}
