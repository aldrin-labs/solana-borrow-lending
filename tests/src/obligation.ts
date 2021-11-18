import {
  PublicKey,
  Keypair,
  SYSVAR_CLOCK_PUBKEY,
  TransactionInstruction,
  Transaction,
} from "@solana/web3.js";
import { BN } from "@project-serum/anchor";
import { LendingMarket } from "./lending-market";
import { Reserve } from "./reserve";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

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
    await market.program.rpc.initObligationR10({
      accounts: {
        owner: borrower.publicKey,
        lendingMarket: market.id,
        obligation: account.publicKey,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
      instructions: [
        await market.program.account.obligation.createInstruction(account),
      ],
      signers: [borrower, account],
    });

    return new Obligation(market, borrower, account);
  }

  public fetch() {
    return this.market.program.account.obligation.fetch(this.id);
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
    reserves: Reserve[] = Array.from(this.reservesToRefresh)
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
      instructions: reserves.map((reserve) => reserve.refreshInstruction()),
    });
  }

  public async depositCollateral(
    reserve: Reserve,
    sourceCollateralWallet: PublicKey,
    collateralAmount: number,
    refreshReserve: boolean = true,
    sign: boolean = true
  ) {
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
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: sign ? [this.borrower] : [],
        instructions: refreshReserve ? [reserve.refreshInstruction()] : [],
      }
    );

    this.reservesToRefresh.add(reserve);
  }

  public async withdrawCollateral(
    reserve: Reserve,
    destinationCollateralWallet: PublicKey,
    collateralAmount: number,
    refreshReserve: boolean = true,
    refreshObligation: boolean = true,
    sign: boolean = true
  ) {
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
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: sign ? [this.borrower] : [],
        instructions,
      }
    );
  }

  public async borrow(
    reserve: Reserve,
    liquidityAmount: number,
    destinationLiquidityWallet: PublicKey,
    hostFeeReceiver?: PublicKey,
    refreshReserve: boolean = true,
    refreshObligation: boolean = true,
    sign: boolean = true
  ) {
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
          tokenProgram: TOKEN_PROGRAM_ID,
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
    refreshReserve: boolean = true,
    refreshObligation: boolean = true,
    sign: boolean = true
  ) {
    const instructions = [];
    if (refreshReserve) {
      instructions.push(...this.refreshReservesInstructions());
    }
    if (refreshObligation) {
      instructions.push(this.refreshInstruction());
    }

    await this.market.program.rpc.repayObligationLiquidity(
      new BN(liquidityAmount),
      {
        accounts: {
          repayer: this.borrower.publicKey,
          reserve: reserve.id,
          obligation: this.id,
          sourceLiquidityWallet,
          destinationLiquidityWallet:
            reserve.accounts.reserveLiquidityWallet.publicKey,
          clock: SYSVAR_CLOCK_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: sign ? [this.borrower] : [],
        instructions,
      }
    );
  }

  private refreshReservesInstructions(): TransactionInstruction[] {
    return Array.from(this.reservesToRefresh).map((reserve) =>
      reserve.refreshInstruction()
    );
  }
}
