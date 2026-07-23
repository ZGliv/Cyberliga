import * as THREE from "./vendor/three/three.module.js";

const params = new URLSearchParams(window.location.search);
const BASE_TIMELINE = window.CyberligaBasketballVisualReset;
const BROADCAST_TIMELINE = window.CyberligaBasketballBroadcastDirector;
const legacyMode = params.get("legacy") === "1";
const TIMELINE = !legacyMode && BROADCAST_TIMELINE?.sample ? BROADCAST_TIMELINE : BASE_TIMELINE;
const requestedStyle = params.get("style");
const styleName = ["maquette", "paper", "resin"].includes(requestedStyle) ? requestedStyle : "maquette";
const requestedTime = Number(params.get("time"));
const captureMode = params.has("time") && Number.isFinite(requestedTime);
const DURATION_MS = Number.isFinite(TIMELINE?.durationMs) ? TIMELINE.durationMs : 15000;
const MILESTONES = TIMELINE?.milestones || Object.freeze({
  rimCrossingMs: 8350,
  scoreCertifiedMs: 8500,
  landingMs: 9100,
  stoopySecondJumpReadyMs: 10060,
  lowerThirdMs: 12600,
  resetCutMs: 14500,
});
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Vector3();
const tempA = new THREE.Vector3();
const tempB = new THREE.Vector3();
const tempC = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();

const palettes = {
  maquette: {
    sky: 0xd8c8a6,
    wall: 0x9e7557,
    wallDark: 0x6f5142,
    window: 0xeadcaf,
    mullion: 0x3a3932,
    wood: 0xc38856,
    woodAlt: 0xcd9361,
    courtInk: 0xf1e5c7,
    courtPaint: 0xad644b,
    ink: 0x292723,
    ivory: 0xeee5d2,
    home: 0x1da6a1,
    away: 0xd24c77,
    ball: 0xb9572d,
    rim: 0x9e3f2c,
    crowd: [0x456f68, 0xc85854, 0xd7a64b, 0x49617d, 0xc97754, 0x6e7154],
    roughness: 0.92,
    metalness: 0.01,
  },
  paper: {
    sky: 0xe3dccb,
    wall: 0xa8977f,
    wallDark: 0x675f55,
    window: 0xf1e7c9,
    mullion: 0x393833,
    wood: 0xd0aa77,
    woodAlt: 0xd6b281,
    courtInk: 0xf7f1e3,
    courtPaint: 0xb8896c,
    ink: 0x272724,
    ivory: 0xf2ecdf,
    home: 0x3b9996,
    away: 0xc95f7f,
    ball: 0xb9683d,
    rim: 0x984938,
    crowd: [0x657d72, 0xb96b62, 0xc4a060, 0x647287, 0xb78369, 0x7b7d69],
    roughness: 1,
    metalness: 0,
  },
  resin: {
    sky: 0xc5b596,
    wall: 0x88654f,
    wallDark: 0x4a3c35,
    window: 0xd9c892,
    mullion: 0x242724,
    wood: 0xb67448,
    woodAlt: 0xc17e4e,
    courtInk: 0xead9b6,
    courtPaint: 0x8d5046,
    ink: 0x202220,
    ivory: 0xdcd3c1,
    home: 0x168c8a,
    away: 0xb93663,
    ball: 0x9e4528,
    rim: 0x843626,
    crowd: [0x345e59, 0xa94b4a, 0xc2923b, 0x3d516d, 0xa9664b, 0x5b654c],
    roughness: 0.72,
    metalness: 0.02,
  },
};

const palette = palettes[styleName];
const materialTheses = Object.freeze({
  maquette: "matte molded foam, dyed rubber, painted wood, hard photographed key",
  paper: "folded card stock, flat pigment, ink-cut edges, low-contrast soft shadow",
  resin: "smooth molded resin, deeper pigment, restrained tight specular, no bloom",
});
const materials = makeMaterials(palette);
const canvas = document.getElementById("visual-reset-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = styleName === "paper" ? 1.08 : 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(palette.sky, 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(palette.sky);
const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 380);
camera.position.set(18, 19, 46);
camera.lookAt(25, 4, 0);

const world = new THREE.Group();
scene.add(world);
const environment = buildHighRoom();
world.add(environment.root);

const actorLayer = new THREE.Group();
actorLayer.name = "Authored athletes";
world.add(actorLayer);
const actorRigs = new Map();
const ballRig = buildBall();
world.add(ballRig.root);

const scoreHome = document.getElementById("score-home");
const scoreAway = document.getElementById("score-away");
const scoreClock = document.getElementById("score-clock");
const shotClock = document.getElementById("shot-clock");
const periodLabel = document.getElementById("period-label");
const possessionLine = document.getElementById("possession-line");
const modeBug = document.getElementById("mode-bug");
const modeLabel = document.getElementById("mode-label");
const soundControl = document.getElementById("sound-control");
const soundIcon = document.getElementById("sound-icon");
const soundLabel = document.getElementById("sound-label");
const storyCard = document.getElementById("story-card");
const storyKicker = document.getElementById("story-kicker");
const storyTitle = document.getElementById("story-title");
const homePrincipal = document.getElementById("home-principal");
const homeTrait = document.getElementById("home-trait");
const awayPrincipal = document.getElementById("away-principal");
const awayTrait = document.getElementById("away-trait");
const lowerThird = document.getElementById("lower-third");
const lowerKicker = document.getElementById("lower-kicker");
const lowerTitle = document.getElementById("lower-title");
const lowerDetail = document.getElementById("lower-detail");
const readCard = document.getElementById("read-card");
const readKicker = document.getElementById("read-kicker");
const readCopy = document.getElementById("read-copy");
const commentaryLine = document.getElementById("commentary-line");
const replayOverlay = document.getElementById("replay-overlay");
const stakeRibbon = document.getElementById("stake-ribbon");
const broadcastFade = document.getElementById("broadcast-fade");
const loadingNote = document.getElementById("loading-note");
const AUDIO_API = window.CyberligaBasketballBroadcastAudio;
const broadcastAudio = AUDIO_API?.createBroadcastAudio
  ? AUDIO_API.createBroadcastAudio({
      volume: 0.72,
      muted: false,
      cueCatalogue: BROADCAST_TIMELINE?.audioCues || [],
    })
  : null;

let timelineMs = captureMode ? requestedTime : 0;
let lastFrameAt = performance.now();
let manualHoldUntil = 0;
let lastSample = null;
let finiteState = true;
let lowerThirdProgress = 0;
let frameIntervalMs = 0;
let droppedFrameEstimate = 0;
let lastAudioLoopId = null;
let lastDrawWasContinuous = false;
let wallClockStartedAt = performance.now();
let timelineStartedAt = timelineMs;
let performanceWarmupUntil = performance.now() + 2000;
const renderDurations = [];
let renderedCamera = {
  shot: "wide",
  position: { x: 18, y: -46, z: 19 },
  lookAt: { x: 25, y: 0, z: 4 },
};

if (!TIMELINE?.sample) loadingNote?.classList.add("visible");
if (!BROADCAST_TIMELINE?.sample && !legacyMode) loadingNote?.classList.add("visible");

resize();
window.addEventListener("resize", resize, { passive: true });
soundControl?.addEventListener("click", handleSoundControl);

window.advanceTime = (ms) => {
  const delta = Number(ms);
  if (!Number.isFinite(delta)) return renderGameToText();
  timelineMs += Math.max(0, delta);
  manualHoldUntil = performance.now() + 900;
  wallClockStartedAt = performance.now();
  timelineStartedAt = timelineMs;
  drawFrame(timelineMs, false);
  return renderGameToText();
};

window.render_game_to_text = renderGameToText;
window.__CYBERLIGA_VISUAL_RESET__ = Object.freeze({
  version: "1.0.0",
  style: styleName,
  broadcastDirector: TIMELINE === BROADCAST_TIMELINE,
  captureMode,
  durationMs: DURATION_MS,
});

drawFrame(timelineMs, false);
requestAnimationFrame(frame);

function frame(now) {
  const elapsed = Math.max(0, now - lastFrameAt);
  lastFrameAt = now;
  frameIntervalMs = elapsed;
  if (now >= performanceWarmupUntil && elapsed > 20 && elapsed < 1000) {
    droppedFrameEstimate += Math.max(0, Math.round(elapsed / (1000 / 60)) - 1);
  }
  if (!captureMode && now >= manualHoldUntil) timelineMs += elapsed;
  drawFrame(timelineMs, !captureMode && now >= manualHoldUntil);
  requestAnimationFrame(frame);
}

function drawFrame(ms, continuous = false) {
  const renderStartedAt = performance.now();
  const sample = sampleTimeline(ms);
  lastSample = sample;
  lastDrawWasContinuous = continuous;
  syncActors(sample);
  syncBall(sample);
  syncHoop(sample);
  syncCamera(sample);
  syncCrowd(sample);
  syncBroadcast(sample);
  syncAudio(sample, continuous);
  finiteState = inspectFinite(sample) && inspectSceneFinite();
  renderer.render(scene, camera);
  const renderDuration = performance.now() - renderStartedAt;
  if (performance.now() >= performanceWarmupUntil && Number.isFinite(renderDuration) && renderDuration < 1000) {
    renderDurations.push(renderDuration);
    if (renderDurations.length > 240) renderDurations.shift();
  }
}

function sampleTimeline(ms) {
  if (TIMELINE?.sample) {
    try {
      return TIMELINE.sample(ms);
    } catch (error) {
      loadingNote.textContent = "Timeline fault · showing rehearsal";
      loadingNote.classList.add("visible");
    }
  }
  return rehearsalSample(ms);
}

async function handleSoundControl() {
  if (!broadcastAudio) return;
  const current = broadcastAudio.status();
  try {
    if (current.locked) {
      await broadcastAudio.unlock();
      if (lastSample) broadcastAudio.seek(lastSample, broadcastLoopId(lastSample));
    } else {
      broadcastAudio.setMuted(!current.muted);
    }
  } catch (error) {
    loadingNote.textContent = "Arena sound unavailable on this device";
    loadingNote.classList.add("visible");
  }
  updateSoundControl();
}

function broadcastLoopId(sample) {
  return String(sample?.broadcast?.loopId ?? sample?.loop ?? Math.floor(Math.max(0, timelineMs) / Math.max(1, DURATION_MS)));
}

function syncAudio(sample, continuous) {
  if (!broadcastAudio) {
    updateSoundControl();
    return;
  }
  const loopId = broadcastLoopId(sample);
  if (loopId !== lastAudioLoopId) {
    broadcastAudio.reset(loopId, sample);
    lastAudioLoopId = loopId;
  } else if (continuous) {
    broadcastAudio.consume(sample, { continuous: true });
  } else {
    broadcastAudio.seek(sample, loopId);
  }
  updateSoundControl();
}

function updateSoundControl() {
  if (!soundControl) return;
  const status = broadcastAudio?.status?.() || { state: "unavailable", locked: true, muted: false };
  const state = status.state || "locked";
  soundControl.dataset.state = state;
  soundControl.setAttribute("aria-pressed", String(state === "running"));
  if (!broadcastAudio) {
    soundIcon.textContent = "×";
    soundLabel.textContent = "Sound unavailable";
    soundControl.disabled = true;
    return;
  }
  if (status.locked) {
    soundIcon.textContent = "◌";
    soundLabel.textContent = "Turn sound on";
    soundControl.setAttribute("aria-label", "Turn on arena sound");
  } else if (status.muted) {
    soundIcon.textContent = "×";
    soundLabel.textContent = "Sound off";
    soundControl.setAttribute("aria-label", "Turn arena sound on");
  } else {
    soundIcon.textContent = "◉";
    soundLabel.textContent = "Sound on";
    soundControl.setAttribute("aria-label", "Mute arena sound");
  }
}

