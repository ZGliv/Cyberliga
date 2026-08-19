import * as THREE from 'three';

const CONTENT = window.CYBERLIGA_CONTENT;
const BRAND = window.CyberligaBrand;
const UNIVERSE = window.CyberligaUniverse;

if (!CONTENT || !BRAND || !UNIVERSE) throw new Error('Cyberliga world data is unavailable');

const LEAGUES = Object.freeze([
  { id: 'soccer', code: 'SCL', name: 'Soccer', league: 'The Common Ground', color: '#f34e45', arena: 'index.html', query: 'match', canonical: true },
  { id: 'american-football', code: 'AMF', name: 'Football', league: 'The Sunday Animal', color: '#d7f76b', arena: 'football.html', query: 'fixture' },
  { id: 'basketball', code: 'HPS', name: 'Basketball', league: 'The High Room', color: '#ff8a55', arena: 'hoops.html', query: 'match' },
  { id: 'hockey', code: 'ICE', name: 'Hockey', league: 'The Cold Argument', color: '#78dfff', arena: 'hockey.html', query: 'match' },
  { id: 'baseball', code: 'BSB', name: 'Baseball', league: 'The Long Afternoon', color: '#58dba2', arena: 'baseball.html', query: 'match' },
  { id: 'combat', code: 'FYT', name: 'Combat', league: 'The Handmade Undercard', color: '#e66b7b', arena: 'fight.html', query: 'match' }
]);

const SPORT_ICONS = Object.freeze({
  all: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.5 12h17M12 3.5c2.8 2.4 4.2 5.2 4.2 8.5S14.8 18.1 12 20.5C9.2 18.1 7.8 15.3 7.8 12S9.2 5.9 12 3.5Z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`,
  soccer: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m12 7.5 3 2.2-1.2 3.5h-3.6L9 9.7l3-2.2Zm-3 2.2-3.2-1m9.2 1 3.2-1m-8 4.5-2.5 3.7m6.1-3.7 2.5 3.7" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`,
  'american-football': `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.2 15.6C6 8.8 11.7 5 19.7 7.2 17.9 14 12.2 17.8 4.2 15.6Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m8.2 13.8 7.6-5m-5.6 2.5 3.2 2.3m-1.2-4 3.2 2.3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  basketball: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 3.5v17M3.5 12h17M5.5 6.5c5 1.5 10.5 7 13 12M18.5 5.5c-6 2.5-11.5 8-13 13" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`,
  hockey: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h3l2 12c.5 2.5 2.5 3.5 5.5 3.5H20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><ellipse cx="6" cy="19" rx="3.5" ry="1.7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`,
  baseball: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7 5c2 3 2 11 0 14m10-14c-2 3-2 11 0 14M6.5 8l2.5 1m-3 3 3 .5m8.5-4.5L15 9m3 3-3 .5" fill="none" stroke="currentColor" stroke-width="1.05" stroke-linecap="round"/></svg>`,
  combat: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 14.5c.5-2.5 2-4.5 4-5.5l2 1 1.5-2.5 2.5 1.5-1 3.5 2.5 2-3 5.5h-6l-2.5-5.5Zm17 0c-.5-2.5-2-4.5-4-5.5l-2 1-1.5-2.5-2.5 1.5 1 3.5-2.5 2 3 5.5h6l2.5-5.5Z" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/></svg>`
});

