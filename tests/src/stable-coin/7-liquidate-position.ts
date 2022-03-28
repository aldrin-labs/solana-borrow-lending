import { Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { Component } from "../component";
import { DEFAULT_SRM_PRICE } from "../consts";
import { CaptureStdoutAndStderr, u192ToBN, waitForCommit } from "../helpers";
import { LendingMarket } from "../lending-market";
import { Receipt } from "../receipt";
import { Reserve } from "../reserve";
import { USP } from "../stable-coin";

export function test(owner: Keypair) {
  describe("liquidate_position", () => {
    const liquidator = Keypair.generate();
    // the price after we lower collateral value
    const dippedSrmPrice = DEFAULT_SRM_PRICE / 1.1;
    const borrowAmount = 35_000000;

    let usp: USP,
      market: LendingMarket,
      receipt: Receipt,
      reserve: Reserve,
      component: Component,
      collateralWallet: PublicKey,
      uspWallet: PublicKey,
      liquidatorUspWallet: PublicKey,
      liquidatorCollateralWallet: PublicKey;

    before("inits usp", async () => {
      usp = await USP.init(owner);
    });

    before("initialize lending market", async () => {
      market = await LendingMarket.init(undefined, owner);
    });

    before("initialize reserve", async () => {
      reserve = await market.addReserve(1);
      await reserve.refreshOraclePrice(999);
    });

    before("initialize component", async () => {
      component = await Component.init(
        usp,
        reserve,
        reserve.accounts.liquidityMint
      );
    });

    beforeEach("init receipt", async () => {
      receipt = await Receipt.init(component);
    });

    beforeEach("airdrops liquidity", async () => {
      collateralWallet = await reserve.createLiquidityWallet(
        receipt.borrower.publicKey,
        100
      );
    });

    beforeEach("creates borrower's stable coin wallet", async () => {
      uspWallet = await usp.mint.createAccount(receipt.borrower.publicKey);
    });

    beforeEach("deposits collateral", async () => {
      await receipt.deposit(collateralWallet, 10);
    });

    beforeEach("borrows stable coin", async () => {
      await receipt.borrow(uspWallet, borrowAmount);
    });

    beforeEach("dips value of collateral", async () => {
      await component.accounts.reserve.setOraclePrice(dippedSrmPrice);
      await waitForCommit();
    });

    afterEach("resets value of collateral", async () => {
      await component.accounts.reserve.setOraclePrice(DEFAULT_SRM_PRICE);
      await waitForCommit();
    });

    beforeEach("inits liquidator wallets and aidrops USP", async () => {
      liquidatorCollateralWallet = await component.accounts.mint.createAccount(
        liquidator.publicKey
      );
      liquidatorUspWallet = await usp.mint.createAccount(liquidator.publicKey);
      await usp.airdrop(liquidatorUspWallet, 100_000_000);
    });

    it("liquidates the loan", async () => {
      await receipt.liquidate(
        liquidator,
        liquidatorUspWallet,
        liquidatorCollateralWallet
      );

      const receiptInfo = await receipt.fetch();
      expect(u192ToBN(receiptInfo.borrowedAmount).toString()).to.eq("0");
      expect(u192ToBN(receiptInfo.interestAmount).toString()).to.eq("0");
      expect(
        receiptInfo.lastInterestAccrualSlot.toNumber()
      ).to.be.approximately(await usp.scp.provider.connection.getSlot(), 3);
      expect(receiptInfo.collateralAmount.toNumber()).to.eq(5);

      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        receipt.liquidate(
          liquidator,
          liquidatorUspWallet,
          liquidatorCollateralWallet
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Cannot liquidate healthy receipt"
      );
    });
  });
}
