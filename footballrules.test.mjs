import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  FOOTBALL_PENALTIES,
  PLAY_CLOCK_SECONDS,
  advanceDeadBallClock,
  advanceDownAfterPlay,
  applyTimeoutDecision,
  assessFalseStart,
  assessHolding,
  assessOffsides,
  assessPassInterference,
  createDeadBallClockState,
  decideLateGameTimeout,
  enforcePenalty,
  enforcePenaltySet,
  evaluateLivePenalties,
  evaluatePreSnapPenalties,
  formatPenaltyCall,
  resetDeadBallClock,
} from './footballrules.js';

const makeRng = (seed) => {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const alwaysCall = () => 0;
const neverCall = () => 0.999999;

test('rules module has no global random source and assessments require caller RNG', async () => {
  const source = await readFile(new URL('./footballrules.js', import.meta.url), 'utf8');
  assert.equal(source.includes('Math.random'), false);
  assert.throws(() => assessFalseStart({ displacement: 1 }), /caller-supplied rng/);
  assert.throws(() => evaluateLivePenalties(), /caller-supplied rng/);
});
test('false start requires observed movement after becoming set', () => {
  const clean = assessFalseStart({
    offenderId: 'LT', displacement: 0.02, forwardSpeed: 0.08, setDuration: 1.1, rng: alwaysCall,
  });
  const flinch = assessFalseStart({
    offenderId: 'LT', offenderRole: 'LT', displacement: 0.26, forwardSpeed: 1.1,
    setDuration: 1.1, crowdNoise: 0.8, fatigue: 0.6, rng: alwaysCall,
  });
  const induced = assessFalseStart({
    offenderId: 'LG', displacement: 0.3, causedByDefense: true, setDuration: 1, rng: alwaysCall,
  });
  assert.equal(clean.called, false);
  assert.equal(flinch.called, true);
  assert.equal(flinch.penalty.type, 'false-start');
  assert.equal(flinch.penalty.team, 'offense');
  assert.equal(flinch.penalty.liveBall, false);
  assert.ok(flinch.evidence.some(item => /movement/.test(item)));
  assert.equal(induced.called, false);
  assert.match(induced.reason, /defender induced/);
});

test('offsides distinguishes a free play, encroachment, and a legal retreat', () => {
  const freePlay = assessOffsides({
    offenderId: 'RDE', neutralZoneDepth: 0.42, snapOccurred: true, rng: alwaysCall,
  });
  const encroachment = assessOffsides({
    offenderId: 'NT', neutralZoneDepth: 0.3, contact: true, snapOccurred: false, rng: alwaysCall,
  });
  const retreat = assessOffsides({
    offenderId: 'LDE', neutralZoneDepth: 0.25, returnedOnside: true, snapOccurred: false, rng: alwaysCall,
  });
  assert.equal(freePlay.penalty.name, 'OFFSIDES');
  assert.equal(freePlay.penalty.freePlay, true);
  assert.equal(freePlay.penalty.liveBall, true);
  assert.equal(encroachment.penalty.name, 'ENCROACHMENT');
  assert.equal(encroachment.penalty.liveBall, false);
  assert.equal(retreat.called, false);
  assert.match(retreat.reason, /legally returned/);
});

test('holding comes from illegal restriction, not an ordinary sustained block', () => {
  const legal = assessHolding({
    offenderId: 'RG', engagementDuration: 1.4, restriction: 0.32,
    separationAttempt: 0.2, defenderAdvantage: 0.1, handOutsideFrame: 0.1,
    ripMove: 0.8, rng: alwaysCall,
  });
  const hold = assessHolding({
    offenderId: 'RT', offenderRole: 'RT', foulSpot: 31, engagementDuration: 1.2,
    restriction: 0.9, separationAttempt: 0.8, defenderAdvantage: 0.82,
    handOutsideFrame: 0.85, hook: 0.78, pointOfAttack: 0.9, rng: alwaysCall,
  });
  assert.equal(legal.called, false);
  assert.equal(hold.called, true);
  assert.equal(hold.penalty.type, 'holding');
  assert.equal(hold.penalty.foulSpot, 31);
  assert.ok(hold.evidence.some(item => /won defensive angle/.test(item)));
});

test('DPI requires a catchable airborne pass and material early restriction', () => {
  const uncatchable = assessPassInterference({
    ballInAir: true, catchable: false, targetDepth: 18, secondsBeforeArrival: 0.3,
    contactSeverity: 0.9, restriction: 0.9, rng: alwaysCall,
  });
  const ballPlay = assessPassInterference({
    ballInAir: true, catchable: true, targetDepth: 18, secondsBeforeArrival: 0.1,
    contactSeverity: 0.5, restriction: 0.3, playingBall: 0.9, rng: alwaysCall,
  });
  const dpi = assessPassInterference({
    offenderId: 'LCB', foulSpot: 81, targetDepth: 26, ballInAir: true, catchable: true,
    secondsBeforeArrival: 0.28, contactSeverity: 0.8, restriction: 0.82,
    pathObstruction: 0.75, armBar: 0.8, playingBall: 0.05, rng: alwaysCall,
  });
  assert.equal(uncatchable.called, false);
  assert.equal(ballPlay.called, false);
  assert.equal(dpi.called, true);
  assert.equal(dpi.penalty.type, 'defensive-pass-interference');
  assert.equal(dpi.penalty.automaticFirstDown, true);
  assert.ok(dpi.evidence.some(item => /before ball arrival/.test(item)));
});

test('caller RNG makes borderline decisions reproducible', () => {
  const inputs = {
    offenderId: 'LG', engagementDuration: 0.7, restriction: 0.48,
    separationAttempt: 0.38, defenderAdvantage: 0.36, handOutsideFrame: 0.34,
  };
  const first = assessHolding({ ...inputs, rng: makeRng(19) });
  const second = assessHolding({ ...inputs, rng: makeRng(19) });
  assert.deepEqual(first, second);
  const missed = assessHolding({ ...inputs, rng: neverCall });
  assert.equal(first.probability, missed.probability);
  assert.equal(missed.called, false);
});

test('pre-snap orchestration kills the play for a dead-ball foul and identifies free plays', () => {
  const dead = evaluatePreSnapPenalties({
    offenseMovements: [{ offenderId: 'C', displacement: 0.28, occurredAt: 0.3 }],
    defensiveEntries: [{ offenderId: 'NT', neutralZoneDepth: 0.4, snapOccurred: true, occurredAt: 0.5 }],
    snapOccurred: true,
    rng: alwaysCall,
  });
  const live = evaluatePreSnapPenalties({
    defensiveEntries: [{ offenderId: 'RDE', neutralZoneDepth: 0.3, occurredAt: 0.1 }],
    snapOccurred: true,
    rng: alwaysCall,
  });
  assert.equal(dead.primary.type, 'false-start');
  assert.equal(dead.playMayContinue, false);
  assert.equal(live.primary.type, 'offsides');
  assert.equal(live.playMayContinue, true);
  assert.equal(live.freePlay, true);
});

test('live orchestration returns causal flags in event order', () => {
  const result = evaluateLivePenalties({
    blocks: [{
      offenderId: 'LG', foulSpot: 42, occurredAt: 1.8, engagementDuration: 1,
      restriction: 0.9, separationAttempt: 0.8, defenderAdvantage: 0.8,
      handOutsideFrame: 0.8, hook: 0.8,
    }],
    coverages: [{
      offenderId: 'SS', foulSpot: 58, occurredAt: 2.6, targetDepth: 14,
      ballInAir: true, catchable: true, secondsBeforeArrival: 0.2,
      contactSeverity: 0.85, restriction: 0.8, armBar: 0.75,
    }],
    rng: alwaysCall,
  });
  assert.equal(result.penalties.length, 2);
  assert.equal(result.primary.type, 'holding');
  assert.equal(result.playMayContinue, true);
});

test('enforcement preserves the line to gain and replays the down', () => {
  const falseStart = enforcePenalty({
    downState: { possession: 0, ballSpot: 25, down: 1, toGo: 10 },
    penalty: FOOTBALL_PENALTIES.FALSE_START,
  });
  assert.equal(falseStart.next.ballSpot, 20);
  assert.equal(falseStart.next.down, 1);
  assert.equal(falseStart.next.toGo, 15);
  assert.equal(falseStart.enforcement.assessedYards, 5);

  const firstDownOffsides = enforcePenalty({
    downState: { possession: 0, ballSpot: 30, down: 3, toGo: 4 },
    penalty: FOOTBALL_PENALTIES.OFFSIDES,
  });
  assert.equal(firstDownOffsides.next.ballSpot, 35);
  assert.equal(firstDownOffsides.next.down, 1);
  assert.equal(firstDownOffsides.next.toGo, 10);
  assert.equal(firstDownOffsides.firstDown, true);
});

test('enforcement handles half-distance, holding in the end zone, and goal-line DPI', () => {
  const halfDistance = enforcePenalty({
    downState: { ballSpot: 3, down: 2, toGo: 7 },
    penalty: { ...FOOTBALL_PENALTIES.HOLDING, foulSpot: 3 },
  });
  assert.equal(halfDistance.next.ballSpot, 1.5);
  assert.equal(halfDistance.next.down, 2);
  assert.equal(halfDistance.next.toGo, 8.5);
  assert.equal(halfDistance.enforcement.halfDistance, true);

  const safety = enforcePenalty({
    downState: { ballSpot: 2, down: 2, toGo: 8 },
    penalty: { ...FOOTBALL_PENALTIES.HOLDING, foulSpot: 0, foulInEndZone: true },
  });
  assert.equal(safety.result, 'safety');
  assert.equal(safety.enforcement.safety, true);

  const dpi = enforcePenalty({
    downState: { ballSpot: 70, down: 3, toGo: 8 },
    penalty: { ...FOOTBALL_PENALTIES.DPI, foulSpot: 100 },
  });
  assert.equal(dpi.next.ballSpot, 99);
  assert.equal(dpi.next.down, 1);
  assert.equal(dpi.next.toGo, 1);
  assert.equal(dpi.enforcement.goalLineDpi, true);
  assert.match(formatPenaltyCall(dpi), /AT THE 1/);
});

test('ordinary down handling covers first downs, incompletions, and turnover on downs', () => {
  const conversion = advanceDownAfterPlay(
    { possession: 0, ballSpot: 35, down: 2, toGo: 6 },
    { endSpot: 43, outcome: 'run' },
  );
  const incomplete = advanceDownAfterPlay(
    { possession: 0, ballSpot: 35, down: 2, toGo: 6 },
    { endSpot: 60, outcome: 'incomplete' },
  );
  const stopped = advanceDownAfterPlay(
    { possession: 0, ballSpot: 46, down: 4, toGo: 2 },
    { endSpot: 47, outcome: 'run' },
  );
  assert.equal(conversion.result, 'first-down');
  assert.deepEqual([conversion.next.ballSpot, conversion.next.down, conversion.next.toGo], [43, 1, 10]);
  assert.deepEqual([incomplete.next.ballSpot, incomplete.next.down, incomplete.next.toGo], [35, 3, 6]);
  assert.equal(stopped.result, 'turnover-on-downs');
  assert.deepEqual([stopped.next.possession, stopped.next.ballSpot, stopped.next.down], [1, 53, 1]);
});

test('opposite live-ball fouls offset and replay the original down', () => {
  const ruling = enforcePenaltySet({
    downState: { ballSpot: 40, down: 2, toGo: 7 },
    penalties: [
      { ...FOOTBALL_PENALTIES.HOLDING, offenderId: 'LT' },
      { ...FOOTBALL_PENALTIES.DPI, offenderId: 'LCB', foulSpot: 65 },
    ],
    playResult: { endSpot: 70, outcome: 'complete' },
  });
  assert.equal(ruling.status, 'offsetting');
  assert.deepEqual([ruling.next.ballSpot, ruling.next.down, ruling.next.toGo], [40, 2, 7]);
  assert.equal(formatPenaltyCall(ruling), 'OFFSETTING PENALTIES · REPLAY THE DOWN');
});

test('25-second dead-ball clock runs both clocks after an in-bounds play', () => {
  const start = createDeadBallClockState({ gameClock: 92, gameClockRunning: true });
  const tick = advanceDeadBallClock(start, { elapsed: 7 });
  assert.equal(PLAY_CLOCK_SECONDS, 25);
  assert.deepEqual([tick.clock.gameClock, tick.clock.playClock], [85, 18]);
  assert.equal(tick.gameClockRunoff, 7);
  assert.equal(tick.penalty, null);

  const stopped = createDeadBallClockState({ gameClock: 92, gameClockRunning: false });
  const stoppedTick = advanceDeadBallClock(stopped, { elapsed: 7 });
  assert.deepEqual([stoppedTick.clock.gameClock, stoppedTick.clock.playClock], [92, 18]);
});

test('play-clock expiry creates one delay flag and stops runoff at the whistle', () => {
  const start = createDeadBallClockState({ gameClock: 20, playClock: 2, gameClockRunning: true });
  const expired = advanceDeadBallClock(start, { elapsed: 5 });
  assert.equal(expired.playClockExpired, true);
  assert.equal(expired.penalty.type, 'delay-of-game');
  assert.deepEqual([expired.clock.gameClock, expired.clock.playClock], [18, 0]);
  assert.equal(expired.clock.gameClockRunning, false);

  const repeated = advanceDeadBallClock(expired.clock, { elapsed: 3 });
  assert.equal(repeated.playClockExpired, false);
  assert.equal(repeated.penalty, null);

  const reset = resetDeadBallClock(expired.clock, { gameClockRunning: false });
  assert.deepEqual([reset.gameClock, reset.playClock, reset.delayCharged], [18, 25, false]);
});

test('late-game timeout logic stops the clock for a trailing defense or urgent offense', () => {
  const defense = decideLateGameTimeout({
    possession: 0, score: [24, 20], quarter: 4, gameClock: 88,
    timeouts: [2, 2], clockRunning: true, phase: 'dead',
  });
  assert.equal(defense.teamIndex, 1);
  assert.equal(defense.side, 'defense');
  assert.equal(defense.takeTimeout, true);

  const offense = decideLateGameTimeout({
    possession: 1, score: [27, 24], quarter: 4, gameClock: 42, playClock: 25,
    timeouts: [1, 2], clockRunning: true, phase: 'dead', down: 3, toGo: 9, ballSpot: 68,
  });
  assert.equal(offense.teamIndex, 1);
  assert.equal(offense.side, 'offense');
  assert.equal(offense.takeTimeout, true);

  const clock = createDeadBallClockState({ gameClock: 42, gameClockRunning: true });
  const applied = applyTimeoutDecision({ timeouts: [1, 2], clockState: clock, decision: offense });
  assert.equal(applied.applied, true);
  assert.deepEqual(applied.timeouts, [1, 1]);
  assert.equal(applied.clock.gameClockRunning, false);
  assert.equal(applied.clock.playClock, 25);
});

test('late-game timeout logic declines when the clock is stopped, tied, or empty', () => {
  const stopped = decideLateGameTimeout({
    possession: 0, score: [17, 14], quarter: 4, gameClock: 54,
    timeouts: [1, 1], clockRunning: false, phase: 'dead',
  });
  const tied = decideLateGameTimeout({
    possession: 0, score: [17, 17], quarter: 4, gameClock: 54,
    timeouts: [1, 1], clockRunning: true, phase: 'dead',
  });
  const empty = decideLateGameTimeout({
    possession: 0, score: [17, 14], quarter: 4, gameClock: 54,
    timeouts: [1, 0], clockRunning: true, phase: 'dead',
  });
  assert.equal(stopped.takeTimeout, false);
  assert.equal(tied.takeTimeout, false);
  assert.equal(empty.takeTimeout, false);
});
