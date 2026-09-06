import * as THREE from '../../../vendor/three/three.module.js';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Read-only numerical motion diagnostic. Pin --ref=1748fc8 for the shaking
// baseline, or use --ref=working to compare current edits without a browser.
const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
const ref = args.ref || 'working';
const seconds = Number(args.seconds || 120);
const seed = args.seed || '7';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const readSource = async name => ref === 'working'
  ? readFile(path.join(root, 'experiments/court-motion', name), 'utf8')
  : execFileSync('git', ['show', `${ref}:experiments/court-motion/${name}`], { cwd: root, encoding: 'utf8' });
const loadSource = async name => {
  const source = (await readSource(name)).replace("'../../vendor/three/three.module.js'", JSON.stringify(new URL('../../../vendor/three/three.module.js', import.meta.url).href));
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
};
globalThis.document = { createElement: () => ({ getContext: () => ({ fillText() {} }) }) };
const { createSimulation, stepSimulation, FIXED_STEP } = await loadSource('sim.js');
const { createAthlete, updateAthlete } = await loadSource('rigs.js');
const sim = createSimulation(seed);
const scene = new THREE.Scene();
const rigs = sim.players.map(p => createAthlete(p, scene));
for (let i = 0; i < rigs.length; i++) updateAthlete(rigs[i], sim.players[i], sim.ball, 0, sim.time);
const history = new Map(), metrics = {};
const endOf = link => {
  link.updateMatrix();
  return new THREE.Vector3(0, .5, 0).applyMatrix4(link.matrix).toArray();
};
function measure(key, values, context, thresholds = [.04, .08, .15]) {
  const category = key.split(':')[0];
  const stat = metrics[category] ||= { samples: 0, max: 0, above: thresholds.map(threshold => ({ threshold, count: 0 })), reversals: 0, top: [] };
  const old = history.get(key);
  const delta = old ? values.map((v, i) => v - old.values[i]) : values.map(() => 0);
  const amount = Math.hypot(...delta);
  if (old) {
    stat.samples++;
    stat.max = Math.max(stat.max, amount);
    for (const count of stat.above) if (amount > count.threshold) count.count++;
    const priorAmount = Math.hypot(...old.delta);
    const cosine = delta.reduce((sum, d, i) => sum + d * old.delta[i], 0) / Math.max(1e-12, amount * priorAmount);
    if (amount > .015 && priorAmount > .015 && cosine < -.75) stat.reversals++;
    if (stat.top.length < 6 || amount > stat.top.at(-1).amount) {
      stat.top.push({ amount, joint: key, ...context, previous: old.context });
      stat.top.sort((a, b) => b.amount - a.amount); stat.top.length = Math.min(6, stat.top.length);
    }
  }
  history.set(key, { values, delta, context });
}
for (let tick = 0; tick < seconds / FIXED_STEP; tick++) {
  stepSimulation(sim, FIXED_STEP);
  for (let i = 0; i < rigs.length; i++) {
    const rig = rigs[i], p = sim.players[i];
    updateAthlete(rig, p, sim.ball, FIXED_STEP, sim.time);
    rig.root.updateMatrixWorld(true);
    const context = { time: sim.time, player: p.name, action: p.action, actionT:p.actionT, actionDuration:p.actionDuration, speed: Math.hypot(p.vx, p.vz), phase: rig.phase % (Math.PI * 2), intent: p.intent, owner: sim.ball.owner, ballMode:sim.ball.mode, targetId:sim.ball.targetId, ballDistance:Math.hypot(sim.ball.x-p.x,sim.ball.z-p.z), ballHeight:sim.ball.y, crouch: rig.crouch };
    const oldYaw = history.get(`yaw:${i}`)?.values[0];
    const unwrappedYaw = oldYaw === undefined ? p.facing : oldYaw + Math.atan2(Math.sin(p.facing - oldYaw), Math.cos(p.facing - oldYaw));
    measure(`yaw:${i}`, [unwrappedYaw], context, [.03, .06, .09]);
    measure(`body:${i}`, rig.body.position.toArray(), context);
    for (const leg of rig.legs) {
      const c = { ...context, swinging: leg.swinging };
      const key = `${i}:${leg.side}`;
      measure(`footLocal:${key}`, leg.shoe.position.toArray(), c);
      measure(`footWorld:${key}`, leg.shoe.getWorldPosition(new THREE.Vector3()).toArray(), c);
      measure(`kneeLocal:${key}`, endOf(leg.upper), c);
    }
    for (const arm of rig.arms) {
      const key = `${i}:${arm.side}`;
      measure(`handLocal:${key}`, arm.hand.position.toArray(), context);
      measure(`elbowLocal:${key}`, endOf(arm.upper), context);
    }
  }
}
const result = { ref, seed, seconds, hz: 1 / FIXED_STEP, metrics };
if (args.out) {
  const out = path.resolve(root, args.out);
  if (!out.startsWith(path.join(root, 'output') + path.sep) && !out.includes(`${path.sep}output${path.sep}`)) throw new Error('Diagnostic output must be in an ignored output directory');
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(result, null, 2));
}
console.log(JSON.stringify({ ref, seed, seconds, metrics: Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, { ...value, top: value.top.slice(0, 2) }])) }, null, 2));
