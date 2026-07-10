/**
 * CYBERLIGA autonomous soccer simulation.
 *
 * This module is deliberately renderer-free and side-effect-free. A match is
 * simulated to completion in one call, then its immutable event log and
 * one-second broadcast snapshots can be persisted/replayed by any host.
 */

export const MATCH_SECONDS = 90 * 60;
export const DEFAULT_MATCH_DURATION_MS = 4 * 60 * 1000;
export const SNAPSHOT_INTERVAL_MS = 1000;

const HALF_SECONDS = MATCH_SECONDS / 2;
const STARTERS_PER_TEAM = 7;
const FIELD_X = 32;
const FIELD_Z = 20;
const ROLE_BY_SLOT = ['GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD', 'FWD'];
const BASE_X = [-28, -17, -16, -4, -2, 12, 14];
const BASE_Z = [0, -9, 9, -7, 7, -7, 7];

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function slug(value) {
  const out = String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return out || 'club';
}

function hashString(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function createPrng(seed) {
  let state = hashString(seed) || 0x6d2b79f5;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeRole(value, fallback) {
  const role = String(value || '').toUpperCase();
  if (role === 'GK' || role.includes('KEEP')) return 'GK';
  if (role === 'DEF' || role.includes('BACK') || role.includes('DEF')) return 'DEF';
  if (role === 'MID' || role.includes('MID')) return 'MID';
  if (role === 'FWD' || role.includes('FORW') || role.includes('STRIK') || role.includes('WING')) return 'FWD';
  return fallback;
}

function normalizeStrength(value, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  const scaled = numeric > 2 ? numeric / 75 : numeric;
  return clamp(scaled, 0.72, 1.3);
}

function normalizeClub(input, side) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`${side} must be a club object`);
  }

  const name = String(input.name || input.city || '').trim();
  if (!name) throw new TypeError(`${side}.name is required`);
  const id = String(input.id || input.clubId || input.slug || slug(name)).trim();
  if (!id) throw new TypeError(`${side}.id could not be derived`);
  if (!Array.isArray(input.roster) || input.roster.length < STARTERS_PER_TEAM) {
    throw new RangeError(`${side}.roster must contain at least ${STARTERS_PER_TEAM} players`);
  }

  const roster = input.roster.map((entry, index) => {
    const isObject = entry && typeof entry === 'object' && !Array.isArray(entry);
    const nameValue = isObject
      ? (entry.name ?? entry.n ?? entry.displayName)
      : entry;
    const playerName = String(nameValue || '').trim();
    if (!playerName) throw new TypeError(`${side}.roster[${index}] must provide a player name`);
    const suppliedId = isObject ? (entry.id ?? entry.playerId) : null;
    const playerId = String(suppliedId || `${id}:${slug(playerName)}`).trim();
    const numberValue = isObject ? (entry.number ?? entry.num) : null;
    const number = Number.isFinite(Number(numberValue)) ? Math.trunc(Number(numberValue)) : index + 1;
    const roleValue = isObject ? (entry.role ?? entry.position) : null;
    const role = normalizeRole(roleValue, ROLE_BY_SLOT[Math.min(index, ROLE_BY_SLOT.length - 1)]);
    const ratingValue = isObject ? (entry.rating ?? entry.overall) : null;
    return {
      id: playerId,
      name: playerName,
      number,
      role,
      rating: normalizeStrength(ratingValue, 1),
    };
  });

  const rosterIds = new Set();
  for (const player of roster) {
    if (rosterIds.has(player.id)) throw new RangeError(`${side}.roster contains duplicate player id ${player.id}`);
    rosterIds.add(player.id);
  }

  const keeper = roster.find(player => player.role === 'GK') || roster[0];
  const lineup = [keeper, ...roster.filter(player => player !== keeper)].slice(0, STARTERS_PER_TEAM);
  lineup[0] = { ...lineup[0], role: 'GK' };
  for (let i = 1; i < lineup.length; i += 1) {
    if (lineup[i].role === 'GK') lineup[i] = { ...lineup[i], role: ROLE_BY_SLOT[i] };
  }

  const base = normalizeStrength(input.rating ?? input.strength, 1);
  return {
    id,
    name,
    city: input.city ? String(input.city) : name,
    code: input.code ? String(input.code) : id.slice(0, 3).toUpperCase(),
    color: input.color ? String(input.color) : null,
    rating: base,
    attack: normalizeStrength(input.attack, base),
    midfield: normalizeStrength(input.midfield, base),
    defense: normalizeStrength(input.defense, base),
    roster,
    lineup,
  };
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) deepFreeze(value[key], seen);
  return Object.freeze(value);
}

