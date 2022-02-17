//! An admin endpoint which is callable after an emission period ends (as
//! defined in [`Emission.ends_at_slot`]). It withdraws excess tokens by
//! transferring the ownership of all emission wallets and closes
//! the [`EmissionStrategy`] account.

use crate::prelude::*;
use anchor_spl::token::{self, Token};
use spl_token::instruction::AuthorityType;

#[derive(Accounts)]
#[instruction(lending_market_bump_seed: u8)]
pub struct CloseEmission<'info> {
    #[account(signer)]
    pub owner: AccountInfo<'info>,
    #[account(has_one = owner @ ErrorCode::InvalidMarketOwner)]
    pub lending_market: Account<'info, LendingMarket>,
    #[account(
        seeds = [lending_market.key().as_ref()],
        bump = lending_market_bump_seed,
    )]
    pub lending_market_pda: AccountInfo<'info>,
    #[account(mut, close = owner)]
    pub emissions: Account<'info, EmissionStrategy>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle<'info>(
    ctx: Context<'_, '_, '_, 'info, CloseEmission<'info>>,
    _lending_market_bump_seed: u8,
) -> ProgramResult {
    let accounts = ctx.accounts;

    let ends_at = accounts.emissions.ends_at_slot;

    // only two weeks after the emissions finished can we close this account
    if ends_at + consts::SLOTS_PER_WEEK * 2 > accounts.clock.slot {
        msg!(
            "Cannot close this account until slot {}",
            ends_at + consts::SLOTS_PER_WEEK
        );
        return Err(ErrorCode::MinDelayPeriodNotPassed.into());
    }

    let emission_tokens = accounts.emissions.tokens();
    if ctx.remaining_accounts.len() != emission_tokens.len() {
        msg!(
            "The number of remaining accounts must equal to the number \
            of different emitted token mints"
        );
        return Err(ProgramError::InvalidArgument);
    }

    // transfers all wallets from the BLp PDA back to the owner
    for (wallet, emitted_token) in
        ctx.remaining_accounts.iter().zip(emission_tokens.iter())
    {
        if *wallet.key != emitted_token.wallet {
            msg!(
                "Order of wallets in remaining accounts must follow the order \
                in the emission's mints"
            );
            return Err(ProgramError::InvalidArgument);
        }

        token::set_authority(
            accounts.as_set_wallet_authority_to_owner_context(wallet.clone()),
            AuthorityType::AccountOwner,
            Some(*accounts.owner.key),
        )?;
    }

    Ok(())
}

impl<'info> CloseEmission<'info> {
    pub fn as_set_wallet_authority_to_owner_context(
        &self,
        wallet: AccountInfo<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, token::SetAuthority<'info>> {
        let cpi_accounts = token::SetAuthority {
            current_authority: self.lending_market_pda.clone(),
            account_or_mint: wallet,
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}
