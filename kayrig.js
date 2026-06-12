// kayrig.js — KayKit fantasy-character player rig for Cyberliga.
// Drop-in replacement for humanrig.js: identical public API (W4: export names
// preloadHumanModel / buildPlayerRig / CHARACTERS are FROZEN), but bodies are
// CC0 KayKit adventurer/skeleton characters (./skins/*.glb) with ~76 baked
// animation clips each. Architecture: CLIPS FIRST, PROCEDURAL SECOND.
//
//   - Locomotion: AnimationMixer crossfade Unarmed_Idle <-> Walking_A/B <->
//     Running_A/B by speedNorm. Walk/run are SCRUBBED in lockstep from one
//     master gait clock advanced by ACTUAL ground speed (opts.speed when the
//     host provides it, else speedNorm*7) — foot plants match ground
//     displacement, no skating, and the walk/run blend band can't double-step
//     because both clips share the cycle phase. rig.gaitPhase exposes it.
//   - Host-scrubbed poses (poseKick(k), poseFall(k), ...): the matching clip
//     action is played PAUSED and we set action.time = k * duration each
//     frame — the HOST keeps full timing authority. Looped poses
//     (celebrate/jockey/GK set/...) run the clip at a chosen timeScale,
//     speed-tied where the move travels (jockey/limp/trudge).
//   - T-POSE IS STRUCTURALLY IMPOSSIBLE here: at build we pose the skeleton
//     to Unarmed_Idle frame 0 ("neutral stance") BEFORE any action is
//     created, so every PropertyMixer binding saves THAT as its original
//     state, and the per-frame pre-mixer reset also restores it. Any blend
//     weight deficit (track-set mismatches between clips, mid-crossfade dips)
//     therefore resolves to a normal standing pose, never the bind T-pose.
//     On top of that, locomotion always yields exactly the influence
//     full-body poses claim, so cumulative weight never drops below 1.
//   - A small procedural layer runs AFTER the mixer: additive bone rotations
//     (accel lean / turn bank / argue arms / referee calls / dive reach) and
//     an internal tilt node for ground-rooted moves — the host's group
//     transform is never written. A rig-owned squash&stretch scalar on the
//     inner node sells impacts/hops (this style is allowed to be FUNNIER
//     than pro), eased frame-rate independently, always recovering to 1.
//   - W8: rig.update(0, 0) is safe (replay freeze-frames). All eases use
//     1-exp(-k*dt). At dt=0 we micro-dither sampled clip times so three.js's
//     PropertyMixer "skip identical frames" optimization can't let the
//     neutral reset win over a held pose.
//
// Conventions (matching humanrig.js / the host):
//   - ~1.9 units tall, origin at the feet, wrapper group forward = +Z.
//     (KayKit GLBs natively face +Z — no yaw flip needed.)
//   - The HOST owns group.position/rotation.y/scale and headPivot.rotation.y.
//   - rig.update(dt, speedNorm, opts) is REQUIRED every frame; poses are
//     one-call-per-frame BEFORE update().
//
// Wave-2 additions (W2/W3/W7):
//   - opts.character: 'Knight'|'Barbarian'|'Mage'|'Rogue'|'Skeleton_Warrior'|
//     'Skeleton_Minion'|'Skeleton_Mage'|'Skeleton_Rogue' (default Knight,
//     unknown values fall back to Knight).
//   - opts.jerseyName / opts.jerseyNumber: when provided the rig renders its
//     own canvas-texture name+number decals parented to the chest bone and
//     sets rig.rendersJersey = true (host skips its legacy number planes).
//   - rig.boneAnchors = { chest, back }: Object3D anchors parented to the
//     chest bone, world-axis-aligned and unit-world-scaled at the neutral
//     stance, for host-parented planes. Legacy static rig.anchors remain.
//   - opts.flair: string[] from [mohawk, braids, mask, beard, dreads,
//     glasses, scar, fro, spikes]; rendered as simple glow/dark primitives on
//     the head where it translates; skeletons accept a safe subset
//     (mask/glasses/spikes/mohawk — sized up a touch for skulls) and 'scar'
//     skips gracefully (texture-level).
//   - W12 opts.dna (LOOK DNA, additive): { skinTone, hairTint, trimColor,
//     scale (0.93-1.08 body scale, nameplate/anchor compensated), props,
//     eyeTint (skeleton eye glow) }. props mixes two vocabularies:
//       * GLB attachment toggles ('helmet'|'hat'|'hood' = headgear category,
//         'cape'|'cloak' = back category): when props is an ARRAY the rig
//         takes authority over those nodes — listed categories show,
//         unlisted hide (KayKit ships a full head mesh under every helmet/
//         hat/hood, so bare heads are always safe);
//       * procedural accessories (the humanrig flair vocabulary) — merged
//         with opts.flair, hair-like ones tinted by dna.hairTint.
//     Deterministic fallback: when opts.dna is absent but jerseyName exists,
//     a full DNA derives from hash32(jerseyName) — every named player is
//     unique with zero roster data, and the SAME look bakes in portraits.
//     No jerseyName and no dna (the referee) = no DNA, legacy look.
//   - rig.poseShowCard(t, isRed): additive ref-only pose (W7) — arm aloft
//     brandishing a glowing yellow/red card mesh; feature-detected by
//     refRigStep, never recorded in _poseDesc.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const TARGET_HEIGHT = 1.9;
export const CHARACTERS = [
  'Knight', 'Barbarian', 'Mage', 'Rogue',
  'Skeleton_Warrior', 'Skeleton_Minion', 'Skeleton_Mage', 'Skeleton_Rogue',
];

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
function smooth(k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }
function bell(k) { return Math.sin(clamp(k, 0, 1) * Math.PI); }

// weapons/props baked into the GLBs that a footballer must not carry
const PROP_RE = /sword|shield|axe|crossbow|knife|wand|staff|spellbook|mug|throwable|offhand/i;

