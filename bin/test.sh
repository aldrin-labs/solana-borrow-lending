#!/bin/bash

# TODO: --detach

echo "Building test dependencies..."
echo

cd tests/localnet-deps
cargo build-bpf
cd ../..

echo "Running tests..."
echo

npm t
