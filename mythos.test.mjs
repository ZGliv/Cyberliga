import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const [worlddataSource, mythosSource] = await Promise.all([
  readFile(path.join(ROOT, 'worlddata.js'), 'utf8'),
  readFile(path.join(ROOT, 'mythos.js'), 'utf8')
]);

const FIXED_TIME = Date.UTC(2030, 0, 15, 12, 7, 30);
const PUBLIC_BASE = 'https://cyberliga-ten.vercel.app/';
const SUPPORTER_CONTRACT = 'Fictional supporter picks only. No cash, prizes, deposits, payouts or gameplay influence.';
const ARENA_PATHS = Object.freeze({
  soccer: '/index.html',
  'american-football': '/football.html',
  basketball: '/hoops.html',
  hockey: '/hockey.html',
  baseball: '/baseball.html',
  combat: '/fight.html'
});

function evaluateBrowserScript(source, filename, window) {
  const context = vm.createContext({
    window,
    URLSearchParams,
    Date,
    Math,
    Array,
    Object,
    String,
    Number,
    JSON,
    encodeURIComponent,
    decodeURIComponent,
    console
  });
  vm.runInContext(source, context, { filename, timeout: 2000 });
}

function loadRuntime(initialWindow = {}) {
  const window = { ...initialWindow };
  evaluateBrowserScript(worlddataSource, 'worlddata.js', window);
  evaluateBrowserScript(mythosSource, 'mythos.js', window);
  return { window, content: window.CYBERLIGA_CONTENT, mythos: window.CyberligaMythos };
}

function stableJson(value) {
  return JSON.stringify(value);
}

function assertRichText(value, label, minimumLength = 12) {
  assert.equal(typeof value, 'string', `${label} must be text`);
  assert.ok(value.trim().length >= minimumLength, `${label} must carry meaningful detail`);
}

function collectKeys(value, found = new Set()) {
  if (!value || typeof value !== 'object') return found;
  for (const [key, child] of Object.entries(value)) {
    found.add(key.toLowerCase());
    collectKeys(child, found);
  }
  return found;
}

test('browser bootstrap exposes the frozen public mythos API and supporter contract', () => {
  const { content, mythos } = loadRuntime();
  assert.ok(content, 'worlddata must load before mythos');
  assert.ok(mythos, 'mythos must expose window.CyberligaMythos');
  assert.equal(mythos.version, '1.0.0');
  assert.equal(mythos.epochMs, 15 * 60 * 1000);
  assert.equal(mythos.supporterContract, SUPPORTER_CONTRACT);
  assert.ok(Object.isFrozen(mythos), 'public API must be frozen');

  for (const method of [
    'epoch',
    'resolveSport',
    'resolveTeam',
    'resolveAthlete',
    'athleteProfile',
    'matchStory',
    'slate',
    'world',
    'arenaHref'
  ]) {
    assert.equal(typeof mythos[method], 'function', `${method} must be public`);
  }
});

test('epochs are deterministic, normalized, and change only on 15-minute boundaries', () => {
  const { mythos } = loadRuntime();
  const epochMs = mythos.epochMs;
  const slot = Math.floor(FIXED_TIME / epochMs);
  const slotStart = slot * epochMs;
  const atStart = mythos.epoch(slotStart);
  const atMiddle = mythos.epoch(slotStart + epochMs / 2);
  const atEnd = mythos.epoch(slotStart + epochMs - 1);
  const next = mythos.epoch(slotStart + epochMs);

  assert.equal(atStart.slot, slot);
  assert.equal(atStart.id, `epoch-${slot.toString(36)}`);
  assert.equal(atStart.seasonId, `epoch-01-${Math.floor(slot / 14)}`);
  assert.equal(atStart.continuityId, `continuity-01-${Math.floor(slot / (14 * 96))}`);
  assert.equal(atStart.roundIndex, ((slot % 14) + 14) % 14);
  assert.equal(atStart.progress, 0);
  assert.equal(atStart.remainingMs, epochMs);
  assert.equal(atMiddle.id, atStart.id);
  assert.equal(atMiddle.progress, 0.5);
  assert.equal(atEnd.id, atStart.id);
  assert.equal(atEnd.remainingMs, 1);
  assert.equal(next.slot, slot + 1);
  assert.notEqual(next.id, atStart.id);
  assert.deepEqual(mythos.epoch(FIXED_TIME), mythos.epoch(FIXED_TIME));

  const negative = mythos.epoch(-1);
  assert.equal(negative.slot, -1);
  assert.equal(negative.roundIndex, 13);
  assert.ok(negative.progress >= 0 && negative.progress < 1);
});

