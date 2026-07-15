// crowd.js — reactive stadium crowd for Cyberliga.
//
// One InstancedMesh of low-poly capsule "bodies" placed on the four existing
// terraced stands, plus two tiny prop meshes (flags, scarves). All animation
// is done by rewriting instance matrices each frame from precomputed typed
// arrays (no per-instance allocation, no per-frame allocation).
//
// Every fan gets a persistent behavior archetype at build time:
//   - sitter vs stander (~60/40): sitters are shorter, sway less, react less
//   - personal reaction delay (0–0.4s) + vigor, so eruptions ripple
//   - ~4% flag wavers (second InstancedMesh of team-colored quads overhead)
//   - ~6% scarf holders (thin boxes raised overhead at high excitement)
//   - chant blocks: contiguous ultras sections per team end that run synced
//     bounce bursts every ~30–60s (more often when excitement is high)
//   - despair arm-throwers in the conceding end on goals
//
// Usage (unchanged):
//   import { createCrowd } from './crowd.js';
//   const crowd = createCrowd(scene, { teamA: {...}, teamB: {...} });
//   crowd.update(t, dt);  // every frame
//   crowd.onGoal(teamA | teamB); crowd.onNearMiss(); crowd.onBigKick();
//   crowd.setExcitement(x);

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Stand layout constants (must match the stadium geometry in index.html)
// ---------------------------------------------------------------------------
const ROWS = 9;
const ROW_Y0 = 1.45;     // y of row 0
const ROW_DY = 1.15;     // y step per row
const ROW_DOUT = 2.2;    // outward (away from pitch) step per row
const SEAT_SPACING = 1.05;
const EMPTY_FRACTION = 0.18;  // ~18% of seats left empty
const SUPERFAN_CHANCE = 0.012;

// Each terrace step is 2.2 deep, so we fit TWO staggered sub-rows of bodies
// per step (front + back). That brings us from ~2.9k to ~5.7k seats, the
// density a real packed stand has at this seat spacing.
const SUBROWS = 2;
const SUBROW_OUT = 1.0;  // back sub-row sits 1.0 further from the pitch
const SUBROW_UP = 0.18;  // ...and a touch higher on the step

// Stand descriptors. `axis` is the direction the stand runs along ('x'|'z'),
// `out` is the signed outward direction on the other axis (away from pitch).
// section: 0 = teamA end (West, behind -x goal), 1 = teamB end (East, behind
// +x goal), 2 = neutral side stands (North/South).
const STANDS = [
  { name: 'north', axis: 'x', length: 98, fixed: 28,  out: +1, section: 2 },
  { name: 'south', axis: 'x', length: 98, fixed: -28, out: -1, section: 2 },
  { name: 'east',  axis: 'z', length: 70, fixed: 40,  out: +1, section: 1 },
  { name: 'west',  axis: 'z', length: 70, fixed: -40, out: -1, section: 0 },
];

// Mexican wave tuning
const WAVE_SPEED = 1.4;          // radians/sec around the stadium
const WAVE_HALF_WIDTH = 0.45;    // angular half-width of the standing band
const WAVE_MIN_GAP = 25;         // seconds of calm before a wave can start
const WAVE_MAX_GAP = 45;

// Behavior archetype tuning
const SITTER_FRACTION = 0.6;     // ~60/40 sitters vs standers
const FLAG_CHANCE = 0.04;        // flag wavers (team-end sections only)
const SCARF_CHANCE = 0.06;       // scarf holders (team-end sections only)
const ARMS_CHANCE = 0.05;        // despair arm-throwers in a conceding end
const MAX_REACT_DELAY = 0.4;     // seconds; eruptions ripple, never jump cut

// Chant blocks (ultras sections): contiguous `along`-coordinate ranges in
// each team-end stand. Two blocks per end → 4 blocks total, ids 0..3.
const CHANT_RANGES = [[-28, -12], [8, 24]];
const CHANT_FREQ = 13.2;         // rad/s bounce rhythm (~2.1 Hz, terrace tempo)

// Event durations
const GOAL_DUR = 4.5;            // eruption window
const DESPAIR_DUR = 4.0;         // conceding-end slump
const GASP_DUR = 2.6;            // rise (~0.6s) then grumble-jitter (~2s)

// ---------------------------------------------------------------------------

