import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  decideHockeyGoalLine,
  HOCKEY_GOAL_LINE_DECISION,
} from './hockey-goal-line.js';

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

test('basketball charges restart through a dead-ball inbound rather than a live outlet', () => {
  const chargeBody = hoops.match(/function commitCharge\(defender,driver\)\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(chargeBody, /beginBaselineInbound\(driver\.side,'CHARGE'\)/);
  assert.doesNotMatch(chargeBody, /\boutlet\(/);
  assert.match(hoops, /function beginBaselineInbound\(scoringSide=play\.offense,reason='MADE'\)/);
  assert.match(hoops, /afterCharge\?'OFFENSIVE FOUL · DEAD-BALL INBOUND'/);
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

test('hockey slow crease covers happen before the line and valid crossings always score', () => {
  const common = {
    side: 1,
    z: 0.2,
    y: 0.12,
    velocityX: 4,
    goalLine: 29,
    netWidth: 4.4,
    goalieZ: 0,
    saveChecked: false,
  };
  assert.equal(decideHockeyGoalLine({
    ...common,
    previousX: 28.9,
    x: 29.1,
  }), HOCKEY_GOAL_LINE_DECISION.GOAL);
  assert.equal(decideHockeyGoalLine({
    ...common,
    previousX: 28.4,
    x: 28.7,
  }), HOCKEY_GOAL_LINE_DECISION.CREASE_COVER);
  assert.equal(decideHockeyGoalLine({
    ...common,
    previousX: 28.8,
    x: 28.9,
    z: 2.4,
  }), HOCKEY_GOAL_LINE_DECISION.LIVE);
  assert.equal(decideHockeyGoalLine({
    ...common,
    previousX: 28.4,
    x: 28.7,
    goalieZ: null,
  }), HOCKEY_GOAL_LINE_DECISION.LIVE);
  const integrationBody = hockey.match(/function integratePuck\(dt\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(integrationBody, /currentGoalLineAdjudication\(\)/);
  assert.match(integrationBody, /lineCall\.decision === 'GOAL'[\s\S]*scoreGoal\(lineCall\.side\)[\s\S]*return/);
  assert.ok(
    integrationBody.indexOf('lineCall.decision') < integrationBody.indexOf('// pickups'),
    'goal-line adjudication must run before same-step player pickups',
  );
  assert.match(hockey, /if \(S\.state !== 'PLAY'\) break; \/\/ goal crossed before same-step pickup\/collision/);
  assert.match(hockey, /kind === 'slowGoal'/);
  assert.match(hockey, /if\(goalLineDecision==='GOAL'\)\{\s*scoreGoal\(s\)/);
});

test('owned arenas certify moments as live footage rather than inventing replays', () => {
  assert.match(hoops, /recordedFootage:false/);
  assert.match(hockey, /recordedFootage:false/);
  assert.doesNotMatch(hoops, /recordedFootage:true/);
  assert.doesNotMatch(hockey, /recordedFootage:true/);
});
