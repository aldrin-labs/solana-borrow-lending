use crate::prelude::*;
use std::cmp::Ordering;
use std::convert::{TryFrom, TryInto};

#[account]
pub struct Obligation {
    pub last_update: LastUpdate,
    pub lending_market: Pubkey,
    pub owner: Pubkey,
    // Ideally we'd use a const generic, but that's not supported by anchor.
    // Second to ideal we'd use a const, but that's not supported either.
    pub reserves: [ObligationReserve; 10],
    /// Market value of deposits
    pub deposited_value: SDecimal,
    /// Market value of borrows
    pub borrowed_value: SDecimal,
    /// The maximum borrow value at the weighted average loan to value ratio.
    pub allowed_borrow_value: SDecimal,
    /// The dangerous borrow value at the weighted average liquidation
    /// threshold.
    pub unhealthy_borrow_value: SDecimal,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum ObligationReserve {
    Empty,
    Collateral { inner: ObligationCollateral },
    Liquidity { inner: ObligationLiquidity },
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub struct ObligationCollateral {
    pub deposit_reserve: Pubkey,
    pub deposited_amount: u64,
    pub market_value: SDecimal,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub struct ObligationLiquidity {
    pub borrow_reserve: Pubkey,
    /// Borrow rate used for calculating interest.
    pub cumulative_borrow_rate: SDecimal,
    /// Amount of liquidity borrowed plus interest.
    pub borrowed_amount: SDecimal,
    pub market_value: SDecimal,
}

impl Default for ObligationReserve {
    fn default() -> Self {
        Self::Empty
    }
}

impl Default for Obligation {
    fn default() -> Self {
        Self {
            // this will compile err if the const doesn't match the hard coded
            // number in the struct
            reserves: [ObligationReserve::Empty;
                consts::MAX_OBLIGATION_RESERVES],
            last_update: LastUpdate::default(),
            lending_market: Pubkey::default(),
            owner: Pubkey::default(),
            deposited_value: Decimal::zero().into(),
            borrowed_value: Decimal::zero().into(),
            allowed_borrow_value: Decimal::zero().into(),
            unhealthy_borrow_value: Decimal::zero().into(),
        }
    }
}

impl ObligationLiquidity {
    pub fn accrue_interest(
        &mut self,
        cumulative_borrow_rate: Decimal,
    ) -> Result<()> {
        let prev_cumulative_borrow_rate: Decimal =
            self.cumulative_borrow_rate.into();
        match cumulative_borrow_rate.cmp(&prev_cumulative_borrow_rate) {
            Ordering::Less => {
                msg!("Interest rate cannot be negative");
                return Err(ErrorCode::NegativeInterestRate.into());
            }
            Ordering::Equal => {}
            Ordering::Greater => {
                let compounded_interest_rate: Rate = cumulative_borrow_rate
                    .try_div(prev_cumulative_borrow_rate)?
                    .try_into()?;

                self.borrowed_amount = Rate::try_from(self.borrowed_amount)?
                    .try_mul(compounded_interest_rate)?
                    .into();
                self.cumulative_borrow_rate = cumulative_borrow_rate.into();
            }
        }

        Ok(())
    }
}
