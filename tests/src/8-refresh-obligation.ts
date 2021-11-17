import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { waitForCommit } from "./helpers";
import { LendingMarket } from "./lending-market";
import { Obligation } from "./obligation";

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

    it(
      "has a maximum number of reserves which can be refreshed in a single transaction"
    );

    // TODO: we can add these tests once we can deposit collateral
    it("fails if deposited collateral account is missing");
    it("refreshes collateral market value");

    // TODO: we can add these tests once we can deposit liquidity
    it("fails if deposited liquidity account is missing");
    it("refreshes liquidity market value and accrues interest");
  });
}
