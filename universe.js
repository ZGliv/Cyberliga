(function (global) {
  'use strict';

  // The public prototype runs from one UTC clock. A viewer never creates a
  // fixture: they tune into one of the two channels already in progress.
  var SLOT_MS = 6 * 60 * 1000;
  var EPOCH_MS = Date.UTC(2026, 6, 10, 0, 0, 0);
  var CITY_COORDS = {
    'Tokyo': [35.6762, 139.6503], 'Osaka': [34.6937, 135.5023],
    'Berlin': [52.5200, 13.4050], 'London': [51.5074, -0.1278],
    'Sao Paulo': [-23.5505, -46.6333], 'Valparaiso': [-33.0472, -71.6127],
    'Lagos': [6.5244, 3.3792], 'Marrakech': [31.6295, -7.9811]
  };
  var contentTeams = global.CYBERLIGA_CONTENT && global.CYBERLIGA_CONTENT.getTeams('soccer');
  var TEAMS = contentTeams && contentTeams.length ? contentTeams.map(function (team, index) {
    var coords = CITY_COORDS[team.city] || [0, 0];
    return { id: team.id, index: index, name: team.name, city: team.city, code: team.code,
      color: team.colors.primary, lat: coords[0], lon: coords[1] };
  }) : [
    { id: 'neon-fc', index: 0, name: 'NEON FC', city: 'Tokyo', code: 'NFC', color: '#00e5ff', lat: 35.6762, lon: 139.6503 },
    { id: 'volt-utd', index: 1, name: 'VOLT UTD', city: 'Berlin', code: 'VLT', color: '#ff2d78', lat: 52.5200, lon: 13.4050 },
    { id: 'grid-royals', index: 2, name: 'GRID ROYALS', city: 'London', code: 'GRD', color: '#ffc24d', lat: 51.5074, lon: -0.1278 },
    { id: 'astra-nova', index: 3, name: 'ASTRA NOVA', city: 'Sao Paulo', code: 'AST', color: '#8a5cff', lat: -23.5505, lon: -46.6333 }
  ];

  function buildRounds(count) {
    var ring = Array.from({ length: count }, function (_, i) { return i; });
    var firstLeg = [];
    for (var round = 0; round < count - 1; round++) {
      var pairs = [];
      for (var i = 0; i < count / 2; i++) {
        var home = ring[i], away = ring[count - 1 - i];
        pairs.push(round % 2 && i === 0 ? [away, home] : [home, away]);
      }
      firstLeg.push(pairs);
      ring.splice(1, 0, ring.pop());
    }
    return firstLeg.concat(firstLeg.map(function (pairs) {
      return pairs.map(function (pair) { return [pair[1], pair[0]]; });
    }));
  }
  var ROUNDS = buildRounds(TEAMS.length);

  function hash(text) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seededRandom(seed) {
    var a = typeof seed === 'number' ? seed >>> 0 : hash(String(seed));
    return function () {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function slotAt(now) {
    return Math.max(0, Math.floor((now - EPOCH_MS) / SLOT_MS));
  }

  function liveMatches(now) {
    now = Number(now || Date.now());
    var slot = slotAt(now);
    var roundIndex = slot % ROUNDS.length;
    var startsAt = EPOCH_MS + slot * SLOT_MS;
    return ROUNDS[roundIndex].map(function (pair, channel) {
      var home = TEAMS[pair[0]];
      var away = TEAMS[pair[1]];
      var id = 'CL-' + slot + '-' + channel;
      return {
        id: id,
        channel: channel,
        slot: slot,
        seed: hash(id + '|' + home.id + '|' + away.id),
        round: slot + 1,
        cycle: Math.floor(slot / ROUNDS.length) + 1,
        startsAt: startsAt,
        endsAt: startsAt + SLOT_MS,
        durationMs: SLOT_MS,
        elapsedMs: Math.max(0, Math.min(SLOT_MS - 1, now - startsAt)),
        home: home,
        away: away
      };
    });
  }

  function selected(search, now) {
    var matches = liveMatches(now);
    var params = new URLSearchParams(search || global.location.search || '');
    var wanted = params.get('match');
    var exact = matches.find(function (match) { return match.id === wanted; });
    if (exact) return exact;
    if (wanted) {
      var oldChannel = Number(wanted.split('-').pop());
      if (oldChannel >= 0 && oldChannel < matches.length) return matches[oldChannel];
    }
    var team = params.get('team') || params.get('city');
    return matches.find(function (match) {
      return match.home.id === team || match.away.id === team;
    }) || matches[0];
  }

  function clock(ms) {
    var seconds = Math.max(0, Math.floor(ms / 1000));
    return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
  }

  function sharePath(match) {
    return 'index.html?match=' + encodeURIComponent(match.id);
  }

  global.CyberligaUniverse = {
    EPOCH_MS: EPOCH_MS,
    SLOT_MS: SLOT_MS,
    TEAMS: TEAMS,
    ROUNDS: ROUNDS,
    hash: hash,
    seededRandom: seededRandom,
    liveMatches: liveMatches,
    selected: selected,
    clock: clock,
    sharePath: sharePath
  };
})(window);
