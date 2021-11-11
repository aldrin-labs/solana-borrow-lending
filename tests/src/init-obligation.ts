import { Program, Provider } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { PublicKey, Keypair, SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";
import { expect } from "chai";
import { initLendingMarket } from "./init-lending-market";
import { CaptureStdoutAndStderr, u192ToBN, waitForCommit } from "./helpers";

export function test(
  program: Program<BorrowLending>,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("init_obligation", () => {
    const market = Keypair.generate();

    before("initialize lending market", async () => {
      await initLendingMarket(program, owner, market, shmemProgramId);
      await waitForCommit();
    });

    it("fails if lending market doesn't exist", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const obligation = Keypair.generate();
      const nonExistingMarket = Keypair.generate();

      await expect(
        initObligationR10(
          program,
          owner,
          nonExistingMarket.publicKey,
          obligation
        )
      ).to.be.rejected;

      stdCapture.restore();
    });

    it("initializes obligation accounts", async () => {
      const obligation = Keypair.generate();

      const obligationInfo = await initObligationR10(
        program,
        owner,
        market.publicKey,
        obligation
      );

      expect(obligationInfo.reserves).to.deep.eq(
        new Array(10).fill(undefined).map(() => ({ empty: {} }))
      );
      expect(obligationInfo.lastUpdate.stale).to.be.true;
      expect(obligationInfo.lendingMarket).to.deep.eq(market.publicKey);
      expect(obligationInfo.owner).to.deep.eq(owner.publicKey);
      expect(u192ToBN(obligationInfo.borrowedValue).toNumber()).to.eq(0);
      expect(u192ToBN(obligationInfo.depositedValue).toNumber()).to.eq(0);
      expect(u192ToBN(obligationInfo.allowedBorrowValue).toNumber()).to.eq(0);
      expect(u192ToBN(obligationInfo.unhealthyBorrowValue).toNumber()).to.eq(0);
    });
  });
}

export async function initObligationR10(
  program: Program<BorrowLending>,
  owner: Keypair,
  lendingMarket: PublicKey,
  obligation: Keypair
) {
  await program.rpc.initObligationR10({
    accounts: {
      owner: owner.publicKey,
      lendingMarket,
      obligation: obligation.publicKey,
      clock: SYSVAR_CLOCK_PUBKEY,
    },
    instructions: [
      await program.account.obligation.createInstruction(obligation),
    ],
    signers: [owner, obligation],
  });

  return program.account.obligation.fetch(obligation.publicKey);
}