const CITY_COORDS = Object.freeze({
  'Tokyo': [35.6762, 139.6503], 'Osaka': [34.6937, 135.5023], 'Berlin': [52.52, 13.405], 'London': [51.5074, -.1278],
  'Sao Paulo': [-23.5505, -46.6333], 'Valparaiso': [-33.0472, -71.6127], 'Lagos': [6.5244, 3.3792], 'Marrakech': [31.6295, -7.9811],
  'New Orleans': [29.9511, -90.0715], 'Atlanta': [33.749, -84.388], 'Chicago': [41.8781, -87.6298], 'Minneapolis': [44.9778, -93.265],
  'Dallas': [32.7767, -96.797], 'Oakland': [37.8044, -122.2712], 'Seattle': [47.6062, -122.3321], 'Honolulu': [21.3099, -157.8581],
  'New York': [40.7128, -74.006], 'Toronto': [43.6532, -79.3832], 'Manila': [14.5995, 120.9842], 'Melbourne': [-37.8136, 144.9631],
  'Dakar': [14.7167, -17.4677], 'Medellin': [6.2442, -75.5812], 'Belgrade': [44.7866, 20.4489], 'Istanbul': [41.0082, 28.9784],
  'Montreal': [45.5019, -73.5674], 'Reykjavik': [64.1466, -21.9426], 'Stockholm': [59.3293, 18.0686], 'Helsinki': [60.1699, 24.9384],
  'Sapporo': [43.0618, 141.3545], 'Anchorage': [61.2181, -149.9003], 'Prague': [50.0755, 14.4378], 'Tromso': [69.6492, 18.9553],
  'Mexico City': [19.4326, -99.1332], 'Havana': [23.1136, -82.3666], 'Seoul': [37.5665, 126.978], 'Kyoto': [35.0116, 135.7681],
  'Santo Domingo': [18.4861, -69.9312], 'San Juan': [18.4655, -66.1057], 'Cape Town': [-33.9249, 18.4241], 'Auckland': [-36.8509, 174.7645],
  'Accra': [5.6037, -.187], 'Bangkok': [13.7563, 100.5018], 'Tbilisi': [41.7151, 44.8271], 'Las Vegas': [36.1716, -115.1391],
  'Tunis': [36.8065, 10.1815], 'Cebu': [10.3157, 123.8854], 'Lima': [-12.0464, -77.0428], 'Liverpool': [53.4084, -2.9916]
});

const els = {
  body: document.body,
  loading: document.getElementById('loading'),
  date: document.getElementById('tonight-date'),
  filters: document.getElementById('filter-tabs'),
  gameList: document.getElementById('game-list'),
  featured: document.getElementById('featured-slot'),
  worldStage: document.getElementById('world-stage'),
  worldCard: document.getElementById('world-match-card'),
  worldSelection: document.getElementById('world-selection'),
  canvas: document.getElementById('globe'),
  labels: document.getElementById('globe-labels'),
  liveTab: document.getElementById('surface-live'),
  worldTab: document.getElementById('surface-world')
};

let soccerMatches = UNIVERSE.liveMatches(Date.now());
let fixtures = buildFixtures();
let activeFilter = validSport(new URLSearchParams(location.search).get('sport'));
let selectedCard = fixtures.find((card) => card.league.id === 'soccer') || fixtures[0];
let previewCard = null;
let activeSurface = innerWidth <= 900 ? 'live' : 'combined';
let globe = null;
let lastSoccerSlot = soccerMatches[0]?.slot;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function displayName(value) {
  return String(value || '').toLocaleLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_match, lead, letter) => lead + letter.toLocaleUpperCase());
}

function validSport(value) {
  return value === 'all' || LEAGUES.some((league) => league.id === value) ? (value || 'all') : 'all';
}

function teamIdentity(team, league) {
  return CONTENT.getTeam(team?.id, league.id) || team;
}

function crestMarkup(team, league) {
  const identity = teamIdentity(team, league);
  if (identity && typeof BRAND.crestSvg === 'function') return `<span class="club-crest" aria-hidden="true">${BRAND.crestSvg(identity)}</span>`;
  return `<span class="club-crest" aria-hidden="true"><span class="club-crest-fallback">${escapeHtml(identity?.code || 'CLB')}</span></span>`;
}

