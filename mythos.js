(function bootstrapCyberligaMythos(root) {
  'use strict';

  var C = root.CYBERLIGA_CONTENT;
  if (!C) return;

  var VERSION = '1.0.0';
  var EPOCH_MS = 15 * 60 * 1000;
  var SCHEDULE_ROUNDS = 14;
  var CONTINUITY_SLOTS = 14 * 96;
  var STORE_NOTE = 'Fictional supporter picks only. No cash, prizes, deposits, payouts or gameplay influence.';

  var ARC_DEFINITIONS = [
    {
      id: 'beautiful-liability', label: 'THE BEAUTIFUL LIABILITY',
      desire: 'make {signature} feel inevitable instead of reckless',
      pressure: 'The crowd loves the risk. The staff keeps a private count of the times it almost breaks the night.',
      promise: 'If the room gets tense, {name} gets stranger.'
    },
    {
      id: 'city-heir', label: 'THE CITY HEIR',
      desire: 'turn the {motif} into something children in {city} imitate tomorrow',
      pressure: 'Being recognizable is not the same as being trusted. One decisive moment would close that gap.',
      promise: '{city} is waiting for a memory that belongs only to them.'
    },
    {
      id: 'last-answer', label: 'THE LAST ANSWER',
      desire: 'become the teammate everyone searches for when the first plan collapses',
      pressure: 'Every calm possession adds to the expectation that the final one will be calm too.',
      promise: 'The messier the ending, the clearer {name} becomes.'
    },
    {
      id: 'public-experiment', label: 'THE PUBLIC EXPERIMENT',
      desire: 'prove that {archetype} can survive a full season without becoming ordinary',
      pressure: 'Opponents have the film now. Reinvention has to arrive before imitation catches up.',
      promise: 'Nobody knows whether this is a style or a warning.'
    },
    {
      id: 'soft-spot', label: 'THE SOFT SPOT',
      desire: 'win without sanding away the flaw everyone has learned to target',
      pressure: '{flaw}. Every rival has underlined the same sentence.',
      promise: 'The weakness is visible. The response is not.'
    },
    {
      id: 'rival-made', label: 'MADE BY THE RIVAL',
      desire: 'take one thing {rival} believes about them and make it permanently false',
      pressure: 'The rivalry has become a mirror. {name} is tired of recognizing the reflection.',
      promise: 'One opponent knows the whole trick and still has to stop it.'
    },
    {
      id: 'cult-hero', label: 'THE CULT HERO PROBLEM',
      desire: 'turn private devotion into a performance the whole world can understand',
      pressure: 'Beloved athletes are forgiven until the exact night forgiveness runs out.',
      promise: 'The believers were here before the proof.'
    },
    {
      id: 'impossible-job', label: 'THE IMPOSSIBLE JOB',
      desire: 'make the hardest role in {league} look like a personal choice',
      pressure: 'Success disappears into the flow. Failure gets a camera angle and a name.',
      promise: '{name} chose the position where silence means everything worked.'
    }
  ];

  var RITUALS = [
    'touches the club mark twice, then never looks at it again',
    'counts four breaths and gives the fifth one to the crowd',
    'reties the same piece of equipment after every momentum swing',
    'finds one supporter in the front row and borrows their nerve',
    'draws the shape of the next move against one palm',
    'stands completely still while everyone else gets louder',
    'taps each teammate once in roster order',
    'repeats the city name until it stops sounding like a word'
  ];

  var VOICE_OPENERS = [
    'I do not need the whole night.',
    'Let them know what is coming.',
    'Pressure is just a crowded room.',
    'The first answer is usually too polite.',
    'I remember every version of this matchup.',
    'If it looks impossible, the spacing is finally right.',
    'The crowd can keep the fear.',
    'I came for the part nobody rehearsed.'
  ];

  var MATCH_STAKES = [
    ['STYLE COLLISION', 'Two incompatible ideas of control are sharing one field.'],
    ['THE PROVING GROUND', 'A beloved trick meets the opponent most qualified to call it a bluff.'],
    ['CITY PRESSURE', 'The result travels home. The manner of it stays much longer.'],
    ['STAR TEST', 'Two athletes are being asked to become the ending instead of merely reaching it.'],
    ['FUTURE FOLKLORE', 'Nothing historic has happened yet. That is the dangerous part.'],
    ['THE LONG MEMORY', 'The table will record a result; both cities will remember a gesture.']
  ];

  var DROP_TYPES = [
    ['MOTION STUDY', 'kinetic portrait card'],
    ['CITY RELIC', 'venue-texture supporter patch'],
    ['NIGHT SIGNAL', 'after-dark club scarf concept'],
    ['PRESSURE FRAME', 'numbered broadcast still'],
    ['RITUAL OBJECT', 'athlete-authored lucky token'],
    ['RIVALRY PROOF', 'two-city split pennant concept']
  ];

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function clean(value) { return String(value == null ? '' : value).trim(); }
  function upper(value) { return clean(value).toUpperCase(); }
  function index(seed, length) { return length ? C.hash(seed) % length : 0; }
  function pick(list, seed) { return list[index(seed, list.length)]; }
  function replace(template, values) {
    return clean(template).replace(/\{([a-z]+)\}/gi, function (_match, key) {
      return values[key] == null ? '' : clean(values[key]);
    });
  }
  function epoch(now) {
    var time = Number(now);
    if (!Number.isFinite(time)) time = Date.now();
    var slot = Math.floor(time / EPOCH_MS);
    var roundIndex = ((slot % SCHEDULE_ROUNDS) + SCHEDULE_ROUNDS) % SCHEDULE_ROUNDS;
    return {
      now: time,
      slot: slot,
      id: 'epoch-' + slot.toString(36),
      seasonId: 'epoch-01-' + Math.floor(slot / SCHEDULE_ROUNDS),
      continuityId: 'continuity-01-' + Math.floor(slot / CONTINUITY_SLOTS),
      roundIndex: roundIndex,
      progress: ((time % EPOCH_MS) + EPOCH_MS) % EPOCH_MS / EPOCH_MS,
      remainingMs: EPOCH_MS - (((time % EPOCH_MS) + EPOCH_MS) % EPOCH_MS)
    };
  }
  function teamName(team) { return team && (team.displayName || team.name) || ''; }
  function normal(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function resolveSport(value) {
    var reference = value && typeof value === 'object' ? (value.id || value.name || value.league || value.code) : value;
    return C.getSport(reference) || C.sports.filter(function (sport) {
      return normal(sport.name) === normal(reference) || normal(sport.league) === normal(reference);
    })[0] || null;
  }
  function resolveTeam(sportRef, teamRef) {
    var sport = resolveSport(sportRef);
    if (!sport || teamRef == null) return null;
    var direct = C.getTeam(typeof teamRef === 'object' ? (teamRef.id || teamRef.name || teamRef.code) : teamRef, sport.id);
    if (direct) return direct;
    var wanted = normal(typeof teamRef === 'object' ? (teamRef.name || teamRef.code || teamRef.city) : teamRef);
    return sport.teams.filter(function (team) {
      return [team.id, team.name, team.displayName, team.code, team.city].some(function (value) { return normal(value) === wanted; });
    })[0] || null;
  }
  function resolveAthlete(team, athleteRef) {
    if (!team || athleteRef == null) return null;
    var direct = C.getAthlete(team.id, athleteRef);
    if (direct) return direct;
    var wanted = normal(typeof athleteRef === 'object' ? (athleteRef.id || athleteRef.name) : athleteRef);
    return team.athletes.filter(function (athlete) { return normal(athlete.name) === wanted; })[0] || null;
  }
  function fallbackFlaw(athlete) {
    var flaws = [
      'trusts the second idea longer than the moment allows',
      'turns routine pressure into a private dare',
      'chases the perfect answer after the useful one appears',
      'lets the crowd speed up decisions that should stay slow',
      'protects the favorite move so fiercely that the counter becomes visible',
      'carries old mistakes into new spaces'
    ];
    return pick(flaws, athlete.id + '|flaw');
  }
  function statusLabel(starPower, heat) {
    if (starPower >= 95) return 'WORLD FACE';
    if (heat >= 91) return 'CULT EMERGENCY';
    if (starPower >= 88) return 'BREAKOUT SIGNAL';
    if (heat >= 80) return 'CITY FAVORITE';
    return 'ONE MOMENT AWAY';
  }
  function trajectoryLabel(delta) {
    if (delta >= 6) return 'SURGING';
    if (delta >= 2) return 'RISING';
    if (delta <= -5) return 'UNDER FIRE';
    if (delta <= -2) return 'UNSETTLED';
    return 'HOLDING';
  }
  function collectibleFor(sport, team, athlete, seed) {
    var type = pick(DROP_TYPES, seed + '|drop');
    var number = String(1 + index(seed + '|edition', 99)).padStart(2, '0');
    var palette = [team.colors.primary, team.colors.secondary, team.colors.accent];
    return {
      id: 'drop-' + C.hash(seed + '|drop-id').toString(36),
      type: type[0],
      name: upper(athlete.name) + ' / ' + upper(team.motif),
      edition: 'EPOCH 01 · STUDY ' + number,
      concept: type[1],
      material: team.texture,
      colors: palette,
      commerceState: 'CONCEPT / SAVE TO LOCKER'
    };
  }
  function athleteProfile(sportRef, teamRef, athleteRef, options) {
    var sport = resolveSport(sportRef);
    var team = resolveTeam(sport, teamRef);
    var athlete = resolveAthlete(team, athleteRef);
    if (!sport || !team || !athlete) return null;
    var now = options && options.now;
    var currentEpoch = epoch(now);
    var continuity = clean(options && options.continuity || currentEpoch.continuityId);
    var seed = sport.id + '|' + team.id + '|' + athlete.id + '|' + continuity;
    var rival = resolveTeam(sport, team.rivalryId);
    var teammatePool = team.athletes.filter(function (candidate) { return candidate.id !== athlete.id; });
    var teammate = teammatePool[index(seed + '|bond', teammatePool.length)] || athlete;
    var rivalAthletes = rival ? rival.athletes : [];
    var mirror = rivalAthletes[index(seed + '|mirror', rivalAthletes.length)] || null;
    var arc = pick(ARC_DEFINITIONS, seed + '|arc');
    var marquee = root.CyberligaCharacters && root.CyberligaCharacters.get ? root.CyberligaCharacters.get(athlete.id) : null;
    var flaw = marquee && marquee.flaw || athlete.flaw || fallbackFlaw(athlete);
    var values = {
      name: athlete.name,
      signature: athlete.signature,
      archetype: athlete.archetype,
      motif: team.motif,
      city: team.city,
      league: sport.league,
      rival: rival ? teamName(rival) : 'the old rival',
      flaw: flaw
    };
    var base = 66 + index(athlete.id + '|base-power', 26);
    var delta = index(seed + '|trajectory', 17) - 7;
    var pressure = 54 + index(seed + '|pressure', 45);
    var heat = clamp(base + Math.round(delta * .7) + index(seed + '|heat', 11) - 4, 48, 99);
    var starPower = clamp(base + delta, 45, 99);
    return {
      id: athlete.id,
      sportId: sport.id,
      teamId: team.id,
      name: athlete.name,
      number: athlete.number,
      role: athlete.role,
      team: teamName(team),
      city: team.city,
      status: marquee ? 'FOUNDING STAR' : statusLabel(starPower, heat),
      starPower: starPower,
      fanHeat: heat,
      pressure: pressure,
      volatility: 28 + index(seed + '|volatility', 69),
      trajectory: { delta: delta, label: trajectoryLabel(delta) },
      arc: {
        id: marquee ? 'founding-12' : arc.id,
        label: marquee ? 'FOUNDING 12 / ' + marquee.motionName.toUpperCase() : arc.label,
        desire: replace(arc.desire, values),
        pressure: marquee ? marquee.story : replace(arc.pressure, values),
        promise: replace(arc.promise, values)
      },
      gift: marquee ? marquee.gift : athlete.signature,
      flaw: flaw,
      temperament: athlete.temperament,
      silhouette: athlete.silhouette,
      ritual: pick(RITUALS, seed + '|ritual'),
      voice: pick(VOICE_OPENERS, seed + '|voice') + ' ' + replace(arc.promise, values),
      bond: teammate ? { athleteId: teammate.id, name: teammate.name, label: 'TRUST LINK' } : null,
      mirror: mirror ? { athleteId: mirror.id, teamId: rival.id, name: mirror.name, team: teamName(rival), label: 'RIVAL MIRROR' } : null,
      founding: marquee ? {
        tier: 'founding-12',
        bodyFamily: marquee.bodyFamily,
        signatureMove: marquee.motionName,
        story: marquee.story,
        rivalry: marquee.rivalry,
        materials: marquee.materials.slice(),
        reaction: marquee.reaction
      } : null,
      collectible: collectibleFor(sport, team, athlete, seed),
      canonicalUrl: 'player.html?sport=' + encodeURIComponent(sport.id) + '&team=' + encodeURIComponent(team.id) + '&player=' + encodeURIComponent(athlete.id)
    };
  }
  function featuredAthlete(team, seed) {
    if (!team || !team.athletes.length) return null;
    var marquee = root.CyberligaCharacters && root.CyberligaCharacters.featuredForTeam ? root.CyberligaCharacters.featuredForTeam(team.id,seed) : null;
    if (marquee) {
      var canonical = resolveAthlete(team,marquee.id);
      if (canonical) return canonical;
    }
    var ranked = team.athletes.map(function (athlete) {
      return { athlete: athlete, score: C.hash(seed + '|' + athlete.id + '|feature') % 1000 };
    }).sort(function (left, right) { return right.score - left.score; });
    return ranked[0].athlete;
  }
  function matchStory(sportRef, homeRef, awayRef, options) {
    var sport = resolveSport(sportRef);
    var home = resolveTeam(sport, homeRef);
    var away = resolveTeam(sport, awayRef);
    if (!sport || !home || !away || home.id === away.id) return null;
    var currentEpoch = epoch(options && options.now);
    var round = Number(options && options.round || currentEpoch.roundIndex + 1);
    var seed = clean(options && options.seed || currentEpoch.id) + '|' + sport.id + '|' + home.id + '|' + away.id;
    var homeAthlete = featuredAthlete(home, seed + '|home');
    var awayAthlete = featuredAthlete(away, seed + '|away');
    var homeProfile = athleteProfile(sport, home, homeAthlete, {now: currentEpoch.now, continuity: currentEpoch.continuityId});
    var awayProfile = athleteProfile(sport, away, awayAthlete, {now: currentEpoch.now, continuity: currentEpoch.continuityId});
    var rivalry = home.rivalryId === away.id || away.rivalryId === home.id;
    var stake = rivalry ? ['BLOOD MEMORY', 'They know every trick and resent the ones they invented together.'] : pick(MATCH_STAKES, seed + '|stakes');
    var rawShare = 50 + Math.round((homeProfile.starPower - awayProfile.starPower) * .42) + index(seed + '|split', 9) - 4;
    var homeShare = clamp(rawShare, 34, 66);
    var heat = clamp(62 + (rivalry ? 18 : 0) + Math.round((homeProfile.fanHeat + awayProfile.fanHeat) / 12) + index(seed + '|heat', 9), 65, 99);
    var headlines = [
      upper(homeProfile.name) + ' HAS ONE NIGHT TO BREAK ' + upper(awayProfile.name) + "'S FAVORITE ANSWER",
      upper(home.city) + ' AND ' + upper(away.city) + ' DISAGREE ABOUT WHAT COURAGE LOOKS LIKE',
      upper(homeProfile.name) + ' BRINGS THE GIFT; ' + upper(awayProfile.name) + ' KNOWS THE COST',
      upper(homeProfile.name) + ' AND ' + upper(awayProfile.name) + ' ENTER THE PART OF THE STORY NOBODY CAN REHEARSE',
      upper(home.motif) + ' MEETS ' + upper(away.motif) + ' WITH THE WHOLE WORLD WATCHING',
      upper(homeProfile.name) + ' CARRIES ' + upper(home.city) + '; ' + upper(awayProfile.name) + ' CARRIES THE COUNTERARGUMENT',
      upper(homeProfile.name) + ' KEEPS THE RITUAL; ' + upper(awayProfile.name) + ' KEEPS THE RECEIPTS',
      upper(home.city) + ' WANTS A MEMORY. ' + upper(awayProfile.name) + ' WANTS TO STEAL THE FRAME',
      upper(homeProfile.name) + "'S FAVORITE MOVE HAS REACHED " + upper(away.city) + ' BEFORE THEY HAVE',
      upper(home.motif) + ' AND ' + upper(away.motif) + ' HAVE FIFTEEN MINUTES TO BECOME FOLKLORE'
    ];
    var headline = pick(headlines, seed + '|headline');
    var reason = homeProfile.name + ' wants to ' + homeProfile.arc.desire + '. ' + awayProfile.name + ' is the obstacle most likely to expose the flaw: ' + homeProfile.flaw + '.';
    return {
      id: 'myth-' + C.hash(seed).toString(36),
      key: currentEpoch.id + ':' + sport.id + ':' + home.id + ':' + away.id,
      epochId: currentEpoch.id,
      round: round,
      sportId: sport.id,
      sport: sport.name,
      league: sport.league,
      home: { id: home.id, name: teamName(home), code: home.code, city: home.city, color: home.colors.primary, pickShare: homeShare },
      away: { id: away.id, name: teamName(away), code: away.code, city: away.city, color: away.colors.primary, pickShare: 100 - homeShare },
      rivalry: rivalry,
      heat: heat,
      stakes: { label: stake[0], line: stake[1] },
      headline: headline,
      reason: reason,
      question: 'WHO OWNS THE NEXT DEFINING MOMENT?',
      featured: [homeProfile, awayProfile],
      shareLine: headline + ' — ' + home.code + ' vs ' + away.code + ' in ' + sport.league + '. #Cyberliga',
      supporterContract: STORE_NOTE
    };
  }
  function slate(sportRef, now) {
    var sport = resolveSport(sportRef);
    if (!sport) return [];
    var currentEpoch = epoch(now);
    var season = C.createSeason(sport.id, currentEpoch.seasonId);
    var round = season.rounds[currentEpoch.roundIndex];
    return round.matches.map(function (match, matchIndex) {
      var story = matchStory(sport, match.homeId, match.awayId, {
        now: currentEpoch.now,
        round: round.number,
        seed: currentEpoch.id + '|channel-' + matchIndex
      });
      story.channel = matchIndex + 1;
      return story;
    });
  }
  function world(now) {
    var currentEpoch = epoch(now);
    var matches = [];
    C.sports.forEach(function (sport) { matches = matches.concat(slate(sport, currentEpoch.now)); });
    matches.sort(function (left, right) { return right.heat - left.heat || left.key.localeCompare(right.key); });
    var featured = matches.slice(0, 6);
    return {
      version: VERSION,
      epoch: currentEpoch,
      matches: matches,
      featured: featured,
      lead: featured[0] || null,
      metrics: { sports: 6, clubs: 48, games: 24, athletes: 416 },
      supporterContract: STORE_NOTE
    };
  }
  function arenaHref(story) {
    if (!story) return 'world.html';
    var sport = resolveSport(story.sportId);
    var home = sport && resolveTeam(sport, story.home && story.home.id);
    var away = sport && resolveTeam(sport, story.away && story.away.id);
    if (!sport || !home || !away || home.id === away.id) return 'world.html';

    if (sport.id === 'soccer') {
      var universe = root.CyberligaUniverse;
      if (universe && typeof universe.liveMatches === 'function' && typeof universe.sharePath === 'function') {
        var live = universe.liveMatches(Date.now()) || [];
        var exact = live.filter(function (match) {
          return match && match.home && match.away && match.home.id === home.id && match.away.id === away.id;
        })[0];
        if (exact) return universe.sharePath(exact);
      }
      return 'world.html?sport=soccer';
    }

    if (sport.id === 'american-football') {
      for (var footballIndex = 0; footballIndex < Math.floor(sport.teams.length / 2); footballIndex += 1) {
        if (sport.teams[footballIndex * 2].id === home.id && sport.teams[footballIndex * 2 + 1].id === away.id) {
          return 'football.html?fixture=' + footballIndex;
        }
      }
      return 'world.html?sport=' + encodeURIComponent(sport.id);
    }

    var routes = {basketball:'hoops.html',hockey:'hockey.html',baseball:'baseball.html',combat:'fight.html'};
    var path = routes[sport.id];
    if (!path) return 'world.html?sport=' + encodeURIComponent(sport.id);
    var fixtures = C.createSeason(sport.id, 'arena').rounds.reduce(function (all, round) {
      return all.concat(round.matches);
    }, []);
    var fixtureIndex = fixtures.findIndex(function (match) {
      return match.homeId === home.id && match.awayId === away.id;
    });
    return fixtureIndex >= 0
      ? path + '?match=' + fixtureIndex
      : 'world.html?sport=' + encodeURIComponent(sport.id);
  }

  root.CyberligaMythos = Object.freeze({
    version: VERSION,
    epochMs: EPOCH_MS,
    supporterContract: STORE_NOTE,
    epoch: epoch,
    resolveSport: resolveSport,
    resolveTeam: resolveTeam,
    resolveAthlete: resolveAthlete,
    athleteProfile: athleteProfile,
    matchStory: matchStory,
    slate: slate,
    world: world,
    arenaHref: arenaHref
  });
})(typeof window !== 'undefined' ? window : globalThis);
