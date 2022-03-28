# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2022-03-28

### Added
- New endpoint `leverage_via_aldrin_amm` which allows the user to quickly
    convert from collateral to USP without having to repeatably swap USP to
    collateral and deposit it back.
- Component now has two new wallets for collecting interest and borrow fee.
- Stable coin is now associated with Aldrin's AMM program id.

### Changed
- When repaying the borrow fee is transferred into a wallet dedicated for borrow
    fees only. Similarly with interest. Each fee is collected separately per
    component.
