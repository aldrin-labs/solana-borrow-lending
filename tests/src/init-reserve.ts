import { Program, BN, Provider, web3 } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import {
  PublicKey,
  Keypair,
  SYSVAR_RENT_PUBKEY,
  Connection,
} from "@solana/web3.js";
import { expect } from "chai";
import {
  TOKEN_PROGRAM_ID,
  Token,
  MintLayout,
  AccountLayout,
} from "@solana/spl-token";
import { initLendingMarket, findLendingMarketPda } from "./init-lending-market";
import {
  CaptureStdoutAndStderr,
  createProgramAccounts,
  numberToWad,
  waitForCommit,
} from "./helpers";
import { uploadOraclePrice, uploadOracleProduct } from "./pyth";
import { readFileSync } from "fs";

export interface InitReserveAccounts {
  reserve: Keypair;
  liquidityMint: Token;
  liquidityMintAuthority: Keypair;
  oracleProduct: Keypair;
  oraclePrice: Keypair;
  sourceLiquidityWallet: PublicKey;
  reserveCollateralMint: Keypair;
  reserveLiquidityWallet: Keypair;
  reserveCollateralWallet: Keypair;
  reserveLiquidityFeeRecvWallet: Keypair;
  destinationCollateralWallet: Keypair;
}

const oracleProductBin = readFileSync("tests/fixtures/srm_usd_product.bin");
const oraclePriceBin = readFileSync("tests/fixtures/srm_usd_price.bin");

export function test(
  program: Program<BorrowLending>,
  provider: Provider,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("init_reserve", () => {
    const market = Keypair.generate();
    let lendingMarketPda, lendingMarketBumpSeed;

    it("initializes lending market", async () => {
      await initLendingMarket(program, owner, market, shmemProgramId);
      [lendingMarketPda, lendingMarketBumpSeed] = await findLendingMarketPda(
        program.programId,
        market.publicKey
      );
    });

    it("cannot have 0 liquidity", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      // this should make the program fail
      const liquidityAmount = new BN(0);
      const config = { conf: reserveConfig() };

      await expect(
        initReserve(
          program,
          provider.connection,
          shmemProgramId,
          owner,
          market.publicKey,
          lendingMarketPda,
          lendingMarketBumpSeed,
          liquidityAmount,
          config
        )
      ).to.be.eventually.rejected;

      expect(stdCapture.restore()).to.contain(
        "must be initialized with liquidity"
      );
    });

    it("fails on invalid config", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const liquidityAmount = new BN(10);
      const config = { conf: reserveConfig() };
      // this should make the endpoint fail
      config.conf.liquidationBonus.percent = 120;

      await expect(
        initReserve(
          program,
          provider.connection,
          shmemProgramId,
          owner,
          market.publicKey,
          lendingMarketPda,
          lendingMarketBumpSeed,
          liquidityAmount,
          config
        )
      ).to.be.eventually.rejected;

      expect(stdCapture.restore()).to.contain("must be in range [0, 100]");
    });

    it("fails if oracle product's price pubkey doesn't match price account");

    it("fails if oracle currency doesn't match lending market currency");

    it("fails if oracle price last updated slot is too far behind", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const liquidityAmount = new BN(10);
      const config = { conf: reserveConfig() };

      const [accounts, finalize] = await prepareInitReserve(
        program,
        provider.connection,
        shmemProgramId,
        owner,
        market.publicKey,
        lendingMarketPda,
        lendingMarketBumpSeed,
        liquidityAmount,
        config
      );

      await uploadOraclePrice(
        provider.connection,
        shmemProgramId,
        owner,
        accounts.oraclePrice.publicKey,
        (await provider.connection.getSlot()) - 10, // put it into the past
        oraclePriceBin
      );
      await waitForCommit();

      await expect(finalize()).to.be.rejected;

      expect(stdCapture.restore()).to.contain("is stale");
    });

    it("initializes all accounts, transfers liquidity and mints collateral", async () => {
      const liquidityAmount = new BN(10);
      const config = { conf: reserveConfig() };

      const accounts = await initReserve(
        program,
        provider.connection,
        shmemProgramId,
        owner,
        market.publicKey,
        lendingMarketPda,
        lendingMarketBumpSeed,
        liquidityAmount,
        config
      );

      const reserveAccount = await program.account.reserve.fetch(
        accounts.reserve.publicKey
      );

      expect(reserveAccount.lendingMarket).to.deep.eq(market.publicKey);
      // TODO: check the rest reserve account
      // TODO: check token accounts
    });
  });
}

export async function initReserve(
  program: Program<BorrowLending>,
  connection: Connection,
  shmemProgramId: PublicKey,
  owner: Keypair,
  lendingMarket: PublicKey,
  lendingMarketPda: PublicKey,
  lendingMarketBumpSeed: number,
  liquidityAmount: BN,
  config: unknown // IDL is not great with types
): Promise<InitReserveAccounts> {
  const [accounts, finalize] = await prepareInitReserve(
    program,
    connection,
    shmemProgramId,
    owner,
    lendingMarket,
    lendingMarketPda,
    lendingMarketBumpSeed,
    liquidityAmount,
    config
  );

  await finalize();

  return accounts;
}

