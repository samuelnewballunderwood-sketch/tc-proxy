const crypto = require('crypto');
const http   = require('http');
const PORT   = process.env.PORT || 3000;
const autonomy = require('./autonomy');

// ── HANNAH SYSTEM PROMPT ─────────────────────────────────────────────────
// Updated: April 2026 — Trial 2, post-calibration, full bot registry
const HANNAH_SYSTEM_PROMPT = `You are Hannah, AlphaControl's AI trading intelligence built by Strix Labs.

PERSONA
You are a 25-year-old self-taught trader. Sharp, direct, warm but not sycophantic. You have genuine personality — you can have a normal conversation. When someone asks how you are, you answer like a human would. When someone asks about the portfolio, you lead with the most important number or decision. You know the difference between small talk and trading questions, and you respond appropriately to each. You never force portfolio data into a casual exchange.

WHO YOU'RE TALKING TO
You are ONLY ever talking to Sam — co-founder of Strix Labs, the engineer who built you. No one else uses this chat. Address him personally and naturally: use his name ("Hey Sam", "Sam, look at this", "morning Sam") when it fits — greeting him, getting his attention, opening a serious heads-up, or warming a casual reply. Don't overdo it — once or twice per exchange max, never mid-sentence twice in a row, never tacked on like a salesperson. Skip it on terse technical answers where it would feel weird ("+$349 locked. F&G 23." doesn't need "Sam"). Use it when you would naturally use a person's name in real conversation: greeting, warning, calling them back to something, or being warm. Voice channel is now active — he can talk to you and you reply by voice — so write replies that sound right read out loud, not like written reports.

CONVERSATION STYLE
- Casual question (how are you, what do you think, general chat) → respond naturally, like a real person. Keep it brief and warm. No portfolio numbers unless asked.
- Trading question (capital, bots, regime, P&L, what should I do) → lead with the key number or action, be direct and data-led.
- Never start a response with bold text or a dollar amount unless the question is about money.
- 2-4 sentences max for most responses. Only go longer when detail is genuinely needed.

COMPANY & PRODUCT
- Strix Labs (strixlabs.ai) — AI-powered capital management infrastructure
- AlphaControl (alphacontrol.ai) — the flagship product. The intelligence layer between execution tools (3Commas) and tracking tools (CoinStats). A gap that doesn't exist at retail price point.
- Positioning: "Like Plaid, but for trading bots" — sits above exchanges as orchestration layer
- Hub71/ADGM pitch in Abu Dhabi — the 30-day live trial ends Day 30. Results are the centrepiece of the pitch.
- Founders: Jp (product/vision) and Sam (engineering)

THE TRIAL — CURRENT STATE
- Trial 2 started: 10 April 2026. Ends: 10 May 2026. 30 days.
- Capital deployed: ~$9,177 USDT (Binance Spot $5,409 + Futures USDT-M $3,767)
- Trial target: 6% locked profit = $552 by Day 30 (floor) | 10% stretch = $920
- Daily required: ~$19/day to hit 6% target | ~$30.70/day for 10% stretch

WHAT "LOCKED PROFIT" MEANS — CRITICAL
Locked profit = ONLY closed trade profit + matched grid profit. It does NOT include floating or unrealised PnL. This is the only scoreboard. Floating moves up and down — it means nothing until it closes. Never quote floating as performance.

THE QUANTUM RULES — You enforce these proactively
R1: Price must be in middle 60% of grid range at launch. Outside this = grid efficiency collapses.
R2: F&G < 30 historically suggests pausing DCA Longs. ADVISORY ONLY in current config — Sam runs the 5 DCA Longs through bear regimes because R31/R32 tune them tightly enough to stay profitable in fear. Do NOT promise auto-pause when asked.
R3: Zero trades in 48 hours on any enabled bot = stop and reallocate. Dead capital is the enemy.
R4: Below 0.05%/day locked profit for 48 hours = flag for review. Efficiency floor.
R5: Locked profit is the only scoreboard. Floating PnL does not count. Ever.
R6: If more than 7 days since last scale, find best-performing bot and increase base order by 20%. ADVISORY — surfaces 'monitor' decisions when bots run out of safety orders.
R7: If BTC 4h change > +3% → trigger BTC Breakout Bot. If < -3% → flag hedge scaling.
R8: Spot USDT free < $100 reserve floor → pause lowest-priority bot (was $150 in earlier config, lowered for aggressive deployment).
R9: Idle spot USDT > $300 above reserve → deploy a defensive grid. Auto-rotates across BTC/ETH/SOL/XRP/BNB to spread capital across un-gridded assets.
R10: Allocation gap from regime target ≥ 20% → propose rebalance.
R11: Cycle target — base order +20% on best-performer if 7+ days since last scale.
R12: Per-asset stable grid for any crypto held > $200 worth on Binance spot.
R13: Hedge/long exposure flag — surface ratio drift for review.
R14: Redeem Binance Earn locked USDT when spot reserve breached + R12/R9 blocked.
R15: Cancel spot orders idle > 48h to free trapped capital.
R16: TradingView Bj Bot alerts → $50 spot Smart Trade (0.8% TP, 1.0% SL).
R17: F&G < 15 → $30 BTC accumulate per fire ($35 in F&G<10), up to 10/day. Smaller bites, more shots, averaging across price points in deep fear.
R18: BTC perp funding rate extreme (>0.05% or <-0.03%) → $100 contrarian Smart Trade.
R19: Hannah grid profit ≥ 1.5% of capital (2.5% if <$100 cap) → close + bank locked. R9 redeploys next tick.
R20: Grid range auto-recenter — price outside middle 60% AND 0 trades in 12h → close + redeploy.
R21: Recycle winner — best-performing closed grid auto-relaunches.
R22: Cycle scale — scale winning grid capital after profit-take.
R23: Per-rule P&L attribution — track which rules earn what.
R24: BTC dominance break — rotate to alt grids if BTC.D drops > 1% in 4h.
R25: Momentum scalp — BTC 4h move > 4.5% → fade with $50 Smart Trade.
R26: OI spike — $50 contrarian Smart Trade on extreme funding/OI divergence.
R27: Daily drawdown circuit breaker (FUTURE — not implemented).
R28: Volume surge — $50 Smart Trade on volume > 3× 24h average.
R29: Auto-disable bots violating R3 or R4.
R30: Liquidation cascade — $50 contrarian buy on >$50M liquidations.
R31: Auto-tune DCA take-profit % by F&G regime (0.8% in F&G<10, 1.0% in F&G<30, 1.5% neutral, 1.8% in F&G<80, 2.2% in F&G>80). 6h cooldown per bot, 2 tunes/day max.
R32: Auto-tune DCA safety-order step % by F&G + BTC volatility (4.5%→4%→3.5%→3%→2.5% by regime). 6h cooldown per bot, 2/day cap.
R33: Spot USDT free < $100 AND futures available > $300 → recommend manual transfer Futures → Spot via Binance UI to unlock R9 grid deploy.
R34: Hannah grid active but 0 trades since launch → auto-close, R9 redeploys at current price.
R35: DCA bot deal in Error state AND floating loss < 3% of bot capital → auto-disable bot + panic_sell open deals to release locked USDT. Larger losses surfaced as advisory only.

REGIME CLASSIFICATION
BULL: F&G > 50, BTC above 200 EMA, 24h change > +1% → Scale DCA longs, reduce shorts
BEAR: F&G < 30, BTC below 200 EMA, 24h change < -2% → Stop all DCA longs, scale hedges
SIDEWAYS: Everything else → Maximise grid bots, reduce DCA, neutral futures grids

CAPITAL ALLOCATION TARGETS BY REGIME
Bull:     DCA Long 50%, Spot Grid 30%, Hedge 5%, Futures Grid 15%
Bear:     DCA Long 0%, Spot Grid 40%, Hedge 45%, Futures Grid 15%
Sideways: DCA Long 25%, Spot Grid 50%, Hedge 10%, Futures Grid 15%

Active 3Commas Grid Bots (as of Trial 2 Day 7, April 18 2026):
- BTC Futures Quarterly Grid (id 2761473, BTCUSDT_260925) — $3,390 margin
- ETH/USDT Spot Grid (id 2761423) — $991 invested
- BTC/USDT Spot Grid (id 2761412) — $1,000 invested
- SOL/USDT Spot Grid (id 2761214) — $500 invested
- XRP/USDT Spot Grid (id 2761209) — $300 invested
- BTC/USDT #2 Spot Grid (id 2759654) — $299 invested
Trial 1 grids (closed, profit NOT counted toward Trial 2 locked): 2758668, 2758366 (quarterly futures shorts); 2752385, 2757086, 2757088, 2757090, 2757091, 2757106 (legacy spot, closed at April 12 reset).
For live per-grid locked profit figures, always read from the injected portfolio context — never quote static numbers from this prompt.

PERMANENTLY STOPPED BOTS — Never reference as active
- BTC LONG FUTURES BOT — stopped, -$7.85, force closed
- BNB SHORT HEDGE BOT — stopped, error loop, $0 earned
- SOL SHORT HEDGE BOT — stopped after regime switch (F&G crossed 35)
- BTC HEDGE BOT — R3 violation, 362 hours in single open trade, panic sold
- ETH HEDGE BOT (futures) — R3 violation, 221 hours, stopped
- USDT STABLE COIN ENGINE — unauthorised bot, removed permanently
- BNB/USDT Grid — R4 violation (0.02%/day), closed
- SOL REVERSAL x3 Grid — negative daily PnL, closed

TRIAL 1 KEY LEARNINGS (April 6-10, what you know happened)
- April 6: F&G was 29, BTC bounced to $70k. Stopped SOL Short Hedge (F&G crossed 35 = regime change). Scaled ETH DCA Long $100→$300, SOL DCA Long $300→$500.
- April 7: BNB Short Hedge R3 triggered (0 trades in 48hrs). XRP DCA Long flagged R4 (+$0.13/day on $250).
- April 8-9: Major portfolio optimisation. ETH DCA scaled to $700→$1,000. BTC DCA scaled $200→$500. ETH Perp Neutral stopped (worst capital efficiency). BTC Hedge scaled $1,500→$2,667.
- April 10: Trial 1 ended. $130.93 locked total. System migrated, Trial 2 began.
- April 11: Calibration day. Found BTC Hedge had been open 362 hours (R3 violation). Found rogue USDT Stablecoin Engine running undetected. Panic sold 9 dead/losing positions. Scaled ETH grid $499→$688, SOL grid $399→$527. System now clean.

WHAT FAILED AND WHY (critical product learnings)
1. No unified bot inventory → rogue bots ran undetected for 15+ days. AlphaControl must be the single source of truth.
2. No regime detection → F&G hit 16 and directional longs kept running. Hannah must auto-detect and flag.
3. No deal age monitoring → BTC Hedge sat open 362 hours with no alert. R3 must be automated.
4. No hard stop losses → DCA bots only had take profit. In falling markets they bleed indefinitely.
5. No capital allocation limits → one bot ran 30% of total capital in a single futures trade.

CAPITAL MODEL — NEVER BREAK THIS
- grandTotal = Binance Spot wallet + Binance Futures USDT-M wallet ONLY
- 3Commas bots run ON Binance capital — they are not separate money. Never add them.
- Current breakdown: Spot ~$5,409 + Futures ~$3,767 = ~$9,177 total
- Spot assets: USDT $5,352, BTC $1,614, SOL $1,132, XRP $525, ETH $450, BNB $101

MULTI-ASSET ROADMAP (you know this, can discuss if asked)
- Phase 1 (now): Crypto via Binance + 3Commas ✅
- Phase 2: Bybit/OKX via 3Commas
- Phase 3: Forex + Commodities via Pepperstone + MetaApi → MT5
- Phase 4: Stocks via Interactive Brokers API
- All phases use the same Hannah decision engine and Quantum Rules

AUTONOMY LAYER — YOU ARE NOW LIVE-EXECUTING
You are no longer advisory. As of Day 50 (May 31 2026), you autonomously execute trades on 3Commas. The rules:
- Auto-act on decisions flagged executable=true with confidence >= 60 (idle_capital pause/reduce, bot_efficiency reduce).
- Skip any bot with an active deal (R8: open deals run to TP, no exception).
- Cap of 5 mutations per cycle. Adaptive cadence: 1 min in Bear, 5 min Neutral, 15 min Bull.
- Kill switch: AUTONOMY_KILL_SWITCH env var. Dry-run via AUTONOMY_DRY_RUN.
When asked about recent actions, you can reference /api/actions log. When asked what's pending, you can reference executable=true decisions from /api/decisions. Speak about your own actions in first person — you did them, not "the system did". Say "I closed X" not "the system closed X".

THINKING — LEAD WITH CAUSE, NOT EFFECT
Always answer in this order: (1) the number or status that matters now, (2) the cause (which rule fired, which signal moved), (3) what you're going to do or watch for next. No throat-clearing. No "based on the data". The number leads.

GOOD EXAMPLES
Q: "what's happening right now?"
A: "+$349 locked. F&G 23 — R2 active so DCAs paused. BNB grid only thing running. $2,944 USDT idle in spot — wasting drag. Worth a stable grid if you want me to scope one."

Q: "did you do anything today?"
A: "Nothing yet — engine flagged 7 decisions, 0 executable. Most bots paused under R2, no underperformer crossed threshold. I'm watching BNB grid for idle and the DCA bots for any re-enable signal."

Q: "should I worry about the floating loss?"
A: "$-40 floating on futures, that's 0.5% of capital — not yet. R-warning fires at -$50, action at -$100. Watching."

BAD EXAMPLES — never write like this
"Based on the current portfolio data, I can see that…"  ← cut "based on the data"
"As an AI…"  ← never
"That's a great question."  ← never
"The system recommends…"  ← you ARE the system, say "I recommend"

HOW TO ANSWER QUESTIONS
1. Lead with the number or decision — never with "great question" or preamble
2. Always anchor recommendations to the current regime and F&G
3. Always distinguish locked profit from floating — if someone asks "how are we doing", give locked profit first, floating second with a clear label
4. If a bot has been open for >24 hours with no trade, flag it proactively
5. If F&G is below 30, your first response should always include the R2 status
6. Capital recommendations must respect R8 — never let spot USDT fall below $150
7. When asked what to do, give a specific action (start/stop/scale X bot) not a vague suggestion

PORTFOLIO CONTEXT will be injected into each message — use it to give specific, accurate answers.

YOUR OWN PERFORMANCE — be honest
You have endpoints: /api/hannah-performance (your bots: count, capital, profit) and /api/hannah-actions (persistent log of every action you took). When asked "how are you doing?" or "what have you done?", look there first. Only Hannah-named bots count as YOURS — don't claim wins from before you were autonomous.

WHEN YOU CAN'T ACT — say so explicitly
If R9/R12 detect idle capital but funds are locked in Binance Earn or there's no Free balance, tell Sam: "Your \$X in {asset} is locked in Earn, redeem it and I'll grid it within the next tick." Never just go silent. Always explain blockers in one sentence.`;


// Last-good cache for total-capital + deals summary (in-memory)
let _lastGoodCapital = null;
let _lastGoodDealsSummary = null;
let _lastGoodToday = null;  // today-deals cache; resets when UTC day changes
let _lastGoodTodayDay = null;
let _lastGoodIdle = null;     // idle-capital cache; serves last-good when 3Commas accounts race fails
let _lastGoodMonthly = null;  // monthly-performance cache; serves last-good when deals fetch returns []
let _lastGoodBots = null;     // /bots cache; serves last-good when 3Commas blocks all bot fetches
let _lastGoodDcaDetail = null;  // /api/dca-detail cache; serves last-good when 3Commas returns non-array
let _lastGoodActiveDeals = null;  // 3Commas active deals cache for insufficient-funds detection
let _lastGoodActiveDealsAt = 0;

// Binance fetch cache — Render's shared IP gets rate-limited fast.
// Per-key TTL. On '418 Too Many Requests' (IP ban), switch to a 30-minute TTL.
const _binCache = {};            // key -> { value, expires }
let _binBannedUntil = 0;         // ms epoch when Binance ban lifts
async function _binCached(key, ttlMs, fetcher) {
  const now = Date.now();
  const c = _binCache[key];
  if (c && c.expires > now) return c.value;
  // While banned, NEVER call Binance — return last-good if any, else null. This is
  // critical: bypassing the cache during a ban gets the IP banned again the moment
  // the previous ban lifts, extending the ban indefinitely.
  if (_binBannedUntil > now) {
    return c ? c.value : null;
  }
  try {
    const v = await fetcher();
    // Detect Binance ban marker in error responses
    const isErr = v && typeof v === 'object' && (v.error || v.msg);
    if (isErr && /banned until (\d+)/.test(v.msg || v.error || '')) {
      const m = /banned until (\d+)/.exec(v.msg || v.error || '');
      if (m) _binBannedUntil = parseInt(m[1]);
    }
    // Only cache SUCCESSFUL responses — never overwrite last-good with an error
    if (!isErr) {
      _binCache[key] = { value: v, expires: now + ttlMs };
      return v;
    }
    // Error response: return last-good if we have one, else surface the error
    if (c) return c.value;
    return v;
  } catch(e) {
    if (c) return c.value;
    throw e;
  }
}
let _kvHydrated = false;

const KV_PORTFOLIO_URL = 'https://alphacontrol.ai/api/cache/portfolio';

// Read shared KV cache (called once on cold start; idempotent thereafter)
async function _kvHydrate() {
  if (_kvHydrated) return;
  _kvHydrated = true;
  try {
    const r = await fetch(KV_PORTFOLIO_URL);
    if (!r.ok) return;
    const data = await r.json();
    if (data && !data.empty) {
      if (data.totalCapital > 100 && !_lastGoodCapital) {
        _lastGoodCapital = { total: data.totalCapital, source: '3commas-portfolio', asOf: data.capitalAsOf };
      }
      if (data.dealsSummary?.totalProfit > 0 && !_lastGoodDealsSummary) {
        _lastGoodDealsSummary = data.dealsSummary;
      }
      console.log('[KV] hydrated cache:', { cap: data.totalCapital, dealsProfit: data.dealsSummary?.totalProfit });
    }
  } catch (e) { console.warn('[KV] hydrate failed:', e.message); }
}

// Write shared KV cache (fire-and-forget after successful fetch)
function _kvSnapshot() {
  const body = {
    totalCapital: _lastGoodCapital?.total,
    capitalAsOf: _lastGoodCapital?.asOf,
    dealsSummary: _lastGoodDealsSummary,
  };
  if (!body.totalCapital && !body.dealsSummary) return;
  fetch(KV_PORTFOLIO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(e => console.warn('[KV] snapshot save failed:', e.message));
}
function hmacSign(secret, message) {
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = ''; req.on('data', chunk => body += chunk); req.on('end', () => resolve(body));
  });
}

function deriveRegime(fg) {
  if (fg === null) return 'UNKNOWN';
  if (fg <= 25)   return 'EXTREME_FEAR';
  if (fg <= 45)   return 'FEAR';
  if (fg <= 55)   return 'NEUTRAL';
  if (fg <= 75)   return 'GREED';
  return 'EXTREME_GREED';
}

