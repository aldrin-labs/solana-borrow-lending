import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { CaptureStdoutAndStderr, waitForCommit } from "./helpers";
import { ONE_LIQ_TO_COL_INITIAL_PRICE } from "./consts";
import { LendingMarket } from "./lending-market";
import { Reserve } from "./reserve";

export function test(
  program: Program<BorrowLending>,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("deposit_reserve_liquidity", () => {
    let market: LendingMarket, reserve: Reserve;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner, shmemProgramId);
    });

    before("initialize reserve", async () => {
      reserve = await market.addReserve(50);
      await waitForCommit();
    });

    beforeEach("refresh oracle slot validity", async () => {
      await reserve.refreshOraclePrice();
    });

    it("fails if provided with reserve liquidity wallet as source wallet");

    it("fails if reserve stale", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const refreshReserve = false;
      await expect(reserve.depositLiquidity(50, refreshReserve)).to.be.rejected;

      expect(stdCapture.restore()).to.contain("needs to be refreshed");
    });

    it("must deposit at least some liquidity", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(reserve.depositLiquidity(0)).to.be.rejected;

      expect(stdCapture.restore()).to.contain("amount provided cannot be zero");
    });

    it("deposits liquidity and gets collateral", async () => {
      const liquidityAmount = 50;

      const oldReserveInfo = await program.account.reserve.fetch(reserve.id);
      const oldCollateralMintInfo =
        await reserve.accounts.reserveCollateralMint.getMintInfo();
      const oldLiquidityMintInfo =
        await reserve.accounts.liquidityMint.getMintInfo();

      const { destinationCollateralWallet } = await reserve.depositLiquidity(
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
