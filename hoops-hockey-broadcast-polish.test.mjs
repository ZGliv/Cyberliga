import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hoops = readFileSync(new URL('./hoops.html', import.meta.url), 'utf8');
const hockey = readFileSync(new URL('./hockey.html', import.meta.url), 'utf8');

test('basketball exposes authored player tendencies and physical possession outcomes', () => {
  assert.match(hoops, /const HOOPS_TENDENCY_VARIANTS=/);
  assert.match(hoops, /function deflectPass\(defender,victim\)/);
  assert.match(hoops, /function resolveLooseBall\(\)/);
  assert.match(hoops, /function commitCharge\(defender,driver\)/);
  assert.match(hoops, /signature:p\.tendency\.label/);
  assert.match(hoops, /deflections:t\.deflections,looseBalls:t\.looseBalls,chargesDrawn:t\.chargesDrawn/);
});

test('basketball compact HUD keeps both club codes and game plan inside safe edges', () => {
  assert.match(hoops, /class="tc" id="codeA"/);
  assert.match(hoops, /class="tc" id="codeB"/);
  assert.match(hoops, /grid-template-columns:minmax\(0, 1fr\) auto minmax\(0, 1fr\)/);
  assert.match(hoops, /#gameplan \{[\s\S]*left:max\(10px,[\s\S]*right:max\(10px,/);
  assert.match(hoops, /display:grid; grid-template-columns:auto minmax\(0,1fr\) minmax\(0,1fr\)/);
});

test('hockey exposes stable role signatures and differentiates battles from body checks', () => {
  assert.match(hockey, /const ICE_TENDENCY_VARIANTS=/);
  assert.match(hockey, /function resolvePuckBattle\(carrier,challenger,nearBoards,forced=false\)/);
  assert.match(hockey, /const commits=forcedMajorCheck\|\|rnd\(\)</);
  assert.match(hockey, /boardBattles:S\.boardBattles\[0\]/);
  assert.match(hockey, /stickLifts:S\.stickLifts\[0\]/);
  assert.match(hockey, /signature:p\.tendency\.label/);
});

test('hockey compact HUD bounds score, situation, and event strips across mobile range', () => {
  assert.match(hockey, /@media \(max-width:700px\)/);
  assert.match(hockey, /grid-template-columns:minmax\(0, 1fr\) auto minmax\(0, 1fr\)/);
  assert.match(hockey, /#playstatus \{[\s\S]*grid-column:1 \/ -1/);
  assert.match(hockey, /#eventbug \{[\s\S]*left:max\(12px,[\s\S]*right:max\(12px,/);
});

test('owned arenas certify moments as live footage rather than inventing replays', () => {
  assert.match(hoops, /recordedFootage:false/);
  assert.match(hockey, /recordedFootage:false/);
  assert.doesNotMatch(hoops, /recordedFootage:true/);
  assert.doesNotMatch(hockey, /recordedFootage:true/);
});
