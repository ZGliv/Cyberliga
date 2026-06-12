// ============================================================================
// tactics.js — a real soccer brain for CYBERLIGA
// ----------------------------------------------------------------------------
// This module is a TEAM model, not a player model. Real soccer is mostly
// played off the ball: at any moment 13 of 14 players are choosing WHERE TO
// STAND, and the one with the ball is choosing between pass / carry / shoot /
// clear. Both choices depend on the PHASE of play:
//
//   IN POSSESSION (your team touched it last):
//     BUILD-UP      (own third)    — security first. Short passes, keep the
//                                    ball, stretch the pitch with width.
//     PROGRESSION   (middle third) — look forward first; if the center is
//                                    congested, switch the ball to the far
//                                    flank where there's space.
//     FINAL THIRD   (their third)  — penetration: through balls behind the
//                                    defensive line, crosses from wide,
//                                    shots when the angle is good.
//
//   OUT OF POSSESSION:
//     One player presses the carrier (curving the run to cut off the forward
//     lane — you don't sprint straight at a good player, you show them
//     sideways). One covers the most dangerous passing lane. Everyone else
//     forms a compact block that shifts with the ball, and the defenders hold
//     a LINE — the offside line — stepping up when the ball goes backward.
//
//   TRANSITION (the 2 seconds after the ball changes hands):
//     The winning team breaks forward at full sprint before the loser can
//     reorganize (the counter). The losing team's nearest players swarm the
//     ball immediately (counter-press), then everyone collapses into shape.
//
// Coordinates: pitch x ∈ [-32,32] (length), z ∈ [-20,20] (width).
// A team with dir = -1 defends x=-32 and attacks toward +x; dir = +1 the
// opposite. Goal mouth is z ∈ [-4.5, 4.5].
// ============================================================================

import * as THREE from 'three';

// ---- pitch geometry -------------------------------------------------------
const HALF_W = 32, HALF_H = 20;
const GOAL_HALF = 4.5;
const THIRD = HALF_W * 2 / 3; // ~21.3m: own third ends at -THIRD/+THIRD in attack space

// ---- module-level scratch (no per-frame allocations in hot paths) ----------
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _lane = new THREE.Vector3();

// Persistent target vectors per player so the intents Map never allocates.
const _targets = new WeakMap();
function targetOf(p) {
  let t = _targets.get(p);
  if (!t) { t = new THREE.Vector3(); _targets.set(p, t); }
  return t;
}

