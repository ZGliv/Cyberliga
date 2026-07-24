import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

import {
  CLASSIC_CHARACTER_VERSION,
  classicIdentityHash,
  classicRoleArchetype,
  createClassicCharacterProfile,
  validateClassicCharacterProfile,
} from './classic-character.js';

const stoopy = {
  id: 'new-york-brownstones-a1',
  name: 'Stoopy',
  role: 'Rim Keeper',
  archetype: 'paint-dwelling weather system',
  temperament: 'patient until the room blinks',
  signature: 'makes the rim feel smaller',
};
const brownstones = {
  id: 'new-york-brownstones',
  motion: 'stair-step crossovers and squared landings',
};
const founding = {
  bodyKey: 'stoop',
  motionName: 'The Stoop Drop',
};

test('identity hash and performance profile are deterministic', () => {
  assert.equal(classicIdentityHash('Stoopy'), classicIdentityHash('Stoopy'));
  const first = createClassicCharacterProfile({ athlete: stoopy, team: brownstones, founding });
  const second = createClassicCharacterProfile({ athlete: { ...stoopy }, team: { ...brownstones }, founding: { ...founding } });
  assert.deepEqual(first, second);
  assert.equal(first.version, CLASSIC_CHARACTER_VERSION);
  assert.equal(first.motionName, 'The Stoop Drop');
  assert.equal(first.foundingBody, 'stoop');
  assert.equal(first.archetype, 'anchor');
  assert.ok(Object.isFrozen(first));
  assert.ok(validateClassicCharacterProfile(first));
});

test('different authored identities receive different motion fingerprints', () => {
  const anchor = createClassicCharacterProfile({ athlete: stoopy, team: brownstones, founding });
  const spark = createClassicCharacterProfile({
    athlete: {
      id: 'bangkok-banana-leaf-a4',
      name: 'Sticky Rice',
      role: 'Swarmer',
      archetype: 'pocket-sized bad weather',
      temperament: 'restless, curious, impossible to shame',
      signature: 'throws in bunches and exits laughing',
    },
    team: { id: 'bangkok-banana-leaf', motion: 'swaying slips and whipping green counters' },
    founding: { bodyKey: 'rice', motionName: 'The Six-Punch Fold' },
  });
  assert.notDeepEqual(anchor, spark);
  assert.equal(spark.archetype, 'spark');
  assert.ok(spark.strideRate > anchor.strideRate);
  assert.ok(spark.sway > anchor.sway);
  assert.ok(anchor.plant > spark.plant);
});

test('role classification spans the six-sport cast vocabulary', () => {
  assert.equal(classicRoleArchetype('Goaltender'), 'anchor');
  assert.equal(classicRoleArchetype('Defensive Tackle'), 'power');
  assert.equal(classicRoleArchetype('Winger'), 'glider');
  assert.equal(classicRoleArchetype('Shooter'), 'glider');
  assert.equal(classicRoleArchetype('Center', 'faceoff locksmith'), 'craft');
  assert.equal(classicRoleArchetype('Quarterback'), 'craft');
  assert.equal(classicRoleArchetype('Sixth Spark'), 'spark');
  assert.equal(classicRoleArchetype('Utility'), 'balanced');
});

test('profiles remain finite and inside the renderer safety envelope', () => {
  const roles = [
    'Keeper', 'Striker', 'Quarterback', 'Running Back', 'Rim Keeper', 'Shooter',
    'Goaltender', 'Pest', 'Ace', 'Slugger', 'Heavy', 'Showboat',
  ];
  for (let index = 0; index < 256; index += 1) {
    const role = roles[index % roles.length];
    const profile = createClassicCharacterProfile({
      athlete: {
        id: `athlete-${index}`,
        name: `Athlete ${index}`,
        role,
        archetype: `${role} authored archetype ${index}`,
        temperament: `temperament ${index % 12}`,
        signature: `signature ${index % 6}`,
      },
      team: { id: `team-${index % 48}`, motion: `motion language ${index % 8}` },
    });
    assert.ok(validateClassicCharacterProfile(profile), `invalid profile ${index}`);
    assert.equal(JSON.stringify(profile).includes('NaN'), false);
    assert.equal(JSON.stringify(profile).includes('Infinity'), false);
  }
});

test('all 416 canonical athletes receive stable, valid, non-uniform profiles', async () => {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(await readFile(new URL('./worlddata.js', import.meta.url), 'utf8'), context);
  const content = context.window.CYBERLIGA_CONTENT;
  assert.equal(content.metrics.athletes, 416);

  const fingerprints = new Set();
  for (const sport of content.sports) {
    for (const team of sport.teams) {
      for (const athlete of team.athletes) {
        const first = createClassicCharacterProfile({ athlete, team, role: athlete.role });
        const second = createClassicCharacterProfile({ athlete, team, role: athlete.role });
        assert.ok(validateClassicCharacterProfile(first), athlete.id);
        assert.deepEqual(first, second, athlete.id);
        fingerprints.add([
          first.archetype,
          first.strideRate.toFixed(5),
          first.bounce.toFixed(5),
          first.plant.toFixed(5),
          first.sway.toFixed(5),
          first.width.toFixed(5),
          first.stature.toFixed(5),
          first.celebrationVariant,
        ].join('|'));
      }
    }
  }
  assert.equal(fingerprints.size, 416);
});

test('the canonical Founding 12 retain their named live-motion fingerprints', async () => {
  const context = { window: {} };
  context.globalThis = context.window;
  vm.createContext(context);
  vm.runInContext(await readFile(new URL('./worlddata.js', import.meta.url), 'utf8'), context);
  vm.runInContext(await readFile(new URL('./characterdata.js', import.meta.url), 'utf8'), context);
  const content = context.window.CYBERLIGA_CONTENT;
  const characters = context.window.CyberligaCharacters;
  assert.equal(characters.records.length, 12);

  const bodies = new Set();
  const motions = new Set();
  for (const record of characters.records) {
    const team = content.getTeam(record.teamId, record.sportId);
    const athlete = content.getAthlete(record.teamId, record.id);
    const profile = createClassicCharacterProfile({
      athlete,
      team,
      role: athlete.role,
      founding: { bodyKey: record.body, motionName: record.motionName },
    });
    assert.ok(validateClassicCharacterProfile(profile), record.id);
    assert.equal(profile.foundingBody, record.body);
    assert.equal(profile.motionName, record.motionName);
    bodies.add(profile.foundingBody);
    motions.add(profile.motionName);
  }
  assert.equal(bodies.size, 12);
  assert.equal(motions.size, 12);
});
