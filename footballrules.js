/*
 * Deterministic American-football rules helpers for Cyberliga.
 *
 * This module owns no renderer, DOM, timers, storage, or global random state.
 * Probabilistic foul assessments require an RNG supplied by the caller. The
 * field coordinate is offense-relative: 0 is the offense's own goal line and
 * 100 is the goal line it is attacking.
 *
 * Typical integration:
 *   const flags = evaluateLivePenalties({ blocks, coverages, rng });
 *   if (flags.primary) {
 *     const ruling = enforcePenalty({ downState, penalty: flags.primary });
 *   }
 */

const clamp = (value, low = 0, high = 1) => Math.max(
  low,
  Math.min(high, Number.isFinite(Number(value)) ? Number(value) : low),
);

const round = (value, digits = 3) => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const key of Object.getOwnPropertyNames(value)) deepFreeze(value[key]);
  return Object.freeze(value);
};

const readRng = (rng) => {
  const value = typeof rng === 'function'
    ? rng()
    : rng && typeof rng.next === 'function'
      ? rng.next()
      : Number.NaN;
  if (!Number.isFinite(value)) {
    throw new TypeError('rng must be a function or expose next() returning a finite number');
  }
  return clamp(value, 0, 0.999999999);
};

const hasRng = rng => typeof rng === 'function' || Boolean(rng && typeof rng.next === 'function');

const requireRng = (rng) => {
  if (!hasRng(rng)) {
    throw new TypeError('a caller-supplied rng is required for foul assessment');
  }
};

export const PLAY_CLOCK_SECONDS = 25;

export const FOOTBALL_PENALTIES = deepFreeze({
  FALSE_START: {
    type: 'false-start', code: 'FST', name: 'FALSE START', team: 'offense',
    yards: 5, phase: 'dead-ball', liveBall: false, enforcement: 'previous-spot',
    repeatDown: true, automaticFirstDown: false,
  },
  OFFSIDES: {
    type: 'offsides', code: 'DOF', name: 'OFFSIDES', team: 'defense',
    yards: 5, phase: 'live-ball', liveBall: true, enforcement: 'previous-spot',
    repeatDown: true, automaticFirstDown: false,
  },
  HOLDING: {
    type: 'holding', code: 'OH', name: 'OFFENSIVE HOLDING', team: 'offense',
    yards: 10, phase: 'live-ball', liveBall: true, enforcement: 'foul-spot',
    repeatDown: true, automaticFirstDown: false,
  },
  DPI: {
    type: 'defensive-pass-interference', code: 'DPI', name: 'DEFENSIVE PASS INTERFERENCE',
    team: 'defense', yards: null, phase: 'live-ball', liveBall: true,
    enforcement: 'spot-foul', repeatDown: false, automaticFirstDown: true,
  },
  DELAY_OF_GAME: {
    type: 'delay-of-game', code: 'DOG', name: 'DELAY OF GAME', team: 'offense',
    yards: 5, phase: 'dead-ball', liveBall: false, enforcement: 'previous-spot',
    repeatDown: true, automaticFirstDown: false,
  },
});

const makePenalty = (definition, details = {}) => ({
  ...definition,
  offenderId: details.offenderId ?? null,
  offenderRole: details.offenderRole ?? null,
  foulSpot: Number.isFinite(details.foulSpot) ? clamp(details.foulSpot, 0, 100) : null,
  occurredAt: Number.isFinite(details.occurredAt) ? Math.max(0, details.occurredAt) : null,
  severity: round(clamp(details.severity)),
  probability: round(clamp(details.probability)),
  evidence: [...(details.evidence || [])],
  reason: details.reason || definition.name,
  variant: details.variant || definition.type,
  freePlay: Boolean(details.freePlay),
});

const noCall = ({ eligible = false, probability = 0, severity = 0, evidence = [], reason }) => ({
  eligible,
  called: false,
  probability: round(clamp(probability)),
  severity: round(clamp(severity)),
  evidence: [...evidence],
  reason,
  penalty: null,
});

const assessCall = ({ eligible, probability, severity, evidence, reason, definition, details, rng }) => {
  if (!eligible) return noCall({ eligible, probability: 0, severity, evidence, reason });
  const called = readRng(rng) < probability;
  return {
    eligible: true,
    called,
    probability: round(clamp(probability)),
    severity: round(clamp(severity)),
    evidence: [...evidence],
    reason,
    penalty: called ? makePenalty(definition, {
      ...details, probability, severity, evidence, reason,
    }) : null,
  };
};