type Finalize = () => Promise<void>;
export async function prepareInitReserve(
  program: Program<BorrowLending>,
  connection: Connection,
  shmemProgramId: PublicKey,
  owner: Keypair,
  lendingMarket: PublicKey,
  lendingMarketPda: PublicKey,
  lendingMarketBumpSeed: number,
  liquidityAmount: BN,
  config: unknown // IDL is not great with types
): Promise<[InitReserveAccounts, Finalize]> {
  const accounts = await createReserveAccounts(
    connection,
    shmemProgramId,
    owner
  );
  await waitForCommit();

  await uploadOracleProduct(
    connection,
    shmemProgramId,
    owner,
    accounts.oracleProduct.publicKey,
    accounts.oraclePrice.publicKey,
    oracleProductBin
  );
  await uploadOraclePrice(
    connection,
    shmemProgramId,
    owner,
    accounts.oraclePrice.publicKey,
    (await connection.getSlot()) + 2, // go bit into future so that finalize can be called within next ~second
    oraclePriceBin
  );
  await waitForCommit();

  return [
    accounts,
    () =>
      rpcInitReserve(
        program,
        owner,
        accounts,
        lendingMarket,
        lendingMarketPda,
        lendingMarketBumpSeed,
        liquidityAmount,
        config
      ),
  ];
}

export function reserveConfig() {
  return {
    optimalUtilizationRate: { percent: 50 },
    loanToValueRatio: { percent: 5 },
    liquidationBonus: { percent: 2 },
    liquidationThreshold: { percent: 10 },
    minBorrowRate: 1,
    optimalBorrowRate: 5,
    maxBorrowRate: 10,
    fees: {
      borrowFee: { wad: numberToWad(0.01) },
      flashLoanFee: { wad: numberToWad(0.001) },
      hostFee: { percent: 2 },
    },
  };
}

async function rpcInitReserve(
  program: Program<BorrowLending>,
  owner: Keypair,
  accounts: InitReserveAccounts,
  lendingMarket: PublicKey,
  lendingMarketPda: PublicKey,
  lendingMarketBumpSeed: number,
  liquidityAmount: BN,
  config: unknown // IDL is not great with types
) {
  await program.rpc.initReserve(
    lendingMarketBumpSeed,
    liquidityAmount,
    config as any,
    {
      accounts: {
        owner: owner.publicKey,
        funder: owner.publicKey,
        lendingMarketPda,
        lendingMarket,
        reserve: accounts.reserve.publicKey,
        oraclePrice: accounts.oraclePrice.publicKey,
        oracleProduct: accounts.oracleProduct.publicKey,
        destinationCollateralWallet:
          accounts.destinationCollateralWallet.publicKey,
        sourceLiquidityWallet: accounts.sourceLiquidityWallet,
        reserveLiquidityMint: accounts.liquidityMint.publicKey,
        reserveCollateralMint: accounts.reserveCollateralMint.publicKey,
        reserveLiquidityWallet: accounts.reserveLiquidityWallet.publicKey,
        reserveLiquidityFeeRecvWallet:
          accounts.reserveLiquidityFeeRecvWallet.publicKey,
        reserveCollateralWallet: accounts.reserveCollateralWallet.publicKey,
        rent: SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: web3.SYSVAR_CLOCK_PUBKEY,
      },
      signers: [owner, accounts.reserve],
      instructions: [
        await program.account.reserve.createInstruction(accounts.reserve),
      ],
    }
  );
}

async function createReserveAccounts(
  connection: Connection,
  shmemProgramId: PublicKey,
  owner: Keypair
): Promise<InitReserveAccounts> {
  const reserve = Keypair.generate();
  const oracleProduct = Keypair.generate();
  const oraclePrice = Keypair.generate();
  const reserveCollateralMint = Keypair.generate();
  const reserveLiquidityWallet = Keypair.generate();
  const reserveCollateralWallet = Keypair.generate();
  const reserveLiquidityFeeRecvWallet = Keypair.generate();
  const destinationCollateralWallet = Keypair.generate();
  const liquidityMintAuthority = Keypair.generate();

  const liquidityMint = await Token.createMint(
    connection,
    owner,
    liquidityMintAuthority.publicKey,
    null,
    0,
    TOKEN_PROGRAM_ID
  );
  const sourceLiquidityWallet = await liquidityMint.createAccount(
    owner.publicKey
  );
  await liquidityMint.mintTo(
    sourceLiquidityWallet,
    liquidityMintAuthority,
    [],
    100
  );

  // prepare empty oracle stub accounts
  await createProgramAccounts(connection, shmemProgramId, owner, [
    { keypair: oracleProduct, space: oracleProductBin.byteLength },
    { keypair: oraclePrice, space: oraclePriceBin.byteLength },
  ]);

  // prepare empty token accounts and mint account
  await createProgramAccounts(connection, TOKEN_PROGRAM_ID, owner, [
    { keypair: destinationCollateralWallet, space: AccountLayout.span },
    { keypair: reserveLiquidityFeeRecvWallet, space: AccountLayout.span },
    { keypair: reserveCollateralWallet, space: AccountLayout.span },
    { keypair: reserveLiquidityWallet, space: AccountLayout.span },
    { keypair: reserveCollateralMint, space: MintLayout.span },
  ]);

  return {
    reserve,
    liquidityMint,
    liquidityMintAuthority,
    oracleProduct,
    oraclePrice,
    sourceLiquidityWallet,
    reserveCollateralMint,
    reserveLiquidityWallet,
    reserveCollateralWallet,
    reserveLiquidityFeeRecvWallet,
    destinationCollateralWallet,
  };
}
