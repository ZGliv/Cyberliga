import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

globalThis.window = globalThis;
delete globalThis.CYBERLIGA_CONTENT;
delete globalThis.CyberligaCharacters;
delete globalThis.CyberligaNamedMoments;
delete globalThis.CyberligaWitnessChronicle;

await import('./witness-chronicle.js?chronicle-unbound');
const Unbound = globalThis.CyberligaWitnessChronicle;

await import('./worlddata.js?chronicle-tests');
await import('./characterdata.js?chronicle-tests');
await import('./named-moments.js?chronicle-tests');
await import('./witness-chronicle.js?chronicle-bound');

const Content = globalThis.CYBERLIGA_CONTENT;
const Characters = globalThis.CyberligaCharacters;
const Named = globalThis.CyberligaNamedMoments;
const Chronicle = globalThis.CyberligaWitnessChronicle;
const SPORT_IDS = ['soccer', 'american-football', 'basketball', 'hockey', 'baseball', 'combat'];
const RAW_KEYS = [
  'athleteId', 'awayTeamId', 'eventKey', 'fixtureId', 'homeTeamId', 'kept', 'kind',
  'momentId', 'schemaVersion', 'side', 'sportId', 'teamId', 'witnessedAt'
];

function json(value) {
  return JSON.parse(JSON.stringify(value));
}

function frozenTree(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.ok(Object.isFrozen(value), `expected frozen value: ${JSON.stringify(value).slice(0, 100)}`);
  Object.values(value).forEach((child) => frozenTree(child, seen));
}

function tuple(sportId) {
  const sport = Content.getSport(sportId);
  const home = sport.teams[0];
  const away = sport.teams[1];
  return { sport, home, away };
}

function fixture(sportId, suffix = 'fixture') {
  const pair = tuple(sportId);
  const fixtureId = `${sportId}-${suffix}`;
  const director = Named.create({
    sportId,
    fixtureId,
    homeTeam: pair.home,
    awayTeam: pair.away
  });
  assert.ok(director, sportId);
  return { ...pair, fixtureId, director };
}

function namedMoment(pair, options = {}) {
  const side = options.side || 'home';
  const team = side === 'home' ? pair.home : pair.away;
  const athlete = options.athlete || team.athletes[options.athleteIndex || 0];
  const kind = options.kind || Named.eventKinds[pair.sport.id][0];
  const eventKey = options.eventKey || `${pair.sport.id}-event-${options.sequence || 1}`;
  const moment = pair.director.record({
    eventKey,
    kind,
    side,
    team,
    athlete,
    sequence: options.sequence || 1,
    leverage: options.leverage == null ? 0.9 : options.leverage,
    recordedFootage: options.recordedFootage === true
  });
  assert.ok(moment, `${pair.sport.id}/${eventKey}`);
  return moment;
}

function captureOptions(pair, witnessedAt, mode = 'moment') {
  return {
    sportId: pair.sport.id,
    fixtureId: pair.fixtureId,
    homeTeam: pair.home,
    awayTeam: pair.away,
    mode,
    witnessedAt
  };
}

test('exports a frozen, dependency-bound and explicitly non-official API', () => {
  assert.equal(Unbound.ready, false);
  assert.equal(Unbound.create(), null);
  assert.equal(Chronicle.version, '1.0.0');
  assert.equal(Chronicle.schemaVersion, 1);
  assert.equal(Chronicle.ready, true);
  assert.deepEqual(Chronicle.limits, { total: 96, entries: 96, kept: 48 });
  assert.deepEqual(Chronicle.safety, {
    source: 'local-witness',
    official: false,
    authoritative: false,
    wagerable: false,
    settles: false,
    money: false,
    prizes: false
  });
  assert.equal(Chronicle.storageContract.scope, 'device-local');
  assert.equal(Chronicle.storageContract.revalidatedOnLoad, true);
  assert.deepEqual(
    Object.keys(Chronicle).filter((key) => /bet|odds|settle|payout|prize|money|officialize/i.test(key)),
    []
  );
  frozenTree(Chronicle);

  const empty = Chronicle.create();
  assert.ok(Object.isFrozen(empty));
  assert.deepEqual(empty.state(), {
    version: '1.0.0',
    schemaVersion: 1,
    count: 0,
    totalCount: 0,
    keptCount: 0,
    unreadCount: 0,
    lastReadAt: 0,
    entries: [],
    contract: Chronicle.safety,
    storageContract: Chronicle.storageContract
  });
});

