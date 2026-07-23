(function (root, factory) {
  'use strict';

  if (typeof define === 'function' && define.amd) {
    define([], function () { return factory(root); });
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(typeof globalThis !== 'undefined' ? globalThis : root);
  } else {
    root.CyberligaBasketballBroadcastAudio = factory(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var DEFAULT_SEEK_THRESHOLD_MS = 750;
  var MAX_CUE_GAIN = 0.42;
  var EPSILON_GAIN = 0.0001;
  var hasOwn = Object.prototype.hasOwnProperty;

  var CUE_TYPES = [
    'shoe-squeak',
    'ball-bounce',
    'screen-contact',
    'body-contact',
    'pass',
    'catch',
    'rim',
    'net',
    'whistle',
    'score-stinger',
    'crowd-swell',
    'replay-transition',
    'tension-pulse',
    'horn'
  ];

  var TYPE_PRIORITY = {
    'shoe-squeak': 10,
    'ball-bounce': 20,
    'screen-contact': 30,
    'body-contact': 31,
    'pass': 40,
    'catch': 50,
    'rim': 60,
    'net': 61,
    'whistle': 70,
    'score-stinger': 80,
    'crowd-swell': 90,
    'replay-transition': 100,
    'tension-pulse': 110,
    'horn': 120
  };

  var DEFAULT_GAIN = {
    'shoe-squeak': 0.075,
    'ball-bounce': 0.14,
    'screen-contact': 0.18,
    'body-contact': 0.17,
    'pass': 0.08,
    'catch': 0.11,
    'rim': 0.13,
    'net': 0.075,
    'whistle': 0.09,
    'score-stinger': 0.12,
    'crowd-swell': 0.105,
    'replay-transition': 0.075,
    'tension-pulse': 0.045,
    'horn': 0.14
  };

  var TYPE_ALIASES = {
    'shoe': 'shoe-squeak',
    'shoes': 'shoe-squeak',
    'squeak': 'shoe-squeak',
    'shoe-squeak': 'shoe-squeak',
    'bounce': 'ball-bounce',
    'dribble': 'ball-bounce',
    'ball-bounce': 'ball-bounce',
    'screen': 'screen-contact',
    'screen-hit': 'screen-contact',
    'screen-contact': 'screen-contact',
    'contact': 'body-contact',
    'body': 'body-contact',
    'body-hit': 'body-contact',
    'body-contact': 'body-contact',
    'landing': 'body-contact',
    'pass': 'pass',
    'pass-release': 'pass',
    'catch': 'catch',
    'reception': 'catch',
    'rim': 'rim',
    'rim-hit': 'rim',
    'rim-crossing': 'rim',
    'net': 'net',
    'net-swish': 'net',
    'swish': 'net',
    'whistle': 'whistle',
    'score': 'score-stinger',
    'score-stinger': 'score-stinger',
    'stinger': 'score-stinger',
    'crowd': 'crowd-swell',
    'crowd-swell': 'crowd-swell',
    'replay': 'replay-transition',
    'replay-transition': 'replay-transition',
    'tension': 'tension-pulse',
    'tension-pulse': 'tension-pulse',
    'horn': 'horn',
    'buzzer': 'horn',
    'period-horn': 'horn'
  };

  var SQUEAK_PHASES = {
    'screen-approach': true,
    'turn-corner': true,
    'gather': true,
    'rise': true,
    'landing': true
  };

  function deepFreeze(value, seen) {
    if (!value || (typeof value !== 'object' && typeof value !== 'function') || Object.isFrozen(value)) return value;
    seen = seen || [];
    if (seen.indexOf(value) >= 0) return value;
    seen.push(value);
    Object.keys(value).forEach(function (key) { deepFreeze(value[key], seen); });
    return Object.freeze(value);
  }

  function clamp(value, minimum, maximum) {
    value = Number(value);
    if (!Number.isFinite(value)) return minimum;
    return Math.max(minimum, Math.min(maximum, value));
  }

  function finite(value, fallback) {
    value = Number(value);
    return Number.isFinite(value) ? value : fallback;
  }

  function round(value, places) {
    var factor = Math.pow(10, places == null ? 4 : places);
    var result = Math.round(finite(value, 0) * factor) / factor;
    return Object.is(result, -0) ? 0 : result;
  }

  function safeString(value, fallback) {
    var text = value == null ? '' : String(value);
    text = text.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 160);
    return text || fallback || '';
  }

  function normalizedCueType(raw) {
    if (raw == null) return null;
    raw = String(raw).trim().toLowerCase();
    if (TYPE_ALIASES[raw]) return TYPE_ALIASES[raw];
    if (raw.indexOf('squeak') >= 0 || raw.indexOf('shoe') >= 0) return 'shoe-squeak';
    if (raw.indexOf('bounce') >= 0 || raw.indexOf('dribble') >= 0) return 'ball-bounce';
    if (raw.indexOf('screen') >= 0) return 'screen-contact';
    if (raw.indexOf('body') >= 0 || raw.indexOf('landing') >= 0 || raw.indexOf('contact') >= 0) return 'body-contact';
    if (raw.indexOf('pass') >= 0) return 'pass';
    if (raw.indexOf('catch') >= 0 || raw.indexOf('reception') >= 0) return 'catch';
    if (raw.indexOf('rim') >= 0) return 'rim';
    if (raw.indexOf('net') >= 0 || raw.indexOf('swish') >= 0) return 'net';
    if (raw.indexOf('whistle') >= 0) return 'whistle';
    if (raw.indexOf('score') >= 0 || raw.indexOf('stinger') >= 0) return 'score-stinger';
    if (raw.indexOf('crowd') >= 0) return 'crowd-swell';
    if (raw.indexOf('replay') >= 0) return 'replay-transition';
    if (raw.indexOf('tension') >= 0 || raw.indexOf('pulse') >= 0) return 'tension-pulse';
    if (raw.indexOf('horn') >= 0 || raw.indexOf('buzzer') >= 0) return 'horn';
    return null;
  }

  function descriptorCueType(value) {
    if (!value || typeof value !== 'object') return null;
    var family = safeString(value.family, '').toLowerCase();
    var cause = safeString(value.cause, '').toLowerCase();
    if (family === 'shoe') return 'shoe-squeak';
    if (family === 'body') return cause.indexOf('screen') >= 0 ? 'screen-contact' : 'body-contact';
    if (family === 'crowd') return 'crowd-swell';
    if (family === 'rim') return 'rim';
    if (family === 'ball') {
      if (/(floor|bounce|dribble)/.test(cause)) return 'ball-bounce';
      if (/(pass|release|flight)/.test(cause)) return 'pass';
      if (/(catch|rebound|board|deflection)/.test(cause)) return 'catch';
    }
    return normalizedCueType([family, cause].join('-'));
  }

  function cueTypeOf(value) {
    if (!value) return null;
    if (typeof value === 'string') return normalizedCueType(value);
    var declared = value.cueType || value.audioType || value.kind || value.type;
    return normalizedCueType(declared) || descriptorCueType(value) || normalizedCueType(value.id);
  }

  function pointOf(value) {
    if (!value || typeof value !== 'object') return null;
    var x = finite(value.x, NaN);
    var y = finite(value.y, NaN);
    var z = finite(value.z, NaN);
    if (![x, y, z].every(Number.isFinite)) return null;
    return { x: round(x), y: round(y), z: round(z) };
  }

  function spatialPan(position) {
    if (!position) return 0;
    return round(clamp(-finite(position.y, 0) / 25, -1, 1), 3);
  }

  function recordedFootageOf(cue, source) {
    if (cue && cue.recordedFootage === true) return true;
    return Boolean(
      source &&
      source.broadcast &&
      (
        source.broadcast.recordedFootage === true ||
        source.broadcast.replay && source.broadcast.replay.recordedFootage === true
      )
    );
  }

  function loopIdOf(value, fallback) {
    if (value && hasOwn.call(value, 'loopId')) return safeString(value.loopId, '0');
    if (value && hasOwn.call(value, 'loop')) return safeString(value.loop, '0');
    if (value && value.broadcast && hasOwn.call(value.broadcast, 'loopId')) {
      return safeString(value.broadcast.loopId, '0');
    }
    return safeString(fallback, '0');
  }

  function eventIdOf(raw, type, atMs) {
    var eventId = raw && (
      raw.eventId || raw.audioEventId || raw.momentId || raw.contactId || raw.id
    );
    var actorId = raw && (raw.actorId || raw.athleteId || raw.ownerId);
    var suffix = eventId || [type, round(atMs, 3), safeString(actorId, 'world')].join(':');
    return safeString(suffix, type + ':' + round(atMs, 3));
  }

  function cueFrom(raw, source, defaults) {
    if (typeof raw === 'string') raw = { id: raw, type: cueTypeOf(raw) };
    raw = raw || {};
    defaults = defaults || {};
    var type = defaults.type || cueTypeOf(raw);
    if (!type || TYPE_PRIORITY[type] == null) return null;
    if (type === 'replay-transition' && !recordedFootageOf(raw, source)) return null;

    var atMs = Math.max(0, finite(raw.atMs, finite(defaults.atMs, finite(source && source.timeMs, 0))));
    var position = pointOf(raw.position || raw.point || defaults.position);
    var intensity = clamp(raw.intensity == null ? defaults.intensity == null ? 0.72 : defaults.intensity : raw.intensity, 0, 1);
    var baseGain = DEFAULT_GAIN[type] || 0.08;
    var requestedGain = raw.gain == null ? baseGain * (0.58 + intensity * 0.42) : raw.gain;
    var eventId = eventIdOf(
      Object.assign({}, defaults, raw),
      type,
      atMs
    );
    var loopId = loopIdOf(raw, defaults.loopId || loopIdOf(source, '0'));
    var recordedFootage = type === 'replay-transition' ? true : Boolean(raw.recordedFootage === true);
    var cue = {
      id: ['audio', loopId, type, eventId].join(':'),
      eventId: eventId,
      loopId: loopId,
      type: type,
      atMs: round(atMs, 3),
      delayMs: round(clamp(raw.delayMs == null ? defaults.delayMs || 0 : raw.delayMs, 0, 1000), 3),
      durationMs: round(clamp(raw.durationMs == null ? defaults.durationMs || 0 : raw.durationMs, 0, 3000), 3),
      intensity: round(intensity, 4),
      gain: round(clamp(requestedGain, 0, MAX_CUE_GAIN), 4),
      pan: round(clamp(raw.pan == null ? defaults.pan == null ? spatialPan(position) : defaults.pan : raw.pan, -1, 1), 3),
      position: position,
      actorId: safeString(raw.actorId || raw.athleteId || defaults.actorId, '') || null,
      source: safeString(raw.source || defaults.source, 'director'),
      recordedFootage: recordedFootage
    };
    return deepFreeze(cue);
  }

  function cueListFrom(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.slice();
    return [value];
  }

  function buildCueCatalogue(value) {
    var catalogue = Object.create(null);
    cueListFrom(value).forEach(function (cue) {
      if (!cue || typeof cue !== 'object' || cue.id == null) return;
      catalogue[safeString(cue.id, '')] = cue;
    });
    return catalogue;
  }

  function resolveCueInput(candidate, catalogue) {
    if (typeof candidate !== 'string') return candidate;
    var descriptor = catalogue && catalogue[candidate];
    return descriptor ? Object.assign({}, descriptor, { id: candidate }) : candidate;
  }

  function explicitCueInputs(sample, catalogue) {
    if (!sample || typeof sample !== 'object') return [];
    var result = [];
    [
      sample.cue,
      sample.cues,
      sample.audioCue,
      sample.audioCues,
      sample.audio && sample.audio.cues,
      sample.broadcast && sample.broadcast.audioCues,
      sample.broadcast && sample.broadcast.audio && sample.broadcast.audio.activeCues,
      sample.broadcast && sample.broadcast.audio && sample.broadcast.audio.activeCueIds,
      sample.events
    ].forEach(function (entry) {
      cueListFrom(entry).forEach(function (candidate) {
        candidate = resolveCueInput(candidate, catalogue);
        if (cueTypeOf(candidate)) result.push(candidate);
      });
    });
    return result;
  }

  function sortCues(cues) {
    return cues.slice().sort(function (a, b) {
      if (a.atMs !== b.atMs) return a.atMs - b.atMs;
      if (TYPE_PRIORITY[a.type] !== TYPE_PRIORITY[b.type]) return TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type];
      if (a.eventId < b.eventId) return -1;
      if (a.eventId > b.eventId) return 1;
      return 0;
    });
  }

  function contactType(sample) {
    return safeString(sample && sample.ball && sample.ball.contact && sample.ball.contact.type, '').toLowerCase();
  }

  function ballState(sample) {
    return safeString(sample && sample.ball && sample.ball.state, '').toLowerCase();
  }

  function phaseId(sample) {
    return safeString(sample && sample.phase && sample.phase.id, '').toLowerCase();
  }

  function replayActive(sample) {
    var broadcast = sample && sample.broadcast;
    if (!broadcast) return false;
    var mode = safeString(broadcast.mode || broadcast.state || broadcast.type, '').toLowerCase();
    return (
      broadcast.replay === true ||
      broadcast.replay && broadcast.replay.active === true ||
      mode === 'replay' ||
      mode === 'replay-transition' ||
      mode === 'buffered-replay'
    );
  }

  function whistleActive(sample) {
    return Boolean(
      sample && (
        sample.whistle === true ||
        sample.whistle && sample.whistle.active === true ||
        sample.official && sample.official.whistle === true ||
        sample.broadcast && sample.broadcast.whistle === true
      )
    );
  }

  function hornActive(sample) {
    if (!sample) return false;
    var phase = phaseId(sample);
    return Boolean(
      sample.horn === true ||
      sample.clock && sample.clock.horn === true ||
      phase === 'period-end' ||
      phase === 'quarter-end' ||
      phase === 'fulltime' ||
      phase === 'final' ||
      phase === 'game-over'
    );
  }

  function remainingClockMs(sample) {
    if (!sample) return null;
    var candidates = [
      sample.gameClockMs,
      sample.remainingMs,
      sample.clock && sample.clock.remainingMs,
      sample.clock && sample.clock.gameMs,
      sample.broadcast && sample.broadcast.clock && finite(sample.broadcast.clock.gameClockSeconds, NaN) * 1000
    ];
    for (var index = 0; index < candidates.length; index += 1) {
      var value = Number(candidates[index]);
      if (Number.isFinite(value)) return Math.max(0, value);
    }
    return null;
  }

  function certifiedPositiveScore(sample) {
    if (!sample || !sample.score || sample.score.certified !== true) return false;
    var candidates = [
      sample.score.playPoints,
      sample.broadcast && sample.broadcast.outcome && sample.broadcast.outcome.points
    ];
    for (var index = 0; index < candidates.length; index += 1) {
      if (Number.isFinite(Number(candidates[index]))) return Number(candidates[index]) > 0;
    }
    // Legacy director samples did not expose points; retain their certified-make
    // behavior while modern zero-point outcomes remain explicitly non-scoring.
    return true;
  }

  function deriveCues(previous, current, options) {
    if (!current || typeof current !== 'object') return deepFreeze([]);
    options = options || {};
    var cueCatalogue = options.cueCatalogueMap || buildCueCatalogue(options.cueCatalogue || options.audioCues);
    var cues = [];
    var explicitTypes = Object.create(null);
    var timeMs = Math.max(0, finite(current.timeMs, 0));
    var loopId = loopIdOf(current, '0');

    function hasNearbyNamedCue(type) {
      var ids = Object.keys(cueCatalogue);
      for (var index = 0; index < ids.length; index += 1) {
        var descriptor = cueCatalogue[ids[index]];
        if (
          cueTypeOf(descriptor) === type &&
          Number.isFinite(Number(descriptor.atMs)) &&
          Math.abs(Number(descriptor.atMs) - timeMs) <= 220
        ) return true;
      }
      return false;
    }

    function add(type, eventId, values) {
      // The director owns named cue identity when it supplies one. Transition
      // inference is a fallback, not a second voice for the same frame/event.
      if (explicitTypes[type] || hasNearbyNamedCue(type)) return;
      values = values || {};
      var cue = cueFrom(values, current, {
        type: type,
        eventId: eventId,
        atMs: timeMs,
        loopId: loopId,
        source: 'director'
      });
      if (cue) cues.push(cue);
    }

    explicitCueInputs(current, cueCatalogue).forEach(function (raw) {
      var cue = cueFrom(raw, current, { atMs: timeMs, loopId: loopId, source: 'director-explicit' });
      if (cue) {
        explicitTypes[cue.type] = true;
        cues.push(cue);
      }
    });

    if (!previous) return deepFreeze(sortCues(cues));

    var currentContact = contactType(current);
    var previousContact = contactType(previous);
    var currentDribble = current.ball && current.ball.dribbleIndex;
    var previousDribble = previous.ball && previous.ball.dribbleIndex;
    if (
      currentContact === 'floor' &&
      (previousContact !== 'floor' || currentDribble !== previousDribble)
    ) {
      add('ball-bounce', 'ball-floor:' + safeString(currentDribble, round(timeMs, 3)), {
        position: current.ball && current.ball.position,
        actorId: current.ball && current.ball.ownerId,
        intensity: 0.72
      });
    }

    var currentPhase = phaseId(current);
    var previousPhase = phaseId(previous);
    if (currentPhase !== previousPhase && SQUEAK_PHASES[currentPhase]) {
      add('shoe-squeak', 'phase:' + currentPhase + ':' + safeString(current.phase && current.phase.index, '0'), {
        position: current.ball && current.ball.position,
        intensity: currentPhase === 'landing' ? 0.62 : 0.48
      });
    }

    var screen = current.contacts && current.contacts.screen;
    var previousScreen = previous.contacts && previous.contacts.screen;
    var screenNow = Boolean(screen && (screen.surfaceContact === true || screen.active === true && screen.occurred === true));
    var screenBefore = Boolean(previousScreen && (previousScreen.surfaceContact === true || previousScreen.active === true && previousScreen.occurred === true));
    if (screenNow && !screenBefore) {
      add('screen-contact', safeString(screen.id, 'screen-contact'), {
        position: screen.point,
        actorId: screen.screenerId,
        intensity: clamp(screen.intensity == null ? 0.65 : screen.intensity, 0.35, 1)
      });
    }

    var currentBallState = ballState(current);
    var previousBallState = ballState(previous);
    if (currentBallState === 'pass-flight' && previousBallState !== 'pass-flight') {
      add('pass', 'pass:' + safeString(current.ball && current.ball.ownerId, 'release'), {
        position: current.ball && current.ball.position,
        actorId: previous.ball && previous.ball.ownerId,
        intensity: 0.65
      });
    }

    var caught = current.contacts && current.contacts.catch;
    var previousCaught = previous.contacts && previous.contacts.catch;
    var catchNow = Boolean(caught && (caught.active === true || caught.occurred === true));
    var catchBefore = Boolean(previousCaught && (previousCaught.active === true || previousCaught.occurred === true));
    if (
      catchNow && !catchBefore ||
      currentBallState === 'caught' && previousBallState !== 'caught'
    ) {
      add('catch', safeString(caught && caught.id, 'catch:' + timeMs), {
        position: caught && caught.point || current.ball && current.ball.position,
        actorId: caught && caught.receiverId || current.ball && current.ball.ownerId,
        intensity: 0.72
      });
    }

    var rim = current.contacts && current.contacts.rim;
    var previousRim = previous.contacts && previous.contacts.rim;
    var rimNow = Boolean(rim && rim.crossed === true) || currentContact === 'rim-plane';
    var rimBefore = Boolean(previousRim && previousRim.crossed === true) || previousContact === 'rim-plane';
    if (rimNow && !rimBefore) {
      add('rim', safeString(rim && rim.id, 'rim:' + timeMs), {
        position: rim && rim.point || current.ball && current.ball.position,
        actorId: rim && rim.athleteId,
        intensity: 1
      });
    }

    if (currentContact === 'net' && previousContact !== 'net') {
      add('net', 'net:' + safeString(current.score && current.score.eventId, timeMs), {
        position: current.ball && current.ball.position,
        intensity: 0.82
      });
    }

    var landing = current.contacts && current.contacts.landing;
    var previousLanding = previous.contacts && previous.contacts.landing;
    var landingNow = Boolean(landing && (landing.active === true || landing.occurred === true));
    var landingBefore = Boolean(previousLanding && (previousLanding.active === true || previousLanding.occurred === true));
    if (landingNow && !landingBefore) {
      add('body-contact', safeString(landing.id, 'landing:' + timeMs), {
        position: landing.point,
        actorId: landing.athleteId,
        intensity: clamp(landing.load == null ? 0.8 : landing.load, 0.45, 1)
      });
    }

    var scoreNow = certifiedPositiveScore(current);
    var scoreBefore = certifiedPositiveScore(previous);
    if (scoreNow && !scoreBefore) {
      var scoreEventId = safeString(current.score.eventId, 'score:' + timeMs);
      add('score-stinger', scoreEventId, {
        actorId: rim && rim.athleteId,
        intensity: 0.82
      });
      add('crowd-swell', scoreEventId, {
        delayMs: 35,
        actorId: rim && rim.athleteId,
        intensity: 0.9
      });
    }

    if (whistleActive(current) && !whistleActive(previous)) {
      add('whistle', safeString(current.whistle && current.whistle.id, 'whistle:' + timeMs), {
        intensity: 0.64
      });
    }

    var currentReplay = current.broadcast && current.broadcast.replay;
    if (replayActive(current) && !replayActive(previous) && recordedFootageOf(null, current)) {
      add('replay-transition', safeString(
        current.broadcast.eventId ||
        current.broadcast.replayId ||
        currentReplay && (currentReplay.sourceEventId || currentReplay.id),
        'replay:' + timeMs
      ), {
        recordedFootage: true,
        intensity: 0.62
      });
    }

    var remaining = remainingClockMs(current);
    var previousRemaining = remainingClockMs(previous);
    if (
      remaining != null &&
      previousRemaining != null &&
      remaining > 0 &&
      remaining <= 15000
    ) {
      var bucket = Math.floor(remaining / 2000);
      var previousBucket = Math.floor(previousRemaining / 2000);
      if (bucket < previousBucket) {
        add('tension-pulse', 'late-clock:' + bucket, {
          intensity: clamp(1 - remaining / 18000, 0.2, 0.9)
        });
      }
    }

    if (hornActive(current) && !hornActive(previous)) {
      add('horn', safeString(current.horn && current.horn.id, 'horn:' + currentPhase + ':' + timeMs), {
        intensity: 0.86
      });
    }

    return deepFreeze(sortCues(cues));
  }

  function createCuePlanner(options) {
    options = options || {};
    var seekThresholdMs = Math.max(50, finite(options.seekThresholdMs, DEFAULT_SEEK_THRESHOLD_MS));
    var loopId = safeString(options.loopId, '0');
    var seen = Object.create(null);
    var seenCount = 0;
    var generation = 0;
    var previousSample = null;
    var lastTimeMs = null;
    var cueCatalogue = buildCueCatalogue(options.cueCatalogue || options.audioCues);
    var deriveOptions = { cueCatalogueMap: cueCatalogue };

    function state() {
      return deepFreeze({
        version: VERSION,
        loopId: loopId,
        generation: generation,
        lastTimeMs: lastTimeMs == null ? null : round(lastTimeMs, 3),
        primed: Boolean(previousSample),
        seenCount: seenCount,
        seekThresholdMs: seekThresholdMs
      });
    }

    function clearSeen() {
      seen = Object.create(null);
      seenCount = 0;
    }

    function reset(nextLoopId, timeOrSample, maybeSample) {
      generation += 1;
      clearSeen();
      loopId = safeString(nextLoopId, String(generation));
      var sample = timeOrSample && typeof timeOrSample === 'object' ? timeOrSample : maybeSample;
      var timeMs = sample ? finite(sample.timeMs, 0) : finite(timeOrSample, 0);
      previousSample = sample || null;
      lastTimeMs = timeMs;
      if (sample) accept(deriveCues(null, sample, deriveOptions));
      return state();
    }

    function seek(timeOrSample, nextLoopId, maybeSample) {
      var sample = timeOrSample && typeof timeOrSample === 'object' ? timeOrSample : maybeSample;
      var timeMs = sample ? finite(sample.timeMs, 0) : finite(timeOrSample, 0);
      var requestedLoop = sample ? loopIdOf(sample, loopId) : safeString(nextLoopId, loopId);
      if (requestedLoop !== loopId) return reset(requestedLoop, timeMs, sample);
      previousSample = sample || null;
      lastTimeMs = timeMs;
      if (sample) accept(deriveCues(null, sample, deriveOptions));
      return state();
    }

    function accept(cues) {
      var accepted = [];
      sortCues(cues).forEach(function (cue) {
        if (!cue || cue.type === 'replay-transition' && cue.recordedFootage !== true) return;
        var key = cue.type + '|' + cue.eventId;
        if (seen[key]) return;
        seen[key] = true;
        seenCount += 1;
        accepted.push(cue);
      });
      return deepFreeze(accepted);
    }

    function directCues(input) {
      var list = Array.isArray(input) ? input : cueListFrom(input && (input.cues || input.audioCues || input.cue || input));
      var cues = [];
      list.forEach(function (raw) {
        raw = resolveCueInput(raw, cueCatalogue);
        var cue = cueFrom(raw, null, {
          atMs: finite(raw && raw.atMs, lastTimeMs == null ? 0 : lastTimeMs),
          loopId: loopId,
          source: 'explicit'
        });
        if (cue) cues.push(cue);
      });
      return accept(cues);
    }

    function consume(input, consumeOptions) {
      consumeOptions = consumeOptions || {};
      var isDirect = Array.isArray(input) || cueTypeOf(input) || input && !hasOwn.call(input, 'timeMs') && (
        input.cue || input.cues || input.audioCue || input.audioCues
      );
      if (isDirect) return directCues(input);
      if (!input || typeof input !== 'object') return deepFreeze([]);

      var currentLoop = loopIdOf(input, loopId);
      var currentTimeMs = Math.max(0, finite(input.timeMs, 0));
      if (currentLoop !== loopId) {
        reset(currentLoop, currentTimeMs, input);
        return deepFreeze([]);
      }
      if (!previousSample) {
        previousSample = input;
        lastTimeMs = currentTimeMs;
        var primeCues = accept(deriveCues(null, input, deriveOptions));
        return consumeOptions.emitOnPrime === true ? primeCues : deepFreeze([]);
      }

      var delta = currentTimeMs - finite(lastTimeMs, currentTimeMs);
      if (
        delta < -0.001 ||
        delta > seekThresholdMs && consumeOptions.continuous !== true
      ) {
        seek(input);
        return deepFreeze([]);
      }

      var previous = previousSample;
      previousSample = input;
      lastTimeMs = currentTimeMs;
      return accept(deriveCues(previous, input, deriveOptions));
    }

    return Object.freeze({
      consume: consume,
      reset: reset,
      seek: seek,
      state: state
    });
  }

  function hashString(value) {
    var text = safeString(value, 'cyberliga-audio');
    var hash = 2166136261;
    for (var index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0 || 1;
  }

  function setParam(param, value, atTime) {
    if (!param) return;
    if (typeof param.setValueAtTime === 'function') param.setValueAtTime(value, atTime);
    else param.value = value;
  }

  function linearParam(param, value, atTime) {
    if (!param) return;
    if (typeof param.linearRampToValueAtTime === 'function') param.linearRampToValueAtTime(value, atTime);
    else setParam(param, value, atTime);
  }

  function exponentialParam(param, value, atTime) {
    value = Math.max(EPSILON_GAIN, value);
    if (!param) return;
    if (typeof param.exponentialRampToValueAtTime === 'function') param.exponentialRampToValueAtTime(value, atTime);
    else setParam(param, value, atTime);
  }

  function targetParam(param, value, atTime, constant) {
    if (!param) return;
    if (typeof param.setTargetAtTime === 'function') param.setTargetAtTime(value, atTime, constant);
    else setParam(param, value, atTime);
  }

  function createBroadcastAudio(options) {
    options = options || {};
    var plannerOptions = Object.assign({}, options.plannerOptions || {});
    var directorCatalogue = root && root.CyberligaBasketballBroadcastDirector && root.CyberligaBasketballBroadcastDirector.audioCues;
    if (!plannerOptions.cueCatalogue && !plannerOptions.audioCues) {
      plannerOptions.cueCatalogue = options.cueCatalogue || options.audioCues || directorCatalogue;
    }
    var planner = options.planner || createCuePlanner(plannerOptions);
    var contextFactory = options.contextFactory || function () {
      var AudioContextConstructor = root && (root.AudioContext || root.webkitAudioContext);
      if (!AudioContextConstructor) throw new Error('Web Audio is unavailable');
      return new AudioContextConstructor();
    };
    var volume = clamp(options.volume == null ? 0.72 : options.volume, 0, 1);
    var muted = Boolean(options.muted);
    var unlocked = false;
    var destroyed = false;
    var context = null;
    var graph = null;
    var transientSources = new Set();
    var bedSources = [];
    var noiseBuffers = Object.create(null);
    var atmosphere = { crowdReaction: 0 };

    function now() {
      return context ? finite(context.currentTime, 0) : 0;
    }

    function connect(source, destination) {
      if (source && typeof source.connect === 'function') source.connect(destination);
      return destination;
    }

    function createGraph() {
      if (graph || !context) return;
      var transientBus = context.createGain();
      var bedBus = context.createGain();
      var mixBus = context.createGain();
      var compressor = context.createDynamicsCompressor();
      var master = context.createGain();

      connect(transientBus, mixBus);
      connect(bedBus, mixBus);
      connect(mixBus, compressor);
      connect(compressor, master);
      connect(master, context.destination);

      var at = now();
      setParam(transientBus.gain, 0.9, at);
      setParam(bedBus.gain, 1, at);
      setParam(mixBus.gain, 0.82, at);
      setParam(compressor.threshold, -22, at);
      setParam(compressor.knee, 18, at);
      setParam(compressor.ratio, 8, at);
      setParam(compressor.attack, 0.004, at);
      setParam(compressor.release, 0.18, at);
      setParam(master.gain, muted ? 0 : volume, at);

      graph = {
        transientBus: transientBus,
        bedBus: bedBus,
        mixBus: mixBus,
        compressor: compressor,
        master: master,
        roomGain: null,
        crowdGain: null
      };
    }

    function noiseBuffer(durationSeconds, seed) {
      var sampleRate = Math.max(8000, finite(context && context.sampleRate, 48000));
      var length = Math.max(32, Math.round(durationSeconds * sampleRate));
      var key = seed + ':' + length + ':' + sampleRate;
      if (noiseBuffers[key]) return noiseBuffers[key];
      var buffer = context.createBuffer(1, length, sampleRate);
      var data = buffer.getChannelData(0);
      var value = hashString(seed);
      for (var index = 0; index < data.length; index += 1) {
        value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
        data[index] = value / 2147483648 - 1;
      }
      noiseBuffers[key] = buffer;
      return buffer;
    }

    function registerTransient(source) {
      if (!source) return source;
      transientSources.add(source);
      var previousEnded = source.onended;
      source.onended = function () {
        transientSources.delete(source);
        if (typeof previousEnded === 'function') previousEnded();
      };
      return source;
    }

    function voiceOutput(gainValue, pan, start, attack, duration) {
      var gainNode = context.createGain();
      var panner = typeof context.createStereoPanner === 'function' ? context.createStereoPanner() : null;
      var end = start + duration;
      setParam(gainNode.gain, EPSILON_GAIN, start);
      linearParam(gainNode.gain, clamp(gainValue, 0, MAX_CUE_GAIN), start + Math.max(0.002, attack));
      exponentialParam(gainNode.gain, EPSILON_GAIN, end);
      if (panner) {
        setParam(panner.pan, clamp(pan, -1, 1), start);
        connect(gainNode, panner);
        connect(panner, graph.transientBus);
      } else {
        connect(gainNode, graph.transientBus);
      }
      return { input: gainNode, end: end };
    }

    function oscillatorVoice(cue, values) {
      values = values || {};
      var start = now() + 0.008 + cue.delayMs / 1000 + finite(values.offset, 0);
      var duration = Math.max(0.025, finite(values.duration, cue.durationMs > 0 ? cue.durationMs / 1000 : 0.16));
      var output = voiceOutput(cue.gain * finite(values.gainScale, 1), cue.pan + finite(values.panOffset, 0), start, finite(values.attack, 0.008), duration);
      var oscillator = registerTransient(context.createOscillator());
      oscillator.type = values.wave || 'sine';
      setParam(oscillator.frequency, Math.max(20, finite(values.startFrequency, 180)), start);
      exponentialParam(oscillator.frequency, Math.max(20, finite(values.endFrequency, values.startFrequency || 180)), output.end);
      if (oscillator.detune) setParam(oscillator.detune, finite(values.detune, 0), start);
      connect(oscillator, output.input);
      oscillator.start(start);
      oscillator.stop(output.end + 0.02);
      return oscillator;
    }

    function noiseVoice(cue, values) {
      values = values || {};
      var start = now() + 0.008 + cue.delayMs / 1000 + finite(values.offset, 0);
      var duration = Math.max(0.025, finite(values.duration, cue.durationMs > 0 ? cue.durationMs / 1000 : 0.16));
      var output = voiceOutput(cue.gain * finite(values.gainScale, 1), cue.pan + finite(values.panOffset, 0), start, finite(values.attack, 0.004), duration);
      var source = registerTransient(context.createBufferSource());
      var filter = context.createBiquadFilter();
      source.buffer = noiseBuffer(Math.max(0.3, duration + 0.05), cue.id + ':' + safeString(values.seed, 'noise'));
      filter.type = values.filterType || 'bandpass';
      setParam(filter.frequency, Math.max(30, finite(values.frequency, 1200)), start);
      setParam(filter.Q, Math.max(0.01, finite(values.q, 0.7)), start);
      connect(source, filter);
      connect(filter, output.input);
      source.start(start);
      source.stop(output.end + 0.02);
      return source;
    }

    function scheduleCue(cue) {
      if (
        destroyed ||
        !unlocked ||
        !context ||
        context.state !== 'running' ||
        !graph ||
        cue.type === 'replay-transition' && cue.recordedFootage !== true
      ) return false;

      if (cue.type === 'ball-bounce') {
        oscillatorVoice(cue, { startFrequency: 118, endFrequency: 48, duration: 0.13, wave: 'sine' });
        noiseVoice(cue, { frequency: 820, q: 0.75, duration: 0.045, gainScale: 0.26, seed: 'bounce-click' });
      } else if (cue.type === 'shoe-squeak') {
        oscillatorVoice(cue, { startFrequency: 1900, endFrequency: 3250, duration: 0.09, wave: 'triangle', gainScale: 0.58 });
        noiseVoice(cue, { filterType: 'highpass', frequency: 2700, q: 0.5, duration: 0.07, gainScale: 0.3, seed: 'shoe' });
      } else if (cue.type === 'screen-contact') {
        oscillatorVoice(cue, { startFrequency: 92, endFrequency: 43, duration: 0.16, wave: 'sine' });
        noiseVoice(cue, { filterType: 'lowpass', frequency: 540, q: 0.55, duration: 0.11, gainScale: 0.54, seed: 'screen' });
      } else if (cue.type === 'body-contact') {
        oscillatorVoice(cue, { startFrequency: 76, endFrequency: 38, duration: 0.19, wave: 'sine' });
        noiseVoice(cue, { filterType: 'lowpass', frequency: 430, q: 0.45, duration: 0.13, gainScale: 0.48, seed: 'body' });
      } else if (cue.type === 'pass') {
        noiseVoice(cue, { filterType: 'bandpass', frequency: 2200, q: 0.65, duration: 0.19, gainScale: 0.7, seed: 'pass' });
      } else if (cue.type === 'catch') {
        oscillatorVoice(cue, { startFrequency: 132, endFrequency: 72, duration: 0.09, wave: 'sine', gainScale: 0.7 });
        noiseVoice(cue, { filterType: 'lowpass', frequency: 760, q: 0.7, duration: 0.06, gainScale: 0.3, seed: 'catch' });
      } else if (cue.type === 'rim') {
        oscillatorVoice(cue, { startFrequency: 790, endFrequency: 735, duration: 0.34, wave: 'sine', gainScale: 0.75 });
        oscillatorVoice(cue, { startFrequency: 1185, endFrequency: 1100, duration: 0.24, wave: 'sine', gainScale: 0.38, offset: 0.004 });
      } else if (cue.type === 'net') {
        noiseVoice(cue, { filterType: 'highpass', frequency: 1850, q: 0.35, duration: 0.26, gainScale: 0.66, seed: 'net' });
      } else if (cue.type === 'whistle') {
        oscillatorVoice(cue, { startFrequency: 2450, endFrequency: 2740, duration: 0.22, wave: 'sine', gainScale: 0.72 });
        oscillatorVoice(cue, { startFrequency: 2940, endFrequency: 2620, duration: 0.17, wave: 'sine', gainScale: 0.28, offset: 0.045 });
      } else if (cue.type === 'score-stinger') {
        [392, 494, 587].forEach(function (frequency, index) {
          oscillatorVoice(cue, {
            startFrequency: frequency,
            endFrequency: frequency * 0.985,
            duration: 0.42,
            wave: 'triangle',
            gainScale: index === 0 ? 0.5 : 0.34,
            offset: index * 0.045
          });
        });
      } else if (cue.type === 'crowd-swell') {
        noiseVoice(cue, { filterType: 'lowpass', frequency: 1250, q: 0.28, duration: 0.78, attack: 0.16, gainScale: 0.78, seed: 'crowd-swell' });
        oscillatorVoice(cue, { startFrequency: 96, endFrequency: 118, duration: 0.55, wave: 'sine', gainScale: 0.18, attack: 0.12 });
      } else if (cue.type === 'replay-transition') {
        noiseVoice(cue, { filterType: 'bandpass', frequency: 980, q: 0.5, duration: 0.38, attack: 0.16, gainScale: 0.6, seed: 'replay' });
        oscillatorVoice(cue, { startFrequency: 430, endFrequency: 155, duration: 0.32, wave: 'triangle', gainScale: 0.4 });
      } else if (cue.type === 'tension-pulse') {
        oscillatorVoice(cue, { startFrequency: 72, endFrequency: 58, duration: 0.18, wave: 'sine', gainScale: 0.75, attack: 0.018 });
      } else if (cue.type === 'horn') {
        oscillatorVoice(cue, { startFrequency: 112, endFrequency: 108, duration: 0.72, wave: 'sawtooth', gainScale: 0.62, attack: 0.025 });
        oscillatorVoice(cue, { startFrequency: 168, endFrequency: 162, duration: 0.72, wave: 'square', gainScale: 0.26, attack: 0.025 });
      } else {
        return false;
      }
      return true;
    }

    function startBeds() {
      if (!context || !graph || bedSources.length) return;
      var at = now();

      function bed(seed, filterType, frequency, gainValue, duration) {
        var source = context.createBufferSource();
        var filter = context.createBiquadFilter();
        var gain = context.createGain();
        source.buffer = noiseBuffer(duration, seed);
        source.loop = true;
        filter.type = filterType;
        setParam(filter.frequency, frequency, at);
        setParam(filter.Q, 0.25, at);
        setParam(gain.gain, gainValue, at);
        connect(source, filter);
        connect(filter, gain);
        connect(gain, graph.bedBus);
        source.start(at);
        bedSources.push(source);
        return gain;
      }

      graph.roomGain = bed('high-room-air', 'lowpass', 620, 0.009, 2.4);
      graph.crowdGain = bed('restrained-crowd-bed', 'bandpass', 880, 0.006, 3.1);

      var lfo = context.createOscillator();
      var depth = context.createGain();
      lfo.type = 'sine';
      setParam(lfo.frequency, 0.075, at);
      setParam(depth.gain, 0.0025, at);
      connect(lfo, depth);
      connect(depth, graph.crowdGain.gain);
      lfo.start(at);
      bedSources.push(lfo);
    }

    function updateAtmosphere(sample) {
      var reaction = clamp(
        sample && sample.presentation && sample.presentation.crowdReaction,
        0,
        1
      );
      atmosphere = { crowdReaction: reaction };
      if (!graph || !graph.crowdGain || !graph.roomGain) return;
      var at = now();
      targetParam(graph.roomGain.gain, 0.009, at, 0.18);
      targetParam(graph.crowdGain.gain, 0.006 + reaction * 0.018, at, 0.12);
    }

    function applyMaster() {
      if (!graph || !graph.master) return;
      targetParam(graph.master.gain, muted ? 0 : volume, now(), 0.018);
    }

    function stopSources(collection) {
      collection.forEach(function (source) {
        try {
          if (source && typeof source.stop === 'function') source.stop(now());
        } catch (error) {
          // A Web Audio source may already have ended; reset remains idempotent.
        }
        try {
          if (source && typeof source.disconnect === 'function') source.disconnect();
        } catch (error) {
          // Disconnect is best-effort for already-collected nodes.
        }
      });
    }

    function stopTransients() {
      stopSources(Array.from(transientSources));
      transientSources.clear();
    }

    function status() {
      var contextState = context ? safeString(context.state, 'unknown') : 'none';
      var stateName = destroyed
        ? 'destroyed'
        : !unlocked
          ? 'locked'
          : muted
            ? 'muted'
            : contextState === 'running'
              ? 'running'
              : 'suspended';
      return deepFreeze({
        version: VERSION,
        state: stateName,
        locked: !unlocked,
        muted: muted,
        volume: round(volume, 3),
        contextState: contextState,
        scheduledCount: transientSources.size,
        bedActive: bedSources.length > 0,
        atmosphere: { crowdReaction: round(atmosphere.crowdReaction, 4) },
        planner: planner.state()
      });
    }

    function unlock() {
      if (destroyed) return Promise.reject(new Error('Broadcast audio is destroyed'));
      try {
        if (!context) context = contextFactory();
        createGraph();
      } catch (error) {
        return Promise.reject(error);
      }
      var resume = context.state === 'suspended' && typeof context.resume === 'function'
        ? context.resume()
        : Promise.resolve();
      return Promise.resolve(resume).then(function () {
        unlocked = context.state === 'running' || context.state == null;
        if (!unlocked) return status();
        startBeds();
        updateAtmosphere({ presentation: atmosphere });
        applyMaster();
        return status();
      });
    }

    function consume(input, consumeOptions) {
      var cues = planner.consume(input, consumeOptions);
      if (input && typeof input === 'object' && !Array.isArray(input) && hasOwn.call(input, 'timeMs')) {
        updateAtmosphere(input);
      }
      if (unlocked && context && context.state === 'running') cues.forEach(scheduleCue);
      return cues;
    }

    function reset(nextLoopId, timeOrSample, maybeSample) {
      stopTransients();
      updateAtmosphere(null);
      return planner.reset(nextLoopId, timeOrSample, maybeSample);
    }

    function seek(timeOrSample, nextLoopId, maybeSample) {
      stopTransients();
      return planner.seek(timeOrSample, nextLoopId, maybeSample);
    }

    function setVolume(nextVolume) {
      volume = clamp(nextVolume, 0, 1);
      applyMaster();
      return status();
    }

    function setMuted(nextMuted) {
      muted = nextMuted == null ? !muted : Boolean(nextMuted);
      applyMaster();
      return status();
    }

    function destroy() {
      if (destroyed) return status();
      stopTransients();
      stopSources(bedSources);
      bedSources = [];
      destroyed = true;
      unlocked = false;
      if (context && typeof context.close === 'function') {
        try { context.close(); } catch (error) { /* best-effort close */ }
      }
      return status();
    }

    return Object.freeze({
      unlock: unlock,
      consume: consume,
      reset: reset,
      seek: seek,
      setVolume: setVolume,
      setMuted: setMuted,
      mute: function () { return setMuted(true); },
      unmute: function () { return setMuted(false); },
      status: status,
      destroy: destroy
    });
  }

  return deepFreeze({
    version: VERSION,
    cueTypes: CUE_TYPES.slice(),
    cuePriority: Object.assign({}, TYPE_PRIORITY),
    maxCueGain: MAX_CUE_GAIN,
    deriveCues: deriveCues,
    createCuePlanner: createCuePlanner,
    createBroadcastAudio: createBroadcastAudio
  });
});
