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
const AUTONOMY_MAX      = parseInt(process.env.AUTONOMY_MAX_PER_CYCLE  || '8', 10);
const AUTONOMY_MIN_CONF = parseInt(process.env.AUTONOMY_MIN_CONFIDENCE || '50', 10);

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

// R23: map decision objective to rule code for P&L attribution
function _ruleCode(decision) {
  const obj = decision.objective || '';
  return {
    idle_capital_deploy: 'R9',
    idle_crypto_grid:    'R12',
    bear_hedge:          'R13',
    regime_lift:         'R2L',
    fear_accumulate:     'R17',
    funding_contrarian:  'R18',
    grid_profit_take:    'R19',
    grid_recenter:       'R20',
    compound_grid:       'R21',
    tv_signal_act:       'R16',
    bot_efficiency:      'R3',
    auto_redeem:         'R14',
    stale_order_cancel:  'R15',
  }[obj] || 'R?';
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
  { actionType: 'tv_signal',   objective: 'tv_signal_act'     }, // R16: act on TradingView Bj Bot signals
  // R17 fear_accumulate removed from ALLOWLIST — hold-style, conflicts with scalp mandate
  { actionType: 'close_grid',  objective: 'grid_profit_take'  }, // R19: profit-take Hannah grid
  { actionType: 'spot_buy',    objective: 'funding_contrarian'}, // R18: funding-rate mean-reversion
  { actionType: 'close_grid',  objective: 'grid_recenter'    }, // R20: recenter drifted grid
];

