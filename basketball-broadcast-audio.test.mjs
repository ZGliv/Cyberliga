import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const moduleUrl = new URL('./basketball-broadcast-audio.js', import.meta.url);
const source = await readFile(moduleUrl, 'utf8');

delete globalThis.CyberligaBasketballBroadcastAudio;
await import(`${moduleUrl.href}?test-runtime=1`);
const Audio = globalThis.CyberligaBasketballBroadcastAudio;

delete globalThis.CyberligaBasketballVisualReset;
delete globalThis.CyberligaBasketballBroadcastDirector;
await import(new URL('./basketball-visual-reset.js?audio-director-test=1', import.meta.url));
await import(new URL('./basketball-broadcast-director.js?audio-director-test=1', import.meta.url));
const Director = globalThis.CyberligaBasketballBroadcastDirector;

function directorSample({
  timeMs = 0,
  loop = 0,
  phase = 'live',
  phaseIndex = 0,
  ballState = 'held',
  ballContact = 'hand',
  dribbleIndex = 0,
  ownerId = 'brownstones-a1',
  contacts = {},
  scoreCertified = false,
  gameClockSeconds = 120,
  replay = null,
  activeCueIds = [],
  crowdReaction = 0,
  whistle = false,
  horn = false
} = {}) {
  return {
    version: 'test-director-1',
    timeMs,
    loop,
    phase: { id: phase, index: phaseIndex },
    ball: {
      state: ballState,
      dribbleIndex,
      ownerId,
      position: { x: 4, y: -12, z: ballContact === 'floor' ? 0.12 : 1.1 },
      contact: { type: ballContact }
    },
    contacts,
    score: {
      certified: scoreCertified,
      playPoints: scoreCertified ? 2 : 0,
      eventId: 'stoop-drop-score-001'
    },
    whistle,
    horn,
    presentation: { crowdReaction },
    broadcast: {
      clock: { gameClockSeconds },
      replay: replay || {
        active: false,
        sourceEventId: null,
        recordedFootage: false
      },
      audio: { activeCueIds }
    }
  };
}

function cueTypes(cues) {
  return cues.map((cue) => cue.type);
}

function runSignature(sequence) {
  const planner = Audio.createCuePlanner();
  return sequence.map(({ sample, options }) => planner.consume(sample, options));
}

class FakeAudioParam {
  constructor(context, label, value = 0) {
    this.context = context;
    this.label = label;
    this.value = value;
    this.events = [];
    context.params.push(this);
  }

  record(method, value, time, extra) {
    this.value = value;
    this.events.push({ method, value, time, extra });
  }

  setValueAtTime(value, time) {
    this.record('setValueAtTime', value, time);
  }

  linearRampToValueAtTime(value, time) {
    this.record('linearRampToValueAtTime', value, time);
  }

  exponentialRampToValueAtTime(value, time) {
    this.record('exponentialRampToValueAtTime', value, time);
  }

  setTargetAtTime(value, time, constant) {
    this.record('setTargetAtTime', value, time, constant);
  }
}

class FakeNode {
  constructor(context, kind) {
    this.context = context;
    this.kind = kind;
    this.connections = [];
    this.disconnected = false;
    context.nodes.push(this);
  }

  connect(destination) {
    this.connections.push(destination);
    return destination;
  }

  disconnect() {
    this.disconnected = true;
  }
}

class FakeScheduledSource extends FakeNode {
  constructor(context, kind) {
    super(context, kind);
    this.started = false;
    this.stopped = false;
    this.startTimes = [];
    this.stopTimes = [];
    this.onended = null;
    context.sources.push(this);
  }

  start(time) {
    this.started = true;
    this.startTimes.push(time);
  }

  stop(time) {
    this.stopped = true;
    this.stopTimes.push(time);
  }
}

class FakeBuffer {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.data = Array.from({ length: channels }, () => new Float32Array(length));
  }

  getChannelData(channel) {
    return this.data[channel];
  }
}