test('captures one exact certified presented moment in every sport and derives display facts from canon', () => {
  const model = Chronicle.create();
  const receipts = SPORT_IDS.map((sportId, index) => {
    const pair = fixture(sportId, 'six-sport');
    const moment = namedMoment(pair, { recordedFootage: index % 2 === 0 });
    const result = model.capture(moment, captureOptions(pair, 1000 + index, index % 2 ? 'final' : 'moment'));
    assert.equal(result.changed, true);
    const receipt = result.receipt;
    assert.equal(receipt.sportId, sportId);
    assert.equal(receipt.momentId, moment.id);
    assert.equal(receipt.witnessId, receipt.id);
    assert.equal(receipt.team.id, pair.home.id);
    assert.equal(receipt.opponent.id, pair.away.id);
    assert.equal(receipt.athlete.id, pair.home.athletes[0].id);
    assert.equal(receipt.eventTitle, Named.eventTitles[sportId][moment.kind]);
    assert.equal(receipt.safety, Chronicle.safety);
    assert.equal(receipt.provenance.source, 'local-witness');
    assert.match(receipt.playerHref, /^player\.html\?/);
    assert.match(receipt.conceptHref, /eventSource=local-witness/);
    assert.equal(receipt.clipHref, receipt.conceptHref);
    assert.doesNotMatch(receipt.clipHref, /(?:score|clock|recordedFootage)=/i);
    frozenTree(receipt);
    return receipt;
  });
  assert.equal(model.state().count, 6);
  assert.equal(model.state().unreadCount, 6);
  assert.deepEqual(new Set(receipts.map((receipt) => receipt.sportId)), new Set(SPORT_IDS));
});

test('rejects forged, cloned, cross-fixture, cross-reference, hidden-mode, and malformed-time captures', () => {
  const pair = fixture('soccer', 'trust');
  const moment = namedMoment(pair);
  const model = Chronicle.create();
  const exact = captureOptions(pair, 1400);
  assert.equal(model.capture({ ...moment }, exact), null);
  assert.equal(model.capture(moment, { ...exact, fixtureId: 'soccer-other' }), null);
  assert.equal(model.capture(moment, { ...exact, sportId: 'hockey' }), null);
  assert.equal(model.capture(moment, { ...exact, homeTeam: { ...pair.home } }), null);
  assert.equal(model.capture(moment, { ...exact, awayTeam: pair.home }), null);
  assert.equal(model.capture(moment, { ...exact, mode: 'spotlight' }), null);
  assert.equal(model.capture(moment, { ...exact, mode: 'idle' }), null);
  assert.equal(model.capture(moment, { ...exact, witnessedAt: Number.NaN }), null);
  assert.equal(model.capture(moment, { ...exact, witnessedAt: 1.5 }), null);
  assert.equal(model.capture(moment, { ...exact, witnessedAt: -1 }), null);
  assert.equal(model.capture(null, exact), null);
  assert.equal(model.state().count, 0);
});

