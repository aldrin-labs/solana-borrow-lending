use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
use std::collections::HashMap;
use std::path::Path;
use anyhow::Result;

use crate::config::{Config, get_default_config_path};
use crate::solana::{SolanaClient, Market, Reserve};

/// Application states
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppState {
    Home,
    Markets,
    Reserves,
    Deposit,
    Withdraw,
    Borrow,
    Repay,
    Liquidate,
    FlashLoan,
    Settings,
    Help,
}

/// Application result
pub type AppResult<T> = std::result::Result<T, Box<dyn std::error::Error>>;

/// Application
pub struct App {
    /// Is the application running?
    pub running: bool,
    /// Current state of the application
    pub state: AppState,
    /// Navigation history
    pub history: Vec<AppState>,
    /// Available lending markets
    pub markets: Vec<String>,
    /// Selected market index
    pub selected_market: Option<usize>,
    /// Available reserves in the selected market
    pub reserves: Vec<String>,
    /// Selected reserve index
    pub selected_reserve: Option<usize>,
    /// Input values for various operations
    pub inputs: HashMap<String, String>,
    /// Messages/notifications
    pub messages: Vec<String>,
    /// Help text
    pub help: HashMap<String, String>,
    /// Configuration
    pub config: Config,
    /// Solana client
    pub solana_client: Option<SolanaClient>,
    /// Market data
    pub market_data: Vec<Market>,
    /// Reserve data
    pub reserve_data: Vec<Reserve>,
}

impl Default for App {
    fn default() -> Self {
        let mut help = HashMap::new();
        help.insert("q".to_string(), "Quit".to_string());
        help.insert("h".to_string(), "Home".to_string());
        help.insert("m".to_string(), "Markets".to_string());
        help.insert("r".to_string(), "Reserves".to_string());
        help.insert("d".to_string(), "Deposit".to_string());
        help.insert("w".to_string(), "Withdraw".to_string());
        help.insert("b".to_string(), "Borrow".to_string());
        help.insert("p".to_string(), "Repay".to_string());
        help.insert("l".to_string(), "Liquidate".to_string());
        help.insert("f".to_string(), "Flash Loan".to_string());
        help.insert("s".to_string(), "Settings".to_string());
        help.insert("?".to_string(), "Help".to_string());
        
        // Load config
        let config = Config::load(&get_default_config_path()).unwrap_or_default();
        
        Self {
            running: true,
            state: AppState::Home,
            history: vec![],
            markets: vec![],
            selected_market: None,
            reserves: vec![],
            selected_reserve: None,
            inputs: HashMap::new(),
            messages: vec![],
            help,
            config,
            solana_client: None,
            market_data: vec![],
            reserve_data: vec![],
        }
    }
}

impl App {
    /// Constructs a new instance of [`App`].
    pub fn new() -> Self {
        let mut app = Self::default();
        
        // Initialize Solana client
        match SolanaClient::new(
            &app.config.cluster,
            &app.config.keypair_path,
            &app.config.program_id,
        ) {
            Ok(client) => {
                app.solana_client = Some(client);
                app.add_message("Connected to Solana".to_string());
            }
            Err(err) => {
                app.add_message(format!("Failed to connect to Solana: {}", err));
            }
        }
        
        app
    }

    /// Handles the tick event of the terminal.
    pub async fn on_tick(&mut self) {
        // Update state here
    }

    /// Set running to false to quit the application.
    pub fn quit(&mut self) {
        self.running = false;
    }

