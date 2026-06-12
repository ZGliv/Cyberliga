// dribbling.js — dribbling + skill-move brain for CYBERLIGA.
// Pure decision module: no scene/DOM access, THREE used for vector math only.
// The host calls createDribbling().update(carrier, defenders, ball, dt) every
// frame for the current ball carrier and maps the returned action onto its
// own kick/animation systems. See integration notes in the PR/handoff message.

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Tunables (one place, soccer-sense names)
// ---------------------------------------------------------------------------
const TOUCH_MIN = 0.5;        // seconds between carry touches (min)
const TOUCH_MAX = 0.8;        // seconds between carry touches (max)
const ENGAGE_DIST = 2.0;      // a defender inside this is "engaged"
const PRESSURE_DIST = 1.2;    // inside this it's heavy pressure -> shield
const KNOCKON_GRASS = 7.0;    // open meters ahead needed to knock it long
const SCAN_CONE_DIST = 8.0;   // path-awareness cone length
const SCAN_CONE_COS = 0.5;    // cos(60°) — defenders within ±60° count
const SKILL_CD_BASE = 3.0;    // skill cooldown at flair 0
const SKILL_CD_MIN = 1.5;     // skill cooldown at flair 1
const FALL_CHANCE = 0.15;     // fraction of clean beats that floor the victim

const MOVES = ['stepover', 'bodyfeint', 'dragback', 'roulette'];

// ---------------------------------------------------------------------------
// Flair defaults — how likely / how good a player is at skill moves.
// FWDs are showmen, GKs should basically never try a roulette.
// ---------------------------------------------------------------------------
export function getFlair(role) {
  const base = role === 'FWD' ? 0.75 : role === 'MID' ? 0.55 : role === 'DEF' ? 0.3 : 0.1;
  // Small jitter so two strikers don't dribble identically.
  return Math.max(0, Math.min(1, base + (Math.random() - 0.5) * 0.2));
}

