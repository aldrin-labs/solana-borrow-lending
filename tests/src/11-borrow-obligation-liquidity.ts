import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { LendingMarket } from "./lending-market";
import { Reserve } from "./reserve";
import { Obligation } from "./obligation";

export function test(
  program: Program<BorrowLending>,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("borrow_obligation_liquidity", () => {
    let depositedSrmCollateralAmount = 50;
    let market: LendingMarket,
      obligation: Obligation,
      reserveSrm: Reserve,
      reserveDoge: Reserve,
      destinationSrmCollateralWallet: PublicKey,
      destinationDogeLiquidityWallet: PublicKey,
      feeReceiver: PublicKey,
      hostFeeReceiver: PublicKey;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner, shmemProgramId);
    });

    before("initialize reserves", async () => {
      reserveSrm = await market.addReserve(50, undefined, "srm");
      reserveDoge = await market.addReserve(500, undefined, "doge");
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

    beforeEach("create destination collateral wallet", async () => {
      destinationSrmCollateralWallet =
        await reserveSrm.accounts.reserveCollateralMint.createAccount(
          obligation.borrower.publicKey
        );
    });

    beforeEach("create destination liquidity wallet", async () => {
      destinationDogeLiquidityWallet =
        await reserveDoge.accounts.reserveCollateralMint.createAccount(
          obligation.borrower.publicKey
        );
    });

    beforeEach("create fee receivers", async () => {
      feeReceiver = await reserveDoge.accounts.liquidityMint.createAccount(
        obligation.borrower.publicKey
      );

      hostFeeReceiver = await reserveDoge.accounts.liquidityMint.createAccount(
        obligation.borrower.publicKey
      );
    });

    beforeEach("refresh oracle slot validity", async () => {
      await reserveSrm.refreshOraclePrice(10);
      await reserveDoge.refreshOraclePrice(10);
    });

    it.only("borrows liquidity without host fee", async () => {
      await obligation.borrow(
        reserveDoge,
        100,
        destinationDogeLiquidityWallet,
        feeReceiver
      );

      console.log(await obligation.fetch());
      console.log(
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          destinationDogeLiquidityWallet
        )
      );
      console.log(
        await reserveDoge.accounts.liquidityMint.getAccountInfo(
          reserveDoge.accounts.sourceLiquidityWallet
        )
      );
    });
  });
}
