(function () {
  'use strict';

  var CONTENT = window.CYBERLIGA_CONTENT;
  var DURATION = 4800;
  var LOGICAL_WIDTH = 1200;
  var LOGICAL_HEIGHT = 800;
  var TAU = Math.PI * 2;

  var SPECS = [
    {
      id: 'tokyo-paper-cranes-a1', teamId: 'tokyo-paper-cranes', sportId: 'soccer', body: 'kite',
      bodyFamily: 'four-point folding sail', motionName: 'The Angle Swallow',
      gift: 'Expands sideways after the shot has already chosen a corner.',
      flaw: 'One concession turns every crease inward for the next three minutes.',
      story: 'Protecting a five-match clean-sheet streak while hiding a torn left seam.',
      rivalry: 'Glim keeps aiming at the damaged seam—and smiling before the kick.',
      materials: ['creased washi', 'soft foam', 'knotted cord'],
      reaction: 'compress → inhale → impossible lateral bloom'
    },
    {
      id: 'osaka-lanterns-a4', teamId: 'osaka-lanterns', sportId: 'soccer', body: 'lantern',
      bodyFamily: 'suspended paper pendulum', motionName: 'The Wick Switch',
      gift: 'Lets momentum swing past the defender, then hops the other way.',
      flaw: 'Cannot resist one extra feint when the simple pass would end the argument.',
      story: 'A beloved show-off trying to make the decisive play before being benched.',
      rivalry: 'Kite has never moved for Wick’s first feint. Wick takes this personally.',
      materials: ['rice paper', 'warm cork', 'cotton wick'],
      reaction: 'slow swing → false stop → tiny violent hop'
    },
    {
      id: 'new-york-brownstones-a1', teamId: 'new-york-brownstones', sportId: 'basketball', body: 'stoop',
      bodyFamily: 'stacked cork doorstep', motionName: 'The Stoop Drop',
      gift: 'Turns a low center of gravity into a moving piece of architecture.',
      flaw: 'Heavy squared landings make the second jump arrive one beat late.',
      story: 'The league’s oldest rim keeper is daring the rookies to move the building.',
      rivalry: 'Flurry says every stoop cracks eventually. New York has the quote framed.',
      materials: ['brick foam', 'worn leather', 'coil rubber'],
      reaction: 'three stair-steps → dead stop → whole block rises'
    },
    {
      id: 'toronto-lake-effect-a4', teamId: 'toronto-lake-effect', sportId: 'basketball', body: 'toque',
      bodyFamily: 'inverted snow-sock ribbon', motionName: 'The Whiteout Release',
      gift: 'Unspools upward and releases the ball before the body looks set.',
      flaw: 'Disappears inside the same drifting screens that create the open shot.',
      story: 'Chasing the distance record during a week when the touch has gone cold.',
      rivalry: 'Stoopy refuses to close out, turning every jumper into a public dare.',
      materials: ['quilted nylon', 'frost fleece', 'blue thread'],
      reaction: 'drift → knot → six-foot vertical unspooling'
    },
    {
      id: 'montreal-sugar-maples-a1', teamId: 'montreal-sugar-maples', sportId: 'hockey', body: 'sugar',
      bodyFamily: 'flattened syrup fortress', motionName: 'The Sugar Seal',
      gift: 'Liquefies into gaps that should be too small, then hardens on the puck.',
      flaw: 'Every frantic recovery leaves a sticky edge on the next movement.',
      story: 'One shutout from a club record, with the whole city counting aloud.',
      rivalry: 'Mossbeak waits at the far post until Sucre commits to becoming a wall.',
      materials: ['boiled sugar', 'wool batting', 'maple felt'],
      reaction: 'slow syrup slide → leaf-wide splat → brittle snap-back'
    },
    {
      id: 'reykjavik-lava-loons-a4', teamId: 'reykjavik-lava-loons', sportId: 'hockey', body: 'loon',
      bodyFamily: 'pumice crescent skimmer', motionName: 'The Caldera Cut',
      gift: 'Glides without a readable stride, then changes edge like a fault line.',
      flaw: 'Volcanic cuts spend all available balance; the landing is somebody else’s problem.',
      story: 'Returning from a spectacular crash and insisting the route was correct.',
      rivalry: 'Sucre calls the far post closed. Mossbeak calls it an invitation.',
      materials: ['pumice foam', 'slick felt', 'birch runner'],
      reaction: 'glacial crescent → beak fake → volcanic edge cut'
    },
    {
      id: 'mexico-city-alebrijes-a1', teamId: 'mexico-city-alebrijes', sportId: 'baseball', body: 'alebrije',
      bodyFamily: 'two-sphere painted chimera', motionName: 'The Vanishing Tempo',
      gift: 'The windup changes speed three times without changing its destination.',
      flaw: 'Treats every runner as an audience and every audience as a challenge.',
      story: 'A perfect-game bid keeps colliding with the need to make the pitch beautiful.',
      rivalry: 'Dulce Leo has stopped watching the ball and started watching the pauses.',
      materials: ['carved copal', 'matte paint', 'braided rope'],
      reaction: 'skip → hover → many-animal corkscrew release'
    },
    {
      id: 'havana-sugar-kings-a4', teamId: 'havana-sugar-kings', sportId: 'baseball', body: 'cane',
      bodyFamily: 'soft cane-bale batter', motionName: 'The Caramel Snap',
      gift: 'Stores an entire swing in a lazy sag, then hardens at contact.',
      flaw: 'Will chase any pitch that looks disrespectful enough.',
      story: 'A home-run drought has made every quiet at-bat louder than the last.',
      rivalry: 'Coyote Pez keeps adding pauses. Dulce Leo keeps promising not to blink.',
      materials: ['raw cane fiber', 'sun cotton', 'caramel resin'],
      reaction: 'sleepy melt → sudden sugar crystal → dent in evening'
    },
    {
      id: 'accra-brass-bell-a1', teamId: 'accra-brass-bell', sportId: 'combat', body: 'gong',
      bodyFamily: 'three-lobed hanging bell', motionName: 'The Market Toll',
      gift: 'Every measured step makes the ring feel one rope smaller.',
      flaw: 'Once the bell starts moving forward, it cannot hear the counter coming.',
      story: 'Fighting for a final title run while the younger gym asks for the keys.',
      rivalry: 'Sticky Rice does not back up; the leaf simply folds somewhere else.',
      materials: ['hammered brass', 'braided rope', 'market cloth'],
      reaction: 'shoulder roll → rope-tight pause → room-shaking toll'
    },
    {
      id: 'bangkok-banana-leaf-a4', teamId: 'bangkok-banana-leaf', sportId: 'combat', body: 'rice',
      bodyFamily: 'leaf-wrapped spring parcel', motionName: 'The Six-Punch Fold',
      gift: 'Folds away from a punch and returns from six slightly different angles.',
      flaw: 'The seventh punch is always vanity and often a terrible idea.',
      story: 'An undefeated swarmer learning that the crowd now expects impossibility.',
      rivalry: 'Auntie Gong needs one clean toll. Sticky Rice offers seven chances.',
      materials: ['waxed leaf', 'kapok fill', 'rice cord'],
      reaction: 'leaf slip → elastic chatter → smug final fold'
    },
    {
      id: 'new-orleans-bayou-kings-a1', teamId: 'new-orleans-bayou-kings', sportId: 'american-football', body: 'gumbo',
      bodyFamily: 'moss-fringed bayou pear', motionName: 'The Roux Roll',
      gift: 'Holds the defense in a slow simmer, then throws into the space it abandons.',
      flaw: 'Refuses to throw the ball away when the play still has flavor.',
      story: 'One drive from the division crown, behind an offensive line held together by tape.',
      rivalry: 'Peach Tree Pete knows the recipe and keeps arriving before the boil.',
      materials: ['moss fringe', 'swamp rubber', 'deep velvet'],
      reaction: 'bayou sway → paddle pump → brass-band release'
    },
    {
      id: 'atlanta-peaches-a4', teamId: 'atlanta-peaches', sportId: 'american-football', body: 'peach',
      bodyFamily: 'split-fruit front porch', motionName: 'The Pit Turn',
      gift: 'Looks soft in the route and becomes a stone exactly at the collision.',
      flaw: 'The hard finish is so satisfying that route discipline occasionally disappears.',
      story: 'A former blocker has one afternoon to prove the hands deserve headlines.',
      rivalry: 'Gumbo Gene throws receivers open. Pete wants to close the whole porch.',
      materials: ['peach flock', 'quilt cotton', 'pit cork'],
      reaction: 'fuzz-soft release → fruit splits → pit-hard finish'
    }
  ];

  var SPORT_LABELS = {
    all: 'All twelve',
    soccer: 'Soccer',
    basketball: 'Basketball',
    hockey: 'Hockey',
    baseball: 'Baseball',
    combat: 'Combat',
    'american-football': 'American football'
  };

  var canvas = document.getElementById('character-canvas');
  var ctx = canvas && canvas.getContext('2d');
  var stageCard = document.getElementById('stage-card');
  var rosterList = document.getElementById('roster-list');
  var filters = document.getElementById('sport-filters');
  var scrubber = document.getElementById('scrubber');
  var timecode = document.getElementById('timecode');
  var transportToggle = document.getElementById('transport-toggle');
  var restartButton = document.getElementById('restart-motion');
  var signatureButton = document.getElementById('signature-trigger');
  var copyButton = document.getElementById('copy-link');

  if (!CONTENT || !canvas || !ctx || !rosterList || !filters) {
    document.body.dataset.ready = 'error';
    throw new Error('Cyberliga character lab could not initialize its content or canvas.');
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function easeOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function pulse(phase, start, peak, end) {
    if (phase <= start || phase >= end) return 0;
    if (phase < peak) return ease((phase - start) / (peak - start));
    return 1 - ease((phase - peak) / (end - peak));
  }
  function hash(text) {
    var value = String(text || 'character-lab');
    var result = 2166136261 >>> 0;
    for (var i = 0; i < value.length; i += 1) {
      result ^= value.charCodeAt(i);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  }
  function randomFor(seed) {
    var stateValue = hash(seed);
    return function () {
      stateValue += 0x6D2B79F5;
      var t = stateValue;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function roundedRectPath(x, y, width, height, radius) {
    var path = new Path2D();
    path.roundRect(x, y, width, height, radius);
    return path;
  }
  function polygonPath(points) {
    var path = new Path2D();
    path.moveTo(points[0][0], points[0][1]);
    for (var i = 1; i < points.length; i += 1) path.lineTo(points[i][0], points[i][1]);
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
    for (var i = 0; i < count; i += 1) {
      var x = bounds[0] + random() * bounds[2];
      var y = bounds[1] + random() * bounds[3];
      if (i % 3 === 0) {
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
    for (var i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
    ctx.restore();
  }
  function palette(character, inkOnly) {
    if (inkOnly) return { primary: '#080906', secondary: '#080906', accent: '#080906', ink: '#080906', light: '#080906' };
    return {
      primary: character.team.colors.primary,
      secondary: character.team.colors.secondary,
      accent: character.team.colors.accent,
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
  function sportProp(sportId, x, y, scale, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (sportId === 'soccer') {
      ctx.fillStyle = '#f5f0e6'; ctx.strokeStyle = '#151612'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#151612';
      for (var a = 0; a < 5; a += 1) {
        var angle = a * TAU / 5 - Math.PI / 2;
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
    } else {
      ctx.fillStyle = '#7c4a2f'; ctx.strokeStyle = '#f2e9dc'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 0, 32, 19, -.42, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#f2e9dc'; ctx.lineWidth = 2;
      for (var s = -12; s <= 12; s += 8) { ctx.beginPath(); ctx.moveTo(s - 7, -11); ctx.lineTo(s + 7, 11); ctx.stroke(); }
    }
    ctx.restore();
  }

  function bodyKite(character, phase, inkOnly) {
    var c = palette(character, inkOnly);
    var sig = pulse(phase, .16, .38, .67);
    var inhale = Math.sin(phase * TAU) * .04;
    line([[-48, 13], [-105 - sig * 46, 54 - sig * 31], [-139 - sig * 48, 36]], c.ink, 13);
    line([[48, 13], [105 + sig * 46, 54 - sig * 31], [139 + sig * 48, 36]], c.ink, 13);
    tactile(ellipsePath(-142 - sig * 48, 36, 20 + sig * 15, 17 + sig * 15, 0), c.accent, c.light, character.id + 'hand1', [-180, 0, 70, 70], { count: 12, lineWidth: 4 });
    tactile(ellipsePath(142 + sig * 48, 36, 20 + sig * 15, 17 + sig * 15, 0), c.accent, c.light, character.id + 'hand2', [110, 0, 70, 70], { count: 12, lineWidth: 4 });
    line([[-29, 126], [-45 - sig * 18, 184], [-77 - sig * 36, 218]], c.ink, 15);
    line([[29, 126], [45 + sig * 18, 184], [77 + sig * 36, 218]], c.ink, 15);
    var body = polygonPath([[0, -139], [94 + sig * 49, 7], [0, 150 - sig * 15], [-94 - sig * 49, 7]]);
    tactile(body, c.primary, c.secondary, character.id + 'kite', [-145, -145, 290, 300], { count: 66 });
    ctx.save(); ctx.strokeStyle = c.accent; ctx.lineWidth = inkOnly ? 0 : 5;
    ctx.beginPath(); ctx.moveTo(0, -128); ctx.lineTo(0, 133); ctx.moveTo(-82 - sig * 40, 7); ctx.lineTo(82 + sig * 40, 7); ctx.stroke(); ctx.restore();
    tactile(polygonPath([[-17, -142], [7, -198], [31, -139]]), c.accent, c.secondary, character.id + 'fin', [-20, -205, 55, 70], { count: 8, lineWidth: 4 });
    eye(-21, -31 + inhale * 20, 8, sig, inkOnly); eye(21, -31 + inhale * 20, 8, sig, inkOnly);
  }

  function bodyLantern(character, phase, inkOnly) {
    var c = palette(character, inkOnly);
    var sig = pulse(phase, .22, .43, .65);
    var swing = Math.sin(phase * TAU) * .28 + sig * .46;
    ctx.rotate(swing);
    line([[0, -222], [0, -151]], c.ink, 8);
    line([[-34, 126], [-16 + sig * 62, 196]], c.ink, 12);
    line([[34, 126], [54 + sig * 66, 182]], c.ink, 12);
    tactile(ellipsePath(-16 + sig * 62, 204, 27, 12, .1), c.secondary, c.accent, character.id + 'shoe1', [-60, 180, 120, 45], { count: 9, lineWidth: 4 });
    tactile(ellipsePath(55 + sig * 67, 190, 27, 12, .1), c.secondary, c.accent, character.id + 'shoe2', [10, 160, 120, 50], { count: 9, lineWidth: 4 });
    var lantern = new Path2D();
    lantern.moveTo(-56, -138); lantern.bezierCurveTo(-116, -92, -119, 77, -59, 135);
    lantern.quadraticCurveTo(0, 164, 59, 135); lantern.bezierCurveTo(119, 77, 116, -92, 56, -138); lantern.closePath();
    tactile(lantern, c.primary, c.accent, character.id + 'lantern', [-120, -140, 240, 300], { count: 58 });
    if (!inkOnly) {
      ctx.save(); ctx.strokeStyle = c.secondary; ctx.globalAlpha = .7; ctx.lineWidth = 4;
      [-67, -34, 0, 34, 67].forEach(function (x) { ctx.beginPath(); ctx.moveTo(x * .75, -125); ctx.quadraticCurveTo(x * 1.3, 0, x * .75, 128); ctx.stroke(); });
      ctx.restore();
    }
    tactile(roundedRectPath(-46, -159, 92, 24, 8), c.secondary, c.accent, character.id + 'cap', [-50, -165, 100, 35], { count: 8, lineWidth: 4 });
    ctx.save(); ctx.fillStyle = c.accent; ctx.beginPath(); ctx.ellipse(0, 82, 12, 28, 0, 0, TAU); ctx.fill(); ctx.restore();
    eye(-24, -52, 7, sig, inkOnly); eye(24, -52, 7, sig, inkOnly);
  }

  function bodyStoop(character, phase, inkOnly) {
    var c = palette(character, inkOnly);
    var sig = pulse(phase, .18, .41, .68);
    var squat = Math.sin(phase * TAU) * 6 + sig * 28;
    line([[-55, 95], [-69, 145 + squat], [-54, 183 - sig * 70]], c.ink, 25);
    line([[55, 95], [69, 145 + squat], [54, 183 - sig * 70]], c.ink, 25);
    tactile(ellipsePath(-57, 199 - sig * 72, 40, 18, 0), c.secondary, c.accent, character.id + 'step-foot1', [-105, 160, 95, 50], { count: 12, lineWidth: 5 });
    tactile(ellipsePath(57, 199 - sig * 72, 40, 18, 0), c.secondary, c.accent, character.id + 'step-foot2', [10, 160, 95, 50], { count: 12, lineWidth: 5 });
    var lower = roundedRectPath(-116, 28 + squat, 232, 112, 23);
    var middle = roundedRectPath(-94, -54 + squat, 188, 91, 19);
    var head = roundedRectPath(-69, -124 + squat, 138, 78, 27);
    tactile(lower, c.primary, c.secondary, character.id + 'stoop1', [-120, 25, 240, 120], { count: 40 });
    tactile(middle, c.primary, c.accent, character.id + 'stoop2', [-100, -60, 200, 100], { count: 35 });
    tactile(head, c.secondary, c.primary, character.id + 'stoop3', [-75, -130, 150, 90], { count: 28 });
    line([[-107, 44 + squat], [-164 - sig * 35, 69 - sig * 44]], c.ink, 28);
    line([[107, 44 + squat], [164 + sig * 35, 69 - sig * 44]], c.ink, 28);
    eye(-24, -83 + squat, 8, 0, inkOnly); eye(24, -83 + squat, 8, 0, inkOnly);
  }

  function bodyToque(character, phase, inkOnly) {
    var c = palette(character, inkOnly);
    var sig = pulse(phase, .21, .39, .63);
    var drift = Math.sin(phase * TAU) * 25;
    ctx.translate(drift * .35, -sig * 56);
    line([[-31, 101], [-52 - sig * 21, 193], [-71 - sig * 26, 220]], c.ink, 11);
    line([[31, 101], [53 + sig * 20, 192], [73 + sig * 26, 220]], c.ink, 11);
    var sock = new Path2D();
    sock.moveTo(-74, 122); sock.bezierCurveTo(-92, 15, -54 + sig * 15, -98 - sig * 72, -12, -152 - sig * 46);
    sock.bezierCurveTo(35, -127 - sig * 50, 84, -26, 74, 122); sock.quadraticCurveTo(0, 153, -74, 122); sock.closePath();
    tactile(sock, c.primary, c.secondary, character.id + 'toque', [-100, -225, 210, 380], { count: 62 });
    tactile(ellipsePath(-4, -160 - sig * 51, 32, 26, 0), c.accent, c.secondary, character.id + 'pom', [-45, -230, 90, 100], { count: 12, lineWidth: 4 });
    line([[-67, -4], [-125 - sig * 45, 19 - sig * 42]], c.ink, 12);
    line([[67, -4], [126 + sig * 58, -5 - sig * 82]], c.ink, 12);
    eye(-18, -37 - sig * 20, 7, 1, inkOnly); eye(19, -40 - sig * 20, 7, 1, inkOnly);
    if (!inkOnly) sportProp('basketball', 151 + sig * 66, -43 - sig * 128, .7, c.light);
  }

  function bodySugar(character, phase, inkOnly) {
    var c = palette(character, inkOnly);
    var sig = pulse(phase, .15, .39, .72);
    var slide = Math.sin(phase * TAU) * 15;
    ctx.translate(slide, sig * 23);
    line([[-46, 110], [-77 - sig * 70, 190 - sig * 25]], c.ink, 12);
    line([[46, 110], [77 + sig * 70, 190 - sig * 25]], c.ink, 12);
    tactile(ellipsePath(-91 - sig * 73, 196 - sig * 25, 38, 11, -.2), c.secondary, c.accent, character.id + 'blade1', [-210, 165, 150, 55], { count: 9, lineWidth: 4 });
    tactile(ellipsePath(91 + sig * 73, 196 - sig * 25, 38, 11, .2), c.secondary, c.accent, character.id + 'blade2', [60, 165, 150, 55], { count: 9, lineWidth: 4 });
    var leaf = new Path2D();
    leaf.moveTo(0, -150); leaf.bezierCurveTo(26, -112, 75 + sig * 87, -130, 71 + sig * 107, -63);
    leaf.bezierCurveTo(129 + sig * 30, -33, 116 + sig * 71, 54, 56, 68);
    leaf.bezierCurveTo(44, 129, -10, 158, -49, 106); leaf.bezierCurveTo(-128 - sig * 39, 92, -140 - sig * 70, 10, -82 - sig * 113, -28);
    leaf.bezierCurveTo(-88 - sig * 55, -96, -26, -108, 0, -150); leaf.closePath();
    tactile(leaf, c.primary, c.accent, character.id + 'sugar', [-245, -160, 490, 330], { count: 78, textureAlpha: .11 });
    if (!inkOnly) {
      ctx.save(); ctx.strokeStyle = c.secondary; ctx.lineWidth = 5; ctx.globalAlpha = .72;
      ctx.beginPath(); ctx.moveTo(0, -137); ctx.bezierCurveTo(-5, -63, 5, 30, -27, 110); ctx.stroke(); ctx.restore();
    }
    eye(-22, -37, 8, sig, inkOnly); eye(22, -37, 8, sig, inkOnly);
  }

  function bodyLoon(character, phase, inkOnly) {
    var c = palette(character, inkOnly);
    var sig = pulse(phase, .23, .4, .58);
    var turn = -Math.sin(phase * TAU) * .13 - sig * .42;
    ctx.rotate(turn);
    line([[-35, 103], [-67 + sig * 51, 205]], c.ink, 11);
    line([[33, 111], [79 + sig * 82, 202]], c.ink, 11);
    tactile(ellipsePath(-70 + sig * 51, 211, 44, 10, -.14), c.accent, c.secondary, character.id + 'loonblade1', [-125, 185, 110, 45], { count: 8, lineWidth: 4 });
    tactile(ellipsePath(84 + sig * 82, 209, 44, 10, .14), c.accent, c.secondary, character.id + 'loonblade2', [35, 185, 160, 45], { count: 8, lineWidth: 4 });
    var crescent = new Path2D();
    crescent.moveTo(-19, -151); crescent.bezierCurveTo(103, -122, 129, -1, 55, 116);
    crescent.bezierCurveTo(7, 165, -96, 134, -110, 46); crescent.bezierCurveTo(-126, -54, -76, -132, -19, -151); crescent.closePath();
    tactile(crescent, c.secondary, c.primary, character.id + 'loon', [-135, -160, 275, 330], { count: 67 });
    var cutout = ellipsePath(22, -15, 58, 94, -.24);
    ctx.save(); ctx.fillStyle = inkOnly ? c.ink : '#171914'; ctx.fill(cutout); ctx.restore();
    tactile(polygonPath([[55, -101], [167 + sig * 30, -62], [67, -39]]), c.accent, c.primary, character.id + 'beak', [50, -110, 155, 80], { count: 12, lineWidth: 4 });
    eye(44, -76, 7, 1, inkOnly);
  }

  function bodyAlebrije(character, phase, inkOnly) {
    var c = palette(character, inkOnly);
    var sig = pulse(phase, .18, .46, .66);
    var hover = pulse(phase, .08, .31, .45);
    ctx.translate(0, -hover * 26);
    ctx.rotate(-sig * .54 + Math.sin(phase * TAU) * .06);
    line([[-54, 74], [-98 - sig * 33, 167], [-123 - sig * 42, 196]], c.ink, 12);
    line([[48, 80], [93 + sig * 27, 166], [121 + sig * 52, 196]], c.ink, 12);
    tactile(ellipsePath(-126 - sig * 42, 201, 39, 13, -.12), c.secondary, c.accent, character.id + 'alefoot1', [-210, 175, 130, 55], { count: 10, lineWidth: 4 });
    tactile(ellipsePath(126 + sig * 52, 201, 39, 13, .12), c.secondary, c.accent, character.id + 'alefoot2', [75, 175, 150, 55], { count: 10, lineWidth: 4 });
    tactile(ellipsePath(0, 41, 93, 101, -.15), c.primary, c.accent, character.id + 'ale-body', [-105, -70, 210, 220], { count: 55 });
    tactile(ellipsePath(25, -99, 69, 57, .16), c.secondary, c.primary, character.id + 'ale-head', [-60, -165, 160, 130], { count: 38 });
    tactile(polygonPath([[-14, -139], [-42, -205], [19, -157]]), c.accent, c.secondary, character.id + 'ear1', [-50, -210, 80, 90], { count: 9, lineWidth: 4 });
    tactile(polygonPath([[52, -139], [102, -188], [83, -118]]), c.accent, c.secondary, character.id + 'ear2', [45, -200, 70, 90], { count: 9, lineWidth: 4 });
    line([[-78, 5], [-139, -16], [-164 + sig * 79, -81 - sig * 57]], c.ink, 11);
    line([[81, 10], [135, 45], [156, 80]], c.ink, 11);
    eye(3, -104, 8, sig, inkOnly); eye(43, -98, 8, sig, inkOnly);
    if (!inkOnly) sportProp('baseball', -177 + sig * 81, -99 - sig * 64, .78, c.light);
  }

  function bodyCane(character, phase, inkOnly) {
    var c = palette(character, inkOnly);
    var sig = pulse(phase, .24, .47, .69);
    var melt = Math.sin(phase * TAU) * .06 - (1 - sig) * .05;
    ctx.rotate(melt + sig * .52);
    line([[-42, 107], [-62, 198]], c.ink, 18);
    line([[42, 107], [78, 197]], c.ink, 18);
    tactile(ellipsePath(-67, 204, 37, 14, -.12), c.secondary, c.accent, character.id + 'canefoot1', [-115, 180, 100, 45], { count: 10, lineWidth: 4 });
    tactile(ellipsePath(84, 204, 37, 14, .12), c.secondary, c.accent, character.id + 'canefoot2', [30, 180, 110, 45], { count: 10, lineWidth: 4 });
    var bale = new Path2D();
    bale.moveTo(-82, -128); bale.bezierCurveTo(-127, -83, -112, 91, -78, 128);
    bale.quadraticCurveTo(-7, 159, 78, 129); bale.bezierCurveTo(120, 87, 119, -91, 68, -130); bale.closePath();
    tactile(bale, c.primary, c.secondary, character.id + 'cane', [-130, -140, 260, 300], { count: 76, textureAlpha: .18 });
    if (!inkOnly) {
      ctx.save(); ctx.strokeStyle = c.accent; ctx.globalAlpha = .68; ctx.lineWidth = 6;
      [-61, -22, 19, 59].forEach(function (x) { ctx.beginPath(); ctx.moveTo(x, -119); ctx.quadraticCurveTo(x * 1.3, 0, x, 123); ctx.stroke(); }); ctx.restore();
    }
    line([[57, -53], [111 + sig * 56, -75 - sig * 29]], c.ink, 14);
    ctx.save(); ctx.translate(127 + sig * 72, -89 - sig * 35); ctx.rotate(-.35 - sig * 1.78); ctx.fillStyle = c.accent; ctx.strokeStyle = c.ink; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.roundRect(-9, -116, 18, 150, 9); ctx.fill(); ctx.stroke(); ctx.restore();
    line([[-63, -50], [-112, -18]], c.ink, 14);
    eye(-23, -58, 8, sig, inkOnly); eye(20, -60, 8, sig, inkOnly);
  }

  function bodyGong(character, phase, inkOnly) {
    var c = palette(character, inkOnly);
    var sig = pulse(phase, .2, .43, .68);
    var toll = Math.sin(phase * TAU) * .04 + sig * .18;
    ctx.rotate(toll);
    line([[-31, 108], [-50 - sig * 24, 194]], c.ink, 20);
    line([[31, 108], [54 + sig * 40, 194]], c.ink, 20);
    tactile(ellipsePath(-57 - sig * 24, 201, 35, 16, -.1), c.secondary, c.accent, character.id + 'gongfoot1', [-115, 175, 100, 55], { count: 11, lineWidth: 4 });
    tactile(ellipsePath(61 + sig * 40, 201, 35, 16, .1), c.secondary, c.accent, character.id + 'gongfoot2', [15, 175, 130, 55], { count: 11, lineWidth: 4 });
    var lobes = [ellipsePath(-55, 18, 70, 111, -.2), ellipsePath(55, 18, 70, 111, .2), ellipsePath(0, -55, 73, 112, 0)];
    lobes.forEach(function (path, index) { tactile(path, index === 2 ? c.primary : c.secondary, c.accent, character.id + 'gong' + index, [-140, -180, 280, 330], { count: 30, lineWidth: 4 }); });
    tactile(ellipsePath(0, 26, 36, 31, 0), c.accent, c.secondary, character.id + 'gongboss', [-45, -15, 90, 85], { count: 11, lineWidth: 4 });
    line([[-104, -12], [-155 - sig * 16, 35], [-183 - sig * 31, 22]], c.ink, 17);
    line([[103, -13], [146 + sig * 76, -31 - sig * 18], [185 + sig * 100, -17 - sig * 9]], c.ink, 17);
    tactile(ellipsePath(195 + sig * 104, -17 - sig * 9, 31, 26, 0), c.primary, c.accent, character.id + 'gongglove', [150, -60, 180, 90], { count: 12, lineWidth: 5 });
    eye(-22, -81, 8, sig, inkOnly); eye(21, -81, 8, sig, inkOnly);
  }

  function bodyRice(character, phase, inkOnly) {
    var c = palette(character, inkOnly);
    var cycle = phase * 6;
    var chatter = pulse(cycle % 1, .05, .25, .52) * (phase > .13 && phase < .72 ? 1 : 0);
    var sig = pulse(phase, .14, .48, .75);
    var slip = Math.sin(phase * TAU * 2) * 15 * sig;
    ctx.translate(slip, -Math.abs(Math.sin(phase * TAU * 3)) * 8 * sig);
    line([[-35, 105], [-71 - sig * 24, 192]], c.ink, 11);
    line([[35, 105], [72 + sig * 28, 192]], c.ink, 11);
    tactile(ellipsePath(-77 - sig * 24, 200, 35, 12, -.16), c.secondary, c.accent, character.id + 'ricefoot1', [-135, 175, 115, 50], { count: 8, lineWidth: 4 });
    tactile(ellipsePath(78 + sig * 28, 200, 35, 12, .16), c.secondary, c.accent, character.id + 'ricefoot2', [25, 175, 125, 50], { count: 8, lineWidth: 4 });
    var parcel = new Path2D();
    parcel.moveTo(0, -148); parcel.bezierCurveTo(94, -166, 112, -56, 79, 11);
    parcel.bezierCurveTo(101, 84, 49, 147, 0, 145); parcel.bezierCurveTo(-49, 147, -101, 84, -79, 11); parcel.bezierCurveTo(-112, -56, -94, -166, 0, -148); parcel.closePath();
    tactile(parcel, c.primary, c.secondary, character.id + 'rice', [-120, -170, 240, 330], { count: 61 });
    if (!inkOnly) {
      ctx.save(); ctx.strokeStyle = c.accent; ctx.lineWidth = 5; ctx.globalAlpha = .8;
      ctx.beginPath(); ctx.moveTo(-70, -86); ctx.lineTo(72, 92); ctx.moveTo(70, -86); ctx.lineTo(-72, 92); ctx.stroke(); ctx.restore();
    }
    for (var side = -1; side <= 1; side += 2) {
      var reach = 117 + chatter * 85 + sig * 18;
      line([[side * 74, -12], [side * reach, -49 + side * Math.sin(cycle * TAU) * 22]], c.ink, 12);
      tactile(ellipsePath(side * (reach + 18), -49 + side * Math.sin(cycle * TAU) * 22, 25, 20, 0), c.accent, c.secondary, character.id + 'riceglove' + side, [side < 0 ? -250 : 100, -100, 150, 100], { count: 10, lineWidth: 4 });
    }
    eye(-20, -54, 7, chatter, inkOnly); eye(20, -54, 7, chatter, inkOnly);
  }

  function bodyGumbo(character, phase, inkOnly) {
    var c = palette(character, inkOnly);
    var sig = pulse(phase, .2, .44, .67);
    var sway = Math.sin(phase * TAU) * .09;
    ctx.rotate(sway - sig * .2);
    line([[-43, 111], [-70, 199]], c.ink, 22);
    line([[43, 111], [79 + sig * 17, 198]], c.ink, 22);
    tactile(ellipsePath(-76, 205, 42, 17, -.1), c.secondary, c.accent, character.id + 'gumbofoot1', [-130, 180, 110, 55], { count: 11, lineWidth: 4 });
    tactile(ellipsePath(85 + sig * 17, 205, 42, 17, .1), c.secondary, c.accent, character.id + 'gumbofoot2', [30, 180, 130, 55], { count: 11, lineWidth: 4 });
    var pear = new Path2D();
    pear.moveTo(0, -129); pear.bezierCurveTo(66, -127, 72, -55, 88, -13); pear.bezierCurveTo(147, 93, 80, 151, 0, 151); pear.bezierCurveTo(-80, 151, -147, 93, -88, -13); pear.bezierCurveTo(-72, -55, -66, -127, 0, -129); pear.closePath();
    tactile(pear, c.primary, c.secondary, character.id + 'gumbo', [-150, -140, 300, 310], { count: 73 });
    if (!inkOnly) {
      ctx.save(); ctx.strokeStyle = c.accent; ctx.lineWidth = 6; ctx.globalAlpha = .8;
      for (var f = -65; f <= 65; f += 22) { ctx.beginPath(); ctx.moveTo(f, -21); ctx.quadraticCurveTo(f + 11, 40, f - 2, 94); ctx.stroke(); } ctx.restore();
    }
    tactile(roundedRectPath(-39, -187, 78, 65, 13), c.secondary, c.accent, character.id + 'gumbostamp', [-50, -195, 100, 80], { count: 17, lineWidth: 4 });
    line([[-94, -25], [-164, -49], [-188 + sig * 91, -93 - sig * 15]], c.ink, 18);
    line([[94, -26], [158 + sig * 64, -70 - sig * 77]], c.ink, 18);
    tactile(ellipsePath(172 + sig * 69, -76 - sig * 82, 39, 24, -.35), c.accent, c.secondary, character.id + 'gumbopaddle', [120, -180, 190, 150], { count: 12, lineWidth: 5 });
    eye(-16, -158, 7, sig, inkOnly); eye(16, -158, 7, sig, inkOnly);
    if (!inkOnly) sportProp('american-football', -215 + sig * 99, -101 - sig * 16, .7, c.light);
  }

  function bodyPeach(character, phase, inkOnly) {
    var c = palette(character, inkOnly);
    var sig = pulse(phase, .17, .45, .69);
    var charge = easeOut(clamp((phase - .21) / .28, 0, 1)) * (phase < .72 ? 1 : 0);
    ctx.translate(sig * 48, 0);
    ctx.rotate(-sig * .32);
    line([[-39, 105], [-69 - charge * 39, 198]], c.ink, 16);
    line([[39, 105], [79 + charge * 56, 196]], c.ink, 16);
    tactile(ellipsePath(-76 - charge * 39, 204, 38, 14, -.15), c.secondary, c.accent, character.id + 'peachfoot1', [-175, 180, 125, 50], { count: 9, lineWidth: 4 });
    tactile(ellipsePath(86 + charge * 56, 203, 38, 14, .15), c.secondary, c.accent, character.id + 'peachfoot2', [40, 180, 170, 50], { count: 9, lineWidth: 4 });
    tactile(ellipsePath(-46 - sig * 9, -3, 82 + sig * 14, 139, -.13), c.primary, c.secondary, character.id + 'peachleft', [-150, -150, 180, 310], { count: 45 });
    tactile(ellipsePath(47 + sig * 9, -3, 82 + sig * 14, 139, .13), c.primary, c.accent, character.id + 'peachright', [-20, -150, 180, 310], { count: 45 });
    tactile(ellipsePath(0, 17, 37 + sig * 16, 58 + sig * 19, 0), c.secondary, c.accent, character.id + 'pit', [-55, -60, 110, 150], { count: 18, lineWidth: 5 });
    line([[-109, -25], [-162 - charge * 30, -2]], c.ink, 16);
    line([[109, -25], [174 + charge * 65, 12]], c.ink, 16);
    tactile(ellipsePath(185 + charge * 69, 15, 35, 28, 0), c.accent, c.secondary, character.id + 'peachhand', [140, -35, 180, 100], { count: 12, lineWidth: 5 });
    ctx.save(); ctx.strokeStyle = c.ink; ctx.lineWidth = 13; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -139); ctx.quadraticCurveTo(7, -187, 42, -196); ctx.stroke(); ctx.restore();
    eye(-28, -66, 8, sig, inkOnly); eye(29, -66, 8, sig, inkOnly);
  }

  var BODY_RENDERERS = {
    kite: bodyKite,
    lantern: bodyLantern,
    stoop: bodyStoop,
    toque: bodyToque,
    sugar: bodySugar,
    loon: bodyLoon,
    alebrije: bodyAlebrije,
    cane: bodyCane,
    gong: bodyGong,
    rice: bodyRice,
    gumbo: bodyGumbo,
    peach: bodyPeach
  };

  var characters = SPECS.map(function (spec) {
    var team = CONTENT.getTeam(spec.teamId, spec.sportId);
    var athlete = team && CONTENT.getAthlete(team.id, spec.id);
    if (!team || !athlete) throw new Error('Missing marquee roster identity: ' + spec.id);
    return Object.assign({}, spec, { team: team, athlete: athlete, sport: CONTENT.getSport(spec.sportId) });
  });

  var params = new URLSearchParams(window.location.search);
  var requestedId = params.get('athlete');
  var requestedIndex = characters.findIndex(function (character) { return character.id === requestedId; });
  var requestedView = params.get('view');
  var requestedFrame = Number(params.get('frame'));
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var state = {
    index: requestedIndex >= 0 ? requestedIndex : 0,
    view: ['match', 'portrait', 'clip'].indexOf(requestedView) >= 0 ? requestedView : 'match',
    filter: SPORT_LABELS[params.get('sport')] ? params.get('sport') : 'all',
    timeMs: Number.isFinite(requestedFrame) ? ((requestedFrame % DURATION) + DURATION) % DURATION : 0,
    paused: params.has('frame') ? params.get('play') !== '1' : Boolean(reducedMotion),
    lastNow: null,
    renderCount: 0
  };

  function selected() { return characters[state.index]; }
  function phase() { return (state.timeMs % DURATION) / DURATION; }
  function motionCue(value) {
    if (value < .12) return 'read and gather';
    if (value < .27) return 'anticipation';
    if (value < .54) return 'signature action';
    if (value < .76) return 'impact and follow-through';
    return 'recovery to recognisable idle';
  }
  function fitText(text, maxLength) {
    text = String(text || '');
    return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text;
  }
  function formatTime(ms) {
    var seconds = ms / 1000;
    return '00:' + String(Math.floor(seconds)).padStart(2, '0') + '.' + Math.floor((seconds % 1) * 10);
  }

  function drawGridBackground(primary, secondary, accent, view) {
    var gradient = ctx.createLinearGradient(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    gradient.addColorStop(0, '#20241f');
    gradient.addColorStop(.55, primary);
    gradient.addColorStop(1, secondary);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    ctx.save();
    ctx.globalAlpha = .12;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    var spacing = view === 'clip' ? 38 : 50;
    for (var x = -100; x < LOGICAL_WIDTH + 100; x += spacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - 130, LOGICAL_HEIGHT); ctx.stroke();
    }
    for (var y = 20; y < LOGICAL_HEIGHT; y += spacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(LOGICAL_WIDTH, y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawMatchScene(character, value) {
    var colors = character.team.colors;
    drawGridBackground(colors.secondary, '#151713', colors.accent, 'match');

    ctx.save();
    ctx.globalAlpha = .18;
    ctx.fillStyle = '#f1eadf';
    for (var row = 0; row < 4; row += 1) {
      for (var i = 0; i < 34; i += 1) {
        var wobble = Math.sin(value * TAU + i * 1.7 + row) * 4;
        ctx.beginPath();
        ctx.arc(24 + i * 37, 130 + row * 24 + wobble, 3 + (i + row) % 3, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(14,17,13,.72)';
    ctx.beginPath(); ctx.moveTo(0, 296); ctx.lineTo(LOGICAL_WIDTH, 246); ctx.lineTo(LOGICAL_WIDTH, LOGICAL_HEIGHT); ctx.lineTo(0, LOGICAL_HEIGHT); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = colors.accent; ctx.globalAlpha = .4; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 650); ctx.quadraticCurveTo(600, 510, 1200, 640); ctx.stroke();
    ctx.restore();

    var sig = pulse(value, .17, .42, .7);
    ctx.save();
    ctx.globalAlpha = .16 + sig * .24;
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 5;
    ctx.setLineDash([14, 14]);
    ctx.beginPath(); ctx.moveTo(790, 565); ctx.quadraticCurveTo(940, 305 - sig * 50, 1088, 455); ctx.stroke();
    ctx.restore();

    sportProp(character.sportId, 918 + sig * 105, 530 - sig * 144, 1.1, colors.accent);
    drawCharacter(character, 535, 546, 1.12, value, false);
    drawSilhouetteStamp(character, 1094, 178, value);

    ctx.save();
    ctx.fillStyle = 'rgba(16,18,14,.86)';
    ctx.beginPath(); ctx.roundRect(32, 28, 372, 95, 17); ctx.fill();
    ctx.fillStyle = colors.accent; ctx.font = '900 13px ui-monospace, monospace'; ctx.letterSpacing = '2px';
    ctx.fillText(character.sport.league, 55, 57);
    ctx.fillStyle = '#f4eee3'; ctx.font = '950 31px Arial, sans-serif';
    ctx.fillText(character.team.code + '  LIVE IDENTITY TEST', 54, 96);
    ctx.fillStyle = 'rgba(244,238,227,.58)'; ctx.font = '700 11px ui-monospace, monospace';
    ctx.fillText('MOTION / ' + character.motionName.toUpperCase(), 55, 114);
    ctx.restore();

    ctx.save();
    ctx.translate(35, 728);
    ctx.fillStyle = colors.accent; ctx.fillRect(0, 0, 8, 36);
    ctx.fillStyle = '#f4eee3'; ctx.font = '950 28px Arial, sans-serif'; ctx.fillText(character.athlete.name.toUpperCase(), 24, 25);
    ctx.fillStyle = 'rgba(244,238,227,.62)'; ctx.font = '700 11px ui-monospace, monospace';
    ctx.fillText(character.athlete.role.toUpperCase() + ' · #' + character.athlete.number + ' · ' + motionCue(value).toUpperCase(), 24, 45);
    ctx.restore();
  }

  function drawPortraitScene(character, value) {
    var colors = character.team.colors;
    ctx.fillStyle = '#e9e1d4'; ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.fillStyle = colors.primary; ctx.fillRect(0, 0, 432, LOGICAL_HEIGHT);
    ctx.fillStyle = colors.secondary; ctx.fillRect(432, 0, 768, 136);
    ctx.fillStyle = colors.accent; ctx.fillRect(1048, 136, 152, 664);

    ctx.save();
    ctx.translate(49, 119);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(18,19,15,.82)'; ctx.font = '950 112px Arial, sans-serif';
    ctx.fillText(fitText(character.athlete.name.toUpperCase(), 14), -610, 0);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(20,21,17,.22)'; ctx.lineWidth = 2;
    ctx.strokeRect(466, 167, 548, 578);
    for (var i = 0; i < 12; i += 1) {
      ctx.beginPath(); ctx.moveTo(466, 189 + i * 47); ctx.lineTo(1014, 189 + i * 47); ctx.stroke();
    }
    ctx.restore();

    drawCharacter(character, 735, 560, 1.48, value, false);

    ctx.save();
    ctx.fillStyle = '#171812'; ctx.font = '900 13px ui-monospace, monospace';
    ctx.fillText('CYBERLIGA / CAST RESET / SERIES 01', 468, 78);
    ctx.fillStyle = '#f4eee3'; ctx.font = '900 22px ui-monospace, monospace';
    ctx.fillText(character.team.code + '  #' + character.athlete.number, 884, 88);
    ctx.fillStyle = '#171812'; ctx.font = '950 37px Arial, sans-serif';
    ctx.fillText(character.motionName.toUpperCase(), 475, 787);
    ctx.fillStyle = 'rgba(23,24,18,.6)'; ctx.font = '700 12px ui-monospace, monospace';
    ctx.fillText(character.bodyFamily.toUpperCase(), 475, 759);
    ctx.restore();

    drawSilhouetteStamp(character, 1107, 220, value);
  }

  function drawClipScene(character, value) {
    var colors = character.team.colors;
    ctx.fillStyle = '#10120f'; ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.save(); ctx.globalAlpha = .35; ctx.fillStyle = colors.primary;
    ctx.font = '950 74px Arial, sans-serif';
    ctx.translate(85, 735); ctx.rotate(-Math.PI / 2);
    ctx.fillText(character.motionName.toUpperCase(), 0, 0); ctx.restore();

    var x = 386, y = 18, w = 428, h = 764;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 34;
    ctx.fillStyle = colors.secondary; ctx.beginPath(); ctx.roundRect(x, y, w, h, 24); ctx.fill();
    ctx.clip(roundedRectPath(x, y, w, h, 24));
    var gradient = ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, colors.primary); gradient.addColorStop(.54, colors.secondary); gradient.addColorStop(1, '#10120f');
    ctx.fillStyle = gradient; ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = .16; ctx.strokeStyle = colors.accent; ctx.lineWidth = 2;
    for (var g = -160; g < 500; g += 40) { ctx.beginPath(); ctx.moveTo(x + g, y); ctx.lineTo(x + g + 220, y + h); ctx.stroke(); }
    ctx.restore();

    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 24); ctx.clip();
    var sig = pulse(value, .17, .43, .7);
    sportProp(character.sportId, 717 + sig * 72, 506 - sig * 118, .9, colors.accent);
    drawCharacter(character, 591, 548, 1.08, value, false);
    ctx.fillStyle = 'rgba(9,10,8,.79)'; ctx.fillRect(x, y, w, 76);
    ctx.fillStyle = colors.accent; ctx.font = '900 11px ui-monospace, monospace'; ctx.fillText('CYBERLIGA · LIVE CUT 00:0' + Math.floor(value * 9), x + 22, y + 27);
    ctx.fillStyle = '#f4eee3'; ctx.font = '950 22px Arial, sans-serif'; ctx.fillText(character.team.code + ' / ' + character.sport.name.toUpperCase(), x + 22, y + 57);
    ctx.fillStyle = 'rgba(8,9,7,.88)'; ctx.fillRect(x, y + h - 176, w, 176);
    ctx.fillStyle = colors.accent; ctx.font = '900 11px ui-monospace, monospace'; ctx.fillText('SIGNATURE MOTION', x + 22, y + h - 139);
    ctx.fillStyle = '#f4eee3'; ctx.font = '950 34px Arial, sans-serif'; ctx.fillText(fitText(character.athlete.name.toUpperCase(), 16), x + 22, y + h - 96);
    ctx.font = '850 19px Arial, sans-serif'; ctx.fillText(fitText(character.motionName.toUpperCase(), 26), x + 22, y + h - 62);
    ctx.fillStyle = 'rgba(244,238,227,.6)'; ctx.font = '700 10px ui-monospace, monospace'; ctx.fillText('9:16 SAFE FRAME · ' + motionCue(value).toUpperCase(), x + 22, y + h - 29);
    ctx.restore();

    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, w, h, 24); ctx.stroke(); ctx.restore();
    drawSilhouetteStamp(character, 1040, 612, value);
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.54)'; ctx.font = '700 11px ui-monospace, monospace';
    ctx.fillText('1080 × 1920', 916, 676); ctx.fillText('SOUND-OFF READ', 916, 700); ctx.fillText('09.0 SECOND LOOP', 916, 724); ctx.restore();
  }

  function drawCharacter(character, x, y, scale, value, inkOnly) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    if (!inkOnly) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.beginPath(); ctx.ellipse(0, 220, 113, 20, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    BODY_RENDERERS[character.body](character, value, inkOnly);
    ctx.restore();
  }

  function drawSilhouetteStamp(character, x, y, value) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(244,238,227,.9)';
    ctx.beginPath(); ctx.roundRect(-63, -77, 126, 154, 18); ctx.fill();
    ctx.strokeStyle = 'rgba(10,11,8,.24)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.roundRect(-58, -72, 116, 144, 14); ctx.clip();
    drawCharacter(character, 0, 26, .24, value, true);
    ctx.restore();
    ctx.fillStyle = '#171812'; ctx.font = '900 9px ui-monospace, monospace'; ctx.textAlign = 'center';
    ctx.fillText('48 PX GATE', 0, 65);
    ctx.restore();
  }

  function render() {
    var pixelWidth = canvas.width;
    var pixelHeight = canvas.height;
    if (!pixelWidth || !pixelHeight) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#10120f'; ctx.fillRect(0, 0, pixelWidth, pixelHeight);
    var mobileCover = window.innerWidth <= 560 && !document.fullscreenElement;
    var scale = mobileCover
      ? Math.max(pixelWidth / LOGICAL_WIDTH, pixelHeight / LOGICAL_HEIGHT)
      : Math.min(pixelWidth / LOGICAL_WIDTH, pixelHeight / LOGICAL_HEIGHT);
    var offsetX = (pixelWidth - LOGICAL_WIDTH * scale) / 2;
    var offsetY = (pixelHeight - LOGICAL_HEIGHT * scale) / 2;
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    var character = selected();
    var value = phase();
    if (state.view === 'portrait') drawPortraitScene(character, value);
    else if (state.view === 'clip') drawClipScene(character, value);
    else drawMatchScene(character, value);
    state.renderCount += 1;
  }

  function resizeCanvas() {
    var rect = canvas.getBoundingClientRect();
    var ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    var width = Math.max(1, Math.round(rect.width * ratio));
    var height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    render();
  }

  function updateTransport() {
    transportToggle.textContent = state.paused ? 'Play' : 'Pause';
    transportToggle.setAttribute('aria-pressed', String(state.paused));
    scrubber.value = String(Math.round(state.timeMs));
    timecode.textContent = formatTime(state.timeMs);
  }

  function renderDetails() {
    var character = selected();
    document.getElementById('stage-identity').textContent = character.bodyFamily + ' · ' + character.reaction;
    document.getElementById('athlete-sport').textContent = character.sport.name + ' · ' + character.athlete.role;
    document.getElementById('athlete-name').textContent = character.athlete.name;
    document.getElementById('athlete-club').textContent = character.team.name + ' · ' + character.team.city;
    document.getElementById('athlete-signature').textContent = '“' + character.motionName + '” — ' + character.reaction + '.';
    document.getElementById('athlete-gift').textContent = character.gift;
    document.getElementById('athlete-flaw').textContent = character.flaw;
    document.getElementById('athlete-story').textContent = character.story;
    document.getElementById('athlete-rivalry').textContent = character.rivalry;
    document.getElementById('dossier-head').dataset.number = '#' + character.athlete.number;
    document.getElementById('material-row').innerHTML = character.materials.map(function (material) {
      return '<span class="material-chip">' + material + '</span>';
    }).join('');
    canvas.setAttribute('aria-label', 'Animated ' + state.view + ' preview of ' + character.athlete.name + ', ' + character.athlete.role + ' for ' + character.team.name + '. Signature motion: ' + character.motionName + '.');
    document.querySelectorAll('.roster-card').forEach(function (button) {
      var active = button.dataset.athlete === character.id;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      if (active && window.innerWidth <= 560) {
        var targetLeft = button.offsetLeft - Math.max(0, (rosterList.clientWidth - button.offsetWidth) / 2);
        var behavior = reducedMotion || document.body.dataset.ready !== 'true' ? 'auto' : 'smooth';
        rosterList.scrollTo({ left: Math.max(0, targetLeft), behavior: behavior });
      }
    });
    document.getElementById('lab-announcer').textContent = character.athlete.name + ' selected. ' + character.motionName + ', ' + state.view + ' view.';
    copyButton.dataset.state = '';
    copyButton.textContent = 'Copy deterministic preview link';
  }

  function renderViewButtons() {
    stageCard.dataset.view = state.view;
    document.querySelectorAll('[data-view]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.view === state.view));
    });
  }

  function updateURL(includeFrame, mode) {
    var query = new URLSearchParams();
    query.set('athlete', selected().id);
    query.set('view', state.view);
    if (state.filter !== 'all') query.set('sport', state.filter);
    if (includeFrame) {
      query.set('frame', String(Math.round(state.timeMs / 10) * 10));
      query.set('play', mode === 'play' ? '1' : '0');
    }
    var next = window.location.pathname + '?' + query.toString();
    window.history.replaceState(null, '', next);
    return window.location.href;
  }

  function setView(view, userInitiated) {
    if (['match', 'portrait', 'clip'].indexOf(view) < 0) return;
    state.view = view;
    renderViewButtons();
    renderDetails();
    if (userInitiated) updateURL(false);
    render();
  }

  function visibleIndices() {
    return characters.map(function (character, index) { return { character: character, index: index }; })
      .filter(function (item) { return state.filter === 'all' || item.character.sportId === state.filter; })
      .map(function (item) { return item.index; });
  }

  function setCharacter(index, userInitiated) {
    if (!Number.isInteger(index) || index < 0 || index >= characters.length) return;
    state.index = index;
    state.timeMs = 0;
    state.lastNow = null;
    renderDetails();
    updateTransport();
    if (userInitiated) updateURL(false);
    render();
  }

  function moveCharacter(direction) {
    var indices = visibleIndices();
    var position = indices.indexOf(state.index);
    if (position < 0) position = 0;
    var nextPosition = (position + direction + indices.length) % indices.length;
    setCharacter(indices[nextPosition], true);
    var selectedButton = document.querySelector('.roster-card[aria-selected="true"]');
    if (selectedButton) selectedButton.focus({ preventScroll: true });
  }

  function setFilter(filter, userInitiated) {
    if (!SPORT_LABELS[filter]) filter = 'all';
    state.filter = filter;
    document.querySelectorAll('.filter-button').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.sport === filter));
    });
    document.querySelectorAll('.roster-card').forEach(function (button) {
      button.hidden = filter !== 'all' && button.dataset.sport !== filter;
    });
    if (filter !== 'all' && selected().sportId !== filter) {
      var first = characters.findIndex(function (character) { return character.sportId === filter; });
      setCharacter(first, false);
    }
    if (userInitiated) updateURL(false);
  }

  function buildFilters() {
    ['all', 'soccer', 'basketball', 'hockey', 'baseball', 'american-football'].forEach(function (sport) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'filter-button';
      button.dataset.sport = sport;
      button.setAttribute('aria-pressed', String(state.filter === sport));
      button.textContent = SPORT_LABELS[sport];
      button.addEventListener('click', function () { setFilter(sport, true); });
      filters.appendChild(button);
    });
  }

  function buildRoster() {
    characters.forEach(function (character, index) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'roster-card';
      button.dataset.athlete = character.id;
      button.dataset.sport = character.sportId;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(index === state.index));
      button.tabIndex = index === state.index ? 0 : -1;
      button.style.setProperty('--card-color', character.team.colors.accent);
      button.style.setProperty('--card-tilt', ((hash(character.id) % 7) - 3) + 'deg');
      button.innerHTML = '<span class="mini-silhouette" aria-hidden="true">' + String(index + 1).padStart(2, '0') + '</span>' +
        '<span><span class="roster-sport">' + character.sport.name + '</span><span class="roster-name">' + character.athlete.name + '</span><span class="roster-role">' + character.athlete.role + ' · ' + character.bodyFamily + '</span></span>';
      button.addEventListener('click', function () { setCharacter(index, true); });
      rosterList.appendChild(button);
    });
  }

  function togglePlayback() {
    state.paused = !state.paused;
    state.lastNow = null;
    updateTransport();
    updateURL(true, state.paused ? 'pause' : 'play');
  }

  function restartMotion(play) {
    state.timeMs = 0;
    state.paused = play === false ? true : false;
    state.lastNow = null;
    updateTransport();
    updateURL(true, state.paused ? 'pause' : 'play');
    render();
  }

  function hitSignature() {
    state.timeMs = 660;
    state.paused = false;
    state.lastNow = null;
    updateTransport();
    updateURL(true, 'play');
    render();
  }

  function copyDeterministicLink() {
    var priorPaused = state.paused;
    var link = updateURL(true, 'pause');
    state.paused = priorPaused;
    updateTransport();
    var success = function () {
      copyButton.dataset.state = 'copied';
      copyButton.textContent = 'Copied frozen frame · ' + formatTime(state.timeMs);
      window.setTimeout(function () {
        copyButton.dataset.state = '';
        copyButton.textContent = 'Copy deterministic preview link';
      }, 1800);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(link).then(success).catch(function () {
        window.prompt('Copy this deterministic character preview URL:', link);
      });
    } else {
      window.prompt('Copy this deterministic character preview URL:', link);
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    else if (stageCard.requestFullscreen) stageCard.requestFullscreen().catch(function () {});
  }

  function animationLoop(now) {
    if (!state.paused) {
      if (state.lastNow != null) {
        var delta = clamp(now - state.lastNow, 0, 48);
        state.timeMs = (state.timeMs + delta) % DURATION;
      }
      state.lastNow = now;
      updateTransport();
      render();
    } else {
      state.lastNow = null;
    }
    window.requestAnimationFrame(animationLoop);
  }

  document.querySelectorAll('[data-view]').forEach(function (button) {
    button.addEventListener('click', function () { setView(button.dataset.view, true); });
  });
  transportToggle.addEventListener('click', togglePlayback);
  restartButton.addEventListener('click', function () { restartMotion(true); });
  signatureButton.addEventListener('click', hitSignature);
  copyButton.addEventListener('click', copyDeterministicLink);
  canvas.addEventListener('click', hitSignature);
  scrubber.addEventListener('input', function () {
    state.timeMs = Number(scrubber.value);
    state.paused = true;
    state.lastNow = null;
    updateTransport();
    updateURL(true, 'pause');
    render();
  });
  document.addEventListener('keydown', function (event) {
    if (event.target && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); moveCharacter(1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); moveCharacter(-1); }
    else if (event.key === '1') { event.preventDefault(); setView('match', true); }
    else if (event.key === '2') { event.preventDefault(); setView('portrait', true); }
    else if (event.key === '3') { event.preventDefault(); setView('clip', true); }
    else if (event.key === ' ') { event.preventDefault(); togglePlayback(); }
    else if (event.key.toLowerCase() === 'f') { event.preventDefault(); toggleFullscreen(); }
    else if (event.key.toLowerCase() === 'r') { event.preventDefault(); restartMotion(true); }
    else if (event.key === 'Escape' && document.fullscreenElement) {
      event.preventDefault();
      document.exitFullscreen().catch(function () {});
    }
  });
  document.addEventListener('fullscreenchange', resizeCanvas);

  window.render_game_to_text = function () {
    var character = selected();
    return JSON.stringify({
      screen: 'character-laboratory',
      coordinateSystem: 'Canvas logical coordinates: origin top-left, +x right, +y down, 1200x800. Character anchor is stage center-bottom.',
      mode: 'character-art-direction-lab',
      view: state.view,
      athlete: {
        id: character.id,
        name: character.athlete.name,
        number: character.athlete.number,
        sport: character.sport.name,
        role: character.athlete.role,
        team: character.team.name,
        bodyFamily: character.bodyFamily,
        construction: character.materials,
        signature: character.motionName,
        motionRecipe: character.reaction,
        gift: character.gift,
        flaw: character.flaw,
        rivalry: character.rivalry
      },
      motion: {
        durationMs: DURATION,
        timeMs: Math.round(state.timeMs),
        phase: Number(phase().toFixed(4)),
        cue: motionCue(phase()),
        paused: state.paused
      },
      cast: {
        total: characters.length,
        visible: visibleIndices().length,
        filter: state.filter,
        selectedIndex: state.index
      },
      controls: 'Left/Right athlete; 1 match; 2 portrait; 3 vertical clip; Space play/pause; R rewind; F fullscreen; canvas click triggers signature.',
      deterministicUrl: window.location.href
    });
  };

  window.advanceTime = function (milliseconds) {
    var amount = Number(milliseconds);
    if (!Number.isFinite(amount)) return;
    state.paused = true;
    state.lastNow = null;
    state.timeMs = ((state.timeMs + amount) % DURATION + DURATION) % DURATION;
    updateTransport();
    render();
  };

  window.__CHARACTER_LAB__ = {
    getCharacters: function () { return characters.slice(); },
    getState: function () { return JSON.parse(window.render_game_to_text()); },
    select: function (id) {
      var index = characters.findIndex(function (character) { return character.id === id; });
      if (index >= 0) setCharacter(index, false);
      return index >= 0;
    },
    setView: function (view) { setView(view, false); },
    setFilter: function (filter) { setFilter(filter, false); },
    setTime: function (milliseconds) {
      state.timeMs = clamp(Number(milliseconds) || 0, 0, DURATION - 1);
      state.paused = true;
      state.lastNow = null;
      updateTransport();
      render();
    },
    durationMs: DURATION
  };

  buildFilters();
  buildRoster();
  setFilter(state.filter, false);
  renderViewButtons();
  renderDetails();
  updateTransport();
  resizeCanvas();
  if ('ResizeObserver' in window) new ResizeObserver(resizeCanvas).observe(canvas);
  else window.addEventListener('resize', resizeCanvas);
  document.body.dataset.ready = 'true';
  window.requestAnimationFrame(animationLoop);
})();
