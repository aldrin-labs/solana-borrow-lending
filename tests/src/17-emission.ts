import { BN, Program } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { Keypair, PublicKey } from "@solana/web3.js";
import { Reserve } from "./reserve";
import { Obligation } from "./obligation";
import { LendingMarket } from "./lending-market";
import { expect } from "chai";
import { CaptureStdoutAndStderr } from "./helpers";
import { EmissionStrategy } from "./emission";
import { sleep } from "@project-serum/common";

export function test(
  program: Program<BorrowLending>,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("emission strategy", () => {
    let market: LendingMarket,
      reserve: Reserve,
      obligation: Obligation,
      colWallet: PublicKey,
      liqWallet: PublicKey;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner, shmemProgramId);
    });

    before("initialize reserve", async () => {
      // the other half will be put as collateral by borrower
      reserve = await market.addReserve(1_000);
      await reserve.refreshOraclePrice(999);
    });

    before("initialize obligation", async () => {
      obligation = await market.addObligation();
    });

    before("create liquidity wallet", async () => {
      liqWallet = await reserve.accounts.liquidityMint.createAccount(
        obligation.borrower.publicKey
      );
    });

    beforeEach(
      "gift reserve collateral to borrower and deposit it",
      async () => {
        colWallet = await reserve.createCollateralWalletWithCollateral(
          obligation.borrower.publicKey,
          150
        );

        await obligation.deposit(reserve, colWallet, 100);
      }
    );

    beforeEach("borrow liquidity", async () => {
      await obligation.borrow(reserve, liqWallet, 10);
    });

    beforeEach("snapshot reserve", async () => {
      await reserve.takeSnapshot();
    });

    it("cannot create emission if not market owner");
    it("reserve's market must match lending market");
    it("can have at most 5 different emissions");
    it("must match emission with remaining account wallets");

    it("creates emission strategy", async () => {
      const minSlots = 1;
      const strategy = await EmissionStrategy.init(
        market,
        reserve,
        [
          {
            tokensPerSlotForDeposits: 5,
            tokensPerSlotForLoans: 10,
          },
          {
            tokensPerSlotForDeposits: 15,
            tokensPerSlotForLoans: 20,
          },
        ],
        minSlots
      );

      const strategyInfo = await strategy.fetch();
      expect(strategyInfo.reserve).to.deep.eq(reserve.id);
      const tokens = strategyInfo.tokens as any[];
      expect(tokens).to.be.lengthOf(5);
      tokens.slice(strategy.emissionTokens.length).forEach((t) => {
        expect(t.wallet).to.deep.eq(PublicKey.default);
        expect(t.tokensPerSlotForLoans.toNumber()).to.eq(0);
        expect(t.tokensPerSlotForDeposits.toNumber()).to.eq(0);
      });
      expect(strategyInfo.minSlotsElapsedBeforeClaim.toNumber()).to.eq(
        minSlots
      );
      expect(strategyInfo.startsAtSlot.toNumber()).to.be.approximately(
        await program.provider.connection.getSlot(),
        4
      );
      expect(strategyInfo.endsAtSlot.toNumber()).to.be.greaterThan(
        strategyInfo.startsAtSlot.toNumber()
      );
    });

    it("claims emission", async () => {
      const collateralIndex = 0;
      const borrowIndex = 1;

      const strategy = await EmissionStrategy.init(market, reserve, [
        {
          tokensPerSlotForDeposits: 5,
          tokensPerSlotForLoans: 10,
        },
        {
          tokensPerSlotForDeposits: 15,
          tokensPerSlotForLoans: 20,
        },
      ]);

      // wait for a few slots
      await sleep(2000);

      const wallets = await strategy.createWallets(
        obligation.borrower.publicKey
      );

      const amountsAfterDepositClaim = [];
      await strategy.claim(obligation, collateralIndex, wallets);
      for (const { wallet, mint } of wallets.map((w, i) => ({
        wallet: w,
        mint: strategy.emissionTokens[i].mint,
      }))) {
        const { amount } = await mint.getAccountInfo(wallet);
        expect(amount.toNumber()).to.be.greaterThan(0);
        amountsAfterDepositClaim.push(amount.toNumber());
      }

      await strategy.claim(obligation, borrowIndex, wallets);
      for (const { wallet, mint, prev } of wallets.map((w, i) => ({
        wallet: w,
        mint: strategy.emissionTokens[i].mint,
        prev: amountsAfterDepositClaim[i],
      }))) {
        const { amount } = await mint.getAccountInfo(wallet);
        expect(amount.toNumber()).to.be.greaterThan(prev);
      }
    });

    it("closes strategy", async () => {
      const strategy = await EmissionStrategy.init(
        market,
        reserve,
        [
          {
            tokensPerSlotForDeposits: 5,
            tokensPerSlotForLoans: 10,
          },
        ],
        undefined,
        1,
        1
      );

      const stdCapture = new CaptureStdoutAndStderr();

      await expect(strategy.close()).to.be.rejected;

      expect(stdCapture.restore()).to.contain(
        "Cannot close this account until slot"
      );
    });
  });
}
