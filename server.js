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

async function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.end('{}'); return; }

  const TC_KEY    = process.env.TC_API_KEY;
  const TC_SECRET = process.env.TC_SECRET;

  // ── GET /bots — list all bots ──────────────────────────────────────────────
  if (req.method === 'GET' && req.url.startsWith('/bots')) {
    try {
      const path = '/public/api/ver1/bots?limit=50&sort_by=created_at&sort_direction=desc';
      const sig  = hmacSign(TC_SECRET, path);
      console.log('Key prefix:', TC_KEY ? TC_KEY.slice(0,8) : 'MISSING');
      const r    = await fetch('https://api.3commas.io' + path, {
        headers: { 'APIKEY': TC_KEY, 'Signature': sig, 'Content-Type': 'application/json', 'Accept': 'application/json' }
      });
      const raw  = await r.text();
      console.log('Status:', r.status, 'Body:', raw.slice(0, 150));
      let data = JSON.parse(raw);
      if (!Array.isArray(data)) throw new Error(raw.slice(0, 300));
      const bots = data.map(bot => {
        const baseVol   = parseFloat(bot.base_order_volume   || 0);
        const safetyVol = parseFloat(bot.safety_order_volume || 0);
        const maxSafety = parseInt(bot.max_safety_orders     || 0);
        const capital   = Math.round(baseVol + (safetyVol * maxSafety));
        const name      = (bot.name || '').toLowerCase();
        const strategy  = (bot.strategy || '').toLowerCase();
        const direction = (strategy === 'short' || name.includes('short') || name.includes('hedge')) ? 'short' : 'long';
        const pairs     = bot.pairs?.[0] || bot.pair || '';
        const isSpot    = !name.includes('futures') && !name.includes('perp');
        return {
          id:               bot.id,
          name:             bot.name,
          enabled:          bot.is_enabled,
          pair:             pairs,
          profit:           parseFloat(bot.total_profit_in_usd || 0),
          activeDeals:      bot.active_deals_count    || 0,
          completedDeals:   bot.completed_deals_count || 0,
          capital:          capital || null,
          direction,
          marketType:       isSpot ? 'spot' : 'futures',
          baseOrderVolume:  baseVol,
          safetyOrderVolume:safetyVol,
          maxSafetyOrders:  maxSafety,
        };
      });
      res.end(JSON.stringify({ bots, totalProfit: bots.reduce((s,b) => s + b.profit, 0) }));
    } catch(e) {
      console.error('Error:', e.message);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── POST /bot/:id/enable ───────────────────────────────────────────────────
  if (req.method === 'POST' && /^\/bot\/\d+\/enable$/.test(req.url)) {
    const botId = req.url.split('/')[2];
    try {
      const path = `/ver1/bots/${botId}/enable`;
      const sig  = hmacSign(TC_SECRET, path);
      const r    = await fetch('https://api.3commas.io/public/api' + path, {
        method: 'POST',
        headers: { 'APIKEY': TC_KEY, 'Signature': sig, 'Content-Type': 'application/json', 'Accept': 'application/json' }
      });
      const raw  = await r.text();
      console.log('Enable bot', botId, 'status:', r.status);
      if (r.status !== 200) throw new Error('3Commas error: ' + raw.slice(0,200));
      const data = JSON.parse(raw);
      res.end(JSON.stringify({ success: true, botId: parseInt(botId), enabled: data.is_enabled, name: data.name }));
    } catch(e) {
      console.error('Enable error:', e.message);
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // ── POST /bot/:id/disable ──────────────────────────────────────────────────
  if (req.method === 'POST' && /^\/bot\/\d+\/disable$/.test(req.url)) {
    const botId = req.url.split('/')[2];
    try {
      const path = `/ver1/bots/${botId}/disable`;
      const sig  = hmacSign(TC_SECRET, path);
      const r    = await fetch('https://api.3commas.io/public/api' + path, {
        method: 'POST',
        headers: { 'APIKEY': TC_KEY, 'Signature': sig, 'Content-Type': 'application/json', 'Accept': 'application/json' }
      });
      const raw  = await r.text();
      console.log('Disable bot', botId, 'status:', r.status);
      if (r.status !== 200) throw new Error('3Commas error: ' + raw.slice(0,200));
      const data = JSON.parse(raw);
      res.end(JSON.stringify({ success: true, botId: parseInt(botId), enabled: data.is_enabled, name: data.name }));
    } catch(e) {
      console.error('Disable error:', e.message);
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // ── 404 ───────────────────────────────────────────────────────────────────
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found. Available: GET /bots, POST /bot/:id/enable, POST /bot/:id/disable' }));
}

http.createServer(handleRequest).listen(PORT, () => console.log('TC Proxy running on port', PORT));
