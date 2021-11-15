import { Program, Provider, BN, web3 } from "@project-serum/anchor";
import { BorrowLending } from "../../target/types/borrow_lending";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import {
  findLendingMarketPda,
  initLendingMarket,
} from "./1-init-lending-market";
import { CaptureStdoutAndStderr, waitForCommit } from "./helpers";
import { ONE_LIQ_TO_COL_INITIAL_PRICE } from "./consts";
import {
  initReserve,
  InitReserveAccounts,
  reserveConfig,
} from "./3-init-reserve";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { setOraclePriceSlot } from "./pyth";
import { refreshReserveInstruction } from "./4-refresh-reserve";
import { initObligationR10 } from "./7-init-obligation";

export function test(
  program: Program<BorrowLending>,
  provider: Provider,
  owner: Keypair,
  shmemProgramId: PublicKey
) {
  describe("withdraw_obligation_collateral", () => {
    //
  });
}
