import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { LendingMarket } from "./lending-market";
import { Reserve } from "./reserve";
import { Obligation } from "./obligation";
import { u192ToBN, waitForCommit } from "./helpers";

export function test(
  program: Program<BorrowLending>,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("borrow_obligation_liquidity", () => {
    let sourceDogeLiquidity = 500;
    let depositedSrmCollateralAmount = 50;
    let market: LendingMarket,
      obligation: Obligation,
      reserveSrm: Reserve,
      reserveDoge: Reserve,
      destinationDogeLiquidityWallet: PublicKey,
      hostFeeReceiver: PublicKey;

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

    before("initialize obligation", async () => {
      obligation = await market.addObligation();
    });

    before(
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

    beforeEach("create destination liquidity wallet", async () => {
      destinationDogeLiquidityWallet =
        await reserveDoge.accounts.liquidityMint.createAccount(
          obligation.borrower.publicKey
        );
    });

    beforeEach("create host fee receiver", async () => {
      hostFeeReceiver = await reserveDoge.accounts.liquidityMint.createAccount(
        obligation.borrower.publicKey
      );
    });

    beforeEach("refresh oracle slot validity", async () => {
      await reserveSrm.refreshOraclePrice(15);
      await reserveDoge.refreshOraclePrice(15);
      await waitForCommit();
    });

    it("borrows liquidity with host fee");
    it("cannot borrow more than allowed value of liquidity");
    it("fails if borrower is not signed");
    it("fails if borrower doesn't own obligation");
    it("fails if obligation stale");
    it("fails if reserve stale");
    it("fails if obligation has no deposits");
    it("fails if obligation's and reserve's lending markets mismatch");
    it("fails if source liquidity doesn't match reserve's config");
    it("fails if source liquidity wallet matches destination");
    it("fails if fee recv doesn't match reserve's config");
    it("depends on loan to value ration for maximum borrow value");

    it("borrows liquidity without host fee", async () => {
      const borrowDogeLiquidity = 100;
      await obligation.borrow(
        reserveDoge,
        borrowDogeLiquidity,
        destinationDogeLiquidityWallet
      );
      sourceDogeLiquidity -= borrowDogeLiquidity;

      const obligationInfo = await obligation.fetch();
      expect(obligationInfo.lastUpdate.stale).to.eq(true);
      expect(u192ToBN(obligationInfo.depositedValue).toString()).to.eq(
        "73825000000000000000"
      );
      // this gets updated on next refresh
      expect(u192ToBN(obligationInfo.borrowedValue).toNumber()).to.eq(0);

      expect(obligationInfo.reserves[0])
        .to.have.property("collateral")
        .which.has.property("inner");
      expect(obligationInfo.reserves[1])
        .to.have.property("liquidity")
        .which.has.property("inner");
      const obligationLiquidityInfo =
        obligationInfo.reserves[1].liquidity.inner;
      expect(obligationLiquidityInfo.borrowReserve).to.deep.eq(reserveDoge.id);
      expect(u192ToBN(obligationLiquidityInfo.borrowedAmount).toString()).to.eq(
        "102000000000000000000"
      );
      expect(
        u192ToBN(obligationLiquidityInfo.cumulativeBorrowRate).toString()
      ).to.eq("1000000000000000000");

      const destinationDogeWalletInfo =
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          destinationDogeLiquidityWallet
        );
      expect(destinationDogeWalletInfo.amount.toNumber()).to.eq(
        borrowDogeLiquidity
      );
    });
  });
}
