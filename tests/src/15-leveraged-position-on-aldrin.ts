import { createMint } from "@project-serum/common";
import { Program, BN } from "@project-serum/anchor";
import {
  Keypair,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { BorrowLending } from "../../target/types/borrow_lending";
import { Reserve } from "./reserve";
import { LendingMarket } from "./lending-market";
import { expect } from "chai";
import {
  createEmptyAccount,
  ONE_WAD,
  u192ToBN,
  waitForCommit,
} from "./helpers";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Obligation } from "./obligation";
import { AmmPool } from "./amm-pool";
import { AMM_FEE_OWNER, DEFAULT_SRM_PRICE } from "./consts";

export function test(
  blp: Program<BorrowLending>,
  amm: Program<any>,
  owner: Keypair,
  poolAuthority: Keypair,
  shmemProgramId: PublicKey
) {
  describe("leveraged position on Aldrin", () => {
    const provider = blp.provider;
    const farmingState = Keypair.generate();
    const poolKeypair = Keypair.generate();
    const farmingPeriodLengthSecs = 1;
    const poolInfo: AmmPool = {
      amm: amm.programId,
      farmingState: farmingState.publicKey,
      farmingTicket: null, // in before all hook for creating ticket
      feeVaultBase: null, // in before all hook for init LP
      feeVaultQuote: null, // in before all hook for init LP
      farmTokenVault: null, // in before all hook for init farming
      feeWallet: null, // in before all hook for init LP
      id: poolKeypair.publicKey,
      lpTokenFreeze: null, // in before all hook for init LP
      mint: null, // in before all hook for init LP
      snapshots: null, // in before all hook for init farming
      vaultBase: null, // in before all hook for init LP
      vaultQuote: null, // in before all hook for init LP
      vaultSigner: null, // in before all hook for init LP
    };

    let market: LendingMarket,
      reserveSrm: Reserve,
      reserveDoge: Reserve,
      obligation: Obligation,
      farmingMint: Token,
      poolMint: Token,
      farmingWallet: PublicKey,
      borrowerSrmWallet: PublicKey,
      borrowerDogeWallet: PublicKey,
      borrowerLpWallet: PublicKey,
      srmWallet: PublicKey,
      dogeWallet: PublicKey,
      lpWallet: PublicKey;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(blp, owner, shmemProgramId);
    });

    before("initialize reserves", async () => {
      reserveSrm = await market.addReserve(1000, undefined, "srm");
      reserveDoge = await market.addReserve(1000, undefined, "doge");

      await reserveDoge.refreshOraclePrice(999);
      await reserveSrm.refreshOraclePrice(999);
    });

    before("use SRM as farming mint", async () => {
      farmingMint = reserveSrm.accounts.liquidityMint;

      farmingWallet = await farmingMint.createAccount(owner.publicKey);
      await farmingMint.mintTo(
        farmingWallet,
        reserveSrm.accounts.liquidityMintAuthority,
        [],
        100_000
      );
    });

    before("airdrop liquidity to owner", async () => {
      dogeWallet = await reserveDoge.accounts.liquidityMint.createAccount(
        owner.publicKey
      );
      await reserveDoge.accounts.liquidityMint.mintTo(
        dogeWallet,
        reserveDoge.accounts.liquidityMintAuthority,
        [],
        110_000
      );
      srmWallet = await reserveSrm.accounts.liquidityMint.createAccount(
        owner.publicKey
      );
      await reserveSrm.accounts.liquidityMint.mintTo(
        srmWallet,
        reserveSrm.accounts.liquidityMintAuthority,
        [],
        110_000
      );
    });

    before("initialize liquidity pool", async () => {
      const srmMint = reserveSrm.accounts.liquidityMint.publicKey;
      const dogeMint = reserveDoge.accounts.liquidityMint.publicKey;

      const [vaultSigner, vaultSignerNonce] =
        await PublicKey.findProgramAddress(
          [poolKeypair.publicKey.toBuffer()],
          amm.programId
        );
      poolInfo.vaultSigner = vaultSigner;

      const poolMintKey = await createMint(provider, vaultSigner);
      poolMint = new Token(
        provider.connection,
        poolMintKey,
        TOKEN_PROGRAM_ID,
        owner
      );
      poolInfo.mint = poolMintKey;

      lpWallet = await poolMint.createAccount(owner.publicKey);
      poolInfo.lpTokenFreeze = await poolMint.createAccount(vaultSigner);
      poolInfo.vaultBase =
        await reserveSrm.accounts.liquidityMint.createAccount(vaultSigner);
      poolInfo.vaultQuote =
        await reserveDoge.accounts.liquidityMint.createAccount(vaultSigner);
      poolInfo.feeVaultBase =
        await reserveSrm.accounts.liquidityMint.createAccount(AMM_FEE_OWNER);
      poolInfo.feeVaultQuote =
        await reserveDoge.accounts.liquidityMint.createAccount(AMM_FEE_OWNER);
      poolInfo.feeWallet = await poolMint.createAccount(owner.publicKey);
      await poolMint.setAuthority(
        poolInfo.feeWallet,
        vaultSigner,
        "CloseAccount",
        owner,
        []
      );
      await poolMint.setAuthority(
        poolInfo.feeWallet,
        AMM_FEE_OWNER,
        "AccountOwner",
        owner,
        []
      );

      await amm.rpc.initialize(new BN(vaultSignerNonce), {
        accounts: {
          pool: poolKeypair.publicKey,
          poolMint: poolMintKey,
          lpTokenFreezeVault: poolInfo.lpTokenFreeze,
          baseTokenVault: poolInfo.vaultBase,
          baseTokenMint: srmMint,
          quoteTokenVault: poolInfo.vaultQuote,
          quoteTokenMint: dogeMint,
          poolSigner: vaultSigner,
          initializer: owner.publicKey,
          poolAuthority: poolAuthority.publicKey,
          feeBaseAccount: poolInfo.feeVaultBase,
          feeQuoteAccount: poolInfo.feeVaultQuote,
          feePoolTokenAccount: poolInfo.feeWallet,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        },
        instructions: [await amm.account.pool.createInstruction(poolKeypair)],
        signers: [poolKeypair, owner],
      });

      // deposit some initial liquidity
      await amm.rpc.createBasket(
        new BN(100_000),
        new BN(100_000),
        new BN(100_000),
        {
          accounts: {
            pool: poolKeypair.publicKey,
            poolMint: poolMintKey,
            poolSigner: vaultSigner,
            userBaseTokenAccount: srmWallet,
            userQuoteTokenAccount: dogeWallet,
            baseTokenVault: poolInfo.vaultBase,
            quoteTokenVault: poolInfo.vaultQuote,
            userPoolTokenAccount: lpWallet,
            walletAuthority: owner.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            clock: SYSVAR_CLOCK_PUBKEY,
            rent: SYSVAR_RENT_PUBKEY,
          },
          signers: [owner],
        }
      );
    });

    before("initialize farming", async () => {
      poolInfo.farmTokenVault = await farmingMint.createAccount(
        poolInfo.vaultSigner
      );
      const snapshotQueue = Keypair.generate();
      poolInfo.snapshots = snapshotQueue.publicKey;
      const tokenAmount = new BN(10000);
      const tokensPerPeriod = new BN(5);
      const periodLength = new BN(farmingPeriodLengthSecs);
      const noWithdrawFarming = new BN(0);
      const vestingPeriodSeconds = new BN(0);
      await amm.rpc.initializeFarming(
        tokenAmount,
        tokensPerPeriod,
        periodLength,
        noWithdrawFarming,
        vestingPeriodSeconds,
        {
          accounts: {
            pool: poolKeypair.publicKey,
            farmingState: farmingState.publicKey,
            snapshots: snapshotQueue.publicKey,
            farmingTokenVault: poolInfo.farmTokenVault,
            farmingTokenAccount: farmingWallet,
            farmingAuthority: owner.publicKey,
            walletAuthority: owner.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            clock: SYSVAR_CLOCK_PUBKEY,
            rent: SYSVAR_RENT_PUBKEY,
          },
          instructions: [
            await amm.account.snapshotQueue.createInstruction(snapshotQueue),
            await amm.account.farmingState.createInstruction(farmingState),
          ],
          signers: [owner, snapshotQueue, farmingState],
        }
      );
    });

    beforeEach("initialize obligation", async () => {
      obligation = await market.addObligation();
    });

    beforeEach(
      "gift reserve SRM collateral to borrower and deposit it",
      async () => {
        const depositedSrmCollateralAmount = 1000;

        const sourceCollateralWallet =
          await reserveSrm.createCollateralWalletWithCollateral(
            obligation.borrower.publicKey,
            depositedSrmCollateralAmount
          );

        await obligation.deposit(
          reserveSrm,
          sourceCollateralWallet,
          depositedSrmCollateralAmount
        );
      }
    );

    beforeEach("airdrop liquidity to borrower", async () => {
      borrowerDogeWallet =
        await reserveDoge.accounts.liquidityMint.createAccount(
          obligation.borrower.publicKey
        );
      await reserveDoge.accounts.liquidityMint.mintTo(
        borrowerDogeWallet,
        reserveDoge.accounts.liquidityMintAuthority,
        [],
        1000
      );
      borrowerSrmWallet = await reserveSrm.accounts.liquidityMint.createAccount(
        obligation.borrower.publicKey
      );
      await reserveSrm.accounts.liquidityMint.mintTo(
        borrowerSrmWallet,
        reserveSrm.accounts.liquidityMintAuthority,
        [],
        1000
      );
    });

    beforeEach("creating farming ticket", async () => {
      poolInfo.farmingTicket = await createEmptyAccount(
        provider.connection,
        owner,
        amm.programId,
        amm.account.farmingTicket.size
      );
    });

    beforeEach("creates borrower's LP wallet", async () => {
      borrowerLpWallet = await poolMint.createAccount(
        obligation.borrower.publicKey
      );
    });

    it("opens position without swap", async () => {
      const leverage = 250;

      const farmingReceipt = await obligation.openLeveragedPositionOnAldrin(
        reserveDoge,
        poolInfo,
        borrowerSrmWallet,
        borrowerDogeWallet,
        borrowerLpWallet,
        8,
        8,
        0,
        0,
        leverage
      );

      // TODO: check obligation, reserve and associated base, quote and LP
      // wallets
      await obligation.refresh();
      const obligationInfo = await obligation.fetch();
      expect(
        obligationInfo.reserves[1].liquidity.inner.loanKind.yieldFarming.leverage.toNumber()
      ).to.eq(leverage);
      const colBorrowedValue = u192ToBN(
        obligationInfo.collateralizedBorrowedValue
      );
      const totBorrowedValueDivByLeverage = u192ToBN(
        obligationInfo.totalBorrowedValue
      )
        .div(new BN(leverage))
        .mul(new BN(100));
      const diff = colBorrowedValue.gt(totBorrowedValueDivByLeverage)
        ? colBorrowedValue.sub(totBorrowedValueDivByLeverage)
        : totBorrowedValueDivByLeverage.sub(colBorrowedValue);
      expect(diff.toNumber()).to.be.lessThan(1000); // a rounding error

      const farmingReceiptInfo = await blp.account.farmingReceipt.fetch(
        farmingReceipt
      );
      expect(farmingReceiptInfo.leverage.percent.toNumber()).to.eq(leverage);
      expect(farmingReceiptInfo.obligation).to.deep.eq(obligation.id);
      expect(farmingReceiptInfo.reserve).to.deep.eq(reserveDoge.id);
    });

    it("opens position with swap", async () => {
      const leverage = 250;

      await obligation.openLeveragedPositionOnAldrin(
        reserveDoge,
        poolInfo,
        borrowerSrmWallet,
        borrowerDogeWallet,
        borrowerLpWallet,
        8,
        16,
        8,
        // slippage, but it's fine because the borrower already has some tokens
        5,
        leverage
      );

      // TODO: check obligation, reserve and associated base, quote and LP
      // wallets
      await obligation.refresh();
      const obligationInfo = await obligation.fetch();
      expect(
        obligationInfo.reserves[1].liquidity.inner.loanKind.yieldFarming.leverage.toNumber()
      ).to.eq(leverage);
      const colBorrowedValue = u192ToBN(
        obligationInfo.collateralizedBorrowedValue
      );
      const totBorrowedValueDivByLeverage = u192ToBN(
        obligationInfo.totalBorrowedValue
      )
        .div(new BN(leverage))
        .mul(new BN(100));
      const diff = colBorrowedValue.gt(totBorrowedValueDivByLeverage)
        ? colBorrowedValue.sub(totBorrowedValueDivByLeverage)
        : totBorrowedValueDivByLeverage.sub(colBorrowedValue);
      expect(diff.toNumber()).to.be.lessThan(1000); // a rounding error

      const ticket = await amm.account.farmingTicket.fetch(
        poolInfo.farmingTicket
      );
      expect(ticket.tokensFrozen.toNumber()).to.eq(8);
      expect(ticket.endTime.toString()).to.be.eq("9223372036854775807");
    });

    it("opens position for quote token");
    it("fails to open if amount of LP tokens to stake is 0");
    it("fails to open if liquidity amount to borrow is 0");
    it("cannot borrow liquidity but not stake it");
    it("cannot borrow liquidity, swap it for other token but not stake it");
    it("cannot do leverage more than what's in the config");
    it("fails to open if obligation isn't refreshed");
    it("fails to open if obligation doesn't match reserve's market");
    it("fails to open if obligation has no deposit");
    it("pays optional host fee on opening");
    it("cannot open position if min collateral value is not reached");
    it("cannot open position if utilization rate would go over 95%");

    it("closes a position", async () => {
      const leverage = 250;

      const { amount: reserveSupplyBeforeOpen } =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          reserveDoge.accounts.reserveLiquidityWallet.publicKey
        );
      const { amount: borrowerDogeAmountBeforeOpen } =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          borrowerDogeWallet
        );
      const { amount: borrowerSrmAmountBeforeOpen } =
        await reserveSrm.accounts.liquidityMint.getAccountInfo(
          borrowerSrmWallet
        );
      const { amount: borrowerLpAmountBeforeOpen } =
        await poolMint.getAccountInfo(borrowerLpWallet);
      const borrowSrmAmount = 8;
      const farmingReceipt = await obligation.openLeveragedPositionOnAldrin(
        reserveDoge,
        poolInfo,
        borrowerSrmWallet,
        borrowerDogeWallet,
        borrowerLpWallet,
        8,
        borrowSrmAmount,
        0,
        0,
        leverage
      );

      await oneFarmingPeriod();

      await obligation.closeLeveragedPositionOnAldrin(
        reserveDoge,
        poolInfo,
        farmingReceipt,
        borrowerSrmWallet,
        borrowerDogeWallet,
        borrowerLpWallet,
        leverage
      );
      const { amount: borrowerSrmAmountAfterClose } =
        await reserveSrm.accounts.liquidityMint.getAccountInfo(
          borrowerSrmWallet
        );
      const { amount: borrowerDogeAmountAfterClose } =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          borrowerDogeWallet
        );
      const { amount: reserveSupplyAfterClose } =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          reserveDoge.accounts.reserveLiquidityWallet.publicKey
        );
      const { amount: borrowerLpAmountAfterClose } =
        await poolMint.getAccountInfo(borrowerLpWallet);

      expect(borrowerSrmAmountBeforeOpen.toNumber()).to.eq(
        borrowerSrmAmountAfterClose.toNumber() + borrowSrmAmount
      );
      expect(borrowerDogeAmountAfterClose.toNumber()).to.be.greaterThanOrEqual(
        borrowerDogeAmountBeforeOpen.toNumber()
      );
      expect(borrowerLpAmountBeforeOpen.toNumber()).to.be.eq(
        borrowerLpAmountAfterClose.toNumber()
      );
      expect(reserveSupplyAfterClose.toNumber()).to.be.greaterThan(
        reserveSupplyBeforeOpen.toNumber()
      );

      await obligation.refresh();
      const obligationInfo = await obligation.fetch();
      expect(obligationInfo.reserves[1]).to.deep.eq({ empty: {} });
      expect(
        u192ToBN(obligationInfo.collateralizedBorrowedValue).toNumber()
      ).to.eq(0);
      expect(u192ToBN(obligationInfo.totalBorrowedValue).toNumber()).to.eq(0);

      const ticket = await amm.account.farmingTicket.fetch(
        poolInfo.farmingTicket
      );
      expect(ticket.tokensFrozen.toNumber()).to.eq(8);
      expect(ticket.endTime.toNumber()).to.be.lessThan(Date.now() / 1000);
    });

    it("cannot close position if leverage mismatch");
    it("cannot close position if the side is wrong");
    it("fails if obligation is not refreshed within last few seconds");

    it("closes position even if loan is repaid", async () => {
      const leverage = 250;

      const { amount: reserveSupplyBeforeOpen } =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          reserveDoge.accounts.reserveLiquidityWallet.publicKey
        );
      const { amount: borrowerDogeAmountBeforeOpen } =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          borrowerDogeWallet
        );
      const { amount: borrowerSrmAmountBeforeOpen } =
        await reserveSrm.accounts.liquidityMint.getAccountInfo(
          borrowerSrmWallet
        );
      const farmingReceipt = await obligation.openLeveragedPositionOnAldrin(
        reserveDoge,
        poolInfo,
        borrowerSrmWallet,
        borrowerDogeWallet,
        borrowerLpWallet,
        8,
        8,
        0,
        0,
        leverage
      );

      // repays the whole loan
      const repayLiquidity =
        u192ToBN(
          (await obligation.fetch()).reserves[1].liquidity.inner.borrowedAmount
        )
          .div(ONE_WAD)
          .toNumber() + 1; // plus one bcs integer division floors
      await obligation.repay(reserveDoge, borrowerDogeWallet, repayLiquidity, {
        leverage,
      });
      await obligation.refresh();
      const obligationInfo = await obligation.fetch();
      expect(obligationInfo.reserves[1]).to.deep.eq({ empty: {} });

      await oneFarmingPeriod();

      await obligation.closeLeveragedPositionOnAldrin(
        reserveDoge,
        poolInfo,
        farmingReceipt,
        borrowerSrmWallet,
        borrowerDogeWallet,
        borrowerLpWallet,
        leverage
      );
      const { amount: borrowerSrmAmountAfterClose } =
        await reserveSrm.accounts.liquidityMint.getAccountInfo(
          borrowerSrmWallet
        );
      const { amount: borrowerDogeAmountAfterClose } =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          borrowerDogeWallet
        );
      const { amount: reserveSupplyAfterClose } =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          reserveDoge.accounts.reserveLiquidityWallet.publicKey
        );

      expect(borrowerSrmAmountBeforeOpen.toNumber()).to.be.greaterThan(
        borrowerSrmAmountAfterClose.toNumber()
      );
      expect(borrowerDogeAmountAfterClose.toNumber()).to.be.greaterThanOrEqual(
        borrowerDogeAmountBeforeOpen.toNumber()
      );
      expect(reserveSupplyAfterClose.toNumber()).to.be.greaterThan(
        reserveSupplyBeforeOpen.toNumber()
      );

      await obligation.refresh();
      const latestObligationInfo = await obligation.fetch();
      expect(latestObligationInfo.reserves[1]).to.deep.eq({ empty: {} });

      await reserveDoge.refresh();
      const { liquidity } = await reserveDoge.fetch();
      expect(liquidity.availableAmount.toNumber()).to.eq(
        reserveSupplyAfterClose.toNumber()
      );
      expect(u192ToBN(liquidity.accruedInterest).lt(ONE_WAD)).to.be.true;
    });

    it("compounds", async () => {
      const leverage = 200;
      const [positionPda, _positionBumpSeed] =
        await PublicKey.findProgramAddress(
          [
            Buffer.from(market.id.toBytes()),
            Buffer.from(obligation.id.toBytes()),
            Buffer.from(reserveDoge.id.toBytes()),
            new BN(leverage).toBuffer("le", 8),
          ],
          market.program.programId
        );

      await obligation.openLeveragedPositionOnAldrin(
        reserveDoge,
        poolInfo,
        borrowerSrmWallet,
        borrowerDogeWallet,
        borrowerLpWallet,
        8,
        8,
        0,
        0,
        leverage
      );

      const newFarmingTicket = await createEmptyAccount(
        provider.connection,
        owner,
        amm.programId,
        amm.account.farmingTicket.size
      );

      const farmingCalcKeypair = Keypair.generate();
      await amm.rpc.initializeFarmingCalc({
        accounts: {
          farmingCalc: farmingCalcKeypair.publicKey,
          farmingTicket: poolInfo.farmingTicket,
          userKey: positionPda,
          farmingState: poolInfo.farmingState,
          initializer: owner.publicKey,
          rent: SYSVAR_RENT_PUBKEY,
        },
        instructions: [
          await amm.account.farmingCalc.createInstruction(farmingCalcKeypair),
        ],
        signers: [owner, farmingCalcKeypair],
      });

      async function calculateFarmed() {
        await oneFarmingPeriod();
        await amm.rpc.takeFarmingSnapshot({
          accounts: {
            pool: poolInfo.id,
            farmingState: poolInfo.farmingState,
            farmingSnapshots: poolInfo.snapshots,
            lpTokenFreezeVault: poolInfo.lpTokenFreeze,
            authority: poolAuthority.publicKey,
            clock: SYSVAR_CLOCK_PUBKEY,
            rent: SYSVAR_RENT_PUBKEY,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          signers: [poolAuthority],
        });
        await amm.rpc.calculateFarmed(new BN(1), {
          accounts: {
            pool: poolInfo.id,
            farmingState: poolInfo.farmingState,
            farmingSnapshots: poolInfo.snapshots,
            farmingCalc: farmingCalcKeypair.publicKey,
            farmingTicket: poolInfo.farmingTicket,
            clock: SYSVAR_CLOCK_PUBKEY,
          },
        });
      }

      await calculateFarmed();
      await calculateFarmed();

      const { amount: lpAmountBefore } = await poolMint.getAccountInfo(
        lpWallet
      );
      const { amount: farmAmountBefore } = await farmingMint.getAccountInfo(
        srmWallet
      );
      const exchangeLp = 75;
      await obligation.compoundLeveragedPositionOnAldrin(
        reserveDoge,
        poolInfo,
        farmingCalcKeypair.publicKey,
        reserveSrm,
        reserveDoge,
        reserveSrm,
        newFarmingTicket,
        lpWallet,
        srmWallet,
        leverage,
        // we set the farm rewards to be very high,
        // 1 LP ~= $7.6, farmed ~= $550, fee ~= $55, hence
        // $550 - $55 ~= $495  => ~75 LPs
        exchangeLp
      );

      const { amount: lpAmountAfter } = await poolMint.getAccountInfo(lpWallet);
      expect(lpAmountBefore.toNumber() - lpAmountAfter.toNumber()).to.eq(
        exchangeLp
      );
      const { amount: farmAmountAfter } = await farmingMint.getAccountInfo(
        srmWallet
      );
      expect(farmAmountAfter.toNumber()).to.be.greaterThan(
        farmAmountBefore.toNumber()
      );

      const newFarmingTicketInfo = await amm.account.farmingTicket.fetch(
        newFarmingTicket
      );
      expect(newFarmingTicketInfo.tokensFrozen.toNumber()).to.eq(exchangeLp);
      const startTimestamp = newFarmingTicketInfo.startTime.toNumber();
      expect(startTimestamp).to.be.greaterThan(Date.now() / 1000 - 20);
      expect(startTimestamp).to.be.lessThan(Date.now() / 1000);
      expect(newFarmingTicketInfo.userKey.toBase58()).to.eq(
        positionPda.toBase58()
      );
    });

    it("liquidates leveraged position", async () => {
      const leverage = 300;
      const srmColWallet =
        await reserveSrm.accounts.reserveCollateralMint.createAccount(
          owner.publicKey
        );

      const { amount: reserveSupplyBeforeOperation } =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          reserveDoge.accounts.reserveLiquidityWallet.publicKey
        );

      const farmingReceipt = await obligation.openLeveragedPositionOnAldrin(
        reserveDoge,
        poolInfo,
        borrowerSrmWallet,
        borrowerDogeWallet,
        borrowerLpWallet,
        100,
        100,
        0,
        0,
        leverage
      );

      // dips collateral and liquidates
      await reserveSrm.setOraclePrice(DEFAULT_SRM_PRICE / 10_000);
      await waitForCommit();
      await obligation.liquidate(
        Number.MAX_SAFE_INTEGER,
        reserveDoge,
        reserveSrm,
        dogeWallet,
        srmColWallet,
        {
          liquidator: owner,
          leverage,
        }
      );

      await obligation.refresh();
      const obligationInfo = await obligation.fetch();
      expect(u192ToBN(obligationInfo.allowedBorrowValue).toString()).to.eq("0");
      expect(u192ToBN(obligationInfo.totalBorrowedValue).gt(new BN(0))).to.be
        .true;
      expect(obligationInfo.reserves[0]).to.have.property("empty");
      const { amount: srmColAmount } =
        await reserveSrm.accounts.reserveCollateralMint.getAccountInfo(
          srmColWallet
        );
      expect(srmColAmount.toNumber()).to.eq(1000);

      // close position as another user, not borrower
      const { amount: dogeAmountBeforeClose } =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(dogeWallet);
      const { amount: srmAmountBeforeClose } =
        await reserveSrm.accounts.liquidityMint.getAccountInfo(srmWallet);
      await obligation.closeLeveragedPositionOnAldrin(
        reserveDoge,
        poolInfo,
        farmingReceipt,
        srmWallet,
        dogeWallet,
        lpWallet,
        leverage,
        { caller: owner }
      );
      const { amount: srmAmountAfterClose } =
        await reserveSrm.accounts.liquidityMint.getAccountInfo(srmWallet);
      const { amount: dogeAmountAfterClose } =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(dogeWallet);
      expect(dogeAmountBeforeClose.toNumber()).to.be.lessThan(
        dogeAmountAfterClose.toNumber()
      );
      expect(srmAmountBeforeClose.toNumber()).to.eq(
        srmAmountAfterClose.toNumber()
      );

      await obligation.refresh();
      const obligationInfoAfterClose = await obligation.fetch();
      expect(obligationInfoAfterClose.reserves[1]).to.have.property("empty");

      const { amount: reserveSupplyAfterOperation } =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          reserveDoge.accounts.reserveLiquidityWallet.publicKey
        );
      expect(reserveSupplyAfterOperation.toNumber()).to.be.greaterThan(
        reserveSupplyBeforeOperation.toNumber()
      );
    });

    async function oneFarmingPeriod() {
      // waiting minimum period length before being allowed to compound/close
      // prevents AMM's MinimumUnfreezeTimeNotPassed (0x13a)
      await new Promise((r) =>
        setTimeout(r, farmingPeriodLengthSecs * 1000 + 500)
      );
    }
  });
}
