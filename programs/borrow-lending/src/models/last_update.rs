use crate::prelude::*;
use std::cmp::Ordering;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, Default)]
pub struct LastUpdate {
    pub slot: u64,
    pub stale: bool,
}

impl LastUpdate {
    pub fn new(slot: u64) -> Self {
        Self { slot, stale: true }
    }

    pub fn slots_elapsed(&self, slot: u64) -> Result<u64> {
        let slots_elapsed =
            slot.checked_sub(self.slot).ok_or(ErrorCode::MathOverflow)?;
        Ok(slots_elapsed)
    }

    pub fn update_slot(&mut self, slot: u64) {
        self.slot = slot;
        self.stale = false;
    }

    pub fn mark_stale(&mut self) {
        self.stale = true;
    }

    pub fn is_stale(&self, slot: u64) -> Result<bool> {
        Ok(self.stale
            || self.slots_elapsed(slot)?
                >= consts::MARKET_STALE_AFTER_SLOTS_ELAPSED)
    }
}

impl PartialEq for LastUpdate {
    fn eq(&self, other: &Self) -> bool {
        self.slot == other.slot
    }
}

impl PartialOrd for LastUpdate {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        self.slot.partial_cmp(&other.slot)
    }
}
