import {
  PublicKey,
  Keypair,
  SYSVAR_CLOCK_PUBKEY,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { AccountsCoder, BN } from "@project-serum/anchor";
import { LendingMarket } from "./lending-market";
import { Reserve } from "./reserve";
import {
  createEmptyAccount,
  U192,
  u192FromBytes,
  u192ToBN,
  waitForCommit,
} from "./helpers";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AmmPool } from "./amm-pool";

export interface ObligationData {
  owner: PublicKey;
  lendingMarket: PublicKey;
  lastUpdate: {
    slot: BN;
    stale: boolean;
  };
  depositedValue: { u192: U192 };
  collateralizedBorrowedValue: { u192: U192 };
  totalBorrowedValue: { u192: U192 };
  allowedBorrowValue: { u192: U192 };
  unhealthyBorrowValue: { u192: U192 };
  reserves: Array<{
    empty?: {};
    liquidity?: { inner: ObligationLiquidityData };
    collateral?: { inner: ObligationCollateralData };
  }>;
}

export interface ObligationLiquidityData {
  borrowReserve: PublicKey;
  marketValue: { u192: U192 };
  borrowedAmount: { u192: U192 };
  cumulativeBorrowRate: { u192: U192 };
  loanKind: {
    standard?: {};
    yieldFarming?: { leverage: BN };
  };
}

export interface ObligationCollateralData {
  depositReserve: PublicKey;
  depositedAmount: BN;
  marketValue: { u192: U192 };
}

export class Obligation {
  public reservesToRefresh = new Set<Reserve>();

  public get id(): PublicKey {
    return this.account.publicKey;
  }

  private constructor(
    public market: LendingMarket,
    public borrower: Keypair,
    public account: Keypair
  ) {
    //
  }

