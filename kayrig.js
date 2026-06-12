// kayrig.js — KayKit character player rig for Cyberliga.
// Drop-in replacement for humanrig.js: identical public API, but bodies are
// CC0 KayKit adventurer/skeleton characters (./skins/*.glb) with ~76 baked
// animation clips each. Architecture: CLIPS FIRST, PROCEDURAL SECOND.
//
//   - Locomotion: AnimationMixer crossfade Unarmed_Idle <-> Walking_X <->
//     Running_X by speedNorm, cadence via timeScale. Walk/Run variants are
//     picked per-rig (seeded) for personality.
//   - Host-scrubbed poses (poseKick(k), poseFall(k), ...): the matching clip
//     action is played PAUSED and we set action.time = k * duration each
//     frame — the HOST keeps full timing authority, exactly like humanrig's
//     k-driven procedural poses. Looped poses (celebrate/jockey/GK set/...)
//     run the clip normally at a chosen timeScale.
//   - Every pose entry/exit crossfades over ~0.12s in / ~0.16s out (manual
//     per-action weight lerp), and full-body poses fade locomotion weight to
//     0 while active. Zero snapping.
//   - A small procedural layer runs AFTER the mixer: additive bone rotations
//     (accel lean / turn bank / head-down trudge / limp hip dip / referee
//     arm poses / dive) and an internal tilt node for ground-rooted moves —
//     the host's group transform is never written.
//
// Conventions (matching humanrig.js / the host):
//   - ~1.9 units tall, origin at the feet, wrapper group forward = +Z.
//     (KayKit GLBs natively face +Z — no yaw flip needed; verified visually
//     in kayrigtest.html with a forward arrow.)
//   - The HOST owns group.position/rotation.y/scale and headPivot.rotation.y.
//   - rig.update(dt, speedNorm, opts) is REQUIRED every frame; poses are
//     one-call-per-frame BEFORE update().
//
// NEW vs humanrig: buildPlayerRig accepts an optional `character` param:
//   'Knight' | 'Barbarian' | 'Mage' | 'Rogue' | 'Skeleton_Warrior' |
//   'Skeleton_Minion' | 'Skeleton_Mage' | 'Skeleton_Rogue'   (default Knight)

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

// ---- shared GLTF cache (all 8 characters preloaded in parallel) ----
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
const _YAXIS = new THREE.Vector3(0, 1, 0);
const _gkColor = new THREE.Color(0xc8ff4d);
const _hsl = { h: 0, s: 0, l: 0 };

const BLEND_IN = 1 / 0.12;   // pose weight ease-in
const BLEND_OUT = 1 / 0.16;  // pose weight ease-out

function saturate(color, amount) {
  color.getHSL(_hsl);
  color.setHSL(_hsl.h, clamp(_hsl.s * (1 + amount) + 0.1, 0, 1), _hsl.l);
}

// bones we add procedural rotation to (KayKit rig names)
const PROC_BONES = [
  'head', 'spine', 'chest', 'hips',
  'upperarml', 'upperarmr', 'lowerarml', 'lowerarmr',
  'upperlegl', 'upperlegr',
];

