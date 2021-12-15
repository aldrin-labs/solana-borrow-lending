# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2021-12-14

### Fixed
- A critical bug due to rounding in exchange collateral methods which would
  allow an attacker to steal BTC and ETH reserves. Additional information about
  the bug can be found [here](https://blog.neodyme.io/posts/lending_disclosure)
  and the upstream fix PR is
  [here](https://github.com/solana-labs/solana-program-library/pull/1883/files)

