use crate::prelude::*;

#[account]
pub struct StableCoin {
    /// The stable coin mint
    pub mint: Pubkey,
    /// The signer of admin-only instructions such as adding or editing
    /// components must have this pubkey.
    pub admin: Pubkey,
    /// Aldrin's AMM program pubkey.
    pub aldrin_amm: Pubkey,
    pub _padding: [u64; 128],
}
