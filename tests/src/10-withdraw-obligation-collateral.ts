import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { LendingMarket } from "./lending-market";
import { Obligation } from "./obligation";
import { Reserve } from "./reserve";
import { waitForCommit } from "./helpers";

export function test(
  program: Program<BorrowLending>,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("withdraw_obligation_collateral", () => {
    let sourceCollateralWalletAmount = 30;
    let market: LendingMarket,
      obligation: Obligation,
      reserve: Reserve,
      sourceCollateralWallet: PublicKey;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner, shmemProgramId);
    });

    before("initialize obligation", async () => {
      reserve = await market.addReserve(50);
    });

    before("initialize obligation", async () => {
      obligation = await market.addObligation();
    });

    before("mint reserve collateral for borrower", async () => {
      sourceCollateralWallet =
        await reserve.createCollateralWalletWithCollateral(
          obligation.borrower.publicKey,
          sourceCollateralWalletAmount
        );
    });

    beforeEach("refresh oracle slot validity", async () => {
      await reserve.refreshOraclePrice(10);
    });
  });
}
