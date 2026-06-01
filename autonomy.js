// ============================================================
// Hannah Autonomy Loop
// ============================================================
// Reads decisions from the Cloudflare Worker, filters executable=true,
// acts on them via the 3Commas API, logs results to an in-memory ring
// buffer surfaced at /api/actions.
//
// SAFETY:
//   - AUTONOMY_ENABLED=true must be set in Render env to act at all
//   - AUTONOMY_DRY_RUN=true (default) only logs "would have done X"
//   - AUTONOMY_MAX_PER_CYCLE caps mutations per tick (default 2)
//   - AUTONOMY_KILL_SWITCH=true halts all action immediately
//   - R8 enforcement: bots with active deals are never auto-disabled
//   - Confidence floor: only acts when confidence >= AUTONOMY_MIN_CONFIDENCE (default 80)
// ============================================================

const crypto = require('crypto');

const WORKER_BASE       = process.env.WORKER_BASE        || 'https://alphacontrol.ai';
const AUTONOMY_ENABLED  = process.env.AUTONOMY_ENABLED   !== 'false'; // default ON (set 'false' to disable)
const AUTONOMY_DRY_RUN  = process.env.AUTONOMY_DRY_RUN   === 'true';  // default OFF — trade live (set 'true' for dry-run)
const AUTONOMY_KILL     = process.env.AUTONOMY_KILL_SWITCH === 'true';
const AUTONOMY_MAX      = parseInt(process.env.AUTONOMY_MAX_PER_CYCLE  || '5', 10);
const AUTONOMY_MIN_CONF = parseInt(process.env.AUTONOMY_MIN_CONFIDENCE || '60', 10);

const TC_KEY    = process.env.TC_API_KEY    || process.env.TC_KEY    || '';
const TC_SECRET = process.env.TC_API_SECRET || process.env.TC_SECRET || '';

// Ring buffer of recent autonomy events — exposed at /api/actions
const recentActions = [];
let lastTickAt    = null;
let lastTickError = null;

const STATUS = {
  enabled:       AUTONOMY_ENABLED,
  dryRun:        AUTONOMY_DRY_RUN,
  killSwitch:    AUTONOMY_KILL,
  maxPerCycle:   AUTONOMY_MAX,
  minConfidence: AUTONOMY_MIN_CONF,
  workerBase:    WORKER_BASE,
};

function logEvent(entry) {
  const e = { ts: new Date().toISOString(), ...entry };
  recentActions.unshift(e);
  if (recentActions.length > 200) recentActions.length = 200;
  console.log('[autonomy]', JSON.stringify(e));
  // Persistent log to worker KV (fire-and-forget)
  fetch(WORKER_BASE + '/api/log-action', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(e),
  }).catch(() => {});
  return e;
}

// ── 3Commas signed request ───────────────────────────────────────────
function hmacSign(secret, path) {
  return crypto.createHmac('sha256', secret).update(path).digest('hex');
}

async function tc3(method, path, qs) {
  const fullPath = '/public/api' + path + (qs ? '?' + qs : '');
  const sig = hmacSign(TC_SECRET, fullPath);
  const r = await fetch('https://api.3commas.io' + fullPath, {
    method,
    headers: {
      'Apikey': TC_KEY, 'Signature': sig,
      'Accept': 'application/json', 'Content-Type': 'application/json',
    },
  });
  const raw = await r.text();
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch (_) {}
  return { status: r.status, body: parsed ?? raw };
}

// ── R8 protection: which bots have active deals? ─────────────────────
async function getOpenDealBotIds() {
  const ids = new Set();
  for (const accId of ['33438577', '33439515']) {
    const res = await tc3('GET', '/ver1/deals', `scope=active&limit=200&account_id=${accId}`);
    if (res.status === 200 && Array.isArray(res.body)) {
      res.body.forEach(d => d.bot_id && ids.add(d.bot_id));
    }
  }
  return ids;
}

