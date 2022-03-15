import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../../target/types/borrow_lending";
import { Keypair } from "@solana/web3.js";
import { expect } from "chai";
import {
  assertOrderedAsc,
  CaptureStdoutAndStderr,
  waitForCommit,
} from "../helpers";
import { LendingMarket } from "../lending-market";
import { Obligation } from "../obligation";
import { Reserve } from "../reserve";
import { globalContainer } from "../globalContainer";

export function test(owner: Keypair) {
  const program: Program<BorrowLending> = globalContainer.blp;
  describe("refresh_obligation", () => {
    let market: LendingMarket, obligation: Obligation, reserve: Reserve;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner);
    });

    beforeEach("initialize reserve", async () => {
      reserve = await market.addReserve(50);
    });

    beforeEach("initialize obligation", async () => {
      obligation = await market.addObligation();
    });

    beforeEach("refresh oracle slot validity", async () => {
      await reserve.refreshOraclePrice(999);
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

    it("fails if deposited collateral reserve is missing", async () => {
      await deposit();

      const stdCapture = new CaptureStdoutAndStderr();

      obligation.reservesToRefresh.delete(reserve);
      await expect(obligation.refresh()).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        `No valid account provided for reserve \'${reserve.id}\'`
      );
    });

    it("refreshes collateral market value", async () => {
      await deposit();

      const oldObligationInfo = await obligation.fetch();
      await obligation.refresh();
      const obligationInfo = await obligation.fetch();

      assertOrderedAsc([
        oldObligationInfo.depositedValue,
        obligationInfo.depositedValue,
      ]);
      assertOrderedAsc([
        oldObligationInfo.allowedBorrowValue,
        obligationInfo.allowedBorrowValue,
      ]);
      assertOrderedAsc([
        oldObligationInfo.unhealthyBorrowValue,
        obligationInfo.unhealthyBorrowValue,
      ]);
      assertOrderedAsc([
        oldObligationInfo.reserves[0].collateral.inner.marketValue,
        obligationInfo.reserves[0].collateral.inner.marketValue,
      ]);
    });

    it("fails if borrowed liquidity account is missing", async () => {
      await deposit();
      const borrowReserve = await borrow();

      const stdCapture = new CaptureStdoutAndStderr();

      obligation.reservesToRefresh.delete(borrowReserve);
      await expect(obligation.refresh()).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        `No valid account provided for reserve \'${borrowReserve.id}\'`
      );
    });

    it("refreshes liquidity market value and accrues interest", async () => {
      await deposit();
      await borrow();

      const oldObligationInfo = await obligation.fetch();
      expect(oldObligationInfo.reserves[1]).to.have.property("liquidity");
      await obligation.refresh();
      const obligationInfo = await obligation.fetch();
      expect(obligationInfo.reserves[1]).to.have.property("liquidity");
      await new Promise((r) => setTimeout(r, 500)); // accrues interest
      await obligation.refresh();
      const latestObligationInfo = await obligation.fetch();
      expect(latestObligationInfo.reserves[1]).to.have.property("liquidity");

      assertOrderedAsc([
        oldObligationInfo.totalBorrowedValue,
        obligationInfo.totalBorrowedValue,
        latestObligationInfo.totalBorrowedValue,
      ]);
      assertOrderedAsc([
        oldObligationInfo.collateralizedBorrowedValue,
        obligationInfo.collateralizedBorrowedValue,
        latestObligationInfo.collateralizedBorrowedValue,
      ]);
      assertOrderedAsc([
        oldObligationInfo.reserves[1].liquidity.inner.cumulativeBorrowRate,
        obligationInfo.reserves[1].liquidity.inner.cumulativeBorrowRate,
        latestObligationInfo.reserves[1].liquidity.inner.cumulativeBorrowRate,
      ]);
      assertOrderedAsc([
        oldObligationInfo.reserves[1].liquidity.inner.borrowedAmount,
        obligationInfo.reserves[1].liquidity.inner.borrowedAmount,
        latestObligationInfo.reserves[1].liquidity.inner.borrowedAmount,
      ]);
      assertOrderedAsc([
        oldObligationInfo.reserves[1].liquidity.inner.marketValue,
        obligationInfo.reserves[1].liquidity.inner.marketValue,
        latestObligationInfo.reserves[1].liquidity.inner.marketValue,
      ]);
    });

    async function deposit() {
      const sourceCollateralWallet =
        await reserve.createCollateralWalletWithCollateral(
          obligation.borrower.publicKey,
          100
        );

      await obligation.deposit(reserve, sourceCollateralWallet, 100);
    }

    async function borrow(): Promise<Reserve> {
      const borrowReserve = await market.addReserve(200);
      await borrowReserve.refreshOraclePrice(100);
      await waitForCommit();

      const destLiquidityWallet =
        await borrowReserve.accounts.liquidityMint.createAccount(
          obligation.borrower.publicKey
        );
      await obligation.borrow(borrowReserve, destLiquidityWallet, 10);

      return borrowReserve;
    }
  });
}
