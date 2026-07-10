import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createLeagueService } from './service.mjs';

const CLUBS = [
  { id: 'neon', city: 'Tokyo', name: 'NEON FC', code: 'NFC', color: '#00e5ff' },
  { id: 'volt', city: 'Berlin', name: 'VOLT UTD', code: 'VLT', color: '#ff2d78' },
  { id: 'grid', city: 'London', name: 'GRID ROYALS', code: 'GRD', color: '#ffc24d' },
  { id: 'astra', city: 'São Paulo', name: 'ASTRA NOVA', code: 'AST', color: '#8a5cff' },
];

function simulation(config) {
  const durationMs = config.durationMs;
  return {
    durationMs,
    events: [
      { elapsedMs: 1_000, type: 'goal', data: { side: 'home', score: { home: 1, away: 0 } } },
      { elapsedMs: 2_500, type: 'goal', data: { side: 'away', score: { home: 1, away: 1 } } },
      { elapsedMs: 5_000, type: 'goal', data: { side: 'home', score: { home: 2, away: 1 } } },
    ],
    snapshots: [
      { elapsedMs: 0, state: { score: { home: 0, away: 0 }, ball: { x: 0, y: 0 } } },
      { elapsedMs: 2_000, state: { score: { home: 1, away: 0 }, ball: { x: 10, y: 2 } } },
      { elapsedMs: 4_000, state: { score: { home: 1, away: 1 }, ball: { x: -8, y: 4 } } },
      { elapsedMs: 6_000, state: { score: { home: 2, away: 1 }, ball: { x: 0, y: 0 } } },
    ],
    result: { homeScore: 2, awayScore: 1 },
    stats: { shots: { home: 7, away: 4 } },
  };
}

async function temporaryDatabase() {
  const directory = await mkdtemp(join(tmpdir(), 'cyberliga-autonomy-'));
  return {
    filename: join(directory, 'league.sqlite'),
    async remove() { await rm(directory, { recursive: true, force: true }); },
  };
}

function options(dbPath, now, overrides = {}) {
  return {
    dbPath,
    now,
    clubs: CLUBS,
    simulateMatch: simulation,
    seasonId: 'test-season',
    seasonStartAt: 10_000,
    matchDurationMs: 6_000,
    interRoundGapMs: 1_000,
    snapshotPersistenceIntervalMs: 1_000,
    retainAllEvents: true,
    simulationHorizonMs: 100_000,
    doubleRoundRobin: false,
    startScheduler: false,
    ...overrides,
  };
}

test('an omitted season start uses the authoritative current time instead of the Unix epoch', async t => {
  const database = await temporaryDatabase();
  t.after(() => database.remove());
  const now = 1_783_647_200_000;
  const service = createLeagueService(options(database.filename, () => now, {
    clubs: CLUBS.slice(0, 2),
    seasonStartAt: null,
  }));
  await service.init({ startScheduler: false });
  assert.equal(service.store.getSeason('test-season').startsAt, now);
  assert.equal(service.getLeague(now).schedule.liveCount, 1);
  await service.close();
});

test('pre-simulated matches and results survive a process restart', async t => {
  const database = await temporaryDatabase();
  t.after(() => database.remove());
  let now = 9_000;
  let simulationCalls = 0;
  const first = createLeagueService(options(database.filename, () => now, {
    simulateMatch(config) {
      simulationCalls += 1;
      return simulation(config);
    },
  }));
  await first.init({ startScheduler: false });

  const fixtures = first.store.listFixtures({ seasonId: 'test-season' });
  assert.equal(fixtures.length, 6, 'four clubs produce six single-leg fixtures');
  assert.equal(simulationCalls, 6, 'every fixture is simulated exactly once');
  const matchBeforeRestart = first.store.getMatch(fixtures[0].matchId);
  await first.close();

  const second = createLeagueService(options(database.filename, () => now, {
    simulateMatch() {
      throw new Error('a persisted fixture must never be simulated again');
    },
  }));
  await second.init({ startScheduler: false });
  const matchAfterRestart = second.store.getMatch(fixtures[0].matchId);

  assert.deepEqual(matchAfterRestart.result, matchBeforeRestart.result);
  assert.deepEqual(matchAfterRestart.stats, matchBeforeRestart.stats);
  assert.equal(second.store.count('matches'), 6);
  assert.equal(second.store.count('events'), 18);
  assert.equal(second.store.count('snapshots'), 24);
  await second.close();
});