function rehearsalSample(ms) {
  const t = wrapTime(ms);
  const p = t / DURATION_MS;
  const dunk = smoothstep(6200, 8600, t);
  const land = smoothstep(8600, 9300, t);
  const players = [
    actor("stoopy", "Stoopy", "NYB", "home", 28 + 12 * smoothstep(2600, 7300, t), -1.5, t < 6100 ? "roll" : t < 8500 ? "dunk" : "land", dunk),
    actor("toque", "Toque", "TLE", "away", 35 + 5 * smoothstep(4800, 7600, t), 1.3, t < 7200 ? "rotate" : "contest", dunk),
    actor("lintel", "Lintel", "NYB", "home", 18 + 12 * smoothstep(0, 5500, t), -3.5, t < 5000 ? "drive" : "follow", p),
    actor("switchyard", "Switchyard", "TLE", "away", 21 + 9 * smoothstep(0, 5000, t), -2.4, t < 3000 ? "chase" : "screen-hit", p),
    actor("morrow", "Morrow", "NYB", "home", 28, 15, "space", p),
    actor("sleet", "Sleet", "TLE", "away", 31, 12, "help", p),
    actor("keystone", "Keystone", "NYB", "home", 17, -16, "space", p),
    actor("rime", "Rime", "TLE", "away", 23, -13, "tag", p),
  ];
  const ball = t < 5000
    ? { state: "controlled", ownerId: "lintel", hand: "right", position: { x: 21 + 8 * smoothstep(0, 5000, t), y: -4, z: 3.8 }, contact: "hand" }
    : t < 6100
      ? { state: "pass", ownerId: null, hand: null, position: { x: lerp(29, 34.6, smoothstep(5000, 6100, t)), y: lerp(-4, -1.5, smoothstep(5000, 6100, t)), z: 4.1 }, contact: null }
      : t < 8350
        ? { state: "controlled", ownerId: "stoopy", hand: "both", position: { x: lerp(35, 42, dunk), y: -1.5, z: lerp(4.5, 10.2, dunk) }, contact: "hand" }
        : { state: "rim", ownerId: null, hand: null, position: { x: 42, y: 0, z: 10 - 5 * smoothstep(8350, 9300, t) }, contact: t < 8500 ? "rim" : null };
  return {
    version: "rehearsal",
    timeMs: t,
    phase: { id: t < 3000 ? "screen" : t < 6100 ? "pocket-pass" : t < 8500 ? "stoop-drop" : t < 10060 ? "landing" : "consequence", progress: p },
    camera: {
      id: "rehearsal-camera",
      shot: t < 5600 ? "wide" : t < 8500 ? "medium" : "aftermath",
      position: t < 5600 ? { x: 22, y: -48, z: 24 } : t < 8500 ? { x: 31, y: -39, z: 19 } : { x: 35, y: -31, z: 15 },
      lookAt: t < 5600 ? { x: 29, y: 0, z: 4 } : { x: 38, y: 0, z: 6 },
      targetIds: ["stoopy", "toque"],
    },
    actors: players,
    ball,
    score: { home: t >= 8500 ? 74 : 72, away: 71, certified: t >= 8500, certifiedAtMs: 8500 },
    contacts: { screen: t >= 3000, catch: t >= 6100, rim: t >= 8350, landing: t >= 9100 },
    consequence: { stoopySecondJumpReady: t >= 10060 },
    presentation: { crowdReaction: smoothstep(8500, 10200, t), lowerThird: t >= 12600 && t < 14800 },
  };
}

function actor(id, name, teamId, side, x, y, poseId, progress) {
  return {
    id,
    name,
    teamId,
    side,
    role: id === "stoopy" || id === "toque" ? "founder" : "support",
    position: { x, y, z: 0 },
    facing: 0,
    pose: { id: poseId, progress, plant: "both", jump: poseId === "dunk" || poseId === "contest" ? Math.sin(Math.min(1, progress) * Math.PI) * 2 : 0, crouch: poseId === "land" ? 0.55 * (1 - progress) : 0, lean: 0, reach: 0, compression: poseId === "land" ? 0.5 : 0 },
    state: {},
  };
}

function syncActors(sample) {
  const actors = Array.isArray(sample?.actors) ? sample.actors : [];
  const live = new Set();
  for (const state of actors) {
    if (!state?.id) continue;
    live.add(state.id);
    let rig = actorRigs.get(state.id);
    if (!rig) {
      rig = buildActorRig(state);
      actorRigs.set(state.id, rig);
      actorLayer.add(rig.root);
    }
    rig.root.visible = state.state?.visible !== false;
    if (!rig.root.visible) continue;
    updateActorRig(rig, state, sample.ball);
  }
  for (const [id, rig] of actorRigs) {
    if (!live.has(id)) rig.root.visible = false;
  }
}

function buildActorRig(actorState) {
  const profile = profileFor(actorState);
  const side = isAwayActor(actorState) ? "away" : "home";
  const principal = profile.family === "stoopy" || profile.family === "toque";
  const root = new THREE.Group();
  root.name = `${actorState.name || actorState.id} · ${profile.family}`;
  const baseMaterial = principal
    ? side === "away" ? materials.ink : materials.ivory
    : side === "away" ? materials.supportDark : materials.supportLight;
  const alternateMaterial = principal
    ? side === "away" ? materials.ivory : materials.ink
    : side === "away" ? materials.supportLight : materials.supportDark;
  const accentMaterial = principal
    ? side === "away" ? materials.away : materials.home
    : side === "away" ? materials.supportAway : materials.supportHome;

  const parts = {};
  const add = (name, geometry, material, cast = true) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = cast;
    mesh.receiveShadow = cast;
    if (styleName === "paper") {
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 24), materials.paperEdge);
      edge.scale.setScalar(1.004);
      mesh.add(edge);
    }
    root.add(mesh);
    parts[name] = mesh;
    return mesh;
  };

  if (profile.family === "stoopy") {
    add("pelvis", new THREE.BoxGeometry(1, 1, 1, 2, 1, 1), baseMaterial);
    add("torsoLower", new THREE.BoxGeometry(1, 1, 1, 2, 2, 1), baseMaterial);
    add("torsoUpper", new THREE.BoxGeometry(1, 1, 1, 3, 2, 1), baseMaterial);
    add("pigment", new THREE.BoxGeometry(1, 1, 1), accentMaterial);
    add("head", new THREE.DodecahedronGeometry(0.5, 0), alternateMaterial);
  } else if (profile.family === "toque") {
    add("pelvis", new THREE.CylinderGeometry(0.5, 0.42, 1, 5), baseMaterial);
    add("torsoLower", new THREE.ConeGeometry(0.5, 1, 4), baseMaterial);
    add("torsoUpper", new THREE.ConeGeometry(0.5, 1, 4), baseMaterial);
    add("pigment", new THREE.BoxGeometry(1, 1, 1), accentMaterial);
    add("head", new THREE.ConeGeometry(0.5, 1, 5), alternateMaterial);
    add("ribbon", new THREE.BoxGeometry(1, 1, 1), accentMaterial);
  } else if (profile.family === "anchor") {
    add("pelvis", new THREE.CylinderGeometry(0.5, 0.5, 1, 6), baseMaterial);
    add("torsoLower", new THREE.CylinderGeometry(0.48, 0.5, 1, 6), baseMaterial);
    add("torsoUpper", new THREE.CylinderGeometry(0.5, 0.42, 1, 6), baseMaterial);
    add("pigment", new THREE.BoxGeometry(1, 1, 1), accentMaterial);
    add("head", new THREE.DodecahedronGeometry(0.5, 0), alternateMaterial);
  } else if (profile.family === "kite") {
    add("pelvis", new THREE.BoxGeometry(1, 1, 1), baseMaterial);
    add("torsoLower", new THREE.ConeGeometry(0.5, 1, 4), baseMaterial);
    add("torsoUpper", new THREE.ConeGeometry(0.5, 1, 4), baseMaterial);
    add("pigment", new THREE.BoxGeometry(1, 1, 1), accentMaterial);
    add("head", new THREE.OctahedronGeometry(0.5, 0), alternateMaterial);
  } else {
    add("pelvis", new THREE.BoxGeometry(1, 1, 1), baseMaterial);
    add("torsoLower", new THREE.BoxGeometry(1, 1, 1), baseMaterial);
    add("torsoUpper", new THREE.BoxGeometry(1, 1, 1), baseMaterial);
    add("pigment", new THREE.BoxGeometry(1, 1, 1), accentMaterial);
    add("head", new THREE.OctahedronGeometry(0.5, 0), alternateMaterial);
  }

  const limbGeometry = new THREE.CylinderGeometry(0.5, 0.42, 1, profile.family === "toque" ? 5 : 6, 1, false);
  const shinGeometry = new THREE.CylinderGeometry(0.42, 0.5, 1, profile.family === "toque" ? 5 : 6, 1, false);
  for (const limb of ["upperArmL", "upperArmR", "forearmL", "forearmR"]) add(limb, limbGeometry, limb.endsWith("R") ? accentMaterial : baseMaterial);
  for (const limb of ["thighL", "thighR"]) add(limb, limbGeometry, baseMaterial);
  for (const limb of ["shinL", "shinR"]) add(limb, shinGeometry, alternateMaterial);
  for (const joint of ["handL", "handR"]) add(joint, new THREE.DodecahedronGeometry(0.5, 0), accentMaterial);
  for (const joint of ["shoulderJointL", "shoulderJointR", "elbowJointL", "elbowJointR", "hipJointL", "hipJointR", "kneeJointL", "kneeJointR"]) {
    add(joint, new THREE.DodecahedronGeometry(0.5, 0), joint.includes("knee") ? alternateMaterial : baseMaterial);
  }
  add("waist", new THREE.CylinderGeometry(0.5, 0.5, 1, profile.family === "stoopy" ? 6 : 5), baseMaterial);
  add("neck", new THREE.CylinderGeometry(0.5, 0.5, 1, 6), alternateMaterial);
  for (const foot of ["footL", "footR"]) add(foot, new THREE.BoxGeometry(1, 1, 1), alternateMaterial);

  return { root, parts, profile, side, actorId: actorState.id };
}

