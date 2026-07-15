const MINUTE_MS = 60_000;

export const CANONICAL_EPOCH_MS = Date.UTC(2026, 6, 10, 0, 0, 0);
export const DEFAULT_SLOT_MS = 6 * MINUTE_MS;
export const REVISION_MS = 1_000;

const LEAGUE_ROWS = [
  ['soccer', 'THE COMMON GROUND', 'SC', [
    ['tokyo-paper-cranes', 'TOKYO PAPER CRANES', 'TPC', 'Tokyo', '#F34F68'],
    ['osaka-lanterns', 'OSAKA LANTERNS', 'OSL', 'Osaka', '#FF8A30'],
    ['berlin-bramble', 'BERLIN BRAMBLE CLUB', 'BBC', 'Berlin', '#6E9B45'],
    ['london-chalk-horses', 'LONDON CHALK HORSES', 'LCH', 'London', '#ECE7DA'],
    ['sao-paulo-mango-teeth', 'SAO PAULO MANGO TEETH', 'SMT', 'Sao Paulo', '#FFB21A'],
    ['valparaiso-salt-kites', 'VALPARAISO SALT KITES', 'VSK', 'Valparaiso', '#72C8D5'],
    ['lagos-river-drums', 'LAGOS RIVER DRUMS', 'LRD', 'Lagos', '#D85D2C'],
    ['marrakech-sun-carpets', 'MARRAKECH SUN CARPETS', 'MSC', 'Marrakech', '#C94132']
  ]],
  ['basketball', 'THE HIGH ROOM', 'BB', [
    ['new-york-brownstones', 'NEW YORK BROWNSTONES', 'NYB', 'New York', '#A64B35'],
    ['toronto-lake-effect', 'TORONTO LAKE EFFECT', 'TLE', 'Toronto', '#A7DDE8'],
    ['manila-monsoons', 'MANILA MONSOONS', 'MNL', 'Manila', '#236B73'],
    ['melbourne-velvet-ants', 'MELBOURNE VELVET ANTS', 'MVA', 'Melbourne', '#B92F57'],
    ['dakar-baobabs', 'DAKAR BAOBABS', 'DKB', 'Dakar', '#8A623D'],
    ['medellin-condors', 'MEDELLIN CONDORS', 'MEC', 'Medellin', '#6F4FA1'],
    ['belgrade-beehive', 'BELGRADE BEEHIVE', 'BGH', 'Belgrade', '#F1B832'],
    ['istanbul-teacups', 'ISTANBUL TEACUPS', 'ITC', 'Istanbul', '#3D8E82']
  ]],
  ['hockey', 'THE COLD ARGUMENT', 'HK', [
    ['montreal-sugar-maples', 'MONTREAL SUGAR MAPLES', 'MSM', 'Montreal', '#C9463D'],
    ['reykjavik-lava-loons', 'REYKJAVIK LAVA LOONS', 'RLL', 'Reykjavik', '#E95B34'],
    ['stockholm-wool-wolves', 'STOCKHOLM WOOL WOLVES', 'SWW', 'Stockholm', '#8E98A8'],
    ['helsinki-birch-knots', 'HELSINKI BIRCH KNOTS', 'HBK', 'Helsinki', '#E7DDC7'],
    ['sapporo-snow-lanterns', 'SAPPORO SNOW LANTERNS', 'SSL', 'Sapporo', '#F6F4E8'],
    ['anchorage-tundra-drums', 'ANCHORAGE TUNDRA DRUMS', 'ATD', 'Anchorage', '#356C7D'],
    ['prague-river-golems', 'PRAGUE RIVER GOLEMS', 'PRG', 'Prague', '#9A765A'],
    ['tromso-whale-choir', 'TROMSO WHALE CHOIR', 'TWC', 'Tromso', '#315A89']
  ]],
  ['baseball', 'THE LONG AFTERNOON', 'BS', [
    ['mexico-city-alebrijes', 'MEXICO CITY ALEBRIJES', 'MXA', 'Mexico City', '#E84B3C'],
    ['havana-sugar-kings', 'HAVANA SUGAR KINGS', 'HSK', 'Havana', '#E8E1C1'],
    ['seoul-moon-jars', 'SEOUL MOON JARS', 'SMJ', 'Seoul', '#F4EFE3'],
    ['kyoto-lucky-cats', 'KYOTO LUCKY CATS', 'KLC', 'Kyoto', '#E65745'],
    ['santo-domingo-coco-bats', 'SANTO DOMINGO COCO BATS', 'SCB', 'Santo Domingo', '#5B342C'],
    ['san-juan-coquis', 'SAN JUAN COQUIS', 'SJC', 'San Juan', '#63B48D'],
    ['cape-town-jackals', 'CAPE TOWN JACKALS', 'CTJ', 'Cape Town', '#C18445'],
    ['auckland-kauri', 'AUCKLAND KAURI', 'AKK', 'Auckland', '#3F7352']
  ]],
  ['combat', 'THE HANDMADE UNDERCARD', 'CB', [
    ['accra-brass-bell', 'ACCRA BRASS BELL', 'ABB', 'Accra', '#B98332'],
    ['bangkok-banana-leaf', 'BANGKOK BANANA LEAF', 'BBL', 'Bangkok', '#73A64C'],
    ['tbilisi-clay-knuckles', 'TBILISI CLAY KNUCKLES', 'TCK', 'Tbilisi', '#A75D43'],
    ['las-vegas-dust-devils', 'LAS VEGAS DUST DEVILS', 'LVD', 'Las Vegas', '#C97A3D'],
    ['tunis-sand-loom', 'TUNIS SAND LOOM', 'TSL', 'Tunis', '#D9A650'],
    ['cebu-shell-guard', 'CEBU SHELL GUARD', 'CSG', 'Cebu', '#E5B67A'],
    ['lima-condor-gym', 'LIMA CONDOR GYM', 'LCG', 'Lima', '#6E4B7E'],
    ['liverpool-ropeworks', 'LIVERPOOL ROPEWORKS', 'LRW', 'Liverpool', '#8C4A3F']
  ]],
  ['american-football', 'THE SUNDAY ANIMAL', 'AF', [
    ['new-orleans-bayou-kings', 'NEW ORLEANS BAYOU KINGS', 'NOB', 'New Orleans', '#4E7A52'],
    ['atlanta-peaches', 'ATLANTA PEACHES', 'ATL', 'Atlanta', '#F29A7B'],
    ['chicago-stockyards', 'CHICAGO STOCKYARDS', 'CHI', 'Chicago', '#8B4B3E'],
    ['minneapolis-snow-geese', 'MINNEAPOLIS SNOW GEESE', 'MSP', 'Minneapolis', '#E8F0EC'],
    ['dallas-prairie-hounds', 'DALLAS PRAIRIE HOUNDS', 'DPH', 'Dallas', '#B86A3D'],
    ['oakland-redwoods', 'OAKLAND REDWOODS', 'OAK', 'Oakland', '#315F45'],
    ['seattle-rain-dogs', 'SEATTLE RAIN DOGS', 'SEA', 'Seattle', '#3E6D82'],
    ['honolulu-wave-riders', 'HONOLULU WAVE RIDERS', 'HNL', 'Honolulu', '#2B9A9B']
  ]]
];

