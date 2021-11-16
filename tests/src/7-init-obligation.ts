import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { CaptureStdoutAndStderr, u192ToBN } from "./helpers";
import { LendingMarket } from "./lending-market";

export function test(
  program: Program<BorrowLending>,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("init_obligation", () => {
    let market: LendingMarket;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner, shmemProgramId);
    });

    it("fails if lending market doesn't exist", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const originalMarket = market.account;
      market.account = Keypair.generate();

      await expect(market.addObligation()).to.be.rejected;

      market.account = originalMarket;

      stdCapture.restore();
    });

    it("initializes obligation accounts", async () => {
      const obligation = await market.addObligation();

      const obligationInfo = await obligation.fetch();

      expect(obligationInfo.reserves).to.deep.eq(
        new Array(10).fill(undefined).map(() => ({ empty: {} }))
      );
      expect(obligationInfo.lastUpdate.stale).to.be.true;
      expect(obligationInfo.lendingMarket).to.deep.eq(market.id);
      expect(obligationInfo.owner).to.deep.eq(obligation.borrower.publicKey);
      expect(u192ToBN(obligationInfo.borrowedValue).toNumber()).to.eq(0);
      expect(u192ToBN(obligationInfo.depositedValue).toNumber()).to.eq(0);
      expect(u192ToBN(obligationInfo.allowedBorrowValue).toNumber()).to.eq(0);
      expect(u192ToBN(obligationInfo.unhealthyBorrowValue).toNumber()).to.eq(0);
    });
  });
}