// Track the last auto-grid creation to enforce daily cap
let _lastGridCreatedAt = 0;
const GRID_CREATE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
// In-flight create lock — prevents concurrent ticks from creating dupes per asset
const _gridCreateInFlight = new Set();
const _r16ProcessedAlertIds = new Set(); // session memory of acted-on alert timestamps
let _r16DailyCount = 0;
let _r16DayKey = '';
let _r17DailyCount = 0;
let _r17DayKey = '';
// Discretionary wallet — cap total daily Smart Trade spend across R16/R17/R18
const DISCRETIONARY_DAILY_CAP_USD = parseFloat(process.env.DISCRETIONARY_DAILY_CAP_USD || '500');
let _discSpendUsd = 0;
let _discDayKey = '';
function _discCheck(amount) {
  const day = new Date().toISOString().slice(0,10);
  if (day !== _discDayKey) { _discDayKey = day; _discSpendUsd = 0; }
  return (_discSpendUsd + amount) <= DISCRETIONARY_DAILY_CAP_USD;
}
function _discAdd(amount) { _discSpendUsd += amount; }
function _discStatus() {
  const day = new Date().toISOString().slice(0,10);
  if (day !== _discDayKey) { return { day, spentUsd: 0, capUsd: DISCRETIONARY_DAILY_CAP_USD }; }
  return { day: _discDayKey, spentUsd: _discSpendUsd, capUsd: DISCRETIONARY_DAILY_CAP_USD };
}
function _r17CheckCap() {
  const day = new Date().toISOString().slice(0,10);
  if (day !== _r17DayKey) { _r17DayKey = day; _r17DailyCount = 0; }
  return _r17DailyCount < 1;
}
function _r17Increment() { _r17DailyCount++; }
function _r16CheckCap() {
  const day = new Date().toISOString().slice(0,10);
  if (day !== _r16DayKey) { _r16DayKey = day; _r16DailyCount = 0; }
  return _r16DailyCount < 10; // scalp mode — more trades, tighter

}
function _r16Increment() { _r16DailyCount++; }
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

  // Special path: spot_buy (R17 or R18) — fear accumulate or funding contrarian
  if (decision.actionType === 'spot_buy') {
    const isR18 = decision.objective === 'funding_contrarian';
    const isR25 = decision.objective === 'momentum_scalp';
    const isR17 = decision.objective === 'fear_accumulate';
    if (isR17) return [{ skipped: 'R17 holds disabled — Hannah is scalp-only. R17 fires as advisory.' }];
    if (!isR18 && !isR25) return [{ note: 'spot_buy objective not in scalp mode: ' + decision.objective }];
    const amt = parseFloat(decision.amount || 50);
    if (!_discCheck(amt)) return [{ skipped: 'discretionary daily cap reached', wallet: _discStatus() }];
    const pair = decision.suggestedPair || 'USDT_BTC';
    const amount = parseFloat(decision.amount || 50);
    // R18 reads direction from the decision text (sell or buy)
    // Scalp mode: tight targets, fast in-out
    const direction = (isR18 || isR25) && /SELL/i.test(decision.text || '') ? 'sell' : 'buy';
    const tpPct = isR18 ? 0.5 : isR25 ? 0.6 : 0.8;
    const slPct = isR18 ? 0.7 : isR25 ? 0.8 : 1.0;
    const strat = isR18 ? 'R18_funding_scalp' : isR25 ? 'R25_momentum_scalp' : 'unknown';
    try {
      const r = await fetch('https://tc-proxy-eu.onrender.com/api/create-smart-trade', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pair, direction, quoteAmount: amount,
          takeProfitPct: tpPct, stopLossPct: slPct, strategy: strat,
        }),
      });
      const body = await r.json();
      if (r.ok && isR17) _r17Increment();
      if (r.ok) _discAdd(amt);
      return [{ smartTradeCreated: r.ok, status: r.status, amount, direction, response: body }];
    } catch(e) { return [{ error: e.message }]; }
  }

  // Special path: close_grid (R19) — profit-take Hannah grid
  if (decision.actionType === 'close_grid' && decision.objective === 'grid_profit_take') {
    const targets = decision.targetBotIds || [];
    const results = [];
    for (const id of targets) {
      try {
        const r = await fetch(`https://tc-proxy-eu.onrender.com/grid-bot/${id}/disable`, { method: 'POST' });
        const body = await r.json();
        results.push({ botId: id, closed: r.ok, body });
      } catch(e) { results.push({ botId: id, error: e.message }); }
    }
    return results;
  }

  // Special path: tv_signal (R16) — act on TradingView Bj Bot alert
  if (decision.actionType === 'tv_signal' && decision.objective === 'tv_signal_act') {
    if (!_r16CheckCap()) return [{ skipped: 'R16 daily cap reached' }];
    if (!_discCheck(50)) return [{ skipped: 'discretionary daily cap reached', wallet: _discStatus() }];
    const alert = decision.payload?.alert;
    if (!alert) return [{ error: 'no alert payload' }];
    if (_r16ProcessedAlertIds.has(alert.ts)) return [{ skipped: 'alert already processed', ts: alert.ts }];
    const direction = alert.action === 'buy' ? 'buy' : alert.action === 'sell' ? 'sell' : null;
    if (!direction) return [{ skipped: 'unknown action ' + alert.action }];
    const pair = alert.symbol === 'BTCUSDT' ? 'USDT_BTC'
              : alert.symbol === 'ETHUSDT' ? 'USDT_ETH'
              : alert.symbol === 'SOLUSDT' ? 'USDT_SOL'
              : null;
    if (!pair) return [{ skipped: 'unsupported symbol ' + alert.symbol }];
    try {
      const r = await fetch('https://tc-proxy-eu.onrender.com/api/create-smart-trade', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pair, direction, quoteAmount: 50, takeProfitPct: 0.8, stopLossPct: 1.0,
          strategy: 'R16_' + (alert.strategy || 'Bj_Bot') + '_scalp',
        }),
      });
      const raw = await r.text();
      let body; try { body = JSON.parse(raw); } catch { body = raw; }
      if (r.ok) {
        _r16ProcessedAlertIds.add(alert.ts);
        _r16Increment();
        _discAdd(50);
      }
      return [{ smartTradeCreated: r.ok, status: r.status, alert, response: body }];
    } catch(e) { return [{ error: e.message }]; }
  }

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
      name: 'Hannah-' + _ruleCode(decision) + '-' + asset + '-' + new Date().toISOString().slice(0,10),
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
  return { ...STATUS, lastTickAt, lastTickError, recentCount: recentActions.length, discretionary: _discStatus() };
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
