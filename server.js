const crypto = require('crypto');
const http   = require('http');
const PORT   = process.env.PORT || 3000;

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
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.end('{}'); return; }

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

  // ── GET /bots  (3Commas) ────────────────────────────────────────────────────
  if (req.method === 'GET' && url === '/bots') {
    try {
      const qs   = 'limit=100';
      const path = '/ver1/bots';
      // 3Commas v1: sign path only (no query string)
      const sig  = hmacSign(TC_SECRET, path + '?' + qs);
      const r    = await fetch('https://api.3commas.io' + path + '?' + qs, {
        headers: { 'APIKEY': TC_KEY, 'Signature': sig, 'Accept': 'application/json', 'Content-Type': 'application/json' }
      });
      // 204 = valid empty response (no bots match query)
      if (r.status === 204) {
        res.end(JSON.stringify({ bots: [], total: 0 }));
        return;
      }
      const raw  = await r.text();
      let data;
      try { data = JSON.parse(raw); } catch(e) { throw new Error('3Commas HTTP ' + r.status + ' parse error: [' + raw.slice(0,400) + ']'); }
      if (!Array.isArray(data) && data.error) throw new Error('3Commas error HTTP ' + r.status + ': ' + JSON.stringify(data.error));
      const bots = (Array.isArray(data) ? data : []).map(b => ({
        id:            b.id,
        name:          b.name,
        pair:          b.pairs?.[0] || b.pair,
        strategy:      b.strategy,
        capital:       parseFloat(b.base_order_volume || 0),
        profit:        parseFloat(b.completed_deals_usd_profit || 0),
        completedDeals:parseInt(b.finished_deals_count || 0),
        activeDeals:   parseInt(b.active_deals_count || 0),
        direction:     b.strategy === 'short' ? 'short' : 'long',
        marketType:    b.type === 'Bot::MultiBot' ? 'futures' : 'spot',
        active:        b.is_enabled,
      }));
      res.end(JSON.stringify({ bots, total: bots.length }));
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
      const path     = `/ver1/bots/${botId}/${endpoint}`;
      const sig      = hmacSign(TC_SECRET, path + '');
      const r        = await fetch(`https://api.3commas.io${path}`, {
        method: 'POST',
        headers: { 'APIKEY': TC_KEY, 'Signature': sig, 'Content-Type': 'application/json' },
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
      const dealsPath = '/ver1/deals?limit=1000&scope=completed';
      const sig = hmacSign(TC_SECRET, dealsPath);
      const r   = await fetch('https://api.3commas.io' + dealsPath, {
        headers: { 'APIKEY': TC_KEY, 'Signature': sig }
      });
      if (r.status === 204) {
        res.end(JSON.stringify({ completedDeals: 0, activeDeals: 0, totalOrders: 0, totalProfit: 0 }));
        return;
      }
      const data = await r.json();
      if (data.error) throw new Error(JSON.stringify(data.error));
      const deals        = Array.isArray(data) ? data : [];
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
      const [fgRes, domRes, fundRes] = await Promise.all([
        fetch('https://api.alternative.me/fng/?limit=1').then(r => r.json()).catch(() => null),
        fetch('https://api.coingecko.com/api/v3/global').then(r => r.json()).catch(() => null),
        fetch('https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1').then(r => r.json()).catch(() => null),
      ]);
      const fg       = fgRes?.data?.[0] ? { value: parseInt(fgRes.data[0].value), label: fgRes.data[0].value_classification } : null;
      const btcDom   = domRes?.data?.market_cap_percentage?.btc ? Math.round(domRes.data.market_cap_percentage.btc * 10) / 10 : null;
      const funding  = fundRes?.[0] ? parseFloat(fundRes[0].fundingRate) * 100 : null;
      const regime   = deriveRegime(fg?.value ?? null);
      res.end(JSON.stringify({ fearGreed: fg, btcDominance: btcDom, fundingRate: funding, regime }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // 404
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found' }));
}

http.createServer(handleRequest).listen(PORT, () => {
  console.log(`tc-proxy running on port ${PORT}`);
});
