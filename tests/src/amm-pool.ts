import { PublicKey } from "@solana/web3.js";

export interface AmmPool {
  id: PublicKey;
  amm: PublicKey;
  mint: PublicKey;
  snapshots: PublicKey;
  vaultSigner: PublicKey;
  vaultBase: PublicKey;
  feeVaultBase: PublicKey;
  vaultQuote: PublicKey;
  feeVaultQuote: PublicKey;
  farmTokenVault: PublicKey;
  feeWallet: PublicKey;
  farmingState: PublicKey;
  farmingTicket: PublicKey;
  lpTokenFreeze: PublicKey;
}
