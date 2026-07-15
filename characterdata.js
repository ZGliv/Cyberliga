(function (root, factory) {
  'use strict';

  if (typeof define === 'function' && define.amd) {
    define([], function () { return factory(root); });
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
  } else {
    root.CyberligaCharacters = factory(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var SPORT_IDS = ['soccer', 'basketball', 'hockey', 'baseball', 'combat', 'american-football'];
  var SOURCE_RECORDS = [
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

  function freezeRecord(record) {
    var copy = Object.assign({}, record, { materials: Object.freeze(record.materials.slice()) });
    return Object.freeze(copy);
  }

  var records = Object.freeze(SOURCE_RECORDS.map(freezeRecord));
  var byId = Object.create(null);
  var byTeam = Object.create(null);

  records.forEach(function (record) {
    byId[record.id] = record;
    if (!byTeam[record.teamId]) byTeam[record.teamId] = [];
    byTeam[record.teamId].push(record);
  });
  Object.keys(byTeam).forEach(function (teamId) { Object.freeze(byTeam[teamId]); });

  function stableHash(value) {
    var text = String(value == null ? '' : value);
    var result = 2166136261 >>> 0;
    for (var index = 0; index < text.length; index += 1) {
      result ^= text.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  }

  function get(athleteId) {
    return byId[String(athleteId || '')] || null;
  }

  function hasMarquee(athleteId) {
    return Boolean(get(athleteId));
  }

  function featuredForTeam(teamId, seed) {
    var normalizedTeamId = String(teamId || '');
    var candidates = byTeam[normalizedTeamId];
    if (!candidates || !candidates.length) return null;
    var choice = stableHash(normalizedTeamId + '|' + String(seed == null ? 'founding-12' : seed)) % candidates.length;
    return candidates[choice];
  }

  function matchup(homeTeamId, awayTeamId, fixtureId) {
    var normalizedFixtureId = fixtureId == null ? null : String(fixtureId);
    var home = featuredForTeam(homeTeamId, String(normalizedFixtureId || 'matchup') + '|home');
    var away = featuredForTeam(awayTeamId, String(normalizedFixtureId || 'matchup') + '|away');
    var featured = [home, away].filter(Boolean);
    return Object.freeze({
      fixtureId: normalizedFixtureId,
      homeTeamId: String(homeTeamId || ''),
      awayTeamId: String(awayTeamId || ''),
      home: home,
      away: away,
      featured: Object.freeze(featured),
      hasMarquee: featured.length > 0
    });
  }

  function validate(content) {
    var source = content || (root && root.CYBERLIGA_CONTENT);
    var errors = [];
    var ids = Object.create(null);
    var teamIds = Object.create(null);
    var bodies = Object.create(null);
    var bodyFamilies = Object.create(null);
    var motionNames = Object.create(null);
    var sportCounts = Object.create(null);

    SPORT_IDS.forEach(function (sportId) { sportCounts[sportId] = 0; });
    if (records.length !== 12) errors.push('Founding canon must contain exactly 12 records.');

    records.forEach(function (record) {
      if (ids[record.id]) errors.push('Duplicate athlete id: ' + record.id);
      if (teamIds[record.teamId]) errors.push('Duplicate founding team: ' + record.teamId);
      if (bodies[record.body]) errors.push('Duplicate body key: ' + record.body);
      if (bodyFamilies[record.bodyFamily]) errors.push('Duplicate body family: ' + record.bodyFamily);
      if (motionNames[record.motionName]) errors.push('Duplicate signature motion: ' + record.motionName);
      ids[record.id] = true;
      teamIds[record.teamId] = true;
      bodies[record.body] = true;
      bodyFamilies[record.bodyFamily] = true;
      motionNames[record.motionName] = true;

      if (SPORT_IDS.indexOf(record.sportId) === -1) errors.push('Unknown sport for ' + record.id + ': ' + record.sportId);
      else sportCounts[record.sportId] += 1;

      ['id', 'teamId', 'sportId', 'body', 'bodyFamily', 'motionName', 'gift', 'flaw', 'story', 'rivalry', 'reaction'].forEach(function (field) {
        if (typeof record[field] !== 'string' || !record[field]) errors.push('Missing ' + field + ' for ' + record.id);
      });
      if (!Array.isArray(record.materials) || record.materials.length !== 3) errors.push('Expected three materials for ' + record.id);

      if (source && typeof source.getTeam === 'function' && typeof source.getAthlete === 'function') {
        var team = source.getTeam(record.teamId, record.sportId);
        var athlete = team && source.getAthlete(team.id, record.id);
        if (!team) errors.push('Missing team in world data: ' + record.teamId);
        else if (!athlete) errors.push('Missing athlete in world data: ' + record.id);
      }
    });

    SPORT_IDS.forEach(function (sportId) {
      if (sportCounts[sportId] !== 2) errors.push('Expected two founding characters for ' + sportId + '; found ' + sportCounts[sportId] + '.');
    });
    if (source && (typeof source.getTeam !== 'function' || typeof source.getAthlete !== 'function')) {
      errors.push('World data must expose getTeam and getAthlete.');
    }

    return Object.freeze({
      valid: errors.length === 0,
      errors: Object.freeze(errors),
      count: records.length,
      sportCounts: Object.freeze(Object.assign({}, sportCounts))
    });
  }

  return Object.freeze({
    version: VERSION,
    records: records,
    get: get,
    hasMarquee: hasMarquee,
    featuredForTeam: featuredForTeam,
    matchup: matchup,
    validate: validate
  });
});
