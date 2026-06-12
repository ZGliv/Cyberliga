// blobrig.js — the "Classic" CYBERLIGA look: glowing capsule athletes (the original era).
// Implements the exact same rig API as humanrig.js/kayrig.js so the host can swap
// renderers with one import decision. Poses are expressive squash/tilt/bounce rather
// than limbs — fast to load, reads great at broadcast distance, perfect for
// prototyping new sports before they get the hyper-real treatment.
import * as THREE from 'three';

export async function preloadClassic() { /* nothing to load — instant */ }

export function buildBlobRig({ kitColor, glowColor, isGK = false, captain = false } = {}) {
  const g = new THREE.Group();
  const kit = new THREE.Color(kitColor);
  if (isGK) kit.lerp(new THREE.Color(0xc8ff4d), 0.5);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: kit, roughness: 0.45, emissive: kit, emissiveIntensity: 0.35 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.85, 6, 12), bodyMat);
  body.position.y = 1.05;
  body.castShadow = true;

  const headPivot = new THREE.Group();
  headPivot.position.y = 1.98;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12),
    new THREE.MeshStandardMaterial({ color: 0x10141f, roughness: 0.4, emissive: glowColor, emissiveIntensity: 0.15 }));
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.305, 14, 8, -0.7, 2.1, 0.95, 0.9),
    new THREE.MeshBasicMaterial({ color: glowColor }));
  headPivot.add(head, visor);

  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 24),
    new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;

  g.add(body, headPivot, ring);

  if (captain) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.035, 6, 18),
      new THREE.MeshBasicMaterial({ color: glowColor }));
    band.rotation.x = Math.PI / 2;
    band.position.y = 1.45;
    g.add(band);
  }

  // frame-local pose intents, applied + decayed in update()
  let bobT = Math.random() * 6.28, tiltX = 0, leanZ = 0, lift = 0, squash = 1;
  let liftS = 0, squashS = 1; // smoothed lift/squash actually applied to the mesh
  const setPose = (x, z, y = 0, s = 1) => { tiltX = x; leanZ = z; lift = y; squash = s; };

  const api = {
    group: g,
    headPivot,
    anchors: { back: { x: 0, y: 1.25, z: -0.44 }, chest: { x: 0, y: 1.3, z: 0.44 }, tagY: 2.6 },
    update(dt, speedNorm = 0, opts = {}) {
      bobT += dt * (4 + speedNorm * 8);
      const bob = Math.abs(Math.sin(bobT)) * speedNorm * 0.12;
      // ease lift/squash toward their targets like rotation, so t-driven
      // poses starting mid-cycle slide in instead of teleporting the body
      const ke = 1 - Math.exp(-14 * dt);
      liftS += (lift - liftS) * ke;
      squashS += (squash - squashS) * ke;
      body.position.y = 1.05 + bob + liftS;
      body.scale.set(1, squashS, 1);
      body.rotation.x = THREE.MathUtils.lerp(body.rotation.x,
        tiltX + (opts.accel || 0) * 0.18 + speedNorm * 0.1, 1 - Math.exp(-12 * dt));
      body.rotation.z = THREE.MathUtils.lerp(body.rotation.z,
        leanZ - (opts.turn || 0) * 0.2, 1 - Math.exp(-12 * dt));
      ring.material.opacity = 0.35 + speedNorm * 0.3;
      // decay pose intents so un-posed frames return to neutral (dt-correct:
      // 0.85 per 60Hz-frame equivalent, same feel at any refresh rate)
      const d = Math.pow(0.85, dt * 60);
      tiltX *= d; leanZ *= d; lift *= d; squash = 1 + (squash - 1) * d;
    },
    clearOverlay() { setPose(0, 0, 0, 1); liftS = 0; squashS = 1; },
    dispose() {
      g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    },

    // pose vocabulary — same names as the human rigs, expressed as blob body language
    poseKick(k)            { setPose(-0.55 * Math.sin(k * Math.PI), 0); },
    poseHeader(k)          { setPose(-0.2, 0, Math.sin(k * Math.PI) * 0.55); },
    poseThrowIn(k)         { setPose(0.45 - k * 0.9, 0, 0.1); },
    poseDive(side, k)      { setPose(0, side * 1.25 * k, -0.35 * k, 1 - k * 0.2); },
    poseFall(k)            { setPose(1.35 * k, 0, -0.6 * k); },
    poseGetUp(k)           { setPose(1.35 * (1 - k), 0, -0.6 * (1 - k)); },
    poseCelebrate(t)       { setPose(0, Math.sin(t * 5) * 0.15, Math.abs(Math.sin(t * 6)) * 0.35); },
    poseSkill(move, k)     { setPose(0, Math.sin(k * Math.PI) * 0.6); },
    poseArgue(t)           { setPose(0.25 + Math.sin(t * 7) * 0.12, 0); },
    poseShield(k, side)    { setPose(0.15, (side || 1) * 0.3, -0.1, 0.92); },
    poseSlideTackle(k)     { setPose(1.0 * Math.min(k * 1.6, 1), 0, -0.45 * Math.min(k * 1.6, 1)); },
    poseJockey(t, side)    { setPose(0.2, Math.sin(t * 4) * 0.18 * (side || 1), -0.12, 0.94); },
    poseGKSet(t)           { setPose(0.22, 0, -0.15 + Math.sin(t * 3) * 0.02, 0.93); },
    poseGKCatch(k)         { setPose(-0.25, 0, 0.05, 0.95); },
    poseGKPunch(k)         { setPose(-0.4 * Math.sin(k * Math.PI), 0, 0.3 * Math.sin(k * Math.PI)); },
    poseLimp(t)            { setPose(0.18, Math.sin(t * 5) * 0.22, -0.08); },
    poseTrudge(t)          { setPose(0.35, 0, -0.1); },
    poseExhausted(t)       { setPose(0.5, 0, -0.25 + Math.sin(t * 2.5) * 0.03); },
    poseKneeSlide(k)       { setPose(-0.5, 0, -0.4 * k); },
    posePointToSpot(t)     { setPose(0.35, 0.2); },
    poseWhistle(t)         { setPose(-0.15, 0); },
  };
  return api;
}