function updateActorRig(rig, actorState, ballState) {
  const { root, parts, profile } = rig;
  const position = readPosition(actorState.position);
  const pose = actorState.pose || {};
  const poseId = String(pose.id || actorState.state?.action || "ready").toLowerCase();
  const facing = finite(actorState.facing, 1);
  const jump = 0;
  const compression = clamp01(finite(pose.compression, 0));
  const crouch = clamp01(finite(pose.crouch, 0) + compression * 0.9);
  const lean = clamp(finite(pose.lean, 0), -1, 1);
  const cadence = finite(pose.progress, 0);

  root.position.set(position.x, position.z, -position.y);
  root.rotation.set(0, facing < 0 ? Math.PI : 0, 0);
  root.updateMatrixWorld(true);

  const hipHeight = profile.hip * (1 - crouch * 0.24);
  const shoulderHeight = hipHeight + profile.torso * (1 - crouch * 0.1);
  const torsoLean = lean * 0.55
    + (poseId.includes("drive") || poseId.includes("roll") ? 0.32 : 0)
    + compression * 0.52;
  const hip = new THREE.Vector3(0, hipHeight + jump, 0);
  const chest = new THREE.Vector3(torsoLean, shoulderHeight + jump, 0);
  const shoulderL = chest.clone().add(new THREE.Vector3(0, 0, -profile.shoulder * 0.5));
  const shoulderR = chest.clone().add(new THREE.Vector3(0, 0, profile.shoulder * 0.5));
  const headY = shoulderHeight + profile.headGap + jump - compression * 0.72;

  configureCore(parts, profile, hip, chest, headY, crouch, torsoLean);

  const stride = poseId.includes("drive") || poseId.includes("roll") || poseId.includes("chase") || poseId.includes("follow")
    || poseId.includes("sprint") || poseId.includes("transition") || poseId.includes("recover")
    ? Math.sin(cadence * Math.PI * 2) * 0.75
    : 0;
  const wide = poseId.includes("screen") || poseId.includes("boxout")
    ? 0.46
    : poseId.includes("land") || poseId.includes("rebound") ? 0.34 : 0.16;
  const footL = actorState.anchors?.leftFoot
    ? root.worldToLocal(mapPoint(actorState.anchors.leftFoot))
    : new THREE.Vector3(stride, jump + 0.16, -profile.hipWidth * (0.5 + wide));
  const footR = actorState.anchors?.rightFoot
    ? root.worldToLocal(mapPoint(actorState.anchors.rightFoot))
    : new THREE.Vector3(-stride, jump + 0.16, profile.hipWidth * (0.5 + wide));
  const kneePush = crouch * 0.72 + (poseId.includes("screen-hit") ? 0.5 : 0.18);
  const kneeL = midpoint(hip.clone().add(new THREE.Vector3(0, 0, -profile.hipWidth * 0.45)), footL).add(new THREE.Vector3(kneePush, 0.15, 0));
  const kneeR = midpoint(hip.clone().add(new THREE.Vector3(0, 0, profile.hipWidth * 0.45)), footR).add(new THREE.Vector3(kneePush, 0.15, 0));
  const hipL = hip.clone().add(new THREE.Vector3(0, 0, -profile.hipWidth * 0.43));
  const hipR = hip.clone().add(new THREE.Vector3(0, 0, profile.hipWidth * 0.43));
  setSegment(parts.thighL, hipL, kneeL, profile.legWidth);
  setSegment(parts.thighR, hipR, kneeR, profile.legWidth);
  setSegment(parts.shinL, kneeL, footL, profile.legWidth * 0.84);
  setSegment(parts.shinR, kneeR, footR, profile.legWidth * 0.84);
  setFoot(parts.footL, footL, profile, stride > 0 ? 0.12 : 0);
  setFoot(parts.footR, footR, profile, stride < 0 ? -0.12 : 0);
  setJoint(parts.hipJointL, hipL, profile.legWidth * 1.12);
  setJoint(parts.hipJointR, hipR, profile.legWidth * 1.12);
  setJoint(parts.kneeJointL, kneeL, profile.legWidth * 0.96);
  setJoint(parts.kneeJointR, kneeR, profile.legWidth * 0.96);

  const hands = chooseHands(actorState, poseId, shoulderL, shoulderR, profile, cadence, jump);
  if (actorState.anchors?.leftHand) hands.left.copy(root.worldToLocal(mapPoint(actorState.anchors.leftHand)));
  if (actorState.anchors?.rightHand) hands.right.copy(root.worldToLocal(mapPoint(actorState.anchors.rightHand)));
  const contactType = String(ballState?.contact?.type || ballState?.contact || "").toLowerCase();
  if (ballState?.ownerId === actorState.id && ballState?.hand && contactType.includes("hand")) {
    attachHandsToBall(hands, root, ballState, profile);
  }
  const elbowL = elbowFor(shoulderL, hands.left, -1, profile, poseId);
  const elbowR = elbowFor(shoulderR, hands.right, 1, profile, poseId);
  setSegment(parts.upperArmL, shoulderL, elbowL, profile.armWidth);
  setSegment(parts.upperArmR, shoulderR, elbowR, profile.armWidth);
  setSegment(parts.forearmL, elbowL, hands.left, profile.armWidth * 0.82);
  setSegment(parts.forearmR, elbowR, hands.right, profile.armWidth * 0.82);
  setJoint(parts.shoulderJointL, shoulderL, profile.armWidth * 1.12);
  setJoint(parts.shoulderJointR, shoulderR, profile.armWidth * 1.12);
  setJoint(parts.elbowJointL, elbowL, profile.armWidth * 0.98);
  setJoint(parts.elbowJointR, elbowR, profile.armWidth * 0.98);
  setJoint(parts.handL, hands.left, profile.hand);
  setJoint(parts.handR, hands.right, profile.hand);
}

function configureCore(parts, profile, hip, chest, headY, crouch, torsoLean) {
  const coreAngle = -torsoLean * 0.12;
  parts.pelvis.position.copy(hip);
  parts.pelvis.rotation.set(0, 0, coreAngle);
  parts.pelvis.scale.set(profile.depth, profile.pelvisHeight, profile.hipWidth);

  const lowerY = lerp(hip.y, chest.y, 0.34);
  const upperY = lerp(hip.y, chest.y, 0.72);
  parts.torsoLower.position.set(torsoLean * 0.34, lowerY, 0);
  parts.torsoUpper.position.set(torsoLean * 0.72, upperY, 0);
  parts.torsoLower.rotation.set(0, 0, coreAngle);
  parts.torsoUpper.rotation.set(0, 0, coreAngle);

  if (profile.family === "stoopy") {
    parts.torsoLower.scale.set(profile.depth * 1.04, profile.torso * 0.42, profile.shoulder * 0.9);
    parts.torsoUpper.scale.set(profile.depth, profile.torso * 0.4, profile.shoulder);
    parts.torsoLower.rotation.z = coreAngle + 0.025;
    parts.torsoUpper.rotation.z = coreAngle - 0.018;
  } else if (profile.family === "toque") {
    parts.torsoLower.rotation.z = Math.PI + coreAngle;
    parts.torsoUpper.rotation.z = coreAngle;
    parts.torsoLower.scale.set(profile.depth, profile.torso * 0.58, profile.shoulder * 0.77);
    parts.torsoUpper.scale.set(profile.depth, profile.torso * 0.52, profile.shoulder);
  } else if (profile.family === "kite") {
    parts.torsoLower.rotation.z = Math.PI + coreAngle;
    parts.torsoUpper.rotation.z = coreAngle;
    parts.torsoLower.scale.set(profile.depth, profile.torso * 0.58, profile.shoulder * 0.7);
    parts.torsoUpper.scale.set(profile.depth, profile.torso * 0.52, profile.shoulder);
  } else {
    parts.torsoLower.scale.set(profile.depth, profile.torso * 0.58, profile.shoulder * 0.76);
    parts.torsoUpper.scale.set(profile.depth, profile.torso * 0.52, profile.shoulder);
  }

  parts.pigment.position.set(torsoLean * 0.7 - 0.03, upperY, profile.depth * 0.53);
  parts.pigment.rotation.set(0, 0, coreAngle);
  parts.pigment.scale.set(profile.depth * 0.7, profile.torso * 0.42, 0.09);
  parts.waist.position.set(torsoLean * 0.16, hip.y + profile.pelvisHeight * 0.48, 0);
  parts.waist.rotation.set(0, 0, coreAngle);
  parts.waist.scale.set(profile.depth * 0.78, 0.46, profile.hipWidth * 0.72);
  parts.head.position.set(torsoLean + 0.03, headY, 0);
  parts.head.rotation.set(0, 0, coreAngle * 0.45);
  parts.head.scale.set(profile.headWidth, profile.headHeight, profile.headWidth * 0.92);
  const neckStart = new THREE.Vector3(torsoLean * 0.86, chest.y - 0.12, 0);
  const neckEnd = new THREE.Vector3(torsoLean + 0.03, headY - profile.headHeight * 0.48, 0);
  setSegment(parts.neck, neckStart, neckEnd, profile.headWidth * 0.66);

  if (parts.ribbon) {
    parts.ribbon.position.set(torsoLean - 0.18, headY + profile.headHeight * 0.18, -profile.headWidth * 0.55);
    parts.ribbon.rotation.set(-0.18, 0, 0.22);
    parts.ribbon.scale.set(0.13, profile.headHeight * 1.5, 0.32);
  }
}

function chooseHands(actorState, poseId, shoulderL, shoulderR, profile, cadence, jump) {
  const hands = {
    left: shoulderL.clone().add(new THREE.Vector3(0.28, -profile.arm * 0.88, -0.05)),
    right: shoulderR.clone().add(new THREE.Vector3(0.28, -profile.arm * 0.88, 0.05)),
  };
  if (poseId.includes("screen")) {
    hands.left.set(0.45, shoulderL.y - profile.arm * 0.45, -0.38);
    hands.right.set(0.45, shoulderR.y - profile.arm * 0.45, 0.38);
  } else if (poseId.includes("contest") || poseId.includes("block") || poseId.includes("help")) {
    hands.left.set(0.35, shoulderL.y + profile.arm * 0.92, -0.62);
    hands.right.set(0.62, shoulderR.y + profile.arm * 1.04, 0.45);
  } else if (poseId.includes("dunk") || poseId.includes("finish")) {
    hands.left.set(0.75, shoulderL.y + profile.arm * 0.84 + jump * 0.15, -0.2);
    hands.right.set(0.9, shoulderR.y + profile.arm * 0.94 + jump * 0.15, 0.2);
  } else if (poseId.includes("catch") || poseId.includes("load")) {
    hands.left.set(0.95, shoulderL.y - 0.25, -0.25);
    hands.right.set(0.95, shoulderR.y - 0.25, 0.25);
  } else if (poseId.includes("shoot") || poseId.includes("release")) {
    hands.left.set(0.58, shoulderL.y + profile.arm * 0.76, -0.18);
    hands.right.set(0.82, shoulderR.y + profile.arm * 1.02, 0.14);
  } else if (poseId.includes("rebound") || poseId.includes("putback")) {
    hands.left.set(0.64, shoulderL.y + profile.arm * 0.92, -0.5);
    hands.right.set(0.72, shoulderR.y + profile.arm * 0.98, 0.5);
  } else if (poseId.includes("steal") || poseId.includes("denial") || poseId.includes("deflect")) {
    hands.left.set(0.92, shoulderL.y + 0.12, -0.5);
    hands.right.set(1.12, shoulderR.y + 0.3, 0.36);
  } else if (poseId.includes("drive") || poseId.includes("roll") || poseId.includes("chase") || poseId.includes("follow")
    || poseId.includes("sprint") || poseId.includes("transition") || poseId.includes("recover")) {
    const swing = Math.sin(cadence * Math.PI * 2) * 0.65;
    hands.left.x += swing;
    hands.right.x -= swing;
  } else if (poseId.includes("land")) {
    hands.left.set(0.4, shoulderL.y - profile.arm * 0.18, -0.8);
    hands.right.set(0.4, shoulderR.y - profile.arm * 0.18, 0.8);
  } else if (poseId.includes("reaction") || poseId.includes("hit")) {
    hands.left.set(-0.5, shoulderL.y - 0.2, -0.9);
    hands.right.set(-0.35, shoulderR.y + 0.15, 0.86);
  }
  return hands;
}

