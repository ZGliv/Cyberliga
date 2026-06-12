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
// Each compute* writes channel TARGETS into a pooled object; applyKidPose
// exp-smooths the kid's current channels toward them (frame-rate independent),
// so kneel/run/carry/place transitions ease over ~0.2s instead of snapping.
function computeKneel(o, swayT) {
  // kneeling: legs folded, body lowered, subtle idle sway
  const sway = Math.sin(swayT) * 0.05;
  o.legL = -1.5; o.legR = -1.5;
  o.armLx = -0.25 + sway * 0.4; o.armRx = -0.25 - sway * 0.4;
  o.armLz = 0.12; o.armRz = -0.12;
  o.torso = 0.1 + sway * 0.3;
  o.y = -0.32; // sunk so folded legs read as kneeling
  o.rotZ = sway * 0.5;
}

function computeRun(o, stridePhase, runK) {
  const s = Math.sin(stridePhase), c = Math.sin(stridePhase + Math.PI);
  o.legL = s * 0.85 * runK;
  o.legR = c * 0.85 * runK;
  o.armLx = c * 0.7 * runK;   // arms counter-swing the legs
  o.armRx = s * 0.7 * runK;
  o.armLz = 0.1; o.armRz = -0.1;
  o.torso = 0.18 * runK;      // forward lean
  o.rotZ = 0;
  o.y = Math.abs(Math.sin(stridePhase)) * 0.04 * runK; // bob
}

function computeCarry(o, stridePhase, runK) {
  computeRun(o, stridePhase, runK);
  // both arms forward cradling the ball
  o.armLx = -1.1; o.armRx = -1.1;
  o.armLz = 0.3; o.armRz = -0.3;
}

function computePlace(o, kk) {
  // standing still, bending to set the ball down (kk 0..1)
  o.legL = 0; o.legR = 0;
  o.armLx = -1.1 - kk * 0.5; o.armRx = -1.1 - kk * 0.5;
  o.armLz = 0.3; o.armRz = -0.3;
  o.torso = 0.18 + kk * 0.7;
  o.y = -kk * 0.12; // slight dip into the bend
  o.rotZ = 0;
}

const _kp = { legL: 0, legR: 0, armLx: 0, armRx: 0, armLz: 0, armRz: 0, torso: 0, y: 0, rotZ: 0 };

function applyKidPose(kid, tgt, dt) {
  const c = kid.poseCur, a = 1 - Math.exp(-16 * dt);
  c.legL += (tgt.legL - c.legL) * a;   c.legR += (tgt.legR - c.legR) * a;
  c.armLx += (tgt.armLx - c.armLx) * a; c.armRx += (tgt.armRx - c.armRx) * a;
  c.armLz += (tgt.armLz - c.armLz) * a; c.armRz += (tgt.armRz - c.armRz) * a;
  c.torso += (tgt.torso - c.torso) * a;
  c.y += (tgt.y - c.y) * a;
  c.rotZ += (tgt.rotZ - c.rotZ) * a;
  const { legL, legR, armL, armR, torso } = kid.parts;
  legL.rotation.x = c.legL; legR.rotation.x = c.legR;
  armL.rotation.x = c.armLx; armR.rotation.x = c.armRx;
  armL.rotation.z = c.armLz; armR.rotation.z = c.armRz;
  torso.rotation.x = c.torso;
  kid.group.position.y = c.y;
  kid.group.rotation.z = c.rotZ;
}

