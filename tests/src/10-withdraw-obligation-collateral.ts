import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { LendingMarket } from "./lending-market";
import { Obligation } from "./obligation";
import { Reserve } from "./reserve";
import { CaptureStdoutAndStderr } from "./helpers";

export function test(
  program: Program<BorrowLending>,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("withdraw_obligation_collateral", () => {
    let sourceCollateralWalletAmount = 10;
    let market: LendingMarket,
      obligation: Obligation,
      reserve: Reserve,
      destinationCollateralWallet: PublicKey;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner, shmemProgramId);
    });

    before("initialize reserve", async () => {
      reserve = await market.addReserve(50);
    });

    before("initialize obligation", async () => {
      obligation = await market.addObligation();
    });

    before("gift reserve collateral to borrower and deposit it", async () => {
      const sourceCollateralWallet =
        await reserve.createCollateralWalletWithCollateral(
          obligation.borrower.publicKey,
          sourceCollateralWalletAmount
        );

      await obligation.depositCollateral(
        reserve,
        sourceCollateralWallet,
        sourceCollateralWalletAmount
      );
    });

    beforeEach("create destination collateral wallet", async () => {
      destinationCollateralWallet =
        await reserve.accounts.reserveCollateralMint.createAccount(
          obligation.borrower.publicKey
        );
    });

    beforeEach("refresh oracle slot validity", async () => {
      await reserve.refreshOraclePrice(10);
    });

    it("fails if no deposited collateral", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const emptyObligation = await market.addObligation();

      emptyObligation.reservesToRefresh.add(reserve);
      await expect(
        emptyObligation.withdrawCollateral(
          reserve,
          destinationCollateralWallet,
          10
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Obligation has no such reserve collateral"
      );
    });

    it("fails if instruction isn't signed", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const sign = false;
      await expect(
        obligation.withdrawCollateral(
          reserve,
          destinationCollateralWallet,
          10,
          true,
          true,
          sign
        )
      ).to.be.rejected;

      stdCapture.restore();
    });

    it("fails if obligation is stale", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const refreshObligation = false;
      await expect(
        obligation.withdrawCollateral(
          reserve,
          destinationCollateralWallet,
          10,
          true,
          refreshObligation
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("ObligationStale");
    });

    it("fails if reserve is stale", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const refreshReserve = false;
      await expect(
        obligation.withdrawCollateral(
          reserve,
          destinationCollateralWallet,
          10,
          refreshReserve
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("is stale");
    });

    it("fails if reserve's market doesn't match obligation's market", async () => {
      const differentMarket = await LendingMarket.init(
        program,
        owner,
        shmemProgramId
      );
      const differentObligation = await differentMarket.addObligation();

      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        differentObligation.withdrawCollateral(
          reserve,
          destinationCollateralWallet,
          10
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("LendingMarketMismatch");
    });

    it("fails if source collateral wallet doesn't match reserve's config", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const originalSourceCollateralWallet =
        reserve.accounts.reserveCollateralWallet;
      reserve.accounts.reserveCollateralWallet = Keypair.generate();

      await expect(
        obligation.withdrawCollateral(reserve, destinationCollateralWallet, 10)
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "[InvalidAccountInput] Source col. wallet must eq. reserve's col. supply"
      );

      reserve.accounts.reserveCollateralWallet = originalSourceCollateralWallet;
    });

    it("fails if destination collateral wallet equals the source one", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.withdrawCollateral(
          reserve,
          reserve.accounts.reserveCollateralWallet.publicKey,
          10
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "[InvalidAccountInput] Dest. col. wallet mustn't eq. reserve's col. supply"
      );
    });

    it("cannot withdraw zero collateral", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.withdrawCollateral(reserve, destinationCollateralWallet, 0)
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Collateral amount provided cannot be zero"
      );
    });

    it("withdraws half of collateral", async () => {
      await obligation.withdrawCollateral(
        reserve,
        destinationCollateralWallet,
        sourceCollateralWalletAmount / 2
      );
      sourceCollateralWalletAmount /= 2;

      const obligationInfo = await obligation.fetch();
      expect(obligationInfo.lastUpdate.stale).to.be.true;
      const obligationInfoReserve = (obligationInfo.reserves as any[]).shift()
        .collateral.inner;
      expect(obligationInfoReserve.depositReserve).to.deep.eq(reserve.id);
      expect(obligationInfoReserve.depositedAmount.toNumber()).to.eq(
        sourceCollateralWalletAmount
      );

      const destinationCollateralWalletInfo =
        await reserve.accounts.reserveCollateralMint.getAccountInfo(
          destinationCollateralWallet
        );
      expect(destinationCollateralWalletInfo.amount.toNumber()).to.eq(
        sourceCollateralWalletAmount
      );

      const reserveCollateralWalletInfo =
        await reserve.accounts.reserveCollateralMint.getAccountInfo(
          reserve.accounts.reserveCollateralWallet.publicKey
        );
      expect(reserveCollateralWalletInfo.amount.toNumber()).to.eq(
        sourceCollateralWalletAmount
      );
    });

    it("withdraws all collateral", async () => {
      await obligation.withdrawCollateral(
        reserve,
        destinationCollateralWallet,
        sourceCollateralWalletAmount * 10 // should withdraw at most what's in the account
      );
      const withdrawnAmount = sourceCollateralWalletAmount;
      sourceCollateralWalletAmount = 0;

      const obligationInfo = await obligation.fetch();
      expect(obligationInfo.lastUpdate.stale).to.be.true;
      expect(obligationInfo.reserves).to.deep.eq(
        new Array(10).fill(undefined).map(() => ({ empty: {} }))
      );

      const destinationCollateralWalletInfo =
        await reserve.accounts.reserveCollateralMint.getAccountInfo(
          destinationCollateralWallet
        );
      expect(destinationCollateralWalletInfo.amount.toNumber()).to.eq(
        withdrawnAmount
      );

      const reserveCollateralWalletInfo =
        await reserve.accounts.reserveCollateralMint.getAccountInfo(
          reserve.accounts.reserveCollateralWallet.publicKey
        );
      expect(reserveCollateralWalletInfo.amount.toNumber()).to.eq(
        sourceCollateralWalletAmount
      );

      // TODO: check reserve
    });

    // TODO: these tests can be added only when borrowing is implemented
    it("cannot withdraw collateral if borrowed lots of assets");
    it("withdraws collateral as long as enough remains to cover borrows");
  });
}