    /// Handle key events and returns if the app should exit
    pub async fn handle_key_event(&mut self, key_event: KeyEvent) -> bool {
        match (key_event.code, key_event.modifiers) {
            // Exit application on Ctrl-C
            (KeyCode::Char('c'), KeyModifiers::CONTROL) => {
                self.quit();
                return true;
            }
            // Exit application on 'q'
            (KeyCode::Char('q'), KeyModifiers::NONE) => {
                self.quit();
                return true;
            }
            // Navigate to Home
            (KeyCode::Char('h'), KeyModifiers::NONE) => {
                self.navigate_to(AppState::Home);
            }
            // Navigate to Markets
            (KeyCode::Char('m'), KeyModifiers::NONE) => {
                self.navigate_to(AppState::Markets);
                self.load_markets().await;
            }
            // Navigate to Reserves
            (KeyCode::Char('r'), KeyModifiers::NONE) => {
                self.navigate_to(AppState::Reserves);
            }
            // Navigate to Deposit
            (KeyCode::Char('d'), KeyModifiers::NONE) => {
                self.navigate_to(AppState::Deposit);
            }
            // Navigate to Withdraw
            (KeyCode::Char('w'), KeyModifiers::NONE) => {
                self.navigate_to(AppState::Withdraw);
            }
            // Navigate to Borrow
            (KeyCode::Char('b'), KeyModifiers::NONE) => {
                self.navigate_to(AppState::Borrow);
            }
            // Navigate to Repay
            (KeyCode::Char('p'), KeyModifiers::NONE) => {
                self.navigate_to(AppState::Repay);
            }
            // Navigate to Liquidate
            (KeyCode::Char('l'), KeyModifiers::NONE) => {
                self.navigate_to(AppState::Liquidate);
            }
            // Navigate to Flash Loan
            (KeyCode::Char('f'), KeyModifiers::NONE) => {
                self.navigate_to(AppState::FlashLoan);
            }
            // Navigate to Settings
            (KeyCode::Char('s'), KeyModifiers::NONE) => {
                self.navigate_to(AppState::Settings);
            }
            // Navigate to Help
            (KeyCode::Char('?'), KeyModifiers::NONE) => {
                self.navigate_to(AppState::Help);
            }
            // Handle other keys based on current state
            _ => self.handle_state_specific_key_event(key_event).await,
        }
        false
    }

    /// Handle state-specific key events
    async fn handle_state_specific_key_event(&mut self, key_event: KeyEvent) {
        match self.state {
            AppState::Home => {
                // Handle Home state specific keys
            }
            AppState::Markets => {
                // Handle Markets state specific keys
                match key_event.code {
                    KeyCode::Up => {
                        if let Some(selected) = self.selected_market {
                            if selected > 0 {
                                self.selected_market = Some(selected - 1);
                            }
                        } else if !self.markets.is_empty() {
                            self.selected_market = Some(0);
                        }
                    }
                    KeyCode::Down => {
                        if let Some(selected) = self.selected_market {
                            if selected < self.markets.len() - 1 {
                                self.selected_market = Some(selected + 1);
                            }
                        } else if !self.markets.is_empty() {
                            self.selected_market = Some(0);
                        }
                    }
                    KeyCode::Enter => {
                        // Load reserves for selected market
                        if let Some(selected) = self.selected_market {
                            if selected < self.market_data.len() {
                                self.load_reserves(&self.market_data[selected].address).await;
                                self.navigate_to(AppState::Reserves);
                            }
                        }
                    }
                    _ => {}
                }
            }
            AppState::Reserves => {
                // Handle Reserves state specific keys
                match key_event.code {
                    KeyCode::Up => {
                        if let Some(selected) = self.selected_reserve {
                            if selected > 0 {
                                self.selected_reserve = Some(selected - 1);
                            }
                        } else if !self.reserves.is_empty() {
                            self.selected_reserve = Some(0);
                        }
                    }
                    KeyCode::Down => {
                        if let Some(selected) = self.selected_reserve {
                            if selected < self.reserves.len() - 1 {
                                self.selected_reserve = Some(selected + 1);
                            }
                        } else if !self.reserves.is_empty() {
                            self.selected_reserve = Some(0);
                        }
                    }
                    KeyCode::Enter => {
                        // Show options for selected reserve
                        if self.selected_reserve.is_some() {
                            // Show options menu
                        }
                    }
                    _ => {}
                }
            }
            // Handle other states
            _ => {}
        }
    }

    /// Navigate to a new state
    fn navigate_to(&mut self, state: AppState) {
        self.history.push(self.state);
        self.state = state;
    }

    /// Go back to previous state
    pub fn go_back(&mut self) {
        if let Some(previous_state) = self.history.pop() {
            self.state = previous_state;
        }
    }

    /// Add a message to the message list
    pub fn add_message(&mut self, message: String) {
        self.messages.push(message);
    }

    /// Load markets from Solana
    pub async fn load_markets(&mut self) {
        if let Some(client) = &self.solana_client {
            match client.get_markets().await {
                Ok(markets) => {
                    self.market_data = markets;
                    self.markets = self.market_data.iter().map(|m| m.name.clone()).collect();
                    self.add_message("Loaded markets".to_string());
                }
                Err(err) => {
                    self.add_message(format!("Failed to load markets: {}", err));
                }
            }
        }
    }

    /// Load reserves for a market
    pub async fn load_reserves(&mut self, market: &solana_sdk::pubkey::Pubkey) {
        if let Some(client) = &self.solana_client {
            match client.get_reserves(market).await {
                Ok(reserves) => {
                    self.reserve_data = reserves;
                    self.reserves = self.reserve_data.iter().map(|r| r.name.clone()).collect();
                    self.add_message("Loaded reserves".to_string());
                }
                Err(err) => {
                    self.add_message(format!("Failed to load reserves: {}", err));
                }
            }
        }
    }

