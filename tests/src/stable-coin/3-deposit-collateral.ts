import { Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { Component } from "../component";
import { u192ToBN } from "../helpers";
import { LendingMarket } from "../lending-market";
import { Receipt } from "../receipt";
import { Reserve } from "../reserve";
import { USP } from "../stable-coin";

export function test(owner: Keypair) {
  describe("deposit_collateral", () => {
    let usp: USP,
      market: LendingMarket,
      receipt: Receipt,
      reserve: Reserve,
      component: Component;

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

    it("deposits collateral into receipt", async () => {
      const collateralWallet = await reserve.createLiquidityWallet(
        receipt.borrower.publicKey,
        100
      );

      await receipt.deposit(collateralWallet, 50);

      const receiptInfo = await receipt.fetch();
      expect(receiptInfo.borrower).to.deep.eq(receipt.borrower.publicKey);
      expect(receiptInfo.component).to.deep.eq(component.id);
      expect(receiptInfo.collateralAmount.toNumber()).to.eq(50);
      expect(u192ToBN(receiptInfo.interestAmount).toNumber()).to.eq(0);
      expect(u192ToBN(receiptInfo.borrowedAmount).toNumber()).to.eq(0);
    });
  });
}
