(function bootstrapCyberligaAppShell(root) {
  'use strict';
  if (!root.document || root.document.getElementById('cyberliga-app-shell')) return;

  var SPORTS = [
    { id:'soccer', code:'SCL', name:'Soccer', league:'The Common Ground', href:'index.html', color:'#00e5ff' },
    { id:'american-football', code:'AMF', name:'American Football', league:'The Sunday Animal', href:'football.html', color:'#c8ff44' },
    { id:'basketball', code:'HPS', name:'Basketball', league:'The High Room', href:'hoops.html', color:'#ff8a3d' },
    { id:'hockey', code:'ICE', name:'Hockey', league:'The Cold Argument', href:'hockey.html', color:'#78dfff' },
    { id:'baseball', code:'BSB', name:'Baseball', league:'The Long Afternoon', href:'baseball.html', color:'#58ffb4' },
    { id:'combat', code:'FYT', name:'Combat', league:'The Handmade Undercard', href:'fight.html', color:'#ff3d5a' }
  ];
  var path = (root.location.pathname.split('/').pop() || 'world.html').toLowerCase();
  var params = new URLSearchParams(root.location.search);
  var requested = params.get('sport');
  var stored = null;
  try { stored = root.localStorage.getItem('cyberliga:sport'); } catch (_) {}
  var activeSport = SPORTS.find(function (sport) { return sport.id === requested; }) || SPORTS.find(function (sport) { return sport.id === stored; }) || SPORTS[0];
  try { root.localStorage.setItem('cyberliga:sport', activeSport.id); } catch (_) {}

  var NAV = [
    { id:'home', label:'HOME', href:'world.html', paths:['world.html'] },
    { id:'watch', label:'WATCH', href:'menu.html', paths:['menu.html'] },
    { id:'leagues', label:'LEAGUES', href:'league.html', paths:['league.html','player.html','characterlab.html'] },
    { id:'community', label:'COMMUNITY', href:'social.html', paths:['social.html','moment.html','clip.html','ops.html'] },
    { id:'replays', label:'REPLAYS', href:'replay.html', paths:['replay.html'] }
  ];
  var current = NAV.find(function (item) { return item.paths.indexOf(path) !== -1; }) || NAV[0];

  function contextual(href) {
    return href + (href.indexOf('?') === -1 ? '?' : '&') + 'sport=' + encodeURIComponent(activeSport.id);
  }
  function navLink(item) {
    var href = item.id === 'home' || item.id === 'watch' ? item.href : contextual(item.href);
    return '<a href="' + href + '"' + (item.id === current.id ? ' aria-current="page"' : '') + '>' + item.label + '</a>';
  }
  function sportLink(sport) {
    return '<a class="cas-sport" href="' + sport.href + '" style="--sport:' + sport.color + '" data-sport="' + sport.id + '">' +
      '<em>' + sport.code + '</em><b>' + sport.name.toUpperCase() + '</b><small>' + sport.league.toUpperCase() + '</small><span>ENTER LIVE ARENA →</span></a>';
  }

  var shell = root.document.createElement('div');
  shell.id = 'cyberliga-app-shell';
  shell.innerHTML = '<a class="cas-brand" href="world.html" aria-label="Cyberliga home">CYBERLIGA <span>ONE WORLD · SIX LEAGUES</span></a>' +
    '<nav class="cas-primary" aria-label="Cyberliga primary navigation">' + NAV.map(navLink).join('') + '</nav>' +
    '<div class="cas-context"><a class="cas-continue" href="' + activeSport.href + '">LIVE ' + activeSport.name.toUpperCase() + '</a><button class="cas-arena-toggle" type="button" aria-controls="cas-drawer" aria-expanded="false">CHOOSE ARENA</button></div>';

  var backdrop = root.document.createElement('button');
  backdrop.className = 'cas-backdrop';
  backdrop.type = 'button';
  backdrop.tabIndex = -1;
  backdrop.setAttribute('aria-label','Close arena switcher');

  var drawer = root.document.createElement('aside');
  drawer.className = 'cas-drawer';
  drawer.id = 'cas-drawer';
  drawer.setAttribute('role','dialog');
  drawer.setAttribute('aria-modal','true');
  drawer.setAttribute('aria-hidden','true');
  drawer.setAttribute('aria-labelledby','cas-drawer-title');
  drawer.innerHTML = '<div class="cas-drawer-head"><div><small>LIVE SPORTS NETWORK</small><h2 id="cas-drawer-title">Choose your arena.</h2></div><button class="cas-close" type="button" aria-label="Close arena switcher">×</button></div>' +
    '<span class="cas-drawer-label">SIX LEAGUES · ALWAYS PLAYING</span><nav class="cas-sports" aria-label="Sport arenas">' + SPORTS.map(sportLink).join('') + '</nav>' +
    '<span class="cas-drawer-label">EXPLORE THE WORLD</span><nav class="cas-more" aria-label="Cyberliga destinations"><a href="' + contextual('league.html') + '">TEAMS & LEAGUES</a><a href="' + contextual('player.html') + '">ATHLETE FILES</a><a href="' + contextual('replay.html') + '">REPLAY CENTER</a><a href="' + contextual('social.html') + '">COMMUNITY</a><a href="' + contextual('moment.html') + '">MAKE A POSTER</a><a href="' + contextual('clip.html') + '">CREATE A CLIP</a></nav>';

  var open = false;
  var lastFocus = null;
  function setOpen(next) {
    open = Boolean(next);
    root.document.body.classList.toggle('cas-open',open);
    shell.querySelector('.cas-arena-toggle').setAttribute('aria-expanded',String(open));
    drawer.setAttribute('aria-hidden',String(!open));
    if (open) {
      lastFocus = root.document.activeElement;
      drawer.querySelector('.cas-close').focus();
    } else if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  root.document.body.classList.add('cyberliga-shell-enabled');
  root.document.body.prepend(shell);
  root.document.body.appendChild(backdrop);
  root.document.body.appendChild(drawer);
  shell.querySelector('.cas-arena-toggle').addEventListener('click',function () { setOpen(!open); });
  drawer.querySelector('.cas-close').addEventListener('click',function () { setOpen(false); });
  backdrop.addEventListener('click',function () { setOpen(false); });
  drawer.querySelectorAll('[data-sport]').forEach(function (link) {
    link.addEventListener('click',function () {
      try { root.localStorage.setItem('cyberliga:sport',link.dataset.sport); } catch (_) {}
    });
  });
  root.addEventListener('keydown',function (event) {
    if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); }
    if (event.key === 'Tab' && open) {
      var focusable = Array.from(drawer.querySelectorAll('a[href],button:not([disabled])'));
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && root.document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && root.document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  },true);
  root.CyberligaAppShell = Object.freeze({ open:function(){setOpen(true);}, close:function(){setOpen(false);}, getState:function(){return { open:open, route:current.id, sport:activeSport.id };} });
})(typeof window !== 'undefined' ? window : globalThis);
