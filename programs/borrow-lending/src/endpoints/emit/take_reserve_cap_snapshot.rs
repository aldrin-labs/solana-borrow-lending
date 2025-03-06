//! Periodically, Aldrin bot takes a snapshot of the current reserve borrowed
//! and available amount. The borrowed amount is used to calculate emission
//! shares for loans. The sum of borrowed and available amount is used to
//! calculate emissions for lenders.

use crate::prelude::*;

#[derive(Accounts)]
pub struct TakeReserveCapSnapshot<'info> {
    pub caller: Signer<'info>,
    #[account(
        constraint = lending_market.admin_bot == *caller.key
            @ err::acc("Only designated bot account can call compound"),
        constraint = reserve.lending_market == lending_market.key()
            @ err::acc("Lending market doesn't match reserve's config"),
    )]
    pub lending_market: Account<'info, LendingMarket>,
    #[account(
        constraint = reserve.snapshots == snapshots.key()
            @ err::acc("Snapshots account doesn't match reserve's config"),
        constraint = !reserve.is_stale(&clock) @ err::reserve_stale(),
    )]
    pub reserve: Account<'info, Reserve>,
    #[account(mut)]
    pub snapshots: AccountLoader<'info, ReserveCapSnapshots>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handle(ctx: Context<TakeReserveCapSnapshot>) -> Result<()> {
    let accounts = ctx.accounts;

    let mut snapshots = accounts.snapshots.load_mut()?;

    // Since we're already checking for `reserve.snapshots == snapshots.key()`,
    // this condition is a bit superfluous. It's sort of "if and only if"
    // instead of "if", but if the program's init_reserve endpoint is
    // functioning correctly, then there shouldn't even be a situation where
    // only one of those two conditions is true. So `Reserve` is always
    // associated with exactly one `ReserveCapSnapshots`, both accounts have
    // the other one's pubkey stored on them.
    if snapshots.reserve != accounts.reserve.key() {
        return Err(error!(err::acc(
            "Snapshot reserve setting must match reserve account",
        )));
    }

    // first, let's prepare the data to write into the ring buffer
    let slot = accounts.clock.slot;
    let available_amount = accounts.reserve.liquidity.available_amount;
    let borrowed_amount = accounts
        .reserve
        .liquidity
        .borrowed_amount
        .to_dec()
        .try_floor_u64()?;

    // then, increment the tip into which we will write the new snapshot
    snapshots.ring_buffer_tip = if snapshots.ring_buffer_tip as usize
        == snapshots.ring_buffer.len() - 1
    {
        0
    } else {
        snapshots.ring_buffer_tip + 1
    };

    // and last step is to write the data to the buffer
    let tip = snapshots.ring_buffer_tip as usize;
    snapshots.ring_buffer[tip] = ReserveCap {
        slot,
        borrowed_amount,
        available_amount,
    };

    Ok(())
}
