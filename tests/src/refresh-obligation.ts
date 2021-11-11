import { Program, Provider } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  Keypair,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";
import { expect } from "chai";
import { initLendingMarket } from "./init-lending-market";
import { CaptureStdoutAndStderr, u192ToBN, waitForCommit } from "./helpers";
import { initObligationR10 } from "./init-obligation";
import { refreshReserveInstruction } from "./refresh-reserve";

export function test(
  program: Program<BorrowLending>,
  provider: Provider,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("refresh_obligation", () => {
    const market = Keypair.generate();
    const borrower = Keypair.generate();
    const obligation = Keypair.generate();

    before("initialize lending market", async () => {
      await initLendingMarket(program, owner, market, shmemProgramId);
      await waitForCommit();
    });

    before("initialize obligation", async () => {
      await initObligationR10(program, borrower, market.publicKey, obligation);
      await waitForCommit();
    });

    it("refreshes empty obligation", async () => {
      const obligationInfo = await refreshObligation(
        program,
        provider,
        obligation.publicKey,
        []
      );
      expect(obligationInfo.lastUpdate.stale).to.be.false;
    });

    // TODO: we can add these tests once we can deposit collateral
    it("fails if deposited collateral account is missing");
    it("refreshes collateral market value");

    // TODO: we can add these tests once we can deposit liquidity
    it("fails if deposited liquidity account is missing");
    it("refreshes liquidity market value and accrues interest");
  });
}

export async function refreshObligation(
  program: Program<BorrowLending>,
  provider: Provider,
  obligation: PublicKey,
  reserves: Array<{ pubkey: PublicKey; oraclePrice: PublicKey }>
) {
  const tx = new Transaction();
  tx.add(refreshObligationInstruction(program, obligation, reserves));
  await provider.send(tx);

  return program.account.obligation.fetch(obligation);
}

export function refreshObligationInstruction(
  program: Program<BorrowLending>,
  obligation: PublicKey,
  reserves: Array<{ pubkey: PublicKey; oraclePrice: PublicKey }>
): TransactionInstruction {
  return program.instruction.refreshObligation({
    accounts: {
      obligation,
      clock: SYSVAR_CLOCK_PUBKEY,
    },
    remainingAccounts: reserves.map(({ pubkey }) => ({
      pubkey,
      isSigner: false,
      isWritable: false,
    })),
    instructions: reserves.map(({ pubkey, oraclePrice }) =>
      refreshReserveInstruction(program, pubkey, oraclePrice)
    ),
  });
}