class FakeAudioContext {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 4;
    this.sampleRate = 8000;
    this.nodes = [];
    this.sources = [];
    this.params = [];
    this.buffers = [];
    this.resumeCount = 0;
    this.closeCount = 0;
    this.destination = new FakeNode(this, 'destination');
  }

  createGain() {
    const node = new FakeNode(this, 'gain');
    node.gain = new FakeAudioParam(this, 'gain', 1);
    return node;
  }

  createDynamicsCompressor() {
    const node = new FakeNode(this, 'compressor');
    node.threshold = new FakeAudioParam(this, 'compressor.threshold', -24);
    node.knee = new FakeAudioParam(this, 'compressor.knee', 30);
    node.ratio = new FakeAudioParam(this, 'compressor.ratio', 12);
    node.attack = new FakeAudioParam(this, 'compressor.attack', 0.003);
    node.release = new FakeAudioParam(this, 'compressor.release', 0.25);
    return node;
  }

  createStereoPanner() {
    const node = new FakeNode(this, 'panner');
    node.pan = new FakeAudioParam(this, 'pan', 0);
    return node;
  }

  createOscillator() {
    const node = new FakeScheduledSource(this, 'oscillator');
    node.type = 'sine';
    node.frequency = new FakeAudioParam(this, 'frequency', 440);
    node.detune = new FakeAudioParam(this, 'detune', 0);
    return node;
  }

  createBufferSource() {
    const node = new FakeScheduledSource(this, 'buffer-source');
    node.buffer = null;
    node.loop = false;
    return node;
  }

  createBiquadFilter() {
    const node = new FakeNode(this, 'filter');
    node.type = 'lowpass';
    node.frequency = new FakeAudioParam(this, 'filter.frequency', 350);
    node.Q = new FakeAudioParam(this, 'filter.Q', 1);
    return node;
  }

  createBuffer(channels, length, sampleRate) {
    const buffer = new FakeBuffer(channels, length, sampleRate);
    this.buffers.push(buffer);
    return buffer;
  }

  resume() {
    this.resumeCount += 1;
    this.state = 'running';
    return Promise.resolve();
  }

  close() {
    this.closeCount += 1;
    this.state = 'closed';
    return Promise.resolve();
  }
}

test('exports a frozen browser/UMD and CommonJS-safe pure API without network or random timing', () => {
  assert.ok(Audio);
  assert.equal(Audio.version, '1.0.0');
  assert.deepEqual(Audio.cueTypes, [
    'shoe-squeak',
    'ball-bounce',
    'screen-contact',
    'body-contact',
    'pass',
    'catch',
    'rim',
    'net',
    'whistle',
    'score-stinger',
    'crowd-swell',
    'replay-transition',
    'tension-pulse',
    'horn'
  ]);
  assert.ok(Object.isFrozen(Audio));
  assert.ok(Object.isFrozen(Audio.cueTypes));
  assert.equal(typeof Audio.deriveCues, 'function');
  assert.equal(typeof Audio.createCuePlanner, 'function');
  assert.equal(typeof Audio.createBroadcastAudio, 'function');

  const commonJsContext = vm.createContext({ module: { exports: {} }, exports: {} });
  vm.runInContext(source, commonJsContext, { filename: 'basketball-broadcast-audio.js' });
  assert.equal(commonJsContext.module.exports.version, Audio.version);
  assert.equal(typeof commonJsContext.module.exports.createBroadcastAudio, 'function');

  assert.doesNotMatch(source, /Math\.random/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest|WebSocket/);
  assert.doesNotMatch(source, /setTimeout|setInterval|requestAnimationFrame/);
  assert.doesNotMatch(source, /\bdocument\b/);
});