function attackDirection(side, period) {
  const firstHalf = side === 'home' ? 1 : -1;
  return period === 1 ? firstHalf : -firstHalf;
}

function clockAt(matchSecond) {
  const safe = clamp(matchSecond, 0, MATCH_SECONDS);
  const minute = Math.floor(safe / 60);
  const second = Math.floor(safe % 60);
  return {
    minute,
    second,
    label: `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`,
  };
}

function emptyTeamStats(teamId) {
  return {
    teamId,
    possessionSeconds: 0,
    passes: 0,
    completedPasses: 0,
    shots: 0,
    shotsOnTarget: 0,
    goals: 0,
    expectedGoals: 0,
    saves: 0,
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
    duelsWon: 0,
  };
}

function emptyPlayerStats(player, teamId) {
  return {
    player,
    teamId,
    passes: 0,
    completedPasses: 0,
    shots: 0,
    shotsOnTarget: 0,
    goals: 0,
    assists: 0,
    saves: 0,
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
    duelsWon: 0,
    touches: 0,
    sentOff: false,
  };
}

function teamRuntime(club, side) {
  return {
    club,
    side,
    stats: emptyTeamStats(club.id),
    players: club.lineup.map(player => emptyPlayerStats(player, club.id)),
  };
}

function activePlayers(team) {
  const active = team.players.filter(player => !player.sentOff);
  return active.length ? active : team.players;
}

function pickWeighted(random, team, roleWeights = {}, excludedId = null) {
  let candidates = activePlayers(team).filter(entry => entry.player.id !== excludedId);
  if (!candidates.length) candidates = activePlayers(team);
  let total = 0;
  const weighted = candidates.map(entry => {
    const weight = Math.max(0.01, (roleWeights[entry.player.role] ?? 1) * entry.player.rating);
    total += weight;
    return { entry, total };
  });
  const target = random() * total;
  return weighted.find(row => target < row.total)?.entry || weighted[weighted.length - 1].entry;
}

function keeperOf(team) {
  return activePlayers(team).find(entry => entry.player.role === 'GK') || activePlayers(team)[0];
}

function makeSnapshotTimes(durationMs) {
  const times = [];
  for (let at = 0; at < durationMs; at += SNAPSHOT_INTERVAL_MS) times.push(at);
  if (times[times.length - 1] !== durationMs) times.push(durationMs);
  return times;
}

function phaseFor(matchSecond, at, durationMs) {
  if (at === durationMs) return 'full-time';
  if (matchSecond < HALF_SECONDS) return 'first-half';
  if (matchSecond === HALF_SECONDS) return 'half-time';
  return 'second-half';
}

/**
 * Simulate a complete fixture without reading clocks, storage, or browser state.
 *
 * Clubs must provide at least seven roster entries. Player names are read from
 * `name`, `n`, or the string roster entry itself; IDs are read from `id` /
 * `playerId`, or deterministically derived from that roster name.
 */