function attachHandsToBall(hands, root, ballState, profile) {
  const worldBall = mapPoint(ballState.position);
  const localBall = root.worldToLocal(worldBall.clone());
  const hand = String(ballState.hand || "both").toLowerCase();
  const contactDistance = 0.39 + profile.hand * 0.48;
  if (hand.includes("left")) {
    const direction = hands.left.clone().sub(localBall);
    if (direction.lengthSq() < 0.0001) direction.set(0, 0, -1);
    hands.left.copy(localBall).add(direction.normalize().multiplyScalar(contactDistance));
  } else if (hand.includes("right")) {
    const direction = hands.right.clone().sub(localBall);
    if (direction.lengthSq() < 0.0001) direction.set(0, 0, 1);
    hands.right.copy(localBall).add(direction.normalize().multiplyScalar(contactDistance));
  }
  else {
    hands.left.copy(localBall).add(new THREE.Vector3(0, 0, -contactDistance));
    hands.right.copy(localBall).add(new THREE.Vector3(0, 0, contactDistance));
  }
}

function elbowFor(shoulder, hand, side, profile, poseId) {
  const elbow = midpoint(shoulder, hand);
  elbow.z += side * profile.arm * 0.18;
  if (poseId.includes("contest") || poseId.includes("dunk")) elbow.x -= 0.18;
  return elbow;
}

function profileFor(actorState) {
  const id = String(actorState.id || "").toLowerCase();
  const identity = `${id} ${String(actorState.name || "").toLowerCase()}`;
  const role = String(actorState.role || "").toLowerCase();
  if (identity.includes("stoopy")) return {
    family: "stoopy", hip: 2.05, torso: 2.82, shoulder: 3.08, hipWidth: 2.08, depth: 0.75,
    pelvisHeight: 0.84, headGap: 0.26, headWidth: 0.82, headHeight: 0.78, arm: 2.12,
    armWidth: 0.66, legWidth: 0.8, hand: 0.62, footWidth: 0.82,
  };
  if (identity.includes("toque")) return {
    family: "toque", hip: 2.68, torso: 3.5, shoulder: 2.36, hipWidth: 1.25, depth: 0.55,
    pelvisHeight: 0.62, headGap: 0.64, headWidth: 0.58, headHeight: 1.18, arm: 2.78,
    armWidth: 0.45, legWidth: 0.52, hand: 0.48, footWidth: 0.58,
  };
  if (role.includes("center") || role.includes("big") || hashCode(id) % 3 === 0) return {
    family: "anchor", hip: 2.25, torso: 3.0, shoulder: 2.62, hipWidth: 1.62, depth: 0.72,
    pelvisHeight: 0.68, headGap: 0.5, headWidth: 0.7, headHeight: 0.72, arm: 2.25,
    armWidth: 0.45, legWidth: 0.57, hand: 0.45, footWidth: 0.68,
  };
  if (hashCode(id) % 3 === 1) return {
    family: "kite", hip: 2.34, torso: 3.15, shoulder: 2.66, hipWidth: 1.35, depth: 0.62,
    pelvisHeight: 0.64, headGap: 0.5, headWidth: 0.62, headHeight: 0.75, arm: 2.38,
    armWidth: 0.37, legWidth: 0.45, hand: 0.4, footWidth: 0.56,
  };
  return {
    family: "runner", hip: 2.2, torso: 2.86, shoulder: 2.32, hipWidth: 1.28, depth: 0.5,
    pelvisHeight: 0.58, headGap: 0.46, headWidth: 0.62, headHeight: 0.68, arm: 2.18,
    armWidth: 0.35, legWidth: 0.42, hand: 0.39, footWidth: 0.58,
  };
}

function isAwayActor(actorState) {
  const teamId = String(actorState?.teamId || "").toLowerCase();
  const side = String(actorState?.side || "").toLowerCase();
  if (teamId.includes("toronto") || teamId.includes("lake-effect")) return true;
  if (teamId.includes("new-york") || teamId.includes("brownstones")) return false;
  return side === "away";
}

function syncBall(sample) {
  const ball = sample?.ball;
  if (!ball?.position || ball.visible === false) {
    ballRig.root.visible = false;
    return;
  }
  ballRig.root.visible = true;
  ballRig.root.position.copy(mapPoint(ball.position));
  const spin = finite(sample.timeMs, timelineMs) * 0.0028;
  ballRig.seams.rotation.set(spin * 0.7, spin, spin * 0.35);
  const contactType = String(ball.contact?.type || ball.contact || "").toLowerCase();
  const compressed = contactType.includes("rim") ? 0.94 : 1;
  ballRig.root.scale.set(1, compressed, 1);
}

function syncHoop(sample) {
  const timeMs = finite(sample?.timeMs, timelineMs);
  const attackingX = finite(sample?.broadcast?.attackingRim?.x ?? sample?.contacts?.rim?.point?.x, 42);
  const activeHoop = attackingX < 0 ? environment.hoops.awayAttack : environment.hoops.homeAttack;
  const timelineElapsed = timeMs - finite(MILESTONES.rimCrossingMs, 8350);
  const explicitRim = typeof sample?.presentation?.rimResponse === "number"
    ? clamp01(sample.presentation.rimResponse)
    : null;
  const explicitNet = typeof sample?.presentation?.netResponse === "number"
    ? clamp01(sample.presentation.netResponse)
    : null;
  const active = timelineElapsed >= 0 && timelineElapsed <= 1250;
  const response = explicitRim == null
    ? active ? Math.exp(-timelineElapsed / 430) * Math.sin((timelineElapsed / 1000) * Math.PI * 7) : 0
    : explicitRim * Math.sin(timeMs * 0.052) * 0.9;
  const netPull = explicitNet == null
    ? timelineElapsed >= 0 && timelineElapsed <= 900
      ? Math.sin(clamp01(timelineElapsed / 900) * Math.PI) * Math.exp(-Math.max(0, timelineElapsed - 340) / 800)
      : 0
    : explicitNet;

  syncSingleHoop(environment.hoops.homeAttack, activeHoop === environment.hoops.homeAttack ? response : 0,
    activeHoop === environment.hoops.homeAttack ? netPull : 0, timeMs);
  syncSingleHoop(environment.hoops.awayAttack, activeHoop === environment.hoops.awayAttack ? response : 0,
    activeHoop === environment.hoops.awayAttack ? netPull : 0, timeMs);
}

function syncSingleHoop(hoop, response, netPull, timeMs) {
  hoop.rim.rotation.set(Math.PI / 2, response * 0.025, response * 0.035);
  hoop.rim.position.y = 10 + Math.abs(response) * 0.055;
  hoop.rimNeck.rotation.z = response * 0.018;
  hoop.rimNeck.position.y = 10 + response * 0.03;

  hoop.netRopes.forEach((rope, index) => {
    const { top, bottom, angle } = rope.userData;
    const phase = Math.sin(index * 1.7 + timeMs * 0.016) * netPull;
    const deformedBottom = bottom.clone();
    deformedBottom.y -= netPull * (0.5 + (index % 3) * 0.08);
    deformedBottom.x += Math.cos(angle) * phase * 0.42;
    deformedBottom.z += Math.sin(angle) * phase * 0.42;
    setWorldSegment(rope, top, deformedBottom);
  });
}

function syncCamera(sample) {
  const cameraPlan = sample?.camera || {};
  const aspect = Math.max(0.3, window.innerWidth / Math.max(1, window.innerHeight));
  const authoredVariant = aspect < 0.8
    ? window.innerWidth <= 700
      ? cameraPlan.compactPortrait || cameraPlan.portrait || null
      : cameraPlan.socialPortrait || cameraPlan.portrait || null
    : cameraPlan.desktop || cameraPlan.landscape || null;
  const data = authoredVariant ? { ...cameraPlan, ...authoredVariant } : cameraPlan;
  const rawPosition = readPosition(data.position, { x: 22, y: -48, z: 24 });
  const rawTarget = readPosition(data.lookAt || data.target, { x: 31, y: 0, z: 4 });
  const target = mapPoint(rawTarget);
  const desired = mapPoint(rawPosition);

  if (authoredVariant) {
    camera.fov = clamp(finite(data.fov, 42), 26, 64);
  } else if (aspect < 0.8) {
    const portrait = window.innerWidth <= 700
      ? compactPortraitCameraAt(finite(sample?.timeMs, timelineMs))
      : portraitCameraAt(finite(sample?.timeMs, timelineMs));
    desired.copy(mapPoint(portrait.position));
    target.copy(mapPoint(portrait.lookAt));
    camera.fov = portrait.fov;
  } else if (aspect < 1.25) {
    desired.lerp(target, -0.2);
    camera.fov = 40;
  } else {
    const desktopMaster = desktopLandscapeCameraAt(finite(sample?.timeMs, timelineMs), data);
    if (desktopMaster) {
      desired.copy(mapPoint(desktopMaster.position));
      target.copy(mapPoint(desktopMaster.lookAt));
      camera.fov = desktopMaster.fov;
    } else {
      camera.fov = clamp(finite(data.fov, data.shot === "aftermath" || data.shot === "close" ? 34 : 37), 28, 52);
    }
  }
  const attackingX = finite(sample?.broadcast?.attackingRim?.x, 42);
  const ballX = finite(sample?.ball?.position?.x, 0);
  const leftRimSafety = attackingX < 0 && ballX < -34;
  if (leftRimSafety && aspect >= 0.8) {
    const safeCamera = { position: { x: -40, y: -32, z: 17 }, lookAt: { x: -34, y: 0, z: 6 }, fov: 36 };
    desired.copy(mapPoint(safeCamera.position));
    target.copy(mapPoint(safeCamera.lookAt));
    camera.fov = safeCamera.fov;
  }
  camera.updateProjectionMatrix();
  camera.position.copy(desired);
  camera.lookAt(target);
  const actualPosition = roundPosition(unmapPoint(camera.position));
  const actualLookAt = roundPosition(unmapPoint(target));
  renderedCamera = {
    id: data.id || null,
    shot: data.shot || "wide",
    composition: leftRimSafety && aspect >= 0.8
      ? "left-rim-desktop-safety"
      : aspect < 0.8
        ? window.innerWidth <= 700 ? "compact-portrait-authored" : "social-portrait-authored"
        : authoredVariant ? "desktop-authored" : "timeline-landscape",
    position: actualPosition,
    lookAt: actualLookAt,
    sourcePosition: roundPosition(rawPosition),
    sourceLookAt: roundPosition(rawTarget),
    fov: round(camera.fov),
    aspect: round(camera.aspect),
    occlusionSafe: actualPosition.x < 44.25,
    targetIds: Array.isArray(data.targetIds) ? data.targetIds.slice(0, 4) : [],
    cut: Boolean(data.cut),
  };
}

