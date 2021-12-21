use crate::prelude::*;

#[account]
#[derive(Default)]
pub struct LendingMarket {
    pub owner: Pubkey,
    pub oracle_program: Pubkey,
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
        assert_eq!(lending_market.oracle_program, Pubkey::default());
    }
}
