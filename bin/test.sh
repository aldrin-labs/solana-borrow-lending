#!/bin/bash

detach=false
skip_build=false

while :; do
    case $1 in
        -d|--detach) detach=true
        ;;
        --skip-build) skip_build=true
        ;;
        *) break
    esac
    shift
done

if ! $skip_build ; then
    echo "Building test dependencies..."
    echo

    cd tests/localnet-deps
    cargo build-bpf
    cd ../..
fi

echo "Running tests..."
echo

skip_build_flag=$($skip_build && echo "--skip-build")
detach_flag=$($detach && echo "--detach")
npm t -- ${skip_build_flag} ${detach_flag}