function desktopLandscapeCameraAt(timeMs, data) {
  const master = {
    position: { x: 3, y: -48, z: 26 },
    lookAt: { x: 3.9, y: 0, z: 3 },
    fov: 58,
  };
  if (data?.id === "tactical-master" || data?.id === "reset-master") return master;
  if (data?.id !== "motivated-tightening" || timeMs > finite(MILESTONES.pocketCatchMs, 6100)) return null;
  const amount = smoothstep(4800, finite(MILESTONES.pocketCatchMs, 6100), timeMs);
  return {
    position: mixPosition(master.position, readPosition(data.position), amount),
    lookAt: mixPosition(master.lookAt, readPosition(data.lookAt || data.target), amount),
    fov: lerp(master.fov, finite(data.fov, 39), amount),
  };
}

function compactPortraitCameraAt(timeMs) {
  const wide = { timeMs: 0, position: { x: -45, y: -30, z: 40 }, lookAt: { x: 12, y: 0, z: 3 }, fov: 50 };
  if (timeMs >= finite(MILESTONES.resetCutMs, 14500)) return wide;
  const keys = [
    wide,
    { timeMs: 4800, position: { x: -45, y: -30, z: 40 }, lookAt: { x: 12, y: 0, z: 3 }, fov: 50 },
    { timeMs: finite(MILESTONES.pocketCatchMs, 6100), position: { x: -5, y: -40, z: 28 }, lookAt: { x: 30, y: 0, z: 5 }, fov: 53 },
    { timeMs: finite(MILESTONES.gatherStartMs, 6500), position: { x: 0, y: -38, z: 27 }, lookAt: { x: 33, y: 0, z: 5.2 }, fov: 52 },
    { timeMs: finite(MILESTONES.rimApproachMs, 8200), position: { x: 28, y: -36, z: 22 }, lookAt: { x: 39, y: 0, z: 6.4 }, fov: 46 },
    { timeMs: finite(MILESTONES.scoreCertifiedMs, 8500), position: { x: 28, y: -36, z: 22 }, lookAt: { x: 39, y: 0, z: 6.4 }, fov: 46 },
    { timeMs: finite(MILESTONES.landingMs, 9100), position: { x: 22, y: -34, z: 24 }, lookAt: { x: 39, y: 0.4, z: 3.5 }, fov: 45 },
    { timeMs: 9800, position: { x: 31.5, y: -51, z: 29 }, lookAt: { x: 35.5, y: 0, z: 5.2 }, fov: 43 },
    { timeMs: finite(MILESTONES.resetCutMs, 14500), position: { x: 31.5, y: -51, z: 29 }, lookAt: { x: 35.5, y: 0, z: 5.2 }, fov: 43 },
  ];
  return interpolateCameraKeys(keys, timeMs);
}

function portraitCameraAt(timeMs) {
  const wide = { timeMs: 0, position: { x: -18, y: -38, z: 34 }, lookAt: { x: 9, y: 0, z: 3 }, fov: 45 };
  if (timeMs >= finite(MILESTONES.resetCutMs, 14500)) return wide;
  const keys = [
    wide,
    { timeMs: 4800, position: { x: -18, y: -38, z: 34 }, lookAt: { x: 9, y: 0, z: 3 }, fov: 45 },
    { timeMs: finite(MILESTONES.pocketCatchMs, 6100), position: { x: 18, y: -65, z: 34 }, lookAt: { x: 31, y: 0, z: 4.5 }, fov: 50 },
    { timeMs: finite(MILESTONES.gatherStartMs, 6500), position: { x: 20, y: -60, z: 32 }, lookAt: { x: 32, y: 0, z: 5 }, fov: 49 },
    { timeMs: finite(MILESTONES.rimApproachMs, 8200), position: { x: 28, y: -36, z: 22 }, lookAt: { x: 39, y: 0, z: 6.4 }, fov: 46 },
    { timeMs: finite(MILESTONES.scoreCertifiedMs, 8500), position: { x: 28, y: -36, z: 22 }, lookAt: { x: 39, y: 0, z: 6.4 }, fov: 46 },
    { timeMs: finite(MILESTONES.landingMs, 9100), position: { x: 22, y: -34, z: 24 }, lookAt: { x: 39, y: 0.4, z: 3.5 }, fov: 45 },
    { timeMs: 9800, position: { x: 31.5, y: -51, z: 29 }, lookAt: { x: 35.5, y: 0, z: 5.2 }, fov: 43 },
    { timeMs: finite(MILESTONES.resetCutMs, 14500), position: { x: 31.5, y: -51, z: 29 }, lookAt: { x: 35.5, y: 0, z: 5.2 }, fov: 43 },
  ];
  return interpolateCameraKeys(keys, timeMs);
}

function interpolateCameraKeys(keys, timeMs) {
  for (let index = 1; index < keys.length; index += 1) {
    const next = keys[index];
    if (timeMs > next.timeMs) continue;
    const previous = keys[index - 1];
    const progress = smoothstep(previous.timeMs, next.timeMs, timeMs);
    return {
      position: mixPosition(previous.position, next.position, progress),
      lookAt: mixPosition(previous.lookAt, next.lookAt, progress),
      fov: lerp(previous.fov, next.fov, progress),
    };
  }
  return keys[keys.length - 1];
}

function mixPosition(from, to, amount) {
  return {
    x: lerp(from.x, to.x, amount),
    y: lerp(from.y, to.y, amount),
    z: lerp(from.z, to.z, amount),
  };
}

function syncCrowd(sample) {
  const presentation = sample?.presentation || {};
  const explicitReaction = typeof presentation.crowdReaction === "number"
    ? clamp01(presentation.crowdReaction)
    : null;
  const rawReactionOrigin = finite(presentation.reactionOriginX ?? sample?.broadcast?.attackingRim?.x, 42);
  const reactionOriginX = rawReactionOrigin >= 0 && rawReactionOrigin <= 1
    ? rawReactionOrigin * 100 - 50
    : rawReactionOrigin;
  const outcomeContactAt = finite(sample?.broadcast?.outcome?.contactAtMs, NaN);
  const reactionStartedAt = finite(
    presentation.reactionStartedAtMs,
    Number.isFinite(outcomeContactAt) && outcomeContactAt > 0
      ? outcomeContactAt + 150
      : finite(MILESTONES.rimCrossingMs, 8350),
  );
  const elapsed = finite(sample?.timeMs, timelineMs) - reactionStartedAt;
  environment.crowdSections.forEach((section, index) => {
    const worldX = finite(section.userData.worldX, 0);
    const travelDelay = 120 + clamp(Math.abs(reactionOriginX - worldX) / 94, 0, 1) * 620;
    const delay = explicitReaction == null ? (section.userData.reactionDelay ?? travelDelay) : travelDelay;
    const rise = smoothstep(delay, delay + 240, elapsed);
    const settle = 1 - smoothstep(2200, 3900, elapsed);
    const authoredWave = explicitReaction == null ? rise * settle : explicitReaction * rise;
    const individuality = 0.78 + (index % 5) * 0.065;
    const wave = authoredWave * individuality;
    section.position.y = section.userData.baseY + wave * (section.userData.reactionLift ?? (0.38 + (index % 3) * 0.1));
    section.rotation.z = section.userData.baseRotation + wave * (section.userData.reactionTilt ?? (index % 2 ? -0.008 : 0.008));
  });
}

function syncBroadcast(sample) {
  const score = sample?.score || {};
  const broadcast = sample?.broadcast || {};
  const presentation = sample?.presentation || {};
  const clock = broadcast.clock || sample?.clock || {};
  const timeMs = finite(sample?.timeMs, timelineMs);
  const homePoints = typeof score.home === "object" ? score.home?.points : score.home;
  const awayPoints = typeof score.away === "object" ? score.away?.points : score.away;
  scoreHome.textContent = String(Number.isFinite(homePoints) ? homePoints : 18);
  scoreAway.textContent = String(Number.isFinite(awayPoints) ? awayPoints : 17);
  const gameClockSeconds = firstFinite(
    clock.gameClockSeconds,
    clock.remainingSeconds,
    broadcast.gameClockSeconds,
    sample?.gameClockSeconds,
    (DURATION_MS - finite(sample?.timeMs, timelineMs)) / 1000,
  );
  const shotClockSeconds = firstFinite(
    clock.shotClockSeconds,
    clock.shotSeconds,
    broadcast.shotClockSeconds,
    sample?.shotClockSeconds,
    19,
  );
  scoreClock.textContent = formatClock(gameClockSeconds);
  shotClock.textContent = String(Math.max(0, Math.ceil(shotClockSeconds)));
  const period = clock.periodLabel || clock.period || broadcast.periodLabel || broadcast.period || "4Q";
  periodLabel.textContent = formatPeriod(period);

  const possession = broadcast.possession || sample?.possession || {};
  const possessionText = String(
    possession.label ||
    broadcast.possessionLabel ||
    (possession.offenseTeamId || possession.teamId || possession.side || broadcast.possessionTeamId || "home"),
  ).toLowerCase();
  const awayPossession = /toronto|lake|tle|away/.test(possessionText);
  const noPossession = possession.status === "none" || possession.id == null && broadcast.segment?.kind !== "live";
  possessionLine.textContent = possession.label || broadcast.possessionLabel || (noPossession ? "MATCHUP" : awayPossession ? "TO BALL" : "NY BALL");
  possessionLine.classList.toggle("away", awayPossession);
  possessionLine.classList.toggle("home", !awayPossession);

  const rawMode = String(broadcast.mode || broadcast.state || broadcast.segment?.kind || "live").toLowerCase();
  const replayTruth = Boolean(
    (rawMode.includes("replay") || broadcast.replay?.active === true) &&
    broadcast.replay?.recordedFootage === true
  );
  const mode = replayTruth
    ? "replay"
    : rawMode.includes("final") || rawMode.includes("fulltime")
      ? "final"
      : rawMode.includes("dead") || rawMode.includes("break") || rawMode.includes("timeout") || rawMode.includes("context") || rawMode.includes("reset")
        ? "dead-ball"
        : "live";
  modeBug.dataset.mode = mode;
  modeLabel.textContent = mode === "replay" ? "Replay" : mode === "dead-ball" ? "Dead ball" : mode === "final" ? "Final" : "Live";
  replayOverlay.classList.toggle("visible", replayTruth);

  const segment = broadcast.segment || {};
  const segmentLocalMs = timeMsInSegment(sample, segment);
  const coldOpenStory = segment.kind === "context"
    ? {
        visible: segmentLocalMs < 5500,
        kicker: "One possession apart · 4th quarter",
        title: "Stoopy vs Toque",
        home: {
          name: "Stoopy · Moving Architecture",
          trait: "His screens reshape the floor. His heavy base makes the second jump cost him.",
        },
        away: {
          name: "Toque · Whiteout Release",
          trait: "His length erases the first look. Traffic can pull him away from the second.",
        },
      }
    : null;
  const story = presentation.storyCard || presentation.coldOpen || broadcast.storyCard || coldOpenStory;
  const storyVisible = Boolean(story && (typeof story === "object" ? story.visible !== false : story));
  storyCard.classList.toggle("visible", storyVisible);
  if (story && typeof story === "object") {
    storyKicker.textContent = story.kicker || story.eyebrow || "One possession apart · 4th quarter";
    storyTitle.innerHTML = safeTitleHtml(story.title || "Stoopy vs Toque");
    const home = story.home || story.stoopy || {};
    const away = story.away || story.toque || {};
    homePrincipal.textContent = home.name || home.title || "Stoopy · Moving Architecture";
    homeTrait.textContent = home.trait || home.detail || "His screens reshape the floor. His heavy base makes the second jump cost him.";
    awayPrincipal.textContent = away.name || away.title || "Toque · Whiteout Release";
    awayTrait.textContent = away.trait || away.detail || "His length erases the first look. Traffic can pull him away from the second.";
  }

  const lower = presentation.lowerThird;
  const lowerStart = directorLowerStart(broadcast);
  const withinEditorialCap = lowerStart == null || timeMs < lowerStart + 3200;
  const requestedVisible = segment.kind !== "replay" && Boolean(lower && (typeof lower === "object" ? lower.visible !== false : lower)) && withinEditorialCap;
  const timelineOpacity = typeof lower?.opacity === "number" ? clamp01(lower.opacity) : null;
  let progress = requestedVisible ? (timelineOpacity ?? 1) : 0;
  if (TIMELINE === BASE_TIMELINE && requestedVisible && timelineOpacity == null) {
    const lowerStart = finite(MILESTONES.lowerThirdMs, 12600);
    const lowerEnd = finite(MILESTONES.resetCutMs, 14500) - 100;
    progress = Math.min(smoothstep(lowerStart, lowerStart + 220, timeMs), 1 - smoothstep(lowerEnd - 220, lowerEnd, timeMs));
  }
  lowerThirdProgress = progress;
  lowerThird.classList.toggle("visible", progress > 0);
  lowerThird.style.opacity = String(progress);
  lowerThird.style.transform = `translateY(${round((1 - progress) * 20)}px)`;
  if (typeof lower === "object" && lower) {
    const graphic = outcomeGraphic(broadcast.outcome, broadcast.headline, lower);
    lowerThird.dataset.team = graphic.team;
    lowerKicker.textContent = graphic.kicker;
    lowerTitle.textContent = graphic.title;
    lowerDetail.textContent = graphic.detail;
  }

  const directorRead = segment.kind !== "context" && segmentLocalMs >= 250 && segmentLocalMs < 2550
    ? {
        visible: true,
        kicker: broadcast.headline?.kicker || "The read",
        copy: `${broadcast.headline?.deck || "Every answer changes the next possession."} ${broadcast.stakes?.detail || ""}`.trim(),
      }
    : null;
  const read = presentation.readCard || presentation.tacticalRead || broadcast.tacticalRead || directorRead;
  const readVisible = Boolean(read && (typeof read === "object" ? read.visible !== false : read));
  readCard.classList.toggle("visible", readVisible);
  if (read && typeof read === "object") {
    readKicker.textContent = read.kicker || read.eyebrow || "The read";
    readCopy.textContent = read.copy || read.detail || read.text || "Every answer creates the next opening.";
  }

  const commentary = presentation.commentaryLine || presentation.commentary || broadcast.commentary;
  const commentaryText = typeof commentary === "string" ? commentary : commentary?.text || commentary?.copy || "";
  const commentaryVisible = Boolean(commentaryText && (typeof commentary !== "object" || commentary.visible !== false));
  commentaryLine.textContent = commentaryText;
  commentaryLine.classList.toggle("visible", commentaryVisible);

  const stake = presentation.stake || broadcast.stake || broadcast.stakes;
  if (typeof stake === "string") stakeRibbon.textContent = stake;
  else if (stake?.label || stake?.text) {
    stakeRibbon.textContent = [stake.label || stake.text, stake.detail].filter(Boolean).join(" · ");
  }
  broadcastFade.style.opacity = String(clamp01(presentation.blackout || 0));
}

