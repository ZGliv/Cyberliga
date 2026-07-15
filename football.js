import * as THREE from 'three';
import { buildBlobRig, classicPlayerColor } from './blobrig.js';
import { FootballAudioDirector, FootballReplayBuffer } from './footballpresentation.js';
import { createFootballVenueIdentity, footballClubEquipmentPalette } from './spectator-football-identity.js';
import {
  chooseDefensiveCall,
  chooseOffensiveCall,
  createCoordinatorMemory,
  derivePlayerTraits,
  deriveTeamDNA,
  evaluateQBProgression,
  explainPlayCause,
  rankRunLanes,
  recordMatchupWin,
  recordPlayOutcome,
  updatePlayerCondition,
} from './footballbrain.js';
import {
  PLAY_CLOCK_SECONDS,
  applyTimeoutDecision,
  createDeadBallClockState,
  decideLateGameTimeout,
  enforcePenalty,
  evaluateLivePenalties,
  evaluatePreSnapPenalties,
  formatPenaltyCall,
  resetDeadBallClock,
} from './footballrules.js';

const $ = (id) => document.getElementById(id);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
const smoothstep = (t) => { const k = clamp(t, 0, 1); return k * k * (3 - 2 * k); };
const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const distance2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const ordinal = (n) => n === 1 ? '1ST' : n === 2 ? '2ND' : n === 3 ? '3RD' : `${n}TH`;
const lineRoles = new Set(['LT', 'LG', 'C', 'RG', 'RT', 'LDE', 'DT', 'NT', 'RDE']);
const frontRoles = new Set(['LDE', 'DT', 'NT', 'RDE']);

function hash32(text) {
  let hash = 2166136261 >>> 0;
  for (const char of String(text)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

let randomState = 1;
function seedRandom(value) { randomState = hash32(value) || 1; }
function random() {
  randomState |= 0;
  randomState = randomState + 0x6d2b79f5 | 0;
  let value = Math.imul(randomState ^ randomState >>> 15, 1 | randomState);
  value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
  return ((value ^ value >>> 14) >>> 0) / 4294967296;
}
function gaussian() { return random() + random() + random() - 1.5; }

const query = new URLSearchParams(location.search);
const fixtureNumber = Number(query.get('fixture') ?? localStorage.getItem('cl_football_fx') ?? 0);
const fixture = ((Number.isFinite(fixtureNumber) ? Math.trunc(fixtureNumber) : 0) % 4 + 4) % 4;
const content = window.CYBERLIGA_CONTENT;
if (!content) throw new Error('Cyberliga world data did not load.');
const sport = content.getSport('american-football');
const teams = [sport.teams[fixture * 2], sport.teams[fixture * 2 + 1]];
window.CyberligaEstablishing?.show?.({
  sportId: 'american-football',
  homeTeam: teams[0],
  awayTeam: teams[1],
  duration: 1200,
});
const teamDNA = teams.map((team) => deriveTeamDNA(team));
let coordinatorMemory = teams.map((team) => createCoordinatorMemory(team.id));
localStorage.setItem('cl_football_fx', String((fixture + 1) % 4));
seedRandom(`${teams[0].id}|${teams[1].id}|gridiron-real-v1|${query.get('seed') || 'broadcast'}`);

const HISTORY_KEY = 'cl_football_history_v2';
function loadLeagueHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || 'null');
    if (parsed && parsed.version === 2 && Array.isArray(parsed.games)) return parsed;
  } catch {}
  return { version: 2, games: [], teams: {}, players: {} };
}
const leagueHistory = loadLeagueHistory();
const rivalryKey = [teams[0].id, teams[1].id].sort().join('|');
const priorMeetings = leagueHistory.games.filter((game) => game.rivalryKey === rivalryKey);

function pregameStory() {
  if (!priorMeetings.length) return `${teams[0].city} and ${teams[1].city} open a new chapter of ${teams[0].rivalry || 'The Sunday Animal'}.`;
  const homeWins = priorMeetings.filter((game) => game.winnerId === teams[0].id).length;
  const awayWins = priorMeetings.filter((game) => game.winnerId === teams[1].id).length;
  const last = priorMeetings[priorMeetings.length - 1];
  const leader = homeWins === awayWins ? 'The series is level' : `${homeWins > awayWins ? teams[0].code : teams[1].code} leads the recorded series ${Math.max(homeWins, awayWins)}-${Math.min(homeWins, awayWins)}`;
  return `${leader}. Last meeting: ${last.homeCode} ${last.score[0]}, ${last.awayCode} ${last.score[1]}.`;
}

function emptyTeamStats() {
  return { plays: 0, firstDowns: 0, rushes: 0, rushYards: 0, passAttempts: 0, completions: 0, passYards: 0, sacksAllowed: 0, turnovers: 0, penalties: 0, penaltyYards: 0, explosivePlays: 0, thirdDownAttempts: 0, thirdDownConversions: 0, possessionSeconds: 0 };
}
function emptyPlayerStats(player) {
  return { id: player.athlete.id, name: player.name, teamId: teams[player.teamIndex].id, role: player.role, passAttempts: 0, completions: 0, passYards: 0, passTD: 0, interceptions: 0, rushes: 0, rushYards: 0, rushTD: 0, targets: 0, receptions: 0, receivingYards: 0, receivingTD: 0, tackles: 0, sacks: 0, forcedFumbles: 0, takeaways: 0 };
}
const teamGameStats = [emptyTeamStats(), emptyTeamStats()];
const playerGameStats = new Map();
const playerConditions = new Map();

const OFFENSE_ROLES = ['QB', 'RB', 'X', 'TE', 'Z', 'SLOT', 'LT', 'LG', 'C', 'RG', 'RT'];
const DEFENSE_ROLES = ['WILL', 'FS', 'LDE', 'DT', 'NT', 'RDE', 'MIKE', 'SAM', 'LCB', 'RCB', 'SS'];
const OFFENSE_INDEX = [0, 1, 2, 3, 6, 7, 8, 9, 10, 11, 12];
const DEFENSE_INDEX = [17, 5, 13, 14, 15, 16, 4, 18, 19, 20, 21];
const QUARTER_SECONDS = 300;
const CLOCK_RATE = 4.1;
// The establishing card fades for 380ms after its 1.2s hold. A readable 1.8s
// autonomous cadence guarantees the card is gone before the first (or any) snap.
const PREPLAY_SECONDS = 1.8;
const PREPLAY_MOVE_SECONDS = 0.92;
const DEAD_SECONDS = 1.1;
const GRAVITY = 10.5;
const GOAL_PLANE = 110;
const CROSSBAR_HEIGHT = 3.33;
const UPRIGHT_HALF = 3.08;
const BALL_RADIUS = 0.18;

const PLAYS = {
  'INSIDE ZONE': { kind: 'run', family: 'inside', formation: '11 PERSONNEL · GUN', carrier: 'RB', lane: 2.5, complements: ['PLAY ACTION CROSS'] },
  'OUTSIDE ZONE': { kind: 'run', family: 'outside', formation: '11 PERSONNEL · SINGLEBACK', carrier: 'RB', lane: 15, complements: ['RB SCREEN'] },
  'POWER': { kind: 'run', family: 'power', formation: '12 PERSONNEL · PISTOL', carrier: 'RB', lane: -5, complements: ['PLAY ACTION CROSS'] },
  'COUNTER GT': { kind: 'run', family: 'counter', formation: '11 PERSONNEL · PISTOL', carrier: 'RB', lane: -8, complements: ['PLAY ACTION CROSS'] },
  'JET SWEEP': { kind: 'run', family: 'outside', formation: '11 PERSONNEL · GUN MOTION', carrier: 'SLOT', lane: 19, complements: ['MESH'] },
  'READ OPTION': { kind: 'option', family: 'option', formation: '11 PERSONNEL · PISTOL', carrier: 'RB', lane: 9, complements: ['QUICK SLANTS'] },
  'QUICK SLANTS': { kind: 'pass', family: 'quick', formation: '11 PERSONNEL · GUN', release: 0.72, maxHold: 2.25, reads: ['SLOT', 'X', 'Z', 'RB'] },
  'MESH': { kind: 'pass', family: 'man-beater', formation: '11 PERSONNEL · GUN', release: 0.9, maxHold: 2.9, reads: ['SLOT', 'TE', 'X', 'RB'] },
  'PLAY ACTION CROSS': { kind: 'pass', family: 'play-action', formation: '12 PERSONNEL · PISTOL', release: 1.25, maxHold: 3.25, reads: ['TE', 'X', 'SLOT', 'RB'], playAction: true },
  'FOUR VERTICALS': { kind: 'pass', family: 'shot', formation: '10 PERSONNEL · EMPTY', release: 1.35, maxHold: 3.45, reads: ['SLOT', 'TE', 'X', 'Z'], deep: true },
  'FLOOD CONCEPT': { kind: 'pass', family: 'zone-beater', formation: '12 PERSONNEL · BOOT', release: 1.08, maxHold: 3.05, reads: ['Z', 'TE', 'SLOT', 'RB'], playAction: true },
  'SEAM SHOT': { kind: 'pass', family: 'shot', formation: '11 PERSONNEL · GUN', release: 1.18, maxHold: 3.2, reads: ['TE', 'SLOT', 'X', 'RB'], deep: true },
  'RB SCREEN': { kind: 'pass', family: 'screen', formation: '11 PERSONNEL · GUN', release: 1.12, maxHold: 2.55, reads: ['RB', 'SLOT'], screen: true },
  'FIELD GOAL': { kind: 'fieldGoal', formation: 'FIELD GOAL UNIT' },
  'PUNT': { kind: 'punt', formation: 'PUNT UNIT' },
};

const DEFENSES = {
  'COVER 3': { family: 'zone', shell: 'single-high', rush: ['LDE', 'DT', 'NT', 'RDE'], disguise: 0.25 },
  'COVER 2 MAN': { family: 'man', shell: 'two-high', rush: ['LDE', 'DT', 'NT', 'RDE'], disguise: 0.18 },
  QUARTERS: { family: 'zone', shell: 'two-high', rush: ['LDE', 'DT', 'NT', 'RDE'], disguise: 0.38 },
  'NICKEL FIRE': { family: 'blitz', shell: 'two-high', rush: ['LDE', 'DT', 'NT', 'RDE', 'SAM'], disguise: 0.82 },
  'BEAR FRONT': { family: 'run-front', shell: 'single-high', rush: ['LDE', 'DT', 'NT', 'RDE', 'MIKE'], disguise: 0.24 },
  'COVER 1 ROBBER': { family: 'man', shell: 'single-high', rush: ['LDE', 'DT', 'NT', 'RDE'], disguise: 0.63 },
  'GOAL LINE': { family: 'run-front', shell: 'zero-high', rush: ['LDE', 'DT', 'NT', 'RDE', 'WILL', 'MIKE'], disguise: 0.08 },
};

const ROUTES = {
  'QUICK SLANTS': {
    X: [[0, -20], [5, -20], [13, -5]], Z: [[0, 20], [5, 20], [13, 5]],
    SLOT: [[-1, -11], [6, -10], [11, 0]], TE: [[-1, 9], [6, 8], [10, 2]], RB: [[-7, 2], [2, 8], [6, 10]],
  },
  MESH: {
    X: [[0, -20], [9, -18], [16, 4], [23, 9]], Z: [[0, 20], [9, 18], [16, -4], [23, -9]],
    SLOT: [[-1, -11], [7, -10], [13, 3]], TE: [[-1, 9], [7, 8], [13, -3]], RB: [[-7, 2], [3, -7], [8, -9]],
  },
  'PLAY ACTION CROSS': {
    X: [[0, -20], [10, -20], [24, 5]], Z: [[0, 20], [14, 20], [30, 16]],
    SLOT: [[-1, -11], [10, -9], [23, -3]], TE: [[-1, 9], [8, 8], [15, 0]], RB: [[-7, 2], [-5, 0]],
  },
  'FOUR VERTICALS': {
    X: [[0, -21], [30, -18]], Z: [[0, 21], [30, 18]], SLOT: [[-1, -9], [29, -5]], TE: [[-1, 9], [28, 5]], RB: [[-7, 2], [4, 9]],
  },
  'FLOOD CONCEPT': {
    X: [[0, -20], [16, -19]], Z: [[0, 20], [8, 18], [18, 12], [25, 11]],
    SLOT: [[-1, -11], [7, -9], [14, -3]], TE: [[-1, 9], [7, 8], [12, 14]], RB: [[-7, 2], [-3, -2], [5, -7]],
  },
  'SEAM SHOT': {
    X: [[0, -20], [17, -18], [25, -12]], Z: [[0, 20], [14, 19]],
    SLOT: [[-1, -11], [22, -7]], TE: [[-1, 9], [24, 4]], RB: [[-7, 2], [2, 10], [7, 12]],
  },
  'RB SCREEN': {
    X: [[0, -20], [15, -20]], Z: [[0, 20], [16, 20]], SLOT: [[-1, -11], [11, -9]], TE: [[-1, 9], [8, 8]],
    RB: [[-7, 2], [-5, 8], [4, 13], [13, 17]],
  },
};

const state = {
  phase: 'preplay', playStage: 'huddle', t: 0, playTime: 0, paused: false, gameOver: false, historySaved: false,
  quarter: 1, clock: QUARTER_SECONDS, score: [0, 0], possession: 0,
  down: 1, toGo: 10, ballSpot: 25, play: '', defense: 'COVER 3',
  playClock: 25, timeouts: [3, 3], clockRunning: false,
  drivePlays: 0, driveYards: 0, driveStart: 25, firstDowns: 0,
  carrierId: null, contact: null, catchBeat: null, pending: null, deadHold: DEAD_SECONDS,
  formationTransition: false, hideDeadBall: false,
  returnType: null,
  currentSnap: null, lastSnap: null, flag: null, replayCandidate: null, replayStarted: false, replayActive: false,
  qbReadIndex: 0, qbDecision: null, offenseDecision: null, defenseDecision: null, adjustment: '', story: pregameStory(),
  headline: 'Opening drive', detail: 'The offense is breaking the huddle.', lastEvent: 'OPENING KICKOFF TOUCHBACK', events: [],
  wind: 0, testCatchOutcome: null, testTackleOutcome: null, testKick: null, testPenalty: null,
  userJukes: 0, tackles: 0, brokenTackles: 0, completedPasses: 0,
};

const driveDirection = () => state.possession === 0 ? 1 : -1;
const worldX = (gameX) => (gameX - 50) * driveDirection();
const worldFacing = (angle) => angle * driveDirection();

const ball = {
  mode: 'dead', ownerId: null, intendedId: null, lastTouchId: null,
  x: state.ballSpot - 0.25, y: BALL_RADIUS, z: 0,
  vx: 0, vy: 0, vz: 0, spin: 0, flightTime: 0, targetTime: 0,
  kick: null, ruling: null,
};

const ROTATING_KICK_TYPES = new Set(['FIELD GOAL', 'PAT', 'KICKOFF']);
function ballRotationAllowed(ballState = ball) {
  const kickType = ballState.kickType || ballState.kick?.type || null;
  return ballState.mode === 'kick' && ROTATING_KICK_TYPES.has(kickType);
}
function enforceBallRotationRule() {
  if (!ballRotationAllowed(ball)) ball.spin = 0;
}

let players = [];
let views = new Map();
let blockPairs = [];
let playSerial = 0;
let manualMode = false;
let momentTimer = 0;
let crowdHeat = 0;
let impactPulse = 0;
let presentationTime = 0;
const audioDirector = new FootballAudioDirector({
  enabled: false,
  seed: hash32(`${teams[0].id}|${teams[1].id}|football-audio`),
  masterVolume: 0.68,
  crowdVolume: 0.4,
  effectsVolume: 0.82,
});
const replayBuffer = new FootballReplayBuffer({ sampleHz: 24, durationSeconds: 11, before: 3.25, after: 0.42 });
const input = { left: false, right: false, up: false, down: false, juke: false };

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: innerWidth >= 700, powerPreference: 'high-performance' });
} catch (error) {
  $('loading').classList.add('ready');
  $('renderError').hidden = false;
  $('renderError').querySelector('span').textContent = 'This device could not create the 3D field. Reload the arena after checking WebGL support.';
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.1 : 1.25));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.13;
renderer.shadowMap.enabled = innerWidth >= 700;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute('aria-label', 'Three-dimensional sideline broadcast of a live American football game');
$('stadium').append(renderer.domElement);

renderer.domElement.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  $('renderError').hidden = false;
  $('renderError').querySelector('span').textContent = 'The 3D context was lost. Reload the arena to rebuild the broadcast.';
});

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030a0f);
scene.fog = new THREE.Fog(0x07131a, 95, 215);
const camera = new THREE.PerspectiveCamera(39, innerWidth / innerHeight, 0.1, 280);
const cameraTarget = new THREE.Vector3();
let cameraMode = 'line';
let cameraReady = false;

scene.add(new THREE.HemisphereLight(0xcdf9ff, 0x07170f, 1.55));
const moon = new THREE.DirectionalLight(0xf2ffff, 2.4);
moon.position.set(-34, 52, 31);
moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024);
moon.shadow.camera.left = -70;
moon.shadow.camera.right = 70;
moon.shadow.camera.top = 45;
moon.shadow.camera.bottom = -45;
scene.add(moon);

for (const z of [-48, 48]) {
  for (const x of [-54, 0, 54]) {
    const lamp = new THREE.SpotLight(0xe4fbff, 135, 125, 0.68, 0.48, 1.3);
    lamp.position.set(x, 34, z);
    lamp.target.position.set(x * 0.5, 0, 0);
    scene.add(lamp, lamp.target);
  }
}

const stars = [];
for (let i = 0; i < 380; i += 1) {
  const angle = i * 2.399, radius = 90 + (i % 31) * 3.4;
  stars.push(Math.cos(angle) * radius, 42 + (i % 43) * 2.2, Math.sin(angle) * radius);
}
const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xb9e8ff, size: 0.42, transparent: true, opacity: 0.66 })));

const field = new THREE.Group();
scene.add(field);
const apron = new THREE.Mesh(new THREE.PlaneGeometry(142, 78), new THREE.MeshStandardMaterial({ color: 0x061817, roughness: 0.98 }));
apron.rotation.x = -Math.PI / 2;
apron.position.y = -0.05;
apron.receiveShadow = true;
field.add(apron);

const turf = new THREE.Mesh(new THREE.PlaneGeometry(120, 53.3), new THREE.MeshStandardMaterial({ color: 0x174f38, roughness: 0.93 }));
turf.rotation.x = -Math.PI / 2;
turf.position.x = 10;
turf.receiveShadow = true;
field.add(turf);

for (let index = 0; index < 12; index += 1) {
  const stripe = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 53.05),
    new THREE.MeshBasicMaterial({ color: index % 2 ? 0x174934 : 0x1b5a40, transparent: true, opacity: 0.52 }),
  );
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.set(index * 10 - 45, 0.012, 0);
  field.add(stripe);
}

const endzoneMaterials = [0, 1].map((index) => new THREE.MeshStandardMaterial({
  color: teams[index].colors.primary, emissive: teams[index].colors.primary, emissiveIntensity: 0.16, roughness: 0.82,
}));
const leftEndzone = new THREE.Mesh(new THREE.PlaneGeometry(10, 53.3), endzoneMaterials[0]);
leftEndzone.rotation.x = -Math.PI / 2;
leftEndzone.position.set(-55, 0.021, 0);
field.add(leftEndzone);
const rightEndzone = new THREE.Mesh(new THREE.PlaneGeometry(10, 53.3), endzoneMaterials[1]);
rightEndzone.rotation.x = -Math.PI / 2;
rightEndzone.position.set(55, 0.021, 0);
field.add(rightEndzone);

const whiteLineMaterial = new THREE.MeshBasicMaterial({ color: 0xeafff8, transparent: true, opacity: 0.72, depthWrite: false });
function fieldLine(gameX, width = 0.09, length = 53.1, material = whiteLineMaterial) {
  const line = new THREE.Mesh(new THREE.PlaneGeometry(width, length), material);
  line.rotation.x = -Math.PI / 2;
  line.position.set(gameX - 50, 0.032, 0);
  field.add(line);
  return line;
}
for (let yard = 0; yard <= 100; yard += 5) fieldLine(yard, yard % 10 === 0 ? 0.13 : 0.055);
for (const sideline of [-26.58, 26.58]) {
  const line = new THREE.Mesh(new THREE.PlaneGeometry(100, 0.13), whiteLineMaterial);
  line.rotation.x = -Math.PI / 2;
  line.position.set(0, 0.034, sideline);
  field.add(line);
}

const hashGeometry = new THREE.PlaneGeometry(0.11, 0.72);
const hashes = new THREE.InstancedMesh(hashGeometry, whiteLineMaterial, 200);
const dummy = new THREE.Object3D();
let hashIndex = 0;
for (let yard = 1; yard < 100; yard += 1) {
  for (const z of [-9.2, 9.2]) {
    dummy.position.set(yard - 50, 0.035, z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    hashes.setMatrixAt(hashIndex++, dummy.matrix);
  }
}
field.add(hashes);

function canvasTexture(width, height, painter) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  painter(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function fieldLabelMesh(text, color = '#eafff8') {
  const texture = canvasTexture(256, 128, (context, width, height) => {
    context.clearRect(0, 0, width, height);
    context.fillStyle = color;
    context.font = '900 80px Orbitron, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, width / 2, height / 2 + 3);
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.6), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

for (let yard = 10; yard < 100; yard += 10) {
  const text = String(yard <= 50 ? yard : 100 - yard);
  for (const z of [-19.3, 19.3]) {
    const label = fieldLabelMesh(text, 'rgba(235,255,248,.7)');
    label.rotation.z = z < 0 ? Math.PI / 2 : -Math.PI / 2;
    label.position.set(yard - 50, 0.045, z);
    field.add(label);
  }
}

const centerTexture = canvasTexture(512, 512, (context, width, height) => {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, teams[0].colors.primary);
  gradient.addColorStop(1, teams[1].colors.primary);
  context.fillStyle = 'rgba(2,10,13,.88)';
  context.beginPath();
  context.moveTo(width / 2, 20);
  context.lineTo(width - 50, 120);
  context.lineTo(width - 75, height - 95);
  context.lineTo(width / 2, height - 18);
  context.lineTo(75, height - 95);
  context.lineTo(50, 120);
  context.closePath();
  context.fill();
  context.lineWidth = 24;
  context.strokeStyle = gradient;
  context.stroke();
  context.fillStyle = '#fff';
  context.font = '900 96px Orbitron, sans-serif';
  context.textAlign = 'center';
  context.fillText('CYBER', width / 2, 235);
  context.fillStyle = '#65ffd4';
  context.fillText('LIGA', width / 2, 340);
});
const centerLogo = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), new THREE.MeshBasicMaterial({ map: centerTexture, transparent: true, depthWrite: false }));
centerLogo.rotation.x = -Math.PI / 2;
centerLogo.position.y = 0.044;
field.add(centerLogo);

function createGoalpost(gameX) {
  const group = new THREE.Group();
  group.position.x = gameX - 50;
  const material = new THREE.MeshStandardMaterial({ color: 0xffd45d, emissive: 0xffa824, emissiveIntensity: 0.5, metalness: 0.35, roughness: 0.28 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, CROSSBAR_HEIGHT, 10), material);
  stem.position.set(0, CROSSBAR_HEIGHT / 2, 0);
  const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, UPRIGHT_HALF * 2, 10), material);
  crossbar.rotation.x = Math.PI / 2;
  crossbar.position.y = CROSSBAR_HEIGHT;
  const left = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 8, 10), material);
  const right = left.clone();
  left.position.set(0, CROSSBAR_HEIGHT + 4, -UPRIGHT_HALF);
  right.position.set(0, CROSSBAR_HEIGHT + 4, UPRIGHT_HALF);
  group.add(stem, crossbar, left, right);
  field.add(group);
  return group;
}
const leftGoalpost = createGoalpost(-10);
const rightGoalpost = createGoalpost(GOAL_PLANE);

const standMaterial = new THREE.MeshStandardMaterial({ color: 0x11232d, roughness: 0.8, metalness: 0.12 });
for (const side of [-1, 1]) {
  for (let row = 0; row < 13; row += 1) {
    const stand = new THREE.Mesh(new THREE.BoxGeometry(138, 0.65, 1.28), standMaterial);
    stand.position.set(5, 0.32 + row * 0.68, side * (29.5 + row * 1.08));
    field.add(stand);
  }
}
for (const end of [-1, 1]) {
  for (let row = 0; row < 9; row += 1) {
    const stand = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.65, 64), standMaterial);
    stand.position.set(end < 0 ? -63 - row * 1.05 : 73 + row * 1.05, 0.32 + row * 0.68, 0);
    field.add(stand);
  }
}

const crowdCount = innerWidth < 700 ? 760 : 1420;
const crowdBodyGeometry = new THREE.CapsuleGeometry(0.22, 0.36, 3, 6);
const crowdHeadGeometry = new THREE.SphereGeometry(0.19, 6, 5);
const crowdMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
const crowdHeadMaterial = new THREE.MeshBasicMaterial({ color: 0xb8aaa0, vertexColors: true });
const crowdBodies = new THREE.InstancedMesh(crowdBodyGeometry, crowdMaterial, crowdCount);
const crowdHeads = new THREE.InstancedMesh(crowdHeadGeometry, crowdHeadMaterial, crowdCount);
const crowdBase = [];
for (let index = 0; index < crowdCount; index += 1) {
  const sideBand = index % 4;
  const row = Math.floor(index / Math.max(1, Math.floor(crowdCount / 44))) % 13;
  const along = ((index * 7.73) % 136) - 63;
  let x = along + 5;
  let z = (sideBand < 2 ? -1 : 1) * (30.1 + row * 1.08);
  if (index % 11 === 0) { x = index % 22 === 0 ? -64 - row : 74 + row; z = ((index * 3.37) % 56) - 28; }
  const y = 1.05 + row * 0.68;
  const scale = 0.82 + (index % 5) * 0.045;
  crowdBase.push({ x, y, z, phase: (index * 1.71) % (Math.PI * 2), scale });
  dummy.position.set(x, y, z); dummy.scale.setScalar(scale); dummy.rotation.set(0, z < 0 ? 0 : Math.PI, 0); dummy.updateMatrix();
  crowdBodies.setMatrixAt(index, dummy.matrix);
  dummy.position.y = y + 0.53 * scale; dummy.scale.setScalar(scale); dummy.updateMatrix();
  crowdHeads.setMatrixAt(index, dummy.matrix);
  const pocket = index % 9 < 2 ? teams[0].colors.primary : index % 9 < 4 ? teams[1].colors.primary : ['#71828d', '#c5b26e', '#5c697b'][index % 3];
  crowdBodies.setColorAt(index, new THREE.Color(pocket));
  crowdHeads.setColorAt(index, new THREE.Color(index % 4 ? 0xb48c70 : 0x7a5540));
}
crowdBodies.instanceColor.needsUpdate = true;
crowdHeads.instanceColor.needsUpdate = true;
field.add(crowdBodies, crowdHeads);

