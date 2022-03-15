import {
  createProgramAccounts,
  numberToU192,
  PercentInt,
  U192,
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
  OracleMarket,
  oraclePriceBin,
  oraclePriceBinByteLen,
  oracleProductBin,
  oracleProductBinByteLen,
  setOraclePrice,
  setOraclePriceSlot,
  uploadOraclePrice,
  uploadOracleProduct,
} from "./pyth";
import { LendingMarket } from "./lending-market";
import {
  LIQ_MINTED_TO_RESEVE_SOURCE_WALLET,
  ONE_LIQ_TO_COL_INITIAL_PRICE,
} from "./consts";
import { AmmPool } from "./amm-pool";
import { globalContainer } from "./globalContainer";

interface ReserveOracle {
  simplePyth?: {
    price: PublicKey;
  };
  aldrinAmmLpPyth?: {
    vault: PublicKey;
    price: PublicKey;
    lpTokenMint: PublicKey;
  };
}

export interface ReserveConfig {
  conf: {
    optimalUtilizationRate: PercentInt;
    loanToValueRatio: PercentInt;
    liquidationBonus: PercentInt;
    liquidationThreshold: PercentInt;
    minBorrowRate: PercentInt;
    optimalBorrowRate: PercentInt;
    maxBorrowRate: PercentInt;
    maxLeverage: {
      percent: BN;
    };
    fees: {
      borrowFee: { u192: U192 };
      leverageFee: { u192: U192 };
      hostFee: PercentInt;
      flashLoanFee: { u192: U192 };
    };
  };
}

export class ReserveBuilder {
  private constructor(
    public market: LendingMarket,
    public accounts: InitReserveAccounts,
    public oracleMarket: OracleMarket
  ) {
    //
  }

