import { Program, BN, Provider } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import {
  PublicKey,
  Keypair,
  SYSVAR_RENT_PUBKEY,
  Connection,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";
import { expect } from "chai";
import {
  TOKEN_PROGRAM_ID,
  Token,
  MintLayout,
  AccountLayout,
} from "@solana/spl-token";
import {
  initLendingMarket,
  findLendingMarketPda,
} from "./1-init-lending-market";
import {
  CaptureStdoutAndStderr,
  createProgramAccounts,
  numberToU192,
  waitForCommit,
} from "./helpers";
import {
  oraclePriceBinBinByteLen,
  oracleProductBinByteLen,
  setOraclePriceSlot,
  uploadOraclePrice,
  uploadOracleProduct,
} from "./pyth";

export interface InitReserveAccounts {
  destinationCollateralWallet: Keypair;
  liquidityMint: Token;
  liquidityMintAuthority: Keypair;
  oraclePrice: Keypair;
  oracleProduct: Keypair;
  reserve: Keypair;
  reserveCollateralMint: Token;
  reserveCollateralWallet: Keypair;
  reserveLiquidityFeeRecvWallet: Keypair;
  reserveLiquidityWallet: Keypair;
  sourceLiquidityWallet: PublicKey;
}

export function test(
  program: Program<BorrowLending>,
  provider: Provider,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("init_reserve", () => {
    const market = Keypair.generate();
    let lendingMarketPda, lendingMarketBumpSeed;

    before("initialize lending market", async () => {
      await initLendingMarket(program, owner, market, shmemProgramId);
      [lendingMarketPda, lendingMarketBumpSeed] = await findLendingMarketPda(
        program.programId,
        market.publicKey
      );
    });

    it("must init with at least some liquidity", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      // this should make the program fail
      const liquidityAmount = new BN(0);

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
          reserveConfig()
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "must be initialized with liquidity"
      );
    });

    it("fails on invalid config", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const liquidityAmount = new BN(10);
      const config = reserveConfig();
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
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("must be in range [0, 100]");
    });

    it("fails if oracle product's price pubkey doesn't match price account");

    it("fails if oracle currency doesn't match lending market currency");

    it("fails if oracle price last updated slot is too far behind", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const liquidityAmount = new BN(10);

      const [accounts, finalize] = await prepareInitReserve(
        program,
        provider.connection,
        shmemProgramId,
        owner,
        market.publicKey,
        lendingMarketPda,
        lendingMarketBumpSeed,
        liquidityAmount,
        reserveConfig()
      );

      await setOraclePriceSlot(
        provider.connection,
        shmemProgramId,
        owner,
        accounts.oraclePrice.publicKey,
        (await provider.connection.getSlot()) - 10 // put it into the past
      );
      await waitForCommit();

      await expect(finalize()).to.be.rejected;

      expect(stdCapture.restore()).to.contain("is stale");
    });

    it("initializes all accounts, transfers liquidity and mints collateral", async () => {
      const liquidityAmount = new BN(10);

      const accounts = await initReserve(
        program,
        provider.connection,
        shmemProgramId,
        owner,
        market.publicKey,
        lendingMarketPda,
        lendingMarketBumpSeed,
        liquidityAmount,
        reserveConfig()
      );

      const reserveAccount = await program.account.reserve.fetch(
        accounts.reserve.publicKey
      );

      expect(reserveAccount.lendingMarket).to.deep.eq(market.publicKey);
      expect(reserveAccount.liquidity.availableAmount.toNumber()).to.eq(
        liquidityAmount.toNumber()
      );
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
  config: ReserveConfig = reserveConfig()
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
  config: ReserveConfig
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
    accounts.oraclePrice.publicKey
  );
  await uploadOraclePrice(
    connection,
    shmemProgramId,
    owner,
    accounts.oraclePrice.publicKey,
    (await connection.getSlot()) + 2 // go bit into future so that finalize can be called within next ~second
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

type PercentInt = { percent: number };
type ReserveConfig = {
  conf: {
    optimalUtilizationRate: PercentInt;
    loanToValueRatio: PercentInt;
    liquidationBonus: PercentInt;
    liquidationThreshold: PercentInt;
    minBorrowRate: number;
    optimalBorrowRate: number;
    maxBorrowRate: number;
    fees: {
      borrowFee: unknown;
      hostFee: unknown;
      flashLoanFee: unknown;
    };
  };
};

export function reserveConfig(): ReserveConfig {
  return {
    conf: {
      optimalUtilizationRate: { percent: 50 },
      loanToValueRatio: { percent: 5 },
      liquidationBonus: { percent: 2 },
      liquidationThreshold: { percent: 10 },
      minBorrowRate: 1,
      optimalBorrowRate: 5,
      maxBorrowRate: 10,
      fees: {
        borrowFee: { u192: numberToU192(0.01) },
        flashLoanFee: { u192: numberToU192(0.001) },
        hostFee: { percent: 2 },
      },
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
  config: ReserveConfig
) {
  await program.rpc.initReserve(
    lendingMarketBumpSeed,
    liquidityAmount,
    config as any, // IDL is not very good with types
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
        clock: SYSVAR_CLOCK_PUBKEY,
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
    { keypair: oracleProduct, space: oracleProductBinByteLen },
    { keypair: oraclePrice, space: oraclePriceBinBinByteLen },
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
    destinationCollateralWallet,
    liquidityMint,
    liquidityMintAuthority,
    oraclePrice,
    oracleProduct,
    reserve,
    reserveCollateralMint: new Token(
      connection,
      reserveCollateralMint.publicKey,
      TOKEN_PROGRAM_ID,
      owner
    ),
    reserveCollateralWallet,
    reserveLiquidityFeeRecvWallet,
    reserveLiquidityWallet,
    sourceLiquidityWallet,
  };
}
