import { PublicKey, Transaction, Keypair, Connection } from "@solana/web3.js";
import { numberToU64 } from "./helpers";

export async function uploadOracleProduct(
  connection: Connection,
  shmemProgramId: PublicKey,
  payer: Keypair,
  productAccount: PublicKey,
  priceAccount: PublicKey,
  productBin: Readonly<Buffer>
) {
  // check out the `crate::models::pyth::Product` struct, we are targeting the
  // `px_acc` field here
  const offset = 16;
  productBin.set(priceAccount.toBytes(), offset);
  await shmemUpload(
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
  priceBin: Buffer
) {
  // check out the `crate::models::pyth::Price` struct, we are targeting the
  // `valid_slot` field here
  const offset = 40;
  priceBin.set(numberToU64(slot), offset);
  await shmemUpload(connection, shmemProgramId, payer, priceAccount, priceBin);
}

async function shmemUpload(
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
      data: Buffer.concat([numberToU64(offset), transactionData]),
    });

    await connection.sendTransaction(tx, [payer]);
  }
}
