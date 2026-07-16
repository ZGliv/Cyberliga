import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = globalThis;
delete globalThis.CYBERLIGA_CONTENT;
delete globalThis.CyberligaCharacters;
delete globalThis.CyberligaNamedMoments;
delete globalThis.CyberligaWitnessChronicle;
delete globalThis.CyberligaWitnessStore;

const storageValues = new Map();
const listeners = new Map();
globalThis.localStorage = {
  getItem(key) { return storageValues.has(key) ? storageValues.get(key) : null; },
  setItem(key, value) { storageValues.set(key, String(value)); },
  removeItem(key) { storageValues.delete(key); }
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
};
globalThis.addEventListener = function addEventListener(type, handler) {
  const entries = listeners.get(type) || [];
  entries.push(handler);
  listeners.set(type, entries);
};
globalThis.dispatchEvent = function dispatchEvent(event) {
  (listeners.get(event.type) || []).slice().forEach((handler) => handler(event));
  return true;
};

await import('./worlddata.js?witness-store-tests');
await import('./characterdata.js?witness-store-tests');
await import('./named-moments.js?witness-store-tests');
await import('./witness-chronicle.js?witness-store-tests');
await import('./witness-store.js?witness-store-tests');

const Content = globalThis.CYBERLIGA_CONTENT;
const Named = globalThis.CyberligaNamedMoments;
const Store = globalThis.CyberligaWitnessStore;

function certifiedMoment(eventKey = 'store-event-1') {
  const sport = Content.getSport('basketball');
  const home = sport.teams[0];
  const away = sport.teams[1];
  const athlete = home.athletes[0];
  const fixtureId = 'basketball-store-fixture';
  const director = Named.create({ sportId:'basketball', fixtureId, homeTeam:home, awayTeam:away });
  const moment = director.record({
    eventKey,
    kind:'dunk',
    side:'home',
    team:home,
    athlete,
    clock:'03:12',
    score:{ home:72, away:70 },
    recordedFootage:true
  });
  return {
    moment,
    context:{ sportId:'basketball', fixtureId, homeTeam:home, awayTeam:away, mode:'moment' }
  };
}