// ---- W12: LOOK DNA ----------------------------------------------------------
// GLB-verified toggleable attachments (every one has a full head/skull mesh
// underneath): Knight_Helmet, Barbarian_Hat, Mage_Hat, Skeleton_Warrior_Helmet,
// Skeleton_Mage_Hat, Skeleton_Rogue_Hood + per-character Cape/Cloak nodes.
const TOGGLE_RE = /helmet|hat|hood|cape|cloak/i;
const HEADGEAR_RE = /helmet|hat|hood/;
const BACKWEAR_RE = /cape|cloak/;
const DNA_SKINS = [0xffdbac, 0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0x6b4226];
const DNA_HAIRS = [0x14100c, 0x2a1b10, 0x5a3a1a, 0x8d8d92, 0xd8c08a, 0xe8ecf5];
const FLAIR_VOCAB = ['mohawk', 'spikes', 'fro', 'beard', 'glasses', 'mask', 'braids', 'dreads', 'scar'];
const SKELETON_FLAIR_OK = new Set(['mask', 'glasses', 'spikes', 'mohawk']);
function hash32(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function deriveDna(name, isSkeleton) {
  const h = hash32(String(name));
  const props = [];
  if (h & 1024) props.push('helmet');                  // headgear category token
  if (h & 2048) props.push('cape');                    // backwear category token
  if ((h >>> 12) % 3 === 0) {
    const pool = isSkeleton ? ['mask', 'glasses', 'spikes', 'mohawk']
      : ['mohawk', 'spikes', 'beard', 'fro', 'braids', 'dreads', 'glasses'];
    props.push(pool[(h >>> 14) % pool.length]);
  }
  return {
    skinTone: DNA_SKINS[h % DNA_SKINS.length],
    hairTint: DNA_HAIRS[(h >>> 3) % DNA_HAIRS.length],
    scale: 0.93 + ((h >>> 7) % 16) / 15 * 0.15,
    props,
    eyeTint: null,                                     // resolved vs team glow below
    _eyeShift: (((h >>> 17) % 100) / 100 - 0.5) * 0.12, // ±0.06 hue nudge on the glow
  };
}

// gait calibration: ground meters covered per full walk/run cycle at the
// 1.9-unit scale. KayKit bodies are stubby-legged chibi builds, so cycles are
// shorter than the Soldier's (humanrig uses 1.6/3.8) — the faster resulting
// cadence reads comedic, which suits this style. Cycle rate is clamped so a
// physics impulse can't spin the legs into a blur.
const WALK_STRIDE = 1.35;  // m/cycle (Walking_A/B @ 1.9u)
const RUN_STRIDE = 3.2;    // m/cycle (Running_A/B @ 1.9u)
const HOST_MAX_SPEED = 7;  // hosts pass speedNorm = clamp(speed / 7, 0, 1)

// ---- shared GLTF cache (all 8 characters preloaded in parallel) ----
// W5 note: the HOST only calls preloadHumanModel() when ?style=kaykit is
// active, so these GLBs never slow the pro boot.
const _cache = {};   // name -> { scene, clips: {name: clip}, scale }
let _promise = null;

export function preloadHumanModel() {
  if (_promise) return _promise;
  const loader = new GLTFLoader();
  _promise = Promise.all(CHARACTERS.map((name) => new Promise((resolve, reject) => {
    loader.load('./skins/' + name + '.glb', (gltf) => {
      const clips = {};
      for (const c of gltf.animations) clips[c.name] = c;
      gltf.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(gltf.scene);
      _cache[name] = { scene: gltf.scene, clips, scale: TARGET_HEIGHT / (box.max.y - box.min.y) };
      resolve();
    }, undefined, reject);
  })));
  return _promise;
}

// module-level temps — no per-frame allocation
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _qid = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _YAXIS = new THREE.Vector3(0, 1, 0);
const _gkColor = new THREE.Color(0xc8ff4d);
const _hsl = { h: 0, s: 0, l: 0 };

const BLEND_IN = 1 / 0.12;   // pose weight ease-in
const BLEND_OUT = 1 / 0.16;  // pose weight ease-out

function saturate(color, amount) {
  color.getHSL(_hsl);
  color.setHSL(_hsl.h, clamp(_hsl.s * (1 + amount) + 0.1, 0, 1), _hsl.l);
}

// W11 — RENDERING-CONTEXT COLOR FIX. The host renders with ACES filmic
// tonemapping + UnrealBloom; the ACES RRT skews saturated magenta/pink hues
// toward plain RED and bloom whitens the core, which made VOLT UTD's
// #ff2d78 emissives read RED on bodies. Pre-compensate: rotate pink-band
// hues ~18° toward magenta/violet and cap lightness so the renderer's hue
// skew + bloom land the PERCEIVED color back on hot pink.
// Target perceived color for #ff2d78 input: hot pink #ff2d78 (NOT red) —
// the pre-compensated source is ≈#f02daa, which ACES drags back to pink.
// Non-pink hues (cyan/gold/violet) pass through untouched.
function acesGlow(hex) {
  const c = new THREE.Color(hex);
  c.getHSL(_hsl);
  if (_hsl.h > 0.88 || _hsl.h < 0.03) {
    c.setHSL((_hsl.h + 1 - 0.05) % 1, _hsl.s, Math.min(_hsl.l, 0.58));
  }
  return c;
}

// W12 eye-glow variant of the W11 compensation: only the PINK band rotates.
// acesGlow also drags near-red hues (h<0.03) toward magenta, which would
// pinkify an authored RED eye glow (QUASAR's red-card eyes must stay red —
// ACES renders saturated red fine on its own).
function eyeGlowColor(hex) {
  const c = new THREE.Color(hex);
  c.getHSL(_hsl);
  if (_hsl.h > 0.88 && _hsl.h < 0.97 && _hsl.s > 0.3) {
    c.setHSL((_hsl.h + 1 - 0.05) % 1, _hsl.s, Math.min(_hsl.l, 0.58));
  }
  return c;
}

// bones we add procedural rotation to (GLTFLoader-sanitized KayKit names:
// 'upperarm.l' in Blender becomes 'upperarml' in three.js)
const PROC_BONES = [
  'head', 'spine', 'chest', 'hips',
  'upperarml', 'upperarmr', 'lowerarml', 'lowerarmr',
  'upperlegl', 'upperlegr',
];

// ---- shared geometry/material/texture caches (module-level, reused across
// rigs and fixtures; host clearTeams() may dispose them — three.js lazily
// re-uploads, so sharing stays safe) ----
const _matCache = new Map();   // tint key -> cloned tinted material
const _texCache = new Map();   // jersey key -> CanvasTexture
const _glowMats = new Map();   // glow hex -> MeshBasicMaterial
let _geos = null;
function geos() {
  if (_geos) return _geos;
  _geos = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cone: new THREE.ConeGeometry(0.5, 1, 6),
    sphere: new THREE.SphereGeometry(0.5, 10, 8),
    cyl: new THREE.CylinderGeometry(0.5, 0.4, 1, 6),
    back: new THREE.PlaneGeometry(0.6, 0.75),
    chest: new THREE.PlaneGeometry(0.26, 0.26),
    card: new THREE.PlaneGeometry(0.13, 0.18),
  };
  return _geos;
}
let _darkMat = null, _maskMat = null;
function darkMat() { return _darkMat || (_darkMat = new THREE.MeshStandardMaterial({ color: 0x17120e, roughness: 0.85 })); }
function maskMat() { return _maskMat || (_maskMat = new THREE.MeshStandardMaterial({ color: 0x10141f, roughness: 0.4, metalness: 0.5 })); }
function glowMat(glow) {
  const key = glow.getHexString();
  let m = _glowMats.get(key);
  if (!m) { m = new THREE.MeshBasicMaterial({ color: glow.clone() }); _glowMats.set(key, m); }
  return m;
}
// W12: dna.hairTint materials — matte for fro/braids/dreads/beard, softly
// emissive for mohawk/spikes (silver/pink hair still pops under bloom)
const _hairMats = new Map();
function hairMat(hex, glowy) {
  const key = hex + '|' + (glowy ? 1 : 0);
  let m = _hairMats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.7, metalness: 0.05 });
    if (glowy) { m.emissive.set(hex); m.emissiveIntensity = 0.3; }
    _hairMats.set(key, m);
  }
  return m;
}