function buildFixtures() {
  const cards = [];
  for (const league of LEAGUES) {
    const teams = CONTENT.getTeams(league.id);
    if (league.id === 'soccer') {
      soccerMatches.forEach((match, index) => cards.push({
        id: match.id, league, index, home: match.home, away: match.away, liveMatch: match,
        href: UNIVERSE.sharePath(match)
      }));
      continue;
    }
    if (league.id === 'american-football') {
      for (let index = 0; index < 4; index += 1) {
        cards.push({ id: `${league.id}-${index}`, league, index, home: teams[index * 2], away: teams[index * 2 + 1], href: `${league.arena}?${league.query}=${index}` });
      }
      continue;
    }
    const round = CONTENT.createSeason(league.id, 'arena').rounds[0];
    round.matches.forEach((match, index) => cards.push({
      id: `${league.id}-${index}`, league, index,
      home: teams.find((team) => team.id === match.homeId),
      away: teams.find((team) => team.id === match.awayId),
      href: `${league.arena}?${league.query}=${index}`
    }));
  }
  return cards;
}

function fixtureStatus(card) {
  return card.league.canonical ? `Live · ${UNIVERSE.clock(card.liveMatch.elapsedMs)}` : 'Available now';
}

function cardStory(card) {
  const home = teamIdentity(card.home, card.league);
  const away = teamIdentity(card.away, card.league);
  const homeBrand = BRAND.getTeam?.(home.id);
  const rivalry = home.rivalryId === away.id || away.rivalryId === home.id;
  if (rivalry) return `${home.city} and ${away.city} renew a city rivalry.`;
  if (homeBrand?.venue) return `${displayName(homeBrand.venue)} · ${displayName(home.city)}.`;
  return `${displayName(card.league.league)} · ${displayName(home.city)}.`;
}

function visibleFixtures() {
  return activeFilter === 'all' ? fixtures : fixtures.filter((card) => card.league.id === activeFilter);
}

function leadForFilter() {
  const visible = visibleFixtures();
  if (activeFilter === 'all') return visible.find((card) => card.league.id === 'soccer') || visible[0];
  return visible[0];
}

function featuredMarkup(card) {
  const home = teamIdentity(card.home, card.league);
  const away = teamIdentity(card.away, card.league);
  const live = card.league.canonical;
  return `<article class="featured-card" style="--home-color:${escapeHtml(home.colors?.primary || card.league.color)};--status-color:${live ? '#f34e45' : '#a7adb5'}">
    <div class="featured-top">
      <span class="featured-kicker"><i></i><span${card.league.canonical ? ` data-live-clock="${card.index}" data-live-mode="full"` : ''}>${escapeHtml(fixtureStatus(card))}</span></span>
      <span class="featured-league">${escapeHtml(card.league.name)} · ${escapeHtml(displayName(card.league.league))}</span>
    </div>
    <div class="featured-matchup">
      <div class="featured-team">${crestMarkup(card.home, card.league)}<strong>${escapeHtml(displayName(home.name))}</strong><span>${escapeHtml(displayName(home.city))}</span></div>
      <span class="featured-versus">vs</span>
      <div class="featured-team">${crestMarkup(card.away, card.league)}<strong>${escapeHtml(displayName(away.name))}</strong><span>${escapeHtml(displayName(away.city))}</span></div>
    </div>
    <p class="featured-story">${escapeHtml(cardStory(card))}</p>
    <div class="featured-actions">
      <a class="watch-action" href="${escapeHtml(card.href)}"${card.league.canonical ? ` data-live-watch="${card.index}"` : ''} aria-label="Watch ${escapeHtml(home.name)} versus ${escapeHtml(away.name)}"><span>Watch</span><span aria-hidden="true">↗</span></a>
      <button class="locate-action" type="button" data-locate="${escapeHtml(card.id)}">Locate</button>
    </div>
  </article>`;
}

function worldCardMarkup(card) {
  const home = teamIdentity(card.home, card.league);
  const away = teamIdentity(card.away, card.league);
  return `<div class="world-card-top"><span>${escapeHtml(card.league.name)}</span><span${card.league.canonical ? ` data-live-clock="${card.index}" data-live-mode="full"` : ''}>${escapeHtml(fixtureStatus(card))}</span></div>
    <div class="world-card-matchup"><strong>${escapeHtml(displayName(home.name))}</strong><span>vs</span><strong>${escapeHtml(displayName(away.name))}</strong></div>
    <a class="watch-action" href="${escapeHtml(card.href)}"${card.league.canonical ? ` data-live-watch="${card.index}"` : ''} aria-label="Watch ${escapeHtml(home.name)} versus ${escapeHtml(away.name)}"><span>Watch</span><span aria-hidden="true">↗</span></a>`;
}