    /// Deposit liquidity into a reserve
    pub async fn deposit(&mut self, reserve: &solana_sdk::pubkey::Pubkey, amount: u64) {
        if let Some(client) = &self.solana_client {
            match client.deposit(reserve, amount).await {
                Ok(signature) => {
                    self.add_message(format!("Deposit successful: {}", signature));
                }
                Err(err) => {
                    self.add_message(format!("Failed to deposit: {}", err));
                }
            }
        }
    }

    /// Withdraw collateral from a reserve
    pub async fn withdraw(&mut self, reserve: &solana_sdk::pubkey::Pubkey, amount: u64) {
        if let Some(client) = &self.solana_client {
            match client.withdraw(reserve, amount).await {
                Ok(signature) => {
                    self.add_message(format!("Withdraw successful: {}", signature));
                }
                Err(err) => {
                    self.add_message(format!("Failed to withdraw: {}", err));
                }
            }
        }
    }

    /// Borrow liquidity from a reserve
    pub async fn borrow(&mut self, reserve: &solana_sdk::pubkey::Pubkey, amount: u64) {
        if let Some(client) = &self.solana_client {
            match client.borrow(reserve, amount).await {
                Ok(signature) => {
                    self.add_message(format!("Borrow successful: {}", signature));
                }
                Err(err) => {
                    self.add_message(format!("Failed to borrow: {}", err));
                }
            }
        }
    }

    /// Repay borrowed liquidity
    pub async fn repay(&mut self, reserve: &solana_sdk::pubkey::Pubkey, amount: u64) {
        if let Some(client) = &self.solana_client {
            match client.repay(reserve, amount).await {
                Ok(signature) => {
                    self.add_message(format!("Repay successful: {}", signature));
                }
                Err(err) => {
                    self.add_message(format!("Failed to repay: {}", err));
                }
            }
        }
    }

    /// Liquidate an obligation
    pub async fn liquidate(
        &mut self,
        obligation: &solana_sdk::pubkey::Pubkey,
        repay_reserve: &solana_sdk::pubkey::Pubkey,
        withdraw_reserve: &solana_sdk::pubkey::Pubkey,
        amount: u64,
    ) {
        if let Some(client) = &self.solana_client {
            match client.liquidate(
                obligation,
                repay_reserve,
                withdraw_reserve,
                amount,
            ).await {
                Ok(signature) => {
                    self.add_message(format!("Liquidation successful: {}", signature));
                }
                Err(err) => {
                    self.add_message(format!("Failed to liquidate: {}", err));
                }
            }
        }
    }

    /// Execute a flash loan
    pub async fn flash_loan(
        &mut self,
        reserve: &solana_sdk::pubkey::Pubkey,
        amount: u64,
        target_program: &solana_sdk::pubkey::Pubkey,
        data: Vec<u8>,
    ) -> Result<()> {
        if let Some(client) = &self.solana_client {
            match client.flash_loan(
                reserve,
                amount,
                target_program,
                data,
            ).await {
                Ok(signature) => {
                    self.add_message(format!("Flash loan successful: {}", signature));
                    Ok(())
                }
                Err(err) => {
                    let msg = format!("Failed to execute flash loan: {}", err);
                    self.add_message(msg.clone());
                    Err(AppError::SolanaClient(msg))
                }
            }
        } else {
            let msg = "Solana client not initialized".to_string();
            self.add_message(msg.clone());
            Err(AppError::SolanaClient(msg))
        }
    }
    
    /// Set up input fields for deposit
    pub fn setup_deposit_inputs(&mut self) {
        self.input_handler = InputHandler::new();
        self.input_handler.add_input("Amount");
        self.input_handler.activate(0);
        self.input_mode = InputMode::Editing;
    }
    
    /// Set up input fields for withdraw
    pub fn setup_withdraw_inputs(&mut self) {
        self.input_handler = InputHandler::new();
        self.input_handler.add_input("Amount");
        self.input_handler.activate(0);
        self.input_mode = InputMode::Editing;
    }
    
    /// Set up input fields for borrow
    pub fn setup_borrow_inputs(&mut self) {
        self.input_handler = InputHandler::new();
        self.input_handler.add_input("Amount");
        self.input_handler.activate(0);
        self.input_mode = InputMode::Editing;
    }
    
    /// Set up input fields for repay
    pub fn setup_repay_inputs(&mut self) {
        self.input_handler = InputHandler::new();
        self.input_handler.add_input("Amount");
        self.input_handler.activate(0);
        self.input_mode = InputMode::Editing;
    }
}