// The venue now shares the exact city/club identity used by League HQ. Its architecture,
// signage and crowd-light ritual are presentation only; the deterministic game state is
// untouched, while the home field finally reads as a place rather than a generic bowl.
const venueIdentity = createFootballVenueIdentity({ scene, teams });

const losMaterial = new THREE.MeshBasicMaterial({ color: 0x42bfff, transparent: true, opacity: 0.82, depthWrite: false });
const gainMaterial = new THREE.MeshBasicMaterial({ color: 0xffd45d, transparent: true, opacity: 0.88, depthWrite: false });
const lineOfScrimmage = fieldLine(state.ballSpot, 0.22, 53.1, losMaterial);
const lineToGain = fieldLine(state.ballSpot + state.toGo, 0.18, 53.1, gainMaterial);

const routeGroup = new THREE.Group();
scene.add(routeGroup);
function clearRoutes() {
  while (routeGroup.children.length) {
    const child = routeGroup.children.pop();
    child.geometry?.dispose();
    child.material?.dispose();
  }
}

const football = new THREE.Mesh(
  new THREE.SphereGeometry(BALL_RADIUS, 16, 10),
  new THREE.MeshStandardMaterial({ color: 0x9f522b, emissive: 0x431507, emissiveIntensity: 0.32, roughness: 0.46, transparent: true }),
);
football.scale.set(1.9, 1, 1);
football.castShadow = true;
const laces = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
laces.position.y = BALL_RADIUS * 0.93;
football.add(laces);
scene.add(football);

const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.36, depthWrite: false }));
ballShadow.rotation.x = -Math.PI / 2;
ballShadow.position.y = 0.045;
scene.add(ballShadow);

const ballTrail = [];
for (let index = 0; index < 9; index += 1) {
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(0.045, 0.12 - index * 0.008), 7, 5),
    new THREE.MeshBasicMaterial({ color: 0xffe8b8, transparent: true, opacity: 0.52 - index * 0.045, depthWrite: false }),
  );
  dot.visible = false;
  scene.add(dot);
  ballTrail.push(dot);
}

const focusRing = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.94, 30), new THREE.MeshBasicMaterial({ color: 0xffd568, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }));
focusRing.rotation.x = -Math.PI / 2;
focusRing.position.y = 0.055;
scene.add(focusRing);
const impactRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.15, 32), new THREE.MeshBasicMaterial({ color: 0xff637b, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
impactRing.rotation.x = -Math.PI / 2;
impactRing.position.y = 0.06;
scene.add(impactRing);
const catchRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.05, 30), new THREE.MeshBasicMaterial({ color: 0x65ffd4, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
catchRing.rotation.x = -Math.PI / 2;
catchRing.position.y = 0.058;
scene.add(catchRing);

const playerShadows = new THREE.InstancedMesh(
  new THREE.CircleGeometry(0.62, 16),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.24, depthWrite: false }),
  22,
);
playerShadows.frustumCulled = false;
scene.add(playerShadows);

function playerRating(athlete, trait) { return 0.62 + (hash32(`${athlete.name}|${trait}`) % 3500) / 10000; }
function athleteFor(side, roleIndex) {
  const teamIndex = side === 'off' ? state.possession : 1 - state.possession;
  const sourceIndex = side === 'off' ? OFFENSE_INDEX[roleIndex] : DEFENSE_INDEX[roleIndex];
  return { teamIndex, athlete: teams[teamIndex].athletes[sourceIndex] || teams[teamIndex].athletes[0] };
}

function createPlayer(side, role, roleIndex) {
  const { teamIndex, athlete } = athleteFor(side, roleIndex);
  const traits = derivePlayerTraits(athlete, role, teamDNA[teamIndex]);
  const ratings = traits.ratings;
  const condition = playerConditions.get(athlete.id) || { stamina: 1, wear: 0, brain: { fatigue: 0, wear: 0, snaps: 0, driveSnaps: 0 } };
  condition.endurance = ratings.stamina;
  playerConditions.set(athlete.id, condition);
  const player = {
    id: `${side}-${role}-${++playSerial}`, side, teamIndex, role, athlete,
    number: athlete.number, name: athlete.name, x: 0, z: 0, vx: 0, vz: 0, facing: side === 'off' ? Math.PI / 2 : -Math.PI / 2,
    radius: lineRoles.has(role) ? 0.58 : 0.48,
    speed: lineRoles.has(role) ? 4.25 + ratings.speed * 3.1 : 5 + ratings.speed * 4.5,
    accel: 7 + ratings.acceleration * 7.5,
    agility: ratings.agility, strength: ratings.strength,
    hands: ratings.hands, tackle: ratings.tackle,
    action: 'idle', actionT: 0, actionDuration: 1, actionSide: random() < 0.5 ? -1 : 1,
    route: null, routeIndex: 1, markId: null, engagedId: null, blockTime: 0, down: false,
    jukeT: 0, jukeCooldown: 0, jukeImmune: 0, targetX: 0, targetZ: 0, preSnapMotion: null,
    stamina: condition.stamina, wear: condition.wear, condition, snapLoad: 0,
    traitLabel: traits.strengths.slice(0, 2).join(' + '), traits,
  };
  if (!playerGameStats.has(athlete.id)) playerGameStats.set(athlete.id, emptyPlayerStats(player));
  return player;
}

function colorValue(value, fallback) { try { return new THREE.Color(value || fallback); } catch { return new THREE.Color(fallback); } }

function makeBadge(text, color) {
  const texture = canvasTexture(384, 116, (context, width, height) => {
    context.fillStyle = 'rgba(2,8,12,.91)';
    context.beginPath(); context.roundRect(5, 5, width - 10, height - 10, 22); context.fill();
    context.strokeStyle = color; context.lineWidth = 7; context.stroke();
    context.fillStyle = color; context.font = '900 43px Orbitron, sans-serif';
    context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, width / 2, height / 2 + 2);
  });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }));
  sprite.scale.set(2.9, 0.88, 1);
  sprite.renderOrder = 10;
  return sprite;
}

function cylinderBetween(radius, length, material) {
  return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 7), material);
}

function equipFootballPlayer(rig, player) {
  const signal = colorValue(classicPlayerColor(player.teamIndex), 0x00e5ff);
  const club = footballClubEquipmentPalette(teams[player.teamIndex]);
  const shellColor = signal.clone().multiplyScalar(0.66);
  const primary = new THREE.MeshStandardMaterial({
    color: shellColor, emissive: signal, emissiveIntensity: 0.18, roughness: 0.48, metalness: 0.025,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: signal, emissive: signal, emissiveIntensity: 0.24, roughness: 0.38,
  });
  // Dark steel keeps facemasks legible without reintroducing a white bloom source.
  const metal = new THREE.MeshStandardMaterial({ color: 0x526674, metalness: 0.4, roughness: 0.36 });
  const clubPanel = new THREE.MeshStandardMaterial({
    color: club.primary,
    emissive: club.primary,
    emissiveIntensity: 0.09,
    roughness: 0.56,
    metalness: 0.04,
  });
  const clubTrim = new THREE.MeshStandardMaterial({ color: club.accent, emissive: club.accent, emissiveIntensity: 0.16, roughness: 0.42 });
  const torso = rig.group.getObjectByName('torso') || rig.group;
  const pads = new THREE.Mesh(new THREE.CapsuleGeometry(0.31, 0.35, 4, 12), primary);
  const gearMeshes = [pads];
  pads.name = 'football-shoulder-pads'; pads.rotation.z = Math.PI / 2; pads.scale.set(1.18, 1, 0.8); pads.position.set(0, 0.43, -0.005); torso.add(pads);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.38, 0.29), clubPanel);
  gearMeshes.push(chest);
  chest.position.set(0, 0.25, 0); torso.add(chest);
  const patternCount = ['grid', 'rain', 'growth'].includes(club.pattern) ? 3 : 2;
  for (let index = 0; index < patternCount; index += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.025, 0.31), clubTrim);
    stripe.position.y = 0.25 + (index - (patternCount - 1) / 2) * 0.095;
    stripe.position.z = 0.006;
    chest.add(stripe);
    gearMeshes.push(stripe);
  }
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.025, 6, 16), accent);
  gearMeshes.push(collar);
  collar.rotation.x = Math.PI / 2; collar.position.set(0, 0.57, 0.015); torso.add(collar);
  const helmet = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 11), primary); shell.scale.set(1.04, 0.98, 1.06); helmet.add(shell);
  gearMeshes.push(shell);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.065, 0.05), accent); brow.position.set(0, -0.018, 0.13); helmet.add(brow);
  gearMeshes.push(brow);
  const faceBar = cylinderBetween(0.011, 0.28, metal); faceBar.rotation.z = Math.PI / 2; faceBar.position.set(0, -0.115, 0.18); helmet.add(faceBar);
  gearMeshes.push(faceBar);
  for (const x of [-0.105, 0.105]) { const rail = cylinderBetween(0.01, 0.19, metal); rail.rotation.x = Math.PI / 2; rail.position.set(x, -0.07, 0.155); helmet.add(rail); gearMeshes.push(rail); }
  helmet.position.set(0, 0.005, 0); rig.headPivot.add(helmet);
  for (const hand of [rig.anchors.leftHand, rig.anchors.rightHand]) {
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), accent); glove.scale.set(1.05, 0.82, 1.12); hand.add(glove); gearMeshes.push(glove);
  }
  rig.group.traverse((object) => { if (object.isMesh) { object.castShadow = false; object.receiveShadow = false; } });
  return { materials: [primary, accent, metal, clubPanel, clubTrim], geometries: [...new Set(gearMeshes.map((meshObject) => meshObject.geometry))] };
}

function buildPlayerView(player) {
  const club = footballClubEquipmentPalette(teams[player.teamIndex]);
  const rig = buildBlobRig({
    side: player.teamIndex,
    athlete: player.athlete,
    foundingTeam: teams[player.teamIndex],
    captain: player.role === 'QB' || player.role === 'MIKE',
    brandColor: teams[player.teamIndex].colors.primary,
    secondaryColor: teams[player.teamIndex].colors.secondary || teams[player.teamIndex].colors.primary,
    accentColor: teams[player.teamIndex].colors.accent,
    teamCode: teams[player.teamIndex].code,
    jerseyNumber: player.number,
    kitPattern: club.pattern,
    role: player.role,
  });
  const widthScale = lineRoles.has(player.role) ? 1.18 : ['RB', 'MIKE', 'WILL', 'SAM', 'TE'].includes(player.role) ? 1.13 : 1.09;
  rig.group.scale.x *= widthScale;
  rig.group.scale.z *= widthScale;
  const gear = equipFootballPlayer(rig, player);
  rig.setDetailLevel?.(innerWidth < 700 || lineRoles.has(player.role) ? 'low' : 'medium');
  const badge = makeBadge(`${player.role}  ${player.number}`, colorValue(classicPlayerColor(player.teamIndex), 0x00e5ff).getStyle());
  scene.add(rig.group, badge);
  return {
    rig, badge, gearMaterials: gear.materials, gearGeometries: gear.geometries,
    lastSpeed: 0, lastFacing: worldFacing(player.facing), motion: {},
    visualPosition: new THREE.Vector3(worldX(player.x), 0, player.z),
    visualFacing: worldFacing(player.facing),
  };
}

function disposeViews() {
  for (const view of views.values()) {
    scene.remove(view.rig.group, view.badge);
    view.rig.dispose();
    view.badge.material.map.dispose();
    view.badge.material.dispose();
    for (const material of view.gearMaterials) material.dispose();
    for (const geometry of view.gearGeometries) geometry.dispose();
  }
  views = new Map();
}

function rebuildViews() {
  disposeViews();
  for (const player of players) views.set(player.id, buildPlayerView(player));
}

function getPlayer(side, role) { return players.find((player) => player.side === side && player.role === role); }
function getPlayerById(id) { return players.find((player) => player.id === id) || null; }
function offensePlayers() { return players.filter((player) => player.side === 'off'); }
function defensePlayers() { return players.filter((player) => player.side === 'def'); }
function fieldPositionLabel(spot = state.ballSpot) {
  if (Math.abs(spot - 50) < 0.5) return '50';
  return spot < 50 ? `OWN ${Math.round(spot)}` : `OPP ${Math.round(100 - spot)}`;
}
function distanceToGoal() { return 100 - state.ballSpot; }

function captureReplaySnapshot() {
  return {
    phase: state.phase,
    playStage: state.playStage,
    possession: state.possession,
    ballSpot: state.ballSpot,
    carrierId: state.carrierId,
    ball: {
      mode: ball.mode, ownerId: ball.ownerId, intendedId: ball.intendedId,
      x: ball.x, y: ball.y, z: ball.z, vx: ball.vx, vy: ball.vy, vz: ball.vz,
      spin: ballRotationAllowed(ball) ? ball.spin : 0,
      kickType: ball.kick?.type || null,
      ruling: ball.ruling,
    },
    contact: state.contact ? {
      carrierId: state.contact.carrierId,
      tacklerIds: state.contact.tacklerIds.slice(),
      t: state.contact.t,
      outcome: state.contact.outcome,
    } : null,
    catchBeat: state.catchBeat ? {
      catcherId: state.catchBeat.catcherId,
      intendedId: state.catchBeat.intendedId,
      x: state.catchBeat.x, z: state.catchBeat.z, t: state.catchBeat.t,
    } : null,
    players: players.map((player) => ({
      id: player.id, x: player.x, z: player.z, vx: player.vx, vz: player.vz,
      facing: player.facing, down: player.down, action: player.action,
      actionSide: player.actionSide,
      actionProgress: clamp(player.actionT / player.actionDuration, 0, 1),
    })),
  };
}

function replayRenderState() {
  return state.replayActive ? replayBuffer.currentFrame?.state || null : null;
}

function setReplayUi(active, label = '') {
  const bug = $('replayBug') || $('replayIndicator');
  if (!bug) return;
  bug.hidden = !active;
  bug.classList.toggle('show', active);
  const title = $('replayLabel') || bug.querySelector?.('[data-replay-label]');
  if (title) title.textContent = active ? 'INSTANT REPLAY' : '';
  const meta = $('replayMeta') || bug.querySelector?.('[data-replay-meta]');
  if (meta) meta.textContent = label ? String(label).replaceAll('_', ' ').toUpperCase() : 'BROADCAST REPLAY';
}

function queueReplay(type, data = {}, options = {}) {
  replayBuffer.sample(presentationTime, captureReplaySnapshot(), { force: true });
  const marker = replayBuffer.markEvent(type, presentationTime, data, options);
  state.replayCandidate = marker;
  state.replayStarted = false;
  return marker;
}

function maybeStartReplay() {
  if (state.phase !== 'dead' || state.replayActive || state.replayStarted || !state.replayCandidate || state.t < 0.48) return false;
  state.replayStarted = true;
  const selection = replayBuffer.selectReplay({
    eventId: state.replayCandidate.id,
    before: state.replayCandidate.priority >= 90 ? 3.5 : 2.7,
    after: 0.42,
    maxAge: 8,
  });
  if (!selection || selection.duration < 0.45 || !replayBuffer.start(selection, { speed: 0.78 })) return false;
  state.replayActive = true;
  setReplayUi(true, selection.event.type);
  audioDirector.triggerReplay({ direction: 'in' });
  return true;
}

function finishReplay() {
  if (!state.replayActive) return;
  state.replayActive = false;
  replayBuffer.stop();
  setReplayUi(false);
  audioDirector.triggerReplay({ direction: 'out' });
}

function event(headline, detail) {
  state.headline = headline;
  state.detail = detail;
  state.lastEvent = headline;
  state.events.unshift(`${headline} // ${detail}`);
  state.events = state.events.slice(0, 8);
}

function withPlayCause(detail) {
  const cause = state.lastSnap?.explanation?.summary;
  return cause ? `${detail} ${cause}` : detail;
}

function showMoment(title, detail, label = 'CYBERLIGA GRIDIRON', color = '#65ffd4', seconds = 1.75) {
  $('momentTitle').textContent = title;
  $('momentDetail').textContent = detail;
  $('momentLabel').textContent = label;
  $('moment').style.setProperty('--momentGlow', color);
  $('moment').classList.add('show');
  momentTimer = seconds;
}

function resetPlayer(player) {
  player.vx = 0; player.vz = 0; player.down = false; player.route = null; player.routeIndex = 1;
  player.markId = null; player.engagedId = null; player.blockTime = 0;
  player.action = 'idle'; player.actionT = 0; player.actionDuration = 1;
  player.jukeT = 0; player.jukeCooldown = 0; player.jukeImmune = 0;
  player.preSnapMotion = null;
}

function setAction(player, action, duration = 0.6, side = player.actionSide) {
  if (player.action !== action) player.actionT = 0;
  player.action = action;
  player.actionDuration = Math.max(0.08, duration);
  player.actionSide = side || 1;
}

function setPosition(player, x, z) {
  player.x = x; player.z = z; player.targetX = x; player.targetZ = z;
  player.facing = player.side === 'off' ? Math.PI / 2 : -Math.PI / 2;
}

function ensureRoster() {
  const expected = `${state.possession}|${teams[state.possession].id}|${teams[1 - state.possession].id}`;
  if (state.rosterKey === expected && players.length === 22) return false;
  state.rosterKey = expected;
  players = [];
  OFFENSE_ROLES.forEach((role, index) => players.push(createPlayer('off', role, index)));
  DEFENSE_ROLES.forEach((role, index) => players.push(createPlayer('def', role, index)));
  rebuildViews();
  return true;
}

function footballSituation(teamIndex = state.possession) {
  return {
    down: state.down,
    toGo: state.toGo,
    ballSpot: state.ballSpot,
    goalDistance: distanceToGoal(),
    quarter: state.quarter,
    clock: state.clock,
    scoreFor: state.score[teamIndex],
    scoreAgainst: state.score[1 - teamIndex],
  };
}

function chooseDefense() {
  const defenseTeam = 1 - state.possession;
  const decision = chooseDefensiveCall({
    calls: Object.keys(DEFENSES),
    situation: footballSituation(state.possession),
    teamDNA: teamDNA[defenseTeam],
    memory: coordinatorMemory[defenseTeam],
    rng: random,
  });
  state.defenseDecision = decision;
  return decision.selected?.id || 'COVER 3';
}

function choosePlay() {
  const decision = chooseOffensiveCall({
    calls: Object.keys(PLAYS),
    situation: footballSituation(state.possession),
    teamDNA: teamDNA[state.possession],
    memory: coordinatorMemory[state.possession],
    rng: random,
  });
  const recentOffense = (coordinatorMemory[state.possession]?.recent || [])
    .filter((snap) => snap.teamSide === 'offense')
    .slice(0, 8);
  const scoreDiff = state.score[state.possession] - state.score[1 - state.possession];
  const hurryUpPassing = state.quarter >= 4 && state.clock <= 120 && scoreDiff < -3;
  if (recentOffense.length >= 5 && state.down <= 2 && !hurryUpPassing) {
    const recentRuns = recentOffense.filter((snap) => ['run', 'option'].includes(PLAYS[snap.offenseCall]?.kind)).length;
    const actualRunRate = recentRuns / recentOffense.length;
    const desiredRunRate = teamDNA[state.possession].offense.runRate;
    const needsRun = actualRunRate < desiredRunRate - 0.17;
    const needsPass = actualRunRate > desiredRunRate + 0.22;
    const balancedCandidate = decision.ranking.find((candidate) => {
      const kind = PLAYS[candidate.id]?.kind;
      return needsRun ? ['run', 'option'].includes(kind) : needsPass ? kind === 'pass' : false;
    });
    if (balancedCandidate) {
      const label = needsRun
        ? 'recent sequencing has made the offense too pass-heavy'
        : 'recent sequencing has made the offense too run-heavy';
      decision.selected = {
        ...balancedCandidate,
        reasons: [{ label, impact: 0.24 }, ...(balancedCandidate.reasons || [])],
      };
      decision.balance = { actualRunRate: +actualRunRate.toFixed(2), desiredRunRate, correction: needsRun ? 'run' : 'pass' };
    }
  }
  state.offenseDecision = decision;
  const reason = decision.selected?.reasons?.[0]?.label;
  state.adjustment = reason ? `${teams[state.possession].code}: ${reason}` : `${teams[state.possession].code}: ${teamDNA[state.possession].label}`;
  return decision.selected?.id || 'INSIDE ZONE';
}

function penaltyDownState(snap = state.currentSnap) {
  return {
    possession: snap?.offense ?? state.possession,
    ballSpot: snap?.startSpot ?? state.ballSpot,
    down: snap?.startDown ?? state.down,
    toGo: snap?.startToGo ?? state.toGo,
  };
}

function penaltyTeamIndex(penalty, snap = state.currentSnap) {
  const offense = snap?.offense ?? state.possession;
  return penalty.team === 'offense' ? offense : 1 - offense;
}

function announcePenalty(ruling, offender = null) {
  const copy = formatPenaltyCall(ruling);
  state.flag = { penalty: ruling.penalty, ruling, copy, offenderId: offender?.id || null, accepted: true };
  event('FLAG', `${copy}.${ruling.penalty.reason ? ` ${ruling.penalty.reason}` : ''}`);
  showMoment('FLAG', copy, 'PENALTY', '#ffd568', 1.45);
}

function applyAcceptedPenalty(ruling, offender = null, { liveSnap = false } = {}) {
  const offendingTeam = penaltyTeamIndex(ruling.penalty);
  teamGameStats[offendingTeam].penalties += 1;
  teamGameStats[offendingTeam].penaltyYards += Math.round(ruling.enforcement.assessedYards || 0);
  state.ballSpot = clamp(ruling.next.ballSpot, 1, 99);
  state.down = ruling.next.down;
  state.toGo = Math.max(0.1, ruling.next.toGo);
  state.clockRunning = false;
  state.playClock = PLAY_CLOCK_SECONDS;
  if (liveSnap) rollbackNullifiedSnapStats();
  if (ruling.firstDown && ruling.penalty.team === 'defense') {
    const offense = state.currentSnap?.offense ?? state.possession;
    teamGameStats[offense].firstDowns += 1;
    state.firstDowns += 1;
  }
  announcePenalty(ruling, offender);
  setDead(() => { state.flag = null; beginPreplay(); }, 1.35, true);
}

function rollbackNullifiedSnapStats() {
  const snap = state.currentSnap;
  if (!snap || snap.recorded) return;
  snap.recorded = true; snap.nullifiedByPenalty = true;
  const teamStats = teamGameStats[snap.offense];
  if (!snap.special) teamStats.plays = Math.max(0, teamStats.plays - 1);
  if (!snap.special && snap.startDown === 3) teamStats.thirdDownAttempts = Math.max(0, teamStats.thirdDownAttempts - 1);
  const quarterback = getPlayerById(snap.quarterbackId);
  const target = getPlayerById(snap.targetId);
  const runner = getPlayerById(snap.carrierId);
  if (snap.attempted) {
    teamStats.passAttempts = Math.max(0, teamStats.passAttempts - 1);
    if (quarterback) statsFor(quarterback).passAttempts = Math.max(0, statsFor(quarterback).passAttempts - 1);
    if (target) statsFor(target).targets = Math.max(0, statsFor(target).targets - 1);
  }
  if (snap.completed) {
    teamStats.completions = Math.max(0, teamStats.completions - 1);
    state.completedPasses = Math.max(0, state.completedPasses - 1);
    if (quarterback) statsFor(quarterback).completions = Math.max(0, statsFor(quarterback).completions - 1);
    if (target) statsFor(target).receptions = Math.max(0, statsFor(target).receptions - 1);
  }
  if (snap.rushCredited) {
    teamStats.rushes = Math.max(0, teamStats.rushes - 1);
    if (runner) statsFor(runner).rushes = Math.max(0, statsFor(runner).rushes - 1);
  }
  if (snap.contact?.tacklerId) {
    const tackler = getPlayerById(snap.contact.tacklerId);
    if (tackler) statsFor(tackler).tackles = Math.max(0, statsFor(tackler).tackles - 1);
    state.tackles = Math.max(0, state.tackles - 1);
  }
  if (snap.turnover) {
    teamStats.turnovers = Math.max(0, teamStats.turnovers - 1);
    const takeawayPlayer = getPlayerById(snap.takeawayPlayerId);
    if (takeawayPlayer) statsFor(takeawayPlayer).takeaways = Math.max(0, statsFor(takeawayPlayer).takeaways - 1);
    if (snap.turnoverKind === 'interception' && quarterback) statsFor(quarterback).interceptions = Math.max(0, statsFor(quarterback).interceptions - 1);
  }
  if (snap.returnTurnover) {
    const fumblingTeam = snap.returnTurnoverTeam ?? 1 - snap.offense;
    teamGameStats[fumblingTeam].turnovers = Math.max(0, teamGameStats[fumblingTeam].turnovers - 1);
    const returnTakeawayPlayer = getPlayerById(snap.returnTakeawayPlayerId);
    if (returnTakeawayPlayer) statsFor(returnTakeawayPlayer).takeaways = Math.max(0, statsFor(returnTakeawayPlayer).takeaways - 1);
  }
  if (snap.forcedFumbleId) {
    const forcer = getPlayerById(snap.forcedFumbleId);
    if (forcer) statsFor(forcer).forcedFumbles = Math.max(0, statsFor(forcer).forcedFumbles - 1);
  }
  if (snap.sackTacklerId) {
    const sacker = getPlayerById(snap.sackTacklerId);
    if (sacker) statsFor(sacker).sacks = Math.max(0, statsFor(sacker).sacks - 1);
  }
  state.drivePlays = Math.max(0, state.drivePlays - (snap.special ? 0 : 1));
  if (state.replayCandidate) {
    state.replayCandidate.replayable = false;
    state.replayCandidate = null;
  }
  state.lastSnap = {
    ...snap,
    result: 'NO PLAY · PENALTY',
    penalty: state.flag?.penalty || null,
    gain: 0,
    explanation: { headline: 'FLAG', summary: 'The accepted penalty nullifies the snap.', causes: ['accepted penalty nullifies the snap'] },
  };
}

