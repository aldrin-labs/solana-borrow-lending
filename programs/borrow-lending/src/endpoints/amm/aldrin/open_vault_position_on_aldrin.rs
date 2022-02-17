use super::StakeCpi;
use crate::prelude::*;
use anchor_spl::token::Token;

/// Contains caller pubkey, reserve pubkey and bump seed.
pub const VAULT_POSITION_PDA_SEEDS_LEN: usize = 3;

#[derive(Accounts)]
#[instruction(bump_seed: u8)]
pub struct OpenVaultPositionOnAldrin<'info> {
    pub lending_market: Box<Account<'info, LendingMarket>>,
    #[account(signer)]
    pub caller: AccountInfo<'info>,
    /// The owner will be a PDA from the caller's key (who owns the LP token
    /// wallet) and the pool pubkey.
    ///
    /// See also [`VAULT_POSITION_PDA_SEEDS_LEN`]
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
    #[account(
        executable,
        constraint = lending_market.aldrin_amm == amm_program.key()
            @ err::aldrin_amm_program_mismatch(),
    )]
    pub amm_program: AccountInfo<'info>,
    pub pool: AccountInfo<'info>,
    #[account(mut)]
    pub caller_lp_wallet: AccountInfo<'info>,
    pub farming_state: AccountInfo<'info>,
    #[account(mut)]
    pub farming_ticket: AccountInfo<'info>,
    #[account(mut)]
    pub lp_token_freeze_vault: AccountInfo<'info>,
    // -------------- Other ----------------
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
    pub rent: AccountInfo<'info>,
}

pub fn handle(
    ctx: Context<OpenVaultPositionOnAldrin>,
    bump_seed: u8,
    stake_lp_amount: u64,
) -> ProgramResult {
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
            borrower_lp_wallet: a.caller_lp_wallet.to_account_info(),
            borrower: a.caller.to_account_info(),
            market_obligation_pda: a.farming_ticket_owner_pda.to_account_info(),
            token_program: a.token_program.to_account_info(),
            clock: a.clock.to_account_info(),
            rent: a.rent.to_account_info(),
        }
    }
}
