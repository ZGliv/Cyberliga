(function bootstrapCyberligaGameHub(root) {
  'use strict';

  if (!root.document || root.document.getElementById('cyberliga-game-hub')) return;

  var ROUTES = [
    { id: 'soccer', code: 'SCL', name: 'SOCCER', league: 'THE COMMON GROUND', href: 'index.html' },
    { id: 'american-football', code: 'AMF', name: 'AMERICAN FOOTBALL', league: 'THE SUNDAY ANIMAL', href: 'football.html' },
    { id: 'basketball', code: 'HPS', name: 'BASKETBALL', league: 'THE HIGH ROOM', href: 'hoops.html' },
    { id: 'hockey', code: 'ICE', name: 'HOCKEY', league: 'THE COLD ARGUMENT', href: 'hockey.html' },
    { id: 'baseball', code: 'BSB', name: 'BASEBALL', league: 'THE LONG AFTERNOON', href: 'baseball.html' },
    { id: 'combat', code: 'FYT', name: 'COMBAT', league: 'THE HANDMADE UNDERCARD', href: 'fight.html' }
  ];
  var path = (root.location && root.location.pathname || '').split('/').pop() || 'index.html';
  var current = ROUTES.find(function (route) { return route.href === path; }) || ROUTES[0];
  var open = false;
  var previousFocus = null;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function routeLink(route) {
    return '<a class="cgh-sport' + (route.id === current.id ? ' active' : '') + '" href="' + route.href + '">' +
      '<span>' + route.code + '</span><b>' + route.name + '</b><small>' + route.league + '</small></a>';
  }

  var style = root.document.createElement('style');
  style.id = 'cyberliga-game-hub-style';
  style.textContent = [
    '#cyberliga-game-hub{--cgh-acid:#c8ff44;--cgh-ink:#070a09;--cgh-paper:#f3f0e7;position:fixed;inset:0;z-index:2147483000;pointer-events:none;font-family:Arial,Helvetica,sans-serif;color:var(--cgh-paper)}',
    '#cgh-toggle{position:absolute;top:max(14px,env(safe-area-inset-top));right:max(14px,env(safe-area-inset-right));z-index:3;min-width:42px;height:36px;padding:0 12px;pointer-events:auto;border:1px solid rgba(255,255,255,.22);border-radius:999px;background:rgba(5,8,8,.82);color:#fff;box-shadow:0 10px 34px rgba(0,0,0,.35);backdrop-filter:blur(14px);font:900 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;cursor:pointer}',
    '#cgh-toggle:hover,#cgh-toggle:focus-visible{border-color:var(--cgh-acid);color:var(--cgh-acid);outline:none}',
    '#cgh-backdrop{position:absolute;inset:0;opacity:0;pointer-events:none;background:rgba(0,0,0,.64);backdrop-filter:blur(5px);transition:opacity .18s}',
    '#cgh-panel{position:absolute;top:0;right:0;width:min(430px,100vw);height:100%;padding:22px 20px calc(28px + env(safe-area-inset-bottom));overflow:auto;pointer-events:auto;transform:translateX(104%);background:linear-gradient(155deg,#111512,#060807 72%);border-left:1px solid rgba(255,255,255,.18);box-shadow:-30px 0 90px rgba(0,0,0,.58);transition:transform .22s cubic-bezier(.2,.9,.24,1)}',
    '#cyberliga-game-hub.open #cgh-backdrop{opacity:1;pointer-events:auto}',
    '#cyberliga-game-hub.open #cgh-panel{transform:translateX(0)}',
    '#cyberliga-game-hub.open #cgh-toggle{display:none}',
    '.cgh-head{display:flex;align-items:center;justify-content:space-between;gap:15px;padding-bottom:18px;border-bottom:1px solid rgba(255,255,255,.14)}',
    '.cgh-brand{font-size:18px;font-weight:950;letter-spacing:-.04em}.cgh-brand small{display:block;margin-top:5px;color:#8f9991;font:750 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em}',
    '#cgh-close{width:38px;height:38px;border:1px solid rgba(255,255,255,.2);border-radius:50%;background:transparent;color:#fff;font-size:21px;cursor:pointer}',
    '#cgh-close:hover,#cgh-close:focus-visible{border-color:var(--cgh-acid);color:var(--cgh-acid);outline:none}',
    '.cgh-current{margin:18px 0;padding:15px;border:1px solid color-mix(in srgb,var(--cgh-acid) 45%,transparent);background:color-mix(in srgb,var(--cgh-acid) 7%,transparent)}',
    '.cgh-current small,.cgh-label{color:#98a19a;font:800 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em}.cgh-current b{display:block;margin-top:8px;color:var(--cgh-acid);font-size:22px;line-height:.9}.cgh-current span{display:block;margin-top:8px;color:#bbc2bd;font-size:11px}',
    '.cgh-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:22px}.cgh-actions a{min-height:44px;display:flex;align-items:center;justify-content:center;padding:8px;border:1px solid rgba(255,255,255,.15);color:#fff;background:rgba(255,255,255,.03);text-decoration:none;text-align:center;font:850 9px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.09em}.cgh-actions a:first-child{grid-column:1/-1;background:var(--cgh-acid);border-color:var(--cgh-acid);color:var(--cgh-ink)}',
    '.cgh-actions a:hover,.cgh-actions a:focus-visible,.cgh-sport:hover,.cgh-sport:focus-visible{border-color:var(--cgh-acid);outline:none}',
    '.cgh-label{display:block;margin:0 0 9px}.cgh-sports{display:grid;gap:5px}.cgh-sport{display:grid;grid-template-columns:44px minmax(0,1fr);gap:3px 10px;align-items:center;min-height:56px;padding:9px 11px;border:1px solid rgba(255,255,255,.12);color:#fff;background:#0d100e;text-decoration:none}.cgh-sport>span{grid-row:1/3;display:grid;place-items:center;align-self:stretch;border:1px solid rgba(255,255,255,.16);color:var(--cgh-acid);font:900 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace}.cgh-sport b{font-size:11px;letter-spacing:.08em}.cgh-sport small{color:#78827a;font:700 7px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em}.cgh-sport.active{border-color:var(--cgh-acid);background:color-mix(in srgb,var(--cgh-acid) 8%,#0d100e)}',
    '.cgh-foot{margin-top:18px;padding-top:15px;border-top:1px solid rgba(255,255,255,.12);color:#758078;font:700 8px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em}',
    '@media(max-width:700px){#cgh-toggle{top:calc(env(safe-area-inset-top,0px) + 9px);right:9px;width:38px;min-width:38px;height:34px;padding:0;font-size:0}#cgh-toggle::after{content:"☰";font-size:16px;letter-spacing:0}#cgh-panel{padding:calc(env(safe-area-inset-top,0px) + 15px) 15px calc(env(safe-area-inset-bottom,0px) + 22px)}.cgh-actions a{min-height:48px}}',
    '@media(prefers-reduced-motion:reduce){#cgh-backdrop,#cgh-panel{transition:none}}'
  ].join('');

  var hub = root.document.createElement('div');
  hub.id = 'cyberliga-game-hub';
  hub.innerHTML = '<button id="cgh-toggle" type="button" aria-controls="cgh-panel" aria-expanded="false">GAME MENU</button>' +
    '<div id="cgh-backdrop" aria-hidden="true"></div>' +
    '<aside id="cgh-panel" role="dialog" aria-modal="true" aria-labelledby="cgh-title" aria-hidden="true">' +
      '<div class="cgh-head"><div class="cgh-brand" id="cgh-title">CYBERLIGA<small>WORLD BROADCAST NAVIGATION</small></div><button id="cgh-close" type="button" aria-label="Close game menu">×</button></div>' +
      '<div class="cgh-current"><small>YOU ARE WATCHING</small><b>' + escapeHtml(current.name) + '</b><span>' + escapeHtml(current.league) + ' · LIVE ARENA</span></div>' +
      '<nav class="cgh-actions" aria-label="Arena destinations">' +
        '<a href="menu.html">OPEN BROADCAST GUIDE</a><a href="world.html">WORLD MAP</a>' +
        '<a href="league.html?sport=' + encodeURIComponent(current.id) + '">LEAGUE ATLAS</a>' +
        '<a href="social.html?sport=' + encodeURIComponent(current.id) + '">WORLD WIRE</a>' +
        '<a href="moment.html?sport=' + encodeURIComponent(current.id) + '">MOMENT MAKER</a>' +
        '<a href="clip.html?sport=' + encodeURIComponent(current.id) + '">CLIP DIRECTOR</a>' +
        '<a href="characterlab.html">CHARACTER LAB</a>' +
      '</nav><span class="cgh-label">CHANGE THE SIGNAL</span><nav class="cgh-sports" aria-label="Switch sports">' + ROUTES.map(routeLink).join('') + '</nav>' +
      '<div class="cgh-foot">G · OPEN MENU &nbsp; / &nbsp; ESC · CLOSE<br>THE CURRENT MATCH CONTINUES BEHIND THIS PANEL.</div>' +
    '</aside>';

  function setOpen(next) {
    open = Boolean(next);
    hub.classList.toggle('open', open);
    hub.querySelector('#cgh-toggle').setAttribute('aria-expanded', String(open));
    hub.querySelector('#cgh-panel').setAttribute('aria-hidden', String(!open));
    if (open) {
      previousFocus = root.document.activeElement;
      hub.querySelector('#cgh-close').focus();
    } else if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    root.dispatchEvent(new CustomEvent('cyberliga:game-menu', { detail: { open: open, sport: current.id } }));
  }

  root.document.head.appendChild(style);
  root.document.body.appendChild(hub);
  hub.querySelector('#cgh-toggle').addEventListener('click', function () { setOpen(!open); });
  hub.querySelector('#cgh-close').addEventListener('click', function () { setOpen(false); });
  hub.querySelector('#cgh-backdrop').addEventListener('click', function () { setOpen(false); });
  root.addEventListener('keydown', function (event) {
    var target = event.target;
    var typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
    if (open && event.key === 'Tab') {
      var focusable = Array.from(hub.querySelectorAll('#cgh-panel a[href],#cgh-panel button:not([disabled])'))
        .filter(function (element) { return element.offsetParent !== null; });
      if (focusable.length) {
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (event.shiftKey && root.document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && root.document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    if (!typing && event.key && event.key.toLowerCase() === 'g' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(!open);
      return;
    }
    if (open && event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
    }
  }, true);

  root.CyberligaGameHub = Object.freeze({
    open: function () { setOpen(true); },
    close: function () { setOpen(false); },
    toggle: function () { setOpen(!open); },
    getState: function () { return Object.freeze({ open: open, sport: current.id, route: path }); }
  });
})(typeof window !== 'undefined' ? window : globalThis);
