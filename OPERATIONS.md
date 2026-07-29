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

Production runs from branch **`production-live-20260729`**, not `main`.
Do NOT `git pull` `main` onto this box — it clobbers server-side changes that
exist nowhere else.

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

In-memory ring buffer, destroyed on every restart. Snapshot first if it matters:

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

1. Failure detection — predicate checked `.error`/`.skipped`/`.created`, none of
   which executors return. `_recordFail()` never fired, cooldown never engaged,
   retry storm hit ~130 actions/min until Binance IP-banned the box. Every
   attempt also logged as `executed`.
2. Tick re-entrancy — `lastTickAt` is stamped at tick start and the watchdog
   kicks when it is >90s old, so slow ticks got concurrent twins and produced
   duplicate actions. `tick()` is now single-flight with a 5-min escape valve.
3. Skipped vs failed — deliberate no-ops were tripping the breaker.
4. Fail-safe defaults.

## Open

- Ticks routinely exceed 90s; the watchdog, not the scheduler, drives the loop.
- Action log does not persist — blocks outcome-based learning across restarts.
- `main` and `production-live-20260729` need reconciling.
- Splash says "ADVISORY — YOU APPROVE ALL" while `advisoryMode: false`.
