function sendJson(response, status, value, method = 'GET') {
  const body = JSON.stringify(value);
  response.statusCode = status;
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Content-Length', Buffer.byteLength(body));
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (method === 'HEAD') response.end();
  else response.end(body);
}

export function browserSafeConfig(env = process.env) {
  const url = env.CYBERLIGA_SUPABASE_URL || env.SUPABASE_URL || '';
  const publishableKey = env.CYBERLIGA_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || '';
  const modernKey = publishableKey.startsWith('sb_publishable_') ? publishableKey : '';
  const available = Boolean(url && modernKey);
  return {
    schemaVersion: 1,
    // Top-level names are consumed by the dependency-free browser bridge.
    supabaseUrl: available ? url.replace(/\/+$/, '') : '',
    supabasePublishableKey: available ? modernKey : '',
    backend: {
      mode: available ? 'supabase' : 'deterministic-fallback',
      available
    },
    supabase: {
      url: available ? url.replace(/\/+$/, '') : null,
      publishableKey: available ? modernKey : null
    },
    endpoints: {
      live: '/api/live',
      league: '/api/league'
    }
  };
}

export default async function handler(request, response) {
  const method = request.method || 'GET';
  if (method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    response.setHeader('Cache-Control', 'no-store');
    response.statusCode = 204;
    response.end();
    return;
  }
  if (method !== 'GET' && method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD, OPTIONS');
    sendJson(response, 405, { error: 'method_not_allowed' }, method);
    return;
  }
  sendJson(response, 200, browserSafeConfig(), method);
}
