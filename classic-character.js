// Deterministic performance fingerprints for the classic capsule athletes.
//
// World data already gives every athlete a name, role, archetype, temperament,
// silhouette and team motion language. This module translates that authored
// identity into restrained renderer parameters. It does not make sporting
// decisions and never uses runtime randomness, so replays and deterministic QA
// see the same athlete move the same way on every load.

export const CLASSIC_CHARACTER_VERSION = '1.0.0';

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function classicIdentityHash(value) {
  let result = 2166136261 >>> 0;
  for (const character of String(value == null ? '' : value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

const unit = (seed, salt) => classicIdentityHash(`${seed}|${salt}`) / 4294967295;
const spread = (seed, salt, amount) => 1 + (unit(seed, salt) * 2 - 1) * amount;
const includesAny = (text, words) => words.some(word => text.includes(word));

const PRESETS = Object.freeze({
  anchor: Object.freeze({
    strideRate: 0.91, bounce: 0.76, plant: 1.22, width: 1.075,
    stature: 1.015, depth: 1.055, lean: 0.78, turn: 0.78, sway: 0.34,
  }),
  power: Object.freeze({
    strideRate: 0.96, bounce: 0.90, plant: 1.18, width: 1.09,
    stature: 1.02, depth: 1.085, lean: 1.13, turn: 0.88, sway: 0.48,
  }),
  glider: Object.freeze({
    strideRate: 1.08, bounce: 0.92, plant: 0.88, width: 0.955,
    stature: 1.045, depth: 0.965, lean: 1.05, turn: 1.17, sway: 0.78,
  }),
  craft: Object.freeze({
    strideRate: 1.01, bounce: 0.82, plant: 1.02, width: 0.99,
    stature: 1.00, depth: 1.00, lean: 0.94, turn: 1.08, sway: 0.57,
  }),
  spark: Object.freeze({
    strideRate: 1.13, bounce: 1.16, plant: 0.92, width: 0.94,
    stature: 0.965, depth: 0.95, lean: 1.12, turn: 1.22, sway: 1.02,
  }),
  balanced: Object.freeze({
    strideRate: 1.00, bounce: 1.00, plant: 1.00, width: 1.00,
    stature: 1.00, depth: 1.00, lean: 1.00, turn: 1.00, sway: 0.60,
  }),
});

const FOUNDING_MOTION = Object.freeze({
  kite: Object.freeze({ stride: 1.09, bounce: 0.88, plant: 0.88, sway: 0.78, snap: 1.12 }),
  lantern: Object.freeze({ stride: 0.96, bounce: 1.08, plant: 0.94, sway: 1.28, snap: 0.94 }),
  stoop: Object.freeze({ stride: 0.94, bounce: 0.82, plant: 1.30, sway: 0.42, snap: 1.06 }),
  toque: Object.freeze({ stride: 1.08, bounce: 0.92, plant: 0.95, sway: 0.62, snap: 1.22 }),
  sugar: Object.freeze({ stride: 0.91, bounce: 0.76, plant: 1.30, sway: 0.38, snap: 0.93 }),
  loon: Object.freeze({ stride: 1.10, bounce: 1.14, plant: 0.86, sway: 1.12, snap: 1.24 }),
  alebrije: Object.freeze({ stride: 1.13, bounce: 1.05, plant: 0.91, sway: 1.18, snap: 1.20 }),
  cane: Object.freeze({ stride: 0.92, bounce: 0.74, plant: 1.26, sway: 0.58, snap: 1.12 }),
  gong: Object.freeze({ stride: 0.88, bounce: 0.72, plant: 1.34, sway: 0.40, snap: 1.18 }),
  rice: Object.freeze({ stride: 1.16, bounce: 1.08, plant: 0.88, sway: 1.21, snap: 1.28 }),
  gumbo: Object.freeze({ stride: 0.93, bounce: 0.86, plant: 1.18, sway: 1.08, snap: 1.12 }),
  peach: Object.freeze({ stride: 1.04, bounce: 0.96, plant: 1.24, sway: 0.72, snap: 1.25 }),
});

export function classicRoleArchetype(role, archetype = '') {
  const text = `${role || ''} ${archetype || ''}`.toLowerCase();
  if (includesAny(text, [
    'keeper', 'goaltender', 'rim keeper', 'stay-home', 'left tackle',
    'left guard', 'right guard', 'right tackle', 'nose tackle',
  ])) return 'anchor';
  if (includesAny(text, [
    'heavy', 'slugger', 'running back', 'tight end', 'defensive tackle',
    'defensive end', 'linebacker', 'grappler', 'closer',
  ])) return 'power';
  if (includesAny(text, [
    'winger', 'wing', 'receiver', 'sniper', 'shooter', 'rover', 'center field',
    'safety', 'cornerback', 'horizon', 'escape artist',
  ])) return 'glider';
  if (includesAny(text, [
    'wildcard', 'cutter', 'sixth spark', 'pest', 'swarmer', 'showboat',
    'mischief', 'momentum thief', 'bad weather',
  ])) return 'spark';
  if (includesAny(text, [
    'quarterback', 'point', 'engine', 'technician', 'counter', 'catcher',
    'shortstop', 'ace', 'cartographer', 'illusionist', 'locksmith',
  ])) return 'craft';
  return 'balanced';
}

export function createClassicCharacterProfile({
  athlete = null,
  team = null,
  role = '',
  founding = null,
} = {}) {
  const athleteRole = String(role || athlete?.role || '');
  const canonicalRole = String(athlete?.role || '');
  const athleteArchetype = String(athlete?.archetype || '');
  const archetype = classicRoleArchetype(`${athleteRole} ${canonicalRole}`, athleteArchetype);
  const preset = PRESETS[archetype];
  const seed = [
    athlete?.id || athlete?.name || 'anonymous-athlete',
    athleteRole,
    canonicalRole,
    athleteArchetype,
    athlete?.temperament || '',
    athlete?.signature || '',
    athlete?.silhouette || '',
    team?.id || '',
    team?.motion || '',
  ].join('|');

  const motionText = `${team?.motion || ''} ${athlete?.signature || ''} ${athlete?.temperament || ''}`.toLowerCase();
  const silhouetteText = String(athlete?.silhouette || '').toLowerCase();
  const gliding = includesAny(motionText, ['glide', 'float', 'drift', 'curve', 'circl', 'horizon']);
  const explosive = includesAny(motionText, ['burst', 'erupt', 'snap', 'sharp', 'sudden', 'thunder', 'whip']);
  const rooted = includesAny(motionText, ['root', 'heavy', 'stomp', 'statue', 'hold', 'square']);
  const rhythmic = includesAny(motionText, ['sway', 'pendulum', 'roll', 'spin', 'swing', 'syncopat', 'dance']);
  const tall = includesAny(silhouetteText, ['tall', 'tower', 'reed', 'candle', 'long elastic', 'stilt']);
  const broad = includesAny(silhouetteText, ['wide', 'squat', 'barrel', 'boulder', 'pear', 'gourd', 'square']);
  const flat = includesAny(silhouetteText, ['flat', 'oval', 'pancake', 'disc']);
  const foundingBody = String(founding?.bodyKey || '');
  const signature = FOUNDING_MOTION[foundingBody] || null;

  const strideRate = clamp(
    preset.strideRate * spread(seed, 'stride', 0.055)
      * (gliding ? 0.97 : 1) * (explosive ? 1.045 : 1)
      * (signature?.stride || 1),
    0.78, 1.30,
  );
  const bounce = clamp(
    preset.bounce * spread(seed, 'bounce', 0.07)
      * (gliding ? 0.90 : 1) * (explosive ? 1.08 : 1)
      * (signature?.bounce || 1),
    0.58, 1.38,
  );
  const plant = clamp(
    preset.plant * spread(seed, 'plant', 0.055)
      * (rooted ? 1.12 : 1) * (gliding ? 0.92 : 1)
      * (signature?.plant || 1),
    0.68, 1.52,
  );
  const snap = clamp(
    spread(seed, 'snap', 0.08) * (explosive ? 1.13 : 1)
      * (rooted ? 0.94 : 1) * (signature?.snap || 1),
    0.76, 1.48,
  );
  const sway = clamp(
    preset.sway * spread(seed, 'sway', 0.10)
      * (rhythmic ? 1.22 : 1) * (gliding ? 1.10 : 1)
      * (signature?.sway || 1),
    0.18, 1.62,
  );

  const profile = {
    version: CLASSIC_CHARACTER_VERSION,
    athleteId: String(athlete?.id || ''),
    role: athleteRole,
    canonicalRole,
    archetype,
    phase: unit(seed, 'phase') * TAU,
    strideRate,
    bounce,
    plant,
    snap,
    sway,
    lean: clamp(preset.lean * spread(seed, 'lean', 0.065), 0.70, 1.30),
    turn: clamp(preset.turn * spread(seed, 'turn', 0.06), 0.68, 1.34),
    width: clamp(preset.width * spread(seed, 'width', 0.055) * (tall ? 0.94 : 1) * (broad ? 1.06 : 1) * (flat ? 1.04 : 1), 0.88, 1.14),
    stature: clamp(preset.stature * spread(seed, 'stature', 0.045) * (tall ? 1.065 : 1) * (broad ? 0.965 : 1) * (flat ? 0.97 : 1), 0.91, 1.11),
    depth: clamp(preset.depth * spread(seed, 'depth', 0.045) * (tall ? 0.96 : 1) * (broad ? 1.04 : 1) * (flat ? 0.91 : 1), 0.89, 1.15),
    headScale: clamp(spread(seed, 'head', 0.075), 0.91, 1.09),
    breathRate: clamp(spread(seed, 'breath', 0.12), 0.84, 1.16),
    celebrationVariant: classicIdentityHash(`${seed}|celebration`) % 4,
    foundingBody: foundingBody || null,
    motionName: founding?.motionName ? String(founding.motionName) : null,
  };
  return Object.freeze(profile);
}

export function validateClassicCharacterProfile(profile) {
  if (!profile || typeof profile !== 'object') return false;
  if (!Object.isFrozen(profile) || profile.version !== CLASSIC_CHARACTER_VERSION) return false;
  const bounds = {
    phase: [0, TAU],
    strideRate: [0.78, 1.30],
    bounce: [0.58, 1.38],
    plant: [0.68, 1.52],
    snap: [0.76, 1.48],
    sway: [0.18, 1.62],
    lean: [0.70, 1.30],
    turn: [0.68, 1.34],
    width: [0.88, 1.14],
    stature: [0.91, 1.11],
    depth: [0.89, 1.15],
    headScale: [0.91, 1.09],
    breathRate: [0.84, 1.16],
  };
  return Object.entries(bounds).every(([key, [min, max]]) => (
    Number.isFinite(profile[key]) && profile[key] >= min && profile[key] <= max
  )) && Number.isInteger(profile.celebrationVariant)
    && profile.celebrationVariant >= 0 && profile.celebrationVariant <= 3;
}