test('schedule cycles cover all fourteen rounds while character continuity spans two weeks', () => {
  const { content, mythos } = loadRuntime();
  const referenceSlot = Math.floor(FIXED_TIME / mythos.epochMs);
  const cycleStart = referenceSlot - ((referenceSlot % 14) + 14) % 14;
  const seasonIds = new Set();
  const directedMeetings = new Set();
  const undirectedMeetings = new Map();

  for (let offset = 0; offset < 14; offset += 1) {
    const at = (cycleStart + offset) * mythos.epochMs;
    const current = mythos.epoch(at);
    seasonIds.add(current.seasonId);
    assert.equal(current.roundIndex, offset);
    for (const story of mythos.slate('soccer', at)) {
      directedMeetings.add(`${story.home.id}>${story.away.id}`);
      const pair = [story.home.id, story.away.id].sort().join(':');
      undirectedMeetings.set(pair, (undirectedMeetings.get(pair) || 0) + 1);
    }
  }

  assert.equal(seasonIds.size, 1, 'one schedule seed must cover the complete double round robin');
  assert.equal(directedMeetings.size, 56, 'every directed fixture must appear once per schedule cycle');
  assert.equal(undirectedMeetings.size, 28);
  assert.ok([...undirectedMeetings.values()].every((count) => count === 2));

  const beforeBoundary = (cycleStart + 13) * mythos.epochMs;
  const afterBoundary = (cycleStart + 14) * mythos.epochMs;
  const beforeEpoch = mythos.epoch(beforeBoundary);
  const afterEpoch = mythos.epoch(afterBoundary);
  assert.equal(beforeEpoch.roundIndex, 13);
  assert.equal(afterEpoch.roundIndex, 0);
  assert.notEqual(beforeEpoch.seasonId, afterEpoch.seasonId);
  assert.equal(beforeEpoch.continuityId, afterEpoch.continuityId);

  const athlete = content.getTeams('soccer')[0].athletes[0];
  const team = content.getTeams('soccer')[0];
  assert.equal(
    stableJson(mythos.athleteProfile('soccer', team.id, athlete.id, { now: beforeBoundary })),
    stableJson(mythos.athleteProfile('soccer', team.id, athlete.id, { now: afterBoundary })),
    'short schedule rollover must not rewrite an athlete arc'
  );

  const continuityBoundary = (Math.floor(referenceSlot / (14 * 96)) + 1) * 14 * 96;
  assert.notEqual(
    mythos.epoch((continuityBoundary - 1) * mythos.epochMs).continuityId,
    mythos.epoch(continuityBoundary * mythos.epochMs).continuityId
  );
});

test('every sport exposes a stable four-match slate with every club scheduled once', () => {
  const { content, mythos } = loadRuntime();
  const epoch = mythos.epoch(FIXED_TIME);
  const slotStart = epoch.slot * mythos.epochMs;
  const allKeys = new Set();
  const allParticipants = new Set();

  for (const sport of content.sports) {
    const early = mythos.slate(sport.id, slotStart + 1);
    const late = mythos.slate(sport.id, slotStart + mythos.epochMs - 1);
    const repeated = mythos.slate(sport.id, slotStart + 1);
    assert.equal(stableJson(early), stableJson(late), `${sport.id} slate changed inside one epoch`);
    assert.equal(stableJson(early), stableJson(repeated), `${sport.id} slate was not repeatable`);
    assert.equal(early.length, 4, `${sport.id} must expose four simultaneous matches`);
    assert.deepEqual(Array.from(early, (story) => story.channel), [1, 2, 3, 4]);
    assert.equal(new Set(early.map((story) => story.headline)).size, 4, `${sport.id} slate headlines must remain matchup-specific`);

    const participants = new Set();
    for (const story of early) {
      assert.equal(story.sportId, sport.id);
      assert.equal(story.epochId, epoch.id);
      assert.ok(!allKeys.has(story.key), `duplicate match key ${story.key}`);
      allKeys.add(story.key);
      participants.add(story.home.id);
      participants.add(story.away.id);
      allParticipants.add(story.home.id);
      allParticipants.add(story.away.id);
    }
    assert.equal(participants.size, 8, `${sport.id} must schedule every club exactly once`);
  }

  assert.equal(allKeys.size, 24);
  assert.equal(allParticipants.size, 48);
  assert.equal(mythos.slate('not-a-sport', FIXED_TIME).length, 0);
});

