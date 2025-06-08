use crate::prelude::*;
use std::mem;

/// Trait for zero-copy structures to provide consistent space calculation
/// and validation utilities.
pub trait ZeroCopyAccount: anchor_lang::ZeroCopy {
    /// Calculate the required space for this account type.
    /// This should match the actual memory layout size.
    fn space() -> usize;
    
    /// Validate that the account data matches expected size and alignment.
    fn validate_layout(data: &[u8]) -> Result<()> {
        if data.len() != Self::space() {
            msg!(
                "Account size mismatch: expected {}, got {}",
                Self::space(),
                data.len()
            );
            return Err(ErrorCode::AccountDataSizeMismatch.into());
        }
        Ok(())
    }
    
    /// Get the discriminator for this account type (first 8 bytes).
    fn discriminator() -> [u8; 8] {
        anchor_lang::Discriminator::discriminator(Self::discriminator())
    }
}

/// Helper trait for ring buffer operations used in zero-copy structures.
pub trait RingBuffer<T> {
    /// Get the current tip (write position) of the ring buffer.
    fn tip(&self) -> usize;
    
    /// Get the buffer array.
    fn buffer(&self) -> &[T];
    
    /// Get mutable buffer array.
    fn buffer_mut(&mut self) -> &mut [T];
    
    /// Calculate the number of valid entries in the ring buffer.
    fn valid_entries(&self) -> usize {
        let buffer = self.buffer();
        if self.tip() == 0 || buffer.is_empty() {
            return 0;
        }
        
        // Check if we've done a full rotation
        if self.has_wrapped() {
            buffer.len()
        } else {
            self.tip() + 1
        }
    }
    
    /// Check if the ring buffer has wrapped around.
    fn has_wrapped(&self) -> bool;
    
    /// Get an iterator over valid entries in chronological order.
    fn iter_valid(&self) -> RingBufferIterator<'_, T> {
        let buffer = self.buffer();
        let tip = self.tip();
        let has_wrapped = self.has_wrapped();
        
        RingBufferIterator {
            buffer,
            tip,
            has_wrapped,
            current: 0,
            remaining: self.valid_entries(),
        }
    }
    
    /// Push a new entry to the ring buffer, advancing the tip.
    fn push(&mut self, entry: T) -> Result<()> {
        let buffer = self.buffer_mut();
        let tip = self.tip();
        
        if tip >= buffer.len() {
            return Err(ErrorCode::RingBufferOverflow.into());
        }
        
        buffer[tip] = entry;
        self.advance_tip()
    }
    
    /// Advance the tip to the next position, wrapping if necessary.
    fn advance_tip(&mut self) -> Result<()>;
}

/// Iterator for ring buffer entries in chronological order.
pub struct RingBufferIterator<'a, T> {
    buffer: &'a [T],
    tip: usize,
    has_wrapped: bool,
    current: usize,
    remaining: usize,
}

impl<'a, T> Iterator for RingBufferIterator<'a, T> {
    type Item = &'a T;
    
    fn next(&mut self) -> Option<Self::Item> {
        if self.remaining == 0 {
            return None;
        }
        
        let index = if self.has_wrapped {
            // Start from the oldest entry (tip + 1)
            (self.tip + 1 + self.current) % self.buffer.len()
        } else {
            // Start from the beginning
            self.current
        };
        
        self.current += 1;
        self.remaining -= 1;
        
        self.buffer.get(index)
    }
    
    fn size_hint(&self) -> (usize, Option<usize>) {
        (self.remaining, Some(self.remaining))
    }
}

impl<'a, T> ExactSizeIterator for RingBufferIterator<'a, T> {}

/// Helper functions for zero-copy account operations.
pub struct ZeroCopyHelpers;

impl ZeroCopyHelpers {
    /// Safely load a zero-copy account with validation.
    pub fn load_and_validate<T: ZeroCopyAccount>(
        account_loader: &AccountLoader<T>
    ) -> Result<Ref<T>> {
        // Validate the account data before loading
        let account_info = account_loader.to_account_info();
        T::validate_layout(&account_info.data.borrow())?;
        
        // Load the account
        account_loader.load()
    }
    
    /// Safely load a mutable zero-copy account with validation.
    pub fn load_mut_and_validate<T: ZeroCopyAccount>(
        account_loader: &AccountLoader<T>
    ) -> Result<RefMut<T>> {
        // Validate the account data before loading
        let account_info = account_loader.to_account_info();
        T::validate_layout(&account_info.data.borrow())?;
        
        // Load the account mutably
        account_loader.load_mut()
    }
    
    /// Calculate the rent-exempt minimum balance for a zero-copy account.
    pub fn calculate_rent_exempt_balance<T: ZeroCopyAccount>(
        rent: &Rent
    ) -> u64 {
        rent.minimum_balance(T::space())
    }
    
    /// Validate that an account has sufficient balance for rent exemption.
    pub fn validate_rent_exempt<T: ZeroCopyAccount>(
        account_info: &AccountInfo,
        rent: &Rent
    ) -> Result<()> {
        let required_balance = Self::calculate_rent_exempt_balance::<T>(rent);
        if account_info.lamports() < required_balance {
            msg!(
                "Account balance {} insufficient for rent exemption, need {}",
                account_info.lamports(),
                required_balance
            );
            return Err(ErrorCode::InsufficientFundsForRentExemption.into());
        }
        Ok(())
    }
}

/// Macro to implement ZeroCopyAccount for structures with known sizes.
#[macro_export]
macro_rules! impl_zero_copy_account {
    ($struct_name:ident, $size:expr) => {
        impl ZeroCopyAccount for $struct_name {
            fn space() -> usize {
                $size
            }
        }
        
        // Compile-time size validation
        const _: () = {
            assert!(
                core::mem::size_of::<$struct_name>() == $size,
                "Size mismatch: declared size doesn't match actual struct size"
            );
        };
    };
}

