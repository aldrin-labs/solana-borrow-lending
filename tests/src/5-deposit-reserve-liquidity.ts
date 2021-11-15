import { Program, Provider, BN, web3 } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import {
  findLendingMarketPda,
  initLendingMarket,
} from "./1-init-lending-market";
import { CaptureStdoutAndStderr, waitForCommit } from "./helpers";
import { ONE_LIQ_TO_COL_INITIAL_PRICE } from "./consts";
import { initReserve, InitReserveAccounts } from "./3-init-reserve";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { setOraclePriceSlot } from "./pyth";
import { refreshReserveInstruction } from "./4-refresh-reserve";

export function test(
  program: Program<BorrowLending>,
  provider: Provider,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("deposit_reserve_liquidity", () => {
    const market = Keypair.generate();

    let lendingMarketPda: PublicKey,
      accounts: InitReserveAccounts,
      lendingMarketBumpSeed: number;

    before("initialize lending market", async () => {
      await initLendingMarket(program, owner, market, shmemProgramId);
      [lendingMarketPda, lendingMarketBumpSeed] = await findLendingMarketPda(
        program.programId,
        market.publicKey
      );
    });

    before("initialize reserve", async () => {
      accounts = await initReserve(
        program,
        provider.connection,
        shmemProgramId,
        owner,
        market.publicKey,
        lendingMarketPda,
        lendingMarketBumpSeed,
        new BN(50)
      );
      await waitForCommit();
    });

    beforeEach("refresh oracle slot validity", async () => {
      await setOraclePriceSlot(
        provider.connection,
        shmemProgramId,
        owner,
        accounts.oraclePrice.publicKey,
        await provider.connection.getSlot()
      );
    });

    it("fails if provided with reserve liquidity wallet as source wallet");

    it("fails if reserve stale", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const refreshReserve = false;
      await expect(
        depositReserveLiquidity(
          program,
          accounts,
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
        depositReserveLiquidity(
          program,
          accounts,
          lendingMarketPda,
          lendingMarketBumpSeed,
          0
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("amount provided cannot be zero");
    });

    it("deposits liquidity and gets collateral", async () => {
      const liquidityAmount = 50;

      const oldReserveInfo = await program.account.reserve.fetch(
        accounts.reserve.publicKey
      );
      const oldCollateralMintInfo =
        await accounts.reserveCollateralMint.getMintInfo();
      const oldLiquidityMintInfo = await accounts.liquidityMint.getMintInfo();

      const { destinationCollateralWallet } = await depositReserveLiquidity(
        program,
        accounts,
        lendingMarketPda,
        lendingMarketBumpSeed,
        liquidityAmount
      );

      const reserveInfo = await program.account.reserve.fetch(
        accounts.reserve.publicKey
      );
      expect(reserveInfo.lastUpdate.stale).to.be.true;
      expect(reserveInfo.liquidity.availableAmount.toNumber()).to.eq(
        oldReserveInfo.liquidity.availableAmount.toNumber() + liquidityAmount
      );
      expect(reserveInfo.collateral.mintTotalSupply.toNumber()).to.eq(
        oldCollateralMintInfo.supply.toNumber() +
          liquidityAmount * ONE_LIQ_TO_COL_INITIAL_PRICE
      );

      const collateralMintInfo =
        await accounts.reserveCollateralMint.getMintInfo();
      expect(collateralMintInfo.supply.toNumber()).to.eq(
        reserveInfo.collateral.mintTotalSupply.toNumber()
      );

      const liquidityMintInfo = await accounts.liquidityMint.getMintInfo();
      expect(
        liquidityMintInfo.supply.sub(oldLiquidityMintInfo.supply).toNumber()
      ).to.eq(
        reserveInfo.liquidity.availableAmount.toNumber() -
          oldReserveInfo.liquidity.availableAmount.toNumber()
      );

      const destinationCollateralWalletInfo =
        await accounts.reserveCollateralMint.getAccountInfo(
          destinationCollateralWallet
        );
      expect(destinationCollateralWalletInfo.amount.toNumber()).to.eq(
        liquidityAmount * ONE_LIQ_TO_COL_INITIAL_PRICE
      );
    });
  });
}

export interface DepositReserveLiquidityAccounts {
  funder: Keypair;
  sourceLiquidityWallet: PublicKey;
  destinationCollateralWallet: PublicKey;
}

export async function depositReserveLiquidity(
  program: Program<BorrowLending>,
  accounts: InitReserveAccounts,
  lendingMarketPda: PublicKey,
  lendingMarketBumpSeed: number,
  liquidityAmount: number,
  refreshReserve: boolean = true
): Promise<DepositReserveLiquidityAccounts> {
  const funder = Keypair.generate();
  const sourceLiquidityWallet = await accounts.liquidityMint.createAccount(
    funder.publicKey
  );
  await accounts.liquidityMint.mintTo(
    sourceLiquidityWallet,
    accounts.liquidityMintAuthority,
    [],
    50
  );
  const destinationCollateralWallet =
    await accounts.reserveCollateralMint.createAccount(funder.publicKey);

  await program.rpc.depositReserveLiquidity(
    lendingMarketBumpSeed,
    new BN(liquidityAmount),
    {
      accounts: {
        funder: funder.publicKey,
        lendingMarketPda,
        reserve: accounts.reserve.publicKey,
        reserveCollateralMint: accounts.reserveCollateralMint.publicKey,
        reserveLiquidityWallet: accounts.reserveLiquidityWallet.publicKey,
        sourceLiquidityWallet,
        destinationCollateralWallet,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: web3.SYSVAR_CLOCK_PUBKEY,
      },
      signers: [funder],
      instructions: refreshReserve
        ? [
            refreshReserveInstruction(
              program,
              accounts.reserve.publicKey,
              accounts.oraclePrice.publicKey
            ),
          ]
        : [],
    }
  );

  return { funder, sourceLiquidityWallet, destinationCollateralWallet };
}
