/*
 * Deterministic American-football intelligence for Cyberliga.
 *
 * This module intentionally owns no clock, renderer, DOM, storage, or global
 * random state. Every helper returns new data. Helpers that use uncertainty
 * accept an RNG supplied by the caller; pass either `() => number` or an object
 * with `next()` returning a number in [0, 1). Omitting RNG removes score noise.
 *
 * Integration model:
 *   const dna = deriveTeamDNA(team);
 *   let memory = createCoordinatorMemory(team.id);
 *   const decision = chooseOffensiveCall({ calls, situation, teamDNA: dna, memory, rng });
 *   memory = recordPlayOutcome(memory, outcomeFromCompletedSnap);
 */

const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, Number.isFinite(value) ? value : low));
const lerp = (a, b, amount) => a + (b - a) * amount;
const sigmoid = value => 1 / (1 + Math.exp(-value));
const round = (value, digits = 3) => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};

const deepFreeze = value => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const key of Object.getOwnPropertyNames(value)) deepFreeze(value[key]);
  return Object.freeze(value);
};

const hash32 = value => {
  let hash = 2166136261 >>> 0;
  for (const char of String(value ?? '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const hashUnit = value => hash32(value) / 4294967295;

const rngUnit = rng => {
  if (!rng) return 0.5;
  const value = typeof rng === 'function' ? rng() : typeof rng.next === 'function' ? rng.next() : NaN;
  if (!Number.isFinite(value)) throw new TypeError('rng must be a function or expose next() returning a finite number');
  return clamp(value, 0, 0.999999999);
};

const DNA_DEFAULTS = deepFreeze({
  offense: {
    tempo: 0.50, runRate: 0.50, insideBias: 0.50, outsideBias: 0.50, gapBias: 0.48,
    optionRate: 0.25, playAction: 0.50, screenRate: 0.45, verticalRate: 0.50,
    misdirection: 0.45, motion: 0.45, protection: 0.52,
  },
  defense: {
    blitzRate: 0.45, disguise: 0.48, manRate: 0.48, zoneDiscipline: 0.52,
    boxAggression: 0.50, pursuitDiscipline: 0.52, takeawayHunt: 0.48, tackleSecurity: 0.52,
  },
  coordinator: {
    adaptability: 0.55, memory: 0.55, exploration: 0.18, patience: 0.52,
    riskTolerance: 0.50, fourthDownAggression: 0.48,
  },
});

/**
 * Authored identities for the eight existing Sunday Animal clubs. Values are
 * behavioral preferences, not hidden ratings boosts. They translate each
 * club's `motion` prose into decisions the simulation can express.
 */
export const AMERICAN_FOOTBALL_TEAM_DNA = deepFreeze({
  'new-orleans-bayou-kings': {
    label: 'Bayou Counterpunch',
    offense: { tempo: 0.36, runRate: 0.54, insideBias: 0.56, gapBias: 0.62, playAction: 0.88, misdirection: 0.94, motion: 0.77, verticalRate: 0.57 },
    defense: { blitzRate: 0.51, disguise: 0.83, manRate: 0.43, zoneDiscipline: 0.69, takeawayHunt: 0.60 },
    coordinator: { adaptability: 0.76, memory: 0.79, exploration: 0.16, patience: 0.84, riskTolerance: 0.55 },
  },
  'atlanta-peaches': {
    label: 'Pit-Hard Downhill',
    offense: { tempo: 0.66, runRate: 0.67, insideBias: 0.86, outsideBias: 0.34, gapBias: 0.78, playAction: 0.67, verticalRate: 0.40, protection: 0.61 },
    defense: { blitzRate: 0.57, disguise: 0.42, manRate: 0.54, boxAggression: 0.82, pursuitDiscipline: 0.61, tackleSecurity: 0.75 },
    coordinator: { adaptability: 0.58, memory: 0.60, exploration: 0.13, patience: 0.60, riskTolerance: 0.61, fourthDownAggression: 0.67 },
  },
  'chicago-stockyards': {
    label: 'Square-Pull Violence',
    offense: { tempo: 0.50, runRate: 0.64, insideBias: 0.72, outsideBias: 0.42, gapBias: 0.92, playAction: 0.58, protection: 0.69 },
    defense: { blitzRate: 0.48, disguise: 0.44, manRate: 0.52, boxAggression: 0.76, pursuitDiscipline: 0.91, tackleSecurity: 0.84 },
    coordinator: { adaptability: 0.64, memory: 0.68, exploration: 0.12, patience: 0.68, riskTolerance: 0.48 },
  },
  'minneapolis-snow-geese': {
    label: 'Formation to Flight',
    offense: { tempo: 0.62, runRate: 0.42, outsideBias: 0.68, optionRate: 0.42, playAction: 0.63, verticalRate: 0.88, misdirection: 0.71, motion: 0.94 },
    defense: { blitzRate: 0.40, disguise: 0.76, manRate: 0.39, zoneDiscipline: 0.82, pursuitDiscipline: 0.68, takeawayHunt: 0.64 },
    coordinator: { adaptability: 0.73, memory: 0.66, exploration: 0.23, patience: 0.57, riskTolerance: 0.68 },
  },
  'dallas-prairie-hounds': {
    label: 'Wide-Track Hunt',
    offense: { tempo: 0.70, runRate: 0.49, insideBias: 0.31, outsideBias: 0.92, optionRate: 0.52, screenRate: 0.62, verticalRate: 0.70, motion: 0.64 },
    defense: { blitzRate: 0.56, disguise: 0.54, manRate: 0.67, boxAggression: 0.49, pursuitDiscipline: 0.76, takeawayHunt: 0.59 },
    coordinator: { adaptability: 0.66, memory: 0.59, exploration: 0.21, patience: 0.48, riskTolerance: 0.67, fourthDownAggression: 0.61 },
  },
  'oakland-redwoods': {
    label: 'Rooted Pocket',
    offense: { tempo: 0.39, runRate: 0.46, insideBias: 0.58, gapBias: 0.55, playAction: 0.54, verticalRate: 0.63, protection: 0.94 },
    defense: { blitzRate: 0.34, disguise: 0.50, manRate: 0.46, zoneDiscipline: 0.76, boxAggression: 0.58, pursuitDiscipline: 0.75, tackleSecurity: 0.94 },
    coordinator: { adaptability: 0.62, memory: 0.75, exploration: 0.10, patience: 0.88, riskTolerance: 0.43 },
  },
  'seattle-rain-dogs': {
    label: 'Puddle-Cut Multiplicity',
    offense: { tempo: 0.61, runRate: 0.52, insideBias: 0.39, outsideBias: 0.84, optionRate: 0.50, screenRate: 0.85, misdirection: 0.70, motion: 0.74 },
    defense: { blitzRate: 0.45, disguise: 0.72, manRate: 0.51, zoneDiscipline: 0.64, pursuitDiscipline: 0.79, takeawayHunt: 0.57 },
    coordinator: { adaptability: 0.80, memory: 0.69, exploration: 0.24, patience: 0.61, riskTolerance: 0.59 },
  },
  'honolulu-wave-riders': {
    label: 'Rolling Option Tide',
    offense: { tempo: 0.58, runRate: 0.57, insideBias: 0.38, outsideBias: 0.80, optionRate: 0.96, playAction: 0.73, screenRate: 0.61, motion: 0.86 },
    defense: { blitzRate: 0.43, disguise: 0.68, manRate: 0.45, zoneDiscipline: 0.72, boxAggression: 0.53, pursuitDiscipline: 0.66, tackleSecurity: 0.69 },
    coordinator: { adaptability: 0.82, memory: 0.72, exploration: 0.25, patience: 0.73, riskTolerance: 0.63, fourthDownAggression: 0.70 },
  },
});

const mergeDNASection = (base, authored = {}) => Object.fromEntries(
  Object.keys(base).map(key => [key, clamp(authored[key] ?? base[key])]),
);

const styleDeltas = style => {
  const text = String(style || '').toLowerCase();
  const offense = {};
  const defense = {};
  const coordinator = {};
  const adjust = (target, key, amount) => { target[key] = (target[key] || 0) + amount; };
  if (/slow|patient|waddl/.test(text)) { adjust(offense, 'tempo', -0.11); adjust(coordinator, 'patience', 0.12); }
  if (/burst|erupt|flight|wide|longboard/.test(text)) { adjust(offense, 'verticalRate', 0.10); adjust(offense, 'outsideBias', 0.08); }
  if (/misdirection|motion|formation|option|wave/.test(text)) { adjust(offense, 'misdirection', 0.13); adjust(offense, 'motion', 0.11); adjust(coordinator, 'adaptability', 0.06); }
  if (/downhill|heavy|pull|pile|root/.test(text)) { adjust(offense, 'runRate', 0.11); adjust(offense, 'insideBias', 0.10); adjust(defense, 'boxAggression', 0.08); }
  if (/pass set|pocket|tower/.test(text)) adjust(offense, 'protection', 0.16);
  if (/cut|change of direction|puddle/.test(text)) { adjust(offense, 'outsideBias', 0.12); adjust(offense, 'screenRate', 0.09); }
  if (/pursuit|tracking|tackl/.test(text)) { adjust(defense, 'pursuitDiscipline', 0.13); adjust(defense, 'tackleSecurity', 0.10); }
  return { offense, defense, coordinator };
};

/**
 * Convert an existing team object (or team id string) into stable strategic DNA.
 * Existing ids receive authored profiles. Future teams fall back to conservative
 * defaults plus keyword inference from `style`, `motion`, or `description`.
 */
export function deriveTeamDNA(team) {
  const source = typeof team === 'string' ? { id: team } : (team || {});
  const id = String(source.id || 'unknown-team');
  const authored = AMERICAN_FOOTBALL_TEAM_DNA[id];
  const style = [source.style, source.motion, source.description].filter(Boolean).join(' · ');
  const inferred = authored ? { offense: {}, defense: {}, coordinator: {} } : styleDeltas(style);
  const section = (name) => {
    const base = mergeDNASection(DNA_DEFAULTS[name], authored?.[name]);
    return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, clamp(value + (inferred[name]?.[key] || 0))]));
  };
  return {
    id,
    label: authored?.label || source.name || 'Balanced Identity',
    source: authored ? 'authored' : style ? 'style-derived' : 'default',
    style,
    offense: section('offense'),
    defense: section('defense'),
    coordinator: section('coordinator'),
  };
}

