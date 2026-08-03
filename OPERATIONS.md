# tc-proxy — Operations

**Read this before changing anything.** Most of it was unknown on 29 Jul 2026
and cost a full day to establish.

## Where this runs

- Host: `tbs-pricing` — Hetzner VPS, Frankfurt, Linux
- Path: `/home/jp/alphacontrol/tc-proxy`
- Process: `node server.js` as user `jp`, under **pm2** as `alphacontrol-tc-proxy`
- Exposure: Cloudflare Tunnel `alphacontrol-tc`, `cloudflared` as root via `/etc/cloudflared/config.yml`
- Public URL: `https://tc.alphacontrol.ai`
- Cloudflare account holding the zone: `Samuel.newballunderwood@googlemail.com`

It is NOT on Render. `render.yaml` is vestigial — nothing reads it.
This box also runs The Bottle Store services (`nginx`, `nofilterclub.service`).

## Deploy — the two repos work in OPPOSITE directions

- **tc-proxy** (this repo): source of truth is **the server**. Edit on the box,
  restart pm2. Push to GitHub to *record*, not to deploy.
- **bjbots-dashboard**: source of truth is **GitHub**. Cloudflare Worker,
  deploys from `main` on push. The copy on this box is stale.

Production runs from **`main`**. Reconciled 29 Jul 2026: `main` was reset to
the live server state, because the server was the only place the real code
existed. Pre-reconciliation history is preserved on `main-archive-20260729`;
`production-live-20260729` is kept as a dated snapshot.

Before pulling onto the box, always run `git status` first. A dirty working
tree means someone edited production directly and those changes exist nowhere
else — commit them before pulling anything.

### Restart

    pm2 restart alphacontrol-tc-proxy

NEVER add `--update-env` unless you source `.env` in the same command; that flag
replaces the process environment with your shell's. Correct form:

    cd /home/jp/alphacontrol/tc-proxy && set -a && source .env && set +a && \
      pm2 restart alphacontrol-tc-proxy --update-env && pm2 save

### Boot

`pm2-jp.service` is enabled; `pm2 resurrect` runs at boot. Verified — the box
rebooted 02:57 UTC 29 Jul and came back unattended. Run `pm2 save` after any
deliberate change.

## Configuration

`.env` is NOT the truth. The pm2 process env is. They drift, because restarts
without `--update-env` carry the original environment forward. Check reality:

    pm2 env 0 | grep -E "^AUTONOMY_"

Live values: ENABLED=true, DRY_RUN=false, KILL_SWITCH=false, MAX_PER_CYCLE=4,
MIN_CONFIDENCE=70.

Code defaults are fail-safe since 29 Jul: disabled, dry-run, 2/cycle, floor 70.
Before that they were fail-live — an unconfigured boot came up trading at
8/cycle with floor 50. The code reads 31 env vars; `render.yaml` declared 2.

Kill switch: set `AUTONOMY_KILL_SWITCH=true` in `.env`, restart with the
source-and-update-env form above.

## Where decisions come from

tc-proxy decides nothing. It fetches `WORKER_BASE + /api/decisions` from the
Cloudflare Worker, filters `executable === true && confidence >= MIN_CONFIDENCE`,
and executes.

Confidence is NOT a quality score. It is hardcoded per rule in `worker.js`.
Only three rules compute it; the main one is `(fg < 15 || fg > 75) ? 80 : 70` —
keyed to how extreme Fear & Greed is, not to whether the action will succeed.
So MIN_CONFIDENCE is an on/off switch for rule classes, not a quality filter.
Dropping it 70 -> 65 switches on `momentum_scalp`, the executable rule that
spends money.

There is no feedback loop. Nothing Hannah does changes what she believes.

## The action log

Persisted to SQLite (`actions.db`) via `better-sqlite3`, reloaded on boot —
the last 200 entries survive restarts. This was silently broken until 29 Jul:
the code was deployed but the module was never installed, so every write fell
through the catch to the in-memory buffer. Snapshot anyway before anything
risky:

    curl -s "https://tc.alphacontrol.ai/api/actions?limit=200" > ~/actions_$(date +%Y%m%d-%H%M).json

Events: `executed` (real success) | `failed` (real failure, records against the
breaker) | `skipped` (deliberate no-op, does not record) |
`tick_skipped_inflight` (re-entrancy guard, normal) | `watchdog_kick` (frequent
= slow ticks).

