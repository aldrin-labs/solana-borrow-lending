#!/bin/bash

# You must create source_wallet in the accounts_path and transfer sufficient
# liquidity into it (at least as much as provided into --fund).

set -e

if [ -f .env ]
then
    export $(cat .env | sed 's/#.*//g' | xargs)
fi

cluster="${CLUSTER:-devnet}"

# for example from https://pyth.network/markets/?cluster=devnet#SOL/USD
# note: make sure that clusters match
pyth_product=""
pyth_price=""

# default mint is wSOL
wsol_mint="So11111111111111111111111111111111111111112"
liquidity_mint="${wsol_mint}"

config_path="cli/example-config.json"
accounts_path=".tmp"
fund_amount=0 # must be provided as --fund flag

while :; do
    case $1 in
        # transfers assets from source liquidity wallet into reserve's wallet
        # REQUIRED
        --fund)
            fund_amount="${2}"
            shift
        ;;
        --conf-path)
            config_path="${2}"
            shift
        ;;
        # without the trailing backslash
        --accounts-path)
            accounts_path="${2}"
            shift
        ;;
        --pyth-product)
            pyth_product="${2}"
            shift
        ;;
        --pyth-price)
            pyth_price="${2}"
            shift
        ;;
        --liq-mint)
            liquidity_mint="${2}"
            shift
        ;;
        *) break
    esac
    shift
done

owner_keypath="${PAYER:-${accounts_path}/owner.json}"

echo "accounts path: ${accounts_path}"
echo "reserve config path: ${config_path}"
echo "owner: ${owner_keypath}"
echo "cluster: ${CLUSTER}"
echo "fund amount: ${fund_amount}"
echo "pyth product: ${pyth_product}"
echo "pyth price: ${pyth_price}"
echo "liquidity mint: ${liquidity_mint}"

read -p "Do you want to continue? (Y/n) " -n 1 -r
if ! [[ $REPLY =~ ^[Yy]$ ]]
then
    exit 0
fi

mkdir -p "${accounts_path}"

function gen_keypair {
    solana-keygen new --no-bip39-passphrase -s -f -o "${accounts_path}/${1}.json"
}

# generates new keypairs (!! overwrites originals !!)
gen_keypair reserve # new reserve account
gen_keypair snapshots # new snapshots account
gen_keypair dest_wallet # BLp inits this account and transfers collateral to it
gen_keypair reserve_liq_wallet # where reserve funded liquidity is  stored
gen_keypair reserve_col_wallet # where reserve deposited collateral is stored
gen_keypair col_mint # initializes new token mint
gen_keypair fee_recv # wallet to receive borrow fees into

# mainnet won't allow airdrops
if [ "${liquidity_mint}" = "${wsol_mint}" ] && [ "${cluster}" = "devnet" ]; then
    echo
    echo "airdrops necessary fund amount to source liquidity wallet"
    echo

    airdrop_amount=$((fund_amount+1)) # +1 to cover fees
    spl-token create-account "${liquidity_mint}" \
        "${accounts_path}/source_wallet.json" \
        --fee-payer "${PAYER}"
    solana airdrop "${airdrop_amount}"
    spl-token unwrap || true
    spl-token wrap "${airdrop_amount}"
    spl-token transfer "${liquidity_mint}" "ALL" "${accounts_path}/source_wallet.json"
    spl-token authorize "${accounts_path}/source_wallet.json" \
        owner "${owner_keypath}"
fi

echo
echo "running cli init-reserve"
echo

./target/release/cli init-reserve \
    --keypair "${accounts_path}/reserve.json" \
    --snapshots "${accounts_path}/snapshots.json" \
    --reserve-liq-wallet "${accounts_path}/reserve_liq_wallet.json" \
    --reserve-col-wallet "${accounts_path}/reserve_col_wallet.json" \
    --collateral-mint "${accounts_path}/col_mint.json" \
    --fee-receiver "${accounts_path}/fee_recv.json" \
    --dest-wallet "${accounts_path}/dest_wallet.json" \
    --source-wallet "$(solana-keygen pubkey ${accounts_path}/source_wallet.json)" \
    --oracle-product "${pyth_product}" \
    --oracle-price "${pyth_price}" \
    --liquidity-mint "${liquidity_mint}" \
    --config "${config_path}" \
    --amount "${fund_amount}"
