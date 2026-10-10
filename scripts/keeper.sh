#!/usr/bin/env bash
# Keeper: an alarm clock. It calls setStrike / settle at the right block. It decides nothing:
# the contract reads the price on-chain and anyone can make these calls inside the window.
# Env (from .env): MONAD_TESTNET_RPC, ROUNDS, KEEPER_PK (a key without owner rights; falls back to PRIVATE_KEY).
set -uo pipefail # no -e: an RPC error must not stop the bot
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

R=$MONAD_TESTNET_RPC
ROUND='getRound(uint256)((bytes32,uint256,uint8,uint8,bool,uint64,uint64,uint64,uint32,uint256,uint256,uint256,uint256,uint256,address[3],uint256,uint64,uint8,uint256))'

log() { echo "$(date '+%H:%M:%S') $*"; }
call() { cast call --rpc-url "$R" "$@" | cut -d' ' -f1; }
KEY=${KEEPER_PK:-$PRIVATE_KEY}
OWNER_KEY=${PRIVATE_KEY:-}
# Send with the keeper key. If that fails (for example the window passed while the bot was down),
# retry with the owner key: the owner may call after the window, so no round gets stuck.
snd() {
  cast send --rpc-url "$R" --private-key "$KEY" -q "$@" >/dev/null 2>&1 && return 0
  [ -n "$OWNER_KEY" ] && [ "$OWNER_KEY" != "$KEY" ] || return 1
  cast send --rpc-url "$R" --private-key "$OWNER_KEY" -q "$@" >/dev/null 2>&1 && { log "owner fallback used"; return 0; }
  return 1
}

# Prints: end borrowed strike (settle closes the engine position itself)
round_fields() {
  cast call --rpc-url "$R" --json "$ROUNDS" "$ROUND" "$1" |
    python3 -c 'import json,sys; r=json.load(sys.stdin)[0]; print(r[6], r[10], r[11])'
}

done_=() # done_[id]=1: round already Settled, never read again (indexed array: works in bash 3.2)
first=1          # rounds below this id are all settled

# One pass over the live rounds. All strikes due go in one setStrikeMany, all settles due in one
# settleMany, so both sides of a mirror pair always get the same price. Returns non-zero on an RPC error.
tick() {
  local count block id phase end _borrowed strike fee
  local strikes=() settles=()
  count=$(call "$ROUNDS" 'roundCount()(uint256)') && [ -n "$count" ] || return 1
  block=$(cast block-number --rpc-url "$R") && [ -n "$block" ] || return 1
  for ((id = first; id <= count; id++)); do
    [ -n "${done_[$id]:-}" ] && continue
    phase=$(call "$ROUNDS" 'phase(uint256)(uint8)' "$id") || return 1
    if [ "$phase" = 4 ]; then done_[$id]=1; continue; fi
    [ "$phase" = 2 ] || continue # only Closed rounds need work
    read -r end _borrowed strike < <(round_fields "$id") || return 1
    [ -n "${strike:-}" ] || return 1
    if [ "$strike" = 0 ]; then strikes+=("$id"); elif ((block > end)); then settles+=("$id"); fi
  done
  while [ -n "${done_[$first]:-}" ]; do first=$((first + 1)); done

  # Settle first: it closes the old position, so the next round on the same market can open one.
  if ((${#settles[@]})); then
    local list; list=$(IFS=,; echo "${settles[*]}")
    fee=$(call "$ROUNDS" 'drawFee()(uint256)') || return 1
    snd "$ROUNDS" 'settleMany(uint256[])' "[$list]" --value "$((fee * ${#settles[@]}))" &&
      log "settled: rounds $list" || log "settle failed: $list (window passed? owner can call)"
  fi
  if ((${#strikes[@]})); then
    local list; list=$(IFS=,; echo "${strikes[*]}")
    snd "$ROUNDS" 'setStrikeMany(uint256[])' "[$list]" && log "strike: rounds $list" || log "strike failed: $list (window passed? owner can call)"
  fi
}

log "keeper $(cast wallet address --private-key "$KEY") for $ROUNDS"
while true; do
  tick 2>/dev/null || { log "rpc error, retrying"; sleep 5; }
  sleep 3 # light on a small server; still far inside the 45 s window
done