/**
 * Assess a false start from observed pre-snap movement. Noise, fatigue, and a
 * hard count make a borderline flinch more likely; movement remains the cause.
 * `causedByDefense` suppresses the offensive foul so a neutral-zone infraction
 * can receive the correct ruling.
 */
export function assessFalseStart({
  offenderId = null,
  offenderRole = null,
  displacement = 0,
  forwardSpeed = 0,
  earlyReaction = 0,
  setDuration = 1,
  beforeSnap = true,
  causedByDefense = false,
  discipline = 0.6,
  crowdNoise = 0,
  fatigue = 0,
  cadenceStress = 0,
  occurredAt = null,
  rng,
} = {}) {
  requireRng(rng);
  const move = Math.abs(Number(displacement) || 0);
  const speed = Math.abs(Number(forwardSpeed) || 0);
  const reaction = clamp(earlyReaction);
  const movementSignal = clamp(Math.max(move / 0.34, speed / 1.45, reaction));
  const wasSet = Number(setDuration) >= 0.45;
  const materialMovement = move >= 0.09 || speed >= 0.42 || reaction >= 0.34;
  const eligible = Boolean(beforeSnap && wasSet && materialMovement && !causedByDefense);
  const stress = clamp(crowdNoise * 0.42 + fatigue * 0.28 + cadenceStress * 0.30);
  const severity = clamp(movementSignal * 0.82 + stress * 0.10 + (1 - clamp(discipline)) * 0.08);
  const probability = clamp(0.70 + movementSignal * 0.24 + stress * 0.045, 0, 0.995);
  const evidence = [];
  if (move >= 0.09) evidence.push(`${round(move, 2)} yd movement after becoming set`);
  if (speed >= 0.42) evidence.push(`${round(speed, 2)} yd/s early first step`);
  if (reaction >= 0.34) evidence.push('clear reaction before the snap');
  if (crowdNoise >= 0.65) evidence.push('communication stressed by crowd noise');
  if (causedByDefense) evidence.push('movement induced by a defender in the neutral zone');
  const reason = causedByDefense
    ? 'The defender induced the reaction; do not charge the offense.'
    : materialMovement
      ? 'An offensive player made a movement that simulated the start of the play.'
      : 'No material movement after the offense became set.';
  return assessCall({
    eligible, probability, severity, evidence, reason,
    definition: FOOTBALL_PENALTIES.FALSE_START,
    details: { offenderId, offenderRole, occurredAt },
    rng,
  });
}
/**
 * Assess a defender entering the neutral zone. Crossing and returning before
 * the snap is legal unless there is contact, an unabated path, or an induced
 * offensive reaction. At the snap it becomes live-ball offsides/free play.
 */
export function assessOffsides({
  offenderId = null,
  offenderRole = null,
  neutralZoneDepth = 0,
  snapOccurred = false,
  contact = false,
  unabatedToQuarterback = false,
  inducedReaction = false,
  returnedOnside = false,
  occurredAt = null,
  rng,
} = {}) {
  requireRng(rng);
  const depth = Math.max(0, Number(neutralZoneDepth) || 0);
  const crossed = depth >= 0.08;
  const deadBallCause = Boolean(contact || unabatedToQuarterback || inducedReaction);
  const eligible = crossed && !returnedOnside && (deadBallCause || snapOccurred);
  const severity = clamp(depth / 0.8 + (contact ? 0.22 : 0) + (unabatedToQuarterback ? 0.26 : 0));
  const probability = clamp(0.86 + severity * 0.13, 0, 0.998);
  const evidence = [];
  if (crossed) evidence.push(`${round(depth, 2)} yd into the neutral zone`);
  if (contact) evidence.push('contacted an offensive player before the snap');
  if (unabatedToQuarterback) evidence.push('had an unabated path to the quarterback');
  if (inducedReaction) evidence.push('caused an adjacent offensive player to react');
  if (returnedOnside) evidence.push('returned onside before the snap without contact');

  let variant = 'offsides';
  let name = 'OFFSIDES';
  let code = 'DOF';
  if (contact) { variant = 'encroachment'; name = 'ENCROACHMENT'; code = 'ENC'; }
  else if (unabatedToQuarterback || inducedReaction) {
    variant = 'neutral-zone-infraction'; name = 'NEUTRAL ZONE INFRACTION'; code = 'NZI';
  }
  const definition = {
    ...FOOTBALL_PENALTIES.OFFSIDES,
    name,
    code,
    phase: deadBallCause ? 'dead-ball' : 'live-ball',
    liveBall: !deadBallCause,
  };
  const reason = eligible
    ? deadBallCause
      ? 'The defender created an immediate pre-snap neutral-zone violation.'
      : 'The defender was in the neutral zone when the ball was snapped.'
    : crossed && !snapOccurred
      ? 'The defender crossed but legally returned before the snap.'
      : 'The defender did not materially enter the neutral zone.';
  return assessCall({
    eligible, probability, severity, evidence, reason, definition,
    details: {
      offenderId, offenderRole, occurredAt, variant,
      freePlay: eligible && !deadBallCause && snapOccurred,
    },
    rng,
  });
}

