import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

class RecordingPath2D {
  constructor() { this.operations = []; }
  record(name, args) { this.operations.push([name, ...Array.from(args)]); }
  moveTo(...args) { this.record('moveTo', args); }
  lineTo(...args) { this.record('lineTo', args); }
  closePath(...args) { this.record('closePath', args); }
  ellipse(...args) { this.record('ellipse', args); }
  roundRect(...args) { this.record('roundRect', args); }
  bezierCurveTo(...args) { this.record('bezierCurveTo', args); }
  quadraticCurveTo(...args) { this.record('quadraticCurveTo', args); }
}

globalThis.Path2D = RecordingPath2D;
delete globalThis.CyberligaFoundingVisual;
await import('./foundingvisual.js');
const Visual = globalThis.CyberligaFoundingVisual;

const CONTEXT_PROPERTIES = [
  'fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin',
  'shadowColor', 'shadowBlur', 'shadowOffsetY', 'globalAlpha'
];

function serializable(value) {
  if (value instanceof RecordingPath2D) return { path: value.operations };
  return value;
}

class RecordingContext {
  constructor() {
    this.operations = [];
    this.depth = 0;
    this.stack = [];
    this.state = {
      fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1,
      lineCap: 'butt', lineJoin: 'miter', shadowColor: 'transparent',
      shadowBlur: 0, shadowOffsetY: 0, globalAlpha: 1
    };
    CONTEXT_PROPERTIES.forEach((property) => {
      Object.defineProperty(this, property, {
        enumerable: true,
        get: () => this.state[property],
        set: (value) => {
          this.state[property] = value;
          this.operations.push(['set', property, serializable(value)]);
        }
      });
    });
  }
  record(name, args) { this.operations.push([name, ...Array.from(args, serializable)]); }
  save() {
    this.stack.push({ ...this.state });
    this.depth += 1;
    this.operations.push(['save']);
  }
  restore() {
    assert.ok(this.depth > 0, 'restore must have a matching save');
    this.state = this.stack.pop();
    this.depth -= 1;
    this.operations.push(['restore']);
  }
  translate(...args) { this.record('translate', args); }
  scale(...args) { this.record('scale', args); }
  rotate(...args) { this.record('rotate', args); }
  beginPath(...args) { this.record('beginPath', args); }
  closePath(...args) { this.record('closePath', args); }
  moveTo(...args) { this.record('moveTo', args); }
  lineTo(...args) { this.record('lineTo', args); }
  arc(...args) { this.record('arc', args); }
  ellipse(...args) { this.record('ellipse', args); }
  roundRect(...args) { this.record('roundRect', args); }
  bezierCurveTo(...args) { this.record('bezierCurveTo', args); }
  quadraticCurveTo(...args) { this.record('quadraticCurveTo', args); }
  fill(...args) { this.record('fill', args); }
  stroke(...args) { this.record('stroke', args); }
  clip(...args) { this.record('clip', args); }
}

function recordFor(definition) {
  return {
    id: definition.athleteId,
    teamId: definition.teamId,
    sportId: definition.sportId,
    body: definition.bodyKey,
    bodyFamily: 'test family',
    motionName: 'test motion'
  };
}

function teamFor(definition, index = 0) {
  const colors = [
    ['#f34f68', '#fff1d6', '#20314a'],
    ['#72c8d5', '#243144', '#ffca5c'],
    ['#63b48d', '#261b38', '#f8a94f']
  ][index % 3];
  return {
    id: definition.teamId,
    sportId: definition.sportId,
    colors: { primary: colors[0], secondary: colors[1], accent: colors[2] }
  };
}

function preparedAt(index) {
  const definition = Visual.descriptors[index];
  return Visual.prepare(recordFor(definition), teamFor(definition, index));
}

function digest(operations) {
  return createHash('sha256').update(JSON.stringify(operations)).digest('hex');
}

function bodyDigests() {
  return Object.fromEntries(Visual.descriptors.map((definition, index) => {
    const descriptor = preparedAt(index);
    const operations = [];
    for (const phase of [0, .43, .99]) {
      const ctx = new RecordingContext();
      const result = Visual.draw(ctx, descriptor, {
        x: 360,
        y: 270,
        scale: .75,
        phase,
        shadow: true,
        surface: 'digest-test'
      });
      assert.equal(ctx.depth, 0, definition.bodyKey + ' must balance canvas state');
      assert.equal(result.bodyKey, definition.bodyKey);
      operations.push(ctx.operations);
    }
    return [definition.bodyKey, digest(operations)];
  }));
}

