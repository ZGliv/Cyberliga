import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MATCH_SECONDS,
  SNAPSHOT_INTERVAL_MS,
  simulateMatch,
} from './sim.mjs';

const ROLES = ['GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD', 'FWD'];

function club(id, name, rating = 75) {
  const labels = ['KEEPER', 'BACK ONE', 'BACK TWO', 'MID ONE', 'MID TWO', 'FORWARD ONE', 'FORWARD TWO'];
  return {
    id,
    name,
    city: name,
    code: id.toUpperCase(),
    color: id === 'home' ? '#00e5ff' : '#ff2d78',
    rating,
    roster: labels.map((label, index) => ({
      id: `${id}-player-${index}`,
      name: `${name} ${label}`,
      number: index + 1,
      role: ROLES[index],
      rating: rating + (index % 3) - 1,
    })),
  };
}

const HOME = club('home', 'NEON CITY');
const AWAY = club('away', 'VOLT CITY');

function options(overrides = {}) {
  return {
    matchId: 'fixture-001',
    home: HOME,
    away: AWAY,
    seed: 'season-1:fixture-1',
    durationMs: 12_000,
    ...overrides,
  };
}

function assertFiniteTree(value, path = 'match', seen = new WeakSet()) {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path} must be finite, received ${value}`);
    return;
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) assertFiniteTree(value[key], `${path}.${String(key)}`, seen);
}

function assertMatchInvariants(match, durationMs) {
  assert.equal(match.status, 'complete');
  assert.equal(match.result.completed, true);
  assert.equal(match.durationMs, durationMs);
  assert.equal(match.matchSeconds, MATCH_SECONDS);
  assert.equal(match.events.at(-1).type, 'fulltime');
  assert.equal(match.events.at(-1).matchSecond, MATCH_SECONDS);
  assert.equal(match.events.at(-1).at, durationMs);

  const teamIds = new Set([match.home.id, match.away.id]);
  const playerIds = new Set([
    ...match.home.lineup.map(player => player.id),
    ...match.away.lineup.map(player => player.id),
  ]);
  assert.equal(playerIds.size, 14);

  let previousAt = -1;
  let previousSecond = -1;
  let previousHomeScore = 0;
  let previousAwayScore = 0;
  let goalEvents = 0;
  for (let index = 0; index < match.events.length; index += 1) {
    const event = match.events[index];
    assert.equal(event.seq, index);
    assert.equal(event.id, `${match.id}:event:${index}`);
    assert.ok(event.at >= previousAt, `event ${index} timestamp regressed`);
    assert.ok(event.matchSecond >= previousSecond, `event ${index} clock regressed`);
    assert.ok(event.at >= 0 && event.at <= durationMs);
    assert.ok(event.matchSecond >= 0 && event.matchSecond <= MATCH_SECONDS);
    assert.ok(event.period === 1 || event.period === 2);
    assert.equal(event.clock.minute, Math.floor(event.matchSecond / 60));
    assert.ok(Number.isInteger(event.score.home) && event.score.home >= 0);
    assert.ok(Number.isInteger(event.score.away) && event.score.away >= 0);
    if (event.teamId !== null) assert.ok(teamIds.has(event.teamId));
    if (event.playerId !== null) assert.ok(playerIds.has(event.playerId));
    if (event.secondaryPlayerId !== null) assert.ok(playerIds.has(event.secondaryPlayerId));
    if (event.field) {
      assert.ok(Math.abs(event.field.x) <= 32);
      assert.ok(Math.abs(event.field.z) <= 20);
    }

    const scoreDelta = event.score.home - previousHomeScore + event.score.away - previousAwayScore;
    if (event.type === 'goal') {
      assert.equal(scoreDelta, 1, `goal event ${index} must add exactly one goal`);
      goalEvents += 1;
    } else {
      assert.equal(scoreDelta, 0, `only goal events may alter the score (event ${index})`);
    }
    previousHomeScore = event.score.home;
    previousAwayScore = event.score.away;
    previousAt = event.at;
    previousSecond = event.matchSecond;
  }

  assert.equal(goalEvents, match.result.scoreHome + match.result.scoreAway);
  assert.equal(previousHomeScore, match.result.scoreHome);
  assert.equal(previousAwayScore, match.result.scoreAway);
  assert.equal(match.stats.home.goals, match.result.scoreHome);
  assert.equal(match.stats.away.goals, match.result.scoreAway);
  assert.equal(match.stats.players.length, 14);

  assert.equal(match.snapshots[0].at, 0);
  assert.equal(match.snapshots.at(-1).at, durationMs);
  assert.equal(match.snapshots.at(-1).phase, 'full-time');
  assert.equal(match.snapshots.at(-1).scoreHome, match.result.scoreHome);
  assert.equal(match.snapshots.at(-1).scoreAway, match.result.scoreAway);
  for (let index = 0; index < match.snapshots.length; index += 1) {
    const snapshot = match.snapshots[index];
    assert.equal(snapshot.seq, index);
    assert.ok(snapshot.at >= 0 && snapshot.at <= durationMs);
    if (index > 0) {
      const gap = snapshot.at - match.snapshots[index - 1].at;
      assert.ok(gap > 0 && gap <= SNAPSHOT_INTERVAL_MS);
      if (snapshot.at !== durationMs) assert.equal(gap, SNAPSHOT_INTERVAL_MS);
    }
    assert.equal(snapshot.players.length, 14);
    assert.equal(new Set(snapshot.players.map(player => player.id)).size, 14);
    assert.ok(teamIds.has(snapshot.possessingTeamId));
    assert.ok(playerIds.has(snapshot.possessingPlayerId));
    assert.ok(Math.abs(snapshot.ball.x) <= 32);
    assert.ok(snapshot.ball.y >= 0);
    assert.ok(Math.abs(snapshot.ball.z) <= 20);
    for (const player of snapshot.players) {
      assert.ok(playerIds.has(player.id));
      assert.ok(teamIds.has(player.teamId));
      assert.ok(ROLES.includes(player.role));
      assert.ok(Math.abs(player.x) <= 32);
      assert.ok(Math.abs(player.z) <= 20);
      const speed = Math.hypot(player.vx, player.vz);
      assert.ok(speed <= (player.role === 'GK' ? 6.3 : 8.5), `implausible snapshot speed ${speed}`);
      assert.equal(typeof player.activity, 'string');
      assert.ok(player.activity.length > 0);
    }
  }

  assertFiniteTree(match);
}

test('same inputs create a deeply equal, deeply immutable match', () => {
  const first = simulateMatch(options());
  const second = simulateMatch(options());
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.events));
  assert.ok(Object.isFrozen(first.events[0]));
  assert.ok(Object.isFrozen(first.snapshots[0].players[0]));
  assert.throws(() => { first.result.scoreHome = 99; }, TypeError);
  assert.throws(() => { first.events.push({}); }, TypeError);
  assertMatchInvariants(first, 12_000);
});

test('different seeds normally produce different match histories', () => {
  const base = simulateMatch(options({ seed: 'alpha' }));
  let differing = 0;
  for (let index = 0; index < 32; index += 1) {
    const candidate = simulateMatch(options({ seed: `seed-${index}` }));
    if (JSON.stringify(candidate.events) !== JSON.stringify(base.events)) differing += 1;
  }
  assert.ok(differing >= 31, `${differing}/32 seeds differed`);
});

test('roster strings and legacy n/num fields remain authoritative', () => {
  const stringHome = {
    id: 'strings',
    name: 'STRING CITY',
    roster: ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN'],
  };
  const legacyAway = {
    id: 'legacy',
    name: 'LEGACY CITY',
    roster: ['KEEP', 'BACK A', 'BACK B', 'MID A', 'MID B', 'FRONT A', 'FRONT B']
      .map((name, index) => ({ n: name, num: index + 10 })),
  };
  const match = simulateMatch(options({
    matchId: 'roster-contract',
    home: stringHome,
    away: legacyAway,
    durationMs: 3000,
  }));
  assert.deepEqual(match.home.lineup.map(player => player.name), stringHome.roster);
  assert.deepEqual(match.away.lineup.map(player => player.name), legacyAway.roster.map(player => player.n));
  const rosterNames = new Set([...stringHome.roster, ...legacyAway.roster.map(player => player.n)]);
  for (const snapshot of match.snapshots) {
    for (const player of snapshot.players) assert.ok(rosterNames.has(player.name));
  }
});

test('1,000 accelerated fixtures complete with plausible, valid soccer output', () => {
  const fixtureCount = 1000;
  const durationMs = 5000;
  const eventTypes = new Set();
  const fingerprints = new Set();
  let goals = 0;
  let draws = 0;
  let scoreless = 0;
  let shots = 0;
  let redCards = 0;

  for (let index = 0; index < fixtureCount; index += 1) {
    const match = simulateMatch(options({
      matchId: `accelerated-${index}`,
      seed: `stress-seed-${index}`,
      durationMs,
    }));
    assertMatchInvariants(match, durationMs);
    for (const event of match.events) eventTypes.add(event.type);
    const totalGoals = match.result.scoreHome + match.result.scoreAway;
    goals += totalGoals;
    draws += Number(match.result.outcome === 'draw');
    scoreless += Number(totalGoals === 0);
    shots += match.stats.home.shots + match.stats.away.shots;
    redCards += match.stats.home.redCards + match.stats.away.redCards;
    fingerprints.add([
      match.result.scoreHome,
      match.result.scoreAway,
      match.events.length,
      ...match.events.filter(event => event.type === 'goal').map(event => `${event.matchSecond}:${event.playerId}`),
      match.events[17]?.matchSecond,
    ].join('|'));
  }

  for (const type of [
    'kickoff', 'possession', 'pass', 'duel', 'shot', 'save', 'goal',
    'foul', 'yellow', 'red', 'halftime', 'fulltime',
  ]) {
    assert.ok(eventTypes.has(type), `stress run never emitted ${type}`);
  }

  const averageGoals = goals / fixtureCount;
  const drawRate = draws / fixtureCount;
  const scorelessRate = scoreless / fixtureCount;
  const averageShots = shots / fixtureCount;
  const averageReds = redCards / fixtureCount;
  assert.ok(averageGoals >= 1.7 && averageGoals <= 3.3, `average goals ${averageGoals}`);
  assert.ok(drawRate >= 0.18 && drawRate <= 0.42, `draw rate ${drawRate}`);
  assert.ok(scorelessRate >= 0.03 && scorelessRate <= 0.2, `scoreless rate ${scorelessRate}`);
  assert.ok(averageShots >= 12 && averageShots <= 22, `average shots ${averageShots}`);
  assert.ok(averageReds >= 0.02 && averageReds <= 0.5, `average reds ${averageReds}`);
  assert.ok(fingerprints.size >= 900, `${fingerprints.size}/1000 match histories were distinct`);
});

test('invalid contracts fail before any partial match can escape', () => {
  assert.throws(() => simulateMatch(), /matchId/);
  assert.throws(() => simulateMatch(options({ seed: undefined })), /seed/);
  assert.throws(() => simulateMatch(options({ durationMs: 12 })), /durationMs/);
  assert.throws(() => simulateMatch(options({ home: { id: 'short', name: 'SHORT', roster: ['A'] } })), /at least 7/);
  assert.throws(() => simulateMatch(options({ away: { ...AWAY, id: HOME.id } })), /ids must differ/);
});
