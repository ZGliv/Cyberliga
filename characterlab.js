(function () {
  'use strict';

  var CONTENT = window.CYBERLIGA_CONTENT;
  var CHARACTER_DATA = window.CyberligaCharacters;
  var VISUAL = window.CyberligaFoundingVisual;
  var DURATION = VISUAL ? VISUAL.durationMs : 4800;
  var LOGICAL_WIDTH = 1200;
  var LOGICAL_HEIGHT = 800;
  var TAU = Math.PI * 2;
  var SPECS = CHARACTER_DATA && CHARACTER_DATA.records;

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

  if (!CONTENT || !CHARACTER_DATA || !VISUAL || !Array.isArray(SPECS) || !canvas || !ctx || !rosterList || !filters) {
    document.body.dataset.ready = 'error';
    throw new Error('Cyberliga character lab could not initialize its content or canvas.');
  }
  var characterValidation = CHARACTER_DATA.validate(CONTENT);
  if (!characterValidation.valid) {
    document.body.dataset.ready = 'error';
    throw new Error('Cyberliga character canon is invalid: ' + characterValidation.errors.join(' | '));
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
  function roundedRectPath(x, y, width, height, radius) {
    var path = new Path2D();
    path.roundRect(x, y, width, height, radius);
    return path;
  }
  function sportProp(sportId, x, y, scale, color) {
    VISUAL.drawSportProp(ctx, sportId, { x: x, y: y, scale: scale, color: color });
  }
  var characters = SPECS.map(function (spec) {
    var team = CONTENT.getTeam(spec.teamId, spec.sportId);
    var athlete = team && CONTENT.getAthlete(team.id, spec.id);
    if (!team || !athlete) throw new Error('Missing marquee roster identity: ' + spec.id);
    var visual = VISUAL.prepare(spec, team);
    if (!visual) throw new Error('Missing Founding 12 vector identity: ' + spec.id);
    return Object.assign({}, spec, { team: team, athlete: athlete, sport: CONTENT.getSport(spec.sportId), visual: visual });
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
    VISUAL.draw(ctx, character.visual, {
      x: x,
      y: y,
      scale: scale,
      phase: value,
      inkOnly: inkOnly,
      shadow: !inkOnly,
      surface: 'character-lab-' + state.view
    });
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
    ['all', 'soccer', 'basketball', 'hockey', 'baseball', 'combat', 'american-football'].forEach(function (sport) {
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
      visual: VISUAL.describe(character.visual, phase(), 'character-lab-' + state.view, null),
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
