// ballflight.js — advanced soccer ball flight physics for CYBERLIGA.
// ES module. Host owns walls/goals/players; this module only mutates
// ball.pos / ball.vel / ball.spin / ball.knuckle.
//
// Spin semantics (THREE.Vector3, rad/s, right-hand rule, world axes):
//   spin.y > 0  → sidespin curving the ball toward (up × vel)
//   spin axis horizontal & perpendicular to vel → topspin/backspin
//   (topspin = spin × vel points downward; backspin = upward lift)
// kick() builds these axes from the kick direction, so callers never
// have to think about it.

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

// -- Aerodynamics --
const AIR_DRAG = 0.018;          // quadratic drag coefficient: a = -DRAG * |v| * v
const MAGNUS_K = 0.026;          // Magnus accel = MAGNUS_K * (spin × vel).
                                 //   full-power curler (~26 m/s, spin.y≈22 rad/s) gives
                                 //   ~0.026*22*27 ≈ 15 m/s² lateral at launch, decaying with
                                 //   spin → 3-6 m of bend over a 25 m flight.
const MAGNUS_MAX_ACCEL = 60;     // clamp Magnus accel magnitude (stability at dt=0.05)
const SPIN_MAX = 40;             // rad/s hard cap on spin magnitude
const SPIN_AIR_DECAY = 0.45;     // per-second exponential spin decay in flight

// -- Knuckleball --
const KNUCKLE_ACCEL = 26;        // peak lateral wander accel (m/s²); at ~28 m/s over a
                                 //   30 m flight (~1.1 s) gives ±1-1.5 m of drift
const KNUCKLE_FREQ = 9;          // how often (Hz, roughly) the wander direction re-rolls
const KNUCKLE_DECAY = 0.8;       // per-second decay of ball.knuckle in air
const KNUCKLE_MIN_SPEED = 6;     // below this speed the seam effect dies off

// -- Ground interaction --
const RESTITUTION = 0.55;        // vertical bounce energy retention
const BOUNCE_MIN_VY = 1.0;       // below this vertical speed, stop bouncing and roll
const ROLL_FRICTION = 1.6;       // m/s² rolling resistance deceleration when grounded
const ROLL_STOP_SPEED = 0.15;    // snap to rest below this horizontal speed
const SPIN_GROUND_DECAY = 6.0;   // per-second spin decay while grounded (scrubbing)
const BOUNCE_SPIN_KICK = 0.32;   // ball radius * coupling: how much surface spin speed
                                 //   transfers into horizontal velocity on a bounce.
                                 //   topspin → forward kick, backspin → check-up,
                                 //   sidespin (spin.y) → lateral deflection.
const BOUNCE_SPIN_LOSS = 0.45;   // fraction of spin lost per bounce
const BOUNCE_FRICTION = 0.88;    // horizontal velocity retained through a bounce (scrub)

// -- Kick technique table --
// speed: launch speed at power=1 (m/s). loft: vertical fraction (vy = speed*loft adj).
// top: topspin (+) / backspin (−) rad/s at power=1. side: sidespin rad/s (scaled by curve).
// knuckle: chaos amount 0..1.
const TECHNIQUES = {
  pass:      { speed: 14, loft: 0.06, top:  4,  side: 0,  knuckle: 0 },
  driven:    { speed: 26, loft: 0.10, top:  6,  side: 0,  knuckle: 0 },
  lob:       { speed: 21, loft: 0.95, top: -14, side: 0,  knuckle: 0 },
  chip:      { speed: 20, loft: 1.25, top: -22, side: 0,  knuckle: 0 },
  curler:    { speed: 27, loft: 0.30, top: -4,  side: 22, knuckle: 0 },
  screamer:  { speed: 30, loft: 0.16, top:  1,  side: 0,  knuckle: 1 },
  cross:     { speed: 19, loft: 0.55, top: -8,  side: 14, knuckle: 0 },
  clearance: { speed: 24, loft: 0.70, top: -6,  side: 0,  knuckle: 0 },
};
const MIN_POWER = 0.25;          // power floor so a 0-power kick still moves the ball
const LIFT_MOD_RANGE = 0.5;      // opts.lift remaps loft by ±50%

