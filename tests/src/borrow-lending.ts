import chaiAsPromised from "chai-as-promised";
import chai from "chai";

chai.use(chaiAsPromised);

import { readFile } from "fs/promises";
import { Keypair, BPF_LOADER_PROGRAM_ID, BpfLoader } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { SHMEM_SO_BIN_PATH } from "./consts";

import { test as testInitLendingMarket } from "./1-init-lending-market";
import { test as testSetLendingMarketOwner } from "./2-set-lending-market-owner";
import { test as testInitReserve } from "./3-init-reserve";
import { test as testRefreshReserve } from "./4-refresh-reserve";
import { test as testDepositReserveLiquidity } from "./5-deposit-reserve-liquidity";
import { test as testRedeemReserveCollateral } from "./6-redeem-reserve-collateral";
import { test as testInitObligation } from "./7-init-obligation";
import { test as testRefreshObligation } from "./8-refresh-obligation";
import { test as testDepositObligationCollateral } from "./9-deposit-obligation-collateral";
import { test as testWithdrawObligationCollateral } from "./10-withdraw-obligation-collateral";
import { test as testBorrowObligationLiquidity } from "./11-borrow-obligation-liquidity";
import { test as testRepayObligationLiquidity } from "./12-repay-obligation-liquidity";
import { test as testLiquidateObligation } from "./13-liquidate-obligation";
import { test as testFlashLoan } from "./14-flash-loan";

describe("borrow-lending", () => {
  const provider = anchor.Provider.local();
  anchor.setProvider(provider);

  const program = anchor.workspace.BorrowLending as Program<BorrowLending>;

  const shmemProgram = Keypair.generate();
  const payer = Keypair.generate();

  console.table({
    programId: program.programId.toString(),
    payer: payer.publicKey.toString(),
    shmem: shmemProgram.publicKey.toString(),
  });

  before("airdrop SOL", async () => {
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        provider.wallet.publicKey,
        10000000000
      ),
      "confirmed"
    );

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(payer.publicKey, 10000000000),
      "confirmed"
    );
  });

  before("deploy shmem", async () => {
    const programBin = await readFile(SHMEM_SO_BIN_PATH);
    BpfLoader.load(
      provider.connection,
      payer,
      shmemProgram,
      programBin,
      BPF_LOADER_PROGRAM_ID
    );
  });

  testInitLendingMarket(program);
  testSetLendingMarketOwner(program);
  testInitReserve(program, payer, shmemProgram.publicKey);
  testRefreshReserve(program, payer, shmemProgram.publicKey);
  testDepositReserveLiquidity(program, payer, shmemProgram.publicKey);
  testRedeemReserveCollateral(program, payer, shmemProgram.publicKey);
  testInitObligation(program, payer, shmemProgram.publicKey);
  testRefreshObligation(program, payer, shmemProgram.publicKey);
  testDepositObligationCollateral(program, payer, shmemProgram.publicKey);
  testWithdrawObligationCollateral(program, payer, shmemProgram.publicKey);
  testBorrowObligationLiquidity(program, payer, shmemProgram.publicKey);
  testRepayObligationLiquidity(program, payer, shmemProgram.publicKey);
  testLiquidateObligation(program, payer, shmemProgram.publicKey);
  testFlashLoan(program, payer, shmemProgram.publicKey);
});