/**
 * Assess offensive holding from a block interaction. Restriction alone is not
 * enough: the defender must be trying to separate or possess an advantage, and
 * there must be an illegal hook/grab/takedown rather than ordinary hand fighting.
 */
export function assessHolding({
  offenderId = null,
  offenderRole = null,
  foulSpot = null,
  engagementDuration = 0,
  restriction = 0,
  separationAttempt = 0,
  defenderAdvantage = 0,
  handOutsideFrame = 0,
  hook = 0,
  takedown = false,
  ripMove = 0,
  pointOfAttack = 0.5,
  discipline = 0.6,
  occurredAt = null,
  rng,
} = {}) {
  requireRng(rng);
  const duration = Math.max(0, Number(engagementDuration) || 0);
  const restrict = clamp(restriction);
  const separate = clamp(separationAttempt);
  const advantage = clamp(defenderAdvantage);
  const outside = clamp(handOutsideFrame);
  const hooked = clamp(hook);
  const rip = clamp(ripMove);
  const illegalControl = Math.max(outside, hooked, takedown ? 1 : 0);
  const materialEffect = Math.max(separate, advantage, takedown ? 1 : 0);
  const ripException = rip >= 0.72 && !takedown && restrict < 0.62 && hooked < 0.48;
  const eligible = duration >= 0.22
    && restrict >= 0.38
    && illegalControl >= 0.28
    && materialEffect >= 0.28
    && !ripException;
  const severity = clamp(
    restrict * 0.30 + separate * 0.16 + advantage * 0.15 + outside * 0.12
      + hooked * 0.13 + (takedown ? 0.25 : 0) + clamp(pointOfAttack) * 0.07
      - rip * 0.10 + (1 - clamp(discipline)) * 0.04,
  );
  const probability = clamp(0.57 + severity * 0.39, 0, 0.985);
  const evidence = [];
  if (outside >= 0.28) evidence.push('hands worked outside the defender’s frame');
  if (hooked >= 0.28) evidence.push('blocker hooked the defender while he separated');
  if (advantage >= 0.45) evidence.push('restriction erased a won defensive angle');
  if (takedown) evidence.push('blocker pulled the defender to the ground');
  if (ripException) evidence.push('contact followed the defender’s rip move without material restriction');
  const reason = eligible
    ? 'Illegal restriction prevented the defender from pursuing a won path.'
    : ripException
      ? 'The block falls under normal rip-move hand fighting.'
      : 'The engagement did not include both illegal control and material restriction.';
  return assessCall({
    eligible, probability, severity, evidence, reason,
    definition: FOOTBALL_PENALTIES.HOLDING,
    details: { offenderId, offenderRole, foulSpot, occurredAt },
    rng,
  });
}

/**
 * Assess defensive pass interference. A catchable forward pass must be in the
 * air, contact must occur more than one yard downfield before arrival, and the
 * act must materially hinder the receiver rather than represent a play on the ball.
 */