test('derives the live possession sound chain once, in causal broadcast order', () => {
  const planner = Audio.createCuePlanner();
  const continuous = { continuous: true };

  const samples = [
    directorSample({ timeMs: 0 }),
    directorSample({ timeMs: 300, ballContact: 'floor', dribbleIndex: 0 }),
    directorSample({ timeMs: 600, ballContact: 'hand', dribbleIndex: 0 }),
    directorSample({ timeMs: 900, ballContact: 'floor', dribbleIndex: 1 }),
    directorSample({ timeMs: 1200, phase: 'turn-corner', phaseIndex: 1 }),
    directorSample({
      timeMs: 3000,
      phase: 'turn-corner',
      phaseIndex: 1,
      contacts: {
        screen: {
          id: 'screen-001',
          active: true,
          occurred: true,
          surfaceContact: true,
          screenerId: 'brownstones-a2',
          point: { x: -2, y: -7, z: 1 },
          intensity: 0.72
        }
      }
    }),
    directorSample({ timeMs: 5000, phase: 'turn-corner', phaseIndex: 1, ballState: 'pass-flight' }),
    directorSample({
      timeMs: 6100,
      phase: 'turn-corner',
      phaseIndex: 1,
      ballState: 'caught',
      ownerId: 'brownstones-a1',
      contacts: {
        catch: {
          id: 'catch-001',
          active: true,
          occurred: true,
          receiverId: 'brownstones-a1',
          point: { x: 6, y: -18, z: 1.2 }
        }
      }
    }),
    directorSample({ timeMs: 7200, phase: 'rise', phaseIndex: 2 }),
    directorSample({
      timeMs: 8350,
      phase: 'rise',
      phaseIndex: 2,
      ballContact: 'rim-plane',
      contacts: {
        rim: {
          id: 'rim-001',
          crossed: true,
          athleteId: 'brownstones-a1',
          point: { x: 11, y: -24, z: 3.05 }
        }
      }
    }),
    directorSample({
      timeMs: 8500,
      phase: 'rise',
      phaseIndex: 2,
      ballContact: 'net',
      scoreCertified: true,
      crowdReaction: 0.9
    }),
    directorSample({
      timeMs: 9100,
      phase: 'landing',
      phaseIndex: 3,
      scoreCertified: true,
      contacts: {
        landing: {
          id: 'landing-001',
          active: true,
          occurred: true,
          athleteId: 'brownstones-a1',
          point: { x: 10.5, y: -22, z: 0 },
          load: 0.9
        }
      }
    })
  ];

  const emitted = samples.map((sample) => planner.consume(sample, continuous));
  assert.deepEqual(emitted.map(cueTypes), [
    [],
    ['ball-bounce'],
    [],
    ['ball-bounce'],
    ['shoe-squeak'],
    ['screen-contact'],
    ['pass'],
    ['catch'],
    ['shoe-squeak'],
    ['rim'],
    ['net', 'score-stinger', 'crowd-swell'],
    ['shoe-squeak', 'body-contact']
  ]);

  emitted.flat().forEach((cue) => {
    assert.ok(Object.isFrozen(cue));
    assert.ok(cue.gain >= 0 && cue.gain <= Audio.maxCueGain);
    assert.ok(cue.pan >= -1 && cue.pan <= 1);
  });
  assert.equal(planner.consume(samples.at(-1), continuous).length, 0);
});

test('deduplicates explicit cue objects by loop, type, and event while preserving priority order', () => {
  const planner = Audio.createCuePlanner();
  const allAtOnce = [
    { type: 'horn', eventId: 'shared-moment', atMs: 100, gain: 99 },
    { type: 'crowd-swell', eventId: 'shared-moment', atMs: 100 },
    { type: 'ball-bounce', eventId: 'shared-moment', atMs: 100, position: { x: 0, y: 25, z: 0 } },
    { type: 'shoe-squeak', eventId: 'shared-moment', atMs: 100 },
    { type: 'score-stinger', eventId: 'shared-moment', atMs: 100 }
  ];
  const first = planner.consume(allAtOnce);

  assert.deepEqual(cueTypes(first), [
    'shoe-squeak',
    'ball-bounce',
    'score-stinger',
    'crowd-swell',
    'horn'
  ]);
  assert.equal(first.find((cue) => cue.type === 'horn').gain, Audio.maxCueGain);
  assert.equal(first.find((cue) => cue.type === 'ball-bounce').pan, -1);
  assert.deepEqual(planner.consume(allAtOnce), []);
  assert.equal(planner.state().seenCount, allAtOnce.length);
});

test('director-named cues override transition inference instead of doubling the same sound', () => {
  const planner = Audio.createCuePlanner();
  planner.consume(directorSample({ timeMs: 0 }));
  const namedBounce = planner.consume(directorSample({
    timeMs: 300,
    ballContact: 'floor',
    dribbleIndex: 1,
    activeCueIds: ['ball-bounce:stoop-dribble-01']
  }));

  assert.deepEqual(cueTypes(namedBounce), ['ball-bounce']);
  assert.equal(namedBounce[0].eventId, 'ball-bounce:stoop-dribble-01');
  assert.equal(namedBounce[0].source, 'director-explicit');
  assert.deepEqual(planner.consume(directorSample({
    timeMs: 310,
    ballContact: 'floor',
    dribbleIndex: 1,
    activeCueIds: ['ball-bounce:stoop-dribble-01']
  })), []);
});

