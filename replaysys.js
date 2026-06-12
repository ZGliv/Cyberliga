// replaysys.js — EXACT instant replays with broadcast direction for CYBERLIGA.
//
// Captures every play frame into a preallocated ring buffer: ball position
// (sim xyz + the rendered mesh y), and per player position/yaw/speed PLUS the
// pose descriptor the host stamps on each player every animation frame
// (p._poseDesc = { kind, k, a, b }). Playback re-runs the SAME rig pose calls
// with the SAME interpolated parameters, so a replay is indistinguishable
// from a recording of the live render: the actual final pass, the actual kick
// animation at the actual moment, the keeper's actual dive, the actual ball
// path into the net.
//
// Pose descriptor kinds (a/b carry leg/side/variant/move-index):
//   0  none / pure locomotion
//   1  kick        k = anim phase, a = leg (0/1), b = amp
//   2  header      k = anim phase
//   3  throwin     k = anim phase
//   4  dive        k = dive phase, a = side (-1/1)
//   5  fall        k = fall phase
//   6  getup       k = get-up phase
//   7  skill       k = move phase, a = move index (SKILL_MOVES), b = side
//   8  slide       k = slide phase, a = side
//   9  celebrate   k = continuous time t, a = variant (0..3)
//   10 gkcatch     k = catch phase
//   11 kneeslide   k = slide phase
//   12 jockey      k = continuous time t, a = side
//   13 gkset       k = continuous time t
//   14 argue       k = continuous time t
//
// Phase-style ks (kick/dive/fall/...) interpolate between captured frames when
// the kind matches on both sides of the playback cursor; continuous-time ks
// (celebrate/jockey/gkset/argue) interpolate the same way and stay smooth.
// On a kind transition mid-interval we hold the earlier frame's descriptor —
// at 60fps capture that is at most ~16ms of live latency, invisible at 0.65x.

import * as THREE from 'three';

export const SKILL_MOVES = ['stepover', 'bodyfeint', 'dragback', 'roulette'];

const FLOATS_PER_PLAYER = 9;            // x, z, yaw, speed, kind, k, a, b, uid
const HEADER = 6;                       // t, ballX, ballY, ballZ, ballMeshY, count

