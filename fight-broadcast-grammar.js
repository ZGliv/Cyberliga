(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CyberligaFightBroadcastGrammar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const freeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
    return value;
  };
  const normalizeRole = role => {
    const value = String(role || '').trim().toLowerCase();
    if (value === 'heavy') return 'Heavy';
    if (value === 'technician') return 'Technician';
    if (value === 'counter') return 'Counter';
    if (value === 'swarmer') return 'Swarmer';
    if (value === 'grappler') return 'Grappler';
    if (value === 'showboat') return 'Showboat';
    return 'Technician';
  };

  const ROLE_PROFILES = freeze({
    Heavy: {
      id: 'HEAVY',
      family: 'BRAWLER',
      label: 'BELL RINGER',
      stance: 'SQUARE',
      guard: 'CROSS ARM',
      range: 1.72,
      aggr: 1.08,
      slip: 0.7,
      block: 1.2,
      combo: 0.9,
      counter: 0.76,
      power: 1.2,
      body: 0.31,
      cadence: 0.86,
      signatureName: 'BELL RINGER',
      sequences: [['JAB', 'OVERHAND'], ['BODY', 'HOOK'], ['CROSS', 'LIVER', 'OVERHAND']],
      plans: ['WALK THEM DOWN · RING THE BELL', 'DIG THE BODY · LOAD THE REAR HAND', 'ROPE THEM · ONE CLEAN FINISH']
    },
    Technician: {
      id: 'TECHNICIAN',
      family: 'OUTBOXER',
      label: 'ANGLE CRAFT',
      stance: 'ORTHODOX',
      guard: 'LONG GUARD',
      range: 2.32,
      aggr: 0.88,
      slip: 1.16,
      block: 0.96,
      combo: 1.02,
      counter: 1.12,
      power: 0.96,
      body: 0.2,
      cadence: 1.04,
      signatureName: 'THREE-INCH EXIT',
      sequences: [['JAB', 'CROSS', 'JAB'], ['JAB', 'BODY', 'CROSS'], ['CROSS', 'JAB']],
      plans: ['OWN THE LEAD FOOT · SCORE AND EXIT', 'DOUBLE JAB · TURN THE CORNER', 'BANK THE ROUND · NO SQUARE EXCHANGES']
    },
    Counter: {
      id: 'COUNTER',
      family: 'COUNTER',
      label: 'SPRING TRAP',
      stance: 'ORTHODOX',
      guard: 'PHILLY SHELL',
      range: 2.12,
      aggr: 0.78,
      slip: 1.3,
      block: 1,
      combo: 0.96,
      counter: 1.44,
      power: 1.05,
      body: 0.24,
      cadence: 0.94,
      signatureName: 'SPRING TRAP',
      sequences: [['CROSS', 'HOOK'], ['LIVER', 'CROSS'], ['CROSS', 'UPPER']],
      plans: ['SHOW THE OPENING · PULL AND FIRE', 'MAKE THEM LEAD · TAKE THE RETURN', 'LAST ROUND · SET THE DEEP TRAP']
    },
    Swarmer: {
      id: 'SWARMER',
      family: 'PRESSURE',
      label: 'POCKET STORM',
      stance: 'ORTHODOX',
      guard: 'HIGH SHELL',
      range: 1.6,
      aggr: 1.24,
      slip: 0.88,
      block: 1.08,
      combo: 1.4,
      counter: 0.84,
      power: 0.98,
      body: 0.38,
      cadence: 1.2,
      signatureName: 'MARKET STORM',
      sequences: [['JAB', 'BODY', 'HOOK'], ['CROSS', 'LIVER', 'HOOK'], ['BODY', 'HOOK', 'CROSS']],
      plans: ['CUT THE CAGE · PUNCH IN THREES', 'BODY FIRST · DROWN THE RETURN', 'SMOTHER · EMPTY THE TANK']
    },
    Grappler: {
      id: 'GRAPPLER',
      family: 'PRESSURE',
      label: 'KNOT MAKER',
      stance: 'SQUARE',
      guard: 'FRAME GUARD',
      range: 1.42,
      aggr: 1.04,
      slip: 0.72,
      block: 1.18,
      combo: 0.88,
      counter: 0.82,
      power: 1.02,
      body: 0.44,
      cadence: 0.9,
      signatureName: 'KNOT TURN',
      sequences: [['BODY', 'HOOK'], ['JAB', 'BODY'], ['LIVER', 'CROSS']],
      plans: ['COLLAR THE HIPS · TURN OFF THE ROPE', 'SHORT BODY WORK · MAKE THEM CARRY', 'CLOSE THE SPACE · BREAK THE BASE']
    },
    Showboat: {
      id: 'SHOWBOAT',
      family: 'OUTBOXER',
      label: 'CROWD DARE',
      stance: 'SOUTHPAW',
      guard: 'LOW LONG GUARD',
      range: 2.2,
      aggr: 0.96,
      slip: 1.22,
      block: 0.82,
      combo: 1.12,
      counter: 1.08,
      power: 1,
      body: 0.19,
      cadence: 1.08,
      signatureName: 'NEON DARE',
      sequences: [['JAB', 'CROSS', 'HOOK'], ['CROSS', 'UPPER'], ['JAB', 'OVERHAND']],
      plans: ['SHOW THE JAB · STEAL THE ANGLE', 'DRAW THE CHEER · PUNISH THE CHASE', 'DARE THEM FORWARD · EXIT ON FIRE']
    }
  });

  const STRIKE_TIMING = freeze({
    JAB: { load: 0.16, contact: 0.45, settle: 0.82 },
    CROSS: { load: 0.2, contact: 0.5, settle: 0.84 },
    HOOK: { load: 0.24, contact: 0.54, settle: 0.86 },
    BODY: { load: 0.23, contact: 0.53, settle: 0.86 },
    UPPER: { load: 0.28, contact: 0.58, settle: 0.88 },
    OVERHAND: { load: 0.3, contact: 0.6, settle: 0.9 },
    LIVER: { load: 0.26, contact: 0.56, settle: 0.88 }
  });

  const easeOut = value => 1 - Math.pow(1 - clamp(value, 0, 1), 3);
  const easeInOut = value => 0.5 - Math.cos(clamp(value, 0, 1) * Math.PI) * 0.5;

  function profileFor(athleteOrRole) {
    const role = normalizeRole(typeof athleteOrRole === 'object' ? athleteOrRole && athleteOrRole.role : athleteOrRole);
    return ROLE_PROFILES[role];
  }

  function signatureSequence(athleteOrRole, ordinal) {
    const profile = profileFor(athleteOrRole);
    const index = Math.abs(Number.isFinite(Number(ordinal)) ? Math.trunc(Number(ordinal)) : 0) % profile.sequences.length;
    return Object.freeze(profile.sequences[index].slice());
  }

  function strikeEnvelope(kind, progress) {
    const timing = STRIKE_TIMING[String(kind || '').toUpperCase()] || STRIKE_TIMING.CROSS;
    const p = clamp(Number(progress) || 0, 0, 1);
    const contactWindow = 0.055;
    let phase = 'ANTICIPATION';
    let extension = 0;
    let anticipation = 0;
    let followThrough = 0;
    if (p < timing.load) {
      anticipation = easeInOut(p / timing.load);
      extension = -0.08 * anticipation;
    } else if (p < timing.contact - contactWindow) {
      phase = 'DELIVERY';
      extension = easeOut((p - timing.load) / Math.max(0.001, timing.contact - contactWindow - timing.load));
    } else if (p <= timing.contact + contactWindow) {
      phase = 'IMPACT';
      extension = 1;
      followThrough = clamp((p - timing.contact + contactWindow) / (contactWindow * 2), 0, 1);
    } else if (p < timing.settle) {
      phase = 'FOLLOW-THROUGH';
      const recovery = (p - timing.contact - contactWindow) / Math.max(0.001, timing.settle - timing.contact - contactWindow);
      extension = 1 - easeInOut(recovery) * 0.76;
      followThrough = 1 - recovery * 0.45;
    } else {
      phase = 'RECOVERY';
      extension = Math.max(0, 0.24 * (1 - (p - timing.settle) / Math.max(0.001, 1 - timing.settle)));
    }
    return freeze({
      kind: String(kind || 'CROSS').toUpperCase(),
      progress: +p.toFixed(4),
      phase,
      contactAt: timing.contact,
      extension: +extension.toFixed(4),
      anticipation: +anticipation.toFixed(4),
      followThrough: +followThrough.toFixed(4)
    });
  }

  function cameraPlan(sample) {
    const state = String(sample && sample.state || 'FIGHT').toUpperCase();
    const mobile = Boolean(sample && sample.mobile);
    const replay = Boolean(sample && sample.replay && sample.recordedFootage);
    const strikePhase = String(sample && sample.strikePhase || '');
    const impact = clamp(Number(sample && sample.impact) || 0, 0, 1);
    const clinch = Boolean(sample && sample.clinch);
    let shot = 'RINGSIDE WIDE';
    let radius = mobile ? 23.2 : 11.4;
    let height = mobile ? 9.15 : 5.15;
    if (state === 'WALKON') {
      shot = 'WALKOUT HERO';
      radius = mobile ? 14 : 7;
      height = mobile ? 6.2 : 2.6;
    } else if (state === 'KNOCKDOWN') {
      shot = 'COUNT WIDE';
      radius = mobile ? 22.6 : 10.8;
      height = mobile ? 9.4 : 4.8;
    } else if (replay) {
      shot = 'RECORDED REPLAY';
      radius = mobile ? 22.8 : 8.8;
      height = mobile ? 9.2 : 3.7;
    } else if (clinch) {
      shot = 'CLINCH HIGH THREE-QUARTER';
      radius = mobile ? 23.4 : 10.8;
      height = mobile ? 9.5 : 6.25;
    } else if (impact > 0) {
      shot = 'LIVE IMPACT HOLD';
      radius = mobile ? 23 : 9.55 + (1 - impact) * 0.85;
      height = mobile ? 9.1 : 4.2;
    } else if (strikePhase === 'ANTICIPATION') {
      shot = 'ATTACK BUILD';
      radius = mobile ? 23.3 : 11.15;
      height = mobile ? 9.2 : 4.95;
    } else if (strikePhase === 'DELIVERY' || strikePhase === 'IMPACT' || strikePhase === 'FOLLOW-THROUGH') {
      shot = 'ATTACK THREE-QUARTER';
      radius = mobile ? 23.1 : 10.15;
      height = mobile ? 9.1 : 4.45;
    }
    return freeze({
      shot,
      radius: +radius.toFixed(3),
      height: +height.toFixed(3),
      replay,
      recordedFootage: replay
    });
  }

  function pacingState(input) {
    const elapsed = Math.max(0, Number(input && input.elapsed) || 0);
    const maxSeconds = clamp(Number(input && input.maxSeconds) || 238, 180, 300);
    const terminal = Boolean(input && input.terminal);
    return freeze({
      elapsed: +elapsed.toFixed(3),
      maxSeconds,
      remaining: +Math.max(0, maxSeconds - elapsed).toFixed(3),
      forceDecision: !terminal && elapsed >= maxSeconds,
      finite: Number.isFinite(elapsed) && Number.isFinite(maxSeconds)
    });
  }

  return freeze({
    version: '1.0.0',
    roleProfiles: ROLE_PROFILES,
    strikeTiming: STRIKE_TIMING,
    profileFor,
    signatureSequence,
    strikeEnvelope,
    cameraPlan,
    pacingState
  });
});
