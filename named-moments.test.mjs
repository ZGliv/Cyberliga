import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

globalThis.window = globalThis;
delete globalThis.CYBERLIGA_CONTENT;
delete globalThis.CyberligaCharacters;
delete globalThis.CyberligaNamedMoments;

await import('./named-moments.js?named-moments-unbound');
const Unbound = globalThis.CyberligaNamedMoments;

await import('./worlddata.js?named-moments-tests');
await import('./characterdata.js?named-moments-tests');
await import('./named-moments.js?named-moments-bound');

const Content = globalThis.CYBERLIGA_CONTENT;
const Characters = globalThis.CyberligaCharacters;
const Named = globalThis.CyberligaNamedMoments;
const founderTeamIds = new Set(Characters.records.map((record) => record.teamId));

function assertFrozenTree(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.ok(Object.isFrozen(value), `expected frozen object: ${JSON.stringify(value).slice(0, 120)}`);
  Object.values(value).forEach((child) => assertFrozenTree(child, seen));
}

function genericTuple(sportId) {
  const sport = Content.getSport(sportId);
  const home = sport.teams.find((team) => !founderTeamIds.has(team.id));
  const away = sport.teams.find((team) => team !== home);
  const athlete = home.athletes.find((candidate) => !Characters.get(candidate.id));
  assert.ok(home && away && athlete, sportId);
  return { sport, home, away, athlete };
}

function founderTuple(record) {
  const sport = Content.getSport(record.sportId);
  const home = Content.getTeam(record.teamId, record.sportId);
  const away = sport.teams.find((team) => team !== home);
  const athlete = Content.getAthlete(home.id, record.id);
  assert.ok(home && away && athlete, record.id);
  return { sport, home, away, athlete };
}

function directorFor(sportId, fixtureSuffix = 'fixture') {
  const tuple = genericTuple(sportId);
  const director = Named.create({
    sportId,
    fixtureId: `${sportId}-${fixtureSuffix}`,
    homeTeam: tuple.home,
    awayTeam: tuple.away
  });
  assert.ok(director, sportId);
  return { ...tuple, director };
}

function baseEvent(tuple, overrides = {}) {
  return {
    eventKey: 'event-001',
    kind: Named.eventKinds[tuple.sport.id][0],
    side: 'home',
    team: tuple.home,
    athlete: tuple.athlete,
    ...overrides
  };
}

test('exports a frozen, dependency-bound six-sport API', () => {
  assert.equal(Unbound.ready, false);
  assert.equal(Unbound.create({}), null);
  assert.equal(Named.version, '1.0.0');
  assert.equal(Named.schemaVersion, 1);
  assert.equal(Named.ready, true);
  assert.deepEqual(Named.sportIds, [
    'soccer', 'american-football', 'basketball', 'hockey', 'baseball', 'combat'
  ]);
  assert.deepEqual(Named.limits, { candidates: 12, top: 3 });
  assert.deepEqual(Named.safety, {
    source: 'local-client', authoritative: false, wagerable: false, settles: false, recordedFootage: false
  });
  assertFrozenTree(Named);
  Named.sportIds.forEach((sportId) => {
    assert.ok(Named.eventKinds[sportId].length >= 5, sportId);
    assert.deepEqual(Object.keys(Named.eventTitles[sportId]), Named.eventKinds[sportId]);
  });
});

test('creates an exact immutable fixture director for every sport', () => {
  Named.sportIds.forEach((sportId) => {
    const { home, away, director } = directorFor(sportId, 'exact');
    assert.ok(Object.isFrozen(director));
    const state = director.state();
    assert.equal(state.fixture.id, `${sportId}-exact`);
    assert.equal(state.fixture.sportId, sportId);
    assert.equal(state.fixture.home.id, home.id);
    assert.equal(state.fixture.away.id, away.id);
    assert.deepEqual(state.provenance, Named.safety);
    assert.equal(state.latest, null);
    assert.deepEqual(state.candidates, []);
    assert.deepEqual(state.top, []);
    assert.deepEqual(state.counts, {
      accepted: 0, duplicates: 0, rejected: 0, seenEventKeys: 0, retainedCandidates: 0
    });
    assertFrozenTree(state);
  });
});

