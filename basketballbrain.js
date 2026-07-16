export const BASKETBALL_BRAIN_VERSION = '1.0.0';

export const BASKETBALL_PLAY_IDS = Object.freeze([
  'EARLY_DRAG', 'HIGH_PNR', 'HORNS', 'FLOPPY', 'SPAIN',
  'GHOST', 'POST_SPLIT', 'CHICAGO', 'FIVE_OUT'
]);

export const BASKETBALL_COVERAGE_IDS = Object.freeze([
  'MAN', 'SWITCH', 'DROP', 'ZONE', 'PRESS'
]);

const PLAY_SET = new Set(BASKETBALL_PLAY_IDS);
const COVERAGE_SET = new Set(BASKETBALL_COVERAGE_IDS);
const ON_COURT_ROLES = Object.freeze({
  'Rim Keeper': Object.freeze({
    courtRole: 'CENTER',
    archetype: 'paint-dwelling weather system',
    signature: 'makes the rim feel smaller',
    biases: Object.freeze({ attack: .02, pass: 0, relocate: -.04, screen: .08, crash: .08, help: .06, pressure: -.02, patience: .02, explore: -.02 })
  }),
  Point: Object.freeze({
    courtRole: 'POINT',
    archetype: 'pocket-sized floor cartographer',
    signature: 'draws passing lanes in midair',
    biases: Object.freeze({ attack: .02, pass: .08, relocate: .01, screen: -.04, crash: -.04, help: .01, pressure: .03, patience: .03, explore: .03 })
  }),
  Wing: Object.freeze({
    courtRole: 'WING',
    archetype: 'two-way hinge',
    signature: 'turns defense into a head start',
    biases: Object.freeze({ attack: .05, pass: .02, relocate: .03, screen: 0, crash: .02, help: .05, pressure: .04, patience: 0, explore: .02 })
  }),
  Shooter: Object.freeze({
    courtRole: 'SHOOTER',
    archetype: 'distance ritualist',
    signature: 'releases before doubt arrives',
    biases: Object.freeze({ attack: -.02, pass: 0, relocate: .08, screen: -.02, crash: -.04, help: -.01, pressure: .01, patience: .03, explore: .01 })
  }),
  Cutter: Object.freeze({
    courtRole: 'FORWARD',
    archetype: 'back-door ghost',
    signature: 'vanishes behind watching shoulders',
    biases: Object.freeze({ attack: .06, pass: .01, relocate: .06, screen: .03, crash: .05, help: .03, pressure: .02, patience: -.03, explore: .04 })
  })
});

const TEMPERAMENT_BIASES = Object.freeze({
  'patient until the room blinks': Object.freeze({ patience: .06, pass: .025, attack: -.015, explore: -.015 }),
  'joyfully confrontational': Object.freeze({ attack: .045, pressure: .045, patience: -.025 }),
  'ceremonial and unhurried': Object.freeze({ patience: .055, pass: .02, pressure: -.02 }),
  'restless, curious, impossible to shame': Object.freeze({ explore: .06, relocate: .035, patience: -.025 }),
  'silent except after the decisive play': Object.freeze({ patience: .025, attack: .025, explore: -.01 }),
  'generous with teammates, cruel to open space': Object.freeze({ pass: .055, relocate: .025, attack: .015 }),
  'superstitious and theatrically precise': Object.freeze({ patience: .035, relocate: .035, explore: -.02 }),
  'calm in chaos, chaotic in calm': Object.freeze({ explore: .04, attack: .02, patience: .01 }),
  'plays every possession like a dare': Object.freeze({ attack: .055, pressure: .025, pass: -.02 }),
  'smiles at pressure and hoards grudges': Object.freeze({ pressure: .05, attack: .025, patience: -.01 }),
  'soft-spoken with volcanic timing': Object.freeze({ attack: .04, patience: .025, explore: .015 }),
  // The crowd is presentation-only. No audience signal or gameplay bias is attached.
  'treats the crowd as a seventh teammate': Object.freeze({})
});