test('fixture finalization is transactional and idempotent across ticks and restarts', async t => {
  const database = await temporaryDatabase();
  t.after(() => database.remove());
  let now = 17_000;
  const first = createLeagueService(options(database.filename, () => now, { clubs: CLUBS.slice(0, 2) }));
  await first.init({ startScheduler: false });

  first.tick(now);
  first.tick(now + 10_000);
  assert.equal(first.store.count('fixture_finalizations'), 1);
  const firstStandings = first.store.getStandings('test-season');
  assert.deepEqual(firstStandings.map(row => row.played), [1, 1]);
  assert.deepEqual(firstStandings.map(row => row.points), [3, 0]);
  await first.close();

  now += 20_000;
  const second = createLeagueService(options(database.filename, () => now, {
    clubs: CLUBS.slice(0, 2),
    simulateMatch() { throw new Error('restart attempted to simulate a completed fixture'); },
  }));
  await second.init({ startScheduler: false });
  second.tick(now);
  assert.equal(second.store.count('fixture_finalizations'), 1);
  assert.deepEqual(second.store.getStandings('test-season'), firstStandings);
  await second.close();
});

test('two spectators receive identical state and the clock advances only with injected wall time', async t => {
  const database = await temporaryDatabase();
  t.after(() => database.remove());
  let now = 11_000;
  const service = createLeagueService(options(database.filename, () => now, { clubs: CLUBS.slice(0, 2) }));
  await service.init({ startScheduler: false });
  const [fixture] = service.store.listFixtures({ seasonId: 'test-season' });

  const spectatorA = service.getMatchState(fixture.matchId);
  const spectatorB = service.getMatchState(fixture.matchId);
  assert.deepEqual(spectatorA, spectatorB, 'reads at one authoritative instant are byte-for-byte equivalent');
  assert.equal(spectatorA.elapsedMs, 1_000);
  assert.equal(spectatorA.score.home, 1);
  assert.equal(spectatorA.snapshot.elapsedMs, 0);
  assert.equal(spectatorA.nextSnapshot.elapsedMs, 2_000);
  assert.equal(spectatorA.eventsSinceSnapshot.length, 1);

  now = 13_000;
  const advanced = service.getMatchState(fixture.matchId);
  assert.equal(advanced.elapsedMs, 3_000);
  assert.equal(advanced.elapsedMs - spectatorA.elapsedMs, 2_000);
  assert.equal(advanced.matchClockMs - spectatorA.matchClockMs, 1_800_000);
  assert.equal(advanced.snapshot.elapsedMs, 2_000);
  assert.equal(advanced.nextSnapshot.elapsedMs, 4_000);
  assert.deepEqual(advanced.score, { home: 1, away: 1 });
  await service.close();
});

test('the read-only HTTP API exposes league, live, fixture, match, state, and standings views', async t => {
  const database = await temporaryDatabase();
  t.after(() => database.remove());
  const now = 11_500;
  const service = createLeagueService(options(database.filename, () => now, { clubs: CLUBS.slice(0, 2) }));
  await service.init({ startScheduler: false });
  const address = await service.listen(0, '127.0.0.1');
  t.after(() => service.close());
  const origin = `http://127.0.0.1:${address.port}`;

  const fixtures = await fetch(`${origin}/api/fixtures`).then(response => response.json());
  const matchId = fixtures.fixtures[0].matchId;
  const routes = [
    '/api/league',
    '/api/live',
    `/api/matches/${matchId}`,
    `/api/matches/${matchId}/state?at=${now}`,
    '/api/standings',
  ];
  const responses = await Promise.all(routes.map(async route => {
    const response = await fetch(origin + route);
    return { status: response.status, body: await response.json() };
  }));

  assert.deepEqual(responses.map(response => response.status), [200, 200, 200, 200, 200]);
  assert.equal(responses[0].body.clubs.length, 2);
  assert.equal(responses[1].body.matches.length, 1);
  assert.equal(responses[2].body.match.id, matchId);
  assert.equal(responses[3].body.elapsedMs, 1_500);
  assert.equal(responses[4].body.standings.length, 2);
});
