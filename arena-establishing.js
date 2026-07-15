(function bootstrapCyberligaEstablishing(root) {
  'use strict';

  var active = null;
  var timer = 0;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
    });
  }

  function addStyles() {
    if (document.getElementById('cyb-establishing-style')) return;
    var style = document.createElement('style');
    style.id = 'cyb-establishing-style';
    style.textContent = [
      '.cyb-establishing{--cyb-home:#00e5ff;--cyb-away:#ff45d6;position:fixed;inset:0;z-index:2147480000;pointer-events:none;display:grid;grid-template-columns:minmax(0,1.45fr) minmax(290px,.55fr);background:#02040a;color:#f6f7f5;opacity:0;transition:opacity .38s ease;font-family:Rajdhani,Arial,sans-serif;overflow:hidden}',
      '.cyb-establishing.is-visible{opacity:1}',
      '.cyb-establishing.is-leaving{opacity:0}',
      '.cyb-establishing__image{position:relative;min-width:0;background:#05070b center/cover no-repeat;overflow:hidden}',
      '.cyb-establishing__image:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 52%,#02040a 100%),linear-gradient(0deg,rgba(2,4,10,.8),transparent 50%)}',
      '.cyb-establishing__concept{position:absolute;left:clamp(18px,3vw,48px);bottom:clamp(22px,5vh,54px);width:min(420px,43vw);filter:drop-shadow(0 18px 32px rgba(0,0,0,.65));z-index:1}',
      '.cyb-establishing__concept svg{display:block;width:100%;border:1px solid color-mix(in srgb,var(--cyb-home) 55%,transparent);background:#04070b}',
      '.cyb-establishing__copy{position:relative;display:flex;flex-direction:column;justify-content:center;padding:clamp(28px,5vw,72px);border-left:1px solid rgba(255,255,255,.13);background:radial-gradient(circle at 10% 45%,color-mix(in srgb,var(--cyb-home) 15%,transparent),transparent 42%),#02040a}',
      '.cyb-establishing__copy:before{content:"";position:absolute;top:0;left:0;right:0;height:5px;background:linear-gradient(90deg,var(--cyb-home),var(--cyb-away))}',
      '.cyb-establishing__eyebrow,.cyb-establishing__signal{font-family:Orbitron,Arial,sans-serif;font-weight:900;text-transform:uppercase;letter-spacing:.24em}',
      '.cyb-establishing__eyebrow{font-size:11px;color:var(--cyb-home)}',
      '.cyb-establishing h1{margin:14px 0 4px;font-family:Orbitron,Arial,sans-serif;font-size:clamp(34px,4.7vw,74px);line-height:.92;letter-spacing:-.045em;text-transform:uppercase}',
      '.cyb-establishing h2{margin:0 0 24px;font-size:clamp(17px,1.6vw,25px);line-height:1.1;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.66)}',
      '.cyb-establishing__line{max-width:44ch;margin:0;font-size:clamp(16px,1.35vw,22px);line-height:1.35;font-weight:650;color:rgba(255,255,255,.88)}',
      '.cyb-establishing__ritual{margin-top:28px;padding-top:20px;border-top:1px solid rgba(255,255,255,.14);font-size:14px;line-height:1.4;color:rgba(255,255,255,.66)}',
      '.cyb-establishing__ritual b{display:block;margin-bottom:5px;font-family:Orbitron,Arial,sans-serif;font-size:9px;letter-spacing:.22em;color:var(--cyb-away)}',
      '.cyb-establishing__signal{position:absolute;right:22px;bottom:18px;font-size:8px;color:rgba(255,255,255,.4)}',
      '@media(max-width:720px){.cyb-establishing{grid-template-columns:1fr;grid-template-rows:42% 58%}.cyb-establishing__image:after{background:linear-gradient(0deg,#02040a 0%,transparent 72%)}.cyb-establishing__concept{left:16px;bottom:12px;width:58vw}.cyb-establishing__copy{padding:24px 22px 34px;border-left:0;border-top:1px solid rgba(255,255,255,.12);justify-content:flex-start}.cyb-establishing h1{font-size:clamp(30px,10vw,48px);margin-top:10px}.cyb-establishing h2{font-size:15px;margin-bottom:13px}.cyb-establishing__line{font-size:15px}.cyb-establishing__ritual{font-size:12px;margin-top:16px;padding-top:13px}}',
      '@media(prefers-reduced-motion:reduce){.cyb-establishing{transition:none}}'
    ].join('');
    document.head.appendChild(style);
  }

  function color(team, key, fallback) {
    return team && team.colors && team.colors[key] || fallback;
  }

  function remove() {
    window.clearTimeout(timer);
    if (!active) return;
    active.remove();
    active = null;
  }

  function hide() {
    if (!active) return;
    active.classList.add('is-leaving');
    window.setTimeout(remove, 430);
  }

  function show(options) {
    options = options || {};
    var brand = root.CyberligaBrand;
    var home = options.homeTeam;
    var away = options.awayTeam;
    if (!brand || !home || !away) return null;
    remove();
    addStyles();
    var league = brand.getLeague(options.sportId) || {};
    var identity = brand.getTeam(home.id) || {};
    var duration = Math.max(1200, Number(options.duration) || 2800);
    var hero = options.hero || league.hero || '';
    var concept = typeof brand.sceneSvg === 'function' ? brand.sceneSvg(home) : '';
    var node = document.createElement('section');
    node.className = 'cyb-establishing';
    node.setAttribute('aria-hidden', 'true');
    node.style.setProperty('--cyb-home', color(home, 'primary', league.accent || '#00e5ff'));
    node.style.setProperty('--cyb-away', color(away, 'primary', '#ff45d6'));
    node.innerHTML =
      '<div class="cyb-establishing__image"' + (hero ? ' style="background-image:url(\'' + esc(hero) + '\')"' : '') + '>' +
        '<div class="cyb-establishing__concept">' + concept + '</div>' +
      '</div>' +
      '<div class="cyb-establishing__copy">' +
        '<span class="cyb-establishing__eyebrow">' + esc(league.code || 'CYB') + ' · LIVE FROM ' + esc(brand.displayCity(home)) + '</span>' +
        '<h1>' + esc(identity.venue || brand.displayName(home)) + '</h1>' +
        '<h2>' + esc(brand.displayName(home)) + ' vs ' + esc(brand.displayName(away)) + '</h2>' +
        '<p class="cyb-establishing__line">' + esc(identity.venueLine || identity.statement || league.architecture || '') + '</p>' +
        '<p class="cyb-establishing__ritual"><b>HOME RITUAL</b>' + esc(identity.ritual || 'The home crowd brings the room to life before the opening action.') + '</p>' +
        '<span class="cyb-establishing__signal">CYBERLIGA · AUTONOMOUS WORLD FEED</span>' +
      '</div>';
    document.body.appendChild(node);
    active = node;
    requestAnimationFrame(function () { if (node.isConnected) node.classList.add('is-visible'); });
    timer = window.setTimeout(hide, duration);
    return node;
  }

  root.CyberligaEstablishing = Object.freeze({ show: show, hide: hide, remove: remove });
})(typeof window !== 'undefined' ? window : globalThis);
