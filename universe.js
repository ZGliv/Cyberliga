(function (global) {
  'use strict';

  // The public prototype runs from one UTC clock. A viewer never creates a
  // fixture: they tune into one of the two channels already in progress.
  var SLOT_MS = 6 * 60 * 1000;
  var EPOCH_MS = Date.UTC(2026, 6, 10, 0, 0, 0);
  var TEAMS = [
    { id: 'neon-fc', index: 0, name: 'NEON FC', city: 'Tokyo', code: 'NFC', color: '#00e5ff', lat: 35.6762, lon: 139.6503, star: 'RAZOR', portrait: 'portraits/NEON FC_RAZOR.png', plannedPortrait: 'portraits-v2/razor.png', line: 'Speed is a belief system.', story: 'Razor has scored in three straight signal windows. Every defender knows the first move. Nobody has stopped the second.' },
    { id: 'volt-utd', index: 1, name: 'VOLT UTD', city: 'Berlin', code: 'VLT', color: '#ff2d78', lat: 52.5200, lon: 13.4050, star: 'NOVA', portrait: 'portraits/VOLT UTD_NOVA.png', plannedPortrait: 'portraits-v2/nova.png', line: 'Celebrity is another kind of pressure.', story: 'Nova called the last defeat a systems failure, then asked for the ball in every dangerous position.' },
    { id: 'grid-royals', index: 2, name: 'GRID ROYALS', city: 'London', code: 'GRD', color: '#ffc24d', lat: 51.5074, lon: -0.1278, star: 'CIRCUIT', portrait: 'portraits/GRID ROYALS_CIRCUIT.png', plannedPortrait: 'portraits-v2/circuit.png', line: 'The crown is worn in possession.', story: 'Circuit has turned control into provocation. Opponents are now pressing the Royals just to make the smirk disappear.' },
    { id: 'astra-nova', index: 3, name: 'ASTRA NOVA', city: 'S\u00e3o Paulo', code: 'AST', color: '#8a5cff', lat: -23.5505, lon: -46.6333, star: 'NEBULA', portrait: 'portraits/ASTRA NOVA_NEBULA.png', plannedPortrait: 'portraits-v2/nebula.png', line: 'The pass exists before the space does.', story: 'Nebula sees runs before they happen. Astra supporters have started counting the seconds between the thought and the assist.' }
  ];
  var ROUNDS = [
    [[0, 1], [2, 3]],
    [[0, 2], [1, 3]],
    [[0, 3], [1, 2]],
    [[1, 0], [3, 2]],
    [[2, 0], [3, 1]],
    [[3, 0], [2, 1]]
  ];

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
      if (oldChannel === 0 || oldChannel === 1) return matches[oldChannel];
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
    return 'index.html?match=' + encodeURIComponent(match.id) + '&style=classic';
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
