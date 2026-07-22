import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

delete globalThis.CyberligaBasketballVisualReset;
await import('./basketball-visual-reset.js?basketball-visual-reset-tests');
const Timeline = globalThis.CyberligaBasketballVisualReset;
const source = await readFile(new URL('./basketball-visual-reset.js', import.meta.url), 'utf8');

const STOOPY_ID = 'new-york-brownstones-a1';
const LINTEL_ID = 'new-york-brownstones-a2';
const PARKA_ID = 'toronto-lake-effect-a2';
const TOQUE_ID = 'toronto-lake-effect-a4';

function actorAt(sample, id) {
  const actor = sample.actors.find(candidate => candidate.id === id);
  assert.ok(actor, `missing actor ${id}`);
  return actor;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function assertDeepFrozen(value, path = 'value', seen = new WeakSet()) {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return;
  if (seen.has(value)) return;
  seen.add(value);
  assert.ok(Object.isFrozen(value), `${path} must be frozen`);
  for (const key of Object.keys(value)) assertDeepFrozen(value[key], `${path}.${String(key)}`, seen);
}

function assertFiniteNumbers(value, path = 'value', seen = new WeakSet()) {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path} must be finite; received ${value}`);
    return;
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) assertFiniteNumbers(value[key], `${path}.${String(key)}`, seen);
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function betweenHands(actor) {
  const mean = key => Number(((actor.anchors.leftHand[key] + actor.anchors.rightHand[key]) / 2).toFixed(4));
  return { x: mean('x'), y: mean('y'), z: mean('z') };
}

test('exports a pure UMD and Node-importable, deeply frozen public API', () => {
  assert.ok(Timeline);
  assert.equal(Timeline.version, '1.0.0');
  assert.equal(Timeline.durationMs, 15000);
  assertDeepFrozen(Timeline, 'Timeline');
  assertDeepFrozen(Timeline.sample(0), 'sample');

  const context = { module: { exports: {} }, exports: {} };
  vm.runInNewContext(source, context, { filename: 'basketball-visual-reset.js' });
  assert.equal(context.module.exports.version, Timeline.version);
  assert.equal(context.module.exports.durationMs, Timeline.durationMs);
  assert.equal(JSON.stringify(context.module.exports.sample(8350)), JSON.stringify(Timeline.sample(8350)));

  for (const forbidden of [
    /Math\.random\s*\(/, /\bDate\b/, /\bperformance\b/, /\bdocument\b/, /\bwindow\b/,
    /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bsetTimeout\b/, /\bsetInterval\b/
  ]) assert.doesNotMatch(source, forbidden);
});

test('publishes exactly ten canonical New York and Toronto actors with Stoopy and Toque exact', () => {
  const expected = [
    'new-york-brownstones-a1', 'new-york-brownstones-a2', 'new-york-brownstones-a3',
    'new-york-brownstones-a4', 'new-york-brownstones-a5', 'toronto-lake-effect-a1',
    'toronto-lake-effect-a2', 'toronto-lake-effect-a3', 'toronto-lake-effect-a4',
    'toronto-lake-effect-a5'
  ];
  assert.deepEqual(Timeline.actorIds, expected);
  assert.equal(Timeline.actors.length, 10);
  assert.equal(new Set(Timeline.actorIds).size, 10);
  assert.equal(Timeline.actors.find(actor => actor.id === STOOPY_ID).name, 'Stoopy');
  assert.equal(Timeline.actors.find(actor => actor.id === TOQUE_ID).name, 'Toque');
  assert.equal(Timeline.actors.filter(actor => actor.teamId === 'new-york-brownstones').length, 5);
  assert.equal(Timeline.actors.filter(actor => actor.teamId === 'toronto-lake-effect').length, 5);
  assert.equal(Timeline.coordinateSystem.origin, 'center-court');
  assert.deepEqual(Timeline.coordinateSystem.attackingRim, { x: 42, y: 0, z: 10 });
});

test('the 15-second phase clock and broadcast camera order are explicit and contiguous', () => {
  assert.equal(Timeline.phases[0].startMs, 0);
  assert.equal(Timeline.phases.at(-1).endMs, Timeline.durationMs);
  Timeline.phases.forEach((phase, index) => {
    assert.equal(phase.index, index);
    if (index) assert.equal(phase.startMs, Timeline.phases[index - 1].endMs);
    assert.equal(Timeline.sample(phase.startMs).phase.id, phase.id);
    assert.equal(Timeline.sample(phase.endMs - 1).phase.id, phase.id);
  });

  assert.deepEqual(Timeline.cameraBeats.map(beat => beat.id), [
    'tactical-master', 'motivated-tightening', 'consequence-reframe', 'reset-master'
  ]);
  Timeline.cameraBeats.forEach((beat, index) => {
    if (index) assert.equal(beat.startMs, Timeline.cameraBeats[index - 1].endMs);
    assert.equal(Timeline.sample(beat.startMs).camera.id, beat.id);
    assert.equal(Timeline.sample(beat.startMs).camera.cut, beat.transition === 'cut');
    if (beat.endMs - beat.startMs > 1) assert.equal(Timeline.sample(beat.startMs + 1).camera.cut, false);
  });
  assert.equal(Timeline.cameraBeats.at(-1).endMs, Timeline.durationMs);
  const beforeTightening = Timeline.sample(4799.999).camera;
  const tighteningStart = Timeline.sample(4800).camera;
  const catchComposition = Timeline.sample(6100);
  const riseComposition = Timeline.sample(7200);
  const finishComposition = Timeline.sample(8200).camera;
  const rimComposition = Timeline.sample(8350).camera;
  const pullbackComposition = Timeline.sample(8800).camera;
  const landingComposition = Timeline.sample(9100).camera;
  assert.equal(tighteningStart.transition, 'move');
  assert.equal(tighteningStart.cut, false);
  assert.ok(distance(beforeTightening.position, tighteningStart.position) < .001);
  assert.deepEqual(tighteningStart.position, { x: 3, y: -48, z: 18 });
  assert.equal(tighteningStart.fov, 42);
  assert.deepEqual(catchComposition.camera.position, { x: 15, y: -37, z: 15 });
  assert.deepEqual(catchComposition.camera.lookAt, { x: 23, y: 0, z: 4.5 });
  assert.equal(catchComposition.camera.fov, 39);
  assert.ok(Math.abs(catchComposition.camera.lookAt.x - catchComposition.ball.position.x) < 2,
    'camera catch waypoint must follow the actual ball');
  assert.ok(Math.abs(riseComposition.camera.lookAt.x - riseComposition.ball.position.x) < 2,
    'camera tightening must continue to follow the rising ball');
  assert.deepEqual(finishComposition.position, { x: 31, y: -19, z: 5.8 });
  assert.equal(finishComposition.fov, 37);
  assert.deepEqual(rimComposition.position, finishComposition.position);
  assert.deepEqual(rimComposition.lookAt, finishComposition.lookAt);
  assert.deepEqual(pullbackComposition.position, { x: 29, y: -24, z: 8.5 });
  assert.equal(pullbackComposition.cut, false);
  assert.deepEqual(landingComposition.position, { x: 27, y: -31, z: 13 });
  assert.deepEqual(landingComposition.lookAt, { x: 39.5, y: .5, z: 3.2 });
  assert.equal(landingComposition.fov, 42);
  assert.equal(landingComposition.cut, false);
  assert.deepEqual(Timeline.sample(9799).camera.position, landingComposition.position);
  assert.equal(Timeline.sample(8350).camera.cut, false);
  assert.equal(Timeline.sample(9100).camera.cut, false);
  assert.equal(Timeline.sample(9800).camera.cut, true);

  assert.equal(Timeline.sample(14999).phase.id, 'reset-cut');
  assert.equal(Timeline.sample(15000).phase.id, 'setup');
  assert.equal(Timeline.sample(15000).loop, 1);
  assert.equal(Timeline.sample(-1).timeMs, 14999);
  assert.equal(Timeline.sample(Number.NaN).timeMs, 0);
  assert.equal(Timeline.sample(Number.POSITIVE_INFINITY).timeMs, 0);
});

test('named milestones describe the exact Stoop Drop physical chain', () => {
  assert.deepEqual(Timeline.milestones, {
    firstDribbleFloorMs: 300,
    firstDribbleHandMs: 600,
    secondDribbleFloorMs: 900,
    secondDribbleHandMs: 1200,
    setupEndMs: 1200,
    screenContactMs: 3000,
    screenReleaseMs: 3800,
    passReleaseMs: 5000,
    pocketCatchMs: 6100,
    gatherStartMs: 6500,
    rightHandGatherMs: 6750,
    takeoffMs: 7200,
    rimApproachMs: 8200,
    rimCrossingMs: 8350,
    scoreCertifiedMs: 8500,
    crowdFirstReactionMs: 8500,
    landingMs: 9100,
    baselineSecondJumpReadyMs: 9600,
    stoopySecondJumpReadyMs: 10060,
    lateRecoveryCostMs: 460,
    consequenceEndMs: 11600,
    lowerThirdMs: 12600,
    lowerThirdClearMs: 14400,
    resetCutMs: 14500,
    loopEndMs: 15000
  });

  const beforeScreen = Timeline.sample(2999);
  const atScreen = Timeline.sample(3000);
  const peakScreen = Timeline.sample(3300);
  assert.equal(beforeScreen.contacts.screen.occurred, false);
  assert.equal(atScreen.contacts.screen.active, true);
  assert.equal(atScreen.contacts.screen.screenerId, STOOPY_ID);
  assert.equal(atScreen.contacts.screen.defenderId, PARKA_ID);
  assert.equal(actorAt(atScreen, STOOPY_ID).state.screening, true);
  assert.equal(actorAt(atScreen, PARKA_ID).state.screened, true);
  assert.equal(peakScreen.contacts.screen.intensity, 1);
  assert.deepEqual(atScreen.contacts.screen.colliderDepthRadii, { screener: .375, defender: .25 });
  assert.ok(atScreen.contacts.screen.surfaceGap < .02,
    `screen contact gap is too large: ${atScreen.contacts.screen.surfaceGap}`);
  for (let timeMs = 3000; timeMs <= 3100; timeMs += 10) {
    const screen = Timeline.sample(timeMs).contacts.screen;
    assert.equal(screen.surfaceContact, true);
    assert.ok(screen.centerDistance >= screen.minimumCenterDistance - .001);
    assert.ok(screen.centerDistance <= screen.minimumCenterDistance + .02);
  }
  for (let timeMs = 3000; timeMs < 3800; timeMs += 20) {
    const screen = Timeline.sample(timeMs).contacts.screen;
    assert.ok(screen.centerDistance >= screen.minimumCenterDistance,
      `screen bodies overlap at ${timeMs}ms: ${screen.centerDistance} < ${screen.minimumCenterDistance}`);
  }
  assert.ok(actorAt(Timeline.sample(3799), PARKA_ID).position.y < actorAt(atScreen, PARKA_ID).position.y - 1.5,
    'Parka must visibly lose a lateral half-step after contact');

  const atCatch = Timeline.sample(6100);
  assert.equal(atCatch.contacts.catch.active, true);
  assert.equal(atCatch.contacts.catch.passerId, LINTEL_ID);
  assert.equal(atCatch.contacts.catch.receiverId, STOOPY_ID);
  assert.equal(atCatch.contacts.catch.anchor, 'bothHands');
  assert.deepEqual(atCatch.contacts.catch.point, betweenHands(actorAt(atCatch, STOOPY_ID)));
  assert.equal(Timeline.sample(8350).contacts.rim.crossed, true);
  const finishState = Timeline.sample(8350);
  const flurry = actorAt(finishState, 'toronto-lake-effect-a1');
  const toque = actorAt(finishState, TOQUE_ID);
  assert.ok(Math.hypot(flurry.position.x - toque.position.x, flurry.position.y - toque.position.y) > 6);
  assert.equal(flurry.position.z, 0);
  assert.equal(flurry.state.contesting, false);
  assert.equal(toque.state.contesting, true);
  assert.equal(Timeline.sample(9100).contacts.landing.occurred, true);
});

test('ball stays on exact hand anchors, flies through the pocket, and releases only at the rim plane', () => {
  const opening = [0, 300, 600, 900, 1200].map(timeMs => Timeline.sample(timeMs));
  assert.deepEqual(opening.map(state => state.ball.state), [
    'dribble-hand', 'dribble-floor', 'dribble-hand', 'dribble-floor', 'dribble-hand'
  ]);
  assert.deepEqual(opening.map(state => state.ball.dribbleIndex), [1, 1, 1, 2, 2]);
  for (const index of [0, 2, 4]) {
    assert.equal(opening[index].ball.ownerId, LINTEL_ID);
    assert.equal(opening[index].ball.contact.type, 'hand');
    assert.deepEqual(opening[index].ball.position, actorAt(opening[index], LINTEL_ID).anchors.rightHand);
  }
  for (const index of [1, 3]) {
    assert.equal(opening[index].ball.ownerId, LINTEL_ID);
    assert.equal(opening[index].ball.contact.type, 'floor');
    assert.equal(opening[index].ball.position.z, .24);
  }
  for (const timeMs of [150, 450, 750, 1050]) {
    const state = Timeline.sample(timeMs);
    assert.equal(state.ball.ownerId, LINTEL_ID);
    assert.equal(state.ball.contact.type, 'none');
  }

  for (const timeMs of [1201, 2999, 3800, 4999]) {
    const state = Timeline.sample(timeMs);
    assert.equal(state.ball.state, 'controlled');
    assert.equal(state.ball.ownerId, LINTEL_ID);
    assert.equal(state.ball.contact.type, 'hand');
    assert.deepEqual(state.ball.position, actorAt(state, LINTEL_ID).anchors.rightHand);
  }

  const release = Timeline.sample(5000);
  assert.equal(release.ball.state, 'pass-flight');
  assert.equal(release.ball.ownerId, null);
  assert.equal(release.ball.contact.type, 'none');
  assert.deepEqual(release.ball.position, actorAt(release, LINTEL_ID).anchors.rightHand);

  const flight = Timeline.sample(5550);
  assert.equal(flight.ball.state, 'pass-flight');
  assert.equal(flight.ball.ownerId, null);
  assert.ok(flight.ball.position.x > release.ball.position.x);
  assert.ok(flight.ball.position.z > release.ball.position.z);

  const catchState = Timeline.sample(6100);
  assert.equal(catchState.ball.state, 'caught');
  assert.equal(catchState.ball.ownerId, STOOPY_ID);
  assert.equal(catchState.ball.hand, 'both');
  assert.equal(catchState.ball.contact.type, 'two-hand');
  assert.deepEqual(catchState.ball.position, betweenHands(actorAt(catchState, STOOPY_ID)));
  assert.ok(distance(Timeline.sample(6099.999).ball.position, catchState.ball.position) < .001);

  const settledCatch = Timeline.sample(6499);
  assert.equal(settledCatch.ball.state, 'caught');
  assert.equal(settledCatch.ball.hand, 'both');
  assert.equal(settledCatch.ball.contact.type, 'two-hand');
  const yieldState = Timeline.sample(6500);
  assert.equal(yieldState.ball.state, 'gather');
  assert.equal(yieldState.ball.hand, 'both');
  assert.equal(yieldState.ball.contact.type, 'two-hand-yield');

  for (const [timeMs, expectedState] of [[6750, 'gather'], [7199, 'gather'], [7200, 'dunk-control'], [8349, 'dunk-control']]) {
    const state = Timeline.sample(timeMs);
    assert.equal(state.ball.state, expectedState);
    assert.equal(state.ball.ownerId, STOOPY_ID);
    assert.deepEqual(state.ball.position, actorAt(state, STOOPY_ID).anchors.rightHand);
  }

  const crossing = Timeline.sample(8350);
  assert.equal(crossing.ball.state, 'rim-crossing');
  assert.equal(crossing.ball.ownerId, null);
  assert.equal(crossing.ball.contact.type, 'rim-plane');
  assert.deepEqual(crossing.ball.position, Timeline.coordinateSystem.attackingRim);
  assert.ok(distance(Timeline.sample(8349.999).ball.position, crossing.ball.position) < .001);

  let minimumHeadClearance = Number.POSITIVE_INFINITY;
  let minimumTorsoClearance = Number.POSITIVE_INFINITY;
  for (let timeMs = 8500; timeMs <= 9600; timeMs += 5) {
    const state = Timeline.sample(timeMs);
    const stoopy = actorAt(state, STOOPY_ID);
    const torsoCenter = { x: stoopy.position.x + .2, y: stoopy.position.y, z: stoopy.position.z + 2.1 };
    minimumHeadClearance = Math.min(minimumHeadClearance, distance(state.ball.position, stoopy.anchors.head));
    minimumTorsoClearance = Math.min(minimumTorsoClearance, distance(state.ball.position, torsoCenter));
  }
  assert.ok(minimumHeadClearance > 2.2, `post-net ball/head clearance is ${minimumHeadClearance}`);
  assert.ok(minimumTorsoClearance > 2.5, `post-net ball/torso clearance is ${minimumTorsoClearance}`);
  assert.ok(Timeline.sample(9100).ball.position.x > actorAt(Timeline.sample(9100), STOOPY_ID).position.x + 2.5,
    'landing ball must clear Stoopy toward the baseline');

  let maximumVisibleStep = 0;
  for (let timeMs = 0; timeMs < Timeline.milestones.resetCutMs; timeMs += 5) {
    const from = Timeline.sample(timeMs).ball;
    const to = Timeline.sample(Math.min(timeMs + 5, Timeline.milestones.resetCutMs)).ball;
    if (from.visible && to.visible) maximumVisibleStep = Math.max(maximumVisibleStep, distance(from.position, to.position));
  }
  assert.ok(maximumVisibleStep < .14, `visible ball moved ${maximumVisibleStep} court-feet in 5ms`);
});

test('the score certifies after—not at or before—the physical rim crossing', () => {
  const beforeCrossing = Timeline.sample(8349.999);
  const crossing = Timeline.sample(8350);
  const beforeCertification = Timeline.sample(8499.999);
  const certification = Timeline.sample(8500);
  const resetCut = Timeline.sample(14999);

  for (const state of [beforeCrossing, crossing, beforeCertification]) {
    assert.equal(state.score.home.points, 18);
    assert.equal(state.score.playPoints, 0);
    assert.equal(state.score.certified, false);
  }
  assert.equal(crossing.contacts.rim.crossed, true);
  assert.equal(certification.score.home.points, 20);
  assert.equal(certification.score.playPoints, 2);
  assert.equal(certification.score.certified, true);
  assert.equal(certification.score.official, false);
  assert.equal(certification.score.certifiedAtMs - Timeline.milestones.rimCrossingMs, 150);
  assert.equal(Timeline.sample(8499).presentation.crowdReaction, 0);
  assert.ok(Timeline.sample(8505).presentation.crowdReaction > 0);
  assert.equal(resetCut.score.home.points, 20, 'reset blackout may not roll back the completed possession early');
});

test('Stoopy pays the authored 460ms late-recovery cost after the heavy landing', () => {
  const beforeLanding = Timeline.sample(9099);
  const landing = Timeline.sample(9100);
  const baselineReady = Timeline.sample(9600);
  const oneMillisecondEarly = Timeline.sample(10059);
  const actualReady = Timeline.sample(10060);

  assert.equal(actorAt(beforeLanding, STOOPY_ID).state.secondJumpReady, true);
  assert.equal(landing.consequence.active, true);
  assert.equal(landing.contacts.landing.occurred, true);
  assert.equal(actorAt(landing, STOOPY_ID).state.recovering, true);
  assert.equal(baselineReady.consequence.delayedByMs, 460);
  assert.equal(baselineReady.consequence.actualReadyAtMs - baselineReady.consequence.baselineReadyAtMs, 460);
  assert.equal(baselineReady.consequence.toqueRecovered, true);
  assert.equal(baselineReady.consequence.secondJumpRequested, true);
  assert.equal(baselineReady.consequence.secondJumpReady, false);
  assert.equal(actorAt(baselineReady, TOQUE_ID).state.secondJumpReady, true);
  assert.equal(actorAt(baselineReady, STOOPY_ID).state.secondJumpReady, false);
  assert.equal(oneMillisecondEarly.consequence.secondJumpReady, false);
  assert.equal(actualReady.consequence.secondJumpReady, true);
  assert.equal(actorAt(actualReady, STOOPY_ID).state.recovering, false);
  assert.equal(actorAt(actualReady, STOOPY_ID).state.secondJumpReady, true);
});

test('impact and lower-third presentation happen after the readable action, never over it', () => {
  assert.equal(Timeline.sample(8200).camera.id, 'motivated-tightening');
  assert.equal(Timeline.sample(8350).impact.id, 'rim-finish');
  assert.equal(Timeline.sample(8500).camera.id, 'motivated-tightening');
  assert.equal(Timeline.sample(9100).camera.id, 'motivated-tightening');
  assert.equal(Timeline.sample(9099).impact.id, 'heavy-landing');
  assert.equal(Timeline.sample(9800).camera.id, 'consequence-reframe');
  assert.equal(Timeline.sample(12599).presentation.lowerThird.visible, false);
  assert.equal(Timeline.sample(12600).presentation.lowerThird.visible, true);
  assert.equal(Timeline.sample(13000).presentation.lowerThird.opacity, 1);
  assert.equal(Timeline.sample(13000).presentation.lowerThird.title, 'THE STOOP DROP');
  assert.equal(Timeline.sample(13000).presentation.lowerThird.official, false);
  assert.ok(Timeline.sample(14180).presentation.lowerThird.opacity > 0);
  assert.ok(Timeline.sample(14180).presentation.lowerThird.opacity < 1);
  assert.equal(Timeline.sample(14400).presentation.lowerThird.opacity, 0);
  assert.equal(Timeline.sample(14500).presentation.lowerThird.visible, false);
  assert.equal(Timeline.sample(14500).ball.visible, false);
});

test('every sampled number is finite and the canonical sample sequence is byte-stable', () => {
  for (let timeMs = -15000; timeMs <= 30000; timeMs += 137) {
    const state = Timeline.sample(timeMs);
    assertFiniteNumbers(state, `sample(${timeMs})`);
    assert.equal(state.actors.length, 10);
    assert.equal(new Set(state.actors.map(actor => actor.id)).size, 10);
  }

  const sampleTimes = [
    0, 1200, 2999, 3000, 3300, 3800, 4800, 4999, 5000, 5550, 6099, 6100,
    6500, 7200, 8200, 8349, 8350, 8499, 8500, 9000, 9100, 9600, 10059,
    10060, 11600, 12600, 13000, 14180, 14400, 14499, 14500, 14999
  ];
  const first = sampleTimes.map(timeMs => Timeline.sample(timeMs));
  const second = sampleTimes.map(timeMs => Timeline.sample(timeMs));
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(digest(first), 'a17191c87ef2b51a16bccd2c34a0b8c716874817b0e6df1162f2b9bf80d52433');
});
