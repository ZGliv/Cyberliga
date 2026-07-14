(function enforceCyberligaWatchOnly(root) {
  'use strict';

  var document = root.document;
  if (!document || root.CyberligaWatchOnly) return;

  var interactiveSelector = [
    'a:not(.watch-only-exit)', 'button', 'input', 'select', 'textarea', 'summary',
    '[contenteditable]', '[tabindex]', '[role="button"]', '[role="link"]',
    'audio[controls]', 'video[controls]'
  ].join(',');
  var interfaceShellSelector = [
    '#controls', '#arenaNav', '#controlHint', '#matchnav', '#navopen',
    '#soundpill', '#gameplan[aria-hidden]'
  ].join(',');
  var neutralizeSelector = interactiveSelector + ',' + interfaceShellSelector;
  var blockedEvents = [
    'click', 'dblclick', 'auxclick', 'contextmenu',
    'pointerdown', 'pointerup', 'pointermove', 'pointercancel',
    'mousedown', 'mouseup', 'mousemove',
    'touchstart', 'touchmove', 'touchend', 'touchcancel',
    'keydown', 'keyup', 'keypress', 'wheel'
  ];

  document.documentElement.classList.add('cyberliga-watch-only');
  var style = document.createElement('style');
  style.id = 'cyberliga-watch-only-style';
  style.textContent = [
    '.cyberliga-watch-only a:not(.watch-only-exit),.cyberliga-watch-only button,.cyberliga-watch-only input,.cyberliga-watch-only select,.cyberliga-watch-only textarea,.cyberliga-watch-only summary,.cyberliga-watch-only [contenteditable],.cyberliga-watch-only [tabindex],.cyberliga-watch-only [role="button"],.cyberliga-watch-only [role="link"],.cyberliga-watch-only audio[controls],.cyberliga-watch-only video[controls]{display:none!important}',
    '.cyberliga-watch-only .watch-only-exit{display:inline-flex!important;pointer-events:auto!important;touch-action:manipulation!important}',
    '.cyberliga-watch-only #soundpill{display:none!important}',
    '.cyberliga-watch-only #controls,.cyberliga-watch-only #arenaNav,.cyberliga-watch-only #controlHint,.cyberliga-watch-only #matchnav,.cyberliga-watch-only #navopen,.cyberliga-watch-only #gameplan[aria-hidden]{display:none!important}',
    '.cyberliga-watch-only canvas{pointer-events:none!important}',
    '.cyberliga-watch-only body{cursor:default!important;user-select:none!important;-webkit-user-select:none!important}'
  ].join('');
  document.head.appendChild(style);

  function neutralize(element) {
    if (!element || element.nodeType !== 1) return;
    element.hidden = true;
    element.inert = true;
    element.setAttribute('aria-hidden', 'true');
    element.setAttribute('tabindex', '-1');
    if (element.hasAttribute('href')) element.removeAttribute('href');
    if ('disabled' in element) element.disabled = true;
    Array.from(element.attributes || []).forEach(function (attribute) {
      if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
    });
  }

  function neutralizeTree(node) {
    if (!node) return;
    if (node.matches && node.matches(neutralizeSelector)) neutralize(node);
    if (node.querySelectorAll) node.querySelectorAll(neutralizeSelector).forEach(neutralize);
  }

  function blockInteraction(event) {
    var target=event.target;
    if(target&&target.closest&&target.closest('.watch-only-exit')) return;
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
  }
  blockedEvents.forEach(function (eventName) {
    root.addEventListener(eventName, blockInteraction, { capture: true, passive: false });
  });

  function start() {
    neutralizeTree(document);
    if (document.body) document.body.setAttribute('data-cyberliga-watch-only', 'true');
    new MutationObserver(function (records) {
      records.forEach(function (record) {
        record.addedNodes.forEach(neutralizeTree);
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  root.CyberligaWatchOnly = Object.freeze({ enabled: true });
})(typeof window !== 'undefined' ? window : globalThis);
