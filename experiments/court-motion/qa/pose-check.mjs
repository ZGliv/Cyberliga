import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as Three from '../../../vendor/three/three.module.js';
import { createSimulation, stepSimulation, snapshot, FIXED_STEP } from '../sim.js';
import { createAthlete, updateAthlete } from '../rigs.js';

// Exercise the real main loop and rig geometry with only browser I/O stubbed.
// No WebGL context, browser, external server, or duplicated pose algorithm.
const source = (await readFile(new URL('../main.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '');
const main = new Function('THREE', 'createSimulation', 'stepSimulation', 'snapshot',
  'FIXED_STEP', 'createAthlete', 'updateAthlete', 'buildCourt', 'document', 'window',
  'location', 'performance', 'ResizeObserver', 'requestAnimationFrame', source);

function makeRuntime() {
  const elements = new Map();
  const element = () => ({
    style: {}, classList: { toggle() {} }, append() {}, addEventListener() {},
    getBoundingClientRect: () => ({ width: 390, height: 620 }), offsetWidth: 60,
    getContext: () => ({ fillText() {} }),
  });
  const document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, element());
      return elements.get(selector);
    },
    createElement: element, addEventListener() {},
  };
  // jerseyTexture uses the document in the imported rig module.
  globalThis.document = document;
  class Renderer {
    shadowMap = {};
    info = { render: { calls: 0, triangles: 0 } };
    setPixelRatio() {} setSize() {} render() {}
  }
  const window = { devicePixelRatio: 1 };
  let raf;
  main({ ...Three, WebGLRenderer: Renderer }, createSimulation, stepSimulation,
    snapshot, FIXED_STEP, createAthlete, updateAthlete, () => ({ goalNets: [] }),
    document, window, { search: '?seed=7' }, { now: () => 0 },
    class { observe() {} }, callback => { raf = callback; });
  return { window, frame: now => raf(now) };
}

test('same tick has identical athlete poses at 30, 60 and 120 display FPS', () => {
  const poses = [];
  const states = [];
  for (const fps of [30, 60, 120]) {
    const runtime = makeRuntime();
    for (let frame = 1; frame <= fps * 75; frame++) runtime.frame(frame * 1000 / fps);
    const pose = runtime.window.__courtMotionQA.pose;
    assert.equal(pose.ticks, 4500);
    poses.push(pose);
    states.push(JSON.parse(runtime.window.render_game_to_text()));
    // Extra display/resize-style draws must not move the cached gait.
    runtime.window.advanceTime(0);
    assert.deepEqual(runtime.window.__courtMotionQA.pose, pose);
  }
  assert.deepEqual(poses[0], poses[1]);
  assert.deepEqual(poses[1], poses[2]);
  assert.deepEqual(states[0], states[1]);
  assert.deepEqual(states[1], states[2]);
});

test('one manual advance matches the same elapsed fixed-step poses', () => {
  const single = makeRuntime();
  single.window.advanceTime(12000);
  const expected = single.window.__courtMotionQA.pose;
  const chunked = makeRuntime();
  for (let i = 0; i < 720; i++) chunked.window.advanceTime(FIXED_STEP * 1000);
  assert.deepEqual(chunked.window.__courtMotionQA.pose, expected);
});
