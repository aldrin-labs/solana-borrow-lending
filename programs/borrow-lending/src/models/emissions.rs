use crate::prelude::*;

/// We define how many tokens per slot should be distributed in total, meaning
/// that all users together are eligible for this many tokens per slot. Each
/// user will get a fraction of this amount based on their reserve pool
/// participation. This is separated for lenders and borrowers.
#[account]
pub struct EmissionStrategy {
    pub reserve: Pubkey,
    /// Some of these tokens can be empty, which will is presented by using
    /// [`Pubkey::default`] as the emitted token's wallet.
    ///
    /// This number must be equal to [`consts::EMISSION_TOKENS_COUNT`]. The
    /// unit tests will fail if it doesn't. Unfortunately, anchor currently
    /// doesn't support const parametrization, so we must hard code this.
    pub tokens: [EmittedToken; 5],
    /// If a loan/deposit was opened before this slot, it will provide no
    /// additional emitted tokens.
    pub starts_at_slot: u64,
    /// No emissions are given beyond this slot.
    pub ends_at_slot: u64,
    /// User must wait at least this long to claim their emitted rewards.
    pub min_slots_elapsed_before_claim: u64,
}

#[derive(
    AnchorDeserialize,
    AnchorSerialize,
    Clone,
    Copy,
    Debug,
    Default,
    Eq,
    PartialEq,
)]
pub struct EmittedToken {
    /// Wallet which BLp has access to and distributes tokens from.
    pub wallet: Pubkey,
    /// Translates to APR for borrow
    pub tokens_per_slot_for_loans: u64,
    /// Translates to APR for deposit
    pub tokens_per_slot_for_deposits: u64,
}

#[account(zero_copy)]
#[derive(Debug)]
pub struct ReserveCapSnapshots {
    pub reserve: Pubkey,
    /// What's the last snapshot index to consider valid. When the buffer tip
    /// reaches [`consts::SNAPSHOTS_COUNT`], it is set to 0 again and now the
    /// queue of snapshots starts at index 1. With next call, the tip is set to
    /// 1 and queue starts at index 2.
    ///
    /// There's a special scenario to consider which is the first population of
    /// the ring buffer. We check the slot at the last index of the buffer and
    /// if the slot is equal to zero, that means that we haven't done the first
    /// rotation around the buffer yet. And therefore if the tip is at N, in
    /// this special case the beginning is on index 0 and not N + 1.
    pub ring_buffer_tip: u32,
    /// Must equal to [`consts::SNAPSHOTS_COUNT`]. The unit tests will fail if
    /// it doesn't.
    pub ring_buffer: [ReserveCap; 1000],
}

/// How many tokens were deposited to the reserve supply or borrowed. We floor
/// u192 to u64 because 1 token doesn't change anything in large numbers terms,
/// and not storing u192 means we can store thrice as many snapshots in the same
/// amount of space.
///
/// TBD: to minimize this, we could store the total as u64 and then a u8
/// fraction of utilization rate percent (e.g 0 = 0%, 128 = 50%, 255 = 100%),
/// but that would require more computation units
#[derive(
    AnchorDeserialize,
    AnchorSerialize,
    Clone,
    Copy,
    Debug,
    Default,
    Eq,
    PartialEq,
)]
#[repr(packed)]
pub struct ReserveCap {
    pub available_amount: u64,
    pub borrowed_amount: u64,
    pub slot: u64,
}

impl EmissionStrategy {
    // We support up to [`consts::EMISSION_TOKENS_COUNT`] different token mints,
    // and if the admin wants less than that, we represent that information with
    // the default pubkey for the wallet. Another option is to use [`Option`],
    // but that's annoying to represent with anchor and asks additional data.
    fn empty_emission_wallet() -> Pubkey {
        Pubkey::default()
    }

    pub fn tokens(&self) -> Vec<&EmittedToken> {
        let default_wallet = Self::empty_emission_wallet();
        self.tokens
            .iter()
            .filter(|t| t.wallet != default_wallet)
            .collect()
    }
}

impl EmittedToken {
    pub fn empty() -> Self {
        Self {
            wallet: EmissionStrategy::empty_emission_wallet(),
            tokens_per_slot_for_deposits: 0,
            tokens_per_slot_for_loans: 0,
        }
    }
}

impl ReserveCapSnapshots {
    pub fn space() -> usize {
        32 // pubkey
        + 4 // tip
        + consts::SNAPSHOTS_COUNT * (3 * 8) // slot + available + borrowed
    }

