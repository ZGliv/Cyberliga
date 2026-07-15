(function bootstrapCyberligaFanworld(root) {
  'use strict';

  var C = root.CYBERLIGA_CONTENT;
  var M = root.CyberligaMythos;
  var MomentEngine = root.CyberligaAthleteMoments;
  if (!C || !M || typeof document === 'undefined') return;

  var STORAGE_KEY = 'cyberliga_fan_signal_v1';
  var VERSION = 1;
  var LIVE_POLL_MS = 5000;
  var LIVE_STALE_MS = 15000;
  var LIVE_TIMEOUT_MS = 4000;
  var pageKind = document.getElementById('globe') ? 'world' : document.getElementById('league-hq') ? 'league' : document.body.classList.contains('athlete-file') || /player\.html$/i.test(location.pathname) ? 'player' : 'supporting';
  document.documentElement.dataset.fwPage = pageKind;
  var baseRenderer = null;
  var drawer = null;
  var pulseElement = null;
  var pulseStories = [];
  var pulseIndex = 0;
  var currentPreviewStory = null;
  var cachedPreviewStory = null;
  var previewRenderSignature = '';
  var currentPlayerProfile = null;
  var toastTimer = 0;
  var lastDossierId = '';
  var pulseFixtureSignature = '';
  var drawerReturnFocus = null;
  var liveModel = null;
  try { if (MomentEngine && typeof MomentEngine.create === 'function') liveModel = MomentEngine.create(C); }
  catch (_error) { liveModel = null; }
  var liveMomentState = {
    phase: 'idle',
    refreshing: false,
    source: 'none',
    canonical: false,
    degraded: false,
    degradedReason: null,
    observedAt: null,
    receivedAt: 0,
    stale: false,
    errorCode: null,
    raw: [],
    items: [],
    discovery: true
  };
  var liveMomentTimer = 0;
  var liveMomentAbort = null;
  var liveMomentGeneration = 0;
  var liveMomentRetry = 0;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
    });
  }
  function uniqueStrings(list, limit) {
    var seen = Object.create(null);
    return (Array.isArray(list) ? list : []).map(String).filter(function (value) {
      if (!value || seen[value]) return false;
      seen[value] = true;
      return true;
    }).slice(0, limit || 80);
  }
  function cleanString(value, limit) {
    return typeof value === 'string' ? value.trim().slice(0, limit || 240) : '';
  }
  function normalizeCall(key, call) {
    var fixtureId = cleanString(key, 240);
    if (!fixtureId || !call || typeof call !== 'object' || Array.isArray(call)) return null;
    if (cleanString(call.fixtureId,240) !== fixtureId || (call.side !== 'home' && call.side !== 'away')) return null;
    if (!call.home || !call.away || typeof call.home !== 'object' || typeof call.away !== 'object') return null;
    var requiredHome = [call.home.id,call.home.name,call.home.code].every(function (value) { return Boolean(cleanString(value,120)); });
    var requiredAway = [call.away.id,call.away.name,call.away.code].every(function (value) { return Boolean(cleanString(value,120)); });
    if (!requiredHome || !requiredAway || call.resolution != null || call.points != null || call.status !== 'open') return null;
    var sport = C.getSport(cleanString(call.sportId,80));
    var home = sport && M.resolveTeam(sport,call.home.id);
    var away = sport && M.resolveTeam(sport,call.away.id);
    if (!sport || !home || !away || home.id === away.id) return null;
    var chosen = call.side === 'home' ? home : away;
    if (cleanString(call.teamId,120) !== chosen.id || !cleanString(call.teamName,160) || !cleanString(call.headline,240)) return null;
    var createdAt = Number(call.createdAt);
    var updatedAt = Number(call.updatedAt);
    if (!Number.isFinite(createdAt) || createdAt < 0 || !Number.isFinite(updatedAt) || updatedAt < createdAt) return null;
    return {
      fixtureId: fixtureId,
      sportId: sport.id,
      createdAt: createdAt,
      updatedAt: updatedAt,
      side: call.side,
      teamId: chosen.id,
      teamName: chosen.name,
      home: {id:home.id,name:home.name,code:home.code},
      away: {id:away.id,name:away.name,code:away.code},
      headline: cleanString(call.headline,240),
      status: 'open',
      resolution: null,
      points: null,
      source: 'local-fan-signal'
    };
  }
  function normalizeState(raw) {
    var source = raw && typeof raw === 'object' ? raw : {};
    var calls = source.calls && typeof source.calls === 'object' && !Array.isArray(source.calls) ? source.calls : {};
    var follows = {
      teams: uniqueStrings(source.follows && source.follows.teams),
      athletes: uniqueStrings(source.follows && source.follows.athletes)
    };
    var normalizedCalls = Object.keys(calls).slice(-80).reduce(function (out, key) {
      var call = normalizeCall(key,calls[key]);
      if (call) out[key] = call;
      return out;
    }, {});
    var savedDrops = (Array.isArray(source.savedDrops) ? source.savedDrops : []).filter(function (drop) {
      return drop && typeof drop === 'object' && cleanString(drop.id,120) && cleanString(drop.athleteId,120) && cleanString(drop.teamId,120) && cleanString(drop.name,180) && cleanString(drop.type,100) && cleanString(drop.edition,120);
    }).slice(-48).map(function (drop) {
      return {id:cleanString(drop.id,120),athleteId:cleanString(drop.athleteId,120),teamId:cleanString(drop.teamId,120),name:cleanString(drop.name,180),type:cleanString(drop.type,100),edition:cleanString(drop.edition,120),color:cleanString(drop.color,40) || '#00e5ff'};
    });
    var inferredAwards = follows.teams.map(function (id) { return 'follow:teams:' + id; })
      .concat(follows.athletes.map(function (id) { return 'follow:athletes:' + id; }))
      .concat(Object.keys(normalizedCalls).map(function (key) { return 'call:' + key; }))
      .concat(savedDrops.map(function (drop) { return 'drop:' + drop.id; }));
    return {
      version: VERSION,
      signalId: typeof source.signalId === 'string' && source.signalId ? source.signalId.slice(0, 20) : createSignalId(),
      xp: Math.max(0, Math.min(9999, Math.trunc(Number(source.xp) || 0))),
      follows: follows,
      calls: normalizedCalls,
      savedDrops: savedDrops,
      awards: uniqueStrings((Array.isArray(source.awards) ? source.awards : []).concat(inferredAwards),320),
      activity: (Array.isArray(source.activity) ? source.activity : []).filter(function (entry) { return entry && typeof entry.label === 'string'; }).slice(-30).map(function (entry) { return {label:cleanString(entry.label,120),detail:cleanString(entry.detail,240),at:Number.isFinite(Number(entry.at)) ? Number(entry.at) : 0}; })
    };
  }
  function createSignalId() {
    var seed = [Date.now(), navigator.userAgent || '', root.screen && root.screen.width, root.screen && root.screen.height].join('|');
    return 'SIG-' + C.hash(seed).toString(36).toUpperCase().padStart(7, '0').slice(-7);
  }
  function storedState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw == null ? null : normalizeState(JSON.parse(raw));
    } catch (_error) { return null; }
  }
  function loadState() { return storedState() || normalizeState({}); }
  var fan = loadState();
  function reconcileBeforeMutation() {
    var stored = storedState();
    if (stored) fan = stored;
  }
  function persist() {
    fan = normalizeState(fan);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fan)); }
    catch (_error) {}
    rerankLiveMoments();
    renderDrawer();
    refreshInteractiveStates();
  }
  function activity(label, detail) {
    fan.activity.push({label:String(label),detail:String(detail || ''),at:Date.now()});
    fan.activity = fan.activity.slice(-30);
  }
  function addXp(amount, label, awardId) {
    if (awardId && fan.awards.indexOf(awardId) >= 0) return false;
    if (awardId) fan.awards.push(awardId);
    fan.xp = Math.min(9999, fan.xp + Math.max(0, Math.trunc(amount || 0)));
    if (label) activity('SIGNAL +' + amount, label);
    return true;
  }
  function tier() {
    var tiers = [
      {at:0,label:'NEW SIGNAL'},
      {at:25,label:'CITY WITNESS'},
      {at:75,label:'RIVALRY KEEPER'},
      {at:150,label:'MYTH MAKER'},
      {at:300,label:'WORLD ARCHIVIST'}
    ];
    var current = tiers[0], next = null;
    tiers.forEach(function (candidate, index) {
      if (fan.xp >= candidate.at) current = candidate;
      else if (!next) next = candidate;
      if (index === tiers.length - 1 && fan.xp >= candidate.at) next = {at:candidate.at + 250,label:'WORLD ARCHIVIST'};
    });
    var span = Math.max(1, next.at - current.at);
    return {label:current.label,next:next.label,remaining:Math.max(0,next.at-fan.xp),progress:Math.max(0,Math.min(100,Math.round((fan.xp-current.at)/span*100)))};
  }
  function allTeams() {
    return C.sports.reduce(function (teams, sport) { return teams.concat(sport.teams); }, []);
  }
  function teamById(teamId) { return allTeams().filter(function (team) { return team.id === teamId; })[0] || null; }
  function athleteById(athleteId) {
    var teams = allTeams();
    for (var i = 0; i < teams.length; i += 1) {
      var athlete = teams[i].athletes.filter(function (candidate) { return candidate.id === athleteId; })[0];
      if (athlete) return {athlete:athlete,team:teams[i],sport:C.getSport(teams[i].sportId)};
    }
    return null;
  }
  function pairKey(sportId, homeId, awayId) {
    var teams = [cleanString(homeId,120),cleanString(awayId,120)].sort();
    return [cleanString(sportId,80),teams[0],teams[1]].join('|');
  }
  function hasPersonalSignal() {
    return Boolean(fan.follows.teams.length || fan.follows.athletes.length || Object.keys(fan.calls).length);
  }
  function rerankLiveMoments() {
    var followedAthletes = fan.follows.athletes;
    var followedTeams = fan.follows.teams;
    var followedAthleteTeams = followedAthletes.map(athleteById).filter(Boolean).map(function (record) { return record.team.id; });
    var calls = Object.keys(fan.calls).map(function (key) { return fan.calls[key]; });
    var personalized = hasPersonalSignal();
    var ranked = liveMomentState.raw.map(function (moment,index) {
      var weight = personalized ? 0 : 1;
      var relevance = personalized ? '' : 'WORLD MOMENT';
      if (followedAthletes.indexOf(moment.athleteId) >= 0) { weight = 600; relevance = 'FOLLOWED ATHLETE'; }
      var matchingCalls = calls.filter(function (call) {
        return pairKey(call.sportId,call.home.id,call.away.id) === pairKey(moment.sportId,moment.home.id,moment.away.id);
      });
      var calledSideMoment = matchingCalls.some(function (call) { return call.teamId === moment.teamId; });
      if (calledSideMoment && weight < 520) { weight = 520; relevance = 'YOUR CALLED SIDE'; }
      if (followedTeams.indexOf(moment.teamId) >= 0 && weight < 450) { weight = 450; relevance = 'FOLLOWED CLUB'; }
      if (matchingCalls.length && weight < 350) { weight = 350; relevance = 'OPEN CALL MATCH'; }
      var involvesAthleteClub = followedAthleteTeams.indexOf(moment.home.id) >= 0 || followedAthleteTeams.indexOf(moment.away.id) >= 0;
      if (involvesAthleteClub && weight < 260) { weight = 260; relevance = 'ATHLETE CLUB'; }
      var involvesFollowedClub = followedTeams.indexOf(moment.home.id) >= 0 || followedTeams.indexOf(moment.away.id) >= 0;
      if (involvesFollowedClub && weight < 220) { weight = 220; relevance = 'FOLLOWED MATCH'; }
      if (!weight) return null;
      return {
        moment: moment,
        relevance: relevance,
        weight: weight,
        signature: moment.signatureCandidate ? 1 : 0,
        leverage: Number.isFinite(Number(moment.leverage)) ? Number(moment.leverage) : 0,
        occurredAt: Date.parse(moment.occurredAt || '') || Number(moment.elapsedMs) || 0,
        index: index
      };
    }).filter(Boolean);
    ranked.sort(function (left,right) {
      return right.weight-left.weight || right.signature-left.signature || right.leverage-left.leverage || right.occurredAt-left.occurredAt || left.index-right.index;
    });
    var perFixture = Object.create(null);
    var perSport = Object.create(null);
    liveMomentState.items = ranked.filter(function (entry) {
      var key = entry.moment.fixtureId || entry.moment.eventKey;
      perFixture[key] = perFixture[key] || 0;
      perSport[entry.moment.sportId] = perSport[entry.moment.sportId] || 0;
      if (!personalized && perSport[entry.moment.sportId] >= 1) return false;
      if (personalized && perFixture[key] >= 2) return false;
      perFixture[key] += 1;
      perSport[entry.moment.sportId] += 1;
      return true;
    }).slice(0,personalized ? 5 : 6);
    liveMomentState.discovery = !personalized;
  }
  function liveSourceCopy() {
    if (liveMomentState.stale && liveMomentState.raw.length) {
      if (liveMomentState.canonical) return {
        label: 'LAST SERVER SNAPSHOT', note: 'SIGNAL TEMPORARILY UNAVAILABLE',
        boundary: 'LAST SERVER-PUBLISHED MATCH SNAPSHOT, HELD IN MEMORY FOR WATCHING ONLY. IT IS NOT USED TO SCORE OR SETTLE FAN CALLS. NO MONEY · NO PRIZE.'
      };
      if (liveMomentState.degraded) return {
        label: 'LAST DEGRADED SNAPSHOT', note: 'SERVER FEED UNAVAILABLE',
        boundary: 'LAST DETERMINISTIC FALLBACK SNAPSHOT — NOT AN OFFICIAL RESULT. FAN CALLS STAY OPEN AND ARE NEVER SCORED HERE. NO MONEY · NO PRIZE.'
      };
      return {
        label: 'LAST FALLBACK SNAPSHOT', note: 'SIGNAL TEMPORARILY UNAVAILABLE',
        boundary: 'LAST DETERMINISTIC FALLBACK SNAPSHOT — NOT A RECORDED OR AUTHORITATIVE LIVE RESULT. FAN CALLS STAY OPEN. NO MONEY · NO PRIZE.'
      };
    }
    if (liveMomentState.phase === 'error' && !liveMomentState.raw.length) return {
      label: 'SIGNAL OFFLINE', note: 'RETRY WHEN CONNECTED',
      boundary: 'LIVE MOMENTS COULD NOT BE LOADED. YOUR FOLLOWS AND OPEN FAN CALLS ARE UNCHANGED. NO MONEY · NO PRIZE.'
    };
    if ((liveMomentState.phase === 'idle' || liveMomentState.phase === 'loading') && !liveMomentState.raw.length) return {
      label: 'LISTENING', note: 'CONNECTING TO THE WORLD',
      boundary: 'MATCH MOMENTS ARE READ-ONLY. THIS SECTION NEVER SCORES OR SETTLES FAN CALLS. NO MONEY · NO PRIZE.'
    };
    if (liveMomentState.degraded) return {
      label: 'STORY FEED · DEGRADED', note: 'SERVER FEED UNAVAILABLE',
      boundary: 'THE SERVER FEED IS UNAVAILABLE, SO THESE ARE DETERMINISTIC FALLBACK MOMENTS — NOT OFFICIAL RESULTS. FAN CALLS STAY OPEN. NO MONEY · NO PRIZE.'
    };
    if (liveMomentState.canonical) return {
      label: 'SERVER FEED', note: 'WATCHING ONLY',
      boundary: 'SERVER-PUBLISHED MATCH MOMENTS FOR WATCHING ONLY. THIS SECTION DOES NOT SCORE OR SETTLE FAN CALLS. NO MONEY · NO PRIZE.'
    };
    return {
      label: 'STORY FEED · FALLBACK', note: 'DETERMINISTIC PREVIEW',
      boundary: 'DETERMINISTIC FALLBACK MOMENTS — NOT A RECORDED OR AUTHORITATIVE LIVE RESULT. FAN CALLS STAY OPEN AND ARE NEVER SCORED HERE. NO MONEY · NO PRIZE.'
    };
  }
  function liveSectionShell() {
    return '<section id="fw-live-moments" class="fw-drawer-section" aria-labelledby="fw-live-moments-title"><header class="fw-section-title"><p id="fw-live-moments-title">LIVE WORLD DISCOVERY</p><button class="fw-section-action" type="button" data-fw-action="refresh-live">REFRESH SIGNAL</button></header><div class="fw-live-source" data-state="loading" aria-live="polite"><i aria-hidden="true"></i><b>LISTENING</b><span>CONNECTING TO THE WORLD</span></div><p class="fw-live-boundary"></p><div id="fw-moment-stack" class="fw-moment-stack" role="feed" aria-busy="true"></div></section>';
  }
  function momentSourceLabel(moment) {
    var provenance = moment && moment.provenance || {};
    if (moment && moment.canonical === true) return liveMomentState.stale ? 'LAST SERVER SNAPSHOT' : 'SERVER-PUBLISHED';
    if (provenance.degraded === true) return liveMomentState.stale ? 'LAST DEGRADED FALLBACK' : 'DEGRADED FALLBACK';
    return liveMomentState.stale ? 'LAST FALLBACK SNAPSHOT' : 'FALLBACK PREVIEW';
  }
  function momentCard(entry) {
    var moment = entry.moment;
    var score = moment.scoreAfter || moment.score && (moment.score.after || moment.score.current) || {home:0,away:0};
    var pressure = moment.signatureCandidate || Number(moment.leverage) >= .78 ? 'HIGH PRESSURE' : 'MATCH MOMENT';
    var sourceLabel = momentSourceLabel(moment);
    var arenaUrl = cleanString(moment.arenaUrl || moment.links && moment.links.arena,500) || ('world.html?sport=' + encodeURIComponent(moment.sportId));
    var profileUrl = cleanString(moment.profileUrl || moment.links && moment.links.profile,500) || 'world.html';
    var clipUrl = cleanString(moment.clipUrl || moment.links && moment.links.clip,900) || 'world.html';
    var arenaLabel = /^world\.html(?:\?|$)/.test(arenaUrl) ? 'OPEN WORLD' : 'MATCHUP SIM';
    var momentId = esc(moment.id || moment.eventKey);
    return '<article class="fw-moment-card" data-fw-moment-card="' + momentId + '" style="--moment-color:' + esc(moment.team.color || '#00e5ff') + '" aria-label="' + esc(moment.athlete.name + ' ' + moment.kindLabel) + '"><div class="fw-moment-main"><div class="fw-moment-top"><span>' + esc(entry.relevance + ' · ' + moment.sportName.toUpperCase()) + '</span><em>' + esc(pressure) + '</em></div><h4>' + esc(moment.headline) + '</h4><div class="fw-moment-identity"><strong>' + esc(moment.athlete.name) + '</strong><span>#' + esc(moment.athlete.number == null ? '—' : moment.athlete.number) + ' · ' + esc(moment.team.code) + ' · ' + esc(moment.kindLabel) + '</span></div><div class="fw-moment-score" aria-label="' + esc(moment.home.code + ' ' + score.home + ', ' + moment.away.code + ' ' + score.away) + '"><span>' + esc(moment.home.code) + '</span><b>' + esc(score.home) + '–' + esc(score.away) + '</b><span>' + esc(moment.away.code) + '</span><em>' + esc(moment.phaseLabel) + '</em></div><small class="fw-moment-proof">EVENT ' + esc(moment.eventKey) + ' · ' + esc(sourceLabel) + '</small></div><nav class="fw-moment-actions" aria-label="Moment destinations"><a href="' + esc(arenaUrl) + '" data-fw-moment-id="' + momentId + '" data-fw-moment-action="arena" aria-label="' + esc(arenaLabel === 'MATCHUP SIM' ? 'Open autonomous matchup simulation, not this event' : 'Open this sport in World') + '">' + arenaLabel + '</a><a href="' + esc(profileUrl) + '" data-fw-moment-id="' + momentId + '" data-fw-moment-action="athlete">ATHLETE FILE</a><a href="' + esc(clipUrl) + '" data-fw-moment-id="' + momentId + '" data-fw-moment-action="clip" title="Open an unverified animated interpretation of the shared event reference">12S CONCEPT</a></nav></article>';
  }
  function liveStackMarkup() {
    if (liveMomentState.items.length) return liveMomentState.items.map(momentCard).join('');
    if (liveMomentState.phase === 'loading' || liveMomentState.phase === 'idle') return '<div class="fw-moment-empty"><b>TUNING THE WORLD SIGNAL</b>Listening for athlete-attributed match moments across all six sports.</div>';
    if (!liveMomentState.discovery) return '<div class="fw-moment-empty"><b>NO FOLLOWED MOMENT IN THIS SNAPSHOT</b>Your follows and open fan calls are saved. The feed will update when one of those stories moves.</div>';
    return '<div class="fw-moment-empty"><b>NO ATHLETE MOMENT IN THIS SNAPSHOT</b>The world signal is connected, but no locally verifiable athlete event is available yet.</div>';
  }
  function updateMomentStack(stackNode, markup, refreshButton) {
    var signature = String(C.hash(markup));
    if (stackNode.__fwRenderMarkup === markup) return;
    var active = document.activeElement;
    var focusRef = active && stackNode.contains(active) ? {
      id: active.getAttribute('data-fw-moment-id') || '',
      action: active.getAttribute('data-fw-moment-action') || ''
    } : null;
    var scrollNode = document.getElementById('fw-drawer-scroll');
    var scrollTop = scrollNode ? scrollNode.scrollTop : 0;
    stackNode.innerHTML = markup;
    stackNode.__fwRenderMarkup = markup;
    stackNode.dataset.renderSignature = signature;
    if (scrollNode) scrollNode.scrollTop = scrollTop;
    if (!focusRef) return;
    var target = Array.prototype.slice.call(stackNode.querySelectorAll('[data-fw-moment-id][data-fw-moment-action]')).filter(function (candidate) {
      return candidate.getAttribute('data-fw-moment-id') === focusRef.id && candidate.getAttribute('data-fw-moment-action') === focusRef.action;
    })[0] || refreshButton;
    if (target && target.focus) target.focus({preventScroll:true});
    if (scrollNode) scrollNode.scrollTop = scrollTop;
  }
  function renderLiveSection() {
    var sectionNode = document.getElementById('fw-live-moments');
    if (!sectionNode) return;
    var titleNode = document.getElementById('fw-live-moments-title');
    var sourceNode = sectionNode.querySelector('.fw-live-source');
    var boundaryNode = sectionNode.querySelector('.fw-live-boundary');
    var stackNode = document.getElementById('fw-moment-stack');
    var refreshButton = sectionNode.querySelector('[data-fw-action="refresh-live"]');
    var copy = liveSourceCopy();
    titleNode.textContent = liveMomentState.discovery ? 'LIVE WORLD DISCOVERY' : 'LIVE MOMENTS FOR YOU';
    sourceNode.dataset.state = liveMomentState.phase === 'error' ? 'error' : liveMomentState.refreshing || liveMomentState.phase === 'loading' ? 'loading' : 'ready';
    sourceNode.querySelector('b').textContent = copy.label;
    sourceNode.querySelector('span').textContent = copy.note;
    boundaryNode.textContent = copy.boundary;
    stackNode.setAttribute('aria-busy',String(Boolean(liveMomentState.refreshing || liveMomentState.phase === 'loading')));
    updateMomentStack(stackNode,liveStackMarkup(),refreshButton);
    refreshButton.disabled = liveMomentState.refreshing;
    refreshButton.textContent = liveMomentState.refreshing ? 'REFRESHING…' : 'REFRESH SIGNAL';
  }
  function drawerIsOpen() { return document.documentElement.classList.contains('fw-open'); }
  function clearLiveMomentTimer() {
    if (liveMomentTimer) clearTimeout(liveMomentTimer);
    liveMomentTimer = 0;
  }
  function scheduleLiveMomentRefresh(delay) {
    clearLiveMomentTimer();
    if (!drawerIsOpen() || document.hidden) return;
    liveMomentTimer = setTimeout(function () { liveMomentTimer = 0; refreshLiveMoments(false); },Math.max(250,Number(delay) || LIVE_POLL_MS));
  }
  function refreshLiveMoments(force) {
    if (liveMomentState.refreshing) return;
    if (!liveModel || typeof root.fetch !== 'function' || !/^https?:$/.test(location.protocol)) {
      liveMomentState.phase = 'error';
      liveMomentState.errorCode = 'live_model_unavailable';
      liveMomentState.stale = Boolean(liveMomentState.raw.length);
      renderLiveSection();
      return;
    }
    if (!force && liveMomentState.receivedAt && Date.now() - liveMomentState.receivedAt < LIVE_POLL_MS - 250) {
      scheduleLiveMomentRefresh(LIVE_POLL_MS - (Date.now() - liveMomentState.receivedAt));
      return;
    }
    var generation = ++liveMomentGeneration;
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timeout = setTimeout(function () { if (controller) controller.abort(); },LIVE_TIMEOUT_MS);
    liveMomentAbort = controller;
    liveMomentState.refreshing = true;
    liveMomentState.phase = liveMomentState.raw.length ? 'ready' : 'loading';
    liveMomentState.errorCode = null;
    renderLiveSection();
    root.fetch('/api/live',{cache:'no-store',headers:{Accept:'application/json'},signal:controller && controller.signal}).then(function (response) {
      if (!response.ok) throw new Error('http_' + response.status);
      return response.json();
    }).then(function (payload) {
      if (generation !== liveMomentGeneration) return;
      var normalized = liveModel.normalizeLive(payload);
      var degraded = Boolean(payload && payload.degraded === true || normalized.degraded === true);
      liveMomentState.phase = 'ready';
      liveMomentState.source = cleanString(normalized.source,80) || 'unknown';
      liveMomentState.canonical = Boolean(normalized.canonical === true && !degraded);
      liveMomentState.degraded = degraded;
      liveMomentState.degradedReason = cleanString(payload && payload.degradedReason,120) || null;
      liveMomentState.observedAt = cleanString(normalized.observedAt,80) || null;
      liveMomentState.receivedAt = Date.now();
      liveMomentState.stale = false;
      liveMomentState.errorCode = null;
      liveMomentState.raw = normalized.moments.slice(0,120);
      liveMomentRetry = 0;
      rerankLiveMoments();
    }).catch(function (error) {
      if (generation !== liveMomentGeneration) return;
      liveMomentState.phase = 'error';
      liveMomentState.stale = Boolean(liveMomentState.raw.length);
      liveMomentState.errorCode = cleanString(error && (error.name === 'AbortError' ? 'timeout' : error.message),80) || 'network_error';
      liveMomentRetry = Math.min(4,liveMomentRetry + 1);
    }).then(function () {
      clearTimeout(timeout);
      if (generation !== liveMomentGeneration) return;
      liveMomentAbort = null;
      liveMomentState.refreshing = false;
      renderLiveSection();
      if (drawerIsOpen() && !document.hidden) {
        var retryDelays = [LIVE_POLL_MS,15000,30000,60000];
        scheduleLiveMomentRefresh(liveMomentState.phase === 'error' ? retryDelays[Math.max(0,liveMomentRetry-1)] : LIVE_POLL_MS);
      }
    });
  }
  function hasFollow(kind, id) { return fan.follows[kind].indexOf(id) >= 0; }
  function toggleFollow(kind, id, label) {
    reconcileBeforeMutation();
    if (!fan.follows[kind] || !id) return;
    var at = fan.follows[kind].indexOf(id);
    if (at >= 0) {
      fan.follows[kind].splice(at, 1);
      activity('UNFOLLOWED', label || id);
      toast('REMOVED FROM MY SIGNAL');
    } else {
      fan.follows[kind].push(id);
      var awarded = addXp(6, 'Followed ' + (label || id), 'follow:' + kind + ':' + id);
      toast((label || 'ATHLETE') + ' ADDED TO MY SIGNAL' + (awarded ? ' · +6' : ''));
    }
    persist();
  }
  function makeCall(story, side) {
    if (!story || (side !== 'home' && side !== 'away')) return;
    reconcileBeforeMutation();
    var existing = fan.calls[story.key];
    fan.calls[story.key] = {
      fixtureId: story.key,
      sportId: story.sportId,
      createdAt: existing && existing.createdAt || Date.now(),
      updatedAt: Date.now(),
      side: side,
      teamId: story[side].id,
      teamName: story[side].name,
      home: {id:story.home.id,name:story.home.name,code:story.home.code},
      away: {id:story.away.id,name:story.away.name,code:story.away.code},
      headline: story.headline,
      status: 'open',
      resolution: null,
      points: null,
      source: 'local-fan-signal'
    };
    var awarded = false;
    if (!existing) awarded = addXp(12, 'Called ' + story[side].name, 'call:' + story.key);
    else activity('CALL UPDATED', story[side].name);
    toast('FAN CALL SAVED · ' + story[side].name + (awarded ? ' · +12' : ''));
    persist();
    if (pageKind === 'world') renderPreviewStory();
  }
  function saveDrop(profile) {
    if (!profile || !profile.collectible) return;
    reconcileBeforeMutation();
    var exists = fan.savedDrops.some(function (drop) { return drop.id === profile.collectible.id; });
    if (exists) {
      fan.savedDrops = fan.savedDrops.filter(function (drop) { return drop.id !== profile.collectible.id; });
      activity('DROP REMOVED', profile.collectible.name);
      toast('DROP REMOVED FROM LOCKER');
    } else {
      fan.savedDrops.push({
        id: profile.collectible.id,
        athleteId: profile.id,
        teamId: profile.teamId,
        name: profile.collectible.name,
        type: profile.collectible.type,
        edition: profile.collectible.edition,
        color: profile.collectible.colors[0]
      });
      var awarded = addXp(5, 'Saved ' + profile.collectible.name, 'drop:' + profile.collectible.id);
      toast('CONCEPT DROP SAVED TO LOCKER' + (awarded ? ' · +5' : ''));
    }
    persist();
  }
  function publicState() {
    var rank = tier();
    return {
      version: VERSION,
      signalId: fan.signalId,
      xp: fan.xp,
      tier: rank.label,
      follows: {teams:fan.follows.teams.slice(),athletes:fan.follows.athletes.slice()},
      openCalls: Object.keys(fan.calls).length,
      savedDrops: fan.savedDrops.length,
      supporterContract: M.supporterContract,
      liveMoments: {
        phase: liveMomentState.phase,
        source: liveMomentState.source,
        canonical: liveMomentState.canonical,
        degraded: liveMomentState.degraded,
        stale: liveMomentState.stale,
        observedAt: liveMomentState.observedAt,
        mode: liveMomentState.discovery ? 'world-discovery' : 'personalized',
        count: liveMomentState.items.length,
        items: liveMomentState.items.map(function (entry) {
          var moment = entry.moment;
          return {id:moment.id,fixtureId:moment.fixtureId,matchId:moment.matchId,eventKey:moment.eventKey,sportId:moment.sportId,kind:moment.kind,phase:moment.phase,teamId:moment.teamId,athleteId:moment.athleteId,relevance:entry.relevance,score:moment.scoreAfter || moment.score && moment.score.after || null,pressure:moment.signatureCandidate || Number(moment.leverage) >= .78 ? 'high' : 'standard'};
        }),
        contract: {readOnly:true,callsRemainOpen:true,scoresCalls:false,settlesCalls:false,money:false,prizes:false}
      }
    };
  }
  function toast(message) {
    var element = document.getElementById('fw-toast');
    if (!element) {
      element = document.createElement('div');
      element.id = 'fw-toast';
      element.className = 'fw-toast';
      element.setAttribute('role','status');
      element.setAttribute('aria-live','polite');
      document.body.appendChild(element);
    }
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { element.classList.remove('show'); }, 2200);
  }
  function storyClipUrl(story) {
    if (!story || !story.home || !story.away || !story.featured || !story.featured[0]) return 'world.html';
    var query = new URLSearchParams({
      sport: story.sportId,
      home: story.home.id,
      away: story.away.id,
      athlete: story.featured[0].id,
      headline: story.headline,
      match: story.key,
      story: story.id,
      view: '1'
    });
    return 'clip.html?' + query.toString();
  }
  function fallbackCopy(value) {
    var field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly','');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    field.style.pointerEvents = 'none';
    document.body.appendChild(field);
    field.select();
    var copied = false;
    try { copied = document.execCommand('copy'); }
    catch (_error) {}
    field.remove();
    return copied;
  }
  function copyStorySignal(text, url) {
    var value = text + '\n' + url;
    if (navigator.clipboard && root.isSecureContext) {
      return navigator.clipboard.writeText(value).then(function () { return true; }, function () { return fallbackCopy(value); });
    }
    return Promise.resolve(fallbackCopy(value));
  }
  function shareStory(story) {
    if (!story) return;
    var text = story.shareLine || (story.headline + ' — ' + story.home.code + ' vs ' + story.away.code + '. #Cyberliga');
    var url = new URL(storyClipUrl(story),location.href).href;
    var copied = function (ok) { toast(ok ? 'STORY + 12-SECOND CLIP LINK COPIED' : 'COPY FAILED · CLIP LINK UNAVAILABLE IN THIS BROWSER'); };
    if (typeof navigator.share === 'function') {
      navigator.share({title:'CYBERLIGA / THE SIGNAL',text:text,url:url}).then(function () {
        toast('THE SIGNAL WAS SHARED');
      },function (error) {
        if (error && error.name === 'AbortError') return;
        copyStorySignal(text,url).then(copied);
      });
      return;
    }
    copyStorySignal(text,url).then(copied);
  }
  function pageState() {
    try {
      var output = baseRenderer ? baseRenderer() : (typeof root.render_game_to_text === 'function' ? root.render_game_to_text() : null);
      return typeof output === 'string' ? JSON.parse(output) : output;
    } catch (_error) { return null; }
  }
  function decorateRenderHook() {
    if (baseRenderer || typeof root.render_game_to_text !== 'function' || root.render_game_to_text.__fanworld) return;
    baseRenderer = root.render_game_to_text.bind(root);
    var wrapped = function () {
      var output = baseRenderer();
      var data;
      try { data = typeof output === 'string' ? JSON.parse(output) : output; }
      catch (_error) { return output; }
      if (!data || typeof data !== 'object') return output;
      data.supporter = publicState();
      data.mythos = {version:M.version,page:pageKind,authoritative:false,syntheticEpochNarrative:true,realMoney:false};
      if (currentPreviewStory) data.mythos.previewStory = {id:currentPreviewStory.id,key:currentPreviewStory.key,heat:currentPreviewStory.heat,featured:currentPreviewStory.featured.map(function (profile) { return profile.id; })};
      return JSON.stringify(data);
    };
    wrapped.__fanworld = true;
    root.render_game_to_text = wrapped;
  }
  function triggerLabel() {
    var rank = tier();
    return 'MY <b>SIGNAL</b> · ' + fan.xp;
  }
  function ensureShell() {
    if (drawer) return;
    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = 'fw-trigger';
    trigger.className = 'fw-trigger';
    trigger.dataset.fwAction = 'open';
    trigger.setAttribute('aria-controls','fw-drawer');
    trigger.setAttribute('aria-expanded','false');
    trigger.setAttribute('aria-label','Open My Signal supporter passport');
    trigger.innerHTML = triggerLabel();
    document.body.appendChild(trigger);

    var backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'fw-backdrop';
    backdrop.dataset.fwAction = 'close';
    backdrop.setAttribute('aria-label','Close My Signal');
    backdrop.setAttribute('aria-hidden','true');
    backdrop.tabIndex = -1;
    document.body.appendChild(backdrop);

    drawer = document.createElement('aside');
    drawer.id = 'fw-drawer';
    drawer.className = 'fw-drawer';
    drawer.setAttribute('role','dialog');
    drawer.setAttribute('aria-modal','true');
    drawer.setAttribute('aria-labelledby','fw-drawer-title');
    drawer.setAttribute('aria-hidden','true');
    drawer.inert = true;
    drawer.innerHTML = '<header class="fw-drawer-head"><div><p id="fw-passport-id">SUPPORTER PASSPORT / ' + esc(fan.signalId) + '</p><h2 id="fw-drawer-title">MY SIGNAL</h2></div><button class="fw-close" type="button" data-fw-action="close">CLOSE ×</button></header><section class="fw-rank" id="fw-rank"></section><div class="fw-drawer-scroll" id="fw-drawer-scroll" tabindex="0"></div><footer class="fw-drawer-foot">FAN CALL · FOR FUN · NO MONEY · NO PRIZE · NOT SETTLED AGAINST CLIENT SIMULATION. FOLLOWS AND LOCKER ITEMS STAY ON THIS DEVICE.</footer>';
    document.body.appendChild(drawer);
    renderDrawer();
  }
  function openDrawer(opener) {
    ensureShell();
    if (!document.documentElement.classList.contains('fw-open')) drawerReturnFocus = opener && opener.focus ? opener : document.activeElement;
    document.documentElement.classList.add('fw-open');
    drawer.inert = false;
    drawer.setAttribute('aria-hidden','false');
    document.getElementById('fw-trigger').setAttribute('aria-expanded','true');
    setTimeout(function () { var close = drawer.querySelector('.fw-close'); if (close) close.focus(); }, 20);
    var age = liveMomentState.receivedAt ? Date.now() - liveMomentState.receivedAt : Number.POSITIVE_INFINITY;
    if (age > LIVE_STALE_MS && liveMomentState.raw.length) liveMomentState.stale = true;
    if (liveMomentState.phase === 'idle' || liveMomentState.phase === 'error' || age > LIVE_POLL_MS) refreshLiveMoments(true);
    else scheduleLiveMomentRefresh(Math.max(250,LIVE_POLL_MS-age));
  }
  function closeDrawer(options) {
    if (!drawer) return;
    var restoreFocus = !options || options.restoreFocus !== false;
    clearLiveMomentTimer();
    document.documentElement.classList.remove('fw-open');
    drawer.inert = true;
    drawer.setAttribute('aria-hidden','true');
    var trigger = document.getElementById('fw-trigger');
    if (trigger) trigger.setAttribute('aria-expanded','false');
    var returnTarget = drawerReturnFocus && drawerReturnFocus.isConnected && drawerReturnFocus.focus ? drawerReturnFocus : trigger;
    drawerReturnFocus = null;
    if (restoreFocus && returnTarget) requestAnimationFrame(function () { returnTarget.focus({preventScroll:true}); });
  }
  function trapDrawerFocus(event) {
    if (event.key !== 'Tab' || !drawer || !document.documentElement.classList.contains('fw-open')) return false;
    var focusable = Array.prototype.slice.call(drawer.querySelectorAll('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')).filter(function (element) {
      var style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    if (!focusable.length) return false;
    var first = focusable[0], last = focusable[focusable.length - 1], active = document.activeElement;
    if (!drawer.contains(active)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return true;
    }
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return true;
    }
    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
      return true;
    }
    return false;
  }
  function renderDrawer() {
    if (!drawer) return;
    var rank = tier();
    var passport = document.getElementById('fw-passport-id');
    if (passport) passport.textContent = 'SUPPORTER PASSPORT / ' + fan.signalId;
    var rankNode = document.getElementById('fw-rank');
    rankNode.innerHTML = '<div class="fw-rank-mark"><div><strong>' + esc(String(fan.xp).padStart(3,'0')) + '</strong><span>SIGNAL XP</span></div></div><div class="fw-rank-copy"><p>CURRENT SUPPORTER TIER</p><h3>' + esc(rank.label) + '</h3><div class="fw-xp" style="--fw-progress:' + rank.progress + '%"><i></i></div><small>' + esc(rank.remaining) + ' XP TO ' + esc(rank.next) + '</small></div>';
    var calls = Object.keys(fan.calls).map(function (key) { return fan.calls[key]; }).sort(function (a,b) { return Number(b.updatedAt || b.createdAt) - Number(a.updatedAt || a.createdAt); }).slice(0,5);
    var athletes = fan.follows.athletes.map(athleteById).filter(Boolean).slice(0,6);
    var teams = fan.follows.teams.map(teamById).filter(Boolean).slice(0,6);
    var followRows = teams.map(function (team) {
      return '<a class="fw-list-item" href="league.html?sport=' + encodeURIComponent(team.sportId) + '&amp;team=' + encodeURIComponent(team.id) + '" style="--item-color:' + esc(team.colors.primary) + '"><b>' + esc(team.code) + '</b><div><strong>' + esc(team.name) + '</strong><small>' + esc(team.city.toUpperCase()) + ' · CLUB</small></div><em>OPEN ↗</em></a>';
    }).concat(athletes.map(function (record) {
      return '<a class="fw-list-item" href="player.html?sport=' + encodeURIComponent(record.sport.id) + '&amp;team=' + encodeURIComponent(record.team.id) + '&amp;player=' + encodeURIComponent(record.athlete.id) + '" style="--item-color:' + esc(record.team.colors.primary) + '"><b>' + esc(String(record.athlete.number).padStart(2,'0')) + '</b><div><strong>' + esc(record.athlete.name) + '</strong><small>' + esc(record.team.code) + ' · ' + esc(record.athlete.role.toUpperCase()) + '</small></div><em>OPEN ↗</em></a>';
    }));
    var callRows = calls.map(function (call) {
      var chosen = call.side === 'home' ? call.home : call.away;
      var opponent = call.side === 'home' ? call.away : call.home;
      var chosenTeam = teamById(chosen.id);
      return '<div class="fw-list-item" style="--item-color:' + esc(chosenTeam ? chosenTeam.colors.primary : '#00e5ff') + '"><b>' + esc(chosen.code) + '</b><div><strong>' + esc(chosen.name) + '</strong><small>CALLED OVER ' + esc(opponent.code) + ' · OPEN</small></div><em>FOR FUN</em></div>';
    });
    var dropRows = fan.savedDrops.slice().reverse().slice(0,5).map(function (drop) {
      return '<div class="fw-list-item" style="--item-color:' + esc(drop.color || '#00e5ff') + '"><b>◆</b><div><strong>' + esc(drop.name) + '</strong><small>' + esc(drop.type) + ' · ' + esc(drop.edition) + '</small></div><em>SAVED</em></div>';
    });
    function section(label, count, rows, empty) {
      return '<section class="fw-drawer-section"><header class="fw-section-title"><p>' + label + '</p><span>' + count + '</span></header>' + (rows.length ? '<div class="fw-list">' + rows.join('') + '</div>' : '<div class="fw-empty">' + empty + '</div>') + '</section>';
    }
    document.getElementById('fw-drawer-scroll').innerHTML =
      liveSectionShell() +
      section('FOLLOWED WORLD', followRows.length + ' SAVED', followRows, 'Follow a club or athlete and their live moments will collect above.') +
      section('MY FAN CALLS', calls.length + ' OPEN', callRows, 'Call a side from a fixture story. Calls are local, free, and deliberately unresolved until Cyberliga has one authoritative event stream.') +
      section('CONCEPT LOCKER', fan.savedDrops.length + ' OBJECTS', dropRows, 'Save an athlete or club drop concept. No checkout is connected.') +
      section('WHY THIS EXISTS', 'ONE WORLD', ['<div class="fw-empty">Watch → recognize someone → understand the pressure → call your side → save the memory → come back because the story changed.</div>'], '');
    renderLiveSection();
    var trigger = document.getElementById('fw-trigger');
    if (trigger) trigger.innerHTML = triggerLabel();
  }
  function refreshInteractiveStates() {
    document.querySelectorAll('[data-fw-action="follow-team"]').forEach(function (button) {
      var active = hasFollow('teams', button.dataset.teamId);
      button.setAttribute('aria-pressed',String(active));
      button.textContent = active ? 'FOLLOWING CLUB ✓' : 'FOLLOW CLUB';
    });
    document.querySelectorAll('[data-fw-action="follow-athlete"]').forEach(function (button) {
      var active = hasFollow('athletes', button.dataset.athleteId);
      button.setAttribute('aria-pressed',String(active));
      button.textContent = active ? 'FOLLOWING ✓' : 'FOLLOW';
    });
    document.querySelectorAll('[data-fw-action="pick"]').forEach(function (button) {
      var call = fan.calls[button.dataset.storyKey];
      button.setAttribute('aria-pressed',String(Boolean(call && call.side === button.dataset.side)));
    });
    document.querySelectorAll('[data-fw-action="save-drop"]').forEach(function (button) {
      var profile = profileFromButton(button);
      var active = Boolean(profile && fan.savedDrops.some(function (drop) { return drop.id === profile.collectible.id; }));
      button.setAttribute('aria-pressed',String(active));
      button.textContent = active ? 'IN LOCKER ✓' : 'SAVE CONCEPT DROP';
    });
  }
  function profileFromButton(button) {
    return M.athleteProfile(button.dataset.sportId,button.dataset.teamId,button.dataset.athleteId,{now:Date.now()});
  }
  function storyByKey(key) {
    var pools = pulseStories.slice();
    if (currentPreviewStory) pools.push(currentPreviewStory);
    if (pageKind === 'league') pools = pools.concat(leagueStoriesFromState());
    return pools.filter(function (story) { return story.key === key; })[0] || null;
  }
  function handleAction(event) {
    var target = event.target.closest('[data-fw-action]');
    if (!target) return;
    var action = target.dataset.fwAction;
    if (action === 'open') { event.preventDefault(); openDrawer(target); return; }
    if (action === 'close') { event.preventDefault(); closeDrawer(); return; }
    if (action === 'refresh-live') { event.preventDefault(); refreshLiveMoments(true); return; }
    if (action === 'pulse-next') { event.preventDefault(); pulseIndex = (pulseIndex + 1) % Math.max(1,pulseStories.length); renderWorldPulse(); return; }
    if (action === 'share-story') {
      event.preventDefault();
      shareStory(storyByKey(target.dataset.storyKey));
      return;
    }
    if (action === 'follow-team') { toggleFollow('teams',target.dataset.teamId,target.dataset.label); return; }
    if (action === 'follow-athlete') { toggleFollow('athletes',target.dataset.athleteId,target.dataset.label); return; }
    if (action === 'save-drop') { saveDrop(profileFromButton(target)); return; }
    if (action === 'pick') {
      var story = storyByKey(target.dataset.storyKey);
      if (story) makeCall(story,target.dataset.side);
    }
  }
  function sportCode(story) {
    var sport = C.getSport(story.sportId);
    return sport && sport.code || story.sport.slice(0,2).toUpperCase();
  }
  function storyFixtureIdentity(story) {
    return story ? [story.sportId,story.home && story.home.id,story.away && story.away.id].join(':') : '';
  }
  function refreshWorldPulseStories(force) {
    var state = pageState();
    var fixtures = state && Array.isArray(state.fixtures) ? state.fixtures.filter(function (fixture) {
      return fixture && fixture.sport && fixture.home && fixture.away;
    }) : [];
    var signature = fixtures.map(function (fixture) { return [fixture.sport,fixture.home,fixture.away,fixture.href || ''].join(':'); }).join('|');
    if (!force && signature && signature === pulseFixtureSignature) return false;
    var now = Date.now();
    var previous = pulseStories.length ? pulseStories[pulseIndex % pulseStories.length] : null;
    var previousIdentity = storyFixtureIdentity(previous);
    var allStories = fixtures.map(function (fixture, fixtureIndex) {
      return M.matchStory(fixture.sport,fixture.home,fixture.away,{now:now,seed:'home-network-' + fixtureIndex});
    }).filter(Boolean).sort(function (left,right) { return right.heat - left.heat || left.key.localeCompare(right.key); });
    if (!allStories.length) allStories = M.world(now).matches.slice();
    var nextStories = allStories.slice(0,6);
    var preserved = previousIdentity && allStories.filter(function (story) { return storyFixtureIdentity(story) === previousIdentity; })[0];
    if (preserved) {
      var preservedIndex = nextStories.findIndex(function (story) { return storyFixtureIdentity(story) === previousIdentity; });
      if (preservedIndex < 0) {
        nextStories = [preserved].concat(nextStories.filter(function (story) { return storyFixtureIdentity(story) !== previousIdentity; })).slice(0,6);
        pulseIndex = 0;
      } else pulseIndex = preservedIndex;
    } else pulseIndex = Math.min(pulseIndex,nextStories.length - 1);
    pulseStories = nextStories;
    pulseFixtureSignature = signature || 'fallback:' + M.epoch(now).id;
    renderWorldPulse();
    return true;
  }
  function ensureWorldPulse() {
    if (pulseElement) return;
    pulseElement = document.createElement('section');
    pulseElement.className = 'fw-world-pulse';
    pulseElement.id = 'fw-world-pulse';
    pulseElement.setAttribute('aria-label','World Pulse featured story');
    document.body.appendChild(pulseElement);
    refreshWorldPulseStories(true);
  }
  function renderWorldPulse() {
    if (!pulseElement || !pulseStories.length) return;
    var story = pulseStories[pulseIndex % pulseStories.length];
    pulseElement.dataset.storyKey = story.key;
    pulseElement.dataset.fixtureSignature = pulseFixtureSignature;
    pulseElement.style.setProperty('--pulse',story.home.color);
    pulseElement.innerHTML = '<div class="fw-pulse-mark"><strong>' + esc(sportCode(story)) + '</strong><span>HEAT ' + esc(story.heat) + '</span></div><div class="fw-pulse-copy"><p>WORLD PULSE · ' + esc(story.stakes.label) + '</p><h2>' + esc(story.headline) + '</h2><span>' + esc(story.featured[0].name) + ' ↔ ' + esc(story.featured[1].name) + ' · ' + esc(story.home.city) + ' / ' + esc(story.away.city) + '</span></div><div class="fw-pulse-actions"><button class="fw-pulse-share" type="button" data-fw-action="share-story" data-story-key="' + esc(story.key) + '">SHARE<br>SIGNAL ↗</button><button class="fw-pulse-next" type="button" data-fw-action="pulse-next">NEXT<br>STORY →</button></div>';
  }
  function callMarkup(story) {
    var existing = fan.calls[story.key];
    function option(side) {
      var team = story[side];
      return '<button type="button" data-fw-action="pick" data-story-key="' + esc(story.key) + '" data-side="' + side + '" style="--pick-color:' + esc(team.color) + '" aria-pressed="' + String(Boolean(existing && existing.side === side)) + '">' + esc(team.code) + ' · ' + esc(team.name) + '</button>';
    }
    return '<div class="fw-call"><div class="fw-call-label"><span>CALL IT · FREE FAN PICK</span><b>' + esc(story.question) + '</b></div><div class="fw-call-options">' + option('home') + option('away') + '</div><div class="fw-call-note">FOR FUN · NO MONEY · NO PRIZE · LOCAL ONLY · NOT SETTLED AGAINST THIS CLIENT SIMULATION</div><div class="fw-story-actions"><button type="button" data-fw-action="share-story" data-story-key="' + esc(story.key) + '">SHARE THE SIGNAL</button><a href="' + esc(storyClipUrl(story)) + '">OPEN 12-SECOND CLIP ↗</a></div></div>';
  }
  function renderPreviewStory() {
    var preview = document.getElementById('game-preview');
    if (!preview) return;
    if (preview.hidden) {
      currentPreviewStory = null;
      if (pulseElement) pulseElement.classList.remove('is-muted');
      return;
    }
    var state = pageState();
    var selection = state && state.preview;
    if (!selection || !selection.open) return;
    var now = Date.now();
    var signature = [M.epoch(now).id,selection.sport,selection.index,selection.home,selection.away].join('|');
    var existing = preview.querySelector('.fw-preview-story');
    if (signature === previewRenderSignature && cachedPreviewStory && existing) {
      currentPreviewStory = cachedPreviewStory;
      if (pulseElement) pulseElement.classList.add('is-muted');
      refreshInteractiveStates();
      return;
    }
    var story = M.matchStory(selection.sport,selection.home,selection.away,{now:now,seed:'world-preview-' + selection.index});
    if (!story) return;
    previewRenderSignature = signature;
    cachedPreviewStory = story;
    currentPreviewStory = story;
    if (!existing) {
      existing = document.createElement('section');
      existing.className = 'fw-preview-story';
      var watch = preview.querySelector('.preview-watch');
      if (watch) watch.before(existing); else preview.appendChild(existing);
    }
    existing.dataset.renderSignature = signature;
    existing.innerHTML = '<div class="fw-preview-kicker"><span>WHY THIS MATTERS · ' + esc(story.stakes.label) + '</span><span>DRAMA ' + esc(story.heat) + '/99</span></div><h3>' + esc(story.headline) + '</h3><p>' + esc(story.stakes.line) + '</p><div class="fw-star-duel">' + story.featured.map(function (profile, index) {
      var team = index === 0 ? story.home : story.away;
      return '<article class="fw-star" style="--star-color:' + esc(team.color) + '"><span>' + esc(profile.status) + ' · ' + esc(profile.trajectory.label) + '</span><a href="' + esc(profile.canonicalUrl) + '">' + esc(profile.name) + '</a><small>' + esc(profile.gift.toUpperCase()) + '</small></article>';
    }).join('') + '</div>' + callMarkup(story);
    if (pulseElement) pulseElement.classList.add('is-muted');
    persist();
  }
  function initWorld() {
    ensureWorldPulse();
    var preview = document.getElementById('game-preview');
    if (preview) {
      new MutationObserver(renderPreviewStory).observe(preview,{attributes:true,attributeFilter:['hidden']});
      setInterval(function () {
        refreshWorldPulseStories(false);
        if (!preview.hidden) renderPreviewStory();
      },1000);
    }
  }
  function leagueSportId() {
    var state = pageState();
    return state && state.sport && state.sport.id || new URLSearchParams(location.search).get('sport') || 'soccer';
  }
  function leagueStoriesFromState() {
    var state = pageState();
    var sportId = state && state.sport && state.sport.id || new URLSearchParams(location.search).get('sport') || 'soccer';
    var channels = state && Array.isArray(state.liveChannels) ? state.liveChannels : [];
    var now = Date.now();
    var currentEpoch = M.epoch(now);
    var stories = channels.map(function (channel, index) {
      if (!channel || !channel.home || !channel.away) return null;
      var story = M.matchStory(sportId,channel.home,channel.away,{now:now,seed:currentEpoch.id + '|league-live-channel-' + index});
      if (story) story.channel = Number(channel.channel) || index + 1;
      return story;
    }).filter(Boolean);
    return stories.length === channels.length && stories.length ? stories : M.slate(sportId,now);
  }
  function renderLeagueStories() {
    var section = document.getElementById('fw-narrative-section');
    if (!section) return;
    var stories = leagueStoriesFromState();
    pulseStories = stories;
    section.innerHTML = '<header class="fw-narrative-head"><div><p>THE SIGNAL / CHARACTER INTELLIGENCE</p><h2>FOUR GAMES. FOUR REASONS TO CARE.</h2></div><span>Every broadcast now carries a human-sized pressure: a desire, a weakness, a rival who knows it, and one free supporter call. The arena stays autonomous.</span></header><div class="fw-story-grid">' + stories.map(function (story) {
      return '<article class="fw-story-card" style="--story:' + esc(story.home.color) + '"><div class="fw-story-meta"><span>CHANNEL ' + String(story.channel).padStart(2,'0') + ' · ' + esc(story.stakes.label) + '</span><span>DRAMA ' + esc(story.heat) + '/99</span></div><h3>' + esc(story.headline) + '</h3><p>' + esc(story.reason) + '</p><div class="fw-story-stars"><div style="--star:' + esc(story.home.color) + '"><a href="' + esc(story.featured[0].canonicalUrl) + '">' + esc(story.featured[0].name) + '</a><span>' + esc(story.featured[0].status) + ' · ' + esc(story.featured[0].arc.label) + '</span></div><i>VERSUS</i><div style="--star:' + esc(story.away.color) + '"><a href="' + esc(story.featured[1].canonicalUrl) + '">' + esc(story.featured[1].name) + '</a><span>' + esc(story.featured[1].status) + ' · ' + esc(story.featured[1].arc.label) + '</span></div></div>' + callMarkup(story) + '</article>';
    }).join('') + '</div>';
    refreshInteractiveStates();
  }
  function renderDossierTools() {
    var state = pageState();
    var selected = state && state.selectedClub;
    if (!selected || selected.id === lastDossierId && document.querySelector('.fw-club-tools')) {
      enrichRoster();
      return;
    }
    var sportId = leagueSportId();
    var team = M.resolveTeam(sportId,selected.id);
    if (!team) return;
    lastDossierId = selected.id;
    var rival = M.resolveTeam(sportId,team.rivalryId);
    var story = M.matchStory(sportId,team,rival,{now:Date.now(),seed:'club-dossier'});
    var profile = story && story.featured[0];
    var header = document.querySelector('.dossier-header');
    var tools = document.querySelector('.fw-club-tools');
    if (!tools) { tools = document.createElement('div'); tools.className = 'fw-club-tools'; if (header) header.after(tools); }
    tools.innerHTML = '<button type="button" data-fw-action="follow-team" data-team-id="' + esc(team.id) + '" data-label="' + esc(team.name) + '" aria-pressed="' + String(hasFollow('teams',team.id)) + '">' + (hasFollow('teams',team.id) ? 'FOLLOWING CLUB ✓' : 'FOLLOW CLUB') + '</button>' + (profile ? '<button type="button" data-fw-action="save-drop" data-sport-id="' + esc(sportId) + '" data-team-id="' + esc(team.id) + '" data-athlete-id="' + esc(profile.id) + '">SAVE ' + esc(profile.name.toUpperCase()) + ' DROP</button>' : '') + '<button type="button" data-fw-action="open">OPEN MY SIGNAL</button>';
    enrichRoster();
  }
  function enrichRoster() {
    var state = pageState();
    var sportId = leagueSportId();
    var selected = state && state.selectedClub;
    var team = selected && M.resolveTeam(sportId,selected.id);
    if (!team) return;
    document.querySelectorAll('#roster-grid .athlete-row').forEach(function (row) {
      var title = row.querySelector('h4');
      var athlete = title && M.resolveAthlete(team,title.textContent);
      if (!athlete || row.querySelector('.fw-follow-athlete')) return;
      var profile = M.athleteProfile(sportId,team,athlete,{now:Date.now()});
      var aura = document.createElement('span');
      aura.className = 'fw-aura';
      aura.textContent = profile.status + ' · ' + profile.trajectory.label + ' ' + (profile.trajectory.delta >= 0 ? '+' : '') + profile.trajectory.delta;
      row.appendChild(aura);
      var follow = document.createElement('button');
      follow.type = 'button';
      follow.className = 'fw-follow-athlete';
      follow.dataset.fwAction = 'follow-athlete';
      follow.dataset.athleteId = athlete.id;
      follow.dataset.label = athlete.name;
      follow.setAttribute('aria-pressed',String(hasFollow('athletes',athlete.id)));
      follow.textContent = hasFollow('athletes',athlete.id) ? 'FOLLOWING ✓' : 'FOLLOW';
      row.appendChild(follow);
    });
  }
  function initLeague() {
    var live = document.querySelector('.live-slate');
    if (live && !document.getElementById('fw-narrative-section')) {
      var section = document.createElement('section');
      section.id = 'fw-narrative-section';
      section.className = 'fw-narrative-section';
      section.setAttribute('aria-label','Character intelligence and supporter calls');
      live.after(section);
    }
    renderLeagueStories();
    renderDossierTools();
    var dossier = document.getElementById('club-dossier');
    if (dossier) {
      var queued = false;
      new MutationObserver(function () {
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () { queued = false; renderDossierTools(); });
      }).observe(dossier,{childList:true,subtree:true,characterData:true});
    }
  }
  function initPlayer() {
    var state = pageState();
    if (!state || !state.athlete || !state.team || !state.sport) return false;
    currentPlayerProfile = M.athleteProfile(state.sport.id,state.team.id,state.athlete.id,{now:Date.now()});
    if (!currentPlayerProfile) return false;
    var actions = document.querySelector('.hero-actions');
    if (!actions || document.querySelector('.fw-player-tools')) return true;
    var tools = document.createElement('div');
    tools.className = 'fw-player-tools';
    tools.innerHTML = '<button type="button" data-fw-action="follow-athlete" data-athlete-id="' + esc(currentPlayerProfile.id) + '" data-label="' + esc(currentPlayerProfile.name) + '" aria-pressed="' + String(hasFollow('athletes',currentPlayerProfile.id)) + '">' + (hasFollow('athletes',currentPlayerProfile.id) ? 'FOLLOWING ✓' : 'FOLLOW ATHLETE') + '</button><button type="button" data-fw-action="follow-team" data-team-id="' + esc(currentPlayerProfile.teamId) + '" data-label="' + esc(currentPlayerProfile.team) + '" aria-pressed="' + String(hasFollow('teams',currentPlayerProfile.teamId)) + '">' + (hasFollow('teams',currentPlayerProfile.teamId) ? 'FOLLOWING CLUB ✓' : 'FOLLOW CLUB') + '</button><button type="button" data-fw-action="save-drop" data-sport-id="' + esc(currentPlayerProfile.sportId) + '" data-team-id="' + esc(currentPlayerProfile.teamId) + '" data-athlete-id="' + esc(currentPlayerProfile.id) + '">SAVE CONCEPT DROP</button>';
    actions.after(tools);
    refreshInteractiveStates();
    return true;
  }
  function initialize() {
    ensureShell();
    decorateRenderHook();
    if (pageKind === 'world') initWorld();
    else if (pageKind === 'league') initLeague();
    else if (pageKind === 'player' && !initPlayer()) {
      var attempts = 0;
      var playerWait = setInterval(function () {
        decorateRenderHook();
        attempts += 1;
        if (initPlayer() || attempts > 80) clearInterval(playerWait);
      },100);
    }
    persist();
    setTimeout(function () { refreshLiveMoments(false); },80);
  }

  document.addEventListener('click',handleAction);
  document.addEventListener('keydown',function (event) {
    if (!document.documentElement.classList.contains('fw-open')) return;
    if (trapDrawerFocus(event)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeDrawer();
    }
  });
  root.addEventListener('storage',function (event) {
    if (event.key !== STORAGE_KEY || event.storageArea !== localStorage) return;
    try { fan = event.newValue == null ? normalizeState({}) : normalizeState(JSON.parse(event.newValue)); }
    catch (_error) { return; }
    rerankLiveMoments();
    renderDrawer();
    refreshInteractiveStates();
  });
  document.addEventListener('visibilitychange',function () {
    if (document.hidden) { clearLiveMomentTimer(); return; }
    if (!drawerIsOpen()) return;
    var age = liveMomentState.receivedAt ? Date.now()-liveMomentState.receivedAt : Number.POSITIVE_INFINITY;
    if (age > LIVE_STALE_MS) refreshLiveMoments(true);
    else scheduleLiveMomentRefresh(Math.max(250,LIVE_POLL_MS-age));
  });
  root.addEventListener('online',function () { if (drawerIsOpen()) refreshLiveMoments(true); });
  root.addEventListener('pagehide',function () {
    clearLiveMomentTimer();
    liveMomentGeneration += 1;
    if (liveMomentAbort) liveMomentAbort.abort();
    liveMomentAbort = null;
    liveMomentState.refreshing = false;
  });
  root.addEventListener('pageshow',function () {
    liveMomentState.refreshing = false;
    liveMomentAbort = null;
    if (!drawerIsOpen() || document.hidden) return;
    var age = liveMomentState.receivedAt ? Date.now()-liveMomentState.receivedAt : Number.POSITIVE_INFINITY;
    if (liveMomentState.phase === 'error' || age > LIVE_POLL_MS) refreshLiveMoments(true);
    else scheduleLiveMomentRefresh(Math.max(250,LIVE_POLL_MS-age));
  });
  root.CyberligaFanworld = Object.freeze({
    version: VERSION,
    getState: function () { return JSON.parse(JSON.stringify(publicState())); },
    open: openDrawer,
    close: closeDrawer,
    refreshLive: function () { refreshLiveMoments(true); },
    reset: function () { fan = normalizeState({}); persist(); }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',function () {
    var attempts = 0;
    var wait = setInterval(function () {
      attempts += 1;
      if (typeof root.render_game_to_text === 'function' || attempts > 60) { clearInterval(wait); initialize(); }
    },100);
  },{once:true});
  else {
    var attempts = 0;
    var wait = setInterval(function () {
      attempts += 1;
      if (typeof root.render_game_to_text === 'function' || attempts > 60) { clearInterval(wait); initialize(); }
    },100);
  }
})(typeof window !== 'undefined' ? window : globalThis);
