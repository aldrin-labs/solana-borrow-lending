import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../../target/types/borrow_lending";
import { Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { CaptureStdoutAndStderr, waitForCommit } from "../helpers";
import { ONE_LIQ_TO_COL_INITIAL_PRICE } from "../consts";
import { LendingMarket } from "../lending-market";
import { DepositReserveLiquidityAccounts, Reserve } from "../reserve";
import { globalContainer } from "../globalContainer";

export function test(owner: Keypair) {
  const program: Program<BorrowLending> = globalContainer.blp;
  describe("redeem_reserve_collateral", () => {
    const depositAmount = 50;

    let market: LendingMarket,
      reserve: Reserve,
      depositAccounts: DepositReserveLiquidityAccounts;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner);
    });

    before("initialize reserve", async () => {
      reserve = await market.addReserve(10);
      await waitForCommit();
    });

    beforeEach("refresh oracle slot validity", async () => {
      reserve.refreshOraclePrice(2);
    });

    beforeEach("deposit liquidity", async () => {
      depositAccounts = await reserve.deposit(depositAmount);
    });

    it("fails if destination liquidity wallet equals reserve liquidity wallet", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        reserve.redeem(
          {
            ...depositAccounts,
            destinationCollateralWallet:
              reserve.accounts.reserveCollateralWallet.publicKey,
          },
          50
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Source col. wallet mustn't equal to reserve col. wallet"
      );
    });

    it("fails if source collateral wallet equals reserve collateral wallet", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        reserve.redeem(
          {
            ...depositAccounts,
            sourceLiquidityWallet:
              reserve.accounts.reserveLiquidityWallet.publicKey,
          },
          50
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Dest. liq. wallet musn't equal to reserve liq. wallet"
      );
    });

    it("fails if token program mismatches reserve", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        reserve.redeem(depositAccounts, 50, {
          tokenProgram: Keypair.generate().publicKey,
        })
      ).to.be.rejected;

      stdCapture.restore();
    });

    it("fails if reserve stale", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        reserve.redeem(depositAccounts, 50, { refreshReserve: false })
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("needs to be refreshed");
    });

    it("must deposit at least some liquidity", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(reserve.redeem(depositAccounts, 0)).to.be.rejected;

      expect(stdCapture.restore()).to.contain("amount provided cannot be zero");
    });

    it("redeems collateral and receives liquidity", async () => {
      const collateralAmountToRetain = 10;
      const collateralAmountToRedeem =
        (depositAmount - collateralAmountToRetain) *
        ONE_LIQ_TO_COL_INITIAL_PRICE;

      const oldReserveInfo = await program.account.reserve.fetch(reserve.id);
      const oldCollateralMintInfo =
        await reserve.accounts.reserveCollateralMint.getMintInfo();

      await reserve.redeem(depositAccounts, collateralAmountToRedeem);

      const reserveInfo = await reserve.fetch();
      expect(reserveInfo.lastUpdate.stale).to.be.true;
      expect(reserveInfo.liquidity.availableAmount.toNumber()).to.eq(
        oldReserveInfo.liquidity.availableAmount.toNumber() -
          collateralAmountToRedeem / ONE_LIQ_TO_COL_INITIAL_PRICE
      );

      const collateralMintInfo =
        await reserve.accounts.reserveCollateralMint.getMintInfo();
      expect(collateralMintInfo.supply.toNumber()).to.eq(
        oldCollateralMintInfo.supply.toNumber() - collateralAmountToRedeem
      );
      expect(reserveInfo.collateral.mintTotalSupply.toNumber()).to.eq(
        collateralMintInfo.supply.toNumber()
      );

      const redeemDestinationWallet =
        await reserve.accounts.liquidityMint.getAccountInfo(
          depositAccounts.sourceLiquidityWallet
        );
      expect(redeemDestinationWallet.amount.toNumber()).to.eq(
        collateralAmountToRedeem / ONE_LIQ_TO_COL_INITIAL_PRICE
      );

      const redeemSourceWallet =
        await reserve.accounts.reserveCollateralMint.getAccountInfo(
          depositAccounts.destinationCollateralWallet
        );
      expect(redeemSourceWallet.amount.toNumber()).to.eq(
        collateralAmountToRetain
      );
    });
  });
}
