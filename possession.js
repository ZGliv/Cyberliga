// possession.js — carrier <-> ball ATTACHMENT layer for CYBERLIGA
//
// THE MODEL
// ballcontrol.js produces discrete, footfall-timed TOUCHES. Between touches
// nothing reconciled the ball with the carrier's actual path, and the carrier's
// steering never knew where the ball was — so he'd run at tactical target
// speed, overrun his own touch, and "lose" a ball sitting behind his heels.
//
// This module runs EVERY frame for the established carrier and closes that
// loop with two soft, physical corrections (never a teleport):
//
//  1. out.speedScale — the carrier adapts to the ball. We measure where the
//     ball sits in the carrier's frame (ahead/behind along his velocity,
//     lateral offset). If the ball is behind or beside his feet he decelerates
//     (the OVERRUN GUARD); in the sweet spot he runs free; if his own touch is
//     escaping ahead he gets a brief catch-up burst (<= 1.15x).
//
//  2. out.ballAccel — the ball adapts (gently) to the carrier. A critically
//     damped spring steers the rolling ball toward the sweet spot 0.6-1.0m
//     ahead of the feet, capped at ~8 m/s^2 so it reads as constant subtle
//     shepherding, not magnetism. It fades to zero inside the sweet spot,
//     when the ball is airborne, and — crucially — when the ball is moving
//     AWAY at pace (a real touch in flight, or an opponent's poke: physics
//     owns it, we never drag it back).
//
// out.faceBall tells the host's yaw logic to square up when the ball is
// outside the carrier's forward +-60° cone (e.g. after a sharp turn).
//
// Plain math only: no scene, no DOM, zero per-frame allocations.

import * as THREE from 'three';

// ---- tuning ----
const SWEET_NEAR = 0.6;       // m — sweet-spot band ahead of the feet
const SWEET_FAR  = 1.0;
const SWEET_MID  = 0.8;       // spring target depth
const CARRY_RADIUS = 1.6;     // beyond this we're not carrying
const CARRY_REL_SPEED = 4.0;  // relative speed bound for "carrying"
const GROUNDED_Y = 0.6;       // ball above this = airborne, hands (feet) off
const ACCEL_MAX = 8.0;        // m/s^2 cap on ball shepherding
const SPRING_K = 9.0;         // spring stiffness toward sweet spot
const SPRING_D = 5.0;         // damping on relative velocity
const AWAY_DEAD_SPEED = 3.0;  // ball receding faster than this => deadzone (touch/poke in progress)
const AWAY_DEAD_FADE = 1.5;   // fade width below the deadzone threshold
const FACE_ENTER_COS = 0.4;   // faceBall switches ON below this cos (~66°)
const FACE_EXIT_COS  = 0.6;   // ...and OFF only above this (~53°) — hysteresis
const BURST_MAX = 1.15;       // catch-up burst ceiling
const SLOW_FLOOR = 0.25;      // never command a full stop — keep legs moving
const SCALE_SMOOTH = 12;      // 1/s — speedScale smoothing rate (fast but unjittery)

// ---- module scratch (zero per-frame allocation) ----
const _dir = new THREE.Vector3();     // carrier's motion direction (xz)
const _right = new THREE.Vector3();
const _toBall = new THREE.Vector3();
const _sweet = new THREE.Vector3();
const _err = new THREE.Vector3();
const _relVel = new THREE.Vector3();
const _fwd = new THREE.Vector3();