/// Performance monitoring utilities for zero-copy operations.
pub struct ZeroCopyMetrics;

impl ZeroCopyMetrics {
    /// Measure compute units used for account loading.
    pub fn measure_load_cost<T, F, R>(operation: F) -> (R, u64)
    where
        F: FnOnce() -> R,
    {
        let start_cu = Self::get_compute_units_used();
        let result = operation();
        let end_cu = Self::get_compute_units_used();
        
        (result, end_cu.saturating_sub(start_cu))
    }
    
    /// Get current compute units used (approximation).
    /// Note: This is a simplified implementation for development.
    /// In production, use Solana's actual compute unit tracking.
    fn get_compute_units_used() -> u64 {
        // This would be replaced with actual Solana CU tracking
        // For now, return 0 as placeholder
        0
    }
    
    /// Log memory usage statistics for zero-copy structures.
    pub fn log_memory_stats<T: ZeroCopyAccount>(name: &str) {
        msg!(
            "Zero-copy account {}: size={} bytes, alignment={}",
            name,
            T::space(),
            mem::align_of::<T>()
        );
    }
}

/// Binary search utilities for ring buffers and sorted arrays.
pub struct BinarySearchHelpers;

impl BinarySearchHelpers {
    /// Binary search for the first element greater than or equal to target.
    pub fn lower_bound<T, F>(slice: &[T], target: &T, compare: F) -> usize
    where
        F: Fn(&T, &T) -> std::cmp::Ordering,
    {
        let mut left = 0;
        let mut right = slice.len();
        
        while left < right {
            let mid = left + (right - left) / 2;
            match compare(&slice[mid], target) {
                std::cmp::Ordering::Less => left = mid + 1,
                _ => right = mid,
            }
        }
        
        left
    }
    
    /// Binary search for the last element less than or equal to target.
    pub fn upper_bound<T, F>(slice: &[T], target: &T, compare: F) -> usize
    where
        F: Fn(&T, &T) -> std::cmp::Ordering,
    {
        let mut left = 0;
        let mut right = slice.len();
        
        while left < right {
            let mid = left + (right - left) / 2;
            match compare(&slice[mid], target) {
                std::cmp::Ordering::Greater => right = mid,
                _ => left = mid + 1,
            }
        }
        
        left
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    // Mock structure for testing
    #[repr(packed)]
    #[derive(Clone, Copy, Debug, Default, PartialEq)]
    struct TestEntry {
        value: u64,
        timestamp: u64,
    }
    
    struct TestRingBuffer {
        tip: usize,
        data: [TestEntry; 5],
        wrapped: bool,
    }
    
    impl RingBuffer<TestEntry> for TestRingBuffer {
        fn tip(&self) -> usize {
            self.tip
        }
        
        fn buffer(&self) -> &[TestEntry] {
            &self.data
        }
        
        fn buffer_mut(&mut self) -> &mut [TestEntry] {
            &mut self.data
        }
        
        fn has_wrapped(&self) -> bool {
            self.wrapped
        }
        
        fn advance_tip(&mut self) -> Result<()> {
            self.tip = (self.tip + 1) % self.data.len();
            if self.tip == 0 {
                self.wrapped = true;
            }
            Ok(())
        }
    }
    
    #[test]
    fn test_ring_buffer_basic_operations() {
        let mut buffer = TestRingBuffer {
            tip: 0,
            data: [TestEntry::default(); 5],
            wrapped: false,
        };
        
        // Test empty buffer
        assert_eq!(buffer.valid_entries(), 0);
        assert_eq!(buffer.iter_valid().count(), 0);
        
        // Add some entries
        for i in 0..3 {
            buffer.push(TestEntry {
                value: i,
                timestamp: i,
            }).unwrap();
        }
        
        assert_eq!(buffer.valid_entries(), 3);
        assert_eq!(buffer.iter_valid().count(), 3);
        
        // Verify order
        let values: Vec<u64> = buffer.iter_valid()
            .map(|entry| entry.value)
            .collect();
        assert_eq!(values, vec![0, 1, 2]);
    }
    
    #[test]
    fn test_ring_buffer_wraparound() {
        let mut buffer = TestRingBuffer {
            tip: 0,
            data: [TestEntry::default(); 3],
            wrapped: false,
        };
        
        // Fill buffer completely
        for i in 0..5 {
            buffer.push(TestEntry {
                value: i,
                timestamp: i,
            }).unwrap();
        }
        
        assert!(buffer.has_wrapped());
        assert_eq!(buffer.valid_entries(), 3);
        
        // Should contain newest 3 entries in chronological order
        let values: Vec<u64> = buffer.iter_valid()
            .map(|entry| entry.value)
            .collect();
        assert_eq!(values, vec![2, 3, 4]);
    }
    
    #[test]
    fn test_binary_search_helpers() {
        let data = vec![1u64, 3, 5, 7, 9];
        
        // Test lower_bound
        let pos = BinarySearchHelpers::lower_bound(&data, &5, |a, b| a.cmp(b));
        assert_eq!(pos, 2); // Position of first element >= 5
        
        let pos = BinarySearchHelpers::lower_bound(&data, &4, |a, b| a.cmp(b));
        assert_eq!(pos, 2); // Position where 4 would be inserted
        
        // Test upper_bound
        let pos = BinarySearchHelpers::upper_bound(&data, &5, |a, b| a.cmp(b));
        assert_eq!(pos, 3); // Position after last element <= 5
        
        let pos = BinarySearchHelpers::upper_bound(&data, &6, |a, b| a.cmp(b));
        assert_eq!(pos, 3); // Position where 6 would be inserted
    }
}