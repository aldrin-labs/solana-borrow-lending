import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { Keypair, PublicKey } from "@solana/web3.js";
import { Reserve } from "./reserve";
import { Obligation } from "./obligation";
import { LendingMarket } from "./lending-market";
import { expect } from "chai";
import { u192ToBN, waitForCommit } from "./helpers";

export function test(
  program: Program<BorrowLending>,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("repay_obligation_liquidity", () => {
    // this liquidity is borrowed for each test case
    const borrowedLiquidity = 100;
    // when we create borrower's doge wallet, we mint them some initial tokens
    const initialDogeAmount = 50;
    // this liquidity is given to the reserve once
    let sourceDogeLiquidity = 1000;
    let depositedSrmCollateralAmount = 50;
    let market: LendingMarket,
      obligation: Obligation,
      reserveSrm: Reserve,
      reserveDoge: Reserve,
      borrowerDogeLiquidityWallet: PublicKey;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner, shmemProgramId);
    });

    before("initialize reserves", async () => {
      reserveSrm = await market.addReserve(50, undefined, "srm");
      reserveDoge = await market.addReserve(
        sourceDogeLiquidity,
        undefined,
        "doge"
      );
    });

    beforeEach("initialize obligation", async () => {
      obligation = await market.addObligation();
    });

    beforeEach(
      "gift reserve SRM collateral to borrower and deposit it",
      async () => {
        const sourceCollateralWallet =
          await reserveSrm.createCollateralWalletWithCollateral(
            obligation.borrower.publicKey,
            depositedSrmCollateralAmount
          );

        await obligation.depositCollateral(
          reserveSrm,
          sourceCollateralWallet,
          depositedSrmCollateralAmount
        );
      }
    );

    beforeEach("create borrower's liquidity wallet", async () => {
      borrowerDogeLiquidityWallet =
        await reserveDoge.accounts.liquidityMint.createAccount(
          obligation.borrower.publicKey
        );

      await reserveDoge.accounts.liquidityMint.mintTo(
        borrowerDogeLiquidityWallet,
        reserveDoge.accounts.liquidityMintAuthority,
        [],
        initialDogeAmount
      );
    });

    beforeEach("refresh oracle slot validity", async () => {
      await reserveDoge.refreshOraclePrice(15);
      await reserveSrm.refreshOraclePrice(15);
      await waitForCommit();
    });

    beforeEach("borrow liquidity", async () => {
      expect(
        borrowedLiquidity,
        "increase initial sourceDogeLiquidity so that every test has enough funds"
      ).to.be.lessThanOrEqual(sourceDogeLiquidity);

      await obligation.borrow(
        reserveDoge,
        borrowedLiquidity,
        borrowerDogeLiquidityWallet
      );
      sourceDogeLiquidity -= borrowedLiquidity;
    });

    it("fails if repayer isn't signer");
    it("fails if reserve's and obligation's market mismatch");
    it("fails if obligation is stale");
    it("fails if reserve is stale");
    it("fails if destination wallet doesn't match reserve's config");
    it("fails if source liquidity wallet matches reserve's config");
    it("fails if liquidity amount is zero");
    it("fails if obligation has no such reserve borrow");

    it("repays some liquidity", async () => {
      const repayAmount = borrowedLiquidity / 2;
      const fee = 2;
      await obligation.repay(
        reserveDoge,
        borrowerDogeLiquidityWallet,
        repayAmount
      );
      sourceDogeLiquidity += repayAmount;

      const reserveInfo = await reserveDoge.fetch();
      expect(reserveInfo.lastUpdate.stale).to.be.true;
      expect(reserveInfo.liquidity.availableAmount.toNumber()).eq(
        sourceDogeLiquidity - fee
      );
      const rba = u192ToBN(reserveInfo.liquidity.borrowedAmount).toString();
      const rcbr = u192ToBN(
        reserveInfo.liquidity.cumulativeBorrowRate
      ).toString();
      const ruacp = u192ToBN(reserveInfo.liquidity.marketPrice).toString();
      expect(rba).eq("52000000029368340922");
      expect(rcbr).eq("1000000002190512419");
      expect(ruacp).eq("238167000000000000");

      const obligationInfo = await obligation.fetch();
      expect(obligationInfo.lastUpdate.stale).to.be.true;
      expect(
        u192ToBN(obligationInfo.depositedValue).lt(
          u192ToBN(obligationInfo.borrowedValue)
        )
      );
      const odv = u192ToBN(obligationInfo.depositedValue).toString();
      const obv = u192ToBN(obligationInfo.borrowedValue).toString();
      const oab = u192ToBN(obligationInfo.allowedBorrowValue).toString();
      const oub = u192ToBN(obligationInfo.unhealthyBorrowValue).toString();
      expect(odv).to.eq("73825000000000000000");
      expect(obv).to.eq("24293034053214192672");
      expect(oab).to.eq("66442500000000000000");
      expect(oub).to.eq("70872000000000000000");

      expect(obligationInfo.reserves[0].collateral).to.have.property("inner");
      expect(
        obligationInfo.reserves[0].collateral.inner.depositedAmount.toNumber()
      ).to.eq(depositedSrmCollateralAmount);

      expect(obligationInfo.reserves[1].liquidity).to.have.property("inner");
      expect(
        u192ToBN(
          obligationInfo.reserves[1].liquidity.inner.borrowedAmount
        ).toString()
      ).to.eq("102000000223432266738");

      const borrowerDogeLiquidityWalletInfo =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          borrowerDogeLiquidityWallet
        );
      expect(borrowerDogeLiquidityWalletInfo.amount.toNumber()).to.eq(
        borrowedLiquidity + initialDogeAmount - repayAmount
      );

      const sourceDogeLiquidityWalletInfo =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          reserveDoge.accounts.reserveLiquidityWallet.publicKey
        );
      expect(sourceDogeLiquidityWalletInfo.amount.toNumber()).to.eq(
        reserveInfo.liquidity.availableAmount.toNumber()
      );
    });

    it("repays at most what's owed");
  });
}
