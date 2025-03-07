use solana_sdk::pubkey::Pubkey;
use serde::{Deserialize, Serialize};

/// Lending market
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Market {
    /// Market address
    pub address: Pubkey,
    /// Market name
    pub name: String,
    /// Market owner
    pub owner: Pubkey,
    /// Universal asset currency
    pub currency: String,
}

/// Reserve
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reserve {
    /// Reserve address
    pub address: Pubkey,
    /// Market address
    pub market: Pubkey,
    /// Reserve name
    pub name: String,
    /// Liquidity mint
    pub liquidity_mint: Pubkey,
    /// Liquidity supply
    pub liquidity_supply: u64,
    /// Collateral mint
    pub collateral_mint: Pubkey,
    /// Collateral supply
    pub collateral_supply: u64,
    /// Borrow rate
    pub borrow_rate: f64,
    /// Deposit rate
    pub deposit_rate: f64,
}

/// Obligation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Obligation {
    /// Obligation address
    pub address: Pubkey,
    /// Market address
    pub market: Pubkey,
    /// Owner address
    pub owner: Pubkey,
    /// Deposited collateral
    pub deposits: Vec<ObligationCollateral>,
    /// Borrowed liquidity
    pub borrows: Vec<ObligationLiquidity>,
    /// Allowed to borrow
    pub allowed_to_borrow: bool,
}

/// Obligation collateral
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObligationCollateral {
    /// Reserve address
    pub reserve: Pubkey,
    /// Collateral amount
    pub amount: u64,
    /// Market value in UAC
    pub market_value: f64,
}

/// Obligation liquidity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObligationLiquidity {
    /// Reserve address
    pub reserve: Pubkey,
    /// Borrowed amount
    pub amount: u64,
    /// Market value in UAC
    pub market_value: f64,
    /// Cumulative borrow rate
    pub cumulative_borrow_rate: f64,
}

/// Flash loan
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlashLoan {
    /// Reserve address
    pub reserve: Pubkey,
    /// Amount
    pub amount: u64,
    /// Fee
    pub fee: u64,
}