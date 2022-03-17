import { Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { Component } from "../component";
import { LendingMarket } from "../lending-market";
import { Receipt } from "../receipt";
import { Reserve } from "../reserve";
import { USP } from "../stable-coin";

export function test(owner: Keypair) {
  describe("withdraw_collateral", () => {
    let usp: USP,
      market: LendingMarket,
      receipt: Receipt,
      reserve: Reserve,
      component: Component,
      collateralWallet: PublicKey;

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

    beforeEach("deposits collateral", async () => {
      await receipt.deposit(collateralWallet, 50);
    });

    it("withdraws part of collateral", async () => {
      await receipt.withdraw(collateralWallet, 25);
      const receiptInfo = await receipt.fetch();
      expect(receiptInfo.collateralAmount.toNumber()).to.eq(25);
    });

    it("withdraws all collateral", async () => {
      await receipt.withdraw(collateralWallet, 10_000_000);
      const receiptInfo = await receipt.fetch();
      expect(receiptInfo.collateralAmount.toNumber()).to.eq(0);
    });
  });
}
