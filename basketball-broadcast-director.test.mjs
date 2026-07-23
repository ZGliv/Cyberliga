import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

delete globalThis.CyberligaBasketballVisualReset;
delete globalThis.CyberligaBasketballBroadcastDirector;
await import('./basketball-visual-reset.js?basketball-broadcast-director-source-tests');
await import('./basketball-broadcast-director.js?basketball-broadcast-director-tests');

const VisualReset = globalThis.CyberligaBasketballVisualReset;
const Director = globalThis.CyberligaBasketballBroadcastDirector;
const source = await readFile(new URL('./basketball-broadcast-director.js', import.meta.url), 'utf8');

const HOME_TEAM_ID = 'new-york-brownstones';
const AWAY_TEAM_ID = 'toronto-lake-effect';
const STOOPY_ID = 'new-york-brownstones-a1';
const LINTEL_ID = 'new-york-brownstones-a2';
const MARNIE_ID = 'new-york-brownstones-a4';
const PARKA_ID = 'toronto-lake-effect-a2';
const TOQUE_ID = 'toronto-lake-effect-a4';
const ACTOR_IDS = [
  'new-york-brownstones-a1', 'new-york-brownstones-a2', 'new-york-brownstones-a3',
  'new-york-brownstones-a4', 'new-york-brownstones-a5', 'toronto-lake-effect-a1',
  'toronto-lake-effect-a2', 'toronto-lake-effect-a3', 'toronto-lake-effect-a4',
  'toronto-lake-effect-a5'
];