function timeMsInSegment(sample, segment) {
  return Math.max(0, finite(sample?.timeMs, timelineMs) - finite(segment?.startMs, 0));
}

function directorLowerStart(broadcast) {
  const segment = broadcast?.segment || {};
  const outcome = broadcast?.outcome || {};
  if (segment.kind === "replay") return finite(segment.startMs, 0);
  if (segment.id === "segment-06-stoopy-putback") return 77500;
  if (Number.isFinite(Number(outcome.certifiedAtMs)) && Number(outcome.certifiedAtMs) > 0) {
    return Number(outcome.certifiedAtMs) + 1600;
  }
  return null;
}

function outcomeGraphic(outcome = {}, headline = {}, authored = {}) {
  const team = String(outcome.teamId || "").includes("toronto") ? "away" : "home";
  const points = Number(outcome.points) || 0;
  const fallback = {
    team,
    kicker: authored.kicker || "Certified outcome",
    title: authored.title || headline.title || "Possession complete",
    detail: authored.description || authored.detail || headline.deck || "The result is certified after contact.",
  };
  if (outcome.status !== "certified" && outcome.status !== "replayed") return fallback;
  if (outcome.type === "made-dunk") return {
    team: "home", kicker: "Stoopy · Certified +2", title: "The Stoop Drop",
    detail: "Legal screen. Two-hand catch. Rim crossing. New York builds the lead.",
  };
  if (outcome.type === "made-three") return {
    team: "away", kicker: "Toque · Certified +3", title: "Whiteout Answer",
    detail: "Clean catch. Early release. Toronto erases the lead at the left rim.",
  };
  if (outcome.type === "live-ball-turnover") return {
    team: "away", kicker: "Toque · Certified takeaway", title: "The Switch Worked",
    detail: "Toronto remembers the screen and closes the passing window.",
  };
  if (outcome.type === "blocked-miss") return {
    team: "away", kicker: "Toque · Certified block", title: "Whiteout at the Rim",
    detail: "Ball first. The block is clean—and the carom is still live.",
  };
  if (outcome.type === "offensive-rebound-putback") return {
    team: "home", kicker: `Stoopy · Certified +${points || 2}`, title: "Second Effort",
    detail: "Offensive board. Two-foot load. Putback. The heavy landing still costs him.",
  };
  return fallback;
}

function firstFinite(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function formatClock(value) {
  const seconds = Math.max(0, Number(value) || 0);
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  if (seconds < 10 && seconds % 1 !== 0) return `${minutes}:${String(remainder).padStart(2, "0")}.${Math.floor((seconds % 1) * 10)}`;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatPeriod(value) {
  const text = String(value || "4Q").trim().toUpperCase();
  if (/^Q\d$/.test(text)) return `${text.slice(1)}Q`;
  if (/^\d$/.test(text)) return `${text}Q`;
  return text.slice(0, 3);
}

function safeTitleHtml(value) {
  const title = String(value || "Stoopy vs Toque").replace(/[<>]/g, "");
  return title.replace(/\s+vs\.?\s+/i, ' <span class="versus">vs</span> ');
}

function buildBall() {
  const root = new THREE.Group();
  root.name = "Basketball";
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.39, 28, 20), materials.ball);
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  const seams = new THREE.Group();
  const seamMaterial = materials.ink;
  const seamA = new THREE.Mesh(new THREE.TorusGeometry(0.395, 0.014, 5, 40), seamMaterial);
  const seamB = seamA.clone();
  const seamC = seamA.clone();
  seamB.rotation.y = Math.PI / 2;
  seamC.rotation.x = Math.PI / 2;
  seams.add(seamA, seamB, seamC);
  root.add(seams);
  return { root, seams };
}

function buildHighRoom() {
  const root = new THREE.Group();
  root.name = "The High Room";
  const crowdSections = [];

  const floor = mesh(new THREE.PlaneGeometry(112, 72), materials.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.06;
  floor.receiveShadow = true;
  root.add(floor);

  const court = mesh(new THREE.PlaneGeometry(94, 50), materials.court);
  court.rotation.x = -Math.PI / 2;
  court.position.y = 0;
  court.receiveShadow = true;
  root.add(court);

  for (let i = 0; i < 24; i += 1) {
    const plank = mesh(new THREE.PlaneGeometry(94, 50 / 24 - 0.035), i % 2 ? materials.court : materials.courtAlt);
    plank.rotation.x = -Math.PI / 2;
    plank.position.set(0, 0.012, -25 + (i + 0.5) * (50 / 24));
    plank.receiveShadow = true;
    root.add(plank);
  }

  for (const x of [-37.5, 37.5]) {
    const paint = mesh(new THREE.PlaneGeometry(19, 16), materials.paint);
    paint.rotation.x = -Math.PI / 2;
    paint.position.set(x, 0.022, 0);
    paint.receiveShadow = true;
    root.add(paint);
  }

  addCourtMarkings(root);
  const homeAttack = addHoop(root, 1);
  const awayAttack = addHoop(root, -1);
  addArchitecture(root);
  addCrowd(root, crowdSections);

  const hemi = new THREE.HemisphereLight(palette.window, palette.wallDark, styleName === "paper" ? 1.85 : 1.45);
  root.add(hemi);
  const key = new THREE.DirectionalLight(0xffe6b7, styleName === "paper" ? 2.15 : styleName === "resin" ? 4.35 : 4.1);
  key.position.set(18, 46, -32);
  key.target.position.set(34, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -42;
  key.shadow.camera.right = 42;
  key.shadow.camera.top = 36;
  key.shadow.camera.bottom = -36;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 115;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.025;
  root.add(key, key.target);

  const fill = new THREE.DirectionalLight(0xc7d0c4, 0.65);
  fill.position.set(30, 16, 28);
  fill.target.position.set(34, 2, 0);
  root.add(fill, fill.target);

  return {
    root,
    crowdSections,
    hoops: { homeAttack, awayAttack },
    rim: homeAttack.rim,
    rimNeck: homeAttack.rimNeck,
    netRopes: homeAttack.netRopes,
  };
}

function addCourtMarkings(root) {
  const y = 0.045;
  const line = materials.courtLine;
  root.add(lineLoop([
    courtPoint(-47, -25, y), courtPoint(47, -25, y), courtPoint(47, 25, y), courtPoint(-47, 25, y),
  ], line));
  root.add(lineLoop([
    courtPoint(28, -8, y), courtPoint(47, -8, y), courtPoint(47, 8, y), courtPoint(28, 8, y),
  ], line));
  root.add(lineLoop([
    courtPoint(-47, -8, y), courtPoint(-28, -8, y), courtPoint(-28, 8, y), courtPoint(-47, 8, y),
  ], line));

  const freeCircle = circleLine(28, 0, 6, 64, y, line);
  root.add(freeCircle);
  root.add(circleLine(-28, 0, 6, 64, y, line));
  const restricted = arcLine(42, 0, 4.1, Math.PI * 0.08, Math.PI * 0.92, 32, y, line);
  root.add(restricted);
  root.add(arcLine(-42, 0, 4.1, Math.PI * 1.08, Math.PI * 1.92, 32, y, line));

  const threePoints = [];
  for (let i = 0; i <= 48; i += 1) {
    const a = lerp(-1.16, 1.16, i / 48);
    threePoints.push(courtPoint(42 - Math.cos(a) * 23.2, Math.sin(a) * 23.2, y));
  }
  root.add(polyLine(threePoints, line));
  root.add(polyLine([courtPoint(47, -22, y), courtPoint(35.6, -22, y)], line));
  root.add(polyLine([courtPoint(47, 22, y), courtPoint(35.6, 22, y)], line));
  const leftThreePoints = [];
  for (let i = 0; i <= 48; i += 1) {
    const a = lerp(-1.16, 1.16, i / 48);
    leftThreePoints.push(courtPoint(-42 + Math.cos(a) * 23.2, Math.sin(a) * 23.2, y));
  }
  root.add(polyLine(leftThreePoints, line));
  root.add(polyLine([courtPoint(-47, -22, y), courtPoint(-35.6, -22, y)], line));
  root.add(polyLine([courtPoint(-47, 22, y), courtPoint(-35.6, 22, y)], line));

  const center = circleLine(0, 0, 6, 64, y, line);
  root.add(center);
  root.add(polyLine([courtPoint(0, -25, y), courtPoint(0, 25, y)], line));
}

function addHoop(root, side = 1) {
  const assembly = new THREE.Group();
  assembly.name = side > 0 ? "Home attacking basket" : "Away attacking basket";
  const support = mesh(new THREE.BoxGeometry(1.05, 10.4, 1.05), materials.ink);
  support.position.set(46.2 * side, 5.2, 0);
  support.castShadow = true;
  support.receiveShadow = true;
  assembly.add(support);

  const arm = mesh(new THREE.BoxGeometry(4.8, 0.55, 0.62), materials.ink);
  arm.position.set(44.2 * side, 9.2, 0);
  arm.castShadow = true;
  assembly.add(arm);

  const board = mesh(new THREE.BoxGeometry(0.34, 6.2, 11), materials.backboard);
  board.position.set(44.5 * side, 11.2, 0);
  board.castShadow = true;
  board.receiveShadow = true;
  assembly.add(board);

  const square = lineLoop([
    new THREE.Vector3(44.29 * side, 9.2, -3), new THREE.Vector3(44.29 * side, 12.4, -3),
    new THREE.Vector3(44.29 * side, 12.4, 3), new THREE.Vector3(44.29 * side, 9.2, 3),
  ], materials.boardLine);
  assembly.add(square);

  const rim = mesh(new THREE.TorusGeometry(2.05, 0.15, 10, 48), materials.rim);
  rim.position.set(42 * side, 10, 0);
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = true;
  assembly.add(rim);

  const neck = mesh(new THREE.BoxGeometry(2.4, 0.2, 0.28), materials.rim);
  neck.position.set(43.25 * side, 10, 0);
  neck.castShadow = true;
  assembly.add(neck);

  const netRopes = [];
  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2;
    const top = new THREE.Vector3(42 * side + Math.cos(angle) * 2, 9.9, Math.sin(angle) * 2);
    const bottom = new THREE.Vector3(42 * side + Math.cos(angle) * 1.18, 7.45, Math.sin(angle) * 1.18);
    const rope = mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 5), materials.net);
    setWorldSegment(rope, top, bottom);
    rope.castShadow = true;
    rope.userData.top = top;
    rope.userData.bottom = bottom;
    rope.userData.angle = angle;
    netRopes.push(rope);
    assembly.add(rope);
  }

  root.add(assembly);
  return { side, rim, rimNeck: neck, netRopes };
}

