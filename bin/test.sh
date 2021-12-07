#!/bin/bash

if [ -f .env ]
then
    export $(cat .env | sed 's/#.*//g' | xargs)
fi

detach=false
skip_build=false
shmem_bin_path="bin/shmem.so"
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

if ! test -f "${shmem_bin_path}"; then
    echo "shmem.so binary is not found at ${shmem_bin_path}"

    auth_header=""
    if [ ! -z "${gitlab_api_token}" ]
    then
        auth_header="PRIVATE-TOKEN: ${gitlab_api_token}"
    fi

    if [ ! -z "${auth_header}" ]
    then
        echo "Attempting to download shmem from gitlab artefacts..."
        echo
        wget --header "${auth_header}" \
            -O bin/shmem.zip \
            "https://gitlab.com/api/v4/projects/31726515/jobs/artifacts/shmem/download?job=shmem" \

        if [ $? -eq 0 ]; then
            echo "Successfully downloaded shmem.zip archive from gitlab"
            unzip bin/shmem.zip -d bin
            rm bin/shmem.zip
        else
            echo "Cannot download shmem.so from gitlab, terminating"
            rm -f bin/shmem.zip
            exit 1
        fi
    else
        echo "
        Either download it from infra gitlab repo, add GITLAB_PRIVATE_TOKEN
        env to your .env with read_api access or use --token flag.
        "
        exit 1
    fi
fi

echo "Running tests..."
echo

skip_build_flag=$($skip_build && echo "--skip-build")
detach_flag=$($detach && echo "--detach")
npm t -- ${skip_build_flag} ${detach_flag}