function fixtureMarkup(card) {
  const home = teamIdentity(card.home, card.league);
  const away = teamIdentity(card.away, card.league);
  return `<article class="fixture-row${card === selectedCard ? ' is-selected' : ''}" data-fixture="${escapeHtml(card.id)}">
    <button class="fixture-select" type="button" data-select="${escapeHtml(card.id)}" aria-pressed="${String(card === selectedCard)}" aria-label="Locate ${escapeHtml(home.name)} versus ${escapeHtml(away.name)}">
      <span class="fixture-club">${crestMarkup(card.home, card.league)}<span class="fixture-club-copy"><strong class="fixture-team-name">${escapeHtml(displayName(home.name))}</strong><span class="fixture-city">${escapeHtml(displayName(home.city))}</span></span></span>
      <span class="fixture-status"${card.league.canonical ? ` data-live-clock="${card.index}" data-live-mode="clock"` : ''}>${escapeHtml(card.league.canonical ? UNIVERSE.clock(card.liveMatch.elapsedMs) : 'Now')}</span>
      <span class="fixture-club">${crestMarkup(card.away, card.league)}<span class="fixture-club-copy"><strong class="fixture-team-name">${escapeHtml(displayName(away.name))}</strong><span class="fixture-city">${escapeHtml(displayName(away.city))}</span></span></span>
    </button>
    <a class="fixture-watch" href="${escapeHtml(card.href)}"${card.league.canonical ? ` data-live-watch="${card.index}"` : ''} aria-label="Watch ${escapeHtml(home.name)} versus ${escapeHtml(away.name)}"><span aria-hidden="true">›</span></a>
  </article>`;
}

function renderFilters() {
  const filters = [{ id: 'all', name: 'All' }, ...LEAGUES];
  els.filters.innerHTML = filters.map((filter) => `<button class="filter-tab" type="button" data-filter="${escapeHtml(filter.id)}" aria-pressed="${String(filter.id === activeFilter)}">
    <span class="sport-icon">${SPORT_ICONS[filter.id]}</span><span class="sport-label">${escapeHtml(filter.name)}</span>
  </button>`).join('');
}

function renderSchedule({ preserveScroll = false } = {}) {
  const scrollTop = preserveScroll ? document.getElementById('game-drawer').scrollTop : 0;
  const lead = leadForFilter();
  if (!visibleFixtures().includes(selectedCard)) selectedCard = lead;
  els.featured.innerHTML = featuredMarkup(lead);
  const groups = LEAGUES.map((league) => ({ league, cards: visibleFixtures().filter((card) => card.league === league) })).filter((group) => group.cards.length);
  els.gameList.innerHTML = groups.map(({ league, cards }) => `<section class="league-group" data-sport="${escapeHtml(league.id)}">
    <header class="league-group-head"><strong>${escapeHtml(league.name)} · ${escapeHtml(displayName(league.league))}</strong><span>${league.canonical ? 'Live' : 'Channel open'}</span></header>
    ${cards.map(fixtureMarkup).join('')}
  </section>`).join('');
  els.worldCard.innerHTML = worldCardMarkup(selectedCard);
  updateWorldCopy(selectedCard);
  if (preserveScroll) document.getElementById('game-drawer').scrollTop = scrollTop;
}

function updateWorldCopy(card) {
  els.worldSelection.textContent = `${displayName(card.home.city)} to ${displayName(card.away.city)} · ${displayName(card.league.league)}`;
}

function setFilter(next, { push = true } = {}) {
  activeFilter = validSport(next);
  selectedCard = leadForFilter();
  previewCard = null;
  renderFilters();
  renderSchedule();
  globe?.focus(selectedCard, { moveCamera: false });
  if (push) {
    const url = new URL(location.href);
    if (activeFilter === 'all') url.searchParams.delete('sport');
    else url.searchParams.set('sport', activeFilter);
    history.pushState({ sport: activeFilter }, '', url);
  }
}

