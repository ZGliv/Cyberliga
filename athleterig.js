/**
 * athleterig.js — procedural, modular soccer athletes for the soccer-first era.
 *
 * `buildAthleteRig({ athlete, skin })` returns a ground-rooted Three.js rig whose
 * +Z axis is forward. Athlete DNA owns identity/proportions; `applySkin()` owns
 * the replaceable kit, print, goalkeeper equipment, and accessories. Geometry is
 * module-cached and intentionally low-poly so a broadcast scene can field 14 rigs.
 *
 * Public API: { group, headPivot, anchors, ready, update, setAction,
 * setBallContext, getState, consumeContact, applySkin, setDetailLevel, dispose }.
 * The original methods remain backwards compatible. `motion` may additionally
 * provide real speed in metres/second, accel/turn (-1..1), gaitPhase (0..1),
 * airborne (0..1), intensity (0..1), a world-space ball/gaze target, and a
 * carrier flag. Actions: idle, run, kick, receive, celebrate, tackle, fall,
 * keeper-ready, dive, and header (common aliases are accepted).
 */
import * as THREE from 'three';

// A production skinned athlete is an authored art dependency, not something we
// can honestly synthesize from primitives at runtime. These hooks let a future
// universal-skeleton glTF/GLB replace the procedural renderer without changing the
// match API. Until a model URL *and* an adapter are supplied, the improved
// procedural athlete below is the deliberate, visible fallback.
const PREMIUM_MODEL_CACHE = new Map();
let registeredPremiumAdapter = null;

export const UNIVERSAL_ATHLETE_MODELS = Object.freeze({
  masculine: 'assets/athletes/universal/Superhero_Male_FullBody.gltf',
  feminine: 'assets/athletes/universal/Superhero_Female_FullBody.gltf',
});

const UNIVERSAL_BONE_NAMES = Object.freeze([
  'root', 'pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head',
  'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l',
  'clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r',
  'thigh_l', 'calf_l', 'foot_l', 'ball_l',
  'thigh_r', 'calf_r', 'foot_r', 'ball_r',
]);

/** Return the canonical bone map and any missing requirements for an adapter. */
export function inspectAthleteModel(gltf) {
  const scene = gltf?.scene || gltf?.scenes?.[0];
  const bones = {};
  scene?.traverse?.((node) => {
    if (UNIVERSAL_BONE_NAMES.includes(node.name)) bones[node.name] = node;
  });
  const missing = UNIVERSAL_BONE_NAMES.filter((name) => !bones[name]);
  return { valid: !!scene && missing.length === 0, scene, bones, missing, animations: gltf?.animations || [] };
}

/** Warm both bundled CC0 source meshes without opting the live match into them. */
export function preloadUniversalAthleteModels() {
  return Promise.all(Object.values(UNIVERSAL_ATHLETE_MODELS).map((url) => preloadAthleteModel(url)));
}

export function universalAthleteModelUrl(profile = 'masculine') {
  const key = String(profile || '').toLowerCase();
  return /feminine|female|woman/.test(key)
    ? UNIVERSAL_ATHLETE_MODELS.feminine : UNIVERSAL_ATHLETE_MODELS.masculine;
}

/** Register an app-wide adapter with a `bind({ gltf, rig, options, THREE })` method. */
export function registerAthleteModelAdapter(adapter) {
  if (adapter !== null && typeof adapter?.bind !== 'function') {
    throw new TypeError('Athlete model adapter must expose bind(context).');
  }
  registeredPremiumAdapter = adapter;
  return adapter;
}

/** Load and cache a genuine authored glTF/GLB. This does not manufacture a fake asset. */
export function preloadAthleteModel(url) {
  const source = String(url || '').trim();
  if (!source) return Promise.reject(new TypeError('A premium athlete model URL is required.'));
  if (!PREMIUM_MODEL_CACHE.has(source)) {
    PREMIUM_MODEL_CACHE.set(source, import('three/addons/loaders/GLTFLoader.js')
      .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(source))
      .catch((error) => {
        PREMIUM_MODEL_CACHE.delete(source);
        throw error;
      }));
  }
  return PREMIUM_MODEL_CACHE.get(source);
}

function regionOverlay(source, name, predicate, material, inflate, THREE_NS) {
  const geometry = source.geometry.clone();
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  const sourceIndex = geometry.index?.array;
  if (!positions || !sourceIndex) return null;
  const kept = [];
  for (let index = 0; index < sourceIndex.length; index += 3) {
    const a = sourceIndex[index];
    const b = sourceIndex[index + 1];
    const c = sourceIndex[index + 2];
    const x = (positions.getX(a) + positions.getX(b) + positions.getX(c)) / 3;
    const y = (positions.getY(a) + positions.getY(b) + positions.getY(c)) / 3;
    const z = (positions.getZ(a) + positions.getZ(b) + positions.getZ(c)) / 3;
    if (predicate(x, y, z)) kept.push(a, b, c);
  }
  if (!kept.length) {
    geometry.dispose();
    return null;
  }
  if (normals && inflate) {
    const used = new Set(kept);
    for (const vertex of used) {
      positions.setXYZ(
        vertex,
        positions.getX(vertex) + normals.getX(vertex) * inflate,
        positions.getY(vertex) + normals.getY(vertex) * inflate,
        positions.getZ(vertex) + normals.getZ(vertex) * inflate,
      );
    }
    positions.needsUpdate = true;
  }
  geometry.setIndex(kept);
  geometry.clearGroups();
  geometry.computeBoundingSphere();
  const overlay = new THREE_NS.SkinnedMesh(geometry, material);
  overlay.name = name;
  overlay.bindMode = source.bindMode;
  overlay.bind(source.skeleton, source.bindMatrix);
  overlay.position.copy(source.position);
  overlay.quaternion.copy(source.quaternion);
  overlay.scale.copy(source.scale);
  overlay.castShadow = true;
  overlay.receiveShadow = true;
  overlay.frustumCulled = false;
  overlay.renderOrder = (source.renderOrder || 0) + 1;
  source.parent.add(overlay);
  return overlay;
}

/**
 * Adapter for the bundled CC0 universal meshes. It uses additive bone poses
 * from the same deterministic state as the fallback and adds thin skinned kit
 * shells extracted from the base topology. This is intentionally conservative:
 * it does not pretend the source contains animation clips or garment morphs.
 */
export function createUniversalAthleteAdapter() {
  return {
    async bind({ gltf, rig, athlete, skin, THREE: THREE_NS }) {
      const audit = inspectAthleteModel(gltf);
      if (!audit.valid) throw new Error(`Universal athlete skeleton missing: ${audit.missing.join(', ')}`);
      const { clone } = await import('three/addons/utils/SkeletonUtils.js');
      const model = clone(audit.scene);
      const bones = {};
      model.traverse((node) => {
        if (UNIVERSAL_BONE_NAMES.includes(node.name)) bones[node.name] = node;
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          if (node.material) node.material = node.material.clone();
        }
      });
      const body = model.getObjectByName('SuperHero_Male') || model.getObjectByName('Superhero_Female');
      if (!body?.isSkinnedMesh) throw new Error('Universal athlete body mesh was not found.');

      body.geometry.computeBoundingBox();
      const sourceBox = body.geometry.boundingBox;
      const sourceHeight = Math.max(0.001, sourceBox.max.y - sourceBox.min.y);
      const outerScale = Math.max(0.0001, rig.group.scale.y || 1);
      const targetHeight = (rig.group.userData.athleteDNA?.height || 1.82) / outerScale;
      const modelScale = targetHeight / sourceHeight;
      model.scale.setScalar(modelScale);
      model.position.y = -sourceBox.min.y * modelScale;
      const baseModelY = model.position.y;
      model.name = 'universal-authored-athlete';

      const rest = {};
      const restScale = {};
      for (const [name, bone] of Object.entries(bones)) rest[name] = bone.quaternion.clone();
      for (const [name, bone] of Object.entries(bones)) restScale[name] = bone.scale.clone();
      const face = athlete.face || {};
      const premiumFaceWidth = clamp(athlete.faceWidth ?? face.headWidth ?? 1, 0.90, 1.10);
      const premiumFaceLength = clamp(athlete.faceLength ?? face.faceLength ?? 1, 0.92, 1.09);
      if (bones.Head) {
        bones.Head.scale.set(
          restScale.Head.x * premiumFaceWidth,
          restScale.Head.y * premiumFaceLength,
          restScale.Head.z * THREE_NS.MathUtils.lerp(1, premiumFaceWidth, 0.72),
        );
      }
      if (body.material?.color) {
        const authoredTone = toneColor(athlete.skinTone).lerp(new THREE_NS.Color(0xffffff), .38);
        body.material.color.copy(authoredTone);
        body.material.needsUpdate = true;
      }

      // The bundled source deliberately ships a universal body, so identity
      // hair is assembled from the same deterministic vocabulary as the
      // procedural fallback. Keeping it bone-parented makes ponytails, bobs,
      // curls and crops follow every authored head turn instead of leaving the
      // premium path as fourteen near-identical bald clones.
      const authoredHairColor = valueColor(athlete.hairColor, 0x17120f);
      const premiumHairMaterial = new THREE_NS.MeshStandardMaterial({
        color:authoredHairColor, roughness:.86, metalness:0,
      });
      const premiumHair = addHair(
        bones.Head,
        athlete.hairStyle ?? athlete.hair ?? 'crop',
        premiumHairMaterial,
        .108 * premiumFaceWidth,
        hash(athlete.id ?? athlete.name ?? 'athlete') * TAU,
      );
      premiumHair.position.y = .082;
      const authoredBrows = model.getObjectByName('Eyebrows');
      if (authoredBrows?.material?.color) {
        authoredBrows.material.color.copy(authoredHairColor);
        authoredBrows.material.needsUpdate = true;
      }

      const delta = new THREE_NS.Quaternion();
      const euler = new THREE_NS.Euler();
      const applyBone = (name, x = 0, y = 0, z = 0) => {
        const bone = bones[name];
        if (!bone || !rest[name]) return;
        delta.setFromEuler(euler.set(x, y, z, 'XYZ'));
        bone.quaternion.copy(rest[name]).multiply(delta);
      };

      const kitMaterials = {
        jersey: new THREE_NS.MeshStandardMaterial({ color: 0xffffff, roughness: 0.66, metalness: 0.015, polygonOffset:true, polygonOffsetFactor:-1 }),
        shorts: new THREE_NS.MeshStandardMaterial({ color: 0x171a22, roughness: 0.72, metalness: 0.01, polygonOffset:true, polygonOffsetFactor:-1 }),
        socks: new THREE_NS.MeshStandardMaterial({ color: 0xf1f3f5, roughness: 0.78, metalness: 0, polygonOffset:true, polygonOffsetFactor:-1 }),
        boots: new THREE_NS.MeshStandardMaterial({ color: 0x101218, roughness: 0.46, metalness: 0.04, polygonOffset:true, polygonOffsetFactor:-1 }),
        trim: new THREE_NS.MeshStandardMaterial({ color: 0xec2b66, roughness: 0.58, metalness: 0.025, polygonOffset:true, polygonOffsetFactor:-2 }),
      };
      const overlays = [
        regionOverlay(body, 'premium-jersey-shell', (x, y) => y > 0.79 && y < 1.57 && (Math.abs(x) < 0.46 || (y > 1.02 && Math.abs(x) < 0.53)), kitMaterials.jersey, 0, THREE_NS),
        regionOverlay(body, 'premium-shorts-shell', (x, y) => y > 0.47 && y <= 0.73 && Math.abs(x) < 0.36, kitMaterials.shorts, 0, THREE_NS),
        regionOverlay(body, 'premium-socks-shell', (x, y) => y > 0.10 && y <= 0.52 && Math.abs(x) < 0.34, kitMaterials.socks, 0, THREE_NS),
        regionOverlay(body, 'premium-boots-shell', (x, y) => y <= 0.14 && Math.abs(x) < 0.34, kitMaterials.boots, 0, THREE_NS),
        regionOverlay(body, 'premium-collar-trim', (x, y) => y > 1.50 && y < 1.59 && Math.abs(x) < 0.30, kitMaterials.trim, 0, THREE_NS),
        regionOverlay(body, 'premium-sleeve-cuffs', (x, y) => y > 1.02 && Math.abs(x) > 0.47 && Math.abs(x) < 0.56, kitMaterials.trim, 0, THREE_NS),
        regionOverlay(body, 'premium-jersey-hem', (x, y) => y > 0.77 && y < 0.84 && Math.abs(x) < 0.38, kitMaterials.trim, 0, THREE_NS),
        regionOverlay(body, 'premium-sock-cuffs', (x, y) => y > 0.47 && y < 0.54 && Math.abs(x) < 0.34, kitMaterials.trim, 0, THREE_NS),
      ].filter(Boolean);

      let currentDetail = 'auto';
      function applySkin(next = {}, renderAssets = {}) {
        const jersey = next.jersey && typeof next.jersey === 'object' ? next.jersey : {};
        const palette = next.palette || {};
        const baseColor = new THREE_NS.Color(jersey.baseColor ?? palette.base ?? next.primary ?? 0xf1f3f5);
        const baseLuminance = baseColor.r * .299 + baseColor.g * .587 + baseColor.b * .114;
        kitMaterials.jersey.color.copy(baseColor);
        kitMaterials.shorts.color.set(next.shorts?.baseColor ?? palette.shorts ?? next.secondary ?? 0x171a22);
        kitMaterials.socks.color.set(next.socks?.baseColor ?? palette.socks ?? next.primary ?? 0xf1f3f5);
        kitMaterials.boots.color.set(next.bootColor ?? next.boots?.defaultColor ?? athlete.bootColor ?? 0x101218);
        kitMaterials.trim.color.set(jersey.trimColor ?? palette.trim ?? palette.accent ?? next.accent ?? 0xec2b66);
        const darkKit = baseLuminance < .24;
        // Dark kits should remain genuinely dark, but the broadcast silhouette
        // still needs to survive a charcoal pitch. A restrained accent bounce on
        // the cloth plus brighter physical cuffs reads like stadium rim light,
        // rather than recolouring the garment or drawing a gamey outline.
        kitMaterials.jersey.emissive.copy(darkKit ? kitMaterials.trim.color : baseColor);
        kitMaterials.jersey.emissiveIntensity = darkKit ? .075 : .012;
        kitMaterials.shorts.emissive.copy(darkKit ? kitMaterials.trim.color : baseColor);
        kitMaterials.shorts.emissiveIntensity = darkKit ? .035 : 0;
        kitMaterials.socks.emissive.copy(darkKit ? kitMaterials.trim.color : baseColor);
        kitMaterials.socks.emissiveIntensity = darkKit ? .055 : 0;
        kitMaterials.trim.emissive.copy(kitMaterials.trim.color);
        kitMaterials.trim.emissiveIntensity = darkKit ? .34 : .10;
        kitMaterials.jersey.map = renderAssets.jerseyMap || null;
        if (kitMaterials.jersey.map) {
          kitMaterials.jersey.map.needsUpdate = true;
          kitMaterials.jersey.color.set(0xffffff);
        }
        for (const material of Object.values(kitMaterials)) material.needsUpdate = true;
      }

      function update(state) {
        const pose = state.pose || {};
        applyBone('pelvis', pose.hipsRX * 0.65, pose.hipsRY * 0.65, pose.hipsRZ * 0.65);
        applyBone('spine_01', pose.torsoRX * 0.28, pose.torsoRY * 0.20, pose.torsoRZ * 0.24);
        applyBone('spine_02', pose.torsoRX * 0.34, pose.torsoRY * 0.32, pose.torsoRZ * 0.34);
        applyBone('spine_03', pose.torsoRX * 0.34, pose.torsoRY * 0.42, pose.torsoRZ * 0.42);
        applyBone('Head', pose.headRX * 0.75, pose.headRY * 0.82, pose.headRZ * 0.78);
        applyBone('upperarm_l', pose.lArmX, pose.lArmY, pose.lArmZ - 1.22);
        applyBone('upperarm_r', pose.rArmX, pose.rArmY, pose.rArmZ + 1.22);
        applyBone('lowerarm_l', pose.lElbowX, 0, pose.lElbowZ);
        applyBone('lowerarm_r', pose.rElbowX, 0, pose.rElbowZ);
        applyBone('thigh_l', pose.lLegX, pose.lLegY, pose.lLegZ);
        applyBone('thigh_r', pose.rLegX, pose.rLegY, pose.rLegZ);
        applyBone('calf_l', -pose.lKneeX, 0, pose.lKneeZ);
        applyBone('calf_r', -pose.rKneeX, 0, pose.rKneeZ);
        applyBone('foot_l', pose.lAnkleX, 0, 0);
        applyBone('foot_r', pose.rAnkleX, 0, 0);
        model.position.x = pose.rootX || 0;
        model.position.y = baseModelY + (pose.rootY || 0);
        model.position.z = pose.rootZ || 0;
        model.rotation.x = pose.rootRX || 0;
        model.rotation.y = pose.rootRY || 0;
        model.rotation.z = pose.rootRZ || 0;
      }

      function setDetailLevel(level) {
        currentDetail = level;
        const show = level !== 'low';
        model.visible = show;
      }

      function dispose() {
        for (const overlay of overlays) overlay.geometry.dispose();
        for (const material of Object.values(kitMaterials)) material.dispose();
        model.traverse((node) => {
          if (!node.isMesh || overlays.includes(node)) return;
          node.material?.dispose?.();
        });
        model.removeFromParent();
      }

      applySkin(skin || {});
      return {
        group: model,
        quality: 'source-mesh-preview',
        limitations: ['procedural-bone-motion', 'no-authored-clips', 'topology-derived-kit-shell', 'fixed-source-face-texture'],
        anchors: {
          head: bones.Head,
          leftHand: bones.hand_l,
          rightHand: bones.hand_r,
          leftFoot: bones.ball_l || bones.foot_l,
          rightFoot: bones.ball_r || bones.foot_r,
          leftSole: bones.foot_l,
          rightSole: bones.foot_r,
        },
        update, applySkin, setDetailLevel, dispose,
        get detailLevel() { return currentDetail; },
      };
    },
  };
}

