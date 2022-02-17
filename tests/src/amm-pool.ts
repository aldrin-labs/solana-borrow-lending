import { createMint } from "@project-serum/common";
import { Program, BN } from "@project-serum/anchor";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { AMM_FEE_OWNER } from "./consts";
import { LendingMarket } from "./lending-market";
import { Reserve } from "./reserve";
import { createEmptyAccount, waitForCommit } from "./helpers";

export interface AmmPoolAccounts {
  keypair: Keypair;
  vaultSigner: PublicKey;
  mint: Token;
  lpTokenFreeze: PublicKey;
  vaultBase: PublicKey;
  feeVaultBase: PublicKey;
  vaultQuote: PublicKey;
  feeVaultQuote: PublicKey;
  feeWallet: PublicKey;
  poolAuthority: Keypair;
  farmingState: Keypair;
  lpWallet: PublicKey;
}

export interface AmmFarmAccounts {
  snapshots: PublicKey;
  tokenVault: PublicKey;
  state: PublicKey;
}

export class AmmPool {
  private constructor(
    public amm: Program<any>,
    public market: LendingMarket,
    public baseReserve: Reserve,
    public quoteReserve: Reserve,
    public accounts: AmmPoolAccounts
  ) {
    //
  }

  public static async init(
    amm: Program<any>,
    market: LendingMarket,
    poolAuthority: Keypair,
    baseReserve: Reserve,
    quoteReserve: Reserve
  ): Promise<AmmPool> {
    const poolKeypair = Keypair.generate();
    const farmingState = Keypair.generate();

    const [vaultSigner, vaultSignerNonce] = await PublicKey.findProgramAddress(
      [poolKeypair.publicKey.toBuffer()],
      amm.programId
    );

    const poolMintKey = await createMint(market.program.provider, vaultSigner);
    const poolMint = new Token(
      market.connection,
      poolMintKey,
      TOKEN_PROGRAM_ID,
      market.owner
    );

    const lpWallet = await poolMint.createAccount(market.owner.publicKey);
    const lpTokenFreeze = await poolMint.createAccount(vaultSigner);
    const vaultBase = await baseReserve.accounts.liquidityMint.createAccount(
      vaultSigner
    );
    const vaultQuote = await quoteReserve.accounts.liquidityMint.createAccount(
      vaultSigner
    );
    const feeVaultBase = await baseReserve.accounts.liquidityMint.createAccount(
      AMM_FEE_OWNER
    );
    const feeVaultQuote =
      await quoteReserve.accounts.liquidityMint.createAccount(AMM_FEE_OWNER);
    const feeWallet = await poolMint.createAccount(market.owner.publicKey);

    // required by the AMM constraints
    await poolMint.setAuthority(
      feeWallet,
      vaultSigner,
      "CloseAccount",
      market.owner,
      []
    );
    await poolMint.setAuthority(
      feeWallet,
      AMM_FEE_OWNER,
      "AccountOwner",
      market.owner,
      []
    );

    await amm.rpc.initialize(new BN(vaultSignerNonce), {
      accounts: {
        baseTokenMint: baseReserve.accounts.liquidityMint.publicKey,
        baseTokenVault: vaultBase,
        feeBaseAccount: feeVaultBase,
        feePoolTokenAccount: feeWallet,
        feeQuoteAccount: feeVaultQuote,
        initializer: market.owner.publicKey,
        lpTokenFreezeVault: lpTokenFreeze,
        pool: poolKeypair.publicKey,
        poolAuthority: poolAuthority.publicKey,
        poolMint: poolMintKey,
        poolSigner: vaultSigner,
        quoteTokenMint: quoteReserve.accounts.liquidityMint.publicKey,
        quoteTokenVault: vaultQuote,
        rent: SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      instructions: [await amm.account.pool.createInstruction(poolKeypair)],
      signers: [poolKeypair, market.owner],
    });

    // airdrop some liquidity
    const quoteWallet = await quoteReserve.accounts.liquidityMint.createAccount(
      market.owner.publicKey
    );
    await quoteReserve.accounts.liquidityMint.mintTo(
      quoteWallet,
      quoteReserve.accounts.liquidityMintAuthority,
      [],
      110_000
    );
    const baseWallet = await baseReserve.accounts.liquidityMint.createAccount(
      market.owner.publicKey
    );
    await baseReserve.accounts.liquidityMint.mintTo(
      baseWallet,
      baseReserve.accounts.liquidityMintAuthority,
      [],
      110_000
    );
    // and deposit it
    await amm.rpc.createBasket(
      new BN(100_000),
      new BN(100_000),
      new BN(100_000),
      {
        accounts: {
          pool: poolKeypair.publicKey,
          poolMint: poolMintKey,
          poolSigner: vaultSigner,
          userBaseTokenAccount: baseWallet,
          userQuoteTokenAccount: quoteWallet,
          baseTokenVault: vaultBase,
          quoteTokenVault: vaultQuote,
          userPoolTokenAccount: lpWallet,
          walletAuthority: market.owner.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: SYSVAR_CLOCK_PUBKEY,
          rent: SYSVAR_RENT_PUBKEY,
        },
        signers: [market.owner],
      }
    );

    return new AmmPool(amm, market, baseReserve, quoteReserve, {
      keypair: poolKeypair,
      vaultSigner,
      mint: poolMint,
      lpTokenFreeze,
      vaultBase,
      feeVaultBase,
      vaultQuote,
      feeVaultQuote,
      feeWallet,
      farmingState,
      poolAuthority,
      lpWallet,
    });
  }

  public get id(): PublicKey {
    return this.accounts.keypair.publicKey;
  }

  public async airdropLpTokens(destination: PublicKey, amount: number) {
    // TODO: keep track of aidropped tokens and error if insufficient amount
    await this.accounts.mint.transfer(
      this.accounts.lpWallet,
      destination,
      this.market.owner,
      [],
      amount
    );
  }

  public async vaultPositionPda(
    caller: PublicKey
  ): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddress(
      [Buffer.from(caller.toBytes()), Buffer.from(this.id.toBytes())],
      this.market.program.programId
    );
  }
}

