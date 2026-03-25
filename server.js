const crypto = require('crypto');
const http = require('http');

const TC_KEY = process.env.TC_API_KEY;
const TC_SECRET = process.env.TC_SECRET;
const PORT = process.env.PORT || 3000;

function hmacSign(secret, message) {
    return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

async function handleRequest(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'OPTIONS') { res.end('{}'); return; }

  if (req.url.startsWith('/bots')) {
        try {
                const path = '/public/api/ver1/bots?limit=50&sort_by=created_at&sort_direction=desc';
                const sig = hmacSign(TC_SECRET, path);
                console.log('Calling 3Commas, key prefix:', TC_KEY ? TC_KEY.slice(0,8) : 'MISSING');

          const r = await fetch('https://api.3commas.io' + path, {
                    headers: {
                                'APIKEY': TC_KEY,
                                'Signature': sig,
                                'Content-Type': 'application/json'
                    }
          });

          const raw = await r.text();
                console.log('3Commas status:', r.status, 'response:', raw.slice(0, 150));

          let data = JSON.parse(raw);
                if (!Array.isArray(data)) throw new Error(raw.slice(0, 300));

          const bots = data.map(bot => ({
                    id: bot.id, name: bot.name, enabled: bot.is_enabled,
                    pair: bot.pairs?.[0] || bot.pair,
                    profit: parseFloat(bot.total_profit_in_usd || 0),
                    activeDeals: bot.active_deals_count || 0,
                    completedDeals: bot.completed_deals_count || 0
          }));
                res.end(JSON.stringify({ bots, totalProfit: bots.reduce((s, b) => s + b.profit, 0) }));
        } catch(e) {
                console.error('Error:', e.message);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: e.message }));
        }
  } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Use /bots' }));
  }
}

http.createServer(handleRequest).listen(PORT, () => console.log('TC Proxy running on port', PORT));