function maybePreSnapPenalty() {
  const forced = String(state.testPenalty || '').toLowerCase();
  const forcedPreSnap = ['false-start', 'false start', 'offsides', 'encroachment'].includes(forced);
  const linemen = offensePlayers().filter((player) => ['LT', 'LG', 'C', 'RG', 'RT', 'TE'].includes(player.role));
  const front = defensePlayers().filter((player) => frontRoles.has(player.role));
  const offender = [...linemen].sort((a, b) => a.traits.ratings.discipline - b.traits.ratings.discipline)[0];
  const defender = [...front].sort((a, b) => a.traits.ratings.discipline - b.traits.ratings.discipline)[0];
  const offenseMovements = [];
  const defensiveEntries = [];
  if (offender && (forcedPreSnap && forced.startsWith('false') || (!forced && random() < 0.012))) {
    offenseMovements.push({
      offenderId: offender.name, offenderRole: offender.role, displacement: 0.28,
      forwardSpeed: 1.15, setDuration: 1.05, crowdNoise: audioDirector.crowdIntensity,
      fatigue: 1 - offender.stamina, occurredAt: state.t,
    });
  }
  if (defender && ((forcedPreSnap && !forced.startsWith('false')) || (!forced && random() < 0.014))) {
    const encroachment = forced === 'encroachment' || (!forced && random() < 0.38);
    defensiveEntries.push({
      offenderId: defender.name, offenderRole: defender.role, neutralZoneDepth: 0.38,
      contact: encroachment, snapOccurred: !encroachment, returnedOnside: false, occurredAt: state.t,
    });
  }
  if (forcedPreSnap) state.testPenalty = null;
  if (!offenseMovements.length && !defensiveEntries.length) return false;
  const assessment = evaluatePreSnapPenalties({
    offenseMovements, defensiveEntries, snapOccurred: true,
    rng: forcedPreSnap ? () => 0 : random,
  });
  if (!assessment.primary) return false;
  const offenderPlayer = assessment.primary.team === 'offense' ? offender : defender;
  if (offenderPlayer) {
    offenderPlayer.x += assessment.primary.team === 'offense' ? 0.24 : -0.34;
    setAction(offenderPlayer, 'brace', 0.55);
  }
  if (assessment.playMayContinue) {
    state.flag = { penalty: assessment.primary, copy: assessment.primary.name, accepted: null, freePlay: assessment.freePlay };
    showMoment('FLAG ON THE PLAY', `${assessment.primary.name} · FREE PLAY`, 'PENALTY MARKER', '#ffd568', 0.8);
    return false;
  }
  const ruling = enforcePenalty({ downState: penaltyDownState(null), penalty: assessment.primary });
  applyAcceptedPenalty(ruling, offenderPlayer);
  return true;
}

function maybeAssessHolding() {
  const snap = state.currentSnap;
  if (!snap || snap.livePenaltyAssessed || state.flag || state.playTime < 0.82) return;
  const requested = String(state.testPenalty || '').toLowerCase();
  if (requested && requested !== 'holding') return;
  const forced = requested === 'holding';
  snap.livePenaltyAssessed = true;
  if (!forced && random() >= 0.036) return;
  if (forced) state.testPenalty = null;
  const candidates = blockPairs.map((pair) => {
    const blocker = getPlayerById(pair.blockerId), defender = getPlayerById(pair.defenderId);
    const defenderAdvantage = blocker && defender ? clamp(defender.strength - blocker.strength + (pair.broken ? 0.55 : 0.18), 0, 1) : 0;
    return { pair, blocker, defender, defenderAdvantage };
  }).filter((item) => item.blocker && item.defender).sort((a, b) => b.defenderAdvantage - a.defenderAdvantage);
  const candidate = candidates[0];
  if (!candidate) return;
  const restriction = forced ? 0.92 : clamp(0.65 + candidate.defenderAdvantage * 0.3, 0, 1);
  const result = evaluateLivePenalties({
    blocks: [{
      offenderId: candidate.blocker.name, offenderRole: candidate.blocker.role,
      foulSpot: candidate.blocker.x, occurredAt: state.playTime,
      engagementDuration: Math.max(0.7, candidate.pair.time), restriction,
      separationAttempt: 0.75, defenderAdvantage: Math.max(0.58, candidate.defenderAdvantage),
      handOutsideFrame: 0.72, hook: 0.7, pointOfAttack: distance2(candidate.blocker, carrier() || ball) < 5 ? 0.9 : 0.55,
    }],
    rng: forced ? () => 0 : random,
  });
  if (result.primary) {
    state.flag = { penalty: result.primary, copy: result.primary.name, accepted: null, offenderId: candidate.blocker.id };
    showMoment('FLAG ON THE PLAY', result.primary.name, 'PENALTY MARKER', '#ffd568', 0.8);
  }
}

function maybeAssessPassInterference(intended, defender, receiverDistance, defenderDistance) {
  const snap = state.currentSnap;
  if (!snap || snap.dpiAssessed || state.flag || !intended || !defender) return;
  snap.dpiAssessed = true;
  const requested = String(state.testPenalty || '').toLowerCase();
  if (requested && requested !== 'dpi') return;
  const forced = requested === 'dpi';
  if (!forced && (defenderDistance > 1.15 || random() >= 0.055)) return;
  if (forced) state.testPenalty = null;
  const result = evaluateLivePenalties({
    coverages: [{
      offenderId: defender.name, offenderRole: defender.role, foulSpot: clamp(ball.x, 1, 99), occurredAt: state.playTime,
      targetDepth: Math.max(1, ball.x - state.ballSpot), ballInAir: true, catchable: receiverDistance < 2.5,
      secondsBeforeArrival: Math.max(0.04, ball.targetTime - ball.flightTime), contactSeverity: forced ? 0.9 : 0.78,
      restriction: 0.82, pathObstruction: 0.74, armBar: 0.76, playingBall: 0.08,
    }],
    rng: forced ? () => 0 : random,
  });
  if (result.primary) {
    state.flag = { penalty: result.primary, copy: result.primary.name, accepted: null, offenderId: defender.id };
    showMoment('FLAG ON THE PLAY', result.primary.name, 'PENALTY MARKER', '#ffd568', 0.8);
  }
}

function resolveLivePenalty({ endSpot, result = '', touchdown = false, changeOfPossession = false } = {}) {
  const flag = state.flag;
  if (!flag?.penalty || flag.accepted !== null) return false;
  const penalty = flag.penalty;
  const snap = state.currentSnap;
  const ruling = enforcePenalty({ downState: penaltyDownState(snap), penalty });
  const legalGain = endSpot - (snap?.startSpot ?? state.ballSpot);
  let accept;
  if (changeOfPossession) accept = penalty.team === 'defense';
  else if (touchdown) accept = penalty.team === 'offense';
  else if (penalty.team === 'offense') accept = ruling.next.ballSpot <= endSpot;
  else {
    const playConverted = legalGain + 0.001 >= (snap?.startToGo ?? state.toGo);
    const penaltyConverted = ruling.firstDown;
    accept = penaltyConverted && !playConverted || ruling.next.ballSpot > endSpot + 0.25 || String(result).includes('INCOMPLETE');
  }
  if (!accept) {
    flag.accepted = false;
    if (snap) snap.penaltyDeclined = penalty;
    state.flag = null;
    return false;
  }
  flag.accepted = true;
  applyAcceptedPenalty(ruling, getPlayerById(flag.offenderId), { liveSnap: true });
  return true;
}

function placeFormation(animate = false) {
  const los = state.ballSpot;
  const offense = {
    QB: [-4.4, 0], RB: [-5.9, 2], X: [-0.4, -20.5], Z: [-0.4, 20.5], SLOT: [-1, -11], TE: [-0.9, 9],
    LT: [-0.2, -6], LG: [-0.2, -3], C: [-0.2, 0], RG: [-0.2, 3], RT: [-0.2, 6],
  };
  const defense = {
    LDE: [1.2, -6.7], DT: [1.2, -2.4], NT: [1.2, 2], RDE: [1.2, 6.5], WILL: [5.3, -8], MIKE: [5.5, 0], SAM: [5.3, 8],
    LCB: [4.5, -20], RCB: [4.5, 20], FS: [13, -5], SS: [9, 7],
  };
  if (state.defense === 'QUARTERS') { defense.LCB = [7.5, -19]; defense.RCB = [7.5, 19]; defense.FS = [13, -8]; defense.SS = [13, 8]; }
  if (state.defense === 'NICKEL FIRE') { defense.WILL = [2.2, -7]; defense.SAM = [2.2, 7]; defense.FS = [12, 0]; }
  if (state.defense === 'BEAR FRONT' || state.defense === 'GOAL LINE') { defense.WILL = [3.2, -8]; defense.MIKE = [3.4, 0]; defense.SAM = [3.2, 8]; }
  if (state.play === 'JET SWEEP') {
    offense.SLOT = [-3.2, -4.4]; offense.RB = [-5.5, 3.5];
  } else if (state.play === 'COUNTER GT') {
    offense.RB = [-5.8, 5.4]; offense.TE = [-0.9, -8.5];
  }
  if (state.play === 'FIELD GOAL') {
    Object.assign(offense, { QB: [-10.2, -4], RB: [-7, 0], X: [0, -18], Z: [0, 18], SLOT: [-0.3, -10], TE: [-0.3, 10] });
    Object.assign(defense, { LDE: [0.9, -7], DT: [0.9, -3], NT: [0.9, 0], RDE: [0.9, 3], WILL: [0.9, 7], MIKE: [3, 0], SAM: [3, 9] });
  } else if (state.play === 'PUNT') {
    Object.assign(offense, { QB: [-13.5, 0], RB: [-3.5, 0], X: [-0.2, -22], Z: [-0.2, 22], SLOT: [-0.7, -10], TE: [-0.7, 10] });
    Object.assign(defense, { LDE: [1.1, -7], DT: [1.1, -3], NT: [1.1, 0], RDE: [1.1, 3], WILL: [1.1, 7], MIKE: [6, 0], SAM: [7, 11], LCB: [5, -21], RCB: [5, 21], SS: [25, 8], FS: [Math.min(42, 100 - los), 0] });
  }
  for (const player of players) {
    const startX = player.x, startZ = player.z;
    resetPlayer(player);
    const point = (player.side === 'off' ? offense : defense)[player.role];
    const targetX = clamp(los + point[0], -8, 108), targetZ = point[1];
    if (animate && Number.isFinite(startX) && Number.isFinite(startZ)) {
      player.x = startX; player.z = startZ; player.targetX = targetX; player.targetZ = targetZ;
      player.preSnapMotion = { startX, startZ, targetX, targetZ };
      const dx = targetX - startX, dz = targetZ - startZ;
      if (Math.hypot(dx, dz) > 0.08) player.facing = Math.atan2(dx, dz);
    } else setPosition(player, targetX, targetZ);
  }
}

function updatePreSnapMovement(dt) {
  const progress = clamp(state.t / PREPLAY_MOVE_SECONDS, 0, 1);
  const eased = smoothstep(progress);
  let moving = false;
  for (const player of players) {
    const motion = player.preSnapMotion;
    if (!motion) continue;
    const previousX = player.x, previousZ = player.z;
    player.x = lerp(motion.startX, motion.targetX, eased);
    player.z = lerp(motion.startZ, motion.targetZ, eased);
    const dx = motion.targetX - player.x, dz = motion.targetZ - player.z;
    const remaining = Math.hypot(dx, dz);
    if (progress < 1 && remaining > 0.02) {
      moving = true;
      const visualSpeed = Math.min(7.2, Math.max(2.2, Math.hypot(motion.targetX - motion.startX, motion.targetZ - motion.startZ) / PREPLAY_MOVE_SECONDS));
      const movedX = player.x - previousX, movedZ = player.z - previousZ;
      const movedDistance = Math.hypot(movedX, movedZ);
      if (movedDistance > 0.001) {
        player.vx = movedX / movedDistance * visualSpeed; player.vz = movedZ / movedDistance * visualSpeed;
        player.facing = Math.atan2(player.vx, player.vz);
      }
    } else {
      player.x = motion.targetX; player.z = motion.targetZ; player.vx = 0; player.vz = 0;
      player.facing = player.side === 'off' ? Math.PI / 2 : -Math.PI / 2;
      player.preSnapMotion = null;
    }
  }
  state.formationTransition = moving;
}

function finishPreSnapMovement() {
  for (const player of players) {
    const motion = player.preSnapMotion;
    if (!motion) continue;
    player.x = motion.targetX; player.z = motion.targetZ; player.vx = 0; player.vz = 0;
    player.facing = player.side === 'off' ? Math.PI / 2 : -Math.PI / 2;
    player.preSnapMotion = null;
  }
  state.formationTransition = false;
}

function assignRoutes() {
  const routes = ROUTES[state.play] || {};
  for (const player of offensePlayers()) {
    const relative = routes[player.role];
    if (!relative) continue;
    player.route = relative.map(([x, z]) => ({ x: clamp(state.ballSpot + x, -8, 108), z }));
    player.routeIndex = 1;
  }
}

function assignCoverage() {
  const marks = { LCB: 'X', RCB: 'Z', WILL: 'SLOT', SAM: 'TE', MIKE: 'RB', SS: 'TE', FS: 'SLOT' };
  for (const defender of defensePlayers()) {
    const receiver = getPlayer('off', marks[defender.role]);
    defender.markId = receiver?.id || null;
  }
}

function assignBlocks() {
  const rushRoles = new Set((DEFENSES[state.defense] || DEFENSES['COVER 3']).rush || ['LDE', 'DT', 'NT', 'RDE']);
  const available = defensePlayers().filter((player) => rushRoles.has(player.role));
  const blockers = ['LT', 'LG', 'C', 'RG', 'RT'].map((role) => getPlayer('off', role)).filter(Boolean);
  blockPairs = blockers.map((blocker) => {
    const defender = available.sort((a, b) => Math.abs(a.z - blocker.z) - Math.abs(b.z - blocker.z))[0];
    if (!defender) return null; // an uncovered lineman becomes visible help instead of duplicating a defender
    available.splice(available.indexOf(defender), 1);
    return { blockerId: blocker.id, defenderId: defender.id, time: 0, broken: false };
  }).filter(Boolean);
}

function beginPreplay(forcedPlay = null) {
  state.phase = 'preplay'; state.playStage = 'reset'; state.t = 0; state.playTime = 0;
  state.playClock = PLAY_CLOCK_SECONDS;
  state.replayCandidate = null; state.replayStarted = false; state.replayActive = false;
  setReplayUi(false);
  state.play = forcedPlay && PLAYS[forcedPlay] ? forcedPlay : choosePlay();
  state.defense = chooseDefense(); state.carrierId = null; state.contact = null; state.catchBeat = null; state.pass = null; state.returnType = null;
  state.qbDecision = null; state.qbReadIndex = 0; state.currentSnap = null; state.flag = null;
  state.pending = null; state.wind = +((random() - 0.5) * 8).toFixed(1);
  state.hideDeadBall = false;
  ball.mode = 'spotted'; ball.ownerId = null; ball.intendedId = null; ball.ruling = null; ball.kick = null; ball.spin = 0;
  const rebuiltRoster = ensureRoster();
  placeFormation(!rebuiltRoster && state.lastEvent !== 'OPENING KICKOFF TOUCHBACK'); assignRoutes(); assignCoverage(); assignBlocks();
  state.formationTransition = players.some((player) => !!player.preSnapMotion);
  ball.x = state.ballSpot - 0.25; ball.y = BALL_RADIUS; ball.z = 0; ball.vx = ball.vy = ball.vz = 0;
  lineOfScrimmage.position.x = worldX(state.ballSpot);
  lineToGain.position.x = worldX(clamp(state.ballSpot + state.toGo, 0, 100));
  const spec = PLAYS[state.play];
  state.headline = `${ordinal(state.down)} & ${Math.ceil(state.toGo)} at ${fieldPositionLabel()}`;
  const offenseWhy = state.offenseDecision?.selected?.reasons?.[0]?.label || teamDNA[state.possession].label;
  const defenseWhy = state.defenseDecision?.selected?.reasons?.[0]?.label || teamDNA[1 - state.possession].label;
  state.detail = `${teams[state.possession].code} sets ${spec.formation.toLowerCase()} around ${offenseWhy}; ${teams[1 - state.possession].code} answers from ${defenseWhy}.`;
  clearRoutes();
  updateHud();
}

function startAutomaticPlay() {
  if (state.phase !== 'preplay' || state.gameOver) return false;
  finishPreSnapMovement();
  if (maybePreSnapPenalty()) return false;
  state.phase = PLAYS[state.play].kind === 'fieldGoal' ? 'kick' : PLAYS[state.play].kind === 'punt' ? 'punt' : 'live';
  if (!state.specialTry) state.clockRunning = true;
  state.hideDeadBall = false;
  state.playStage = 'snap'; state.t = 0; state.playTime = 0; state.contact = null; state.catchBeat = null;
  state.drivePlays += state.specialTry ? 0 : 1;
  if (!state.specialTry) playSerial += 1;
  beginSnapLedger();
  ball.mode = 'snap'; ball.ownerId = null; ball.intendedId = getPlayer('off', state.play === 'FIELD GOAL' ? 'RB' : 'QB')?.id || null;
  ball.x = state.ballSpot; ball.y = 0.45; ball.z = 0; ball.vx = ball.vy = ball.vz = 0; ball.flightTime = 0; ball.spin = 0;
  state.headline = state.specialTry ? 'POINT AFTER ATTEMPT' : `${teams[state.possession].code} SNAP`;
  state.detail = `${PLAYS[state.play].formation} · the post-snap picture is live.`;
  state.events.unshift(`SNAP // ${state.play} // ${state.defense}`);
  audioDirector.triggerSnap();
  clearRoutes();
  return true;
}

function moveToward(player, targetX, targetZ, maxSpeed, dt, responsiveness = 1) {
  if (player.down) return;
  const dx = targetX - player.x, dz = targetZ - player.z;
  const distance = Math.hypot(dx, dz) || 1;
  const conditionFactor = clamp(0.72 + player.stamina * 0.3 - player.wear * 0.16, 0.58, 1.02);
  const desiredSpeed = Math.min(maxSpeed * conditionFactor, distance * 4.5);
  const desiredX = dx / distance * desiredSpeed;
  const desiredZ = dz / distance * desiredSpeed;
  const blend = damp(player.accel * responsiveness, dt);
  player.vx += (desiredX - player.vx) * blend;
  player.vz += (desiredZ - player.vz) * blend;
  player.x = clamp(player.x + player.vx * dt, -9.2, 109.2);
  player.z = clamp(player.z + player.vz * dt, -25.8, 25.8);
  if (Math.hypot(player.vx, player.vz) > 0.08) player.facing = Math.atan2(player.vx, player.vz);
}

function followRoute(player, dt) {
  if (!player.route?.length || player.routeIndex >= player.route.length) return;
  const target = player.route[player.routeIndex];
  moveToward(player, target.x, target.z, player.speed, dt);
  if (distance2(player, target) < 0.7) player.routeIndex += 1;
}

function updatePlayerTimers(dt) {
  const activeSnap = ['live', 'kick', 'punt'].includes(state.phase);
  const activeAthletes = new Set(players.map((player) => player.athlete.id));
  for (const player of players) {
    player.actionT += dt;
    player.jukeCooldown = Math.max(0, player.jukeCooldown - dt);
    player.jukeImmune = Math.max(0, player.jukeImmune - dt);
    player.jukeT = Math.max(0, player.jukeT - dt);
    const speed = Math.hypot(player.vx, player.vz);
    const endurance = player.traits?.ratings?.stamina ?? 0.6;
    if (activeSnap) {
      const workload = (0.0035 + speed * 0.00125 + (player.engagedId ? 0.004 : 0)) * (1.14 - endurance * 0.32);
      player.stamina = Math.max(0.38, player.stamina - workload * dt);
      player.snapLoad += workload * dt;
    } else player.stamina = Math.min(1, player.stamina + dt * 0.0072 * (0.72 + endurance * 0.5));
    player.condition.stamina = player.stamina;
    player.condition.wear = player.wear;
    player.condition.brain = {
      ...(player.condition.brain || {}),
      fatigue: clamp(1 - player.stamina, 0, 1),
      wear: player.wear,
    };
    if (player.actionT > player.actionDuration && !player.down) { player.action = 'idle'; player.actionT = 0; }
  }
  for (const [athleteId, condition] of playerConditions) {
    if (activeAthletes.has(athleteId)) continue;
    const endurance = condition.endurance ?? 0.6;
    condition.stamina = Math.min(1, condition.stamina + dt * 0.0045 * (0.7 + endurance * 0.5));
    condition.brain = {
      ...(condition.brain || {}),
      fatigue: clamp(1 - condition.stamina, 0, 1),
      wear: condition.wear,
    };
  }
}

function separatePlayers() {
  for (let i = 0; i < players.length; i += 1) {
    const a = players[i]; if (a.down) continue;
    for (let j = i + 1; j < players.length; j += 1) {
      const b = players[j]; if (b.down) continue;
      if (a.engagedId === b.id || b.engagedId === a.id) continue;
      const dx = b.x - a.x, dz = b.z - a.z, distance = Math.hypot(dx, dz) || 0.001;
      const minimum = (a.radius + b.radius) * (a.side === b.side ? 0.72 : 0.82);
      if (distance >= minimum) continue;
      const push = (minimum - distance) * 0.22, nx = dx / distance, nz = dz / distance;
      a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
    }
  }
}

function updateBlocks(dt, runBlocking = false) {
  const blocked = new Set();
  for (const pair of blockPairs) {
    const blocker = getPlayerById(pair.blockerId), defender = getPlayerById(pair.defenderId);
    if (!blocker || !defender || blocker.down || defender.down || pair.broken) continue;
    // Hold one body-width between the rig origins. The old 0.15-yard run target stacked
    // both capsules into one unreadable mass even though the underlying matchup was sound.
    const targetX = defender.x - (runBlocking ? 0.9 : 1.02);
    moveToward(blocker, targetX, defender.z, runBlocking ? 4.8 : 3.6, dt);
    const gap = distance2(blocker, defender);
    if (gap < 1.28) {
      pair.time += dt; blocker.engagedId = defender.id; defender.engagedId = blocker.id;
      setAction(blocker, 'block', 0.35); setAction(defender, 'block', 0.35);
      const leverage = blocker.strength - defender.strength + (runBlocking ? 0.06 : 0);
      const push = clamp(0.45 + leverage * 1.6, 0.08, 0.78);
      defender.vx *= 0.35; defender.vz *= 0.35;
      defender.x += push * dt * (runBlocking ? 2.2 : -0.35);
      blocked.add(defender.id);
      const breakTime = (runBlocking ? 1.4 : 1.15) + clamp(leverage * 2.2, -0.45, 0.7) + (hash32(`${pair.defenderId}|${playSerial}`) % 30) / 100;
      if (pair.time > breakTime) { pair.broken = true; blocker.engagedId = null; defender.engagedId = null; }
    }
  }
  return blocked;
}

function closestPlayer(pool, point) {
  return pool.reduce((best, player) => !best || distance2(player, point) < distance2(best, point) ? player : best, null);
}

function syncBallToOwner() {
  const owner = getPlayerById(ball.ownerId);
  if (!owner) return;
  const lateral = owner.action === 'juke' ? -owner.actionSide * 0.08 : 0.28;
  ball.x = owner.x - Math.sin(owner.facing) * 0.12;
  ball.y = owner.role === 'QB' && state.playStage === 'dropback' ? 1.5 : 1.22;
  ball.z = owner.z + Math.cos(owner.facing) * lateral;
  ball.vx = owner.vx; ball.vy = 0; ball.vz = owner.vz;
  ball.spin = 0;
}

function carrier() { return getPlayerById(state.carrierId); }

function statsFor(player) {
  if (!player) return null;
  if (!playerGameStats.has(player.athlete.id)) playerGameStats.set(player.athlete.id, emptyPlayerStats(player));
  return playerGameStats.get(player.athlete.id);
}

function beginSnapLedger() {
  const offense = state.possession;
  const special = ['fieldGoal', 'punt'].includes(PLAYS[state.play].kind) || !!state.specialTry;
  state.currentSnap = {
    offense, play: state.play, defense: state.defense, startSpot: state.ballSpot, startDown: state.down,
    startToGo: state.toGo, startClock: state.clock, special, pass: PLAYS[state.play].kind === 'pass',
    rush: ['run', 'option'].includes(PLAYS[state.play].kind), turnover: false, recorded: false,
    quarterbackId: getPlayer('off', 'QB')?.id || null, targetId: null, carrierId: null,
  };
  if (PLAYS[state.play].kind === 'option') {
    const readDefender = getPlayer('def', 'SAM') || getPlayer('def', 'RDE');
    const defense = DEFENSES[state.defense] || DEFENSES['COVER 3'];
    const boxAggression = teamDNA[1 - offense].defense.boxAggression;
    const crashChance = clamp(0.2 + boxAggression * 0.28 + (defense.family === 'run-front' ? 0.12 : 0) - (state.defense === 'QUARTERS' ? 0.05 : 0), 0.25, 0.56);
    if (readDefender) {
      state.currentSnap.optionReadAssignment = {
        defenderId: readDefender.id,
        defenderName: readDefender.name,
        crash: random() < crashChance,
        crashChance: +crashChance.toFixed(2),
      };
    }
  }
  if (!special) {
    teamGameStats[offense].plays += 1;
    if (state.down === 3) teamGameStats[offense].thirdDownAttempts += 1;
  }
}

