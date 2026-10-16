import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createClient } from '@libsql/client';
import { buildRoundRobin, deriveMatchState, hash32, FALLBACK_LEAGUES } from './canonical-server.js';

export const ENGINE_VERSION = 'league-v1';
export const ROUND_MS = 360_000;
const SPORTS = Object.keys(FALLBACK_LEAGUES);
const ROUNDS = buildRoundRobin(8);
const statement = (sql, ...args) => ({ sql, args });
const rows = async (db, sql, ...args) => (await db.execute(statement(sql, ...args))).rows;
const json = value => JSON.stringify(value);

export function connectLeague({ url = process.env.CYBERLIGA_LEAGUE_DATABASE_URL || process.env.TURSO_DATABASE_URL, authToken = process.env.CYBERLIGA_LEAGUE_DATABASE_TOKEN || process.env.TURSO_AUTH_TOKEN } = {}) {
  if (!url) throw new Error('league_database_not_configured');
  return createClient({ url, authToken });
}

export async function foundingTeams() {
  const sandbox = { window: {} };
  runInNewContext(await readFile(new URL('../worlddata.js', import.meta.url), 'utf8'), sandbox);
  const content = sandbox.window.CYBERLIGA_CONTENT;
  return SPORTS.flatMap(sportKey => content.getTeams(sportKey).map(team => ({
    publicId: team.id, sportKey, name: team.name, code: team.code, city: team.city,
    color: team.colors.primary,
    athletes: team.athletes.map(athlete => ({ publicId: athlete.id, displayName: athlete.name, squadNumber: athlete.number, role: athlete.role }))
  })));
}

// Schema initialization is a worker command, never a public request side effect.
export async function initializeLeague(db, { epoch = Date.now(), roundMs = ROUND_MS } = {}) {
  if (!Number.isSafeInteger(epoch) || epoch < 0 || !Number.isSafeInteger(roundMs) || roundMs < 1000) throw new Error('invalid_league_clock');
  if (db.protocol === 'file') await db.execute('PRAGMA journal_mode=WAL');
  await db.batch([
    'CREATE TABLE IF NOT EXISTS league_state (id INTEGER PRIMARY KEY CHECK(id=1), version TEXT NOT NULL, epoch INTEGER NOT NULL, round_ms INTEGER NOT NULL, completed_round INTEGER NOT NULL DEFAULT -1, observed_at INTEGER NOT NULL, heartbeat_at INTEGER NOT NULL)',
    'CREATE TABLE IF NOT EXISTS league_teams (id TEXT PRIMARY KEY, sport TEXT NOT NULL, data TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS league_seasons (id TEXT PRIMARY KEY, sport TEXT NOT NULL, number INTEGER NOT NULL, starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL, UNIQUE(sport,number))',
    'CREATE TABLE IF NOT EXISTS league_fixtures (id TEXT PRIMARY KEY, season_id TEXT NOT NULL REFERENCES league_seasons(id), sport TEXT NOT NULL, round_index INTEGER NOT NULL, starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL, config TEXT NOT NULL, state TEXT NOT NULL, finalized INTEGER NOT NULL DEFAULT 0)',
    'CREATE INDEX IF NOT EXISTS league_fixture_season ON league_fixtures(season_id,starts_at)',
    'CREATE INDEX IF NOT EXISTS league_fixture_round ON league_fixtures(round_index)',
    'CREATE TABLE IF NOT EXISTS league_events (id TEXT PRIMARY KEY, fixture_id TEXT NOT NULL REFERENCES league_fixtures(id), sequence INTEGER NOT NULL, data TEXT NOT NULL, UNIQUE(fixture_id,sequence))',
    statement('INSERT OR IGNORE INTO league_state(id,version,epoch,round_ms,observed_at,heartbeat_at) VALUES (1,?,?,?,?,?)', ENGINE_VERSION, epoch, roundMs, epoch, 0)
  ], 'write');
  const state = (await rows(db, 'SELECT * FROM league_state WHERE id=1'))[0];
  if (state.version !== ENGINE_VERSION) throw new Error('unsupported_league_engine_version');
  const teams = await foundingTeams();
  await db.batch(teams.map(team => statement('INSERT OR IGNORE INTO league_teams(id,sport,data) VALUES (?,?,?)', team.publicId, team.sportKey, json(team))), 'write');
  return state;
}

