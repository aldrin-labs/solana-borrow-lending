import { Program, BN } from "@project-serum/anchor";
import { BorrowLending } from "../../../target/types/borrow_lending";
import { Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { LendingMarket } from "../lending-market";
import { Reserve } from "../reserve";
import { Obligation } from "../obligation";
import { CaptureStdoutAndStderr, ONE_WAD, u192ToBN } from "../helpers";
import { ONE_LIQ_TO_COL_INITIAL_PRICE } from "../consts";
import { globalContainer } from "../global-container";

export function test(owner: Keypair) {
  const program: Program<BorrowLending> = globalContainer.blp;
  describe("borrow_obligation_liquidity", () => {
    let initialSourceDogeLiquidity = 500;
    let sourceDogeLiquidity = initialSourceDogeLiquidity;
    let depositedSrmCollateralAmount = 10 * ONE_LIQ_TO_COL_INITIAL_PRICE;
    let market: LendingMarket,
      obligation: Obligation,
      reserveSrm: Reserve,
      reserveDoge: Reserve,
      destinationDogeLiquidityWallet: PublicKey,
      hostFeeReceiver: PublicKey;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner);
    });

    before("initialize reserves", async () => {
      reserveSrm = await market.addReserve(50, undefined, "srm");
      reserveDoge = await market.addReserve(
        initialSourceDogeLiquidity,
        undefined,
        "doge"
      );

      await reserveDoge.refreshOraclePrice(999);
      await reserveSrm.refreshOraclePrice(999);
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

        await obligation.deposit(
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

    it("cannot borrow more than allowed value of liquidity", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.borrow(reserveDoge, destinationDogeLiquidityWallet, 300)
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "cannot exceed maximum borrow value"
      );
    });

    it("fails if borrower is not signed", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.borrow(reserveDoge, destinationDogeLiquidityWallet, 10, {
          sign: false,
        })
      ).to.be.rejected;

      stdCapture.restore();
    });

    it("fails if borrower doesn't own obligation", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const originalBorrower = obligation.borrower;
      obligation.borrower = Keypair.generate();

      await expect(
        obligation.borrow(reserveDoge, destinationDogeLiquidityWallet, 10)
      ).to.be.rejected;

      obligation.borrower = originalBorrower;

      expect(stdCapture.restore()).to.contain("owner is not allowed");
    });

    it("fails if token program mismatches reserve", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.borrow(reserveDoge, destinationDogeLiquidityWallet, 10, {
          tokenProgram: Keypair.generate().publicKey,
        })
      ).to.be.rejected;

      stdCapture.restore();
    });

    it("fails if reserve stale", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.borrow(reserveDoge, destinationDogeLiquidityWallet, 10, {
          refreshReserve: false,
        })
      ).to.be.rejected;

      expect(stdCapture.restore()).to.match(/Reserve .* is stale/);
    });

    it("fails if obligation stale", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.borrow(reserveDoge, destinationDogeLiquidityWallet, 10, {
          refreshObligation: false,
        })
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("ObligationStale");
    });

    it("fails if obligation has no deposits", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const emptyObligation = await market.addObligation();
      await expect(
        emptyObligation.borrow(reserveDoge, destinationDogeLiquidityWallet, 10)
      ).to.be.rejected;

      stdCapture.restore();
    });

    it("fails if obligation's and reserve's lending markets mismatch", async () => {
      const differentMarket = await LendingMarket.init(program, owner);
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
        obligation.borrow(differentReserve, differentDestination, 10)
      ).to.be.rejected;

      stdCapture.restore();
    });

    it("fails if source liquidity doesn't match reserve's config", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const originalSourceLiquidityDogeWallet =
        reserveDoge.accounts.reserveLiquidityWallet;
      reserveDoge.accounts.reserveLiquidityWallet = Keypair.generate();

      await expect(
        obligation.borrow(reserveDoge, destinationDogeLiquidityWallet, 10)
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
          reserveDoge.accounts.reserveLiquidityWallet.publicKey,
          10
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
        obligation.borrow(reserveDoge, destinationDogeLiquidityWallet, 10)
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
        destinationDogeLiquidityWallet,
        borrowDogeLiquidity
      );
      sourceDogeLiquidity -= borrowDogeLiquidity;

      const obligationInfo = await obligation.fetch();
      expect(obligationInfo.lastUpdate.stale).to.eq(true);
      expect(u192ToBN(obligationInfo.depositedValue).toString()).to.eq(
        "73825000000000000000"
      );
      // this gets updated on next refresh
      expect(
        u192ToBN(obligationInfo.collateralizedBorrowedValue).toNumber()
      ).to.eq(0);
      expect(u192ToBN(obligationInfo.totalBorrowedValue).toNumber()).to.eq(0);

      expect(obligationInfo.reserves[0])
        .to.have.property("collateral")
        .which.has.property("inner");
      expect(obligationInfo.reserves[1])
        .to.have.property("liquidity")
        .which.has.property("inner");
      const obligationLiquidityInfo =
        obligationInfo.reserves[1].liquidity.inner;
      expect(obligationLiquidityInfo.borrowReserve).to.deep.eq(reserveDoge.id);
      const obligationBorrowedAmount = u192ToBN(
        obligationLiquidityInfo.borrowedAmount
      );
      expect(obligationBorrowedAmount.toString()).to.eq(
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

      await reserveDoge.refresh();
      const reserveInfo = await reserveDoge.fetch();
      const liq = reserveInfo.liquidity;
      const fees = 2;
      expect(liq.availableAmount.toNumber()).to.eq(sourceDogeLiquidity - fees);
      const reserveBorrowedAmount = u192ToBN(liq.borrowedAmount);
      // due to interest borrowed amount is a bit higher
      expect(reserveBorrowedAmount.gt(obligationBorrowedAmount)).to.be.true;
      expect(reserveBorrowedAmount.lt(obligationBorrowedAmount.add(ONE_WAD))).to
        .be.true;
      const lcbr = u192ToBN(liq.cumulativeBorrowRate);
      expect(lcbr.gt(ONE_WAD)).to.be.true;
      expect(lcbr.lt(ONE_WAD.mul(new BN(2))));
      expect(u192ToBN(liq.marketPrice).toString()).to.eq("238167000000000000");
      expect(reserveInfo.collateral.mintTotalSupply.toNumber()).to.eq(
        initialSourceDogeLiquidity * ONE_LIQ_TO_COL_INITIAL_PRICE
      );
    });

    it("fails to borrow liquidity amount larger than fees", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const borrowDogeLiquidity = 1;
      await expect(
        obligation.borrow(
          reserveDoge,
          destinationDogeLiquidityWallet,
          borrowDogeLiquidity
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Borrow amount is too small to receive liquidity after fees"
      );
    });

    it("borrows liquidity with host fee", async () => {
      const borrowDogeLiquidity = 100;
      await obligation.borrow(
        reserveDoge,
        destinationDogeLiquidityWallet,
        borrowDogeLiquidity,
        { hostFeeReceiver }
      );
      sourceDogeLiquidity -= borrowDogeLiquidity;

      const hostFeeReceiverInfo =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          hostFeeReceiver
        );
      expect(hostFeeReceiverInfo.amount.toNumber()).to.eq(1);
    });

    it("cannot borrow if reserve util. rate would grow over 95%");
  });
}