const BASE_RATINGS = deepFreeze({
  speed: 0.56, acceleration: 0.56, agility: 0.55, strength: 0.56, stamina: 0.60, durability: 0.60,
  awareness: 0.55, composure: 0.55, discipline: 0.56, vision: 0.52, ballSecurity: 0.54,
  throwPower: 0.25, throwAccuracy: 0.25, anticipation: 0.30, pocketSense: 0.34,
  hands: 0.45, release: 0.38, routeRunning: 0.38, contestedCatch: 0.42,
  passBlock: 0.28, runBlock: 0.30, passRush: 0.28, blockShed: 0.34,
  manCoverage: 0.28, zoneCoverage: 0.31, ballSkills: 0.38, pursuit: 0.44, tackle: 0.42,
});

const ROLE_ALIASES = deepFreeze({
  quarterback: 'QB', qb: 'QB', 'running back': 'RB', rb: 'RB', receiver: 'X', x: 'X',
  'z receiver': 'Z', z: 'Z', 'slot receiver': 'SLOT', slot: 'SLOT', 'tight end': 'TE', te: 'TE',
  'left tackle': 'LT', lt: 'LT', 'left guard': 'LG', lg: 'LG', center: 'C', c: 'C',
  'right guard': 'RG', rg: 'RG', 'right tackle': 'RT', rt: 'RT',
  'left defensive end': 'LDE', lde: 'LDE', 'right defensive end': 'RDE', rde: 'RDE',
  'defensive tackle': 'DT', dt: 'DT', 'nose tackle': 'NT', nt: 'NT', linebacker: 'MIKE', mike: 'MIKE',
  'weakside linebacker': 'WILL', will: 'WILL', 'strongside linebacker': 'SAM', sam: 'SAM',
  'left cornerback': 'LCB', lcb: 'LCB', 'right cornerback': 'RCB', rcb: 'RCB',
  safety: 'FS', fs: 'FS', 'strong safety': 'SS', ss: 'SS',
});

const ROLE_OVERLAYS = deepFreeze({
  QB: { speed: 0.57, acceleration: 0.56, agility: 0.57, awareness: 0.73, composure: 0.70, vision: 0.73, ballSecurity: 0.66, throwPower: 0.78, throwAccuracy: 0.76, anticipation: 0.72, pocketSense: 0.72 },
  RB: { speed: 0.80, acceleration: 0.84, agility: 0.82, strength: 0.62, vision: 0.78, ballSecurity: 0.74, hands: 0.64, routeRunning: 0.55, passBlock: 0.48 },
  X: { speed: 0.78, acceleration: 0.76, agility: 0.72, hands: 0.76, release: 0.72, routeRunning: 0.72, contestedCatch: 0.77, ballSkills: 0.66 },
  Z: { speed: 0.84, acceleration: 0.82, agility: 0.76, hands: 0.73, release: 0.79, routeRunning: 0.73, contestedCatch: 0.65, ballSkills: 0.63 },
  SLOT: { speed: 0.76, acceleration: 0.79, agility: 0.84, awareness: 0.68, hands: 0.77, release: 0.75, routeRunning: 0.84, contestedCatch: 0.59 },
  TE: { speed: 0.67, acceleration: 0.64, agility: 0.61, strength: 0.76, hands: 0.73, release: 0.59, routeRunning: 0.67, contestedCatch: 0.79, passBlock: 0.64, runBlock: 0.73 },
  OL: { speed: 0.37, acceleration: 0.42, agility: 0.47, strength: 0.84, stamina: 0.70, awareness: 0.64, passBlock: 0.78, runBlock: 0.79, blockShed: 0.18, tackle: 0.26 },
  DE: { speed: 0.66, acceleration: 0.72, agility: 0.64, strength: 0.77, awareness: 0.64, passRush: 0.80, blockShed: 0.76, pursuit: 0.70, tackle: 0.70, zoneCoverage: 0.35 },
  IDL: { speed: 0.43, acceleration: 0.55, agility: 0.46, strength: 0.89, stamina: 0.64, passRush: 0.68, blockShed: 0.84, pursuit: 0.54, tackle: 0.75 },
  LB: { speed: 0.69, acceleration: 0.71, agility: 0.66, strength: 0.72, awareness: 0.70, manCoverage: 0.57, zoneCoverage: 0.69, ballSkills: 0.58, blockShed: 0.67, pursuit: 0.80, tackle: 0.82 },
  CB: { speed: 0.85, acceleration: 0.83, agility: 0.84, strength: 0.48, awareness: 0.69, manCoverage: 0.82, zoneCoverage: 0.72, ballSkills: 0.75, pursuit: 0.67, tackle: 0.55 },
  S: { speed: 0.78, acceleration: 0.76, agility: 0.75, strength: 0.61, awareness: 0.78, manCoverage: 0.68, zoneCoverage: 0.82, ballSkills: 0.78, pursuit: 0.78, tackle: 0.73 },
});

const roleGroup = role => {
  if (['LT', 'LG', 'C', 'RG', 'RT'].includes(role)) return 'OL';
  if (['LDE', 'RDE'].includes(role)) return 'DE';
  if (['DT', 'NT'].includes(role)) return 'IDL';
  if (['MIKE', 'WILL', 'SAM'].includes(role)) return 'LB';
  if (['LCB', 'RCB'].includes(role)) return 'CB';
  if (['FS', 'SS'].includes(role)) return 'S';
  return role;
};

const TEXT_TRAIT_RULES = deepFreeze([
  [/burst|erupt|flight|closing range|fast|speed/, { speed: 0.04, acceleration: 0.05 }],
  [/cut|angle|mirror|redirect|escape|option|turns like/, { agility: 0.05, vision: 0.025 }],
  [/anchor|wall|pile|power|gravity|road grader|downhill/, { strength: 0.055, durability: 0.025 }],
  [/read|identif|recogn|count|patient|square|collect/, { awareness: 0.05, discipline: 0.025 }],
  [/throw|pass|receiver.*open/, { throwAccuracy: 0.055, anticipation: 0.055, throwPower: 0.02 }],
  [/deep|vertical|long throw/, { throwPower: 0.035, speed: 0.02 }],
  [/catch|secure|hands|reach/, { hands: 0.05, contestedCatch: 0.035, ballSecurity: 0.03 }],
  [/route|seam|crosser|release/, { routeRunning: 0.05, release: 0.04, awareness: 0.02 }],
  [/block|pull|seal|double.team|road grader/, { runBlock: 0.055, strength: 0.025 }],
  [/pocket|pass set|blind.side|speed rusher/, { passBlock: 0.06, awareness: 0.025 }],
  [/rush|sack|get.off|edge|splitter/, { passRush: 0.055, blockShed: 0.035, acceleration: 0.02 }],
  [/tackle|collision|pursuit|arrives|run fit/, { tackle: 0.055, pursuit: 0.05 }],
  [/pickpocket|coverage|mirror|stays square|press/, { manCoverage: 0.05, ballSkills: 0.03 }],
  [/deep.field|safety|middle.field|erase|carry/, { zoneCoverage: 0.055, awareness: 0.03 }],
  [/steal|gamble|pick/, { ballSkills: 0.05, discipline: -0.025 }],
  [/tired|fatigue|long drive/, { stamina: 0.05, durability: 0.02 }],
]);

