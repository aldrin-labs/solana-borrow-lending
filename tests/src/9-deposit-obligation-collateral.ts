import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { CaptureStdoutAndStderr, u192ToBN } from "./helpers";
import { LendingMarket } from "./lending-market";
import { Obligation } from "./obligation";
import { Reserve } from "./reserve";

export function test(
  program: Program<BorrowLending>,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("deposit_obligation_collateral", () => {
    let sourceCollateralWalletAmount = 30;
    let market: LendingMarket,
      obligation: Obligation,
      reserve: Reserve,
      sourceCollateralWallet: PublicKey;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner, shmemProgramId);
    });

    before("initialize obligation", async () => {
      reserve = await market.addReserve(50);
    });

    before("initialize obligation", async () => {
      obligation = await market.addObligation();
    });

    before("mint reserve collateral for borrower", async () => {
      sourceCollateralWallet =
        await reserve.createCollateralWalletWithCollateral(
          obligation.borrower.publicKey,
          sourceCollateralWalletAmount
        );
    });

    beforeEach("refresh oracle slot validity", async () => {
      await reserve.refreshOraclePrice(10);
    });

    it("fails if borrower doesn't match obligation owner", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const originalBorrower = obligation.borrower;
      obligation.borrower = Keypair.generate();

      await expect(
        obligation.depositCollateral(reserve, sourceCollateralWallet, 10)
      ).to.be.rejected;

      obligation.borrower = originalBorrower;

      expect(stdCapture.restore()).to.contain("owner is not allowed");
    });

    it("fails if obligation and reserve market mismatch", async () => {
      const differentMarket = await LendingMarket.init(
        program,
        owner,
        shmemProgramId
      );
      const differentMarketObligation = await differentMarket.addObligation();

      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        differentMarketObligation.depositCollateral(
          reserve,
          sourceCollateralWallet,
          10
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "must belong to the same lending market"
      );
    });

    it("fails if reserve is stale", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const refreshReserve = false;
      await expect(
        obligation.depositCollateral(
          reserve,
          sourceCollateralWallet,
          10,
          refreshReserve
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("[ReserveStale]");
    });

    it("fails if loan to value ratio is zero", async () => {
      const config = Reserve.defaultConfig();
      config.conf.loanToValueRatio.percent = 0;

      const differentReserve = await market.addReserve(10, config);

      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.depositCollateral(
          differentReserve,
          sourceCollateralWallet,
          10
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("not be used as a collateral");
    });

    it("fails if destination wallet equals source wallet", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.depositCollateral(
          reserve,
          reserve.accounts.reserveCollateralWallet.publicKey,
          10
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Destination wallet musn't equal source wallet"
      );
    });

    it("fails if destination wallet doesn't match supply wallet", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      // temporarily use a wrong settings which will not match the data stored
      // in the reserve account, but remember the correct settings so that we
      // can restore to it after the test
      const originalReserveCollateralWallet =
        reserve.accounts.reserveCollateralWallet;
      reserve.accounts.reserveCollateralWallet = Keypair.generate();

      await expect(
        obligation.depositCollateral(reserve, sourceCollateralWallet, 10)
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Dest. wallet must match reserve config collateral supply"
      );

      // restore the original settings
      reserve.accounts.reserveCollateralWallet =
        originalReserveCollateralWallet;
    });

    it("fails if collateral amount is zero", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.depositCollateral(reserve, sourceCollateralWallet, 0)
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Collateral amount to deposit mustn't be zero"
      );
    });

    it("fails if borrower doesn't have enough collateral", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.depositCollateral(reserve, sourceCollateralWallet, 1000)
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("insufficient funds");
    });

    it("fails if borrower isn't signer", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const sign = false;
      await expect(
        obligation.depositCollateral(
          reserve,
          sourceCollateralWallet,
          10,
          true,
          sign
        )
      ).to.be.rejected;

      stdCapture.restore();
    });

    it("deposits collateral", async () => {
      await obligation.depositCollateral(reserve, sourceCollateralWallet, 10);
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
      expect(u192ToBN(obligationInfo.borrowedValue).toNumber()).to.eq(0);
      expect(u192ToBN(obligationInfo.depositedValue).toNumber()).to.eq(0);
      expect(u192ToBN(obligationInfo.allowedBorrowValue).toNumber()).to.eq(0);
      expect(u192ToBN(obligationInfo.unhealthyBorrowValue).toNumber()).to.eq(0);
    });
  });
}
