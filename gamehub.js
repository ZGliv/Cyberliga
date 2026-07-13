(function removeLegacyCyberligaGameHub(root) {
  'use strict';

  // Arena pages retain this compatibility shim so older cached markup is cleaned up,
  // while navigation remains in each page's permanent HOME / WATCH controls.
  if (!root.document) return;
  var hub = root.document.getElementById('cyberliga-game-hub');
  var style = root.document.getElementById('cyberliga-game-hub-style');
  if (hub) hub.remove();
  if (style) style.remove();
  if (root.CyberligaGameHub) {
    try { delete root.CyberligaGameHub; } catch (_) { root.CyberligaGameHub = undefined; }
  }
})(typeof window !== 'undefined' ? window : globalThis);