function cardById(id) {
  return fixtures.find((card) => card.id === id) || null;
}

function selectCard(card, { moveCamera = true, showWorld = false } = {}) {
  if (!card) return;
  selectedCard = card;
  previewCard = null;
  renderSchedule({ preserveScroll: true });
  globe?.focus(card, { moveCamera });
  if (showWorld && innerWidth <= 900) setSurface('world');
}

function preview(card) {
  previewCard = card;
  if (globe) globe.focus(card || selectedCard, { moveCamera: false });
}

function setSurface(surface) {
  const mobile = innerWidth <= 900;
  activeSurface = mobile ? (surface === 'world' ? 'world' : 'live') : 'combined';
  els.body.dataset.surface = activeSurface === 'world' ? 'world' : 'live';
  els.liveTab.classList.toggle('active', activeSurface !== 'world');
  els.worldTab.classList.toggle('active', activeSurface === 'world');
  els.liveTab.setAttribute('aria-pressed', String(activeSurface !== 'world'));
  els.worldTab.setAttribute('aria-pressed', String(activeSurface === 'world'));
  if (activeSurface === 'world' || !mobile) ensureGlobe().then(() => globe?.focus(selectedCard, { moveCamera: activeSurface === 'world' }));
}

els.filters.addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (button) setFilter(button.dataset.filter);
});

els.gameList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-select]');
  if (button) selectCard(cardById(button.dataset.select), { moveCamera: true });
});

els.gameList.addEventListener('pointerover', (event) => {
  const row = event.target.closest('[data-fixture]');
  if (row && !row.contains(event.relatedTarget)) preview(cardById(row.dataset.fixture));
});

els.gameList.addEventListener('pointerout', (event) => {
  const row = event.target.closest('[data-fixture]');
  if (row && !row.contains(event.relatedTarget)) preview(null);
});

els.gameList.addEventListener('focusin', (event) => {
  const row = event.target.closest('[data-fixture]');
  if (row) preview(cardById(row.dataset.fixture));
});

els.gameList.addEventListener('focusout', (event) => {
  const row = event.target.closest('[data-fixture]');
  if (row && !row.contains(event.relatedTarget)) preview(null);
});

els.featured.addEventListener('click', (event) => {
  const locate = event.target.closest('[data-locate]');
  if (locate) selectCard(cardById(locate.dataset.locate), { moveCamera: true, showWorld: true });
});

document.querySelector('.surface-tabs').addEventListener('click', (event) => {
  const button = event.target.closest('[data-surface-target]');
  if (button) setSurface(button.dataset.surfaceTarget);
});

addEventListener('popstate', () => setFilter(new URLSearchParams(location.search).get('sport') || 'all', { push: false }));
addEventListener('resize', () => {
  setSurface(innerWidth <= 900 ? (els.body.dataset.surface === 'world' ? 'world' : 'live') : 'combined');
  globe?.resize();
});

function pointForCity(city, radius = 2.42) {
  const [lat, lon] = CITY_COORDS[city] || [0, 0];
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
}

function makeRoute(start, end) {
  const angle = start.angleTo(end);
  const lift = .22 + angle * .42;
  const midpoint = start.clone().add(end).normalize().multiplyScalar(2.42 + lift);
  const curve = new THREE.QuadraticBezierCurve3(start, midpoint, end);
  return new THREE.TubeGeometry(curve, 56, .012, 7, false);
}

