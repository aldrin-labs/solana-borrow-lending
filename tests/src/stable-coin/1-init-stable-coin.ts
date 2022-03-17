import { Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { USP } from "../stable-coin";

export function test(owner: Keypair) {
  describe("init_stable_coin", () => {
    it("fails if authority is not PDA");
    it("fails if freeze authority is set");
    it("fails if amm is not executable");
    it("fails if pda is wrong");

    it("inits stable coin", async () => {
      const usp = await USP.init(owner);
      const uspInfo = await usp.fetch();

      expect(uspInfo.decimals).to.eq(8);
      expect(uspInfo.admin).to.deep.eq(owner.publicKey);
      expect(uspInfo.mint).to.deep.eq(usp.mint.publicKey);
    });
  });
}
