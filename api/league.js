import { buildFallbackLeague, FALLBACK_LEAGUES } from '../lib/canonical-server.js';

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

function publicAthlete(row) {
  return {
    publicId: row.public_id,
    displayName: row.display_name,
    squadNumber: row.squad_number,
    role: row.role,
    archetype: row.archetype,
    temperament: row.temperament,
    silhouette: row.silhouette,
    signature: row.signature
  };
}

function publicTeam(row) {
  return {
    publicId: row.public_id,
    name: row.name,
    code: row.code,
    city: row.city,
    region: row.region,
    colors: {
      primary: row.primary_color,
      secondary: row.secondary_color,
      accent: row.accent_color
    },
    motif: row.motif,
    texture: row.texture,
    motionLanguage: row.motion_language,
    rivalryId: row.rivalry?.public_id ?? null,
    athletes: (row.athletes ?? []).map(publicAthlete)
  };
}

function publicFixture(row) {
  const match = one(row.match);
  return {
    fixtureId: row.public_id,
    roundNumber: row.round_number,
    channel: row.channel,
    startsAt: row.starts_at,
    scheduledEndAt: row.scheduled_end_at,
    status: match?.status ?? row.status,
    phase: match?.phase ?? 'pregame',
    homeScore: match?.home_score ?? 0,
    awayScore: match?.away_score ?? 0,
    homeTeam: row.home_team ? { publicId: row.home_team.public_id, name: row.home_team.name, code: row.home_team.code } : null,
    awayTeam: row.away_team ? { publicId: row.away_team.public_id, name: row.away_team.name, code: row.away_team.code } : null
  };
}

function publicStanding(row) {
  return {
    rank: row.rank,
    team: row.team ? { publicId: row.team.public_id, name: row.team.name, code: row.team.code, color: row.team.primary_color } : null,
    played: row.played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    points: row.points,
    scoreFor: row.score_for,
    scoreAgainst: row.score_against,
    streak: row.streak,
    form: row.form
  };
}

export default async function handler(request, response) {
  const method = request.method || 'GET';
  setCommonHeaders(response, 'public, max-age=5, s-maxage=15, stale-while-revalidate=30');
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

  const requestUrl = new URL(request.url || '/api/league', 'http://localhost');
  const sportKey = requestUrl.searchParams.get('sport') || 'soccer';
  if (!FALLBACK_LEAGUES[sportKey]) {
    sendJson(response, 400, { error: 'unknown_sport', sportKey }, method);
    return;
  }

  const observedAt = new Date();
  try {
    const config = publicConfig();
    if (!config) {
      sendJson(response, 200, buildFallbackLeague(sportKey, observedAt), method);
      return;
    }

    const seasons = await restGet(config, 'seasons', {
      select: 'id,public_id,sport_key,name,status,starts_at,ends_at,rules',
      sport_key: `eq.${sportKey}`,
      is_public: 'eq.true',
      status: 'in.(active,scheduled,completed)',
      order: 'starts_at.desc',
      limit: '1'
    });
    const season = seasons[0] ?? null;
    if (!season) {
      sendJson(response, 200, {
        schemaVersion: 1,
        source: 'supabase',
        canonical: true,
        observedAt: observedAt.toISOString(),
        season: null,
        teams: [],
        standings: [],
        fixtures: []
      }, method);
      return;
    }

    const [teams, standings, fixtures] = await Promise.all([
      restGet(config, 'teams', {
        select: 'public_id,name,code,city,region,primary_color,secondary_color,accent_color,motif,texture,motion_language,rivalry:teams!teams_rivalry_team_id_fkey(public_id),athletes(public_id,display_name,squad_number,role,archetype,temperament,silhouette,signature)',
        sport_key: `eq.${sportKey}`,
        active: 'eq.true',
        is_public: 'eq.true',
        order: 'name.asc'
      }),
      restGet(config, 'standings', {
        select: 'rank,played,wins,draws,losses,points,score_for,score_against,streak,form,team:teams!standings_team_id_fkey(public_id,name,code,primary_color)',
        season_id: `eq.${season.id}`,
        is_public: 'eq.true',
        order: 'rank.asc.nullslast,points.desc,score_for.desc'
      }),
      restGet(config, 'fixtures', {
        select: 'public_id,round_number,channel,starts_at,scheduled_end_at,status,home_team:teams!fixtures_home_team_id_fkey(public_id,name,code),away_team:teams!fixtures_away_team_id_fkey(public_id,name,code),match:matches!matches_fixture_id_fkey(status,phase,home_score,away_score)',
        season_id: `eq.${season.id}`,
        is_public: 'eq.true',
        order: 'starts_at.desc',
        limit: '32'
      })
    ]);

    sendJson(response, 200, {
      schemaVersion: 1,
      source: 'supabase',
      canonical: true,
      observedAt: observedAt.toISOString(),
      season: {
        publicId: season.public_id,
        sportKey: season.sport_key,
        name: season.name,
        status: season.status,
        startsAt: season.starts_at,
        endsAt: season.ends_at,
        rules: season.rules
      },
      teams: teams.map(publicTeam),
      standings: standings.map(publicStanding),
      fixtures: fixtures.map(publicFixture)
    }, method);
  } catch (error) {
    console.error('[cyberliga/api/league]', error);
    response.setHeader('X-Cyberliga-Backend', 'deterministic-fallback');
    sendJson(response, 200, Object.assign(buildFallbackLeague(sportKey, observedAt), {
      degraded: true,
      degradedReason: 'canonical_backend_unavailable'
    }), method);
  }
}
