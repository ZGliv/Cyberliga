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

  const football = buildFallbackLeague('american-football', observedAt);
  assert.equal(football.teams.length, 8);
  assert.ok(football.teams.every((team) => team.athletes.length === 22));
  assert.equal(football.standings.length, 8);
  assert.equal(football.live.length, 4);
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