const TAU = Math.PI * 2;
const clamp01 = (v) => THREE.MathUtils.clamp(Number.isFinite(v) ? v : 0, 0, 1);
const clamp = (v, lo, hi) => THREE.MathUtils.clamp(Number.isFinite(v) ? v : lo, lo, hi);
const smooth = (v) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
const range = (v, a, b) => smooth((v - a) / Math.max(1e-5, b - a));
const beat = (v, start, peak, end) => {
  if (v <= start || v >= end) return 0;
  return v < peak ? smooth((v - start) / (peak - start)) : 1 - smooth((v - peak) / (end - peak));
};
const hash = (value) => {
  const str = String(value ?? 'athlete');
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
};

const ACTION_CONTACTS = Object.freeze({
  kick: { at: 0.50, kind: 'boot-strike', socket: 'foot' },
  receive: { at: 0.51, kind: 'first-touch', socket: 'foot' },
  tackle: { at: 0.50, kind: 'tackle-contact', socket: 'foot' },
  header: { at: 0.61, kind: 'header-contact', socket: 'head' },
  dive: { at: 0.53, kind: 'keeper-contact', socket: 'hand' },
  'keeper-catch': { at: 0.52, kind: 'keeper-catch', socket: 'hand' },
  'throw-in': { at: 0.55, kind: 'throw-release', socket: 'hand' },
});

function vectorLike(value, target) {
  if (!value) return null;
  if (value.isVector3) return target.copy(value);
  if (Array.isArray(value) && value.length >= 3) {
    return target.set(Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0);
  }
  if (Number.isFinite(value.x) && Number.isFinite(value.z)) {
    return target.set(value.x, Number(value.y) || 0, value.z);
  }
  return null;
}

function pointRecord(point) {
  return { x: +point.x.toFixed(4), y: +point.y.toFixed(4), z: +point.z.toFixed(4) };
}

// Geometries are immutable and shared between every athlete. dispose() only
// releases per-rig materials and label textures; these tiny module assets live
// for the page lifetime and avoid 14 copies of the same vertex buffers.
const GEO = {
  sphere: new THREE.SphereGeometry(1, 12, 8),
  sphereLow: new THREE.SphereGeometry(1, 8, 6),
  joint: new THREE.SphereGeometry(1, 8, 6),
  torso: new THREE.LatheGeometry([
    new THREE.Vector2(0.58, -0.50),
    new THREE.Vector2(0.56, -0.30),
    new THREE.Vector2(0.64, 0.06),
    new THREE.Vector2(0.73, 0.30),
    new THREE.Vector2(0.78, 0.42),
    new THREE.Vector2(0.58, 0.50),
  ], 14),
  // Match-facing forms trade mannequin joints for a continuous, faceted
  // football silhouette. They remain cheap primitives, but the shoulder,
  // waist and hip transitions read as cloth over a person at broadcast LOD.
  broadcastTorso: new THREE.LatheGeometry([
    new THREE.Vector2(0.64, -0.50),
    new THREE.Vector2(0.60, -0.31),
    new THREE.Vector2(0.69, 0.02),
    new THREE.Vector2(0.82, 0.28),
    new THREE.Vector2(0.86, 0.42),
    new THREE.Vector2(0.58, 0.50),
  ], 18),
  broadcastPelvis: new THREE.LatheGeometry([
    new THREE.Vector2(0.78, -0.50),
    new THREE.Vector2(0.86, -0.10),
    new THREE.Vector2(0.84, 0.25),
    new THREE.Vector2(0.72, 0.50),
  ], 14),
  pelvis: new THREE.CylinderGeometry(0.68, 0.78, 1, 8, 1, false),
  upperLimb: new THREE.CylinderGeometry(0.82, 1, 1, 8, 1, false),
  lowerLimb: new THREE.CylinderGeometry(0.55, 0.86, 1, 8, 1, false),
  humanLimb: new THREE.CylinderGeometry(1, 0.72, 1, 10, 1, false),
  humanShort: new THREE.CylinderGeometry(1, 0.86, 1, 10, 1, false),
  neck: new THREE.CylinderGeometry(1, 1.08, 1, 8, 1, false),
  box: new THREE.BoxGeometry(1, 1, 1),
  plane: new THREE.PlaneGeometry(1, 1),
  hairCap: new THREE.SphereGeometry(1, 14, 7, 0, TAU, 0, Math.PI * 0.49),
  torus: new THREE.TorusGeometry(1, 0.12, 5, 14),
  cone: new THREE.ConeGeometry(1, 1, 6),
  disc: new THREE.CircleGeometry(1, 12),
};

const BUILD_PRESETS = {
  lean: { shoulder: 0.94, chest: 0.91, waist: 0.91, hip: 0.92, limb: 0.90, depth: 0.92 },
  rangy: { shoulder: 0.97, chest: 0.94, waist: 0.91, hip: 0.94, limb: 0.92, depth: 0.94 },
  balanced: { shoulder: 1, chest: 1, waist: 1, hip: 1, limb: 1, depth: 1 },
  athletic: { shoulder: 1.05, chest: 1.04, waist: 0.97, hip: 1, limb: 1.03, depth: 1.03 },
  compact: { shoulder: 1.06, chest: 1.06, waist: 1.03, hip: 1.05, limb: 1.06, depth: 1.06 },
  powerful: { shoulder: 1.12, chest: 1.12, waist: 1.06, hip: 1.08, limb: 1.12, depth: 1.10 },
  power: { shoulder: 1.12, chest: 1.12, waist: 1.06, hip: 1.08, limb: 1.12, depth: 1.10 },
};

const SKIN_TONES = [0x5a321f, 0x7b4930, 0x9a6243, 0xbd815e, 0xd8a27e, 0xe8b994, 0xf1c9a9];
const DEFAULT_SKIN = {
  primary: 0xf1f3f5,
  secondary: 0x171a22,
  accent: 0xec2b66,
  shorts: 0x171a22,
  socks: 0xf1f3f5,
  boots: 0x11131a,
  bootAccent: 0xec2b66,
  goalkeeperGloves: 0xf4f7ff,
  pattern: 'signal',
  number: null,
  name: '',
  crest: '',
};

function valueColor(value, fallback) {
  if (value && value.isColor) return value.clone();
  try { return new THREE.Color(value ?? fallback); } catch (_) { return new THREE.Color(fallback); }
}

function toneColor(value) {
  if (value && value.isColor) return value.clone();
  if (typeof value === 'string') return valueColor(value, SKIN_TONES[4]);
  if (Number.isFinite(value) && value > 1) return valueColor(value, SKIN_TONES[4]);
  const t = clamp01(Number.isFinite(value) ? value : 0.62) * (SKIN_TONES.length - 1);
  const lo = Math.floor(t);
  const hi = Math.min(SKIN_TONES.length - 1, lo + 1);
  return new THREE.Color(SKIN_TONES[lo]).lerp(new THREE.Color(SKIN_TONES[hi]), t - lo);
}

function setMaterialColor(material, value, fallback) {
  const c = valueColor(value, fallback);
  material.color.copy(c);
  return c;
}

function setEmissive(material, value, intensity = 0) {
  if (!material.emissive) return;
  material.emissive.copy(valueColor(value, 0x000000));
  material.emissiveIntensity = intensity;
}

function accessoryColor(description, fallback) {
  const text = String(description || '').toLowerCase();
  const swatches = {
    black: 0x090a0d, navy: 0x0b1d35, white: 0xf4f7f8, pearl: 0xeee9e2,
    silver: 0xc8cdd3, cream: 0xf4e8d2, gold: 0xe9a65f, violet: 0x7655a8,
    magenta: 0xf20a72, orange: 0xff5a00, red: 0xea493f, coral: 0xff6b5e,
    cyan: 0x18d9ec, ember: 0xff3d0a,
  };
  for (const [word, color] of Object.entries(swatches)) if (text.includes(word)) return new THREE.Color(color);
  return valueColor(fallback, DEFAULT_SKIN.accent);
}

function mesh(geometry, material, name, scale, position) {
  const out = new THREE.Mesh(geometry, material);
  out.name = name;
  const microDetail = /eye|nose|ear|panel|collar|cuff|band|tape|accent|sole/.test(name);
  out.castShadow = !microDetail;
  out.receiveShadow = !/eye|nose|ear|tape|accent|sole/.test(name);
  if (scale) out.scale.set(scale[0], scale[1], scale[2]);
  if (position) out.position.set(position[0], position[1], position[2]);
  out.userData.athletePart = name;
  return out;
}

function joint(parent, name, position) {
  const out = new THREE.Group();
  out.name = name;
  out.position.set(position[0], position[1], position[2]);
  parent.add(out);
  return out;
}

function addNearDetails(parent, details, distance = 10) {
  const lod = new THREE.LOD();
  lod.name = 'athlete-detail-lod';
  const near = new THREE.Group();
  near.name = 'near-details';
  near.add(...details);
  lod.addLevel(near, 0);
  lod.addLevel(new THREE.Group(), distance);
  parent.add(lod);
  return lod;
}

function labelSurface(width, height, name) {
  const node = new THREE.Group();
  node.name = name;
  const mat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const plate = new THREE.Mesh(GEO.plane, mat);
  plate.name = `${name}-surface`;
  plate.scale.set(width, height, 1);
  plate.renderOrder = 20;
  node.add(plate);
  return { node, plate, material: mat, canvas: null, context: null, texture: null };
}

function makeCanvas(size) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(size, size);
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    return canvas;
  }
  return null;
}

