(function bootstrapCyberligaNamedMoments(root, factory) {
  'use strict';

  var api = factory(root);
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else root.CyberligaNamedMoments = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createNamedMomentsApi(root) {
  'use strict';

  // Capture the two identity authorities once. Replacing similarly shaped globals
  // later cannot make cloned clubs, athletes, or character records canonical.
  var CONTENT = root && root.CYBERLIGA_CONTENT;
  var CHARACTERS = root && root.CyberligaCharacters;
  var VERSION = '1.0.0';
  var SCHEMA_VERSION = 1;
  var MAX_CANDIDATES = 12;
  var MAX_TOP = 3;
  var SPORT_IDS = Object.freeze([
    'soccer', 'american-football', 'basketball', 'hockey', 'baseball', 'combat'
  ]);

  function deepFreeze(value, seen) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    var visited = seen || [];
    if (visited.indexOf(value) >= 0) return value;
    visited.push(value);
    Object.keys(value).forEach(function freezeChild(key) { deepFreeze(value[key], visited); });
    return Object.freeze(value);
  }

  var EVENT_DEFINITIONS = deepFreeze({
    soccer: {
      goal: { title: 'GOAL', priority: 100 },
      penalty_save: { title: 'PENALTY DENIED', priority: 94 },
      save: { title: 'FULL-STRETCH SAVE', priority: 78 },
      bicycle_kick: { title: 'OVERHEAD ATTEMPT', priority: 73 },
      juke: { title: 'ANKLE BREAK', priority: 72 },
      red_card: { title: 'RED CARD', priority: 70 }
    },
    'american-football': {
      touchdown: { title: 'TOUCHDOWN', priority: 100 },
      safety: { title: 'SAFETY', priority: 96 },
      interception: { title: 'INTERCEPTION', priority: 90 },
      fumble_recovery: { title: 'FUMBLE RECOVERY', priority: 88 },
      field_goal: { title: 'FIELD GOAL', priority: 82 },
      contested_catch: { title: 'CONTESTED CATCH', priority: 76 },
      explosive_play: { title: 'EXPLOSIVE PLAY', priority: 73 },
      sack: { title: 'SACK', priority: 68 }
    },
    basketball: {
      buzzer_beater: { title: 'BUZZER BEATER', priority: 100 },
      dunk: { title: 'SLAM', priority: 88 },
      three_pointer: { title: 'THREE-POINTER', priority: 80 },
      block: { title: 'BLOCK', priority: 77 },
      steal: { title: 'STEAL', priority: 72 },
      basket: { title: 'BUCKET', priority: 60 }
    },
    hockey: {
      goal: { title: 'GOAL', priority: 100 },
      one_timer: { title: 'ONE-TIMER', priority: 86 },
      breakaway: { title: 'BREAKAWAY', priority: 82 },
      save: { title: 'BIG SAVE', priority: 79 },
      slap_shot: { title: 'SLAP SHOT', priority: 72 },
      shot_block: { title: 'SHOT BLOCK', priority: 69 },
      check: { title: 'OPEN-ICE CHECK', priority: 64 }
    },
    baseball: {
      grand_slam: { title: 'GRAND SLAM', priority: 100 },
      home_run: { title: 'HOME RUN', priority: 91 },
      wall_robbery: { title: 'WALL ROBBERY', priority: 88 },
      double_play: { title: 'DOUBLE PLAY', priority: 78 },
      triple: { title: 'TRIPLE', priority: 75 },
      run: { title: 'RUN SCORED', priority: 66 },
      strikeout: { title: 'STRIKEOUT', priority: 62 }
    },
    combat: {
      knockout: { title: 'KNOCKOUT', priority: 100 },
      technical_knockout: { title: 'TECHNICAL KNOCKOUT', priority: 98 },
      knockdown: { title: 'KNOCKDOWN', priority: 90 },
      decision: { title: 'DECISION', priority: 84 },
      perfect_counter: { title: 'PERFECT COUNTER', priority: 78 },
      last_stand: { title: 'LAST STAND', priority: 74 },
      guard_break: { title: 'GUARD BREAK', priority: 70 },
      round_won: { title: 'ROUND WON', priority: 64 }
    }
  });

  var EVENT_KINDS = deepFreeze(SPORT_IDS.reduce(function buildKinds(output, sportId) {
    output[sportId] = Object.keys(EVENT_DEFINITIONS[sportId]);
    return output;
  }, {}));
  var EVENT_TITLES = deepFreeze(SPORT_IDS.reduce(function buildTitles(output, sportId) {
    output[sportId] = Object.keys(EVENT_DEFINITIONS[sportId]).reduce(function mapTitle(titles, kind) {
      titles[kind] = EVENT_DEFINITIONS[sportId][kind].title;
      return titles;
    }, {});
    return output;
  }, {}));
  var LIMITS = deepFreeze({ candidates: MAX_CANDIDATES, top: MAX_TOP });
  var SAFETY = deepFreeze({
    source: 'local-client',
    authoritative: false,
    wagerable: false,
    settles: false,
    recordedFootage: false
  });

  function plainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
  function own(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }
  function identifier(value, maximum) {
    if (typeof value !== 'string' || !value || value !== value.trim() || value.length > maximum) return '';
    return /^[a-z0-9][a-z0-9._:|\-]*$/i.test(value) ? value : '';
  }
  function finiteInteger(value, minimum, maximum) {
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.trunc(value) !== value) return null;
    return value < minimum || value > maximum ? null : value;
  }
  function finiteUnit(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
  }
  function safeClock(value) {
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0 && value <= 86400000 ? value : null;
    if (typeof value !== 'string' || !value || value !== value.trim() || value.length > 48) return null;
    return /[<>\u0000-\u001f\u007f]/.test(value) ? null : value;
  }
  function scorePair(value) {
    if (!plainObject(value)) return null;
    var home = finiteInteger(value.home, 0, 9999);
    var away = finiteInteger(value.away, 0, 9999);
    return home == null || away == null ? null : deepFreeze({ home: home, away: away });
  }
  function encodeQuery(entries) {
    return entries.filter(function present(entry) { return entry[1] != null; }).map(function encode(entry) {
      return encodeURIComponent(entry[0]) + '=' + encodeURIComponent(String(entry[1]));
    }).join('&');
  }
  function lexical(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
  }

  // Build closed-over reference maps now rather than resolving through a caller-
  // supplied adapter. These maps are private and are never frozen, so canonical
  // product objects retain their existing mutability contract.
  var CANONICAL_SPORTS = Object.create(null);
  var CANONICAL_TEAMS = Object.create(null);
  var CANONICAL_ATHLETES = Object.create(null);
  var FOUNDING = Object.create(null);
  var HASH = CONTENT && typeof CONTENT.hash === 'function' ? CONTENT.hash : null;
  var BOUND = Boolean(
    CONTENT && CHARACTERS && HASH &&
    typeof CONTENT.getSport === 'function' && typeof CONTENT.getTeam === 'function' &&
    typeof CONTENT.getAthlete === 'function' && Array.isArray(CONTENT.sports) &&
    typeof CHARACTERS.get === 'function' && Array.isArray(CHARACTERS.records)
  );

  if (BOUND) {
    SPORT_IDS.forEach(function captureSport(sportId) {
      var sport = CONTENT.getSport(sportId);
      if (!sport || sport.id !== sportId || !Array.isArray(sport.teams)) {
        BOUND = false;
        return;
      }
      CANONICAL_SPORTS[sportId] = sport;
      CANONICAL_TEAMS[sportId] = Object.create(null);
      CANONICAL_ATHLETES[sportId] = Object.create(null);
      sport.teams.forEach(function captureTeam(team) {
        if (!team || team.sportId !== sportId || !identifier(team.id, 120) ||
            CONTENT.getTeam(team.id, sportId) !== team || !Array.isArray(team.athletes)) {
          BOUND = false;
          return;
        }
        CANONICAL_TEAMS[sportId][team.id] = team;
        CANONICAL_ATHLETES[sportId][team.id] = Object.create(null);
        team.athletes.forEach(function captureAthlete(athlete) {
          if (!athlete || !identifier(athlete.id, 120) || CONTENT.getAthlete(team.id, athlete.id) !== athlete) {
            BOUND = false;
            return;
          }
          CANONICAL_ATHLETES[sportId][team.id][athlete.id] = athlete;
        });
      });
    });
    CHARACTERS.records.forEach(function captureFounder(record) {
      if (!record || !identifier(record.id, 120) || CHARACTERS.get(record.id) !== record ||
          SPORT_IDS.indexOf(record.sportId) < 0 || !CANONICAL_TEAMS[record.sportId] ||
          !CANONICAL_TEAMS[record.sportId][record.teamId] ||
          !CANONICAL_ATHLETES[record.sportId][record.teamId][record.id]) {
        BOUND = false;
        return;
      }
      FOUNDING[record.id] = record;
    });
  }

  function sportRecord(sport) {
    return deepFreeze({ id: sport.id, name: sport.name, league: sport.league, code: sport.code });
  }
  function teamRecord(team) {
    return deepFreeze({
      id: team.id,
      sportId: team.sportId,
      name: team.name,
      code: team.code,
      city: team.city,
      color: team.colors && team.colors.primary
    });
  }
  function athleteRecord(athlete) {
    return deepFreeze({
      id: athlete.id,
      name: athlete.name,
      number: athlete.number,
      role: athlete.role,
      archetype: athlete.archetype,
      signature: athlete.signature
    });
  }
  function foundingRecord(record) {
    return record ? deepFreeze({
      founding: true,
      body: record.body,
      motionName: record.motionName
    }) : deepFreeze({ founding: false, body: null, motionName: null });
  }
  function provenance(recordedFootage) {
    return deepFreeze({
      source: 'local-client',
      authoritative: false,
      wagerable: false,
      settles: false,
      recordedFootage: recordedFootage === true
    });
  }
  function stableId(fixtureId, eventKey, kind, athleteId) {
    var value = [fixtureId, eventKey, kind, athleteId].join('|');
    return 'moment-' + HASH(value).toString(36).padStart(7, '0');
  }
  function playerHref(sportId, teamId, athleteId) {
    return 'player.html?' + encodeQuery([
      ['sport', sportId], ['team', teamId], ['player', athleteId]
    ]);
  }
  function clipHref(fixture, eventKey, kind, athleteId, title, score) {
    var entries = [
      ['sport', fixture.sportId],
      ['home', fixture.home.id],
      ['away', fixture.away.id]
    ];
    if (score) entries.push(['score', score.home + '-' + score.away]);
    entries.push(
      ['athlete', athleteId],
      ['headline', title],
      ['fixture', fixture.id],
      ['match', fixture.id],
      ['story', eventKey],
      ['event', eventKey],
      ['kind', kind],
      ['eventSource', 'local-client'],
      ['view', 1]
    );
    return 'clip.html?' + encodeQuery(entries);
  }

  function create(options) {
    if (!BOUND || !plainObject(options)) return null;
    var sportId = identifier(options.sportId, 80);
    var fixtureId = identifier(options.fixtureId, 240);
    var sport = CANONICAL_SPORTS[sportId];
    var homeTeam = options.homeTeam;
    var awayTeam = options.awayTeam;
    if (!fixtureId || !sport || !homeTeam || !awayTeam || homeTeam === awayTeam ||
        CANONICAL_TEAMS[sportId][homeTeam.id] !== homeTeam ||
        CANONICAL_TEAMS[sportId][awayTeam.id] !== awayTeam) return null;

    var fixture = deepFreeze({
      id: fixtureId,
      sportId: sportId,
      sport: sportRecord(sport),
      home: teamRecord(homeTeam),
      away: teamRecord(awayTeam)
    });
    var fixtureProvenance = provenance(false);
    var entries = [];
    var seen = Object.create(null);
    var latest = null;
    var ordinal = 0;
    var accepted = 0;
    var duplicates = 0;
    var rejected = 0;

    function ranking(left, right) {
      var scoreDifference = right.moment.rank.score - left.moment.rank.score;
      if (scoreDifference) return scoreDifference;
      var leftOrder = left.moment.sequence == null ? left.ordinal : left.moment.sequence;
      var rightOrder = right.moment.sequence == null ? right.ordinal : right.moment.sequence;
      return rightOrder - leftOrder || lexical(left.moment.id, right.moment.id);
    }
    function candidates() {
      return Object.freeze(entries.slice().sort(function chronological(left, right) {
        return left.ordinal - right.ordinal;
      }).map(function unwrap(entry) { return entry.moment; }));
    }
    function top() {
      return Object.freeze(entries.slice().sort(ranking).slice(0, MAX_TOP).map(function unwrap(entry) {
        return entry.moment;
      }));
    }
    function state() {
      return deepFreeze({
        version: VERSION,
        schemaVersion: SCHEMA_VERSION,
        fixture: fixture,
        provenance: fixtureProvenance,
        latest: latest,
        candidates: candidates(),
        top: top(),
        counts: {
          accepted: accepted,
          duplicates: duplicates,
          rejected: rejected,
          seenEventKeys: Object.keys(seen).length,
          retainedCandidates: entries.length
        }
      });
    }
    function record(input) {
      if (!plainObject(input)) {
        rejected += 1;
        return null;
      }
      var eventKey = identifier(input.eventKey, 240);
      var kind = identifier(input.kind, 80);
      var side = input.side;
      var sideTeam = side === 'home' ? homeTeam : side === 'away' ? awayTeam : null;
      var definition = EVENT_DEFINITIONS[sportId][kind];
      var team = input.team;
      var athlete = input.athlete;
      var canonicalAthlete = sideTeam && athlete && CANONICAL_ATHLETES[sportId][sideTeam.id] &&
        CANONICAL_ATHLETES[sportId][sideTeam.id][athlete.id];
      var sequence = own(input, 'sequence') ? finiteInteger(input.sequence, 0, 999999999) : null;
      var leverage = own(input, 'leverage') ? finiteUnit(input.leverage) : null;
      var clock = own(input, 'clock') ? safeClock(input.clock) : null;
      var score = own(input, 'score') ? scorePair(input.score) : null;
      var recorded = own(input, 'recordedFootage') ? input.recordedFootage : false;
      var malformedOptional =
        (own(input, 'sequence') && sequence == null) ||
        (own(input, 'leverage') && leverage == null) ||
        (own(input, 'clock') && clock == null) ||
        (own(input, 'score') && score == null) ||
        (own(input, 'recordedFootage') && recorded !== true && recorded !== false);
      if (!eventKey || !definition || !sideTeam || team !== sideTeam || canonicalAthlete !== athlete ||
          sideTeam.athletes.indexOf(athlete) < 0 || malformedOptional) {
        rejected += 1;
        return null;
      }
      if (seen[eventKey]) {
        duplicates += 1;
        return null;
      }

      var founder = FOUNDING[athlete.id];
      if (founder && (founder.teamId !== sideTeam.id || founder.sportId !== sportId)) {
        rejected += 1;
        return null;
      }
      var title = founder ? founder.motionName : definition.title;
      var eventLeverage = leverage == null ? 0 : leverage;
      var rankScore = definition.priority * 1000 + Math.round(eventLeverage * 1000);
      var momentProvenance = provenance(recorded === true);
      var moment = deepFreeze({
        schemaVersion: SCHEMA_VERSION,
        id: stableId(fixtureId, eventKey, kind, athlete.id),
        eventKey: eventKey,
        kind: kind,
        title: title,
        eventTitle: definition.title,
        side: side,
        sequence: sequence,
        clock: clock,
        fixture: fixture,
        team: teamRecord(sideTeam),
        athlete: athleteRecord(athlete),
        founding: foundingRecord(founder),
        score: score,
        leverage: leverage,
        rank: { kindPriority: definition.priority, score: rankScore },
        playerHref: playerHref(sportId, sideTeam.id, athlete.id),
        clipHref: clipHref(fixture, eventKey, kind, athlete.id, title, score),
        provenance: momentProvenance
      });
      seen[eventKey] = true;
      ordinal += 1;
      accepted += 1;
      latest = moment;
      entries.push({ moment: moment, ordinal: ordinal });
      if (entries.length > MAX_CANDIDATES) {
        entries = entries.slice().sort(ranking).slice(0, MAX_CANDIDATES);
      }
      return moment;
    }
    function reset() {
      entries = [];
      seen = Object.create(null);
      latest = null;
      ordinal = 0;
      accepted = 0;
      duplicates = 0;
      rejected = 0;
      return state();
    }

    return Object.freeze({
      fixture: fixture,
      provenance: fixtureProvenance,
      record: record,
      state: state,
      candidates: candidates,
      top: top,
      reset: reset
    });
  }

  return Object.freeze({
    version: VERSION,
    schemaVersion: SCHEMA_VERSION,
    ready: BOUND,
    sportIds: SPORT_IDS,
    eventKinds: EVENT_KINDS,
    eventTitles: EVENT_TITLES,
    limits: LIMITS,
    safety: SAFETY,
    create: create
  });
});