export function assessPassInterference({
  offenderId = null,
  offenderRole = null,
  foulSpot = null,
  targetDepth = 0,
  ballInAir = false,
  catchable = true,
  secondsBeforeArrival = 0,
  contactSeverity = 0,
  restriction = 0,
  pathObstruction = 0,
  armBar = 0,
  playingBall = 0,
  faceGuardingOnly = false,
  occurredAt = null,
  rng,
} = {}) {
  requireRng(rng);
  const depth = Number(targetDepth) || 0;
  const early = Math.max(0, Number(secondsBeforeArrival) || 0);
  const contact = clamp(contactSeverity);
  const restrict = clamp(restriction);
  const obstruction = clamp(pathObstruction);
  const arm = clamp(armBar);
  const ballPlay = clamp(playingBall);
  const material = Math.max(contact, restrict, obstruction, arm);
  const legitimateBallPlay = ballPlay >= 0.72 && arm < 0.52 && restrict < 0.58;
  const eligible = Boolean(
    ballInAir
      && catchable
      && depth > 1
      && early >= 0.015
      && material >= 0.36
      && !faceGuardingOnly
      && !legitimateBallPlay,
  );
  const severity = clamp(
    contact * 0.22 + restrict * 0.24 + obstruction * 0.18 + arm * 0.19
      + clamp(early / 0.45) * 0.17 - ballPlay * 0.18,
  );
  const probability = clamp(0.62 + severity * 0.37, 0, 0.992);
  const evidence = [];
  if (early >= 0.015) evidence.push(`contact ${round(early, 2)} s before ball arrival`);
  if (arm >= 0.36) evidence.push('defender used an arm bar before the catch point');
  if (obstruction >= 0.42) evidence.push('defender cut off the receiver without playing the ball');
  if (!catchable) evidence.push('pass was not catchable');
  if (legitimateBallPlay) evidence.push('defender was making a legitimate play on the ball');
  if (faceGuardingOnly) evidence.push('face guarding occurred without material contact or restriction');
  const reason = eligible
    ? 'Early contact materially hindered a receiver’s opportunity on a catchable pass.'
    : !ballInAir
      ? 'Pass interference cannot occur before the forward pass is in the air.'
      : !catchable
        ? 'There is no interference foul on an uncatchable pass.'
        : legitimateBallPlay
          ? 'Both players retained an equal opportunity to play the ball.'
          : 'The contact did not materially hinder the catch opportunity.';
  return assessCall({
    eligible, probability, severity, evidence, reason,
    definition: FOOTBALL_PENALTIES.DPI,
    details: { offenderId, offenderRole, foulSpot, occurredAt },
    rng,
  });
}

const sortPenalties = penalties => [...penalties].sort((left, right) => {
  const leftTime = Number.isFinite(left.occurredAt) ? left.occurredAt : Number.POSITIVE_INFINITY;
  const rightTime = Number.isFinite(right.occurredAt) ? right.occurredAt : Number.POSITIVE_INFINITY;
  if (leftTime !== rightTime) return leftTime - rightTime;
  if (left.liveBall !== right.liveBall) return left.liveBall ? 1 : -1;
  return right.severity - left.severity;
});

/** Evaluate all pre-snap candidates and choose the chronologically primary flag. */
export function evaluatePreSnapPenalties({
  offenseMovements = [],
  defensiveEntries = [],
  snapOccurred = false,
  rng,
} = {}) {
  requireRng(rng);
  const assessments = [];
  for (const candidate of offenseMovements) assessments.push(assessFalseStart({ ...candidate, rng }));
  for (const candidate of defensiveEntries) assessments.push(assessOffsides({ ...candidate, snapOccurred, rng }));
  const penalties = sortPenalties(assessments.filter(item => item.called).map(item => item.penalty));
  const deadBall = penalties.find(penalty => !penalty.liveBall) || null;
  const primary = deadBall || penalties[0] || null;
  return {
    called: Boolean(primary),
    primary,
    penalties,
    assessments,
    playMayContinue: !deadBall,
    freePlay: !deadBall && penalties.some(penalty => penalty.freePlay),
  };
}

/** Evaluate block and coverage interactions during a live snap. */
export function evaluateLivePenalties({ blocks = [], coverages = [], rng } = {}) {
  requireRng(rng);
  const assessments = [];
  for (const candidate of blocks) assessments.push(assessHolding({ ...candidate, rng }));
  for (const candidate of coverages) assessments.push(assessPassInterference({ ...candidate, rng }));
  const penalties = sortPenalties(assessments.filter(item => item.called).map(item => item.penalty));
  return {
    called: penalties.length > 0,
    primary: penalties[0] || null,
    penalties,
    assessments,
    playMayContinue: true,
    freePlay: false,
  };
}

