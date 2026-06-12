// ballcontrol.js — carrier <-> ball interaction layer for CYBERLIGA
// Close control (footfall-timed dribble touches), first touch (cushion into
// space), and pre-strike alignment footwork. Every contact is a physical
// touch the HOST applies to ball.vel — this module never moves the ball.
//
// Usage:
//   import { createBallControl } from './ballcontrol.js';
//   const control = createBallControl();
//   const act = control.update(dt, carrier, ball, plan, nearestDefender);
//   // host applies act (see integration notes / README in final report)

import * as THREE from 'three';

// ---- pitch bounds (frozen spec) ----
const PITCH_X = 32, PITCH_Z = 20;

// ---- tuning ----
const CONTROL_RADIUS = 1.4;       // ball considered "at feet" inside this
const CONTROL_REL_SPEED = 3.5;    // ...and slower than this relative to carrier
const RECEIVE_RADIUS = 1.3;       // first-touch trigger radius
const FOOTFALL_WINDOW = 0.5;      // rad around stridePhase % PI == 0
const TOUCH_COOLDOWN = 0.22;      // s — never two touches in one footfall
const ALIGN_MAX_T = 0.4;          // s of pre-strike footwork before we force 'ready'
const STRIKE_MIN = 0.5, STRIKE_MAX = 0.9;  // strike zone depth ahead of foot
const STRIKE_FACING = 0.55;       // cos(angle) — how aligned the body must be with aimDir
const FOOT_OFFSET = 0.16;         // lateral foot offset from center line
const SETTLE_KEEP = 0.2;          // first touch keeps 20% of incoming ball speed

// ---- module-level scratch (no per-frame allocation) ----
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _toBall = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _away = new THREE.Vector3();
const _rel = new THREE.Vector3();
const _step = new THREE.Vector3();
const _spot = new THREE.Vector3();

const TAU = Math.PI * 2;

