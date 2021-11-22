import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { LendingMarket } from "./lending-market";
import { Reserve } from "./reserve";
import { Obligation } from "./obligation";
import { CaptureStdoutAndStderr, u192ToBN, waitForCommit } from "./helpers";

export function test(
  program: Program<BorrowLending>,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("borrow_obligation_liquidity", () => {
    let sourceDogeLiquidity = 500;
    let depositedSrmCollateralAmount = 50;
    let market: LendingMarket,
      obligation: Obligation,
      reserveSrm: Reserve,
      reserveDoge: Reserve,
      destinationDogeLiquidityWallet: PublicKey,
      hostFeeReceiver: PublicKey;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner, shmemProgramId);
    });

    before("initialize reserves", async () => {
      reserveSrm = await market.addReserve(50, undefined, "srm");
      reserveDoge = await market.addReserve(
        sourceDogeLiquidity,
        undefined,
        "doge"
      );
    });

    before("initialize obligation", async () => {
      obligation = await market.addObligation();
    });

    before(
      "gift reserve SRM collateral to borrower and deposit it",
      async () => {
        const sourceCollateralWallet =
          await reserveSrm.createCollateralWalletWithCollateral(
            obligation.borrower.publicKey,
            depositedSrmCollateralAmount
          );

        await obligation.depositCollateral(
          reserveSrm,
          sourceCollateralWallet,
          depositedSrmCollateralAmount
        );
      }
    );

    beforeEach("create destination liquidity wallet", async () => {
      destinationDogeLiquidityWallet =
        await reserveDoge.accounts.liquidityMint.createAccount(
          obligation.borrower.publicKey
        );
    });

    beforeEach("create host fee receiver", async () => {
      hostFeeReceiver = await reserveDoge.accounts.liquidityMint.createAccount(
        obligation.borrower.publicKey
      );
    });

    beforeEach("assert enough assets to borrow", () => {
      expect(sourceDogeLiquidity).to.be.greaterThan(0);
    });

    beforeEach("refresh oracle slot validity", async () => {
      await reserveDoge.refreshOraclePrice(15);
      await reserveSrm.refreshOraclePrice(15);
      await waitForCommit();
    });

    it("cannot borrow more than allowed value of liquidity", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.borrow(reserveDoge, 300, destinationDogeLiquidityWallet)
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "cannot exceed maximum borrow value"
      );
    });

    it("fails if borrower is not signed", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const sign = false;
      const refresh = true;
      await expect(
        obligation.borrow(
          reserveDoge,
          10,
          destinationDogeLiquidityWallet,
          undefined,
          refresh,
          refresh,
          sign
        )
      ).to.be.rejected;

      stdCapture.restore();
    });

    it("fails if borrower doesn't own obligation", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const originalBorrower = obligation.borrower;
      obligation.borrower = Keypair.generate();

      await expect(
        obligation.borrow(reserveDoge, 10, destinationDogeLiquidityWallet)
      ).to.be.rejected;

      obligation.borrower = originalBorrower;

      expect(stdCapture.restore()).to.contain("owner is not allowed");
    });

    it("fails if reserve stale", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const refreshReserve = false;
      await expect(
        obligation.borrow(
          reserveDoge,
          10,
          destinationDogeLiquidityWallet,
          undefined,
          refreshReserve
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.match(/Reserve .* is stale/);
    });

    it("fails if obligation stale", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const refreshReserve = true;
      const refreshObligation = false;
      await expect(
        obligation.borrow(
          reserveDoge,
          10,
          destinationDogeLiquidityWallet,
          undefined,
          refreshReserve,
          refreshObligation
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("ObligationStale");
    });

    it("fails if obligation has no deposits", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const emptyObligation = await market.addObligation();
      await expect(
        emptyObligation.borrow(reserveDoge, 10, destinationDogeLiquidityWallet)
      ).to.be.rejected;

      stdCapture.restore();
    });

    it("fails if obligation's and reserve's lending markets mismatch", async () => {
      const differentMarket = await LendingMarket.init(
        program,
        owner,
        shmemProgramId
      );
      const differentReserve = await differentMarket.addReserve(
        10,
        undefined,
        "doge"
      );
      const differentDestination =
        await differentReserve.accounts.liquidityMint.createAccount(
          obligation.borrower.publicKey
        );

      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.borrow(differentReserve, 10, differentDestination)
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("LendingMarketMismatch");
    });

    it("fails if source liquidity doesn't match reserve's config", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const originalSourceLiquidityDogeWallet =
        reserveDoge.accounts.reserveLiquidityWallet;
      reserveDoge.accounts.reserveLiquidityWallet = Keypair.generate();

      await expect(
        obligation.borrow(reserveDoge, 10, destinationDogeLiquidityWallet)
      ).to.be.rejected;

      reserveDoge.accounts.reserveLiquidityWallet =
        originalSourceLiquidityDogeWallet;

      expect(stdCapture.restore()).to.contain(
        "Source liq. wallet must eq. reserve's liq. supply"
      );
    });

    it("fails if source liquidity wallet matches destination", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.borrow(
          reserveDoge,
          10,
          reserveDoge.accounts.reserveLiquidityWallet.publicKey
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Dest. liq. wallet mustn't eq. reserve's liq. supply"
      );
    });

    it("fails if fee recv doesn't match reserve's config", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const originalSourceLiquidityDogeWallet =
        reserveDoge.accounts.reserveLiquidityFeeRecvWallet;
      reserveDoge.accounts.reserveLiquidityFeeRecvWallet = Keypair.generate();

      await expect(
        obligation.borrow(reserveDoge, 10, destinationDogeLiquidityWallet)
      ).to.be.rejected;

      reserveDoge.accounts.reserveLiquidityFeeRecvWallet =
        originalSourceLiquidityDogeWallet;

      expect(stdCapture.restore()).to.contain(
        "Fee receiver doesn't match reserve's config"
      );
    });

    it("borrows liquidity without host fee", async () => {
      const borrowDogeLiquidity = 100;
      await obligation.borrow(
        reserveDoge,
        borrowDogeLiquidity,
        destinationDogeLiquidityWallet
      );
      sourceDogeLiquidity -= borrowDogeLiquidity;

      const obligationInfo = await obligation.fetch();
      expect(obligationInfo.lastUpdate.stale).to.eq(true);
      expect(u192ToBN(obligationInfo.depositedValue).toString()).to.eq(
        "73825000000000000000"
      );
      // this gets updated on next refresh
      expect(u192ToBN(obligationInfo.borrowedValue).toNumber()).to.eq(0);

      expect(obligationInfo.reserves[0])
        .to.have.property("collateral")
        .which.has.property("inner");
      expect(obligationInfo.reserves[1])
        .to.have.property("liquidity")
        .which.has.property("inner");
      const obligationLiquidityInfo =
        obligationInfo.reserves[1].liquidity.inner;
      expect(obligationLiquidityInfo.borrowReserve).to.deep.eq(reserveDoge.id);
      expect(u192ToBN(obligationLiquidityInfo.borrowedAmount).toString()).to.eq(
        "102000000000000000000"
      );
      expect(
        u192ToBN(obligationLiquidityInfo.cumulativeBorrowRate).toString()
      ).to.eq("1000000000000000000");

      const destinationDogeWalletInfo =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          destinationDogeLiquidityWallet
        );
      expect(destinationDogeWalletInfo.amount.toNumber()).to.eq(
        borrowDogeLiquidity
      );
    });

    it("borrows liquidity with host fee", async () => {
      const borrowDogeLiquidity = 100;
      await obligation.borrow(
        reserveDoge,
        borrowDogeLiquidity,
        destinationDogeLiquidityWallet,
        hostFeeReceiver
      );
      sourceDogeLiquidity -= borrowDogeLiquidity;

      const hostFeeReceiverInfo =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          hostFeeReceiver
        );
      expect(hostFeeReceiverInfo.amount.toNumber()).to.eq(1);
    });
  });
}
