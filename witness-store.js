(function bootstrapCyberligaWitnessStore(root, factory) {
  'use strict';

  var api = factory(root);
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else root.CyberligaWitnessStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createWitnessStoreApi(root) {
  'use strict';

  var CHRONICLE = root && root.CyberligaWitnessChronicle;
  var VERSION = '1.0.0';
  var STORAGE_KEY = 'cyberliga_witness_chronicle_v1';
  var CHANGE_EVENT = 'cyberliga:witness-change';
  var BOUND = Boolean(CHRONICLE && CHRONICLE.ready === true && typeof CHRONICLE.create === 'function');
  var storage = null;
  var model = null;

  var CONTRACT = Object.freeze({
    source: 'local-witness',
    persistence: 'device-local',
    official: false,
    authoritative: false,
    wagerable: false,
    settles: false,
    money: false,
    prizes: false
  });

  function frozenEmptyState() {
    return Object.freeze({
      version: VERSION,
      schemaVersion: CHRONICLE && CHRONICLE.schemaVersion || 1,
      count: 0,
      keptCount: 0,
      unreadCount: 0,
      lastReadAt: 0,
      entries: Object.freeze([]),
      contract: CONTRACT
    });
  }

  function resolveStorage() {
    if (!root) return null;
    try {
      var candidate = root.localStorage;
      if (!candidate || typeof candidate.getItem !== 'function' ||
          typeof candidate.setItem !== 'function' || typeof candidate.removeItem !== 'function') return null;
      return candidate;
    } catch (_) {
      return null;
    }
  }

  function parse(value) {
    if (typeof value !== 'string' || !value || value.length > 500000) return null;
    try {
      var parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function readStorageValue() {
    if (!storage) return null;
    try {
      return storage.getItem(STORAGE_KEY);
    } catch (_) {
      return null;
    }
  }

  function loadRaw() {
    return parse(readStorageValue());
  }

  function rebaseFromStorage() {
    if (!BOUND || !storage) return;
    var value = readStorageValue();
    // An absent key may mean persistence is unavailable. Explicit cross-tab
    // resets are applied by syncFromStorage(), where the event proves intent.
    if (value == null) return;
    var next = CHRONICLE.create(parse(value));
    if (next) model = next;
  }

  function serializeModel() {
    if (!model || typeof model.serialize !== 'function') return null;
    try {
      return JSON.stringify(model.serialize());
    } catch (_) {
      return null;
    }
  }

  function persist() {
    if (!storage) return false;
    var serialized = serializeModel();
    if (!serialized) return false;
    try {
      storage.setItem(STORAGE_KEY, serialized);
      return true;
    } catch (_) {
      return false;
    }
  }

  function emit(reason) {
    if (!root || typeof root.dispatchEvent !== 'function') return;
    var detail = Object.freeze({ reason: reason, state: getState() });
    try {
      if (typeof root.CustomEvent === 'function') {
        root.dispatchEvent(new root.CustomEvent(CHANGE_EVENT, { detail: detail }));
      } else if (typeof root.Event === 'function') {
        var event = new root.Event(CHANGE_EVENT);
        try { Object.defineProperty(event, 'detail', { value: detail }); } catch (_) {}
        root.dispatchEvent(event);
      }
    } catch (_) {}
  }

  function mutate(reason, operation) {
    if (!model || typeof operation !== 'function') return false;
    rebaseFromStorage();
    var before = serializeModel();
    try { operation(); } catch (_) { return false; }
    var after = serializeModel();
    if (!after || after === before) return false;
    persist();
    emit(reason);
    return true;
  }

  function capturePresented(moment, context) {
    if (!model || !context || typeof context !== 'object' || typeof model.capture !== 'function') return null;
    rebaseFromStorage();
    var before = serializeModel();
    var result = null;
    try {
      result = model.capture(moment, {
        sportId: context.sportId,
        fixtureId: context.fixtureId,
        homeTeam: context.homeTeam,
        awayTeam: context.awayTeam,
        mode: context.mode,
        witnessedAt: Date.now()
      });
    } catch (_) {
      return null;
    }
    if (!result) return null;
    var after = serializeModel();
    if (after && after !== before) {
      persist();
      emit('capture');
    }
    return result;
  }

  function getState(options) {
    if (!model || typeof model.state !== 'function') return frozenEmptyState();
    try { return model.state(options); } catch (_) { return frozenEmptyState(); }
  }

  function chapter(athleteId) {
    if (!model || typeof model.chapter !== 'function') return null;
    try { return model.chapter(athleteId); } catch (_) { return null; }
  }

  function keep(witnessId, value) {
    return mutate('keep', function keepWitness() { model.keep(witnessId, value !== false); });
  }

  function remove(witnessId) {
    return mutate('remove', function removeWitness() { model.remove(witnessId); });
  }

  function markRead() {
    return mutate('read', function markWitnessesRead() { model.markRead(Date.now()); });
  }

  function reset() {
    if (!BOUND) return false;
    model = CHRONICLE.create(null);
    // Persist an explicit empty snapshot so another open arena cannot mistake
    // an absent key for unavailable storage and resurrect pre-reset receipts.
    persist();
    emit('reset');
    return Boolean(model);
  }

  function syncFromStorage(event) {
    if (!BOUND || !event || event.key !== STORAGE_KEY ||
        (event.storageArea && event.storageArea !== storage)) return;
    var currentValue = readStorageValue();
    // Storage events are queued. Never roll the live model back with an older
    // event when another tab has already committed a newer snapshot.
    if (event.newValue !== currentValue) return;
    var next = CHRONICLE.create(parse(currentValue));
    if (!next) return;
    var before = serializeModel();
    model = next;
    if (serializeModel() !== before) emit('storage');
  }

  storage = resolveStorage();
  model = BOUND ? CHRONICLE.create(loadRaw()) : null;
  if (root && typeof root.addEventListener === 'function') {
    try { root.addEventListener('storage', syncFromStorage); } catch (_) {}
  }

  return Object.freeze({
    version: VERSION,
    ready: Boolean(BOUND && model),
    storageKey: STORAGE_KEY,
    changeEvent: CHANGE_EVENT,
    contract: CONTRACT,
    capturePresented: capturePresented,
    getState: getState,
    chapter: chapter,
    keep: keep,
    remove: remove,
    markRead: markRead,
    reset: reset
  });
});