ANYTHING LOGGED BEFORE 29 JUL 08:36 UTC IS UNRELIABLE. Every attempt was
recorded as `executed` regardless of outcome, so historical success rates,
/api/perf, daily snapshots and R23 attribution all counted failures as
successes.

`autonomy_idle: critical` in /api/system-health is often a FALSE ALARM — Hannah
is correctly idle when nothing clears the confidence floor.

## Timezones

Server local time is UTC+4. The API emits UTC. The dashboard renders local.
Pulling exchange history against dashboard-displayed times returns nothing and
looks like proof orders never fired.

## Fixed 29 Jul 2026

1. Failure detection — predicate checked `.error`/`.skipped`/`.created`, none of which
   executors return. `_recordFail()` never fired, cooldown never engaged, retry storm hit
   ~130 actions/min until Binance IP-banned the box. Every attempt also logged `executed`.
2. Tick re-entrancy — `lastTickAt` is stamped at tick start and the watchdog kicked when
   it was >90s old, so slow ticks got concurrent twins and produced duplicate actions.
   `tick()` is now single-flight with a 5-min staleness escape valve.
3. Skipped vs failed — deliberate no-ops were tripping the breaker.
4. Fail-safe defaults — an unconfigured boot previously came up enabled, live, 8/cycle,
   floor 50. Now disabled and dry-run.
5. Action log persistence — the SQLite code was deployed but `better-sqlite3` was never
   installed, so every write fell through the catch to the in-memory buffer and the log
   died on each restart. Needed `build-essential`; no prebuilt binary for node 20 linux x64.
6. `MAX_PER_CYCLE` — `.env` said 4, the process was running 2. Now aligned at 4.
7. Loopback URL from `PORT` — 12 call sites in `autonomy.js` hardcoded `localhost:9090`.
8. Watchdog threshold 90s -> 20 min. `nextDelayMs` returns a 3-15 min cadence tuned to
   stay under Binance rate limits; the 90s watchdog overrode it and forced ~31 ticks/hour
   in every regime, making that tuning inert since the day it was written. Very likely the
   cause of the repeated -1003 bans.
9. Splash claimed "ADVISORY / You Approve All" on the pre-login overlay while execution
   ran autonomously. Now "AUTONOMOUS / Limits You Set". Lives in bjbots-dashboard.

## Fixed 3 Aug 2026

10. **Dead Render URLs — the big one.** 10 call sites in `server.js` still pointed at the
    decommissioned Render host. Nearly all wrapped in `.catch(()=>null)`, so prices, bots,
    spot-wallet and Earn positions returned empty for weeks with no error anywhere. The
    only visible symptom was R17 spot buys failing with `cannot resolve price` (500) — the
    price table came back empty, `parseFloat(undefined || 0)` gave 0, and the guard
    rejected it. `/prices` on the box had been serving correct data the whole time.
11. `skipReason` flattening — `_failReason` returned the literal `'skipped'` for any truthy
    `r.skipped`, discarding values like `'R31 cooldown: 355m remaining'`. 151 of 200 log
    entries affected.
12. `/api/r17-progress` implemented. The dashboard had called it since the R17 tile
    shipped; it never existed here. The client does `if (!r.ok) return`, so the 404 was
    silent and the tile rendered default zeros — "lifetime BTC stack 0.00000000" was never
    evidence either way. Now aggregates from the persisted log, counting only executions
    where the Smart Trade was actually created.

### The pattern worth remembering

`.catch(()=>null)` on a data fetch turns an outage into a silent wrong answer. Ten ran
broken for weeks. **If something looks wrong but nothing is erroring, grep for
`.catch(()=>` before anything else.**

## Open

- **Confidence has no feedback from outcomes.** A rule scores the same after forty failures
  as on day one. Buildable now the log records real outcomes and persists, but it needs
  weeks of clean data first. Measurement half exists: `rule_outcomes.py`.
- **`/api/config` serves the Simli API key to unauthenticated GET requests.** Not capital
  risk, but a live credential in public. Rotate and move server-side.
- `/health` still self-reports `"service":"tc-proxy-eu"` — cosmetic but misleading.
- `realizedPnl` in `/api/r17-progress` returns 0; R17 sells are not attributed.
- Binance API key IP allowlist is undocumented. Calls work, so presumably correct, but
  nobody has confirmed which IP is on it.
