import { Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { AmmPool } from "../amm-pool";
import { Component } from "../component";
import { DEFAULT_SRM_PRICE } from "../consts";
import { globalContainer } from "../global-container";
import {
  CaptureStdoutAndStderr,
  ONE_WAD,
  u192ToBN,
  waitForCommit,
} from "../helpers";
import { LendingMarket } from "../lending-market";
import { Receipt } from "../receipt";
import { Reserve } from "../reserve";
import { USP } from "../stable-coin";
import { TokenWrapper } from "../token-wrapper";

export function test(owner: Keypair) {
  describe.only("USP leverage on aldrin AMM", () => {
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
        100
      );
      await receipt.deposit(srmWallet, 100);
    });

    it("cannot borrow initial amount greater than collateral", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        receipt.leverageOnAldrinAmm(
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
    it("fails if collateral ration is higher than max col. ratio");
    it("fails if mint allowance is not enough");

    it("starts leverage", async () => {
      await receipt.leverageOnAldrinAmm(
        uspDogePool,
        dogeSrmPool,
        uspWallet,
        srmWallet,
        dogeWallet,
        0.5,
        1_000
      );
    });
  });
}
