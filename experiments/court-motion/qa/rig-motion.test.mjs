import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as THREE from '../../../vendor/three/three.module.js';
import { createSimulation, stepSimulation, FIXED_STEP } from '../sim.js';

// Only canvas text painting is stubbed. All limb, IK and world transforms use
// actual Three.js objects. Set COURT_RIG_REF=1748fc8 to verify the old failures.
globalThis.document = { createElement: () => ({ getContext: () => ({ fillText() {} }) }) };
let rigModule = new URL('../rigs.js', import.meta.url).href;
if (process.env.COURT_RIG_REF) {
  const source = execFileSync('git', ['show', `${process.env.COURT_RIG_REF}:experiments/court-motion/rigs.js`], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)), encoding: 'utf8',
  }).replace("'../../vendor/three/three.module.js'", JSON.stringify(new URL('../../../vendor/three/three.module.js', import.meta.url).href));
  rigModule = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}
const { createAthlete, updateAthlete } = await import(rigModule);

function athlete(id = 1) {
  const p = { ...createSimulation(7).players[id], x: 0, z: 0, vx: 0, vz: 0, facing: 0, action: 'idle', actionT: 0, actionDuration: .5, intent: 'Find space' };
  const ball = { x: 0, y: 1.3, z: 6, owner: null, mode: 'loose', targetId: null };
  const rig = createAthlete(p, new THREE.Scene());
  let time = 0;
  updateAthlete(rig, p, ball, 0, time);
  const update = () => { time += FIXED_STEP; updateAthlete(rig, p, ball, FIXED_STEP, time); rig.root.updateMatrixWorld(true); };
  const feet = () => rig.legs.map(leg => leg.shoe.getWorldPosition(new THREE.Vector3()));
  return { p, ball, rig, update, feet };
}

test('stopping during a foot swing finishes the step without snapping and plants both feet', () => {
  const a = athlete();
  a.p.vz = 2.4; a.p.action = 'run';
  let caughtMidStep = false;
  for (let tick = 0; tick < 90; tick++) {
    a.p.z += a.p.vz * FIXED_STEP;
    a.update();
    caughtMidStep = a.rig.legs.some(leg => leg.swinging && leg.shoe.position.y > .055
      && Math.hypot(leg.target.x - leg.anchor.x, leg.target.z - leg.anchor.z) > .25);
    if (caughtMidStep) break;
  }
  assert.ok(caughtMidStep, 'fixture must stop while a raised foot still has distance to travel');
  let previous = a.feet(), maxJump = 0;
  a.p.vz = 0; a.p.action = 'idle';
  for (let tick = 0; tick < 90; tick++) {
    a.update();
    const next = a.feet();
    for (let i = 0; i < next.length; i++) maxJump = Math.max(maxJump, next[i].distanceTo(previous[i]));
    previous = next;
  }
  assert.ok(maxJump < .15, `a stopped foot jumped ${maxJump.toFixed(3)} m in one tick`);
  assert.ok(a.rig.legs.every(leg => !leg.swinging), 'both feet should finish planting');
  assert.ok(a.feet().every(foot => Math.abs(foot.y - .03) < .003), 'planted shoes should return to court height');
  const planted = a.feet();
  for (let tick = 0; tick < 12; tick++) a.update();
  assert.ok(a.feet().every((foot, i) => foot.distanceTo(planted[i]) < .001), 'stationary feet should remain planted');
});

test('a receiver crossing two metres blends toward the ball without a hard hand-target jump', () => {
  const a = athlete(4);
  a.p.intent = 'Meet the pass'; a.p.action = 'run';
  Object.assign(a.ball, { z: -2.11, y: 1.43, mode: 'pass', targetId: a.p.id });
  for (let tick = 0; tick < 40; tick++) a.update();
  let previous = a.rig.arms.map(arm => arm.hand.position.clone()), maxJump = 0;
  const ready = previous.map(point => point.clone());
  for (const z of [-1.99, -1.87, -1.75]) {
    a.ball.z = z; a.update();
    const next = a.rig.arms.map(arm => arm.hand.position.clone());
    for (let i = 0; i < next.length; i++) maxJump = Math.max(maxJump, next[i].distanceTo(previous[i]));
    previous = next;
  }
  assert.ok(maxJump < .15, `receiving hand jumped ${maxJump.toFixed(3)} m across the distance threshold`);
  for (let tick = 0; tick < 40; tick++) a.update();
  assert.ok(a.rig.arms.some((arm, i) => arm.hand.position.distanceTo(ready[i]) > .015), 'receiving pose must respond to the incoming ball rather than freeze');
});

test('resetting a block contact timer at jump apex preserves the ongoing jump and landing', () => {
  const a = athlete();
  a.p.action = 'block'; a.p.actionDuration = .65;
  for (let tick = 1; tick <= 16; tick++) { a.p.actionT = tick * FIXED_STEP; a.update(); }
  const apex = a.rig.body.position.y;
  assert.ok(apex > .10, 'fixture must reach an airborne block before contact');
  // The sporting contact reports block again with a fresh action timer.
  a.p.actionT = 0; a.p.actionDuration = .48; a.update();
  assert.ok(Math.abs(a.rig.body.position.y - apex) < .04, 'contact must not reset the athlete to floor height');
  let previousY = a.rig.body.position.y;
  for (let tick = 0; tick < 50; tick++) {
    a.p.actionT += FIXED_STEP; a.update();
    assert.ok(Math.abs(a.rig.body.position.y - previousY) < .04, 'landing must remain continuous');
    previousY = a.rig.body.position.y;
  }
  assert.ok(Math.abs(a.rig.body.position.y) < .015, 'the jump should finish at court height');
});

test('120 seconds of autonomous play keeps feet, hands, bends and body below a 0.15 m tick jump', () => {
  const sim = createSimulation('7'), scene = new THREE.Scene();
  const rigs = sim.players.map(p => createAthlete(p, scene));
  const previous = new Map(), worst = { amount: 0 };
  const check = (key, point, p) => {
    assert.ok(point.toArray().every(Number.isFinite), `nonfinite joint ${key}`);
    if (previous.has(key)) {
      const amount = point.distanceTo(previous.get(key));
      if (amount > worst.amount) Object.assign(worst, { amount, key, time: sim.time, player: p.name, action: p.action });
    }
    previous.set(key, point.clone());
  };
  for (let i = 0; i < rigs.length; i++) updateAthlete(rigs[i], sim.players[i], sim.ball, 0, 0);
  for (let tick = 0; tick < 7200; tick++) {
    stepSimulation(sim, FIXED_STEP);
    for (let i = 0; i < rigs.length; i++) {
      const rig = rigs[i], p = sim.players[i];
      updateAthlete(rig, p, sim.ball, FIXED_STEP, sim.time); rig.root.updateMatrixWorld(true);
      check(`${i}:body`, rig.body.position, p);
      for (const leg of rig.legs) {
        check(`${i}:foot:${leg.side}`, leg.shoe.getWorldPosition(new THREE.Vector3()), p);
        leg.upper.updateMatrix();
        check(`${i}:knee:${leg.side}`, new THREE.Vector3(0, .5, 0).applyMatrix4(leg.upper.matrix), p);
      }
      for (const arm of rig.arms) {
        check(`${i}:hand:${arm.side}`, arm.hand.position, p);
        arm.upper.updateMatrix();
        check(`${i}:elbow:${arm.side}`, new THREE.Vector3(0, .5, 0).applyMatrix4(arm.upper.matrix), p);
      }
    }
  }
  assert.ok(worst.amount < .15, `joint discontinuity: ${JSON.stringify(worst)}`);
});
