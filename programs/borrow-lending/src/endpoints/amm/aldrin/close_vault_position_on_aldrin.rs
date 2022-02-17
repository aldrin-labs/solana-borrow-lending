use super::UnstakeCpi;
use crate::prelude::*;
use anchor_spl::token::Token;

#[derive(Accounts)]
#[instruction(bump_seed: u8)]
pub struct CloseVaultPositionOnAldrin<'info> {
    /// It's mut because we are closing farming receipt account and returning
    /// lamports to caller.
    #[account(mut, signer)]
    pub caller: AccountInfo<'info>,
    /// See the [`crate::endpoints::amm::aldrin::
    /// open_leveraged_position_on_aldrin`] module for documentation on the
    /// rational behind these seeds, or the README.
    #[account(
        seeds = [caller.key().as_ref(), pool.key().as_ref()],
        bump = bump_seed,
    )]
    pub farming_ticket_owner_pda: AccountInfo<'info>,
    /// We no longer need the receipt as the farming ticket is closed.
    /// Therefore we return the rent back to caller.
    #[account(
        mut,
        close = caller,
        constraint = farming_receipt.ticket == *farming_ticket.key
            @ err::acc("Farming receipt must match farming ticket"),
    )]
    pub farming_receipt: Account<'info, AldrinFarmingReceipt>,
    // -------------- AMM Accounts ----------------
    #[account(executable)]
    pub amm_program: AccountInfo<'info>,
    #[account(
        constraint = *pool.owner == amm_program.key()
            @ err::illegal_owner("Amm pool account \
            must be owned by amm program"),
    )]
    pub pool: AccountInfo<'info>,
    pub pool_signer: AccountInfo<'info>,
    #[account(mut)]
    pub caller_lp_wallet: AccountInfo<'info>,
    pub farming_state: AccountInfo<'info>,
    #[account(mut)]
    pub farming_ticket: AccountInfo<'info>,
    pub farming_snapshots: AccountInfo<'info>,
    #[account(mut)]
    pub lp_token_freeze_vault: AccountInfo<'info>,
    // -------------- Other ----------------
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
    pub rent: AccountInfo<'info>,
}

pub fn handle(
    ctx: Context<CloseVaultPositionOnAldrin>,
    bump_seed: u8,
) -> ProgramResult {
    let accounts = ctx.accounts;

    UnstakeCpi::from(&accounts).unstake(&[
        &accounts.caller.key().to_bytes()[..],
        &accounts.pool.key().to_bytes()[..],
        &[bump_seed],
    ])?;

    Ok(())
}

impl<'info> From<&&mut CloseVaultPositionOnAldrin<'info>>
    for UnstakeCpi<'info>
{
    fn from(a: &&mut CloseVaultPositionOnAldrin<'info>) -> Self {
        Self {
            amm_program: *a.amm_program.key,
            pool: a.pool.to_account_info(),
            pool_signer: a.pool_signer.to_account_info(),
            farming_state: a.farming_state.to_account_info(),
            farming_ticket: a.farming_ticket.to_account_info(),
            farming_snapshots: a.farming_snapshots.to_account_info(),
            lp_token_freeze_vault: a.lp_token_freeze_vault.to_account_info(),
            caller_lp_wallet: a.caller_lp_wallet.to_account_info(),
            authority: a.farming_ticket_owner_pda.to_account_info(),
            token_program: a.token_program.to_account_info(),
            clock: a.clock.to_account_info(),
            rent: a.rent.to_account_info(),
        }
    }
}