export function createPossession(opts = {}) {
  // tiny per-carrier state: smoothed speedScale so the overrun guard doesn't
  // chatter the carrier's legs frame to frame
  const states = new WeakMap();
  function getState(c) {
    let s = states.get(c);
    if (!s) { s = { scale: 1, facing: false }; states.set(c, s); }
    return s;
  }

  function update(dt, carrier, ball, out) {
    out.ballAccel.set(0, 0, 0);
    out.speedScale = 1;
    out.faceBall = false;
    if (!carrier || !ball || dt <= 0) return out;
    const s = getState(carrier);

    // ---- carrier frame ----
    // motion direction: BLEND facing -> velocity over spd 0.3..0.8 instead of
    // switching at a hard threshold. Using the REAL velocity (not the tactical
    // target) keeps corrections referenced to where the body actually goes;
    // blending kills the ~1.6m sweet-spot jump (and the spring-direction snap)
    // when a turning carrier crossed the old spd=0.5 switch.
    const spd = Math.hypot(carrier.vel.x, carrier.vel.z);
    _fwd.set(Math.sin(carrier.yaw), 0, Math.cos(carrier.yaw));
    const wVel = THREE.MathUtils.clamp((spd - 0.3) / 0.5, 0, 1);
    if (wVel > 0) {
      _dir.set(carrier.vel.x / spd, 0, carrier.vel.z / spd)
        .multiplyScalar(wVel).addScaledVector(_fwd, 1 - wVel);
      const dl = _dir.length();
      if (dl > 1e-4) _dir.multiplyScalar(1 / dl); else _dir.copy(_fwd);
    } else {
      _dir.copy(_fwd);
    }
    _right.set(_dir.z, 0, -_dir.x);
    _toBall.subVectors(ball.pos, carrier.pos); _toBall.y = 0;
    const dist = _toBall.length();
    const ahead = _toBall.dot(_dir);     // + in front of feet, - behind
    const lateral = _toBall.dot(_right); // signed sideways offset
    _relVel.subVectors(ball.vel, carrier.vel); _relVel.y = 0;
    const recede = dist > 1e-4 ? _relVel.dot(_toBall) / dist : 0; // +away, -closing

    // ---- faceBall: ball outside the body's forward cone, with hysteresis so
    // a ball sitting ON the cone edge can't toggle the torso every frame ----
    const cosA = dist > 1e-4 ? _fwd.dot(_toBall) / dist : 1;
    s.facing = s.facing ? cosA < FACE_EXIT_COS : cosA < FACE_ENTER_COS;
    out.faceBall = dist > 0.15 && s.facing;

    // ---- speedScale: the overrun guard ----
    // Decompose the problem in the carrier's frame:
    //   ball behind (ahead < SWEET_NEAR): slow down proportionally; at/behind
    //     the heels command near-stop so he gathers it instead of leaving it.
    //   ball wide (|lateral| big): also slow — running full tilt past a ball
    //     half a metre to your side IS the overrun bug.
    //   ball escaping ahead: brief burst to catch your own touch.
    // Braking only applies to a ball we're CATCHING (closing or slow-receding).
    // A ball escaping at pace must be chased at full speed — braking there is
    // exactly the "watch your own touch roll away" bug. chaseGate: 0 = catching
    // (brakes active), 1 = ball running from us (brakes off, burst on).
    const chaseGate = THREE.MathUtils.clamp((recede - 0.2) / 0.8, 0, 1);
    let target = 1;
    if (ahead < SWEET_NEAR) {
      // 1 at the sweet-spot edge -> SLOW_FLOOR when the ball is 0.5m behind
      const t = THREE.MathUtils.clamp((ahead + 0.5) / (SWEET_NEAR + 0.5), 0, 1);
      const brake = SLOW_FLOOR + (1 - SLOW_FLOOR) * t * t; // quadratic: brake hard when truly behind
      target = brake + (1 - brake) * chaseGate;
    } else if (ahead > SWEET_FAR && recede > 0.3) {
      // own touch running ahead: burst, scaled by how fast it's getting away,
      // but NOT when it's a full-blown escape (>3m ahead = chase normally)
      const escape = THREE.MathUtils.clamp((recede - 0.3) / 2.5, 0, 1);
      const range = THREE.MathUtils.clamp(1 - (ahead - SWEET_FAR) / 2.0, 0, 1);
      target = 1 + (BURST_MAX - 1) * escape * range;
    }
    // wide-ball penalty multiplies in (a ball both behind AND wide brakes
    // hardest) — but only when catching, never while the ball runs from us
    const wide = THREE.MathUtils.clamp((Math.abs(lateral) - 0.45) / 0.7, 0, 1);
    target *= 1 - 0.6 * wide * (1 - chaseGate);
    target = Math.max(target, SLOW_FLOOR);
    // smooth — legs respond in ~80ms, not instantaneously (frame-rate safe)
    s.scale += (target - s.scale) * (1 - Math.exp(-SCALE_SMOOTH * dt));
    out.speedScale = s.scale;

    // ---- ballAccel: continuous shepherding spring ----
    // Deadzones — when we must NOT touch the ball. Both FADE over a band
    // instead of toggling the 8 m/s² spring on/off at a hard edge (a lightly
    // bouncing or edge-of-range ball used to get a force pulse per crossing):
    if (ball.pos.y > GROUNDED_Y + 0.2) return out;            // airborne
    if (dist > CARRY_RADIUS + 0.6) return out;                // not ours to nudge
    const airGate = THREE.MathUtils.clamp((GROUNDED_Y + 0.2 - ball.pos.y) / 0.2, 0, 1);
    const nearGate = THREE.MathUtils.clamp((CARRY_RADIUS + 0.6 - dist) / 0.4, 0, 1);
    // away-at-pace deadzone: a touch in progress or an opponent's poke.
    // Full strength when slow/closing, fading to zero as recede speed rises.
    // ...and direction-agnostic: a ball moving fast RELATIVE to the carrier in
    // any direction (e.g. a perpendicular poke) is not ours to shepherd either.
    const relSpeed = _relVel.length();
    const awayGate = THREE.MathUtils.clamp(
        (AWAY_DEAD_SPEED - recede) / AWAY_DEAD_FADE, 0, 1)
      * THREE.MathUtils.clamp((CARRY_REL_SPEED + 0.5 - relSpeed) / 1.5, 0, 1);
    if (awayGate <= 0) return out;

    // critically-damped-ish spring toward the sweet spot ahead of the feet
    _sweet.copy(carrier.pos).addScaledVector(_dir, SWEET_MID);
    _err.subVectors(_sweet, ball.pos); _err.y = 0;
    // sweet-spot fade: inside the band and roughly centred, do (almost) nothing —
    // the ball oscillating naturally between touches must not look tethered
    const inBand = ahead > SWEET_NEAR && ahead < SWEET_FAR && Math.abs(lateral) < 0.35;
    const errLen = _err.length();
    const bandFade = inBand ? THREE.MathUtils.clamp((errLen - 0.15) / 0.3, 0, 1) : 1;

    // a = K*err + D*(carrierVel - ballVel)  — spring + relative-velocity damping
    out.ballAccel.copy(_err).multiplyScalar(SPRING_K)
      .addScaledVector(_relVel, -SPRING_D);
    out.ballAccel.y = 0;
    const mag = out.ballAccel.length();
    const scale = (mag > 1e-6 ? Math.min(1, ACCEL_MAX / mag) : 0) * awayGate * bandFade * airGate * nearGate;
    out.ballAccel.multiplyScalar(scale);
    return out;
  }

  function isCarrying(carrier, ball) {
    if (!carrier || !ball) return false;
    if (ball.pos.y > GROUNDED_Y) return false;
    _toBall.subVectors(ball.pos, carrier.pos); _toBall.y = 0;
    if (_toBall.lengthSq() > CARRY_RADIUS * CARRY_RADIUS) return false;
    _relVel.subVectors(ball.vel, carrier.vel); _relVel.y = 0;
    return _relVel.length() < CARRY_REL_SPEED;
  }

  function release(carrier) {
    // Keep the smoothed per-carrier state: deleting it meant a braking carrier
    // who re-acquired the ball snapped 0.25 -> 1 in one frame. Kept state lets
    // the next acquisition RAMP from where the legs actually are (WeakMap, so
    // departed players are still collected).
  }

  return { update, isCarrying, release };
}
