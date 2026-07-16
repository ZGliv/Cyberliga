import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

globalThis.window = globalThis;
delete globalThis.CYBERLIGA_CONTENT;
delete globalThis.CyberligaCharacters;
await import('./worlddata.js?basketball-brain-tests');
await import('./characterdata.js?basketball-brain-tests');

const Content = globalThis.CYBERLIGA_CONTENT;
const Characters = globalThis.CyberligaCharacters;
const {
  BASKETBALL_BRAIN_VERSION,
  createBasketballBrain
} = await import('./basketballbrain.js?basketball-brain-tests');

const CALL_IDS = Object.freeze([
  'EARLY_DRAG', 'HIGH_PNR', 'HORNS', 'FLOPPY', 'SPAIN',
  'GHOST', 'POST_SPLIT', 'CHICAGO', 'FIVE_OUT'
]);
const COVERAGE_IDS = Object.freeze(['MAN', 'SWITCH', 'DROP', 'ZONE', 'PRESS']);
const COURT_ROLES = Object.freeze(['POINT', 'WING', 'SHOOTER', 'FORWARD', 'CENTER']);
const LINEUP_SOURCE_INDEXES = Object.freeze([1, 2, 3, 4, 0]);

const basketballTeams = Content.getTeams('basketball');
const teamById = id => basketballTeams.find(team => team.id === id);
const newYork = teamById('new-york-brownstones');
const toronto = teamById('toronto-lake-effect');
const stoopy = Content.getAthlete(newYork.id, 'new-york-brownstones-a1');
const toque = Content.getAthlete(toronto.id, 'toronto-lake-effect-a4');
const stoopyCharacter = Characters.get(stoopy.id);
const toqueCharacter = Characters.get(toque.id);

const brain = createBasketballBrain({ content: Content, characters: Characters });

function lineupFor(team) {
  return Object.freeze(LINEUP_SOURCE_INDEXES.map(index => team.athletes[index]));
}

function courtRoleFor(athlete) {
  const index = LINEUP_SOURCE_INDEXES.indexOf(athlete.teamPlayerIndex);
  if (index >= 0) return COURT_ROLES[index];
  const roleMap = {
    Point: 'POINT', Wing: 'WING', Shooter: 'SHOOTER', Cutter: 'FORWARD',
    'Rim Keeper': 'CENTER'
  };
  return roleMap[athlete.role] || null;
}

function fixedRng(value = .375) {
  return () => value;
}

function situation(overrides = {}) {
  return Object.freeze({
    possessionId: 'brain-contract:home:1',
    quarter: 2,
    gameClock: 43.2,
    shotClock: 18.4,
    offenseScore: 18,
    defenseScore: 17,
    possessionReason: 'INBOUND',
    transition: false,
    offenseTeamFouls: 1,
    defenseTeamFouls: 2,
    ...overrides
  });
}

function memoryFor(team = newYork, opponent = toronto, fixtureId = 'brain-contract') {
  return brain.createMemory({ fixtureId, team, opponent });
}

function assertDeepFrozen(value, path = 'output', seen = new WeakSet()) {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return;
  if (seen.has(value)) return;
  seen.add(value);
  assert.ok(Object.isFrozen(value), `${path} must be frozen`);
  for (const key of Reflect.ownKeys(value)) {
    assertDeepFrozen(value[key], `${path}.${String(key)}`, seen);
  }
}

