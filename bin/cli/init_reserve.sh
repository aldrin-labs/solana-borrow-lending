#!/bin/bash

# IMPORTANT: mainnet won't allow airdrops

set -e

if [ -f .env ]
then
    export $(cat .env | sed 's/#.*//g' | xargs)
fi

airdrop_amount=3 # how much wSOL to airdrop, must be more than fund_amount
fund_amount=2 # transfers assets from source liquidity wallet into reserve's wallet
# https://pyth.network/markets/?cluster=devnet#SOL/USD
pyth_product="3Mnn2fX6rQyUsyELYms1sBJyChWofzSNRoqYzvgMVz5E"
pyth_price="J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix"
wsol_mint="So11111111111111111111111111111111111111112"
config='cli/example-config.json'

function gen_keypair {
    solana-keygen new --no-bip39-passphrase -s -f -o ".tmp/${1}.json"
}

# generates new keypairs (!! overwrites originals !!)
gen_keypair reserve # new reserve account
gen_keypair source_wallet # from this account we fund the reserve liquidity
gen_keypair dest_wallet # BLp inits this account and transfers collateral to it
gen_keypair reserve_liq_wallet # where reserve funded liquidity is  stored
gen_keypair reserve_col_wallet # where reserve deposited collateral is stored
gen_keypair col_mint # initializes new token mint
gen_keypair fee_recv # wallet to receive borrow fees into

echo
echo "airdrops necessary fund amount to source liquidity wallet"
echo

spl-token create-account "${wsol_mint}" .tmp/source_wallet.json --fee-payer "${PAYER}"
solana airdrop "${airdrop_amount}"
spl-token unwrap || true
spl-token wrap "${airdrop_amount}"
spl-token transfer "${wsol_mint}" "ALL" .tmp/source_wallet.json
spl-token authorize .tmp/source_wallet.json owner .tmp/owner.json

echo
echo "running cli init-reserve"
echo

./target/release/cli init-reserve \
    --owner .tmp/owner.json \
    --keypair .tmp/reserve.json \
    --reserve-liq-wallet .tmp/reserve_liq_wallet.json \
    --reserve-col-wallet .tmp/reserve_col_wallet.json \
    --collateral-mint .tmp/col_mint.json \
    --fee-receiver .tmp/fee_recv.json \
    --dest-wallet .tmp/dest_wallet.json \
    --source-wallet "$(solana-keygen pubkey .tmp/source_wallet.json)" \
    --oracle-product "${pyth_product}" \
    --oracle-price "${pyth_price}" \
    --liquidity-mint "${wsol_mint}" \
    --config "${config}" \
    --amount "${fund_amount}"
