(function () {
  'use strict';

  var CONTENT = window.CYBERLIGA_CONTENT;
  var UNIVERSE = window.CyberligaUniverse;
  var clockOffset = 0;
  var lastState = null;
  var ROUTES = [
    { id: 'soccer', href: 'index.html', label: 'CANONICAL', color: '#e34f39' },
    { id: 'basketball', href: 'hoops.html', label: 'EXHIBITION', color: '#ffad27' },
    { id: 'hockey', href: 'hockey.html', label: 'EXHIBITION', color: '#66b8cf' },
    { id: 'baseball', href: 'baseball.html', label: 'EXHIBITION', color: '#7eaa58' },
    { id: 'combat', href: 'fight.html', label: 'EXHIBITION', color: '#cd6b65' },
    { id: 'american-football', href: 'football.html', label: 'EXHIBITION', color: '#8870bd' }
  ];

  function byId(id) { return document.getElementById(id); }
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function pad(value) { return String(value).padStart(2, '0'); }
  function utcTime(ms, seconds) {
    var date = new Date(ms);
    return pad(date.getUTCHours()) + ':' + pad(date.getUTCMinutes()) + (seconds ? ':' + pad(date.getUTCSeconds()) : '');
  }
  function countdown(ms) {
    var total = Math.max(0, Math.ceil(ms / 1000));
    return pad(Math.floor(total / 60)) + ':' + pad(total % 60);
  }
  function appendTeam(parent, team) {
    var row = el('div', 'team-row');
    var code = el('span', 'team-code', team.code);
    code.style.setProperty('--team-color', team.color);
    row.appendChild(code);
    row.appendChild(el('span', 'team-name', team.name));
    parent.appendChild(row);
  }

  function renderSports() {
    var grid = byId('sport-grid');
    grid.replaceChildren();
    ROUTES.forEach(function (route, index) {
      var sport = CONTENT.getSport(route.id);
      var link = el('a', 'sport-card');
      link.href = route.href;
      link.style.setProperty('--sport-color', route.color);
      link.setAttribute('aria-label', 'Open ' + sport.name + ' arena, ' + route.label.toLowerCase());
      var top = el('div');
      top.style.display = 'contents';
      link.appendChild(el('span', 'sport-index', pad(index + 1) + ' / ' + sport.code));
      link.appendChild(el('span', 'sport-label', route.label));
      var title = el('h3', '', sport.name);
      title.appendChild(el('small', '', sport.league));
      link.appendChild(title);
      var footer = el('div', 'sport-footer');
      footer.appendChild(el('span', '', sport.teams.length + ' CLUBS'));
      footer.appendChild(el('span', '', route.id === 'soccer' ? 'OPEN LIVE CHANNELS ↗' : 'ENTER PLAYABLE ARENA ↗'));
      link.appendChild(footer);
      grid.appendChild(link);
    });
  }

  function renderClock() {
    if (!UNIVERSE) return;
    var now = Date.now() + clockOffset;
    var matches = UNIVERSE.liveMatches(now);
    var current = matches[0];
    var upcoming = UNIVERSE.liveMatches(current.endsAt + 1);
    lastState = { now: now, matches: matches, upcoming: upcoming };
    byId('utc-time').textContent = utcTime(now, true);
    byId('cycle-number').textContent = current.cycle;
    byId('round-number').textContent = current.round;
    byId('next-countdown').textContent = countdown(current.endsAt - now);

    var activeChannel = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.channel : null;
    var grid = byId('channel-grid');
    var rebuildChannels = grid.children.length !== matches.length || matches.some(function (match, index) {
      return !grid.children[index] || grid.children[index].dataset.match !== match.id;
    });
    if (rebuildChannels) {
      grid.replaceChildren();
      matches.forEach(function (match, index) {
        var link = el('a', 'channel-card');
        link.href = UNIVERSE.sharePath(match);
        link.dataset.channel = String(index + 1);
        link.dataset.match = match.id;
        link.setAttribute('aria-label', 'Channel ' + (index + 1) + ': ' + match.home.name + ' versus ' + match.away.name + ', ' + UNIVERSE.clock(match.elapsedMs) + ' elapsed');
        var top = el('div', 'channel-top');
        top.appendChild(el('span', 'on-air', 'CH ' + pad(index + 1)));
        top.appendChild(el('span', 'channel-clock', UNIVERSE.clock(match.elapsedMs)));
        link.appendChild(top);
        var matchup = el('div', 'matchup');
        appendTeam(matchup, match.home);
        appendTeam(matchup, match.away);
        link.appendChild(matchup);
        var bottom = el('div', 'channel-bottom');
        var meta = el('p', 'channel-meta', 'ROUND ' + match.round + ' · UTC WINDOW\nCANONICAL FIXTURE');
        meta.style.whiteSpace = 'pre-line';
        bottom.appendChild(meta);
        bottom.appendChild(el('span', 'tune-arrow', '↗'));
        link.appendChild(bottom);
        var progress = el('span', 'progress');
        var bar = el('span');
        progress.appendChild(bar);
        link.appendChild(progress);
        grid.appendChild(link);
      });
      if (activeChannel) {
        var restored = grid.querySelector('[data-channel="' + activeChannel + '"]');
        if (restored) restored.focus({ preventScroll: true });
      }
    }
    matches.forEach(function (match, index) {
      var card = grid.children[index];
      card.querySelector('.channel-clock').textContent = UNIVERSE.clock(match.elapsedMs);
      card.querySelector('.progress span').style.width = Math.min(100, match.elapsedMs / match.durationMs * 100).toFixed(2) + '%';
      card.setAttribute('aria-label', 'Channel ' + (index + 1) + ': ' + match.home.name + ' versus ' + match.away.name + ', ' + UNIVERSE.clock(match.elapsedMs) + ' elapsed');
    });

    var list = byId('fixture-list');
    if (list.dataset.slot !== String(upcoming[0].slot)) {
      list.dataset.slot = String(upcoming[0].slot);
      list.replaceChildren();
      upcoming.forEach(function (match, index) {
        var item = el('li');
        item.appendChild(el('span', 'fixture-channel', 'CH ' + pad(index + 1)));
        var teams = el('div', 'fixture-teams');
        teams.appendChild(document.createTextNode(match.home.name));
        teams.appendChild(el('span', '', 'VS'));
        teams.appendChild(document.createTextNode(match.away.name));
        item.appendChild(teams);
        var time = el('time', 'fixture-time', utcTime(match.startsAt, false));
        time.dateTime = new Date(match.startsAt).toISOString();
        time.appendChild(el('small', '', 'UTC · ROUND ' + match.round));
        item.appendChild(time);
        list.appendChild(item);
      });
    }
  }

  function unavailable() {
    var grid = byId('channel-grid');
    grid.replaceChildren(el('p', 'channel-card', 'The shared world model did not load. Open an arena directly below.'));
  }

  if (CONTENT) renderSports();
  if (CONTENT && UNIVERSE) renderClock(); else unavailable();
  var timer = window.setInterval(renderClock, 1000);

  window.addEventListener('keydown', function (event) {
    if (event.metaKey || event.ctrlKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    if (/^[1-4]$/.test(event.key)) {
      var channel = document.querySelector('[data-channel="' + event.key + '"]');
      if (channel) { event.preventDefault(); channel.click(); }
    }
  });

  window.render_game_to_text = function () {
    var state = lastState || { now: Date.now() + clockOffset, matches: [], upcoming: [] };
    return JSON.stringify({
      screen: 'broadcast-guide',
      coordinateSystem: 'responsive DOM; document origin top-left',
      clock: { utc: new Date(state.now).toISOString(), offsetMs: clockOffset },
      canonicalSoccer: {
        source: 'shared deterministic UTC browser simulation',
        channels: state.matches.map(function (match) { return { channel: match.channel + 1, id: match.id, round: match.round, cycle: match.cycle, home: match.home.name, away: match.away.name, elapsedMs: match.elapsedMs, durationMs: match.durationMs, href: UNIVERSE.sharePath(match) }; }),
        nextWindowInMs: state.matches.length ? Math.max(0, state.matches[0].endsAt - state.now) : null,
        upcoming: state.upcoming.map(function (match) { return { channel: match.channel + 1, round: match.round, home: match.home.name, away: match.away.name, startsAt: new Date(match.startsAt).toISOString() }; })
      },
      arenas: ROUTES.map(function (route) { var sport = CONTENT && CONTENT.getSport(route.id); return { id: route.id, name: sport ? sport.name : route.id, href: route.href, mode: route.label.toLowerCase() }; }),
      destinations: ['world.html', 'league.html', 'social.html', 'moment.html', 'clip.html', 'replay.html', 'player.html', 'characterlab.html', 'ops.html'],
      controls: ['links and Tab navigation', 'number keys 1–4 tune to soccer channel']
    });
  };

  window.advanceTime = function (milliseconds) {
    var amount = Number(milliseconds);
    if (Number.isFinite(amount)) clockOffset += amount;
    renderClock();
    return window.render_game_to_text();
  };

  window.addEventListener('pagehide', function () { window.clearInterval(timer); }, { once: true });
})();
