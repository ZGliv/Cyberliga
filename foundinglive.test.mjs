import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

globalThis.window = globalThis;
delete globalThis.CYBERLIGA_CONTENT;
delete globalThis.CyberligaCharacters;
delete globalThis.CyberligaFoundingVisual;
delete globalThis.CyberligaFoundingLive;
await import('./worlddata.js?founding-live-tests');
await import('./characterdata.js?founding-live-tests');
await import('./foundingvisual.js?founding-live-tests');
await import('./foundinglive.js?founding-live-tests');

const Content = globalThis.CYBERLIGA_CONTENT;
const Characters = globalThis.CyberligaCharacters;
const Visual = globalThis.CyberligaFoundingVisual;
const Live = globalThis.CyberligaFoundingLive;

function sourceTuple(record) {
  const team = Content.getTeam(record.teamId, record.sportId);
  const athlete = Content.getAthlete(record.teamId, record.id);
  return { record, team, athlete };
}

test('exports a frozen, valid twelve-body live cue catalogue', () => {
  assert.ok(Live);
  assert.equal(Live.version, '1.0.0');
  assert.ok(Object.isFrozen(Live));
  assert.ok(Object.isFrozen(Live.bodyKeys));
  assert.ok(Object.isFrozen(Live.recipes));
  assert.equal(Live.bodyKeys.length, 12);
  assert.equal(Live.recipes.length, 12);
  assert.deepEqual(Live.recipes.map((item) => item.bodyKey), Live.bodyKeys);
  Live.recipes.forEach((item) => assert.ok(Object.isFrozen(item)));
  assert.deepEqual(Live.validate(), {
    valid: true,
    errors: [],
    bodyCount: 12,
    maxCues: 3,
    maxTrianglesPerCue: 32,
    maxTrianglesPerAthlete: 96
  });
});

test('strictly prepares every canonical Founder with the shared identity key', () => {
  const prepared = Characters.records.map((record) => {
    const { athlete, team } = sourceTuple(record);
    const descriptor = Live.prepare(athlete, team);
    const state = Live.describe(descriptor);
    assert.ok(descriptor, record.id);
    assert.ok(Object.isFrozen(descriptor));
    assert.ok(Object.isFrozen(state));
    assert.equal(state.mode, 'founding-live-cue');
    assert.equal(state.athleteId, record.id);
    assert.equal(state.teamId, record.teamId);
    assert.equal(state.sportId, record.sportId);
    assert.equal(state.bodyKey, record.body);
    assert.equal(state.motionName, record.motionName);
    assert.equal(state.identityKey, `founding-vector@${Visual.version}/${record.id}/${record.body}`);
    assert.equal(state.cueCount, 3);
    assert.equal(state.triangleCount, Live.recipeTriangles(Live.recipeFor(descriptor)));
    return state;
  });
  assert.equal(new Set(prepared.map((state) => state.identityKey)).size, 12);
});

test('rejects generic, cloned, cross-team, and forged inputs', () => {
  const { athlete, team } = sourceTuple(Characters.records[0]);
  const generic = team.athletes.find((candidate) => !Characters.get(candidate.id));
  const wrongTeam = Content.getTeams('soccer').find((candidate) => candidate.id !== team.id);
  const clonedTeam = { ...team, athletes: team.athletes };
  const forgedTeam = { ...team, athletes: [athlete], colors: { ...team.colors } };
  const forgedContent = { getTeam: () => clonedTeam, getAthlete: () => athlete };
  const forgedCharacters = { get: () => Characters.get(athlete.id) };
  const forgedVisual = { prepare: () => ({}), describe: () => ({ athleteId: athlete.id, teamId: team.id, sportId: team.sportId }) };
  assert.equal(Live.prepare(generic, team), null);
  assert.equal(Live.prepare({ ...athlete }, team), null);
  assert.equal(Live.prepare(athlete, clonedTeam), null);
  assert.equal(Live.prepare(athlete, forgedTeam), null);
  assert.equal(Live.prepare(athlete, wrongTeam), null);
  assert.equal(Live.prepare(athlete, clonedTeam, forgedContent, forgedCharacters, forgedVisual), null);
  assert.equal(Live.prepare(null, team), null);
  assert.equal(Live.describe({ athleteId: athlete.id }), null);
  assert.equal(Live.recipeFor({ athleteId: athlete.id }), null);
});

test('recipes stay rear-mounted, body-attached, low-poly, and prop-safe', () => {
  for (const item of Live.recipes) {
    assert.ok(item.cues.length >= 1 && item.cues.length <= 3, item.bodyKey);
    let total = 0;
    for (const entry of item.cues) {
      assert.match(entry.anchor, /^(body|head)$/);
      assert.doesNotMatch(entry.id, /ball|puck|stick|bat|glove|hand|rod|disc|sphere/i);
      const triangles = Live.cueTriangles(entry);
      assert.ok(triangles > 0 && triangles <= 32, `${item.bodyKey}/${entry.id}`);
      total += triangles;
      for (const solid of entry.solids) {
        assert.ok(solid.z <= -.21 && solid.z >= -.55, `${item.bodyKey}/${entry.id}/z`);
        assert.ok(solid.depth > 0 && solid.depth <= .12, `${item.bodyKey}/${entry.id}/depth`);
        assert.ok(solid.points.length >= 3);
        let direction = 0;
        for (let index = 0; index < solid.points.length; index += 1) {
          const a = solid.points[index];
          const b = solid.points[(index + 1) % solid.points.length];
          const c = solid.points[(index + 2) % solid.points.length];
          const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
          if (Math.abs(cross) < 1e-9) continue;
          const sign = cross > 0 ? 1 : -1;
          assert.ok(!direction || direction === sign, `${item.bodyKey}/${entry.id}/convex`);
          direction = sign;
        }
        assert.notEqual(direction, 0, `${item.bodyKey}/${entry.id}/area`);
        for (const point of solid.points) {
          assert.ok(Math.abs(point[0]) <= .60);
          assert.ok(point[1] >= (entry.anchor === 'head' ? -.32 : -.85));
          assert.ok(point[1] <= (entry.anchor === 'head' ? .36 : .90));
        }
      }
    }
    assert.equal(total, Live.recipeTriangles(item));
    assert.ok(total <= 96, item.bodyKey);
  }
});

test('two exact Founders remain assigned to every sport', () => {
  const counts = Object.fromEntries(Content.sports.map((sport) => [sport.id, 0]));
  Characters.records.forEach((record) => { counts[record.sportId] += 1; });
  assert.deepEqual(counts, {
    soccer: 2,
    basketball: 2,
    hockey: 2,
    baseball: 2,
    combat: 2,
    'american-football': 2
  });
});

test('preparation is deterministic and never mutates canon inputs', () => {
  const { athlete, team } = sourceTuple(Characters.records[10]);
  const athleteBefore = JSON.stringify(athlete);
  const teamBefore = JSON.stringify(team);
  const first = Live.describe(Live.prepare(athlete, team));
  const second = Live.describe(Live.prepare(athlete, team));
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(athlete), athleteBefore);
  assert.equal(JSON.stringify(team), teamBefore);
});

test('live cue data has no environment, clock, network, or randomness dependency', async () => {
  const source = await readFile(new URL('./foundinglive.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bMath\.random\b/);
  assert.doesNotMatch(source, /\b(?:document|location|localStorage|sessionStorage|fetch|XMLHttpRequest|requestAnimationFrame|performance|Date)\b/);
});
