#! /bin/bash

debug=$2

if [[ $debug == "true" ]]; then
    set -x
fi

boltUser=$1

sysctl -w net.ipv4.ip_forward=1
sysctl -w net.ipv6.conf.all.forwarding=1
sysctl -w net.ipv4.conf.all.send_redirects=0
iptables -t nat -A OUTPUT -p tcp -m owner ! --uid-owner "$boltUser" --dport 80 -j REDIRECT --to-port 8080
iptables -t nat -A OUTPUT -p tcp -m owner ! --uid-owner "$boltUser" --dport 443 -j REDIRECT --to-port 8080
ip6tables -t nat -A OUTPUT -p tcp -m owner ! --uid-owner "$boltUser" --dport 80 -j REDIRECT --to-port 8080
ip6tables -t nat -A OUTPUT -p tcp -m owner ! --uid-owner "$boltUser" --dport 443 -j REDIRECT --to-port 8080