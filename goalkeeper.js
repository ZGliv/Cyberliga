// goalkeeper.js — real goalkeeper AI for the Cyberliga sim.
// Pure decision module: no scene, no DOM. The host owns the ball physics and
// the player steering; this module just says where to stand and when to dive.
//
// Conventions (must match index.html):
//   pitch x ∈ [-32,32], z ∈ [-20,20]; a GK with dir=-1 guards x=-32, dir=+1 guards x=+32
//   goal mouth z ∈ [-4.5,4.5], height 3.2; penalty box |x| ∈ [20,32], z ∈ [-9,9]
//   gravity 22, ball rest y 0.32
//
// `side` in dive results / diveState is keeper-relative: +1 = the keeper's right
// hand side when facing the pitch (i.e. world +z for the dir=-1 keeper, world -z
// for the dir=+1 keeper). poseDive(side, k) consumes it directly.

import * as THREE from 'three';

const HALF_W = 32, HALF_H = 20;
const GOAL_HALF = 4.5, GOAL_HEIGHT = 3.2;
const GRAVITY = 22;
const BALL_R = 0.32;

const SHOT_SPEED = 9;          // m/s — slower balls are "loose", not shots
const SHOT_RANGE = 28;         // shots only detected from within this distance
const DIVE_REACH = 2.8;        // full-stretch fingertip reach
const DIVE_DUR = 0.8;          // host pose window
const HOLD_DUR = 1.2;          // seconds holding the ball after a catch
const CATCH_DIST = 1.0;        // within this of the body → catch attempt
const CATCH_MAX_SPEED = 16;    // too hot to hold above this
const SIX_YARD_X = 5.5;        // depth of the "come and claim" zone off the line
const SIX_YARD_Z = 7.5;

