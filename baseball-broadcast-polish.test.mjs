import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BASEBALL_BROADCAST_POLISH_VERSION,
  BASEBALL_PACING,
  baseballIdentityHash,
  baseballResultPresentation,
  createBaseballMatchupRead,
  createBaseballPlayerProfile,
  validateBaseballPlayerProfile,
} from './baseball-broadcast-polish.js';

const ace = {
  id: 'mexico-city-alebrijes-a1',
  name: 'Coyote Pez',
  role: 'Ace',
  archetype: 'mound-side illusionist',
  temperament: 'patient until the room blinks',
  signature: 'changes speed without changing intent',
};
const slugger = {
  id: 'havana-sugar-kings-a4',
  name: 'Dulce Leo',
  role: 'Slugger',
  archetype: 'one-swing weather event',
  temperament: 'bold under pressure',
  signature: 'leaves dents in the evening',
};

test('version and identity hash are stable', () => {
  assert.match(BASEBALL_BROADCAST_POLISH_VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(baseballIdentityHash('Coyote Pez'), baseballIdentityHash('Coyote Pez'));
  assert.notEqual(baseballIdentityHash('Coyote Pez'), baseballIdentityHash('Dulce Leo'));
});

test('player profiles are deterministic, bounded, and authored from identity', () => {
  const first = createBaseballPlayerProfile(ace, {
    position: 'P',
    teamMotion: 'many-animal stances and zigzag baserunning',
    motionName: 'The Vanishing Tempo',
  });
  const second = createBaseballPlayerProfile(ace, {
    position: 'P',
    teamMotion: 'many-animal stances and zigzag baserunning',
    motionName: 'The Vanishing Tempo',
  });
  const hitter = createBaseballPlayerProfile(slugger, { position: '2B', motionName: 'The Caramel Snap' });
  assert.deepEqual(first, second);
  assert.ok(validateBaseballPlayerProfile(first));
  assert.ok(validateBaseballPlayerProfile(hitter));
  assert.equal(first.pitcherStyle, 'illusionist');
  assert.equal(hitter.hitterStyle, 'thunder');
  assert.notDeepEqual(first.batting, hitter.batting);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.batting));
});

test('matchup read changes with count without mutating player identity', () => {
  const pitcher = createBaseballPlayerProfile(ace, { position: 'P' });
  const batter = createBaseballPlayerProfile(slugger, { position: '2B' });
  const ahead = createBaseballMatchupRead(pitcher, batter, { balls: 0, strikes: 2, runners: 0 });
  const behind = createBaseballMatchupRead(pitcher, batter, { balls: 3, strikes: 0, runners: 2, leverage: 0.9 });
  assert.ok(ahead.edge > behind.edge);
  assert.equal(behind.pressure, 'HIGH-LEVERAGE');
  assert.match(ahead.headline, / vs /);
  assert.match(ahead.detail, / · /);
});

test('result grammar reserves full-screen treatment for genuine signature beats', () => {
  const single = baseballResultPresentation('SINGLE', { homeBatting: true });
  const homer = baseballResultPresentation('HOME RUN', { homeBatting: false, runs: 3 });
  const robbery = baseballResultPresentation('WALL ROBBERY', { homeBatting: true });
  assert.equal(single.compact, true);
  assert.equal(single.tier, 'standard');
  assert.equal(single.crowdMode, 'APPRECIATION');
  assert.equal(homer.compact, false);
  assert.equal(homer.tier, 'signature');
  assert.equal(homer.crowdMode, 'AWAY_POCKET');
  assert.equal(robbery.crowdMode, 'HOME_ROAR');
  assert.ok(homer.holdSeconds > single.holdSeconds);
});

test('pacing removes routine dead time while preserving the finale hold', () => {
  assert.ok(BASEBALL_PACING.setup < 1.65);
  assert.ok(BASEBALL_PACING.windup < 1.38);
  assert.ok(BASEBALL_PACING.postplay < 1.55);
  assert.ok(BASEBALL_PACING.batterChangeMax < 3.35);
  assert.equal(BASEBALL_PACING.final, 12);
  assert.ok(Object.values(BASEBALL_PACING).every(Number.isFinite));
});
