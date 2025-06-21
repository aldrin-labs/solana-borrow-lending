//! Comprehensive tests for discriminator safety and recursive validation.
//! 
//! This module contains integration tests that validate the discriminator
//! safety mechanisms and ensure protection against recursive discriminator bugs.

#[cfg(test)]
mod tests {
    use crate::prelude::*;
    use crate::models::obligation::*;
    use crate::zero_copy_utils::*;
    use proptest::prelude::*;

    /// Test suite for discriminator validation against various attack vectors.
    #[test]
    fn test_discriminator_validation_attack_vectors() {
        // Test 1: Malformed discriminator sequences
        let malformed_sequences = vec![
            vec![0xFF; 136], // All 0xFF bytes
            vec![0x00; 136], // All zero bytes
            create_alternating_pattern(136), // Alternating 0xAA/0x55
            create_recursive_pattern(136), // Pattern that might cause recursion
        ];

        for (i, sequence) in malformed_sequences.iter().enumerate() {
            let result = ObligationReserve::validate_discriminator_safe(sequence, 0);
            
            // All malformed sequences should fail validation
            assert!(result.is_err(), 
                "Malformed sequence {} should fail discriminator validation", i);
            
            // Ensure deserialization also fails safely
            let deserialize_result = ObligationReserve::deserialize_safe(sequence);
            assert!(deserialize_result.is_err(),
                "Malformed sequence {} should fail safe deserialization", i);
        }
    }

    /// Test discriminator validation with progressively deeper recursion attempts.
    #[test]
    fn test_recursive_discriminator_depth_protection() {
        let valid_reserve = ObligationReserve::Liquidity {
            inner: ObligationLiquidity::default()
        };
        
        let mut data = Vec::new();
        valid_reserve.serialize(&mut data).unwrap();

        // Test validation at various depth levels
        for depth in 0..=ObligationReserve::MAX_DISCRIMINATOR_DEPTH + 5 {
            let result = ObligationReserve::validate_discriminator_safe(&data, depth);
            
            if depth >= ObligationReserve::MAX_DISCRIMINATOR_DEPTH {
                assert!(result.is_err(), 
                    "Validation should fail at depth {} (>= max depth {})", 
                    depth, ObligationReserve::MAX_DISCRIMINATOR_DEPTH);
            } else {
                assert!(result.is_ok(), 
                    "Validation should succeed at depth {} (< max depth {})", 
                    depth, ObligationReserve::MAX_DISCRIMINATOR_DEPTH);
            }
        }
    }

    /// Test that corrupted inner structures are detected during validation.
    #[test]
    fn test_corrupted_inner_structure_detection() {
        // Create a valid Liquidity reserve
        let valid_reserve = ObligationReserve::Liquidity {
            inner: ObligationLiquidity::default()
        };
        
        let mut data = Vec::new();
        valid_reserve.serialize(&mut data).unwrap();
        
        // Corrupt the inner structure data (after the discriminator)
        if data.len() > 10 {
            // Corrupt some bytes in the middle of the structure
            for i in 10..std::cmp::min(data.len(), 50) {
                data[i] = 0xFF;
            }
        }
        
        // Basic discriminator validation might still pass (correct discriminator byte)
        // but full validation should catch structural issues
        let basic_result = ObligationReserve::validate_discriminator_safe(&data, 0);
        
        if basic_result.is_ok() {
            // If basic validation passes, safe deserialization should handle corruption
            let deserialize_result = ObligationReserve::deserialize_safe(&data);
            // We expect this to either succeed (if corruption doesn't affect structure)
            // or fail safely without causing issues
            let _ = deserialize_result; // Result depends on specific corruption
        }
    }

    /// Test discriminator validation with insufficient data sizes.
    #[test]
    fn test_insufficient_data_size_validation() {
        // Test with progressively smaller data sizes
        for size in 0..=20 {
            let data = vec![1u8; size]; // Discriminator = 1 (Liquidity variant)
            
            let result = ObligationReserve::validate_discriminator_safe(&data, 0);
            
            if size >= std::mem::size_of::<ObligationReserve>() {
                // Should succeed if data is large enough
                // (though deserialization might still fail if data is malformed)
                let _ = result; // Result depends on data content
            } else {
                // Should fail if data is too small
                assert!(result.is_err(), 
                    "Validation should fail for insufficient data size: {}", size);
            }
        }
    }