    pub fn average_borrowed_amount(&self, since: u64) -> Result<Decimal> {
        let (size, entries) = self.entries(since)?;
        let size = Decimal::from(size as u64);

        let mut sum = Decimal::zero();
        for entry in entries {
            sum = sum
                .try_add(Decimal::from(entry.borrowed_amount).try_div(size)?)?;
        }

        Ok(sum)
    }

    pub fn average_cap(&self, since: u64) -> Result<Decimal> {
        let (size, entries) = self.entries(since)?;
        let size = Decimal::from(size as u64);

        let mut sum = Decimal::zero();
        for entry in entries {
            sum = sum.try_add(
                Decimal::from(entry.borrowed_amount)
                    .try_add(Decimal::from(entry.available_amount))?
                    .try_div(size)?,
            )?;
        }

        Ok(sum)
    }

    fn entries(
        &self,
        since: u64,
    ) -> Result<(usize, impl Iterator<Item = &ReserveCap>)> {
        let highest_index_slot =
            self.ring_buffer[consts::SNAPSHOTS_COUNT - 1].slot;
        let tip = self.ring_buffer_tip as usize;
        // either the last element hasn't been populated, or the tip is the last
        // element, in which case the behavior is the same as if it was the
        // first population
        let is_first_population =
            highest_index_slot == 0 || tip == consts::SNAPSHOTS_COUNT - 1;

        // TBD: should we check the last slot of snapshot and limit it?

        if is_first_population && tip == 0 {
            return Err(ErrorCode::NotEnoughSnapshots.into());
        }

        // this condition is basically sort of a first preliminary iteration of
        // the binary search starting with the last index
        let first_relevant_entry_index =
            if is_first_population || highest_index_slot < since {
                // Either
                // a) we didn't make a first round trip around the ring
                // buffer (`is_first_population` => true) or;
                // b) The slot of the entry at the last index of the ring buffer
                // is less than what we're looking for, we can therefore
                // consider only entries to the "right" of the last index, i.e.
                // start from tip and go up to the last index (len - 1)
                self.ring_buffer[..=tip]
                    .binary_search_by(|probe| probe.slot.cmp(&since))
                    .unwrap_or_else(|i| i.min(tip))
            } else if highest_index_slot > since {
                // The slot of the entry at the last index of the ring buffer
                // is higher than `since`, which implies that we
                // will want to start from some entry that's
                // to the "left" of the last index, i.e. smaller
                debug_assert!(tip < consts::SNAPSHOTS_COUNT - 1);
                self.ring_buffer[(tip + 1)..]
                    .binary_search_by(|probe| probe.slot.cmp(&since))
                    .unwrap_or_else(|i| i)
                    + tip
                    + 1 // we need to add tip + 1 because we've taken a slice
            } else {
                // `highest_index_slot` equals `since`, return highest index
                consts::SNAPSHOTS_COUNT - 1
            };

        let relevant_entries_count = if first_relevant_entry_index > tip {
            consts::SNAPSHOTS_COUNT - first_relevant_entry_index + tip
        } else {
            tip - first_relevant_entry_index
        } + 1; // +1 bcs we go from indexes to count

        let relevant_entries = self
            .ring_buffer
            .iter()
            .cycle()
            .skip(first_relevant_entry_index)
            .take(relevant_entries_count);

        Ok((relevant_entries_count, relevant_entries))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::convert::TryInto;
    use std::iter;

    // let's arbitrarily say the snapshotting starts at some slot in future
    const SLOT_OFFSET: u64 = 100;

    #[test]
    fn it_sums_over_first_population() {
        let tip = consts::SNAPSHOTS_COUNT as u32 / 2;
        let double_amounts_after_slot = tip as u64; // i.e. half of values doubled
        let snapshots =
            get_first_population_snapshots(tip, double_amounts_after_slot);

        assert_snapshots_entries_count_first_population(&snapshots);

        assert_eq!(
            snapshots
                .average_borrowed_amount(
                    SLOT_OFFSET + double_amounts_after_slot + 1
                )
                .unwrap()
                .try_round_u64()
                .unwrap(),
            10
        );
        assert_eq!(
            snapshots
                .average_cap(SLOT_OFFSET + double_amounts_after_slot + 1)
                .unwrap()
                .try_round_u64()
                .unwrap(),
            30
        );

        assert_eq!(
            snapshots
                .average_borrowed_amount(SLOT_OFFSET + 0)
                .unwrap()
                .try_round_u64()
                .unwrap(),
            8
        );
        assert_eq!(
            snapshots
                .average_cap(SLOT_OFFSET + 0)
                .unwrap()
                .try_round_u64()
                .unwrap(),
            24
        );
    }

    #[test]
    fn it_sums_over_first_population_to_last_index() {
        let tip = consts::SNAPSHOTS_COUNT as u32 - 1;
        let snapshots = get_first_population_snapshots(tip, tip as u64);

        assert_snapshots_entries_count_first_population(&snapshots);

        assert_eq!(
            snapshots
                .average_borrowed_amount(SLOT_OFFSET + 0)
                .unwrap()
                .try_round_u64()
                .unwrap(),
            8
        );
        assert_eq!(
            snapshots
                .average_cap(SLOT_OFFSET + 0)
                .unwrap()
                .try_round_u64()
                .unwrap(),
            23
        );
    }

    #[test]
    fn it_sums_over_first_population_to_second_to_last_index() {
        let tip = consts::SNAPSHOTS_COUNT as u32 - 2;
        let snapshots = get_first_population_snapshots(tip, tip as u64);

        assert_snapshots_entries_count_first_population(&snapshots);
    }

    #[test]
    fn it_sums_over_first_population_to_second_index() {
        let tip = 2;
        let snapshots = get_first_population_snapshots(tip, tip as u64);

        assert_snapshots_entries_count_first_population(&snapshots);
    }

    #[test]
    fn it_sums_over_first_population_to_first_index() {
        let tip = 1;
        let snapshots = get_first_population_snapshots(tip, tip as u64);

        assert_snapshots_entries_count_first_population(&snapshots);
    }

    #[test]
    fn it_sums_over_ring_buffer() {
        let tip = consts::SNAPSHOTS_COUNT as u32 / 2;
        let double_amounts_after_slot = tip as u64;
        let snapshots = get_snapshots(tip, double_amounts_after_slot);

        let (size, entries) = snapshots.entries(SLOT_OFFSET + 0).unwrap();
        assert_eq!(size, consts::SNAPSHOTS_COUNT);
        assert_eq!(size, entries.count());

        let (size, entries) = snapshots.entries(SLOT_OFFSET + 1).unwrap();
        assert_eq!(size, consts::SNAPSHOTS_COUNT - 1);
        assert_eq!(size, entries.count());

        let (size, entries) = snapshots.entries(SLOT_OFFSET + 2).unwrap();
        assert_eq!(size, consts::SNAPSHOTS_COUNT - 1);
        assert_eq!(size, entries.count());

        let (size, entries) = snapshots.entries(SLOT_OFFSET + 3).unwrap();
        assert_eq!(size, consts::SNAPSHOTS_COUNT - 2);
        assert_eq!(size, entries.count());

        assert_eq!(
            snapshots
                .average_borrowed_amount(SLOT_OFFSET + 0)
                .unwrap()
                .try_round_u64()
                .unwrap(),
            9
        );
        assert_eq!(
            snapshots
                .average_cap(SLOT_OFFSET + 0)
                .unwrap()
                .try_round_u64()
                .unwrap(),
            27
        );
    }

    #[test]
    fn it_sums_over_ring_buffer_to_last_index() {
        let tip = consts::SNAPSHOTS_COUNT as u32 - 1;
        let double_amounts_after_slot = tip as u64;
        let snapshots = get_snapshots(tip, double_amounts_after_slot);

        let (size, entries) = snapshots.entries(SLOT_OFFSET + 0).unwrap();
        assert_eq!(size, consts::SNAPSHOTS_COUNT);
        assert_eq!(size, entries.count());

        let (size, entries) = snapshots.entries(SLOT_OFFSET + 1).unwrap();
        assert_eq!(size, consts::SNAPSHOTS_COUNT - 1);
        assert_eq!(size, entries.count());

        let (size, entries) = snapshots.entries(SLOT_OFFSET + 2).unwrap();
        assert_eq!(size, consts::SNAPSHOTS_COUNT - 1);
        assert_eq!(size, entries.count());

        let (size, entries) = snapshots.entries(SLOT_OFFSET + 3).unwrap();
        assert_eq!(size, consts::SNAPSHOTS_COUNT - 2);
        assert_eq!(size, entries.count());
    }

    #[test]
    fn it_sums_over_ring_buffer_to_second_to_last_index() {
        let tip = consts::SNAPSHOTS_COUNT as u32 - 2;
        let double_amounts_after_slot = tip as u64;
        let snapshots = get_snapshots(tip, double_amounts_after_slot);

        let (size, entries) = snapshots.entries(SLOT_OFFSET + 0).unwrap();
        assert_eq!(size, consts::SNAPSHOTS_COUNT);
        assert_eq!(size, entries.count());

        let (size, entries) = snapshots.entries(SLOT_OFFSET + 1).unwrap();
        assert_eq!(size, consts::SNAPSHOTS_COUNT - 1);
        assert_eq!(size, entries.count());

        let (size, entries) = snapshots.entries(SLOT_OFFSET + 2).unwrap();
        assert_eq!(size, consts::SNAPSHOTS_COUNT - 1);
        assert_eq!(size, entries.count());

        let (size, entries) = snapshots.entries(SLOT_OFFSET + 3).unwrap();
        assert_eq!(size, consts::SNAPSHOTS_COUNT - 2);
        assert_eq!(size, entries.count());
    }

    #[test]
    fn it_errors_on_empty_snapshots() {
        let snapshots = get_first_population_snapshots(0, 0);

        assert!(snapshots.average_borrowed_amount(0).is_err());
        assert!(snapshots.average_cap(0).is_err());
    }

    fn assert_snapshots_entries_count_first_population(
        snapshots: &ReserveCapSnapshots,
    ) {
        let tip = snapshots.ring_buffer_tip;

        let (size, entries) = snapshots.entries(SLOT_OFFSET + 0).unwrap();
        assert_eq!(size, entries.count());
        assert_eq!(size as u32, tip + 1);

        // max 1 because there's always at least one element returned, the tip,
        // even if the since is later than its slot

        let (size, entries) = snapshots.entries(SLOT_OFFSET + 3).unwrap();
        assert_eq!(size, entries.count());
        assert_eq!(size as u32, (tip - 1).max(1)); // no slot 0 and slot 2

        let (size, entries) = snapshots.entries(SLOT_OFFSET + 4).unwrap();
        assert_eq!(size, entries.count());
        assert_eq!(size as u32, (tip - 1).max(1)); // no slot 0 and slot 2

        let (size, entries) = snapshots.entries(SLOT_OFFSET + 5).unwrap();
        assert_eq!(size, entries.count());
        // no slot 0 and slot 2 and
        // slot 4
        assert_eq!(size as u32, if tip < 3 { 1 } else { (tip - 2).max(1) });
    }

    fn get_first_population_snapshots(
        tip: u32,
        double_amounts_after_slot: u64,
    ) -> ReserveCapSnapshots {
        let ring_buffer: Vec<ReserveCap> = iter::repeat(())
            .enumerate()
            .map(|(index, _)| {
                let slot = SLOT_OFFSET + index as u64 * 2; // 0 and every even number is a slot

                let is_double = slot > double_amounts_after_slot;
                ReserveCap {
                    slot,
                    available_amount: if is_double { 20 } else { 10 },
                    borrowed_amount: if is_double { 10 } else { 5 },
                }
            })
            .take(tip as usize + 1)
            .chain(
                iter::repeat(ReserveCap::default())
                    .take(consts::SNAPSHOTS_COUNT - tip as usize - 1),
            )
            .collect();
        ReserveCapSnapshots {
            reserve: Default::default(),
            ring_buffer_tip: tip,
            ring_buffer: ring_buffer.try_into().unwrap(),
        }
    }

    fn get_snapshots(
        tip: u32,
        double_amounts_after_slot: u64,
    ) -> ReserveCapSnapshots {
        let last_index_slot =
            (consts::SNAPSHOTS_COUNT as u64 - tip as u64 - 1) * 2;

        let generator = |slot_base| {
            iter::repeat(()).enumerate().map(move |(index, _)| {
                let slot = SLOT_OFFSET + slot_base + index as u64 * 2;
                let is_double = slot > double_amounts_after_slot;
                ReserveCap {
                    slot,
                    available_amount: if is_double { 20 } else { 10 },
                    borrowed_amount: if is_double { 10 } else { 5 },
                }
            })
        };

        let ring_buffer: Vec<ReserveCap> = generator(last_index_slot)
            .take(tip as usize + 1)
            .chain(
                generator(0).take(consts::SNAPSHOTS_COUNT - tip as usize - 1),
            )
            .collect();

        ReserveCapSnapshots {
            reserve: Default::default(),
            ring_buffer_tip: tip,
            ring_buffer: ring_buffer.try_into().unwrap(),
        }
    }
}