async function createGlobe() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070a);
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 100);
  camera.position.set(0, 0, 7.8);
  const renderer = new THREE.WebGLRenderer({ canvas: els.canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x05070a, 1);

  scene.add(new THREE.HemisphereLight(0xaab6c9, 0x010204, 1.3));
  const key = new THREE.DirectionalLight(0xffffff, 2.55);
  key.position.set(-4, 3, 6);
  scene.add(key);

  const planet = new THREE.Group();
  planet.rotation.set(.08, -.82, 0);
  scene.add(planet);

  const earthMaterial = new THREE.MeshPhongMaterial({ color: 0x21303d, specular: 0x263746, shininess: 11 });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(2.42, 96, 64), earthMaterial);
  planet.add(earth);
  let clouds = null;
  const loader = new THREE.TextureLoader();
  Promise.allSettled([
    loader.loadAsync('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg'),
    loader.loadAsync('https://threejs.org/examples/textures/planets/earth_specular_2048.jpg'),
    loader.loadAsync('https://threejs.org/examples/textures/planets/earth_normal_2048.jpg'),
    loader.loadAsync('https://threejs.org/examples/textures/planets/earth_clouds_1024.png')
  ]).then((results) => {
    if (results.slice(0, 3).every((result) => result.status === 'fulfilled')) {
      const [map, specularMap, normalMap] = results.map((result) => result.value);
      map.colorSpace = THREE.SRGBColorSpace;
      earth.material = new THREE.MeshPhongMaterial({ map, specularMap, normalMap, normalScale: new THREE.Vector2(.4, .4), specular: 0x344654, shininess: 13 });
    }
    if (results[3].status === 'fulfilled') {
      clouds = new THREE.Mesh(new THREE.SphereGeometry(2.44, 96, 64), new THREE.MeshPhongMaterial({ map: results[3].value, transparent: true, opacity: .12, depthWrite: false }));
      planet.add(clouds);
    }
    renderNow();
  });

  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(2.49, 96, 64), new THREE.MeshBasicMaterial({ color: 0x9cc7dc, transparent: true, opacity: .055, side: THREE.BackSide }));
  planet.add(atmosphere);

  const dots = new THREE.Group();
  const seenCities = new Set();
  fixtures.forEach((card) => [card.home, card.away].forEach((team) => {
    if (seenCities.has(team.city)) return;
    seenCities.add(team.city);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 8), new THREE.MeshBasicMaterial({ color: 0xb9c1c7, transparent: true, opacity: .23 }));
    dot.position.copy(pointForCity(team.city, 2.435));
    dots.add(dot);
  }));
  planet.add(dots);

  const focusGroup = new THREE.Group();
  planet.add(focusGroup);
  let route = null;
  let endpoints = [];
  let focusCard = selectedCard;
  let targetRotation = null;
  let targetDistance = null;

  const labelNodes = [0, 1].map(() => {
    const node = document.createElement('span');
    node.className = 'globe-label';
    node.innerHTML = '<i></i><b></b>';
    els.labels.appendChild(node);
    return node;
  });

  function rebuildFocus(card) {
    focusCard = card;
    if (route) {
      focusGroup.remove(route);
      route.geometry.dispose();
      route.material.dispose();
    }
    endpoints.forEach((endpoint) => {
      focusGroup.remove(endpoint);
      endpoint.geometry.dispose();
      endpoint.material.dispose();
    });
    endpoints = [];
    const start = pointForCity(card.home.city, 2.445);
    const end = pointForCity(card.away.city, 2.445);
    route = new THREE.Mesh(makeRoute(start, end), new THREE.MeshBasicMaterial({ color: 0xf3f1eb, transparent: true, opacity: .48, depthWrite: false }));
    focusGroup.add(route);
    [card.home, card.away].forEach((team, index) => {
      const identity = teamIdentity(team, card.league);
      const marker = new THREE.Mesh(new THREE.RingGeometry(.065, .105, 28), new THREE.MeshBasicMaterial({ color: identity.colors?.primary || card.league.color, side: THREE.DoubleSide, transparent: true, opacity: .95, depthWrite: false }));
      marker.position.copy(index ? end : start);
      marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), marker.position.clone().normalize());
      focusGroup.add(marker);
      endpoints.push(marker);
      labelNodes[index].style.setProperty('--team', identity.colors?.primary || card.league.color);
      labelNodes[index].querySelector('b').textContent = `${displayName(team.city)} · ${displayName(identity.name)}`;
    });
    updateWorldCopy(card);
    els.worldCard.innerHTML = worldCardMarkup(card);
  }

  function flyTo(card) {
    const home = pointForCity(card.home.city).normalize();
    const away = pointForCity(card.away.city).normalize();
    const separation = home.angleTo(away);
    const target = separation > 1.05 ? home : home.clone().add(away).normalize();
    const latitude = Math.asin(THREE.MathUtils.clamp(target.y, -1, 1));
    targetRotation = new THREE.Vector2(latitude, Math.atan2(-target.x, target.z));
    targetDistance = THREE.MathUtils.clamp(7.6 + separation * .65, 7.6, 9.3);
  }

  function focus(card, { moveCamera = false } = {}) {
    rebuildFocus(card);
    if (moveCamera) flyTo(card);
    renderNow();
  }

  function updateLabels() {
    const width = els.worldStage.clientWidth;
    const height = els.worldStage.clientHeight;
    const viewDirection = camera.position.clone().normalize();
    endpoints.forEach((endpoint, index) => {
      const world = endpoint.getWorldPosition(new THREE.Vector3());
      const front = world.clone().normalize().dot(viewDirection) > .08;
      const projected = world.clone().project(camera);
      const x = (projected.x * .5 + .5) * width;
      const y = (-projected.y * .5 + .5) * height;
      const safe = x > 78 && x < width - 78 && y > 92 && y < height - (innerWidth <= 900 ? 180 : 70);
      labelNodes[index].classList.toggle('visible', front && safe);
      if (front && safe) {
        labelNodes[index].style.left = `${x}px`;
        labelNodes[index].style.top = `${y}px`;
      }
    });
  }

  function renderNow() {
    updateLabels();
    renderer.render(scene, camera);
  }

  function resize() {
    const width = Math.max(1, els.worldStage.clientWidth);
    const height = Math.max(1, els.worldStage.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth <= 900 ? 1.35 : 1.75));
    renderer.setSize(width, height, false);
    camera.position.z = innerWidth <= 900 ? Math.max(camera.position.z, 8.6) : camera.position.z;
    renderNow();
  }

  let down = null;
  els.canvas.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    down = { id: event.pointerId, x: event.clientX, y: event.clientY, rx: planet.rotation.x, ry: planet.rotation.y };
    targetRotation = null;
    els.canvas.setPointerCapture(event.pointerId);
    els.canvas.classList.add('dragging');
  });
  els.canvas.addEventListener('pointermove', (event) => {
    if (!down || down.id !== event.pointerId) return;
    planet.rotation.y = down.ry + (event.clientX - down.x) * .006;
    planet.rotation.x = THREE.MathUtils.clamp(down.rx + (event.clientY - down.y) * .005, -1.12, 1.12);
    renderNow();
  });
  function release(event) {
    if (!down || (event && down.id !== event.pointerId)) return;
    down = null;
    els.canvas.classList.remove('dragging');
  }
  els.canvas.addEventListener('pointerup', release);
  els.canvas.addEventListener('pointercancel', release);
  els.canvas.addEventListener('lostpointercapture', release);
  els.canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    targetDistance = null;
    camera.position.z = THREE.MathUtils.clamp(camera.position.z + event.deltaY * .004, 6.7, 10.2);
    renderNow();
  }, { passive: false });

  let last = performance.now();
  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - last) / 1000, .05);
    last = now;
    let changed = false;
    if (targetRotation) {
      planet.rotation.x = THREE.MathUtils.lerp(planet.rotation.x, targetRotation.x, 1 - Math.exp(-3.6 * dt));
      const delta = Math.atan2(Math.sin(targetRotation.y - planet.rotation.y), Math.cos(targetRotation.y - planet.rotation.y));
      planet.rotation.y += delta * (1 - Math.exp(-3.6 * dt));
      changed = true;
      if (Math.abs(delta) < .002 && Math.abs(planet.rotation.x - targetRotation.x) < .002) targetRotation = null;
    }
    if (targetDistance !== null) {
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetDistance, 1 - Math.exp(-3.6 * dt));
      changed = true;
      if (Math.abs(camera.position.z - targetDistance) < .003) targetDistance = null;
    }
    if (changed) renderNow();
  }

  resize();
  rebuildFocus(focusCard);
  requestAnimationFrame(animate);
  return {
    focus,
    resize,
    advance(ms) {
      if (clouds) clouds.rotation.y += ms * .0000015;
      renderNow();
    },
    state() {
      return {
        initialized: true,
        rotationX: Number(planet.rotation.x.toFixed(4)),
        rotationY: Number(planet.rotation.y.toFixed(4)),
        cameraDistance: Number(camera.position.z.toFixed(3)),
        flyToActive: Boolean(targetRotation),
        selectedRouteCount: route ? 1 : 0,
        selectedEndpointCount: endpoints.length,
        visibleLabels: labelNodes.filter((node) => node.classList.contains('visible')).length,
        focusFixture: focusCard.id
      };
    }
  };
}

