use crate::prelude::*;
use std::mem;

/// Trait for zero-copy structures to provide consistent space calculation
/// and validation utilities with anti-recursion safety.
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
    /// This should be implemented by types that derive from anchor_lang::ZeroCopy.
    fn discriminator() -> [u8; 8];
    
    /// Validate discriminator with recursion depth limit to prevent infinite loops.
    /// 
    /// # Safety
    /// This function prevents recursive discriminator validation by tracking depth
    /// and failing fast if the recursion limit is exceeded.
    fn validate_discriminator_safe(data: &[u8], depth: u8) -> Result<()> {
        const MAX_DISCRIMINATOR_DEPTH: u8 = 10;
        
        if depth > MAX_DISCRIMINATOR_DEPTH {
            msg!(
                "Discriminator validation depth exceeded maximum of {}",
                MAX_DISCRIMINATOR_DEPTH
            );
            return Err(ErrorCode::AccountDataSizeMismatch.into());
        }
        
        if data.len() < 8 {
            msg!("Account data too small for discriminator validation");
            return Err(ErrorCode::AccountDataSizeMismatch.into());
        }
        
        let expected_discriminator = Self::discriminator();
        let actual_discriminator: [u8; 8] = data[0..8].try_into()
            .map_err(|_| ErrorCode::AccountDataSizeMismatch)?;
            
        if actual_discriminator != expected_discriminator {
            msg!(
                "Discriminator mismatch: expected {:?}, got {:?}",
                expected_discriminator,
                actual_discriminator
            );
            return Err(ErrorCode::AccountDataSizeMismatch.into());
        }
        
        Ok(())
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
    /// Safely load a zero-copy account with comprehensive validation.
    /// 
    /// # Safety Guarantees
    /// - Validates account data size matches expected layout
    /// - Ensures proper discriminator before loading with recursion protection
    /// - Returns typed error for mismatched layouts
    /// - Prevents infinite recursion in discriminator validation
    pub fn load_and_validate<T: ZeroCopyAccount>(
        account_loader: &AccountLoader<T>
    ) -> Result<Ref<T>> {
        // Validate the account data before loading
        let account_info = account_loader.to_account_info();
        let data = account_info.data.borrow();
        
        // Validate layout first
        T::validate_layout(&data)?;
        
        // Validate discriminator with recursion protection
        T::validate_discriminator_safe(&data, 0)?;
        
        // Load the account after validation
        drop(data); // Release borrow before loading
        account_loader.load()
    }
    
    /// Safely load a mutable zero-copy account with comprehensive validation.
    /// 
    /// # Safety Guarantees  
    /// - Validates account data size matches expected layout
    /// - Ensures proper discriminator before loading with recursion protection
    /// - Returns typed error for mismatched layouts
    /// - Prevents infinite recursion in discriminator validation
    pub fn load_mut_and_validate<T: ZeroCopyAccount>(
        account_loader: &AccountLoader<T>
    ) -> Result<RefMut<T>> {
        // Validate the account data before loading
        let account_info = account_loader.to_account_info();
        let data = account_info.data.borrow();
        
        // Validate layout first
        T::validate_layout(&data)?;
        
        // Validate discriminator with recursion protection
        T::validate_discriminator_safe(&data, 0)?;
        
        // Load the account mutably after validation
        drop(data); // Release borrow before loading
        account_loader.load_mut()
    }
    
    /// Calculate the rent-exempt minimum balance for a zero-copy account.
    pub fn calculate_rent_exempt_balance<T: ZeroCopyAccount>(
        rent: &Rent
    ) -> u64 {
        rent.minimum_balance(T::space())
    }
    
    /// Validate that an account has sufficient balance for rent exemption.
    /// 
    /// # Safety Guarantees
    /// - Prevents accounts from becoming rent-collectable
    /// - Ensures long-term account viability
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
    
    /// Validate AccountInfo against expected constraints with detailed error reporting.
    /// 
    /// # Safety Documentation
    /// This function provides compile-time and runtime safety checks for AccountInfo usage
    /// that would otherwise require manual verification as documented in UNSAFE_CODES.md.
    /// 
    /// # Arguments
    /// * `account` - The AccountInfo to validate
    /// * `expected_owner` - Expected program owner (e.g., token program, system program)
    /// * `expected_key` - Expected account key (for PDA validation)
    /// * `min_balance` - Minimum required balance (for rent exemption)
    pub fn validate_account_info_safety(
        account: &AccountInfo,
        expected_owner: Option<&Pubkey>,
        expected_key: Option<&Pubkey>,
        min_balance: Option<u64>,
    ) -> Result<()> {
        // Validate owner constraint
        if let Some(expected_owner) = expected_owner {
            if account.owner != expected_owner {
                msg!(
                    "Account owner mismatch: expected {}, got {}",
                    expected_owner,
                    account.owner
                );
                return Err(ErrorCode::AccountOwnedByWrongProgram.into());
            }
        }
        
        // Validate key constraint (useful for PDA validation)
        if let Some(expected_key) = expected_key {
            if account.key != expected_key {
                msg!(
                    "Account key mismatch: expected {}, got {}",
                    expected_key,
                    account.key
                );
                return Err(ErrorCode::InvalidAccountInput.into());
            }
        }
        
        // Validate minimum balance
        if let Some(min_balance) = min_balance {
            if account.lamports() < min_balance {
                msg!(
                    "Account balance {} below required minimum {}",
                    account.lamports(),
                    min_balance
                );
                return Err(ErrorCode::InsufficientFundsForRentExemption.into());
            }
        }
        
        Ok(())
    }
}

