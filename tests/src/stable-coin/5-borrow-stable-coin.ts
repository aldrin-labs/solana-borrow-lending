import { Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { Component } from "../component";
import { u192ToBN } from "../helpers";
import { LendingMarket } from "../lending-market";
import { Receipt } from "../receipt";
import { Reserve } from "../reserve";
import { USP } from "../stable-coin";

export function test(owner: Keypair) {
  describe("borrow_stable_coin", () => {
    let usp: USP,
      market: LendingMarket,
      receipt: Receipt,
      reserve: Reserve,
      component: Component,
      collateralWallet: PublicKey,
      uspWallet: PublicKey;

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
      await receipt.deposit(collateralWallet, 50);
    });

    it("borrows stable coin", async () => {
      const borrowAmount = 5;
      await receipt.borrow(uspWallet, borrowAmount);

      const receiptInfo = await receipt.fetch();
      expect(
        receiptInfo.lastInterestAccrualSlot.toNumber()
      ).to.be.approximately(await usp.scp.provider.connection.getSlot(), 3);
      expect(u192ToBN(receiptInfo.borrowedAmount).toString()).to.eq(
        "5000000000000000000"
      );
      expect(u192ToBN(receiptInfo.interestAmount).toString()).to.eq("0");
      expect(u192ToBN(receiptInfo.borrowFeeAmount).toString()).to.eq(
        "100000000000000000"
      );

      const uspWalletInfo = await usp.mint.getAccountInfo(uspWallet);
      expect(uspWalletInfo.amount.toNumber()).to.eq(borrowAmount);
    });
  });
}
