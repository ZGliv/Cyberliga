// blobrig.js — the "Classic" CYBERLIGA look: glowing capsule athletes (the original era).
// Implements the same rig API as the alternate renderers so the simulation can swap
// bodies without changing a single sporting decision. The motion language deliberately
// stays non-humanoid: one soft competitive mass, one expressive head, and a ground halo.
import * as THREE from 'three';
import { createClassicCharacterProfile } from './classic-character.js';

export async function preloadClassic() { /* nothing to load — instant */ }

// The original broadcast matchup used cyan against hot pink. Pink needs a bluer
// render feed than its #ff2d78 brand swatch so ACES tone mapping + bloom still
// reads as hot pink instead of clipping toward red.
export const CLASSIC_PLAYER_COLORS = Object.freeze([0x00e5ff, 0xff45d6]);

const classicSideIndex = side => {
  const numeric = Number(side);
  return Number.isFinite(numeric) ? Math.abs(Math.trunc(numeric)) % CLASSIC_PLAYER_COLORS.length : 0;
};

export function classicPlayerColor(side = 0) {
  return CLASSIC_PLAYER_COLORS[classicSideIndex(side)];
}

const identityTextureCache = new Map();
const hexCss = value => `#${new THREE.Color(value ?? 0x7f8a9a).getHexString()}`;
const identityHash = value => {
  let result = 2166136261 >>> 0;
  for (const character of String(value || 'CYB')) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
};

function prepareFoundingLive(athlete, team) {
  const live = globalThis.CyberligaFoundingLive;
  if (!athlete || !team || !live || typeof live.prepare !== 'function') return null;
  return live.prepare(athlete, team);
}

function signedArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current[0] * next[1] - next[0] * current[1];
  }
  return area * 0.5;
}

