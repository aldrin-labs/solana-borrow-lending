import { Keypair, PublicKey } from "@solana/web3.js";
import { Reserve } from "../reserve";
import { LendingMarket } from "../lending-market";
import { expect } from "chai";
import { CaptureStdoutAndStderr } from "../helpers";
import { AmmFarm, AmmPool } from "../amm-pool";
import { globalContainer } from "../global-container";

export function test(owner: Keypair) {
  const { blp, amm, ammAuthority } = globalContainer;
  describe("vault position on aldrin", () => {
    const lpWalletTokensAmount = 100;
    const callerWallet = Keypair.generate();

    let market: LendingMarket,
      reserveSrm: Reserve,
      reserveDoge: Reserve,
      ammPool: AmmPool,
      ammFarm: AmmFarm,
      callerLpWallet: PublicKey,
      srmWallet: PublicKey;

    before("initialize lending market", async () => {
      market = await LendingMarket.init(blp, owner, undefined, amm.programId);
    });

    before("initialize reserves", async () => {
      reserveSrm = await market.addReserve(1000, undefined, "srm");
      reserveDoge = await market.addReserve(1000, undefined, "doge");

      await reserveDoge.refreshOraclePrice(999);
      await reserveSrm.refreshOraclePrice(999);
    });

    before("airdrop liquidity to owner", async () => {
      srmWallet = await reserveSrm.createLiquidityWallet(
        owner.publicKey,
        110_000
      );
    });

    before("initialize liquidity pool", async () => {
      ammPool = await AmmPool.init(
        amm,
        market,
        ammAuthority,
        reserveSrm.toTokenWrapper(),
        reserveDoge.toTokenWrapper()
      );
    });

    before("initialize farming", async () => {
      ammFarm = await AmmFarm.init(ammPool, reserveSrm.toTokenWrapper());
    });

    beforeEach("creates callers's LP wallet", async () => {
      callerLpWallet = await ammPool.accounts.mint.createAccount(
        callerWallet.publicKey
      );
      await ammPool.airdropLpTokens(callerLpWallet, lpWalletTokensAmount);
    });

    it("fails to open a position with 0 LP", async () => {
      const stdCapture = new CaptureStdoutAndStderr();

      await expect(
        ammFarm.openVaultPositionOnAldrin(callerWallet, callerLpWallet, 0)
      ).to.be.rejected;

      expect(stdCapture.restore()).to.contain("Must stake some LP tokens");
    });

    it("fails to open a position if caller not signed");

    it("opens a position", async () => {
      const [positionPda, _bumpSeed] = await ammPool.vaultPositionPda(
        callerWallet.publicKey
      );

      const { ticket, receipt } = await ammFarm.openVaultPositionOnAldrin(
        callerWallet,
        callerLpWallet,
        lpWalletTokensAmount / 2
      );

      const { amount: lpWalletAmount } =
        await ammPool.accounts.mint.getAccountInfo(callerLpWallet);
      expect(lpWalletAmount.toNumber()).to.eq(lpWalletTokensAmount / 2);

      const ticketInfo = await amm.account.farmingTicket.fetch(ticket);
      expect(ticketInfo.userKey).to.deep.eq(positionPda);
      expect(ticketInfo.tokensFrozen.toNumber()).to.eq(
        lpWalletTokensAmount / 2
      );

      const receiptInfo = await blp.account.aldrinFarmingReceipt.fetch(receipt);
      expect(receiptInfo.owner).to.deep.eq(callerWallet.publicKey);
      expect(receiptInfo.association).to.deep.eq(ammPool.id);
      expect(receiptInfo.ticket).to.deep.eq(ticket);
      expect(receiptInfo.leverage.percent.toNumber()).to.eq(100);
    });

    it("closes a vault position", async () => {
      const { ticket, receipt } = await ammFarm.openVaultPositionOnAldrin(
        callerWallet,
        callerLpWallet,
        lpWalletTokensAmount / 2
      );

      await ammFarm.oneFarmingPeriod();

      await ammFarm.closeVaultPositionOnAldrin(
        callerWallet,
        callerLpWallet,
        receipt,
        ticket
      );

      const { amount: lpWalletAmount } =
        await ammPool.accounts.mint.getAccountInfo(callerLpWallet);
      expect(lpWalletAmount.toNumber()).to.eq(lpWalletTokensAmount);
    });

    it("fails to close a position if wrong signer");
    it("fails to close a position if missing signer");

    it("fails to compound a position if insufficient LP amount");

    it("compounds a vault position", async () => {
      const [positionPda, positionBumpSeed] = await ammPool.vaultPositionPda(
        callerWallet.publicKey
      );

      const { ticket } = await ammFarm.openVaultPositionOnAldrin(
        callerWallet,
        callerLpWallet,
        lpWalletTokensAmount / 2
      );

      const farmingCalc = await ammFarm.initFarmingCalc(ticket, positionPda);
      const newFarmingTicket = await ammFarm.createFarmingTicketAccount();

      await ammFarm.calculateFarmed(ticket, farmingCalc);
      await ammFarm.calculateFarmed(ticket, farmingCalc);

      const { amount: farmBefore } =
        await reserveSrm.accounts.liquidityMint.getAccountInfo(srmWallet);
      const { amount: lpBefore } = await ammPool.accounts.mint.getAccountInfo(
        ammPool.accounts.lpWallet
      );
      const stakeLp = 50;
      await ammFarm.compoundPositionOnAldrin(
        positionPda,
        [
          Buffer.from(callerWallet.publicKey.toBytes()),
          Buffer.from(ammPool.id.toBytes()),
          Buffer.from([positionBumpSeed]),
        ],
        farmingCalc,
        reserveSrm,
        reserveDoge,
        reserveSrm,
        newFarmingTicket,
        ammPool.accounts.lpWallet,
        srmWallet,
        stakeLp
      );

      const { amount: farmAfter } =
        await reserveSrm.accounts.liquidityMint.getAccountInfo(srmWallet);
      expect(farmAfter.toNumber()).to.be.greaterThan(farmBefore.toNumber());

      const { amount: lpAfter } = await ammPool.accounts.mint.getAccountInfo(
        ammPool.accounts.lpWallet
      );
      expect(lpAfter.toNumber() + stakeLp).to.eq(lpBefore.toNumber());

      const ticketInfo = await amm.account.farmingTicket.fetch(
        newFarmingTicket
      );
      expect(ticketInfo.tokensFrozen.toNumber()).to.eq(stakeLp);
    });
  });
}
