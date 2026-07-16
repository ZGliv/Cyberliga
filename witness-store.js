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
  var ADAPTER_SCHEMA_VERSION = 1;
  var MAX_WRITE_ATTEMPTS = 6;
  var MAX_REVISION = 2147483646;
  var MAX_COMMIT_IDS = 64;
  var MAX_LOCAL_COMMITS = 32;
  var INITIAL_EPOCH = 'epoch-a-initial';
  var BOUND = Boolean(CHRONICLE && CHRONICLE.ready === true && typeof CHRONICLE.create === 'function');
  var storage = null;
  var model = null;
  var modelRevision = 0;
  var modelEpoch = INITIAL_EPOCH;
  var modelCommits = [];
  var localCommits = [];
  var commitSequence = 0;
  var writerToken = createWriterToken();

  var CONTRACT = Object.freeze({
    source: 'local-witness',
    persistence: 'device-local',
    crossTab: 'open-tab-optimistic-convergence',
    atomic: false,
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

  function createWriterToken() {
    try {
      var crypto = root && root.crypto;
      if (crypto && typeof crypto.getRandomValues === 'function' && typeof Uint32Array === 'function') {
        var words = new Uint32Array(4);
        crypto.getRandomValues(words);
        return Array.prototype.map.call(words, function hex(word) {
          return word.toString(16).padStart(8, '0');
        }).join('-');
      }
    } catch (_) {}
    var now = typeof Date === 'function' && typeof Date.now === 'function' ? Date.now() : 0;
    var fine = 0;
    try { fine = root && root.performance && Math.floor(root.performance.now() * 1000) || 0; } catch (_) {}
    return now.toString(36) + '-' + fine.toString(36);
  }

  function nextCommitId() {
    commitSequence += 1;
    return 'commit-' + writerToken + '-' + commitSequence.toString(36);
  }

  function cleanCommitId(value) {
    return typeof value === 'string' && value.length <= 160 && /^commit-[a-z0-9-]+$/i.test(value) ? value : '';
  }

  function cleanEpoch(value) {
    if (value === INITIAL_EPOCH) return value;
    return typeof value === 'string' && value.length <= 200 &&
      /^epoch-z-[0-9]{13}-[a-z0-9-]+$/i.test(value) ? value : INITIAL_EPOCH;
  }

  function epochTime(value) {
    var match = /^epoch-z-([0-9]{13})-/.exec(value);
    return match ? Number(match[1]) : 0;
  }

  function resetEpochAfter(baseEpoch, commitId) {
    var now = typeof Date === 'function' && typeof Date.now === 'function' ? Date.now() : 0;
    var at = Math.max(now, epochTime(baseEpoch) + 1);
    return 'epoch-z-' + String(at).padStart(13, '0') + '-' + cleanCommitId(commitId).slice('commit-'.length);
  }

  function adapterState(raw) {
    var adapter = raw && raw.adapter;
    if (!adapter || adapter.schemaVersion !== ADAPTER_SCHEMA_VERSION) {
      return { revision: 0, epoch: INITIAL_EPOCH, commits: [], reset: false };
    }
    var revision = adapter.revision;
    if (typeof revision !== 'number' || !Number.isFinite(revision) || Math.trunc(revision) !== revision ||
        revision < 0 || revision > MAX_REVISION) revision = 0;
    var commits = [];
    if (Array.isArray(adapter.commits)) {
      adapter.commits.slice(-MAX_COMMIT_IDS).forEach(function retainCommit(value) {
        var id = cleanCommitId(value);
        if (id && commits.indexOf(id) < 0) commits.push(id);
      });
    }
    return {
      revision: revision,
      epoch: cleanEpoch(adapter.epoch),
      commits: commits,
      reset: adapter.reset === true
    };
  }

  function appendCommit(commits, commitId) {
    var next = Array.isArray(commits) ? commits.slice(-MAX_COMMIT_IDS) : [];
    var id = cleanCommitId(commitId);
    if (id && next.indexOf(id) < 0) next.push(id);
    return next.slice(-MAX_COMMIT_IDS);
  }

  function readStorageValue() {
    if (!storage) return { ok: false, value: null };
    try {
      var value = storage.getItem(STORAGE_KEY);
      if (value !== null && typeof value !== 'string') return { ok: false, value: null };
      return { ok: true, value: value };
    } catch (_) {
      return { ok: false, value: null };
    }
  }

  function nextRevision(revision) {
    return revision >= MAX_REVISION ? 1 : revision + 1;
  }

  function snapshotFromRead(read) {
    if (!BOUND || !read || read.ok !== true) return null;
    var raw = parse(read.value);
    var next = CHRONICLE.create(raw);
    if (!next) return null;
    var adapter = adapterState(raw);
    return {
      value: read.value,
      raw: raw,
      model: next,
      revision: adapter.revision,
      epoch: adapter.epoch,
      commits: adapter.commits,
      reset: adapter.reset
    };
  }

  function readSnapshot() {
    return snapshotFromRead(readStorageValue());
  }

  function adopt(snapshot) {
    if (!snapshot || !snapshot.model) return false;
    model = snapshot.model;
    modelRevision = snapshot.revision;
    modelEpoch = snapshot.epoch;
    modelCommits = snapshot.commits.slice();
    return true;
  }

  function rebaseFromStorage() {
    var snapshot = readSnapshot();
    if (snapshot) adopt(snapshot);
    return snapshot;
  }

  function serializeModel(target) {
    if (!target || typeof target.serialize !== 'function') return null;
    try {
      return JSON.stringify(target.serialize());
    } catch (_) {
      return null;
    }
  }

  function reconcileMissingStorage() {
    if (!BOUND || !storage || !model) return;
    var current = readStorageValue();
    if (!current.ok || current.value !== null) return;
    var empty = CHRONICLE.create(null);
    if (localCommits.length || modelEpoch !== INITIAL_EPOCH ||
        serializeModel(model) !== serializeModel(empty)) applyExternalClear();
  }

  function serializeSnapshot(target, metadata) {
    if (!target || typeof target.serialize !== 'function') return null;
    try {
      var raw = target.serialize();
      return JSON.stringify({
        schemaVersion: raw.schemaVersion,
        lastReadAt: raw.lastReadAt,
        entries: raw.entries,
        adapter: {
          schemaVersion: ADAPTER_SCHEMA_VERSION,
          revision: metadata.revision,
          epoch: metadata.epoch,
          commits: metadata.commits,
          reset: metadata.reset === true
        }
      });
    } catch (_) {
      return null;
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

  function rememberCommit(record) {
    if (!record || !cleanCommitId(record.id)) return;
    if (record.resetSnapshot === true) localCommits = [];
    localCommits = localCommits.filter(function retainOther(candidate) { return candidate.id !== record.id; });
    localCommits.push(record);
    if (localCommits.length > MAX_LOCAL_COMMITS) localCommits = localCommits.slice(-MAX_LOCAL_COMMITS);
  }

  function commitWorkingModel(working, metadata, reason, operation, settings, result) {
    model = working;
    modelRevision = metadata.revision;
    modelEpoch = metadata.epoch;
    modelCommits = metadata.commits.slice();
    if (settings.track !== false) {
      rememberCommit({
        id: metadata.commitId,
        epoch: metadata.epoch,
        revision: metadata.revision,
        reason: reason,
        operation: operation,
        replaceWithEmpty: settings.replaceWithEmpty === true,
        resetSnapshot: settings.resetSnapshot === true
      });
    }
    emit(reason);
    return {
      status: 'committed',
      result: result,
      commitId: metadata.commitId,
      epoch: metadata.epoch,
      revision: metadata.revision
    };
  }

  function transact(reason, operation, options) {
    if (!BOUND || !storage || typeof operation !== 'function') return { status: 'failed', result: null };
    var settings = options && typeof options === 'object' ? options : {};
    var commitId = cleanCommitId(settings.commitId) || nextCommitId();
    for (var attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
      var base = readSnapshot();
      if (!base) return { status: 'failed', result: null };
      // Never mutate the durable base model in place. A rejected write must be
      // able to adopt that untouched snapshot without leaking staged changes.
      var working = settings.replaceWithEmpty === true ? CHRONICLE.create(null) :
        settings.replaceWithRaw ? CHRONICLE.create(settings.replaceWithRaw) : CHRONICLE.create(base.raw);
      if (!working) {
        adopt(base);
        return { status: 'failed', result: null };
      }
      var before = serializeModel(base.model);
      var result = null;
      try { result = operation(working); }
      catch (_) {
        adopt(base);
        return { status: 'failed', result: null };
      }
      var after = serializeModel(working);
      if (!after) {
        adopt(base);
        return { status: 'failed', result: null };
      }
      if (after === before && settings.force !== true) {
        adopt(base);
        return { status: 'unchanged', result: result };
      }

      var revisionBase = typeof settings.baseRevision === 'number' && Number.isFinite(settings.baseRevision) ?
        Math.max(base.revision, Math.trunc(settings.baseRevision)) : base.revision;
      var revision = nextRevision(revisionBase);
      var epoch = settings.fixedEpoch ? cleanEpoch(settings.fixedEpoch) :
        settings.resetSnapshot === true ? resetEpochAfter(settings.epochBase || base.epoch, commitId) : base.epoch;
      var commitBase = Array.isArray(settings.baseCommits) ? settings.baseCommits : base.commits;
      var commits = settings.resetSnapshot === true ? [commitId] : appendCommit(commitBase, commitId);
      var metadata = {
        revision: revision,
        epoch: epoch,
        commits: commits,
        reset: settings.resetSnapshot === true,
        commitId: commitId
      };
      var serialized = serializeSnapshot(working, metadata);
      if (!serialized) {
        adopt(base);
        return { status: 'failed', result: null };
      }

      // localStorage has no compare-and-swap. Detect the useful race windows
      // deterministically: verify the exact base immediately before writing,
      // then verify the exact candidate immediately after. A conflicting tab
      // causes the operation to be rebuilt from its latest durable snapshot.
      var preflight = readStorageValue();
      if (!preflight.ok) {
        adopt(base);
        return { status: 'failed', result: null };
      }
      if (preflight.value !== base.value) continue;

      try { storage.setItem(STORAGE_KEY, serialized); }
      catch (_) {
        adopt(base);
        return { status: 'failed', result: null };
      }

      var verification = readStorageValue();
      if (!verification.ok) {
        // Web Storage setItem() is atomic when it returns successfully. If a
        // follow-up read is unavailable, retain the committed write; only a
        // successful unequal read is evidence that another tab won the race.
        return commitWorkingModel(working, metadata, reason, operation, settings, result);
      }
      if (verification.value !== serialized) continue;

      return commitWorkingModel(working, metadata, reason, operation, settings, result);
    }

    rebaseFromStorage();
    return { status: 'failed', result: null };
  }

  function mutate(reason, operation) {
    reconcileMissingStorage();
    return transact(reason, operation).status === 'committed';
  }

  function capturePresented(moment, context) {
    reconcileMissingStorage();
    if (!model || !context || typeof context !== 'object' || typeof model.capture !== 'function') return null;
    var witnessedAt = Date.now();
    var transaction = transact('capture', function captureOnWorkingModel(working) {
      return working.capture(moment, {
        sportId: context.sportId,
        fixtureId: context.fixtureId,
        homeTeam: context.homeTeam,
        awayTeam: context.awayTeam,
        mode: context.mode,
        witnessedAt: witnessedAt
      });
    });
    return transaction.status === 'failed' ? null : transaction.result;
  }

  function getState(options) {
    reconcileMissingStorage();
    if (!model || typeof model.state !== 'function') return frozenEmptyState();
    try { return model.state(options); } catch (_) { return frozenEmptyState(); }
  }

  function chapter(athleteId) {
    reconcileMissingStorage();
    if (!model || typeof model.chapter !== 'function') return null;
    try { return model.chapter(athleteId); } catch (_) { return null; }
  }

  function keep(witnessId, value) {
    return mutate('keep', function keepWitness(working) { working.keep(witnessId, value !== false); });
  }

  function remove(witnessId) {
    return mutate('remove', function removeWitness(working) { working.remove(witnessId); });
  }

  function markRead() {
    var readAt = Date.now();
    return mutate('read', function markWitnessesRead(working) { working.markRead(readAt); });
  }

  function reset() {
    if (!BOUND) return false;
    return transact('reset', function prepareEmptySnapshot() { return true; }, {
      replaceWithEmpty: true,
      force: true,
      resetSnapshot: true
    }).status === 'committed';
  }

  function localResetForEpoch(epoch) {
    for (var index = localCommits.length - 1; index >= 0; index -= 1) {
      var commit = localCommits[index];
      if (commit.epoch === epoch && commit.resetSnapshot === true) return commit;
    }
    return null;
  }

  function replayCommit(commit) {
    return transact('storage-recovery', commit.operation, {
      commitId: commit.id,
      fixedEpoch: commit.epoch,
      baseRevision: commit.revision,
      force: true,
      replaceWithEmpty: commit.replaceWithEmpty,
      resetSnapshot: commit.resetSnapshot,
      track: false
    });
  }

  function replayMissingLocalCommits() {
    localCommits = localCommits.filter(function retainRecoverableCommit(commit) {
      if (commit.epoch !== modelEpoch) return false;
      if (modelCommits.indexOf(commit.id) >= 0) return true;
      return modelRevision < commit.revision || modelRevision - commit.revision < MAX_COMMIT_IDS;
    });
    var pending = localCommits.slice();
    for (var index = 0; index < pending.length; index += 1) {
      var commit = pending[index];
      if (commit.epoch !== modelEpoch || commit.resetSnapshot === true ||
          modelCommits.indexOf(commit.id) >= 0) continue;
      var replayed = replayCommit(commit);
      if (!replayed || replayed.status === 'failed') return false;
    }
    return true;
  }

  function reassertCurrentEpoch() {
    var raw = parse(serializeModel(model));
    if (!raw) return false;
    var recovered = transact('storage-recovery', function retainCurrentEpoch() { return true; }, {
      replaceWithRaw: raw,
      fixedEpoch: modelEpoch,
      baseRevision: modelRevision,
      baseCommits: modelCommits,
      force: true,
      track: false
    });
    return recovered.status === 'committed';
  }

  function applyExternalClear() {
    var before = serializeModel(model);
    var clearedEpochBase = modelEpoch;
    localCommits = [];
    var cleared = transact('storage-clear', function prepareClearedSnapshot() { return true; }, {
      replaceWithEmpty: true,
      force: true,
      resetSnapshot: true,
      epochBase: clearedEpochBase
    });
    if (cleared.status === 'committed') return;

    // The key is already absent, so a failed tombstone write still means the
    // durable user-visible state is empty. Drop every pre-clear replay intent.
    model = CHRONICLE.create(null);
    modelRevision = 0;
    modelEpoch = INITIAL_EPOCH;
    modelCommits = [];
    if (serializeModel(model) !== before) emit('storage-clear');
  }

  function syncFromStorage(event) {
    if (!BOUND || !event || (event.key !== STORAGE_KEY && event.key !== null) ||
        (event.storageArea && event.storageArea !== storage)) return;
    var current = readStorageValue();
    if (!current.ok) return;
    var deletion = (event.key === STORAGE_KEY && event.newValue === null) || event.key === null;
    if (deletion && current.value === null) {
      applyExternalClear();
      return;
    }
    // Storage events are queued. Never roll the live model back with an older
    // event when another tab has already committed a newer snapshot.
    if (event.key === STORAGE_KEY && event.newValue !== current.value && !deletion) return;
    var next = snapshotFromRead(current);
    if (!next) return;
    var before = serializeModel(model);

    if (modelEpoch !== next.epoch && modelEpoch > next.epoch) {
      var resetCommit = localResetForEpoch(modelEpoch);
      if (resetCommit) {
        var resetRecovered = replayCommit(resetCommit);
        if (resetRecovered && resetRecovered.status === 'committed') replayMissingLocalCommits();
      }
      else reassertCurrentEpoch();
      return;
    }

    if (modelEpoch === next.epoch && next.revision < modelRevision) {
      reassertCurrentEpoch();
      return;
    }

    if (modelEpoch !== next.epoch) {
      localCommits = localCommits.filter(function retainWinningEpoch(commit) {
        return commit.epoch === next.epoch;
      });
    }
    adopt(next);
    if (serializeModel(model) !== before) emit('storage');
    replayMissingLocalCommits();
  }

  storage = resolveStorage();
  var initial = BOUND ? readSnapshot() : null;
  if (initial) adopt(initial);
  else model = BOUND ? CHRONICLE.create(null) : null;
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
