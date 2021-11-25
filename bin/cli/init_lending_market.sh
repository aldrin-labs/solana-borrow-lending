#!/bin/bash

set -e

function gen_keypair {
    solana-keygen new --no-bip39-passphrase -s -f -o ".tmp/${1}.json"
}

# generates new keypairs (!!overwrites if already exist!!)
gen_keypair owner # has admin rights over market
gen_keypair market # is the market's account

echo

# universal asset currency is USD, so all reserves oracle prices must be USD
./target/release/cli init-market \
    --owner .tmp/owner.json \
    --keypair .tmp/market.json \
    --usd
