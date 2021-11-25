//! Calls the [`borrow_lending::endpoints::init_lending_market`] endpoint on
//! a blockchain configured with `--cluster`.
//!
//! ## Example
//! See the `bin/cli/init_reserve.sh` script for usage.

use crate::prelude::*;
use borrow_lending::accounts::InitReserve as InitReserveAccounts;
use borrow_lending::instruction::InitReserve as InitReserveInstruction;
use borrow_lending::models::{InputReserveConfig, Reserve, ReserveConfig};
use solana_sdk::{
    instruction::Instruction,
    sysvar::{clock, rent},
};
use std::{borrow::Cow, fs, mem, path::PathBuf};

pub fn app() -> App<'static> {
    App::new("init-reserve")
        .about("initializes new reserve account")
        .arg(
            Arg::new("owner")
                .long("owner")
                .about(
                    "path to a keypair which has market admin rights \
                    (defaults to payer)",
                )
                .takes_value(true),
        )
        .arg(
            Arg::new("funder")
                .long("funder")
                .about(
                    "path to a keypair owning source liquidity wallet \
                    (defaults to owner)",
                )
                .takes_value(true),
        )
        .arg(
            Arg::new("market")
                .long("market")
                .about(
                    "pubkey of the lending market owned by owner \
                    (env MARKET)",
                )
                .takes_value(true),
        )
        .arg(
            Arg::new("keypair")
                .long("keypair")
                .about(
                    "path to a keypair for the newly created reserve account",
                )
                .takes_value(true),
        )
        .arg(
            Arg::new("reserve-liq-wallet")
                .long("reserve-liq-wallet")
                .about(
                    "path to a keypair used to initialize new liquidity \
                    wallet which is used by the reserve to store funded assets",
                )
                .takes_value(true),
        )
        .arg(
            Arg::new("liquidity-mint")
                .long("liquidity-mint")
                .about(
                    "pubkey of the liquidity mint account (env LIQUIDITY_MINT)",
                )
                .takes_value(true),
        )
        .arg(
            Arg::new("reserve-col-wallet")
                .long("reserve-col-wallet")
                .about(
                    "path to a keypair used to initialize new collateral \
                    wallet which is used by the reserve to store \
                    deposited assets",
                )
                .takes_value(true),
        )
        .arg(
            Arg::new("collateral-mint")
                .long("collateral-mint")
                .about(
                    "path to a keypair used to initialize new collateral mint",
                )
                .takes_value(true),
        )
        .arg(
            Arg::new("oracle-product")
                .long("oracle-product")
                .about("pubkey of the oracle account with product info")
                .takes_value(true),
        )
        .arg(
            Arg::new("oracle-price")
                .long("oracle-price")
                .about("pubkey of the oracle account with price info")
                .takes_value(true),
        )
        .arg(
            Arg::new("source-wallet")
                .long("source-wallet")
                .about(
                    "pubkey of the wallet owned by funder from which \
                    reserve's liquidity pool is initialized",
                )
                .takes_value(true),
        )
        .arg(
            Arg::new("amount")
                .long("amount")
                .about("amount of liquidity to initialize reserve with")
                .takes_value(true),
        )
        .arg(
            Arg::new("dest-wallet")
                .long("dest-wallet")
                .about(
                    "path to a keypair used to initialize new collateral \
                    wallet and receive collateral for the liquidity",
                )
                .takes_value(true),
        )
        .arg(
            Arg::new("fee-receiver")
                .long("fee-receiver")
                .about(
                    "path to a keypair used to initialize new liquidity \
                    wallet which will receive borrow fees",
                )
                .takes_value(true),
        )
        .arg(
            Arg::new("token-program")
                .long("token-program")
                .about("pubkey of the token program (env TOKEN_PROGRAM_ID)")
                .takes_value(true),
        )
        .arg(
            Arg::new("config")
                .long("config")
                .about("either path to a JSON file or stringified JSON")
                .takes_value(true),
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

    let (is_owner_funder, funder) = load_value(
        matches.value_of("owner"),
        || Keypair::from_bytes(&owner.to_bytes()).unwrap(),
        |path| {
            read_keypair_file(path)
                .expect("Cannot read funder file into a keypair")
        },
    );

    let (_, market) = load_value_or_env(
        matches.value_of("market"),
        "MARKET",
        || panic!("Market pubkey must be provided with --market or env MARKET"),
        |pubkey| Pubkey::from_str(pubkey).expect("Invalid market pubkey"),
    );

    let source_liquidity_wallet = load_pubkey(
        matches.value_of("source-wallet"),
        "Liquidity source wallet pubkey must be provided with --source-wallet",
    );

    let oracle_product = load_pubkey(
        matches.value_of("oracle-product"),
        "Oracle product account pubkey must be provided with --oracle-product",
    );

    let oracle_price = load_pubkey(
        matches.value_of("oracle-price"),
        "Oracle price account pubkey must be provided with --oracle-price",
    );

    let liquidity_mint = load_pubkey(
        matches.value_of("liquidity-mint"),
        "Liquidity mint pubkey must be provided with --liquidity-mint",
    );

    let reserve = load_keypair(
        matches.value_of("keypair"),
        "Path to keypair for reserve account must be provided with --keypair",
    );

    let collateral_mint = load_keypair(
        matches.value_of("collateral-mint"),
        "Path to keypair for collateral mint account must be provided \
        with --collateral-mint",
    );

    let fee_receiver = load_keypair(
        matches.value_of("fee-receiver"),
        "Path to keypair for fee receiver wallet must be \
        provided with --fee-receiver",
    );

    let reserve_liquidity_wallet = load_keypair(
        matches.value_of("reserve-liq-wallet"),
        "Path to keypair for reserve liquidity wallet account must be \
        provided with --reserve-liq-wallet",
    );

    let reserve_collateral_wallet = load_keypair(
        matches.value_of("reserve-col-wallet"),
        "Path to keypair for reserve collateral wallet account must be \
        provided with --reserve-collateral-wallet",
    );

    let destination_collateral_wallet = load_keypair(
        matches.value_of("dest-wallet"),
        "Path to keypair for destination collateral wallet account must be \
        provided with --dest-wallet",
    );

    let (_, token_program_id) = load_value_or_env(
        matches.value_of("token-program"),
        "TOKEN_PROGRAM_ID",
        || anchor_spl::token::ID,
        |pubkey| {
            Pubkey::from_str(pubkey).expect("Invalid token program id pubkey")
        },
    );

    let (_, liquidity_amount) = load_value(
        matches.value_of("amount"),
        || panic!("Amount of liquidity to fund must be provided with --amount"),
        |amount| u64::from_str(amount).expect("amount must be a number"),
    );

    let (_, config) = load_value(
        matches.value_of("config"),
        || panic!("Path to config JSON file is mandatory with --config"),
        |value| {
            let json = if PathBuf::from(&value).is_file() {
                Cow::Owned(
                    fs::read_to_string(value)
                        .expect("Cannot read reserve config JSON file"),
                )
            } else {
                Cow::Borrowed(value)
            };

            serde_json::from_str::<ReserveConfig>(&json)
                .expect("Cannot parse reserve config file into expected format")
        },
    );

    let reserve_account_size = 8 + mem::size_of::<Reserve>();
    let with_balance = program
        .rpc()
        .get_minimum_balance_for_rent_exemption(reserve_account_size)
        .expect("Cannot calculate minimum rent exemption balance");

    let (lending_market_pda, lending_market_bump_seed) =
        Pubkey::find_program_address(&[&market.to_bytes()[..]], &program.id());

    println!(
        "\nInitializing reserve account '{}':
        - owner: '{}'
        - funder: '{}'
        - size: {}
        - balance: {}
        - market: '{}'
        - amount: {}
        - token program: '{}'
        - dest. wallet: '{}'
        - source wallet: '{}'
        - res. liq. wallet: '{}'
        - res. col. wallet: '{}'
        - fee recv: '{}'
        - col. mint: '{}'
        - liq. mint: '{}'
        oracle
        - product: '{}'
        - price: '{}'
        config:
        {:#?}
        \n",
        reserve.pubkey(),
        owner.pubkey(),
        funder.pubkey(),
        reserve_account_size,
        with_balance,
        market,
        liquidity_amount,
        token_program_id,
        destination_collateral_wallet.pubkey(),
        source_liquidity_wallet,
        reserve_liquidity_wallet.pubkey(),
        reserve_collateral_wallet.pubkey(),
        fee_receiver.pubkey(),
        collateral_mint.pubkey(),
        liquidity_mint,
        oracle_product,
        oracle_price,
        config
    );

    println!("Creating accounts with system program...");
    let mut request_builder = program.request();
    for instruction in create_token_accounts(
        &program,
        &token_program_id,
        &[
            &destination_collateral_wallet.pubkey(),
            &reserve_collateral_wallet.pubkey(),
            &reserve_liquidity_wallet.pubkey(),
            &fee_receiver.pubkey(),
        ],
    ) {
        request_builder = request_builder.instruction(instruction);
    }
    request_builder = request_builder.instruction(create_token_mint(
        &program,
        &token_program_id,
        &collateral_mint.pubkey(),
    ));
    request_builder
        .signer(&destination_collateral_wallet)
        .signer(&collateral_mint)
        .signer(&reserve_liquidity_wallet)
        .signer(&fee_receiver)
        .signer(&reserve_collateral_wallet)
        .signer(&destination_collateral_wallet)
        .send()
        .expect("Cannot create necessary accounts");

    println!("Creating reserve with BLp...");
    let mut transaction = program
        .request()
        .instruction(system_instruction::create_account(
            &program.payer(),
            &reserve.pubkey(),
            with_balance,
            reserve_account_size as u64,
            &program.id(),
        ))
        .signer(&reserve)
        .accounts(InitReserveAccounts {
            owner: owner.pubkey(),
            funder: funder.pubkey(),
            lending_market_pda,
            lending_market: market,
            reserve: reserve.pubkey(),
            reserve_collateral_wallet: reserve_collateral_wallet.pubkey(),
            reserve_liquidity_wallet: reserve_liquidity_wallet.pubkey(),
            destination_collateral_wallet: destination_collateral_wallet
                .pubkey(),
            reserve_collateral_mint: collateral_mint.pubkey(),
            reserve_liquidity_mint: liquidity_mint,
            reserve_liquidity_fee_recv_wallet: fee_receiver.pubkey(),
            source_liquidity_wallet,
            oracle_price,
            oracle_product,
            token_program: token_program_id,
            clock: clock::ID,
            rent: rent::ID,
        })
        .args(InitReserveInstruction {
            liquidity_amount,
            lending_market_bump_seed,
            config: InputReserveConfig::new(config),
        });

    // the payer signature is added by the framework, so in order not to
    // duplicate it we conditional sign owner if it's not defaulted to payer
    if !is_payer_owner {
        transaction = transaction.signer(&owner);
    }

    // only sign funder if it's distinct to owner
    if !is_owner_funder {
        transaction = transaction.signer(&funder);
    }

    let signature = transaction.send().expect("Transaction failed");

    println!("Successfully initialized reserve account");
    println!("sig: {}", signature);
}

fn create_token_mint(
    program: &Program,
    token_program_id: &Pubkey,
    mint: &Pubkey,
) -> Instruction {
    let account_size = anchor_spl::token::Mint::LEN;
    let with_balance = program
        .rpc()
        .get_minimum_balance_for_rent_exemption(account_size)
        .expect("Cannot calculate minimum rent exemption balance");

    system_instruction::create_account(
        &program.payer(),
        mint,
        with_balance,
        account_size as u64,
        token_program_id,
    )
}

fn create_token_accounts(
    program: &Program,
    token_program_id: &Pubkey,
    accounts: &[&Pubkey],
) -> Vec<Instruction> {
    let account_size = anchor_spl::token::TokenAccount::LEN;
    let with_balance = program
        .rpc()
        .get_minimum_balance_for_rent_exemption(account_size)
        .expect("Cannot calculate minimum rent exemption balance");

    accounts
        .iter()
        .map(|account_pubkey| {
            system_instruction::create_account(
                &program.payer(),
                account_pubkey,
                with_balance,
                account_size as u64,
                token_program_id,
            )
        })
        .collect()
}