// ---- team kit zones: which mesh gets which treatment -----------------------
// KayKit mesh nodes are cleanly named (Knight_Body, Rogue_Cape,
// Skeleton_Warrior_Eyes...), so the "jersey" is painted per zone:
//   torso/arms -> kit color (the shirt), legs -> darker trim (the shorts),
//   cape/cloak -> strong kit (a team banner on their back),
//   helmet/hat/hood -> glow-tinted (the visor read), head/skull/jaw -> barely
//   tinted (faces stay faces), eyes -> hard team glow (skeleton LEDs).
function zoneOf(name) {
  const n = name.toLowerCase();
  if (n.includes('eyes')) return 'eyes';
  if (/cape|cloak/.test(n)) return 'cape';
  if (/helmet|hat|hood/.test(n)) return 'gear';
  if (/skull|jaw|head/.test(n)) return 'skin';
  if (/leg/.test(n)) return 'legs';
  return 'torso';
}
// W12: skinC tints human face/head zones (complexion — KayKit bakes hair into
// the head atlas, so the tint reads as overall complexion, which is the goal);
// eyeC overrides the skeleton eye-LED color. Both are in the cache key, as is
// trim (dna.trimColor can now decouple it from the kit hue).
function tintedMaterial(src, zone, character, kit, trim, glow, accent, skinC, eyeC) {
  const key = character + '|' + src.uuid + '|' + zone + '|' + kit.getHexString() + '|' + glow.getHexString() + '|' + (accent ? 1 : 0)
    + '|' + trim.getHexString() + '|' + (skinC ? skinC.getHexString() : '') + '|' + (eyeC ? eyeC.getHexString() : '');
  let m = _matCache.get(key);
  if (m) return m;
  m = src.clone();
  if (m.color) {
    if (zone === 'eyes') m.color.copy(eyeC || glow);
    else if (zone === 'cape') { m.color.lerp(kit, 0.7); saturate(m.color, 0.8); }
    else if (zone === 'gear') { m.color.lerp(glow, 0.45); saturate(m.color, 0.4); }
    else if (zone === 'skin') {
      if (skinC) { m.color.lerp(skinC, 0.55); m.color.lerp(kit, 0.06); }
      else m.color.lerp(kit, 0.12);
    }
    else if (zone === 'legs') { m.color.lerp(trim, 0.65); saturate(m.color, 0.45); }
    else { m.color.lerp(kit, 0.58); saturate(m.color, accent ? 0.85 : 0.6); }
  }
  if (m.emissive) {
    m.emissive.copy(zone === 'eyes' && eyeC ? eyeC : glow);
    m.emissiveIntensity =
      zone === 'eyes' ? 1.6
      : zone === 'cape' ? (accent ? 0.3 : 0.16)
      : zone === 'gear' ? 0.3
      : zone === 'skin' ? 0
      : zone === 'legs' ? 0.04
      : (accent ? 0.22 : 0.1);
  }
  _matCache.set(key, m);
  return m;
}

// ---- jersey decal textures (canvas, cached per name/number/color) ----------
function jerseyBackTexture(name, number, glowCss) {
  const key = 'B|' + name + '|' + number + '|' + glowCss;
  let t = _texCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas'); c.width = 512; c.height = 640;
  const g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (name) {
    g.font = '700 64px Orbitron, sans-serif';
    g.fillStyle = glowCss; g.shadowColor = glowCss; g.shadowBlur = 18;
    g.fillText(String(name), 256, 88, 460);
  }
  if (number !== '' && number !== null && number !== undefined) {
    g.font = '900 330px Orbitron, sans-serif';
    g.fillStyle = '#ffffff'; g.shadowColor = glowCss; g.shadowBlur = 26;
    g.fillText(String(number), 256, 390);
  }
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  _texCache.set(key, t);
  return t;
}
function jerseyChestTexture(number, glowCss) {
  const key = 'C|' + number + '|' + glowCss;
  let t = _texCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 165px Orbitron, sans-serif';
  g.fillStyle = '#ffffff'; g.shadowColor = glowCss; g.shadowBlur = 14;
  g.fillText(String(number ?? ''), 128, 136);
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  _texCache.set(key, t);
  return t;
}

// neutral stance: write a clip's frame-0 transforms straight onto the cloned
// skeleton (track names are '<sanitizedNode>.<prop>' — sanitized names hold
// no dots, so lastIndexOf is safe)
function applyClipFrame0(model, clip) {
  const byName = {};
  model.traverse((o) => { byName[o.name] = o; });
  for (const tr of clip.tracks) {
    const dot = tr.name.lastIndexOf('.');
    const node = byName[tr.name.slice(0, dot)];
    if (!node) continue;
    const prop = tr.name.slice(dot + 1);
    if (prop === 'quaternion') node.quaternion.fromArray(tr.values, 0);
    else if (prop === 'position') node.position.fromArray(tr.values, 0);
    else if (prop === 'scale') node.scale.fromArray(tr.values, 0);
  }
}

