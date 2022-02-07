use crate::prelude::*;

#[account]
#[derive(Default)]
pub struct LendingMarket {
    pub owner: Pubkey,
    pub enable_flash_loans: bool,
    /// Only a signer with this pubkey will be allowed to call the compound
    /// endpoint, the take reserve cap snapshot endpoint, etc.
    pub admin_bot: Pubkey,
    /// How much of the collected reward is claimed by compound bot.
    pub compound_fee: PercentageInt,
    /// In order to open a leveraged position, the worth of collateral in the
    /// UAC must be at least this much.
    pub min_collateral_uac_value_for_leverage: SDecimal,
    pub currency: UniversalAssetCurrency,
}

impl LendingMarket {
    pub fn space() -> usize {
        131
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_can_be_defaulted() {
        let lending_market = LendingMarket::default();
        assert_eq!(lending_market.owner, Pubkey::default());
        assert_eq!(lending_market.enable_flash_loans, false);
        assert_eq!(lending_market.compound_fee, PercentageInt::new(0));
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