function finishSnapLedger({ endSpot = state.ballSpot, result = state.lastEvent, runner = null, touchdown = false } = {}) {
  const snap = state.currentSnap;
  if (!snap || snap.recorded) return null;
  snap.recorded = true;
  const rawGain = clamp(endSpot, 0, 100) - snap.startSpot;
  const gain = Math.round(rawGain);
  const passEndSpot = snap.fumbleSpot ?? endSpot;
  const passGain = Math.round(clamp(passEndSpot, 0, 100) - snap.startSpot);
  const rushEndSpot = snap.fumbleSpot ?? endSpot;
  const rushGain = Math.round(clamp(rushEndSpot, 0, 100) - snap.startSpot);
  const offenseStats = teamGameStats[snap.offense];
  const firstDown = !snap.turnover && (touchdown || rawGain + 0.001 >= snap.startToGo);
  const isSack = String(result).includes('SACK');
  const completedPass = snap.pass && snap.completed && !isSack;
  const completedReceiver = getPlayerById(snap.completedReceiverId) || (completedPass && runner?.side === 'off' ? runner : null);
  const statisticalRunner = completedPass ? completedReceiver : snap.rush ? getPlayerById(snap.carrierId) || runner : runner;
  const offensiveGain = snap.turnoverKind === 'interception' ? 0 : completedPass ? passGain : snap.rush ? rushGain : gain;
  if (!snap.special) {
    if (completedPass) offenseStats.passYards += passGain;
    else if (isSack) offenseStats.sacksAllowed += 1;
    else if (snap.rush) offenseStats.rushYards += rushGain;
    if (!snap.turnover && ((completedPass && passGain >= 20) || (snap.rush && rushGain >= 10))) offenseStats.explosivePlays += 1;
    if (firstDown) offenseStats.firstDowns += 1;
    if (snap.startDown === 3 && firstDown) offenseStats.thirdDownConversions += 1;
  }
  if (statisticalRunner) {
    const runnerStats = statsFor(statisticalRunner);
    if (completedPass) {
      runnerStats.receivingYards += passGain;
      if (touchdown && !snap.turnover && snap.fumbleSpot == null) runnerStats.receivingTD += 1;
    } else if (snap.rush) {
      runnerStats.rushYards += rushGain;
      if (touchdown && snap.fumbleSpot == null) runnerStats.rushTD += 1;
    }
  }
  const quarterback = getPlayerById(snap.quarterbackId);
  if (completedPass && quarterback) {
    const quarterbackStats = statsFor(quarterback);
    quarterbackStats.passYards += passGain;
    if (touchdown && !snap.turnover) quarterbackStats.passTD += 1;
  }
  const target = getPlayerById(snap.targetId);
  const tackler = getPlayerById(snap.contact?.tacklerId);
  const explanation = explainPlayCause({
    result, yards: gain, touchdown, turnover: snap.turnover,
    offenseCall: snap.play, defenseCall: snap.defense,
    actors: { passer: quarterback?.name, target: target?.name, carrier: runner?.name, tackler: tackler?.name },
    pressure: { level: snap.maxPressure || 0, source: snap.pressureSource || 'the rush', unblocked: !!snap.unblockedPressure },
    throwWindow: snap.throwWindow || null,
    decision: snap.qbDecision || null,
    runLane: snap.runLane?.lane || snap.runLane || null,
    contact: snap.contact || null,
    fumbleCause: snap.turnoverKind === 'fumble' ? 'strip' : null,
  });
  state.lastSnap = {
    ...snap, endSpot: +endSpot.toFixed(2), gain, result, firstDown, touchdown,
    adjustment: state.adjustment, explanation,
    offenseReason: state.offenseDecision?.selected?.reasons?.[0]?.label || teamDNA[snap.offense].label,
    defenseReason: state.defenseDecision?.selected?.reasons?.[0]?.label || teamDNA[1 - snap.offense].label,
  };
  if (!snap.special) {
    const outcome = {
      offenseCall: snap.play, defenseCall: snap.defense, yards: offensiveGain, firstDown, touchdown,
      turnover: snap.turnover, pressure: snap.maxPressure || 0, sack: isSack,
      situation: { down: snap.startDown, toGo: snap.startToGo },
    };
    coordinatorMemory[snap.offense] = recordPlayOutcome(coordinatorMemory[snap.offense], { ...outcome, teamSide: 'offense' });
    coordinatorMemory[1 - snap.offense] = recordPlayOutcome(coordinatorMemory[1 - snap.offense], { ...outcome, teamSide: 'defense' });
    for (const pair of blockPairs) {
      const blocker = getPlayerById(pair.blockerId);
      const defender = getPlayerById(pair.defenderId);
      if (!blocker || !defender) continue;
      const offenseWon = !pair.broken && pair.time >= 0.35;
      const phase = snap.pass ? 'pass-protection' : 'run-block';
      const detail = offenseWon
        ? `${blocker.name} sustained leverage on ${defender.name}`
        : `${defender.name} separated from ${blocker.name}`;
      const matchup = { key: `${blocker.athlete.id}:${defender.athlete.id}:${phase}`, phase, weight: clamp(pair.time, 0.35, 1.8), detail };
      coordinatorMemory[snap.offense] = recordMatchupWin(coordinatorMemory[snap.offense], { ...matchup, winner: offenseWon ? 'team' : 'opponent' });
      coordinatorMemory[1 - snap.offense] = recordMatchupWin(coordinatorMemory[1 - snap.offense], { ...matchup, winner: offenseWon ? 'opponent' : 'team' });
    }
  }
  for (const player of players) {
    const contactSeverity = snap.contact && (snap.contact.carrierId === player.id || snap.contact.tacklerId === player.id)
      ? clamp((snap.contact.impactSpeed || 0) / 12, 0.25, 1) : 0;
    const nextCondition = updatePlayerCondition({
      ...(player.condition.brain || {}), fatigue: 1 - player.stamina, wear: player.wear,
    }, {
      traits: player.traits,
      seconds: 0,
      sprintSeconds: 0,
      blockSeconds: 0,
      contactSeverity,
      driveEnded: touchdown || snap.turnover,
      snap: !snap.special,
    });
    player.condition.brain = nextCondition;
    player.condition.stamina = clamp(1 - nextCondition.fatigue, 0.38, 1);
    player.condition.wear = nextCondition.wear;
    player.stamina = player.condition.stamina;
    player.wear = player.condition.wear;
    player.snapLoad = 0;
  }
  if (!touchdown && isSack) queueReplay('sack', { gain, quarterbackId: snap.quarterbackId });
  else if (!touchdown && !snap.turnover && offensiveGain >= 20) queueReplay('explosive_play', { gain: offensiveGain, runnerId: statisticalRunner?.id || null });
  return state.lastSnap;
}

function markTurnover(player, kind) {
  const snap = state.currentSnap;
  if (!snap || snap.turnover) return;
  snap.turnover = true; snap.turnoverKind = kind; snap.turnoverSpot = +ball.x.toFixed(2); snap.takeawayPlayerId = player?.id || null;
  teamGameStats[snap.offense].turnovers += 1;
  const takeawayStats = statsFor(player);
  if (takeawayStats) takeawayStats.takeaways += 1;
  if (kind === 'interception') {
    const quarterback = getPlayerById(snap.quarterbackId);
    if (quarterback) statsFor(quarterback).interceptions += 1;
  }
  audioDirector.triggerTurnover({ intensity: kind === 'interception' ? 1 : 0.92 });
  queueReplay(kind === 'interception' ? 'interception' : 'fumble_recovery', { playerId: player?.id || null, kind });
}

function recordReturnTeamTurnover(recoverer) {
  const snap = state.currentSnap;
  if (!snap || snap.returnTurnover) return;
  const fumblingTeam = 1 - snap.offense;
  snap.returnTurnover = true;
  snap.returnTurnoverTeam = fumblingTeam;
  snap.returnTakeawayPlayerId = recoverer?.id || null;
  teamGameStats[fumblingTeam].turnovers += 1;
  const recoveryStats = statsFor(recoverer);
  if (recoveryStats) recoveryStats.takeaways += 1;
}

function chooseReceiver() {
  if (PLAYS[state.play].screen) return getPlayer('off', 'RB');
  const eligible = offensePlayers().filter((player) => player.route && ['X', 'Z', 'SLOT', 'TE', 'RB'].includes(player.role));
  let best = eligible[0], bestScore = -Infinity;
  for (const receiver of eligible) {
    const nearest = closestPlayer(defensePlayers(), receiver);
    const separation = nearest ? distance2(receiver, nearest) : 6;
    const depth = receiver.x - state.ballSpot;
    const score = separation + depth * (PLAYS[state.play].deep ? 0.12 : 0.035) + receiver.hands * 1.4 + gaussian() * 0.35;
    if (score > bestScore) { bestScore = score; best = receiver; }
  }
  return best;
}

function buildPassProgression(quarterback) {
  const spec = PLAYS[state.play];
  const reads = spec.reads || ['X', 'Z', 'SLOT', 'TE', 'RB'];
  return reads.map((role, index) => {
    const receiver = getPlayer('off', role);
    if (!receiver) return null;
    const defenders = defensePlayers().filter((player) => !player.down);
    const defender = closestPlayer(defenders, receiver);
    const separation = defender ? distance2(receiver, defender) : 6;
    const dx = receiver.x - (defender?.x ?? receiver.x), dz = receiver.z - (defender?.z ?? receiver.z);
    const gap = Math.hypot(dx, dz) || 1;
    const closingSpeed = defender
      ? Math.max(0, ((defender.vx - receiver.vx) * dx + (defender.vz - receiver.vz) * dz) / gap)
      : 0;
    const deepHelp = closestPlayer(defenders.filter((player) => ['FS', 'SS'].includes(player.role) && player !== defender), receiver);
    const safetyOverlap = deepHelp ? clamp(1 - distance2(deepHelp, receiver) / 10, 0, 1) : 0;
    const routeDepth = Math.max(0, receiver.x - state.ballSpot);
    const arrivalTime = clamp(distance2(receiver, quarterback) / 25, 0.35, 1.45);
    const leverage = defender ? clamp((receiver.x - defender.x) / 3 + (separation - 1) * 0.12, -1, 1) : 1;
    return {
      order: index + 1,
      targetId: receiver.id,
      targetName: receiver.name,
      depth: routeDepth,
      hot: (state.defense === 'NICKEL FIRE' && index === 0) || (spec.screen && role === 'RB'),
      checkdown: role === 'RB' && !spec.screen,
      receiver: receiver.traits,
      window: {
        separation, leverage, closingSpeed, safetyOverlap, routeDepth,
        sidelineSpace: 25.8 - Math.abs(receiver.z), arrivalTime,
        receiver: receiver.traits,
      },
    };
  }).filter(Boolean);
}

function quarterbackEscapeLane(quarterback) {
  const threats = defensePlayers().filter((player) => !player.down && !player.engagedId);
  if (!threats.length) return 1;
  const left = Math.min(...threats.map((player) => Math.hypot(player.x - quarterback.x, player.z - (quarterback.z - 4))));
  const right = Math.min(...threats.map((player) => Math.hypot(player.x - quarterback.x, player.z - (quarterback.z + 4))));
  return clamp((Math.max(left, right) - 2.4) / 6.2 * 0.86, 0, 1);
}

function creditPassAttempt(quarterback, receiver = null) {
  if (!state.currentSnap || state.currentSnap.attempted) return;
  state.currentSnap.attempted = true; state.currentSnap.targetId = receiver?.id || null;
  teamGameStats[state.possession].passAttempts += 1;
  statsFor(quarterback).passAttempts += 1;
  if (receiver) statsFor(receiver).targets += 1;
}

function releasePass(selectedReceiver = null, decision = null) {
  const quarterback = getPlayer('off', 'QB');
  const receiver = selectedReceiver || chooseReceiver();
  if (!quarterback || !receiver || ball.mode === 'pass') return;
  creditPassAttempt(quarterback, receiver);
  const spec = PLAYS[state.play];
  const distance = Math.hypot(receiver.x - quarterback.x, receiver.z - quarterback.z);
  const deepShot = !!spec?.deep;
  const throwType = deepShot ? (state.pressure > 0.74 ? 'touch' : 'lob') : decision?.throwType || 'touch';
  const ballSpeed = throwType === 'bullet' ? 28.5 : throwType === 'lob' ? 21.5 : 25;
  const flight = deepShot
    ? clamp(distance / ballSpeed + 0.18, 0.74, 1.5)
    : clamp(distance / ballSpeed, 0.42, 1.36);
  const leadFactor = deepShot ? 0.97 : 0.72;
  const targetX = clamp(receiver.x + receiver.vx * flight * leadFactor + (deepShot ? 2.8 : 1.2), -8, 107);
  const targetZ = clamp(receiver.z + receiver.vz * flight * (deepShot ? 0.9 : 0.72), -25, 25);
  ball.mode = 'pass'; ball.ownerId = null; ball.intendedId = receiver.id; ball.lastTouchId = quarterback.id; state.carrierId = null;
  ball.x = quarterback.x + 0.3; ball.y = 1.58; ball.z = quarterback.z;
  ball.vx = (targetX - ball.x) / flight;
  ball.vz = (targetZ - ball.z) / flight;
  ball.vy = (1.72 - ball.y + 0.5 * GRAVITY * flight * flight) / flight;
  ball.flightTime = 0; ball.targetTime = flight; ball.ruling = null; ball.spin = 0;
  state.playStage = 'ball_in_air';
  const selectedRead = decision?.considered?.find((read) => read.targetId === receiver.id) || null;
  state.pass = {
    targetId: receiver.id, targetX, targetZ, releaseX: quarterback.x, releaseZ: quarterback.z,
    flight, throwType, pressured: state.pressure > 0.62, window: selectedRead?.window || null,
  };
  if (state.currentSnap) {
    state.currentSnap.qbDecision = decision;
    state.currentSnap.throwWindow = selectedRead?.window || null;
  }
  setAction(quarterback, 'throw', 0.58, 1);
  state.detail = `${quarterback.name} reaches read ${decision?.readOrder || 1} and drives a ${throwType} throw to ${receiver.name}.`;
}

function quarterbackScramble(quarterback, reason) {
  if (!quarterback || state.playStage !== 'dropback') return false;
  state.playStage = 'qb_scramble'; state.carrierId = quarterback.id; ball.mode = 'carried'; ball.ownerId = quarterback.id;
  state.pass = null;
  if (state.currentSnap && !state.currentSnap.rushCredited) {
    state.currentSnap.pass = false; state.currentSnap.rush = true; state.currentSnap.rushCredited = true; state.currentSnap.carrierId = quarterback.id;
    teamGameStats[state.possession].rushes += 1; statsFor(quarterback).rushes += 1;
  }
  event('QUARTERBACK SCRAMBLE', `${quarterback.name} escapes because ${reason}.`);
  return true;
}

function quarterbackThrowaway(quarterback, reason) {
  if (!quarterback || state.playStage !== 'dropback') return false;
  creditPassAttempt(quarterback);
  const side = quarterback.z <= 0 ? -1 : 1;
  ball.mode = 'pass'; ball.ownerId = null; ball.intendedId = null; ball.lastTouchId = quarterback.id;
  ball.x = quarterback.x + 0.3; ball.y = 1.58; ball.z = quarterback.z;
  ball.targetTime = 0.58; ball.flightTime = 0; ball.vx = 13; ball.vz = side * 24;
  ball.vy = (1.25 - ball.y + 0.5 * GRAVITY * ball.targetTime ** 2) / ball.targetTime; ball.spin = 0;
  state.pass = { targetId: null, targetX: quarterback.x + 8, targetZ: side * 28, releaseX: quarterback.x, releaseZ: quarterback.z, flight: ball.targetTime, pressured: true, throwaway: true };
  state.playStage = 'ball_in_air'; setAction(quarterback, 'throw', 0.58, side);
  event('THROWAWAY', `${quarterback.name} gets outside and discards it because ${reason}.`);
  return true;
}

function updateQuarterbackDecision(quarterback) {
  if (!quarterback || state.playStage !== 'dropback' || ball.ownerId !== quarterback.id) return;
  const spec = PLAYS[state.play];
  const progression = buildPassProgression(quarterback);
  const escapeLane = quarterbackEscapeLane(quarterback);
  const decision = evaluateQBProgression({
    progression, quarterback: quarterback.traits, elapsed: Math.max(0, state.playTime - 0.18),
    pressure: state.pressure, platform: clamp(1 - Math.hypot(quarterback.vx, quarterback.vz) / 9, 0.35, 1),
    down: state.down, toGo: state.toGo, scrambleLane: escapeLane, outsidePocket: Math.abs(quarterback.z) >= 7.5,
    rng: random,
  });
  state.qbDecision = decision;
  state.qbReadIndex = Math.max(0, ...decision.considered.map((read) => read.order));
  if (state.currentSnap) state.currentSnap.qbDecision = decision;
  if (decision.action === 'throw' && state.playTime >= spec.release) {
    releasePass(getPlayerById(decision.targetId), decision); return;
  }
  if (decision.action === 'scramble') { quarterbackScramble(quarterback, decision.reason); return; }
  if (decision.action === 'throwaway') { quarterbackThrowaway(quarterback, decision.reason); return; }
  if (state.playTime >= spec.maxHold) {
    const best = decision.considered[0];
    if (escapeLane >= 0.38) quarterbackScramble(quarterback, 'the coverage held through the progression');
    else if (best?.targetId) releasePass(getPlayerById(best.targetId), { ...decision, action: 'throw', targetId: best.targetId, readOrder: best.order, throwType: best.window.throwType });
  }
}

function beginCatchBeat(outcome, catcherPlayer, intended, defender) {
  state.catchBeat = {
    outcome, catcherId: catcherPlayer?.id || null, intendedId: intended?.id || null, defenderId: defender?.id || null,
    x: ball.x, y: clamp(ball.y, 1.35, 2.15), z: ball.z, t: 0,
  };
  state.playStage = outcome === 'interception' ? 'interception_catch' : outcome === 'complete' ? 'catch' : 'incomplete_contact';
  ball.mode = 'contested'; ball.vx = ball.vy = ball.vz = ball.spin = 0;
  if (catcherPlayer) setAction(catcherPlayer, 'catch', 0.42, catcherPlayer.z < ball.z ? 1 : -1);
  if (defender && defender !== catcherPlayer) setAction(defender, 'tackle', 0.5, defender.z < ball.z ? 1 : -1);
  impactPulse = 1;
}

function resolveCatchWindow() {
  const intended = getPlayerById(ball.intendedId);
  if (!intended) { beginCatchBeat('incomplete', null, null, null); return; }
  const nearbyDefense = defensePlayers().filter((player) => !player.down).sort((a, b) => distance2(a, ball) - distance2(b, ball));
  const defender = nearbyDefense[0];
  const receiverDistance = distance2(intended, ball);
  const defenderDistance = defender ? distance2(defender, ball) : 99;
  maybeAssessPassInterference(intended, defender, receiverDistance, defenderDistance);
  let outcome = state.testCatchOutcome;
  state.testCatchOutcome = null;
  if (!['complete', 'incomplete', 'interception'].includes(outcome)) {
    const window = state.pass?.window;
    const baseCatchChance = window?.catchChance ?? clamp(intended.hands * 0.62 + (1.9 - receiverDistance) * 0.2 - (state.pass?.pressured ? 0.11 : 0), 0.18, 0.9);
    const physicalCatchChance = clamp(baseCatchChance * (PLAYS[state.play]?.deep ? 0.68 : 1), 0.12, 0.9);
    const turnoverRisk = window?.turnoverRisk ?? clamp((1.35 - defenderDistance) * 0.16 + (state.pass?.pressured ? 0.07 : 0), 0.01, 0.28);
    const catchRadius = PLAYS[state.play]?.deep ? 2.38 : 2.05;
    const atCatchPoint = receiverDistance < catchRadius && ball.y <= (PLAYS[state.play]?.deep ? 2.5 : 2.35);
    if (defender && defenderDistance < 1.35 && random() < turnoverRisk * 1.25) outcome = 'interception';
    else if (atCatchPoint && random() < physicalCatchChance) outcome = 'complete';
    else outcome = 'incomplete';
  }
  beginCatchBeat(outcome, outcome === 'interception' ? defender : outcome === 'complete' ? intended : null, intended, defender);
}

function updateCatchBeat(dt) {
  const beat = state.catchBeat;
  if (!beat) return false;
  beat.t += dt;
  const progress = clamp(beat.t / 0.44, 0, 1);
  ball.x = beat.x; ball.y = beat.y - Math.sin(progress * Math.PI) * 0.1; ball.z = beat.z;
  if (beat.t < 0.44) return true;
  const catcherPlayer = getPlayerById(beat.catcherId);
  state.catchBeat = null;
  if (beat.outcome === 'complete' && catcherPlayer) {
    state.completedPasses += 1; state.carrierId = catcherPlayer.id; state.playStage = 'run_after_catch';
    ball.mode = 'carried'; ball.ownerId = catcherPlayer.id; ball.spin = 0; catcherPlayer.jukeImmune = 0.24;
    teamGameStats[state.possession].completions += 1;
    const quarterback = getPlayerById(state.currentSnap?.quarterbackId);
    if (state.currentSnap) state.currentSnap.completed = true;
    if (quarterback) statsFor(quarterback).completions += 1;
    statsFor(catcherPlayer).receptions += 1;
    if (state.currentSnap) {
      state.currentSnap.completedReceiverId = catcherPlayer.id;
      state.currentSnap.catchSpot = +catcherPlayer.x.toFixed(2);
    }
    audioDirector.triggerCatch({ intensity: beat.defenderId ? 0.86 : 0.62 });
    if (beat.defenderId) queueReplay('contested_catch', { playerId: catcherPlayer.id, defenderId: beat.defenderId });
    event(`COMPLETE TO ${catcherPlayer.name.toUpperCase()}`, 'He secures the football, tucks it, and turns upfield.');
  } else if (beat.outcome === 'interception' && catcherPlayer) {
    state.carrierId = catcherPlayer.id; state.playStage = 'interception_return'; state.returnType = 'interception';
    ball.mode = 'carried'; ball.ownerId = catcherPlayer.id; ball.spin = 0; catcherPlayer.jukeImmune = 0.3;
    markTurnover(catcherPlayer, 'interception');
    showMoment('INTERCEPTION', `${teams[catcherPlayer.teamIndex].code} takes it away`, 'TURNOVER', teams[catcherPlayer.teamIndex].colors.accent, 1.35);
    event('INTERCEPTION', `${catcherPlayer.name} catches it clean and starts the return.`);
  } else {
    state.carrierId = null; state.playStage = 'incomplete_bounce'; ball.mode = 'dead_pass'; ball.spin = 0;
    ball.vx = (random() - 0.3) * 2.5; ball.vy = -1; ball.vz = (random() - 0.5) * 3; ball.flightTime = 0;
    event('INCOMPLETE', 'The ball hits the turf. The clock stops.');
  }
  return true;
}

function attemptJuke(force = false) {
  const runner = carrier();
  if (!runner || runner.down || runner.side !== 'off' || runner.jukeCooldown > 0 || state.contact) return false;
  const nearest = closestPlayer(defensePlayers().filter((player) => !player.down), runner);
  if (!force && (!nearest || distance2(nearest, runner) > 2.25 || random() > 0.24)) return false;
  const inputSide = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const side = inputSide || (nearest && nearest.z < runner.z ? 1 : -1) || (random() < 0.5 ? -1 : 1);
  runner.jukeT = 0.46; runner.jukeCooldown = 1.35; runner.jukeImmune = 0.48; runner.actionSide = side;
  runner.vz += side * 6.2; runner.vx *= 0.82; setAction(runner, 'juke', 0.5, side);
  state.userJukes += 1; state.playStage = 'juke';
  state.detail = `${runner.name} plants outside and cuts ${side < 0 ? 'left' : 'right'}.`;
  input.juke = false;
  return true;
}

function beginTackle(tackler) {
  const runner = carrier();
  if (!runner || !tackler || state.contact || runner.down || tackler.down) return false;
  if (runner.jukeImmune > 0) {
    tackler.down = true; tackler.vx *= 0.25; tackler.vz *= 0.25; setAction(tackler, 'fall', 0.72, tackler.z < runner.z ? 1 : -1);
    state.detail = `${runner.name} leaves ${tackler.name} grasping at air.`;
    return false;
  }
  const impactSpeed = Math.hypot(runner.vx - tackler.vx, runner.vz - tackler.vz);
  const gapX = runner.x - tackler.x, gapZ = runner.z - tackler.z;
  const gapLength = Math.hypot(gapX, gapZ) || 1;
  const tackleFacingX = Math.sin(tackler.facing), tackleFacingZ = Math.cos(tackler.facing);
  const angleQuality = clamp((tackleFacingX * gapX + tackleFacingZ * gapZ) / gapLength, -1, 1);
  const runnerPower = runner.strength * 0.58 + runner.agility * 0.28 + runner.stamina * 0.14 + Math.min(0.2, Math.hypot(runner.vx, runner.vz) * 0.018);
  const tacklePower = tackler.tackle * 0.53 + tackler.strength * 0.26 + tackler.stamina * 0.11 + (angleQuality + 1) * 0.05 + Math.min(0.24, impactSpeed * 0.022);
  const leverage = tacklePower - runnerPower;
  const wearImpact = clamp(impactSpeed * 0.0028, 0.008, 0.045);
  runner.wear = clamp(runner.wear + wearImpact, 0, 1);
  tackler.wear = clamp(tackler.wear + wearImpact * 0.52, 0, 1);
  runner.stamina = Math.max(0.35, runner.stamina - wearImpact * 0.8);
  tackler.stamina = Math.max(0.35, tackler.stamina - wearImpact * 0.45);
  runner.condition.stamina = runner.stamina; runner.condition.wear = runner.wear;
  tackler.condition.stamina = tackler.stamina; tackler.condition.wear = tackler.wear;
  let outcome = state.testTackleOutcome;
  state.testTackleOutcome = null;
  if (!['down', 'broken', 'fumble'].includes(outcome)) {
    const execution = leverage + gaussian() * 0.09;
    const exposedBall = angleQuality > 0.35 && impactSpeed > 8.2 && runner.jukeT <= 0;
    const fumbleChance = exposedBall ? clamp((impactSpeed - 8) * 0.018 + leverage * 0.08 + runner.wear * 0.035, 0, 0.12) : 0;
    outcome = execution < -0.13 ? 'broken' : random() < fumbleChance ? 'fumble' : 'down';
  }
  state.contact = { carrierId: runner.id, tacklerIds: [tackler.id], t: 0, outcome, impactSpeed, angleQuality, leverage, impactFired: false, startX: runner.x, startZ: runner.z };
  state.playStage = 'contact'; runner.vx *= 0.25; runner.vz *= 0.25; tackler.vx *= 0.2; tackler.vz *= 0.2;
  setAction(runner, outcome === 'broken' ? 'brace' : 'fall', 0.68, tackler.z < runner.z ? 1 : -1);
  setAction(tackler, 'tackle', 0.62, tackler.z < runner.z ? 1 : -1);
  return true;
}

