# Solana Lending TUI

A terminal user interface (TUI) for interacting with the Solana Borrow-Lending protocol.

## Features

- View available lending markets
- View reserves in a market
- Deposit liquidity into a reserve
- Withdraw collateral from a reserve
- Borrow liquidity from a reserve
- Repay borrowed liquidity
- Liquidate under-collateralized positions
- Execute flash loans
- Configure application settings

## Prerequisites

- Rust and Cargo installed
- Solana CLI tools installed
- A Solana keypair file

## Installation

1. Clone the repository:

```bash
git clone https://github.com/your-username/solana-lending-tui.git
cd solana-lending-tui
```

2. Build the application:

```bash
cargo build --release
```

## Usage

Run the application:

```bash
cargo run --release
```

### Configuration

The application will look for a configuration file at `~/.config/solana-lending-tui/config.json`. If the file doesn't exist, it will create one with default values.

You can modify the configuration file to change the following settings:

- `cluster`: The Solana cluster to connect to (mainnet, devnet, or localnet)
- `keypair_path`: The path to your Solana keypair file
- `program_id`: The program ID of the Borrow-Lending protocol

### Keyboard Shortcuts

- `q`: Quit the application
- `h`: Go to Home screen
- `m`: View Markets
- `r`: View Reserves
- `d`: Deposit liquidity
- `w`: Withdraw collateral
- `b`: Borrow liquidity
- `p`: Repay borrowed liquidity
- `l`: Liquidate positions
- `f`: Execute flash loans
- `s`: Settings
- `?`: Help

## Development

### Project Structure

- `src/main.rs`: Entry point of the application
- `src/app.rs`: Application state and logic
- `src/ui.rs`: User interface rendering
- `src/event.rs`: Event handling
- `src/config.rs`: Configuration management
- `src/solana/`: Solana client and models

### Building

```bash
cargo build
```

### Testing

```bash
cargo test
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.