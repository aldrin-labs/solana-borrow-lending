import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import { Reserve, ReserveBuilder, ReserveConfig } from "./reserve";
import { Obligation } from "./obligation";
import { OracleMarket } from "./pyth";

export class LendingMarket {
  public get id(): PublicKey {
    return this.account.publicKey;
  }

  public get connection(): Connection {
    return this.program.provider.connection;
  }

  private constructor(
    public program: Program<BorrowLending>,
    public owner: Keypair,
    public account: Keypair,
    public oracleProgram: PublicKey,
    public currency: "usd" | PublicKey = "usd",
    public pda: PublicKey,
    public bumpSeed: number
  ) {
    //
  }

  public static async init(
    program: Program<BorrowLending>,
    owner: Keypair,
    oracle: PublicKey,
    currency: "usd" | PublicKey = "usd"
  ): Promise<LendingMarket> {
    const marketAccount = Keypair.generate();

    await program.rpc.initLendingMarket(
      currency === "usd" ? { usd: {} } : { pubkey: { address: currency } },
      {
        accounts: {
          owner: owner.publicKey,
          lendingMarket: marketAccount.publicKey,
          oracleProgram: oracle,
        },
        instructions: [
          await program.account.lendingMarket.createInstruction(marketAccount),
        ],
        signers: [owner, marketAccount],
      }
    );

    const [lendingMarketPda, lendingMarketBumpSeed] =
      await PublicKey.findProgramAddress(
        [Buffer.from(marketAccount.publicKey.toBytes())],
        program.programId
      );

    return new LendingMarket(
      program,
      owner,
      marketAccount,
      oracle,
      currency,
      lendingMarketPda,
      lendingMarketBumpSeed
    );
  }

  public fetch() {
    return this.program.account.lendingMarket.fetch(this.id);
  }

  public async setOwner(newOwner: Keypair) {
    await this.program.rpc.setLendingMarketOwner({
      accounts: {
        owner: this.owner.publicKey,
        lendingMarket: this.id,
        newOwner: newOwner.publicKey,
      },
      signers: [this.owner],
    });

    this.owner = newOwner;
  }

  public async toggleFlashLoans() {
    await this.program.rpc.toggleFlashLoans({
      accounts: {
        lendingMarket: this.id,
        owner: this.owner.publicKey,
      },
      signers: [this.owner],
    });
  }

  public async addReserve(
    liquidityAmount: number,
    config: ReserveConfig = Reserve.defaultConfig(),
    oracleMarket?: OracleMarket
  ): Promise<Reserve> {
    const builder = await ReserveBuilder.new(
      this,
      this.oracleProgram,
      this.owner,
      oracleMarket
    );

    return builder.build(liquidityAmount, config);
  }

  public addObligation(): Promise<Obligation> {
    return Obligation.init(this);
  }
}