function addArchitecture(root) {
  const backWall = mesh(new THREE.BoxGeometry(112, 39, 2.2), materials.wall);
  backWall.position.set(0, 18.8, -35.5);
  backWall.receiveShadow = true;
  root.add(backWall);

  for (const side of [-1, 1]) {
    const endWall = mesh(new THREE.BoxGeometry(2.2, 39, 72), materials.wallDark);
    endWall.position.set(55.2 * side, 18.8, 0);
    endWall.receiveShadow = true;
    root.add(endWall);

    const clubPanel = mesh(
      new THREE.BoxGeometry(0.24, 7.5, 22),
      side > 0 ? materials.home : materials.away,
    );
    clubPanel.position.set(53.98 * side, 27.5, 0);
    clubPanel.receiveShadow = true;
    root.add(clubPanel);

  }

  const bayWidths = [11, 13, 10, 14, 11, 12, 10];
  let x = -49;
  for (let level = 0; level < 3; level += 1) {
    x = -49;
    bayWidths.forEach((width, index) => {
      const pane = mesh(new THREE.BoxGeometry(width - 1.05, 7.2, 0.28), materials.window);
      pane.position.set(x + width * 0.5, 7.5 + level * 9.2, -34.2);
      pane.receiveShadow = true;
      root.add(pane);
      const mullion = mesh(new THREE.BoxGeometry(0.52, 8.1, 0.5), materials.mullion);
      mullion.position.set(x + width, 7.5 + level * 9.2, -33.95);
      mullion.castShadow = true;
      root.add(mullion);
      if ((index + level) % 2 === 0) {
        const cross = mesh(new THREE.BoxGeometry(width - 1.1, 0.42, 0.48), materials.mullion);
        cross.position.set(x + width * 0.5, 7.5 + level * 9.2, -33.94);
        cross.castShadow = true;
        root.add(cross);
      }
      x += width;
    });
  }

  const truss = mesh(new THREE.BoxGeometry(112, 1.05, 1), materials.mullion);
  truss.position.set(0, 34.1, -33.7);
  truss.castShadow = true;
  root.add(truss);
  for (let i = -4; i <= 4; i += 1) {
    const rib = mesh(new THREE.BoxGeometry(0.65, 9.5, 0.7), materials.mullion);
    rib.position.set(i * 12.5, 30.4, -33.7);
    rib.rotation.z = i % 2 ? -0.12 : 0.12;
    rib.castShadow = true;
    root.add(rib);
  }
}

function addCrowd(root, crowdSections) {
  const standTiers = [
    { height: 1.05, y: 0.5, z: -27.5, depth: 2.1 },
    { height: 2.05, y: 1, z: -29.55, depth: 2.2 },
    { height: 3.2, y: 1.58, z: -31.55, depth: 2.25 },
  ];
  standTiers.forEach((tier) => {
    const stand = mesh(new THREE.BoxGeometry(106, tier.height, tier.depth), materials.stand);
    stand.position.set(0, tier.y, tier.z);
    stand.receiveShadow = true;
    root.add(stand);
  });

  // Courtside: a quiet line of individually readable, angular seated silhouettes.
  const courtsideXs = [-40, -34, -27, -19, -11, -3, 5, 13, 21, 28, 34, 39, 44];
  courtsideXs.forEach((x, index) => {
    const width = 1.5 + (index % 3) * 0.22;
    const height = 3.15 + (index % 4) * 0.24;
    const shape = courtsideShape(width, height, index);
    const figure = mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.34 + (index % 2) * 0.08, bevelEnabled: false, steps: 1 }),
      materials.crowdCourt[index % materials.crowdCourt.length],
    );
    figure.position.set(x, 0.5 + (index % 2) * 0.08, -25.95 - (index % 3) * 0.16);
    figure.castShadow = true;
    figure.receiveShadow = true;
    setCrowdResponse(figure, x, 0.26, index % 2 ? -0.018 : 0.014);
    crowdSections.push(figure);
    root.add(figure);
  });

  // Mid-bowl: broad dyed sections with deliberate negative space, never cloned dots.
  const sectionWidths = [10.8, 12.5, 9.7, 13.6, 10.2, 12.8, 9.5, 11.7];
  let cursor = -46;
  sectionWidths.forEach((width, index) => {
    const heights = [2.5, 4.2, 3.15, 5.3, 3.7, 4.7, 2.85];
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    heights.forEach((height, point) => {
      shape.lineTo((point / (heights.length - 1)) * width, height + ((index + point) % 3) * 0.34);
    });
    shape.lineTo(width, 0);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1.8, bevelEnabled: false, steps: 1 });
    const section = mesh(geometry, materials.crowd[index % materials.crowd.length]);
    section.position.set(cursor, 3.05 + (index % 2) * 0.22, -32 + (index % 3) * 0.18);
    section.rotation.y = 0;
    section.castShadow = true;
    section.receiveShadow = true;
    setCrowdResponse(section, cursor + width * 0.5, 0.5 + (index % 3) * 0.08, index % 2 ? -0.01 : 0.01);
    crowdSections.push(section);
    root.add(section);

    const banner = mesh(new THREE.BoxGeometry(width - 0.55, 1.05, 0.2), index % 2 ? materials.home : materials.away);
    banner.position.set(cursor + width * 0.5, 3.05, -28.45);
    banner.castShadow = true;
    root.add(banner);
    cursor += width + 1.1;
  });

  // Upper bowl: larger, quieter paper-cut masses whose contrast falls behind the play.
  const upperWidths = [18, 15, 20, 16, 18];
  cursor = -47;
  upperWidths.forEach((width, index) => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.8, 3.2 + index * 0.2);
    shape.lineTo(width * 0.28, 4.5 - (index % 2) * 0.5);
    shape.lineTo(width * 0.52, 3.6 + (index % 3) * 0.35);
    shape.lineTo(width * 0.78, 4.8 - (index % 2) * 0.4);
    shape.lineTo(width - 0.7, 3.1 + (index % 3) * 0.25);
    shape.lineTo(width, 0);
    shape.closePath();
    const upper = mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 1.05, bevelEnabled: false, steps: 1 }),
      materials.crowdUpper[index % materials.crowdUpper.length],
    );
    upper.position.set(cursor, 9.65 + (index % 2) * 0.4, -33.15);
    upper.castShadow = true;
    upper.receiveShadow = true;
    setCrowdResponse(upper, cursor + width * 0.5, 0.34, index % 2 ? -0.006 : 0.006);
    crowdSections.push(upper);
    root.add(upper);
    cursor += width + 1.8;
  });

}

function courtsideShape(width, height, index) {
  const shoulder = width * (0.72 + (index % 3) * 0.06);
  const lean = (index % 4 - 1.5) * 0.08;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(width * 0.28, 0.16);
  shape.lineTo(width * 0.38, 1.05);
  shape.lineTo(width * 0.68, 1.18);
  shape.lineTo(width * 0.74, 2.05);
  shape.lineTo(width * 0.5 + lean, 2.38);
  shape.lineTo((width - shoulder) * 0.5 + lean, height * 0.67);
  shape.lineTo(width * 0.36 + lean, height * 0.81);
  shape.lineTo(width * 0.38 + lean, height * 0.95);
  shape.lineTo(width * 0.5 + lean, height);
  shape.lineTo(width * 0.64 + lean, height * 0.94);
  shape.lineTo(width * 0.65 + lean, height * 0.8);
  shape.lineTo(width * 0.53 + lean, height * 0.7);
  shape.lineTo(width * 0.9, 2.28);
  shape.lineTo(width, 1.1);
  shape.lineTo(width * 0.84, 0.18);
  shape.closePath();
  return shape;
}

function setCrowdResponse(section, worldX, lift, tilt) {
  section.userData.baseY = section.position.y;
  section.userData.baseRotation = section.rotation.z;
  section.userData.worldX = worldX;
  section.userData.reactionDelay = 150 + clamp(Math.abs(42 - worldX) / 89, 0, 1) * 560;
  section.userData.reactionLift = lift;
  section.userData.reactionTilt = tilt;
}

