import { paintArcadePortraits, shareArcadeLink } from './arcade-world.js';

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
  var teams = C.getTeams(sportId);
  var requestedTeam = C.getTeam(params.get('team'), sportId);
  var selectedTeam = requestedTeam || teams[0];
  var rosterFilter = sportId === 'american-football' ? 'offense' : 'all';
  var elapsedMs = 0;
  var slot = Math.floor(Date.now() / 900000);
  var season = C.createSeason(sportId, 'epoch-01-' + Math.floor(slot / 96));
  var round = season.rounds[Math.abs(slot) % season.rounds.length];
  var stateSource = 'ILLUSTRATIVE LOCAL TABLE';

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
    var hasImage = false;
    document.title = 'CYBERLIGA — ' + league.name;
    byId('league-code').textContent = league.code;
    byId('league-name').textContent = sport.name + '.';
    byId('league-thesis').textContent = 'Eight cities. Their own heroes and rivals. Choose your club, meet the roster and catch a game.';
    byId('league-architecture').textContent = league.name;
    byId('aw-league-athletes').textContent = teams.reduce(function (total,item) { return total + item.athletes.length; },0);
    byId('broadcast-language').textContent = 'Pick a matchup. The athletes take it from here.';
    hero.classList.toggle('hero-fallback',!hasImage);
    image.hidden = !hasImage;
    if (hasImage) {
      image.src = league.hero;
      image.alt = league.name + ' venue concept: ' + league.architecture;
    } else {
      image.removeAttribute('src');
      image.alt = '';
    }
    byId('arena-link').href = arenaUrl(selectedTeam.id,selectedTeam.rivalryId);
    setLeagueColor('#2b4ef0');
  }

  function renderChannels() {
    byId('channel-grid').innerHTML = round.matches.map(function (match, index) {
      var home = team(match.homeId);
      var away = team(match.awayId);
      return '<a class="channel-card" href="' + esc(arenaUrl(home.id,away.id)) + '" aria-label="Enter live channel ' + (index + 1) + ': ' + esc(displayName(home)) + ' against ' + esc(displayName(away)) + '">' +
        '<div class="channel-top"><b>WATCH</b><span>CHANNEL ' + String(index + 1).padStart(2,'0') + ' · ROUND ' + esc(round.number) + '</span></div>' +
        '<div class="channel-match"><div class="channel-club" style="--club-color:' + esc(home.colors.primary) + '"><strong>' + esc(home.code) + '</strong><span>' + esc(displayName(home)) + '</span></div><em>VS</em><div class="channel-club" style="--club-color:' + esc(away.colors.primary) + '"><strong>' + esc(away.code) + '</strong><span>' + esc(displayName(away)) + '</span></div></div>' +
        '<p>' + esc(displayCity(home).toUpperCase()) + ' ↔ ' + esc(displayCity(away).toUpperCase()) + (match.rivalry ? ' · RIVALRY SIGNAL' : ' · AUTONOMOUS BROADCAST') + '</p></a>';
    }).join('');
  }

  function renderClubGrid() {
    byId('club-grid').innerHTML = teams.map(function (item) {
      var identity = brand(item);
      return '<button class="club-card' + (item.id === selectedTeam.id ? ' selected' : '') + '" type="button" data-team="' + esc(item.id) + '" style="--team:' + esc(item.colors.primary) + '" aria-pressed="' + String(item.id === selectedTeam.id) + '">' +
        '<div class="club-scene"><canvas class="aw-club-portrait" data-arcade-athlete="' + esc(item.athletes[0].id) + '" data-team-id="' + esc(item.id) + '" data-sport="' + esc(sportId) + '" aria-hidden="true"></canvas><span class="aw-club-code">' + esc(item.code) + '</span><span class="aw-club-number">#' + esc(item.athletes[0].number) + '</span></div>' +
        '<div class="club-body"><div class="club-brand-row">' + B.crestSvg(item) + '<div class="club-city"><p>' + esc(displayCity(item).toUpperCase()) + ' / ' + esc(item.code) + '</p><h3>' + esc(displayName(item)) + '</h3></div>' + '</div>' +
        '<div class="club-venue"><span>' + esc(identity.venue) + '<br>' + esc(item.motif.toUpperCase()) + '</span><b>MEET THE CLUB ↗</b></div></div></button>';
    }).join('');
    paintArcadePortraits(byId('club-grid'));
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
      return '<article class="athlete-row"><canvas class="aw-roster-portrait" data-arcade-athlete="' + esc(athlete.id) + '" data-team-id="' + esc(item.id) + '" data-sport="' + esc(sportId) + '" aria-label="' + esc(athlete.name) + ' pixel portrait"></canvas><span class="athlete-number">' + esc(String(athlete.number).padStart(2,'0')) + '</span><p class="athlete-role">' + esc(athlete.role.toUpperCase()) + ' / ' + esc(item.code) + '</p><h4>' + esc(athlete.name) + '</h4><span class="athlete-archetype">' + esc(athlete.archetype) + '</span><span class="athlete-signature">' + esc(athlete.signature) + '</span><div class="athlete-links"><a href="' + esc(playerUrl) + '" aria-label="Meet ' + esc(athlete.name) + '">MEET THE ATHLETE ↗</a></div></article>';
    }).join('');
    paintArcadePortraits(byId('roster-grid'));
  }

  function renderDossier() {
    var item = selectedTeam;
    var identity = brand(item);
    var rival = team(item.rivalryId);
    var portrait = byId('league-pixel-lineup');
    portrait.dataset.arcadeTeam = item.id;portrait.dataset.sport = sportId;
    portrait.setAttribute('aria-label',displayName(item) + ' canonical pixel athletes');
    byId('aw-hero-team').textContent = displayName(item);
    byId('aw-hero-city').textContent = displayCity(item);
    byId('arena-link').href = arenaUrl(item.id,rival.id);
    paintArcadePortraits(byId('league-hero'));
    setTeamColor(item);
    byId('dossier-crest').innerHTML = B.crestSvg(item);
    byId('club-location').textContent = displayCity(item).toUpperCase() + ' / ' + item.region.toUpperCase() + ' / ' + item.code;
    byId('club-name').textContent = displayName(item);
    byId('club-statement').textContent = identity.statement;
    byId('color-system').innerHTML = swatch(item.colors.primary,'PRIMARY') + swatch(item.colors.secondary,'FIELD') + swatch(item.colors.accent,'FLASH');
    byId('venue-scene').innerHTML = B.sceneSvg(item);
    byId('venue-name').textContent = identity.venue;
    byId('venue-line').textContent = identity.venueLine;
    byId('crowd-ritual').textContent = identity.ritual;
    byId('motion-title').textContent = item.motif.toUpperCase();
    byId('motion-line').textContent = item.motion + '. Materials: ' + item.texture + '.';
    byId('rival-name').textContent = displayName(rival);
    byId('rival-line').textContent = displayCity(item) + ' and ' + displayCity(rival) + ' carry the league\'s authored rivalry: ' + displayName(item) + ' vs ' + displayName(rival) + '.';
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

  function renderFixtureList() {
    byId('fixture-list').innerHTML = round.matches.map(function (match,index) {
      var home = team(match.homeId), away = team(match.awayId);
      return '<a class="record-fixture" href="' + esc(arenaUrl(home.id,away.id)) + '"><span>CH ' + String(index + 1).padStart(2,'0') + '</span><div><b>' + esc(home.code) + ' ' + esc(displayName(home)) + '</b><b>' + esc(away.code) + ' ' + esc(displayName(away)) + '</b><small>' + (match.rivalry ? 'RIVALRY · ' : '') + 'LIVE WORLD FIXTURE</small></div><em>' + 'WATCH ↗</em></a>';
    }).join('');
  }

  function loadStandings() {
    renderStandings(fallbackStandings(),'ILLUSTRATIVE LOCAL TABLE');
    fetch('api/league?sport=' + encodeURIComponent(sportId),{headers:{accept:'application/json'}})
      .then(function (response) { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .then(function (data) { var rows = normalizeStandings(data); renderStandings(rows,rows === data.standings ? (data.canonical ? 'CANONICAL LEAGUE DATABASE' : 'SIMULATED SERVER TABLE') : 'ILLUSTRATIVE LOCAL TABLE'); })
      .catch(function () {});
  }

  byId('copy-league').addEventListener('click', function () {
    shareArcadeLink(this,{title:'Cyberliga · ' + league.name,text:'Meet ' + displayName(selectedTeam) + ' in Cyberliga.',url:root.location.href});
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
      identity:{crest:'native-svg',uniforms:['home','away','night'],cityScene:'native-svg',venueHero:'authored-pixel-lineup',crowdRitual:identity.ritual},
      liveChannels:round.matches.map(function (match,index) { return {channel:index + 1,home:match.homeId,away:match.awayId,rivalry:match.rivalry}; }),
      roster:{filter:rosterFilter,count:selectedTeam.athletes.length},
      standingsSource:stateSource,
      elapsedMs:elapsedMs
    });
  };
  window.advanceTime = function (ms) { elapsedMs += Math.max(0,Number(ms) || 0); return root.render_game_to_text(); };
  root.CyberligaLeagueHQ = Object.freeze({getState:function () { return JSON.parse(root.render_game_to_text()); }});
})(typeof window !== 'undefined' ? window : globalThis);