test('dedupes a painted moment once and orders equal evidence independently of capture order', () => {
  const pair = fixture('basketball', 'order');
  const first = namedMoment(pair, { eventKey: 'order-a', sequence: 1 });
  const second = namedMoment(pair, { eventKey: 'order-b', sequence: 2 });
  const left = Chronicle.create();
  const right = Chronicle.create();

  left.capture(first, captureOptions(pair, 5000));
  left.capture(second, captureOptions(pair, 5000, 'final'));
  right.capture(second, captureOptions(pair, 5000, 'final'));
  right.capture(first, captureOptions(pair, 5000));

  const duplicate = left.capture(first, captureOptions(pair, 9999));
  assert.equal(duplicate.changed, false);
  assert.equal(duplicate.receipt.witnessedAt, 5000);
  assert.deepEqual(left.serialize(), right.serialize());
  assert.deepEqual(
    left.state().entries.map((entry) => entry.momentId),
    [first.id, second.id].sort()
  );
  assert.equal(left.markRead(5000), true);
  assert.equal(left.state().unreadCount, 0);
  assert.equal(left.markRead(4000), false);
  assert.equal(left.markRead(Number.POSITIVE_INFINITY), false);
  assert.equal(left.state({ athleteId: '<invalid>' }).count, 0);
  assert.equal(left.state({ teamId: '' }).count, 0);
  assert.equal(left.state({ sportId: 'NOT A SPORT' }).count, 0);
});

test('restores only recomputable canonical facts and ignores persisted copy, score, and routes', () => {
  const pair = fixture('hockey', 'restore');
  const moment = namedMoment(pair, { kind: Named.eventKinds.hockey[1], eventKey: 'restore-event' });
  const model = Chronicle.create();
  model.capture(moment, captureOptions(pair, 7000));
  const persisted = json(model.serialize());
  const raw = persisted.entries[0];
  assert.deepEqual(Object.keys(raw).sort(), RAW_KEYS);
  Object.assign(raw, {
    headline: 'FORGED CHAMPIONSHIP RESULT',
    copy: '<script>FORGED</script>',
    url: 'https://attacker.invalid/',
    score: { home: 999, away: 0 },
    clock: 'FINAL',
    odds: '-5000',
    officialStatus: true,
    recordedFootage: true
  });
  const restored = Chronicle.create(persisted);
  assert.equal(restored.state().count, 1);
  const receipt = restored.state().entries[0];
  assert.equal(receipt.title, moment.title);
  assert.equal(receipt.headline, `${pair.home.athletes[0].name} · ${moment.title}`);
  assert.equal(receipt.team.name, pair.home.name);
  assert.equal(receipt.safety.official, false);
  assert.doesNotMatch(JSON.stringify(receipt), /FORGED|attacker|999|-5000/);
  assert.deepEqual(Object.keys(restored.serialize().entries[0]).sort(), RAW_KEYS);

  const mutations = [
    ['schemaVersion', 2],
    ['momentId', 'moment-0000000'],
    ['fixtureId', 'wrong-fixture'],
    ['eventKey', '<bad>'],
    ['sportId', 'baseball'],
    ['homeTeamId', pair.away.id],
    ['awayTeamId', pair.home.id],
    ['side', 'bench'],
    ['teamId', pair.away.id],
    ['athleteId', pair.away.athletes[0].id],
    ['kind', 'knockout'],
    ['witnessedAt', '7000'],
    ['kept', 'yes']
  ];
  mutations.forEach(([key, value]) => {
    const tampered = json(model.serialize());
    tampered.entries[0][key] = value;
    assert.equal(Chronicle.create(tampered).state().count, 0, key);
  });
  assert.equal(Chronicle.create({ schemaVersion: 99, lastReadAt: 9000, entries: persisted.entries }).state().count, 0);
});

test('keeps all reconstructed receipts locally non-authoritative with no wager or result surface', () => {
  const pair = fixture('american-football', 'safety');
  const moment = namedMoment(pair, { kind: 'touchdown', recordedFootage: true });
  const model = Chronicle.create();
  model.capture(moment, captureOptions(pair, 8200));
  const serializedText = JSON.stringify(model.serialize());
  const receiptText = JSON.stringify(model.state().entries[0]);
  assert.doesNotMatch(serializedText, /score|clock|headline|url|odds|result|recordedFootage|officialStatus/i);
  assert.doesNotMatch(receiptText, /"score"|"clock"|"odds"|"result"|recordedFootage/i);
  assert.deepEqual(model.state().entries[0].boundary, Chronicle.safety);
  assert.equal(model.state().contract.settles, false);
  assert.equal(model.state().contract.money, false);
  assert.equal(model.state().contract.prizes, false);
});

