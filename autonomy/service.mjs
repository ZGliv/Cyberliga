import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LeagueStore, scoreFromResult } from './store.mjs';

const SIX_MINUTES = 6 * 60 * 1000;
const FORTY_FIVE_SECONDS = 45 * 1000;
const FIVE_SECONDS = 5 * 1000;
const API_VERSION = 1;
const BROADCAST_EVENT_TYPES = new Set([
  'kickoff', 'shot', 'save', 'goal', 'foul', 'yellow', 'red', 'halftime', 'fulltime',
]);

const CONTENT_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.mp3', 'audio/mpeg'],
  ['.mp4', 'video/mp4'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : fallback;
}

function stableSeed(value) {
  const digest = createHash('sha256').update(value).digest();
  return digest.readUInt32LE(0) || 1;
}

function stableFixtureId(seasonId, fixtureKey) {
  const digest = createHash('sha256').update(`${seasonId}:${fixtureKey}`).digest('hex').slice(0, 16);
  return `${seasonId}-fx-${digest}`;
}

function rotateRoundRobin(teams) {
  return [teams[0], teams.at(-1), ...teams.slice(1, -1)];
}

export function generateRoundRobin(clubIds, { doubleRoundRobin = true } = {}) {
  if (!Array.isArray(clubIds) || clubIds.length < 2) {
    throw new TypeError('A league schedule needs at least two city clubs.');
  }
  const uniqueIds = [...new Set(clubIds)];
  if (uniqueIds.length !== clubIds.length) throw new TypeError('Club ids must be unique.');

  let rotation = [...uniqueIds];
  if (rotation.length % 2) rotation.push(null);
  const half = rotation.length / 2;
  const firstLeg = [];

  for (let roundIndex = 0; roundIndex < rotation.length - 1; roundIndex += 1) {
    const matches = [];
    for (let index = 0; index < half; index += 1) {
      let home = rotation[index];
      let away = rotation[rotation.length - 1 - index];
      if (home == null || away == null) continue;
      if ((roundIndex + index) % 2 === 1) [home, away] = [away, home];
      matches.push({ homeClubId: home, awayClubId: away });
    }
    firstLeg.push(matches);
    rotation = rotateRoundRobin(rotation);
  }

  if (!doubleRoundRobin) return firstLeg;
  return [
    ...firstLeg,
    ...firstLeg.map(matches => matches.map(({ homeClubId, awayClubId }) => ({
      homeClubId: awayClubId,
      awayClubId: homeClubId,
    }))),
  ];
}

function extractElapsedMs(item, index, count, durationMs) {
  const direct = [item?.elapsedMs, item?.at, item?.timeMs, item?.matchTimeMs, item?.clockMs, item?.t]
    .find(value => Number.isFinite(Number(value)));
  if (direct != null) return Math.min(durationMs, Math.max(0, Math.trunc(Number(direct))));
  if (Number.isFinite(Number(item?.minute))) {
    return Math.min(durationMs, Math.max(0, Math.round((Number(item.minute) / 90) * durationMs)));
  }
  return count <= 1 ? 0 : Math.round((index / (count - 1)) * durationMs);
}

function normalizeTimeline(items, durationMs, kind) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => ({
    ...item,
    elapsedMs: extractElapsedMs(item, index, items.length, durationMs),
    ...(kind === 'event' && !item?.type && !item?.kind ? { type: 'event' } : {}),
  }));
}

function parseAt(value, fallback) {
  if (value == null || value === '') return fallback;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return Math.trunc(numeric);
  }
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) return parsed;
  throw Object.assign(new TypeError('The at parameter must be an epoch-millisecond value or ISO-8601 timestamp.'), { statusCode: 400 });
}

function json(response, statusCode, body, requestMethod = 'GET') {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    'access-control-allow-origin': '*',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
    'content-type': 'application/json; charset=utf-8',
  });
  if (requestMethod === 'HEAD') response.end();
  else response.end(payload);
}

function publicError(error) {
  return {
    error: error?.statusCode === 404 ? 'not_found' : error?.statusCode === 400 ? 'bad_request' : 'internal_error',
    message: error?.statusCode && error.statusCode < 500 ? error.message : 'The autonomous league service could not complete this request.',
  };
}

