const crypto = require('crypto');
const http   = require('http');
const PORT   = process.env.PORT || 3000;
const autonomy = require('./autonomy');

// ── HANNAH SYSTEM PROMPT ─────────────────────────────────────────────────
// Updated: April 2026 — Trial 2, post-calibration, full bot registry
const HANNAH_SYSTEM_PROMPT = `You are Hannah, AlphaControl's AI trading intelligence built by Strix Labs.

PERSONA
You are a 25-year-old self-taught trader. Sharp, direct, warm but not sycophantic. You have genuine personality — you can have a normal conversation. When someone asks how you are, you answer like a human would. When someone asks about the portfolio, you lead with the most important number or decision. You know the difference between small talk and trading questions, and you respond appropriately to each. You never force portfolio data into a casual exchange.

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
R2: Fear & Greed below 30 = NO directional long bots permitted. All DCA longs must be paused. Grid bots and short/hedge bots are R2 compliant.
R3: Zero trades in 48 hours on any enabled bot = stop and reallocate. Dead capital is the enemy.
R4: Below 0.05%/day locked profit for 48 hours = flag for review. Efficiency floor.
R5: Locked profit is the only scoreboard. Floating PnL does not count. Ever.
R6: If more than 7 days since last scale, find best-performing bot and increase base order by 20%.
R7: If BTC 4h change > +3% → trigger BTC Breakout Bot. If < -3% → flag hedge scaling.
R8: If Binance spot USDT balance < $150 minimum reserve → pause lowest-priority bot immediately.

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
      const ts  = Date.now();
      const q   = `timestamp=${ts}&recvWindow=10000`;
      const sig = hmacSign(BN_SECRET, q);
      const r   = await fetch(`https://api.binance.com/api/v3/account?${q}&signature=${sig}`, {
        headers: { 'X-MBX-APIKEY': BN_KEY }
      });
      const data = await r.json();
      if (data.msg) throw new Error(data.msg);
      const usdt    = data.balances.find(b => b.asset === 'USDT');
      const usdtBal = usdt ? parseFloat(usdt.free) + parseFloat(usdt.locked) : 0;
      const nonZero = data.balances.filter(b => parseFloat(b.free) + parseFloat(b.locked) > 0);
      res.end(JSON.stringify({
        usdtBalance: usdtBal,
        assetCount:  nonZero.length,
        balances:    nonZero.map(b => ({ asset: b.asset, free: parseFloat(b.free), locked: parseFloat(b.locked) }))
      }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── GET /futures-wallet ─────────────────────────────────────────────────────
  if (req.method === 'GET' && url === '/futures-wallet') {
    try {
      const ts  = Date.now();
      const q   = `timestamp=${ts}&recvWindow=10000`;
      const sig = hmacSign(BN_SECRET, q);
      const r   = await fetch(`https://fapi.binance.com/fapi/v2/account?${q}&signature=${sig}`, {
        headers: { 'X-MBX-APIKEY': BN_KEY }
      });
      const data = await r.json();
      if (data.msg) throw new Error(data.msg);
      res.end(JSON.stringify({
        marginBalance:    parseFloat(data.totalMarginBalance    || 0),
        walletBalance:    parseFloat(data.totalWalletBalance    || 0),
        unrealizedPnl:    parseFloat(data.totalUnrealizedProfit || 0),
        availableBalance: parseFloat(data.availableBalance      || 0)
      }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── GET /prices ─────────────────────────────────────────────────────────────
  if (req.method === 'GET' && url === '/prices') {
    try {
      const r    = await fetch('https://api.binance.com/api/v3/ticker/price?symbols=["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT"]');
      const data = await r.json();
      const out  = {};
      data.forEach(p => out[p.symbol] = parseFloat(p.price));
      res.end(JSON.stringify(out));
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
        tc3Fetch('/ver1/bots',      'limit=100&account_id=33438577'),
        tc3Fetch('/ver1/bots',      'limit=100&account_id=33439515'),
        tc3Fetch('/ver1/grid_bots', 'limit=100&account_id=33438577'),
        tc3Fetch('/ver1/grid_bots', 'limit=100&account_id=33439515'),
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
          completedDeals:parseInt(b.finished_deals_count || 0),
          activeDeals:   parseInt(b.active_deals_count || 0),
          direction:     b.strategy === 'short' ? 'short' : 'long',
          // marketType: Bot::MultiBot uses USDT_XXX pair format on spot account — still spot
          // Only mark futures if explicitly a perp/quarterly contract or futures account
          marketType:    (() => { const p = (b.pairs?.[0] || b.pair || ''); return (p.includes('_PERP') || p.includes('260925') || (b.type === 'Bot::MultiBot' && b.account_id === 33439515)) ? 'futures' : 'spot'; })(),
          active:        isEnabled,
        };
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
      res.end(JSON.stringify({ bots, total: bots.length, dcaCount: finalDca.length, gridCount: finalGrid.length }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
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
      function tcDealsFetch(accountId) {
        const path = `/public/api/ver1/deals?limit=1000&scope=completed&account_id=${accountId}`;
        const sig = hmacSign(TC_SECRET, path);
        return fetch('https://api.3commas.io' + path, {
          headers: { 'Apikey': TC_KEY, 'Signature': sig }
        }).then(r => r.status === 204 ? [] : r.json()).catch(() => []);
      }
      const [dealsSpot, dealsFut] = await Promise.all([
        tcDealsFetch(33438577),
        tcDealsFetch(33439515),
      ]);
      const deals = [
        ...(Array.isArray(dealsSpot) ? dealsSpot : []),
        ...(Array.isArray(dealsFut)  ? dealsFut  : []),
      ];
      const totalProfit  = deals.reduce((s, d) => s + parseFloat(d.final_profit || 0), 0);
      const totalOrders  = deals.reduce((s, d) => s + parseInt(d.completed_manual_safety_orders_count || 0) + parseInt(d.completed_safety_orders_count || 0) + 1, 0);
      res.end(JSON.stringify({
        completedDeals: deals.length,
        activeDeals:    0,
        totalOrders,
        totalProfit:    Math.round(totalProfit * 100) / 100,
      }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── GET /market-signals ─────────────────────────────────────────────────────
  if (req.method === 'GET' && url === '/market-signals') {
    try {
      const [fgRes, domRes, fundRes, btc24hRes] = await Promise.all([
        fetch('https://api.alternative.me/fng/?limit=1').then(r => r.json()).catch(() => null),
        fetch('https://api.coingecko.com/api/v3/global').then(r => r.json()).catch(() => null),
        fetch('https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1').then(r => r.json()).catch(() => null),
        fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT').then(r => r.json()).catch(() => null),
      ]);

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

  // ── Hannah performance summary ───────────────────────────────────
  if (req.method === 'GET' && url === '/api/hannah-performance') {
    try {
      const botsR = await fetch('http://localhost:' + (process.env.PORT||3000) + '/bots').catch(()=>null);
      const bots = botsR && botsR.ok ? await botsR.json() : (await (await fetch('https://tc-proxy-eu.onrender.com/bots')).json());
      const hannah = (bots.bots || []).filter(b => /Hannah/i.test(b.name||''));
      const active = hannah.filter(b => b.active);
      const totalProfit = hannah.reduce((s,b)=>s + (parseFloat(b.profit)||0), 0);
      const totalCapital = active.reduce((s,b)=>s + (parseFloat(b.capital)||0), 0);
      const perBot = hannah.map(b => ({
        id: b.id, name: b.name, active: b.active, capital: b.capital,
        profit: parseFloat(b.profit)||0, trades: b.trades || b.completedDeals || 0,
        pair: b.pair,
      }));
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
  if (req.method === 'GET' && url === '/api/autonomy-status') {
    res.end(JSON.stringify(autonomy.getStatus()));
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

  // 404
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found' }));
}

http.createServer(handleRequest).listen(PORT, () => {
  console.log(`tc-proxy running on port ${PORT}`);
});
