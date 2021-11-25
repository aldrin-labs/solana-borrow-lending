//! Calls the [`borrow_lending::endpoints::init_lending_market`] endpoint on
//! a blockchain configured with `--cluster`.
//!
//! ## Example
//! Let's create a new lending market on localnet. Assuming the test validator
//! is running, create new accounts and airdrop SOL:
//!
//! ```bash
//! solana-keygen new -o market-keypair.json
//! solana-keygen new -o payer-keypair.json
//! solana airdrop 1000 --keypair payer-keypair.json --config tests/localnet-conf.yml
//! ```
//!
//! ```bash
//! ./target/release/cli \
//!   --cluster localnet \
//!   --payer payer-keypair.json \
//!   --blp 7vRDzPZK2toUCkGUgtb1uPZLXvtj8YvXUKUBRh8Ufr5y \
//!   init-market \
//!   --keypair market-keypair.json \
//!   --oracle gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s \
//!   --usd
//! ```
//!
//! See `bin/cli/init_lending_market.sh` for another usage example.

use crate::prelude::*;
use borrow_lending::accounts::InitLendingMarket as Accounts;
use borrow_lending::instruction::InitLendingMarket as Instruction;
use borrow_lending::models::LendingMarket;
use borrow_lending::models::UniversalAssetCurrency;
use std::mem;

pub fn app() -> App<'static> {
    App::new("init-market")
        .about("initializes new lending market account")
        .arg(
            Arg::new("owner")
                .long("owner")
                .about(
                    "path to a keypair which will have admin rights \
                    (defaults to payer)",
                )
                .takes_value(true),
        )
        .arg(
            Arg::new("keypair")
                .long("keypair")
                .about(
                    "path to a keypair with pubkey of the newly \
                    initialized market",
                )
                .takes_value(true),
        )
        .arg(
            Arg::new("oracle")
                .long("oracle")
                .about(
                    "program id of the oracle which owns price accounts \
                    (env ORACLE_PROGRAM_ID)",
                )
                .takes_value(true),
        )
        .arg(
            Arg::new("usd")
                .long("usd")
                .about("uses USD as universal asset currency"),
        )
        .arg(
            Arg::new("currency")
                .long("currency")
                .about("pubkey of universal asset currency or 'usd'"),
        )
}

pub fn handle(program: Program, payer: Keypair, matches: &ArgMatches) {
    let (is_payer_owner, owner) = load_value(
        matches.value_of("owner"),
        || payer,
        |path| {
            read_keypair_file(path)
                .expect("Cannot read owner file into a keypair")
        },
    );

    let (_, oracle) = load_value_or_env(
        matches.value_of("oracle"),
        "ORACLE_PROGRAM_ID",
        || {
            panic!(
                "Oracle program id must be provided with \
                an env ORACLE_PROGRAM_ID or --oracle"
            )
        },
        |pubkey| Pubkey::from_str(pubkey).expect("Invalid oracle pubkey"),
    );

    let market = load_keypair(
        matches.value_of("keypair"),
        "Path to keypair for market account must be provided with --keypair",
    );

    let currency = if matches.is_present("usd") {
        assert!(
            !matches.is_present("currency"),
            "specify either --usd or --currency, not both"
        );
        UniversalAssetCurrency::Usd
    } else {
        match matches.value_of("currency") {
            Some("") | Some("usd") | None => UniversalAssetCurrency::Usd,
            Some(pubkey) => UniversalAssetCurrency::Pubkey {
                address: Pubkey::from_str(pubkey)
                    .expect("Invalid currency pubkey"),
            },
        }
    };

    let market_account_size = 8 + mem::size_of::<LendingMarket>();
    let with_balance = program
        .rpc()
        .get_minimum_balance_for_rent_exemption(market_account_size)
        .expect("Cannot calculate minimum rent exemption balance");

    println!(
        "\nInitializing market account '{}':
        - size:     {} bytes
        - balance:  {} lamports
        - currency: {:?}
        - oracle:   '{}'
        - owner:    '{}'
        \n",
        market.pubkey(),
        market_account_size,
        with_balance,
        currency,
        oracle,
        owner.pubkey()
    );

    let mut transaction = program
        .request()
        .instruction(system_instruction::create_account(
            &program.payer(),
            &market.pubkey(),
            with_balance,
            market_account_size as u64,
            &program.id(),
        ))
        .signer(&market)
        .accounts(Accounts {
            owner: owner.pubkey(),
            lending_market: market.pubkey(),
            oracle_program: oracle,
        })
        .args(Instruction { currency });

    // the payer signature is added by the framework, so in order not to
    // duplicate it we conditional sign owner if it's not defaulted to payer
    if !is_payer_owner {
        transaction = transaction.signer(&owner);
    }

    let signature = transaction.send().expect("Transaction failed");

    println!("Successfully initialized lending market account");
    println!("sig: {}", signature);
}
