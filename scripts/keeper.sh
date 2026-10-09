#!/usr/bin/env bash
# Keeper: an alarm clock. It calls setStrike / settle at the right block. It decides nothing:
# the contract reads the price on-chain and anyone can make these calls inside the window.
# Env (from .env): MONAD_TESTNET_RPC, PRIVATE_KEY, ROUNDS.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

R=$MONAD_TESTNET_RPC
ROUND='getRound(uint256)((bytes32,uint256,uint8,uint8,bool,uint64,uint64,uint64,uint32,uint256,uint256,uint256,uint256,uint256,address[3],uint256,uint64))'

log() { echo "$(date '+%H:%M:%S') $*"; }
call() { cast call --rpc-url "$R" "$@" | cut -d' ' -f1; }
snd() { cast send --rpc-url "$R" --private-key "$PRIVATE_KEY" -q "$@" >/dev/null; }

# Prints: end borrowed strike (settle closes the engine position itself)
round_fields() {
  cast call --rpc-url "$R" --json "$ROUNDS" "$ROUND" "$1" |
    python3 -c 'import json,sys; r=json.load(sys.stdin)[0]; print(r[6], r[10], r[11])'
}

log "keeper for $ROUNDS"
while true; do
  count=$(call "$ROUNDS" 'roundCount()(uint256)')
  block=$(cast block-number --rpc-url "$R")
  for ((id = 1; id <= count; id++)); do
    [ "$(call "$ROUNDS" 'phase(uint256)(uint8)' "$id")" = 2 ] || continue # only Closed rounds
    read -r end _borrowed strike < <(round_fields "$id")
    if [ "$strike" = 0 ]; then
      snd "$ROUNDS" 'setStrike(uint256)' "$id" && log "round $id: strike $(round_fields "$id" | cut -d' ' -f3)"
    elif ((block > end)); then
      fee=$(call "$ROUNDS" 'drawFee()(uint256)')
      snd "$ROUNDS" 'settle(uint256)' "$id" --value "$fee" &&
        log "round $id: settled (strike $strike), phase $(call "$ROUNDS" 'phase(uint256)(uint8)' "$id")"
    fi
  done
  sleep 1
done