const EXPECTED_DIGESTS = Object.freeze({
  kite: '8ddc950c4dd266ff711e3cd9435b17e0607e070007644d69a391d8d1ec30e4d8',
  lantern: 'd0229accf2c6c903dde3f03755e4ff4ffb2a31b35b79919e9b359dd50c8af379',
  stoop: 'ec564fd30e73841590486808af892c8bb098649cc5c0f43f60401c43b7c31191',
  toque: 'd7eb84116059926f2e8b53e984040b08b397b8e6b9ed1e16a8fcb562549e34d8',
  sugar: '5a5c7f9a1cc4b9a47b2d9c302641edb23478775f65d214eba030d05597d75815',
  loon: '94e99e600f59ae1255a43832ae8d72135a285133490e5fa464cfacf8ee2bdeff',
  alebrije: '830f7ea99be2473b212955bac7ea65b130d9afd272cf9320970f18134f7ef8f9',
  cane: '65209e1f7f9edb7458812956656ddf5c06b647e731469c0a347a47761dc55a4e',
  gong: '58e098cb4e392533e9d5f68680ac58d861d5cf3984ccb30e7e6d1f52cda4a91a',
  rice: '007ec7380d5022eaff4fdb9d607da8f8eae8272866a1219f93371d73d58b26ba',
  gumbo: '1a65952c0872bcdab29ac648e39a7c17d4b6365025ee64e5ceabb6102d435dcf',
  peach: '51bffc198b4fe21f1efcdd3a034b99b3e5b815f09d464e8d2a5565852a02c633'
});

test('exports a deeply frozen Founding 12 API and descriptor catalogue', () => {
  assert.ok(Visual);
  assert.equal(Visual.version, '1.0.0');
  assert.equal(Visual.durationMs, 4800);
  assert.equal(Visual.showcasePhase, .43);
  assert.ok(Object.isFrozen(Visual));
  assert.ok(Object.isFrozen(Visual.bodyKeys));
  assert.ok(Object.isFrozen(Visual.bounds));
  assert.ok(Object.isFrozen(Visual.descriptors));
  assert.equal(Visual.bodyKeys.length, 12);
  assert.equal(Visual.descriptors.length, 12);
  assert.deepEqual(Visual.descriptors.map((item) => item.bodyKey), Visual.bodyKeys);
  assert.equal(new Set(Visual.descriptors.map((item) => item.athleteId)).size, 12);
  Visual.descriptors.forEach((descriptor) => assert.ok(Object.isFrozen(descriptor)));
});

test('prepares and describes every exact canonical identity', () => {
  Visual.descriptors.forEach((definition, index) => {
    const descriptor = preparedAt(index);
    assert.ok(descriptor, definition.athleteId);
    assert.ok(Object.isFrozen(descriptor));
    assert.ok(Object.isFrozen(descriptor.colors));
    assert.equal(descriptor.athleteId, definition.athleteId);
    assert.equal(descriptor.teamId, definition.teamId);
    assert.equal(descriptor.sportId, definition.sportId);
    assert.equal(descriptor.bodyKey, definition.bodyKey);
    const identity = Visual.describe(descriptor, .43, 'unit-test', { x: 1, y: 2, scale: 3 });
    assert.ok(Object.isFrozen(identity));
    assert.ok(Object.isFrozen(identity.transform));
    assert.equal(identity.mode, 'founding-vector');
    assert.equal(identity.founding, true);
    assert.equal(identity.rendererVersion, Visual.version);
    assert.equal(identity.phase, .43);
    assert.equal(identity.identityKey, `founding-vector@${Visual.version}/${definition.athleteId}/${definition.bodyKey}`);
  });
});

test('strict gate rejects identity, body, team, sport, and color mismatches', () => {
  const definition = Visual.descriptors[0];
  const record = recordFor(definition);
  const team = teamFor(definition);
  assert.equal(Visual.prepare({ ...record, id: 'generic-athlete' }, team), null);
  assert.equal(Visual.prepare({ ...record, teamId: Visual.descriptors[1].teamId }, team), null);
  assert.equal(Visual.prepare({ ...record, sportId: 'hockey' }, team), null);
  assert.equal(Visual.prepare({ ...record, body: 'lantern' }, team), null);
  assert.equal(Visual.prepare(record, { ...team, id: 'wrong-team' }), null);
  assert.equal(Visual.prepare(record, { ...team, sportId: 'combat' }), null);
  assert.equal(Visual.prepare(record, { ...team, colors: { ...team.colors, accent: 'red' } }), null);
  assert.equal(Visual.prepare(null, team), null);
  const prepared = Visual.prepare(record, team);
  const forged = { ...prepared };
  const ctx = new RecordingContext();
  assert.equal(Visual.draw(ctx, forged, { phase: .43 }), null);
  assert.equal(Visual.describe(forged, .43, 'forged', null), null);
  assert.deepEqual(ctx.operations, []);
});

