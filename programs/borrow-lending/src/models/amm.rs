//! We cannot use AMM as a dependency because it uses anchor v0.12. This module
//! can be removed once it's updated.

use crate::prelude::*;

/// We don't even have all the fields on the struct, everything beyond the
/// field we need has been removed. The order must stay the same. See
/// <https://gitlab.com/crypto_project/defi/ammv2/-/blob/ba6de902a6571081c90fe6d89aca364d9a485375/programs/mm-farming-pool-product-only/src/lib.rs#L561>
#[derive(Debug)]
pub struct Pool {
    pub lp_token_freeze_vault: Pubkey,
    pub pool_mint: Pubkey,
    pub base_token_vault: Pubkey,
    pub base_token_mint: Pubkey,
    pub quote_token_vault: Pubkey,
    pub quote_token_mint: Pubkey,
}

impl Pool {
    pub fn load(account_data: &[u8]) -> Result<&Self>
    where
        Self: Sized,
    {
        const EXPECTED_AMM_POOL_SIZE: usize = 441; // including hash id
        if account_data.len() != EXPECTED_AMM_POOL_SIZE {
            msg!(
                "AMM pool account must be {} bytes, but got {}",
                EXPECTED_AMM_POOL_SIZE,
                account_data.len()
            );
            Err(ErrorCode::NotAmmPoolAccount.into())
        } else {
            // we skip first 8 bytes because that's a hash identifier created by
            // anchor
            Ok(pyth_client::cast::<Pool>(&account_data[8..]))
        }
    }
}

pub fn lp_token_market_price(
    lp_tokens_supply: u64,
    base_market_price: Decimal,
    base_tokens_deposited: u64,
    quote_market_price: Decimal,
    quote_tokens_deposited: u64,
) -> Result<Decimal> {
    let base_market_total =
        base_market_price.try_mul(Decimal::from(base_tokens_deposited))?;

    let quote_market_total =
        quote_market_price.try_mul(Decimal::from(quote_tokens_deposited))?;

    base_market_total
        .try_add(quote_market_total)?
        .try_div(Decimal::from(lp_tokens_supply))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn it_loads_from_bin() {
        let bin = fs::read("../../tests/fixtures/amm_pool.bin").unwrap();
        let pool = Pool::load(&bin).unwrap();
        assert_eq!(
            &pool.lp_token_freeze_vault.to_string(),
            "ARv4ccYozczqbbVzTR9A9xqfCdkqvNfb3iyrDLwE8bVb"
        );
        assert_eq!(
            &pool.pool_mint.to_string(),
            "3eVRfwNAVsJPEX6AKc9nz4fsPbCSwWLFhR7UbTwxNsQV"
        );
        assert_eq!(
            &pool.base_token_vault.to_string(),
            "82uvyr1x54cAZBURvDK89YY7s2tNr3RQE1EqpEghZYge"
        );
        assert_eq!(
            &pool.base_token_mint.to_string(),
            "CJCP3V7SXYstwvqvhybosUgxJotZisAa2RuHVctFxQUf"
        );
        assert_eq!(
            &pool.quote_token_vault.to_string(),
            "FcAo5m1nKSRe7mcqGQgvfHGEEPzfbC6SH15vgQWBhqY7"
        );
        assert_eq!(
            &pool.quote_token_mint.to_string(),
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        );
    }
}
