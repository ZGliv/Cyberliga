import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

import {
  buildFallbackLive,
  CANONICAL_EPOCH_MS,
  DEFAULT_SLOT_MS
} from './lib/canonical-server.js';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const SPORT_IDS = ['soccer', 'american-football', 'basketball', 'hockey', 'baseball', 'combat'];
const EVENT_KIND = {
  soccer: 'goal',
  'american-football': 'score',
  basketball: 'basket',
  hockey: 'goal',
  baseball: 'run',
  combat: 'round_won'
};

function browserRuntime() {
  const window = {};
  const context = vm.createContext({ window, console });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'worlddata.js'), 'utf8'), context, { filename: 'worlddata.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'universe.js'), 'utf8'), context, { filename: 'universe.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'athlete-moments.js'), 'utf8'), context, { filename: 'athlete-moments.js' });
  return {
    window,
    content: window.CYBERLIGA_CONTENT,
    universe: window.CyberligaUniverse,
    model: window.CyberligaAthleteMoments
  };
}

const runtime = browserRuntime();
const { content, universe, model } = runtime;
const bound = model.create(content);

function json(value) {
  return JSON.parse(JSON.stringify(value));
}

function pairForSport(sportId, options = {}) {
  const teams = content.getTeams(sportId);
  if (sportId === 'soccer') {
    const channel = options.channel ?? 2;
    const at = Date.parse(options.startsAt || '2026-07-10T00:00:00.000Z') + 1;
    const match = universe.liveMatches(at)[channel];
    return {
      home: content.getTeam(match.home.id, sportId),
      away: content.getTeam(match.away.id, sportId)
    };
  }
  if (sportId === 'american-football') return { home: teams[0], away: teams[1] };
  const match = content.createSeason(sportId, 'arena').rounds[0].matches[0];
  return {
    home: content.getTeam(match.homeId, sportId),
    away: content.getTeam(match.awayId, sportId)
  };
}

function fixtureFor(sportId, options = {}) {
  const channel = options.channel ?? (sportId === 'soccer' ? 2 : 0);
  const startsAt = options.startsAt || '2026-07-10T00:00:00.000Z';
  const pair = options.pair || pairForSport(sportId, { channel, startsAt });
  const home = pair.home;
  const away = pair.away;
  const athlete = options.athlete || home.athletes[0];
  const fixtureId = options.fixtureId || `fixture:${sportId}`;
  const kind = options.kind || EVENT_KIND[sportId];
  const eventKey = options.eventKey || `event:${sportId}:1`;
  const event = {
    eventKey,
    sequence: options.sequence ?? 1,
    elapsedMs: options.elapsedMs ?? 120_000,
    occurredAt: options.occurredAt || '2026-07-10T00:02:00.000Z',
    kind,
    teamId: options.teamId || home.id,
    athleteId: options.athleteId || athlete.id,
    payload: {
      phase: 'live',
      scoreBefore: { home: 0, away: 0 },
      scoreAfter: { home: 1, away: 0 },
      points: options.points ?? (sportId === 'baseball' ? 2 : 1),
      leverage: options.leverage ?? 0.82,
      signatureCandidate: options.signatureCandidate ?? true,
      actorRole: athlete.role,
      storyTags: ['pressure-moment', 'hero', 'hero', '<b>tag</b>', '3', '4', '5', '6', '7', '8', '9'],
      call: '<script>FORGED CANONICAL HEADLINE</script>'
    }
  };
  return {
    fixtureId,
    matchId: options.matchId || `match:${sportId}`,
    sportKey: sportId,
    channel,
    roundNumber: 1,
    revision: 7,
    status: 'live',
    phase: 'live',
    elapsedMs: 150_000,
    durationMs: 360_000,
    startsAt,
    scheduledEndAt: options.scheduledEndAt || new Date(Date.parse(startsAt) + DEFAULT_SLOT_MS).toISOString(),
    homeScore: 1,
    awayScore: 0,
    homeTeam: { publicId: home.id },
    awayTeam: { publicId: away.id },
    events: options.events || [event]
  };
}

function payloadFor(matches, overrides = {}) {
  return {
    source: 'supabase',
    canonical: true,
    observedAt: '2026-07-10T00:02:30.000Z',
    matches,
    ...overrides
  };
}