const FARMING_PERIOD_LENGTH_SECS = 1;

export class AmmFarm {
  private constructor(
    public ammPool: AmmPool,
    public farmingReserve: Reserve,
    public accounts: AmmFarmAccounts
  ) {
    //
  }

  public static async init(ammPool: AmmPool, farmingReserve: Reserve) {
    const snapshots = Keypair.generate();

    const farmingWallet =
      await farmingReserve.accounts.liquidityMint.createAccount(
        ammPool.market.owner.publicKey
      );
    await farmingReserve.accounts.liquidityMint.mintTo(
      farmingWallet,
      farmingReserve.accounts.liquidityMintAuthority,
      [],
      100_000
    );

    // and now init farming for this pool
    const farmTokenVault =
      await farmingReserve.accounts.liquidityMint.createAccount(
        ammPool.accounts.vaultSigner
      );
    const tokenAmount = new BN(10000);
    const tokensPerPeriod = new BN(5);
    const periodLength = new BN(FARMING_PERIOD_LENGTH_SECS);
    const noWithdrawFarming = new BN(0);
    const vestingPeriodSeconds = new BN(0);
    await ammPool.amm.rpc.initializeFarming(
      tokenAmount,
      tokensPerPeriod,
      periodLength,
      noWithdrawFarming,
      vestingPeriodSeconds,
      {
        accounts: {
          pool: ammPool.id,
          farmingState: ammPool.accounts.farmingState.publicKey,
          snapshots: snapshots.publicKey,
          farmingTokenVault: farmTokenVault,
          farmingTokenAccount: farmingWallet,
          farmingAuthority: ammPool.market.owner.publicKey,
          walletAuthority: ammPool.market.owner.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: SYSVAR_CLOCK_PUBKEY,
          rent: SYSVAR_RENT_PUBKEY,
        },
        instructions: [
          await ammPool.amm.account.snapshotQueue.createInstruction(snapshots),
          await ammPool.amm.account.farmingState.createInstruction(
            ammPool.accounts.farmingState
          ),
        ],
        signers: [
          ammPool.market.owner,
          snapshots,
          ammPool.accounts.farmingState,
        ],
      }
    );

    return new AmmFarm(ammPool, farmingReserve, {
      state: ammPool.accounts.farmingState.publicKey,
      tokenVault: farmTokenVault,
      snapshots: snapshots.publicKey,
    });
  }