const applyTraitText = (ratings, text, direction) => {
  const lower = String(text || '').toLowerCase();
  if (!lower) return;
  for (const [pattern, changes] of TEXT_TRAIT_RULES) {
    if (!pattern.test(lower)) continue;
    for (const [trait, amount] of Object.entries(changes)) ratings[trait] = clamp(ratings[trait] + amount * direction);
  }
};

const canonicalRole = role => ROLE_ALIASES[String(role || '').trim().toLowerCase()] || String(role || 'ATH').trim().toUpperCase();

/**
 * Derive a stable football trait sheet from an existing athlete and semantic
 * role. Source signature/archetype text creates small, explainable modifiers;
 * the athlete id supplies bounded deterministic variation.
 */
export function derivePlayerTraits(athlete, role = athlete?.role, teamDNA = null) {
  const source = athlete || {};
  const canonical = canonicalRole(role);
  const group = roleGroup(canonical);
  const overlay = ROLE_OVERLAYS[canonical] || ROLE_OVERLAYS[group] || {};
  const seed = source.id || `${source.name || 'athlete'}|${canonical}`;
  const ratings = {};
  for (const [trait, baseline] of Object.entries(BASE_RATINGS)) {
    const roleValue = overlay[trait] ?? baseline;
    const variance = (hashUnit(`${seed}|${trait}`) - 0.5) * 0.12;
    ratings[trait] = clamp(roleValue + variance, 0.18, 0.96);
  }
  applyTraitText(ratings, `${source.archetype || ''} ${source.signature || ''}`, 1);
  applyTraitText(ratings, source.flaw, -1.08);
  for (const key of Object.keys(ratings)) ratings[key] = round(clamp(ratings[key], 0.18, 0.96));

  const dna = teamDNA?.offense ? teamDNA : deriveTeamDNA(teamDNA || source.teamId || 'unknown-team');
  const defensiveRole = ['DE', 'IDL', 'LB', 'CB', 'S'].includes(group);
  const tendencies = {
    aggression: round(clamp(dna.coordinator.riskTolerance * 0.55 + ratings.composure * 0.20 + hashUnit(`${seed}|aggression`) * 0.25)),
    patience: round(clamp(dna.coordinator.patience * 0.55 + ratings.awareness * 0.30 + hashUnit(`${seed}|patience`) * 0.15)),
    discipline: ratings.discipline,
    improvisation: round(clamp(ratings.agility * 0.35 + ratings.awareness * 0.30 + hashUnit(`${seed}|improv`) * 0.35)),
    cutbackBias: round(clamp(dna.offense.outsideBias * 0.35 + ratings.vision * 0.40 + hashUnit(`${seed}|cutback`) * 0.25)),
    ballHunt: round(clamp((defensiveRole ? dna.defense.takeawayHunt : 0.35) * 0.45 + ratings.ballSkills * 0.40 + hashUnit(`${seed}|ball-hunt`) * 0.15)),
  };
  const ranked = Object.entries(ratings).sort((a, b) => b[1] - a[1]);
  return {
    id: source.id || seed,
    name: source.name || 'Unknown athlete',
    role: canonical,
    group,
    ratings,
    tendencies,
    strengths: ranked.slice(0, 3).map(([trait]) => trait),
    liabilities: ranked.slice(-2).reverse().map(([trait]) => trait),
  };
}

const emptySignals = () => ({
  ownRun: 0, ownVertical: 0, ownPerimeter: 0, ownPressure: 0,
  opponentRun: 0, opponentVertical: 0, opponentPerimeter: 0, opponentScreen: 0, opponentBlitz: 0,
});

/** Create a new immutable-by-convention coordinator memory snapshot. */
export function createCoordinatorMemory(teamId = 'unknown-team') {
  return {
    version: 1,
    teamId: String(teamId),
    snaps: 0,
    offense: { snaps: 0, calls: {}, concepts: {} },
    defense: { snaps: 0, calls: {}, concepts: {} },
    observed: { offenseCalls: {}, defenseCalls: {} },
    signals: emptySignals(),
    matchups: {},
    recent: [],
  };
}

const statCopy = stat => ({
  attempts: stat?.attempts || 0,
  successes: stat?.successes || 0,
  totalYards: stat?.totalYards || 0,
  explosives: stat?.explosives || 0,
  turnovers: stat?.turnovers || 0,
  pressures: stat?.pressures || 0,
  sacks: stat?.sacks || 0,
  lastSnap: Number.isFinite(stat?.lastSnap) ? stat.lastSnap : -1,
});

const cloneStats = map => Object.fromEntries(Object.entries(map || {}).map(([key, stat]) => [key, statCopy(stat)]));

const cloneMemory = memory => {
  const source = memory || createCoordinatorMemory();
  return {
    version: 1,
    teamId: String(source.teamId || 'unknown-team'),
    snaps: source.snaps || 0,
    offense: { snaps: source.offense?.snaps || 0, calls: cloneStats(source.offense?.calls), concepts: cloneStats(source.offense?.concepts) },
    defense: { snaps: source.defense?.snaps || 0, calls: cloneStats(source.defense?.calls), concepts: cloneStats(source.defense?.concepts) },
    observed: { offenseCalls: cloneStats(source.observed?.offenseCalls), defenseCalls: cloneStats(source.observed?.defenseCalls) },
    signals: { ...emptySignals(), ...(source.signals || {}) },
    matchups: Object.fromEntries(Object.entries(source.matchups || {}).map(([key, value]) => [key, { ...value }])),
    recent: (source.recent || []).map(item => ({ ...item })),
  };
};

const normalizeCallId = call => String(typeof call === 'string' ? call : call?.id || call?.name || '').trim().toUpperCase();

/** Current play concepts and semantic tags used by adaptive call scoring. */
export const OFFENSIVE_CALL_CATALOG = deepFreeze({
  'INSIDE ZONE': { kind: 'run', concepts: ['run', 'inside', 'zone'] },
  'OUTSIDE ZONE': { kind: 'run', concepts: ['run', 'outside', 'zone', 'perimeter'] },
  POWER: { kind: 'run', concepts: ['run', 'inside', 'gap', 'power'] },
  'COUNTER GT': { kind: 'run', concepts: ['run', 'inside', 'gap', 'counter', 'misdirection'] },
  'JET SWEEP': { kind: 'run', concepts: ['run', 'outside', 'perimeter', 'motion', 'misdirection'] },
  'READ OPTION': { kind: 'run', concepts: ['run', 'option', 'outside', 'perimeter', 'misdirection'] },
  'QUICK SLANTS': { kind: 'pass', concepts: ['pass', 'quick', 'middle', 'man-beater'] },
  MESH: { kind: 'pass', concepts: ['pass', 'quick', 'middle', 'man-beater', 'zone-settle'] },
  'PLAY ACTION CROSS': { kind: 'pass', concepts: ['pass', 'play-action', 'intermediate', 'misdirection', 'zone-beater'] },
  'FOUR VERTICALS': { kind: 'pass', concepts: ['pass', 'deep', 'vertical', 'zone-stress'] },
  'FLOOD CONCEPT': { kind: 'pass', concepts: ['pass', 'play-action', 'intermediate', 'perimeter', 'zone-beater'] },
  'SEAM SHOT': { kind: 'pass', concepts: ['pass', 'deep', 'vertical', 'middle', 'zone-stress'] },
  'RB SCREEN': { kind: 'pass', concepts: ['pass', 'screen', 'perimeter', 'blitz-beater'] },
  'FIELD GOAL': { kind: 'special', concepts: ['field-goal'] },
  PUNT: { kind: 'special', concepts: ['punt'] },
});

/** Current defensive calls and semantic tags used by adaptive call scoring. */
export const DEFENSIVE_CALL_CATALOG = deepFreeze({
  'COVER 3': { family: 'zone', concepts: ['zone', 'single-high', 'balanced', 'run-support'] },
  'COVER 2 MAN': { family: 'man', concepts: ['man', 'two-high', 'press', 'underneath'] },
  QUARTERS: { family: 'zone', concepts: ['zone', 'two-high', 'deep-defense', 'pattern-match'] },
  'NICKEL FIRE': { family: 'pressure', concepts: ['blitz', 'disguise', 'quick-pressure', 'light-box'] },
  'BEAR FRONT': { family: 'front', concepts: ['heavy-box', 'run-defense', 'single-high'] },
  'COVER 1 ROBBER': { family: 'man', concepts: ['man', 'single-high', 'robber', 'middle-help'] },
  'GOAL LINE': { family: 'front', concepts: ['goal-line', 'heavy-box', 'run-defense'] },
});

