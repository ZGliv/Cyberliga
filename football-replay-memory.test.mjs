import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('./football.js', import.meta.url), 'utf8');
const maybeStartReplaySource =
  source.match(/function maybeStartReplay\(\) \{[^]*?\n\}/)?.[0] || '';
const rollbackSource =
  source.match(/function rollbackNullifiedSnapStats\(\) \{[^]*?\n\}/)?.[0] || '';

assert.ok(maybeStartReplaySource, 'missing maybeStartReplay()');
assert.match(
  rollbackSource,
  /if \(state\.replayCandidate\)[^]*?state\.replayCandidate = null/,
  'accepted live-ball penalties must remove the replay candidate before replay resolution'
);

const buildMaybeStartReplay = new Function(
  'state',
  'replayBuffer',
  'recordFootballNamedReplay',
  'setReplayUi',
  'audioDirector',
  `"use strict";\n${maybeStartReplaySource}\nreturn maybeStartReplay;`
);

function playableSelection(duration = 1) {
  return {
    id: 'replay-test',
    duration,
    event: { id: 7, type: 'touchdown' },
    frames: [{ time: 0, state: {} }, { time: duration, state: {} }],
  };
}

function harness({
  hasCandidate = true,
  selection = playableSelection(),
  startResult = true,
} = {}) {
  const marker = {
    id: 7,
    type: 'touchdown',
    priority: 100,
    data: { playerId: 'test-player' },
  };
  const state = {
    phase: 'dead',
    replayActive: false,
    replayStarted: false,
    replayCandidate: hasCandidate ? marker : null,
    t: 0.5,
  };
  const calls = {
    select: [],
    start: [],
    records: [],
    ui: [],
    audio: [],
  };
  const replayBuffer = {
    selectReplay(options) {
      calls.select.push(options);
      return selection;
    },
    start(value, options) {
      calls.start.push({ value, options });
      return startResult;
    },
  };
  function recordFootballNamedReplay(value, options) {
    calls.records.push({
      sameMarker: value === marker,
      recordedFootage: options?.recordedFootage,
    });
    return {};
  }
  function setReplayUi(...args) {
    calls.ui.push(args);
  }
  const audioDirector = {
    triggerReplay(options) {
      calls.audio.push(options);
    },
  };
  const run = buildMaybeStartReplay(
    state,
    replayBuffer,
    recordFootballNamedReplay,
    setReplayUi,
    audioDirector
  );
  return { run, marker, state, calls };
}

test('nullified play records no Match Memory moment', () => {
  const scenario = harness({ hasCandidate: false });

  assert.equal(scenario.run(), false);
  assert.equal(scenario.state.replayStarted, false);
  assert.equal(scenario.state.replayActive, false);
  assert.equal(scenario.state.replayCandidate, null);
  assert.deepEqual(scenario.calls.select, []);
  assert.deepEqual(scenario.calls.start, []);
  assert.deepEqual(scenario.calls.records, []);
  assert.deepEqual(scenario.calls.ui, []);
  assert.deepEqual(scenario.calls.audio, []);
});

for (const [label, options, expectedStartCalls] of [
  ['selection failure', { selection: null }, 0],
  ['short-duration failure', { selection: playableSelection(0.44) }, 0],
  ['playback-start failure', { startResult: false }, 1],
]) {
  test(`${label} records exactly one LIVE moment`, () => {
    const scenario = harness(options);

    assert.equal(scenario.run(), false);
    assert.equal(scenario.state.replayStarted, true);
    assert.equal(scenario.state.replayActive, false);
    assert.equal(scenario.state.replayCandidate, null);
    assert.equal(scenario.calls.select.length, 1);
    assert.equal(scenario.calls.start.length, expectedStartCalls);
    assert.deepEqual(scenario.calls.records, [
      { sameMarker: true, recordedFootage: false },
    ]);
    assert.deepEqual(scenario.calls.ui, []);
    assert.deepEqual(scenario.calls.audio, []);
  });
}

test('successful playback records exactly one true replay moment', () => {
  const scenario = harness();

  assert.equal(scenario.run(), true);
  assert.equal(scenario.state.replayStarted, true);
  assert.equal(scenario.state.replayActive, true);
  assert.equal(scenario.state.replayCandidate, scenario.marker);
  assert.deepEqual(scenario.calls.select, [{
    eventId: 7,
    before: 3.5,
    after: 0.42,
    maxAge: 8,
  }]);
  assert.equal(scenario.calls.start.length, 1);
  assert.deepEqual(scenario.calls.start[0].options, { speed: 0.78 });
  assert.deepEqual(scenario.calls.records, [
    { sameMarker: true, recordedFootage: true },
  ]);
  assert.deepEqual(scenario.calls.ui, [[true, 'touchdown']]);
  assert.deepEqual(scenario.calls.audio, [{ direction: 'in' }]);
});