export function createBallControl(opts = {}) {
  const rng = opts.rng || Math.random;

  // per-carrier control state
  const states = new WeakMap();
  let lastCarrier = null;

  function getState(carrier) {
    if (carrier !== lastCarrier) {
      // carrier changed: fresh state so a new player doesn't inherit timers
      states.delete(carrier);
      lastCarrier = carrier;
    }
    let s = states.get(carrier);
    if (!s) {
      s = {
        cooldown: 0,        // s until next touch allowed
        side: rng() < 0.5 ? 1 : -1, // which side of the stride line the last touch went
        alignT: 0,          // accumulated pre-strike footwork time
        lastPhaseBucket: -1 // which footfall (floor(stridePhase/PI)) last touched
      };
      states.set(carrier, s);
    }
    return s;
  }

  // is the carrier currently planted on (or close to) a footfall?
  function onFootfall(carrier) {
    const m = ((carrier.stridePhase % Math.PI) + Math.PI) % Math.PI;
    return m < FOOTFALL_WINDOW || (Math.PI - m) < FOOTFALL_WINDOW;
  }

  function isControlled(carrier, ball) {
    _toBall.subVectors(ball.pos, carrier.pos); _toBall.y = 0;
    if (_toBall.lengthSq() > CONTROL_RADIUS * CONTROL_RADIUS) return false;
    // "slow relative to carrier" = the ball isn't running away faster than the
    // carrier moves; a sprinting carrier still controls a slow rolling ball.
    const ballSpeed = Math.hypot(ball.vel.x, ball.vel.z);
    const carrierSpeed = Math.hypot(carrier.vel.x, carrier.vel.z);
    return ballSpeed < Math.max(carrierSpeed, 1.5) + CONTROL_REL_SPEED;
  }

  function update(dt, carrier, ball, plan, nearestDefender) {
    if (!carrier || !ball) return null;
    const s = getState(carrier);
    s.cooldown = Math.max(0, s.cooldown - dt);

    // can't play the ball while down or staggering hard
    if (carrier.fallT > 0) return null;

    _fwd.set(Math.sin(carrier.yaw), 0, Math.cos(carrier.yaw));
    _right.set(_fwd.z, 0, -_fwd.x); // carrier's right hand side
    _toBall.subVectors(ball.pos, carrier.pos); _toBall.y = 0;
    const ballDist = _toBall.length();
    const ballSpeed = Math.hypot(ball.vel.x, ball.vel.z);
    _rel.subVectors(ball.vel, carrier.vel); _rel.y = 0;
    const relSpeed = _rel.length();

    const defDist = nearestDefender
      ? Math.hypot(nearestDefender.pos.x - carrier.pos.x, nearestDefender.pos.z - carrier.pos.z)
      : Infinity;
    const pressured = defDist < 2.0;

    // ================= FIRST TOUCH (settle) =================
    // A moving ball ARRIVING at the feet (fast, faster than the carrier, and
    // closing in — not one of our own push-touches running ahead): one cushion
    // touch into space, already pointing where the carrier wants to go next.
    const carrierSpeed = Math.hypot(carrier.vel.x, carrier.vel.z);
    const closing = ballDist > 1e-4 && _rel.dot(_toBall) < 0;
    if (ballDist < RECEIVE_RADIUS && ball.pos.y < 1.1 && closing &&
        ballSpeed > 4 && ballSpeed > carrierSpeed + 1) {
      if (s.cooldown > 0) return null; // mid-touch; let it run
      // direction: away from the nearest defender, biased toward the plan
      if (nearestDefender) {
        _away.set(carrier.pos.x - nearestDefender.pos.x, 0, carrier.pos.z - nearestDefender.pos.z);
        if (_away.lengthSq() < 1e-6) _away.copy(_fwd);
        _away.normalize();
      } else {
        _away.copy(_fwd);
      }
      _dir.copy(_away);
      const intent = plan && (plan.carryDir || plan.aimDir);
      if (intent) {
        // 65% intent, 35% escape — a good first touch sets up the next action
        _dir.multiplyScalar(0.35).addScaledVector(intent, 0.65);
        _dir.y = 0;
        if (_dir.lengthSq() < 1e-6) _dir.copy(_away); // intent dead-opposed escape
      }
      _dir.normalize();
      clampIntoPitch(carrier.pos, _dir);

      // bad-touch chance: pressure + low flair + stagger => ball gets away
      if (pressured) {
        const flair = carrier.flair ?? 0.5;
        const pLost = 0.067 * 2 * (1 - flair) * (1 + (carrier.stagger > 0 ? 0.8 : 0));
        // (flair 0.5, no stagger => ~1/15 of pressured touches)
        if (rng() < pLost) {
          s.cooldown = 0.5;
          return { type: 'lost' };
        }
      }

      s.cooldown = 0.35 + rng() * 0.2; // settle beat before the next touch
      s.alignT = 0;
      // power encodes the cushion: host kills 80% of speed, redirects remainder
      return { type: 'settle', dir: _dir.clone(), power: THREE.MathUtils.clamp(ballSpeed / 14, 0.2, 1) };
    }

    // ball not controllable and not arriving — nothing to do
    if (!isControlled(carrier, ball)) {
      s.alignT = 0;
      return null;
    }

    // ================= STRIKE ALIGNMENT =================
    if (plan && plan.type === 'kick' && plan.aimDir) {
      const aim = plan.aimDir;
      // strike foot: ball should sit slightly to one side; pick the side the ball is on now
      const sideNow = Math.sign(_toBall.dot(_right)) || 1;
      // desired ball spot: 0.5-0.9m ahead of the strike foot
      const facing = _fwd.dot(aim) / (aim.length() || 1);
      const ahead = _toBall.dot(_fwd);
      const lateral = _toBall.dot(_right) * sideNow; // distance toward strike-foot line
      const inZone =
        ahead > STRIKE_MIN && ahead < STRIKE_MAX &&
        Math.abs(lateral - FOOT_OFFSET) < 0.35 &&
        facing > STRIKE_FACING;

      if (inZone) {
        s.alignT = 0;
        return { type: 'ready' };
      }

      s.alignT += dt;
      if (s.alignT > ALIGN_MAX_T) {
        // footwork budget spent — strike from where we are rather than dancing forever
        s.alignT = 0;
        return { type: 'ready' };
      }
      // step so that the ideal spot (0.7m ahead of strike foot, body turned to aim)
      // ends up where the ball is: move the BODY, not the ball.
      _spot.copy(aim).normalize();
      // desired carrier position = ball - 0.7*aim - footOffset along aim's right
      _step.set(
        ball.pos.x - _spot.x * 0.7 - _spot.z * FOOT_OFFSET * sideNow - carrier.pos.x,
        0,
        ball.pos.z - _spot.z * 0.7 + _spot.x * FOOT_OFFSET * sideNow - carrier.pos.z
      );
      // small adjustment steps, capped — shuffly footwork, not a lunge
      const maxStep = 3.0; // m/s of velocity nudge
      if (_step.length() > 1e-4) {
        _step.normalize().multiplyScalar(Math.min(maxStep, 2.5 + _step.length() * 2));
      }
      return { type: 'align', step: _step.clone() };
    }
    s.alignT = 0;

    // ================= DRIBBLE TOUCH =================
    if (!plan || plan.type !== 'carry' || !plan.carryDir) return null;
    if (s.cooldown > 0) return null;
    if (!onFootfall(carrier)) return null;
    // one touch per footfall: bucket the phase so we don't re-fire within the same window
    const bucket = Math.floor((((carrier.stridePhase % TAU) + TAU) % TAU) / Math.PI);
    if (bucket === s.lastPhaseBucket) return null;
    s.lastPhaseBucket = bucket;

    const spd = Math.hypot(carrier.vel.x, carrier.vel.z);
    if (spd < 0.5 && ballDist < 0.7) return null; // standing over the ball — no touch needed

    // touch length (meters the ball should travel before the carrier catches it)
    let touchLen;
    if (pressured) touchLen = 0.5 + 0.3 * rng();              // tight under pressure
    else if (spd > 5.5) touchLen = 2.0 + rng();               // sprinting in space: 2-3m pushes
    else touchLen = 1.0 + 0.5 * rng();                        // jogging: 1-1.5m
    // power 0..1 — host maps to ball speed; scale so the ball outruns the carrier
    // briefly then is caught: speed needed ≈ carrierSpeed + touchLen boost
    const power = THREE.MathUtils.clamp((spd + touchLen * 2.2) / 14, 0.15, 1);

    // direction: carry intent blended toward the stride line, alternating feet
    s.side = -s.side; // left foot, right foot
    _dir.copy(plan.carryDir); _dir.y = 0;
    if (_dir.lengthSq() < 1e-6) _dir.copy(_fwd);
    _dir.normalize();
    // keep the ball near the run line: blend toward carrier forward
    _dir.lerp(_fwd, 0.35).normalize();
    // alternate slightly to the side of the touching foot (smaller when pressured)
    _dir.addScaledVector(_right, s.side * (pressured ? 0.06 : 0.12) * (0.7 + 0.6 * rng()));
    _dir.y = 0; _dir.normalize();
    clampIntoPitch(carrier.pos, _dir);

    // heavy-touch failure under pressure
    if (pressured) {
      const flair = carrier.flair ?? 0.5;
      let pLost = (1 / 15) * 2 * (1 - flair); // flair .5 => 1/15
      if (carrier.stagger > 0) pLost *= 1.8;
      if (rng() < pLost) {
        s.cooldown = 0.5;
        return { type: 'lost' };
      }
    }

    // cooldown until roughly the next footfall (phase advances ~2.4 rad/m)
    const stride = Math.PI / 2.4; // meters between footfalls
    s.cooldown = Math.max(TOUCH_COOLDOWN, spd > 0.1 ? stride / Math.max(spd, 1.5) * 0.8 : TOUCH_COOLDOWN);

    return { type: 'touch', dir: _dir.clone(), power };
  }

  // bend a touch direction inward when it would push the ball off the pitch
  function clampIntoPitch(pos, dir) {
    const margin = 2.0;
    if ((pos.x > PITCH_X - margin && dir.x > 0) || (pos.x < -PITCH_X + margin && dir.x < 0)) {
      dir.x *= 0.2;
    }
    if ((pos.z > PITCH_Z - margin && dir.z > 0) || (pos.z < -PITCH_Z + margin && dir.z < 0)) {
      dir.z *= 0.2;
    }
    if (dir.lengthSq() < 1e-6) dir.set(-Math.sign(pos.x) || 1, 0, 0);
    dir.normalize();
  }

  return { update, isControlled };
}
