import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AMERICAN_FOOTBALL_TEAM_DNA,
  chooseDefensiveCall,
  chooseOffensiveCall,
  createCoordinatorMemory,
  derivePlayerTraits,
  deriveTeamDNA,
  evaluateQBProgression,
  explainPlayCause,
  rankDefensiveCalls,
  rankOffensiveCalls,
  rankRunLanes,
  recordMatchupWin,
  recordPlayOutcome,
  scoreRunLane,
  scoreThrowWindow,
  updatePlayerCondition,
} from './footballbrain.js';

const makeRng = seed => {
  let state = seed >>> 0 || 1;
  return () => {
    state = Math.imul(state, 1664525) + 1013904223 >>> 0;
    return state / 4294967296;
  };
};

test('all current football clubs have authored and distinct team DNA', () => {
  assert.equal(Object.keys(AMERICAN_FOOTBALL_TEAM_DNA).length, 8);
  const bayou = deriveTeamDNA({ id: 'new-orleans-bayou-kings', motion: 'slow bayou misdirection' });
  const atlanta = deriveTeamDNA('atlanta-peaches');
  assert.equal(bayou.source, 'authored');
  assert.ok(bayou.offense.misdirection > atlanta.offense.misdirection);
  assert.ok(atlanta.offense.insideBias > bayou.offense.insideBias);
  assert.deepEqual(deriveTeamDNA('atlanta-peaches'), atlanta);
});

test('future team DNA can be derived from existing style prose', () => {
  const team = deriveTeamDNA({ id: 'future-club', motion: 'patient misdirection formations breaking into flight' });
  assert.equal(team.source, 'style-derived');
  assert.ok(team.offense.misdirection > 0.5);
  assert.ok(team.offense.verticalRate > 0.5);
  assert.ok(team.coordinator.patience > 0.5);
});

test('player traits are stable, role-aware, and use signature/flaw semantics', () => {
  const athlete = { id: 'test-qb', name: 'Read King', role: 'Quarterback', signature: 'throws receivers open', flaw: 'holds the ball one heartbeat too long when the first read wins' };
  const qb = derivePlayerTraits(athlete, 'QB', deriveTeamDNA('oakland-redwoods'));
  const repeat = derivePlayerTraits(athlete, 'Quarterback', deriveTeamDNA('oakland-redwoods'));
  const lineman = derivePlayerTraits({ id: 'test-lt', name: 'Gate', role: 'Left Tackle', signature: 'runs speed rushers past the pocket' });
  assert.deepEqual(qb, repeat);
  assert.ok(qb.ratings.throwAccuracy > 0.65);
  assert.ok(qb.ratings.anticipation > 0.65);
  assert.ok(lineman.ratings.passBlock > lineman.ratings.throwAccuracy);
  assert.equal(lineman.group, 'OL');
});

test('coordinator records snaps immutably and turns established run success into play-action value', () => {
  const initial = createCoordinatorMemory('new-orleans-bayou-kings');
  let memory = initial;
  for (let index = 0; index < 3; index += 1) {
    memory = recordPlayOutcome(memory, {
      teamSide: 'offense', offenseCall: 'INSIDE ZONE', defenseCall: 'COVER 3', yards: 7,
      situation: { down: 1, toGo: 10 },
    });
  }
  assert.equal(initial.snaps, 0);
  assert.equal(memory.snaps, 3);
  assert.equal(memory.offense.calls['INSIDE ZONE'].attempts, 3);
  assert.ok(memory.signals.ownRun > 0.3);
  const calls = ['INSIDE ZONE', 'PLAY ACTION CROSS'];
  const baseline = rankOffensiveCalls({ calls, situation: { down: 1, toGo: 10 }, teamDNA: deriveTeamDNA('new-orleans-bayou-kings'), memory: initial });
  const adapted = rankOffensiveCalls({ calls, situation: { down: 1, toGo: 10 }, teamDNA: deriveTeamDNA('new-orleans-bayou-kings'), memory });
  const basePA = baseline.find(item => item.id === 'PLAY ACTION CROSS').score;
  const adaptedPA = adapted.find(item => item.id === 'PLAY ACTION CROSS').score;
  assert.ok(adaptedPA > basePA);
});

