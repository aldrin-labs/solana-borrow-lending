import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import { Reserve, ReserveBuilder, ReserveConfig } from "./reserve";
import { Obligation } from "./obligation";
import { OracleMarket } from "./pyth";
import { numberToU192 } from "./helpers";
import { AmmPool } from "./amm-pool";
import { globalContainer } from "./global-container";

export class LendingMarket {
  public get id(): PublicKey {
    return this.account.publicKey;
  }

  public get connection(): Connection {
    return this.program.provider.connection;
  }

  private constructor(
    public program: Program<BorrowLending> = globalContainer.blp,
    public owner: Keypair,
    public account: Keypair,
    public oracleProgram: PublicKey = globalContainer.shmem,
    public currency: "usd" | PublicKey = "usd",
    public pda: PublicKey,
    public bumpSeed: number
  ) {
    //
  }

  // Provided amm key will be used to verify Aldrin's AMM program id with
  // LYF or vaults. For tests which don't interact with AMM, it can be defaulted
  // to a BLp because it doesn't affect anything and it's a bother to pass
  // the AMM's public key.
  public static async init(
    program: Program<BorrowLending> = globalContainer.blp,
    owner: Keypair,
    oracle: PublicKey = globalContainer.shmem,
    amm: PublicKey = globalContainer.amm.programId,
    currency: "usd" | PublicKey = "usd"
  ): Promise<LendingMarket> {
    const marketAccount = Keypair.generate();

    await program.rpc.initLendingMarket(
      currency === "usd" ? { usd: {} } : { pubkey: { address: currency } },
      { percent: 10 }, // 10% compound fee for leverage
      { percent: 2 }, // 2% compound fee for vault
      numberToU192(10), // $10 min collateral for borrowing
      {
        accounts: {
          owner: owner.publicKey,
          lendingMarket: marketAccount.publicKey,
          adminBot: owner.publicKey,
          aldrinAmm: amm,
        },
        preInstructions: [
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
      this.owner,
      this.oracleProgram,
      oracleMarket
    );

    return builder.build(liquidityAmount, config);
  }

  public async addReserveAldrinUnstableLpToken(
    ammPool: AmmPool,
    liquidityAmount: number,
    config: ReserveConfig = Reserve.defaultConfig(),
    isOracleForBaseVault: boolean = true,
    oracleMarket?: OracleMarket
  ): Promise<Reserve> {
    const builder = await ReserveBuilder.new(
      this,
      this.owner,
      this.oracleProgram,
      oracleMarket,
      ammPool
    );

    return builder.buildAldrinUnstableLpToken(
      ammPool,
      liquidityAmount,
      config,
      isOracleForBaseVault
    );
  }

  public addObligation(): Promise<Obligation> {
    return Obligation.init(this);
  }
}
