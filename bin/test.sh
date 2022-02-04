#!/bin/bash

# install solana 1.7.17, anchor ^0.20
solana --version 2>&1 1>/dev/null || sh -c "$(curl -sSfL https://release.solana.com/v1.7.17/install)"
solana --version |grep 1.7.17 || solana-install init 1.7.17
anchor --version 2>&1 1>/dev/null || cargo install anchor-cli --git https://github.com/project-serum/anchor --vers ^0.20 --locked

if [ -f .env ]
then
    export $(cat .env | sed 's/#.*//g' | xargs)
fi

detach=false
skip_build=false
gitlab_api_token="${GITLAB_PRIVATE_TOKEN}"

while :; do
    case $1 in
        -d|--detach) detach=true
        ;;
        --skip-build) skip_build=true
        ;;
        --token)
            gitlab_api_token="${2}"
            shift
        ;;
        *) break
    esac
    shift
done

auth_header=""
if [ ! -z "${gitlab_api_token}" ]
then
    auth_header="PRIVATE-TOKEN: ${gitlab_api_token}"
fi

function extract_job_artefacts {
    local url="${1}"

    if [ ! -z "${auth_header}" ]
    then
        echo "Attempting to download shmem from gitlab artefacts..."
        echo
        wget --header "${auth_header}" \
            -O bin/artefacts.zip \
            "${url}"

        if [ $? -eq 0 ]; then
            echo "Successfully downloaded artefacts archive from gitlab"
            unzip bin/artefacts.zip -d bin
            rm bin/artefacts.zip
        else
            echo "Cannot download artefacts from gitlab, terminating"
            rm -f bin/artefacts.zip
            exit 1
        fi
    else
        echo "
        Either download artefacts into 'bin', add GITLAB_PRIVATE_TOKEN
        env to your .env with read_api access or use --token flag.
        "
        exit 1
    fi
}

if ! test -f "bin/shmem.so"; then
    echo "shmem.so binary is not found at bin/shmem.so"

    extract_job_artefacts \
        "https://gitlab.com/api/v4/projects/31726515/jobs/artifacts/shmem/download?job=shmem"
fi

if ! test -f "bin/flashloan_target.so"; then
    echo "flashloan_target.so binary is not found at bin/flashloan_target.so"

    extract_job_artefacts \
        "https://gitlab.com/api/v4/projects/31726515/jobs/artifacts/flashloan-target/download?job=flashloan-target"
fi

if ! test -d "bin/amm"; then
    echo "amm artefacts are not found at bin/amm"

    extract_job_artefacts \
        "https://gitlab.com/api/v4/projects/28196727/jobs/artifacts/develop/download?job=build_and_test"

    mv bin/target bin/amm

    npm run init-amm-idl
fi


echo "Running tests..."
echo

skip_build_flag=$($skip_build && echo "--skip-build")
detach_flag=$($detach && echo "--detach")
npm t -- ${skip_build_flag} ${detach_flag}
