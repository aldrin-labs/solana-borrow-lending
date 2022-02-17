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
//!   --blp HH6BiQtvsL6mh7En2knBeTDqmGjYCJFiXiqixrG8nndB \
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
use borrow_lending::{
    math::{Decimal, PercentageInt},
    models::{LendingMarket, UniversalAssetCurrency},
};

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
            Arg::new("bot")
                .long("bot")
                .about(
                    "pubkey of account which is signer of operations delegated
                    to Aldrin bot, such as compounding \
                    (defaults to owner)",
                )
                .takes_value(true),
        )
        .arg(
            Arg::new("aldrin-amm")
                .long("aldrin-amm")
                .about("pubkey of aldrin's AMM program")
                .takes_value(true),
        )
        .arg(
            Arg::new("leveraged-compound-fee")
                .long("leveraged-compound-fee")
                .about(
                    "how many percents of rewards we take on compounding, \
                    of leveraged positions (defaults to 10%)",
                )
                .takes_value(true),
        )
        .arg(
            Arg::new("vault-compound-fee")
                .long("vault-compound-fee")
                .about(
                    "how many percents of rewards we take on compounding, \
                    of vaults positions (defaults to 2%)",
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

    let market = load_keypair(
        matches.value_of("keypair"),
        "Path to keypair for market account must be provided with --keypair",
    );

    let bot_pubkey = matches
        .value_of("bot")
        .map(ToString::to_string)
        .or_else(|| Some(owner.pubkey().to_string()));
    let bot =
        load_pubkey(bot_pubkey.as_deref(), "Provide bot's pubkey with --bot");

    let (_, leveraged_compound_fee) = load_value(
        matches.value_of("leveraged-compound-fee").or(Some("10")),
        || panic!("Leverage compound fee percentage must be provided"),
        |fee| u8::from_str(fee).expect("leverage compound fee must be a byte"),
    );

    let (_, vault_compound_fee) = load_value(
        matches.value_of("vault-compound-fee").or(Some("2")),
        || panic!("Vaults compound fee percentage must be provided"),
        |fee| u8::from_str(fee).expect("vaults compound fee must be a byte"),
    );

    let aldrin_amm = load_pubkey(
        matches.value_of("aldrin-amm"),
        "Aldrin's AMM program id must be provided with --aldrin-amm",
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

    let with_balance = program
        .rpc()
        .get_minimum_balance_for_rent_exemption(LendingMarket::space())
        .expect("Cannot calculate minimum rent exemption balance");

    println!(
        "\nInitializing market account '{}':
        - size:        {} bytes
        - balance:     {} lamports
        - currency:    {:?}
        - owner:       '{}'
        - bot:         '{}'
        - leverage fee {}%
        - vault fee    {}%
        \n",
        market.pubkey(),
        LendingMarket::space(),
        with_balance,
        currency,
        owner.pubkey(),
        bot,
        leveraged_compound_fee,
        vault_compound_fee
    );

    let mut transaction = program
        .request()
        .instruction(system_instruction::create_account(
            &program.payer(),
            &market.pubkey(),
            with_balance,
            LendingMarket::space() as u64,
            &program.id(),
        ))
        .signer(&market)
        .accounts(Accounts {
            owner: owner.pubkey(),
            lending_market: market.pubkey(),
            aldrin_amm,
            admin_bot: bot,
        })
        .args(Instruction {
            currency,
            leveraged_compound_fee: PercentageInt {
                percent: leveraged_compound_fee,
            },
            vault_compound_fee: PercentageInt {
                percent: vault_compound_fee,
            },
            // $10 can be hard coded, extremely unlikely need for configuration
            // via CLI
            min_collateral_uac_value_for_leverage: Decimal::from(10u64).into(),
        });

    // the payer signature is added by the framework, so in order not to
    // duplicate it we conditional sign owner if it's not defaulted to payer
    if !is_payer_owner {
        transaction = transaction.signer(&owner);
    }

    let signature = transaction.send().expect("Transaction failed");

    println!("Successfully initialized lending market account");
    println!("sig: {}", signature);
}