function launchLooseBall(runner, tackler) {
  if (state.currentSnap) {
    if (runner.side === 'off' && state.currentSnap.fumbleSpot == null) state.currentSnap.fumbleSpot = +runner.x.toFixed(2);
    else state.currentSnap.returnFumbleSpot = +runner.x.toFixed(2);
  }
  ball.mode = 'loose'; ball.ownerId = null; ball.lastTouchId = runner.id; ball.ruling = null;
  ball.x = runner.x + 0.15; ball.y = 1.15; ball.z = runner.z;
  ball.vx = runner.vx * 0.35 + (random() - 0.35) * 4.5;
  ball.vy = 3.4 + random() * 1.8;
  ball.vz = runner.vz * 0.35 + (random() - 0.5) * 6;
  ball.flightTime = 0; ball.spin = 0; state.carrierId = null; state.playStage = 'loose_ball';
  event('FUMBLE', `${tackler.name} knocks the football loose. Every player is reacting to the bounce.`);
}

function updateContact(dt) {
  const contact = state.contact;
  if (!contact) return false;
  contact.t += dt;
  const runner = getPlayerById(contact.carrierId);
  const tacklers = contact.tacklerIds.map(getPlayerById).filter(Boolean);
  const tackler = tacklers[0];
  if (!runner || !tackler) { state.contact = null; return false; }
  const extraTacklers = runner.side === 'off' ? defensePlayers() : offensePlayers();
  for (const extra of extraTacklers) {
    if (!extra.down && !contact.tacklerIds.includes(extra.id) && distance2(extra, runner) < 1.1 && contact.t < 0.42) {
      contact.tacklerIds.push(extra.id); setAction(extra, 'tackle', 0.55, extra.z < runner.z ? 1 : -1); break;
    }
  }
  const drive = smoothstep(contact.t / 0.62) * clamp(contact.impactSpeed * 0.055, 0.2, 0.75);
  const runnerForward = runner.side === 'off' ? 1 : -1;
  runner.x = contact.startX + drive * runnerForward;
  runner.z = lerp(contact.startZ, tackler.z, smoothstep(contact.t / 0.7) * 0.18);
  tackler.x = lerp(tackler.x, runner.x + runnerForward * 0.35, damp(10, dt));
  tackler.z = lerp(tackler.z, runner.z, damp(10, dt));
  if (contact.t > 0.17 && !contact.impactFired) {
    contact.impactFired = true; impactPulse = 1; crowdHeat = Math.max(crowdHeat, 0.55);
    audioDirector.triggerTackle({ intensity: clamp(contact.impactSpeed / 12, 0.42, 1) });
  }
  if (contact.t < 0.66) { syncBallToOwner(); return true; }
  if (state.currentSnap) {
    state.currentSnap.contact = {
      carrierId: runner.id, tacklerId: tackler.id, impactSpeed: contact.impactSpeed,
      poorAngle: contact.angleQuality < 0.05, square: contact.angleQuality >= 0.45,
      gangTackle: contact.tacklerIds.length > 1, leverage: contact.leverage,
    };
  }
  state.contact = null;
  if (contact.outcome !== 'broken') { state.tackles += 1; statsFor(tackler).tackles += 1; }
  if (contact.outcome === 'broken') {
    state.brokenTackles += 1; tackler.down = true; setAction(tackler, 'fall', 0.8);
    runner.jukeImmune = 0.55; runner.vx = Math.max(4.2, Math.abs(runner.vx)) * (runner.side === 'off' ? 1 : -1);
    const escapedPasser = runner.role === 'QB' && state.currentSnap?.pass && !state.currentSnap?.attempted;
    if (escapedPasser) {
      state.playStage = 'dropback';
      quarterbackScramble(runner, 'he escaped the first sack attempt');
      event('SACK ESCAPED', `${runner.name} runs through first contact and breaks the pocket.`);
    } else {
      state.playStage = 'broken_tackle'; event('BROKEN TACKLE', `${runner.name} runs through the wrap and stays alive.`);
    }
  } else if (contact.outcome === 'fumble') {
    statsFor(tackler).forcedFumbles += 1;
    if (state.currentSnap) state.currentSnap.forcedFumbleId = tackler.id;
    launchLooseBall(runner, tackler);
  } else {
    const defensiveReturnReason = state.returnType === 'fumble' ? 'FUMBLE RETURN' : state.returnType === 'punt' ? 'PUNT RETURN' : 'INTERCEPTION RETURN';
    runner.down = true; setAction(runner, 'fall', 0.9); state.playStage = 'tackled';
    if (runner.side === 'off' && runner.x >= 100) scoreTouchdown(runner);
    else if (runner.side === 'off' && runner.x <= 0) {
      const sackSafety = runner.role === 'QB' && state.currentSnap?.pass && !state.currentSnap?.attempted;
      if (sackSafety) {
        statsFor(tackler).sacks += 1;
        if (state.currentSnap) state.currentSnap.sackTacklerId = tackler.id;
      }
      scoreSafety(runner, sackSafety ? 'SACK SAFETY' : 'SAFETY');
    }
    else if (runner.side === 'def' && runner.x <= 0) updateTurnoverReturn(0);
    else {
      const reason = runner.side === 'def'
        ? defensiveReturnReason
        : runner.role === 'QB' && state.currentSnap?.pass && !state.currentSnap?.attempted && runner.x < state.ballSpot ? 'SACK' : 'TACKLED';
      if (reason === 'SACK') {
        statsFor(tackler).sacks += 1;
        if (state.currentSnap) state.currentSnap.sackTacklerId = tackler.id;
      }
      finishCarrierPlay(runner, reason);
    }
  }
  return true;
}

function coverageTarget(defender) {
  const call = DEFENSES[state.defense] || DEFENSES['COVER 3'];
  const los = state.ballSpot;
  const receivers = offensePlayers().filter((player) => ['X', 'Z', 'SLOT', 'TE', 'RB'].includes(player.role) && !player.down);
  if (call.family === 'man' && !(state.defense === 'COVER 1 ROBBER' && defender.role === 'SS')) {
    const mark = getPlayerById(defender.markId);
    if (mark) {
      const trail = state.defense === 'COVER 2 MAN' ? 0.35 : 0.7;
      return { x: mark.x + trail, z: mark.z + (defender.z < mark.z ? -0.35 : 0.35), mark };
    }
  }
  const quarters = state.defense === 'QUARTERS';
  const cover3 = state.defense === 'COVER 3';
  const roleAnchors = {
    LCB: [quarters ? 13 : cover3 ? 10 : 7, -17], RCB: [quarters ? 13 : cover3 ? 10 : 7, 17],
    FS: [quarters ? 15 : 14, quarters ? -7 : 0], SS: [quarters ? 15 : state.defense === 'COVER 1 ROBBER' ? 6 : 9, quarters ? 7 : 5],
    WILL: [5.5, -9], MIKE: [6, 0], SAM: [5.5, 9],
  };
  const [depth, z] = roleAnchors[defender.role] || [4, defender.z];
  const anchor = { x: clamp(los + depth, los + 2, 106), z };
  const threat = closestPlayer(receivers.filter((player) => Math.abs(player.z - anchor.z) <= (quarters ? 10 : 8)), anchor);
  if (!threat) return anchor;
  const depthFloor = quarters && ['LCB', 'RCB', 'FS', 'SS'].includes(defender.role) ? los + 9 : los + 3;
  return {
    x: clamp(lerp(anchor.x, threat.x + 1.1, 0.62), depthFloor, 107),
    z: lerp(anchor.z, threat.z, 0.7),
    mark: threat,
  };
}

function updateRoutesAndPocket(dt) {
  const spec = PLAYS[state.play];
  const quarterback = getPlayer('off', 'QB');
  const runningBack = getPlayer('off', 'RB');
  const designedRunner = getPlayer('off', spec.carrier || 'RB') || runningBack;
  const blocked = updateBlocks(dt, spec.kind === 'run' || spec.kind === 'option');
  for (const player of offensePlayers()) {
    if (lineRoles.has(player.role)) continue;
    if (player.role === 'QB' && spec.kind === 'pass' && ball.ownerId === player.id && state.playStage === 'dropback') {
      const boot = spec.playAction ? 1.5 : 0;
      moveToward(player, state.ballSpot - (spec.playAction ? 5.2 : 6.2), boot, 3.5, dt); continue;
    }
    if ((spec.kind === 'run' || spec.kind === 'option') && state.playStage === 'mesh' && player.role === 'QB') {
      moveToward(player, state.ballSpot - 3.15, spec.lane * 0.11, 5.2, dt); continue;
    }
    if (player === carrier()) continue;
    if (spec.kind === 'pass' && player.route) { followRoute(player, dt); continue; }
    if ((spec.kind === 'run' || spec.kind === 'option') && player === designedRunner && state.playStage === 'mesh') {
      moveToward(player, state.ballSpot - 3.05, spec.lane * 0.11, 6.4, dt); continue;
    }
    if ((spec.kind === 'run' || spec.kind === 'option') && ['X', 'Z', 'SLOT', 'TE'].includes(player.role)) {
      const defender = closestPlayer(defensePlayers().filter((candidate) => !candidate.down && !candidate.engagedId), player);
      if (defender) { moveToward(player, defender.x - 0.3, defender.z, 4.8, dt); if (distance2(player, defender) < 1.1) { player.engagedId = defender.id; defender.engagedId = player.id; } }
    }
  }

  const runner = carrier();
  const carrierIsAdvancing = !!runner && ball.mode === 'carried' && ['handoff', 'option_keep', 'qb_scramble', 'run_after_catch', 'juke', 'broken_tackle'].includes(state.playStage);
  const ballInFlight = ball.mode === 'pass';
  const rushRoles = new Set((DEFENSES[state.defense] || DEFENSES['COVER 3']).rush || ['LDE', 'DT', 'NT', 'RDE']);
  for (const defender of defensePlayers()) {
    if (defender.down || blocked.has(defender.id)) continue;
    const optionAssignment = state.currentSnap?.optionReadAssignment;
    if (spec.kind === 'option' && state.playStage === 'mesh' && optionAssignment?.defenderId === defender.id) {
      const edgeSide = Math.sign(spec.lane || defender.z || 1);
      if (optionAssignment.crash) moveToward(defender, runningBack.x + 0.7, runningBack.z, defender.speed * 0.92, dt);
      else moveToward(defender, state.ballSpot + 2.2, edgeSide * 14, defender.speed * 0.88, dt);
      continue;
    }
    if (carrierIsAdvancing && runner.side === 'off') {
      const optionRead = state.currentSnap?.optionRead;
      if (state.playStage === 'option_keep' && optionRead?.edgeCrashesBack && defender.id === optionRead.defenderId && state.playTime < 1.28) {
        moveToward(defender, runningBack.x + 0.6, runningBack.z, defender.speed * 0.74, dt);
        continue;
      }
      if (!frontRoles.has(defender.role) && state.currentSnap?.rush) {
        const awareness = defender.traits?.ratings?.awareness ?? 0.65;
        const deception = spec.family === 'option' ? 0.16 : spec.family === 'outside' ? 0.08 : spec.family === 'power' ? 0.04 : 0;
        const reactionAt = 0.68 + (1 - awareness) * 0.34 + deception;
        if (state.playTime < reactionAt) {
          defender.vx *= Math.max(0, 1 - dt * 8);
          defender.vz *= Math.max(0, 1 - dt * 8);
          continue;
        }
      }
      const pursuitGap = distance2(defender, runner);
      const pursuitAngle = clamp(pursuitGap * 0.34, 0.9, 3.8);
      const catchup = 0.99 + clamp((pursuitGap - 2) * 0.016, 0, 0.11);
      moveToward(defender, runner.x + pursuitAngle, runner.z, defender.speed * (frontRoles.has(defender.role) ? 0.9 : catchup), dt);
      continue;
    }
    if (carrierIsAdvancing && runner.side === 'def') continue;
    if (ballInFlight) {
      const target = getPlayerById(ball.intendedId);
      const aim = target || { x: state.pass?.targetX ?? ball.x, z: state.pass?.targetZ ?? ball.z };
      moveToward(defender, aim.x, aim.z, defender.speed, dt);
      continue;
    }
    if (rushRoles.has(defender.role)) {
      if ((spec.kind === 'run' || spec.kind === 'option') && state.playStage === 'mesh') {
        const fitZ = ({ LDE: -7, DT: -2.5, NT: 2, RDE: 7, WILL: -9, MIKE: 0, SAM: 9 })[defender.role] ?? defender.z;
        const backInfluence = runningBack ? clamp(1 - Math.abs(fitZ - runningBack.z) / 12, 0, 0.45) : 0;
        moveToward(defender, state.ballSpot + 1.4, lerp(fitZ, runningBack?.z ?? fitZ, backInfluence), defender.speed * 0.76, dt);
      } else moveToward(defender, quarterback.x + 0.1, quarterback.z, defender.speed * (state.defense === 'NICKEL FIRE' ? 1.06 : 0.95), dt);
      continue;
    }
    const target = coverageTarget(defender);
    moveToward(defender, target.x, target.z, defender.speed * ((DEFENSES[state.defense]?.family === 'man') ? 0.98 : 0.91), dt);
  }

  const rushers = defensePlayers().filter((player) => rushRoles.has(player.role));
  const nearestRusher = quarterback ? closestPlayer(rushers, quarterback) : null;
  state.pressure = quarterback && nearestRusher ? clamp(1 - distance2(nearestRusher, quarterback) / 7, 0, 1) : 0;
  if (state.currentSnap) {
    state.currentSnap.maxPressure = Math.max(state.currentSnap.maxPressure || 0, state.pressure);
    if (nearestRusher && state.pressure >= (state.currentSnap.maxPressure || 0)) state.currentSnap.pressureSource = nearestRusher.name;
    if (nearestRusher && state.pressure > 0.72 && !nearestRusher.engagedId) state.currentSnap.unblockedPressure = true;
  }
  if (spec.screen && runningBack && state.playStage === 'dropback') runningBack.route = ROUTES['RB SCREEN'].RB.map(([x, z]) => ({ x: state.ballSpot + x, z }));
}

function choosePhysicalRunLane(runner) {
  const snap = state.currentSnap;
  if (snap?.runLane && state.playTime - (snap.runLaneAt || 0) < 0.34) return snap.runLane;
  const forward = runner.side === 'off' ? 1 : -1;
  const optionRead = state.playStage === 'option_keep' ? snap?.optionRead : null;
  const opponents = (runner.side === 'off' ? defensePlayers() : offensePlayers())
    .filter((player) => !(optionRead?.edgeCrashesBack && player.id === optionRead.defenderId && state.playTime < 1.28));
  const spec = PLAYS[state.play] || {};
  const readDefender = optionRead ? getPlayerById(optionRead.defenderId) : null;
  const preferred = optionRead
    ? Math.sign(readDefender?.z || spec.lane || 1) * 15
    : Number.isFinite(spec.lane) ? spec.lane : runner.z;
  const laneZs = [...new Set([-14, -9, -5, -2, 0, 2, 5, 9, 14, preferred].map((value) => +clamp(value, -22, 22).toFixed(1)))];
  const lanes = laneZs.map((z, index) => {
    const ahead = opponents.filter((player) => !player.down && (player.x - runner.x) * forward >= -0.5);
    const channel = ahead.filter((player) => Math.abs(player.z - z) <= 3.5);
    const firstContactDistance = channel.length
      ? Math.min(...channel.map((player) => Math.max(0, (player.x - runner.x) * forward)))
      : 12;
    const traffic = clamp(ahead.filter((player) => Math.hypot((player.x - (runner.x + forward * 5)) * 0.75, player.z - z) < 4.2).length / 3, 0, 1);
    const nearestLateral = ahead.length ? Math.min(...ahead.map((player) => Math.abs(player.z - z))) : 6;
    const width = clamp(nearestLateral * 1.35, 0.25, 6);
    const relevantPairs = blockPairs.filter((pair) => {
      const blocker = getPlayerById(pair.blockerId);
      return blocker && Math.abs(blocker.z - z) <= 5;
    });
    const blockLeverage = relevantPairs.length
      ? clamp(relevantPairs.reduce((sum, pair) => {
        const blocker = getPlayerById(pair.blockerId), defender = getPlayerById(pair.defenderId);
        return sum + (blocker && defender ? blocker.strength - defender.strength + (pair.broken ? -0.45 : pair.time * 0.2) : 0);
      }, 0) / relevantPairs.length, -1, 1)
      : -0.05;
    const edgeSet = Math.abs(z) >= 8 && ahead.some((player) => Math.abs(player.z) >= Math.abs(z) - 2 && firstContactDistance < 5) ? 0.82 : 0.18;
    const backside = Math.sign(z || 1) !== Math.sign(preferred || 1);
    const pursuitClosing = clamp(ahead.filter((player) => Math.abs(player.z - runner.z) < 10 && Math.hypot(player.vx, player.vz) > Math.hypot(runner.vx, runner.vz) * 0.85).length / 5, 0, 1);
    const secondLevelSpace = clamp(1 - ahead.filter((player) => !frontRoles.has(player.role) && Math.hypot(player.x - (runner.x + forward * 8), player.z - z) < 7).length / 3, 0, 1);
    return {
      id: `lane-${index}-${z}`, gap: Math.abs(z) < 2.5 ? 'A gap' : Math.abs(z) < 6 ? 'B gap' : Math.abs(z) < 10 ? 'C gap' : 'perimeter',
      z, width, blockLeverage, firstContactDistance, traffic, pursuitClosing, edgeSet,
      cutbackOpportunity: backside ? clamp(1 - traffic, 0, 1) : 0,
      secondLevelSpace, developing: state.playTime < 1.15,
    };
  });
  const ranked = rankRunLanes({ lanes, runner: runner.traits, scheme: state.play, rng: random });
  let schemePool = ranked;
  if (runner.side === 'off' && snap?.rush) {
    if (state.playStage === 'option_keep') {
      schemePool = ranked.filter((candidate) => Math.abs(candidate.lane.z) >= 8 && Math.sign(candidate.lane.z) === Math.sign(preferred));
    } else if (spec.family === 'inside') {
      schemePool = ranked.filter((candidate) => Math.abs(candidate.lane.z) <= 6);
    } else if (spec.family === 'power') {
      schemePool = ranked.filter((candidate) => Math.abs(candidate.lane.z) <= 8 && (Math.abs(candidate.lane.z) < 2 || Math.sign(candidate.lane.z) === Math.sign(spec.lane || -1)));
    } else if (spec.family === 'outside') {
      const oneCutDeveloped = state.playTime >= 1.15;
      schemePool = ranked.filter((candidate) => {
        const sameSide = Math.sign(candidate.lane.z || spec.lane || 1) === Math.sign(spec.lane || 1);
        return sameSide && (oneCutDeveloped ? Math.abs(candidate.lane.z) >= 2 && Math.abs(candidate.lane.z) <= 14 : Math.abs(candidate.lane.z) >= 6);
      });
    } else if (spec.family === 'option') {
      schemePool = ranked.filter((candidate) => Math.abs(candidate.lane.z) <= 6.5);
    }
    if (!schemePool.length) schemePool = ranked;
  }
  const perimeterKeep = optionRead
    ? schemePool.find((candidate) => Math.abs(candidate.lane.z) >= 8 && Math.sign(candidate.lane.z) === Math.sign(preferred))
    : null;
  const selected = perimeterKeep && perimeterKeep.score >= (schemePool[0]?.score || 0) - 0.12
    ? perimeterKeep
    : schemePool[0] || { lane: { z: runner.z, gap: 'open grass' }, score: 0.5, reasons: [] };
  if (snap) {
    snap.runLane = selected; snap.runLaneAt = state.playTime;
    const reason = selected.reasons?.[0]?.label;
    if (reason) state.adjustment = `${runner.name}: ${selected.lane.gap} — ${reason}`;
  }
  return selected;
}

function steerRunner(runner, dt) {
  const opponents = runner.side === 'off' ? defensePlayers() : offensePlayers();
  const forward = runner.side === 'off' ? 1 : -1;
  const developingRun = runner.side === 'off' && !!state.currentSnap?.rush && !state.pass;
  const lateralInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const verticalInput = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  if (runner.jukeT <= 0 && state.playStage === 'juke') {
    state.playStage = runner.side === 'def' ? 'turnover_return' : state.pass ? 'run_after_catch' : 'handoff';
  }
  let targetZ = runner.z + lateralInput * 7;
  const northSouthDepth = developingRun ? (state.playStage === 'option_keep' ? 11 : 9.6) : 7;
  let targetX = runner.x + forward * (northSouthDepth + verticalInput * 1.1);
  if (runner.side === 'off' && lateralInput === 0) {
    const decision = choosePhysicalRunLane(runner);
    targetZ = lerp(runner.z, clamp(decision.lane.z, -22, 22), developingRun ? 0.58 : 0.72);
  } else if (runner.side === 'def' && lateralInput === 0) {
    const nearest = closestPlayer(opponents.filter((player) => !player.down), runner);
    targetZ = clamp(runner.z + (nearest && runner.z <= nearest.z ? -2.4 : 2.4), -22, 22);
  }
  if (runner.jukeT > 0) targetZ = clamp(runner.z + runner.actionSide * 9, -24, 24);
  const speed = runner.speed * (runner.jukeT > 0 ? 0.78 : 1);
  moveToward(runner, targetX, targetZ, speed, dt, runner.jukeT > 0 ? 1.45 : 1);
}

function updateTurnoverReturn(dt) {
  const runner = carrier();
  if (!runner || runner.side !== 'def') return;
  steerRunner(runner, dt);
  for (const offensePlayer of offensePlayers()) {
    if (!offensePlayer.down) {
      const gap = distance2(offensePlayer, runner);
      const angle = clamp(gap * 0.42, 1.2, 4.8);
      const catchup = 1.08 + clamp((gap - 2) * 0.022, 0, 0.18);
      moveToward(offensePlayer, runner.x - angle, runner.z, offensePlayer.speed * catchup, dt);
    }
  }
  for (const defender of defensePlayers()) {
    if (defender === runner || defender.down) continue;
    const pursuer = closestPlayer(offensePlayers().filter((player) => !player.down && !player.engagedId), defender);
    if (pursuer) {
      moveToward(defender, pursuer.x + 0.3, pursuer.z, defender.speed * 0.7, dt);
      if (distance2(defender, pursuer) < 1.1) { defender.engagedId = pursuer.id; pursuer.engagedId = defender.id; }
    }
  }
  const tackler = closestPlayer(offensePlayers().filter((player) => !player.down && !player.engagedId), runner);
  if (tackler && distance2(tackler, runner) < 1.03 && state.playTime > 0.7) beginTackle(tackler);
  const reason = state.returnType === 'fumble' ? 'FUMBLE RETURN' : state.returnType === 'punt' ? 'PUNT RETURN' : 'INTERCEPTION RETURN';
  if (runner.x <= 0) {
    if (resolveLivePenalty({ endSpot: state.currentSnap?.turnoverSpot ?? state.ballSpot, result: reason, touchdown: true, changeOfPossession: true })) return;
    finishSnapLedger({ endSpot: state.currentSnap?.turnoverSpot ?? state.currentSnap?.startSpot ?? state.ballSpot, result: reason });
    state.score[runner.teamIndex] += 6;
    const touchdownLabel = state.returnType === 'interception' ? 'PICK SIX' : state.returnType === 'punt' ? 'PUNT RETURN TD' : 'FUMBLE RETURN TD';
    event(`${touchdownLabel} ${teams[runner.teamIndex].code}`, withPlayCause(`${runner.name} takes the ${reason.toLowerCase()} all the way back.`));
    showMoment(touchdownLabel, `${runner.name} · ${teams[runner.teamIndex].code}`, 'RETURN TOUCHDOWN', teams[runner.teamIndex].colors.accent, 2.2);
    audioDirector.triggerScore();
    queueReplay('touchdown', { playerId: runner.id, returnType: state.returnType });
    setDead(() => beginPAT(runner.teamIndex), 2.35, true);
  }
  if ((state.phase === 'live' || state.phase === 'punt') && state.playTime > 8.2) finishDefensiveReturn(runner, reason);
}

function updatePassBall(dt) {
  if (ball.mode !== 'pass') return false;
  ball.flightTime += dt;
  ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt; ball.vy -= GRAVITY * dt; ball.spin = 0;
  const target = getPlayerById(ball.intendedId);
  if (target && ball.flightTime > ball.targetTime * 0.5) moveToward(target, state.pass.targetX, state.pass.targetZ, target.speed * 1.06, dt);
  if (ball.flightTime >= ball.targetTime || (ball.y <= 2.05 && ball.flightTime > ball.targetTime * 0.72)) resolveCatchWindow();
  return true;
}

function updateDeadPass(dt) {
  if (ball.mode !== 'dead_pass') return false;
  ball.flightTime += dt;
  ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt; ball.vy -= GRAVITY * dt; ball.spin = 0;
  if (ball.y <= BALL_RADIUS) { ball.y = BALL_RADIUS; if (Math.abs(ball.vy) > 0.7) ball.vy = Math.abs(ball.vy) * 0.32; else ball.vy = 0; ball.vx *= 0.72; ball.vz *= 0.72; }
  if (ball.flightTime > 0.62) finishIncomplete();
  return true;
}

