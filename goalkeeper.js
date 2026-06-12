// goalkeeper.js — real goalkeeper AI for the Cyberliga sim.
// Pure decision module: no scene, no DOM. The host owns the ball physics and
// the player steering; this module just says where to stand and when to dive.
//
// Conventions (must match index.html):
//   pitch x ∈ [-32,32], z ∈ [-20,20]; a GK with dir=-1 guards x=-32, dir=+1 guards x=+32
//   goal mouth z ∈ [-4.5,4.5], height 3.2; penalty box |x| ∈ [20,32], z ∈ [-9,9]
//   gravity 22, ball rest y 0.24 (host groundY)
//
// `side` in dive results / diveState is keeper-relative: +1 = the keeper's right
// hand side when facing the pitch (i.e. world +z for the dir=-1 keeper, world -z
// for the dir=+1 keeper). poseDive(side, k) consumes it directly. diveState also
// exposes targetY — the predicted glove-contact height — for rigs whose poseDive
// accepts an optional impact-height third argument (humanrig does).
//
// Save model: the OUTCOME is rolled once at dive commit (so the dive looks
// anticipatory) but the {type:'dive', save} action carrying the ball mutation
// is only returned when the ball actually reaches the gloves. p(save) scales
// with the four things that matter:
//   DISTANCE  — long shots are read early and almost always dealt with
//   PLACEMENT — straight at him = caught; corners = parried or beaten
//   PACE      — pace only hurts at the edges of his reach
//   SET-NESS  — a scrambling/recovering keeper saves far less
// The keeper meets the ball on HIS OWN x-plane (not the goal line), so
// stepping out to narrow the angle genuinely shrinks the gap he must cover.

import * as THREE from 'three';

const HALF_W = 32, HALF_H = 20;
const GOAL_HALF = 4.5, GOAL_HEIGHT = 3.2;
const GRAVITY = 22;

const SHOT_SPEED = 9;          // m/s — slower balls are "loose", not shots
const SHOT_RANGE = 31;         // track shots from anywhere in range (30m screamers included)
const SHOT_GRACE = 0.3;        // s a flickering shot read stays latched
const DIVE_REACH = 2.8;        // full-stretch fingertip reach
const DIVE_DUR = 0.8;          // host pose window
const GETUP_T = 0.45;          // host get-up window (fallT <= 0.45 plays poseGetUp)
const GETUP_FAST = 0.26;       // shortened get-up when the ball is still live in the box
const HOLD_DUR = 0.85;         // quick distribution — keepers who dawdle look bad
const CATCH_DIST = 1.15;       // within this of the body → catch attempt
const CATCH_MAX_SPEED = 18.5;  // too hot to hold above this
const CATCH_MAX_Y = 2.2;       // above this it's a punch/parry, not a clutch
const SIX_YARD_X = 5.5;        // depth of the "come and claim" zone off the line
const SIX_YARD_Z = 7.5;
const BOX_X = 14, BOX_Z = 10.5;     // rebound-alert zone (a shade beyond the box)
const REBOUND_WINDOW = 1.8;    // s after a parry the keeper hunts the loose ball

