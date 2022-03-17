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
import { globalContainer } from "./globalContainer";
import { StableCoin } from "../../target/types/stable_coin";
import { BorrowLending } from "../../target/types/borrow_lending";
import { AMM_TARGET_SO_BIN_PATH, SHMEM_SO_BIN_PATH } from "./consts";
import ammIdl from "../../bin/amm/idl/mm_farming_pool_product_only.json";

import { test as testInitLendingMarket } from "./vanilla/1-init-lending-market";
import { test as testSetLendingMarketOwner } from "./vanilla/2-set-lending-market-owner";
import { test as testInitReserve } from "./vanilla/3-init-reserve";
import { test as testRefreshReserve } from "./vanilla/4-refresh-reserve";
import { test as testDepositReserveLiquidity } from "./vanilla/5-deposit-reserve-liquidity";
import { test as testRedeemReserveCollateral } from "./vanilla/6-redeem-reserve-collateral";
import { test as testInitObligation } from "./vanilla/7-init-obligation";
import { test as testRefreshObligation } from "./vanilla/8-refresh-obligation";
import { test as testDepositObligationCollateral } from "./vanilla/9-deposit-obligation-collateral";
import { test as testWithdrawObligationCollateral } from "./vanilla/10-withdraw-obligation-collateral";
import { test as testBorrowObligationLiquidity } from "./vanilla/11-borrow-obligation-liquidity";
import { test as testRepayObligationLiquidity } from "./vanilla/12-repay-obligation-liquidity";
import { test as testLiquidateObligation } from "./vanilla/13-liquidate-obligation";
import { test as testFlashLoan } from "./vanilla/14-flash-loan";
import { test as testLeveragedPositionOnAldrin } from "./lyf/1-leveraged-position-on-aldrin";
import { test as testTakeReserveCapSnapshot } from "./emission/2-take-reserve-cap-snapshot";
import { test as testEmissionStrategy } from "./emission/1-emission";
import { test as testVaultPositionOnAldrin } from "./lyf/2-vault-position-on-aldrin";
import { test as testReserveAldrinUnstableLpToken } from "./vanilla/15-reserve-aldrin-unstable-lp-token";
import { test as testInitStableCoin } from "./stable-coin/1-init-stable-coin";
import { test as testInitComponent } from "./stable-coin/2-init-component";
import { test as testDepositCollateral } from "./stable-coin/3-deposit-collateral";
import { test as testWithdrawCollateral } from "./stable-coin/4-withdraw-collateral";
import { test as testBorrowStableCoin } from "./stable-coin/5-borrow-stable-coin";
import { test as testRepayStableCoin } from "./stable-coin/6-repay-stable-coin";
import { test as testLiquidatePosition } from "./stable-coin/7-liquidate-position";

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
  const scp = anchor.workspace.StableCoin as Program<StableCoin>;

  // TODO: no types yet, old anchor version
  // if your test suite needs amm, don't forget to add it to `needsAmm` list in
  // this file
  const amm = anchor.workspace.MmFarmingPoolProductOnly as Program<any>;

  const shmemKeypair = Keypair.generate();
  const payer = Keypair.generate();
  const ammPoolAuthority = Keypair.generate();

  globalContainer.amm = amm;
  globalContainer.ammAuthority = ammPoolAuthority;
  globalContainer.blp = blp;
  globalContainer.scp = scp;
  globalContainer.shmem = shmemKeypair.publicKey;

  console.table({
    blp: blp.programId.toBase58(),
    scp: scp.programId.toBase58(),
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

  testInitLendingMarket();
  testSetLendingMarketOwner();
  testInitReserve(payer);
  testRefreshReserve(payer);
  testDepositReserveLiquidity(payer);
  testRedeemReserveCollateral(payer);
  testInitObligation(payer);
  testRefreshObligation(payer);
  testDepositObligationCollateral(payer);
  testWithdrawObligationCollateral(payer);
  testBorrowObligationLiquidity(payer);
  testRepayObligationLiquidity(payer);
  testLiquidateObligation(payer);
  testFlashLoan(payer);
  testLeveragedPositionOnAldrin(payer);
  testTakeReserveCapSnapshot(payer);
  testEmissionStrategy(payer);
  testVaultPositionOnAldrin(payer);
  testReserveAldrinUnstableLpToken(payer);
  testInitStableCoin(payer);
  testInitComponent(payer);
  testDepositCollateral(payer);
  testWithdrawCollateral(payer);
  testBorrowStableCoin(payer);
  testRepayStableCoin(payer);
  testLiquidatePosition(payer);

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
      //
      // However, we default to amm pubkey in tests and often they require
      // executable constraint. For that reason, we upload shmem which is
      // much smaller and therefore quick.
      console.log("Skipping AMM deploy");
      await BpfLoader.load(
        provider.connection,
        payer,
        ammKeypair,
        await readFile(SHMEM_SO_BIN_PATH),
        BPF_LOADER_PROGRAM_ID
      );
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
