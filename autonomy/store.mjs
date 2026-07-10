import { DatabaseSync } from 'node:sqlite';

const MATCH_SELECT = `
  SELECT
    f.id AS fixture_id,
    f.season_id,
    f.round,
    f.slot,
    f.home_club_id,
    f.away_club_id,
    f.kickoff_at,
    f.end_at,
    f.status AS fixture_status,
    f.seed,
    m.id AS match_id,
    m.duration_ms,
    m.simulated_at,
    m.result_json,
    m.stats_json,
    home.city AS home_city,
    home.name AS home_name,
    home.code AS home_code,
    home.color AS home_color,
    home.data_json AS home_data_json,
    away.city AS away_city,
    away.name AS away_name,
    away.code AS away_code,
    away.color AS away_color,
    away.data_json AS away_data_json
  FROM fixtures f
  JOIN clubs home ON home.id = f.home_club_id
  JOIN clubs away ON away.id = f.away_club_id
  LEFT JOIN matches m ON m.fixture_id = f.id
`;

function parseJson(value, fallback = null) {
  if (value == null) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function omitCountryFields(value) {
  if (Array.isArray(value)) return value.map(omitCountryFields);
  if (!value || typeof value !== 'object') return value;

  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (/^(country|countryCode|countryName|nation|nationality|flag|federation)$/i.test(key)) continue;
    result[key] = omitCountryFields(child);
  }
  return result;
}

export function normalizeClub(club) {
  if (!club || typeof club !== 'object') throw new TypeError('Every club must be an object.');

  const city = String(club.city ?? '').trim();
  const id = String(club.id ?? city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).trim();
  if (!id) throw new TypeError('Every club needs a stable id or city.');
  if (!city) throw new TypeError(`Club ${id} needs a city.`);

  const name = String(club.name ?? `${city} FC`).trim();
  const code = String(club.code ?? club.shortName ?? city.slice(0, 3)).trim().toUpperCase().slice(0, 8);
  const color = String(club.color ?? club.primaryColor ?? '#ffffff').trim();
  const sanitized = omitCountryFields({ ...club, id, city, name, code, color });

  return { id, city, name, code, color, data: sanitized };
}

function clubFromColumns(row, prefix) {
  const data = parseJson(row[`${prefix}_data_json`], {});
  return {
    ...data,
    id: row[`${prefix}_club_id`],
    city: row[`${prefix}_city`],
    name: row[`${prefix}_name`],
    code: row[`${prefix}_code`],
    color: row[`${prefix}_color`],
  };
}

function fixtureFromRow(row) {
  return {
    id: row.fixture_id ?? row.id,
    seasonId: row.season_id,
    round: Number(row.round),
    slot: Number(row.slot ?? 0),
    homeClubId: row.home_club_id,
    awayClubId: row.away_club_id,
    kickoffAt: Number(row.kickoff_at),
    endAt: Number(row.end_at),
    status: row.fixture_status ?? row.status,
    seed: Number(row.seed),
    ...(row.home_city ? { home: clubFromColumns(row, 'home') } : {}),
    ...(row.away_city ? { away: clubFromColumns(row, 'away') } : {}),
    ...(row.match_id ? {
      matchId: row.match_id,
      durationMs: Number(row.duration_ms),
      simulatedAt: Number(row.simulated_at),
      result: parseJson(row.result_json, {}),
      stats: parseJson(row.stats_json, {}),
    } : {}),
  };
}

function snapshotFromRow(row) {
  if (!row) return null;
  return {
    sequence: Number(row.sequence),
    elapsedMs: Number(row.elapsed_ms),
    state: parseJson(row.state_json, {}),
  };
}

function eventFromRow(row) {
  return {
    sequence: Number(row.sequence),
    elapsedMs: Number(row.elapsed_ms),
    type: row.event_type,
    data: parseJson(row.event_json, {}),
  };
}

export function scoreFromResult(result = {}) {
  const score = result?.score ?? result?.finalScore ?? {};
  const home = [result.homeScore, result.scoreHome, result.homeGoals, score.home, score.homeScore, result.home]
    .find(value => Number.isFinite(Number(value)));
  const away = [result.awayScore, result.scoreAway, result.awayGoals, score.away, score.awayScore, result.away]
    .find(value => Number.isFinite(Number(value)));
  return { home: Math.max(0, toInteger(home)), away: Math.max(0, toInteger(away)) };
}