export function createGoalkeeper(opts = {}) {
  const rng = opts.rng || Math.random;
  const BALL_R = opts.ballR ?? opts.groundY ?? 0.24; // host ball rest height

  const _roll = new THREE.Vector3();

  // Per-keeper state, keyed on the gk object so one instance can run both keepers.
  let states = new Map();
  function S(gk) {
    let s = states.get(gk);
    if (!s) {
      s = {
        diveT: 0,            // remaining dive-window time (counts down from DIVE_DUR)
        diveSide: 1,
        divePower: 0.5,
        diveTargetY: 1.0,    // predicted glove-contact height (drives low/high dive poses)
        holdT: 0,            // remaining hold time after a catch
        reactT: -1,          // reaction countdown after a shot is first seen (<0 = idle)
        shotLive: false,     // a qualifying shot is currently in flight
        shotGrace: 0,        // latch: a flickering prediction doesn't drop the read
        lastCrossZ: 0,
        diveDone: false,     // already committed to this shot — never dive twice at one ball
        // shot quality, frozen at first sight of the shot
        shotDist0: 18,
        shotSet0: 1,
        // deferred save contact
        sinceCommit: 0,
        crossT: 0,
        contactDone: true,
        pendingSave: null,   // rolled at commit, applied at glove contact
        caught: false,
        // dive root motion
        diveFromZ: 0,
        diveToZ: 0,
        diveFast: false,     // parry landed: scrub the dive tail faster (smooth, no k-jump)
        // readiness / recovery
        setness: 1,          // 1 = planted and balanced, 0 = scrambling
        recoverT: 0,         // just-got-up penalty window
        reboundT: 0,         // post-parry loose-ball alert
        distributedT: 0,     // just rolled it out — don't chase your own pass
      };
      states.set(gk, s);
    }
    return s;
  }

  // Predict where/when the ball crosses the plane x = planeX.
  // Ballistic y (gravity only, spin ignored); straight-line xz. Returns null if
  // the ball isn't actually heading at that plane.
  function predictCrossing(ball, planeX) {
    const vx = ball.vel.x;
    const dx = planeX - ball.pos.x;
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

  // Which z-side of the box is emptier? Parries steer toward it so rebounds
  // don't land on an attacker's boot. Returns ±1.
  function safeParrySide(gk, players, preferred) {
    const lineX = gk.dir * HALF_W;
    let near = [Infinity, Infinity]; // [z<0 side, z>0 side]
    for (const p of players || []) {
      if (!p || p === gk || p.team === gk.team) continue;
      if (Math.abs(p.pos.x - lineX) > 17) continue;
      const i = p.pos.z < 0 ? 0 : 1;
      const d = Math.hypot(p.pos.x - (lineX - gk.dir * 5), p.pos.z);
      if (d < near[i]) near[i] = d;
    }
    // strong preference wins unless that side is crowded and the other is clear
    const pi = preferred < 0 ? 0 : 1, oi = 1 - pi;
    if (near[pi] < 4.5 && near[oi] > near[pi] + 3) return preferred * -1;
    return preferred;
  }

  // Build the parry deflection: away from the goal mouth, away from bodies,
  // never back across the six-yard box.
  function makeDeflect(gk, kc, edge, players) {
    let zSide = Math.sign(kc.z - gk.pos.z) || Math.sign(kc.z) || (rng() < 0.5 ? -1 : 1);
    if (Math.abs(kc.z) < 1.6) zSide = safeParrySide(gk, players, zSide);
    if (kc.y > 2.25) {
      // high ball: strong wrists TIP IT OVER the bar (crosses the line well above 3.2)
      return new THREE.Vector3(gk.dir * 0.18, 1.05, zSide * 0.45).normalize();
    }
    if (edge > 0.75) {
      // full-stretch fingertips: push it WIDE of the post toward the byline
      return new THREE.Vector3(-gk.dir * 0.22, 0.07, zSide * 1.3).normalize();
    }
    // standard strong parry: low, wide, and out toward the corner flag
    return new THREE.Vector3(
      -gk.dir * (0.42 + 0.25 * rng()),
      0.10,
      zSide * (1.0 + 0.45 * rng())
    ).normalize();
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

      // set-ness: planted and balanced vs scrambling. Feeds the save model.
      const gkSpd = gk.vel ? Math.hypot(gk.vel.x, gk.vel.z) : 0;
      const setTgt = (gkSpd < 1.5 && !(gk.fallT > 0)) ? 1 : 0;
      s.setness += (setTgt - s.setness) * (1 - Math.exp(-5 * dt));
      if (s.recoverT > 0) s.recoverT = Math.max(0, s.recoverT - dt);
      if (s.reboundT > 0) s.reboundT = Math.max(0, s.reboundT - dt);
      if (s.distributedT > 0) s.distributedT = Math.max(0, s.distributedT - dt);

      // ---- dive in progress ----
      if (s.diveT > 0) {
        // after a parry the tail of the dive plays at 2.2x — the keeper is
        // already moving to get back up while the rebound is live
        s.diveT = Math.max(0, s.diveT - dt * (s.diveFast ? 2.2 : 1));
        s.sinceCommit += dt;
        const k = 1 - s.diveT / DIVE_DUR;
        // root motion: the keeper travels along the line into the dive instead of
        // flopping on the spot — the save then happens where the ball actually is.
        // Host freezes vel/target while isDiving(), so this write is authoritative.
        const travel = Math.sin(Math.min(k / 0.6, 1) * Math.PI * 0.5);
        gk.pos.z = s.diveFromZ + (s.diveToZ - s.diveFromZ) * travel;

        // deferred contact: outcome was rolled at commit; the ball is only
        // touched when it reaches the gloves (or the predicted crossing moment)
        if (!s.contactDone) {
          const dx = ball.pos.x - gk.pos.x;
          const dy = ball.pos.y - 1.0;
          const dz = ball.pos.z - gk.pos.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          const reach = 0.7 + 0.8 * Math.min(k / 0.5, 1); // gloves extend with the stretch
          const due = s.sinceCommit >= s.crossT - 0.06;
          if (d2 < reach * reach || due || s.diveT === 0) {
            s.contactDone = true;
            let save = s.pendingSave;
            s.pendingSave = null;
            // prediction missed (deflected/blocked en route) — never ghost-touch
            if (save && d2 > 2.6 * 2.6) save = null;
            if (save) {
              if (save.mode === 'catch') s.caught = true;
              else {
                // parry: the ball is LIVE — recover fast and hunt the rebound
                s.reboundT = REBOUND_WINDOW;
                s.diveFast = true;
              }
              if (s.diveT === 0) { // contact on the very last dive frame
                if (s.caught) { s.holdT = HOLD_DUR; s.caught = false; }
                else if (!(gk.fallT > 0)) { gk.fallT = GETUP_FAST; s.recoverT = 0.8; }
              }
              return { type: 'dive', side: s.diveSide, power: s.divePower, save };
            }
          }
        }
        if (s.diveT === 0) {
          // dive over: caught → straight into the hold; otherwise get up off the turf —
          // SHORT get-up if the ball is still live in our box (rebound danger)
          if (s.caught) { s.caught = false; s.holdT = HOLD_DUR; return { type: 'hold' }; }
          if (!(gk.fallT > 0)) {
            const ballLiveNear = !ball.pinned
              && Math.abs(ball.pos.x - lineX) < BOX_X && Math.abs(ball.pos.z) < BOX_Z
              && ballSpeed < 12;
            gk.fallT = ballLiveNear ? GETUP_FAST : GETUP_T;
            s.recoverT = 0.8;
          }
          return { type: 'position', target: gk.pos.clone() };
        }
        if (s.caught) return { type: 'hold' }; // keep the ball pinned to the gloves mid-dive
        return { type: 'position', target: gk.pos.clone() };
      }

      if (s.holdT > 0) {
        s.holdT = Math.max(0, s.holdT - dt);
        if (s.holdT > 0) return { type: 'hold' };
        // distribution: quick bowl-out to the SAFEST outlet — judged by the space
        // around him, how wide he is (touchline = safety), and a defender's feet
        // being preferred over a striker's. Never dumped into traffic.
        let mate = null, best = -Infinity;
        for (const p of players || []) {
          if (!p || p === gk || p.team !== gk.team || p.role === 'GK' || p.fallT > 0) continue;
          const mx = p.pos.x - gk.pos.x, mz = p.pos.z - gk.pos.z;
          if (mx * -gk.dir < 2) continue; // upfield only
          const d = Math.hypot(mx, mz);
          if (d < 4.5 || d > 26) continue;
          let space = 99;
          for (const q of players) {
            if (!q || q.team === gk.team) continue;
            const qd = Math.hypot(q.pos.x - p.pos.x, q.pos.z - p.pos.z);
            if (qd < space) space = qd;
          }
          const score = Math.min(space, 12)
            + Math.abs(p.pos.z) * 0.35
            + (p.role === 'DEF' ? 4 : 0) // host roles are GK/DEF/MID/FWD
            - d * 0.08;
          if (score > best) { best = score; mate = p; }
        }
        if (mate) {
          // lead the receiver slightly so the roll meets his feet on the move
          _roll.set(
            mate.pos.x + (mate.vel ? mate.vel.x * 0.4 : 0) - gk.pos.x, 0,
            mate.pos.z + (mate.vel ? mate.vel.z * 0.4 : 0) - gk.pos.z).normalize();
        } else {
          _roll.set(-gk.dir, 0, (rng() - 0.5) * 0.8).normalize();
        }
        ball.vel.set(_roll.x, 0, _roll.z).multiplyScalar(5 + 2 * rng());
        ball.vel.y = -0.5;
        ball.spin.set(0, 0, 0);
        ball.knuckle = 0;
        s.distributedT = 1.0; // it's gone — resume positioning, don't chase it
      }

      // ---- shot detection & dive decision ----
      const cross = predictCrossing(ball, lineX);
      // margins widen while a shot read is live — a curling/knuckling ball near the
      // post must not square-wave the keeper between 'reacting' and 'standing'
      const onTarget = cross
        && Math.abs(cross.z) < GOAL_HALF + (s.shotLive ? 1.0 : 0.4)
        && cross.y < GOAL_HEIGHT + (s.shotLive ? 0.8 : 0.3);
      const isShot = incoming && ballSpeed > SHOT_SPEED && distBallToGoal < SHOT_RANGE && onTarget;

      if (isShot && !s.diveDone) {
        if (!s.shotLive) {
          s.shotLive = true;
          s.reactT = 0.15 + 0.10 * rng(); // human reaction delay — rolled ONCE per shot
          s.shotDist0 = distBallToGoal;   // shot quality is judged from where it was struck
          s.shotSet0 = s.setness;
        }
        s.shotGrace = SHOT_GRACE;
        s.lastCrossZ = cross.z;
        s.reactT -= dt;
        // Commit once reacted AND arrival is inside the dive window. Point-blank
        // balls that would arrive BEFORE the reaction completes get a reflex
        // dive — compromised, but never a statue.
        const reflex = s.reactT > 0 && cross.t < 0.24;
        if ((s.reactT <= 0 && cross.t < 0.55) || reflex) {
          s.diveDone = true;
          s.diveT = DIVE_DUR;
          s.sinceCommit = 0;
          s.contactDone = false;
          s.caught = false;
          s.diveFast = false;

          // meet it on MY plane — being off the line narrows what I must cover
          let kc = predictCrossing(ball, gk.pos.x);
          if (!kc || kc.t > cross.t) kc = cross;
          s.crossT = kc.t;
          s.diveTargetY = kc.y;

          const dz = kc.z - gk.pos.z;
          const dy = Math.max(0, kc.y - 0.9); // reach measured from chest height
          const gap = Math.hypot(dz, dy);

          // coverable distance: body fill + a quick step + the full stretch,
          // squeezed by the time actually available and by readiness
          const setF = THREE.MathUtils.clamp(s.shotSet0, 0, 1);
          let reach = (1.25 + 2.15 * THREE.MathUtils.clamp(kc.t / 0.5, 0.52, 1.12))
            * (0.72 + 0.28 * setF)
            // long-rangers are read off the boot — the early step is banked
            + THREE.MathUtils.clamp((s.shotDist0 - 18) / 10, 0, 1) * 0.70;
          if (reflex) reach *= 0.85;
          if (s.recoverT > 0) reach *= 0.85;

          s.diveSide = (dz >= 0 ? 1 : -1) * -gk.dir; // keeper-relative
          s.divePower = THREE.MathUtils.clamp(gap / DIVE_REACH, 0.15, 1);
          // root covers most of the gap; the pose stretch covers the rest
          s.diveFromZ = gk.pos.z;
          s.diveToZ = THREE.MathUtils.clamp(
            gk.pos.z + THREE.MathUtils.clamp(dz * 0.8, -reach, reach),
            -GOAL_HALF - 0.8, GOAL_HALF + 0.8);

          // ---- the save roll: distance × placement × pace × set-ness ----
          let save = null;
          const pace = THREE.MathUtils.clamp((ballSpeed - 13) / 12, 0, 1);
          const range = THREE.MathUtils.clamp((26 - s.shotDist0) / 18, 0.08, 1);
          const edge = THREE.MathUtils.clamp((gap / reach - 0.30) / 0.70, 0, 1);
          if (gap <= reach) {
            let pBeaten = Math.pow(edge, 1.25) * (0.26 + 0.46 * pace) * range;
            if (reflex) pBeaten = Math.min(1, pBeaten * 1.4 + 0.06);
            else if (s.recoverT > 0) pBeaten = Math.min(1, pBeaten + 0.15);
            if (rng() >= pBeaten) {
              if (gap < CATCH_DIST && ballSpeed < CATCH_MAX_SPEED && kc.y < CATCH_MAX_Y) {
                save = { mode: 'catch', deflect: null }; // straight at him: clutched
              } else {
                save = { mode: 'parry', deflect: makeDeflect(gk, kc, edge, players) };
              }
            }
            // else: got a glove pose to it but BEATEN — save stays null
          } else if (gap < reach * 1.2 && rng() < 0.45 * (1 - 0.5 * pace) * (0.4 + 0.6 * setF)) {
            // beyond honest reach: the occasional SPECTACULAR fingertip push wide
            save = { mode: 'parry', deflect: makeDeflect(gk, kc, 1, players) };
          }
          s.pendingSave = save; // applied later, at glove contact
          return { type: 'dive', side: s.diveSide, power: s.divePower, save: null };
        }
        // reacting: hold current depth (never backpedal mid-shot) and shuffle
        // toward the predicted crossing point
        const setX = lineX - gk.dir * Math.max(0.5, Math.abs(gk.pos.x - lineX) * 0.85);
        const setZ = THREE.MathUtils.clamp(cross.z * 0.85, -GOAL_HALF + 0.4, GOAL_HALF - 0.4);
        return { type: 'position', target: new THREE.Vector3(setX, 0, setZ) };
      }

      if (!isShot) {
        s.shotGrace -= dt;
        if (s.shotLive && s.shotGrace > 0 && !s.diveDone
            && incoming && ballSpeed > SHOT_SPEED * 0.8) {
          // momentary prediction flicker: hold the shot read and the set position —
          // do NOT re-roll the reaction delay or square-wave back to the bisector
          s.reactT -= dt;
          const setX = lineX - gk.dir * Math.max(0.5, Math.abs(gk.pos.x - lineX) * 0.85);
          const setZ = THREE.MathUtils.clamp(s.lastCrossZ * 0.85, -GOAL_HALF + 0.4, GOAL_HALF - 0.4);
          return { type: 'position', target: new THREE.Vector3(setX, 0, setZ) };
        }
        // shot lapsed (saved, scored, blocked, or went wide) → rearm for the next one
        s.shotLive = false;
        s.reactT = -1;
        if (!incoming || ballSpeed < SHOT_SPEED * 0.7) s.diveDone = false;
      }

      // ---- rebound control: after a parry, ATTACK the loose ball in the box ----
      // No ball-watching from the turf — the get-up was shortened above, and the
      // moment he's on his feet the loose ball is his if it's slow enough.
      if (s.reboundT > 0 && s.distributedT <= 0
          && Math.abs(ball.pos.x - lineX) < BOX_X && Math.abs(ball.pos.z) < BOX_Z
          && ballSpeed < 10 && ball.pos.y < 1.6) {
        const lead = ball.pos.clone().addScaledVector(ball.vel, 0.25);
        lead.x = THREE.MathUtils.clamp(lead.x, -HALF_W + 0.5, HALF_W - 0.5);
        lead.z = THREE.MathUtils.clamp(lead.z, -HALF_H + 0.5, HALF_H - 0.5);
        return { type: 'position', target: lead };
      }

      // ---- claim loose balls in the six-yard area ----
      const inSixYard = Math.abs(ball.pos.x - lineX) < SIX_YARD_X && Math.abs(ball.pos.z) < SIX_YARD_Z;
      if (inSixYard && ballSpeed < 8 && ball.pos.y < 1.4 && s.distributedT <= 0) {
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

      // ---- default: bisector positioning with real depth control ----
      // Far ball → stay home near the line and meet long shots from a set base.
      // Close threat → step out and NARROW the angle aggressively (the save
      // model rewards it: the gap is measured on the keeper's own plane).
      // Wide ball → hug the near-post line, shallower.
      const centrality = 1 - THREE.MathUtils.clamp(Math.abs(ball.pos.z) / 16, 0, 0.6);
      let depth;
      if (distBallToGoal < 13) {
        depth = 0.5 + centrality * THREE.MathUtils.lerp(
          3.2, 1.2, THREE.MathUtils.clamp((distBallToGoal - 5) / 8, 0, 1));
      } else {
        depth = THREE.MathUtils.lerp(
          1.8, 0.8, THREE.MathUtils.clamp((distBallToGoal - 13) / 13, 0, 1));
      }
      if (incoming && ballSpeed > SHOT_SPEED * 0.8 && distBallToGoal < 18) depth = 0.6; // shot imminent: set
      return { type: 'position', target: bisectorTarget(gk, ball, depth) };
    },

    isDiving(gk) {
      const s = states.get(gk);
      return !!s && s.diveT > 0;
    },

    diveState(gk) {
      const s = states.get(gk);
      if (!s || s.diveT <= 0) return null;
      // targetY: predicted glove-contact height — poseDive's optional 3rd arg
      return { side: s.diveSide, k: 1 - s.diveT / DIVE_DUR, targetY: s.diveTargetY };
    },

    reset() {
      states = new Map();
    },
  };
}