let globePromise = null;
function ensureGlobe() {
  if (globe) return Promise.resolve(globe);
  if (!globePromise) globePromise = createGlobe().then((instance) => { globe = instance; return globe; });
  return globePromise;
}

function tickNetwork() {
  const nextMatches = UNIVERSE.liveMatches(Date.now());
  const slotChanged = nextMatches[0]?.slot !== lastSoccerSlot;
  soccerMatches = nextMatches;
  if (slotChanged) {
    lastSoccerSlot = nextMatches[0]?.slot;
    const selectedIndex = selectedCard?.league.id === 'soccer' ? selectedCard.index : -1;
    fixtures = buildFixtures();
    if (selectedIndex >= 0) selectedCard = fixtures.find((card) => card.league.id === 'soccer' && card.index === selectedIndex) || selectedCard;
  } else {
    fixtures.filter((card) => card.league.id === 'soccer').forEach((card, index) => { card.liveMatch = nextMatches[index]; card.id = nextMatches[index].id; card.href = UNIVERSE.sharePath(nextMatches[index]); });
  }
  if (slotChanged) {
    renderSchedule({ preserveScroll: true });
    globe?.focus(selectedCard, { moveCamera: false });
    return;
  }
  document.querySelectorAll('[data-live-clock]').forEach((node) => {
    const card = fixtures.find((fixture) => fixture.league.id === 'soccer' && fixture.index === Number(node.dataset.liveClock));
    if (card) node.textContent = node.dataset.liveMode === 'full' ? fixtureStatus(card) : UNIVERSE.clock(card.liveMatch.elapsedMs);
  });
  document.querySelectorAll('[data-live-watch]').forEach((node) => {
    const card = fixtures.find((fixture) => fixture.league.id === 'soccer' && fixture.index === Number(node.dataset.liveWatch));
    if (card) node.href = card.href;
  });
}

