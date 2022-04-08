import { Program } from "@project-serum/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { BorrowLending } from "../../target/types/borrow_lending";
import { StableCoin } from "../../target/types/stable_coin";

export const globalContainer: {
  payer?: Keypair;
  amm?: Program<any>;
  blp?: Program<BorrowLending>;
  scp?: Program<StableCoin>;
  ammAuthority?: Keypair;
  shmem?: PublicKey;
} = {};