const callMeta = (call, catalog) => {
  const id = normalizeCallId(call);
  const authored = catalog[id] || {};
  const supplied = typeof call === 'object' && call ? call : {};
  return {
    id,
    call,
    kind: supplied.kind || authored.kind,
    family: supplied.family || authored.family,
    concepts: [...new Set([...(authored.concepts || []), ...(supplied.concepts || supplied.tags || [])])],
  };
};

const hasConcept = (meta, concept) => meta.concepts.includes(concept);

const successForSituation = outcome => {
  if (typeof outcome.offenseSuccess === 'boolean') return outcome.offenseSuccess;
  if (outcome.touchdown || outcome.firstDown) return true;
  if (outcome.turnover || outcome.sack) return false;
  const down = clamp(Number(outcome.situation?.down || outcome.down || 1), 1, 4);
  const toGo = Math.max(0.5, Number(outcome.situation?.toGo || outcome.toGo || 10));
  const yards = Number(outcome.yards || 0);
  if (down === 1) return yards >= Math.min(4, toGo);
  if (down === 2) return yards >= Math.min(5, toGo * 0.55);
  return yards >= toGo;
};

const updateStat = (map, key, facts) => {
  if (!key) return;
  const stat = statCopy(map[key]);
  stat.attempts += 1;
  stat.successes += facts.success ? 1 : 0;
  stat.totalYards += facts.yards;
  stat.explosives += facts.explosive ? 1 : 0;
  stat.turnovers += facts.turnover ? 1 : 0;
  stat.pressures += facts.pressure ? 1 : 0;
  stat.sacks += facts.sack ? 1 : 0;
  stat.lastSnap = facts.snap;
  map[key] = stat;
};

const updateConceptStats = (map, meta, facts) => {
  for (const concept of meta.concepts) updateStat(map, concept, facts);
};

const decaySignals = signals => Object.fromEntries(Object.entries(signals).map(([key, value]) => [key, clamp(value * 0.86)]));

/**
 * Record one completed snap from this memory's team perspective. `teamSide`
 * identifies whether the team was on offense or defense. Returns a new memory.
 */
export function recordPlayOutcome(memory, outcome = {}) {
  const next = cloneMemory(memory);
  const snap = next.snaps + 1;
  const teamSide = outcome.teamSide === 'defense' ? 'defense' : 'offense';
  const offense = callMeta(outcome.offenseCall, OFFENSIVE_CALL_CATALOG);
  const defense = callMeta(outcome.defenseCall, DEFENSIVE_CALL_CATALOG);
  const offenseSuccess = successForSituation(outcome);
  const yards = Number.isFinite(Number(outcome.yards)) ? Number(outcome.yards) : 0;
  const explosive = typeof outcome.explosive === 'boolean' ? outcome.explosive : (offense.kind === 'run' ? yards >= 10 : yards >= 20);
  const pressure = Number(outcome.pressure || 0) >= 0.55 || Boolean(outcome.pressured);
  const facts = { snap, yards, explosive, turnover: Boolean(outcome.turnover), pressure, sack: Boolean(outcome.sack) };

  next.snaps = snap;
  next.offense.snaps += teamSide === 'offense' ? 1 : 0;
  next.defense.snaps += teamSide === 'defense' ? 1 : 0;
  if (teamSide === 'offense') {
    updateStat(next.offense.calls, offense.id, { ...facts, success: offenseSuccess });
    updateConceptStats(next.offense.concepts, offense, { ...facts, success: offenseSuccess });
    updateStat(next.observed.defenseCalls, defense.id, { ...facts, success: !offenseSuccess });
  } else {
    updateStat(next.defense.calls, defense.id, { ...facts, success: !offenseSuccess });
    updateConceptStats(next.defense.concepts, defense, { ...facts, success: !offenseSuccess });
    updateStat(next.observed.offenseCalls, offense.id, { ...facts, success: offenseSuccess });
  }

  next.signals = decaySignals(next.signals);
  const signalBoost = clamp(0.08 + Math.max(0, yards) * 0.012 + (explosive ? 0.18 : 0), 0.08, 0.36);
  if (teamSide === 'offense') {
    if (offense.kind === 'run') next.signals.ownRun = clamp(next.signals.ownRun + signalBoost);
    if (hasConcept(offense, 'deep') || hasConcept(offense, 'vertical')) next.signals.ownVertical = clamp(next.signals.ownVertical + signalBoost);
    if (hasConcept(offense, 'perimeter')) next.signals.ownPerimeter = clamp(next.signals.ownPerimeter + signalBoost);
    if (hasConcept(defense, 'blitz')) next.signals.opponentBlitz = clamp(next.signals.opponentBlitz + 0.18 + (pressure ? 0.12 : 0));
  } else {
    if (offense.kind === 'run') next.signals.opponentRun = clamp(next.signals.opponentRun + signalBoost);
    if (hasConcept(offense, 'deep') || hasConcept(offense, 'vertical')) next.signals.opponentVertical = clamp(next.signals.opponentVertical + signalBoost);
    if (hasConcept(offense, 'perimeter')) next.signals.opponentPerimeter = clamp(next.signals.opponentPerimeter + signalBoost);
    if (hasConcept(offense, 'screen')) next.signals.opponentScreen = clamp(next.signals.opponentScreen + signalBoost);
    if (hasConcept(defense, 'blitz') && pressure) next.signals.ownPressure = clamp(next.signals.ownPressure + 0.22);
  }

  next.recent.unshift({
    snap, teamSide, offenseCall: offense.id, defenseCall: defense.id, offenseSuccess,
    yards: round(yards, 1), explosive, turnover: Boolean(outcome.turnover), pressure, sack: Boolean(outcome.sack),
  });
  next.recent = next.recent.slice(0, 12);
  return next;
}

/**
 * Record a persistent individual matchup result. `winner` accepts `team`/`us`,
 * `opponent`/`them`, or `neutral`. Matchup `phase` lets callers query line,
 * coverage, and tackling edges separately.
 */
export function recordMatchupWin(memory, matchup = {}) {
  const next = cloneMemory(memory);
  const key = String(matchup.key || `${matchup.ourPlayerId || 'team'}:${matchup.theirPlayerId || 'opponent'}:${matchup.phase || 'general'}`);
  const current = next.matchups[key] || { key, phase: matchup.phase || 'general', wins: 0, losses: 0, neutral: 0, weightFor: 0, weightAgainst: 0, streak: 0, lastDetail: '' };
  const weight = clamp(Number(matchup.weight ?? 1), 0.1, 4);
  const winner = String(matchup.winner || 'neutral').toLowerCase();
  const won = winner === 'team' || winner === 'us' || winner === 'ours';
  const lost = winner === 'opponent' || winner === 'them' || winner === 'theirs';
  const updated = { ...current, phase: matchup.phase || current.phase || 'general' };
  if (won) { updated.wins += 1; updated.weightFor += weight; updated.streak = Math.max(1, updated.streak + 1); }
  else if (lost) { updated.losses += 1; updated.weightAgainst += weight; updated.streak = Math.min(-1, updated.streak - 1); }
  else { updated.neutral += 1; updated.streak = 0; }
  const denominator = updated.weightFor + updated.weightAgainst + updated.neutral * 0.35 + 1.5;
  updated.edge = round(clamp((updated.weightFor - updated.weightAgainst) / denominator, -1, 1));
  updated.lastDetail = String(matchup.detail || current.lastDetail || '');
  next.matchups[key] = updated;
  return next;
}

const situationValues = situation => {
  const down = clamp(Number(situation?.down || 1), 1, 4);
  const toGo = Math.max(0.5, Number(situation?.toGo || 10));
  const ballSpot = clamp(Number(situation?.ballSpot ?? 25), 0, 100);
  const quarter = clamp(Number(situation?.quarter || 1), 1, 6);
  const clock = Math.max(0, Number(situation?.clock ?? 300));
  const scoreFor = Number(situation?.scoreFor || 0);
  const scoreAgainst = Number(situation?.scoreAgainst || 0);
  const goalDistance = Math.max(0, Number(situation?.goalDistance ?? 100 - ballSpot));
  return {
    down, toGo, ballSpot, quarter, clock, scoreFor, scoreAgainst, goalDistance,
    scoreDiff: scoreFor - scoreAgainst,
    late: quarter >= 4 && clock <= 120,
    short: toGo <= 3,
    long: toGo >= 7,
    redZone: goalDistance <= 20,
    goalToGo: goalDistance <= 10,
  };
};

