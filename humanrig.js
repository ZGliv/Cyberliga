// humanrig.js — skinned, animated human player rig for Cyberliga.
// Drop-in replacement for rig.js's buildPlayerRig(), backed by the three.js
// Soldier.glb (Mixamo skeleton, Idle/Walk/Run clips) proven in rigtest.html.
//
// Conventions (matching rig.js / the host):
//   - ~1.9 units tall, origin at the feet, wrapper group forward = local +Z
//     (the GLB faces -Z natively; an inner node is yaw-flipped PI to fix it).
//   - The HOST owns group.position, group.rotation.y (yaw), group.scale and
//     headPivot.rotation.y (ball tracking). Poses never touch those.
//   - NEW vs rig.js: rig.update(dt, speedNorm, opts) is REQUIRED every frame —
//     it drives the AnimationMixer (Idle/Walk/Run crossfade + cadence), then
//     applies whichever overlay pose was requested this frame, then locomotion
//     additives (lean/bank/arm-pump/personality), idle micro-behaviors, then
//     head look. opts is optional: { accel: -1..1, turn: -1..1 } for
//     acceleration lean and turn banking.
//   - Overlay poses are one-call-per-frame, called BEFORE update(). They write
//     rest-relative bone rotations applied AFTER the mixer (the spike proved
//     post-mixer writes win). Per-channel ease-in (~0.12s) / ease-out (~0.18s)
//     means poses blend with locomotion instead of snapping. Full-body poses
//     (kick/throw/dive/fall/getup/celebrate/...) also fade the locomotion
//     action weights to 0 so mocap doesn't fight the pose; weights restore
//     automatically when no overlay runs.
//   - poseFall/poseGetUp/poseDive/poseSlideTackle/poseKneeSlide root the body
//     to the ground by rotating an INTERNAL tilt node (child of group) and
//     offsetting its position.y — the host's group transform is never written,
//     so host yaw/lean logic is safe.
//   - rig.gaitPhase (contract C2): monotonic radians advanced from actual
//     ground speed; walk/run are scrubbed from the same master cycle so a foot
//     visually plants every PI. The host mirrors it into p.stridePhase.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const MODEL_URL = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Soldier.glb';
const TARGET_HEIGHT = 1.9;

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
function smooth(k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }
function bell(k) { return Math.sin(clamp(k, 0, 1) * Math.PI); }

// ---- shared GLTF cache ----
let _gltf = null;
let _promise = null;
let _modelScale = 1;
const _clips = {};

export function preloadHumanModel() {
  if (_promise) return _promise;
  _promise = new Promise((resolve, reject) => {
    new GLTFLoader().load(MODEL_URL, (gltf) => {
      _gltf = gltf;
      for (const c of gltf.animations) _clips[c.name] = c; // Idle, Run, TPose, Walk
      gltf.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(gltf.scene);
      _modelScale = TARGET_HEIGHT / (box.max.y - box.min.y);
      resolve(gltf);
    }, undefined, reject);
  });
  return _promise;
}

// Bones we drive with overlay poses (Mixamo-standard names, no prefix here).
const CONTROLLED = [
  'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm',
  'RightShoulder', 'RightArm', 'RightForeArm',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot',
  'RightUpLeg', 'RightLeg', 'RightFoot',
];

// module-level temps — no per-frame allocations
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _YAXIS = new THREE.Vector3(0, 1, 0);
const _gkColor = new THREE.Color(0xc8ff4d);
const _tmpColor = new THREE.Color();
const _hsl = { h: 0, s: 0, l: 0 };

// overlay blend rates (the choppiness fix): poses ease IN over ~0.12s and
// ease back OUT to locomotion over ~0.18s instead of snapping.
const BLEND_IN = 1 / 0.12;
const BLEND_OUT = 1 / 0.18;

// gait calibration: ground distance covered per full clip cycle at the
// TARGET_HEIGHT scale. Cadence = actualSpeed / stride, so foot plants match
// ground displacement instead of a hand-tuned timeScale guess (no skating).
const WALK_STRIDE = 1.6;   // m/cycle (Soldier Walk @ 1.9u)
const RUN_STRIDE = 3.8;    // m/cycle (Soldier Run @ 1.9u)
const HOST_MAX_SPEED = 7;  // hosts pass speedNorm = clamp(speed / 7, 0, 1)

// boost saturation so team identity pops after the lerp toward the base
// texture color (the old flat lerp(0.55) made pink read as washed-out red)
function saturate(color, amount) {
  color.getHSL(_hsl);
  color.setHSL(_hsl.h, clamp(_hsl.s * (1 + amount) + 0.12, 0, 1), _hsl.l);
}

// ============================================================================
// WAVE 2 — KIT / IDENTITY HELPERS (module-level, shared across all 15 rigs)
// ============================================================================
const _m = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

// ---- W11: ACES pre-compensation for hot-pink emissives ---------------------
// The host renders with ACES filmic tonemapping + UnrealBloom. Saturated
// red-magenta emissives (VOLT UTD #ff2d78) get crushed toward pure RED: the R
// channel hits the ACES shoulder first and the small B component is eaten by
// the curve + bloom, so the perceived hue collapses to red. Pre-rotating the
// hue toward magenta (h - 0.065) with a slight lightness lift (so blue survives
// the RRT) makes the PERCEIVED post-ACES color land back on hot pink.
// TARGET PERCEIVED COLOR for VOLT: hot pink #ff2d78. Cyan / gold / violet sit
// outside the [0.87, 0.99) hue band and pass through untouched.
const _emTintCache = new Map();
function emissiveTint(colorIn) {
  const key = colorIn instanceof THREE.Color ? colorIn.getHex() : new THREE.Color(colorIn).getHex();
  let c = _emTintCache.get(key);
  if (!c) {
    c = new THREE.Color(key);
    c.getHSL(_hsl);
    if (_hsl.h > 0.87 && _hsl.h < 0.99) {
      c.setHSL(Math.max(0.83, _hsl.h - 0.065), _hsl.s, Math.min(0.62, _hsl.l * 1.12));
    }
    _emTintCache.set(key, c);
  }
  return c; // shared instance — callers must clone() before mutating
}

// ---- kit palette + pattern selection ----------------------------------------
// Explicit pattern names ('plain'|'sash'|'hoops'|'halves'|'fade') are honored;
// the legacy host values ('solid'/'accent', randomized PER PLAYER) fall through
// to a deterministic per-TEAM pick from the kit hue so teammates always wear
// MATCHING kits. Unknown tags also fall through (W2: ignore unknown opts).
const PATTERN_IDS = { plain: 0, sash: 1, hoops: 2, halves: 3, fade: 4 };
const AUTO_PATTERN = [2, 1, 4, 1, 1, 4, 3, 3]; // hue octant → pattern: gold→hoops, cyan→sash, violet→fade, pink→halves

function buildKitParams({ kitColor, glowColor, isGK, pattern }) {
  const team = new THREE.Color(kitColor);
  team.getHSL(_hsl);
  const teamH = _hsl.h;
  const base = new THREE.Color();
  if (isGK) {
    // keepers read LIME at a glance (broadcast convention), pulled 15% toward
    // the team color so the two keepers in a fixture still differ
    base.setHSL(0.225, 0.95, 0.56).lerp(team, 0.15);
  } else {
    // bright jersey base — the old armor lerp left every body near-black
    base.setHSL(teamH, clamp(_hsl.s * 1.05 + 0.05, 0, 1), clamp(_hsl.l, 0.5, 0.6));
  }
  const second = new THREE.Color(0x0a0e1c).lerp(team, 0.16); // navy/charcoal pattern partner (per PORTRAITS.md kit briefs)
  const dark = new THREE.Color(0x10141f).lerp(team, 0.22);   // shorts / compression under-layers
  const sock = base.clone().multiplyScalar(0.8);
  const glowE = emissiveTint(glowColor);
  const glove = isGK ? glowE.clone() : dark.clone().multiplyScalar(0.8);
  const patId = PATTERN_IDS[pattern] ?? AUTO_PATTERN[Math.floor(clamp(teamH, 0, 0.999) * 8)];
  return { base, second, dark, sock, glove, glowE, patId, glowI: 1.55, gloveI: isGK ? 0.7 : 0 };
}

// ---- kit zone shader ---------------------------------------------------------
// Recolors the Soldier body into a real football kit. Zones + pattern are
// computed from the BIND-POSE vertex position (the raw `position` attribute,
// sampled before skinning) so the print sticks to the cloth through animation,
// independent of the GLB's UV layout. Heights are normalized by the geometry's
// own bounding box (uniforms), x is height-normalized so T-pose arms classify
// by lateral distance. The face/head zone keeps the original human texture.
const KIT_FRAG_HEAD = /* glsl */ `#include <common>
varying vec3 vClPos;
uniform vec3 uClMin; uniform vec3 uClSize;
uniform vec3 uClKitA; uniform vec3 uClKitB; uniform vec3 uClDark; uniform vec3 uClSock;
uniform vec3 uClGlove; uniform vec3 uClGlow;
uniform float uClPattern; uniform float uClGlowI; uniform float uClGloveI;
float clBand(float v, float lo, float hi) {
  return smoothstep(lo - 0.008, lo + 0.008, v) * (1.0 - smoothstep(hi - 0.008, hi + 0.008, v));
}`;

const KIT_FRAG_ALBEDO = /* glsl */ `{
  float clH = (vClPos.y - uClMin.y) / uClSize.y;
  float clX = (vClPos.x - uClMin.x - 0.5 * uClSize.x) / uClSize.y;
  float clA = abs(clX);
  if (!(clH > 0.847 && clA < 0.14)) {  // head/face keeps the human texture
    float clLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    float clShade = 0.62 + clLum * 1.05; // lifted floor: kits read BRIGHT, cloth detail survives
    vec3 clJersey;
    if (uClPattern < 0.5)      clJersey = mix(uClKitA, uClKitB, clBand(clA, 0.125, 0.158));                   // plain + side panels
    else if (uClPattern < 1.5) clJersey = mix(uClKitA, uClKitB, clBand(clX * 0.85 + clH - 0.55, 0.10, 0.22)); // diagonal sash
    else if (uClPattern < 2.5) clJersey = mix(uClKitA, uClKitB, step(0.5, fract((clH - 0.545) * 6.5)));       // hoops
    else if (uClPattern < 3.5) clJersey = mix(uClKitB, uClKitA, step(0.0, clX));                              // halves
    else                       clJersey = mix(uClKitB, uClKitA, smoothstep(0.50, 0.85, clH));                 // gradient fade
    vec3 clZone;
    if (clA > 0.44)       clZone = uClGlove;                                       // hands / GK gloves
    else if (clA > 0.295) clZone = uClDark;                                        // compression arms
    else if (clA > 0.155) clZone = clJersey;                                       // sleeves
    else if (clH > 0.545) clZone = clJersey;                                       // shirt
    else if (clH > 0.40)  clZone = uClDark;                                        // shorts (dark complement)
    else if (clH > 0.215) clZone = uClDark * 0.72;                                 // leg under-layer
    else if (clH > 0.075) clZone = mix(uClSock * 0.95, uClKitB, step(0.165, clH)); // socks + turnover band
    else                  clZone = uClDark * 0.5;                                  // boots
    diffuseColor.rgb = clZone * clShade;
  }
}`;

