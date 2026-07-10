(function () {
  'use strict';

  var C = window.CYBERLIGA_CONTENT;
  var U = window.CyberligaUniverse;
  var canvas = document.getElementById('replay-canvas');
  var ctx = canvas.getContext('2d');
  var PREVIEW_MS = 12000;
  var clockOffset = 0;
  var previewMs = 0;
  var playing = true;
  var lastFrame = performance.now();
  var active = null;
  var cards = [];
  var channels = [];

  var CONFIG = {
    soccer: {
      route: 'index.html', color: '#47b974', surface: '#276842', line: '#dbead8', noun: 'goal',
      events: [
        ['THE OUTSIDE-BOOT WINDOW', 'A disguised pass bends behind the last shoulder and turns one quiet run into the whole match.'],
        ['THE KEEPER FLIES SIDEWAYS', 'A full-stretch hand changes the angle, the noise, and everyone’s idea of what was already a goal.'],
        ['THE NUTMEG BEFORE THE FINISH', 'One touch removes the defender; the second arrives before the crowd finishes laughing.'],
        ['THE BACK-POST ARRIVAL', 'The weak side becomes the loud side exactly when the delivery drops.'],
        ['THE MIDFIELD THEFT', 'Possession changes hands and becomes a shot before the shape can recover.']
      ], clocks: ['18\'','57\'','84\'']
    },
    basketball: {
      route: 'hoops.html', color: '#ff9f31', surface: '#bb6e2d', line: '#f7e5cb', noun: 'bucket',
      events: [
        ['THE SPAIN PICK-AND-ROLL OPENS', 'The back screen freezes the big, the tag arrives late, and the pocket pass lands on time.'],
        ['THE GHOST SCREEN VANISHES', 'The defense calls a switch on contact that never comes. The shooter is already lifting.'],
        ['THE WEAK-SIDE CUT', 'Four eyes follow the ball and one cutter disappears behind all of them.'],
        ['THE CHASE-DOWN ERASURE', 'A clean runway becomes a rejection against the glass and a sprint the other way.'],
        ['THE HORNS DECISION', 'Both elbows threaten. One slip opens the lane that the coverage tried to hide.']
      ], clocks: ['Q1 04:11','Q3 07:02','Q4 00:38']
    },
    hockey: {
      route: 'hockey.html', color: '#6cc5df', surface: '#d8eef1', line: '#4f89a1', noun: 'goal',
      events: [
        ['THE SEAM OPENS ONCE', 'The puck crosses the royal road before the goaltender can make the second push.'],
        ['THE ONE-TIMER DETONATES', 'The pass and release share one sound. The net answers half a beat later.'],
        ['THE BACKCHECK STEALS IT', 'A lost race becomes a lifted stick, then three accelerating strides into open ice.'],
        ['THE SCREEN HOLDS', 'The keeper sees the reaction, not the shot. By then the red light has the better view.'],
        ['THE CYCLE BREAKS THE BOX', 'Three short wall passes stretch the coverage until the slot belongs to nobody.']
      ], clocks: ['1P 12:40','2P 08:16','3P 01:09']
    },
    baseball: {
      route: 'baseball.html', color: '#7eb15d', surface: '#4d7b42', line: '#f2ead3', noun: 'run',
      events: [
        ['THE WALL LOSES THE ARGUMENT', 'The outfielder climbs, the ball keeps traveling, and the whole park looks over one shoulder.'],
        ['THE RELAY ARRIVES HOME', 'Two clean throws erase a run by the width of a glove and one cloud of chalk.'],
        ['THE COUNT TURNS FULL', 'Three spoiled pitches end with one mistake driven into the night.'],
        ['THE DOUBLE PLAY UNFOLDS', 'A bad hop becomes a bare hand, a pivot, and two outs before anyone can name the bounce.'],
        ['THE SQUEEZE IS ON', 'The runner breaks with the pitch and the bunt dies exactly where no fielder wants it.']
      ], clocks: ['B3 · 1 OUT','T6 · 2 OUT','B9 · 2 OUT']
    },
    combat: {
      route: 'fight.html', color: '#d46c66', surface: '#d7c9ae', line: '#b63f44', noun: 'round',
      events: [
        ['THE COUNTER BEATS THE BELL', 'The jab draws the answer; the answer draws the hook nobody saw being loaded.'],
        ['THE ROPE ESCAPE', 'A trapped stance becomes a shoulder roll, a pivot, and three clean replies.'],
        ['THE BODY SHOT CHANGES EVERYTHING', 'The guard stays high. The breath does not come back on schedule.'],
        ['THE CLINCH COMES APART', 'One short frame creates just enough room for the uppercut to find daylight.'],
        ['THE LAST-STAND FLURRY', 'Fatigue wins every exchange except the one the crowd will remember.']
      ], clocks: ['R1 · 01:32','R2 · 00:44','R3 · 00:09']
    },
    'american-football': {
      route: 'football.html', color: '#9983df', surface: '#446a3d', line: '#f5f1d7', noun: 'touchdown',
      events: [
        ['THE SAFETY BITES UNDERNEATH', 'Play action holds one step too long. The post route takes the roof off the coverage.'],
        ['THE POCKET SURVIVES', 'The edge closes, the quarterback climbs, and the throw leaves through the only clean window.'],
        ['THE OPTION KEEPER BREAKS FREE', 'The mesh point steals a linebacker and the sideline has no second answer.'],
        ['THE GOAL-LINE STAND', 'Four bodies meet at the stripe. The ball never finds the last inch.'],
        ['THE SLOT WINS THE LEVERAGE', 'The option route breaks away from the help and turns third down into open grass.']
      ], clocks: ['Q1 06:18','Q3 10:07','Q4 00:51']
    }
  };

  function byId(id) { return document.getElementById(id); }
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function pad(value) { return String(value).padStart(2, '0'); }
  function formatPreview(ms) { return '00:' + pad(Math.floor(clamp(ms, 0, PREVIEW_MS) / 1000)); }
  function nowMs() { return Date.now() + clockOffset; }
  function currentEdition() { return Math.max(0, Math.floor((nowMs() - U.EPOCH_MS) / U.SLOT_MS)); }
  function scoreText(score) { return score[0] + '–' + score[1]; }
  function queryValue(name) { return new URLSearchParams(location.search).get(name); }
  function validEdition(value) {
    if (value == null || String(value).trim() === '') return currentEdition();
    var number = Number(value);
    return Number.isInteger(number) && number >= 0 ? number : currentEdition();
  }
  function validEventIndex(value, maximum) {
    var number = Number(value);
    return Number.isFinite(number) ? clamp(Math.trunc(number), 0, maximum) : 0;
  }
  function scoreFor(sportId, random) {
    var a, b, values;
    if (sportId === 'soccer') { a = Math.floor(random() * 4); b = Math.floor(random() * 4); }
    else if (sportId === 'basketball') { a = 78 + Math.floor(random() * 39); b = 78 + Math.floor(random() * 39); }
    else if (sportId === 'hockey') { a = Math.floor(random() * 6); b = Math.floor(random() * 6); }
    else if (sportId === 'baseball') { a = Math.floor(random() * 9); b = Math.floor(random() * 9); }
    else if (sportId === 'combat') { a = 1 + Math.floor(random() * 2); b = 1 + Math.floor(random() * 2); }
    else {
      values = [10, 13, 16, 17, 20, 21, 23, 24, 27, 28, 30, 31, 34, 38];
      a = values[Math.floor(random() * values.length)]; b = values[Math.floor(random() * values.length)];
    }
    if (a === b) {
      if (sportId === 'basketball') a += 3;
      else if (sportId === 'american-football') a += 3;
      else a += 1;
    }
    return [a, b];
  }
  function partialScore(finalScore, index) {
    var ratio = [0.28, 0.62, 1][index];
    return [Math.round(finalScore[0] * ratio), Math.round(finalScore[1] * ratio)];
  }
  function eventSet(sport, teamPool, finalScore, seed) {
    var config = CONFIG[sport.id];
    var random = C.seededRandom(seed + '|events');
    var used = {};
    return config.clocks.map(function (clock, index) {
      var eventIndex = Math.floor(random() * config.events.length);
      while (used[eventIndex]) eventIndex = (eventIndex + 1) % config.events.length;
      used[eventIndex] = true;
      var team = teamPool[(random() > .38 ? (finalScore[0] > finalScore[1] ? 0 : 1) : index % 2)];
      var athlete = team.athletes[Math.floor(random() * team.athletes.length)];
      return {
        index: index,
        clock: clock,
        title: config.events[eventIndex][0],
        call: config.events[eventIndex][1],
        team: team,
        athlete: athlete,
        score: partialScore(finalScore, index)
      };
    });
  }
  function buildHighlight(sport, edition) {
    var config = CONFIG[sport.id];
    var random = C.seededRandom('replay|' + edition + '|' + sport.id);
    var match, home, away, canonical = sport.id === 'soccer';
    if (canonical) {
      var channelMatches = U.liveMatches(U.EPOCH_MS + edition * U.SLOT_MS + Math.floor(U.SLOT_MS * .68));
      match = channelMatches[C.hash('replay-channel|' + edition) % channelMatches.length];
      home = C.getTeam(match.home.id, 'soccer');
      away = C.getTeam(match.away.id, 'soccer');
    } else {
      var season = C.createSeason(sport.id, 'replay|' + edition);
      var round = season.rounds[edition % season.rounds.length];
      match = round.matches[C.hash(sport.id + '|' + edition) % round.matches.length];
      home = C.getTeam(match.homeId, sport.id);
      away = C.getTeam(match.awayId, sport.id);
    }
    var finalScore = scoreFor(sport.id, random);
    var events = eventSet(sport, [home, away], finalScore, match.id + '|' + edition);
    return {
      edition: edition,
      sport: sport,
      config: config,
      matchId: match.id,
      channel: canonical ? match.channel + 1 : null,
      home: home,
      away: away,
      finalScore: finalScore,
      events: events,
      canonical: canonical,
      status: canonical ? 'CANONICAL SCHEDULE' : 'EXHIBITION RECAP',
      source: canonical ? 'shared UTC soccer fixture' : 'deterministic exhibition recap'
    };
  }
  function selectionURL(highlight, eventIndex, absolute) {
    var q = new URLSearchParams();
    q.set('edition', highlight.edition);
    q.set('sport', highlight.sport.id);
    q.set('event', eventIndex);
    q.set('match', highlight.matchId);
    var path = 'replay.html?' + q.toString();
    return absolute ? new URL(path, location.href).href : path;
  }
  function studioQuery(highlight, event) {
    var q = new URLSearchParams();
    q.set('sport', highlight.sport.id);
    q.set('home', highlight.home.id);
    q.set('away', highlight.away.id);
    q.set('score', event.score[0] + '-' + event.score[1]);
    q.set('athlete', event.athlete.id);
    q.set('headline', event.title);
    q.set('match', highlight.matchId);
    q.set('story', 'replay-' + highlight.edition + '-' + event.index);
    return q.toString();
  }

  function renderChannels() {
    channels = U.liveMatches(nowMs());
    var list = byId('channel-list');
    var signature = channels.map(function (match) { return match.id; }).join('|');
    if (list.dataset.signature !== signature) {
      list.dataset.signature = signature;
      list.replaceChildren();
      channels.forEach(function (match) {
        var link = el('a', 'channel');
        link.href = U.sharePath(match);
        link.setAttribute('aria-label', 'Tune to canonical soccer channel ' + (match.channel + 1) + ': ' + match.home.name + ' versus ' + match.away.name);
        var copy = el('span');
        copy.appendChild(el('small', '', 'CHANNEL ' + pad(match.channel + 1) + ' · ROUND ' + match.round));
        copy.appendChild(el('b', '', match.home.code + ' / ' + match.away.code));
        link.appendChild(copy);
        link.appendChild(el('strong', '', U.clock(match.elapsedMs)));
        list.appendChild(link);
      });
    } else {
      channels.forEach(function (match, index) { list.children[index].querySelector('strong').textContent = U.clock(match.elapsedMs); });
    }
  }

  function renderTimeline(highlight, selectedIndex) {
    var list = byId('event-timeline');
    list.replaceChildren();
    highlight.events.forEach(function (event) {
      var item = el('li');
      var link = el('a', event.index === selectedIndex ? 'selected' : '');
      link.href = selectionURL(highlight, event.index, false);
      if (event.index === selectedIndex) link.setAttribute('aria-current', 'true');
      link.appendChild(el('time', '', event.clock));
      link.appendChild(el('b', '', event.title));
      link.appendChild(el('small', '', scoreText(event.score) + ' · ' + event.athlete.name));
      item.appendChild(link);
      list.appendChild(item);
    });
  }
  function renderCards(selectedIndex) {
    var grid = byId('highlight-grid');
    grid.replaceChildren();
    cards.forEach(function (highlight) {
      var eventIndex = highlight.sport.id === active.highlight.sport.id ? selectedIndex : C.hash(highlight.matchId + '|pick') % 3;
      var event = highlight.events[eventIndex];
      var link = el('a', 'highlight-card');
      link.href = selectionURL(highlight, eventIndex, false);
      link.style.setProperty('--card', highlight.config.color);
      if (highlight.sport.id === active.highlight.sport.id) link.setAttribute('aria-current', 'page');
      var top = el('div', 'card-top');
      top.appendChild(el('span', '', highlight.sport.code + ' / ' + highlight.sport.name.toUpperCase()));
      top.appendChild(el('span', 'card-status', highlight.canonical ? 'CANONICAL UTC' : 'EXHIBITION'));
      link.appendChild(top);
      link.appendChild(el('h3', '', event.title));
      var score = el('div', 'card-score');
      var matchup = el('span', '', highlight.home.code + ' vs ' + highlight.away.code);
      score.appendChild(matchup);
      score.appendChild(el('strong', '', scoreText(event.score)));
      link.appendChild(score);
      var footer = el('div', 'card-footer');
      footer.appendChild(el('span', '', event.clock + ' · ' + event.athlete.name));
      footer.appendChild(el('b', '', 'WATCH ↗'));
      link.appendChild(footer);
      grid.appendChild(link);
    });
  }
  function setLink(id, href) { byId(id).href = href; }
  function renderSelected(highlight, eventIndex, updateHistory) {
    eventIndex = validEventIndex(eventIndex, highlight.events.length - 1);
    var event = highlight.events[eventIndex];
    active = { highlight: highlight, event: event };
    previewMs = 0;
    playing = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    byId('play-toggle').textContent = playing ? 'PAUSE' : 'PLAY';
    byId('play-toggle').setAttribute('aria-label', playing ? 'Pause replay preview' : 'Play replay preview');
    byId('scrubber').value = '0';
    byId('preview-clock').textContent = '00:00';
    byId('edition-label').textContent = 'EDITION ' + highlight.edition;
    byId('source-badge').textContent = highlight.status;
    byId('source-badge').style.color = highlight.canonical ? '#d9ff43' : '#f1efe5';
    byId('replay-id').textContent = highlight.matchId + ' / EVT-' + pad(event.index + 1);
    byId('sport-name').textContent = highlight.sport.name;
    byId('league-name').textContent = highlight.sport.league;
    byId('replay-title').textContent = event.title;
    byId('event-call').textContent = event.call;
    byId('home-code').textContent = highlight.home.code;
    byId('home-name').textContent = highlight.home.name;
    byId('away-code').textContent = highlight.away.code;
    byId('away-name').textContent = highlight.away.name;
    byId('score-context').textContent = scoreText(event.score);
    byId('athlete-number').textContent = '#' + event.athlete.number;
    byId('athlete-name').textContent = event.athlete.name;
    byId('athlete-role').textContent = event.athlete.role + ' · ' + event.team.name;
    byId('athlete-number').style.setProperty('--team-color', event.team.colors.primary);
    byId('provenance').textContent = highlight.canonical
      ? 'CANONICAL BOUNDARY · This replay is a deterministic desk reconstruction attached to the canonical UTC soccer fixture ' + highlight.matchId + '. It does not claim a server-stored video archive or authoritative event log.'
      : 'EXHIBITION BOUNDARY · This is a deterministic ' + highlight.sport.name.toLowerCase() + ' exhibition recap generated from shared world content. It is not a canonical live result or stored broadcast.';
    var permanent = selectionURL(highlight, event.index, true);
    byId('permalink').textContent = permanent;
    var query = studioQuery(highlight, event);
    var arena = highlight.config.route + (highlight.canonical ? '?match=' + encodeURIComponent(highlight.matchId) : '?home=' + encodeURIComponent(highlight.home.id) + '&away=' + encodeURIComponent(highlight.away.id));
    setLink('arena-link', arena);
    setLink('wire-link', 'social.html?sport=' + encodeURIComponent(highlight.sport.id) + '&team=' + encodeURIComponent(event.team.id));
    setLink('moment-link', 'moment.html?' + query);
    setLink('clip-link', 'clip.html?' + query);
    setLink('profile-link', 'player.html?sport=' + encodeURIComponent(highlight.sport.id) + '&team=' + encodeURIComponent(event.team.id) + '&player=' + encodeURIComponent(event.athlete.id));
    setLink('atlas-link', 'league.html?sport=' + encodeURIComponent(highlight.sport.id));
    renderTimeline(highlight, event.index);
    renderCards(event.index);
    draw();
    if (updateHistory) history.replaceState(null, '', selectionURL(highlight, event.index, false));
  }

  function roundedRect(context, x, y, w, h, radius) {
    context.beginPath();
    context.roundRect(x, y, w, h, radius);
  }
  function drawBlob(x, y, color, scale, flip, phase, number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip, 1);
    ctx.rotate(Math.sin(phase) * .08);
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(0, 22 * scale, 18 * scale, 6 * scale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0, 0, 16 * scale, 22 * scale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(1 * scale, -25 * scale, 11 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 7 * scale; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-9 * scale, -4 * scale); ctx.lineTo((-20 + Math.sin(phase) * 5) * scale, 8 * scale); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(9 * scale, -4 * scale); ctx.lineTo((19 - Math.sin(phase) * 5) * scale, -1 * scale); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '800 ' + Math.max(7, 8 * scale) + 'px ' + getComputedStyle(document.documentElement).getPropertyValue('--mono'); ctx.textAlign = 'center'; ctx.fillText(String(number), 0, 4 * scale);
    ctx.restore();
  }
  function fieldLines(sportId, config) {
    var W = canvas.width, H = canvas.height;
    ctx.fillStyle = config.surface; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = .18;
    var gradient = ctx.createRadialGradient(W * .54, H * .45, 10, W * .54, H * .45, W * .7);
    gradient.addColorStop(0, '#fff'); gradient.addColorStop(1, '#000'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1; ctx.strokeStyle = config.line; ctx.lineWidth = 3;
    if (sportId === 'basketball') {
      ctx.strokeRect(70, 48, W - 140, H - 96); ctx.beginPath(); ctx.moveTo(W / 2, 48); ctx.lineTo(W / 2, H - 48); ctx.stroke();
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 70, 0, Math.PI * 2); ctx.stroke();
      [1, -1].forEach(function (side) { var x = side > 0 ? W - 126 : 126; ctx.strokeRect(side > 0 ? W - 260 : 70, 160, 190, 220); ctx.beginPath(); ctx.arc(x, H / 2, 38, 0, Math.PI * 2); ctx.stroke(); });
    } else if (sportId === 'hockey') {
      roundedRect(ctx, 50, 55, W - 100, H - 110, 90); ctx.stroke(); ctx.strokeStyle = '#c85761'; ctx.beginPath(); ctx.moveTo(W / 2, 56); ctx.lineTo(W / 2, H - 56); ctx.stroke();
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 62, 0, Math.PI * 2); ctx.stroke();
    } else if (sportId === 'baseball') {
      ctx.fillStyle = '#b98855'; ctx.save(); ctx.translate(W / 2, H * .56); ctx.rotate(Math.PI / 4); ctx.fillRect(-160, -160, 320, 320); ctx.restore();
      ctx.fillStyle = config.surface; ctx.beginPath(); ctx.arc(W / 2, H * .56, 94, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e7dfc5'; ctx.fillRect(W / 2 - 8, H * .56 - 8, 16, 16);
    } else if (sportId === 'combat') {
      ctx.fillStyle = '#ded7c5'; ctx.fillRect(112, 70, W - 224, H - 140); ctx.strokeStyle = config.line; ctx.lineWidth = 6;
      for (var rope = 0; rope < 3; rope += 1) ctx.strokeRect(95 - rope * 8, 54 - rope * 8, W - 190 + rope * 16, H - 108 + rope * 16);
    } else {
      ctx.strokeRect(55, 56, W - 110, H - 112); ctx.beginPath(); ctx.moveTo(W / 2, 56); ctx.lineTo(W / 2, H - 56); ctx.stroke();
      if (sportId === 'soccer') { ctx.beginPath(); ctx.arc(W / 2, H / 2, 66, 0, Math.PI * 2); ctx.stroke(); ctx.strokeRect(55, 176, 130, 188); ctx.strokeRect(W - 185, 176, 130, 188); }
      else { for (var yard = 1; yard < 10; yard += 1) { var x = 55 + yard * (W - 110) / 10; ctx.globalAlpha = yard === 5 ? 1 : .38; ctx.beginPath(); ctx.moveTo(x, 56); ctx.lineTo(x, H - 56); ctx.stroke(); } ctx.globalAlpha = 1; }
    }
    ctx.fillStyle = 'rgba(0,0,0,.24)'; ctx.fillRect(0, H - 54, W, 54);
  }
  function draw() {
    if (!active) return;
    var highlight = active.highlight, event = active.event, config = highlight.config;
    var p = previewMs / PREVIEW_MS;
    fieldLines(highlight.sport.id, config);
    var homeColor = highlight.home.colors.primary, awayColor = highlight.away.colors.primary;
    var i, x, y, attack = p < .5 ? p * 2 : 1 - (p - .5) * .12;
    for (i = 0; i < 5; i += 1) {
      x = 210 + i * 78 + Math.sin(p * 8 + i) * 26 + attack * 110;
      y = 165 + (i % 3) * 82 + Math.cos(p * 9 + i * 1.7) * 18;
      drawBlob(x, y, i === 2 ? event.team.colors.primary : homeColor, .82 + (i % 2) * .12, 1, p * 20 + i, highlight.home.athletes[i % highlight.home.athletes.length].number);
    }
    for (i = 0; i < 5; i += 1) {
      x = 750 - i * 72 + Math.sin(p * 7 + i * 1.4) * 25 - attack * 40;
      y = 150 + (i % 3) * 88 + Math.cos(p * 8 + i) * 17;
      drawBlob(x, y, awayColor, .82 + (i % 2) * .12, -1, p * 19 + i, highlight.away.athletes[i % highlight.away.athletes.length].number);
    }
    var bx = 230 + 560 * (p < .72 ? (p / .72) : 1 - (p - .72) * .12);
    var by = 302 - Math.sin(clamp(p / .72, 0, 1) * Math.PI) * 155;
    ctx.fillStyle = highlight.sport.id === 'hockey' ? '#151716' : (highlight.sport.id === 'american-football' ? '#7b4525' : '#fff');
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(bx, by, highlight.sport.id === 'american-football' ? 14 : 9, highlight.sport.id === 'american-football' ? 8 : 9, -.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    var flash = Math.max(0, 1 - Math.abs(p - .72) / .1);
    if (flash > 0) { ctx.strokeStyle = config.color; ctx.lineWidth = 4; ctx.globalAlpha = flash; ctx.beginPath(); ctx.arc(bx, by, 25 + flash * 38, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    var shade = ctx.createLinearGradient(0, 0, 0, 150); shade.addColorStop(0, 'rgba(5,7,6,.82)'); shade.addColorStop(1, 'rgba(5,7,6,0)'); ctx.fillStyle = shade; ctx.fillRect(0, 0, canvas.width, 160);
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '900 28px Arial'; ctx.fillText(event.title, 30, 79);
    ctx.fillStyle = config.color; ctx.font = '800 13px ui-monospace, monospace'; ctx.fillText(highlight.sport.name.toUpperCase() + ' · ' + event.clock + ' · ' + event.athlete.name.toUpperCase(), 31, 105);
    ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = '900 31px ui-monospace, monospace'; ctx.fillText(scoreText(event.score), canvas.width - 30, 79);
    ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(30, canvas.height - 27, canvas.width - 60, 3);
    ctx.fillStyle = config.color; ctx.fillRect(30, canvas.height - 27, (canvas.width - 60) * p, 3);
    byId('scrubber').value = String(Math.round(previewMs));
    byId('preview-clock').textContent = formatPreview(previewMs);
  }
  function update(delta) {
    if (!playing) return;
    previewMs += delta;
    if (previewMs >= PREVIEW_MS) previewMs %= PREVIEW_MS;
  }
  function frame(now) {
    var delta = Math.min(80, Math.max(0, now - lastFrame));
    lastFrame = now;
    update(delta);
    draw();
    requestAnimationFrame(frame);
  }

  function boot() {
    if (!C || !U) {
      document.body.textContent = 'The shared Cyberliga world model could not load.';
      return;
    }
    var edition = validEdition(queryValue('edition'));
    cards = C.sports.map(function (sport) { return buildHighlight(sport, edition); });
    var wantedSport = C.getSport(queryValue('sport')) || cards[C.hash('replay-lead|' + edition) % cards.length].sport;
    var highlight = cards.filter(function (item) { return item.sport.id === wantedSport.id; })[0];
    var eventIndex = validEventIndex(queryValue('event'), 2);
    renderChannels();
    renderSelected(highlight, eventIndex, true);
    byId('utc-clock').textContent = new Date(nowMs()).toISOString().slice(11, 19);
    window.setInterval(function () {
      byId('utc-clock').textContent = new Date(nowMs()).toISOString().slice(11, 19);
      renderChannels();
    }, 1000);
    requestAnimationFrame(frame);
  }

  byId('play-toggle').addEventListener('click', function () {
    playing = !playing;
    this.textContent = playing ? 'PAUSE' : 'PLAY';
    this.setAttribute('aria-label', playing ? 'Pause replay preview' : 'Play replay preview');
  });
  byId('restart').addEventListener('click', function () { previewMs = 0; draw(); });
  byId('scrubber').addEventListener('input', function () { previewMs = Number(this.value); playing = false; byId('play-toggle').textContent = 'PLAY'; byId('play-toggle').setAttribute('aria-label', 'Play replay preview'); draw(); });
  byId('copy-link').addEventListener('click', function () {
    var button = this;
    var value = byId('permalink').textContent;
    var copied = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(value) : Promise.reject(new Error('clipboard unavailable'));
    copied.then(function () { button.textContent = 'COPIED'; }).catch(function () { window.prompt('Copy permanent replay URL', value); button.textContent = 'SELECTED'; });
    window.setTimeout(function () { button.textContent = 'COPY'; }, 1300);
  });
  window.addEventListener('keydown', function (event) {
    if (event.metaKey || event.ctrlKey || event.altKey || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(event.target.tagName)) return;
    if (event.code === 'Space') { event.preventDefault(); byId('play-toggle').click(); }
    else if (event.key.toLowerCase() === 'r') { event.preventDefault(); byId('restart').click(); }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); previewMs = clamp(previewMs + (event.key === 'ArrowRight' ? 1000 : -1000), 0, PREVIEW_MS); playing = false; byId('play-toggle').textContent = 'PLAY'; draw(); }
  });

  window.render_game_to_text = function () {
    if (!active) return JSON.stringify({ screen: 'replay-center', ready: false });
    return JSON.stringify({
      screen: 'replay-center',
      ready: true,
      coordinateSystem: 'preview canvas origin top-left; +x right; +y down; 960x540',
      edition: active.highlight.edition,
      selected: {
        sport: active.highlight.sport.id,
        status: active.highlight.status.toLowerCase(),
        canonicalSchedule: active.highlight.canonical,
        matchId: active.highlight.matchId,
        eventIndex: active.event.index,
        eventClock: active.event.clock,
        event: active.event.title,
        scoreContext: { home: active.event.score[0], away: active.event.score[1] },
        teams: { home: active.highlight.home.name, away: active.highlight.away.name },
        athlete: { id: active.event.athlete.id, name: active.event.athlete.name, number: active.event.athlete.number, role: active.event.athlete.role, team: active.event.team.name },
        permanentURL: selectionURL(active.highlight, active.event.index, true)
      },
      preview: { playing: playing, elapsedMs: Math.round(previewMs), durationMs: PREVIEW_MS },
      timeline: active.highlight.events.map(function (event) { return { index: event.index, clock: event.clock, title: event.title, score: event.score, athlete: event.athlete.name, selected: event.index === active.event.index }; }),
      canonicalSoccerChannels: channels.map(function (match) { return { channel: match.channel + 1, id: match.id, home: match.home.name, away: match.away.name, elapsedMs: match.elapsedMs, href: U.sharePath(match) }; }),
      recentHighlights: cards.map(function (item) { return { sport: item.sport.id, matchId: item.matchId, status: item.status.toLowerCase(), home: item.home.name, away: item.away.name }; }),
      truthBoundary: 'soccer uses the canonical shared UTC fixture schedule with a deterministic desk reconstruction; all other sports are deterministic exhibition recaps',
      destinations: { arena: byId('arena-link').getAttribute('href'), wire: byId('wire-link').getAttribute('href'), moment: byId('moment-link').getAttribute('href'), clip: byId('clip-link').getAttribute('href'), profile: byId('profile-link').getAttribute('href'), atlas: byId('atlas-link').getAttribute('href'), guide: 'menu.html', world: 'world.html' },
      controls: ['Space play/pause', 'R restart', 'Left/Right scrub one second', 'timeline and range controls']
    });
  };
  window.advanceTime = function (milliseconds) {
    var amount = Number(milliseconds);
    if (Number.isFinite(amount)) {
      playing = false;
      byId('play-toggle').textContent = 'PLAY';
      byId('play-toggle').setAttribute('aria-label', 'Play replay preview');
      previewMs = (previewMs + Math.max(0, amount)) % PREVIEW_MS;
      draw();
    }
    return window.render_game_to_text();
  };

  boot();
})();
