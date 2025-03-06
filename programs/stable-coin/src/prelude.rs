pub use crate::err::{self, ErrorCode};
pub use crate::models::*;
pub use anchor_lang::prelude::*;
pub use decimal::{Decimal, TryAdd, TryDiv, TryMul, TryPow, TrySub};

pub mod consts {
    use super::Pubkey;

    pub const STABLE_COIN_DECIMALS: u32 = 6;

    /// Picked to replicate abracadabra's logic
    pub const MAX_LEVERAGE_LOOPS: u64 = 30;

    // https://solscan.io/token/CXLBjMMcwkc17GfJtBos6rQCo1ypeH6eDbB82Kby4MRm
    pub const UST_MINT: Pubkey = Pubkey::new_from_array([
        171, 53, 172, 74, 173, 22, 127, 94, 95, 42, 177, 214, 117, 70, 194, 75,
        158, 45, 243, 120, 5, 197, 131, 145, 93, 195, 237, 251, 49, 18, 19,
        164,
    ]);

    #[cfg(test)]
    mod tests {
        use super::*;
        use std::str::FromStr;

        #[test]
        fn test_ust_mint() {
            assert_eq!(
                UST_MINT,
                Pubkey::from_str(
                    "CXLBjMMcwkc17GfJtBos6rQCo1ypeH6eDbB82Kby4MRm"
                )
                .unwrap()
            );
        }
    }
}
