(function bootstrapLeagueHQ(root) {
  'use strict';

  var C = root.CYBERLIGA_CONTENT;
  var B = root.CyberligaBrand;
  if (!C || !B) {
    document.body.innerHTML = '<p class="standings-empty">THE LEAGUE SIGNAL COULD NOT BE ACQUIRED.</p>';
    return;
  }

  var params = new URLSearchParams(root.location.search);
  var publicSports = B.getPublicSports(C);
  var publicIds = publicSports.map(function (sport) { return sport.id; });
  var sportId = publicIds.indexOf(params.get('sport')) >= 0 ? params.get('sport') : 'soccer';
  var sport = C.getSport(sportId);
  var league = B.getLeague(sportId);
  document.body.dataset.sport = sportId;
  var teams = C.getTeams(sportId);
  var requestedTeam = C.getTeam(params.get('team'), sportId);
  var selectedTeam = requestedTeam || teams[0];
  var rosterFilter = 'all';
  var elapsedMs = 0;
  var slot = Math.floor(Date.now() / 900000);
  var season = C.createSeason(sportId, 'epoch-01-' + Math.floor(slot / 96));
  var round = season.rounds[Math.abs(slot) % season.rounds.length];
  var stateSource = 'LOCAL SHARED FALLBACK';

  function byId(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
    });
  }
  function team(teamId) { return C.getTeam(teamId, sportId) || teams[0]; }
  function brand(teamValue) { return B.getTeam(teamValue.id) || {venue:'HOME GROUND',venueLine:teamValue.city,ritual:'The home end carries the signal.',statement:teamValue.motion}; }
  function displayName(teamValue) { return B.displayName(teamValue); }
  function displayCity(teamValue) { return B.displayCity(teamValue); }
  function venueMedia(teamValue, eager) {
    var identity = brand(teamValue);
    if (!identity.venueImage) return B.sceneSvg(teamValue);
    return '<img class="venue-photo" src="' + esc(identity.venueImage) + '" alt="' + esc(identity.venue + ', the home venue of ' + displayName(teamValue)) + '"' + (eager ? '' : ' loading="lazy"') + ' />';
  }
  function arenaUrl(homeId, awayId) {
    var query = new URLSearchParams({home:homeId || selectedTeam.id, away:awayId || selectedTeam.rivalryId, league:sportId});
    return league.arena + '?' + query.toString();
  }
  function setLeagueColor(value) {
    document.documentElement.style.setProperty('--league', value);
  }
  function setTeamColor(value) {
    document.documentElement.style.setProperty('--team', value.colors.primary);
    document.documentElement.style.setProperty('--team-2', value.colors.secondary);
    document.documentElement.style.setProperty('--team-3', value.colors.accent);
    byId('club-dossier').style.setProperty('--team', value.colors.primary);
  }
  function updateUrl(replace) {
    var next = new URL(root.location.href);
    next.searchParams.set('sport', sportId);
    next.searchParams.set('team', selectedTeam.id);
    root.history[replace ? 'replaceState' : 'pushState']({sport:sportId,team:selectedTeam.id},'',next.pathname + next.search + next.hash);
  }
  function athleteUnit(athlete) {
    return /linebacker|safety|cornerback|defensive|nose tackle|edge rusher/i.test(athlete.role) ? 'defense' : 'offense';
  }

  function renderSportTabs() {
    var switcher = byId('sport-switcher');
    switcher.innerHTML = publicSports.map(function (item) {
      var identity = B.getLeague(item.id);
      return '<a class="sport-tab' + (item.id === sportId ? ' active' : '') + '" href="league.html?sport=' + encodeURIComponent(item.id) + '&amp;team=' + encodeURIComponent(item.teams[0].id) + '" style="--tab:' + esc(identity.accent) + '"' + (item.id === sportId ? ' aria-current="page"' : '') + '>' +
        '<em>' + esc(identity.code) + '</em><b>' + esc(item.name.toUpperCase()) + '</b><span>' + esc(identity.short) + '</span></a>';
    }).join('');
    var activeTab = switcher.querySelector('.active');
    if (activeTab) root.requestAnimationFrame(function () {
      switcher.scrollLeft = Math.max(0,activeTab.offsetLeft - (switcher.clientWidth - activeTab.offsetWidth) / 2);
    });
  }

  function renderHero() {
    var hero = byId('league-hero');
    var image = byId('league-hero-image');
    var hasImage = Boolean(league.hero);
    document.title = 'CYBERLIGA — ' + league.name;
    byId('league-code').textContent = league.code;
    byId('league-name').textContent = league.name;
    byId('league-thesis').textContent = league.thesis;
    byId('league-architecture').textContent = league.architecture;
    byId('broadcast-language').textContent = league.broadcast;
    hero.classList.toggle('hero-fallback',!hasImage);
    image.hidden = !hasImage;
    if (hasImage) {
      image.src = league.hero;
      var anchor = league.heroClubId ? C.getTeam(league.heroClubId,sportId) : null;
      image.alt = anchor ? brand(anchor).venue + ', home of ' + displayName(anchor) : league.name + ' venue concept: ' + league.architecture;
    } else {
      image.removeAttribute('src');
      image.alt = '';
    }
    byId('arena-link').href = league.arena;
    setLeagueColor(league.accent);
  }

  function renderChannels() {
    byId('channel-grid').innerHTML = round.matches.map(function (match, index) {
      var home = team(match.homeId);
      var away = team(match.awayId);
      return '<a class="channel-card" href="' + esc(arenaUrl(home.id,away.id)) + '" aria-label="Enter live channel ' + (index + 1) + ': ' + esc(displayName(home)) + ' against ' + esc(displayName(away)) + '">' +
        '<div class="channel-top"><b>LIVE</b><span>CHANNEL ' + String(index + 1).padStart(2,'0') + ' · ROUND ' + esc(round.number) + '</span></div>' +
        '<div class="channel-match"><div class="channel-club" style="--club-color:' + esc(home.colors.primary) + '"><strong>' + esc(home.code) + '</strong><span>' + esc(displayName(home)) + '</span></div><em>VS</em><div class="channel-club" style="--club-color:' + esc(away.colors.primary) + '"><strong>' + esc(away.code) + '</strong><span>' + esc(displayName(away)) + '</span></div></div>' +
        '<p>' + esc(displayCity(home).toUpperCase()) + ' ↔ ' + esc(displayCity(away).toUpperCase()) + (match.rivalry ? ' · RIVALRY SIGNAL' : ' · SHARED WORLD CLOCK') + '</p></a>';
    }).join('');
  }

  function renderClubGrid() {
    byId('club-grid').innerHTML = teams.map(function (item) {
      var identity = brand(item);
      return '<button class="club-card' + (item.id === selectedTeam.id ? ' selected' : '') + '" type="button" data-team="' + esc(item.id) + '" style="--team:' + esc(item.colors.primary) + '" aria-pressed="' + String(item.id === selectedTeam.id) + '">' +
        '<div class="club-scene">' + venueMedia(item,false) + '</div>' +
        '<div class="club-body"><div class="club-brand-row">' + B.crestSvg(item) + '<div class="club-city"><p>' + esc(displayCity(item).toUpperCase()) + ' / ' + esc(item.code) + '</p><h3>' + esc(displayName(item)) + '</h3></div>' + B.kitSvg(item,'home') + '</div>' +
        '<div class="club-venue"><span>' + esc(identity.venue) + '<br>' + esc(item.motif.toUpperCase()) + '</span><b>OPEN DOSSIER ↓</b></div></div></button>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('[data-team]'), function (button) {
      button.addEventListener('click', function () {
        selectedTeam = team(button.dataset.team);
        rosterFilter = sportId === 'american-football' ? 'offense' : 'all';
        updateUrl(false);
        renderClubGrid();
        renderDossier();
        byId('club-dossier').scrollIntoView({behavior:'smooth',block:'start'});
      });
    });
  }

  function swatch(color, label) {
    var numeric = parseInt(color.slice(1),16);
    var luminance = ((numeric >> 16) * .299 + ((numeric >> 8) & 255) * .587 + (numeric & 255) * .114);
    return '<div class="color-swatch" style="--swatch:' + esc(color) + ';--label:' + (luminance > 145 ? '#050607' : '#f3f1e9') + '"><span>' + esc(label) + ' ' + esc(color.toUpperCase()) + '</span></div>';
  }

  function renderKits(item) {
    var identity = brand(item);
    var variants = [
      ['home','01','HOME SIGNAL','Primary color / city motif / full crowd recognition'],
      ['away','02','CITY LIGHT','Pale counterfield / exact crest / contrast-first broadcast read'],
      ['night','03','NIGHT CIRCUIT','Black technical base / luminous trim / late-window identity']
    ];
    byId('kit-grid').innerHTML = variants.map(function (variant) {
      return '<article class="kit-card" data-index="' + variant[1] + '">' + B.kitSvg(item,variant[0]) + '<div class="kit-caption"><p>' + esc(item.code) + ' / ' + esc(identity.kitPattern.toUpperCase()) + ' SYSTEM</p><h4>' + variant[2] + '</h4><span>' + variant[3] + '</span></div></article>';
    }).join('');
  }

  function renderRoster(item) {
    var filterBar = byId('roster-filters');
    if (sportId === 'american-football') {
      filterBar.hidden = false;
      if (rosterFilter === 'all') rosterFilter = 'offense';
      filterBar.innerHTML = [['offense','OFFENSE 11'],['defense','DEFENSE 11'],['all','FULL 22']].map(function (option) {
        return '<button type="button" data-roster-unit="' + option[0] + '" aria-pressed="' + String(rosterFilter === option[0]) + '">' + option[1] + '</button>';
      }).join('');
      Array.prototype.forEach.call(filterBar.querySelectorAll('button'), function (button) {
        button.addEventListener('click', function () { rosterFilter = button.dataset.rosterUnit; renderRoster(item); });
      });
    } else {
      filterBar.hidden = true;
      rosterFilter = 'all';
    }
    var athletes = rosterFilter === 'all' ? item.athletes : item.athletes.filter(function (athlete) { return athleteUnit(athlete) === rosterFilter; });
    byId('roster-count').textContent = athletes.length + ' ACTIVE ATHLETES · SELECT ANY FILE';
    byId('roster-grid').innerHTML = athletes.map(function (athlete) {
      var playerUrl = 'player.html?sport=' + encodeURIComponent(sportId) + '&team=' + encodeURIComponent(item.id) + '&player=' + encodeURIComponent(athlete.id);
      var wireUrl = 'social.html?sport=' + encodeURIComponent(sportId) + '&team=' + encodeURIComponent(item.id) + '&player=' + encodeURIComponent(athlete.id) + '#player-' + encodeURIComponent(athlete.id);
      return '<article class="athlete-row"><span class="athlete-number">' + esc(String(athlete.number).padStart(2,'0')) + '</span><p class="athlete-role">' + esc(athlete.role.toUpperCase()) + ' / ' + esc(item.code) + '</p><h4>' + esc(athlete.name) + '</h4><span class="athlete-archetype">' + esc(athlete.archetype) + '</span><span class="athlete-signature">' + esc(athlete.signature) + '</span><div class="athlete-links"><a href="' + esc(playerUrl) + '" aria-label="Open ' + esc(athlete.name) + ' athlete file">FILE</a><a href="' + esc(wireUrl) + '" aria-label="Follow ' + esc(athlete.name) + ' on the World Wire">WIRE</a></div></article>';
    }).join('');
  }

  function renderDossier() {
    var item = selectedTeam;
    var identity = brand(item);
    var rival = team(item.rivalryId);
    setTeamColor(item);
    byId('dossier-crest').innerHTML = B.crestSvg(item);
    byId('club-location').textContent = displayCity(item).toUpperCase() + ' / ' + item.region.toUpperCase() + ' / ' + item.code;
    byId('club-name').textContent = displayName(item);
    byId('club-statement').textContent = identity.statement;
    byId('color-system').innerHTML = swatch(item.colors.primary,'PRIMARY') + swatch(item.colors.secondary,'FIELD') + swatch(item.colors.accent,'FLASH');
    byId('club-founded').textContent = String(identity.founded);
    byId('club-capacity').textContent = Number(identity.capacity).toLocaleString();
    byId('club-supporters').textContent = identity.supporterGroup;
    byId('club-rivalry').textContent = B.rivalryName(item.id,rival.id);
    byId('venue-scene').innerHTML = venueMedia(item,true);
    byId('venue-name').textContent = identity.venue;
    byId('venue-line').textContent = identity.venueLine;
    byId('crowd-ritual').textContent = identity.ritual;
    byId('motion-title').textContent = item.motif.toUpperCase();
    byId('motion-line').textContent = item.motion + '. Materials: ' + item.texture + '.';
    byId('rival-name').textContent = B.rivalryName(item.id,rival.id);
    byId('rival-line').textContent = displayName(item) + ' and ' + displayName(rival) + ' meet in ' + displayCity(item) + ' and ' + displayCity(rival) + '.';
    byId('club-arena-link').href = arenaUrl(item.id,rival.id);
    renderKits(item);
    renderRoster(item);
  }

  function fallbackStandings() {
    return teams.map(function (item) {
      var value = B.hash(sportId + '|' + item.id + '|' + round.number);
      var played = 7 + value % 5;
      var draws = sportId === 'soccer' ? (value >>> 5) % 4 : 0;
      var wins = Math.min(played - draws, 2 + (value >>> 9) % Math.max(2, played - draws - 1));
      var losses = played - wins - draws;
      var differential = ((value >>> 15) % 29) - 11;
      return {team:{publicId:item.id,code:item.code,name:displayName(item)},played:played,wins:wins,draws:draws,losses:losses,scoreDifference:differential,points:sportId === 'soccer' ? wins * 3 + draws : wins};
    }).sort(function (left,right) { return right.points - left.points || right.scoreDifference - left.scoreDifference; }).map(function (row,index) { row.rank = index + 1; return row; });
  }

  function normalizeStandings(data) {
    if (!data || !Array.isArray(data.standings)) return fallbackStandings();
    var known = data.standings.filter(function (row) {
      return row && row.team && C.getTeam(row.team.publicId,sportId);
    });
    if (known.length !== teams.length) return fallbackStandings();
    return known;
  }

  function renderStandings(rows, source) {
    stateSource = source;
    byId('record-source').textContent = source + ' · ' + rows.length + ' CLUBS · ROUND ' + round.number;
    byId('standings-shell').innerHTML = '<table class="standings-table"><thead><tr><th>#</th><th>CLUB</th><th>P</th><th>W</th><th>D</th><th>L</th><th>DIFF</th><th>PTS</th></tr></thead><tbody>' + rows.map(function (row,index) {
      var item = C.getTeam(row.team.publicId,sportId);
      var diff = row.scoreDifference == null ? Number(row.scoreFor || 0) - Number(row.scoreAgainst || 0) : Number(row.scoreDifference);
      return '<tr><td class="rank">' + esc(row.rank || index + 1) + '</td><td><button class="standing-club" type="button" data-standing-team="' + esc(item.id) + '" style="--club-color:' + esc(item.colors.primary) + '"><b>' + esc(item.code) + '</b>' + esc(displayName(item)) + '</button></td><td>' + esc(row.played || 0) + '</td><td>' + esc(row.wins || 0) + '</td><td>' + esc(row.draws || 0) + '</td><td>' + esc(row.losses || 0) + '</td><td>' + esc(diff > 0 ? '+' + diff : diff) + '</td><td class="points">' + esc(row.points || 0) + '</td></tr>';
    }).join('') + '</tbody></table>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-standing-team]'), function (button) {
      button.addEventListener('click', function () {
        selectedTeam = team(button.dataset.standingTeam);
        updateUrl(false);
        renderClubGrid();
        renderDossier();
        byId('club-dossier').scrollIntoView({behavior:'smooth',block:'start'});
      });
    });
  }

  function liveScore(match) {
    if (sportId === 'combat') {
      var outcomes = ['UD 10','SD 10','TKO 08','KO 05'];
      return outcomes[B.hash(match.id + '|result') % outcomes.length];
    }
    var ranges = {soccer:4,'american-football':35,basketball:116,hockey:6,baseball:10};
    var floor = sportId === 'basketball' ? 72 : 0;
    var max = ranges[sportId] || 6;
    var left = floor + B.hash(match.id + '|home') % (max - floor + 1);
    var right = floor + B.hash(match.id + '|away') % (max - floor + 1);
    return left + '–' + right;
  }

  function renderFixtureList() {
    byId('fixture-list').innerHTML = round.matches.map(function (match,index) {
      var home = team(match.homeId), away = team(match.awayId);
      return '<a class="record-fixture" href="' + esc(arenaUrl(home.id,away.id)) + '"><span>CH ' + String(index + 1).padStart(2,'0') + '</span><div><b>' + esc(home.code) + ' ' + esc(displayName(home)) + '</b><b>' + esc(away.code) + ' ' + esc(displayName(away)) + '</b><small>' + (match.rivalry ? 'RIVALRY · ' : '') + 'LIVE WORLD FIXTURE</small></div><em>' + esc(liveScore(match)) + ' ↗</em></a>';
    }).join('');
  }

  function loadStandings() {
    renderStandings(fallbackStandings(),'LOCAL SHARED FALLBACK');
    fetch('api/league?sport=' + encodeURIComponent(sportId),{headers:{accept:'application/json'}})
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) { var rows = normalizeStandings(data); renderStandings(rows,rows === data.standings ? (data.canonical ? 'CANONICAL LEAGUE DATABASE' : 'SHARED SERVER FALLBACK') : 'LOCAL IDENTITY-SAFE FALLBACK'); })
      .catch(function () {});
  }

  byId('copy-league').addEventListener('click', function () {
    var button = this;
    var restore = button.textContent;
    Promise.resolve(root.navigator.clipboard && root.navigator.clipboard.writeText(root.location.href)).then(function () {
      button.textContent = 'LEAGUE LINK COPIED';
      root.setTimeout(function () { button.textContent = restore; },1200);
    }).catch(function () {});
  });

  root.addEventListener('popstate', function () {
    var next = new URLSearchParams(root.location.search);
    if (next.get('sport') !== sportId) { root.location.reload(); return; }
    var nextTeam = C.getTeam(next.get('team'),sportId);
    if (nextTeam) { selectedTeam = nextTeam; renderClubGrid(); renderDossier(); }
  });

  renderSportTabs();
  renderHero();
  renderChannels();
  renderClubGrid();
  renderDossier();
  renderFixtureList();
  loadStandings();
  updateUrl(true);

  window.render_game_to_text = function () {
    var identity = brand(selectedTeam);
    return JSON.stringify({
      screen:'league-hq',
      sport:{id:sport.id,name:sport.name,league:league.name},
      publicWorld:{sports:6,clubs:48,simultaneousGames:24,combatPublic:true},
      selectedClub:{id:selectedTeam.id,name:displayName(selectedTeam),city:displayCity(selectedTeam),venue:identity.venue,statement:identity.statement,rival:selectedTeam.rivalryId,colors:selectedTeam.colors},
      identity:{crest:'native-svg',uniforms:['home','away','night'],cityScene:identity.venueImage ? 'authored-photo' : 'native-svg',venueHero:identity.venueImage || league.hero || 'procedural-fallback',founded:identity.founded,capacity:identity.capacity,supporterGroup:identity.supporterGroup,rivalryName:B.rivalryName(selectedTeam.id,selectedTeam.rivalryId),crowdRitual:identity.ritual},
      liveChannels:round.matches.map(function (match,index) { return {channel:index + 1,home:match.homeId,away:match.awayId,rivalry:match.rivalry}; }),
      roster:{filter:rosterFilter,count:selectedTeam.athletes.length},
      standingsSource:stateSource,
      elapsedMs:elapsedMs
    });
  };
  window.advanceTime = function (ms) { elapsedMs += Math.max(0,Number(ms) || 0); return root.render_game_to_text(); };
  root.CyberligaLeagueHQ = Object.freeze({getState:function () { return JSON.parse(root.render_game_to_text()); }});
})(typeof window !== 'undefined' ? window : globalThis);