els.date.textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
renderFilters();
renderSchedule();
setSurface(activeSurface);
setTimeout(() => els.loading.classList.add('done'), 240);
setInterval(tickNetwork, 1000);

window.render_game_to_text = () => JSON.stringify({
  screen: 'world',
  edition: 'premium-home-kill-gate',
  activeSurface,
  activeSport: activeFilter,
  selectedFixture: selectedCard ? { id: selectedCard.id, sport: selectedCard.league.id, home: selectedCard.home.name, away: selectedCard.away.name, href: selectedCard.href } : null,
  visibleFixtureCount: visibleFixtures().length,
  totalFixtureCount: fixtures.length,
  filters: ['all', ...LEAGUES.map((league) => league.id)],
  selectedGlobeEndpoints: selectedCard ? [selectedCard.home.city, selectedCard.away.city] : [],
  preview: previewCard ? { open: false, selected: false, fixture: previewCard.id } : { open: false, selected: true, fixture: selectedCard?.id || null },
  globe: globe ? globe.state() : { initialized: false, selectedRouteCount: 0, selectedEndpointCount: 0 },
  coordinateSystem: 'Home document flow; globe uses latitude/longitude with screen origin top-left; mobile opens on the Live surface'
});

window.advanceTime = (ms) => {
  globe?.advance(Math.max(0, Number(ms) || 0));
  return window.render_game_to_text();
};