test('resolves the canonical director catalogue into playable cue families without double hits', () => {
  assert.ok(Director);
  assert.equal(Director.durationMs, 90000);
  const planner = Audio.createCuePlanner({ cueCatalogue: Director.audioCues });

  function enter(id) {
    const descriptor = Director.audioCues.find((cue) => cue.id === id);
    assert.ok(descriptor, `missing director cue ${id}`);
    planner.seek(Director.sample(descriptor.atMs - 1));
    return planner.consume(Director.sample(descriptor.atMs), { continuous: true });
  }

  assert.deepEqual(cueTypes(enter('stoop-dribble-1')), ['ball-bounce']);
  assert.deepEqual(cueTypes(enter('stoop-screen')), ['screen-contact']);
  assert.deepEqual(cueTypes(enter('stoop-rim')), ['rim']);
  assert.deepEqual(cueTypes(enter('replay-in')), ['replay-transition']);
  assert.deepEqual(cueTypes(enter('whiteout-release')), ['shoe-squeak']);
  assert.deepEqual(cueTypes(enter('switch-deflection')), ['catch']);
  assert.deepEqual(cueTypes(enter('switch-certified')), ['crowd-swell']);
  assert.deepEqual(cueTypes(enter('block-release')), ['pass']);
  assert.deepEqual(cueTypes(enter('toque-block')), ['body-contact']);
  assert.deepEqual(cueTypes(enter('stoopy-board')), ['catch']);
  assert.deepEqual(cueTypes(enter('putback-takeoff')), ['shoe-squeak']);
  assert.deepEqual(cueTypes(enter('putback-rim')), ['rim']);
  assert.deepEqual(cueTypes(enter('putback-score')), ['net', 'score-stinger', 'crowd-swell']);
  assert.deepEqual(cueTypes(enter('putback-landing')), ['body-contact']);
  assert.deepEqual(enter('switch-call'), []);
});

test('zero-point certified outcomes never receive a score stinger', () => {
  const planner = Audio.createCuePlanner({ cueCatalogue: Director.audioCues });
  planner.seek(Director.sample(48399));
  const turnoverCertification = planner.consume(Director.sample(48400), { continuous: true });

  assert.deepEqual(cueTypes(turnoverCertification), ['crowd-swell']);
  assert.ok(turnoverCertification.every((cue) => cue.type !== 'score-stinger'));

  planner.seek(Director.sample(60199));
  const blockCertification = planner.consume(Director.sample(60200), { continuous: true });
  assert.deepEqual(cueTypes(blockCertification), ['crowd-swell']);
  assert.ok(blockCertification.every((cue) => cue.type !== 'score-stinger'));
});

test('full canonical director loop has one landing hit per named event and only positive score stingers', () => {
  const planner = Audio.createCuePlanner({ cueCatalogue: Director.audioCues });
  const emitted = [];
  for (let timeMs = 0; timeMs < Director.durationMs; timeMs += 20) {
    emitted.push(...planner.consume(Director.sample(timeMs), { continuous: true }));
  }

  assert.deepEqual(
    emitted.filter((cue) => cue.type === 'score-stinger').map((cue) => cue.eventId),
    ['visual-reset-stoop-drop-001', 'broadcast-whiteout-answer-001', 'broadcast-stoopy-putback-001']
  );
  assert.deepEqual(
    emitted.filter((cue) => cue.type === 'body-contact' && cue.atMs >= 14000 && cue.atMs < 17000).map((cue) => cue.eventId),
    ['stoop-landing']
  );
  assert.deepEqual(
    emitted.filter((cue) => cue.type === 'body-contact' && cue.atMs >= 73000 && cue.atMs < 76000).map((cue) => cue.eventId),
    ['putback-landing']
  );
  assert.equal(emitted.filter((cue) => cue.type === 'replay-transition').length, 1);
});

test('seek primes active cues silently, preserves same-loop dedupe, and never bursts skipped moments', () => {
  const planner = Audio.createCuePlanner();
  const start = directorSample({ timeMs: 0 });
  const bounce = directorSample({ timeMs: 300, ballContact: 'floor', dribbleIndex: 1 });

  assert.deepEqual(planner.consume(start), []);
  assert.deepEqual(cueTypes(planner.consume(bounce)), ['ball-bounce']);
  planner.seek(start);
  assert.deepEqual(planner.consume(bounce, { continuous: true }), []);

  const activeAtSeek = directorSample({
    timeMs: 5000,
    activeCueIds: ['ball-bounce:seek-active-001']
  });
  planner.seek(activeAtSeek);
  assert.deepEqual(planner.consume(directorSample({
    timeMs: 5010,
    activeCueIds: ['ball-bounce:seek-active-001']
  })), []);

  const arbitraryJump = Audio.createCuePlanner();
  arbitraryJump.consume(start);
  const skippedFinish = directorSample({
    timeMs: 9100,
    phase: 'landing',
    scoreCertified: true,
    ballContact: 'net',
    contacts: {
      landing: { id: 'skipped-landing', active: true, occurred: true }
    }
  });
  assert.deepEqual(arbitraryJump.consume(skippedFinish), []);
  assert.equal(arbitraryJump.state().lastTimeMs, 9100);

  const enteringAfterSeek = Audio.createCuePlanner();
  enteringAfterSeek.seek(directorSample({ timeMs: 8200, phase: 'rise' }));
  assert.deepEqual(cueTypes(enteringAfterSeek.consume(directorSample({
    timeMs: 8350,
    phase: 'rise',
    ballContact: 'rim-plane',
    contacts: { rim: { id: 'post-seek-rim', crossed: true } }
  }), { continuous: true })), ['rim']);
});

