import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { LendingMarket } from "./lending-market";

export function test(program: Program<BorrowLending>) {
  describe("init_lending_market", () => {
    it("with USD", async () => {
      const owner = Keypair.generate();
      const oracle = Keypair.generate();

      const market = await LendingMarket.init(
        program,
        owner,
        oracle.publicKey,
        program.programId
      );

      const marketInfo = await market.fetch();
      expect(marketInfo.currency).to.deep.eq({ usd: {} });
      expect(marketInfo.owner).to.deep.eq(owner.publicKey);
      expect(marketInfo.adminBot).to.deep.eq(owner.publicKey);
      expect(marketInfo.aldrinAmm).to.deep.eq(program.programId);
    });

    it("with pubkey", async () => {
      const owner = Keypair.generate();
      const oracle = Keypair.generate();
      const currency = Keypair.generate();

      const market = await LendingMarket.init(
        program,
        owner,
        oracle.publicKey,
        program.programId,
        currency.publicKey
      );

      const marketInfo = await market.fetch();
      expect(marketInfo.currency).to.deep.eq({
        pubkey: { address: currency.publicKey },
      });
      expect(marketInfo.owner).to.deep.eq(owner.publicKey);
      expect(marketInfo.adminBot).to.deep.eq(owner.publicKey);
      expect(marketInfo.aldrinAmm).to.deep.eq(program.programId);
    });
  });
}
