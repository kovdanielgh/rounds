// Rounds bots in one light process: keeper + scheduler.
// Keeper: calls settleMany, then setStrikeMany, at the right block. It decides nothing: the contract
//   reads the price on-chain. Keeper key first; if that fails (window passed), the owner key.
// Scheduler: keeps one open round (or mirror pair) per series from ../scripts/series.json.
// Env (../.env): MONAD_TESTNET_RPC, ROUNDS, KEEPER_PK, PRIVATE_KEY (owner). SCHEDULER=0: keeper only
// (an old Rounds contract that only finishes its rounds).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http, stringToHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}
const { MONAD_TESTNET_RPC: RPC, ROUNDS, KEEPER_PK, PRIVATE_KEY } = process.env;
const CONFIG = join(root, "scripts/series.json");
// One state file per contract: round ids of an old contract mean nothing to a new one.
const STATE = join(root, `scripts/.series-state.${ROUNDS.slice(2, 8).toLowerCase()}.json`);
const SCHEDULER = process.env.SCHEDULER !== "0";
const KEEPER_EVERY_MS = 3000;
const DRY_RUN = process.env.DRY_RUN === "1"; // read and log only, send nothing
const SCHEDULER_EVERY_MS = 30000;

const roundTuple = "(bytes32 asset,uint256 marketId,uint8 thesis,uint8 status,bool thesisWon,uint64 entryEnd,uint64 end,uint64 sequence,uint32 count,uint256 budget,uint256 borrowed,uint256 strike,uint256 finalPrice,uint256 totalStake,address[3] winners,uint256 funded,uint64 start,uint8 leverage,uint256 accAtDraw)";
const abi = [
  { type: "function", name: "roundCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "phase", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint8" }] },
  { type: "function", name: "drawFee", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function", name: "getRound", stateMutability: "view", inputs: [{ type: "uint256" }],
    outputs: [{ type: "tuple", components: parseTuple(roundTuple) }],
  },
  { type: "function", name: "linkRide", stateMutability: "nonpayable", inputs: [{ type: "uint256" }, { type: "uint256" }], outputs: [] },
  { type: "function", name: "setStrikeMany", stateMutability: "nonpayable", inputs: [{ type: "uint256[]" }], outputs: [] },
  { type: "function", name: "settleMany", stateMutability: "payable", inputs: [{ type: "uint256[]" }], outputs: [] },
  {
    type: "function", name: "createRounds", stateMutability: "nonpayable",
    inputs: [{
      type: "tuple[]",
      components: parseTuple("(bytes32 asset,uint256 marketId,uint8 thesis,uint256 bonus,uint64 entryBlocks,uint64 durationBlocks,string description,string rules,uint8 leverage)"),
    }],
    outputs: [{ type: "uint256" }],
  },
];

function parseTuple(t) {
  return t.slice(1, -1).split(",").map((p) => {
    const [type, name] = p.trim().split(" ");
    return { type, name };
  });
}

const transport = http(RPC, { batch: true, retryCount: 2, timeout: 20_000 });
const client = createPublicClient({ chain: monadTestnet, transport, batch: { multicall: true } });
const keeper = createWalletClient({ chain: monadTestnet, transport, account: privateKeyToAccount(KEEPER_PK ?? PRIVATE_KEY) });
const owner = PRIVATE_KEY ? createWalletClient({ chain: monadTestnet, transport, account: privateKeyToAccount(PRIVATE_KEY) }) : null;

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const read = (functionName, args = []) => client.readContract({ address: ROUNDS, abi, functionName, args });