const SPORT_RULES = Object.freeze({
  soccer: { scoreEvents: [1, 5], values: [1], scoreKind: 'goal', closeMargin: 1, scoringRoleIndexes: [2, 3, 4, 5], roles: ['Keeper', 'Back', 'Engine', 'Winger', 'Striker', 'Wildcard'] },
  basketball: { scoreEvents: [20, 34], values: [1, 2, 2, 2, 3], scoreKind: 'basket', closeMargin: 6, scoringRoleIndexes: [1, 2, 3, 4, 5], roles: ['Rim Keeper', 'Point', 'Wing', 'Shooter', 'Cutter', 'Sixth Spark'] },
  hockey: { scoreEvents: [2, 7], values: [1], scoreKind: 'goal', closeMargin: 1, scoringRoleIndexes: [2, 3, 4, 5], roles: ['Goaltender', 'Stay-home', 'Rover', 'Center', 'Sniper', 'Pest'] },
  baseball: { scoreEvents: [3, 12], values: [1, 1, 1, 2, 3, 4], scoreKind: 'run', closeMargin: 2, scoringRoleIndexes: [2, 3, 4], roles: ['Ace', 'Catcher', 'Shortstop', 'Slugger', 'Center Field', 'Closer'] },
  combat: { scoreEvents: [3, 3], values: [1], scoreKind: 'round_won', closeMargin: 1, scoringRoleIndexes: [0, 1, 2, 3, 4, 5], roles: ['Heavy', 'Technician', 'Counter', 'Swarmer', 'Grappler', 'Showboat'] },
  'american-football': {
    scoreEvents: [4, 10], values: [3, 6, 7], scoreKind: 'score', closeMargin: 8, scoringRoleIndexes: [0, 1, 2, 3, 6, 7],
    roles: [
      'Quarterback', 'Running Back', 'Receiver', 'Tight End', 'Linebacker', 'Safety',
      'Z Receiver', 'Slot Receiver', 'Left Tackle', 'Left Guard', 'Center', 'Right Guard', 'Right Tackle',
      'Left Defensive End', 'Defensive Tackle', 'Nose Tackle', 'Right Defensive End',
      'Weakside Linebacker', 'Strongside Linebacker', 'Left Cornerback', 'Right Cornerback', 'Strong Safety'
    ]
  }
});

