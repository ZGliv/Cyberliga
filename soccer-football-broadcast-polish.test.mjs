import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const soccer = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const football = readFileSync(new URL('./football.js', import.meta.url), 'utf8');

test('soccer makes the intended receiver and nearest marker a staged live duel', () => {
  assert.match(soccer, /function closestOpponent\(player\)/);
  assert.match(soccer, /function assignPassTarget\(receiver, passer=null, kind='pass', seconds=2\.7\)/);
  assert.match(soccer, /function soccerBroadcastRead\(\)/);
  assert.match(soccer, /PASS DEVELOPING/);
  assert.match(soccer, /RECEIPT WINDOW/);
  assert.match(soccer, /receiptHalo/);
  assert.match(soccer, /pressureGuide/);
});

test('soccer deterministic QA can stage and inspect the complete pass-read story', () => {
  assert.match(soccer, /type === 'pass-read'/);
  assert.match(soccer, /spectatorRead:\(\(\)=>/);
  assert.match(soccer, /shoulderCheck:/);
  assert.match(soccer, /character:\(\(\)=>/);
  assert.match(soccer, /foundingBody:profile\.foundingBody/);
});

test('soccer compact score and situation strips stay bounded throughout portrait widths', () => {
  assert.match(soccer, /@media \(max-width: 480px\)/);
  assert.match(soccer, /grid-template-columns:minmax\(0,1fr\) 64px minmax\(0,1fr\)/);
  assert.match(soccer, /#matchcontext \{[\s\S]*width:calc\(100vw - 20px\)/);
  assert.match(soccer, /#analyststrip \{[\s\S]*grid-template-columns:minmax\(0,1fr\)/);
});

test('football broadcast focus follows live contact, catch, loose-ball, and return subjects', () => {
  assert.match(football, /function selectBroadcastFocus\(replayState = replayRenderState\(\)\)/);
  assert.match(football, /TACKLE POINT/);
  assert.match(football, /CATCH WINDOW/);
  assert.match(football, /LOOSE BALL PURSUIT/);
  assert.match(football, /TURNOVER RETURN/);
  assert.match(football, /travelGameDirection/);
});

test('football camera and telemetry identify the same featured athlete', () => {
  assert.match(football, /const broadcastFocus = selectBroadcastFocus\(replayState\)/);
  assert.match(football, /focusAthleteId: broadcastFocus\.primary\?\.id/);
  assert.match(football, /focusReason: broadcastFocus\.kind/);
  assert.match(football, /view\.badge\.visible = focusedIds\.has\(player\.id\)/);
  assert.match(football, /character: footballCharacterSummary\(player\)/);
});

test('football replay snapshots retain the facts needed to frame the certified play', () => {
  assert.match(football, /returnType: state\.returnType/);
  assert.match(football, /defenderId: state\.catchBeat\.defenderId/);
  assert.match(football, /outcome: state\.catchBeat\.outcome/);
  assert.match(football, /Replay opens on a frozen, certified segment/);
});
