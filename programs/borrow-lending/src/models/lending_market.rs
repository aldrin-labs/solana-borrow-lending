use crate::prelude::*;

#[account]
pub struct LendingMarket {
    pub owner: Pubkey,
    pub oracle_program: Pubkey,
    pub currency: UniversalAssetCurrency,
}