export function buildPlayerRig({ kitColor, glowColor, skinTone, hairColor, isGK = false, headband = false, captain = false, pattern = 'solid', character = 'Knight' }) {
  const data = _cache[character] || _cache.Knight;
  if (!data) throw new Error('kayrig: call preloadHumanModel() and await it before buildPlayerRig()');
  const clips = data.clips;

  // group (host-owned) > tilt (pose-owned pitch/roll/y) > inner (scale) > model
  const group = new THREE.Group();
  const tilt = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.setScalar(data.scale);   // KayKit faces +Z already; origin at feet
  group.add(tilt);
  tilt.add(inner);

  const model = SkeletonUtils.clone(data.scene);
  inner.add(model);

  // ---- tint: clone each SOURCE material exactly once per rig ----
  const kit = new THREE.Color(kitColor);
  if (isGK) kit.lerp(_gkColor, 0.8);                 // keepers read lime
  const glow = new THREE.Color(glowColor);
  const matClones = new Map();                       // src uuid -> clone
  const ownedMaterials = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    if (PROP_RE.test(o.name)) { o.visible = false; return; } // no swords on the pitch
    o.castShadow = true;
    o.frustumCulled = false;                         // skinned bounds lag the pose
    let m = matClones.get(o.material.uuid);
    if (!m) {
      m = o.material.clone();
      // lerp toward the kit color so the baked texture detail survives,
      // then boost saturation so team identity pops under the floodlights
      if (m.color) { m.color.lerp(kit, 0.45); saturate(m.color, pattern === 'accent' ? 0.9 : 0.6); }
      if (m.emissive) { m.emissive.copy(glow); m.emissiveIntensity = pattern === 'accent' ? 0.22 : 0.1; }
      matClones.set(o.material.uuid, m);
      ownedMaterials.push(m);
    }
    o.material = m;
    // skeleton eye sockets glow hard in the team accent
    if (/eyes/i.test(o.name) && m.emissive) m.emissiveIntensity = 0.9;
  });
  void skinTone; void hairColor; // baked textures; accepted for API parity

  // ---- bone lookup + bind-pose snapshot ----
  // Post-mixer additive writes (head look, procedural channels) would
  // accumulate forever on bones the active clips don't track, so every
  // update() first restores the bind pose; the mixer then overwrites
  // whatever it actually animates. ~41 copies/frame — negligible.
  const bones = {};
  const bindPose = [];
  model.traverse((o) => {
    if (!o.isBone) return;
    bones[o.name] = o;
    bindPose.push({ bone: o, q: o.quaternion.clone(), p: o.position.clone() });
  });

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
  if (captain && bones['upperarmr']) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.105, 0.024, 5, 12),
      new THREE.MeshBasicMaterial({ color: glow }));
    band.rotation.x = Math.PI / 2;     // ring around the bone's long (y) axis
    band.position.y = 0.13;
    bones['upperarmr'].add(band);
    ownedMaterials.push(band.material);
  }

  // ---- mixer + lazily-created clip actions ----
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

  // per-rig personality: pick locomotion clip variants + desync phases
  const seed = Math.random() * 1000;
  const runName = Math.sin(seed * 12.9898) > 0 ? 'Running_A' : 'Running_B';
  const walkName = ['Walking_A', 'Walking_B', 'Walking_C'][Math.abs((seed * 7919) | 0) % 3];
  const idleAct = act('Unarmed_Idle') || act('Idle');
  const walkAct = act(walkName);
  const runAct = act(runName);
  idleAct.setEffectiveWeight(1);
  idleAct.time = (seed % 1) * idleAct.getClip().duration;
  walkAct.time = (seed % 1) * walkAct.getClip().duration;
  runAct.time = (seed % 1) * runAct.getClip().duration;
  const persCadence = 0.92 + (seed % 1) * 0.16;     // stride-rate personality

  // ---- pose request state (one pose call per frame, consumed by update) ----
  // req: { name, scrub(0..1 time fraction)|null, ts (loop timeScale), full }
  const poseWs = {};                   // clip name -> current blend weight
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
    scrubReq('Jump_Full_Short', clamp(k, 0, 1));
    set('head', -0.35 * bell(clamp((k - 0.45) / 0.3, 0, 1)), 0, 0); // neck snap at apex
  }

  function poseThrowIn(k) { scrubReq('Throw', clamp(k, 0, 1)); }

  function poseFall(k) { scrubReq('Death_A', clamp(k, 0, 1)); }

  function poseGetUp(k) { scrubReq('Lie_StandUp', clamp(k, 0, 1)); }

  // 4 distinct fun celebration variants, looped — host passes t + variant
  const CELEB = ['Cheer', 'Spellcast_Raise', 'Jump_Idle', 'Use_Item'];
  function poseCelebrate(t, variant) {
    const v = Math.abs(variant | 0) % 4;
    loopReq(CELEB[v], v === 1 ? 0.9 : 1);
    if (v === 2) {              // airborne float pose: bounce it off the turf
      const hop = Math.abs(Math.sin(t * 6));
      setTilt(0, 0, hop * 0.28);
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
    loopReq(side >= 0 ? 'Running_Strafe_Left' : 'Running_Strafe_Right', 0.55);
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
    loopReq('Walking_C', 0.45);
    const dip = Math.max(0, Math.sin(t * 3.4));
    set('spine', 0.12 + dip * 0.08, 0, s * (0.1 + dip * 0.1)); // hip-dip shoulder lean
    set('head', 0.1, 0, -s * 0.06);
    setTilt(0, 0, -0.02 - dip * 0.03);          // body sinks on the bad step
  }

  function poseTrudge(t) {
    loopReq('Walking_B', 0.6);
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

  function clearOverlay() {
    req = null;
    reqFull = false;
    tiltActive = false;
    for (const n in channels) channels[n].on = false;
  }

  // ======================= per-frame driver =======================
  const poseFull = {};     // clip name -> was requested as a full-body pose
  let accelS = 0, turnS = 0;
  let _dither = false;     // see scrub branch in update()

  function update(dt, speedNorm, opts) {
    // reset to bind pose so post-mixer writes never accumulate frame-to-frame
    for (let i = 0; i < bindPose.length; i++) {
      const b = bindPose[i];
      b.bone.quaternion.copy(b.q);
      b.bone.position.copy(b.p);
    }
    const s = clamp(speedNorm || 0, 0, 1);
    // locomotion crossfade: idle (s<0.06) -> walk (0.06..0.4) -> run (0.4..1)
    let wIdle, wWalk, wRun;
    if (s < 0.06) { wIdle = 1; wWalk = 0; wRun = 0; }
    else if (s < 0.4) { wWalk = (s - 0.06) / 0.34; wIdle = 1 - wWalk; wRun = 0; }
    else { wRun = (s - 0.4) / 0.6; wWalk = 1 - wRun; wIdle = 0; }
    walkAct.timeScale = (0.85 + s * 1.1) * persCadence;
    runAct.timeScale = (0.7 + s * 0.55) * persCadence;

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
          // tiny alternating dither: three.js PropertyMixer skips writing
          // bones when the sampled value is identical to last frame's, which
          // would let our bind-pose reset win on a held scrub.
          _dither = !_dither;
          a.time = clamp(req.scrub * a.getClip().duration * 0.999 + (_dither ? 0.0008 : 0), 0, a.getClip().duration);
        } else {                            // looped at the requested cadence
          a.paused = false;
          a.timeScale = req.ts;
          a.setLoop(THREE.LoopRepeat, Infinity);
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
    // cumulative mixer weight never dips below 1 mid-crossfade — any deficit
    // would blend toward the bind pose restored above (the arms-out flash on
    // every pose entry/exit when locoScale decayed on its own clock).
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

    // consume this frame's pose request (host re-arms next frame)
    req = null;
    reqFull = false;
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
      back: { x: 0, y: 1.25, z: -0.25 },  // jersey back number plane (host rotates it PI)
      chest: { x: 0, y: 1.3, z: 0.25 },   // chest number plane (faces +Z)
      tagY: 2.4,                          // floating nameplate sprite height
    },
    update,
    poseKick, poseThrowIn, poseDive, poseFall, poseGetUp,
    poseCelebrate, poseSkill, poseArgue, poseShield,
    poseSlideTackle, poseHeader, poseJockey,
    poseGKSet, poseGKCatch, poseGKPunch,
    poseLimp, poseTrudge, poseExhausted, poseKneeSlide,
    posePointToSpot, poseWhistle,
    clearOverlay, dispose,
    _debug: { mixer, actions, poseWs },
  };
}