const TEAM_STYLE_ROWS = Object.freeze({
  'new-york-brownstones': Object.freeze({
    cue: 'SQUARED LANDING',
    offense: Object.freeze({ POST_SPLIT: .48, HORNS: .37, HIGH_PNR: .18, FIVE_OUT: .08, EARLY_DRAG: .03, FLOPPY: -.08, SPAIN: .02, GHOST: -.04, CHICAGO: -.05 }),
    defense: Object.freeze({ MAN: .36, DROP: .31, SWITCH: .06, ZONE: .12, PRESS: -.04 })
  }),
  'toronto-lake-effect': Object.freeze({
    cue: 'DRIFTING SCREEN',
    offense: Object.freeze({ FLOPPY: .49, GHOST: .39, CHICAGO: .34, HIGH_PNR: .09, SPAIN: .13, EARLY_DRAG: .04, HORNS: -.04, POST_SPLIT: -.11, FIVE_OUT: .02 }),
    defense: Object.freeze({ SWITCH: .39, MAN: .18, ZONE: .06, PRESS: .03, DROP: -.05 })
  }),
  'manila-monsoons': Object.freeze({
    cue: 'SWEEPING ROTATION',
    offense: Object.freeze({ EARLY_DRAG: .43, SPAIN: .38, HORNS: .24, HIGH_PNR: .16, CHICAGO: .06, GHOST: .03, FIVE_OUT: -.01, FLOPPY: -.03, POST_SPLIT: -.08 }),
    defense: Object.freeze({ ZONE: .34, PRESS: .29, MAN: .08, SWITCH: .03, DROP: -.03 })
  }),
  'melbourne-velvet-ants': Object.freeze({
    cue: 'TINY BUSY CUT',
    offense: Object.freeze({ CHICAGO: .46, FLOPPY: .38, EARLY_DRAG: .25, GHOST: .21, HORNS: .08, SPAIN: .04, HIGH_PNR: .02, FIVE_OUT: -.03, POST_SPLIT: -.12 }),
    defense: Object.freeze({ PRESS: .36, SWITCH: .28, MAN: .11, ZONE: .02, DROP: -.07 })
  }),
  'dakar-baobabs': Object.freeze({
    cue: 'ROOTED POST',
    offense: Object.freeze({ POST_SPLIT: .51, FIVE_OUT: .36, HORNS: .28, HIGH_PNR: .06, CHICAGO: .01, SPAIN: -.01, FLOPPY: -.08, GHOST: -.06, EARLY_DRAG: -.12 }),
    defense: Object.freeze({ DROP: .36, ZONE: .28, MAN: .12, SWITCH: -.01, PRESS: -.09 })
  }),
  'medellin-condors': Object.freeze({
    cue: 'CIRCLING PATIENCE',
    offense: Object.freeze({ FIVE_OUT: .45, HIGH_PNR: .36, GHOST: .23, HORNS: .17, POST_SPLIT: .04, SPAIN: .07, CHICAGO: .01, FLOPPY: -.02, EARLY_DRAG: -.06 }),
    defense: Object.freeze({ MAN: .32, SWITCH: .27, DROP: .08, ZONE: .05, PRESS: -.05 })
  }),
  'belgrade-beehive': Object.freeze({
    cue: 'HEXAGONAL SPACING',
    offense: Object.freeze({ HORNS: .47, FIVE_OUT: .41, SPAIN: .20, CHICAGO: .08, HIGH_PNR: .05, POST_SPLIT: .03, GHOST: .02, FLOPPY: -.03, EARLY_DRAG: -.06 }),
    defense: Object.freeze({ ZONE: .41, MAN: .22, SWITCH: .09, DROP: .05, PRESS: .01 })
  }),
  'istanbul-teacups': Object.freeze({
    cue: 'DOWNHILL DRIVE',
    offense: Object.freeze({ HIGH_PNR: .47, GHOST: .34, EARLY_DRAG: .31, SPAIN: .17, FIVE_OUT: .07, CHICAGO: .05, HORNS: .01, FLOPPY: -.04, POST_SPLIT: -.08 }),
    defense: Object.freeze({ PRESS: .34, MAN: .29, SWITCH: .08, ZONE: .01, DROP: -.03 })
  })
});

const PLAY_PRIMARY_ROLE = Object.freeze({
  EARLY_DRAG: 'POINT', HIGH_PNR: 'POINT', HORNS: 'FORWARD', FLOPPY: 'SHOOTER',
  SPAIN: 'POINT', GHOST: 'SHOOTER', POST_SPLIT: 'CENTER', CHICAGO: 'SHOOTER', FIVE_OUT: 'CENTER'
});

const COVERAGE_COUNTERS = Object.freeze({
  MAN: Object.freeze({ FLOPPY: .16, CHICAGO: .15, HIGH_PNR: .11 }),
  SWITCH: Object.freeze({ POST_SPLIT: .18, GHOST: .16, FIVE_OUT: .12 }),
  DROP: Object.freeze({ FIVE_OUT: .18, HIGH_PNR: .15, GHOST: .11 }),
  ZONE: Object.freeze({ HORNS: .18, SPAIN: .15, FIVE_OUT: .13 }),
  PRESS: Object.freeze({ EARLY_DRAG: .18, FIVE_OUT: .14, HORNS: .11 })
});

const PLAY_COUNTERS = Object.freeze({
  EARLY_DRAG: Object.freeze({ DROP: .15, MAN: .10 }),
  HIGH_PNR: Object.freeze({ DROP: .16, SWITCH: .12 }),
  HORNS: Object.freeze({ ZONE: .15, MAN: .10 }),
  FLOPPY: Object.freeze({ SWITCH: .17, MAN: .09 }),
  SPAIN: Object.freeze({ SWITCH: .15, ZONE: .11 }),
  GHOST: Object.freeze({ MAN: .15, ZONE: .10 }),
  POST_SPLIT: Object.freeze({ DROP: .15, ZONE: .12 }),
  CHICAGO: Object.freeze({ SWITCH: .16, MAN: .10 }),
  FIVE_OUT: Object.freeze({ MAN: .14, SWITCH: .13 })
});

const FOUNDER_EXPECTATIONS = Object.freeze({
  'new-york-brownstones-a1': Object.freeze({
    teamId: 'new-york-brownstones', sportId: 'basketball', motionName: 'The Stoop Drop',
    gift: 'Turns a low center of gravity into a moving piece of architecture.',
    flaw: 'Heavy squared landings make the second jump arrive one beat late.'
  }),
  'toronto-lake-effect-a4': Object.freeze({
    teamId: 'toronto-lake-effect', sportId: 'basketball', motionName: 'The Whiteout Release',
    gift: 'Unspools upward and releases the ball before the body looks set.',
    flaw: 'Disappears inside the same drifting screens that create the open shot.'
  })
});

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value, places = 4) => Number(finite(value).toFixed(places));

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(key => freeze(value[key]));
  return Object.freeze(value);
}

function copyCounts(source, ids) {
  const output = {};
  ids.forEach(id => {
    const item = source && source[id];
    output[id] = {
      uses: finite(item?.uses), points: finite(item?.points), quality: finite(item?.quality),
      turnovers: finite(item?.turnovers), stops: finite(item?.stops)
    };
  });
  return output;
}

function emptyCounts(ids) {
  return copyCounts(null, ids);
}

function safeRoll(rng) {
  if (typeof rng !== 'function') return .5;
  return clamp(finite(rng(), .5), 0, .999999999);
}

function normalizeAvailable(values, allowed) {
  const seen = new Set();
  const output = [];
  (Array.isArray(values) ? values : []).forEach(value => {
    const id = typeof value === 'string' ? value : value?.id;
    if (allowed.has(id) && !seen.has(id)) {
      seen.add(id);
      output.push(id);
    }
  });
  return output;
}