  public get mint() {
    return this.farmingReserve.accounts.liquidityMint;
  }

  public async calculateFarmed(
    farmingTicket: PublicKey,
    farmingCalc: PublicKey
  ) {
    await this.oneFarmingPeriod();
    await this.ammPool.amm.rpc.takeFarmingSnapshot({
      accounts: {
        pool: this.ammPool.id,
        farmingState: this.ammPool.accounts.farmingState.publicKey,
        farmingSnapshots: this.accounts.snapshots,
        lpTokenFreezeVault: this.ammPool.accounts.lpTokenFreeze,
        authority: this.ammPool.accounts.poolAuthority.publicKey,
        clock: SYSVAR_CLOCK_PUBKEY,
        rent: SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [this.ammPool.accounts.poolAuthority],
    });
    await this.ammPool.amm.rpc.calculateFarmed(new BN(1), {
      accounts: {
        pool: this.ammPool.id,
        farmingState: this.ammPool.accounts.farmingState.publicKey,
        farmingSnapshots: this.accounts.snapshots,
        farmingCalc: farmingCalc,
        farmingTicket: farmingTicket,
        clock: SYSVAR_CLOCK_PUBKEY,
      },
    });
  }

  public async initFarmingCalc(
    farmingTicket: PublicKey,
    positionPda: PublicKey
  ): Promise<PublicKey> {
    const farmingCalcKeypair = Keypair.generate();
    await this.ammPool.amm.rpc.initializeFarmingCalc({
      accounts: {
        farmingCalc: farmingCalcKeypair.publicKey,
        farmingTicket: farmingTicket,
        userKey: positionPda,
        farmingState: this.ammPool.accounts.farmingState.publicKey,
        initializer: this.ammPool.market.owner.publicKey,
        rent: SYSVAR_RENT_PUBKEY,
      },
      instructions: [
        await this.ammPool.amm.account.farmingCalc.createInstruction(
          farmingCalcKeypair
        ),
      ],
      signers: [this.ammPool.market.owner, farmingCalcKeypair],
    });

    return farmingCalcKeypair.publicKey;
  }

  public async createFarmingTicketAccount(): Promise<PublicKey> {
    return createEmptyAccount(
      this.ammPool.market.program.provider.connection,
      this.ammPool.market.owner,
      this.ammPool.amm.programId,
      this.ammPool.amm.account.farmingTicket.size
    );
  }

  public async openVaultPositionOnAldrin(
    caller: Keypair,
    callerLpWallet: PublicKey,
    amount: number
  ): Promise<{
    receipt: PublicKey;
    ticket: PublicKey;
  }> {
    const [positionPda, bumpSeed] = await this.ammPool.vaultPositionPda(
      caller.publicKey
    );

    const farmingTicket = await this.createFarmingTicketAccount();
    const farmingReceipt = await createEmptyAccount(
      this.ammPool.market.connection,
      this.ammPool.market.owner,
      this.ammPool.market.program.programId,
      this.ammPool.market.program.account.aldrinFarmingReceipt.size
    );

    await waitForCommit();

    await this.ammPool.market.program.rpc.openVaultPositionOnAldrin(
      bumpSeed,
      new BN(amount),
      {
        accounts: {
          lendingMarket: this.ammPool.market.id,
          ammProgram: this.ammPool.amm.programId,
          caller: caller.publicKey,
          callerLpWallet,
          clock: SYSVAR_CLOCK_PUBKEY,
          farmingReceipt,
          farmingState: this.ammPool.accounts.farmingState.publicKey,
          farmingTicket,
          farmingTicketOwnerPda: positionPda,
          lpTokenFreezeVault: this.ammPool.accounts.lpTokenFreeze,
          pool: this.ammPool.id,
          rent: SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [caller],
      }
    );

    return {
      receipt: farmingReceipt,
      ticket: farmingTicket,
    };
  }

  public async closeVaultPositionOnAldrin(
    caller: Keypair,
    callerLpWallet: PublicKey,
    farmingReceipt: PublicKey,
    farmingTicket: PublicKey
  ) {
    const [positionPda, bumpSeed] = await this.ammPool.vaultPositionPda(
      caller.publicKey
    );

    await this.ammPool.market.program.rpc.closeVaultPositionOnAldrin(bumpSeed, {
      accounts: {
        ammProgram: this.ammPool.amm.programId,
        caller: caller.publicKey,
        callerLpWallet,
        clock: SYSVAR_CLOCK_PUBKEY,
        farmingReceipt,
        farmingSnapshots: this.accounts.snapshots,
        farmingState: this.accounts.state,
        farmingTicket,
        farmingTicketOwnerPda: positionPda,
        lpTokenFreezeVault: this.ammPool.accounts.lpTokenFreeze,
        pool: this.ammPool.id,
        poolSigner: this.ammPool.accounts.vaultSigner,
        rent: SYSVAR_RENT_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [caller],
    });
  }

  public async compoundPositionOnAldrin(
    positionPda: PublicKey,
    seeds: Buffer[],
    farmingCalc: PublicKey,
    baseTokenReserve: Reserve,
    quoteTokenReserve: Reserve,
    farmTokenReserve: Reserve,
    newFarmingTicket: PublicKey,
    ownerLpWallet: PublicKey,
    ownerFarmWallet: PublicKey,
    lpTokensToStake: number
  ) {
    const reservesToRefresh = new Set<Reserve>();
    reservesToRefresh.add(baseTokenReserve);
    reservesToRefresh.add(quoteTokenReserve);
    reservesToRefresh.add(farmTokenReserve);

    await this.ammPool.market.program.rpc.compoundPositionOnAldrin(
      new BN(lpTokensToStake),
      seeds,
      {
        accounts: {
          lendingMarket: this.ammPool.market.id,
          caller: this.ammPool.market.owner.publicKey,
          ammProgram: this.ammPool.amm.programId,
          pool: this.ammPool.id,
          poolMint: this.ammPool.accounts.mint.publicKey,
          baseTokenReserve: baseTokenReserve.id,
          quoteTokenReserve: quoteTokenReserve.id,
          farmTokenReserve: farmTokenReserve.id,
          callerLpWallet: ownerLpWallet,
          callerFarmWallet: ownerFarmWallet,
          lpTokenFreezeVault: this.ammPool.accounts.lpTokenFreeze,
          farmingState: this.ammPool.accounts.farmingState.publicKey,
          farmingCalc,
          farmTokenVault: this.accounts.tokenVault,
          poolSigner: this.ammPool.accounts.vaultSigner,
          baseTokenVault: this.ammPool.accounts.vaultBase,
          quoteTokenVault: this.ammPool.accounts.vaultQuote,
          farmingSnapshots: this.accounts.snapshots,
          farmingTicketOwnerPda: positionPda,
          newFarmingTicket,
          tokenProgram: TOKEN_PROGRAM_ID,
          clock: SYSVAR_CLOCK_PUBKEY,
          rent: SYSVAR_RENT_PUBKEY,
        },
        instructions: Array.from(reservesToRefresh).map((r) =>
          r.refreshInstruction()
        ),
        signers: [this.ammPool.market.owner],
      }
    );
  }

  public async oneFarmingPeriod() {
    // waiting minimum period length before being allowed to compound/close
    // prevents AMM's MinimumUnfreezeTimeNotPassed (0x13a)
    await new Promise((r) =>
      setTimeout(r, FARMING_PERIOD_LENGTH_SECS * 1000 + 500)
    );
  }
}
