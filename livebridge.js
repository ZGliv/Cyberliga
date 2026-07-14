(function bootstrapCyberligaLiveBridge(root) {
  'use strict';

  var started = false;
  var startGeneration = 0;
  var unsubscribe = null;
  var lastOptions = null;

  function clean(value, fallback, maxLength) {
    var text = String(value == null ? '' : value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, maxLength || 96);
    return text || fallback || null;
  }

  function inferOptions(overrides) {
    var params = new URLSearchParams(root.location ? root.location.search : '');
    var path = root.location && root.location.pathname
      ? root.location.pathname.split('/').pop().replace(/\.html?$/i, '') || 'world'
      : 'world';
    var cycle = Math.floor(Date.now() / (12 * 60 * 1000));
    var page = clean(overrides && overrides.page, clean(path, 'world', 48), 48);
    var league = clean(
      overrides && (overrides.leagueId || overrides.league) ||
      params.get('sport') ||
      (page === 'index' ? 'soccer' : 'world'),
      'world',
      64
    );
    var match = clean(
      overrides && (overrides.matchId || overrides.match) ||
      params.get('match') ||
      params.get('story') ||
      (page === 'world' ? 'world-lobby-' + cycle : page + '-' + league + '-' + cycle),
      null,
      96
    );
    return {
      leagueId: league,
      matchId: match,
      page: page,
      clubLean: clean(overrides && (overrides.clubLean || overrides.clubId), null, 64),
      clubLeanInput: !overrides || overrides.clubLeanInput !== false
    };
  }

  function normalizedConfig(payload) {
    payload = payload && payload.config ? payload.config : payload || {};
    var url = payload.supabaseUrl || payload.projectUrl || '';
    var key = payload.supabasePublishableKey || payload.publishableKey || '';
    return { supabaseUrl: url, supabasePublishableKey: key };
  }

  async function loadPublicConfig() {
    var existing = root.__CYBERLIGA_CONFIG__ || root.CYBERLIGA_CONFIG;
    if (existing && (existing.supabaseUrl || existing.projectUrl)) return normalizedConfig(existing);
    if (typeof root.fetch !== 'function') return {};
    if (!root.location || !/^https?:$/.test(root.location.protocol)) return {};
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = root.setTimeout(function abortSlowConfig() {
      if (controller) controller.abort();
    }, 1800);
    try {
      var response = await root.fetch('/api/config', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller ? controller.signal : undefined
      });
      if (!response.ok || !(response.headers.get('content-type') || '').includes('application/json')) return {};
      return normalizedConfig(await response.json());
    } catch (_error) {
      return {};
    } finally {
      root.clearTimeout(timer);
    }
  }

  function labelFor(snapshot) {
    var viewers = Math.max(1, Number(snapshot.totalViewers) || 1);
    if (snapshot.synced && snapshot.realtime) return viewers + (viewers === 1 ? ' WATCHING LIVE' : ' WATCHING LIVE');
    if (snapshot.status === 'connecting' || snapshot.status === 'reconnecting') return 'CONNECTING WORLD SIGNAL';
    if (snapshot.status === 'offline') return 'OFFLINE · LOCAL VIEW';
    if (snapshot.status === 'disconnected') return 'WORLD SIGNAL CLOSED';
    return '1 WATCHING · LOCAL';
  }

  function render(snapshot) {
    var label = labelFor(snapshot);
    var nodes = root.document ? root.document.querySelectorAll('[data-cyberliga-presence]') : [];
    nodes.forEach(function updatePresenceNode(node) {
      node.textContent = label;
      node.dataset.presenceStatus = snapshot.status;
      node.dataset.presenceSource = snapshot.source;
      node.dataset.presenceRealtime = String(Boolean(snapshot.realtime));
      node.title = snapshot.realtime
        ? 'Real-time anonymous spectators on this signal'
        : 'Local spectator fallback; live presence is not configured';
    });
    if (root.document && root.document.documentElement) {
      root.document.documentElement.dataset.presenceStatus = snapshot.status;
      root.document.documentElement.dataset.presenceSource = snapshot.source;
      root.document.documentElement.dataset.presenceRealtime = String(Boolean(snapshot.realtime));
    }
    try {
      root.dispatchEvent(new CustomEvent('cyberliga:presence', { detail: snapshot }));
    } catch (_error) {
      // CustomEvent is missing only in very old browsers; the visible status still updates.
    }
  }

  function bindClubLean() {
    if (!root.document || root.document.documentElement.dataset.presenceLeanBound === 'true') return;
    root.document.documentElement.dataset.presenceLeanBound = 'true';
    root.document.addEventListener('click', function onClubLean(event) {
      var target = event.target && event.target.closest ? event.target.closest('[data-club-lean]') : null;
      if (!target || !root.CyberligaPresence) return;
      root.CyberligaPresence.setClubLean(target.getAttribute('data-club-lean'));
    });
  }

  async function start(overrides) {
    if (!root.CyberligaPresence) return null;
    var generation = ++startGeneration;
    var inferred = inferOptions(overrides || {});
    var config = await loadPublicConfig();
    if (generation !== startGeneration) return root.CyberligaPresence.getSnapshot();
    lastOptions = Object.assign({}, inferred, config);
    if (unsubscribe) unsubscribe();
    unsubscribe = root.CyberligaPresence.subscribe(render);
    if (inferred.clubLeanInput) bindClubLean();
    started = true;
    await root.CyberligaPresence.connect(lastOptions);
    return root.CyberligaPresence.getSnapshot();
  }

  async function stop() {
    startGeneration += 1;
    started = false;
    lastOptions = null;
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    if (root.CyberligaPresence) await root.CyberligaPresence.disconnect();
  }

  root.CyberligaLiveBridge = Object.freeze({
    start: start,
    stop: stop,
    getState: function getState() {
      return Object.freeze({
        started: started,
        options: lastOptions ? Object.assign({}, lastOptions, { supabasePublishableKey: lastOptions.supabasePublishableKey ? '[public key configured]' : '' }) : null,
        presence: root.CyberligaPresence ? root.CyberligaPresence.getSnapshot() : null
      });
    }
  });

  function autoStart() {
    if (!root.document || root.document.body.hasAttribute('data-cyberliga-presence-manual')) return;
    if (root.document.querySelector('[data-cyberliga-presence]')) start();
  }

  if (root.document && root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', autoStart, { once: true });
  else autoStart();
})(typeof window !== 'undefined' ? window : globalThis);
