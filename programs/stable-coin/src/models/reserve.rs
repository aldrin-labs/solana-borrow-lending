use crate::prelude::*;

#[account]
pub struct Reserve {
    pub liquidity_mint: Pubkey,
    pub freeze_wallet: Pubkey,
    pub collateral_mint: Pubkey,
    pub collateral_ratio: u8,
    pub interest: SDecimal,
    pub borrow_fee: SDecimal,
    pub liquidation_fee: SDecimal,
}
