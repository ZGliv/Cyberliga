(function bootstrapCyberligaPresence(root) {
  'use strict';

  // Supabase documents browser ESM imports from esm.sh with the current v2 major:
  // https://supabase.com/docs/guides/self-hosting/self-hosted-functions
  // This URL is imported lazily only after a valid project URL and publishable key exist.
  // No npm package, secret key, service-role key, or authenticated user record is used here.
  var SUPABASE_ESM_URL = 'https://esm.sh/@supabase/supabase-js@2';
  var SESSION_KEY = 'cyberliga.presence.viewer.v1';
  var PAYLOAD_VERSION = 1;
  var DEFAULT_HEARTBEAT_MS = 45000;
  var DEFAULT_STALE_AFTER_MS = 120000;
  var MAX_RECONNECT_MS = 30000;

  var listeners = new Set();
  var testHooks = root.__CYBERLIGA_PRESENCE_TEST__;
  if (!testHooks || typeof testHooks !== 'object') testHooks = {};
  root.__CYBERLIGA_PRESENCE_TEST__ = testHooks;

  var runtime = {
    client: null,
    channel: null,
    context: null,
    generation: 0,
    retryAttempt: 0,
    retryTimer: null,
    heartbeatTimer: null,
    rawPresence: Object.create(null),
    joinedAt: 0,
    manualDisconnect: true,
    environmentAttached: false,
    forcedVisible: null,
    forcedOnline: null,
    lastEvent: 'idle'
  };

  var snapshot = freezeSnapshot({
    status: 'idle',
    source: 'local',
    realtime: false,
    connected: false,
    synced: false,
    estimated: true,
    reason: 'not-connected',
    topic: null,
    leagueId: null,
    matchId: null,
    page: pageBucket(),
    localeBucket: localeBucket(),
    viewerId: getViewerId(),
    totalViewers: 0,
    visibleViewers: 0,
    clubLean: {},
    undecidedViewers: 0,
    updatedAt: now(),
    lastEvent: 'idle'
  });

  var api = Object.freeze({
    version: '1.0.0',
    connect: connect,
    subscribe: subscribe,
    getSnapshot: getSnapshot,
    disconnect: disconnect,
    setClubLean: setClubLean
  });

  root.CyberligaPresence = api;

  function now() {
    return typeof testHooks.now === 'function' ? Number(testHooks.now()) : Date.now();
  }

  function random() {
    return typeof testHooks.random === 'function' ? Number(testHooks.random()) : Math.random();
  }

  function setTimer(callback, delay) {
    var fn = typeof testHooks.setTimeout === 'function' ? testHooks.setTimeout : root.setTimeout;
    return fn.call(root, callback, delay);
  }

  function clearTimer(timer) {
    if (timer == null) return;
    var fn = typeof testHooks.clearTimeout === 'function' ? testHooks.clearTimeout : root.clearTimeout;
    fn.call(root, timer);
  }

  function setRepeatingTimer(callback, delay) {
    var fn = typeof testHooks.setInterval === 'function' ? testHooks.setInterval : root.setInterval;
    return fn.call(root, callback, delay);
  }

  function clearRepeatingTimer(timer) {
    if (timer == null) return;
    var fn = typeof testHooks.clearInterval === 'function' ? testHooks.clearInterval : root.clearInterval;
    fn.call(root, timer);
  }

  function safeString(value, fallback, maxLength) {
    var text = value == null ? '' : String(value);
    text = text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, maxLength || 64);
    return text || fallback || null;
  }

  function pageBucket(explicitPage) {
    var page = explicitPage;
    if (!page && root.location && root.location.pathname) {
      var parts = root.location.pathname.split('/').filter(Boolean);
      page = parts.length ? parts[parts.length - 1].replace(/\.html?$/i, '') : 'world';
    }
    return safeString(page, 'world', 48);
  }

  function localeBucket(explicitLocale) {
    var locale = explicitLocale;
    if (!locale && root.navigator) {
      locale = (root.navigator.languages && root.navigator.languages[0]) || root.navigator.language;
    }
    // Base language only (for example, "en"), deliberately excluding region and timezone.
    var base = String(locale || 'und').toLowerCase().split(/[-_]/)[0];
    return /^[a-z]{2,3}$/.test(base) ? base : 'und';
  }

  function makeViewerId() {
    var value = '';
    if (typeof testHooks.uuid === 'function') value = String(testHooks.uuid());
    else if (root.crypto && typeof root.crypto.randomUUID === 'function') value = root.crypto.randomUUID();
    else if (root.crypto && typeof root.crypto.getRandomValues === 'function') {
      var bytes = new Uint8Array(16);
      root.crypto.getRandomValues(bytes);
      value = Array.prototype.map.call(bytes, function toHex(byte) {
        return byte.toString(16).padStart(2, '0');
      }).join('');
    } else {
      value = now().toString(36) + '-' + random().toString(36).slice(2) + random().toString(36).slice(2);
    }
    return 'viewer-' + value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 57);
  }

  function getViewerId() {
    var stored = '';
    try {
      stored = root.sessionStorage ? root.sessionStorage.getItem(SESSION_KEY) || '' : '';
    } catch (_error) {
      stored = '';
    }
    if (/^viewer-[a-z0-9-]{8,64}$/.test(stored)) return stored;
    var viewerId = makeViewerId();
    try {
      if (root.sessionStorage) root.sessionStorage.setItem(SESSION_KEY, viewerId);
    } catch (_error) {
      // Some privacy modes disable sessionStorage. The in-memory ID remains ephemeral.
    }
    return viewerId;
  }

  function isVisible() {
    if (runtime.forcedVisible !== null) return runtime.forcedVisible;
    if (typeof testHooks.isVisible === 'function') return Boolean(testHooks.isVisible());
    return !root.document || root.document.visibilityState !== 'hidden';
  }

  function isOnline() {
    if (runtime.forcedOnline !== null) return runtime.forcedOnline;
    if (typeof testHooks.isOnline === 'function') return Boolean(testHooks.isOnline());
    return !root.navigator || root.navigator.onLine !== false;
  }

  function freezeSnapshot(value) {
    var lean = Object.freeze(Object.assign({}, value.clubLean || {}));
    return Object.freeze(Object.assign({}, value, { clubLean: lean }));
  }

  function publish(patch) {
    snapshot = freezeSnapshot(Object.assign({}, snapshot, patch, {
      updatedAt: now(),
      lastEvent: patch && patch.lastEvent ? patch.lastEvent : runtime.lastEvent
    }));
    listeners.forEach(function notify(listener) {
      try {
        listener(snapshot);
      } catch (error) {
        setTimer(function rethrowListenerError() { throw error; }, 0);
      }
    });
  }

  function getSnapshot() {
    return snapshot;
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('CyberligaPresence.subscribe requires a function');
    listeners.add(listener);
    listener(snapshot);
    return function unsubscribe() { listeners.delete(listener); };
  }

  function readMeta(name) {
    if (!root.document || !root.document.querySelector) return '';
    var element = root.document.querySelector('meta[name="' + name + '"]');
    return element ? element.getAttribute('content') || '' : '';
  }

  function resolveContext(options) {
    options = options || {};
    var configured = root.__CYBERLIGA_CONFIG__ || root.CYBERLIGA_CONFIG || {};
    var url = options.supabaseUrl || options.projectUrl || configured.supabaseUrl || configured.projectUrl || readMeta('cyberliga-supabase-url');
    var key = options.supabasePublishableKey || options.publishableKey || configured.supabasePublishableKey || configured.publishableKey || readMeta('cyberliga-supabase-publishable-key');
    var leagueId = safeString(options.leagueId || options.league, 'unknown-league', 64);
    var matchId = safeString(options.matchId || options.match, null, 96);
    var clubLean = safeString(options.clubLean || options.clubId, null, 64);
    var normalizedUrl = normalizeProjectUrl(url);
    var keyResult = validatePublishableKey(key);
    var reason = null;

    if (!matchId) reason = 'missing-match-id';
    else if (!url || !key) reason = 'missing-config';
    else if (!normalizedUrl) reason = 'invalid-project-url';
    else if (!keyResult.valid) reason = keyResult.reason;

    return {
      supabaseUrl: normalizedUrl,
      publishableKey: keyResult.valid ? String(key) : '',
      leagueId: leagueId,
      matchId: matchId,
      topic: matchId ? 'match:' + matchId : null,
      page: pageBucket(options.page),
      localeBucket: localeBucket(options.locale),
      clubLean: clubLean,
      reason: reason
    };
  }

  function normalizeProjectUrl(value) {
    if (!value) return '';
    try {
      var parsed = new URL(String(value));
      var local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1';
      if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) return '';
      parsed.pathname = parsed.pathname.replace(/\/+$/, '');
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString().replace(/\/$/, '');
    } catch (_error) {
      return '';
    }
  }

  function validatePublishableKey(value) {
    var key = String(value || '').trim();
    if (/^sb_secret_/i.test(key) || /service[_-]?role/i.test(key)) {
      return { valid: false, reason: 'secret-key-refused' };
    }
    // Cyberliga intentionally requires the modern browser-safe publishable key.
    if (!/^sb_publishable_[a-z0-9._-]+$/i.test(key)) {
      return { valid: false, reason: key ? 'invalid-publishable-key' : 'missing-config' };
    }
    return { valid: true, reason: null };
  }

  function localCounts() {
    var clubLean = {};
    if (runtime.context && runtime.context.clubLean) clubLean[runtime.context.clubLean] = 1;
    return {
      totalViewers: 1,
      visibleViewers: isVisible() ? 1 : 0,
      clubLean: clubLean,
      undecidedViewers: runtime.context && runtime.context.clubLean ? 0 : 1
    };
  }

  function publishLocal(status, reason, eventName) {
    var counts = localCounts();
    runtime.lastEvent = eventName || status;
    publish(Object.assign({}, counts, {
      status: status,
      source: 'local',
      realtime: false,
      connected: false,
      synced: false,
      estimated: true,
      reason: reason,
      topic: runtime.context ? runtime.context.topic : null,
      leagueId: runtime.context ? runtime.context.leagueId : null,
      matchId: runtime.context ? runtime.context.matchId : null,
      page: runtime.context ? runtime.context.page : pageBucket(),
      localeBucket: runtime.context ? runtime.context.localeBucket : localeBucket(),
      viewerId: getViewerId(),
      lastEvent: runtime.lastEvent
    }));
  }

  function makePayload() {
    var context = runtime.context || {};
    var timestamp = now();
    return {
      v: PAYLOAD_VERSION,
      viewer_id: getViewerId(),
      league: context.leagueId || 'unknown-league',
      match: context.matchId || 'unknown-match',
      page: context.page || pageBucket(),
      visible: isVisible(),
      locale: context.localeBucket || localeBucket(),
      club: context.clubLean || null,
      joined_at: runtime.joinedAt || timestamp,
      seen_at: timestamp
    };
  }

  function presenceList(value) {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.metas)) return value.metas;
    return [];
  }

  function aggregatePresenceState(state, timestamp) {
    timestamp = Number(timestamp == null ? now() : timestamp);
    var staleAfterMs = Number(testHooks.staleAfterMs || DEFAULT_STALE_AFTER_MS);
    var viewers = Object.create(null);

    Object.keys(state || {}).forEach(function eachPresenceKey(key) {
      presenceList(state[key]).forEach(function eachPresence(presence) {
        if (!presence || typeof presence !== 'object') return;
        var seenAt = Number(presence.seen_at || presence.seenAt || 0);
        if (seenAt && timestamp - seenAt > staleAfterMs) return;
        var viewerId = safeString(presence.viewer_id || presence.viewerId || key, null, 72);
        if (!viewerId) return;
        var existing = viewers[viewerId];
        if (!existing || Number(existing.seen_at || 0) <= seenAt) viewers[viewerId] = presence;
      });
    });

    var clubLean = Object.create(null);
    var visibleViewers = 0;
    var undecidedViewers = 0;
    var ids = Object.keys(viewers);
    ids.forEach(function countViewer(viewerId) {
      var presence = viewers[viewerId];
      if (presence.visible !== false) visibleViewers += 1;
      var club = safeString(presence.club, null, 64);
      if (club) clubLean[club] = (clubLean[club] || 0) + 1;
      else undecidedViewers += 1;
    });

    var sortedLean = {};
    Object.keys(clubLean).sort().forEach(function sortClub(club) { sortedLean[club] = clubLean[club]; });
    return {
      totalViewers: ids.length,
      visibleViewers: visibleViewers,
      clubLean: sortedLean,
      undecidedViewers: undecidedViewers
    };
  }

  function currentPresenceState() {
    if (!runtime.channel || typeof runtime.channel.presenceState !== 'function') return null;
    try {
      return runtime.channel.presenceState();
    } catch (_error) {
      return null;
    }
  }

  function mergeJoin(payload) {
    if (!payload || !payload.key) return;
    var next = presenceList(runtime.rawPresence[payload.key]).slice();
    presenceList(payload.newPresences).forEach(function addPresence(presence) { next.push(presence); });
    runtime.rawPresence[payload.key] = next;
  }

  function mergeLeave(payload) {
    if (!payload || !payload.key) return;
    var leaving = presenceList(payload.leftPresences);
    if (!leaving.length) {
      delete runtime.rawPresence[payload.key];
      return;
    }
    var leavingRefs = new Set(leaving.map(function presenceRef(presence) {
      return presence && (presence.presence_ref || presence.phx_ref || presence.viewer_id);
    }).filter(Boolean));
    var remaining = presenceList(runtime.rawPresence[payload.key]).filter(function keepPresence(presence) {
      var ref = presence && (presence.presence_ref || presence.phx_ref || presence.viewer_id);
      return !ref || !leavingRefs.has(ref);
    });
    if (remaining.length) runtime.rawPresence[payload.key] = remaining;
    else delete runtime.rawPresence[payload.key];
  }

  function updateFromPresence(eventName, payload) {
    if (eventName === 'join') mergeJoin(payload);
    if (eventName === 'leave') mergeLeave(payload);
    var authoritative = currentPresenceState();
    if (authoritative) runtime.rawPresence = authoritative;
    var counts = aggregatePresenceState(runtime.rawPresence);
    runtime.lastEvent = eventName;
    publish(Object.assign({}, counts, {
      status: 'connected',
      source: 'supabase',
      realtime: true,
      connected: true,
      synced: true,
      estimated: false,
      reason: null,
      lastEvent: eventName
    }));
  }

  function attachChannelHandlers(channel, generation) {
    channel
      .on('presence', { event: 'sync' }, function onSync() {
        if (generation !== runtime.generation || channel !== runtime.channel) return;
        updateFromPresence('sync');
      })
      .on('presence', { event: 'join' }, function onJoin(payload) {
        if (generation !== runtime.generation || channel !== runtime.channel) return;
        updateFromPresence('join', payload);
      })
      .on('presence', { event: 'leave' }, function onLeave(payload) {
        if (generation !== runtime.generation || channel !== runtime.channel) return;
        updateFromPresence('leave', payload);
      });
  }

  async function trackCurrent(eventName) {
    var channel = runtime.channel;
    if (!channel || typeof channel.track !== 'function') return false;
    var payload = makePayload();
    runtime.rawPresence[payload.viewer_id] = [payload];
    var result;
    try {
      result = await channel.track(payload);
    } catch (_error) {
      result = 'error';
    }
    if (channel !== runtime.channel || runtime.manualDisconnect) return false;
    if (result && result !== 'ok') {
      scheduleReconnect('track-' + String(result));
      return false;
    }
    if (eventName) {
      var counts = aggregatePresenceState(runtime.rawPresence);
      runtime.lastEvent = eventName;
      publish(Object.assign({}, counts, {
        status: 'connected',
        source: snapshot.synced ? 'supabase' : 'local',
        realtime: snapshot.synced,
        connected: true,
        synced: snapshot.synced,
        estimated: !snapshot.synced,
        reason: snapshot.synced ? null : 'awaiting-sync',
        lastEvent: eventName
      }));
    }
    return true;
  }

  function startHeartbeat() {
    stopHeartbeat();
    var heartbeatMs = Number(testHooks.heartbeatMs || DEFAULT_HEARTBEAT_MS);
    runtime.heartbeatTimer = setRepeatingTimer(function heartbeat() {
      if (!isOnline()) {
        handleOffline();
        return;
      }
      trackCurrent('heartbeat');
    }, heartbeatMs);
  }

  function stopHeartbeat() {
    clearRepeatingTimer(runtime.heartbeatTimer);
    runtime.heartbeatTimer = null;
  }

  async function loadCreateClient() {
    if (typeof testHooks.createClient === 'function') return testHooks.createClient;
    if (typeof testHooks.importClient === 'function') {
      var injected = await testHooks.importClient(SUPABASE_ESM_URL);
      if (injected && typeof injected.createClient === 'function') return injected.createClient;
      throw new Error('Injected Supabase module did not export createClient');
    }
    var module = await import(SUPABASE_ESM_URL);
    if (!module || typeof module.createClient !== 'function') throw new Error('Supabase ESM module did not export createClient');
    return module.createClient;
  }

  async function ensureClient(generation) {
    if (runtime.client) return runtime.client;
    var createClient = await loadCreateClient();
    if (generation !== runtime.generation || runtime.manualDisconnect) return null;
    runtime.client = createClient(runtime.context.supabaseUrl, runtime.context.publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
    return runtime.client;
  }

  async function openChannel(generation, reconnecting) {
    if (generation !== runtime.generation || runtime.manualDisconnect) return;
    if (!isOnline()) {
      publishLocal('offline', 'browser-offline', 'offline');
      return;
    }
    publishLocal(reconnecting ? 'reconnecting' : 'connecting', reconnecting ? 'realtime-reconnect' : 'awaiting-realtime', reconnecting ? 'reconnect' : 'connect');

    var client;
    try {
      client = await ensureClient(generation);
    } catch (_error) {
      if (generation === runtime.generation && !runtime.manualDisconnect) scheduleReconnect('client-load-failed');
      return;
    }
    if (!client || generation !== runtime.generation || runtime.manualDisconnect) return;
    if (!isOnline()) {
      handleOffline();
      return;
    }

    var channel;
    try {
      channel = client.channel(runtime.context.topic, {
        config: { presence: { key: getViewerId() }, private: false }
      });
      runtime.channel = channel;
      attachChannelHandlers(channel, generation);
      channel.subscribe(function onSubscriptionStatus(status) {
        if (generation !== runtime.generation || channel !== runtime.channel || runtime.manualDisconnect) return;
        if (status === 'SUBSCRIBED') {
          runtime.retryAttempt = 0;
          runtime.joinedAt = runtime.joinedAt || now();
          runtime.lastEvent = 'subscribed';
          var counts = localCounts();
          publish(Object.assign({}, counts, {
            status: 'connected',
            source: 'local',
            realtime: false,
            connected: true,
            synced: false,
            estimated: true,
            reason: 'awaiting-sync',
            lastEvent: 'subscribed'
          }));
          startHeartbeat();
          trackCurrent('track');
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          scheduleReconnect(String(status).toLowerCase().replace(/_/g, '-'));
        }
      });
    } catch (_error) {
      if (channel === runtime.channel) runtime.channel = null;
      scheduleReconnect('channel-create-failed');
    }
  }

  function reconnectDelay() {
    if (typeof testHooks.backoffMs === 'function') return Number(testHooks.backoffMs(runtime.retryAttempt));
    var exponential = Math.min(MAX_RECONNECT_MS, 1000 * Math.pow(2, Math.max(0, runtime.retryAttempt - 1)));
    return Math.round(exponential * (0.85 + random() * 0.3));
  }

  function scheduleReconnect(reason) {
    if (runtime.manualDisconnect || !runtime.context || runtime.context.reason) return;
    stopHeartbeat();
    if (!isOnline()) {
      handleOffline();
      return;
    }
    if (runtime.retryTimer != null) return;

    var generation = runtime.generation;
    var oldChannel = runtime.channel;
    runtime.channel = null;
    runtime.retryAttempt += 1;
    publishLocal('reconnecting', reason || 'realtime-unavailable', 'reconnect-scheduled');

    if (oldChannel && runtime.client && typeof runtime.client.removeChannel === 'function') {
      Promise.resolve(runtime.client.removeChannel(oldChannel)).catch(function ignoreRemoveError() {});
    }

    runtime.retryTimer = setTimer(function retryConnection() {
      runtime.retryTimer = null;
      if (generation !== runtime.generation || runtime.manualDisconnect) return;
      openChannel(generation, true);
    }, Math.max(0, reconnectDelay()));
  }

  function attachEnvironment() {
    if (runtime.environmentAttached || !root.addEventListener) return;
    root.addEventListener('online', handleOnline);
    root.addEventListener('offline', handleOffline);
    root.addEventListener('pagehide', handlePageHide);
    root.addEventListener('pageshow', handlePageShow);
    if (root.document && root.document.addEventListener) root.document.addEventListener('visibilitychange', handleVisibilityChange);
    runtime.environmentAttached = true;
  }

  function detachEnvironment() {
    if (!runtime.environmentAttached || !root.removeEventListener) return;
    root.removeEventListener('online', handleOnline);
    root.removeEventListener('offline', handleOffline);
    root.removeEventListener('pagehide', handlePageHide);
    root.removeEventListener('pageshow', handlePageShow);
    if (root.document && root.document.removeEventListener) root.document.removeEventListener('visibilitychange', handleVisibilityChange);
    runtime.environmentAttached = false;
  }

  function handleVisibilityChange() {
    if (runtime.manualDisconnect) return;
    if (runtime.channel && snapshot.connected) trackCurrent('visibility');
    else publishLocal(snapshot.status === 'offline' ? 'offline' : 'local', snapshot.reason || 'local-only', 'visibility');
  }

  function handleOffline() {
    if (runtime.manualDisconnect) return;
    clearTimer(runtime.retryTimer);
    runtime.retryTimer = null;
    stopHeartbeat();
    var channel = runtime.channel;
    runtime.channel = null;
    if (channel && runtime.client && typeof runtime.client.removeChannel === 'function') {
      Promise.resolve(runtime.client.removeChannel(channel)).catch(function ignoreRemoveError() {});
    }
    publishLocal('offline', 'browser-offline', 'offline');
  }

  function handleOnline() {
    if (runtime.manualDisconnect || !runtime.context || runtime.context.reason || runtime.channel) return;
    clearTimer(runtime.retryTimer);
    runtime.retryTimer = null;
    openChannel(runtime.generation, true);
  }

  function handlePageHide() {
    if (runtime.manualDisconnect || !runtime.channel) return;
    try { runtime.channel.untrack(); } catch (_error) { /* best effort during unload */ }
  }

  function handlePageShow() {
    if (runtime.manualDisconnect) return;
    if (runtime.channel && snapshot.connected) trackCurrent('pageshow');
    else handleOnline();
  }

  async function cleanupConnection() {
    clearTimer(runtime.retryTimer);
    runtime.retryTimer = null;
    stopHeartbeat();
    var channel = runtime.channel;
    var client = runtime.client;
    runtime.channel = null;
    runtime.client = null;
    runtime.rawPresence = Object.create(null);
    if (channel && typeof channel.untrack === 'function') {
      try { await channel.untrack(); } catch (_error) { /* best effort */ }
    }
    if (channel && client && typeof client.removeChannel === 'function') {
      try { await client.removeChannel(channel); } catch (_error) { /* best effort */ }
    }
  }

  async function connect(options) {
    runtime.manualDisconnect = true;
    runtime.generation += 1;
    var generation = runtime.generation;
    detachEnvironment();
    await cleanupConnection();
    if (generation !== runtime.generation) return api;

    runtime.context = resolveContext(options);
    runtime.joinedAt = now();
    runtime.retryAttempt = 0;
    runtime.manualDisconnect = false;
    attachEnvironment();

    if (runtime.context.reason) {
      publishLocal('local', runtime.context.reason, 'fallback');
      return api;
    }
    if (!isOnline()) {
      publishLocal('offline', 'browser-offline', 'offline');
      return api;
    }
    await openChannel(generation, false);
    return api;
  }

  async function disconnect() {
    runtime.manualDisconnect = true;
    runtime.generation += 1;
    detachEnvironment();
    await cleanupConnection();
    runtime.lastEvent = 'disconnect';
    publish({
      status: 'disconnected',
      source: 'local',
      realtime: false,
      connected: false,
      synced: false,
      estimated: false,
      reason: 'disconnected',
      totalViewers: 0,
      visibleViewers: 0,
      clubLean: {},
      undecidedViewers: 0,
      lastEvent: 'disconnect'
    });
    return api;
  }

  function setClubLean(clubId) {
    if (!runtime.context) return api;
    runtime.context.clubLean = safeString(clubId, null, 64);
    if (runtime.manualDisconnect) return api;
    if (runtime.channel && snapshot.connected) trackCurrent('club-lean');
    else publishLocal(snapshot.status === 'offline' ? 'offline' : 'local', snapshot.reason || 'local-only', 'club-lean');
    return api;
  }

  // Deterministic, dependency-free hooks for fake-channel browser tests. Consumers should
  // not use these in product UI; they deliberately expose aggregates and lifecycle controls,
  // never the configured key, raw peer IDs, or a Supabase client instance.
  Object.assign(testHooks, {
    cdnUrl: SUPABASE_ESM_URL,
    aggregatePresenceState: aggregatePresenceState,
    getPayload: makePayload,
    getRuntime: function getRuntime() {
      return Object.freeze({
        generation: runtime.generation,
        retryAttempt: runtime.retryAttempt,
        topic: runtime.context ? runtime.context.topic : null,
        hasChannel: Boolean(runtime.channel),
        manualDisconnect: runtime.manualDisconnect
      });
    },
    dispatchPresence: function dispatchPresence(eventName, payload) { updateFromPresence(eventName, payload); },
    forceVisibility: function forceVisibility(visible) {
      runtime.forcedVisible = visible == null ? null : Boolean(visible);
      handleVisibilityChange();
    },
    forceOnline: function forceOnline(online) {
      runtime.forcedOnline = online == null ? null : Boolean(online);
      if (isOnline()) handleOnline();
      else handleOffline();
    },
    runStaleSweep: function runStaleSweep() { updateFromPresence('stale-sweep'); },
    reset: async function reset() {
      runtime.forcedVisible = null;
      runtime.forcedOnline = null;
      await disconnect();
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