// Merge every convex prism on one anchor into one geometry. This keeps a complete
// Founder silhouette to one draw call per moving anchor (torso and, only when used,
// head) while allowing paired fins/leaves to count as a single authored cue.
function foundingPrismGeometry(solids) {
  const positions = [];
  const indices = [];
  for (const source of solids) {
    const points = source.points.map(point => [Number(point[0]), Number(point[1])]);
    if (signedArea(points) < 0) points.reverse();
    const count = points.length;
    const base = positions.length / 3;
    const frontZ = source.z + source.depth * 0.5;
    const backZ = source.z - source.depth * 0.5;
    for (const point of points) positions.push(point[0], point[1], frontZ);
    for (const point of points) positions.push(point[0], point[1], backZ);
    for (let index = 1; index < count - 1; index += 1) {
      indices.push(base, base + index, base + index + 1);
      indices.push(base + count, base + count + index + 1, base + count + index);
    }
    for (let index = 0; index < count; index += 1) {
      const next = (index + 1) % count;
      const front = base + index;
      const frontNext = base + next;
      const back = base + count + index;
      const backNext = base + count + next;
      indices.push(front, back, backNext, front, backNext, frontNext);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.foundingTriangleCount = indices.length / 3;
  return geometry;
}

function buildFoundingLiveCues(descriptor, body, headPivot, bodyMaterial, classicColor) {
  const live = globalThis.CyberligaFoundingLive;
  const publicState = descriptor && live && live.describe(descriptor);
  const recipe = publicState && live.recipeFor(descriptor);
  if (!publicState || !recipe) return null;

  const targets = { body, head: headPivot };
  const cueMeshes = [];
  for (const anchor of ['body', 'head']) {
    const entries = recipe.cues.filter(entry => entry.anchor === anchor);
    if (!entries.length) continue;
    const geometry = foundingPrismGeometry(entries.flatMap(entry => entry.solids));
    const mesh = new THREE.Mesh(geometry, bodyMaterial);
    mesh.name = `founding-cue-${anchor}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;
    mesh.raycast = () => {};
    mesh.userData.foundingCueIds = entries.map(entry => entry.id);
    targets[anchor].add(mesh);
    cueMeshes.push(mesh);
  }

  const triangleCount = cueMeshes.reduce((sum, mesh) => sum + (mesh.geometry.userData.foundingTriangleCount || 0), 0);
  return Object.freeze({
    ...publicState,
    meshCount: cueMeshes.length,
    triangleCount,
    classicColor: new THREE.Color(classicColor).getHex(),
  });
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width * 0.5, height * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function paintIdentityPattern(ctx, pattern, color, width, height) {
  const motif = String(pattern || 'pulse').toLowerCase();
  const type = /^(?:speed|flight|wing|serrated|cane|rain|seam)$/.test(motif) ? 'slash'
    : /^(?:fold|weave|woven|bramble|mosaic)$/.test(motif) ? 'weave'
    : /^(?:rings|crystal|spiral|pulse|bell)$/.test(motif) ? 'rings'
    : /^(?:grid|block|steps|porcelain|chalk)$/.test(motif) ? 'grid'
    : /^(?:branch|growth|crown)$/.test(motif) ? 'branch'
    : motif === 'hex' ? 'hex'
    : /^(?:wave|drift|horizon)$/.test(motif) ? 'wave'
    : /^(?:fracture|tension|pit)$/.test(motif) ? 'fracture'
    : /^(?:lantern|snow|swarm)$/.test(motif) ? 'constellation'
    : motif === 'cross' ? 'cross'
    : ['slash', 'weave', 'rings', 'grid'][identityHash(motif) % 4];
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.72;
  ctx.lineWidth = 7;
  if (type === 'slash') {
    for (let x = -height; x < width + height; x += 24) {
      ctx.beginPath(); ctx.moveTo(x, height); ctx.lineTo(x + height, 0); ctx.stroke();
    }
  } else if (type === 'constellation') {
    for (let x = 8; x < width; x += 22) for (let y = 8; y < height; y += 22) {
      const offset = (x / 22) % 2 ? 7 : 0;
      ctx.beginPath(); ctx.arc(x, y + offset, motif === 'snow' ? 3 : 4, 0, Math.PI * 2); ctx.fill();
    }
  } else if (type === 'weave') {
    ctx.beginPath(); ctx.moveTo(0, height * 0.75); ctx.lineTo(width * 0.36, height * 0.25);
    ctx.lineTo(width * 0.64, height * 0.75); ctx.lineTo(width, height * 0.25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, height * 0.25); ctx.lineTo(width * 0.36, height * 0.75);
    ctx.lineTo(width * 0.64, height * 0.25); ctx.lineTo(width, height * 0.75); ctx.stroke();
  } else if (type === 'grid') {
    ctx.strokeRect(10, 9, width - 20, height - 18);
    for (let x = 36; x < width; x += 30) { ctx.beginPath(); ctx.moveTo(x, 9); ctx.lineTo(x, height - 9); ctx.stroke(); }
    for (let y = 31; y < height; y += 28) { ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(width - 10, y); ctx.stroke(); }
  } else if (type === 'rings') {
    for (let radius = 10; radius < width; radius += 18) {
      ctx.beginPath(); ctx.arc(width * 0.5, height * 0.5, radius, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (type === 'hex') {
    for (let row = -1; row < 4; row += 1) for (let column = -1; column < 6; column += 1) {
      const cx = column * 27 + (row % 2 ? 13.5 : 0), cy = row * 24;
      ctx.beginPath();
      for (let point = 0; point <= 6; point += 1) {
        const angle = point * Math.PI / 3, x = cx + Math.cos(angle) * 14, y = cy + Math.sin(angle) * 14;
        point ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  } else if (type === 'wave') {
    for (let row = 0; row < 4; row += 1) {
      ctx.beginPath();
      for (let point = 0; point <= 16; point += 1) {
        const x = point / 16 * width, y = 16 + row * 22 + Math.sin(point * 0.85 + row) * 8;
        point ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  } else if (type === 'branch') {
    ctx.beginPath(); ctx.moveTo(width * 0.5, height); ctx.lineTo(width * 0.5, 5);
    ctx.moveTo(width * 0.5, 62); ctx.lineTo(18, 32); ctx.moveTo(width * 0.5, 62); ctx.lineTo(110, 28);
    ctx.moveTo(width * 0.5, 38); ctx.lineTo(34, 9); ctx.moveTo(width * 0.5, 38); ctx.lineTo(94, 8); ctx.stroke();
  } else if (type === 'fracture') {
    ctx.beginPath(); ctx.moveTo(7, 10); ctx.lineTo(51, 43); ctx.lineTo(31, 58); ctx.lineTo(78, 90);
    ctx.moveTo(121, 4); ctx.lineTo(76, 41); ctx.lineTo(103, 57); ctx.lineTo(58, 91); ctx.stroke();
  } else if (type === 'cross') {
    ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(width - 10, height - 10);
    ctx.moveTo(width - 10, 10); ctx.lineTo(10, height - 10); ctx.stroke();
  }
  ctx.restore();
}

function identityTexture({ teamCode, jerseyNumber, brandColor, accentColor, kitPattern, back = false }) {
  if (typeof document === 'undefined') return null;
  const code = String(teamCode || 'CYB').slice(0, 4).toUpperCase();
  const number = String(jerseyNumber ?? '').slice(0, 2);
  const key = [code, number, brandColor, accentColor, kitPattern, back ? 'back' : 'front'].join('|');
  if (identityTextureCache.has(key)) return identityTextureCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 96;
  const ctx = canvas.getContext('2d');
  const base = hexCss(brandColor ?? 0x1a2533);
  const flash = hexCss(accentColor ?? 0xf3f1e9);
  roundedRect(ctx, 4, 4, 120, 88, 16);
  ctx.fillStyle = base; ctx.fill();
  ctx.save(); roundedRect(ctx, 4, 4, 120, 88, 16); ctx.clip();
  paintIdentityPattern(ctx, kitPattern, flash, 128, 96);
  const shade = ctx.createLinearGradient(0, 0, 128, 96);
  shade.addColorStop(0, 'rgba(255,255,255,.18)');
  shade.addColorStop(0.5, 'rgba(255,255,255,0)');
  shade.addColorStop(1, 'rgba(0,0,0,.34)');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, 128, 96); ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = flash;
  roundedRect(ctx, 4, 4, 120, 88, 16); ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f7fbff'; ctx.strokeStyle = 'rgba(0,0,0,.62)'; ctx.lineJoin = 'round';
  if (back && number) {
    ctx.font = '900 55px Arial, sans-serif'; ctx.lineWidth = 9;
    ctx.strokeText(number, 64, 51); ctx.fillText(number, 64, 51);
  } else {
    ctx.font = '900 27px Arial, sans-serif'; ctx.lineWidth = 7;
    ctx.strokeText(code, 64, number ? 35 : 48); ctx.fillText(code, 64, number ? 35 : 48);
    if (number) {
      ctx.font = '900 28px Arial, sans-serif';
      ctx.strokeText(number, 64, 67); ctx.fillText(number, 64, 67);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  identityTextureCache.set(key, texture);
  return texture;
}

const clamp01 = v => THREE.MathUtils.clamp(v, 0, 1);
const ease = v => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
// A soft authored beat: 0 at `start`, 1 at `peak`, back to 0 at `end`.
const beat = (v, start, peak, end) => {
  if (v <= start || v >= end) return 0;
  return v < peak ? ease((v - start) / (peak - start)) : 1 - ease((v - peak) / (end - peak));
};
const POSE_CHANNELS = [
  'pitch', 'roll', 'lift', 'sx', 'sy', 'sz',
  'headX', 'headY', 'headZ', 'headPitch', 'headRoll', 'ring',
];

const normalizeClassicAction = name => {
  const raw = String(name || 'idle').toLowerCase().replace(/[_\s]+/g, '-');
  const aliases = {
    run: 'idle', locomotion: 'idle', none: 'idle',
    shoot: 'kick', shot: 'kick', pass: 'kick', strike: 'kick', volley: 'kick',
    'short-pass': 'kick', 'driven-pass': 'kick', 'lofted-pass': 'kick',
    'power-shot': 'kick', 'finesse-shot': 'kick', penalty: 'kick', 'keeper-distribution': 'kick',
    throw: 'throw-in', throwin: 'throw-in', 'touchline-throw': 'throw-in',
    celebration: 'celebrate', goal: 'celebrate',
    slide: 'tackle', 'slide-tackle': 'tackle',
    knocked: 'fall', knockdown: 'fall',
    trap: 'receive', control: 'receive', cushion: 'receive',
    brace: 'block', 'shot-block': 'block',
    gkset: 'keeper-ready', 'gk-set': 'keeper-ready', keeper: 'keeper-ready', ready: 'keeper-ready',
    'gk-dive': 'dive', 'keeper-dive': 'dive', save: 'dive',
    catch: 'keeper-catch', 'gk-catch': 'keeper-catch', keepercatch: 'keeper-catch',
  };
  return aliases[raw] || raw;
};

export function buildBlobRig({
  kitColor, glowColor, side, isGK = false, captain = false,
  brandColor, secondaryColor, accentColor, teamCode = '', jerseyNumber = '',
  kitPattern = 'pulse', role = '', athlete = null, foundingTeam = null,
} = {}) {
  const g = new THREE.Group();
  const hasClassicSide = side !== undefined && side !== null;
  const classicColor = hasClassicSide ? classicPlayerColor(side) : null;
  // Neutral callers (officials and old preview tools) may omit colors. Never let
  // Three.js' implicit white default become a full-strength bloom source.
  const resolvedKitColor = hasClassicSide ? classicColor : (kitColor ?? 0x39414f);
  const resolvedGlowColor = hasClassicSide ? classicColor : (glowColor ?? 0x66d9ef);
  const kit = new THREE.Color(resolvedKitColor);
  // Side-assigned athletes—including keepers—must remain the exact cyan/pink
  // matchup colors. Keep the legacy lime keeper treatment only for old callers.
  if (isGK && !hasClassicSide) kit.lerp(new THREE.Color(0xc8ff4d), 0.5);

  // Intentionally opaque. The soft, almost-translucent read comes from emissive
  // color and bloom, not alpha blending (which causes sorting artifacts in crowds).
  const bodyMat = new THREE.MeshStandardMaterial({
    color: kit, roughness: 0.45, emissive: kit, emissiveIntensity: 0.35 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.85, 6, 12), bodyMat);
  body.name = 'torso';
  body.position.y = 1.05;
  body.castShadow = true;

  // The athlete remains unmistakably cyan/pink, while a small club-authored uniform
  // system carries identity at broadcast distance. This deliberately uses the same
  // mark/pattern vocabulary as League HQ instead of recoloring the whole character.
  const hasIdentity = Boolean(teamCode || jerseyNumber || brandColor || accentColor);
  const identityGroup = new THREE.Group();
  identityGroup.name = 'club-uniform-identity';
  if (hasIdentity) {
    const club = new THREE.Color(brandColor ?? 0x263246);
    const trim = new THREE.Color(accentColor ?? secondaryColor ?? 0xf3f1e9);
    const bandMaterial = new THREE.MeshStandardMaterial({
      color: club, emissive: club, emissiveIntensity: 0.12, roughness: 0.68,
    });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.425, 0.052, 6, 22), bandMaterial);
    band.rotation.x = Math.PI / 2;
    band.position.y = -0.23;
    identityGroup.add(band);

    const shoulderGeometry = new THREE.SphereGeometry(0.115, 8, 6);
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: trim, emissive: trim, emissiveIntensity: 0.08, roughness: 0.62,
    });
    for (const x of [-0.39, 0.39]) {
      const shoulder = new THREE.Mesh(shoulderGeometry, trimMaterial);
      shoulder.scale.set(1.18, 0.52, 0.72);
      shoulder.position.set(x, 0.18, 0);
      identityGroup.add(shoulder);
    }

    const frontMap = identityTexture({ teamCode, jerseyNumber, brandColor, accentColor, kitPattern });
    const backMap = identityTexture({ teamCode, jerseyNumber, brandColor, accentColor, kitPattern, back: true });
    const makePatch = (map, z, turn) => {
      const material = new THREE.MeshBasicMaterial({
        map, color: map ? 0xffffff : club, transparent: true, alphaTest: 0.04,
        polygonOffset: true, polygonOffsetFactor: -2,
      });
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.43, 0.31), material);
      patch.position.set(0, 0.12, z); patch.rotation.y = turn;
      return patch;
    };
    identityGroup.add(makePatch(frontMap, 0.405, 0));
    if (jerseyNumber) identityGroup.add(makePatch(backMap, -0.405, Math.PI));
    body.add(identityGroup);
  }

  // Compatibility sockets for sport-specific equipment. They live on the soft
  // mass so gloves/props inherit its squash, lean, and impact animation.
  const leftHand = new THREE.Group();
  leftHand.name = 'left-hand-anchor';
  leftHand.position.set(-0.43, 0.25, 0.08);
  const rightHand = new THREE.Group();
  rightHand.name = 'right-hand-anchor';
  rightHand.position.set(0.43, 0.25, 0.08);
  body.add(leftHand, rightHand);

  const headPivot = new THREE.Group();
  headPivot.position.y = 1.98;
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x10141f, roughness: 0.4, emissive: resolvedGlowColor, emissiveIntensity: 0.15 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), headMat);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.305, 14, 8, -0.7, 2.1, 0.95, 0.9),
    new THREE.MeshBasicMaterial({ color: resolvedGlowColor }));
  headPivot.add(head, visor);

  const ringMat = new THREE.MeshBasicMaterial({
    color: resolvedGlowColor, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 24), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;

  const foundingDescriptor = prepareFoundingLive(athlete, foundingTeam);
  const foundingState = buildFoundingLiveCues(foundingDescriptor, body, headPivot, bodyMat, resolvedKitColor);
  const characterProfile = createClassicCharacterProfile({
    athlete, team: foundingTeam, role, founding: foundingState,
  });
  headPivot.scale.setScalar(characterProfile.headScale);

  g.add(body, headPivot, ring);

  let captainBand = null;
  if (captain) {
    captainBand = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.035, 6, 18),
      new THREE.MeshBasicMaterial({ color: resolvedGlowColor }));
    captainBand.rotation.x = Math.PI / 2;
    captainBand.position.y = 1.45;
    g.add(captainBand);
  }

  // All pose methods write a frame-local intention. update() blends it with locomotion,
  // then releases it toward neutral, so actions remain frame-rate independent and can
  // never leak a permanent bend into the next play.
  const neutral = () => ({
    pitch: 0, roll: 0, lift: 0, sx: 1, sy: 1, sz: 1,
    headX: 0, headY: 0, headZ: 0, headPitch: 0, headRoll: 0, ring: 0,
  });
  let intent = neutral();
  let shown = neutral();
  let bobT = characterProfile.phase;
  let accelS = 0, turnS = 0;

  // A pose is absolute for this frame. Resetting unspecified channels prevents, e.g.,
  // a header's head offset from bleeding into a jockey pose selected on the next tick.
  // The timing and contact frame stay identical for everyone; only the amplitude is
  // filtered through the athlete's authored performance fingerprint.
  const setPose = values => {
    for (const key of POSE_CHANNELS) {
      const base = key === 'sx' || key === 'sy' || key === 'sz' ? 1 : 0;
      const value = values[key] ?? base;
      if (key === 'pitch' || key === 'headPitch') intent[key] = value * (0.82 + characterProfile.snap * 0.18);
      else if (key === 'roll' || key === 'headRoll' || key === 'headX') intent[key] = value * (0.75 + characterProfile.sway * 0.25);
      else if (key === 'lift' || key === 'headY') intent[key] = value * (0.78 + characterProfile.bounce * 0.22);
      else if (key === 'sx' || key === 'sy') intent[key] = 1 + (value - 1) * (0.78 + characterProfile.plant * 0.22);
      else if (key === 'sz') intent[key] = 1 + (value - 1) * (0.80 + characterProfile.lean * 0.20);
      else if (key === 'ring') intent[key] = value * (0.76 + characterProfile.snap * 0.12 + characterProfile.plant * 0.12);
      else intent[key] = value;
    }
  };
  const decayIntent = d => {
    intent.pitch *= d; intent.roll *= d; intent.lift *= d;
    intent.sx = 1 + (intent.sx - 1) * d;
    intent.sy = 1 + (intent.sy - 1) * d;
    intent.sz = 1 + (intent.sz - 1) * d;
    intent.headX *= d; intent.headY *= d; intent.headZ *= d;
    intent.headPitch *= d; intent.headRoll *= d; intent.ring *= d;
  };

  const anchors = {
    back: { x: 0, y: 1.25, z: -0.44 },
    chest: { x: 0, y: 1.3, z: 0.44 },
    tagY: 2.6,
    leftHand,
    rightHand,
    head: headPivot,
    identity: identityGroup,
  };
  let disposed = false;
  let actionState = { name: 'idle', progress: 0, side: 1, variant: 0 };

  const api = {
    group: g,
    headPivot,
    anchors,
    ready: null,

    update(dt, speedNorm = 0, opts = {}) {
      const run = clamp01(speedNorm);
      bobT += dt * (3.4 + run * 9.6) * characterProfile.strideRate;

      // Host acceleration/turn are signed, normalized and simulation-derived. Smooth
      // them inside the renderer: collision spikes become a readable plant, not jitter.
      const motionEase = 1 - Math.exp(-10 * characterProfile.snap * dt);
      accelS += ((opts.accel || 0) - accelS) * motionEase;
      turnS += ((opts.turn || 0) - turnS) * motionEase;

      // The stride has an airborne crest and a very short, wide contact. This makes the
      // blobs look planted even though they have no feet. Braking/cutting visibly dumps
      // their center of gravity; acceleration pulls them into a long forward droplet.
      const stride = Math.sin(bobT);
      const airborne = Math.abs(stride);
      const plant = Math.pow(1 - airborne, 4);
      const drive = Math.max(accelS, 0);
      const brake = Math.max(-accelS, 0);
      const cut = Math.abs(turnS) * run * characterProfile.turn;
      const bob = airborne * run * 0.105 * characterProfile.bounce;
      const breath = Math.sin(bobT * 0.38 * characterProfile.breathRate + characterProfile.phase) * (1 - run) * 0.012;
      const signatureSway = Math.sin(bobT * 0.52 + characterProfile.phase) * run * 0.018 * characterProfile.sway;
      const locSY = 1 + breath + run * 0.035 - plant * run * 0.075 * characterProfile.plant
        + drive * 0.075 * characterProfile.lean - brake * 0.105 * characterProfile.plant - cut * 0.045;
      const locSX = 1 + plant * run * 0.065 * characterProfile.plant
        + brake * 0.095 * characterProfile.plant + cut * 0.085;
      const locSZ = 1 + run * 0.045 + drive * 0.10 * characterProfile.lean - brake * 0.035;

      const poseEase = 1 - Math.exp(-18 * dt);
      for (const key of POSE_CHANNELS) shown[key] += (intent[key] - shown[key]) * poseEase;

      const sx = THREE.MathUtils.clamp(shown.sx * locSX, 0.68, 1.36);
      const sy = THREE.MathUtils.clamp(shown.sy * locSY, 0.62, 1.34);
      const sz = THREE.MathUtils.clamp(shown.sz * locSZ, 0.70, 1.48);
      body.scale.set(
        sx * characterProfile.width,
        sy * characterProfile.stature,
        sz * characterProfile.depth,
      );

      // Keep the soft mass grounded as it squashes instead of letting its bottom float.
      // The head follows the body's top but lags on starts, stops, and lateral cuts.
      body.position.y = 0.20 + 0.85 * sy * characterProfile.stature + bob + shown.lift;
      body.rotation.x = THREE.MathUtils.lerp(body.rotation.x,
        shown.pitch + drive * 0.27 * characterProfile.lean - brake * 0.20
          + run * 0.055 * characterProfile.lean, 1 - Math.exp(-13 * characterProfile.snap * dt));
      body.rotation.z = THREE.MathUtils.lerp(body.rotation.z,
        shown.roll - turnS * characterProfile.turn * (0.22 + run * 0.24) + signatureSway,
        1 - Math.exp(-13 * characterProfile.snap * dt));

      headPivot.position.x = shown.headX + turnS * run * 0.055;
      headPivot.position.y = 0.20 + 1.78 * sy * characterProfile.stature + bob + shown.lift + shown.headY;
      headPivot.position.z = shown.headZ - drive * 0.055 + brake * 0.045;
      headPivot.rotation.x = THREE.MathUtils.lerp(headPivot.rotation.x,
        shown.headPitch - drive * 0.10 + brake * 0.08, 1 - Math.exp(-15 * dt));
      headPivot.rotation.z = THREE.MathUtils.lerp(headPivot.rotation.z,
        shown.headRoll + turnS * run * 0.09, 1 - Math.exp(-15 * dt));

      // The halo acts like a contact shadow and impact meter: it widens on a plant and
      // flares at the authored contact beat, preserving readability from the wide camera.
      const haloX = characterProfile.width * (1 + plant * run * 0.12 * characterProfile.plant
        + cut * 0.12 + shown.ring * 0.30);
      const haloZ = characterProfile.depth * (1 + plant * run * 0.08 * characterProfile.plant
        + drive * 0.12 * characterProfile.lean + shown.ring * 0.30);
      ring.scale.set(haloX, haloZ, 1);
      ringMat.opacity = THREE.MathUtils.clamp(0.32 + run * 0.26 + shown.ring * 0.34, 0.25, 0.92);
      bodyMat.emissiveIntensity = 0.35 + shown.ring * 0.20 + drive * 0.05;
      headMat.emissiveIntensity = 0.15 + shown.ring * 0.08;

      if (captainBand) {
        captainBand.position.y = body.position.y + 0.40 * sy;
        captainBand.scale.set(sx, sz, sy);
        captainBand.rotation.z = body.rotation.z * 0.35;
      }

      // Equivalent to the old 0.85 release per 60 Hz frame, but independent of refresh.
      decayIntent(Math.pow(0.85, dt * 60));
    },

    // AthleteRig-compatible action adapter. Existing arenas may keep calling the
    // authored pose methods directly; football can use one generic surface.
    setAction(name, progress = 0, actionSide = 1, variant = 0) {
      if (actionSide && typeof actionSide === 'object') {
        variant = actionSide.variant ?? variant;
        actionSide = actionSide.side ?? actionSide.foot ?? 1;
      }
      const normalized = normalizeClassicAction(name);
      const k = clamp01(Number.isFinite(Number(progress)) ? Number(progress) : 0);
      const poseSide = typeof actionSide === 'string'
        ? (/left|^-/.test(actionSide.toLowerCase()) ? -1 : 1)
        : (Number(actionSide) < 0 ? -1 : 1);
      const poseVariant = THREE.MathUtils.clamp(Math.trunc(Number(variant) || 0), 0, 3);
      actionState = { name: normalized, progress: k, side: poseSide, variant: poseVariant };

      switch (normalized) {
        case 'kick': api.poseKick(k, poseSide > 0 ? 1 : 0); break;
        case 'header': api.poseHeader(k); break;
        case 'throw-in': api.poseThrowIn(k); break;
        case 'dive': api.poseDive(poseSide, k); break;
        case 'fall': api.poseFall(k); break;
        case 'get-up': api.poseGetUp(k); break;
        case 'celebrate': api.poseCelebrate(k, poseVariant); break;
        case 'skill': {
          const moves = ['stepover', 'bodyfeint', 'dragback', 'roulette'];
          api.poseSkill(moves[poseVariant], k);
          break;
        }
        case 'tackle': api.poseSlideTackle(k); break;
        case 'receive':
        case 'block': api.poseShield(k, poseSide); break;
        case 'jockey': api.poseJockey(k * 4, poseSide); break;
        case 'keeper-ready': api.poseGKSet(k * 4); break;
        case 'keeper-shuffle': api.poseGKShuffle(k * 4, poseSide); break;
        case 'keeper-catch': api.poseGKCatch(k); break;
        case 'keeper-scoop': api.poseGKScoop(k); break;
        case 'keeper-punch': api.poseGKPunch(k); break;
        case 'limp': api.poseLimp(k * 4); break;
        case 'trudge': api.poseTrudge(k * 4); break;
        case 'exhausted': api.poseExhausted(k * 4); break;
        case 'knee-slide': api.poseKneeSlide(k); break;
        case 'argue': api.poseArgue(k * 4); break;
        case 'point-to-spot': api.posePointToSpot(k * 4); break;
        case 'whistle': api.poseWhistle(k * 4); break;
        default: setPose({}); break;
      }
      return api;
    },

    // Classic blobs deliberately ignore authored skins, LOD requests, and gaze/ball
    // context. Returning the rig keeps compatibility hooks safely chainable.
    setBallContext() { return api; },
    setDetailLevel() { return api; },
    applySkin() { return api; },
    getState() {
      return {
        renderer: 'classic-blob',
        disposed,
        detailLevel: 'classic',
        side: hasClassicSide ? classicSideIndex(side) : null,
        colors: {
          kit: kit.getHex(),
          glow: new THREE.Color(resolvedGlowColor).getHex(),
        },
        action: { ...actionState },
        identity: {
          teamCode: String(teamCode || ''),
          jerseyNumber: String(jerseyNumber ?? ''),
          kitPattern: String(kitPattern || ''),
          role: String(role || ''),
          visible: hasIdentity,
          founding: foundingState,
          characterProfile,
        },
      };
    },

    clearOverlay() {
      intent = neutral(); shown = neutral(); accelS = 0; turnS = 0;
      body.position.y = 1.05; body.scale.set(1, 1, 1); body.rotation.set(0, 0, 0);
      headPivot.position.set(0, 1.98, 0); headPivot.rotation.x = 0; headPivot.rotation.z = 0;
      ring.scale.set(1, 1, 1); ringMat.opacity = 0.55;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      g.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else if (o.material) o.material.dispose();
      });
    },

    // Every major action is an authored three-beat sentence: load → contact → release.
    // Contact positions match the host's actual ball-strike timing (kick .45, header .65).
    poseKick(k, leg = 0) {
      const load = beat(k, 0.02, 0.30, 0.45);
      const hit = beat(k, 0.37, 0.45, 0.57);
      const follow = beat(k, 0.45, 0.68, 1.0);
      const side = leg ? 1 : -1;
      setPose({
        pitch: 0.32 * load - 0.88 * hit - 0.43 * follow,
        roll: side * (0.15 * load - 0.27 * hit + 0.10 * follow),
        lift: 0.03 * load + 0.13 * hit - 0.025 * follow,
        sx: 1 + 0.15 * load - 0.07 * hit,
        sy: 1 - 0.18 * load + 0.14 * hit + 0.035 * follow,
        sz: 1 - 0.06 * load + 0.19 * hit + 0.10 * follow,
        headX: side * (-0.04 * load + 0.07 * hit),
        headPitch: 0.16 * load - 0.36 * hit - 0.12 * follow,
        headRoll: side * 0.12 * hit,
        ring: 0.92 * hit + 0.20 * follow,
      });
    },

    poseHeader(k) {
      const crouch = beat(k, 0.02, 0.38, 0.58);
      const contact = beat(k, 0.48, 0.65, 0.78);
      const land = beat(k, 0.66, 0.86, 1.0);
      setPose({
        pitch: 0.28 * crouch - 0.50 * contact + 0.20 * land,
        lift: -0.06 * crouch + 0.58 * contact + 0.18 * land,
        sx: 1 + 0.16 * crouch - 0.08 * contact + 0.10 * land,
        sy: 1 - 0.22 * crouch + 0.18 * contact - 0.10 * land,
        sz: 1 + 0.13 * contact,
        headY: 0.08 * contact,
        headZ: 0.14 * contact,
        headPitch: 0.22 * crouch - 0.62 * contact + 0.22 * land,
        ring: 0.85 * contact + 0.18 * land,
      });
    },

    poseThrowIn(k) {
      const load = beat(k, 0.02, 0.38, 0.64);
      const release = beat(k, 0.54, 0.65, 0.76);
      const settle = beat(k, 0.65, 0.82, 1.0);
      setPose({
        pitch: 0.52 * load - 0.78 * release - 0.28 * settle,
        lift: -0.06 * load + 0.18 * release,
        sx: 1 + 0.12 * load,
        sy: 1 - 0.16 * load + 0.16 * release,
        sz: 1 - 0.08 * load + 0.18 * release,
        headPitch: 0.24 * load - 0.34 * release,
        headZ: -0.08 * load + 0.09 * release,
        ring: 0.75 * release,
      });
    },

    poseDive(side, k, targetY = 1) {
      const s = side >= 0 ? 1 : -1;
      const launch = beat(k, 0, 0.18, 0.43);
      const travel = ease(k);
      const air = Math.sin(clamp01(k) * Math.PI);
      // A zero target is how legacy replay clips encode "height unavailable"; keep the
      // established mid-height arc instead of mistaking those recordings for grass-cutters.
      const high = targetY > 0 ? clamp01((targetY - 0.30) / 2.4) : 0.42;
      setPose({
        pitch: -0.10 * launch,
        roll: s * (0.18 * launch + 1.28 * travel),
        lift: launch * (0.12 + high * 0.28) + air * high * 0.24 - travel * (0.18 - high * 0.08),
        sx: 1 - 0.13 * travel,
        sy: 1 + 0.15 * launch + 0.10 * travel,
        sz: 1 + 0.18 * launch,
        headX: s * 0.12 * travel,
        headY: 0.10 * high * air,
        headRoll: s * 0.28 * travel,
        ring: 0.88 * launch + 0.20 * air,
      });
    },

    poseFall(k) {
      const drop = ease(k);
      const impact = beat(k, 0.55, 0.78, 1.0);
      setPose({ pitch: 1.38 * drop, lift: -0.50 * drop, sx: 1 + 0.13 * impact,
        sy: 1 - 0.16 * impact, sz: 1 + 0.12 * drop, headPitch: 0.28 * drop,
        headY: -0.12 * drop, ring: 0.55 * impact });
    },
    poseGetUp(k) {
      const down = 1 - ease(k);
      const push = beat(k, 0.08, 0.48, 0.88);
      setPose({ pitch: 1.38 * down, lift: -0.50 * down + 0.06 * push,
        sx: 1 + 0.12 * down, sy: 1 - 0.14 * down + 0.08 * push,
        headPitch: 0.24 * down - 0.18 * push, ring: 0.22 * push });
    },

    poseCelebrate(t, variant = characterProfile.celebrationVariant) {
      const v = Math.abs(Math.round(variant)) % 4;
      const pulse = Math.sin(t * (v === 3 ? 7.2 : 5.7) + v * 0.8);
      const hop = Math.max(pulse, 0);
      const land = Math.max(-pulse, 0);
      const sway = Math.sin(t * (v === 2 ? 10 : 3.5) + v);
      setPose({
        pitch: v === 1 ? -0.28 * hop : -0.10 * hop,
        roll: sway * (v === 2 ? 0.24 : 0.13),
        lift: hop * (v === 3 ? 0.46 : 0.30),
        sx: 1 + land * 0.15 - hop * 0.05,
        sy: 1 - land * 0.18 + hop * 0.12,
        sz: 1 + (v === 1 ? hop * 0.14 : land * 0.05),
        headX: sway * 0.05,
        headY: hop * 0.06,
        headRoll: -sway * 0.17,
        ring: 0.32 + hop * 0.48,
      });
    },

    poseSkill(move, k) {
      const snap = Math.sin(clamp01(k) * Math.PI);
      const side = Math.sin(clamp01(k) * Math.PI * 2);
      const roulette = move === 'roulette';
      const dragback = move === 'dragback';
      setPose({
        pitch: dragback ? 0.35 * snap : -0.12 * snap,
        roll: (roulette ? side * 0.46 : side * 0.28),
        lift: roulette ? 0.12 * snap : 0.03 * snap,
        sx: 1 + 0.14 * snap,
        sy: 1 - 0.13 * snap,
        sz: 1 + (dragback ? 0.16 : 0.08) * snap,
        headX: -side * 0.08,
        headRoll: -side * 0.20,
        ring: 0.42 * snap,
      });
    },

    poseArgue(t) {
      const jab = Math.max(0, Math.sin(t * 7.5));
      const wag = Math.sin(t * 5.2);
      setPose({ pitch: -0.28 - jab * 0.16, roll: wag * 0.11, sx: 1.08,
        sy: 0.94, sz: 1.10 + jab * 0.06, headZ: 0.07 + jab * 0.06,
        headRoll: -wag * 0.22, ring: jab * 0.18 });
    },
    poseShield(k, side = 1) {
      const brace = Math.sin(clamp01(k) * Math.PI);
      setPose({ pitch: 0.18, roll: Math.sign(side || 1) * (0.28 + 0.10 * brace),
        lift: -0.10, sx: 1.13, sy: 0.88, sz: 1.10, headRoll: -Math.sign(side || 1) * 0.13 });
    },
    poseSlideTackle(k) {
      const load = beat(k, 0, 0.12, 0.28);
      const launch = ease(k);
      const impact = beat(k, 0.24, 0.52, 0.84);
      setPose({ pitch: -0.18 * load + 1.16 * launch, lift: -0.42 * launch,
        sx: 1 + 0.13 * load + 0.10 * impact, sy: 1 - 0.18 * impact,
        sz: 1 + 0.34 * launch, headPitch: 0.22 * launch,
        headY: -0.08 * launch, ring: 0.72 * launch });
    },
    poseJockey(t, side = 1) {
      const step = Math.sin(t * 5.4);
      setPose({ pitch: 0.20, roll: Math.sign(side || 1) * step * 0.17,
        lift: -0.12 + Math.abs(step) * 0.025, sx: 1.15, sy: 0.88,
        sz: 1.05, headX: -Math.sign(side || 1) * step * 0.055,
        headRoll: -Math.sign(side || 1) * step * 0.12 });
    },

    // Goalkeeper vocabulary: a pulsing set, unmistakable lateral shuffle, secure claim,
    // long-barrier scoop, and a compact punch. These remain one-mass motions—not arms.
    poseGKSet(t) {
      const pulse = (Math.sin(t * 4.2) + 1) * 0.5;
      setPose({ pitch: 0.18, lift: -0.12 - pulse * 0.025, sx: 1.13 + pulse * 0.025,
        sy: 0.90 - pulse * 0.025, sz: 1.04, headZ: 0.035, ring: pulse * 0.10 });
    },
    poseGKShuffle(t, dir = 1) {
      const step = Math.sin(t * 8.2);
      const plant = Math.pow(Math.abs(Math.cos(t * 8.2)), 4);
      const s = Math.sign(dir || 1);
      setPose({ pitch: 0.16, roll: -s * (0.17 + step * 0.09), lift: -0.10 + Math.abs(step) * 0.045,
        sx: 1.13 + plant * 0.08, sy: 0.90 - plant * 0.08, sz: 1.02,
        headX: s * 0.065, headRoll: s * 0.10, ring: plant * 0.16 });
    },
    poseGKCatch(k) {
      const catchBeat = k >= 0.99 ? 0.35 : beat(k, 0.30, 0.62, 0.95);
      setPose({ pitch: 0.25, lift: -0.04, sx: 1.18 + catchBeat * 0.08,
        sy: 0.88, sz: 1.16, headY: -0.06, headZ: 0.055,
        headPitch: 0.18, ring: 0.28 + catchBeat * 0.30 });
    },
    poseGKScoop(k) {
      const lower = ease(k);
      const secure = beat(k, 0.25, 0.62, 1.0);
      setPose({ pitch: 0.72 * lower, lift: -0.23 * lower,
        sx: 1 + 0.18 * secure, sy: 1 - 0.24 * lower,
        sz: 1 + 0.18 * lower, headY: -0.12 * lower,
        headZ: 0.08 * lower, headPitch: 0.30 * lower, ring: 0.28 * secure });
    },
    poseGKPunch(k) {
      const load = beat(k, 0, 0.30, 0.46);
      const hit = beat(k, 0.38, 0.52, 0.68);
      setPose({ pitch: 0.20 * load - 0.58 * hit, lift: 0.32 * hit,
        sx: 1 + 0.12 * load, sy: 1 - 0.12 * load + 0.16 * hit,
        sz: 1 + 0.19 * hit, headPitch: -0.28 * hit, ring: 0.82 * hit });
    },

    poseLimp(t) {
      const step = Math.sin(t * 4.6);
      const hurt = Math.max(0, step);
      setPose({ pitch: 0.18, roll: 0.16 + step * 0.15, lift: -0.07 - hurt * 0.05,
        sx: 1.06 + hurt * 0.07, sy: 0.93 - hurt * 0.08,
        headRoll: -0.12 - step * 0.08 });
    },
    poseTrudge(t) {
      const drag = Math.max(0, Math.sin(t * 3.3));
      setPose({ pitch: 0.40, lift: -0.10 - drag * 0.03, sx: 1.07,
        sy: 0.91 - drag * 0.04, headY: -0.12, headPitch: 0.22, ring: 0 });
    },
    poseExhausted(t) {
      const breath = (Math.sin(t * 2.5) + 1) * 0.5;
      setPose({ pitch: 0.54, lift: -0.22, sx: 1.10 + breath * 0.035,
        sy: 0.82 + breath * 0.045, sz: 1.08, headY: -0.15 + breath * 0.025,
        headZ: 0.05, headPitch: 0.28 });
    },
    poseKneeSlide(k) {
      const drop = ease(k / 0.34);
      const glide = ease(k);
      setPose({ pitch: -0.16 - 0.50 * glide, lift: -0.38 * drop,
        sx: 1 + 0.12 * drop, sy: 1 - 0.17 * drop,
        sz: 1 + 0.30 * glide, headY: 0.04 * (1 - drop),
        headPitch: -0.18 * glide, ring: 0.30 + 0.35 * (1 - glide) });
    },
    posePointToSpot(t) {
      const stab = Math.max(0, Math.sin(t * 6));
      setPose({ pitch: 0.30, roll: 0.22, sx: 1.08, sy: 0.93,
        headX: 0.06, headRoll: -0.18, ring: stab * 0.12 });
    },
    poseWhistle(t) {
      const pulse = (Math.sin(t * 12) + 1) * 0.5;
      setPose({ pitch: -0.15, lift: pulse * 0.025, sx: 1 + pulse * 0.06,
        sy: 1 - pulse * 0.045, headZ: 0.05, headPitch: -0.10,
        ring: pulse * 0.34 });
    },
  };
  api.ready = Promise.resolve(api);
  g.userData.athleteRig = api;
  g.userData.athleteRenderer = 'classic-blob';
  if (foundingState) g.userData.foundingCue = foundingState;
  return api;
}
