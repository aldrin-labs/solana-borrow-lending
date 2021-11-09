import { Program, BN, Provider, web3 } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { initLendingMarket, findLendingMarketPda } from "./init-lending-market";
import { CaptureStdoutAndStderr, wadToBN, waitForCommit } from "./helpers";
import { setOraclePriceSlot, uploadOraclePrice } from "./pyth";
import {
  initReserve,
  InitReserveAccounts,
  reserveConfig,
} from "./init-reserve";

export function test(
  program: Program<BorrowLending>,
  provider: Provider,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("refresh_reserve", () => {
    const market = Keypair.generate();
    const liquidityAmount = 50;
    const config = reserveConfig();

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
        new BN(liquidityAmount),
        config
      );
      await waitForCommit();
    });

    it("fails if oracle price accounts mismatch", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        refreshReserve(
          program,
          accounts.reserve.publicKey,
          Keypair.generate().publicKey
        )
      ).to.eventually.be.rejected;

      stdCapture.restore();
    });

    it("fails if oracle price is outdated", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await setOraclePriceSlot(
        provider.connection,
        shmemProgramId,
        owner,
        accounts.oraclePrice.publicKey,
        (await provider.connection.getSlot()) - 10 // put it into the past
      );
      await waitForCommit();

      await expect(
        refreshReserve(
          program,
          accounts.reserve.publicKey,
          accounts.oraclePrice.publicKey
        )
      ).to.eventually.be.rejected;

      expect(stdCapture.restore()).to.contain("is stale");
    });

    it("refreshes reserve last updated and accrues interest", async () => {
      const reserveBeforeRefresh = await program.account.reserve.fetch(
        accounts.reserve.publicKey
      );
      const initialCumulativeBorrowRate = wadToBN(
        (reserveBeforeRefresh.liquidity.cumulativeBorrowRate as any).wad
      );
      const initialBorrowedAmount = wadToBN(
        (reserveBeforeRefresh.liquidity.borrowedAmount as any).wad
      );

      const slot = await provider.connection.getSlot();
      await setOraclePriceSlot(
        provider.connection,
        shmemProgramId,
        owner,
        accounts.oraclePrice.publicKey,
        slot + 2 // make sure oracle isn't in the past
      );
      await waitForCommit();

      const reserve = await refreshReserve(
        program,
        accounts.reserve.publicKey,
        accounts.oraclePrice.publicKey
      );

      const currentSlot = await provider.connection.getSlot();
      expect(reserve.lastUpdate.stale).to.be.false;
      expect(reserve.lastUpdate.slot.toNumber())
        .to.be.greaterThanOrEqual(currentSlot - 2)
        .and.lessThanOrEqual(currentSlot); // should be very fresh

      // this starts at 1, so even though nothing is borrowed, it's growing
      const cumulativeBorrowRateWithAccruedInterest = wadToBN(
        (reserve.liquidity.cumulativeBorrowRate as any).wad
      );
      expect(
        cumulativeBorrowRateWithAccruedInterest.gt(initialCumulativeBorrowRate)
      ).to.be.true;

      // nothing is borrowed in this test
      const borrowedAmountWithAccruedInterest = wadToBN(
        (reserve.liquidity.borrowedAmount as any).wad
      );
      expect(borrowedAmountWithAccruedInterest.eq(initialBorrowedAmount)).to.be
        .true;
    });
  });
}

export async function refreshReserve(
  program: Program<BorrowLending>,
  reserve: PublicKey,
  oraclePrice: PublicKey
) {
  await program.rpc.refreshReserve({
    accounts: {
      reserve,
      oraclePrice,
      clock: web3.SYSVAR_CLOCK_PUBKEY,
    },
  });

  return program.account.reserve.fetch(reserve);
}