test('builds a deterministic athlete chapter only from witnessed kinds and opponents', () => {
  const pair = fixture('baseball', 'chapter');
  const athlete = pair.home.athletes[2];
  const moments = [
    namedMoment(pair, { athlete, kind: 'home_run', eventKey: 'chapter-home-run', sequence: 1 }),
    namedMoment(pair, { athlete, kind: 'strikeout', eventKey: 'chapter-strikeout', sequence: 2 }),
    namedMoment(pair, { athlete, kind: 'home_run', eventKey: 'chapter-home-run-two', sequence: 3 })
  ];
  const model = Chronicle.create();
  model.capture(moments[2], captureOptions(pair, 10300, 'final'));
  model.capture(moments[0], captureOptions(pair, 10100));
  model.capture(moments[1], captureOptions(pair, 10200));
  const chapter = model.chapter(athlete.id);
  assert.equal(chapter.count, 3);
  assert.equal(chapter.firstWitnessedAt, 10100);
  assert.equal(chapter.lastWitnessedAt, 10300);
  assert.deepEqual(chapter.kinds, [
    { kind: 'home_run', title: 'HOME RUN', count: 2 },
    { kind: 'strikeout', title: 'STRIKEOUT', count: 1 }
  ]);
  assert.equal(chapter.opponents.length, 1);
  assert.equal(chapter.opponents[0].team.id, pair.away.id);
  assert.equal(chapter.opponents[0].count, 3);
  assert.match(chapter.title, /LOCAL WITNESS CHAPTER$/);
  assert.match(chapter.summary, /^This device witnessed 3 presented moments/);
  assert.deepEqual(chapter, Chronicle.create(json(model.serialize())).chapter(athlete.id));
  assert.equal(model.chapter('not-an-athlete'), null);
  const empty = Chronicle.create().chapter(athlete.id);
  assert.equal(empty.count, 0);
  assert.match(empty.summary, /^No presented moments/);
  frozenTree(chapter);
});

test('bounds the Chronicle at 96, preserves 48 kept receipts, and refuses a 49th keep', () => {
  const pair = fixture('combat', 'bounds');
  const model = Chronicle.create();
  const keptIds = [];
  let newestId = null;
  for (let index = 0; index < 108; index += 1) {
    const moment = namedMoment(pair, {
      eventKey: `bounds-${String(index).padStart(3, '0')}`,
      sequence: index + 1,
      kind: Named.eventKinds.combat[index % Named.eventKinds.combat.length]
    });
    const captured = model.capture(moment, captureOptions(pair, 20000 + index, index % 3 ? 'moment' : 'final'));
    newestId = captured.receipt.id;
    if (index < 48) {
      assert.equal(model.keep(captured.receipt.id, true), true);
      keptIds.push(captured.receipt.id);
    }
  }
  const state = model.state();
  assert.equal(state.count, 96);
  assert.equal(state.totalCount, 96);
  assert.equal(state.keptCount, 48);
  keptIds.forEach((id) => assert.ok(state.entries.some((entry) => entry.id === id && entry.kept), id));
  assert.equal(model.keep(newestId, true), false);
  assert.equal(model.keep(keptIds[0], false), true);
  assert.equal(model.keep(newestId, true), true);
  assert.equal(model.state().keptCount, 48);
  assert.equal(model.remove(keptIds[1]), true);
  assert.equal(model.remove(keptIds[1]), false);
  assert.equal(model.state().count, 95);
});

test('the pure core contains no browser, persistence, clock, random, or transport APIs', async () => {
  const source = await readFile(new URL('./witness-chronicle.js', import.meta.url), 'utf8');
  [
    /\bdocument\b/,
    /\bwindow\b/,
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /\bindexedDB\b/,
    /\bfetch\b/,
    /\bXMLHttpRequest\b/,
    /\bWebSocket\b/,
    /\bDate\b/,
    /Math\.random\s*\(/
  ].forEach((pattern) => assert.doesNotMatch(source, pattern));
});
