// referee.js — Cyberliga match official: 3D character + rules engine.
// ES module. No DOM access. Host calls createReferee(scene), then ref.update()
// every frame and ref.judgeChallenge() whenever a shove/collision happens.
import * as THREE from 'three';

// Pitch constants (frozen spec — must match index.html)
const HALF_W = 32, HALF_H = 20;        // x ∈ [-32,32], z ∈ [-20,20]
const BOX_X = 20, BOX_Z = 9;           // penalty boxes: |x| ∈ [20,32], |z| ≤ 9

const NEON_YELLOW = 0xffe14d;

// ---------------------------------------------------------------------------
// Character — same construction idiom as buildPlayer(): capsule torso, sphere
// head, leg/arm pivot groups, MeshStandardMaterial, castShadow on body parts.
// Black kit with neon-yellow trim so he reads instantly as "the official".
// ---------------------------------------------------------------------------
function buildRefMesh() {
  const g = new THREE.Group();
  const kitMat = new THREE.MeshStandardMaterial({
    color: 0x0b0d12, roughness: 0.6, emissive: 0x05060a, emissiveIntensity: 0.3 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xc9a07e, roughness: 0.65 });
  const shortMat = new THREE.MeshStandardMaterial({ color: 0x07090e, roughness: 0.7 });
  const trimMat = new THREE.MeshBasicMaterial({ color: NEON_YELLOW });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.55, 6, 10), kitMat);
  torso.position.y = 1.18; torso.castShadow = true;

  const headPivot = new THREE.Group(); headPivot.position.y = 1.92;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skinMat);
  head.castShadow = true;
  // short dark hair
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.245, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.9 }));
  hair.position.set(0, 0.04, -0.03);
  headPivot.add(head, hair);

  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.3, 10), shortMat);
  hips.position.y = 0.78;
  g.add(torso, headPivot, hips);

  // limbs along local X; forward is local +Z (same convention as players)
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.16, 0.72, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.5, 4, 8), skinMat);
    leg.position.y = -0.36; leg.castShadow = true;
    pivot.add(leg); g.add(pivot); legs.push(pivot);
  }
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.46, 1.55, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 4, 8), kitMat);
    arm.position.y = -0.3; arm.castShadow = true;
    pivot.add(arm); g.add(pivot); arms.push(pivot);
  }

  // neon-yellow shoulder trim + collar — the "authority" accents
  for (const s of [-1, 1]) {
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 6, 14), trimMat);
    trim.position.set(s * 0.46, 1.55, 0); trim.rotation.x = Math.PI / 2;
    g.add(trim);
  }
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 16), trimMat);
  collar.rotation.x = Math.PI / 2; collar.position.y = 1.72;
  g.add(collar);
  // chest badge
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), trimMat);
  badge.position.set(0.18, 1.42, 0.37);
  g.add(badge);
  // glow ring at feet, ref-yellow
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 24),
    new THREE.MeshBasicMaterial({ color: NEON_YELLOW, transparent: true, opacity: 0.18, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
  g.add(ring);

  // card mesh held in the right hand — hidden unless a card is being shown.
  // Material color is swapped per booking (yellow/red).
  const cardMat = new THREE.MeshBasicMaterial({ color: NEON_YELLOW, side: THREE.DoubleSide });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.22), cardMat);
  card.position.set(0, -0.62, 0.06); // at the end of the arm, inside the arm pivot
  card.visible = false;
  arms[1].add(card);

  return { mesh: g, legs, arms, headPivot, card, cardMat };
}

const clamp = THREE.MathUtils.clamp;

