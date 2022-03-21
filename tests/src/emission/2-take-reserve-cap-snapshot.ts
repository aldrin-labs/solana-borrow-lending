import { Program } from "@project-serum/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { BorrowLending } from "../../../target/types/borrow_lending";
import { Reserve } from "../reserve";
import { LendingMarket } from "../lending-market";
import { expect } from "chai";
import { Obligation } from "../obligation";
import { ONE_WAD, u192ToBN } from "../helpers";
import { globalContainer } from "../globalContainer";

export function test(owner: Keypair) {
  const program: Program<BorrowLending> = globalContainer.blp;
  describe("take_reserve_cap_snapshot", () => {
    let market: LendingMarket,
      reserve: Reserve,
      obligation: Obligation,
      colWallet: PublicKey,
      liqWallet: PublicKey;
    const initialReserveLiquidity = 9_000;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner);
    });

    before("initialize reserve", async () => {
      // the other half will be put as collateral by borrower
      reserve = await market.addReserve(initialReserveLiquidity / 2);
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

    before(
      "gift reserve SRM collateral to borrower and deposit it",
      async () => {
        colWallet = await reserve.createCollateralWalletWithCollateral(
          obligation.borrower.publicKey,
          initialReserveLiquidity / 2 // the other half was put at creation
        );

        await obligation.deposit(
          reserve,
          colWallet,
          initialReserveLiquidity / 2
        );
      }
    );

    it("defaults to tip 0", async () => {
      const currentSlot = await program.provider.connection.getSlot();
      const snapshots = await program.account.reserveCapSnapshots.fetch(
        reserve.accounts.snapshots.publicKey
      );

      expect(snapshots.reserve).to.deep.eq(reserve.id);
      expect(snapshots.ringBufferTip).to.eq(0);
      const buffer = snapshots.ringBuffer as any[];
      expect(buffer.length).to.eq(1000);
      buffer.slice(1).forEach((entry) => {
        expect(entry.slot.toNumber()).to.eq(0);
        expect(entry.availableAmount.toNumber()).to.eq(0);
        expect(entry.borrowedAmount.toNumber()).to.eq(0);
      });
      const firstEntry = buffer[0];
      const firstEntrySlot = firstEntry.slot.toNumber();
      expect(firstEntrySlot).to.be.approximately(currentSlot, 10);
      expect(firstEntry.borrowedAmount.toNumber()).to.eq(0);
      expect(firstEntry.availableAmount.toNumber()).to.eq(
        // we only started with half and second
        // half has been added later in another hook
        initialReserveLiquidity / 2
      );
    });

    it("takes multiple snapshots", async () => {
      // deposit something so that we can check that future
      const depositEachIteration = 4;
      const borrowEachIteration = 5;

      let tip = 0;
      // single iteration takes about ~3s
      for (let i = 0; i < 10; i++) {
        await reserve.takeSnapshot(); // takes 1 slot =~ 400ms
        tip++;

        const [currentSlot, snapshots, reserveInfo] = await Promise.all([
          program.provider.connection.getSlot(),
          program.account.reserveCapSnapshots.fetch(
            reserve.accounts.snapshots.publicKey
          ),
          program.account.reserve.fetch(reserve.id),
        ]);

        expect(snapshots.ringBufferTip).to.eq(tip);

        const buffer = snapshots.ringBuffer as any[];
        expect(buffer[tip].slot.toNumber()).to.be.approximately(currentSlot, 5);
        expect(buffer[tip].availableAmount.toNumber()).to.eq(
          reserveInfo.liquidity.availableAmount.toNumber()
        );
        expect(buffer[tip].borrowedAmount.toNumber()).to.be.eq(
          u192ToBN(reserveInfo.liquidity.borrowedAmount).div(ONE_WAD).toNumber()
        );

        await reserve.deposit(depositEachIteration);
        await obligation.borrow(reserve, liqWallet, borrowEachIteration);
      }
    });
  });
}