function makeMaterials(p) {
  const standard = (color, extra = {}) => {
    const common = {
      color,
      flatShading: styleName !== "resin",
    };
    if (extra.transparent !== undefined) common.transparent = extra.transparent;
    if (extra.opacity !== undefined) common.opacity = extra.opacity;
    if (extra.side !== undefined) common.side = extra.side;
    if (styleName === "paper") return new THREE.MeshLambertMaterial(common);
    if (styleName === "resin") return new THREE.MeshPhysicalMaterial({
      ...common,
      roughness: Math.max(0.55, p.roughness),
      metalness: p.metalness,
      clearcoat: 0.24,
      clearcoatRoughness: 0.62,
    });
    return new THREE.MeshStandardMaterial({
      ...common,
      roughness: p.roughness,
      metalness: p.metalness,
    });
  };
  const line = (color) => new THREE.LineBasicMaterial({ color, transparent: false });
  const wallMix = (source, target, amount) => new THREE.Color(source).lerp(new THREE.Color(target), amount);
  return {
    floor: standard(p.wallDark),
    court: standard(p.wood),
    courtAlt: standard(p.woodAlt),
    courtLine: line(p.courtInk),
    boardLine: line(p.ink),
    paint: standard(p.courtPaint),
    wall: standard(p.wall),
    wallDark: standard(p.wallDark),
    window: standard(p.window),
    mullion: standard(p.mullion),
    stand: standard(wallMix(p.wallDark, p.wall, 0.42)),
    ink: standard(p.ink),
    ivory: standard(p.ivory),
    home: standard(p.home),
    away: standard(p.away),
    supportDark: standard(wallMix(p.ink, p.wall, 0.34)),
    supportLight: standard(wallMix(p.ivory, p.wall, 0.22)),
    supportHome: standard(wallMix(p.home, p.wall, 0.36)),
    supportAway: standard(wallMix(p.away, p.wall, 0.36)),
    ball: standard(p.ball),
    rim: standard(p.rim),
    net: standard(p.ivory),
    backboard: standard(p.ivory, { transparent: true, opacity: 0.86, side: THREE.DoubleSide }),
    crowd: p.crowd.map((color) => standard(wallMix(color, p.wall, 0.16))),
    crowdUpper: p.crowd.map((color) => standard(wallMix(color, p.wall, 0.54))),
    crowdCourt: [standard(wallMix(p.ink, p.wall, 0.26)), standard(wallMix(p.ivory, p.wall, 0.45))],
    paperEdge: line(p.ink),
  };
}

function mesh(geometry, material) {
  const result = new THREE.Mesh(geometry, material);
  if (styleName === "paper" && !(geometry instanceof THREE.PlaneGeometry) && !(geometry instanceof THREE.SphereGeometry)) {
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 24), materials.paperEdge);
    edge.scale.setScalar(1.002);
    result.add(edge);
  }
  return result;
}

function lineLoop(points, material) {
  const geometry = new THREE.BufferGeometry().setFromPoints([...points, points[0]]);
  return new THREE.Line(geometry, material);
}

function polyLine(points, material) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geometry, material);
}

function circleLine(x, y, radius, segments, height, material) {
  return arcLine(x, y, radius, 0, Math.PI * 2, segments, height, material);
}

function arcLine(x, y, radius, start, end, segments, height, material) {
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = lerp(start, end, i / segments);
    points.push(courtPoint(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, height));
  }
  return polyLine(points, material);
}

function courtPoint(x, y, height = 0) {
  return new THREE.Vector3(x, height, -y);
}

function mapPoint(value) {
  const p = readPosition(value);
  return new THREE.Vector3(p.x, p.z, -p.y);
}

function unmapPoint(value) {
  return { x: finite(value?.x, 0), y: -finite(value?.z, 0), z: finite(value?.y, 0) };
}

function readPosition(value, fallback = ZERO) {
  if (Array.isArray(value)) return { x: finite(value[0], fallback.x), y: finite(value[1], fallback.y), z: finite(value[2], fallback.z) };
  return {
    x: finite(value?.x, fallback.x),
    y: finite(value?.y, fallback.y),
    z: finite(value?.z, fallback.z),
  };
}

function setSegment(meshPart, start, end, diameter) {
  const delta = tempA.copy(end).sub(start);
  const length = Math.max(0.001, delta.length());
  meshPart.position.copy(tempB.copy(start).add(end).multiplyScalar(0.5));
  tempQuaternion.setFromUnitVectors(Y_AXIS, tempC.copy(delta).normalize());
  meshPart.quaternion.copy(tempQuaternion);
  meshPart.scale.set(diameter, length, diameter);
}

function setWorldSegment(meshPart, start, end) {
  const delta = tempA.copy(end).sub(start);
  const length = Math.max(0.001, delta.length());
  meshPart.position.copy(tempB.copy(start).add(end).multiplyScalar(0.5));
  tempQuaternion.setFromUnitVectors(Y_AXIS, tempC.copy(delta).normalize());
  meshPart.quaternion.copy(tempQuaternion);
  meshPart.scale.y = length;
}

function setJoint(meshPart, position, size) {
  meshPart.position.copy(position);
  meshPart.rotation.set(0, 0, 0);
  meshPart.scale.setScalar(size);
}

function setFoot(meshPart, position, profile, angle) {
  meshPart.position.copy(position).add(new THREE.Vector3(0.28, -0.05, 0));
  meshPart.rotation.set(0, angle, 0);
  meshPart.scale.set(profile.footWidth * 1.5, 0.35, profile.footWidth);
}

function midpoint(a, b) {
  return a.add(b).multiplyScalar(0.5);
}

function resize() {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  drawFrame(timelineMs);
}

function renderGameToText() {
  const sample = lastSample || sampleTimeline(timelineMs);
  const ball = sample?.ball || {};
  const ballPosition = readPosition(ball.position);
  const actorPositions = (sample?.actors || []).slice(0, 10).map((entry) => ({
    id: entry.id,
    name: entry.name,
    side: entry.side,
    position: roundPosition(readPosition(entry.position)),
    facing: round(finite(entry.facing, 0)),
    pose: entry.pose?.id || null,
    visible: entry.state?.visible !== false,
    screenBounds: projectedBounds(actorRigs.get(entry.id)?.root),
  }));
  const attackingX = finite(sample?.broadcast?.attackingRim?.x ?? sample?.contacts?.rim?.point?.x, 42);
  const attackingHoop = attackingX < 0 ? environment.hoops.awayAttack : environment.hoops.homeAttack;
  const audioStatus = broadcastAudio?.status?.() || { state: "unavailable", locked: true, muted: false };
  return JSON.stringify({
    mode: "basketball-broadcast",
    version: window.__CYBERLIGA_VISUAL_RESET__.version,
    autonomous: !captureMode,
    interactive: false,
    captureMode,
    style: styleName,
    broadcastDirector: TIMELINE === BROADCAST_TIMELINE,
    materialThesis: materialTheses[styleName],
    timeMs: Math.round(finite(sample?.timeMs, timelineMs)),
    durationMs: DURATION_MS,
    phase: {
      id: sample?.phase?.id || "unknown",
      index: sample?.phase?.index ?? null,
      progress: round(finite(sample?.phase?.progress, 0)),
    },
    coordinateSystem: TIMELINE?.coordinateSystem || "court origin center; timeline +x toward Toronto basket, +y broadcast-left, +z up",
    camera: renderedCamera,
    possession: {
      side: sample?.broadcast?.possession?.side || sample?.broadcast?.possession?.teamId || (ball.ownerId ? (sample?.actors || []).find((entry) => entry.id === ball.ownerId)?.side || null : null),
      actorId: ball.ownerId || null,
    },
    ball: {
      state: ball.state || null,
      ownerId: ball.ownerId || null,
      hand: ball.hand || null,
      contact: ball.contact || null,
      position: roundPosition(ballPosition),
      screenBounds: projectedBounds(ballRig.root),
    },
    landmarks: {
      attackingRim: {
        position: { x: attackingX < 0 ? -42 : 42, y: 0, z: 10 },
        screenBounds: projectedBounds(attackingHoop.rim),
      },
    },
    actors: actorPositions,
    contacts: sample?.contacts || {},
    score: sample?.score || {},
    broadcast: {
      segmentId: sample?.broadcast?.segment?.id || sample?.broadcast?.segmentId || sample?.phase?.id || null,
      possessionId: sample?.broadcast?.possessionId || null,
      outcome: sample?.broadcast?.outcome || null,
      mode: modeBug?.dataset.mode || "live",
      replay: sample?.broadcast?.replay || null,
      clock: sample?.broadcast?.clock || sample?.clock || null,
      loopId: broadcastLoopId(sample),
    },
    presentation: {
      crowdReaction: sample?.presentation?.crowdReaction || 0,
      storyCard: storyCard?.classList.contains("visible") || false,
      lowerThird: lowerThirdProgress > 0,
      lowerThirdProgress: round(lowerThirdProgress),
      readCard: readCard?.classList.contains("visible") || false,
      commentary: commentaryLine?.classList.contains("visible") || false,
      replayFrame: replayOverlay?.classList.contains("visible") || false,
      modeLabel: modeLabel?.textContent || null,
    },
    audio: audioStatus,
    finiteState,
    performance: performanceSummary(),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: round(Math.min(2, window.devicePixelRatio || 1)),
      aspect: round(window.innerWidth / Math.max(1, window.innerHeight)),
      orientation: window.innerWidth >= window.innerHeight ? "landscape" : "portrait",
    },
  });
}

function performanceSummary() {
  const ordered = renderDurations.slice().sort((a, b) => a - b);
  const percentile = (fraction) => {
    if (!ordered.length) return 0;
    return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * fraction) - 1))];
  };
  return {
    samples: ordered.length,
    latestFrameIntervalMs: round(frameIntervalMs),
    renderP50Ms: round(percentile(0.5)),
    renderP95Ms: round(percentile(0.95)),
    renderMaxMs: round(ordered.length ? ordered[ordered.length - 1] : 0),
    droppedFrameEstimate,
    wallClockDriftMs: captureMode || !lastDrawWasContinuous
      ? null
      : round((timelineMs - timelineStartedAt) - (performance.now() - wallClockStartedAt)),
    warmupComplete: performance.now() >= performanceWarmupUntil,
  };
}

function projectedBounds(object) {
  if (!object || !object.visible) return null;
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) return null;
  const corners = [];
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(x, y, z).project(camera));
    }
  }
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const xs = corners.map((point) => (point.x * 0.5 + 0.5) * width);
  const ys = corners.map((point) => (-point.y * 0.5 + 0.5) * height);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return {
    left: round(left),
    top: round(top),
    right: round(right),
    bottom: round(bottom),
    fullyInsideViewport: left >= 0 && top >= 0 && right <= width && bottom <= height,
  };
}

function inspectFinite(value, seen = new WeakSet()) {
  if (typeof value === "number") return Number.isFinite(value);
  if (!value || typeof value !== "object") return true;
  if (seen.has(value)) return true;
  seen.add(value);
  if (Array.isArray(value)) return value.every((entry) => inspectFinite(entry, seen));
  return Object.values(value).every((entry) => inspectFinite(entry, seen));
}

function inspectSceneFinite() {
  let okay = true;
  scene.traverse((node) => {
    if (!okay) return;
    const values = [
      node.position.x, node.position.y, node.position.z,
      node.scale.x, node.scale.y, node.scale.z,
      node.quaternion.x, node.quaternion.y, node.quaternion.z, node.quaternion.w,
    ];
    if (!values.every(Number.isFinite)) okay = false;
  });
  return okay;
}

function roundPosition(position) {
  return { x: round(position.x), y: round(position.y), z: round(position.z) };
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : Number(fallback) || 0;
}

function wrapTime(value) {
  const duration = Math.max(1, DURATION_MS);
  return ((finite(value, 0) % duration) + duration) % duration;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

function smoothstep(edge0, edge1, value) {
  const amount = clamp01((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return amount * amount * (3 - 2 * amount);
}

function hashCode(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}