export function createReferee(scene, opts = {}) {
  const rng = opts.rng ?? Math.random;
  const { mesh, legs, arms, card, cardMat } = buildRefMesh();
  scene.add(mesh);

  const pos = new THREE.Vector3(0, 0, 12); // start on the diagonal touchline side
  let yaw = 0;
  let stridePhase = rng() * 6.28;
  let speedSm = 0;                          // smoothed speed for gait amplitude

  // --- rules engine state ---
  const bookings = new Map();               // key: name+teamName → yellow count
  let foulCooldown = 0;                     // seconds of game time until next foul possible
  let cardAnim = 0;                         // remaining seconds of arm-raise animation
  let foulSpot = null;                      // Vector3-ish {x,z} to sprint toward after a ruling

  const target = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function update(t, dt, ball, players) {
    foulCooldown = Math.max(0, foulCooldown - dt);

    // ---- positioning AI ----
    // Classic referee diagonal: run roughly the bottom-left ↔ top-right line,
    // staying 8-14m from the ball so he sees play without being in it.
    if (foulSpot) {
      target.set(foulSpot.x, 0, foulSpot.z);
    } else {
      // point on the diagonal nearest the ball, then back off ~11m from the ball
      const dProj = clamp((ball.pos.x / HALF_W + ball.pos.z / HALF_H) * 0.5, -0.85, 0.85);
      target.set(dProj * (HALF_W - 5), 0, dProj * (HALF_H - 5));
      tmp.subVectors(target, ball.pos); tmp.y = 0;
      const d = tmp.length() || 1;
      const want = clamp(d, 8, 14);                 // keep 8-14m from the ball
      target.copy(ball.pos).addScaledVector(tmp, want / d);
    }

    // steer away from player clusters (cheap: one pass, push-out within 2m)
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const dx = pos.x - p.pos.x, dz = pos.z - p.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 4 && d2 > 1e-4) {
        const d = Math.sqrt(d2);
        target.x += (dx / d) * (2 - d) * 2.5;
        target.z += (dz / d) * (2 - d) * 2.5;
      }
    }
    target.x = clamp(target.x, -HALF_W + 1, HALF_W - 1);
    target.z = clamp(target.z, -HALF_H + 1, HALF_H - 1);

    // move: jog normally, sprint to the foul spot when a card is pending
    tmp.subVectors(target, pos); tmp.y = 0;
    const dist = tmp.length();
    const maxSp = foulSpot ? 8.0 : 5.5;
    const sp = Math.min(maxSp, dist * 1.6);
    if (dist > 0.15) pos.addScaledVector(tmp, (sp * dt) / dist);
    if (foulSpot && dist < 1.5) foulSpot = null;   // arrived; stand over the spot

    // face the ball (shortest-arc turn, damped)
    const wantYaw = Math.atan2(ball.pos.x - pos.x, ball.pos.z - pos.z);
    let dyaw = wantYaw - yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    yaw += dyaw * Math.min(1, dt * 8);

    // ---- gait (matches the game's convention: phase += speed*dt*2.4) ----
    speedSm += (sp - speedSm) * Math.min(1, dt * 6);
    stridePhase += speedSm * dt * 2.4;
    const gaitAmp = clamp(speedSm / 7, 0, 1) * 0.6 + (speedSm > 0.3 ? 0.05 : 0);
    const stride = Math.sin(stridePhase) * gaitAmp;
    legs[0].rotation.x = stride;
    legs[1].rotation.x = -stride;
    arms[0].rotation.x = -stride * 0.85;

    // right arm: counter-swing normally, raise overhead during card animation
    if (cardAnim > 0) {
      cardAnim -= dt;
      // ease the arm up fast, hold, then drop in the last 0.3s
      const k = cardAnim > 0.3 ? 1 : cardAnim / 0.3;
      arms[1].rotation.x = -Math.PI * 0.95 * Math.min(1, (1.5 - cardAnim) * 4) * k;
      arms[1].rotation.z = 0.15 * k;
      card.visible = cardAnim > 0.05;
      if (cardAnim <= 0) { card.visible = false; arms[1].rotation.z = 0; }
    } else {
      arms[1].rotation.x = stride * 0.85;
    }

    mesh.position.copy(pos);
    mesh.position.y = Math.abs(Math.cos(stridePhase)) * clamp(speedSm / 7, 0, 1) * 0.05;
    mesh.rotation.y = yaw;
  }

  // -------------------------------------------------------------------------
  // Rules model.
  //  - Base foul probability rises with shove force and with how far the ball
  //    was from the challenge (ballDist > 1.5 ⇒ ball not playable ⇒ harder to
  //    justify the contact).
  //  - fromBehind multiplies card severity (classic "didn't see the ball").
  //  - force > ~5.5 puts straight red on the table (~4%); yellows ~20% of fouls.
  //  - Second yellow on the same player ⇒ red, sendOff, 'SECOND YELLOW'.
  //  - 4s internal cooldown so the game doesn't grind into whistle-fests.
  // -------------------------------------------------------------------------
  function judgeChallenge({ offender, victim, force, ballDist, fromBehind }) {
    if (foulCooldown > 0) return null;

    // base chance: force term + "ball not playable" term
    let pFoul = clamp((force - 1.5) * 0.10, 0, 0.45)            // harder shove = more likely
              + (ballDist > 1.5 ? clamp((ballDist - 1.5) * 0.18, 0, 0.35) : 0);
    if (fromBehind) pFoul *= 1.25;
    pFoul = clamp(pFoul, 0, 0.85);
    if (rng() >= pFoul) return null;                            // play on

    foulCooldown = 4;

    // severity: straight red ~4% when violent (force > 5.5), yellow ~20% of fouls
    const behindMult = fromBehind ? 1.8 : 1;
    let verdict = 'foul', reason, sendOff = false;
    if (force > 5.5 && rng() < 0.04 * behindMult) {
      verdict = 'red'; sendOff = true;
      reason = 'VIOLENT CONDUCT';
    } else if (rng() < 0.20 * behindMult) {
      verdict = 'yellow';
      reason = fromBehind ? 'CYNICAL DRAG-BACK'
             : ballDist > 1.5 ? 'LATE CHALLENGE'
             : 'STUDS UP';
    } else {
      reason = fromBehind ? 'PUSH IN THE BACK'
             : ballDist > 1.5 ? 'LATE CHALLENGE'
             : 'CARELESS CHALLENGE';
    }

    // bookings ledger — second yellow upgrades to red + send-off
    const key = offender.name + offender.team.name;
    if (verdict === 'yellow') {
      const n = (bookings.get(key) || 0) + 1;
      bookings.set(key, n);
      if (n >= 2) { verdict = 'red'; sendOff = true; reason = 'SECOND YELLOW'; }
    } else if (verdict === 'red') {
      bookings.set(key, 2); // a straight red also closes the book on him
    }

    // free-kick spot: where the victim was fouled, clamped inside the pitch
    const fx = clamp(victim.pos.x, -HALF_W + 0.5, HALF_W - 0.5);
    const fz = clamp(victim.pos.z, -HALF_H + 0.5, HALF_H - 0.5);

    // penalty: foul by the DEFENDING side inside ITS OWN box.
    // Team with dir=-1 defends x=-32, so its box is x < -BOX_X; dir=+1 ⇒ x > BOX_X.
    const inOwnBox = Math.abs(fz) <= BOX_Z &&
      (offender.dir === -1 ? fx <= -BOX_X : fx >= BOX_X);

    foulSpot = { x: fx, z: fz }; // sprint there to administer the ruling
    return { verdict, reason, freeKick: { x: fx, z: fz }, penalty: inOwnBox, sendOff };
  }

  function raiseCard(color) {
    cardMat.color.set(color === 'red' ? 0xff3b4d : NEON_YELLOW);
    cardAnim = 1.5;
  }

  function reset() {
    bookings.clear();
    foulCooldown = 0;
    cardAnim = 0;
    card.visible = false;
    foulSpot = null;
    pos.set(0, 0, 12);
  }

  return { pos, update, judgeChallenge, raiseCard, reset, bookings, mesh };
}
