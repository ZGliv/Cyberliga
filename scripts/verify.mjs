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

let packageManifest;
try {
  packageManifest = JSON.parse(await text('package.json'));
  check(true, 'package.json parses');
} catch (error) {
  check(false, 'package.json is invalid JSON', error.message);
}
if (packageManifest) {
  check(packageManifest.scripts?.dev === 'node server.mjs', 'npm run dev must use the project-owned dependency-free server');
  check(packageManifest.scripts?.verify === 'node scripts/verify.mjs', 'npm run verify must use the project-owned invariant checker');
  check(Object.keys(packageManifest.dependencies || {}).length === 0, 'Runtime dependencies must remain empty');
  check(Object.keys(packageManifest.devDependencies || {}).length === 0, 'Development dependencies must remain empty');
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
  { file: 'league.html', screen: /screen\s*:\s*['"]league-atlas['"]/ },
  { file: 'social.html', screen: /screen\s*:\s*['"](?:social|world-wire)['"]/ },
  { file: 'moment.html', screen: /screen\s*:\s*['"](?:moment|moment-maker)['"]/ },
  { file: 'ops.html', screen: /screen\s*:\s*['"](?:ops|operations-console)['"]/ }
];
for (const page of supportingPages) {
  const present = await exists(page.file);
  check(present, `Missing public supporting page`, page.file);
  if (!present) continue;
  const source = await text(page.file);
  check(/window\.render_game_to_text\s*=/.test(source), `${page.file} is missing window.render_game_to_text`);
  check(/window\.advanceTime\s*=/.test(source), `${page.file} is missing window.advanceTime`);
  check(page.screen.test(source), `${page.file} render state does not identify its screen`);
}

const worldSource = await text('world.html');
const atlasSource = await text('league.html');
check(/football\.html/.test(worldSource), 'World map does not route to American football');
check(/['"]american-football['"]\s*:\s*['"]football\.html['"]/.test(atlasSource), 'League atlas does not route American football to football.html');
for (const arena of arenas) {
  check(worldSource.includes(arena.id), `World map does not expose ${arena.id}`);
  check(worldSource.includes(arena.file), `World map does not link the ${arena.id} arena`, arena.file);
  check(atlasSource.includes(arena.file), `League atlas does not link the ${arena.id} arena`, arena.file);
}

const contentWindow = evaluateBrowserScript(await text('worlddata.js'), 'worlddata.js');
const content = contentWindow.CYBERLIGA_CONTENT;
check(Boolean(content), 'worlddata.js did not expose CYBERLIGA_CONTENT');
if (content) {
  check(content.metrics?.sports === 6, 'Worlddata sport total must be 6', String(content.metrics?.sports));
  check(content.metrics?.teams === 48, 'Worlddata team total must be 48', String(content.metrics?.teams));
  check(content.metrics?.athletes === 288, 'Worlddata athlete total must be 288', String(content.metrics?.athletes));
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
      check(team.athletes.length === 6, `${team.id} must have six athletes`, String(team.athletes.length));
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
  check(athleteIds.size === 288, 'Worlddata must have 288 unique athlete ids', String(athleteIds.size));
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
  check(rootRedirects[0]?.destination === '/world.html', 'Vercel root redirect must target /world.html', String(rootRedirects[0]?.destination));
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
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.playwright-cli' || entry.name === 'output') continue;
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
  console.log(`Cyberliga verification passed: ${checks} checks across 6 arenas, 6 leagues, 48 teams, 288 athletes, routes, schedules, hooks, deployment config, and local assets.`);
}
