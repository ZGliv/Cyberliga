(function bootstrapCyberligaWitnessChronicle(root, factory) {
  'use strict';

  var api = factory(root);
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else root.CyberligaWitnessChronicle = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createWitnessChronicleApi(root) {
  'use strict';

  // Capture Cyberliga's three identity authorities once. Chronicle receipts can
  // be reconstructed, but lookalike clubs, athletes, and moments cannot become
  // canonical by replacing globals after this module has loaded.
  var CONTENT = root && root.CYBERLIGA_CONTENT;
  var CHARACTERS = root && root.CyberligaCharacters;
  var NAMED = root && root.CyberligaNamedMoments;
  var VERSION = '1.0.0';
  var SCHEMA_VERSION = 1;
  var MAX_ENTRIES = 96;
  var MAX_KEPT = 48;
  var MAX_TIMESTAMP = 8640000000000000;

  function deepFreeze(value, seen) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    var visited = seen || [];
    if (visited.indexOf(value) >= 0) return value;
    visited.push(value);
    Object.keys(value).forEach(function freezeChild(key) { deepFreeze(value[key], visited); });
    return Object.freeze(value);
  }

  var LIMITS = deepFreeze({ total: MAX_ENTRIES, entries: MAX_ENTRIES, kept: MAX_KEPT });
  var SAFETY = deepFreeze({
    source: 'local-witness',
    official: false,
    authoritative: false,
    wagerable: false,
    settles: false,
    money: false,
    prizes: false
  });
  var STORAGE_CONTRACT = deepFreeze({
    scope: 'device-local',
    official: false,
    revalidatedOnLoad: true,
    persisted: [
      'schemaVersion', 'momentId', 'fixtureId', 'eventKey', 'sportId',
      'homeTeamId', 'awayTeamId', 'side', 'teamId', 'athleteId',
      'kind', 'witnessedAt', 'kept'
    ],
    excluded: [
      'headline', 'copy', 'url', 'score', 'clock', 'odds', 'result',
      'recordedFootage', 'officialStatus'
    ]
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
  function timestamp(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.trunc(value) !== value) return null;
    return value < 0 || value > MAX_TIMESTAMP ? null : value;
  }
  function lexical(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
  }
  function newestFirst(left, right) {
    if (left.witnessedAt !== right.witnessedAt) return left.witnessedAt > right.witnessedAt ? -1 : 1;
    return lexical(left.momentId, right.momentId);
  }
  function encodeQuery(entries) {
    return entries.map(function encode(entry) {
      return encodeURIComponent(entry[0]) + '=' + encodeURIComponent(String(entry[1]));
    }).join('&');
  }

  var SPORT_IDS = NAMED && Array.isArray(NAMED.sportIds) ? NAMED.sportIds.slice() : [];
  var CANONICAL_SPORTS = Object.create(null);
  var CANONICAL_TEAMS = Object.create(null);
  var CANONICAL_ATHLETES = Object.create(null);
  var ATHLETE_INDEX = Object.create(null);
  var FOUNDING = Object.create(null);
  var HASH = CONTENT && typeof CONTENT.hash === 'function' ? CONTENT.hash : null;
  var BOUND = Boolean(
    CONTENT && CHARACTERS && NAMED && NAMED.ready === true && HASH &&
    typeof CONTENT.getSport === 'function' && typeof CONTENT.getTeam === 'function' &&
    typeof CONTENT.getAthlete === 'function' && Array.isArray(CONTENT.sports) &&
    typeof CHARACTERS.get === 'function' && Array.isArray(CHARACTERS.records) &&
    typeof NAMED.verify === 'function' && NAMED.eventKinds && NAMED.eventTitles &&
    SPORT_IDS.length === 6
  );

  if (BOUND) {
    SPORT_IDS.forEach(function captureSport(sportId) {
      var canonicalId = identifier(sportId, 80);
      var sport = canonicalId && CONTENT.getSport(canonicalId);
      if (!sport || sport.id !== canonicalId || CONTENT.sports.indexOf(sport) < 0 ||
          !Array.isArray(sport.teams) || !Array.isArray(NAMED.eventKinds[canonicalId]) ||
          !NAMED.eventKinds[canonicalId].length || !plainObject(NAMED.eventTitles[canonicalId])) {
        BOUND = false;
        return;
      }
      CANONICAL_SPORTS[canonicalId] = sport;
      CANONICAL_TEAMS[canonicalId] = Object.create(null);
      CANONICAL_ATHLETES[canonicalId] = Object.create(null);
      sport.teams.forEach(function captureTeam(team) {
        if (!team || team.sportId !== canonicalId || !identifier(team.id, 120) ||
            CONTENT.getTeam(team.id, canonicalId) !== team || !Array.isArray(team.athletes)) {
          BOUND = false;
          return;
        }
        CANONICAL_TEAMS[canonicalId][team.id] = team;
        CANONICAL_ATHLETES[canonicalId][team.id] = Object.create(null);
        team.athletes.forEach(function captureAthlete(athlete) {
          if (!athlete || !identifier(athlete.id, 120) ||
              CONTENT.getAthlete(team.id, athlete.id) !== athlete || ATHLETE_INDEX[athlete.id]) {
            BOUND = false;
            return;
          }
          CANONICAL_ATHLETES[canonicalId][team.id][athlete.id] = athlete;
          ATHLETE_INDEX[athlete.id] = { sportId: canonicalId, teamId: team.id, athlete: athlete };
        });
      });
      NAMED.eventKinds[canonicalId].forEach(function validateKind(kind) {
        if (!identifier(kind, 80) || typeof NAMED.eventTitles[canonicalId][kind] !== 'string' ||
            !NAMED.eventTitles[canonicalId][kind]) BOUND = false;
      });
    });
    CHARACTERS.records.forEach(function captureFounder(record) {
      var indexed = record && ATHLETE_INDEX[record.id];
      if (!record || !identifier(record.id, 120) || CHARACTERS.get(record.id) !== record ||
          !indexed || indexed.sportId !== record.sportId || indexed.teamId !== record.teamId) {
        BOUND = false;
        return;
      }
      FOUNDING[record.id] = record;
    });
  }

  function stableMomentId(fixtureId, eventKey, kind, athleteId) {
    var value = [fixtureId, eventKey, kind, athleteId].map(function frame(part) {
      var text = String(part);
      return text.length + ':' + text;
    }).join('|');
    return 'moment-' + HASH(value).toString(36).padStart(7, '0');
  }

  function witnessId(momentId) {
    return 'witness-' + momentId.slice('moment-'.length);
  }

  function canonicalRaw(input) {
    if (!BOUND || !plainObject(input) || input.schemaVersion !== SCHEMA_VERSION) return null;
    var momentId = identifier(input.momentId, 120);
    var fixtureId = identifier(input.fixtureId, 240);
    var eventKey = identifier(input.eventKey, 240);
    var sportId = identifier(input.sportId, 80);
    var homeTeamId = identifier(input.homeTeamId, 120);
    var awayTeamId = identifier(input.awayTeamId, 120);
    var side = input.side;
    var teamId = identifier(input.teamId, 120);
    var athleteId = identifier(input.athleteId, 120);
    var kind = identifier(input.kind, 80);
    var witnessedAt = timestamp(input.witnessedAt);
    var sport = CANONICAL_SPORTS[sportId];
    var homeTeam = sport && CANONICAL_TEAMS[sportId][homeTeamId];
    var awayTeam = sport && CANONICAL_TEAMS[sportId][awayTeamId];
    var sideTeam = side === 'home' ? homeTeam : side === 'away' ? awayTeam : null;
    var athlete = sideTeam && CANONICAL_ATHLETES[sportId][sideTeam.id] &&
      CANONICAL_ATHLETES[sportId][sideTeam.id][athleteId];
    var validKind = sport && NAMED.eventKinds[sportId].indexOf(kind) >= 0;
    if (!momentId || !fixtureId || !eventKey || !sport || !homeTeam || !awayTeam || homeTeam === awayTeam ||
        !sideTeam || sideTeam.id !== teamId || !athlete || !validKind || witnessedAt == null ||
        typeof input.kept !== 'boolean' || momentId !== stableMomentId(fixtureId, eventKey, kind, athleteId)) return null;
    return {
      schemaVersion: SCHEMA_VERSION,
      momentId: momentId,
      fixtureId: fixtureId,
      eventKey: eventKey,
      sportId: sportId,
      homeTeamId: homeTeamId,
      awayTeamId: awayTeamId,
      side: side,
      teamId: teamId,
      athleteId: athleteId,
      kind: kind,
      witnessedAt: witnessedAt,
      kept: input.kept
    };
  }

  function sportView(sport) {
    return deepFreeze({ id: sport.id, name: sport.name, league: sport.league, code: sport.code });
  }
  function teamView(team) {
    return deepFreeze({
      id: team.id,
      sportId: team.sportId,
      name: team.name,
      code: team.code,
      city: team.city,
      color: team.colors && team.colors.primary
    });
  }
  function athleteView(athlete) {
    return deepFreeze({
      id: athlete.id,
      name: athlete.name,
      number: athlete.number,
      role: athlete.role,
      archetype: athlete.archetype,
      signature: athlete.signature
    });
  }
  function foundingView(record) {
    return record ? deepFreeze({
      founding: true,
      body: record.body,
      motionName: record.motionName
    }) : deepFreeze({ founding: false, body: null, motionName: null });
  }
  function playerHref(raw) {
    return 'player.html?' + encodeQuery([
      ['sport', raw.sportId], ['team', raw.teamId], ['player', raw.athleteId]
    ]);
  }
  function conceptHref(raw, title) {
    return 'clip.html?' + encodeQuery([
      ['sport', raw.sportId],
      ['home', raw.homeTeamId],
      ['away', raw.awayTeamId],
      ['athlete', raw.athleteId],
      ['headline', title],
      ['fixture', raw.fixtureId],
      ['match', raw.fixtureId],
      ['story', raw.eventKey],
      ['event', raw.eventKey],
      ['kind', raw.kind],
      ['eventSource', SAFETY.source],
      ['view', 1]
    ]);
  }

  function create(serialized) {
    if (!BOUND) return null;
    var entries = [];
    var byMoment = Object.create(null);
    var lastReadAt = 0;

    function rebuildIndex() {
      byMoment = Object.create(null);
      entries.forEach(function indexEntry(entry) { byMoment[entry.momentId] = entry; });
    }
    function normalizeBounds() {
      entries.sort(newestFirst);
      var keptSeen = 0;
      entries.forEach(function capKept(entry) {
        if (!entry.kept) return;
        keptSeen += 1;
        if (keptSeen > MAX_KEPT) entry.kept = false;
      });
      if (entries.length > MAX_ENTRIES) {
        var kept = entries.filter(function onlyKept(entry) { return entry.kept; });
        var open = entries.filter(function onlyOpen(entry) { return !entry.kept; });
        entries = kept.concat(open.slice(0, MAX_ENTRIES - kept.length)).sort(newestFirst);
      }
      rebuildIndex();
    }

    if (plainObject(serialized) && serialized.schemaVersion === SCHEMA_VERSION) {
      var restoredReadAt = timestamp(serialized.lastReadAt);
      if (restoredReadAt != null) lastReadAt = restoredReadAt;
      if (Array.isArray(serialized.entries)) {
        serialized.entries.forEach(function restoreEntry(input) {
          var restored = canonicalRaw(input);
          if (!restored) return;
          var existing = byMoment[restored.momentId];
          if (existing) {
            existing.witnessedAt = Math.min(existing.witnessedAt, restored.witnessedAt);
            existing.kept = existing.kept || restored.kept;
            return;
          }
          entries.push(restored);
          byMoment[restored.momentId] = restored;
        });
      }
    }
    normalizeBounds();

    function resolveEntry(id) {
      var normalized = identifier(id, 120);
      if (!normalized) return null;
      if (byMoment[normalized]) return byMoment[normalized];
      if (normalized.indexOf('witness-') === 0) return byMoment['moment-' + normalized.slice('witness-'.length)] || null;
      return null;
    }
    function receipt(raw) {
      var sport = CANONICAL_SPORTS[raw.sportId];
      var home = CANONICAL_TEAMS[raw.sportId][raw.homeTeamId];
      var away = CANONICAL_TEAMS[raw.sportId][raw.awayTeamId];
      var team = CANONICAL_TEAMS[raw.sportId][raw.teamId];
      var opponent = raw.side === 'home' ? away : home;
      var athlete = CANONICAL_ATHLETES[raw.sportId][raw.teamId][raw.athleteId];
      var founder = FOUNDING[raw.athleteId];
      var eventTitle = NAMED.eventTitles[raw.sportId][raw.kind];
      var title = founder ? founder.motionName : eventTitle;
      var id = witnessId(raw.momentId);
      var concept = conceptHref(raw, title);
      return deepFreeze({
        schemaVersion: SCHEMA_VERSION,
        id: id,
        witnessId: id,
        momentId: raw.momentId,
        fixtureId: raw.fixtureId,
        eventKey: raw.eventKey,
        sportId: raw.sportId,
        homeTeamId: raw.homeTeamId,
        awayTeamId: raw.awayTeamId,
        side: raw.side,
        teamId: raw.teamId,
        athleteId: raw.athleteId,
        kind: raw.kind,
        title: title,
        eventTitle: eventTitle,
        headline: athlete.name + ' · ' + title,
        witnessedAt: raw.witnessedAt,
        kept: raw.kept,
        unread: raw.witnessedAt > lastReadAt,
        sport: sportView(sport),
        home: teamView(home),
        away: teamView(away),
        team: teamView(team),
        opponent: teamView(opponent),
        athlete: athleteView(athlete),
        founding: foundingView(founder),
        playerHref: playerHref(raw),
        conceptHref: concept,
        clipHref: concept,
        safety: SAFETY,
        provenance: SAFETY,
        boundary: SAFETY
      });
    }
    function filterEntries(options) {
      var filters = plainObject(options) ? options : {};
      var athleteId = identifier(filters.athleteId, 120);
      var teamId = identifier(filters.teamId, 120);
      var sportId = identifier(filters.sportId, 80);
      if ((own(filters, 'athleteId') && !athleteId) ||
          (own(filters, 'teamId') && !teamId) ||
          (own(filters, 'sportId') && !sportId)) return [];
      return entries.filter(function matches(entry) {
        return (!athleteId || entry.athleteId === athleteId) &&
          (!teamId || entry.teamId === teamId) &&
          (!sportId || entry.sportId === sportId);
      }).sort(newestFirst);
    }
    function state(options) {
      var selected = filterEntries(options);
      var views = selected.map(receipt);
      return deepFreeze({
        version: VERSION,
        schemaVersion: SCHEMA_VERSION,
        count: views.length,
        totalCount: entries.length,
        keptCount: selected.filter(function countKept(entry) { return entry.kept; }).length,
        unreadCount: selected.filter(function countUnread(entry) { return entry.witnessedAt > lastReadAt; }).length,
        lastReadAt: lastReadAt,
        entries: views,
        contract: SAFETY,
        storageContract: STORAGE_CONTRACT
      });
    }
    function serialize() {
      return deepFreeze({
        schemaVersion: SCHEMA_VERSION,
        lastReadAt: lastReadAt,
        entries: entries.slice().sort(newestFirst).map(function minimal(entry) {
          return {
            schemaVersion: SCHEMA_VERSION,
            momentId: entry.momentId,
            fixtureId: entry.fixtureId,
            eventKey: entry.eventKey,
            sportId: entry.sportId,
            homeTeamId: entry.homeTeamId,
            awayTeamId: entry.awayTeamId,
            side: entry.side,
            teamId: entry.teamId,
            athleteId: entry.athleteId,
            kind: entry.kind,
            witnessedAt: entry.witnessedAt,
            kept: entry.kept
          };
        })
      });
    }
    function capture(moment, options) {
      if (!plainObject(options) || (options.mode !== 'moment' && options.mode !== 'final')) return null;
      var witnessedAt = timestamp(options.witnessedAt);
      if (witnessedAt == null || !NAMED.verify(moment, {
        sportId: options.sportId,
        fixtureId: options.fixtureId,
        homeTeam: options.homeTeam,
        awayTeam: options.awayTeam
      })) return null;
      var candidate = canonicalRaw({
        schemaVersion: SCHEMA_VERSION,
        momentId: moment && moment.id,
        fixtureId: options.fixtureId,
        eventKey: moment && moment.eventKey,
        sportId: options.sportId,
        homeTeamId: options.homeTeam && options.homeTeam.id,
        awayTeamId: options.awayTeam && options.awayTeam.id,
        side: moment && moment.side,
        teamId: moment && moment.team && moment.team.id,
        athleteId: moment && moment.athlete && moment.athlete.id,
        kind: moment && moment.kind,
        witnessedAt: witnessedAt,
        kept: false
      });
      if (!candidate) return null;
      var existing = byMoment[candidate.momentId];
      if (existing) return deepFreeze({ changed: false, receipt: receipt(existing) });
      entries.push(candidate);
      normalizeBounds();
      return deepFreeze({ changed: true, receipt: receipt(candidate) });
    }
    function keep(id, value) {
      if (value !== true && value !== false) return false;
      var entry = resolveEntry(id);
      if (!entry) return false;
      if (entry.kept === value) return true;
      if (value && entries.filter(function countKept(candidate) { return candidate.kept; }).length >= MAX_KEPT) return false;
      entry.kept = value;
      return true;
    }
    function remove(id) {
      var entry = resolveEntry(id);
      if (!entry) return false;
      entries = entries.filter(function retain(candidate) { return candidate !== entry; });
      rebuildIndex();
      return true;
    }
    function markRead(at) {
      var next = timestamp(at);
      if (next == null || next <= lastReadAt) return false;
      lastReadAt = next;
      return true;
    }
    function chapter(athleteId) {
      var id = identifier(athleteId, 120);
      var indexed = id && ATHLETE_INDEX[id];
      if (!indexed) return null;
      var athleteState = state({ athleteId: id });
      var kindCounts = Object.create(null);
      var opponentCounts = Object.create(null);
      athleteState.entries.forEach(function count(entry) {
        kindCounts[entry.kind] = (kindCounts[entry.kind] || 0) + 1;
        opponentCounts[entry.opponent.id] = (opponentCounts[entry.opponent.id] || 0) + 1;
      });
      var kinds = Object.keys(kindCounts).map(function kindView(kind) {
        return { kind: kind, title: NAMED.eventTitles[indexed.sportId][kind], count: kindCounts[kind] };
      }).sort(function rankKinds(left, right) {
        return right.count - left.count || lexical(left.kind, right.kind);
      });
      var opponents = Object.keys(opponentCounts).map(function opponentView(teamId) {
        var team = CANONICAL_TEAMS[indexed.sportId][teamId];
        return { team: teamView(team), count: opponentCounts[teamId] };
      }).sort(function rankOpponents(left, right) {
        return right.count - left.count || lexical(left.team.id, right.team.id);
      });
      var first = athleteState.entries.length ? athleteState.entries[athleteState.entries.length - 1].witnessedAt : null;
      var last = athleteState.entries.length ? athleteState.entries[0].witnessedAt : null;
      var count = athleteState.count;
      var summary = count ?
        'This device witnessed ' + count + ' presented moment' + (count === 1 ? '' : 's') +
          ' featuring ' + indexed.athlete.name + '.' :
        'No presented moments featuring ' + indexed.athlete.name + ' have been witnessed on this device yet.';
      return deepFreeze({
        version: VERSION,
        schemaVersion: SCHEMA_VERSION,
        athlete: athleteView(indexed.athlete),
        team: teamView(CANONICAL_TEAMS[indexed.sportId][indexed.teamId]),
        sport: sportView(CANONICAL_SPORTS[indexed.sportId]),
        title: indexed.athlete.name.toUpperCase() + ' / LOCAL WITNESS CHAPTER',
        summary: summary,
        count: count,
        firstWitnessedAt: first,
        lastWitnessedAt: last,
        kinds: kinds,
        opponents: opponents,
        entries: athleteState.entries,
        contract: SAFETY
      });
    }

    return Object.freeze({
      capture: capture,
      keep: keep,
      remove: remove,
      markRead: markRead,
      state: state,
      chapter: chapter,
      serialize: serialize
    });
  }

  return deepFreeze({
    version: VERSION,
    schemaVersion: SCHEMA_VERSION,
    ready: BOUND,
    limits: LIMITS,
    safety: SAFETY,
    storageContract: STORAGE_CONTRACT,
    create: create
  });
});