export function createGoalkeeper(opts = {}) {
  const rng = opts.rng || Math.random;

  // Per-keeper state, keyed on the gk object so one instance can run both keepers.
  let states = new Map();
  function S(gk) {
    let s = states.get(gk);
    if (!s) {
      s = {
        diveT: 0,            // remaining dive-window time (counts down from DIVE_DUR)
        diveSide: 1,
        holdT: 0,            // remaining hold time after a catch
        reactT: -1,          // reaction countdown after a shot is first seen (<0 = idle)
        shotLive: false,     // a qualifying shot is currently in flight
        diveDone: false,     // already committed to this shot — never dive twice at one ball
      };
      states.set(gk, s);
    }
    return s;
  }

  // Predict where/when the ball crosses the goal plane x = lineX.
  // Ballistic y (gravity only, spin ignored); straight-line xz. Returns null if
  // the ball isn't actually heading at that plane.
  function predictCrossing(ball, lineX) {
    const vx = ball.vel.x;
    const dx = lineX - ball.pos.x;
    if (Math.abs(vx) < 0.5) return null;
    const t = dx / vx;
    if (t <= 0 || t > 3) return null;
    const z = ball.pos.z + ball.vel.z * t;
    let y = ball.pos.y + ball.vel.y * t - 0.5 * GRAVITY * t * t;
    if (y < BALL_R) y = BALL_R; // rolling / bounced-down shots arrive along the ground
    return { t, y, z };
  }

  function nearestOpponentTime(gk, point, players) {
    let best = Infinity;
    for (const p of players) {
      if (!p || p === gk || p.team === gk.team) continue;
      const t = Math.hypot(p.pos.x - point.x, p.pos.z - point.z) / Math.max(p.speed || 6, 1);
      if (t < best) best = t;
    }
    return best;
  }

  // Angle-bisector standing spot: on the line that splits the ball→near-post /
  // ball→far-post angle, `depth` metres off the goal line.
  function bisectorTarget(gk, ball, depth) {
    const lineX = gk.dir * HALF_W;
    const standX = lineX - gk.dir * depth;
    const bx = ball.pos.x, bz = ball.pos.z;
    const u1 = new THREE.Vector2(lineX - bx, -GOAL_HALF - bz).normalize();
    const u2 = new THREE.Vector2(lineX - bx,  GOAL_HALF - bz).normalize();
    const bis = u1.add(u2);
    let z;
    if (Math.abs(bis.x) < 1e-4) {
      z = bz; // ball is on the goal line itself — just mirror it
    } else {
      const s = (standX - bx) / bis.x;
      z = bz + bis.y * s;
    }
    z = THREE.MathUtils.clamp(z, -GOAL_HALF + 0.4, GOAL_HALF - 0.4);
    return new THREE.Vector3(standX, 0, z);
  }

  return {
    update(dt, gk, ball, players) {
      const s = S(gk);
      const lineX = gk.dir * HALF_W;
      const distBallToGoal = Math.hypot(ball.pos.x - lineX, ball.pos.z);
      const ballSpeed = ball.vel.length();
      const incoming = ball.vel.x * gk.dir > 0.5; // moving toward our goal

      // ---- timers ----
      if (s.diveT > 0) {
        s.diveT = Math.max(0, s.diveT - dt);
        // stay planted through the dive; host suppresses normal anim via isDiving()
        if (s.diveT === 0 && s.pendingHold) { s.holdT = HOLD_DUR; s.pendingHold = false; }
        return { type: 'position', target: gk.pos.clone() };
      }
      if (s.holdT > 0) {
        s.holdT = Math.max(0, s.holdT - dt);
        if (s.holdT > 0) return { type: 'hold' };
      }

      // ---- shot detection & dive decision ----
      const cross = predictCrossing(ball, lineX);
      const onTarget = cross
        && Math.abs(cross.z) < GOAL_HALF + 0.4
        && cross.y < GOAL_HEIGHT + 0.3;
      const isShot = incoming && ballSpeed > SHOT_SPEED && distBallToGoal < SHOT_RANGE && onTarget;

      if (isShot && !s.diveDone) {
        if (!s.shotLive) {
          s.shotLive = true;
          s.reactT = 0.15 + 0.10 * rng(); // human reaction delay
        }
        s.reactT -= dt;
        // Commit once reacted AND arrival is inside the dive window.
        if (s.reactT <= 0 && cross.t < 0.55) {
          s.diveDone = true;
          s.diveT = DIVE_DUR;

          const dz = cross.z - gk.pos.z;
          const dy = Math.max(0, cross.y - 1.0); // reach measured from chest height
          const dist = Math.hypot(dz, dy);
          // Less remaining time = less of the full stretch is usable; plenty of
          // time buys a side-step into the dive (slightly beyond pure arm reach).
          const effReach = DIVE_REACH * THREE.MathUtils.clamp(cross.t / 0.4, 0.5, 1.2);
          s.diveSide = (dz >= 0 ? 1 : -1) * -gk.dir; // keeper-relative
          const power = THREE.MathUtils.clamp(dist / DIVE_REACH, 0.15, 1);

          let save = null;
          if (dist <= effReach) {
            // Placement + pace beat him probabilistically: straight at him ≈ always
            // saved, corner shots at pace ≈ 35-45% goals, screamers more.
            const edge = THREE.MathUtils.clamp((dist / effReach - 0.45) / 0.55, 0, 1);
            const pace = THREE.MathUtils.clamp((ballSpeed - 12) / 14, 0, 1);
            const pBeaten = edge * (0.35 + 0.45 * pace);
            if (rng() >= pBeaten) {
              if (dist < CATCH_DIST && ballSpeed < CATCH_MAX_SPEED) {
                save = { mode: 'catch', deflect: null };
                s.pendingHold = true;
              } else {
                // Parry wide and down — toward the near corner/byline, never central.
                const zSide = cross.z >= 0 ? 1 : -1;
                const deflect = new THREE.Vector3(
                  -gk.dir * 0.45,          // back out into the pitch, toward the byline
                  0.12,                    // keep it low
                  zSide * (0.9 + 0.4 * rng()) // push it wider than where it was going
                ).normalize();
                save = { mode: 'parry', deflect };
              }
            }
            // else: got a glove pose to it but BEATEN — save stays null
          }
          return { type: 'dive', side: s.diveSide, power, save };
        }
        // reacting: set on the line and shuffle toward the predicted crossing point
        const setZ = THREE.MathUtils.clamp(cross.z * 0.85, -GOAL_HALF + 0.4, GOAL_HALF - 0.4);
        return { type: 'position', target: new THREE.Vector3(lineX - gk.dir * 0.5, 0, setZ) };
      }

      if (!isShot) {
        // shot lapsed (saved, scored, blocked, or went wide) → rearm for the next one
        s.shotLive = false;
        s.reactT = -1;
        if (!incoming || ballSpeed < SHOT_SPEED * 0.7) s.diveDone = false;
      }

      // ---- claim loose balls in the six-yard area ----
      const inSixYard = Math.abs(ball.pos.x - lineX) < SIX_YARD_X && Math.abs(ball.pos.z) < SIX_YARD_Z;
      if (inSixYard && ballSpeed < 8 && ball.pos.y < 1.4) {
        return { type: 'position', target: new THREE.Vector3(ball.pos.x, 0, ball.pos.z) };
      }

      // ---- sweep behind the defense for through balls ----
      // Ball rolling into our box-ish territory, slow enough to claim, and we get
      // there comfortably before the nearest attacker.
      const inDanger = (ball.pos.x * gk.dir) > 10 && Math.abs(ball.pos.z) < 13;
      if (inDanger && incoming && ballSpeed < SHOT_SPEED && ball.pos.y < 1.0) {
        const lead = ball.pos.clone().addScaledVector(ball.vel, 0.4); // meet it, don't chase it
        lead.x = THREE.MathUtils.clamp(lead.x, -HALF_W + 0.5, HALF_W - 0.5);
        lead.z = THREE.MathUtils.clamp(lead.z, -HALF_H + 0.5, HALF_H - 0.5);
        const myT = Math.hypot(lead.x - gk.pos.x, lead.z - gk.pos.z) / Math.max(gk.speed || 6, 1);
        const oppT = nearestOpponentTime(gk, lead, players || []);
        if (myT + 0.3 < oppT) {
          return { type: 'position', target: lead };
        }
      }

      // ---- default: bisector positioning ----
      // Far/wide ball → step out up to 2m; shot brewing close in → drop to the line.
      const threat = THREE.MathUtils.clamp(1 - distBallToGoal / 26, 0, 1); // 0 far, 1 close
      let depth = THREE.MathUtils.lerp(2.0, 0.5, threat);
      if (incoming && ballSpeed > SHOT_SPEED * 0.8 && distBallToGoal < 18) depth = 0.5; // shot imminent: set on the line
      return { type: 'position', target: bisectorTarget(gk, ball, depth) };
    },

    isDiving(gk) {
      const s = states.get(gk);
      return !!s && s.diveT > 0;
    },

    diveState(gk) {
      const s = states.get(gk);
      if (!s || s.diveT <= 0) return null;
      return { side: s.diveSide, k: 1 - s.diveT / DIVE_DUR };
    },

    reset() {
      states = new Map();
    },
  };
}
