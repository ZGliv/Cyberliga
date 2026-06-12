// rig.js — procedural jointed player rig + pose library for Cyberliga.
// Drop-in upgrade over index.html's buildPlayer(): two-segment limbs with knees
// and elbows, foot boxes, same neon-night kit language (emissive team torso,
// white trim, dark shorts, glow ring).
//
// Conventions (matching the host):
//   - ~1.9 units tall, origin at the feet, forward = local +Z.
//   - The HOST owns group.position, group.rotation.y (yaw), and headPivot.rotation.y
//     (ball tracking). Pose functions only touch internal joints, torso pitch/roll,
//     and group.position.y bob/crouch offsets THROUGH rig-internal nodes — they never
//     write group.rotation.y. poseFall/poseGetUp/poseDive DO write group-level pitch
//     (rotation.x / rotation.z) and group.position.y, documented per pose.
//   - Every pose function assigns EVERY joint every call (idempotent — switching
//     poses mid-animation never leaves stale rotations behind).

import * as THREE from 'three';

// ---- skeleton dimensions ----
const HIP_Y = 0.92, HIP_X = 0.17;
const THIGH_LEN = 0.42, SHIN_LEN = 0.40;
const SHOULDER_Y = 1.56, SHOULDER_X = 0.43;
const UPPER_ARM_LEN = 0.32, FOREARM_LEN = 0.30;
const HEAD_Y = 1.80;

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
function smooth(k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); } // smoothstep
function bell(k) { return Math.sin(clamp(k, 0, 1) * Math.PI); }        // 0→1→0

function limbCapsule(mat, radius, len) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, len, 3, 8), mat);
  m.position.y = -(len / 2 + radius * 0.4); // hang below the joint
  m.castShadow = true;
  return m;
}