test('exposes a frozen browser UMD and Node-importable, information-only API', async () => {
  assert.ok(model);
  assert.equal(model.version, '1.0.0');
  assert.deepEqual(Array.from(model.sportIds), SPORT_IDS);
  assert.ok(Object.isFrozen(model));
  assert.ok(Object.isFrozen(model.safety));
  assert.deepEqual(json(model.safety), {
    informationOnly: true,
    realMoney: false,
    prizes: false,
    fanCallSettlement: false
  });
  assert.equal(model.settleFanCall, undefined);
  assert.equal(model.resolveFanCall, undefined);
  assert.equal(model.placeBet, undefined);
  assert.deepEqual(
    Object.keys(model).filter((key) => /settle|payout|wager|odds|prize|bet/i.test(key)),
    []
  );
  assert.throws(() => model.normalizeLive({}, {}), /CYBERLIGA_CONTENT/);

  delete globalThis.CyberligaAthleteMoments;
  await import(`${pathToFileURL(path.join(ROOT, 'athlete-moments.js')).href}?node-test=${Date.now()}`);
  assert.equal(typeof globalThis.CyberligaAthleteMoments.normalizeLive, 'function');
  assert.equal(globalThis.CyberligaAthleteMoments.version, model.version);
  delete globalThis.CyberligaAthleteMoments;
});

test('normalizes the deterministic 24-game feed across all six sports without mutating input', () => {
  const at = CANONICAL_EPOCH_MS + DEFAULT_SLOT_MS - 1;
  const payload = buildFallbackLive(at);
  const before = JSON.stringify(payload);
  const snapshot = bound.normalizeLive(payload);

  assert.equal(JSON.stringify(payload), before);
  assert.equal(snapshot.summary.fixtureCount, 24);
  assert.equal(snapshot.summary.validFixtures, 24);
  assert.equal(snapshot.summary.accepted, snapshot.moments.length);
  assert.ok(snapshot.moments.length > 100);
  assert.deepEqual([...new Set(snapshot.moments.map((moment) => moment.sportId))].sort(), [...SPORT_IDS].sort());
  assert.equal(snapshot.source, 'deterministic-fallback');
  assert.equal(snapshot.canonical, false);
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.moments));

  for (const moment of snapshot.moments) {
    assert.ok(content.getSport(moment.sportId));
    assert.equal(content.getTeam(moment.team.id, moment.sportId).id, moment.team.id);
    assert.equal(content.getAthlete(moment.team.id, moment.athlete.id).id, moment.athlete.id);
    assert.ok(moment.eventKey && moment.fixtureId && moment.kind && moment.kindLabel);
    assert.ok(moment.sportName && moment.phase && moment.phaseLabel);
    assert.equal(moment.source, snapshot.source);
    assert.equal(moment.canonical, snapshot.canonical);
    assert.equal(moment.observedAt, snapshot.observedAt);
    assert.equal(moment.arenaUrl, moment.links.arena);
    assert.equal(moment.profileUrl, moment.links.profile);
    assert.equal(moment.clipUrl, moment.links.clip);
    assert.ok(Object.isFrozen(moment));
    assert.ok(Object.isFrozen(moment.athlete));
    assert.ok(Object.isFrozen(moment.team));
    assert.ok(!/[<>]/.test(JSON.stringify(moment)));
  }
});

