//! Users should periodically call this endpoint to claim the emissions they're
//! eligible for. They must call this for each of their collateral and loan
//! positions separately.
//!
//! However, if a reserve emits multiple tokens, all are given to the user in
//! the same call. The wallets must be provided as remaining accounts and in
//! the same order as defined in the [`EmissionStrategy`] account. For
//! example, if emission is from mints A, B and C, then 6 wallets are at play. 3
//! wallets owner by the caller into which emissions are transferred, and 3
//! wallets defined in the [`EmissionStrategy`] account owned by the PDA that
//! tokens are transferred from. So, in this example, remaining accounts would
//! be an array of 6 accounts:
//!
//! 1. emission supply wallet A
//! 2. caller wallet A
//! 3. emission supply wallet B
//! 4. caller wallet B
//! 5. emission supply wallet C
//! 6. caller wallet C

use crate::prelude::*;
use anchor_spl::token::{self, Token};

#[derive(Accounts)]
#[instruction(lending_market_bump_seed: u8)]
pub struct ClaimEmission<'info> {
    /// Owner of the obligation
    #[account(signer)]
    pub caller: AccountInfo<'info>,
    pub lending_market: Account<'info, LendingMarket>,
    #[account(
        constraint = reserve.lending_market == lending_market.key()
            @ err::market_mismatch(),
        constraint = snapshots.key() == reserve.snapshots
            @ err::acc("Snapshot doesn't match reserve's snapshot pubkey"),
        constraint = emission.reserve == reserve.key()
            @ err::acc("Emission strategy reserve doesn't match provided one"),
    )]
    pub reserve: Box<Account<'info, Reserve>>,
    pub snapshots: AccountLoader<'info, ReserveCapSnapshots>,
    #[account(mut)]
    pub obligation: AccountLoader<'info, Obligation>,
    #[account(
        seeds = [lending_market.key().as_ref()],
        bump = lending_market_bump_seed,
    )]
    pub lending_market_pda: AccountInfo<'info>,
    pub emission: Account<'info, EmissionStrategy>,
    pub token_program: Program<'info, Token>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle<'info>(
    ctx: Context<'_, '_, '_, 'info, ClaimEmission<'info>>,
    lending_market_bump_seed: u8,
    reserve_index: u8,
) -> ProgramResult {
    let accounts = ctx.accounts;

    msg!("Claiming emissions at slot {}", accounts.clock.slot);

    let reserve_index = reserve_index as usize;
    if reserve_index >= consts::MAX_OBLIGATION_RESERVES {
        msg!(
            "Obligation reserves are limited to {}",
            consts::MAX_OBLIGATION_RESERVES
        );
        return Err(ErrorCode::ObligationReserveLimit.into());
    }

    let mut obligation = accounts.obligation.load_mut()?;

    if accounts.caller.key() != obligation.owner {
        return Err(ProgramError::IllegalOwner);
    }

    // we know that the index is less than array size, so it's safe
    let (is_loan, reserve, last_claimed_at_slot, share) =
        match &mut obligation.reserves[reserve_index] {
            ObligationReserve::Empty => {
                msg!("Obligation's reserve at slot {} is empty", reserve_index);
                Err(ErrorCode::CannotClaimEmissionFromReserveIndex)
            }
            ObligationReserve::Liquidity { mut inner } => {
                let is_loan = true;
                let last_claim = inner.emissions_claimable_from_slot;
                // update slot to now
                inner.emissions_claimable_from_slot = accounts.clock.slot;
                Ok((
                    is_loan,
                    inner.borrow_reserve,
                    last_claim,
                    inner.borrowed_amount.to_dec(),
                ))
            }
            ObligationReserve::Collateral { inner } => {
                let is_loan = false;
                let last_claim = inner.emissions_claimable_from_slot;
                // update slot to now
                inner.emissions_claimable_from_slot = accounts.clock.slot;
                Ok((
                    is_loan,
                    inner.deposit_reserve,
                    last_claim,
                    inner.deposited_amount.into(),
                ))
            }
        }?;
    drop(obligation);
    // this also implies that the obligation is in the same lending market,
    // because we've checked that the emission reserve matches provided reserve
    // and that the provided reserve's lending market matches too
    if reserve != accounts.emission.reserve {
        msg!(
            "The obligation's reserve {} at index {} \
            doesn't match emission reserve {}",
            reserve,
            reserve_index,
            accounts.emission.reserve
        );
        return Err(err::acc(
            "Obligation reserve doesn't match emission reserve",
        ));
    }

    let claim_from_slot =
        last_claimed_at_slot.max(accounts.emission.starts_at_slot);
    if claim_from_slot + accounts.emission.min_slots_elapsed_before_claim
        > accounts.clock.slot
    {
        msg!(
            "Trying to claim emission from slot {}, \
            but waiting time is {} slots",
            claim_from_slot,
            accounts.emission.min_slots_elapsed_before_claim
        );
        return Err(ErrorCode::MustWaitBeforeEmissionBecomeClaimable.into());
    }

    let claim_to_slot = accounts.clock.slot.min(accounts.emission.ends_at_slot);
    if claim_to_slot <= claim_from_slot {
        msg!(
            "The period for claiming emission is less than 1 slot: \
            from {} to {}",
            claim_from_slot,
            claim_to_slot
        );
        return Err(ErrorCode::EmissionEnded.into());
    }
    // we've just checked that this won't underflow
    let claim_for_slots = claim_to_slot - claim_from_slot;

    let emission_tokens = accounts.emission.tokens();
    if emission_tokens.len() * 2 != ctx.remaining_accounts.len() {
        msg!(
            "The emission tokens must equal to twice the length of \
            remaining accounts"
        );
        return Err(ErrorCode::InvalidAccountInput.into());
    }

    let pda_seeds = &[
        &accounts.lending_market.key().to_bytes()[..],
        &[lending_market_bump_seed],
    ];
    let snapshots = accounts.snapshots.load()?;

    // as per the endpoint definition, the emission wallet comes first, then
    // the user wallet, and this is repeat for each emission token mint
    for (wallets, emission_token) in ctx
        .remaining_accounts
        .chunks(2)
        .zip(emission_tokens.into_iter())
    {
        if *wallets[0].key != emission_token.wallet {
            msg!(
                "Wallet {} doesn't match expected emission wallet {}",
                wallets[0].key,
                emission_token.wallet
            );
            return Err(err::acc(
                "Invalid remaining accounts list, wallet mismatch",
            ));
        }

        let amount = if is_loan {
            // eq. ref. (11)
            Decimal::from(emission_token.tokens_per_slot_for_loans)
                .try_mul(Decimal::from(claim_for_slots))?
                .try_div(snapshots.average_borrowed_amount(claim_from_slot)?)?
                .try_mul(share)?
        } else {
            // eq. ref. (12)
            Decimal::from(emission_token.tokens_per_slot_for_deposits)
                .try_mul(Decimal::from(claim_for_slots))?
                .try_div(snapshots.average_cap(claim_from_slot)?)?
                .try_mul(share)?
        };

        token::transfer(
            accounts
                .as_claim_tokens_context(wallets[0].clone(), wallets[1].clone())
                .with_signer(&[&pda_seeds[..]]),
            amount.try_floor_u64()?,
        )?;
    }

    Ok(())
}

impl<'info> ClaimEmission<'info> {
    pub fn as_claim_tokens_context(
        &self,
        source_wallet: AccountInfo<'info>,
        destination_wallet: AccountInfo<'info>,
    ) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let cpi_accounts = token::Transfer {
            from: source_wallet,
            to: destination_wallet,
            authority: self.lending_market_pda.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}
