import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
let checks = 0;

function check(condition, message, detail = '') {
  checks += 1;
  if (condition) return;
  failures.push(detail ? `${message}: ${detail}` : message);
}

async function exists(relativePath) {
  try {
    return (await stat(path.join(ROOT, relativePath))).isFile();
  } catch {
    return false;
  }
}

async function text(relativePath) {
  return readFile(path.join(ROOT, relativePath), 'utf8');
}

function evaluateBrowserScript(source, filename, window = {}) {
  const context = vm.createContext({
    window,
    URLSearchParams,
    Date,
    Math,
    Array,
    Object,
    String,
    Number,
    JSON,
    encodeURIComponent,
    decodeURIComponent,
    console
  });
  vm.runInContext(source, context, { filename, timeout: 2000 });
  return window;
}

const arenas = [
  { id: 'soccer', file: 'index.html', label: /SOCCER/i },
  { id: 'american-football', file: 'football.html', label: /GRIDIRON|AMERICAN FOOTBALL/i },
  { id: 'basketball', file: 'hoops.html', label: /HOOPS|BASKETBALL/i },
  { id: 'hockey', file: 'hockey.html', label: /HOCKEY|ICE/i },
  { id: 'baseball', file: 'baseball.html', label: /BASEBALL|DIAMOND/i },
  { id: 'combat', file: 'fight.html', label: /FIGHT|COMBAT|BOX/i }
];
const publicArenas = arenas.filter((arena) => arena.id !== 'combat');

let packageManifest;
try {
  packageManifest = JSON.parse(await text('package.json'));
  check(true, 'package.json parses');
} catch (error) {
  check(false, 'package.json is invalid JSON', error.message);
}
if (packageManifest) {
  check(packageManifest.scripts?.dev === 'node server.mjs', 'npm run dev must use the project-owned dependency-free server');
  check(packageManifest.scripts?.['test:api'] === 'node --test api/canonical-server.test.mjs', 'npm run test:api must cover the canonical API boundary');
  check(packageManifest.scripts?.verify === 'npm run test:api && npm run test:soccer && node --test socceridentity.test.mjs soccersim.test.mjs && node scripts/verify.mjs', 'npm run verify must cover APIs, soccer identity, soccer contracts, deterministic simulation, and static/data invariants');
  check(Object.keys(packageManifest.dependencies || {}).length === 0, 'Runtime dependencies must remain empty');
  check(Object.keys(packageManifest.devDependencies || {}).length === 0, 'Development dependencies must remain empty');
}

// Soccer-first public vertical slice. The retired multi-sport prototype remains in the
// repository as reference, but these are the only files allowed to define the root product.
for (const file of ['home.html', 'home.css', 'home.js', 'match.html', 'match.css', 'match.js', 'soccerclubs.js', 'athleterig.js']) {
  check(await exists(file), 'Missing soccer-first public artifact', file);
}
if (await exists('home.html') && await exists('home.js') && await exists('match.html') && await exists('match.js')) {
  const soccerHome = `${await text('home.html')}\n${await text('home.js')}`;
  const soccerMatch = `${await text('match.html')}\n${await text('match.js')}`;
  check(!/six playable sports|choose a sport|sports world/i.test(soccerHome), 'Soccer-first home still markets the retired multi-sport product');
  check(/match\.html\?/.test(soccerHome), 'Soccer-first home does not route into the live match');
  check(/window\.render_game_to_text\s*=/.test(soccerMatch), 'Soccer-first match is missing window.render_game_to_text');
  check(/window\.advanceTime\s*=/.test(soccerMatch), 'Soccer-first match is missing window.advanceTime');
  check(/PLAYER SKINS/i.test(soccerMatch) && /applySkin/.test(soccerMatch), 'Soccer-first match does not expose live cosmetic switching');
}
if (await exists('soccerclubs.js')) {
  const soccerWindow = evaluateBrowserScript(await text('soccerclubs.js'), 'soccerclubs.js');
  const soccer = soccerWindow.CyberligaSoccer;
  check(Boolean(soccer), 'soccerclubs.js did not expose CyberligaSoccer');
  if (soccer) {
    check(soccer.clubs?.length === 7, 'Soccer-first league must contain the seven approved clubs', String(soccer.clubs?.length));
    check(soccer.fixtures?.length === 21, 'Seven-club single round robin must contain 21 fixtures', String(soccer.fixtures?.length));
    check(soccer.clubs.every((club) => club.roster?.length === 7), 'Every soccer-first club must have seven athlete identities');
    const athleteIds = soccer.clubs.flatMap((club) => club.roster.map((athlete) => athlete.id));
    check(new Set(athleteIds).size === 49, 'Soccer-first athlete ids must be globally unique', String(new Set(athleteIds).size));
    for (const club of soccer.clubs) for (const variant of ['home', 'away', 'third']) {
      check(Boolean(soccer.createSkin(club.id, variant)?.jersey), `${club.id} is missing its ${variant} cosmetic loadout`);
    }
  }
}