// Deterministic-ish cheap PRNG so the crowd looks the same every load.
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createCrowd(scene, opts) {
  const teamA = opts.teamA; // West end
  const teamB = opts.teamB; // East end
  let curA = teamA, curB = teamB; // current fixture (setTeams retints)
  // Crowd choreography is presentation state. Callers can inject a domain-
  // separated stream so flashes, waves and chants never advance sporting RNG.
  const rng = opts.rng || makeRng(1337);

  // -------------------------------------------------------------------
  // 1. Generate seat data into temporary JS arrays, then bake to typed.
  // -------------------------------------------------------------------
  const px = [], py = [], pz = [];     // base body-center positions
  const phase = [], speed = [], vigor = [];
  const delay = [];                    // personal reaction delay 0..0.4s
  const seatAngle = [];                // atan2 angle around pitch center (wave)
  const sectionOf = [];                // 0 teamA end, 1 teamB end, 2 neutral
  const scaleY = [], scaleXZ = [];     // base body scale (sitters are lower)
  const flags8 = [];                   // bitfield: 1 sitter, 2 arms-thrower
  const chantOf = [];                  // chant block id, -1 = not an ultra
  const colR = [], colG = [], colB = [];
  const tintTeamTmp = [], tintMulTmp = []; // retint metadata: -1 neutral, 0 A, 1 B
  const flagFanTmp = [], scarfFanTmp = []; // fan indices owning props

  const cA = new THREE.Color(teamA.color);
  const cB = new THREE.Color(teamB.color);
  const neutrals = [
    new THREE.Color(0x4a5a8a), // muted blue
    new THREE.Color(0x5a4a7a), // muted purple
    new THREE.Color(0x6a7088), // blue-gray
    new THREE.Color(0x3d4a6b), // dark slate blue
    new THREE.Color(0x707080), // gray
  ];
  const tmpColor = new THREE.Color();

  // Pick a body color for a seat in a given section. Brightness kept in the
  // 0.4–0.9 range so superfans and goal flashes visibly pop above the crowd.
  function pickColor(section) {
    const superfan = rng() < SUPERFAN_CHANCE;
    if (section === 0 || section === 1) {
      const teamC = section === 0 ? cA : cB;
      if (superfan) { tmpColor.copy(teamC).multiplyScalar(1.6); tintTeamTmp.push(section); tintMulTmp.push(1.6); return true; }
      if (rng() < 0.82) {
        // team color, dimmed with per-fan variation (scarves, shirts, skin)
        const m = 0.4 + rng() * 0.5;
        tmpColor.copy(teamC).multiplyScalar(m);
        tintTeamTmp.push(section); tintMulTmp.push(m);
      } else {
        tmpColor.copy(neutrals[(rng() * neutrals.length) | 0]).multiplyScalar(0.7 + rng() * 0.4);
        tintTeamTmp.push(-1); tintMulTmp.push(0);
      }
      return false;
    }
    // Neutral side stands: mostly muted, scattered fans of both teams.
    if (superfan) {
      const side = rng() < 0.5 ? 0 : 1;
      tmpColor.copy(side === 0 ? cA : cB).multiplyScalar(1.6);
      tintTeamTmp.push(side); tintMulTmp.push(1.6);
      return true;
    }
    const roll = rng();
    if (roll < 0.08)      { const m = 0.45 + rng() * 0.35; tmpColor.copy(cA).multiplyScalar(m); tintTeamTmp.push(0); tintMulTmp.push(m); }
    else if (roll < 0.16) { const m = 0.45 + rng() * 0.35; tmpColor.copy(cB).multiplyScalar(m); tintTeamTmp.push(1); tintMulTmp.push(m); }
    else { tmpColor.copy(neutrals[(rng() * neutrals.length) | 0]).multiplyScalar(0.6 + rng() * 0.45); tintTeamTmp.push(-1); tintMulTmp.push(0); }
    return false;
  }

  for (const stand of STANDS) {
    const seatsPerRow = Math.floor(stand.length / SEAT_SPACING);
    const start = -((seatsPerRow - 1) * SEAT_SPACING) / 2; // center along length
    for (let r = 0; r < ROWS; r++) {
      const rowY = ROW_Y0 + r * ROW_DY;
      const rowOut = stand.fixed + stand.out * (r * ROW_DOUT);
      for (let sub = 0; sub < SUBROWS; sub++) {
        const y = rowY + sub * SUBROW_UP;
        const outPos = rowOut + stand.out * (sub * SUBROW_OUT);
        const stagger = sub * SEAT_SPACING * 0.5; // brick-pattern offset
        for (let s = 0; s < seatsPerRow; s++) {
          if (rng() < EMPTY_FRACTION) continue; // empty seat
          // jitter so it doesn't look like a grid of soldiers
          const along = start + s * SEAT_SPACING + stagger + (rng() - 0.5) * 0.3;
          const x = stand.axis === 'x' ? along : outPos + (rng() - 0.5) * 0.2;
          const z = stand.axis === 'x' ? outPos + (rng() - 0.5) * 0.2 : along;
          const i = px.length;
          px.push(x); py.push(y); pz.push(z);
          phase.push(rng() * Math.PI * 2);
          speed.push(0.8 + rng() * 1.4);
          vigor.push(0.5 + rng() * 0.5);
          delay.push(rng() * MAX_REACT_DELAY);
          seatAngle.push(Math.atan2(z, x)); // angle around pitch center, for the wave
          sectionOf.push(stand.section);
          pickColor(stand.section);
          colR.push(tmpColor.r); colG.push(tmpColor.g); colB.push(tmpColor.b);

          // --- archetype assignment ---
          const isTeamEnd = stand.section === 0 || stand.section === 1;
          let f8 = 0;

          // Chant block membership (ultras): contiguous along-ranges in the
          // team-end stands. Ultras are standers by definition.
          let block = -1;
          if (isTeamEnd) {
            for (let cr = 0; cr < CHANT_RANGES.length; cr++) {
              if (along >= CHANT_RANGES[cr][0] && along <= CHANT_RANGES[cr][1]) {
                block = stand.section * 2 + cr;
                break;
              }
            }
          }
          chantOf.push(block);

          const sitter = block < 0 && rng() < SITTER_FRACTION;
          if (sitter) f8 |= 1;
          if (rng() < ARMS_CHANCE) f8 |= 2;
          flags8.push(f8);

          // Sitters are visibly lower and a touch wider; standers taller.
          scaleY.push(sitter ? 0.68 + rng() * 0.08 : 0.95 + rng() * 0.12);
          scaleXZ.push(sitter ? 1.0 + rng() * 0.12 : 0.88 + rng() * 0.14);

          // Props live in the team ends, mostly held by standers/ultras.
          if (isTeamEnd && !sitter) {
            if (rng() < FLAG_CHANCE * 2.2) flagFanTmp.push(i);       // ~4% of all
            else if (rng() < SCARF_CHANCE * 2.6) scarfFanTmp.push(i); // ~6% of all
          }
        }
      }
    }
  }

  const COUNT = px.length; // ~5.7k seats * 0.82 occupancy ≈ 4.7–5.8k
  const baseX = Float32Array.from(px);
  const baseY = Float32Array.from(py);
  const baseZ = Float32Array.from(pz);
  const fPhase = Float32Array.from(phase);
  const fSpeed = Float32Array.from(speed);
  const fVigor = Float32Array.from(vigor);
  const fDelay = Float32Array.from(delay);
  const fAngle = Float32Array.from(seatAngle);
  const fScaleY = Float32Array.from(scaleY);
  const fScaleXZ = Float32Array.from(scaleXZ);
  const uSection = Uint8Array.from(sectionOf);
  const uFlags = Uint8Array.from(flags8);
  const iChant = Int8Array.from(chantOf);
  const tintTeam = Int8Array.from(tintTeamTmp);
  const tintMul = Float32Array.from(tintMulTmp);
  const baseColor = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    baseColor[i * 3] = colR[i];
    baseColor[i * 3 + 1] = colG[i];
    baseColor[i * 3 + 2] = colB[i];
  }
  // Per-section index lists so goal flashes can concentrate in the scoring end.
  const sectIdx = [[], []];
  for (let i = 0; i < COUNT; i++) {
    if (uSection[i] < 2) sectIdx[uSection[i]].push(i);
  }
  const sect0 = Int32Array.from(sectIdx[0]);
  const sect1 = Int32Array.from(sectIdx[1]);

  // -------------------------------------------------------------------
  // 2. Build the InstancedMeshes — bodies + flags + scarves, self-lit.
  // -------------------------------------------------------------------
  const bodyGeo = new THREE.CapsuleGeometry(0.26, 0.5, 2, 6); // low-poly torso+head blob
  bodyGeo.translate(0, 0.5, 0); // pivot at the feet so y-scale = standing up
  const bodyMat = new THREE.MeshBasicMaterial();
  const mesh = new THREE.InstancedMesh(bodyGeo, bodyMat, COUNT);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false; // stands surround the camera; skip culling churn

  // Per-instance color (drives MeshBasicMaterial automatically via instanceColor)
  for (let i = 0; i < COUNT; i++) {
    tmpColor.setRGB(baseColor[i * 3], baseColor[i * 3 + 1], baseColor[i * 3 + 2]);
    mesh.setColorAt(i, tmpColor);
  }
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);

  const matArray = mesh.instanceMatrix.array;   // write matrices directly
  const colArray = mesh.instanceColor.array;

  // Last computed y-offset and y-scale per fan, so props can ride their owner
  // even on frames where the owner's matrix is skipped (half-rate idling).
  const fanYOff = new Float32Array(COUNT);
  const fanSy = new Float32Array(COUNT);
  fanSy.fill(1);

  // Write every instance's resting matrix once so no fan renders as a clump
  // at the origin before its first (possibly parity-skipped) update pass.
  for (let i = 0; i < COUNT; i++) {
    const sxz = fScaleXZ[i];
    const o = i * 16;
    matArray[o] = sxz;    matArray[o + 1] = 0;  matArray[o + 2] = 0;  matArray[o + 3] = 0;
    matArray[o + 4] = 0;  matArray[o + 5] = fScaleY[i]; matArray[o + 6] = 0;  matArray[o + 7] = 0;
    matArray[o + 8] = 0;  matArray[o + 9] = 0;  matArray[o + 10] = sxz; matArray[o + 11] = 0;
    matArray[o + 12] = baseX[i];
    matArray[o + 13] = baseY[i];
    matArray[o + 14] = baseZ[i];
    matArray[o + 15] = 1;
  }
  mesh.instanceMatrix.needsUpdate = true;

  // --- Flags: small team-colored quads waving above ~4% of fans ---
  const FLAG_COUNT = flagFanTmp.length;
  const flagFan = Int32Array.from(flagFanTmp);
  const flagYaw = new Float32Array(FLAG_COUNT * 2); // cos,sin of fixed yaw
  const flagPhase = new Float64Array(FLAG_COUNT);   // integrated wave phase (no aliasing)
  const flagMul = new Float32Array(FLAG_COUNT);     // retint multiplier
  const flagGeo = new THREE.PlaneGeometry(1.0, 0.6);
  flagGeo.translate(0.5, 0, 0); // pivot at the held edge so Rz = waving
  const flagMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const flagMesh = new THREE.InstancedMesh(flagGeo, flagMat, Math.max(FLAG_COUNT, 1));
  flagMesh.count = FLAG_COUNT;
  flagMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  flagMesh.frustumCulled = false;
  for (let f = 0; f < FLAG_COUNT; f++) {
    const i = flagFan[f];
    const yaw = fAngle[i] + Math.PI / 2 + (rng() - 0.5) * 0.8; // roughly along the stand
    flagYaw[f * 2] = Math.cos(yaw);
    flagYaw[f * 2 + 1] = Math.sin(yaw);
    flagPhase[f] = fPhase[i];
    flagMul[f] = 1.25 + rng() * 0.35;
    tmpColor.copy(uSection[i] === 0 ? cA : cB).multiplyScalar(flagMul[f]);
    flagMesh.setColorAt(f, tmpColor);
  }
  if (FLAG_COUNT > 0) scene.add(flagMesh);
  const flagMat4 = flagMesh.instanceMatrix.array;

  // --- Scarves: thin stretched boxes held overhead at high excitement ---
  const SCARF_COUNT = scarfFanTmp.length;
  const scarfFan = Int32Array.from(scarfFanTmp);
  const scarfYaw = new Float32Array(SCARF_COUNT * 2);
  const scarfMul = new Float32Array(SCARF_COUNT); // retint multiplier, -1 = white
  const scarfGeo = new THREE.BoxGeometry(1.15, 0.12, 0.05);
  const scarfMat = new THREE.MeshBasicMaterial();
  const scarfMesh = new THREE.InstancedMesh(scarfGeo, scarfMat, Math.max(SCARF_COUNT, 1));
  scarfMesh.count = SCARF_COUNT;
  scarfMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scarfMesh.frustumCulled = false;
  for (let f = 0; f < SCARF_COUNT; f++) {
    const i = scarfFan[f];
    const yaw = fAngle[i] + Math.PI / 2 + (rng() - 0.5) * 0.5;
    scarfYaw[f * 2] = Math.cos(yaw);
    scarfYaw[f * 2 + 1] = Math.sin(yaw);
    // Scarves are brighter than shirts: team color or white-ish halves.
    if (rng() < 0.3) { scarfMul[f] = -1; tmpColor.setRGB(0.85, 0.85, 0.9); }
    else { scarfMul[f] = 1.1 + rng() * 0.4; tmpColor.copy(uSection[i] === 0 ? cA : cB).multiplyScalar(scarfMul[f]); }
    scarfMesh.setColorAt(f, tmpColor);
  }
  if (SCARF_COUNT > 0) scene.add(scarfMesh);
  const scarfMat4 = scarfMesh.instanceMatrix.array;

  // -------------------------------------------------------------------
  // 3. Animation state
  // -------------------------------------------------------------------
  let excitement = 0.25;     // 0..1 ambient baseline (setExcitement)

  // Event timers: each holds the t at which the effect ends (-1 = inactive)
  let goalEnd = -1, goalStart = 0, goalSection = -1, sadSection = -1;
  let gaspEnd = -1, gaspStart = 0;
  let stirEnd = -1, stirStart = 0;

  // Mexican wave
  let nextWaveAt = -1;       // scheduled start (set on first update)
  let waveActive = false;
  let waveAngle = 0;         // current wave front angle
  let waveTravelled = 0;     // radians covered (stop after one lap)
  let waveAmp = 0;           // global amplitude envelope 0..1 (fade in/out)
  let waveDying = false;     // fading out (lap complete or event kill)

  // Chant blocks (4 ultras sections, ids 0..3). Each runs 5–10s bounce
  // bursts; the gap between bursts shrinks as excitement rises.
  const chantStart = new Float64Array(4).fill(-1);
  const chantEnd = new Float64Array(4).fill(-1);
  const nextChantAt = new Float64Array(4).fill(-1);
  const chantEnv = new Float32Array(4); // per-frame envelope cache

  // Camera flashes during goal celebrations: a small pool of indices whose
  // colors are temporarily blown out to white, restored next frame.
  const FLASH_POOL = 48;
  const flashIdx = new Int32Array(FLASH_POOL).fill(-1);
  const flashTTL = new Float32Array(FLASH_POOL); // remaining life in seconds

  // Tick flash lifetimes down; restore expired ones. Returns true if any
  // colors changed. A flash lives ~0.1s so it reads as a real phone flash
  // instead of a 1-frame shimmer.
  function decayFlashes(dt) {
    let dirty = false;
    for (let f = 0; f < FLASH_POOL; f++) {
      const i = flashIdx[f];
      if (i < 0) continue;
      flashTTL[f] -= dt;
      if (flashTTL[f] > 0) continue;
      colArray[i * 3] = baseColor[i * 3];
      colArray[i * 3 + 1] = baseColor[i * 3 + 1];
      colArray[i * 3 + 2] = baseColor[i * 3 + 2];
      flashIdx[f] = -1;
      dirty = true;
    }
    return dirty;
  }

  function igniteFlash(f, i) {
    flashIdx[f] = i;
    flashTTL[f] = 0.07 + rng() * 0.06;
    colArray[i * 3] = 2.5; colArray[i * 3 + 1] = 2.5; colArray[i * 3 + 2] = 2.5;
  }

  // -------------------------------------------------------------------
  // 4. Public API
  // -------------------------------------------------------------------
  const TWO_PI = Math.PI * 2;
  // Events fire from game code between frames; anchor their timers to the
  // most recent t seen by update() instead of reaching for a wall clock.
  let lastT = 0;
  let frame = 0;          // parity counter for half-rate idle updates
  let scarfRaise = 0;     // smoothed global scarf raise 0..1

  function update(t, dt) {
    lastT = t;
    frame++;
    // ---- schedule / advance the mexican wave (only during calm play) ----
    if (nextWaveAt < 0) nextWaveAt = t + WAVE_MIN_GAP + rng() * (WAVE_MAX_GAP - WAVE_MIN_GAP);
    const eventBusy = t < goalEnd || t < gaspEnd;
    if (!waveActive && !eventBusy && t >= nextWaveAt) {
      waveActive = true;
      waveDying = false;
      waveAmp = 0;
      waveAngle = rng() * TWO_PI;
      waveTravelled = 0;
    }
    if (waveActive) {
      waveAngle += WAVE_SPEED * dt;
      waveTravelled += WAVE_SPEED * dt;
      // a goal fades the wave out fast; a completed lap fades it out gently —
      // either way the standing band ramps down instead of teleporting.
      if (eventBusy || waveTravelled >= TWO_PI) waveDying = true;
      waveAmp += waveDying ? -dt / (eventBusy ? 0.25 : 0.7) : dt / 0.7;
      if (waveAmp >= 1) waveAmp = 1;
      else if (waveAmp <= 0) {
        waveAmp = 0;
        waveActive = false;
        waveDying = false;
        nextWaveAt = t + WAVE_MIN_GAP + rng() * (WAVE_MAX_GAP - WAVE_MIN_GAP);
      }
    }

    // ---- schedule / advance chant bursts (per ultras block) ----
    let anyChant = false;
    for (let b = 0; b < 4; b++) {
      if (nextChantAt[b] < 0) {
        nextChantAt[b] = t + 6 + rng() * 24; // first burst comes soon-ish
      }
      if (t >= chantEnd[b] && t >= nextChantAt[b] && !eventBusy) {
        chantStart[b] = t;
        chantEnd[b] = t + 5 + rng() * 5; // 5–10s burst
        // gap 30–60s, compressed up to ~2.5x at full excitement
        const gap = (30 + rng() * 30) / (1 + 1.5 * excitement);
        nextChantAt[b] = chantEnd[b] + gap;
      }
      // envelope: 1s ramp in/out
      let env = 0;
      if (t >= chantStart[b] && t < chantEnd[b]) {
        const inE = Math.min(1, (t - chantStart[b]) / 1.0);
        const outE = Math.min(1, (chantEnd[b] - t) / 1.0);
        env = Math.min(inE, outE);
        anyChant = true;
      }
      chantEnv[b] = env;
    }
    // Synced bounce rhythm, shared by everyone in a block (the ultras visual):
    const chantBounce = Math.max(0, Math.sin(t * CHANT_FREQ));

    // ---- shared event window flags (per-fan envelopes use fDelay) ----
    const goalLive = t < goalEnd + MAX_REACT_DELAY;
    const gaspLive = t < gaspEnd + MAX_REACT_DELAY;
    // Big kick stir (1s): a gentle bump, same for all (it's subtle anyway).
    let stirEnv = 0;
    if (t < stirEnd) {
      const e = (t - stirStart) / (stirEnd - stirStart);
      stirEnv = Math.sin(Math.min(e, 1) * Math.PI) * 0.35;
    }
    // Coarse goal envelope (for flash density / flag frenzy / scarf raise).
    let goalEnvCoarse = 0;
    if (t < goalEnd) {
      const e = (t - goalStart) / GOAL_DUR;
      goalEnvCoarse = e < 0.1 ? e / 0.1 : 1 - (e - 0.1) / 0.9;
    }

    // Scarves rise on excitement and goals, settle slowly when calm.
    const scarfTarget = Math.min(1, excitement * 1.2 + goalEnvCoarse * 1.5);
    scarfRaise += (scarfTarget - scarfRaise) * (1 - Math.exp(-(scarfTarget > scarfRaise ? 5 : 1.2) * dt));

    const idleAmp = 0.05 + 0.1 * excitement; // ambient bob amplitude
    const wAngle = waveAngle % TWO_PI;
    const wEnv = waveAmp * waveAmp * (3 - 2 * waveAmp); // C1 wave fade envelope

    // Half-rate idling: when nothing is happening, only touch fans whose
    // index parity matches the frame parity. The skipped half keeps last
    // frame's matrix — invisible at idle amplitudes, halves the hot loop.
    const busy = goalLive || gaspLive || stirEnv > 0 || waveActive || anyChant;
    const parity = frame & 1;

    // ---- per-instance matrix rewrite (cheap math only) ----
    for (let i = 0; i < COUNT; i++) {
      if (!busy && (i & 1) !== parity) continue;

      const ph = fPhase[i];
      const vg = fVigor[i];
      const fl = uFlags[i];
      const sitter = fl & 1;
      const sect = uSection[i];

      // Idle sway/bob with random phase + speed; sitters sway small.
      const wob = t * fSpeed[i] + ph;
      const sitFac = sitter ? 0.4 : 1.0;
      let yOff = Math.sin(wob) * idleAmp * vg * sitFac;
      let xLean = Math.sin(wob * 0.5 + ph) * (sitter ? 0.025 : 0.045);
      let sy = 1; // y-scale multiplier (standing/jumping stretch)

      // Mexican wave: fans STAND as the front passes — rise + arms-up
      // stretch. Sitters join late and half-heartedly.
      if (waveActive) {
        let d = fAngle[i] - wAngle;
        if (d > Math.PI) d -= TWO_PI; else if (d < -Math.PI) d += TWO_PI;
        if (sitter) d += 0.12; // late reaction: front passes, THEN they rise
        const ad = d < 0 ? -d : d;
        if (ad < WAVE_HALF_WIDTH) {
          const k = Math.cos((ad / WAVE_HALF_WIDTH) * Math.PI * 0.5); // 1 at front
          const part = sitter ? 0.45 : 1.0; // half-hearted sitters
          yOff += 0.55 * k * part * wEnv;
          sy += (sitter ? 0.35 : 0.55) * k * part * wEnv; // stand + arms-up stretch
        }
      }

      // Chant bounce: whole ultras block hops in one synced rhythm.
      const cb = iChant[i];
      if (cb >= 0 && chantEnv[cb] > 0) {
        const env = chantEnv[cb];
        yOff += chantBounce * 0.5 * env;
        sy += chantBounce * 0.12 * env;
      }

      // Goal: scoring end erupts (rippling in via personal delay); the
      // CONCEDING end slumps into despair instead.
      if (goalLive) {
        const e = (t - fDelay[i] - goalStart) / GOAL_DUR;
        if (e > 0 && e < 1) {
          const env = e < 0.1 ? e / 0.1 : 1 - (e - 0.1) / 0.9;
          if (sect === sadSection) {
            // Despair: stillness + slump... except the arm-throwers, who
            // spike tall (arms up in disbelief) then sag below baseline.
            // dEnv eases the whole act in (~0.4s) and out (~0.7s) so nothing
            // engages or releases as a step when the window opens/closes.
            const el = t - fDelay[i] - goalStart;
            const ds = Math.min(1, el / DESPAIR_DUR);
            const dEnv = Math.min(1, el / 0.4, (GOAL_DUR - el) / 0.7);
            yOff *= 1 - 0.85 * dEnv; xLean *= 1 - 0.7 * dEnv;
            if (fl & 2) {
              sy += (ds < 0.15 ? (ds / 0.15) * 0.4 : 0.4 - (ds - 0.15) / 0.85 * 0.65) * dEnv;
            } else {
              sy -= 0.18 * Math.min(1, ds * 4) * (1 - ds * 0.3) * (sitter ? 0.6 : 1.0) * dEnv;
            }
          } else {
            const boost = sect === goalSection ? 2.0 : 1.0;
            // per-instance jump rhythm so it's a roiling mass, not a synced hop
            const jump = Math.abs(Math.sin(t * (3 + vg * 3) + ph));
            yOff += env * boost * vg * 1.1 * jump * (sitter ? 0.6 : 1.0);
            sy += env * 0.2 * boost * jump;
          }
        }
      }

      // Near-miss gasp: sharp rise (rippling via personal delay), then a
      // settle with grumble-jitter — the crowd muttering back into seats.
      if (gaspLive) {
        const ge = t - fDelay[i] - gaspStart;
        if (ge > 0 && ge < GASP_DUR) {
          if (ge < 0.35) {
            const k = ge / 0.35;
            yOff += k * 0.5 * (0.7 + 0.3 * vg) * sitFac;
            sy += k * 0.2 * sitFac;
          } else {
            const settle = 1 - (ge - 0.35) / (GASP_DUR - 0.35); // 1 → 0
            // settle² starts exactly at the rise peak and eases down — no pop
            const s2 = settle * settle;
            yOff += s2 * 0.5 * (0.7 + 0.3 * vg) * sitFac;
            sy += s2 * 0.2 * sitFac;
            // grumble: fast small jitter, zero at both ends of the settle
            const gj = settle * (1 - settle) * 4;
            yOff += Math.sin(t * 14 + ph * 3) * 0.05 * gj * vg;
            xLean += Math.sin(t * 9 + ph) * 0.05 * gj;
          }
        }
      }

      // Stir: small ripple keyed off seat angle so it sweeps subtly
      if (stirEnv > 0) yOff += stirEnv * (0.6 + 0.4 * Math.sin(fAngle[i] * 3 + t * 6)) * vg * sitFac;

      fanYOff[i] = yOff;
      fanSy[i] = sy;

      // Write the matrix directly: base xz scale, base*sy on y, translation.
      // (Bodies are rotationally symmetric capsules, so no rotation needed.)
      const sxz = fScaleXZ[i];
      const o = i * 16;
      matArray[o] = sxz;    matArray[o + 1] = 0;  matArray[o + 2] = 0;  matArray[o + 3] = 0;
      matArray[o + 4] = 0;  matArray[o + 5] = fScaleY[i] * sy; matArray[o + 6] = 0;  matArray[o + 7] = 0;
      matArray[o + 8] = 0;  matArray[o + 9] = 0;  matArray[o + 10] = sxz; matArray[o + 11] = 0;
      matArray[o + 12] = baseX[i] + xLean;
      matArray[o + 13] = baseY[i] + yOff;
      matArray[o + 14] = baseZ[i];
      matArray[o + 15] = 1;
    }
    mesh.instanceMatrix.needsUpdate = true;

    // ---- flags: gentle idle wave, frantic after their team scores ----
    for (let f = 0; f < FLAG_COUNT; f++) {
      const i = flagFan[f];
      const ph = fPhase[i];
      // frenzy only for the scoring end's flags
      const frenzy = goalEnvCoarse > 0 && uSection[i] === goalSection ? goalEnvCoarse : 0;
      const wSpeed = 2.2 + fSpeed[i] + frenzy * 9;
      const wAmp = 0.18 + 0.1 * excitement + frenzy * 0.55;
      // integrate phase (phase += ω·dt) so frequency ramps (goal frenzy)
      // shift smoothly instead of aliasing sin(t·ω) into a strobe
      const fp = flagPhase[f] += wSpeed * dt;
      const roll = Math.sin(fp) * wAmp;
      const cz = Math.cos(roll), sz = Math.sin(roll);
      const cy = flagYaw[f * 2], syaw = flagYaw[f * 2 + 1];
      // cloth "breathes": x-scale pulses out of phase with the roll
      const sx = 0.78 + 0.22 * Math.sin(fp * 1.3 + ph);
      const o = f * 16;
      // M = T * Rz(roll) * Ry(yaw) * Sx — column-major
      flagMat4[o] = sx * cz * cy;       flagMat4[o + 1] = sx * sz * cy;  flagMat4[o + 2] = -sx * syaw; flagMat4[o + 3] = 0;
      flagMat4[o + 4] = -sz;            flagMat4[o + 5] = cz;            flagMat4[o + 6] = 0;          flagMat4[o + 7] = 0;
      flagMat4[o + 8] = cz * syaw;      flagMat4[o + 9] = sz * syaw;     flagMat4[o + 10] = cy;        flagMat4[o + 11] = 0;
      flagMat4[o + 12] = baseX[i];
      flagMat4[o + 13] = baseY[i] + fanYOff[i] + 1.45 * fScaleY[i] * fanSy[i];
      flagMat4[o + 14] = baseZ[i];
      flagMat4[o + 15] = 1;
    }
    if (FLAG_COUNT > 0) flagMesh.instanceMatrix.needsUpdate = true;

    // ---- scarves: held overhead when excited, tucked away when calm ----
    for (let f = 0; f < SCARF_COUNT; f++) {
      const i = scarfFan[f];
      const ph = fPhase[i];
      const raise = scarfRaise * (0.6 + 0.4 * fVigor[i]);
      // side-to-side sway while held up, like the whole end singing
      const roll = Math.sin(t * 2.6 + ph * 0.5) * 0.35 * raise;
      const cz = Math.cos(roll), sz = Math.sin(roll);
      const cy = scarfYaw[f * 2], syaw = scarfYaw[f * 2 + 1];
      // scale grows smoothly from zero as the scarf comes up (no pop-in)
      const q = Math.min(1, raise * 4);
      const s = q * q * (3 - 2 * q) * (0.5 + 0.5 * raise);
      const o = f * 16;
      scarfMat4[o] = s * cz * cy;   scarfMat4[o + 1] = s * sz * cy;  scarfMat4[o + 2] = -s * syaw; scarfMat4[o + 3] = 0;
      scarfMat4[o + 4] = -s * sz;   scarfMat4[o + 5] = s * cz;       scarfMat4[o + 6] = 0;         scarfMat4[o + 7] = 0;
      scarfMat4[o + 8] = s * cz * syaw; scarfMat4[o + 9] = s * sz * syaw; scarfMat4[o + 10] = s * cy; scarfMat4[o + 11] = 0;
      scarfMat4[o + 12] = baseX[i];
      scarfMat4[o + 13] = baseY[i] + fanYOff[i] + (0.7 + raise * 0.85) * fScaleY[i] * fanSy[i];
      scarfMat4[o + 14] = baseZ[i];
      scarfMat4[o + 15] = 1;
    }
    if (SCARF_COUNT > 0) scarfMesh.instanceMatrix.needsUpdate = true;

    // ---- phone/camera flashes ----
    // Age out lit flashes, then ignite new ones into free pool slots. Spawn
    // chances are rates (* dt) so density is frame-rate independent: dense in
    // the scoring end during eruptions, a rare twinkle elsewhere.
    let colorsDirty = decayFlashes(dt);
    if (goalEnvCoarse > 0.15) {
      const scoring = goalSection === 0 ? sect0 : sect1;
      for (let f = 0; f < FLASH_POOL; f++) {
        if (flashIdx[f] >= 0) continue; // slot still lit
        if (rng() > goalEnvCoarse * 8 * dt) continue; // density follows the envelope
        // 75% of flashes concentrate in the scoring end, the rest scatter
        const i = rng() < 0.75
          ? scoring[(rng() * scoring.length) | 0]
          : (rng() * COUNT) | 0;
        igniteFlash(f, i);
        colorsDirty = true;
      }
    } else if (rng() < (2.4 + excitement * 6) * dt) {
      // ambient: the odd phone flash somewhere in the dark
      for (let f = 0; f < FLASH_POOL; f++) {
        if (flashIdx[f] < 0) {
          igniteFlash(f, (rng() * COUNT) | 0);
          colorsDirty = true;
          break;
        }
      }
    }
    if (colorsDirty) mesh.instanceColor.needsUpdate = true;
  }

  return {
    update,

    /** Goal scored by `team` (current fixture team set via setTeams, or the
     *  build-time opts.teamA/teamB sentinels). 4.5s eruption in the scoring
     *  end, 4s despair slump in the conceding end. */
    onGoal(team) {
      goalSection = team === curA ? 0 : team === curB ? 1 : team === teamA ? 0 : 1;
      sadSection = 1 - goalSection;
      goalStart = lastT; goalEnd = goalStart + GOAL_DUR;
    },

    /** Retint crowd bodies, flags and scarves for a new fixture (call when
     *  matches rotate teams). Layout/archetypes stay fixed — no rebuild. */
    setTeams(a, b) {
      if (!a || !b) return;
      curA = a; curB = b;
      cA.set(a.color); cB.set(b.color);
      for (let i = 0; i < COUNT; i++) {
        const tt = tintTeam[i];
        if (tt < 0) continue;
        tmpColor.copy(tt === 0 ? cA : cB).multiplyScalar(tintMul[i]);
        baseColor[i * 3] = tmpColor.r; baseColor[i * 3 + 1] = tmpColor.g; baseColor[i * 3 + 2] = tmpColor.b;
        colArray[i * 3] = tmpColor.r; colArray[i * 3 + 1] = tmpColor.g; colArray[i * 3 + 2] = tmpColor.b;
      }
      mesh.instanceColor.needsUpdate = true;
      for (let f = 0; f < FLAG_COUNT; f++) {
        tmpColor.copy(uSection[flagFan[f]] === 0 ? cA : cB).multiplyScalar(flagMul[f]);
        flagMesh.setColorAt(f, tmpColor);
      }
      if (FLAG_COUNT > 0) flagMesh.instanceColor.needsUpdate = true;
      for (let f = 0; f < SCARF_COUNT; f++) {
        if (scarfMul[f] < 0) continue; // white-ish scarves stay white
        tmpColor.copy(uSection[scarfFan[f]] === 0 ? cA : cB).multiplyScalar(scarfMul[f]);
        scarfMesh.setColorAt(f, tmpColor);
      }
      if (SCARF_COUNT > 0) scarfMesh.instanceColor.needsUpdate = true;
    },

    /** Shot just wide / off the bar — sharp rise, then grumbling settle. */
    onNearMiss() {
      gaspStart = lastT; gaspEnd = gaspStart + GASP_DUR;
    },

    /** Big clearance / long shot — brief 1s stir. */
    onBigKick() {
      stirStart = lastT; stirEnd = stirStart + 1.0;
    },

    /** 0..1 ambient excitement baseline. */
    setExcitement(x) {
      excitement = Math.min(1, Math.max(0, x));
    },
  };
}
