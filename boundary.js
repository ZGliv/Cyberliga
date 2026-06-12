// boundary.js — complete out-of-bounds system for CYBERLIGA
// Replaces the old "ball bounces off invisible walls" behavior with real
// out-of-play: detection (checkOut), last-ditch saves (rescueCandidate),
// off-pitch physics (reflectOffHoardings), and ball kids who fetch the dead
// ball and place it at the restart spot (summonFetch/update/fetchState).
//
// Pitch: x ∈ [-32, 32], z ∈ [-20, 20]. Goals at x = ±32, mouth z ∈ [-4.5, 4.5],
// height 3.2. Ball rest y = 0.24 (radius 0.24) — "whole ball over the line"
// means |z| > 20.24 / |x| > 32.24.

import * as THREE from 'three';

const HALF_W = 32, HALF_H = 20;
const BALL_R = 0.24;
const TOUCH_OUT = HALF_H + BALL_R;   // 20.24
const END_OUT = HALF_W + BALL_R;     // 32.24
const GOAL_MOUTH_Z = 4.5;
const GOAL_HEIGHT = 3.2;
// hoardings (stands boundary on the apron)
const HOARD_Z = 26, HOARD_X = 38;

// ---------------------------------------------------------------------------
// Ball kid construction — simple low-poly figure, ~1.2 units tall, dark kit
// with a neon-yellow vest stripe. Matches the game's neon-night art style.
// ---------------------------------------------------------------------------
const VEST_COLOR = 0xe8ff2d;

function buildBallKid() {
  const g = new THREE.Group();

  const kitMat = new THREE.MeshStandardMaterial({ color: 0x10182c, roughness: 0.85 });
  const vestMat = new THREE.MeshStandardMaterial({
    color: VEST_COLOR, emissive: VEST_COLOR, emissiveIntensity: 0.7, roughness: 0.5,
  });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe0ac69, roughness: 0.8 });

  // torso (capsule) with neon vest band
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.34, 4, 8), kitMat);
  torso.position.y = 0.62;
  const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.16, 10), vestMat);
  vest.position.y = 0.68;
  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skinMat);
  head.position.y = 1.02;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.135, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), kitMat);
  cap.position.y = 1.05;

  // limbs: pivot groups at hip/shoulder so the gait can swing them
  function limb(r, len, mat) {
    const grp = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 6), mat);
    m.position.y = -(len / 2 + r); // hangs below the pivot
    grp.add(m);
    return grp;
  }
  const legL = limb(0.06, 0.3, kitMat); legL.position.set(-0.09, 0.42, 0);
  const legR = limb(0.06, 0.3, kitMat); legR.position.set(0.09, 0.42, 0);
  const armL = limb(0.045, 0.26, kitMat); armL.position.set(-0.2, 0.86, 0);
  const armR = limb(0.045, 0.26, kitMat); armR.position.set(0.2, 0.86, 0);

  g.add(torso, vest, head, cap, legL, legR, armL, armR);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });

  return {
    group: g,
    parts: { torso, vest, head, cap, legL, legR, armL, armR },
  };
}

// poses ---------------------------------------------------------------------
function poseKneel(kid, swayT) {
  const { legL, legR, armL, armR, torso } = kid.parts;
  // kneeling: legs folded, body lowered, subtle idle sway
  const sway = Math.sin(swayT) * 0.05;
  kid.group.children.forEach(() => {});
  legL.rotation.x = -1.5; legR.rotation.x = -1.5;
  armL.rotation.x = -0.25 + sway * 0.4; armR.rotation.x = -0.25 - sway * 0.4;
  armL.rotation.z = 0.12; armR.rotation.z = -0.12;
  torso.rotation.x = 0.1 + sway * 0.3;
  kid.group.position.y = -0.32; // sunk so folded legs read as kneeling
  kid.group.rotation.z = sway * 0.5;
}

function poseRun(kid, stridePhase, runK) {
  const { legL, legR, armL, armR, torso } = kid.parts;
  const s = Math.sin(stridePhase), c = Math.sin(stridePhase + Math.PI);
  legL.rotation.x = s * 0.85 * runK;
  legR.rotation.x = c * 0.85 * runK;
  armL.rotation.x = c * 0.7 * runK;   // arms counter-swing the legs
  armR.rotation.x = s * 0.7 * runK;
  armL.rotation.z = 0.1; armR.rotation.z = -0.1;
  torso.rotation.x = 0.18 * runK;     // forward lean
  kid.group.rotation.z = 0;
  kid.group.position.y = Math.abs(Math.sin(stridePhase)) * 0.04 * runK; // bob
}

function poseCarry(kid, stridePhase, runK) {
  poseRun(kid, stridePhase, runK);
  const { armL, armR } = kid.parts;
  // both arms forward cradling the ball
  armL.rotation.x = -1.1; armR.rotation.x = -1.1;
  armL.rotation.z = 0.3; armR.rotation.z = -0.3;
}

