import chaiAsPromised from "chai-as-promised";
import chai from "chai";

chai.use(chaiAsPromised);

import { Keypair, BPF_LOADER_PROGRAM_ID, BpfLoader } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { test as testInitLendingMarket } from "./init-lending-market";
import { test as testSetLendingMarketOwner } from "./set-lending-market-owner";
import { test as testInitReserve } from "./init-reserve";
import { test as testRefreshReserve } from "./refresh-reserve";
import { test as testDepositReserveLiquidity } from "./deposit-reserve-liquidity";
import { test as testRedeemReserveCollateral } from "./redeem-reserve-collateral";
import { readFile } from "fs/promises";

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
    const programBin = await readFile(
      "tests/localnet-deps/target/deploy/shmem.so"
    );
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
  testInitReserve(program, provider, payer, shmemProgram.publicKey);
  testRefreshReserve(program, provider, payer, shmemProgram.publicKey);
  testDepositReserveLiquidity(program, provider, payer, shmemProgram.publicKey);
  testRedeemReserveCollateral(program, provider, payer, shmemProgram.publicKey);
});
