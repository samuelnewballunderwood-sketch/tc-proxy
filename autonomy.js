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

// Fetch with hard timeout — never let tick() hang on a slow upstream
async function _fetchT(url, opts = {}, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
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
  { actionType: 'spot_buy',    objective: 'fear_accumulate' }, // R17: F&G extreme fear small accumulate
  { actionType: 'close_grid',  objective: 'grid_profit_take'  }, // R19: profit-take Hannah grid
  { actionType: 'spot_buy',    objective: 'funding_contrarian'}, // R18: funding-rate mean-reversion
  { actionType: 'close_grid',  objective: 'grid_recenter'    }, // R20: recenter drifted grid
  { actionType: 'spot_buy',    objective: 'liq_cascade_buy'  }, // R30: buy wick after liquidation cascade
  { actionType: 'tune_bot',    objective: 'tune_tp'           }, // R31: auto-tune DCA take-profit % per regime
  { actionType: 'tune_bot',    objective: 'tune_step'         }, // R32: auto-tune DCA safety-order step % per regime
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

// SIGNAL FUND — isolated sub-portfolio for signal-driven trading (R16/R25/R30 + future signal rules)
// Caps prevent signal strategy losses from contaminating the core DCA+Grid base.
const SIGNAL_FUND_ALLOCATION_USD = parseFloat(process.env.SIGNAL_FUND_ALLOCATION_USD || '1000');  // total earmarked
const SIGNAL_DAILY_CAP_USD = parseFloat(process.env.SIGNAL_DAILY_CAP_USD || '300');  // max spend per day
let _signalSpendUsd = 0;
let _signalDayKey = '';
function _signalCheck(amount) {
  const day = new Date().toISOString().slice(0,10);
  if (day !== _signalDayKey) { _signalDayKey = day; _signalSpendUsd = 0; }
  return (_signalSpendUsd + amount) <= SIGNAL_DAILY_CAP_USD;
}
function _signalAdd(amount) { _signalSpendUsd += amount; }
function _signalStatus() {
  const day = new Date().toISOString().slice(0,10);
  if (day !== _signalDayKey) { return { day, spentUsd: 0, capUsd: SIGNAL_DAILY_CAP_USD, allocationUsd: SIGNAL_FUND_ALLOCATION_USD, available: SIGNAL_DAILY_CAP_USD }; }
  return { day: _signalDayKey, spentUsd: _signalSpendUsd, capUsd: SIGNAL_DAILY_CAP_USD, allocationUsd: SIGNAL_FUND_ALLOCATION_USD, available: SIGNAL_DAILY_CAP_USD - _signalSpendUsd };
}
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
const R17_DAILY_CAP = parseInt(process.env.R17_DAILY_CAP || '5', 10);

// R31 tuner: per-bot cooldown + daily cap
const R31_COOLDOWN_MS = 6 * 60 * 60 * 1000;   // 6h between tunes per bot
const R31_DAILY_CAP_PER_BOT = 2;              // max 2 tunes per bot per day
const _r31LastTuneAt = new Map();             // botId -> ms timestamp
const _r31DailyCount = new Map();             // botId -> {day, count}
// R32 step tuner — separate cooldown from R31 (you can tune TP and SO step the same day on different ticks)
const _r32LastTuneAt = new Map();
const _r32DailyCount = new Map();
function _r32CheckCanTune(botId) {
  const day = new Date().toISOString().slice(0,10);
  const last = _r32LastTuneAt.get(botId) || 0;
  if ((Date.now() - last) < R31_COOLDOWN_MS) {
    const minsLeft = Math.ceil((R31_COOLDOWN_MS - (Date.now() - last)) / 60000);
    return { ok: false, reason: 'cooldown: ' + minsLeft + 'm remaining' };
  }
  const dc = _r32DailyCount.get(botId);
  if (dc && dc.day === day && dc.count >= R31_DAILY_CAP_PER_BOT) {
    return { ok: false, reason: 'daily cap reached (' + dc.count + '/' + R31_DAILY_CAP_PER_BOT + ')' };
  }
  return { ok: true };
}
function _r32RecordTune(botId) {
  const day = new Date().toISOString().slice(0,10);
  _r32LastTuneAt.set(botId, Date.now());
  const dc = _r32DailyCount.get(botId);
  if (!dc || dc.day !== day) _r32DailyCount.set(botId, { day, count: 1 });
  else _r32DailyCount.set(botId, { day, count: dc.count + 1 });
}
function _r31CheckCanTune(botId) {
  const day = new Date().toISOString().slice(0,10);
  // Cooldown check
  const last = _r31LastTuneAt.get(botId) || 0;
  if ((Date.now() - last) < R31_COOLDOWN_MS) {
    const minsLeft = Math.ceil((R31_COOLDOWN_MS - (Date.now() - last)) / 60000);
    return { ok: false, reason: 'cooldown: ' + minsLeft + 'm remaining' };
  }
  // Daily cap check (reset on day change)
  const dc = _r31DailyCount.get(botId);
  if (dc && dc.day === day && dc.count >= R31_DAILY_CAP_PER_BOT) {
    return { ok: false, reason: 'daily cap reached (' + dc.count + '/' + R31_DAILY_CAP_PER_BOT + ')' };
  }
  return { ok: true };
}
function _r31RecordTune(botId) {
  const day = new Date().toISOString().slice(0,10);
  _r31LastTuneAt.set(botId, Date.now());
  const dc = _r31DailyCount.get(botId);
  if (!dc || dc.day !== day) _r31DailyCount.set(botId, { day, count: 1 });
  else _r31DailyCount.set(botId, { day, count: dc.count + 1 });
}

function _r17CheckCap() {
  const day = new Date().toISOString().slice(0,10);
  if (day !== _r17DayKey) { _r17DayKey = day; _r17DailyCount = 0; }
  return _r17DailyCount < R17_DAILY_CAP;
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
    const isR30 = decision.objective === 'liq_cascade_buy';
    if (!isR17 && !isR18 && !isR25 && !isR30) return [{ note: 'spot_buy objective not handled: ' + decision.objective }];
    if (isR17 && !_r17CheckCap()) return [{ skipped: 'R17 daily cap reached (' + _r17DailyCount + '/' + R17_DAILY_CAP + ')', dayKey: _r17DayKey }];
    const amt = parseFloat(decision.amount || 50);
    if (!_discCheck(amt)) return [{ skipped: 'discretionary daily cap reached', wallet: _discStatus() }];
    // Signal Fund check — all spot_buy rules (R17/R18/R25/R30) draw from signal fund
    if (!_signalCheck(amt)) return [{ skipped: 'signal fund daily cap reached', signalFund: _signalStatus() }];
    const pair = decision.suggestedPair || 'USDT_BTC';
    const amount = parseFloat(decision.amount || 50);
    // R18 reads direction from the decision text (sell or buy)
    // Scalp mode: tight targets, fast in-out
    const direction = (isR18 || isR25) && /SELL/i.test(decision.text || '') ? 'sell' : 'buy';
    // R17 = fear accumulate (wider targets, hold longer than scalp)
    // Others = scalp (tight TP/SL)
    const tpPct = isR17 ? 2.0 : isR18 ? 0.5 : isR25 ? 0.6 : isR30 ? 0.7 : 0.8;
    const slPct = isR17 ? 1.5 : isR18 ? 0.7 : isR25 ? 0.8 : isR30 ? 0.9 : 1.0;
    const strat = isR17 ? 'R17_fear_accumulate' : isR18 ? 'R18_funding_scalp' : isR25 ? 'R25_momentum_scalp' : isR30 ? 'R30_liq_hunter' : 'unknown';
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
      if (r.ok) {
        _discAdd(amt);
        _signalAdd(amt);  // signal fund accounting
      }
      return [{ smartTradeCreated: r.ok, status: r.status, amount, direction, response: body }];
    } catch(e) { return [{ error: e.message }]; }
  }

  // Special path: tune_bot (R31) — auto-tune DCA take-profit %
  if (decision.actionType === 'tune_bot' && decision.objective === 'tune_tp') {
    const botId = (decision.targetBotIds || [])[0];
    const newTp = decision.tuneParams?.takeProfitPct;
    if (!botId || !newTp) return [{ skipped: 'R31: missing botId or takeProfitPct in decision' }];
    const guard = _r31CheckCanTune(botId);
    if (!guard.ok) return [{ skipped: 'R31 ' + guard.reason, botId }];
    try {
      const r = await _fetchT('https://tc-proxy-eu.onrender.com/api/tune-bot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId, takeProfitPct: newTp }),
      }, 30000);
      const body = await r.json();
      if (r.ok && body.success) {
        _r31RecordTune(botId);
        return [{ tuned: true, botId, change: body.change, name: body.name }];
      }
      return [{ tuned: false, botId, status: r.status, error: body?.error || 'unknown' }];
    } catch(e) { return [{ tuned: false, botId, error: e.message }]; }
  }

  // Special path: tune_bot (R32) — auto-tune DCA safety-order step %
  if (decision.actionType === 'tune_bot' && decision.objective === 'tune_step') {
    const botId = (decision.targetBotIds || [])[0];
    const newStep = decision.tuneParams?.safetyOrderStepPct;
    if (!botId || !newStep) return [{ skipped: 'R32: missing botId or safetyOrderStepPct in decision' }];
    const guard = _r32CheckCanTune(botId);
    if (!guard.ok) return [{ skipped: 'R32 ' + guard.reason, botId }];
    try {
      const r = await _fetchT('https://tc-proxy-eu.onrender.com/api/tune-bot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId, safetyOrderStepPct: newStep }),
      }, 30000);
      const body = await r.json();
      if (r.ok && body.success) {
        _r32RecordTune(botId);
        return [{ tuned: true, botId, change: body.change, name: body.name }];
      }
      return [{ tuned: false, botId, status: r.status, error: body?.error || 'unknown' }];
    } catch(e) { return [{ tuned: false, botId, error: e.message }]; }
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
        _signalAdd(50);  // signal fund accounting
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
    const r = await _fetchT(WORKER_BASE + '/api/portfolio', {}, 5000);
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

    const dRes = await _fetchT(WORKER_BASE + '/api/decisions', {}, 20000);
    if (!dRes.ok) {
      logEvent({ event: 'fetch_decisions_failed', status: dRes.status });
      return;
    }
    const { decisions = [] } = await dRes.json();

    // PHASE 2: write today's locked profit snapshot (canonical from /deals/summary, not /api/decisions)
    // Guards: (a) only write if locked > 0, (b) only overwrite if new value >= existing (high-water-mark)
    try {
      const [snapR, dealsR] = await Promise.all([
        _fetchT(WORKER_BASE + '/api/daily-snapshot', {}, 10000),
        _fetchT('https://tc-proxy-eu.onrender.com/deals/summary', {}, 10000),
      ]);
      const snapJ = snapR.ok ? await snapR.json() : null;
      const dealsJ = dealsR.ok ? await dealsR.json() : null;
      const canonicalLocked = parseFloat(dealsJ?.totalProfit || 0);
      const existingLocked = parseFloat(snapJ?.today?.locked || 0);
      // Only write if (a) we have a real value AND (b) it's >= existing snapshot
      if (canonicalLocked > 0 && canonicalLocked >= existingLocked - 1) {
        // Only log if value actually changed materially
        const changed = Math.abs(canonicalLocked - existingLocked) > 0.5;
        await _fetchT(WORKER_BASE + '/api/daily-snapshot', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locked: canonicalLocked }),
        }, 10000);
        if (changed) logEvent({ event: 'daily_snapshot_written', locked: canonicalLocked, prev: existingLocked });
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
    try {
      const ms = await Promise.race([
        nextDelayMs(),
        new Promise(r => setTimeout(() => r(60_000), 6000)), // hard fallback: 60s default if nextDelayMs is slow
      ]);
      setTimeout(tick, ms);
    } catch (_) {
      setTimeout(tick, 60_000);
    }
  }
}

