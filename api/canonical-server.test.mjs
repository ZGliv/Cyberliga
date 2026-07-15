import assert from 'node:assert/strict';
import test from 'node:test';

import configHandler, { browserSafeConfig } from './config.js';
import leagueHandler from './league.js';
import liveHandler from './live.js';
import tickHandler from './tick.js';
import {
  CANONICAL_EPOCH_MS,
  DEFAULT_SLOT_MS,
  buildFallbackLeague,
  buildFallbackLive,
  buildRoundRobin,
  canonicalTickPayload,
  deriveMatchState,
  eventPlanForFixture,
  fallbackFixturesAt,
  normalizeFixture,
  stableStringify
} from '../lib/canonical-server.js';

class MockResponse {
  constructor() {
    this.headers = new Map();
    this.statusCode = 200;
    this.body = '';
  }

  setHeader(name, value) {
    this.headers.set(String(name).toLowerCase(), String(value));
  }

  end(body = '') {
    this.body = body;
  }

  json() {
    return this.body ? JSON.parse(this.body) : null;
  }
}

const PUBLIC_ENV_KEYS = [
  'CYBERLIGA_SUPABASE_URL',
  'SUPABASE_URL',
  'CYBERLIGA_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_ANON_KEY'
];

async function withoutPublicSupabase(run) {
  const saved = Object.fromEntries(PUBLIC_ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of PUBLIC_ENV_KEYS) delete process.env[key];
  try {
    return await run();
  } finally {
    for (const key of PUBLIC_ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

test('double round robin is complete and reciprocal', () => {
  const rounds = buildRoundRobin(8);
  assert.equal(rounds.length, 14);
  assert.ok(rounds.every((round) => round.length === 4));
  const meetings = new Map();
  for (const round of rounds) {
    const participants = new Set();
    for (const [home, away] of round) {
      assert.notEqual(home, away);
      participants.add(home);
      participants.add(away);
      const key = [home, away].sort((a, b) => a - b).join(':');
      meetings.set(key, (meetings.get(key) ?? 0) + 1);
    }
    assert.equal(participants.size, 8);
  }
  assert.equal(meetings.size, 28);
  assert.ok([...meetings.values()].every((count) => count === 2));
});

test('event plans and snapshots are deterministic, ordered, and prefix-monotonic', () => {
  const fixture = fallbackFixturesAt('american-football', CANONICAL_EPOCH_MS + DEFAULT_SLOT_MS * 5 + 20_000)[0];
  const firstPlan = eventPlanForFixture(fixture);
  const secondPlan = eventPlanForFixture({ ...fixture });
  assert.equal(stableStringify(firstPlan), stableStringify(secondPlan));
  assert.equal(new Set(firstPlan.map((event) => event.eventKey)).size, firstPlan.length);
  assert.equal(new Set(firstPlan.map((event) => event.sequence)).size, firstPlan.length);
  assert.ok(firstPlan.every((event, index) => index === 0 || event.elapsedMs >= firstPlan[index - 1].elapsedMs));
  const competitiveEvents = firstPlan.filter((event) => !['match_started','match_final'].includes(event.kind));
  assert.ok(competitiveEvents.length > 0);
  const rosters = new Map([
    [fixture.homeTeam.publicId, new Set(fixture.homeTeam.athletes.map((athlete) => athlete.publicId))],
    [fixture.awayTeam.publicId, new Set(fixture.awayTeam.athletes.map((athlete) => athlete.publicId))]
  ]);
  assert.ok(competitiveEvents.every((event) => {
    if (!event.teamId) return false;
    if (event.payload.points === 3) return event.athleteId === null && event.payload.actorRole === 'Special Teams Unit';
    return rosters.get(event.teamId)?.has(event.athleteId);
  }));
  assert.ok(competitiveEvents.every((event) => typeof event.payload.actorRole === 'string' && event.payload.actorRole.length > 0));
  assert.ok(competitiveEvents.every((event) => event.payload.leverage >= 0.18 && event.payload.leverage <= 0.99));
  assert.ok(competitiveEvents.every((event) => Array.isArray(event.payload.storyTags) && event.payload.storyTags.length === 4));
  const ledger = { home: 0, away: 0 };
  for (const event of competitiveEvents) {
    assert.deepEqual(event.payload.scoreBefore, ledger);
    ledger[event.payload.side] += event.payload.points;
    assert.deepEqual(event.payload.scoreAfter, ledger);
    assert.equal(event.payload.scoreContext.marginBefore, Math.abs(event.payload.scoreBefore.home - event.payload.scoreBefore.away));
    assert.equal(event.payload.scoreContext.marginAfter, Math.abs(event.payload.scoreAfter.home - event.payload.scoreAfter.away));
  }

  const earlyAt = fixture.startsAt + 90_000;
  const lateAt = fixture.startsAt + 270_000;
  const early = deriveMatchState(fixture, earlyAt);
  const late = deriveMatchState(fixture, lateAt);
  assert.ok(late.revision > early.revision);
  assert.ok(late.elapsedMs > early.elapsedMs);
  assert.deepEqual(late.events.slice(0, early.events.length), early.events);
  assert.ok(late.homeScore >= early.homeScore);
  assert.ok(late.awayScore >= early.awayScore);

  const final = deriveMatchState(fixture, fixture.scheduledEndAt);
  assert.equal(final.status, 'final');
  assert.equal(final.phase, 'final');
  assert.equal(final.events.at(-1).kind, 'match_final');
  assert.equal(final.homeScore, ledger.home);
  assert.equal(final.awayScore, ledger.away);
});

test('event attribution uses normalized verified rosters and stays null without one', () => {
  const source = fallbackFixturesAt('soccer', CANONICAL_EPOCH_MS + DEFAULT_SLOT_MS * 2 + 1_000)[0];
  const fixture = {
    ...source,
    publicId: 'verified-roster-fixture',
    seed: 321,
    homeTeam: {
      ...source.homeTeam,
      athletes: [
        { public_id: 'verified-home-41', role: 'Striker', squad_number: 41, active: true, sport_key: 'soccer', is_public: true },
        { public_id: 'verified-home-07', role: 'Engine', squad_number: 7, active: true, sport_key: 'soccer', is_public: true },
        { public_id: 'inactive-home-10', role: 'Winger', squad_number: 10, active: false, sport_key: 'soccer', is_public: true },
        { public_id: 'private-home-12', role: 'Wildcard', squad_number: 12, active: true, sport_key: 'soccer', is_public: false },
        { public_id: 'wrong-sport-home-14', role: 'Winger', squad_number: 14, active: true, sport_key: 'hockey', is_public: true }
      ]
    },
    awayTeam: {
      ...source.awayTeam,
      athletes: [
        { public_id: 'verified-away-22', role: 'Wildcard', squad_number: 22, active: true, sport_key: 'soccer', is_public: true },
        { public_id: 'verified-away-03', role: 'Winger', squad_number: 3, active: true, sport_key: 'soccer', is_public: true }
      ]
    }
  };
  const normalized = normalizeFixture(fixture);
  assert.deepEqual(normalized.homeTeam.athletes.map((athlete) => athlete.publicId), ['verified-home-07', 'verified-home-41']);
  assert.deepEqual(normalized.awayTeam.athletes.map((athlete) => athlete.publicId), ['verified-away-03', 'verified-away-22']);

  const events = eventPlanForFixture(fixture).filter((event) => !['match_started', 'match_final'].includes(event.kind));
  const verified = new Map([
    [fixture.homeTeam.publicId, new Set(['verified-home-07', 'verified-home-41'])],
    [fixture.awayTeam.publicId, new Set(['verified-away-03', 'verified-away-22'])]
  ]);
  assert.ok(events.length > 0);
  assert.ok(events.every((event) => verified.get(event.teamId)?.has(event.athleteId)));
  const reversedRosterFixture = {
    ...fixture,
    homeTeam: { ...fixture.homeTeam, athletes: fixture.homeTeam.athletes.slice().reverse() },
    awayTeam: { ...fixture.awayTeam, athletes: fixture.awayTeam.athletes.slice().reverse() }
  };
  assert.equal(stableStringify(eventPlanForFixture(fixture)), stableStringify(eventPlanForFixture(reversedRosterFixture)));

  const rosterlessFixture = {
    ...fixture,
    publicId: 'absent-roster-fixture',
    homeTeam: { ...fixture.homeTeam, athletes: undefined },
    awayTeam: { ...fixture.awayTeam, athletes: undefined }
  };
  const rosterlessEvents = eventPlanForFixture(rosterlessFixture).filter((event) => !['match_started', 'match_final'].includes(event.kind));
  assert.ok(rosterlessEvents.length > 0);
  assert.ok(rosterlessEvents.every((event) => event.teamId && event.athleteId === null));
});

test('sport-specific event attribution preserves combat rounds and avoids false football scorers', () => {
  const combatFixture = fallbackFixturesAt('combat', CANONICAL_EPOCH_MS + DEFAULT_SLOT_MS * 5 + 1_000)[0];
  const combatEvents = eventPlanForFixture(combatFixture).filter((event) => event.kind === 'round_won');
  assert.deepEqual(combatEvents.map((event) => event.payload.phase), ['round_1', 'round_2', 'round_3']);
  const combatAthletesByTeam = new Map();
  for (const event of combatEvents) {
    if (!combatAthletesByTeam.has(event.teamId)) combatAthletesByTeam.set(event.teamId, event.athleteId);
    assert.equal(event.athleteId, combatAthletesByTeam.get(event.teamId));
  }
  assert.equal(combatAthletesByTeam.size, 2);

  const footballFixture = fallbackFixturesAt('american-football', CANONICAL_EPOCH_MS + DEFAULT_SLOT_MS * 5 + 1_000)[0];
  const fieldGoals = eventPlanForFixture(footballFixture).filter((event) => event.payload?.points === 3);
  assert.ok(fieldGoals.length > 0, 'expected deterministic field-goal events');
  assert.ok(fieldGoals.every((event) => event.athleteId === null));
  assert.ok(fieldGoals.every((event) => event.payload.actorRole === 'Special Teams Unit'));

  const footballWithSpecialists = {
    ...footballFixture,
    homeTeam: {
      ...footballFixture.homeTeam,
      athletes: footballFixture.homeTeam.athletes.concat({ publicId: 'verified-home-kicker', role: 'Kicker', squadNumber: 4, active: true, sportKey: 'american-football', isPublic: true })
    },
    awayTeam: {
      ...footballFixture.awayTeam,
      athletes: footballFixture.awayTeam.athletes.concat({ publicId: 'verified-away-kicker', role: 'Kicker', squadNumber: 5, active: true, sportKey: 'american-football', isPublic: true })
    }
  };
  const attributedFieldGoals = eventPlanForFixture(footballWithSpecialists).filter((event) => event.payload?.points === 3);
  assert.ok(attributedFieldGoals.every((event) => event.athleteId === (
    event.payload.side === 'home' ? 'verified-home-kicker' : 'verified-away-kicker'
  )));
});

test('late blowout extensions never become pressure or signature moments', () => {
  const source = fallbackFixturesAt('basketball', CANONICAL_EPOCH_MS + DEFAULT_SLOT_MS * 4 + 1_000)[0];
  const durationMs = source.scheduledEndAt - source.startsAt;
  const lateBlowouts = [];
  let samplePlan = [];
  for (let seed = 1; seed <= 256 && lateBlowouts.length === 0; seed += 1) {
    const events = eventPlanForFixture({ ...source, publicId: `late-blowout-${seed}`, seed });
    const candidates = events.filter((event) => (
      event.payload?.scoreContext?.blowoutExtension
      && event.elapsedMs >= durationMs * 0.8
    ));
    if (candidates.length > 0) {
      lateBlowouts.push(...candidates);
      samplePlan = events;
    }
  }
  assert.ok(lateBlowouts.length > 0, 'expected a deterministic late blowout sample');
  assert.ok(lateBlowouts.every((event) => event.payload.signatureCandidate === false));
  assert.ok(lateBlowouts.every((event) => event.payload.leverage < 0.78));
  assert.ok(lateBlowouts.every((event) => event.payload.storyTags.at(-1) === 'match-moment'));
  const lateBlowout = lateBlowouts[0];
  const earlierPivotal = samplePlan.find((event) => (
    event.elapsedMs < lateBlowout.elapsedMs
    && (event.payload?.scoreContext?.equalized
      || event.payload?.scoreContext?.leadChanged
      || event.payload?.scoreContext?.leadEstablished)
  ));
  assert.ok(earlierPivotal, 'expected an earlier tie or lead event in the same score ledger');
  assert.ok(earlierPivotal.payload.leverage > lateBlowout.payload.leverage, 'score context must outweigh elapsed time alone');
});

test('tick payload is byte-stable and contains only events visible at observation time', () => {
  const fixture = fallbackFixturesAt('soccer', CANONICAL_EPOCH_MS + DEFAULT_SLOT_MS * 3 + 100_000)[1];
  const observedAt = fixture.startsAt + 180_000;
  const first = canonicalTickPayload(fixture, observedAt);
  const second = canonicalTickPayload(fixture, observedAt);
  assert.equal(stableStringify(first), stableStringify(second));
  assert.ok(first.p_events.every((event) => event.elapsedMs <= first.p_snapshot.elapsedMs));
  assert.equal(first.p_snapshot.fixtureId, fixture.publicId);
});

test('fallback network covers six sports and American football content', () => {
  const observedAt = CANONICAL_EPOCH_MS + DEFAULT_SLOT_MS * 10 + 123_456;
  const live = buildFallbackLive(observedAt);
  assert.equal(live.canonical, false);
  assert.equal(live.matches.length, 24);
  assert.equal(new Set(live.matches.map((match) => match.sportKey)).size, 6);
  assert.ok(live.matches.every((match) => !Object.hasOwn(match.homeTeam, 'athletes') && !Object.hasOwn(match.awayTeam, 'athletes')));

  const football = buildFallbackLeague('american-football', observedAt);
  assert.equal(football.teams.length, 8);
  assert.ok(football.teams.every((team) => team.athletes.length === 22));
  assert.equal(football.standings.length, 8);
  assert.equal(football.live.length, 4);
  assert.equal(football.fixtures.length, 12);
  assert.ok(football.fixtures.every((fixture) => fixture.seasonPublicId && fixture.roundNumber >= 1 && fixture.channel >= 0));
  assert.equal(football.summary.gamesPerRound, 4);
  assert.ok(football.standings.every((row) => /^\d+-\d+-\d+$/.test(row.record)));
  assert.ok(football.standings.every((row) => row.played === row.wins + row.draws + row.losses));
  assert.deepEqual(football.standings.map((row) => row.rank), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('fallback league fixture windows retain season identity at rollover', () => {
  const observedAt = CANONICAL_EPOCH_MS + DEFAULT_SLOT_MS * 14 + 1_000;
  const football = buildFallbackLeague('american-football', observedAt);
  assert.equal(football.season.publicId, 'american-football-2026-s2');
  assert.equal(football.standings.every((row) => row.played === 0), true);
  assert.deepEqual(new Set(football.fixtures.map((fixture) => fixture.seasonPublicId)), new Set([
    'american-football-2026-s1',
    'american-football-2026-s2'
  ]));
  assert.equal(football.fixtures.filter((fixture) => fixture.seasonPublicId === football.season.publicId).length, 8);
});

test('public handlers use deterministic fallback without Supabase environment', async () => {
  await withoutPublicSupabase(async () => {
    const liveResponse = new MockResponse();
    await liveHandler({ method: 'GET', url: '/api/live?sport=american-football' }, liveResponse);
    assert.equal(liveResponse.statusCode, 200);
    assert.equal(liveResponse.json().source, 'deterministic-fallback');
    assert.equal(liveResponse.json().matches.length, 4);

    const leagueResponse = new MockResponse();
    await leagueHandler({ method: 'GET', url: '/api/league?sport=american-football' }, leagueResponse);
    assert.equal(leagueResponse.statusCode, 200);
    assert.equal(leagueResponse.json().teams.length, 8);

    const configResponse = new MockResponse();
    await configHandler({ method: 'GET', url: '/api/config' }, configResponse);
    assert.equal(configResponse.statusCode, 200);
    assert.equal(configResponse.json().backend.mode, 'deterministic-fallback');
    assert.equal(configResponse.json().supabaseUrl, '');
    assert.equal(configResponse.json().supabasePublishableKey, '');
    assert.equal(configResponse.json().supabase.publishableKey, null);
  });
});

test('browser config exposes only a modern publishable key', () => {
  const legacy = browserSafeConfig({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'legacy.jwt' });
  assert.equal(legacy.backend.available, false);
  assert.equal(legacy.supabase.url, null);
  assert.equal(legacy.supabase.publishableKey, null);

  const modern = browserSafeConfig({
    CYBERLIGA_SUPABASE_URL: 'https://example.supabase.co/',
    CYBERLIGA_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example'
  });
  assert.equal(modern.backend.available, true);
  assert.equal(modern.supabaseUrl, 'https://example.supabase.co');
  assert.equal(modern.supabasePublishableKey, 'sb_publishable_example');
  assert.equal(modern.supabase.url, 'https://example.supabase.co');
  assert.equal(modern.supabase.publishableKey, 'sb_publishable_example');
  assert.equal(JSON.stringify(modern).includes('service'), false);
  assert.equal(JSON.stringify(modern).includes('secret'), false);
});

test('public endpoints degrade honestly when canonical configuration is incomplete', async () => {
  const savedUrl = process.env.CYBERLIGA_SUPABASE_URL;
  const savedKey = process.env.CYBERLIGA_SUPABASE_PUBLISHABLE_KEY;
  const savedConsoleError = console.error;
  process.env.CYBERLIGA_SUPABASE_URL = 'https://example.supabase.co';
  delete process.env.CYBERLIGA_SUPABASE_PUBLISHABLE_KEY;
  console.error = () => {};
  try {
    const liveResponse = new MockResponse();
    await liveHandler({ method: 'GET', url: '/api/live?sport=soccer' }, liveResponse);
    assert.equal(liveResponse.statusCode, 200);
    assert.equal(liveResponse.json().canonical, false);
    assert.equal(liveResponse.json().degraded, true);
    assert.equal(liveResponse.json().degradedReason, 'canonical_backend_unavailable');

    const leagueResponse = new MockResponse();
    await leagueHandler({ method: 'GET', url: '/api/league?sport=soccer' }, leagueResponse);
    assert.equal(leagueResponse.statusCode, 200);
    assert.equal(leagueResponse.json().canonical, false);
    assert.equal(leagueResponse.json().degraded, true);
  } finally {
    console.error = savedConsoleError;
    if (savedUrl === undefined) delete process.env.CYBERLIGA_SUPABASE_URL;
    else process.env.CYBERLIGA_SUPABASE_URL = savedUrl;
    if (savedKey === undefined) delete process.env.CYBERLIGA_SUPABASE_PUBLISHABLE_KEY;
    else process.env.CYBERLIGA_SUPABASE_PUBLISHABLE_KEY = savedKey;
  }
});

test('tick endpoint rejects calls without the configured cron secret before backend access', async () => {
  const saved = process.env.CYBERLIGA_CRON_SECRET;
  process.env.CYBERLIGA_CRON_SECRET = 'unit-test-cron-secret';
  try {
    const response = new MockResponse();
    await tickHandler({ method: 'GET', url: '/api/tick', headers: {} }, response);
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, 'unauthorized');
  } finally {
    if (saved === undefined) delete process.env.CYBERLIGA_CRON_SECRET;
    else process.env.CYBERLIGA_CRON_SECRET = saved;
  }
});

test('tick endpoint requests roster eligibility and sends only active public sport-matched athlete ids', async () => {
  const environmentKeys = [
    'CYBERLIGA_CRON_SECRET',
    'CYBERLIGA_SUPABASE_URL',
    'CYBERLIGA_SUPABASE_SERVICE_ROLE_KEY'
  ];
  const savedEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));
  const savedFetch = globalThis.fetch;
  const source = fallbackFixturesAt('soccer', CANONICAL_EPOCH_MS + DEFAULT_SLOT_MS * 6 + 1_000)[0];
  const fixture = {
    public_id: 'canonical-roster-tick',
    round_number: source.roundNumber,
    channel: source.channel,
    seed: source.seed,
    starts_at: new Date(source.startsAt).toISOString(),
    scheduled_end_at: new Date(source.scheduledEndAt).toISOString(),
    status: 'live',
    season: { public_id: source.seasonPublicId, sport_key: 'soccer', name: 'Test season', status: 'active' },
    home_team: {
      public_id: source.homeTeam.publicId,
      name: source.homeTeam.name,
      code: source.homeTeam.code,
      city: source.homeTeam.city,
      primary_color: source.homeTeam.color,
      athletes: [
        { public_id: 'db-home-engine', role: 'Engine', squad_number: 8, active: true, sport_key: 'soccer', is_public: true },
        { public_id: 'db-home-striker', role: 'Striker', squad_number: 19, active: true, sport_key: 'soccer', is_public: true },
        { public_id: 'db-home-inactive', role: 'Winger', squad_number: 10, active: false, sport_key: 'soccer', is_public: true },
        { public_id: 'db-home-private', role: 'Winger', squad_number: 12, active: true, sport_key: 'soccer', is_public: false },
        { public_id: 'db-home-wrong-sport', role: 'Wildcard', squad_number: 14, active: true, sport_key: 'combat', is_public: true }
      ]
    },
    away_team: {
      public_id: source.awayTeam.publicId,
      name: source.awayTeam.name,
      code: source.awayTeam.code,
      city: source.awayTeam.city,
      primary_color: source.awayTeam.color,
      athletes: [
        { public_id: 'db-away-winger', role: 'Winger', squad_number: 11, active: true, sport_key: 'soccer', is_public: true },
        { public_id: 'db-away-wildcard', role: 'Wildcard', squad_number: 23, active: true, sport_key: 'soccer', is_public: true },
        { public_id: 'db-away-inactive', role: 'Engine', squad_number: 9, active: false, sport_key: 'soccer', is_public: true }
      ]
    }
  };
  const rpcBodies = [];
  process.env.CYBERLIGA_CRON_SECRET = 'unit-test-cron-secret';
  process.env.CYBERLIGA_SUPABASE_URL = 'https://example.supabase.co';
  process.env.CYBERLIGA_SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/fixtures')) {
      const select = url.searchParams.get('select') ?? '';
      const rosterProjection = 'athletes:athletes!athletes_team_id_fkey(public_id,role,squad_number,active,sport_key,is_public)';
      assert.equal(select.split(rosterProjection).length - 1, 2);
      return new Response(JSON.stringify([fixture]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname.endsWith('/rpc/canonical_apply_tick')) {
      rpcBodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ fixtureId: fixture.public_id, status: 'final' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw new Error(`unexpected service request: ${url}`);
  };

  try {
    const response = new MockResponse();
    await tickHandler({
      method: 'POST',
      url: '/api/tick',
      headers: { authorization: 'Bearer unit-test-cron-secret' },
      body: { fixtureId: fixture.public_id, observedAt: fixture.scheduled_end_at }
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().processed, 1);
    assert.equal(rpcBodies.length, 1);
    const verifiedIds = new Set(['db-home-engine', 'db-home-striker', 'db-away-winger', 'db-away-wildcard']);
    const competitiveEvents = rpcBodies[0].p_events.filter((event) => !['match_started', 'match_final'].includes(event.kind));
    assert.ok(competitiveEvents.length > 0);
    assert.ok(competitiveEvents.every((event) => verifiedIds.has(event.athleteId)));
  } finally {
    globalThis.fetch = savedFetch;
    for (const key of environmentKeys) {
      if (savedEnvironment[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnvironment[key];
    }
  }
});
