import { BN, Program } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { Keypair, PublicKey } from "@solana/web3.js";
import { Reserve } from "./reserve";
import { Obligation } from "./obligation";
import { LendingMarket } from "./lending-market";
import { expect } from "chai";
import {
  CaptureStdoutAndStderr,
  ONE_WAD,
  u192ToBN,
  waitForCommit,
} from "./helpers";

export function test(
  program: Program<BorrowLending>,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("repay_obligation_liquidity", () => {
    // this liquidity is borrowed for each test case
    const borrowedLiquidity = 100;
    // when we create borrower's doge wallet, we mint them some initial tokens
    const initialDogeAmount = 50;
    // this liquidity is given to the reserve once
    let sourceDogeLiquidity = 2000;
    let depositedSrmCollateralAmount = 50;
    let market: LendingMarket,
      obligation: Obligation,
      reserveSrm: Reserve,
      reserveDoge: Reserve,
      borrowerDogeLiquidityWallet: PublicKey;

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

    beforeEach("initialize obligation", async () => {
      obligation = await market.addObligation();
    });

    beforeEach(
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

    beforeEach("create borrower's liquidity wallet", async () => {
      borrowerDogeLiquidityWallet =
        await reserveDoge.accounts.liquidityMint.createAccount(
          obligation.borrower.publicKey
        );

      await reserveDoge.accounts.liquidityMint.mintTo(
        borrowerDogeLiquidityWallet,
        reserveDoge.accounts.liquidityMintAuthority,
        [],
        initialDogeAmount
      );
    });

    beforeEach("refresh oracle slot validity", async () => {
      await reserveDoge.refreshOraclePrice(15);
      await reserveSrm.refreshOraclePrice(15);
      await waitForCommit();
    });

    beforeEach("borrow liquidity", async () => {
      expect(
        borrowedLiquidity,
        "increase initial sourceDogeLiquidity so that every test has enough funds"
      ).to.be.lessThanOrEqual(sourceDogeLiquidity);

      await obligation.borrow(
        reserveDoge,
        borrowerDogeLiquidityWallet,
        borrowedLiquidity
      );
      await update();
    });

    it("fails if repayer isn't signer", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.repay(reserveDoge, borrowerDogeLiquidityWallet, 10, {
          sign: false,
        })
      ).to.be.rejected;

      stdCapture.restore();
    });

    it("fails if obligation is stale", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.repay(reserveDoge, borrowerDogeLiquidityWallet, 10, {
          refreshObligation: false,
        })
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("ObligationStale");
    });

    it("fails if reserve is stale", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.repay(reserveDoge, borrowerDogeLiquidityWallet, 10, {
          refreshReserve: false,
        })
      ).to.be.rejected;

      expect(stdCapture.restore()).to.match(/Reserve .* is stale/);
    });

    it("fails if source liquidity wallet matches reserve's config", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.repay(
          reserveDoge,
          reserveDoge.accounts.reserveLiquidityWallet.publicKey,
          10
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Source liq. wallet mustn't eq. reserve's liq. supply"
      );
    });

    it("fails if token program mismatches reserve", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.repay(reserveDoge, borrowerDogeLiquidityWallet, 10, {
          tokenProgram: Keypair.generate().publicKey,
        })
      ).to.be.rejectedWith(/Program ID was not as expected/);

      stdCapture.restore();
    });

    it("fails if destination wallet doesn't match reserve's config", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const originalReserveLiquidityWallet =
        reserveDoge.accounts.reserveLiquidityWallet;
      reserveDoge.accounts.reserveLiquidityWallet = Keypair.generate();

      await expect(
        obligation.repay(reserveDoge, borrowerDogeLiquidityWallet, 10)
      ).to.be.rejected;

      reserveDoge.accounts.reserveLiquidityWallet =
        originalReserveLiquidityWallet;

      expect(stdCapture.restore()).to.contain(
        "Dest. liq. wallet must eq. reserve's liq. supply"
      );
    });

    it("fails if reserve's and obligation's market mismatch", async () => {
      const differentMarket = await LendingMarket.init(
        program,
        owner,
        shmemProgramId
      );
      const differentReserve = await differentMarket.addReserve(
        500,
        undefined,
        "doge"
      );

      const stdCapture = new CaptureStdoutAndStderr();

      obligation.reservesToRefresh.add(differentReserve);
      await expect(
        obligation.repay(differentReserve, borrowerDogeLiquidityWallet, 50)
      ).to.be.rejected;

      obligation.reservesToRefresh.delete(differentReserve);
      expect(stdCapture.restore()).to.contain("LendingMarketMismatch");
    });

    it("fails if obligation has no such borrowed reserve", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.repay(reserveSrm, borrowerDogeLiquidityWallet, 10)
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("Obligation has no such reserve");
    });

    it("fails if liquidity amount is zero", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.repay(reserveDoge, borrowerDogeLiquidityWallet, 0)
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("amount provided cannot be zero");
    });

    it("repays some liquidity", async () => {
      const oldReserveInfo = await reserveDoge.fetch();
      const oldObligationInfo = await obligation.fetch();

      const repayAmount = borrowedLiquidity / 2;
      await obligation.repay(
        reserveDoge,
        borrowerDogeLiquidityWallet,
        repayAmount
      );
      await update();

      const reserveInfo = await reserveDoge.fetch();
      expect(reserveInfo.lastUpdate.stale).to.be.true;
      expect(reserveInfo.liquidity.availableAmount.toNumber()).eq(
        sourceDogeLiquidity
      );
      expect(
        u192ToBN(reserveInfo.liquidity.borrowedAmount).lt(
          u192ToBN(oldReserveInfo.liquidity.borrowedAmount)
        )
      ).to.be.true;

      // should be ~10000000xxxxxxxxxxx
      const rcbr = u192ToBN(reserveInfo.liquidity.cumulativeBorrowRate);
      expect(rcbr.gt(ONE_WAD)).to.be.true;
      expect(rcbr.lt(ONE_WAD.add(ONE_WAD.div(new BN(100000))))).to.be.true;

      const ruacp = u192ToBN(reserveInfo.liquidity.marketPrice);
      expect(ruacp.toString()).eq("238167000000000000");

      expect((await obligation.fetch()).lastUpdate.stale).to.be.true;

      await obligation.refresh();
      const obligationInfo = await obligation.fetch();
      expect(
        u192ToBN(obligationInfo.depositedValue).lt(
          u192ToBN(obligationInfo.borrowedValue)
        )
      );
      // should be about ~123xxxxxxxxxxxxxxxxx
      const obv = u192ToBN(obligationInfo.borrowedValue);
      expect(obv.gt(ONE_WAD.mul(new BN(12)))).to.be.true;
      expect(obv.lt(ONE_WAD.mul(new BN(13)))).to.be.true;
      expect(obv.lt(u192ToBN(oldObligationInfo.borrowedValue)));

      const odv = u192ToBN(obligationInfo.depositedValue).toString();
      expect(odv).to.eq("73825000000000000000");

      const oab = u192ToBN(obligationInfo.allowedBorrowValue).toString();
      expect(oab).to.eq("66442500000000000000");

      const oub = u192ToBN(obligationInfo.unhealthyBorrowValue).toString();
      expect(oub).to.eq("70872000000000000000");

      expect(obligationInfo.reserves[0].collateral).to.have.property("inner");
      expect(
        obligationInfo.reserves[0].collateral.inner.depositedAmount.toNumber()
      ).to.eq(depositedSrmCollateralAmount);

      expect(obligationInfo.reserves[1].liquidity).to.have.property("inner");
      // should be ~10200000xxxxxxxxxxxxx
      const lba = u192ToBN(
        obligationInfo.reserves[1].liquidity.inner.borrowedAmount
      );
      expect(lba.gt(ONE_WAD.mul(new BN(102))));
      expect(lba.lt(ONE_WAD.mul(new BN(103))));

      const borrowerDogeLiquidityWalletInfo =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          borrowerDogeLiquidityWallet
        );
      expect(borrowerDogeLiquidityWalletInfo.amount.toNumber()).to.eq(
        borrowedLiquidity + initialDogeAmount - repayAmount
      );

      const sourceDogeLiquidityWalletInfo =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          reserveDoge.accounts.reserveLiquidityWallet.publicKey
        );
      expect(sourceDogeLiquidityWalletInfo.amount.toNumber()).to.eq(
        reserveInfo.liquidity.availableAmount.toNumber()
      );
    });

    it("repays at most what's owed", async () => {
      const repayAmount = borrowedLiquidity * 2;
      await waitForCommit();
      await obligation.repay(
        reserveDoge,
        borrowerDogeLiquidityWallet,
        repayAmount
      );
      await update();

      await obligation.refresh();
      const obligationInfo = await obligation.fetch();
      expect(obligationInfo.reserves[1]).to.deep.eq({ empty: {} });
      expect(u192ToBN(obligationInfo.borrowedValue).toNumber()).to.eq(0);

      await reserveDoge.refresh();
      const reserveInfo = await reserveDoge.fetch();
      expect(reserveInfo.liquidity.availableAmount.toNumber()).to.eq(
        sourceDogeLiquidity
      );

      const borrowerDogeLiquidityWalletInfo =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          borrowerDogeLiquidityWallet
        );
      // this is time dependent but it ceils up so the test would have to take
      // a long time for this to increase
      const feePlusInterest = 3;
      expect(borrowerDogeLiquidityWalletInfo.amount.toNumber()).to.eq(
        initialDogeAmount - feePlusInterest
      );
    });

    /**
     * Updates amounts which are used for expectation calculations.
     */
    async function update() {
      const sourceDogeLiquidityInfo =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          reserveDoge.accounts.reserveLiquidityWallet.publicKey
        );
      sourceDogeLiquidity = sourceDogeLiquidityInfo.amount.toNumber();
    }
  });
}