test('defensive memory responds to repeated run success and screen success discourages blitz', () => {
  let memory = createCoordinatorMemory('chicago-stockyards');
  for (let index = 0; index < 4; index += 1) {
    memory = recordPlayOutcome(memory, { teamSide: 'defense', offenseCall: 'OUTSIDE ZONE', defenseCall: 'COVER 3', yards: 8, situation: { down: 1, toGo: 10 } });
  }
  const runRanking = rankDefensiveCalls({ calls: ['BEAR FRONT', 'QUARTERS'], situation: { down: 2, toGo: 3 }, teamDNA: deriveTeamDNA('chicago-stockyards'), memory });
  assert.equal(runRanking[0].id, 'BEAR FRONT');

  for (let index = 0; index < 3; index += 1) {
    memory = recordPlayOutcome(memory, { teamSide: 'defense', offenseCall: 'RB SCREEN', defenseCall: 'NICKEL FIRE', yards: 16, situation: { down: 2, toGo: 8 } });
  }
  const screenRanking = rankDefensiveCalls({ calls: ['NICKEL FIRE', 'QUARTERS'], situation: { down: 2, toGo: 8 }, teamDNA: deriveTeamDNA('chicago-stockyards'), memory });
  assert.equal(screenRanking[0].id, 'QUARTERS');
});

test('matchup memory is immutable and stores persistent edge', () => {
  const memory = createCoordinatorMemory('oakland-redwoods');
  const won = recordMatchupWin(memory, { key: 'LT:RDE', phase: 'pass-protection', winner: 'team', weight: 1.5, detail: 'LT ran the edge past the pocket' });
  const lost = recordMatchupWin(won, { key: 'LT:RDE', phase: 'pass-protection', winner: 'opponent', weight: 0.5 });
  assert.equal(memory.matchups['LT:RDE'], undefined);
  assert.ok(won.matchups['LT:RDE'].edge > 0);
  assert.ok(lost.matchups['LT:RDE'].edge > 0);
  assert.equal(lost.matchups['LT:RDE'].wins, 1);
  assert.equal(lost.matchups['LT:RDE'].losses, 1);
});

test('throw-window score rewards separation and penalizes closing safety overlap', () => {
  const quarterback = { ratings: { throwAccuracy: 0.82, anticipation: 0.80, throwPower: 0.76, composure: 0.78 } };
  const receiver = { ratings: { hands: 0.80, contestedCatch: 0.72 } };
  const open = scoreThrowWindow({ separation: 2.7, leverage: 0.5, closingSpeed: 2, safetyOverlap: 0.1, routeDepth: 16, arrivalTime: 0.65, quarterback, receiver });
  const danger = scoreThrowWindow({ separation: 0.3, leverage: -0.7, closingSpeed: 10, safetyOverlap: 0.9, routeDepth: 24, arrivalTime: 1.1, pressure: 0.8, platform: 0.35, quarterback, receiver });
  assert.ok(open.decisionScore > danger.decisionScore);
  assert.ok(open.catchChance > danger.catchChance);
  assert.ok(open.turnoverRisk < danger.turnoverRisk);
  assert.equal(danger.grade, 'danger');
});

test('QB progression waits for confirmation, then chooses the first viable authored read', () => {
  const quarterback = derivePlayerTraits({ id: 'progression-qb', name: 'Progress', role: 'Quarterback', signature: 'throws receivers open' });
  const progression = [
    { order: 1, targetId: 'X', targetName: 'Boundary X', depth: 18, window: { separation: 0.2, leverage: -0.8, closingSpeed: 9, safetyOverlap: 0.8, routeDepth: 18 } },
    { order: 2, targetId: 'TE', targetName: 'Seam TE', depth: 11, window: { separation: 2.8, leverage: 0.6, closingSpeed: 2, safetyOverlap: 0.1, routeDepth: 11 } },
  ];
  const early = evaluateQBProgression({ progression, quarterback, elapsed: 0.05, pressure: 0.1, rng: makeRng(7) });
  const settled = evaluateQBProgression({ progression, quarterback, elapsed: 1.2, pressure: 0.1, rng: makeRng(7) });
  assert.equal(early.action, 'hold');
  assert.equal(settled.action, 'throw');
  assert.equal(settled.targetId, 'TE');
  assert.equal(settled.readOrder, 2);
});

