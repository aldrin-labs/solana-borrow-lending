pub use crate::err::{self, ErrorCode};
pub use crate::models::*;
pub use anchor_lang::prelude::*;
pub use decimal::{Decimal, TryAdd, TryDiv, TryMul, TryPow, TrySub};

pub mod consts {
    pub const STABLE_COIN_DECIMALS: u32 = 6;

    /// Picked to replicate abracadabra's logic
    pub const MAX_LEVERAGE_LOOPS: u64 = 30;
}