test('all twelve Founders use their exact canonical motion name as the title', () => {
  const identities = Characters.records.map((record, index) => {
    const tuple = founderTuple(record);
    const director = Named.create({
      sportId: record.sportId,
      fixtureId: `founder-${index + 1}`,
      homeTeam: tuple.home,
      awayTeam: tuple.away
    });
    const kind = Named.eventKinds[record.sportId][0];
    const moment = director.record({
      eventKey: `founder-event-${index + 1}`,
      kind,
      side: 'home',
      team: tuple.home,
      athlete: tuple.athlete,
      sequence: index,
      leverage: 0.9,
      score: { home: 1, away: 0 },
      recordedFootage: index % 2 === 0
    });
    assert.ok(moment, record.id);
    assert.equal(moment.title, record.motionName);
    assert.equal(moment.eventTitle, Named.eventTitles[record.sportId][kind]);
    assert.notEqual(moment.eventTitle, '', record.id);
    assert.equal(moment.founding.founding, true);
    assert.equal(moment.founding.motionName, record.motionName);
    assert.equal(moment.founding.body, record.body);
    assert.equal(moment.athlete.id, record.id);
    assert.equal(moment.team.id, record.teamId);
    assert.equal(moment.provenance.recordedFootage, index % 2 === 0);
    assertFrozenTree(moment);
    return moment.id;
  });
  assert.equal(new Set(identities).size, 12);
});

test('every allowed generic event uses only its fixed vocabulary title', () => {
  Named.sportIds.forEach((sportId) => {
    const tuple = genericTuple(sportId);
    const director = Named.create({
      sportId,
      fixtureId: `generic-${sportId}`,
      homeTeam: tuple.home,
      awayTeam: tuple.away
    });
    Named.eventKinds[sportId].forEach((kind, index) => {
      const moment = director.record({
        eventKey: `generic-${sportId}-${index}`,
        kind,
        side: 'home',
        team: tuple.home,
        athlete: tuple.athlete,
        title: 'CALLER COPY MUST NEVER SHIP'
      });
      assert.ok(moment, `${sportId}/${kind}`);
      assert.equal(moment.title, Named.eventTitles[sportId][kind]);
      assert.equal(moment.eventTitle, Named.eventTitles[sportId][kind]);
      assert.equal(moment.founding.founding, false);
    });
  });
});

test('soccer juke is a deterministic named moment distinct from a bicycle kick', () => {
  const tuple = genericTuple('soccer');
  const config = {
    sportId: 'soccer', fixtureId: 'soccer-juke-hook', homeTeam: tuple.home, awayTeam: tuple.away
  };
  const payload = baseEvent(tuple, {
    eventKey: 'juke-0042', kind: 'juke', sequence: 42, clock: '67:14', leverage: 0.82
  });
  const first = Named.create(config).record(payload);
  const second = Named.create(config).record(payload);

  assert.ok(Named.eventKinds.soccer.includes('juke'));
  assert.equal(Named.eventTitles.soccer.juke, 'ANKLE BREAK');
  assert.deepEqual(first, second);
  assert.equal(first.kind, 'juke');
  assert.equal(first.eventTitle, 'ANKLE BREAK');
  assert.equal(first.title, 'ANKLE BREAK');
  assert.equal(first.rank.kindPriority, 72);
  assert.notEqual(first.kind, 'bicycle_kick');
  assert.deepEqual(
    new URL(first.clipHref, 'https://cyberliga.test/').searchParams.getAll('kind'),
    ['juke']
  );
});