// steering: capped jog with accel ramp + shortest-arc yaw ease (no 13 m/s
// teleport-dashes, no instant pivots). Frame-rate independent smoothing.
function moveKid(k, target, arriveDist, dt) {
  const dx = target.x - k.pos.x, dz = target.z - k.pos.z;
  const d = Math.hypot(dx, dz);
  const want = d < arriveDist ? 0 : THREE.MathUtils.clamp(d / 0.9, 1.4, 7);
  k.spd += (want - k.spd) * (1 - Math.exp(-8 * dt));
  if (d < arriveDist) return true;
  const step = Math.min(k.spd * dt, d);
  k.pos.x += (dx / d) * step;
  k.pos.z += (dz / d) * step;
  let dyaw = Math.atan2(dx / d, dz / d) - k.yaw;
  while (dyaw > Math.PI) dyaw -= Math.PI * 2;
  while (dyaw < -Math.PI) dyaw += Math.PI * 2;
  k.yaw += dyaw * (1 - Math.exp(-10 * dt));
  k.stridePhase += k.spd * dt * 2.4; // same gait convention as the game
  return false;
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
      spd: 0,
      busy: false,
      goHome: false, // preempted mid-fetch: jog back to the post empty-handed
      poseCur: { legL: -1.5, legR: -1.5, armLx: -0.25, armRx: -0.25,
                 armLz: 0.12, armRz: -0.12, torso: 0.1, y: -0.32, rotZ: 0 },
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
      const spotV = new THREE.Vector3(spot.x, 0, spot.z);
      if (fetch) {
        if (fetch.phase === 'going' || fetch.phase === 'carrying') {
          // new dead ball mid-fetch: retarget the same kid at the new restart
          fetch.spot.copy(spotV);
          fetch.kind = restartKind;
          return;
        }
        // placing/returning: that fetch is history — a stale one here is what
        // made the next out-of-play teleport the ball. Send the kid home
        // empty-handed and start a fresh fetch for the new ball.
        fetch.kid.busy = false;
        fetch.kid.goHome = true;
        fetch = null;
      }
      const kid = nearestIdleKid(spotV);
      if (!kid) return;
      kid.busy = true;
      kid.goHome = false;
      fetch = {
        kid, kind: restartKind,
        spot: spotV,
        phase: 'going',
        ballPos: null,
        placeT: 0,
        carryT: 0,
        setT: 0,
        grab: new THREE.Vector3(),
        setFrom: new THREE.Vector3(),
      };
    },

    update(t, dt, ball) {
      // idle / homebound kids: kneel + sway, or jog back to the post
      for (const k of kids) {
        if (fetch && fetch.kid === k) continue;
        if (k.goHome) {
          if (moveKid(k, k.post, 0.35, dt)) k.goHome = false;
          computeRun(_kp, k.stridePhase, 0.8);
        } else {
          // settle exactly onto the post and ease back to facing the pitch
          const a = 1 - Math.exp(-2 * dt);
          k.pos.x += (k.post.x - k.pos.x) * a;
          k.pos.z += (k.post.z - k.pos.z) * a;
          let dyaw = Math.atan2(-k.post.x, -k.post.z) - k.yaw;
          while (dyaw > Math.PI) dyaw -= Math.PI * 2;
          while (dyaw < -Math.PI) dyaw += Math.PI * 2;
          k.yaw += dyaw * (1 - Math.exp(-6 * dt));
          k.spd *= Math.exp(-8 * dt);
          computeKneel(_kp, t * 1.1 + k.swayPhase);
        }
        k.group.position.set(k.pos.x, 0, k.pos.z);
        k.group.rotation.y = k.yaw;
        applyKidPose(k, _kp, dt);
      }
      if (!fetch) return;

      const k = fetch.kid;
      if (fetch.phase === 'going') {
        // chase the LIVE ball — physics still runs, it may still be rolling
        const arrived = moveKid(k, ball.pos, 0.55, dt);
        computeRun(_kp, k.stridePhase, 1);
        if (arrived && Math.hypot(ball.vel.x, ball.vel.z) < 3) {
          fetch.phase = 'carrying';
          fetch.carryT = 0; fetch.setT = 0;
          fetch.grab.copy(ball.pos); // scoop starts from where the ball rests
          fetch.ballPos = new THREE.Vector3().copy(ball.pos);
        }
      } else if (fetch.phase === 'carrying') {
        const arrived = moveKid(k, fetch.spot, 0.4, dt);
        fetch.carryT += dt;
        const cradleX = k.pos.x + Math.sin(k.yaw) * 0.35;
        const cradleZ = k.pos.z + Math.cos(k.yaw) * 0.35;
        if (!arrived) {
          fetch.setT = 0;
          computeCarry(_kp, k.stridePhase, 1);
          // pick-up: lift the ball from the turf into the cradle over 0.25s
          const kk = Math.min(fetch.carryT / 0.25, 1);
          fetch.ballPos.set(
            THREE.MathUtils.lerp(fetch.grab.x, cradleX, kk),
            THREE.MathUtils.lerp(fetch.grab.y, 0.75, kk),
            THREE.MathUtils.lerp(fetch.grab.z, cradleZ, kk));
        } else {
          // at the spot: bend and lower the ball to the turf BEFORE the phase
          // flips to 'placing', so the host's snap-to-spot lands exactly where
          // the ball already is — no chest-to-ground pop
          if (fetch.setT === 0) fetch.setFrom.copy(fetch.ballPos);
          fetch.setT += dt;
          const kk = Math.min(fetch.setT / 0.4, 1);
          computePlace(_kp, kk);
          fetch.ballPos.set(
            THREE.MathUtils.lerp(fetch.setFrom.x, fetch.spot.x, kk),
            THREE.MathUtils.lerp(fetch.setFrom.y, BALL_R, kk),
            THREE.MathUtils.lerp(fetch.setFrom.z, fetch.spot.z, kk));
          if (fetch.setT > 0.45) { fetch.phase = 'placing'; fetch.placeT = 0; }
        }
      } else if (fetch.phase === 'placing') {
        // ball is down on the spot — straighten back up
        fetch.placeT += dt;
        const kk = Math.min(fetch.placeT / 0.3, 1);
        computePlace(_kp, 1 - kk);
        fetch.ballPos.set(fetch.spot.x, BALL_R, fetch.spot.z);
        if (fetch.placeT > 0.3) {
          fetch.phase = 'returning';
          fetch.ballPos = null;
        }
      } else if (fetch.phase === 'returning') {
        const arrived = moveKid(k, k.post, 0.35, dt);
        computeRun(_kp, k.stridePhase, 0.8);
        if (arrived) {
          k.busy = false;
          fetch = null;
        }
      }
      k.group.position.set(k.pos.x, 0, k.pos.z);
      k.group.rotation.y = k.yaw;
      applyKidPose(k, _kp, dt);
    },

    fetchState() {
      if (!fetch) return null;
      return { phase: fetch.phase, ballPos: fetch.ballPos ? fetch.ballPos.clone() : null };
    },
  };
}
