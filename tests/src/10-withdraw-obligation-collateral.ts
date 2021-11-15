import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { LendingMarket } from "./lending-market";
import { Obligation } from "./obligation";
import { Reserve } from "./reserve";
import { CaptureStdoutAndStderr } from "./helpers";

export function test(
  program: Program<BorrowLending>,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("withdraw_obligation_collateral", () => {
    let sourceCollateralWalletAmount = 10;
    let market: LendingMarket,
      obligation: Obligation,
      reserve: Reserve,
      sourceCollateralWallet: PublicKey,
      destinationCollateralWallet: PublicKey;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner, shmemProgramId);
    });

    before("initialize obligation", async () => {
      reserve = await market.addReserve(50);
    });

    before("initialize obligation", async () => {
      obligation = await market.addObligation();
    });

    before("gift reserve collateral to borrower", async () => {
      sourceCollateralWallet =
        await reserve.createCollateralWalletWithCollateral(
          obligation.borrower.publicKey,
          sourceCollateralWalletAmount
        );
    });

    beforeEach("create destination collateral wallet", async () => {
      destinationCollateralWallet =
        await reserve.accounts.reserveCollateralMint.createAccount(
          obligation.borrower.publicKey
        );
    });

    beforeEach("refresh oracle slot validity", async () => {
      await reserve.refreshOraclePrice(10);
    });

    it("fails if no deposited collateral", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        obligation.withdrawCollateral(reserve, destinationCollateralWallet, 10)
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Obligation has no such reserve collateral"
      );
    });

    it("fails if instruction isn't signed");
    it("fails if obligation is stale");
    it("fails if reserve is stale");
    it("fails if reserve's market doesn't match obligation's market");
    it("fails if source collateral wallet doesn't match reserve's config");
    it("fails if destination collateral wallet equals the source one");
    it("cannot withdraw zero collateral");
    it("withdraws half of collateral");
    it("withdraws all collateral");

    // TODO: these tests can be added only when borrowing is implemented
    it("cannot withdraw collateral if borrowed lots of assets");
    it("withdraws collateral as long as enough remains to cover borrows");
  });
}