test('builds exact arena, profile, and event-derived clip URLs for every sport', () => {
  const expectedArenas = {
    soccer: 'index.html?match=2',
    'american-football': 'football.html?fixture=0',
    basketball: 'hoops.html?match=0',
    hockey: 'hockey.html?match=0',
    baseball: 'baseball.html?match=0',
    combat: 'fight.html?match=0'
  };
  const expectedHeadlines = {
    soccer: 'FINDS THE NET FOR',
    'american-football': 'PUTS',
    basketball: 'HITS FOR',
    hockey: 'FINDS THE NET FOR',
    baseball: 'BRINGS HOME 2 FOR',
    combat: 'TAKES THE ROUND FOR'
  };

  for (const sportId of SPORT_IDS) {
    const fixture = fixtureFor(sportId);
    const moment = bound.normalizeLive(payloadFor([fixture])).moments[0];
    assert.ok(moment, sportId);
    assert.equal(moment.arenaUrl, expectedArenas[sportId]);
    assert.match(moment.headline, new RegExp(expectedHeadlines[sportId]));
    assert.ok(!moment.headline.includes('FORGED'));

    const profile = new URL(moment.profileUrl, 'https://cyberliga.test/');
    assert.equal(profile.pathname, '/player.html');
    assert.equal(profile.searchParams.get('sport'), sportId);
    assert.equal(profile.searchParams.get('team'), moment.team.id);
    assert.equal(profile.searchParams.get('player'), moment.athlete.id);

    const clip = new URL(moment.clipUrl, 'https://cyberliga.test/');
    assert.equal(clip.pathname, '/clip.html');
    assert.equal(clip.searchParams.get('fixture'), fixture.fixtureId);
    assert.equal(clip.searchParams.get('match'), fixture.fixtureId);
    assert.notEqual(clip.searchParams.get('match'), fixture.matchId);
    assert.equal(clip.searchParams.get('story'), moment.eventKey);
    assert.equal(clip.searchParams.get('event'), moment.eventKey);
    assert.equal(clip.searchParams.get('eventSource'), 'supabase');
    assert.equal(clip.searchParams.get('headline'), moment.headline);
    assert.equal(clip.searchParams.get('view'), '1');
    assert.equal(clip.searchParams.has('eventCanonical'), false);
  }

  for (const slot of [0, 1, 6, 7, 13, 14]) {
    const startsAtMs = CANONICAL_EPOCH_MS + slot * DEFAULT_SLOT_MS;
    const startsAt = new Date(startsAtMs).toISOString();
    for (let channel = 0; channel < 4; channel += 1) {
      const universeMatch = universe.liveMatches(startsAtMs + 1)[channel];
      const fixture = fixtureFor('soccer', {
        channel,
        startsAt,
        occurredAt: new Date(startsAtMs + 120_000).toISOString()
      });
      const moment = bound.normalizeLive(payloadFor([fixture], {
        observedAt: new Date(startsAtMs + 150_000).toISOString()
      })).moments[0];
      assert.equal(moment.home.id, universeMatch.home.id, `slot ${slot} channel ${channel} home`);
      assert.equal(moment.away.id, universeMatch.away.id, `slot ${slot} channel ${channel} away`);
      assert.equal(moment.arenaUrl, `index.html?match=${channel}`, `slot ${slot} channel ${channel} route`);
    }
  }
});

test('falls back safely when an arena cannot represent a fixture', () => {
  const soccer = fixtureFor('soccer');
  delete soccer.channel;
  assert.equal(bound.normalizeLive(payloadFor([soccer])).moments[0].arenaUrl, 'world.html?sport=soccer');

  const soccerTeams = content.getTeams('soccer');
  const wrongSoccerPair = fixtureFor('soccer', {
    channel: 2,
    pair: { home: soccerTeams[0], away: soccerTeams[1] }
  });
  assert.equal(
    bound.normalizeLive(payloadFor([wrongSoccerPair])).moments[0].arenaUrl,
    'world.html?sport=soccer'
  );

  const scheduledPair = pairForSport('soccer', { channel: 2, startsAt: '2026-07-10T00:00:00.000Z' });
  const reversedSoccerPair = fixtureFor('soccer', {
    channel: 2,
    pair: { home: scheduledPair.away, away: scheduledPair.home }
  });
  assert.equal(
    bound.normalizeLive(payloadFor([reversedSoccerPair])).moments[0].arenaUrl,
    'world.html?sport=soccer'
  );

  const staleSoccer = fixtureFor('soccer');
  assert.equal(
    bound.normalizeLive(payloadFor([staleSoccer], {
      observedAt: new Date(CANONICAL_EPOCH_MS + DEFAULT_SLOT_MS + 1).toISOString()
    })).moments[0].arenaUrl,
    'world.html?sport=soccer'
  );

  const misalignedStartsAt = '2026-07-10T00:01:00.000Z';
  const misalignedSoccer = fixtureFor('soccer', { startsAt: misalignedStartsAt });
  assert.equal(
    bound.normalizeLive(payloadFor([misalignedSoccer], { observedAt: '2026-07-10T00:02:30.000Z' })).moments[0].arenaUrl,
    'world.html?sport=soccer'
  );

  const footballTeams = content.getTeams('american-football');
  const unsupported = fixtureFor('american-football', {
    pair: { home: footballTeams[0], away: footballTeams[2] }
  });
  assert.equal(
    bound.normalizeLive(payloadFor([unsupported])).moments[0].arenaUrl,
    'world.html?sport=american-football'
  );
});