export const FALLBACK_LEAGUES = Object.freeze(Object.fromEntries(LEAGUE_ROWS.map(([sportKey, name, code, teamRows]) => [
  sportKey,
  Object.freeze({
    sportKey,
    name,
    code,
    teams: Object.freeze(teamRows.map(([publicId, teamName, teamCode, city, color], index) => Object.freeze({
      publicId,
      name: teamName,
      code: teamCode,
      city,
      color,
      index
    })))
  })
])));

export function hash32(value) {
  const text = String(value ?? '');
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRandom(seed) {
  let state = typeof seed === 'number' ? seed >>> 0 : hash32(seed);
  return () => {
    state |= 0;
    state = state + 0x6D2B79F5 | 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4_294_967_296;
  };
}

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

export function buildRoundRobin(teamCount) {
  if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount % 2 !== 0) {
    throw new TypeError('teamCount must be an even integer greater than one');
  }
  const ring = Array.from({ length: teamCount }, (_, index) => index);
  const firstLeg = [];
  for (let round = 0; round < teamCount - 1; round += 1) {
    const pairings = [];
    for (let index = 0; index < teamCount / 2; index += 1) {
      const home = ring[index];
      const away = ring[teamCount - 1 - index];
      pairings.push(round % 2 === 1 && index === 0 ? [away, home] : [home, away]);
    }
    firstLeg.push(pairings);
    ring.splice(1, 0, ring.pop());
  }
  return firstLeg.concat(firstLeg.map((round) => round.map(([home, away]) => [away, home])));
}

function finiteTimestamp(value, label) {
  const timestamp = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new TypeError(`${label} must be a valid timestamp`);
  return timestamp;
}

