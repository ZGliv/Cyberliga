// Court Motion: experimental autonomous three-a-side passing sport.
// Sporting state and randomness are independent of rendering. No outcome scripts.
export const FIXED_STEP = 1 / 60;
const GRAVITY = 7;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const direction = team => team === 0 ? -1 : 1;
const CAST = [
  ['Latch', 'hare', 7, 'creator', 2.65, .90],
  ['Brunt', 'badger', 44, 'finisher', 2.2, .76],
  ['Zip', 'stoat', 11, 'shooter', 2.9, .83],
  ['Nix', 'fox', 4, 'disruptor', 2.8, .88],
  ['Toll', 'boar', 33, 'rim guard', 2.15, .78],
  ['Sable', 'lynx', 21, 'stopper', 2.7, .91],
];
function hashSeed(seed) {
  let n = 2166136261;
  for (const ch of String(seed)) n = Math.imul(n ^ ch.charCodeAt(0), 16777619);
  return n >>> 0;
}
function random(sim) {
  sim.rng = (sim.rng + 0x6D2B79F5) | 0;
  let n = Math.imul(sim.rng ^ sim.rng >>> 15, 1 | sim.rng);
  n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
  return ((n ^ n >>> 14) >>> 0) / 4294967296;
}
function event(sim, type, p, text) {
  sim.events.push({ id: ++sim.eventSequence, time: sim.time, type, text, playerId: p?.id ?? null, team: p?.team ?? null });
  if (sim.events.length > 40) sim.events.shift();
}
function setAction(p, action, duration = .5) {
  p.action = action; p.actionT = 0; p.actionDuration = duration;
}
function hand(p) {
  let forward = .42, side = 0, y = 1.2;
  if (p.pending?.type === 'pass') {
    const progress = clamp(p.actionT / .22, 0, 1);
    const ease = progress * progress * (3 - 2 * progress);
    // Gather toward the chest before extending into the pass.
    forward += -.17 * Math.sin(Math.PI * progress) + .08 * ease;
    y += .16 * ease;
    side = .05 * Math.sin(Math.PI * progress);
  } else if (p.pending?.type === 'shoot') {
    const progress = clamp(p.actionT / .27, 0, 1);
    const ease = progress * progress * (3 - 2 * progress);
    forward -= .10 * ease;
    side = .18 * ease;
    y += .40 * ease;
  }
  return {
    x: p.x + Math.sin(p.facing) * forward + Math.cos(p.facing) * side,
    y,
    z: p.z + Math.cos(p.facing) * forward - Math.sin(p.facing) * side,
  };
}
function turn(p, x, z, dt, preparing = false) {
  const nearby = Math.hypot(x - p.x, z - p.z) < (preparing ? .12 : .72);
  const angle = nearby ? p.facing : Math.atan2(x - p.x, z - p.z);
  const delta = Math.atan2(Math.sin(angle - p.facing), Math.cos(angle - p.facing));
  // Angular velocity has inertia. Tiny corrections cannot reverse the entire
  // body in one frame; pass/shot preparation keeps its faster response.
  const wanted = Math.abs(delta) < .012 ? 0 : clamp(delta * (preparing ? 13 : 7), preparing ? -8 : -5.2, preparing ? 8 : 5.2);
  const acceleration = clamp((wanted - p.yawVelocity) * (preparing ? 16 : 11), preparing ? -65 : -30, preparing ? 65 : 30);
  p.yawVelocity += acceleration * dt;
  p.facing += p.yawVelocity * dt;
}
function controlled(sim, p, type = 'catch') {
  const priorTeam = sim.possession;
  sim.possession = p.team;
  if (priorTeam !== p.team) {
    sim.possessionClock = 12;
    sim.stats.turnovers[priorTeam]++;
    sim.possessionSequence++;
  }
  sim.ball.owner = p.id;
  sim.ball.mode = 'held';
  sim.ball.targetId = null;
  sim.ball.lastTouchId = p.id;
  sim.ball.vx = sim.ball.vy = sim.ball.vz = 0;
  sim.ball.flightTime = 0;
  sim.ball.pending = null;
  p.carryTime = 0;
  p.decisionAt = sim.time + .55 + random(sim) * .35;
  p.pending = null;
  setAction(p, 'catch', .32);
  if (type === 'interception') {
    sim.stats.interceptions[p.team]++;
    event(sim, type, p, `${p.name} reads the pass and intercepts`);
  } else if (type === 'recovery') {
    sim.stats.recoveries[p.team]++;
    event(sim, type, p, `${p.name} gathers the loose ball`);
  } else if (type === 'catch') {
    sim.stats.completedPasses[p.team]++;
    event(sim, type, p, `${p.name} controls the pass`);
  }
}
export function createSimulation(seed = 7) {
  const sim = {
    seed, rng: hashSeed(seed), time: 0, ticks: 0, accumulator: 0,
    score: [0, 0], possession: 0, phase: 'live', phaseRemaining: 0,
    possessionClock: 12, possessionSequence: 0, eventSequence: 0,
    players: CAST.map(([name, species, number, role, speed, skill], id) => {
      const team = id < 3 ? 0 : 1;
      const lane = id % 3;
      return { id, team, name, species, number, role, speed, skill,
        x: [-2.8, 0, 2.8][lane], z: team === 0 ? 3.7 + (lane === 1 ? -.8 : .5) : -.4 + (lane === 1 ? -1.8 : 0),
        vx: 0, vz: 0, ax: 0, az: 0, yawVelocity: 0, facing: team === 0 ? Math.PI : 0,
        avoidSide: 0, avoidUntil: 0, avoidTargetX: 0, steerAt: 0, steerKey: '', lookMode: 'play', lookUntil: 0,
        steerX: [-2.8, 0, 2.8][lane], steerZ: team === 0 ? 3.7 + (lane === 1 ? -.8 : .5) : -.4 + (lane === 1 ? -1.8 : 0),
        action: 'idle', actionT: 0, actionDuration: 0, intent: 'Find space',
        carryTime: 0, decisionAt: 0, pending: null, contactUntil: 0,
      };
    }),
    ball: { x: -2.8, y: 1.2, z: 3.7, vx: 0, vy: 0, vz: 0, owner: 0, mode: 'held', targetId: null,
      lastTouchId: 0, flightTime: 0, flightId: 0, contacts: [], scoringTeam: null, scored: false },
    events: [],
    stats: { passes: [0, 0], completedPasses: [0, 0], shots: [0, 0], goals: [0, 0],
      blocks: [0, 0], interceptions: [0, 0], misses: [0, 0], recoveries: [0, 0], turnovers: [0, 0] },
  };
  const h = hand(sim.players[0]); Object.assign(sim.ball, h);
  sim.players[0].decisionAt = .9 + random(sim) * .3;
  sim.players[0].action = 'carry';
  event(sim, 'start', sim.players[0], 'Pittsburgh starts: move, pass, find the opening');
  return sim;
}
function segmentDistance(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return { distance: Math.hypot(px - ax - dx * t, pz - az - dz * t), t };
}
function passSafety(sim, owner, receiver) {
  let risk = 0;
  for (const defender of sim.players.filter(p => p.team !== owner.team)) {
    const lane = segmentDistance(defender.x, defender.z, owner.x, owner.z, receiver.x, receiver.z);
    if (lane.t > .12 && lane.t < .93) risk += Math.max(0, 1.2 - lane.distance) * 2.4;
  }
  return risk;
}
function decide(sim, p) {
  if (p.pending || sim.time < p.decisionAt) return;
  const dir = direction(p.team);
  const opponents = sim.players.filter(q => q.team !== p.team);
  const pressure = Math.min(...opponents.map(q => distance(q, p)));
  const goalDistance = Math.hypot(p.x * .8, dir * 8 - p.z);
  const shotLane = Math.min(...opponents.map(q => segmentDistance(q.x, q.z, p.x, p.z, 0, dir * 8).distance));
  const shootValue = (6.6 - goalDistance) * .54 + shotLane * .42 + (p.role === 'shooter' ? .42 : 0);
  const candidates = sim.players.filter(q => q.team === p.team && q.id !== p.id).map(q => {
    const forward = (q.z - p.z) * dir;
    const space = Math.min(...opponents.map(d => distance(d, q)));
    return { p: q, score: forward * .52 + Math.min(space, 3) * .75 - passSafety(sim, p, q) - Math.max(0, distance(p, q) - 6) * .3 + random(sim) * .55 };
  }).sort((a, b) => b.score - a.score);
  const forced = p.carryTime > 2.55 || sim.possessionClock < 1.2;
  if (goalDistance < 6.7 && (shootValue + random(sim) * 1.05 > 1.6 || (forced && goalDistance < 5.6))) {
    p.pending = { type: 'shoot', at: sim.time + .27, targetId: null };
    p.intent = 'Plant, aim, shoot'; setAction(p, 'shoot', .55);
  } else if (forced || (p.carryTime > 1 && (candidates[0].score > .75 || pressure < 1.45))) {
    p.pending = { type: 'pass', at: sim.time + .22, targetId: candidates[0].p.id };
    p.intent = `Find ${candidates[0].p.name}`; setAction(p, 'pass', .48);
  } else {
    p.decisionAt = sim.time + .20 + random(sim) * .22;
    p.intent = pressure < 1.8 ? 'Draw the defender' : 'Carry into open space';
  }
}
function release(sim, p) {
  const pending = p.pending;
  if (!pending || sim.time < pending.at) return;
  p.pending = null;
  const ball = sim.ball;
  // Held ball approaches this point continuously; preserve its actual origin.
  const start = { x: ball.x, y: ball.y, z: ball.z };
  let tx, tz, ty, duration;
  if (pending.type === 'pass') {
    const target = sim.players[pending.targetId];
    duration = clamp(distance(p, target) / 8.5, .38, .85);
    tx = clamp(target.x + target.vx * duration * .75, -4.55, 4.55);
    tz = clamp(target.z + target.vz * duration * .75, -7.25, 7.25);
    ty = 1.17;
    ball.targetId = target.id;
    sim.stats.passes[p.team]++;
    event(sim, 'pass', p, `${p.name} looks for ${target.name}`);
  } else {
    const goalz = direction(p.team) * 8.12;
    const pressure = Math.min(...sim.players.filter(q => q.team !== p.team).map(q => distance(q, p)));
    const error = .20 + Math.max(0, distance(p, { x: 0, z: goalz }) - 3) * .095 + Math.max(0, 1.6 - pressure) * .36;
    tx = (random(sim) * 2 - 1) * (1.42 + error);
    tz = goalz;
    ty = .45 + random(sim) * (1.65 + error);
    duration = clamp(distance(p, { x: tx, z: tz }) / 10.7, .30, .84);
    ball.targetId = null;
    sim.stats.shots[p.team]++;
    event(sim, 'shot', p, `${p.name} takes the opening`);
  }
  ball.owner = null; ball.mode = pending.type === 'shoot' ? 'shot' : 'pass';
  ball.vx = (tx - start.x) / duration;
  ball.vz = (tz - start.z) / duration;
  ball.vy = (ty - start.y + .5 * GRAVITY * duration * duration) / duration;
  ball.lastTouchId = p.id; ball.flightTime = 0; ball.flightId++;
  ball.contacts = [p.id]; ball.scoringTeam = p.team; ball.scored = false;
  ball.expectedFlight = duration;
  // Direction is bounded in normal locomotion; the release never rotates a body.
  p.decisionAt = sim.time + .65;
}
function beginRestart(sim, team, reason) {
  sim.phase = 'restart'; sim.phaseRemaining = 1.7; sim.possession = team;
  sim.possessionClock = 12; sim.possessionSequence++;
  for (const p of sim.players) p.pending = null;
  sim.ball.owner = null; sim.ball.mode = 'loose'; sim.ball.targetId = null;
  sim.ball.contacts = []; sim.ball.scoringTeam = null;
  sim.ball.vx *= .28; sim.ball.vz *= .28;
  sim.ball.vy = Math.min(sim.ball.vy, .7);
  event(sim, 'restart', null, reason);
}
function movePlayers(sim, dt) {
  const ball = sim.ball, owner = ball.owner === null ? null : sim.players[ball.owner];
  const loose = ball.owner === null && ball.mode === 'loose';
  const eligible = sim.phase === 'restart' ? sim.players.filter(p => p.team === sim.possession) : sim.players;
  const chaseKey = `${sim.phase}:${sim.possession}:${ball.flightId}`;
  if (sim.chaseKey !== chaseKey || sim.time >= (sim.chaseUntil || 0)) {
    sim.chaseKey = chaseKey; sim.chaseUntil = sim.time + .55;
    sim.chaserIds = eligible.slice().sort((a, b) => distance(a, ball) - distance(b, ball)).slice(0, loose ? 2 : 1).map(p => p.id);
  }
  const chasers = sim.chaserIds;
  for (const p of sim.players) {
    p.actionT += dt;
    const dir = direction(p.team), lane = p.id % 3;
    let tx = p.x, tz = p.z, speed = p.speed;
    if (sim.phase === 'restart') {
      if (p.team === sim.possession && chasers.includes(p.id) && ball.owner === null) {
        tx = ball.x; tz = ball.z; p.intent = 'Retrieve for restart';
      } else if (owner?.id === p.id) {
        p.intent = 'Restart possession'; speed = 0;
      } else {
        tx = [-2.8, 0, 2.8][lane]; tz = -dir * (p.team === sim.possession ? 3.2 : 1.0);
        p.intent = 'Reset shape';
      }
    } else if (loose) {
      if (chasers.includes(p.id)) {
        tx = clamp(ball.x + ball.vx * .12, -4.55, 4.55);
        tz = clamp(ball.z + ball.vz * .12, -7.25, 7.25); p.intent = 'Recover the loose ball';
      } else {
        tx = [-2.8, 0, 2.8][lane]; tz = clamp(ball.z - dir * 1.2, -6.3, 6.3); p.intent = 'Offer the outlet';
      }
    } else if (owner?.id === p.id) {
      tx = clamp(p.x * .70 + Math.sin(sim.time * 1.2 + p.id) * .6, -3.7, 3.7);
      tz = clamp(p.z + dir * 2.2, -6.45, 6.45);
      const front = sim.players.filter(q => q.team !== p.team && (q.z - p.z) * dir > 0).sort((a, b) => distance(a, p) - distance(b, p))[0];
      if (front && distance(front, p) < 2.35 && Math.abs(front.x - p.x) < 1.2) {
        if (sim.time >= p.avoidUntil) {
          const lateral = p.x - front.x;
          p.avoidSide = Math.abs(lateral) > .3 ? Math.sign(lateral) : (p.x > 0 ? -1 : 1);
          p.avoidTargetX = clamp(p.x + p.avoidSide * 1.75, -4, 4);
          p.avoidUntil = sim.time + .95;
        }
      }
      if (sim.time < p.avoidUntil) {
        tx = p.avoidTargetX; tz = p.z + dir * .70;
      }
      speed = p.pending ? .20 : 1.42;
      p.carryTime += dt;
      if (p.actionT >= p.actionDuration && !p.pending) p.action = 'carry';
    } else if (p.team === sim.possession) {
      if (ball.mode === 'pass' && ball.targetId === p.id) {
        tx = clamp(ball.x + ball.vx * Math.max(0, ball.expectedFlight - ball.flightTime), -4.5, 4.5);
        tz = clamp(ball.z + ball.vz * Math.max(0, ball.expectedFlight - ball.flightTime), -7.1, 7.1);
        p.intent = 'Meet the pass';
      } else {
        const source = owner || ball;
        tx = [-3.1, .1, 3.1][lane] + Math.sin(sim.time * .8 + p.id * 2) * .5;
        tz = clamp(source.z + dir * (1.8 + (lane === 1 ? 1.1 : .2)), -6.35, 6.35);
        if (owner && Math.abs(tx - owner.x) < 1.2) tx += tx > 0 ? 1 : -1;
        p.intent = lane === 1 ? 'Find the seam' : 'Stretch the defense';
      }
    } else {
      const marked = sim.players[(p.id + 3) % 6];
      const source = owner || ball;
      const ownGoal = -dir * 8;
      tx = marked.x * .83;
      tz = marked.z * .78 + ownGoal * .22;
      if (owner && marked.id === owner.id) {
        tx = owner.x; tz = owner.z + direction(owner.team) * 1.25;
        p.intent = 'Close the shooting lane';
      } else { p.intent = 'Read the passing lane'; }
      if ((owner?.pending?.type === 'shoot' && distance(p, owner) < 2.7) || (ball.mode === 'shot' && distance(p, ball) < 2.5)) {
        if (p.action !== 'block' || p.actionT > .7) setAction(p, 'block', .65);
      }
      if (ball.mode === 'shot' || (ball.mode === 'pass' && distance(p, ball) < 2.4)) {
        const future = { x: ball.x + ball.vx * .10, z: ball.z + ball.vz * .10 };
        if (distance(p, future) < 2.8) { tx = future.x; tz = future.z; p.intent = ball.mode === 'shot' ? 'Contest the shot' : 'Attack the pass'; }
      }
    }
    tx = clamp(tx, -4.55, 4.55); tz = clamp(tz, -7.38, 7.38);
    const steerKey = `${sim.phase}:${sim.possession}:${ball.owner}:${ball.mode}:${p.intent}`;
    // Commit to a short movement intention. A moving marker or possession line
    // cannot retarget a whole-body correction on every simulation tick.
    if (p.steerKey !== steerKey || sim.time >= p.steerAt) {
      p.steerX = tx; p.steerZ = tz; p.steerKey = steerKey;
      p.steerAt = sim.time + (ball.mode === 'shot' || ball.targetId === p.id ? .10 : .24 + p.id * .009);
    }
    let dx = p.steerX - p.x, dz = p.steerZ - p.z;
    const attraction = Math.hypot(dx, dz);
    if (attraction > 1.4) { dx *= 1.4 / attraction; dz *= 1.4 / attraction; }
    let contactDampX = 0, contactDampZ = 0;
    for (const q of sim.players) {
      if (q.id === p.id) continue;
      const d = distance(p, q);
      if (d < 1.30 && d > .001) {
        const nx = (p.x - q.x) / d, nz = (p.z - q.z) / d;
        const force = (1.30 - d) * 5.2;
        dx += nx * force; dz += nz * force;
        const closing = Math.min(0, (p.vx - q.vx) * nx + (p.vz - q.vz) * nz);
        contactDampX -= nx * closing * 2; contactDampZ -= nz * closing * 2;
      }
    }
    // Damped arrival: spring toward a local target, dissipate velocity near it.
    // Acceleration itself is continuous, including a change of defensive intent.
    const d = Math.hypot(dx, dz), desiredSpeed = Math.min(speed, d * 2.2);
    let desiredVX = d > .055 ? dx / d * desiredSpeed : 0;
    let desiredVZ = d > .055 ? dz / d * desiredSpeed : 0;
    // Brake before a boundary rather than slamming velocity to zero at it.
    desiredVX = clamp(desiredVX, -Math.max(0, p.x + 4.5) * 2.5, Math.max(0, 4.5 - p.x) * 2.5);
    desiredVZ = clamp(desiredVZ, -Math.max(0, p.z + 7.3) * 2.5, Math.max(0, 7.3 - p.z) * 2.5);
    let ax = (desiredVX - p.vx) * 8 + contactDampX, az = (desiredVZ - p.vz) * 8 + contactDampZ;
    const acceleration = Math.hypot(ax, az);
    if (acceleration > 6.2) { ax *= 6.2 / acceleration; az *= 6.2 / acceleration; }
    const changeX = ax - p.ax, changeZ = az - p.az, change = Math.hypot(changeX, changeZ);
    const maxChange = 45 * dt;
    p.ax += change > maxChange ? changeX / change * maxChange : changeX;
    p.az += change > maxChange ? changeZ / change * maxChange : changeZ;
    p.vx += p.ax * dt; p.vz += p.az * dt;
    p.x = clamp(p.x + p.vx * dt, -4.6, 4.6); p.z = clamp(p.z + p.vz * dt, -7.4, 7.4);
    if (p.x === -4.6 || p.x === 4.6) { p.vx = 0; p.ax = 0; }
    if (p.z === -7.4 || p.z === 7.4) { p.vz = 0; p.az = 0; }
    if (p.pending?.type === 'pass') {
      const target = sim.players[p.pending.targetId]; turn(p, target.x, target.z, dt, true);
    } else if (p.pending?.type === 'shoot') turn(p, 0, dir * 8, dt, true);
    else if (ball.owner === p.id) turn(p, p.x, p.z + dir * 4, dt);
    else if (p.team !== sim.possession || ball.targetId === p.id || loose || sim.phase === 'restart') {
      // Defenders shuffle/backpedal while watching the contest, not their feet.
      const look = owner || ball;
      turn(p, look.x, look.z, dt);
    } else {
      const running = Math.hypot(p.vx, p.vz);
      if (sim.time >= p.lookUntil) {
        if (p.lookMode === 'travel' && (running < .55 || distance(p, ball) < 3)) p.lookMode = 'play';
        else if (p.lookMode !== 'travel' && running > 1.25 && distance(p, ball) > 4) p.lookMode = 'travel';
        p.lookUntil = sim.time + .45;
      }
      if (p.lookMode === 'travel') turn(p, p.x + p.vx * 2, p.z + p.vz * 2, dt);
      else turn(p, ball.x, ball.z, dt);
    }
    if (p.actionT >= p.actionDuration && ball.owner !== p.id) p.action = Math.hypot(p.vx, p.vz) > .2 ? 'run' : 'idle';
  }
}
function ballStep(sim, dt) {
  const b = sim.ball;
  if (b.owner !== null) {
    const h = hand(sim.players[b.owner]);
    const dx = h.x - b.x, dy = h.y - b.y, dz = h.z - b.z, dist = Math.hypot(dx, dy, dz);
    const amount = dist > 0 ? Math.min(1, 9 * dt / dist) : 1;
    b.x += dx * amount; b.y += dy * amount; b.z += dz * amount;
    return;
  }
  const previous = { x: b.x, y: b.y, z: b.z };
  b.flightTime += dt;
  b.vy -= GRAVITY * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  if (b.y < .18) {
    b.y = .18; b.vy = Math.abs(b.vy) > .6 ? Math.abs(b.vy) * .40 : 0;
    b.vx *= .91; b.vz *= .91;
    if (b.mode === 'pass') b.mode = 'loose';
  }
  if (sim.phase === 'live' && b.mode === 'shot' && !b.scored) {
    const team = b.scoringTeam, dir = direction(team), plane = dir * 8;
    if (previous.z * dir < 8 && b.z * dir >= 8) {
      const f = (plane - previous.z) / (b.z - previous.z);
      const x = previous.x + (b.x - previous.x) * f, y = previous.y + (b.y - previous.y) * f;
      if (Math.abs(x) <= 1.65 && y >= .18 && y <= 2.5) {
        b.scored = true;
        sim.score[team]++; sim.stats.goals[team]++;
        const shooter = sim.players[b.lastTouchId];
        event(sim, 'goal', shooter, `${shooter.name} scores · ${sim.score[0]}–${sim.score[1]}`);
        setAction(shooter, 'celebrate', 1.25);
        beginRestart(sim, 1 - team, 'Goal confirmed · opponents retrieve and restart');
      } else {
        sim.stats.misses[team]++;
        event(sim, 'miss', sim.players[b.lastTouchId], 'Wide of the opening · ball stays live');
        b.mode = 'loose'; b.targetId = null;
      }
    }
  }
  // The small court has rebound rails and a short goal recess: no invisible resets.
  if (Math.abs(b.x) > 4.86) { b.x = Math.sign(b.x) * 4.86; b.vx *= -.56; b.mode = 'loose'; }
  if (Math.abs(b.z) > 8.28) { b.z = Math.sign(b.z) * 8.28; b.vz *= -.45; b.mode = 'loose'; }
  if (b.mode === 'shot' && b.flightTime > b.expectedFlight + .55) {
    sim.stats.misses[b.scoringTeam]++;
    event(sim, 'miss', sim.players[b.lastTouchId], 'Shot drops loose · race for the recovery');
    b.mode = 'loose'; b.targetId = null;
  }
  if (b.mode === 'pass' && b.flightTime > b.expectedFlight + .40) { b.mode = 'loose'; b.targetId = null; }
  const contenders = sim.players.slice().sort((a, c) => distance(a, b) - distance(c, b));
  for (const p of contenders) {
    if (sim.phase === 'restart' && p.team !== sim.possession) continue;
    if (p.id === b.lastTouchId && b.flightTime < .52) continue;
    const near = segmentDistance(p.x, p.z, previous.x, previous.z, b.x, b.z);
    const y = previous.y + (b.y - previous.y) * near.t;
    if (b.mode === 'shot') {
      if (p.team === b.scoringTeam || b.contacts.includes(p.id) || near.distance > .46 || y > 2.16 || y < .65 || p.action !== 'block' || p.actionT < .10) continue;
      b.contacts.push(p.id);
      // Actual intersection with the defender's reach determines a block.
      setAction(p, 'block', .48);
      const attack = direction(b.scoringTeam);
      b.vx = (b.x - p.x) * 3.2 + (random(sim) - .5) * 2;
      b.vz = -attack * (1.8 + random(sim) * 1.8);
      b.vy = 1.4 + random(sim) * 1.5;
      b.mode = 'loose'; b.targetId = null;
      sim.stats.blocks[p.team]++;
      event(sim, 'block', p, `${p.name} gets a hand to the shot`);
      p.contactUntil = sim.time + .32;
      return;
    }
    const radius = b.mode === 'loose' ? .88 : .66;
    if (near.distance > radius || y > 1.85 || y < .18 || p.contactUntil > sim.time) continue;
    if (b.mode === 'pass' && b.flightTime < .13) continue;
    const type = b.mode === 'pass' ? (p.team !== sim.possession ? 'interception' : 'catch') : 'recovery';
    controlled(sim, p, type);
    return;
  }
}
function tick(sim) {
  sim.ticks++; sim.time = sim.ticks * FIXED_STEP;
  if (sim.phase === 'live') {
    sim.possessionClock = Math.max(0, sim.possessionClock - FIXED_STEP);
    if (sim.possessionClock === 0 && sim.ball.mode !== 'shot') {
      sim.stats.turnovers[sim.possession]++;
      beginRestart(sim, 1 - sim.possession, 'Possession time expires · change of ball');
    }
  } else {
    sim.phaseRemaining = Math.max(0, sim.phaseRemaining - FIXED_STEP);
    if (sim.phaseRemaining === 0 && sim.ball.owner !== null) {
      sim.phase = 'live'; sim.possessionClock = 12;
      sim.players[sim.ball.owner].carryTime = 0;
      sim.players[sim.ball.owner].decisionAt = sim.time + .65;
    }
  }
  movePlayers(sim, FIXED_STEP);
  if (sim.phase === 'live' && sim.ball.owner !== null) {
    const p = sim.players[sim.ball.owner]; decide(sim, p); release(sim, p);
  }
  ballStep(sim, FIXED_STEP);
}
export function stepSimulation(sim, dt = FIXED_STEP) {
  if (!Number.isFinite(dt) || dt < 0 || dt > 60) throw new RangeError('dt must be finite and between 0 and 60 seconds');
  sim.accumulator += dt;
  while (sim.accumulator >= FIXED_STEP - 1e-10) {
    sim.accumulator = Math.max(0, sim.accumulator - FIXED_STEP);
    tick(sim);
  }
  if (sim.accumulator < 1e-10) sim.accumulator = 0;
  return sim;
}
export function snapshot(sim) { return JSON.parse(JSON.stringify(sim)); }