test('rejects cloned, cross-sport, same-team, aliased, and malformed fixture inputs', () => {
  const soccer = Content.getSport('soccer');
  const hockey = Content.getSport('hockey');
  const home = soccer.teams[0];
  const away = soccer.teams[1];
  const valid = { sportId: 'soccer', fixtureId: 'fixture-valid', homeTeam: home, awayTeam: away };
  assert.ok(Named.create(valid));
  assert.equal(Named.create({ ...valid, homeTeam: { ...home } }), null);
  assert.equal(Named.create({ ...valid, awayTeam: { ...away } }), null);
  assert.equal(Named.create({ ...valid, awayTeam: home }), null);
  assert.equal(Named.create({ ...valid, awayTeam: hockey.teams[0] }), null);
  assert.equal(Named.create({ ...valid, sportId: 'football' }), null);
  assert.equal(Named.create({ ...valid, sportId: 'SOCCER' }), null);
  assert.equal(Named.create({ ...valid, fixtureId: ' fixture-valid' }), null);
  assert.equal(Named.create({ ...valid, fixtureId: '<bad>' }), null);
  assert.equal(Named.create({ ...valid, fixtureId: '' }), null);
  assert.equal(Named.create(null), null);
  assert.equal(Named.create([]), null);
});

test('rejects malformed, ambiguous, cloned, and cross-team event inputs', () => {
  const tuple = genericTuple('soccer');
  const third = tuple.sport.teams.find((team) => team !== tuple.home && team !== tuple.away);
  const director = Named.create({
    sportId: 'soccer', fixtureId: 'strict-events', homeTeam: tuple.home, awayTeam: tuple.away
  });
  const event = baseEvent(tuple);
  const invalid = [
    null,
    [],
    { ...event, eventKey: '' },
    { ...event, eventKey: ' bad' },
    { ...event, eventKey: '<script>' },
    { ...event, kind: 'GOAL' },
    { ...event, kind: 'touchdown' },
    { ...event, side: null },
    { ...event, side: 'away' },
    { ...event, team: { ...tuple.home } },
    { ...event, athlete: { ...tuple.athlete } },
    { ...event, athlete: tuple.away.athletes[0] },
    { ...event, team: third, athlete: third.athletes[0] },
    { ...event, sequence: -1 },
    { ...event, sequence: 1.25 },
    { ...event, sequence: '1' },
    { ...event, leverage: -0.1 },
    { ...event, leverage: 1.1 },
    { ...event, leverage: Number.NaN },
    { ...event, leverage: '0.5' },
    { ...event, clock: -1 },
    { ...event, clock: ' 88:00' },
    { ...event, clock: '<b>88</b>' },
    { ...event, score: null },
    { ...event, score: [1, 0] },
    { ...event, score: { home: 1 } },
    { ...event, score: { home: -1, away: 0 } },
    { ...event, score: { home: '1', away: 0 } },
    { ...event, recordedFootage: 1 },
    { ...event, recordedFootage: 'true' },
    { ...event, recordedFootage: null }
  ];
  invalid.forEach((candidate, index) => {
    assert.equal(director.record(candidate), null, `invalid event ${index}`);
  });
  const state = director.state();
  assert.equal(state.counts.rejected, invalid.length);
  assert.equal(state.counts.accepted, 0);
  assert.deepEqual(state.candidates, []);
});

test('module initialization binding survives forged replacement globals', () => {
  const originalContent = globalThis.CYBERLIGA_CONTENT;
  const originalCharacters = globalThis.CyberligaCharacters;
  const tuple = genericTuple('hockey');
  globalThis.CYBERLIGA_CONTENT = {
    getSport: () => ({ ...tuple.sport }),
    getTeam: () => ({ ...tuple.home }),
    getAthlete: () => ({ ...tuple.athlete }),
    hash: () => 1,
    sports: []
  };
  globalThis.CyberligaCharacters = { records: [], get: () => null };
  try {
    const director = Named.create({
      sportId: 'hockey', fixtureId: 'bound-after-replacement', homeTeam: tuple.home, awayTeam: tuple.away
    });
    assert.ok(director);
    assert.ok(director.record(baseEvent(tuple, { eventKey: 'bound-event' })));
    assert.equal(Named.create({
      sportId: 'hockey', fixtureId: 'forged-after-replacement',
      homeTeam: { ...tuple.home }, awayTeam: tuple.away
    }), null);
  } finally {
    globalThis.CYBERLIGA_CONTENT = originalContent;
    globalThis.CyberligaCharacters = originalCharacters;
  }
});