const normalizeDownState = (state = {}) => {
  const ballSpot = clamp(state.ballSpot ?? 25, 0, 100);
  const down = Math.max(1, Math.min(4, Math.trunc(Number(state.down) || 1)));
  const toGo = Math.max(0.1, Number(state.toGo) || Math.min(10, 100 - ballSpot));
  return {
    ...state,
    possession: Number.isInteger(state.possession) ? state.possession : 0,
    ballSpot,
    down,
    toGo,
  };
};

const seriesDistance = ballSpot => Math.max(0.1, Math.min(10, 100 - ballSpot));

/**
 * Resolve the ordinary down after a legal play. Turnovers convert the dead-ball
 * spot into the new offense's coordinate system.
 */
export function advanceDownAfterPlay(downState, {
  endSpot = downState?.ballSpot,
  outcome = 'run',
  changeOfPossession = false,
} = {}) {
  const before = normalizeDownState(downState);
  const spot = clamp(endSpot, 0, 100);
  const lineToGain = clamp(before.ballSpot + before.toGo, 0, 100);
  const normalizedOutcome = String(outcome || 'run').toLowerCase();
  if (normalizedOutcome === 'touchdown' || spot >= 100) {
    return { before, next: { ...before, ballSpot: 100 }, result: 'touchdown', firstDown: false, turnoverOnDowns: false };
  }
  if (normalizedOutcome === 'safety' || spot <= 0) {
    return { before, next: { ...before, ballSpot: 0 }, result: 'safety', firstDown: false, turnoverOnDowns: false };
  }
  const turnover = changeOfPossession || ['interception', 'fumble-lost', 'turnover'].includes(normalizedOutcome);
  if (turnover) {
    const newSpot = clamp(100 - spot, 1, 99);
    return {
      before,
      next: { ...before, possession: 1 - before.possession, ballSpot: newSpot, down: 1, toGo: seriesDistance(newSpot) },
      result: 'turnover', firstDown: true, turnoverOnDowns: false,
    };
  }
  const incomplete = normalizedOutcome === 'incomplete';
  const firstDown = !incomplete && spot + 0.001 >= lineToGain;
  if (firstDown) {
    return {
      before,
      next: { ...before, ballSpot: clamp(spot, 1, 99), down: 1, toGo: seriesDistance(spot) },
      result: 'first-down', firstDown: true, turnoverOnDowns: false,
    };
  }
  const nextDown = before.down + 1;
  if (nextDown > 4) {
    const newSpot = clamp(100 - spot, 1, 99);
    return {
      before,
      next: { ...before, possession: 1 - before.possession, ballSpot: newSpot, down: 1, toGo: seriesDistance(newSpot) },
      result: 'turnover-on-downs', firstDown: false, turnoverOnDowns: true,
    };
  }
  return {
    before,
    next: {
      ...before,
      ballSpot: clamp(incomplete ? before.ballSpot : spot, 1, 99),
      down: nextDown,
      toGo: Math.max(0.1, lineToGain - (incomplete ? before.ballSpot : spot)),
    },
    result: incomplete ? 'incomplete' : 'down-complete',
    firstDown: false,
    turnoverOnDowns: false,
  };
}

const acceptedPenalty = penalty => penalty?.penalty || penalty;

/**
 * Enforce one accepted penalty against an offense-relative down state.
 * Accepted false starts, offsides, and offensive holding replay the original
 * down. Defensive yardage that reaches the line to gain creates a new series;
 * DPI is a first down at the spot of the foul.
 */