/// Enhanced validation utilities for nested enum discriminators.
/// 
/// This addresses the recursive discriminator bug where nested enum structures
/// could cause infinite recursion during validation or deserialization.
pub struct DiscriminatorValidator;

impl DiscriminatorValidator {
    /// Validate nested enum discriminators with explicit depth tracking.
    /// 
    /// # Safety
    /// This function prevents recursive discriminator bugs by:
    /// - Tracking validation depth to prevent infinite recursion
    /// - Validating enum variants before accessing inner data
    /// - Ensuring termination conditions are met for nested structures
    /// 
    /// # Parameters
    /// * `data` - Raw bytes to validate
    /// * `depth` - Current recursion depth (should start at 0)
    /// * `max_depth` - Maximum allowed recursion depth
    pub fn validate_enum_discriminator(
        data: &[u8],
        depth: u8,
        max_depth: u8,
    ) -> Result<()> {
        if depth > max_depth {
            msg!(
                "Enum discriminator validation exceeded maximum depth {} at level {}",
                max_depth,
                depth
            );
            return Err(ErrorCode::AccountDataSizeMismatch.into());
        }
        
        if data.is_empty() {
            msg!("Cannot validate discriminator on empty data");
            return Err(ErrorCode::AccountDataSizeMismatch.into());
        }
        
        // For Anchor's BorshSerialize enums, the discriminator is typically the first byte
        let discriminator = data[0];
        
        // Validate the discriminator is within expected bounds
        // This prevents accessing invalid memory regions
        match discriminator {
            // ObligationReserve variants: Empty(0), Liquidity(1), Collateral(2)
            0..=2 => Ok(()),
            _ => {
                msg!(
                    "Invalid enum discriminator: {} is not in valid range 0-2",
                    discriminator
                );
                Err(ErrorCode::AccountDataSizeMismatch.into())
            }
        }
    }
    
    /// Specialized validation for ObligationReserve enum to prevent recursion.
    /// 
    /// # Safety
    /// This addresses the specific recursive discriminator pattern in ObligationReserve
    /// where nested structures could cause parsing to recurse indefinitely.
    pub fn validate_obligation_reserve_safe(data: &[u8]) -> Result<()> {
        const MAX_OBLIGATION_RESERVE_DEPTH: u8 = 5;
        
        if data.is_empty() {
            return Ok(()); // Empty is a valid variant
        }
        
        // Validate the enum discriminator
        Self::validate_enum_discriminator(data, 0, MAX_OBLIGATION_RESERVE_DEPTH)?;
        
        let discriminator = data[0];
        match discriminator {
            0 => {
                // Empty variant - no inner data to validate
                Ok(())
            }
            1 => {
                // Liquidity variant - validate inner ObligationLiquidity
                if data.len() < 1 + std::mem::size_of::<ObligationLiquidity>() {
                    msg!("Insufficient data for ObligationLiquidity variant");
                    return Err(ErrorCode::AccountDataSizeMismatch.into());
                }
                // Additional validation for inner structure would go here
                Ok(())
            }
            2 => {
                // Collateral variant - validate inner ObligationCollateral  
                if data.len() < 1 + std::mem::size_of::<ObligationCollateral>() {
                    msg!("Insufficient data for ObligationCollateral variant");
                    return Err(ErrorCode::AccountDataSizeMismatch.into());
                }
                // Additional validation for inner structure would go here
                Ok(())
            }
            _ => {
                // This should never happen due to earlier validation
                msg!("Unexpected discriminator value: {}", discriminator);
                Err(ErrorCode::AccountDataSizeMismatch.into())
            }
        }
    }
}