// ---------------------------------------------------------------------------
export function createBoundarySystem(scene, opts = {}) {
  // opts.defenderOf: optional (side:-1|1) => teamName, used for corner-vs-
  // goalkick attribution when the host wants the module's best guess.
  const defenderOf = opts.defenderOf || null;

  // ----- ball kids on the apron -----
  const POSTS = [
    { x: -16, z: 22.5 }, { x: 16, z: 22.5 },
    { x: -16, z: -22.5 }, { x: 16, z: -22.5 },
    { x: 35.5, z: 0 }, { x: -35.5, z: 0 },
  ];
  const kids = POSTS.map((post, i) => {
    const kid = buildBallKid();
    kid.group.position.set(post.x, 0, post.z);
    // face the pitch
    kid.group.rotation.y = Math.atan2(-post.x, -post.z);
    scene.add(kid.group);
    return {
      ...kid,
      post: new THREE.Vector3(post.x, 0, post.z),
      pos: new THREE.Vector3(post.x, 0, post.z),
      yaw: Math.atan2(-post.x, -post.z),
      swayPhase: i * 1.7,
      stridePhase: 0,
      busy: false,
    };
  });

  // ----- fetch state machine -----
  let fetch = null; // { kid, phase, spot, speed, ballPos, placeT }

  function nearestIdleKid(p) {
    let best = null, bd = 1e9;
    for (const k of kids) {
      if (k.busy) continue;
      const d = k.pos.distanceTo(p);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  // ----- restart spot helpers -----
  function throwinResult(ball) {
    const sideZ = Math.sign(ball.pos.z) || 1;
    const spot = {
      x: THREE.MathUtils.clamp(ball.pos.x, -HALF_W + 1, HALF_W - 1),
      z: sideZ * (HALF_H - 0.4),
    };
    return { kind: 'throwin', spot, side: Math.sign(ball.pos.x) || 1, sideZ };
  }

  function endlineResult(ball, lastTouchTeamName) {
    const side = Math.sign(ball.pos.x) || 1;
    const sideZ = Math.sign(ball.pos.z) || 1;
    const cornerSpot = { x: side * (HALF_W - 0.6), z: sideZ * (HALF_H - 0.6) };
    const goalkickSpot = { x: side * (HALF_W - 5), z: 0 };
    // best-guess attribution: defender touched last → corner; else goal kick.
    // The host owns the final call (it knows the teams) and may swap kind/spot.
    let kind = 'goalkick';
    if (defenderOf && lastTouchTeamName && defenderOf(side) === lastTouchTeamName) kind = 'corner';
    return {
      kind,
      spot: kind === 'corner' ? cornerSpot : goalkickSpot,
      side, sideZ,
      cornerSpot, goalkickSpot, // both exposed so the host can re-attribute
    };
  }

  // ----- API -----
  return {
    kids, // exposed for debugging / styling tweaks

    checkOut(ball, lastTouchTeamName) {
      // touchlines: whole ball over
      if (Math.abs(ball.pos.z) > TOUCH_OUT) return throwinResult(ball);
      // end lines, OUTSIDE the goal mouth (inside the mouth = goal, host handles)
      if (Math.abs(ball.pos.x) > END_OUT
          && (Math.abs(ball.pos.z) > GOAL_MOUTH_Z || ball.pos.y > GOAL_HEIGHT)) {
        return endlineResult(ball, lastTouchTeamName);
      }
      return null;
    },

    rescueCandidate(ball, players) {
      // only rolling balls — high lofted clearances aren't saveable
      if (ball.pos.y > 0.8) return null;
      const vx = ball.vel.x, vz = ball.vel.z;
      const sp = Math.hypot(vx, vz);
      if (sp < 2.5) return null;

      // earliest line-crossing time, assuming roughly linear travel
      let tOut = Infinity;
      if (vz > 0.5) tOut = Math.min(tOut, (TOUCH_OUT - ball.pos.z) / vz);
      if (vz < -0.5) tOut = Math.min(tOut, (-TOUCH_OUT - ball.pos.z) / vz);
      if (vx > 0.5) tOut = Math.min(tOut, (END_OUT - ball.pos.x) / vx);
      if (vx < -0.5) tOut = Math.min(tOut, (-END_OUT - ball.pos.x) / vx);
      if (!(tOut > 0.1 && tOut < 1.2)) return null;

      // intercept point: just INSIDE the line along the ball's path
      const tHit = Math.max(tOut - 0.12, 0.08);
      const point = new THREE.Vector3(
        THREE.MathUtils.clamp(ball.pos.x + vx * tHit, -HALF_W + 0.3, HALF_W - 0.3),
        0,
        THREE.MathUtils.clamp(ball.pos.z + vz * tHit, -HALF_H + 0.3, HALF_H - 0.3),
      );

      // who can bust a gut and get there first?
      let best = null, bestMargin = -1e9;
      for (const p of players) {
        if (p.role === 'GK' || (p.fallT > 0) || (p.slideT > 0)) continue;
        const d = p.pos.distanceTo(point);
        const tReach = d / (p.speed * 1.08); // flat-out sprint
        const margin = tOut - tReach;
        if (margin > 0 && margin > bestMargin) { bestMargin = margin; best = p; }
      }
      if (!best) return null;
      return { player: best, point, urgent: tOut < 0.6 };
    },

    reflectOffHoardings(ball) {
      // soft bounce off the LED hoardings at the edge of the apron
      if (Math.abs(ball.pos.z) > HOARD_Z) {
        ball.pos.z = Math.sign(ball.pos.z) * HOARD_Z;
        ball.vel.z *= -0.3;
        ball.vel.x *= 0.6;
        if (ball.spin) ball.spin.multiplyScalar(0.4);
      }
      if (Math.abs(ball.pos.x) > HOARD_X) {
        ball.pos.x = Math.sign(ball.pos.x) * HOARD_X;
        ball.vel.x *= -0.3;
        ball.vel.z *= 0.6;
        if (ball.spin) ball.spin.multiplyScalar(0.4);
      }
    },

    summonFetch(spot, restartKind) {
      if (fetch) return; // one fetch at a time
      const spotV = new THREE.Vector3(spot.x, 0, spot.z);
      const kid = nearestIdleKid(spotV);
      if (!kid) return;
      kid.busy = true;
      fetch = {
        kid, kind: restartKind,
        spot: spotV,
        phase: 'going',
        ballPos: null,
        placeT: 0,
        speed: 6, // refined per-leg in update() so the whole trip stays 2.5-4s
      };
    },

    update(t, dt, ball) {
      // idle kids: kneel + sway
      for (const k of kids) {
        if (fetch && fetch.kid === k) continue;
        k.group.position.set(k.pos.x, 0, k.pos.z);
        k.group.rotation.y = k.yaw;
        poseKneel(k, t * 1.1 + k.swayPhase);
      }
      if (!fetch) return;

      const k = fetch.kid;
      const moveTo = (target, arriveDist) => {
        const d = Math.hypot(target.x - k.pos.x, target.z - k.pos.z);
        if (d < arriveDist) return true;
        // jog faster on long legs so total fetch stays short (2.5-4s flavor)
        const speed = THREE.MathUtils.clamp(d / 0.9, 5, 13);
        const nx = (target.x - k.pos.x) / d, nz = (target.z - k.pos.z) / d;
        k.pos.x += nx * speed * dt;
        k.pos.z += nz * speed * dt;
        k.yaw = Math.atan2(nx, nz);
        k.stridePhase += speed * dt * 2.4; // same gait convention as the game
        k.group.position.set(k.pos.x, 0, k.pos.z);
        k.group.rotation.y = k.yaw;
        return false;
      };

      if (fetch.phase === 'going') {
        // chase the LIVE ball — physics still runs, it may still be rolling
        const arrived = moveTo(ball.pos, 0.55);
        poseRun(k, k.stridePhase, 1);
        if (arrived && Math.hypot(ball.vel.x, ball.vel.z) < 3) {
          fetch.phase = 'carrying';
          fetch.ballPos = new THREE.Vector3();
        }
      } else if (fetch.phase === 'carrying') {
        const arrived = moveTo(fetch.spot, 0.4);
        poseCarry(k, k.stridePhase, 1);
        // ball cradled at chest height in front of the kid
        fetch.ballPos.set(
          k.pos.x + Math.sin(k.yaw) * 0.35,
          0.75,
          k.pos.z + Math.cos(k.yaw) * 0.35,
        );
        if (arrived) {
          fetch.phase = 'placing';
          fetch.placeT = 0;
        }
      } else if (fetch.phase === 'placing') {
        fetch.placeT += dt;
        // bend and set it down on the spot
        const kk = Math.min(fetch.placeT / 0.35, 1);
        k.parts.torso.rotation.x = 0.18 + kk * 0.7;
        k.parts.armL.rotation.x = -1.1 - kk * 0.5;
        k.parts.armR.rotation.x = -1.1 - kk * 0.5;
        fetch.ballPos.set(fetch.spot.x, BALL_R + (1 - kk) * 0.5, fetch.spot.z);
        if (fetch.placeT > 0.45) {
          fetch.phase = 'returning';
          fetch.ballPos = null;
        }
      } else if (fetch.phase === 'returning') {
        const arrived = moveTo(k.post, 0.3);
        poseRun(k, k.stridePhase, 0.8);
        if (arrived) {
          k.pos.copy(k.post);
          k.yaw = Math.atan2(-k.post.x, -k.post.z);
          k.busy = false;
          fetch = null;
        }
      }
    },

    fetchState() {
      if (!fetch) return null;
      return { phase: fetch.phase, ballPos: fetch.ballPos ? fetch.ballPos.clone() : null };
    },
  };
}
