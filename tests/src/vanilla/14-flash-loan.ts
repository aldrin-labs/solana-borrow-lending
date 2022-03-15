import { Program, BN } from "@project-serum/anchor";
import {
  Keypair,
  PublicKey,
  BPF_LOADER_PROGRAM_ID,
  BpfLoader,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";
import { BorrowLending } from "../../../target/types/borrow_lending";
import { Reserve } from "../reserve";
import { LendingMarket } from "../lending-market";
import { readFile } from "fs/promises";
import { expect } from "chai";
import { CaptureStdoutAndStderr } from "../helpers";
import { FLASHLOAN_TARGET_SO_BIN_PATH } from "../consts";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export function test(
  program: Program<BorrowLending>,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("flash_loan", () => {
    const flashLoanTargetProgram = Keypair.generate();
    let market: LendingMarket, reserve: Reserve, borrowerLiqWallet: PublicKey;

    before("deploy flashloan target", async () => {
      const programBin = await readFile(FLASHLOAN_TARGET_SO_BIN_PATH);
      BpfLoader.load(
        program.provider.connection,
        owner,
        flashLoanTargetProgram,
        programBin,
        BPF_LOADER_PROGRAM_ID
      );
    });

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner, shmemProgramId);
      await market.toggleFlashLoans(); // by default disabled
    });

    before("initialize reserve", async () => {
      reserve = await market.addReserve(1000);
      await reserve.refreshOraclePrice(999);
    });

    beforeEach("create liquidity wallet for borrower", async () => {
      borrowerLiqWallet = await reserve.accounts.liquidityMint.createAccount(
        owner.publicKey
      );
    });

    it("disables and enabled flash loan feature", async () => {
      // now we disable it because we enabled it in the before hook where
      // we create market
      await market.toggleFlashLoans();

      const stdCapture = new CaptureStdoutAndStderr();

      await expect(executeFlashLoan()).to.be.rejected;

      expect(stdCapture.restore()).to.contain("FlashLoansDisabled");

      await market.toggleFlashLoans();
    });

    it("target program must be an executable", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(executeFlashLoan(Keypair.generate().publicKey)).to.be
        .rejected;

      stdCapture.restore();
    });

    it("target program mustn't be borrow lending itself", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(executeFlashLoan(program.programId)).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Lending program cannot be used as the flash loan receiver program provided"
      );
    });

    it("fails if fee is not paid", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(executeFlashLoan(undefined, [0])).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Insufficient reserve liquidity after flash loan"
      );
    });

    it("executes target program if fee is payed", async () => {
      await reserve.accounts.liquidityMint.mintTo(
        borrowerLiqWallet,
        reserve.accounts.liquidityMintAuthority,
        [],
        3
      );

      const reserveAmountBefore = (
        await reserve.accounts.liquidityMint.getAccountInfo(
          reserve.accounts.reserveLiquidityWallet.publicKey
        )
      ).amount;
      const feeAmountBefore = (
        await reserve.accounts.liquidityMint.getAccountInfo(
          reserve.accounts.reserveLiquidityFeeRecvWallet.publicKey
        )
      ).amount;

      await executeFlashLoan();

      const reserveAmountAfter = (
        await reserve.accounts.liquidityMint.getAccountInfo(
          reserve.accounts.reserveLiquidityWallet.publicKey
        )
      ).amount;
      const feeAmountAfter = (
        await reserve.accounts.liquidityMint.getAccountInfo(
          reserve.accounts.reserveLiquidityFeeRecvWallet.publicKey
        )
      ).amount;

      expect(reserveAmountAfter.eq(reserveAmountBefore)).to.be.true;
      expect(feeAmountAfter.gt(feeAmountBefore)).to.be.true;
    });

    async function executeFlashLoan(
      targetProgram: PublicKey = flashLoanTargetProgram.publicKey,
      instructionPrefix: number[] = [1]
    ) {
      await program.rpc.flashLoan(
        market.bumpSeed,
        new BN(100),
        Buffer.from(instructionPrefix),
        {
          accounts: {
            lendingMarket: market.id,
            lendingMarketPda: market.pda,
            reserve: reserve.id,
            sourceLiquidityWallet:
              reserve.accounts.reserveLiquidityWallet.publicKey,
            destinationLiquidityWallet: borrowerLiqWallet,
            feeReceiver:
              reserve.accounts.reserveLiquidityFeeRecvWallet.publicKey,
            targetProgram: targetProgram,
            tokenProgram: TOKEN_PROGRAM_ID,
            clock: SYSVAR_CLOCK_PUBKEY,
          },
          remainingAccounts: [
            {
              pubkey: targetProgram,
              isSigner: false,
              isWritable: false,
            },
            {
              pubkey: reserve.accounts.reserveLiquidityWallet.publicKey,
              isSigner: false,
              isWritable: true,
            },
            {
              pubkey: borrowerLiqWallet,
              isSigner: false,
              isWritable: true,
            },
            {
              pubkey: owner.publicKey,
              isSigner: true,
              isWritable: false,
            },
            {
              pubkey: TOKEN_PROGRAM_ID,
              isSigner: false,
              isWritable: false,
            },
          ],
          signers: [owner],
          instructions: [reserve.refreshInstruction()],
        }
      );
    }
  });
}