test('stores an exact painted witness once without granting authority or gameplay value', () => {
  Store.reset();
  assert.equal(Store.ready, true);
  assert.equal(Store.storageKey, 'cyberliga_witness_chronicle_v1');
  assert.deepEqual(Store.contract, {
    source:'local-witness', persistence:'device-local', official:false, authoritative:false,
    wagerable:false, settles:false, money:false, prizes:false
  });

  const { moment, context } = certifiedMoment();
  const first = Store.capturePresented(moment, context);
  assert.ok(first?.changed);
  const duplicate = Store.capturePresented(moment, context);
  assert.equal(duplicate?.changed, false);
  assert.equal(duplicate?.receipt?.momentId, moment.id);

  const state = Store.getState();
  assert.equal(state.count, 1);
  assert.equal(state.unreadCount, 1);
  assert.equal(state.entries[0].momentId, moment.id);
  assert.equal(state.entries[0].athlete.id, moment.athlete.id);
  assert.equal(state.entries[0].safety.official, false);
  assert.equal(state.entries[0].safety.authoritative, false);
  assert.equal(state.entries[0].safety.wagerable, false);
  assert.equal(state.entries[0].safety.money, false);
  assert.equal(state.entries[0].safety.prizes, false);

  const stored = JSON.parse(storageValues.get(Store.storageKey));
  assert.equal(stored.entries.length, 1);
  assert.deepEqual(Object.keys(stored.entries[0]).sort(), [
    'athleteId','awayTeamId','eventKey','fixtureId','homeTeamId','kept','kind','momentId',
    'schemaVersion','side','sportId','teamId','witnessedAt'
  ]);
  assert.equal(Object.prototype.hasOwnProperty.call(stored.entries[0], 'score'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(stored.entries[0], 'recordedFootage'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(stored.entries[0], 'headline'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(stored.entries[0], 'clipHref'), false);
});

test('keep, read and remove mutate only the bounded device-local chronicle', () => {
  Store.reset();
  const { moment, context } = certifiedMoment('store-event-2');
  Store.capturePresented(moment, context);
  const witnessId = Store.getState().entries[0].witnessId;
  assert.ok(witnessId);

  assert.equal(Store.keep(witnessId, true), true);
  assert.equal(Store.getState().keptCount, 1);
  assert.equal(Store.keep(witnessId, true), false);
  assert.equal(Store.markRead(), true);
  assert.equal(Store.getState().unreadCount, 0);
  assert.equal(Store.remove(witnessId), true);
  assert.equal(Store.getState().count, 0);
  assert.equal(Store.remove(witnessId), false);
});

test('reload revalidates minimal facts and rebuilds all display copy from canon', async () => {
  Store.reset();
  const { moment, context } = certifiedMoment('store-event-3');
  Store.capturePresented(moment, context);
  const raw = JSON.parse(storageValues.get(Store.storageKey));
  raw.entries[0].headline = '<script>forged</script>';
  raw.entries[0].clipHref = 'https://attacker.invalid/';
  raw.entries[0].score = { home:999, away:0 };
  storageValues.set(Store.storageKey, JSON.stringify(raw));

  delete globalThis.CyberligaWitnessStore;
  await import('./witness-store.js?witness-store-reload');
  const Reloaded = globalThis.CyberligaWitnessStore;
  const receipt = Reloaded.getState().entries[0];
  assert.equal(receipt.eventTitle, Named.eventTitles.basketball.dunk);
  assert.doesNotMatch(receipt.title, /forged|script/i);
  assert.doesNotMatch(receipt.clipHref, /attacker/i);
  assert.equal(Object.prototype.hasOwnProperty.call(receipt, 'score'), false);
});

test('ignores same-key storage events from a different storage area', () => {
  Store.reset();
  const { moment, context } = certifiedMoment('store-event-area');
  Store.capturePresented(moment, context);
  const before = Store.getState().entries[0].momentId;
  globalThis.dispatchEvent({
    type:'storage',
    key:Store.storageKey,
    storageArea:{},
    newValue:JSON.stringify({ schemaVersion:1, lastReadAt:0, entries:[] })
  });
  assert.equal(Store.getState().count, 1);
  assert.equal(Store.getState().entries[0].momentId, before);
});

test('rebases local mutations and ignores delayed same-area snapshots', () => {
  Store.reset();
  const first = certifiedMoment('store-race-a');
  const second = certifiedMoment('store-race-b');
  Store.capturePresented(first.moment, first.context);
  const rawA = storageValues.get(Store.storageKey);
  Store.capturePresented(second.moment, second.context);
  const rawAB = storageValues.get(Store.storageKey);
  assert.equal(Store.getState().count, 2);

  storageValues.set(Store.storageKey, rawA);
  globalThis.dispatchEvent({
    type:'storage', key:Store.storageKey, storageArea:globalThis.localStorage, newValue:rawA
  });
  assert.equal(Store.getState().count, 1);

  storageValues.set(Store.storageKey, rawAB);
  const witnessA = Store.getState().entries[0].witnessId;
  assert.equal(Store.keep(witnessA,true), true);
  assert.equal(Store.getState().count, 2);
  const latest = storageValues.get(Store.storageKey);

  globalThis.dispatchEvent({
    type:'storage', key:Store.storageKey, storageArea:globalThis.localStorage, newValue:rawA
  });
  assert.equal(Store.getState().count, 2);

  Store.reset();
  const empty = storageValues.get(Store.storageKey);
  assert.equal(JSON.parse(empty).entries.length, 0);
  globalThis.dispatchEvent({
    type:'storage', key:Store.storageKey, storageArea:globalThis.localStorage, newValue:latest
  });
  assert.equal(Store.getState().count, 0);
});
