Anchor [requires][anchor-issue-safety] that we document safety rationale when
we use [`AccountInfo`][account-info-anchor].

# Signer
We don't read data from this account. We use it to either validate ownership
over some other entity, because we want to move funds from their wallets, etc.
Only their signature is relevant.

# Wallet
We pass this account to the token program which asserts that it's a valid token
account (wallet) and when we perform e.g. transfer on it, we sign that
transaction by either a PDA or with user's signature, thereby the token program
also validates the authority.
The token program will also reject accounts which it doesn't own, or which have
too few tokens for a transfer, or whose mints don't match, etc.

The above also applies to mint account.

# Constraints
The constraints we added to the `#[account]` macro are sufficient to assert that
this is the account we wanted, or we perform the checks upon parsing.

# AMM
Similarly to the [wallet](#wallet) rationale, we pass this account to the AMM
which performs checks on its validity.

[anchor-issue-safety]: https://github.com/project-serum/anchor/issues/1387
[account-info-anchor]: https://docs.rs/anchor-lang/0.24.2/anchor_lang/prelude/struct.AccountInfo.html