export function enforcePenalty({
  downState,
  penalty,
  accepted = true,
  playResult = null,
} = {}) {
  const before = normalizeDownState(downState);
  const foul = acceptedPenalty(penalty);
  if (!foul) {
    if (playResult) return { status: 'no-penalty', ...advanceDownAfterPlay(before, playResult), penalty: null };
    throw new TypeError('penalty is required');
  }
  if (!accepted) {
    const played = playResult
      ? advanceDownAfterPlay(before, playResult)
      : { before, next: before, result: 'declined', firstDown: false, turnoverOnDowns: false };
    return { status: 'declined', penalty: foul, ...played };
  }

  const originalLineToGain = clamp(before.ballSpot + before.toGo, 0, 100);
  let baseSpot = before.ballSpot;
  let newSpot = before.ballSpot;
  let actualYards = 0;
  let halfDistance = false;
  let safety = false;
  let goalLineDpi = false;

  if (foul.type === 'defensive-pass-interference' || foul.enforcement === 'spot-foul') {
    const spot = Number.isFinite(foul.foulSpot) ? foul.foulSpot : before.ballSpot;
    if (spot >= 100) {
      goalLineDpi = true;
      newSpot = before.ballSpot >= 98 ? before.ballSpot + (100 - before.ballSpot) / 2 : 99;
      halfDistance = before.ballSpot >= 98;
    } else {
      newSpot = Math.max(before.ballSpot, clamp(spot, 1, 99));
    }
    actualYards = newSpot - before.ballSpot;
  } else {
    if (foul.enforcement === 'foul-spot' && Number.isFinite(foul.foulSpot)) baseSpot = foul.foulSpot;
    const yards = Math.max(0, Number(foul.yards) || 0);
    if (foul.team === 'offense') {
      if (foul.type === 'holding' && (foul.foulInEndZone || baseSpot <= 0)) {
        safety = true;
        newSpot = 0;
        actualYards = -before.ballSpot;
      } else if (baseSpot - yards <= 0) {
        newSpot = baseSpot / 2;
        actualYards = newSpot - before.ballSpot;
        halfDistance = true;
      } else {
        newSpot = baseSpot - yards;
        actualYards = newSpot - before.ballSpot;
      }
    } else if (baseSpot + yards >= 100) {
      newSpot = baseSpot + (100 - baseSpot) / 2;
      actualYards = newSpot - before.ballSpot;
      halfDistance = true;
    } else {
      newSpot = baseSpot + yards;
      actualYards = newSpot - before.ballSpot;
    }
  }

  newSpot = clamp(newSpot, 0, 100);
  const firstDown = !safety && (Boolean(foul.automaticFirstDown)
    || (foul.team === 'defense' && newSpot + 0.001 >= originalLineToGain));
  const next = safety
    ? { ...before, ballSpot: 0 }
    : firstDown
      ? { ...before, ballSpot: newSpot, down: 1, toGo: seriesDistance(newSpot) }
      : {
        ...before,
        ballSpot: newSpot,
        down: foul.repeatDown === false ? Math.min(4, before.down + 1) : before.down,
        toGo: Math.max(0.1, originalLineToGain - newSpot),
      };
  const ruling = {
    status: 'accepted',
    penalty: foul,
    before,
    next,
    result: safety ? 'safety' : firstDown ? 'first-down-by-penalty' : 'penalty-enforced',
    firstDown,
    turnoverOnDowns: false,
    enforcement: {
      baseSpot: round(baseSpot),
      newSpot: round(newSpot),
      signedYards: round(actualYards),
      assessedYards: round(Math.abs(actualYards)),
      halfDistance,
      safety,
      goalLineDpi,
      replayDown: foul.repeatDown !== false,
      originalLineToGain: round(originalLineToGain),
    },
    clock: { stop: true, resetPlayClockTo: PLAY_CLOCK_SECONDS },
  };
  return ruling;
}

/** Resolve no flag, one flag, same-team flags, or offsetting live-ball flags. */
export function enforcePenaltySet({ downState, penalties = [], playResult = null } = {}) {
  const before = normalizeDownState(downState);
  const fouls = sortPenalties(penalties.map(acceptedPenalty).filter(Boolean));
  if (!fouls.length) {
    const played = advanceDownAfterPlay(before, playResult || {});
    return { status: 'no-penalty', penalty: null, penalties: [], ...played };
  }
  const teams = new Set(fouls.filter(foul => foul.liveBall).map(foul => foul.team));
  if (teams.size > 1) {
    return {
      status: 'offsetting', penalty: null, penalties: fouls, before, next: before,
      result: 'replay-down', firstDown: false, turnoverOnDowns: false,
      enforcement: { newSpot: before.ballSpot, signedYards: 0, assessedYards: 0, replayDown: true },
      clock: { stop: true, resetPlayClockTo: PLAY_CLOCK_SECONDS },
    };
  }
  const selected = [...fouls].sort((left, right) => {
    if (left.automaticFirstDown !== right.automaticFirstDown) return left.automaticFirstDown ? -1 : 1;
    const leftDistance = left.yards ?? Math.abs((left.foulSpot ?? before.ballSpot) - before.ballSpot);
    const rightDistance = right.yards ?? Math.abs((right.foulSpot ?? before.ballSpot) - before.ballSpot);
    return rightDistance - leftDistance;
  })[0];
  return { ...enforcePenalty({ downState: before, penalty: selected }), penalties: fouls };
}