function actorAt(sample, id) {
  const actor = sample.actors.find(candidate => candidate.id === id);
  assert.ok(actor, `missing actor ${id}`);
  return actor;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function assertDeepFrozen(value, path = 'value', seen = new WeakSet()) {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return;
  if (seen.has(value)) return;
  seen.add(value);
  assert.ok(Object.isFrozen(value), `${path} must be frozen`);
  for (const key of Object.keys(value)) assertDeepFrozen(value[key], `${path}.${String(key)}`, seen);
}

function assertFiniteNumbers(value, path = 'value', seen = new WeakSet()) {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path} must be finite; received ${value}`);
    return;
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) assertFiniteNumbers(value[key], `${path}.${String(key)}`, seen);
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function assertScore(sample, home, away) {
  assert.equal(sample.score.home.points, home);
  assert.equal(sample.score.away.points, away);
}

function assertOffense(timeMs, offenseTeamId, rimX, possessionId) {
  const sample = Director.sample(timeMs);
  assert.equal(sample.broadcast.possession.id, possessionId);
  assert.equal(sample.broadcast.possession.offenseTeamId, offenseTeamId);
  assert.equal(sample.broadcast.possession.defenseTeamId,
    offenseTeamId === HOME_TEAM_ID ? AWAY_TEAM_ID : HOME_TEAM_ID);
  assert.equal(sample.broadcast.possession.attackingRim.x, rimX);
  assert.equal(sample.broadcast.attackingRim.x, rimX);
  assert.equal(sample.actors.filter(actor => actor.side === 'offense').length, 5);
  assert.equal(sample.actors.filter(actor => actor.side === 'defense').length, 5);
  for (const actor of sample.actors) {
    assert.equal(actor.side, actor.teamId === offenseTeamId ? 'offense' : 'defense');
  }
}

test('exports a pure UMD and Node-importable, deeply frozen deterministic API', () => {
  assert.ok(VisualReset);
  assert.ok(Director);
  assert.equal(Director.version, '1.0.0');
  assert.equal(Director.sourceTimelineVersion, VisualReset.version);
  assert.equal(Director.durationMs, 90000);
  assertDeepFrozen(Director, 'Director');
  assertDeepFrozen(Director.sample(36500), 'sample');

  const context = {
    module: { exports: {} }, exports: {},
    require(specifier) {
      assert.equal(specifier, './basketball-visual-reset.js');
      return VisualReset;
    }
  };
  vm.runInNewContext(source, context, { filename: 'basketball-broadcast-director.js' });
  assert.equal(context.module.exports.version, Director.version);
  assert.equal(context.module.exports.durationMs, Director.durationMs);
  assert.equal(JSON.stringify(context.module.exports.sample(73100)), JSON.stringify(Director.sample(73100)));

  for (const forbidden of [
    /Math\.random\s*\(/, /\bDate\b/, /\bperformance\b/,
    /\bdocument\s*\.\s*(?:querySelector|getElementById|createElement|body)\b/,
    /\bwindow\s*\.\s*(?:document|location|addEventListener|requestAnimationFrame)\b/,
    /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\blocalStorage\b/,
    /\bsessionStorage\b/, /\bsetTimeout\b/, /\bsetInterval\b/
  ]) assert.doesNotMatch(source, forbidden);
});

test('the 90-second show has eight explicit contiguous segments and five authored outcomes', () => {
  assert.deepEqual(Director.segments.map(segment => segment.id), [
    'segment-00-cold-open', 'segment-01-stoop-drop-live', 'segment-02-stoop-drop-replay',
    'segment-03-whiteout-answer', 'segment-04-switch-denial', 'segment-05-toque-block',
    'segment-06-stoopy-putback', 'segment-07-reset'
  ]);
  assert.deepEqual(Director.segments.map(segment => [segment.startMs, segment.endMs]), [
    [0, 6000], [6000, 21000], [21000, 29000], [29000, 42000],
    [42000, 53500], [53500, 65500], [65500, 84000], [84000, 90000]
  ]);
  Director.segments.forEach((segment, index) => {
    assert.equal(segment.index, index);
    if (index) assert.equal(segment.startMs, Director.segments[index - 1].endMs);
    assert.equal(Director.sample(segment.startMs).broadcast.segment.id, segment.id);
    assert.equal(Director.sample(segment.endMs - .001).broadcast.segment.id, segment.id);
  });
  assert.equal(Director.segments[0].startMs, 0);
  assert.equal(Director.segments.at(-1).endMs, Director.durationMs);

  assert.equal(Director.outcomes.length, 5);
  assert.deepEqual(Director.outcomes.map(outcome => outcome.type), [
    'made-dunk', 'made-three', 'live-ball-turnover', 'blocked-miss', 'offensive-rebound-putback'
  ]);
  assert.equal(new Set(Director.outcomes.map(outcome => outcome.id)).size, 5);
  Director.outcomes.forEach((outcome, index) => {
    assert.equal(outcome.sequence, index + 1);
    assert.ok(outcome.contactAtMs < outcome.certifiedAtMs);
    assert.ok(outcome.eventId);
    assert.ok(outcome.possessionId);
  });
});

test('all five outcomes certify only after their rendered contact and produce the exact score arc', () => {
  const cases = [
    { outcome: Director.outcomes[0], before: [18, 17], after: [20, 17], contact: state => state.contacts.rim.crossed },
    { outcome: Director.outcomes[1], before: [20, 17], after: [20, 20], contact: state => state.contacts.rim.crossed },
    { outcome: Director.outcomes[2], before: [20, 20], after: [20, 20], contact: state => state.contacts.turnover.occurred },
    { outcome: Director.outcomes[3], before: [20, 20], after: [20, 20], contact: state => state.contacts.block.occurred },
    { outcome: Director.outcomes[4], before: [20, 20], after: [22, 20], contact: state => state.contacts.rim.crossed }
  ];

  for (const { outcome, before, after, contact } of cases) {
    const beforeContact = Director.sample(outcome.contactAtMs - .001);
    const atContact = Director.sample(outcome.contactAtMs);
    const beforeCertification = Director.sample(outcome.certifiedAtMs - .001);
    const atCertification = Director.sample(outcome.certifiedAtMs);
    assert.equal(beforeContact.broadcast.outcome.id, outcome.id);
    assert.equal(beforeContact.broadcast.outcome.status, 'pending');
    assert.equal(beforeContact.score.certified, false);
    assert.equal(contact(beforeContact), false);
    assert.equal(contact(atContact), true, `${outcome.id} needs a physical contact frame`);
    assert.equal(atContact.broadcast.outcome.status, 'contacted');
    assert.equal(atContact.score.certified, false);
    assertScore(atContact, ...before);
    assert.equal(beforeCertification.broadcast.outcome.status, 'contacted');
    assert.equal(beforeCertification.score.certified, false);
    assertScore(beforeCertification, ...before);
    assert.equal(atCertification.broadcast.outcome.status, 'certified');
    assert.equal(atCertification.score.certified, true);
    assert.equal(atCertification.score.playPoints, outcome.points);
    assert.equal(atCertification.score.eventId, outcome.eventId);
    assertScore(atCertification, ...after);
  }

  assert.deepEqual([
    [Director.sample(0).score.home.points, Director.sample(0).score.away.points],
    [Director.sample(14500).score.home.points, Director.sample(14500).score.away.points],
    [Director.sample(36700).score.home.points, Director.sample(36700).score.away.points],
    [Director.sample(73300).score.home.points, Director.sample(73300).score.away.points]
  ], [[18, 17], [20, 17], [20, 20], [22, 20]]);
});

test('every frame carries exactly ten canonical actors and truthful offense/defense/rim identity', () => {
  assert.deepEqual(Director.actorIds, ACTOR_IDS);
  assert.equal(new Set(Director.actorIds).size, 10);
  for (const timeMs of [0, 5999, 6000, 14500, 21000, 28999, 29000, 36700, 42000, 48399, 48400, 53500, 65500, 73300, 84000, 89999]) {
    const sample = Director.sample(timeMs);
    assert.equal(sample.actors.length, 10);
    assert.deepEqual(sample.actors.map(actor => actor.id), ACTOR_IDS);
    assert.equal(new Set(sample.actors.map(actor => actor.id)).size, 10);
  }

  assertOffense(6000, HOME_TEAM_ID, 42, 'possession-01-stoop-drop');
  assertOffense(21000, HOME_TEAM_ID, 42, 'possession-01-stoop-drop');
  assertOffense(29000, AWAY_TEAM_ID, -42, 'possession-02-whiteout-answer');
  assertOffense(48399, HOME_TEAM_ID, 42, 'possession-03-switch-denial');
  assertOffense(48400, AWAY_TEAM_ID, -42, 'possession-03b-toronto-transition');
  assertOffense(53500, HOME_TEAM_ID, 42, 'possession-04-second-chance');
  assertOffense(65500, HOME_TEAM_ID, 42, 'possession-04-second-chance');
});

test('Stoop Drop remains a causal live play and certifies only after right-rim contact', () => {
  assert.deepEqual([
    Director.milestones.stoopScreenContactMs, Director.milestones.stoopPassReleaseMs,
    Director.milestones.stoopCatchMs, Director.milestones.stoopRimContactMs,
    Director.milestones.stoopScoreCertifiedMs, Director.milestones.stoopLandingMs
  ], [9000, 11000, 12100, 14350, 14500, 15100]);

  assert.equal(Director.sample(9000).contacts.screen.occurred, true);
  assert.equal(Director.sample(9000).contacts.screen.screenerId, STOOPY_ID);
  assert.equal(Director.sample(9000).contacts.screen.defenderId, PARKA_ID);
  assert.equal(Director.sample(11000).ball.state, 'pass-flight');
  assert.equal(Director.sample(11000).ball.ownerId, null);
  assert.equal(Director.sample(12100).ball.state, 'caught');
  assert.equal(Director.sample(12100).ball.ownerId, STOOPY_ID);

  const beforeContact = Director.sample(14349.999);
  const contact = Director.sample(14350);
  const beforeCertification = Director.sample(14499.999);
  const certification = Director.sample(14500);
  assert.equal(beforeContact.ball.ownerId, STOOPY_ID);
  assert.equal(contact.ball.state, 'rim-crossing');
  assert.equal(contact.ball.ownerId, null);
  assert.deepEqual(contact.ball.position, { x: 42, y: 0, z: 10 });
  assert.equal(contact.contacts.rim.crossed, true);
  assert.equal(contact.contacts.rim.atMs, 14350);
  assert.equal(contact.broadcast.outcome.status, 'contacted');
  assertScore(contact, 18, 17);
  assert.equal(contact.score.certified, false);
  assertScore(beforeCertification, 18, 17);
  assert.equal(beforeCertification.score.certified, false);
  assertScore(certification, 20, 17);
  assert.equal(certification.score.certified, true);
  assert.equal(certification.score.playPoints, 2);
  assert.equal(certification.score.eventId, 'visual-reset-stoop-drop-001');
  assert.equal(certification.broadcast.outcome.status, 'certified');
  assert.equal(certification.score.official, false);
  assert.equal(Director.sample(15100).contacts.landing.occurred, true);
});

test('the slow-motion replay re-renders only the prior recorded Stoop Drop', () => {
  for (let timeMs = 0; timeMs < Director.durationMs; timeMs += 250) {
    const sample = Director.sample(timeMs);
    const expected = timeMs >= 21000 && timeMs < 29000;
    assert.equal(sample.broadcast.replay.recordedFootage, expected, `recordedFootage at ${timeMs}`);
    assert.equal(sample.broadcast.replay.active, expected, `replay active at ${timeMs}`);
    assert.equal(sample.presentation.replay.active, expected, `presentation replay at ${timeMs}`);
  }

  const replayStart = Director.sample(21000);
  assert.equal(replayStart.broadcast.replay.sourceSegmentId, 'segment-01-stoop-drop-live');
  assert.equal(replayStart.broadcast.replay.sourceEventId, 'visual-reset-stoop-drop-001');
  assert.equal(replayStart.broadcast.replay.sourceStartMs, 4800);
  assert.equal(replayStart.broadcast.replay.sourceTimeMs, 4800);
  assert.equal(replayStart.broadcast.replay.playbackRate, .5375);
  assert.equal(replayStart.broadcast.replay.truthful, true);
  assert.equal(replayStart.broadcast.clock.running, false);
  assert.equal(replayStart.broadcast.clock.gameClockSeconds, 83);
  assert.equal(Director.sample(28999).broadcast.clock.gameClockSeconds, 83);
  assertScore(replayStart, 20, 17);
  assert.equal(replayStart.score.certified, true);

  const replayRimTime = 21000 + (8350 - 4800) / .5375;
  const replayRim = Director.sample(replayRimTime);
  const originalRim = Director.sample(14350);
  assert.equal(replayRim.broadcast.replay.sourceTimeMs, 8350);
  assert.equal(replayRim.ball.state, 'rim-crossing');
  assert.deepEqual(replayRim.ball, originalRim.ball);
  assert.deepEqual(replayRim.actors, originalRim.actors);
  assert.deepEqual(replayRim.contacts, originalRim.contacts);
  assert.equal(replayRim.broadcast.outcome.status, 'replayed');
  assert.equal(replayRim.presentation.replay.label, 'REPLAY · RECORDED PLAY');
  assert.equal(Director.sample(replayRimTime + 80).presentation.rimResponse > 0, true);
  assert.equal(Director.sample(29000).broadcast.replay.recordedFootage, false);
});

test('Whiteout answers at the left rim and the board waits for certification', () => {
  const pass = Director.sample(32500);
  const catchState = Director.sample(33500);
  const release = Director.sample(34600);
  const contact = Director.sample(36500);
  const beforeCertification = Director.sample(36699.999);
  const certification = Director.sample(36700);

  assert.equal(pass.ball.state, 'pass-flight');
  assert.equal(pass.ball.ownerId, null);
  assert.equal(catchState.ball.state, 'caught');
  assert.equal(catchState.ball.ownerId, TOQUE_ID);
  assert.equal(catchState.contacts.catch.receiverId, TOQUE_ID);
  assert.equal(release.ball.state, 'shot-flight');
  assert.equal(release.contacts.shot.released, true);
  assert.equal(contact.ball.state, 'rim-crossing');
  assert.deepEqual(contact.ball.position, { x: -42, y: 0, z: 10 });
  assert.deepEqual(contact.contacts.rim.point, { x: -42, y: 0, z: 10 });
  assert.equal(contact.contacts.rim.crossed, true);
  assert.equal(contact.broadcast.outcome.status, 'contacted');
  assertScore(contact, 20, 17);
  assert.equal(contact.score.certified, false);
  assertScore(beforeCertification, 20, 17);
  assertScore(certification, 20, 20);
  assert.equal(certification.score.certified, true);
  assert.equal(certification.score.playPoints, 3);
  assert.equal(certification.broadcast.outcome.status, 'certified');
  assert.equal(actorAt(certification, TOQUE_ID).side, 'offense');
  assert.equal(Director.sample(37000).contacts.landing.occurred, true);
});

test('Toronto learns the switch, denies the lane, and earns a live-ball transition', () => {
  const start = Director.sample(42000);
  const screen = Director.sample(44500);
  const assignment = Director.sample(45200);
  const pass = Director.sample(47000);
  const deflection = Director.sample(48200);
  const beforeCertification = Director.sample(48399.999);
  const turnover = Director.sample(48400);

  assert.equal(start.score.certified, false);
  assert.equal(screen.contacts.screen.occurred, true);
  assert.equal(screen.contacts.screen.screenerId, STOOPY_ID);
  assert.equal(screen.contacts.screen.defenderId, PARKA_ID);
  assert.equal(actorAt(assignment, TOQUE_ID).pose.id, 'switch-denial');
  assert.equal(pass.ball.state, 'pass-flight');
  assert.equal(deflection.ball.state, 'deflected');
  assert.deepEqual(deflection.ball.position, actorAt(deflection, TOQUE_ID).anchors.rightHand);
  assert.equal(deflection.contacts.turnover.occurred, true);
  assert.equal(deflection.contacts.turnover.certified, false);
  assert.equal(deflection.broadcast.outcome.status, 'contacted');
  assert.equal(beforeCertification.broadcast.possession.id, 'possession-03-switch-denial');
  assert.equal(turnover.contacts.turnover.certified, true);
  assert.equal(turnover.broadcast.outcome.status, 'certified');
  assert.equal(turnover.broadcast.possession.id, 'possession-03b-toronto-transition');
  assert.equal(turnover.broadcast.possession.offenseTeamId, AWAY_TEAM_ID);
  assert.equal(turnover.broadcast.possession.attackingRim.x, -42);
  assert.equal(turnover.ball.ownerId, PARKA_ID);
  assert.equal(turnover.ball.state, 'turnover-control');
  assert.equal(turnover.score.certified, true);
  assert.equal(turnover.score.playPoints, 0);
  assertScore(turnover, 20, 20);
});

test('Toque blocks the shot, Stoopy owns the same-possession board, and the putback has consequence', () => {
  const release = Director.sample(58500);
  const block = Director.sample(60000);
  const blockCertification = Director.sample(60200);
  assert.equal(release.ball.state, 'shot-flight');
  assert.equal(release.contacts.shot.released, true);
  assert.equal(block.ball.state, 'blocked');
  assert.deepEqual(block.ball.position, actorAt(block, TOQUE_ID).anchors.rightHand);
  assert.equal(block.contacts.block.occurred, true);
  assert.equal(block.contacts.block.blockerId, TOQUE_ID);
  assert.equal(block.contacts.block.shooterId, MARNIE_ID);
  assert.equal(block.broadcast.outcome.status, 'contacted');
  assert.equal(blockCertification.contacts.block.certified, true);
  assert.equal(blockCertification.broadcast.outcome.status, 'certified');
  assert.equal(blockCertification.score.certified, true);
  assert.equal(blockCertification.score.playPoints, 0);
  assertScore(blockCertification, 20, 20);

  const blockEnd = Director.sample(65499.999);
  const putbackStart = Director.sample(65500);
  assert.equal(blockEnd.broadcast.possession.id, 'possession-04-second-chance');
  assert.equal(putbackStart.broadcast.possession.id, 'possession-04-second-chance');
  assert.ok(distance(blockEnd.ball.position, putbackStart.ball.position) < .001);
  for (const id of ACTOR_IDS) {
    assert.ok(distance(actorAt(blockEnd, id).position, actorAt(putbackStart, id).position) < .001,
      `${id} moved across the block/putback segment boundary`);
  }

  const beforeBoard = Director.sample(67499.999);
  const board = Director.sample(67500);
  assert.equal(beforeBoard.ball.state, 'rebound-flight');
  assert.equal(board.ball.state, 'offensive-rebound');
  assert.equal(board.ball.ownerId, STOOPY_ID);
  assert.equal(board.contacts.rebound.occurred, true);
  assert.equal(board.contacts.rebound.offensive, true);
  assert.deepEqual(board.broadcast.possession.shotClockReset,
    { atMs: 67500, toSeconds: 14, reason: 'offensive-rebound' });
  assert.equal(board.broadcast.clock.shotClockSeconds, 14);

  const takeoff = Director.sample(71500);
  const rim = Director.sample(73100);
  const beforeCertification = Director.sample(73299.999);
  const certification = Director.sample(73300);
  assert.equal(takeoff.ball.ownerId, STOOPY_ID);
  assert.equal(takeoff.ball.state, 'putback-control');
  assert.equal(actorAt(takeoff, STOOPY_ID).state.airborne, true);
  assert.equal(rim.ball.state, 'rim-crossing');
  assert.deepEqual(rim.ball.position, { x: 42, y: 0, z: 10 });
  assert.equal(rim.contacts.rim.crossed, true);
  assert.equal(rim.broadcast.outcome.status, 'contacted');
  assertScore(rim, 20, 20);
  assert.equal(rim.score.certified, false);
  assertScore(beforeCertification, 20, 20);
  assertScore(certification, 22, 20);
  assert.equal(certification.score.certified, true);
  assert.equal(certification.score.playPoints, 2);
  assert.equal(certification.broadcast.outcome.status, 'certified');

  const landing = Director.sample(74000);
  const baselineReady = Director.sample(74500);
  const oneMillisecondEarly = Director.sample(74959);
  const actualReady = Director.sample(74960);
  assert.equal(landing.contacts.landing.occurred, true);
  assert.equal(landing.consequence.active, true);
  assert.equal(landing.consequence.delayedByMs, 460);
  assert.equal(baselineReady.consequence.actualReadyAtMs - baselineReady.consequence.baselineReadyAtMs, 460);
  assert.equal(baselineReady.consequence.secondJumpRequested, true);
  assert.equal(baselineReady.consequence.secondJumpReady, false);
  assert.equal(actorAt(baselineReady, STOOPY_ID).state.secondJumpReady, false);
  assert.equal(oneMillisecondEarly.consequence.secondJumpReady, false);
  assert.equal(actualReady.consequence.secondJumpReady, true);
  assert.equal(actorAt(actualReady, STOOPY_ID).state.secondJumpReady, true);
  assert.equal(Director.sample(77500).presentation.lowerThird.visible, true);
});

test('broadcast metadata, normalized presentation, responsive camera contracts, and audio are renderer-ready', () => {
  const requiredBroadcastKeys = [
    'segment', 'possession', 'attackingRim', 'clock', 'outcome', 'replay', 'headline',
    'stakes', 'featuredActors', 'audio', 'autonomous', 'interaction'
  ];
  const requiredPresentationKeys = [
    'rimResponse', 'netResponse', 'crowdReaction', 'reactionOriginX',
    'lowerThird', 'replay', 'blackout'
  ];
  for (let timeMs = 0; timeMs < Director.durationMs; timeMs += 317) {
    const sample = Director.sample(timeMs);
    assert.deepEqual(Object.keys(sample.broadcast), requiredBroadcastKeys);
    assert.deepEqual(Object.keys(sample.presentation), requiredPresentationKeys);
    assert.equal(sample.broadcast.autonomous, true);
    assert.equal(sample.broadcast.interaction, 'view-only');
    assert.ok(sample.broadcast.headline.title);
    assert.ok(sample.broadcast.stakes.label);
    assert.equal(sample.broadcast.stakes.wagering, false);
    assert.ok(sample.broadcast.featuredActors.length >= 2);
    for (const key of ['rimResponse', 'netResponse', 'crowdReaction', 'reactionOriginX', 'blackout']) {
      assert.ok(sample.presentation[key] >= 0 && sample.presentation[key] <= 1,
        `${key} out of range at ${timeMs}`);
    }
    assert.ok(sample.camera.desktop);
    assert.ok(sample.camera.compactPortrait);
    assert.ok(sample.camera.socialPortrait);
    assert.ok(sample.camera.focus);
    assert.ok(Array.isArray(sample.camera.focus.targetIds));
    for (const profile of ['desktop', 'compactPortrait', 'socialPortrait']) {
      assertFiniteNumbers(sample.camera[profile], `camera.${profile}(${timeMs})`);
    }
  }

  const cueIds = Director.audioCues.map(cue => cue.id);
  assert.equal(cueIds.length, 36);
  assert.equal(new Set(cueIds).size, cueIds.length);
  assert.deepEqual(cueIds.slice(0, 6), [
    'broadcast-open', 'matchup-context', 'stoop-dribble-1', 'stoop-dribble-2',
    'stoop-dribble-3', 'stoop-dribble-4'
  ]);
  assert.deepEqual(cueIds.slice(-6), [
    'putback-rim', 'putback-score', 'putback-landing', 'final-card', 'reset-bed', 'loop-ready'
  ]);
  Director.audioCues.forEach((cue, index) => {
    if (index) assert.ok(cue.atMs > Director.audioCues[index - 1].atMs);
    assert.ok(cue.family);
    assert.ok(cue.cause);
    assert.ok(Director.sample(cue.atMs).broadcast.audio.activeCueIds.includes(cue.id));
    assert.ok(Director.sample(cue.atMs + 119).broadcast.audio.activeCueIds.includes(cue.id));
    assert.equal(Director.sample(cue.atMs + 120).broadcast.audio.activeCueIds.includes(cue.id), false);
  });
});

test('game and shot clocks freeze for presentation and reset only for possession causes', () => {
  assert.equal(Director.sample(0).broadcast.clock.gameClockSeconds, 98);
  assert.equal(Director.sample(5999).broadcast.clock.running, false);
  assert.equal(Director.sample(5999).broadcast.clock.gameClockSeconds, 98);
  assert.equal(Director.sample(6000).broadcast.clock.gameClockSeconds, 98);
  assert.equal(Director.sample(6000).broadcast.clock.running, true);
  assert.equal(Director.sample(20999).broadcast.clock.gameClockSeconds, 83.001);
  assert.equal(Director.sample(21000).broadcast.clock.gameClockSeconds, 83);
  assert.equal(Director.sample(28999).broadcast.clock.gameClockSeconds, 83);
  assert.equal(Director.sample(21000).broadcast.clock.shotClockSeconds, 9);
  assert.equal(Director.sample(28999).broadcast.clock.shotClockSeconds, 9);
  assert.equal(Director.sample(48400).broadcast.clock.shotClockSeconds, 24);
  assert.deepEqual(Director.sample(48400).broadcast.possession.shotClockReset,
    { atMs: 48400, toSeconds: 24, reason: 'live-ball-turnover' });
  assert.equal(Director.sample(67500).broadcast.clock.shotClockSeconds, 14);
  assert.equal(Director.sample(84000).broadcast.clock.gameClockSeconds, 28);
  assert.equal(Director.sample(89999).broadcast.clock.gameClockSeconds, 28);
  assert.equal(Director.sample(89999).broadcast.clock.running, false);

  for (let timeMs = 0; timeMs < Director.durationMs; timeMs += 137) {
    const clock = Director.sample(timeMs).broadcast.clock;
    assert.ok(clock.gameClockSeconds >= 0 && clock.gameClockSeconds <= 98);
    assert.ok(clock.shotClockSeconds >= 0 && clock.shotClockSeconds <= 24);
  }
});

test('reset certifies nothing, loops cleanly, and canonical samples are finite and byte-stable', () => {
  const reset = Director.sample(84000);
  const lastFrame = Director.sample(89999);
  assert.equal(reset.broadcast.segment.id, 'segment-07-reset');
  assert.equal(reset.broadcast.outcome.status, 'none');
  assert.equal(reset.score.certified, false);
  assert.equal(reset.score.eventId, null);
  assert.equal(reset.ball.visible, false);
  assertScore(reset, 22, 20);
  assertScore(lastFrame, 22, 20);

  const start = Director.sample(0);
  const loop = Director.sample(90000);
  assert.equal(loop.timeMs, 0);
  assert.equal(loop.loop, 1);
  assertScore(loop, 18, 17);
  const loopComparable = structuredClone(loop);
  const startComparable = structuredClone(start);
  delete loopComparable.loop;
  delete startComparable.loop;
  assert.deepEqual(loopComparable, startComparable);
  assert.equal(Director.sample(-1).timeMs, 89999);
  assert.equal(Director.sample(-1).loop, -1);
  assert.equal(Director.sample(Number.NaN).timeMs, 0);
  assert.equal(Director.sample(Number.POSITIVE_INFINITY).timeMs, 0);

  for (let timeMs = -90000; timeMs <= 180000; timeMs += 257) {
    const sample = Director.sample(timeMs);
    assertFiniteNumbers(sample, `sample(${timeMs})`);
    assert.equal(sample.actors.length, 10);
    assert.equal(new Set(sample.actors.map(actor => actor.id)).size, 10);
  }

  const sampleTimes = [
    0, 5999, 6000, 6300, 6600, 6900, 7200, 9000, 11000, 12100, 14349,
    14350, 14499, 14500, 15100, 16060, 20999, 21000, 27604.651, 28999,
    29000, 32500, 33500, 34600, 36499, 36500, 36699, 36700, 37000, 41999,
    42000, 44500, 45200, 47000, 48199, 48200, 48399, 48400, 53500, 58500,
    59999, 60000, 60199, 60200, 65499, 65500, 67499, 67500, 71500, 73099,
    73100, 73299, 73300, 74000, 74500, 74960, 77500, 83999, 84000, 89999
  ];
  const first = sampleTimes.map(timeMs => Director.sample(timeMs));
  const second = sampleTimes.map(timeMs => Director.sample(timeMs));
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(digest(first), '1c77f83eda17e3a8a33ba68cb3f10ec832dd4fb1e1d593e9d57703e6a8b22251');
});
