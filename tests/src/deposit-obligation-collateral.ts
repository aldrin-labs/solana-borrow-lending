import { Program, Provider, BN } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { PublicKey, Keypair, SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";
import { expect } from "chai";
import { findLendingMarketPda, initLendingMarket } from "./init-lending-market";
import { CaptureStdoutAndStderr, u192ToBN, waitForCommit } from "./helpers";
import { ONE_LIQ_TO_COL_INITIAL_PRICE } from "./consts";
import {
  initReserve,
  InitReserveAccounts,
  reserveConfig,
} from "./init-reserve";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { setOraclePriceSlot } from "./pyth";
import { refreshReserveInstruction } from "./refresh-reserve";
import { initObligationR10 } from "./init-obligation";
import { depositReserveLiquidity } from "./deposit-reserve-liquidity";

export function test(
  program: Program<BorrowLending>,
  provider: Provider,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("deposit_obligation_collateral", () => {
    const market = Keypair.generate();
    const borrower = Keypair.generate();
    const obligation = Keypair.generate();

    let sourceCollateralWalletAmount = 30;
    let lendingMarketPda: PublicKey,
      reserveAccounts: InitReserveAccounts,
      lendingMarketBumpSeed: number,
      sourceCollateralWallet: PublicKey;

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
        new BN(50)
      );
    });

    before("initialize obligation", async () => {
      await initObligationR10(program, borrower, market.publicKey, obligation);
    });

    before("mint reserve collateral for borrower", async () => {
      sourceCollateralWallet =
        await reserveAccounts.reserveCollateralMint.createAccount(
          borrower.publicKey
        );

      await refreshOracleSlotValidity();

      const depositAccounts = await depositReserveLiquidity(
        program,
        reserveAccounts,
        lendingMarketPda,
        lendingMarketBumpSeed,
        sourceCollateralWalletAmount / ONE_LIQ_TO_COL_INITIAL_PRICE
      );
      await reserveAccounts.reserveCollateralMint.transfer(
        depositAccounts.destinationCollateralWallet,
        sourceCollateralWallet,
        depositAccounts.funder,
        [],
        sourceCollateralWalletAmount
      );
    });

    beforeEach("refresh oracle slot validity", refreshOracleSlotValidity);

    it("fails if borrower doesn't match obligation owner", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        depositObligationCollateral(
          program,
          Keypair.generate(),
          obligation.publicKey,
          sourceCollateralWallet,
          reserveAccounts,
          10
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("owner is not allowed");
    });

    it("fails if obligation and reserve market mismatch", async () => {
      const differentMarket = Keypair.generate();
      const differentMarketObligation = Keypair.generate();
      await initLendingMarket(program, owner, differentMarket, shmemProgramId);
      await initObligationR10(
        program,
        borrower,
        differentMarket.publicKey,
        differentMarketObligation
      );

      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        depositObligationCollateral(
          program,
          borrower,
          differentMarketObligation.publicKey,
          sourceCollateralWallet,
          reserveAccounts,
          10
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "must belong to the same lending market"
      );
    });

    it("fails if reserve is stale", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const refreshReserve = false;
      await expect(
        depositObligationCollateral(
          program,
          borrower,
          obligation.publicKey,
          sourceCollateralWallet,
          reserveAccounts,
          10,
          refreshReserve
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("[ReserveStale]");
    });

    it("fails if loan to value ratio is zero", async () => {
      const config = reserveConfig();
      config.conf.loanToValueRatio.percent = 0;
      const reserveAccounts = await initReserve(
        program,
        provider.connection,
        shmemProgramId,
        owner,
        market.publicKey,
        lendingMarketPda,
        lendingMarketBumpSeed,
        new BN(10),
        config
      );

      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        depositObligationCollateral(
          program,
          borrower,
          obligation.publicKey,
          sourceCollateralWallet,
          reserveAccounts,
          10
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("not be used as a collateral");
    });

    it("fails if destination wallet equals source wallet", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        depositObligationCollateral(
          program,
          borrower,
          obligation.publicKey,
          reserveAccounts.reserveCollateralWallet.publicKey,
          reserveAccounts,
          10
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Destination wallet musn't equal source wallet"
      );
    });

    it("fails if destination wallet doesn't match supply wallet", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      // temporarily use a wrong settings which will not match the data stored
      // in the reserve account, but remember the correct settings so that we
      // can restore to it after the test
      const trueReserveCollateralWallet =
        reserveAccounts.reserveCollateralWallet;
      reserveAccounts.reserveCollateralWallet = Keypair.generate();

      await expect(
        depositObligationCollateral(
          program,
          borrower,
          obligation.publicKey,
          sourceCollateralWallet,
          reserveAccounts,
          10
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Dest. wallet must match reserve config collateral supply"
      );

      // restore the original settings
      reserveAccounts.reserveCollateralWallet = trueReserveCollateralWallet;
    });

    it("fails if collateral amount is zero", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        depositObligationCollateral(
          program,
          borrower,
          obligation.publicKey,
          sourceCollateralWallet,
          reserveAccounts,
          0
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Collateral amount to deposit mustn't be zero"
      );
    });

    it("fails if borrower doesn't have enough collateral", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        depositObligationCollateral(
          program,
          borrower,
          obligation.publicKey,
          sourceCollateralWallet,
          reserveAccounts,
          1000
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("insufficient funds");
    });

    it("fails if borrower isn't signer", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const sign = false;
      await expect(
        depositObligationCollateral(
          program,
          borrower,
          obligation.publicKey,
          sourceCollateralWallet,
          reserveAccounts,
          10,
          true,
          sign
        )
      ).to.be.rejected;

      stdCapture.restore();
    });

    it("deposits collateral", async () => {
      await depositObligationCollateral(
        program,
        borrower,
        obligation.publicKey,
        sourceCollateralWallet,
        reserveAccounts,
        10
      );
      sourceCollateralWalletAmount -= 10;

      const obligationInfo = await program.account.obligation.fetch(
        obligation.publicKey
      );
      expect(obligationInfo.lastUpdate.stale).to.be.true;

      const reserves = obligationInfo.reserves as any[];
      const newCollateral = reserves.shift().collateral.inner;
      expect(reserves).to.deep.eq(
        new Array(9).fill(undefined).map(() => ({ empty: {} }))
      );

      expect(newCollateral.depositReserve).to.deep.eq(
        reserveAccounts.reserve.publicKey
      );
      expect(newCollateral.depositedAmount.toNumber()).to.eq(10);

      // we need to refresh the obligation for these values to recalculate
      expect(u192ToBN(newCollateral.marketValue).toNumber()).to.eq(0);
      expect(u192ToBN(obligationInfo.borrowedValue).toNumber()).to.eq(0);
      expect(u192ToBN(obligationInfo.depositedValue).toNumber()).to.eq(0);
      expect(u192ToBN(obligationInfo.allowedBorrowValue).toNumber()).to.eq(0);
      expect(u192ToBN(obligationInfo.unhealthyBorrowValue).toNumber()).to.eq(0);
    });

    async function refreshOracleSlotValidity() {
      // allows us to make more operations before calling the endpoint
      const intoTheFuture = 10;

      await setOraclePriceSlot(
        provider.connection,
        shmemProgramId,
        owner,
        reserveAccounts.oraclePrice.publicKey,
        (await provider.connection.getSlot()) + intoTheFuture
      );
    }
  });
}

export async function depositObligationCollateral(
  program: Program<BorrowLending>,
  borrower: Keypair,
  obligation: PublicKey,
  sourceCollateralWallet: PublicKey,
  accounts: InitReserveAccounts,
  collateralAmount: number,
  refreshReserve: boolean = true,
  sign: boolean = true
) {
  await program.rpc.depositObligationCollateral(new BN(collateralAmount), {
    accounts: {
      borrower: borrower.publicKey,
      obligation,
      sourceCollateralWallet,
      reserve: accounts.reserve.publicKey,
      destinationCollateralWallet: accounts.reserveCollateralWallet.publicKey,
      clock: SYSVAR_CLOCK_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
    },
    signers: sign ? [borrower] : [],
    instructions: refreshReserve
      ? [
          refreshReserveInstruction(
            program,
            accounts.reserve.publicKey,
            accounts.oraclePrice.publicKey
          ),
        ]
      : [],
  });
}
