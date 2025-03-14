mod endpoints;
mod prelude;

use anchor_client::solana_sdk::commitment_config::CommitmentConfig;
use anchor_client::{Client, Cluster};
use dotenv::dotenv;
use endpoints::*;
use prelude::*;
use std::rc::Rc;

fn main() {
    dotenv().ok();

    let mut app = App::new("BLp")
        .version(env!("CARGO_PKG_VERSION"))
        .arg(
            Arg::new("cluster")
                .long("cluster")
                .about("devnet (default) / mainnet / localnet (env CLUSTER)")
                .takes_value(true),
        )
        .arg(
            Arg::new("payer")
                .long("payer")
                .about("path to a wallet which covers gas (env PAYER)")
                .takes_value(true),
        )
        .arg(
            Arg::new("blp")
                .long("blp")
                .about("BLp program id (env BLP)")
                .takes_value(true),
        )
        .subcommand(init_lending_market::app())
        .subcommand(init_reserve::app());

    let usage = {
        let mut buffer: Vec<u8> = vec![];
        app.write_long_help(&mut buffer)
            .expect("failed to create help message");
        String::from_utf8(buffer).unwrap()
    };

    let app = app.get_matches();

    let payer = payer(app.value_of("payer"));
    let client = Client::new_with_options(
        cluster(app.value_of("cluster")),
        Rc::new(Keypair::from_bytes(&payer.to_bytes()).unwrap()),
        CommitmentConfig::finalized(),
    );

    let program = client.program(blp_id(app.value_of("blp-id")));

    match app.subcommand() {
        Some(("init-market", subcmd)) => {
            init_lending_market::handle(program, payer, subcmd)
        }
        Some(("init-reserve", subcmd)) => {
            init_reserve::handle(program, payer, subcmd)
        }
        _ => println!("{}", usage),
    };
}

fn cluster(opt: Option<&str>) -> Cluster {
    let env = env::var("CLUSTER").unwrap_or_default();
    let cluster = match opt.or(Some(env.as_str())) {
        Some("devnet") | None => Cluster::Devnet,
        Some("mainnet") => Cluster::Mainnet,
        Some("localnet") => Cluster::Localnet,
        Some(unknown) => {
            panic!(
                "No known cluster '{}', must be devnet/mainnet/localnet",
                unknown
            )
        }
    };

    println!(
        "Using cluster {} (http {}) (ws {})",
        cluster,
        cluster.url(),
        cluster.ws_url()
    );

    cluster
}

fn payer(opt: Option<&str>) -> Keypair {
    let (_, keypair) = load_value_or_env(
        opt,
        "PAYER",
        || {
            panic!(
                "Payer wallet must be supplied as an env PAYER or with --payer"
            )
        },
        |path| {
            read_keypair_file(path)
                .expect("Cannot read payer wallet file into a keypair")
        },
    );

    println!("Using gas payer wallet '{}'", keypair.pubkey());

    keypair
}

fn blp_id(opt: Option<&str>) -> Pubkey {
    let (_, program_id) = load_value_or_env(
        opt,
        "BLP",
        || borrow_lending::ID,
        |pubkey| Pubkey::from_str(pubkey).expect("Invalid BLp id pubkey"),
    );

    println!("Borrow-Lending program ID is '{}'", program_id);

    program_id
}
