import { Program } from "@project-serum/anchor";
import { StableCoin } from "../../../target/types/stable_coin";
import { Keypair } from "@solana/web3.js";
import { expect } from "chai";

export function test(program: Program<StableCoin>) {
  describe("init_stable_coin", () => {
    it("fails if authority is not PDA");
    it("fails if freeze authority is set");
    it("fails if amm is not executable");
    it("fails if pda is wrong");
    it("inits stable coin");
  });
}
