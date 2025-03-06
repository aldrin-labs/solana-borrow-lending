pub use anchor_client::solana_sdk::{
    pubkey::Pubkey,
    signature::{
        read_keypair_file, {Keypair, Signer},
    },
    system_instruction,
};
pub use anchor_client::Program;
pub use clap::{App, Arg, ArgMatches};
use std::borrow::Cow;
pub use std::{env, str::FromStr};

pub fn load_value<'a, T>(
    matches: Option<&'a str>,
    on_empty: impl FnOnce() -> T,
    on_value: impl FnOnce(&'a str) -> T,
) -> (bool, T) {
    let is_empty;
    let value = match matches {
        Some("") | None => {
            is_empty = true;
            on_empty()
        }
        Some(path) => {
            is_empty = false;
            on_value(path)
        }
    };

    (is_empty, value)
}

pub fn load_value_or_env<T>(
    matches: Option<&str>,
    env: &'static str,
    on_empty: impl FnOnce() -> T,
    on_value: impl FnOnce(&str) -> T,
) -> (bool, T) {
    let is_empty;
    let input = matches
        .map(Cow::Borrowed)
        .or_else(|| env::var(env).ok().map(Cow::Owned));
    let value = match input.as_ref().map(AsRef::as_ref) {
        Some("") | None => {
            is_empty = true;
            on_empty()
        }
        Some(path) => {
            is_empty = false;
            on_value(path)
        }
    };

    (is_empty, value)
}

pub fn load_keypair(
    matches: Option<&str>,
    error_message: &'static str,
) -> Keypair {
    let (_, keypair) = load_value(
        matches,
        || panic!("{}", error_message),
        |path| {
            read_keypair_file(path).expect("Cannot read file into a keypair")
        },
    );

    keypair
}

pub fn load_pubkey(
    matches: Option<&str>,
    error_message: &'static str,
) -> Pubkey {
    let (_, pubkey) = load_value(
        matches,
        || panic!("{}", error_message),
        |pubkey| {
            Pubkey::from_str(pubkey)
                .unwrap_or_else(|e| panic!("Invalid pubkey {}: {}", pubkey, e))
        },
    );

    pubkey
}
