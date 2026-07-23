(function (root, factory) {
  'use strict';

  if (typeof define === 'function' && define.amd) {
    define(['./basketball-visual-reset'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./basketball-visual-reset.js'));
  } else {
    root.CyberligaBasketballBroadcastDirector = factory(root.CyberligaBasketballVisualReset);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Timeline) {
  'use strict';

  if (!Timeline || typeof Timeline.sample !== 'function' || !Array.isArray(Timeline.actors)) {
    throw new Error('CyberligaBasketballBroadcastDirector requires CyberligaBasketballVisualReset.');
  }

  var VERSION = '1.0.0';
  var DURATION_MS = 90000;
  var HOME_TEAM_ID = 'new-york-brownstones';
  var AWAY_TEAM_ID = 'toronto-lake-effect';
  var STOOPY_ID = 'new-york-brownstones-a1';
  var LINTEL_ID = 'new-york-brownstones-a2';
  var MARNIE_ID = 'new-york-brownstones-a4';
  var FLURRY_ID = 'toronto-lake-effect-a1';
  var PARKA_ID = 'toronto-lake-effect-a2';
  var TOQUE_ID = 'toronto-lake-effect-a4';
  var RIGHT_RIM = freeze({ x: 42, y: 0, z: 10 });
  var LEFT_RIM = freeze({ x: -42, y: 0, z: 10 });
  var TAU = Math.PI * 2;

  function freeze(value, seen) {
    if (!value || (typeof value !== 'object' && typeof value !== 'function') || Object.isFrozen(value)) return value;
    seen = seen || [];
    if (seen.indexOf(value) >= 0) return value;
    seen.push(value);
    Object.keys(value).forEach(function (key) { freeze(value[key], seen); });
    return Object.freeze(value);
  }

  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
  function ease(value) { value = clamp(value, 0, 1); return value * value * (3 - 2 * value); }
  function progress(value, start, end) { return end <= start ? (value >= end ? 1 : 0) : clamp((value - start) / (end - start), 0, 1); }
  function mix(from, to, amount) { return from + (to - from) * amount; }
  function round(value, places) {
    var factor = Math.pow(10, places == null ? 4 : places);
    var result = Math.round(Number(value) * factor) / factor;
    return Object.is(result, -0) ? 0 : result;
  }
  function vec(x, y, z) { return { x: round(x), y: round(y), z: round(z) }; }
  function mixVec(from, to, amount) { return vec(mix(from.x, to.x, amount), mix(from.y, to.y, amount), mix(from.z, to.z, amount)); }
  function pulse(value, start, peak, end) {
    if (value <= start || value >= end) return 0;
    if (value <= peak) return ease(progress(value, start, peak));
    return 1 - ease(progress(value, peak, end));
  }
  function midpoint(left, right) { return vec((left.x + right.x) / 2, (left.y + right.y) / 2, (left.z + right.z) / 2); }

  var ACTORS = Timeline.actors;
  var ACTOR_IDS = freeze(ACTORS.map(function (actor) { return actor.id; }));
  var ACTOR_BY_ID = Object.create(null);
  ACTORS.forEach(function (actor) { ACTOR_BY_ID[actor.id] = actor; });
  var HOME_IDS = ACTOR_IDS.filter(function (id) { return ACTOR_BY_ID[id].teamId === HOME_TEAM_ID; });
  var AWAY_IDS = ACTOR_IDS.filter(function (id) { return ACTOR_BY_ID[id].teamId === AWAY_TEAM_ID; });

  var MILESTONES = freeze({
    coldOpenEndMs: 6000,
    stoopDropStartMs: 6000,
    stoopScreenContactMs: 9000,
    stoopPassReleaseMs: 11000,
    stoopCatchMs: 12100,
    stoopRimContactMs: 14350,
    stoopScoreCertifiedMs: 14500,
    stoopLandingMs: 15100,
    stoopRecoveryReadyMs: 16060,
    stoopDropEndMs: 21000,
    replayStartMs: 21000,
    replayEndMs: 29000,
    whiteoutStartMs: 29000,
    whiteoutPassReleaseMs: 32500,
    whiteoutCatchMs: 33500,
    whiteoutShotReleaseMs: 34600,
    whiteoutRimContactMs: 36500,
    whiteoutScoreCertifiedMs: 36700,
    whiteoutLandingMs: 37000,
    whiteoutEndMs: 42000,
    switchStartMs: 42000,
    switchScreenContactMs: 44500,
    switchAssignmentMs: 45200,
    switchPassReleaseMs: 47000,
    switchDeflectionMs: 48200,
    switchTurnoverCertifiedMs: 48400,
    switchEndMs: 53500,
    blockStartMs: 53500,
    blockShotReleaseMs: 58500,
    blockContactMs: 60000,
    blockCertifiedMs: 60200,
    blockEndMs: 65500,
    putbackStartMs: 65500,
    offensiveReboundMs: 67500,
    putbackTakeoffMs: 71500,
    putbackRimContactMs: 73100,
    putbackScoreCertifiedMs: 73300,
    putbackLandingMs: 74000,
    putbackBaselineReadyMs: 74500,
    putbackRecoveryReadyMs: 74960,
    finalCardMs: 77500,
    putbackEndMs: 84000,
    resetStartMs: 84000,
    resetEndMs: 90000
  });

  var SEGMENTS = freeze([
    {
      id: 'segment-00-cold-open', index: 0, startMs: 0, endMs: 6000, kind: 'context',
      possessionId: null, outcomeId: null, offenseTeamId: null, defenseTeamId: null, attackingRim: null,
      headline: { kicker: 'THE HIGH ROOM', title: 'BROWNSTONES · LAKE EFFECT', deck: 'Architecture meets whiteout timing.' },
      stakes: { id: 'rivalry-response', label: 'One-possession argument', detail: 'Every answer must survive physical contact.', competitiveOnly: true, wagering: false },
      featuredActorIds: [STOOPY_ID, TOQUE_ID], clockRuns: false
    },
    {
      id: 'segment-01-stoop-drop-live', index: 1, startMs: 6000, endMs: 21000, kind: 'live',
      possessionId: 'possession-01-stoop-drop', outcomeId: 'outcome-01-stoop-drop-make',
      offenseTeamId: HOME_TEAM_ID, defenseTeamId: AWAY_TEAM_ID, attackingRim: RIGHT_RIM,
      headline: { kicker: 'NEW YORK BALL', title: 'BUILD THE ADVANTAGE', deck: 'Stoopy turns one legal screen into a roll window.' },
      stakes: { id: 'first-answer', label: 'New York can take the room', detail: 'Toronto must solve Stoopy without losing Toque.', competitiveOnly: true, wagering: false },
      featuredActorIds: [STOOPY_ID, LINTEL_ID, TOQUE_ID], clockRuns: true
    },
    {
      id: 'segment-02-stoop-drop-replay', index: 2, startMs: 21000, endMs: 29000, kind: 'replay',
      possessionId: 'possession-01-stoop-drop', outcomeId: 'outcome-01-stoop-drop-make',
      offenseTeamId: HOME_TEAM_ID, defenseTeamId: AWAY_TEAM_ID, attackingRim: RIGHT_RIM,
      headline: { kicker: 'TRUTHFUL REPLAY · 0.5375×', title: 'THE DELAY BECOMES THE DUNK', deck: 'The replay re-renders only the prior recorded possession.' },
      stakes: { id: 'causal-proof', label: 'Why the make happened', detail: 'Screen contact, catch and rim crossing stay in one chain.', competitiveOnly: true, wagering: false },
      featuredActorIds: [STOOPY_ID, PARKA_ID, TOQUE_ID], clockRuns: false
    },
    {
      id: 'segment-03-whiteout-answer', index: 3, startMs: 29000, endMs: 42000, kind: 'live',
      possessionId: 'possession-02-whiteout-answer', outcomeId: 'outcome-02-whiteout-three',
      offenseTeamId: AWAY_TEAM_ID, defenseTeamId: HOME_TEAM_ID, attackingRim: LEFT_RIM,
      headline: { kicker: 'TORONTO BALL', title: 'WHITEOUT ANSWER', deck: 'Toque drifts left, catches cleanly and rises before the close.' },
      stakes: { id: 'tie-response', label: 'Toronto can erase the lead', detail: 'The left-rim answer must beat a real closeout.', competitiveOnly: true, wagering: false },
      featuredActorIds: [TOQUE_ID, PARKA_ID, STOOPY_ID], clockRuns: true
    },
    {
      id: 'segment-04-switch-denial', index: 4, startMs: 42000, endMs: 53500, kind: 'live',
      possessionId: 'possession-03-switch-denial', outcomeId: 'outcome-03-switch-turnover',
      offenseTeamId: HOME_TEAM_ID, defenseTeamId: AWAY_TEAM_ID, attackingRim: RIGHT_RIM,
      headline: { kicker: 'TACTICAL COUNTER', title: 'TORONTO SWITCHES THE WINDOW SHUT', deck: 'Toque takes the pass lane after the screen connects.' },
      stakes: { id: 'learned-counter', label: 'The defense remembers', detail: 'A legal switch can turn New York’s first solution against it.', competitiveOnly: true, wagering: false },
      featuredActorIds: [TOQUE_ID, LINTEL_ID, STOOPY_ID], clockRuns: true
    },
    {
      id: 'segment-05-toque-block', index: 5, startMs: 53500, endMs: 65500, kind: 'live',
      possessionId: 'possession-04-second-chance', outcomeId: 'outcome-04-toque-block',
      offenseTeamId: HOME_TEAM_ID, defenseTeamId: AWAY_TEAM_ID, attackingRim: RIGHT_RIM,
      headline: { kicker: 'RIM ARGUMENT', title: 'TOQUE ERASES THE ANGLE', deck: 'The contest reaches the ball before the ball reaches the glass.' },
      stakes: { id: 'second-chance-open', label: 'The block is not the possession', detail: 'A live carom leaves Stoopy one more physical decision.', competitiveOnly: true, wagering: false },
      featuredActorIds: [TOQUE_ID, MARNIE_ID, STOOPY_ID], clockRuns: true
    },
    {
      id: 'segment-06-stoopy-putback', index: 6, startMs: 65500, endMs: 84000, kind: 'live',
      possessionId: 'possession-04-second-chance', outcomeId: 'outcome-05-stoopy-putback',
      offenseTeamId: HOME_TEAM_ID, defenseTeamId: AWAY_TEAM_ID, attackingRim: RIGHT_RIM,
      headline: { kicker: 'SAME POSSESSION', title: 'THE BUILDING COMES BACK', deck: 'Stoopy secures the offensive board and pays for the heavy landing.' },
      stakes: { id: 'final-consequence', label: 'New York owns the second effort', detail: 'The result includes the rebound, putback and slow recovery.', competitiveOnly: true, wagering: false },
      featuredActorIds: [STOOPY_ID, TOQUE_ID, MARNIE_ID], clockRuns: true
    },
    {
      id: 'segment-07-reset', index: 7, startMs: 84000, endMs: 90000, kind: 'reset',
      possessionId: null, outcomeId: null, offenseTeamId: null, defenseTeamId: null, attackingRim: null,
      headline: { kicker: 'END OF SEQUENCE', title: '22–20 · NEW YORK', deck: 'The broadcast returns to live context without inventing another event.' },
      stakes: { id: 'loop-handoff', label: 'The next possession remains unwritten', detail: 'Reset is presentation only; it certifies nothing.', competitiveOnly: true, wagering: false },
      featuredActorIds: [STOOPY_ID, TOQUE_ID], clockRuns: false
    }
  ]);

  var POSSESSIONS = freeze([
    { id: 'possession-01-stoop-drop', sequence: 1, startMs: 6000, endMs: 21000, offenseTeamId: HOME_TEAM_ID, defenseTeamId: AWAY_TEAM_ID, attackingRim: RIGHT_RIM },
    { id: 'possession-02-whiteout-answer', sequence: 2, startMs: 29000, endMs: 42000, offenseTeamId: AWAY_TEAM_ID, defenseTeamId: HOME_TEAM_ID, attackingRim: LEFT_RIM },
    { id: 'possession-03-switch-denial', sequence: 3, startMs: 42000, endMs: 48400, offenseTeamId: HOME_TEAM_ID, defenseTeamId: AWAY_TEAM_ID, attackingRim: RIGHT_RIM },
    { id: 'possession-03b-toronto-transition', sequence: 4, startMs: 48400, endMs: 53500, offenseTeamId: AWAY_TEAM_ID, defenseTeamId: HOME_TEAM_ID, attackingRim: LEFT_RIM },
    { id: 'possession-04-second-chance', sequence: 5, startMs: 53500, endMs: 84000, offenseTeamId: HOME_TEAM_ID, defenseTeamId: AWAY_TEAM_ID, attackingRim: RIGHT_RIM }
  ]);
  var POSSESSION_BY_ID = Object.create(null);
  POSSESSIONS.forEach(function (possession) { POSSESSION_BY_ID[possession.id] = possession; });

  var OUTCOMES = freeze([
    { id: 'outcome-01-stoop-drop-make', sequence: 1, type: 'made-dunk', possessionId: 'possession-01-stoop-drop', teamId: HOME_TEAM_ID, actorId: STOOPY_ID, points: 2, contactAtMs: 14350, certifiedAtMs: 14500, eventId: 'visual-reset-stoop-drop-001', attackingRim: RIGHT_RIM },
    { id: 'outcome-02-whiteout-three', sequence: 2, type: 'made-three', possessionId: 'possession-02-whiteout-answer', teamId: AWAY_TEAM_ID, actorId: TOQUE_ID, points: 3, contactAtMs: 36500, certifiedAtMs: 36700, eventId: 'broadcast-whiteout-answer-001', attackingRim: LEFT_RIM },
    { id: 'outcome-03-switch-turnover', sequence: 3, type: 'live-ball-turnover', possessionId: 'possession-03-switch-denial', teamId: AWAY_TEAM_ID, actorId: TOQUE_ID, points: 0, contactAtMs: 48200, certifiedAtMs: 48400, eventId: 'broadcast-switch-denial-001', attackingRim: RIGHT_RIM },
    { id: 'outcome-04-toque-block', sequence: 4, type: 'blocked-miss', possessionId: 'possession-04-second-chance', teamId: AWAY_TEAM_ID, actorId: TOQUE_ID, points: 0, contactAtMs: 60000, certifiedAtMs: 60200, eventId: 'broadcast-toque-block-001', attackingRim: RIGHT_RIM },
    { id: 'outcome-05-stoopy-putback', sequence: 5, type: 'offensive-rebound-putback', possessionId: 'possession-04-second-chance', teamId: HOME_TEAM_ID, actorId: STOOPY_ID, points: 2, contactAtMs: 73100, certifiedAtMs: 73300, eventId: 'broadcast-stoopy-putback-001', attackingRim: RIGHT_RIM }
  ]);
  var OUTCOME_BY_ID = Object.create(null);
  OUTCOMES.forEach(function (outcome) { OUTCOME_BY_ID[outcome.id] = outcome; });

  var AUDIO_CUES = freeze([
    ['broadcast-open', 0, 'music', 'dry-room-open'], ['matchup-context', 3000, 'graphic', 'matchup-card'],
    ['stoop-dribble-1', 6300, 'ball', 'floor'], ['stoop-dribble-2', 6600, 'ball', 'floor'],
    ['stoop-dribble-3', 6900, 'ball', 'floor'], ['stoop-dribble-4', 7200, 'ball', 'floor'],
    ['stoop-screen', 9000, 'body', 'screen'], ['stoop-pass', 11000, 'ball', 'pass'], ['stoop-catch', 12100, 'ball', 'two-hand-catch'],
    ['stoop-rim', 14350, 'rim', 'net'], ['stoop-score', 14500, 'crowd', 'rim-side-rise'], ['stoop-landing', 15100, 'body', 'heavy-landing'],
    ['replay-in', 21000, 'graphic', 'truthful-replay'], ['replay-rim', 27605, 'rim', 'processed-net'],
    ['whiteout-pass', 32500, 'ball', 'pass'], ['whiteout-catch', 33500, 'ball', 'two-hand-catch'], ['whiteout-release', 34600, 'shoe', 'jump-release'],
    ['whiteout-rim', 36500, 'rim', 'left-net'], ['whiteout-score', 36700, 'crowd', 'left-side-rise'], ['whiteout-land', 37000, 'shoe', 'balanced-landing'],
    ['switch-screen', 44500, 'body', 'screen'], ['switch-call', 45200, 'voice', 'switch'], ['switch-pass', 47000, 'ball', 'pass'],
    ['switch-deflection', 48200, 'ball', 'deflection'], ['switch-certified', 48400, 'crowd', 'turnover-gasp'],
    ['block-release', 58500, 'ball', 'shot-release'], ['toque-block', 60000, 'body', 'clean-block'], ['block-certified', 60200, 'crowd', 'block-rise'],
    ['stoopy-board', 67500, 'ball', 'offensive-rebound'], ['putback-takeoff', 71500, 'shoe', 'two-foot-load'],
    ['putback-rim', 73100, 'rim', 'net'], ['putback-score', 73300, 'crowd', 'final-rise'], ['putback-landing', 74000, 'body', 'heavy-landing'],
    ['final-card', 77500, 'graphic', 'certified-payoff'], ['reset-bed', 84000, 'music', 'resolve'], ['loop-ready', 89500, 'room', 'context-return']
  ].map(function (row) { return { id: row[0], atMs: row[1], family: row[2], cause: row[3] }; }));

  function path(rows) { return rows.map(function (row) { return { atMs: row[0], x: row[1], y: row[2], z: row[3] || 0 }; }); }
  function pathAt(rows, timeMs) {
    if (!rows || !rows.length) return vec(0, 0, 0);
    if (timeMs <= rows[0].atMs) return vec(rows[0].x, rows[0].y, rows[0].z);
    for (var index = 1; index < rows.length; index += 1) {
      var next = rows[index];
      if (timeMs <= next.atMs) {
        var previous = rows[index - 1];
        var amount = ease(progress(timeMs, previous.atMs, next.atMs));
        return vec(mix(previous.x, next.x, amount), mix(previous.y, next.y, amount), mix(previous.z, next.z, amount));
      }
    }
    var last = rows[rows.length - 1];
    return vec(last.x, last.y, last.z);
  }

  function formation(offenseTeamId, direction) {
    var offenseIds = offenseTeamId === HOME_TEAM_ID ? HOME_IDS : AWAY_IDS;
    var defenseIds = offenseTeamId === HOME_TEAM_ID ? AWAY_IDS : HOME_IDS;
    var offense = [[12, 0], [-16, -6], [2, 12], [5, -14], [8, 7]];
    var defense = [[34, 0], [-8, -6], [8, 12], [18, 7], [14, -10]];
    var result = Object.create(null);
    offenseIds.forEach(function (id, index) { result[id] = vec(offense[index][0] * direction, offense[index][1], 0); });
    defenseIds.forEach(function (id, index) { result[id] = vec(defense[index][0] * direction, defense[index][1], 0); });
    return result;
  }

  var WHITEOUT_PATHS = {
    'toronto-lake-effect-a1': path([[0, -10, 0], [3500, -15, -3], [7500, -28, -4], [13000, -30, -5]]),
    'toronto-lake-effect-a2': path([[0, 16, -7], [3500, -10, -5], [4500, -14, -6], [13000, -18, -8]]),
    'toronto-lake-effect-a4': path([[0, -6, 12], [3500, -20, 7], [4500, -25, 2], [5200, -29, 1], [5600, -30, 1, 3.2], [7000, -30, 1, 0], [13000, -29, 2, 0]]),
    'new-york-brownstones-a1': path([[0, -34, -1], [5600, -34, -2], [7500, -36, -2], [13000, -34, -2]]),
    'new-york-brownstones-a2': path([[0, 10, -7], [4500, -18, -5], [7500, -27, -3], [13000, -24, -4]])
  };
  var SWITCH_PATHS = {
    'new-york-brownstones-a1': path([[0, -12, 0], [2500, -5, -4.5], [4000, -5, -4.5], [6200, 8, -1], [11500, 16, 1]]),
    'new-york-brownstones-a2': path([[0, -20, -6], [2500, -10, -5], [5000, 5, -3], [6200, 11, -2], [11500, 18, -4]]),
    'toronto-lake-effect-a2': path([[0, -14, -6], [2500, -4.4, -4.7], [4000, -3, -6], [6400, 14, -2], [11500, 5, -3]]),
    'toronto-lake-effect-a4': path([[0, 15, 7], [2500, 12, 5], [3200, -2, -2], [5000, 10, -1], [6200, 15, 0], [11500, 8, -1]])
  };
  var BLOCK_PATHS = {
    'new-york-brownstones-a1': path([[0, 10, 1], [5000, 20, 2], [6500, 28, 3], [12000, 33, 2]]),
    'new-york-brownstones-a4': path([[0, -5, -12], [3500, 20, -8], [5000, 32, -3, 2.5], [6500, 37, -1, 3], [8500, 37, -1, 0], [12000, 37, -1, 0]]),
    'toronto-lake-effect-a4': path([[0, 15, 7], [3500, 25, 2], [5000, 33, 0, 2], [6500, 38, 0, 4.2], [8500, 38, 0, 0], [12000, 38, 0, 0]]),
    'toronto-lake-effect-a1': path([[0, 34, -2], [6500, 35, -5], [12000, 35, -5]])
  };
  var PUTBACK_PATHS = {
    'new-york-brownstones-a1': path([[0, 33, 2], [2000, 34, 3.46], [4500, 35, 2], [6000, 38, .46, 2], [7600, 40.1, .46, 4.5], [7800, 40.5, .46, 4], [8500, 40.5, .46, 0], [18500, 36, 2, 0]]),
    'new-york-brownstones-a4': path([[0, 37, -1], [2000, 35, -2], [7600, 32, -5], [18500, 26, -8]]),
    'toronto-lake-effect-a4': path([[0, 38, 0], [2000, 37, 1], [6000, 37.5, 1.2, 2.8], [7600, 38, 1.2, 3.8], [8500, 38, 1.2, 0], [18500, 34, 3, 0]]),
    'toronto-lake-effect-a1': path([[0, 35, -5], [7600, 35, -6], [18500, 34, -5]])
  };

  function anchorPose(position, facing, pose) {
    var reach = clamp(Number(pose.reach) || 0, 0, 1);
    var forward = .7 + reach * 1.2;
    var height = 2.15 + reach * 3.35;
    return {
      leftHand: vec(position.x + facing * (forward - .12), position.y + .46, position.z + height - .05),
      rightHand: vec(position.x + facing * forward, position.y - .46, position.z + height),
      head: vec(position.x + facing * .1, position.y, position.z + 3.8 - (pose.compression || 0) * .45),
      leftFoot: vec(position.x - facing * .28, position.y + .38, Math.max(0, position.z)),
      rightFoot: vec(position.x + facing * .3, position.y - .38, Math.max(0, position.z))
    };
  }

  function basePose(id, localMs, durationMs) {
    return { id: id, progress: round(progress(localMs, 0, durationMs)), plant: 0, jump: 0, crouch: 0, lean: 0, reach: .2, compression: 0 };
  }

  function buildActors(options) {
    var initial = formation(options.formationOffenseTeamId, options.direction);
    var ownerId = options.ownerId || null;
    return ACTORS.map(function (definition) {
      var position = options.paths && options.paths[definition.id] ? pathAt(options.paths[definition.id], options.localMs) : initial[definition.id];
      var offense = definition.teamId === options.currentOffenseTeamId;
      var facing = offense ? options.currentDirection : -options.currentDirection;
      var pose = options.poseFor ? options.poseFor(definition.id, options.localMs, position) : basePose('spacing-and-help', options.localMs, options.durationMs);
      pose.jump = round(position.z);
      var anchors = anchorPose(position, facing, pose);
      var extraState = options.stateFor ? options.stateFor(definition.id, options.localMs) : {};
      return {
        id: definition.id, name: definition.name, teamId: definition.teamId, side: offense ? 'offense' : 'defense', role: definition.role,
        position: position, facing: facing, pose: pose, anchors: anchors,
        state: {
          hasBall: definition.id === ownerId, screening: Boolean(extraState.screening), screened: Boolean(extraState.screened),
          contesting: Boolean(extraState.contesting), airborne: position.z > .01, recovering: Boolean(extraState.recovering),
          secondJumpReady: extraState.secondJumpReady !== false, visible: true
        }
      };
    });
  }

  function actorById(actors, id) {
    for (var index = 0; index < actors.length; index += 1) if (actors[index].id === id) return actors[index];
    return null;
  }

  function ball(position, state, ownerId, hand, contact, visible) {
    return { state: state, ownerId: ownerId || null, hand: hand || null, visible: visible !== false, position: vec(position.x, position.y, position.z), contact: contact };
  }

  function flight(from, to, amount, arcHeight) {
    var result = mixVec(from, to, ease(amount));
    result.z = round(result.z + Math.sin(clamp(amount, 0, 1) * Math.PI) * arcHeight);
    return result;
  }

  function rimDrop(rim, direction, localProgress) {
    var amount = ease(clamp(localProgress, 0, 1));
    return vec(mix(rim.x, rim.x + direction * 1.8, amount), mix(0, -2.2, amount), mix(10, 1.2, amount));
  }

  function whiteoutPose(id, localMs) {
    var pose = basePose('spacing-and-help', localMs, 13000);
    if (id === PARKA_ID) {
      pose.id = localMs < 3500 ? 'left-rim-ballhandler' : localMs < 4500 ? 'whiteout-pass-release' : 'relocate-after-pass';
      pose.reach = localMs < 3500 ? .3 : 1 - ease(progress(localMs, 3500, 4300)) * .7;
    }
    if (id === TOQUE_ID) {
      pose.id = localMs < 4500 ? 'whiteout-drift' : localMs < 5200 ? 'two-hand-catch' : localMs < 7000 ? 'whiteout-release' : 'balanced-recovery';
      pose.reach = localMs < 4500 ? .35 : localMs < 5600 ? mix(.55, 1, ease(progress(localMs, 4500, 5600))) : mix(1, .3, ease(progress(localMs, 5600, 7000)));
      pose.crouch = round(pulse(localMs, 4400, 5100, 6200));
    }
    if (id === STOOPY_ID) pose.id = 'late-left-rim-close';
    return pose;
  }

  function whiteoutActors(localMs) {
    var owner = localMs < 3500 ? PARKA_ID : localMs >= 4500 && localMs < 5600 ? TOQUE_ID : null;
    return buildActors({
      localMs: localMs, durationMs: 13000, formationOffenseTeamId: AWAY_TEAM_ID, direction: -1,
      currentOffenseTeamId: AWAY_TEAM_ID, currentDirection: -1, paths: WHITEOUT_PATHS, ownerId: owner,
      poseFor: whiteoutPose,
      stateFor: function (id, time) { return { contesting: id === STOOPY_ID && time >= 5200 && time < 7800, recovering: id === TOQUE_ID && time >= 7000 && time < 7700 }; }
    });
  }

  function whiteoutBall(localMs, actors) {
    var parka = actorById(actors, PARKA_ID);
    var toque = actorById(actors, TOQUE_ID);
    if (localMs < 3500) return ball(parka.anchors.rightHand, 'controlled', PARKA_ID, 'rightHand', { type: 'hand', actorId: PARKA_ID, anchor: 'rightHand' });
    var releaseActors = whiteoutActors(3500);
    var catchActors = whiteoutActors(4500);
    if (localMs < 4500) {
      return ball(flight(actorById(releaseActors, PARKA_ID).anchors.rightHand, midpoint(actorById(catchActors, TOQUE_ID).anchors.leftHand, actorById(catchActors, TOQUE_ID).anchors.rightHand), progress(localMs, 3500, 4500), 1.8), 'pass-flight', null, null, { type: 'none', actorId: null, anchor: null });
    }
    if (localMs < 5000) return ball(midpoint(toque.anchors.leftHand, toque.anchors.rightHand), 'caught', TOQUE_ID, 'both', { type: 'two-hand', actorId: TOQUE_ID, anchor: 'bothHands' });
    if (localMs < 5600) return ball(toque.anchors.rightHand, 'shot-gather', TOQUE_ID, 'rightHand', { type: 'hand', actorId: TOQUE_ID, anchor: 'rightHand' });
    var shotRelease = actorById(whiteoutActors(5600), TOQUE_ID).anchors.rightHand;
    if (localMs < 7500) return ball(flight(shotRelease, LEFT_RIM, progress(localMs, 5600, 7500), 4.2), 'shot-flight', null, null, { type: 'none', actorId: null, anchor: null });
    if (localMs < 7700) return ball(rimDrop(LEFT_RIM, -1, progress(localMs, 7500, 9000)), 'rim-crossing', null, null, { type: 'rim-plane', actorId: null, anchor: 'leftRim' });
    return ball(rimDrop(LEFT_RIM, -1, progress(localMs, 7500, 9000)), 'scored', null, null, { type: localMs < 9000 ? 'net' : 'floor', actorId: null, anchor: null });
  }

  function switchPose(id, localMs) {
    var pose = basePose('spacing-and-help', localMs, 11500);
    if (id === STOOPY_ID) { pose.id = localMs < 2500 ? 'screen-approach' : localMs < 4000 ? 'architecture-screen' : 'screen-release'; pose.plant = round(localMs >= 2500 && localMs < 4000 ? 1 : 0); }
    if (id === LINTEL_ID) { pose.id = localMs < 5000 ? 'turn-corner' : 'denied-pass'; pose.reach = localMs < 5000 ? mix(.2, 1, ease(progress(localMs, 4000, 5000))) : .3; }
    if (id === TOQUE_ID) { pose.id = localMs < 3200 ? 'switch-read' : localMs < 6200 ? 'switch-denial' : 'deflection-recovery'; pose.reach = localMs < 5000 ? .4 : mix(.4, 1, ease(progress(localMs, 5000, 6200))); }
    if (id === PARKA_ID) pose.id = localMs < 4000 ? 'screen-collision' : localMs < 6400 ? 'recover-to-ball' : 'transition-control';
    return pose;
  }

  function switchActors(localMs) {
    var turned = localMs >= 6400;
    var owner = localMs < 5000 ? LINTEL_ID : turned ? PARKA_ID : null;
    return buildActors({
      localMs: localMs, durationMs: 11500, formationOffenseTeamId: HOME_TEAM_ID, direction: 1,
      currentOffenseTeamId: turned ? AWAY_TEAM_ID : HOME_TEAM_ID, currentDirection: turned ? -1 : 1,
      paths: SWITCH_PATHS, ownerId: owner, poseFor: switchPose,
      stateFor: function (id, time) { return { screening: id === STOOPY_ID && time >= 2400 && time < 4000, screened: id === PARKA_ID && time >= 2500 && time < 4000, contesting: id === TOQUE_ID && time >= 3200 && time < 6400 }; }
    });
  }

  function switchBall(localMs, actors) {
    var lintel = actorById(actors, LINTEL_ID);
    var parka = actorById(actors, PARKA_ID);
    if (localMs < 5000) return ball(lintel.anchors.rightHand, 'controlled', LINTEL_ID, 'rightHand', { type: 'hand', actorId: LINTEL_ID, anchor: 'rightHand' });
    var release = actorById(switchActors(5000), LINTEL_ID).anchors.rightHand;
    var denial = actorById(switchActors(6200), TOQUE_ID).anchors.rightHand;
    if (localMs < 6200) return ball(flight(release, denial, progress(localMs, 5000, 6200), 1.5), 'pass-flight', null, null, { type: 'none', actorId: null, anchor: null });
    var recovery = actorById(switchActors(6400), PARKA_ID).anchors.rightHand;
    if (localMs < 6400) return ball(mixVec(denial, recovery, ease(progress(localMs, 6200, 6400))), 'deflected', null, null, { type: 'defender-hand', actorId: TOQUE_ID, anchor: 'rightHand' });
    return ball(parka.anchors.rightHand, 'turnover-control', PARKA_ID, 'rightHand', { type: 'hand', actorId: PARKA_ID, anchor: 'rightHand' });
  }

  function blockPose(id, localMs) {
    var pose = basePose('spacing-and-help', localMs, 12000);
    if (id === MARNIE_ID) { pose.id = localMs < 5000 ? 'rim-drive' : localMs < 6500 ? 'layup-release' : 'blocked-reaction'; pose.reach = localMs < 5000 ? .5 : 1; }
    if (id === TOQUE_ID) { pose.id = localMs < 5000 ? 'block-rotation' : localMs < 7000 ? 'whiteout-block' : 'block-landing'; pose.reach = localMs < 5000 ? .5 : 1; }
    if (id === STOOPY_ID) pose.id = localMs < 6500 ? 'crash-read' : 'offensive-board-track';
    return pose;
  }

  function blockActors(localMs) {
    var owner = localMs < 5000 ? MARNIE_ID : null;
    return buildActors({
      localMs: localMs, durationMs: 12000, formationOffenseTeamId: HOME_TEAM_ID, direction: 1,
      currentOffenseTeamId: HOME_TEAM_ID, currentDirection: 1, paths: BLOCK_PATHS, ownerId: owner, poseFor: blockPose,
      stateFor: function (id, time) { return { contesting: id === TOQUE_ID && time >= 3500 && time < 7000, recovering: id === TOQUE_ID && time >= 7000 && time < 8500 }; }
    });
  }

  var BLOCK_CAROM_END = vec(34, 3, 4);
  function blockBall(localMs, actors) {
    var marnie = actorById(actors, MARNIE_ID);
    if (localMs < 5000) return ball(marnie.anchors.rightHand, 'controlled', MARNIE_ID, 'rightHand', { type: 'hand', actorId: MARNIE_ID, anchor: 'rightHand' });
    var release = actorById(blockActors(5000), MARNIE_ID).anchors.rightHand;
    var blockPoint = actorById(blockActors(6500), TOQUE_ID).anchors.rightHand;
    if (localMs < 6500) return ball(flight(release, blockPoint, progress(localMs, 5000, 6500), 2.6), 'shot-flight', null, null, { type: 'none', actorId: null, anchor: null });
    if (localMs < 6700) return ball(mixVec(blockPoint, BLOCK_CAROM_END, ease(progress(localMs, 6500, 12000))), 'blocked', null, null, { type: 'defender-hand', actorId: TOQUE_ID, anchor: 'rightHand' });
    return ball(mixVec(blockPoint, BLOCK_CAROM_END, ease(progress(localMs, 6500, 12000))), 'blocked-carom', null, null, { type: 'none', actorId: null, anchor: null });
  }

  function putbackPose(id, localMs) {
    var pose = basePose('spacing-and-help', localMs, 18500);
    if (id === STOOPY_ID) {
      pose.id = localMs < 2000 ? 'rebound-track' : localMs < 4500 ? 'offensive-rebound-secure' : localMs < 7600 ? 'putback-rise' : localMs < 8500 ? 'putback-finish' : localMs < 9460 ? 'heavy-squared-landing' : 'rebuild-base';
      pose.reach = localMs < 2000 ? mix(.25, .55, ease(progress(localMs, 0, 2000))) : localMs < 4500 ? .55 : localMs < 7600 ? mix(.55, 1, ease(progress(localMs, 4500, 7600))) : mix(1, .2, ease(progress(localMs, 7600, 8500)));
      pose.crouch = round(pulse(localMs, 3000, 4800, 6500));
      pose.compression = round(pulse(localMs, 7800, 8500, 9460));
    }
    if (id === TOQUE_ID) { pose.id = localMs < 6000 ? 'block-recovery' : localMs < 8000 ? 'late-putback-contest' : 'balanced-recovery'; pose.reach = localMs < 6000 ? .3 : pulse(localMs, 5600, 7400, 8500); }
    return pose;
  }

  function putbackActors(localMs) {
    var owner = localMs >= 2000 && localMs < 7600 ? STOOPY_ID : null;
    return buildActors({
      localMs: localMs, durationMs: 18500, formationOffenseTeamId: HOME_TEAM_ID, direction: 1,
      currentOffenseTeamId: HOME_TEAM_ID, currentDirection: 1, paths: PUTBACK_PATHS, ownerId: owner, poseFor: putbackPose,
      stateFor: function (id, time) {
        return {
          contesting: id === TOQUE_ID && time >= 5600 && time < 8000,
          recovering: (id === STOOPY_ID && time >= 8500 && time < 9460) || (id === TOQUE_ID && time >= 8000 && time < 9000),
          secondJumpReady: id !== STOOPY_ID || time < 8500 || time >= 9460
        };
      }
    });
  }

  function putbackBall(localMs, actors) {
    var stoopy = actorById(actors, STOOPY_ID);
    var reboundTarget = midpoint(actorById(putbackActors(2000), STOOPY_ID).anchors.leftHand, actorById(putbackActors(2000), STOOPY_ID).anchors.rightHand);
    if (localMs < 2000) return ball(flight(BLOCK_CAROM_END, reboundTarget, progress(localMs, 0, 2000), 1.2), 'rebound-flight', null, null, { type: 'none', actorId: null, anchor: null });
    if (localMs < 2600) return ball(midpoint(stoopy.anchors.leftHand, stoopy.anchors.rightHand), 'offensive-rebound', STOOPY_ID, 'both', { type: 'two-hand', actorId: STOOPY_ID, anchor: 'bothHands' });
    if (localMs < 7600) return ball(stoopy.anchors.rightHand, localMs < 6000 ? 'putback-gather' : 'putback-control', STOOPY_ID, 'rightHand', { type: 'hand', actorId: STOOPY_ID, anchor: 'rightHand' });
    if (localMs < 7800) return ball(rimDrop(RIGHT_RIM, 1, progress(localMs, 7600, 9000)), 'rim-crossing', null, null, { type: 'rim-plane', actorId: null, anchor: 'rightRim' });
    return ball(rimDrop(RIGHT_RIM, 1, progress(localMs, 7600, 9000)), 'scored', null, null, { type: localMs < 9000 ? 'net' : 'floor', actorId: null, anchor: null });
  }

  function emptyContact(id, atMs) { return { id: id, atMs: atMs, active: false, occurred: false, point: vec(0, 0, 0) }; }
  function customContacts(segment, localMs, actors) {
    var now = segment.startMs + localMs;
    var contacts = {
      screen: emptyContact('none-screen', 0), catch: emptyContact('none-catch', 0),
      rim: { id: 'none-rim', athleteId: null, atMs: 0, active: false, crossed: false, point: segment.attackingRim || vec(0, 0, 0) },
      landing: emptyContact('none-landing', 0)
    };
    if (segment.id === 'segment-03-whiteout-answer') {
      contacts.catch = { id: 'whiteout-catch', passerId: PARKA_ID, receiverId: TOQUE_ID, atMs: 33500, active: now >= 33500 && now < 34000, occurred: now >= 33500, anchor: 'bothHands', point: midpoint(actorById(whiteoutActors(4500), TOQUE_ID).anchors.leftHand, actorById(whiteoutActors(4500), TOQUE_ID).anchors.rightHand) };
      contacts.shot = { id: 'whiteout-release', actorId: TOQUE_ID, releasedAtMs: 34600, released: now >= 34600, point: actorById(whiteoutActors(5600), TOQUE_ID).anchors.rightHand };
      contacts.rim = { id: 'whiteout-left-rim', athleteId: TOQUE_ID, atMs: 36500, active: now >= 36500 && now < 36700, crossed: now >= 36500, point: LEFT_RIM };
      contacts.landing = { id: 'toque-balanced-landing', athleteId: TOQUE_ID, atMs: 37000, active: now >= 36800 && now < 37700, occurred: now >= 37000, point: vec(-30, 1, 0) };
    }
    if (segment.id === 'segment-04-switch-denial') {
      contacts.screen = { id: 'stoopy-switch-screen', screenerId: STOOPY_ID, defenderId: PARKA_ID, atMs: 44500, active: now >= 44500 && now < 45200, occurred: now >= 44500, point: vec(-4.7, -4.6, 1.35) };
      contacts.turnover = { id: 'toque-switch-deflection', actorId: TOQUE_ID, possessionId: 'possession-03-switch-denial', atMs: 48200, certifiedAtMs: 48400, active: now >= 48200 && now < 48400, occurred: now >= 48200, certified: now >= 48400, attackingRim: RIGHT_RIM, point: actorById(switchActors(6200), TOQUE_ID).anchors.rightHand };
    }
    if (segment.id === 'segment-05-toque-block') {
      contacts.shot = { id: 'marnie-rim-attempt', actorId: MARNIE_ID, releasedAtMs: 58500, released: now >= 58500, point: actorById(blockActors(5000), MARNIE_ID).anchors.rightHand };
      contacts.block = { id: 'toque-clean-block', blockerId: TOQUE_ID, shooterId: MARNIE_ID, atMs: 60000, certifiedAtMs: 60200, active: now >= 60000 && now < 60200, occurred: now >= 60000, certified: now >= 60200, point: actorById(blockActors(6500), TOQUE_ID).anchors.rightHand };
    }
    if (segment.id === 'segment-06-stoopy-putback') {
      contacts.rebound = { id: 'stoopy-offensive-board', athleteId: STOOPY_ID, teamId: HOME_TEAM_ID, atMs: 67500, active: now >= 67500 && now < 68100, occurred: now >= 67500, offensive: true, point: midpoint(actorById(putbackActors(2000), STOOPY_ID).anchors.leftHand, actorById(putbackActors(2000), STOOPY_ID).anchors.rightHand) };
      contacts.rim = { id: 'stoopy-putback-rim', athleteId: STOOPY_ID, atMs: 73100, active: now >= 73100 && now < 73300, crossed: now >= 73100, point: RIGHT_RIM };
      contacts.landing = { id: 'stoopy-putback-landing', athleteId: STOOPY_ID, atMs: 74000, active: now >= 73800 && now < 74960, occurred: now >= 74000, point: vec(40.5, .46, 0) };
    }
    return contacts;
  }

  function cameraState(id, desktop, focusPoint, rim, targetIds, cut, transition) {
    var direction = rim && rim.x < 0 ? -1 : 1;
    var compact = { position: vec(focusPoint.x - direction * 12, -48, 29), lookAt: vec(focusPoint.x, focusPoint.y, focusPoint.z), fov: 48 };
    var social = { position: vec(focusPoint.x - direction * 16, -65, 34), lookAt: vec(focusPoint.x, focusPoint.y, focusPoint.z), fov: 50 };
    return {
      id: id, shot: desktop.shot || 'medium', position: desktop.position, lookAt: desktop.lookAt, fov: desktop.fov,
      targetIds: targetIds.slice(), cut: Boolean(cut), transition: transition || (cut ? 'cut' : 'move'),
      desktop: { position: desktop.position, lookAt: desktop.lookAt, fov: desktop.fov },
      compactPortrait: compact, socialPortrait: social,
      focus: { ball: true, rim: Boolean(rim), attackingRim: rim, targetIds: targetIds.slice() }
    };
  }

  function customCamera(segment, localMs, currentBall) {
    var rim = segment.attackingRim || RIGHT_RIM;
    var focusPoint = currentBall && currentBall.visible ? currentBall.position : vec(0, 0, 3);
    var direction = rim.x < 0 ? -1 : 1;
    var distance = segment.kind === 'context' || segment.kind === 'reset' ? 52 : 38;
    var desktop = {
      position: vec(focusPoint.x - direction * 10, -distance, segment.kind === 'context' || segment.kind === 'reset' ? 22 : 16),
      lookAt: vec(focusPoint.x, focusPoint.y, Math.max(3, focusPoint.z)), fov: segment.kind === 'context' || segment.kind === 'reset' ? 44 : 40,
      shot: segment.kind === 'context' || segment.kind === 'reset' ? 'wide' : 'medium'
    };
    return cameraState('director-' + segment.id, desktop, focusPoint, rim, segment.featuredActorIds, localMs === 0 && segment.id !== 'segment-06-stoopy-putback', localMs === 0 ? 'cut' : 'move');
  }

  function cameraFromSource(sourceCamera, currentBall, rim, targetIds, replay) {
    var focusPoint = currentBall.position;
    var desktop = { position: vec(sourceCamera.position.x, sourceCamera.position.y, sourceCamera.position.z), lookAt: vec(sourceCamera.lookAt.x, sourceCamera.lookAt.y, sourceCamera.lookAt.z), fov: sourceCamera.fov || 40, shot: replay ? 'replay-medium' : sourceCamera.shot };
    var camera = cameraState(replay ? 'director-truthful-replay' : 'director-stoop-live', desktop, focusPoint, rim, targetIds, Boolean(sourceCamera.cut), replay ? 'replay' : sourceCamera.transition);
    return camera;
  }

  function outcomeStatus(outcome, now) {
    if (!outcome) return 'none';
    if (now < outcome.contactAtMs) return 'pending';
    if (now < outcome.certifiedAtMs) return 'contacted';
    return 'certified';
  }

  function scoreAt(now, outcome, segment) {
    var home = now >= 73300 ? 22 : now >= 14500 ? 20 : 18;
    var away = now >= 36700 ? 20 : 17;
    var replayed = segment.kind === 'replay';
    var certified = Boolean(outcome && (replayed || now >= outcome.certifiedAtMs));
    return {
      home: { teamId: HOME_TEAM_ID, points: home }, away: { teamId: AWAY_TEAM_ID, points: away },
      playPoints: certified ? outcome.points : 0, certified: certified, certifiedAtMs: certified ? outcome.certifiedAtMs : 0,
      eventId: certified ? outcome.eventId : null, official: false
    };
  }

  function gameClockAt(now, segment) {
    var elapsed = 0;
    for (var index = 0; index < SEGMENTS.length; index += 1) {
      var candidate = SEGMENTS[index];
      if (!candidate.clockRuns) continue;
      if (now >= candidate.endMs) elapsed += candidate.endMs - candidate.startMs;
      else if (candidate.id === segment.id) elapsed += now - candidate.startMs;
    }
    return round(Math.max(0, 98 - elapsed / 1000), 3);
  }

  function possessionAt(now, segment, localMs) {
    var id = segment.possessionId;
    if (segment.kind === 'replay') id = 'possession-01-stoop-drop';
    if (segment.id === 'segment-04-switch-denial' && now >= 48400) id = 'possession-03b-toronto-transition';
    if (!id) return { id: null, sequence: 0, status: 'none', offenseTeamId: null, defenseTeamId: null, attackingRim: null, shotClockReset: null };
    var source = POSSESSION_BY_ID[id];
    var shotClock = 24;
    var reset = null;
    if (id === 'possession-01-stoop-drop') shotClock = segment.kind === 'replay' ? 9 : Math.max(0, 24 - localMs / 1000);
    if (id === 'possession-02-whiteout-answer') shotClock = Math.max(0, 24 - localMs / 1000);
    if (id === 'possession-03-switch-denial') shotClock = Math.max(0, 24 - localMs / 1000);
    if (id === 'possession-03b-toronto-transition') { shotClock = Math.max(0, 24 - (now - 48400) / 1000); reset = { atMs: 48400, toSeconds: 24, reason: 'live-ball-turnover' }; }
    if (id === 'possession-04-second-chance') {
      if (now < 67500) shotClock = Math.max(0, 24 - (now - 53500) / 1000);
      else { shotClock = Math.max(0, 14 - (now - 67500) / 1000); reset = { atMs: 67500, toSeconds: 14, reason: 'offensive-rebound' }; }
    }
    return {
      id: source.id, sequence: source.sequence, status: segment.kind === 'replay' ? 'replay' : now >= source.endMs ? 'ended' : 'live',
      offenseTeamId: source.offenseTeamId, defenseTeamId: source.defenseTeamId, attackingRim: source.attackingRim,
      shotClockReset: reset, shotClockSeconds: round(shotClock, 3)
    };
  }

  function presentationFor(segment, now, outcome, replaySourceTime) {
    var rimEvent = outcome && outcome.points > 0;
    var eventTime = segment.kind === 'replay' ? replaySourceTime + 6000 : now;
    var contactAt = outcome ? outcome.contactAtMs : 0;
    var certifiedAt = outcome ? outcome.certifiedAtMs : 0;
    var rimResponse = rimEvent ? pulse(eventTime, contactAt, contactAt + 160, contactAt + 900) : 0;
    var netResponse = rimEvent ? pulse(eventTime, contactAt, contactAt + 260, contactAt + 1100) : 0;
    var crowdStart = contactAt + 150;
    var crowdReaction = outcome ? pulse(eventTime, crowdStart, crowdStart + 700, Math.min(segment.endMs, crowdStart + 4200)) : 0;
    var lowerStart = certifiedAt ? certifiedAt + 1600 : segment.endMs;
    if (segment.id === 'segment-06-stoopy-putback') lowerStart = 77500;
    var lowerEnd = Math.max(lowerStart, segment.endMs - 500);
    var lowerVisible = now >= lowerStart && now < lowerEnd;
    var lowerOpacity = lowerVisible ? Math.min(ease(progress(now, lowerStart, lowerStart + 280)), 1 - ease(progress(now, lowerEnd - 250, lowerEnd))) : 0;
    var rim = outcome ? outcome.attackingRim : segment.attackingRim;
    return {
      rimResponse: round(rimResponse), netResponse: round(netResponse), crowdReaction: round(crowdReaction),
      reactionOriginX: rim ? round((rim.x + 50) / 100) : .5,
      lowerThird: {
        visible: lowerVisible, opacity: round(lowerOpacity), kicker: outcome ? 'CERTIFIED OUTCOME' : 'MATCHUP CONTEXT',
        title: segment.headline.title, subtitle: outcome ? outcome.eventId : segment.headline.deck,
        detail: outcome ? outcome.type : segment.stakes.label, official: false
      },
      replay: { active: segment.kind === 'replay', label: segment.kind === 'replay' ? 'REPLAY · RECORDED PLAY' : '', truthful: segment.kind === 'replay' },
      blackout: segment.kind === 'reset' ? round(progress(now, 84000, 90000)) : 0
    };
  }

  function consequenceFor(segment, now, outcome) {
    if (segment.id === 'segment-01-stoop-drop-live') {
      return {
        id: 'stoopy-late-second-jump', athleteId: STOOPY_ID, cause: 'heavy-squared-landing', active: now >= 15100 && now < 17600,
        baselineReadyAtMs: 15600, actualReadyAtMs: 16060, delayedByMs: 460,
        secondJumpRequested: now >= 15600 && now < 16060, secondJumpReady: now < 15100 || now >= 16060, toqueRecovered: now >= 15600
      };
    }
    if (segment.id === 'segment-06-stoopy-putback') {
      return {
        id: 'stoopy-putback-late-second-jump', athleteId: STOOPY_ID, cause: 'heavy-squared-landing', active: now >= 74000 && now < 77500,
        baselineReadyAtMs: 74500, actualReadyAtMs: 74960, delayedByMs: 460,
        secondJumpRequested: now >= 74500 && now < 74960, secondJumpReady: now < 74000 || now >= 74960, toqueRecovered: now >= 74500
      };
    }
    return {
      id: outcome ? outcome.id + '-consequence' : 'none', athleteId: outcome ? outcome.actorId : null,
      cause: outcome ? outcome.type : 'none', active: Boolean(outcome && now >= outcome.certifiedAtMs && now < segment.endMs),
      baselineReadyAtMs: 0, actualReadyAtMs: 0, delayedByMs: 0, secondJumpRequested: false, secondJumpReady: true, toqueRecovered: true
    };
  }

  function impactFor(outcome, now) {
    if (!outcome) return { id: 'none', active: false, intensity: 0, actorIds: [] };
    return {
      id: outcome.id, active: now >= outcome.contactAtMs && now < outcome.certifiedAtMs + 500,
      intensity: round(pulse(now, outcome.contactAtMs - 120, outcome.contactAtMs, outcome.certifiedAtMs + 500)),
      actorIds: [outcome.actorId]
    };
  }

  function featuredActors(segment) {
    return segment.featuredActorIds.map(function (id) {
      var actor = ACTOR_BY_ID[id];
      return { id: actor.id, name: actor.name, teamId: actor.teamId, role: actor.role };
    });
  }

  function audioFor(segment, now) {
    var segmentCueIds = AUDIO_CUES.filter(function (cue) { return cue.atMs >= segment.startMs && cue.atMs < segment.endMs; }).map(function (cue) { return cue.id; });
    var activeCueIds = AUDIO_CUES.filter(function (cue) { return now >= cue.atMs && now < cue.atMs + 120; }).map(function (cue) { return cue.id; });
    var next = null;
    for (var index = 0; index < AUDIO_CUES.length; index += 1) if (AUDIO_CUES[index].atMs > now) { next = AUDIO_CUES[index]; break; }
    return { activeCueIds: activeCueIds, segmentCueIds: segmentCueIds, nextCue: next ? { id: next.id, atMs: next.atMs } : null };
  }

  function adaptSourceContacts(contacts, offset) {
    var output = {};
    Object.keys(contacts).forEach(function (key) {
      var source = contacts[key];
      output[key] = {};
      Object.keys(source).forEach(function (field) { output[key][field] = source[field]; });
      if (Number.isFinite(source.atMs)) output[key].atMs = source.atMs + offset;
    });
    return output;
  }

  function segmentAt(now) {
    for (var index = 0; index < SEGMENTS.length; index += 1) if (now >= SEGMENTS[index].startMs && now < SEGMENTS[index].endMs) return SEGMENTS[index];
    return SEGMENTS[0];
  }

  function replaySourceAt(now) { return round(4800 + (now - 21000) * .5375, 3); }

  function customPhase(segment, localMs, id) {
    return { id: id, index: segment.index, startMs: segment.startMs, endMs: segment.endMs, progress: round(progress(localMs, 0, segment.endMs - segment.startMs)) };
  }

  function baseBroadcastState(segment, now, localMs, outcome, replaySourceTime) {
    var possession = possessionAt(now, segment, localMs);
    var status = segment.kind === 'replay' ? 'replayed' : outcomeStatus(outcome, now);
    return {
      segment: { id: segment.id, index: segment.index, kind: segment.kind, startMs: segment.startMs, endMs: segment.endMs, progress: round(progress(now, segment.startMs, segment.endMs)) },
      possession: possession, attackingRim: possession.attackingRim,
      clock: { gameClockSeconds: gameClockAt(now, segment), shotClockSeconds: possession.shotClockSeconds == null ? 24 : possession.shotClockSeconds, running: segment.clockRuns && segment.kind === 'live' },
      outcome: outcome ? {
        id: outcome.id, sequence: outcome.sequence, type: outcome.type, possessionId: outcome.possessionId, teamId: outcome.teamId, actorId: outcome.actorId,
        points: outcome.points, contactAtMs: outcome.contactAtMs, certifiedAtMs: outcome.certifiedAtMs, eventId: outcome.eventId, status: status
      } : { id: null, sequence: 0, type: null, possessionId: null, teamId: null, actorId: null, points: 0, contactAtMs: 0, certifiedAtMs: 0, eventId: null, status: 'none' },
      replay: {
        active: segment.kind === 'replay', sourceSegmentId: segment.kind === 'replay' ? 'segment-01-stoop-drop-live' : null,
        sourceEventId: segment.kind === 'replay' ? 'visual-reset-stoop-drop-001' : null,
        sourceStartMs: segment.kind === 'replay' ? 4800 : 0, sourceTimeMs: segment.kind === 'replay' ? replaySourceTime : 0,
        playbackRate: segment.kind === 'replay' ? .5375 : 1, recordedFootage: segment.kind === 'replay', truthful: segment.kind === 'replay'
      },
      headline: segment.headline, stakes: segment.stakes, featuredActors: featuredActors(segment), audio: audioFor(segment, now),
      autonomous: true, interaction: 'view-only'
    };
  }

  function normalizeTime(value) {
    var input = Number(value);
    if (!Number.isFinite(input)) return { timeMs: 0, loop: 0 };
    var loop = Math.floor(input / DURATION_MS);
    var timeMs = ((input % DURATION_MS) + DURATION_MS) % DURATION_MS;
    timeMs = round(timeMs, 3);
    if (timeMs >= DURATION_MS) { timeMs = 0; loop += 1; }
    return { timeMs: timeMs, loop: loop };
  }

  function sample(value) {
    var normalized = normalizeTime(value);
    var now = normalized.timeMs;
    var segment = segmentAt(now);
    var localMs = now - segment.startMs;
    var outcome = segment.outcomeId ? OUTCOME_BY_ID[segment.outcomeId] : null;
    var actors;
    var currentBall;
    var camera;
    var contacts;
    var phase;
    var replaySourceTime = 0;

    if (segment.id === 'segment-01-stoop-drop-live') {
      var source = Timeline.sample(localMs);
      actors = source.actors;
      currentBall = source.ball;
      camera = cameraFromSource(source.camera, currentBall, RIGHT_RIM, segment.featuredActorIds, false);
      contacts = adaptSourceContacts(source.contacts, 6000);
      phase = { id: 'stoop-drop-' + source.phase.id, index: segment.index, startMs: segment.startMs + source.phase.startMs, endMs: segment.startMs + source.phase.endMs, progress: source.phase.progress };
    } else if (segment.id === 'segment-02-stoop-drop-replay') {
      replaySourceTime = replaySourceAt(now);
      var replaySource = Timeline.sample(replaySourceTime);
      actors = replaySource.actors;
      currentBall = replaySource.ball;
      camera = cameraFromSource(replaySource.camera, currentBall, RIGHT_RIM, segment.featuredActorIds, true);
      contacts = adaptSourceContacts(replaySource.contacts, 6000);
      phase = customPhase(segment, localMs, 'truthful-replay-' + replaySource.phase.id);
    } else if (segment.id === 'segment-03-whiteout-answer') {
      actors = whiteoutActors(localMs); currentBall = whiteoutBall(localMs, actors); camera = customCamera(segment, localMs, currentBall); contacts = customContacts(segment, localMs, actors);
      phase = customPhase(segment, localMs, localMs < 3500 ? 'whiteout-build' : localMs < 4500 ? 'whiteout-pass' : localMs < 5600 ? 'whiteout-catch' : localMs < 7500 ? 'whiteout-shot' : localMs < 7700 ? 'left-rim-crossing' : 'whiteout-consequence');
    } else if (segment.id === 'segment-04-switch-denial') {
      actors = switchActors(localMs); currentBall = switchBall(localMs, actors); camera = customCamera(segment, localMs, currentBall); contacts = customContacts(segment, localMs, actors);
      phase = customPhase(segment, localMs, localMs < 2500 ? 'switch-setup' : localMs < 5000 ? 'switch-read' : localMs < 6200 ? 'denied-pass' : localMs < 6400 ? 'live-deflection' : 'toronto-transition');
    } else if (segment.id === 'segment-05-toque-block') {
      actors = blockActors(localMs); currentBall = blockBall(localMs, actors); camera = customCamera(segment, localMs, currentBall); contacts = customContacts(segment, localMs, actors);
      phase = customPhase(segment, localMs, localMs < 5000 ? 'block-build' : localMs < 6500 ? 'shot-flight' : localMs < 6700 ? 'block-contact' : 'live-carom');
    } else if (segment.id === 'segment-06-stoopy-putback') {
      actors = putbackActors(localMs); currentBall = putbackBall(localMs, actors); camera = customCamera(segment, localMs, currentBall); contacts = customContacts(segment, localMs, actors);
      phase = customPhase(segment, localMs, localMs < 2000 ? 'offensive-rebound-flight' : localMs < 6000 ? 'second-chance-gather' : localMs < 7600 ? 'putback-rise' : localMs < 7800 ? 'putback-rim-crossing' : localMs < 8500 ? 'putback-score' : 'final-consequence');
    } else {
      var isReset = segment.kind === 'reset';
      var contextFormation = formation(HOME_TEAM_ID, 1);
      actors = buildActors({ localMs: localMs, durationMs: segment.endMs - segment.startMs, formationOffenseTeamId: HOME_TEAM_ID, direction: 1, currentOffenseTeamId: HOME_TEAM_ID, currentDirection: 1, paths: null, ownerId: null, poseFor: function () { return basePose(isReset ? 'reset-context' : 'cold-open-ready', localMs, segment.endMs - segment.startMs); } });
      currentBall = ball(vec(0, 0, .24), isReset ? 'reset-hidden' : 'context-held', null, null, { type: 'none', actorId: null, anchor: null }, false);
      camera = customCamera(segment, localMs, currentBall); contacts = customContacts(segment, localMs, actors);
      phase = customPhase(segment, localMs, isReset ? 'broadcast-reset' : 'cold-open-context');
      void contextFormation;
    }

    var broadcast = baseBroadcastState(segment, now, localMs, outcome, replaySourceTime);
    var presentation = presentationFor(segment, now, outcome, replaySourceTime);
    var score = scoreAt(now, outcome, segment);
    var eventNow = segment.kind === 'replay' ? replaySourceTime + 6000 : now;
    var consequenceSegment = segment.kind === 'replay' ? SEGMENTS[1] : segment;
    var state = {
      version: VERSION, sourceTimelineVersion: Timeline.version, timeMs: now, loop: normalized.loop, durationMs: DURATION_MS,
      coordinateSystem: { origin: 'center-court', units: 'court-feet', axes: Timeline.coordinateSystem.axes, rims: { right: RIGHT_RIM, left: LEFT_RIM } },
      phase: phase, actors: actors, ball: currentBall, camera: camera, score: score, contacts: contacts,
      impact: impactFor(outcome, eventNow), consequence: consequenceFor(consequenceSegment, eventNow, outcome), presentation: presentation, broadcast: broadcast
    };
    return freeze(state);
  }

  return freeze({
    version: VERSION, durationMs: DURATION_MS, sourceTimelineVersion: Timeline.version,
    teamIds: freeze([HOME_TEAM_ID, AWAY_TEAM_ID]), actorIds: ACTOR_IDS,
    rims: freeze({ right: RIGHT_RIM, left: LEFT_RIM }), segments: SEGMENTS, possessions: POSSESSIONS,
    outcomes: OUTCOMES, milestones: MILESTONES, audioCues: AUDIO_CUES, sample: sample
  });
});
