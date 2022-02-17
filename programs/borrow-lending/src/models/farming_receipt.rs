//! Auxiliary account which helps us to keep track of opened farming tickets in
//! AMM that are under the control of BLp.
//!
//! By themselves they do not provide any safety, because that's guaranteed by
//! the PDA seeds which we use. However, since the PDA seeds contain leverage
//! on top of obligation and reserve pubkeys, they cannot be easily filtered
//! for when fetching accounts.

use crate::prelude::*;

#[account]
pub struct AldrinFarmingReceipt {
    /// This is obligation pubkey in case of leveraged positions and the caller
    /// wallet pubkey in case of vaults.
    pub owner: Pubkey,
    /// This is the borrow reserve pubkey in case of leveraged positions and
    /// the AMM pool pubkey in case of vaults.
    pub association: Pubkey,
    /// The pubkey of the farming ticket this receipt represents.
    pub ticket: Pubkey,
    /// This will is 1x in case of vaults.
    pub leverage: Leverage,
}
