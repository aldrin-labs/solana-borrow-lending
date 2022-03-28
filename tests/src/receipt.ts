import { Keypair, PublicKey, SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";
import { Component } from "./component";
import { BN } from "@project-serum/anchor";
import { globalContainer } from "./global-container";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { numberToU192 } from "./helpers";
import { AmmPool } from "./amm-pool";

export class Receipt {
  private constructor(
    public component: Component,
    public account: PublicKey,
    public borrower: Keypair
  ) {
    //
  }

  public static async init(component: Component): Promise<Receipt> {
    const scp = globalContainer.scp;
    const receiptAccount = Keypair.generate();
    const borrower = Keypair.generate();

    await scp.rpc.initReceipt({
      accounts: {
        borrower: borrower.publicKey,
        component: component.id,
        receipt: receiptAccount.publicKey,
      },
      preInstructions: [
        await scp.account.receipt.createInstruction(receiptAccount),
      ],
      signers: [borrower, receiptAccount],
    });

    return new Receipt(component, receiptAccount.publicKey, borrower);
  }

  public get id(): PublicKey {
    return this.account;
  }

  public async fetch() {
    return this.component.usp.scp.account.receipt.fetch(this.id);
  }

  public async deposit(borrowerCollateralWallet: PublicKey, amount: number) {
    await this.component.usp.scp.rpc.depositCollateral(new BN(amount), {
      accounts: {
        borrower: this.borrower.publicKey,
        component: this.component.id,
        freezeWallet: this.component.accounts.freezeWallet,
        receipt: this.id,
        borrowerCollateralWallet,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [this.borrower],
    });
  }

  public async withdraw(borrowerCollateralWallet: PublicKey, amount: number) {
    await this.component.usp.scp.rpc.withdrawCollateral(
      this.component.bumpSeed,
      new BN(amount),
      {
        accounts: {
          borrower: this.borrower.publicKey,
          component: this.component.id,
          reserve: this.component.accounts.reserve.id,
          componentPda: this.component.pda,
          freezeWallet: this.component.accounts.freezeWallet,
          receipt: this.id,
          borrowerCollateralWallet,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: SYSVAR_CLOCK_PUBKEY,
        },
        signers: [this.borrower],
        preInstructions: [this.component.accounts.reserve.refreshInstruction()],
      }
    );
  }

  public async borrow(borrowerStableCoinWallet: PublicKey, amount: number) {
    await this.component.usp.scp.rpc.borrowStableCoin(
      this.component.usp.bumpSeed,
      new BN(amount),
      {
        accounts: {
          borrower: this.borrower.publicKey,
          component: this.component.id,
          receipt: this.id,
          borrowerStableCoinWallet,
          stableCoin: this.component.usp.id,
          stableCoinPda: this.component.usp.pda,
          stableCoinMint: this.component.usp.mint.publicKey,
          reserve: this.component.accounts.reserve.id,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: SYSVAR_CLOCK_PUBKEY,
        },
        signers: [this.borrower],
        preInstructions: [this.component.accounts.reserve.refreshInstruction()],
      }
    );
  }

  public async repay(borrowerStableCoinWallet: PublicKey, amount: number) {
    await this.component.usp.scp.rpc.repayStableCoin(new BN(amount), {
      accounts: {
        borrower: this.borrower.publicKey,
        component: this.component.id,
        receipt: this.id,
        borrowerStableCoinWallet,
        stableCoin: this.component.usp.id,
        stableCoinMint: this.component.usp.mint.publicKey,
        interestWallet: this.component.accounts.interestWallet,
        borrowFeeWallet: this.component.accounts.borrowFeeWallet,
        tokenProgram: TOKEN_PROGRAM_ID,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
      signers: [this.borrower],
    });
  }

  public async liquidate(
    liquidator: Keypair,
    liquidatorStableCoinWallet: PublicKey,
    liquidatorCollateralWallet: PublicKey
  ) {
    await this.component.usp.scp.rpc.liquidatePosition(
      this.component.bumpSeed,
      {
        accounts: {
          liquidator: liquidator.publicKey,
          liquidatorStableCoinWallet,
          liquidatorCollateralWallet,
          stableCoin: this.component.usp.id,
          stableCoinMint: this.component.usp.mint.publicKey,
          component: this.component.id,
          componentPda: this.component.pda,
          reserve: this.component.accounts.reserve.id,
          liquidationFeeWallet: this.component.accounts.liquidationFeeWallet,
          interestWallet: this.component.accounts.interestWallet,
          borrowFeeWallet: this.component.accounts.borrowFeeWallet,
          freezeWallet: this.component.accounts.freezeWallet,
          receipt: this.id,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: SYSVAR_CLOCK_PUBKEY,
        },
        preInstructions: [this.component.accounts.reserve.refreshInstruction()],
        signers: [liquidator],
      }
    );
  }

  public async leverageOnAldrinAmm(
    uspIntermediaryPool: AmmPool,
    intermediaryCollateralPool: AmmPool,
    borrowerStableCoinWallet: PublicKey,
    borrowerCollateralWallet: PublicKey,
    borrowerIntermediaryWallet: PublicKey,
    collateralRatio: number,
    initialStableCoinAmount: number
  ) {
    await this.component.usp.scp.rpc.leverageOnAldrinAmm(
      this.component.usp.bumpSeed,
      { u192: numberToU192(collateralRatio) },
      new BN(initialStableCoinAmount),
      new BN(0), // TODO: test slippage
      new BN(0), // TODO: test slippage
      {
        accounts: {
          borrower: this.borrower.publicKey,
          stableCoin: this.component.usp.id,
          component: this.component.id,
          stableCoinMint: this.component.usp.mint.publicKey,
          stableCoinPda: this.component.usp.pda,
          reserve: this.component.accounts.reserve.id,
          freezeWallet: this.component.accounts.freezeWallet,
          receipt: this.id,
          borrowerStableCoinWallet,
          borrowerCollateralWallet,
          borrowerIntermediaryWallet,
          ammProgram: globalContainer.amm.programId,
          pool1: uspIntermediaryPool.id,
          poolSigner1: uspIntermediaryPool.accounts.vaultSigner,
          poolMint1: uspIntermediaryPool.accounts.mint.publicKey,
          baseTokenVault1: uspIntermediaryPool.accounts.vaultBase,
          quoteTokenVault1: uspIntermediaryPool.accounts.vaultQuote,
          feePoolWallet1: uspIntermediaryPool.accounts.feeWallet,
          pool2: intermediaryCollateralPool.id,
          poolSigner2: intermediaryCollateralPool.accounts.vaultSigner,
          poolMint2: intermediaryCollateralPool.accounts.mint.publicKey,
          baseTokenVault2: intermediaryCollateralPool.accounts.vaultBase,
          quoteTokenVault2: intermediaryCollateralPool.accounts.vaultQuote,
          feePoolWallet2: intermediaryCollateralPool.accounts.feeWallet,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: SYSVAR_CLOCK_PUBKEY,
        },
        preInstructions: [this.component.accounts.reserve.refreshInstruction()],
        signers: [this.borrower],
      }
    );
  }
}
