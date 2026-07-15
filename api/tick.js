import { timingSafeEqual } from 'node:crypto';
import { canonicalTickPayload } from '../lib/canonical-server.js';

const DUE_FIXTURE_SELECT = [
  'public_id', 'round_number', 'channel', 'seed', 'starts_at', 'scheduled_end_at', 'status',
  'season:seasons!fixtures_season_id_fkey(public_id,sport_key,name,status)',
  'home_team:teams!fixtures_home_team_id_fkey(public_id,name,code,city,primary_color,athletes:athletes!athletes_team_id_fkey(public_id,role,squad_number,active,sport_key,is_public))',
  'away_team:teams!fixtures_away_team_id_fkey(public_id,name,code,city,primary_color,athletes:athletes!athletes_team_id_fkey(public_id,role,squad_number,active,sport_key,is_public))'
].join(',');

function setCommonHeaders(response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
}

function sendJson(response, status, value, method = 'GET') {
  const body = JSON.stringify(value);
  response.statusCode = status;
  response.setHeader('Content-Length', Buffer.byteLength(body));
  if (method === 'HEAD') response.end();
  else response.end(body);
}

function equalSecret(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  return leftBuffer.length === rightBuffer.length && leftBuffer.length > 0 && timingSafeEqual(leftBuffer, rightBuffer);
}

function suppliedSecret(request) {
  const authorization = request.headers?.authorization || request.headers?.Authorization || '';
  if (authorization.startsWith('Bearer ')) return authorization.slice(7);
  return request.headers?.['x-cyberliga-cron-secret'] || '';
}

function serviceConfig(env = process.env) {
  const url = env.CYBERLIGA_SUPABASE_URL || env.SUPABASE_URL || '';
  const key = env.CYBERLIGA_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('Supabase service REST configuration is incomplete.');
  return { url: url.replace(/\/+$/, ''), key };
}

async function serviceFetch(config, path, { method = 'GET', parameters, body } = {}) {
  const query = parameters ? `?${new URLSearchParams(parameters)}` : '';
  const response = await fetch(`${config.url}/rest/v1/${path}${query}`, {
    method,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1_000);
    throw new Error(`Supabase REST ${response.status}: ${detail}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function parseBody(request) {
  if (!request.body) return {};
  if (typeof request.body === 'object') return request.body;
  if (typeof request.body === 'string') return JSON.parse(request.body);
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

export default async function handler(request, response) {
  const method = request.method || 'GET';
  setCommonHeaders(response);
  if (method !== 'GET' && method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    sendJson(response, 405, { error: 'method_not_allowed' }, method);
    return;
  }

  const requiredSecret = process.env.CYBERLIGA_CRON_SECRET || '';
  if (!requiredSecret) {
    sendJson(response, 503, { error: 'cron_secret_not_configured' }, method);
    return;
  }
  if (!equalSecret(suppliedSecret(request), requiredSecret)) {
    sendJson(response, 401, { error: 'unauthorized' }, method);
    return;
  }

  try {
    const input = method === 'POST' ? await parseBody(request) : {};
    const observedAt = input.observedAt ? new Date(input.observedAt) : new Date();
    if (!Number.isFinite(observedAt.getTime())) {
      sendJson(response, 400, { error: 'invalid_observed_at' }, method);
      return;
    }
    const limit = Math.max(1, Math.min(64, Number(input.limit) || 32));
    const config = serviceConfig();
    const parameters = {
      select: DUE_FIXTURE_SELECT,
      starts_at: `lte.${observedAt.toISOString()}`,
      status: 'in.(scheduled,live)',
      order: 'starts_at.asc,channel.asc',
      limit: String(limit)
    };
    if (input.fixtureId) parameters.public_id = `eq.${input.fixtureId}`;
    const fixtures = await serviceFetch(config, 'fixtures', { parameters });
    const results = await mapLimit(fixtures ?? [], 4, async (fixture) => {
      const payload = canonicalTickPayload(fixture, observedAt);
      return serviceFetch(config, 'rpc/canonical_apply_tick', { method: 'POST', body: payload });
    });

    sendJson(response, 200, {
      ok: true,
      observedAt: observedAt.toISOString(),
      processed: results.length,
      results
    }, method);
  } catch (error) {
    console.error('[cyberliga/api/tick]', error);
    sendJson(response, 503, {
      error: 'canonical_tick_failed',
      message: error instanceof Error ? error.message : 'Unknown tick failure.'
    }, method);
  }
}
