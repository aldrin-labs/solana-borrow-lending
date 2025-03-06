//! Creates a new [`EmissionStrategy`] account for a reserve. As remaining
//! accounts you must provide a list of wallets owned by the market owner and
//! the number of those wallets must match the `tokens` argument len and in
//! according order.

use crate::prelude::*;
use anchor_spl::token::{self, Token};
use spl_token::instruction::AuthorityType;
use std::convert::TryInto;
use std::iter;

#[derive(Accounts)]
#[instruction(lending_market_bump_seed: u8)]
pub struct CreateEmission<'info> {
    pub owner: Signer<'info>,
    #[account(has_one = owner @ ErrorCode::InvalidMarketOwner)]
    pub lending_market: Box<Account<'info, LendingMarket>>,
    /// CHECK: UNSAFE_CODES.md#signer
    #[account(
        seeds = [lending_market.key().as_ref()],
        bump = lending_market_bump_seed,
    )]
    pub lending_market_pda: AccountInfo<'info>,
    #[account(
        constraint = reserve.lending_market == lending_market.key()
            @ err::acc("Lending market doesn't match reserve's config"),
    )]
    pub reserve: Box<Account<'info, Reserve>>,
    #[account(zero)]
    pub emission: Account<'info, EmissionStrategy>,
    pub token_program: Program<'info, Token>,
}

pub fn handle<'info>(
    ctx: Context<'_, '_, '_, 'info, CreateEmission<'info>>,
    _lending_market_bump_seed: u8,
    starts_at_slot: u64,
    ends_at_slot: u64,
    min_slots_elapsed_before_claim: u64,
    tokens: Vec<EmittedToken>,
) -> Result<()> {
    let accounts = ctx.accounts;

    let input_tokens_len = tokens.len();

    if input_tokens_len > consts::EMISSION_TOKENS_COUNT {
        msg!(
            "At most {} different emission token mints are allowed",
            consts::EMISSION_TOKENS_COUNT
        );
        return Err(error!(ErrorCode::InvalidArgument));
    }
    if input_tokens_len != ctx.remaining_accounts.len() {
        msg!(
            "In remaining accounts, there must be {} wallets",
            input_tokens_len
        );
        return Err(error!(ErrorCode::InvalidArgument));
    }

    // transfers all wallets to the BLp
    for (wallet, emitted_token) in
        ctx.remaining_accounts.iter().zip(tokens.iter())
    {
        if *wallet.key != emitted_token.wallet {
            msg!(
                "Order of wallets in remaining accounts must follow the order \
                in the emission's mints"
            );
            return Err(error!(ErrorCode::InvalidArgument));
        }

        token::set_authority(
            accounts.as_set_wallet_authority_to_pda_context(wallet.clone()),
            AuthorityType::AccountOwner,
            Some(*accounts.lending_market_pda.key),
        )?;
    }

    let tokens: Vec<_> = tokens
        .into_iter()
        // take whatever was provided and pad the rest with empty
        .chain(
            // we've already checked that input_tokens_len is not greater
            // than [`consts::EMISSION_TOKENS_COUNT`]
            iter::repeat(EmittedToken::empty())
                .take(consts::EMISSION_TOKENS_COUNT - input_tokens_len),
        )
        .collect();
    accounts.emission.tokens = tokens.try_into().map_err(|_| {
        msg!("Cannot convert vector into array");
        ErrorCode::InvalidArgument
    })?;
    accounts.emission.reserve = accounts.reserve.key();
    accounts.emission.starts_at_slot = starts_at_slot;
    accounts.emission.ends_at_slot = ends_at_slot;
    accounts.emission.min_slots_elapsed_before_claim =
        min_slots_elapsed_before_claim;

    Ok(())
}

impl<'info> CreateEmission<'info> {
    pub fn as_set_wallet_authority_to_pda_context(
        &self,
        wallet: AccountInfo<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, token::SetAuthority<'info>> {
        let cpi_accounts = token::SetAuthority {
            current_authority: self.owner.to_account_info(),
            account_or_mint: wallet,
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}
