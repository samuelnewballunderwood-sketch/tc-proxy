const crypto = require('crypto');
const http = require('http');
const PORT = process.env.PORT || 3000;

function hmacSign(secret, message) {
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}
function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
  });
}

// ── Market Signals — Fear & Greed, BTC Dominance, Funding Rate ────────────
function deriveRegime(fg) {
  if (fg === null) return 'UNKNOWN';
  if (fg <= 25) return 'EXTREME_FEAR';
  if (fg <= 45) return 'FEAR';
  if (fg <= 55) return 'NEUTRAL';
  if (fg <= 75) return 'GREED';
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

  // ── GET /my-ip ────────────────────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/my-ip') {
    try {
      const r = await fetch('https://api.ipify.org?format=json');
      const d = await r.json();
      res.end(JSON.stringify({ ip: d.ip, note: 'Render proxy outbound IPv4' }));
    } catch(e) { res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── GET /market-signals — Fear & Greed, BTC dominance, funding rate ───────
  if (req.method === 'GET' && req.url === '/market-signals') {
    try {
      const [fgRes, dominanceRes, fundingRes] = await Promise.allSettled([
        fetch('https://api.alternative.me/fng/?limit=2').then(r => r.json()),
        fetch('https://api.coingecko.com/api/v3/global').then(r => r.json()),
        fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT').then(r => r.json()),
      ]);
      const fg = fgRes.status === 'fulfilled' ? fgRes.value?.data?.[0] : null;
      const dom = dominanceRes.status === 'fulfilled'
        ? dominanceRes.value?.data?.market_cap_percentage?.btc : null;
      const funding = fundingRes.status === 'fulfilled'
        ? parseFloat(fundingRes.value?.lastFundingRate || 0) * 100 : null;
      res.end(JSON.stringify({
        fearGreed: {
          value: fg ? parseInt(fg.value) : null,
          classification: fg?.value_classification || null,
          timestamp: fg?.timestamp || null,
        },
        btcDominance: dom ? parseFloat(dom.toFixed(2)) : null,
        btcFundingRate: funding ? parseFloat(funding.toFixed(4)) : null,
        regime: deriveRegime(fg ? parseInt(fg.value) : null),
        timestamp: Date.now(),
      }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── GET /binance/algo-spot ────────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/binance/algo-spot') {
    try {
      const ts = Date.now();
      const q = `timestamp=${ts}&recvWindow=10000`;
      const sig = hmacSign(BN_SECRET, q);
      const r = await fetch(`https://api.binance.com/sapi/v1/algo/spot/openOrders?${q}&signature=${sig}`, { headers: { 'X-MBX-APIKEY': BN_KEY } });
      const data = await r.json();
      res.end(JSON.stringify({ ok: r.status === 200, status: r.status, data }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── GET /binance/grid-spot ────────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/binance/grid-spot') {
    try {
      const ts = Date.now();
      const q = `timestamp=${ts}&recvWindow=10000`;
      const sig = hmacSign(BN_SECRET, q);
      const r = await fetch(`https://api.binance.com/sapi/v2/grid/spot/getOpenOrders?${q}&signature=${sig}`, { headers: { 'X-MBX-APIKEY': BN_KEY } });
      const data = await r.json();
      res.end(JSON.stringify({ ok: r.status === 200, status: r.status, data }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── GET /binance/grid-futures ─────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/binance/grid-futures') {
    try {
      const ts = Date.now();
      const q = `timestamp=${ts}&recvWindow=10000`;
      const sig = hmacSign(BN_SECRET, q);
      const r = await fetch(`https://api.binance.com/sapi/v2/grid/futures/getOpenOrders?${q}&signature=${sig}`, { headers: { 'X-MBX-APIKEY': BN_KEY } });
      const data = await r.json();
      res.end(JSON.stringify({ ok: r.status === 200, status: r.status, data }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── GET /binance/algo-futures ─────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/binance/algo-futures') {
    try {
      const ts = Date.now();
      const q = `timestamp=${ts}&recvWindow=10000`;
      const sig = hmacSign(BN_SECRET, q);
      const r = await fetch(`https://api.binance.com/sapi/v1/algo/futures/openOrders?${q}&signature=${sig}`, { headers: { 'X-MBX-APIKEY': BN_KEY } });
      const data = await r.json();
      res.end(JSON.stringify({ ok: r.status === 200, status: r.status, data }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── GET /binance/spot-bots ────────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/binance/spot-bots') {
    try {
      const ts = Date.now();
      const q = `timestamp=${ts}&recvWindow=10000`;
      const sig = hmacSign(BN_SECRET, q);
      const r = await fetch(`https://api.binance.com/sapi/v2/algo/spot/openOrders?${q}&signature=${sig}`, { headers: { 'X-MBX-APIKEY': BN_KEY } });
      const data = await r.json();
      res.end(JSON.stringify({ ok: r.status === 200, status: r.status, data }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── GET /bots — list all 3Commas bots ─────────────────────────────────────
  if (req.method === 'GET' && req.url.startsWith('/bots')) {
    try {
      const path = '/public/api/ver1/bots?limit=50&sort_by=created_at&sort_direction=desc';
      const sig = hmacSign(TC_SECRET, path);
      const r = await fetch('https://api.3commas.io' + path, {
        headers: { 'APIKEY': TC_KEY, 'Signature': sig, 'Content-Type': 'application/json', 'Accept': 'application/json' }
      });
      const raw = await r.text();
      let data = JSON.parse(raw);
      if (!Array.isArray(data)) throw new Error(raw.slice(0, 300));
      const bots = data.map(bot => {
        const baseVol   = parseFloat(bot.base_order_volume || 0);
        const safetyVol = parseFloat(bot.safety_order_volume || 0);
        const maxSafety = parseInt(bot.max_safety_orders || 0);
        const capital   = Math.round(baseVol + (safetyVol * maxSafety));
        const name      = (bot.name || '').toLowerCase();
        const strategy  = (bot.strategy || '').toLowerCase();
        const direction = (strategy === 'short' || name.includes('short') || name.includes('hedge')) ? 'short' : 'long';
        const pairs     = bot.pairs?.[0] || bot.pair || '';
        const isSpot    = !name.includes('futures') && !name.includes('perp');
        return {
          id: bot.id, name: bot.name, enabled: bot.is_enabled, pair: pairs,
          profit: parseFloat(bot.total_profit_in_usd || 0),
          uprofit: parseFloat(bot.unrealized_profit_in_usd || bot.unrealized_profit || 0),
          activeDeals: bot.active_deals_count || 0,
          completedDeals: bot.completed_deals_count || 0,
          capital: capital || null, direction,
          marketType: isSpot ? 'spot' : 'futures',
          baseOrderVolume: baseVol, safetyOrderVolume: safetyVol,
          maxSafetyOrders: maxSafety, strategy: strategy || 'dca',
        };
      });
      res.end(JSON.stringify({ bots, totalProfit: bots.reduce((s,b) => s + b.profit, 0) }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── POST /bot/:id/enable ──────────────────────────────────────────────────
  if (req.method === 'POST' && /^\/bot\/\d+\/enable$/.test(req.url)) {
    const botId = req.url.split('/')[2];
    try {
      const path = `/ver1/bots/${botId}/enable`;
      const sig = hmacSign(TC_SECRET, path);
      const r = await fetch('https://api.3commas.io/public/api' + path, {
        method: 'POST',
        headers: { 'APIKEY': TC_KEY, 'Signature': sig, 'Content-Type': 'application/json', 'Accept': 'application/json' }
      });
      const raw = await r.text();
      if (r.status !== 200) throw new Error('3Commas error: ' + raw.slice(0,200));
      const data = JSON.parse(raw);
      res.end(JSON.stringify({ success: true, botId: parseInt(botId), enabled: data.is_enabled, name: data.name }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ success: false, error: e.message })); }
    return;
  }

  // ── POST /bot/:id/disable ─────────────────────────────────────────────────
  if (req.method === 'POST' && /^\/bot\/\d+\/disable$/.test(req.url)) {
    const botId = req.url.split('/')[2];
    try {
      const path = `/ver1/bots/${botId}/disable`;
      const sig = hmacSign(TC_SECRET, path);
      const r = await fetch('https://api.3commas.io/public/api' + path, {
        method: 'POST',
        headers: { 'APIKEY': TC_KEY, 'Signature': sig, 'Content-Type': 'application/json', 'Accept': 'application/json' }
      });
      const raw = await r.text();
      if (r.status !== 200) throw new Error('3Commas error: ' + raw.slice(0,200));
      const data = JSON.parse(raw);
      res.end(JSON.stringify({ success: true, botId: parseInt(botId), enabled: data.is_enabled, name: data.name }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ success: false, error: e.message })); }
    return;
  }

  // ── GET /bot/:id/deals ────────────────────────────────────────────────────
  if (req.method === 'GET' && /^\/bot\/\d+\/deals$/.test(req.url)) {
    const botId = req.url.split('/')[2];
    try {
      const path = `/public/api/ver1/deals?bot_id=${botId}&limit=500&order=created_at&order_direction=desc`;
      const sig = hmacSign(TC_SECRET, path);
      const r = await fetch('https://api.3commas.io' + path, {
        headers: { 'APIKEY': TC_KEY, 'Signature': sig, 'Content-Type': 'application/json', 'Accept': 'application/json' }
      });
      const raw = await r.text();
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) throw new Error(raw.slice(0,300));
      const completedDeals = data.filter(d => d.status === 'completed').length;
      const totalProfit = data.reduce((s, d) => s + parseFloat(d.actual_profit_in_usd || 0), 0);
      res.end(JSON.stringify({ botId: parseInt(botId), totalDeals: data.length, completedDeals, totalProfit: Math.round(totalProfit * 100) / 100 }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── GET /deals/summary ────────────────────────────────────────────────────
  if (req.method === 'GET' && req.url === '/deals/summary') {
    try {
      const path = `/public/api/ver1/deals?limit=500&order=created_at&order_direction=desc`;
      const sig = hmacSign(TC_SECRET, path);
      const r = await fetch('https://api.3commas.io' + path, {
        headers: { 'APIKEY': TC_KEY, 'Signature': sig, 'Content-Type': 'application/json', 'Accept': 'application/json' }
      });
      const raw = await r.text();
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) throw new Error(raw.slice(0,300));
      const completedDeals = data.filter(d => d.status === 'completed').length;
      const activeDeals    = data.filter(d => d.status === 'active').length;
      const totalProfit    = data.reduce((s, d) => s + parseFloat(d.actual_profit_in_usd || 0), 0);
      const totalOrders    = data.reduce((s, d) => s
        + (parseInt(d.completed_manual_safety_orders_count || 0))
        + (parseInt(d.completed_safety_orders_count || 0))
        + (parseInt(d.current_active_safety_orders_count || 0))
        + (d.status === 'completed' || d.bought_volume > 0 ? 1 : 0), 0);
      res.end(JSON.stringify({ completedDeals, activeDeals, totalOrders, totalProfit: Math.round(totalProfit * 100) / 100, dealCount: data.length }));
    } catch(e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }

  // ── 404 ───────────────────────────────────────────────────────────────────
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found.' }));
}

http.createServer(handleRequest).listen(PORT, () => console.log('TC Proxy running on port', PORT));