test('run-lane scoring finds leverage and cutback space rather than a preset lane', () => {
  const runner = derivePlayerTraits({ id: 'vision-back', name: 'Cutback', role: 'Running Back', signature: 'gets small before getting gone' });
  const open = { id: 'backside-b', gap: 'B backside', width: 3.2, blockLeverage: 0.65, firstContactDistance: 7, traffic: 0.12, pursuitClosing: 0.2, cutbackOpportunity: 0.8, secondLevelSpace: 0.7 };
  const closed = { id: 'front-a', gap: 'A frontside', width: 0.5, blockLeverage: -0.7, firstContactDistance: 1, traffic: 0.9, pursuitClosing: 0.8, cutbackOpportunity: 0, secondLevelSpace: 0.1 };
  const openScore = scoreRunLane({ lane: open, runner, scheme: 'inside-zone', rng: makeRng(4) });
  const ranking = rankRunLanes({ lanes: [closed, open], runner, scheme: 'inside-zone', rng: makeRng(4) });
  assert.ok(openScore.score > 0.5);
  assert.equal(ranking[0].id, 'backside-b');
});

test('fatigue accumulates under load, recovers during rest, and wear persists', () => {
  const traits = { ratings: { stamina: 0.66, durability: 0.72 } };
  const start = { fatigue: 0, wear: 0, snaps: 0 };
  const active = updatePlayerCondition(start, { traits, seconds: 7, sprintSeconds: 5, contactSeverity: 0.8, snap: true });
  const rested = updatePlayerCondition(active, { traits, restSeconds: 28, snap: false });
  assert.equal(start.fatigue, 0);
  assert.ok(active.fatigue > 0);
  assert.ok(active.wear > 0);
  assert.ok(rested.fatigue < active.fatigue);
  assert.equal(rested.wear, active.wear);
  assert.ok(active.performance.acceleration < 1);
});

test('call selection is deterministic with equivalent caller RNG seeds', () => {
  const options = { calls: ['INSIDE ZONE', 'OUTSIDE ZONE', 'PLAY ACTION CROSS', 'MESH'], situation: { down: 1, toGo: 10 }, teamDNA: deriveTeamDNA('seattle-rain-dogs'), memory: createCoordinatorMemory('seattle-rain-dogs') };
  const first = chooseOffensiveCall({ ...options, rng: makeRng(99) });
  const second = chooseOffensiveCall({ ...options, rng: makeRng(99) });
  assert.deepEqual(first, second);
  const defenseFirst = chooseDefensiveCall({ calls: ['COVER 3', 'QUARTERS', 'NICKEL FIRE'], situation: { down: 3, toGo: 9 }, teamDNA: deriveTeamDNA('minneapolis-snow-geese'), memory: createCoordinatorMemory('minneapolis-snow-geese'), rng: makeRng(21) });
  const defenseSecond = chooseDefensiveCall({ calls: ['COVER 3', 'QUARTERS', 'NICKEL FIRE'], situation: { down: 3, toGo: 9 }, teamDNA: deriveTeamDNA('minneapolis-snow-geese'), memory: createCoordinatorMemory('minneapolis-snow-geese'), rng: makeRng(21) });
  assert.deepEqual(defenseFirst, defenseSecond);
});

test('causal explanation prioritizes actual pressure/window/contact evidence', () => {
  const explanation = explainPlayCause({
    result: 'complete', yards: 18, offenseCall: 'PLAY ACTION CROSS', defenseCall: 'NICKEL FIRE',
    actors: { passer: 'Gumbo Gene', target: 'King Roux' },
    pressure: { level: 0.8, source: 'the nickel', unblocked: true },
    throwWindow: { grade: 'open', reasons: ['receiver created clear separation'] },
    decision: { readOrder: 2 },
  });
  assert.match(explanation.headline, /GUMBO GENE TO KING ROUX/);
  assert.match(explanation.primaryCause, /nickel came free/);
  assert.ok(explanation.causes.some(cause => /separation/.test(cause)));
  assert.ok(explanation.summary.length < 180);
});
