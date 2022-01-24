//! Auxiliary account which helps us to keep track of opened farming tickets in
//! AMM that are under the control of BLp.
//!
//! By themselves they do not provide any safety, because that's guaranteed by
//! the PDA seeds which we use. However, since the PDA seeds contain leverage
//! on top of obligation and reserve pubkeys, they cannot be easily filtered
//! for when fetching accounts.

use crate::prelude::*;

#[account]
pub struct FarmingReceipt {
    pub obligation: Pubkey,
    pub reserve: Pubkey,
    pub leverage: Leverage,
    pub platform: FarmPlatform,
}

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Eq, PartialEq,
)]
pub enum FarmPlatform {
    Aldrin,
    Orca,
}
