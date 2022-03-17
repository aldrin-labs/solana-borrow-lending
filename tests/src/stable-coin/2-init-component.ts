import { Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { Component } from "../component";
import { LendingMarket } from "../lending-market";
import { Reserve } from "../reserve";
import { USP } from "../stable-coin";

export function test(owner: Keypair) {
  describe("init_component", () => {
    let usp: USP, market: LendingMarket, reserve: Reserve;

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

    it("validates config");
    it("fails if admin is incorrect");
    it("fails freeze wallet isn't owned by pda");
    it("fails freeze wallet isn't the same mint as component");
    it("fails freeze wallet has a close authority");
    it("fails fee wallet has a close authority");
    it("fails fee wallet isn't the same mint as component");
    it("inits component with reserve collateral mint");

    it("inits component with reserve liquidity mint", async () => {
      const component = await Component.init(
        usp,
        reserve,
        reserve.accounts.liquidityMint
      );

      const componentInfo = await component.fetch();
      expect(componentInfo.freezeWallet).to.deep.eq(
        component.accounts.freezeWallet
      );
      expect(componentInfo.feeWallet).to.deep.eq(component.accounts.feeWallet);
    });
  });
}