test('trusts canonical provenance only for a strict non-degraded payload', () => {
  const fixture = fixtureFor('soccer');
  assert.equal(bound.normalizeLive(payloadFor([fixture])).canonical, true);
  assert.equal(bound.normalizeLive(payloadFor([fixture], { canonical: 'true' })).canonical, false);
  assert.equal(bound.normalizeLive(payloadFor([fixture], { canonical: true, degraded: true })).canonical, false);
  assert.equal(bound.normalizeLive(payloadFor([fixture], { canonical: false, degraded: false })).canonical, false);
  const contradictoryFallback = bound.normalizeLive(payloadFor([fixture], {
    source: 'deterministic-fallback',
    canonical: true,
    degraded: false
  }));
  assert.equal(contradictoryFallback.source, 'deterministic-fallback');
  assert.equal(contradictoryFallback.canonical, false);
  assert.equal(contradictoryFallback.moments[0].canonical, false);
  assert.equal(bound.normalizeLive(payloadFor([fixture], { source: 'Supabase', canonical: true })).canonical, false);
  assert.equal(bound.normalizeLive(payloadFor([fixture], { source: ' supabase ', canonical: true })).canonical, false);
  assert.equal(bound.normalizeLive(payloadFor([fixture], { source: 'supabase<script>', canonical: true })).canonical, false);
  assert.equal(bound.normalizeLive(payloadFor([fixture], { observedAt: 'not-a-date' })).observedAt, null);
});

test('does not create an event-reference clip without a validated score-after pair', () => {
  const fixture = fixtureFor('basketball');
  const valid = bound.normalizeLive(payloadFor([fixture])).moments[0];
  assert.ok(valid.clipUrl.startsWith('clip.html?'));

  const routeInput = {
    sportId: valid.sportId,
    homeId: valid.home.id,
    awayId: valid.away.id,
    athleteId: valid.athlete.id,
    fixtureId: valid.fixtureId,
    eventKey: valid.eventKey,
    score: { after: { home: 1, away: 0 } }
  };
  assert.ok(bound.clipUrl(routeInput).startsWith('clip.html?'));
  assert.equal(bound.clipUrl({ ...routeInput, score: { after: null } }), 'world.html');
  assert.equal(bound.clipUrl({ ...routeInput, score: { after: { home: 1 } } }), 'world.html');
  assert.equal(bound.clipUrl({ ...routeInput, score: { after: { home: -1, away: 0 } } }), 'world.html');

  fixture.events[0].payload.scoreAfter = null;
  const missingScoreSnapshot = bound.normalizeLive(payloadFor([fixture]));
  assert.equal(missingScoreSnapshot.moments.length, 0);
  assert.equal(missingScoreSnapshot.summary.ignored, 1);
});

test('ignores malformed, unattributed, cross-team, and lifecycle events', () => {
  const fixture = fixtureFor('hockey');
  const valid = fixture.events[0];
  const away = content.getTeam(fixture.awayTeam.publicId, 'hockey');
  fixture.events = [
    valid,
    null,
    { ...valid, eventKey: '' },
    { ...valid, eventKey: 'bad:payload', payload: [] },
    { ...valid, eventKey: 'missing:athlete', athleteId: null },
    { ...valid, eventKey: 'unknown:team', teamId: 'not-a-team' },
    { ...valid, eventKey: 'unknown:athlete', athleteId: 'not-an-athlete' },
    { ...valid, eventKey: 'cross:team', athleteId: away.athletes[0].id },
    { ...valid, eventKey: 'negative:sequence', sequence: -1 },
    { ...valid, eventKey: 'negative:elapsed', elapsedMs: -1 },
    { ...valid, eventKey: 'malformed:kind', kind: '<script>alert(1)</script>' },
    { ...valid, eventKey: 'cross:sport:kind', kind: 'basket' },
    { ...valid, eventKey: 'missing:score-before', payload: { ...valid.payload, scoreBefore: null } },
    { ...valid, eventKey: 'missing:score-after', payload: { ...valid.payload, scoreAfter: null } },
    { ...valid, eventKey: 'lifecycle:start', kind: 'match_started' },
    { ...valid, eventKey: 'lifecycle:final', kind: 'match_final' }
  ];
  const snapshot = bound.normalizeLive(payloadFor([fixture]));
  assert.equal(snapshot.moments.length, 1);
  assert.equal(snapshot.summary.eventCount, fixture.events.length);
  assert.equal(snapshot.summary.ignored, fixture.events.length - 1);
  assert.equal(snapshot.moments[0].eventKey, valid.eventKey);
  assert.ok(!JSON.stringify(snapshot).includes('FORGED CANONICAL HEADLINE'));
  assert.ok(snapshot.moments[0].impact.storyTags.length <= 8);
});