function explicitScore(value) {
  const score = value?.score ?? value?.finalScore;
  if (score && Number.isFinite(Number(score.home)) && Number.isFinite(Number(score.away))) {
    return { home: Number(score.home), away: Number(score.away) };
  }
  const home = value?.homeScore ?? value?.scoreHome;
  const away = value?.awayScore ?? value?.scoreAway;
  if (Number.isFinite(Number(home)) && Number.isFinite(Number(away))) {
    return { home: Number(home), away: Number(away) };
  }
  return null;
}

function deriveScore(match, timeline, phase) {
  if (phase === 'final') return scoreFromResult(match.result);
  let score = explicitScore(timeline.snapshot?.state) ?? { home: 0, away: 0 };
  let snapshotHadScore = explicitScore(timeline.snapshot?.state) != null;
  const source = snapshotHadScore ? timeline.eventsSinceSnapshot : timeline.eventsThrough;

  for (const event of source) {
    const data = event.data ?? {};
    const stated = explicitScore(data) ?? explicitScore(event);
    if (stated) {
      score = stated;
      snapshotHadScore = true;
      continue;
    }
    const type = String(event.type ?? data.type ?? '').toLowerCase();
    if (!type.includes('goal') || type.includes('disallow')) continue;
    const side = String(data.side ?? data.teamSide ?? '').toLowerCase();
    const teamId = data.teamId ?? data.clubId ?? data.team?.id;
    if (side === 'home' || teamId === match.homeClubId) score = { ...score, home: score.home + 1 };
    else if (side === 'away' || teamId === match.awayClubId) score = { ...score, away: score.away + 1 };
  }
  return score;
}

function publicFixture(fixture, at) {
  const { result, stats, ...safe } = fixture;
  if (at >= fixture.endAt) return { ...safe, result, stats };
  return safe;
}

