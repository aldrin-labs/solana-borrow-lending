import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../../target/types/borrow_lending";
import { Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { CaptureStdoutAndStderr, waitForCommit } from "../helpers";
import { ONE_LIQ_TO_COL_INITIAL_PRICE } from "../consts";
import { LendingMarket } from "../lending-market";
import { Reserve } from "../reserve";
import { globalContainer } from "../globalContainer";

export function test(owner: Keypair) {
  const program: Program<BorrowLending> = globalContainer.blp;
  describe("deposit_reserve_liquidity", () => {
    let market: LendingMarket, reserve: Reserve;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner);
    });

    before("initialize reserve", async () => {
      reserve = await market.addReserve(50);
      await waitForCommit();
    });

    beforeEach("refresh oracle slot validity", async () => {
      await reserve.refreshOraclePrice();
    });

    it("fails if provided with reserve liquidity wallet as source wallet", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        reserve.deposit(50, {
          sourceLiquidityWallet:
            reserve.accounts.reserveLiquidityWallet.publicKey,
        })
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Reserve liq. wallet mustn't equal source liq. wallet"
      );
    });

    it("fails if reserve collateral supply is destination wallet", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        reserve.deposit(50, {
          destinationCollateralWallet:
            reserve.accounts.reserveCollateralWallet.publicKey,
        })
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Dest. col. wallet mustn't eq. reserve's col. supply"
      );
    });

    it("fails if reserve stale", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(reserve.deposit(50, { refreshReserve: false })).to.be
        .rejected;

      expect(stdCapture.restore()).to.contain("needs to be refreshed");
    });

    it("fails if token program mismatches reserve", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        reserve.deposit(50, {
          tokenProgram: Keypair.generate().publicKey,
        })
      ).to.be.rejected;

      stdCapture.restore();
    });

    it("must deposit at least some liquidity", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(reserve.deposit(0)).to.be.rejected;

      expect(stdCapture.restore()).to.contain("amount provided cannot be zero");
    });

    it("deposits liquidity and gets collateral", async () => {
      const liquidityAmount = 50;

      const oldReserveInfo = await program.account.reserve.fetch(reserve.id);
      const oldCollateralMintInfo =
        await reserve.accounts.reserveCollateralMint.getMintInfo();
      const oldLiquidityMintInfo =
        await reserve.accounts.liquidityMint.getMintInfo();

      const { destinationCollateralWallet } = await reserve.deposit(
        liquidityAmount
      );

      const reserveInfo = await program.account.reserve.fetch(reserve.id);
      expect(reserveInfo.lastUpdate.stale).to.be.true;
      expect(reserveInfo.liquidity.availableAmount.toNumber()).to.eq(
        oldReserveInfo.liquidity.availableAmount.toNumber() + liquidityAmount
      );
      expect(reserveInfo.collateral.mintTotalSupply.toNumber()).to.eq(
        oldCollateralMintInfo.supply.toNumber() +
          liquidityAmount * ONE_LIQ_TO_COL_INITIAL_PRICE
      );

      const collateralMintInfo =
        await reserve.accounts.reserveCollateralMint.getMintInfo();
      expect(collateralMintInfo.supply.toNumber()).to.eq(
        reserveInfo.collateral.mintTotalSupply.toNumber()
      );

      const liquidityMintInfo =
        await reserve.accounts.liquidityMint.getMintInfo();
      expect(
        liquidityMintInfo.supply.sub(oldLiquidityMintInfo.supply).toNumber()
      ).to.eq(
        reserveInfo.liquidity.availableAmount.toNumber() -
          oldReserveInfo.liquidity.availableAmount.toNumber()
      );

      const destinationCollateralWalletInfo =
        await reserve.accounts.reserveCollateralMint.getAccountInfo(
          destinationCollateralWallet
        );
      expect(destinationCollateralWalletInfo.amount.toNumber()).to.eq(
        liquidityAmount * ONE_LIQ_TO_COL_INITIAL_PRICE
      );
    });
  });
}
