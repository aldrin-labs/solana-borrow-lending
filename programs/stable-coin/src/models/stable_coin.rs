use crate::prelude::*;

#[account]
pub struct StableCoin {
    /// The stable coin mint
    pub mint: Pubkey,
    /// The signer of admin-only instructions such as adding or editing
    /// components must have this pubkey.
    pub admin: Pubkey,
    /// Stable coin is intimately connected to BLp and especially Aldrin's
    /// market, because that's how we get token prices. Instead of
    /// re-implementing oracle logic, we just reuse
    /// [`borrow_lending::Reserve`].
    pub blp_market: Pubkey,
    /// Aldrin's AMM program pubkey.
    pub aldrin_amm: Pubkey,
    pub _padding: [u64; 128],
}