function intBetween(random, minimum, maximum) {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function athleteShape(athlete, sportKey) {
  if (!athlete || typeof athlete !== 'object' || athlete.active === false) return null;
  const athleteSportKey = athlete.sportKey ?? athlete.sport_key;
  const isPublic = athlete.isPublic ?? athlete.is_public;
  if (isPublic === false || (athleteSportKey && athleteSportKey !== sportKey)) return null;
  const publicId = athlete.publicId ?? athlete.public_id;
  if (typeof publicId !== 'string' || publicId.length === 0) return null;
  const rawSquadNumber = athlete.squadNumber ?? athlete.squad_number;
  const squadNumber = rawSquadNumber === null || rawSquadNumber === undefined || rawSquadNumber === ''
    ? null
    : Number(rawSquadNumber);
  return {
    publicId,
    role: typeof athlete.role === 'string' && athlete.role.length > 0 ? athlete.role : 'Athlete',
    squadNumber: Number.isInteger(squadNumber) ? squadNumber : null
  };
}

function compareAthletes(left, right) {
  const leftNumber = left.squadNumber ?? Number.POSITIVE_INFINITY;
  const rightNumber = right.squadNumber ?? Number.POSITIVE_INFINITY;
  return leftNumber - rightNumber
    || left.role.localeCompare(right.role)
    || left.publicId.localeCompare(right.publicId);
}

function normalizedAthletes(team, sportKey) {
  if (!Array.isArray(team?.athletes)) return [];
  const roster = team.athletes.map((athlete) => athleteShape(athlete, sportKey)).filter(Boolean).sort(compareAthletes);
  const publicIds = new Set();
  return roster.filter((athlete) => {
    if (publicIds.has(athlete.publicId)) return false;
    publicIds.add(athlete.publicId);
    return true;
  });
}

function teamShape(team, sportKey) {
  if (!team) return null;
  return {
    publicId: team.publicId ?? team.public_id,
    name: team.name,
    code: team.code,
    city: team.city,
    color: team.color ?? team.primary_color,
    athletes: normalizedAthletes(team, sportKey)
  };
}

function matchTeamShape(team) {
  if (!team) return null;
  return {
    publicId: team.publicId,
    name: team.name,
    code: team.code,
    city: team.city,
    color: team.color
  };
}

function roleKey(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function scoringAthlete(fixture, team, eventKey, preferredRole, exactRole = false) {
  const roster = team?.athletes ?? [];
  if (!team?.publicId || roster.length === 0) return null;
  const preferred = roleKey(preferredRole);
  const matching = preferred ? roster.filter((athlete) => roleKey(athlete.role) === preferred) : [];
  if (exactRole && matching.length === 0) return null;
  const candidates = matching.length > 0 ? matching : roster;
  const candidateIndex = hash32(`${fixture.publicId}|athlete|${eventKey}|${team.publicId}|${preferred}`) % candidates.length;
  return candidates[candidateIndex];
}

function scoreContext(rules, score, scoreBefore, scoreAfter, elapsedMs, durationMs) {
  const scoringSign = score.side === 'home' ? 1 : -1;
  const beforeDifference = scoreBefore.home - scoreBefore.away;
  const afterDifference = scoreAfter.home - scoreAfter.away;
  const marginBefore = Math.abs(beforeDifference);
  const marginAfter = Math.abs(afterDifference);
  const tiedBefore = beforeDifference === 0;
  const tiedAfter = afterDifference === 0;
  const wasBehind = beforeDifference * scoringSign < 0;
  const nowAhead = afterDifference * scoringSign > 0;
  const wasAhead = beforeDifference * scoringSign > 0;
  const equalized = !tiedBefore && tiedAfter;
  const leadChanged = wasBehind && nowAhead;
  const leadEstablished = tiedBefore && nowAhead;
  const leadExtended = wasAhead && marginAfter > marginBefore;
  const closeMargin = Math.max(1, Number(rules.closeMargin) || 1);
  const closestMargin = Math.min(marginBefore, marginAfter);
  const closeness = Math.max(0, 1 - closestMargin / (closeMargin + 1));
  const timeRatio = Math.max(0, Math.min(1, elapsedMs / Math.max(1, durationMs)));
  const blowoutExtension = leadExtended && marginBefore > closeMargin;
  let leverage = 0.22 + timeRatio * 0.28 + closeness * 0.30;
  if (equalized) leverage += 0.18;
  else if (leadChanged) leverage += 0.22;
  else if (leadEstablished) leverage += 0.12;
  else if (wasBehind && marginAfter < marginBefore) leverage += 0.08;
  if (blowoutExtension) leverage = Math.min(leverage, 0.49);
  leverage = Number(Math.max(0.18, Math.min(0.99, leverage)).toFixed(2));
  const signatureCandidate = !blowoutExtension && leverage >= 0.78;
  return {
    leverage,
    signatureCandidate,
    scoreContext: {
      tiedBefore,
      tiedAfter,
      equalized,
      leadChanged,
      leadEstablished,
      leadExtended,
      blowoutExtension,
      marginBefore,
      marginAfter
    }
  };
}

export function normalizeFixture(fixture) {
  if (!fixture || typeof fixture !== 'object') throw new TypeError('fixture is required');
  const publicId = fixture.publicId ?? fixture.public_id;
  const startsAt = finiteTimestamp(fixture.startsAt ?? fixture.starts_at, 'fixture.startsAt');
  const scheduledEndAt = finiteTimestamp(fixture.scheduledEndAt ?? fixture.scheduled_end_at, 'fixture.scheduledEndAt');
  if (!publicId || scheduledEndAt <= startsAt) throw new TypeError('fixture needs an id and a positive duration');
  const season = fixture.season ?? {};
  const sportKey = fixture.sportKey ?? fixture.sport_key ?? season.sportKey ?? season.sport_key ?? 'soccer';
  return {
    publicId,
    seasonPublicId: fixture.seasonPublicId ?? fixture.season_public_id ?? season.publicId ?? season.public_id ?? null,
    sportKey,
    roundNumber: Number(fixture.roundNumber ?? fixture.round_number ?? 1),
    channel: Number(fixture.channel ?? 0),
    seed: Number(fixture.seed ?? hash32(publicId)),
    startsAt,
    scheduledEndAt,
    durationMs: scheduledEndAt - startsAt,
    homeTeam: teamShape(fixture.homeTeam ?? fixture.home_team, sportKey),
    awayTeam: teamShape(fixture.awayTeam ?? fixture.away_team, sportKey)
  };
}

export function phaseAt(sportKey, elapsedMs, durationMs) {
  const ratio = Math.max(0, Math.min(1, elapsedMs / Math.max(1, durationMs)));
  if (ratio >= 1) return 'final';
  if (sportKey === 'baseball') return `inning_${Math.min(9, Math.floor(ratio * 9) + 1)}`;
  if (sportKey === 'hockey') return `period_${Math.min(3, Math.floor(ratio * 3) + 1)}`;
  if (sportKey === 'combat') return `round_${Math.min(3, Math.floor(ratio * 3) + 1)}`;
  if (sportKey === 'soccer') {
    if (ratio < 0.47) return 'first_half';
    if (ratio < 0.5) return 'halftime';
    if (ratio < 0.93) return 'second_half';
    return 'stoppage_time';
  }
  return `quarter_${Math.min(4, Math.floor(ratio * 4) + 1)}`;
}

export function eventPlanForFixture(input) {
  const fixture = normalizeFixture(input);
  const rules = SPORT_RULES[fixture.sportKey] ?? SPORT_RULES.soccer;
  const random = seededRandom(fixture.seed);
  const eventCount = intBetween(random, rules.scoreEvents[0], rules.scoreEvents[1]);
  const lowerBound = Math.min(12_000, Math.floor(fixture.durationMs * 0.08));
  const upperBound = Math.max(lowerBound + 1, fixture.durationMs - Math.min(10_000, Math.floor(fixture.durationMs * 0.04)));
  const scoring = [];

  for (let index = 0; index < eventCount; index += 1) {
    let eventLowerBound = lowerBound;
    let eventUpperBound = upperBound;
    if (fixture.sportKey === 'combat') {
      const roundStart = Math.floor((fixture.durationMs * index) / eventCount);
      const roundEnd = Math.floor((fixture.durationMs * (index + 1)) / eventCount);
      const roundPadding = Math.min(12_000, Math.floor((roundEnd - roundStart) * 0.12));
      eventLowerBound = roundStart + roundPadding;
      eventUpperBound = Math.max(eventLowerBound, roundEnd - roundPadding);
    }
    const elapsedMs = intBetween(random, eventLowerBound, eventUpperBound);
    const side = random() < 0.5 ? 'home' : 'away';
    const points = rules.values[Math.floor(random() * rules.values.length)];
    scoring.push({ elapsedMs, side, points, tieBreaker: random() });
  }
  scoring.sort((left, right) => left.elapsedMs - right.elapsedMs || left.tieBreaker - right.tieBreaker);

  const events = [{
    sequence: 1,
    eventKey: `${fixture.publicId}:start`,
    elapsedMs: 0,
    kind: 'match_started',
    teamId: null,
    athleteId: null,
    payload: { phase: phaseAt(fixture.sportKey, 0, fixture.durationMs) }
  }];

  let homeScore = 0;
  let awayScore = 0;
  scoring.forEach((score, index) => {
    const team = score.side === 'home' ? fixture.homeTeam : fixture.awayTeam;
    const opponent = score.side === 'home' ? fixture.awayTeam : fixture.homeTeam;
    const fieldGoal = fixture.sportKey === 'american-football' && score.points === 3;
    const scoringRoleIndexes = rules.scoringRoleIndexes ?? rules.roles.map((_role, roleIndex) => roleIndex);
    const roleIndex = scoringRoleIndexes[hash32(`${fixture.publicId}|actor|${index + 1}|${team?.publicId ?? score.side}`) % scoringRoleIndexes.length];
    const preferredRole = fieldGoal ? 'Kicker' : fixture.sportKey === 'combat' ? 'Fighter' : rules.roles[roleIndex] ?? 'Athlete';
    const eventActorKey = fixture.sportKey === 'combat' ? 'fighter' : index + 1;
    const athlete = scoringAthlete(fixture, team, eventActorKey, preferredRole, fieldGoal);
    const actorRole = athlete?.role ?? (fieldGoal ? 'Special Teams Unit' : preferredRole);
    const scoreBefore = { home: homeScore, away: awayScore };
    if (score.side === 'home') homeScore += score.points;
    else awayScore += score.points;
    const scoreAfter = { home: homeScore, away: awayScore };
    const context = scoreContext(rules, score, scoreBefore, scoreAfter, score.elapsedMs, fixture.durationMs);
    const phase = phaseAt(fixture.sportKey, score.elapsedMs, fixture.durationMs);
    events.push({
      sequence: index + 2,
      eventKey: `${fixture.publicId}:score:${index + 1}`,
      elapsedMs: score.elapsedMs,
      kind: rules.scoreKind,
      teamId: team?.publicId ?? null,
      athleteId: athlete?.publicId ?? null,
      payload: {
        side: score.side,
        points: score.points,
        phase,
        actorRole,
        scoreBefore,
        scoreAfter,
        scoreContext: context.scoreContext,
        leverage: context.leverage,
        signatureCandidate: context.signatureCandidate,
        storyTags: [fixture.sportKey, rules.scoreKind, phase, context.signatureCandidate ? 'pressure-moment' : 'match-moment'],
        call: `${team?.code ?? score.side.toUpperCase()} ${actorRole.toUpperCase()} changes the signal against ${opponent?.code ?? 'the field'}`
      }
    });
  });

  events.push({
    sequence: events.length + 1,
    eventKey: `${fixture.publicId}:final`,
    elapsedMs: fixture.durationMs,
    kind: 'match_final',
    teamId: null,
    athleteId: null,
    payload: { phase: 'final' }
  });
  return events;
}

export function deriveMatchState(input, observedAt = Date.now()) {
  const fixture = normalizeFixture(input);
  const now = finiteTimestamp(observedAt, 'observedAt');
  const elapsedMs = Math.max(0, Math.min(fixture.durationMs, now - fixture.startsAt));
  const status = now < fixture.startsAt ? 'scheduled' : now >= fixture.scheduledEndAt ? 'final' : 'live';
  const allEvents = eventPlanForFixture(fixture);
  const events = status === 'scheduled' ? [] : allEvents.filter((event) => event.elapsedMs <= elapsedMs);
  let homeScore = 0;
  let awayScore = 0;
  for (const event of events) {
    const points = Number(event.payload?.points ?? 0);
    if (event.payload?.side === 'home') homeScore += points;
    if (event.payload?.side === 'away') awayScore += points;
  }
  return {
    fixtureId: fixture.publicId,
    matchId: `match-${fixture.publicId}`,
    seasonPublicId: fixture.seasonPublicId,
    sportKey: fixture.sportKey,
    roundNumber: fixture.roundNumber,
    channel: fixture.channel,
    status,
    phase: status === 'scheduled' ? 'pregame' : phaseAt(fixture.sportKey, elapsedMs, fixture.durationMs),
    revision: Math.floor(elapsedMs / REVISION_MS),
    elapsedMs,
    durationMs: fixture.durationMs,
    homeScore,
    awayScore,
    startsAt: new Date(fixture.startsAt).toISOString(),
    scheduledEndAt: new Date(fixture.scheduledEndAt).toISOString(),
    homeTeam: matchTeamShape(fixture.homeTeam),
    awayTeam: matchTeamShape(fixture.awayTeam),
    events
  };
}

export function fallbackFixturesAt(sportKey, observedAt = Date.now()) {
  const league = FALLBACK_LEAGUES[sportKey];
  if (!league) throw new RangeError(`unknown sport: ${sportKey}`);
  const now = finiteTimestamp(observedAt, 'observedAt');
  const slot = Math.max(0, Math.floor((now - CANONICAL_EPOCH_MS) / DEFAULT_SLOT_MS));
  const rounds = buildRoundRobin(league.teams.length);
  const round = rounds[slot % rounds.length];
  const seasonNumber = Math.floor(slot / rounds.length) + 1;
  const startsAt = CANONICAL_EPOCH_MS + slot * DEFAULT_SLOT_MS;
  return round.map(([homeIndex, awayIndex], channel) => {
    const homeTeam = league.teams[homeIndex];
    const awayTeam = league.teams[awayIndex];
    const publicId = `FB-${league.code}-${slot}-${channel}`;
    return {
      publicId,
      seasonPublicId: `${sportKey}-2026-s${seasonNumber}`,
      sportKey,
      roundNumber: (slot % rounds.length) + 1,
      channel,
      seed: hash32(`${publicId}|${homeTeam.publicId}|${awayTeam.publicId}`),
      startsAt,
      scheduledEndAt: startsAt + DEFAULT_SLOT_MS,
      homeTeam: { ...homeTeam, athletes: fallbackAthletes(homeTeam, sportKey) },
      awayTeam: { ...awayTeam, athletes: fallbackAthletes(awayTeam, sportKey) }
    };
  });
}

function fallbackFixtureWindow(sportKey, observedAt) {
  const now = finiteTimestamp(observedAt, 'observedAt');
  const currentSlot = Math.max(0, Math.floor((now - CANONICAL_EPOCH_MS) / DEFAULT_SLOT_MS));
  const fixtures = [];
  for (let slot = Math.max(0, currentSlot - 1); slot <= currentSlot + 1; slot += 1) {
    const slotTime = CANONICAL_EPOCH_MS + slot * DEFAULT_SLOT_MS + 1;
    fixtures.push(...fallbackFixturesAt(sportKey, slotTime).map((fixture) => deriveMatchState(fixture, now)));
  }
  return fixtures;
}

export function buildFallbackLive(observedAt = Date.now(), sportKey = null) {
  const now = finiteTimestamp(observedAt, 'observedAt');
  const sports = sportKey ? [sportKey] : Object.keys(FALLBACK_LEAGUES);
  const matches = sports.flatMap((key) => fallbackFixturesAt(key, now).map((fixture) => deriveMatchState(fixture, now)));
  return {
    schemaVersion: 1,
    source: 'deterministic-fallback',
    canonical: false,
    observedAt: new Date(now).toISOString(),
    matches
  };
}

function fallbackAthletes(team, sportKey) {
  const roles = (SPORT_RULES[sportKey] ?? SPORT_RULES.soccer).roles;
  return roles.map((role, index) => ({
    publicId: `${team.publicId}-a${index + 1}`,
    displayName: `${team.code} ${role}`,
    squadNumber: (hash32(`${team.publicId}|${role}`) % 89) + 1,
    role
  }));
}

export function buildFallbackLeague(sportKey = 'soccer', observedAt = Date.now()) {
  const league = FALLBACK_LEAGUES[sportKey];
  if (!league) throw new RangeError(`unknown sport: ${sportKey}`);
  const now = finiteTimestamp(observedAt, 'observedAt');
  const currentSlot = Math.max(0, Math.floor((now - CANONICAL_EPOCH_MS) / DEFAULT_SLOT_MS));
  const rounds = buildRoundRobin(league.teams.length);
  const seasonNumber = Math.floor(currentSlot / rounds.length) + 1;
  const table = new Map(league.teams.map((team) => [team.publicId, {
    team,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    scoreFor: 0,
    scoreAgainst: 0,
    form: []
  }]));
  const firstSlot = Math.floor(currentSlot / rounds.length) * rounds.length;
  for (let slot = firstSlot; slot < currentSlot; slot += 1) {
    const at = CANONICAL_EPOCH_MS + (slot + 1) * DEFAULT_SLOT_MS;
    for (const fixture of fallbackFixturesAt(sportKey, at - 1)) {
      const match = deriveMatchState(fixture, fixture.scheduledEndAt);
      const home = table.get(fixture.homeTeam.publicId);
      const away = table.get(fixture.awayTeam.publicId);
      home.played += 1;
      away.played += 1;
      home.scoreFor += match.homeScore;
      home.scoreAgainst += match.awayScore;
      away.scoreFor += match.awayScore;
      away.scoreAgainst += match.homeScore;
      if (match.homeScore > match.awayScore) {
        home.wins += 1;
        home.points += 3;
        away.losses += 1;
        home.form.push('W');
        away.form.push('L');
      } else if (match.awayScore > match.homeScore) {
        away.wins += 1;
        away.points += 3;
        home.losses += 1;
        home.form.push('L');
        away.form.push('W');
      } else {
        home.draws += 1;
        away.draws += 1;
        home.points += 1;
        away.points += 1;
        home.form.push('D');
        away.form.push('D');
      }
    }
  }
  const standings = [...table.values()]
    .sort((left, right) => right.points - left.points || (right.scoreFor - right.scoreAgainst) - (left.scoreFor - left.scoreAgainst) || left.team.name.localeCompare(right.team.name))
    .map((row, index) => {
      const form = row.form.slice(-8);
      const latest = form.at(-1) ?? '';
      let streakLength = 0;
      for (let cursor = form.length - 1; cursor >= 0 && form[cursor] === latest; cursor -= 1) streakLength += 1;
      return {
        rank: index + 1,
        ...row,
        form,
        streak: latest ? `${latest}${streakLength}` : '',
        record: `${row.wins}-${row.draws}-${row.losses}`,
        winPercentage: row.played ? Number((row.wins / row.played).toFixed(3)) : 0,
        pointsPerGame: row.played ? Number((row.points / row.played).toFixed(2)) : 0,
        scoreDifference: row.scoreFor - row.scoreAgainst
      };
    });

  const fixtures = fallbackFixtureWindow(sportKey, now);
  const live = fixtures.filter((fixture) => fixture.status === 'live');

  return {
    schemaVersion: 1,
    source: 'deterministic-fallback',
    canonical: false,
    observedAt: new Date(now).toISOString(),
    season: {
      publicId: `${sportKey}-2026-s${seasonNumber}`,
      sportKey,
      name: league.name,
      status: 'active'
    },
    teams: league.teams.map((team) => ({ ...team, athletes: fallbackAthletes(team, sportKey) })),
    standings,
    fixtures,
    live,
    summary: {
      roundNumber: (currentSlot % rounds.length) + 1,
      gamesPerRound: league.teams.length / 2,
      completedGames: standings.reduce((total, row) => total + row.played, 0) / 2,
      liveGames: live.length,
      scheduledGames: fixtures.filter((fixture) => fixture.status === 'scheduled').length
    }
  };
}

export function canonicalTickPayload(input, observedAt = Date.now()) {
  const state = deriveMatchState(input, observedAt);
  if (state.status === 'scheduled') throw new RangeError('fixture has not started');
  return {
    p_fixture_public_id: state.fixtureId,
    p_observed_at: new Date(finiteTimestamp(observedAt, 'observedAt')).toISOString(),
    p_snapshot: {
      schemaVersion: 1,
      fixtureId: state.fixtureId,
      matchId: state.matchId,
      sportKey: state.sportKey,
      status: state.status,
      phase: state.phase,
      revision: state.revision,
      elapsedMs: state.elapsedMs,
      durationMs: state.durationMs,
      homeScore: state.homeScore,
      awayScore: state.awayScore,
      startsAt: state.startsAt,
      scheduledEndAt: state.scheduledEndAt
    },
    p_events: state.events
  };
}