test('the fixed-time world contains all 24 matches and preserves the six-sport public metrics', () => {
  const { mythos } = loadRuntime();
  const world = mythos.world(FIXED_TIME);
  assert.deepEqual(
    JSON.parse(stableJson(world.metrics)),
    { sports: 6, clubs: 48, games: 24, athletes: 416 }
  );
  assert.equal(world.matches.length, 24);
  assert.equal(world.featured.length, 6);
  assert.equal(world.lead.id, world.featured[0].id);
  assert.equal(new Set(world.matches.map((story) => story.id)).size, 24);
  assert.equal(new Set(world.matches.map((story) => story.key)).size, 24);
  assert.equal(new Set(world.matches.map((story) => story.headline)).size, 24, 'all 24 live stories must have distinct matchup-specific headlines');

  const sportTotals = new Map();
  for (const story of world.matches) {
    sportTotals.set(story.sportId, (sportTotals.get(story.sportId) || 0) + 1);
    assert.equal(story.featured.length, 2);
    assert.ok(story.heat >= 65 && story.heat <= 99);
  }
  assert.equal(sportTotals.size, 6);
  for (const count of sportTotals.values()) assert.equal(count, 4);

  for (let index = 1; index < world.matches.length; index += 1) {
    assert.ok(world.matches[index - 1].heat >= world.matches[index].heat, 'world must remain heat-ranked');
  }
});

