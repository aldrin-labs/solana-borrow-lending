import { BN } from "@project-serum/anchor";
import {
  SystemProgram,
  Transaction,
  Keypair,
  PublicKey,
  Connection,
  TransactionInstruction,
} from "@solana/web3.js";

export class CaptureStdoutAndStderr {
  private data: string = "";

  private originalConsoleMethods: [() => void, () => void];

  constructor() {
    this.originalConsoleMethods = [console.log, console.error];

    const capture = (...data) => (this.data += JSON.stringify(data) + "\n");
    console.log = console.error = capture;
  }

  public restore(): string {
    console.log = this.originalConsoleMethods[0];
    console.error = this.originalConsoleMethods[1];

    return this.data;
  }
}

export function numberToWad(n: number): [BN, BN, BN] {
  // TODO
  const WAD = 1_000_000_000_000_000_000;
  return [new BN(0), new BN(0), new BN(0)];
}

export function numberToU64(n: number): Buffer {
  return Buffer.from(new BN(n).toArray("le", 8));
}

/**
 * Use this timeout when you want to chain transactions. Otherwise your program
 * might not see the latest state.
 */
export async function waitForCommit() {
  await new Promise((r) => setTimeout(r, 500));
}

export async function createProgramAccounts(
  connection: Connection,
  programId: PublicKey,
  payer: Keypair,
  accounts: Array<{ keypair: Keypair; space: number }>
) {
  async function createAccountInstruction(
    address: PublicKey,
    space: number
  ): Promise<TransactionInstruction> {
    return SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: address,
      lamports: await connection.getMinimumBalanceForRentExemption(space),
      space,
      programId,
    });
  }

  const tx = new Transaction();
  tx.add(
    ...(await Promise.all(
      accounts.map((acc) => {
        return createAccountInstruction(acc.keypair.publicKey, acc.space);
      })
    ))
  );
  await connection.sendTransaction(tx, [
    payer,
    ...accounts.map((acc) => acc.keypair),
  ]);
}