function assertFiniteNumbers(value, path = 'output', seen = new WeakSet()) {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path} must be finite; received ${value}`);
    return;
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    assertFiniteNumbers(value[key], `${path}.${String(key)}`, seen);
  }
}

function assertUnitInterval(value, label) {
  assert.ok(Number.isFinite(value), `${label} must be finite`);
  assert.ok(value >= 0 && value <= 1, `${label} must be in [0, 1]; received ${value}`);
}

function assertScores(scores, expectedIds, label) {
  assert.ok(Array.isArray(scores), `${label}.scores must be an array`);
  assert.deepEqual(new Set(scores.map(entry => entry.id)), new Set(expectedIds));
  for (const entry of scores) assertUnitInterval(entry.score, `${label}.${entry.id}`);
}

function assertRanking(ranking, expectedIds, label) {
  assert.ok(Array.isArray(ranking), `${label} must be an array`);
  assert.deepEqual(new Set(ranking), new Set(expectedIds));
  assert.equal(ranking.length, expectedIds.length, `${label} may not repeat an id`);
}

function planInput(team = newYork, opponent = toronto, overrides = {}) {
  return {
    team,
    opponent,
    lineup: lineupFor(team),
    situation: situation(),
    memory: memoryFor(team, opponent),
    rng: fixedRng(),
    ...overrides
  };
}

function readInput(overrides = {}) {
  const teammates = lineupFor(newYork);
  const defenders = lineupFor(toronto);
  return {
    team: newYork,
    opponent: toronto,
    handler: teammates[0],
    teammates,
    defenders,
    situation: situation({ shotClock: 11.5 }),
    offensePlan: brain.chooseOffense(planInput()),
    observedCoverage: 'MAN',
    context: Object.freeze({ kind: 'drive', rimDistance: 3.1, helpCommitted: true }),
    legalOptions: Object.freeze([]),
    rng: fixedRng(),
    ...overrides
  };
}

function terminalOutcome(possessionId, terminal, overrides = {}) {
  return Object.freeze({
    possessionId,
    offenseTeam: newYork,
    defenseTeam: toronto,
    callId: 'HIGH_PNR',
    coverageId: 'DROP',
    terminal,
    points: terminal === 'made' ? 2 : 0,
    shotQuality: terminal === 'made' || terminal === 'defensive_rebound' ? .53 : 0,
    actor: terminal === 'defensive_rebound' || terminal === 'turnover'
      ? lineupFor(toronto)[0]
      : lineupFor(newYork)[0],
    ...overrides
  });
}

test('exports one frozen canonical basketball brain with an explicit pure API', () => {
  assert.match(BASKETBALL_BRAIN_VERSION, /^\d+\.\d+\.\d+$/);
  assert.ok(brain);
  assert.equal(brain.version, BASKETBALL_BRAIN_VERSION);
  assert.equal(brain.ready, true);
  assert.equal(brain.sportId, 'basketball');
  assert.ok(Object.isFrozen(brain));
  assert.ok(Object.isFrozen(brain.teamIds));
  assert.deepEqual(new Set(brain.teamIds), new Set(basketballTeams.map(team => team.id)));
  for (const method of [
    'deriveTeamDNA', 'derivePlayerProfile', 'createMemory', 'chooseOffense',
    'chooseDefense', 'chooseLiveRead', 'evaluateSignature', 'evaluateShot', 'recordOutcome'
  ]) assert.equal(typeof brain[method], 'function', `missing brain.${method}()`);
});

test('accepts only exact bound basketball team and athlete references', () => {
  const newYorkLineup = lineupFor(newYork);
  const wrongTeam = basketballTeams.find(team => team.id !== newYork.id);
  const soccerTeam = Content.getTeams('soccer')[0];

  assert.ok(brain.deriveTeamDNA(newYork));
  assert.equal(brain.deriveTeamDNA({ ...newYork }), null);
  assert.equal(brain.deriveTeamDNA(soccerTeam), null);
  assert.equal(brain.deriveTeamDNA(null), null);

  assert.ok(brain.derivePlayerProfile({
    team: newYork,
    athlete: newYorkLineup[0],
    courtRole: 'POINT'
  }));
  assert.equal(brain.derivePlayerProfile({
    team: { ...newYork }, athlete: newYorkLineup[0], courtRole: 'POINT'
  }), null);
  assert.equal(brain.derivePlayerProfile({
    team: newYork, athlete: { ...newYorkLineup[0] }, courtRole: 'POINT'
  }), null);
  assert.equal(brain.derivePlayerProfile({
    team: newYork, athlete: wrongTeam.athletes[1], courtRole: 'POINT'
  }), null);
  assert.equal(brain.derivePlayerProfile({
    team: newYork, athlete: newYorkLineup[0], courtRole: 'CENTER'
  }), null);

  assert.ok(memoryFor());
  assert.equal(brain.createMemory({
    fixtureId: 'forged', team: { ...newYork }, opponent: toronto
  }), null);
  assert.equal(brain.createMemory({
    fixtureId: 'forged', team: newYork, opponent: { ...toronto }
  }), null);
});

test('all eight clubs have deterministic and distinct strategic rankings', () => {
  const dnas = basketballTeams.map(team => brain.deriveTeamDNA(team));
  assert.equal(dnas.length, 8);
  for (let index = 0; index < dnas.length; index += 1) {
    const dna = dnas[index];
    assert.ok(dna, basketballTeams[index].id);
    assert.equal(dna.teamId, basketballTeams[index].id);
    assertRanking(dna.offenseRanking, CALL_IDS, `${dna.teamId}.offenseRanking`);
    assertRanking(dna.defenseRanking, COVERAGE_IDS, `${dna.teamId}.defenseRanking`);
    assert.deepEqual(dna, brain.deriveTeamDNA(basketballTeams[index]));
    assertDeepFrozen(dna, dna.teamId);
    assertFiniteNumbers(dna, dna.teamId);
    for (const [key, value] of Object.entries(dna.tendencies)) {
      assertUnitInterval(value, `${dna.teamId}.tendencies.${key}`);
    }
  }
  assert.equal(new Set(dnas.map(dna => dna.offenseRanking.join('|'))).size, 8,
    'each club needs a distinct offensive call ranking');
  assert.equal(new Set(dnas.map(dna => dna.defenseRanking.join('|'))).size, 8,
    'each club needs a distinct defensive coverage ranking');
});

test('canonical athlete profiles are bounded while Sixth Spark remains bench-only', () => {
  for (const team of basketballTeams) {
    const lineup = lineupFor(team);
    lineup.forEach((athlete, index) => {
      const profile = brain.derivePlayerProfile({ team, athlete, courtRole: COURT_ROLES[index] });
      assert.ok(profile, `${team.id}/${athlete.id}`);
      assert.equal(profile.athleteId, athlete.id);
      assert.equal(profile.teamId, team.id);
      assert.equal(profile.courtRole, COURT_ROLES[index]);
      assertDeepFrozen(profile, athlete.id);
      assertFiniteNumbers(profile, athlete.id);
      for (const [key, value] of Object.entries(profile.tendencies)) {
        assert.ok(value >= -.12 && value <= .12,
          `${athlete.id}.tendencies.${key} must remain a bounded preference, not a hidden rating`);
      }
    });

    const sixthSpark = team.athletes.find(athlete => athlete.role === 'Sixth Spark');
    assert.ok(sixthSpark, `${team.id} needs one canonical Sixth Spark`);
    assert.equal(brain.derivePlayerProfile({
      team, athlete: sixthSpark, courtRole: 'SIXTH_SPARK'
    }), null, 'bench identities must not be smuggled into a five-player decision');

    const illegalLineup = Object.freeze([...lineup.slice(0, 4), sixthSpark]);
    const opponent = basketballTeams.find(candidate => candidate.id !== team.id);
    assert.equal(brain.chooseOffense(planInput(team, opponent, { lineup: illegalLineup })), null);
  }
});

test('Stoopy and Toque receive their exact paired gift and flaw without accuracy inflation', () => {
  const stoopyProfile = brain.derivePlayerProfile({
    team: newYork, athlete: stoopy, courtRole: 'CENTER'
  });
  const toqueProfile = brain.derivePlayerProfile({
    team: toronto, athlete: toque, courtRole: 'SHOOTER'
  });

  for (const [profile, record] of [
    [stoopyProfile, stoopyCharacter],
    [toqueProfile, toqueCharacter]
  ]) {
    assert.ok(profile.character, `${record.id} must expose its certified character pair`);
    assert.equal(profile.character.characterId, record.id);
    assert.equal(profile.character.gift, record.gift);
    assert.equal(profile.character.flaw, record.flaw);
    assert.equal(profile.character.accuracyDelta, 0,
      'Founding characterization may change choices, timing, screening, or recovery—not shot accuracy');
    assertDeepFrozen(profile.character, `${record.id}.character`);
  }

  const stoopScreen = brain.evaluateSignature({
    profile: stoopyProfile, action: 'screen',
    context: Object.freeze({ schemeId: 'HIGH_PNR', physicalContact: true })
  });
  assert.equal(stoopScreen.giftActive, true);
  assert.equal(stoopScreen.screenDurationMultiplier, 1.35);
  assert.equal(stoopScreen.accuracyDelta, 0);
  const stoopBoxout = brain.evaluateSignature({
    profile: stoopyProfile, action: 'boxout',
    context: Object.freeze({ physicalContact: true, defensive: true, rimSideLeverage: true })
  });
  assert.equal(stoopBoxout.giftActive, true);
  assert.ok(stoopBoxout.boxoutMultiplier > 1);
  assert.deepEqual(stoopBoxout.evidence, ['PHYSICAL_BOXOUT_CONTACT', 'SQUARED_BASE_LEVERAGE', 'MOVING_ARCHITECTURE']);
  assert.equal(brain.evaluateSignature({
    profile: stoopyProfile, action: 'boxout',
    context: Object.freeze({ physicalContact: false, defensive: true, rimSideLeverage: true })
  }).giftActive, false, 'the boxout gift requires physical leverage rather than a flat identity buff');
  const stoopCounter = brain.evaluateSignature({
    profile: stoopyProfile, action: 'rebound',
    context: Object.freeze({ secondEffort: true, secondsSinceLanding: .18 })
  });
  assert.equal(stoopCounter.counterId, 'SECOND_JUMP_LATE');
  assert.equal(stoopCounter.counterSucceeded, true);
  assert.ok(stoopCounter.reboundMultiplier < 1);

  const whiteout = brain.evaluateSignature({
    profile: toqueProfile, action: 'catch_release',
    context: Object.freeze({ schemeId: 'FLOPPY', screenContact: true, screenTraffic: 0, catchAge: .24 })
  });
  assert.equal(whiteout.giftActive, true);
  assert.ok(whiteout.windupMultiplier < 1);
  assert.equal(whiteout.accuracyDelta, 0);
  const whiteoutCounter = brain.evaluateSignature({
    profile: toqueProfile, action: 'catch_release',
    context: Object.freeze({ schemeId: 'FLOPPY', screenContact: true, screenTraffic: 2, catchAge: .24 })
  });
  assert.equal(whiteoutCounter.counterId, 'SCREEN_TRAFFIC_LOST');
  assert.equal(whiteoutCounter.counterSucceeded, true);
  assert.ok(whiteoutCounter.windupMultiplier > 1);
  assert.equal(whiteoutCounter.accuracyDelta, 0);

  assert.equal(brain.derivePlayerProfile({
    team: newYork, athlete: stoopy, courtRole: 'CENTER', foundingCharacter: { ...stoopyCharacter }
  }), null, 'a cloned Founder record must not certify a gameplay mechanic');

  const generic = basketballTeams
    .flatMap(team => lineupFor(team).map(athlete => ({ team, athlete })))
    .find(({ athlete }) => !Characters.get(athlete.id));
  const genericProfile = brain.derivePlayerProfile({
    team: generic.team,
    athlete: generic.athlete,
    courtRole: courtRoleFor(generic.athlete)
  });
  assert.equal(genericProfile.character, null);
  assert.equal(brain.evaluateSignature({
    profile: genericProfile, action: 'screen', context: Object.freeze({ schemeId: 'HIGH_PNR', physicalContact: true })
  }).giftActive, false);
  assert.equal(brain.evaluateSignature({
    profile: genericProfile, action: 'boxout', context: Object.freeze({ physicalContact: true, defensive: true, rimSideLeverage: true })
  }).giftActive, false);
});

test('offense and defense choose independently and deterministically', () => {
  const offenseBase = planInput();
  const offense = brain.chooseOffense(offenseBase);
  const offenseAgain = brain.chooseOffense({ ...offenseBase, rng: fixedRng() });
  assert.deepEqual(offense, offenseAgain);
  assert.ok(CALL_IDS.includes(offense.callId));
  assertScores(offense.scores, CALL_IDS, 'offense');
  assertUnitInterval(offense.confidence, 'offense.confidence');
  assert.ok(Array.isArray(offense.reasons) && offense.reasons.length > 0);
  assertDeepFrozen(offense, 'offense');

  const defenseBase = planInput(toronto, newYork, {
    memory: memoryFor(toronto, newYork),
    situation: situation()
  });
  const defense = brain.chooseDefense(defenseBase);
  const defenseAgain = brain.chooseDefense({ ...defenseBase, rng: fixedRng() });
  assert.deepEqual(defense, defenseAgain);
  assert.ok(COVERAGE_IDS.includes(defense.coverageId));
  assertScores(defense.scores, COVERAGE_IDS, 'defense');
  assertUnitInterval(defense.confidence, 'defense.confidence');
  assert.ok(Array.isArray(defense.reasons) && defense.reasons.length > 0);
  assertDeepFrozen(defense, 'defense');

  for (const currentCoverageId of ['DROP', 'PRESS']) {
    assert.deepEqual(
      brain.chooseOffense({ ...offenseBase, currentCoverageId, rng: fixedRng() }),
      offense,
      'the offense cannot inspect the defense call selected for this possession'
    );
  }
  for (const currentOffenseCallId of ['HIGH_PNR', 'FLOPPY']) {
    assert.deepEqual(
      brain.chooseDefense({ ...defenseBase, currentOffenseCallId, rng: fixedRng() }),
      defense,
      'the defense cannot inspect the offense call selected for this possession'
    );
  }
});

test('adaptation begins only after certified completed observations', () => {
  const baseMemory = memoryFor();
  const basePlan = brain.chooseOffense(planInput(newYork, toronto, { memory: baseMemory, rng: fixedRng(.01) }));
  const unclosed = terminalOutcome('adapt:open', 'offensive_rebound', { coverageId: 'DROP' });
  assert.strictEqual(brain.recordOutcome(baseMemory, unclosed), baseMemory);
  assert.deepEqual(
    brain.chooseOffense(planInput(newYork, toronto, { memory: baseMemory, rng: fixedRng(.01) })),
    basePlan,
    'an open putback chain cannot alter the next coordinator decision'
  );

  let observed = baseMemory;
  for (let index = 0; index < 3; index += 1) {
    observed = brain.recordOutcome(observed, terminalOutcome(`adapt:drop:${index}`, 'defensive_rebound', {
      callId: 'HIGH_PNR', coverageId: 'DROP', shotQuality: .38
    }));
  }
  const adapted = brain.chooseOffense(planInput(newYork, toronto, { memory: observed, rng: fixedRng(.01) }));
  const baseFiveOut = basePlan.rankings.find(entry => entry.id === 'FIVE_OUT');
  const adaptedFiveOut = adapted.rankings.find(entry => entry.id === 'FIVE_OUT');
  assert.ok(adaptedFiveOut.score > baseFiveOut.score);
  assert.ok(adaptedFiveOut.reasons.includes('PUNISH_OBSERVED_DROP'));
});

test('terminal memory is immutable, exact-reference gated, and idempotent by possession', () => {
  const initial = memoryFor();
  assert.equal(initial.possessions, 0);
  assertDeepFrozen(initial, 'initialMemory');

  const terminals = [
    terminalOutcome('brain-contract:home:1', 'made', { points: 2, shotQuality: .61 }),
    terminalOutcome('brain-contract:home:2', 'turnover'),
    terminalOutcome('brain-contract:home:3', 'defensive_rebound', { shotQuality: .47 }),
    terminalOutcome('brain-contract:home:4', 'free_throw_trip', { points: 1, shotQuality: 0 }),
    terminalOutcome('brain-contract:home:5', 'period_end', { actor: null, periodFinal: false }),
    terminalOutcome('brain-contract:home:6', 'period_end', { actor: null, periodFinal: true })
  ];

  let current = initial;
  for (const outcome of terminals) {
    const before = current;
    const next = brain.recordOutcome(before, outcome);
    assert.notStrictEqual(next, before, `${outcome.terminal} must commit once`);
    assert.equal(next.possessions, before.possessions + 1);
    assert.ok(next.seenPossessionIds.includes(outcome.possessionId));
    assert.equal(next.recent.at(-1).possessionId, outcome.possessionId);
    assert.equal(next.recent.at(-1).terminal, outcome.terminal);
    assertDeepFrozen(next, `memory.${outcome.possessionId}`);
    assertFiniteNumbers(next, `memory.${outcome.possessionId}`);

    assert.strictEqual(brain.recordOutcome(next, outcome), next,
      'repeating the same terminal must return the exact existing memory snapshot');
    assert.strictEqual(brain.recordOutcome(next, {
      ...outcome, terminal: outcome.terminal === 'made' ? 'turnover' : 'made', points: 99
    }), next, 'a possession id cannot be recertified with a conflicting result');
    current = next;
  }

  assert.equal(current.possessions, terminals.length);

  const offensiveRebound = terminalOutcome('brain-contract:home:7', 'offensive_rebound');
  assert.strictEqual(brain.recordOutcome(current, offensiveRebound), current,
    'an offensive rebound/putback opportunity keeps the original possession open');
  assert.strictEqual(brain.recordOutcome(current,
    terminalOutcome('brain-contract:home:8', 'void')), current,
  'a technical reset must not teach the brain a fake stop');

  const forgedTeamOutcome = terminalOutcome('brain-contract:home:9', 'made', {
    offenseTeam: { ...newYork }
  });
  assert.strictEqual(brain.recordOutcome(current, forgedTeamOutcome), current);
  const forgedActorOutcome = terminalOutcome('brain-contract:home:10', 'made', {
    actor: { ...lineupFor(newYork)[0] }
  });
  assert.strictEqual(brain.recordOutcome(current, forgedActorOutcome), current);
  assert.strictEqual(brain.recordOutcome(current, terminalOutcome('brain-contract:home:11', 'made', {
    offenseTeam: null, defenseTeam: null, offenseTeamId: newYork.id, defenseTeamId: toronto.id
  })), current, 'bare IDs cannot replace exact canonical team references');
  assert.strictEqual(brain.recordOutcome(current, terminalOutcome('brain-contract:home:12', 'made', {
    actor: null, actorId: 'forged-athlete'
  })), current, 'an unbound actorId cannot enter certified memory');
  assert.strictEqual(brain.recordOutcome(current, terminalOutcome('brain-contract:home:13', 'made', {
    points: 999
  })), current, 'impossible single-possession scoring cannot poison adaptation');

  const fivePointMemory = memoryFor(newYork, toronto, 'five-point-contract');
  const fivePointOutcome = terminalOutcome('five-point-contract:home:1', 'made', { points: 5 });
  assert.equal(brain.recordOutcome(fivePointMemory, fivePointOutcome).recent.at(-1).points, 5,
    'two made free throws, a missed final attempt, and a three-point putback remain a legal chain');
  assert.strictEqual(brain.recordOutcome(fivePointMemory,
    terminalOutcome('five-point-contract:home:2', 'made', { points: 6 })), fivePointMemory,
  'the simulation cannot certify more than five points on one possession');

  const putbackMemory = memoryFor(newYork, toronto, 'putback-contract');
  const putbackId = 'putback-contract:home:1';
  assert.strictEqual(brain.recordOutcome(putbackMemory,
    terminalOutcome(putbackId, 'offensive_rebound')), putbackMemory);
  const putbackMake = terminalOutcome(putbackId, 'made', { points: 2, shotQuality: .72 });
  const putbackCommitted = brain.recordOutcome(putbackMemory, putbackMake);
  assert.equal(putbackCommitted.possessions, 1,
    'the eventual putback closes the still-open possession exactly once');
  assert.strictEqual(brain.recordOutcome(putbackCommitted, putbackMake), putbackCommitted);

  const freeThrowMemory = memoryFor(newYork, toronto, 'free-throw-contract');
  const freeThrowId = 'free-throw-contract:home:1';
  assert.strictEqual(brain.recordOutcome(freeThrowMemory,
    terminalOutcome(freeThrowId, 'free_throw_attempt', { points: 1 })), freeThrowMemory,
  'individual attempts cannot close a free-throw trip');
  const completedTrip = terminalOutcome(freeThrowId, 'free_throw_trip', { points: 2 });
  const tripCommitted = brain.recordOutcome(freeThrowMemory, completedTrip);
  assert.equal(tripCommitted.possessions, 1);
  assert.strictEqual(brain.recordOutcome(tripCommitted, completedTrip), tripCommitted,
    'the MADE/inbound path cannot record the completed trip a second time');
});

test('live reads resolve the open roller, help-side kick, and empty-rim finish', () => {
  const teammates = lineupFor(newYork);
  const roller = teammates[4];
  const shooter = teammates[2];

  const rollOptions = Object.freeze([
    Object.freeze({ id: 'finish', type: 'finish', target: null, openness: .18, laneRisk: 0, expectedQuality: .36 }),
    Object.freeze({ id: 'roller', type: 'roll', target: roller, openness: .97, laneRisk: .02, expectedQuality: .84 }),
    Object.freeze({ id: 'shooter', type: 'kick', target: shooter, openness: .66, laneRisk: .14, expectedQuality: .61 })
  ]);
  const roll = brain.chooseLiveRead(readInput({
    observedCoverage: 'DROP',
    context: Object.freeze({ kind: 'drive', rimDistance: 3.2, helpCommitted: true }),
    legalOptions: rollOptions
  }));
  assert.equal(roll.choiceId, 'roller');
  assert.equal(roll.type, 'roll');
  assert.equal(roll.targetAthleteId, roller.id);

  const kickOptions = Object.freeze([
    Object.freeze({ id: 'finish', type: 'finish', target: null, openness: .22, laneRisk: 0, expectedQuality: .40 }),
    Object.freeze({ id: 'roller', type: 'roll', target: roller, openness: .31, laneRisk: .20, expectedQuality: .43 }),
    Object.freeze({ id: 'shooter', type: 'kick', target: shooter, openness: .99, laneRisk: .01, expectedQuality: .83 })
  ]);
  const kick = brain.chooseLiveRead(readInput({
    observedCoverage: 'MAN',
    context: Object.freeze({ kind: 'drive', rimDistance: 2.8, helpCommitted: true }),
    legalOptions: kickOptions
  }));
  assert.equal(kick.choiceId, 'shooter');
  assert.equal(kick.type, 'kick');
  assert.equal(kick.targetAthleteId, shooter.id);

  const finishOptions = Object.freeze([
    Object.freeze({ id: 'finish', type: 'finish', target: null, openness: 1, laneRisk: 0, expectedQuality: .88 }),
    Object.freeze({ id: 'roller', type: 'roll', target: roller, openness: .30, laneRisk: .12, expectedQuality: .45 }),
    Object.freeze({ id: 'shooter', type: 'kick', target: shooter, openness: .44, laneRisk: .15, expectedQuality: .49 })
  ]);
  const finish = brain.chooseLiveRead(readInput({
    observedCoverage: 'MAN',
    context: Object.freeze({ kind: 'drive', rimDistance: .8, helpCommitted: false }),
    legalOptions: finishOptions
  }));
  assert.equal(finish.choiceId, 'finish');
  assert.equal(finish.type, 'finish');
  assert.equal(finish.targetAthleteId, null);

  for (const [label, output, ids] of [
    ['roll', roll, rollOptions.map(option => option.id)],
    ['kick', kick, kickOptions.map(option => option.id)],
    ['finish', finish, finishOptions.map(option => option.id)]
  ]) {
    assertScores(output.scores, ids, label);
    assertUnitInterval(output.confidence, `${label}.confidence`);
    assert.ok(Array.isArray(output.reasons) && output.reasons.length > 0);
    assertDeepFrozen(output, label);
    assertFiniteNumbers(output, label);
  }

  const torontoPointProfile = brain.derivePlayerProfile({
    team: toronto, athlete: lineupFor(toronto)[0], courtRole: 'POINT'
  });
  assert.equal(brain.chooseLiveRead(readInput({
    handler: torontoPointProfile,
    legalOptions: finishOptions
  })), null, 'a trusted profile cannot be reused as another team\'s handler');
  assert.equal(brain.chooseLiveRead(readInput({
    legalOptions: Object.freeze([
      Object.freeze({ id: 'forged-target', type: 'kick', target: null, targetAthleteId: toque.id, openness: 1, expectedQuality: 1 })
    ])
  })), null, 'target IDs without exact same-team athlete references are not legal options');
});

test('audience, merch, fan-call, odds, and wager fields cannot influence sport', () => {
  const influenceFields = Object.freeze({
    audience: Object.freeze({ followers: 9e9, homeNoise: 1, demandedWinner: toronto.id }),
    merch: Object.freeze({ sales: 9e9, featuredAthleteId: toque.id }),
    wager: Object.freeze({ handle: 9e9, favorite: toronto.id, desiredMargin: 20 }),
    bets: Object.freeze([{ teamId: toronto.id, stake: 9e9 }]),
    odds: Object.freeze({ home: 99, away: .01 }),
    fanCalls: Object.freeze([{ side: 'away', pick: toronto.id }])
  });

  const offenseBase = planInput();
  assert.deepEqual(
    brain.chooseOffense({ ...offenseBase, rng: fixedRng() }),
    brain.chooseOffense({ ...offenseBase, ...influenceFields, rng: fixedRng() })
  );

  const defenseBase = planInput(toronto, newYork, { memory: memoryFor(toronto, newYork) });
  assert.deepEqual(
    brain.chooseDefense({ ...defenseBase, rng: fixedRng() }),
    brain.chooseDefense({ ...defenseBase, ...influenceFields, rng: fixedRng() })
  );

  const options = Object.freeze([
    Object.freeze({ id: 'finish', type: 'finish', target: null, openness: .8, laneRisk: 0, expectedQuality: .75 }),
    Object.freeze({ id: 'kick', type: 'kick', target: lineupFor(newYork)[2], openness: .7, laneRisk: .1, expectedQuality: .67 })
  ]);
  const liveBase = readInput({ legalOptions: options });
  assert.deepEqual(
    brain.chooseLiveRead({ ...liveBase, rng: fixedRng() }),
    brain.chooseLiveRead({ ...liveBase, ...influenceFields, rng: fixedRng() })
  );

  const shotBase = {
    team: toronto,
    opponent: newYork,
    shooter: toque,
    defender: lineupFor(newYork)[1],
    situation: situation({ shotClock: 6.2 }),
    shot: Object.freeze({ type: 'jumper', distance: 7.15, openness: .68, contest: .28, advantage: .12, energy: .74 })
  };
  assert.deepEqual(
    brain.evaluateShot(shotBase),
    brain.evaluateShot({ ...shotBase, ...influenceFields })
  );

  const memory = memoryFor();
  const outcome = terminalOutcome('brain-contract:influence', 'made');
  assert.deepEqual(
    brain.recordOutcome(memory, outcome),
    brain.recordOutcome(memory, { ...outcome, ...influenceFields })
  );
});

test('shot evaluation and all decision scores stay finite and bounded', () => {
  const shots = [
    {
      team: newYork, opponent: toronto, shooter: stoopy, defender: lineupFor(toronto)[4],
      situation: situation({ shotClock: .3 }),
      shot: Object.freeze({ type: 'layup', distance: .2, openness: 1, contest: 0, advantage: 1, energy: 1 })
    },
    {
      team: toronto, opponent: newYork, shooter: toque, defender: lineupFor(newYork)[1],
      situation: situation({ quarter: 5, gameClock: .1, shotClock: .1 }),
      shot: Object.freeze({ type: 'jumper', distance: 14, openness: 0, contest: 1, advantage: 0, energy: 0 })
    },
    {
      team: toronto, opponent: newYork, shooter: toque, defender: lineupFor(newYork)[1],
      situation: situation(),
      shot: Object.freeze({ type: 'jumper', distance: 7.2, openness: .6, contest: .4, advantage: .2, energy: .7 })
    }
  ];

  for (const input of shots) {
    const result = brain.evaluateShot(input);
    assert.ok(result);
    assert.ok(result.probability >= .12 && result.probability <= .88,
      `shot probability must remain in [.12, .88]; received ${result.probability}`);
    assertFiniteNumbers(result, `${input.shooter.id}.shot`);
    assertDeepFrozen(result, `${input.shooter.id}.shot`);
  }

  const torontoPointProfile = brain.derivePlayerProfile({
    team: toronto, athlete: lineupFor(toronto)[0], courtRole: 'POINT'
  });
  assert.equal(brain.evaluateShot({
    team: newYork, opponent: toronto, shooter: torontoPointProfile,
    situation: situation(), shot: Object.freeze({ type: 'jumper', distance: 5, openness: .7, contest: .2 })
  }), null, 'a trusted profile cannot be reused as another team\'s shooter');
});

test('brain source has no clock, global randomness, UI, storage, network, or scheduler dependency', async () => {
  const source = await readFile(new URL('./basketballbrain.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bMath\.random\b/);
  assert.doesNotMatch(source,
    /\b(?:Date|document|window|location|navigator|localStorage|sessionStorage|indexedDB|caches|fetch|XMLHttpRequest|WebSocket|EventSource|requestAnimationFrame|cancelAnimationFrame|setTimeout|setInterval|performance)\b/);
});
