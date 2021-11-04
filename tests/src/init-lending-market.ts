import { Program } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";

export function test(program: Program<BorrowLending>) {
  describe("init_lending_market", () => {
    it("with USD", async () => {
      const owner = Keypair.generate();
      const market = Keypair.generate();
      const oracle = Keypair.generate();

      const marketInfo = await initLendingMarket(
        program,
        owner,
        market,
        oracle.publicKey
      );
      expect(marketInfo.currency).to.deep.eq({ usd: {} });
      expect(marketInfo.owner).to.deep.eq(owner.publicKey);
      expect(marketInfo.oracleProgram).to.deep.eq(oracle.publicKey);
    });

    it("with pubkey", async () => {
      const owner = Keypair.generate();
      const market = Keypair.generate();
      const oracle = Keypair.generate();
      const currency = Keypair.generate();

      const marketInfo = await initLendingMarket(
        program,
        owner,
        market,
        oracle.publicKey,
        currency.publicKey
      );
      expect(marketInfo.currency).to.deep.eq({
        pubkey: { address: currency.publicKey },
      });
      expect(marketInfo.owner).to.deep.eq(owner.publicKey);
      expect(marketInfo.oracleProgram).to.deep.eq(oracle.publicKey);
    });
  });
}

export async function initLendingMarket(
  program: Program<BorrowLending>,
  owner: Keypair,
  market: Keypair,
  oracle: PublicKey,
  currency: "usd" | PublicKey = "usd"
) {
  await program.rpc.initLendingMarket(
    currency === "usd" ? { usd: {} } : { pubkey: { address: currency } },
    {
      accounts: {
        owner: owner.publicKey,
        lendingMarket: market.publicKey,
        oracleProgram: oracle,
      },
      instructions: [
        await program.account.lendingMarket.createInstruction(market),
      ],
      signers: [owner, market],
    }
  );

  return program.account.lendingMarket.fetch(market.publicKey);
}

export async function findLendingMarketPda(
  programId: PublicKey,
  market: PublicKey
) {
  return PublicKey.findProgramAddress(
    [Buffer.from(market.toBytes())],
    programId
  );
}