function recoverLooseBall(player) {
  ball.mode = 'carried'; ball.ownerId = player.id; ball.spin = 0; state.carrierId = player.id;
  setAction(player, 'catch', 0.42); player.jukeImmune = 0.28;
  if (state.phase === 'punt') {
    if (player.side === 'off') {
      const recoverySpot = clamp(player.x, 1, 99);
      ball.mode = 'dead'; player.down = true; setAction(player, 'fall', 0.7);
      recordReturnTeamTurnover(player);
      finishSnapLedger({ endSpot: state.currentSnap?.startSpot ?? state.ballSpot, result: 'PUNT FUMBLE RECOVERY' });
      event(`${teams[player.teamIndex].code} RECOVERS THE PUNT FUMBLE`, `${player.name} secures the loose ball at ${Math.round(recoverySpot)}.`);
      setDead(() => takePossession(player.teamIndex, recoverySpot, 'PUNT FUMBLE RECOVERY'), 1.5, true);
    } else {
      state.playStage = 'punt_return'; state.returnType = 'punt';
      event(`${teams[player.teamIndex].code} RECOVERS`, `${player.name} gathers the muff and keeps the return alive.`);
    }
    return;
  }
  if (state.returnType && player.side === 'off') {
    const recoverySpot = clamp(player.x, 1, 99);
    ball.mode = 'dead'; player.down = true; setAction(player, 'fall', 0.7);
    recordReturnTeamTurnover(player);
    finishSnapLedger({
      endSpot: state.currentSnap?.turnoverSpot ?? state.currentSnap?.startSpot ?? state.ballSpot,
      result: 'DOUBLE-TURNOVER RECOVERY',
    });
    event(`${teams[player.teamIndex].code} WINS IT BACK`, `${player.name} recovers the return-team fumble at ${fieldPositionLabel(recoverySpot)}.`);
    setDead(() => takePossession(player.teamIndex, recoverySpot, 'DOUBLE-TURNOVER RECOVERY'), 1.55, true);
    return;
  }
  if (player.side === 'off') {
    event(`${teams[player.teamIndex].code} RECOVERS`, `${player.name} falls on the loose football.`);
    player.down = true;
    if (player.x >= 100) scoreTouchdown(player);
    else if (player.x <= 0) scoreSafety(player);
    else finishCarrierPlay(player, 'FUMBLE RECOVERED');
  } else {
    markTurnover(player, 'fumble');
    state.playStage = 'fumble_return'; state.returnType = 'fumble';
    showMoment('FUMBLE RECOVERY', `${teams[player.teamIndex].code} has the football`, 'TURNOVER', teams[player.teamIndex].colors.accent, 1.25);
    event('DEFENSE RECOVERS', `${player.name} scoops the bounce and starts the return.`);
  }
}

function updateLooseBall(dt) {
  if (ball.mode !== 'loose') return false;
  ball.flightTime += dt;
  ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt; ball.vy -= GRAVITY * dt; ball.spin = 0;
  if (Math.abs(ball.z) >= 25.8) {
    const lastPossessor = getPlayerById(ball.lastTouchId);
    ball.z = clamp(ball.z, -25.8, 25.8);
    ball.x = clamp(ball.x, -9, 109);
    ball.vx = ball.vy = ball.vz = ball.spin = 0;
    if (lastPossessor) {
      lastPossessor.x = ball.x; lastPossessor.z = ball.z;
      ball.mode = 'carried'; ball.ownerId = lastPossessor.id; state.carrierId = lastPossessor.id;
      if (lastPossessor.side === 'off') {
        if (lastPossessor.x <= 0) scoreSafety(lastPossessor);
        else finishCarrierPlay(lastPossessor, 'OUT OF BOUNDS');
      } else finishDefensiveReturn(lastPossessor, 'FUMBLE OUT OF BOUNDS');
    } else {
      ball.mode = 'dead'; ball.ownerId = null; state.carrierId = null;
      event('LOOSE BALL OUT OF BOUNDS', `The football crosses the sideline at ${fieldPositionLabel(clamp(ball.x, 1, 99))}.`);
      setDead(() => beginPreplay(), 0.9, true);
    }
    return true;
  }
  if (ball.y <= BALL_RADIUS) {
    ball.y = BALL_RADIUS;
    if (Math.abs(ball.vy) > 0.85) ball.vy = Math.abs(ball.vy) * 0.42; else ball.vy = 0;
    ball.vx *= 0.78; ball.vz *= 0.78;
  }
  for (const player of players) if (!player.down) moveToward(player, ball.x, ball.z, player.speed * 0.9, dt);
  const nearest = closestPlayer(players.filter((player) => !player.down), ball);
  if (nearest && ball.flightTime > 0.3 && distance2(nearest, ball) < 0.82 && ball.y < 0.85) recoverLooseBall(nearest);
  else if (nearest && ball.flightTime > 2.1) recoverLooseBall(nearest);
  return true;
}

function updateLivePlay(dt) {
  state.playTime += dt;
  const spec = PLAYS[state.play];
  const quarterback = getPlayer('off', 'QB');
  const runningBack = getPlayer('off', 'RB');
  const designedRunner = getPlayer('off', spec.carrier || 'RB') || runningBack;
  const center = getPlayer('off', 'C');
  updatePlayerTimers(dt);
  if (updateCatchBeat(dt) || updateContact(dt)) { separatePlayers(); return; }
  if (updateDeadPass(dt) || updateLooseBall(dt)) { separatePlayers(); return; }

  if (state.playStage === 'snap') {
    const progress = clamp(state.playTime / 0.2, 0, 1);
    ball.x = lerp(center.x, quarterback.x, progress); ball.y = lerp(0.48, 1.45, progress); ball.z = lerp(center.z, quarterback.z, progress);
    if (progress >= 1) {
      ball.mode = 'carried'; ball.ownerId = quarterback.id; state.carrierId = quarterback.id;
      state.playStage = spec.kind === 'pass' ? 'dropback' : 'mesh';
    }
  }

  updateRoutesAndPocket(dt);
  maybeAssessHolding();
  const exchangeDistance = quarterback && designedRunner ? distance2(quarterback, designedRunner) : 99;
  if ((spec.kind === 'run' || spec.kind === 'option') && state.playStage === 'mesh' && state.playTime > 0.58 && (exchangeDistance <= 1.25 || state.playTime >= 0.82)) {
    const optionAssignment = state.currentSnap?.optionReadAssignment;
    const readDefender = spec.kind === 'option'
      ? getPlayerById(optionAssignment?.defenderId) || closestPlayer(defensePlayers().filter((player) => ['RDE', 'SAM', 'SS'].includes(player.role) && !player.down), designedRunner)
      : null;
    const backDistance = readDefender ? distance2(readDefender, designedRunner) : 99;
    const quarterbackDistance = readDefender ? distance2(readDefender, quarterback) : 99;
    const defenderSpeed = readDefender ? Math.hypot(readDefender.vx, readDefender.vz) : 0;
    const closingOnBack = readDefender && defenderSpeed > 0.1 && backDistance > 0.1
      ? ((designedRunner.x - readDefender.x) * readDefender.vx + (designedRunner.z - readDefender.z) * readDefender.vz) / (backDistance * defenderSpeed)
      : 0;
    const edgeCrashesBack = !!readDefender && !!optionAssignment?.crash && closingOnBack > -0.2;
    const keep = spec.kind === 'option' && !!edgeCrashesBack;
    const nextCarrier = keep ? quarterback : designedRunner;
    state.carrierId = nextCarrier.id; ball.ownerId = nextCarrier.id; ball.intendedId = null; ball.mode = 'carried'; state.playStage = keep ? 'option_keep' : 'handoff';
    if (state.currentSnap && !state.currentSnap.rushCredited) {
      state.currentSnap.rushCredited = true; state.currentSnap.carrierId = nextCarrier.id;
      teamGameStats[state.possession].rushes += 1;
      statsFor(nextCarrier).rushes += 1;
    }
    if (state.currentSnap && readDefender) state.currentSnap.optionRead = {
      defenderId: readDefender.id, defenderName: readDefender.name, edgeCrashesBack, keep,
      assignment: optionAssignment?.crash ? 'crash' : 'contain', closingOnBack: +closingOnBack.toFixed(2), exchangeDistance: +exchangeDistance.toFixed(2),
    };
    event(keep ? 'QUARTERBACK KEEP' : 'HANDOFF', `${nextCarrier.name} has the football and reads the first crease.`);
  }

  if (spec.kind === 'pass' && state.playStage === 'dropback') {
    const rushRoles = new Set((DEFENSES[state.defense] || DEFENSES['COVER 3']).rush || []);
    const arrivedRusher = closestPlayer(defensePlayers().filter((player) => !player.down && !player.engagedId && rushRoles.has(player.role)), quarterback);
    if (arrivedRusher && distance2(arrivedRusher, quarterback) < 0.98 && state.playTime > 0.58) beginTackle(arrivedRusher);
    if (!state.contact) updateQuarterbackDecision(quarterback);
  }
  if (ball.mode === 'pass') updatePassBall(dt);
  if (state.contact) {
    if (state.phase === 'live' && ball.mode === 'carried') syncBallToOwner();
    separatePlayers();
    return;
  }

  const runner = carrier();
  if (runner && ball.mode === 'carried') {
    if (state.playStage === 'mesh') {
      // The exchange is its own physical beat; neither player is a runner until possession transfers.
    } else if (runner.side === 'def') updateTurnoverReturn(dt);
    else if (runner === quarterback && spec.kind === 'pass' && state.playStage === 'dropback') {
      const rusher = closestPlayer(defensePlayers().filter((player) => !player.down && !player.engagedId), runner);
      if (rusher && distance2(rusher, runner) < 1.03 && state.playTime > 0.55) beginTackle(rusher);
    } else {
      steerRunner(runner, dt);
      if (input.juke) attemptJuke(true); else attemptJuke(false);
      const tackler = closestPlayer(defensePlayers().filter((player) => !player.down && !player.engagedId), runner);
      const developingRun = (spec.kind === 'run' || spec.kind === 'option') && !state.pass;
      const runContactLive = !developingRun || state.playTime >= 0.86;
      if (tackler && distance2(tackler, runner) < 1.03 && state.playTime > 0.68 && runContactLive) beginTackle(tackler);
      if (runner.x >= 100) scoreTouchdown(runner);
      else if (Math.abs(runner.z) >= 25.75) runner.x <= 0 ? scoreSafety(runner) : finishCarrierPlay(runner, 'OUT OF BOUNDS');
      else if (state.playTime > 8.6) runner.x <= 0 ? scoreSafety(runner) : finishCarrierPlay(runner, 'FORWARD PROGRESS');
    }
    if (state.phase === 'live' && ball.mode === 'carried') {
      syncBallToOwner();
      if (state.playStage === 'mesh' && runningBack) {
        const exchangeProgress = clamp((state.playTime - 0.32) / 0.5, 0, 0.92);
        ball.x = lerp(ball.x, runningBack.x, exchangeProgress);
        ball.y = lerp(ball.y, 1.18, exchangeProgress);
        ball.z = lerp(ball.z, runningBack.z, exchangeProgress);
      }
    }
  }

  separatePlayers();
}

function setDead(pending, hold = DEAD_SECONDS, stopClock = null) {
  // Once the whistle sounds, the broadcast no longer renders a detached ball on the turf.
  state.hideDeadBall = true;
  ball.mode = 'dead';
  ball.vx = 0; ball.vy = 0; ball.vz = 0; ball.spin = 0; ball.intendedId = null;
  state.phase = 'dead'; state.t = 0; state.deadHold = hold; state.pending = pending;
  state.playStage = 'whistle';
  const inferredClockStop = /INCOMPLETE|OUT OF BOUNDS|TOUCHDOWN|SAFETY|INTERCEPTION RETURN|FUMBLE RETURN|PUNT RETURN|TURNOVER|FIELD GOAL|NO GOOD|FLAG|RECOVER|TOUCHBACK|FINAL/i.test(state.lastEvent);
  state.clockRunning = !state.specialTry && !(stopClock ?? inferredClockStop);
  if (state.clockRunning && state.quarter >= 4 && state.clock <= 150) {
    const timeoutDecision = decideLateGameTimeout({
      possession: state.possession, score: state.score, quarter: state.quarter,
      gameClock: state.clock, playClock: state.playClock, timeouts: state.timeouts,
      clockRunning: true, phase: 'dead', down: state.down, toGo: state.toGo, ballSpot: state.ballSpot,
    });
    if (timeoutDecision.takeTimeout) {
      const clockState = createDeadBallClockState({ gameClock: state.clock, playClock: state.playClock, gameClockRunning: true });
      const applied = applyTimeoutDecision({ timeouts: state.timeouts, clockState, decision: timeoutDecision });
      if (applied.applied) {
        state.timeouts = applied.timeouts; state.clockRunning = false; state.playClock = applied.clock.playClock;
        state.deadHold += 0.45;
        state.detail = `${state.detail} ${teams[timeoutDecision.teamIndex].code} uses a timeout: ${timeoutDecision.reason}`;
        showMoment(`TIMEOUT ${teams[timeoutDecision.teamIndex].code}`, `${state.timeouts[timeoutDecision.teamIndex]} remaining`, 'CLOCK MANAGEMENT', teams[timeoutDecision.teamIndex].colors.accent, 1.2);
      }
    }
  }
  audioDirector.triggerWhistle({ count: state.lastEvent.includes('OUT OF BOUNDS') ? 2 : 1 });
}

function takePossession(teamIndex, newSpot, reason) {
  state.possession = teamIndex;
  state.ballSpot = clamp(newSpot, 1, 99);
  state.down = 1; state.toGo = Math.min(10, 100 - state.ballSpot);
  state.drivePlays = 0; state.driveYards = 0; state.driveStart = state.ballSpot; state.firstDowns = 0;
  state.specialTry = null; state.rosterKey = null;
  state.clockRunning = false;
  event(reason, `${teams[teamIndex].code} takes over at ${fieldPositionLabel()}.`);
  beginPreplay();
}

function finishDefensiveReturn(runner, reason) {
  const newSpot = clamp(100 - runner.x, 1, 99);
  const teamIndex = runner.teamIndex;
  if (resolveLivePenalty({ endSpot: state.currentSnap?.turnoverSpot ?? state.ballSpot, result: reason, changeOfPossession: true })) return;
  finishSnapLedger({ endSpot: state.currentSnap?.turnoverSpot ?? state.currentSnap?.startSpot ?? state.ballSpot, result: reason });
  ball.mode = 'dead'; ball.ownerId = runner.id; state.carrierId = runner.id;
  event(reason, withPlayCause(`${runner.name} is down. ${teams[teamIndex].code} will take over at ${newSpot < 50 ? `its ${Math.round(newSpot)}` : `the opponent ${Math.round(100 - newSpot)}`}.`));
  setDead(() => takePossession(teamIndex, newSpot, reason), 1.4, true);
}

function finishCarrierPlay(runner, reason = 'TACKLED') {
  if (!runner || state.phase === 'dead') return;
  if (runner.side === 'def') { finishDefensiveReturn(runner, reason); return; }
  const start = state.ballSpot;
  const end = clamp(runner.x, 0, 100);
  const rawGain = end - start;
  const gain = Math.round(rawGain);
  if (resolveLivePenalty({ endSpot: end, result: reason })) return;
  finishSnapLedger({ endSpot: end, result: reason, runner });
  state.ballSpot = clamp(end, 1, 99);
  state.driveYards += gain;
  ball.mode = 'dead'; ball.ownerId = runner.id; state.carrierId = runner.id;
  const playLabel = state.pass ? `COMPLETE FOR ${gain}` : reason === 'SACK' ? `SACK FOR ${Math.abs(gain)}` : reason === 'FUMBLE RECOVERED' ? `FUMBLE RECOVERY FOR ${gain}` : `${gain} YARD RUN`;
  if (rawGain + 0.001 >= state.toGo) {
    state.down = 1; state.toGo = Math.min(10, 100 - state.ballSpot); state.firstDowns += 1;
    event('FIRST DOWN', withPlayCause(`${playLabel}. ${runner.name} moves the chains at ${fieldPositionLabel()}.`));
    showMoment('FIRST DOWN', `${teams[state.possession].code} moves the chains`, 'DRIVE CONTINUES', teams[state.possession].colors.accent, 1.1);
  } else {
    state.down += 1; state.toGo = Math.max(1, state.toGo - rawGain);
    event(playLabel, withPlayCause(`${runner.name} is down at ${fieldPositionLabel()}. ${ordinal(Math.min(state.down, 4))} & ${Math.ceil(state.toGo)}.`));
  }
  if (state.down > 4) {
    const nextTeam = 1 - state.possession, newSpot = 100 - state.ballSpot;
    showMoment('TURNOVER ON DOWNS', `${teams[nextTeam].code} defense holds`, 'FOURTH DOWN STOP', teams[nextTeam].colors.accent, 1.7);
    setDead(() => takePossession(nextTeam, newSpot, 'TURNOVER ON DOWNS'), 1.65, true);
  } else setDead(() => beginPreplay(), reason === 'OUT OF BOUNDS' ? 0.8 : DEAD_SECONDS, reason === 'OUT OF BOUNDS');
}

function finishIncomplete() {
  if (state.phase !== 'live') return;
  if (resolveLivePenalty({ endSpot: state.currentSnap?.startSpot ?? state.ballSpot, result: 'INCOMPLETE' })) return;
  finishSnapLedger({ endSpot: state.currentSnap?.startSpot ?? state.ballSpot, result: 'INCOMPLETE' });
  ball.mode = 'dead'; ball.ownerId = null; state.carrierId = null; state.pass = null;
  state.down += 1;
  if (state.down > 4) {
    const nextTeam = 1 - state.possession, newSpot = 100 - state.ballSpot;
    showMoment('TURNOVER ON DOWNS', `${teams[nextTeam].code} takes over`, 'INCOMPLETE ON FOURTH', teams[nextTeam].colors.accent, 1.6);
    setDead(() => takePossession(nextTeam, newSpot, 'TURNOVER ON DOWNS'), 1.5, true);
  } else {
    state.toGo = Math.max(1, state.toGo);
    event('INCOMPLETE', withPlayCause(`The ball is spotted back at ${fieldPositionLabel()}. ${ordinal(state.down)} & ${Math.ceil(state.toGo)}.`));
    setDead(() => beginPreplay(), 0.8, true);
  }
}

function scoreTouchdown(runner) {
  if (state.phase === 'dead') return;
  if (resolveLivePenalty({ endSpot: 100, result: 'TOUCHDOWN', touchdown: true })) return;
  finishSnapLedger({ endSpot: 100, result: 'TOUCHDOWN', runner, touchdown: true });
  state.score[state.possession] += 6; state.ballSpot = 100; ball.mode = 'carried';
  setAction(runner, 'celebrate', 2.5);
  event(`TOUCHDOWN ${teams[state.possession].code}`, withPlayCause(`${runner.name} crosses the goal line with possession.`));
  showMoment('TOUCHDOWN', `${runner.name} · ${teams[state.possession].name}`, 'SIX POINTS', teams[state.possession].colors.accent, 2.6);
  crowdHeat = 1;
  audioDirector.triggerScore();
  queueReplay('touchdown', { playerId: runner.id, teamIndex: state.possession });
  const scoringTeam = state.possession;
  setDead(() => beginPAT(scoringTeam), 2.3, true);
}

function scoreSafety(runner, result = 'SAFETY') {
  const scoringTeam = 1 - state.possession;
  if (resolveLivePenalty({ endSpot: 0, result: 'SAFETY' })) return;
  finishSnapLedger({ endSpot: 0, result, runner });
  state.score[scoringTeam] += 2; state.ballSpot = 1; ball.mode = 'dead';
  event(`SAFETY ${teams[scoringTeam].code}`, withPlayCause(`${runner.name} is taken down in his own end zone.`));
  showMoment('SAFETY', `${teams[scoringTeam].code} earns two and the football`, 'DEFENSIVE SCORE', teams[scoringTeam].colors.accent, 2.2);
  audioDirector.triggerScore();
  queueReplay('safety', { playerId: runner.id, teamIndex: scoringTeam });
  setDead(() => takePossession(scoringTeam, 35, 'FREE KICK'), 2, true);
}

function beginPAT(scoringTeam) {
  state.possession = scoringTeam;
  state.ballSpot = 85;
  state.down = 1; state.toGo = 2;
  state.specialTry = 'PAT'; state.rosterKey = null;
  beginPreplay('FIELD GOAL');
  state.headline = 'POINT AFTER ATTEMPT';
  state.detail = `${teams[scoringTeam].code} sends out the snap, hold, and kick operation.`;
}

function kickoffTouchback(receivingTeam, label = 'KICKOFF TOUCHBACK') {
  state.specialTry = null;
  takePossession(receivingTeam, 25, label);
}

function launchFieldGoal() {
  const kicker = getPlayer('off', 'QB');
  const holder = getPlayer('off', 'RB');
  const spot = state.ballSpot - 7;
  const distance = GOAL_PLANE - spot;
  const windAcceleration = state.wind * 0.075;
  const power = 30.8 + (kicker?.strength ?? 0.75) * 3.5;
  const crossingTime = distance / power;
  let targetHeight = 5.8 + gaussian() * 0.42 - Math.max(0, distance - 58) * 0.055;
  let targetZ = gaussian() * (0.55 + Math.max(0, distance - 32) * 0.028);
  const forced = state.testKick;
  state.testKick = null;
  if (forced === 'good') { targetHeight = 6; targetZ = 0; }
  if (forced === 'left') targetZ = -4.35;
  if (forced === 'right') targetZ = 4.35;
  if (forced === 'short') { targetHeight = 2.25; targetZ = 0; }
  if (forced === 'upright') { targetHeight = 5.8; targetZ = UPRIGHT_HALF; }
  if (forced === 'crossbar') { targetHeight = CROSSBAR_HEIGHT; targetZ = 0; }
  ball.mode = 'kick'; ball.ownerId = null; ball.lastTouchId = kicker?.id || null;
  ball.x = spot; ball.y = 0.34; ball.z = 0;
  ball.vx = power;
  ball.vy = (targetHeight - ball.y + 0.5 * GRAVITY * crossingTime * crossingTime) / crossingTime;
  ball.vz = (targetZ - 0.5 * windAcceleration * crossingTime * crossingTime * 0.65) / crossingTime;
  ball.flightTime = 0; ball.spin = 0; ball.ruling = null;
  ball.kick = {
    type: state.specialTry === 'PAT' ? 'PAT' : 'FIELD GOAL', distance: Math.round(distance),
    spot, wind: state.wind, windAcceleration, targetHeight, targetZ, crossing: null,
    forced, settled: 0, scored: false,
  };
  state.playStage = 'kick_in_air';
  audioDirector.triggerKick({ intensity: 0.9 });
  if (kicker) setAction(kicker, 'kick', 0.65);
  if (holder) setAction(holder, 'brace', 0.7);
  state.detail = `${Math.round(distance)}-yard attempt · wind ${Math.abs(state.wind).toFixed(1)} ${state.wind < 0 ? 'toward the left upright' : 'toward the right upright'}.`;
}

function ruleGoalPlaneCrossing(previous) {
  const interpolation = clamp((GOAL_PLANE - previous.x) / Math.max(0.0001, ball.x - previous.x), 0, 1);
  const crossingY = lerp(previous.y, ball.y, interpolation);
  const crossingZ = lerp(previous.z, ball.z, interpolation);
  const uprightDistance = Math.abs(Math.abs(crossingZ) - UPRIGHT_HALF);
  const crossbarDistance = Math.abs(crossingY - CROSSBAR_HEIGHT);
  let ruling;
  if (crossingY >= CROSSBAR_HEIGHT && uprightDistance <= BALL_RADIUS * 1.05) ruling = 'upright';
  else if (Math.abs(crossingZ) <= UPRIGHT_HALF && crossbarDistance <= BALL_RADIUS * 1.05) ruling = 'crossbar';
  else if (crossingY <= CROSSBAR_HEIGHT + BALL_RADIUS) ruling = 'short';
  else if (crossingZ < -UPRIGHT_HALF + BALL_RADIUS) ruling = 'wide_left';
  else if (crossingZ > UPRIGHT_HALF - BALL_RADIUS) ruling = 'wide_right';
  else ruling = 'good';
  ball.ruling = ruling;
  ball.kick.crossing = { x: GOAL_PLANE, y: crossingY, z: crossingZ, ruling };
  impactPulse = ruling === 'upright' || ruling === 'crossbar' ? 1 : impactPulse;
  if (ruling === 'upright') { ball.vz *= -0.58; ball.vx *= 0.54; }
  if (ruling === 'crossbar') { ball.vy = Math.abs(ball.vy) * 0.48; ball.vx *= 0.55; }
}

function resolveFieldGoal() {
  const kick = ball.kick;
  if (!kick || kick.scored) return;
  kick.scored = true;
  const good = ball.ruling === 'good';
  const kickingTeam = state.possession;
  const receivingTeam = 1 - kickingTeam;
  if (kick.type === 'PAT') {
    if (good) {
      finishSnapLedger({ endSpot: state.currentSnap?.startSpot ?? state.ballSpot, result: 'PAT GOOD' });
      state.score[kickingTeam] += 1;
      event('POINT AFTER GOOD', `The visible kick crossed ${kick.crossing.y.toFixed(1)} yards high and ${Math.abs(kick.crossing.z).toFixed(1)} yards from center.`);
      showMoment('PAT GOOD', `${teams[kickingTeam].code} completes the seven-point drive`, 'KICK RULING · GOOD', teams[kickingTeam].colors.accent, 1.8);
      audioDirector.triggerScore({ intensity: 0.65 });
    } else {
      finishSnapLedger({ endSpot: state.currentSnap?.startSpot ?? state.ballSpot, result: 'PAT NO GOOD' });
      event('POINT AFTER NO GOOD', `The kick is ${ball.ruling.replace('_', ' ')}. The touchdown remains six points.`);
      showMoment('PAT NO GOOD', ball.ruling.replace('_', ' ').toUpperCase(), 'KICK RULING', '#ff637b', 1.8);
    }
    queueReplay('kick_ruling', { type: kick.type, ruling: ball.ruling, distance: kick.distance });
    setDead(() => kickoffTouchback(receivingTeam), 1.8, true);
    return;
  }
  if (good) {
    finishSnapLedger({ endSpot: state.currentSnap?.startSpot ?? state.ballSpot, result: 'FIELD GOAL GOOD' });
    state.score[kickingTeam] += 3;
    event('FIELD GOAL GOOD', `${kick.distance} yards · crossed above the bar at Y ${kick.crossing.y.toFixed(1)}, Z ${kick.crossing.z.toFixed(1)}.`);
    showMoment('FIELD GOAL', `${kick.distance} yards · ${teams[kickingTeam].code} +3`, 'THE PHYSICAL KICK IS GOOD', teams[kickingTeam].colors.accent, 2.2);
    crowdHeat = 0.85;
    audioDirector.triggerScore({ intensity: 0.8 });
    queueReplay('field_goal', { ruling: ball.ruling, distance: kick.distance });
    setDead(() => kickoffTouchback(receivingTeam, 'FIELD GOAL KICKOFF TOUCHBACK'), 2, true);
  } else {
    finishSnapLedger({ endSpot: state.currentSnap?.startSpot ?? state.ballSpot, result: 'FIELD GOAL NO GOOD' });
    const spotOfKick = clamp(100 - kick.spot, 20, 99);
    const rulingLabel = ball.ruling.replace('_', ' ').toUpperCase();
    event('FIELD GOAL NO GOOD', `${kick.distance} yards · ${rulingLabel}. The visible crossing and ruling agree.`);
    showMoment('NO GOOD', `${kick.distance} yards · ${rulingLabel}`, 'KICK RULING', '#ff637b', 2.1);
    queueReplay('kick_ruling', { ruling: ball.ruling, distance: kick.distance });
    setDead(() => takePossession(receivingTeam, spotOfKick, 'MISSED FIELD GOAL'), 1.6, true);
  }
}

