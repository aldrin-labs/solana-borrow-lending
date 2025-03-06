import { PublicKey } from "@solana/web3.js";

export const ONE_LIQ_TO_COL_INITIAL_PRICE = 1; // atm given by a constant in prelude

export const LIQ_MINTED_TO_RESEVE_SOURCE_WALLET = 10000;

// the default price value in the binary in fixtures directory
export const DEFAULT_SRM_PRICE = 7382500000;

export const SHMEM_SO_BIN_PATH = "bin/shmem.so";
export const FLASHLOAN_TARGET_SO_BIN_PATH = "bin/flashloan_target.so";
export const AMM_TARGET_SO_BIN_PATH =
  "bin/amm/deploy/mm_farming_pool_product_only.so";

// hardcoded in the AMM bin
export const AMM_FEE_OWNER = new PublicKey(
  "D7FkvSLw8rq8Ydh43tBViSQuST2sBczEStbWudFhR6L"
);