test('deduplicates event keys and reset clears only mutable fixture state', () => {
  const tuple = genericTuple('basketball');
  const director = Named.create({
    sportId: 'basketball', fixtureId: 'dedupe-reset', homeTeam: tuple.home, awayTeam: tuple.away
  });
  const originalFixture = director.fixture;
  const first = director.record(baseEvent(tuple, { eventKey: 'same-event', kind: 'basket' }));
  assert.ok(first);
  assert.equal(director.record(baseEvent(tuple, {
    eventKey: 'same-event', kind: 'dunk', athlete: tuple.home.athletes[1]
  })), null);
  assert.deepEqual(director.state().counts, {
    accepted: 1, duplicates: 1, rejected: 0, seenEventKeys: 1, retainedCandidates: 1
  });
  const resetState = director.reset();
  assert.equal(director.fixture, originalFixture);
  assert.equal(resetState.fixture, originalFixture);
  assert.equal(resetState.latest, null);
  assert.deepEqual(resetState.candidates, []);
  assert.deepEqual(resetState.top, []);
  assert.deepEqual(resetState.counts, {
    accepted: 0, duplicates: 0, rejected: 0, seenEventKeys: 0, retainedCandidates: 0
  });
  assert.ok(director.record(baseEvent(tuple, { eventKey: 'same-event', kind: 'basket' })));
});

test('keeps at most the best twelve candidates and ranks the top three', () => {
  const tuple = genericTuple('american-football');
  const director = Named.create({
    sportId: 'american-football', fixtureId: 'rank-cap', homeTeam: tuple.home, awayTeam: tuple.away
  });
  for (let index = 1; index <= 15; index += 1) {
    assert.ok(director.record(baseEvent(tuple, {
      eventKey: `cap-${String(index).padStart(2, '0')}`,
      kind: 'touchdown',
      sequence: index,
      leverage: index / 15
    })));
  }
  let state = director.state();
  assert.equal(state.counts.accepted, 15);
  assert.equal(state.counts.seenEventKeys, 15);
  assert.equal(state.candidates.length, 12);
  assert.deepEqual(state.candidates.map((moment) => moment.eventKey),
    Array.from({ length: 12 }, (_value, index) => `cap-${String(index + 4).padStart(2, '0')}`));
  assert.deepEqual(state.top.map((moment) => moment.eventKey), ['cap-15', 'cap-14', 'cap-13']);

  const low = director.record(baseEvent(tuple, {
    eventKey: 'cap-low-latest', kind: 'touchdown', sequence: 16, leverage: 0
  }));
  assert.ok(low);
  state = director.state();
  assert.equal(state.latest.eventKey, 'cap-low-latest');
  assert.equal(state.candidates.length, 12);
  assert.ok(!state.candidates.some((moment) => moment.eventKey === 'cap-low-latest'));
  assert.deepEqual(state.top.map((moment) => moment.eventKey), ['cap-15', 'cap-14', 'cap-13']);
});