function weightedDecision(rows, rng) {
  const ranked = rows.slice().sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const max = ranked[0]?.score || 0;
  const pool = ranked.slice(0, Math.min(4, ranked.length)).map(item => ({
    item,
    weight: Math.exp((item.score - max) * 2.25)
  }));
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0) || 1;
  let cursor = safeRoll(rng) * total;
  let selected = pool[0]?.item || null;
  for (const entry of pool) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      selected = entry.item;
      break;
    }
  }
  return { selected, ranked };
}

function dominantCount(counts, ids, minimum = 2) {
  let best = null;
  ids.forEach(id => {
    const uses = finite(counts?.[id]?.uses);
    if (uses >= minimum && (!best || uses > best.uses || (uses === best.uses && id < best.id))) best = { id, uses };
  });
  return best;
}

function rankingFor(weights, ids) {
  return ids.slice().sort((a, b) => finite(weights?.[b]) - finite(weights?.[a]) || a.localeCompare(b));
}

function publicScores(ranked) {
  return ranked.map(item => freeze({
    id: item.id,
    score: round(clamp(item.score / 2, 0, 1), 4)
  }));
}

function reasonLabel(reason) {
  return String(reason || '').replaceAll('_', ' ');
}

export function createBasketballBrain({ content, characters } = {}) {
  if (!content || typeof content.getTeams !== 'function' || typeof content.getTeam !== 'function' ||
      typeof content.getAthlete !== 'function' || !characters || typeof characters.get !== 'function') {
    throw new TypeError('Canonical basketball content and character authorities are required.');
  }

  const canonicalTeams = content.getTeams('basketball');
  if (!Array.isArray(canonicalTeams) || canonicalTeams.length !== 8) {
    throw new TypeError('The canonical eight-team basketball league is required.');
  }
  const teamById = new Map(canonicalTeams.map(team => [team.id, team]));
  const dnaByTeam = new Map();
  const PROFILES = new WeakSet();
  const MEMORIES = new WeakSet();

  function exactTeam(team) {
    if (!team || team.sportId !== 'basketball') return null;
    const canonical = teamById.get(team.id);
    return canonical === team && content.getTeam(team.id, team.sportId) === team ? team : null;
  }

  function exactAthlete(team, athlete) {
    if (!exactTeam(team) || !athlete || !Array.isArray(team.athletes)) return null;
    return content.getAthlete(team.id, athlete.id) === athlete && team.athletes.indexOf(athlete) >= 0 ? athlete : null;
  }

  function exactFounder(team, athlete, supplied) {
    const expectation = FOUNDER_EXPECTATIONS[athlete?.id];
    if (!expectation || expectation.teamId !== team?.id) return null;
    const canonical = characters.get(athlete.id);
    const record = supplied === undefined ? canonical : supplied;
    if (!record || record !== canonical || record.id !== athlete.id || record.teamId !== team.id ||
        record.sportId !== 'basketball' || record.motionName !== expectation.motionName ||
        record.gift !== expectation.gift || record.flaw !== expectation.flaw) return null;
    return record;
  }

  function deriveTeamDNA(team) {
    const canonical = exactTeam(team);
    const style = canonical && TEAM_STYLE_ROWS[canonical.id];
    if (!canonical || !style || canonical.motion !== {
      'new-york-brownstones': 'stair-step crossovers and squared landings',
      'toronto-lake-effect': 'drifting screens and sudden whiteout runs',
      'manila-monsoons': 'sweeping rotations and thunderclap finishes',
      'melbourne-velvet-ants': 'tiny busy cuts ending in oversized leaps',
      'dakar-baobabs': 'rooted post play with canopy-wide passing',
      'medellin-condors': 'circling patience into steep downhill attacks',
      'belgrade-beehive': 'swarming help defense and hexagonal spacing',
      'istanbul-teacups': 'saucer spins and steaming downhill drives'
    }[canonical.id]) return null;
    if (!dnaByTeam.has(canonical.id)) {
      dnaByTeam.set(canonical.id, freeze({
        version: BASKETBALL_BRAIN_VERSION,
        teamId: canonical.id,
        teamName: canonical.name,
        teamCode: canonical.code,
        motion: canonical.motion,
        cue: style.cue,
        offenseRanking: freeze(rankingFor(style.offense, BASKETBALL_PLAY_IDS)),
        defenseRanking: freeze(rankingFor(style.defense, BASKETBALL_COVERAGE_IDS)),
        tendencies: freeze({
          pace: round(clamp(.5 + finite(style.offense.EARLY_DRAG) * .5, 0, 1), 3),
          screening: round(clamp(.5 + Math.max(finite(style.offense.HIGH_PNR), finite(style.offense.FLOPPY), finite(style.offense.CHICAGO)) * .45, 0, 1), 3),
          spacing: round(clamp(.5 + finite(style.offense.FIVE_OUT) * .5, 0, 1), 3),
          paintHub: round(clamp(.5 + finite(style.offense.POST_SPLIT) * .5, 0, 1), 3),
          pressure: round(clamp(.5 + finite(style.defense.PRESS) * .5, 0, 1), 3),
          help: round(clamp(.5 + finite(style.defense.ZONE) * .5, 0, 1), 3)
        }),
        offenseAffinity: { ...style.offense },
        defenseAffinity: { ...style.defense }
      }));
    }
    return dnaByTeam.get(canonical.id);
  }

  function derivePlayerProfile({ team, athlete, courtRole, foundingCharacter } = {}) {
    const canonicalTeam = exactTeam(team);
    const canonicalAthlete = exactAthlete(canonicalTeam, athlete);
    const role = canonicalAthlete && ON_COURT_ROLES[canonicalAthlete.role];
    if (!canonicalTeam || !canonicalAthlete || !role || role.courtRole !== courtRole ||
        canonicalAthlete.archetype !== role.archetype || canonicalAthlete.signature !== role.signature) return null;
    const mood = TEMPERAMENT_BIASES[canonicalAthlete.temperament];
    if (!mood) return null;
    const founder = exactFounder(canonicalTeam, canonicalAthlete, foundingCharacter);
    if (foundingCharacter !== undefined && FOUNDER_EXPECTATIONS[canonicalAthlete.id] && !founder) return null;
    const keys = ['attack', 'pass', 'relocate', 'screen', 'crash', 'help', 'pressure', 'patience', 'explore'];
    const tendencies = {};
    keys.forEach(key => {
      tendencies[key] = round(clamp(finite(role.biases[key]) + finite(mood[key]), -.12, .12), 3);
    });
    const profile = freeze({
      version: BASKETBALL_BRAIN_VERSION,
      athleteId: canonicalAthlete.id,
      athleteName: canonicalAthlete.name,
      teamId: canonicalTeam.id,
      sourceRole: canonicalAthlete.role,
      courtRole,
      archetype: canonicalAthlete.archetype,
      signature: canonicalAthlete.signature,
      temperament: canonicalAthlete.temperament,
      tendencies,
      founder: founder ? freeze({
        id: founder.id,
        motionName: founder.motionName,
        gift: founder.gift,
        flaw: founder.flaw
      }) : null,
      character: founder ? freeze({
        characterId: founder.id,
        motionName: founder.motionName,
        gift: founder.gift,
        flaw: founder.flaw,
        accuracyDelta: 0
      }) : null,
      evidence: freeze([
        'CANONICAL_TEAM_REFERENCE', 'CANONICAL_ATHLETE_REFERENCE', 'CANONICAL_ROLE',
        'CANONICAL_SIGNATURE', 'CANONICAL_TEMPERAMENT', ...(founder ? ['CANONICAL_FOUNDER_REFERENCE'] : [])
      ])
    });
    PROFILES.add(profile);
    return profile;
  }

  function createMemory({ fixtureId, team, opponent } = {}) {
    const canonicalTeam = exactTeam(team);
    const canonicalOpponent = exactTeam(opponent);
    if (!canonicalTeam || !canonicalOpponent || canonicalTeam === canonicalOpponent) {
      return null;
    }
    const memory = freeze({
      version: BASKETBALL_BRAIN_VERSION,
      fixtureId: String(fixtureId || `${canonicalTeam.id}-vs-${canonicalOpponent.id}`),
      teamId: canonicalTeam.id,
      opponentId: canonicalOpponent.id,
      possessions: 0,
      offense: freeze({
        possessions: 0,
        points: 0,
        calls: freeze(emptyCounts(BASKETBALL_PLAY_IDS)),
        observedCoverages: freeze(emptyCounts(BASKETBALL_COVERAGE_IDS))
      }),
      defense: freeze({
        possessions: 0,
        pointsAllowed: 0,
        coverages: freeze(emptyCounts(BASKETBALL_COVERAGE_IDS)),
        observedCalls: freeze(emptyCounts(BASKETBALL_PLAY_IDS))
      }),
      recent: freeze([]),
      seenPossessionIds: freeze([])
    });
    MEMORIES.add(memory);
    return memory;
  }

  function validMemory(memory, team, opponent) {
    return !!memory && MEMORIES.has(memory) && memory.teamId === team.id && memory.opponentId === opponent.id;
  }

  function sanitizeSituation(situation) {
    return {
      possessionId: String(situation?.possessionId || ''),
      quarter: clamp(Math.trunc(finite(situation?.quarter, 1)), 1, 12),
      gameClock: clamp(finite(situation?.gameClock, 75), 0, 900),
      shotClock: clamp(finite(situation?.shotClock, 24), 0, 35),
      offenseScore: Math.max(0, Math.trunc(finite(situation?.offenseScore))),
      defenseScore: Math.max(0, Math.trunc(finite(situation?.defenseScore))),
      possessionReason: String(situation?.possessionReason || 'INBOUND'),
      transition: !!situation?.transition,
      offenseTeamFouls: Math.max(0, Math.trunc(finite(situation?.offenseTeamFouls))),
      defenseTeamFouls: Math.max(0, Math.trunc(finite(situation?.defenseTeamFouls)))
    };
  }

  function validLineup(lineup, team) {
    if (!Array.isArray(lineup) || lineup.length !== 5) return null;
    const profiles = lineup.map(entry => {
      if (entry && PROFILES.has(entry) && entry.teamId === team.id) return entry;
      const athlete = exactAthlete(team, entry);
      const role = athlete && ON_COURT_ROLES[athlete.role];
      return role ? derivePlayerProfile({ team, athlete, courtRole: role.courtRole }) : null;
    });
    if (profiles.some(profile => !profile || profile.sourceRole === 'Sixth Spark')) return null;
    const roles = new Set(profiles.map(profile => profile.courtRole));
    return roles.size === 5 ? profiles : null;
  }

  function chooseOffense({ team, opponent, lineup, availableCalls, situation, memory, rng } = {}) {
    const offense = exactTeam(team);
    const defense = exactTeam(opponent);
    const dna = deriveTeamDNA(offense);
    const calls = normalizeAvailable(availableCalls === undefined ? BASKETBALL_PLAY_IDS : availableCalls, PLAY_SET);
    if (!offense || !defense || !dna || !calls.length || !validMemory(memory, offense, defense)) return null;
    const state = sanitizeSituation(situation);
    const players = validLineup(lineup, offense);
    if (!players) return null;
    const margin = state.offenseScore - state.defenseScore;
    const dominantCoverage = dominantCount(memory.offense.observedCoverages, BASKETBALL_COVERAGE_IDS);
    const point = players.find(profile => profile.courtRole === 'POINT');
    const rows = calls.map(id => {
      const reasons = ['TEAM_MOTION'];
      let score = 1 + finite(dna.offenseAffinity[id]);
      if (state.transition) {
        score += id === 'EARLY_DRAG' ? .72 : id === 'HIGH_PNR' ? .08 : -.14;
        if (id === 'EARLY_DRAG') reasons.push('LIVE_BALL');
      }
      if (state.quarter >= 4 && state.gameClock < 24) {
        if (margin < -3 && (id === 'GHOST' || id === 'EARLY_DRAG')) score += .23;
        if (margin > 3 && (id === 'POST_SPLIT' || id === 'FIVE_OUT')) score += .22;
        if (Math.abs(margin) <= 3 && id === 'HIGH_PNR') score += .20;
        reasons.push(margin < 0 ? 'LATE_TRAILING' : margin > 0 ? 'LATE_LEADING' : 'LATE_TIED');
      }
      if (dominantCoverage) {
        const counter = finite(COVERAGE_COUNTERS[dominantCoverage.id]?.[id]);
        score += counter;
        if (counter > 0) reasons.push(`PUNISH_OBSERVED_${dominantCoverage.id}`);
      }
      const history = memory.offense.calls[id];
      if (history.uses >= 2) {
        const efficiency = history.points / history.uses;
        score += clamp((efficiency - 1) * .08, -.10, .10);
        if (efficiency >= 1.25) reasons.push('REPEAT_COMPLETED_SUCCESS');
        if (history.turnovers / history.uses >= .34) reasons.push('AVOID_COMPLETED_TURNOVERS');
      } else {
        score += .035 + finite(point?.tendencies.explore) * .2;
        reasons.push('EXPLORE_UNDERUSED_CALL');
      }
      if (id === 'FIVE_OUT' || id === 'HORNS') score += finite(point?.tendencies.patience) * .28;
      if (id === 'EARLY_DRAG' || id === 'GHOST') score += finite(point?.tendencies.attack) * .24;
      return { id, score: round(score), reasons };
    });
    const decision = weightedDecision(rows, rng);
    const selected = decision.selected;
    const primaryRole = PLAY_PRIMARY_ROLE[selected.id];
    const primary = players.find(profile => profile.courtRole === primaryRole) || players[0] || null;
    return freeze({
      version: BASKETBALL_BRAIN_VERSION,
      callId: selected.id,
      primaryAthleteId: primary?.athleteId || null,
      primaryRole,
      tempo: state.transition ? 'PUSH' : state.quarter >= 4 && state.gameClock < 24 && margin > 0 ? 'CONTROL' : 'FLOW',
      reasons: freeze([...new Set(selected.reasons)]),
      reasonLabel: reasonLabel(selected.reasons[selected.reasons.length - 1]),
      identityCue: `${primary?.athleteName || dna.teamCode} · ${dna.cue}`.toUpperCase(),
      confidence: round(clamp(.5 + (selected.score - finite(decision.ranked[1]?.score, selected.score)) * .32, .5, .88), 3),
      scores: freeze(publicScores(decision.ranked)),
      rankings: freeze(decision.ranked.map(item => freeze({ id: item.id, score: round(item.score), reasons: freeze([...new Set(item.reasons)]) })))
    });
  }

  function chooseDefense({ team, opponent, lineup, availableCoverages, situation, memory, rng } = {}) {
    const defense = exactTeam(team);
    const offense = exactTeam(opponent);
    const dna = deriveTeamDNA(defense);
    const coverages = normalizeAvailable(availableCoverages === undefined ? BASKETBALL_COVERAGE_IDS : availableCoverages, COVERAGE_SET);
    if (!defense || !offense || !dna || !coverages.length || !validMemory(memory, defense, offense)) return null;
    const state = sanitizeSituation(situation);
    const players = validLineup(lineup, defense);
    if (!players) return null;
    const margin = state.defenseScore - state.offenseScore;
    const dominantCall = dominantCount(memory.defense.observedCalls, BASKETBALL_PLAY_IDS);
    const point = players.find(profile => profile.courtRole === 'POINT');
    const rows = coverages.map(id => {
      const reasons = ['TEAM_MOTION'];
      let score = 1 + finite(dna.defenseAffinity[id]);
      if (state.transition) {
        score += id === 'MAN' ? .16 : id === 'DROP' ? .13 : id === 'PRESS' ? -.16 : 0;
        reasons.push('TRANSITION_FLOOR_BALANCE');
      }
      if (state.quarter >= 4 && state.gameClock < 22 && margin < 0) {
        score += id === 'PRESS' ? .58 : id === 'MAN' ? .10 : -.05;
        if (id === 'PRESS') reasons.push('LATE_PRESSURE_REQUIRED');
      }
      if (dominantCall) {
        const counter = finite(PLAY_COUNTERS[dominantCall.id]?.[id]);
        score += counter;
        if (counter > 0) reasons.push(`ANSWER_OBSERVED_${dominantCall.id}`);
      }
      const history = memory.defense.coverages[id];
      if (history.uses >= 2) {
        const pointsAllowed = history.points / history.uses;
        score += clamp((1 - pointsAllowed) * .075, -.10, .10);
        if (history.stops / history.uses >= .5) reasons.push('REPEAT_COMPLETED_STOP');
      } else {
        score += .03 + finite(point?.tendencies.explore) * .16;
        reasons.push('EXPLORE_UNDERUSED_COVERAGE');
      }
      if (id === 'PRESS' || id === 'MAN') score += finite(point?.tendencies.pressure) * .22;
      if (id === 'DROP' || id === 'ZONE') score += finite(point?.tendencies.patience) * .16;
      return { id, score: round(score), reasons };
    });
    const decision = weightedDecision(rows, rng);
    const selected = decision.selected;
    return freeze({
      version: BASKETBALL_BRAIN_VERSION,
      coverageId: selected.id,
      primaryAthleteId: point?.athleteId || players[0]?.athleteId || null,
      reasons: freeze([...new Set(selected.reasons)]),
      reasonLabel: reasonLabel(selected.reasons[selected.reasons.length - 1]),
      identityCue: `${dna.teamCode} · ${dna.cue}`.toUpperCase(),
      confidence: round(clamp(.5 + (selected.score - finite(decision.ranked[1]?.score, selected.score)) * .32, .5, .88), 3),
      scores: freeze(publicScores(decision.ranked)),
      rankings: freeze(decision.ranked.map(item => freeze({ id: item.id, score: round(item.score), reasons: freeze([...new Set(item.reasons)]) })))
    });
  }

  function chooseLiveRead({ team, opponent, handler, legalOptions, situation, offensePlan, observedCoverage, context } = {}) {
    const canonicalTeam = exactTeam(team);
    const canonicalOpponent = exactTeam(opponent);
    const handlerProfile = handler && PROFILES.has(handler) && handler.teamId === canonicalTeam?.id ? handler : (() => {
      const athlete = exactAthlete(canonicalTeam, handler);
      const role = athlete && ON_COURT_ROLES[athlete.role];
      return role ? derivePlayerProfile({ team: canonicalTeam, athlete, courtRole: role.courtRole }) : null;
    })();
    if (!canonicalTeam || !canonicalOpponent || !handlerProfile || !Array.isArray(legalOptions) || !legalOptions.length ||
        !offensePlan || !PLAY_SET.has(offensePlan.callId)) return null;
    const state = sanitizeSituation(situation);
    const coverageId = COVERAGE_SET.has(observedCoverage) ? observedCoverage : null;
    const options = legalOptions.filter(option => {
      if (!option || typeof option.id !== 'string' || !['finish', 'floater', 'pullup', 'kick', 'roll', 'pass', 'reset'].includes(option.type)) return false;
      if (option.target == null) return option.targetAthleteId == null;
      return !!exactAthlete(canonicalTeam, option.target);
    });
    if (!options.length) return null;
    const rows = options.map(option => {
      const type = option.type;
      const openness = clamp(finite(option.openness), 0, 1);
      const distance = clamp(finite(option.distance, context?.rimDistance), 0, 20);
      const helpDistance = clamp(finite(option.helpDistance, context?.helpCommitted ? 1.8 : 9), 0, 20);
      const laneRisk = clamp(finite(option.passingLaneRisk, option.laneRisk), 0, 1);
      const expectedQuality = clamp(finite(option.expectedQuality, .5), 0, 1);
      const reasons = [];
      let score = .22 + expectedQuality * .56 + openness * .18 - laneRisk * .26;
      if (type === 'finish') {
        score += clamp((4.2 - distance) * .09, -.18, .32) + finite(handlerProfile.tendencies.attack) * .8;
        if (helpDistance > 2.8) reasons.push('EMPTY_NAIL_FINISH');
      } else if (type === 'floater') {
        score += coverageId === 'DROP' ? .28 : .02;
        score += distance >= 2.1 && distance <= 4.6 ? .12 : -.12;
        reasons.push(coverageId === 'DROP' ? 'DROP_CONCEDES_FLOATER' : 'PAINT_TOUCH_FLOATER');
      } else if (type === 'roll') {
        score += (offensePlan.callId === 'HIGH_PNR' || offensePlan.callId === 'SPAIN') ? .27 : -.12;
        score += helpDistance < 2.6 ? .18 : 0;
        score += finite(handlerProfile.tendencies.pass) * .75;
        reasons.push('HELP_TAG_OPEN_ROLL');
      } else if (type === 'kick' || type === 'pass') {
        score += helpDistance < 2.5 ? .24 : -.02;
        score += openness * .035 + finite(handlerProfile.tendencies.pass) * .82;
        reasons.push('HELP_COMMITS_OPEN_TEAMMATE');
      } else if (type === 'pullup') {
        score += coverageId === 'DROP' ? .14 : 0;
        score += finite(handlerProfile.tendencies.attack) * .45;
        reasons.push('PULLUP_WINDOW');
      } else if (type === 'reset') {
        score += state.shotClock > 7 ? .12 + finite(handlerProfile.tendencies.patience) * .9 : -.8;
        reasons.push('RESET_FOR_CLEANER_GEOMETRY');
      }
      if (state.shotClock < 4 && type === 'reset') score -= 2;
      if (state.shotClock < 4 && (type === 'finish' || type === 'floater' || type === 'pullup')) score += .18;
      return {
        id: option.id,
        type,
        targetAthleteId: option.target?.id || null,
        score: round(score),
        reasons: reasons.length ? reasons : ['BEST_LEGAL_WINDOW']
      };
    });
    const ranked = rows.slice().sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const selected = ranked[0];
    const spread = selected.score - finite(ranked[1]?.score, selected.score);
    return freeze({
      version: BASKETBALL_BRAIN_VERSION,
      optionId: selected.id,
      choiceId: selected.id,
      type: selected.type,
      targetAthleteId: selected.targetAthleteId,
      actorId: handlerProfile.athleteId,
      reasons: freeze([...new Set(selected.reasons)]),
      reasonLabel: reasonLabel(selected.reasons[0]),
      confidence: round(clamp(.52 + spread * .55, .52, .92), 3),
      scores: freeze(ranked.map(item => freeze({ id: item.id, score: round(clamp(item.score, 0, 1), 4) }))),
      rankings: freeze(ranked.map(item => freeze({ id: item.id, type: item.type, score: round(item.score) })))
    });
  }

  function evaluateSignature({ profile, action, context } = {}) {
    const neutral = {
      version: BASKETBALL_BRAIN_VERSION,
      founderId: null,
      motionName: null,
      signatureAttempted: false,
      giftActive: false,
      counterId: null,
      counterSucceeded: false,
      windupMultiplier: 1,
      screenDurationMultiplier: 1,
      boxoutMultiplier: 1,
      reboundMultiplier: 1,
      accuracyDelta: 0,
      evidence: []
    };
    if (!profile || !PROFILES.has(profile) || !profile.founder) return freeze(neutral);
    const output = { ...neutral, founderId: profile.athleteId, motionName: profile.founder.motionName };
    if (profile.athleteId === 'new-york-brownstones-a1' && action === 'screen') {
      const eligible = !!context?.physicalContact && ['EARLY_DRAG', 'HIGH_PNR', 'HORNS'].includes(context?.schemeId);
      output.signatureAttempted = eligible;
      output.giftActive = eligible;
      output.screenDurationMultiplier = eligible ? 1.35 : 1;
      output.evidence = eligible ? ['PHYSICAL_SCREEN_CONTACT', 'MOVING_ARCHITECTURE'] : [];
    } else if (profile.athleteId === 'new-york-brownstones-a1' && action === 'boxout') {
      const eligible = !!context?.physicalContact && !!context?.defensive && !!context?.rimSideLeverage;
      output.signatureAttempted = eligible;
      output.giftActive = eligible;
      output.boxoutMultiplier = eligible ? 1.28 : 1;
      output.evidence = eligible ? ['PHYSICAL_BOXOUT_CONTACT', 'SQUARED_BASE_LEVERAGE', 'MOVING_ARCHITECTURE'] : [];
    } else if (profile.athleteId === 'new-york-brownstones-a1' && action === 'rebound') {
      const seconds = finite(context?.secondsSinceLanding, 99);
      const secondEffort = !!context?.secondEffort && seconds >= 0 && seconds < .46;
      output.signatureAttempted = secondEffort;
      output.counterId = secondEffort ? 'SECOND_JUMP_LATE' : null;
      output.counterSucceeded = secondEffort;
      output.reboundMultiplier = secondEffort ? .52 : 1;
      output.evidence = secondEffort ? ['HEAVY_SQUARED_LANDING', 'SECOND_EFFORT_WITHIN_0_46S'] : [];
    } else if (profile.athleteId === 'toronto-lake-effect-a4' && action === 'catch_release') {
      const eligible = !!context?.screenContact && ['FLOPPY', 'GHOST', 'CHICAGO'].includes(context?.schemeId) && finite(context?.catchAge, 99) <= 1.1;
      const traffic = eligible && Math.max(0, Math.trunc(finite(context?.screenTraffic))) >= 2;
      output.signatureAttempted = eligible;
      output.giftActive = eligible && !traffic;
      output.counterId = traffic ? 'SCREEN_TRAFFIC_LOST' : null;
      output.counterSucceeded = traffic;
      output.windupMultiplier = traffic ? 1.18 : eligible ? .58 : 1;
      output.evidence = !eligible ? [] : traffic
        ? ['DRIFTING_SCREEN_CONTACT', 'TWO_OR_MORE_TRAFFIC_BODIES']
        : ['DRIFTING_SCREEN_CONTACT', 'CATCH_TO_RELEASE_WITHIN_1_1S'];
    }
    return freeze(output);
  }

  function evaluateShot({ team, opponent, shooter, shot, situation, signature } = {}) {
    const canonicalTeam = exactTeam(team);
    const canonicalOpponent = exactTeam(opponent);
    const shooterProfile = shooter && PROFILES.has(shooter) && shooter.teamId === canonicalTeam?.id ? shooter : (() => {
      const athlete = exactAthlete(canonicalTeam, shooter);
      const role = athlete && ON_COURT_ROLES[athlete.role];
      return role ? derivePlayerProfile({ team: canonicalTeam, athlete, courtRole: role.courtRole }) : null;
    })();
    if (!canonicalTeam || !canonicalOpponent || !shooterProfile) return null;
    const state = sanitizeSituation(situation);
    const requestedKind = shot?.kind || shot?.type;
    const kind = ['layup', 'floater', 'jumper'].includes(requestedKind) ? requestedKind : 'jumper';
    const distance = clamp(finite(shot?.distance), 0, 30);
    const contest = clamp(finite(shot?.contest), 0, 1.4);
    const space = clamp(finite(shot?.space, 1 + clamp(finite(shot?.openness, .225), 0, 1) * 2), 0, 8);
    const advantage = clamp(finite(shot?.advantage), 0, .65);
    const rimPressure = clamp(finite(shot?.rimProtection), -.1, .2);
    let base = kind === 'layup' ? .61 : kind === 'floater' ? .41 : distance > 6.75 ? .33 : distance < 4.2 ? .48 : .42;
    let role = 0;
    if (shooterProfile.courtRole === 'SHOOTER' && kind === 'jumper' && distance > 6.75) role += .055;
    if (shooterProfile.courtRole === 'CENTER' && kind === 'layup') role += .045;
    if (shooterProfile.courtRole === 'POINT' && kind === 'jumper' && distance > 3.5 && distance < 6.2) role += .025;
    const geometry = clamp((space - 1.45) * .05, -.05, .08) + advantage * .28;
    const defense = -contest * .25 - rimPressure * (kind === 'layup' ? .68 : kind === 'floater' ? .40 : .10);
    const clock = state.shotClock < 4 ? -.065 : 0;
    const identityAccuracy = signature && finite(signature.accuracyDelta) === 0 ? 0 : 0;
    const probability = clamp(base + role + geometry + defense + clock + identityAccuracy, .12, .78);
    return freeze({
      version: BASKETBALL_BRAIN_VERSION,
      probability: round(probability, 4),
      components: freeze({ base: round(base), role: round(role), geometry: round(geometry), defense: round(defense), clock: round(clock), identityAccuracy: 0 }),
      evidence: freeze(['SHOT_KIND', 'DISTANCE', 'LIVE_SPACE', 'LIVE_CONTEST', 'CREATED_ADVANTAGE', 'COURT_ROLE'])
    });
  }

  function recordOutcome(memory, outcome = {}) {
    if (!memory || !MEMORIES.has(memory)) throw new TypeError('A brain-created memory is required.');
    const possessionId = String(outcome.possessionId || '');
    if (!possessionId || memory.seenPossessionIds.includes(possessionId)) return memory;
    const offenseTeam = exactTeam(outcome.offenseTeam);
    const defenseTeam = exactTeam(outcome.defenseTeam);
    const offenseTeamId = offenseTeam?.id || '';
    const defenseTeamId = defenseTeam?.id || '';
    if (!offenseTeam || !defenseTeam || offenseTeamId === defenseTeamId ||
        (memory.teamId !== offenseTeamId && memory.teamId !== defenseTeamId) ||
        (memory.opponentId !== offenseTeamId && memory.opponentId !== defenseTeamId)) return memory;
    const callId = PLAY_SET.has(outcome.callId) ? outcome.callId : null;
    const coverageId = COVERAGE_SET.has(outcome.coverageId) ? outcome.coverageId : null;
    if (!callId || !coverageId) return memory;
    const suppliedTerminal = String(outcome.terminal || '').toLowerCase();
    if (['offensive_rebound', 'free_throw_attempt', 'void'].includes(suppliedTerminal)) return memory;
    const terminalMap = {
      made: 'SCORE', score: 'SCORE', turnover: 'TURNOVER', defensive_rebound: 'MISS', miss: 'MISS',
      free_throw_trip: 'FREE_THROWS', free_throws: 'FREE_THROWS', period_end: 'PERIOD_END'
    };
    const terminal = terminalMap[suppliedTerminal] || String(outcome.terminal || '').toUpperCase();
    if (!['SCORE', 'TURNOVER', 'MISS', 'FREE_THROWS', 'PERIOD_END'].includes(terminal)) return memory;
    const actor = outcome.actor || null;
    if (actor && !exactAthlete(offenseTeam, actor) && !exactAthlete(defenseTeam, actor)) return memory;
    if (!actor && outcome.actorId != null) return memory;
    const points = Math.trunc(finite(outcome.points));
    // A three-shot trip with a missed final free throw can still produce a
    // two-make plus three-point putback possession; anything above five is not
    // reachable in this simulation's certified terminal chain.
    if (points < 0 || points > 5) return memory;
    const quality = clamp(finite(outcome.quality, outcome.shotQuality), 0, 1);
    const learned = true;
    const offense = {
      possessions: memory.offense.possessions,
      points: memory.offense.points,
      calls: copyCounts(memory.offense.calls, BASKETBALL_PLAY_IDS),
      observedCoverages: copyCounts(memory.offense.observedCoverages, BASKETBALL_COVERAGE_IDS)
    };
    const defense = {
      possessions: memory.defense.possessions,
      pointsAllowed: memory.defense.pointsAllowed,
      coverages: copyCounts(memory.defense.coverages, BASKETBALL_COVERAGE_IDS),
      observedCalls: copyCounts(memory.defense.observedCalls, BASKETBALL_PLAY_IDS)
    };
    if (learned && memory.teamId === offenseTeamId) {
      offense.possessions++;
      offense.points += points;
      const call = offense.calls[callId];
      call.uses++; call.points += points; call.quality += quality;
      if (terminal === 'TURNOVER') call.turnovers++;
      const observed = offense.observedCoverages[coverageId];
      observed.uses++; observed.points += points; observed.quality += quality;
      if (points === 0) observed.stops++;
    }
    if (learned && memory.teamId === defenseTeamId) {
      defense.possessions++;
      defense.pointsAllowed += points;
      const coverage = defense.coverages[coverageId];
      coverage.uses++; coverage.points += points; coverage.quality += quality;
      if (points === 0) coverage.stops++;
      const observed = defense.observedCalls[callId];
      observed.uses++; observed.points += points; observed.quality += quality;
      if (terminal === 'TURNOVER') observed.turnovers++;
    }
    const recentEntry = freeze({
      possessionId, offenseTeamId, defenseTeamId, callId, coverageId, terminal: suppliedTerminal, points,
      quality: round(quality, 3), actorId: actor?.id || null, learned
    });
    const next = freeze({
      version: memory.version,
      fixtureId: memory.fixtureId,
      teamId: memory.teamId,
      opponentId: memory.opponentId,
      possessions: memory.possessions + (learned ? 1 : 0),
      offense: freeze({ ...offense, calls: freeze(offense.calls), observedCoverages: freeze(offense.observedCoverages) }),
      defense: freeze({ ...defense, coverages: freeze(defense.coverages), observedCalls: freeze(defense.observedCalls) }),
      recent: freeze([...memory.recent, recentEntry].slice(-24)),
      seenPossessionIds: freeze([...memory.seenPossessionIds, possessionId].slice(-256))
    });
    MEMORIES.add(next);
    return next;
  }

  function memorySummary(memory) {
    if (!memory || !MEMORIES.has(memory)) return null;
    return freeze({
      version: memory.version,
      fixtureId: memory.fixtureId,
      teamId: memory.teamId,
      opponentId: memory.opponentId,
      possessions: memory.possessions,
      offensePossessions: memory.offense.possessions,
      defensePossessions: memory.defense.possessions,
      recent: memory.recent.slice(-6)
    });
  }

  const brain = {
    version: BASKETBALL_BRAIN_VERSION,
    ready: true,
    sportId: 'basketball',
    teamIds: freeze(canonicalTeams.map(team => team.id)),
    deriveTeamDNA,
    derivePlayerProfile,
    createMemory,
    chooseOffense,
    chooseDefense,
    chooseLiveRead,
    evaluateSignature,
    evaluateShot,
    recordOutcome,
    memorySummary
  };
  return Object.freeze(brain);
}
