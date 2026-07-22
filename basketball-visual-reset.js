(function (root, factory) {
  'use strict';

  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CyberligaBasketballVisualReset = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '1.0.0';
  var DURATION_MS = 15000;
  var TAU = Math.PI * 2;
  var HOME_TEAM_ID = 'new-york-brownstones';
  var AWAY_TEAM_ID = 'toronto-lake-effect';
  var STOOPY_ID = 'new-york-brownstones-a1';
  var LINTEL_ID = 'new-york-brownstones-a2';
  var PARKA_ID = 'toronto-lake-effect-a2';
  var TOQUE_ID = 'toronto-lake-effect-a4';

  function deepFreeze(value, seen) {
    if (!value || (typeof value !== 'object' && typeof value !== 'function') || Object.isFrozen(value)) return value;
    seen = seen || [];
    if (seen.indexOf(value) >= 0) return value;
    seen.push(value);
    Object.keys(value).forEach(function (key) { deepFreeze(value[key], seen); });
    return Object.freeze(value);
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function round(value, places) {
    var factor = Math.pow(10, places == null ? 4 : places);
    var result = Math.round(Number(value) * factor) / factor;
    return Object.is(result, -0) ? 0 : result;
  }

  function ease(value) {
    value = clamp(value, 0, 1);
    return value * value * (3 - 2 * value);
  }

  function progress(timeMs, startMs, endMs) {
    if (endMs <= startMs) return timeMs >= endMs ? 1 : 0;
    return clamp((timeMs - startMs) / (endMs - startMs), 0, 1);
  }

  function pulse(timeMs, startMs, peakMs, endMs) {
    if (timeMs <= startMs || timeMs >= endMs) return 0;
    if (timeMs <= peakMs) return ease(progress(timeMs, startMs, peakMs));
    return 1 - ease(progress(timeMs, peakMs, endMs));
  }

  function mix(from, to, amount) {
    return from + (to - from) * amount;
  }

  function vec(x, y, z) {
    return { x: round(x), y: round(y), z: round(z) };
  }

  function mixVec(from, to, amount) {
    return vec(
      mix(from.x, to.x, amount),
      mix(from.y, to.y, amount),
      mix(from.z, to.z, amount)
    );
  }

  var MILESTONES = deepFreeze({
    firstDribbleFloorMs: 300,
    firstDribbleHandMs: 600,
    secondDribbleFloorMs: 900,
    secondDribbleHandMs: 1200,
    setupEndMs: 1200,
    screenContactMs: 3000,
    screenReleaseMs: 3800,
    passReleaseMs: 5000,
    pocketCatchMs: 6100,
    gatherStartMs: 6500,
    rightHandGatherMs: 6750,
    takeoffMs: 7200,
    rimApproachMs: 8200,
    rimCrossingMs: 8350,
    scoreCertifiedMs: 8500,
    crowdFirstReactionMs: 8500,
    landingMs: 9100,
    baselineSecondJumpReadyMs: 9600,
    stoopySecondJumpReadyMs: 10060,
    lateRecoveryCostMs: 460,
    consequenceEndMs: 11600,
    lowerThirdMs: 12600,
    lowerThirdClearMs: 14400,
    resetCutMs: 14500,
    loopEndMs: DURATION_MS
  });

  var RIM = deepFreeze(vec(42, 0, 10));
  var COORDINATE_SYSTEM = deepFreeze({
    origin: 'center-court',
    units: 'court-feet',
    axes: {
      x: 'court length; positive points toward the Toronto basket',
      y: 'court width; positive points toward broadcast left',
      z: 'height above the floor'
    },
    floorZ: 0,
    attackingRim: RIM
  });

  var ACTOR_ROWS = [
    [STOOPY_ID, 'Stoopy', HOME_TEAM_ID, 'offense', 'CENTER'],
    [LINTEL_ID, 'Lintel', HOME_TEAM_ID, 'offense', 'POINT'],
    ['new-york-brownstones-a3', 'Rook Moss', HOME_TEAM_ID, 'offense', 'WING'],
    ['new-york-brownstones-a4', 'Marnie', HOME_TEAM_ID, 'offense', 'SHOOTER'],
    ['new-york-brownstones-a5', 'Brownie', HOME_TEAM_ID, 'offense', 'FORWARD'],
    ['toronto-lake-effect-a1', 'Flurry', AWAY_TEAM_ID, 'defense', 'CENTER'],
    [PARKA_ID, 'Parka', AWAY_TEAM_ID, 'defense', 'POINT'],
    ['toronto-lake-effect-a3', 'Melt', AWAY_TEAM_ID, 'defense', 'WING'],
    [TOQUE_ID, 'Toque', AWAY_TEAM_ID, 'defense', 'SHOOTER'],
    ['toronto-lake-effect-a5', 'Skate Lace', AWAY_TEAM_ID, 'defense', 'FORWARD']
  ];

  var ACTORS = deepFreeze(ACTOR_ROWS.map(function (row) {
    return { id: row[0], name: row[1], teamId: row[2], side: row[3], role: row[4] };
  }));
  var ACTOR_IDS = deepFreeze(ACTORS.map(function (actor) { return actor.id; }));

  var PHASES = deepFreeze([
    { id: 'setup', startMs: 0, endMs: 1200 },
    { id: 'screen-approach', startMs: 1200, endMs: 3000 },
    { id: 'screen-contact', startMs: 3000, endMs: 3800 },
    { id: 'turn-corner', startMs: 3800, endMs: 5000 },
    { id: 'pocket-pass', startMs: 5000, endMs: 6100 },
    { id: 'catch', startMs: 6100, endMs: 6500 },
    { id: 'gather', startMs: 6500, endMs: 7200 },
    { id: 'rise', startMs: 7200, endMs: 8200 },
    { id: 'rim-crossing', startMs: 8200, endMs: 8500 },
    { id: 'score-certified', startMs: 8500, endMs: 9000 },
    { id: 'landing', startMs: 9000, endMs: 9800 },
    { id: 'slow-recovery', startMs: 9800, endMs: 11600 },
    { id: 'consequence', startMs: 11600, endMs: 12600 },
    { id: 'lower-third', startMs: 12600, endMs: 14500 },
    { id: 'reset-cut', startMs: 14500, endMs: 15000 }
  ].map(function (phase, index) {
    return { id: phase.id, index: index, startMs: phase.startMs, endMs: phase.endMs };
  }));

  var CAMERA_BEATS = deepFreeze([
    {
      id: 'tactical-master', startMs: 0, endMs: 4800, shot: 'wide',
      position: vec(3, -48, 18), lookAt: vec(9, 0, 3), fov: 42,
      targetIds: [LINTEL_ID, STOOPY_ID, PARKA_ID], transition: 'cut'
    },
    {
      id: 'motivated-tightening', startMs: 4800, endMs: 9800, shot: 'low-medium',
      fromPosition: vec(3, -48, 18), fromLookAt: vec(9, 0, 3), fromFov: 42,
      position: vec(27, -31, 13), lookAt: vec(39.5, .5, 3.2), fov: 42,
      moveEndMs: 9100,
      waypoints: [
        { timeMs: 4800, position: vec(3, -48, 18), lookAt: vec(9, 0, 3), fov: 42 },
        { timeMs: 6100, position: vec(15, -37, 15), lookAt: vec(23, 0, 4.5), fov: 39 },
        { timeMs: 8200, position: vec(31, -19, 5.8), lookAt: vec(39, 0, 7.2), fov: 37 },
        { timeMs: 8500, position: vec(31, -19, 5.8), lookAt: vec(39, 0, 7.2), fov: 37 },
        { timeMs: 8800, position: vec(29, -24, 8.5), lookAt: vec(39.5, .3, 5.4), fov: 39 },
        { timeMs: 9100, position: vec(27, -31, 13), lookAt: vec(39.5, .5, 3.2), fov: 42 }
      ],
      targetIds: [LINTEL_ID, STOOPY_ID, TOQUE_ID], transition: 'move'
    },
    {
      id: 'consequence-reframe', startMs: 9800, endMs: 14500, shot: 'medium',
      position: vec(31, -25, 11.5), lookAt: vec(39, .7, 2.2), fov: 37,
      targetIds: [STOOPY_ID, TOQUE_ID], transition: 'cut'
    },
    {
      id: 'reset-master', startMs: 14500, endMs: 15000, shot: 'wide',
      position: vec(3, -48, 18), lookAt: vec(9, 0, 3), fov: 42,
      targetIds: [LINTEL_ID, STOOPY_ID, PARKA_ID], transition: 'cut'
    }
  ]);

  function frames(rows) {
    return rows.map(function (row) { return { timeMs: row[0], x: row[1], y: row[2], z: row[3] || 0 }; });
  }

  var PATHS = deepFreeze({
    'new-york-brownstones-a1': frames([
      [0, -15, 1], [1200, -12, -2], [3000, -5, -4.5], [3800, -5, -4.5],
      [5000, 5, -2], [6100, 20, .46], [6500, 25, .46], [7200, 31, .46],
      [8200, 38.2, .46, 3.2], [8350, 40.1, .46, 4.5], [8500, 40.5, .46, 4],
      [8800, 40.8, .46, 2], [9100, 40.5, .46], [9800, 39.8, .8],
      [10060, 39.4, 1], [11600, 37, 1.5], [14500, 36, 1.5], [15000, -15, 1]
    ]),
    'new-york-brownstones-a2': frames([
      [0, -26, -8], [1200, -22, -8], [3000, -10, -6], [3800, -2, -4],
      [5000, 12, -2], [6100, 15, -4], [7200, 18, -6], [9100, 21, -7],
      [12600, 17, -8], [14500, 12, -8], [15000, -26, -8]
    ]),
    'new-york-brownstones-a3': frames([
      [0, -4, 13], [3000, 3, 15], [5000, 13, 16], [7200, 21, 15],
      [9100, 27, 14], [12600, 24, 13], [14500, 16, 12], [15000, -4, 13]
    ]),
    'new-york-brownstones-a4': frames([
      [0, -2, -15], [3000, 5, -16], [5000, 15, -15], [7200, 24, -14],
      [9100, 29, -13], [12600, 26, -14], [14500, 18, -14], [15000, -2, -15]
    ]),
    'new-york-brownstones-a5': frames([
      [0, -10, 7], [3000, -2, 8], [5000, 8, 10], [7200, 20, 9],
      [9100, 30, 8], [12600, 27, 9], [14500, 18, 8], [15000, -10, 7]
    ]),
    'toronto-lake-effect-a1': frames([
      [0, 34, -2], [3000, 34, -2], [5000, 33, -1.5], [6100, 33.5, -2.5],
      [7200, 34, -4], [8350, 35, -5.5], [9100, 35.5, -5],
      [12600, 35, -2], [14500, 34, -2], [15000, 34, -2]
    ]),
    'toronto-lake-effect-a2': frames([
      [0, -21, -7], [1200, -18, -7], [3000, -4.4, -4.7], [3100, -4.4, -4.7], [3200, -4.35, -4.8],
      [3400, -4.25, -5], [3800, -3.8, -6.4], [5000, 1.5, -4.8], [6100, 9, -3.6],
      [7200, 17, -3], [9100, 27, -3], [12600, 25, -4], [14500, 16, -5], [15000, -21, -7]
    ]),
    'toronto-lake-effect-a3': frames([
      [0, -1, 11], [3000, 4, 13], [5000, 12, 13], [7200, 22, 12],
      [9100, 29, 11], [12600, 27, 12], [14500, 18, 11], [15000, -1, 11]
    ]),
    'toronto-lake-effect-a4': frames([
      [0, 14, 10], [3000, 16, 9], [3800, 17, 8], [5000, 23, 5],
      [6100, 28, 2.5], [7200, 33, 1.7], [8200, 36.2, 1.2, 3],
      [8350, 37.5, 1.1, 3.8], [8500, 37.8, 1.1, 3.5], [9100, 38, 1.2],
      [9600, 37.5, 1.5], [12600, 34, 3], [14500, 25, 6], [15000, 14, 10]
    ]),
    'toronto-lake-effect-a5': frames([
      [0, 3, -12], [3000, 7, -13], [5000, 15, -12], [7200, 24, -10],
      [9100, 31, -9], [12600, 28, -10], [14500, 19, -11], [15000, 3, -12]
    ])
  });

  function positionAt(path, timeMs) {
    if (timeMs <= path[0].timeMs) return vec(path[0].x, path[0].y, path[0].z);
    for (var index = 1; index < path.length; index += 1) {
      var next = path[index];
      if (timeMs <= next.timeMs) {
        var previous = path[index - 1];
        var amount = ease(progress(timeMs, previous.timeMs, next.timeMs));
        return vec(
          mix(previous.x, next.x, amount),
          mix(previous.y, next.y, amount),
          mix(previous.z, next.z, amount)
        );
      }
    }
    var last = path[path.length - 1];
    return vec(last.x, last.y, last.z);
  }

  function phaseAt(timeMs) {
    for (var index = 0; index < PHASES.length; index += 1) {
      if (timeMs >= PHASES[index].startMs && timeMs < PHASES[index].endMs) return PHASES[index];
    }
    return PHASES[0];
  }

  function cameraAt(timeMs) {
    var beat = CAMERA_BEATS[CAMERA_BEATS.length - 1];
    for (var index = 0; index < CAMERA_BEATS.length; index += 1) {
      if (timeMs >= CAMERA_BEATS[index].startMs && timeMs < CAMERA_BEATS[index].endMs) {
        beat = CAMERA_BEATS[index];
        break;
      }
    }
    var position = beat.position;
    var lookAt = beat.lookAt;
    var fov = beat.fov;
    if (beat.transition === 'move') {
      var waypoints = beat.waypoints;
      var waypointFrom = waypoints[0];
      var waypointTo = waypoints[waypoints.length - 1];
      for (var waypointIndex = 1; waypointIndex < waypoints.length; waypointIndex += 1) {
        if (timeMs <= waypoints[waypointIndex].timeMs) {
          waypointFrom = waypoints[waypointIndex - 1];
          waypointTo = waypoints[waypointIndex];
          break;
        }
      }
      var waypointProgress = ease(progress(timeMs, waypointFrom.timeMs, waypointTo.timeMs));
      position = mixVec(waypointFrom.position, waypointTo.position, waypointProgress);
      lookAt = mixVec(waypointFrom.lookAt, waypointTo.lookAt, waypointProgress);
      fov = mix(waypointFrom.fov, waypointTo.fov, waypointProgress);
    }
    return {
      id: beat.id,
      shot: beat.shot,
      startMs: beat.startMs,
      endMs: beat.endMs,
      progress: round(progress(timeMs, beat.startMs, beat.endMs)),
      position: vec(position.x, position.y, position.z),
      lookAt: vec(lookAt.x, lookAt.y, lookAt.z),
      fov: round(fov),
      targetIds: beat.targetIds.slice(),
      transition: beat.transition,
      cut: beat.transition === 'cut' && timeMs === beat.startMs
    };
  }

  function poseId(actorId, phaseId) {
    if (actorId === STOOPY_ID) {
      var stoopyPoses = {
        'setup': 'low-post-ready', 'screen-approach': 'three-stair-steps', 'screen-contact': 'architecture-screen',
        'turn-corner': 'screen-release-roll', 'pocket-pass': 'hard-roll', 'catch': 'two-hand-catch',
        'gather': 'squared-gather', 'rise': 'stoop-drop-rise', 'rim-crossing': 'stoop-drop-finish',
        'score-certified': 'rim-hang-release', 'landing': 'heavy-squared-landing', 'slow-recovery': 'late-second-jump',
        'consequence': 'rebuild-base', 'lower-third': 'hero-breath', 'reset-cut': 'reset-hidden'
      };
      return stoopyPoses[phaseId];
    }
    if (actorId === LINTEL_ID) {
      if (phaseId === 'turn-corner') return 'turn-the-corner';
      if (phaseId === 'pocket-pass') return 'pocket-pass-release';
      return phaseId === 'reset-cut' ? 'reset-hidden' : 'ballhandler-read';
    }
    if (actorId === PARKA_ID) {
      if (phaseId === 'screen-contact') return 'screen-collision';
      if (phaseId === 'turn-corner' || phaseId === 'pocket-pass') return 'screen-recovery-chase';
      return phaseId === 'reset-cut' ? 'reset-hidden' : 'point-of-attack-stance';
    }
    if (actorId === TOQUE_ID) {
      if (phaseId === 'pocket-pass' || phaseId === 'catch' || phaseId === 'gather') return 'help-rotation';
      if (phaseId === 'rise' || phaseId === 'rim-crossing') return 'whiteout-contest';
      if (phaseId === 'landing') return 'balanced-recovery';
      return phaseId === 'reset-cut' ? 'reset-hidden' : 'weak-side-read';
    }
    if (phaseId === 'score-certified' || phaseId === 'landing' || phaseId === 'slow-recovery') return 'payoff-reaction';
    return phaseId === 'reset-cut' ? 'reset-hidden' : 'spacing-and-help';
  }

  function stoopyReach(timeMs) {
    if (timeMs < 5000) return .18;
    if (timeMs < 6100) return mix(.18, .56, ease(progress(timeMs, 5000, 6100)));
    if (timeMs < 6500) return mix(.56, .42, ease(progress(timeMs, 6100, 6500)));
    if (timeMs < 7200) return mix(.42, .26, ease(progress(timeMs, 6500, 7200)));
    if (timeMs < 8350) return mix(.26, 1, ease(progress(timeMs, 7200, 8350)));
    if (timeMs < 9000) return mix(1, .4, ease(progress(timeMs, 8350, 9000)));
    return .2;
  }

  function poseFor(actor, timeMs, phase, position) {
    var isStoopy = actor.id === STOOPY_ID;
    var isLintel = actor.id === LINTEL_ID;
    var isParka = actor.id === PARKA_ID;
    var isToque = actor.id === TOQUE_ID;
    var reach = .2;
    if (isStoopy) reach = stoopyReach(timeMs);
    if (isLintel) {
      reach = timeMs < 3800 ? .25 : timeMs < 5000
        ? mix(.25, 1, ease(progress(timeMs, 3800, 5000)))
        : mix(1, .25, ease(progress(timeMs, 5000, 5600)));
    }
    if (isToque) {
      reach = timeMs < 6500 ? .25 : timeMs < 8300
        ? mix(.25, 1, ease(progress(timeMs, 6500, 8300)))
        : mix(1, .25, ease(progress(timeMs, 8300, 9300)));
    }
    var screenPlant = isStoopy
      ? (timeMs < 2800 ? ease(progress(timeMs, 1200, 2800)) : timeMs < 3800 ? 1 : 1 - ease(progress(timeMs, 3800, 4500)))
      : 0;
    var landingCompression = isStoopy ? pulse(timeMs, 8800, 9100, 10060) : 0;
    var gatherCrouch = isStoopy ? pulse(timeMs, 6200, 7050, 7900) : 0;
    var contestCrouch = isToque ? pulse(timeMs, 6100, 7200, 9000) : 0;
    var collisionLean = isParka ? pulse(timeMs, 2850, 3300, 4600) : 0;
    var driveLean = isLintel ? pulse(timeMs, 2500, 4100, 5600) : 0;
    return {
      id: poseId(actor.id, phase.id),
      progress: round(progress(timeMs, phase.startMs, phase.endMs)),
      plant: round(screenPlant),
      jump: round(position.z),
      crouch: round(Math.max(gatherCrouch, contestCrouch)),
      lean: round(Math.max(collisionLean, driveLean, isStoopy ? pulse(timeMs, 3600, 5200, 6500) * .45 : 0)),
      reach: round(reach),
      compression: round(Math.max(landingCompression, isParka ? collisionLean * .58 : 0))
    };
  }

  function anchorsFor(position, facing, pose) {
    var handForward = .7 + pose.reach * 1.2;
    var handHeight = 2.15 + pose.reach * 3.35;
    return {
      leftHand: vec(position.x + facing * (handForward - .12), position.y + .46, position.z + handHeight - .05),
      rightHand: vec(position.x + facing * handForward, position.y - .46, position.z + handHeight),
      head: vec(position.x + facing * .1, position.y, position.z + 3.8 - pose.compression * .45),
      leftFoot: vec(position.x - facing * .28, position.y + .38, Math.max(0, position.z)),
      rightFoot: vec(position.x + facing * .3, position.y - .38, Math.max(0, position.z))
    };
  }

  function actorRuntime(actor, timeMs, phase) {
    var position = positionAt(PATHS[actor.id], timeMs);
    var facing = actor.side === 'offense' ? 1 : -1;
    var pose = poseFor(actor, timeMs, phase, position);
    var anchors = anchorsFor(position, facing, pose);
    var stoopyReady = timeMs < MILESTONES.landingMs || timeMs >= MILESTONES.stoopySecondJumpReadyMs;
    return {
      id: actor.id,
      name: actor.name,
      teamId: actor.teamId,
      side: actor.side,
      role: actor.role,
      position: position,
      facing: facing,
      pose: pose,
      anchors: anchors,
      state: {
        hasBall: (actor.id === LINTEL_ID && timeMs < MILESTONES.passReleaseMs) ||
          (actor.id === STOOPY_ID && timeMs >= MILESTONES.pocketCatchMs && timeMs < MILESTONES.rimCrossingMs),
        screening: actor.id === STOOPY_ID && timeMs >= 2800 && timeMs < 4000,
        screened: actor.id === PARKA_ID && timeMs >= MILESTONES.screenContactMs && timeMs < 4400,
        contesting: actor.id === TOQUE_ID && timeMs >= 6500 && timeMs < 9000,
        airborne: position.z > .01,
        recovering: (actor.id === STOOPY_ID && timeMs >= MILESTONES.landingMs && !stoopyReady) ||
          (actor.id === TOQUE_ID && timeMs >= MILESTONES.landingMs && timeMs < MILESTONES.baselineSecondJumpReadyMs),
        secondJumpReady: actor.id === STOOPY_ID ? stoopyReady : timeMs >= MILESTONES.baselineSecondJumpReadyMs,
        visible: timeMs < MILESTONES.resetCutMs
      }
    };
  }

  function actorById(actors, id) {
    for (var index = 0; index < actors.length; index += 1) if (actors[index].id === id) return actors[index];
    return null;
  }

  function betweenHands(actor) {
    return vec(
      (actor.anchors.leftHand.x + actor.anchors.rightHand.x) / 2,
      (actor.anchors.leftHand.y + actor.anchors.rightHand.y) / 2,
      (actor.anchors.leftHand.z + actor.anchors.rightHand.z) / 2
    );
  }

  function dribbleFloor(actor) {
    return vec(actor.position.x + .68, actor.position.y - .38, .24);
  }

  function dribbleAt(timeMs) {
    var lintelAtStart = actorRuntime(ACTORS[1], 0, phaseAt(0));
    var lintelAtFirstFloor = actorRuntime(ACTORS[1], MILESTONES.firstDribbleFloorMs, phaseAt(MILESTONES.firstDribbleFloorMs));
    var lintelAtFirstHand = actorRuntime(ACTORS[1], MILESTONES.firstDribbleHandMs, phaseAt(MILESTONES.firstDribbleHandMs));
    var lintelAtSecondFloor = actorRuntime(ACTORS[1], MILESTONES.secondDribbleFloorMs, phaseAt(MILESTONES.secondDribbleFloorMs));
    var lintelAtSecondHand = actorRuntime(ACTORS[1], MILESTONES.secondDribbleHandMs, phaseAt(MILESTONES.secondDribbleHandMs));
    var points = [
      lintelAtStart.anchors.rightHand,
      dribbleFloor(lintelAtFirstFloor),
      lintelAtFirstHand.anchors.rightHand,
      dribbleFloor(lintelAtSecondFloor),
      lintelAtSecondHand.anchors.rightHand
    ];
    var times = [0, 300, 600, 900, 1200];
    var segment = Math.min(3, Math.floor(timeMs / 300));
    var amount = ease(progress(timeMs, times[segment], times[segment + 1]));
    var atHand = timeMs === 0 || timeMs === 600 || timeMs === 1200;
    var atFloor = timeMs === 300 || timeMs === 900;
    return {
      state: atHand ? 'dribble-hand' : atFloor ? 'dribble-floor' : segment % 2 === 0 ? 'dribble-down' : 'dribble-up',
      ownerId: LINTEL_ID,
      hand: atHand ? 'rightHand' : null,
      visible: true,
      dribbleIndex: timeMs <= 600 ? 1 : 2,
      position: mixVec(points[segment], points[segment + 1], amount),
      contact: atHand
        ? { type: 'hand', actorId: LINTEL_ID, anchor: 'rightHand' }
        : atFloor
          ? { type: 'floor', actorId: LINTEL_ID, anchor: 'court' }
          : { type: 'none', actorId: LINTEL_ID, anchor: null }
    };
  }

  function ballAfterRim(timeMs) {
    if (timeMs < 9600) {
      var netProgress = ease(progress(timeMs, MILESTONES.rimCrossingMs, 9600));
      return vec(mix(42, 43.8, netProgress), mix(0, -2.2, netProgress), mix(10, 1.2, netProgress));
    }
    if (timeMs < 12600) {
      var bounceProgress = progress(timeMs, 9600, 12600);
      var bounceHeight = Math.abs(Math.sin(bounceProgress * TAU * 1.25)) * 1.35 * (1 - bounceProgress);
      return vec(mix(43.8, 38, ease(bounceProgress)), mix(-2.2, 3, ease(bounceProgress)), .2 + (1 - bounceProgress) + bounceHeight);
    }
    return vec(38, 3, .2);
  }

  function ballAt(timeMs, actors) {
    var lintel = actorById(actors, LINTEL_ID);
    var stoopy = actorById(actors, STOOPY_ID);
    if (timeMs <= MILESTONES.secondDribbleHandMs) return dribbleAt(timeMs);
    if (timeMs < MILESTONES.passReleaseMs) {
      return {
        state: 'controlled', ownerId: LINTEL_ID, hand: 'rightHand', visible: true,
        position: vec(lintel.anchors.rightHand.x, lintel.anchors.rightHand.y, lintel.anchors.rightHand.z),
        contact: { type: 'hand', actorId: LINTEL_ID, anchor: 'rightHand' }
      };
    }
    if (timeMs < MILESTONES.pocketCatchMs) {
      var passPhase = phaseAt(MILESTONES.passReleaseMs);
      var catchPhase = phaseAt(MILESTONES.pocketCatchMs);
      var passActor = actorRuntime(ACTORS[1], MILESTONES.passReleaseMs, passPhase);
      var catchActor = actorRuntime(ACTORS[0], MILESTONES.pocketCatchMs, catchPhase);
      var passProgress = progress(timeMs, MILESTONES.passReleaseMs, MILESTONES.pocketCatchMs);
      var flight = mixVec(passActor.anchors.rightHand, betweenHands(catchActor), ease(passProgress));
      flight.z = round(flight.z + Math.sin(passProgress * Math.PI) * 2.2);
      return {
        state: 'pass-flight', ownerId: null, hand: null, visible: true,
        position: flight,
        contact: { type: 'none', actorId: null, anchor: null }
      };
    }
    if (timeMs < MILESTONES.gatherStartMs) {
      return {
        state: 'caught', ownerId: STOOPY_ID, hand: 'both', visible: true,
        position: betweenHands(stoopy),
        contact: { type: 'two-hand', actorId: STOOPY_ID, anchor: 'bothHands' }
      };
    }
    if (timeMs < MILESTONES.rightHandGatherMs) {
      var yieldProgress = ease(progress(timeMs, MILESTONES.gatherStartMs, MILESTONES.rightHandGatherMs));
      return {
        state: 'gather', ownerId: STOOPY_ID, hand: 'both', visible: true,
        position: mixVec(betweenHands(stoopy), stoopy.anchors.rightHand, yieldProgress),
        contact: { type: 'two-hand-yield', actorId: STOOPY_ID, anchor: 'bothHands' }
      };
    }
    if (timeMs < MILESTONES.rimCrossingMs) {
      return {
        state: timeMs < MILESTONES.takeoffMs ? 'gather' : 'dunk-control', ownerId: STOOPY_ID, hand: 'rightHand', visible: true,
        position: vec(stoopy.anchors.rightHand.x, stoopy.anchors.rightHand.y, stoopy.anchors.rightHand.z),
        contact: { type: 'hand', actorId: STOOPY_ID, anchor: 'rightHand' }
      };
    }
    if (timeMs < MILESTONES.scoreCertifiedMs) {
      return {
        state: 'rim-crossing', ownerId: null, hand: null, visible: true,
        position: ballAfterRim(timeMs),
        contact: { type: 'rim-plane', actorId: null, anchor: 'attackingRim' }
      };
    }
    if (timeMs < MILESTONES.resetCutMs) {
      return {
        state: 'scored', ownerId: null, hand: null, visible: true,
        position: ballAfterRim(timeMs),
        contact: { type: timeMs < 9600 ? 'net' : 'floor', actorId: null, anchor: null }
      };
    }
    var resetProgress = ease(progress(timeMs, MILESTONES.resetCutMs, DURATION_MS));
    var resetTarget = actorRuntime(ACTORS[1], 0, phaseAt(0)).anchors.rightHand;
    return {
      state: 'reset-hidden', ownerId: null, hand: null, visible: false,
      position: mixVec(vec(38, 3, .2), resetTarget, resetProgress),
      contact: { type: 'none', actorId: null, anchor: null }
    };
  }

  function contactsAt(timeMs, actors) {
    var stoopy = actorById(actors, STOOPY_ID);
    var parka = actorById(actors, PARKA_ID);
    var catchStoopy = actorRuntime(ACTORS[0], MILESTONES.pocketCatchMs, phaseAt(MILESTONES.pocketCatchMs));
    var landingStoopy = actorRuntime(ACTORS[0], MILESTONES.landingMs, phaseAt(MILESTONES.landingMs));
    var screenDx = parka.position.x - stoopy.position.x;
    var screenDy = parka.position.y - stoopy.position.y;
    var screenDistance = Math.hypot(screenDx, screenDy);
    var screenerDepthRadius = .375;
    var defenderDepthRadius = .25;
    var minimumScreenDistance = screenerDepthRadius + defenderDepthRadius;
    var screenScale = screenDistance > 0 ? screenerDepthRadius / screenDistance : 0;
    var screenPoint = vec(stoopy.position.x + screenDx * screenScale, stoopy.position.y + screenDy * screenScale, 1.35);
    return {
      screen: {
        id: 'stoopy-parka-screen',
        screenerId: STOOPY_ID,
        defenderId: PARKA_ID,
        atMs: MILESTONES.screenContactMs,
        active: timeMs >= MILESTONES.screenContactMs && timeMs < MILESTONES.screenReleaseMs,
        surfaceContact: timeMs >= MILESTONES.screenContactMs && timeMs <= 3100,
        occurred: timeMs >= MILESTONES.screenContactMs,
        intensity: round(pulse(timeMs, 2850, 3300, 4200)),
        centerDistance: round(screenDistance),
        minimumCenterDistance: minimumScreenDistance,
        colliderDepthRadii: { screener: screenerDepthRadius, defender: defenderDepthRadius },
        surfaceGap: round(Math.max(0, screenDistance - minimumScreenDistance)),
        point: screenPoint
      },
      catch: {
        id: 'lintel-stoopy-pocket-catch',
        passerId: LINTEL_ID,
        receiverId: STOOPY_ID,
        atMs: MILESTONES.pocketCatchMs,
        active: timeMs >= MILESTONES.pocketCatchMs && timeMs < MILESTONES.gatherStartMs,
        occurred: timeMs >= MILESTONES.pocketCatchMs,
        anchor: 'bothHands',
        point: betweenHands(catchStoopy)
      },
      rim: {
        id: 'stoop-drop-rim-crossing',
        athleteId: STOOPY_ID,
        atMs: MILESTONES.rimCrossingMs,
        active: timeMs >= MILESTONES.rimApproachMs && timeMs < MILESTONES.scoreCertifiedMs,
        crossed: timeMs >= MILESTONES.rimCrossingMs,
        point: vec(RIM.x, RIM.y, RIM.z)
      },
      landing: {
        id: 'stoopy-heavy-squared-landing',
        athleteId: STOOPY_ID,
        atMs: MILESTONES.landingMs,
        active: timeMs >= 9000 && timeMs < 9800,
        occurred: timeMs >= MILESTONES.landingMs,
        load: round(pulse(timeMs, 8800, MILESTONES.landingMs, MILESTONES.stoopySecondJumpReadyMs)),
        point: vec(landingStoopy.position.x, landingStoopy.position.y, 0)
      }
    };
  }

  function impactAt(timeMs) {
    var id = 'none';
    var intensity = 0;
    var actorIds = [];
    if (timeMs >= 2850 && timeMs < 4400) {
      id = 'screen-hit';
      intensity = pulse(timeMs, 2850, 3300, 4400);
      actorIds = [STOOPY_ID, PARKA_ID];
    }
    if (timeMs >= 8200 && timeMs < 8800) {
      id = 'rim-finish';
      intensity = pulse(timeMs, 8200, MILESTONES.rimCrossingMs, 8800);
      actorIds = [STOOPY_ID, TOQUE_ID];
    }
    if (timeMs >= 8800 && timeMs < MILESTONES.stoopySecondJumpReadyMs) {
      id = 'heavy-landing';
      intensity = pulse(timeMs, 8800, MILESTONES.landingMs, MILESTONES.stoopySecondJumpReadyMs);
      actorIds = [STOOPY_ID];
    }
    return { id: id, active: id !== 'none', intensity: round(intensity), actorIds: actorIds };
  }

  function presentationAt(timeMs) {
    var lowerThirdVisible = timeMs >= MILESTONES.lowerThirdMs && timeMs < MILESTONES.resetCutMs;
    var lowerThirdProgress = lowerThirdVisible
      ? Math.min(ease(progress(timeMs, MILESTONES.lowerThirdMs, MILESTONES.lowerThirdMs + 280)),
        1 - ease(progress(timeMs, MILESTONES.lowerThirdClearMs - 250, MILESTONES.lowerThirdClearMs)))
      : 0;
    return {
      crowdReaction: round(pulse(timeMs, MILESTONES.crowdFirstReactionMs, 9200, 12600)),
      blackout: round(progress(timeMs, MILESTONES.resetCutMs, DURATION_MS)),
      lowerThird: {
        visible: lowerThirdVisible,
        opacity: round(lowerThirdProgress),
        kicker: 'SIGNATURE PLAY',
        title: 'THE STOOP DROP',
        subtitle: 'STOOPY · NEW YORK BROWNSTONES',
        detail: 'SCREEN → ROLL → CATCH → SQUARED FINISH',
        official: false
      }
    };
  }

  function normalizeTime(value) {
    var input = Number(value);
    if (!Number.isFinite(input)) return { timeMs: 0, loop: 0 };
    var loop = Math.floor(input / DURATION_MS);
    var timeMs = ((input % DURATION_MS) + DURATION_MS) % DURATION_MS;
    timeMs = round(timeMs, 3);
    if (timeMs >= DURATION_MS) {
      timeMs = 0;
      loop += 1;
    }
    return { timeMs: timeMs, loop: loop };
  }

  function sample(value) {
    var normalized = normalizeTime(value);
    var timeMs = normalized.timeMs;
    var phaseDefinition = phaseAt(timeMs);
    var phase = {
      id: phaseDefinition.id,
      index: phaseDefinition.index,
      startMs: phaseDefinition.startMs,
      endMs: phaseDefinition.endMs,
      progress: round(progress(timeMs, phaseDefinition.startMs, phaseDefinition.endMs))
    };
    var actors = ACTORS.map(function (actor) { return actorRuntime(actor, timeMs, phaseDefinition); });
    var scoreCertified = timeMs >= MILESTONES.scoreCertifiedMs;
    var state = {
      version: VERSION,
      timeMs: timeMs,
      loop: normalized.loop,
      durationMs: DURATION_MS,
      phase: phase,
      camera: cameraAt(timeMs),
      actors: actors,
      ball: ballAt(timeMs, actors),
      score: {
        home: { teamId: HOME_TEAM_ID, points: scoreCertified ? 20 : 18 },
        away: { teamId: AWAY_TEAM_ID, points: 17 },
        playPoints: scoreCertified ? 2 : 0,
        certified: scoreCertified,
        certifiedAtMs: MILESTONES.scoreCertifiedMs,
        eventId: 'visual-reset-stoop-drop-001',
        official: false
      },
      contacts: contactsAt(timeMs, actors),
      impact: impactAt(timeMs),
      consequence: {
        id: 'stoopy-late-second-jump',
        athleteId: STOOPY_ID,
        cause: 'heavy-squared-landing',
        active: timeMs >= MILESTONES.landingMs && timeMs < MILESTONES.consequenceEndMs,
        baselineReadyAtMs: MILESTONES.baselineSecondJumpReadyMs,
        actualReadyAtMs: MILESTONES.stoopySecondJumpReadyMs,
        delayedByMs: MILESTONES.lateRecoveryCostMs,
        secondJumpRequested: timeMs >= MILESTONES.baselineSecondJumpReadyMs && timeMs < MILESTONES.stoopySecondJumpReadyMs,
        secondJumpReady: timeMs < MILESTONES.landingMs || timeMs >= MILESTONES.stoopySecondJumpReadyMs,
        toqueRecovered: timeMs >= MILESTONES.baselineSecondJumpReadyMs
      },
      presentation: presentationAt(timeMs)
    };
    return deepFreeze(state);
  }

  var API = {
    version: VERSION,
    durationMs: DURATION_MS,
    coordinateSystem: COORDINATE_SYSTEM,
    actorIds: ACTOR_IDS,
    actors: ACTORS,
    phases: PHASES,
    cameraBeats: CAMERA_BEATS,
    milestones: MILESTONES,
    sample: sample
  };

  return deepFreeze(API);
});
