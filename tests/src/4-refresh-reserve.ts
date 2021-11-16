import { Program, Provider } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { CaptureStdoutAndStderr, u192ToBN, waitForCommit } from "./helpers";
import { LendingMarket } from "./lending-market";
import { Reserve } from "./reserve";

export function test(
  program: Program<BorrowLending>,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("refresh_reserve", () => {
    const liquidityAmount = 50;

    let market: LendingMarket, reserve: Reserve;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner, shmemProgramId);
    });

    before("initialize reserve", async () => {
      reserve = await market.addReserve(liquidityAmount);
      await waitForCommit();
    });

    it("fails if oracle price accounts mismatch", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const originalOraclePrice = reserve.accounts.oraclePrice;
      reserve.accounts.oraclePrice = Keypair.generate();

      await expect(reserve.refresh()).to.be.rejected;

      reserve.accounts.oraclePrice = originalOraclePrice;

      stdCapture.restore();
    });

    it("fails if oracle price is outdated", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await reserve.refreshOraclePrice(-10); // put it into the past
      await waitForCommit();

      await expect(reserve.refresh()).to.be.rejected;

      expect(stdCapture.restore()).to.contain("is stale");
    });

    it("refreshes reserve last updated and accrues interest", async () => {
      const reserveInfoBeforeRefresh = await reserve.fetch();
      const initialCumulativeBorrowRate = u192ToBN(
        reserveInfoBeforeRefresh.liquidity.cumulativeBorrowRate
      );
      const initialBorrowedAmount = u192ToBN(
        reserveInfoBeforeRefresh.liquidity.borrowedAmount
      );

      reserve.refreshOraclePrice(2);
      await waitForCommit();

      await reserve.refresh();
      const reserveInfo = await reserve.fetch();

      const currentSlot = await market.connection.getSlot();
      expect(reserveInfo.lastUpdate.stale).to.be.false;
      expect(reserveInfo.lastUpdate.slot.toNumber())
        .to.be.greaterThanOrEqual(currentSlot - 2)
        .and.lessThanOrEqual(currentSlot); // should be very fresh

      // this starts at 1, so even though nothing is borrowed, it's growing
      const cumulativeBorrowRateWithAccruedInterest = u192ToBN(
        reserveInfo.liquidity.cumulativeBorrowRate
      );
      expect(
        cumulativeBorrowRateWithAccruedInterest.gt(initialCumulativeBorrowRate)
      ).to.be.true;

      // nothing is borrowed in this test
      const borrowedAmountWithAccruedInterest = u192ToBN(
        reserveInfo.liquidity.borrowedAmount
      );
      expect(borrowedAmountWithAccruedInterest.eq(initialBorrowedAmount)).to.be
        .true;
    });
  });
}
