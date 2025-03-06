use crate::prelude::*;
use anchor_spl::token::Token;
use cpis::aldrin::StakeCpi;

/// Contains caller pubkey, reserve pubkey and bump seed.
pub const VAULT_POSITION_PDA_SEEDS_LEN: usize = 3;

#[derive(Accounts)]
#[instruction(bump_seed: u8)]
pub struct OpenVaultPositionOnAldrin<'info> {
    pub lending_market: Box<Account<'info, LendingMarket>>,
    pub caller: Signer<'info>,
    /// The owner will be a PDA from the caller's key (who owns the LP token
    /// wallet) and the pool pubkey.
    ///
    /// See also [`VAULT_POSITION_PDA_SEEDS_LEN`]
    ///
    /// CHECK: UNSAFE_CODES.md#signer
    #[account(
        seeds = [caller.key().as_ref(), pool.key().as_ref()],
        bump = bump_seed,
    )]
    pub farming_ticket_owner_pda: AccountInfo<'info>,
    /// Allows us to search the blockchain accounts for associated farming
    /// ticket since the PDA is hard to work with.
    #[account(zero)]
    pub farming_receipt: Account<'info, AldrinFarmingReceipt>,
    // -------------- AMM Accounts ----------------
    /// CHECK: UNSAFE_CODES.md#constraints
    #[account(
        executable,
        constraint = lending_market.aldrin_amm == amm_program.key()
            @ err::aldrin_amm_program_mismatch(),
    )]
    pub amm_program: AccountInfo<'info>,
    /// CHECK: UNSAFE_CODES.md#amm
    pub pool: AccountInfo<'info>,
    /// CHECK: UNSAFE_CODES.md#amm
    #[account(mut)]
    pub caller_lp_wallet: AccountInfo<'info>,
    /// CHECK: UNSAFE_CODES.md#amm
    pub farming_state: AccountInfo<'info>,
    /// CHECK: UNSAFE_CODES.md#amm
    #[account(mut)]
    pub farming_ticket: AccountInfo<'info>,
    /// CHECK: UNSAFE_CODES.md#amm
    #[account(mut)]
    pub lp_token_freeze_vault: AccountInfo<'info>,
    // -------------- Other ----------------
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
    /// CHECK: UNSAFE_CODES.md#amm
    pub rent: AccountInfo<'info>,
}

pub fn handle(
    ctx: Context<OpenVaultPositionOnAldrin>,
    bump_seed: u8,
    stake_lp_amount: u64,
) -> Result<()> {
    let accounts = ctx.accounts;

    if stake_lp_amount == 0 {
        msg!("Must stake some LP tokens");
        return Err(ErrorCode::InvalidAmount.into());
    }

    StakeCpi::from(&accounts).stake(
        &[
            &accounts.caller.key().to_bytes()[..],
            &accounts.pool.key().to_bytes()[..],
            &[bump_seed],
        ],
        stake_lp_amount,
    )?;

    accounts.farming_receipt.owner = accounts.caller.key();
    accounts.farming_receipt.association = accounts.pool.key();
    accounts.farming_receipt.ticket = accounts.farming_ticket.key();
    accounts.farming_receipt.leverage = Leverage::new(100); // no leverage

    Ok(())
}

impl<'info> From<&&mut OpenVaultPositionOnAldrin<'info>> for StakeCpi<'info> {
    fn from(a: &&mut OpenVaultPositionOnAldrin<'info>) -> Self {
        Self {
            amm_program: *a.amm_program.key,
            pool: a.pool.to_account_info(),
            farming_state: a.farming_state.to_account_info(),
            farming_ticket: a.farming_ticket.to_account_info(),
            lp_token_freeze_vault: a.lp_token_freeze_vault.to_account_info(),
            user_lp_wallet: a.caller_lp_wallet.to_account_info(),
            user: a.caller.to_account_info(),
            market_obligation_pda: a.farming_ticket_owner_pda.to_account_info(),
            token_program: a.token_program.to_account_info(),
            clock: a.clock.to_account_info(),
            rent: a.rent.to_account_info(),
        }
    }
}
