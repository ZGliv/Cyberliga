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
const arenaInputHandler = /addEventListener\s*\(\s*['"](?:click|dblclick|auxclick|keydown|keyup|keypress|pointerdown|pointerup|pointermove|pointercancel|pointerenter|pointerleave|touchstart|touchmove|touchend|mousedown|mousemove|mouseup|wheel|contextmenu|beforeinput|input|change|submit)['"]|\.onclick\s*=/i;

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
  check(packageManifest.scripts?.['test:moments'] === 'node --test athlete-moments.test.mjs', 'npm run test:moments must cover athlete event normalization');
  check(packageManifest.scripts?.['test:named-moments'] === 'node --test named-moments.test.mjs', 'npm run test:named-moments must cover deterministic match memory');
  check(packageManifest.scripts?.['test:broadcast'] === 'node --test broadcast-spine.test.mjs', 'npm run test:broadcast must cover the shared Match Memory presentation state machine');
  check(packageManifest.scripts?.['test:chronicle'] === 'node --test witness-chronicle.test.mjs witness-store.test.mjs', 'npm run test:chronicle must cover the pure witness ledger and device-local adapter');
  check(packageManifest.scripts?.['test:football-replay-memory'] === 'node --test football-replay-memory.test.mjs', 'npm run test:football-replay-memory must cover football replay adjudication and truthful footage provenance');
  check(packageManifest.scripts?.['test:visuals'] === 'node --test foundingvisual.test.mjs foundinglive.test.mjs', 'npm run test:visuals must cover shared Founding portrait and live-cue renderers');
  check(packageManifest.scripts?.['test:characters'] === 'node --test classic-character.test.mjs', 'npm run test:characters must cover deterministic classic athlete performance fingerprints');
  check(packageManifest.scripts?.['test:broadcast-polish'] === 'node --test soccer-football-broadcast-polish.test.mjs hoops-hockey-broadcast-polish.test.mjs baseball-broadcast-polish.test.mjs fight-broadcast-grammar.test.mjs', 'npm run test:broadcast-polish must cover all six sport-specific watchability contracts');
  check(packageManifest.scripts?.verify === 'npm run test:api && npm run test:moments && npm run test:named-moments && npm run test:broadcast && npm run test:chronicle && npm run test:football-replay-memory && npm run test:visuals && npm run test:characters && npm run test:broadcast-polish && node scripts/verify.mjs', 'npm run verify must cover APIs, athlete moments, named match memory, broadcast presentation, witness chronology, football replay memory, Founding visuals, classic athlete performance, and all six sport-specific watchability contracts before static/data invariants');
  check(packageManifest.scripts?.['release:check'] === 'npm run verify && node scripts/release-check.mjs', 'npm run release:check must verify the repository before checking the canonical release source');
  check(Object.keys(packageManifest.dependencies || {}).length === 0, 'Runtime dependencies must remain empty');
  check(Object.keys(packageManifest.devDependencies || {}).length === 0, 'Development dependencies must remain empty');
}

for (const arena of arenas) {
  const present = await exists(arena.file);
  check(present, `Missing ${arena.id} arena`, arena.file);
  if (!present) continue;
  const htmlSource = await text(arena.file);
  const source = arena.file === 'football.html' ? `${htmlSource}\n${await text('football.js')}` : htmlSource;
  check(arena.label.test(source), `${arena.file} does not identify its sport`);
  check(/<script\s+src=["']watchonly\.js["']><\/script>/i.test(htmlSource), `${arena.file} must load the shared watch-only guard`);
  const arenaAnchors = htmlSource.match(/<a\b[^>]*>/gi) || [];
  check(arenaAnchors.length > 0 && arenaAnchors.every((anchor) => /class=["'][^"']*watch-only-exit/.test(anchor)), `${arena.file} must expose only exempt watch-only exit links`);
  const globeExits = htmlSource.match(/<a\b[^>]*class=["'][^"']*\bwatch-only-exit\b[^"']*["'][^>]*>[\s\S]*?<\/a>/gi) || [];
  const globeExitText = globeExits[0]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  check(globeExits.length === 1, `${arena.file} must expose exactly one watch-only arena exit`, String(globeExits.length));
  check(/href\s*=\s*["']world\.html["']/i.test(globeExits[0] || '') && globeExitText === '← GLOBE', `${arena.file} arena exit must read ← GLOBE and target world.html`);
  check(!/id=["'](?:wordmark|erapill)["']/i.test(htmlSource), `${arena.file} must not restore the obsolete top-left mode wordmark or era pill`);
  check(/(?:href\s*=\s*["']world\.html|location\.href\s*=\s*["']world\.html)/i.test(source), `${arena.file} has no route back to world.html`);
  check(/window\.render_game_to_text\s*=/.test(source), `${arena.file} is missing window.render_game_to_text`);
  check(/window\.advanceTime\s*=/.test(source), `${arena.file} is missing window.advanceTime`);
  check(/autonomous\s*:\s*true/.test(source) && /interaction\s*:\s*['"]view-only['"]/.test(source), `${arena.file} does not declare its autonomous view-only contract`);
  check(!/<(?:button|input|select|textarea)\b/i.test(source), `${arena.file} must not expose interactive game controls`);
  check(!arenaInputHandler.test(source), `${arena.file} must not bind user-input gameplay handlers`);
  check(/arena-score-fit\.css/.test(htmlSource) && /arena-score-fit\.js/.test(htmlSource), `${arena.file} must load the shared scoreboard fitting contract`);
  check(/data-score-fit/.test(htmlSource), `${arena.file} must identify its top-line club or fighter labels for measured fitting`);
}

const scoreFitSource = await text('arena-score-fit.js');
const scoreFitStyles = await text('arena-score-fit.css');
check(/CyberligaScoreFit/.test(scoreFitSource) && /fitAll/.test(scoreFitSource), 'Shared scoreboard fitter must expose browser QA state');
check(/ResizeObserver/.test(scoreFitSource) && /MutationObserver/.test(scoreFitSource), 'Shared scoreboard fitter must react to viewport and fixture-name changes');
check(/scrollWidth[\s\S]{0,120}clientWidth/.test(scoreFitSource), 'Shared scoreboard fitter must measure rendered label overflow');
check(/\.arena-score-readout[\s\S]{0,500}\.score-separator/.test(scoreFitStyles), 'Shared scoreboard styles must optically center score separators');
for (const file of ['index.html', 'hoops.html', 'hockey.html', 'baseball.html']) {
  const source = await text(file);
  check(/class=["'][^"']*arena-score-readout/.test(source) && /class=["']score-separator/.test(source), `${file} must use the centered shared score separator`);
}

const supportingPages = [
  { file: 'world.html', screen: /screen\s*:\s*['"]world['"]/ },
  { file: 'league.html', scriptFile: 'league-page.js', screen: /screen\s*:\s*['"]league-hq['"]/ },
  { file: 'social.html', screen: /screen\s*:\s*['"](?:social|world-wire)['"]/ },
  { file: 'moment.html', screen: /screen\s*:\s*['"](?:moment|moment-maker)['"]/ },
  { file: 'clip.html', screen: /screen\s*:\s*(?:viewer\s*\?\s*['"]animated-clip-viewer['"]\s*:\s*)?['"]animated-clip-director['"]/ },
  { file: 'menu.html', scriptFile: 'menu.js', screen: /screen\s*:\s*['"]broadcast-guide['"]/ },
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

const worldSource = await text('world.html');
const worldDeskStyles = await text('world-desk.css');
const fanworldSource = await text('fanworld.js');
const fanworldStyles = await text('fanworld.css');
const liveBridgeSource = await text('livebridge.js');
const atlasSource = `${await text('league.html')}\n${await text('league-page.js')}\n${await text('branddata.js')}`;
const leagueMarkupSource = await text('league.html');
const soccerSource = await text('index.html');
const hoopsSource = await text('hoops.html');
const blobRigSource = await text('blobrig.js');
const classicCharacterSource = await text('classic-character.js');
const socialSource = await text('social.html');
const momentSource = await text('moment.html');
const clipSource = await text('clip.html');
const menuSource = await text('menu.html');
const menuScript = await text('menu.js');
const replaySource = await text('replay.html');
const replayScript = await text('replay.js');
const playerSource = await text('player.html');
const playerScript = await text('player.js');
const playerStyles = await text('player.css');
const footballSource = await text('football.html');
const footballScript = await text('football.js');
const baseballSource = await text('baseball.html');
const hockeySource = await text('hockey.html');
const fightSource = await text('fight.html');
const releaseCheckSource = await text('scripts/release-check.mjs');
const auditSource = await text('SPECTATOR_AUDIT.md');
const agentsSource = await text('AGENTS.md');
const establishingSource = await text('arena-establishing.js');
const footballIdentitySource = await text('spectator-football-identity.js');
const soccerIdentitySource = await text('spectator-soccer-identity.js');
const crowdSource = await text('crowd.js');
const presentationSource = await text('presentation.js');

check(/codex\/vercel-sports-revamp/.test(releaseCheckSource), 'Release check must refuse the stale branch lineage');
check(/prj_9mFssNBl04pIJlaRPyzm6gaYG2O5/.test(releaseCheckSource), 'Release check must pin the canonical Vercel project');
check(/status['"],\s*['"]--porcelain=v1/.test(releaseCheckSource), 'Release check must refuse dirty release snapshots');
check(/24\\s\+GAMES/.test(releaseCheckSource) && /48\\s\+CLUBS/.test(releaseCheckSource), 'Release check must identify the accepted 24-game / 48-club homepage');
check(/not yet a\s+viral spectator product/i.test(auditSource), 'Spectator audit must preserve an honest baseline verdict');
check(/server-authoritative/i.test(auditSource) && /must not accept real-money bets/i.test(auditSource), 'Spectator audit must preserve the real-money integrity boundary');
check(/48 stadium\/arena establishing plates/i.test(auditSource) && /144 uniform plates/i.test(auditSource), 'Spectator audit must preserve the explicit AI asset-production gap');
check(/SPECTATOR_AUDIT\.md/.test(agentsSource) && /npm run release:check/.test(agentsSource), 'Agent contract must require the spectator audit and canonical release check');
check(/root\.CyberligaEstablishing\s*=/.test(establishingSource) && /HOME RITUAL/.test(establishingSource), 'Shared establishing package must connect matches to authored home rituals');
check(/brand\.sceneSvg\(home\)/.test(establishingSource) && /league\.hero/.test(establishingSource), 'Shared establishing package must combine league hero art with the selected club concept');
check(/pointer-events:none/.test(establishingSource), 'Establishing shot must remain a non-interactive broadcast layer');

const worldPrimaryNav = worldSource.match(/<nav class=["']nav["'][^>]*>[\s\S]*?<\/nav>/i)?.[0] || '';
const leaguePrimaryNav = leagueMarkupSource.match(/<nav class=["']league-nav["'][^>]*>[\s\S]*?<\/nav>/i)?.[0] || '';
const playerPrimaryNav = playerSource.match(/<nav[^>]*aria-label=["']Primary navigation["'][^>]*>[\s\S]*?<\/nav>/i)?.[0] || '';
const clipPrimaryNav = clipSource.match(/<nav[^>]*aria-label=["']Primary navigation["'][^>]*>[\s\S]*?<\/nav>/i)?.[0] || '';
for (const [label, nav] of [['World', worldPrimaryNav], ['League HQ', leaguePrimaryNav], ['Athlete Files', playerPrimaryNav], ['Clip Viewer', clipPrimaryNav]]) {
  check((nav.match(/<a\b/gi) || []).length === 2, `${label} primary navigation must expose exactly Home and Leagues`);
  check(/world\.html/i.test(nav) && /league\.html/i.test(nav), `${label} primary navigation must link Home and Leagues`);
  check(!/(?:menu\.html|social\.html|COMMUNITY|LIVE NOW|>\s*WATCH\s*<\/)/i.test(nav), `${label} primary navigation restored a removed destination`);
}
check(!/\.masthead\s+nav\s+a:not\(:last-child\)\s*\{\s*display\s*:\s*none/i.test(playerStyles), 'Athlete Files must keep both primary destinations visible on mobile');

check(/export const CLASSIC_PLAYER_COLORS\s*=\s*Object\.freeze\(\[0x00e5ff,\s*0xff45d6\]\)/i.test(blobRigSource), 'Shared rig must preserve the canonical cyan/hot-pink athlete palette');
check(/export function classicPlayerColor\s*\(/.test(blobRigSource), 'Shared rig must expose side-stable classic athlete colors');
check(/hasClassicSide[\s\S]{0,500}resolvedKitColor/.test(blobRigSource), 'Shared rig must prevent implicit white athlete bloom');
check(/club-uniform-identity/.test(blobRigSource) && /jerseyNumber/.test(blobRigSource) && /kitPattern/.test(blobRigSource), 'Shared classic rig must carry club code, number, and authored kit identity');
check(/createClassicCharacterProfile/.test(blobRigSource) && /characterProfile/.test(blobRigSource), 'Shared classic rig must apply canonical athlete performance fingerprints');
check(/CLASSIC_CHARACTER_VERSION/.test(classicCharacterSource) && /Object\.freeze\(profile\)/.test(classicCharacterSource), 'Classic character fingerprints must be versioned and immutable');
check(!/Math\.random/.test(classicCharacterSource) && /classicIdentityHash/.test(classicCharacterSource), 'Classic character fingerprints must be deterministic and local');
check(/athlete\?\.temperament/.test(classicCharacterSource) && /athlete\?\.silhouette/.test(classicCharacterSource) && /team\?\.motion/.test(classicCharacterSource), 'Classic character fingerprints must consume authored temperament, silhouette, and team motion');
for (const motifFamily of ['slash', 'weave', 'rings', 'grid', 'branch', 'hex', 'wave', 'fracture', 'constellation']) {
  check(blobRigSource.includes(`'${motifFamily}'`), `Shared classic rig is missing the ${motifFamily} uniform motif family`);
}

const livingWorldArenaSources = [
  ['soccer', `${soccerSource}\n${soccerIdentitySource}`],
  ['american-football', `${footballScript}\n${footballIdentitySource}`],
  ['basketball', hoopsSource],
  ['hockey', hockeySource],
  ['baseball', baseballSource],
  ['combat', fightSource]
];
for (const [sportId, source] of livingWorldArenaSources) {
  check(/branddata\.js|CyberligaBrand/.test(source), `${sportId} arena does not consume the 48-club brand canon`);
  check(/arena-establishing\.js|CyberligaEstablishing/.test(source), `${sportId} arena is missing the automatic venue establishing beat`);
  check(/brandColor[\s\S]{0,500}teamCode[\s\S]{0,500}kitPattern/.test(source), `${sportId} arena does not pass club-authored uniform identity into its athletes`);
  check(/venue[\s\S]{0,700}ritual/.test(source), `${sportId} machine-readable broadcast state does not expose venue and ritual identity`);
}

const classicArenaSources = [
  ['soccer', soccerSource],
  ['american-football', footballScript],
  ['basketball', hoopsSource],
  ['hockey', hockeySource],
  ['baseball', baseballSource],
  ['combat', fightSource]
];
for (const [sportId, source] of classicArenaSources) {
  check(source.includes('classicPlayerColor'), `${sportId} arena is not bound to the classic cyan/hot-pink player signal`);
  check(/(?:buildBlobRig|buildRig)\s*\(\s*\{[\s\S]{0,240}?\bside\b/.test(source), `${sportId} arena does not assign athlete color by matchup side`);
}
check(!/buildAthleteRig/.test(footballScript) && /from\s+['"]\.\/blobrig\.js['"]/.test(footballScript), 'Football must render the accepted classic capsule athletes');

check(/football\.html/.test(worldSource), 'World map does not route to American football');
check(/data-home-edition=["']world-desk["']/.test(worldSource) && /world-desk\.css/.test(worldSource), 'World Home must load the restrained World Desk edition');
check(/>\s*Tonight\s*</.test(worldSource) && /24 games · 48 clubs/i.test(worldSource), 'World Desk must lead with an ordinary sports schedule and the canonical slate');
check(!/(?:CHOOSE A GAME|ENTER THE ACTION|LIVE GAME NETWORK|ACQUIRING THE WORLD SIGNAL)/i.test(worldSource), 'World Home restored synthetic dashboard language');
check(/quietWorldDesk[\s\S]{0,220}!quietWorldDesk\) ensureShell\(\)[\s\S]{0,180}pageKind === 'world' && !quietWorldDesk/.test(fanworldSource), 'World Desk must keep the empty supporter shell and synthetic story pulse off Home');
check(/body::before[\s\S]{0,120}body::after[\s\S]{0,120}content:\s*none/.test(worldDeskStyles), 'World Desk must remove the scanline and cinematic dashboard overlays');
check(/\.liveboard\s*\{[\s\S]{0,420}width:\s*410px[\s\S]{0,300}background:\s*var\(--board\)/.test(worldDeskStyles), 'World Desk must use one matte desktop schedule rail');
check(/\.filter-tabs,[\s\S]{0,240}display:\s*grid[\s\S]{0,120}grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/.test(worldDeskStyles) && /@media \(max-width:\s*900px\)[\s\S]{0,1800}\.filter-tabs,[\s\S]{0,240}display:\s*flex[\s\S]{0,180}overflow-x:\s*auto/.test(worldDeskStyles), 'World Desk must expose every sport filter on desktop while retaining a touch-scrollable phone rail');
check(/@media \(max-width:\s*900px\)[\s\S]{0,2500}\.liveboard\s*\{[\s\S]{0,260}height:\s*49dvh/.test(worldDeskStyles), 'World Desk must preserve a globe-first phone composition');
check(/\.game-drawer\s*\{[\s\S]{0,500}overflow-y:\s*auto[\s\S]{0,220}touch-action:\s*pan-y/.test(worldDeskStyles) && !/scroll-snap-type:\s*x/.test(worldDeskStyles), 'World Desk schedule must retain vertical touch panning rather than nested swipe rails');
check(/\.fixture-team-name\s*\{[\s\S]{0,260}font:\s*700 15px/.test(worldDeskStyles) && /\.sport-label[\s\S]{0,260}font:\s*650 13px/.test(worldDeskStyles), 'World Desk club and sport labels must remain ordinary readable sports typography');
check(/fixtureStatus\(card\)/.test(worldSource) && /displayClubName\(card\.home\.name\)/.test(worldSource) && /displayClubName\(card\.away\.name\)/.test(worldSource), 'World Desk fixtures must prioritize truthful state and full club names');
check(/id=["']filter-tabs["']\s+role=["']group["']/.test(worldSource) && /setAttribute\(['"]aria-pressed['"],String\(on\)\)/.test(worldSource) && !/button\.role=['"]tab['"]/.test(worldSource), 'World Desk sport filters must expose honest native pressed-button semantics');
check(/mobileSelectorMedia=matchMedia\(['"]\(max-width:900px\)['"]\)/.test(worldSource), 'World Desk state hook must use the same compact breakpoint as the rendered composition');
check(/const labelVisible = active && front/.test(worldSource) && /route\.mesh\.material\.opacity=route\.card===card\?0\.48:0\.065/.test(worldSource), 'World Desk must show at most the selected matchup labels and route');
check(/function setCanvasHoverMarker\(marker\)\{[\s\S]{0,260}highlightFixture\(marker\?\.card\|\|previewCard\)/.test(worldSource) && /pointerdown'[\s\S]{0,240}canvasHoverMarker\|\|pinAtPointer\(event\)/.test(worldSource), 'World Desk globe pins must remain stationary on hover and preserve the viewer click target');
check(/function syncSoccerFixtureBindings\(soccerCards\)[\s\S]{0,700}marker\.card=current[\s\S]{0,500}routeGeometryForCard\(route\.card\)/.test(worldSource) && /slotChanged\)syncSoccerFixtureBindings\(soccerCards\)/.test(worldSource), 'World Desk must rebind soccer pins and routes when the canonical six-minute fixture slot rolls');
check(/event\.key===['"]Escape['"]&&previewCard/.test(worldSource), 'World Desk Escape handling must not steal focus when no preview selection exists');
check(/preview:previewCard\?\{open:false,selected:true/.test(worldSource) && /:\{open:false,selected:false\}/.test(worldSource), 'World Desk state hook must distinguish a selected fixture from a visible preview dialog');
check(/data-cyberliga-presence\s+data-presence-mode=["']quiet["']/.test(worldSource) && !/data-presence-mode=["']quiet["'][^>]*aria-live/.test(worldSource) && /if\s*\(!quiet\)\s*node\.textContent\s*=\s*label/.test(liveBridgeSource), 'World Desk must not expose synthetic local-watcher copy visually or through an ARIA live region');
check(/<script src=["']branddata\.js["']><\/script>/.test(worldSource) && /BRAND\?\.crestSvg/.test(worldSource), 'World fixture selector must render canonical club crests');
check(/clubEmblemMarkup\(card\.home,card\.league\)/.test(worldSource) && /clubEmblemMarkup\(card\.away,card\.league\)/.test(worldSource), 'Every World fixture must show both club crests');
check(/const SPORT_ICONS = Object\.freeze/.test(worldSource) && ['soccer','american-football','basketball','hockey','baseball','combat'].every(sportId => worldSource.includes(`${sportId}:\``) || worldSource.includes(`'${sportId}':\``)), 'World sport selector must expose a distinct visual symbol for every sport');
check(/class=["']sport-label["']/.test(worldSource) && /displaySport\(filter\.id\)/.test(worldSource), 'World sport selector must render readable full sport labels');
check(/['"]american-football['"]\s*:\s*\{[\s\S]{0,500}?arena\s*:\s*['"]football\.html['"]/.test(atlasSource), 'League HQ does not route American football to football.html');
check(/id=["']standings-shell["']/.test(atlasSource) && /class=["']standings-table["']/.test(atlasSource), 'League HQ is missing its standings table');
check(/api\/league\?sport=/.test(atlasSource), 'League atlas does not load the shared league-state API');
check(/id=["']roster-filters["']/.test(atlasSource), 'League atlas is missing football offense/defense roster filters');
check(/class=["']athlete-links["']/.test(atlasSource) && /player\.html\?sport=/.test(atlasSource) && /social\.html\?sport=/.test(atlasSource), 'League HQ does not connect athletes to permanent profile and World Wire URLs');
for (const arena of arenas) {
  check(worldSource.includes(arena.id), `World map does not expose ${arena.id}`);
  check(worldSource.includes(arena.file), `World map does not link the ${arena.id} arena`, arena.file);
  check(atlasSource.includes(arena.file), `League atlas does not link the ${arena.id} arena`, arena.file);
}
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
check(/params\.get\(['"]view['"]\)===['"]1['"]/.test(clipSource), 'Shared story clips must expose a passive viewer mode');
check(clipSource.indexOf('document.documentElement.dataset.clipMode') >= 0 && clipSource.indexOf('document.documentElement.dataset.clipMode') < clipSource.indexOf('<style>'), 'Passive clip mode must be established before viewer controls can paint');
check(/controls:viewer\?\[\]/.test(clipSource) && /interaction:viewer\?['"]view-only['"]/.test(clipSource), 'Passive story clips must publish a view-only, control-free state');
check(/data-clip-mode=["']viewer["'][^}]*\.links\s*\{\s*display\s*:\s*none!important/i.test(clipSource), 'Passive story clips must not expose legacy secondary destinations');
check(/FICTIONAL OUTCOME[^<]*NOT A RECORDED LIVE RESULT/.test(clipSource), 'Synthetic clip outcomes must be visibly labeled as fictional concepts');
check(/EVENT-REFERENCED ANIMATED INTERPRETATION[^<]*URL DATA IS UNVERIFIED[^<]*NOT AN OFFICIAL RESULT OR RECORDED FOOTAGE/.test(clipSource), 'Event-referenced clips must visibly reject URL claims of authority');
check(!/params\.get\(['"]eventCanonical['"]\)/.test(clipSource), 'Clip Viewer must never trust a query parameter as canonical event authority');
check((clipSource.match(/CONCEPT SCORE · EVENT SCORE MISSING/g) || []).length >= 2 && /scoreClaimPresent:[^,}]+,scoreVerified:false/.test(clipSource), 'Event-referenced clips without a score claim must visibly use an unverified concept score in both the canvas reveal and page copy');
check(!/REFERENCED SCORE/.test(clipSource), 'Clip Viewer must never label an unverified URL score as a referenced result');
check(/id=["']channel-grid["']/.test(menuSource), 'Broadcast Guide must expose the canonical live channel grid');
check(/id=["']sport-grid["']/.test(menuSource), 'Broadcast Guide must expose every playable arena');
check(/UNIVERSE\.liveMatches/.test(menuScript), 'Broadcast Guide must use the shared UTC match schedule');
check(/\^\[1-4\]\$/.test(menuScript), 'Broadcast Guide must keep keyboard tuning for the four soccer channels');
for (const arena of arenas) check(menuScript.includes(arena.file), `Broadcast Guide does not link ${arena.id}`, arena.file);
check(menuSource.includes('replay.html') && menuSource.includes('player.html'), 'Broadcast Guide does not expose Replay Center and Athlete Files');
check(/U\.liveMatches/.test(replayScript) && /selectionURL/.test(replayScript), 'Replay Center must use shared UTC matches and permanent selection URLs');
check(/CANONICAL BOUNDARY/.test(replayScript) && /EXHIBITION BOUNDARY/.test(replayScript), 'Replay Center must label canonical and exhibition provenance');
check(/player\.html\?sport=/.test(replayScript), 'Replay Center does not hand highlights into Athlete Files');
check(/416/.test(playerScript) || (/C\.getSport/.test(playerScript) && /C\.getTeam/.test(playerScript) && /C\.getAthlete/.test(playerScript)), 'Athlete Files must resolve the shared world roster');
check(/player\.html\?/.test(playerScript) && /canonical/.test(playerScript), 'Athlete Files must expose permanent canonical profile URLs');
check(!/id=["']playPanel["']/.test(footballSource) && !/id=["']snap["']/.test(footballSource), 'Football must remain an autonomous broadcast without coach or snap controls');
check(/window\._footballTest\s*=/.test(footballScript) && /forceSituation[\s\S]*forcePlay[\s\S]*startAutomaticPlay[\s\S]*finishPlay/.test(footballScript), 'Football must expose deterministic situation, play-call, automatic snap, outcome, and finish helpers');
check(/beginPreplay/.test(footballScript) && /PREPLAY_SECONDS/.test(footballScript) && /startAutomaticPlay\(\)/.test(footballScript), 'Football must choose and snap plays autonomously');
check(/visibilitychange/.test(footballScript) && /hiddenTimer/.test(footballScript), 'Football must keep simulating autonomously in hidden tabs');
check(/window\._baseballTest\s*=/.test(baseballSource) && /double_play|sac_fly/.test(baseballSource), 'Baseball must expose deterministic force-play branch helpers');
check(!/id=["']gameplan["']/.test(baseballSource), 'Baseball must not restore the removed game-plan header overlay');
check(/pitchHistory/.test(baseballSource) && /render_game_to_text/.test(baseballSource), 'Baseball must retain structured pitch history in its machine-readable broadcast state');
check(/window\.__CYBERLIGA_HOCKEY_TEST__\s*=/.test(hockeySource) && /penalty[\s\S]*powerplay[\s\S]*overtime[\s\S]*final/.test(hockeySource), 'Hockey must expose penalty, power-play, overtime, and final branch helpers');
check(/window\._fightTest\s*=/.test(fightSource) && /forceDecision[\s\S]*forceStoppage/.test(fightSource), 'Combat must expose deterministic decision and stoppage branch helpers');
check(/visualPosition[\s\S]*visualFacing/.test(footballScript) && /COUNTER GT[\s\S]*JET SWEEP[\s\S]*FLOOD CONCEPT[\s\S]*SEAM SHOT/.test(footballScript), 'Football must retain interpolated player motion and the expanded run/pass concept set');
check(/possessionSignal|possession.*ring|pass.*signal/i.test(soccerSource), 'Soccer must retain side-consistent possession/pass readability');
check(!/Math\.random\s*=/.test(soccerSource), 'Soccer must not replace the global RNG');
check(/const\s+simRandom[\s\S]{0,500}const\s+presentationRandom/.test(soccerSource), 'Soccer must define domain-separated simulation and presentation RNG streams');
check(/createTactics\(\{\s*rng:\s*simRandom/.test(soccerSource) && /createBallFlight\(\{[\s\S]{0,120}rng:\s*simRandom/.test(soccerSource), 'Soccer tactics and ball flight must consume only simulation RNG');
check(/createCrowd\([^;]+rng:\s*presentationRandom/.test(soccerSource) && /createPresentation\(\{\s*rng:\s*presentationRandom/.test(soccerSource), 'Soccer crowd and broadcast copy must consume only presentation RNG');
check(/export function createCrowd\([\s\S]{0,500}\brng\b/.test(crowdSource) && !/\bMath\.random\s*\(/.test(crowdSource), 'Crowd implementation must use its injected presentation RNG');
check(/export function createPresentation\([^)]*opts[\s\S]{0,220}\brng\b/.test(presentationSource), 'Presentation copy must use its injected presentation RNG');
check(/RETRIEVE[\s\S]*BASELINE[\s\S]*READY[\s\S]*PASS/.test(hoopsSource) && /inboundsCompleted/.test(hoopsSource), 'Basketball must show a real baseline inbound sequence after baskets');
check(
  /deterministicSeed/.test(hockeySource)
    && /const aimZ = \(rnd\(\)/.test(hockeySource)
    && /const commits=forcedMajorCheck\|\|rnd\(\)</.test(hockeySource)
    && /const defenseWins=forced\|\|rnd\(\)</.test(hockeySource),
  'Hockey sporting decisions must use the seeded simulation RNG',
);
check(/pitchTargetMarker/.test(baseballSource) && /pitchGuideStep/.test(baseballSource) && /pitchIntent/.test(baseballSource), 'Baseball must expose pitch tunnel, target, and intent causality');
check(!/say\s*\(\s*spick\(/.test(baseballSource), 'Baseball commentary must not consume seeded sporting RNG');
check(/const\s+spick\s*=/.test(baseballSource) && /:\s*spick\(\[a,b\]\)/.test(baseballSource), 'Baseball must retain seeded RNG for genuine sporting decisions');
check(/OVERHAND/.test(fightSource) && /LIVER/.test(fightSource) && /clinchWorkT/.test(fightSource) && /ROPE EXIT/.test(fightSource), 'Combat must retain broader strikes, inside work, and deliberate rope-exit footwork');
check(/const\s+venueBoards\s*=\s*\[\]/.test(fightSource) && /const\s+mobileClearView\s*=\s*innerWidth<700/.test(fightSource) && /for\s*\(const board of venueBoards\)\s*board\.visible\s*=\s*!mobileClearView/.test(fightSource), 'Combat must suppress venue-board occlusion once portrait live action begins');
check(/let\s+fightSeed[\s\S]{0,80}presentationSeed[\s\S]{0,500}function\s+prand\(/.test(fightSource) && /const\s+ppick\s*=/.test(fightSource), 'Combat must define a separate presentation RNG');
check(/function\s+seedFight[\s\S]{0,400}\|simulation[\s\S]{0,400}\|presentation/.test(fightSource), 'Combat RNG streams must be domain-separated');
check(!/say\([^;\n]*\bpick\(/.test(fightSource), 'Combat commentary must not consume sporting RNG');
check(/const\s+sequence[\s\S]{0,500}\bpick\(/.test(fightSource), 'Combat combo selection must retain seeded sporting RNG');
check(await exists('gamehub.js'), 'Missing shared in-game navigation hub');
const gameHubSource = await text('gamehub.js');
check(/removeLegacyCyberligaGameHub/.test(gameHubSource), 'Legacy gamehub compatibility file must remain removal-only');
for (const arena of arenas) check(!(await text(arena.file)).includes('gamehub.js'), `${arena.file} must not restore the removed Navigate menu`);
for (const arena of arenas) {
  const source = await text(arena.file);
  const worldAt = source.indexOf('worlddata.js');
  const characterAt = source.indexOf('characterdata.js');
  const visualAt = source.indexOf('foundingvisual.js');
  const liveAt = source.indexOf('foundinglive.js');
  const mythosAt = source.indexOf('mythos.js');
  check(worldAt >= 0 && worldAt < characterAt && characterAt < visualAt && visualAt < liveAt && liveAt < mythosAt, `${arena.file} must load world → characters → Founding visual → live cues → mythos in order`);
  check(!source.includes('arena-signal.css') && !source.includes('arena-signal.js'), `${arena.file} must not restore the removed arena narrative overlay`);
}
check(/CyberligaCharacters\?\.featuredForTeam/.test(fightSource), 'Combat must put its Founding 12 athlete into each authored club cast');
check(/founding-cue-/.test(blobRigSource) && /new THREE\.Mesh\(geometry, bodyMaterial\)/.test(blobRigSource), 'Shared rig must build Founding cues from the existing classic athlete material');
check(/mesh\.raycast\s*=\s*\(\)\s*=>\s*\{\}/.test(blobRigSource) && /castShadow\s*=\s*false/.test(blobRigSource), 'Founding live cues must remain non-interactive and shadow-free');
check(/athlete\s*=\s*null,\s*foundingTeam\s*=\s*null/.test(blobRigSource), 'Shared rig must keep Founding identity an explicit optional presentation input');
for (const [sportId, source] of classicArenaSources) {
  check(/\bfoundingTeam\s*:/.test(source), `${sportId} arena must pass the exact world team into the strict Founding cue gate`);
  check(/\bfoundingCues\s*:|const\s+foundingCues\s*=/.test(source), `${sportId} arena must expose currently rendered Founding cues in machine-readable state`);
}
const characterLabSource = await text('characterlab.html');
const characterLabScript = await text('characterlab.js');
check(/Marquee 12/i.test(characterLabSource), 'Character Lab must expose the first twelve marquee athletes');
check(/window\.render_game_to_text\s*=/.test(characterLabScript), 'Character Lab is missing window.render_game_to_text');
check(/window\.advanceTime\s*=/.test(characterLabScript), 'Character Lab is missing window.advanceTime');
check(/view.*match[\s\S]*portrait[\s\S]*clip/i.test(characterLabScript), 'Character Lab must cover match, portrait, and clip contexts');
const foundingSurfaceSources = [
  ['Character Lab', characterLabSource, characterLabScript, 'founding-vector'],
  ['Athlete Files', playerSource, playerScript, 'generic-css'],
  ['Clip Director', clipSource, clipSource, 'generic-procedural'],
  ['Moment Maker', momentSource, momentSource, 'generic-procedural']
];
for (const [label, markup, source, fallbackMode] of foundingSurfaceSources) {
  const worldAt = markup.indexOf('worlddata.js');
  const characterAt = markup.indexOf('characterdata.js');
  const visualAt = markup.indexOf('foundingvisual.js');
  check(worldAt >= 0 && worldAt < characterAt && characterAt < visualAt, `${label} must load world → characters → Founding visual renderer in order`);
  check(/\bvisual\s*:/.test(source), `${label} must publish its shared visual identity in render_game_to_text`);
  check(fallbackMode === 'founding-vector' ? /VISUAL\.describe\s*\(/.test(source) : source.includes(fallbackMode), `${label} must publish the ${fallbackMode} visual mode`);
}
check(/FoundingVisual|CyberligaFoundingVisual/.test(characterLabScript), 'Character Lab must delegate its marquee bodies to the shared visual renderer');
check(/drawGenericSilhouette/.test(momentSource), 'Moment Maker must retain its exact generic procedural fallback');
check(/drawGenericAthlete/.test(clipSource), 'Clip Director must retain its exact generic procedural fallback');
check(/sportProp\s*:\s*false/.test(clipSource), 'Clip Director must suppress duplicate authored props while retaining its moving game object');
check(/founding-canvas/.test(playerSource) && /is-founding/.test(playerStyles), 'Athlete Files must switch Founding athletes onto the shared canvas without removing generic CSS portraits');
const momentPrimaryNav = momentSource.match(/<nav\b[^>]*aria-label=["']Primary navigation["'][^>]*>([\s\S]*?)<\/nav>/i)?.[1] || '';
const momentPrimaryTargets = [...momentPrimaryNav.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1]);
check(JSON.stringify(momentPrimaryTargets) === JSON.stringify(['world.html', 'league.html']), 'Moment Maker primary navigation must expose only Home and Leagues', momentPrimaryTargets.join(', '));
check(/<a\b[^>]*class=["'][^"']*status-seal[^"']*["'][^>]*href=["']league\.html["'][^>]*>\s*<span>Leagues<\/span>\s*<\/a>/i.test(characterLabSource), 'Character Lab masthead must pair its Home brand with a Leagues destination');
check(!/<header\b[^>]*class=["'][^"']*masthead[^"']*["'][\s\S]*?href=["']menu\.html["'][\s\S]*?<\/header>/i.test(characterLabSource), 'Character Lab masthead must not restore the retired Broadcast Guide destination');
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

let characterCanon = null;
const characterDataPresent = await exists('characterdata.js');
check(characterDataPresent, 'Missing shared Founding 12 character canon', 'characterdata.js');
if (characterDataPresent && content) {
  const characterContext = vm.createContext({ CYBERLIGA_CONTENT: content, console });
  vm.runInContext(await text('characterdata.js'), characterContext, { filename: 'characterdata.js', timeout: 2000 });
  const characters = characterContext.CyberligaCharacters;
  characterCanon = characters || null;
  check(Boolean(characters), 'characterdata.js did not expose CyberligaCharacters');
  if (characters) {
    check(Object.isFrozen(characters), 'CyberligaCharacters public API must be frozen');
    check(characters.records?.length === 12, 'Character canon must contain exactly 12 founding athletes', String(characters.records?.length));
    check(characters.records?.every((record) => content.getAthlete(record.teamId, record.id)), 'Every founding character must resolve to the 416-athlete world roster');
    check(new Set(characters.records?.map((record) => record.teamId)).size === 12, 'Founding characters must represent 12 distinct clubs');
    check(content.sports.every((sport) => characters.records?.filter((record) => record.sportId === sport.id).length === 2), 'Every sport must have exactly two founding characters');
    check(characters.validate(content)?.valid === true, 'CyberligaCharacters.validate must accept the canonical world roster', (characters.validate(content)?.errors || []).join('; '));
  }
}

let foundingVisualApi = null;
const foundingVisualPresent = await exists('foundingvisual.js');
check(foundingVisualPresent, 'Missing shared Founding 12 vector renderer', 'foundingvisual.js');
if (foundingVisualPresent) {
  const foundingVisualSource = await text('foundingvisual.js');
  const visualContext = vm.createContext({ console });
  vm.runInContext(foundingVisualSource, visualContext, { filename: 'foundingvisual.js', timeout: 2000 });
  const visual = visualContext.CyberligaFoundingVisual;
  foundingVisualApi = visual || null;
  check(Boolean(visual), 'foundingvisual.js did not expose CyberligaFoundingVisual');
  check(!/\bMath\.random\b/.test(foundingVisualSource), 'Founding visual renderer must not read global randomness');
  check(!/\b(?:document|location|localStorage|sessionStorage)\b/.test(foundingVisualSource), 'Founding visual renderer must remain independent of DOM, URL, and storage state');
  if (visual) {
    check(Object.isFrozen(visual), 'CyberligaFoundingVisual public API must be frozen');
    check(visual.version === '1.0.0' && visual.durationMs === 4800, 'Founding visual renderer must publish a stable version and loop duration');
    check(visual.bodyKeys?.length === 12 && visual.descriptors?.length === 12, 'Founding visual renderer must cover exactly the canonical twelve bodies');
    for (const method of ['prepare', 'describe', 'fit', 'draw', 'drawFit', 'drawSportProp']) {
      check(typeof visual[method] === 'function', `CyberligaFoundingVisual is missing ${method}()`);
    }
    if (characterCanon && content) {
      const prepared = characterCanon.records.map((record) => visual.prepare(record, content.getTeam(record.teamId, record.sportId)));
      check(prepared.every(Boolean), 'Every Founding 12 record must prepare against its canonical club');
      const transform = visual.fit({ x:80, y:390, width:920, height:880 }, { padding:28 });
      const identity = prepared[0] && visual.describe(prepared[0], visual.showcasePhase, 'verification', transform);
      check(Object.isFrozen(transform) && transform.scale > 0, 'Founding visual fit must produce a frozen finite transform');
      check(Object.isFrozen(identity) && identity.mode === 'founding-vector' && identity.identityKey?.startsWith('founding-vector@1.0.0/'), 'Founding visual identities must be frozen, versioned, and athlete-addressable');
    }
  }
}

const foundingLivePresent = await exists('foundinglive.js');
check(foundingLivePresent, 'Missing shared Founding live-broadcast cue canon', 'foundinglive.js');
if (foundingLivePresent) {
  const foundingLiveSource = await text('foundinglive.js');
  const liveContext = vm.createContext({
    console,
    CYBERLIGA_CONTENT: content,
    CyberligaCharacters: characterCanon,
    CyberligaFoundingVisual: foundingVisualApi
  });
  vm.runInContext(foundingLiveSource, liveContext, { filename: 'foundinglive.js', timeout: 2000 });
  const live = liveContext.CyberligaFoundingLive;
  check(Boolean(live), 'foundinglive.js did not expose CyberligaFoundingLive');
  check(!/\bMath\.random\b/.test(foundingLiveSource), 'Founding live cues must not consume randomness');
  check(!/\b(?:document|location|localStorage|sessionStorage|fetch|XMLHttpRequest|requestAnimationFrame|performance|Date)\b/.test(foundingLiveSource), 'Founding live cues must remain independent of DOM, URL, storage, network, and clocks');
  if (live) {
    check(Object.isFrozen(live), 'CyberligaFoundingLive public API must be frozen');
    check(live.version === '1.0.0' && live.bodyKeys?.length === 12 && live.recipes?.length === 12, 'Founding live cues must publish a stable twelve-body catalogue');
    for (const method of ['prepare', 'describe', 'recipeFor', 'cueTriangles', 'recipeTriangles', 'validate']) {
      check(typeof live[method] === 'function', `CyberligaFoundingLive is missing ${method}()`);
    }
    const validation = live.validate();
    check(validation?.valid === true && validation?.maxCues === 3 && validation?.maxTrianglesPerCue === 32 && validation?.maxTrianglesPerAthlete === 96, 'Founding live cue recipes must satisfy geometry and cue budgets', (validation?.errors || []).join('; '));
    if (characterCanon && foundingVisualApi && content) {
      const prepared = characterCanon.records.map((record) => {
        const team = content.getTeam(record.teamId, record.sportId);
        const athlete = content.getAthlete(record.teamId, record.id);
        return live.prepare(athlete, team);
      });
      check(prepared.every(Boolean), 'Every exact Founding athlete must prepare for live broadcast');
      check(prepared.every((descriptor) => {
        const state = live.describe(descriptor);
        return Object.isFrozen(state) && state.mode === 'founding-live-cue' && state.identityKey?.startsWith('founding-vector@1.0.0/') && state.cueCount <= 3 && state.triangleCount <= 96;
      }), 'Every Founding live identity must be frozen, versioned, and budgeted');
    }
  }
}

const namedMomentsPresent = await exists('named-moments.js');
const broadcastSpinePresent = await exists('broadcast-spine.js') && await exists('broadcast-spine.css');
check(namedMomentsPresent, 'Missing deterministic Match Memory director', 'named-moments.js');
check(broadcastSpinePresent, 'Missing shared Match Memory broadcast spine', 'broadcast-spine.js / broadcast-spine.css');
if (namedMomentsPresent) {
  const namedMomentSource = await text('named-moments.js');
  const namedMomentContext = vm.createContext({
    console,
    CYBERLIGA_CONTENT: content,
    CyberligaCharacters: characterCanon,
    encodeURIComponent
  });
  vm.runInContext(namedMomentSource, namedMomentContext, { filename:'named-moments.js', timeout:2000 });
  const namedMoments = namedMomentContext.CyberligaNamedMoments;
  check(Boolean(namedMoments), 'named-moments.js did not expose CyberligaNamedMoments');
  check(!/\bMath\.random\b/.test(namedMomentSource), 'Match Memory must not consume simulation or presentation randomness');
  check(!/\b(?:document|location|localStorage|sessionStorage|fetch|XMLHttpRequest|requestAnimationFrame|setTimeout|setInterval|performance|Date)\b/.test(namedMomentSource), 'Match Memory core must remain independent of DOM, URL, storage, network, scheduling, and clocks');
  if (namedMoments) {
    check(Object.isFrozen(namedMoments) && namedMoments.ready === true, 'Match Memory API must be frozen and bound to canonical identity authorities');
    check(namedMoments.sportIds?.length === 6 && namedMoments.sportIds.every((sportId) => namedMoments.eventKinds?.[sportId]?.length), 'Match Memory must publish fixed event vocabularies for all six sports');
    check(namedMoments.limits?.candidates === 12 && namedMoments.limits?.top === 3, 'Match Memory must cap retained candidates and the final broadcast memory');
    check(namedMoments.safety?.authoritative === false && namedMoments.safety?.wagerable === false && namedMoments.safety?.settles === false, 'Match Memory must reject authority, wagering, and fan-call settlement');
    check(typeof namedMoments.create === 'function', 'Match Memory API is missing create()');
    check(typeof namedMoments.verify === 'function', 'Match Memory API must certify exact emitted moment objects');
  }
}
if (broadcastSpinePresent) {
  const broadcastSpineSource = await text('broadcast-spine.js');
  const broadcastSpineStyles = await text('broadcast-spine.css');
  check(/Object\.freeze\(\{\s*version:VERSION,\s*create:create\s*\}\)/.test(broadcastSpineSource), 'Broadcast spine must expose a frozen creation API');
  check(!/addEventListener|onclick\s*=|onpointer|ontouch|onkey/.test(broadcastSpineSource), 'Broadcast spine must never add spectator or gameplay controls');
  check(/NOT AUTHORITATIVE · NO MONEY · NO PRIZE/.test(broadcastSpineSource) && /VIEW-ONLY · CLIENT SIM/.test(broadcastSpineSource), 'Broadcast spine must visibly publish its client-only safety boundary');
  check(/pointer-events:\s*none\s*!important/.test(broadcastSpineStyles), 'Broadcast spine must remain pointer-inert');
  check(/@media \(max-width: 700px\)/.test(broadcastSpineStyles) && /orientation: landscape/.test(broadcastSpineStyles), 'Broadcast spine must define phone and landscape broadcast layouts');
  check(/font:\s*750 9px\/1\.3/.test(broadcastSpineStyles) && /font-size:\s*10px/.test(broadcastSpineStyles), 'Broadcast spine safety provenance must remain readable on desktop and phones');
}

const witnessChroniclePresent = await exists('witness-chronicle.js');
const witnessStorePresent = await exists('witness-store.js');
check(witnessChroniclePresent, 'Missing pure certified Witness Chronicle ledger', 'witness-chronicle.js');
check(witnessStorePresent, 'Missing device-local Witness Chronicle adapter', 'witness-store.js');
if (witnessChroniclePresent) {
  const witnessChronicleSource = await text('witness-chronicle.js');
  const witnessContext = vm.createContext({
    console,
    CYBERLIGA_CONTENT: content,
    CyberligaCharacters: characterCanon,
    encodeURIComponent
  });
  vm.runInContext(await text('named-moments.js'), witnessContext, { filename:'named-moments.js', timeout:2000 });
  vm.runInContext(witnessChronicleSource, witnessContext, { filename:'witness-chronicle.js', timeout:2000 });
  const witnessChronicle = witnessContext.CyberligaWitnessChronicle;
  check(Boolean(witnessChronicle), 'witness-chronicle.js did not expose CyberligaWitnessChronicle');
  check(!/\bMath\.random\b/.test(witnessChronicleSource), 'Witness Chronicle must not consume simulation or presentation randomness');
  check(!/\b(?:document|location|localStorage|sessionStorage|fetch|XMLHttpRequest|requestAnimationFrame|setTimeout|setInterval|performance|Date)\b/.test(witnessChronicleSource), 'Witness Chronicle core must remain independent of DOM, URL, storage, network, scheduling, and clocks');
  if (witnessChronicle) {
    check(Object.isFrozen(witnessChronicle) && witnessChronicle.ready === true, 'Witness Chronicle API must be frozen and bound to canonical identity authorities');
    check(witnessChronicle.limits?.total === 96 && witnessChronicle.limits?.kept === 48, 'Witness Chronicle must cap total and kept device-local receipts');
    check(witnessChronicle.safety?.source === 'local-witness' && witnessChronicle.safety?.official === false && witnessChronicle.safety?.authoritative === false && witnessChronicle.safety?.wagerable === false && witnessChronicle.safety?.settles === false && witnessChronicle.safety?.money === false && witnessChronicle.safety?.prizes === false, 'Witness Chronicle must reject official, authoritative, wager, settlement, money, and prize claims');
    check(typeof witnessChronicle.create === 'function', 'Witness Chronicle API is missing create()');
  }
}
if (witnessStorePresent) {
  const witnessStoreSource = await text('witness-store.js');
  check(/cyberliga_witness_chronicle_v1/.test(witnessStoreSource), 'Witness Store must use an explicit versioned device-local key');
  check(/capturePresented[\s\S]{0,800}Date\.now\(\)/.test(witnessStoreSource), 'Only the storage adapter may timestamp a painted witness');
  check(/cyberliga:witness-change/.test(witnessStoreSource) && /addEventListener\(['"]storage['"]/.test(witnessStoreSource), 'Witness Store must publish same-tab and cross-tab chronology updates');
  check(/source:\s*['"]local-witness['"][\s\S]{0,220}official:\s*false[\s\S]{0,80}authoritative:\s*false[\s\S]{0,80}wagerable:\s*false[\s\S]{0,80}settles:\s*false[\s\S]{0,80}money:\s*false[\s\S]{0,80}prizes:\s*false/.test(witnessStoreSource), 'Witness Store must preserve the explicit non-official no-money/no-prize boundary');
}
for (const arena of arenas) {
  const htmlSource = await text(arena.file);
  const source = arena.file === 'football.html' ? `${htmlSource}\n${await text('football.js')}` : htmlSource;
  check(/broadcast-spine\.css/.test(htmlSource), `${arena.file} must load the shared Match Memory styles`);
  check(/named-moments\.js/.test(htmlSource) && /broadcast-spine\.js/.test(htmlSource), `${arena.file} must load the shared Match Memory runtime`);
  check(htmlSource.indexOf('named-moments.js') < htmlSource.indexOf('broadcast-spine.js'), `${arena.file} must bind deterministic memory before presentation`);
  check(/matchMemory\s*:/.test(source) && /broadcastSpine\s*:/.test(source), `${arena.file} render state must expose Match Memory and broadcast-spine state`);
  check(/witness-chronicle\.js/.test(htmlSource) && /witness-store\.js/.test(htmlSource), arena.file + ' must load the certified Witness Chronicle runtime');
  check(htmlSource.indexOf('named-moments.js') < htmlSource.indexOf('witness-chronicle.js') && htmlSource.indexOf('witness-chronicle.js') < htmlSource.indexOf('witness-store.js') && htmlSource.indexOf('witness-store.js') < htmlSource.indexOf('broadcast-spine.js'), arena.file + ' must bind identity, chronology, storage, then broadcast presentation in order');
  if (arena.file === 'hoops.html' || arena.file === 'hockey.html') {
    const hold = Number(source.match(/const MATCH_MEMORY_FINAL_HOLD\s*=\s*([0-9.]+)/)?.[1]);
    check(Number.isFinite(hold) && hold >= 8.5, `${arena.file} final hold must preserve all three Match Memory cards`);
  }
  if (arena.file === 'hockey.html') {
    check(/const scorer\s*=\s*\(puck\.lastTouch && puck\.lastTouch\.team === team\)\s*\?\s*puck\.lastTouch\s*:\s*null/.test(source), 'Hockey must not invent a named scorer when causal last touch is unavailable');
    check(/if\s*\(scorer\)\s*recordHockeyNamedMoment\('goal',scorer\)/.test(source), 'Hockey must skip athlete Match Memory when a goal scorer is unconfirmed');
  }
  if (arena.file === 'football.html') {
    const queueReplaySource = source.match(/function queueReplay\([^]*?\n\}/)?.[0] || '';
    const maybeStartReplaySource = source.match(/function maybeStartReplay\([^]*?\n\}/)?.[0] || '';
    check(!/recordFootballNamedReplay/.test(queueReplaySource), 'Football must not record a named moment before penalty adjudication and replay selection');
    check(/!selection[^]*?selection\.duration < 0\.45[^]*?!replayBuffer\.start\(selection[^]*?recordFootballNamedReplay\(candidate, \{ recordedFootage: false \}\)[^]*?state\.replayCandidate = null/.test(maybeStartReplaySource), 'Football must retain a surviving official moment as LIVE when replay selection, duration, or start fails');
    check(/replayBuffer\.start\(selection[^]*?recordFootballNamedReplay\(candidate, \{ recordedFootage: true \}\)/.test(maybeStartReplaySource), 'Football may claim recorded footage only after replay playback starts successfully');
  }
  if (arena.file === 'index.html') {
    const canonicalDriverSource = source.match(/function driveCanonicalFrame\([^]*?\n\}/)?.[0] || '';
    check(/state\.mode === 'fulltime'[^]*?broadcastSpine\?\.tick\(presentationDeltaMs\)[^]*?composer\.render\(\)[^]*?return/.test(canonicalDriverSource), 'Canonical soccer must advance the full Match Memory finale after simulation reaches full time');
  }
}

const mythosPresent = await exists('mythos.js');
check(mythosPresent, 'Missing shared mythos engine', 'mythos.js');
if (mythosPresent) {
  const mythosWindow = {};
  evaluateBrowserScript(await text('worlddata.js'), 'worlddata.js', mythosWindow);
  evaluateBrowserScript(await text('mythos.js'), 'mythos.js', mythosWindow);
  const mythos = mythosWindow.CyberligaMythos;
  const supporterContract = 'Fictional supporter picks only. No cash, prizes, deposits, payouts or gameplay influence.';
  check(Boolean(mythos), 'mythos.js did not expose CyberligaMythos');
  if (mythos) {
    check(Object.isFrozen(mythos), 'CyberligaMythos public API must be frozen');
    for (const method of ['epoch', 'resolveSport', 'resolveTeam', 'resolveAthlete', 'athleteProfile', 'matchStory', 'slate', 'world', 'arenaHref']) {
      check(typeof mythos[method] === 'function', `CyberligaMythos is missing ${method}()`);
    }
    check(mythos.epochMs === 15 * 60 * 1000, 'CyberligaMythos must use the shared 15-minute story epoch', String(mythos.epochMs));
    check(mythos.supporterContract === supporterContract, 'CyberligaMythos must publish the fictional supporter contract');

    const scheduleBoundaryBefore = mythos.epoch((14 * 10 - 1) * mythos.epochMs);
    const scheduleBoundaryAfter = mythos.epoch(14 * 10 * mythos.epochMs);
    check(scheduleBoundaryBefore.roundIndex === 13 && scheduleBoundaryAfter.roundIndex === 0, 'Mythos schedule cycles must complete all 14 rounds before rollover');
    check(scheduleBoundaryBefore.seasonId !== scheduleBoundaryAfter.seasonId, 'Mythos schedule seed must rotate only after a complete cycle');
    check(scheduleBoundaryBefore.continuityId === scheduleBoundaryAfter.continuityId, 'Short schedule rollover must not rewrite athlete continuity');

    const mythosWorld = mythos.world(Date.UTC(2030, 0, 15, 12, 7, 30));
    check(mythosWorld?.matches?.length === 24, 'CyberligaMythos must publish all 24 simultaneous matches', String(mythosWorld?.matches?.length));
    check(mythosWorld?.metrics?.athletes === 416, 'CyberligaMythos must preserve all 416 public athletes', String(mythosWorld?.metrics?.athletes));
    check(mythosWorld?.supporterContract === supporterContract, 'Mythos world state must carry the public supporter contract');
    check(mythosWorld?.matches?.every((story) => story.supporterContract === supporterContract), 'Every mythos match must carry the public supporter contract');
    check(mythosWorld?.matches?.every((story) => story.home.pickShare + story.away.pickShare === 100), 'Mythos fictional supporter splits must total 100');
    check(mythosWorld?.matches?.every((story) => !Object.prototype.hasOwnProperty.call(story, 'arenaQuery')), 'Mythos stories must not expose unsupported home/away routing metadata');
    check(!/[?&](?:home|away|league)=/.test(mythos.arenaHref(mythosWorld.matches[0])), 'Mythos arena links must not emit unsupported team query parameters');
    const publicMythosKeys = Object.keys(mythos).join(' ').toLowerCase();
    check(!/\b(?:bet|wager|odds|wallet|deposit|payout|prize)\b/.test(publicMythosKeys), 'CyberligaMythos must not expose cash or prize mechanics');
  }
}

const fanworldFiles = ['fanworld.js','fanworld.css'];
for (const file of fanworldFiles) check(await exists(file), 'Missing shared supporter experience artifact', file);
const athleteMomentsPresent = await exists('athlete-moments.js');
check(athleteMomentsPresent, 'Missing shared live athlete moments model', 'athlete-moments.js');
if (athleteMomentsPresent) {
  const momentWindow = {};
  evaluateBrowserScript(await text('worlddata.js'), 'worlddata.js', momentWindow);
  evaluateBrowserScript(await text('athlete-moments.js'), 'athlete-moments.js', momentWindow);
  const moments = momentWindow.CyberligaAthleteMoments;
  check(Boolean(moments), 'athlete-moments.js did not expose CyberligaAthleteMoments');
  if (moments) {
    check(Object.isFrozen(moments), 'CyberligaAthleteMoments public API must be frozen');
    for (const method of ['create','normalizeLive','normalizeStoredMoment','selectForFollows','followMatch']) {
      check(typeof moments[method] === 'function', `CyberligaAthleteMoments is missing ${method}()`);
    }
    check(moments.safety?.fanCallSettlement === false && moments.safety?.realMoney === false && moments.safety?.prizes === false, 'Athlete moments must publish the read-only no-money/no-prize boundary');
  }
}
for (const [surface, source] of [['Home',worldSource],['League HQ',atlasSource],['Athlete Files',`${playerSource}\n${playerScript}`]]) {
  check(source.includes('characterdata.js'), `${surface} must load the Founding 12 canon`);
  check(source.includes('mythos.js'), `${surface} must load the shared mythos engine`);
  check(source.includes('athlete-moments.js'), `${surface} must load the shared live athlete moments model`);
  check(source.includes('fanworld.js') && source.includes('fanworld.css'), `${surface} must load My Signal supporter UI`);
}
for (const [surface, source] of [['Home',worldSource],['League HQ',atlasSource],['Athlete Files',playerSource]]) {
  check(source.includes('named-moments.js') && source.includes('witness-chronicle.js') && source.includes('witness-store.js'), surface + ' must load the certified device-local Witness Chronicle');
  check(source.indexOf('named-moments.js') < source.indexOf('witness-chronicle.js') && source.indexOf('witness-chronicle.js') < source.indexOf('witness-store.js') && source.indexOf('witness-store.js') < source.indexOf('fanworld.js'), surface + ' must bind identity, chronology, storage, then supporter UI in order');
}
const athleteMomentSource = await text('athlete-moments.js');
check(/local-fan-signal/.test(fanworldSource), 'My Signal calls must remain explicitly device-local');
check(/status:\s*['"]open['"][\s\S]{0,120}resolution:\s*null[\s\S]{0,80}points:\s*null/.test(fanworldSource), 'Fan calls must remain unresolved until an authoritative event stream exists');
check(/NO MONEY[\s\S]{0,80}NO PRIZE[\s\S]{0,140}NOT SETTLED AGAINST (?:THIS )?CLIENT SIMULATION/.test(fanworldSource), 'My Signal must visibly disclose its free, unresolved supporter contract');
check(/SERVER-PUBLISHED MATCH MOMENTS[\s\S]{0,120}DOES NOT SCORE OR SETTLE FAN CALLS[\s\S]{0,80}NO MONEY[\s\S]{0,30}NO PRIZE/.test(fanworldSource), 'Canonical live moments must retain the watching-only no-settlement boundary');
check(/DETERMINISTIC FALLBACK MOMENTS[\s\S]{0,120}NOT A RECORDED OR AUTHORITATIVE LIVE RESULT[\s\S]{0,140}NO MONEY[\s\S]{0,30}NO PRIZE/.test(fanworldSource), 'Fallback live moments must reject authoritative-result language');
check(/scoresCalls:false[\s\S]{0,40}settlesCalls:false[\s\S]{0,40}money:false[\s\S]{0,30}prizes:false/.test(fanworldSource), 'render_game_to_text must publish the live-moment safety contract');
check(/LAST SERVER SNAPSHOT/.test(fanworldSource) && /LAST FALLBACK SNAPSHOT/.test(fanworldSource), 'Stale live moments must preserve snapshot provenance');
check(/data-fw-moment-id/.test(fanworldSource) && /dataset\.renderSignature/.test(fanworldSource) && /preventScroll:true/.test(fanworldSource), 'Live-moment polling must preserve focus and scroll when card content is unchanged or updated');
check(/addEventListener\(['"]pagehide['"][\s\S]{0,300}refreshing\s*=\s*false[\s\S]{0,160}addEventListener\(['"]pageshow['"]/.test(fanworldSource), 'Live-moment polling must recover cleanly from BFCache pagehide/pageshow');
check(/MATCHUP SIM/.test(fanworldSource), 'Moment arena links must visibly identify autonomous matchup simulations');
check(/source\s*===\s*['"]supabase['"]/.test(athleteMomentSource), 'Canonical live-moment provenance must use the explicit trusted-source allowlist');
check(/data-fw-action=["']share-story["']/.test(fanworldSource) && /OPEN 12-SECOND CLIP/.test(fanworldSource), 'Fixture stories must expose both share and 12-second clip actions');
check(/function storyClipUrl\s*\([\s\S]{0,500}clip\.html\?/.test(fanworldSource), 'Shared fixture stories must preserve their context into Clip Director');
check(/match:\s*story\.key[\s\S]{0,80}story:\s*story\.id[\s\S]{0,80}view:\s*['"]1['"]/.test(fanworldSource), 'Shared clip URLs must carry permanent match/story seeds into passive viewer mode');
check(/navigator\.share/.test(fanworldSource) && /navigator\.clipboard/.test(fanworldSource) && /fallbackCopy/.test(fanworldSource), 'Story sharing must support native share, clipboard, and fallback copy paths');
check(/\.fw-call-note\s*\{[^}]*rgba\(255,255,255,\.68\)[^}]*8px/.test(fanworldStyles), 'Free-call disclosure must remain legible at the point of action');
check(/\.fw-drawer-foot\s*\{[^}]*rgba\(255,255,255,\.68\)[^}]*8px/.test(fanworldStyles), 'Supporter passport disclosure must remain legible');
check(/@media \(max-width: 760px\)[\s\S]*\.fw-moment-actions a\s*\{[^}]*min-height:\s*44px/.test(fanworldStyles), 'Moment actions must retain 44px mobile touch targets');

check(/MY NIGHT/.test(fanworldSource) && /DEVICE-LOCAL · NOT OFFICIAL/.test(fanworldSource), 'My Signal must expose My Night with an explicit non-official device-local boundary');
check(/data-fw-action="keep-witness"/.test(fanworldSource) && /data-fw-action="remove-witness"/.test(fanworldSource) && /12S CONCEPT/.test(fanworldSource), 'Witness receipts must expose keep, remove, Athlete File, and non-official concept routes');
check(/WitnessStore\.markRead\(\)/.test(fanworldSource) && /witnessUnreadAtOpen/.test(fanworldSource), 'Opening My Signal must clear unread state without erasing the current-open NEW labels');
check(/YOUR WITNESS CHRONICLE/.test(fanworldSource) && /fw-player-chronicle/.test(fanworldSource) && /teammates\.before\(section\)/.test(fanworldSource), 'Athlete Files must insert the device-local Witness Chronicle before teammates');
check(/changesCareerStats:\s*false[\s\S]{0,80}scoresCalls:\s*false[\s\S]{0,80}wagerable:\s*false[\s\S]{0,80}settles:\s*false[\s\S]{0,80}money:\s*false[\s\S]{0,80}prizes:\s*false/.test(fanworldSource), 'Witness render state must reject career-stat, fan-call, wager, settlement, money, and prize effects');
const witnessActionSource = fanworldSource.match(/if \(action === 'keep-witness'\)[\s\S]*?if \(action === 'refresh-live'\)/)?.[0] || '';
check(Boolean(witnessActionSource) && !/(?:fan\.xp|award|points\s*[+]=)/i.test(witnessActionSource), 'Keeping or removing a witness receipt must never award XP or points');
check(/function restoreWitnessFocus\s*\([\s\S]{0,1800}preventScroll:true/.test(fanworldSource) && /keepFocusRequest\s*=\s*witnessFocusRequest\(target,false\)[\s\S]{0,300}scheduleWitnessRender\(keepFocusRequest\)/.test(witnessActionSource) && /removeFocusRequest\s*=\s*witnessFocusRequest\(target,true\)[\s\S]{0,400}scheduleWitnessRender\(removeFocusRequest\)/.test(witnessActionSource), 'Witness keep/remove rerenders must restore deterministic keyboard focus');
check(!/renderDrawer\(\)|renderPlayerChronicle\(\)/.test(witnessActionSource), 'Witness keep/remove actions must use the coalesced change-event render path');
check(/focusRequest\.scope === 'drawer' \|\| focusRequest\.scope === 'player'/.test(fanworldSource) && /addEventListener\('cyberliga:witness-change',function \(\) \{ scheduleWitnessRender\(\); \}\)/.test(fanworldSource), 'Witness change events must not replace a pending action-focus request with the event object');
check(/\.fw-witness-actions\s*>\s*\*\s*\{[^}]*min-height:\s*44px/.test(fanworldStyles), 'Witness receipt actions must retain 44px touch targets');
check(/@media \(max-width: 760px\)[\s\S]*\.fw-player-chronicle-list\s*\{\s*grid-template-columns:\s*1fr/.test(fanworldStyles), 'Athlete witness chronology must collapse to one contained phone column');

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
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'vendor' || entry.name === '.playwright-cli' || entry.name === 'football-artifacts' || entry.name === 'output') continue;
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
  console.log(`Cyberliga verification passed: ${checks} checks across 6 arenas, 6 leagues, 48 teams, 416 athletes, routes, schedules, hooks, deployment config, and local assets.`);
}
