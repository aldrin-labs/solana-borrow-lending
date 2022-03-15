import { Program, BN } from "@project-serum/anchor";
import { BorrowLending } from "../../../target/types/borrow_lending";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { LendingMarket } from "../lending-market";
import { Obligation } from "../obligation";
import { Reserve } from "../reserve";
import { CaptureStdoutAndStderr, ONE_WAD, u192ToBN } from "../helpers";
import { ONE_LIQ_TO_COL_INITIAL_PRICE } from "../consts";

export function test(
  program: Program<BorrowLending>,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("withdraw_obligation_collateral", () => {
    const initialSourceCollateralWalletAmount = 10;
    const initialReserveLiqAmount = 200;
    let market: LendingMarket,
      obligation: Obligation,
      reserve: Reserve,
      destinationCollateralWallet: PublicKey;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner, shmemProgramId);
    });

    beforeEach("initialize reserve", async () => {
      reserve = await market.addReserve(initialReserveLiqAmount);
      await reserve.refreshOraclePrice(999);
    });

    beforeEach("initialize obligation", async () => {
      obligation = await market.addObligation();
    });

    beforeEach(
      "gift reserve collateral to borrower and deposit it",
      async () => {
        const sourceCollateralWallet =
          await reserve.createCollateralWalletWithCollateral(
            obligation.borrower.publicKey,
            initialSourceCollateralWalletAmount
          );

        await obligation.deposit(
          reserve,
          sourceCollateralWallet,
          initialSourceCollateralWalletAmount
        );
      }
    );

    beforeEach("create destination collateral wallet", async () => {
      destinationCollateralWallet =
        await reserve.accounts.reserveCollateralMint.createAccount(
          obligation.borrower.publicKey
        );
    });

    it("fails if no deposited collateral", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const emptyObligation = await market.addObligation();

      emptyObligation.reservesToRefresh.add(reserve);
      await expect(
        emptyObligation.withdraw(reserve, destinationCollateralWallet, 10)
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Obligation has no such reserve collateral"
      );
    });

    it("fails if instruction isn't signed", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.withdraw(reserve, destinationCollateralWallet, 10, {
          sign: false,
        })
      ).to.be.rejected;

      stdCapture.restore();
    });

    it("fails if obligation is stale", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.withdraw(reserve, destinationCollateralWallet, 10, {
          refreshObligation: false,
        })
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("ObligationStale");
    });

    it("fails if reserve is stale", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.withdraw(reserve, destinationCollateralWallet, 10, {
          refreshReserve: false,
        })
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("is stale");
    });

    it("fails if token program mismatches reserve", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.withdraw(reserve, destinationCollateralWallet, 10, {
          tokenProgram: Keypair.generate().publicKey,
        })
      ).to.be.rejectedWith(/Program ID was not as expected/);

      stdCapture.restore();
    });

    it("fails if reserve's market doesn't match obligation's market", async () => {
      const differentMarket = await LendingMarket.init(
        program,
        owner,
        shmemProgramId
      );
      const differentObligation = await differentMarket.addObligation();
      differentObligation.reservesToRefresh.add(reserve);

      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        differentObligation.withdraw(reserve, destinationCollateralWallet, 10)
      ).to.be.rejectedWith(/seeds constraint was violated/);

      stdCapture.restore();
    });

    it("fails if source collateral wallet doesn't match reserve's config", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const originalSourceCollateralWallet =
        reserve.accounts.reserveCollateralWallet;
      reserve.accounts.reserveCollateralWallet = Keypair.generate();

      await expect(
        obligation.withdraw(reserve, destinationCollateralWallet, 10)
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "[InvalidAccountInput] Source col. wallet must eq. reserve's col. supply"
      );

      reserve.accounts.reserveCollateralWallet = originalSourceCollateralWallet;
    });

    it("fails if destination collateral wallet equals the source one", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.withdraw(
          reserve,
          reserve.accounts.reserveCollateralWallet.publicKey,
          10
        )
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "[InvalidAccountInput] Dest. col. wallet mustn't eq. reserve's col. supply"
      );
    });

    it("cannot withdraw zero collateral", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(obligation.withdraw(reserve, destinationCollateralWallet, 0))
        .to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Collateral amount provided cannot be zero"
      );
    });

    it("withdraws half of collateral", async () => {
      const withdraw = initialSourceCollateralWalletAmount / 2;
      await obligation.withdraw(reserve, destinationCollateralWallet, withdraw);
      const sourceColWalletAmount =
        initialSourceCollateralWalletAmount - withdraw;

      const obligationInfo = await obligation.fetch();
      expect(obligationInfo.lastUpdate.stale).to.be.true;
      const obligationInfoReserve = (obligationInfo.reserves as any[]).shift()
        .collateral.inner;
      expect(obligationInfoReserve.depositReserve).to.deep.eq(reserve.id);
      expect(obligationInfoReserve.depositedAmount.toNumber()).to.eq(
        sourceColWalletAmount
      );

      const destinationCollateralWalletInfo =
        await reserve.accounts.reserveCollateralMint.getAccountInfo(
          destinationCollateralWallet
        );
      expect(destinationCollateralWalletInfo.amount.toNumber()).to.eq(
        sourceColWalletAmount
      );

      const reserveCollateralWalletInfo =
        await reserve.accounts.reserveCollateralMint.getAccountInfo(
          reserve.accounts.reserveCollateralWallet.publicKey
        );
      expect(reserveCollateralWalletInfo.amount.toNumber()).to.eq(
        sourceColWalletAmount
      );
    });

    it("withdraws all collateral", async () => {
      await obligation.withdraw(
        reserve,
        destinationCollateralWallet,
        initialSourceCollateralWalletAmount * 10 // should withdraw at most what's in the account
      );
      const withdrawnAmount = initialSourceCollateralWalletAmount;
      const sourceColWalletAmount = 0;

      const obligationInfo = await obligation.fetch();
      expect(obligationInfo.lastUpdate.stale).to.be.true;
      expect(obligationInfo.reserves).to.deep.eq(
        new Array(10).fill(undefined).map(() => ({ empty: {} }))
      );

      const destinationCollateralWalletInfo =
        await reserve.accounts.reserveCollateralMint.getAccountInfo(
          destinationCollateralWallet
        );
      expect(destinationCollateralWalletInfo.amount.toNumber()).to.eq(
        withdrawnAmount
      );

      const reserveCollateralWalletInfo =
        await reserve.accounts.reserveCollateralMint.getAccountInfo(
          reserve.accounts.reserveCollateralWallet.publicKey
        );
      expect(reserveCollateralWalletInfo.amount.toNumber()).to.eq(
        sourceColWalletAmount
      );

      await reserve.refresh();
      const reserveInfo = await reserve.fetch();
      expect(reserveInfo.collateral.mintTotalSupply.toNumber()).to.eq(
        initialReserveLiqAmount * ONE_LIQ_TO_COL_INITIAL_PRICE +
          initialSourceCollateralWalletAmount
      );
      const liq = reserveInfo.liquidity;
      expect(liq.availableAmount.toNumber()).to.eq(
        initialReserveLiqAmount +
          initialSourceCollateralWalletAmount / ONE_LIQ_TO_COL_INITIAL_PRICE
      );
      expect(u192ToBN(liq.borrowedAmount).toNumber()).to.eq(0);
      // ~ around 100000000xxxxxxxxxxx
      const lcb = u192ToBN(liq.cumulativeBorrowRate);
      expect(lcb.gt(ONE_WAD)).to.be.true;
      expect(lcb.lt(ONE_WAD.mul(new BN(2)))).to.be.true;
      expect(u192ToBN(liq.marketPrice).toString()).to.eq("7382500000000000000");
    });

    it("cannot withdraw collateral if borrowed lots of assets", async () => {
      const dogeReserve = await market.addReserve(
        initialReserveLiqAmount,
        undefined,
        "doge"
      );
      const destDogeWallet =
        await dogeReserve.accounts.liquidityMint.createAccount(owner.publicKey);
      const borrow = 53;
      await obligation.borrow(dogeReserve, destDogeWallet, borrow);

      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.withdraw(reserve, destinationCollateralWallet, 10)
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "cannot exceed maximum withdraw value"
      );
    });

    it("withdraws collateral as long as enough remains to cover borrows", async () => {
      const dogeReserve = await market.addReserve(
        initialReserveLiqAmount,
        undefined,
        "doge"
      );
      const destDogeWallet =
        await dogeReserve.accounts.liquidityMint.createAccount(owner.publicKey);

      await obligation.borrow(dogeReserve, destDogeWallet, 5);
      await obligation.withdraw(reserve, destinationCollateralWallet, 8);
    });
  });
}
