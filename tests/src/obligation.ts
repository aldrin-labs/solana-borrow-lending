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

  public async refresh(reserves: Reserve[]) {
    await this.market.program.provider.send(
      new Transaction().add(this.refreshInstruction(reserves))
    );
  }

  public refreshInstruction(reserves: Reserve[]): TransactionInstruction {
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
      instructions.push(reserve.refreshInstruction());
    }

    if (refreshObligation) {
      instructions.push(this.refreshInstruction([reserve]));
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
}
