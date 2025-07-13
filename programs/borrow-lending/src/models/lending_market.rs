use crate::prelude::*;

#[account]
#[derive(Default)]
pub struct LendingMarket {
    pub owner: Pubkey,
    pub enable_flash_loans: bool,
    /// Only a signer with this pubkey will be allowed to call the compound
    /// endpoint, the take reserve cap snapshot endpoint, etc.
    pub admin_bot: Pubkey,
    /// Whitelist Aldrin program ID for leverage yield farming (important) and
    /// for vaults.
    pub aldrin_amm: Pubkey,
    /// How much of the collected reward is claimed by compound bot when
    /// compounding leveraged position.
    pub leveraged_compound_fee: PercentageInt,
    /// How much of the collected reward is claimed on vault's compounding.
    pub vault_compound_fee: PercentageInt,
    /// In order to open a leveraged position, the worth of collateral in the
    /// UAC must be at least this much.
    pub min_collateral_uac_value_for_leverage: SDecimal,
    pub currency: UniversalAssetCurrency,
    /// Artificially pad some bytes for future configuration values. We use
    /// `u64` instead of `u8` because std doesn't provide default
    /// implementation for values larger than 32.
    pub _padding: [u64; 16],
}

impl LendingMarket {
    pub fn space() -> usize {
        292
    }
}

// Implement ZeroCopyAccount for LendingMarket to ensure rigorous zero-copy safety
impl_zero_copy_account!(LendingMarket, 292);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_can_be_defaulted() {
        let lending_market = LendingMarket::default();
        assert_eq!(lending_market.owner, Pubkey::default());
        assert_eq!(lending_market.enable_flash_loans, false);
        assert_eq!(
            lending_market.leveraged_compound_fee,
            PercentageInt::new(0)
        );
        assert_eq!(lending_market.vault_compound_fee, PercentageInt::new(0));
        assert_eq!(lending_market.currency, UniversalAssetCurrency::default());
        assert_eq!(lending_market.admin_bot, Pubkey::default());
        assert_eq!(
            lending_market.min_collateral_uac_value_for_leverage,
            Decimal::zero().into()
        );
    }

    #[test]
    fn it_calculates_space() {
        let mut lending_market = LendingMarket::default();
        lending_market.currency = UniversalAssetCurrency::Pubkey {
            address: Default::default(),
        };
        let mut serialized_data = Vec::new();
        lending_market.try_serialize(&mut serialized_data).unwrap();
        let expected_size = serialized_data.len();
        assert_eq!(expected_size, LendingMarket::space());
    }
}
