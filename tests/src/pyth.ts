import { PublicKey, Transaction, Keypair, Connection } from "@solana/web3.js";
import { numberToU64 } from "./helpers";
import { readFileSync } from "fs";

export type OracleMarket = "srm" | "doge";

export const oracleProductBin = (market: OracleMarket = "srm") =>
  readFileSync(`tests/fixtures/${market}_usd_product.bin`);
export const oracleProductBinByteLen = (market?: OracleMarket) =>
  oracleProductBin(market).length;

export const oraclePriceBin = (market: OracleMarket = "srm") =>
  readFileSync(`tests/fixtures/${market}_usd_price.bin`);
export const oraclePriceBinByteLen = (market?: OracleMarket) =>
  oraclePriceBin(market).length;

export async function uploadOracleProduct(
  connection: Connection,
  shmemProgramId: PublicKey,
  payer: Keypair,
  productAccount: PublicKey,
  priceAccount: PublicKey,
  productBin: Buffer = oracleProductBin()
) {
  // check out the `crate::models::pyth::Product` struct, we are targeting the
  // `px_acc` field here
  const offset = 16;
  productBin.set(priceAccount.toBytes(), offset);
  await shmemOverwrite(
    connection,
    shmemProgramId,
    payer,
    productAccount,
    productBin
  );
}

export async function uploadOraclePrice(
  connection: Connection,
  shmemProgramId: PublicKey,
  payer: Keypair,
  priceAccount: PublicKey,
  slot: number,
  priceBin: Buffer = oraclePriceBin()
) {
  setOraclePriceBinSlot(priceBin, slot);
  await shmemOverwrite(
    connection,
    shmemProgramId,
    payer,
    priceAccount,
    priceBin
  );
}

export async function setOraclePriceSlot(
  connection: Connection,
  shmemProgramId: PublicKey,
  payer: Keypair,
  priceAccount: PublicKey,
  slot: number
) {
  await shmemSet(
    connection,
    shmemProgramId,
    payer,
    priceAccount,
    oraclePriceBinValidSlotOffset,
    numberToU64(slot)
  );
}

export async function setOraclePrice(
  connection: Connection,
  shmemProgramId: PublicKey,
  payer: Keypair,
  priceAccount: PublicKey,
  price: number
) {
  // check out the `crate::models::pyth::Price` struct, we are targeting the
  // `agg` field here
  const oraclePriceBinAggOffset = 208;
  await shmemSet(
    connection,
    shmemProgramId,
    payer,
    priceAccount,
    oraclePriceBinAggOffset,
    numberToU64(price)
  );
}

async function shmemOverwrite(
  connection: Connection,
  shmemProgramId: PublicKey,
  payer: Keypair,
  account: PublicKey,
  data: Buffer
) {
  const MAX_DATA_SIZE_PER_TRANSACTION = 1000;

  const transactions = Math.floor(
    data.byteLength / MAX_DATA_SIZE_PER_TRANSACTION
  );

  for (let i = 0; i < transactions; i++) {
    // let offset: u64 = ...;
    // tells the shmem at what point to write the data, which allows us to
    // split big uploads to several transactions
    const offset = i * MAX_DATA_SIZE_PER_TRANSACTION;
    const transactionData = data.slice(
      offset,
      Math.min(offset + MAX_DATA_SIZE_PER_TRANSACTION, data.byteLength)
    );

    await shmemSet(
      connection,
      shmemProgramId,
      payer,
      account,
      offset,
      transactionData
    );
  }
}

async function shmemSet(
  connection: Connection,
  shmemProgramId: PublicKey,
  payer: Keypair,
  account: PublicKey,
  offset: number,
  data: Buffer
) {
  const tx = new Transaction();
  tx.add({
    keys: [
      {
        pubkey: account,
        isSigner: false,
        isWritable: true,
      },
    ],
    programId: shmemProgramId,
    data: Buffer.concat([numberToU64(offset), data]),
  });

  await connection.sendTransaction(tx, [payer]);
}

// check out the `crate::models::pyth::Price` struct, we are targeting the
// `valid_slot` field here
const oraclePriceBinValidSlotOffset = 40;
function setOraclePriceBinSlot(bin: Buffer, slot: number) {
  bin.set(numberToU64(slot), oraclePriceBinValidSlotOffset);
}