function makeFixtures(teams, clock, roundIndex) {
  const number = Math.floor(roundIndex / ROUNDS.length) + 1;
  const roundNumber = roundIndex % ROUNDS.length + 1;
  const startsAt = clock.epoch + roundIndex * clock.round_ms;
  return SPORTS.flatMap(sportKey => {
    const clubs = teams.filter(team => team.sportKey === sportKey);
    const seasonPublicId = `${sportKey}-s${String(number).padStart(5, '0')}`;
    return ROUNDS[roundNumber - 1].map(([home, away], channel) => {
      const publicId = `${seasonPublicId}-r${roundNumber}-c${channel + 1}`;
      return { publicId, seasonPublicId, sportKey, roundNumber, channel, seed: hash32(ENGINE_VERSION + publicId), startsAt,
        scheduledEndAt: startsAt + clock.round_ms, homeTeam: clubs[home], awayTeam: clubs[away] };
    });
  });
}

async function saveRound(tx, teams, clock, index, observedAt) {
  const existing = new Map((await rows(tx, 'SELECT id,config,finalized FROM league_fixtures WHERE round_index=?', index)).map(row => [row.id,row]));
  const writes = [];
  for (const fixture of makeFixtures(teams, clock, index)) {
    const number = Math.floor(index / ROUNDS.length) + 1;
    const starts = clock.epoch + (number - 1) * ROUNDS.length * clock.round_ms;
    writes.push(statement('INSERT OR IGNORE INTO league_seasons VALUES (?,?,?,?,?)', fixture.seasonPublicId, fixture.sportKey, number, starts, starts + ROUNDS.length * clock.round_ms));
    writes.push(statement('INSERT OR IGNORE INTO league_fixtures(id,season_id,sport,round_index,starts_at,ends_at,config,state) VALUES (?,?,?,?,?,?,?,?)',
      fixture.publicId, fixture.seasonPublicId, fixture.sportKey, index, fixture.startsAt, fixture.scheduledEndAt, json(fixture), json(deriveMatchState(fixture, fixture.startsAt - 1))));
    const stored = existing.get(fixture.publicId);
    if (stored?.finalized || observedAt < fixture.startsAt) continue;
    // Compute from immutable fixture/roster snapshots. Never trust a browser's score.
    const state = deriveMatchState(stored ? JSON.parse(stored.config) : fixture, observedAt);
    writes.push(statement('UPDATE league_fixtures SET state=?,finalized=? WHERE id=?', json(state), state.status === 'final' ? 1 : 0, fixture.publicId));
    for (const event of state.events) writes.push(statement('INSERT OR IGNORE INTO league_events VALUES (?,?,?,?)', event.eventKey, fixture.publicId, event.sequence, json(event)));
  }
  await tx.batch(writes);
}

async function tickOnce(db, observedAt, { maxRounds = 24, heartbeatAt = Date.now(), minIntervalMs = 0 } = {}) {
  if (!Number.isSafeInteger(observedAt) || !Number.isInteger(maxRounds) || maxRounds < 1 || maxRounds > 48) throw new Error('invalid_tick');
  let tx;
  for (let attempt = 0; ; attempt++) {
    try { tx = await db.transaction('write'); break; }
    catch (error) {
      if (!/SQLITE_BUSY|SQLITE_LOCKED/.test(error.code || '') || attempt >= 5) throw error;
      await new Promise(resolve => setTimeout(resolve, 25 * 2 ** attempt));
    }
  }
  try {
    const clock = (await rows(tx, 'SELECT * FROM league_state WHERE id=1'))[0];
    if (!clock || clock.version !== ENGINE_VERSION) throw new Error('league_not_initialized');
    // The persisted clock cannot move backwards, even across overlapping workers/retries.
    const now = Math.max(clock.epoch, clock.observed_at, observedAt);
    const current = Math.floor((now - clock.epoch) / clock.round_ms);
    if (observedAt - clock.observed_at < minIntervalMs && clock.completed_round >= current - 1) {
      await tx.commit();
      return { completedRounds:clock.completed_round + 1, processedRounds:0, backlogRounds:0, observedAt:clock.observed_at, skipped:true };
    }
    const through = Math.min(current - 1, clock.completed_round + maxRounds);
    const teams = (await rows(tx, 'SELECT data FROM league_teams ORDER BY rowid')).map(row => JSON.parse(row.data));
    for (let round = clock.completed_round + 1; round <= through; round++) await saveRound(tx, teams, clock, round, now);
    const backlog = current - 1 - through;
    if (!backlog) {
      await saveRound(tx, teams, clock, current, now);
      await saveRound(tx, teams, clock, current + 1, now);
    }
    await tx.execute(statement('UPDATE league_state SET completed_round=?,observed_at=?,heartbeat_at=? WHERE id=1', through, now, heartbeatAt));
    await tx.commit();
    return { completedRounds: through + 1, processedRounds: through - clock.completed_round, backlogRounds: backlog, observedAt: now };
  } catch (error) { await tx.rollback(); throw error; } finally { tx.close(); }
}