export function createDribbling(opts = {}) {
  const rng = opts.rng || Math.random;

  // Per-carrier memory (touch timer, cooldowns). WeakMap so subbed/removed
  // players don't leak.
  const states = new WeakMap();

  // Scratch vectors — reused every frame, no per-frame allocations in the
  // hot path. Action results DO allocate one Vector3 (host keeps it).
  const _toGoal = new THREE.Vector3();
  const _toDef = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  const _exit = new THREE.Vector3();
  const _tmp = new THREE.Vector3();

  function getState(p) {
    let s = states.get(p);
    if (!s) {
      s = {
        touchTimer: TOUCH_MIN + rng() * (TOUCH_MAX - TOUCH_MIN),
        skillCooldown: 0,
        flair: typeof p.flair === 'number' ? p.flair : getFlair(p.role),
      };
      states.set(p, s);
    }
    return s;
  }

  // Count opposing defenders inside an 8m cone around direction `dir` from
  // `pos`. Used to pick the half-space with fewer bodies in it.
  function defendersInCone(pos, dir, defenders) {
    let n = 0;
    for (let i = 0; i < defenders.length; i++) {
      _tmp.subVectors(defenders[i].pos, pos);
      const d = _tmp.length();
      if (d > SCAN_CONE_DIST || d < 0.001) continue;
      _tmp.multiplyScalar(1 / d);
      if (_tmp.dot(dir) > SCAN_CONE_COS) n++;
    }
    return n;
  }

  // Pick a carry direction: toward goal, but bend into whichever half-space
  // (straight / ±35°) has the least traffic. Writes into `out`.
  function pickCarryDir(carrier, defenders, out) {
    const attackDir = -carrier.dir;
    // Aim at goal mouth, not the corner flag: target x = attackDir*32, z -> 0-ish.
    _toGoal.set(attackDir * 32 - carrier.pos.x, 0, -carrier.pos.z * 0.4).normalize();

    let bestAngle = 0;
    let bestScore = Infinity;
    for (let a = -1; a <= 1; a++) {
      const ang = a * 0.6; // ~±35°
      const c = Math.cos(ang), s = Math.sin(ang);
      _tmp.set(_toGoal.x * c - _toGoal.z * s, 0, _toGoal.x * s + _toGoal.z * c);
      // Traffic in that lane, plus a small bias for going straight at goal.
      const score = defendersInCone(carrier.pos, _tmp, defenders) + Math.abs(ang) * 0.4;
      if (score < bestScore) { bestScore = score; bestAngle = ang; }
    }
    const c = Math.cos(bestAngle), s = Math.sin(bestAngle);
    out.set(_toGoal.x * c - _toGoal.z * s, 0, _toGoal.x * s + _toGoal.z * c);
    // Don't dribble out of play: steer back inside near the touchlines.
    if (Math.abs(carrier.pos.z) > 17) out.z -= Math.sign(carrier.pos.z) * 0.6;
    if (Math.abs(carrier.pos.x) > 30) out.x -= Math.sign(carrier.pos.x) * 0.6;
    return out.normalize();
  }

  // Is this defender actually blocking the path to goal? (roughly between
  // carrier and the goal we attack, and close)
  function isEngaged(carrier, def) {
    _toDef.subVectors(def.pos, carrier.pos);
    const dist = _toDef.length();
    if (dist > ENGAGE_DIST || dist < 0.001) return false;
    const attackDir = -carrier.dir;
    _toGoal.set(attackDir * 32 - carrier.pos.x, 0, -carrier.pos.z).normalize();
    _toDef.multiplyScalar(1 / dist);
    return _toDef.dot(_toGoal) > 0.35; // within ~70° of the goal path
  }

  // Defender closing speed toward the carrier (positive = closing fast).
  function closingSpeed(carrier, def) {
    _tmp.subVectors(carrier.pos, def.pos);
    const d = _tmp.length();
    if (d < 0.001) return 0;
    _tmp.multiplyScalar(1 / d);
    return def.vel.dot(_tmp) - carrier.vel.dot(_tmp);
  }

  function rotY(v, ang, out) {
    const c = Math.cos(ang), s = Math.sin(ang);
    return out.set(v.x * c - v.z * s, 0, v.x * s + v.z * c);
  }

  function attemptSkill(carrier, victim, st) {
    pickCarryDir(carrier, [], _exit); // raw goal-ward exit before flavoring

    const close = closingSpeed(carrier, victim);
    const lunging = close > 3.5; // flying in -> roulette food

    // Pick a move that fits the situation.
    let move;
    if (lunging && rng() < 0.5) move = 'roulette';
    else if (close < 1 && rng() < 0.35) move = 'dragback'; // defender set, kill momentum
    else move = rng() < 0.5 ? 'stepover' : 'bodyfeint';

    // Success: flair carries it; a defender closing fast at a bad angle is
    // easier to beat (he can't stop), one jockeying slowly is harder.
    // Roulette specifically punishes the lunge.
    let p = 0.25 + st.flair * 0.5;
    if (lunging) p += move === 'roulette' ? 0.2 : 0.1;
    else p -= 0.1; // patient defender
    p -= Math.max(0, (victim.stamina ?? 1) - (carrier.stamina ?? 1)) * 0.15;
    const beat = rng() < Math.max(0.05, Math.min(0.92, p));

    const duration = move === 'roulette' ? 0.55 : move === 'dragback' ? 0.5 : 0.4;
    const exitDir = new THREE.Vector3();

    if (beat) {
      // Exit flavor per move.
      const side = rng() < 0.5 ? 1 : -1;
      if (move === 'stepover') rotY(_exit, side * 0.7, exitDir);            // fake one way, go the other
      else if (move === 'bodyfeint') rotY(_exit, side * (50 * Math.PI / 180), exitDir); // ±50°
      else if (move === 'dragback') exitDir.copy(_exit).negate();           // 180°, reset the play
      else exitDir.copy(_exit);                                             // roulette: spin, keep going
      // Victim sent the wrong way.
      victim.stagger = 0.6 + rng() * 0.3;
      if (rng() < FALL_CHANCE) victim.fallT = 0.9; // juked out of his boots
    } else {
      // Botched it — ball pops off at a bad angle, roughly into the defender.
      _tmp.subVectors(victim.pos, carrier.pos).normalize();
      exitDir.copy(_tmp).add(rotY(_exit, (rng() - 0.5) * 2, _toDef)).normalize();
    }

    // Cooldown scaled by flair: showmen reload faster, but nobody chains
    // skills every touch.
    st.skillCooldown = SKILL_CD_BASE - st.flair * (SKILL_CD_BASE - SKILL_CD_MIN);
    st.touchTimer = TOUCH_MIN; // next carry touch comes after the move plays out

    // Let the host render the animation.
    carrier.skillAnim = { move, t: 0, dur: duration };

    return { type: 'skill', move, exitDir, beat, victim, duration };
  }

  return {
    update(carrier, defenders, ball, dt) {
      const st = getState(carrier);
      st.skillCooldown = Math.max(0, st.skillCooldown - dt);
      st.touchTimer -= dt;

      // No decisions while staggered/floored — host handles the wobble.
      if ((carrier.stagger || 0) > 0 || (carrier.fallT || 0) > 0) return null;

      const nearest = defenders.length ? defenders[0] : null;
      const nearestDist = nearest ? nearest.pos.distanceTo(carrier.pos) : Infinity;

      // --- 1. Heavy pressure with no exit: put the body in. -------------
      // Shielding is what real players do when a defender is touch-tight and
      // there's no clean lane — slow down, back to goal, keep possession.
      if (nearest && nearestDist < PRESSURE_DIST) {
        if (isEngaged(carrier, nearest) && st.skillCooldown <= 0 && st.flair > 0.35 && rng() < st.flair * 0.4) {
          // High-flair players sometimes skill their way out even here.
          return attemptSkill(carrier, nearest, st);
        }
        // Shield direction: directly away from the defender (ball on far hip).
        const dir = new THREE.Vector3().subVectors(carrier.pos, nearest.pos).setY(0).normalize();
        st.touchTimer = 0.3; // shielding is constant small contact
        return { type: 'shield', dir };
      }

      // Only act on the touch cadence — between touches the ball runs in stride.
      if (st.touchTimer > 0) return null;

      // --- 2. Genuine 1v1 with the cooldown up: try a move. --------------
      if (nearest && isEngaged(carrier, nearest) && st.skillCooldown <= 0) {
        // Only commit if this really is 1v1 — a second defender within 4m
        // means a failed move is a turnover, so keep it simple instead.
        const cover = defenders.length > 1 ? defenders[1].pos.distanceTo(carrier.pos) : Infinity;
        if (cover > 4 && rng() < 0.35 + st.flair * 0.45) {
          return attemptSkill(carrier, nearest, st);
        }
      }

      // Carry direction for everything below.
      const dir = new THREE.Vector3();
      pickCarryDir(carrier, defenders, dir);

      // --- 3. Open grass + flat-footed defender: knock it on and run. ----
      // Worth it when the lane ahead is clear for ~7m and the nearest
      // defender isn't already sprinting at us (he'd win the race to the ball).
      if (defendersInCone(carrier.pos, dir, defenders) === 0) {
        const defFlatFooted = !nearest || closingSpeed(carrier, nearest) < 1.0 || nearestDist > 4;
        const spaceAhead = Math.min(
          KNOCKON_GRASS,
          // distance to byline along the carry dir, crude but cheap
          Math.abs((-carrier.dir * 32 - carrier.pos.x) / (Math.abs(dir.x) + 0.01))
        );
        if (defFlatFooted && spaceAhead >= KNOCKON_GRASS * 0.9 && (carrier.stamina ?? 1) > 0.3) {
          st.touchTimer = TOUCH_MAX + 0.3; // bigger touch, longer until the next one
          return { type: 'knockon', dir, power: 0.6 + st.flair * 0.2 + rng() * 0.15 };
        }
      }

      // --- 4. Default: small carry touch in stride. -----------------------
      st.touchTimer = TOUCH_MIN + rng() * (TOUCH_MAX - TOUCH_MIN);
      return { type: 'touch', dir, power: 0.2 + (carrier.speed || 6) / 30 };
    },
  };
}