function updateFieldGoal(dt) {
  state.playTime += dt;
  updatePlayerTimers(dt);
  const center = getPlayer('off', 'C'), holder = getPlayer('off', 'RB'), kicker = getPlayer('off', 'QB');
  const progress = clamp(state.playTime / 0.28, 0, 1);
  if (state.playStage === 'snap') {
    ball.x = lerp(center.x, holder.x, progress); ball.y = lerp(0.48, 0.35, progress); ball.z = 0;
    moveToward(kicker, state.ballSpot - 7.7, -1.2, 5.8, dt);
    for (const defender of defensePlayers()) moveToward(defender, state.ballSpot - 1, defender.z * 0.72, 5.3, dt);
    if (progress >= 1) { state.playStage = 'hold'; ball.mode = 'held'; ball.ownerId = holder.id; setAction(holder, 'catch', 0.35); }
  } else if (state.playStage === 'hold') {
    ball.x = state.ballSpot - 7; ball.y = 0.34; ball.z = 0;
    moveToward(kicker, state.ballSpot - 7.1, 0, 7.1, dt);
    if (state.playTime >= 0.78) launchFieldGoal();
  } else if (state.playStage === 'kick_in_air') {
    const previous = { x: ball.x, y: ball.y, z: ball.z };
    ball.flightTime += dt;
    ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt;
    ball.vy -= GRAVITY * dt; ball.vz += ball.kick.windAcceleration * dt; ball.spin += dt * 24;
    if (ball.kick.forced === 'blocked' && !ball.ruling && ball.x >= state.ballSpot + 1.1) {
      ball.ruling = 'blocked'; ball.kick.crossing = { x: ball.x, y: ball.y, z: ball.z, ruling: 'blocked' };
      ball.vx = -Math.abs(ball.vx) * 0.25; ball.vy = Math.abs(ball.vy) * 0.35; impactPulse = 1;
    } else if (!ball.ruling && previous.x < GOAL_PLANE && ball.x >= GOAL_PLANE) ruleGoalPlaneCrossing(previous);
    if (!ball.ruling && ball.y <= BALL_RADIUS) {
      ball.y = BALL_RADIUS; ball.ruling = 'short'; ball.kick.crossing = { x: ball.x, y: ball.y, z: ball.z, ruling: 'short' };
    }
    if (ball.y <= BALL_RADIUS) { ball.y = BALL_RADIUS; ball.vy = Math.abs(ball.vy) * 0.28; ball.vx *= 0.72; ball.vz *= 0.72; }
    if (ball.ruling) { ball.kick.settled += dt; if (ball.kick.settled > 0.72) resolveFieldGoal(); }
  }
  separatePlayers();
}

function launchPunt() {
  const punter = getPlayer('off', 'QB');
  const targetGross = clamp(41 + gaussian() * 8, 30, 57);
  const launchX = punter.x + 0.4;
  const targetX = state.ballSpot + targetGross;
  const flight = clamp(2.65 + targetGross * 0.012, 2.85, 3.45);
  ball.mode = 'punt'; ball.ownerId = null; ball.lastTouchId = punter.id;
  ball.x = launchX; ball.y = 1.25; ball.z = 0;
  ball.vx = (targetX - launchX) / flight; ball.vy = (0.75 - ball.y + 0.5 * GRAVITY * flight * flight) / flight; ball.vz = gaussian() * 1.2;
  ball.flightTime = 0; ball.targetTime = flight; ball.spin = 0; ball.ruling = null;
  state.punt = { targetX, gross: targetGross, returnStart: null };
  state.playStage = 'punt_in_air'; setAction(punter, 'kick', 0.62);
  audioDirector.triggerKick({ intensity: 0.78 });
  state.detail = `The punt turns over toward ${Math.round(targetX)} with the coverage unit underneath it.`;
}

function finishPuntTouchback() {
  const receivingTeam = 1 - state.possession;
  finishSnapLedger({ endSpot: state.currentSnap?.startSpot ?? state.ballSpot, result: 'PUNT TOUCHBACK' });
  event('PUNT TOUCHBACK', 'The kick carries through the end zone. The ball comes to the 25.');
  setDead(() => takePossession(receivingTeam, 25, 'PUNT TOUCHBACK'), 1.3, true);
}

function updatePunt(dt) {
  state.playTime += dt;
  updatePlayerTimers(dt);
  if (updateContact(dt)) return;
  if (updateLooseBall(dt)) { separatePlayers(); return; }
  const center = getPlayer('off', 'C'), punter = getPlayer('off', 'QB'), returner = getPlayer('def', 'FS');
  if (state.playStage === 'snap') {
    const progress = clamp(state.playTime / 0.33, 0, 1);
    ball.x = lerp(center.x, punter.x, progress); ball.y = lerp(0.48, 1.3, progress); ball.z = 0;
    if (progress >= 1) { ball.mode = 'carried'; ball.ownerId = punter.id; state.playStage = 'punt_steps'; }
  } else if (state.playStage === 'punt_steps') {
    moveToward(punter, punter.x + 2, 0, 5.5, dt); syncBallToOwner();
    if (state.playTime >= 0.78) launchPunt();
  } else if (state.playStage === 'punt_in_air') {
    ball.flightTime += dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt; ball.vy -= GRAVITY * dt; ball.spin = 0;
    moveToward(returner, clamp(state.punt.targetX, 4, 101), ball.z, returner.speed, dt);
    for (const player of offensePlayers().filter((candidate) => !lineRoles.has(candidate.role) && candidate !== punter)) moveToward(player, state.punt.targetX, ball.z, player.speed * 0.95, dt);
    if (state.punt.targetX >= 100 && ball.x >= 100 && ball.y < 3) { finishPuntTouchback(); return; }
    if (ball.flightTime >= ball.targetTime || (ball.y <= 1.8 && ball.flightTime > 2)) {
      returner.x = clamp(ball.x, 3, 98); returner.z = ball.z;
      state.carrierId = returner.id; ball.mode = 'carried'; ball.ownerId = returner.id; state.playStage = 'punt_return';
      state.returnType = 'punt';
      state.punt.returnStart = returner.x; setAction(returner, 'catch', 0.4); returner.jukeImmune = 0.22;
      event('PUNT FIELDED', `${returner.name} secures the kick and turns toward the first coverage lane.`);
    }
  } else if (state.returnType === 'punt' && carrier()?.side === 'def' && ball.mode === 'carried') {
    state.playStage = state.playStage === 'broken_tackle' ? 'punt_return' : state.playStage;
    updateTurnoverReturn(dt);
    if (state.phase === 'punt' && ball.mode === 'carried') syncBallToOwner();
    if (state.phase === 'punt' && state.playTime > 8.5) finishDefensiveReturn(returner, 'PUNT RETURN');
  }
  separatePlayers();
}

function nextQuarter() {
  if (state.quarter === 4) {
    if (state.score[0] === state.score[1]) {
      state.quarter = 5; state.clock = 120; state.timeouts = [2, 2];
      showMoment('OVERTIME', 'Two-minute overtime period', 'TIED AFTER FOUR', '#ffd568', 2.1);
      kickoffTouchback(random() < 0.5 ? 0 : 1, 'OVERTIME KICKOFF TOUCHBACK');
    } else finishGame();
    return;
  }
  if (state.quarter >= 5) { finishGame(); return; }
  state.quarter += 1; state.clock = QUARTER_SECONDS;
  if (state.quarter === 3) {
    state.timeouts = [3, 3];
    showMoment('SECOND HALF', `${teams[1].code} receives after the break`, 'HALFTIME COMPLETE', '#65ffd4', 2.1);
    kickoffTouchback(1, 'SECOND-HALF KICKOFF TOUCHBACK');
  } else {
    showMoment(`${ordinal(state.quarter)} QUARTER`, `${teams[state.possession].code} keeps the football`, 'NEW QUARTER', '#65ffd4', 1.8);
    beginPreplay();
  }
}

function playerImpact(stats) {
  return stats.passYards * 0.055 + stats.passTD * 18 - stats.interceptions * 10 + stats.rushYards * 0.11 + stats.rushTD * 16 + stats.receivingYards * 0.12 + stats.receivingTD * 16 + stats.tackles * 2 + stats.sacks * 8 + stats.forcedFumbles * 9 + stats.takeaways * 12;
}

function saveFinalHistory(winnerIndex) {
  if (state.historySaved) return;
  state.historySaved = true;
  for (let index = 0; index < teams.length; index += 1) {
    const team = teams[index];
    const record = leagueHistory.teams[team.id] || { games: 0, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 };
    record.games += 1; record.pointsFor += state.score[index]; record.pointsAgainst += state.score[1 - index];
    if (winnerIndex === null) record.ties += 1; else if (winnerIndex === index) record.wins += 1; else record.losses += 1;
    leagueHistory.teams[team.id] = record;
  }
  for (const stats of playerGameStats.values()) {
    const career = leagueHistory.players[stats.id] || { name: stats.name, teamId: stats.teamId, role: stats.role, games: 0 };
    career.games += 1;
    for (const [key, value] of Object.entries(stats)) if (typeof value === 'number') career[key] = (career[key] || 0) + value;
    leagueHistory.players[stats.id] = career;
  }
  leagueHistory.games.push({
    id: `${rivalryKey}|${leagueHistory.games.length + 1}`, rivalryKey,
    homeId: teams[0].id, awayId: teams[1].id, homeCode: teams[0].code, awayCode: teams[1].code,
    score: state.score.slice(), winnerId: winnerIndex === null ? null : teams[winnerIndex].id,
    headline: state.lastEvent, topPlayers: [...playerGameStats.values()].sort((a, b) => playerImpact(b) - playerImpact(a)).slice(0, 3).map((stats) => ({ id: stats.id, name: stats.name, teamId: stats.teamId, impact: +playerImpact(stats).toFixed(1) })),
  });
  leagueHistory.games = leagueHistory.games.slice(-80);
  if (!manualMode) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(leagueHistory)); } catch {}
  }
}

function finishGame() {
  state.gameOver = true; state.phase = 'final'; state.playStage = 'final'; state.paused = false;
  const winnerIndex = state.score[0] === state.score[1] ? null : state.score[0] > state.score[1] ? 0 : 1;
  saveFinalHistory(winnerIndex);
  const playerOfGame = [...playerGameStats.values()].sort((a, b) => playerImpact(b) - playerImpact(a))[0];
  $('winner').textContent = winnerIndex === null ? 'TIE GAME' : `${teams[winnerIndex].name} WIN`;
  $('finalScore').textContent = `${state.score[0]} – ${state.score[1]}`;
  $('finalMeta').textContent = playerOfGame ? `${playerOfGame.name} · player of the game · ${Math.round(playerImpact(playerOfGame))} impact` : `${state.completedPasses} completed catches · ${state.tackles} tackles`;
  $('final').classList.add('show');
}

function step(dt) {
  enforceBallRotationRule();
  if (state.paused || state.gameOver) return;
  if (state.replayActive) {
    replayBuffer.advance(dt);
    if (!replayBuffer.playing && replayBuffer.progress >= 1) finishReplay();
    return;
  }
  presentationTime += dt;
  replayBuffer.sample(presentationTime, captureReplaySnapshot());
  audioDirector.updateCrowd({
    phase: state.phase,
    down: state.down,
    homeDefense: state.possession === 1,
    yardsToGoal: distanceToGoal(),
    quarter: state.quarter,
    late: state.quarter >= 4 && state.clock <= 90,
    scoreDifferential: state.score[0] - state.score[1],
    momentum: crowdHeat * 0.28,
  }, dt);
  if (!state.specialTry && state.clockRunning && ['preplay', 'live', 'kick', 'punt', 'dead'].includes(state.phase)) {
    teamGameStats[state.possession].possessionSeconds += dt * CLOCK_RATE;
  }
  state.t += dt;
  momentTimer = Math.max(0, momentTimer - dt);
  if (momentTimer === 0) $('moment').classList.remove('show');
  crowdHeat = Math.max(0, crowdHeat - dt * 0.23);
  impactPulse = Math.max(0, impactPulse - dt * 1.8);

  if (state.phase === 'preplay') {
    updatePlayerTimers(dt); updatePreSnapMovement(dt);
    state.playStage = state.t < PREPLAY_MOVE_SECONDS ? 'reset' : state.t < 1.25 ? 'set' : 'cadence';
    state.playClock = Math.max(0, state.playClock - dt * 5.8);
    if (!state.specialTry && state.clockRunning) state.clock = Math.max(0, state.clock - dt * CLOCK_RATE);
    if (state.clock <= 0 && !state.specialTry) { nextQuarter(); return; }
    if (state.t >= PREPLAY_SECONDS) startAutomaticPlay();
  } else if (state.phase === 'live') {
    if (!state.specialTry && state.clockRunning) state.clock = Math.max(0, state.clock - dt * CLOCK_RATE);
    updateLivePlay(dt);
  } else if (state.phase === 'kick') {
    if (!state.specialTry && state.clockRunning) state.clock = Math.max(0, state.clock - dt * CLOCK_RATE);
    updateFieldGoal(dt);
  } else if (state.phase === 'punt') {
    if (state.clockRunning) state.clock = Math.max(0, state.clock - dt * CLOCK_RATE);
    updatePunt(dt);
  } else if (state.phase === 'dead') {
    updatePlayerTimers(dt);
    if (maybeStartReplay()) return;
    if (!state.specialTry && state.clockRunning) state.clock = Math.max(0, state.clock - dt * CLOCK_RATE);
    if (state.t >= state.deadHold) {
      const pending = state.pending; state.pending = null;
      if (pending) pending();
      if (state.clock <= 0 && !state.specialTry && state.phase === 'preplay') nextQuarter();
    }
  }
}

function phaseLabel() {
  if (state.paused) return 'BROADCAST PAUSED';
  if (state.replayActive) return 'INSTANT REPLAY';
  if (state.phase === 'preplay') return state.playStage === 'reset' ? 'TEAMS RESET TO THE LINE' : state.playStage === 'set' ? 'BOTH SIDES ARE SET' : 'QUARTERBACK AT THE LINE';
  if (state.phase === 'kick') return state.playStage === 'snap' ? 'SNAP TO THE HOLDER' : state.playStage === 'hold' ? 'THE OPERATION IS CLEAN' : ball.ruling ? `KICK · ${ball.ruling.replace('_', ' ').toUpperCase()}` : 'KICK IN FLIGHT';
  if (state.phase === 'punt') return state.playStage === 'punt_return' ? 'PUNT RETURN LIVE' : 'SPECIAL TEAMS LIVE';
  if (state.phase === 'dead') return 'WHISTLE · BALL SPOTTED';
  if (state.phase === 'final') return 'FINAL';
  return ({
    snap: 'SNAP · BALL MOVING', dropback: 'POCKET FORMING', mesh: 'MESH POINT', handoff: 'RUN PLAY LIVE', option_keep: 'QUARTERBACK KEEP',
    ball_in_air: 'PASS IN FLIGHT', catch: 'CATCH POINT', run_after_catch: 'RUN AFTER CATCH', contact: 'CONTACT · WRAP',
    juke: 'BALL CARRIER CUTS', broken_tackle: 'BROKEN TACKLE', loose_ball: 'LIVE FUMBLE', interception_return: 'INTERCEPTION RETURN',
    fumble_return: 'FUMBLE RETURN', tackled: 'RUNNER DOWN', incomplete_bounce: 'INCOMPLETE',
  })[state.playStage] || 'PLAY LIVE';
}

function updateHud() {
  const runner = carrier();
  const liveReturn = runner?.side === 'def' && ['live', 'punt'].includes(state.phase);
  const displayPossession = liveReturn ? runner.teamIndex : state.possession;
  $('homeScore').textContent = state.score[0]; $('awayScore').textContent = state.score[1];
  const seconds = Math.max(0, Math.ceil(state.clock));
  $('clock').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  $('quarter').textContent = state.quarter === 5 ? 'OVERTIME' : `${ordinal(state.quarter)} QUARTER`;
  $('down').textContent = state.specialTry === 'PAT' ? 'POINT AFTER' : liveReturn ? 'TURNOVER RETURN' : `${ordinal(state.down)} & ${Math.ceil(state.toGo)}`;
  $('fieldPosition').textContent = state.specialTry === 'PAT' ? '32-YARD TRY' : liveReturn ? fieldPositionLabel(100 - runner.x) : fieldPositionLabel();
  $('possession').textContent = `${teams[displayPossession].code} ${state.specialTry === 'PAT' ? 'KICK' : 'BALL'}`;
  if ($('playClock')) {
    $('playClock').textContent = String(Math.max(0, Math.ceil(state.playClock)));
    $('playClock').classList.toggle('warning', state.phase === 'preplay' && state.playClock <= 5);
  }
  $('phase').textContent = phaseLabel(); $('headline').textContent = state.headline; $('detail').textContent = state.detail;
  $('driveTeam').textContent = state.specialTry === 'PAT' ? 'POINT AFTER' : runner?.side === 'def' ? `${teams[displayPossession].code} RETURN` : `${teams[state.possession].code} DRIVE`;
  $('driveStats').textContent = `${state.drivePlays} PLAY${state.drivePlays === 1 ? '' : 'S'} · ${state.driveYards} YARDS · ${state.firstDowns} 1ST`;
  $('driveFill').style.width = `${clamp(liveReturn ? 100 - runner.x : state.ballSpot, 0, 100)}%`;
  const showFocus = !!runner && ['live', 'punt'].includes(state.phase) && ball.mode === 'carried';
  $('playerFocus').hidden = !showFocus;
  if (showFocus) {
    $('focusRole').textContent = runner.side === 'def' ? 'TURNOVER RETURN' : 'BALL CARRIER';
    $('focusName').textContent = `${runner.name.toUpperCase()} · ${runner.number}`;
    $('focusState').textContent = runner.jukeT > 0 ? 'PLANTED CUT' : state.contact ? `${state.contact.tacklerIds.length > 1 ? 'GANG ' : ''}TACKLE CONTACT` : `${Math.hypot(runner.vx, runner.vz).toFixed(1)} YD/S · BALL SECURE`;
  }
  const showKick = state.phase === 'kick' && !!ball.kick;
  $('kickRead').hidden = !showKick;
  if (showKick) {
    $('kickDistance').textContent = `${ball.kick.distance} YARDS · ${ball.ruling ? ball.ruling.replace('_', ' ').toUpperCase() : 'TRACKING'}`;
    $('kickWind').textContent = `WIND ${Math.abs(ball.kick.wind).toFixed(1)} ${ball.kick.wind < 0 ? '←' : '→'} · BALL Y ${ball.y.toFixed(1)} / Z ${ball.z.toFixed(1)}`;
  }
}