test('reset creates a clean loop without replaying anything present at the reset frame', () => {
  const planner = Audio.createCuePlanner();
  const cue = { type: 'catch', eventId: 'same-catch', loopId: '0', atMs: 400 };

  assert.deepEqual(cueTypes(planner.consume(cue)), ['catch']);
  assert.deepEqual(planner.consume(cue), []);

  const resetFrame = directorSample({
    timeMs: 0,
    loop: 1,
    activeCueIds: ['catch:held-through-reset']
  });
  const state = planner.reset('1', resetFrame);
  assert.equal(state.loopId, '1');
  assert.equal(state.generation, 1);
  assert.equal(state.seenCount, 1);
  assert.deepEqual(planner.consume(directorSample({
    timeMs: 10,
    loop: 1,
    activeCueIds: ['catch:held-through-reset']
  })), []);

  const nextLoopCue = { type: 'catch', eventId: 'same-catch', loopId: '1', atMs: 400 };
  assert.deepEqual(cueTypes(planner.consume(nextLoopCue)), ['catch']);
  assert.deepEqual(planner.consume(nextLoopCue), []);
});

test('replay transition requires recorded footage for inferred and explicit cues', () => {
  const planner = Audio.createCuePlanner();
  const live = directorSample({ timeMs: 20000 });
  planner.consume(live);

  const unrecordedReplay = directorSample({
    timeMs: 21000,
    replay: {
      active: true,
      sourceEventId: 'stoop-drop-score-001',
      recordedFootage: false
    }
  });
  assert.deepEqual(planner.consume(unrecordedReplay, { continuous: true }), []);

  planner.consume(directorSample({ timeMs: 21100 }), { continuous: true });
  const recordedReplay = directorSample({
    timeMs: 21200,
    replay: {
      active: true,
      sourceEventId: 'stoop-drop-score-001',
      sourceStartMs: 4800,
      recordedFootage: true
    }
  });
  const inferred = planner.consume(recordedReplay, { continuous: true });
  assert.deepEqual(cueTypes(inferred), ['replay-transition']);
  assert.equal(inferred[0].recordedFootage, true);
  assert.deepEqual(planner.consume(recordedReplay, { continuous: true }), []);

  const explicit = Audio.createCuePlanner();
  assert.deepEqual(explicit.consume({
    type: 'replay-transition',
    eventId: 'explicit-replay',
    recordedFootage: false
  }), []);
  const accepted = explicit.consume({
    type: 'replay-transition',
    eventId: 'explicit-replay',
    recordedFootage: true
  });
  assert.deepEqual(cueTypes(accepted), ['replay-transition']);
});

test('late-clock tension, whistle, and horn are ordered and emitted only on rising transitions', () => {
  const planner = Audio.createCuePlanner();
  planner.consume(directorSample({ timeMs: 0, gameClockSeconds: 16 }));
  const moment = planner.consume(directorSample({
    timeMs: 100,
    phase: 'final',
    gameClockSeconds: 13.9,
    whistle: true,
    horn: true
  }));

  assert.deepEqual(cueTypes(moment), ['whistle', 'tension-pulse', 'horn']);
  assert.deepEqual(planner.consume(directorSample({
    timeMs: 200,
    phase: 'final',
    gameClockSeconds: 13.2,
    whistle: true,
    horn: true
  })), []);
});

