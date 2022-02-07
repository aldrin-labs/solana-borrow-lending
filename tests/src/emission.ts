import { Keypair, PublicKey, SYSVAR_CLOCK_PUBKEY } from "@solana/web3.js";
import { LendingMarket } from "./lending-market";
import { BN } from "@project-serum/anchor";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Reserve } from "./reserve";
import { Obligation } from "./obligation";

interface EmissionToken {
  wallet: PublicKey;
  mint: Token;
  tokensPerSlotForLoans: number;
  tokensPerSlotForDeposits: number;
}

export class EmissionStrategy {
  constructor(
    public market: LendingMarket,
    public reserve: Reserve,
    public account: Keypair,
    public emissionTokens: EmissionToken[]
  ) {
    //
  }

  public get id(): PublicKey {
    return this.account.publicKey;
  }

  public static async init(
    market: LendingMarket,
    reserve: Reserve,
    emissionTokensSettings: Array<{
      tokensPerSlotForLoans: number;
      tokensPerSlotForDeposits: number;
    }>,
    minSlots: number = 0,
    startsAtSlot?: number,
    endsAtSlot?: number
  ): Promise<EmissionStrategy> {
    const emissionTokens = await Promise.all(
      emissionTokensSettings.map(async (s) => {
        const mint = await Token.createMint(
          market.connection,
          market.owner,
          market.owner.publicKey,
          market.owner.publicKey,
          9,
          TOKEN_PROGRAM_ID
        );
        const wallet = await mint.createAccount(market.owner.publicKey);
        await mint.mintTo(wallet, market.owner, [], 100_000);

        return {
          ...s,
          wallet,
          mint,
        };
      })
    );

    const emission = Keypair.generate();

    await market.program.account.emissionStrategy.createInstruction(emission);

    await market.program.rpc.createEmission(
      market.bumpSeed,
      new BN(startsAtSlot || (await market.connection.getSlot())),
      new BN(endsAtSlot || (await market.connection.getSlot()) + 100),
      new BN(minSlots),
      emissionTokens.map((t) => ({
        wallet: t.wallet,
        tokensPerSlotForLoans: new BN(t.tokensPerSlotForLoans),
        tokensPerSlotForDeposits: new BN(t.tokensPerSlotForDeposits),
      })),
      {
        accounts: {
          lendingMarket: market.id,
          owner: market.owner.publicKey,
          lendingMarketPda: market.pda,
          emission: emission.publicKey,
          reserve: reserve.id,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [market.owner, emission],
        instructions: [
          await market.program.account.emissionStrategy.createInstruction(
            emission
          ),
        ],
        remainingAccounts: emissionTokens.map((t) => ({
          isWritable: true,
          isSigner: false,
          pubkey: t.wallet,
        })),
      }
    );

    return new EmissionStrategy(market, reserve, emission, emissionTokens);
  }

  public async fetch() {
    return this.market.program.account.emissionStrategy.fetch(this.id);
  }

  public async createWallets(owner: PublicKey): Promise<PublicKey[]> {
    return Promise.all(
      this.emissionTokens.map((t) => t.mint.createAccount(owner))
    );
  }

  public async claim(
    obligation: Obligation,
    index: number,
    wallets: PublicKey[]
  ) {
    await this.market.program.rpc.claimEmission(this.market.bumpSeed, index, {
      accounts: {
        caller: obligation.borrower.publicKey,
        lendingMarket: this.market.id,
        lendingMarketPda: this.market.pda,
        reserve: this.reserve.id,
        obligation: obligation.id,
        emission: this.id,
        snapshots: this.reserve.accounts.snapshots.publicKey,
        clock: SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [obligation.borrower],
      remainingAccounts: wallets
        .map((w, i) => [
          {
            isWritable: true,
            isSigner: false,
            pubkey: this.emissionTokens[i].wallet,
          },
          {
            isWritable: true,
            isSigner: false,
            pubkey: w,
          },
        ])
        .flat(),
    });
  }

  public async close() {
    await this.market.program.rpc.closeEmission(this.market.bumpSeed, {
      accounts: {
        owner: this.market.owner.publicKey,
        lendingMarket: this.market.id,
        lendingMarketPda: this.market.pda,
        emissions: this.id,
        clock: SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [this.market.owner],
      remainingAccounts: this.emissionTokens.map((t) => ({
        pubkey: t.wallet,
        isSigner: false,
        isWritable: true,
      })),
    });
  }
}