export class LeagueStore {
  constructor(filename = ':memory:') {
    this.filename = filename;
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA foreign_keys = ON');
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = NORMAL');
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS seasons (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        starts_at INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('scheduled', 'active', 'complete')),
        format TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS clubs (
        id TEXT PRIMARY KEY,
        city TEXT NOT NULL,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        color TEXT NOT NULL,
        data_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS season_clubs (
        season_id TEXT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
        club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE RESTRICT,
        seed_order INTEGER NOT NULL,
        PRIMARY KEY (season_id, club_id),
        UNIQUE (season_id, seed_order)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS fixtures (
        id TEXT PRIMARY KEY,
        season_id TEXT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
        fixture_key TEXT NOT NULL,
        round INTEGER NOT NULL,
        slot INTEGER NOT NULL,
        home_club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE RESTRICT,
        away_club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE RESTRICT,
        kickoff_at INTEGER NOT NULL,
        end_at INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('scheduled', 'live', 'final')),
        seed INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        CHECK (home_club_id <> away_club_id),
        UNIQUE (season_id, fixture_key),
        UNIQUE (season_id, round, home_club_id, away_club_id)
      ) STRICT;

      CREATE INDEX IF NOT EXISTS fixtures_clock_idx ON fixtures(kickoff_at, end_at, status);
      CREATE INDEX IF NOT EXISTS fixtures_club_home_idx ON fixtures(home_club_id, kickoff_at);
      CREATE INDEX IF NOT EXISTS fixtures_club_away_idx ON fixtures(away_club_id, kickoff_at);

      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        fixture_id TEXT NOT NULL UNIQUE REFERENCES fixtures(id) ON DELETE CASCADE,
        duration_ms INTEGER NOT NULL CHECK (duration_ms > 0),
        simulated_at INTEGER NOT NULL,
        result_json TEXT NOT NULL,
        stats_json TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS events (
        match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL,
        elapsed_ms INTEGER NOT NULL CHECK (elapsed_ms >= 0),
        event_type TEXT NOT NULL,
        event_json TEXT NOT NULL,
        PRIMARY KEY (match_id, sequence)
      ) STRICT;

      CREATE INDEX IF NOT EXISTS events_clock_idx ON events(match_id, elapsed_ms, sequence);

      CREATE TABLE IF NOT EXISTS snapshots (
        match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL,
        elapsed_ms INTEGER NOT NULL CHECK (elapsed_ms >= 0),
        state_json TEXT NOT NULL,
        PRIMARY KEY (match_id, sequence)
      ) STRICT;

      CREATE INDEX IF NOT EXISTS snapshots_clock_idx ON snapshots(match_id, elapsed_ms, sequence);

      CREATE TABLE IF NOT EXISTS standings (
        season_id TEXT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
        club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE RESTRICT,
        played INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        draws INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        goals_for INTEGER NOT NULL DEFAULT 0,
        goals_against INTEGER NOT NULL DEFAULT 0,
        points INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (season_id, club_id)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS fixture_finalizations (
        fixture_id TEXT PRIMARY KEY REFERENCES fixtures(id) ON DELETE CASCADE,
        season_id TEXT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
        finalized_at INTEGER NOT NULL
      ) STRICT;
    `);
  }

  transaction(callback) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const value = callback();
      this.db.exec('COMMIT');
      return value;
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch {}
      throw error;
    }
  }

  close() {
    this.db.close();
  }

  upsertClubs(clubs, at) {
    const normalized = clubs.map(normalizeClub);
    const statement = this.db.prepare(`
      INSERT INTO clubs (id, city, name, code, color, data_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        city = excluded.city,
        name = excluded.name,
        code = excluded.code,
        color = excluded.color,
        data_json = excluded.data_json,
        updated_at = excluded.updated_at
    `);

    this.transaction(() => {
      for (const club of normalized) {
        statement.run(club.id, club.city, club.name, club.code, club.color, JSON.stringify(club.data), at, at);
      }
    });
    return normalized.map(club => club.data);
  }

  ensureSeason({ id, slug, name, startsAt, format, clubs, at }) {
    return this.transaction(() => {
      this.db.prepare(`
        INSERT OR IGNORE INTO seasons (id, slug, name, starts_at, status, format, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'scheduled', ?, ?, ?)
      `).run(id, slug, name, startsAt, format, at, at);

      const count = Number(this.db.prepare('SELECT COUNT(*) AS count FROM season_clubs WHERE season_id = ?').get(id).count);
      if (count === 0) {
        const membership = this.db.prepare('INSERT INTO season_clubs (season_id, club_id, seed_order) VALUES (?, ?, ?)');
        const standing = this.db.prepare(`
          INSERT OR IGNORE INTO standings (season_id, club_id, updated_at) VALUES (?, ?, ?)
        `);
        clubs.forEach((club, index) => {
          membership.run(id, club.id, index);
          standing.run(id, club.id, at);
        });
      }

      return this.getSeason(id);
    });
  }

  getSeason(id) {
    const row = this.db.prepare('SELECT * FROM seasons WHERE id = ?').get(id);
    if (!row) return null;
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      startsAt: Number(row.starts_at),
      status: row.status,
      format: row.format,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  }

  getSeasonClubs(seasonId) {
    const rows = this.db.prepare(`
      SELECT c.*, sc.seed_order
      FROM season_clubs sc
      JOIN clubs c ON c.id = sc.club_id
      WHERE sc.season_id = ?
      ORDER BY sc.seed_order
    `).all(seasonId);
    return rows.map(row => ({
      ...parseJson(row.data_json, {}),
      id: row.id,
      city: row.city,
      name: row.name,
      code: row.code,
      color: row.color,
      seedOrder: Number(row.seed_order),
    }));
  }

  insertFixtures(fixtures, at) {
    const statement = this.db.prepare(`
      INSERT OR IGNORE INTO fixtures (
        id, season_id, fixture_key, round, slot, home_club_id, away_club_id,
        kickoff_at, end_at, status, seed, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?)
    `);

    return this.transaction(() => fixtures.reduce((inserted, fixture) => {
      const result = statement.run(
        fixture.id,
        fixture.seasonId,
        fixture.fixtureKey,
        fixture.round,
        fixture.slot,
        fixture.homeClubId,
        fixture.awayClubId,
        fixture.kickoffAt,
        fixture.endAt,
        fixture.seed,
        at,
        at,
      );
      return inserted + Number(result.changes);
    }, 0));
  }

  listFixturesMissingMatches(seasonId) {
    const rows = this.db.prepare(`
      ${MATCH_SELECT}
      WHERE f.season_id = ? AND m.id IS NULL
      ORDER BY f.kickoff_at, f.slot
    `).all(seasonId);
    return rows.map(fixtureFromRow);
  }

  saveMatch({ id, fixtureId, durationMs, simulatedAt, result, stats, events, snapshots }) {
    return this.transaction(() => {
      const fixture = this.db.prepare('SELECT kickoff_at FROM fixtures WHERE id = ?').get(fixtureId);
      if (!fixture) throw new Error(`Cannot save match for unknown fixture ${fixtureId}.`);

      const insertion = this.db.prepare(`
        INSERT OR IGNORE INTO matches (id, fixture_id, duration_ms, simulated_at, result_json, stats_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, fixtureId, durationMs, simulatedAt, JSON.stringify(result ?? {}), JSON.stringify(stats ?? {}));

      if (Number(insertion.changes) === 0) return false;

      const eventStatement = this.db.prepare(`
        INSERT INTO events (match_id, sequence, elapsed_ms, event_type, event_json)
        VALUES (?, ?, ?, ?, ?)
      `);
      events.forEach((event, sequence) => eventStatement.run(
        id,
        sequence,
        Math.max(0, toInteger(event.elapsedMs)),
        String(event.type ?? event.kind ?? 'event'),
        JSON.stringify(event.data ?? event),
      ));

      const snapshotStatement = this.db.prepare(`
        INSERT INTO snapshots (match_id, sequence, elapsed_ms, state_json)
        VALUES (?, ?, ?, ?)
      `);
      snapshots.forEach((snapshot, sequence) => snapshotStatement.run(
        id,
        sequence,
        Math.max(0, toInteger(snapshot.elapsedMs)),
        JSON.stringify(snapshot.state ?? snapshot),
      ));

      this.db.prepare(`
        UPDATE fixtures SET end_at = kickoff_at + ?, updated_at = ? WHERE id = ?
      `).run(durationMs, simulatedAt, fixtureId);
      return true;
    });
  }

  getFixture(id) {
    const row = this.db.prepare(`${MATCH_SELECT} WHERE f.id = ?`).get(id);
    return row ? fixtureFromRow(row) : null;
  }

  getMatch(id) {
    const row = this.db.prepare(`${MATCH_SELECT} WHERE m.id = ? OR f.id = ? LIMIT 1`).get(id, id);
    return row?.match_id ? fixtureFromRow(row) : null;
  }

  listFixtures({ seasonId, status, clubId } = {}) {
    const clauses = [];
    const values = [];
    if (seasonId) { clauses.push('f.season_id = ?'); values.push(seasonId); }
    if (status) { clauses.push('f.status = ?'); values.push(status); }
    if (clubId) {
      clauses.push('(f.home_club_id = ? OR f.away_club_id = ?)');
      values.push(clubId, clubId);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    return this.db.prepare(`${MATCH_SELECT} ${where} ORDER BY f.kickoff_at, f.slot`).all(...values).map(fixtureFromRow);
  }

  listLiveFixtures(at, seasonId) {
    const rows = this.db.prepare(`
      ${MATCH_SELECT}
      WHERE f.season_id = ? AND f.kickoff_at <= ? AND f.end_at > ? AND m.id IS NOT NULL
      ORDER BY f.kickoff_at, f.slot
    `).all(seasonId, at, at);
    return rows.map(fixtureFromRow);
  }

  getStandings(seasonId) {
    return this.db.prepare(`
      SELECT s.*, c.city, c.name, c.code, c.color, c.data_json,
             (s.goals_for - s.goals_against) AS goal_difference
      FROM standings s
      JOIN clubs c ON c.id = s.club_id
      WHERE s.season_id = ?
      ORDER BY s.points DESC, goal_difference DESC, s.goals_for DESC, c.name ASC
    `).all(seasonId).map((row, index) => ({
      position: index + 1,
      club: {
        ...parseJson(row.data_json, {}),
        id: row.club_id,
        city: row.city,
        name: row.name,
        code: row.code,
        color: row.color,
      },
      played: Number(row.played),
      wins: Number(row.wins),
      draws: Number(row.draws),
      losses: Number(row.losses),
      goalsFor: Number(row.goals_for),
      goalsAgainst: Number(row.goals_against),
      goalDifference: Number(row.goal_difference),
      points: Number(row.points),
    }));
  }

  getTimelineWindow(matchId, elapsedMs) {
    const current = this.db.prepare(`
      SELECT * FROM snapshots
      WHERE match_id = ? AND elapsed_ms <= ?
      ORDER BY elapsed_ms DESC, sequence DESC LIMIT 1
    `).get(matchId, elapsedMs);
    const next = this.db.prepare(`
      SELECT * FROM snapshots
      WHERE match_id = ? AND elapsed_ms > ?
      ORDER BY elapsed_ms ASC, sequence ASC LIMIT 1
    `).get(matchId, elapsedMs);
    const previous = current ? this.db.prepare(`
      SELECT * FROM snapshots
      WHERE match_id = ? AND sequence < ?
      ORDER BY sequence DESC LIMIT 1
    `).get(matchId, current.sequence) : null;
    const floor = current ? Number(current.elapsed_ms) : -1;
    const events = this.db.prepare(`
      SELECT * FROM events
      WHERE match_id = ? AND elapsed_ms > ? AND elapsed_ms <= ?
      ORDER BY elapsed_ms, sequence
    `).all(matchId, floor, elapsedMs).map(eventFromRow);
    const upcomingCeiling = next ? Number(next.elapsed_ms) : elapsedMs;
    const upcomingEvents = this.db.prepare(`
      SELECT * FROM events
      WHERE match_id = ? AND elapsed_ms > ? AND elapsed_ms <= ?
      ORDER BY elapsed_ms, sequence
    `).all(matchId, elapsedMs, upcomingCeiling).map(eventFromRow);
    const eventsThrough = this.db.prepare(`
      SELECT * FROM events
      WHERE match_id = ? AND elapsed_ms <= ?
      ORDER BY elapsed_ms, sequence
    `).all(matchId, elapsedMs).map(eventFromRow);

    return {
      previousSnapshot: snapshotFromRow(previous),
      snapshot: snapshotFromRow(current),
      nextSnapshot: snapshotFromRow(next),
      eventsSinceSnapshot: events,
      upcomingEvents,
      eventsThrough,
    };
  }

  finalizeFixture(fixtureId, at) {
    return this.transaction(() => {
      const row = this.db.prepare(`
        SELECT f.*, m.result_json
        FROM fixtures f JOIN matches m ON m.fixture_id = f.id
        WHERE f.id = ?
      `).get(fixtureId);
      if (!row) throw new Error(`Cannot finalize fixture ${fixtureId} before it is simulated.`);

      const marker = this.db.prepare(`
        INSERT OR IGNORE INTO fixture_finalizations (fixture_id, season_id, finalized_at)
        VALUES (?, ?, ?)
      `).run(fixtureId, row.season_id, at);

      this.db.prepare("UPDATE fixtures SET status = 'final', updated_at = ? WHERE id = ?").run(at, fixtureId);
      if (Number(marker.changes) === 0) return false;

      const { home, away } = scoreFromResult(parseJson(row.result_json, {}));
      const homeWin = home > away ? 1 : 0;
      const awayWin = away > home ? 1 : 0;
      const draw = home === away ? 1 : 0;
      const ensureStanding = this.db.prepare(`
        INSERT OR IGNORE INTO standings (season_id, club_id, updated_at) VALUES (?, ?, ?)
      `);
      ensureStanding.run(row.season_id, row.home_club_id, at);
      ensureStanding.run(row.season_id, row.away_club_id, at);

      this.db.prepare(`
        UPDATE standings SET
          played = played + 1,
          wins = wins + ?, draws = draws + ?, losses = losses + ?,
          goals_for = goals_for + ?, goals_against = goals_against + ?,
          points = points + ?, updated_at = ?
        WHERE season_id = ? AND club_id = ?
      `).run(homeWin, draw, awayWin, home, away, homeWin * 3 + draw, at, row.season_id, row.home_club_id);

      this.db.prepare(`
        UPDATE standings SET
          played = played + 1,
          wins = wins + ?, draws = draws + ?, losses = losses + ?,
          goals_for = goals_for + ?, goals_against = goals_against + ?,
          points = points + ?, updated_at = ?
        WHERE season_id = ? AND club_id = ?
      `).run(awayWin, draw, homeWin, away, home, awayWin * 3 + draw, at, row.season_id, row.away_club_id);

      return true;
    });
  }

  reconcileClock(seasonId, at) {
    const due = this.db.prepare(`
      SELECT id FROM fixtures
      WHERE season_id = ? AND end_at <= ? AND status <> 'final'
      ORDER BY end_at
    `).all(seasonId, at);
    let finalized = 0;
    for (const row of due) finalized += this.finalizeFixture(row.id, at) ? 1 : 0;

    this.transaction(() => {
      this.db.prepare(`
        UPDATE fixtures SET status = 'live', updated_at = ?
        WHERE season_id = ? AND status = 'scheduled' AND kickoff_at <= ? AND end_at > ?
      `).run(at, seasonId, at, at);

      const remaining = Number(this.db.prepare(`
        SELECT COUNT(*) AS count FROM fixtures WHERE season_id = ? AND status <> 'final'
      `).get(seasonId).count);
      const season = this.getSeason(seasonId);
      const status = remaining === 0 ? 'complete' : at >= season.startsAt ? 'active' : 'scheduled';
      this.db.prepare('UPDATE seasons SET status = ?, updated_at = ? WHERE id = ?').run(status, at, seasonId);
    });
    return finalized;
  }

  count(table, where = '', values = []) {
    const allowed = new Set(['fixtures', 'matches', 'events', 'snapshots', 'fixture_finalizations']);
    if (!allowed.has(table)) throw new TypeError('Unsupported count table.');
    return Number(this.db.prepare(`SELECT COUNT(*) AS count FROM ${table} ${where}`).get(...values).count);
  }
}