for (const arena of arenas) {
  const present = await exists(arena.file);
  check(present, `Missing ${arena.id} arena`, arena.file);
  if (!present) continue;
  const source = await text(arena.file);
  check(arena.label.test(source), `${arena.file} does not identify its sport`);
  check(/(?:href\s*=\s*["']world\.html|location\.href\s*=\s*["']world\.html)/i.test(source), `${arena.file} has no route back to world.html`);
  check(/window\.render_game_to_text\s*=/.test(source), `${arena.file} is missing window.render_game_to_text`);
  check(/window\.advanceTime\s*=/.test(source), `${arena.file} is missing window.advanceTime`);
}

const supportingPages = [
  { file: 'world.html', screen: /screen\s*:\s*['"]world['"]/ },
  { file: 'league.html', scriptFile: 'league-page.js', screen: /screen\s*:\s*['"]league-hq['"]/ },
  { file: 'social.html', screen: /screen\s*:\s*['"](?:social|world-wire)['"]/ },
  { file: 'moment.html', screen: /screen\s*:\s*['"](?:moment|moment-maker)['"]/ },
  { file: 'clip.html', screen: /screen\s*:\s*['"]animated-clip-director['"]/ },
  { file: 'replay.html', scriptFile: 'replay.js', screen: /screen\s*:\s*['"]replay-center['"]/ },
  { file: 'player.html', scriptFile: 'player.js', screen: /screen\s*:\s*['"]athlete-profile['"]/ },
  { file: 'characterlab.html', scriptFile: 'characterlab.js', screen: /screen\s*:\s*['"]character-laboratory['"]/ },
  { file: 'ops.html', screen: /screen\s*:\s*['"](?:ops|operations-console)['"]/ }
];
for (const page of supportingPages) {
  const present = await exists(page.file);
  check(present, `Missing public supporting page`, page.file);
  if (!present) continue;
  const source = (await text(page.file)) + (page.scriptFile ? `\n${await text(page.scriptFile)}` : '');
  check(/window\.render_game_to_text\s*=/.test(source), `${page.file} is missing window.render_game_to_text`);
  check(/window\.advanceTime\s*=/.test(source), `${page.file} is missing window.advanceTime`);
  check(page.screen.test(source), `${page.file} render state does not identify its screen`);
}

check(await exists('appshell.css'), 'Missing shared application-shell styles');
check(await exists('appshell.js'), 'Missing shared application-shell behavior');
for (const page of supportingPages.filter((page) => page.file !== 'world.html')) {
  const source = await text(page.file);
  check(source.includes('appshell.css'), `${page.file} does not load the shared application-shell styles`);
  check(source.includes('appshell.js'), `${page.file} does not load the shared application-shell behavior`);
}
const appShellSource = await text('appshell.js');
for (const arena of publicArenas) {
  check(appShellSource.includes(arena.id) && appShellSource.includes(arena.file), `Application shell does not expose the ${arena.id} arena`);
}
check(!appShellSource.includes('fight.html') && !appShellSource.includes("id:'combat'"), 'Public application shell must keep Combat out of the five-sport rollout');
for (const route of ['world.html', 'league.html', 'social.html', 'replay.html', 'player.html', 'moment.html', 'clip.html']) {
  check(appShellSource.includes(route), `Application shell does not expose ${route}`);
}
check(!appShellSource.includes('menu.html') && !/label\s*:\s*['"]WATCH['"]/.test(appShellSource), 'Application shell must retire the standalone Watch destination');

const worldSource = await text('world.html');
const atlasSource = await text('league.html');
const atlasScript = await text('league-page.js');
const brandSource = await text('branddata.js');
const atlasBundle = `${atlasSource}\n${atlasScript}\n${brandSource}`;
const socialSource = await text('social.html');
const momentSource = await text('moment.html');
const clipSource = await text('clip.html');
const menuSource = await text('menu.html');
const replaySource = await text('replay.html');
const replayScript = await text('replay.js');
const playerSource = await text('player.html');
const playerScript = await text('player.js');
const footballSource = await text('football.html');
const footballScript = await text('football.js');
const baseballSource = await text('baseball.html');
const hockeySource = await text('hockey.html');
const fightSource = await text('fight.html');
check(/football\.html/.test(worldSource), 'World map does not route to American football');
check(/arena:\s*['"]football\.html['"]/.test(brandSource), 'League HQ does not route American football to football.html');
check(/id=["']standings-shell["']/.test(atlasSource) && /standings-table/.test(atlasScript), 'League HQ is missing its standings table');
check(/api\/league\?sport=/.test(atlasScript), 'League HQ does not load the shared league-state API');
check(/id=["']roster-filters["']/.test(atlasSource) && /data-roster-unit/.test(atlasScript), 'League HQ is missing football offense/defense roster filters');
check(/player\.html\?sport=/.test(atlasScript) && /social\.html\?sport=/.test(atlasScript), 'League HQ does not connect athletes to permanent profile and World Wire URLs');
check(/branddata\.js/.test(atlasSource) && /crestSvg/.test(atlasScript) && /kitSvg/.test(atlasScript) && /sceneSvg/.test(atlasScript), 'League HQ is missing the shared city/crest/uniform identity layer');
check(/publicWorld:\{sports:5,clubs:40,simultaneousGames:20,combatPublic:false\}/.test(atlasScript), 'League HQ state must expose the five-sport, 40-club, 20-channel public contract');
for (const arena of publicArenas) {
  check(worldSource.includes(arena.id), `World map does not expose ${arena.id}`);
  check(worldSource.includes(arena.file), `World map does not link the ${arena.id} arena`, arena.file);
  check(atlasBundle.includes(arena.file), `League HQ does not link the ${arena.id} arena`, arena.file);
}
check(!/contentId:\s*['"]combat['"]/.test(worldSource) && !worldSource.includes('fight.html'), 'World map must keep Combat out of the public five-sport rollout');
check(!brandSource.includes("combat: {") && !brandSource.includes("arena: 'fight.html'"), 'League HQ must keep Combat out of the public five-sport rollout');
for (const page of ['world.html', 'index.html', 'social.html', 'moment.html', 'clip.html']) {
  const source = await text(page);
  check(source.includes('presence.js'), `${page} does not load the shared spectator presence client`);
  check(source.includes('livebridge.js'), `${page} does not load the shared spectator live bridge`);
  check(source.includes('data-cyberliga-presence'), `${page} has no visible honest spectator status`);
}
check(socialSource.includes('ANIMATE CLIP'), 'World Wire does not expose animated clip creation');
check(momentSource.includes('clip.html?'), 'Moment Maker does not preserve its canonical state into Clip Director');
check(/canvas\.captureStream\(30\)/.test(clipSource), 'Clip Director must capture a real 30fps canvas stream');
check(/new MediaRecorder/.test(clipSource), 'Clip Director must use MediaRecorder for WebM output');
check(/DURATION\s*=\s*12000/.test(clipSource), 'Clip Director must keep the 12-second viral format');
check(/http-equiv=["']refresh["']/.test(menuSource) && /location\.replace\(destination\)/.test(menuSource) && /league\.html/.test(menuSource), 'Retired Broadcast Guide must remain a safe compatibility redirect to League HQ');
check(/U\.liveMatches/.test(replayScript) && /selectionURL/.test(replayScript), 'Replay Center must use shared UTC matches and permanent selection URLs');
check(/CANONICAL BOUNDARY/.test(replayScript) && /EXHIBITION BOUNDARY/.test(replayScript), 'Replay Center must label canonical and exhibition provenance');
check(/player\.html\?sport=/.test(replayScript), 'Replay Center does not hand highlights into Athlete Files');
check(/416/.test(playerScript) || (/C\.getSport/.test(playerScript) && /C\.getTeam/.test(playerScript) && /C\.getAthlete/.test(playerScript)), 'Athlete Files must resolve the shared world roster');
check(/player\.html\?/.test(playerScript) && /canonical/.test(playerScript), 'Athlete Files must expose permanent canonical profile URLs');
check(!/id=["']playPanel["']/.test(footballSource) && !/snap the ball/i.test(footballSource), 'Football must not expose the retired manual snap/play-call interface');
check(/type=["']importmap["']/.test(footballSource) && /\.\/vendor\/three\/three\.module\.js/.test(footballSource) && /src=["'](?:\.\/)?football\.js["']/.test(footballSource), 'Football must load the local Three.js-only broadcast');
check(/window\._footballTest\s*=/.test(footballScript) && /forceSituation[\s\S]*forcePlay[\s\S]*forceCatch[\s\S]*forceTackle[\s\S]*forceFieldGoal[\s\S]*finishPlay/.test(footballScript), 'Football must expose deterministic catch, tackle, kick, situation, and finish helpers');
check(/function choosePlay/.test(footballScript) && /PREPLAY_SECONDS/.test(footballScript) && /state\.phase === 'preplay'[\s\S]*startAutomaticPlay\(\)/.test(footballScript), 'Football must choose and start plays autonomously');
check(/mode: 'dead'[\s\S]*ownerId[\s\S]*intendedId/.test(footballScript) && /'pass'[\s\S]*'contested'[\s\S]*'loose'[\s\S]*'kick'[\s\S]*'punt'/.test(footballScript), 'Football must model authoritative possession and physical ball states');
check(/GOAL_PLANE/.test(footballScript) && /CROSSBAR_HEIGHT/.test(footballScript) && /UPRIGHT_HALF/.test(footballScript) && /ruleGoalPlaneCrossing/.test(footballScript) && /kick\.crossing/.test(footballScript), 'Football field-goal scoring must come from the visible goal-plane crossing');
check(/window\._baseballTest\s*=/.test(baseballSource) && /double_play|sac_fly/.test(baseballSource), 'Baseball must expose deterministic force-play branch helpers');
check(/id=["']pitchtrail["']/.test(baseballSource) && /pitchHistory/.test(baseballSource), 'Baseball must expose an accessible pitch sequence and structured pitch history');
check(/window\.__CYBERLIGA_HOCKEY_TEST__\s*=/.test(hockeySource) && /penalty[\s\S]*powerplay[\s\S]*overtime[\s\S]*final/.test(hockeySource), 'Hockey must expose penalty, power-play, overtime, and final branch helpers');
check(/window\._fightTest\s*=/.test(fightSource) && /forceDecision[\s\S]*forceStoppage/.test(fightSource), 'Combat must expose deterministic decision and stoppage branch helpers');
check(await exists('watchonly.js'), 'Missing shared watch-only arena policy');
for (const arena of arenas) {
  const arenaSource = await text(arena.file);
  check(arenaSource.includes('watchonly.js'), `${arena.file} does not load the shared watch-only arena policy`);
  check(!arenaSource.includes('gamehub.js'), `${arena.file} still loads interactive in-game navigation`);
}
const characterLabSource = await text('characterlab.html');
const characterLabScript = await text('characterlab.js');
check(/Marquee 12/i.test(characterLabSource), 'Character Lab must expose the first twelve marquee athletes');
check(/window\.render_game_to_text\s*=/.test(characterLabScript), 'Character Lab is missing window.render_game_to_text');
check(/window\.advanceTime\s*=/.test(characterLabScript), 'Character Lab is missing window.advanceTime');
check(/view.*match[\s\S]*portrait[\s\S]*clip/i.test(characterLabScript), 'Character Lab must cover match, portrait, and clip contexts');
check(await exists('presence.js'), 'Missing shared presence client');
check(await exists('livebridge.js'), 'Missing shared live bridge');
const presenceSource = await text('presence.js');
check(/secret-key-refused/.test(presenceSource), 'Presence client must explicitly refuse secret keys');
check(/sb_publishable_/.test(presenceSource), 'Presence client must require a browser-safe publishable key');
check(/match:/.test(presenceSource), 'Presence client must scope channels to a match topic');

const backendFiles = [
  'api/config.js',
  'api/live.js',
  'api/league.js',
  'api/tick.js',
  'api/canonical-server.test.mjs',
  'lib/canonical-server.js',
  'supabase/migrations/20260710175340_canonical_league_backend.sql'
];
for (const file of backendFiles) check(await exists(file), 'Missing canonical backend artifact', file);
const serverSource = await text('server.mjs');
for (const endpoint of ['/api/config', '/api/live', '/api/league', '/api/tick']) {
  check(serverSource.includes(`['${endpoint}'`), `Project dev server does not dispatch ${endpoint}`);
}
const migrationSource = await text('supabase/migrations/20260710175340_canonical_league_backend.sql');
for (const table of ['seasons', 'teams', 'season_teams', 'athletes', 'fixtures', 'matches', 'match_events', 'standings', 'media_records', 'presence_aggregates', 'heartbeat_aggregates']) {
  check(migrationSource.includes(`create table public.${table}`), `Canonical migration is missing public.${table}`);
  check(migrationSource.includes(`alter table public.${table} enable row level security`), `RLS is not enabled on public.${table}`);
}
check(/security definer\s+set search_path = ''/i.test(migrationSource), 'Canonical tick must pin an empty search_path under SECURITY DEFINER');
check(/grant execute on function public\.canonical_apply_tick[\s\S]*to service_role/i.test(migrationSource), 'Canonical tick execute grant must be service-role only');
check(!/grant\s+(?:insert|update|delete)[^;]*to\s+(?:anon|authenticated)/i.test(migrationSource), 'Public roles must never receive canonical write grants');
check(/standings_applied_at is null/.test(migrationSource), 'Canonical finalization needs a one-time standings guard');
check(/pg_advisory_xact_lock/.test(migrationSource), 'Canonical tick needs a fixture-scoped transaction lock');

const contentWindow = evaluateBrowserScript(await text('worlddata.js'), 'worlddata.js');
const content = contentWindow.CYBERLIGA_CONTENT;
check(Boolean(content), 'worlddata.js did not expose CYBERLIGA_CONTENT');
if (content) {
  check(content.metrics?.sports === 6, 'Worlddata sport total must be 6', String(content.metrics?.sports));
  check(content.metrics?.teams === 48, 'Worlddata team total must be 48', String(content.metrics?.teams));
  check(content.metrics?.athletes === 416, 'Worlddata athlete total must be 416', String(content.metrics?.athletes));
  check(Array.isArray(content.sports) && content.sports.length === 6, 'Worlddata must expose exactly six sports');

  const sportIds = new Set();
  const teamIds = new Set();
  const athleteIds = new Set();
  for (const sport of content.sports || []) {
    check(!sportIds.has(sport.id), 'Duplicate sport id', sport.id);
    sportIds.add(sport.id);
    check(sport.teams.length === 8, `${sport.id} must have eight teams`, String(sport.teams.length));
    const localCodes = new Set();
    for (const team of sport.teams) {
      check(!teamIds.has(team.id), 'Duplicate team id', team.id);
      teamIds.add(team.id);
      check(!localCodes.has(team.code), `Duplicate team code in ${sport.id}`, team.code);
      localCodes.add(team.code);
      const expectedAthletes = sport.id === 'american-football' ? 22 : 6;
      check(team.athletes.length === expectedAthletes, `${team.id} must have ${expectedAthletes} athletes`, String(team.athletes.length));
      check(sport.teams.some((candidate) => candidate.id === team.rivalryId), `${team.id} rivalry does not resolve`, String(team.rivalryId));
      for (const athlete of team.athletes) {
        check(!athleteIds.has(athlete.id), 'Duplicate athlete id', athlete.id);
        athleteIds.add(athlete.id);
      }
    }
    const season = content.createSeason(sport.id, 'verify-season');
    check(season?.rounds?.length === 14, `${sport.id} season must have 14 rounds`, String(season?.rounds?.length));
    check(season?.rounds?.every((round) => round.matches.length === 4), `${sport.id} rounds must contain four matches`);
  }
  check(sportIds.has('american-football'), 'Worlddata is missing American football');
  check(teamIds.size === 48, 'Worlddata must have 48 unique team ids', String(teamIds.size));
  check(athleteIds.size === 416, 'Worlddata must have 416 unique athlete ids', String(athleteIds.size));
}

evaluateBrowserScript(await text('branddata.js'), 'branddata.js', contentWindow);
const branding = contentWindow.CyberligaBrand;
check(Boolean(branding), 'branddata.js did not expose CyberligaBrand');
if (branding && content) {
  const publicSports = branding.getPublicSports(content);
  const publicTeams = publicSports.flatMap((sport) => sport.teams);
  check(publicSports.length === 5, 'Public world must expose exactly five leagues', String(publicSports.length));
  check(publicTeams.length === 40, 'Public world must expose exactly 40 clubs', String(publicTeams.length));
  check(!publicSports.some((sport) => sport.id === 'combat'), 'Combat must stay outside the public league identity rollout');
  check(Object.keys(branding.teams || {}).length === 40, 'Brand manifest must define all 40 public clubs', String(Object.keys(branding.teams || {}).length));
  for (const sport of publicSports) {
    const leagueBrand = branding.getLeague(sport.id);
    check(Boolean(leagueBrand?.hero), `${sport.id} is missing its generated league venue plate`);
    if (leagueBrand?.hero) check(await exists(leagueBrand.hero), `${sport.id} generated league venue plate is missing`, leagueBrand.hero);
    check(Boolean(leagueBrand?.arena), `${sport.id} is missing its arena route`);
  }
  for (const team of publicTeams) {
    const identity = branding.getTeam(team.id);
    check(Boolean(identity?.venue && identity?.ritual && identity?.statement), `${team.id} is missing venue, crowd, or identity copy`);
    check(/<svg/.test(branding.crestSvg(team)) && branding.crestSvg(team).includes(team.code), `${team.id} crest SVG is invalid`);
    for (const variant of ['home', 'away', 'night']) {
      check(/<svg/.test(branding.kitSvg(team, variant)), `${team.id} ${variant} uniform SVG is invalid`);
    }
    check(/<svg/.test(branding.sceneSvg(team)) && branding.sceneSvg(team).includes(identity.venue), `${team.id} city/venue scene SVG is invalid`);
  }
}

const universeWindow = {};
evaluateBrowserScript(await text('worlddata.js'), 'worlddata.js', universeWindow);
evaluateBrowserScript(await text('universe.js'), 'universe.js', universeWindow);
const universe = universeWindow.CyberligaUniverse;
check(Boolean(universe), 'universe.js did not expose CyberligaUniverse');
if (universe) {
  check(universe.TEAMS.length === 8, 'Canonical soccer universe must have eight teams', String(universe.TEAMS.length));
  check(universe.ROUNDS.length === 14, 'Canonical soccer universe must have 14 rounds', String(universe.ROUNDS.length));
  check(universe.ROUNDS.every((round) => round.length === 4), 'Every canonical round must have four live channels');
  for (const [index, round] of universe.ROUNDS.entries()) {
    const participants = round.flat();
    check(new Set(participants).size === 8, `Canonical round ${index + 1} must schedule every team exactly once`);
  }
  const live = universe.liveMatches(Date.UTC(2026, 6, 10, 0, 1, 0));
  check(live.length === 4, 'Canonical liveMatches must expose four channels', String(live.length));
  check(new Set(live.map((match) => match.id)).size === 4, 'Canonical live channel ids must be unique');
  check(live.every((match, index) => match.channel === index), 'Canonical live channel numbers must be stable and contiguous');
}

let vercel;
try {
  vercel = JSON.parse(await text('vercel.json'));
  check(true, 'vercel.json parses');
} catch (error) {
  check(false, 'vercel.json is invalid JSON', error.message);
}
if (vercel) {
  const rootRedirects = (vercel.redirects || []).filter((redirect) => redirect.source === '/');
  check(rootRedirects.length === 1, 'vercel.json must define exactly one root redirect', String(rootRedirects.length));
  check(rootRedirects[0]?.destination === '/world.html', 'Vercel root redirect must target the five-sport world', String(rootRedirects[0]?.destination));
  check(rootRedirects[0]?.permanent === false, 'Vercel root redirect should remain temporary during iteration');
  if (rootRedirects[0]?.destination) {
    check(await exists(rootRedirects[0].destination.replace(/^\//, '')), 'Vercel root redirect target does not exist', rootRedirects[0].destination);
  }
}

function localReference(raw) {
  const value = raw.trim();
  if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value)) return null;
  if (/^(?:application|audio|font|image|model|text|video)\//i.test(value)) return null;
  const clean = value.split(/[?#]/, 1)[0];
  if (!clean || clean.includes('${') || clean.includes('`')) return null;
  if (!/\.(?:html?|css|js|mjs|json|png|jpe?g|gif|webp|avif|svg|ico|glb|gltf|woff2?|ttf|otf|mp3|wav|ogg|mp4|webm|wasm)$/i.test(clean)) return null;
  return clean.replace(/^\//, '');
}

async function collectFiles(directory = ROOT) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    // Third-party source may contain documentation snippets such as
    // `assets/models/model.gltf`; only app-owned files belong in our dangling-
    // asset scan.
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.playwright-cli' || entry.name === 'output' || entry.name === 'vendor') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await collectFiles(absolute));
    else if (entry.isFile()) found.push(absolute);
  }
  return found;
}

const projectFiles = await collectFiles();
const inspectable = projectFiles.filter((file) => /\.(?:html|css|js|mjs)$/i.test(file));
const referencePatterns = [
  /(?:src|href)\s*=\s*["']([^"']+)["']/gi,
  /url\(\s*["']?([^"')]+)["']?\s*\)/gi,
  /["']([^"']+\.(?:png|jpe?g|gif|webp|avif|svg|ico|glb|gltf|woff2?|ttf|otf|mp3|wav|ogg|mp4|webm|wasm))["']/gi
];
const seenReferences = new Set();
for (const file of inspectable) {
  const source = await readFile(file, 'utf8');
  for (const pattern of referencePatterns) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const reference = localReference(match[1]);
      if (!reference) continue;
      const resolved = match[1].startsWith('/')
        ? path.join(ROOT, reference)
        : path.resolve(path.dirname(file), reference);
      const key = `${path.relative(ROOT, file)} -> ${path.relative(ROOT, resolved)}`;
      if (seenReferences.has(key)) continue;
      seenReferences.add(key);
      check(await exists(path.relative(ROOT, resolved)), 'Dangling local asset or route reference', key);
    }
  }
}

if (failures.length) {
  console.error(`\nCyberliga verification FAILED (${failures.length} of ${checks} checks)\n`);
  failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Cyberliga verification passed: ${checks} checks across 6 preserved arenas, 5 public leagues, 40 branded city clubs, 20 live channels, 368 public athletes, routes, schedules, hooks, deployment config, and local assets.`);
}
