//! Contains logic for leverage yield farming using Aldrin's AMM pools.
//!
//! In Aldrin you deposit two constituent tokens into a pool and get LP tokens
//! of that pool. You then stake those LP tokens and get a farming ticket
//! account with information about how many LP tokens were staked and when.

pub mod close_leveraged_position_on_aldrin;
pub mod close_vault_position_on_aldrin;
pub mod compound_position_on_aldrin;
pub mod init_reserve_aldrin_unstable_lp_token;
pub mod open_leveraged_position_on_aldrin;
pub mod open_vault_position_on_aldrin;
pub mod refresh_reserve_aldrin_unstable_lp_token;

pub use close_leveraged_position_on_aldrin::*;
pub use close_vault_position_on_aldrin::*;
pub use compound_position_on_aldrin::*;
pub use init_reserve_aldrin_unstable_lp_token::*;
pub use open_leveraged_position_on_aldrin::*;
pub use open_vault_position_on_aldrin::*;
pub use refresh_reserve_aldrin_unstable_lp_token::*;