test('deduplicates by match plus event key without collapsing separate matches', () => {
  const first = fixtureFor('baseball', { fixtureId: 'fixture:dedupe:a', matchId: 'match:dedupe:a', eventKey: 'event:shared:1' });
  const second = fixtureFor('baseball', { fixtureId: 'fixture:dedupe:b', matchId: 'match:dedupe:b', eventKey: 'event:shared:1' });
  second.events[0].payload.scoreAfter = { home: 2, away: 0 };
  const forward = bound.normalizeLive(payloadFor([first, second]));
  const reverse = bound.normalizeLive(payloadFor([second, first]));
  assert.equal(forward.moments.length, 2);
  assert.equal(forward.summary.duplicates, 0);
  assert.equal(reverse.summary.duplicates, 0);
  assert.equal(JSON.stringify(forward.moments), JSON.stringify(reverse.moments));
  assert.equal(new Set(forward.moments.map((moment) => moment.id)).size, 2);

  const duplicate = structuredClone(first.events[0]);
  first.events.push(duplicate);
  const withinMatch = bound.normalizeLive(payloadFor([first]));
  assert.equal(withinMatch.moments.length, 1);
  assert.equal(withinMatch.summary.duplicates, 1);
  assert.equal(withinMatch.moments[0].id, `${first.matchId}|${duplicate.eventKey}`);
});

test('filters and prioritizes followed athlete-plus-team, athlete, then team', () => {
  const athleteOnly = bound.normalizeLive(payloadFor([fixtureFor('soccer')])).moments[0];
  const teamOnly = bound.normalizeLive(payloadFor([fixtureFor('hockey')])).moments[0];
  const both = bound.normalizeLive(payloadFor([fixtureFor('basketball')])).moments[0];
  const unmatched = bound.normalizeLive(payloadFor([fixtureFor('combat')])).moments[0];
  const follows = {
    athletes: [athleteOnly.athlete.id, both.athlete.id, both.athlete.id, 'bad id'],
    teams: [teamOnly.team.id, both.team.id, both.team.id]
  };
  const source = [teamOnly, unmatched, athleteOnly, both];
  const selected = model.selectForFollows(source, follows, 10);
  assert.deepEqual(Array.from(selected, (moment) => moment.eventKey), [both.eventKey, athleteOnly.eventKey, teamOnly.eventKey]);
  assert.equal(model.selectForFollows({ moments: source }, follows, 1)[0], both);
  assert.equal(model.selectForFollows(source, follows, 0).length, 0);
  assert.deepEqual(json(model.followMatch(both, follows)), {
    matched: true,
    athlete: true,
    team: true,
    kind: 'athlete+team',
    priority: 3
  });
  assert.equal(model.followMatch(unmatched, follows).matched, false);
});

test('revalidates stored moments, recomputes editorial identity and links, and never restores canonical trust', () => {
  const original = bound.normalizeLive(payloadFor([fixtureFor('baseball')])).moments[0];
  const stored = json(original);
  stored.sport.name = 'FORGED SPORT';
  stored.team.name = 'FORGED TEAM';
  stored.athlete.name = 'FORGED ATHLETE';
  stored.headline = 'FORGED HEADLINE';
  stored.impact.call = '<script>FORGED CALL</script>';
  stored.links = { arena: 'javascript:alert(1)', profile: 'javascript:alert(2)', clip: 'javascript:alert(3)' };
  stored.arenaUrl = 'javascript:alert(1)';
  stored.provenance = {
    source: 'stored<script>',
    canonical: true,
    degraded: false,
    observedAt: original.observedAt
  };

  const normalized = bound.normalizeStoredMoment(stored);
  assert.ok(normalized);
  assert.equal(normalized.canonical, false);
  assert.equal(normalized.provenance.canonical, false);
  assert.equal(normalized.team.name, original.team.name);
  assert.equal(normalized.athlete.name, original.athlete.name);
  assert.equal(normalized.headline, original.headline);
  assert.equal(normalized.arenaUrl, original.arenaUrl);
  assert.equal(normalized.profileUrl, original.profileUrl);
  assert.ok(normalized.clipUrl.startsWith('clip.html?'));
  assert.ok(!/FORGED|javascript:|[<>]/.test(JSON.stringify(normalized)));
  assert.ok(Object.isFrozen(normalized));

  assert.equal(bound.normalizeStoredMoment({ ...stored, schemaVersion: 99 }), null);
  assert.equal(bound.normalizeStoredMoment({ ...stored, teamId: 'not-a-team' }), null);
  assert.equal(bound.normalizeStoredMoment({ ...stored, athleteId: 'not-an-athlete' }), null);
});
