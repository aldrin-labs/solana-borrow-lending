use crate::prelude::*;

#[account]
pub struct StableCoin {
    /// The stable coin mint
    pub mint: Pubkey,
    /// Decimals of the stable coin mint
    pub decimals: u8,
    /// The signer of admin-only instructions such as adding or editing
    /// components must have this pubkey.
    pub admin: Pubkey,
    pub _padding: [u64; 128],
}