export function buildPlayerRig({ kitColor, glowColor, skinTone, hairColor, isGK = false, headband = false }) {
  const group = new THREE.Group();

  const base = new THREE.Color(kitColor);
  const kit = isGK ? new THREE.Color(0xc8ff4d).lerp(base, 0.15) : base;
  const kitMat = new THREE.MeshStandardMaterial({ color: kit, roughness: 0.6, emissive: kit, emissiveIntensity: 0.18 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skinTone, roughness: 0.65 });
  const shortMat = new THREE.MeshStandardMaterial({ color: 0x0d1322, roughness: 0.7 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x141a2e, roughness: 0.5, emissive: glowColor, emissiveIntensity: 0.25 });
  const trimMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // -- torso node: lets poses pitch/roll the upper body without touching group --
  const torsoNode = new THREE.Group();
  torsoNode.position.y = HIP_Y;
  group.add(torsoNode);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.5, 5, 10), kitMat);
  torso.position.y = 0.32; torso.castShadow = true;
  torsoNode.add(torso);

  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.33, 0.3, 10), shortMat);
  hips.position.y = -0.08; hips.castShadow = true;
  torsoNode.add(hips);

  // shoulder trim rings — white kit accents
  for (const s of [-1, 1]) {
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.022, 5, 12), trimMat);
    trim.position.set(s * SHOULDER_X, SHOULDER_Y - HIP_Y, 0);
    trim.rotation.x = Math.PI / 2;
    torsoNode.add(trim);
  }

  // -- head on its own pivot (host drives rotation.y for ball tracking) --
  const headPivot = new THREE.Group();
  headPivot.position.y = HEAD_Y - HIP_Y;
  torsoNode.add(headPivot);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), skinMat);
  head.position.y = 0.1; head.castShadow = true;
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.226, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.9 }));
  hair.position.set(0, 0.14, -0.03);
  headPivot.add(head, hair);
  if (headband) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.226, 0.02, 5, 14),
      new THREE.MeshBasicMaterial({ color: glowColor }));
    band.rotation.x = Math.PI / 2 - 0.25; band.position.y = 0.17;
    headPivot.add(band);
  }

  // -- legs: hip → thigh (shorts color) → knee → shin (skin) → foot box --
  const legs = []; // { hip, knee, foot }
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * HIP_X, HIP_Y, 0);
    group.add(hip);
    const thigh = limbCapsule(shortMat, 0.105, THIGH_LEN - 0.18);
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -THIGH_LEN;
    hip.add(knee);
    const shin = limbCapsule(skinMat, 0.085, SHIN_LEN - 0.16);
    knee.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.3), bootMat);
    foot.position.set(0, -SHIN_LEN + 0.02, 0.07);
    foot.castShadow = true;
    knee.add(foot);
    legs.push({ hip, knee, foot });
  }

  // -- arms: shoulder (on torsoNode) → upper arm (kit) → elbow → forearm (skin) --
  const arms = []; // { shoulder, elbow }
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * SHOULDER_X, SHOULDER_Y - HIP_Y, 0);
    torsoNode.add(shoulder);
    const upper = limbCapsule(kitMat, 0.085, UPPER_ARM_LEN - 0.14);
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -UPPER_ARM_LEN;
    shoulder.add(elbow);
    const fore = limbCapsule(skinMat, 0.07, FOREARM_LEN - 0.12);
    elbow.add(fore);
    arms.push({ shoulder, elbow });
  }

  // -- foot glow ring --
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 24),
    new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.2, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
  group.add(ring);

  // ---------------------------------------------------------------
  // pose plumbing — reset() zeroes EVERY joint, then each pose layers
  // its full set of rotations on top. One pose call per frame.
  // ---------------------------------------------------------------
  function reset() {
    for (const L of legs) {
      L.hip.rotation.set(0, 0, 0);
      L.knee.rotation.set(0, 0, 0);
    }
    for (const A of arms) {
      A.shoulder.rotation.set(0, 0, 0);
      A.elbow.rotation.set(0, 0, 0);
    }
    torsoNode.rotation.set(0, 0, 0);
    torsoNode.position.set(0, HIP_Y, 0);
    headPivot.rotation.x = 0; headPivot.rotation.z = 0; // leave .y for host tracking
    // group-level recovery: falls/dives tilt the whole group; standing poses undo it.
    group.rotation.x = 0; group.rotation.z = 0;
    group.position.y = 0;
  }

  // Convention reminders for hips/shoulders: rotation.x positive = limb swings
  // FORWARD (+Z) is NEGATIVE x-rotation for legs hanging down? Check: a leg hangs
  // along -Y; rotating the hip about +X sends the foot toward +Z... rotating a
  // (0,-1,0) vector by +X gives (0,-cos, +(-1)*-sin)=(0,-cos,sin) → +Z. So
  // POSITIVE hip.rotation.x swings the leg FORWARD. Same for shoulders/arms.
  // Knee flexion bends the shin BACKWARD → knee.rotation.x NEGATIVE.
  // Elbow flexion brings the forearm FORWARD/up → elbow.rotation.x POSITIVE.

  function poseRun(stridePhase, speedNorm) {
    reset();
    const v = clamp(speedNorm, 0, 1);
    const swing = Math.sin(stridePhase);
    const swingB = Math.sin(stridePhase + Math.PI);
    const amp = 0.25 + v * 0.65; // thigh swing amplitude

    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? swing : swingB;
      const L = legs[i];
      L.hip.rotation.x = s * amp;
      // knee flexes hard when the thigh swings forward (heel lift on swing leg),
      // extends near plant. max(0, s) gates flexion to the forward half-cycle,
      // plus a small constant bend that grows with speed.
      const flex = Math.max(0, s) * (0.6 + v * 1.0) + 0.12 + v * 0.15;
      L.knee.rotation.x = -flex;
    }

    // arms counter-swing; elbows hang near-straight at rest, ~90° at sprint
    const armAmp = 0.15 + v * 0.6;
    const elbowBend = 0.35 + v * 1.25; // ~1.6rad ≈ 92° at full speed
    arms[0].shoulder.rotation.x = swingB * armAmp;
    arms[1].shoulder.rotation.x = swing * armAmp;
    arms[0].elbow.rotation.x = elbowBend;
    arms[1].elbow.rotation.x = elbowBend;
    // arms slightly out from the body so they don't clip the torso
    arms[0].shoulder.rotation.z = -0.12 - v * 0.08;
    arms[1].shoulder.rotation.z = 0.12 + v * 0.08;

    // torso: forward lean with speed, subtle counter-rotation against the hips
    torsoNode.rotation.x = 0.06 + v * 0.18;
    torsoNode.rotation.y = -swing * v * 0.12;

    // athletic idle at rest: slight crouch + breathing sway baked into the
    // crouch via stridePhase (host keeps incrementing it slowly when idle)
    const crouch = (1 - v) * 0.04 + v * Math.max(0, -Math.cos(stridePhase * 2)) * 0.0;
    torsoNode.position.y = HIP_Y - crouch;
    if (v < 0.05) {
      // idle: knees soft, arms loose at the sides
      legs[0].knee.rotation.x = -0.18; legs[1].knee.rotation.x = -0.18;
      legs[0].hip.rotation.x = 0.10; legs[1].hip.rotation.x = 0.10;
      arms[0].elbow.rotation.x = 0.25; arms[1].elbow.rotation.x = 0.25;
      torsoNode.rotation.x = 0.08;
    }
  }

  function poseKick(k, legIndex, amp) {
    reset();
    k = clamp(k, 0, 1); amp = clamp(amp, 0, 1);
    const i = legIndex ? 1 : 0;
    const K = legs[i], P = legs[1 - i];
    const KA = arms[i], PA = arms[1 - i];

    let hipAng, kneeAng;
    if (k < 0.45) {
      // backswing: hip back, knee folds (heel toward glute)
      const u = smooth(k / 0.45);
      hipAng = lerp(0.1, -0.9 * (0.5 + 0.5 * amp), u);
      kneeAng = lerp(-0.2, -1.9, u);
    } else if (k < 0.62) {
      // hip drive + snap extension through contact (~k 0.45→0.62)
      const u = (k - 0.45) / 0.17;
      hipAng = lerp(-0.9 * (0.5 + 0.5 * amp), 0.9 + 0.5 * amp, smooth(u));
      kneeAng = lerp(-1.9, -0.1, u * u); // whips straight late — snap
    } else {
      // follow-through: leg carries high, knee softens
      const u = smooth((k - 0.62) / 0.38);
      hipAng = lerp(0.9 + 0.5 * amp, 1.15 + 0.35 * amp, u);
      kneeAng = lerp(-0.1, -0.45, u);
    }
    K.hip.rotation.x = hipAng;
    K.knee.rotation.x = kneeAng;
    // plant leg braced: slight bend, takes the weight
    P.hip.rotation.x = -0.15;
    P.knee.rotation.x = -0.35;

    // arms counterbalance (opposite arm forward), torso leans back through contact
    PA.shoulder.rotation.x = hipAng * 0.55;
    PA.elbow.rotation.x = 0.6;
    KA.shoulder.rotation.x = -hipAng * 0.45;
    KA.shoulder.rotation.z = (i === 0 ? -1 : 1) * 0.45;
    KA.elbow.rotation.x = 0.4;
    torsoNode.rotation.x = -0.12 * amp * bell(k);
    torsoNode.rotation.y = (i === 0 ? 1 : -1) * 0.18 * bell(k);
    torsoNode.position.y = HIP_Y - 0.05 * bell(k);
  }

  // poseFall tilts the GROUP (rotation.x → face-down) and drops group.position.y.
  // Host: stop writing its own lean (rotation.x/z) while fall/getup poses run.
  function poseFall(k) {
    reset();
    k = smooth(k);
    group.rotation.x = lerp(0, Math.PI / 2 - 0.08, k); // pitch forward to the turf
    group.position.y = lerp(0, -0.55, k);              // origin-at-feet → lower so the body lies on grass
    // limbs loose / sprawled
    legs[0].hip.rotation.x = 0.35 * k; legs[0].knee.rotation.x = -0.5 * k;
    legs[1].hip.rotation.x = -0.2 * k; legs[1].knee.rotation.x = -0.25 * k;
    arms[0].shoulder.rotation.x = 1.6 * k; arms[0].shoulder.rotation.z = -0.5 * k; arms[0].elbow.rotation.x = 0.4 * k;
    arms[1].shoulder.rotation.x = 1.2 * k; arms[1].shoulder.rotation.z = 0.6 * k; arms[1].elbow.rotation.x = 0.7 * k;
    headPivot.rotation.x = -0.4 * k; // face not buried in the grass
  }

  function poseGetUp(k) {
    reset();
    const u = smooth(clamp(k, 0, 1));
    group.rotation.x = lerp(Math.PI / 2 - 0.08, 0, u);
    group.position.y = lerp(-0.55, 0, u);
    const push = bell(u); // arms push hardest mid-rise
    arms[0].shoulder.rotation.x = lerp(1.6, 0, u) + push * 0.2;
    arms[1].shoulder.rotation.x = lerp(1.2, 0, u) + push * 0.2;
    arms[0].elbow.rotation.x = push * 1.2 + 0.2;
    arms[1].elbow.rotation.x = push * 1.2 + 0.2;
    // one knee tucks under to push up, then both straighten
    legs[0].hip.rotation.x = push * 0.9;
    legs[0].knee.rotation.x = -push * 1.4 - 0.1;
    legs[1].hip.rotation.x = push * 0.4;
    legs[1].knee.rotation.x = -push * 0.8 - 0.1;
    torsoNode.rotation.x = push * 0.5;
    headPivot.rotation.x = lerp(-0.4, 0, u);
  }

  function poseCelebrate(t, variant) {
    reset();
    const w = Math.sin(t * 8);
    if (variant === 0) {
      // arms-up jump
      arms[0].shoulder.rotation.x = Math.PI - 0.3 + w * 0.2;
      arms[1].shoulder.rotation.x = Math.PI - 0.3 - w * 0.2;
      arms[0].elbow.rotation.x = 0.2; arms[1].elbow.rotation.x = 0.2;
      const hop = Math.abs(Math.sin(t * 7));
      group.position.y = hop * 0.3;
      legs[0].hip.rotation.x = hop * 0.3; legs[0].knee.rotation.x = -hop * 0.8;
      legs[1].hip.rotation.x = hop * 0.3; legs[1].knee.rotation.x = -hop * 0.8;
      torsoNode.rotation.x = -0.1;
    } else if (variant === 1) {
      // fist pump
      arms[0].shoulder.rotation.x = 0.5 + Math.max(0, w) * 0.8;
      arms[0].elbow.rotation.x = 1.8;
      arms[1].shoulder.rotation.x = -0.2; arms[1].elbow.rotation.x = 0.4;
      legs[0].hip.rotation.x = 0.15; legs[0].knee.rotation.x = -0.3;
      legs[1].hip.rotation.x = -0.1; legs[1].knee.rotation.x = -0.2;
      torsoNode.rotation.x = 0.12 + Math.max(0, w) * 0.1;
      torsoNode.rotation.y = Math.max(0, w) * 0.2;
    } else {
      // airplane: arms straight out, torso leaning forward, gentle bank
      arms[0].shoulder.rotation.z = -Math.PI / 2 + 0.1;
      arms[1].shoulder.rotation.z = Math.PI / 2 - 0.1;
      arms[0].elbow.rotation.x = 0; arms[1].elbow.rotation.x = 0;
      torsoNode.rotation.x = 0.45;
      torsoNode.rotation.z = Math.sin(t * 3) * 0.18;
      legs[0].hip.rotation.x = 0.2; legs[0].knee.rotation.x = -0.4;
      legs[1].hip.rotation.x = 0.2; legs[1].knee.rotation.x = -0.4;
      headPivot.rotation.x = -0.3;
    }
  }

  function poseSkill(move, k, side) {
    reset();
    k = clamp(k, 0, 1);
    const s = side >= 0 ? 1 : -1;
    const i = s > 0 ? 1 : 0;            // active foot index
    const A = legs[i], B = legs[1 - i];

    if (move === 'stepover') {
      // active foot circles OVER the ball: lift (knee flex) + lateral arc via hip
      // rotation.z, with hip swivel selling the fake
      const c = k * Math.PI * 2;
      A.hip.rotation.x = 0.55 + Math.sin(c) * 0.5;       // forward over the ball
      A.hip.rotation.z = s * Math.cos(c) * -0.55;        // sweeps across
      A.knee.rotation.x = -0.9 - Math.max(0, Math.sin(c)) * 0.5;
      B.hip.rotation.x = -0.1; B.knee.rotation.x = -0.3; // planted, knee soft
      torsoNode.rotation.y = s * Math.sin(c) * 0.3;      // hip/shoulder swivel
      torsoNode.rotation.x = 0.15;
      arms[1 - i].shoulder.rotation.x = 0.4; arms[1 - i].elbow.rotation.x = 0.8;
      arms[i].shoulder.rotation.x = -0.3; arms[i].elbow.rotation.x = 0.5;
      arms[0].shoulder.rotation.z = -0.3; arms[1].shoulder.rotation.z = 0.3;
      torsoNode.position.y = HIP_Y - 0.05;
    } else if (move === 'bodyfeint') {
      // hard shoulder + torso drop one way (k<0.5), explode back the other
      const drop = k < 0.5 ? smooth(k / 0.5) : smooth(1 - (k - 0.5) / 0.5);
      const dir = k < 0.5 ? s : -s;
      torsoNode.rotation.z = dir * drop * 0.5;
      torsoNode.rotation.y = dir * drop * 0.35;
      torsoNode.rotation.x = 0.18;
      torsoNode.position.y = HIP_Y - drop * 0.10;        // dips into the feint
      A.hip.rotation.z = -s * drop * 0.3;                // wide stance toward the drop
      A.hip.rotation.x = 0.1; A.knee.rotation.x = -0.5 * drop - 0.15;
      B.hip.rotation.x = 0.1; B.hip.rotation.z = s * drop * 0.15;
      B.knee.rotation.x = -0.3;
      arms[0].shoulder.rotation.z = -0.45; arms[1].shoulder.rotation.z = 0.45;
      arms[0].elbow.rotation.x = 0.6; arms[1].elbow.rotation.x = 0.6;
    } else if (move === 'dragback') {
      // sole on ball, pulling back: foot reaches forward then drags toward -Z
      const reach = k < 0.35 ? smooth(k / 0.35) : 1;
      const pull = k < 0.35 ? 0 : smooth((k - 0.35) / 0.65);
      A.hip.rotation.x = lerp(0.85 * reach, -0.5, pull); // forward → swept back
      A.knee.rotation.x = lerp(-0.25, -1.1, pull);
      A.foot.rotation.x = -0.5 * reach * (1 - pull);     // toes down, sole on ball
      B.hip.rotation.x = -0.1; B.knee.rotation.x = -0.35;
      torsoNode.rotation.x = 0.1 + pull * 0.15;          // settles back over the ball
      torsoNode.position.y = HIP_Y - 0.06 * pull;
      arms[0].shoulder.rotation.z = -0.35; arms[1].shoulder.rotation.z = 0.35;
      arms[0].elbow.rotation.x = 0.7; arms[1].elbow.rotation.x = 0.7;
      arms[i].shoulder.rotation.x = -0.3; arms[1 - i].shoulder.rotation.x = 0.35;
    } else { // roulette — host spins group yaw; we sell the body shape
      const c = bell(k);
      torsoNode.rotation.x = 0.22 * c;                   // crouched through the spin
      torsoNode.position.y = HIP_Y - 0.10 * c;
      // arms out wide for balance, trailing the spin
      arms[0].shoulder.rotation.z = -0.9 * c - 0.15;
      arms[1].shoulder.rotation.z = 0.9 * c + 0.15;
      arms[0].elbow.rotation.x = 0.4; arms[1].elbow.rotation.x = 0.4;
      // alternating sole touches: first foot drags (k<0.5), second completes
      const ph = k < 0.5 ? smooth(k / 0.5) : smooth((k - 0.5) / 0.5);
      const first = k < 0.5 ? A : B, second = k < 0.5 ? B : A;
      first.hip.rotation.x = lerp(0.6, -0.4, ph);
      first.knee.rotation.x = -0.5 - ph * 0.4;
      second.hip.rotation.x = -0.1;
      second.knee.rotation.x = -0.35;
      headPivot.rotation.x = 0.15 * c; // eyes down, shielding the ball
    }
  }

  // poseDive: GK explodes toward local ±X. The rig rolls the GROUP about Z
  // (rotation.z) and lifts/drops group.position.y itself — host should NOT
  // write group rotation.x/z or position.y during a dive, only yaw + x/z position.
  function poseDive(side, k) {
    reset();
    k = clamp(k, 0, 1);
    const s = side >= 0 ? 1 : -1;
    const u = smooth(k);
    // launch: crouch loaded at k=0 → full lateral layout at k=1
    group.rotation.z = -s * u * (Math.PI / 2 - 0.18);    // roll so body is near-horizontal toward ±X
    group.position.y = bell(k) * 0.35 - u * 0.25;        // up off the line, then descending
    // both arms reach along the dive direction (which is "up" along the rolled body axis)
    const lead = s > 0 ? arms[1] : arms[0];
    const trail = s > 0 ? arms[0] : arms[1];
    lead.shoulder.rotation.z = s * lerp(0.3, 2.6, u);    // overhead reach toward the ball
    lead.elbow.rotation.x = lerp(0.8, 0.05, u);          // snaps straight
    trail.shoulder.rotation.z = s * lerp(-0.2, 2.2, u);
    trail.shoulder.rotation.x = 0.25;
    trail.elbow.rotation.x = lerp(0.8, 0.15, u);
    // legs trail: near leg drives off then extends, far leg flexed behind
    const near = s > 0 ? legs[1] : legs[0];
    const far = s > 0 ? legs[0] : legs[1];
    near.hip.rotation.x = lerp(0.5, 0.15, u);
    near.knee.rotation.x = lerp(-1.2, -0.25, u);         // pushes off → extends
    far.hip.rotation.x = lerp(-0.2, -0.35, u);
    far.knee.rotation.x = lerp(-0.4, -0.9, u);           // trailing bent leg
    near.hip.rotation.z = -s * 0.2 * u;
    far.hip.rotation.z = s * 0.15 * u;
    torsoNode.rotation.z = -s * 0.15 * u;                // extra arch into the stretch
    torsoNode.rotation.x = lerp(0.3, 0.05, u);           // crouch unwinds
    headPivot.rotation.z = s * 0.3 * u;                  // eyes follow the ball
  }

  function poseShield(k, side) {
    reset();
    k = clamp(k, 0, 1);
    const s = side >= 0 ? 1 : -1;
    const u = smooth(k);
    const A = s > 0 ? arms[1] : arms[0];   // arm toward the defender
    const O = s > 0 ? arms[0] : arms[1];
    // shield arm out and back, forearm bracing
    A.shoulder.rotation.z = s * (0.9 + 0.4 * u);
    A.shoulder.rotation.x = -0.3;
    A.elbow.rotation.x = 0.5;
    O.shoulder.rotation.x = 0.3; O.shoulder.rotation.z = -s * 0.25; O.elbow.rotation.x = 0.7;
    // body turned sideways-ish and LOW: wide stance, deep knees
    torsoNode.rotation.y = s * 0.45 * u;
    torsoNode.rotation.x = 0.22;
    torsoNode.position.y = HIP_Y - 0.10 * u;             // low center of gravity
    legs[0].hip.rotation.z = -0.28 * u;                  // wide base
    legs[1].hip.rotation.z = 0.28 * u;
    legs[0].hip.rotation.x = 0.15; legs[1].hip.rotation.x = 0.15;
    legs[0].knee.rotation.x = -0.55 * u - 0.15;
    legs[1].knee.rotation.x = -0.55 * u - 0.15;
  }

  return {
    group,
    headPivot,
    anchors: {
      back: { x: 0, y: 1.32, z: -0.36 },   // jersey back number plane (faces -Z, host rotates it PI)
      chest: { x: 0, y: 1.36, z: 0.36 },   // chest number plane (faces +Z)
      tagY: 2.45,                          // floating nameplate sprite height
    },
    poseRun, poseKick, poseFall, poseGetUp, poseCelebrate, poseSkill, poseDive, poseShield,
  };
}
