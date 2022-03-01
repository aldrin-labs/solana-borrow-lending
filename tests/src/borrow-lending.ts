import chaiAsPromised from "chai-as-promised";
import chai from "chai";

chai.use(chaiAsPromised);

import { readFile } from "fs/promises";
import { writeFileSync } from "fs";
import {
  Keypair,
  BPF_LOADER_PROGRAM_ID,
  BpfLoader,
  PublicKey,
} from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import { Program, Provider } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { AMM_TARGET_SO_BIN_PATH, SHMEM_SO_BIN_PATH } from "./consts";
import ammIdl from "../../bin/amm/idl/mm_farming_pool_product_only.json";

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
import { test as testLeveragedPositionOnAldrin } from "./15-leveraged-position-on-aldrin";
import { test as testTakeReserveCapSnapshot } from "./16-take-reserve-cap-snapshot";
import { test as testEmissionStrategy } from "./17-emission";
import { test as testVaultPositionOnAldrin } from "./18-vault-position-on-aldrin";
import { test as testReserveAldrinUnstableLpToken } from "./19-reserve-aldrin-unstable-lp-token";

describe("borrow-lending", function () {
  const ammKeypair = Keypair.generate();
  writeFileSync(
    "target/idl/mm_farming_pool_product_only.json",
    JSON.stringify({
      ...ammIdl,
      ...{
        metadata: {
          address: ammKeypair.publicKey.toBase58(),
        },
      },
    })
  );

  const provider = Provider.local();
  anchor.setProvider(provider);

  const blp = anchor.workspace.BorrowLending as Program<BorrowLending>;
  // TODO: no types yet, old anchor version
  // if your test suite needs amm, don't forget to add it to `needsAmm` list in
  // this file
  const amm = anchor.workspace.MmFarmingPoolProductOnly as Program<any>;

  const shmemKeypair = Keypair.generate();
  const payer = Keypair.generate();
  const ammPoolAuthority = Keypair.generate();

  console.table({
    blp: blp.programId.toBase58(),
    amm: amm.programId.toBase58(),
    payer: payer.publicKey.toBase58(),
    shmem: shmemKeypair.publicKey.toBase58(),
  });

  before("airdrop SOL", async () => {
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        provider.wallet.publicKey,
        100_000_000_000
      ),
      "confirmed"
    );

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        payer.publicKey,
        100_000_000_000
      ),
      "confirmed"
    );
  });

  before("deploy shmem", async () => {
    await BpfLoader.load(
      provider.connection,
      payer,
      shmemKeypair,
      await readFile(SHMEM_SO_BIN_PATH),
      BPF_LOADER_PROGRAM_ID
    );
  });

  testInitLendingMarket(blp);
  testSetLendingMarketOwner(blp);
  testInitReserve(blp, payer, shmemKeypair.publicKey);
  testRefreshReserve(blp, payer, shmemKeypair.publicKey);
  testDepositReserveLiquidity(blp, payer, shmemKeypair.publicKey);
  testRedeemReserveCollateral(blp, payer, shmemKeypair.publicKey);
  testInitObligation(blp, payer, shmemKeypair.publicKey);
  testRefreshObligation(blp, payer, shmemKeypair.publicKey);
  testDepositObligationCollateral(blp, payer, shmemKeypair.publicKey);
  testWithdrawObligationCollateral(blp, payer, shmemKeypair.publicKey);
  testBorrowObligationLiquidity(blp, payer, shmemKeypair.publicKey);
  testRepayObligationLiquidity(blp, payer, shmemKeypair.publicKey);
  testLiquidateObligation(blp, payer, shmemKeypair.publicKey);
  testFlashLoan(blp, payer, shmemKeypair.publicKey);
  testLeveragedPositionOnAldrin(
    blp,
    amm,
    payer,
    ammPoolAuthority,
    shmemKeypair.publicKey
  );
  testTakeReserveCapSnapshot(blp, payer, shmemKeypair.publicKey);
  testEmissionStrategy(blp, payer, shmemKeypair.publicKey);
  testVaultPositionOnAldrin(
    blp,
    amm,
    payer,
    ammPoolAuthority,
    shmemKeypair.publicKey
  );
  testReserveAldrinUnstableLpToken(
    blp,
    amm,
    payer,
    ammPoolAuthority,
    shmemKeypair.publicKey
  );

  // get a list of top level suites which will run
  const onlySuites: string[] = this.suites
    .filter((suite) => {
      const hasOnlyTests = (suite as any)._onlyTests.length > 0;
      const hasOnlySuites = (suite as any)._onlySuites.length > 0;
      const isOnlySuite = (this as any)._onlySuites.includes(suite);
      return hasOnlyTests || hasOnlySuites || isOnlySuite;
    })
    .map((suite) => suite.title);

  before("deploy amm", async () => {
    const needsAmm = [
      "leveraged position on Aldrin",
      "vault position on aldrin",
      "reserve of Aldrin's AMM unstable LP token",
    ];
    if (
      onlySuites.length > 0 &&
      !needsAmm.some((s) => onlySuites.includes(s))
    ) {
      // AMM is not necessary for all tests, but it takes long time to upload.
      // To speed up iteration, upload it only when necessary.
      console.log("Skipping AMM deploy");
      return;
    }

    // Taking a farming snapshot cannot be ran out of the box, because AMM
    // has hardcoded authority pubkey for taking snapshots and we don't have
    // the privkey to sign the transactions.
    //
    // A duck tape solution is to search for the pubkey in the ammv2 binary and
    // replace the bytes with a custom pubkey to which we do have privkey
    const bin = await readFile(AMM_TARGET_SO_BIN_PATH);
    const ORIGINAL_POOL_AUTHORITY = new PublicKey(
      "BqSGA2WdiQXA2cC1EdGDnVD615A4nYEAq49K3fz2hNBo"
    ).toBuffer();
    while (true) {
      const poolAuthIndex = bin.indexOf(ORIGINAL_POOL_AUTHORITY);
      if (poolAuthIndex !== -1) {
        bin.set(ammPoolAuthority.publicKey.toBytes(), poolAuthIndex);
      } else {
        break;
      }
    }

    // sometimes the upload fails due to a timeout
    const uploadRetries = 3;
    for (let i = 0; i < uploadRetries; i++) {
      try {
        await BpfLoader.load(
          provider.connection,
          payer,
          ammKeypair,
          bin,
          BPF_LOADER_PROGRAM_ID
        );

        break;
      } catch (error) {
        if (i === uploadRetries - 1) {
          console.log("Cannot upload amm program:", error);
        } else {
          console.log("Amm upload failed, retrying...");
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  });
});
