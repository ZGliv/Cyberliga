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

export function buildPlayerRig({ kitColor, glowColor, skinTone, hairColor, isGK = false, headband = false, captain = false, pattern = 'solid' }) {
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

  // ---- tint: clone materials ONCE per rig ----
  const kit = new THREE.Color(kitColor);
  if (isGK) kit.lerp(_gkColor, 0.85);    // keepers read lime, with a hint of team color
  const glow = new THREE.Color(glowColor);
  // secondary trim tint: hue-shifted, darker cousin of the kit color
  const trim = new THREE.Color(kitColor);
  trim.getHSL(_hsl);
  trim.setHSL((_hsl.h + 0.06) % 1, clamp(_hsl.s * 1.2, 0, 1), _hsl.l * 0.55);
  const accentEmissive = pattern === 'accent' ? 0.16 : 0;
  const ownedMaterials = [];
  let meshIdx = 0;
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false;           // skinned bounds lag the pose; cheap insurance for 15 rigs
      o.material = o.material.clone();
      ownedMaterials.push(o.material);
      const name = (o.name + '|' + (o.material.name || '')).toLowerCase();
      const isVisor = name.includes('visor') || name.includes('glass') || name.includes('helmet');
      if (o.material.color) {
        if (isVisor) {
          // visor/face area reads as the glow color
          o.material.color.lerp(glow, 0.8);
        } else if (meshIdx === 0) {
          // main armor: kit color, saturation-boosted so the team reads true
          o.material.color.lerp(kit, 0.62);
          saturate(o.material.color, 0.7);
        } else {
          // sub-materials: secondary trim tint
          o.material.color.lerp(trim, 0.6);
          saturate(o.material.color, 0.5);
        }
      }
      if (o.material.emissive) {
        o.material.emissive.copy(_tmpColor.set(glow));
        // per-part emissive variation = cheap accent pattern (panels read
        // differently instead of one flat wash)
        o.material.emissiveIntensity = (isVisor ? 0.45 : 0.08 + (meshIdx % 3) * 0.07) + accentEmissive;
      }
      meshIdx++;
    }
  });
  // skinTone/hairColor: the GLB is a single textured mesh, so per-part skin/hair
  // recolor isn't possible without a texture pipeline — accepted for API parity.
  void skinTone; void hairColor;

  // ---- bone lookup ----
  const bones = {};
  model.traverse((o) => { if (o.isBone) bones[o.name.replace(/^mixamorig/, '')] = o; });

  // optional headband: glow torus parented to the head bone (bone space = raw model units)
  if (headband && bones.Head) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(11, 1.2, 5, 14),
      new THREE.MeshBasicMaterial({ color: glow }));
    band.rotation.x = Math.PI / 2 - 0.25;
    band.position.y = 9;
    bones.Head.add(band);
    ownedMaterials.push(band.material);
  }

  // optional captain armband: glow ring around the left upper arm
  if (captain && bones.LeftArm) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(5.2, 1.1, 5, 12),
      new THREE.MeshBasicMaterial({ color: glow }));
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
  function poseDive(side, k) {
    markOverlay(true);
    k = clamp(k, 0, 1);
    const s = side >= 0 ? 1 : -1;
    const u = smooth(k);
    setTilt(0, -s * u * (Math.PI / 2 - 0.2), bell(k) * 0.35 - u * 0.2);
    // both arms reach overhead along the dive axis
    const raise = lerp(ARM_DOWN * 0.6, -1.45, u);
    setArm('Left', 0, raise); setArm('Right', 0, raise);
    setElbow('Left', lerp(0.8, 0.05, u)); setElbow('Right', lerp(0.8, 0.05, u));
    // legs: near leg pushes off then extends, far leg trails bent
    const N = s > 0 ? 'Left' : 'Right', F = s > 0 ? 'Right' : 'Left';
    setLeg(N, lerp(0.5, 0.15, u), lerp(1.2, 0.2, u), 0);
    setLeg(F, lerp(-0.2, -0.35, u), lerp(0.4, 0.9, u), 0);
    setSpine(lerp(0.3, 0.05, u), 0, s * 0.15 * u); // arch into the stretch
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
    } else if (variant === 1) { // fist pump
      setArm('Right', 0.5 + Math.max(0, w) * 0.5, ARM_DOWN - 1.0 - Math.max(0, w) * 0.4);
      setElbow('Right', 1.8);
      setArm('Left', -0.2, ARM_DOWN); setElbow('Left', 0.4);
      setSpine(0.12 + Math.max(0, w) * 0.1, Math.max(0, w) * 0.2, 0);
      setLeg('Left', 0.15, 0.3, 0);
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

  // Keeper set/ready stance with a live micro-bounce. t in seconds.
  function poseGKSet(t) {
    markOverlay(true);
    const b = Math.abs(Math.sin(t * 3.2));        // weight bounces on the toes
    setSpine(0.32 + b * 0.02, 0, 0);
    setArm('Left', 0.55, ARM_DOWN - 0.55);        // hands forward at hip height
    setArm('Right', 0.55, ARM_DOWN - 0.55);
    setElbow('Left', 0.85); setElbow('Right', 0.85);
    setLeg('Left', 0.12, 0.6 + b * 0.05, 0.22);
    setLeg('Right', 0.12, 0.6 + b * 0.05, 0.22);
    setTilt(0, 0, -0.14 - b * 0.015);
    set('Neck', 0.12, 0, 0);                      // chin down, eyes up the pitch
  }

  // Keeper catch: hands rise to the face, gather and hug, crouch to absorb.
  function poseGKCatch(k) {
    markOverlay(true);
    k = clamp(k, 0, 1);
    const rise = smooth(Math.min(1, k / 0.45));   // hands up to chest/face
    const hug = k > 0.55 ? smooth((k - 0.55) / 0.3) : 0; // gather it in
    setArm('Left', 0.75 * rise + hug * 0.15, ARM_DOWN - 0.9 * rise - hug * 0.1);
    setArm('Right', 0.75 * rise + hug * 0.15, ARM_DOWN - 0.9 * rise - hug * 0.1);
    setElbow('Left', 0.5 + rise * 0.7 + hug * 0.8);
    setElbow('Right', 0.5 + rise * 0.7 + hug * 0.8);
    setSpine(0.15 * rise + hug * 0.22, 0, 0);     // curl around the ball
    set('Spine1', hug * 0.12, 0, 0);
    set('Neck', 0.12 * rise + hug * 0.2, 0, 0);   // chin tucks over it
    setLeg('Left', 0.08, 0.3 + hug * 0.35, 0.1);  // crouch absorbs the catch
    setLeg('Right', 0.08, 0.3 + hug * 0.35, 0.1);
    setTilt(0, 0, -hug * 0.1);
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
    } else if (k < 0.6) {     // explode: both fists drive up-forward
      const u = smooth((k - 0.4) / 0.2);
      fwd = lerp(0.45, 1.1, u);
      raise = lerp(ARM_DOWN - 0.7, -1.05, u);
      elbow = lerp(2.0, 0.15, u);
      arch = lerp(0.18, -0.2, u);
    } else {                  // follow through, settle
      const u = smooth((k - 0.6) / 0.4);
      fwd = lerp(1.1, 0.6, u);
      raise = lerp(-1.05, ARM_DOWN - 0.8, u);
      elbow = lerp(0.15, 0.6, u);
      arch = lerp(-0.2, 0, u);
    }
    setArm('Left', fwd, raise); setArm('Right', fwd, raise);
    setElbow('Left', elbow); setElbow('Right', elbow);
    setSpine(arch, 0, 0);
    const jump = k >= 0.4 && k < 0.8 ? bell((k - 0.4) / 0.4) : 0;
    setTilt(0, 0, jump * 0.3 - (k < 0.4 ? smooth(k / 0.4) * 0.1 : 0));
    setLeg('Left', 0.1, 0.5 - jump * 0.2, 0);
    setLeg('Right', 0.1, 0.5 + jump * 0.2, 0);
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

  function clearOverlay() {
    for (const name in channels) channels[name].on = false;
    overlayThisFrame = false;
    overlayFull = false;
    tiltActive = false;
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
    // contract C2: radians, monotonic, advanced from actual ground speed in
    // update(); a foot visually plants every PI. Host mirrors this into
    // p.stridePhase after rig.update so ballcontrol touches hit real footfalls.
    get gaitPhase() { return gaitCyc * Math.PI * 2; },
    update,
    poseKick, poseThrowIn, poseDive, poseFall, poseGetUp,
    poseCelebrate, poseSkill, poseArgue, poseShield,
    poseSlideTackle, poseHeader, poseJockey,
    poseGKSet, poseGKCatch, poseGKPunch,
    poseLimp, poseTrudge, poseExhausted, poseKneeSlide,
    posePointToSpot, poseWhistle,
    clearOverlay, dispose,
  };
}
