import { Token } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";

export class TokenWrapper {
  private authority: Keypair;

  private wallet: [PublicKey, Keypair];

  constructor(public mint: Token) {
    //
  }

  public get id(): PublicKey {
    return this.mint.publicKey;
  }

  public setAuthority(authority: Keypair): TokenWrapper {
    this.authority = authority;

    return this;
  }

  public setSourceWallet(wallet: PublicKey, owner: Keypair): TokenWrapper {
    this.wallet = [wallet, owner];

    return this;
  }

  public async createWallet(owner: PublicKey): Promise<PublicKey> {
    return this.mint.createAccount(owner);
  }

  public async airdrop(to: PublicKey, amount: number): Promise<void> {
    if (this.authority) {
      await this.mint.mintTo(to, this.authority, [], amount);
    } else if (this.wallet) {
      const [wallet, owner] = this.wallet;
      await this.mint.transfer(wallet, to, owner, [], amount);
    } else {
      throw new Error("Nor mint authority nor source wallet was provided");
    }
  }
}
