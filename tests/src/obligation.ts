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

  public async deposit(
    reserve: Reserve,
    sourceCollateralWallet: PublicKey,
    collateralAmount: number,
    opt: {
      sign?: boolean;
      refreshReserve?: boolean;
      tokenProgram?: PublicKey;
    } = {}
  ) {
    const { refreshReserve, sign, tokenProgram } = {
      refreshReserve: true,
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
        instructions: refreshReserve ? [reserve.refreshInstruction()] : [],
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
    } = {}
  ) {
    const { tokenProgram, refreshReserve, refreshObligation, sign } = {
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
    } = {}
  ) {
    const {
      sign,
      tokenProgram,
      liquidator,
      refreshWithdrawReserve,
      refreshRepayReserve,
      refreshObligation,
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

  private refreshReservesInstructions(): TransactionInstruction[] {
    return Array.from(this.reservesToRefresh).map((reserve) =>
      reserve.refreshInstruction()
    );
  }
}