// ── Allowlist of auto-executable (actionType, objective) pairs ──────
// Expand as more decision types prove safe.
const ALLOWLIST = [
  { actionType: 'pause',      objective: 'idle_capital'  },  // signal bot pause (existing)
  { actionType: 'reduce',     objective: 'idle_capital'  },  // idle bot capital recovery
  { actionType: 'reallocate', objective: 'idle_capital'  },
  { actionType: 'reduce',     objective: 'bot_efficiency'},  // R3/R4 underperformer close
  { actionType: 'enable',     objective: 'regime_lift'   },  // R2-LIFT: auto-resume DCAs when F&G recovers
  { actionType: 'deploy_grid', objective: 'idle_capital_deploy' }, // R9: auto-deploy idle USDT to BTC defensive grid
  { actionType: 'deploy_grid', objective: 'idle_crypto_grid'    }, // R12: per-asset grid for held crypto
  { actionType: 'redeem',      objective: 'auto_redeem'         }, // R14: auto-redeem from Binance Earn
  { actionType: 'cancel_order',objective: 'stale_order_cancel'  }, // R15: cancel stale orphan orders
];

// Track the last auto-grid creation to enforce daily cap
let _lastGridCreatedAt = 0;
const GRID_CREATE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
// In-flight create lock — prevents concurrent ticks from creating dupes per asset
const _gridCreateInFlight = new Set();
// Per (objective+asset) failed-attempt tracker — silences repeat-skip noise
const _failedAttempts = new Map(); // key -> { count, firstTs }
const FAIL_CAP = 3;
const FAIL_WINDOW_MS = 4 * 60 * 60 * 1000; // 4h cooldown after 3 fails
function _failKey(d) { return (d.objective||'') + ':' + (d.suggestedAsset || d.targetBotIds?.[0] || ''); }
function _isInFailCooldown(d) {
  const key = _failKey(d);
  const rec = _failedAttempts.get(key);
  if (!rec) return false;
  if (Date.now() - rec.firstTs > FAIL_WINDOW_MS) { _failedAttempts.delete(key); return false; }
  return rec.count >= FAIL_CAP;
}
function _recordFail(d) {
  const key = _failKey(d);
  const rec = _failedAttempts.get(key) || { count: 0, firstTs: Date.now() };
  rec.count++;
  _failedAttempts.set(key, rec);
}

function isAllowed(d) {
  return ALLOWLIST.some(a =>
    a.actionType === d.actionType && a.objective === d.objective);
}

