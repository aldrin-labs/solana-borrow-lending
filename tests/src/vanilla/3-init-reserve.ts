import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../../target/types/borrow_lending";
import { Keypair, BPF_LOADER_PROGRAM_ID, BpfLoader } from "@solana/web3.js";
import { expect } from "chai";
import { readFile } from "fs/promises";
import {
  CaptureStdoutAndStderr,
  createProgramAccounts,
  ONE_WAD,
  u192ToBN,
  waitForCommit,
} from "../helpers";
import { oracleProductBinByteLen, setOraclePriceSlot } from "../pyth";
import { LendingMarket } from "../lending-market";
import { Reserve, ReserveBuilder } from "../reserve";
import {
  LIQ_MINTED_TO_RESEVE_SOURCE_WALLET,
  ONE_LIQ_TO_COL_INITIAL_PRICE,
  SHMEM_SO_BIN_PATH,
} from "../consts";
import { globalContainer } from "../global-container";

export function test(owner: Keypair) {
  const program: Program<BorrowLending> = globalContainer.blp;
  describe("init_reserve", () => {
    let market: LendingMarket;
    const anotherShmemProgram = Keypair.generate();

    before("deploys another shmem to simulate different oracle", async () => {
      const programBin = await readFile(SHMEM_SO_BIN_PATH);
      BpfLoader.load(
        program.provider.connection,
        owner,
        anotherShmemProgram,
        programBin,
        BPF_LOADER_PROGRAM_ID
      );
    });

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner);
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
      const someReserve = await market.addReserve(10);

      const builder = await ReserveBuilder.new(market, owner);
      builder.accounts.oraclePrice = someReserve.accounts.oraclePrice;

      const stdCapture = new CaptureStdoutAndStderr();
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
        undefined,
        undefined,
        Keypair.generate().publicKey
      );
      await expect(differentMarket.addReserve(10)).to.be.rejected;

      expect(stdCapture.restore()).to.contain("currency does not match");
    });

    it("fails if oracle price last updated slot is too far behind", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const liquidityAmount = 10;

      const builder = await ReserveBuilder.new(market, market.owner);

      await setOraclePriceSlot(
        market.connection,
        undefined,
        owner,
        builder.accounts.oraclePrice.publicKey,
        0 // put it into the past
      );
      await waitForCommit();

      await expect(builder.build(liquidityAmount)).to.be.rejected;

      expect(stdCapture.restore()).to.contain("is stale");
    });

    it("fails if oracle product owner does not match oracle price owner", async () => {
      const builder = await ReserveBuilder.new(market, owner);

      const anotherOracleProduct = Keypair.generate();
      builder.accounts.oracleProduct = anotherOracleProduct;
      await createProgramAccounts(
        program.provider.connection,
        anotherShmemProgram.publicKey,
        owner,
        [{ keypair: anotherOracleProduct, space: oracleProductBinByteLen() }]
      );
      await waitForCommit();

      const stdCapture = new CaptureStdoutAndStderr();

      await expect(builder.build(10)).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Product's owner must be prices's owner"
      );
    });

    it("initializes all accounts, transfers liquidity and mints collateral", async () => {
      const liquidityAmount = 10;

      const reserve = await market.addReserve(liquidityAmount);

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
        simplePyth: {
          price: reserve.accounts.oraclePrice.publicKey,
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

      const sourceWalletInfo =
        await reserve.accounts.liquidityMint.getAccountInfo(
          reserve.accounts.sourceLiquidityWallet
        );
      expect(sourceWalletInfo.amount.toNumber()).to.eq(
        LIQ_MINTED_TO_RESEVE_SOURCE_WALLET - liquidityAmount
      );

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
  });
}
