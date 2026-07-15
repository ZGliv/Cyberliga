(function (root, factory) {
  'use strict';

  if (typeof define === 'function' && define.amd) {
    define([], function () { return factory(root); });
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
  } else {
    root.CyberligaFoundingLive = factory(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var CONTENT = root && root.CYBERLIGA_CONTENT;
  var CHARACTERS = root && root.CyberligaCharacters;
  var VISUAL = root && root.CyberligaFoundingVisual;
  var VERSION = '1.0.0';
  var MAX_CUES = 3;
  var MAX_TRIANGLES_PER_CUE = 32;
  var MAX_TRIANGLES_PER_ATHLETE = 96;
  var BODY_KEYS = Object.freeze([
    'kite', 'lantern', 'stoop', 'toque', 'sugar', 'loon',
    'alebrije', 'cane', 'gong', 'rice', 'gumbo', 'peach'
  ]);

  function solid(z, depth, points) {
    return { z: z, depth: depth, points: points };
  }
  function cue(id, anchor, solids) {
    return { id: id, anchor: anchor, solids: solids };
  }
  function recipe(bodyKey, label, cues) {
    return { bodyKey: bodyKey, label: label, cues: cues };
  }

  // Coordinates are local to the existing torso/head anchors. Every solid sits on
  // the rear half of the rig, so a cue can change the broadcast silhouette without
  // becoming a second ball, puck, bat, stick, glove, or interactive object.
  var SOURCE_RECIPES = [
    recipe('kite', 'DIAMOND WING', [
      cue('wing-yoke', 'body', [solid(-.47, .08, [[0,.36],[.58,.12],[0,-.05],[-.58,.12]])]),
      cue('dorsal-fin', 'head', [solid(-.25, .08, [[0,.35],[.19,-.04],[-.16,-.04]])]),
      cue('tail-diamond', 'body', [solid(-.48, .08, [[0,-.40],[.18,-.61],[0,-.82],[-.18,-.61]])])
    ]),
    recipe('lantern', 'FACETED LANTERN', [
      cue('crown-cap', 'head', [solid(-.25, .09, [[-.34,-.04],[-.22,.15],[.22,.15],[.34,-.04],[.20,-.12],[-.20,-.12]])]),
      cue('side-bows', 'body', [
        solid(-.47, .08, [[-.24,.42],[-.58,.04],[-.24,-.08]]),
        solid(-.47, .08, [[.24,.42],[.24,-.08],[.58,.04]])
      ]),
      cue('fixed-tassel', 'body', [solid(-.48, .08, [[0,-.38],[.14,-.78],[-.14,-.78]])])
    ]),
    recipe('stoop', 'THREE STEPS', [
      cue('shoulder-step', 'body', [solid(-.48, .08, [[-.58,.48],[.58,.48],[.58,.62],[-.58,.62]])]),
      cue('middle-step', 'body', [solid(-.49, .08, [[-.49,.12],[.49,.12],[.49,.27],[-.49,.27]])]),
      cue('crown-step', 'head', [solid(-.26, .08, [[-.34,.10],[.34,.10],[.34,.25],[-.34,.25]])])
    ]),
    recipe('toque', 'WHITEOUT TOQUE', [
      cue('hex-brim', 'head', [solid(-.25, .08, [[-.40,-.08],[-.30,.04],[.30,.04],[.40,-.08],[.30,-.15],[-.30,-.15]])]),
      cue('faceted-pom', 'head', [solid(-.25, .08, [[0,.35],[.16,.23],[0,.11],[-.16,.23]])]),
      cue('rear-ribbon', 'body', [solid(-.48, .08, [[.15,.35],[.55,-.62],[.23,-.78]])])
    ]),
    recipe('sugar', 'MAPLE SEAL', [
      cue('maple-backplate', 'body', [solid(-.49, .08, [[0,.78],[.48,.38],[.48,-.14],[0,-.55],[-.48,-.14],[-.48,.38]])]),
      cue('waist-shelf', 'body', [solid(-.50, .08, [[-.58,-.10],[.58,-.10],[.58,.04],[-.58,.04]])]),
      cue('drip-wedge', 'body', [solid(-.50, .08, [[-.34,-.12],[-.10,-.78],[-.46,-.62]])])
    ]),
    recipe('loon', 'CALDERA CRESCENT', [
      cue('crescent-shell', 'body', [
        solid(-.49, .08, [[-.50,.55],[-.20,.67],[.35,.18],[.14,.05]]),
        solid(-.49, .08, [[.14,.05],[.38,-.12],[-.16,-.58],[-.34,-.42]])
      ]),
      cue('beak-wedge', 'head', [solid(-.25, .08, [[.08,.12],[.52,.01],[.08,-.09]])]),
      cue('tail-wedge', 'body', [solid(-.49, .08, [[-.10,-.43],[-.48,-.78],[.20,-.67]])])
    ]),
    recipe('alebrije', 'CHIMERA RIDGE', [
      cue('paired-horns', 'head', [
        solid(-.25, .08, [[-.24,.09],[-.38,.35],[-.08,.14]]),
        solid(-.25, .08, [[.08,.14],[.38,.35],[.24,.09]])
      ]),
      cue('shoulder-saddle', 'body', [solid(-.49, .08, [[-.56,.48],[.56,.48],[.40,.22],[-.40,.22]])]),
      cue('serrated-ridge', 'body', [
        solid(-.50, .08, [[-.18,.26],[0,.62],[.04,.22]]),
        solid(-.50, .08, [[.02,.22],[.22,.52],[.24,.15]])
      ])
    ]),
    recipe('cane', 'BOUND CANE BALE', [
      cue('bale-corners', 'body', [
        solid(-.49, .08, [[-.56,.62],[-.40,.70],[-.40,-.62],[-.56,-.50]]),
        solid(-.49, .08, [[.40,.70],[.56,.62],[.56,-.50],[.40,-.62]])
      ]),
      cue('binding-yoke', 'body', [solid(-.50, .08, [[-.50,.10],[.50,.10],[.50,.25],[-.50,.25]])]),
      cue('leaf-fan', 'body', [
        solid(-.50, .08, [[-.12,.56],[-.36,.84],[-.02,.67]]),
        solid(-.50, .08, [[-.02,.63],[0,.88],[.12,.62]]),
        solid(-.50, .08, [[.08,.67],[.37,.83],[.16,.54]])
      ])
    ]),
    recipe('gong', 'MARKET TOLL', [
      cue('tri-lobe-shield', 'body', [solid(-.50, .08, [[0,.76],[.38,.62],[.57,.24],[.42,-.42],[0,-.68],[-.42,-.42],[-.57,.24],[-.38,.62]])]),
      cue('upper-bail', 'body', [solid(-.51, .08, [[-.18,.66],[.18,.66],[.18,.86],[-.18,.86]])]),
      cue('hex-boss', 'body', [solid(-.53, .08, [[-.20,.18],[-.10,.35],[.10,.35],[.20,.18],[.10,.01],[-.10,.01]])])
    ]),
    recipe('rice', 'FOLDED PARCEL', [
      cue('crossed-leaves', 'body', [
        solid(-.49, .08, [[-.56,.55],[-.40,.66],[.50,-.50],[.34,-.62]]),
        solid(-.49, .08, [[.40,.66],[.56,.55],[-.34,-.62],[-.50,-.50]])
      ]),
      cue('folded-knot', 'body', [
        solid(-.50, .08, [[-.02,.23],[-.38,.52],[-.10,.02]]),
        solid(-.50, .08, [[.02,.23],[.10,.02],[.38,.52]])
      ]),
      cue('parcel-tabs', 'body', [
        solid(-.50, .08, [[-.50,-.40],[-.58,-.70],[-.30,-.54]]),
        solid(-.50, .08, [[-.10,-.60],[0,-.84],[.10,-.60]]),
        solid(-.50, .08, [[.30,-.54],[.58,-.70],[.50,-.40]])
      ])
    ]),
    recipe('gumbo', 'ROUX FRINGE', [
      cue('pear-flanges', 'body', [
        solid(-.49, .08, [[-.42,.08],[-.58,-.12],[-.50,-.66],[-.31,-.48]]),
        solid(-.49, .08, [[.42,.08],[.31,-.48],[.50,-.66],[.58,-.12]])
      ]),
      cue('postage-plate', 'body', [solid(-.51, .08, [[-.22,.45],[.22,.45],[.22,.72],[-.22,.72]])]),
      cue('moss-fringe', 'body', [
        solid(-.50, .08, [[-.38,-.22],[-.30,-.72],[-.12,-.30]]),
        solid(-.50, .08, [[-.12,-.28],[0,-.80],[.12,-.28]]),
        solid(-.50, .08, [[.12,-.30],[.30,-.72],[.38,-.22]])
      ])
    ]),
    recipe('peach', 'PIT SPLIT', [
      cue('split-lobes', 'body', [
        solid(-.49, .08, [[-.08,.60],[-.48,.54],[-.57,-.38],[-.12,-.24]]),
        solid(-.49, .08, [[.08,.60],[.12,-.24],[.57,-.38],[.48,.54]])
      ]),
      cue('pit-keel', 'body', [solid(-.52, .08, [[-.09,.42],[.09,.42],[.09,-.52],[-.09,-.52]])]),
      cue('leaf-wedge', 'body', [solid(-.50, .08, [[.02,.64],[.42,.84],[.23,.54]])])
    ])
  ];

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }
  var recipes = deepFreeze(SOURCE_RECIPES);
  var byBody = Object.create(null);
  recipes.forEach(function (item) { byBody[item.bodyKey] = item; });
  var PREPARED = typeof WeakSet === 'function' ? new WeakSet() : null;
  var PUBLIC_STATE = typeof WeakMap === 'function' ? new WeakMap() : null;

  function solidTriangles(item) {
    return item && Array.isArray(item.points) && item.points.length >= 3 ? item.points.length * 4 - 4 : 0;
  }
  function cueTriangles(item) {
    return item.solids.reduce(function (sum, entry) { return sum + solidTriangles(entry); }, 0);
  }
  function recipeTriangles(item) {
    return item.cues.reduce(function (sum, entry) { return sum + cueTriangles(entry); }, 0);
  }
  function prepare(athlete, team) {
    if (!athlete || !team || !CONTENT || !CHARACTERS || !VISUAL ||
        typeof CONTENT.getTeam !== 'function' || typeof CONTENT.getAthlete !== 'function' ||
        typeof CHARACTERS.get !== 'function' || typeof VISUAL.prepare !== 'function' ||
        typeof VISUAL.describe !== 'function') return null;
    var canonicalTeam = CONTENT.getTeam(team.id, team.sportId);
    var canonicalAthlete = CONTENT.getAthlete(team.id, athlete.id);
    if (canonicalTeam !== team || canonicalAthlete !== athlete ||
        !Array.isArray(canonicalTeam.athletes) || canonicalTeam.athletes.indexOf(canonicalAthlete) < 0) return null;
    var record = CHARACTERS.get(athlete.id);
    if (!record || record.id !== athlete.id) return null;
    var vectorDescriptor = VISUAL.prepare(record, canonicalTeam);
    var vectorState = vectorDescriptor && VISUAL.describe(vectorDescriptor, 0, 'live-broadcast', null);
    var item = vectorDescriptor && byBody[vectorDescriptor.bodyKey];
    if (!vectorState || !item || vectorState.athleteId !== athlete.id ||
        vectorState.teamId !== team.id || vectorState.sportId !== team.sportId) return null;
    var descriptor = Object.freeze({
      athleteId: vectorState.athleteId,
      teamId: vectorState.teamId,
      sportId: vectorState.sportId,
      bodyKey: vectorState.bodyKey,
      motionName: record.motionName,
      identityKey: vectorState.identityKey,
      rendererVersion: vectorState.rendererVersion,
      recipe: item
    });
    PREPARED.add(descriptor);
    PUBLIC_STATE.set(descriptor, Object.freeze({
      mode: 'founding-live-cue',
      identityKey: descriptor.identityKey,
      rendererVersion: descriptor.rendererVersion,
      athleteId: descriptor.athleteId,
      teamId: descriptor.teamId,
      sportId: descriptor.sportId,
      bodyKey: descriptor.bodyKey,
      motionName: descriptor.motionName,
      cueCount: item.cues.length,
      triangleCount: recipeTriangles(item)
    }));
    return descriptor;
  }
  function describe(descriptor) {
    return descriptor && PREPARED && PREPARED.has(descriptor) ? PUBLIC_STATE.get(descriptor) || null : null;
  }
  function recipeFor(descriptor) {
    return describe(descriptor) ? descriptor.recipe : null;
  }
  function convex(points) {
    if (!Array.isArray(points) || points.length < 3) return false;
    var direction = 0;
    for (var index = 0; index < points.length; index += 1) {
      var a = points[index];
      var b = points[(index + 1) % points.length];
      var c = points[(index + 2) % points.length];
      var cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (Math.abs(cross) < 1e-9) continue;
      var sign = cross > 0 ? 1 : -1;
      if (direction && sign !== direction) return false;
      direction = sign;
    }
    return direction !== 0;
  }
  function validate() {
    var errors = [];
    var seen = Object.create(null);
    recipes.forEach(function (item) {
      if (BODY_KEYS.indexOf(item.bodyKey) < 0 || seen[item.bodyKey]) errors.push('Invalid or duplicate body: ' + item.bodyKey);
      seen[item.bodyKey] = true;
      if (!Array.isArray(item.cues) || item.cues.length < 1 || item.cues.length > MAX_CUES) errors.push('Cue budget: ' + item.bodyKey);
      item.cues.forEach(function (entry) {
        if (entry.anchor !== 'body' && entry.anchor !== 'head') errors.push('Anchor: ' + item.bodyKey + '/' + entry.id);
        var triangles = cueTriangles(entry);
        if (triangles < 1 || triangles > MAX_TRIANGLES_PER_CUE) errors.push('Cue triangles: ' + item.bodyKey + '/' + entry.id);
        entry.solids.forEach(function (part) {
          if (!Number.isFinite(part.z) || !Number.isFinite(part.depth) || part.depth <= 0 || part.depth > .12) errors.push('Depth: ' + item.bodyKey + '/' + entry.id);
          if (!convex(part.points)) errors.push('Convexity: ' + item.bodyKey + '/' + entry.id);
          part.points.forEach(function (point) {
            var yLimit = entry.anchor === 'head' ? .36 : .90;
            var yFloor = entry.anchor === 'head' ? -.32 : -.85;
            if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite) || Math.abs(point[0]) > .60 || point[1] < yFloor || point[1] > yLimit) errors.push('Envelope: ' + item.bodyKey + '/' + entry.id);
          });
        });
      });
      if (recipeTriangles(item) > MAX_TRIANGLES_PER_ATHLETE) errors.push('Athlete triangles: ' + item.bodyKey);
    });
    BODY_KEYS.forEach(function (key) { if (!seen[key]) errors.push('Missing body: ' + key); });
    return Object.freeze({
      valid: errors.length === 0,
      errors: Object.freeze(errors),
      bodyCount: recipes.length,
      maxCues: MAX_CUES,
      maxTrianglesPerCue: MAX_TRIANGLES_PER_CUE,
      maxTrianglesPerAthlete: MAX_TRIANGLES_PER_ATHLETE
    });
  }

  return Object.freeze({
    version: VERSION,
    bodyKeys: BODY_KEYS,
    recipes: recipes,
    prepare: prepare,
    describe: describe,
    recipeFor: recipeFor,
    cueTriangles: cueTriangles,
    recipeTriangles: recipeTriangles,
    validate: validate
  });
});
