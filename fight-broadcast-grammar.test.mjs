import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./fight-broadcast-grammar.js', import.meta.url), 'utf8');
const context = { module: { exports: {} }, exports: {} };
vm.createContext(context);
vm.runInContext(source, context);
const Grammar = context.module.exports;

test('publishes a deeply frozen, browser-safe deterministic API', () => {
  assert.equal(Grammar.version, '1.0.0');
  assert.equal(Object.isFrozen(Grammar), true);
  assert.equal(Object.isFrozen(Grammar.roleProfiles.Grappler.sequences[0]), true);
  assert.doesNotMatch(source, /Math\.random|Date\.now|performance\.now|fetch\s*\(|XMLHttpRequest|WebSocket/);

  const browser = { globalThis: {} };
  vm.createContext(browser);
  vm.runInContext(source.replace(
    "if (typeof module === 'object' && module.exports) module.exports = api;",
    "if (false) module.exports = api;"
  ), browser);
  assert.equal(browser.globalThis.CyberligaFightBroadcastGrammar.version, '1.0.0');
});

test('all six canonical roles have distinct readable identities and tendencies', () => {
  const roles = ['Heavy', 'Technician', 'Counter', 'Swarmer', 'Grappler', 'Showboat'];
  const profiles = roles.map(role => Grammar.profileFor({ role }));
  assert.deepEqual(Array.from(profiles, profile => profile.id), ['HEAVY', 'TECHNICIAN', 'COUNTER', 'SWARMER', 'GRAPPLER', 'SHOWBOAT']);
  assert.equal(new Set(profiles.map(profile => profile.label)).size, roles.length);
  assert.equal(new Set(profiles.map(profile => profile.signatureName)).size, roles.length);
  assert.ok(Grammar.profileFor('Heavy').power > Grammar.profileFor('Technician').power);
  assert.ok(Grammar.profileFor('Swarmer').combo > Grammar.profileFor('Heavy').combo);
  assert.ok(Grammar.profileFor('Counter').counter > Grammar.profileFor('Swarmer').counter);
  assert.ok(Grammar.profileFor('Grappler').range < Grammar.profileFor('Technician').range);
});

test('signature sequences are stable, bounded and role-specific', () => {
  const first = Grammar.signatureSequence('Heavy', 0);
  const wrapped = Grammar.signatureSequence('Heavy', 3);
  assert.deepEqual(Array.from(first), ['JAB', 'OVERHAND']);
  assert.deepEqual(Array.from(wrapped), Array.from(first));
  assert.notDeepEqual(Array.from(Grammar.signatureSequence('Swarmer', 0)), Array.from(first));
  assert.equal(Object.isFrozen(first), true);
});

test('every strike exposes anticipation, delivery, impact and follow-through in order', () => {
  for (const kind of Object.keys(Grammar.strikeTiming)) {
    const timing = Grammar.strikeTiming[kind];
    const samples = [
      Grammar.strikeEnvelope(kind, timing.load * 0.5),
      Grammar.strikeEnvelope(kind, (timing.load + timing.contact) * 0.5),
      Grammar.strikeEnvelope(kind, timing.contact),
      Grammar.strikeEnvelope(kind, (timing.contact + timing.settle) * 0.5),
      Grammar.strikeEnvelope(kind, 0.98)
    ];
    assert.deepEqual(Array.from(samples, sample => sample.phase), [
      'ANTICIPATION', 'DELIVERY', 'IMPACT', 'FOLLOW-THROUGH', 'RECOVERY'
    ], kind);
    assert.equal(samples[2].extension, 1, kind);
    assert.ok(samples[0].anticipation > 0, kind);
    assert.ok(samples[3].followThrough > 0, kind);
  }
});

test('camera grammar never calls unrecorded material a replay', () => {
  const falseReplay = Grammar.cameraPlan({ state: 'FIGHT', replay: true, recordedFootage: false });
  assert.equal(falseReplay.replay, false);
  assert.notEqual(falseReplay.shot, 'RECORDED REPLAY');
  const truthfulReplay = Grammar.cameraPlan({ state: 'FIGHT', replay: true, recordedFootage: true });
  assert.equal(truthfulReplay.replay, true);
  assert.equal(truthfulReplay.recordedFootage, true);
  assert.equal(truthfulReplay.shot, 'RECORDED REPLAY');
  assert.equal(Grammar.cameraPlan({ state: 'FIGHT', impact: 0.8 }).shot, 'LIVE IMPACT HOLD');
  assert.equal(Grammar.cameraPlan({ state: 'FIGHT', clinch: true }).shot, 'CLINCH HIGH THREE-QUARTER');
});

test('finite pacing guard has one deterministic terminal edge', () => {
  assert.equal(Grammar.pacingState({ elapsed: 237.99, maxSeconds: 238 }).forceDecision, false);
  assert.equal(Grammar.pacingState({ elapsed: 238, maxSeconds: 238 }).forceDecision, true);
  assert.equal(Grammar.pacingState({ elapsed: 500, maxSeconds: 238, terminal: true }).forceDecision, false);
  assert.equal(Grammar.pacingState({ elapsed: Number.NaN }).finite, true);
  assert.deepEqual(
    Grammar.pacingState({ elapsed: 42.125, maxSeconds: 238 }),
    Grammar.pacingState({ elapsed: 42.125, maxSeconds: 238 })
  );
});