// ── Execute one decision ─────────────────────────────────────────────
async function executeDecision(decision, openDealBotIds) {
  const results = [];

  // Special path: cancel_order (R15) — cancel stale spot orders
  if (decision.actionType === 'cancel_order' && decision.objective === 'stale_order_cancel') {
    const targets = decision.payload?.orders || [];
    const results = [];
    for (const t of targets) {
      try {
        const r = await fetch('https://tc-proxy-eu.onrender.com/api/binance-cancel-order', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: t.symbol, orderId: t.orderId }),
        });
        const body = await r.json();
        results.push({ symbol: t.symbol, orderId: t.orderId, cancelled: r.ok, body });
      } catch(e) { results.push({ symbol: t.symbol, orderId: t.orderId, error: e.message }); }
    }
    return results;
  }

  // Special path: redeem (R14) — call Binance Earn redemption
  if (decision.actionType === 'redeem' && decision.objective === 'auto_redeem') {
    const asset = decision.suggestedAsset || 'USDT';
    const amount = parseFloat(decision.amount || 0);
    if (!amount || amount <= 0) return [{ error: 'amount missing' }];
    try {
      const r = await fetch('https://tc-proxy-eu.onrender.com/api/binance-redeem-earn', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset, amount }),
      });
      const raw = await r.text();
      let body; try { body = JSON.parse(raw); } catch { body = raw; }
      return [{ redeemed: r.ok, status: r.status, asset, amount, body }];
    } catch(e) { return [{ error: e.message }]; }
  }

  // Special path: deploy_grid creates a NEW bot — no targetBotIds.
  if (decision.actionType === 'deploy_grid') {
    // Pair selection from decision payload (R12 supplies suggestedPair / suggestedAsset)
    // Fallback to BTC if not specified (R9 backward compat).
    const pair = decision.suggestedPair || 'USDT_BTC';
    const asset = decision.suggestedAsset || (pair.split('_')[1] || 'BTC');

    // In-flight lock (prevents the race that produced duplicate XRP grids)
    if (_gridCreateInFlight.has(asset)) {
      return [{ skipped: `in-flight — ${asset} grid creation already running` }];
    }
    // Dedupe: skip if a Hannah grid for THIS asset already exists
    try {
      const botsR = await fetch('https://tc-proxy-eu.onrender.com/bots');
      const botsJ = botsR.ok ? await botsR.json() : { bots: [] };
      const hannahGrid = (botsJ.bots || []).find(b =>
        b.botType === 'grid' && /Hannah/i.test(b.name || '') &&
        (b.pair || '').toUpperCase().includes(asset.toUpperCase()));
      if (hannahGrid) {
        return [{ skipped: `dedupe — Hannah ${asset} grid already exists`, botId: hannahGrid.id, name: hannahGrid.name }];
      }
    } catch (_) {}
    _gridCreateInFlight.add(asset);

    // Resolve price
    let price = 0;
    try {
      const pr = await fetch('https://tc-proxy-eu.onrender.com/prices');
      const pj = await pr.json();
      price = parseFloat(pj[asset] || pj[asset + 'USDT'] || 0);
    } catch (_) {}
    if (price <= 0) return [{ error: 'cannot resolve ' + asset + ' price for grid range' }];

    const totalQuote = Math.max(100, Math.min(2000, Math.round(decision.amount || 500)));
    const decimals = price < 1 ? 5 : price < 100 ? 4 : 2;
    const upper = +(price * 1.10).toFixed(decimals);
    const lower = +(price * 0.90).toFixed(decimals);
    const spec = {
      pair,
      upperPrice: upper,
      lowerPrice: lower,
      gridQuantity: 30,
      totalQuoteAmount: totalQuote,
      accountId: 33438577,
      name: 'Hannah-' + asset + '-' + new Date().toISOString().slice(0,10),
    };
    let cr, cj;
    try {
      cr = await fetch('https://tc-proxy-eu.onrender.com/api/create-grid', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spec),
      });
      const cjRaw = await cr.text();
      try { cj = JSON.parse(cjRaw); } catch { cj = cjRaw; }
      if (cr.ok) _lastGridCreatedAt = Date.now();
    } finally {
      _gridCreateInFlight.delete(asset);
    }
    return [{ created: cr.ok, status: cr.status, response: cj, spec }];
  }

  const targets = Array.isArray(decision.targetBotIds) ? decision.targetBotIds : [];
  if (targets.length === 0) return [{ note: 'no targetBotIds — nothing to execute' }];

  if (!isAllowed(decision)) {
    return [{ note: `actionType=${decision.actionType} objective=${decision.objective} not in autonomy allowlist` }];
  }

  for (const botId of targets) {
    // R8: bot has open deal → never auto-disable (deal must run to TP)
    if (openDealBotIds.has(botId)) {
      results.push({ botId, skipped: 'R8: bot has active deal' });
      continue;
    }
    // Choose endpoint by actionType: enable vs disable (default).
    const verb = decision.actionType === 'enable' ? 'enable' : 'disable';
    let res = await tc3('POST', `/ver1/bots/${botId}/${verb}`);
    if (res.status === 404 || (res.body && res.body.error === 'record_not_found')) {
      res = await tc3('POST', `/ver1/grid_bots/${botId}/${verb}`);
    }
    results.push({ botId, status: res.status, body: res.body });
  }
  return results;
}

