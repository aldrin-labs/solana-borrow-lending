import { Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { AmmPool } from "../amm-pool";
import { Component } from "../component";
import { globalContainer } from "../global-container";
import { CaptureStdoutAndStderr, u192ToBN } from "../helpers";
import { LendingMarket } from "../lending-market";
import { Receipt } from "../receipt";
import { Reserve } from "../reserve";
import { USP } from "../stable-coin";

export function test(owner: Keypair) {
  describe("USP leverage on aldrin AMM", () => {
    let usp: USP,
      market: LendingMarket,
      receipt: Receipt,
      reserveDoge: Reserve,
      reserveSrm: Reserve,
      component: Component,
      srmWallet: PublicKey,
      dogeWallet: PublicKey,
      uspWallet: PublicKey,
      uspDogePool: AmmPool,
      dogeSrmPool: AmmPool;

    before("inits usp", async () => {
      usp = await USP.init(owner);
    });

    before("initialize lending market", async () => {
      market = await LendingMarket.init(undefined, owner);
    });

    before("initialize reserves", async () => {
      reserveSrm = await market.addReserve(1);
      await reserveSrm.refreshOraclePrice(999);

      reserveDoge = await market.addReserve(1);
      await reserveDoge.refreshOraclePrice(999);
    });

    before("initialize component", async () => {
      component = await Component.init(
        usp,
        reserveSrm,
        reserveSrm.accounts.liquidityMint
      );
    });

    before("initialize USP/DOGE pool", async () => {
      uspDogePool = await AmmPool.init(
        globalContainer.amm,
        market,
        globalContainer.ammAuthority,
        usp.toTokenWrapper(),
        reserveDoge.toTokenWrapper()
      );
    });

    before("initialize DOGE/SRM pool", async () => {
      dogeSrmPool = await AmmPool.init(
        globalContainer.amm,
        market,
        globalContainer.ammAuthority,
        reserveDoge.toTokenWrapper(),
        reserveSrm.toTokenWrapper()
      );
    });

    beforeEach("init receipt", async () => {
      receipt = await Receipt.init(component);
    });

    beforeEach("creates borrower's stable coin wallet", async () => {
      uspWallet = await usp.mint.createAccount(receipt.borrower.publicKey);
    });

    beforeEach("creates borrower's intermediary wallet", async () => {
      dogeWallet = await reserveDoge.createLiquidityWallet(
        receipt.borrower.publicKey,
        0
      );
    });

    beforeEach("deposits collateral", async () => {
      srmWallet = await reserveSrm.createLiquidityWallet(
        receipt.borrower.publicKey,
        3_100
      );
      await receipt.deposit(srmWallet, 100);
    });

    it("cannot borrow initial amount greater than collateral", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        receipt.leverageViaAldrinAmm(
          uspDogePool,
          dogeSrmPool,
          uspWallet,
          srmWallet,
          dogeWallet,
          0.5,
          10_000
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("Cannot borrow more than");
    });

    it("fails if component doesn't match stable coin");
    it("fails if stable coin mint doesn't match component");
    it("fails if PDA doesn't match component or bump seed");
    it("fails if freeze wallet doesn't match component");
    it("fails if reserve doesn't match component");
    it("fails if reserve is stale");
    it("fails if receipt doesn't match borrower");
    it("fails if receipt doesn't match component");
    it("fails if amm mismatches stable coin's component");
    it("fails if mint allowance is not enough");

    it("fails if collateral ration is higher than max col. ratio", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        receipt.leverageViaAldrinAmm(
          uspDogePool,
          dogeSrmPool,
          uspWallet,
          srmWallet,
          dogeWallet,
          1,
          1_000
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("Max collateral ratio is");
    });

    it("starts leverage", async () => {
      await receipt.leverageViaAldrinAmm(
        uspDogePool,
        dogeSrmPool,
        uspWallet,
        srmWallet,
        dogeWallet,
        0.5,
        1_000
      );

      const receiptInfo = await receipt.fetch();
      expect(receiptInfo.collateralAmount.toNumber()).to.eq(2013);
      expect(
        receiptInfo.lastInterestAccrualSlot.toNumber()
      ).to.be.approximately(await usp.scp.provider.connection.getSlot(), 3);
      expect(u192ToBN(receiptInfo.interestAmount).toNumber()).to.eq(0);
      expect(u192ToBN(receiptInfo.borrowedAmount).toString()).to.eq(
        "1999000000000000000000"
      );
      expect(u192ToBN(receiptInfo.borrowFeeAmount).toString()).to.eq(
        "39980000000000000000"
      );
    });

    it("starts leverage and then closes half", async () => {
      await receipt.leverageViaAldrinAmm(
        uspDogePool,
        dogeSrmPool,
        uspWallet,
        srmWallet,
        dogeWallet,
        0.5,
        1_000
      );

      await usp.airdrop(uspWallet, 1_000_000);
      const receiptInfoBefore = await receipt.fetch();

      await receipt.deleverageViaAldrinAmm(
        dogeSrmPool,
        uspDogePool,
        uspWallet,
        srmWallet,
        dogeWallet,
        receiptInfoBefore.collateralAmount.toNumber() / 2
      );

      const receiptInfoAfter = await receipt.fetch();

      // depends on interest, which depends on time
      expect(receiptInfoAfter.collateralAmount.toNumber()).to.be.approximately(
        1000,
        100
      );
      expect(
        u192ToBN(receiptInfoBefore.borrowedAmount).gt(
          u192ToBN(receiptInfoAfter.borrowedAmount)
        )
      ).to.be.true;
      expect(u192ToBN(receiptInfoAfter.borrowFeeAmount).toNumber()).to.eq(0);
      expect(u192ToBN(receiptInfoAfter.interestAmount).toNumber()).to.eq(0);

      expect(
        receiptInfoAfter.lastInterestAccrualSlot.toNumber()
      ).to.be.approximately(await usp.scp.provider.connection.getSlot(), 3);
    });

    it("deleverages all collateral", async () => {
      await receipt.deposit(srmWallet, 3_000);
      await receipt.borrow(uspWallet, 10);

      await usp.airdrop(uspWallet, 1_000_000);
      const receiptInfoBefore = await receipt.fetch();
      const { amount: uspAmountBefore } = await usp.mint.getAccountInfo(
        uspWallet
      );

      await receipt.deleverageViaAldrinAmm(
        dogeSrmPool,
        uspDogePool,
        uspWallet,
        srmWallet,
        dogeWallet,
        receiptInfoBefore.collateralAmount.toNumber()
      );

      const { amount: uspAmountAfter } = await usp.mint.getAccountInfo(
        uspWallet
      );
      expect(uspAmountAfter.gt(uspAmountBefore)).to.be.true;

      const receiptInfoAfter = await receipt.fetch();
      expect(receiptInfoAfter.collateralAmount.toNumber()).to.eq(0);
      expect(u192ToBN(receiptInfoAfter.borrowFeeAmount).toNumber()).to.eq(0);
      expect(u192ToBN(receiptInfoAfter.interestAmount).toNumber()).to.eq(0);
      expect(u192ToBN(receiptInfoAfter.borrowedAmount).toNumber()).to.eq(0);
    });
  });
}
