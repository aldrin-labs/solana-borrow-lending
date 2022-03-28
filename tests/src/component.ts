import { BN } from "@project-serum/anchor";
import { Token } from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import { globalContainer } from "./global-container";
import { numberToU192 } from "./helpers";
import { Reserve } from "./reserve";
import { USP } from "./stable-coin";

export class Component {
  private constructor(
    public usp: USP,
    public account: PublicKey,
    public pda: PublicKey,
    public bumpSeed: number,
    public accounts: {
      freezeWallet: PublicKey;
      mint: Token;
      reserve: Reserve;
      liquidationFeeWallet: PublicKey;
      borrowFeeWallet: PublicKey;
      interestWallet: PublicKey;
    }
  ) {
    //
  }

  public static async init(
    usp: USP,
    reserve: Reserve,
    mint: Token,
    config = Component.defaultConfig()
  ): Promise<Component> {
    const scp = globalContainer.scp;
    const componentAccount = Keypair.generate();

    const [componentPda, componentBumpSeed] =
      await PublicKey.findProgramAddress(
        [Buffer.from(componentAccount.publicKey.toBytes())],
        scp.programId
      );

    const freezeWallet = await mint.createAccount(componentPda);
    const liquidationFeeWallet = await mint.createAccount(usp.owner.publicKey);
    const interestWallet = await usp.mint.createAccount(usp.owner.publicKey);
    const borrowFeeWallet = await usp.mint.createAccount(usp.owner.publicKey);

    await scp.rpc.initComponent(
      componentBumpSeed,
      config as any, // anchor is not great with types
      {
        accounts: {
          admin: usp.owner.publicKey,
          stableCoin: usp.id,
          component: componentAccount.publicKey,
          mint: mint.publicKey,
          blpReserve: reserve.id,
          freezeWallet,
          liquidationFeeWallet,
          interestWallet,
          borrowFeeWallet,
          componentPda,
        },
        preInstructions: [
          await scp.account.component.createInstruction(componentAccount),
        ],
        signers: [usp.owner, componentAccount],
      }
    );

    return new Component(
      usp,
      componentAccount.publicKey,
      componentPda,
      componentBumpSeed,
      {
        freezeWallet,
        liquidationFeeWallet,
        borrowFeeWallet,
        interestWallet,
        mint,
        reserve,
      }
    );
  }

  public static defaultConfig() {
    return {
      conf: {
        maxCollateralRatio: { u192: numberToU192(0.5) },
        interest: { u192: numberToU192(0.1) },
        borrowFee: { u192: numberToU192(0.02) },
        liquidationBonus: { u192: numberToU192(0.02) },
        platformLiquidationFee: { u192: numberToU192(0.1) },
        mintAllowance: new BN(1_000_000_000_000),
      },
    };
  }

  public get id(): PublicKey {
    return this.account;
  }

  public async fetch() {
    return this.usp.scp.account.component.fetch(this.id);
  }
}