// Watchdog: every 90s, if tick hasn't fired recently, kick a fresh one.
// Prevents permanent stalls if the main loop is somehow lost.
setInterval(() => {
  try {
    const lastMs = lastTickAt ? new Date(lastTickAt).getTime() : 0;
    const ageMs = Date.now() - lastMs;
    if (ageMs > 90_000) {
      logEvent({ event: 'watchdog_kick', ageMs });
      // Don't await — fire and continue
      tick().catch(e => logEvent({ event: 'watchdog_kick_failed', error: String(e) }));
    }
  } catch (_) {}
}, 60_000);

// ── Public API exposed via server.js ────────────────────────────────
function getActions(limit) {
  const n = parseInt(limit || '50', 10);
  return recentActions.slice(0, Math.max(1, Math.min(200, n)));
}
function getStatus() {
  return { ...STATUS, lastTickAt, lastTickError, recentCount: recentActions.length, discretionary: _discStatus(), signalFund: _signalStatus() };
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

function resetCooldowns() {
  const before = { fail: _failedAttempts.size, r31: _r31LastTuneAt.size, r32: _r32LastTuneAt.size };
  _failedAttempts.clear();
  _r31LastTuneAt.clear();
  _r31DailyCount.clear();
  _r32LastTuneAt.clear();
  _r32DailyCount.clear();
  logEvent({ event: 'cooldowns_reset', before });
  return before;
}

module.exports = { getActions, getStatus, manualExecute, resetCooldowns };
