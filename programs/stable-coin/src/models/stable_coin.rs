use crate::prelude::*;

#[account]
pub struct StableCoin {
    /// The stable coin mint
    pub mint: Pubkey,
    /// The signer of admin-only instructions such as adding or editing
    /// components must have this pubkey.
    pub admin: Pubkey,
    pub _padding: [u64; 128],
}

pub fn smallest_stable_coin_unit_market_price() -> Decimal {
    // we can unwrap in this function because all inputs are constants
    // and it's tested
    //
    // in case we hunted performance, let's validate whether the compiler boils
    // this down to a constant, or whether we have to replace it with one
    // ourselves

    let decimals = 10u64
        .checked_pow(consts::STABLE_COIN_DECIMALS as u32)
        .ok_or(ErrorCode::MathOverflow)
        .unwrap();

    Decimal::one().try_div(Decimal::from(decimals)).unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_smallest_unit_market_price() {
        assert_eq!(
            smallest_stable_coin_unit_market_price().to_string(),
            "0.000001000000000000"
        )
    }
}