const adjustmentCollector = () => {
  const entries = [];
  return {
    add(value, label) { if (Number.isFinite(value) && value !== 0) entries.push({ label, impact: value }); return value || 0; },
    reasons() { return entries.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 5).map(entry => ({ label: entry.label, impact: round(entry.impact) })); },
  };
};

const memoryCallRate = (map, predicate) => {
  const entries = Object.entries(map || {});
  const total = entries.reduce((sum, [, stat]) => sum + (stat.attempts || 0), 0);
  if (!total) return 0;
  const matches = entries.reduce((sum, [id, stat]) => sum + (predicate(callMeta(id, id in OFFENSIVE_CALL_CATALOG ? OFFENSIVE_CALL_CATALOG : DEFENSIVE_CALL_CATALOG)) ? stat.attempts || 0 : 0), 0);
  return matches / total;
};

const recentRepeatCount = (memory, side, id, horizon = 6) => (memory?.recent || []).slice(0, horizon).filter(item => item[side === 'offense' ? 'offenseCall' : 'defenseCall'] === id).length;

const matchupPhaseEdge = (memory, phases) => {
  const wanted = new Set(Array.isArray(phases) ? phases : [phases]);
  const entries = Object.values(memory?.matchups || {}).filter(matchup => wanted.has(matchup.phase));
  if (!entries.length) return 0;
  return entries.reduce((sum, matchup) => sum + Number(matchup.edge || 0), 0) / entries.length;
};

const empiricalEdge = stat => stat?.attempts ? ((stat.successes + 1.5) / (stat.attempts + 3) - 0.5) * 2 : 0;

/**
 * Score available offensive calls. The result is sorted best-first and contains
 * normalized `score`, unbounded `rawScore`, and the strongest causal reasons.
 */