  /**
   * Prepares shmem program accounts for oracle.
   */
  public static async new(
    market: LendingMarket,
    owner: Keypair,
    oracleProgram: PublicKey = globalContainer.shmem,
    oracleMarket: OracleMarket = "srm",
    ammPool?: AmmPool
  ) {
    const accounts = await createReserveAccounts(
      market.connection,
      oracleProgram,
      owner,
      oracleMarket,
      ammPool
    );
    await waitForCommit();

    await uploadOracleProduct(
      market.connection,
      oracleProgram,
      owner,
      accounts.oracleProduct.publicKey,
      accounts.oraclePrice.publicKey,
      oracleProductBin(oracleMarket)
    );
    await uploadOraclePrice(
      market.connection,
      oracleProgram,
      owner,
      accounts.oraclePrice.publicKey,
      // go bit into future so that finalize can be called within next ~second
      (await market.connection.getSlot()) + 10,
      oraclePriceBin(oracleMarket)
    );
    await waitForCommit();

    return new ReserveBuilder(market, accounts, oracleMarket);
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
      config,
      this.oracleMarket
    );
  }

  /**
   * Creates the reserve account for Aldrin's AMM LP tokens.
   */
  public async buildAldrinUnstableLpToken(
    ammPool: AmmPool,
    liquidityAmount: number,
    config: ReserveConfig = Reserve.defaultConfig(),
    isOracleForBaseVault: boolean = true
  ): Promise<Reserve> {
    return Reserve.initAldrinUnstableLpToken(
      this.market,
      this.market.owner,
      this.accounts,
      ammPool,
      liquidityAmount,
      config,
      isOracleForBaseVault,
      this.oracleMarket
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
    public accounts: InitReserveAccounts,
    public oracleMarket: OracleMarket,
    public kind: ReserveOracle = {
      simplePyth: {
        price: accounts.oraclePrice.publicKey,
      },
    }
  ) {
    //
  }

  public static async init(
    market: LendingMarket,
    owner: Keypair,
    accounts: InitReserveAccounts,
    liquidityAmount: number,
    config: ReserveConfig = Reserve.defaultConfig(),
    oracleMarket: OracleMarket = "srm"
  ): Promise<Reserve> {
    await rpcInitReserve(
      market.program,
      owner,
      accounts,
      market,
      liquidityAmount,
      config
    );

    return new Reserve(market, owner, accounts, oracleMarket);
  }

  public static async initAldrinUnstableLpToken(
    market: LendingMarket,
    owner: Keypair,
    accounts: InitReserveAccounts,
    ammPool: AmmPool,
    liquidityAmount: number,
    config: ReserveConfig = Reserve.defaultConfig(),
    isOracleForBaseVault: boolean = true,
    oracleMarket: OracleMarket = "srm"
  ): Promise<Reserve> {
    await rpcInitReserveAldrinUnstableLpToken(
      market.program,
      owner,
      accounts,
      market,
      ammPool.id,
      liquidityAmount,
      config,
      isOracleForBaseVault
    );

    return new Reserve(market, owner, accounts, oracleMarket, {
      aldrinAmmLpPyth: {
        price: accounts.oraclePrice.publicKey,
        vault: isOracleForBaseVault
          ? ammPool.accounts.vaultBase
          : ammPool.accounts.vaultQuote,
        lpTokenMint: ammPool.accounts.mint.publicKey,
      },
    });
  }

  public static defaultConfig(): ReserveConfig {
    return {
      conf: {
        optimalUtilizationRate: { percent: 50 },
        loanToValueRatio: { percent: 90 },
        liquidationBonus: { percent: 2 },
        liquidationThreshold: { percent: 96 },
        minBorrowRate: { percent: 1 },
        optimalBorrowRate: { percent: 5 },
        maxBorrowRate: { percent: 10 },
        maxLeverage: { percent: new BN(300) },
        fees: {
          borrowFee: { u192: numberToU192(0.01) },
          leverageFee: { u192: numberToU192(0.001) },
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
    if (this.kind.simplePyth) {
      return this.market.program.instruction.refreshReserve({
        accounts: {
          reserve: this.accounts.reserve.publicKey,
          oraclePrice: this.accounts.oraclePrice.publicKey,
          clock: SYSVAR_CLOCK_PUBKEY,
        },
      });
    } else if (this.kind.aldrinAmmLpPyth) {
      return this.market.program.instruction.refreshReserveAldrinUnstableLpToken(
        {
          accounts: {
            reserve: this.accounts.reserve.publicKey,
            oraclePrice: this.accounts.oraclePrice.publicKey,
            vault: this.kind.aldrinAmmLpPyth.vault,
            poolMint: this.kind.aldrinAmmLpPyth.lpTokenMint,
            clock: SYSVAR_CLOCK_PUBKEY,
          },
        }
      );
    }

    throw new Error("Unknown reserve oracle kind");
  }

  public async refreshOraclePrice(intoFuture: number = 0) {
    const slot = await this.market.connection.getSlot();
    await setOraclePriceSlot(
      this.market.connection,
      this.market.oracleProgram,
      this.market.owner,
      this.accounts.oraclePrice.publicKey,
      slot + intoFuture
    );
  }

  public async setOraclePrice(price: number) {
    await setOraclePrice(
      this.market.connection,
      this.market.oracleProgram,
      this.market.owner,
      this.accounts.oraclePrice.publicKey,
      price
    );
  }

  public async deposit(
    liquidityAmount: number,
    opt: {
      refreshReserve?: boolean;
      tokenProgram?: PublicKey;
      sourceLiquidityWallet?: PublicKey;
      destinationCollateralWallet?: PublicKey;
    } = {}
  ): Promise<DepositReserveLiquidityAccounts> {
    let {
      refreshReserve,
      tokenProgram,
      sourceLiquidityWallet,
      destinationCollateralWallet,
    } = {
      tokenProgram: TOKEN_PROGRAM_ID,
      refreshReserve: true,
      ...opt,
    };

    const funder = Keypair.generate();
    if (!sourceLiquidityWallet) {
      sourceLiquidityWallet = await this.accounts.liquidityMint.createAccount(
        funder.publicKey
      );
      await this.accounts.liquidityMint.mintTo(
        sourceLiquidityWallet,
        this.accounts.liquidityMintAuthority,
        [],
        liquidityAmount
      );
    }

    if (!destinationCollateralWallet) {
      destinationCollateralWallet =
        await this.accounts.reserveCollateralMint.createAccount(
          funder.publicKey
        );
    }

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
          tokenProgram,
          clock: SYSVAR_CLOCK_PUBKEY,
        },
        signers: [funder],
        instructions: refreshReserve ? [this.refreshInstruction()] : [],
      }
    );

    return { funder, sourceLiquidityWallet, destinationCollateralWallet };
  }

  public async redeem(
    depositAccounts: DepositReserveLiquidityAccounts,
    collateralAmount: number,
    opt: {
      refreshReserve?: boolean;
      tokenProgram?: PublicKey;
    } = {}
  ) {
    const { refreshReserve, tokenProgram } = {
      refreshReserve: true,
      tokenProgram: TOKEN_PROGRAM_ID,
      ...opt,
    };

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
          tokenProgram,
          clock: SYSVAR_CLOCK_PUBKEY,
        },
        signers: [depositAccounts.funder],
        instructions: refreshReserve ? [this.refreshInstruction()] : [],
      }
    );
  }

  public async takeSnapshot() {
    await this.market.program.rpc.takeReserveCapSnapshot({
      accounts: {
        caller: this.market.owner.publicKey,
        lendingMarket: this.market.id,
        reserve: this.id,
        snapshots: this.accounts.snapshots.publicKey,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
      preInstructions: [this.refreshInstruction()],
      signers: [this.market.owner],
    });
  }

  public async createLiquidityWallet(
    owner: PublicKey,
    amount: number
  ): Promise<PublicKey> {
    const wallet = await this.accounts.liquidityMint.createAccount(owner);
    await this.accounts.liquidityMint.mintTo(
      wallet,
      this.accounts.liquidityMintAuthority,
      [],
      amount
    );

    return wallet;
  }

  public async createCollateralWalletWithCollateral(
    owner: PublicKey,
    collateralAmount: number
  ): Promise<PublicKey> {
    const sourceCollateralWallet =
      await this.accounts.reserveCollateralMint.createAccount(owner);

    const depositAccounts = await this.deposit(
      collateralAmount / ONE_LIQ_TO_COL_INITIAL_PRICE
    );
    await this.accounts.reserveCollateralMint.transfer(
      depositAccounts.destinationCollateralWallet,
      sourceCollateralWallet,
      depositAccounts.funder,
      [],
      Math.min(
        collateralAmount,
        (
          await this.accounts.reserveCollateralMint.getAccountInfo(
            depositAccounts.destinationCollateralWallet
          )
        ).amount.toNumber()
      )
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
  snapshots: Keypair;
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
  owner: Keypair,
  oracleMarket?: OracleMarket,
  ammPool?: AmmPool
): Promise<InitReserveAccounts> {
  const reserve = Keypair.generate();
  const oracleProduct = Keypair.generate();
  const oraclePrice = Keypair.generate();
  const reserveCollateralMint = Keypair.generate();
  const reserveLiquidityWallet = Keypair.generate();
  const reserveCollateralWallet = Keypair.generate();
  const reserveLiquidityFeeRecvWallet = Keypair.generate();
  const destinationCollateralWallet = Keypair.generate();
  const liquidityMintAuthority = ammPool ? undefined : Keypair.generate();
  const snapshots = Keypair.generate();

  const liquidityMint = ammPool
    ? ammPool.accounts.mint
    : await Token.createMint(
        connection,
        owner,
        liquidityMintAuthority.publicKey,
        null,
        0,
        TOKEN_PROGRAM_ID
      );
  const sourceLiquidityWallet = ammPool
    ? ammPool.accounts.lpWallet
    : await liquidityMint.createAccount(owner.publicKey);
  if (liquidityMintAuthority) {
    await liquidityMint.mintTo(
      sourceLiquidityWallet,
      liquidityMintAuthority,
      [],
      LIQ_MINTED_TO_RESEVE_SOURCE_WALLET
    );
  }

  // prepare empty oracle stub accounts
  await createProgramAccounts(connection, shmemProgramId, owner, [
    { keypair: oracleProduct, space: oracleProductBinByteLen(oracleMarket) },
    { keypair: oraclePrice, space: oraclePriceBinByteLen(oracleMarket) },
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
    snapshots,
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
        snapshots: accounts.snapshots.publicKey,
        rent: SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
      signers: [owner, accounts.reserve, accounts.snapshots],
      instructions: [
        await program.account.reserveCapSnapshots.createInstruction(
          accounts.snapshots
        ),
        await program.account.reserve.createInstruction(accounts.reserve),
      ],
    }
  );
}

async function rpcInitReserveAldrinUnstableLpToken(
  program: Program<BorrowLending>,
  owner: Keypair,
  accounts: InitReserveAccounts,
  market: LendingMarket,
  ammPool: PublicKey,
  liquidityAmount: number,
  config: ReserveConfig,
  isOracleForBaseVault: boolean
) {
  await program.rpc.initReserveAldrinUnstableLpToken(
    market.bumpSeed,
    new BN(liquidityAmount),
    config as any, // IDL is not very good with types,
    isOracleForBaseVault,
    {
      accounts: {
        owner: owner.publicKey,
        funder: owner.publicKey,
        lendingMarketPda: market.pda,
        lendingMarket: market.id,
        reserve: accounts.reserve.publicKey,
        pool: ammPool,
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
        snapshots: accounts.snapshots.publicKey,
        rent: SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
      signers: [owner, accounts.reserve, accounts.snapshots],
      instructions: [
        await program.account.reserveCapSnapshots.createInstruction(
          accounts.snapshots
        ),
        await program.account.reserve.createInstruction(accounts.reserve),
      ],
    }
  );
}