/** Create immutable clock state for the dead-ball interval between snaps. */
export function createDeadBallClockState({
  gameClock = 0,
  playClock = PLAY_CLOCK_SECONDS,
  gameClockRunning = false,
  readyForPlay = true,
} = {}) {
  return {
    gameClock: Math.max(0, Number(gameClock) || 0),
    playClock: clamp(playClock, 0, PLAY_CLOCK_SECONDS),
    gameClockRunning: Boolean(gameClockRunning),
    readyForPlay: Boolean(readyForPlay),
    delayCharged: false,
  };
}

/**
 * Advance the 25-second play clock and any in-bounds dead-ball game-clock
 * runoff. A delay flag stops both clocks exactly when the play clock expires,
 * so a large simulation timestep cannot burn extra game time after the whistle.
 */
export function advanceDeadBallClock(clockState, {
  elapsed = 0,
  readyForPlay = clockState?.readyForPlay,
  gameClockRunning = clockState?.gameClockRunning,
} = {}) {
  const current = {
    ...createDeadBallClockState(clockState),
    delayCharged: Boolean(clockState?.delayCharged),
  };
  const dt = Math.max(0, Number(elapsed) || 0);
  const ready = Boolean(readyForPlay);
  const running = Boolean(gameClockRunning);
  const untilPlayClockWhistle = ready && !current.delayCharged ? current.playClock : Number.POSITIVE_INFINITY;
  const applied = Math.min(dt, untilPlayClockWhistle, running ? current.gameClock : Number.POSITIVE_INFINITY);
  const playClockRunoff = ready ? Math.min(current.playClock, applied) : 0;
  const gameClockRunoff = running ? Math.min(current.gameClock, applied) : 0;
  const nextPlayClock = Math.max(0, current.playClock - playClockRunoff);
  const nextGameClock = Math.max(0, current.gameClock - gameClockRunoff);
  const newlyExpired = ready && !current.delayCharged && current.playClock > 0 && nextPlayClock <= 0;
  const periodExpired = running && current.gameClock > 0 && nextGameClock <= 0;
  const penalty = newlyExpired ? makePenalty(FOOTBALL_PENALTIES.DELAY_OF_GAME, {
    severity: 1,
    probability: 1,
    evidence: ['the 25-second play clock expired before the snap'],
    reason: 'The offense did not snap the ball before the play clock reached zero.',
  }) : null;
  return {
    clock: {
      gameClock: nextGameClock,
      playClock: nextPlayClock,
      gameClockRunning: newlyExpired || periodExpired ? false : running,
      readyForPlay: ready,
      delayCharged: current.delayCharged || newlyExpired,
    },
    elapsedApplied: round(applied),
    gameClockRunoff: round(gameClockRunoff),
    playClockRunoff: round(playClockRunoff),
    playClockExpired: newlyExpired,
    periodExpired,
    penalty,
  };
}

/** Reset the play clock after a snap, timeout, penalty, or new ready signal. */
export function resetDeadBallClock(clockState, {
  playClock = PLAY_CLOCK_SECONDS,
  gameClockRunning = clockState?.gameClockRunning,
  readyForPlay = true,
} = {}) {
  return {
    gameClock: Math.max(0, Number(clockState?.gameClock) || 0),
    playClock: clamp(playClock, 0, PLAY_CLOCK_SECONDS),
    gameClockRunning: Boolean(gameClockRunning),
    readyForPlay: Boolean(readyForPlay),
    delayCharged: false,
  };
}

/**
 * Basic late-game clock-management decision. By default the trailing team is
 * evaluated. A trailing defense stops an in-bounds drain inside 2:15; a trailing
 * offense preserves time in the final 75 seconds when hurry-up time is scarce.
 */
