import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { waitForCommit } from "./helpers";
import { LendingMarket } from "./lending-market";
import { Obligation } from "./obligation";
import { Reserve } from "./reserve";

export function test(
  program: Program<BorrowLending>,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("refresh_obligation", () => {
    let market: LendingMarket, obligation: Obligation;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner, shmemProgramId);
    });

    before("initialize obligation", async () => {
      obligation = await market.addObligation();
      await waitForCommit();
    });

    it("refreshes empty obligation", async () => {
      await obligation.refresh([]);
      const obligationInfo = await obligation.fetch();
      expect(obligationInfo.lastUpdate.stale).to.be.false;
    });

    it("can refresh at least 4 reserves and an obligation", async () => {
      // gives us enough time to not have to deal with oracle price expiry
      const intoFuture = 500;

      const reserves: Reserve[] = [];
      for (let i = 0; i < 2; i++) {
        reserves.push(
          ...(await Promise.all([market.addReserve(10), market.addReserve(10)]))
        );
      }

      await Promise.all(reserves.map((r) => r.refreshOraclePrice(intoFuture)));
      await waitForCommit();

      await obligation.refresh(reserves);
      expect(reserves).to.be.lengthOf(4);
    });

    // TODO: we can add these tests once we can deposit collateral
    it("fails if deposited collateral account is missing");
    it("refreshes collateral market value");

    // TODO: we can add these tests once we can deposit liquidity
    it("fails if deposited liquidity account is missing");
    it("refreshes liquidity market value and accrues interest");
  });
}
