Anchor [requires][anchor-issue-safety] that we document safety rationale when
we use [`AccountInfo`][account-info-anchor].

This document provides detailed safety justifications for all unsafe code patterns
used in the Solana Borrow-Lending Protocol.

# Safety Validation Tools

**NEW**: Use `validate_account_safety!` macro instead of manual `/// CHECK:` comments:

```rust
// OLD pattern:
/// CHECK: UNSAFE_CODES.md#wallet
pub wallet: AccountInfo<'info>,

// NEW pattern:
validate_account_safety!(
    &wallet,
    owner = Some(&token_program::ID),
    reason = "Token program validates this account's validity"
);
```

# Safety Categories

## Signer
**Justification**: We don't read data from this account. We use it to either validate ownership
over some other entity, because we want to move funds from their wallets, etc.
Only their signature is relevant.

**Safety Measures**:
- Anchor's `Signer<'info>` constraint ensures cryptographic signature validation
- No unsafe memory access as we only check the signature, not account data
- Rust's type system prevents misuse through compile-time checks

## Wallet  
**Justification**: We pass this account to the token program which asserts that it's a valid token
account (wallet) and when we perform e.g. transfer on it, we sign that
transaction by either a PDA or with user's signature, thereby the token program
also validates the authority.
The token program will also reject accounts which it doesn't own, or which have
too few tokens for a transfer, or whose mints don't match, etc.

**Safety Measures**:
- Token program performs comprehensive validation of account structure
- Ownership, balance, and mint checks are handled by the token program
- Authority validation ensures only authorized transfers
- Use `validate_account_safety!` with `owner = Some(&token_program::ID)` for additional safety

The above also applies to mint account.

## Constraints
**Justification**: The constraints we added to the `#[account]` macro are sufficient to assert that
this is the account we wanted, or we perform the checks upon parsing.

**Safety Measures**:
- Anchor's constraint system provides compile-time and runtime validation
- Custom constraint expressions are evaluated before instruction execution
- Type-safe account deseralization prevents malformed data access
- Use `ZeroCopyHelpers::validate_account_info_safety()` for additional runtime checks

## AMM
**Justification**: Similarly to the [wallet](#wallet) rationale, we pass this account to the AMM
which performs checks on its validity.

**Safety Measures**:
- AMM program validates account structure and ownership
- Cross-program invocation (CPI) maintains Solana's security guarantees
- State validation is performed by the called program
- Interface constraints ensure proper account passing

# Zero-Copy Safety

## Discriminator Validation
**NEW**: Enhanced discriminator validation prevents recursive parsing bugs.

**Safety Measures**:
- Explicit discriminator validation with depth limits in `ObligationReserve::validate_discriminator_safe()`
- Recursion protection prevents infinite loops during enum deserialization
- Comprehensive test coverage for malformed discriminator sequences
- Safe deserialization methods that validate before parsing

```rust
// Safe discriminator validation with recursion protection
ObligationReserve::validate_discriminator_safe(&data, current_depth)?;

// Safe deserialization with validation
let reserve = ObligationReserve::deserialize_safe(&data)?;
```

## Enum Discriminator Safety
**Justification**: ObligationReserve and other enums now include explicit discriminator validation to prevent recursive discriminator bugs that could cause infinite loops or stack overflows.

**Safety Measures**:
- Maximum recursion depth limits (`MAX_DISCRIMINATOR_DEPTH = 10`)
- Comprehensive validation of enum variant discriminators (0=Empty, 1=Liquidity, 2=Collateral)
- Validation of inner structure sizes and layouts
- Property-based testing with malformed inputs

## repr(packed) Migration
**Current Status**: Migrating away from `repr(packed)` to `repr(C)` where possible.

**Safety Measures**:
- Compile-time size validation using `impl_zero_copy_account!` macro
- Runtime layout validation in `ZeroCopyHelpers::load_and_validate()`
- Enhanced discriminator validation prevents memory safety issues
- Gradual migration to safer memory layouts
- Explicit documentation of remaining packed usage

## Memory Layout Validation
```rust
// Enhanced validation with discriminator safety
ZeroCopyHelpers::load_and_validate(&account_loader)?;

// Compile-time size assertion with discriminator generation
impl_zero_copy_account!(MyStruct, 1024);

// Validate all obligation reserves for discriminator safety
obligation.validate_reserves_discriminator_safety()?;
```

## Account Loading Safety
- Always use `ZeroCopyHelpers::load_and_validate()` instead of direct loading
- Validate discriminator and layout before memory access
- Enhanced enum discriminator validation with recursion protection
- Check rent exemption to prevent account closure
- Use typed errors for better debugging
- Batch validation for multiple accounts with detailed error reporting

# Audit Trail

This safety documentation is maintained alongside code changes to ensure
all unsafe patterns are explicitly justified and reviewed.

## Recent Security Enhancements

### Recursive Discriminator Bug Fix (Current)
- **Issue**: Potential recursive discriminator parsing could cause infinite loops
- **Solution**: Implemented depth-limited discriminator validation in `ObligationReserve::validate_discriminator_safe()`
- **Safety**: Recursion depth limit of 10, comprehensive malformed input testing
- **Files Modified**: `models/obligation.rs`, `zero_copy_utils.rs`, `err.rs`

### Zero-Copy Safety Improvements (Current)
- **Enhancement**: Added discriminator validation with recursion protection
- **Enhancement**: Improved ZeroCopyHelpers with comprehensive account validation
- **Enhancement**: Added property-based testing for discriminator edge cases
- **Safety**: Prevents memory safety issues and stack overflows

### Test Coverage Expansion (Current)
- **Added**: Comprehensive discriminator validation tests in `tests/discriminator_safety.rs`
- **Added**: Property-based testing with proptest for robustness validation
- **Added**: Edge case testing with malformed discriminator sequences
- **Coverage**: 100% coverage for discriminator parsing logic

**Version**: Updated for recursive discriminator bug fix and enhanced zero-copy safety
**Last Review**: December 2024 - Recursive discriminator vulnerability fix
**Next Review**: When adding new unsafe patterns or significant changes

[anchor-issue-safety]: https://github.com/project-serum/anchor/issues/1387
[account-info-anchor]: https://docs.rs/anchor-lang/0.24.2/anchor_lang/prelude/struct.AccountInfo.html