test('identical sample and cue sequences produce byte-identical plans', () => {
  const sequence = [
    { sample: directorSample({ timeMs: 0 }) },
    { sample: directorSample({ timeMs: 300, ballContact: 'floor', dribbleIndex: 1 }) },
    { sample: directorSample({ timeMs: 600, ballContact: 'hand', dribbleIndex: 1 }) },
    { sample: directorSample({ timeMs: 900, ballContact: 'floor', dribbleIndex: 2 }) },
    { sample: directorSample({ timeMs: 1200, phase: 'gather' }) }
  ];
  const first = runSignature(sequence);
  const second = runSignature(sequence);

  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(first, second);
  assert.ok(Object.isFrozen(first[1]));
});

test('fake Web Audio verifies gesture lock, local synthesis, bounded mix, controls, and cancellation', async () => {
  let factoryCalls = 0;
  let context;
  const engine = Audio.createBroadcastAudio({
    volume: 0.65,
    contextFactory() {
      factoryCalls += 1;
      context = new FakeAudioContext();
      return context;
    }
  });

  assert.deepEqual(
    {
      state: engine.status().state,
      locked: engine.status().locked,
      contextState: engine.status().contextState,
      bedActive: engine.status().bedActive
    },
    { state: 'locked', locked: true, contextState: 'none', bedActive: false }
  );
  assert.equal(factoryCalls, 0);

  const lockedCue = { type: 'ball-bounce', eventId: 'locked-bounce', atMs: 1 };
  assert.deepEqual(cueTypes(engine.consume(lockedCue)), ['ball-bounce']);
  assert.equal(factoryCalls, 0);

  const unlocked = await engine.unlock();
  assert.equal(factoryCalls, 1);
  assert.equal(context.resumeCount, 1);
  assert.equal(unlocked.state, 'running');
  assert.equal(unlocked.locked, false);
  assert.equal(unlocked.bedActive, true);
  assert.equal(context.sources.length, 3);
  assert.ok(context.sources.every((source) => source.started));
  assert.deepEqual(engine.consume(lockedCue), []);
  assert.equal(engine.status().scheduledCount, 0);

  const bedSources = context.sources.slice();
  const cueObjects = Audio.cueTypes.map((type, index) => ({
    type,
    eventId: `synthesis-${type}`,
    atMs: 100 + index,
    position: { x: 0, y: index % 2 ? 18 : -18, z: 0 },
    intensity: 1,
    gain: 10,
    recordedFootage: type === 'replay-transition'
  }));
  const scheduledCues = engine.consume(cueObjects);
  assert.deepEqual(cueTypes(scheduledCues), Audio.cueTypes);
  assert.ok(scheduledCues.every((cue) => cue.gain <= Audio.maxCueGain));
  assert.ok(engine.status().scheduledCount >= Audio.cueTypes.length);

  const transientSources = context.sources.slice(bedSources.length);
  assert.ok(transientSources.length >= Audio.cueTypes.length);
  assert.ok(transientSources.every((source) => source.started));
  assert.ok(bedSources.every((source) => !source.stopped));

  const compressor = context.nodes.find((node) => node.kind === 'compressor');
  assert.equal(compressor.threshold.value, -22);
  assert.equal(compressor.knee.value, 18);
  assert.equal(compressor.ratio.value, 8);
  const gainValues = context.params
    .filter((parameter) => parameter.label === 'gain')
    .flatMap((parameter) => parameter.events.map((event) => event.value));
  assert.ok(gainValues.every((value) => Number.isFinite(value) && value >= 0 && value <= 1));
  assert.ok(gainValues.includes(0.009));
  assert.ok(gainValues.includes(0.006));

  const muted = engine.mute();
  assert.equal(muted.state, 'muted');
  assert.equal(muted.muted, true);
  const clampedVolume = engine.setVolume(9);
  assert.equal(clampedVolume.volume, 1);
  assert.equal(engine.unmute().state, 'running');

  engine.seek(directorSample({ timeMs: 1000 }));
  assert.equal(engine.status().scheduledCount, 0);
  assert.ok(transientSources.every((source) => source.stopped));
  assert.ok(bedSources.every((source) => !source.stopped));

  engine.consume({ type: 'horn', eventId: 'post-seek-horn' });
  assert.ok(engine.status().scheduledCount > 0);
  engine.reset('1', directorSample({ timeMs: 0, loop: 1 }));
  assert.equal(engine.status().scheduledCount, 0);

  const destroyed = engine.destroy();
  assert.equal(destroyed.state, 'destroyed');
  assert.equal(destroyed.locked, true);
  assert.equal(context.closeCount, 1);
  assert.ok(bedSources.every((source) => source.stopped));
});
