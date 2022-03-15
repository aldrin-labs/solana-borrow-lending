import { Program } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import { StableCoin } from "../../target/types/stable_coin";
import { globalContainer } from "./globalContainer";

export class StableCoinAccount {
  public static async init(
    scp: Program<StableCoin> = globalContainer.scp,
    owner: PublicKey
  ): Promise<StableCoin> {
    //
  }
}
