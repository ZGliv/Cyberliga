import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation, stepSimulation, snapshot, FIXED_STEP } from './sim.js';

function run(sim, seconds) {
  for (let n = 0; n < Math.round(seconds / FIXED_STEP); n++) stepSimulation(sim);
  return sim;
}
function assertFinite(value, path = 'sim') {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `${path} is finite`);
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) assertFinite(child, `${path}.${key}`);
}
function isolatedShot(x = 0) {
  const sim = createSimulation(17);
  for (const p of sim.players) { p.x = p.id % 2 ? -4 : 4; p.z = p.id < 3 ? 3 : -2; }
  Object.assign(sim.ball, { owner: null, mode: 'shot', x, y: 1.2, z: -7.95, vx: 0, vy: 0, vz: -12,
    expectedFlight: .4, flightTime: 0, scoringTeam: 0, lastTouchId: 0, contacts: [0], scored: false });
  return sim;
}

test('same seeds and fixed elapsed time produce identical sporting state', () => {
  for (const seed of [7, 91, 'latch-v-nix']) {
    const a = run(createSimulation(seed), 90);
    const b = createSimulation(seed);
    for (let n = 0; n < 900; n++) stepSimulation(b, .1);
    assert.deepEqual(snapshot(a), snapshot(b));
  }
});

test('serialized checkpoints resume without changing future decisions or events', () => {
  const original = run(createSimulation(81), 37);
  const restored = snapshot(original);
  run(original, 60); run(restored, 60);
  assert.deepEqual(snapshot(original), snapshot(restored));
});

test('one physical goal crossing produces exactly one goal and a continuous restart', () => {
  const sim = isolatedShot();
  const before = snapshot(sim);
  stepSimulation(sim);
  assert.deepEqual(sim.score, [1, 0]);
  assert.deepEqual(sim.stats.goals, [1, 0]);
  assert.equal(sim.events.filter(e => e.type === 'goal').length, 1);
  assert.equal(sim.phase, 'restart');
  assert.equal(sim.possession, 1);
  assert.ok(Math.hypot(sim.ball.x - before.ball.x, sim.ball.z - before.ball.z) < .3, 'ball continues into the goal');
  for (const p of sim.players) assert.ok(Math.hypot(p.x - before.players[p.id].x, p.z - before.players[p.id].z) < .06);
  run(sim, 1.5);
  assert.deepEqual(sim.score, [1, 0]);
  assert.equal(sim.events.filter(e => e.type === 'goal').length, 1);
});

test('wide shots miss geometrically and remain recoverable', () => {
  const sim = isolatedShot(3.3);
  stepSimulation(sim);
  assert.deepEqual(sim.score, [0, 0]);
  assert.equal(sim.stats.misses[0], 1);
  assert.equal(sim.ball.mode, 'loose');
  run(sim, 6);
  assert.ok(sim.stats.recoveries.reduce((a, b) => a + b) > 0);
});

test('a defender reaching an actual shot trajectory blocks without awarding a goal', () => {
  const sim = isolatedShot();
  Object.assign(sim.ball, { z: -4.5, vz: -10 });
  Object.assign(sim.players[3], { x: 0, z: -5, action: 'block', actionT: .2, actionDuration: .65 });
  stepSimulation(sim);
  assert.equal(sim.stats.blocks[1], 1);
  assert.equal(sim.ball.mode, 'loose');
  assert.deepEqual(sim.score, [0, 0]);
});

test('multiple ten-minute runs stay finite, bounded, continuous and active for every athlete', () => {
  const signatures = new Set();
  const outcomeTypes = new Set();
  for (const seed of [7, 8, 9, 10, 11]) {
    const sim = createSimulation(seed), involved = new Set();
    let lastEventId = 0, lastEventTime = 0;
    for (let n = 0; n < 36_000; n++) {
      const oldScore = sim.score.slice();
      const oldPositions = sim.players.map(p => ({ x: p.x, z: p.z }));
      stepSimulation(sim);
      for (const p of sim.players) {
        assert.ok(Math.abs(p.x) <= 4.6001 && Math.abs(p.z) <= 7.4001);
        assert.ok(Math.hypot(p.x - oldPositions[p.id].x, p.z - oldPositions[p.id].z) <= .06, 'no player teleports');
        assert.ok(p.carryTime < 3.1, `${p.name} respects the carry limit`);
      }
      assert.ok(Math.abs(sim.ball.x) <= 5.1 && Math.abs(sim.ball.z) <= 8.4 && sim.ball.y >= .17 && sim.ball.y < 5);
      for (const e of sim.events) if (e.id > lastEventId) {
        outcomeTypes.add(e.type);
        if (e.playerId !== null) involved.add(e.playerId);
        lastEventId = e.id; lastEventTime = e.time;
      }
      assert.ok(sim.time - lastEventTime < 18, 'no dead sequence exceeds a possession plus retrieval');
      for (const team of [0, 1]) {
        const delta = sim.score[team] - oldScore[team];
        assert.ok(delta === 0 || delta === 1);
        if (delta) assert.ok(sim.events.some(e => e.type === 'goal' && e.team === team && e.time === sim.time));
        assert.equal(sim.score[team], sim.stats.goals[team]);
      }
      if (n % 600 === 0) assertFinite(sim);
    }
    assert.equal(involved.size, 6, 'every athlete contributes to recorded play');
    assert.ok(sim.stats.passes.every(n => n > 20));
    assert.ok(sim.stats.shots.every(n => n > 5));
    assert.ok(sim.score.reduce((a, b) => a + b) > 5);
    signatures.add(JSON.stringify([sim.score, sim.stats]));
  }
  assert.equal(signatures.size, 5, 'different entropy produces different complete contests');
  for (const type of ['pass', 'catch', 'interception', 'shot', 'block', 'miss', 'recovery', 'goal']) assert.ok(outcomeTypes.has(type), type);
});


