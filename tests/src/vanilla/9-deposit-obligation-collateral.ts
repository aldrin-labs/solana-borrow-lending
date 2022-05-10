import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../../target/types/borrow_lending";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { CaptureStdoutAndStderr, u192ToBN } from "../helpers";
import { LendingMarket } from "../lending-market";
import { Obligation } from "../obligation";
import { Reserve } from "../reserve";
import { globalContainer } from "../global-container";

export function test(owner: Keypair) {
  const program: Program<BorrowLending> = globalContainer.blp;
  describe("deposit_obligation_collateral", () => {
    let sourceCollateralWalletAmount = 30;
    let market: LendingMarket,
      obligation: Obligation,
      reserve: Reserve,
      sourceCollateralWallet: PublicKey;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner);
    });

    before("initialize reserve", async () => {
      reserve = await market.addReserve(50);
      await reserve.refreshOraclePrice(999);
    });

    before("initialize obligation", async () => {
      obligation = await market.addObligation();
    });

    before("gift reserve collateral to borrower", async () => {
      sourceCollateralWallet =
        await reserve.createCollateralWalletWithCollateral(
          obligation.borrower.publicKey,
          sourceCollateralWalletAmount
        );
    });

    it("fails if borrower doesn't match obligation owner", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const originalBorrower = obligation.borrower;
      obligation.borrower = Keypair.generate();

      await expect(obligation.deposit(reserve, sourceCollateralWallet, 10)).to
        .be.rejected;

      obligation.borrower = originalBorrower;

      expect(stdCapture.restore()).to.contain("IllegalOwner");
    });

    it("fails if obligation and reserve market mismatch", async () => {
      const differentMarket = await LendingMarket.init(program, owner);
      const differentMarketObligation = await differentMarket.addObligation();

      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        differentMarketObligation.deposit(reserve, sourceCollateralWallet, 10)
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "must belong to the same lending market"
      );
    });

    it("fails if loan to value ratio is zero", async () => {
      const config = Reserve.defaultConfig();
      config.conf.loanToValueRatio.percent = 0;

      const differentReserve = await market.addReserve(10, config);

      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.deposit(differentReserve, sourceCollateralWallet, 10)
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("not be used as a collateral");
    });

    it("fails if destination wallet equals source wallet", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.deposit(
          reserve,
          reserve.accounts.reserveCollateralWallet.publicKey,
          10
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Destination wallet musn't equal source wallet"
      );
    });

    it("fails if token program mismatches reserve", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.deposit(reserve, sourceCollateralWallet, 10, {
          tokenProgram: Keypair.generate().publicKey,
        })
      ).to.be.rejected;

      stdCapture.restore();
    });

    it("fails if destination wallet doesn't match supply wallet", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      // temporarily use a wrong settings which will not match the data stored
      // in the reserve account, but remember the correct settings so that we
      // can restore to it after the test
      const originalReserveCollateralWallet =
        reserve.accounts.reserveCollateralWallet;
      reserve.accounts.reserveCollateralWallet = Keypair.generate();

      await expect(obligation.deposit(reserve, sourceCollateralWallet, 10)).to
        .be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Dest. wallet must match reserve config collateral supply"
      );

      // restore the original settings
      reserve.accounts.reserveCollateralWallet =
        originalReserveCollateralWallet;
    });

    it("fails if collateral amount is zero", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(obligation.deposit(reserve, sourceCollateralWallet, 0)).to.be
        .rejected;

      expect(stdCapture.restore()).to.contain(
        "Collateral amount to deposit mustn't be zero"
      );
    });

    it("fails if borrower doesn't have enough collateral", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(obligation.deposit(reserve, sourceCollateralWallet, 1000)).to
        .be.rejected;

      expect(stdCapture.restore()).to.contain("insufficient funds");
    });

    it("fails if borrower isn't signer", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.deposit(reserve, sourceCollateralWallet, 10, { sign: false })
      ).to.be.rejected;

      stdCapture.restore();
    });

    it("deposits collateral", async () => {
      await obligation.deposit(reserve, sourceCollateralWallet, 10);
      sourceCollateralWalletAmount -= 10;

      const obligationInfo = await obligation.fetch();
      expect(obligationInfo.lastUpdate.stale).to.be.true;

      const reserves = obligationInfo.reserves as any[];
      const newCollateral = reserves.shift().collateral.inner;
      expect(reserves).to.deep.eq(
        new Array(9).fill(undefined).map(() => ({ empty: {} }))
      );

      expect(newCollateral.depositReserve).to.deep.eq(reserve.id);
      expect(newCollateral.depositedAmount.toNumber()).to.eq(10);

      // we need to refresh the obligation for these values to recalculate
      expect(u192ToBN(newCollateral.marketValue).toNumber()).to.eq(0);
      expect(
        u192ToBN(obligationInfo.collateralizedBorrowedValue).toNumber()
      ).to.eq(0);
      expect(u192ToBN(obligationInfo.totalBorrowedValue).toNumber()).to.eq(0);
      expect(u192ToBN(obligationInfo.depositedValue).toNumber()).to.eq(0);
      expect(u192ToBN(obligationInfo.allowedBorrowValue).toNumber()).to.eq(0);
      expect(u192ToBN(obligationInfo.unhealthyBorrowValue).toNumber()).to.eq(0);
    });
  });
}
