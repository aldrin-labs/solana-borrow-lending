import { Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { Component } from "../component";
import { u192ToBN } from "../helpers";
import { LendingMarket } from "../lending-market";
import { Receipt } from "../receipt";
import { Reserve } from "../reserve";
import { USP } from "../stable-coin";

export function test(owner: Keypair) {
  describe.only("deposit_collateral", () => {
    let usp: USP, market: LendingMarket, reserve: Reserve, component: Component;

    before("inits usp", async () => {
      usp = await USP.init(owner);
    });
    before("initialize lending market", async () => {
      market = await LendingMarket.init(undefined, owner);
    });

    beforeEach("initialize reserve", async () => {
      reserve = await market.addReserve(1);
      await reserve.refreshOraclePrice(999);
    });

    beforeEach("initialize component", async () => {
      component = await Component.init(
        usp,
        reserve,
        reserve.accounts.liquidityMint
      );
    });

    it("deposits collateral into receipt", async () => {
      const borrower = Keypair.generate();
      const receipt = await Receipt.init(component, borrower);

      const collateralWallet = await reserve.createLiquidityWallet(
        borrower.publicKey,
        100
      );

      await receipt.deposit(collateralWallet, 50);

      const receiptInfo = await receipt.fetch();
      expect(receiptInfo.borrower).to.deep.eq(borrower.publicKey);
      expect(receiptInfo.component).to.deep.eq(component.id);
      expect(receiptInfo.collateralAmount.toNumber()).to.eq(50);
      expect(u192ToBN(receiptInfo.interestAmount).toNumber()).to.eq(0);
      expect(u192ToBN(receiptInfo.borrowedAmount).toNumber()).to.eq(0);
    });
  });
}
