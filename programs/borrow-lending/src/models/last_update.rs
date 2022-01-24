use crate::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default)]
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_defaults_to_stale() {
        let slot = 10;
        let last_update = LastUpdate::new(slot);
        assert!(last_update.stale);
        assert_eq!(last_update.slot, slot)
    }

    #[test]
    fn it_marks_stale() {
        let mut last_update = LastUpdate::default();
        last_update.stale = false;

        last_update.mark_stale();
        assert!(last_update.stale);
    }

    #[test]
    fn it_calculates_slot_elapsed() {
        let last_update = LastUpdate::new(10);

        assert!(last_update.slots_elapsed(5).is_err());
        assert_eq!(last_update.slots_elapsed(15).unwrap(), 5);
    }

    #[test]
    fn it_returns_stale_if_marked_stale_regardless_of_slot() {
        let last_update = LastUpdate::new(10);
        assert!(last_update.is_stale(10).unwrap());
    }

    #[test]
    fn it_is_stale_if_behind() {
        let slot = 10;
        let mut last_update = LastUpdate::default();
        last_update.update_slot(slot);

        assert!(last_update
            .is_stale(slot + consts::MARKET_STALE_AFTER_SLOTS_ELAPSED + 1)
            .unwrap());
    }

    #[test]
    fn it_returns_false_if_not_stale() {
        let slot = 10;
        let mut last_update = LastUpdate::default();
        last_update.update_slot(slot);

        assert!(!last_update
            .is_stale(slot + consts::MARKET_STALE_AFTER_SLOTS_ELAPSED / 2)
            .unwrap());
    }
}