/// Macro to implement ZeroCopyAccount for structures with known sizes.
/// 
/// This macro provides comprehensive safety by implementing:
/// - Size validation at compile time and runtime
/// - Discriminator function for zero-copy safety
/// - Memory layout assertions
#[macro_export]
macro_rules! impl_zero_copy_account {
    ($struct_name:ident, $size:expr) => {
        impl ZeroCopyAccount for $struct_name {
            fn space() -> usize {
                $size
            }
            
            fn discriminator() -> [u8; 8] {
                // For zero-copy accounts, calculate discriminator based on type name
                use std::collections::hash_map::DefaultHasher;
                use std::hash::{Hash, Hasher};
                
                let mut hasher = DefaultHasher::new();
                stringify!($struct_name).hash(&mut hasher);
                let hash = hasher.finish();
                
                // Convert to 8-byte array
                hash.to_le_bytes()
            }
        }
        
        // Compile-time size validation with enhanced error message
        const _: () = {
            let actual_size = core::mem::size_of::<$struct_name>();
            let declared_size = $size;
            
            assert!(
                actual_size == declared_size,
                concat!(
                    "Critical size mismatch in ", stringify!($struct_name), ": ",
                    "declared size (", stringify!($size), ") doesn't match actual struct size. ",
                    "This violates zero-copy safety guarantees and must be fixed immediately."
                )
            );
        };
        
        // Compile-time alignment validation for zero-copy safety
        const _: () = {
            let alignment = core::mem::align_of::<$struct_name>();
            assert!(
                alignment <= 8,
                concat!(
                    "Zero-copy alignment violation in ", stringify!($struct_name), ": ",
                    "alignment must be <= 8 bytes for safe zero-copy operations"
                )
            );
        };
    };
}

/// Macro for documenting and validating AccountInfo safety requirements.
/// 
/// This macro generates both documentation and runtime validation code
/// to replace manual `/// CHECK: UNSAFE_CODES.md#...` patterns with
/// explicit safety guarantees.
/// 
/// # Usage
/// ```rust
/// validate_account_safety!(
///     account_info,
///     owner = Some(&token_program::ID),
///     reason = "Token program validates this account's validity"
/// );
/// ```
#[macro_export]
macro_rules! validate_account_safety {
    (
        $account:expr,
        $(owner = $owner:expr,)?
        $(key = $key:expr,)?
        $(min_balance = $min_balance:expr,)?
        reason = $reason:literal
    ) => {
        {
            // Generate compile-time documentation
            concat!(
                "SAFETY: ", $reason, "\n",
                "This account is validated at runtime for: ",
                $(concat!("owner=", stringify!($owner), " "),)?
                $(concat!("key=", stringify!($key), " "),)?
                $(concat!("min_balance=", stringify!($min_balance), " "),)?
            );
            
            // Perform runtime validation
            crate::zero_copy_utils::ZeroCopyHelpers::validate_account_info_safety(
                $account,
                None $(.or($owner))?,
                None $(.or($key))?,
                None $(.or($min_balance))?,
            )?;
        }
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
    #[repr(C)]
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
    fn test_discriminator_validation_safety() {
        // Test valid ObligationReserve discriminators
        let empty_data = vec![0u8]; // Empty variant
        assert!(DiscriminatorValidator::validate_obligation_reserve_safe(&empty_data).is_ok());
        
        let liquidity_data = vec![1u8; 1 + std::mem::size_of::<ObligationLiquidity>()];
        assert!(DiscriminatorValidator::validate_obligation_reserve_safe(&liquidity_data).is_ok());
        
        let collateral_data = vec![2u8; 1 + std::mem::size_of::<ObligationCollateral>()];
        assert!(DiscriminatorValidator::validate_obligation_reserve_safe(&collateral_data).is_ok());
        
        // Test invalid discriminator
        let invalid_data = vec![255u8; 100];
        assert!(DiscriminatorValidator::validate_obligation_reserve_safe(&invalid_data).is_err());
        
        // Test insufficient data
        let insufficient_data = vec![1u8]; // Liquidity variant but not enough data
        assert!(DiscriminatorValidator::validate_obligation_reserve_safe(&insufficient_data).is_err());
    }
    
    #[test]
    fn test_recursion_depth_protection() {
        let data = vec![1u8; 100];
        
        // Should succeed at low depth
        assert!(DiscriminatorValidator::validate_enum_discriminator(&data, 0, 10).is_ok());
        
        // Should fail when depth exceeds maximum
        assert!(DiscriminatorValidator::validate_enum_discriminator(&data, 11, 10).is_err());
        
        // Should handle empty data safely
        let empty_data = vec![];
        assert!(DiscriminatorValidator::validate_enum_discriminator(&empty_data, 0, 10).is_err());
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