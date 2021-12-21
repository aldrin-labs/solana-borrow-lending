use crate::prelude::*;

#[account]
#[derive(Default)]
pub struct LendingMarket {
    pub owner: Pubkey,
    pub currency: UniversalAssetCurrency,
    pub enable_flash_loans: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_can_be_defaulted() {
        let lending_market = LendingMarket::default();
        assert_eq!(lending_market.owner, Pubkey::default());
        assert_eq!(lending_market.enable_flash_loans, false);
        assert_eq!(lending_market.currency, UniversalAssetCurrency::default());
    }
}
