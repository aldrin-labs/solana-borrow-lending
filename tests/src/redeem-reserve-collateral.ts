import { Program, Provider, BN, web3 } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { findLendingMarketPda, initLendingMarket } from "./init-lending-market";
import { CaptureStdoutAndStderr, waitForCommit } from "./helpers";
import { ONE_LIQ_TO_COL_INITIAL_PRICE } from "./consts";
import {
  initReserve,
  InitReserveAccounts,
  reserveConfig,
} from "./init-reserve";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { setOraclePriceSlot } from "./pyth";
import { refreshReserveInstruction } from "./refresh-reserve";
import {
  depositReserveLiquidity,
  DepositReserveLiquidityAccounts,
} from "./deposit-reserve-liquidity";

export function test(
  program: Program<BorrowLending>,
  provider: Provider,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("redeem_reserve_collateral", () => {
    const market = Keypair.generate();
    const config = reserveConfig();
    const depositedLiquidity = 50;

    let lendingMarketPda: PublicKey,
      reserveAccounts: InitReserveAccounts,
      depositAccounts: DepositReserveLiquidityAccounts,
      lendingMarketBumpSeed: number;

    before("initialize lending market", async () => {
      await initLendingMarket(program, owner, market, shmemProgramId);
      [lendingMarketPda, lendingMarketBumpSeed] = await findLendingMarketPda(
        program.programId,
        market.publicKey
      );
    });

    before("initialize reserve", async () => {
      reserveAccounts = await initReserve(
        program,
        provider.connection,
        shmemProgramId,
        owner,
        market.publicKey,
        lendingMarketPda,
        lendingMarketBumpSeed,
        new BN(50),
        config
      );
      await waitForCommit();
    });

    beforeEach("refresh oracle slot validity", async () => {
      await setOraclePriceSlot(
        provider.connection,
        shmemProgramId,
        owner,
        reserveAccounts.oraclePrice.publicKey,
        (await provider.connection.getSlot()) + 2
      );
    });

    beforeEach("deposit liquidity", async () => {
      depositAccounts = await depositReserveLiquidity(
        program,
        reserveAccounts,
        lendingMarketPda,
        lendingMarketBumpSeed,
        depositedLiquidity
      );
    });

    it("fails if destination liquidity wallet equals reserve liquidity wallet");
    it("fails if source collateral wallet equals reserve collateral wallet");

    it("fails if reserve stale", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const refreshReserve = false;
      await expect(
        redeemReserveCollateral(
          program,
          reserveAccounts,
          depositAccounts,
          lendingMarketPda,
          lendingMarketBumpSeed,
          50,
          refreshReserve
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("needs to be refreshed");
    });

    it("must deposit at least some liquidity", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        redeemReserveCollateral(
          program,
          reserveAccounts,
          depositAccounts,
          lendingMarketPda,
          lendingMarketBumpSeed,
          0
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("amount provided cannot be zero");
    });

    it("redeems collateral and receives liquidity", async () => {
      const collateralAmount = 200;

      const oldReserveInfo = await program.account.reserve.fetch(
        reserveAccounts.reserve.publicKey
      );
      const oldCollateralMintInfo =
        await reserveAccounts.reserveCollateralMint.getMintInfo();

      await redeemReserveCollateral(
        program,
        reserveAccounts,
        depositAccounts,
        lendingMarketPda,
        lendingMarketBumpSeed,
        collateralAmount
      );

      const reserveInfo = await program.account.reserve.fetch(
        reserveAccounts.reserve.publicKey
      );
      expect(reserveInfo.lastUpdate.stale).to.be.true;
      expect(reserveInfo.liquidity.availableAmount.toNumber()).to.eq(
        oldReserveInfo.liquidity.availableAmount.toNumber() -
          collateralAmount / ONE_LIQ_TO_COL_INITIAL_PRICE
      );

      const collateralMintInfo =
        await reserveAccounts.reserveCollateralMint.getMintInfo();
      expect(collateralMintInfo.supply.toNumber()).to.eq(
        oldCollateralMintInfo.supply.toNumber() - collateralAmount
      );
      expect(reserveInfo.collateral.mintTotalSupply.toNumber()).to.eq(
        collateralMintInfo.supply.toNumber()
      );

      const redeemDestinationWallet =
        await reserveAccounts.liquidityMint.getAccountInfo(
          depositAccounts.sourceLiquidityWallet
        );
      expect(redeemDestinationWallet.amount.toNumber()).to.eq(
        collateralAmount / ONE_LIQ_TO_COL_INITIAL_PRICE
      );

      const redeemSourceWallet =
        await reserveAccounts.reserveCollateralMint.getAccountInfo(
          depositAccounts.destinationCollateralWallet
        );
      expect(redeemSourceWallet.amount.toNumber()).to.eq(50);
    });
  });
}

export async function redeemReserveCollateral(
  program: Program<BorrowLending>,
  reserveAccounts: InitReserveAccounts,
  depositAccounts: DepositReserveLiquidityAccounts,
  lendingMarketPda: PublicKey,
  lendingMarketBumpSeed: number,
  collateralAmount: number,
  refreshReserve: boolean = true
) {
  await program.rpc.redeemReserveCollateral(
    lendingMarketBumpSeed,
    new BN(collateralAmount),
    {
      accounts: {
        funder: depositAccounts.funder.publicKey,
        lendingMarketPda,
        reserve: reserveAccounts.reserve.publicKey,
        reserveCollateralMint: reserveAccounts.reserveCollateralMint.publicKey,
        reserveLiquidityWallet:
          reserveAccounts.reserveLiquidityWallet.publicKey,
        destinationLiquidityWallet: depositAccounts.sourceLiquidityWallet,
        sourceCollateralWallet: depositAccounts.destinationCollateralWallet,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: web3.SYSVAR_CLOCK_PUBKEY,
      },
      signers: [depositAccounts.funder],
      instructions: refreshReserve
        ? [
            refreshReserveInstruction(
              program,
              reserveAccounts.reserve.publicKey,
              reserveAccounts.oraclePrice.publicKey
            ),
          ]
        : [],
    }
  );
}
