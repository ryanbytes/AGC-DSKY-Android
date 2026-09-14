const DEFAULT_ORIGIN = 'https://ryanbytes.github.io';
const DEVICE_VALUES = new Set(['iphone', 'ipad', 'android', 'mac', 'windows', 'linux', 'other']);
const EVENT_VALUES = new Set(['launch', 'install']);
const encoder = new TextEncoder();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers
    }
  });
}

function allowedOrigins(env) {
  return new Set(String(env.ALLOWED_ORIGINS || DEFAULT_ORIGIN)
    .split(',')
    .map(value => value.trim())
    .filter(Boolean));
}

function corsFor(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin || !allowedOrigins(env).has(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

async function clientHash(clientId, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(clientId));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
}

function validClientId(value) {
  return typeof value === 'string' && /^[a-f0-9-]{32,64}$/i.test(value);
}

async function recordEvent(request, env) {
  const cors = corsFor(request, env);
  if (!cors) return json({error: 'origin not allowed'}, 403);
  if (!env.DB) return json({error: 'database binding missing'}, 503, cors);
  if (!env.ANALYTICS_SECRET) return json({error: 'analytics secret missing'}, 503, cors);

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 2048) return json({error: 'payload too large'}, 413, cors);
    body = JSON.parse(raw);
  } catch (_) {
    return json({error: 'invalid JSON'}, 400, cors);
  }

  const event = String(body.event || '').toLowerCase();
  const clientId = body.clientId;
  const standalone = body.standalone === true ? 1 : 0;
  const device = DEVICE_VALUES.has(body.device) ? body.device : 'other';
  const build = typeof body.build === 'string' ? body.build.slice(0, 64) : '';

  if (!EVENT_VALUES.has(event)) return json({error: 'invalid event'}, 400, cors);
  if (!validClientId(clientId)) return json({error: 'invalid client id'}, 400, cors);

  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const hash = await clientHash(clientId, env.ANALYTICS_SECRET);
  const launches = event === 'launch' ? 1 : 0;
  const installs = event === 'install' ? 1 : 0;

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO clients
        (client_hash, first_seen, last_seen, last_device, last_build, ever_standalone, launch_count, install_events)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(client_hash) DO UPDATE SET
        last_seen = excluded.last_seen,
        last_device = excluded.last_device,
        last_build = excluded.last_build,
        ever_standalone = MAX(clients.ever_standalone, excluded.ever_standalone),
        launch_count = clients.launch_count + excluded.launch_count,
        install_events = clients.install_events + excluded.install_events
    `).bind(hash, now, now, device, build, standalone, launches, installs),
    env.DB.prepare(`
      INSERT INTO daily_usage (day, client_hash, device, standalone, launches, install_events)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(day, client_hash) DO UPDATE SET
        device = excluded.device,
        standalone = MAX(daily_usage.standalone, excluded.standalone),
        launches = daily_usage.launches + excluded.launches,
        install_events = daily_usage.install_events + excluded.install_events
    `).bind(day, hash, device, standalone, launches, installs)
  ]);

  return json({ok: true}, 202, cors);
}

function firstRow(result) {
  return result && Array.isArray(result.results) && result.results[0] ? result.results[0] : {};
}

async function getStats(env) {
  if (!env.DB) return json({error: 'database binding missing'}, 503);

  const [summaryResult, todayResult, activeResult, devicesResult, daysResult] = await env.DB.batch([
    env.DB.prepare(`
      SELECT
        COUNT(*) AS users,
        COALESCE(SUM(launch_count), 0) AS launches,
        COALESCE(SUM(CASE WHEN ever_standalone = 1 THEN 1 ELSE 0 END), 0) AS standalone_users,
        COALESCE(SUM(install_events), 0) AS install_events
      FROM clients
    `),
    env.DB.prepare(`
      SELECT COUNT(*) AS users, COALESCE(SUM(launches), 0) AS launches
      FROM daily_usage WHERE day = date('now')
    `),
    env.DB.prepare(`
      SELECT COUNT(*) AS users FROM clients
      WHERE last_seen >= datetime('now', '-7 days')
    `),
    env.DB.prepare(`
      SELECT last_device AS device, COUNT(*) AS users
      FROM clients GROUP BY last_device ORDER BY users DESC
    `),
    env.DB.prepare(`
      SELECT day, COUNT(*) AS users, COALESCE(SUM(launches), 0) AS launches
      FROM daily_usage
      WHERE day >= date('now', '-29 days')
      GROUP BY day ORDER BY day ASC
    `)
  ]);

  const summary = firstRow(summaryResult);
  const today = firstRow(todayResult);
  const active = firstRow(activeResult);

  return json({
    generated_at: new Date().toISOString(),
    users: Number(summary.users || 0),
    launches: Number(summary.launches || 0),
    standalone_users: Number(summary.standalone_users || 0),
    install_events: Number(summary.install_events || 0),
    active_7d: Number(active.users || 0),
    today: {
      users: Number(today.users || 0),
      launches: Number(today.launches || 0)
    },
    devices: (devicesResult.results || []).map(row => ({device: row.device, users: Number(row.users || 0)})),
    days: (daysResult.results || []).map(row => ({day: row.day, users: Number(row.users || 0), launches: Number(row.launches || 0)}))
  }, 200, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=60'
  });
}

function dashboard() {
  return new Response(`<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AGC DSKY usage</title>
<style>
body{font:16px system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 18px;background:#111;color:#eee}h1{font-size:24px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.card{background:#1d1d1d;border:1px solid #333;border-radius:12px;padding:16px}.n{font-size:30px;font-weight:700}.k{color:#aaa}.small{color:#aaa;font-size:13px;margin-top:22px}table{width:100%;border-collapse:collapse;margin-top:24px}td,th{padding:8px;border-bottom:1px solid #333;text-align:left}</style>
<h1>AGC DSKY usage</h1><div id="app">Loading…</div>
<script>
fetch('./v1/stats').then(r=>r.json()).then(s=>{
 const cards=[['Users',s.users],['Launches',s.launches],['Home Screen users',s.standalone_users],['Active 7 days',s.active_7d],['Users today',s.today.users],['Launches today',s.today.launches]];
 const devices=s.devices.map(d=>'<tr><td>'+d.device+'</td><td>'+d.users+'</td></tr>').join('');
 document.getElementById('app').innerHTML='<div class="grid">'+cards.map(c=>'<div class="card"><div class="n">'+c[1]+'</div><div class="k">'+c[0]+'</div></div>').join('')+'</div><table><thead><tr><th>Device</th><th>Users</th></tr></thead><tbody>'+devices+'</tbody></table><div class="small">Anonymous aggregate telemetry only. No IP address, location, AGC inputs, simulator state, camera data, or sensor data are stored. Updated '+new Date(s.generated_at).toLocaleString()+'.</div>';
}).catch(e=>document.getElementById('app').textContent='Unable to load stats: '+e);
</script></html>`, {
    headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60'}
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS' && url.pathname === '/v1/event') {
      const cors = corsFor(request, env);
      return cors ? new Response(null, {status: 204, headers: cors}) : new Response(null, {status: 403});
    }
    if (request.method === 'POST' && url.pathname === '/v1/event') return recordEvent(request, env);
    if (request.method === 'GET' && url.pathname === '/v1/stats') return getStats(env);
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/stats')) return dashboard();
    return json({error: 'not found'}, 404);
  }
};
