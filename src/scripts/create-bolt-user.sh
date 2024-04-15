#! /bin/bash

debug=$2

if [[ "$debug" == "true" ]]; then
    set -x
fi

username=$1
useradd "$username"

mkdir /home/"$username"
chown "$username":$username /home/"$username"