use std::path::{Path, PathBuf};
use std::fs;
use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};

/// Application configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// Solana cluster
    pub cluster: String,
    /// Path to keypair file
    pub keypair_path: String,
    /// Borrow-lending program ID
    pub program_id: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            cluster: "devnet".to_string(),
            keypair_path: get_default_keypair_path().to_string_lossy().to_string(),
            program_id: "HH6BiQtvsL6mh7En2knBeTDqmGjYCJFiXiqixrG8nndB".to_string(),
        }
    }
}

impl Config {
    /// Load configuration from file
    pub fn load(path: &Path) -> Result<Self> {
        if !path.exists() {
            return Ok(Self::default());
        }

        let content = fs::read_to_string(path)?;
        let config = serde_json::from_str(&content)?;
        Ok(config)
    }

    /// Save configuration to file
    pub fn save(&self, path: &Path) -> Result<()> {
        let content = serde_json::to_string_pretty(self)?;
        
        // Create parent directories if they don't exist
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        
        fs::write(path, content)?;
        Ok(())
    }
}

/// Get default keypair path
fn get_default_keypair_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".config")
        .join("solana")
        .join("id.json")
}

/// Get default config path
pub fn get_default_config_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("solana-lending-tui")
        .join("config.json")
}