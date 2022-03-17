import { Program } from "@project-serum/anchor";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import { StableCoin } from "../../target/types/stable_coin";
import { globalContainer } from "./globalContainer";
import { waitForCommit } from "./helpers";

export class USP {
  private constructor(
    public scp: Program<StableCoin>,
    public account: PublicKey,
    public owner: Keypair,
    public pda: PublicKey,
    public bumpSeed: number,
    public mint: Token
  ) {
    //
  }

  public static async init(owner: Keypair): Promise<USP> {
    const scp = globalContainer.scp;
    const uspAccount = Keypair.generate();

    const [stableCoinPda, stableCoinBumpSeed] =
      await PublicKey.findProgramAddress(
        [Buffer.from(uspAccount.publicKey.toBytes())],
        scp.programId
      );

    const mint = await Token.createMint(
      scp.provider.connection,
      owner,
      stableCoinPda,
      null,
      8,
      TOKEN_PROGRAM_ID
    );
    await waitForCommit();

    await scp.rpc.initStableCoin(stableCoinBumpSeed, {
      accounts: {
        admin: owner.publicKey,
        stableCoin: uspAccount.publicKey,
        stableCoinPda,
        mint: mint.publicKey,
      },
      preInstructions: [
        await scp.account.stableCoin.createInstruction(uspAccount),
      ],
      signers: [owner, uspAccount],
    });

    return new USP(
      scp,
      uspAccount.publicKey,
      owner,
      stableCoinPda,
      stableCoinBumpSeed,
      mint
    );
  }

  public get id(): PublicKey {
    return this.account;
  }

  public async fetch() {
    return this.scp.account.stableCoin.fetch(this.id);
  }
}