export function rankOffensiveCalls({ calls = Object.keys(OFFENSIVE_CALL_CATALOG), situation = {}, teamDNA, memory = createCoordinatorMemory(), rng = null } = {}) {
  const dna = teamDNA?.offense ? teamDNA : deriveTeamDNA(teamDNA || memory.teamId);
  const sit = situationValues(situation);
  const defensiveBlitzRate = memoryCallRate(memory.observed?.defenseCalls, meta => hasConcept(meta, 'blitz'));
  const defensiveHeavyRate = memoryCallRate(memory.observed?.defenseCalls, meta => hasConcept(meta, 'heavy-box'));
  const defensiveTwoHighRate = memoryCallRate(memory.observed?.defenseCalls, meta => hasConcept(meta, 'two-high'));
  const protectionEdge = matchupPhaseEdge(memory, ['pass-protection', 'pass-rush']);
  const runBlockEdge = matchupPhaseEdge(memory, ['run-block', 'run-fit']);
  const coverageEdge = matchupPhaseEdge(memory, ['route', 'coverage']);

  return calls.map(call => {
    const meta = callMeta(call, OFFENSIVE_CALL_CATALOG);
    const adjust = adjustmentCollector();
    let raw = 0;
    const add = (value, reason) => { raw += adjust.add(value, reason); };

    if (meta.kind === 'run') add((dna.offense.runRate - 0.5) * 0.85, 'team run identity');
    if (meta.kind === 'pass') add((0.5 - dna.offense.runRate) * 0.68, 'team pass tendency');
    if (hasConcept(meta, 'inside')) add((dna.offense.insideBias - 0.5) * 0.62, 'inside-run identity');
    if (hasConcept(meta, 'outside')) add((dna.offense.outsideBias - 0.5) * 0.62, 'perimeter identity');
    if (hasConcept(meta, 'gap')) add((dna.offense.gapBias - 0.5) * 0.70, 'gap-scheme identity');
    if (hasConcept(meta, 'option')) add((dna.offense.optionRate - 0.5) * 0.72, 'option identity');
    if (hasConcept(meta, 'play-action')) add((dna.offense.playAction - 0.5) * 0.72, 'play-action identity');
    if (hasConcept(meta, 'screen')) add((dna.offense.screenRate - 0.5) * 0.66, 'screen identity');
    if (hasConcept(meta, 'vertical')) add((dna.offense.verticalRate - 0.5) * 0.70, 'vertical identity');
    if (hasConcept(meta, 'misdirection')) add((dna.offense.misdirection - 0.5) * 0.48, 'misdirection identity');

    if (sit.down === 4) {
      const kickDistance = sit.goalDistance + 17;
      if (hasConcept(meta, 'field-goal')) add(kickDistance <= 55 ? 1.55 - Math.max(0, kickDistance - 42) * 0.035 : -1.10, 'fourth-down kick range');
      else if (hasConcept(meta, 'punt')) add(!sit.late || sit.scoreDiff >= 0 ? 1.05 + clamp((sit.goalDistance - 45) / 45, 0, 0.35) : -0.70, 'fourth-down field position');
      else if (sit.short) add(0.52, 'short conversion distance');
      else if (sit.long) add(hasConcept(meta, 'deep') || hasConcept(meta, 'middle') ? 0.30 : -0.22, 'long conversion distance');
    } else if (meta.kind === 'special') add(-2.1, 'not fourth down');

    if (sit.short && meta.kind === 'run') add(hasConcept(meta, 'inside') ? 0.29 : 0.13, 'short-yardage efficiency');
    if (sit.short && hasConcept(meta, 'quick')) add(0.16, 'quick conversion answer');
    if (sit.long && meta.kind === 'run') add(hasConcept(meta, 'screen') ? 0 : -0.28, 'long-yardage requirement');
    if (sit.long && (hasConcept(meta, 'middle') || hasConcept(meta, 'deep'))) add(0.24, 'routes reach the sticks');
    if (sit.redZone && hasConcept(meta, 'deep')) add(-0.18, 'compressed red-zone space');
    if (sit.goalToGo && (hasConcept(meta, 'inside') || hasConcept(meta, 'quick'))) add(0.20, 'goal-to-go geometry');
    if (sit.late && sit.scoreDiff < 0 && meta.kind === 'pass') add(0.28 + (hasConcept(meta, 'vertical') ? 0.18 : 0), 'late-game scoring urgency');
    if (sit.late && sit.scoreDiff > 0 && meta.kind === 'run') add(0.28, 'late-game clock control');

    if (hasConcept(meta, 'play-action')) add(memory.signals.ownRun * 0.52, 'run game has influenced second-level defenders');
    if (hasConcept(meta, 'screen') || hasConcept(meta, 'quick')) add(Math.max(memory.signals.opponentBlitz, defensiveBlitzRate) * 0.38, 'pressure tendency creates a fast answer');
    if (hasConcept(meta, 'deep')) add(-Math.max(memory.signals.opponentBlitz, defensiveBlitzRate) * 0.24, 'pressure compresses deep timing');
    if (defensiveHeavyRate > 0.30) {
      if (hasConcept(meta, 'play-action') || hasConcept(meta, 'outside') || hasConcept(meta, 'quick')) add(defensiveHeavyRate * 0.24, 'heavy boxes expose space away from the core');
      if (hasConcept(meta, 'inside')) add(-defensiveHeavyRate * 0.22, 'heavy box crowds interior gaps');
    }
    if (defensiveTwoHighRate > 0.30) {
      if (meta.kind === 'run' || hasConcept(meta, 'middle')) add(defensiveTwoHighRate * 0.18, 'two-high structure concedes underneath numbers');
      if (hasConcept(meta, 'vertical')) add(-defensiveTwoHighRate * 0.17, 'two-high structure caps vertical access');
    }

    if (meta.kind === 'pass') add(protectionEdge * 0.20 + coverageEdge * 0.15, protectionEdge + coverageEdge >= 0 ? 'pass matchups are holding' : 'pass matchups are losing');
    if (meta.kind === 'run') add(runBlockEdge * 0.24, runBlockEdge >= 0 ? 'run-blocking matchup edge' : 'front is defeating run blocks');

    const callStat = memory.offense?.calls?.[meta.id];
    if (callStat?.attempts >= 2) add(empiricalEdge(callStat) * dna.coordinator.memory * 0.22, 'learned success of this call');
    const repeats = recentRepeatCount(memory, 'offense', meta.id);
    if (repeats > 0) add(-repeats * (0.10 + dna.coordinator.memory * 0.05), 'recent repetition is becoming predictable');
    const prior = memory.recent?.[0];
    if (prior && hasConcept(meta, 'play-action') && OFFENSIVE_CALL_CATALOG[prior.offenseCall]?.kind === 'run') add(0.13, 'direct run-to-play-action sequencing');

    add((rngUnit(rng) - 0.5) * dna.coordinator.exploration * 0.20, 'coordinator exploration');
    return { id: meta.id, call: meta.call, score: round(sigmoid(raw * 1.65)), rawScore: round(raw), reasons: adjust.reasons(), concepts: meta.concepts.slice() };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/** Score available defensive calls against situation and learned tendencies. */
export function rankDefensiveCalls({ calls = Object.keys(DEFENSIVE_CALL_CATALOG), situation = {}, teamDNA, memory = createCoordinatorMemory(), offenseHints = {}, rng = null } = {}) {
  const dna = teamDNA?.defense ? teamDNA : deriveTeamDNA(teamDNA || memory.teamId);
  const sit = situationValues(situation);
  const observedRunRate = memoryCallRate(memory.observed?.offenseCalls, meta => meta.kind === 'run');
  const observedDeepRate = memoryCallRate(memory.observed?.offenseCalls, meta => hasConcept(meta, 'deep') || hasConcept(meta, 'vertical'));
  const observedScreenRate = memoryCallRate(memory.observed?.offenseCalls, meta => hasConcept(meta, 'screen'));
  const runProbability = clamp(offenseHints.runProbability ?? Math.max(observedRunRate, memory.signals.opponentRun * 0.75));
  const deepProbability = clamp(offenseHints.deepProbability ?? Math.max(observedDeepRate, memory.signals.opponentVertical * 0.72));
  const screenProbability = clamp(offenseHints.screenProbability ?? Math.max(observedScreenRate, memory.signals.opponentScreen * 0.72));
  const rushEdge = matchupPhaseEdge(memory, ['pass-rush', 'pass-protection']);
  const coverageEdge = matchupPhaseEdge(memory, ['coverage', 'route']);
  const runFitEdge = matchupPhaseEdge(memory, ['run-fit', 'run-block']);

  return calls.map(call => {
    const meta = callMeta(call, DEFENSIVE_CALL_CATALOG);
    const adjust = adjustmentCollector();
    let raw = 0;
    const add = (value, reason) => { raw += adjust.add(value, reason); };

    if (hasConcept(meta, 'blitz')) add((dna.defense.blitzRate - 0.5) * 0.76, 'team pressure identity');
    if (hasConcept(meta, 'disguise') || hasConcept(meta, 'robber')) add((dna.defense.disguise - 0.5) * 0.65, 'coverage disguise identity');
    if (meta.family === 'man') add((dna.defense.manRate - 0.5) * 0.70, 'man-coverage identity');
    if (meta.family === 'zone') add((dna.defense.zoneDiscipline - 0.5) * 0.66, 'zone-coverage identity');
    if (hasConcept(meta, 'heavy-box')) add((dna.defense.boxAggression - 0.5) * 0.72, 'box-count identity');
    if (hasConcept(meta, 'balanced')) add((dna.defense.pursuitDiscipline - 0.5) * 0.32, 'pursuit discipline');

    if (sit.short && (hasConcept(meta, 'heavy-box') || hasConcept(meta, 'run-support'))) add(0.34, 'short-yardage run fit');
    if (sit.long && (hasConcept(meta, 'deep-defense') || hasConcept(meta, 'blitz'))) add(0.28, 'long-yardage pass expectation');
    if (sit.long && hasConcept(meta, 'heavy-box')) add(-0.27, 'heavy personnel exposes long-yardage space');
    if (sit.goalToGo && hasConcept(meta, 'goal-line')) add(0.75, 'goal-line field geometry');
    if (!sit.goalToGo && hasConcept(meta, 'goal-line')) add(-1.15, 'goal-line call outside goal-to-go');
    if (sit.redZone && hasConcept(meta, 'two-high')) add(-0.10, 'compressed deep field reduces two-high value');

    if (hasConcept(meta, 'heavy-box')) add(runProbability * 0.48, 'opponent run tendency');
    if (hasConcept(meta, 'run-support')) add(runProbability * 0.22, 'safety can enter the run fit');
    if (hasConcept(meta, 'deep-defense')) add(deepProbability * 0.54, 'opponent vertical tendency');
    if (hasConcept(meta, 'single-high') && deepProbability > 0.45) add(-deepProbability * 0.24, 'single-high stress against vertical tendency');
    if (hasConcept(meta, 'blitz')) add(-screenProbability * 0.48, 'screen tendency punishes pressure');
    if (hasConcept(meta, 'pattern-match')) add(screenProbability * 0.13, 'pattern match keeps second-level eyes available');

    if (hasConcept(meta, 'blitz')) add(rushEdge * 0.24 + memory.signals.ownPressure * 0.20, rushEdge >= 0 ? 'rush matchup can finish pressure' : 'rushers have not converted pressure');
    if (meta.family === 'man' || meta.family === 'zone') add(coverageEdge * 0.20, coverageEdge >= 0 ? 'coverage matchup edge' : 'receivers are winning coverage matchups');
    if (hasConcept(meta, 'heavy-box') || hasConcept(meta, 'run-support')) add(runFitEdge * 0.22, runFitEdge >= 0 ? 'front is winning run fits' : 'blocking unit owns the front');

    const callStat = memory.defense?.calls?.[meta.id];
    if (callStat?.attempts >= 2) add(empiricalEdge(callStat) * dna.coordinator.memory * 0.22, 'learned success of this call');
    const repeats = recentRepeatCount(memory, 'defense', meta.id);
    if (repeats > 0) add(-repeats * (0.09 + dna.coordinator.memory * 0.05), 'repeated shell is becoming identifiable');
    add((rngUnit(rng) - 0.5) * dna.coordinator.exploration * 0.20, 'coordinator exploration');

    return { id: meta.id, call: meta.call, score: round(sigmoid(raw * 1.65)), rawScore: round(raw), reasons: adjust.reasons(), concepts: meta.concepts.slice() };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

const sampleRanking = (ranking, exploration, rng) => {
  if (!ranking.length) return null;
  if (!rng || exploration <= 0.01) return ranking[0];
  const max = ranking[0].score;
  const temperature = 0.035 + clamp(exploration) * 0.18;
  const weights = ranking.map(item => Math.exp((item.score - max) / temperature));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let target = rngUnit(rng) * total;
  for (let index = 0; index < ranking.length; index += 1) {
    target -= weights[index];
    if (target <= 0) return ranking[index];
  }
  return ranking[ranking.length - 1];
};

/** Rank and select one adaptive offensive call using caller-supplied RNG. */
export function chooseOffensiveCall(options = {}) {
  const dna = options.teamDNA?.offense ? options.teamDNA : deriveTeamDNA(options.teamDNA || options.memory?.teamId);
  const ranking = rankOffensiveCalls({ ...options, teamDNA: dna });
  const selected = sampleRanking(ranking, dna.coordinator.exploration, options.rng);
  return { selected, ranking };
}

/** Rank and select one adaptive defensive call using caller-supplied RNG. */
export function chooseDefensiveCall(options = {}) {
  const dna = options.teamDNA?.defense ? options.teamDNA : deriveTeamDNA(options.teamDNA || options.memory?.teamId);
  const ranking = rankDefensiveCalls({ ...options, teamDNA: dna });
  const selected = sampleRanking(ranking, dna.coordinator.exploration, options.rng);
  return { selected, ranking };
}

const rating = (source, key, fallback = 0.55) => clamp(Number(source?.ratings?.[key] ?? source?.[key] ?? fallback));

/**
 * Score a physically described pass window without deciding its outcome.
 * Positive leverage means the receiver owns the route side. `safetyOverlap`,
 * `pressure`, and `platform` are normalized; distances/speeds are in yards.
 */
export function scoreThrowWindow({
  separation = 0, leverage = 0, closingSpeed = 0, safetyOverlap = 0,
  routeDepth = 8, sidelineSpace = 6, arrivalTime = 0.65, pressure = 0,
  platform = 1, quarterback = {}, receiver = {}, throwType = 'auto',
} = {}) {
  const sep = clamp(Number(separation), 0, 8);
  const lev = clamp(Number(leverage), -1, 1);
  const closing = clamp(Number(closingSpeed), 0, 14);
  const overlap = clamp(Number(safetyOverlap));
  const depth = clamp(Number(routeDepth), 0, 55);
  const space = clamp(Number(sidelineSpace), 0, 12);
  const flight = clamp(Number(arrivalTime), 0.25, 1.8);
  const press = clamp(Number(pressure));
  const feet = clamp(Number(platform));
  const accuracy = rating(quarterback, 'throwAccuracy', 0.62);
  const anticipation = rating(quarterback, 'anticipation', 0.58);
  const arm = rating(quarterback, 'throwPower', 0.62);
  const hands = rating(receiver, 'hands', 0.62);
  const contested = rating(receiver, 'contestedCatch', 0.58);
  const closingThreat = clamp((closing * flight - sep * 0.72) / 8, 0, 1);
  const leverageQuality = (lev + 1) / 2;
  const placement = clamp(accuracy * 0.55 + anticipation * 0.23 + feet * 0.22 - press * (1 - rating(quarterback, 'composure', 0.55)) * 0.38);
  const spatialQuality = clamp(sep / 3.2 * 0.58 + leverageQuality * 0.25 + clamp(space / 5) * 0.17 - overlap * 0.43 - closingThreat * 0.34);
  const depthStrain = clamp((depth - 18) / 32) * (1 - arm) * 0.35;
  const catchChance = clamp(0.10 + spatialQuality * 0.49 + placement * 0.25 + hands * 0.18 + contested * (1 - spatialQuality) * 0.12 - depthStrain);
  const turnoverRisk = clamp(0.015 + overlap * 0.25 + closingThreat * 0.16 + (1 - spatialQuality) * 0.12 + press * (1 - placement) * 0.19 - anticipation * 0.055);
  const yardValue = clamp((depth + 3) / 24, 0.25, 1.75);
  const decisionScore = clamp(catchChance * (0.64 + yardValue * 0.30) - turnoverRisk * (0.82 + depth / 55 * 0.35));
  let grade = 'open';
  if (turnoverRisk >= 0.27 || decisionScore < 0.26) grade = 'danger';
  else if (decisionScore < 0.40) grade = 'closed';
  else if (decisionScore < 0.57) grade = sep < 1.25 && lev > 0.25 && anticipation > 0.65 ? 'anticipation' : 'contested';
  const resolvedThrowType = throwType !== 'auto' ? throwType : depth >= 22 && overlap < 0.45 ? 'lob' : closingThreat > 0.45 || depth <= 10 ? 'bullet' : 'touch';
  const reasons = [];
  if (sep >= 2.0) reasons.push('receiver created clear separation');
  else if (sep < 0.9) reasons.push('coverage is attached at the catch point');
  if (lev >= 0.35) reasons.push('receiver owns favorable leverage');
  if (lev <= -0.35) reasons.push('defender owns the throwing lane');
  if (overlap >= 0.5) reasons.push('safety overlaps the window');
  if (closingThreat >= 0.45) reasons.push('the window is closing before arrival');
  if (press >= 0.65 && placement < 0.65) reasons.push('pressure compromises ball placement');
  if (space <= 1.5) reasons.push('boundary space constrains placement');
  return {
    decisionScore: round(decisionScore), catchChance: round(catchChance), turnoverRisk: round(turnoverRisk),
    placement: round(placement), spatialQuality: round(spatialQuality), closingThreat: round(closingThreat),
    grade, throwType: resolvedThrowType, reasons,
  };
}

/**
 * Evaluate a concept-specific QB progression at one instant. Each progression
 * item supplies `order`, `targetId`, optional `hot`/`checkdown`, and a `window`
 * accepted by `scoreThrowWindow`. Returns throw/hold/scramble/throwaway intent.
 */
export function evaluateQBProgression({
  progression = [], quarterback = {}, elapsed = 0, pressure = 0, platform = 1,
  down = 1, toGo = 10, scrambleLane = 0, outsidePocket = false, rng = null,
} = {}) {
  const awareness = rating(quarterback, 'awareness', 0.58);
  const composure = rating(quarterback, 'composure', 0.58);
  const aggression = clamp(Number(quarterback?.tendencies?.aggression ?? quarterback?.aggression ?? 0.5));
  const pocketSense = rating(quarterback, 'pocketSense', 0.55);
  const mobility = (rating(quarterback, 'speed', 0.52) + rating(quarterback, 'agility', 0.54)) / 2;
  const press = clamp(Number(pressure));
  const initialRecognition = 0.12 + (1 - awareness) * 0.28 + press * (1 - composure) * 0.18;
  const scanInterval = 0.16 + (1 - awareness) * 0.32 + press * (1 - composure) * 0.20;
  const scans = Math.max(0, Math.floor((Number(elapsed) - initialRecognition) / scanInterval) + 1);
  const ordered = progression.slice().sort((a, b) => (a.order || 1) - (b.order || 1));
  const considered = [];
  for (const read of ordered) {
    const order = Math.max(1, Number(read.order || 1));
    if (order > scans && !(read.hot && press >= 0.58)) continue;
    const window = scoreThrowWindow({ ...(read.window || read), quarterback, receiver: read.receiver || read.window?.receiver || {}, pressure: press, platform });
    const reachesSticks = Number(read.depth ?? read.window?.routeDepth ?? 0) >= Number(toGo) - 1;
    let utility = window.decisionScore;
    if (Number(down) >= 3) utility += reachesSticks ? 0.075 : read.checkdown ? -0.09 : 0;
    if (read.hot && press >= 0.65) utility += 0.08;
    if (read.checkdown && press < 0.45) utility -= 0.04;
    considered.push({ targetId: read.targetId || read.id || null, targetName: read.targetName || read.name || '', order, hot: Boolean(read.hot), checkdown: Boolean(read.checkdown), reachesSticks, utility: round(clamp(utility)), window });
  }
  considered.sort((a, b) => b.utility - a.utility || a.order - b.order);
  const best = considered[0];
  const thresholdNoise = (rngUnit(rng) - 0.5) * 0.025;
  const threshold = clamp(0.54 - aggression * 0.09 - (Number(down) >= 3 ? 0.035 : 0) + thresholdNoise, 0.40, 0.58);
  if (best && best.utility >= threshold && best.window.grade !== 'danger') {
    return {
      action: 'throw', targetId: best.targetId, targetName: best.targetName, readOrder: best.order,
      throwType: best.window.throwType, threshold: round(threshold), considered,
      reason: best.hot && press >= 0.65 ? 'hot answer cleared the pressure threshold' : `read ${best.order} produced a ${best.window.grade} window`,
    };
  }
  const holdLimit = 2.75 - awareness * 0.55 - pocketSense * 0.20 + press * (1 - composure) * 0.25;
  if ((press >= 0.72 || Number(elapsed) >= holdLimit) && scrambleLane >= 0.42 && mobility + pocketSense >= 1.12) {
    return { action: 'scramble', targetId: null, readOrder: null, threshold: round(threshold), considered, reason: 'no viable throw opened before a usable escape lane' };
  }
  if ((press >= 0.84 || Number(elapsed) >= holdLimit) && outsidePocket) {
    return { action: 'throwaway', targetId: null, readOrder: null, threshold: round(threshold), considered, reason: 'pressure arrived with no viable window outside the pocket' };
  }
  return {
    action: 'hold', targetId: null, readOrder: null, threshold: round(threshold), considered,
    reason: scans === 0 ? 'quarterback has not confirmed the post-snap picture' : best ? `best window remains below the ${round(threshold, 2)} trigger` : 'progression has not reached an available receiver',
  };
}

/**
 * Score a runner's view of one lane. The score describes decision quality, not
 * a rolled result; collision and tackle systems still determine gained yards.
 */
export function scoreRunLane({ lane = {}, runner = {}, scheme = 'inside-zone', rng = null } = {}) {
  const vision = rating(runner, 'vision', 0.58);
  const agility = rating(runner, 'agility', 0.60);
  const acceleration = rating(runner, 'acceleration', 0.62);
  const patience = clamp(Number(runner?.tendencies?.patience ?? runner?.patience ?? 0.5));
  const width = clamp(Number(lane.width || 0), 0, 6);
  const leverage = clamp(Number(lane.blockLeverage || 0), -1, 1);
  const firstContact = clamp(Number(lane.firstContactDistance || 0), 0, 20);
  const traffic = clamp(Number(lane.traffic || 0));
  const pursuit = clamp(Number(lane.pursuitClosing || 0));
  const edgeSet = clamp(Number(lane.edgeSet || 0));
  const cutback = clamp(Number(lane.cutbackOpportunity || 0));
  const secondLevel = clamp(Number(lane.secondLevelSpace || 0));
  const schemeName = String(scheme || '').toLowerCase();
  const gap = String(lane.gap || lane.id || '').toLowerCase();
  let raw = -0.10;
  const adjustments = [];
  const add = (value, reason) => { raw += value; if (Math.abs(value) >= 0.035) adjustments.push({ label: reason, impact: value }); };
  add(width / 6 * 0.42, 'lane width');
  add(leverage * 0.30, leverage >= 0 ? 'blockers own leverage' : 'defenders own leverage');
  add(firstContact / 20 * 0.30, 'distance before first contact');
  add(secondLevel * 0.25, 'second-level space');
  add(-traffic * 0.36, 'interior traffic');
  add(-pursuit * 0.28, 'pursuit is closing');
  if (/outside|stretch/.test(schemeName)) add(-edgeSet * 0.34 + (1 - edgeSet) * 0.12, edgeSet > 0.5 ? 'force defender sets the edge' : 'edge is available');
  if (/inside.zone|zone/.test(schemeName) && cutback > 0) add(cutback * (0.16 + vision * 0.14), 'backside cutback opens');
  if (/power|gap/.test(schemeName) && /a|b|inside/.test(gap)) add((leverage + 1) * 0.10, 'gap scheme matches the point of attack');
  add((vision - 0.5) * 0.16 + (agility - 0.5) * cutback * 0.12 + (acceleration - 0.5) * width * 0.025, 'runner traits fit the crease');
  add((patience - 0.5) * (lane.developing ? 0.18 : -0.05), lane.developing ? 'patience lets the block develop' : 'lane is available immediately');
  const uncertainty = (rngUnit(rng) - 0.5) * (1 - vision) * 0.18;
  add(uncertainty, 'runner perception variance');
  const score = clamp(sigmoid(raw * 2.15));
  const projectedYards = clamp(firstContact * (0.52 + leverage * 0.15) + width * 0.55 + secondLevel * 3.2 - traffic * 2.2 - pursuit * 1.4, 0, 30);
  return {
    id: lane.id || lane.gap || 'lane', gap: lane.gap || '', score: round(score), rawScore: round(raw),
    projectedYards: round(projectedYards, 1),
    reasons: adjustments.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 5).map(item => ({ label: item.label, impact: round(item.impact) })),
  };
}

/** Score and sort candidate run lanes best-first. */
export function rankRunLanes({ lanes = [], runner = {}, scheme = 'inside-zone', rng = null } = {}) {
  return lanes.map(lane => ({ ...scoreRunLane({ lane, runner, scheme, rng }), lane })).sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
}

/**
 * Advance fatigue and accumulated wear for one athlete without mutating input.
 * Fatigue can recover between snaps; wear represents game-long contact cost.
 */
export function updatePlayerCondition(condition = {}, activity = {}) {
  const traits = activity.traits || condition.traits || condition.ratings || {};
  const stamina = rating(traits, 'stamina', 0.60);
  const durability = rating(traits, 'durability', 0.60);
  const seconds = Math.max(0, Number(activity.seconds || 0));
  const sprintSeconds = Math.max(0, Number(activity.sprintSeconds || 0));
  const blockSeconds = Math.max(0, Number(activity.blockSeconds || 0));
  const contact = clamp(Number(activity.contactSeverity || 0));
  const restSeconds = Math.max(0, Number(activity.restSeconds || 0));
  const heat = clamp(Number(activity.temperatureStress || 0));
  const snapCost = activity.snap === false ? 0 : 0.0045;
  const exertion = seconds * 0.0016 + sprintSeconds * 0.011 + blockSeconds * 0.008 + contact * 0.032 + snapCost + heat * seconds * 0.0008;
  const fatigueGain = exertion * (1.22 - stamina * 0.58);
  const recovery = restSeconds * 0.0065 * (0.64 + stamina * 0.56) * (1 - heat * 0.22);
  const fatigue = clamp(Number(condition.fatigue || 0) + fatigueGain - recovery);
  const wearRecovery = activity.halftime ? 0.008 + durability * 0.008 : 0;
  const wearGain = (contact * 0.010 + blockSeconds * 0.0011 + (activity.snap === false ? 0 : 0.0007)) * (1.18 - durability * 0.42);
  const wear = clamp(Number(condition.wear || 0) + wearGain - wearRecovery);
  const snaps = Math.max(0, Number(condition.snaps || 0)) + (activity.snap === false ? 0 : 1);
  const driveSnaps = activity.driveEnded ? 0 : Math.max(0, Number(condition.driveSnaps || 0)) + (activity.snap === false ? 0 : 1);
  const performance = {
    speed: round(clamp(1 - fatigue * 0.15 - wear * 0.05, 0.72, 1)),
    acceleration: round(clamp(1 - fatigue * 0.19 - wear * 0.05, 0.68, 1)),
    strength: round(clamp(1 - fatigue * 0.11 - wear * 0.10, 0.70, 1)),
    awareness: round(clamp(1 - fatigue * 0.08 - wear * 0.03, 0.78, 1)),
    ballSecurity: round(clamp(1 - fatigue * 0.09 - wear * 0.07, 0.74, 1)),
  };
  const availabilityRisk = clamp(0.002 + wear ** 1.7 * 0.11 + fatigue * wear * 0.08 + contact * (1 - durability) * 0.018, 0, 0.25);
  return { ...condition, fatigue: round(fatigue), wear: round(wear), snaps, driveSnaps, performance, availabilityRisk: round(availabilityRisk, 4) };
}

const actorName = (play, key, fallback) => String(play.actors?.[key] || play[`${key}Name`] || fallback);
const signedYards = yards => yards < 0 ? `${Math.abs(yards)}-yard loss` : yards === 0 ? 'no gain' : `${yards}-yard gain`;

/**
 * Produce a concise causal explanation from facts already resolved by the
 * simulation. It never invents a winner; richer ledgers yield richer summaries.
 */
export function explainPlayCause(play = {}) {
  const result = String(play.result || (play.touchdown ? 'touchdown' : play.turnover ? 'turnover' : 'play')).toLowerCase();
  const yards = Math.round(Number(play.yards || 0));
  const offenseCall = normalizeCallId(play.offenseCall) || 'THE CALL';
  const defenseCall = normalizeCallId(play.defenseCall) || 'THE DEFENSE';
  const passer = actorName(play, 'passer', 'The quarterback');
  const target = actorName(play, 'target', 'the target');
  const carrier = actorName(play, 'carrier', 'The runner');
  const tackler = actorName(play, 'tackler', 'the tackler');
  const causes = [];
  const add = text => { if (text && !causes.includes(text)) causes.push(text); };
  const pressureLevel = clamp(Number(play.pressure?.level ?? play.pressure ?? 0));
  const pressureSource = String(play.pressure?.source || 'the rush');
  const window = play.throwWindow || play.window;
  const lane = play.runLane || play.lane;
  const decision = play.decision || {};
  const matchupWins = Array.isArray(play.matchupWins) ? play.matchupWins : [];

  if (play.pressure?.unblocked) add(`${pressureSource} came free through a protection error`);
  else if (pressureLevel >= 0.65) add(`${pressureSource} compressed the pocket before the progression settled`);
  if (window?.reasons?.length) add(window.reasons[0]);
  else if (window?.grade === 'open') add(`${target} separated before the ball arrived`);
  else if (window?.grade === 'danger') add(`the throwing lane never became safe`);
  if (Number.isFinite(decision.readOrder)) add(`${passer} reached read ${decision.readOrder}${decision.hot ? ' as the hot answer' : ''}`);
  if (lane) {
    if (Number(lane.blockLeverage) >= 0.3) add(`the blocking surface secured leverage at ${lane.gap || 'the chosen gap'}`);
    if (Number(lane.edgeSet) >= 0.6) add(`the force defender closed the perimeter`);
    if (Number(lane.cutbackOpportunity) >= 0.55) add(`${carrier} found the backside cutback`);
    if (Number(lane.traffic) >= 0.65) add(`interior traffic erased the crease`);
  }
  for (const matchup of matchupWins.slice(0, 2)) add(matchup.detail || `${matchup.winner || 'A player'} won the ${matchup.phase || 'matchup'}`);
  if (play.contact?.poorAngle) add(`${tackler} arrived from a losing pursuit angle`);
  if (play.contact?.square) add(`${tackler} met the runner square and controlled momentum`);
  if (play.contact?.gangTackle) add(`help arrived before forward progress escaped`);
  if (play.fumbleCause === 'strip') add(`the ball was exposed through contact`);
  if (!causes.length) add(`${offenseCall} met ${defenseCall} at the point of attack`);

  let headline;
  if (result.includes('touchdown')) headline = `TOUCHDOWN · ${offenseCall}`;
  else if (result.includes('interception')) headline = `INTERCEPTION · ${defenseCall}`;
  else if (result.includes('fumble') || play.turnover) headline = `TURNOVER · ${defenseCall}`;
  else if (result.includes('sack')) headline = `SACK · ${defenseCall}`;
  else if (result.includes('incomplete')) headline = `INCOMPLETE · ${offenseCall}`;
  else if (result.includes('complete') || result.includes('pass')) headline = `${passer.toUpperCase()} TO ${target.toUpperCase()} · ${signedYards(yards).toUpperCase()}`;
  else if (result.includes('field goal')) headline = play.good ? 'FIELD GOAL GOOD' : 'FIELD GOAL NO GOOD';
  else headline = `${carrier.toUpperCase()} · ${signedYards(yards).toUpperCase()}`;

  return {
    headline,
    summary: causes.slice(0, 2).join('. ') + '.',
    primaryCause: causes[0],
    causes: causes.slice(0, 4),
    confidence: round(clamp(0.42 + Math.min(4, causes.length) * 0.12)),
  };
}