export function simulateMatch({
  matchId,
  home: homeInput,
  away: awayInput,
  seed,
  durationMs = DEFAULT_MATCH_DURATION_MS,
} = {}) {
  const id = String(matchId ?? '').trim();
  if (!id) throw new TypeError('matchId is required');
  if (seed === undefined || seed === null) throw new TypeError('seed is required');
  const safeDuration = Math.trunc(Number(durationMs));
  if (!Number.isFinite(safeDuration) || safeDuration < 1000) {
    throw new RangeError('durationMs must be a finite integer of at least 1000');
  }

  const homeClub = normalizeClub(homeInput, 'home');
  const awayClub = normalizeClub(awayInput, 'away');
  if (homeClub.id === awayClub.id) throw new RangeError('home and away club ids must differ');
  const everyStarterId = [...homeClub.lineup, ...awayClub.lineup].map(player => player.id);
  if (new Set(everyStarterId).size !== everyStarterId.length) {
    throw new RangeError('starter player ids must be unique across both clubs');
  }

  const seedText = String(seed);
  const random = createPrng(`${seedText}|${id}|${homeClub.id}|${awayClub.id}`);
  const home = teamRuntime(homeClub, 'home');
  const away = teamRuntime(awayClub, 'away');
  const teams = [home, away];
  const score = { home: 0, away: 0 };
  const events = [];

  function randBetween(min, max) {
    return min + (max - min) * random();
  }

  function chance(probability) {
    return random() < clamp(probability, 0, 1);
  }

  function opponent(team) {
    return team === home ? away : home;
  }

  function timestampFor(matchSecond) {
    return Math.round(clamp(matchSecond, 0, MATCH_SECONDS) / MATCH_SECONDS * safeDuration);
  }

  function emit(matchSecond, type, data = {}) {
    const second = round(clamp(matchSecond, 0, MATCH_SECONDS), 1);
    const period = data.period || (second < HALF_SECONDS ? 1 : 2);
    const field = data.field
      ? { x: round(clamp(data.field.x, -FIELD_X, FIELD_X)), z: round(clamp(data.field.z, -FIELD_Z, FIELD_Z)) }
      : null;
    const event = {
      id: `${id}:event:${events.length}`,
      seq: events.length,
      at: timestampFor(second),
      matchSecond: second,
      clock: clockAt(second),
      period,
      type,
      teamId: data.teamId ?? null,
      playerId: data.playerId ?? null,
      secondaryPlayerId: data.secondaryPlayerId ?? null,
      outcome: data.outcome ?? null,
      field,
      score: { home: score.home, away: score.away },
      detail: data.detail ? { ...data.detail } : {},
    };
    events.push(event);
    return event;
  }

  function bookFoul(matchSecond, foulingTeam, fouler, victim, field) {
    foulingTeam.stats.fouls += 1;
    fouler.fouls += 1;
    emit(matchSecond, 'foul', {
      teamId: foulingTeam.club.id,
      playerId: fouler.player.id,
      secondaryPlayerId: victim.player.id,
      field,
      detail: { victimTeamId: victim.teamId },
    });

    if (chance(0.003)) {
      foulingTeam.stats.redCards += 1;
      fouler.redCards += 1;
      fouler.sentOff = true;
      emit(matchSecond + 0.8, 'red', {
        teamId: foulingTeam.club.id,
        playerId: fouler.player.id,
        field,
        outcome: 'direct',
      });
      return;
    }

    if (chance(0.15)) {
      foulingTeam.stats.yellowCards += 1;
      fouler.yellowCards += 1;
      emit(matchSecond + 0.7, 'yellow', {
        teamId: foulingTeam.club.id,
        playerId: fouler.player.id,
        field,
        outcome: fouler.yellowCards >= 2 ? 'second-yellow' : 'caution',
      });
      if (fouler.yellowCards >= 2 && !fouler.sentOff) {
        foulingTeam.stats.redCards += 1;
        fouler.redCards += 1;
        fouler.sentOff = true;
        emit(matchSecond + 1.3, 'red', {
          teamId: foulingTeam.club.id,
          playerId: fouler.player.id,
          field,
          outcome: 'second-yellow',
        });
      }
    }
  }

  function choosePossession() {
    const homeNumbers = activePlayers(home).length / STARTERS_PER_TEAM;
    const awayNumbers = activePlayers(away).length / STARTERS_PER_TEAM;
    let homeWeight = home.club.midfield * 1.035 * (0.7 + 0.3 * homeNumbers);
    let awayWeight = away.club.midfield * (0.7 + 0.3 * awayNumbers);
    if (score.home > score.away) homeWeight *= 0.96;
    if (score.away > score.home) awayWeight *= 0.96;
    return chance(homeWeight / (homeWeight + awayWeight)) ? home : away;
  }

  function runPhase(startSecond, period, halfEnd) {
    const possessing = choosePossession();
    const defending = opponent(possessing);
    const direction = attackDirection(possessing.side, period);
    let second = startSecond;
    let x = direction * randBetween(-15, -4);
    let z = randBetween(-12, 12);
    let carrier = pickWeighted(random, possessing, { GK: 0.25, DEF: 0.8, MID: 1.45, FWD: 1.2 });
    carrier.touches += 1;
    emit(second, 'possession', {
      teamId: possessing.club.id,
      playerId: carrier.player.id,
      field: { x, z },
      outcome: 'controlled',
    });

    let lastPasser = null;
    const passCount = 2 + Math.floor(random() * 5);
    let turnover = false;
    for (let passIndex = 0; passIndex < passCount && second < halfEnd - 10; passIndex += 1) {
      second += randBetween(2.2, 5.2);
      const target = pickWeighted(random, possessing, { GK: 0.08, DEF: 0.65, MID: 1.25, FWD: 1.55 }, carrier.player.id);
      x = clamp(x + direction * randBetween(2.2, 7.2), -30.5, 30.5);
      z = clamp(z + randBetween(-5.5, 5.5), -17.5, 17.5);
      const pressure = 0.04 * (defending.club.defense - possessing.club.attack);
      const completionProbability = 0.81 + 0.04 * (carrier.player.rating - 1) - pressure - passIndex * 0.008;
      const complete = chance(completionProbability);
      possessing.stats.passes += 1;
      carrier.passes += 1;
      carrier.touches += 1;
      if (complete) {
        possessing.stats.completedPasses += 1;
        carrier.completedPasses += 1;
        target.touches += 1;
      }
      const interceptor = complete
        ? null
        : pickWeighted(random, defending, { GK: 0.1, DEF: 1.45, MID: 1.15, FWD: 0.55 });
      emit(second, 'pass', {
        teamId: possessing.club.id,
        playerId: carrier.player.id,
        secondaryPlayerId: target.player.id,
        field: { x, z },
        outcome: complete ? 'complete' : 'intercepted',
        detail: interceptor ? { interceptorId: interceptor.player.id, interceptorTeamId: defending.club.id } : {},
      });
      if (!complete) {
        second += randBetween(0.5, 1.4);
        defending.stats.duelsWon += 1;
        interceptor.duelsWon += 1;
        interceptor.touches += 1;
        emit(second, 'duel', {
          teamId: defending.club.id,
          playerId: interceptor.player.id,
          secondaryPlayerId: carrier.player.id,
          field: { x, z },
          outcome: 'turnover-won',
        });
        if (chance(0.09) && second < halfEnd - 3) {
          bookFoul(second + 0.6, possessing, carrier, interceptor, { x, z });
          second += 1.5;
        }
        emit(second + 0.7, 'possession', {
          teamId: defending.club.id,
          playerId: interceptor.player.id,
          field: { x, z },
          outcome: 'turnover',
        });
        turnover = true;
        second += 0.7;
        break;
      }
      lastPasser = carrier;
      carrier = target;
    }

    if (!turnover && chance(0.54) && second < halfEnd - 8) {
      second += randBetween(1.2, 3.5);
      const challenger = pickWeighted(random, defending, { GK: 0.05, DEF: 1.4, MID: 1.2, FWD: 0.6 });
      const attackPower = carrier.player.rating * possessing.club.attack * (0.75 + random() * 0.5);
      const defensePower = challenger.player.rating * defending.club.defense * (0.75 + random() * 0.5);
      const winner = attackPower >= defensePower ? carrier : challenger;
      const loser = winner === carrier ? challenger : carrier;
      const winnerTeam = winner === carrier ? possessing : defending;
      winnerTeam.stats.duelsWon += 1;
      winner.duelsWon += 1;
      emit(second, 'duel', {
        teamId: winnerTeam.club.id,
        playerId: winner.player.id,
        secondaryPlayerId: loser.player.id,
        field: { x, z },
        outcome: winner === carrier ? 'attack-held' : 'turnover-won',
      });
      if (chance(0.14) && second < halfEnd - 3) {
        const foulingTeam = winner === carrier ? defending : possessing;
        bookFoul(second + 0.6, foulingTeam, loser, winner, { x, z });
        second += 1.5;
      }
      if (winner !== carrier) {
        emit(second + 0.7, 'possession', {
          teamId: defending.club.id,
          playerId: challenger.player.id,
          field: { x, z },
          outcome: 'duel-won',
        });
        turnover = true;
        second += 0.7;
      }
    }

    const progress = clamp((direction * x + FIELD_X) / (FIELD_X * 2), 0, 1);
    const attackEdge = possessing.club.attack / defending.club.defense;
    const shotProbability = 0.13 + progress * 0.28 + (attackEdge - 1) * 0.07;
    if (!turnover && chance(shotProbability) && second < halfEnd - 5) {
      second += randBetween(1.0, 3.2);
      const shooter = carrier.player.role === 'GK'
        ? pickWeighted(random, possessing, { GK: 0.01, DEF: 0.35, MID: 1.15, FWD: 2.2 })
        : carrier;
      const centrality = 1 - Math.abs(z) / FIELD_Z;
      const xg = clamp(
        0.024 + 0.32 * progress ** 3 + 0.06 * centrality + 0.06 * (attackEdge - 1),
        0.022,
        0.48,
      );
      const goal = chance(xg);
      const onTarget = goal || chance(0.34 + xg * 0.58);
      const shotOutcome = goal ? 'goal' : (onTarget ? 'saved' : (chance(0.2) ? 'blocked' : 'off-target'));
      possessing.stats.shots += 1;
      possessing.stats.expectedGoals += xg;
      shooter.shots += 1;
      if (onTarget) {
        possessing.stats.shotsOnTarget += 1;
        shooter.shotsOnTarget += 1;
      }
      emit(second, 'shot', {
        teamId: possessing.club.id,
        playerId: shooter.player.id,
        field: { x, z },
        outcome: shotOutcome,
        detail: { xg: round(xg, 3) },
      });

      if (goal) {
        second += randBetween(0.7, 1.3);
        score[possessing.side] += 1;
        possessing.stats.goals += 1;
        shooter.goals += 1;
        if (lastPasser && lastPasser !== shooter) lastPasser.assists += 1;
        emit(second, 'goal', {
          teamId: possessing.club.id,
          playerId: shooter.player.id,
          secondaryPlayerId: lastPasser && lastPasser !== shooter ? lastPasser.player.id : null,
          field: { x: direction * 31.4, z: z * 0.3 },
          outcome: 'scored',
          detail: { xg: round(xg, 3) },
        });
      } else if (onTarget) {
        second += randBetween(0.6, 1.1);
        const keeper = keeperOf(defending);
        defending.stats.saves += 1;
        keeper.saves += 1;
        emit(second, 'save', {
          teamId: defending.club.id,
          playerId: keeper.player.id,
          secondaryPlayerId: shooter.player.id,
          field: { x: direction * 30.3, z: z * 0.25 },
          outcome: chance(0.7) ? 'held' : 'parried',
        });
      }
    }

    const lull = randBetween(11, 27);
    const phaseEnd = Math.min(halfEnd - 2, second + lull);
    possessing.stats.possessionSeconds += Math.max(1, phaseEnd - startSecond);
    return phaseEnd;
  }

  const openingTeam = chance(0.5) ? home : away;
  const openingPlayer = pickWeighted(random, openingTeam, { GK: 0.01, DEF: 0.4, MID: 1.2, FWD: 1.6 });
  emit(0, 'kickoff', {
    period: 1,
    teamId: openingTeam.club.id,
    playerId: openingPlayer.player.id,
    field: { x: 0, z: 0 },
    outcome: 'first-half',
  });

  let currentSecond = randBetween(6, 11);
  while (currentSecond < HALF_SECONDS - 15) {
    currentSecond = runPhase(currentSecond, 1, HALF_SECONDS);
  }
  emit(HALF_SECONDS, 'halftime', { period: 1, outcome: 'complete' });

  const secondHalfTeam = opponent(openingTeam);
  const secondHalfPlayer = pickWeighted(random, secondHalfTeam, { GK: 0.01, DEF: 0.4, MID: 1.2, FWD: 1.6 });
  emit(HALF_SECONDS + 1, 'kickoff', {
    period: 2,
    teamId: secondHalfTeam.club.id,
    playerId: secondHalfPlayer.player.id,
    field: { x: 0, z: 0 },
    outcome: 'second-half',
  });
  currentSecond = HALF_SECONDS + randBetween(7, 12);
  while (currentSecond < MATCH_SECONDS - 15) {
    currentSecond = runPhase(currentSecond, 2, MATCH_SECONDS);
  }
  emit(MATCH_SECONDS, 'fulltime', { period: 2, outcome: 'complete' });

  // Event times are generated in order, but card follow-ups can be fractions
  // after a phase edge. Sorting gives a strict canonical sequence, and every
  // event is re-numbered after that canonicalization.
  events.sort((a, b) => a.matchSecond - b.matchSecond || a.seq - b.seq);
  for (let index = 0; index < events.length; index += 1) {
    events[index].seq = index;
    events[index].id = `${id}:event:${index}`;
  }

  const anchors = events.filter(event => event.field !== null);
  function ballAt(matchSecond) {
    if (!anchors.length) return { x: 0, y: 0.22, z: 0 };
    let low = 0;
    let high = anchors.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (anchors[mid].matchSecond <= matchSecond) low = mid;
      else high = mid - 1;
    }
    const from = anchors[low];
    const to = anchors[Math.min(low + 1, anchors.length - 1)];
    const span = Math.max(0.001, to.matchSecond - from.matchSecond);
    const rawT = clamp((matchSecond - from.matchSecond) / span, 0, 1);
    const smoothT = rawT * rawT * (3 - 2 * rawT);
    const arc = from.type === 'shot' ? Math.sin(Math.PI * rawT) * 3.2 : 0;
    return {
      x: from.field.x + (to.field.x - from.field.x) * smoothT,
      y: 0.22 + arc,
      z: from.field.z + (to.field.z - from.field.z) * smoothT,
    };
  }

  function playerPosition(entry, slot, team, matchSecond, broadcastSecond, ball, possessingTeamId, carrierId, sentOff) {
    const period = matchSecond < HALF_SECONDS ? 1 : 2;
    const direction = attackDirection(team.side, period);
    if (sentOff) {
      return { x: team.side === 'home' ? -30.5 : 30.5, z: 19 - slot * 0.12 };
    }
    if (entry.player.id === carrierId) {
      return {
        x: clamp(ball.x - direction * 0.72, -30.5, 30.5),
        z: clamp(ball.z + (slot % 2 ? 0.32 : -0.32), -18.5, 18.5),
      };
    }
    const phase = (hashString(entry.player.id) % 6283) / 1000;
    const inPossession = possessingTeamId === team.club.id;
    const baseX = direction * BASE_X[slot];
    const follow = entry.player.role === 'GK' ? 0.035 : (inPossession ? 0.2 : 0.13);
    const shiftX = (ball.x - baseX) * follow;
    const shiftZ = (ball.z - BASE_Z[slot]) * (entry.player.role === 'GK' ? 0.04 : 0.12);
    const xWobble = Math.sin(broadcastSecond * 0.72 + phase) * (entry.player.role === 'GK' ? 0.22 : 0.62);
    const zWobble = Math.sin(broadcastSecond * 0.91 + phase * 1.7) * (entry.player.role === 'GK' ? 0.35 : 0.9);
    return {
      x: clamp(baseX + shiftX + xWobble, -30.5, 30.5),
      z: clamp(BASE_Z[slot] + shiftZ + zWobble, -18.5, 18.5),
    };
  }

  const snapshots = [];
  const snapshotTimes = makeSnapshotTimes(safeDuration);
  let eventCursor = 0;
  let scoreHome = 0;
  let scoreAway = 0;
  let possessingTeamId = openingTeam.club.id;
  let carrierId = openingPlayer.player.id;
  let latestEvent = events[0];
  const sentOff = new Set();
  const previousPositions = new Map();

  for (const at of snapshotTimes) {
    const matchSecond = at / safeDuration * MATCH_SECONDS;
    while (eventCursor < events.length && events[eventCursor].matchSecond <= matchSecond + 1e-9) {
      const event = events[eventCursor];
      latestEvent = event;
      scoreHome = event.score.home;
      scoreAway = event.score.away;
      if (event.type === 'kickoff' || event.type === 'possession') {
        possessingTeamId = event.teamId;
        carrierId = event.playerId;
      } else if (event.type === 'pass') {
        if (event.outcome === 'complete') carrierId = event.secondaryPlayerId;
        else {
          possessingTeamId = event.detail.interceptorTeamId;
          carrierId = event.detail.interceptorId;
        }
      } else if (event.type === 'duel') {
        possessingTeamId = event.teamId;
        carrierId = event.playerId;
      } else if (event.type === 'shot') {
        possessingTeamId = event.teamId;
        carrierId = event.playerId;
      } else if (event.type === 'save') {
        possessingTeamId = event.teamId;
        carrierId = event.playerId;
      } else if (event.type === 'foul') {
        possessingTeamId = event.detail.victimTeamId;
        carrierId = event.secondaryPlayerId;
      } else if (event.type === 'red') {
        sentOff.add(event.playerId);
      }
      eventCursor += 1;
    }

    const ball = ballAt(matchSecond);
    const broadcastSecond = at / 1000;
    const previousAt = snapshots.length ? snapshots[snapshots.length - 1].at : at;
    const deltaBroadcast = Math.max(0, (at - previousAt) / 1000);
    const snapshotPlayers = [];

    for (const team of teams) {
      for (let slot = 0; slot < team.players.length; slot += 1) {
        const entry = team.players[slot];
        const isSentOff = sentOff.has(entry.player.id);
        const desiredPosition = playerPosition(
          entry, slot, team, matchSecond, broadcastSecond, ball,
          possessingTeamId, carrierId, isSentOff,
        );
        const previousPosition = previousPositions.get(entry.player.id);
        let position = desiredPosition;
        let vx = 0;
        let vz = 0;
        if (previousPosition && deltaBroadcast > 0) {
          const dx = desiredPosition.x - previousPosition.x;
          const dz = desiredPosition.z - previousPosition.z;
          const distance = Math.hypot(dx, dz);
          const maxSpeed = isSentOff ? 5.5 : (entry.player.role === 'GK' ? 6.2 : 8.4);
          const maximumStep = maxSpeed * deltaBroadcast;
          const scale = distance > maximumStep ? maximumStep / distance : 1;
          position = {
            x: previousPosition.x + dx * scale,
            z: previousPosition.z + dz * scale,
          };
          vx = (position.x - previousPosition.x) / deltaBroadcast;
          vz = (position.z - previousPosition.z) / deltaBroadcast;
        }
        previousPositions.set(entry.player.id, position);
        let activity;
        if (isSentOff) activity = 'sent-off';
        else if (entry.player.id === carrierId) activity = 'on-ball';
        else if (latestEvent.playerId === entry.player.id && matchSecond - latestEvent.matchSecond <= 8) {
          activity = ({
            pass: 'passing', duel: 'dueling', shot: 'shooting', save: 'saving',
            goal: 'celebrating', foul: 'fouling', yellow: 'booked', red: 'sent-off',
          })[latestEvent.type] || 'moving';
        } else if (entry.player.role === 'GK') activity = 'goalkeeping';
        else activity = team.club.id === possessingTeamId ? 'supporting' : 'defending';

        snapshotPlayers.push({
          id: entry.player.id,
          name: entry.player.name,
          teamId: team.club.id,
          role: entry.player.role,
          number: entry.player.number,
          x: round(position.x),
          z: round(position.z),
          vx: round(vx),
          vz: round(vz),
          activity,
        });
      }
    }

    snapshots.push({
      seq: snapshots.length,
      at,
      matchSecond: round(matchSecond, 1),
      clock: clockAt(matchSecond),
      phase: phaseFor(matchSecond, at, safeDuration),
      scoreHome,
      scoreAway,
      possessingTeamId,
      possessingPlayerId: carrierId,
      ball: { x: round(ball.x), y: round(ball.y), z: round(ball.z) },
      players: snapshotPlayers,
      lastEventSeq: latestEvent?.seq ?? -1,
    });
  }

  function finalizeTeamStats(team) {
    const totalPossession = home.stats.possessionSeconds + away.stats.possessionSeconds;
    return {
      teamId: team.club.id,
      possessionPct: round(totalPossession ? team.stats.possessionSeconds / totalPossession * 100 : 50, 1),
      passes: team.stats.passes,
      completedPasses: team.stats.completedPasses,
      passAccuracyPct: round(team.stats.passes ? team.stats.completedPasses / team.stats.passes * 100 : 0, 1),
      shots: team.stats.shots,
      shotsOnTarget: team.stats.shotsOnTarget,
      goals: team.stats.goals,
      expectedGoals: round(team.stats.expectedGoals, 2),
      saves: team.stats.saves,
      fouls: team.stats.fouls,
      yellowCards: team.stats.yellowCards,
      redCards: team.stats.redCards,
      duelsWon: team.stats.duelsWon,
    };
  }

  function finalizePlayerStats(team) {
    return team.players.map(entry => ({
      playerId: entry.player.id,
      name: entry.player.name,
      teamId: team.club.id,
      role: entry.player.role,
      number: entry.player.number,
      passes: entry.passes,
      completedPasses: entry.completedPasses,
      shots: entry.shots,
      shotsOnTarget: entry.shotsOnTarget,
      goals: entry.goals,
      assists: entry.assists,
      saves: entry.saves,
      fouls: entry.fouls,
      yellowCards: entry.yellowCards,
      redCards: entry.redCards,
      duelsWon: entry.duelsWon,
      touches: entry.touches,
      sentOff: entry.sentOff,
    }));
  }

  const outcome = score.home === score.away ? 'draw' : (score.home > score.away ? 'home' : 'away');
  const winnerTeamId = outcome === 'draw' ? null : (outcome === 'home' ? homeClub.id : awayClub.id);
  const match = {
    schemaVersion: 1,
    id,
    seed: seedText,
    durationMs: safeDuration,
    matchSeconds: MATCH_SECONDS,
    status: 'complete',
    home: {
      id: homeClub.id,
      name: homeClub.name,
      city: homeClub.city,
      code: homeClub.code,
      color: homeClub.color,
      lineup: homeClub.lineup.map(player => ({ ...player })),
    },
    away: {
      id: awayClub.id,
      name: awayClub.name,
      city: awayClub.city,
      code: awayClub.code,
      color: awayClub.color,
      lineup: awayClub.lineup.map(player => ({ ...player })),
    },
    result: {
      completed: true,
      outcome,
      winnerTeamId,
      scoreHome: score.home,
      scoreAway: score.away,
    },
    stats: {
      home: finalizeTeamStats(home),
      away: finalizeTeamStats(away),
      players: [...finalizePlayerStats(home), ...finalizePlayerStats(away)],
    },
    events,
    snapshots,
  };

  return deepFreeze(match);
}

export default simulateMatch;
