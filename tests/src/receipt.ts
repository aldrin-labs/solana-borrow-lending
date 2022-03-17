import { Keypair, PublicKey } from "@solana/web3.js";
import { Component } from "./component";
import { BN } from "@project-serum/anchor";
import { globalContainer } from "./globalContainer";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export class Receipt {
  private constructor(
    public component: Component,
    public account: PublicKey,
    public borrower: Keypair
  ) {
    //
  }

  public static async init(
    component: Component,
    borrower: Keypair
  ): Promise<Receipt> {
    const scp = globalContainer.scp;
    const receiptAccount = Keypair.generate();

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
}