export function decideLateGameTimeout({
  teamIndex = null,
  possession = 0,
  score = [0, 0],
  quarter = 4,
  gameClock = 0,
  playClock = PLAY_CLOCK_SECONDS,
  timeouts = [0, 0],
  clockRunning = false,
  phase = 'dead',
  down = 1,
  toGo = 10,
  ballSpot = 50,
} = {}) {
  const scores = [Number(score[0]) || 0, Number(score[1]) || 0];
  const trailing = scores[0] === scores[1] ? null : scores[0] < scores[1] ? 0 : 1;
  const candidate = Number.isInteger(teamIndex) ? teamIndex : trailing;
  const available = candidate === null ? 0 : Math.max(0, Number(timeouts[candidate]) || 0);
  const clock = Math.max(0, Number(gameClock) || 0);
  const legalPhase = phase === 'dead' || phase === 'preplay';
  const deficit = candidate === null ? 0 : scores[1 - candidate] - scores[candidate];
  const projectedClock = Math.max(0, clock - Math.min(PLAY_CLOCK_SECONDS, Math.max(0, Number(playClock) || 0)));
  const side = candidate === null ? null : candidate === possession ? 'offense' : 'defense';
  let takeTimeout = false;
  let reason = 'No late-game timeout is warranted.';

  if (candidate === null || deficit <= 0) reason = 'The game is tied or the evaluated team is not trailing.';
  else if (Number(quarter) < 4 || clock > 150 || clock <= 0) reason = 'The game is outside the late clock-management window.';
  else if (available <= 0) reason = 'No team timeouts remain.';
  else if (!clockRunning || !legalPhase) reason = 'The game clock is already stopped or the ball is live.';
  else if (deficit > 16) reason = 'The deficit is beyond the two-possession timeout model.';
  else if (side === 'defense' && clock <= 135) {
    takeTimeout = true;
    reason = 'Trailing defense stops an in-bounds play-clock drain.';
  } else if (side === 'offense') {
    const snapBudget = projectedClock / Math.max(1, 4 - Math.min(4, Math.max(1, Number(down) || 1)) + 1);
    const urgentFieldPosition = Number(ballSpot) >= 62 || Number(toGo) >= 8;
    if (clock <= 75 && (projectedClock <= 22 + available * 9 || snapBudget < 14 || urgentFieldPosition)) {
      takeTimeout = true;
      reason = 'Trailing offense preserves enough time for the remaining downs.';
    } else reason = 'The offense can use tempo and preserve the timeout for a later down.';
  }

  const urgency = candidate === null ? 0 : clamp(
    (150 - clock) / 130 * 0.54
      + Math.min(deficit, 16) / 16 * 0.20
      + (3 - Math.min(3, available)) / 3 * 0.12
      + (projectedClock <= 30 ? 0.14 : 0),
  );
  return {
    takeTimeout,
    teamIndex: candidate,
    side,
    available,
    deficit,
    urgency: round(urgency),
    projectedClockWithoutTimeout: round(projectedClock),
    reason,
  };
}

/** Apply a positive timeout decision without mutating the caller's arrays. */
export function applyTimeoutDecision({ timeouts = [0, 0], clockState, decision } = {}) {
  const nextTimeouts = [Math.max(0, Number(timeouts[0]) || 0), Math.max(0, Number(timeouts[1]) || 0)];
  if (!decision?.takeTimeout || !Number.isInteger(decision.teamIndex) || nextTimeouts[decision.teamIndex] <= 0) {
    return { applied: false, timeouts: nextTimeouts, clock: { ...clockState } };
  }
  nextTimeouts[decision.teamIndex] -= 1;
  return {
    applied: true,
    timeouts: nextTimeouts,
    clock: resetDeadBallClock(clockState, { gameClockRunning: false, readyForPlay: true }),
  };
}

/** Concise broadcast copy for an accepted or offsetting ruling. */
export function formatPenaltyCall(ruling) {
  if (!ruling) return '';
  if (ruling.status === 'offsetting') return 'OFFSETTING PENALTIES · REPLAY THE DOWN';
  const penalty = ruling.penalty || ruling;
  const offender = penalty.offenderId ? ` · ${penalty.offenderId}` : '';
  if (ruling.status === 'declined') return `${penalty.name}${offender} · DECLINED`;
  const enforcement = ruling.enforcement || {};
  if (enforcement.safety) return `${penalty.name}${offender} · SAFETY`;
  if (penalty.automaticFirstDown || ruling.firstDown) {
    const spot = enforcement.goalLineDpi ? 'AT THE 1' : `${round(enforcement.assessedYards || 0, 1)} YARDS`;
    return `${penalty.name}${offender} · ${spot} · AUTOMATIC FIRST DOWN`;
  }
  const distance = enforcement.halfDistance
    ? 'HALF THE DISTANCE'
    : `${round(enforcement.assessedYards ?? penalty.yards ?? 0, 1)} YARDS`;
  return `${penalty.name}${offender} · ${distance} · REPLAY THE DOWN`;
}
