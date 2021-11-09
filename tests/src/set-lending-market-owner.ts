import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { initLendingMarket } from "./init-lending-market";
import { CaptureStdoutAndStderr } from "./helpers";

export function test(program: Program<BorrowLending>) {
  describe("set_lending_market_owner", () => {
    const oracle = Keypair.generate();
    const owner = Keypair.generate();
    const market = Keypair.generate();

    before("initialize lending market", async () => {
      await initLendingMarket(program, owner, market, oracle.publicKey);
    });

    it("sets new lending market owner", async () => {
      const newOwner = Keypair.generate();

      await setLendingMarketOwner(program, owner, market, newOwner.publicKey);
      const marketInfo = await program.account.lendingMarket.fetch(
        market.publicKey
      );
      expect(marketInfo.owner).to.deep.eq(newOwner.publicKey);
    });

    it("cannot set new lending market owner if not current owner", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const wrongOwner = Keypair.generate();
      const newOwner = Keypair.generate();

      await expect(
        setLendingMarketOwner(program, wrongOwner, market, newOwner.publicKey)
      ).to.eventually.be.rejected;

      stdCapture.restore();
    });
  });
}

export async function setLendingMarketOwner(
  program: Program<BorrowLending>,
  currentOwner: Keypair,
  market: Keypair,
  newOwner: PublicKey
) {
  await program.rpc.setLendingMarketOwner({
    accounts: {
      owner: currentOwner.publicKey,
      lendingMarket: market.publicKey,
      newOwner: newOwner,
    },
    signers: [currentOwner],
  });
}