  public static async init(
    market: LendingMarket,
    borrower = Keypair.generate(),
    account = Keypair.generate()
  ): Promise<Obligation> {
    const obligationSize = 1488;
    await market.program.rpc.initObligationR10({
      accounts: {
        owner: borrower.publicKey,
        lendingMarket: market.id,
        obligation: account.publicKey,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
      instructions: [
        SystemProgram.createAccount({
          fromPubkey: market.owner.publicKey,
          newAccountPubkey: account.publicKey,
          lamports: await market.connection.getMinimumBalanceForRentExemption(
            obligationSize
          ),
          space: obligationSize,
          programId: market.program.programId,
        }),
      ],
      signers: [borrower, account, market.owner],
    });

    return new Obligation(market, borrower, account);
  }

  public async fetch() {
    const discriminator = AccountsCoder.accountDiscriminator("obligation");

    const info = await this.market.connection.getAccountInfo(this.id);
    if (discriminator.compare(info.data.slice(0, 8))) {
      throw new Error("Invalid obligation discriminator");
    }

    return Obligation.fromBytesSkipDiscriminatorCheck(info.data);
  }

  /**
   * Unfortunately, anchor doesn't correctly parse array of enums serialized
   * data if they are repr(packed), which is a must for zero copy. We therefore
   * provide a custom method for parsing the data.
   *
   * https://fasterthanli.me/articles/peeking-inside-a-rust-enum
   *
   * @param buf Obligation account data from blockchain _with_ discriminator
   * @returns Parsed obligation account
   */
  public static fromBytesSkipDiscriminatorCheck(buf: Buffer): ObligationData {
    let o = 8; // skip discriminator

    const owner = new PublicKey(buf.slice(o, o + 32));
    o += 32;
    const lendingMarket = new PublicKey(buf.slice(o, o + 32));
    o += 32;
    const lastUpdate = buf.slice(o, o + 16);
    o += 16;
    const lastUpdateSlot = new BN(lastUpdate.slice(0, 8), undefined, "le");
    const lastUpdateStale = lastUpdate[8] === 1;

    const reserves = [];
    for (let i = 0; i < 10; i++) {
      const reserve = buf.slice(o, o + 128);
      o += 128;
      switch (reserve[0]) {
        case 0:
          reserves.push({ empty: {} });
          break;
        case 1:
          const isYieldFarmingLoan = reserve[8] === 1;
          const loanKind = isYieldFarmingLoan
            ? {
                yieldFarming: {
                  leverage: new BN(reserve.slice(16, 24), undefined, "le"),
                },
              }
            : { standard: {} };
          const cumulativeBorrowRate = u192FromBytes(reserve, 24);
          const borrowedAmount = u192FromBytes(reserve, 48);
          const loanMarketValue = u192FromBytes(reserve, 72);
          const borrowReserve = new PublicKey(reserve.slice(96, 128));
          reserves.push({
            liquidity: {
              inner: {
                borrowReserve,
                loanKind,
                cumulativeBorrowRate,
                borrowedAmount,
                marketValue: loanMarketValue,
              },
            },
          });
          break;
        case 2:
          const depositedAmount = new BN(reserve.slice(8, 16), undefined, "le");
          const depositReserve = new PublicKey(reserve.slice(40, 72));
          const depositMarketValue = u192FromBytes(reserve, 16);
          reserves.push({
            collateral: {
              inner: {
                marketValue: depositMarketValue,
                depositReserve,
                depositedAmount,
              },
            },
          });
          break;
        default:
          throw new Error(`Unknown reserve variant '${reserve[0]}'`);
      }
    }

    const depositedValue = u192FromBytes(buf, o);
    o += 24;
    const collateralizedBorrowedValue = u192FromBytes(buf, o);
    o += 24;
    const totalBorrowedValue = u192FromBytes(buf, o);
    o += 24;
    const allowedBorrowValue = u192FromBytes(buf, o);
    o += 24;
    const unhealthyBorrowValue = u192FromBytes(buf, o);

    return {
      owner,
      lendingMarket,
      lastUpdate: {
        slot: lastUpdateSlot,
        stale: lastUpdateStale,
      },
      reserves,
      depositedValue,
      collateralizedBorrowedValue,
      totalBorrowedValue,
      allowedBorrowValue,
      unhealthyBorrowValue,
    };
  }

  public async refresh(
    reserves: Reserve[] = Array.from(this.reservesToRefresh)
  ) {
    await this.market.program.rpc.refreshObligation({
      accounts: {
        obligation: this.id,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
      remainingAccounts: reserves.map((reserve) => ({
        pubkey: reserve.id,
        isSigner: false,
        isWritable: false,
      })),
      instructions: reserves.map((reserve) => reserve.refreshInstruction()),
    });
  }

  public refreshInstruction(
    reserves: Reserve[] = Array.from(this.reservesToRefresh),
    addRefreshReserveInstructions: boolean = true
  ): TransactionInstruction {
    return this.market.program.instruction.refreshObligation({
      accounts: {
        obligation: this.id,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
      remainingAccounts: reserves.map((reserve) => ({
        pubkey: reserve.id,
        isSigner: false,
        isWritable: false,
      })),
      instructions: addRefreshReserveInstructions
        ? reserves.map((reserve) => reserve.refreshInstruction())
        : [],
    });
  }

  public async deposit(
    reserve: Reserve,
    sourceCollateralWallet: PublicKey,
    collateralAmount: number,
    opt: {
      sign?: boolean;
      tokenProgram?: PublicKey;
    } = {}
  ) {
    const { sign, tokenProgram } = {
      sign: true,
      tokenProgram: TOKEN_PROGRAM_ID,
      ...opt,
    };

    await this.market.program.rpc.depositObligationCollateral(
      new BN(collateralAmount),
      {
        accounts: {
          borrower: this.borrower.publicKey,
          obligation: this.id,
          sourceCollateralWallet,
          reserve: reserve.id,
          destinationCollateralWallet:
            reserve.accounts.reserveCollateralWallet.publicKey,
          clock: SYSVAR_CLOCK_PUBKEY,
          tokenProgram,
        },
        signers: sign ? [this.borrower] : [],
      }
    );

    this.reservesToRefresh.add(reserve);
  }

  public async withdraw(
    reserve: Reserve,
    destinationCollateralWallet: PublicKey,
    collateralAmount: number,
    opt: {
      sign?: boolean;
      refreshReserve?: boolean;
      refreshObligation?: boolean;
      tokenProgram?: PublicKey;
    } = {}
  ) {
    const { refreshObligation, refreshReserve, sign, tokenProgram } = {
      refreshReserve: true,
      refreshObligation: true,
      sign: true,
      tokenProgram: TOKEN_PROGRAM_ID,
      ...opt,
    };

    const instructions = [];
    if (refreshReserve) {
      instructions.push(...this.refreshReservesInstructions());
    }
    if (refreshObligation) {
      instructions.push(this.refreshInstruction());
    }

    await this.market.program.rpc.withdrawObligationCollateral(
      this.market.bumpSeed,
      new BN(collateralAmount),
      {
        accounts: {
          lendingMarketPda: this.market.pda,
          reserve: reserve.id,
          obligation: this.id,
          borrower: this.borrower.publicKey,
          destinationCollateralWallet,
          sourceCollateralWallet:
            reserve.accounts.reserveCollateralWallet.publicKey,
          clock: SYSVAR_CLOCK_PUBKEY,
          tokenProgram,
        },
        signers: sign ? [this.borrower] : [],
        instructions,
      }
    );
  }

  public async borrow(
    reserve: Reserve,
    destinationLiquidityWallet: PublicKey,
    liquidityAmount: number,
    opt: {
      hostFeeReceiver?: PublicKey;
      refreshReserve?: boolean;
      refreshObligation?: boolean;
      sign?: boolean;
      tokenProgram?: PublicKey;
    } = {}
  ) {
    const {
      refreshObligation,
      hostFeeReceiver,
      refreshReserve,
      sign,
      tokenProgram,
    } = {
      refreshReserve: true,
      refreshObligation: true,
      sign: true,
      tokenProgram: TOKEN_PROGRAM_ID,
      ...opt,
    };

    // deduplicates reserves in case
    const reserves = new Set<Reserve>();
    reserves.add(reserve);
    this.reservesToRefresh.forEach((r) => reserves.add(r));

    const instructions = [];
    if (refreshReserve) {
      instructions.push(
        ...Array.from(reserves).map((r) => r.refreshInstruction())
      );
    }
    if (refreshObligation) {
      instructions.push(this.refreshInstruction(Array.from(reserves)));
    }

    await this.market.program.rpc.borrowObligationLiquidity(
      this.market.bumpSeed,
      new BN(liquidityAmount),
      {
        accounts: {
          borrower: this.borrower.publicKey,
          reserve: reserve.id,
          obligation: this.id,
          lendingMarketPda: this.market.pda,
          feeReceiver: reserve.accounts.reserveLiquidityFeeRecvWallet.publicKey,
          sourceLiquidityWallet:
            reserve.accounts.reserveLiquidityWallet.publicKey,
          destinationLiquidityWallet,
          clock: SYSVAR_CLOCK_PUBKEY,
          tokenProgram,
        },
        signers: sign ? [this.borrower] : [],
        instructions: Array.from(instructions),
        remainingAccounts: hostFeeReceiver
          ? [
              {
                isSigner: false,
                isWritable: true,
                pubkey: hostFeeReceiver,
              },
            ]
          : [],
      }
    );

    this.reservesToRefresh.add(reserve);
  }

  public async repay(
    reserve: Reserve,
    sourceLiquidityWallet: PublicKey,
    liquidityAmount: number,
    opt: {
      refreshReserve?: boolean;
      refreshObligation?: boolean;
      sign?: boolean;
      tokenProgram?: PublicKey;
      leverage?: number; // allows us to repay leveraged position
    } = {}
  ) {
    const { tokenProgram, refreshReserve, refreshObligation, sign, leverage } =
      {
        refreshReserve: true,
        refreshObligation: true,
        sign: true,
        tokenProgram: TOKEN_PROGRAM_ID,
        ...opt,
      };

    const instructions = [];
    if (refreshReserve) {
      instructions.push(...this.refreshReservesInstructions());
    }
    if (refreshObligation) {
      instructions.push(this.refreshInstruction());
    }

    await this.market.program.rpc.repayObligationLiquidity(
      new BN(liquidityAmount),
      leverage
        ? { yieldFarming: { leverage: { percent: new BN(leverage) } } }
        : { standard: {} },
      {
        accounts: {
          repayer: this.borrower.publicKey,
          reserve: reserve.id,
          obligation: this.id,
          sourceLiquidityWallet,
          destinationLiquidityWallet:
            reserve.accounts.reserveLiquidityWallet.publicKey,
          clock: SYSVAR_CLOCK_PUBKEY,
          tokenProgram,
        },
        signers: sign ? [this.borrower] : [],
        instructions,
      }
    );
  }

  public async liquidate(
    liquidityAmount: number,
    repayReserve: Reserve,
    withdrawReserve: Reserve,
    sourceLiquidityWallet: PublicKey,
    destinationCollateralWallet: PublicKey,
    opt: {
      liquidator?: Keypair;
      refreshObligation?: boolean;
      refreshRepayReserve?: boolean;
      refreshWithdrawReserve?: boolean;
      tokenProgram?: PublicKey;
      sign?: boolean;
      leverage?: number;
    } = {}
  ) {
    const {
      sign,
      tokenProgram,
      liquidator,
      refreshWithdrawReserve,
      refreshRepayReserve,
      refreshObligation,
      leverage,
    } = {
      liquidator: this.borrower,
      refreshObligation: true,
      refreshRepayReserve: true,
      refreshWithdrawReserve: true,
      sign: true,
      tokenProgram: TOKEN_PROGRAM_ID,
      ...opt,
    };

    const instructions = [];
    if (refreshRepayReserve && refreshWithdrawReserve) {
      instructions.push(...this.refreshReservesInstructions());
    } else if (refreshRepayReserve) {
      instructions.push(repayReserve.refreshInstruction());
    } else if (refreshWithdrawReserve) {
      instructions.push(withdrawReserve.refreshInstruction());
    }

    if (refreshObligation) {
      instructions.push(this.refreshInstruction());
    }

    await this.market.program.rpc.liquidateObligation(
      this.market.bumpSeed,
      new BN(liquidityAmount),
      leverage
        ? { yieldFarming: { leverage: { percent: new BN(leverage) } } }
        : { standard: {} },
      {
        accounts: {
          lendingMarketPda: this.market.pda,
          liquidator: liquidator.publicKey,
          obligation: this.id,
          withdrawReserve: withdrawReserve.id,
          reserveCollateralWallet:
            withdrawReserve.accounts.reserveCollateralWallet.publicKey,
          destinationCollateralWallet,
          repayReserve: repayReserve.id,
          reserveLiquidityWallet:
            repayReserve.accounts.reserveLiquidityWallet.publicKey,
          sourceLiquidityWallet,
          clock: SYSVAR_CLOCK_PUBKEY,
          tokenProgram,
        },
        signers: sign ? [liquidator] : [],
        instructions,
      }
    );
  }

  public async openLeveragedPositionOnAldrin(
    reserveToBorrow: Reserve,
    pool: AmmPool,
    borrowerBaseWallet: PublicKey,
    borrowerQuoteWallet: PublicKey,
    borrowerLpWallet: PublicKey,
    stakeLpAmount: number,
    liquidityAmount: number,
    swapAmount: number,
    minSwapReturn: number,
    leverage: number
  ): Promise<PublicKey> {
    const farmingReceipt = await createEmptyAccount(
      this.market.connection,
      this.market.owner,
      this.market.program.programId,
      this.market.program.account.farmingReceipt.size
    );
    await waitForCommit();

    const [positionPda, positionBumpSeed] = await PublicKey.findProgramAddress(
      [
        Buffer.from(this.market.id.toBytes()),
        Buffer.from(this.id.toBytes()),
        Buffer.from(reserveToBorrow.id.toBytes()),
        new BN(leverage).toBuffer("le", 8),
      ],
      this.market.program.programId
    );

    this.reservesToRefresh.add(reserveToBorrow);
    await this.refresh();

    await this.market.program.rpc.openLeveragedPositionOnAldrin(
      this.market.bumpSeed,
      positionBumpSeed,
      new BN(stakeLpAmount),
      new BN(liquidityAmount),
      new BN(swapAmount),
      new BN(minSwapReturn),
      { percent: new BN(leverage) },
      {
        accounts: {
          lendingMarket: this.market.id,
          borrower: this.borrower.publicKey,
          obligation: this.id,
          reserve: reserveToBorrow.id,
          reserveLiquidityWallet:
            reserveToBorrow.accounts.reserveLiquidityWallet.publicKey,
          lendingMarketPda: this.market.pda,
          marketObligationPda: positionPda,
          farmingReceipt: farmingReceipt,
          ammProgram: pool.amm,
          pool: pool.id,
          poolMint: pool.mint,
          poolSigner: pool.vaultSigner,
          baseTokenVault: pool.vaultBase,
          quoteTokenVault: pool.vaultQuote,
          feePoolWallet: pool.feeWallet,
          borrowerBaseWallet: borrowerBaseWallet,
          borrowerQuoteWallet: borrowerQuoteWallet,
          farmingState: pool.farmingState,
          farmingTicket: pool.farmingTicket,
          borrowerLpWallet: borrowerLpWallet,
          lpTokenFreezeVault: pool.lpTokenFreeze,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: SYSVAR_CLOCK_PUBKEY,
          rent: SYSVAR_RENT_PUBKEY,
        },
        signers: [this.borrower],
        instructions: [reserveToBorrow.refreshInstruction()],
      }
    );

    return farmingReceipt;
  }

  public async closeLeveragedPositionOnAldrin(
    borrowedReserve: Reserve,
    pool: AmmPool,
    farmingReceipt: PublicKey,
    callerBaseWallet: PublicKey,
    callerQuoteWallet: PublicKey,
    callerLpWallet: PublicKey,
    leverage: number,
    opt?: {
      caller?: Keypair;
    }
  ) {
    const { caller } = {
      caller: this.borrower,
      ...opt,
    };

    const [positionPda, positionBumpSeed] = await PublicKey.findProgramAddress(
      [
        Buffer.from(this.market.id.toBytes()),
        Buffer.from(this.id.toBytes()),
        Buffer.from(borrowedReserve.id.toBytes()),
        new BN(leverage).toBuffer("le", 8),
      ],
      this.market.program.programId
    );

    await this.refresh();
    await this.market.program.rpc.closeLeveragedPositionOnAldrin(
      positionBumpSeed,
      { percent: new BN(leverage) },
      {
        accounts: {
          lendingMarket: this.market.id,
          caller: caller.publicKey,
          obligation: this.id,
          reserve: borrowedReserve.id,
          reserveLiquidityWallet:
            borrowedReserve.accounts.reserveLiquidityWallet.publicKey,
          marketObligationPda: positionPda,
          farmingReceipt,
          farmingSnapshots: pool.snapshots,
          feeBaseWallet: pool.feeVaultBase,
          feeQuoteWallet: pool.feeVaultQuote,
          ammProgram: pool.amm,
          pool: pool.id,
          poolMint: pool.mint,
          callerSolWallet: callerBaseWallet,
          poolSigner: pool.vaultSigner,
          baseTokenVault: pool.vaultBase,
          quoteTokenVault: pool.vaultQuote,
          feePoolWallet: pool.feeWallet,
          callerBaseWallet,
          callerQuoteWallet,
          farmingState: pool.farmingState,
          farmingTicket: pool.farmingTicket,
          callerLpWallet,
          lpTokenFreezeVault: pool.lpTokenFreeze,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: SYSVAR_CLOCK_PUBKEY,
          rent: SYSVAR_RENT_PUBKEY,
        },
        signers: [caller],
        instructions: [borrowedReserve.refreshInstruction()],
      }
    );
  }

  public async compoundLeveragedPositionOnAldrin(
    borrowedReserve: Reserve,
    pool: AmmPool,
    farmingCalc: PublicKey,
    baseTokenReserve: Reserve,
    quoteTokenReserve: Reserve,
    farmTokenReserve: Reserve,
    newFarmingTicket: PublicKey,
    ownerLpWallet: PublicKey,
    ownerFarmWallet: PublicKey,
    leverage: number,
    lpTokensToStake: number
  ) {
    const reservesToRefresh = new Set<Reserve>();
    reservesToRefresh.add(baseTokenReserve);
    reservesToRefresh.add(quoteTokenReserve);
    reservesToRefresh.add(farmTokenReserve);

    const [positionPda, positionBumpSeed] = await PublicKey.findProgramAddress(
      [
        Buffer.from(this.market.id.toBytes()),
        Buffer.from(this.id.toBytes()),
        Buffer.from(borrowedReserve.id.toBytes()),
        new BN(leverage).toBuffer("le", 8),
      ],
      this.market.program.programId
    );

    await this.market.program.rpc.compoundLeveragedPositionOnAldrin(
      new BN(lpTokensToStake),
      [
        Buffer.from(this.market.id.toBytes()),
        Buffer.from(this.id.toBytes()),
        Buffer.from(borrowedReserve.id.toBytes()),
        new BN(leverage).toBuffer("le", 8),
        Buffer.from([positionBumpSeed]),
      ],
      {
        accounts: {
          lendingMarket: this.market.id,
          caller: this.market.owner.publicKey,
          ammProgram: pool.amm,
          pool: pool.id,
          poolMint: pool.mint,
          baseTokenReserve: baseTokenReserve.id,
          quoteTokenReserve: quoteTokenReserve.id,
          farmTokenReserve: farmTokenReserve.id,
          callerLpWallet: ownerLpWallet,
          callerFarmWallet: ownerFarmWallet,
          lpTokenFreezeVault: pool.lpTokenFreeze,
          farmingState: pool.farmingState,
          farmingCalc,
          farmTokenVault: pool.farmTokenVault,
          poolSigner: pool.vaultSigner,
          baseTokenVault: pool.vaultBase,
          quoteTokenVault: pool.vaultQuote,
          farmingSnapshots: pool.snapshots,
          farmingTicketOwnerPda: positionPda,
          newFarmingTicket,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: SYSVAR_CLOCK_PUBKEY,
          rent: SYSVAR_RENT_PUBKEY,
        },
        instructions: Array.from(reservesToRefresh).map((r) =>
          r.refreshInstruction()
        ),
        signers: [this.market.owner],
      }
    );
  }

  public async prettyPrint() {
    const {
      reserves,
      lastUpdate,
      depositedValue,
      unhealthyBorrowValue,
      allowedBorrowValue,
      collateralizedBorrowedValue,
      totalBorrowedValue,
    } = await this.fetch();
    console.log(`Obligation ${this.id.toBase58()}:`);
    console.table({
      "last updated": `${lastUpdate.slot.toNumber()} (${
        lastUpdate.stale ? "not " : ""
      }stale)`,
      "deposited $": `${u192ToBN(depositedValue).toString()}`,
      "collateralized borrowed $": `${u192ToBN(
        collateralizedBorrowedValue
      ).toString()}`,
      "total borrowed $": `${u192ToBN(totalBorrowedValue).toString()}`,
      "allowed borrowed $": `${u192ToBN(allowedBorrowValue).toString()}`,
      "unhealthy borrowed $": `${u192ToBN(unhealthyBorrowValue).toString()}`,
    });
    reserves
      .filter((r) => !r.empty)
      .forEach((r, i) => {
        if (r.collateral) {
          const { depositReserve, depositedAmount } = r.collateral.inner;
          console.table({
            "deposited collateral mint": `${depositReserve} (${i})`,
            amount: depositedAmount.toNumber(),
          });
        } else if (r.liquidity) {
          const { borrowReserve, borrowedAmount, loanKind, marketValue } =
            r.liquidity.inner;
          console.table({
            "loan mint": `${borrowReserve} (${i})`,
            "borrowed amount": u192ToBN(borrowedAmount).toString(),
            "market value": u192ToBN(marketValue).toString(),
            "loan kind": loanKind.standard
              ? "standard"
              : `leverage ${loanKind.yieldFarming.leverage}`,
          });
        }
      });
  }

  private refreshReservesInstructions(): TransactionInstruction[] {
    return Array.from(this.reservesToRefresh).map((reserve) =>
      reserve.refreshInstruction()
    );
  }
}
