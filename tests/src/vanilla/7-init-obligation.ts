import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../../target/types/borrow_lending";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { CaptureStdoutAndStderr, u192ToBN } from "../helpers";
import { readFile } from "fs/promises";
import { LendingMarket } from "../lending-market";
import { Obligation } from "../obligation";

export function test(
  program: Program<BorrowLending>,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("init_obligation", () => {
    let market: LendingMarket;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(program, owner, shmemProgramId);
    });

    it("loads obligation from sample bin 2", async () => {
      const {
        reserves,
        depositedValue,
        collateralizedBorrowedValue,
        totalBorrowedValue,
        allowedBorrowValue,
        unhealthyBorrowValue,
      } = Obligation.fromBytesSkipDiscriminatorCheck(
        await readFile("tests/fixtures/sample_obligation2.bin")
      );

      expect(u192ToBN(depositedValue).toString("hex")).to.eq("0");
      expect(u192ToBN(collateralizedBorrowedValue).toString("hex")).to.eq(
        "f66666666666666ff66666666666666ff66666666666666f"
      );
      expect(u192ToBN(totalBorrowedValue).toString("hex")).to.eq(
        "e55555555555555ee55555555555555ee55555555555555e"
      );
      expect(u192ToBN(allowedBorrowValue).toString("hex")).to.eq("0");
      expect(u192ToBN(unhealthyBorrowValue).toString("hex")).to.eq(
        "177777777777777117777777777777711777777777777771"
      );

      expect(reserves).to.be.lengthOf(10);
      reserves.slice(2).forEach((r) => expect(r).to.deep.eq({ empty: {} }));

      const loan1 = reserves[0].liquidity.inner;
      expect(loan1.loanKind)
        .to.have.property("yieldFarming")
        .which.has.property("leverage");
      expect(loan1.loanKind.yieldFarming.leverage.toString("hex")).to.eq(
        "d44444444444444d"
      );
      expect(u192ToBN(loan1.cumulativeBorrowRate).toString("hex")).to.eq(
        "c33333333333333cc33333333333333cc33333333333333c"
      );
      expect(u192ToBN(loan1.marketValue).toString("hex")).to.eq(
        "b22222222222222bb22222222222222bb22222222222222b"
      );
      expect(u192ToBN(loan1.borrowedAmount).toString("hex")).to.eq(
        "a11111111111111aa11111111111111aa11111111111111a"
      );
      expect(loan1.emissionsClaimableFromSlot.toNumber()).to.eq(420);

      const loan2 = reserves[1].liquidity.inner;
      expect(loan2.loanKind.yieldFarming.leverage.toString("hex")).to.eq(
        "ffffffffffffffff"
      );
      expect(u192ToBN(loan2.cumulativeBorrowRate).toString("hex")).to.eq(
        "de0b6b3a7640000"
      );
      expect(u192ToBN(loan2.marketValue).toString("hex")).to.eq("0");
      expect(u192ToBN(loan2.borrowedAmount).toString("hex")).to.eq(
        "1a055690d9db80000"
      );
      expect(loan2.emissionsClaimableFromSlot.toNumber()).to.eq(999);
    });

    it("loads obligation from sample bin", async () => {
      const {
        owner,
        lendingMarket,
        lastUpdate,
        reserves,
        depositedValue,
        allowedBorrowValue,
      } = Obligation.fromBytesSkipDiscriminatorCheck(
        await readFile("tests/fixtures/sample_obligation.bin")
      );

      expect(u192ToBN(depositedValue).toString("hex")).to.eq(
        "280546df9578210000"
      );
      expect(u192ToBN(allowedBorrowValue).toString("hex")).to.eq(
        "2404bfc939b8ea8000"
      );

      expect(owner.toBase58()).to.eq(
        "7VXXvjSuLo9232Usk6Lm7MRTCCvGDCxu6Dnqbed379hY"
      );
      expect(lendingMarket.toBase58()).to.eq(
        "6k4dsh614omMenbjAA9DaprrL6XUXaQT9G43ecZUXS4r"
      );
      expect(lastUpdate.slot.toNumber()).to.eq(37);
      expect(lastUpdate.stale).to.eq(false);

      expect(reserves).to.be.lengthOf(10);
      reserves.slice(2).forEach((r) => expect(r).to.deep.eq({ empty: {} }));

      expect(reserves[1])
        .to.have.property("liquidity")
        .which.has.property("inner");
      const loan = reserves[1].liquidity.inner;
      expect(loan.borrowReserve).deep.eq(
        new PublicKey("EjkTWoxmBc9dSmMuEu2sHVnkpvyJm4p8XMKHg84m6FyE")
      );
      expect(u192ToBN(loan.marketValue).toString("hex")).to.eq(
        "4cd6ee7b9a09bde4c"
      );
      expect(u192ToBN(loan.borrowedAmount).toString("hex")).to.eq(
        "a688906f2467fd84"
      );
      expect(u192ToBN(loan.cumulativeBorrowRate).toString("hex")).to.eq(
        "de0b6b3edb35521"
      );
      expect(loan.emissionsClaimableFromSlot.toNumber()).to.eq(999);

      expect(reserves[0])
        .to.have.property("collateral")
        .which.has.property("inner");
      const deposit = reserves[0].collateral.inner;
      expect(deposit.depositReserve).deep.eq(
        new PublicKey("vPpDMe3ViBSvUhK3Vih8QyvPnoVahTKeZ1BTtRb5ipc")
      );
      expect(deposit.depositedAmount.toString("hex")).to.eq("64");
      expect(u192ToBN(deposit.marketValue).toString("hex")).to.eq(
        "280546df9578210000"
      );
      expect(deposit.emissionsClaimableFromSlot.toNumber()).to.eq(420);
    });

    it("fails if lending market doesn't exist", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      const originalMarket = market.account;
      market.account = Keypair.generate();

      await expect(market.addObligation()).to.be.rejected;

      market.account = originalMarket;

      stdCapture.restore();
    });

    it("initializes obligation accounts", async () => {
      const obligation = await market.addObligation();

      const obligationInfo = await obligation.fetch();

      expect(obligationInfo.reserves).to.deep.eq(
        new Array(10).fill(undefined).map(() => ({ empty: {} }))
      );
      expect(obligationInfo.lastUpdate.stale).to.be.true;
      expect(obligationInfo.lendingMarket).to.deep.eq(market.id);
      expect(obligationInfo.owner).to.deep.eq(obligation.borrower.publicKey);
      expect(u192ToBN(obligationInfo.totalBorrowedValue).toNumber()).to.eq(0);
      expect(
        u192ToBN(obligationInfo.collateralizedBorrowedValue).toNumber()
      ).to.eq(0);
      expect(u192ToBN(obligationInfo.depositedValue).toNumber()).to.eq(0);
      expect(u192ToBN(obligationInfo.allowedBorrowValue).toNumber()).to.eq(0);
      expect(u192ToBN(obligationInfo.unhealthyBorrowValue).toNumber()).to.eq(0);
    });
  });
}
