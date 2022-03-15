import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../../target/types/borrow_lending";
import { Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { CaptureStdoutAndStderr } from "../helpers";
import { LendingMarket } from "../lending-market";

export function test(program: Program<BorrowLending>) {
  describe("set_lending_market_owner", () => {
    const oracle = Keypair.generate();
    const owner = Keypair.generate();
    let market: LendingMarket;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner, oracle.publicKey);
    });

    it("sets new lending market owner", async () => {
      const newOwner = Keypair.generate();

      await market.setOwner(newOwner);
      const marketInfo = await market.fetch();
      expect(marketInfo.owner).to.deep.eq(newOwner.publicKey);
    });

    it("cannot set new lending market owner if not current owner", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const wrongOwner = Keypair.generate();
      market.owner = wrongOwner;

      const newOwner = Keypair.generate();
      await expect(market.setOwner(newOwner)).to.be.rejected;

      stdCapture.restore();
    });
  });
}