// ---------------------------------------------------------------------------

export function createBallFlight(opts = {}) {
  const GRAVITY = opts.gravity ?? 22;
  const GROUND_Y = opts.groundY ?? 0.32;
  const rng = opts.rng ?? Math.random;

  // Scratch vectors (no per-frame allocation).
  const _accel = new THREE.Vector3();
  const _magnus = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  const _sideAxis = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);

  // Knuckleball wander state: re-rolled direction at KNUCKLE_FREQ.
  let knuckleTimer = 0;
  let knuckleDirX = 0, knuckleDirY = 0, knuckleDirZ = 0;

  function step(ball, dt) {
    dt = Math.min(dt, 0.05);
    if (dt <= 0) return;

    const grounded = ball.pos.y <= GROUND_Y + 1e-4 && ball.vel.y <= 0.001;

    // ---- Forces (airborne) ----
    if (!grounded) {
      _accel.set(0, -GRAVITY, 0);

      // Quadratic air drag.
      const speed = ball.vel.length();
      if (speed > 1e-4) {
        _accel.addScaledVector(ball.vel, -AIR_DRAG * speed);
      }

      // Magnus: a = k * (spin × vel), clamped for stability.
      _magnus.crossVectors(ball.spin, ball.vel).multiplyScalar(MAGNUS_K);
      if (_magnus.lengthSq() > MAGNUS_MAX_ACCEL * MAGNUS_MAX_ACCEL) {
        _magnus.setLength(MAGNUS_MAX_ACCEL);
      }
      _accel.add(_magnus);

      // Knuckleball wander: chaotic seam-driven lateral force, mostly
      // perpendicular to travel, re-rolled a few times per second.
      if (ball.knuckle > 0.01 && speed > KNUCKLE_MIN_SPEED) {
        knuckleTimer -= dt;
        if (knuckleTimer <= 0) {
          knuckleTimer = 1 / KNUCKLE_FREQ * (0.6 + 0.8 * rng());
          // Random direction perpendicular to velocity.
          _fwd.copy(ball.vel).normalize();
          _sideAxis.crossVectors(_up, _fwd).normalize();
          const lateral = rng() * 2 - 1;
          const vertical = (rng() * 2 - 1) * 0.5; // weaker vertical wobble
          knuckleDirX = _sideAxis.x * lateral;
          knuckleDirY = vertical;
          knuckleDirZ = _sideAxis.z * lateral;
        }
        const k = Math.min(ball.knuckle, 1) * KNUCKLE_ACCEL;
        _accel.x += knuckleDirX * k;
        _accel.y += knuckleDirY * k;
        _accel.z += knuckleDirZ * k;
        ball.knuckle = Math.max(0, ball.knuckle - KNUCKLE_DECAY * dt);
      }

      // Semi-implicit Euler: stable at dt=0.05.
      ball.vel.addScaledVector(_accel, dt);
      ball.pos.addScaledVector(ball.vel, dt);

      // Air spin decay (exponential).
      ball.spin.multiplyScalar(Math.exp(-SPIN_AIR_DECAY * dt));
    } else {
      // ---- Grounded: roll ----
      ball.pos.y = GROUND_Y;
      ball.vel.y = 0;
      const hSpeed = Math.hypot(ball.vel.x, ball.vel.z);
      if (hSpeed > ROLL_STOP_SPEED) {
        const drop = ROLL_FRICTION * dt;
        const scale = Math.max(0, (hSpeed - drop) / hSpeed);
        ball.vel.x *= scale;
        ball.vel.z *= scale;
        ball.pos.x += ball.vel.x * dt;
        ball.pos.z += ball.vel.z * dt;
      } else {
        ball.vel.x = 0;
        ball.vel.z = 0;
      }
      // Strong spin decay scrubbing on the turf.
      ball.spin.multiplyScalar(Math.exp(-SPIN_GROUND_DECAY * dt));
      ball.knuckle = 0;
    }

    // ---- Ground bounce ----
    if (ball.pos.y < GROUND_Y && ball.vel.y < 0) {
      ball.pos.y = GROUND_Y;
      if (-ball.vel.y > BOUNCE_MIN_VY) {
        ball.vel.y = -ball.vel.y * RESTITUTION;

        // Spin↔velocity coupling at the contact patch.
        // Horizontal travel direction:
        _fwd.set(ball.vel.x, 0, ball.vel.z);
        const hSpeed = _fwd.length();
        if (hSpeed > 1e-3) {
          _fwd.multiplyScalar(1 / hSpeed);
          _sideAxis.crossVectors(_up, _fwd); // points left of travel
          // Topspin/backspin component: spin about the side axis.
          // Positive (topspin) → accelerates ball forward off the bounce;
          // negative (backspin) → checks it up.
          const topspin = ball.spin.dot(_sideAxis);
          ball.vel.addScaledVector(_fwd, topspin * BOUNCE_SPIN_KICK);
          // Sidespin (yaw spin) deflects laterally off the bounce.
          ball.vel.addScaledVector(_sideAxis, -ball.spin.y * BOUNCE_SPIN_KICK * 0.6);
        }
        // Scrub horizontal speed and bleed spin.
        ball.vel.x *= BOUNCE_FRICTION;
        ball.vel.z *= BOUNCE_FRICTION;
        ball.spin.multiplyScalar(1 - BOUNCE_SPIN_LOSS);
      } else {
        // Too slow to bounce — settle into a roll.
        ball.vel.y = 0;
      }
    }

    // ---- Spin magnitude cap (stability) ----
    if (ball.spin.lengthSq() > SPIN_MAX * SPIN_MAX) {
      ball.spin.setLength(SPIN_MAX);
    }
  }

  function kick(ball, { dir, power = 1, technique = 'pass', curve = 0, lift } = {}) {
    const t = TECHNIQUES[technique] || TECHNIQUES.pass;
    const p = MIN_POWER + (1 - MIN_POWER) * Math.min(Math.max(power, 0), 1);

    // Horizontal launch direction (defensive normalize, y forced to 0).
    _fwd.set(dir.x, 0, dir.z);
    if (_fwd.lengthSq() < 1e-8) _fwd.set(1, 0, 0);
    _fwd.normalize();
    _sideAxis.crossVectors(_up, _fwd); // left of travel

    // Loft, optionally remapped by the lift modifier (0..1, 0.5 = neutral).
    let loft = t.loft;
    if (lift !== undefined) {
      loft *= 1 + (Math.min(Math.max(lift, 0), 1) - 0.5) * 2 * LIFT_MOD_RANGE;
    }

    const speed = t.speed * p;
    // Split speed into horizontal pace and vertical loft so total launch
    // speed stays ≈ technique speed regardless of loft.
    const ang = Math.atan(loft);
    ball.vel.copy(_fwd).multiplyScalar(speed * Math.cos(ang));
    ball.vel.y = speed * Math.sin(ang);

    // Spin: topspin/backspin about the side axis, sidespin about world Y.
    // curve > 0 bends toward (up × dir); curve < 0 bends the other way.
    const c = Math.min(Math.max(curve, -1), 1);
    const sideSpin = t.side !== 0 ? t.side * (c !== 0 ? c : 1) * p : t.side * c * p;
    ball.spin.copy(_sideAxis).multiplyScalar(t.top * p);
    ball.spin.y += (t.side !== 0 && c === 0 ? t.side * p : sideSpin);
    if (ball.spin.lengthSq() > SPIN_MAX * SPIN_MAX) ball.spin.setLength(SPIN_MAX);

    ball.knuckle = t.knuckle * p;
    knuckleTimer = 0; // re-roll wander direction immediately

    return { speed, technique };
  }

  return { step, kick };
}