export async function tickLeague(db, observedAt = Date.now(), options = {}) {
  for (let attempt = 0; ; attempt++) {
    try { return await tickOnce(db, observedAt, options); }
    catch (error) {
      if (!/SQLITE_BUSY|SQLITE_LOCKED/.test(error.code || '') || attempt >= 4) throw error;
      await new Promise(resolve => setTimeout(resolve, 40 * 2 ** attempt));
    }
  }
}

export function standingsFor(teams, fixtures) {
  const table = new Map(teams.map(team => [team.publicId, { team, played: 0, wins: 0, draws: 0, losses: 0, points: 0, scoreFor: 0, scoreAgainst: 0, form: [] }]));
  for (const fixture of fixtures.filter(item => item.status === 'final')) {
    const home = table.get(fixture.homeTeam.publicId), away = table.get(fixture.awayTeam.publicId);
    for (const [row, score, against] of [[home, fixture.homeScore, fixture.awayScore], [away, fixture.awayScore, fixture.homeScore]]) {
      row.played++; row.scoreFor += score; row.scoreAgainst += against;
      const result = score > against ? 'W' : score === against ? 'D' : 'L';
      row.form.push(result); row[result === 'W' ? 'wins' : result === 'D' ? 'draws' : 'losses']++;
      row.points += result === 'W' ? 3 : result === 'D' ? 1 : 0;
    }
  }
  return [...table.values()].sort((a, b) => b.points - a.points || (b.scoreFor - b.scoreAgainst) - (a.scoreFor - a.scoreAgainst) || a.team.name.localeCompare(b.team.name))
    .map((row, i) => ({ ...row, rank: i + 1, form: row.form.slice(-5), scoreDifference: row.scoreFor - row.scoreAgainst }));
}

async function readLeagueSnapshot(db, { sport = 'soccer', seasonId, fixtureId, now = Date.now() } = {}) {
  if (!SPORTS.includes(sport)) throw new Error('unknown_sport');
  const clock = (await rows(db, 'SELECT * FROM league_state WHERE id=1'))[0];
  if (!clock) throw new Error('league_not_initialized');
  const seasons = await rows(db, 'SELECT * FROM league_seasons WHERE sport=? ORDER BY number DESC LIMIT 24', sport);
  const current = seasons.find(season => season.starts_at <= clock.observed_at && season.ends_at > clock.observed_at) || seasons[0];
  const season = seasonId ? seasons.find(item => item.id === seasonId) : current;
  if (seasonId && !season) throw new Error('unknown_season');
  const teams = (await rows(db, 'SELECT data FROM league_teams WHERE sport=? ORDER BY rowid', sport)).map(row => JSON.parse(row.data));
  const fixtures = season ? (await rows(db, 'SELECT state FROM league_fixtures WHERE season_id=? ORDER BY starts_at,id', season.id)).map(row => JSON.parse(row.state)) : [];
  const totals = new Map();
  for (const fixture of fixtures.filter(item => item.status === 'final')) for (const event of fixture.events) {
    if (!event.athleteId || !event.payload?.points) continue;
    totals.set(event.athleteId, (totals.get(event.athleteId) || 0) + event.payload.points);
  }
  const leaders = teams.flatMap(team => team.athletes.map(athlete => ({ ...athlete, teamId: team.publicId, teamCode: team.code, points: totals.get(athlete.publicId) || 0 })))
    .filter(athlete => athlete.points).sort((a, b) => b.points - a.points || a.publicId.localeCompare(b.publicId)).slice(0, 8);
  const fixture = fixtureId ? fixtures.find(item => item.fixtureId === fixtureId) : undefined;
  if (fixtureId && !fixture) throw new Error('unknown_fixture');
  return { schemaVersion: 1, source: 'persistent-simulation', engineVersion: clock.version, persisted: true, sport,
    observedAt: new Date(clock.observed_at).toISOString(), heartbeatAt: new Date(clock.heartbeat_at).toISOString(),
    delayed: now - clock.heartbeat_at > 90_000, roundMs: clock.round_ms,
    catchingUp: clock.completed_round < Math.floor((clock.observed_at - clock.epoch) / clock.round_ms) - 1,
    rules: '14 rounds · 3 points for a win, 1 for a draw · ties: score difference, club name',
    simulationNote: 'Scheduled league simulation, recorded when visited and by a daily catch-up. Arena broadcasts are separate exhibitions; their scores do not change this table.',
    seasons, season, teams, fixtures: fixtures.map(({ events, ...item }) => item), fixture,
    standings: standingsFor(teams, fixtures), leaders,
    summary: { completedGames: fixtures.filter(item => item.status === 'final').length, liveGames: fixtures.filter(item => item.status === 'live').length, scheduledGames: fixtures.filter(item => item.status === 'scheduled').length }
  };
}

export async function readLeague(db, options = {}) {
  const tx = await db.transaction('read');
  try { const result = await readLeagueSnapshot(tx, options); await tx.commit(); return result; }
  finally { tx.close(); }
}
