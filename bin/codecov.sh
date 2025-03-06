#!/bin/bash

# You have to install following dependencies:
# $ rustup toolchain install nightly --allow-downgrade --component llvm-tools-preview
# $ cargo install grcov
#
# # Issue
# ```
# 14:48:36 [ERROR] A panic occurred at xxx/grcov-0.8.4/src/html.rs:458: attempt to divide by zero
# ```
# This has been reported here: https://github.com/mozilla/grcov/issues/675
# At the moment the only workaround is `cargo clean`

# as per docs at https://github.com/mozilla/grcov
export RUSTFLAGS="-Zinstrument-coverage"
export LLVM_PROFILE_FILE="blp-%p-%m.profraw"
export CARGO_INCREMENTAL=0
export RUSTFLAGS="-Zprofile -Ccodegen-units=1 -Copt-level=0 -Clink-dead-code -Coverflow-checks=off -Zpanic_abort_tests -Cpanic=abort -Zgcc-ld=lld"
export RUSTDOCFLAGS="-Cpanic=abort"
export RUSTUP_TOOLCHAIN="nightly"

cargo clean
cargo test --lib

rm -f grcov.log
grcov . -s . --binary-path ./target/debug/ -t html --branch --log grcov.log --ignore-not-existing -o ./target/debug/coverage/

head grcov.log
echo "..."
tail grcov.log