const renderBallPoint = new THREE.Vector3();
let trailWasActive = false;
function updatePlayerViews(dt) {
  const replayState = replayRenderState();
  const replayPlayers = replayState ? new Map(replayState.players.map((player) => [player.id, player])) : null;
  const visualBall = replayState?.ball || ball;
  const ballWorld = renderBallPoint.set(worldX(visualBall.x), visualBall.y, visualBall.z);
  let viewIndex = 0;
  for (const player of players) {
    const view = views.get(player.id); if (!view) continue;
    const renderPlayer = replayPlayers?.get(player.id) || player;
    const speedYards = Math.hypot(renderPlayer.vx, renderPlayer.vz);
    const speedMeters = speedYards * 0.9144;
    const targetX = worldX(renderPlayer.x);
    const targetZ = renderPlayer.z;
    const desiredFacing = worldFacing(renderPlayer.facing);
    const targetDistance = Math.hypot(targetX - view.visualPosition.x, targetZ - view.visualPosition.z);
    if (targetDistance > 8 || state.formationTransition && targetDistance > 4.5) {
      view.visualPosition.set(targetX, 0, targetZ);
    } else {
      const visualRate = visualBall.ownerId === player.id ? 24 : replayState ? 20 : 16;
      view.visualPosition.x += (targetX - view.visualPosition.x) * damp(visualRate, dt);
      view.visualPosition.z += (targetZ - view.visualPosition.z) * damp(visualRate, dt);
    }
    view.visualFacing += angleDelta(view.visualFacing, desiredFacing) * damp(renderPlayer.action === 'juke' ? 18 : 12, dt);
    const acceleration = clamp((speedYards - view.lastSpeed) / Math.max(dt, 1 / 120) / 12, -1, 1);
    const turn = clamp(angleDelta(view.lastFacing, desiredFacing) / Math.max(dt, 1 / 120) / 5, -1, 1);
    view.rig.group.position.copy(view.visualPosition);
    view.rig.group.rotation.y = view.visualFacing;
    const progress = replayState ? renderPlayer.actionProgress : clamp(player.actionT / player.actionDuration, 0, 1);
    const actionSide = renderPlayer.actionSide || 1;
    if (renderPlayer.action === 'catch') view.rig.setAction('keeper-catch', progress, actionSide);
    else if (renderPlayer.action === 'tackle') view.rig.setAction('tackle', progress, actionSide);
    else if (renderPlayer.action === 'fall') view.rig.setAction('fall', progress, actionSide);
    else if (renderPlayer.action === 'celebrate') view.rig.setAction('celebrate', progress, actionSide, player.number % 4);
    else if (renderPlayer.action === 'throw') view.rig.setAction('throw-in', progress, 1);
    else if (renderPlayer.action === 'kick') view.rig.setAction('kick', progress, 1);
    else if (renderPlayer.action === 'brace' || renderPlayer.action === 'block') view.rig.setAction('block', progress, actionSide);
    else if (renderPlayer.action === 'juke') view.rig.setAction('skill', progress, actionSide);
    else view.rig.setAction('idle', 0, actionSide);
    const motion = view.motion;
    motion.speedMps = speedMeters; motion.acceleration = acceleration * 6; motion.turn = turn;
    motion.isCarrier = visualBall.ownerId === player.id; motion.ball = ballWorld;
    motion.intensity = lineRoles.has(player.role) ? 0.85 : 1;
    motion.locomotion = motion.isCarrier ? 'football-carry' : player.side === 'def' && speedYards < 2.5 ? 'defensive' : undefined;
    motion.lean = renderPlayer.action === 'juke' ? actionSide * 0.08 : 0;
    view.rig.update(dt, speedMeters, motion);
    view.badge.position.set(view.visualPosition.x, lineRoles.has(player.role) ? 3.25 : 3.05, view.visualPosition.z);
    view.badge.visible = false;
    dummy.position.set(view.visualPosition.x, 0.028, view.visualPosition.z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    const shadowScale = renderPlayer.down ? 1.28 : lineRoles.has(player.role) ? 1.08 : 0.88;
    dummy.scale.set(shadowScale, shadowScale * (renderPlayer.down ? 1.35 : 0.72), 1);
    dummy.updateMatrix(); playerShadows.setMatrixAt(viewIndex++, dummy.matrix);
    view.lastSpeed = speedYards; view.lastFacing = desiredFacing;
  }
  playerShadows.count = viewIndex;
  playerShadows.instanceMatrix.needsUpdate = true;
}

function ballPresentationOpacity() {
  if (state.replayActive) return 1;
  let ballVisibility = 1;
  if (state.phase === 'dead') {
    if (state.hideDeadBall) ballVisibility = 0;
    else {
      const fadeStart = Math.max(0, state.deadHold - 0.2);
      ballVisibility = 1 - smoothstep((state.t - fadeStart) / 0.2);
    }
  } else if (state.phase === 'preplay') ballVisibility = smoothstep((state.t - 0.08) / 0.28);
  return ballVisibility;
}

function updateBallVisual(dt) {
  const replayState = replayRenderState();
  const visualBall = replayState?.ball || ball;
  const visualPhase = replayState?.phase || state.phase;
  const ballVisibility = ballPresentationOpacity();
  football.visible = state.phase !== 'final' && ballVisibility > 0.01;
  football.material.opacity = ballVisibility; laces.material.opacity = ballVisibility;
  football.position.set(worldX(visualBall.x), Math.max(BALL_RADIUS, visualBall.y), visualBall.z);
  if (ballRotationAllowed(visualBall)) {
    football.rotation.set(0.12, 0, visualBall.spin * driveDirection());
  } else {
    football.rotation.set(0, 0, 0);
  }
  ballShadow.position.set(worldX(visualBall.x), 0.045, visualBall.z);
  const shadowScale = clamp(1.2 - visualBall.y * 0.055, 0.28, 1.1);
  ballShadow.scale.setScalar(shadowScale);
  ballShadow.material.opacity = clamp(0.43 - visualBall.y * 0.012, 0.12, 0.4) * ballVisibility;
  const trailActive = ['live', 'kick', 'punt'].includes(visualPhase) && ['pass', 'kick', 'punt', 'loose'].includes(visualBall.mode) && visualBall.y > 0.45;
  if (trailActive && !trailWasActive) for (const dot of ballTrail) dot.position.copy(football.position);
  for (let index = 0; index < ballTrail.length; index += 1) {
    const dot = ballTrail[index]; dot.visible = trailActive;
    if (!trailActive) continue;
    if (index === 0) dot.position.lerp(football.position, 0.72);
    else dot.position.lerp(ballTrail[index - 1].position, 0.56);
  }
  trailWasActive = trailActive;
  const owner = visualBall.ownerId ? getPlayerById(visualBall.ownerId) : null;
  focusRing.visible = !!owner && ['carried', 'held'].includes(visualBall.mode) && visualPhase !== 'dead';
  if (focusRing.visible) {
    const ownerView = views.get(owner.id);
    const ringX = ownerView?.visualPosition.x ?? worldX(owner.x);
    const ringZ = ownerView?.visualPosition.z ?? owner.z;
    focusRing.position.set(ringX, 0.055, ringZ);
    focusRing.material.color.set(classicPlayerColor(owner.teamIndex));
    focusRing.material.opacity = 0.34 + Math.sin(presentationTime * 7) * 0.08;
    focusRing.scale.setScalar(0.92 + Math.sin(presentationTime * 5) * 0.05);
  }
  const intended = visualBall.mode === 'pass' && visualBall.intendedId ? getPlayerById(visualBall.intendedId) : null;
  if (!replayState && intended && !state.catchBeat) {
    const targetView = views.get(intended.id);
    catchRing.material.color.set(classicPlayerColor(intended.teamIndex));
    catchRing.material.opacity = 0.35 + 0.22 * Math.max(0, Math.sin(presentationTime * 9));
    catchRing.position.set(targetView?.visualPosition.x ?? worldX(intended.x), 0.058, targetView?.visualPosition.z ?? intended.z);
    catchRing.scale.setScalar(0.84 + clamp(visualBall.flightTime / Math.max(visualBall.targetTime, 0.1), 0, 1) * 0.48);
  } else if (!replayState && state.catchBeat) {
    catchRing.material.opacity = 0.72 * (1 - clamp(state.catchBeat.t / 0.44, 0, 1) * 0.35);
    catchRing.position.set(worldX(state.catchBeat.x), 0.058, state.catchBeat.z);
    catchRing.scale.setScalar(0.75 + clamp(state.catchBeat.t / 0.44, 0, 1) * 1.3);
  } else catchRing.material.opacity = 0;
  impactRing.material.opacity = replayState ? 0 : impactPulse * 0.78;
  const impactSource = !replayState && state.contact ? getPlayerById(state.contact.carrierId) : !replayState && (ball.ruling === 'upright' || ball.ruling === 'crossbar') ? { x: GOAL_PLANE, z: ball.z } : null;
  if (impactSource) {
    impactRing.position.set(worldX(impactSource.x), 0.06, impactSource.z);
    impactRing.scale.setScalar(0.8 + (1 - impactPulse) * 1.5);
    impactRing.material.color.set(ball.ruling ? 0xffd568 : 0xff637b);
  }
}

let crowdFrame = 0;
function updateCrowd() {
  crowdFrame += 1;
  if (crowdFrame % 4 !== 0) return;
  const liveEnergy = state.phase === 'live' || state.phase === 'punt' || state.phase === 'kick' ? 0.08 : 0;
  const energy = clamp(crowdHeat + liveEnergy, 0, 1);
  if (energy < 0.015) return;
  const now = performance.now() * 0.001;
  for (let index = 0; index < crowdCount; index += 1) {
    const base = crowdBase[index];
    const jump = energy * Math.max(0, Math.sin(now * (5.5 + energy * 3) + base.phase)) * 0.38;
    dummy.position.set(base.x, base.y + jump, base.z); dummy.scale.setScalar(base.scale); dummy.rotation.set(0, base.z < 0 ? 0 : Math.PI, 0); dummy.updateMatrix();
    crowdBodies.setMatrixAt(index, dummy.matrix);
    dummy.position.y = base.y + 0.53 * base.scale + jump; dummy.updateMatrix(); crowdHeads.setMatrixAt(index, dummy.matrix);
  }
  crowdBodies.instanceMatrix.needsUpdate = true; crowdHeads.instanceMatrix.needsUpdate = true;
}

let lastCameraMode = '';
function updateCamera(dt) {
  const replayState = replayRenderState();
  const visualPhase = replayState?.phase || state.phase;
  const visualStage = replayState?.playStage || state.playStage;
  const visualBall = replayState?.ball || ball;
  const visualSpot = replayState?.ballSpot ?? state.ballSpot;
  const portrait = innerWidth < 700 && innerHeight > innerWidth * 1.18;
  const side = fixture % 2 ? -1 : 1;
  const direction = replayState ? (replayState.possession === 0 ? 1 : -1) : driveDirection();
  const toWorldX = (gameX) => (gameX - 50) * direction;
  const runner = replayState ? replayState.players.find((player) => player.id === replayState.carrierId) || null : carrier();
  let focusGameX = runner?.x ?? (['pass', 'kick', 'punt', 'loose'].includes(visualBall.mode) ? visualBall.x : visualSpot);
  let focusZ = runner?.z ?? visualBall.z;
  let desired, target, fov;
  if (visualPhase === 'kick') {
    cameraMode = 'kick_track';
    focusGameX = visualBall.mode === 'kick' ? visualBall.x : visualSpot - 7;
    const focusX = toWorldX(focusGameX);
    const goalX = toWorldX(GOAL_PLANE);
    const lookAhead = focusX + direction * (portrait ? 22 : 20);
    const targetX = direction > 0 ? Math.min(goalX, lookAhead) : Math.max(goalX, lookAhead);
    desired = new THREE.Vector3(clamp(focusX - direction * (portrait ? 14 : 12), -55, 55), portrait ? 13 : 8.5, side * (portrait ? 16 : 10));
    target = new THREE.Vector3(targetX, visualBall.mode === 'kick' ? clamp(visualBall.y * 0.24 + 2.5, 2.8, 5.2) : 2.7, lerp(focusZ, 0, 0.18));
    fov = portrait ? 47 : 38;
  } else if (visualPhase === 'punt') {
    cameraMode = visualBall.mode === 'punt' ? 'punt_flight' : visualStage === 'punt_return' ? 'return' : 'special_teams';
    const focusX = toWorldX(focusGameX);
    desired = new THREE.Vector3(clamp(focusX - direction * 10, -54, 54), portrait ? 20 : 15, side * (portrait ? 38 : 32));
    target = new THREE.Vector3(clamp(focusX + direction * 5, -58, 58), visualBall.mode === 'punt' ? clamp(visualBall.y * 0.23, 1, 5) : 1, focusZ * 0.45);
    fov = portrait ? 51 : 41;
  } else if (visualBall.mode === 'pass') {
    cameraMode = 'deep_ball';
    const focusX = toWorldX(focusGameX);
    desired = new THREE.Vector3(clamp(focusX - direction * 9, -53, 53), portrait ? 21 : 17.5, side * (portrait ? 40 : 35));
    target = new THREE.Vector3(focusX + direction * 5, clamp(visualBall.y * 0.35, 1, 4.2), focusZ * 0.52);
    fov = portrait ? 52 : 42;
  } else {
    cameraMode = replayState ? 'replay_sideline' : visualPhase === 'preplay' ? 'line' : visualPhase === 'dead' ? 'dead_ball' : 'carrier';
    const focusX = clamp(toWorldX(focusGameX), -49, 49);
    const portraitLive = portrait && (visualPhase === 'live' || !!replayState);
    desired = new THREE.Vector3(
      focusX - direction * (portrait ? 9 : 7),
      portrait ? (portraitLive ? 15.8 : 18.5) : 14.8,
      side * (portrait ? (portraitLive ? 31.5 : 36) : 32),
    );
    target = new THREE.Vector3(
      focusX + direction * (visualPhase === 'preplay' ? 4 : 2.5),
      portrait ? (visualPhase === 'dead' ? 0.4 : 0.55) : visualPhase === 'dead' ? 0.75 : 1,
      clamp(focusZ * 0.45, -12, 12),
    );
    fov = portrait ? (portraitLive ? 45 : 48) : 38;
  }
  const changed = cameraMode !== lastCameraMode;
  const cameraRate = changed && visualPhase !== 'live' ? 6.2 : 3.8;
  const blend = cameraReady ? damp(cameraRate, dt) : 1;
  camera.position.lerp(desired, blend);
  cameraTarget.lerp(target, blend);
  camera.fov += (fov - camera.fov) * damp(5, dt);
  camera.updateProjectionMatrix(); camera.lookAt(cameraTarget);
  cameraReady = true; lastCameraMode = cameraMode;
}

function renderFrame(dt = 1 / 60) {
  updatePlayerViews(Math.min(dt, 0.05));
  updateBallVisual(dt);
  updateCrowd();
  venueIdentity.update(dt, {
    phase: state.phase,
    crowdHeat,
    down: state.down,
    ballSpot: state.ballSpot,
    possession: state.possession,
  });
  lineOfScrimmage.material.opacity = state.phase === 'preplay' ? 0.72 + Math.sin(performance.now() * 0.008) * 0.14 : 0.64;
  lineToGain.material.opacity = 0.78 + Math.sin(performance.now() * 0.003) * 0.09;
  updateCamera(dt);
  updateHud();
  renderer.render(scene, camera);
}

function renderGameState() {
  const visibleReplay = replayRenderState();
  const visibleBall = visibleReplay?.ball || ball;
  const visiblePlayers = visibleReplay ? new Map(visibleReplay.players.map((player) => [player.id, player])) : null;
  const runner = visibleReplay
    ? visibleReplay.players.find((player) => player.id === visibleReplay.carrierId) || null
    : carrier();
  const runnerIdentity = runner ? getPlayerById(runner.id) || runner : null;
  const kick = ball.kick;
  const foundingCues = players.map((player, entityIndex) => {
    const cue = views.get(player.id)?.rig?.group?.userData?.foundingCue;
    if (!cue) return null;
    const teamPlayerIndex = teams[player.teamIndex].athletes.indexOf(player.athlete);
    return { ...cue, side:player.teamIndex, entityIndex, teamPlayerIndex, arenaRole:player.role };
  }).filter(Boolean).sort((a, b) => a.entityIndex - b.entityIndex);
  return JSON.stringify({
    screen: 'american-football', renderer: 'three-only-sideline-broadcast',
    autonomous: true, interaction: 'view-only',
    note: 'Simulation x runs possession-relative from own goal (0) to opponent goal (100); world rendering mirrors x for the away offense so painted end zones stay fixed. Goalpost plane is x=110, y is height in yards, and z is lateral. No 2D overhead renderer exists.',
    fixture, phase: state.replayActive ? 'replay' : state.phase, simulationPhase: state.phase,
    playStage: visibleReplay?.playStage || state.playStage, paused: state.paused,
    quarter: state.quarter, clock: +state.clock.toFixed(1), playClock: +state.playClock.toFixed(1), timeouts: state.timeouts.slice(), score: { home: state.score[0], away: state.score[1] },
    teams: teams.map((team) => team.name), possession: teams[state.possession].code,
    teamIdentity: teams.map((team) => {
      const identity = footballClubEquipmentPalette(team);
      return {
        id: team.id, code: team.code, name: team.name, colors: team.colors,
        venue: identity.venue, kitPattern: identity.pattern, mark: identity.mark,
      };
    }),
    down: state.down, toGo: +state.toGo.toFixed(1), ballSpot: +state.ballSpot.toFixed(1), fieldPosition: fieldPositionLabel(),
    automaticCall: state.play, defensiveCall: state.defense,
    strategy: {
      offenseIdentity: teamDNA[state.possession].label,
      defenseIdentity: teamDNA[1 - state.possession].label,
      offenseReason: state.offenseDecision?.selected?.reasons?.[0]?.label || null,
      defenseReason: state.defenseDecision?.selected?.reasons?.[0]?.label || null,
      adjustment: state.adjustment,
      qbDecision: state.qbDecision ? { action: state.qbDecision.action, readOrder: state.qbDecision.readOrder, reason: state.qbDecision.reason } : null,
    },
    actionCausality: {
      call: state.play,
      formation: PLAYS[state.play]?.formation || null,
      stage: visibleReplay?.playStage || state.playStage,
      intendedTarget: visibleBall.intendedId ? getPlayerById(visibleBall.intendedId)?.name || null : null,
      carrier: runnerIdentity?.name || null,
      pressure: +(state.pressure || 0).toFixed(2),
      coordinatorReason: state.offenseDecision?.selected?.reasons?.[0]?.label || null,
      defensiveReason: state.defenseDecision?.selected?.reasons?.[0]?.label || null,
      completedPlayExplanation: state.lastSnap?.explanation || null,
    },
    ball: {
      mode: visibleBall.mode, ownerId: visibleBall.ownerId, intendedId: visibleBall.intendedId,
      visible: football.visible, opacity: +football.material.opacity.toFixed(3),
      position: { x: +visibleBall.x.toFixed(2), y: +visibleBall.y.toFixed(2), z: +visibleBall.z.toFixed(2) },
      velocity: { x: +visibleBall.vx.toFixed(2), y: +visibleBall.vy.toFixed(2), z: +visibleBall.vz.toFixed(2) },
      spin: +(ballRotationAllowed(visibleBall) ? visibleBall.spin : 0).toFixed(3),
      visualRotation: { x: +football.rotation.x.toFixed(3), y: +football.rotation.y.toFixed(3), z: +football.rotation.z.toFixed(3) },
      ruling: ball.ruling,
      kick: kick ? {
        type: kick.type, distance: kick.distance, wind: kick.wind, targetHeight: +kick.targetHeight.toFixed(2), targetZ: +kick.targetZ.toFixed(2),
        crossing: kick.crossing ? { x: +kick.crossing.x.toFixed(2), y: +kick.crossing.y.toFixed(2), z: +kick.crossing.z.toFixed(2), ruling: kick.crossing.ruling } : null,
      } : null,
    },
    carrier: runner ? { id: runner.id, side: runnerIdentity?.side, role: runnerIdentity?.role, name: runnerIdentity?.name, x: +runner.x.toFixed(2), z: +runner.z.toFixed(2), jukeCooldown: +(runnerIdentity?.jukeCooldown || 0).toFixed(2), jukeImmune: +(runnerIdentity?.jukeImmune || 0).toFixed(2) } : null,
    catch: (visibleReplay?.catchBeat || state.catchBeat) ? {
      outcome: state.catchBeat?.outcome || null,
      catcherId: (visibleReplay?.catchBeat || state.catchBeat).catcherId,
      intendedId: (visibleReplay?.catchBeat || state.catchBeat).intendedId,
      elapsed: +(visibleReplay?.catchBeat?.t ?? state.catchBeat?.t ?? 0).toFixed(2),
    } : null,
    contact: (visibleReplay?.contact || state.contact) ? {
      carrierId: (visibleReplay?.contact || state.contact).carrierId,
      tacklerIds: (visibleReplay?.contact || state.contact).tacklerIds.slice(),
      outcome: (visibleReplay?.contact || state.contact).outcome,
      elapsed: +(visibleReplay?.contact?.t ?? state.contact?.t ?? 0).toFixed(2),
      impactSpeed: +(state.contact?.impactSpeed || 0).toFixed(2),
    } : null,
    camera: { mode: cameraMode, position: { x: +camera.position.x.toFixed(2), y: +camera.position.y.toFixed(2), z: +camera.position.z.toFixed(2) }, fov: +camera.fov.toFixed(1) },
    presentation: {
      formationTransition: state.formationTransition, ballOpacity: +ballPresentationOpacity().toFixed(2),
      secondsToSnap: state.phase === 'preplay' ? +Math.max(0, PREPLAY_SECONDS - state.t).toFixed(2) : 0,
      replay: { ...replayBuffer.status, active: state.replayActive, candidate: state.replayCandidate?.type || null },
      audio: audioDirector.state,
      venue: venueIdentity.state(),
    },
    performance: { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio() },
    drive: { plays: state.drivePlays, yards: state.driveYards, firstDowns: state.firstDowns, start: state.driveStart },
    stats: {
      completedPasses: state.completedPasses, tackles: state.tackles, brokenTackles: state.brokenTackles, jukes: state.userJukes,
      teams: teamGameStats.map((stats, index) => ({ team: teams[index].code, ...stats })),
    },
    lastSnap: state.lastSnap,
    foundingCues,
    players: players.map((player) => {
      const visible = visiblePlayers?.get(player.id) || player;
      return ({
      id: player.id, side: player.side, team: teams[player.teamIndex].code, role: player.role, number: player.number,
      x: +visible.x.toFixed(2), z: +visible.z.toFixed(2), vx: +visible.vx.toFixed(2), vz: +visible.vz.toFixed(2),
      facing: +visible.facing.toFixed(2), action: visible.action, actionProgress: +(visible.actionProgress ?? clamp(player.actionT / player.actionDuration, 0, 1)).toFixed(2), down: visible.down, engagedId: player.engagedId,
      stamina: +player.stamina.toFixed(3), wear: +player.wear.toFixed(3), traits: player.traitLabel,
    }); }),
    headline: state.headline, detail: state.detail, lastEvent: state.lastEvent, recentEvents: state.events.slice(0, 5), gameOver: state.gameOver,
  });
}

window.render_game_to_text = renderGameState;
window.advanceTime = (milliseconds) => {
  manualMode = true;
  const wasPaused = state.paused; state.paused = false;
  const frames = Math.max(1, Math.round(Number(milliseconds || 0) / (1000 / 60)));
  for (let frame = 0; frame < frames; frame += 1) step(1 / 60);
  state.paused = wasPaused;
  renderFrame(Math.min(0.05, Math.max(1 / 60, Number(milliseconds || 0) / 1000)));
  return renderGameState();
};

window._footballTest = {
  state: () => JSON.parse(renderGameState()),
  forceSituation(options = {}) {
    manualMode = true;
    state.specialTry = null;
    state.possession = clamp(Number(options.possession ?? state.possession), 0, 1);
    state.down = clamp(Number(options.down ?? 1), 1, 4);
    state.toGo = clamp(Number(options.toGo ?? 10), 1, 30);
    state.ballSpot = clamp(Number(options.ballSpot ?? options.ball ?? 25), 1, 99);
    state.quarter = clamp(Number(options.quarter ?? state.quarter), 1, 5);
    state.clock = clamp(Number(options.clock ?? QUARTER_SECONDS), 0, QUARTER_SECONDS);
    state.rosterKey = null;
    beginPreplay(options.play);
    renderFrame();
    return JSON.parse(renderGameState());
  },
  forcePlay(name) { beginPreplay(String(name || '').toUpperCase()); renderFrame(); return state.play; },
  forceCatch(outcome = 'complete', play = 'QUICK SLANTS') { state.testCatchOutcome = String(outcome).toLowerCase(); beginPreplay(String(play).toUpperCase()); return JSON.parse(renderGameState()); },
  forceTackle(outcome = 'down') { state.testTackleOutcome = String(outcome).toLowerCase(); return true; },
  forcePenalty(type = 'false-start', play = null) {
    manualMode = true;
    const normalized = String(type).toLowerCase();
    state.flag = null;
    state.testPenalty = normalized;
    const forcedPlay = play || (normalized === 'dpi' ? 'FOUR VERTICALS' : normalized === 'holding' ? 'INSIDE ZONE' : null);
    beginPreplay(forcedPlay ? String(forcedPlay).toUpperCase() : null);
    renderFrame();
    return JSON.parse(renderGameState());
  },
  stageTackle(outcome = 'down', maxSeconds = 8) {
    manualMode = true; const wasPaused = state.paused; state.paused = false;
    for (let frame = 0; frame < Math.ceil(Number(maxSeconds) * 60); frame += 1) {
      step(1 / 60);
      if (ball.mode === 'carried' && state.carrierId && !['dropback', 'snap', 'mesh'].includes(state.playStage)) break;
    }
    const runner = carrier();
    if (runner && state.phase !== 'dead') {
      const pool = runner.side === 'off' ? defensePlayers() : offensePlayers();
      const tackler = closestPlayer(pool.filter((player) => !player.down), runner);
      if (tackler) {
        const forward = runner.side === 'off' ? 1 : -1;
        runner.jukeImmune = 0; tackler.down = false; tackler.engagedId = null;
        tackler.x = runner.x + forward * 0.76; tackler.z = runner.z;
        state.testTackleOutcome = String(outcome).toLowerCase(); beginTackle(tackler);
        for (let frame = 0; frame < 14 && state.contact; frame += 1) step(1 / 60);
      }
    }
    state.paused = wasPaused; renderFrame(); return JSON.parse(renderGameState());
  },
  forceFieldGoal(ruling = 'good', ballSpot = 65) {
    state.specialTry = null; state.down = 4; state.toGo = 7; state.ballSpot = clamp(Number(ballSpot), 40, 92); state.testKick = String(ruling).toLowerCase();
    beginPreplay('FIELD GOAL'); renderFrame(); return JSON.parse(renderGameState());
  },
  forcePAT(ruling = 'good', team = state.possession) { state.testKick = String(ruling).toLowerCase(); beginPAT(clamp(Number(team), 0, 1)); renderFrame(); return JSON.parse(renderGameState()); },
  startAutomaticPlay() { startAutomaticPlay(); renderFrame(); return JSON.parse(renderGameState()); },
  juke() { input.juke = true; const result = attemptJuke(true); renderFrame(); return result; },
  advanceUntilContact(maxSeconds = 12) {
    manualMode = true; const wasPaused = state.paused; state.paused = false;
    for (let frame = 0; frame < Math.ceil(Number(maxSeconds) * 60); frame += 1) {
      step(1 / 60);
      if (state.contact?.t >= 0.22 || state.phase === 'dead' || state.phase === 'final') break;
    }
    state.paused = wasPaused; renderFrame(); return JSON.parse(renderGameState());
  },
  advanceUntilCarried(maxSeconds = 8) {
    manualMode = true; const wasPaused = state.paused; state.paused = false;
    for (let frame = 0; frame < Math.ceil(Number(maxSeconds) * 60); frame += 1) {
      step(1 / 60);
      if (ball.mode === 'carried' && state.carrierId && !['dropback', 'snap', 'mesh'].includes(state.playStage)) break;
    }
    state.paused = wasPaused; renderFrame(); return JSON.parse(renderGameState());
  },
  advanceUntilBallMode(mode = 'pass', maxSeconds = 8) {
    manualMode = true; const wasPaused = state.paused; state.paused = false;
    for (let frame = 0; frame < Math.ceil(Number(maxSeconds) * 60); frame += 1) {
      step(1 / 60);
      if (ball.mode === String(mode) || state.phase === 'dead' || state.phase === 'final') break;
    }
    state.paused = wasPaused; renderFrame(); return JSON.parse(renderGameState());
  },
  advanceUntilKickCrossing(maxSeconds = 8) {
    manualMode = true; const wasPaused = state.paused; state.paused = false;
    for (let frame = 0; frame < Math.ceil(Number(maxSeconds) * 60); frame += 1) {
      step(1 / 60);
      if (ball.kick?.crossing || state.phase === 'dead' || state.phase === 'final') break;
    }
    state.paused = wasPaused; renderFrame(); return JSON.parse(renderGameState());
  },
  advanceUntilReplay(maxSeconds = 15) {
    manualMode = true; const wasPaused = state.paused; state.paused = false;
    for (let frame = 0; frame < Math.ceil(Number(maxSeconds) * 60); frame += 1) {
      step(1 / 60);
      if (state.replayActive || state.phase === 'final') break;
    }
    state.paused = wasPaused; renderFrame(); return JSON.parse(renderGameState());
  },
  finishPlay(maxSeconds = 15) {
    manualMode = true; const wasPaused = state.paused; state.paused = false;
    const startingPhase = state.phase;
    for (let frame = 0; frame < Math.ceil(Number(maxSeconds) * 60); frame += 1) {
      step(1 / 60);
      if (state.phase === 'dead' || state.phase === 'final' || (state.phase === 'preplay' && startingPhase !== 'preplay')) break;
    }
    state.paused = wasPaused; renderFrame(); return JSON.parse(renderGameState());
  },
  soak(milliseconds = 60000) {
    manualMode = true; const wasPaused = state.paused; state.paused = false;
    const frames = Math.ceil(Number(milliseconds) / 50);
    for (let index = 0; index < frames && !state.gameOver; index += 1) step(0.05);
    state.paused = wasPaused; renderFrame(); return JSON.parse(renderGameState());
  },
  coordinatorMemory: () => JSON.parse(JSON.stringify(coordinatorMemory)),
  forceFinal(homeScore, awayScore) { manualMode = true; state.score = [Number(homeScore) || 0, Number(awayScore) || 0]; finishGame(); renderFrame(); return true; },
};

function resize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.1 : 1.25));
  renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = innerWidth >= 700;
  renderFrame();
}
addEventListener('resize', resize);

document.documentElement.style.setProperty('--home', teams[0].colors.primary);
document.documentElement.style.setProperty('--away', teams[1].colors.primary);
document.querySelector('.homeClub .clubMark').style.setProperty('--club', teams[0].colors.primary);
document.querySelector('.awayClub .clubMark').style.setProperty('--club', teams[1].colors.primary);
$('homeMark').textContent = teams[0].code; $('awayMark').textContent = teams[1].code;
$('homeCity').textContent = teams[0].city.toUpperCase(); $('awayCity').textContent = teams[1].city.toUpperCase();
$('homeName').textContent = teams[0].name.replace(`${teams[0].city.toUpperCase()} `, '');
$('awayName').textContent = teams[1].name.replace(`${teams[1].city.toUpperCase()} `, '');

beginPreplay();
renderFrame();
requestAnimationFrame(() => $('loading').classList.add('ready'));

let lastFrame = performance.now();
let accumulator = 0;
function frame(now) {
  const elapsed = Math.min(0.12, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  if (!manualMode) {
    accumulator += elapsed;
    let catchUpSteps = 0;
    while (accumulator >= 1 / 60 && catchUpSteps < 4) { step(1 / 60); accumulator -= 1 / 60; catchUpSteps += 1; }
    if (catchUpSteps === 4) accumulator = Math.min(accumulator, 1 / 60);
  }
  renderFrame(Math.max(1 / 120, elapsed));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

let hiddenTimer = null;
function syncHiddenSimulation() {
  if (hiddenTimer) { clearInterval(hiddenTimer); hiddenTimer = null; }
  if (!document.hidden || manualMode) return;
  hiddenTimer = setInterval(() => {
    if (document.hidden && !manualMode) {
      for (let frameIndex = 0; frameIndex < 15; frameIndex += 1) step(1 / 60);
    }
  }, 250);
}
document.addEventListener('visibilitychange', syncHiddenSimulation);
syncHiddenSimulation();
