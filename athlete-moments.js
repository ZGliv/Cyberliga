(function bootstrapCyberligaAthleteMoments(root, factory) {
  'use strict';

  var api = factory(root);
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  root.CyberligaAthleteMoments = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this, function createPublicApi(root) {
  'use strict';

  var VERSION = '1.0.0';
  var SCHEMA_VERSION = 1;
  var SOCCER_UNIVERSE_EPOCH_MS = Date.UTC(2026, 6, 10, 0, 0, 0);
  var SOCCER_UNIVERSE_SLOT_MS = 6 * 60 * 1000;
  var SPORT_IDS = Object.freeze(['soccer', 'american-football', 'basketball', 'hockey', 'baseball', 'combat']);
  var ARENA_PATHS = Object.freeze({
    soccer: 'index.html',
    'american-football': 'football.html',
    basketball: 'hoops.html',
    hockey: 'hockey.html',
    baseball: 'baseball.html',
    combat: 'fight.html'
  });
  var BLOCKED_EVENT_KINDS = Object.freeze({ match_started: true, match_final: true });
  var SPORT_EVENT_KINDS = Object.freeze({
    soccer: Object.freeze({ goal: true }),
    'american-football': Object.freeze({ score: true }),
    basketball: Object.freeze({ basket: true }),
    hockey: Object.freeze({ goal: true }),
    baseball: Object.freeze({ run: true }),
    combat: Object.freeze({ round_won: true })
  });
  var SAFETY = Object.freeze({
    informationOnly: true,
    realMoney: false,
    prizes: false,
    fanCallSettlement: false
  });

  function deepFreeze(value, seen) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    var visited = seen || [];
    if (visited.indexOf(value) >= 0) return value;
    visited.push(value);
    Object.keys(value).forEach(function freezeChild(key) { deepFreeze(value[key], visited); });
    return Object.freeze(value);
  }

  function plainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function safeText(value, limit) {
    if (typeof value !== 'string' && typeof value !== 'number') return '';
    return String(value)
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/[<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, limit || 180);
  }

  function identifier(value, limit) {
    var text = safeText(value, limit || 240);
    return /^[a-z0-9][a-z0-9._:|\-]*$/i.test(text) ? text : '';
  }

  function finiteNumber(value) {
    if (value == null || value === '' || typeof value === 'boolean') return null;
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function finiteInteger(value, minimum, maximum) {
    var number = finiteNumber(value);
    if (number == null) return null;
    number = Math.trunc(number);
    if (number < minimum || number > maximum) return null;
    return number;
  }

  function boundedNumber(value, minimum, maximum) {
    var number = finiteNumber(value);
    return number == null ? null : Math.max(minimum, Math.min(maximum, number));
  }

  function isoDate(value) {
    if (value == null || value === '') return null;
    var timestamp = typeof value === 'number' ? value : Date.parse(String(value));
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
  }

  function timestampOf(value) {
    var iso = isoDate(value);
    return iso ? Date.parse(iso) : 0;
  }

  function validColor(value, fallback) {
    var color = safeText(value, 24);
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : fallback || '#FFFFFF';
  }

  function teamIdOf(value) {
    return identifier(value && (value.publicId || value.public_id || value.id), 120);
  }

  function eventValue(event, camel, snake) {
    if (!event) return undefined;
    return event[camel] != null ? event[camel] : event[snake];
  }

  function scorePair(value) {
    if (!plainObject(value)) return null;
    var home = finiteInteger(value.home, 0, 9999);
    var away = finiteInteger(value.away, 0, 9999);
    return home == null || away == null ? null : { home: home, away: away };
  }

  function currentScore(fixture) {
    var home = finiteInteger(fixture.homeScore != null ? fixture.homeScore : fixture.home_score, 0, 9999);
    var away = finiteInteger(fixture.awayScore != null ? fixture.awayScore : fixture.away_score, 0, 9999);
    return home == null || away == null ? null : { home: home, away: away };
  }

  function queryString(entries) {
    return entries.filter(function present(entry) {
      return entry[1] != null && entry[1] !== '';
    }).map(function encode(entry) {
      return encodeURIComponent(entry[0]) + '=' + encodeURIComponent(String(entry[1]));
    }).join('&');
  }

  function validateContent(content) {
    if (!content || typeof content.getSport !== 'function' || typeof content.getTeam !== 'function' ||
        typeof content.getAthlete !== 'function' || typeof content.createSeason !== 'function') {
      throw new TypeError('CYBERLIGA_CONTENT with getSport, getTeam, getAthlete, and createSeason is required');
    }
    return content;
  }

  function sportRecord(sport) {
    return {
      id: identifier(sport.id, 80),
      name: safeText(sport.name, 120),
      league: safeText(sport.league, 160),
      code: safeText(sport.code, 20)
    };
  }

  function teamRecord(team) {
    return {
      id: identifier(team.id, 120),
      name: safeText(team.name, 180),
      code: safeText(team.code, 24),
      city: safeText(team.city, 120),
      color: validColor(team.colors && team.colors.primary, '#FFFFFF')
    };
  }

  function athleteRecord(athlete) {
    return {
      id: identifier(athlete.id, 120),
      name: safeText(athlete.name, 160),
      number: finiteInteger(athlete.number, 0, 999),
      role: safeText(athlete.role, 100),
      archetype: safeText(athlete.archetype, 180),
      signature: safeText(athlete.signature, 220)
    };
  }

  function fixtureIndex(content, sportId, homeId, awayId) {
    if (sportId === 'american-football') {
      var footballTeams = content.getTeams ? content.getTeams(sportId) : (content.getSport(sportId).teams || []);
      for (var footballIndex = 0; footballIndex < Math.floor(footballTeams.length / 2); footballIndex += 1) {
        if (footballTeams[footballIndex * 2] && footballTeams[footballIndex * 2 + 1] &&
            footballTeams[footballIndex * 2].id === homeId && footballTeams[footballIndex * 2 + 1].id === awayId) {
          return footballIndex;
        }
      }
      return -1;
    }
    var season = content.createSeason(sportId, 'arena');
    var matches = season && Array.isArray(season.rounds) ? season.rounds.reduce(function flatten(all, round) {
      return all.concat(Array.isArray(round.matches) ? round.matches : []);
    }, []) : [];
    return matches.findIndex(function exact(match) { return match.homeId === homeId && match.awayId === awayId; });
  }

  function soccerUniverseRounds(teamCount) {
    if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount % 2 !== 0) return [];
    var ring = Array.from({ length: teamCount }, function (_, index) { return index; });
    var firstLeg = [];
    for (var roundIndex = 0; roundIndex < teamCount - 1; roundIndex += 1) {
      var pairs = [];
      for (var pairIndex = 0; pairIndex < teamCount / 2; pairIndex += 1) {
        var homeIndex = ring[pairIndex];
        var awayIndex = ring[teamCount - 1 - pairIndex];
        pairs.push(roundIndex % 2 === 1 && pairIndex === 0
          ? [awayIndex, homeIndex]
          : [homeIndex, awayIndex]);
      }
      firstLeg.push(pairs);
      ring.splice(1, 0, ring.pop());
    }
    return firstLeg.concat(firstLeg.map(function reverseRound(round) {
      return round.map(function reversePair(pair) { return [pair[1], pair[0]]; });
    }));
  }

  function soccerUniverseChannel(content, input, homeId, awayId, channel) {
    var fixture = plainObject(input && input.fixture) ? input.fixture : null;
    var fixtureChannel = finiteInteger(fixture && fixture.channel, 0, 3);
    var startsAt = timestampOf(fixture && fixture.startsAt);
    var observedAt = timestampOf(input && (input.observedAt || input.provenance && input.provenance.observedAt));
    var status = safeText(fixture && fixture.status, 40).toLowerCase();
    if (!fixture || channel == null || fixtureChannel !== channel || !startsAt || !observedAt || status !== 'live') return -1;
    var slotOffset = startsAt - SOCCER_UNIVERSE_EPOCH_MS;
    if (slotOffset < 0 || slotOffset % SOCCER_UNIVERSE_SLOT_MS !== 0 ||
        observedAt < startsAt || observedAt >= startsAt + SOCCER_UNIVERSE_SLOT_MS) return -1;

    var teams = content.getTeams ? content.getTeams('soccer') : (content.getSport('soccer').teams || []);
    var seen = Object.create(null);
    var teamIds = teams.map(function localTeamId(team) { return identifier(team && team.id, 120); });
    if (teamIds.some(function invalidOrDuplicate(teamId) {
      if (!teamId || seen[teamId]) return true;
      seen[teamId] = true;
      return false;
    })) return -1;
    var rounds = soccerUniverseRounds(teamIds.length);
    if (!rounds.length) return -1;
    var slot = slotOffset / SOCCER_UNIVERSE_SLOT_MS;
    var pair = rounds[slot % rounds.length] && rounds[slot % rounds.length][channel];
    if (!pair || teamIds[pair[0]] !== homeId || teamIds[pair[1]] !== awayId) return -1;
    return channel;
  }

  function arenaUrl(content, input) {
    var sportId = identifier(input && (input.sportId || input.sport && input.sport.id), 80);
    var homeId = identifier(input && (input.homeId || input.home && input.home.id), 120);
    var awayId = identifier(input && (input.awayId || input.away && input.away.id), 120);
    var channel = finiteInteger(input && (input.channel != null ? input.channel : input.fixture && input.fixture.channel), 0, 3);
    if (sportId === 'soccer') {
      var soccerChannel = soccerUniverseChannel(content, input, homeId, awayId, channel);
      return soccerChannel < 0 ? 'world.html?sport=soccer' : ARENA_PATHS.soccer + '?' + queryString([['match', soccerChannel]]);
    }
    if (!ARENA_PATHS[sportId] || !homeId || !awayId) return 'world.html' + (sportId ? '?' + queryString([['sport', sportId]]) : '');
    var index = fixtureIndex(content, sportId, homeId, awayId);
    if (index < 0) return 'world.html?' + queryString([['sport', sportId]]);
    return ARENA_PATHS[sportId] + '?' + queryString([[sportId === 'american-football' ? 'fixture' : 'match', index]]);
  }

  function profileUrl(input) {
    var sportId = identifier(input && (input.sportId || input.sport && input.sport.id), 80);
    var teamId = identifier(input && (input.teamId || input.team && input.team.id), 120);
    var athleteId = identifier(input && (input.athleteId || input.athlete && input.athlete.id), 120);
    if (!sportId || !teamId || !athleteId) return 'world.html';
    return 'player.html?' + queryString([['sport', sportId], ['team', teamId], ['player', athleteId]]);
  }

  function clipUrl(input) {
    var sportId = identifier(input && (input.sportId || input.sport && input.sport.id), 80);
    var homeId = identifier(input && (input.homeId || input.home && input.home.id), 120);
    var awayId = identifier(input && (input.awayId || input.away && input.away.id), 120);
    var athleteId = identifier(input && (input.athleteId || input.athlete && input.athlete.id), 120);
    var fixtureId = identifier(input && (input.fixtureId || input.fixture && input.fixture.id), 160);
    var eventKey = identifier(input && (input.eventKey || input.event && input.event.key), 240);
    var headline = safeText(input && input.headline, 260);
    var eventSource = safeText(input && (input.source || input.provenance && input.provenance.source), 80) || 'unknown';
    var after = scorePair(input && (input.scoreAfter || input.score && input.score.after));
    var score = after ? after.home + '-' + after.away : '';
    if (!sportId || !homeId || !awayId || !athleteId || !fixtureId || !eventKey || !after) return 'world.html';
    return 'clip.html?' + queryString([
      ['sport', sportId], ['home', homeId], ['away', awayId], ['score', score], ['athlete', athleteId],
      ['headline', headline], ['fixture', fixtureId], ['match', fixtureId], ['story', eventKey], ['event', eventKey],
      ['eventSource', eventSource], ['view', '1']
    ]);
  }

  function normalizeTags(value) {
    var list = Array.isArray(value) ? value : [];
    var seen = Object.create(null);
    return list.map(function cleanTag(tag) { return safeText(tag, 60).toLowerCase(); }).filter(function unique(tag) {
      if (!tag || seen[tag]) return false;
      seen[tag] = true;
      return true;
    }).slice(0, 8);
  }

  function editorialHeadline(athlete, team, kind, points) {
    var name = safeText(athlete && athlete.name, 160).toUpperCase();
    var code = safeText(team && team.code, 24).toUpperCase();
    if (kind === 'goal') return safeText(name + ' FINDS THE NET FOR ' + code, 260);
    if (kind === 'basket') return safeText(name + ' HITS FOR ' + code, 260);
    if (kind === 'score') return safeText(name + ' PUTS ' + code + ' ON THE BOARD', 260);
    if (kind === 'run' && points != null) return safeText(name + ' BRINGS HOME ' + points + ' FOR ' + code, 260);
    if (kind === 'round_won') return safeText(name + ' TAKES THE ROUND FOR ' + code, 260);
    return safeText(name + ' CHANGES THE SIGNAL FOR ' + code, 260);
  }

  function fixtureContext(content, fixture) {
    if (!plainObject(fixture)) return null;
    var fixtureId = identifier(fixture.fixtureId != null ? fixture.fixtureId : fixture.public_id, 160);
    var sportId = identifier(fixture.sportKey != null ? fixture.sportKey : fixture.sport_key, 80);
    if (SPORT_IDS.indexOf(sportId) < 0) return null;
    var sport = content.getSport(sportId);
    var homeId = teamIdOf(fixture.homeTeam || fixture.home_team);
    var awayId = teamIdOf(fixture.awayTeam || fixture.away_team);
    var home = sport && content.getTeam(homeId, sport.id);
    var away = sport && content.getTeam(awayId, sport.id);
    if (!fixtureId || !sport || SPORT_IDS.indexOf(sport.id) < 0 || !home || !away || home.id === away.id) return null;
    var duration = finiteInteger(fixture.durationMs != null ? fixture.durationMs : fixture.duration_ms, 1, 86_400_000);
    return {
      id: fixtureId,
      matchId: identifier(fixture.matchId != null ? fixture.matchId : fixture.match_id, 160) || null,
      sport: sport,
      home: home,
      away: away,
      roundNumber: finiteInteger(fixture.roundNumber != null ? fixture.roundNumber : fixture.round_number, 0, 9999),
      channel: finiteInteger(fixture.channel, 0, 999),
      revision: finiteInteger(fixture.revision, 0, 9_999_999),
      status: safeText(fixture.status, 40).toLowerCase() || 'unknown',
      phase: safeText(fixture.phase, 80).toLowerCase() || 'unknown',
      elapsedMs: finiteInteger(fixture.elapsedMs != null ? fixture.elapsedMs : fixture.elapsed_ms, 0, 86_400_000),
      durationMs: duration,
      startsAt: isoDate(fixture.startsAt != null ? fixture.startsAt : fixture.starts_at),
      scheduledEndAt: isoDate(fixture.scheduledEndAt != null ? fixture.scheduledEndAt : fixture.scheduled_end_at),
      finalizedAt: isoDate(fixture.finalizedAt != null ? fixture.finalizedAt : fixture.finalized_at),
      currentScore: currentScore(fixture),
      events: Array.isArray(fixture.events) ? fixture.events : []
    };
  }

  function normalizedEventCandidate(content, context, rawEvent, provenance) {
    if (!plainObject(rawEvent) || (rawEvent.payload != null && !plainObject(rawEvent.payload))) return null;
    var payload = rawEvent.payload || {};
    var eventKey = identifier(eventValue(rawEvent, 'eventKey', 'event_key'), 240);
    var kind = safeText(rawEvent.kind, 80).toLowerCase().replace(/\s+/g, '_');
    if (!/^[a-z][a-z0-9_-]*$/.test(kind)) return null;
    var teamId = identifier(eventValue(rawEvent, 'teamId', 'team_id'), 120);
    var athleteId = identifier(eventValue(rawEvent, 'athleteId', 'athlete_id'), 120);
    var sequence = finiteInteger(eventValue(rawEvent, 'sequence', 'sequence_no'), 0, 9_999_999);
    var allowedKinds = SPORT_EVENT_KINDS[context.sport.id];
    if (!eventKey || !kind || BLOCKED_EVENT_KINDS[kind] || !allowedKinds || !allowedKinds[kind] || !teamId || !athleteId || sequence == null) return null;
    var team = teamId === context.home.id ? context.home : teamId === context.away.id ? context.away : null;
    var opponent = teamId === context.home.id ? context.away : teamId === context.away.id ? context.home : null;
    var athlete = team && content.getAthlete(team.id, athleteId);
    if (!team || !opponent || !athlete) return null;

    var elapsed = finiteInteger(eventValue(rawEvent, 'elapsedMs', 'event_time_ms'), 0, 86_400_000);
    if (elapsed == null) return null;
    if (context.durationMs != null) elapsed = Math.min(elapsed, context.durationMs);
    var occurredAt = isoDate(rawEvent.occurredAt != null ? rawEvent.occurredAt : rawEvent.occurred_at);
    if (!occurredAt && context.startsAt) occurredAt = new Date(Date.parse(context.startsAt) + elapsed).toISOString();
    if (!occurredAt) occurredAt = provenance.observedAt;

    var before = scorePair(payload.scoreBefore || payload.score_before);
    var after = scorePair(payload.scoreAfter || payload.score_after);
    if (!before || !after) return null;
    var points = finiteInteger(payload.points, 0, 100);
    var leverage = boundedNumber(payload.leverage, 0, 1);
    var eventPhase = safeText(payload.phase, 80).toLowerCase() || context.phase;
    var home = teamRecord(context.home);
    var away = teamRecord(context.away);
    var sport = sportRecord(context.sport);
    var normalizedTeam = teamRecord(team);
    var normalizedOpponent = teamRecord(opponent);
    var normalizedAthlete = athleteRecord(athlete);
    var current = context.currentScore;
    var kindLabel = kind.replace(/[_-]+/g, ' ').toUpperCase();
    var eventCall = editorialHeadline(normalizedAthlete, normalizedTeam, kind, points);
    var record = {
      schemaVersion: SCHEMA_VERSION,
      id: (context.matchId || context.id) + '|' + eventKey,
      eventKey: eventKey,
      fixtureId: context.id,
      matchId: context.matchId,
      sportId: sport.id,
      sportName: sport.name,
      teamId: normalizedTeam.id,
      athleteId: normalizedAthlete.id,
      source: provenance.source,
      canonical: provenance.canonical,
      observedAt: provenance.observedAt,
      channel: context.channel,
      kind: kind,
      kindLabel: kindLabel,
      phase: eventPhase,
      phaseLabel: eventPhase.replace(/[_-]+/g, ' ').toUpperCase(),
      sequence: sequence,
      elapsedMs: elapsed,
      occurredAt: occurredAt,
      sport: sport,
      fixture: {
        id: context.id,
        matchId: context.matchId,
        roundNumber: context.roundNumber,
        channel: context.channel,
        status: context.status,
        phase: eventPhase,
        revision: context.revision,
        startsAt: context.startsAt,
        scheduledEndAt: context.scheduledEndAt,
        finalizedAt: context.finalizedAt
      },
      home: home,
      away: away,
      team: normalizedTeam,
      opponent: normalizedOpponent,
      side: normalizedTeam.id === home.id ? 'home' : 'away',
      athlete: normalizedAthlete,
      score: { before: before, after: after, current: current },
      scoreBefore: before,
      scoreAfter: after,
      leverage: leverage,
      signatureCandidate: payload.signatureCandidate === true || payload.signature_candidate === true,
      headline: eventCall,
      impact: {
        points: points,
        leverage: leverage,
        signatureCandidate: payload.signatureCandidate === true || payload.signature_candidate === true,
        actorRole: safeText(payload.actorRole != null ? payload.actorRole : payload.actor_role, 100) || normalizedAthlete.role,
        storyTags: normalizeTags(payload.storyTags || payload.story_tags),
        call: eventCall
      },
      provenance: provenance,
      links: null
    };
    record.links = {
      arena: arenaUrl(content, record),
      profile: profileUrl(record),
      clip: clipUrl(record)
    };
    record.arenaUrl = record.links.arena;
    record.profileUrl = record.links.profile;
    record.clipUrl = record.links.clip;
    var quality = (context.matchId ? 4 : 0) + (before ? 2 : 0) + (after ? 2 : 0) +
      (occurredAt ? 1 : 0) + (leverage != null ? 1 : 0) + (context.finalizedAt ? 1 : 0);
    return {
      moment: record,
      sortTime: timestampOf(occurredAt) || timestampOf(context.startsAt) + elapsed,
      quality: quality,
      fingerprint: JSON.stringify(record)
    };
  }

  function provenanceFrom(payload) {
    var observedAt = isoDate(payload && payload.observedAt);
    var degraded = Boolean(payload && payload.degraded === true);
    var source = safeText(payload && payload.source, 80) || 'unknown';
    return deepFreeze({
      source: source,
      canonical: Boolean(payload && payload.source === 'supabase' && payload.canonical === true && !degraded),
      degraded: degraded,
      observedAt: observedAt
    });
  }

  function normalizeLiveWith(content, payload) {
    var input = plainObject(payload) ? payload : {};
    var matches = Array.isArray(input.matches) ? input.matches : [];
    var provenance = provenanceFrom(input);
    var byMomentId = Object.create(null);
    var summary = { fixtureCount: matches.length, validFixtures: 0, eventCount: 0, accepted: 0, duplicates: 0, ignored: 0 };

    matches.forEach(function normalizeFixture(fixture) {
      var rawEvents = plainObject(fixture) && Array.isArray(fixture.events) ? fixture.events : [];
      summary.eventCount += rawEvents.length;
      var context = fixtureContext(content, fixture);
      if (!context) {
        summary.ignored += rawEvents.length;
        return;
      }
      summary.validFixtures += 1;
      rawEvents.forEach(function normalizeEvent(rawEvent) {
        var candidate = normalizedEventCandidate(content, context, rawEvent, provenance);
        if (!candidate) {
          summary.ignored += 1;
          return;
        }
        var previous = byMomentId[candidate.moment.id];
        if (previous) {
          summary.duplicates += 1;
          if (candidate.quality > previous.quality ||
              candidate.quality === previous.quality && candidate.fingerprint < previous.fingerprint) {
            byMomentId[candidate.moment.id] = candidate;
          }
        } else byMomentId[candidate.moment.id] = candidate;
      });
    });

    var candidates = Object.keys(byMomentId).map(function candidateFor(key) { return byMomentId[key]; });
    candidates.sort(function compare(left, right) {
      return right.sortTime - left.sortTime ||
        right.moment.sequence - left.moment.sequence ||
        (right.moment.impact.leverage || 0) - (left.moment.impact.leverage || 0) ||
        left.moment.eventKey.localeCompare(right.moment.eventKey) ||
        left.moment.id.localeCompare(right.moment.id);
    });
    var moments = candidates.map(function finalize(candidate) { return deepFreeze(candidate.moment); });
    summary.accepted = moments.length;
    return deepFreeze({
      schemaVersion: SCHEMA_VERSION,
      version: VERSION,
      source: provenance.source,
      canonical: provenance.canonical,
      observedAt: provenance.observedAt,
      degraded: provenance.degraded,
      provenance: provenance,
      moments: moments,
      summary: summary,
      safety: SAFETY
    });
  }

  function followSets(follows) {
    var source = plainObject(follows) ? follows : {};
    function ids(values) {
      var seen = Object.create(null);
      return (Array.isArray(values) ? values : []).map(function normalize(value) { return identifier(value, 120); }).filter(function unique(value) {
        if (!value || seen[value]) return false;
        seen[value] = true;
        return true;
      });
    }
    return { athletes: ids(source.athletes), teams: ids(source.teams) };
  }

  function followMatch(moment, follows) {
    var sets = followSets(follows);
    var athlete = Boolean(moment && sets.athletes.indexOf(moment.athleteId || moment.athlete && moment.athlete.id) >= 0);
    var team = Boolean(moment && sets.teams.indexOf(moment.teamId || moment.team && moment.team.id) >= 0);
    return deepFreeze({
      matched: athlete || team,
      athlete: athlete,
      team: team,
      kind: athlete && team ? 'athlete+team' : athlete ? 'athlete' : team ? 'team' : 'none',
      priority: athlete && team ? 3 : athlete ? 2 : team ? 1 : 0
    });
  }

  function selectForFollows(moments, follows, limit) {
    var source = Array.isArray(moments) ? moments : plainObject(moments) && Array.isArray(moments.moments) ? moments.moments : [];
    var maximum = limit == null ? 24 : finiteInteger(limit, 0, 100);
    if (maximum == null) maximum = 24;
    var ranked = source.map(function rank(moment, index) {
      var match = followMatch(moment, follows);
      if (!match.matched) return null;
      return { moment: moment, index: index, match: match };
    }).filter(Boolean);
    ranked.sort(function compare(left, right) {
      return right.match.priority - left.match.priority ||
        Number(Boolean(right.moment.impact && right.moment.impact.signatureCandidate)) - Number(Boolean(left.moment.impact && left.moment.impact.signatureCandidate)) ||
        Number(right.moment.impact && right.moment.impact.leverage || 0) - Number(left.moment.impact && left.moment.impact.leverage || 0) ||
        timestampOf(right.moment.occurredAt) - timestampOf(left.moment.occurredAt) ||
        left.index - right.index;
    });
    return Object.freeze(ranked.slice(0, maximum).map(function unwrap(entry) { return entry.moment; }));
  }

  function normalizeStoredWith(content, value) {
    if (!plainObject(value) || Number(value.schemaVersion) !== SCHEMA_VERSION) return null;
    var homeId = identifier(value.home && value.home.id, 120);
    var awayId = identifier(value.away && value.away.id, 120);
    var teamId = identifier(value.teamId || value.team && value.team.id, 120);
    var athleteId = identifier(value.athleteId || value.athlete && value.athlete.id, 120);
    var provenance = plainObject(value.provenance) ? value.provenance : {};
    var fixture = plainObject(value.fixture) ? value.fixture : {};
    var impact = plainObject(value.impact) ? value.impact : {};
    var score = plainObject(value.score) ? value.score : {};
    var eventPayload = {
      phase: fixture.phase,
      scoreBefore: score.before,
      scoreAfter: score.after,
      points: impact.points,
      leverage: impact.leverage,
      signatureCandidate: impact.signatureCandidate === true,
      actorRole: impact.actorRole,
      storyTags: impact.storyTags,
      call: impact.call
    };
    var current = scorePair(score.current);
    var normalized = normalizeLiveWith(content, {
      source: provenance.source,
      canonical: false,
      degraded: provenance.degraded === true,
      observedAt: provenance.observedAt,
      matches: [{
        fixtureId: value.fixtureId || fixture.id,
        matchId: value.matchId || fixture.matchId,
        sportKey: value.sportId || value.sport && value.sport.id,
        homeTeam: { publicId: homeId },
        awayTeam: { publicId: awayId },
        roundNumber: fixture.roundNumber,
        channel: fixture.channel,
        status: fixture.status,
        phase: fixture.phase,
        revision: fixture.revision,
        elapsedMs: fixture.elapsedMs,
        durationMs: fixture.durationMs || Math.max(1, Number(value.elapsedMs) || 1),
        startsAt: fixture.startsAt,
        scheduledEndAt: fixture.scheduledEndAt,
        finalizedAt: fixture.finalizedAt,
        homeScore: current && current.home,
        awayScore: current && current.away,
        events: [{
          eventKey: value.eventKey,
          sequence: value.sequence,
          elapsedMs: value.elapsedMs,
          kind: value.kind,
          occurredAt: value.occurredAt,
          teamId: teamId,
          athleteId: athleteId,
          payload: eventPayload
        }]
      }]
    });
    return normalized.moments[0] || null;
  }

  function create(content) {
    var identity = validateContent(content);
    return Object.freeze({
      version: VERSION,
      schemaVersion: SCHEMA_VERSION,
      sportIds: SPORT_IDS,
      safety: SAFETY,
      normalizeLive: function normalizeLive(payload) { return normalizeLiveWith(identity, payload); },
      normalizeStoredMoment: function normalizeStoredMoment(value) { return normalizeStoredWith(identity, value); },
      selectForFollows: selectForFollows,
      followMatch: followMatch,
      arenaUrl: function boundArenaUrl(input) { return arenaUrl(identity, input); },
      profileUrl: profileUrl,
      clipUrl: clipUrl
    });
  }

  function defaultContent(content) {
    return content || root.CYBERLIGA_CONTENT;
  }

  return Object.freeze({
    version: VERSION,
    schemaVersion: SCHEMA_VERSION,
    sportIds: SPORT_IDS,
    safety: SAFETY,
    create: create,
    normalizeLive: function normalizeLive(payload, content) { return normalizeLiveWith(validateContent(defaultContent(content)), payload); },
    normalizeStoredMoment: function normalizeStoredMoment(value, content) { return normalizeStoredWith(validateContent(defaultContent(content)), value); },
    selectForFollows: selectForFollows,
    followMatch: followMatch
  });
});