const KIT_FRAG_EMISSIVE = /* glsl */ `{
  float clH = (vClPos.y - uClMin.y) / uClSize.y;
  float clX = (vClPos.x - uClMin.x - 0.5 * uClSize.x) / uClSize.y;
  float clA = abs(clX);
  if (!(clH > 0.847 && clA < 0.14)) {
    float clEm = clBand(clH, 0.818, 0.842) * (1.0 - step(0.155, clA))  // collar ring
               + clBand(clA, 0.272, 0.296)                             // sleeve cuffs
               + clBand(clH, 0.038, 0.058)                             // boot stripe
               + clBand(clH, 0.398, 0.415) * 0.6;                      // shorts hem
    totalEmissiveRadiance += uClGlow * (clEm * uClGlowI + 0.045);      // accents + faint kit lift (shadow-side readability)
    totalEmissiveRadiance += uClGlow * step(0.44, clA) * uClGloveI;    // GK glove glow
  }
}`;

function applyKitShader(mat, kit, bbox) {
  const uMin = bbox.min.clone();
  const uSize = new THREE.Vector3().subVectors(bbox.max, bbox.min);
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uClMin: { value: uMin }, uClSize: { value: uSize },
      uClKitA: { value: kit.base }, uClKitB: { value: kit.second },
      uClDark: { value: kit.dark }, uClSock: { value: kit.sock },
      uClGlove: { value: kit.glove }, uClGlow: { value: kit.glowE },
      uClPattern: { value: kit.patId }, uClGlowI: { value: kit.glowI },
      uClGloveI: { value: kit.gloveI },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vClPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvClPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', KIT_FRAG_HEAD)
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + KIT_FRAG_ALBEDO)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + KIT_FRAG_EMISSIVE);
  };
  mat.needsUpdate = true;
}

// ---- jersey name/number canvas decals (W2/W3) -------------------------------
// One texture pair per (name, number, contrast) — cached so team rebuilds every
// fixture never re-rasterize. Planes are authored in METERS (the bone anchors
// un-scale the GLB) and glued to the spine so they ride torso leans.
const _jerseyTexCache = new Map();
function drawArcText(g, text, cx, cy, r, font, gap) {
  g.font = font;
  const chars = [...text];
  const widths = chars.map((ch) => g.measureText(ch).width);
  let a = -(widths.reduce((s, w) => s + w, 0) + gap * (chars.length - 1)) / 2 / r;
  for (let i = 0; i < chars.length; i++) {
    const half = widths[i] / 2 / r;
    a += half;
    g.save();
    g.translate(cx + Math.sin(a) * r, cy - Math.cos(a) * r);
    g.rotate(a);
    g.strokeText(chars[i], 0, 0);
    g.fillText(chars[i], 0, 0);
    g.restore();
    a += half + gap / r;
  }
}
function getJerseyTextures(name, number, darkText) {
  const key = name + '|' + number + '|' + (darkText ? 1 : 0);
  let entry = _jerseyTexCache.get(key);
  if (entry) return entry;
  const fill = darkText ? '#0b1020' : '#f5f9ff';
  const line = darkText ? 'rgba(245,250,255,0.92)' : 'rgba(8,12,24,0.92)'; // subtle outline = crisp at distance
  const backing = darkText ? 'rgba(255,255,255,0.16)' : 'rgba(6,10,22,0.26)';
  const hasNum = number !== null && number !== undefined;
  // back: arced name over a big number, on a soft backing panel so the print
  // stays readable over hoops/sash at broadcast distance
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = backing;
  g.beginPath(); g.roundRect(100, 44, 312, 424, 30); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  if (name) {
    g.fillStyle = fill; g.strokeStyle = line; g.lineWidth = 9;
    drawArcText(g, String(name), 256, 478, 348, '700 60px Orbitron, sans-serif', 7);
  }
  if (hasNum) {
    g.font = '900 290px Orbitron, sans-serif';
    g.fillStyle = fill; g.strokeStyle = line; g.lineWidth = 14;
    g.strokeText(String(number), 256, 330);
    g.fillText(String(number), 256, 330);
  }
  const back = new THREE.CanvasTexture(c);
  back.colorSpace = THREE.SRGBColorSpace; back.anisotropy = 4;
  // chest: small number
  let chest = null;
  if (hasNum) {
    const c2 = document.createElement('canvas');
    c2.width = 192; c2.height = 192;
    const g2 = c2.getContext('2d');
    g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.lineJoin = 'round';
    g2.font = '900 128px Orbitron, sans-serif';
    g2.fillStyle = fill; g2.strokeStyle = line; g2.lineWidth = 9;
    g2.strokeText(String(number), 96, 102);
    g2.fillText(String(number), 96, 102);
    chest = new THREE.CanvasTexture(c2);
    chest.colorSpace = THREE.SRGBColorSpace; chest.anisotropy = 4;
  }
  entry = { back, chest };
  _jerseyTexCache.set(key, entry);
  return entry;
}
let _geoBack = null, _geoChest = null, _geoCard = null;
function geoBackDecal() { return _geoBack || (_geoBack = new THREE.PlaneGeometry(0.40, 0.46)); }
function geoChestDecal() { return _geoChest || (_geoChest = new THREE.PlaneGeometry(0.14, 0.14)); }
function geoCardPlane() { return _geoCard || (_geoCard = new THREE.PlaneGeometry(0.12, 0.17)); }

// ---- persona flair accessories (W2) -----------------------------------------
// Low-poly neon head attachments, ≤~50 tris each. Geometries + materials are
// module-cached and SHARED across rigs (15 on screen); meshes are per-rig.
// Authored in METERS in a head-glued anchor whose axes match the group
// (+Z = character forward, origin ≈ eye level), so they ride head-look freely.
const _flairGeos = {};
function flairGeo(kind) {
  if (_flairGeos[kind]) return _flairGeos[kind];
  let g;
  switch (kind) {
    case 'mohawk': g = new THREE.BoxGeometry(0.026, 0.15, 0.30); break;
    case 'braid': g = new THREE.CylinderGeometry(0.015, 0.011, 0.27, 5, 1); g.translate(0, -0.135, 0); break;
    case 'tip': g = new THREE.OctahedronGeometry(0.024, 0); break;
    case 'mask': g = new THREE.BoxGeometry(0.17, 0.10, 0.05); break;
    case 'slit': g = new THREE.BoxGeometry(0.165, 0.012, 0.012); break;
    case 'beard': g = new THREE.ConeGeometry(0.062, 0.13, 5); break;
    case 'dread': g = new THREE.CylinderGeometry(0.024, 0.018, 0.25, 5, 1); g.translate(0, -0.125, 0); break;
    case 'glasses': g = new THREE.BoxGeometry(0.21, 0.05, 0.035); break;
    case 'scar': g = new THREE.BoxGeometry(0.013, 0.075, 0.013); break;
    case 'fro': g = new THREE.OctahedronGeometry(0.135, 1); break;
    case 'spike': g = new THREE.ConeGeometry(0.022, 0.085, 4); break;
  }
  _flairGeos[kind] = g;
  return g;
}
let _matHair = null, _matDarkAcc = null;
const _glowMats = new Map();
function hairMat() { return _matHair || (_matHair = new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.85 })); }
function darkAccMat() { return _matDarkAcc || (_matDarkAcc = new THREE.MeshStandardMaterial({ color: 0x10141d, roughness: 0.4, metalness: 0.5 })); }
function glowMat(color) {
  const k = color.getHex();
  let m = _glowMats.get(k);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: color.clone() }); _glowMats.set(k, m); }
  return m;
}
function addFlair(root, names, glowColor) {
  const gm = glowMat(glowColor), hm = hairMat(), dm = darkAccMat();
  const M = (kind, mat) => { const mesh = new THREE.Mesh(flairGeo(kind), mat); root.add(mesh); return mesh; };
  for (const f of names) {
    if (f === 'mohawk') {
      M('mohawk', gm).position.set(0, 0.155, -0.02); // thin glowing fin
    } else if (f === 'braids') {
      for (const [x, rz] of [[0.062, -0.3], [-0.062, 0.3], [0, 0]]) {
        const b = M('braid', hm);
        b.position.set(x, -0.005, -0.085);
        b.rotation.set(-0.3, 0, rz);
        const tp = new THREE.Mesh(flairGeo('tip'), gm); // glow tip
        tp.position.y = -0.27;
        b.add(tp);
      }
    } else if (f === 'mask') {
      M('mask', dm).position.set(0, -0.075, 0.092);   // face plate
      M('slit', gm).position.set(0, -0.052, 0.118);   // glow seam
    } else if (f === 'beard') {
      const b = M('beard', hm);
      b.position.set(0, -0.135, 0.058);
      b.rotation.x = Math.PI - 0.22; // wedge under the chin
    } else if (f === 'dreads') {
      for (const [x, z, rx, rz] of [[0.07, -0.06, -0.25, -0.35], [-0.07, -0.06, -0.25, 0.35], [0.04, -0.10, -0.4, -0.15], [-0.04, -0.10, -0.4, 0.15]]) {
        const d = M('dread', hm);
        d.position.set(x, 0.02, z);
        d.rotation.set(rx, 0, rz);
      }
    } else if (f === 'glasses') {
      M('glasses', gm).position.set(0, 0.012, 0.103); // visor bar
    } else if (f === 'scar') {
      const s = M('scar', gm);
      s.position.set(0.068, -0.028, 0.096);           // emissive cheek line
      s.rotation.z = 0.35;
    } else if (f === 'fro') {
      M('fro', hm).position.set(0, 0.10, -0.015);
    } else if (f === 'spikes') {
      for (const [x, y, z, rx, rz] of [[0, 0.17, 0.045, 0.25, 0], [0, 0.185, -0.02, 0, 0], [0, 0.165, -0.085, -0.3, 0], [0.07, 0.145, -0.02, 0, 0.45], [-0.07, 0.145, -0.02, 0, -0.45]]) {
        const s = M('spike', gm);
        s.position.set(x, y, z);
        s.rotation.set(rx, 0, rz);
      }
    }
    // unknown flair tags are ignored (W2)
  }
}

