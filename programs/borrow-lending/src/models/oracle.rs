//! Different reserves have different ways of getting their UAC price. We use
//! an enum to distinguish different methods. The advantage of this approach
//! is that _(i)_ we only need to implement new init and refresh endpoints for
//! the reserves, while all the other logic stays the same because it only cares
//! about UAC value, and _(ii)_ we can add new oracle methods without breaking
//! changes as long as any new method doesn't change the byte size of the enum.

use crate::prelude::*;
use models::aldrin_amm::Side;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub enum Oracle {
    SimplePyth {
        /// The account key which contains USD information.
        price: Pubkey,
    },
    AldrinAmmLpPyth {
        /// The wallet which holds pool's base tokens.
        base_vault: Pubkey,
        /// The wallet which holds pool's quote tokens.
        quote_vault: Pubkey,
        /// The account key which contains UAC information on either base or
        /// quote token, depending on the variable `side`.
        price: Pubkey,
        /// The price oracle gives us UAC price of base ([`Side::Ask`]) or
        /// quote ([`Side::Bid`]) token.
        side: Side,
    },
    /// this variant won't ever be used in production, here we use it
    /// for padding up to 4 pubkeys for future variants
    Never { padding: [u8; 128] },
}

impl Oracle {
    pub fn simple_pyth(price: Pubkey) -> Self {
        Self::SimplePyth { price }
    }

    pub fn is_simple_pyth_price(&self, input_price: &Pubkey) -> bool {
        matches!(self, Self::SimplePyth { price } if price == input_price)
    }
}

impl Default for Oracle {
    fn default() -> Self {
        Self::SimplePyth {
            price: Pubkey::default(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::mem;

    #[test]
    fn it_has_stable_size() {
        // alerts the developer that enum size has changed which would warrant
        // a migration or something
        assert_eq!(mem::size_of::<Oracle>(), 129);
    }

    #[test]
    fn it_compares_with_simple_pyth() {
        assert_eq!(
            Oracle::default(),
            Oracle::SimplePyth {
                price: Default::default()
            }
        );
        let pk = Pubkey::new_unique();
        assert!(Oracle::simple_pyth(pk).is_simple_pyth_price(&pk));
        assert!(!Oracle::simple_pyth(pk)
            .is_simple_pyth_price(&Pubkey::new_unique()));
    }
}
