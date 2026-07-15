(function bootstrapCyberligaBroadcastSpine(root) {
  'use strict';

  var C = root && root.CYBERLIGA_CONTENT;
  var Characters = root && root.CyberligaCharacters;
  var Brand = root && root.CyberligaBrand;
  var VERSION = '1.0.0';
  var MAX_QUEUE = 6;
  var DEFAULT_MOMENT_MS = 4800;
  var DEFAULT_SPOTLIGHT_MS = 5200;
  var DEFAULT_FINAL_MS = 2700;

  function finiteNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function exactTeam(team, sportId) {
    if (!C || !team || !sportId || typeof C.getTeam !== 'function') return null;
    var canonical = C.getTeam(team.id, sportId);
    return canonical === team ? canonical : null;
  }

  function exactAthlete(team, athlete) {
    if (!team || !athlete || !Array.isArray(team.athletes)) return null;
    return team.athletes.indexOf(athlete) >= 0 ? athlete : null;
  }

  function safeText(value, maximum) {
    return String(value == null ? '' : value)
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maximum || 180);
  }

  function makeNode(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function createMarkup(mount) {
    var shell = makeNode('section', 'cl-broadcast-spine');
    shell.dataset.version = VERSION;
    shell.dataset.mode = 'idle';
    shell.setAttribute('aria-live', 'polite');
    shell.setAttribute('aria-atomic', 'true');
    shell.setAttribute('aria-hidden', 'true');
    shell.setAttribute('role', 'status');

    var crest = makeNode('div', 'cl-spine-crest');
    var copy = makeNode('div', 'cl-spine-copy');
    var kicker = makeNode('div', 'cl-spine-kicker');
    var title = makeNode('strong', 'cl-spine-title');
    var identity = makeNode('div', 'cl-spine-identity');
    var detail = makeNode('div', 'cl-spine-detail');
    var proof = makeNode('div', 'cl-spine-proof');
    var proofId = makeNode('b');
    var proofBoundary = makeNode('span');

    copy.append(kicker, title, identity, detail);
    proof.append(proofId, proofBoundary);
    shell.append(crest, copy, proof);
    (mount || document.body).appendChild(shell);
    return { shell:shell, crest:crest, kicker:kicker, title:title, identity:identity, detail:detail, proofId:proofId, proofBoundary:proofBoundary };
  }

  function create(options) {
    options = options || {};
    if (!C || typeof document === 'undefined') return null;
    var sport = C.getSport && C.getSport(options.sportId);
    var home = sport && exactTeam(options.homeTeam, sport.id);
    var away = sport && exactTeam(options.awayTeam, sport.id);
    var fixtureId = safeText(options.fixtureId, 160);
    if (!sport || !home || !away || home === away || !fixtureId) return null;

    var nodes = createMarkup(options.mount);
    var active = null;
    var remainingMs = 0;
    var durationMs = 0;
    var queue = [];
    var destroyed = false;

    function sameFixtureTeam(team) {
      return team === home || team === away;
    }

    function foundingRecord(athlete) {
      return Characters && typeof Characters.get === 'function' ? Characters.get(athlete && athlete.id) : null;
    }

    function crestMarkup(team) {
      return Brand && typeof Brand.crestSvg === 'function' ? Brand.crestSvg(team) : '<span aria-hidden="true">' + safeText(team.code, 8) + '</span>';
    }

    function itemForSpotlight(input, itemOptions) {
      input = input || {};
      itemOptions = itemOptions || {};
      var team = exactTeam(input.team, sport.id);
      var athlete = team && exactAthlete(team, input.athlete);
      if (!team || !sameFixtureTeam(team) || !athlete) return null;
      var record = foundingRecord(athlete);
      var signature = record ? record.motionName + ' — ' + record.gift : athlete.signature;
      return {
        mode:'spotlight', priority:1, delayMs:clamp(finiteNumber(itemOptions.delayMs, 0), 0, 15000),
        durationMs:clamp(finiteNumber(itemOptions.durationMs, DEFAULT_SPOTLIGHT_MS), 1400, 9000),
        team:team, athlete:athlete, id:'watch/' + fixtureId + '/' + athlete.id,
        recordedFootage:false,
        kicker:'WHO TO WATCH · ' + sport.code,
        title:'#' + athlete.number + ' ' + athlete.name,
        identity:team.code + ' · ' + athlete.role + ' · ' + athlete.archetype,
        detail:signature,
        boundary:'VIEW-ONLY · CLIENT SIM'
      };
    }

    function resolveMomentIdentity(moment) {
      if (!moment || typeof moment !== 'object') return null;
      var teamId = moment.team && moment.team.id || moment.teamId;
      var athleteId = moment.athlete && moment.athlete.id || moment.athleteId;
      var team = C.getTeam(teamId, sport.id);
      var athlete = team && C.getAthlete(team.id, athleteId);
      if (!team || !athlete || !sameFixtureTeam(team)) return null;
      return { team:team, athlete:athlete };
    }

    function itemForMoment(moment, itemOptions) {
      itemOptions = itemOptions || {};
      var identity = resolveMomentIdentity(moment);
      var momentId = safeText(moment && (moment.id || moment.eventId), 180);
      if (!identity || !momentId) return null;
      var title = safeText(moment.title || moment.name || moment.kindLabel, 96);
      var kind = safeText(moment.eventTitle || moment.kindLabel || moment.kind, 42).replace(/_/g, ' ').toUpperCase();
      var phase = safeText(moment.phaseLabel || moment.clock, 42);
      var detail = safeText(moment.storyLine || moment.signature || identity.athlete.signature, 180);
      var founding = Boolean(moment.founding && moment.founding.founding);
      var recordedFootage = Boolean(moment.provenance && moment.provenance.recordedFootage === true);
      if (!title || !kind) return null;
      return {
        mode:itemOptions.mode === 'final' ? 'final' : 'moment',
        priority:itemOptions.mode === 'final' ? 2 : 3,
        delayMs:clamp(finiteNumber(itemOptions.delayMs, 0), 0, 15000),
        durationMs:clamp(finiteNumber(itemOptions.durationMs, itemOptions.mode === 'final' ? DEFAULT_FINAL_MS : DEFAULT_MOMENT_MS), 1400, 9000),
        team:identity.team, athlete:identity.athlete, id:momentId,
        recordedFootage:recordedFootage,
        kicker:itemOptions.kicker || (itemOptions.mode === 'final' ? 'MATCH MEMORY' :
          (recordedFootage ? 'REPLAY MOMENT · ' : 'LIVE MOMENT · ') + kind),
        title:title,
        identity:'#' + identity.athlete.number + ' ' + identity.athlete.name + ' · ' + identity.team.code +
          (founding ? ' · FOUNDING 12' : '') + (phase ? ' · ' + phase : ''),
        detail:detail,
        boundary:'NOT AUTHORITATIVE · NO MONEY · NO PRIZE'
      };
    }

    function paint(item) {
      active = item;
      durationMs = item.durationMs;
      remainingMs = item.durationMs;
      nodes.shell.dataset.mode = item.mode;
      nodes.shell.dataset.eventId = item.id;
      nodes.shell.style.setProperty('--cl-spine-accent', item.team.colors && item.team.colors.primary || '#65ffd4');
      nodes.shell.style.setProperty('--cl-spine-progress', '100%');
      nodes.crest.innerHTML = crestMarkup(item.team);
      nodes.kicker.textContent = item.kicker;
      nodes.title.textContent = item.title;
      nodes.identity.textContent = item.identity;
      nodes.detail.textContent = item.detail;
      nodes.proofId.textContent = item.mode === 'spotlight' ? 'IDENTITY ' + item.athlete.id : 'EVENT ' + item.id;
      nodes.proofBoundary.textContent = item.boundary;
      nodes.shell.classList.remove('is-leaving');
      nodes.shell.classList.add('is-visible');
      nodes.shell.setAttribute('aria-hidden', 'false');
    }

    function hide() {
      nodes.shell.classList.remove('is-visible', 'is-leaving');
      nodes.shell.setAttribute('aria-hidden', 'true');
      nodes.shell.dataset.mode = 'idle';
      nodes.shell.removeAttribute('data-event-id');
      active = null;
      remainingMs = 0;
      durationMs = 0;
    }

    function enqueue(item) {
      if (!item || destroyed) return false;
      if (active && item.priority > active.priority && item.delayMs <= 0) {
        queue = queue.filter(function (queued) { return queued.priority >= item.priority; });
        paint(item);
        return true;
      }
      if (!active && item.delayMs <= 0) {
        if (item.priority > 1) queue = queue.filter(function (queued) { return queued.priority >= item.priority; });
        paint(item);
        return true;
      }
      queue.push(item);
      queue.sort(function (left, right) { return right.priority - left.priority; });
      if (queue.length > MAX_QUEUE) queue.length = MAX_QUEUE;
      return true;
    }

    function ageQueue(deltaMs) {
      for (var index = 0; index < queue.length; index += 1) {
        queue[index].delayMs = Math.max(0, queue[index].delayMs - deltaMs);
      }
    }

    function advanceQueue() {
      if (!queue.length) { hide(); return; }
      var nextIndex = queue.findIndex(function (item) { return item.delayMs <= 0; });
      if (nextIndex < 0) { hide(); return; }
      var next = queue.splice(nextIndex, 1)[0];
      paint(next);
    }

    function tick(deltaMs) {
      if (destroyed) return;
      var delta = clamp(finiteNumber(deltaMs, 0), 0, 1000);
      ageQueue(delta);
      if (!active) {
        advanceQueue();
        return;
      }
      remainingMs = Math.max(0, remainingMs - delta);
      var ratio = durationMs > 0 ? remainingMs / durationMs : 0;
      nodes.shell.style.setProperty('--cl-spine-progress', (ratio * 100).toFixed(2) + '%');
      nodes.shell.classList.toggle('is-leaving', remainingMs > 0 && remainingMs <= 320);
      if (remainingMs <= 0) advanceQueue();
    }

    function spotlight(input, itemOptions) { return enqueue(itemForSpotlight(input, itemOptions)); }
    function present(moment, itemOptions) { return enqueue(itemForMoment(moment, itemOptions)); }

    function finale(moments) {
      var list = Array.isArray(moments) ? moments.slice(0, 3) : [];
      if (!list.length) return false;
      queue = [];
      hide();
      list.forEach(function (moment, index) {
        enqueue(itemForMoment(moment, {
          mode:'final', delayMs:index === 0 ? 0 : index * DEFAULT_FINAL_MS,
          durationMs:DEFAULT_FINAL_MS, kicker:'MATCH MEMORY ' + (index + 1) + ' / ' + list.length
        }));
      });
      return true;
    }

    function clear() { queue = []; hide(); }

    function state() {
      return Object.freeze({
        version:VERSION, fixtureId:fixtureId, sportId:sport.id,
        visible:Boolean(active), mode:active ? active.mode : 'idle',
        eventId:active ? active.id : null, athleteId:active ? active.athlete.id : null,
        teamId:active ? active.team.id : null, remainingMs:Math.round(remainingMs),
        queueLength:queue.length, recordedFootage:active ? active.recordedFootage : false,
        boundary:active ? active.boundary : null, pointerInteractive:false
      });
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      queue = [];
      active = null;
      nodes.shell.remove();
    }

    return Object.freeze({ spotlight:spotlight, present:present, finale:finale, tick:tick, clear:clear, state:state, destroy:destroy });
  }

  root.CyberligaBroadcastSpine = Object.freeze({ version:VERSION, create:create });
})(typeof globalThis !== 'undefined' ? globalThis : this);
