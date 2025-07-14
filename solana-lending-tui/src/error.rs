use thiserror::Error;
use std::io;

/// Application specific errors
#[derive(Error, Debug)]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] io::Error),

    #[error("Solana client error: {0}")]
    SolanaClient(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Operation not supported: {0}")]
    NotSupported(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Unknown error: {0}")]
    Unknown(String),
}

/// Result type for the application
pub type Result<T> = std::result::Result<T, AppError>;