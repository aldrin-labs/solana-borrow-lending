import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { CaptureStdoutAndStderr, waitForCommit } from "./helpers";
import { setOraclePriceSlot } from "./pyth";
import { LendingMarket } from "./lending-market";
import { Reserve, ReserveBuilder } from "./reserve";

export function test(
  program: Program<BorrowLending>,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("init_reserve", () => {
    let market: LendingMarket;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner, shmemProgramId);
    });

    it("must init with at least some liquidity", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      // this should make the program fail
      const liquidityAmount = 0;
      await expect(market.addReserve(liquidityAmount)).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "must be initialized with liquidity"
      );
    });

    it("fails on invalid config", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const liquidityAmount = 10;
      const config = Reserve.defaultConfig();
      // this should make the endpoint fail
      config.conf.liquidationBonus.percent = 120;

      await expect(market.addReserve(liquidityAmount, config)).to.be.rejected;

      expect(stdCapture.restore()).to.contain("must be in range [0, 100]");
    });

    it("fails if oracle product's price doesn't match price account", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const someReserve = await market.addReserve(10);

      const builder = await ReserveBuilder.new(market, shmemProgramId, owner);
      builder.accounts.oraclePrice = someReserve.accounts.oraclePrice;
      await expect(builder.build(10)).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "product price account does not match"
      );
    });

    it("fails if oracle currency doesn't match lending market currency", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const differentMarket = await LendingMarket.init(
        program,
        owner,
        shmemProgramId,
        Keypair.generate().publicKey
      );
      await expect(differentMarket.addReserve(10)).to.be.rejected;

      expect(stdCapture.restore()).to.contain("currency does not match");
    });

    it("fails if oracle price last updated slot is too far behind", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const liquidityAmount = 10;

      const builder = await ReserveBuilder.new(
        market,
        shmemProgramId,
        market.owner
      );

      await setOraclePriceSlot(
        market.connection,
        shmemProgramId,
        owner,
        builder.accounts.oraclePrice.publicKey,
        (await market.connection.getSlot()) - 10 // put it into the past
      );
      await waitForCommit();

      await expect(builder.build(liquidityAmount)).to.be.rejected;

      expect(stdCapture.restore()).to.contain("is stale");
    });

    it("initializes all accounts, transfers liquidity and mints collateral", async () => {
      const liquidityAmount = 10;

      const reserve = await market.addReserve(liquidityAmount);

      const reserveAccount = await reserve.fetch();

      expect(reserveAccount.lendingMarket).to.deep.eq(market.id);
      expect(reserveAccount.liquidity.availableAmount.toNumber()).to.eq(
        liquidityAmount
      );
      // TODO: check the rest reserve account
      // TODO: check token accounts
    });
  });
}
