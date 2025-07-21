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

## Discriminator Safety (NEW)
**Justification**: Prevents recursive discriminator bugs that could cause infinite loops or stack overflows during account deserialization.

**Safety Measures**:
- `DiscriminatorValidator` provides depth-limited validation for nested enum discriminators
- `validate_obligation_reserve_safe()` specifically prevents ObligationReserve recursion issues
- All discriminator validation includes recursion depth tracking with configurable limits
- Enhanced error reporting for discriminator validation failures

**Usage**:
```rust
// Safe discriminator validation with recursion protection
DiscriminatorValidator::validate_obligation_reserve_safe(&account_data)?;

// Depth-limited enum discriminator validation  
DiscriminatorValidator::validate_enum_discriminator(&data, 0, MAX_DEPTH)?;
```

## Zero-Copy Safety (ENHANCED)
**Justification**: Rigorous enforcement of zero-copy safety guarantees to prevent memory corruption and undefined behavior.

**Safety Measures**:
- All account structures implement `ZeroCopyAccount` trait with comprehensive validation
- `impl_zero_copy_account!` macro provides compile-time size and alignment validation
- Runtime discriminator validation before all account access
- Memory layout assertions prevent size mismatches
- Enhanced `ZeroCopyHelpers::load_and_validate()` with recursion protection

**Usage**:
```rust
// Safe zero-copy account loading with full validation
let account = ZeroCopyHelpers::load_and_validate(&account_loader)?;

// Implement zero-copy safety for new account types
impl_zero_copy_account!(MyAccount, 1024);
```

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

## repr(packed) Migration
**Current Status**: Migrating away from `repr(packed)` to `repr(C)` where possible.

**Safety Measures**:
- Compile-time size validation using `impl_zero_copy_account!` macro
- Runtime layout validation in `ZeroCopyHelpers::load_and_validate()`
- Gradual migration to safer memory layouts
- Explicit documentation of remaining packed usage

## Memory Layout Validation
```rust
// Validate account size and alignment before access
ZeroCopyHelpers::load_and_validate(&account_loader)?;

// Compile-time size assertion
impl_zero_copy_account!(MyStruct, 1024);
```

## Account Loading Safety
- Always use `ZeroCopyHelpers::load_and_validate()` instead of direct loading
- Validate discriminator and layout before memory access
- Check rent exemption to prevent account closure
- Use typed errors for better debugging

# Audit Trail

This safety documentation is maintained alongside code changes to ensure
all unsafe patterns are explicitly justified and reviewed.

**Version**: Updated for zero-copy refactor and safety improvements
**Last Review**: [Current Date]
**Next Review**: When adding new unsafe patterns or significant changes

[anchor-issue-safety]: https://github.com/project-serum/anchor/issues/1387
[account-info-anchor]: https://docs.rs/anchor-lang/0.24.2/anchor_lang/prelude/struct.AccountInfo.html
