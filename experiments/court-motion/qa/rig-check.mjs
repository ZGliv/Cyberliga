#!/usr/bin/env node
// Headless rig-contact diagnostic. This measures actual Three.js world transforms,
// not drawn pixels, browser interpolation, or physical-device frame performance.
import * as THREE from '../../../vendor/three/three.module.js';
import { createSimulation, stepSimulation, FIXED_STEP } from '../sim.js';
import { createAthlete, updateAthlete } from '../rigs.js';

// The only canvas use in createAthlete is painting jersey text into a texture.
// Geometry, joints, IK, transforms and world-space distance use real Three.js.
globalThis.document = {
  createElement(tag) {
    if (tag !== 'canvas') throw new Error(`Unexpected headless DOM request: ${tag}`);
    return { width: 0, height: 0, getContext(kind) {
      if (kind !== '2d') throw new Error(`Unexpected canvas context: ${kind}`);
      return { fillText() {} };
    } };
  },
};
const seed = process.argv[2] ?? '7';
const seconds = Number(process.argv[3] ?? 120);
if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 600) throw new Error('Duration must be between zero and 600 seconds');
const sim = createSimulation(seed), scene = new THREE.Scene();
const rigs = sim.players.map(p => createAthlete(p, scene));
const vector = new THREE.Vector3();
const nonfinite = [], gaps = [];
let heldTicks = 0, checkedNodes = 0, worst = null, episode = null;
const episodes = [];
for (const rig of rigs) updateAthlete(rig, sim.players[rigs.indexOf(rig)], sim.ball, 0, sim.time);
for (let tick = 0; tick < Math.round(seconds / FIXED_STEP); tick++) {
  stepSimulation(sim);
  rigs.forEach((rig, id) => updateAthlete(rig, sim.players[id], sim.ball, FIXED_STEP, sim.time));
  scene.updateMatrixWorld(true);
  for (const [id, rig] of rigs.entries()) {
    rig.root.traverse(node => {
      checkedNodes++;
      const values = [...node.position, ...node.quaternion, ...node.scale, ...node.matrixWorld.elements];
      if (!values.every(Number.isFinite)) nonfinite.push({ time: sim.time, athlete: id, node: node.type });
    });
  }
  if (sim.ball.owner !== null) {
    heldTicks++;
    const p = sim.players[sim.ball.owner], rig = rigs[p.id];
    const hands = rig.arms.map(arm => arm.hand.getWorldPosition(new THREE.Vector3()));
    vector.set(sim.ball.x, sim.ball.y, sim.ball.z);
    const nearest = Math.min(...hands.map(hand => hand.distanceTo(vector)));
    const item = { time: sim.time, player: p.name, id: p.id, gap: nearest, action: p.action, actionT: p.actionT,
      intent: p.intent, crouch: rig.crouch, phase: sim.phase, ball: { x: sim.ball.x, y: sim.ball.y, z: sim.ball.z },
      playerPosition: { x: p.x, z: p.z }, hands: hands.map(hand => hand.toArray()),
      lastEvents: sim.events.slice(-2).map(e => ({ time: e.time, type: e.type, text: e.text })) };
    if (!worst || nearest > worst.gap) worst = item;
    if (nearest > .27) {
      gaps.push(item);
      if (!episode || episode.id !== p.id || tick !== episode.lastTick + 1) {
        episode = { id: p.id, player: p.name, from: sim.time, through: sim.time, count: 0, max: 0, lastTick: tick };
        episodes.push(episode);
      }
      episode.through = sim.time; episode.count++; episode.max = Math.max(episode.max, nearest); episode.lastTick = tick;
    }
  }
}
console.log(JSON.stringify({ seed, seconds, fixedHz: 60, heldTicks, checkedNodes,
  thresholdMeters: .27, ticksAboveThreshold: gaps.length, nonfiniteCount: nonfinite.length,
  worst, worstFive: gaps.slice().sort((a, b) => b.gap - a.gap).slice(0, 5),
  episodes: episodes.map(({ lastTick, ...rest }) => rest), nonfinite: nonfinite.slice(0, 10) }, null, 2));
if (nonfinite.length) process.exitCode = 1;