async function send(wallet, functionName, args, value) {
  if (DRY_RUN) {
    log(`[dry run] would send ${functionName}(${JSON.stringify(args, (k, v) => (typeof v === "bigint" ? v.toString() : v)).slice(0, 120)})`);
    return { status: "success" };
  }
  const hash = await wallet.writeContract({ address: ROUNDS, abi, functionName, args, value });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${functionName} reverted`);
  return receipt;
}

/** Keeper key first; the owner key if it fails (the owner may call after the window). */
async function sendWithFallback(functionName, args, value) {
  try {
    return await send(keeper, functionName, args, value);
  } catch (e) {
    if (!owner) throw e;
    log(`${functionName}: keeper failed (${e.shortMessage ?? e.message}), owner fallback`);
    return send(owner, functionName, args, value);
  }
}

// ---------------------------------------------------------------- keeper

const done = new Set(); // settled rounds: never read again
let first = 1;

async function keeperTick() {
  const [count, block] = await Promise.all([read("roundCount"), client.getBlockNumber()]);
  const ids = [];
  for (let id = first; id <= Number(count); id++) if (!done.has(id)) ids.push(BigInt(id));
  // One multicall for all phases and rounds.
  const [phases, rounds] = await Promise.all([
    Promise.all(ids.map((id) => read("phase", [id]))),
    Promise.all(ids.map((id) => read("getRound", [id]))),
  ]);
  const strikes = [];
  const settles = [];
  ids.forEach((id, i) => {
    const phase = Number(phases[i]);
    if (phase === 4) return done.add(Number(id));
    if (phase !== 2) return;
    const r = rounds[i];
    if (r.strike === 0n) strikes.push(id);
    else if (block > r.end) settles.push(id);
  });
  while (done.has(first)) first++;
  if (DRY_RUN) log(`[dry run] block ${block}, live rounds ${ids.filter((id) => !done.has(Number(id))).join(",") || "-"}, strike due: ${strikes.join(",") || "-"}, settle due: ${settles.join(",") || "-"}`);

  // Settle first: it closes the old position, so the next round on the same market can open one.
  if (settles.length) {
    const fee = await read("drawFee");
    await sendWithFallback("settleMany", [settles], fee * BigInt(settles.length));
    log(`settled: rounds ${settles.join(",")}`);
  }
  if (strikes.length) {
    await sendWithFallback("setStrikeMany", [strikes]);
    log(`strike: rounds ${strikes.join(",")}`);
  }
}

// ---------------------------------------------------------------- scheduler

const loadState = () => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {});
const saveState = (s) => writeFileSync(STATE, JSON.stringify(s, null, 2));
const b32 = (t) => stringToHex(t, { size: 32 });
const BLOCK_SECONDS = 0.302; // measured on Monad testnet

/**
 * Entry and round length in blocks. A series with endAtUtc ("18:00") always ends at that UTC time:
 * the round lasts durationBlocks, and entry stays open until then (at least 30 minutes, else tomorrow).
 */
function timing(s, nowSec) {
  if (!s.endAtUtc) return { entryBlocks: BigInt(s.entryBlocks), durationBlocks: BigInt(s.durationBlocks) };
  const [h, m] = s.endAtUtc.split(":").map(Number);
  const d = new Date(nowSec * 1000);
  let target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m) / 1000;
  const live = s.durationBlocks * BLOCK_SECONDS;
  // endDow (0 = Sunday): weekly; otherwise daily.
  const ok = (t) => t - nowSec >= live + 1800 && (s.endDow === undefined || new Date(t * 1000).getUTCDay() === s.endDow);
  while (!ok(target)) target += 86400;
  return { entryBlocks: BigInt(Math.round((target - nowSec - live) / BLOCK_SECONDS)), durationBlocks: BigInt(s.durationBlocks) };
}

async function schedulerTick() {
  if (!owner) return;
  const { series } = JSON.parse(readFileSync(CONFIG, "utf8"));
  const state = loadState();
  state.bonus ??= {};
  for (const s of series) {
    const id = state[s.name];
    const phase = id ? Number(await read("phase", [BigInt(id)])) : 0;
    if (phase === 1) continue; // window still open
    if (s.waitSettle && id && phase !== 4) continue; // jackpot: the next one opens after the result
    // Growing jackpot: +step after a round nobody won, back to base after a win.
    let bonus;
    if (s.jackpot) {
      const prev = state.bonus[s.name];
      if (!id || prev === undefined) bonus = s.jackpot.base;
      else {
        const rs = await Promise.all(s.rounds.map((_, k) => read("getRound", [BigInt(id + k)])));
        const someoneWon = rs.some((r) => r.thesisWon && !/^0x0+$/.test(r.winners[0]));
        bonus = someoneWon ? s.jackpot.base : Math.min(s.jackpot.max, prev + s.jackpot.step);
      }
      state.bonus[s.name] = bonus;
    }
    if (DRY_RUN) { log(`[dry run] ${s.name}: would open the next round (current ${id ?? "none"} is closed)`); continue; }
    const now = Number((await client.getBlock()).timestamp);
    const t = timing(s, now);
    const params = s.rounds.map((r) => ({
      asset: b32(r.asset), marketId: BigInt(r.marketId), thesis: r.thesis, bonus: BigInt(bonus ?? r.bonus),
      entryBlocks: t.entryBlocks, durationBlocks: t.durationBlocks,
      description: r.description, rules: r.rules, leverage: r.leverage,
    }));
    await send(owner, "createRounds", [params]);
    const count = Number(await read("roundCount"));
    state[s.name] = count - s.rounds.length + 1;
    saveState(state);
    // Rollover: if the previous round wins, its pot moves into this one (the contract decides at settle).
    if (s.ride && id) {
      for (let k = 0; k < s.rounds.length; k++) await send(owner, "linkRide", [BigInt(id + k), BigInt(state[s.name] + k)]);
      log(`${s.name}: rollover ${id} -> ${state[s.name]}`);
    }
    log(`${s.name}: opened round(s) ${state[s.name]}..${count}${bonus ? `, jackpot ${bonus / 1e6} USD each side` : ""}`);
  }
}

// ---------------------------------------------------------------- loops (never die on an error)

function loop(name, fn, every) {
  const run = async () => {
    try {
      await fn();
    } catch (e) {
      log(`${name} error: ${e.shortMessage ?? e.message}`);
    }
    setTimeout(run, every);
  };
  run();
}

log(`bots for ${ROUNDS}${SCHEDULER ? "" : " (keeper only)"}, keeper ${keeper.account.address}${owner ? `, owner ${owner.account.address}` : ""}`);
loop("keeper", keeperTick, KEEPER_EVERY_MS);
if (SCHEDULER) loop("scheduler", schedulerTick, SCHEDULER_EVERY_MS);