// W2 additive opts: jerseyName (string), jerseyNumber (number), flair (string[]
// from: mohawk, braids, mask, beard, dreads, glasses, scar, fro, spikes).
// pattern now also accepts 'plain'|'sash'|'hoops'|'halves'|'fade' (legacy
// 'solid'/'accent' map to a deterministic per-team pattern). Unknown opts/tags
// are ignored.
export function buildPlayerRig({ kitColor, glowColor, skinTone, hairColor, isGK = false, headband = false, captain = false, pattern = 'solid', jerseyName = '', jerseyNumber = null, flair = null }) {
  if (!_gltf) throw new Error('humanrig: call preloadHumanModel() and await it before buildPlayerRig()');

  // group (host-owned transform) > tilt (pose-owned pitch/roll/y) > inner (axis fix + scale) > model
  const group = new THREE.Group();
  const tilt = new THREE.Group();
  const inner = new THREE.Group();
  inner.rotation.y = Math.PI;            // GLB faces -Z; game forward is +Z
  inner.scale.setScalar(_modelScale);    // normalize to ~1.9 units, origin already at feet
  group.add(tilt);
  tilt.add(inner);

  const model = SkeletonUtils.clone(_gltf.scene);
  inner.add(model);

  // ---- kit: broadcast jerseys (Wave 2) ----
  // A body-space zone shader turns the old dark armor into a bright team kit:
  // patterned jersey up top, dark-complement shorts, team socks, and emissive
  // collar / cuff / boot accents at bloom-friendly intensity. The face keeps
  // the human texture. See KIT_FRAG_* at module level.
  const kit = buildKitParams({ kitColor, glowColor, isGK, pattern });
  const glowE = kit.glowE; // ACES-compensated emissive accent color (W11)
  const ownedMaterials = [];
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false;           // skinned bounds lag the pose; cheap insurance for 15 rigs
      o.material = o.material.clone();
      ownedMaterials.push(o.material);
      const name = (o.name + '|' + (o.material.name || '')).toLowerCase();
      const isVisor = name.includes('visor') || name.includes('glass') || name.includes('helmet');
      if (isVisor) {
        // visor reads as the glow color, hot enough to bloom a little
        if (o.material.color) { o.material.color.lerp(glowE, 0.8); saturate(o.material.color, 0.6); }
        if (o.material.emissive) { o.material.emissive.copy(glowE); o.material.emissiveIntensity = 0.85; }
      } else {
        // white base keeps the texture's luminance (cloth detail) for the kit
        // shader, which recolors every zone except the head/face
        if (o.material.color) o.material.color.setRGB(1, 1, 1);
        if (o.material.emissive) o.material.emissive.setRGB(0, 0, 0);
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        applyKitShader(o.material, kit, o.geometry.boundingBox);
      }
    }
  });
  // skinTone/hairColor: the GLB is a single textured mesh, so per-part skin/hair
  // recolor isn't possible without a texture pipeline — accepted for API parity.
  void skinTone; void hairColor;

  // ---- bone lookup ----
  const bones = {};
  model.traverse((o) => { if (o.isBone) bones[o.name.replace(/^mixamorig/, '')] = o; });

  // ---- bone-glued anchors (W3) ----
  // Object3D nodes parented INTO the skeleton, oriented to GROUP axes
  // (+Z = character forward) and scale-compensated so children are authored in
  // world METERS. Built at bind pose, before the mixer ever runs, so the
  // inverse-matrix math is exact; afterwards they ride their bone.
  group.updateMatrixWorld(true);
  function worldAnchor(bone, gx, gy, gz, faceBack) {
    const a = new THREE.Object3D();
    bone.add(a);
    _m.copy(bone.matrixWorld).invert();
    a.position.set(gx, gy, gz).applyMatrix4(_m);
    bone.getWorldQuaternion(_q).invert();
    a.quaternion.copy(_q);
    if (faceBack) { _q2.setFromAxisAngle(_YAXIS, Math.PI); a.quaternion.multiply(_q2); }
    bone.getWorldScale(_v);
    a.scale.set(1 / _v.x, 1 / _v.y, 1 / _v.z);
    return a;
  }
  const chestBone = bones.Spine2 || bones.Spine1 || bones.Spine;
  const backBone = bones.Spine1 || bones.Spine2 || bones.Spine;
  const chestAnchor = chestBone ? worldAnchor(chestBone, 0, 1.345, 0.15) : null;        // +Z faces out the chest
  const backAnchor = backBone ? worldAnchor(backBone, 0, 1.28, -0.155, true) : null;    // +Z faces out the BACK

  // ---- W2/W3: rig-rendered jersey name + number (canvas decals on the spine) ----
  const rendersJersey = !!backAnchor && !!((jerseyName && String(jerseyName).length) || (jerseyNumber !== null && jerseyNumber !== undefined));
  if (rendersJersey) {
    const baseLum = kit.base.r * 0.299 + kit.base.g * 0.587 + kit.base.b * 0.114;
    const tex = getJerseyTextures(jerseyName ? String(jerseyName) : '', jerseyNumber, baseLum > 0.5);
    const backM = new THREE.Mesh(geoBackDecal(),
      new THREE.MeshBasicMaterial({ map: tex.back, transparent: true, depthWrite: false }));
    backM.position.set(0, 0.01, 0.035);
    backM.renderOrder = 996;
    backAnchor.add(backM);
    ownedMaterials.push(backM.material);
    if (chestAnchor && tex.chest) {
      const chestM = new THREE.Mesh(geoChestDecal(),
        new THREE.MeshBasicMaterial({ map: tex.chest, transparent: true, depthWrite: false }));
      chestM.position.set(0.094, 0.045, 0.03); // left-breast number
      chestM.renderOrder = 996;
      chestAnchor.add(chestM);
      ownedMaterials.push(chestM.material);
    }
  }

  // ---- W2: persona flair — low-poly neon accessories glued to the head ----
  // (children of the Head bone, so head-look and every pose carry them for free)
  const flairRoot = bones.Head ? worldAnchor(bones.Head, 0, 1.77, 0.02) : null;
  if (flairRoot && Array.isArray(flair) && flair.length) addFlair(flairRoot, flair, glowE);

  // referee card: anchor lives just past the right hand's fingers; the glowing
  // card plane itself is created lazily on the first poseShowCard call
  let cardAnchor = null, cardMesh = null, cardHold = 0, cardReq = false, cardRed = false;
  if (bones.RightHand && bones.RightForeArm) {
    bones.RightHand.getWorldPosition(_v);
    bones.RightForeArm.getWorldPosition(_v2);
    _v2.subVectors(_v, _v2).normalize().multiplyScalar(0.10).add(_v);
    cardAnchor = worldAnchor(bones.RightHand, _v2.x, _v2.y, _v2.z);
  }

  // W3 host-convention bone anchors (rig-axis-aligned, NOT pre-flipped — the
  // host rotates its own back plane PI, matching kayrig's anchor convention).
  // Only consulted by the host when rendersJersey is false; exposed always so
  // the contract matches kayrig's.
  const hostBackAnchor = backBone ? worldAnchor(backBone, 0, 1.28, -0.155) : null;

  // optional headband: glow torus parented to the head bone (bone space = raw model units)
  if (headband && bones.Head) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(11, 1.2, 5, 14),
      new THREE.MeshBasicMaterial({ color: glowE }));
    band.rotation.x = Math.PI / 2 - 0.25;
    band.position.y = 9;
    bones.Head.add(band);
    ownedMaterials.push(band.material);
  }

  // captain armband: glowing ring around the left upper arm (W11-compensated)
  if (captain && bones.LeftArm) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(5.4, 1.4, 5, 12),
      new THREE.MeshBasicMaterial({ color: glowE }));
    band.rotation.x = Math.PI / 2;       // ring lies around the bone's long (y) axis
    band.position.y = 12;                // partway down the upper arm
    bones.LeftArm.add(band);
    ownedMaterials.push(band.material);
  }

  // overlay channels: rest-relative euler targets, armed per-frame by pose calls.
  // w is the per-channel blend weight (eased in/out); q caches the last target
  // quaternion so a pose that stops being called fades out from where it was.
  const channels = {};
  for (const name of CONTROLLED) {
    const bone = bones[name];
    if (!bone) continue;
    channels[name] = { bone, rest: bone.quaternion.clone(), e: new THREE.Euler(), q: new THREE.Quaternion(), w: 0, on: false };
  }
  function set(name, x, y, z) {
    const ch = channels[name];
    if (!ch) return;
    ch.e.set(x, y, z);
    ch.on = true;
  }
  // additive rotation applied directly on top of whatever the bone has now
  // (mixer result + overlay). Used for locomotion additives + idle behaviors.
  function add(name, x, y, z) {
    const ch = channels[name];
    if (!ch) return;
    _e.set(x, y, z);
    _q.setFromEuler(_e);
    ch.bone.quaternion.multiply(_q);
  }

  // ---- locomotion mixer ----
  const mixer = new THREE.AnimationMixer(model);
  const idleAct = mixer.clipAction(_clips.Idle);
  const walkAct = mixer.clipAction(_clips.Walk);
  const runAct = mixer.clipAction(_clips.Run);
  for (const a of [idleAct, walkAct, runAct]) { a.enabled = true; a.setEffectiveWeight(0); a.play(); }
  idleAct.setEffectiveWeight(1);
  // walk/run are scrubbed in LOCKSTEP by the master gait clock in update()
  // (timeScale 0 so the mixer never advances them independently — the old
  // per-clip random offsets left walk and run mutually de-phased, and the
  // s~0.4 crossfade band averaged two out-of-phase strides into a scissoring
  // double-step). Idle free-runs at its natural cadence (timeScale 1).
  walkAct.timeScale = 0; runAct.timeScale = 0;
  idleAct.time = Math.random() * _clips.Idle.duration; // desync idles across rigs
  let gaitCyc = Math.random(); // master gait cycle; random start = per-rig stride desync

  // ---- per-rig personality (seeded at build, constant for the rig's life) ----
  const seed = Math.random() * 1000;
  const persLean = (Math.sin(seed * 12.9898) * 0.5) * 0.12;       // upright vs hunched runner
  const persHead = (Math.sin(seed * 78.233) * 0.5) * 0.10;        // head carriage
  const persArm = 0.5 + Math.abs(Math.sin(seed * 39.425)) * 0.5;  // arm-pump intensity 0.5..1
  const persRoll = (Math.sin(seed * 4.1414) * 0.5) * 0.05;        // slight shoulder roll
  const idleCyc = 4.5 + (seed % 3);                               // idle behavior cycle length
  let idleClock = seed % 10;                                      // offset so rigs never sync
  let idleW = 0;                                                  // eased gate into idle behaviors
  let accelS = 0, turnS = 0;                                      // smoothed additive inputs

  // ---- head look pivot (host writes rotation.y; update() wires it to Neck/Head) ----
  const headPivot = new THREE.Object3D();
  group.add(headPivot);

  // overlay frame state
  let overlayThisFrame = false; // a pose was called since last update()
  let overlayFull = false;      // this frame's pose wants locomotion faded out
  let locoScale = 1;            // smoothed 0..1 multiplier on action weights
  let overlayW = 0;             // smoothed "any overlay active" 0..1 (gates additives)
  // tilt targets (poses write these absolutely each frame; update eases toward
  // them — and back to zero when idle — so ground-rooted poses never snap)
  let tiltX = 0, tiltZ = 0, tiltY = 0, tiltActive = false;

  function markOverlay(full) { overlayThisFrame = true; if (full) overlayFull = true; }
  function setTilt(rx, rz, y) { tiltX = rx; tiltZ = rz; tiltY = y; tiltActive = true; }

  // =====================================================================
  // SIGN CONVENTIONS — measured from the GLB's rest skeleton (world-axis
  // probe of every controlled bone). The rest pose is the T-POSE, so every
  // arm overlay must include a "lower the arm" component.
  //   - The model natively faces -Z; group +X (game space) = the model's
  //     LEFT side. side/legIndex args therefore map: +1 -> 'Left' bones.
  //   - UpLeg/Leg rotation.x: POSITIVE = backward, NEGATIVE = forward swing.
  //     Leg (knee) POSITIVE = flexion. UpLeg z: Left -out / Right +out.
  //   - Arm euler (x,y,z) applies z first (raise/lower: +1.35 = hanging,
  //     -1.45 = overhead), then y (fwd/back swing about the body's L-R axis:
  //     Left -fwd / Right +fwd), then x (swivel about world up).
  //   - ForeArm flexion: Left NEGATIVE x / Right POSITIVE x.
  //   - Spine/Neck: +x lean forward, +y turn toward group +X, -z lean
  //     toward group +X.
  // =====================================================================
  const ARM_DOWN = 1.35; // z that brings a T-pose arm to hang at the side
  function setArm(side, fwd, down, swivel) {
    set(side + 'Arm', swivel || 0, (side === 'Left' ? -1 : 1) * fwd, down);
  }
  function setElbow(side, flex) {
    set(side + 'ForeArm', (side === 'Left' ? -1 : 1) * flex, 0, 0);
  }
  function setLeg(side, fwd, flex, out) {
    set(side + 'UpLeg', -fwd, 0, (side === 'Left' ? -1 : 1) * (out || 0));
    set(side + 'Leg', clamp(flex, 0, 2.4), 0, 0);
  }
  function setSpine(fwd, turn, lean) { // turn/lean positive = toward group +X
    set('Spine', fwd, turn, -(lean || 0));
  }

  function poseKick(k, legIndex, amp) {
    markOverlay(true);
    k = clamp(k, 0, 1); amp = clamp(amp, 0, 1);
    const S = legIndex ? 'Left' : 'Right'; // striking side (legIndex 1 = group +X = model Left)
    const P = legIndex ? 'Right' : 'Left'; // plant side
    let hip, knee; // hip in raw UpLeg.x terms: positive = backswing
    // CONTRACT C3 (frozen): visual ball contact is at k = 0.45 — the hip
    // crosses vertical mid-drive there (phases tuned so the swing's zero
    // crossing lands on 0.45 across amp). The host fires the ball impulse at
    // exactly 0.45 * (windup + follow). Do NOT retime these boundaries.
    if (k < 0.36) {           // backswing: hip back, heel folds to glute
      const u = smooth(k / 0.36);
      hip = lerp(-0.1, 0.9 * (0.5 + 0.5 * amp), u);
      knee = lerp(0.2, 1.9, u);
    } else if (k < 0.58) {    // drive + snap — foot meets ball at k=0.45
      const u = (k - 0.36) / 0.22;
      hip = lerp(0.9 * (0.5 + 0.5 * amp), -(0.9 + 0.5 * amp), smooth(u));
      knee = lerp(1.9, 0.1, u * u);
    } else {                  // follow-through carries high
      const u = smooth((k - 0.58) / 0.42);
      hip = lerp(-(0.9 + 0.5 * amp), -(1.15 + 0.35 * amp), u);
      knee = lerp(0.1, 0.45, u);
    }
    set(S + 'UpLeg', hip, 0, 0);
    set(S + 'Leg', knee, 0, 0);
    set(S + 'Foot', 0.4, 0, 0);   // toes pointed through the ball
    setLeg(P, -0.15, 0.35, 0);    // plant leg braced
    // arms counterbalance: plant-side arm swings forward, strike-side back+out
    setArm(P, -hip * 0.5, ARM_DOWN - 0.25);
    setElbow(P, 0.6);
    setArm(S, hip * 0.4, ARM_DOWN - 0.5);
    setElbow(S, 0.4);
    setSpine(-0.12 * amp * bell(k), (legIndex ? 1 : -1) * 0.18 * bell(k), 0);
    setTilt(0, 0, -0.04 * bell(k));
  }

  function poseThrowIn(k) {
    markOverlay(true);
    k = clamp(k, 0, 1);
    let raise, fwd, elbow, arch;
    if (k < 0.5) {            // raise the ball up and behind the head
      const u = smooth(k / 0.5);
      raise = lerp(ARM_DOWN, -1.45, u);  // hanging -> overhead
      fwd = lerp(0, -0.6, u);            // drifts behind the head
      elbow = lerp(0.4, 1.6, u);
      arch = lerp(0, -0.28, u);          // back arch
    } else if (k < 0.65) {    // whip forward, release at ~0.65
      const u = (k - 0.5) / 0.15;
      raise = lerp(-1.45, -1.1, smooth(u));
      fwd = lerp(-0.6, 0.9, smooth(u));
      elbow = lerp(1.6, 0.15, u * u);
      arch = lerp(-0.28, 0.22, u);
    } else {                  // follow through, arms settle forward-down
      const u = smooth((k - 0.65) / 0.35);
      raise = lerp(-1.1, -0.3, u);
      fwd = lerp(0.9, 0.6, u);
      elbow = lerp(0.15, 0.35, u);
      arch = lerp(0.22, 0.12, u);
    }
    setArm('Left', fwd, raise); setArm('Right', fwd, raise);
    setElbow('Left', elbow); setElbow('Right', elbow);
    setSpine(arch, 0, 0);
    set('Spine1', arch * 0.6, 0, 0);
    // staggered stance for power
    setLeg('Left', 0.25, 0.3, 0);
    setLeg('Right', -0.25, 0.35, 0);
  }

  // GK dive toward local ±X. Roots via the internal tilt node (NOT group).
  // Optional targetY = impact height in metres (the predicted glove-contact
  // point): low balls keep the dive flat along the turf, top-corner balls
  // launch the whole body airborne. Legacy 2-arg calls (and replayed clips
  // with b=0) get the original mid-height arc.
  function poseDive(side, k, targetY) {
    markOverlay(true);
    k = clamp(k, 0, 1);
    const s = side >= 0 ? 1 : -1;
    const hN = (targetY !== undefined && targetY !== null && targetY > 0)
      ? clamp((targetY - 0.3) / 2.4, 0, 1) : 0.42;
    const u = smooth(k);
    const launch = bell(clamp(k / 0.85, 0, 1));          // airborne arc — lands by k=0.85
    const ground = smooth(clamp((k - 0.55) / 0.45, 0, 1)); // settling onto the turf
    const y = launch * (0.10 + 0.85 * hN) - ground * 0.24;
    // roll to horizontal; a slight back-arch on the launch makes top-corner
    // saves read as a LEAP, while ground saves collapse sideways fast
    setTilt(-0.18 * hN * launch, -s * u * (Math.PI / 2 - 0.10 - 0.12 * hN), y);
    // lead arm (dive side) spears at the impact point, trail arm follows across
    const L = s > 0 ? 'Left' : 'Right', T = s > 0 ? 'Right' : 'Left';
    const fwdBias = lerp(0.35, 0.05, hN); // low balls sit in FRONT of the falling body
    setArm(L, fwdBias, lerp(ARM_DOWN * 0.55, lerp(-1.05, -1.5, hN), u));
    setArm(T, fwdBias * 0.6, lerp(ARM_DOWN * 0.55, lerp(-0.8, -1.35, hN), u));
    // arms straighten into the stretch, then fold under the chest to push up
    const land = k > 0.84 ? smooth((k - 0.84) / 0.16) : 0;
    setElbow(L, lerp(0.85, 0.04, u) + land * 0.9);
    setElbow(T, lerp(0.85, 0.14, u) + land * 0.9);
    // legs: near leg drives off then extends with pointed toes; far leg
    // scissors up on high dives, trails bent for the ground slide
    const N = s > 0 ? 'Left' : 'Right', F = s > 0 ? 'Right' : 'Left';
    setLeg(N, lerp(0.5, 0.1, u), lerp(1.25, 0.15, u), 0);
    setLeg(F, lerp(-0.2, -0.3 - 0.25 * hN, u), lerp(0.45, 1.0 - 0.45 * hN, u), 0.08);
    set(N + 'Foot', 0.35 * u, 0, 0); // toes pointed through the stretch
    setSpine(lerp(0.32, 0.02, u), 0, s * (0.12 + 0.08 * hN) * u);
  }

  // poseFall pitches the tilt node face-down about the feet origin.
  function poseFall(k) {
    markOverlay(true);
    const u = smooth(clamp(k, 0, 1));
    setTilt(lerp(0, Math.PI / 2 - 0.1, u), 0, lerp(0, 0.12, u));
    // arms sprawl forward-out (above the head once prone)
    setArm('Left', 1.4 * u, lerp(ARM_DOWN, 0.4, u));
    setArm('Right', 1.1 * u, lerp(ARM_DOWN, 0.2, u));
    setElbow('Left', 0.4 * u); setElbow('Right', 0.7 * u);
    setLeg('Left', 0.35 * u, 0.5 * u, 0.1 * u);
    setLeg('Right', -0.2 * u, 0.25 * u, 0.1 * u);
    set('Neck', -0.4 * u, 0, 0); // face out of the grass
  }

  function poseGetUp(k) {
    markOverlay(true);
    const u = smooth(clamp(k, 0, 1));
    const push = bell(u);
    setTilt(lerp(Math.PI / 2 - 0.1, 0, u), 0, lerp(0.12, 0, u));
    // arms push off the turf hardest mid-rise
    setArm('Left', lerp(1.4, 0, u) + push * 0.2, lerp(0.4, ARM_DOWN, u));
    setArm('Right', lerp(1.1, 0, u) + push * 0.2, lerp(0.2, ARM_DOWN, u));
    setElbow('Left', push * 1.2 + 0.2); setElbow('Right', push * 1.2 + 0.2);
    // one knee tucks under to push up, then both straighten
    setLeg('Left', push * 0.9, push * 1.4 + 0.1, 0);
    setLeg('Right', push * 0.4, push * 0.8 + 0.1, 0);
    setSpine(push * 0.5, 0, 0);
    set('Neck', lerp(-0.4, 0, u), 0, 0);
  }

  function poseCelebrate(t, variant) {
    markOverlay(true);
    const w = Math.sin(t * 8);
    if (variant === 0) {        // arms-up jumping
      setArm('Left', w * 0.15, -1.4); setArm('Right', -w * 0.15, -1.4);
      setElbow('Left', 0.2); setElbow('Right', 0.2);
      const hop = Math.abs(Math.sin(t * 7));
      setTilt(0, 0, hop * 0.3);
      setLeg('Left', hop * 0.3, hop * 0.8, 0);
      setLeg('Right', hop * 0.3, hop * 0.8, 0);
      setSpine(-0.1, 0, 0);
    } else if (variant === 1) { // fist pump — sharp arm yank + a hop on each pump
      const pump = Math.max(0, w);
      setArm('Right', 0.5 + pump * 0.5, ARM_DOWN - 1.0 - pump * 0.4);
      setElbow('Right', 1.8);
      setArm('Left', -0.2, ARM_DOWN); setElbow('Left', 0.4);
      setSpine(0.12 + pump * 0.1, pump * 0.2, 0);
      setTilt(0, 0, pump * 0.07);   // the pump lifts him onto his toes
      setLeg('Left', 0.15, 0.3 + pump * 0.15, 0);
      setLeg('Right', -0.1, 0.2, 0);
    } else if (variant === 3) { // badge-tap + point to the crowd
      // left hand taps the chest badge, right arm sweeps a point across the stands
      setArm('Left', 0.55, ARM_DOWN - 0.75);
      setElbow('Left', 2.1);
      const sweep = Math.sin(t * 1.6) * 0.7;          // slow pan across the crowd
      setArm('Right', 0.85, ARM_DOWN - 1.35, sweep);
      setElbow('Right', 0.1);
      setSpine(-0.08, sweep * 0.25, 0);
      set('Neck', -0.12, sweep * 0.35, 0);            // eyes follow the point
      setLeg('Left', 0.12, 0.25, 0.05);
      setLeg('Right', -0.08, 0.2, 0.05);
    } else if (variant === 4) { // arms-out airplane spin — host owns the yaw spin
      setArm('Left', 0, -0.05); setArm('Right', 0, -0.05);  // wings level at the T
      setElbow('Left', 0.05); setElbow('Right', 0.05);
      const bank = Math.sin(t * 2.2) * 0.32;          // bank the torso into the turn
      setSpine(0.35, 0, bank);
      set('Spine1', 0.1, 0, bank * 0.5);
      set('Neck', -0.3, 0, -bank * 0.4);              // head stays level-ish
      setTilt(0, bank * 0.18, 0);
      setLeg('Left', 0.18 - bank * 0.1, 0.35, 0);
      setLeg('Right', 0.18 + bank * 0.1, 0.35, 0);
    } else {                    // variant 2: double-fist "COME ON!" flex at the crowd
      const pump = Math.max(0, Math.sin(t * 6));    // rhythmic pull-downs
      setArm('Left', 0.4, ARM_DOWN - 1.0 - pump * 0.3);
      setArm('Right', 0.4, ARM_DOWN - 1.0 - pump * 0.3);
      setElbow('Left', 1.5 + pump * 0.5); setElbow('Right', 1.5 + pump * 0.5);
      setSpine(0.2 + pump * 0.12, 0, Math.sin(t * 3) * 0.06); // crunch into each pump
      set('Neck', -0.3, 0, 0);                      // roaring up at the stands
      setLeg('Left', 0.2, 0.4, 0.08);
      setLeg('Right', -0.12, 0.3, 0.08);
    }
  }

  function poseSkill(move, k, side) {
    markOverlay(false); // partial: locomotion keeps subtle life in untouched bones
    k = clamp(k, 0, 1);
    const s = side >= 0 ? 1 : -1;
    const A = s > 0 ? 'Left' : 'Right';  // active foot (group +X = model Left)
    const B = s > 0 ? 'Right' : 'Left';
    if (move === 'stepover') {
      const c = k * Math.PI * 2;
      setLeg(A, 0.55 + Math.sin(c) * 0.5, 0.9 + Math.max(0, Math.sin(c)) * 0.5, Math.cos(c) * 0.5);
      setLeg(B, -0.1, 0.3, 0);
      setSpine(0.15, s * Math.sin(c) * 0.3, 0);
      setArm('Left', 0.2, ARM_DOWN - 0.35); setArm('Right', -0.2, ARM_DOWN - 0.35);
      setElbow('Left', 0.6); setElbow('Right', 0.6);
    } else if (move === 'bodyfeint') {
      const drop = k < 0.5 ? smooth(k / 0.5) : smooth(1 - (k - 0.5) / 0.5);
      const dir = k < 0.5 ? s : -s;
      setSpine(0.18, dir * drop * 0.35, dir * drop * 0.5);
      setLeg(A, 0.1, 0.5 * drop + 0.15, drop * 0.3);   // wide toward the drop
      setLeg(B, 0.1, 0.3, -drop * 0.15);
      setArm('Left', 0, ARM_DOWN - 0.4); setArm('Right', 0, ARM_DOWN - 0.4);
      setElbow('Left', 0.6); setElbow('Right', 0.6);
    } else if (move === 'dragback') {
      const reach = k < 0.35 ? smooth(k / 0.35) : 1;
      const pull = k < 0.35 ? 0 : smooth((k - 0.35) / 0.65);
      setLeg(A, lerp(0.85 * reach, -0.5, pull), lerp(0.25, 1.1, pull), 0);
      set(A + 'Foot', 0.5 * reach * (1 - pull), 0, 0); // toes down, sole on the ball
      setLeg(B, -0.1, 0.35, 0);
      setSpine(0.1 + pull * 0.15, 0, 0);
      setArm('Left', 0, ARM_DOWN - 0.3); setArm('Right', 0, ARM_DOWN - 0.3);
      setElbow('Left', 0.7); setElbow('Right', 0.7);
    } else { // roulette — host owns the yaw spin; we sell the crouched shape
      const c = bell(k);
      setSpine(0.22 * c, 0, 0);
      setArm('Left', 0, lerp(ARM_DOWN, 0.25, c));      // arms wide for balance
      setArm('Right', 0, lerp(ARM_DOWN, 0.25, c));
      setElbow('Left', 0.4); setElbow('Right', 0.4);
      // legs hand their roles over across k 0.45-0.55 — the old hard swap at
      // k=0.5 jumped hip targets ~1 rad in one frame (the channel ease only
      // smooths WEIGHT, and mid-pose ch.w is already 1)
      const swap = smooth((k - 0.45) / 0.1);
      const phA = smooth(k / 0.5), phB = smooth((k - 0.5) / 0.5);
      setLeg(A, lerp(lerp(0.6, -0.4, phA), -0.1, swap), lerp(0.5 + phA * 0.4, 0.35, swap), 0);
      setLeg(B, lerp(-0.1, lerp(0.6, -0.4, phB), swap), lerp(0.35, 0.5 + phB * 0.4, swap), 0);
      set('Neck', 0.15 * c, 0, 0); // eyes down on the ball
    }
  }

  function poseArgue(t) {
    markOverlay(false);
    const cyc = Math.sin(t * 4);                  // repeating "are you serious?!"
    const fling = 0.5 + Math.max(0, cyc) * 0.5;   // arms fling out wide, palms up
    setArm('Left', 0.35 * fling, ARM_DOWN - 0.6 - fling * 0.5);
    setArm('Right', 0.35 * fling, ARM_DOWN - 0.6 - fling * 0.5);
    setElbow('Left', 0.6 - fling * 0.35); setElbow('Right', 0.6 - fling * 0.35);
    setSpine(0.22, 0, 0);                         // lean into the ref
    set('Neck', -0.15, Math.sin(t * 5) * 0.25, 0); // incredulous head shake
    setLeg('Left', 0.05, 0.15, 0.08);
    setLeg('Right', 0.05, 0.15, 0.08);
  }

  function poseShield(k, side) {
    markOverlay(false);
    k = clamp(k, 0, 1);
    const s = side >= 0 ? 1 : -1;
    const u = smooth(k);
    const A = s > 0 ? 'Left' : 'Right'; // arm toward the defender (group +X = Left)
    const O = s > 0 ? 'Right' : 'Left';
    setArm(A, -0.3, ARM_DOWN - (0.9 + 0.4 * u)); // out and slightly back, bracing
    setElbow(A, 0.5);
    setArm(O, 0.3, ARM_DOWN - 0.25);
    setElbow(O, 0.7);
    setSpine(0.22, s * 0.45 * u, 0);
    // wide low base; drop the tilt so the bent legs still reach the turf
    setLeg('Left', 0.15, 0.55 * u + 0.15, 0.28 * u);
    setLeg('Right', 0.15, 0.55 * u + 0.15, 0.28 * u);
    setTilt(0, 0, -0.10 * u);
  }

  // ---- NEW POSES (variety pass) ------------------------------------------

  // Slide tackle toward forward travel, dropping onto one hip (side: +1 left hip).
  function poseSlideTackle(k, side) {
    markOverlay(true);
    k = clamp(k, 0, 1);
    const s = side >= 0 ? 1 : -1;
    const u = smooth(Math.min(1, k / 0.35));      // drop happens fast, then we slide
    const rise = k > 0.8 ? smooth((k - 0.8) / 0.2) * 0.3 : 0; // slight recover at the end
    const L = s > 0 ? 'Left' : 'Right';           // lead (sliding) leg
    const T = s > 0 ? 'Right' : 'Left';           // trail leg, folded under
    // drop to the hip: roll toward the lead side, lean back, sink to the turf
    setTilt(lerp(0, -0.4, u) + rise * 0.2, s * lerp(0, 0.5, u) * (1 - rise * 0.4), lerp(0, -0.34, u) + rise * 0.15);
    setLeg(L, lerp(0.2, 1.05, u), lerp(0.6, 0.05, u), 0.1 * u);   // lead leg shoots through the ball
    set(L + 'Foot', -0.3 * u, 0, 0);                              // toes up, studs showing (cleanly!)
    setLeg(T, lerp(-0.1, -0.5, u), lerp(0.4, 1.9, u), 0.15 * u);  // trail leg folds under
    // arms out and back for balance, lead-side arm planted toward the turf
    setArm(L, -0.4 * u, lerp(ARM_DOWN, 0.45, u));
    setElbow(L, 0.25);
    setArm(T, 0.3 * u, lerp(ARM_DOWN, 0.55, u));
    setElbow(T, 0.5);
    setSpine(0.18 * u, s * 0.25 * u, -s * 0.2 * u);
    set('Neck', -0.25 * u, 0, 0); // eyes on the ball
  }

  // Header: crouch-load (0-0.3), jump + back arch (0.3-0.6), head snap ~0.65, land.
  function poseHeader(k) {
    markOverlay(true);
    k = clamp(k, 0, 1);
    let crouch = 0, air = 0, arch = 0, snap = 0;
    if (k < 0.3) {            // load
      crouch = smooth(k / 0.3);
    } else if (k < 0.6) {     // leap with back arch
      const u = smooth((k - 0.3) / 0.3);
      crouch = 1 - u;
      air = u;
      arch = u;
    } else if (k < 0.75) {    // head snaps forward through the ball at ~0.65
      const u = (k - 0.6) / 0.15;
      air = 1 - smooth(u) * 0.4;
      arch = lerp(1, -0.6, smooth(u));
      snap = smooth(u);
    } else {                  // land + absorb
      const u = smooth((k - 0.75) / 0.25);
      air = lerp(0.6, 0, u);
      arch = lerp(-0.6, 0, u);
      snap = 1 - u;
      crouch = bell(u) * 0.5;
    }
    setTilt(0, 0, air * 0.42 - crouch * 0.16);
    setSpine(-0.22 * arch + crouch * 0.3 + snap * 0.18, 0, 0);
    set('Spine1', -0.12 * arch, 0, 0);
    set('Neck', -0.3 * arch + snap * 0.55, 0, 0);  // the snap lives in the neck
    // arms: swing down-back on the load, up for lift, pull back at contact
    setArm('Left', -0.35 * crouch - 0.45 * arch + snap * 0.2, ARM_DOWN - 0.5 - air * 0.55);
    setArm('Right', -0.35 * crouch - 0.45 * arch + snap * 0.2, ARM_DOWN - 0.5 - air * 0.55);
    setElbow('Left', 0.7); setElbow('Right', 0.7);
    setLeg('Left', crouch * 0.25 - air * 0.1, crouch * 0.9 + air * 0.55, 0);
    setLeg('Right', crouch * 0.25 + air * 0.15, crouch * 0.9 + air * 0.75, 0);
  }

  // Defensive jockey: low side-on shuffle facing the attacker. t in seconds; side ±1.
  function poseJockey(t, side) {
    markOverlay(false); // partial: locomotion keeps a little life underneath
    const s = side >= 0 ? 1 : -1;
    const sh = Math.sin(t * 6);                   // quick shuffle bounce
    setSpine(0.28, s * 0.4, sh * 0.04);
    setArm('Left', 0.15, ARM_DOWN - 0.95 + sh * 0.05);   // arms wide, palms shown
    setArm('Right', 0.15, ARM_DOWN - 0.95 - sh * 0.05);
    setElbow('Left', 0.45); setElbow('Right', 0.45);
    setLeg('Left', 0.1 + sh * 0.06, 0.55, 0.3);   // wide low base
    setLeg('Right', 0.1 - sh * 0.06, 0.55, 0.3);
    setTilt(0, 0, -0.12 + Math.abs(sh) * 0.02);   // sunk into the stance
    set('Neck', 0.1, -s * 0.2, 0);                // eyes locked on the ball
  }

  // Keeper set/ready stance: wide coiled base, hands live in front of the
  // knees, weight bobbing on the balls of the feet with a slow L/R shift —
  // a keeper who looks loaded to spring, never a statue. t in seconds.
  function poseGKSet(t) {
    markOverlay(true);
    const b = Math.abs(Math.sin(t * 3.4));        // quick weight bounce on the toes
    const sway = Math.sin(t * 1.5);               // slow side-to-side weight shift
    setSpine(0.40 + b * 0.03, sway * 0.03, sway * 0.05);
    // arms ready: hands forward of the knees, palms facing the shot
    setArm('Left', 0.62, ARM_DOWN - 0.70 + b * 0.03 - sway * 0.03, 0.12);
    setArm('Right', 0.62, ARM_DOWN - 0.70 + b * 0.03 + sway * 0.03, -0.12);
    setElbow('Left', 0.95); setElbow('Right', 0.95);
    // wide low base, knees soft, one leg loading a touch more as the weight shifts
    setLeg('Left', 0.15, 0.74 + b * 0.06 + sway * 0.05, 0.32);
    setLeg('Right', 0.15, 0.74 + b * 0.06 - sway * 0.05, 0.32);
    setTilt(0, sway * 0.015, -0.19 - b * 0.02);
    set('Neck', 0.15, 0, 0);                      // chin tucked, eyes up the pitch
  }

  // Keeper catch: W-shaped hands snap into the ball line, then it's gathered
  // and CLUTCHED to the chest — elbows squeezed in, shoulders curled around
  // it, chin clamped down. k=1 (the host's hold phase) is the full clutch.
  function poseGKCatch(k) {
    markOverlay(true);
    k = clamp(k, 0, 1);
    const rise = smooth(Math.min(1, k / 0.4));    // hands attack the ball line
    const hug = k > 0.5 ? smooth((k - 0.5) / 0.35) : 0; // gather + clutch
    setArm('Left', 0.85 * rise - hug * 0.05, ARM_DOWN - 1.05 * rise + hug * 0.28, 0.25 * hug);
    setArm('Right', 0.85 * rise - hug * 0.05, ARM_DOWN - 1.05 * rise + hug * 0.28, -0.25 * hug);
    setElbow('Left', 0.55 + rise * 0.7 + hug * 0.95);
    setElbow('Right', 0.55 + rise * 0.7 + hug * 0.95);
    setSpine(0.12 * rise + hug * 0.3, 0, 0);      // shoulders curl around the ball
    set('Spine1', hug * 0.16, 0, 0);
    set('Neck', 0.1 * rise + hug * 0.26, 0, 0);   // chin clamps down over it
    setLeg('Left', 0.1, 0.32 + hug * 0.42, 0.14); // crouch absorbs the catch
    setLeg('Right', 0.1, 0.32 + hug * 0.42, 0.14);
    setTilt(0, 0, -0.04 * rise - hug * 0.1);
  }

  // Keeper punch: two-fist clearance, up and forward.
  function poseGKPunch(k) {
    markOverlay(true);
    k = clamp(k, 0, 1);
    let fwd, raise, elbow, arch;
    if (k < 0.4) {            // coil: fists by the chest, slight crouch
      const u = smooth(k / 0.4);
      fwd = lerp(0.2, 0.45, u);
      raise = lerp(ARM_DOWN - 0.4, ARM_DOWN - 0.7, u);
      elbow = lerp(0.6, 2.0, u);
      arch = lerp(0, 0.18, u);
    } else if (k < 0.6) {     // explode: both fists drive up-forward THROUGH the ball
      const u = smooth((k - 0.4) / 0.2);
      fwd = lerp(0.45, 1.2, u);
      raise = lerp(ARM_DOWN - 0.7, -1.2, u);
      elbow = lerp(2.0, 0.1, u);
      arch = lerp(0.18, -0.24, u);
    } else {                  // follow through, settle
      const u = smooth((k - 0.6) / 0.4);
      fwd = lerp(1.2, 0.6, u);
      raise = lerp(-1.2, ARM_DOWN - 0.8, u);
      elbow = lerp(0.1, 0.6, u);
      arch = lerp(-0.24, 0, u);
    }
    // fists knit together (slight inward swivel) — a proper two-fist clearance
    const knit = k >= 0.4 ? 0.3 : 0;
    setArm('Left', fwd, raise, knit); setArm('Right', fwd, raise, -knit);
    setElbow('Left', elbow); setElbow('Right', elbow);
    setSpine(arch, 0, 0);
    const jump = k >= 0.4 && k < 0.85 ? bell((k - 0.4) / 0.45) : 0;
    setTilt(0, 0, jump * 0.42 - (k < 0.4 ? smooth(k / 0.4) * 0.12 : 0));
    // legs tuck under the leap, split slightly for balance
    setLeg('Left', 0.12, 0.5 + jump * 0.45, 0);
    setLeg('Right', 0.08, 0.5 + jump * 0.15, 0);
    set('Neck', 0.1 - 0.15 * jump, 0, 0); // eyes track the ball overhead
  }

  // NEW (optional, host wires via integrator): lateral set-shuffle toward
  // dir (±1 = group ±X). Quick side-steps, body kept square to the shooter —
  // for the keeper tracking a threat across his goal. t in seconds, looped.
  function poseGKShuffle(t, dir) {
    markOverlay(true);
    const s = dir >= 0 ? 1 : -1;
    const step = Math.sin(t * 9);                 // fast little side-steps
    const hop = Math.abs(step);
    setSpine(0.34, 0, s * 0.10);
    setArm('Left', 0.5, ARM_DOWN - 0.62 + step * 0.04);
    setArm('Right', 0.5, ARM_DOWN - 0.62 - step * 0.04);
    setElbow('Left', 0.85); setElbow('Right', 0.85);
    // legs scissor sideways: lead leg reaches, trail leg pushes off
    setLeg('Left', 0.1, 0.55 + Math.max(0, step) * 0.25, 0.28 + s * step * 0.16);
    setLeg('Right', 0.1, 0.55 + Math.max(0, -step) * 0.25, 0.28 - s * step * 0.16);
    setTilt(0, -s * 0.06, -0.15 + hop * 0.05);
    set('Neck', 0.14, 0, -s * 0.06);              // eyes stay on the ball
  }

  // NEW (optional, host wires via integrator): ground-ball gather. Folds down
  // over the ball (long-barrier: one knee dropping in behind the hands), scoops
  // at k≈0.5, rises with it clutched to the chest. k scrubbed 0→1.
  function poseGKScoop(k) {
    markOverlay(true);
    k = clamp(k, 0, 1);
    const down = smooth(Math.min(1, k / 0.45));   // fold down over the ball
    const up = k > 0.6 ? smooth((k - 0.6) / 0.4) : 0; // rise with it clutched
    const bend = down * (1 - up * 0.75);
    setSpine(0.6 * bend + 0.22 * up, 0, 0);
    set('Spine1', 0.32 * bend, 0, 0);
    const fwd = 0.75 * bend - 0.05 * up;
    const raise = ARM_DOWN - 0.2 * bend - 0.8 * up; // hands hang to the turf, then lift in
    const elbow = 0.25 + 0.3 * bend + 1.4 * up;
    setArm('Left', fwd, raise, 0.2 * up); setArm('Right', fwd, raise, -0.2 * up);
    setElbow('Left', elbow); setElbow('Right', elbow);
    // long-barrier: trailing knee folds deep behind the gather
    setLeg('Left', 0.35 * bend - 0.1 * up, 0.3 + 0.9 * bend * (1 - up), 0.1);
    setLeg('Right', -0.25 * bend, 0.3 + 1.5 * bend * (1 - up), 0.12);
    setTilt(0, 0, -0.06 - 0.28 * bend * (1 - up));
    set('Neck', 0.35 * bend - 0.05 * up, 0, 0);   // eyes on the ball all the way in
  }

  // Walking wounded: one stiff leg, dipped shoulder. Use with very low speedNorm.
  function poseLimp(t, side) {
    markOverlay(false); // partial: slow Walk clip underneath keeps the feet moving
    const s = (side === undefined || side >= 0) ? 1 : -1;
    const S = s > 0 ? 'Left' : 'Right';           // the bad leg
    const c = Math.sin(t * 3.4);                  // hobble cycle
    const dip = Math.max(0, c);                   // dip when weight hits the bad leg
    set(S + 'UpLeg', -0.15 + c * 0.18, 0, 0);     // reduced, guarded swing
    set(S + 'Leg', 0.08, 0, 0);                   // the knee will NOT bend
    set(S + 'Foot', 0.15, 0, 0);
    setSpine(0.2 + dip * 0.08, 0, s * (0.12 + dip * 0.14)); // dipped shoulder
    set('Neck', 0.18, 0, -s * 0.08);
    setArm(S, 0.1, ARM_DOWN - 0.3);               // bad-side arm braces out
    setElbow(S, 0.5 + dip * 0.3);
    setTilt(0, 0, -0.03 - dip * 0.035);           // body sinks on the bad step
  }

  // Sent-off trudge: head down, shoulders slumped, dead-slow walk.
  function poseTrudge(t) {
    markOverlay(false); // partial: pair with a tiny speedNorm so the legs shuffle
    const c = Math.sin(t * 2.0);
    setSpine(0.3, 0, c * 0.02);
    set('Spine1', 0.14, 0, 0);
    set('Neck', 0.55, c * 0.06, 0);               // head hangs
    setArm('Left', 0.05, ARM_DOWN + 0.12);        // arms hang dead at the sides
    setArm('Right', 0.05, ARM_DOWN + 0.12);
    setElbow('Left', 0.12); setElbow('Right', 0.12);
    set('LeftShoulder', 0.12, 0, 0);              // shoulders rolled forward
    set('RightShoulder', 0.12, 0, 0);
  }

  // Exhausted: hands on knees, heaving breaths. t in seconds.
  function poseExhausted(t) {
    markOverlay(true);
    const breath = Math.sin(t * 2.6) * 0.5 + 0.5; // heave
    setSpine(0.85 + breath * 0.06, 0, 0);
    set('Spine1', 0.25 + breath * 0.04, 0, 0);
    set('Neck', -0.35 + breath * 0.08, 0, 0);     // gasping up for air
    setArm('Left', 0.95, ARM_DOWN - 0.42);        // hands braced on the knees
    setArm('Right', 0.95, ARM_DOWN - 0.42);
    setElbow('Left', 0.18); setElbow('Right', 0.18);
    setLeg('Left', 0.18, 0.45, 0.12);
    setLeg('Right', 0.18, 0.45, 0.12);
    setTilt(0, 0, -0.08);
  }

  // Celebration knee slide: drop to the knees, torso leans back, arms spread.
  function poseKneeSlide(k) {
    markOverlay(true);
    k = clamp(k, 0, 1);
    const u = smooth(Math.min(1, k / 0.3));       // the drop
    const back = k > 0.3 ? smooth((k - 0.3) / 0.7) : 0; // lean grows over the slide
    setTilt(-0.12 * u - back * 0.18, 0, lerp(0, -0.62, u)); // kneeling height + back lean
    setLeg('Left', lerp(0.1, -0.1, u), lerp(0.4, 2.1, u), 0.08 * u);  // shins folded under
    setLeg('Right', lerp(0.1, -0.1, u), lerp(0.4, 2.1, u), 0.08 * u);
    set('LeftFoot', 0.6 * u, 0, 0); set('RightFoot', 0.6 * u, 0, 0);  // laces on the turf
    setArm('Left', -0.25 * u, lerp(ARM_DOWN, -0.15 - back * 0.25, u));  // arms spread wide
    setArm('Right', -0.25 * u, lerp(ARM_DOWN, -0.15 - back * 0.25, u));
    setElbow('Left', 0.1); setElbow('Right', 0.1);
    setSpine(-0.15 * u - back * 0.25, 0, 0);      // chest open to the sky
    set('Neck', -0.3 * u - back * 0.15, 0, 0);
  }

  // Referee: firm point down-forward at the penalty spot. t in seconds.
  function posePointToSpot(t) {
    markOverlay(true);
    const firm = Math.min(1, t * 4);              // arm punches out then HOLDS
    setArm('Right', 0.95 * firm, ARM_DOWN - 0.5);  // extended down-forward
    setElbow('Right', 0.04);
    setArm('Left', -0.1, ARM_DOWN);               // other arm stays at the side
    setElbow('Left', 0.25);
    setSpine(0.14 * firm, -0.12 * firm, 0);       // weight committed into the call
    set('Neck', 0.18 * firm, -0.1 * firm, 0);     // staring at the spot
    setLeg('Left', 0.12, 0.2, 0);
    setLeg('Right', -0.12, 0.15, 0);
  }

  // Referee: whistle to the mouth. t in seconds.
  function poseWhistle(t) {
    markOverlay(true);
    const up = Math.min(1, t * 5);
    setArm('Right', 0.55 * up, ARM_DOWN - 0.95 * up); // hand to the mouth
    setElbow('Right', 2.25 * up);
    setArm('Left', 0.2 * up, ARM_DOWN - 1.3 * up);    // other arm raised: play stops
    setElbow('Left', 0.15);
    setSpine(0.06, 0, 0);
    set('Neck', -0.08 * up, Math.sin(t * 0.9) * 0.15, 0); // scanning the incident
    setLeg('Left', 0.05, 0.12, 0);
    setLeg('Right', -0.05, 0.12, 0);
  }

  // W7 ADDITIVE: referee brandishes a card aloft — right arm rammed straight
  // up with a glowing yellow/red card plane just past the fingers. Only
  // refRigStep calls this (feature-detected); never stamped into _poseDesc,
  // so replays are untouched. t is continuous seconds (matches kayrig's).
  function poseShowCard(t, isRed) {
    markOverlay(true);
    const up = Math.min(1, t * 5);
    setArm('Right', 0.12 * up, lerp(ARM_DOWN, -1.45, up)); // hanging -> overhead
    setElbow('Right', 0.08);
    setArm('Left', -0.1, ARM_DOWN);                        // other arm at the side
    setElbow('Left', 0.3);
    setSpine(-0.05 * up, 0.1 * up, 0);                     // squared, chest up
    set('Neck', -0.1 * up, 0.12 * up, 0);                  // eyes on the offender
    setLeg('Left', 0.06, 0.12, 0);
    setLeg('Right', -0.06, 0.12, 0);
    cardReq = true; cardRed = !!isRed;                     // card pops in via update()
  }

  function clearOverlay() {
    for (const name in channels) channels[name].on = false;
    overlayThisFrame = false;
    overlayFull = false;
    tiltActive = false;
    cardReq = false;
  }

  // ---- per-frame driver ----
  // opts (all optional, no allocation needed by the host if it reuses one object):
  //   accel: -1..1  — host's forward acceleration estimate; leans the torso
  //                   into speed-ups, brake-leans back on slow-downs.
  //   turn:  -1..1  — host's yaw rate estimate; banks the torso and leads
  //                   with the head into the turn (+1 = turning toward +X).
  function update(dt, speedNorm, opts) {
    const s = clamp(speedNorm || 0, 0, 1);
    // crossfade Idle <-> Walk (s 0..0.4) <-> Run (s 0.4..1)
    let wWalk = 0, wRun = 0;
    if (s >= 0.4) { wRun = (s - 0.4) / 0.6; wWalk = 1 - wRun; }
    else if (s >= 0.06) { wWalk = (s - 0.06) / 0.34; }
    // gait clock (contract C2): ONE master phase scrubs BOTH walk and run at
    // the same normalized cycle time (phase-locked, so the blend band can't
    // double-step), advanced from ACTUAL ground speed so foot plants match
    // ground displacement. The clips plant a foot at cycle 0 and 0.5, so
    // gaitPhase (= gaitCyc * 2PI, exposed on the rig) has a footfall every PI.
    const spd = opts && opts.speed !== undefined ? Math.max(0, opts.speed) : s * HOST_MAX_SPEED;
    gaitCyc += clamp(spd / lerp(WALK_STRIDE, RUN_STRIDE, wRun), 0, 2.2) * dt;
    const cyc = gaitCyc % 1;
    walkAct.time = cyc * _clips.Walk.duration;
    runAct.time = cyc * _clips.Run.duration;

    // full-body overlays fade the walk/run churn out; idle absorbs the freed
    // weight so TOTAL mixer influence never dips below 1 — PropertyMixer fills
    // any deficit from each binding's saved original state, which is the bind
    // T-POSE (the old start/end-of-pose arm flare). The overlay channels then
    // win their bones on top of the idle base.
    const fadeTarget = (overlayThisFrame && overlayFull) ? 0 : 1;
    locoScale += (fadeTarget - locoScale) * (1 - Math.exp(-10 * dt));
    idleAct.setEffectiveWeight(1 - (wWalk + wRun) * locoScale);
    walkAct.setEffectiveWeight(wWalk * locoScale);
    runAct.setEffectiveWeight(wRun * locoScale);

    mixer.update(dt);

    // tilt node: ease toward pose targets / ease home when nothing claims it
    {
      const e = 1 - Math.exp(-(tiltActive ? 12 : 8) * dt);
      const tx = tiltActive ? tiltX : 0, tz = tiltActive ? tiltZ : 0, ty = tiltActive ? tiltY : 0;
      tilt.rotation.x += (tx - tilt.rotation.x) * e;
      tilt.rotation.z += (tz - tilt.rotation.z) * e;
      tilt.position.y += (ty - tilt.position.y) * e;
    }

    // overlay channels win AFTER the mixer (spike-proven) — but blended now:
    // each channel eases its weight in over ~0.12s while the pose is being
    // called, and back out over ~0.18s once it stops, so poses never snap.
    let anyOverlay = false;
    for (const name in channels) {
      const ch = channels[name];
      if (ch.on) {
        _q.setFromEuler(ch.e);
        ch.q.multiplyQuaternions(ch.rest, _q);   // cache the target for fade-out
        ch.w = Math.min(1, ch.w + dt * BLEND_IN);
        ch.on = false; // one pose per frame; host re-arms next frame
      } else if (ch.w > 0) {
        ch.w = Math.max(0, ch.w - dt * BLEND_OUT);
      }
      if (ch.w > 0) {
        anyOverlay = true;
        ch.bone.quaternion.slerp(ch.q, smooth(ch.w));
      }
    }
    // smoothed "overlay influence" gate for additives/idle behaviors
    overlayW += ((overlayThisFrame || anyOverlay ? 1 : 0) - overlayW) * (1 - Math.exp(-8 * dt));

    // ---- locomotion additives: procedural life on top of the mocap --------
    // scaled by locoScale (full poses own the body) and damped by overlayW.
    const addGate = locoScale * (1 - overlayW * 0.85);
    if (addGate > 0.01) {
      // smooth the host-fed inputs so accel/turn spikes never twitch the spine
      const targetA = opts && opts.accel !== undefined ? clamp(opts.accel, -1, 1) : 0;
      const targetT = opts && opts.turn !== undefined ? clamp(opts.turn, -1, 1) : 0;
      const ke = 1 - Math.exp(-6 * dt);
      accelS += (targetA - accelS) * ke;
      turnS += (targetT - turnS) * ke;

      const moveAmt = 0.25 + 0.75 * s; // additives scale with speed
      // lean into acceleration / brake-lean back
      const lean = (accelS * 0.22 + persLean * s) * moveAmt * addGate;
      // bank into turns (torso roll) + head leads the turn
      const bank = -turnS * 0.2 * s * addGate;
      if (lean !== 0 || bank !== 0 || persRoll !== 0) {
        add('Spine', lean * 0.6, turnS * 0.08 * s * addGate, bank + persRoll * s * addGate);
        add('Spine1', lean * 0.4, 0, bank * 0.5);
      }
      add('Neck', persHead * s * addGate - lean * 0.3, turnS * 0.3 * s * addGate, -bank * 0.5);
      // arm-pump intensity beyond the clip: elbows tighten + shoulders drive at sprint
      const sprint = Math.max(0, (s - 0.45) / 0.55) * persArm * addGate;
      if (sprint > 0.01) {
        add('LeftForeArm', -0.55 * sprint, 0, 0);
        add('RightForeArm', 0.55 * sprint, 0, 0);
        add('LeftShoulder', 0.06 * sprint, 0, 0);
        add('RightShoulder', 0.06 * sprint, 0, 0);
      }

      // ---- idle micro-behaviors: 14 idle players never look synchronized --
      const idleTarget = s < 0.08 ? 1 : 0;
      idleW += (idleTarget - idleW) * (1 - Math.exp(-4 * dt));
      if (idleW > 0.01) {
        idleClock += dt;
        const cycle = Math.floor(idleClock / idleCyc);
        const within = (idleClock % idleCyc) / idleCyc;
        // eased ramp in/out inside each cycle so behaviors fade, never pop
        const ramp = smooth(Math.min(within / 0.18, (1 - within) / 0.18, 1));
        const g = ramp * idleW * addGate;
        // per-rig pseudo-random behavior sequence (seeded, integer-hash)
        const beh = ((cycle * 2654435761 + ((seed * 977) | 0)) >>> 0) % 4;
        if (beh === 0) {        // weight shift, hips sway, spine counters
          const sway = Math.sin(idleClock * 0.9) * 0.08 * g;
          add('Hips', 0, 0, sway);
          add('Spine', 0, 0, -sway * 0.7);
          add('Neck', 0, 0, -sway * 0.3);
        } else if (beh === 1) { // hands on hips
          add('LeftArm', 0, 0.25 * g, -0.28 * g);
          add('RightArm', 0, -0.25 * g, -0.28 * g);
          add('LeftForeArm', -1.15 * g, 0, 0);
          add('RightForeArm', 1.15 * g, 0, 0);
          add('Spine', -0.05 * g, 0, 0); // chest opens slightly
        } else if (beh === 2) { // look around the stadium
          const scan = Math.sin(idleClock * 0.7) * 0.55 * g;
          add('Neck', -0.06 * g, scan, 0);
          add('Head', 0, scan * 0.5, 0);
          add('Spine', 0, scan * 0.12, 0);
        }                        // beh 3: plain breathing (below) — variety includes stillness
        // subtle breathing on every idle behavior
        add('Spine2', Math.sin(idleClock * 1.7) * 0.018 * idleW * addGate, 0, 0);
      }
    }

    // head look: host writes headPivot.rotation.y; split clamped yaw Neck/Head
    const look = clamp(headPivot.rotation.y, -1.1, 1.1);
    if (channels.Neck && Math.abs(look) > 0.001) {
      _q2.setFromAxisAngle(_YAXIS, look * 0.5);
      channels.Neck.bone.quaternion.multiply(_q2);
      _q2.setFromAxisAngle(_YAXIS, look * 0.5);
      channels.Head.bone.quaternion.multiply(_q2);
    }

    // referee card: pop in while poseShowCard is being called, fade out after
    cardHold += ((cardReq ? 1 : 0) - cardHold) * (1 - Math.exp(-12 * dt));
    if (cardReq && !cardMesh && cardAnchor) {
      cardMesh = new THREE.Mesh(geoCardPlane(),
        new THREE.MeshBasicMaterial({ color: 0xffe14d, side: THREE.DoubleSide }));
      cardAnchor.add(cardMesh);
      ownedMaterials.push(cardMesh.material);
    }
    if (cardMesh) {
      cardMesh.visible = cardHold > 0.03;
      cardMesh.material.color.set(cardRed ? 0xff3b30 : 0xffe14d);
      const cs = 0.6 + 0.4 * smooth(cardHold);
      cardMesh.scale.set(cs, cs, cs);
    }
    cardReq = false;

    overlayThisFrame = false;
    overlayFull = false;
    tiltActive = false;
  }

  function dispose() {
    for (const m of ownedMaterials) m.dispose();
    mixer.stopAllAction();
    mixer.uncacheRoot(model);
  }

  return {
    group,
    headPivot,
    anchors: {
      back: { x: 0, y: 1.32, z: -0.18 },  // jersey back number plane (host rotates it PI)
      chest: { x: 0, y: 1.36, z: 0.16 },  // chest number plane (faces +Z)
      tagY: 2.45,                         // floating nameplate sprite height
    },
    // W3: rig renders its own printed jersey when the host passed
    // jerseyName/jerseyNumber — host then SKIPS its legacy number planes (the
    // decals above ARE the kit print). boneAnchors are spine-bone-parented
    // Object3Ds (rig-axis-aligned, unit-world-scaled at bind) for
    // host-parented planes on rigs that don't self-render.
    rendersJersey,
    boneAnchors: (chestAnchor && hostBackAnchor)
      ? { chest: chestAnchor, back: hostBackAnchor } : undefined,
    // contract C2: radians, monotonic, advanced from actual ground speed in
    // update(); a foot visually plants every PI. Host mirrors this into
    // p.stridePhase after rig.update so ballcontrol touches hit real footfalls.
    get gaitPhase() { return gaitCyc * Math.PI * 2; },
    update,
    poseKick, poseThrowIn, poseDive, poseFall, poseGetUp,
    poseCelebrate, poseSkill, poseArgue, poseShield,
    poseSlideTackle, poseHeader, poseJockey,
    poseGKSet, poseGKCatch, poseGKPunch, poseGKShuffle, poseGKScoop,
    poseLimp, poseTrudge, poseExhausted, poseKneeSlide,
    posePointToSpot, poseWhistle, poseShowCard,
    clearOverlay, dispose,
  };
}
