(function bootstrapCyberligaArenaSignal(root) {
  'use strict';

  if (root.CyberligaArenaSignal) return;

  var VERSION = '1.0.0';
  var POLL_MS = 1250;
  var FILE_SPORTS = {
    'index.html': 'soccer',
    'football.html': 'american-football',
    'hoops.html': 'basketball',
    'hockey.html': 'hockey',
    'baseball.html': 'baseball',
    'fight.html': 'combat'
  };
  var SCREEN_SPORTS = {
    soccer: 'soccer',
    football: 'american-football',
    'american-football': 'american-football',
    gridiron: 'american-football',
    hoops: 'basketball',
    basketball: 'basketball',
    ice: 'hockey',
    hockey: 'hockey',
    diamond: 'baseball',
    baseball: 'baseball',
    fight: 'combat',
    combat: 'combat'
  };
  var BLOCKING_SELECTOR = '#bigcard.show, #goalflash.show, #flash.show, #moment.show, #final.show, #penstinger.show, #banner.show, #replayBug:not([hidden])';

  var ui = null;
  var timer = 0;
  var matchupKey = '';
  var previousScore = null;
  var publicState = {
    version: VERSION,
    screen: 'arena-signal',
    autonomous: true,
    interaction: 'view-only',
    status: 'booting',
    sportId: null,
    teams: [],
    storyId: null,
    stakes: null,
    headline: null,
    stars: [],
    liveBeat: null,
    visible: false,
    hiddenReason: 'waiting-for-state',
    updates: 0
  };

  function copyState() {
    try {
      return JSON.parse(JSON.stringify(publicState));
    } catch (_error) {
      return {
        version: VERSION,
        screen: 'arena-signal',
        autonomous: true,
        interaction: 'view-only',
        status: 'unavailable',
        visible: false
      };
    }
  }

  root.CyberligaArenaSignal = Object.freeze({
    version: VERSION,
    getState: copyState
  });

  function clean(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function compact(value, limit) {
    var text = clean(value);
    var max = Number(limit) || 180;
    if (text.length <= max) return text;
    return text.slice(0, Math.max(1, max - 1)).trimEnd() + '…';
  }

  function normal(value) {
    return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function validColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(clean(value)) ? clean(value) : fallback;
  }

  function element(tag, className, text) {
    var node = root.document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function mount() {
    try {
      if (!root.document || !root.document.body || ui) return;

      var panel = element('aside', 'cyberliga-arena-signal');
      panel.id = 'cyberliga-arena-signal';
      panel.hidden = true;
      panel.dataset.suppressed = 'false';
      panel.setAttribute('aria-label', 'Cyberliga broadcast story signal');
      panel.setAttribute('aria-live', 'off');

      var top = element('div', 'arena-signal-top');
      var label = element('span', 'arena-signal-label', 'WHY THIS MATTERS');
      var league = element('span', 'arena-signal-league', 'CYBERLIGA');
      top.append(label, league);

      var story = element('div', 'arena-signal-story');
      var stakes = element('span', 'arena-signal-stakes', 'MATCH STORY');
      var headline = element('strong', 'arena-signal-headline', 'The story is finding the field.');
      story.append(stakes, headline);

      var duelLabel = element('span', 'arena-signal-duel-label', 'STAR DUEL');
      var duel = element('div', 'arena-signal-duel');
      var home = element('div', 'arena-signal-star arena-signal-star-home');
      var homeName = element('strong', 'arena-signal-star-name', '—');
      var homeMeta = element('span', 'arena-signal-star-meta', '—');
      home.append(homeName, homeMeta);
      var versus = element('span', 'arena-signal-versus', 'VS');
      var away = element('div', 'arena-signal-star arena-signal-star-away');
      var awayName = element('strong', 'arena-signal-star-name', '—');
      var awayMeta = element('span', 'arena-signal-star-meta', '—');
      away.append(awayName, awayMeta);
      duel.append(home, versus, away);

      var live = element('div', 'arena-signal-live');
      var liveMark = element('span', 'arena-signal-live-mark');
      var liveLabel = element('span', 'arena-signal-live-label', 'LIVE BEAT');
      var liveText = element('strong', 'arena-signal-live-text', 'Reading the broadcast…');
      live.append(liveMark, liveLabel, liveText);

      panel.append(top, story, duelLabel, duel, live);
      root.document.body.appendChild(panel);
      ui = {
        panel: panel,
        league: league,
        stakes: stakes,
        headline: headline,
        homeName: homeName,
        homeMeta: homeMeta,
        awayName: awayName,
        awayMeta: awayMeta,
        liveText: liveText
      };
      publicState.status = 'waiting-for-state';
      poll();
      timer = root.setInterval(poll, POLL_MS);
    } catch (_error) {
      publicState.status = 'unavailable';
      publicState.visible = false;
      publicState.hiddenReason = 'mount-unavailable';
    }
  }

  function readArenaState() {
    try {
      if (typeof root.render_game_to_text !== 'function') return null;
      var raw = root.render_game_to_text();
      if (raw && typeof raw.then === 'function') return null;
      if (typeof raw === 'string') return JSON.parse(raw);
      return raw && typeof raw === 'object' ? raw : null;
    } catch (_error) {
      return null;
    }
  }

  function inferSport(state) {
    var screen = normal(state && (state.screen || state.sport || state.sportId));
    if (SCREEN_SPORTS[screen]) return SCREEN_SPORTS[screen];
    for (var alias in SCREEN_SPORTS) {
      if (screen.indexOf(alias) >= 0) return SCREEN_SPORTS[alias];
    }
    var coordinateHint = normal(state && (state.coordinateSystem || state.note));
    if (coordinateHint.indexOf('pitch') >= 0) return 'soccer';
    if (coordinateHint.indexOf('court') >= 0) return 'basketball';
    if (coordinateHint.indexOf('rink') >= 0) return 'hockey';
    if (coordinateHint.indexOf('diamond') >= 0) return 'baseball';
    if (coordinateHint.indexOf('ring') >= 0) return 'combat';
    var file = clean(root.location && root.location.pathname).split('/').pop() || 'index.html';
    return FILE_SPORTS[file] || null;
  }

  function nameOf(entry) {
    if (typeof entry === 'string') return clean(entry);
    if (!entry || typeof entry !== 'object') return '';
    return clean(entry.name || entry.displayName || entry.team || entry.club || entry.code);
  }

  function twoNames(source) {
    if (!Array.isArray(source)) return [];
    return source.map(nameOf).filter(Boolean).filter(function (name, index, names) {
      return names.findIndex(function (candidate) { return normal(candidate) === normal(name); }) === index;
    }).slice(0, 2);
  }

  function inferTeamNames(state) {
    if (!state || typeof state !== 'object') return [];
    var fixture = state.fixture || {};
    var fixtureNames = twoNames(fixture.clubs || fixture.teams);
    if (fixtureNames.length === 2) return fixtureNames;
    if (Array.isArray(state.teams)) {
      var arrayNames = twoNames(state.teams);
      if (arrayNames.length === 2) return arrayNames;
    }
    if (state.teams && typeof state.teams === 'object') {
      var objectNames = twoNames([state.teams.home, state.teams.away]);
      if (objectNames.length === 2) return objectNames;
    }
    var fighterClubs = twoNames((state.fighters || []).map(function (fighter) { return fighter && fighter.club; }));
    return fighterClubs.length === 2 ? fighterClubs : [];
  }

  function describe(value) {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number') return compact(value, 170);
    if (Array.isArray(value)) return compact(value.map(describe).filter(Boolean).slice(0, 2).join(' · '), 170);
    if (typeof value !== 'object') return '';
    var label = clean(value.label || value.title || value.name || value.kind || value.type || value.outcome || value.result);
    var detail = clean(value.detail || value.description || value.reason || value.text || value.call);
    if (normal(label) === normal(detail)) detail = '';
    return compact([label, detail].filter(Boolean).join(' — '), 170);
  }

  function scorePair(state) {
    if (!state) return null;
    if (state.score && !Array.isArray(state.score) && Number.isFinite(Number(state.score.home)) && Number.isFinite(Number(state.score.away))) {
      return [Number(state.score.home), Number(state.score.away)];
    }
    if (Array.isArray(state.score) && state.score.length >= 2) {
      return [Number(state.score[0]) || 0, Number(state.score[1]) || 0];
    }
    if (Array.isArray(state.teams) && state.teams.length >= 2) {
      var first = state.teams[0] || {};
      var second = state.teams[1] || {};
      var firstScore = first.score != null ? first.score : first.runs;
      var secondScore = second.score != null ? second.score : second.runs;
      if (firstScore != null && secondScore != null) return [Number(firstScore) || 0, Number(secondScore) || 0];
    }
    return null;
  }

  function scoreLine(score, story) {
    if (!score || !story) return '';
    return story.home.code + ' ' + score[0] + ' — ' + score[1] + ' ' + story.away.code;
  }

  function scoringBeat(score, story) {
    if (!score || !previousScore || !story) return '';
    var homeChanged = score[0] !== previousScore[0];
    var awayChanged = score[1] !== previousScore[1];
    if (!homeChanged && !awayChanged) return '';
    var code = homeChanged && !awayChanged ? story.home.code : awayChanged && !homeChanged ? story.away.code : 'THE MATCH';
    return code + ' changes the score. ' + scoreLine(score, story) + '.';
  }

  function soccerBeat(state, story, score) {
    var event = describe(state.tacticalContext && state.tacticalContext.event);
    if (event) return event;
    if (state.offside && state.offside.watch) {
      return compact(state.offside.watch.receiver + ' is testing the last line before the pass arrives.', 170);
    }
    if (state.spectacle && state.spectacle.last) {
      var technique = state.spectacle.last;
      if (typeof technique === 'object') {
        return compact((technique.player ? technique.player + ' reveals ' : 'Technique watch: ') + (technique.type || technique.label || 'a signature technique') + '.', 170);
      }
      return compact('Technique watch: ' + technique + '.', 170);
    }
    var stats = state.matchStats || {};
    if (stats.possession && stats.shots) {
      return scoreLine(score, story) + ' · possession ' + stats.possession.home + '% / ' + stats.possession.away + '% · shots ' + stats.shots.home + ' / ' + stats.shots.away + '.';
    }
    return scoreLine(score, story) || compact(state.mode || 'The opening shape is settling.', 170);
  }

  function footballBeat(state, story, score) {
    if (state.phase === 'replay') return compact('Replay: ' + (state.headline || state.lastEvent || 'the last decisive collision') + '.', 170);
    var event = describe(state.lastEvent);
    if (event) return event;
    if (state.headline || state.detail) return compact([state.headline, state.detail].filter(Boolean).join(' — '), 170);
    var situation = state.down ? state.down + ' & ' + Math.max(1, Math.round(Number(state.toGo) || 1)) : '';
    return compact([scoreLine(score, story), situation, state.fieldPosition, state.possession ? state.possession + ' ball' : ''].filter(Boolean).join(' · '), 170);
  }

  function basketballBeat(state, story, score) {
    var outcome = describe(state.lastOutcome);
    if (outcome && ['live', 'play', 'ready'].indexOf(normal(outcome)) === -1) return outcome;
    if (state.transition && state.transition.active) return compact('Transition chance: ' + (state.transition.reason || state.action || 'the floor has opened') + '.', 170);
    if (state.action || state.decision) {
      var quality = state.shotQuality && state.shotQuality.label ? ' · shot read ' + state.shotQuality.label : '';
      return compact((state.action || state.play || 'Half-court read') + quality + (state.decision ? ' — ' + state.decision : ''), 170);
    }
    return scoreLine(score, story) || 'Both clubs are building the next possession.';
  }

  function hockeyBeat(state, story, score) {
    var event = describe(state.broadcast && state.broadcast.event);
    if (event) return event;
    var decision = describe(state.causality && state.causality.lastDecision);
    if (decision) return decision;
    if (state.puck && state.puck.carrier) {
      return compact(state.puck.carrier + ' carries at ' + state.puck.speed + ' m/s' + (state.puck.passTarget ? ' with ' + state.puck.passTarget + ' ahead' : '') + '.', 170);
    }
    return scoreLine(score, story) || 'The next possession is forming through center ice.';
  }

  function baseballBeat(state, story, score) {
    if (state.pitchCall) return describe(state.pitchCall);
    if (state.play && state.play.finalResult) return compact(state.play.finalResult + (state.play.fielder ? ' · ' + state.play.fielder + ' completes the read.' : '.'), 170);
    if (state.lastPitch) {
      var pitch = state.lastPitch;
      return compact([pitch.name, pitch.location, pitch.result].filter(Boolean).join(' · '), 170);
    }
    if (state.batter || (state.gamePlan && state.gamePlan.pitchIntent)) {
      return compact((state.batter || 'The hitter') + ' faces ' + ((state.gamePlan && state.gamePlan.pitchIntent) || 'the next pitch') + ' · ' + scoreLine(score, story) + '.', 170);
    }
    return scoreLine(score, story) || compact(state.status || 'The next pitch is being selected.', 170);
  }

  function combatBeat(state) {
    if (state.winner) return compact(state.winner + ' has the decision: ' + (state.method || 'bout complete') + '.', 170);
    if (state.downFighter) return compact(state.downFighter + ' is down · count ' + (state.count || 0) + '.', 170);
    var impact = describe(state.lastImpact);
    if (impact) return impact;
    var active = (state.fighters || []).filter(function (fighter) { return fighter && (fighter.strike || fighter.action === 'strike'); })[0];
    if (active) return compact(active.name + ' commits to ' + (active.strike || active.intent || 'the exchange') + ' at ' + clean(state.range && state.range.band).toLowerCase() + ' range.', 170);
    if (state.range) return compact('Range battle: ' + state.range.band + ' · exchange ' + (state.exchange || 0) + '.', 170);
    return compact(state.status || 'Both corners are reading the next exchange.', 170);
  }

  function liveBeat(sportId, state, story, score) {
    var changed = scoringBeat(score, story);
    if (changed) return changed;
    if (sportId === 'soccer') return soccerBeat(state, story, score);
    if (sportId === 'american-football') return footballBeat(state, story, score);
    if (sportId === 'basketball') return basketballBeat(state, story, score);
    if (sportId === 'hockey') return hockeyBeat(state, story, score);
    if (sportId === 'baseball') return baseballBeat(state, story, score);
    if (sportId === 'combat') return combatBeat(state);
    return compact(state.mode || state.state || state.status || 'The live state is still resolving.', 170);
  }

  function actualCombatStars(mythos, story, state, home, away, now) {
    if (!Array.isArray(state.fighters) || state.fighters.length < 2) return story.featured;
    return [home, away].map(function (team, index) {
      var fighter = state.fighters.filter(function (candidate) {
        return candidate && normal(candidate.club) === normal(team.name);
      })[0] || state.fighters[index];
      return fighter && mythos.athleteProfile(story.sportId, team.id, fighter.name, { now: now }) || story.featured[index];
    });
  }

  function visibilityReason(hasStory) {
    if (!hasStory) return 'waiting-for-story';
    try {
      if (root.document.querySelector(BLOCKING_SELECTOR)) return 'arena-moment';
    } catch (_error) {}
    return null;
  }

  function setUnavailable(reason) {
    publicState.status = reason;
    publicState.visible = false;
    publicState.hiddenReason = reason;
    if (ui && !publicState.storyId) ui.panel.hidden = true;
  }

  function poll() {
    try {
      if (!ui) return;
      var mythos = root.CyberligaMythos;
      if (!mythos || typeof mythos.matchStory !== 'function') {
        setUnavailable('waiting-for-mythos');
        return;
      }
      var arenaState = readArenaState();
      if (!arenaState) {
        setUnavailable('waiting-for-state');
        return;
      }
      var sportId = inferSport(arenaState);
      var names = inferTeamNames(arenaState);
      if (!sportId || names.length !== 2) {
        setUnavailable('waiting-for-matchup');
        return;
      }
      var home = mythos.resolveTeam(sportId, names[0]);
      var away = mythos.resolveTeam(sportId, names[1]);
      if (!home || !away || home.id === away.id) {
        setUnavailable('waiting-for-club-ids');
        return;
      }

      var now = Date.now();
      var story = mythos.matchStory(sportId, home.id, away.id, { now: now });
      if (!story) {
        setUnavailable('waiting-for-story');
        return;
      }
      var nextMatchupKey = sportId + ':' + home.id + ':' + away.id;
      var score = scorePair(arenaState);
      if (nextMatchupKey !== matchupKey) {
        matchupKey = nextMatchupKey;
        previousScore = score ? score.slice() : null;
      }

      var stars = sportId === 'combat'
        ? actualCombatStars(mythos, story, arenaState, home, away, now)
        : story.featured;
      var homeStar = stars[0] || story.featured[0];
      var awayStar = stars[1] || story.featured[1];
      var beat = liveBeat(sportId, arenaState, story, score) || 'The live state is still resolving.';

      ui.panel.hidden = false;
      ui.panel.dataset.sport = sportId;
      ui.panel.style.setProperty('--arena-signal-home', validColor(story.home.color, '#00e5ff'));
      ui.panel.style.setProperty('--arena-signal-away', validColor(story.away.color, '#ff45d6'));
      ui.league.textContent = compact(story.league, 42);
      ui.stakes.textContent = compact(story.stakes && story.stakes.label || 'MATCH STORY', 40);
      ui.headline.textContent = compact(story.headline, 180);
      ui.homeName.textContent = compact(homeStar && homeStar.name || home.name, 36);
      ui.homeMeta.textContent = compact([homeStar && homeStar.role, homeStar && homeStar.gift].filter(Boolean).join(' · '), 90);
      ui.awayName.textContent = compact(awayStar && awayStar.name || away.name, 36);
      ui.awayMeta.textContent = compact([awayStar && awayStar.role, awayStar && awayStar.gift].filter(Boolean).join(' · '), 90);
      ui.liveText.textContent = compact(beat, 180);
      ui.panel.classList.add('is-ready');

      var hiddenReason = visibilityReason(true);
      ui.panel.dataset.suppressed = hiddenReason === 'arena-moment' ? 'true' : 'false';
      publicState = {
        version: VERSION,
        screen: 'arena-signal',
        autonomous: true,
        interaction: 'view-only',
        status: 'ready',
        sportId: sportId,
        teams: [
          { id: home.id, name: home.name, code: home.code },
          { id: away.id, name: away.name, code: away.code }
        ],
        storyId: story.id,
        stakes: story.stakes && story.stakes.label || null,
        headline: story.headline,
        stars: [
          { athleteId: homeStar && homeStar.id || null, name: homeStar && homeStar.name || home.name, teamId: home.id },
          { athleteId: awayStar && awayStar.id || null, name: awayStar && awayStar.name || away.name, teamId: away.id }
        ],
        liveBeat: beat,
        compact: Number(root.innerWidth) <= 480,
        visible: !hiddenReason,
        hiddenReason: hiddenReason,
        updates: publicState.updates + 1
      };
      previousScore = score ? score.slice() : null;
    } catch (_error) {
      setUnavailable('state-unavailable');
    }
  }

  if (!root.document) {
    publicState.status = 'document-unavailable';
    publicState.hiddenReason = 'document-unavailable';
  } else if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})(typeof window !== 'undefined' ? window : globalThis);
