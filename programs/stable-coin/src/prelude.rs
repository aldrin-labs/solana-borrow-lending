pub use crate::err::{self, Error, ErrorCode, Result};
pub use crate::models::*;
pub use anchor_lang::prelude::*;
pub use decimal::{Decimal, TryAdd, TryDiv, TryMul, TryPow, TrySub};

pub mod consts {
    pub const STABLE_COIN_DECIMALS: u32 = 6;

    pub const MAX_LEVERAGE_LOOPS: u64 = 30;
}