test('all 416 athletes resolve to rich, internally linked profiles', () => {
  const { content, mythos } = loadRuntime();
  const profileIds = new Set();
  const arcIds = new Set();
  const rituals = new Set();
  const statuses = new Set();
  const dropTypes = new Set();
  let profileCount = 0;

  for (const sport of content.sports) {
    assert.equal(mythos.resolveSport(sport.id).id, sport.id);
    assert.equal(mythos.resolveSport(sport.name).id, sport.id);
    assert.equal(mythos.resolveSport(sport.league).id, sport.id);

    for (const team of sport.teams) {
      assert.equal(mythos.resolveTeam(sport.id, team.id).id, team.id);
      assert.equal(mythos.resolveTeam(sport.id, team.code).id, team.id);
      const rival = content.getTeam(team.rivalryId, sport.id);

      for (const athlete of team.athletes) {
        const profile = mythos.athleteProfile(sport.id, team.id, athlete.id, { now: FIXED_TIME });
        assert.ok(profile, `profile did not resolve for ${athlete.id}`);
        assert.equal(mythos.resolveAthlete(team, athlete.id).id, athlete.id);
        assert.equal(profile.id, athlete.id);
        assert.equal(profile.sportId, sport.id);
        assert.equal(profile.teamId, team.id);
        assert.equal(profile.name, athlete.name);
        assert.equal(profile.role, athlete.role);
        assert.ok(!profileIds.has(profile.id), `duplicate profile ${profile.id}`);
        profileIds.add(profile.id);
        profileCount += 1;

        assert.ok(Number.isInteger(profile.starPower) && profile.starPower >= 45 && profile.starPower <= 99);
        assert.ok(Number.isInteger(profile.fanHeat) && profile.fanHeat >= 48 && profile.fanHeat <= 99);
        assert.ok(Number.isInteger(profile.pressure) && profile.pressure >= 54 && profile.pressure <= 98);
        assert.ok(Number.isInteger(profile.volatility) && profile.volatility >= 28 && profile.volatility <= 96);
        assert.ok(Number.isInteger(profile.trajectory.delta));
        assertRichText(profile.trajectory.label, `${athlete.id} trajectory`, 4);
        assertRichText(profile.status, `${athlete.id} status`, 4);
        assertRichText(profile.arc.label, `${athlete.id} arc label`, 6);
        assertRichText(profile.arc.desire, `${athlete.id} desire`);
        assertRichText(profile.arc.pressure, `${athlete.id} pressure`);
        assertRichText(profile.arc.promise, `${athlete.id} promise`);
        assertRichText(profile.gift, `${athlete.id} gift`);
        assertRichText(profile.flaw, `${athlete.id} flaw`);
        assertRichText(profile.temperament, `${athlete.id} temperament`, 4);
        assertRichText(profile.silhouette, `${athlete.id} silhouette`);
        assertRichText(profile.ritual, `${athlete.id} ritual`);
        assertRichText(profile.voice, `${athlete.id} voice`);

        assert.ok(profile.bond, `${athlete.id} needs a trust link`);
        assert.notEqual(profile.bond.athleteId, athlete.id);
        assert.ok(team.athletes.some((candidate) => candidate.id === profile.bond.athleteId));
        assert.ok(profile.mirror, `${athlete.id} needs a rival mirror`);
        assert.equal(profile.mirror.teamId, rival.id);
        assert.ok(rival.athletes.some((candidate) => candidate.id === profile.mirror.athleteId));

        assert.match(profile.collectible.id, /^drop-[a-z0-9]+$/);
        assertRichText(profile.collectible.name, `${athlete.id} collectible name`);
        assertRichText(profile.collectible.concept, `${athlete.id} collectible concept`);
        assert.equal(profile.collectible.material, team.texture);
        assert.equal(profile.collectible.commerceState, 'CONCEPT / SAVE TO LOCKER');
        assert.equal(profile.collectible.colors.length, 3);
        for (const color of profile.collectible.colors) assert.match(color, /^#[0-9a-f]{6}$/i);

        const profileUrl = new URL(profile.canonicalUrl, PUBLIC_BASE);
        assert.equal(profileUrl.pathname, '/player.html');
        assert.equal(profileUrl.searchParams.get('sport'), sport.id);
        assert.equal(profileUrl.searchParams.get('team'), team.id);
        assert.equal(profileUrl.searchParams.get('player'), athlete.id);

        arcIds.add(profile.arc.id);
        rituals.add(profile.ritual);
        statuses.add(profile.status);
        dropTypes.add(profile.collectible.type);
      }
    }
  }

  assert.equal(profileCount, 416);
  assert.equal(profileIds.size, 416);
  assert.ok(arcIds.size >= 6, 'profiles should exercise a broad set of story arcs');
  assert.ok(rituals.size >= 6, 'profiles should exercise a broad set of rituals');
  assert.ok(statuses.size >= 4, 'profiles should expose varied public status levels');
  assert.ok(dropTypes.size >= 5, 'profiles should expose varied collectible concepts');
  assert.equal(mythos.athleteProfile('soccer', 'missing-team', 'missing-athlete', { now: FIXED_TIME }), null);
});

test('match links use supported selectors or fall back honestly without opening a wrong game', () => {
  const { content, mythos } = loadRuntime();
  const world = mythos.world(FIXED_TIME);

  for (const story of world.matches) {
    assert.equal('arenaQuery' in story, false, 'stories must not expose unsupported home/away routing metadata');
    assert.ok(Number.isInteger(story.home.pickShare));
    assert.ok(Number.isInteger(story.away.pickShare));
    assert.ok(story.home.pickShare >= 34 && story.home.pickShare <= 66);
    assert.ok(story.away.pickShare >= 34 && story.away.pickShare <= 66);
    assert.equal(story.home.pickShare + story.away.pickShare, 100);

    const arenaUrl = new URL(mythos.arenaHref(story), PUBLIC_BASE);
    assert.equal(arenaUrl.origin, new URL(PUBLIC_BASE).origin);
    assert.ok(
      arenaUrl.pathname === ARENA_PATHS[story.sportId] || arenaUrl.pathname === '/world.html',
      `${story.sportId} link must be an exact arena selector or an honest World fallback`
    );
    assert.equal(arenaUrl.searchParams.has('home'), false);
    assert.equal(arenaUrl.searchParams.has('away'), false);
    assert.equal(arenaUrl.searchParams.has('league'), false);
    if (arenaUrl.pathname === ARENA_PATHS[story.sportId]) {
      const selector = story.sportId === 'american-football' ? 'fixture' : 'match';
      assert.ok(/^\d+$/.test(arenaUrl.searchParams.get(selector) || ''));
    } else {
      assert.equal(arenaUrl.searchParams.get('sport'), story.sportId);
    }
    assert.equal(arenaUrl.hash, '');
  }

  const football = content.getTeams('american-football');
  const supportedFootball = mythos.matchStory('american-football', football[0], football[1], { now: FIXED_TIME });
  assert.equal(mythos.arenaHref(supportedFootball), 'football.html?fixture=0');
  const unsupportedFootball = mythos.matchStory('american-football', football[0], football[2], { now: FIXED_TIME });
  assert.equal(mythos.arenaHref(unsupportedFootball), 'world.html?sport=american-football');

  const soccer = content.getTeams('soccer');
  const liveStory = mythos.matchStory('soccer', soccer[0], soccer[1], { now: FIXED_TIME });
  const exactRuntime = loadRuntime({
    CyberligaUniverse: {
      liveMatches: () => [{ id: 'CL-EXACT-0', home: { id: soccer[0].id }, away: { id: soccer[1].id } }],
      sharePath: (match) => `index.html?match=${match.id}`
    }
  });
  assert.equal(exactRuntime.mythos.arenaHref(liveStory), 'index.html?match=CL-EXACT-0');

  assert.equal(mythos.arenaHref(null), 'world.html');
});

test('supporter picks remain explicitly fictional with no cash or prize mechanics', () => {
  const { mythos } = loadRuntime();
  const world = mythos.world(FIXED_TIME);
  assert.equal(mythos.supporterContract, SUPPORTER_CONTRACT);
  assert.equal(world.supporterContract, SUPPORTER_CONTRACT);
  assert.ok(world.matches.every((story) => story.supporterContract === SUPPORTER_CONTRACT));

  const contract = SUPPORTER_CONTRACT.toLowerCase();
  for (const phrase of ['fictional supporter picks', 'no cash', 'prizes', 'deposits', 'payouts', 'gameplay influence']) {
    assert.ok(contract.includes(phrase), `supporter contract must state ${phrase}`);
  }

  const forbiddenMechanicKeys = new Set([
    'bet',
    'bets',
    'betamount',
    'cash',
    'cashbalance',
    'currency',
    'deposit',
    'deposits',
    'entryfee',
    'jackpot',
    'odds',
    'payout',
    'payouts',
    'prize',
    'prizepool',
    'settlement',
    'stakeamount',
    'wager',
    'wagers',
    'wallet'
  ]);
  const publicKeys = collectKeys(world);
  const exposedMechanics = [...forbiddenMechanicKeys].filter((key) => publicKeys.has(key));
  assert.deepEqual(exposedMechanics, []);
  assert.ok(world.matches.every((story) => story.featured.every((profile) => profile.collectible.commerceState === 'CONCEPT / SAVE TO LOCKER')));
});

test('fixed-time output is byte-stable across call order and fresh runtimes', () => {
  const firstRuntime = loadRuntime();
  const before = stableJson(firstRuntime.mythos.world(FIXED_TIME));

  for (const sport of firstRuntime.content.sports.slice().reverse()) {
    firstRuntime.mythos.slate(sport.id, FIXED_TIME);
    for (const team of sport.teams.slice().reverse()) {
      for (const athlete of team.athletes.slice().reverse()) {
        firstRuntime.mythos.athleteProfile(sport.id, team.id, athlete.id, { now: FIXED_TIME });
      }
    }
  }

  const after = stableJson(firstRuntime.mythos.world(FIXED_TIME));
  const fresh = stableJson(loadRuntime().mythos.world(FIXED_TIME));
  assert.equal(after, before, 'call order must not mutate fixed-time world output');
  assert.equal(fresh, before, 'fresh runtimes must produce byte-identical output');
  assert.notEqual(
    stableJson(firstRuntime.mythos.world(FIXED_TIME + firstRuntime.mythos.epochMs)),
    before,
    'the next epoch must advance the public slate'
  );
});

test('invalid references fail closed without manufacturing public identities', () => {
  const { mythos } = loadRuntime();
  assert.equal(mythos.resolveSport('missing-sport'), null);
  assert.equal(mythos.resolveTeam('soccer', 'missing-team'), null);
  assert.equal(mythos.resolveAthlete(null, 'missing-athlete'), null);
  assert.equal(mythos.matchStory('soccer', 'missing-home', 'missing-away', { now: FIXED_TIME }), null);

  const soccer = mythos.resolveSport('soccer');
  assert.equal(mythos.matchStory('soccer', soccer.teams[0].id, soccer.teams[0].id, { now: FIXED_TIME }), null);
});