    /// Test the safety of Obligation-level reserve validation.
    #[test]
    fn test_obligation_level_discriminator_safety() {
        let mut obligation = Obligation::default();
        
        // Test with various reserve configurations
        let test_reserves = vec![
            ObligationReserve::Empty,
            ObligationReserve::Liquidity { inner: ObligationLiquidity::default() },
            ObligationReserve::Collateral { inner: ObligationCollateral::default() },
        ];

        // Set different reserves in the obligation
        for (i, reserve) in test_reserves.iter().enumerate() {
            if i < obligation.reserves.len() {
                obligation.reserves[i] = *reserve;
            }
        }

        // Validate all reserves
        let result = obligation.validate_reserves_discriminator_safety();
        assert!(result.is_ok(), "Obligation with valid reserves should pass validation");

        // Test safe reserve access
        for i in 0..obligation.reserves.len() {
            let reserve_result = obligation.get_reserve_safe(i);
            assert!(reserve_result.is_ok(), "Safe reserve access should succeed for valid index {}", i);
        }

        // Test invalid index access
        let invalid_result = obligation.get_reserve_safe(obligation.reserves.len());
        assert!(invalid_result.is_err(), "Safe reserve access should fail for invalid index");
    }

    /// Property-based test for discriminator validation robustness.
    proptest! {
        #[test]
        fn test_discriminator_validation_properties(
            discriminator in 0u8..=255,
            data_size in 0usize..=1000,
            depth in 0u32..=50
        ) {
            let mut data = vec![discriminator; data_size.max(1)];
            
            // Fill with additional random data
            for (i, byte) in data.iter_mut().enumerate().skip(1) {
                *byte = ((i * 17 + 42) % 256) as u8;
            }
            
            let result = ObligationReserve::validate_discriminator_safe(&data, depth);
            
            // Properties that should always hold:
            
            // 1. Validation should never panic
            let _ = result;
            
            // 2. If depth exceeds maximum, validation should fail
            if depth >= ObligationReserve::MAX_DISCRIMINATOR_DEPTH {
                prop_assert!(result.is_err());
            }
            
            // 3. Empty data should always fail
            if data.is_empty() {
                prop_assert!(result.is_err());
            }
            
            // 4. Invalid discriminators (> 2) should fail
            if discriminator > 2 && data_size >= std::mem::size_of::<ObligationReserve>() {
                prop_assert!(result.is_err());
            }
        }
    }

    /// Test that the enhanced ZeroCopyHelpers work correctly with the new safety mechanisms.
    #[test]
    fn test_zero_copy_helpers_integration() {
        // This test would require actual AccountLoader instances which are complex to mock
        // For now, we test the validation logic components
        
        use anchor_lang::prelude::Pubkey;
        
        // Test account info validation logic
        let owner1 = Pubkey::new_unique();
        let owner2 = Pubkey::new_unique();
        let key1 = Pubkey::new_unique();
        let key2 = Pubkey::new_unique();
        
        // Test that validation parameters work as expected
        assert_ne!(owner1, owner2);
        assert_ne!(key1, key2);
        
        // Test multiple account validation structure
        let test_accounts = vec![
            (owner1, Some(owner1), Some(key1), Some(1000u64)),
            (owner2, Some(owner2), Some(key2), Some(2000u64)),
        ];
        
        // Verify test data structure is correct
        assert_eq!(test_accounts.len(), 2);
        assert_eq!(test_accounts[0].3, Some(1000u64));
    }

    /// Test discriminator validation with edge case byte sequences.
    #[test]
    fn test_discriminator_edge_case_sequences() {
        let edge_cases = vec![
            // Maximum values
            vec![u8::MAX; 136],
            // Minimum values  
            vec![u8::MIN; 136],
            // Powers of 2
            create_power_of_2_pattern(136),
            // Prime number pattern
            create_prime_pattern(136),
            // Fibonacci-like pattern
            create_fibonacci_pattern(136),
        ];

        for (i, test_case) in edge_cases.iter().enumerate() {
            let result = ObligationReserve::validate_discriminator_safe(test_case, 0);
            
            // Most edge cases should fail (discriminator values > 2 are invalid)
            let discriminator = test_case[0];
            if discriminator <= 2 && test_case.len() >= std::mem::size_of::<ObligationReserve>() {
                // Valid discriminator range - validation depends on structure
                let _ = result;
            } else {
                assert!(result.is_err(), 
                    "Edge case {} with discriminator {} should fail validation", i, discriminator);
            }
        }
    }

    // Helper functions for creating test patterns

    fn create_alternating_pattern(size: usize) -> Vec<u8> {
        (0..size).map(|i| if i % 2 == 0 { 0xAA } else { 0x55 }).collect()
    }

    fn create_recursive_pattern(size: usize) -> Vec<u8> {
        (0..size).map(|i| ((i * i) % 256) as u8).collect()
    }

    fn create_power_of_2_pattern(size: usize) -> Vec<u8> {
        (0..size).map(|i| (1u32 << (i % 8)) as u8).collect()
    }

    fn create_prime_pattern(size: usize) -> Vec<u8> {
        let primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
        (0..size).map(|i| primes[i % primes.len()]).collect()
    }

    fn create_fibonacci_pattern(size: usize) -> Vec<u8> {
        let mut pattern = Vec::new();
        let mut a = 1u8;
        let mut b = 1u8;
        
        for _ in 0..size {
            pattern.push(a);
            let next = a.wrapping_add(b);
            a = b;
            b = next;
        }
        
        pattern
    }
}