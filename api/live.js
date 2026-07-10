import { buildFallbackLive, FALLBACK_LEAGUES } from '../lib/canonical-server.js';

const LIVE_SELECT = [
  'public_id', 'round_number', 'channel', 'seed', 'starts_at', 'scheduled_end_at', 'status', 'venue',
  'season:seasons!fixtures_season_id_fkey!inner(public_id,sport_key,name,status)',
  'home_team:teams!fixtures_home_team_id_fkey(public_id,name,code,city,primary_color)',
  'away_team:teams!fixtures_away_team_id_fkey(public_id,name,code,city,primary_color)',
  'match:matches!matches_fixture_id_fkey(public_id,status,phase,revision,elapsed_ms,home_score,away_score,snapshot,last_tick_at,finalized_at,presence:presence_aggregates(concurrent_viewers,peak_viewers,reactions,country_count,bucket_at),events:match_events(sequence_no,event_key,event_time_ms,kind,occurred_at,payload,team:teams!match_events_team_id_fkey(public_id,code),athlete:athletes!match_events_athlete_team_fkey(public_id,display_name)))'
].join(',');

function setCommonHeaders(response, cacheControl = 'no-store') {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Cache-Control', cacheControl);
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

function publicConfig(env = process.env) {
  const url = env.CYBERLIGA_SUPABASE_URL || env.SUPABASE_URL || '';
  const key = env.CYBERLIGA_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || '';
  if (!url && !key) return null;
  if (!url || !key) throw new Error('Supabase public REST configuration is incomplete.');
  if (!key.startsWith('sb_publishable_')) throw new Error('Supabase public REST requires a modern publishable key.');
  return { url: url.replace(/\/+$/, ''), key };
}

async function restGet(config, table, parameters) {
  const query = new URLSearchParams(parameters);
  const response = await fetch(`${config.url}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      Accept: 'application/json'
    },
    signal: AbortSignal.timeout(7_500)
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 600);
    throw new Error(`Supabase REST ${response.status}: ${detail}`);
  }
  return response.json();
}

function one(value) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function publicTeam(row) {
  if (!row) return null;
  return {
    publicId: row.public_id,
    name: row.name,
    code: row.code,
    city: row.city,
    color: row.primary_color
  };
}

function publicEvent(row) {
  return {
    sequence: row.sequence_no,
    eventKey: row.event_key,
    elapsedMs: row.event_time_ms,
    kind: row.kind,
    occurredAt: row.occurred_at,
    teamId: row.team?.public_id ?? null,
    athleteId: row.athlete?.public_id ?? null,
    athleteName: row.athlete?.display_name ?? null,
    payload: row.payload ?? {}
  };
}

function publicFixture(row) {
  const match = one(row.match);
  const events = (match?.events ?? []).slice().sort((left, right) => left.sequence_no - right.sequence_no).map(publicEvent);
  const presence = (match?.presence ?? []).slice().sort((left, right) => String(right.bucket_at).localeCompare(String(left.bucket_at)))[0] ?? null;
  const startsAt = Date.parse(row.starts_at);
  const scheduledEndAt = Date.parse(row.scheduled_end_at);
  return {
    fixtureId: row.public_id,
    matchId: match?.public_id ?? null,
    sportKey: row.season?.sport_key,
    seasonId: row.season?.public_id,
    seasonName: row.season?.name,
    roundNumber: row.round_number,
    channel: row.channel,
    status: match?.status ?? row.status,
    phase: match?.phase ?? 'pregame',
    revision: match?.revision ?? 0,
    elapsedMs: match?.elapsed_ms ?? Math.max(0, Math.min(scheduledEndAt - startsAt, Date.now() - startsAt)),
    durationMs: scheduledEndAt - startsAt,
    homeScore: match?.home_score ?? 0,
    awayScore: match?.away_score ?? 0,
    startsAt: row.starts_at,
    scheduledEndAt: row.scheduled_end_at,
    venue: row.venue,
    homeTeam: publicTeam(row.home_team),
    awayTeam: publicTeam(row.away_team),
    lastTickAt: match?.last_tick_at ?? null,
    finalizedAt: match?.finalized_at ?? null,
    presence: presence ? {
      concurrentViewers: presence.concurrent_viewers,
      peakViewers: presence.peak_viewers,
      reactions: presence.reactions,
      countryCount: presence.country_count,
      bucketAt: presence.bucket_at
    } : null,
    events
  };
}

export default async function handler(request, response) {
  const method = request.method || 'GET';
  setCommonHeaders(response, 'public, max-age=1, s-maxage=2, stale-while-revalidate=4');
  if (method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    response.statusCode = 204;
    response.end();
    return;
  }
  if (method !== 'GET' && method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD, OPTIONS');
    sendJson(response, 405, { error: 'method_not_allowed' }, method);
    return;
  }

  const requestUrl = new URL(request.url || '/api/live', 'http://localhost');
  const sportKey = requestUrl.searchParams.get('sport') || null;
  if (sportKey && !FALLBACK_LEAGUES[sportKey]) {
    sendJson(response, 400, { error: 'unknown_sport', sportKey }, method);
    return;
  }
  const observedAt = new Date();

  try {
    const config = publicConfig();
    if (!config) {
      sendJson(response, 200, buildFallbackLive(observedAt, sportKey), method);
      return;
    }

    const parameters = {
      select: LIVE_SELECT,
      is_public: 'eq.true',
      starts_at: `lte.${observedAt.toISOString()}`,
      scheduled_end_at: `gt.${observedAt.toISOString()}`,
      status: 'in.(scheduled,live,final)',
      order: 'starts_at.asc,channel.asc',
      limit: '48'
    };
    if (sportKey) parameters['season.sport_key'] = `eq.${sportKey}`;
    const fixtures = await restGet(config, 'fixtures', parameters);
    sendJson(response, 200, {
      schemaVersion: 1,
      source: 'supabase',
      canonical: true,
      observedAt: observedAt.toISOString(),
      matches: fixtures.map(publicFixture)
    }, method);
  } catch (error) {
    console.error('[cyberliga/api/live]', error);
    response.setHeader('X-Cyberliga-Backend', 'deterministic-fallback');
    sendJson(response, 200, Object.assign(buildFallbackLive(observedAt, sportKey), {
      degraded: true,
      degradedReason: 'canonical_backend_unavailable'
    }), method);
  }
}
