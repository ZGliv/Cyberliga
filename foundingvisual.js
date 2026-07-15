(function (root, factory) {
  'use strict';

  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CyberligaFoundingVisual = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '1.0.0';
  var DURATION_MS = 4800;
  var SHOWCASE_PHASE = .43;
  var TAU = Math.PI * 2;
  var BODY_KEYS = Object.freeze([
    'kite', 'lantern', 'stoop', 'toque', 'sugar', 'loon',
    'alebrije', 'cane', 'gong', 'rice', 'gumbo', 'peach'
  ]);
  var BOUNDS = Object.freeze({ left: -360, top: -270, right: 360, bottom: 270, width: 720, height: 540 });
  var SOURCE_DESCRIPTORS = [
    ['tokyo-paper-cranes-a1', 'tokyo-paper-cranes', 'soccer', 'kite'],
    ['osaka-lanterns-a4', 'osaka-lanterns', 'soccer', 'lantern'],
    ['new-york-brownstones-a1', 'new-york-brownstones', 'basketball', 'stoop'],
    ['toronto-lake-effect-a4', 'toronto-lake-effect', 'basketball', 'toque'],
    ['montreal-sugar-maples-a1', 'montreal-sugar-maples', 'hockey', 'sugar'],
    ['reykjavik-lava-loons-a4', 'reykjavik-lava-loons', 'hockey', 'loon'],
    ['mexico-city-alebrijes-a1', 'mexico-city-alebrijes', 'baseball', 'alebrije'],
    ['havana-sugar-kings-a4', 'havana-sugar-kings', 'baseball', 'cane'],
    ['accra-brass-bell-a1', 'accra-brass-bell', 'combat', 'gong'],
    ['bangkok-banana-leaf-a4', 'bangkok-banana-leaf', 'combat', 'rice'],
    ['new-orleans-bayou-kings-a1', 'new-orleans-bayou-kings', 'american-football', 'gumbo'],
    ['atlanta-peaches-a4', 'atlanta-peaches', 'american-football', 'peach']
  ];
  var DESCRIPTORS = Object.freeze(SOURCE_DESCRIPTORS.map(function (row) {
    return Object.freeze({ athleteId: row[0], teamId: row[1], sportId: row[2], bodyKey: row[3] });
  }));
  var BY_ATHLETE = Object.create(null);
  DESCRIPTORS.forEach(function (descriptor) { BY_ATHLETE[descriptor.athleteId] = descriptor; });

  var PREPARED = typeof WeakSet === 'function' ? new WeakSet() : null;
  var PAINTERS = typeof WeakMap === 'function' ? new WeakMap() : null;

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function ease(value) { value = clamp(value, 0, 1); return value * value * (3 - 2 * value); }
  function easeOut(value) { value = clamp(value, 0, 1); return 1 - Math.pow(1 - value, 3); }
  function pulse(phase, start, peak, end) {
    if (phase <= start || phase >= end) return 0;
    if (phase < peak) return ease((phase - start) / (peak - start));
    return 1 - ease((phase - peak) / (end - peak));
  }
  function hash(text) {
    var value = String(text || 'founding-visual');
    var result = 2166136261 >>> 0;
    for (var index = 0; index < value.length; index += 1) {
      result ^= value.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  }
  function randomFor(seed) {
    var stateValue = hash(seed);
    return function () {
      stateValue += 0x6D2B79F5;
      var value = stateValue;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }
  function normalizePhase(value) {
    var number = Number(value);
    if (!Number.isFinite(number)) return 0;
    if (number >= 0 && number < 1) return number;
    return ((number % 1) + 1) % 1;
  }
  function validColor(value) { return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value); }
  function validContext(ctx) {
    return Boolean(ctx && typeof ctx.save === 'function' && typeof ctx.restore === 'function' && typeof ctx.beginPath === 'function');
  }
  function isPrepared(descriptor) { return Boolean(descriptor && PREPARED && PREPARED.has(descriptor)); }

  function prepare(record, team) {
    if (!record || !team || typeof record !== 'object' || typeof team !== 'object') return null;
    var expected = BY_ATHLETE[String(record.id || '')];
    if (!expected ||
        record.teamId !== expected.teamId ||
        record.sportId !== expected.sportId ||
        record.body !== expected.bodyKey ||
        team.id !== expected.teamId ||
        team.sportId !== expected.sportId ||
        !team.colors ||
        !validColor(team.colors.primary) ||
        !validColor(team.colors.secondary) ||
        !validColor(team.colors.accent)) return null;
    var colors = Object.freeze({
      primary: team.colors.primary,
      secondary: team.colors.secondary,
      accent: team.colors.accent
    });
    var descriptor = Object.freeze({
      athleteId: expected.athleteId,
      teamId: expected.teamId,
      sportId: expected.sportId,
      bodyKey: expected.bodyKey,
      colors: colors
    });
    PREPARED.add(descriptor);
    return descriptor;
  }

  function normalizedTransform(transform) {
    if (!transform || typeof transform !== 'object') return null;
    var copy = {};
    ['x', 'y', 'scale', 'rotation', 'alpha'].forEach(function (field) {
      var value = Number(transform[field]);
      if (Number.isFinite(value)) copy[field] = value;
    });
    if (transform.bounds && typeof transform.bounds === 'object') {
      copy.bounds = Object.freeze({
        left: Number(transform.bounds.left),
        top: Number(transform.bounds.top),
        right: Number(transform.bounds.right),
        bottom: Number(transform.bounds.bottom),
        width: Number(transform.bounds.width),
        height: Number(transform.bounds.height)
      });
    }
    return Object.freeze(copy);
  }

  function describe(descriptor, phase, surface, transform) {
    if (!isPrepared(descriptor)) return null;
    return Object.freeze({
      mode: 'founding-vector',
      founding: true,
      rendererVersion: VERSION,
      athleteId: descriptor.athleteId,
      bodyKey: descriptor.bodyKey,
      sportId: descriptor.sportId,
      teamId: descriptor.teamId,
      identityKey: 'founding-vector@' + VERSION + '/' + descriptor.athleteId + '/' + descriptor.bodyKey,
      phase: normalizePhase(phase),
      surface: typeof surface === 'string' && surface ? surface : 'unknown',
      transform: normalizedTransform(transform)
    });
  }

  function normalizeBounds(value) {
    if (!value || typeof value !== 'object') return BOUNDS;
    var left = Number(value.left);
    var top = Number(value.top);
    var right = Number(value.right);
    var bottom = Number(value.bottom);
    if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) return BOUNDS;
    return Object.freeze({ left: left, top: top, right: right, bottom: bottom, width: right - left, height: bottom - top });
  }

  function fit(frame, options) {
    if (!frame || typeof frame !== 'object') return null;
    var x = Number(frame.x == null ? frame.left : frame.x);
    var y = Number(frame.y == null ? frame.top : frame.y);
    var width = Number(frame.width);
    var height = Number(frame.height);
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
    options = options && typeof options === 'object' ? options : {};
    var padding = Math.max(0, Number(options.padding) || 0);
    var sourceBounds = normalizeBounds(options.bounds);
    var innerWidth = width - padding * 2;
    var innerHeight = height - padding * 2;
    if (innerWidth <= 0 || innerHeight <= 0) return null;
    var scale = Math.min(innerWidth / sourceBounds.width, innerHeight / sourceBounds.height);
    var sourceCenterX = (sourceBounds.left + sourceBounds.right) / 2;
    var sourceCenterY = (sourceBounds.top + sourceBounds.bottom) / 2;
    return Object.freeze({
      x: x + width / 2 - sourceCenterX * scale,
      y: y + height / 2 - sourceCenterY * scale,
      scale: scale,
      bounds: sourceBounds
    });
  }

  function createPainter(ctx) {
    function roundedRectPath(x, y, width, height, radius) {
      var path = new Path2D();
      path.roundRect(x, y, width, height, radius);
      return path;
    }
    function polygonPath(points) {
      var path = new Path2D();
      path.moveTo(points[0][0], points[0][1]);
      for (var index = 1; index < points.length; index += 1) path.lineTo(points[index][0], points[index][1]);
      path.closePath();
      return path;
    }
    function ellipsePath(x, y, rx, ry, rotation) {
      var path = new Path2D();
      path.ellipse(x, y, rx, ry, rotation || 0, 0, TAU);
      return path;
    }
    function tactile(path, fill, texture, seed, bounds, options) {
      options = options || {};
      ctx.save();
      if (options.shadow !== false) {
        ctx.shadowColor = 'rgba(0,0,0,.24)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 9;
      }
      ctx.fillStyle = fill;
      ctx.fill(path);
      ctx.shadowColor = 'transparent';
      ctx.clip(path);
      var random = randomFor(seed);
      var count = options.count || 42;
      ctx.globalAlpha = options.textureAlpha || .14;
      ctx.fillStyle = texture;
      ctx.strokeStyle = texture;
      for (var index = 0; index < count; index += 1) {
        var x = bounds[0] + random() * bounds[2];
        var y = bounds[1] + random() * bounds[3];
        if (index % 3 === 0) {
          ctx.lineWidth = .8 + random() * 1.4;
          ctx.beginPath();
          ctx.moveTo(x - 7 - random() * 7, y + 2);
          ctx.lineTo(x + 7 + random() * 8, y - 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(x, y, 1 + random() * 3.4, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = options.stroke || '#151711';
      ctx.lineWidth = options.lineWidth || 5;
      ctx.lineJoin = 'round';
      ctx.stroke(path);
      ctx.restore();
    }
    function line(points, color, width) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (var index = 1; index < points.length; index += 1) ctx.lineTo(points[index][0], points[index][1]);
      ctx.stroke();
      ctx.restore();
    }
    function palette(descriptor, inkOnly) {
      if (inkOnly) return { primary: '#080906', secondary: '#080906', accent: '#080906', ink: '#080906', light: '#080906' };
      return {
        primary: descriptor.colors.primary,
        secondary: descriptor.colors.secondary,
        accent: descriptor.colors.accent,
        ink: '#141510',
        light: '#f4eee2'
      };
    }
    function eye(x, y, size, direction, inkOnly) {
      if (inkOnly) return;
      ctx.save();
      ctx.fillStyle = '#f4eee2';
      ctx.beginPath();
      ctx.ellipse(x, y, size * 1.4, size, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#12130f';
      ctx.beginPath();
      ctx.arc(x + (direction || 0) * size * .46, y, size * .43, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    function sportProp(sportId, options) {
      options = options || {};
      var x = Number(options.x) || 0;
      var y = Number(options.y) || 0;
      var scale = Number.isFinite(Number(options.scale)) ? Number(options.scale) : 1;
      var color = validColor(options.color) ? options.color : null;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (sportId === 'soccer') {
        ctx.fillStyle = '#f5f0e6'; ctx.strokeStyle = '#151612'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#151612';
        for (var angleIndex = 0; angleIndex < 5; angleIndex += 1) {
          var angle = angleIndex * TAU / 5 - Math.PI / 2;
          ctx.beginPath(); ctx.arc(Math.cos(angle) * 12, Math.sin(angle) * 12, 3.3, 0, TAU); ctx.fill();
        }
      } else if (sportId === 'basketball') {
        ctx.fillStyle = '#d96f31'; ctx.strokeStyle = '#191914'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, 25, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 21, -Math.PI / 2, Math.PI / 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(24, 0); ctx.stroke();
      } else if (sportId === 'hockey') {
        ctx.fillStyle = '#11120f'; ctx.beginPath(); ctx.ellipse(0, 0, 27, 9, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = color || '#f1e9dc'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(40, -110); ctx.lineTo(13, -8); ctx.lineTo(-30, 3); ctx.stroke();
      } else if (sportId === 'baseball') {
        ctx.fillStyle = '#f5efe4'; ctx.strokeStyle = '#171813'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#b43d32'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(-7, 0, 10, -1.4, 1.4); ctx.stroke();
        ctx.beginPath(); ctx.arc(7, 0, 10, 1.74, 4.54); ctx.stroke();
      } else if (sportId === 'combat') {
        ctx.strokeStyle = color || '#f4eee2'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.roundRect(-35, -27, 70, 54, 18); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fill();
      } else if (sportId === 'american-football') {
        ctx.fillStyle = '#7c4a2f'; ctx.strokeStyle = '#f2e9dc'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(0, 0, 32, 19, -.42, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#f2e9dc'; ctx.lineWidth = 2;
        for (var seam = -12; seam <= 12; seam += 8) { ctx.beginPath(); ctx.moveTo(seam - 7, -11); ctx.lineTo(seam + 7, 11); ctx.stroke(); }
      }
      ctx.restore();
    }

    return {
      roundedRectPath: roundedRectPath,
      polygonPath: polygonPath,
      ellipsePath: ellipsePath,
      tactile: tactile,
      line: line,
      palette: palette,
      eye: eye,
      sportProp: sportProp
    };
  }

  function painterFor(ctx) {
    if (PAINTERS.has(ctx)) return PAINTERS.get(ctx);
    var painter = createPainter(ctx);
    PAINTERS.set(ctx, painter);
    return painter;
  }

  function bodyKite(ctx, painter, character, phase, inkOnly) {
    var c = painter.palette(character, inkOnly);
    var sig = pulse(phase, .16, .38, .67);
    var inhale = Math.sin(phase * TAU) * .04;
    painter.line([[-48, 13], [-105 - sig * 46, 54 - sig * 31], [-139 - sig * 48, 36]], c.ink, 13);
    painter.line([[48, 13], [105 + sig * 46, 54 - sig * 31], [139 + sig * 48, 36]], c.ink, 13);
    painter.tactile(painter.ellipsePath(-142 - sig * 48, 36, 20 + sig * 15, 17 + sig * 15, 0), c.accent, c.light, character.id + 'hand1', [-180, 0, 70, 70], { count: 12, lineWidth: 4 });
    painter.tactile(painter.ellipsePath(142 + sig * 48, 36, 20 + sig * 15, 17 + sig * 15, 0), c.accent, c.light, character.id + 'hand2', [110, 0, 70, 70], { count: 12, lineWidth: 4 });
    painter.line([[-29, 126], [-45 - sig * 18, 184], [-77 - sig * 36, 218]], c.ink, 15);
    painter.line([[29, 126], [45 + sig * 18, 184], [77 + sig * 36, 218]], c.ink, 15);
    var body = painter.polygonPath([[0, -139], [94 + sig * 49, 7], [0, 150 - sig * 15], [-94 - sig * 49, 7]]);
    painter.tactile(body, c.primary, c.secondary, character.id + 'kite', [-145, -145, 290, 300], { count: 66 });
    ctx.save(); ctx.strokeStyle = c.accent; ctx.lineWidth = inkOnly ? 0 : 5;
    ctx.beginPath(); ctx.moveTo(0, -128); ctx.lineTo(0, 133); ctx.moveTo(-82 - sig * 40, 7); ctx.lineTo(82 + sig * 40, 7); ctx.stroke(); ctx.restore();
    painter.tactile(painter.polygonPath([[-17, -142], [7, -198], [31, -139]]), c.accent, c.secondary, character.id + 'fin', [-20, -205, 55, 70], { count: 8, lineWidth: 4 });
    painter.eye(-21, -31 + inhale * 20, 8, sig, inkOnly); painter.eye(21, -31 + inhale * 20, 8, sig, inkOnly);
  }

  function bodyLantern(ctx, painter, character, phase, inkOnly) {
    var c = painter.palette(character, inkOnly);
    var sig = pulse(phase, .22, .43, .65);
    var swing = Math.sin(phase * TAU) * .28 + sig * .46;
    ctx.rotate(swing);
    painter.line([[0, -222], [0, -151]], c.ink, 8);
    painter.line([[-34, 126], [-16 + sig * 62, 196]], c.ink, 12);
    painter.line([[34, 126], [54 + sig * 66, 182]], c.ink, 12);
    painter.tactile(painter.ellipsePath(-16 + sig * 62, 204, 27, 12, .1), c.secondary, c.accent, character.id + 'shoe1', [-60, 180, 120, 45], { count: 9, lineWidth: 4 });
    painter.tactile(painter.ellipsePath(55 + sig * 67, 190, 27, 12, .1), c.secondary, c.accent, character.id + 'shoe2', [10, 160, 120, 50], { count: 9, lineWidth: 4 });
    var lantern = new Path2D();
    lantern.moveTo(-56, -138); lantern.bezierCurveTo(-116, -92, -119, 77, -59, 135);
    lantern.quadraticCurveTo(0, 164, 59, 135); lantern.bezierCurveTo(119, 77, 116, -92, 56, -138); lantern.closePath();
    painter.tactile(lantern, c.primary, c.accent, character.id + 'lantern', [-120, -140, 240, 300], { count: 58 });
    if (!inkOnly) {
      ctx.save(); ctx.strokeStyle = c.secondary; ctx.globalAlpha = .7; ctx.lineWidth = 4;
      [-67, -34, 0, 34, 67].forEach(function (x) { ctx.beginPath(); ctx.moveTo(x * .75, -125); ctx.quadraticCurveTo(x * 1.3, 0, x * .75, 128); ctx.stroke(); });
      ctx.restore();
    }
    painter.tactile(painter.roundedRectPath(-46, -159, 92, 24, 8), c.secondary, c.accent, character.id + 'cap', [-50, -165, 100, 35], { count: 8, lineWidth: 4 });
    ctx.save(); ctx.fillStyle = c.accent; ctx.beginPath(); ctx.ellipse(0, 82, 12, 28, 0, 0, TAU); ctx.fill(); ctx.restore();
    painter.eye(-24, -52, 7, sig, inkOnly); painter.eye(24, -52, 7, sig, inkOnly);
  }

  function bodyStoop(ctx, painter, character, phase, inkOnly) {
    var c = painter.palette(character, inkOnly);
    var sig = pulse(phase, .18, .41, .68);
    var squat = Math.sin(phase * TAU) * 6 + sig * 28;
    painter.line([[-55, 95], [-69, 145 + squat], [-54, 183 - sig * 70]], c.ink, 25);
    painter.line([[55, 95], [69, 145 + squat], [54, 183 - sig * 70]], c.ink, 25);
    painter.tactile(painter.ellipsePath(-57, 199 - sig * 72, 40, 18, 0), c.secondary, c.accent, character.id + 'step-foot1', [-105, 160, 95, 50], { count: 12, lineWidth: 5 });
    painter.tactile(painter.ellipsePath(57, 199 - sig * 72, 40, 18, 0), c.secondary, c.accent, character.id + 'step-foot2', [10, 160, 95, 50], { count: 12, lineWidth: 5 });
    var lower = painter.roundedRectPath(-116, 28 + squat, 232, 112, 23);
    var middle = painter.roundedRectPath(-94, -54 + squat, 188, 91, 19);
    var head = painter.roundedRectPath(-69, -124 + squat, 138, 78, 27);
    painter.tactile(lower, c.primary, c.secondary, character.id + 'stoop1', [-120, 25, 240, 120], { count: 40 });
    painter.tactile(middle, c.primary, c.accent, character.id + 'stoop2', [-100, -60, 200, 100], { count: 35 });
    painter.tactile(head, c.secondary, c.primary, character.id + 'stoop3', [-75, -130, 150, 90], { count: 28 });
    painter.line([[-107, 44 + squat], [-164 - sig * 35, 69 - sig * 44]], c.ink, 28);
    painter.line([[107, 44 + squat], [164 + sig * 35, 69 - sig * 44]], c.ink, 28);
    painter.eye(-24, -83 + squat, 8, 0, inkOnly); painter.eye(24, -83 + squat, 8, 0, inkOnly);
  }

  function bodyToque(ctx, painter, character, phase, inkOnly, showSportProp) {
    var c = painter.palette(character, inkOnly);
    var sig = pulse(phase, .21, .39, .63);
    var drift = Math.sin(phase * TAU) * 25;
    ctx.translate(drift * .35, -sig * 56);
    painter.line([[-31, 101], [-52 - sig * 21, 193], [-71 - sig * 26, 220]], c.ink, 11);
    painter.line([[31, 101], [53 + sig * 20, 192], [73 + sig * 26, 220]], c.ink, 11);
    var sock = new Path2D();
    sock.moveTo(-74, 122); sock.bezierCurveTo(-92, 15, -54 + sig * 15, -98 - sig * 72, -12, -152 - sig * 46);
    sock.bezierCurveTo(35, -127 - sig * 50, 84, -26, 74, 122); sock.quadraticCurveTo(0, 153, -74, 122); sock.closePath();
    painter.tactile(sock, c.primary, c.secondary, character.id + 'toque', [-100, -225, 210, 380], { count: 62 });
    painter.tactile(painter.ellipsePath(-4, -160 - sig * 51, 32, 26, 0), c.accent, c.secondary, character.id + 'pom', [-45, -230, 90, 100], { count: 12, lineWidth: 4 });
    painter.line([[-67, -4], [-125 - sig * 45, 19 - sig * 42]], c.ink, 12);
    painter.line([[67, -4], [126 + sig * 58, -5 - sig * 82]], c.ink, 12);
    painter.eye(-18, -37 - sig * 20, 7, 1, inkOnly); painter.eye(19, -40 - sig * 20, 7, 1, inkOnly);
    if (!inkOnly && showSportProp !== false) painter.sportProp('basketball', { x: 151 + sig * 66, y: -43 - sig * 128, scale: .7, color: c.light });
  }

  function bodySugar(ctx, painter, character, phase, inkOnly) {
    var c = painter.palette(character, inkOnly);
    var sig = pulse(phase, .15, .39, .72);
    var slide = Math.sin(phase * TAU) * 15;
    ctx.translate(slide, sig * 23);
    painter.line([[-46, 110], [-77 - sig * 70, 190 - sig * 25]], c.ink, 12);
    painter.line([[46, 110], [77 + sig * 70, 190 - sig * 25]], c.ink, 12);
    painter.tactile(painter.ellipsePath(-91 - sig * 73, 196 - sig * 25, 38, 11, -.2), c.secondary, c.accent, character.id + 'blade1', [-210, 165, 150, 55], { count: 9, lineWidth: 4 });
    painter.tactile(painter.ellipsePath(91 + sig * 73, 196 - sig * 25, 38, 11, .2), c.secondary, c.accent, character.id + 'blade2', [60, 165, 150, 55], { count: 9, lineWidth: 4 });
    var leaf = new Path2D();
    leaf.moveTo(0, -150); leaf.bezierCurveTo(26, -112, 75 + sig * 87, -130, 71 + sig * 107, -63);
    leaf.bezierCurveTo(129 + sig * 30, -33, 116 + sig * 71, 54, 56, 68);
    leaf.bezierCurveTo(44, 129, -10, 158, -49, 106); leaf.bezierCurveTo(-128 - sig * 39, 92, -140 - sig * 70, 10, -82 - sig * 113, -28);
    leaf.bezierCurveTo(-88 - sig * 55, -96, -26, -108, 0, -150); leaf.closePath();
    painter.tactile(leaf, c.primary, c.accent, character.id + 'sugar', [-245, -160, 490, 330], { count: 78, textureAlpha: .11 });
    if (!inkOnly) {
      ctx.save(); ctx.strokeStyle = c.secondary; ctx.lineWidth = 5; ctx.globalAlpha = .72;
      ctx.beginPath(); ctx.moveTo(0, -137); ctx.bezierCurveTo(-5, -63, 5, 30, -27, 110); ctx.stroke(); ctx.restore();
    }
    painter.eye(-22, -37, 8, sig, inkOnly); painter.eye(22, -37, 8, sig, inkOnly);
  }

  function bodyLoon(ctx, painter, character, phase, inkOnly) {
    var c = painter.palette(character, inkOnly);
    var sig = pulse(phase, .23, .4, .58);
    var turn = -Math.sin(phase * TAU) * .13 - sig * .42;
    ctx.rotate(turn);
    painter.line([[-35, 103], [-67 + sig * 51, 205]], c.ink, 11);
    painter.line([[33, 111], [79 + sig * 82, 202]], c.ink, 11);
    painter.tactile(painter.ellipsePath(-70 + sig * 51, 211, 44, 10, -.14), c.accent, c.secondary, character.id + 'loonblade1', [-125, 185, 110, 45], { count: 8, lineWidth: 4 });
    painter.tactile(painter.ellipsePath(84 + sig * 82, 209, 44, 10, .14), c.accent, c.secondary, character.id + 'loonblade2', [35, 185, 160, 45], { count: 8, lineWidth: 4 });
    var crescent = new Path2D();
    crescent.moveTo(-19, -151); crescent.bezierCurveTo(103, -122, 129, -1, 55, 116);
    crescent.bezierCurveTo(7, 165, -96, 134, -110, 46); crescent.bezierCurveTo(-126, -54, -76, -132, -19, -151); crescent.closePath();
    painter.tactile(crescent, c.secondary, c.primary, character.id + 'loon', [-135, -160, 275, 330], { count: 67 });
    var cutout = painter.ellipsePath(22, -15, 58, 94, -.24);
    ctx.save(); ctx.fillStyle = inkOnly ? c.ink : '#171914'; ctx.fill(cutout); ctx.restore();
    painter.tactile(painter.polygonPath([[55, -101], [167 + sig * 30, -62], [67, -39]]), c.accent, c.primary, character.id + 'beak', [50, -110, 155, 80], { count: 12, lineWidth: 4 });
    painter.eye(44, -76, 7, 1, inkOnly);
  }

  function bodyAlebrije(ctx, painter, character, phase, inkOnly, showSportProp) {
    var c = painter.palette(character, inkOnly);
    var sig = pulse(phase, .18, .46, .66);
    var hover = pulse(phase, .08, .31, .45);
    ctx.translate(0, -hover * 26);
    ctx.rotate(-sig * .54 + Math.sin(phase * TAU) * .06);
    painter.line([[-54, 74], [-98 - sig * 33, 167], [-123 - sig * 42, 196]], c.ink, 12);
    painter.line([[48, 80], [93 + sig * 27, 166], [121 + sig * 52, 196]], c.ink, 12);
    painter.tactile(painter.ellipsePath(-126 - sig * 42, 201, 39, 13, -.12), c.secondary, c.accent, character.id + 'alefoot1', [-210, 175, 130, 55], { count: 10, lineWidth: 4 });
    painter.tactile(painter.ellipsePath(126 + sig * 52, 201, 39, 13, .12), c.secondary, c.accent, character.id + 'alefoot2', [75, 175, 150, 55], { count: 10, lineWidth: 4 });
    painter.tactile(painter.ellipsePath(0, 41, 93, 101, -.15), c.primary, c.accent, character.id + 'ale-body', [-105, -70, 210, 220], { count: 55 });
    painter.tactile(painter.ellipsePath(25, -99, 69, 57, .16), c.secondary, c.primary, character.id + 'ale-head', [-60, -165, 160, 130], { count: 38 });
    painter.tactile(painter.polygonPath([[-14, -139], [-42, -205], [19, -157]]), c.accent, c.secondary, character.id + 'ear1', [-50, -210, 80, 90], { count: 9, lineWidth: 4 });
    painter.tactile(painter.polygonPath([[52, -139], [102, -188], [83, -118]]), c.accent, c.secondary, character.id + 'ear2', [45, -200, 70, 90], { count: 9, lineWidth: 4 });
    painter.line([[-78, 5], [-139, -16], [-164 + sig * 79, -81 - sig * 57]], c.ink, 11);
    painter.line([[81, 10], [135, 45], [156, 80]], c.ink, 11);
    painter.eye(3, -104, 8, sig, inkOnly); painter.eye(43, -98, 8, sig, inkOnly);
    if (!inkOnly && showSportProp !== false) painter.sportProp('baseball', { x: -177 + sig * 81, y: -99 - sig * 64, scale: .78, color: c.light });
  }

  function bodyCane(ctx, painter, character, phase, inkOnly) {
    var c = painter.palette(character, inkOnly);
    var sig = pulse(phase, .24, .47, .69);
    var melt = Math.sin(phase * TAU) * .06 - (1 - sig) * .05;
    ctx.rotate(melt + sig * .52);
    painter.line([[-42, 107], [-62, 198]], c.ink, 18);
    painter.line([[42, 107], [78, 197]], c.ink, 18);
    painter.tactile(painter.ellipsePath(-67, 204, 37, 14, -.12), c.secondary, c.accent, character.id + 'canefoot1', [-115, 180, 100, 45], { count: 10, lineWidth: 4 });
    painter.tactile(painter.ellipsePath(84, 204, 37, 14, .12), c.secondary, c.accent, character.id + 'canefoot2', [30, 180, 110, 45], { count: 10, lineWidth: 4 });
    var bale = new Path2D();
    bale.moveTo(-82, -128); bale.bezierCurveTo(-127, -83, -112, 91, -78, 128);
    bale.quadraticCurveTo(-7, 159, 78, 129); bale.bezierCurveTo(120, 87, 119, -91, 68, -130); bale.closePath();
    painter.tactile(bale, c.primary, c.secondary, character.id + 'cane', [-130, -140, 260, 300], { count: 76, textureAlpha: .18 });
    if (!inkOnly) {
      ctx.save(); ctx.strokeStyle = c.accent; ctx.globalAlpha = .68; ctx.lineWidth = 6;
      [-61, -22, 19, 59].forEach(function (x) { ctx.beginPath(); ctx.moveTo(x, -119); ctx.quadraticCurveTo(x * 1.3, 0, x, 123); ctx.stroke(); }); ctx.restore();
    }
    painter.line([[57, -53], [111 + sig * 56, -75 - sig * 29]], c.ink, 14);
    ctx.save(); ctx.translate(127 + sig * 72, -89 - sig * 35); ctx.rotate(-.35 - sig * 1.78); ctx.fillStyle = c.accent; ctx.strokeStyle = c.ink; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.roundRect(-9, -116, 18, 150, 9); ctx.fill(); ctx.stroke(); ctx.restore();
    painter.line([[-63, -50], [-112, -18]], c.ink, 14);
    painter.eye(-23, -58, 8, sig, inkOnly); painter.eye(20, -60, 8, sig, inkOnly);
  }

  function bodyGong(ctx, painter, character, phase, inkOnly) {
    var c = painter.palette(character, inkOnly);
    var sig = pulse(phase, .2, .43, .68);
    var toll = Math.sin(phase * TAU) * .04 + sig * .18;
    ctx.rotate(toll);
    painter.line([[-31, 108], [-50 - sig * 24, 194]], c.ink, 20);
    painter.line([[31, 108], [54 + sig * 40, 194]], c.ink, 20);
    painter.tactile(painter.ellipsePath(-57 - sig * 24, 201, 35, 16, -.1), c.secondary, c.accent, character.id + 'gongfoot1', [-115, 175, 100, 55], { count: 11, lineWidth: 4 });
    painter.tactile(painter.ellipsePath(61 + sig * 40, 201, 35, 16, .1), c.secondary, c.accent, character.id + 'gongfoot2', [15, 175, 130, 55], { count: 11, lineWidth: 4 });
    var lobes = [painter.ellipsePath(-55, 18, 70, 111, -.2), painter.ellipsePath(55, 18, 70, 111, .2), painter.ellipsePath(0, -55, 73, 112, 0)];
    lobes.forEach(function (path, index) { painter.tactile(path, index === 2 ? c.primary : c.secondary, c.accent, character.id + 'gong' + index, [-140, -180, 280, 330], { count: 30, lineWidth: 4 }); });
    painter.tactile(painter.ellipsePath(0, 26, 36, 31, 0), c.accent, c.secondary, character.id + 'gongboss', [-45, -15, 90, 85], { count: 11, lineWidth: 4 });
    painter.line([[-104, -12], [-155 - sig * 16, 35], [-183 - sig * 31, 22]], c.ink, 17);
    painter.line([[103, -13], [146 + sig * 76, -31 - sig * 18], [185 + sig * 100, -17 - sig * 9]], c.ink, 17);
    painter.tactile(painter.ellipsePath(195 + sig * 104, -17 - sig * 9, 31, 26, 0), c.primary, c.accent, character.id + 'gongglove', [150, -60, 180, 90], { count: 12, lineWidth: 5 });
    painter.eye(-22, -81, 8, sig, inkOnly); painter.eye(21, -81, 8, sig, inkOnly);
  }

  function bodyRice(ctx, painter, character, phase, inkOnly) {
    var c = painter.palette(character, inkOnly);
    var cycle = phase * 6;
    var chatter = pulse(cycle % 1, .05, .25, .52) * (phase > .13 && phase < .72 ? 1 : 0);
    var sig = pulse(phase, .14, .48, .75);
    var slip = Math.sin(phase * TAU * 2) * 15 * sig;
    ctx.translate(slip, -Math.abs(Math.sin(phase * TAU * 3)) * 8 * sig);
    painter.line([[-35, 105], [-71 - sig * 24, 192]], c.ink, 11);
    painter.line([[35, 105], [72 + sig * 28, 192]], c.ink, 11);
    painter.tactile(painter.ellipsePath(-77 - sig * 24, 200, 35, 12, -.16), c.secondary, c.accent, character.id + 'ricefoot1', [-135, 175, 115, 50], { count: 8, lineWidth: 4 });
    painter.tactile(painter.ellipsePath(78 + sig * 28, 200, 35, 12, .16), c.secondary, c.accent, character.id + 'ricefoot2', [25, 175, 125, 50], { count: 8, lineWidth: 4 });
    var parcel = new Path2D();
    parcel.moveTo(0, -148); parcel.bezierCurveTo(94, -166, 112, -56, 79, 11);
    parcel.bezierCurveTo(101, 84, 49, 147, 0, 145); parcel.bezierCurveTo(-49, 147, -101, 84, -79, 11); parcel.bezierCurveTo(-112, -56, -94, -166, 0, -148); parcel.closePath();
    painter.tactile(parcel, c.primary, c.secondary, character.id + 'rice', [-120, -170, 240, 330], { count: 61 });
    if (!inkOnly) {
      ctx.save(); ctx.strokeStyle = c.accent; ctx.lineWidth = 5; ctx.globalAlpha = .8;
      ctx.beginPath(); ctx.moveTo(-70, -86); ctx.lineTo(72, 92); ctx.moveTo(70, -86); ctx.lineTo(-72, 92); ctx.stroke(); ctx.restore();
    }
    for (var side = -1; side <= 1; side += 2) {
      var reach = 117 + chatter * 85 + sig * 18;
      painter.line([[side * 74, -12], [side * reach, -49 + side * Math.sin(cycle * TAU) * 22]], c.ink, 12);
      painter.tactile(painter.ellipsePath(side * (reach + 18), -49 + side * Math.sin(cycle * TAU) * 22, 25, 20, 0), c.accent, c.secondary, character.id + 'riceglove' + side, [side < 0 ? -250 : 100, -100, 150, 100], { count: 10, lineWidth: 4 });
    }
    painter.eye(-20, -54, 7, chatter, inkOnly); painter.eye(20, -54, 7, chatter, inkOnly);
  }

  function bodyGumbo(ctx, painter, character, phase, inkOnly, showSportProp) {
    var c = painter.palette(character, inkOnly);
    var sig = pulse(phase, .2, .44, .67);
    var sway = Math.sin(phase * TAU) * .09;
    ctx.rotate(sway - sig * .2);
    painter.line([[-43, 111], [-70, 199]], c.ink, 22);
    painter.line([[43, 111], [79 + sig * 17, 198]], c.ink, 22);
    painter.tactile(painter.ellipsePath(-76, 205, 42, 17, -.1), c.secondary, c.accent, character.id + 'gumbofoot1', [-130, 180, 110, 55], { count: 11, lineWidth: 4 });
    painter.tactile(painter.ellipsePath(85 + sig * 17, 205, 42, 17, .1), c.secondary, c.accent, character.id + 'gumbofoot2', [30, 180, 130, 55], { count: 11, lineWidth: 4 });
    var pear = new Path2D();
    pear.moveTo(0, -129); pear.bezierCurveTo(66, -127, 72, -55, 88, -13); pear.bezierCurveTo(147, 93, 80, 151, 0, 151); pear.bezierCurveTo(-80, 151, -147, 93, -88, -13); pear.bezierCurveTo(-72, -55, -66, -127, 0, -129); pear.closePath();
    painter.tactile(pear, c.primary, c.secondary, character.id + 'gumbo', [-150, -140, 300, 310], { count: 73 });
    if (!inkOnly) {
      ctx.save(); ctx.strokeStyle = c.accent; ctx.lineWidth = 6; ctx.globalAlpha = .8;
      for (var fringe = -65; fringe <= 65; fringe += 22) { ctx.beginPath(); ctx.moveTo(fringe, -21); ctx.quadraticCurveTo(fringe + 11, 40, fringe - 2, 94); ctx.stroke(); } ctx.restore();
    }
    painter.tactile(painter.roundedRectPath(-39, -187, 78, 65, 13), c.secondary, c.accent, character.id + 'gumbostamp', [-50, -195, 100, 80], { count: 17, lineWidth: 4 });
    painter.line([[-94, -25], [-164, -49], [-188 + sig * 91, -93 - sig * 15]], c.ink, 18);
    painter.line([[94, -26], [158 + sig * 64, -70 - sig * 77]], c.ink, 18);
    painter.tactile(painter.ellipsePath(172 + sig * 69, -76 - sig * 82, 39, 24, -.35), c.accent, c.secondary, character.id + 'gumbopaddle', [120, -180, 190, 150], { count: 12, lineWidth: 5 });
    painter.eye(-16, -158, 7, sig, inkOnly); painter.eye(16, -158, 7, sig, inkOnly);
    if (!inkOnly && showSportProp !== false) painter.sportProp('american-football', { x: -215 + sig * 99, y: -101 - sig * 16, scale: .7, color: c.light });
  }

  function bodyPeach(ctx, painter, character, phase, inkOnly) {
    var c = painter.palette(character, inkOnly);
    var sig = pulse(phase, .17, .45, .69);
    var charge = easeOut(clamp((phase - .21) / .28, 0, 1)) * (phase < .72 ? 1 : 0);
    ctx.translate(sig * 48, 0);
    ctx.rotate(-sig * .32);
    painter.line([[-39, 105], [-69 - charge * 39, 198]], c.ink, 16);
    painter.line([[39, 105], [79 + charge * 56, 196]], c.ink, 16);
    painter.tactile(painter.ellipsePath(-76 - charge * 39, 204, 38, 14, -.15), c.secondary, c.accent, character.id + 'peachfoot1', [-175, 180, 125, 50], { count: 9, lineWidth: 4 });
    painter.tactile(painter.ellipsePath(86 + charge * 56, 203, 38, 14, .15), c.secondary, c.accent, character.id + 'peachfoot2', [40, 180, 170, 50], { count: 9, lineWidth: 4 });
    painter.tactile(painter.ellipsePath(-46 - sig * 9, -3, 82 + sig * 14, 139, -.13), c.primary, c.secondary, character.id + 'peachleft', [-150, -150, 180, 310], { count: 45 });
    painter.tactile(painter.ellipsePath(47 + sig * 9, -3, 82 + sig * 14, 139, .13), c.primary, c.accent, character.id + 'peachright', [-20, -150, 180, 310], { count: 45 });
    painter.tactile(painter.ellipsePath(0, 17, 37 + sig * 16, 58 + sig * 19, 0), c.secondary, c.accent, character.id + 'pit', [-55, -60, 110, 150], { count: 18, lineWidth: 5 });
    painter.line([[-109, -25], [-162 - charge * 30, -2]], c.ink, 16);
    painter.line([[109, -25], [174 + charge * 65, 12]], c.ink, 16);
    painter.tactile(painter.ellipsePath(185 + charge * 69, 15, 35, 28, 0), c.accent, c.secondary, character.id + 'peachhand', [140, -35, 180, 100], { count: 12, lineWidth: 5 });
    ctx.save(); ctx.strokeStyle = c.ink; ctx.lineWidth = 13; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -139); ctx.quadraticCurveTo(7, -187, 42, -196); ctx.stroke(); ctx.restore();
    painter.eye(-28, -66, 8, sig, inkOnly); painter.eye(29, -66, 8, sig, inkOnly);
  }

  var BODY_RENDERERS = Object.create(null);
  BODY_RENDERERS.kite = bodyKite;
  BODY_RENDERERS.lantern = bodyLantern;
  BODY_RENDERERS.stoop = bodyStoop;
  BODY_RENDERERS.toque = bodyToque;
  BODY_RENDERERS.sugar = bodySugar;
  BODY_RENDERERS.loon = bodyLoon;
  BODY_RENDERERS.alebrije = bodyAlebrije;
  BODY_RENDERERS.cane = bodyCane;
  BODY_RENDERERS.gong = bodyGong;
  BODY_RENDERERS.rice = bodyRice;
  BODY_RENDERERS.gumbo = bodyGumbo;
  BODY_RENDERERS.peach = bodyPeach;

  function draw(ctx, descriptor, options) {
    if (!validContext(ctx) || !isPrepared(descriptor)) return null;
    options = options && typeof options === 'object' ? options : {};
    var x = Number(options.x);
    var y = Number(options.y);
    var scale = Number(options.scale);
    var rotation = Number(options.rotation);
    var alpha = Number(options.alpha);
    var phase = normalizePhase(options.phase);
    x = Number.isFinite(x) ? x : 0;
    y = Number.isFinite(y) ? y : 0;
    scale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    rotation = Number.isFinite(rotation) ? rotation : 0;
    alpha = Number.isFinite(alpha) ? clamp(alpha, 0, 1) : 1;
    var inkOnly = options.inkOnly === true;
    var shadow = options.shadow !== false;
    var showSportProp = options.sportProp !== false;
    var renderer = BODY_RENDERERS[descriptor.bodyKey];
    if (!renderer) return null;
    var painter = painterFor(ctx);
    var character = { id: descriptor.athleteId, colors: descriptor.colors };
    ctx.save();
    try {
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      if (rotation) ctx.rotate(rotation);
      if (alpha !== 1) ctx.globalAlpha *= alpha;
      if (!inkOnly && shadow) {
        ctx.save();
        try {
          ctx.fillStyle = 'rgba(0,0,0,.28)';
          ctx.beginPath(); ctx.ellipse(0, 220, 113, 20, 0, 0, TAU); ctx.fill();
        } finally {
          ctx.restore();
        }
      }
      renderer(ctx, painter, character, phase, inkOnly, showSportProp);
    } finally {
      ctx.restore();
    }
    return describe(descriptor, phase, options.surface, { x: x, y: y, scale: scale, rotation: rotation, alpha: alpha });
  }

  function drawFit(ctx, descriptor, frame, options) {
    if (!isPrepared(descriptor)) return null;
    options = options && typeof options === 'object' ? options : {};
    var transform = fit(frame, { padding: options.padding, bounds: options.bounds });
    if (!transform) return null;
    var drawOptions = {};
    Object.keys(options).forEach(function (key) { drawOptions[key] = options[key]; });
    drawOptions.x = transform.x;
    drawOptions.y = transform.y;
    drawOptions.scale = transform.scale;
    if (!draw(ctx, descriptor, drawOptions)) return null;
    return transform;
  }

  function drawSportProp(ctx, sportId, options) {
    if (!validContext(ctx) || ['soccer', 'basketball', 'hockey', 'baseball', 'combat', 'american-football'].indexOf(sportId) === -1) return false;
    painterFor(ctx).sportProp(sportId, options);
    return true;
  }

  var API = {
    version: VERSION,
    durationMs: DURATION_MS,
    showcasePhase: SHOWCASE_PHASE,
    bodyKeys: BODY_KEYS,
    bounds: BOUNDS,
    descriptors: DESCRIPTORS,
    prepare: prepare,
    describe: describe,
    fit: fit,
    draw: draw,
    drawFit: drawFit,
    drawSportProp: drawSportProp
  };

  return Object.freeze(API);
});