export function createStaticFileHandler(rootDirectory) {
  const root = resolve(rootDirectory);
  return async function serveStatic(request, response, url) {
    if (!['GET', 'HEAD'].includes(request.method ?? 'GET')) return false;
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { return false; }
    if (pathname === '/') pathname = '/live.html';
    else if (pathname.endsWith('/')) pathname += 'index.html';
    const filename = resolve(root, `.${pathname}`);
    const traversal = relative(root, filename);
    if (traversal.startsWith(`..${sep}`) || traversal === '..') return false;

    let details;
    try { details = await stat(filename); } catch { return false; }
    if (!details.isFile()) return false;
    response.writeHead(200, {
      'cache-control': extname(filename) === '.html' ? 'no-cache' : 'public, max-age=3600',
      'content-length': details.size,
      'content-type': CONTENT_TYPES.get(extname(filename).toLowerCase()) ?? 'application/octet-stream',
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(filename).pipe(response);
    return true;
  };
}

export class AutonomousLeagueService {
  constructor(options = {}) {
    this.options = options;
    this.now = options.now ?? Date.now;
    this.store = options.store ?? new LeagueStore(options.dbPath ?? ':memory:');
    this.ownsStore = !options.store;
    this.simulateMatch = options.simulateMatch;
    this.clubs = options.clubs;
    this.staticHandler = options.staticHandler;
    this.seasonId = options.seasonId ?? process.env.CYBERLIGA_SEASON_ID ?? 'global-city-league-1';
    this.seasonSlug = options.seasonSlug ?? this.seasonId;
    this.seasonName = options.seasonName ?? 'Cyberliga City League';
    this.doubleRoundRobin = options.doubleRoundRobin ?? true;
    this.matchDurationMs = positiveInteger(
      options.matchDurationMs ?? process.env.CYBERLIGA_MATCH_DURATION_MS,
      SIX_MINUTES,
    );
    this.interRoundGapMs = positiveInteger(
      options.interRoundGapMs ?? process.env.CYBERLIGA_INTER_ROUND_GAP_MS,
      FORTY_FIVE_SECONDS,
    );
    this.roundIntervalMs = positiveInteger(options.roundIntervalMs, this.matchDurationMs + this.interRoundGapMs);
    this.simulationHorizonMs = positiveInteger(
      options.simulationHorizonMs ?? process.env.CYBERLIGA_SIMULATION_HORIZON_MS,
      this.roundIntervalMs * 2,
    );
    this.fixtureStaggerMs = Math.max(0, Number(options.fixtureStaggerMs ?? 0));
    this.snapshotPersistenceIntervalMs = positiveInteger(
      options.snapshotPersistenceIntervalMs ?? process.env.CYBERLIGA_SNAPSHOT_INTERVAL_MS,
      FIVE_SECONDS,
    );
    this.retainAllEvents = options.retainAllEvents ?? process.env.CYBERLIGA_RETAIN_ALL_EVENTS === '1';
    this.seasonStartAt = options.seasonStartAt ?? (Number(process.env.CYBERLIGA_SEASON_START_AT) || null);
    this.schedulerIntervalMs = positiveInteger(options.schedulerIntervalMs, 1000);
    this.scheduler = null;
    this.simulationPromise = null;
    this.server = null;
    this.initialized = false;
  }

  async loadDependencies() {
    if (!this.clubs) {
      const module = await import('./clubs.mjs');
      this.clubs = module.CLUBS ?? module.default;
    }
    if (!this.simulateMatch) {
      const module = await import('./sim.mjs');
      this.simulateMatch = module.simulateMatch ?? module.default;
    }
    if (!Array.isArray(this.clubs) || this.clubs.length < 2) {
      throw new TypeError('Pass at least two city clubs through the clubs option or export CLUBS from clubs.mjs.');
    }
    if (typeof this.simulateMatch !== 'function') {
      throw new TypeError('Pass simulateMatch(config) or export it from sim.mjs.');
    }
  }

  async init({ startScheduler = this.options.startScheduler ?? true } = {}) {
    if (this.initialized) return this;
    await this.loadDependencies();
    const at = this.now();
    const clubs = this.store.upsertClubs(this.clubs, at);
    const requestedStart = this.seasonStartAt != null && Number.isFinite(Number(this.seasonStartAt))
      ? Number(this.seasonStartAt)
      : at;
    const season = this.store.ensureSeason({
      id: this.seasonId,
      slug: this.seasonSlug,
      name: this.seasonName,
      startsAt: requestedStart,
      format: this.doubleRoundRobin ? 'double-round-robin' : 'single-round-robin',
      clubs,
      at,
    });
    const seasonClubs = this.store.getSeasonClubs(this.seasonId);
    const rounds = generateRoundRobin(seasonClubs.map(club => club.id), {
      doubleRoundRobin: season.format === 'double-round-robin',
    });
    const fixtures = rounds.flatMap((matches, roundIndex) => matches.map((match, slot) => {
      const round = roundIndex + 1;
      const fixtureKey = `${round}:${match.homeClubId}:${match.awayClubId}`;
      const kickoffAt = season.startsAt + roundIndex * this.roundIntervalMs + slot * this.fixtureStaggerMs;
      return {
        id: stableFixtureId(this.seasonId, fixtureKey),
        seasonId: this.seasonId,
        fixtureKey,
        round,
        slot,
        ...match,
        kickoffAt,
        endAt: kickoffAt + this.matchDurationMs,
        seed: stableSeed(`${this.seasonId}:${fixtureKey}`),
      };
    }));
    this.store.insertFixtures(fixtures, at);

    this.clubsById = new Map(seasonClubs.map(club => [club.id, club]));
    await this.ensureSimulationHorizon(at);

    this.initialized = true;
    this.tick();
    if (startScheduler) this.startScheduler();
    return this;
  }

  async ensureSimulationHorizon(at = this.now()) {
    const cutoff = at + this.simulationHorizonMs;
    const missing = this.store.listFixturesMissingMatches(this.seasonId)
      .filter(fixture => fixture.kickoffAt <= cutoff);
    for (const fixture of missing) {
      const homeClub = this.clubsById.get(fixture.homeClubId) ?? fixture.home;
      const awayClub = this.clubsById.get(fixture.awayClubId) ?? fixture.away;
      const config = {
        matchId: fixture.id,
        id: fixture.id,
        fixtureId: fixture.id,
        seasonId: fixture.seasonId,
        round: fixture.round,
        kickoffAt: fixture.kickoffAt,
        seed: fixture.seed,
        durationMs: this.matchDurationMs,
        home: homeClub,
        away: awayClub,
        homeClub,
        awayClub,
      };
      const simulation = await this.simulateMatch(config);
      if (!simulation || typeof simulation !== 'object') {
        throw new TypeError(`simulateMatch returned no result for fixture ${fixture.id}.`);
      }
      const durationMs = positiveInteger(simulation.durationMs, this.matchDurationMs);
      const completeEvents = normalizeTimeline(simulation.events, durationMs, 'event');
      const events = this.retainAllEvents
        ? completeEvents
        : completeEvents.filter(event => BROADCAST_EVENT_TYPES.has(String(event.type ?? event.kind).toLowerCase()));
      const completeSnapshots = normalizeTimeline(simulation.snapshots, durationMs, 'snapshot');
      const snapshots = completeSnapshots.filter((snapshot, index) => (
        index === 0
        || index === completeSnapshots.length - 1
        || snapshot.elapsedMs % this.snapshotPersistenceIntervalMs === 0
      ));
      this.store.saveMatch({
        id: fixture.id,
        fixtureId: fixture.id,
        durationMs,
        simulatedAt: this.now(),
        result: simulation.result ?? {},
        stats: simulation.stats ?? {},
        events,
        snapshots,
      });
    }
    return missing.length;
  }

  tick(at = this.now()) {
    return this.store.reconcileClock(this.seasonId, at);
  }

  startScheduler() {
    if (this.scheduler) return;
    this.scheduler = setInterval(async () => {
      try {
        if (!this.simulationPromise) {
          this.simulationPromise = this.ensureSimulationHorizon().finally(() => { this.simulationPromise = null; });
        }
        await this.simulationPromise;
        this.tick();
      } catch (error) { this.options.onError?.(error); }
    }, this.schedulerIntervalMs);
    this.scheduler.unref?.();
  }

  stopScheduler() {
    if (this.scheduler) clearInterval(this.scheduler);
    this.scheduler = null;
  }

  getMatchState(id, at = this.now()) {
    const match = this.store.getMatch(id);
    if (!match) throw Object.assign(new Error(`No match exists with id ${id}.`), { statusCode: 404 });
    const durationMs = match.durationMs;
    const elapsedMs = Math.max(0, Math.min(durationMs, at - match.kickoffAt));
    const phase = at < match.kickoffAt ? 'scheduled' : at >= match.endAt ? 'final' : 'live';
    const timeline = this.store.getTimelineWindow(match.matchId, elapsedMs);
    const score = deriveScore(match, timeline, phase);
    const progress = durationMs ? elapsedMs / durationMs : 0;
    const responseTimeline = { ...timeline };
    delete responseTimeline.eventsThrough;

    return {
      apiVersion: API_VERSION,
      serverTime: at,
      phase,
      elapsedMs,
      durationMs,
      progress,
      matchClockMs: Math.round(progress * 90 * 60 * 1000),
      minute: Math.min(90, Math.floor(progress * 90)),
      score,
      match: {
        id: match.matchId,
        fixtureId: match.id,
        seasonId: match.seasonId,
        round: match.round,
        kickoffAt: match.kickoffAt,
        endAt: match.endAt,
        home: match.home,
        away: match.away,
        ...(phase === 'final' ? { result: match.result, stats: match.stats } : {}),
      },
      ...responseTimeline,
    };
  }

  getLeague(at = this.now()) {
    const season = this.store.getSeason(this.seasonId);
    const fixtures = this.store.listFixtures({ seasonId: this.seasonId });
    const live = fixtures.filter(fixture => fixture.kickoffAt <= at && fixture.endAt > at);
    const next = fixtures.find(fixture => fixture.kickoffAt > at) ?? null;
    return {
      apiVersion: API_VERSION,
      serverTime: at,
      season,
      clubs: this.store.getSeasonClubs(this.seasonId),
      schedule: {
        fixtureCount: fixtures.length,
        completedCount: fixtures.filter(fixture => fixture.endAt <= at).length,
        liveCount: live.length,
        nextKickoffAt: next?.kickoffAt ?? null,
        matchDurationMs: this.matchDurationMs,
        interRoundGapMs: this.interRoundGapMs,
      },
    };
  }

  async handle(request, response) {
    const requestMethod = request.method ?? 'GET';
    if (requestMethod === 'OPTIONS') {
      response.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, HEAD, OPTIONS',
        'access-control-allow-headers': 'content-type',
      });
      response.end();
      return;
    }

    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    try {
      if (url.pathname.startsWith('/api/') && !['GET', 'HEAD'].includes(requestMethod)) {
        json(response, 405, { error: 'method_not_allowed', message: 'The league API is read-only.' }, requestMethod);
        return;
      }
      if (url.pathname === '/api/league') {
        this.tick();
        json(response, 200, this.getLeague(), requestMethod);
        return;
      }
      if (url.pathname === '/api/live') {
        const at = this.now();
        this.tick(at);
        const matches = this.store.listLiveFixtures(at, this.seasonId)
          .map(fixture => this.getMatchState(fixture.matchId, at));
        const nextFixture = this.store.listFixtures({ seasonId: this.seasonId })
          .find(fixture => fixture.kickoffAt > at) ?? null;
        const next = nextFixture ? publicFixture(nextFixture, at) : null;
        json(response, 200, { apiVersion: API_VERSION, serverTime: at, matches, next }, requestMethod);
        return;
      }
      if (url.pathname === '/api/fixtures') {
        this.tick();
        const fixtures = this.store.listFixtures({
          seasonId: this.seasonId,
          status: url.searchParams.get('status') || undefined,
          clubId: url.searchParams.get('club') || undefined,
        }).map(fixture => publicFixture(fixture, this.now()));
        json(response, 200, { apiVersion: API_VERSION, fixtures }, requestMethod);
        return;
      }
      if (url.pathname === '/api/standings') {
        this.tick();
        json(response, 200, {
          apiVersion: API_VERSION,
          season: this.store.getSeason(this.seasonId),
          standings: this.store.getStandings(this.seasonId),
        }, requestMethod);
        return;
      }

      const stateMatch = url.pathname.match(/^\/api\/matches\/([^/]+)\/state$/);
      if (stateMatch) {
        const id = decodeURIComponent(stateMatch[1]);
        const at = parseAt(url.searchParams.get('at'), this.now());
        json(response, 200, this.getMatchState(id, at), requestMethod);
        return;
      }
      const matchRoute = url.pathname.match(/^\/api\/matches\/([^/]+)$/);
      if (matchRoute) {
        const id = decodeURIComponent(matchRoute[1]);
        const match = this.store.getMatch(id);
        if (!match) throw Object.assign(new Error(`No match exists with id ${id}.`), { statusCode: 404 });
        json(response, 200, { apiVersion: API_VERSION, match: publicFixture(match, this.now()) }, requestMethod);
        return;
      }
      if (url.pathname === '/api/health') {
        json(response, 200, { ok: true, apiVersion: API_VERSION, serverTime: this.now() }, requestMethod);
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        throw Object.assign(new Error('No API route exists at this path.'), { statusCode: 404 });
      }

      if (this.staticHandler && await this.staticHandler(request, response, url)) return;
      json(response, 404, { error: 'not_found', message: 'No file or API route exists at this path.' }, requestMethod);
    } catch (error) {
      const statusCode = error?.statusCode ?? 500;
      this.options.onError?.(error);
      if (!response.headersSent) json(response, statusCode, publicError(error), requestMethod);
      else response.destroy(error);
    }
  }

  async listen(port = 4173, host = '127.0.0.1') {
    if (!this.initialized) await this.init();
    if (this.server) return this.server.address();
    this.server = createServer((request, response) => {
      this.handle(request, response).catch(error => {
        this.options.onError?.(error);
        if (!response.headersSent) json(response, 500, publicError(error));
        else response.destroy(error);
      });
    });
    await new Promise((resolvePromise, reject) => {
      this.server.once('error', reject);
      this.server.listen(port, host, resolvePromise);
    });
    return this.server.address();
  }

  async close() {
    this.stopScheduler();
    if (this.simulationPromise) await this.simulationPromise;
    if (this.server) {
      const server = this.server;
      this.server = null;
      await new Promise((resolvePromise, reject) => server.close(error => error ? reject(error) : resolvePromise()));
    }
    if (this.ownsStore) this.store.close();
  }
}

export function createLeagueService(options = {}) {
  return new AutonomousLeagueService(options);
}

const moduleFilename = fileURLToPath(import.meta.url);
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const directory = dirname(moduleFilename);
  const service = createLeagueService({
    dbPath: process.env.CYBERLIGA_DB ?? resolve(directory, 'cyberliga.sqlite'),
    staticHandler: createStaticFileHandler(resolve(directory, '..')),
    onError(error) { console.error(error); },
  });
  const port = positiveInteger(process.env.PORT ?? process.env.CYBERLIGA_PORT, 4173);
  const host = process.env.HOST ?? '127.0.0.1';
  await service.init();
  const address = await service.listen(port, host);
  console.log(`Cyberliga autonomous league listening on http://${address.address}:${address.port}`);

  const shutdown = async () => {
    await service.close();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
