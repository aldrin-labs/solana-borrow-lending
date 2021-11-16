import {
  createProgramAccounts,
  numberToU192,
  PercentInt,
  waitForCommit,
} from "./helpers";
import { Program, BN } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import {
  PublicKey,
  Keypair,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
  TransactionInstruction,
  Connection,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  Token,
  MintLayout,
  AccountLayout,
} from "@solana/spl-token";
import {
  oraclePriceBinBinByteLen,
  oracleProductBinByteLen,
  setOraclePriceSlot,
  uploadOraclePrice,
  uploadOracleProduct,
} from "./pyth";
import { LendingMarket } from "./lending-market";
import { ONE_LIQ_TO_COL_INITIAL_PRICE } from "./consts";

export interface ReserveConfig {
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
}

export class ReserveBuilder {
  private constructor(
    public market: LendingMarket,
    public accounts: InitReserveAccounts
  ) {
    //
  }

  /**
   * Prepares shmem program accounts for oracle.
   */
  public static async new(
    market: LendingMarket,
    oracleProgram: PublicKey,
    owner: Keypair
  ) {
    const accounts = await createReserveAccounts(
      market.connection,
      oracleProgram,
      owner
    );
    await waitForCommit();

    await uploadOracleProduct(
      market.connection,
      oracleProgram,
      owner,
      accounts.oracleProduct.publicKey,
      accounts.oraclePrice.publicKey
    );
    await uploadOraclePrice(
      market.connection,
      oracleProgram,
      owner,
      accounts.oraclePrice.publicKey,
      (await market.connection.getSlot()) + 2 // go bit into future so that finalize can be called within next ~second
    );
    await waitForCommit();

    return new ReserveBuilder(market, accounts);
  }

  /**
   * Creates the reserve account.
   */
  public async build(
    liquidityAmount: number,
    config: ReserveConfig = Reserve.defaultConfig()
  ): Promise<Reserve> {
    return Reserve.init(
      this.market,
      this.market.owner,
      this.accounts,
      liquidityAmount,
      config
    );
  }
}

export class Reserve {
  public get id(): PublicKey {
    return this.accounts.reserve.publicKey;
  }

  private constructor(
    public market: LendingMarket,
    public owner: Keypair,
    public accounts: InitReserveAccounts
  ) {
    //
  }

  public static async init(
    market: LendingMarket,
    owner: Keypair,
    accounts: InitReserveAccounts,
    liquidityAmount: number,
    config: ReserveConfig = Reserve.defaultConfig()
  ): Promise<Reserve> {
    await rpcInitReserve(
      market.program,
      owner,
      accounts,
      market,
      liquidityAmount,
      config
    );

    return new Reserve(market, owner, accounts);
  }

  public static defaultConfig(): ReserveConfig {
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

  public fetch() {
    return this.market.program.account.reserve.fetch(
      this.accounts.reserve.publicKey
    );
  }

  public async refresh() {
    await this.market.program.provider.send(
      new Transaction().add(this.refreshInstruction())
    );
  }

  public refreshInstruction(): TransactionInstruction {
    return this.market.program.instruction.refreshReserve({
      accounts: {
        reserve: this.accounts.reserve.publicKey,
        oraclePrice: this.accounts.oraclePrice.publicKey,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
    });
  }

  public async refreshOraclePrice(intoFuture: number = 0) {
    await setOraclePriceSlot(
      this.market.connection,
      this.market.oracleProgram,
      this.market.owner,
      this.accounts.oraclePrice.publicKey,
      (await this.market.connection.getSlot()) + intoFuture
    );
  }

  public async depositLiquidity(
    liquidityAmount: number,
    refreshReserve: boolean = true
  ): Promise<DepositReserveLiquidityAccounts> {
    const funder = Keypair.generate();
    const sourceLiquidityWallet =
      await this.accounts.liquidityMint.createAccount(funder.publicKey);
    await this.accounts.liquidityMint.mintTo(
      sourceLiquidityWallet,
      this.accounts.liquidityMintAuthority,
      [],
      50
    );
    const destinationCollateralWallet =
      await this.accounts.reserveCollateralMint.createAccount(funder.publicKey);

    await this.market.program.rpc.depositReserveLiquidity(
      this.market.bumpSeed,
      new BN(liquidityAmount),
      {
        accounts: {
          funder: funder.publicKey,
          lendingMarketPda: this.market.pda,
          reserve: this.id,
          reserveCollateralMint: this.accounts.reserveCollateralMint.publicKey,
          reserveLiquidityWallet:
            this.accounts.reserveLiquidityWallet.publicKey,
          sourceLiquidityWallet,
          destinationCollateralWallet,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: SYSVAR_CLOCK_PUBKEY,
        },
        signers: [funder],
        instructions: refreshReserve ? [this.refreshInstruction()] : [],
      }
    );

    return { funder, sourceLiquidityWallet, destinationCollateralWallet };
  }

  public async redeemCollateral(
    depositAccounts: DepositReserveLiquidityAccounts,
    collateralAmount: number,
    refreshReserve: boolean = true
  ) {
    await this.market.program.rpc.redeemReserveCollateral(
      this.market.bumpSeed,
      new BN(collateralAmount),
      {
        accounts: {
          funder: depositAccounts.funder.publicKey,
          lendingMarketPda: this.market.pda,
          reserve: this.id,
          reserveCollateralMint: this.accounts.reserveCollateralMint.publicKey,
          reserveLiquidityWallet:
            this.accounts.reserveLiquidityWallet.publicKey,
          destinationLiquidityWallet: depositAccounts.sourceLiquidityWallet,
          sourceCollateralWallet: depositAccounts.destinationCollateralWallet,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: SYSVAR_CLOCK_PUBKEY,
        },
        signers: [depositAccounts.funder],
        instructions: refreshReserve ? [this.refreshInstruction()] : [],
      }
    );
  }

  public async createCollateralWalletWithCollateral(
    owner: PublicKey,
    collateralAmount: number
  ): Promise<PublicKey> {
    const sourceCollateralWallet =
      await this.accounts.reserveCollateralMint.createAccount(owner);

    await this.refreshOraclePrice(10);

    const depositAccounts = await this.depositLiquidity(
      collateralAmount / ONE_LIQ_TO_COL_INITIAL_PRICE
    );
    await this.accounts.reserveCollateralMint.transfer(
      depositAccounts.destinationCollateralWallet,
      sourceCollateralWallet,
      depositAccounts.funder,
      [],
      collateralAmount
    );

    return sourceCollateralWallet;
  }
}

interface InitReserveAccounts {
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

export interface DepositReserveLiquidityAccounts {
  funder: Keypair;
  sourceLiquidityWallet: PublicKey;
  destinationCollateralWallet: PublicKey;
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

async function rpcInitReserve(
  program: Program<BorrowLending>,
  owner: Keypair,
  accounts: InitReserveAccounts,
  market: LendingMarket,
  liquidityAmount: number,
  config: ReserveConfig
) {
  await program.rpc.initReserve(
    market.bumpSeed,
    new BN(liquidityAmount),
    config as any, // IDL is not very good with types
    {
      accounts: {
        owner: owner.publicKey,
        funder: owner.publicKey,
        lendingMarketPda: market.pda,
        lendingMarket: market.id,
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