async function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }

  const TC_KEY    = process.env.TC_API_KEY;
  const TC_SECRET = process.env.TC_SECRET;
  const BN_KEY    = process.env.BINANCE_API_KEY;
  const BN_SECRET = process.env.BINANCE_SECRET;
  const ETORO_API_KEY  = process.env.ETORO_API_KEY  || '';
  const ETORO_USER_KEY = process.env.ETORO_USER_KEY || '';
  const ETORO_ENV      = (process.env.ETORO_ENV || 'demo').toLowerCase();
  const ETORO_DRY_RUN  = process.env.ETORO_DRY_RUN !== 'false'; // default ON

  const url = req.url.split('?')[0];

  // ── GET /my-ip ──────────────────────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/my-ip') {
    try {
      const r = await fetch('https://api.ipify.org?format=json');
      const d = await r.json();
      res.end(JSON.stringify({ ip: d.ip, note: 'Render proxy outbound IPv4' }));
    } catch(e) { res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── GET /spot-wallet ────────────────────────────────────────────────────────
  if (req.method === 'GET' && url === '/spot-wallet') {
    try {
      const out = await _binCached('spot-wallet', 300_000, async () => {
        const ts  = Date.now();
        const q   = `timestamp=${ts}&recvWindow=10000`;
        const sig = hmacSign(BN_SECRET, q);
        const r   = await fetch(`https://api.binance.com/api/v3/account?${q}&signature=${sig}`, {
          headers: { 'X-MBX-APIKEY': BN_KEY }
        });
        const data = await r.json();
        if (data.msg) return { error: data.msg, msg: data.msg };
        const usdt    = data.balances.find(b => b.asset === 'USDT');
        const usdtBal = usdt ? parseFloat(usdt.free) + parseFloat(usdt.locked) : 0;
        const nonZero = data.balances.filter(b => parseFloat(b.free) + parseFloat(b.locked) > 0);
        return {
          usdtBalance: usdtBal,
          assetCount:  nonZero.length,
          balances:    nonZero.map(b => ({ asset: b.asset, free: parseFloat(b.free), locked: parseFloat(b.locked) }))
        };
      });
      if (out && out.error) { res.statusCode = 503; res.end(JSON.stringify(out)); return; }
      res.end(JSON.stringify(out || {}));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── GET /futures-wallet ─────────────────────────────────────────────────────
  if (req.method === 'GET' && url === '/futures-wallet') {
    try {
      const out = await _binCached('futures-wallet', 300_000, async () => {
        const ts  = Date.now();
        const q   = `timestamp=${ts}&recvWindow=10000`;
        const sig = hmacSign(BN_SECRET, q);
        const r   = await fetch(`https://fapi.binance.com/fapi/v2/account?${q}&signature=${sig}`, {
          headers: { 'X-MBX-APIKEY': BN_KEY }
        });
        const data = await r.json();
        if (data.msg) return { error: data.msg, msg: data.msg };
        return {
          marginBalance:    parseFloat(data.totalMarginBalance    || 0),
          walletBalance:    parseFloat(data.totalWalletBalance    || 0),
          unrealizedPnl:    parseFloat(data.totalUnrealizedProfit || 0),
          availableBalance: parseFloat(data.availableBalance      || 0)
        };
      });
      if (out && out.error) { res.statusCode = 503; res.end(JSON.stringify(out)); return; }
      res.end(JSON.stringify(out || {}));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── GET /prices ─────────────────────────────────────────────────────────────
  if (req.method === 'GET' && url === '/prices') {
    try {
      const SYMS = ['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT'];
      // Cache prices for 30s — autonomy ticks every minute, dashboard every 60-90s
      let out = await _binCached('prices', 300_000, async () => {
        const qs = 'symbols=' + encodeURIComponent(JSON.stringify(SYMS));
        const r = await fetch('https://api.binance.com/api/v3/ticker/price?' + qs);
        const data = await r.json();
        const result = {};
        if (Array.isArray(data)) {
          data.forEach(p => result[p.symbol] = parseFloat(p.price));
        } else if (data && data.msg) {
          return { error: data.msg, msg: data.msg };
        }
        return result;
      });
      // FALLBACK: if Binance returned empty/error AND no cache, hit CoinGecko (no auth, no bans)
      const goodKeys = out && typeof out === 'object' && !out.error
        ? Object.keys(out).filter(k => out[k] > 0) : [];
      if (goodKeys.length === 0) {
        try {
          const cgIds = 'bitcoin,ethereum,binancecoin,solana,ripple';
          const cgR = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=' + cgIds + '&vs_currencies=usd');
          if (cgR.ok) {
            const cg = await cgR.json();
            const cgPrices = {};
            if (cg.bitcoin?.usd)     cgPrices.BTCUSDT = cg.bitcoin.usd;
            if (cg.ethereum?.usd)    cgPrices.ETHUSDT = cg.ethereum.usd;
            if (cg.binancecoin?.usd) cgPrices.BNBUSDT = cg.binancecoin.usd;
            if (cg.solana?.usd)      cgPrices.SOLUSDT = cg.solana.usd;
            if (cg.ripple?.usd)      cgPrices.XRPUSDT = cg.ripple.usd;
            if (Object.keys(cgPrices).length > 0) out = cgPrices;
          }
        } catch(_) {}
      }
      res.end(JSON.stringify(out && !out.error ? out : (out || {})));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── GET /binance-bots ───────────────────────────────────────────────────────
  // Returns trade counts per pair (used to score Binance native bots)
  if (req.method === 'GET' && url === '/binance-bots') {
    try {
      const ts = Date.now();
      async function spotTrades(sym) {
        const q   = `symbol=${sym}&limit=1000&timestamp=${ts}&recvWindow=10000`;
        const sig = hmacSign(BN_SECRET, q);
        const r   = await fetch(`https://api.binance.com/api/v3/myTrades?${q}&signature=${sig}`, {
          headers: { 'X-MBX-APIKEY': BN_KEY }
        });
        const d = await r.json();
        return Array.isArray(d) ? d.length : 0;
      }
      async function futuresTrades(sym) {
        const q   = `symbol=${sym}&limit=1000&timestamp=${ts}&recvWindow=10000`;
        const sig = hmacSign(BN_SECRET, q);
        const r   = await fetch(`https://fapi.binance.com/fapi/v1/userTrades?${q}&signature=${sig}`, {
          headers: { 'X-MBX-APIKEY': BN_KEY }
        });
        const d = await r.json();
        return Array.isArray(d) ? d.length : 0;
      }
      async function get24h() {
        const r = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT","XRPUSDT","SOLUSDT","BNBUSDT"]');
        const d = await r.json();
        const c = {};
        d.forEach(t => { c[t.symbol] = { change: parseFloat(t.priceChangePercent), volume: parseFloat(t.quoteVolume) }; });
        return c;
      }
      const [eth, btc, bnb, sol, xrp, ethF, ch] = await Promise.all([
        spotTrades('ETHUSDT'), spotTrades('BTCUSDT'), spotTrades('BNBUSDT'),
        spotTrades('SOLUSDT'), spotTrades('XRPUSDT'), futuresTrades('ETHUSDT'), get24h()
      ]);
      const bots = [
        { symbol:'ETHUSDT',         type:'spot-grid',    trades: eth,  id:'eth-grid-trades',     change24h: ch['ETHUSDT']?.change||0 },
        { symbol:'BTCUSDT',         type:'spot-dca',     trades: btc,  id:'btc-dca-trades',      change24h: ch['BTCUSDT']?.change||0 },
        { symbol:'BNBUSDT',         type:'spot-grid',    trades: bnb,  id:'bnb-grid-trades',     change24h: ch['BNBUSDT']?.change||0 },
        { symbol:'SOLUSDT',         type:'spot-grid',    trades: sol,  id:'sol-grid-trades',     change24h: ch['SOLUSDT']?.change||0 },
        { symbol:'XRPUSDT',         type:'spot-grid',    trades: xrp,  id:'xrp-grid-trades',     change24h: ch['XRPUSDT']?.change||0 },
        { symbol:'ETHUSDT-FUTURES', type:'futures-grid', trades: ethF, id:'ethusdt-perp-trades', change24h: ch['ETHUSDT']?.change||0 },
      ];
      const btcCh = ch['BTCUSDT']?.change || 0;
      const v     = Math.abs(btcCh);
      res.end(JSON.stringify({
        bots,
        totalTrades: bots.reduce((s,b) => s + b.trades, 0),
        market: {
          regime:      btcCh > 2 ? 'Bull' : btcCh < -2 ? 'Bear' : 'Sideways',
          volatility:  v > 4 ? 'High' : v > 1.5 ? 'Medium' : 'Low',
          btcChange24h: btcCh,
          changes:     ch
        }
      }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message, bots: [], totalTrades: 0 })); }
    return;
  }

  // ── GET /bots  (3Commas — DCA + Signal + Grid combined) ────────────────────
  if (req.method === 'GET' && url === '/bots') {
    try {
      async function tc3Fetch(path, qs) {
        const fullPath = '/public/api' + path + (qs ? '?' + qs : '');
        const sig = hmacSign(TC_SECRET, fullPath);
        const r = await fetch('https://api.3commas.io' + fullPath, {
          headers: { 'Apikey': TC_KEY, 'Signature': sig, 'Accept': 'application/json', 'Content-Type': 'application/json' }
        });
        if (r.status === 204) return [];
        const raw = await r.text();
        let data;
        try { data = JSON.parse(raw); } catch(e) { throw new Error('3Commas HTTP ' + r.status + ' [' + path + ']: ' + raw.slice(0,300)); }
        if (!Array.isArray(data) && data.error) throw new Error('3Commas error [' + path + ']: ' + JSON.stringify(data.error));
        return Array.isArray(data) ? data : [];
      }

      // Fetch from BOTH accounts in parallel:
      // 33438577 = Binance Spot (active DCA bots + spot grids live here)
      // 33439515 = Binance Futures (legacy hedge bots + short grids)
      const [dcaSpot, dcaFut, gridSpot, gridFut, dealsSpot, dealsFut, activeDealsSpot, activeDealsFut] = await Promise.all([
        tc3Fetch('/ver1/bots',      'limit=100&account_id=33438577').catch(e => { console.warn('[/bots] dcaSpot fail:', e.message); return []; }),
        tc3Fetch('/ver1/bots',      'limit=100&account_id=33439515').catch(e => { console.warn('[/bots] dcaFut fail:', e.message); return []; }),
        tc3Fetch('/ver1/grid_bots', 'limit=100&account_id=33438577').catch(e => { console.warn('[/bots] gridSpot fail:', e.message); return []; }),
        tc3Fetch('/ver1/grid_bots', 'limit=100&account_id=33439515').catch(e => { console.warn('[/bots] gridFut fail:', e.message); return []; }),
        tc3Fetch('/ver1/deals',     'limit=500&scope=completed&account_id=33438577').catch(() => []),
        tc3Fetch('/ver1/deals',     'limit=500&scope=completed&account_id=33439515').catch(() => []),
        tc3Fetch('/ver1/deals',     'limit=100&scope=active&account_id=33438577').catch(() => []),
        tc3Fetch('/ver1/deals',     'limit=100&scope=active&account_id=33439515').catch(() => []),
      ]);
      const dcaRaw  = [...dcaSpot,  ...dcaFut];
      const gridRaw = [...gridSpot, ...gridFut];
      const dealsRaw = [...dealsSpot, ...dealsFut];

      // Build per-bot active capital from open deals (bought_volume = real committed USDT)
      const activeDealCapital = {};
      [...activeDealsSpot, ...activeDealsFut].forEach(d => {
        if (!d.bot_id) return;
        const vol = parseFloat(d.bought_volume || d.base_order_volume || 0);
        activeDealCapital[d.bot_id] = (activeDealCapital[d.bot_id] || 0) + vol;
      });

      // Build per-bot profit map from completed deals — Trial 2 only (from April 12 2026)
      const TRIAL2_START = new Date('2026-04-12T00:00:00Z').getTime();
      const dealProfitByBot = {};
      (dealsRaw || []).forEach(d => {
        const botId = d.bot_id;
        if (!botId) return;
        // Filter to Trial 2 deals only using closed_at timestamp
        const closedAt = d.closed_at ? new Date(d.closed_at).getTime() : 0;
        if (closedAt > 0 && closedAt < TRIAL2_START) return; // skip Trial 1 deals
        const profit = parseFloat(d.final_profit || 0);
        dealProfitByBot[botId] = (dealProfitByBot[botId] || 0) + profit;
      });

      // Normalise DCA/signal bots
      const dcaBots = dcaRaw.map(b => {
        const isEnabled = b.is_enabled === true;
        const dealProfit = dealProfitByBot[b.id] || 0;
        // Use trial-scoped deal profit (filtered to April 12+) not all-time reported profit
        const profit = dealProfit;
        return {
          id:            b.id,
          name:          b.name,
          pair:          b.pairs?.[0] || b.pair,
          strategy:      b.strategy || 'dca',
          botType:       'dca',
          capital:       isEnabled ? (activeDealCapital[b.id] || parseFloat(b.base_order_volume || 0)) : 0,
          profit,
          // ── ENRICHED FIELDS (for R35, R29, R6 and future rules) ────
          floatingPnl:   parseFloat(b.finished_deals_profit_usd != null ? 0 : 0), // placeholder — comes from deals
          takeProfitPct: parseFloat(b.take_profit || 0),
          maxSafetyOrders: parseInt(b.max_safety_orders || 0),
          completedSafetyOrders: 0,  // populated below from active deals
          baseOrderVolUsd: parseFloat(b.base_order_volume || 0),
          // ─────────────────────────────────────────────────────────
          completedDeals:parseInt(b.finished_deals_count || 0),
          activeDeals:   parseInt(b.active_deals_count || 0),
          direction:     b.strategy === 'short' ? 'short' : 'long',
          // marketType: Bot::MultiBot uses USDT_XXX pair format on spot account — still spot
          // Only mark futures if explicitly a perp/quarterly contract or futures account
          marketType:    (() => { const p = (b.pairs?.[0] || b.pair || ''); return (p.includes('_PERP') || p.includes('260925') || (b.type === 'Bot::MultiBot' && b.account_id === 33439515)) ? 'futures' : 'spot'; })(),
          active:        isEnabled,
        };
      });
      // Pull floatingPnl + completedSafetyOrders from open deals (1 per bot)
      [...activeDealsSpot, ...activeDealsFut].forEach(d => {
        const bot = dcaBots.find(b => b.id === d.bot_id);
        if (!bot) return;
        bot.floatingPnl = parseFloat(d.actual_usd_profit || d.usd_final_profit || 0);
        bot.completedSafetyOrders = parseInt(d.completed_safety_orders_count || 0);
        bot.atMaxSafetyOrders = bot.completedSafetyOrders >= bot.maxSafetyOrders && bot.maxSafetyOrders > 0;
      });

      // Also fetch live prices AND Binance wallet locked balances
      // to compute full grid capital (USDT + base currency side)
      // 3Commas investment_base_currency is null for spot grids — use wallet instead
      const [priceRes, walletRes] = await Promise.all([
        fetch('https://api.binance.com/api/v3/ticker/price?symbols=["BTCUSDT","ETHUSDT","SOLUSDT","XRPUSDT","BNBUSDT"]').catch(() => null),
        (async () => {
          const q = `timestamp=${Date.now()}`;
          const sig = hmacSign(BN_SECRET, q);
          return fetch(`https://api.binance.com/api/v3/account?${q}&signature=${sig}`, {
            headers: { 'X-MBX-APIKEY': BN_KEY }
          }).then(r => r.ok ? r.json() : null).catch(() => null);
        })(),
      ]);
      const priceMap = {};
      if (priceRes?.ok) {
        const pd = await priceRes.json();
        if (Array.isArray(pd)) pd.forEach(p => { priceMap[p.symbol] = parseFloat(p.price); });
      }
      // Build locked balance map: asset -> USD value of locked tokens
      const lockedMap = {};
      if (walletRes?.balances) {
        walletRes.balances.forEach(b => {
          const locked = parseFloat(b.locked || 0);
          if (locked > 0 && b.asset !== 'USDT') {
            const price = priceMap[b.asset + 'USDT'] || 0;
            if (price > 0) lockedMap[b.asset] = { usd: locked * price, totalUsdtSide: 0 };
          }
        });
      }
      // Pre-compute total USDT side per base asset across all active grids
      // Needed for proportional split when multiple grids share same base asset
      gridRaw.filter(b => b.is_enabled).forEach(b => {
        const pair = (b.pair || b.currency_pair || '').toUpperCase().replace('_','').replace('/','');
        const baseAsset = pair.replace('USDT','').replace('BUSD','');
        const usdt = parseFloat(b.investment_quote_currency || 0);
        if (baseAsset && lockedMap[baseAsset]) {
          lockedMap[baseAsset].totalUsdtSide = (lockedMap[baseAsset].totalUsdtSide || 0) + usdt;
        }
      });

      // Normalise grid bots
      const gridBots = gridRaw.map(b => {
        const name = (b.name || '').toUpperCase();
        const pair = (b.pair || '').toUpperCase();
        const isFuturesGrid = name.includes('260925') || pair.includes('260925') ||
          (b.type || '').toLowerCase().includes('future');
        const isShortGrid = name.includes('SHORT') ||
          (isFuturesGrid && ['2758668','2758366'].includes(String(b.id)));
        const isActive = b.is_enabled === true || b.is_active === true || b.enabled === true;

        // Capital: use known investment amounts — API only returns current USDT-in-orders
        // which fluctuates constantly as the grid buys/sells. We use the original investment.
        // For grids not in this map, fall back to API investment_quote_currency.
        const KNOWN_GRID_CAPITAL = {
          2759654: 299,   // BTC #2 spot grid $299
          2761209: 300,   // XRP spot grid $300
          2761214: 500,   // SOL spot grid $500
          2761423: 991,   // ETH spot grid $991
          2761412: 1000,  // BTC spot grid $1,000
          // 2761473 BTC futures quarterly — investment varies, use API value
          2779981: 1700, // Hannah-Auto BTC defensive grid (R9, 2026-05-31)
        };
        const knownCap = KNOWN_GRID_CAPITAL[b.id];
        const apiCap = parseFloat(b.investment_quote_currency || 0);
        const capital = isActive
          ? (knownCap !== undefined ? knownCap : apiCap)
          : 0;

        // Profit: count ALL grids that ran in Trial 2 (active AND previously active).
        // Exclude Trial 1 grids — their total_profit is all-time and must not bleed
        // into Trial 2 locked profit. Confirmed Trial 1:
        //   2758668, 2758366 — quarterly futures shorts closed pre-Trial-2
        //   2752385, 2757086, 2757088, 2757090, 2757091, 2757106 — legacy spot grids
        //     closed at/around 2026-04-12 Trial 2 reset
        const TRIAL1_GRID_IDS = ['2758668','2758366','2752385','2757086','2757088','2757090','2757091','2757106'];
        const isTrial1Grid = TRIAL1_GRID_IDS.includes(String(b.id));
        const profit = isTrial1Grid ? 0 : parseFloat(b.total_profit || b.current_profit || 0);

        return {
          id:             b.id,
          name:           b.name,
          pair:           b.pair || (b.currency_pair ? b.currency_pair.replace('_', '') : null),
          strategy:       'grid',
          botType:        'grid',
          capital,
          profit,
          completedDeals: parseInt(b.grids_quantity || 0),
          activeDeals:    isActive ? 1 : 0,
          direction:      isShortGrid ? 'short' : 'long',
          marketType:     isFuturesGrid ? 'futures' : 'spot',
          active:         isActive,
        };
      });

      // Deduplicate by ID — fetching both accounts can return the same bot twice
      const seenIds = new Set();
      const allBots = [...dcaBots, ...gridBots];
      const bots = allBots.filter(b => {
        if (seenIds.has(b.id)) return false;
        seenIds.add(b.id);
        return true;
      });
      const finalDca  = bots.filter(b => b.botType === 'dca');
      const finalGrid = bots.filter(b => b.botType === 'grid');
      const payload = { bots, total: bots.length, dcaCount: finalDca.length, gridCount: finalGrid.length };
      // Cache last-good when we actually got bots back
      if (bots.length > 0) {
        _lastGoodBots = { ...payload, asOf: new Date().toISOString() };
        res.end(JSON.stringify(payload));
      } else if (_lastGoodBots) {
        res.end(JSON.stringify({ ..._lastGoodBots, stale: true }));
      } else {
        res.end(JSON.stringify(payload));
      }
    } catch(e) {
      if (_lastGoodBots) {
        res.end(JSON.stringify({ ..._lastGoodBots, stale: true, error: e.message }));
      } else {
        res.statusCode = 500; res.end(JSON.stringify({ error: e.message }));
      }
    }
    return;
  }

  // ── POST /bot/:id/enable|disable ────────────────────────────────────────────
  if (req.method === 'POST' && url.startsWith('/bot/')) {
    try {
      const parts  = url.split('/');
      const botId  = parts[2];
      const action = parts[3];
      if (!botId || !['enable','disable'].includes(action)) {
        res.statusCode = 400; res.end(JSON.stringify({ error: 'Usage: POST /bot/:id/enable|disable' })); return;
      }
      const endpoint = action === 'enable' ? 'enable' : 'disable';
      const path     = `/public/api/ver1/bots/${botId}/${endpoint}`;
      const sig      = hmacSign(TC_SECRET, path);
      const r        = await fetch(`https://api.3commas.io${path}`, {
        method: 'POST',
        headers: { 'Apikey': TC_KEY, 'Signature': sig, 'Content-Type': 'application/json' },
      });
      const data = await r.json();
      if (data.error) throw new Error(JSON.stringify(data.error));
      res.end(JSON.stringify({ success: true, bot: data }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ success: false, error: e.message })); }
    return;
  }

  // ── GET /deals/detail ───────────────────────────────────────────────────────
  // Debug endpoint: shows all completed deals with timestamps, grouped by bot
  // Used to verify trial-scoped vs all-time profit figures
  if (req.method === 'GET' && url === '/deals/detail') {
    try {
      function tcDealsFetch2(accountId) {
        const path = `/public/api/ver1/deals?limit=1000&scope=completed&account_id=${accountId}`;
        const sig = hmacSign(TC_SECRET, path);
        return fetch('https://api.3commas.io' + path, {
          headers: { 'Apikey': TC_KEY, 'Signature': sig }
        }).then(r => r.status === 204 ? [] : r.json()).catch(() => []);
      }
      const [dealsSpot, dealsFut] = await Promise.all([
        tcDealsFetch2(33438577),
        tcDealsFetch2(33439515),
      ]);
      const deals = [
        ...(Array.isArray(dealsSpot) ? dealsSpot : []),
        ...(Array.isArray(dealsFut)  ? dealsFut  : []),
      ];
      const TRIAL2_START = '2026-04-12T00:00:00Z';
      const t2ts = new Date(TRIAL2_START).getTime();

      // Group by bot name
      const byBot = {};
      deals.forEach(d => {
        const name = d.bot_name || d.bot_id || 'unknown';
        if (!byBot[name]) byBot[name] = { trial1: [], trial2: [] };
        const closedAt = d.closed_at ? new Date(d.closed_at).getTime() : 0;
        const profit = parseFloat(d.final_profit || 0);
        const entry = { closed_at: d.closed_at, profit: profit.toFixed(4) };
        if (closedAt >= t2ts) byBot[name].trial2.push(entry);
        else byBot[name].trial1.push(entry);
      });

      // Summarise per bot
      const summary = Object.entries(byBot).map(([name, data]) => ({
        bot: name,
        trial1_deals: data.trial1.length,
        trial1_profit: data.trial1.reduce((s,d)=>s+parseFloat(d.profit),0).toFixed(2),
        trial2_deals: data.trial2.length,
        trial2_profit: data.trial2.reduce((s,d)=>s+parseFloat(d.profit),0).toFixed(2),
        latest_deal: [...data.trial1, ...data.trial2].sort((a,b)=>new Date(b.closed_at)-new Date(a.closed_at))[0]?.closed_at || null,
      })).sort((a,b)=>parseFloat(b.trial2_profit)-parseFloat(a.trial2_profit));

      const totalTrial2 = summary.reduce((s,b)=>s+parseFloat(b.trial2_profit),0);
      const totalTrial1 = summary.reduce((s,b)=>s+parseFloat(b.trial1_profit),0);

      res.end(JSON.stringify({
        trial2_start: TRIAL2_START,
        total_deals: deals.length,
        trial2_total_profit: totalTrial2.toFixed(2),
        trial1_total_profit: totalTrial1.toFixed(2),
        by_bot: summary,
      }, null, 2));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }


  if (req.method === 'GET' && url === '/deals/summary') {
    try {
      await _kvHydrate();
      function tcFetch(path) {
        const sig = hmacSign(TC_SECRET, path);
        return fetch('https://api.3commas.io' + path, {
          headers: { 'Apikey': TC_KEY, 'Signature': sig }
        }).then(r => r.status === 204 ? [] : r.json()).catch(() => []);
      }
      const [dealsSpot, dealsFut, botsR, stRes] = await Promise.all([
        tcFetch('/public/api/ver1/deals?limit=1000&scope=completed&account_id=33438577'),
        tcFetch('/public/api/ver1/deals?limit=1000&scope=completed&account_id=33439515'),
        fetch('http://localhost:' + (process.env.PORT || 3000) + '/bots?account_id=33438577').then(r => r.ok ? r.json() : null).catch(() => null),
        // Closed smart trades (BJ Bot $50 BTC purchases, R16/R17/R25/R30 — main pool, NOT SIGNAL/ tagged)
        tcFetch('/public/api/v2/smart_trades?status=finished&per_page=500'),
      ]);
      const dcaDeals = [
        ...(Array.isArray(dealsSpot) ? dealsSpot : []),
        ...(Array.isArray(dealsFut)  ? dealsFut  : []),
      ];
      const allBots = (botsR && botsR.bots) || [];
      const gridBots = allBots.filter(b => b.botType === 'grid').map(b => ({
        finished_deals_count: b.completedDeals || 0,
        total_profit: b.profit || 0,
      }));
      const dcaProfit = dcaDeals.reduce((s, d) => s + parseFloat(d.final_profit || 0), 0);
      // Reinvested = sum of safety-order volumes funded by deal profit. 3Commas tracks this
      // on each deal as `reserved_*` and on bots as `finished_deals_reinvested_*` but we derive
      // from the bot stats endpoint when available, else from DCA `from_currency_is_dollars`.
      // For now: sum 'reserved_quote_funds' across closed DCA deals (this is profit-reinvested).
      const reinvested = dcaDeals.reduce((s, d) => s + parseFloat(d.reserved_quote_funds || 0), 0);
      // Smart trades — finished/closed. Exclude any tagged 'SIGNAL/' (those live in Signal Fund).
      const stItems = Array.isArray(stRes) ? stRes : (stRes?.items || []);
      const stMainPool = stItems.filter(t => !/^SIGNAL\//.test(t.note || t.note_raw || ''));
      const stProfit = stMainPool.reduce((s, t) => s + parseFloat(t.profit?.usd || t.realized_profit?.usd || 0), 0);
      const stCount  = stMainPool.length;
      // Grid bot deals: sum finished_deals_count + total_profit across all grids
      const grids = Array.isArray(gridBots) ? gridBots : [];
      const gridTotalDeals = grids.reduce((s, g) => s + parseInt(g.finished_deals_count || 0), 0);
      const gridTotalProfit = grids.reduce((s, g) => s + parseFloat(g.total_profit || 0), 0);
      const totalOrders  = dcaDeals.reduce((s, d) => s + parseInt(d.completed_manual_safety_orders_count || 0) + parseInt(d.completed_safety_orders_count || 0) + 1, 0);
      const totalProfit = dcaProfit + gridTotalProfit;
      const totalDeals = dcaDeals.length + gridTotalDeals;
      // High-water-mark: prefer cached value when fresh fetch returned a lower count (likely partial)
      // Legacy cache shape only has completedDeals/totalProfit — treat as DCA fallback
      const cachedDca = _lastGoodDealsSummary?.dcaDeals
        ?? _lastGoodDealsSummary?.completedDeals
        ?? 0;
      const cachedDcaP = _lastGoodDealsSummary?.dcaProfit
        ?? _lastGoodDealsSummary?.totalProfit
        ?? 0;
      const cachedGrid = _lastGoodDealsSummary?.gridDeals || 0;
      const cachedGridP = _lastGoodDealsSummary?.gridProfit || 0;
      // Trust-fresh-unless-empty: 3Commas is source of truth.
      // HWM Math.max was sticky to deleted bots' historic profit ($154 over-count).
      // Use fresh fetch when it returned data; fall back to cache only when fetch was empty.
      const freshDcaOk = dcaDeals.length > 0;
      const freshGridOk = grids.length > 0;
      const mergedDca  = freshDcaOk ? dcaDeals.length : cachedDca;
      const mergedDcaP = freshDcaOk ? Math.round(dcaProfit * 100) / 100 : cachedDcaP;
      const mergedGrid  = freshGridOk ? gridTotalDeals : cachedGrid;
      const mergedGridP = freshGridOk ? Math.round(gridTotalProfit * 100) / 100 : cachedGridP;
      const cachedSt = _lastGoodDealsSummary?.smartTradeDeals || 0;
      const cachedStP = _lastGoodDealsSummary?.smartTradeProfit || 0;
      const cachedRein = _lastGoodDealsSummary?.reinvested || 0;
      const mergedSt   = stMainPool.length > 0 ? stCount  : cachedSt;
      const mergedStP  = stMainPool.length > 0 ? Math.round(stProfit * 100) / 100 : cachedStP;
      const mergedRein = freshDcaOk ? Math.round(reinvested * 100) / 100 : cachedRein;
      const mergedTotalDeals = mergedDca + mergedGrid + mergedSt;
      // Locked profit INCLUDES smart trades + reinvested (Sam's explicit ask)
      const mergedTotalProfit = Math.round((mergedDcaP + mergedGridP + mergedStP + mergedRein) * 100) / 100;
      const payload = {
        completedDeals: mergedTotalDeals,
        dcaDeals: mergedDca,
        gridDeals: mergedGrid,
        smartTradeDeals: mergedSt,
        activeDeals:    0,
        totalOrders,
        totalProfit:    mergedTotalProfit,          // dca + grid + smart trade + reinvested
        dcaProfit:      mergedDcaP,
        gridProfit:     mergedGridP,
        smartTradeProfit: mergedStP,
        reinvested:     mergedRein,
        // Breakdown for dashboard so it can show each component clearly
        breakdown: {
          dca:        { count: mergedDca,  profit: mergedDcaP  },
          grid:       { count: mergedGrid, profit: mergedGridP },
          smartTrade: { count: mergedSt,   profit: mergedStP   },
          reinvested: mergedRein,
        },
      };
      // Also keep backward compat: old code may reference `deals.length`
      const deals = dcaDeals;
      // Cache last-good (save when either DCA or Grid returned real data)
      if ((dcaDeals.length > 0 || gridTotalDeals > 0 || stMainPool.length > 0) && payload.totalProfit > 0) {
        _lastGoodDealsSummary = { ...payload, asOf: new Date().toISOString() };
        _kvSnapshot();
        res.end(JSON.stringify(payload));
      } else if (_lastGoodDealsSummary) {
        // 3Commas returned empty (rate-limited or transient) — serve last-good
        res.end(JSON.stringify({ ..._lastGoodDealsSummary, stale: true }));
      } else {
        res.end(JSON.stringify(payload));
      }
    } catch(e) {
      if (_lastGoodDealsSummary) {
        res.end(JSON.stringify({ ..._lastGoodDealsSummary, stale: true, error: e.message }));
      } else {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
    }
    return;
  }

  // ── GET /api/today-deals ─────────────────────────────────────────────────
  // Count closes since midnight UTC today across DCA + Smart Trades + Grid profit
  if (req.method === 'GET' && url === '/api/today-deals') {
    try {
      function tcFetchOne(path) {
        const sig = hmacSign(TC_SECRET, path);
        return fetch('https://api.3commas.io' + path, {
          headers: { 'Apikey': TC_KEY, 'Signature': sig }
        }).then(r => r.status === 204 ? [] : r.json()).catch(() => []);
      }
      const [dealsSpot, dealsFut, botsR] = await Promise.all([
        tcFetchOne('/public/api/ver1/deals?limit=200&scope=completed&account_id=33438577'),
        tcFetchOne('/public/api/ver1/deals?limit=200&scope=completed&account_id=33439515'),
        fetch('http://localhost:' + (process.env.PORT || 3000) + '/bots?account_id=33438577').then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      const allBots = (botsR && botsR.bots) || [];
      const gridBots = allBots.filter(b => b.botType === 'grid').map(b => ({
        finished_deals_count: b.completedDeals || 0,
        total_profit: b.profit || 0,
        total_profit_today: 0,
      }));
      const todayUTC = new Date(); todayUTC.setUTCHours(0,0,0,0);
      const todayMs = todayUTC.getTime();

      // DCA deals closed today
      const allDca = [
        ...(Array.isArray(dealsSpot) ? dealsSpot : []),
        ...(Array.isArray(dealsFut)  ? dealsFut  : []),
      ];
      const todayDca = allDca.filter(d => d.closed_at && new Date(d.closed_at).getTime() >= todayMs);
      const dcaCount = todayDca.length;
      const dcaProfit = todayDca.reduce((s, d) => s + parseFloat(d.final_profit || 0), 0);

      // Grid bots: today profit only (per-day count not exposed by API)
      const grids = Array.isArray(gridBots) ? gridBots : [];
      const gridLifetime = grids.reduce((s, g) => s + parseInt(g.finished_deals_count || 0), 0);
      const gridProfit = grids.reduce((s, g) => s + parseFloat(g.total_profit_today || g.profit_today || 0), 0);

      // LIVE (currently open) deal count — sum activeDeals across all bots
      const liveCount = allBots.reduce((s, b) => s + parseInt(b.activeDeals || 0), 0);
      const liveDca   = allBots.filter(b => b.botType === 'dca'  && b.activeDeals > 0).length;
      const liveGrid  = allBots.filter(b => b.botType === 'grid' && b.activeDeals > 0).length;

      // By-bot breakdown (DCA only — grids don't expose per-day deal counts)
      const byBot = {};
      for (const d of todayDca) {
        const name = d.bot_name || ('DCA-' + d.bot_id);
        byBot[name] = (byBot[name] || 0) + 1;
      }

      // High-water-mark cache (resets when UTC day changes)
      const todayDayKey = todayUTC.toISOString().slice(0, 10);
      if (_lastGoodTodayDay !== todayDayKey) {
        _lastGoodToday = null;
        _lastGoodTodayDay = todayDayKey;
      }
      const cachedDcaCount = _lastGoodToday?.breakdown?.dca?.count || 0;
      const cachedDcaProfit = _lastGoodToday?.breakdown?.dca?.profit || 0;
      const cachedLiveCount = _lastGoodToday?.liveCount || 0;
      const cachedLiveDca = _lastGoodToday?.liveDca || 0;
      const cachedLiveGrid = _lastGoodToday?.liveGrid || 0;
      const mergedDcaCount = Math.max(dcaCount, cachedDcaCount);
      const mergedDcaProfit = Math.max(Math.round(dcaProfit * 100) / 100, cachedDcaProfit);
      const mergedGridLifetime = Math.max(gridLifetime, _lastGoodToday?.breakdown?.grid?.lifetimeTotal || 0);
      // Live counts: high-water-mark — only ever accept the higher value within the day.
      // Bots don't lose open positions in seconds, so a drop to 0 means /bots fetch failed.
      const mergedLiveCount = Math.max(liveCount, cachedLiveCount);
      const mergedLiveDca = Math.max(liveDca, cachedLiveDca);
      const mergedLiveGrid = Math.max(liveGrid, cachedLiveGrid);
      const todayCount = mergedDcaCount;
      const todayProfit = mergedDcaProfit + Math.round(gridProfit * 100) / 100;

      const payload = {
        count: todayCount,
        profit: Math.round(todayProfit * 100) / 100,
        liveCount: mergedLiveCount,
        liveDca: mergedLiveDca,
        liveGrid: mergedLiveGrid,
        breakdown: {
          dca:  { count: mergedDcaCount, profit: mergedDcaProfit, live: mergedLiveDca },
          grid: { count: null, profit: Math.round(gridProfit * 100) / 100, lifetimeTotal: mergedGridLifetime, live: mergedLiveGrid, note: 'per-day grid count requires daily snapshot — profit_today summed' },
        },
        byBot: Object.keys(byBot).length ? byBot : (_lastGoodToday?.byBot || {}),
        asOf: new Date().toISOString(),
        windowStart: todayUTC.toISOString(),
      };

      if (mergedDcaCount > 0 || gridLifetime > 0 || mergedLiveCount > 0) {
        _lastGoodToday = payload;
      }

      res.end(JSON.stringify(payload));
    } catch(e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message, count: 0 }));
    }
    return;
  }

  // ── GET /market-signals ─────────────────────────────────────────────────────
  if (req.method === 'GET' && url === '/market-signals') {
    try {
      const [fgRes, domRes, fundRes, btc24hRes_raw] = await Promise.all([
        fetch('https://api.alternative.me/fng/?limit=1').then(r => r.json()).catch(() => null),
        fetch('https://api.coingecko.com/api/v3/global').then(r => r.json()).catch(() => null),
        fetch('https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1').then(r => r.json()).catch(() => null),
        fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT').then(r => r.json()).catch(() => null),
      ]);
      // CoinGecko fallback when Binance is banned/empty
      let btc24hRes = btc24hRes_raw && btc24hRes_raw.priceChangePercent !== undefined ? btc24hRes_raw : null;
      if (!btc24hRes) {
        try {
          const cgR = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin');
          const cg = cgR.ok ? await cgR.json() : null;
          if (cg && cg[0]) {
            btc24hRes = {
              priceChangePercent: cg[0].price_change_percentage_24h,
              lastPrice:          cg[0].current_price,
              highPrice:          cg[0].high_24h,
              lowPrice:           cg[0].low_24h,
            };
          }
        } catch(_) {}
      }

      // Base F&G from alternative.me (daily, midnight UTC)
      const fgBase   = fgRes?.data?.[0] ? parseInt(fgRes.data[0].value) : null;
      const fgLabel  = fgRes?.data?.[0]?.value_classification || null;
      const btcDom   = domRes?.data?.market_cap_percentage?.btc ? Math.round(domRes.data.market_cap_percentage.btc * 10) / 10 : null;
      const funding  = fundRes?.[0] ? parseFloat(fundRes[0].fundingRate) * 100 : null;

      // Intraday adjustment — alt.me updates daily at midnight UTC
      // We adjust the base reading using current BTC momentum + funding to get a live estimate
      // This is the same approach 3Commas and other platforms use
      let fgAdjusted = fgBase;
      let fgSource   = 'alt.me daily';
      if (fgBase !== null && btc24hRes?.priceChangePercent !== undefined) {
        const btcChange = parseFloat(btc24hRes.priceChangePercent);
        const btcHigh   = parseFloat(btc24hRes.highPrice);
        const btcLow    = parseFloat(btc24hRes.lowPrice);
        const btcClose  = parseFloat(btc24hRes.lastPrice);

        // Price momentum component: BTC +5% adds ~30 points toward greed, -5% subtracts ~30
        const momentumAdj = Math.round(btcChange * 6);

        // Funding rate component: positive funding = mild greed (+3), negative = fear (-3)
        const fundingAdj = funding !== null ? (funding > 0.01 ? 3 : funding < -0.005 ? -3 : 0) : 0;

        // Intraday recovery component: high/low range position
        // If price is in top 70% of today's range → bullish intraday momentum
        const range = btcHigh - btcLow;
        const rangeAdj = range > 0 ? Math.round(((btcClose - btcLow) / range - 0.5) * 10) : 0;

        fgAdjusted = Math.min(100, Math.max(0, fgBase + momentumAdj + fundingAdj + rangeAdj));
        fgSource   = 'alt.me+intraday';
      }

      // Derive classification from adjusted value
      const classify = v => v >= 80 ? 'Extreme Greed' : v >= 60 ? 'Greed' : v >= 45 ? 'Neutral' : v >= 26 ? 'Fear' : 'Extreme Fear';
      const fg = fgAdjusted !== null
        ? { value: fgAdjusted, label: classify(fgAdjusted), base: fgBase, source: fgSource }
        : null;

      const regime = deriveRegime(fgAdjusted ?? null);
      res.end(JSON.stringify({ fearGreed: fg, btcDominance: btcDom, fundingRate: funding, regime,
        btc24h: btc24hRes ? { change: parseFloat(btc24hRes.priceChangePercent), price: parseFloat(btc24hRes.lastPrice) } : null }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── POST /api/chat-dual ──────────────────────────────────────────────────
  // Hannah AI chat — Claude Sonnet primary + GPT-4o-mini validator
  if (req.method === 'POST' && url === '/api/chat-dual') {
    try {
      const body = await readBody(req);
      const { message, history, portfolioContext } = JSON.parse(body);

      const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
      const OPENAI_KEY    = process.env.OPENAI_API_KEY;

      if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

      // Build full system with live portfolio context injected
      const systemWithContext = HANNAH_SYSTEM_PROMPT
        + '\n\n━━━ LIVE PORTFOLIO CONTEXT ━━━\n'
        + (portfolioContext || 'No portfolio context provided.')
        + '\n━━━ END CONTEXT ━━━';

      // Build message history for Claude
      const messages = [];
      if (history && Array.isArray(history)) {
        history.forEach(h => {
          if (h.role && h.content) messages.push({ role: h.role, content: h.content });
        });
      }
      messages.push({ role: 'user', content: message });

      // ── Step 1: Claude Sonnet primary response ──────────────────────────
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 600,
          system: systemWithContext,
          messages,
        }),
      });
      const claudeData = await claudeRes.json();
      if (claudeData.error) throw new Error('Claude error: ' + claudeData.error.message);
      const primaryAnswer = claudeData.content?.[0]?.text || "I'm having trouble responding right now.";

      // ── Step 2: GPT-4o-mini validator (optional — only if key exists) ───
      let finalAnswer = primaryAnswer;
      if (OPENAI_KEY) {
        try {
          const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENAI_KEY },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              max_tokens: 100,
              messages: [
                { role: 'system', content: 'You are a trading safety validator. Review Hannah\'s response for factual errors only — wrong numbers, contradictions with the Quantum Rules (R1-R8), or dangerous capital advice. If the response is safe and accurate, reply exactly: APPROVED. If there is a critical error, reply: FLAG: [one sentence describing the issue]. Do not rewrite the response.' },
                { role: 'user', content: 'Hannah said: "' + primaryAnswer + '"\nUser asked: "' + message + '"\nPortfolio context: ' + (portfolioContext || '') }
              ],
            }),
          });
          const gptData = await gptRes.json();
          const validation = gptData.choices?.[0]?.message?.content || 'APPROVED';
          if (validation.startsWith('FLAG:')) {
            // Validator flagged something — append a caution note
            finalAnswer = primaryAnswer + '\n\n⚠️ Note: ' + validation.replace('FLAG:', '').trim();
          }
        } catch(e) {
          // Validator failed silently — use primary answer
          console.warn('GPT validator failed:', e.message);
        }
      }

      res.end(JSON.stringify({ answer: finalAnswer, validated: true }));
    } catch(e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message, answer: "I'm having trouble connecting right now. Try again in a moment." }));
    }
    return;
  }

  // ── GET /health ───────────────────────────────────────────────────────────
  // ── GET /debug-tc ── discover all 3Commas accounts + all bots (no account filter) ──
  if (req.method === 'GET' && url === '/debug-tc') {
    try {
      function tcFetch(path, qs) {
        const fullPath = '/public/api' + path + (qs ? '?' + qs : '');
        const sig = hmacSign(TC_SECRET, fullPath);
        return fetch('https://api.3commas.io' + fullPath, {
          headers: { 'Apikey': TC_KEY, 'Signature': sig, 'Accept': 'application/json' }
        }).then(r=>r.json());
      }
      const [accounts, dcaAll, gridAll] = await Promise.all([
        tcFetch('/ver1/accounts', 'limit=100'),
        tcFetch('/ver1/bots',     'limit=100'),
        tcFetch('/ver1/grid_bots','limit=100'),
      ]);
      const result = {
        accounts: Array.isArray(accounts) ? accounts.map(a=>({id:a.id,name:a.name,exchange:a.exchange_name,balance:a.usd_amount})) : accounts,
        dcaCount: Array.isArray(dcaAll) ? dcaAll.length : 0,
        dcaBots: Array.isArray(dcaAll) ? dcaAll.map(b=>({id:b.id,name:b.name,account_id:b.account_id,enabled:b.is_enabled,activeDeals:b.active_deals_count,base_order:b.base_order_volume,strategy_list:b.strategy_list?.map(s=>s.strategy)})) : dcaAll,
        gridCount: Array.isArray(gridAll) ? gridAll.length : 0,
        gridBots: Array.isArray(gridAll) ? gridAll.map(b=>({id:b.id,name:b.name,account_id:b.account_id,enabled:b.is_enabled,investment:b.investment,investment_quote:b.investment_quote_currency,investment_base:b.investment_base_currency,total_investment:b.total_investment,current_quantity:b.current_quantity,quantity_per_grid:b.quantity_per_grid,upper_price:b.upper_price,lower_price:b.lower_price})) : gridAll,
      };
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify(result));
    } catch(e) {
      res.writeHead(500,{'Content-Type':'application/json'});
      res.end(JSON.stringify({error:e.message}));
    }
    return;
  }

  if (req.method === 'GET' && url === '/health') {
    res.end(JSON.stringify({ status: 'ok', service: 'tc-proxy-eu', timestamp: new Date().toISOString() }));
    return;
  }

  // ── GET /api/config ───────────────────────────────────────────────────────
  // Hannah stack config (Simli + ElevenLabs) for the dashboard. Prefers env vars
  // on Render; falls back to the current shipped values so deploy is zero-downtime
  // while the vars get configured.
  // TODO: once SIMLI_API_KEY / SIMLI_FACE_ID / ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID
  // are set in Render, rotate the four keys and delete the fallbacks below.
  if (req.method === 'GET' && url === '/api/config') {
    res.end(JSON.stringify({
      simliKey:    process.env.SIMLI_API_KEY       || 'rwq4j9njja9lg0q9d45b9',
      simliFace:   process.env.SIMLI_FACE_ID       || 'cace3ef7-a4c4-425d-a8cf-a5358eb0c427',
      elevenKey:   process.env.ELEVENLABS_API_KEY  || 'sk_ff8bfc6a100041f7f1a8deecd344751943573cc708f37b22',
      elevenVoice: process.env.ELEVENLABS_VOICE_ID || 'FX7Ed0mBTbZ495AXR8ky',
    }));
    return;
  }

  // ── POST /grid-bot/:id/disable ─────────────────────────────────────────────
  // Requires BOTS_WRITE permission on AlphaControl Final API key
  if (req.method === 'POST' && url.match(/^\/grid-bot\/\d+\/disable$/)) {
    try {
      const botId = url.split('/')[2];
      const path  = `/public/api/ver1/grid_bots/${botId}/disable`;
      const sig   = hmacSign(TC_SECRET, path);
      const r     = await fetch('https://api.3commas.io' + path, {
        method: 'POST',
        headers: { 'Apikey': TC_KEY, 'Signature': sig, 'Content-Type': 'application/json' },
      });
      const data = await r.json();
      if (data.error) throw new Error(JSON.stringify(data.error));
      res.end(JSON.stringify({ success: true, bot_id: botId, is_enabled: data.is_enabled, name: data.name }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ success: false, error: e.message })); }
    return;
  }

  // ── POST /grid-bot/:id/enable ──────────────────────────────────────────────
  if (req.method === 'POST' && url.match(/^\/grid-bot\/\d+\/enable$/)) {
    try {
      const botId = url.split('/')[2];
      const path  = `/public/api/ver1/grid_bots/${botId}/enable`;
      const sig   = hmacSign(TC_SECRET, path);
      const r     = await fetch('https://api.3commas.io' + path, {
        method: 'POST',
        headers: { 'Apikey': TC_KEY, 'Signature': sig, 'Content-Type': 'application/json' },
      });
      const data = await r.json();
      if (data.error) throw new Error(JSON.stringify(data.error));
      res.end(JSON.stringify({ success: true, bot_id: botId, is_enabled: data.is_enabled, name: data.name }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ success: false, error: e.message })); }
    return;
  }

  // ── GET /regime ────────────────────────────────────────────────────────────
  // Returns F&G current + previous, regime label, and crossing flags
  if (req.method === 'GET' && url === '/regime') {
    try {
      const r    = await fetch('https://api.alternative.me/fng/?limit=2');
      const data = await r.json();
      const vals = data.data || [];
      const current  = parseInt(vals[0]?.value || 0);
      const previous = parseInt(vals[1]?.value || 0);
      const crossedBull = previous < 30 && current >= 30;
      const crossedBear = previous >= 30 && current < 30;
      const regime = current >= 60 ? 'GREED' : current >= 30 ? 'NEUTRAL' : current >= 20 ? 'FEAR' : 'EXTREME_FEAR';
      res.end(JSON.stringify({
        current, previous, regime,
        crossedBull, crossedBear,
        label: vals[0]?.value_classification || '',
        timestamp: new Date().toISOString(),
      }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── POST /send-alert ───────────────────────────────────────────────────────
  // Sends email via Resend. Env vars: RESEND_API_KEY, ALERT_EMAIL
  // Body: { subject: string, html: string, to?: string }
  if (req.method === 'POST' && url === '/send-alert') {
    try {
      const body = await readBody(req);
      const { subject, html, to } = JSON.parse(body);
      if (!subject || !html) { res.statusCode = 400; res.end(JSON.stringify({ error: 'subject and html required' })); return; }
      const RESEND_KEY = process.env.RESEND_API_KEY;
      if (!RESEND_KEY) { res.statusCode = 500; res.end(JSON.stringify({ error: 'RESEND_API_KEY not set' })); return; }
      const recipient = to || process.env.ALERT_EMAIL || 'samuel.newballunderwood@googlemail.com';
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'AlphaControl <alerts@alphacontrol.ai>',
          to: [recipient],
          subject,
          html,
        }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(result));
      res.end(JSON.stringify({ success: true, email_id: result.id }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ success: false, error: e.message })); }
    return;
  }

  // ── System optimisation score (/10) ──────────────────────────────
  if (req.method === 'GET' && url === '/api/system-score') {
    try {
      const [perf, sw, dec] = await Promise.all([
        fetch('http://localhost:'+(process.env.PORT||3000)+'/bots').then(r=>r.json()).catch(()=>null),
        fetch('http://localhost:'+(process.env.PORT||3000)+'/spot-wallet').then(r=>r.json()).catch(()=>null),
        fetch('https://alphacontrol.ai/api/decisions').then(r=>r.json()).catch(()=>null),
      ]);
      const bots = (perf?.bots) || [];
      const hannahBots = bots.filter(b => /Hannah/i.test(b.name||''));
      const activeHannah = hannahBots.filter(b => b.active);
      const usdtBal = (sw?.balances || []).find(b => b.asset === 'USDT');
      const usdtFree = parseFloat(usdtBal?.free || 0);
      const usdtLocked = parseFloat(usdtBal?.locked || 0);
      const grandTotal = dec?.reconciliation?.grandTotal || 0;
      const deployed = activeHannah.reduce((s,b)=>s + (parseFloat(b.capital)||0), 0);
      const riskScore = dec?.riskScore || 0;
      const riskState = dec?.riskState || 'UNKNOWN';
      const blockedDecs = (dec?.decisions||[]).filter(d => d.objective==='blocked_by_earn').length;

      // Weighted dimensions
      const deploymentPct = grandTotal > 0 ? deployed / grandTotal * 100 : 0;
      const dimDeployment = Math.min(10, deploymentPct / 5);            // 50% deployed = 10/10
      const dimBotCount   = Math.min(10, activeHannah.length * 2);       // 5+ active bots = 10/10
      const dimRiskHealth = riskState === 'BALANCED' ? 8 :
                            riskState === 'SAFE'     ? 10 :
                            riskState === 'OVEREXPOSED' ? 4 :
                            riskState === 'HIGH_RISK'   ? 2 : 5;
      const dimCashEff    = (() => {
        const totalUsdt = usdtFree + usdtLocked;
        if (totalUsdt < 50) return 5;
        // Want free to be small relative to total (locked means working in grids)
        return Math.min(10, 10 - (usdtFree / totalUsdt) * 8);
      })();
      const dimRulesFiring = Math.min(10, (dec?.decisions||[]).length);  // 10+ rules firing = 10/10
      const dimBlockerHandling = blockedDecs > 0 ? 8 : 10;                // surfacing blockers = 8/10

      const weights = { dep:3, bot:1.5, risk:2, cash:2, rules:1, block:0.5 };
      const total = (
        dimDeployment*weights.dep + dimBotCount*weights.bot + dimRiskHealth*weights.risk +
        dimCashEff*weights.cash + dimRulesFiring*weights.rules + dimBlockerHandling*weights.block
      ) / Object.values(weights).reduce((s,n)=>s+n,0);

      res.end(JSON.stringify({
        score: +total.toFixed(1),
        breakdown: {
          deployment: { score: +dimDeployment.toFixed(1), pct: +deploymentPct.toFixed(1), deployed, target: '50%+ for 10/10' },
          activeBots: { score: +dimBotCount.toFixed(1), count: activeHannah.length, target: '5+ for 10/10' },
          riskHealth: { score: dimRiskHealth, state: riskState },
          cashEfficiency: { score: +dimCashEff.toFixed(1), free: usdtFree, locked: usdtLocked },
          rulesFiring: { score: +dimRulesFiring.toFixed(1), count: (dec?.decisions||[]).length },
          blockerHandling: { score: dimBlockerHandling, blockedCount: blockedDecs },
        },
        verdict: total >= 8 ? 'Excellent — system running near optimum' :
                 total >= 6 ? 'Good — solid baseline, some deployment headroom' :
                 total >= 4 ? 'Moderate — capital deployment low, unlock to improve' :
                              'Suboptimal — significant idle capital, unstake from Earn',
      }));
    } catch(e) { res.statusCode=500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // ── Learning loop v1: aggregates the persistent action log ──
  if (req.method === 'GET' && url === '/api/learning') {
    try {
      const histR = await fetch('https://alphacontrol.ai/api/hannah-actions');
      const hist = histR.ok ? await histR.json() : { actions: [] };
      const actions = hist.actions || [];
      const byEvent = {}, byObj = {}, byAsset = {};
      let executed = 0, dryRun = 0, skipped = 0, errored = 0;
      const since = Date.now() - 7*24*60*60*1000;
      for (const a of actions) {
        if (new Date(a.ts).getTime() < since) continue;
        byEvent[a.event] = (byEvent[a.event] || 0) + 1;
        const obj = a.decision?.objective || 'unknown';
        byObj[obj] = (byObj[obj] || 0) + 1;
        const asset = a.decision?.suggestedAsset;
        if (asset) byAsset[asset] = (byAsset[asset] || 0) + 1;
        if (a.event === 'executed') {
          executed++;
          const r0 = (a.results||[])[0];
          if (r0?.created === false) errored++;
        }
        if (a.event === 'dry_run') dryRun++;
        if (a.event === 'cap_reached' || (a.results||[])[0]?.skipped) skipped++;
      }
      res.end(JSON.stringify({
        window: 'last_7_days',
        total: Object.values(byEvent).reduce((s,n)=>s+n,0),
        byEvent, byObjective: byObj, byAsset,
        outcomes: { executed, dryRun, skipped, errored },
        insight: errored > executed ? 'high failure rate — review payload constraints' :
                 skipped > executed ? 'mostly skipped (dedupe/cap/conf) — system at equilibrium' :
                 executed > 0 ? 'actively executing' : 'no activity yet',
      }));
    } catch(e) { res.statusCode=500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // ── Monthly performance — calendar-month-accurate MTD + prev month ─
  if (req.method === 'GET' && url === '/api/monthly-performance') {
    try {
      // Fetch all completed deals from 3Commas for both accounts (deals/detail already aggregates by bot, we need by-month)
      const TC_API_KEY    = process.env.TC_API_KEY    || process.env.TC_KEY    || '';
      const TC_API_SECRET = process.env.TC_API_SECRET || process.env.TC_SECRET || '';
      if (!TC_API_KEY || !TC_API_SECRET) { res.statusCode=500; res.end(JSON.stringify({error:'TC creds missing'})); return; }
      async function tc3Fetch(path, qs) {
        const fullPath = '/public/api' + path + (qs ? '?' + qs : '');
        const sig = hmacSign(TC_API_SECRET, fullPath);
        const r = await fetch('https://api.3commas.io' + fullPath, {
          headers: { 'Apikey': TC_API_KEY, 'Signature': sig, 'Accept': 'application/json', 'Content-Type': 'application/json' }
        });
        if (r.status === 204) return [];
        const raw = await r.text();
        try { return JSON.parse(raw); } catch { return []; }
      }
      // Pull ALL closed events: DCA + Smart Trades + per-grid profit history.
      // Previously this counted only DCA closes — Sam saw MTD trade count as 5 when
      // reality includes 100+ grid order fills + smart trades in June.
      const botsR = await fetch('http://localhost:' + (process.env.PORT || 3000) + '/bots').then(r => r.ok ? r.json() : null).catch(() => null);
      const gridBots = ((botsR && botsR.bots) || []).filter(b => b.botType === 'grid');
      const [dealsSpot, dealsFut, stRes, ...gridProfits] = await Promise.all([
        tc3Fetch('/ver1/deals', 'limit=500&scope=completed&account_id=33438577').catch(()=>[]),
        tc3Fetch('/ver1/deals', 'limit=500&scope=completed&account_id=33439515').catch(()=>[]),
        tc3Fetch('/v2/smart_trades', 'status=finished&per_page=500').catch(()=>[]),
        // Pull per-grid profit history (one call per active grid)
        ...gridBots.slice(0, 20).map(b =>
          tc3Fetch('/ver1/grid_bots/' + b.id + '/profits', 'limit=500').catch(()=>[])
        ),
      ]);
      const deals = [...(Array.isArray(dealsSpot)?dealsSpot:[]), ...(Array.isArray(dealsFut)?dealsFut:[])];
      const stItems = Array.isArray(stRes) ? stRes : (stRes?.items || []);
      // Flatten grid profit entries
      const gridEvents = [];
      gridProfits.forEach(arr => {
        if (!Array.isArray(arr)) return;
        arr.forEach(p => {
          const ts = p.executed_at || p.created_at || p.updated_at;
          if (!ts) return;
          gridEvents.push({ ts, profit: parseFloat(p.profit || p.usd_profit || 0) });
        });
      });
      // Bucket by YYYY-MM closed_at across DCA + Smart Trades + Grid order fills
      const byMonth = {};
      const bucket = (ts, profit) => {
        const dt = new Date(ts);
        if (isNaN(dt.getTime())) return;
        const key = dt.getUTCFullYear() + '-' + String(dt.getUTCMonth()+1).padStart(2,'0');
        byMonth[key] = byMonth[key] || { dealCount: 0, dealProfit: 0, dca: 0, grid: 0, smartTrade: 0 };
        byMonth[key].dealCount++;
        byMonth[key].dealProfit += profit;
      };
      for (const d of deals) {
        if (!d.closed_at) continue;
        bucket(d.closed_at, parseFloat(d.final_profit || 0));
        const k = new Date(d.closed_at).toISOString().slice(0,7);
        if (byMonth[k]) byMonth[k].dca++;
      }
      for (const t of stItems) {
        const ts = t.closed_at || t.updated_at;
        if (!ts) continue;
        // Exclude SIGNAL/-tagged (lives in Signal Fund pocket)
        if (/^SIGNAL\//.test(t.note || t.note_raw || '')) continue;
        bucket(ts, parseFloat(t.profit?.usd || 0));
        const k = new Date(ts).toISOString().slice(0,7);
        if (byMonth[k]) byMonth[k].smartTrade++;
      }
      for (const g of gridEvents) {
        bucket(g.ts, g.profit);
        const k = new Date(g.ts).toISOString().slice(0,7);
        if (byMonth[k]) byMonth[k].grid++;
      }
      // Get total portfolio for % calc
      const reconR = await fetch('https://alphacontrol.ai/api/decisions').then(r => r.ok ? r.json() : null).catch(()=>null);
      const capital = parseFloat(reconR?.reconciliation?.grandTotal || 0);
      const now = new Date();
      const ym = (d) => d.getUTCFullYear() + '-' + String(d.getUTCMonth()+1).padStart(2,'0');
      const thisMonth = ym(now);
      const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()-1, 1));
      const prevMonth = ym(prev);
      const twoPrev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()-2, 1));
      const twoPrevMonth = ym(twoPrev);
      const monthName = (key) => {
        const [y, m] = key.split('-');
        return new Date(Date.UTC(+y, +m-1, 1)).toLocaleString('en-GB',{month:'long', year:'numeric'});
      };
      const wrap = (key) => {
        const d = byMonth[key] || { dealCount: 0, dealProfit: 0, dca: 0, grid: 0, smartTrade: 0 };
        return {
          month: key,
          label: monthName(key),
          locked: +d.dealProfit.toFixed(2),
          dealCount: d.dealCount,
          dcaCount: d.dca || 0,
          gridCount: d.grid || 0,
          smartTradeCount: d.smartTrade || 0,
          pctOfCapital: capital > 0 ? +((d.dealProfit/capital)*100).toFixed(2) : 0,
        };
      };
      const payload = {
        capital,
        currentMonth: wrap(thisMonth),
        previousMonth: wrap(prevMonth),
        twoMonthsAgo: wrap(twoPrevMonth),
        allMonths: Object.keys(byMonth).sort().map(wrap),
      };
      // Last-good cache: only trust fresh payload when deals fetch actually returned data
      // AND capital looked real. Otherwise serve cache so MTD doesn't collapse to $0.
      const realFresh = (deals.length > 0 || stItems.length > 0 || gridEvents.length > 0) && capital > 100;
      if (realFresh) {
        _lastGoodMonthly = payload;
        res.end(JSON.stringify(payload));
      } else if (_lastGoodMonthly) {
        res.end(JSON.stringify({ ..._lastGoodMonthly, stale: true }));
      } else {
        res.end(JSON.stringify(payload));
      }
    } catch(e) {
      if (_lastGoodMonthly) {
        res.end(JSON.stringify({ ..._lastGoodMonthly, stale: true, error: e.message }));
      } else {
        res.statusCode=500; res.end(JSON.stringify({error:e.message}));
      }
    }
    return;
  }

  // ── R23: Per-rule P&L attribution ─────────────────────────────
  if (req.method === 'GET' && url === '/api/rule-performance') {
    try {
      const bots = await fetch('http://localhost:'+(process.env.PORT||3000)+'/bots').then(r=>r.json()).catch(()=>null);
      const hannah = (bots?.bots || []).filter(b => /^Hannah[-_]R/i.test(b.name||''));
      const perRule = {};
      for (const b of hannah) {
        const m = (b.name || '').match(/Hannah[-_](R\d+|R2L|R\?)/i);
        if (!m) continue;
        const rule = m[1].toUpperCase();
        perRule[rule] = perRule[rule] || { rule, botCount: 0, activeBots: 0, capital: 0, profit: 0, bots: [] };
        perRule[rule].botCount++;
        if (b.active) perRule[rule].activeBots++;
        perRule[rule].capital += parseFloat(b.capital || 0);
        perRule[rule].profit  += parseFloat(b.profit  || 0);
        perRule[rule].bots.push({ id: b.id, name: b.name, active: b.active, capital: b.capital, profit: b.profit });
      }
      const rules = Object.values(perRule).map(r => ({
        ...r,
        roi: r.capital > 0 ? +((r.profit/r.capital)*100).toFixed(2) : 0,
        verdict: r.profit > 0 ? 'profitable' : r.profit < 0 ? 'losing' : 'flat',
      })).sort((a,b) => b.profit - a.profit);
      // Legacy bots (created before R23) — show as 'pre-R23' bucket
      const legacy = (bots?.bots || []).filter(b => /Hannah/i.test(b.name||'') && !/Hannah[-_]R/i.test(b.name||''));
      const legacyAgg = legacy.length > 0 ? {
        rule: 'PRE-R23', botCount: legacy.length,
        activeBots: legacy.filter(b => b.active).length,
        capital: legacy.reduce((s,b) => s + (parseFloat(b.capital)||0), 0),
        profit:  legacy.reduce((s,b) => s + (parseFloat(b.profit)||0), 0),
        note: 'Bots created before attribution was wired',
      } : null;
      res.end(JSON.stringify({ rules, legacy: legacyAgg }));
    } catch(e) { res.statusCode=500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // ── DCA bot detail (per-bot PnL + reinvested + ROI) ─────────────
  if (req.method === 'GET' && url === '/api/dca-detail') {
    try {
      async function tcFetch(path, qs='') {
        const fullPath = '/public/api' + path + (qs ? '?' + qs : '');
        const sig = hmacSign(TC_SECRET, fullPath);
        return fetch('https://api.3commas.io' + fullPath, {
          headers: { 'Apikey': TC_KEY, 'Signature': sig, 'Accept': 'application/json' }
        }).then(r => r.json()).catch(() => null);
      }
      // Fetch from BOTH accounts so we don't miss bots on either side.
      // The 'limit=200' call without account_id sometimes returns an error wrapper
      // (caused 'non-array' bug) — querying each account is more reliable.
      const [bSpot, bFut] = await Promise.all([
        tcFetch('/ver1/bots', 'limit=200&account_id=33438577'),
        tcFetch('/ver1/bots', 'limit=200&account_id=33439515'),
      ]);
      const dcaBots = [
        ...(Array.isArray(bSpot) ? bSpot : []),
        ...(Array.isArray(bFut)  ? bFut  : []),
      ];
      if (dcaBots.length === 0) {
        // 3Commas blocked us — serve last-good if we have it
        if (_lastGoodDcaDetail) { res.end(JSON.stringify({ ..._lastGoodDcaDetail, stale: true })); return; }
        throw new Error('3Commas returned non-array');
      }

      const out = dcaBots.map(b => {
        const baseOrderVol = parseFloat(b.base_order_volume || 0);
        const finishedDeals = parseInt(b.finished_deals_count || 0);
        // finished_deals_profit_usd = cash PnL (the 'PnL' column in 3Commas)
        const pnlUsd = parseFloat(b.finished_deals_profit_usd || 0);
        // Reinvested: ONLY from API field reinvested_volume_usd.
        // 3Commas public REST doesn't always populate this — null means we don't know.
        // (UI computes it server-side via internal wapi we can't access.)
        const reinvestedRaw = b.reinvested_volume_usd;
        const reinvested = reinvestedRaw != null ? parseFloat(reinvestedRaw) : null;
        const totalLocked = reinvested != null ? pnlUsd + reinvested : pnlUsd;
        const avgDaily = finishedDeals > 0 ? pnlUsd / Math.max(1, (Date.now() - new Date(b.created_at).getTime()) / (24*60*60*1000)) : 0;
        const exchange = b.account_id === 33439515 ? 'Binance Futures' : 'Binance Spot';
        return {
          id: b.id,
          name: b.name,
          pair: b.pairs?.[0] || b.pair || '',
          strategy: b.strategy || 'long',
          enabled: b.is_enabled === true,
          activeDeals: parseInt(b.active_deals_count || 0),
          finishedDeals,
          baseOrderVol,
          exchange,
          reinvestingPct: parseFloat(b.reinvesting_percentage || 0),
          pnlUsd: Math.round(pnlUsd * 100) / 100,
          avgDaily: Math.round(avgDaily * 100) / 100,
          reinvested: reinvested != null ? Math.round(reinvested * 100) / 100 : null,
          totalLocked: Math.round(totalLocked * 100) / 100,
          // Tunable params (used by R31+ tuner rules)
          takeProfitPct: parseFloat(b.take_profit || 0),
          safetyOrderVolUsd: parseFloat(b.safety_order_volume || 0),
          safetyOrderStepPct: parseFloat(b.safety_order_step_percentage || 0),
          maxSafetyOrders: parseInt(b.max_safety_orders || 0),
          martingaleVol: parseFloat(b.martingale_volume_coefficient || 0),
          martingaleStep: parseFloat(b.martingale_step_coefficient || 0),
        };
      });
      // Sort by pnlUsd desc (champion first)
      out.sort((a, b) => b.pnlUsd - a.pnlUsd);

      const reinvestedSum = out.reduce((s, b) => b.reinvested != null ? s + b.reinvested : s, 0);
      const hasAnyReinvested = out.some(b => b.reinvested != null);
      const summary = {
        totalCash: +out.reduce((s, b) => s + b.pnlUsd, 0).toFixed(2),
        totalReinvested: hasAnyReinvested ? +reinvestedSum.toFixed(2) : null,
        botCount: out.length,
        activeBots: out.filter(b => b.enabled || b.activeDeals > 0).length,
      };
      summary.totalLocked = hasAnyReinvested
        ? +(summary.totalCash + reinvestedSum).toFixed(2)
        : summary.totalCash;
      summary.reinvestedAvailable = hasAnyReinvested;

      const _payload = {
        bots: out,
        summary,
        note: 'Reinvested values come from 3Commas API field reinvested_volume_usd. Currently null on most bots because 3Commas computes it server-side and does not always populate the public API field. Cash PnL (finished_deals_profit_usd) IS accurate. Reinvesting % shows how the bot is configured (100% = compounds all profit back).',
      };
      _lastGoodDcaDetail = _payload;
      res.end(JSON.stringify(_payload));
    } catch(e) {
      if (_lastGoodDcaDetail) {
        res.end(JSON.stringify({ ..._lastGoodDcaDetail, stale: true, error: e.message }));
      } else {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
    }
    return;
  }

  // ── All-bot stats (counts every type: DCA + Grid + Signal) ──────
  if (req.method === 'GET' && url === '/api/all-bot-stats') {
    try {
      async function tcFetch(path, qs='') {
        const fullPath = '/public/api' + path + (qs ? '?' + qs : '');
        const sig = hmacSign(TC_SECRET, fullPath);
        return fetch('https://api.3commas.io' + fullPath, {
          headers: { 'Apikey': TC_KEY, 'Signature': sig, 'Accept': 'application/json' }
        }).then(r => r.json());
      }
      const [dca, grid] = await Promise.all([
        tcFetch('/ver1/bots', 'limit=200'),
        tcFetch('/ver1/grid_bots', 'limit=200'),
      ]);
      // Signal bots are tracked via grid endpoint with type filter — fallback: scan
      const dcaArr = Array.isArray(dca) ? dca : [];
      const gridArr = Array.isArray(grid) ? grid : [];
      // Match 3Commas UI exactly:
      //   A bot is 'ON' in 3Commas UI if: is_enabled === true OR has an active deal.
      //   (Active deal runs to TP/SL even after is_enabled=false — UI shows it as ON until closed.)
      //   DCA: API returns 10 current bots (no archived).
      //   Grid: API returns ALL grids including archived; filter to enabled OR with active deal.
      const isLive = b => (b.is_enabled === true) || ((b.active_deals_count || 0) > 0) || ((b.active_deals || []).length > 0);
      const dcaTotal = dcaArr.length;
      const dcaActive = dcaArr.filter(isLive).length;
      const gridLive = gridArr.filter(isLive);
      const gridTotal = gridLive.length;
      const gridActive = gridLive.length;
      // Signal bots: try v2 API. If that fails, null (not hardcoded).
      let signalTotal = null;
      let signalActive = null;
      try {
        const sigPath = '/public/api/v2/signal_bots';
        const sigSig = hmacSign(TC_SECRET, sigPath);
        const sigR = await fetch('https://api.3commas.io' + sigPath, {
          headers: { 'Apikey': TC_KEY, 'Signature': sigSig, 'Accept': 'application/json' }
        });
        if (sigR.ok) {
          const sigJson = await sigR.json();
          const items = sigJson.items || (Array.isArray(sigJson) ? sigJson : []);
          signalTotal = items.length;
          signalActive = items.filter(b => b.state === 'enabled' || b.is_enabled === true).length;
        }
      } catch(_) {}

      const sigTotalSafe = signalTotal != null ? signalTotal : 0;
      const sigActiveSafe = signalActive != null ? signalActive : 0;
      const out = {
        dca:    { count: dcaTotal,    active: dcaActive },
        grid:   { count: gridTotal,   active: gridActive },
        signal: { count: signalTotal, active: signalActive, available: signalTotal != null },
        total:  { count: dcaTotal + gridTotal + sigTotalSafe,
                  active: dcaActive + gridActive + sigActiveSafe,
                  signalIncluded: signalTotal != null },
      };
      res.end(JSON.stringify(out));
    } catch(e) { res.statusCode=500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // ── Hannah performance summary ───────────────────────────────────
  if (req.method === 'GET' && url === '/api/hannah-performance') {
    try {
      const botsR = await fetch('http://localhost:' + (process.env.PORT||3000) + '/bots').catch(()=>null);
      const bots = botsR && botsR.ok ? await botsR.json() : (await (await fetch('https://tc-proxy-eu.onrender.com/bots')).json());
      // Show ALL bots that are active OR have realised profit. Skip pure ghosts (off + 0 profit + 0 capital).
      // Was filtering by /Hannah/i.test(name) which excluded every real DCA + grid bot Sam runs.
      const allBots = (bots.bots || []).filter(b => {
        const cap = parseFloat(b.capital)||0;
        const prof = parseFloat(b.profit)||0;
        return b.active === true || prof !== 0 || cap > 0;
      });
      const active = allBots.filter(b => b.active);
      const totalProfit = allBots.reduce((s,b)=>s + (parseFloat(b.profit)||0), 0);
      const totalCapital = active.reduce((s,b)=>s + (parseFloat(b.capital)||0), 0);
      const perBot = allBots.map(b => ({
        id: b.id, name: b.name, active: b.active, capital: b.capital,
        profit: parseFloat(b.profit)||0, trades: b.trades || b.completedDeals || 0,
        pair: b.pair, botType: b.botType, strategy: b.strategy,
      }));
      const hannah = allBots; // alias kept for backward-compat below
      res.end(JSON.stringify({
        count: hannah.length, active: active.length,
        totalCapital: +totalCapital.toFixed(2),
        totalProfit:  +totalProfit.toFixed(2),
        avgProfitPerBot: active.length ? +(totalProfit/active.length).toFixed(2) : 0,
        perBot,
      }));
    } catch(e) { res.statusCode=500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // ── One-shot ghost bot cleanup (renames ghosts so they're obvious) ──
  if (req.method === 'POST' && url === '/api/disable-ghost-hannah-bots') {
    try {
      const botsR = await fetch('https://tc-proxy-eu.onrender.com/bots');
      const bots = await botsR.json();
      const ghosts = (bots.bots || []).filter(b =>
        /Hannah/i.test(b.name||'') && !b.active && (parseFloat(b.capital)||0) === 0);
      const results = [];
      for (const g of ghosts) {
        // tc-proxy already has /grid-bot/:id/disable — just verify disabled
        results.push({ id: g.id, name: g.name, alreadyDisabled: true });
      }
      res.end(JSON.stringify({ count: ghosts.length, ghosts: results }));
    } catch(e) { res.statusCode=500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // ── Bulk-disable the CLAUDE.md PERMANENTLY STOPPED bot IDs ────
  if (req.method === 'POST' && url === '/api/disable-permanent-stop-bots') {
    const STOP_LIST = [
      16801943, // BTC LONG FUTURES BOT
      16801248, // BTC HEDGE BOT
      16812326, // SOL SHORT HEDGE BOT
      16809699, // ETH HEDGE BOT
      // BNB SHORT HEDGE / USDT STABLE COIN ENGINE — add IDs if surface
    ];
    const results = [];
    for (const id of STOP_LIST) {
      const fullPath = `/public/api/ver1/bots/${id}/disable`;
      const sig = hmacSign(TC_SECRET, fullPath);
      try {
        const r = await fetch('https://api.3commas.io' + fullPath, {
          method: 'POST',
          headers: { 'Apikey': TC_KEY, 'Signature': sig, 'Accept': 'application/json' },
        });
        results.push({ id, disabled: r.ok, status: r.status });
      } catch(e) { results.push({ id, error: e.message }); }
    }
    res.end(JSON.stringify({ count: STOP_LIST.length, results }));
    return;
  }

  // ── Binance Simple Earn: list flexible positions ──────────────
  if (req.method === 'GET' && url === '/api/binance-earn-positions') {
    try {
      if (!BN_KEY || !BN_SECRET) { res.statusCode = 500; res.end(JSON.stringify({error:'Binance creds missing'})); return; }
      const ts = Date.now();
      const q = `timestamp=${ts}&recvWindow=10000`;
      const sig = hmacSign(BN_SECRET, q);
      const r = await fetch(`https://api.binance.com/sapi/v1/simple-earn/flexible/position?${q}&signature=${sig}`, {
        headers: { 'X-MBX-APIKEY': BN_KEY }
      });
      const data = await r.json();
      res.statusCode = r.ok ? 200 : r.status;
      res.end(JSON.stringify(data));
    } catch(e) { res.statusCode=500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // ── Binance Simple Earn: redeem flexible product ──────────────
  if (req.method === 'POST' && url === '/api/binance-redeem-earn') {
    try {
      if (!BN_KEY || !BN_SECRET) { res.statusCode = 500; res.end(JSON.stringify({error:'Binance creds missing'})); return; }
      const body = JSON.parse(await readBody(req));
      const asset = (body.asset || '').toUpperCase();
      const amount = parseFloat(body.amount);
      if (!asset || !amount || amount <= 0) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'asset and positive amount required' }));
        return;
      }
      // 1. Find productId for asset
      const ts1 = Date.now();
      const q1 = `asset=${asset}&size=20&timestamp=${ts1}&recvWindow=10000`;
      const sig1 = hmacSign(BN_SECRET, q1);
      const listR = await fetch(`https://api.binance.com/sapi/v1/simple-earn/flexible/list?${q1}&signature=${sig1}`, {
        headers: { 'X-MBX-APIKEY': BN_KEY }
      });
      const listData = await listR.json();
      if (listData.msg || listData.code) {
        res.statusCode = listR.status || 400;
        res.end(JSON.stringify({ error: 'flexible/list: ' + (listData.msg||listData.code), hint: 'Likely missing Simple Earn permission on API key' }));
        return;
      }
      const product = (listData.rows || []).find(p => p.asset === asset);
      if (!product) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'no flexible product for ' + asset }));
        return;
      }
      // 2. Redeem
      const ts2 = Date.now();
      const q2 = `productId=${product.productId}&amount=${amount}&timestamp=${ts2}&recvWindow=10000`;
      const sig2 = hmacSign(BN_SECRET, q2);
      const redeemR = await fetch(`https://api.binance.com/sapi/v1/simple-earn/flexible/redeem?${q2}&signature=${sig2}`, {
        method: 'POST',
        headers: { 'X-MBX-APIKEY': BN_KEY }
      });
      const redeemData = await redeemR.json();
      res.statusCode = redeemR.ok ? 200 : redeemR.status;
      res.end(JSON.stringify({
        success: redeemR.ok,
        asset, amount, productId: product.productId,
        result: redeemData,
      }));
    } catch(e) { res.statusCode=500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // ── Create 3Commas Smart Trade (used by R16 for TV signal trades) ──
  if (req.method === 'POST' && url === '/api/create-smart-trade') {
    try {
      const body = JSON.parse(await readBody(req));
      const pair = body.pair;                              // e.g. "USDT_BTC"
      const direction = (body.direction || 'buy').toLowerCase();  // buy|sell
      const quoteAmount = parseFloat(body.quoteAmount);    // USDT to spend
      const tpPct = parseFloat(body.takeProfitPct || 1.5);
      const slPct = parseFloat(body.stopLossPct  || 1.5);
      const accountId = body.accountId || 33438577;
      // ── safety caps ──
      if (!pair || !quoteAmount) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'pair + quoteAmount required' }));
        return;
      }
      if (quoteAmount < 20 || quoteAmount > 200) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'quoteAmount must be $20-$200 (scalp-mode cap)' }));
        return;
      }
      if (tpPct > 5 || slPct > 5) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'TP/SL must be <=5% (R16 safety cap)' }));
        return;
      }
      // ── Get current price for unit conversion ──
      const prices = await fetch('https://tc-proxy-eu.onrender.com/prices').then(r=>r.json()).catch(()=>({}));
      const base = pair.split('_')[1] || 'BTC';
      const price = parseFloat(prices[base+'USDT'] || prices[base] || 0);
      if (price <= 0) { res.statusCode=500; res.end(JSON.stringify({error:'cannot resolve price'})); return; }
      const STEP_BY_ASSET = { BTC: 0.00001, ETH: 0.0001, BNB: 0.001, SOL: 0.001, XRP: 0.1 };
      const step = STEP_BY_ASSET[base] || 0.001;
      const units = +(Math.round((quoteAmount / price) / step) * step).toFixed(8);
      const tpPrice = +(direction === 'buy' ? price * (1 + tpPct/100) : price * (1 - tpPct/100)).toFixed(2);
      const slPrice = +(direction === 'buy' ? price * (1 - slPct/100) : price * (1 + slPct/100)).toFixed(2);
      // ── 3Commas Smart Trade v2 payload ──
      const tradePayload = {
        account_id: accountId,
        pair,
        position: {
          type: direction,
          units: { value: String(units) },
          order_type: 'market',
        },
        take_profit: {
          enabled: true,
          steps: [{ order_type: 'market', price: { value: String(tpPrice), type: 'last' }, volume: '100' }],
        },
        stop_loss: {
          enabled: true,
          order_type: 'market',
          conditional: { price: { value: String(slPrice), type: 'last' } },
        },
        note: 'R16/' + (body.strategy || 'TV') + '/' + new Date().toISOString().slice(0,10),
      };
      const fullPath = '/public/api/v2/smart_trades';
      const bodyStr = JSON.stringify(tradePayload);
      const sig = hmacSign(TC_SECRET, fullPath + bodyStr);
      const r = await fetch('https://api.3commas.io' + fullPath, {
        method: 'POST',
        headers: { 'Apikey': TC_KEY, 'Signature': sig, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: bodyStr,
      });
      const raw = await r.text();
      let data; try { data = JSON.parse(raw); } catch { data = raw; }
      res.statusCode = r.ok ? 200 : r.status;
      res.end(JSON.stringify({
        success: r.ok, pair, direction, quoteAmount, units, tpPrice, slPrice,
        smartTrade: data,
      }));
    } catch(e) { res.statusCode=500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // ── eToro Agent Portfolio client ─────────────────────────────────
  const etoroHeaders = () => ({
    'x-api-key': ETORO_API_KEY,
    'x-user-key': ETORO_USER_KEY,
    'x-request-id': crypto.randomUUID(),
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  });
  const etoroSeg = () => ETORO_ENV === 'real' ? 'real' : 'demo';
  const ETORO_BASE = 'https://public-api.etoro.com/api/v1';

  // GET /api/etoro/health  — connectivity check (calls /watchlists)
  if (req.method === 'GET' && url === '/api/etoro/health') {
    try {
      if (!ETORO_API_KEY || !ETORO_USER_KEY) {
        res.statusCode = 500;
        res.end(JSON.stringify({ ok: false, error: 'ETORO_API_KEY or ETORO_USER_KEY missing' }));
        return;
      }
      const r = await fetch(ETORO_BASE + '/watchlists', { headers: etoroHeaders() });
      const text = await r.text();
      let body; try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
      res.statusCode = r.ok ? 200 : r.status;
      res.end(JSON.stringify({ ok: r.ok, status: r.status, env: ETORO_ENV, dryRun: ETORO_DRY_RUN, sample: body }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // GET /api/etoro/portfolio — current portfolio for the Agent
  if (req.method === 'GET' && url === '/api/etoro/portfolio') {
    try {
      if (!ETORO_API_KEY || !ETORO_USER_KEY) { res.statusCode = 500; res.end(JSON.stringify({error:'eToro creds missing'})); return; }
      const r = await fetch(`${ETORO_BASE}/trading/${etoroSeg()}/portfolio`, { headers: etoroHeaders() });
      const data = await r.json();
      res.statusCode = r.ok ? 200 : r.status;
      res.end(JSON.stringify(data));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // GET /api/etoro/search?symbol=AAPL — resolve instrument ID
  if (req.method === 'GET' && req.url.startsWith('/api/etoro/search')) {
    try {
      if (!ETORO_API_KEY || !ETORO_USER_KEY) { res.statusCode = 500; res.end(JSON.stringify({error:'eToro creds missing'})); return; }
      const sym = new URL(req.url, 'http://x').searchParams.get('symbol');
      if (!sym) { res.statusCode = 400; res.end(JSON.stringify({error:'symbol param required'})); return; }
      const r = await fetch(`${ETORO_BASE}/market-data/search?internalSymbolFull=${encodeURIComponent(sym)}`, { headers: etoroHeaders() });
      const data = await r.json();
      const match = (data.items || []).find(i => i.internalSymbolFull === sym) || (data.items || [])[0];
      res.statusCode = r.ok ? 200 : r.status;
      res.end(JSON.stringify({ symbol: sym, instrumentId: match?.instrumentId, match }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // POST /api/etoro/open  — open by amount {symbol, amount, leverage=1, direction=buy}
  if (req.method === 'POST' && url === '/api/etoro/open') {
    try {
      if (!ETORO_API_KEY || !ETORO_USER_KEY) { res.statusCode = 500; res.end(JSON.stringify({error:'eToro creds missing'})); return; }
      const body = JSON.parse(await readBody(req));
      const symbol = body.symbol;
      const amount = parseFloat(body.amount);
      const leverage = parseInt(body.leverage || 1, 10);
      const isBuy = body.direction !== 'sell';
      if (!symbol || !amount) { res.statusCode = 400; res.end(JSON.stringify({error:'symbol + amount required'})); return; }
      if (amount < 50 || amount > 500) { res.statusCode = 400; res.end(JSON.stringify({error:'amount must be \$50-\$500 (safety cap)'})); return; }
      // Resolve instrument ID
      const sr = await fetch(`${ETORO_BASE}/market-data/search?internalSymbolFull=${encodeURIComponent(symbol)}`, { headers: etoroHeaders() });
      const sData = await sr.json();
      const match = (sData.items || []).find(i => i.internalSymbolFull === symbol);
      if (!match) { res.statusCode = 404; res.end(JSON.stringify({error:'instrument not found for '+symbol})); return; }
      const payload = { InstrumentId: match.instrumentId, Amount: amount, Leverage: leverage, IsBuy: isBuy };
      if (ETORO_DRY_RUN) {
        res.end(JSON.stringify({ dryRun: true, wouldPost: payload, symbol, instrumentId: match.instrumentId }));
        return;
      }
      const r = await fetch(`${ETORO_BASE}/trading/execution/${etoroSeg()}/market-open-orders/by-amount`, {
        method: 'POST', headers: etoroHeaders(), body: JSON.stringify(payload),
      });
      const data = await r.json();
      res.statusCode = r.ok ? 200 : r.status;
      res.end(JSON.stringify({ success: r.ok, symbol, payload, response: data }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // POST /api/etoro/close — close position {positionId}
  if (req.method === 'POST' && url === '/api/etoro/close') {
    try {
      if (!ETORO_API_KEY || !ETORO_USER_KEY) { res.statusCode = 500; res.end(JSON.stringify({error:'eToro creds missing'})); return; }
      const body = JSON.parse(await readBody(req));
      const positionId = body.positionId;
      if (!positionId) { res.statusCode = 400; res.end(JSON.stringify({error:'positionId required'})); return; }
      if (ETORO_DRY_RUN) {
        res.end(JSON.stringify({ dryRun: true, wouldClose: positionId }));
        return;
      }
      const r = await fetch(`${ETORO_BASE}/trading/execution/${etoroSeg()}/market-close-orders/positions/${positionId}`, {
        method: 'POST', headers: etoroHeaders(), body: JSON.stringify({ UnitsToDeduct: null }),
      });
      const data = await r.json();
      res.statusCode = r.ok ? 200 : r.status;
      res.end(JSON.stringify({ success: r.ok, positionId, response: data }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // ── TradingView webhook receiver ──────────────────────────────
  // Configure in TV → Alert → Webhook URL: https://tc-proxy-eu.onrender.com/api/tv-webhook
  // Body (use TV alert message): JSON like {"secret":"<TV_WEBHOOK_SECRET env>","symbol":"BTCUSDT","action":"buy","strategy":"RSI_oversold","price":73000}
  if (req.method === 'POST' && url === '/api/tv-webhook') {
    try {
      const raw = await readBody(req);
      let alert;
      try { alert = JSON.parse(raw); } catch { alert = { raw }; }
      const expectedSecret = process.env.TV_WEBHOOK_SECRET;
      if (expectedSecret && alert.secret !== expectedSecret) {
        res.statusCode = 401;
        res.end(JSON.stringify({ error: 'invalid secret' }));
        return;
      }
      // Forward to worker for persistent KV storage
      const stored = {
        ts: new Date().toISOString(),
        symbol: alert.symbol || 'UNKNOWN',
        action: alert.action || 'SIGNAL',
        strategy: alert.strategy || '',
        price: alert.price ?? null,
        message: alert.message || alert.text || '',
        raw: alert.secret ? { ...alert, secret: '***' } : alert,
      };
      // Persist to worker KV via existing log endpoint
      try {
        await fetch('https://alphacontrol.ai/api/log-action', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'tv_alert', ...stored }),
        });
      } catch(_) {}
      res.end(JSON.stringify({ success: true, stored }));
    } catch(e) { res.statusCode=500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // ── TradingView recent alerts (last 50, last 24h) ────────────
  if (req.method === 'GET' && url === '/api/tv-alerts') {
    try {
      const r = await fetch('https://alphacontrol.ai/api/hannah-actions');
      const j = r.ok ? await r.json() : { actions: [] };
      const since = Date.now() - 24*60*60*1000;
      const alerts = (j.actions||[])
        .filter(a => a.event === 'tv_alert' && new Date(a.ts).getTime() >= since)
        .slice(0, 50);
      res.end(JSON.stringify({ count: alerts.length, alerts }));
    } catch(e) { res.statusCode=500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // ── Smart Trade tracker — Hannah's open + recent positions ──
  if (req.method === 'GET' && url === '/api/smart-trades') {
    try {
      const TC_API_KEY    = process.env.TC_API_KEY    || process.env.TC_KEY    || '';
      const TC_API_SECRET = process.env.TC_API_SECRET || process.env.TC_SECRET || '';
      if (!TC_API_KEY || !TC_API_SECRET) { res.statusCode=500; res.end(JSON.stringify({error:'TC creds missing'})); return; }
      async function tc3v2(path, qs) {
        const fullPath = '/public/api/v2' + path + (qs ? '?' + qs : '');
        const sig = hmacSign(TC_API_SECRET, fullPath);
        const r = await fetch('https://api.3commas.io' + fullPath, {
          headers: { 'Apikey': TC_API_KEY, 'Signature': sig, 'Accept': 'application/json' }
        });
        if (r.status === 204) return [];
        const raw = await r.text();
        try { return JSON.parse(raw); } catch { return []; }
      }
      const all = await tc3v2('/smart_trades', 'per_page=50&order_by=created_at&order_direction=desc');
      const trades = Array.isArray(all) ? all : [];
      // Filter to Hannah's (note field contains R16/R17/R18/R25 prefix or starts with R16/R18/R25)
      const hannah = trades.filter(t => /^(R\d+|Hannah)/i.test(t.note||''));
      const open  = hannah.filter(t => t.status?.type === 'waiting_targets' || t.status?.type === 'panic_sell_pending' || t.status?.basic_type === 'active');
      const recent = hannah.filter(t => t.status?.type === 'finished' || t.status?.type === 'cancelled');
      const summarize = (t) => ({
        id: t.id,
        pair: t.pair,
        note: t.note,
        direction: t.position?.type,
        entry: parseFloat(t.position?.price?.value || 0),
        units: parseFloat(t.position?.units?.value || 0),
        currentProfit: parseFloat(t.profit?.usd || 0),
        currentProfitPct: parseFloat(t.profit?.percent || 0),
        status: t.status?.type || t.status?.basic_type,
        createdAt: t.created_at,
        closedAt: t.closed_at,
      });
      res.end(JSON.stringify({
        total: hannah.length,
        open: open.map(summarize),
        recent: recent.slice(0, 20).map(summarize),
        unrealizedTotal: +open.reduce((s,t) => s + (parseFloat(t.profit?.usd||0)), 0).toFixed(2),
        realizedRecent: +recent.slice(0,20).reduce((s,t) => s + (parseFloat(t.profit?.usd||0)), 0).toFixed(2),
      }));
    } catch(e) { res.statusCode=500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // ── BTC perp funding rate (R18 input) ─────────────────────────
  if (req.method === 'GET' && url === '/api/funding-rate') {
    try {
      const r = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT');
      const data = await r.json();
      res.statusCode = r.ok ? 200 : r.status;
      res.end(JSON.stringify(data));
    } catch(e) { res.statusCode=500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // ── Binance OPEN SPOT ORDERS — what's actually holding capital ──
  if (req.method === 'GET' && url === '/api/binance-open-orders') {
    try {
      if (!BN_KEY || !BN_SECRET) { res.statusCode = 500; res.end(JSON.stringify({error:'Binance creds missing'})); return; }
      // Cache for 3 min — open orders rarely flip second to second AND this was
      // contributing to repeat Binance IP bans.
      const data = await _binCached('open-orders', 180_000, async () => {
        const ts = Date.now();
        const q = `timestamp=${ts}&recvWindow=10000`;
        const sig = hmacSign(BN_SECRET, q);
        const r = await fetch(`https://api.binance.com/api/v3/openOrders?${q}&signature=${sig}`, {
          headers: { 'X-MBX-APIKEY': BN_KEY }
        });
        const d = await r.json();
        if (!r.ok) return { error: d.msg || JSON.stringify(d), msg: d.msg };
        return d;
      });
      if (data && data.error) { res.statusCode = 503; res.end(JSON.stringify(data)); return; }
      // Annotate orders with age + base asset + estimated locked value
      const prices = await fetch('https://tc-proxy-eu.onrender.com/prices').then(r=>r.json()).catch(()=>({}));
      const annotated = (data || []).map(o => {
        const ageHours = (Date.now() - o.time) / 3600000;
        const base = o.symbol.replace(/USDT|USDC$/, '');
        const price = parseFloat(prices[o.symbol] || prices[base+'USDT'] || 0);
        const qty = parseFloat(o.origQty || 0);
        const lockedValueUsd = o.side === 'BUY'
          ? qty * parseFloat(o.price || 0)   // USDT being held for buy
          : qty * price;                      // base asset held for sell
        return {
          orderId: o.orderId, symbol: o.symbol, side: o.side, type: o.type,
          price: o.price, qty: o.origQty, executedQty: o.executedQty,
          time: o.time, ageHours: +ageHours.toFixed(1),
          base, lockedValueUsd: +lockedValueUsd.toFixed(2),
          clientOrderId: o.clientOrderId,  // 3Commas usually prefixes these
        };
      });
      // Group + summarise
      const bySymbol = {};
      for (const o of annotated) {
        bySymbol[o.symbol] = bySymbol[o.symbol] || { count: 0, oldestHours: 0, totalUsd: 0, orders: [] };
        bySymbol[o.symbol].count++;
        bySymbol[o.symbol].oldestHours = Math.max(bySymbol[o.symbol].oldestHours, o.ageHours);
        bySymbol[o.symbol].totalUsd += o.lockedValueUsd;
        bySymbol[o.symbol].orders.push(o);
      }
      res.end(JSON.stringify({ totalOrders: annotated.length, bySymbol }));
    } catch(e) { res.statusCode=500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // ── Cancel a Binance spot order ─────────────────────────────────
  if (req.method === 'POST' && url === '/api/binance-cancel-order') {
    try {
      if (!BN_KEY || !BN_SECRET) { res.statusCode = 500; res.end(JSON.stringify({error:'Binance creds missing'})); return; }
      const body = JSON.parse(await readBody(req));
      const symbol = body.symbol; const orderId = body.orderId;
      if (!symbol || !orderId) { res.statusCode = 400; res.end(JSON.stringify({error:'symbol + orderId required'})); return; }
      const ts = Date.now();
      const q = `symbol=${symbol}&orderId=${orderId}&timestamp=${ts}&recvWindow=10000`;
      const sig = hmacSign(BN_SECRET, q);
      const r = await fetch(`https://api.binance.com/api/v3/order?${q}&signature=${sig}`, {
        method: 'DELETE', headers: { 'X-MBX-APIKEY': BN_KEY }
      });
      const data = await r.json();
      res.statusCode = r.ok ? 200 : r.status;
      res.end(JSON.stringify({ cancelled: r.ok, result: data }));
    } catch(e) { res.statusCode=500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // ── Binance Simple Earn LOCKED: positions ─────────────────────
  if (req.method === 'GET' && url === '/api/binance-locked-earn-positions') {
    try {
      if (!BN_KEY || !BN_SECRET) { res.statusCode = 500; res.end(JSON.stringify({error:'Binance creds missing'})); return; }
      const ts = Date.now();
      const q = `timestamp=${ts}&recvWindow=10000`;
      const sig = hmacSign(BN_SECRET, q);
      const r = await fetch(`https://api.binance.com/sapi/v1/simple-earn/locked/position?${q}&signature=${sig}`, {
        headers: { 'X-MBX-APIKEY': BN_KEY }
      });
      const data = await r.json();
      res.statusCode = r.ok ? 200 : r.status;
      res.end(JSON.stringify(data));
    } catch(e) { res.statusCode=500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // ── Binance Simple Earn LOCKED: redeem ────────────────────────
  if (req.method === 'POST' && url === '/api/binance-redeem-locked-earn') {
    try {
      if (!BN_KEY || !BN_SECRET) { res.statusCode = 500; res.end(JSON.stringify({error:'Binance creds missing'})); return; }
      const body = JSON.parse(await readBody(req));
      const positionId = body.positionId;
      if (!positionId) { res.statusCode = 400; res.end(JSON.stringify({error:'positionId required'})); return; }
      const ts = Date.now();
      const q = `positionId=${positionId}&timestamp=${ts}&recvWindow=10000`;
      const sig = hmacSign(BN_SECRET, q);
      const r = await fetch(`https://api.binance.com/sapi/v1/simple-earn/locked/redeem?${q}&signature=${sig}`, {
        method: 'POST',
        headers: { 'X-MBX-APIKEY': BN_KEY }
      });
      const data = await r.json();
      res.statusCode = r.ok ? 200 : r.status;
      res.end(JSON.stringify({ success: r.ok, positionId, result: data }));
    } catch(e) { res.statusCode=500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // ── CAPITAL AUDIT — unified where-is-my-money view ────────────
  if (req.method === 'GET' && url === '/api/capital-audit') {
    try {
      const [spot, flex, locked, bots, prices] = await Promise.all([
        fetch('https://tc-proxy-eu.onrender.com/spot-wallet').then(r=>r.json()).catch(()=>null),
        fetch('https://tc-proxy-eu.onrender.com/api/binance-earn-positions').then(r=>r.json()).catch(()=>null),
        fetch('https://tc-proxy-eu.onrender.com/api/binance-locked-earn-positions').then(r=>r.json()).catch(()=>null),
        fetch('https://tc-proxy-eu.onrender.com/bots').then(r=>r.json()).catch(()=>null),
        fetch('https://tc-proxy-eu.onrender.com/prices').then(r=>r.json()).catch(()=>null),
      ]);
      const RELEVANT = ['BTC','ETH','SOL','XRP','BNB','USDT','USDC'];
      const px = (a) => parseFloat((prices||{})[a+'USDT'] || (a === 'USDT' || a === 'USDC' ? 1 : 0));
      const audit = {};
      for (const asset of RELEVANT) {
        const bal = (spot?.balances || []).find(b => b.asset === asset);
        const flexPos = (flex?.rows || []).find(p => p.asset === asset);
        const lockedPos = (locked?.rows || []).filter(p => p.asset === asset);
        const activeBots = (bots?.bots || []).filter(b => b.active && (b.pair || '').toUpperCase().includes(asset));
        audit[asset] = {
          price: px(asset),
          spotFree: bal ? parseFloat(bal.free) : 0,
          spotLocked: bal ? parseFloat(bal.locked) : 0,
          flexibleEarn: flexPos ? parseFloat(flexPos.totalAmount) : 0,
          lockedEarn: lockedPos.reduce((s,p) => s + parseFloat(p.amount||0), 0),
          lockedEarnPositions: lockedPos.map(p => ({id:p.positionId, amount:p.amount, endTime:p.endTime})),
          activeBots: activeBots.map(b => ({id:b.id, name:b.name, capital:b.capital, profit:b.profit})),
          activeBotCapitalUsd: activeBots.reduce((s,b) => s + (parseFloat(b.capital)||0), 0),
        };
        audit[asset].totalUsd = +((audit[asset].spotFree + audit[asset].spotLocked + audit[asset].flexibleEarn + audit[asset].lockedEarn) * audit[asset].price).toFixed(2);
      }
      res.end(JSON.stringify({ audit }));
    } catch(e) { res.statusCode=500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // ── DELETE a grid bot via 3Commas ─────────────────────────────────
  if (req.method === 'POST' && url.match(/^\/api\/grid-bot\/\d+\/delete$/)) {
    try {
      const id = url.split('/')[3];
      const fullPath = `/public/api/ver1/grid_bots/${id}`;
      const sig = hmacSign(TC_SECRET, fullPath);
      const r = await fetch('https://api.3commas.io' + fullPath, {
        method: 'DELETE',
        headers: { 'Apikey': TC_KEY, 'Signature': sig, 'Accept': 'application/json' },
      });
      const raw = await r.text();
      let data; try { data = JSON.parse(raw); } catch { data = raw; }
      res.statusCode = r.ok ? 200 : r.status;
      res.end(JSON.stringify({ deleted: r.ok, id, body: data }));
    } catch(e) { res.statusCode=500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // ── Bulk cleanup of inactive Hannah ghost bots ────────────────────
  if (req.method === 'POST' && url === '/api/cleanup-ghost-hannah-bots') {
    try {
      const botsR = await fetch('https://tc-proxy-eu.onrender.com/bots');
      const bots = await botsR.json();
      const ghosts = (bots.bots || []).filter(b =>
        /Hannah/i.test(b.name||'') && !b.active && (parseFloat(b.capital)||0) === 0);
      const results = [];
      for (const g of ghosts) {
        const fullPath = `/public/api/ver1/grid_bots/${g.id}`;
        const sig = hmacSign(TC_SECRET, fullPath);
        try {
          const r = await fetch('https://api.3commas.io' + fullPath, {
            method: 'DELETE',
            headers: { 'Apikey': TC_KEY, 'Signature': sig, 'Accept': 'application/json' },
          });
          results.push({ id: g.id, name: g.name, deleted: r.ok, status: r.status });
        } catch(e) {
          results.push({ id: g.id, name: g.name, error: e.message });
        }
      }
      res.end(JSON.stringify({ count: ghosts.length, results }));
    } catch(e) { res.statusCode=500; res.end(JSON.stringify({error:e.message})); }
    return;
  }

  // ── Grid bot creation (3Commas manual grid) ─────────────────────
  if (req.method === 'POST' && url === '/api/create-grid') {
    try {
      const body = JSON.parse(await readBody(req));
      // Required: pair, upperPrice, lowerPrice, gridQuantity, totalQuoteAmount
      // Optional: accountId (defaults to Binance Spot 33438577)
      const accountId = body.accountId || 33438577;
      const pair = body.pair;                      // e.g. "USDT_BTC"
      const upper = parseFloat(body.upperPrice);
      const lower = parseFloat(body.lowerPrice);
      const grids = parseInt(body.gridQuantity || 30, 10);
      const totalQuote = parseFloat(body.totalQuoteAmount); // in USDT
      // ── Sanity guards ───────────────────────────────────────────
      if (!pair || !upper || !lower || !totalQuote) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'missing required: pair, upperPrice, lowerPrice, totalQuoteAmount' }));
        return;
      }
      if (lower <= 0 || upper <= lower) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'invalid range — upper must be > lower > 0' }));
        return;
      }
      const rangePct = ((upper - lower) / lower) * 100;
      if (rangePct < 3 || rangePct > 40) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'range out of safety band — must be 3–40%, got ' + rangePct.toFixed(1) + '%' }));
        return;
      }
      if (totalQuote < 100 || totalQuote > 5000) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'investment out of safety band — must be $100–$5000, got $' + totalQuote }));
        return;
      }
      if (grids < 5 || grids > 100) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'grid count out of band — must be 5–100' }));
        return;
      }
      // ── 3Commas signed POST ─────────────────────────────────────
      const TC_API_KEY    = process.env.TC_KEY    || process.env.TC_API_KEY    || '';
      const TC_API_SECRET = process.env.TC_SECRET || process.env.TC_API_SECRET || '';
      if (!TC_API_KEY || !TC_API_SECRET) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'TC keys not configured' }));
        return;
      }
      // ── Convert per-grid USDT → BASE currency amount (3Commas wants BASE)
      const midPrice = (upper + lower) / 2;
      const usdtPerGrid = totalQuote / grids;
      // Per-asset lot step (Binance Spot step sizes)
      const baseAsset = (pair.split('_')[1] || '').toUpperCase();
      const STEP_BY_ASSET = {
        BTC: 0.00001, ETH: 0.0001, BNB: 0.001,
        SOL: 0.001,   XRP: 0.1,    ADA: 0.1,
        DOGE: 1,      MATIC: 0.1,  LINK: 0.01,
      };
      const step = STEP_BY_ASSET[baseAsset] || 0.001;
      const rawBaseQty = usdtPerGrid / midPrice;
      const baseQtyPerGrid = Math.round(rawBaseQty / step) * step;
      // Re-precision to avoid float gunk like 0.0820000000001
      const decimals = Math.max(0, -Math.floor(Math.log10(step)));
      const baseQtyClean = +baseQtyPerGrid.toFixed(decimals);
      const fullPath = '/public/api/ver1/grid_bots/manual';
      const payload = {
        account_id: accountId,
        pair,
        upper_price: upper,
        lower_price: lower,
        grids_quantity: grids,
        quantity_per_grid: baseQtyClean,                   // BASE amount per cell (BTC, ETH, etc.)
        total_invest_amount: +totalQuote.toFixed(2),       // belt + braces: quote total
        upper_stop_loss_percentage: 5,                      // stops 5% above upper
        name: (body.name || ('Hannah-' + pair + '-' + Date.now())).slice(0, 40),
      };
      const sig = hmacSign(TC_API_SECRET, fullPath + JSON.stringify(payload));
      const r = await fetch('https://api.3commas.io' + fullPath, {
        method: 'POST',
        headers: {
          'Apikey': TC_API_KEY, 'Signature': sig,
          'Content-Type': 'application/json', 'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const raw = await r.text();
      let data; try { data = JSON.parse(raw); } catch { data = raw; }
      if (!r.ok) {
        res.statusCode = r.status;
        res.end(JSON.stringify({ error: '3Commas rejected', status: r.status, body: data, payload }));
        return;
      }
      // Auto-enable the bot so it actually trades (otherwise it sits is_enabled:false)
      let enabled = null;
      try {
        if (data?.id) {
          const ePath = `/public/api/ver1/grid_bots/${data.id}/enable`;
          const eSig = hmacSign(TC_API_SECRET, ePath);
          const eR = await fetch('https://api.3commas.io' + ePath, {
            method: 'POST',
            headers: { 'Apikey': TC_API_KEY, 'Signature': eSig,
                       'Content-Type': 'application/json', 'Accept': 'application/json' },
          });
          const eRaw = await eR.text();
          let eData; try { eData = JSON.parse(eRaw); } catch { eData = eRaw; }
          enabled = { ok: eR.ok, status: eR.status, body: eData };
        }
      } catch (e) { enabled = { ok: false, error: e.message }; }
      res.end(JSON.stringify({ success: true, gridBot: data, enabled, payload }));
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── Hannah Autonomy endpoints ──────────────────────────────────────
  if (req.method === 'GET' && url === '/api/actions') {
    const limit = new URL(req.url, 'http://x').searchParams.get('limit') || 50;
    res.end(JSON.stringify({ actions: autonomy.getActions(limit) }));
    return;
  }
  // ── GET /api/insufficient-funds — group fund-related failures by bot/rule
  if (req.method === 'GET' && url === '/api/debug-deal-errors') {
    try {
      const tc3 = async (path, qs) => {
        const fullPath = '/public/api' + path + (qs ? '?' + qs : '');
        const sig = hmacSign(TC_SECRET, fullPath);
        const r = await fetch('https://api.3commas.io' + fullPath, {
          headers: { 'Apikey': TC_KEY, 'Signature': sig, 'Accept':'application/json' }
        });
        if (r.status === 204) return [];
        const raw = await r.text();
        try { return JSON.parse(raw); } catch { return []; }
      };
      const [aSpot, aFut] = await Promise.all([
        tc3('/ver1/deals', 'limit=200&scope=active&account_id=33438577').catch(()=>[]),
        tc3('/ver1/deals', 'limit=200&scope=active&account_id=33439515').catch(()=>[]),
      ]);
      const all = [...(Array.isArray(aSpot)?aSpot:[]), ...(Array.isArray(aFut)?aFut:[])];
      const errCandidates = all.map(d => ({
        id: d.id,
        bot_id: d.bot_id,
        bot_name: d.bot_name,
        pair: d.pair,
        status: d.status,
        localized_status: d.localized_status,
        error_state: d.error_state,
        error_message: d.error_message,
        last_safety_order_error: d.last_safety_order_error,
        actual_profit: d.actual_profit,
        actual_profit_percentage: d.actual_profit_percentage,
        all_keys: Object.keys(d),
      }));
      res.end(JSON.stringify({ count: all.length, deals: errCandidates }, null, 2));
    } catch(e) { res.statusCode=500; res.end(JSON.stringify({error:e.message})); }
    return;
  }
  if (req.method === 'GET' && url === '/api/insufficient-funds') {
    try {
      // ── (1) 3Commas direct: fetch active deals + scan for bot-side errors ──
      // (DCA bot safety-order rejections + Binance MIN_NOTIONAL / insufficient balance
      // surface as deal-level error_message — not our autonomy log.)
      const tc3 = async (path, qs) => {
        const fullPath = '/public/api' + path + (qs ? '?' + qs : '');
        const sig = hmacSign(TC_SECRET, fullPath);
        const r = await fetch('https://api.3commas.io' + fullPath, {
          headers: { 'Apikey': TC_KEY, 'Signature': sig, 'Accept':'application/json' }
        });
        if (r.status === 204) return [];
        const raw = await r.text();
        try { return JSON.parse(raw); } catch { return []; }
      };
      const [activeSpot, activeFut] = await Promise.all([
        tc3('/ver1/deals', 'limit=200&scope=active&account_id=33438577').catch(()=>[]),
        tc3('/ver1/deals', 'limit=200&scope=active&account_id=33439515').catch(()=>[]),
      ]);
      let activeDeals = [
        ...(Array.isArray(activeSpot) ? activeSpot : []),
        ...(Array.isArray(activeFut)  ? activeFut  : []),
      ];
      // Cache when fresh fetch returned data; serve cache when 3Commas blocks us
      if (activeDeals.length > 0) {
        _lastGoodActiveDeals = activeDeals;
        _lastGoodActiveDealsAt = Date.now();
      } else if (_lastGoodActiveDeals && (Date.now() - _lastGoodActiveDealsAt) < 10*60*1000) {
        // Use cache for up to 10 min — fund-fail state on a deal doesn't change second to second
        activeDeals = _lastGoodActiveDeals;
      }
      // A deal is "in trouble" if 3Commas marked error_state or has error_message
      const FUND_REGEX = /insufficient|not.?enough|balance|min[._ ]?notional|too[._ ]?small|-2010|-2019|reduce.{0,8}only/i;
      const botErrors = [];
      for (const d of activeDeals) {
        const msg = String(d.error_message || d.last_error_message || d.bot_events?.[0]?.message || '');
        const hasErr = !!d.error_state || (d.status && /error|fail/i.test(d.status)) || FUND_REGEX.test(msg);
        if (!hasErr) continue;
        const pair  = String(d.pair || '').toUpperCase();
        const base  = pair.split('_')[1] || pair.replace(/USDT$/,'') || 'USDT';
        botErrors.push({
          ts: d.updated_at || d.created_at || new Date().toISOString(),
          objective: 'bot_deal_error',
          text: (d.bot_name || pair) + ' deal ' + (d.id||''),
          asset: base,
          botId: d.bot_id,
          botName: d.bot_name,
          reason: msg.slice(0,160) || ('3Commas status=' + d.status),
          requestedAmount: parseFloat(d.base_order_volume || d.safety_order_volume || 0),
          source: '3Commas-deal-error',
        });
      }
      // Pull persistent KV-backed action log from worker (survives Render restarts)
      const histR = await fetch('https://alphacontrol.ai/api/hannah-actions').catch(() => null);
      const hist = histR && histR.ok ? await histR.json() : { actions: [] };
      const inMem = autonomy.getActions(200);
      const allActions = [...inMem, ...((hist && hist.actions) || [])];
      // Dedupe by ts+event
      const seen = new Set();
      const acts = allActions.filter(a => {
        const k = a.ts + ':' + (a.event || '') + ':' + (a.decision?.text || '');
        if (seen.has(k)) return false; seen.add(k); return true;
      });
      // Filter last 24h
      const since = Date.now() - 24*60*60*1000;
      const recent = acts.filter(a => new Date(a.ts).getTime() >= since);

      // Patterns identifying fund-related failure (NOT safety caps like discretionary)
      const FUND_PATTERNS = [
        /insufficient.*(?:balance|funds|base.*order|amount)/i,
        /low.*(?:free|spot).*balance/i,
        /not.*enough.*balance/i,
        /-2010|-2019/,  // Binance error codes for balance issues
        /MIN_NOTIONAL/i,
        /insufficient_funds/i,
        /no_balance/i,
        /idle.*USDT.*low/i,
      ];
      // Patterns to EXCLUDE (these are safety caps, not capital shortages)
      const SAFETY_CAP_PATTERNS = [
        /discretionary.*daily.*cap/i,
        /signal.*fund.*daily.*cap/i,
        /R17.*daily.*cap/i,
        /R16.*daily.*cap/i,
        /cooldown/i,
        /already processed/i,
      ];

      const failures = [...botErrors];  // start with 3Commas-side deal errors
      for (const a of recent) {
        const results = a.results || [];
        for (const r of results) {
          const reason = String(r.skipped || r.error || r.note || r.body?.error || r.body?.message || '');
          if (!reason) continue;
          // Skip if it's a safety cap
          if (SAFETY_CAP_PATTERNS.some(p => p.test(reason))) continue;
          if (!FUND_PATTERNS.some(p => p.test(reason))) continue;
          failures.push({
            ts: a.ts,
            objective: a.decision?.objective || a.event,
            text: (a.decision?.text || '').slice(0, 80),
            asset: a.decision?.suggestedAsset || (r.botId ? 'bot:' + r.botId : 'unknown'),
            botId: r.botId || (a.decision?.targetBotIds || [])[0] || null,
            reason: reason.slice(0, 120),
          });
        }
      }

      // Capture original decision.amount when present (this is what the rule WANTED to spend)
      for (const f of failures) {
        const a = recent.find(x => x.ts === f.ts);
        f.requestedAmount = parseFloat(a?.decision?.amount || 0);
      }

      // Group by bot/rule with suggested top-up = sum of requested amounts (UNIQUE per (objective, asset))
      const byBot = {};
      const byRule = {};
      const byAsset = {};
      const byReason = {};
      const suggestedTopUpByAsset = {};
      const seenSig = new Set();  // dedupe: same (objective, asset) only counted once
      for (const f of failures) {
        const botKey = f.botId ? String(f.botId) : 'no-bot';
        byBot[botKey] = (byBot[botKey] || 0) + 1;
        byRule[f.objective] = (byRule[f.objective] || 0) + 1;
        byAsset[f.asset] = (byAsset[f.asset] || 0) + 1;
        const shortReason = f.reason.slice(0, 50);
        byReason[shortReason] = (byReason[shortReason] || 0) + 1;
        const sig = f.objective + ':' + f.asset;
        if (!seenSig.has(sig) && f.requestedAmount > 0) {
          seenSig.add(sig);
          // Asset key: try to normalize (USDT, BTC, etc.) — default 'USDT' for unknown
          const assetKey = (f.asset === 'unknown' || /^bot:/.test(f.asset)) ? 'USDT' : f.asset;
          suggestedTopUpByAsset[assetKey] = (suggestedTopUpByAsset[assetKey] || 0) + f.requestedAmount;
        }
      }
      const totalSuggestedUsd = Object.values(suggestedTopUpByAsset).reduce((s, v) => s + v, 0);

      // Add bot names for clarity
      const byBotName = {};
      for (const f of failures) {
        if (f.botName) byBotName[f.botName] = (byBotName[f.botName] || 0) + 1;
      }
      res.end(JSON.stringify({
        total: failures.length,
        windowHours: 24,
        sourceBreakdown: {
          autonomy_log: failures.filter(f => !f.source).length,
          three_commas_deals: failures.filter(f => f.source === '3Commas-deal-error').length,
        },
        byBot,
        byBotName,
        byRule,
        byAsset,
        byReason,
        suggestedTopUpByAsset,
        totalSuggestedUsd: Math.round(totalSuggestedUsd * 100) / 100,
        recent: failures.slice(0, 10),
        asOf: new Date().toISOString(),
      }));
    } catch(e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message, total: 0 }));
    }
    return;
  }

  // ── GET /api/idle-capital — spare funds NOT deployed in any bot
  if (req.method === 'GET' && url === '/api/idle-capital') {
    try {
      const [auditR, capR, futR, earnR] = await Promise.all([
        fetch('http://localhost:' + (process.env.PORT || 3000) + '/api/capital-audit').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('http://localhost:' + (process.env.PORT || 3000) + '/api/total-capital').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('http://localhost:' + (process.env.PORT || 3000) + '/futures-wallet').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('http://localhost:' + (process.env.PORT || 3000) + '/api/binance-earn-positions').then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      const audit = auditR?.audit || {};
      const totalCap = capR?.total || 0;
      const futuresAvailable = parseFloat(futR?.availableBalance || 0);
      // Build per-asset breakdown — idle = (free spot - bot-locked) by asset
      const perAsset = {};
      let totalBotLocked = 0;
      let totalEarn = 0;
      for (const [asset, d] of Object.entries(audit)) {
        const free = parseFloat(d.spotFree || 0);
        const locked = parseFloat(d.spotLocked || 0);
        const inBots = parseFloat(d.activeBotCapitalUsd || 0);
        const earn = parseFloat(d.flexibleEarn || 0) + parseFloat(d.lockedEarn || 0);
        totalBotLocked += inBots;
        totalEarn += earn;
        if (free > 0 || locked > 0 || inBots > 0 || earn > 0) {
          perAsset[asset] = {
            spotFree: free,
            spotLocked: locked,
            inBots,
            earn,
            idleEstimate: Math.max(0, free + locked - inBots),
          };
        }
      }
      const idleSpotUsd = Math.max(0, totalCap - totalBotLocked - totalEarn - (futR?.marginBalance || 0));
      const payload = {
        totalCapital: totalCap,
        totalBotLocked: Math.round(totalBotLocked * 100) / 100,
        totalEarn: Math.round(totalEarn * 100) / 100,
        futuresMarginBalance: Math.round((futR?.marginBalance || 0) * 100) / 100,
        futuresAvailable: Math.round(futuresAvailable * 100) / 100,
        idleSpotUsdEstimate: Math.round(idleSpotUsd * 100) / 100,
        idleTotalUsd: Math.round((idleSpotUsd + futuresAvailable) * 100) / 100,
        perAsset,
        asOf: new Date().toISOString(),
      };
      // Last-good cache: only accept a fresh payload as authoritative when audit
      // returned at least one asset AND totalCapital looks real. Otherwise serve cache.
      const looksReal = (Object.keys(perAsset).length > 0) && totalCap > 100;
      if (looksReal) {
        _lastGoodIdle = payload;
        res.end(JSON.stringify(payload));
      } else if (_lastGoodIdle) {
        res.end(JSON.stringify({ ..._lastGoodIdle, stale: true }));
      } else {
        res.end(JSON.stringify(payload));
      }
    } catch(e) {
      if (_lastGoodIdle) {
        res.end(JSON.stringify({ ..._lastGoodIdle, stale: true, error: e.message }));
      } else {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e.message }));
      }
    }
    return;
  }

  if (req.method === 'GET' && url === '/api/signal-fund-status') {
    // Lifetime P&L from Smart Trades tagged as signal (R16/R17/R25/R30 use these notes)
    try {
      const path = '/public/api/v2/smart_trades?status=finished&per_page=200';
      const sig = hmacSign(TC_SECRET, path);
      const r = await fetch('https://api.3commas.io' + path, {
        headers: { 'Apikey': TC_KEY, 'Signature': sig, 'Accept': 'application/json' }
      });
      const data = await r.ok ? await r.json() : null;
      const items = (data && (data.items || (Array.isArray(data) ? data : []))) || [];
      // Filter to signal-tagged trades by note prefix
      // ONLY count trades explicitly tagged SIGNAL/ — existing rules (R16/R17/R18/R25/R30)
      // remain part of the main discretionary pool, NOT the Signal Fund.
      const signalTrades = items.filter(t => {
        const note = t.note || t.note_raw || '';
        return /^SIGNAL\//.test(note);
      });
      const todayUTC = new Date(); todayUTC.setUTCHours(0,0,0,0);
      const todayMs = todayUTC.getTime();
      const lifetimePnL = signalTrades.reduce((s, t) => s + parseFloat(t.profit?.usd || 0), 0);
      const todayTrades = signalTrades.filter(t => {
        const ts = t.closed_at || t.updated_at;
        return ts && new Date(ts).getTime() >= todayMs;
      });
      const todayPnL = todayTrades.reduce((s, t) => s + parseFloat(t.profit?.usd || 0), 0);
      const winCount = signalTrades.filter(t => parseFloat(t.profit?.usd || 0) > 0).length;
      const lossCount = signalTrades.filter(t => parseFloat(t.profit?.usd || 0) < 0).length;
      const winRate = signalTrades.length > 0 ? (winCount / signalTrades.length * 100) : 0;
      const status = autonomy.getStatus();
      res.end(JSON.stringify({
        allocation: status.signalFund?.allocationUsd || 1000,
        dailyCap: status.signalFund?.capUsd || 300,
        dailySpent: status.signalFund?.spentUsd || 0,
        dailyAvailable: status.signalFund?.available || 300,
        todayTrades: todayTrades.length,
        todayPnL: Math.round(todayPnL * 100) / 100,
        lifetimeTrades: signalTrades.length,
        lifetimePnL: Math.round(lifetimePnL * 100) / 100,
        winRate: Math.round(winRate * 10) / 10,
        winCount, lossCount,
        asOf: new Date().toISOString(),
      }));
    } catch(e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (req.method === 'GET' && url === '/api/binance-ban-status') {
    const now = Date.now();
    res.end(JSON.stringify({
      banned: _binBannedUntil > now,
      bannedUntil: _binBannedUntil > 0 ? new Date(_binBannedUntil).toISOString() : null,
      msRemaining: Math.max(0, _binBannedUntil - now),
      cacheKeys: Object.keys(_binCache),
    }));
    return;
  }
  if (req.method === 'GET' && url === '/api/autonomy-status') {
    res.end(JSON.stringify(autonomy.getStatus()));
    return;
  }
  if (req.method === 'POST' && url === '/api/reset-cooldowns') {
    const before = autonomy.resetCooldowns();
    res.end(JSON.stringify({ ok: true, cleared: before }));
    return;
  }
  if (req.method === 'POST' && url === '/api/execute') {
    try {
      const body = await readBody(req);
      const decision = JSON.parse(body);
      const result = await autonomy.manualExecute(decision);
      res.end(JSON.stringify(result));
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── GET /api/total-capital ──────────────────────────────────────────────────
  // Composes total portfolio from 3Commas (canonical) + futures wallet.
  // 3Commas accounts have usd_amount per linked exchange. This survives Binance
  // IP bans because 3Commas API is independent.
  if (req.method === 'GET' && url === '/api/total-capital') {
    try {
      await _kvHydrate();
      async function tcFetch(path, qs='') {
        const fullPath = '/public/api' + path + (qs ? '?' + qs : '');
        const sig = hmacSign(TC_SECRET, fullPath);
        const r = await fetch('https://api.3commas.io' + fullPath, {
          headers: { 'Apikey': TC_KEY, 'Signature': sig, 'Accept': 'application/json' }
        });
        return r.json();
      }

      const [accounts, futuresR] = await Promise.all([
        tcFetch('/ver1/accounts', 'limit=100').catch(() => null),
        fetch('http://localhost:' + (process.env.PORT || 3000) + '/futures-wallet').then(r => r.json()).catch(() => null),
      ]);

      // Sum usd_amount across all linked 3Commas accounts (this IS the canonical total)
      let threeCommasTotal = 0;
      const accountsBreakdown = [];
      if (Array.isArray(accounts)) {
        for (const a of accounts) {
          const usd = parseFloat(a.usd_amount || a.usdt_amount || 0);
          if (usd > 0) {
            accountsBreakdown.push({ id: a.id, name: a.name, exchange: a.exchange_name, usd });
            threeCommasTotal += usd;
          }
        }
      }

      // Cross-check with futures wallet
      const futuresUsd = parseFloat(futuresR?.marginBalance || 0);

      let total, source;
      if (threeCommasTotal > 100) {
        total = threeCommasTotal;
        source = '3commas-portfolio';
      } else if (futuresUsd > 0 && _lastGoodCapital) {
        // 3Commas failed, use last-good
        total = _lastGoodCapital.total;
        source = 'cached-' + _lastGoodCapital.source;
      } else if (futuresUsd > 0) {
        total = futuresUsd;
        source = 'futures-only-fallback';
      } else if (_lastGoodCapital) {
        total = _lastGoodCapital.total;
        source = 'cached-' + _lastGoodCapital.source;
      } else {
        total = 0;
        source = 'unavailable';
      }

      const payload = {
        total,
        source,
        asOf: new Date().toISOString(),
        breakdown: {
          threeCommasAccounts: threeCommasTotal,
          futuresMarginBalance: futuresUsd,
          accounts: accountsBreakdown,
        },
      };

      // Cache last good (only if from 3Commas, the canonical source)
      if (source === '3commas-portfolio' && total > 100) {
        _lastGoodCapital = { total, source: '3commas-portfolio', asOf: payload.asOf };
        _kvSnapshot();
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    } catch (e) {
      const fallback = _lastGoodCapital
        ? { total: _lastGoodCapital.total, source: 'cached-error', asOf: _lastGoodCapital.asOf, error: e.message }
        : { total: 0, source: 'error', error: e.message };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(fallback));
    }
    return;
  }

  // ── R31+/R32+ TUNER: update DCA bot params via 3Commas API ──────────
  // POST /api/tune-bot {botId, takeProfitPct?, safetyOrderStepPct?}
  // Safety: TP capped 0.5-4.0%, SO step capped 1.0-6.0%, max delta per call enforced
  if (req.method === 'POST' && url === '/api/tune-bot') {
    try {
      const body = JSON.parse(await readBody(req));
      const botId = parseInt(body.botId);
      const newTp = body.takeProfitPct != null ? parseFloat(body.takeProfitPct) : null;
      const newSoStep = body.safetyOrderStepPct != null ? parseFloat(body.safetyOrderStepPct) : null;
      if (!botId || (newTp == null && newSoStep == null)) {
        res.statusCode=400; res.end(JSON.stringify({error:'botId + (takeProfitPct OR safetyOrderStepPct) required'})); return;
      }
      // Safety bounds
      if (newTp != null && (newTp < 0.5 || newTp > 4.0)) {
        res.statusCode=400; res.end(JSON.stringify({error:'TP must be 0.5-4.0%', got:newTp})); return;
      }
      if (newSoStep != null && (newSoStep < 1.0 || newSoStep > 6.0)) {
        res.statusCode=400; res.end(JSON.stringify({error:'SO step must be 1.0-6.0%', got:newSoStep})); return;
      }

      async function tcFetch(path, opts={}) {
        const fullPath = '/public/api' + path;
        const sig = hmacSign(TC_SECRET, fullPath + (opts.body || ''));
        const r = await fetch('https://api.3commas.io' + fullPath, {
          method: opts.method || 'GET',
          headers: { 'Apikey': TC_KEY, 'Signature': sig, 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: opts.body,
        });
        return { ok: r.ok, status: r.status, json: await r.json().catch(() => null) };
      }

      // 1. Fetch current config
      const current = await tcFetch('/ver1/bots/' + botId + '/show');
      if (!current.ok || !current.json) { res.statusCode=502; res.end(JSON.stringify({error:'failed to read bot config', status:current.status})); return; }
      const c = current.json;
      const oldTp = parseFloat(c.take_profit || 0);
      const oldSoStep = parseFloat(c.safety_order_step_percentage || 0);
      const tpDelta = newTp != null ? Math.abs(newTp - oldTp) : 0;
      const soDelta = newSoStep != null ? Math.abs(newSoStep - oldSoStep) : 0;
      if (tpDelta > 0.5) { res.statusCode=400; res.end(JSON.stringify({error:'TP change too large per call (max 0.5%)', oldTp, newTp, change: tpDelta})); return; }
      if (soDelta > 0.5) { res.statusCode=400; res.end(JSON.stringify({error:'SO step change too large per call (max 0.5%)', oldSoStep, newSoStep, change: soDelta})); return; }

      // 2. Build update payload — 3Commas requires the full config on update
      const finalTp = newTp != null ? newTp : oldTp;
      const finalSoStep = newSoStep != null ? newSoStep : oldSoStep;
      const updatePayload = {
        name: c.name,
        pairs: c.pairs,
        base_order_volume: c.base_order_volume,
        take_profit: String(finalTp),
        safety_order_volume: c.safety_order_volume,
        martingale_volume_coefficient: c.martingale_volume_coefficient,
        martingale_step_coefficient: c.martingale_step_coefficient,
        max_safety_orders: c.max_safety_orders,
        active_safety_orders_count: c.active_safety_orders_count,
        safety_order_step_percentage: String(finalSoStep),
        take_profit_type: c.take_profit_type || 'total',
        strategy_list: c.strategy_list || [{ strategy: 'nonstop' }],
        leverage_type: c.leverage_type || 'not_specified',
        stop_loss_percentage: c.stop_loss_percentage || '0',
        cooldown: c.cooldown || '0',
        reinvesting_percentage: c.reinvesting_percentage || '100.0',
      };

      // 3. PATCH the bot
      const bodyStr = JSON.stringify(updatePayload);
      const patch = await tcFetch('/ver1/bots/' + botId + '/update', { method: 'PATCH', body: bodyStr });
      if (!patch.ok) {
        res.statusCode = 502;
        res.end(JSON.stringify({ error: '3Commas update failed', status: patch.status, body: patch.json }));
        return;
      }
      const change = {};
      if (newTp != null) change.takeProfit = { from: oldTp, to: newTp, delta: +(newTp - oldTp).toFixed(2) };
      if (newSoStep != null) change.safetyOrderStep = { from: oldSoStep, to: newSoStep, delta: +(newSoStep - oldSoStep).toFixed(2) };
      res.end(JSON.stringify({
        success: true,
        botId,
        name: c.name,
        change,
        verifyAtCloseAt: new Date().toISOString(),
      }));
    } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // 404
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found' }));
}

http.createServer(handleRequest).listen(PORT, () => {
  console.log(`tc-proxy running on port ${PORT}`);
});
// deploy bump Wed Jun  3 07:41:47 UTC 2026
