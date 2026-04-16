const crypto = require('crypto');
const http   = require('http');
const PORT   = process.env.PORT || 3000;

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
- AlphaControl (alphacontrol.ai / bjbots.ai) — the flagship product. The intelligence layer between execution tools (3Commas) and tracking tools (CoinStats). A gap that doesn't exist at retail price point.
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

Active 3Commas Grid Bots (post April 12 bear switch):
- BTC SHORT x3 Futures Grid (BTCUSDT_260925) — $1,700 margin, range $62k-$78k, trailing down, +$7.09 so far
- ETH SHORT x3 Futures Grid (ETHUSDT_260925) — $800 margin, range $2,165-$2,450, just launched
- BTC/USDT LONG Spot Grid — $293 invested, +$7.61 locked, running 11 days, proven survivor
Closed April 12 (R2 violations): ETH LONG grid (-$2.76), SOL LONG grid (-$4.66), BTC LONG $500 grid (-$6.25)

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

HOW TO ANSWER QUESTIONS
1. Lead with the number or decision — never with "great question" or preamble
2. Always anchor recommendations to the current regime and F&G
3. Always distinguish locked profit from floating — if someone asks "how are we doing", give locked profit first, floating second with a clear label
4. If a bot has been open for >24 hours with no trade, flag it proactively
5. If F&G is below 30, your first response should always include the R2 status
6. Capital recommendations must respect R8 — never let spot USDT fall below $150
7. When asked what to do, give a specific action (start/stop/scale X bot) not a vague suggestion

PORTFOLIO CONTEXT will be injected into each message — use it to give specific, accurate answers.`;


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

      // Build per-bot profit map from completed deals
      const dealProfitByBot = {};
      (dealsRaw || []).forEach(d => {
        const botId = d.bot_id;
        if (!botId) return;
        const profit = parseFloat(d.final_profit || 0);
        dealProfitByBot[botId] = (dealProfitByBot[botId] || 0) + profit;
      });

      // Normalise DCA/signal bots
      const dcaBots = dcaRaw.map(b => {
        const isEnabled = b.is_enabled === true;
        const dealProfit = dealProfitByBot[b.id] || 0;
        const reportedProfit = parseFloat(b.completed_deals_usd_profit || 0);
        const profit = reportedProfit !== 0 ? reportedProfit : dealProfit;
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

      // No manual capital overrides — investment_quote_currency confirmed accurate from API
      // Active bots return their real invested USDT; closed/disabled return 0.0
      const KNOWN_GRID_CAPITAL = {};

      // Normalise grid bots
      const gridBots = gridRaw.map(b => {
        // Detect direction from name or pair
        const name = (b.name || '').toUpperCase();
        const pair = (b.pair || '').toUpperCase();
        // SHORT grids: contains SHORT in name, or futures quarterly (260925) with price trending
        // For quarterly futures grids, direction is set by the grid type in 3Commas
        // We detect it: if name has SHORT or if it's a futures grid we launched as short
        const isFuturesGrid = name.includes('260925') || pair.includes('260925') ||
          (b.type || '').toLowerCase().includes('future');
        const isShortGrid = name.includes('SHORT') ||
          (isFuturesGrid && ['2758668','2758366'].includes(String(b.id)));

        // Capital: use known override first, then API investment, then 0
        let capital = KNOWN_GRID_CAPITAL[b.id];
        if (capital === undefined) {
          // 3Commas grid bot capital: try multiple fields
          const apiInvestment = parseFloat(b.investment || 0);
          const apiQuote = parseFloat(b.investment_quote_currency || 0);
          const apiBase  = parseFloat(b.investment_base_currency  || 0);
          const upperP   = parseFloat(b.upper_price || 0);
          // Use quote investment (USDT value) if available
          if (apiQuote > 0) {
            capital = apiQuote;
          } else if (apiInvestment > 0 && apiInvestment < upperP * 0.5) {
            capital = apiInvestment;
          } else if (apiBase > 0) {
            capital = apiBase;
          } else {
            capital = 0;
          }
        }

        // Active: 3Commas grid bots use is_enabled (not is_active or enabled)
        const isActive = b.is_enabled === true || b.is_active === true || b.enabled === true;

        return {
          id:            b.id,
          name:          b.name,
          pair:          b.pair || (b.currency_pair ? b.currency_pair.replace('_', '') : null),
          strategy:      'grid',
          botType:       'grid',
          capital,
          profit:        parseFloat(b.total_profit || b.current_profit || 0),
          completedDeals:parseInt(b.grids_quantity || 0),
          activeDeals:   isActive ? 1 : 0,
          direction:     isShortGrid ? 'short' : 'long',
          marketType:    isFuturesGrid ? 'futures' : 'spot',
          active:        isActive,
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

  // ── GET /deals/summary ──────────────────────────────────────────────────────
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
        gridBots: Array.isArray(gridAll) ? gridAll.map(b=>({id:b.id,name:b.name,account_id:b.account_id,enabled:b.is_enabled,investment:b.investment,investment_quote:b.investment_quote_currency})) : gridAll,
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
          from: 'AlphaControl <alerts@bjbots.ai>',
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

  // 404
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found' }));
}

http.createServer(handleRequest).listen(PORT, () => {
  console.log(`tc-proxy running on port ${PORT}`);
});
