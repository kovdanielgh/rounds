#!/usr/bin/env bash
# Scheduler: keeps one open round (or mirror pair) per series from scripts/series.json.
# When the entry window of the current round closes, it opens the next one with the same params.
# Needs the owner key (createRounds is onlyOwner). State: scripts/.series-state (series -> first round id).
# Env (from .env): MONAD_TESTNET_RPC, PRIVATE_KEY, ROUNDS.
set -uo pipefail # no -e: an RPC error must not stop the bot
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

R=$MONAD_TESTNET_RPC
CONFIG=scripts/series.json
STATE=scripts/.series-state
SIG='createRounds((bytes32,uint256,uint8,uint256,uint64,uint64,string,string,uint8)[])'
touch "$STATE"

log() { echo "$(date '+%H:%M:%S') $*"; }
call() { cast call --rpc-url "$R" "$@" | cut -d' ' -f1; }

# Tuple-array argument for createRounds, built from one series of the config.
params() {
  python3 - "$CONFIG" "$1" <<'PY'
import json, sys
cfg = json.load(open(sys.argv[1]))
s = next(x for x in cfg["series"] if x["name"] == sys.argv[2])
b32 = lambda t: "0x" + t.encode().hex().ljust(64, "0")
esc = lambda t: t.replace('"', "'")
items = [f'({b32(r["asset"])},{r["marketId"]},{r["thesis"]},{r["bonus"]},{s["entryBlocks"]},{s["durationBlocks"]},"{esc(r["description"])}","{esc(r["rules"])}",{r["leverage"]})' for r in s["rounds"]]
print("[" + ",".join(items) + "]")
PY
}

series_names() { python3 -c "import json;[print(s['name']) for s in json.load(open('$CONFIG'))['series']]"; }
series_size() { python3 -c "import json;print(len(next(s for s in json.load(open('$CONFIG'))['series'] if s['name']=='$1')['rounds']))"; }
state_get() { grep "^$1=" "$STATE" | cut -d= -f2; }
state_set() { grep -v "^$1=" "$STATE" > "$STATE.tmp"; echo "$1=$2" >> "$STATE.tmp"; mv "$STATE.tmp" "$STATE"; }

tick() {
  local name id phase count n
  for name in $(series_names); do
    id=$(state_get "$name")
    if [ -n "$id" ]; then
      phase=$(call "$ROUNDS" 'phase(uint256)(uint8)' "$id") || return 1
      [ "$phase" = 1 ] && continue # entry window still open
    fi
    cast send --rpc-url "$R" --private-key "$PRIVATE_KEY" -q "$ROUNDS" "$SIG" "$(params "$name")" >/dev/null || {
      log "$name: create failed"; continue; }
    count=$(call "$ROUNDS" 'roundCount()(uint256)') || return 1
    n=$(series_size "$name")
    state_set "$name" $((count - n + 1))
    log "$name: opened round(s) $((count - n + 1))..$count"
  done
}

log "scheduler for $ROUNDS"
while true; do
  tick 2>/dev/null || { log "rpc error, retrying"; sleep 5; }
  sleep 30
done
