import { paintArcadePortraits, shareArcadeLink } from './arcade-world.js';

(function bootstrapLeagueHQ(root) {
  'use strict';

  var C = root.CYBERLIGA_CONTENT;
  var B = root.CyberligaBrand;
  if (!C || !B) {
    document.getElementById('league-hq').innerHTML = '<p class="league-unavailable">The league could not load. <a href="world.html">Return to Home</a></p>';
    return;
  }

  var params = new URLSearchParams(root.location.search);
  var publicSports = B.getPublicSports(C);
  var publicIds = publicSports.map(function (sport) { return sport.id; });
  var sportId = publicIds.indexOf(params.get('sport')) >= 0 ? params.get('sport') : 'soccer';
  var sport = C.getSport(sportId);
  var league = B.getLeague(sportId);
  var teams = C.getTeams(sportId);
  var selectedTeam = C.getTeam(params.get('team'), sportId) || teams[0];
  var rosterFilter = sportId === 'american-football' ? 'offense' : 'all';
  var dossierTab = 'roster';
  var elapsedMs = 0;
  var slot = Math.floor(Date.now() / 900000);
  var season = C.createSeason(sportId, 'epoch-01-' + Math.floor(slot / 96));
  var round = season.rounds[Math.abs(slot) % season.rounds.length];

  function byId(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
    });
  }
  function team(teamId) { return C.getTeam(teamId, sportId) || teams[0]; }
  function brand(value) { return B.getTeam(value.id) || {venue:'Home ground',venueLine:value.city,ritual:'The home end carries the signal.',statement:value.motion}; }
  function displayName(value) { return B.displayName(value); }
  function displayCity(value) { return B.displayCity(value); }
  function clubName(value) {
    var full = displayName(value), city = displayCity(value);
    return full.toLowerCase().startsWith(city.toLowerCase() + ' ') ? full.slice(city.length + 1) : full;
  }
  function arenaUrl(homeId, awayId) {
    var query = new URLSearchParams({home:homeId || selectedTeam.id, away:awayId || selectedTeam.rivalryId, league:sportId});
    return league.arena + '?' + query.toString();
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
  function showSelectedClub() {
    byId('club-dossier').scrollIntoView({behavior:root.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'start'});
  }

  function renderSportTabs() {
    var switcher = byId('sport-switcher');
    switcher.innerHTML = publicSports.map(function (item) {
      return '<a class="sport-tab' + (item.id === sportId ? ' active' : '') + '" href="league.html?sport=' + encodeURIComponent(item.id) + '&amp;team=' + encodeURIComponent(item.teams[0].id) + '"' + (item.id === sportId ? ' aria-current="page"' : '') + '><b>' + esc(item.name) + '</b></a>';
    }).join('');
    var activeTab = switcher.querySelector('.active');
    function revealActiveSport() {
      if (!activeTab) return;
      var offset = activeTab.getBoundingClientRect().left - switcher.getBoundingClientRect().left + switcher.scrollLeft;
      switcher.scrollLeft = Math.max(0,offset - (switcher.clientWidth - activeTab.offsetWidth) / 2);
    }
    root.requestAnimationFrame(revealActiveSport);
    if (document.fonts) document.fonts.ready.then(revealActiveSport);
    if (root.ResizeObserver) new ResizeObserver(revealActiveSport).observe(switcher);
  }

  function renderHero() {
    document.title = 'CYBERLIGA — ' + league.name;
    byId('league-code').textContent = league.code;
    byId('league-name').textContent = sport.name;
    byId('league-thesis').textContent = 'Eight cities. One league. Find a matchup or meet your club.';
    byId('league-architecture').textContent = league.name;
    byId('aw-league-athletes').textContent = teams.reduce(function (total,item) { return total + item.athletes.length; },0);
    byId('arena-link').href = arenaUrl(selectedTeam.id,selectedTeam.rivalryId);
  }

  function renderChannels() {
    function participant(value) {
      return '<div class="channel-club">' + B.crestSvg(value) + '<div><strong>' + esc(clubName(value)) + '</strong><small>' + esc(displayCity(value)) + '</small></div><span>' + esc(value.code) + '</span></div>';
    }
    byId('channel-grid').innerHTML = round.matches.map(function (match,index) {
      var home = team(match.homeId), away = team(match.awayId);
      return '<a class="channel-card" href="' + esc(arenaUrl(home.id,away.id)) + '" aria-label="Watch ' + esc(displayName(home)) + ' against ' + esc(displayName(away)) + '"><div class="channel-top"><b>ON AIR</b><span>CH ' + String(index + 1).padStart(2,'0') + '</span></div><div class="channel-match">' + participant(home) + participant(away) + '</div><div class="channel-bottom"><span>' + esc(brand(home).venue) + '</span><b>Watch ↗</b></div></a>';
    }).join('');
  }

  function renderClubGrid() {
    byId('club-grid').innerHTML = teams.map(function (item) {
      return '<button class="club-card' + (item.id === selectedTeam.id ? ' selected' : '') + '" type="button" data-team="' + esc(item.id) + '" aria-pressed="' + String(item.id === selectedTeam.id) + '" aria-label="Explore ' + esc(displayName(item)) + '">' + B.crestSvg(item) + '<div class="club-city"><p>' + esc(displayCity(item)) + '</p><h3>' + esc(clubName(item)) + '</h3><span>' + (item.id === selectedTeam.id ? 'Selected club' : esc(item.code)) + '</span></div><canvas class="aw-club-portrait" data-arcade-athlete="' + esc(item.athletes[0].id) + '" data-team-id="' + esc(item.id) + '" data-sport="' + esc(sportId) + '" aria-hidden="true"></canvas></button>';
    }).join('');
    paintArcadePortraits(byId('club-grid'));
    Array.prototype.forEach.call(byId('club-grid').querySelectorAll('[data-team]'), function (button) {
      button.addEventListener('click', function () {
        var selectedId = button.dataset.team;
        selectedTeam = team(selectedId);
        rosterFilter = sportId === 'american-football' ? 'offense' : 'all';
        updateUrl(false);
        renderClubGrid();
        renderDossier();
        byId('club-grid').querySelector('[data-team="' + selectedId + '"]').focus({preventScroll:true});
        showSelectedClub();
      });
    });
  }

  function renderKits(item) {
    var variants = [['home','Home','The club colors.'],['away','Away','The road uniform.'],['night','Night','The after-dark edition.']];
    byId('kit-grid').innerHTML = variants.map(function (variant) {
      return '<article class="kit-card">' + B.kitSvg(item,variant[0]) + '<div class="kit-caption"><h4>' + variant[1] + '</h4><span>' + variant[2] + '</span></div></article>';
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
        button.addEventListener('click', function () {
          rosterFilter = button.dataset.rosterUnit;
          renderRoster(item);
          filterBar.querySelector('[data-roster-unit="' + rosterFilter + '"]').focus({preventScroll:true});
        });
      });
    } else {
      filterBar.hidden = true;
      rosterFilter = 'all';
    }
    var athletes = rosterFilter === 'all' ? item.athletes : item.athletes.filter(function (athlete) { return athleteUnit(athlete) === rosterFilter; });
    byId('roster-count').textContent = athletes.length + ' athletes';
    byId('dossier-roster-count').textContent = item.athletes.length;
    byId('roster-grid').innerHTML = athletes.map(function (athlete) {
      var playerUrl = 'player.html?sport=' + encodeURIComponent(sportId) + '&team=' + encodeURIComponent(item.id) + '&player=' + encodeURIComponent(athlete.id);
      var character = root.CyberligaCharacters && root.CyberligaCharacters.get(athlete.id);
      var signature = character && character.motionName || athlete.signature;
      return '<a class="athlete-row" href="' + esc(playerUrl) + '" aria-label="Meet ' + esc(athlete.name) + '"><canvas class="aw-roster-portrait" data-arcade-athlete="' + esc(athlete.id) + '" data-team-id="' + esc(item.id) + '" data-sport="' + esc(sportId) + '" aria-hidden="true"></canvas><span class="athlete-number">#' + esc(athlete.number) + '</span><div class="athlete-info"><p class="athlete-role">' + esc(athlete.role) + '</p><h4>' + esc(athlete.name) + '</h4><span class="athlete-signature">' + esc(signature) + '</span></div><span class="athlete-links" aria-hidden="true">↗</span></a>';
    }).join('');
    paintArcadePortraits(byId('roster-grid'));
  }

  function renderDossier() {
    var item = selectedTeam, identity = brand(item), rival = team(item.rivalryId);
    var portrait = byId('league-pixel-lineup');
    portrait.dataset.arcadeTeam = item.id;
    portrait.dataset.sport = sportId;
    portrait.setAttribute('aria-label',displayName(item) + ' pixel athletes');
    byId('aw-hero-team').textContent = displayName(item);
    byId('aw-hero-city').textContent = displayCity(item);
    byId('arena-link').href = arenaUrl(item.id,rival.id);
    paintArcadePortraits(byId('league-hero'));
    byId('club-dossier').style.setProperty('--team',item.colors.primary);
    byId('dossier-crest').innerHTML = B.crestSvg(item);
    byId('club-location').textContent = displayCity(item) + ' / ' + item.code;
    byId('club-name').textContent = displayName(item);
    byId('club-statement').textContent = identity.statement;
    byId('venue-scene').innerHTML = B.sceneSvg(item);
    byId('venue-name').textContent = identity.venue;
    byId('venue-line').textContent = identity.venueLine;
    byId('crowd-ritual').textContent = identity.ritual;
    byId('motion-title').textContent = item.motif;
    byId('motion-line').textContent = item.motion.replace(/[.\s]+$/,'') + '.';
    byId('rival-name').textContent = displayName(rival);
    byId('rival-line').textContent = displayCity(item) + ' against ' + displayCity(rival) + '. A rivalry at the heart of ' + league.name.replace(/^the /i,'the ') + '.';
    byId('rival-club-link').href = 'league.html?sport=' + encodeURIComponent(sportId) + '&team=' + encodeURIComponent(rival.id) + '#club-dossier';
    byId('club-arena-link').href = arenaUrl(item.id,rival.id);
    renderKits(item);
    renderRoster(item);
    byId('club-profile').querySelector('details').open = false;
  }

  function selectDossierTab(value, focus) {
    dossierTab = value;
    Array.prototype.forEach.call(document.querySelectorAll('[data-dossier-tab]'), function (button) {
      var selected = button.dataset.dossierTab === value;
      button.setAttribute('aria-selected',String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected && focus) button.focus();
    });
    byId('roster-panel').hidden = value !== 'roster';
    byId('club-profile').hidden = value !== 'profile';
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-dossier-tab]'), function (button) {
    button.addEventListener('click', function () { selectDossierTab(button.dataset.dossierTab,false); });
    button.addEventListener('keydown', function (event) {
      if (['ArrowLeft','ArrowRight','Home','End'].indexOf(event.key) < 0) return;
      event.preventDefault();
      selectDossierTab(event.key === 'Home' ? 'roster' : event.key === 'End' ? 'profile' : dossierTab === 'roster' ? 'profile' : 'roster',true);
    });
  });
  byId('copy-league').addEventListener('click', function () {
    shareArcadeLink(this,{title:'Cyberliga · ' + league.name,text:'Meet ' + displayName(selectedTeam) + ' in Cyberliga.',url:root.location.href});
  });
  root.addEventListener('popstate', function () {
    var next = new URLSearchParams(root.location.search);
    if (next.get('sport') !== sportId) { root.location.reload(); return; }
    var nextTeam = C.getTeam(next.get('team'),sportId);
    if (nextTeam) {
      selectedTeam = nextTeam;
      rosterFilter = sportId === 'american-football' ? 'offense' : 'all';
      renderClubGrid();
      renderDossier();
    }
  });

  renderSportTabs();
  renderHero();
  renderChannels();
  renderClubGrid();
  renderDossier();
  updateUrl(true);

  window.render_game_to_text = function () {
    var identity = brand(selectedTeam);
    return JSON.stringify({
      screen:'league-hq',
      sport:{id:sport.id,name:sport.name,league:league.name},
      publicWorld:{sports:6,clubs:48,simultaneousGames:24,athletes:416,combatPublic:true},
      selectedClub:{id:selectedTeam.id,name:displayName(selectedTeam),city:displayCity(selectedTeam),venue:identity.venue,statement:identity.statement,rival:selectedTeam.rivalryId,colors:selectedTeam.colors},
      identity:{crest:'native-svg',uniforms:['home','away','night'],cityScene:'native-svg',venueHero:'authored-pixel-lineup',crowdRitual:identity.ritual},
      liveChannels:round.matches.map(function (match,index) { return {channel:index + 1,home:match.homeId,away:match.awayId,rivalry:match.rivalry}; }),
      roster:{filter:rosterFilter,count:selectedTeam.athletes.length,visibleCount:byId('roster-grid').children.length},
      dossierTab:dossierTab,
      standingsSource:'not-displayed',
      elapsedMs:elapsedMs
    });
  };
  window.advanceTime = function (ms) { elapsedMs += Math.max(0,Number(ms) || 0); return root.render_game_to_text(); };
  root.CyberligaLeagueHQ = Object.freeze({getState:function () { return JSON.parse(root.render_game_to_text()); }});
})(typeof window !== 'undefined' ? window : globalThis);