export function createReplaySystem(opts = {}) {
  const bufferSeconds = opts.bufferSeconds ?? 7;
  const maxPlayers   = opts.maxPlayers ?? 16;
  const maxFrames    = opts.maxFrames ?? Math.ceil(bufferSeconds * 72); // headroom over 60fps
  const ROW = HEADER + maxPlayers * FLOATS_PER_PLAYER;

  // ---- ring buffer (preallocated, zero hot-path allocation) ----
  const buf = new Float32Array(maxFrames * ROW);
  let head = 0;        // next write slot
  let count = 0;       // valid frames in ring
  let lastT = -1;
  let nextUid = 1;     // stable per-player ids (stamped lazily as p._rsUid)
  let stepSerial = 0;  // per-step stamp so unrecorded live players get idled

  // ---- clip state ----
  // clip = ordered list of ring row offsets (Int32Array, preallocated)
  const clipRows = new Int32Array(maxFrames);
  let clipLen = 0;
  let clipDur = 0;
  let clipT0 = 0;
  let playT = 0;       // playback time within the clip (sim seconds)
  let playIdx = 0;     // f0 cursor
  let holdT = 0;       // phase C hold timer
  let phase = 'A';
  let goalSide = 1;    // which goal (x = ±32) the ball ended at
  let camZ = -1;       // lateral camera side, picked ONCE per clip (never flips mid-replay)
  let camInit = false;
  let cutDone = false; // step() snapped the camera to the aftermath framing (the cut)
  let orbitBase = new THREE.Vector3();   // cam offset captured at phase C entry
  let orbitTarget = new THREE.Vector3(); // hold target at phase C

  // ---- aftermath state ----
  let afterT = 0;
  const AFTER_DUR = 2.2;

  // ---- reusable temps (no per-frame allocation) ----
  const _desired = new THREE.Vector3();
  const _tgt = new THREE.Vector3();
  const _final = new THREE.Vector3();    // final ball position of the clip

  const PHASE_B_LEAD = 1.2;  // final 1.2s pushes toward goal
  const HOLD_DUR = 0.9;      // phase C freeze-frame
  const ORBIT_ARC = THREE.MathUtils.degToRad(15);

  function rowAt(i) { return ((head - count + i) % maxFrames + maxFrames) % maxFrames * ROW; }

  // expsmooth helper for camera (frame-rate independent)
  function damp(vec, x, y, z, lambda, dt) {
    const a = 1 - Math.exp(-lambda * dt);
    vec.x += (x - vec.x) * a; vec.y += (y - vec.y) * a; vec.z += (z - vec.z) * a;
  }

  // pull rig from a host player entry ({ mesh, mesh.userData.rig }) or a bare { group, rig }
  function rigOf(entry) {
    if (!entry) return null;
    if (entry.mesh && entry.mesh.userData && entry.mesh.userData.rig)
      return { obj: entry.mesh, rig: entry.mesh.userData.rig };
    if (entry.rig && entry.group) return { obj: entry.group, rig: entry.rig };
    return null;
  }

  function applyPose(rig, kind, k, a, b) {
    switch (kind) {
      case 1:  rig.poseKick(k, a | 0, b || 1); break;
      case 2:  if (rig.poseHeader) rig.poseHeader(k); break;
      case 3:  if (rig.poseThrowIn) rig.poseThrowIn(k); break;
      case 4:  rig.poseDive(a >= 0 ? 1 : -1, k); break;
      case 5:  rig.poseFall(k); break;
      case 6:  rig.poseGetUp(k); break;
      case 7:  rig.poseSkill(SKILL_MOVES[(a | 0) % SKILL_MOVES.length] || 'stepover', k, b || 1); break;
      case 8:  if (rig.poseSlideTackle) rig.poseSlideTackle(k, a || 1); else rig.poseFall(0.55); break;
      case 9:  rig.poseCelebrate(k, (a | 0) % 4); break;
      case 10: if (rig.poseGKCatch) rig.poseGKCatch(k); break;
      case 11: if (rig.poseKneeSlide) rig.poseKneeSlide(k); break;
      case 12: if (rig.poseJockey) rig.poseJockey(k, a || 1); break;
      case 13: if (rig.poseGKSet) rig.poseGKSet(k); break;
      case 14: if (rig.poseArgue) rig.poseArgue(k); break;
      // default: pure locomotion, no overlay pose
    }
  }

  return {
    /**
     * Call every PLAY frame. clock = state.clock, ball = host ball object
     * ({ pos, mesh }), players = live players array (each stamped with
     * p._poseDesc by animatePlayers, may be null/undefined for locomotion).
     */
    record(clock, ball, players) {
      // guard against duplicate clocks (paused frames) producing 0-span intervals
      if (clock <= lastT) return;
      lastT = clock;
      // detect recording gaps: record() only runs in 'play', so a foul/restart/
      // replay leaves adjacent ring frames separated by a world teleport. The
      // tell is the teleport ITSELF — ball or any player jumping farther than a
      // 0.05s-clamped sim step allows — NOT wall-clock time: slow or hitchy
      // frames inside continuous play must never wipe the ring (a wall-clock
      // gap test killed every replay on machines that hitch past the timeout).
      if (count > 0) {
        const prev = rowAt(count - 1);
        let jump = Math.hypot(ball.pos.x - buf[prev + 1], ball.pos.z - buf[prev + 3]) > 2.0;
        const pn = Math.min(players.length, maxPlayers), qn = buf[prev + 5] | 0;
        for (let i = 0; !jump && i < pn; i++) {
          const uid = players[i]._rsUid;
          if (!uid) continue;
          for (let j = 0; j < qn; j++) {
            const o = prev + HEADER + j * FLOATS_PER_PLAYER;
            if (buf[o + 8] === uid) {
              if (Math.hypot(players[i].pos.x - buf[o], players[i].pos.z - buf[o + 1]) > 1.6) jump = true;
              break;
            }
          }
        }
        if (jump) count = 0; // unrecorded pause: start the ring fresh, never splice
      }
      const base = head * ROW;
      const n = Math.min(players.length, maxPlayers);
      buf[base] = clock;
      buf[base + 1] = ball.pos.x;
      buf[base + 2] = ball.pos.y;
      buf[base + 3] = ball.pos.z;
      buf[base + 4] = ball.mesh ? ball.mesh.position.y : ball.pos.y;
      buf[base + 5] = n;
      for (let i = 0; i < n; i++) {
        const p = players[i], o = base + HEADER + i * FLOATS_PER_PLAYER;
        buf[o]     = p.pos.x;
        buf[o + 1] = p.pos.z;
        buf[o + 2] = p.yaw;
        buf[o + 3] = p.vel.length();
        const d = p._poseDesc;
        if (d) { buf[o + 4] = d.kind; buf[o + 5] = d.k; buf[o + 6] = d.a || 0; buf[o + 7] = d.b || 0; }
        else   { buf[o + 4] = 0; buf[o + 5] = 0; buf[o + 6] = 0; buf[o + 7] = 0; }
        buf[o + 8] = p._rsUid || (p._rsUid = nextUid++);
      }
      head = (head + 1) % maxFrames;
      if (count < maxFrames) count++;
      // ring naturally evicts; also trim frames older than the buffer window
      while (count > 2 && buf[rowAt(0)] < clock - bufferSeconds) count--;
    },

    /**
     * Freeze a clip covering the last `secondsBack` seconds of the ring.
     * Returns false if there isn't enough material (host should skip the
     * replay and go straight back to kickoff).
     */
    startClip(secondsBack = 5) {
      if (count < 20) return false;
      const endT = buf[rowAt(count - 1)];
      clipLen = 0;
      for (let i = 0; i < count; i++) {
        const r = rowAt(i);
        if (buf[r] >= endT - secondsBack) clipRows[clipLen++] = r;
      }
      if (clipLen < 12) return false;
      clipT0 = buf[clipRows[0]];
      clipDur = endT - clipT0;
      playT = 0; playIdx = 0; holdT = 0; phase = 'A'; camInit = false; cutDone = false;
      const last = clipRows[clipLen - 1];
      _final.set(buf[last + 1], buf[last + 4], buf[last + 3]);
      goalSide = _final.x >= 0 ? 1 : -1;
      // pick the touchline side ONCE from the clip's average ball z — the cam
      // must never hop the pitch mid-replay when the ball crosses z=0
      let zsum = 0;
      for (let i = 0; i < clipLen; i++) zsum += buf[clipRows[i] + 3];
      camZ = (zsum / clipLen) >= 0 ? -1 : 1;
      afterT = 0;
      return true;
    },

    /**
     * Play back ONE frame. playersArr = the live players array (matched by
     * stable uid, so a mid-clip send-off never maps a recording onto the
     * wrong body). ballMesh = ball.mesh.
     * out = { camPos: Vector3, camTarget: Vector3 } — mutated in place.
     * Returns { done, phase }.
     */
    step(dt, playersArr, ballMesh, out) {
      if (clipLen < 2) return { done: true, phase: 'C' };

      // ---- advance playback clock (0.65x, slowing to 0.45x into the finish) ----
      const inB = playT >= clipDur - PHASE_B_LEAD;
      const atEnd = playT >= clipDur;
      if (!atEnd) {
        playT += dt * (inB ? 0.45 : 0.65);
        if (playT >= clipDur) playT = clipDur;
      } else {
        holdT += dt;
      }
      phase = playT >= clipDur ? 'C' : (playT >= clipDur - PHASE_B_LEAD ? 'B' : 'A');
      // rigs and ball spin must run on PLAYBACK time, not wall time, or feet
      // slide at 1.5-2.2x during slow-mo; in the phase-C freeze they hold still
      const pdt = atEnd ? 0 : dt * (inB ? 0.45 : 0.65);

      // ---- done frame: hard broadcast cut ----
      // Snap the camera straight to the aftermath framing and write nothing
      // else. The host flips to 'aftermath' this same tick, animatePlayers
      // restores every live transform, and the mass "teleport" back to the
      // celebration lands exactly on the cut — never mid-shot.
      if (holdT >= HOLD_DUR) {
        const cx = _final.x - goalSide * 4, cz = _final.z;
        const ang = goalSide > 0 ? Math.PI : 0;
        out.camPos.set(cx + Math.cos(ang) * 4.5, 1.6, cz + Math.sin(ang) * 4.5);
        out.camTarget.set(cx, 1.15, cz);
        cutDone = true;
        return { done: true, phase: 'C' };
      }

      // ---- locate bracketing frames ----
      const simT = clipT0 + playT;
      while (playIdx < clipLen - 2 && buf[clipRows[playIdx + 1]] <= simT) playIdx++;
      const r0 = clipRows[playIdx];
      const r1 = clipRows[Math.min(playIdx + 1, clipLen - 1)];
      const span = Math.max(buf[r1] - buf[r0], 1e-4);
      const al = THREE.MathUtils.clamp((simT - buf[r0]) / span, 0, 1);

      // ---- ball: exact interpolated path (incl. the rendered height) ----
      ballMesh.position.set(
        THREE.MathUtils.lerp(buf[r0 + 1], buf[r1 + 1], al),
        THREE.MathUtils.lerp(buf[r0 + 4], buf[r1 + 4], al),
        THREE.MathUtils.lerp(buf[r0 + 3], buf[r1 + 3], al));
      // spin the ball with its captured horizontal velocity for visual continuity
      const bvx = (buf[r1 + 1] - buf[r0 + 1]) / span, bvz = (buf[r1 + 3] - buf[r0 + 3]) / span;
      ballMesh.rotation.x += bvz * pdt * 2;
      ballMesh.rotation.z -= bvx * pdt * 2;

      // ---- players: exact positions, yaws, speeds, AND poses (by uid) ----
      stepSerial++;
      const n0 = Math.min(buf[r0 + 5] | 0, maxPlayers);
      const n1 = Math.min(buf[r1 + 5] | 0, maxPlayers);
      for (let i = 0; i < n0; i++) {
        const o0 = r0 + HEADER + i * FLOATS_PER_PLAYER;
        const uid = buf[o0 + 8];
        let p = null;
        for (let j = 0; j < playersArr.length; j++)
          if (playersArr[j]._rsUid === uid) { p = playersArr[j]; break; }
        if (!p) continue; // sent off mid-window — no live body to puppet
        p._rsStamp = stepSerial;
        const e = rigOf(p);
        if (!e) continue;
        // match the same uid in f1 (slots shift if the array changed); hold f0 if gone
        let o1 = o0;
        for (let j = 0; j < n1; j++) {
          const o = r1 + HEADER + ((i + j) % n1) * FLOATS_PER_PLAYER;
          if (buf[o + 8] === uid) { o1 = o; break; }
        }
        e.obj.position.set(
          THREE.MathUtils.lerp(buf[o0], buf[o1], al), 0,
          THREE.MathUtils.lerp(buf[o0 + 1], buf[o1 + 1], al));
        // yaw: shortest-arc interpolation so a turning player doesn't whip 350°
        const y0 = buf[o0 + 2], y1 = buf[o1 + 2];
        let dy = ((y1 - y0 + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        e.obj.rotation.y = y0 + dy * al;
        // pose replay — the heart of "exact": same call, same parameters
        const kind0 = buf[o0 + 4] | 0, kind1 = buf[o1 + 4] | 0;
        if (kind0 !== 0) {
          // interpolate k only across a matching kind; hold f0 on transitions
          const k = kind0 === kind1
            ? THREE.MathUtils.lerp(buf[o0 + 5], buf[o1 + 5], al)
            : buf[o0 + 5];
          applyPose(e.rig, kind0, k, buf[o0 + 6], buf[o0 + 7]);
        }
        const spd = THREE.MathUtils.lerp(buf[o0 + 3], buf[o1 + 3], al);
        e.rig.update(pdt, atEnd ? 0 : THREE.MathUtils.clamp(spd / 7, 0, 1), undefined);
      }
      // live players absent from the recording: hold them with an idle update
      // so rigs don't T-pose
      for (let i = 0; i < playersArr.length; i++) {
        if (playersArr[i]._rsStamp === stepSerial) continue;
        const e = rigOf(playersArr[i]);
        if (e) e.rig.update(pdt, 0, undefined);
      }

      // ---- broadcast direction ----
      const bp = ballMesh.position;
      if (phase === 'A') {
        // low side cam leading the ball: positioned off the clip's chosen
        // touchline (camZ, fixed at startClip), slightly goal-side so the run
        // plays INTO frame
        const px = bp.x + goalSide * 4.5;
        const pz = bp.z + camZ * 9.5;
        if (!camInit) { out.camPos.set(px, 2.1, pz); out.camTarget.set(bp.x, 0.9, bp.z); camInit = true; }
        damp(out.camPos, px, 2.1, pz, 3.0, dt);
        damp(out.camTarget, bp.x + goalSide * 2.5, 0.9, bp.z, 5.0, dt);
      } else if (phase === 'B') {
        // push in toward the goal mouth for the finish
        const px = goalSide * 23;
        const pz = bp.z * 0.45 + camZ * 7;
        damp(out.camPos, px, 1.7, pz, 2.2, dt);
        damp(out.camTarget, goalSide * 31, 1.1, bp.z * 0.4, 4.0, dt);
        camInit = true;
      } else {
        // phase C: freeze on the goal frame, camera slowly orbits 15°
        if (orbitBase.lengthSq() === 0 || holdT <= dt) {
          orbitBase.copy(out.camPos).sub(_final);
          orbitTarget.copy(_final).setY(Math.max(_final.y, 0.6));
        }
        const ang = ORBIT_ARC * Math.min(holdT / HOLD_DUR, 1) * -goalSide;
        const c = Math.cos(ang), s = Math.sin(ang);
        out.camPos.set(
          _final.x + orbitBase.x * c + orbitBase.z * s,
          _final.y + Math.max(orbitBase.y, 1.4),
          _final.z - orbitBase.x * s + orbitBase.z * c);
        out.camTarget.copy(orbitTarget);
      }

      return { done: false, phase };
    },

    /**
     * Post-replay beauty shot (~2.2s): slow arc around the scorer at 4.5m,
     * 1.6m height, while the LIVE celebration plays underneath (host runs
     * aiStep/animatePlayers as in 'goal' mode). scorer may be null (own goal)
     * — falls back to orbiting the goalmouth where the ball ended up.
     * Returns { done }.
     */
    aftermath(dt, scorer, out) {
      const first = afterT === 0;
      afterT += dt;
      const cx = scorer ? scorer.pos.x : _final.x - goalSide * 4;
      const cz = scorer ? scorer.pos.z : _final.z;
      const ang = afterT * 0.55 + (goalSide > 0 ? Math.PI : 0); // slow arc, start facing the pitch
      const r = 4.5;
      if (first && !cutDone) {
        // no cut happened (entered without a clip): snap so we never blend
        // the camera across the replay→live boundary
        out.camPos.set(cx + Math.cos(ang) * r, 1.6, cz + Math.sin(ang) * r);
        out.camTarget.set(cx, 1.15, cz);
      } else {
        damp(out.camPos, cx + Math.cos(ang) * r, 1.6, cz + Math.sin(ang) * r, 4.0, dt);
        damp(out.camTarget, cx, 1.15, cz, 6.0, dt);
      }
      return { done: afterT >= AFTER_DUR };
    },

    /** Clear everything (call at startMatch / second-half reset). */
    reset() {
      head = 0; count = 0; lastT = -1;
      clipLen = 0; playT = 0; playIdx = 0; holdT = 0; afterT = 0;
      camInit = false; cutDone = false; orbitBase.set(0, 0, 0);
    },
  };
}
