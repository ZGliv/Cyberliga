// Sport-local broadcast grammar for Cyberliga baseball.
//
// The shared character renderer owns body and motion identity. This module
// turns the same authored athlete data into baseball-specific tendencies,
// matchup language, pacing, and crowd direction. Every value is deterministic
// so a seeded game and its browser QA remain reproducible.

export const BASEBALL_BROADCAST_POLISH_VERSION = '1.0.0';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function baseballIdentityHash(value) {
  let result = 2166136261 >>> 0;
  for (const character of String(value == null ? '' : value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

const unit = (seed, salt) => baseballIdentityHash(`${seed}|${salt}`) / 4294967295;
const signed = (seed, salt, amount) => (unit(seed, salt) * 2 - 1) * amount;
const has = (text, terms) => terms.some(term => text.includes(term));

const HITTER_STYLES = Object.freeze({
  thunder: Object.freeze({
    label: 'DAMAGE HITTER',
    cue: 'LOOKS MIDDLE-IN',
    broadcast: 'one clean mistake can leave the yard',
    contact: -0.025, power: 0.12, eye: -0.035, speed: -0.025,
    load: 1.13, open: 0.1, crouch: 0.01, waggle: 0.68, finish: 1.16,
  }),
  barrel: Object.freeze({
    label: 'BARREL HUNTER',
    cue: 'SHORT TO THE BALL',
    broadcast: 'wins with the barrel before the defense can move',
    contact: 0.1, power: 0.035, eye: 0.025, speed: 0,
    load: 0.92, open: 0.035, crouch: 0.055, waggle: 0.44, finish: 0.94,
  }),
  patient: Object.freeze({
    label: 'COUNT BUILDER',
    cue: 'SHRINKS THE ZONE',
    broadcast: 'will make the pitcher show every edge',
    contact: 0.045, power: -0.015, eye: 0.125, speed: -0.01,
    load: 0.84, open: -0.02, crouch: 0.075, waggle: 0.3, finish: 0.9,
  }),
  spark: Object.freeze({
    label: 'PRESSURE RUNNER',
    cue: 'PUNCHES THE GAPS',
    broadcast: 'turns a routine pickup into a footrace',
    contact: 0.06, power: -0.055, eye: 0.015, speed: 0.125,
    load: 0.88, open: 0.075, crouch: 0.105, waggle: 0.8, finish: 0.88,
  }),
  ambush: Object.freeze({
    label: 'FIRST-PITCH THREAT',
    cue: 'HUNTS ONE LOCATION',
    broadcast: 'arrives ready to swing before the sign is finished',
    contact: 0.015, power: 0.07, eye: -0.075, speed: 0.025,
    load: 1.04, open: 0.12, crouch: 0.035, waggle: 0.9, finish: 1.08,
  }),
});

const PITCHER_STYLES = Object.freeze({
  illusionist: Object.freeze({
    label: 'TEMPO ILLUSIONIST',
    cue: 'CHANGES SPEED',
    broadcast: 'hides the release inside changing tempo',
    command: 0.055, stuff: 0.075, pace: 0.87, breakBias: 0.11,
  }),
  power: Object.freeze({
    label: 'POWER ARM',
    cue: 'OWNS THE TOP RAIL',
    broadcast: 'challenges the hands before showing the break',
    command: -0.025, stuff: 0.13, pace: 1.08, breakBias: -0.025,
  }),
  surgeon: Object.freeze({
    label: 'EDGE SURGEON',
    cue: 'PAINTS BOTH BLACKS',
    broadcast: 'keeps moving the target one baseball at a time',
    command: 0.135, stuff: 0.005, pace: 0.93, breakBias: 0.03,
  }),
  sinker: Object.freeze({
    label: 'GROUND-BALL ARM',
    cue: 'LIVES BELOW THE KNEES',
    broadcast: 'invites contact that the infield can finish',
    command: 0.065, stuff: 0.035, pace: 1.02, breakBias: 0.15,
  }),
});

function chooseHitterStyle(text, seed) {
  if (has(text, ['slugger', 'weather', 'dent', 'power', 'longball', 'hard contact'])) return 'thunder';
  if (has(text, ['patient', 'translator', 'frame', 'edge', 'quiet', 'still'])) return 'patient';
  if (has(text, ['field', 'horizon', 'steal', 'quick', 'hop', 'zigzag'])) return 'spark';
  if (has(text, ['shortstop', 'hinge', 'rehearsed', 'clean arc', 'barrel'])) return 'barrel';
  return ['barrel', 'patient', 'spark', 'ambush', 'thunder'][baseballIdentityHash(`${seed}|bat`) % 5];
}

function choosePitcherStyle(text, seed) {
  if (has(text, ['illusion', 'changes speed', 'tempo', 'vanishing'])) return 'illusionist';
  if (has(text, ['closer', 'undertaker', 'power', 'hard', 'snap'])) return 'power';
  if (has(text, ['sinker', 'ground', 'low', 'below'])) return 'sinker';
  if (has(text, ['edge', 'frame', 'paint', 'clean', 'still'])) return 'surgeon';
  return ['illusionist', 'power', 'surgeon', 'sinker'][baseballIdentityHash(`${seed}|pitch`) % 4];
}

export function createBaseballPlayerProfile(athlete = {}, options = {}) {
  const position = String(options.position || athlete.role || 'UTIL').toUpperCase();
  const name = String(athlete.name || options.name || 'Unknown Player');
  const seed = String(athlete.id || `${name}|${position}`);
  const authored = [
    athlete.role, athlete.archetype, athlete.temperament, athlete.signature,
    athlete.flaw, options.motionName, options.teamMotion,
  ].filter(Boolean).join(' ').toLowerCase();
  const hitterKey = chooseHitterStyle(authored, seed);
  const pitcherKey = choosePitcherStyle(authored, seed);
  const hitter = HITTER_STYLES[hitterKey];
  const pitcher = PITCHER_STYLES[pitcherKey];
  const base = 0.52;
  const rating = (salt, authoredBonus = 0) =>
    +clamp(base + authoredBonus + signed(seed, salt, 0.085), 0.34, 0.78).toFixed(3);
  const isPrimaryPitcher = position === 'P' || has(authored, ['ace', 'closer', 'mound']);
  const profile = {
    id: seed,
    name,
    position,
    hitterStyle: hitterKey,
    pitcherStyle: pitcherKey,
    batting: {
      label: hitter.label,
      cue: hitter.cue,
      broadcast: hitter.broadcast,
      contact: rating('contact', hitter.contact),
      power: rating('power', hitter.power),
      eye: rating('eye', hitter.eye),
      speed: rating('speed', hitter.speed),
      load: +(hitter.load + signed(seed, 'load', 0.045)).toFixed(3),
      open: +(hitter.open + signed(seed, 'open', 0.025)).toFixed(3),
      crouch: +(hitter.crouch + signed(seed, 'crouch', 0.02)).toFixed(3),
      waggle: +(hitter.waggle + signed(seed, 'waggle', 0.08)).toFixed(3),
      finish: +(hitter.finish + signed(seed, 'finish', 0.045)).toFixed(3),
    },
    pitching: {
      label: pitcher.label,
      cue: pitcher.cue,
      broadcast: pitcher.broadcast,
      command: rating('command', pitcher.command + (isPrimaryPitcher ? 0.035 : -0.015)),
      stuff: rating('stuff', pitcher.stuff + (isPrimaryPitcher ? 0.04 : -0.02)),
      pace: +(pitcher.pace + signed(seed, 'pace', 0.045)).toFixed(3),
      breakBias: +(pitcher.breakBias + signed(seed, 'break', 0.025)).toFixed(3),
    },
    fielding: {
      range: rating('range', position === 'CF' || position === 'SS' ? 0.09 : 0),
      hands: rating('hands', position === 'C' || position === '1B' || position === 'SS' ? 0.075 : 0),
      arm: rating('arm', position === 'P' || position === 'C' || position === 'SS' || position === 'RF' ? 0.075 : 0),
    },
  };
  return Object.freeze({
    ...profile,
    batting: Object.freeze(profile.batting),
    pitching: Object.freeze(profile.pitching),
    fielding: Object.freeze(profile.fielding),
  });
}

export function createBaseballMatchupRead(pitcher, batter, situation = {}) {
  if (!pitcher || !batter) return null;
  const balls = clamp(Number(situation.balls) || 0, 0, 3);
  const strikes = clamp(Number(situation.strikes) || 0, 0, 2);
  const traffic = clamp(Number(situation.runners) || 0, 0, 3);
  const leverage = clamp(Number(situation.leverage) || 0, 0, 1);
  const pitcherScore = (pitcher.pitching.command + pitcher.pitching.stuff) / 2;
  const batterScore = (batter.batting.contact + batter.batting.eye + batter.batting.power * 0.65) / 2.65;
  const countEdge = strikes * 0.026 - balls * 0.025;
  const edge = +clamp(pitcherScore - batterScore + countEdge - traffic * 0.008, -0.25, 0.25).toFixed(3);
  const edgeLabel = edge > 0.055 ? 'PITCHER EDGE' : edge < -0.055 ? 'HITTER EDGE' : 'MATCHUP EVEN';
  const pressure = leverage > 0.72 || traffic >= 2 ? 'HIGH-LEVERAGE' : strikes === 2 ? 'PROTECT MODE' : balls >= 2 ? 'HITTER COUNT' : 'OPEN COUNT';
  return Object.freeze({
    edge,
    edgeLabel,
    pressure,
    headline: `${pitcher.pitching.label} vs ${batter.batting.label}`,
    detail: `${pitcher.pitching.cue} · ${batter.batting.cue}`,
  });
}

const RESULT_RULES = Object.freeze({
  'GRAND SLAM': ['signature', false, 1, 4],
  'HOME RUN': ['signature', false, 0.94, 3.6],
  'MOONSHOT': ['signature', false, 1, 4],
  'WALL ROBBERY': ['signature', false, 0.9, 3.2],
  'DOUBLE PLAY': ['signature', false, 0.76, 2.8],
  'TRIPLE': ['feature', true, 0.72, 2.1],
  'DOUBLE': ['feature', true, 0.58, 1.7],
  'SINGLE': ['standard', true, 0.38, 1.25],
  'INFIELD SINGLE': ['standard', true, 0.48, 1.35],
  'STRIKEOUT': ['feature', true, 0.48, 1.55],
  'WALK': ['standard', true, 0.2, 1.15],
  'ERROR': ['standard', true, 0.34, 1.25],
  'OUT': ['standard', true, 0.18, 1.05],
});

export function baseballResultPresentation(result, options = {}) {
  const normalized = String(result || 'OUT').toUpperCase();
  const key = normalized.includes('HOME RUN') ? 'HOME RUN'
    : normalized.includes('ERROR') ? 'ERROR'
      : normalized.includes('STRIKE') ? 'STRIKEOUT'
        : normalized.includes('OUT') ? 'OUT'
          : normalized;
  const rule = RESULT_RULES[key] || RESULT_RULES.OUT;
  const scoringRuns = clamp(Number(options.runs) || 0, 0, 4);
  const homeBatting = Boolean(options.homeBatting);
  const amplitude = clamp(rule[2] + scoringRuns * 0.08, 0.12, 1);
  return Object.freeze({
    tier: rule[0],
    compact: rule[1],
    crowdAmplitude: +amplitude.toFixed(3),
    holdSeconds: rule[3],
    crowdMode: amplitude >= 0.72
      ? (homeBatting ? 'HOME_ROAR' : 'AWAY_POCKET')
      : amplitude >= 0.4 ? 'BUILD' : 'APPRECIATION',
    propagation: homeBatting ? 'HOME_TO_RIM' : 'VISITOR_POCKET',
  });
}

export const BASEBALL_PACING = Object.freeze({
  setup: 1.22,
  windup: 1.16,
  foulHold: 1.08,
  walkHold: 1.34,
  strikeoutHold: 1.04,
  batterChangeMin: 1.55,
  batterChangeMax: 2.72,
  liveSettle: 1.68,
  throwSettle: 1.48,
  postplay: 1.18,
  sideChange: 3,
  final: 12,
});

export function validateBaseballPlayerProfile(profile) {
  if (!profile || typeof profile !== 'object') return false;
  const ratings = [
    profile.batting?.contact, profile.batting?.power, profile.batting?.eye, profile.batting?.speed,
    profile.pitching?.command, profile.pitching?.stuff,
    profile.fielding?.range, profile.fielding?.hands, profile.fielding?.arm,
  ];
  return Boolean(
    profile.id && profile.name && profile.position &&
    profile.batting?.label && profile.pitching?.label &&
    ratings.every(value => Number.isFinite(value) && value >= 0.34 && value <= 0.78)
  );
}
