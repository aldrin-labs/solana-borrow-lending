import { Program, BN } from "@project-serum/anchor";
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
  describe("liquidate_obligation", () => {
    const liquidator = Keypair.generate();

    // the default price value in the binary
    const initialSrmPrice = 7382500000;
    // the price after we lower collateral value
    const dippedSrmPrice = initialSrmPrice / 100;

    // this liquidity is borrowed for each test case
    const borrowedLiquidity = 150;
    // when we create liquidator's doge wallet, we mint them some initial tokens
    const initialDogeAmount = borrowedLiquidity * 3;

    const depositedCollateral = 150;

    // this liquidity is given to the reserve on init
    let sourceDogeLiquidity = 3000;

    let market: LendingMarket,
      obligation: Obligation,
      reserveSrm: Reserve,
      reserveDoge: Reserve,
      liquidatorsDogeWallet: PublicKey,
      liquidatorsSrmWallet: PublicKey,
      sourceCollateralWallet: PublicKey;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner, shmemProgramId);
    });

    before("initialize reserves", async () => {
      reserveSrm = await market.addReserve(100, undefined, "srm");
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
        sourceCollateralWallet =
          await reserveSrm.createCollateralWalletWithCollateral(
            obligation.borrower.publicKey,
            10000
          );

        await obligation.depositCollateral(
          reserveSrm,
          sourceCollateralWallet,
          depositedCollateral
        );
      }
    );

    beforeEach("create liquidator's liquidity wallet", async () => {
      liquidatorsDogeWallet =
        await reserveDoge.accounts.liquidityMint.createAccount(
          liquidator.publicKey
        );

      await reserveDoge.accounts.liquidityMint.mintTo(
        liquidatorsDogeWallet,
        reserveDoge.accounts.liquidityMintAuthority,
        [],
        initialDogeAmount
      );
    });

    beforeEach("create liquidator's collateral wallet", async () => {
      liquidatorsSrmWallet =
        await reserveSrm.accounts.reserveCollateralMint.createAccount(
          liquidator.publicKey
        );
    });

    beforeEach("refresh oracle slot validity", async () => {
      await reserveDoge.refreshOraclePrice(15);
      await reserveSrm.refreshOraclePrice(15);
      await waitForCommit();
    });

    beforeEach("borrow liquidity", async () => {
      const borrowersDogeWallet =
        await reserveDoge.accounts.liquidityMint.createAccount(
          liquidator.publicKey
        );

      await reserveDoge.accounts.liquidityMint.mintTo(
        borrowersDogeWallet,
        reserveDoge.accounts.liquidityMintAuthority,
        [],
        borrowedLiquidity
      );

      await obligation.borrow(
        reserveDoge,
        borrowedLiquidity,
        borrowersDogeWallet
      );
    });

    beforeEach("dips value of srm", async () => {
      await reserveSrm.setOraclePrice(dippedSrmPrice);
      await waitForCommit();
      await obligation.refresh();
    });

    afterEach("resets value of srm", async () => {
      await reserveSrm.setOraclePrice(initialSrmPrice);
      await waitForCommit();
    });

    it("fails if obligation stale", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const refreshObligation = false;
      await expect(
        obligation.liquidate(
          2,
          reserveDoge,
          reserveSrm,
          liquidatorsDogeWallet,
          liquidatorsSrmWallet,
          liquidator,
          refreshObligation
        )
      ).to.be.rejected;

      stdCapture.restore();
    });

    it("fails if liquidator isn't signed", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const sign = false;
      const refresh = true;
      await expect(
        obligation.liquidate(
          2,
          reserveDoge,
          reserveSrm,
          liquidatorsDogeWallet,
          liquidatorsSrmWallet,
          liquidator,
          refresh,
          refresh,
          refresh,
          sign
        )
      ).to.be.rejectedWith("Signature verification failed");

      stdCapture.restore();
    });

    it("fails if liquidator doesn't own source repay wallet", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.liquidate(
          2,
          reserveDoge,
          reserveSrm,
          liquidatorsDogeWallet,
          liquidatorsSrmWallet,
          Keypair.generate()
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("owner does not match");
    });

    it("fails if obligation has no borrows", async () => {
      // give the liquidator's wallet to borrower
      await reserveDoge.accounts.liquidityMint.setAuthority(
        liquidatorsDogeWallet,
        obligation.borrower.publicKey,
        "AccountOwner",
        liquidator,
        []
      );

      await obligation.repay(
        reserveDoge,
        liquidatorsDogeWallet,
        Number.MAX_SAFE_INTEGER
      );

      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.liquidate(
          2,
          reserveDoge,
          reserveSrm,
          liquidatorsDogeWallet,
          liquidatorsSrmWallet
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("ObligationLiquidityEmpty");
    });

    it("fails if obligation is healthy", async () => {
      // give the liquidator's wallet to borrower
      await reserveDoge.accounts.liquidityMint.setAuthority(
        liquidatorsDogeWallet,
        obligation.borrower.publicKey,
        "AccountOwner",
        liquidator,
        []
      );

      await obligation.repay(
        reserveDoge,
        liquidatorsDogeWallet,
        borrowedLiquidity - 1
      );
      await obligation.depositCollateral(
        reserveSrm,
        sourceCollateralWallet,
        3000
      );

      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.liquidate(
          2,
          reserveDoge,
          reserveSrm,
          liquidatorsDogeWallet,
          liquidatorsSrmWallet
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("ObligationHealthy");
    });

    it("fails if withdraw reserve stale", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const refreshObligation = true;
      const refreshRepayReserve = true;
      const refreshWithdrawReserve = false;
      await expect(
        obligation.liquidate(
          2,
          reserveDoge,
          reserveSrm,
          liquidatorsDogeWallet,
          liquidatorsSrmWallet,
          liquidator,
          refreshObligation,
          refreshRepayReserve,
          refreshWithdrawReserve
        )
      ).to.be.rejected;

      stdCapture.restore();
    });

    it("fails if repay reserve stale", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const refreshObligation = true;
      const refreshRepayReserve = false;
      const refreshWithdrawReserve = true;
      await expect(
        obligation.liquidate(
          2,
          reserveDoge,
          reserveSrm,
          liquidatorsDogeWallet,
          liquidatorsSrmWallet,
          liquidator,
          refreshObligation,
          refreshRepayReserve,
          refreshWithdrawReserve
        )
      ).to.be.rejected;

      stdCapture.restore();
    });

    it("fails if repay reserve's market doesn't match obligation", async () => {
      const differentMarket = await LendingMarket.init(
        program,
        owner,
        shmemProgramId
      );
      const differentReserve = await differentMarket.addReserve(10);
      await differentReserve.refreshOraclePrice(20);
      obligation.reservesToRefresh.add(differentReserve);

      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.liquidate(
          2,
          differentReserve,
          reserveSrm,
          liquidatorsDogeWallet,
          liquidatorsSrmWallet,
          liquidator
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("LendingMarketMismatch");
    });

    it("fails if withdraw reserve's market doesn't match obligation", async () => {
      const differentMarket = await LendingMarket.init(
        program,
        owner,
        shmemProgramId
      );
      const differentReserve = await differentMarket.addReserve(10);
      await differentReserve.refreshOraclePrice(20);
      obligation.reservesToRefresh.add(differentReserve);

      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.liquidate(
          2,
          reserveDoge,
          differentReserve,
          liquidatorsDogeWallet,
          liquidatorsSrmWallet,
          liquidator
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("LendingMarketMismatch");
    });

    it("fails if source liquidity wallet equals repay reserve supply", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.liquidate(
          2,
          reserveDoge,
          reserveSrm,
          reserveDoge.accounts.reserveLiquidityWallet.publicKey,
          liquidatorsSrmWallet,
          liquidator
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Source liq. wallet mustn't eq. reserve's liq. wallet"
      );
    });

    it("fails if source liquidity wallet equals withdraw reserve supply", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.liquidate(
          2,
          reserveDoge,
          reserveSrm,
          reserveSrm.accounts.reserveLiquidityWallet.publicKey,
          liquidatorsSrmWallet,
          liquidator
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Source liq. wallet mustn't eq. withdraw reserve liq. supply"
      );
    });

    it("fails if dest. collateral wallet equals repay reserve supply", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.liquidate(
          2,
          reserveDoge,
          reserveSrm,
          liquidatorsDogeWallet,
          reserveDoge.accounts.reserveCollateralWallet.publicKey,
          liquidator
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Dest. col. wallet mustn't eq. repay reserve col. supply"
      );
    });

    it("fails if dest. collateral wallet equals withdraw reserve supply", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.liquidate(
          2,
          reserveDoge,
          reserveSrm,
          liquidatorsDogeWallet,
          reserveSrm.accounts.reserveCollateralWallet.publicKey,
          liquidator
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Dest. col. wallet mustn't eq. reserve's col. wallet"
      );
    });

    it("fails if liquidity wallet doesn't match repay reserve supply", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const originalRepayReserveSupply =
        reserveDoge.accounts.reserveLiquidityWallet;
      reserveDoge.accounts.reserveLiquidityWallet = Keypair.generate();

      await expect(
        obligation.liquidate(
          2,
          reserveDoge,
          reserveSrm,
          liquidatorsDogeWallet,
          liquidatorsSrmWallet,
          liquidator
        )
      ).to.be.rejected;

      reserveDoge.accounts.reserveLiquidityWallet = originalRepayReserveSupply;
      expect(stdCapture.restore()).to.contain(
        "Reserve liq. wallet must match supply config"
      );
    });

    it("fails if collateral wallet doesn't match withdraw reserve supply", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const originalWithdrawReserveSupply =
        reserveSrm.accounts.reserveCollateralWallet;
      reserveSrm.accounts.reserveCollateralWallet = Keypair.generate();

      await expect(
        obligation.liquidate(
          2,
          reserveDoge,
          reserveSrm,
          liquidatorsDogeWallet,
          liquidatorsSrmWallet,
          liquidator
        )
      ).to.be.rejected;

      reserveSrm.accounts.reserveCollateralWallet =
        originalWithdrawReserveSupply;
      expect(stdCapture.restore()).to.contain(
        "Reserve col. wallet must match supply config"
      );
    });

    it("fails if liquidity amount is zero", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const amountToLiquidate = 0;
      await expect(
        obligation.liquidate(
          amountToLiquidate,
          reserveDoge,
          reserveSrm,
          liquidatorsDogeWallet,
          liquidatorsSrmWallet,
          liquidator
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("amount provided cannot be zero");
    });

    it("liquidates part of an obligation", async () => {
      const oldObligationInfo = await obligation.fetch();

      const amountToLiquidate = 2;
      await obligation.liquidate(
        amountToLiquidate,
        reserveDoge,
        reserveSrm,
        liquidatorsDogeWallet,
        liquidatorsSrmWallet,
        liquidator
      );

      await obligation.refresh();
      const obligationInfo = await obligation.fetch();

      expect(
        u192ToBN(oldObligationInfo.unhealthyBorrowValue).gt(
          u192ToBN(obligationInfo.unhealthyBorrowValue)
        )
      ).to.be.true;
      expect(
        u192ToBN(oldObligationInfo.depositedValue).gt(
          u192ToBN(obligationInfo.depositedValue)
        )
      ).to.be.true;

      const srmCollateralWalletInfo =
        await reserveSrm.accounts.reserveCollateralMint.getAccountInfo(
          liquidatorsSrmWallet
        );
      expect(srmCollateralWalletInfo.amount.toNumber()).to.eq(32);
      const dogeLiquidityWalletInfo =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          liquidatorsDogeWallet
        );
      expect(dogeLiquidityWalletInfo.amount.toNumber()).to.eq(
        initialDogeAmount - amountToLiquidate
      );
    });

    it("liquidates until all collateral withdrawn", async () => {
      const oldObligationInfo = await obligation.fetch();

      await obligation.liquidate(
        Number.MAX_SAFE_INTEGER,
        reserveDoge,
        reserveSrm,
        liquidatorsDogeWallet,
        liquidatorsSrmWallet,
        liquidator
      );

      await obligation.refresh();
      const obligationInfo = await obligation.fetch();
      expect(obligationInfo.reserves[0]).to.deep.eq({ empty: {} });
      const liquidity = obligationInfo.reserves[1].liquidity.inner;
      expect(
        u192ToBN(liquidity.borrowedAmount).lt(
          u192ToBN(oldObligationInfo.reserves[1].liquidity.inner.borrowedAmount)
        )
      ).to.be.true;

      const srmCollateralWalletInfo =
        await reserveSrm.accounts.reserveCollateralMint.getAccountInfo(
          liquidatorsSrmWallet
        );
      expect(srmCollateralWalletInfo.amount.toNumber()).to.eq(
        depositedCollateral
      );

      const dogeLiquidityWalletInfo =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          liquidatorsDogeWallet
        );
      expect(dogeLiquidityWalletInfo.amount.toNumber()).to.eq(440);
    });

    it("liquidates until all liquidity repayed", async () => {
      // give the liquidator's wallet to borrower
      await reserveDoge.accounts.liquidityMint.setAuthority(
        liquidatorsDogeWallet,
        obligation.borrower.publicKey,
        "AccountOwner",
        liquidator,
        []
      );

      await obligation.repay(
        reserveDoge,
        liquidatorsDogeWallet,
        borrowedLiquidity - 7
      );

      await obligation.liquidate(
        Number.MAX_SAFE_INTEGER,
        reserveDoge,
        reserveSrm,
        liquidatorsDogeWallet,
        liquidatorsSrmWallet
      );

      await obligation.refresh();
      const obligationInfo = await obligation.fetch();
      const obv = u192ToBN(obligationInfo.borrowedValue);
      // ~1xxxxxxxxxxxxxxxxxx
      expect(obv.gt(ONE_WAD)).to.be.true;
      expect(obv.lt(ONE_WAD.mul(new BN(2)))).to.be.true;

      // ~45xxxxxxxxxxxxxxxxx
      const lba = u192ToBN(
        obligationInfo.reserves[1].liquidity.inner.borrowedAmount
      );
      expect(lba.gt(ONE_WAD.mul(new BN(4)))).to.be.true;
      expect(lba.lt(ONE_WAD.mul(new BN(5)))).to.be.true;
    });
  });
}