function ensureCanvasLabel(label, size = 256) {
  if (label.canvas) return true;
  const canvas = makeCanvas(size);
  if (!canvas) return false;
  label.canvas = canvas;
  label.context = canvas.getContext('2d');
  label.texture = new THREE.CanvasTexture(canvas);
  if ('colorSpace' in label.texture) label.texture.colorSpace = THREE.SRGBColorSpace;
  label.texture.anisotropy = 2;
  return !!label.context;
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawNumberLabel(label, number, name, darkInk, back = false, inkOverride = null, outlineOverride = null) {
  if (!ensureCanvasLabel(label)) return;
  const ctx = label.context;
  const s = label.canvas.width;
  ctx.clearRect(0, 0, s, s);
  if (number === null || number === undefined || number === '') {
    label.material.opacity = 0;
    return;
  }
  const ink = inkOverride || (darkInk ? '#0a0c12' : '#f8fbff');
  const keyline = outlineOverride || (darkInk ? 'rgba(255,255,255,.72)' : 'rgba(5,7,13,.78)');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (back && name) {
    ctx.font = `700 ${Math.round(s * 0.13)}px system-ui, sans-serif`;
    ctx.letterSpacing = `${s * 0.01}px`;
    ctx.strokeStyle = keyline;
    ctx.lineWidth = s * 0.022;
    ctx.fillStyle = ink;
    ctx.strokeText(String(name).toUpperCase().slice(0, 14), s * 0.5, s * 0.18);
    ctx.fillText(String(name).toUpperCase().slice(0, 14), s * 0.5, s * 0.18);
  }
  ctx.font = `900 ${Math.round(s * (back ? 0.62 : 0.7))}px system-ui, sans-serif`;
  ctx.strokeStyle = keyline;
  ctx.lineWidth = s * 0.04;
  ctx.fillStyle = ink;
  const y = s * (back ? 0.58 : 0.52);
  ctx.strokeText(String(number).slice(0, 2), s * 0.5, y);
  ctx.fillText(String(number).slice(0, 2), s * 0.5, y);
  label.texture.needsUpdate = true;
  label.material.map = label.texture;
  label.material.opacity = 1;
  label.material.needsUpdate = true;
}

function drawCrestLabel(label, crest, accent, secondary) {
  if (crest && crest.isTexture) {
    label.material.map = crest;
    label.material.opacity = 1;
    label.material.needsUpdate = true;
    return;
  }
  if (!ensureCanvasLabel(label, 192)) return;
  const ctx = label.context;
  const s = label.canvas.width;
  ctx.clearRect(0, 0, s, s);
  if (!crest) {
    label.material.opacity = 0;
    return;
  }
  const a = `#${accent.getHexString()}`;
  const b = `#${secondary.getHexString()}`;
  roundedRect(ctx, s * 0.18, s * 0.12, s * 0.64, s * 0.76, s * 0.11);
  ctx.fillStyle = b;
  ctx.fill();
  ctx.lineWidth = s * 0.055;
  ctx.strokeStyle = a;
  ctx.stroke();
  ctx.font = `900 ${Math.round(s * 0.42)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = a;
  ctx.fillText(String(crest).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2) || 'C', s * 0.5, s * 0.51);
  label.texture.needsUpdate = true;
  label.material.map = label.texture;
  label.material.opacity = 1;
  label.material.needsUpdate = true;
}

function addHair(headPivot, style, material, headW, seed) {
  const group = new THREE.Group();
  group.name = 'hair';
  headPivot.add(group);
  const cap = mesh(GEO.hairCap, material, 'hair-cap', [headW * 1.025, 0.103, headW * 0.99], [0, 0.070, -0.006]);
  cap.castShadow = true;
  const authored = String(style || 'crop').toLowerCase();
  let type = 'crop';
  if (authored.includes('bald')) type = 'bald';
  else if (authored.includes('shaved') || authored.includes('buzz')) type = 'shaved';
  else if (authored.includes('afro') || authored.includes('puff')) type = 'afro';
  else if (authored.includes('bun')) type = 'bun';
  else if (authored.includes('ponytail') || authored.includes('pony')) type = 'ponytail';
  else if (authored.includes('bob') || authored.includes('shoulder cut')) type = 'bob';
  else if (authored.includes('loc') || authored.includes('twist')) type = 'locs';
  else if (authored.includes('braid')) type = 'braids';
  else if (authored.includes('curl') || authored.includes('coil')) type = 'curls';
  else if (authored.includes('mohawk')) type = 'mohawk';
  if (type !== 'shaved' && type !== 'bald') group.add(cap);

  if (type === 'curls' || type === 'afro') {
    cap.visible = false;
    const count = type === 'afro' ? 7 : 5;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + seed;
      const curl = mesh(GEO.sphereLow, material, 'hair-curl',
        [headW * (type === 'afro' ? 0.57 : 0.47), 0.055, headW * 0.5],
        [Math.cos(a) * headW * 0.47, 0.085 + (i % 2) * 0.025, Math.sin(a) * headW * 0.39 - 0.015]);
      group.add(curl);
    }
    group.add(mesh(GEO.sphereLow, material, 'hair-crown',
      [headW * 0.72, type === 'afro' ? 0.085 : 0.065, headW * 0.68], [0, 0.115, -0.01]));
  } else if (type === 'bun') {
    group.add(mesh(GEO.sphereLow, material, 'hair-bun',
      [headW * 0.55, 0.065, headW * 0.52], [0, 0.095, -headW * 0.78]));
  } else if (type === 'ponytail') {
    const pony = mesh(GEO.upperLimb, material, 'hair-ponytail', [0.032, 0.14, 0.035], [0, -0.01, -headW * 0.92]);
    pony.rotation.x = -0.22;
    group.add(pony);
  } else if (type === 'bob') {
    for (const x of [-1, 1]) {
      const side = mesh(GEO.upperLimb, material, 'hair-bob', [0.030, 0.125, 0.040], [x * headW * 0.74, -0.015, -0.015]);
      side.rotation.z = -x * 0.12;
      group.add(side);
    }
    group.add(mesh(GEO.sphereLow, material, 'hair-bob-back', [headW * 0.92, 0.09, headW * 0.38], [0, -0.005, -headW * 0.70]));
  } else if (type === 'locs' || type === 'braids') {
    for (let i = 0; i < 4; i++) {
      const lock = mesh(GEO.upperLimb, material, 'hair-lock', [0.012, 0.105 + (i % 2) * 0.025, 0.012],
        [(-1.5 + i) * headW * 0.33, -0.015, -headW * 0.76]);
      lock.rotation.x = -0.12 + i * 0.025;
      group.add(lock);
    }
  } else if (type === 'mohawk') {
    for (let i = 0; i < 4; i++) {
      group.add(mesh(GEO.cone, material, 'hair-mohawk', [0.024, 0.07, 0.035], [0, 0.12, -0.06 + i * 0.04]));
    }
  }
  return group;
}

const POSE_KEYS = [
  'rootY', 'rootX', 'rootZ', 'rootRX', 'rootRY', 'rootRZ',
  'hipsRX', 'hipsRY', 'hipsRZ', 'torsoRX', 'torsoRY', 'torsoRZ',
  'headRX', 'headRY', 'headRZ',
  'lArmX', 'lArmY', 'lArmZ', 'rArmX', 'rArmY', 'rArmZ',
  'lElbowX', 'lElbowZ', 'rElbowX', 'rElbowZ',
  'lLegX', 'lLegY', 'lLegZ', 'rLegX', 'rLegY', 'rLegZ',
  'lKneeX', 'lKneeZ', 'rKneeX', 'rKneeZ', 'lAnkleX', 'rAnkleX',
];

function neutralPose() {
  const p = {};
  for (const key of POSE_KEYS) p[key] = 0;
  p.lArmZ = -0.10;
  p.rArmZ = 0.10;
  p.lElbowX = 0.06;
  p.rElbowX = 0.06;
  p.lLegZ = -0.025;
  p.rLegZ = 0.025;
  return p;
}

function addPose(out, values, weight = 1) {
  for (const [key, value] of Object.entries(values)) {
    if (Object.prototype.hasOwnProperty.call(out, key)) out[key] += value * weight;
  }
}

function sideValue(side) {
  if (typeof side === 'string') return side.toLowerCase().startsWith('l') ? -1 : 1;
  if (side === 0) return -1;
  return Number(side) < 0 ? -1 : 1;
}

function actionPose(name, progress, side, keeper, variant = 0) {
  const k = clamp01(progress);
  const s = sideValue(side);
  const out = {};
  let lock = 0;
  const set = (key, value) => { out[key] = value; };
  const limb = (leftKey, rightKey, left, right) => { set(leftKey, left); set(rightKey, right); };

  switch (name) {
    case 'kick': {
      const load = beat(k, 0.01, 0.25, 0.44);
      const hit = beat(k, 0.34, 0.50, 0.68);
      const follow = beat(k, 0.50, 0.72, 0.98);
      const kickX = 0.72 * load - 1.30 * hit - 0.72 * follow;
      const plantX = -0.12 * load + 0.16 * hit;
      if (s < 0) {
        limb('lLegX', 'rLegX', kickX, plantX);
        limb('lKneeX', 'rKneeX', 0.92 * load + 0.16 * hit, 0.16 * load + 0.24 * hit);
      } else {
        limb('lLegX', 'rLegX', plantX, kickX);
        limb('lKneeX', 'rKneeX', 0.16 * load + 0.24 * hit, 0.92 * load + 0.16 * hit);
      }
      set('rootY', 0.025 * hit);
      set('hipsRY', -s * (0.22 * load + 0.42 * hit + 0.28 * follow));
      set('hipsRZ', s * (0.06 * load - 0.12 * hit));
      set('torsoRX', 0.18 * load - 0.25 * hit - 0.13 * follow);
      set('torsoRY', s * (0.18 * load + 0.34 * hit));
      set('torsoRZ', -s * (0.08 * load + 0.16 * hit));
      set('lArmX', s < 0 ? -0.38 * hit : 0.42 * hit);
      set('rArmX', s < 0 ? 0.42 * hit : -0.38 * hit);
      set('lArmZ', -0.56 * hit);
      set('rArmZ', 0.56 * hit);
      set('headRY', -s * 0.16 * hit);
      lock = clamp01(load + hit + follow * 0.8);
      break;
    }
    case 'receive': {
      const brace = range(k, 0.02, 0.28) * (1 - range(k, 0.76, 1));
      const cushion = beat(k, 0.25, 0.50, 0.82);
      const footX = -0.38 * brace + 0.18 * cushion;
      if (s < 0) {
        set('lLegX', footX); set('lKneeX', 0.40 * brace); set('lAnkleX', 0.28 * brace - 0.22 * cushion);
        set('rKneeX', 0.18 * brace);
      } else {
        set('rLegX', footX); set('rKneeX', 0.40 * brace); set('rAnkleX', 0.28 * brace - 0.22 * cushion);
        set('lKneeX', 0.18 * brace);
      }
      set('rootY', -0.07 * brace + 0.035 * cushion);
      set('hipsRZ', -s * 0.07 * brace);
      set('torsoRX', 0.13 * brace - 0.08 * cushion);
      set('lArmZ', -0.42 * brace);
      set('rArmZ', 0.42 * brace);
      set('headRX', 0.18 * brace);
      set('headRY', s * 0.10 * brace);
      lock = brace;
      break;
    }
    case 'skill': {
      const envelope = Math.sin(k * Math.PI);
      const style = Math.abs(Math.floor(variant)) % 4;
      if (style === 0) { // stepover: one boot describes a visible circle
        const circle = k * TAU;
        const lift = Math.max(0, Math.sin(circle)) * envelope;
        if (s < 0) {
          set('lLegX', .38 * envelope + Math.sin(circle) * .22);
          set('lLegZ', -Math.cos(circle) * .48 * envelope);
          set('lKneeX', .48 * envelope + lift * .42);
        } else {
          set('rLegX', .38 * envelope + Math.sin(circle) * .22);
          set('rLegZ', Math.cos(circle) * .48 * envelope);
          set('rKneeX', .48 * envelope + lift * .42);
        }
        set('hipsRY', -s * Math.sin(circle) * .34 * envelope);
        set('torsoRZ', s * .20 * envelope);
      } else if (style === 1) { // body feint: load one shoulder, exit the other
        const snap = Math.sin(k * Math.PI * 2);
        set('rootY', -.11 * envelope);
        set('hipsRZ', s * snap * .24);
        set('torsoRY', -s * snap * .36);
        set('torsoRZ', s * snap * .48);
        set('lLegZ', -.18 * envelope); set('rLegZ', .18 * envelope);
        set('lKneeX', .34 * envelope); set('rKneeX', .34 * envelope);
        set('lArmZ', -.54 * envelope); set('rArmZ', .54 * envelope);
      } else if (style === 2) { // dragback: reach, sole, pull underneath
        const reach = range(k, .01, .30) * (1 - range(k, .74, 1));
        const pull = range(k, .28, .72) * (1 - range(k, .88, 1));
        const legX = .52 * reach - .72 * pull;
        if (s < 0) {
          set('lLegX', legX); set('lKneeX', .30 * reach + .82 * pull); set('lAnkleX', -.46 * reach);
        } else {
          set('rLegX', legX); set('rKneeX', .30 * reach + .82 * pull); set('rAnkleX', -.46 * reach);
        }
        set('rootY', -.08 * Math.max(reach, pull));
        set('torsoRX', .18 * Math.max(reach, pull));
        set('lArmZ', -.44 * envelope); set('rArmZ', .44 * envelope);
      } else { // roulette: compact turn with alternating sole contacts
        const first = beat(k, .04, .25, .50);
        const second = beat(k, .42, .68, .94);
        set('rootY', -.10 * envelope);
        set('rootRY', s * k * TAU);
        set('torsoRX', .20 * envelope);
        set('lArmZ', -1.02 * envelope); set('rArmZ', 1.02 * envelope);
        set('lLegX', .44 * first - .26 * second); set('lKneeX', .72 * first + .34 * second);
        set('rLegX', .44 * second - .26 * first); set('rKneeX', .72 * second + .34 * first);
      }
      set('headRX', .10 * envelope);
      lock = envelope;
      break;
    }
    case 'celebrate': {
      const rise = range(k, 0.02, 0.22);
      const release = 1 - range(k, 0.88, 1);
      const hold = rise * release;
      const bounce = Math.sin(k * Math.PI * 5) * hold;
      const style = Math.abs(Math.floor(variant)) % 4;
      set('rootY', Math.max(0, bounce) * (style === 2 ? 0.13 : 0.07));
      set('torsoRY', Math.sin(k * TAU) * (style === 1 ? 0.28 : 0.12) * hold);
      set('headRZ', Math.sin(k * Math.PI * 3) * 0.06 * hold);
      if (style === 0) { // classic victory V
        set('torsoRX', -0.10 * hold);
        set('lArmZ', -2.62 * hold); set('rArmZ', 2.62 * hold);
        set('lArmX', -0.18 * hold); set('rArmX', -0.18 * hold);
        set('lElbowX', 0.24 * hold); set('rElbowX', 0.24 * hold);
        set('headRX', -0.16 * hold);
      } else if (style === 1) { // alternating fist pumps
        const pump = Math.sin(k * Math.PI * 7);
        set('lArmZ', -1.28 * hold); set('rArmZ', 1.28 * hold);
        set('lArmX', (-0.75 - Math.max(0, pump) * 0.42) * hold);
        set('rArmX', (-0.75 - Math.max(0, -pump) * 0.42) * hold);
        set('lElbowX', 1.14 * hold); set('rElbowX', 1.14 * hold);
      } else if (style === 2) { // star jump / arms wide
        set('lArmZ', -1.48 * hold); set('rArmZ', 1.48 * hold);
        set('lArmX', -0.12 * hold); set('rArmX', -0.12 * hold);
        set('lLegZ', -0.24 * hold); set('rLegZ', 0.24 * hold);
        set('lKneeX', Math.max(0, -bounce) * 0.30);
        set('rKneeX', Math.max(0, bounce) * 0.30);
      } else { // badge point and crowd salute
        set('torsoRX', 0.08 * hold); set('torsoRZ', -s * 0.08 * hold);
        set('lArmX', -0.82 * hold); set('lArmZ', -0.42 * hold); set('lElbowX', 1.55 * hold);
        set('rArmZ', 2.15 * hold); set('rArmX', -0.18 * hold); set('rElbowX', 0.30 * hold);
        set('headRY', s * 0.22 * hold);
      }
      set('lKneeX', (out.lKneeX || 0) + Math.max(0, -bounce) * 0.22);
      set('rKneeX', (out.rKneeX || 0) + Math.max(0, bounce) * 0.22);
      lock = hold;
      break;
    }
    case 'tackle': {
      const drop = range(k, 0.02, 0.28);
      const slide = range(k, 0.18, 0.52);
      const finish = range(k, 0.68, 1);
      const active = Math.max(drop, slide) * (1 - finish * 0.45);
      set('rootY', -0.52 * slide + 0.16 * finish);
      set('rootRX', -0.22 * slide);
      set('rootRZ', -s * 0.20 * slide);
      set('hipsRY', s * 0.18 * slide);
      if (s < 0) {
        set('lLegX', -1.08 * slide); set('lKneeX', 0.10 * slide);
        set('rLegX', 0.38 * slide); set('rKneeX', 1.25 * slide);
      } else {
        set('rLegX', -1.08 * slide); set('rKneeX', 0.10 * slide);
        set('lLegX', 0.38 * slide); set('lKneeX', 1.25 * slide);
      }
      set('torsoRX', 0.42 * drop - 0.24 * slide);
      set('torsoRZ', s * 0.18 * slide);
      set('lArmZ', -0.82 * active);
      set('rArmZ', 0.82 * active);
      set('lArmX', -0.26 * slide);
      set('rArmX', -0.26 * slide);
      set('headRX', -0.18 * slide);
      lock = active;
      break;
    }
    case 'fall': {
      const trip = range(k, 0.02, 0.24);
      const down = range(k, 0.20, 0.72);
      // motionRoot already rotates around the planted ground origin; only a
      // tiny settle is needed or the horizontal body would sink through turf.
      set('rootY', -0.035 * down);
      set('rootX', s * 0.16 * down);
      set('rootRX', -0.20 * trip + 0.16 * down);
      set('rootRZ', -s * 1.36 * down);
      set('torsoRX', 0.35 * trip);
      set('torsoRZ', s * 0.22 * trip);
      set('lArmZ', -0.72 * trip + s * 0.24 * down);
      set('rArmZ', 0.72 * trip + s * 0.24 * down);
      set('lElbowX', 0.56 * down);
      set('rElbowX', 0.56 * down);
      set('lLegX', 0.28 * trip); set('rLegX', -0.24 * trip);
      set('lKneeX', 0.72 * down); set('rKneeX', 0.46 * down);
      set('headRZ', s * 0.18 * down);
      lock = Math.max(trip, down);
      break;
    }
    case 'keeper-ready': {
      const ready = k <= 0 ? 1 : range(k, 0, 0.18) * (1 - range(k, 0.90, 1));
      set('rootY', -0.105 * ready);
      set('torsoRX', 0.22 * ready);
      set('lLegZ', -0.20 * ready); set('rLegZ', 0.20 * ready);
      set('lKneeX', 0.34 * ready); set('rKneeX', 0.34 * ready);
      set('lArmX', -0.54 * ready); set('rArmX', -0.54 * ready);
      set('lArmZ', -0.62 * ready); set('rArmZ', 0.62 * ready);
      set('lElbowX', 0.58 * ready); set('rElbowX', 0.58 * ready);
      set('lElbowZ', -0.12 * ready); set('rElbowZ', 0.12 * ready);
      set('headRX', -0.08 * ready);
      lock = ready * (keeper ? 1 : 0.85);
      break;
    }
    case 'dive': {
      const load = range(k, 0.01, 0.22) * (1 - range(k, 0.36, 0.52));
      const launch = range(k, 0.18, 0.52);
      const land = range(k, 0.72, 1);
      set('rootX', s * (0.28 * launch + 0.15 * land));
      set('rootY', -0.10 * load + 0.44 * launch - 0.43 * land);
      set('rootRX', -0.18 * launch);
      set('rootRZ', -s * (1.12 * launch + 0.30 * land));
      set('torsoRX', 0.24 * load - 0.15 * launch);
      set('torsoRZ', s * 0.12 * launch);
      // Reach both gloves toward the save side; the lower arm protects landing.
      if (s < 0) {
        set('lArmZ', -2.35 * launch); set('rArmZ', -1.75 * launch);
        set('lArmX', -0.28 * launch); set('rArmX', -0.08 * launch);
      } else {
        set('lArmZ', 1.75 * launch); set('rArmZ', 2.35 * launch);
        set('lArmX', -0.08 * launch); set('rArmX', -0.28 * launch);
      }
      set('lElbowX', 0.16 * launch + 0.30 * land);
      set('rElbowX', 0.16 * launch + 0.30 * land);
      set('lLegX', 0.34 * launch); set('rLegX', -0.18 * launch);
      set('lKneeX', 0.52 * launch); set('rKneeX', 0.36 * launch);
      set('headRZ', s * 0.18 * launch);
      lock = Math.max(load, launch, land);
      break;
    }
    case 'keeper-catch': {
      const setShape = range(k, 0.01, 0.24) * (1 - range(k, 0.84, 1));
      const meet = beat(k, 0.23, 0.52, 0.70);
      const secure = range(k, 0.52, 0.82) * (1 - range(k, 0.92, 1));
      set('rootY', -0.085 * setShape + 0.035 * meet);
      set('torsoRX', 0.20 * setShape - 0.12 * meet + 0.10 * secure);
      set('lLegZ', -0.18 * setShape); set('rLegZ', 0.18 * setShape);
      set('lKneeX', 0.30 * setShape); set('rKneeX', 0.30 * setShape);
      set('lArmX', -1.18 * meet - 0.68 * secure); set('rArmX', -1.18 * meet - 0.68 * secure);
      set('lArmZ', -0.48 * meet - 0.28 * secure); set('rArmZ', 0.48 * meet + 0.28 * secure);
      set('lElbowX', 0.24 * meet + 0.82 * secure); set('rElbowX', 0.24 * meet + 0.82 * secure);
      set('headRX', 0.12 * meet + 0.18 * secure);
      lock = Math.max(setShape, meet, secure);
      break;
    }
    case 'block': {
      const brace = range(k, 0.01, 0.22) * (1 - range(k, 0.82, 1));
      const impact = beat(k, 0.30, 0.49, 0.70);
      set('rootY', -0.10 * brace);
      set('rootRX', -0.08 * impact); set('rootRZ', -s * 0.08 * impact);
      set('torsoRX', 0.24 * brace - 0.18 * impact); set('torsoRY', -s * 0.30 * brace);
      set('torsoRZ', s * 0.12 * impact);
      set('lLegZ', -0.17 * brace); set('rLegZ', 0.17 * brace);
      set('lKneeX', 0.32 * brace); set('rKneeX', 0.32 * brace);
      set('lArmX', -0.70 * brace); set('rArmX', -0.70 * brace);
      set('lArmZ', -0.62 * brace); set('rArmZ', 0.62 * brace);
      set('lElbowX', 0.86 * brace); set('rElbowX', 0.86 * brace);
      set('headRX', -0.10 * brace); set('headRY', s * 0.16 * brace);
      lock = Math.max(brace, impact);
      break;
    }
    case 'throw-in': {
      const lift = range(k, 0.01, 0.31) * (1 - range(k, 0.83, 1));
      const load = beat(k, 0.20, 0.39, 0.56);
      const release = beat(k, 0.43, 0.56, 0.74);
      const follow = range(k, 0.56, 0.82) * (1 - range(k, 0.92, 1));
      set('rootY', -0.025 * load + 0.035 * release);
      set('hipsRX', -0.12 * load + 0.14 * follow);
      set('torsoRX', -0.30 * load + 0.40 * follow);
      set('lArmX', -2.52 * lift + 0.52 * follow); set('rArmX', -2.52 * lift + 0.52 * follow);
      set('lArmZ', -0.16 * lift); set('rArmZ', 0.16 * lift);
      set('lElbowX', 0.38 * load + 0.12 * release); set('rElbowX', 0.38 * load + 0.12 * release);
      set('lKneeX', 0.12 * load); set('rKneeX', 0.12 * load);
      set('headRX', -0.22 * lift + 0.20 * follow);
      lock = Math.max(lift, load, release, follow);
      break;
    }
    case 'header': {
      const load = beat(k, 0.01, 0.28, 0.48);
      const jump = beat(k, 0.30, 0.58, 0.86);
      const hit = beat(k, 0.46, 0.61, 0.75);
      set('rootY', -0.09 * load + 0.28 * jump);
      set('torsoRX', 0.24 * load - 0.42 * hit);
      set('headRX', 0.28 * load - 0.58 * hit);
      set('lArmZ', -0.72 * jump); set('rArmZ', 0.72 * jump);
      set('lArmX', -0.18 * jump); set('rArmX', -0.18 * jump);
      set('lKneeX', 0.26 * load + 0.18 * jump); set('rKneeX', 0.26 * load + 0.18 * jump);
      lock = clamp01(load + jump);
      break;
    }
    default:
      break;
  }
  return { values: out, lock };
}

function normalizeAction(name) {
  const raw = String(name || 'idle').toLowerCase().replace(/[_\s]+/g, '-');
  const aliases = {
    shoot: 'kick', shot: 'kick', pass: 'kick', strike: 'kick', volley: 'kick',
    'short-pass': 'kick', 'driven-pass': 'kick', 'lofted-pass': 'kick',
    'power-shot': 'kick', 'finesse-shot': 'kick', penalty: 'kick', 'keeper-distribution': 'kick',
    trap: 'receive', control: 'receive', cushion: 'receive',
    celebration: 'celebrate', goal: 'celebrate',
    slide: 'tackle', 'slide-tackle': 'tackle',
    knocked: 'fall', knockdown: 'fall',
    gkset: 'keeper-ready', 'gk-set': 'keeper-ready', keeper: 'keeper-ready', ready: 'keeper-ready',
    'keeper-dive': 'dive', 'gk-dive': 'dive', save: 'dive',
    catch: 'keeper-catch', 'gk-catch': 'keeper-catch', keepercatch: 'keeper-catch',
    throw: 'throw-in', throwin: 'throw-in', 'touchline-throw': 'throw-in',
    'shot-block': 'block', brace: 'block',
    run: 'idle', locomotion: 'idle', none: 'idle',
  };
  return aliases[raw] || raw;
}

/** Build one modular athlete. No preload step is required. */
export function buildAthleteRig(options = {}) {
  const athleteRecord = options.athlete || {};
  const athlete = options.dna || athleteRecord.visualDNA || athleteRecord;
  const broadcastReadability = options.broadcastReadability === true || options.matchPresentation === true;
  const bodyDNA = athlete.body || {};
  const faceDNA = athlete.face || {};
  const movementDNA = athlete.movement || {};
  const identityKey = athleteRecord.id ?? athlete.id ?? options.id ?? options.name
    ?? athleteRecord.displayName ?? athlete.name ?? options.seed ?? Math.random();
  const identitySeed = hash(identityKey);
  const trait = (name, low, high, authored) => {
    const source = Number.isFinite(authored) ? clamp01(authored) : hash(`${identityKey}:${name}`);
    return THREE.MathUtils.lerp(low, high, source);
  };
  const buildName = typeof athlete.build === 'string' ? athlete.build.toLowerCase() : 'athletic';
  const preset = { ...(BUILD_PRESETS[buildName] || BUILD_PRESETS.athletic) };
  if (Number.isFinite(athlete.build)) {
    const t = clamp01(athlete.build);
    const a = BUILD_PRESETS.lean;
    const b = BUILD_PRESETS.power;
    for (const key of Object.keys(preset)) preset[key] = THREE.MathUtils.lerp(a[key], b[key], t);
  }
  const modifier = (key, nested, fallback = 1) => clamp(athlete[key] ?? nested ?? fallback, 0.78, 1.28);
  preset.shoulder *= modifier('shoulderScale', bodyDNA.shoulder);
  preset.chest *= modifier('chestScale', bodyDNA.chest);
  preset.waist *= modifier('waistScale', bodyDNA.waist);
  preset.hip *= modifier('hipScale', bodyDNA.hip);
  preset.limb *= modifier('muscleScale', bodyDNA.muscle);
  preset.depth *= modifier('depthScale', bodyDNA.depth);

  const authoredHeight = Number.isFinite(athlete.heightCm) ? athlete.heightCm / 100 : (athlete.height ?? options.height ?? 1.82);
  const targetHeight = clamp(authoredHeight, 1.60, 2.04);
  const buildLegBias = buildName === 'rangy' ? 1.035 : (buildName === 'compact' ? 0.975 : 1);
  const legRatio = clamp(athlete.legRatio ?? bodyDNA.legRatio ?? buildLegBias, 0.90, 1.10);
  const armRatio = clamp(athlete.armRatio ?? bodyDNA.armRatio ?? 1, 0.90, 1.10);
  const strideBias = clamp(athlete.strideBias ?? movementDNA.strideBias ?? 1, 0.88, 1.12);
  const armDrive = clamp(athlete.armDrive ?? movementDNA.armDrive ?? 1, 0.78, 1.24);
  const posture = String(athlete.posture ?? movementDNA.posture ?? 'measured').toLowerCase();
  const preferredFoot = String(athlete.preferredFoot ?? movementDNA.preferredFoot ?? 'right').toLowerCase();
  const celebrationVariant = clamp(Math.floor(athlete.celebrationVariant ?? movementDNA.celebrationVariant ?? identitySeed * 4), 0, 3);
  const shoulderHalf = (broadcastReadability ? 0.215 : 0.245) * preset.shoulder;
  const hipHalf = (broadcastReadability ? 0.112 : 0.117) * preset.hip;
  const thighLength = 0.45 * legRatio;
  const shinLength = 0.40 * legRatio;
  const ankleY = 0.105;
  const kneeY = ankleY + shinLength;
  const hipY = kneeY + thighLength;
  const upperArmLength = 0.285 * armRatio;
  const forearmLength = 0.255 * armRatio;
  const torsoHeight = broadcastReadability ? 0.585 : 0.57;
  const headScale = clamp(athlete.headScale ?? 1, 0.90, 1.10);
  const faceWidth = clamp(athlete.faceWidth ?? athlete.headWidth ?? faceDNA.headWidth ?? trait('face-width', 0.91, 1.09), 0.87, 1.13);
  const presetLength = faceDNA.preset === 'long' ? 1.08 : (faceDNA.preset === 'round' ? 0.94 : 1);
  const faceLength = clamp(athlete.faceLength ?? faceDNA.faceLength ?? presetLength * trait('face-length', 0.96, 1.04), 0.89, 1.13);
  const jawWidth = clamp(athlete.jawWidth ?? faceDNA.jawWidth ?? trait('jaw-width', 0.72, 1.02), 0.68, 1.13);
  const cheekScale = clamp(athlete.cheekbones ?? athlete.cheekScale ?? faceDNA.cheekbone ?? trait('cheeks', 0.82, 1.08), 0.74, 1.16);
  const noseWidth = clamp(athlete.noseWidth ?? faceDNA.noseWidth ?? trait('nose-width', 0.80, 1.17), 0.72, 1.24);
  const noseLength = clamp(athlete.noseLength ?? faceDNA.noseBridge ?? trait('nose-length', 0.82, 1.16), 0.74, 1.24);
  const eyeSpacing = clamp(athlete.eyeSpacing ?? faceDNA.eyeSpacing ?? trait('eye-spacing', 0.88, 1.11), 0.82, 1.18);
  const eyeScale = clamp(athlete.eyeScale ?? faceDNA.eyeScale ?? trait('eye-scale', 0.88, 1.10), 0.80, 1.18);
  const browAngle = clamp(athlete.browAngle ?? faceDNA.browAngle ?? trait('brow-angle', -0.55, 0.55), -0.75, 0.75);
  const mouthWidth = clamp(athlete.mouthWidth ?? faceDNA.mouthWidth ?? trait('mouth-width', 0.82, 1.16), 0.72, 1.24);
  const lipScale = clamp(athlete.lipScale ?? faceDNA.lipScale ?? trait('lip-scale', 0.76, 1.18), 0.68, 1.28);
  const headW = headScale * 0.107 * faceWidth;
  const canonicalHeight = hipY + 0.675 + 0.14;

  const group = new THREE.Group();
  const identityName = options.name ?? athleteRecord.displayName ?? athlete.displayName ?? athlete.name;
  group.name = identityName ? `athlete-${identityName}` : 'athlete-rig';
  group.scale.setScalar(targetHeight / canonicalHeight);
  const motionRoot = joint(group, 'motion-root', [0, 0, 0]);
  const hips = joint(motionRoot, 'hips', [0, hipY, 0]);
  const torso = joint(hips, 'torso', [0, 0.025, 0]);

  const materials = {
    skin: new THREE.MeshStandardMaterial({ color: toneColor(athlete.skinTone ?? options.skinTone), roughness: 0.76, metalness: 0 }),
    hair: new THREE.MeshStandardMaterial({ color: valueColor(athlete.hairColor ?? options.hairColor, 0x17120f), roughness: 0.88, metalness: 0 }),
    facialHair: new THREE.MeshStandardMaterial({ color: valueColor(athlete.hairColor ?? options.hairColor, 0x17120f), roughness: 0.90, metalness: 0, transparent: true, opacity: 0.94 }),
    eye: new THREE.MeshStandardMaterial({ color: valueColor(athlete.eyeColor ?? faceDNA.eyeColor, 0x211b18), roughness: 0.58, metalness: 0 }),
    sclera: new THREE.MeshStandardMaterial({ color: valueColor(athlete.scleraColor, 0xf4ede5), roughness: 0.64, metalness: 0 }),
    lip: new THREE.MeshStandardMaterial({ color: toneColor(athlete.skinTone ?? options.skinTone).multiplyScalar(0.62), roughness: 0.74, metalness: 0 }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x271313, roughness: 0.86, metalness: 0 }),
    catchlight: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    jersey: new THREE.MeshStandardMaterial({ color: DEFAULT_SKIN.primary, roughness: 0.68, metalness: 0.015 }),
    jerseySecondary: new THREE.MeshStandardMaterial({ color: DEFAULT_SKIN.secondary, roughness: 0.64, metalness: 0.02 }),
    panel: new THREE.MeshStandardMaterial({ color: DEFAULT_SKIN.secondary, roughness: 0.54, metalness: 0.04 }),
    pattern: new THREE.MeshStandardMaterial({ color: DEFAULT_SKIN.accent, roughness: 0.61, metalness: 0.015, transparent: true, opacity: 0.62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
    trim: new THREE.MeshStandardMaterial({ color: DEFAULT_SKIN.accent, roughness: 0.50, metalness: 0.05 }),
    shorts: new THREE.MeshStandardMaterial({ color: DEFAULT_SKIN.shorts, roughness: 0.70, metalness: 0.01 }),
    socks: new THREE.MeshStandardMaterial({ color: DEFAULT_SKIN.socks, roughness: 0.76, metalness: 0 }),
    boots: new THREE.MeshStandardMaterial({ color: DEFAULT_SKIN.boots, roughness: 0.42, metalness: 0.06 }),
    sole: new THREE.MeshStandardMaterial({ color: 0x07080b, roughness: 0.55, metalness: 0 }),
    gloves: new THREE.MeshStandardMaterial({ color: DEFAULT_SKIN.goalkeeperGloves, roughness: 0.55, metalness: 0.02 }),
    accessory: new THREE.MeshStandardMaterial({ color: DEFAULT_SKIN.accent, roughness: 0.60, metalness: 0.01 }),
  };

  const torsoMesh = mesh(broadcastReadability ? GEO.broadcastTorso : GEO.torso, materials.jersey, 'jersey-body',
    [(broadcastReadability ? 0.265 : 0.285) * preset.chest, torsoHeight, 0.145 * preset.depth], [0, torsoHeight * 0.5, 0]);
  torso.add(torsoMesh);
  const pelvisMesh = mesh(broadcastReadability ? GEO.broadcastPelvis : GEO.pelvis, materials.shorts, 'shorts-body',
    [(broadcastReadability ? 0.225 : 0.215) * preset.hip, 0.215, 0.136 * preset.depth], [0, -0.015, 0]);
  hips.add(pelvisMesh);

  // Technical garment construction: collar, shoulder yoke, breathable side
  // panels, cuffs, and a skin-selectable graphic panel. They are geometry, not
  // baked pixels, so every club palette stays crisp in motion and in replays.
  const collar = mesh(GEO.torus, materials.trim, 'jersey-collar', [0.095, 0.070, 0.095], [0, 0.565, 0]);
  collar.rotation.x = Math.PI / 2;
  const leftSidePanel = mesh(GEO.box, materials.panel, 'left-vent-panel', [0.018, 0.25, 0.115], [-0.19 * preset.chest, 0.255, 0]);
  const rightSidePanel = mesh(GEO.box, materials.panel, 'right-vent-panel', [0.018, 0.25, 0.115], [0.19 * preset.chest, 0.255, 0]);
  const garmentFrontZ = (broadcastReadability ? 0.143 : 0.104) * preset.depth;
  const chestPanel = mesh(GEO.plane, materials.pattern, 'graphic-panel', [0.055, 0.50, 1], [0, 0.315, garmentFrontZ]);
  chestPanel.rotation.z = -0.57;
  torso.add(chestPanel);
  const lowerPanel = mesh(GEO.plane, materials.pattern, 'lower-graphic-panel', [0.36, 0.18, 1], [0, 0.11, garmentFrontZ - 0.006]);
  torso.add(lowerPanel);
  const yokeL = mesh(GEO.box, materials.jerseySecondary, 'left-shoulder-yoke', [0.10, 0.014, 0.09], [-0.145, 0.535, 0]);
  const yokeR = mesh(GEO.box, materials.jerseySecondary, 'right-shoulder-yoke', [0.10, 0.014, 0.09], [0.145, 0.535, 0]);
  addNearDetails(torso, [collar, leftSidePanel, rightSidePanel, yokeL, yokeR]);

  const neck = mesh(GEO.neck, materials.skin, 'neck', [0.055, 0.105, 0.052], [0, 0.615, 0]);
  torso.add(neck);
  const headPivot = joint(torso, 'head-pivot', [0, 0.675, 0]);
  const head = mesh(GEO.sphere, materials.skin, 'head', [headW, 0.137 * faceLength, headW * 0.96], [0, 0.006, 0]);
  headPivot.add(head);
  // A distinct jaw/chin and cheek plane keep closeups from reading as painted
  // spheres. All measurements are deterministic identity traits and stay fixed
  // when a player changes kit.
  const jaw = mesh(GEO.sphereLow, materials.skin, 'jaw',
    [headW * jawWidth, 0.078 * faceLength, headW * 0.78], [0, -0.064 * faceLength, 0.010]);
  const chin = mesh(GEO.sphereLow, materials.skin, 'chin',
    [headW * jawWidth * 0.52, 0.030 * lipScale, headW * 0.42], [0, -0.120 * faceLength, 0.052]);
  headPivot.add(jaw, chin);
  const earL = mesh(GEO.sphereLow, materials.skin, 'left-ear', [broadcastReadability ? 0.012 : 0.015, broadcastReadability ? 0.022 : 0.026, 0.011], [-headW * 0.98, -0.006, 0]);
  const earR = mesh(GEO.sphereLow, materials.skin, 'right-ear', [broadcastReadability ? 0.012 : 0.015, broadcastReadability ? 0.022 : 0.026, 0.011], [headW * 0.98, -0.006, 0]);
  const noseBridge = mesh(GEO.box, materials.skin, 'nose-bridge',
    [(broadcastReadability ? 0.009 : 0.012) * noseWidth, (broadcastReadability ? 0.029 : 0.036) * noseLength, 0.010], [0, 0.012, headW * 0.88]);
  noseBridge.rotation.x = 0.10;
  const nose = mesh(broadcastReadability ? GEO.sphereLow : GEO.cone, materials.skin, 'nose',
    [(broadcastReadability ? 0.012 : 0.018) * noseWidth, (broadcastReadability ? 0.020 : 0.038) * noseLength, (broadcastReadability ? 0.010 : 0.018) * noseWidth], [0, -0.006, headW * 1.00]);
  if (!broadcastReadability) nose.rotation.x = Math.PI / 2;
  const eyeSocketL = joint(headPivot, 'left-eye-socket', [-0.038 * eyeSpacing, 0.031, headW * 0.905]);
  const eyeSocketR = joint(headPivot, 'right-eye-socket', [0.038 * eyeSpacing, 0.031, headW * 0.905]);
  const eyeWhiteL = mesh(GEO.sphereLow, materials.sclera, 'left-eye-white', [(broadcastReadability ? 0.0115 : 0.0145) * eyeScale, (broadcastReadability ? 0.0052 : 0.0072) * eyeScale, 0.004], [0, 0, 0]);
  const eyeWhiteR = mesh(GEO.sphereLow, materials.sclera, 'right-eye-white', [(broadcastReadability ? 0.0115 : 0.0145) * eyeScale, (broadcastReadability ? 0.0052 : 0.0072) * eyeScale, 0.004], [0, 0, 0]);
  const irisL = mesh(GEO.disc, materials.eye, 'left-iris', [(broadcastReadability ? 0.0037 : 0.0052) * eyeScale, (broadcastReadability ? 0.0037 : 0.0052) * eyeScale, 1], [0, 0, 0.0042]);
  const irisR = mesh(GEO.disc, materials.eye, 'right-iris', [(broadcastReadability ? 0.0037 : 0.0052) * eyeScale, (broadcastReadability ? 0.0037 : 0.0052) * eyeScale, 1], [0, 0, 0.0042]);
  const glintL = mesh(GEO.disc, materials.catchlight, 'left-eye-catchlight', [0.0017, 0.0017, 1], [-0.0018, 0.0020, 0.0065]);
  const glintR = mesh(GEO.disc, materials.catchlight, 'right-eye-catchlight', [0.0017, 0.0017, 1], [-0.0018, 0.0020, 0.0065]);
  eyeSocketL.add(eyeWhiteL, irisL, glintL);
  eyeSocketR.add(eyeWhiteR, irisR, glintR);
  const browL = mesh(GEO.box, materials.hair, 'left-brow', [(broadcastReadability ? 0.022 : 0.027) * eyeScale, broadcastReadability ? 0.0028 : 0.004, 0.003], [-0.038 * eyeSpacing, 0.056, headW * 0.925]);
  const browR = mesh(GEO.box, materials.hair, 'right-brow', [(broadcastReadability ? 0.022 : 0.027) * eyeScale, broadcastReadability ? 0.0028 : 0.004, 0.003], [0.038 * eyeSpacing, 0.056, headW * 0.925]);
  browL.rotation.z = -0.08 + browAngle * 0.12;
  browR.rotation.z = 0.08 - browAngle * 0.12;
  const mouthGroup = joint(headPivot, 'mouth-expression', [0, -0.064 * faceLength, headW * 0.945]);
  const mouthLine = mesh(GEO.sphereLow, materials.mouth, 'mouth-opening', [(broadcastReadability ? 0.023 : 0.030) * mouthWidth, broadcastReadability ? 0.0024 : 0.004, 0.003], [0, -0.001, 0]);
  const mouthLeft = mesh(GEO.box, materials.lip, 'left-mouth-line', [(broadcastReadability ? 0.015 : 0.020) * mouthWidth, broadcastReadability ? 0.0022 : 0.0032, 0.003], [-(broadcastReadability ? 0.014 : 0.019) * mouthWidth, 0, 0.002]);
  const mouthRight = mesh(GEO.box, materials.lip, 'right-mouth-line', [(broadcastReadability ? 0.015 : 0.020) * mouthWidth, broadcastReadability ? 0.0022 : 0.0032, 0.003], [(broadcastReadability ? 0.014 : 0.019) * mouthWidth, 0, 0.002]);
  const lowerLip = mesh(GEO.sphereLow, materials.lip, 'lower-lip', [(broadcastReadability ? 0.026 : 0.034) * mouthWidth, (broadcastReadability ? 0.0042 : 0.006) * lipScale, 0.004], [0, -0.005, 0.001]);
  mouthGroup.add(mouthLine, mouthLeft, mouthRight, lowerLip);
  eyeWhiteL.castShadow = eyeWhiteR.castShadow = irisL.castShadow = irisR.castShadow = false;
  const faceLod = addNearDetails(headPivot, [earL, earR, noseBridge, nose, browL, browR, mouthGroup], broadcastReadability ? 32 : 11);
  faceLod.userData.detailCategory = 'face';
  eyeSocketL.userData.detailCategory = eyeSocketR.userData.detailCategory = 'face-essential';
  addHair(headPivot, athlete.hairStyle ?? athlete.hair ?? 'crop', materials.hair, headW, identitySeed * TAU);

  const facialHair = athlete.facialHair ?? faceDNA.facialHair;
  if (facialHair === 'beard' || facialHair === 'short-stubble' || facialHair === true) {
    const beard = mesh(GEO.sphereLow, materials.facialHair, 'beard', [headW * jawWidth * 0.86, 0.050, headW * 0.73], [0, -0.081, -0.004]);
    if (facialHair === 'short-stubble') {
      beard.scale.multiplyScalar(0.96);
      materials.facialHair.opacity = 0.76;
    }
    headPivot.add(beard);
    // Keep facial animation readable by drawing the mouth just in front of the
    // beard shell rather than allowing the primitive volumes to intersect.
    mouthGroup.position.z += 0.008;
  }

  function buildArm(side) {
    const isLeft = side === 'left';
    const s = isLeft ? -1 : 1;
    const upper = joint(torso, `${side}-shoulder`, [s * shoulderHalf, 0.505, 0]);
    if (!broadcastReadability) {
      upper.add(mesh(GEO.sphereLow, materials.jersey, `${side}-shoulder-cap`,
        [0.066 * preset.limb, 0.070, 0.064 * preset.depth], [0, -0.010, 0]));
    }
    const armGeometry = broadcastReadability ? GEO.humanLimb : GEO.upperLimb;
    const armOverlap = broadcastReadability ? 0.016 : 0;
    const upperSkin = mesh(armGeometry, materials.skin, `${side}-upper-arm`,
      [(broadcastReadability ? 0.068 : 0.051) * preset.limb, upperArmLength + armOverlap, (broadcastReadability ? 0.064 : 0.051) * preset.depth],
      [0, -(upperArmLength - armOverlap) * 0.5, 0]);
    upper.add(upperSkin);
    const sleeve = mesh(broadcastReadability ? GEO.humanLimb : GEO.upperLimb, materials.jersey, `${side}-jersey-sleeve`,
      [(broadcastReadability ? 0.075 : 0.061) * preset.limb, upperArmLength * (broadcastReadability ? 0.52 : 0.47), (broadcastReadability ? 0.070 : 0.061) * preset.depth],
      [0, -upperArmLength * (broadcastReadability ? 0.245 : 0.225), 0]);
    upper.add(sleeve);
    const cuff = mesh(GEO.torus, materials.trim, `${side}-sleeve-cuff`, [0.052, 0.052, 0.052], [0, -upperArmLength * 0.46, 0]);
    cuff.rotation.x = Math.PI / 2;
    addNearDetails(upper, [cuff]);
    const captainBand = mesh(GEO.torus, materials.trim, `${side}-captain-band`, [0.058, 0.058, 0.058], [0, -upperArmLength * 0.54, 0]);
    captainBand.rotation.x = Math.PI / 2;
    upper.add(captainBand);
    const elbow = joint(upper, `${side}-elbow`, [0, -upperArmLength, 0]);
    const elbowCap = mesh(GEO.joint, materials.skin, `${side}-elbow-joint`, [0.051, 0.051, 0.051], [0, 0, 0]);
    if (!broadcastReadability) addNearDetails(elbow, [elbowCap]);
    const forearm = mesh(broadcastReadability ? GEO.humanLimb : GEO.lowerLimb, materials.skin, `${side}-forearm`,
      [(broadcastReadability ? 0.061 : 0.045) * preset.limb, forearmLength + armOverlap, (broadcastReadability ? 0.057 : 0.044) * preset.depth],
      [0, -(forearmLength - armOverlap) * 0.5, 0]);
    elbow.add(forearm);
    const compression = mesh(broadcastReadability ? GEO.humanLimb : GEO.lowerLimb, materials.jerseySecondary, `${side}-compression-sleeve`,
      [(broadcastReadability ? 0.064 : 0.049) * preset.limb, forearmLength * 0.96, (broadcastReadability ? 0.060 : 0.048) * preset.depth], [0, -forearmLength * 0.47, 0]);
    elbow.add(compression);
    const wrist = joint(elbow, `${side}-wrist`, [0, -forearmLength, 0]);
    const hand = mesh(GEO.sphereLow, materials.skin, `${side}-hand`,
      [broadcastReadability ? 0.041 : 0.047, broadcastReadability ? 0.058 : 0.065, broadcastReadability ? 0.027 : 0.030], [0, -0.035, 0.006]);
    wrist.add(hand);
    const glove = mesh(GEO.sphereLow, materials.gloves, `${side}-goalkeeper-glove`, [0.065, 0.082, 0.044], [0, -0.040, 0.014]);
    wrist.add(glove);
    const tape = mesh(GEO.torus, materials.accessory, `${side}-wrist-tape`, [0.043, 0.043, 0.043], [0, -0.005, 0]);
    tape.rotation.x = Math.PI / 2;
    wrist.add(tape);
    const palmSocket = joint(wrist, `${side}-palm-socket`, [0, -0.050, 0.050]);
    return { upper, elbow, wrist, palmSocket, upperSkin, forearm, sleeve, compression, captainBand, glove, tape };
  }

  function buildLeg(side) {
    const isLeft = side === 'left';
    const s = isLeft ? -1 : 1;
    const upper = joint(hips, `${side}-hip`, [s * hipHalf, -0.03, 0]);
    const legGeometry = broadcastReadability ? GEO.humanLimb : GEO.upperLimb;
    const legOverlap = broadcastReadability ? 0.022 : 0;
    const thigh = mesh(legGeometry, materials.skin, `${side}-thigh`,
      [(broadcastReadability ? 0.082 : 0.072) * preset.limb, thighLength + legOverlap, (broadcastReadability ? 0.077 : 0.074) * preset.depth],
      [0, -(thighLength - legOverlap) * 0.5, 0]);
    upper.add(thigh);
    const shortLeg = mesh(broadcastReadability ? GEO.humanShort : GEO.upperLimb, materials.shorts, `${side}-short-leg`,
      [(broadcastReadability ? 0.094 : 0.083) * preset.limb, thighLength * (broadcastReadability ? 0.47 : 0.44), (broadcastReadability ? 0.089 : 0.083) * preset.depth],
      [0, -thighLength * (broadcastReadability ? 0.225 : 0.205), 0]);
    upper.add(shortLeg);
    const knee = joint(upper, `${side}-knee`, [0, -thighLength, 0]);
    const kneeCap = mesh(GEO.joint, materials.skin, `${side}-knee-joint`, [0.065, 0.060, 0.067], [0, 0, 0]);
    const lower = mesh(broadcastReadability ? GEO.humanLimb : GEO.lowerLimb, materials.socks, `${side}-sock`,
      [(broadcastReadability ? 0.085 : 0.064) * preset.limb, shinLength + legOverlap, (broadcastReadability ? 0.080 : 0.067) * preset.depth],
      [0, -(shinLength - legOverlap) * 0.5, 0]);
    knee.add(lower);
    const sockBand = mesh(GEO.torus, materials.trim, `${side}-sock-band`,
      broadcastReadability ? [0.079, 0.079, 0.079] : [0.060, 0.060, 0.060], [0, -0.055, 0]);
    sockBand.rotation.x = Math.PI / 2;
    addNearDetails(knee, broadcastReadability ? [sockBand] : [kneeCap, sockBand], broadcastReadability ? 34 : 10);
    const ankle = joint(knee, `${side}-ankle`, [0, -shinLength, 0]);
    const ankleTape = mesh(GEO.torus, materials.accessory, `${side}-ankle-tape`, [0.061, 0.061, 0.061], [0, 0.006, 0]);
    ankleTape.rotation.x = Math.PI / 2;
    ankle.add(ankleTape);
    const boot = mesh(broadcastReadability ? GEO.sphereLow : GEO.box, materials.boots, `${side}-boot`,
      broadcastReadability ? [0.069, 0.048, 0.170] : [0.070, 0.090, 0.205],
      broadcastReadability ? [0, -0.041, 0.078] : [0, -0.032, 0.070]);
    boot.geometry.computeBoundingSphere();
    ankle.add(boot);
    const bootToe = mesh(GEO.sphereLow, materials.boots, `${side}-boot-toe`, [0.069, 0.038, 0.070], [0, -0.038, 0.225]);
    const toeStripe = mesh(GEO.box, materials.trim, `${side}-boot-accent`, [0.073, 0.012, 0.058], [0, -0.015, 0.165]);
    const sole = mesh(GEO.box, materials.sole, `${side}-sole`, [0.074, 0.014, 0.21], [0, -0.087, 0.070]);
    if (broadcastReadability) ankle.add(bootToe, toeStripe, sole);
    else addNearDetails(ankle, [bootToe, toeStripe, sole]);
    const soleSocket = joint(ankle, `${side}-sole-socket`, [0, -0.090, 0.070]);
    const ballSocket = joint(ankle, `${side}-ball-contact-socket`, [0, -0.040, 0.222]);
    return { upper, knee, ankle, soleSocket, ballSocket, thigh, shortLeg, lower, boot, ankleTape };
  }

  const leftArm = buildArm('left');
  const rightArm = buildArm('right');
  const leftLeg = buildLeg('left');
  const rightLeg = buildLeg('right');

  // Skin/print-ready anchors are actual nodes in the animated hierarchy. A host
  // can parent a custom plane, SVG texture, wearable, or tracking marker here.
  const crestLabel = labelSurface(0.125, 0.145, 'crest-anchor');
  crestLabel.node.position.set(-0.112, 0.405, (broadcastReadability ? 0.145 : 0.108) * preset.depth + 0.004);
  torso.add(crestLabel.node);
  const chestNumberLabel = labelSurface(0.105, 0.125, 'chest-number-anchor');
  chestNumberLabel.node.position.set(0.118, 0.405, (broadcastReadability ? 0.145 : 0.108) * preset.depth + 0.005);
  torso.add(chestNumberLabel.node);
  const backNumberLabel = labelSurface(0.31, 0.38, 'back-number-anchor');
  backNumberLabel.node.position.set(0, 0.31, -(broadcastReadability ? 0.145 : 0.103) * preset.depth - 0.005);
  backNumberLabel.node.rotation.y = Math.PI;
  torso.add(backNumberLabel.node);

  const headAnchor = joint(headPivot, 'headwear-anchor', [0, 0.145, 0]);
  const headband = mesh(GEO.torus, materials.accessory, 'headband', [headW * 1.04, headW * 1.04, headW * 1.04], [0, 0.025, 0]);
  headband.rotation.x = Math.PI / 2;
  headPivot.add(headband);

  const anchors = {
    crest: crestLabel.node,
    chestNumber: chestNumberLabel.node,
    backNumber: backNumberLabel.node,
    number: chestNumberLabel.node,
    chest: chestNumberLabel.node,
    back: backNumberLabel.node,
    head: headAnchor,
    face: headPivot,
    leftHand: leftArm.palmSocket,
    rightHand: rightArm.palmSocket,
    leftFoot: leftLeg.ballSocket,
    rightFoot: rightLeg.ballSocket,
    leftSole: leftLeg.soleSocket,
    rightSole: rightLeg.soleSocket,
    leftAnkle: leftLeg.ankle,
    rightAnkle: rightLeg.ankle,
    tagY: targetHeight + 0.24,
  };

  let currentSkin = {};
  let goalkeeper = !!(options.isGoalkeeper || options.isGK || options.role === 'GK'
    || athleteRecord.position === 'GK' || athleteRecord.role === 'GK' || athlete.isGoalkeeper || athlete.role === 'GK');
  let disposed = false;
  let ownedKitTexture = null;
  let detailLevel = String(options.detailLevel || 'auto').toLowerCase();
  let premiumRenderer = null;
  let premiumStatus = options.modelUrl ? 'waiting-for-adapter' : 'procedural';
  let ballContext = {};
  const scratchTarget = new THREE.Vector3();
  const scratchLocalTarget = new THREE.Vector3();
  const scratchLeft = new THREE.Vector3();
  const scratchRight = new THREE.Vector3();
  const scratchHead = new THREE.Vector3();
  let faceClock = identitySeed * 4.1;
  let blinkClock = 0;
  let nextBlink = trait('blink-gap', 2.2, 5.4);
  let gazeYaw = 0;
  let gazePitch = 0;
  let expression = 'neutral';
  let lastPremiumFrame = null;

  function applySkin(next = {}) {
    if (disposed) return api;
    currentSkin = { ...currentSkin, ...next };
    const effective = { ...DEFAULT_SKIN, ...currentSkin };
    const palette = effective.palette || {};
    const jerseySpec = effective.jersey && typeof effective.jersey === 'object' ? effective.jersey : {};
    const shortsSpec = effective.shorts && typeof effective.shorts === 'object' ? effective.shorts : {};
    const socksSpec = effective.socks && typeof effective.socks === 'object' ? effective.socks : {};
    const bootsSpec = effective.boots && typeof effective.boots === 'object' ? effective.boots : {};
    const gkSpec = effective.goalkeeperKit || (effective.goalkeeper && typeof effective.goalkeeper === 'object' ? effective.goalkeeper : null);
    const explicitGK = effective.isGoalkeeper ?? effective.isGK ?? (effective.goalkeeper === true ? true : undefined);
    if (explicitGK !== undefined) goalkeeper = !!explicitGK;

    const primaryValue = goalkeeper && gkSpec
      ? gkSpec.baseColor
      : (jerseySpec.baseColor ?? palette.base ?? effective.primary ?? effective.kitColor);
    const panelValue = goalkeeper && gkSpec
      ? gkSpec.panelColor
      : (jerseySpec.panelColor ?? palette.panel ?? effective.panel ?? effective.secondary);
    const trimValue = jerseySpec.trimColor ?? palette.trim ?? palette.accent ?? effective.accent ?? effective.glowColor;
    const shortsValue = shortsSpec.baseColor ?? palette.shorts ?? (typeof effective.shorts === 'object' ? undefined : effective.shorts);
    const socksValue = socksSpec.baseColor ?? palette.socks ?? (typeof effective.socks === 'object' ? undefined : effective.socks);
    const bootValue = effective.bootColor ?? athlete.bootColor ?? bootsSpec.defaultColor
      ?? (typeof effective.boots === 'object' ? undefined : effective.boots);
    const printValue = goalkeeper && gkSpec
      ? gkSpec.printColor
      : (palette.print ?? jerseySpec.number?.color ?? effective.printColor);
    const outlineValue = jerseySpec.number?.outlineColor ?? trimValue;

    const primary = setMaterialColor(materials.jersey, primaryValue, DEFAULT_SKIN.primary);
    const secondary = setMaterialColor(materials.jerseySecondary, panelValue, DEFAULT_SKIN.secondary);
    setMaterialColor(materials.panel, panelValue, DEFAULT_SKIN.secondary);
    const accent = setMaterialColor(materials.trim, trimValue, DEFAULT_SKIN.accent);
    setMaterialColor(materials.pattern, jerseySpec.pattern?.colorA ?? trimValue, DEFAULT_SKIN.accent);
    setMaterialColor(materials.shorts, goalkeeper && gkSpec ? gkSpec.baseColor : shortsValue, DEFAULT_SKIN.shorts);
    setMaterialColor(materials.socks, goalkeeper && gkSpec ? gkSpec.baseColor : socksValue, DEFAULT_SKIN.socks);
    setMaterialColor(materials.boots, bootValue, DEFAULT_SKIN.boots);
    setMaterialColor(materials.sole, bootsSpec.soleColor, 0x07080b);
    const luminance = primary.r * 0.299 + primary.g * 0.587 + primary.b * 0.114;
    const darkBroadcastKit = broadcastReadability && luminance < 0.24;

    const accessoryText = String(effective.accessory ?? athlete.accessory ?? '').toLowerCase();
    const identityAccent = accessoryColor(accessoryText, accent);
    materials.accessory.color.copy(identityAccent);
    const gloveValue = effective.gloveColor ?? (accessoryText.includes('glove') ? identityAccent : null)
      ?? effective.goalkeeperGloves ?? (gkSpec ? gkSpec.printColor : null);
    setMaterialColor(materials.gloves, gloveValue, DEFAULT_SKIN.goalkeeperGloves);

    const renderSpec = effective.render || {};
    const glow = clamp(effective.accentGlow ?? renderSpec.emissiveIntensity ?? 0.045, 0, 0.35);
    setEmissive(materials.trim, accent, darkBroadcastKit ? Math.max(glow, 0.24) : glow);
    setEmissive(materials.jersey, darkBroadcastKit ? accent : (renderSpec.emissiveColor ?? primary), darkBroadcastKit ? Math.max(glow * 0.5, 0.045) : glow * 0.16);
    setEmissive(materials.shorts, darkBroadcastKit ? accent : 0x000000, darkBroadcastKit ? 0.024 : 0);
    setEmissive(materials.socks, darkBroadcastKit ? accent : 0x000000, darkBroadcastKit ? 0.035 : 0);
    setEmissive(materials.panel, effective.panelGlow ? accent : 0x000000, effective.panelGlow ? 0.035 : 0);

    const fabric = jerseySpec.material || {};
    const roughness = clamp(fabric.roughness ?? effective.roughness ?? 0.68, 0.28, 0.92);
    const metalness = clamp(fabric.metalness ?? effective.metalness ?? 0.015, 0, 0.18);
    materials.jersey.roughness = roughness;
    materials.jersey.metalness = metalness;
    materials.jerseySecondary.roughness = clamp(roughness - 0.03, 0.25, 0.92);
    materials.jerseySecondary.metalness = metalness;
    materials.panel.roughness = clamp(roughness - 0.09, 0.24, 0.9);
    materials.panel.metalness = metalness;
    materials.pattern.roughness = roughness;

    let jerseyMap = jerseySpec.map ?? effective.jerseyMap ?? effective.map ?? null;
    const authoredDesign = jerseySpec.design ?? effective.design ?? effective.kitDesign;
    const kitFactory = globalThis.CyberligaKitTexture;
    if (authoredDesign?.layers?.length && typeof kitFactory?.createTexture === 'function') {
      try {
        const generated = kitFactory.createTexture(effective, THREE, {
          usage: 'athlete', athleteId: String(identityKey), number: effective.number,
        });
        const texture = generated?.texture?.isTexture ? generated.texture : generated;
        if (texture?.isTexture) {
          if (ownedKitTexture && ownedKitTexture !== texture) ownedKitTexture.dispose();
          ownedKitTexture = texture;
          jerseyMap = texture;
          if ('colorSpace' in jerseyMap) jerseyMap.colorSpace = THREE.SRGBColorSpace;
          jerseyMap.anisotropy = Math.max(jerseyMap.anisotropy || 1, 4);
          jerseyMap.needsUpdate = true;
          group.userData.kitTextureMode = 'authored-layers';
        }
      } catch (error) {
        group.userData.kitTextureError = String(error?.message || error);
      }
    } else if (ownedKitTexture) {
      ownedKitTexture.dispose();
      ownedKitTexture = null;
      group.userData.kitTextureMode = jerseyMap ? 'supplied-map' : 'color-fallback';
    }
    materials.jersey.map = jerseyMap;
    materials.jerseySecondary.map = jerseyMap;
    materials.jersey.normalMap = jerseySpec.normalMap ?? effective.normalMap ?? null;
    materials.jersey.roughnessMap = jerseySpec.roughnessMap ?? effective.roughnessMap ?? null;
    materials.jersey.needsUpdate = true;
    materials.jerseySecondary.needsUpdate = true;

    const authoredPattern = jerseySpec.pattern ?? effective.pattern ?? 'signal';
    const patternText = typeof authoredPattern === 'object'
      ? `${authoredPattern.shaderKey || ''} ${authoredPattern.name || ''} ${authoredPattern.mask || ''}`.toLowerCase()
      : String(authoredPattern).toLowerCase();
    let pattern = patternText;
    if (/refracted|mirage|sunset|gradient|fade/.test(patternText)) pattern = 'gradient';
    else if (/launch|arc|trajectory|sash|diagonal/.test(patternText)) pattern = 'sash';
    else if (/frequency|redline|phase|spectral|solar|radial|signal/.test(patternText)) pattern = 'signal';
    chestPanel.visible = pattern === 'sash' || pattern === 'diagonal' || pattern === 'signal';
    lowerPanel.visible = pattern === 'gradient' || pattern === 'fade';
    yokeL.visible = yokeR.visible = pattern !== 'plain' && pattern !== 'solid';
    const authoredOpacity = typeof authoredPattern === 'object' ? authoredPattern.opacity ?? 0.62 : 0.62;
    materials.pattern.opacity = clamp(authoredOpacity * 0.52, 0.16, 0.46);
    if (pattern === 'halves' || pattern === 'split') {
      chestPanel.visible = true;
      chestPanel.rotation.z = 0;
      chestPanel.scale.set(0.14, 0.50, 1);
      chestPanel.position.set(-0.07, 0.29, 0.104 * preset.depth);
    } else if (pattern === 'hoops') {
      chestPanel.visible = true;
      chestPanel.rotation.z = 0;
      chestPanel.scale.set(0.38, 0.04, 1);
      chestPanel.position.set(0, 0.31, 0.104 * preset.depth);
    } else {
      chestPanel.rotation.z = -0.57;
      chestPanel.scale.set(pattern === 'sash' ? 0.072 : 0.045, 0.50, 1);
      chestPanel.position.set(0, 0.315, 0.104 * preset.depth);
    }

    const accessorySleeve = accessoryText.includes('elbow sleeve');
    const longSleeve = goalkeeper || gkSpec?.sleeve === 'long' || effective.longSleeve === true || effective.sleeves === 'long' || accessorySleeve;
    leftArm.compression.visible = rightArm.compression.visible = longSleeve;
    leftArm.upperSkin.material = rightArm.upperSkin.material = longSleeve ? materials.jerseySecondary : materials.skin;
    leftArm.glove.visible = rightArm.glove.visible = goalkeeper || effective.gloves === true;
    leftArm.captainBand.visible = !!effective.captain;
    rightArm.captainBand.visible = false;
    const wristAccessory = /wrist|finger tape|keeper tape|wrist wrap/.test(accessoryText);
    const leftOnly = accessoryText.includes('left');
    const rightOnly = accessoryText.includes('right');
    const tapeRequested = !!effective.wristTape || wristAccessory;
    leftArm.tape.visible = tapeRequested && !rightOnly;
    rightArm.tape.visible = tapeRequested && !leftOnly;
    const ankleRequested = !!effective.ankleTape || accessoryText.includes('ankle tape');
    leftLeg.ankleTape.visible = ankleRequested && !rightOnly;
    rightLeg.ankleTape.visible = ankleRequested && !leftOnly;
    headband.visible = !!effective.headband || accessoryText.includes('headband');

    const print = printValue ? valueColor(printValue, luminance > 0.52 ? 0x0a0c12 : 0xf8fbff) : null;
    const outline = outlineValue ? valueColor(outlineValue, accent) : null;
    const printCss = print ? `#${print.getHexString()}` : null;
    const outlineCss = outline ? `#${outline.getHexString()}` : null;
    drawNumberLabel(chestNumberLabel, effective.number, '', luminance > 0.52, false, printCss, outlineCss);
    drawNumberLabel(backNumberLabel, effective.number, effective.name ?? effective.playerName, luminance > 0.52, true, printCss, outlineCss);
    const crestMark = effective.crestTexture ?? jerseySpec.crest?.texture ?? jerseySpec.crest?.motif
      ?? effective.crest ?? effective.clubMark ?? effective.clubCode;
    drawCrestLabel(crestLabel, crestMark, accent, secondary);
    premiumRenderer?.applySkin?.(effective, { jerseyMap });
    return api;
  }

  let action = { name: 'idle', progress: 0, previous: 0, side: preferredFoot.startsWith('l') ? -1 : 1, variant: celebrationVariant, sequence: 0 };
  let gaitClock = identitySeed * TAU;
  let smoothedSpeed = 0;
  let smoothedSpeedMps = 0;
  let smoothedAccel = 0;
  let smoothedTurn = 0;
  let footPlantOffset = 0;
  let leftPlant = 0;
  let rightPlant = 0;
  let plantedFoot = null;
  let contactSerial = 0;
  let consumedContactSerial = 0;
  let contactPulse = 0;
  let lastContact = null;
  let shown = neutralPose();

  function setAction(name, progress = 0, side = preferredFoot, variant = celebrationVariant) {
    if (side && typeof side === 'object') {
      variant = side.variant ?? variant;
      side = side.side ?? side.foot ?? preferredFoot;
    }
    const nextName = normalizeAction(name);
    const nextProgress = clamp01(progress);
    const nextSide = sideValue(side);
    const restarted = nextName !== action.name || nextSide !== action.side || nextProgress + 0.08 < action.progress;
    if (restarted) {
      action.sequence += 1;
      action.previous = 0;
    } else {
      action.previous = action.progress;
    }
    action.name = nextName;
    action.progress = nextProgress;
    action.side = nextSide;
    action.variant = clamp(Math.floor(variant), 0, 3);
    const marker = ACTION_CONTACTS[nextName];
    if (marker && action.previous < marker.at && nextProgress >= marker.at) {
      contactSerial += 1;
      contactPulse = 0.14;
      const socketSide = nextSide < 0 ? 'left' : 'right';
      lastContact = {
        serial: contactSerial,
        action: nextName,
        kind: marker.kind,
        progress: marker.at,
        side: socketSide,
        socket: marker.socket === 'head' ? 'head'
          : (marker.socket === 'hand' && /throw-in|keeper-catch/.test(nextName) ? 'bothHands'
            : marker.socket === 'hand' ? `${socketSide}Hand` : `${socketSide}Foot`),
      };
    }
    premiumRenderer?.setAction?.(nextName, nextProgress, nextSide, action.variant);
    return api;
  }

  function setBallContext(context = {}, carrier = true) {
    if (context?.isVector3 || Array.isArray(context)) ballContext = { ball: context, isCarrier: carrier };
    else ballContext = { ...ballContext, ...(context || {}) };
    return api;
  }

  function consumeContact() {
    if (!lastContact || lastContact.serial <= consumedContactSerial) return null;
    consumedContactSerial = lastContact.serial;
    return { ...lastContact };
  }

  function update(dt, speedNorm = 0, motion = {}) {
    if (disposed) return;
    const step = clamp(dt, 0, 0.08);
    const completeContext = motion && Object.prototype.hasOwnProperty.call(motion, 'ball') && Object.prototype.hasOwnProperty.call(motion, 'isCarrier');
    const context = completeContext ? motion : { ...ballContext, ...(motion || {}) };
    const authoredMps = Number.isFinite(context.speedMps) ? Math.abs(context.speedMps)
      : (Number.isFinite(context.speed) ? Math.abs(context.speed)
        : (Number.isFinite(speedNorm) && speedNorm > 1.001 ? Math.abs(speedNorm) : null));
    const desiredSpeed = authoredMps === null ? clamp01(speedNorm) : clamp01(authoredMps / 7.2);
    const desiredMps = authoredMps === null ? desiredSpeed * 7.2 : clamp(authoredMps, 0, 10);
    const motionBlend = 1 - Math.exp(-step * 9);
    smoothedSpeed += (desiredSpeed - smoothedSpeed) * motionBlend;
    smoothedSpeedMps += (desiredMps - smoothedSpeedMps) * motionBlend;
    const accelInput = Number.isFinite(context.acceleration)
      ? clamp(context.acceleration / 6, -1, 1) : clamp(context.accel ?? 0, -1, 1);
    smoothedAccel += (accelInput - smoothedAccel) * motionBlend;
    smoothedTurn += (clamp(context.turn ?? context.turnRate ?? 0, -1, 1) - smoothedTurn) * motionBlend;
    const intensity = clamp01(context.intensity ?? 1);
    const strideLength = THREE.MathUtils.lerp(0.68, 1.72, smooth(smoothedSpeedMps / 7.2)) * strideBias;
    const cycleHz = smoothedSpeedMps < 0.12 ? 0.16 : clamp(smoothedSpeedMps / (2 * strideLength), 0.62, 2.22);
    if (Number.isFinite(context.gaitPhase)) gaitClock = clamp01(context.gaitPhase) * TAU;
    else gaitClock += step * TAU * cycleHz * (0.88 + intensity * 0.12);

    const stride = Math.sin(gaitClock);
    const strideCos = Math.cos(gaitClock);
    leftPlant = Math.pow(Math.max(0, strideCos), 4);
    rightPlant = Math.pow(Math.max(0, -strideCos), 4);
    const contact = Math.max(leftPlant, rightPlant);
    const run = smoothedSpeed;
    const walk = smooth(Math.min(1, smoothedSpeedMps / 2.25));
    const sprint = smooth((smoothedSpeedMps - 4.6) / 2.4);
    const isCarrier = !!context.isCarrier;
    const backward = context.backward === true || context.direction === 'backward' || context.forward < -0.1;
    const direction = backward ? -1 : 1;
    const carryScale = isCarrier ? 0.82 : 1;
    const strideAmp = (0.17 * walk + 0.62 * sprint) * intensity * carryScale * strideBias;
    const armAmp = (0.20 * walk + 0.52 * sprint) * intensity * armDrive;
    const active = actionPose(action.name, action.progress, action.side, goalkeeper, action.variant);
    const loco = 1 - clamp01(active.lock);
    const target = neutralPose();
    if (broadcastReadability) {
      target.lElbowX += 0.075;
      target.rElbowX += 0.075;
    }

    const bob = Math.abs(Math.sin(gaitClock)) * (0.012 * walk + 0.035 * sprint);
    const airborne = clamp01(context.airborne ?? 0);
    target.rootY += bob * loco + airborne * 0.11;
    target.rootRX += direction * (0.035 * walk + 0.14 * sprint) * loco;
    target.rootRX += (Math.max(0, smoothedAccel) * 0.13 + Math.min(0, smoothedAccel) * 0.09 + (context.lean || 0)) * loco;
    if (posture === 'upright') target.rootRX -= 0.035 * run * loco;
    else if (posture === 'low-drive') target.rootRX += 0.055 * run * loco;
    else if (posture === 'power') target.rootRX += 0.030 * run * loco;
    target.rootRZ += -smoothedTurn * (0.05 + run * 0.13) * loco;
    target.hipsRY += stride * 0.055 * run * loco;
    target.hipsRZ += -smoothedTurn * 0.055 * run * loco;
    target.torsoRY += -stride * 0.075 * run * loco;
    target.torsoRZ += smoothedTurn * (0.08 + sprint * 0.05) * run * loco;
    target.headRY += smoothedTurn * 0.06 * run * loco;
    target.headRZ += -smoothedTurn * 0.035 * run * loco;

    target.lLegX += -stride * strideAmp * loco * direction;
    target.rLegX += stride * strideAmp * loco * direction;
    target.lKneeX += (Math.max(0, stride) * 0.62 + contact * 0.06) * run * loco;
    target.rKneeX += (Math.max(0, -stride) * 0.62 + contact * 0.06) * run * loco;
    target.lAnkleX += Math.max(0, -stride) * 0.18 * run * loco;
    target.rAnkleX += Math.max(0, stride) * 0.18 * run * loco;
    target.lArmX += stride * armAmp * loco;
    target.rArmX += -stride * armAmp * loco;
    target.lElbowX += (0.18 + Math.max(0, -stride) * 0.50) * run * loco;
    target.rElbowX += (0.18 + Math.max(0, stride) * 0.50) * run * loco;
    target.lArmZ += -0.11 * sprint * loco;
    target.rArmZ += 0.11 * sprint * loco;

    const locomotionMode = String(context.locomotion ?? context.motionMode ?? '').toLowerCase();
    if (locomotionMode === 'jockey' || locomotionMode === 'defensive') {
      target.rootY -= 0.065 * loco;
      target.torsoRX += 0.10 * loco;
      target.lLegZ -= 0.15 * loco; target.rLegZ += 0.15 * loco;
      target.lKneeX += 0.24 * loco; target.rKneeX += 0.24 * loco;
      target.lArmZ -= 0.40 * loco; target.rArmZ += 0.40 * loco;
      target.lElbowX += 0.30 * loco; target.rElbowX += 0.30 * loco;
    } else if (goalkeeper && (locomotionMode === 'keeper-shuffle' || locomotionMode === 'gk-shuffle')) {
      target.rootY -= 0.085 * loco;
      target.torsoRX += 0.16 * loco;
      target.lLegZ -= 0.19 * loco; target.rLegZ += 0.19 * loco;
      target.lKneeX += 0.30 * loco; target.rKneeX += 0.30 * loco;
      target.lArmX -= 0.34 * loco; target.rArmX -= 0.34 * loco;
      target.lArmZ -= 0.52 * loco; target.rArmZ += 0.52 * loco;
      target.lElbowX += 0.46 * loco; target.rElbowX += 0.46 * loco;
    }

    // Carrying is sport-specific. Soccer keeps a controlled dribble gait, while
    // football locks one arm into a visible chest tuck and lets the free arm pump.
    if (isCarrier && active.lock < 0.45) {
      if (locomotionMode === 'football-carry') {
        target.torsoRX += 0.12;
        target.torsoRY += 0.08;
        target.torsoRZ += -smoothedTurn * 0.055;
        target.rArmX -= 0.78;
        target.rArmZ += 0.32;
        target.rElbowX += 1.28;
        target.rElbowZ += 0.18;
        target.lArmX += stride * 0.12 * loco;
        target.lElbowX += 0.22 * loco;
      } else {
        const leftTouch = beat((gaitClock / TAU + 1) % 1, 0.04, 0.15, 0.28);
        const rightTouch = beat((gaitClock / TAU + 1) % 1, 0.54, 0.65, 0.78);
        target.torsoRX += 0.035;
        target.torsoRZ += -smoothedTurn * 0.035;
        target.lArmZ -= 0.18 + rightTouch * 0.09;
        target.rArmZ += 0.18 + leftTouch * 0.09;
        target.lAnkleX -= leftTouch * 0.18;
        target.rAnkleX -= rightTouch * 0.18;
        target.lLegY -= leftTouch * 0.055;
        target.rLegY += rightTouch * 0.055;
      }
    }

    // Athletic idle: quiet breathing and asymmetric weight transfer, seeded so
    // a lineup never looks like one duplicated animation clip.
    if (run < 0.08 && active.lock < 0.1) {
      const idle = gaitClock * 0.31 + identitySeed * TAU;
      target.rootY += Math.sin(idle * 0.7) * 0.004;
      target.hipsRZ += Math.sin(idle) * 0.018;
      target.torsoRX += Math.sin(idle * 0.73) * 0.012;
      target.torsoRY += Math.sin(idle * 0.41) * 0.018;
      target.headRY += Math.sin(idle * 0.29) * 0.035;
      target.lKneeX += Math.max(0, Math.sin(idle)) * 0.025;
      target.rKneeX += Math.max(0, -Math.sin(idle)) * 0.025;
    }

    // Ball-aware gaze and deterministic scanning. The head does part of the
    // turn and the pupils finish it, avoiding the dead forward stare of the old
    // primitive face. Carrier gaze favours the ball, then scans back upfield.
    const gazeValue = context.gazeTarget ?? context.lookTarget ?? (isCarrier ? context.ball : null);
    let desiredGazeYaw = 0;
    let desiredGazePitch = 0;
    if (vectorLike(gazeValue, scratchTarget)) {
      group.updateMatrixWorld(true);
      scratchLocalTarget.copy(scratchTarget);
      group.worldToLocal(scratchLocalTarget);
      scratchLocalTarget.y -= hipY + 0.70;
      const horizontal = Math.hypot(scratchLocalTarget.x, scratchLocalTarget.z) || 1;
      desiredGazeYaw = clamp(Math.atan2(scratchLocalTarget.x, scratchLocalTarget.z), -0.92, 0.92);
      desiredGazePitch = clamp(-Math.atan2(scratchLocalTarget.y, horizontal), -0.42, 0.62);
      if (isCarrier) {
        const scan = Math.max(0, Math.sin(faceClock * 1.31 + identitySeed * TAU));
        desiredGazePitch *= 0.72 + scan * 0.28;
        desiredGazeYaw += Math.sin(faceClock * 0.83 + identitySeed * 11) * 0.10 * scan;
      }
    } else {
      desiredGazeYaw = Math.sin(faceClock * 0.37 + identitySeed * TAU) * (run < 0.1 ? 0.18 : 0.08);
      desiredGazePitch = run < 0.1 ? -0.025 : 0.02;
    }
    const gazeBlend = 1 - Math.exp(-step * (isCarrier ? 8 : 5));
    gazeYaw += (desiredGazeYaw - gazeYaw) * gazeBlend;
    gazePitch += (desiredGazePitch - gazePitch) * gazeBlend;
    target.headRY += gazeYaw * 0.42;
    target.headRX += gazePitch * 0.34;

    faceClock += step;
    blinkClock += step;
    let blink = 0;
    if (blinkClock >= nextBlink) {
      const phase = (blinkClock - nextBlink) / 0.17;
      blink = Math.sin(Math.PI * clamp01(phase));
      if (phase >= 1) {
        blinkClock = 0;
        nextBlink = 2.25 + (Math.sin(faceClock * 0.73 + identitySeed * 17) * 0.5 + 0.5) * 3.1;
      }
    }
    const inferredExpression = action.name === 'celebrate' ? 'joy'
      : (/fall|tackle|dive|block/.test(action.name) ? 'strain'
        : (isCarrier || /kick|keeper-ready|keeper-catch|throw-in/.test(action.name) ? 'focus' : 'neutral'));
    expression = String(context.expression || inferredExpression).toLowerCase();
    const joy = expression === 'joy' || expression === 'smile' ? 1 : 0;
    const strain = expression === 'strain' || expression === 'grimace' ? 1 : 0;
    const focus = expression === 'focus' || expression === 'determined' ? 1 : 0;
    const squint = clamp01(blink + strain * 0.28 + focus * 0.08);
    eyeSocketL.scale.y = eyeSocketR.scale.y = Math.max(0.07, 1 - squint * 0.93);
    const pupilX = clamp(gazeYaw * 0.010, -0.006, 0.006);
    const pupilY = clamp(-gazePitch * 0.008, -0.0045, 0.0045);
    irisL.position.set(pupilX, pupilY, 0.0062);
    irisR.position.set(pupilX, pupilY, 0.0062);
    glintL.position.set(pupilX - 0.0018, pupilY + 0.0020, 0.0065);
    glintR.position.set(pupilX - 0.0018, pupilY + 0.0020, 0.0065);
    browL.rotation.z = -0.08 + browAngle * 0.12 + focus * 0.18 - strain * 0.10;
    browR.rotation.z = 0.08 - browAngle * 0.12 - focus * 0.18 + strain * 0.10;
    const smileCurve = joy * 0.28 - strain * 0.19;
    mouthLeft.rotation.z = -smileCurve;
    mouthRight.rotation.z = smileCurve;
    mouthLine.scale.y = (broadcastReadability ? 0.0024 : 0.004) * (1 + joy * 2.4 + strain * 0.45);
    mouthGroup.position.y = -0.064 * faceLength + joy * 0.003;

    addPose(target, active.values);
    const poseBlend = 1 - Math.exp(-step * (active.lock > 0.6 ? 22 : 15));
    for (const key of POSE_KEYS) shown[key] += (target[key] - shown[key]) * poseBlend;

    motionRoot.position.set(shown.rootX, shown.rootY, shown.rootZ);
    motionRoot.rotation.set(shown.rootRX, shown.rootRY, shown.rootRZ);
    hips.rotation.set(shown.hipsRX, shown.hipsRY, shown.hipsRZ);
    torso.rotation.set(shown.torsoRX, shown.torsoRY, shown.torsoRZ);
    headPivot.rotation.set(shown.headRX, shown.headRY, shown.headRZ);
    leftArm.upper.rotation.set(shown.lArmX, shown.lArmY, shown.lArmZ);
    rightArm.upper.rotation.set(shown.rArmX, shown.rArmY, shown.rArmZ);
    leftArm.elbow.rotation.set(shown.lElbowX, 0, shown.lElbowZ);
    rightArm.elbow.rotation.set(shown.rElbowX, 0, shown.rElbowZ);
    leftLeg.upper.rotation.set(shown.lLegX, shown.lLegY, shown.lLegZ);
    rightLeg.upper.rotation.set(shown.rLegX, shown.rLegY, shown.rLegZ);
    leftLeg.knee.rotation.set(shown.lKneeX, 0, shown.lKneeZ);
    rightLeg.knee.rotation.set(shown.rKneeX, 0, shown.rKneeZ);
    leftLeg.ankle.rotation.x = shown.lAnkleX;
    rightLeg.ankle.rotation.x = shown.rAnkleX;

    // Lightweight procedural foot planting. The host remains authoritative for
    // translation; this only offsets the animated body enough to keep the stance
    // sole on the ground and exposes exact world sockets for physics/contact.
    group.updateMatrixWorld(true);
    const plantEnabled = airborne < 0.05 && active.lock < 0.34 && run > 0.035;
    plantedFoot = plantEnabled ? (leftPlant >= rightPlant ? 'left' : 'right') : null;
    let desiredPlantOffset = 0;
    if (plantedFoot) {
      const socket = plantedFoot === 'left' ? leftLeg.soleSocket : rightLeg.soleSocket;
      socket.getWorldPosition(scratchLeft);
      group.worldToLocal(scratchLeft);
      const strength = plantedFoot === 'left' ? leftPlant : rightPlant;
      desiredPlantOffset = clamp((0.016 - scratchLeft.y) * strength, -0.025, 0.085);
    }
    footPlantOffset += (desiredPlantOffset - footPlantOffset) * (1 - Math.exp(-step * (plantEnabled ? 24 : 12)));
    motionRoot.position.y = shown.rootY + footPlantOffset;
    group.updateMatrixWorld(true);
    contactPulse = Math.max(0, contactPulse - step);
    if (premiumRenderer) {
      lastPremiumFrame = {
        dt: step, speedNorm: smoothedSpeed, speedMps: smoothedSpeedMps,
        motion: context, action: { ...action }, pose: { ...shown }, plantedFoot, gazeYaw, gazePitch,
      };
      premiumRenderer.update?.(lastPremiumFrame);
    }
  }

  function setDetailLevel(level = 'auto') {
    const normalized = Number.isFinite(level)
      ? (level <= 0 ? 'high' : (level === 1 ? 'medium' : 'low'))
      : String(level || 'auto').toLowerCase();
    detailLevel = ['auto', 'high', 'medium', 'low'].includes(normalized) ? normalized : 'auto';
    group.traverse((node) => {
      if (!node.isLOD || !node.levels?.length) return;
      if (detailLevel === 'auto') {
        node.autoUpdate = true;
        node.levels.forEach((entry, index) => { entry.object.visible = index === 0; });
        return;
      }
      node.autoUpdate = false;
      const category = node.userData.detailCategory || node.parent?.userData?.detailCategory || 'garment';
      const showNear = detailLevel === 'high' || (detailLevel === 'medium' && category === 'face');
      node.levels.forEach((entry, index) => { entry.object.visible = index === (showNear ? 0 : Math.min(1, node.levels.length - 1)); });
    });
    const showFace = detailLevel !== 'low';
    eyeSocketL.visible = eyeSocketR.visible = showFace;
    crestLabel.node.visible = chestNumberLabel.node.visible = backNumberLabel.node.visible = detailLevel !== 'low';
    premiumRenderer?.setDetailLevel?.(detailLevel);
    if (premiumRenderer?.group) {
      const usePremium = detailLevel !== 'low';
      premiumRenderer.group.visible = usePremium;
      motionRoot.visible = !usePremium;
    }
    return api;
  }

  function getFootWorldPosition(side = 'right', target = new THREE.Vector3()) {
    group.updateMatrixWorld(true);
    const usePremium = premiumRenderer?.group?.visible;
    const socket = String(side).toLowerCase().startsWith('l')
      ? (usePremium ? anchors.leftFoot : leftLeg.ballSocket)
      : (usePremium ? anchors.rightFoot : rightLeg.ballSocket);
    return socket.getWorldPosition(target);
  }

  function getContactWorldPosition(target = new THREE.Vector3()) {
    const key = lastContact?.socket;
    if (key === 'bothHands') {
      group.updateMatrixWorld(true);
      anchors.leftHand.getWorldPosition(scratchLeft);
      anchors.rightHand.getWorldPosition(scratchRight);
      return target.copy(scratchLeft).add(scratchRight).multiplyScalar(0.5);
    }
    const socket = key && anchors[key];
    group.updateMatrixWorld(true);
    return (socket || headPivot).getWorldPosition(target);
  }

  function getState() {
    group.updateMatrixWorld(true);
    const usePremium = premiumRenderer?.group?.visible;
    (usePremium ? anchors.leftFoot : leftLeg.ballSocket).getWorldPosition(scratchLeft);
    (usePremium ? anchors.rightFoot : rightLeg.ballSocket).getWorldPosition(scratchRight);
    (usePremium ? anchors.head : headPivot).getWorldPosition(scratchHead);
    const contactPoint = getContactWorldPosition(scratchTarget);
    const gaitPhase = ((gaitClock % TAU) + TAU) % TAU / TAU;
    return {
      renderer: premiumRenderer ? 'premium-glb' : (broadcastReadability ? 'procedural-broadcast' : 'procedural-fallback'),
      premiumStatus,
      premiumQuality: premiumRenderer?.quality || null,
      premiumLimitations: premiumRenderer?.limitations || [],
      disposed,
      detailLevel,
      action: { name: action.name, progress: +action.progress.toFixed(4), side: action.side, variant: action.variant, sequence: action.sequence },
      motion: {
        speedNorm: +smoothedSpeed.toFixed(4), speedMps: +smoothedSpeedMps.toFixed(3),
        accel: +smoothedAccel.toFixed(3), turn: +smoothedTurn.toFixed(3), gaitPhase: +gaitPhase.toFixed(4),
      },
      feet: {
        planted: plantedFoot,
        plantStrength: plantedFoot === 'left' ? +leftPlant.toFixed(3) : (plantedFoot === 'right' ? +rightPlant.toFixed(3) : 0),
        activeTouch: gaitPhase < 0.5 ? 'left' : 'right',
        left: pointRecord(scratchLeft), right: pointRecord(scratchRight),
      },
      face: { expression, blink: +(1 - eyeSocketL.scale.y).toFixed(3), gazeYaw: +gazeYaw.toFixed(3), gazePitch: +gazePitch.toFixed(3), head: pointRecord(scratchHead) },
      contact: lastContact ? {
        ...lastContact,
        active: contactPulse > 0,
        pending: lastContact.serial > consumedContactSerial,
        world: pointRecord(contactPoint),
      } : null,
      skin: {
        name: currentSkin.name || currentSkin.variant || '',
        textureMode: group.userData.kitTextureMode || 'color-fallback',
        goalkeeper,
      },
    };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    premiumRenderer?.dispose?.();
    group.removeFromParent();
    if (ownedKitTexture) ownedKitTexture.dispose();
    for (const mat of Object.values(materials)) mat.dispose();
    for (const label of [crestLabel, chestNumberLabel, backNumberLabel]) {
      label.material.dispose();
      if (label.texture) label.texture.dispose();
    }
  }

  const api = {
    group, headPivot, anchors,
    ready: null,
    update, setAction, setBallContext, getState, consumeContact,
    getFootWorldPosition, getContactWorldPosition,
    applySkin, setDetailLevel, dispose,
  };
  applySkin({
    ...(options.skin || {}),
    primary: options.skin?.primary ?? options.kitColor ?? options.skin?.kitColor,
    accent: options.skin?.accent ?? options.glowColor ?? options.skin?.glowColor,
    captain: options.skin?.captain ?? options.captain,
    headband: options.skin?.headband ?? options.headband,
    isGoalkeeper: options.skin?.isGoalkeeper ?? options.skin?.isGK ?? goalkeeper,
    number: options.skin?.number ?? options.number ?? options.jerseyNumber ?? athleteRecord.shirtNumber ?? athlete.shirtNumber,
    name: options.skin?.name ?? identityName ?? options.jerseyName,
  });
  setDetailLevel(detailLevel);
  update(1 / 60, 0, {});
  group.userData.athleteRig = api;
  group.userData.athleteDNA = {
    ...athlete, height: targetHeight, build: buildName,
    faceWidth, faceLength, jawWidth, cheekScale, noseWidth, noseLength,
    eyeSpacing, eyeScale, browAngle, mouthWidth, lipScale,
  };
  group.userData.athleteRenderer = broadcastReadability ? 'procedural-broadcast' : 'procedural-fallback';

  const modelProfile = options.modelProfile ?? athlete.modelProfile ?? athleteRecord.modelProfile ?? athlete.bodyType;
  const requestedModelUrl = options.modelUrl ?? athlete.modelUrl ?? athleteRecord.modelUrl;
  let queryPremium = false;
  try {
    const query = new URLSearchParams(globalThis.location?.search || '');
    queryPremium = query.get('athletes') === 'premium' || query.get('premiumAthletes') === '1';
  } catch (_) { /* location is optional in headless/non-browser consumers */ }
  const premiumRequested = !!requestedModelUrl || options.usePremiumModel === true || queryPremium;
  const mobileFallback = typeof globalThis.innerWidth === 'number' && globalThis.innerWidth < 800 && options.forcePremiumModel !== true;
  const modelUrl = premiumRequested && !mobileFallback
    ? (requestedModelUrl || universalAthleteModelUrl(modelProfile)) : null;
  const modelAdapter = options.modelAdapter ?? registeredPremiumAdapter ?? (modelUrl ? createUniversalAthleteAdapter() : null);
  if (modelUrl && modelAdapter?.bind) {
    premiumStatus = 'loading';
    const source = options.modelGltf ? Promise.resolve(options.modelGltf) : preloadAthleteModel(modelUrl);
    api.ready = source
      .then((gltf) => modelAdapter.bind({ gltf, rig: api, options, athlete, skin: currentSkin, THREE }))
      .then((bound) => {
        if (!bound?.group?.isObject3D) throw new Error('Athlete model adapter did not return an Object3D group.');
        if (disposed) {
          bound.dispose?.();
          return api;
        }
        premiumRenderer = bound;
        bound.group.name ||= 'premium-athlete-model';
        group.add(bound.group);
        motionRoot.visible = false;
        if (bound.anchors && typeof bound.anchors === 'object') Object.assign(anchors, bound.anchors);
        premiumStatus = 'ready';
        group.userData.athleteRenderer = 'premium-glb';
        group.userData.premiumQuality = premiumRenderer.quality || 'adapter';
        group.userData.premiumLimitations = premiumRenderer.limitations || [];
        premiumRenderer.applySkin?.({ ...DEFAULT_SKIN, ...currentSkin }, { jerseyMap: ownedKitTexture || materials.jersey.map });
        premiumRenderer.setAction?.(action.name, action.progress, action.side, action.variant);
        premiumRenderer.setDetailLevel?.(detailLevel);
        if (lastPremiumFrame) premiumRenderer.update?.(lastPremiumFrame);
        return api;
      })
      .catch((error) => {
        premiumStatus = 'procedural-fallback';
        motionRoot.visible = true;
        group.userData.premiumModelError = String(error?.message || error);
        return api;
      });
  } else {
    premiumStatus = mobileFallback && premiumRequested ? 'mobile-fallback'
      : (modelUrl ? 'adapter-required' : 'procedural');
    api.ready = Promise.resolve(api);
  }
  return api;
}