test('passes gather and shots rise before release without discontinuous ball movement', () => {
  for (const kind of ['pass', 'shoot']) {
    const sim = createSimulation(41), owner = sim.players[0];
    // A realistic held state, then an already chosen action: inspect preparation,
    // not an injected result or a renderer animation disconnected from the ball.
    Object.assign(owner, { x: 0, z: 0, facing: 0, vx: 0, vz: 0,
      pending: { type: kind, at: kind === 'pass' ? .22 : .27, targetId: kind === 'pass' ? 2 : null },
      action: kind, actionT: 0, actionDuration: .55 });
    Object.assign(sim.ball, { x: 0, y: 1.2, z: .42, owner: 0, mode: 'held' });
    let maxHeldHeight = 1.2, minimumForward = .42, previous = { ...sim.ball }, released = false;
    for (let n = 0; n < 24; n++) {
      stepSimulation(sim);
      const travel = Math.hypot(sim.ball.x - previous.x, sim.ball.y - previous.y, sim.ball.z - previous.z);
      assert.ok(travel < .32, `${kind} stays continuous through gather and release`);
      if (sim.ball.owner === 0) {
        maxHeldHeight = Math.max(maxHeldHeight, sim.ball.y);
        const forward = (sim.ball.x - owner.x) * Math.sin(owner.facing) + (sim.ball.z - owner.z) * Math.cos(owner.facing);
        minimumForward = Math.min(minimumForward, forward);
        assert.ok(sim.ball.y <= 1.601, 'gather remains within the shared rig reach');
      } else { released = true; break; }
      previous = { ...sim.ball };
    }
    assert.ok(released);
    assert.ok(maxHeldHeight > (kind === 'shoot' ? 1.53 : 1.33), `${kind} has a visible physical gather`);
    if (kind === 'pass') assert.ok(minimumForward < .34, 'pass pulls toward the chest before extension');
    assert.equal(sim.ball.mode, kind === 'shoot' ? 'shot' : 'pass');
  }
});


test('a committed sidestep does not flip when the defender crosses the carrier centerline', () => {
  const sim = createSimulation(17), carrier = sim.players[0], defender = sim.players[3];
  Object.assign(carrier, { x: 0, z: 3, vx: 0, vz: 0, decisionAt: 100 });
  for (const p of sim.players) if (p.id !== 0 && p.id !== 3) Object.assign(p, { x: p.id % 2 ? -4 : 4, z: -2 });
  Object.assign(sim.ball, { x: 0, y: 1.2, z: 2.58 });
  let side, target;
  for (let n = 0; n < 24; n++) {
    // Small observed lateral changes used to select the opposite dodge every
    // tick. A decision should persist long enough to produce an actual move.
    defender.x = carrier.x + (n % 2 ? .10 : -.10);
    defender.z = carrier.z - 1.1;
    stepSimulation(sim);
    if (n === 0) { side = carrier.avoidSide; target = carrier.avoidTargetX; }
    assert.equal(carrier.avoidSide, side);
    assert.equal(carrier.avoidTargetX, target);
  }
  assert.ok(Math.abs(side) === 1);
  assert.ok(carrier.x * side > .10, 'the carrier follows through on the chosen side');
});

test('two minutes of autonomous play avoid rapid rocking without sacrificing movement', () => {
  const sim = createSimulation(7);
  const memory = sim.players.map(p => ({ x: p.x, z: p.z, vx: 0, vz: 0, facing: p.facing,
    ax: 0, az: 0, omega: 0, yawSign: 0, yawChanged: -99 }));
  let rapidYawReversals = 0, totalTravel = 0, maxYawAcceleration = 0, maxJerk = 0;
  for (let n = 0; n < 7200; n++) {
    stepSimulation(sim);
    for (const p of sim.players) {
      const m = memory[p.id];
      const omega = Math.atan2(Math.sin(p.facing - m.facing), Math.cos(p.facing - m.facing)) / FIXED_STEP;
      if (Math.abs(omega) > .4) {
        const sign = Math.sign(omega);
        if (m.yawSign && sign !== m.yawSign) {
          if (sim.time - m.yawChanged < .35) rapidYawReversals++;
          m.yawChanged = sim.time;
        }
        m.yawSign = sign;
      }
      const ax = (p.vx - m.vx) / FIXED_STEP, az = (p.vz - m.vz) / FIXED_STEP;
      maxYawAcceleration = Math.max(maxYawAcceleration, Math.abs(omega - m.omega) / FIXED_STEP);
      maxJerk = Math.max(maxJerk, Math.hypot(ax - m.ax, az - m.az) / FIXED_STEP);
      totalTravel += Math.hypot(p.x - m.x, p.z - m.z);
      Object.assign(m, { x: p.x, z: p.z, vx: p.vx, vz: p.vz, facing: p.facing, ax, az, omega });
    }
  }
  assert.ok(rapidYawReversals < 100, `rapid rocking count ${rapidYawReversals}; previous regression produced 414`);
  assert.ok(maxYawAcceleration < 80, `angular acceleration ${maxYawAcceleration}`);
  assert.ok(maxJerk < 75, `linear jerk ${maxJerk}`);
  assert.ok(totalTravel > 850, 'smoothness cannot be obtained by freezing or globally slowing the athletes');
  assert.ok(sim.stats.shots.reduce((a, b) => a + b) >= 8, 'autonomous play still produces chances');
});

test('invalid time steps cannot corrupt the simulation', () => {
  for (const dt of [-1, Infinity, NaN, 61]) assert.throws(() => stepSimulation(createSimulation(), dt), RangeError);
});