export function buildPlayerRig({
  kitColor, glowColor, skinTone, hairColor, isGK = false, headband = false,
  captain = false, pattern = 'solid', character = 'Knight',
  jerseyName = null, jerseyNumber = null, flair = null, dna = null,
}) {
  const data = _cache[CHARACTERS.includes(character) ? character : 'Knight'] || _cache.Knight;
  if (!data) throw new Error('kayrig: call preloadHumanModel() and await it before buildPlayerRig()');
  const clips = data.clips;
  const charName = CHARACTERS.includes(character) ? character : 'Knight';
  const isSkeleton = charName.startsWith('Skeleton');

  // ---- W12: resolve LOOK DNA. Explicit opts.dna fields win; anything the
  // author omits falls back to the name-hash derivation (deterministic, so
  // in-game bodies and baked portraits agree). No name + no dna (the ref):
  // DNA stays off and the legacy look is byte-identical.
  let d = null;
  if (dna || jerseyName != null) {
    const derived = deriveDna(jerseyName != null ? jerseyName : charName, isSkeleton);
    derived.trimColor = null;            // never derive trim — team shorts stay on-brand
    d = dna ? { ...derived, ...dna } : derived;
  }
  const dnaScale = d && d.scale != null ? clamp(d.scale, 0.85, 1.15) : 1;
  const baseScale = data.scale * dnaScale;

  // group (host-owned) > tilt (pose-owned pitch/roll/y) > inner (scale + squash) > model
  const group = new THREE.Group();
  const tilt = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.setScalar(baseScale);    // KayKit faces +Z already; origin at feet
  group.add(tilt);
  tilt.add(inner);

  const model = SkeletonUtils.clone(data.scene);
  inner.add(model);

  // ---- team kit: per-ZONE tinted materials, cached per (character, kit, dna) ----
  const kit = new THREE.Color(kitColor);
  if (isGK) kit.lerp(_gkColor, 0.8);                 // keepers read lime — GK distinct
  const glow = acesGlow(glowColor);                  // W11 pre-compensated emissive hue
  const dnaTrim = d && d.trimColor != null;
  const trim = new THREE.Color(dnaTrim ? d.trimColor : kitColor);
  if (!dnaTrim) {                                    // darker hue-shifted cousin = "shorts"
    trim.getHSL(_hsl);
    trim.setHSL((_hsl.h + 0.06) % 1, clamp(_hsl.s * 1.2, 0, 1), _hsl.l * 0.55);
  }
  if (isGK) trim.lerp(_gkColor, 0.4);
  // W12 complexion + eye-LED colors (skin: humans only — bone stays bone)
  const skinC = d && !isSkeleton && d.skinTone != null ? new THREE.Color(d.skinTone) : null;
  let eyeC = null;
  if (isSkeleton && d) {
    if (d.eyeTint != null) eyeC = eyeGlowColor(d.eyeTint);
    else if (d._eyeShift) {              // derived: hue-nudge the team glow
      eyeC = glow.clone();
      eyeC.getHSL(_hsl);
      eyeC.setHSL((_hsl.h + d._eyeShift + 1) % 1, _hsl.s, clamp(_hsl.l * 1.08, 0, 0.75));
    }
  }
  const accent = pattern === 'accent';
  // W12: GLB attachment authority — when dna.props is an array, headgear and
  // cape/cloak nodes show only if their category token is listed
  const dnaProps = d && Array.isArray(d.props) ? d.props.map((t) => String(t).toLowerCase()) : null;
  const ownedMaterials = [];                         // rig-unique only (bands/card) — cached mats are shared
  model.traverse((o) => {
    if (!o.isMesh) return;
    if (PROP_RE.test(o.name)) { o.visible = false; return; } // no swords on the pitch
    if (dnaProps && TOGGLE_RE.test(o.name)) {
      const n = o.name.toLowerCase();
      const on = dnaProps.some((t) =>
        (t === 'cape' || t === 'cloak') ? BACKWEAR_RE.test(n)
        : (t === 'helmet' || t === 'hat' || t === 'hood') ? HEADGEAR_RE.test(n)
        : n.includes(t));
      if (!on) { o.visible = false; return; }
    }
    o.castShadow = true;
    o.frustumCulled = false;                         // skinned bounds lag the pose
    o.material = tintedMaterial(o.material, zoneOf(o.name), charName, kit, trim, glow, accent, skinC, eyeC);
  });
  void skinTone; void hairColor; // baked textures; accepted for API parity

  // ---- bone lookup ----
  const bones = {};
  model.traverse((o) => { if (o.isBone) bones[o.name] = o; });

  // ---- neutral stance BEFORE any mixer action exists -----------------------
  // Pose the skeleton to Unarmed_Idle frame 0 now, so (a) every PropertyMixer
  // binding saves THIS as its original state (deficit fill = standing, never
  // T-pose), and (b) the per-frame pre-mixer reset below restores a stance,
  // not the bind pose.
  const idleClip = clips.Unarmed_Idle || clips.Idle;
  if (idleClip) applyClipFrame0(model, idleClip);
  group.updateMatrixWorld(true); // group is parentless at build: world == rig space
  const neutral = [];
  model.traverse((o) => {
    if (!o.isBone) return;
    neutral.push({ bone: o, q: o.quaternion.clone(), p: o.position.clone() });
  });

  // world-frame helper: an Object3D parented to a bone, positioned at a rig-
  // space point, axis-aligned with the rig and unit-world-scaled AT THE
  // NEUTRAL STANCE. Children placed in meters along rig axes track the bone
  // through animation — used for jersey decals, flair, the ref's card.
  function holderOn(boneName, x, y, z) {
    const bone = bones[boneName];
    if (!bone) return null;
    const h = new THREE.Group();
    bone.add(h);
    h.position.copy(bone.worldToLocal(_v.set(x, y, z)));
    h.quaternion.copy(bone.getWorldQuaternion(_q).invert());
    bone.getWorldScale(_v2);
    h.scale.set(1 / _v2.x, 1 / _v2.y, 1 / _v2.z);
    return h;
  }

  // ---- W3: bone anchors + self-rendered jersey decals -----------------------
  const cw = new THREE.Vector3(0, 1.18 * dnaScale, 0);
  if (bones.chest) bones.chest.getWorldPosition(cw);
  // W12: offsets/clamps ride dnaScale so decals sit on the (re)sized chest
  const decalY = clamp(cw.y + 0.12 * dnaScale, 1.0 * dnaScale, 1.42 * dnaScale);
  const chestAnchor = holderOn('chest', 0, decalY - 0.04 * dnaScale, 0.27 * dnaScale);
  const backAnchor = holderOn('chest', 0, decalY, -0.31 * dnaScale);  // clears capes/cloaks — number prints ON the banner
  const glowCss = '#' + glow.getHexString();
  const rendersJersey = jerseyName != null || jerseyNumber != null;
  if (rendersJersey && backAnchor && chestAnchor) {
    const backM = new THREE.Mesh(geos().back, new THREE.MeshBasicMaterial({
      map: jerseyBackTexture(jerseyName || '', jerseyNumber ?? '', glowCss),
      transparent: true, depthWrite: false }));
    backM.rotation.y = Math.PI;
    backM.renderOrder = 998;
    backAnchor.add(backM);
    const chestM = new THREE.Mesh(geos().chest, new THREE.MeshBasicMaterial({
      map: jerseyChestTexture(jerseyNumber ?? '', glowCss),
      transparent: true, depthWrite: false }));
    chestM.renderOrder = 998;
    chestAnchor.add(chestM);
    ownedMaterials.push(backM.material, chestM.material);
  }

  // ---- W2+W12: flair / procedural DNA props (head-tracking world frame) ----
  // Accessory list = opts.flair ∪ flair-vocabulary entries of dna.props
  // (deduped). Skeletons take only the subset that reads on a skull
  // (mask/glasses/spikes/mohawk), sized up ~18% — KayKit skulls are bigger
  // than the human heads. 'scar' and unknown tags skip gracefully.
  const accessories = [];
  {
    const seen = new Set();
    for (const f of (flair || [])) if (!seen.has(f)) { seen.add(f); accessories.push(f); }
    if (dnaProps) for (const t of dnaProps)
      if (FLAIR_VOCAB.includes(t) && !seen.has(t)) { seen.add(t); accessories.push(t); }
  }
  const hw = new THREE.Vector3(0, 1.45, 0);
  if (bones.head) bones.head.getWorldPosition(hw);
  const headHolder = holderOn('head', hw.x, hw.y, hw.z);
  if (accessories.length && headHolder) {
    const H = 0.21 * baseScale * (isSkeleton ? 1.18 : 1); // head radius, world meters
    const hairHex = d && d.hairTint != null ? d.hairTint : null;
    const gm = glowMat(glow);                              // visor LEDs stay team glow
    const gmHair = hairHex != null ? hairMat(hairHex, true) : gm;  // mohawk/spikes
    const dm = hairHex != null ? hairMat(hairHex, false) : darkMat(); // matte hair
    const addBox = (mat, sx, sy, sz, x, y, z, rx = 0, rz = 0) => {
      const m = new THREE.Mesh(geos().box, mat);
      m.scale.set(sx, sy, sz); m.position.set(x, y, z);
      m.rotation.x = rx; m.rotation.z = rz;
      headHolder.add(m);
    };
    for (const f of accessories) {
      if (isSkeleton && !SKELETON_FLAIR_OK.has(f)) continue;
      if (f === 'mohawk') {
        for (let i = 0; i < 5; i++)
          addBox(gmHair, 0.2 * H, (0.9 - Math.abs(i - 2) * 0.14) * H, 0.42 * H,
            0, 2.15 * H, (0.72 - i * 0.37) * H);
      } else if (f === 'spikes') {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const m = new THREE.Mesh(geos().cone, gmHair);
          m.scale.set(0.22 * H, 0.55 * H, 0.22 * H);
          m.position.set(Math.sin(a) * 0.72 * H, 1.95 * H, Math.cos(a) * 0.72 * H);
          m.rotation.z = -Math.sin(a) * 0.55;
          m.rotation.x = Math.cos(a) * 0.55;
          headHolder.add(m);
        }
      } else if (f === 'fro') {
        const m = new THREE.Mesh(geos().sphere, dm);
        m.scale.setScalar(2.3 * H);
        m.position.set(0, 1.95 * H, -0.08 * H);
        headHolder.add(m);
      } else if (f === 'beard') {
        addBox(dm, 1.35 * H, 0.75 * H, 0.5 * H, 0, 0.28 * H, 0.78 * H);
      } else if (f === 'glasses') {
        addBox(gm, 2.05 * H, 0.3 * H, 0.12 * H, 0, 1.05 * H, 0.95 * H); // cyber visor band
      } else if (f === 'mask') {
        addBox(maskMat(), 1.65 * H, 0.72 * H, 0.34 * H, 0, 0.48 * H, 0.85 * H);
      } else if (f === 'braids' || f === 'dreads') {
        const n = f === 'dreads' ? 5 : 3;
        for (let i = 0; i < n; i++) {
          const m = new THREE.Mesh(geos().cyl, dm);
          m.scale.set(0.13 * H, 1.7 * H, 0.13 * H);
          m.position.set((i - (n - 1) / 2) * 0.34 * H, 1.15 * H, -0.82 * H);
          m.rotation.x = 0.4;
          headHolder.add(m);
        }
      }
      // 'scar' and anything unknown: skip gracefully
    }
  }

  // optional headband: glow torus on the head bone (bone space = raw model units)
  if (headband && bones.head) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.21, 0.025, 5, 14),
      new THREE.MeshBasicMaterial({ color: glow }));
    band.rotation.x = Math.PI / 2 - 0.2;
    band.position.y = 0.18;
    bones.head.add(band);
    ownedMaterials.push(band.material);
  }

  // optional captain armband: glow ring around the right upper arm
  if (captain && bones.upperarmr) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.105, 0.024, 5, 12),
      new THREE.MeshBasicMaterial({ color: glow }));
    band.rotation.x = Math.PI / 2;     // ring around the bone's long (y) axis
    band.position.y = 0.13;
    bones.upperarmr.add(band);
    ownedMaterials.push(band.material);
  }

  // ---- mixer + actions (created AFTER the neutral stance — see above) ------
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};                  // clip name -> AnimationAction
  function act(name) {
    let a = actions[name];
    if (!a) {
      const clip = clips[name];
      if (!clip) return null;
      a = mixer.clipAction(clip);
      a.enabled = true;
      a.setEffectiveWeight(0);
      a.play();
      actions[name] = a;
    }
    return a;
  }

  // per-rig personality: locomotion clip variants + desync phases.
  // Pool is restricted to Walking_A/B so pose loops (Walking_C for
  // limp/trudge) can never fight the gait scrubber for the same action.
  const seed = Math.random() * 1000;
  const runName = Math.sin(seed * 12.9898) > 0 ? 'Running_A' : 'Running_B';
  const walkName = Math.sin(seed * 7919) > 0 ? 'Walking_A' : 'Walking_B';
  const idleAct = act('Unarmed_Idle') || act('Idle');
  const walkAct = act(walkName);
  const runAct = act(runName);
  idleAct.setEffectiveWeight(1);
  idleAct.time = (seed % 1) * idleAct.getClip().duration;
  // walk/run are scrubbed in LOCKSTEP by the master gait clock in update()
  // (timeScale 0 — the mixer never advances them independently)
  walkAct.timeScale = 0; runAct.timeScale = 0;
  const walkDur = walkAct.getClip().duration;
  const runDur = runAct.getClip().duration;
  let gaitCyc = Math.random(); // master gait cycle; random start = per-rig stride desync

  // eagerly create every pose action we may use, so their PropertyMixer
  // bindings save the NEUTRAL original state now (a lazily-created action
  // mid-match would snapshot whatever random animated pose the bones were in)
  for (const n of ['Unarmed_Melee_Attack_Kick', 'Jump_Full_Short', 'Throw',
    'Death_A', 'Death_B', 'Lie_StandUp', 'Dodge_Left', 'Dodge_Right',
    'Dodge_Backward', 'Dodge_Forward', 'Running_Strafe_Left',
    'Running_Strafe_Right', 'Blocking', 'Block', 'PickUp',
    'Unarmed_Melee_Attack_Punch_A', 'Sit_Floor_Pose', 'Walking_C',
    'Jump_Idle', 'Cheer', 'Spellcast_Raise', 'Use_Item', 'Taunt']) act(n);

  // ---- pose request state (one pose call per frame, consumed by update) ----
  const poseWs = {};                   // clip name -> current blend weight
  const poseFull = {};                 // clip name -> requested as full-body
  let req = null;
  let reqFull = false;
  function scrubReq(name, k, maxK = 1, full = true) {
    if (!clips[name]) return;
    req = { name, scrub: clamp(k, 0, 1) * maxK, ts: 0 };
    reqFull = full;
  }
  function loopReq(name, ts = 1, full = true) {
    if (!clips[name]) return;
    req = { name, scrub: null, ts };
    reqFull = full;
  }

  // ---- procedural additive channels (applied AFTER the mixer) ----
  const channels = {};
  for (const n of PROC_BONES) {
    if (!bones[n]) continue;
    channels[n] = { bone: bones[n], e: new THREE.Euler(), w: 0, on: false };
  }
  function set(name, x, y, z) {
    const ch = channels[name];
    if (!ch) return;
    ch.e.set(x, y, z);
    ch.on = true;
  }
  // tilt node targets (ground-rooting; eased in update, never snaps)
  let tiltX = 0, tiltZ = 0, tiltY = 0, tiltActive = false;
  function setTilt(rx, rz, y) { tiltX = rx; tiltZ = rz; tiltY = y; tiltActive = true; }
  // squash & stretch on the inner node (this style is allowed to be FUNNIER):
  // poses set a per-frame target; update eases toward it and back to 1.
  let sqTarget = 1, sqS = 1;
  function setSquash(v) { sqTarget = clamp(v, 0.7, 1.25); }

  // ---- head look pivot (host writes rotation.y) ----
  const headPivot = new THREE.Object3D();
  group.add(headPivot);

  // ======================= POSES (clips first) =======================
  // Scrubbed: host drives k 0..1; we map it onto the clip timeline.

  function poseKick(k, legIndex, amp) {
    scrubReq('Unarmed_Melee_Attack_Kick', clamp(k, 0, 1));
    void legIndex; void amp; // the clip kicks with its baked leg; amp folded into host timing
    setTilt(0, 0, -0.03 * bell(k));
  }

  function poseHeader(k) {
    k = clamp(k, 0, 1);
    scrubReq('Jump_Full_Short', k);
    set('head', -0.35 * bell(clamp((k - 0.45) / 0.3, 0, 1)), 0, 0); // neck snap at apex
    if (k > 0.3 && k < 0.75) setSquash(1 + 0.08 * bell((k - 0.3) / 0.45)); // airborne stretch
  }

  function poseThrowIn(k) { scrubReq('Throw', clamp(k, 0, 1)); }

  let fallPrevK = 1, impactT = 99;     // one-shot landing squash trigger
  function poseFall(k) {
    k = clamp(k, 0, 1);
    scrubReq('Death_A', k);
    if (k >= 0.93 && fallPrevK < 0.93) impactT = 0; // hit the turf THIS frame
    fallPrevK = k;
  }

  function poseGetUp(k) {
    k = clamp(k, 0, 1);
    scrubReq('Lie_StandUp', k);
    fallPrevK = 0; // re-arm the fall impact for next time
    setSquash(lerp(0.92, 1, smooth(Math.min(1, k * 1.5)))); // un-pancake on the rise
  }

  // 4 distinct fun celebration variants, looped — host passes t + variant.
  // Skeletons swap the prop-mime for a TAUNT at the away end (rude. perfect.)
  const CELEB = ['Cheer', 'Spellcast_Raise', 'Jump_Idle', clips.Taunt ? 'Taunt' : 'Use_Item'];
  function poseCelebrate(t, variant) {
    const v = Math.abs(variant | 0) % 4;
    loopReq(CELEB[v], v === 0 ? 1.15 : v === 1 ? 0.9 : 1.05);
    if (v === 2) {              // airborne float pose: bounce it off the turf
      const hop = Math.abs(Math.sin(t * 6));
      setTilt(0, 0, hop * 0.32);
      setSquash(0.92 + hop * 0.18); // squash at the bounce, stretch at the top
    }
  }

  function poseSkill(move, k, side) {
    void side; // host owns yaw for dragback/roulette spins
    const name = move === 'stepover' ? 'Dodge_Left'
      : move === 'bodyfeint' ? 'Dodge_Right'
      : move === 'dragback' ? 'Dodge_Backward'
      : 'Dodge_Forward';        // roulette — host spins the yaw
    scrubReq(name, clamp(k, 0, 1));
  }

  // procedural arm flailing over locomotion idle — no good "argue" clip
  function poseArgue(t) {
    const fling = 0.5 + Math.max(0, Math.sin(t * 4)) * 0.5;
    set('upperarml', -0.5 - fling * 0.7, 0, 0.45 * fling);
    set('upperarmr', -0.5 - fling * 0.7, 0, -0.45 * fling);
    set('lowerarml', -0.5 + fling * 0.3, 0, 0);
    set('lowerarmr', -0.5 + fling * 0.3, 0, 0);
    set('spine', 0.18, 0, 0);
    set('head', -0.12, Math.sin(t * 5) * 0.25, 0);  // incredulous head shake
  }

  function poseShield(k, side) {
    void side;
    loopReq('Block', 0.8);
    set('spine', 0.12 * smooth(k), 0, 0);
  }

  // Death_B scrubbed only to 0.6 reads as a feet-first slide, not a death
  function poseSlideTackle(k, side) {
    void side;
    scrubReq('Death_B', clamp(k, 0, 1), 0.6);
  }

  function poseJockey(t, side) {
    void t;
    // strafe cadence tied to actual ground speed (lastSpd from the previous
    // update) — the old fixed 0.55 timeScale moonwalked the shuffle
    loopReq(side >= 0 ? 'Running_Strafe_Left' : 'Running_Strafe_Right',
      clamp(0.35 + lastSpd * 0.28, 0.35, 1.3));
    set('spine', 0.2, 0, 0);     // sunk low, eyes on the dribbler
  }

  function poseGKSet() { loopReq('Blocking', 0.9); }

  function poseGKCatch(k) { scrubReq('PickUp', clamp(k, 0, 1)); }

  function poseGKPunch(k) { scrubReq('Unarmed_Melee_Attack_Punch_A', clamp(k, 0, 1)); }

  // GK dive toward local ±X — procedural full-body over the airborne clip.
  // Explosive: fast roll onto the dive axis, arms shooting overhead.
  function poseDive(side, k) {
    k = clamp(k, 0, 1);
    const s = side >= 0 ? 1 : -1;
    loopReq('Jump_Idle', 1);                    // airborne base shape
    const u = smooth(Math.min(1, k * 1.6));     // commit FAST
    setTilt(0, -s * u * (Math.PI / 2 - 0.25), bell(k) * 0.45 - u * 0.25);
    setSquash(1 + 0.06 * u);                    // stretch into the reach
    set('upperarml', -2.6 * u, 0, 0.25 * u);   // both arms overhead along the axis
    set('upperarmr', -2.6 * u, 0, -0.25 * u);
    set('lowerarml', -0.15 * u, 0, 0);
    set('lowerarmr', -0.15 * u, 0, 0);
    set('spine', -0.2 * u, 0, s * 0.2 * u);     // arch into the stretch
    set('upperlegl', (s > 0 ? -0.3 : 0.4) * u, 0, 0);
    set('upperlegr', (s > 0 ? 0.4 : -0.3) * u, 0, 0);
  }

  function poseLimp(t, side) {
    const s = (side === undefined || side >= 0) ? 1 : -1;
    loopReq('Walking_C', clamp(0.3 + lastSpd * 0.35, 0.3, 0.8)); // hobble paced by real speed
    const dip = Math.max(0, Math.sin(t * 3.4));
    set('spine', 0.12 + dip * 0.08, 0, s * (0.1 + dip * 0.1)); // hip-dip shoulder lean
    set('head', 0.1, 0, -s * 0.06);
    setTilt(0, 0, -0.02 - dip * 0.03);          // body sinks on the bad step
  }

  function poseTrudge(t) {
    loopReq('Walking_C', clamp(0.25 + lastSpd * 0.3, 0.25, 0.6)); // dead-slow, speed-tied
    set('spine', 0.22, 0, Math.sin(t * 2) * 0.02);
    set('chest', 0.14, 0, 0);
    set('head', 0.5, Math.sin(t * 2) * 0.05, 0); // head hangs — sent off
  }

  // hands-on-knees heave over locomotion idle (partial: idle keeps it alive)
  function poseExhausted(t) {
    const breath = Math.sin(t * 2.6) * 0.5 + 0.5;
    set('spine', 0.55 + breath * 0.05, 0, 0);
    set('chest', 0.2 + breath * 0.04, 0, 0);
    set('head', -0.45 + breath * 0.08, 0, 0);    // gasping up for air
    set('upperarml', -0.55, 0, 0.1); set('upperarmr', -0.55, 0, -0.1);
    set('lowerarml', -0.25, 0, 0); set('lowerarmr', -0.25, 0, 0);
    setTilt(0, 0, -0.06);
  }

  // celebration knee slide: floor-sit pose clip + torso back-lean + arms wide
  function poseKneeSlide(k) {
    k = clamp(k, 0, 1);
    const u = smooth(Math.min(1, k / 0.3));
    const back = k > 0.3 ? smooth((k - 0.3) / 0.7) : 0;
    scrubReq('Sit_Floor_Pose', 0);               // held kneel/sit shape
    set('spine', -0.25 * u - back * 0.3, 0, 0);  // chest open to the sky
    set('head', -0.3 * u - back * 0.15, 0, 0);
    set('upperarml', -1.5 * u, 0, 0.7 * u);     // arms spread wide
    set('upperarmr', -1.5 * u, 0, -0.7 * u);
    setTilt(-0.1 * u - back * 0.12, 0, 0.06 * u);
  }

  // referee: firm point down-forward at the spot (procedural over idle)
  function posePointToSpot(t) {
    const firm = Math.min(1, t * 4);
    set('upperarmr', -1.05 * firm, 0, -0.15 * firm); // punched out, held
    set('lowerarmr', 0, 0, 0);
    set('spine', 0.12 * firm, -0.1 * firm, 0);
    set('head', 0.15 * firm, -0.1 * firm, 0);         // staring at the spot
  }

  // referee: whistle to the mouth, other arm up — play stops
  function poseWhistle(t) {
    const up = Math.min(1, t * 5);
    set('upperarmr', -0.7 * up, 0, -0.25 * up);
    set('lowerarmr', -1.9 * up, 0, 0);               // hand to the mouth
    set('upperarml', -2.4 * up, 0, 0.2 * up);        // raised: stop
    set('head', -0.06 * up, Math.sin(t * 0.9) * 0.15, 0);
  }

  // W7 ADDITIVE: referee brandishes a card aloft. Only refRigStep calls this
  // (feature-detected); never stamped into _poseDesc, so replays are
  // untouched. Procedural over idle + a glowing card mesh in the right hand.
  let cardMesh = null, cardW = 0, cardReq = false, cardRed = false;
  const cardHolder = holderOn('handr', hw.x * 0 + 0.0, Math.max(hw.y - 0.55, 0.8), 0.18);
  function poseShowCard(t, isRed) {
    const up = Math.min(1, t * 5);
    set('upperarmr', -2.7 * up, 0, -0.12 * up);   // arm rammed straight up
    set('lowerarmr', -0.2 * up, 0, 0);
    set('spine', -0.06 * up, 0.08 * up, 0);
    set('head', -0.18 * up, 0.1 * up, 0);          // eyes on the offender
    cardReq = true; cardRed = !!isRed;
  }

  function clearOverlay() {
    req = null;
    reqFull = false;
    tiltActive = false;
    cardReq = false;
    sqTarget = 1;
    for (const n in channels) channels[n].on = false;
  }

  // ======================= per-frame driver =======================
  let accelS = 0, turnS = 0;
  let lastSpd = 0;         // ground speed from the previous update (loop cadences)
  let _dither = false;     // alternating micro-offset defeats PropertyMixer's
                           // skip-identical-frame optimization (which would let
                           // the neutral reset win on held scrubs / dt=0 frames)

  function update(dt, speedNorm, opts) {
    _dither = !_dither;
    const dn = _dither ? 6e-4 : 0;
    const frozen = dt < 1e-6;            // W8: replay freeze-frames call update(0, 0)

    // reset to the NEUTRAL STANCE (not bind pose) so post-mixer writes never
    // accumulate frame-to-frame; the mixer then overwrites whatever it tracks
    for (let i = 0; i < neutral.length; i++) {
      const b = neutral[i];
      b.bone.quaternion.copy(b.q);
      b.bone.position.copy(b.p);
    }

    const s = clamp(speedNorm || 0, 0, 1);
    // locomotion crossfade: idle (s<0.06) -> walk (0.06..0.4) -> run (0.4..1)
    let wIdle, wWalk, wRun;
    if (s < 0.06) { wIdle = 1; wWalk = 0; wRun = 0; }
    else if (s < 0.4) { wWalk = (s - 0.06) / 0.34; wIdle = 1 - wWalk; wRun = 0; }
    else { wRun = (s - 0.4) / 0.6; wWalk = 1 - wRun; wIdle = 0; }

    // master gait clock: ONE phase scrubs BOTH walk and run (phase-locked, so
    // the blend band can't double-step), advanced from ACTUAL ground speed so
    // foot plants match ground displacement — no skating, no hand-tuned
    // timeScale. gaitPhase (= gaitCyc*2PI) is exposed on the rig; the host
    // mirrors it into p.stridePhase for footfall-timed ball touches.
    const spd = opts && opts.speed !== undefined ? Math.max(0, opts.speed) : s * HOST_MAX_SPEED;
    gaitCyc += clamp(spd / lerp(WALK_STRIDE, RUN_STRIDE, wRun), 0, 2.6) * dt;
    const cyc = gaitCyc % 1;
    walkAct.time = Math.min(cyc * walkDur + dn, walkDur);
    runAct.time = Math.min(cyc * runDur + dn, runDur);
    if (frozen) idleAct.time = (idleAct.time + 8e-5) % idleAct.getClip().duration;

    // pose action weights: requested name eases in, everything else eases out
    let fullPoseW = 0; // cumulative full-body pose influence this frame
    if (req) { poseWs[req.name] = poseWs[req.name] || 0; poseFull[req.name] = reqFull; }
    for (const name in poseWs) {
      const a = actions[name] || act(name);
      let w = poseWs[name];
      if (req && req.name === name) {
        w = Math.min(1, w + dt * BLEND_IN);
        if (req.scrub !== null) {           // host-scrubbed, paused clip
          a.paused = true;
          a.time = clamp(req.scrub * a.getClip().duration * 0.999 + dn, 0, a.getClip().duration);
        } else {                            // looped at the requested cadence
          a.paused = false;
          a.timeScale = req.ts;
          a.setLoop(THREE.LoopRepeat, Infinity);
          if (frozen) a.time = (a.time + 8e-5) % a.getClip().duration;
        }
      } else {
        w = Math.max(0, w - dt * BLEND_OUT);
        if (w === 0) { a.setEffectiveWeight(0); delete poseWs[name]; delete poseFull[name]; continue; }
      }
      poseWs[name] = w;
      a.setEffectiveWeight(smooth(w));
      if (poseFull[name]) fullPoseW += smooth(w);
    }

    // locomotion yields exactly the influence full poses currently claim, so
    // cumulative mixer weight never dips below 1 mid-crossfade; any residual
    // deficit (clip track-set mismatches) fills from the saved NEUTRAL
    // STANCE, not the bind T-pose — both halves of the no-T-pose guarantee.
    const locoW = Math.max(0, 1 - Math.min(1, fullPoseW));
    idleAct.setEffectiveWeight(wIdle * locoW);
    walkAct.setEffectiveWeight(wWalk * locoW);
    runAct.setEffectiveWeight(wRun * locoW);

    mixer.update(dt);

    // tilt node: ease toward pose targets / home when nothing claims it
    {
      const e = 1 - Math.exp(-(tiltActive ? 12 : 8) * dt);
      tilt.rotation.x += ((tiltActive ? tiltX : 0) - tilt.rotation.x) * e;
      tilt.rotation.z += ((tiltActive ? tiltZ : 0) - tilt.rotation.z) * e;
      tilt.position.y += ((tiltActive ? tiltY : 0) - tilt.position.y) * e;
    }

    // squash & stretch: one-shot turf-impact squash, then ease to the pose
    // target (default 1). Volume-ish preserving; eased, so zero snapping.
    impactT += dt;
    let sqT = sqTarget;
    if (impactT < 0.3) sqT = Math.min(sqT, 1 - 0.18 * bell(impactT / 0.3));
    sqS += (sqT - sqS) * (1 - Math.exp(-14 * dt));
    const wide = 1 + (1 - sqS) * 0.55;
    inner.scale.set(baseScale * wide, baseScale * sqS, baseScale * wide); // W12: dna body scale rides along

    // procedural additive channels AFTER the mixer (eased in/out per channel)
    for (const name in channels) {
      const ch = channels[name];
      if (ch.on) { ch.w = Math.min(1, ch.w + dt * BLEND_IN); ch.on = false; }
      else if (ch.w > 0) ch.w = Math.max(0, ch.w - dt * BLEND_OUT);
      if (ch.w > 0) {
        _q.setFromEuler(ch.e);
        _q2.copy(_qid).slerp(_q, smooth(ch.w));
        ch.bone.quaternion.multiply(_q2);
      }
    }

    // additive lean/bank from host accel/turn estimates (smoothed; loco only)
    const addGate = locoW;
    if (addGate > 0.02 && bones.spine) {
      const targetA = opts && opts.accel !== undefined ? clamp(opts.accel, -1, 1) : 0;
      const targetT = opts && opts.turn !== undefined ? clamp(opts.turn, -1, 1) : 0;
      const ke = 1 - Math.exp(-6 * dt);
      accelS += (targetA - accelS) * ke;
      turnS += (targetT - turnS) * ke;
      const lean = accelS * 0.2 * (0.25 + 0.75 * s) * addGate;
      const bank = -turnS * 0.18 * s * addGate;
      if (Math.abs(lean) > 1e-3 || Math.abs(bank) > 1e-3) {
        _e.set(lean * 0.6, turnS * 0.06 * s * addGate, bank);
        bones.spine.quaternion.multiply(_q.setFromEuler(_e));
        if (bones.chest) {
          _e.set(lean * 0.4, 0, bank * 0.5);
          bones.chest.quaternion.multiply(_q.setFromEuler(_e));
        }
      }
    }

    // head look: host writes headPivot.rotation.y -> clamped yaw on the head bone
    const look = clamp(headPivot.rotation.y, -1.1, 1.1);
    if (bones.head && Math.abs(look) > 0.001) {
      _q2.setFromAxisAngle(_YAXIS, look);
      bones.head.quaternion.multiply(_q2);
    }

    // referee card: pop in while poseShowCard is being called, fade out after
    cardW += ((cardReq ? 1 : 0) - cardW) * (1 - Math.exp(-12 * dt));
    if (cardReq && !cardMesh && cardHolder) {
      cardMesh = new THREE.Mesh(geos().card,
        new THREE.MeshBasicMaterial({ color: 0xffe14d, side: THREE.DoubleSide }));
      cardHolder.add(cardMesh);
      ownedMaterials.push(cardMesh.material);
    }
    if (cardMesh) {
      cardMesh.visible = cardW > 0.03;
      cardMesh.material.color.set(cardRed ? 0xff3b30 : 0xffe14d);
      const cs = 0.6 + 0.4 * smooth(cardW);
      cardMesh.scale.set(cs, cs, cs);
    }

    // consume this frame's pose request (host re-arms next frame)
    req = null;
    reqFull = false;
    tiltActive = false;
    cardReq = false;
    sqTarget = 1;
    lastSpd = spd;
  }

  function dispose() {
    for (const m of ownedMaterials) m.dispose(); // shared cached mats stay alive for other rigs
    mixer.stopAllAction();
    mixer.uncacheRoot(model);
  }

  return {
    group,
    headPivot,
    anchors: {
      // legacy static fallback (host rotates back plane PI) — W12: offsets
      // ride dnaScale; tagY floors at 2.15 so small players' plates never
      // shave the hair/headgear of the 1.9u silhouette
      back: { x: 0, y: 1.25 * dnaScale, z: -0.25 * dnaScale },
      chest: { x: 0, y: 1.3 * dnaScale, z: 0.25 * dnaScale },
      tagY: Math.max(2.15, 2.4 * dnaScale), // floating nameplate sprite height
    },
    // W3: rig renders its own jersey when the host passed jerseyName/Number —
    // host then SKIPS its legacy number planes; boneAnchors are chest-bone-
    // parented Object3Ds (world-axis-aligned, unit-world-scaled at neutral)
    // for host-parented planes on rigs that don't self-render.
    rendersJersey,
    boneAnchors: (chestAnchor && backAnchor) ? { chest: chestAnchor, back: backAnchor } : undefined,
    // contract C2 (gait): radians, monotonic, advanced from actual ground
    // speed in update(); a foot plants roughly every PI. Host mirrors it
    // into p.stridePhase after rig.update.
    get gaitPhase() { return gaitCyc * Math.PI * 2; },
    update,
    poseKick, poseThrowIn, poseDive, poseFall, poseGetUp,
    poseCelebrate, poseSkill, poseArgue, poseShield,
    poseSlideTackle, poseHeader, poseJockey,
    poseGKSet, poseGKCatch, poseGKPunch,
    poseLimp, poseTrudge, poseExhausted, poseKneeSlide,
    posePointToSpot, poseWhistle, poseShowCard,
    clearOverlay, dispose,
    _debug: { mixer, actions, poseWs },
  };
}