test('all body renderers have stable deterministic operation digests', () => {
  assert.deepEqual(bodyDigests(), EXPECTED_DIGESTS);
  assert.deepEqual(bodyDigests(), EXPECTED_DIGESTS);
});

test('fit and drawFit conservatively contain the full-motion bounds', () => {
  const frame = Object.freeze({ x: 10, y: 20, width: 370, height: 290 });
  const options = Object.freeze({ padding: 10 });
  const transform = Visual.fit(frame, options);
  assert.ok(transform);
  assert.ok(Object.isFrozen(transform));
  assert.strictEqual(transform.bounds, Visual.bounds);
  assert.equal(transform.scale, 350 / 720);
  assert.equal(transform.x + Visual.bounds.left * transform.scale, 20);
  assert.equal(transform.x + Visual.bounds.right * transform.scale, 370);
  assert.ok(transform.y + Visual.bounds.top * transform.scale >= 30);
  assert.ok(transform.y + Visual.bounds.bottom * transform.scale <= 300);
  assert.equal(Visual.fit({ x: 0, y: 0, width: 0, height: 10 }), null);
  assert.equal(Visual.fit({ x: 0, y: 0, width: 10, height: 10 }, { padding: 6 }), null);

  const ctx = new RecordingContext();
  const descriptor = preparedAt(0);
  const drawnTransform = Visual.drawFit(ctx, descriptor, frame, { phase: .43, padding: 10, shadow: false });
  assert.deepEqual(drawnTransform, transform);
  assert.equal(ctx.depth, 0);
});

test('inkOnly removes club color, eyes, props, and ground shadow without imbalance', () => {
  Visual.descriptors.forEach((definition, index) => {
    const descriptor = preparedAt(index);
    const ctx = new RecordingContext();
    Visual.draw(ctx, descriptor, { phase: .43, inkOnly: true, shadow: true });
    const serialized = JSON.stringify(ctx.operations).toLowerCase();
    assert.equal(ctx.depth, 0);
    assert.ok(!serialized.includes(descriptor.colors.primary.toLowerCase()));
    assert.ok(!serialized.includes(descriptor.colors.secondary.toLowerCase()));
    assert.ok(!serialized.includes(descriptor.colors.accent.toLowerCase()));
    assert.ok(!serialized.includes('#f4eee2'));
    assert.ok(!serialized.includes('rgba(0,0,0,.28)'));
  });
});

test('clip-style draws can suppress an authored prop without changing the body contract', () => {
  for (const index of [3, 6, 10]) {
    const descriptor = preparedAt(index);
    const withProp = new RecordingContext();
    const withoutProp = new RecordingContext();
    const normal = Visual.draw(withProp, descriptor, { phase:.43, sportProp:true, shadow:false, surface:'prop-on' });
    const suppressed = Visual.draw(withoutProp, descriptor, { phase:.43, sportProp:false, shadow:false, surface:'prop-off' });
    assert.equal(normal.identityKey, suppressed.identityKey);
    assert.equal(withProp.depth, 0);
    assert.equal(withoutProp.depth, 0);
    assert.ok(withProp.operations.length > withoutProp.operations.length, descriptor.bodyKey + ' should remove only its authored sport prop');
  }
});

test('prepare, fit, drawFit, and describe do not mutate caller inputs', () => {
  const definition = Visual.descriptors[4];
  const record = recordFor(definition);
  const team = teamFor(definition, 4);
  const frame = { x: 5, y: 7, width: 800, height: 600 };
  const options = { phase: .43, padding: 12, shadow: true, surface: 'immutability-test' };
  const before = structuredClone({ record, team, frame, options });
  const descriptor = Visual.prepare(record, team);
  const ctx = new RecordingContext();
  const transform = Visual.drawFit(ctx, descriptor, frame, options);
  Visual.describe(descriptor, options.phase, options.surface, transform);
  assert.deepEqual({ record, team, frame, options }, before);
  assert.equal(ctx.depth, 0);
});

test('module has no product globals, environment reads, clocks, URLs, or Math.random', async () => {
  const source = await readFile(new URL('./foundingvisual.js', import.meta.url), 'utf8');
  for (const pattern of [
    /\bdocument\b/,
    /\bwindow\b/,
    /CYBERLIGA_CONTENT/,
    /CyberligaCharacters/,
    /\bDate\b/,
    /\bperformance\b/,
    /requestAnimationFrame/,
    /URLSearchParams/,
    /\blocation\b/,
    /Math\.random/
  ]) assert.doesNotMatch(source, pattern);
});
