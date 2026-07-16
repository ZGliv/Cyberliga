import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

globalThis.window = globalThis;
delete globalThis.CYBERLIGA_CONTENT;
delete globalThis.CyberligaCharacters;
delete globalThis.CyberligaNamedMoments;
delete globalThis.CyberligaWitnessChronicle;
delete globalThis.CyberligaWitnessStore;

const storageValues = new Map();
const listeners = new Map();
let failSetItem = false;
let failNextGetItem = false;
let afterGetItem = null;
let afterSetItem = null;
globalThis.localStorage = {
  getItem(key) {
    if (failNextGetItem) {
      failNextGetItem = false;
      throw new Error('Storage read unavailable');
    }
    const value = storageValues.has(key) ? storageValues.get(key) : null;
    if (typeof afterGetItem === 'function') {
      const hook = afterGetItem;
      afterGetItem = null;
      hook({ key, value });
    }
    return value;
  },
  setItem(key, value) {
    if (failSetItem) {
      const error = new Error('Quota exceeded');
      error.name = 'QuotaExceededError';
      throw error;
    }
    storageValues.set(key, String(value));
    if (typeof afterSetItem === 'function') {
      const hook = afterSetItem;
      afterSetItem = null;
      hook({ key, value: String(value) });
    }
  },
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
const Chronicle = globalThis.CyberligaWitnessChronicle;
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

function serializedReceipt(item, witnessedAt = 1000) {
  const model = Chronicle.create(null);
  const captured = model.capture(item.moment, { ...item.context, witnessedAt });
  assert.ok(captured?.changed);
  return JSON.stringify(model.serialize());
}

test('stores an exact painted witness once without granting authority or gameplay value', () => {
  Store.reset();
  assert.equal(Store.ready, true);
  assert.equal(Store.storageKey, 'cyberliga_witness_chronicle_v1');
  assert.deepEqual(Store.contract, {
    source:'local-witness', persistence:'device-local',
    crossTab:'open-tab-optimistic-convergence', atomic:false, official:false, authoritative:false,
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
  assert.equal(stored.adapter.schemaVersion, 1);
  assert.ok(stored.adapter.revision >= 1);
  assert.equal(stored.adapter.reset, false);
  assert.deepEqual(Object.keys(stored.entries[0]).sort(), [
    'athleteId','awayTeamId','eventKey','fixtureId','homeTeamId','kept','kind','momentId',
    'schemaVersion','side','sportId','teamId','witnessedAt'
  ]);
  assert.equal(Object.prototype.hasOwnProperty.call(stored.entries[0], 'score'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(stored.entries[0], 'recordedFootage'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(stored.entries[0], 'headline'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(stored.entries[0], 'clipHref'), false);
  assert.ok(Object.isFrozen(Store));
  assert.ok(Object.isFrozen(state));
  assert.ok(Object.isFrozen(state.entries));
  assert.ok(Object.isFrozen(state.entries[0]));
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
  raw.adapter = {
    schemaVersion:1,
    revision:'999',
    epoch:'javascript:forged',
    commits:Array.from({ length:200 }, (_, index) => `<script-${index}>`),
    reset:true
  };
  storageValues.set(Store.storageKey, JSON.stringify(raw));

  delete globalThis.CyberligaWitnessStore;
  await import('./witness-store.js?witness-store-reload');
  const Reloaded = globalThis.CyberligaWitnessStore;
  const receipt = Reloaded.getState().entries[0];
  assert.equal(receipt.eventTitle, Named.eventTitles.basketball.dunk);
  assert.doesNotMatch(receipt.title, /forged|script/i);
  assert.doesNotMatch(receipt.clipHref, /attacker/i);
  assert.equal(Object.prototype.hasOwnProperty.call(receipt, 'score'), false);
  assert.equal(Reloaded.keep(receipt.witnessId, true), true);
  const repaired = JSON.parse(storageValues.get(Store.storageKey));
  assert.equal(repaired.adapter.revision, 1);
  assert.equal(repaired.adapter.epoch, 'epoch-a-initial');
  assert.equal(repaired.adapter.commits.length, 1);
  assert.match(repaired.adapter.commits[0], /^commit-[a-z0-9-]+$/i);
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

test('recovers local mutations from a current fork and ignores delayed same-area snapshots', () => {
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
  assert.equal(Store.getState().count, 2);

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
  storageValues.set(Store.storageKey, latest);
  globalThis.dispatchEvent({
    type:'storage', key:Store.storageKey, storageArea:globalThis.localStorage, newValue:latest
  });
  assert.equal(Store.getState().count, 0);
  assert.equal(JSON.parse(storageValues.get(Store.storageKey)).entries.length, 0);
});

test('does not commit or report mutations when quota persistence fails', () => {
  Store.reset();
  const first = certifiedMoment('store-quota-a');
  const second = certifiedMoment('store-quota-b');
  Store.capturePresented(first.moment, first.context);
  const durable = storageValues.get(Store.storageKey);
  const witnessId = Store.getState().entries[0].witnessId;

  failSetItem = true;
  try {
    assert.equal(Store.keep(witnessId, true), false);
    assert.equal(Store.getState().keptCount, 0);
    assert.equal(Store.remove(witnessId), false);
    assert.equal(Store.getState().count, 1);
    assert.equal(Store.markRead(), false);
    assert.equal(Store.getState().unreadCount, 1);
    assert.equal(Store.reset(), false);
    assert.equal(Store.getState().count, 1);
    assert.equal(Store.capturePresented(second.moment, second.context), null);
    assert.equal(Store.getState().count, 1);
    assert.equal(storageValues.get(Store.storageKey), durable);
  } finally {
    failSetItem = false;
  }
});

test('commits after successful atomic setItem when only verification read is unavailable', () => {
  Store.reset();
  const item = certifiedMoment('store-verification-read');
  afterSetItem = () => { failNextGetItem = true; };
  const captured = Store.capturePresented(item.moment, item.context);
  assert.equal(captured?.changed, true);
  assert.equal(Store.getState().count, 1);
  assert.equal(JSON.parse(storageValues.get(Store.storageKey)).entries.length, 1);
});

test('treats explicit deletion and clear events as durable empty state without resurrection', () => {
  Store.reset();
  const first = certifiedMoment('store-clear-a');
  const second = certifiedMoment('store-clear-b');
  Store.capturePresented(first.moment, first.context);
  const deleted = storageValues.get(Store.storageKey);

  storageValues.delete(Store.storageKey);
  globalThis.dispatchEvent({
    type:'storage', key:Store.storageKey, storageArea:globalThis.localStorage, oldValue:deleted, newValue:null
  });
  assert.equal(Store.getState().count, 0);
  Store.capturePresented(second.moment, second.context);
  assert.deepEqual(
    JSON.parse(storageValues.get(Store.storageKey)).entries.map((entry) => entry.eventKey),
    ['store-clear-b']
  );

  const beforeClear = storageValues.get(Store.storageKey);
  storageValues.clear();
  globalThis.dispatchEvent({
    type:'storage', key:null, storageArea:globalThis.localStorage, oldValue:null, newValue:null
  });
  assert.equal(Store.getState().count, 0);

  // A queued pre-clear snapshot cannot restore receipts once the key is absent.
  storageValues.set(Store.storageKey, beforeClear);
  globalThis.dispatchEvent({
    type:'storage', key:Store.storageKey, storageArea:globalThis.localStorage,
    oldValue:null, newValue:beforeClear
  });
  assert.equal(Store.getState().count, 0);
  assert.equal(JSON.parse(storageValues.get(Store.storageKey)).entries.length, 0);
  Store.capturePresented(first.moment, first.context);
  assert.deepEqual(
    JSON.parse(storageValues.get(Store.storageKey)).entries.map((entry) => entry.eventKey),
    ['store-clear-a']
  );
});

test('detects same-tab key removal without a storage event and retires old replay intents', () => {
  Store.reset();
  const first = certifiedMoment('store-same-tab-clear-a');
  const second = certifiedMoment('store-same-tab-clear-b');
  Store.capturePresented(first.moment, first.context);
  const beforeClear = storageValues.get(Store.storageKey);

  // Browsers do not send a storage event back to the tab that called clear().
  storageValues.clear();
  assert.equal(Store.getState().count, 0);
  assert.equal(JSON.parse(storageValues.get(Store.storageKey)).entries.length, 0);

  storageValues.set(Store.storageKey, beforeClear);
  globalThis.dispatchEvent({
    type:'storage', key:Store.storageKey, storageArea:globalThis.localStorage,
    oldValue:null, newValue:beforeClear
  });
  assert.equal(Store.getState().count, 0);

  Store.capturePresented(second.moment, second.context);
  assert.deepEqual(
    JSON.parse(storageValues.get(Store.storageKey)).entries.map((entry) => entry.eventKey),
    ['store-same-tab-clear-b']
  );

  // A stale pre-clear writer arriving after a new-epoch capture must retain
  // the post-clear receipt while rejecting the cleared receipt.
  storageValues.set(Store.storageKey, beforeClear);
  globalThis.dispatchEvent({
    type:'storage', key:Store.storageKey, storageArea:globalThis.localStorage,
    oldValue:null, newValue:beforeClear
  });
  assert.deepEqual(
    JSON.parse(storageValues.get(Store.storageKey)).entries.map((entry) => entry.eventKey),
    ['store-same-tab-clear-b']
  );
});

test('same-tab clear followed by reset advances beyond the live reset epoch', () => {
  const originalNow = Date.now;
  Date.now = () => 1700000000000;
  try {
    assert.equal(Store.reset(), true);
    const priorEpoch = JSON.parse(storageValues.get(Store.storageKey)).adapter.epoch;
    const priorTime = Number(/^epoch-z-([0-9]{13})-/.exec(priorEpoch)?.[1]);
    assert.ok(Number.isFinite(priorTime));

    // No same-tab storage event is delivered between clear() and reset(). The
    // reset must still derive its epoch from the live pre-clear model epoch.
    storageValues.clear();
    assert.equal(Store.reset(), true);
    const next = JSON.parse(storageValues.get(Store.storageKey));
    const nextTime = Number(/^epoch-z-([0-9]{13})-/.exec(next.adapter.epoch)?.[1]);
    assert.ok(nextTime > priorTime);
    assert.equal(next.entries.length, 0);
  } finally {
    Date.now = originalNow;
  }
});

test('retries exact-base and post-write conflicts against the latest durable snapshot', () => {
  const first = certifiedMoment('store-interleave-a');
  const second = certifiedMoment('store-interleave-b');

  Store.reset();
  const empty = storageValues.get(Store.storageKey);
  const onlySecond = serializedReceipt(second, 2000);
  afterGetItem = ({ key, value }) => {
    assert.equal(key, Store.storageKey);
    assert.equal(value, empty);
    storageValues.set(Store.storageKey, onlySecond);
  };
  const captured = Store.capturePresented(first.moment, first.context);
  assert.equal(captured?.changed, true);
  assert.deepEqual(
    JSON.parse(storageValues.get(Store.storageKey)).entries.map((entry) => entry.eventKey).sort(),
    ['store-interleave-a','store-interleave-b']
  );

  Store.reset();
  const third = certifiedMoment('store-interleave-c');
  const onlyThird = serializedReceipt(third, 3000);
  afterSetItem = () => { storageValues.set(Store.storageKey, onlyThird); };
  const recaptured = Store.capturePresented(first.moment, first.context);
  assert.equal(recaptured?.changed, true);
  assert.deepEqual(
    JSON.parse(storageValues.get(Store.storageKey)).entries.map((entry) => entry.eventKey).sort(),
    ['store-interleave-a','store-interleave-c']
  );
});

test('orders wrapped revisions and expires pre-wrap journals after the lineage window', () => {
  const source = readFileSync(new URL('./witness-store.js', import.meta.url), 'utf8');
  const MAX_REVISION = 2147483646;
  const first = certifiedMoment('store-revision-wrap');
  const remote = certifiedMoment('store-revision-remote');

  function snapshot(serialized, revision, commitId) {
    const raw = JSON.parse(serialized);
    raw.adapter = {
      schemaVersion:1,
      revision,
      epoch:'epoch-a-initial',
      commits:[commitId],
      reset:false
    };
    return JSON.stringify(raw);
  }

  function isolatedTab(backing, seed) {
    const storageListeners = [];
    const localStorage = {
      getItem(key) { return backing.has(key) ? backing.get(key) : null; },
      setItem(key, value) { backing.set(key, String(value)); },
      removeItem(key) { backing.delete(key); }
    };
    const root = {
      CyberligaWitnessChronicle:Chronicle,
      localStorage,
      crypto:{
        getRandomValues(words) {
          for (let index = 0; index < words.length; index += 1) words[index] = seed + index;
          return words;
        }
      },
      addEventListener(type, handler) { if (type === 'storage') storageListeners.push(handler); },
      dispatchEvent() { return true; }
    };
    root.globalThis = root;
    vm.createContext(root);
    vm.runInContext(source, root, { filename:'witness-store.js' });
    return {
      store:root.CyberligaWitnessStore,
      storage:localStorage,
      dispatchStorage(event) { storageListeners.slice().forEach((handler) => handler(event)); }
    };
  }

  const maxSeed = snapshot(JSON.stringify(Chronicle.create(null).serialize()), MAX_REVISION, 'commit-seed-max');
  const wrappedBacking = new Map([[Store.storageKey, maxSeed]]);
  const wrappedTab = isolatedTab(wrappedBacking, 300);
  assert.equal(wrappedTab.store.capturePresented(first.moment, first.context)?.changed, true);
  const wrapped = wrappedBacking.get(Store.storageKey);
  assert.equal(JSON.parse(wrapped).adapter.revision, 1);

  // A delayed pre-wrap snapshot is older than revision 1 on the bounded ring.
  // Reassertion must retain the wrapped commit and advance to revision 2.
  wrappedBacking.set(Store.storageKey, maxSeed);
  wrappedTab.dispatchStorage({
    key:Store.storageKey, storageArea:wrappedTab.storage, oldValue:wrapped, newValue:maxSeed
  });
  const recovered = JSON.parse(wrappedBacking.get(Store.storageKey));
  assert.equal(recovered.adapter.revision, 2);
  assert.deepEqual(recovered.entries.map((entry) => entry.eventKey), ['store-revision-wrap']);

  const preWrapSeed = snapshot(
    JSON.stringify(Chronicle.create(null).serialize()),
    MAX_REVISION - 1,
    'commit-seed-pre-wrap'
  );
  const pruningBacking = new Map([[Store.storageKey, preWrapSeed]]);
  const pruningTab = isolatedTab(pruningBacking, 400);
  assert.equal(pruningTab.store.capturePresented(first.moment, first.context)?.changed, true);
  const localAtMax = pruningBacking.get(Store.storageKey);
  assert.equal(JSON.parse(localAtMax).adapter.revision, MAX_REVISION);

  // Revision 65 is 65 commits beyond MAX on the ring. The 64-entry lineage
  // can no longer prove the pre-wrap local intent, so its journal must expire.
  const remoteAt65 = snapshot(serializedReceipt(remote, 6500), 65, 'commit-remote-65');
  pruningBacking.set(Store.storageKey, remoteAt65);
  pruningTab.dispatchStorage({
    key:Store.storageKey, storageArea:pruningTab.storage, oldValue:localAtMax, newValue:remoteAt65
  });
  assert.deepEqual(
    JSON.parse(pruningBacking.get(Store.storageKey)).entries.map((entry) => entry.eventKey),
    ['store-revision-remote']
  );
  assert.deepEqual(
    pruningTab.store.getState().entries.map((entry) => entry.eventKey),
    ['store-revision-remote']
  );
  assert.equal(pruningTab.store.contract.atomic, false);
});

test('open tabs converge a fork that lands after preflight through commit-lineage recovery', () => {
  const source = readFileSync(new URL('./witness-store.js', import.meta.url), 'utf8');
  const backing = new Map([[Store.storageKey, JSON.stringify(Chronicle.create(null).serialize())]]);
  const first = certifiedMoment('store-fork-a');
  const second = certifiedMoment('store-fork-b');
  let armFork = false;
  let tabB = null;
  let branchB = null;

  function storageFacade(interleave) {
    return {
      getItem(key) { return backing.has(key) ? backing.get(key) : null; },
      setItem(key, value) {
        if (interleave && armFork) {
          armFork = false;
          const result = tabB.store.capturePresented(second.moment, second.context);
          assert.equal(result?.changed, true);
          branchB = backing.get(key);
        }
        backing.set(key, String(value));
      },
      removeItem(key) { backing.delete(key); }
    };
  }

  function isolatedTab(localStorage, seed) {
    const storageListeners = [];
    const root = {
      CyberligaWitnessChronicle: Chronicle,
      localStorage,
      crypto: {
        getRandomValues(words) {
          for (let index = 0; index < words.length; index += 1) words[index] = seed + index;
          return words;
        }
      },
      addEventListener(type, handler) { if (type === 'storage') storageListeners.push(handler); },
      dispatchEvent() { return true; }
    };
    root.globalThis = root;
    vm.createContext(root);
    vm.runInContext(source, root, { filename:'witness-store.js' });
    return {
      root,
      store:root.CyberligaWitnessStore,
      dispatchStorage(event) { storageListeners.slice().forEach((handler) => handler(event)); }
    };
  }

  const storageA = storageFacade(true);
  const storageB = storageFacade(false);
  const tabA = isolatedTab(storageA, 100);
  tabB = isolatedTab(storageB, 200);
  armFork = true;

  const resultA = tabA.store.capturePresented(first.moment, first.context);
  assert.equal(resultA?.changed, true);
  assert.ok(branchB);
  const branchA = backing.get(Store.storageKey);
  assert.deepEqual(JSON.parse(branchA).entries.map((entry) => entry.eventKey), ['store-fork-a']);

  // B observes A replacing its successfully verified sibling snapshot. Its
  // missing commit is replayed onto A, then A adopts the converged lineage.
  tabB.dispatchStorage({
    key:Store.storageKey, storageArea:storageB, oldValue:branchB, newValue:branchA
  });
  const merged = backing.get(Store.storageKey);
  tabA.dispatchStorage({
    key:Store.storageKey, storageArea:storageA, oldValue:branchA, newValue:merged
  });

  assert.deepEqual(
    JSON.parse(merged).entries.map((entry) => entry.eventKey).sort(),
    ['store-fork-a','store-fork-b']
  );
  assert.equal(tabA.store.getState().count, 2);
  assert.equal(tabB.store.getState().count, 2);
  assert.equal(tabA.store.contract.atomic, false);
});