export function createTactics(opts = {}) {
  const rng = opts.rng || Math.random;

  // --- internal memory (what makes decisions sticky instead of twitchy) ----
  let prevPossession = null;     // team object of last known possession
  let transitionT = 0;           // counts down from 2s after a turnover
  let transitionWinner = null;   // team that just won the ball
  let planClock = 0;             // time since the carrier last re-planned
  let planInterval = 0.4;        // randomized 0.3–0.5s per decision
  let currentPlan = null;        // committed plan (returned until re-plan)
  let currentCarrier = null;     // who the plan belongs to
  const intents = new Map();     // reused every frame

  // =========================================================================
  // helpers
  // =========================================================================

  // Attack x for a team-dir: dir=-1 attacks +x. "Progress" for that team is
  // movement toward attackX. We normalize everything into "attack space":
  // ax(p) maps a position so bigger = closer to the goal you're attacking.
  const attackX = (dir) => -dir * HALF_W;
  const ax = (x, dir) => -dir * x; // -32 (own goal line) .. +32 (their goal line)

  function phaseOf(x, dir) {
    const a = ax(x, dir);
    if (a < -HALF_W + THIRD) return 'buildup';      // own third
    if (a > HALF_W - THIRD) return 'final';         // attacking third
    return 'progression';                            // middle third
  }

  function nearestOpponentDist(players, team, pos) {
    let bd = 1e9;
    for (const q of players) {
      if (q.team === team || q.role === 'GK') continue;
      const d = q.pos.distanceTo(pos);
      if (d < bd) bd = d;
    }
    return bd;
  }

  // The "defensive line" of a team = x of its second-deepest outfielder
  // (deepest is usually a covering defender; second-deepest is the offside
  // line a striker must not stray beyond before the pass is played).
  function defensiveLineX(players, defTeam, defDir) {
    let deepest = -1e9, second = -1e9; // measured in THEIR defensive depth (bigger = deeper)
    for (const q of players) {
      if (q.team !== defTeam || q.role === 'GK') continue;
      const depth = q.pos.x * defDir; // defDir points at own goal: bigger = nearer own goal
      if (depth > deepest) { second = deepest; deepest = depth; }
      else if (depth > second) second = depth;
    }
    return second * defDir; // back to world x
  }

  // Lane safety: sample the pass segment and check no opponent sits within
  // 1.2m of it (a defender on the lane intercepts; a defender NEAR it
  // pressures the receiver, which receiver-space already penalizes).
  function laneIsSafe(players, team, from, to) {
    _lane.subVectors(to, from);
    const len = _lane.length();
    if (len < 0.01) return true;
    const steps = Math.min(8, Math.max(2, Math.floor(len / 3)));
    for (let i = 1; i < steps; i++) {
      _a.copy(from).addScaledVector(_lane, i / steps);
      for (const q of players) {
        if (q.team === team) continue;
        // GK only blocks lanes near his goal; include him anyway, it's cheap
        const dx = q.pos.x - _a.x, dz = q.pos.z - _a.z;
        if (dx * dx + dz * dz < 1.2 * 1.2) return false;
      }
    }
    return true;
  }

  // Expected-goal proxy: shots are good when CLOSE and CENTRAL, and when the
  // keeper isn't set. Returns 0..~1.
  function shotValue(players, carrier) {
    const dir = carrier.dir;
    const gx = attackX(dir);
    const dx = gx - carrier.pos.x;
    const dz = carrier.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 24) return 0;
    // Angle subtended by the goal mouth — the real driver of xG.
    const a1 = Math.atan2(dz - GOAL_HALF, Math.abs(dx));
    const a2 = Math.atan2(dz + GOAL_HALF, Math.abs(dx));
    const openAngle = Math.abs(a1 - a2); // radians; ~0.5+ is a great look
    let v = Math.min(1, openAngle / 0.55) * Math.max(0, 1 - dist / 26);
    // keeper off his line sweetens the chip/shot
    const keeper = keeperOf(players, carrier.team, true);
    if (keeper) {
      const offLine = Math.abs(keeper.pos.x - keeper.dir * HALF_W);
      if (offLine > 3) v += 0.18;
    }
    // pressure makes shooting worse (blocked shots)
    const press = nearestOpponentDist(players, carrier.team, carrier.pos);
    if (press < 1.6) v *= 0.55;
    return v;
  }

  function keeperOf(players, team, opponentKeeper) {
    for (const q of players) {
      if (q.role !== 'GK') continue;
      if (opponentKeeper ? q.team !== team : q.team === team) return q;
    }
    return null;
  }

  // =========================================================================
  // THE PASS MODEL — the heart of the engine.
  // A pass is scored on three things plus a risk discount:
  //   1. progression — how much closer to goal the ball gets,
  //   2. receiver space — distance to receiver's nearest opponent,
  //   3. lane safety — is the path actually open,
  //   risk — losing the ball in your own third concedes goals, so safety
  //          matters most there and least near their goal.
  // =========================================================================
  function evaluatePasses(players, carrier, phase, out) {
    const dir = carrier.dir;
    out.best = null; out.bestScore = -1e9;
    const riskWeight = phase === 'buildup' ? 2.4 : phase === 'progression' ? 1.2 : 0.5;

    for (const mate of players) {
      if (mate.team !== carrier.team || mate === carrier || mate.role === 'GK') continue;

      // lead the runner: where will they be when the ball arrives?
      const dist = mate.pos.distanceTo(carrier.pos);
      if (dist < 2.5 || dist > 34) continue;
      const flight = dist / 14; // rough pass-speed seconds
      _b.copy(mate.pos).addScaledVector(mate.vel, flight);
      _b.x = THREE.MathUtils.clamp(_b.x, -HALF_W + 1, HALF_W - 1);
      _b.z = THREE.MathUtils.clamp(_b.z, -HALF_H + 1, HALF_H - 1);

      const progression = (ax(_b.x, dir) - ax(carrier.pos.x, dir)) * 0.5; // m gained toward goal
      const space = Math.min(nearestOpponentDist(players, carrier.team, _b), 10) * 0.7;
      const safe = laneIsSafe(players, carrier.team, carrier.pos, _b);

      // Risk: backward passes are nearly free; forward passes through traffic
      // are expensive in your own third, cheap near their goal.
      let risk = 0;
      if (!safe) risk += 6;
      if (dist > 22) risk += 2;                       // long balls go astray
      if (progression > 0) risk += progression * 0.18; // ambition has a price
      // Patience bias: in build-up, short safe passes beat hero balls.
      let score = progression + space - risk * riskWeight;
      if (phase === 'buildup' && dist < 12 && safe) score += 3;
      // In the final third, reward balls into the box / behind the line.
      const line = defensiveLineX(players, opTeam(players, carrier.team), -dir);
      const behindLine = ax(_b.x, dir) > ax(line, dir);
      if (phase !== 'buildup' && behindLine && safe && mate.role === 'FWD') score += 5;

      if (score > out.bestScore) {
        out.bestScore = score; out.best = mate;
        out.aim.copy(_b);
        out.through = behindLine && phase !== 'buildup';
        out.dist = dist;
      }
    }
    return out;
  }
  function opTeam(players, team) {
    for (const q of players) if (q.team !== team) return q.team;
    return null;
  }
  const _passOut = { best: null, bestScore: -1e9, aim: new THREE.Vector3(), through: false, dist: 0 };

  // Carry check: is there open grass ahead? We test a 25° cone, 6m+ deep,
  // toward goal. Dribbling beats passing when nobody is home in front of you.
  function carryRoom(players, carrier) {
    const dir = carrier.dir;
    _c.set(-dir, 0, THREE.MathUtils.clamp(-carrier.pos.z * 0.04, -0.5, 0.5)).normalize(); // toward goal, drifting central
    for (const q of players) {
      if (q.team === carrier.team || q.role === 'GK') continue;
      _d.subVectors(q.pos, carrier.pos);
      const dAlong = _d.dot(_c);
      if (dAlong < 0 || dAlong > 8) continue;
      const lateral = Math.sqrt(Math.max(0, _d.lengthSq() - dAlong * dAlong));
      if (lateral < dAlong * Math.tan(25 * Math.PI / 180) + 0.8) return null; // someone in the cone
    }
    return _c; // open grass
  }

  // =========================================================================
  // CARRIER PLAN
  // =========================================================================
  function makePlan(players, carrier) {
    const dir = carrier.dir;
    const phase = phaseOf(carrier.pos.x, dir);
    const gx = attackX(dir);
    const press = nearestOpponentDist(players, carrier.team, carrier.pos);
    const passes = evaluatePasses(players, carrier, phase, _passOut);

    // Panic clearance: deep in our own third, under heavy pressure, no safe
    // pass — just put it in row Z. Defending 101.
    if (phase === 'buildup' && press < 2.2 && (!passes.best || passes.bestScore < 0)) {
      return {
        type: 'clear',
        aimPoint: new THREE.Vector3(gx * 0.4, 0, (rng() - 0.5) * 30),
        technique: 'clearance', power: 0.85 + rng() * 0.15, curve: 0,
        holdMs: 0,
      };
    }

    // Shot vs pass in the final third: shoot when the look beats the ball.
    const sv = shotValue(players, carrier);
    if (phase === 'final' && sv > 0.22 && sv * 14 > passes.bestScore) {
      const dist = Math.hypot(gx - carrier.pos.x, carrier.pos.z);
      const keeper = keeperOf(players, carrier.team, true);
      const offLine = keeper ? Math.abs(keeper.pos.x - keeper.dir * HALF_W) : 0;
      let technique = 'driven', power = 0.72 + rng() * 0.18, curve = 0;
      if (offLine > 3.2 && dist < 15) { technique = 'chip'; power = 0.42 + rng() * 0.15; }
      else if (dist > 14 && dist < 23 && Math.abs(carrier.pos.z) > 3) {
        technique = 'curler'; power = 0.82 + rng() * 0.12;
        curve = Math.sign(carrier.pos.z) * -dir; // bend it back toward the far post
      } else if (dist > 18 && carrier.flair > 0.6 && rng() < 0.3) {
        technique = 'screamer'; power = 1;
      }
      // aim inside a post, biased away from the keeper
      let aimZ = (rng() < 0.5 ? -1 : 1) * (GOAL_HALF - 1.1);
      if (keeper) aimZ = keeper.pos.z > 0 ? -(GOAL_HALF - 1.1) : (GOAL_HALF - 1.1);
      return {
        type: 'shoot',
        aimPoint: new THREE.Vector3(gx, 0, aimZ),
        technique, power, curve,
        holdMs: press < 2 ? 0 : 120, // no time to set yourself under pressure
      };
    }

    // Carry when there's open grass AND it progresses better than passing,
    // unless we're being pressed (then move the ball, not the feet).
    const room = press > 2.4 ? carryRoom(players, carrier) : null;
    const carryGain = room ? 5 + carrier.flair * 3 : -1e9;
    if (room && carryGain > passes.bestScore && phase !== 'buildup') {
      return {
        type: 'carry',
        carryDir: room.clone(),
        aimPoint: new THREE.Vector3().copy(carrier.pos).addScaledVector(room, 5),
        technique: 'pass', power: 0.3, curve: 0,
        holdMs: 0,
      };
    }

    // Pass — the default. Choose technique by distance/shape of the ball.
    if (passes.best) {
      const mate = passes.best;
      const aim = passes.aim.clone();
      let technique = 'pass', power = THREE.MathUtils.clamp(passes.dist / 22, 0.3, 0.85), curve = 0;
      if (passes.through) {
        // through ball: aim 3–6m into the space AHEAD of the runner
        aim.x += -dir * (3 + rng() * 3);
        aim.z = THREE.MathUtils.lerp(aim.z, aim.z * 0.8, 0.5); // angle slightly inward
        technique = 'driven'; power = THREE.MathUtils.clamp(aim.distanceTo(carrier.pos) / 20, 0.5, 0.95);
      } else if (phase === 'final' && Math.abs(carrier.pos.z) > 11) {
        technique = 'cross'; power = 0.62 + rng() * 0.2;
        curve = Math.sign(carrier.pos.z) * -dir;
        aim.set(gx - (-dir) * 6, 0, (rng() - 0.5) * 6); // into the box, ahead of the goal
      } else if (passes.dist > 18) {
        technique = passes.dist > 26 ? 'lob' : 'driven'; // switch of play floats over the block
      }
      return {
        type: 'pass', mate, aimPoint: aim, technique, power, curve,
        holdMs: press < 2 ? 60 : 180 + rng() * 200, // scan time when unpressured = patience
      };
    }

    // Nothing on: shield-carry toward space (host's dribble brain handles touches).
    const fallback = carryRoom(players, carrier);
    return {
      type: 'carry',
      carryDir: fallback ? fallback.clone() : new THREE.Vector3(0, 0, carrier.pos.z >= 0 ? -1 : 1),
      aimPoint: carrier.pos.clone(),
      technique: 'pass', power: 0.3, curve: 0, holdMs: 0,
    };
  }

  // =========================================================================
  // OFF-BALL MOVEMENT
  // =========================================================================
  function setIntent(p, x, z, urgency) {
    const t = targetOf(p);
    t.set(
      THREE.MathUtils.clamp(x, -HALF_W + 0.6, HALF_W - 0.6), 0,
      THREE.MathUtils.clamp(z, -HALF_H + 0.6, HALF_H - 0.6));
    intents.set(p, { target: t, urgency });
  }

  function attackingIntents(players, ball, team, carrier, phase) {
    const dir = carrier ? carrier.dir : null;
    const oppTeam = opTeam(players, team);
    const anchor = carrier ? carrier.pos : ball.pos;
    // offside line we must respect until the ball is played
    const line = dir != null ? defensiveLineX(players, oppTeam, -dir) : 0;

    // rank teammates by distance to the carrier for triangle support
    let near1 = null, near2 = null, d1 = 1e9, d2 = 1e9;
    let farFlank = null, fw = -1;
    for (const p of players) {
      if (p.team !== team || p.role === 'GK' || p === carrier) continue;
      const d = p.pos.distanceTo(anchor);
      if (d < d1) { d2 = d1; near2 = near1; d1 = d; near1 = p; }
      else if (d < d2) { d2 = d; near2 = p; }
      const w = Math.abs(p.pos.z - anchor.z);
      if (Math.sign(p.pos.z || 1) !== Math.sign(anchor.z || 1) && w > fw) { fw = w; farFlank = p; }
    }

    for (const p of players) {
      if (p.team !== team || p.role === 'GK' || p === carrier) continue;
      const adir = p.dir; // same as carrier's
      const gx = attackX(adir);

      if (p === near1 || p === near2) {
        // SUPPORT TRIANGLES: stand 6–10m from the carrier at 35–50° off his
        // facing so he always has two angled outlets (a straight-behind man
        // is in his blind spot; a straight-ahead man shares his defender).
        const side = p === near1 ? 1 : -1;
        const ang = (40 + 8 * Math.sin(p.stridePhase || 0)) * Math.PI / 180 * side;
        const faceX = -adir; // carrier roughly faces goal
        const cos = Math.cos(ang), sin = Math.sin(ang);
        const ox = faceX * cos * 8, oz = sin * 8 + faceX * 0; // rotate facing by ±~40°
        setIntent(p, anchor.x + ox, anchor.z + oz * (anchor.z > 0 ? -1 : 1) * side * side + sin * 8 * side, 0.55);
        continue;
      }
      if (p === farFlank) {
        // MAX WIDTH: one player always hugs the far touchline. Defenses are
        // narrow by instinct; width forces them to choose between center
        // and flank — that choice is where space comes from.
        setIntent(p, THREE.MathUtils.lerp(p.home.x, anchor.x, 0.5), Math.sign(p.pos.z || 1) * (HALF_H - 2.5), 0.5);
        continue;
      }
      if (p.role === 'FWD' && phase !== 'buildup') {
        // RUNS IN BEHIND: sprint at the gap behind the defensive line, but
        // stay LEVEL with the second-deepest defender until the pass is hit —
        // beyond it you'd be offside-ish and useless.
        let runX = line + (-adir) * 0.6; // a stride onside
        // toe the line: never deeper than the line itself
        if (ax(runX, adir) > ax(line, adir)) runX = line;
        setIntent(p, runX, p.pos.z * 0.6 + (p.home.z > 0 ? 3 : -3), phase === 'final' ? 0.9 : 0.7);
        continue;
      }
      // Everyone else: shape, shifted with the ball; defenders push to halfway
      // to compress the pitch when we attack.
      let hx = p.home.x + (anchor.x - p.home.x) * 0.35;
      if (p.role === 'DEF') hx = adir > 0 ? Math.max(hx, anchor.x + adir * -8) : Math.min(hx, anchor.x + adir * -8);
      setIntent(p, hx, p.home.z + (anchor.z - p.home.z) * 0.3, 0.35);
    }
  }

  function defendingIntents(players, ball, team, carrier, counterPress) {
    // dir of the defending team
    let defDir = 0;
    for (const p of players) if (p.team === team) { defDir = p.dir; break; }
    const ownGoalX = defDir * HALF_W;

    // who presses, who covers
    let presser = null, cover = null, d1 = 1e9, d2 = 1e9;
    for (const p of players) {
      if (p.team !== team || p.role === 'GK') continue;
      const d = p.pos.distanceTo(ball.pos);
      if (d < d1) { d2 = d1; cover = presser; d1 = d; presser = p; }
      else if (d < d2) { d2 = d; cover = p; }
    }

    // PRESSING TRIGGERS: a heavy touch (ball escapes the carrier's feet) or a
    // backward pass in their own third is the cue to spring — the moment the
    // attacker's options are worst.
    let trigger = false;
    if (carrier && ball.pos.distanceTo(carrier.pos) > 1.5) trigger = true;
    if (carrier && (ball.vel.x * -carrier.dir) < -2 && phaseOf(ball.pos.x, carrier.dir) === 'buildup') trigger = true;

    // most dangerous outlet = the attacker most advanced toward our goal with space
    let danger = null, dscore = -1e9;
    for (const q of players) {
      if (q.team === team || q.role === 'GK' || q === carrier) continue;
      const s = q.pos.x * defDir + Math.min(nearestOpponentDist(players, q.team, q.pos), 8) * 0.5;
      if (s > dscore) { dscore = s; danger = q; }
    }

    const lineX = (() => {
      // OFFSIDE LINE: defenders stay level with the deepest threat, but STEP
      // UP when the ball moves backward — squeezing the space attackers can
      // legally occupy. This is what a real back line does in unison.
      let deepest = 0;
      for (const q of players) {
        if (q.team === team || q.role === 'GK') continue;
        deepest = Math.max(deepest, q.pos.x * defDir);
      }
      let lx = Math.min(deepest, Math.abs(ball.pos.x * defDir) + 6);
      if (ball.vel.x * defDir < -1.5) lx -= 3; // ball going away from our goal → step up
      return THREE.MathUtils.clamp(lx, 2, HALF_W - 4) * defDir;
    })();

    for (const p of players) {
      if (p.team !== team || p.role === 'GK') continue;

      if (p === presser || (counterPress && p.pos.distanceTo(ball.pos) < 12)) {
        // CURVED PRESS: approach from slightly goal-side so the carrier's easy
        // forward option is your body. Pressing straight on invites a knock
        // past you; pressing on a curve herds them sideways or backward.
        _a.subVectors(ball.pos, p.pos);
        const d = _a.length();
        const curveOff = THREE.MathUtils.clamp(d * 0.35, 0.5, 3);
        setIntent(p,
          ball.pos.x + defDir * Math.min(1.2, d * 0.2),           // arrive goal-side
          ball.pos.z + (ball.pos.z > p.pos.z ? -1 : 1) * curveOff * 0.4,
          trigger || counterPress ? 1 : 0.8);
        continue;
      }
      if (p === cover && danger && carrier) {
        // COVER THE LANE: stand on the segment carrier → most dangerous
        // outlet, closer to the outlet. Cutting one lane forces the slower,
        // safer pass — which buys the whole team time to shift.
        setIntent(p,
          carrier.pos.x + (danger.pos.x - carrier.pos.x) * 0.65,
          carrier.pos.z + (danger.pos.z - carrier.pos.z) * 0.65,
          trigger ? 0.95 : 0.7);
        continue;
      }
      // TWO COMPACT BANKS: DEF bank on the offside line, MID bank ~9m ahead
      // of it. Both shift laterally with the ball but stay narrow — block the
      // center, show the attacker wide where goals don't come from.
      const bankX = p.role === 'DEF' ? lineX : lineX - defDir * 9;
      let bz = p.home.z * 0.55 + ball.pos.z * 0.45;            // shift with ball, stay compact
      if (p.role === 'MID') bz = bz * 0.7;                      // mids screen the central lane
      bz = THREE.MathUtils.clamp(bz, -HALF_H + 4, HALF_H - 4);
      setIntent(p, bankX, bz, 0.5);
    }
  }

  // =========================================================================
  // PUBLIC UPDATE
  // =========================================================================
  function update(dt, world) {
    const { players, ball, possessionTeam, carrier } = world;
    intents.clear();

    // ---- transition tracking: did the ball change hands? ----
    if (possessionTeam && prevPossession && possessionTeam !== prevPossession) {
      transitionT = 2.0;
      transitionWinner = possessionTeam;
      planClock = 1e9; // force an immediate re-plan — old plan is for the old game state
    }
    if (possessionTeam) prevPossession = possessionTeam;
    transitionT = Math.max(0, transitionT - dt);

    // ---- carrier decision, with commitment (re-plan every 0.3–0.5s) ----
    planClock += dt;
    let plan = null;
    if (carrier) {
      const press = nearestOpponentDist(players, carrier.team, carrier.pos);
      // pressure shortens the thinking window — you decide faster when hunted
      const interval = press < 2.5 ? planInterval * 0.5 : planInterval;
      if (carrier !== currentCarrier || planClock >= interval) {
        currentPlan = makePlan(players, carrier);
        currentCarrier = carrier;
        planClock = 0;
        planInterval = 0.3 + rng() * 0.2;
      } else if (currentPlan && currentPlan.type === 'pass' && currentPlan.mate) {
        // keep the committed choice but refresh the lead on the runner
        const m = currentPlan.mate;
        const flight = m.pos.distanceTo(carrier.pos) / 14;
        currentPlan.aimPoint.copy(m.pos).addScaledVector(m.vel, flight);
      }
      plan = currentPlan;
    } else {
      currentPlan = null; currentCarrier = null;
    }

    // ---- off-ball intents for every outfielder ----
    const attTeam = possessionTeam;
    if (attTeam) {
      const phase = carrier ? phaseOf(carrier.pos.x, carrier.dir) : phaseOf(ball.pos.x, teamDir(players, attTeam));
      const defTeam = opTeam(players, attTeam);
      const countering = transitionT > 0 && transitionWinner === attTeam;
      const counterPressing = transitionT > 0 && transitionWinner === attTeam; // losers counter-press

      attackingIntents(players, ball, attTeam, carrier, phase);
      if (countering) {
        // COUNTER: for 2s, forwards ignore patience and sprint in behind.
        for (const p of players) {
          if (p.team !== attTeam || p.role !== 'FWD') continue;
          const it = intents.get(p);
          if (it) { it.target.x = attackX(p.dir) * 0.8; it.urgency = 1; }
        }
      }
      if (defTeam) defendingIntents(players, ball, defTeam, carrier, counterPressing && transitionT > 0);
    } else {
      // loose ball, no possession: both teams defend their shape, nearest men chase
      for (const p of players) {
        if (p.role === 'GK') continue;
        setIntent(p, p.home.x + (ball.pos.x - p.home.x) * 0.35, p.home.z + (ball.pos.z - p.home.z) * 0.4, 0.4);
      }
    }

    return { intents, plan };
  }

  function teamDir(players, team) {
    for (const p of players) if (p.team === team) return p.dir;
    return -1;
  }

  return { update };
}