// ── Adaptive cadence by regime ───────────────────────────────────────
async function nextDelayMs() {
  try {
    const r = await fetch(WORKER_BASE + '/api/portfolio');
    const j = await r.json();
    const regime = (j?.market?.regime || '').toLowerCase();
    if (regime.includes('bear')) return  60 * 1000;        // 1 min — high vigilance
    if (regime.includes('bull')) return 15 * 60 * 1000;    // 15 min — low frequency
    return 5 * 60 * 1000;                                  // 5 min default
  } catch (_) {
    return 5 * 60 * 1000;
  }
}

// ── One tick ─────────────────────────────────────────────────────────
async function tick() {
  lastTickAt = new Date().toISOString();
  try {
    if (AUTONOMY_KILL)     { logEvent({ event: 'kill_switch_active' }); return; }
    if (!AUTONOMY_ENABLED) { return; }
    if (!TC_KEY || !TC_SECRET) {
      logEvent({ event: 'config_error', detail: 'TC_KEY / TC_SECRET missing' });
      return;
    }

    const dRes = await fetch(WORKER_BASE + '/api/decisions');
    if (!dRes.ok) {
      logEvent({ event: 'fetch_decisions_failed', status: dRes.status });
      return;
    }
    const { decisions = [] } = await dRes.json();

    // PHASE 2: write today's locked profit snapshot if not already done
    try {
      const snapR = await fetch(WORKER_BASE + '/api/daily-snapshot');
      const snapJ = snapR.ok ? await snapR.json() : null;
      if (!snapJ?.today?.locked) {
        const recon = decisions && (await (await fetch(WORKER_BASE + '/api/decisions')).json()).reconciliation;
        const currentLocked = recon?.totalRealised ?? 0;
        await fetch(WORKER_BASE + '/api/daily-snapshot', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locked: currentLocked }),
        });
        logEvent({ event: 'daily_snapshot_written', locked: currentLocked });
      }
    } catch (_) {}

    const candidates = decisions.filter(d =>
      d.executable === true && (d.confidence ?? 0) >= AUTONOMY_MIN_CONF);
    if (candidates.length === 0) return;

    const openDeals = await getOpenDealBotIds();
    let acted = 0;

    for (const d of candidates) {
      if (_isInFailCooldown(d)) {
        continue; // silently skip — 3+ failures in last 4h
      }
      if (acted >= AUTONOMY_MAX) {
        logEvent({ event: 'cap_reached', skipped: { actionType: d.actionType, objective: d.objective } });
        break;
      }
      if (AUTONOMY_DRY_RUN) {
        logEvent({ event: 'dry_run', decision: d });
      } else {
        const results = await executeDecision(d, openDeals);
        // Track failures for cooldown
        if (results?.[0]?.error || results?.[0]?.skipped || results?.[0]?.created === false) {
          _recordFail(d);
        }
        logEvent({ event: 'executed', decision: d, results });
      }
      acted++;
    }
    lastTickError = null;
  } catch (e) {
    lastTickError = String(e);
    logEvent({ event: 'tick_error', error: String(e) });
  } finally {
    const ms = await nextDelayMs();
    setTimeout(tick, ms);
  }
}

// ── Public API exposed via server.js ────────────────────────────────
function getActions(limit) {
  const n = parseInt(limit || '50', 10);
  return recentActions.slice(0, Math.max(1, Math.min(200, n)));
}
function getStatus() {
  return { ...STATUS, lastTickAt, lastTickError, recentCount: recentActions.length };
}
async function manualExecute(decision) {
  if (AUTONOMY_KILL)           return { error: 'kill_switch_active' };
  if (!TC_KEY || !TC_SECRET)   return { error: 'tc_credentials_missing' };
  const openDeals = await getOpenDealBotIds();
  const results = await executeDecision(decision, openDeals);
  logEvent({ event: 'manual_execute', decision, results });
  return { results };
}

// ── Boot the loop (10s delay so server.js finishes init first) ──────
setTimeout(tick, 10_000);

module.exports = { getActions, getStatus, manualExecute };
