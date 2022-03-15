import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../../target/types/borrow_lending";
import {
  BpfLoader,
  BPF_LOADER_PROGRAM_ID,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import { readFile } from "fs/promises";
import { Reserve, ReserveBuilder } from "../reserve";
import { LendingMarket } from "../lending-market";
import { expect } from "chai";
import {
  CaptureStdoutAndStderr,
  createProgramAccounts,
  ONE_WAD,
  u192ToBN,
  waitForCommit,
} from "../helpers";
import { AmmPool } from "../amm-pool";
import { ONE_LIQ_TO_COL_INITIAL_PRICE, SHMEM_SO_BIN_PATH } from "../consts";
import { oracleProductBinByteLen } from "../pyth";
import { globalContainer } from "../globalContainer";

export function test(owner: Keypair) {
  const { amm, blp, ammAuthority } = globalContainer;
  describe("reserve of Aldrin's AMM unstable LP token", () => {
    const funder = Keypair.generate();
    const anotherShmemProgram = Keypair.generate();

    let market: LendingMarket,
      reserveSrm: Reserve,
      reserveDoge: Reserve,
      ammPool: AmmPool,
      funderLpWallet: PublicKey;

    before("deploys another shmem to simulate different oracle", async () => {
      const programBin = await readFile(SHMEM_SO_BIN_PATH);
      BpfLoader.load(
        blp.provider.connection,
        owner,
        anotherShmemProgram,
        programBin,
        BPF_LOADER_PROGRAM_ID
      );
    });

    before("initialize lending market", async () => {
      market = await LendingMarket.init(blp, owner, undefined, amm.programId);
    });

    before("initialize standard reserves", async () => {
      reserveSrm = await market.addReserve(1000, undefined, "srm");
      reserveDoge = await market.addReserve(1000, undefined, "doge");

      await reserveDoge.refreshOraclePrice(999);
      await reserveSrm.refreshOraclePrice(999);
    });

    before("initialize liquidity pool", async () => {
      ammPool = await AmmPool.init(
        amm,
        market,
        ammAuthority,
        reserveSrm,
        reserveDoge
      );
    });

    beforeEach("creates funder's LP wallet", async () => {
      funderLpWallet = await ammPool.accounts.mint.createAccount(
        funder.publicKey
      );
      await ammPool.airdropLpTokens(funderLpWallet, 100);
    });

    it("must init with at least some liquidity", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      // this should make the program fail
      const liquidityAmount = 0;
      await expect(
        market.addReserveAldrinUnstableLpToken(ammPool, liquidityAmount)
      ).to.be.rejected;

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

      await expect(
        market.addReserveAldrinUnstableLpToken(ammPool, liquidityAmount, config)
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("must be in range [0, 100]");
    });

    it("fails if oracle product's price doesn't match price account", async () => {
      const someReserve = await market.addReserveAldrinUnstableLpToken(
        ammPool,
        10
      );

      const builder = await ReserveBuilder.new(market, owner);
      builder.accounts.oraclePrice = someReserve.accounts.oraclePrice;

      const stdCapture = new CaptureStdoutAndStderr();
      await expect(builder.buildAldrinUnstableLpToken(ammPool, 10)).to.be
        .rejected;

      expect(stdCapture.restore()).to.contain(
        "product price account does not match"
      );
    });

    it("fails if oracle currency doesn't match lending market currency", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const differentMarket = await LendingMarket.init(
        blp,
        owner,
        undefined,
        amm.programId,
        Keypair.generate().publicKey
      );
      await expect(differentMarket.addReserveAldrinUnstableLpToken(ammPool, 10))
        .to.be.rejected;

      expect(stdCapture.restore()).to.contain("currency does not match");
    });

    it("fails if oracle product owner does not match oracle price owner", async () => {
      const builder = await ReserveBuilder.new(market, owner);

      const anotherOracleProduct = Keypair.generate();
      builder.accounts.oracleProduct = anotherOracleProduct;
      await createProgramAccounts(
        blp.provider.connection,
        anotherShmemProgram.publicKey,
        owner,
        [{ keypair: anotherOracleProduct, space: oracleProductBinByteLen() }]
      );
      await waitForCommit();

      const stdCapture = new CaptureStdoutAndStderr();

      await expect(builder.buildAldrinUnstableLpToken(ammPool, 10)).to.be
        .rejected;

      expect(stdCapture.restore()).to.contain(
        "Product's owner must be prices's owner"
      );
    });

    it("initializes all accounts, transfers liquidity and mints collateral", async () => {
      const liquidityAmount = 10;

      const reserve = await market.addReserveAldrinUnstableLpToken(
        ammPool,
        liquidityAmount
      );

      const reserveAccount = await reserve.fetch();

      expect(reserveAccount.lastUpdate.stale).to.be.true;
      expect(reserveAccount.lendingMarket).to.deep.eq(market.id);
      const liq = reserveAccount.liquidity;
      expect(liq.availableAmount.toNumber()).to.eq(liquidityAmount);
      expect(liq.mintDecimals).to.eq(
        (await reserve.accounts.liquidityMint.getMintInfo()).decimals
      );
      expect(liq.mint).to.deep.eq(reserve.accounts.liquidityMint.publicKey);
      expect(liq.supply).to.deep.eq(
        reserve.accounts.reserveLiquidityWallet.publicKey
      );
      expect(liq.feeReceiver).to.deep.eq(
        reserve.accounts.reserveLiquidityFeeRecvWallet.publicKey
      );
      expect(liq.oracle).to.deep.eq({
        aldrinAmmLpPyth: {
          price: reserve.accounts.oraclePrice.publicKey,
          lpTokenMint: reserve.accounts.liquidityMint.publicKey,
          vault: ammPool.accounts.vaultBase,
        },
      });
      expect(u192ToBN(liq.borrowedAmount).toNumber()).to.eq(0);
      expect(u192ToBN(liq.cumulativeBorrowRate).eq(ONE_WAD)).to.be.true;
      expect(u192ToBN(liq.marketPrice).toString()).to.eq("7382500000000000000");

      const col = reserveAccount.collateral;
      expect(col.mint).to.deep.eq(
        reserve.accounts.reserveCollateralMint.publicKey
      );
      expect(col.supply).to.deep.eq(
        reserve.accounts.reserveCollateralWallet.publicKey
      );
      expect(col.mintTotalSupply.toNumber()).to.eq(
        liquidityAmount * ONE_LIQ_TO_COL_INITIAL_PRICE
      );

      // unfortunately sometimes the inner representation is padded with zeros,
      // so we cannot just deep.eq
      expect(
        (reserveAccount.config.maxLeverage as any).percent.toNumber()
      ).to.eq(Reserve.defaultConfig().conf.maxLeverage.percent.toNumber());
      reserveAccount.config.maxLeverage = Reserve.defaultConfig().conf
        .maxLeverage as never;
      expect(reserveAccount.config).to.deep.eq(Reserve.defaultConfig().conf);

      const destWalletInfo =
        await reserve.accounts.reserveCollateralMint.getAccountInfo(
          reserve.accounts.destinationCollateralWallet.publicKey
        );
      expect(destWalletInfo.amount.toNumber()).to.eq(
        liquidityAmount * ONE_LIQ_TO_COL_INITIAL_PRICE
      );

      const reserveLiqInfo =
        await reserve.accounts.liquidityMint.getAccountInfo(
          reserve.accounts.reserveLiquidityWallet.publicKey
        );
      expect(reserveLiqInfo.amount.toNumber()).to.eq(liquidityAmount);

      const reserveColInfo =
        await reserve.accounts.reserveCollateralMint.getAccountInfo(
          reserve.accounts.reserveCollateralWallet.publicKey
        );
      expect(reserveColInfo.amount.toNumber()).to.eq(0);
    });

    it("uses quote token for establishing price", async () => {
      const liquidityAmount = 10;
      const isOracleForBaseVault = false;

      const reserve = await market.addReserveAldrinUnstableLpToken(
        ammPool,
        liquidityAmount,
        undefined,
        isOracleForBaseVault
      );

      const reserveAccount = await reserve.fetch();
      expect(reserveAccount.liquidity.oracle).to.deep.eq({
        aldrinAmmLpPyth: {
          price: reserve.accounts.oraclePrice.publicKey,
          lpTokenMint: reserve.accounts.liquidityMint.publicKey,
          vault: ammPool.accounts.vaultQuote,
        },
      });
    });

    it("refreshes reserve", async () => {
      const reserve = await market.addReserveAldrinUnstableLpToken(
        ammPool,
        100
      );

      const reserveInfoBefore = await reserve.fetch();

      await waitForCommit();
      await reserve.refresh();
      await waitForCommit();
      await reserve.refresh();

      const reserveInfoAfter = await reserve.fetch();

      expect(reserveInfoBefore.lastUpdate.slot.toNumber()).to.be.lessThan(
        reserveInfoAfter.lastUpdate.slot.toNumber()
      );
      expect(reserveInfoAfter.lastUpdate.stale).to.be.false;
    });

    it("fails if oracle price accounts mismatch", async () => {
      const reserve = await market.addReserveAldrinUnstableLpToken(
        ammPool,
        100
      );

      const stdCapture = new CaptureStdoutAndStderr();

      reserve.accounts.oraclePrice = Keypair.generate();

      await expect(reserve.refresh()).to.be.rejected;

      stdCapture.restore();
    });

    it("fails if amm vault mismatches", async () => {
      const reserve = await market.addReserveAldrinUnstableLpToken(
        ammPool,
        100
      );

      const stdCapture = new CaptureStdoutAndStderr();

      reserve.kind.aldrinAmmLpPyth.vault =
        reserve.accounts.sourceLiquidityWallet;

      await expect(reserve.refresh()).to.be.rejected;

      stdCapture.restore();
    });

    it("fails if amm lp token mint", async () => {
      const reserve = await market.addReserveAldrinUnstableLpToken(
        ammPool,
        100
      );

      const stdCapture = new CaptureStdoutAndStderr();

      reserve.kind.aldrinAmmLpPyth.lpTokenMint =
        reserve.accounts.reserveCollateralMint.publicKey;

      await expect(reserve.refresh()).to.be.rejected;

      stdCapture.restore();
    });

    it("fails if oracle price is outdated", async () => {
      const reserve = await market.addReserveAldrinUnstableLpToken(
        ammPool,
        100
      );

      const stdCapture = new CaptureStdoutAndStderr();

      // put it into the past
      await reserve.refreshOraclePrice(-(await market.connection.getSlot()));
      await waitForCommit();

      await expect(reserve.refresh()).to.be.rejected;

      expect(stdCapture.restore()).to.contain("is stale");
    });
  });
}
