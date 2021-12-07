import { BN } from "@project-serum/anchor";
import {
  SystemProgram,
  Transaction,
  Keypair,
  PublicKey,
  Connection,
  TransactionInstruction,
} from "@solana/web3.js";
import { expect } from "chai";

export type PercentInt = { percent: number };

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

export type U192 = [BN, BN, BN];
export const ONE_WAD = new BN(10).pow(new BN(18));

export function numberToU192(n: number): U192 {
  if (n < 0) {
    throw new Error("u192 is unsigned, number cannot be less than zero");
  }

  const wad = n < 1 ? ONE_WAD.div(new BN(1 / n)) : ONE_WAD.mul(new BN(n));
  const bytes = wad.toArray("le", 3 * 8); // 3 * u64

  const nextU64 = () => new BN(bytes.splice(0, 8), "le");
  return [nextU64(), nextU64(), nextU64()];
}

export function u192ToBN(u192: U192 | BN[] | { u192: U192 | BN[] }): BN {
  // flatten the input
  u192 = Array.isArray(u192) ? u192 : u192.u192;

  if (u192.length !== 3) {
    throw new Error("u192 must have exactly 3 u64 BN");
  }

  const ordering = "le";
  return new BN(
    [
      ...u192[0].toArray(ordering, 8),
      ...u192[1].toArray(ordering, 8),
      ...u192[2].toArray(ordering, 8),
    ],
    ordering
  );
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

export function assertOrderedAsc(a: Array<{ u192: BN[] | U192 }>) {
  a.reduce((prev, curr, i) => {
    const n = u192ToBN(curr);
    expect(n.gt(prev), `Item at index ${i} is not larger than previous`);
    return n;
  }, u192ToBN(a.shift()));
}
