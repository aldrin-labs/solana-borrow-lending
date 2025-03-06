import { Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { Component } from "../component";
import { ONE_WAD, u192ToBN } from "../helpers";
import { LendingMarket } from "../lending-market";
import { Receipt } from "../receipt";
import { Reserve } from "../reserve";
import { USP } from "../stable-coin";

export function test(owner: Keypair) {
  describe("repay_stable_coin", () => {
    const borrowAmount = 5;
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

    beforeEach("borrows stable coin", async () => {
      await receipt.borrow(uspWallet, borrowAmount);
    });

    it("repays part of the loan", async () => {
      const repayAmount = Math.floor(borrowAmount / 2);
      await receipt.repay(uspWallet, repayAmount);

      const receiptInfo = await receipt.fetch();
      expect(
        u192ToBN(receiptInfo.borrowedAmount).div(ONE_WAD).toNumber()
      ).to.eq(3);
      expect(u192ToBN(receiptInfo.interestAmount).toNumber()).to.eq(0);
      expect(
        receiptInfo.lastInterestAccrualSlot.toNumber()
      ).to.be.approximately(await usp.scp.provider.connection.getSlot(), 3);

      const uspWalletInfo = await usp.mint.getAccountInfo(uspWallet);
      expect(uspWalletInfo.amount.toNumber()).to.eq(
        borrowAmount - repayAmount - 2 // cost of ceiling the calculations (borrow fee, interest & borrow amount)
      );
    });

    it("repays all of the loan", async () => {
      const airdropAmount = 100;
      await usp.airdrop(uspWallet, airdropAmount);

      await receipt.repay(uspWallet, 10_000_000);

      const receiptInfo = await receipt.fetch();
      expect(u192ToBN(receiptInfo.borrowedAmount).toNumber()).to.eq(0);
      expect(u192ToBN(receiptInfo.interestAmount).toNumber()).to.eq(0);
      expect(
        receiptInfo.lastInterestAccrualSlot.toNumber()
      ).to.be.approximately(await usp.scp.provider.connection.getSlot(), 3);

      const uspWalletInfo = await usp.mint.getAccountInfo(uspWallet);
      expect(uspWalletInfo.amount.toNumber()).to.eq(
        airdropAmount + // we airdropped to cover fees
          borrowAmount - // first we borrowed
          borrowAmount - // then we repayed the same amount
          2 // borrow fee + interest
      );
    });
  });
}
