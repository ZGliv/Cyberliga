import test from 'node:test';
import assert from 'node:assert/strict';

// Geometry and world matrices are real Three.js. Only lettering/shadow canvas
// painting is stubbed; no WebGL renderer is needed to test contact continuity.
globalThis.document = { createElement: () => ({ getContext: () => ({
  fillText() {}, fillRect() {}, createRadialGradient: () => ({ addColorStop() {} }),
}) }) };
const THREE = await import('../../../vendor/three/three.module.js');
const { ROSTER, DURATION, sampleStudy } = await import('../timeline.js');
const { createAthlete, buildFootTracks, poseAthlete, athleteMetrics } = await import('../athletes.js');
const scene = new THREE.Scene();
const rigs = ROSTER.map(player => createAthlete(player, scene));
const tracks = buildFootTracks(sampleStudy, ROSTER, DURATION);
const hz = 120;
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const pose = time => {
  const state = sampleStudy(time);
  const players = rigs.map((rig, i) => {
    poseAthlete(rig, state.players[i], state, tracks.at(state.time, i));
    return athleteMetrics(rig);
  });
  return { time, state, players };
};
const rows = Array.from({ length: DURATION * hz }, (_, i) => pose(i / hz));
function worstStep(joints, stride = 1, from = .3, to = 19) {
  let worst = { distance: 0 };
  for (let i = stride; i < rows.length; i++) {
    const current = rows[i], previous = rows[i - stride];
    if (current.time < from || current.time > to || previous.state.fade > .2) continue;
    current.players.forEach((player, index) => {
      for (const joint of joints) {
        const d = distance(player[joint], previous.players[index][joint]);
        if (d > worst.distance) worst = { distance: d, time: current.time, player: player.id, joint };
      }
    });
  }
  return worst;
}
const feet = ['leftFoot', 'rightFoot'];
const hands = ['leftHand', 'rightHand'];
const elbows = ['leftElbow', 'rightElbow'];

test('the complete foot flight and landing remain continuous at 60 Hz', t => {
  // The original contest landing snapped Toll's right foot 0.941 m in 1/120 s.
  const worst = worstStep(feet, 2);
  assert.ok(worst.distance < .15, JSON.stringify(worst));
  for (const row of rows) for (const p of row.players) {
    assert.ok(p.leftSole > -.01 && p.rightSole > -.01, `Floor penetration: ${row.time}, ${p.id}`);
  }
  t.diagnostic(JSON.stringify(worst));
});

test('screen, gather, celebration, and jump keep hand/elbow paths continuous', t => {
  // Original discrete screen/celebrate targets jumped 0.26–0.28 m. The old
  // gather elbow pole flipped 0.390 m although its palm moved only ~0.04 m.
  const worst = worstStep([...hands, ...elbows]);
  assert.ok(worst.distance < .12, JSON.stringify(worst));
  const screen = worstStep(hands, 1, 3.45, 3.55);
  const gather = worstStep(elbows, 1, 11.35, 11.50);
  const celebration = worstStep(hands, 1, 16.75, 16.85);
  // Dense samples distinguish a fast but smooth gather from the prior target
  // toggles/pole flip; normal velocity should shrink with the sample interval.
  for (const [from, to] of [[3.45, 3.55], [11.35, 11.50], [16.75, 16.85]]) {
    let previous = pose(from);
    for (let ms = 1; ms <= Math.round((to - from) * 1000); ms++) {
      const current = pose(from + ms / 1000);
      current.players.forEach((player, index) => {
        for (const joint of [...hands, ...elbows]) {
          const d = distance(player[joint], previous.players[index][joint]);
          assert.ok(d < .025, `1 ms discontinuity: ${current.time}, ${player.id}, ${joint}, ${d}`);
        }
      });
      previous = current;
    }
  }
  t.diagnostic(JSON.stringify({ worst, screen, gather, celebration }));
});

test('every declared palm contact reaches the actual ball surface', t => {
  // A palm sits on the surface of the 0.123 m radius ball, not its centre.
  let worst = { error: 0 }, count = 0;
  for (const row of rows) {
    const contact = row.state.ball.contact;
    if (!contact) continue;
    const player = row.players.find(p => p.id === contact.playerId);
    const active = contact.hand === 'left' ? ['leftHand'] : contact.hand === 'right' ? ['rightHand'] : hands;
    for (const hand of active) {
      const centreDistance = distance(player[hand], row.state.ball.position);
      const error = Math.abs(centreDistance - .123);
      if (error > worst.error) worst = { error, centreDistance, time: row.time, player: player.id, hand, kind: contact.kind };
      assert.ok(player.contactError < .02, `IK reach: ${row.time}, ${player.id}, ${player.contactError}`);
      count++;
    }
  }
  assert.ok(count > 100, `Declared contacts unexpectedly absent (${count})`);
  assert.ok(worst.error < .02, JSON.stringify(worst));
  t.diagnostic(JSON.stringify({ count, worst }));
});

test('actual poses are independent of display rate and seek order', () => {
  const target = 12.4;
  const expected = pose(target).players;
  for (const rate of [30, 60, 120]) {
    for (let i = 0; i <= Math.round(target * rate); i++) pose(i / rate);
    assert.deepEqual(pose(target).players, expected, `${rate} Hz history changes the catch pose`);
  }
  for (const time of [17, 3.5, 12.7, 0, 11.4]) pose(time);
  assert.deepEqual(pose(target).players, expected, 'Out-of-order seeking changes the catch pose');
});

if (process.env.RIG_DIAGNOSTICS) {
  const { writeFile } = await import('node:fs/promises');
  const summary = {
    hz, duration: DURATION, sampleCount: rows.length,
    maxima120Hz: Object.fromEntries([...feet, ...hands, ...elbows, 'leftKnee', 'rightKnee', 'head'].map(joint => [joint, worstStep([joint])])),
    maxima60Hz: Object.fromEntries([...feet, ...hands, ...elbows, 'leftKnee', 'rightKnee', 'head'].map(joint => [joint, worstStep([joint], 2)])),
    unsupportedGroundedPoses: rows.flatMap(row => row.players.filter(p => row.state.players.find(s => s.id === p.id).jump < .01 && Math.min(p.leftSole, p.rightSole) > .08).map(p => ({ time: row.time, player: p.id, leftSole: p.leftSole, rightSole: p.rightSole }))),
  };
  await writeFile(process.env.RIG_DIAGNOSTICS, JSON.stringify(summary, null, 2));
}