test('IDs, ranking, state, and routes are deterministic', () => {
  const tuple = genericTuple('baseball');
  const config = {
    sportId: 'baseball', fixtureId: 'stable-fixture', homeTeam: tuple.home, awayTeam: tuple.away
  };
  const firstDirector = Named.create(config);
  const secondDirector = Named.create(config);
  const payload = baseEvent(tuple, {
    eventKey: 'stable-event', kind: 'grand_slam', sequence: 8, clock: 'B7 · 2 OUT',
    leverage: 0.97, score: { home: 5, away: 2 }, recordedFootage: true
  });
  const first = firstDirector.record(payload);
  const second = secondDirector.record(payload);
  assert.deepEqual(first, second);
  assert.deepEqual(firstDirector.state(), secondDirector.state());

  const scoreVariant = Named.create(config).record({ ...payload, score: { home: 9, away: 2 } });
  assert.equal(scoreVariant.id, first.id, 'score is deliberately outside the stable identity tuple');
  const kindVariant = Named.create(config).record({ ...payload, kind: 'home_run' });
  const athleteVariant = Named.create(config).record({ ...payload, athlete: tuple.home.athletes[1] });
  const eventVariant = Named.create(config).record({ ...payload, eventKey: 'stable-event-2' });
  assert.notEqual(kindVariant.id, first.id);
  assert.notEqual(athleteVariant.id, first.id);
  assert.notEqual(eventVariant.id, first.id);

  assert.equal(first.playerHref,
    `player.html?sport=baseball&team=${tuple.home.id}&player=${tuple.athlete.id}`);
  const clip = new URL(first.clipHref, 'https://cyberliga.test/');
  assert.equal(clip.pathname, '/clip.html');
  assert.equal(clip.searchParams.get('sport'), 'baseball');
  assert.equal(clip.searchParams.get('home'), tuple.home.id);
  assert.equal(clip.searchParams.get('away'), tuple.away.id);
  assert.equal(clip.searchParams.get('athlete'), tuple.athlete.id);
  assert.equal(clip.searchParams.get('fixture'), 'stable-fixture');
  assert.equal(clip.searchParams.get('event'), 'stable-event');
  assert.equal(clip.searchParams.get('eventSource'), 'local-client');
  assert.equal(clip.searchParams.get('view'), '1');
  assert.equal(clip.searchParams.get('score'), '5-2');
  assert.deepEqual(clip.searchParams.getAll('kind'), ['grand_slam']);
});

test('score is omitted unless supplied and recorded footage defaults false', () => {
  const tuple = genericTuple('combat');
  const director = Named.create({
    sportId: 'combat', fixtureId: 'optional-fields', homeTeam: tuple.home, awayTeam: tuple.away
  });
  const withoutScore = director.record(baseEvent(tuple, {
    eventKey: 'optional-1', kind: 'knockdown'
  }));
  assert.equal(withoutScore.score, null);
  assert.equal(withoutScore.provenance.recordedFootage, false);
  assert.equal(new URL(withoutScore.clipHref, 'https://cyberliga.test/').searchParams.has('score'), false);

  const withScore = director.record(baseEvent(tuple, {
    eventKey: 'optional-2', kind: 'knockout', score: { home: 2, away: 0 }, recordedFootage: true
  }));
  assert.deepEqual(withScore.score, { home: 2, away: 0 });
  assert.equal(withScore.provenance.recordedFootage, true);
  assert.equal(new URL(withScore.clipHref, 'https://cyberliga.test/').searchParams.get('score'), '2-0');
  [withoutScore, withScore].forEach((moment) => {
    assert.equal(moment.provenance.source, 'local-client');
    assert.equal(moment.provenance.authoritative, false);
    assert.equal(moment.provenance.wagerable, false);
    assert.equal(moment.provenance.settles, false);
  });
});

test('recording never mutates or freezes canonical inputs', () => {
  const tuple = genericTuple('hockey');
  const teamBefore = JSON.stringify(tuple.home);
  const athleteBefore = JSON.stringify(tuple.athlete);
  assert.equal(Object.isFrozen(tuple.home), false);
  assert.equal(Object.isFrozen(tuple.athlete), false);
  const director = Named.create({
    sportId: 'hockey', fixtureId: 'input-integrity', homeTeam: tuple.home, awayTeam: tuple.away
  });
  assert.ok(director.record(baseEvent(tuple, { eventKey: 'integrity-event' })));
  assert.equal(JSON.stringify(tuple.home), teamBefore);
  assert.equal(JSON.stringify(tuple.athlete), athleteBefore);
  assert.equal(Object.isFrozen(tuple.home), false);
  assert.equal(Object.isFrozen(tuple.athlete), false);
});

test('core source contains no environment, random, time, persistence, or scheduling dependency', async () => {
  const source = await readFile(new URL('./named-moments.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bMath\.random\b/);
  assert.doesNotMatch(source, /\bseededRandom\b/);
  assert.doesNotMatch(source, /\b(?:document|location|localStorage|sessionStorage|fetch|XMLHttpRequest|requestAnimationFrame|performance|Date|setTimeout|setInterval|queueMicrotask)\b/);
});
