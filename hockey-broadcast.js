/**
 * Hockey broadcast renderer: an overhead, vertically scrolling rink in the tradition of the
 * classic 16-bit hockey games, drawn as crisp pixel art. It only reads engine frames —
 * every movement, decision and result comes from hockey.html.
 *
 * World axes (engine): x runs the length of the rink (team 0 attacks +x), z runs across it,
 * y is height. On screen +x points up, +z points right, and height lifts toward the top of the
 * screen through a slight broadcast tilt.
 */

const KV = 0.9;         // ice foreshortening under the camera tilt
const KH = 0.72;        // how far one metre of height rises on screen
const ART_PPM = 11;      // target pixel-art density: internal pixels per metre
const SCALE = 1.6;      // athletes read larger than life, as in every broadcast game
const OUTLINE = '#0b1220';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const finite = (v, f = 0) => Number.isFinite(v) ? v : f;
const hash = s => Array.from(String(s)).reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Rink geometry mirrors hockey.html (engine metres).
const RINK = { bx: 28, bz: 13, br: 7.5, glx: 24, blx: 8, nw: 4.2, netDepth: 1.1, netHeight: 1.25 };
const FACEOFF_CIRCLES = [[-16.5, -5.2], [-16.5, 5.2], [16.5, -5.2], [16.5, 5.2]];
const NEUTRAL_DOTS = [[-3, -5.2], [-3, 5.2], [3, -5.2], [3, 5.2]];
const END_STANDS = 9, SIDE_STANDS = 16;
const XL = RINK.bx + END_STANDS, ZL = RINK.bz + SIDE_STANDS;

// Compact 3×5 pixel font for numbers, codes and board advertising.
const GLYPHS = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', ' ': '000000000000000', '-': '000000111000000', '.': '000000000000010'
};
function textWidth(text, px = 1) { return String(text).length * 4 * px - px; }
function pixelText(g, text, x, y, color, px = 1) {
  g.fillStyle = color;
  let cx = Math.round(x);
  for (const ch of String(text).toUpperCase()) {
    const glyph = GLYPHS[ch] || GLYPHS[' '];
    for (let i = 0; i < 15; i++) if (glyph[i] === '1') g.fillRect(cx + (i % 3) * px, Math.round(y) + Math.floor(i / 3) * px, px, px);
    cx += 4 * px;
  }
}

function hexRgb(hex, fallback = [120, 130, 150]) {
  const m = /^#?([\da-f]{6})$/i.exec(String(hex || ''));
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}
const rgb = ([r, g, b], a = 1) => a >= 1 ? `rgb(${r|0},${g|0},${b|0})` : `rgba(${r|0},${g|0},${b|0},${a})`;
const shade = ([r, g, b], k) => [clamp(r * k, 0, 255), clamp(g * k, 0, 255), clamp(b * k, 0, 255)];
const luminance = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
function mulberry(seed) { return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/** Home wears the club colour; away wears white with club trim — the real broadcast convention. */
function kitFor(team, side) {
  const primary = hexRgb(team?.colors?.primary, side ? [210, 60, 140] : [30, 160, 200]);
  const secondary = hexRgb(team?.colors?.secondary, shade(primary, .45));
  const accent = hexRgb(team?.colors?.accent, [240, 240, 240]);
  let jersey = primary;
  if (side === 0 && luminance(primary) > .72) jersey = luminance(secondary) < .6 ? secondary : shade(primary, .6);
  // Very dark home kits are lifted so the black pixel outline still separates them.
  if (side === 0 && luminance(jersey) < .28) jersey = jersey.map(c => c + (255 - c) * .28);
  if (side === 1) jersey = [238, 241, 245];
  const darkGear = luminance(secondary) < .4 ? secondary : shade(primary, .3);
  const trim = side === 1 ? (luminance(primary) > .72 ? secondary : primary) : (luminance(accent) > .35 ? accent : [235, 238, 242]);
  return {
    jersey: rgb(jersey), jerseyDark: rgb(shade(jersey, .78)), trim: rgb(trim),
    pants: rgb(darkGear),
    // From overhead the helmet and shoulders carry team identity, so both match the jersey.
    helmet: rgb(side === 1 ? [226, 230, 236] : shade(jersey, .92)), glove: rgb(side === 1 ? darkGear : shade(jersey, .8)),
    number: side === 1 ? rgb(trim) : (luminance(jersey) > .55 ? '#121826' : '#f3f5f8'),
    pad: '#eef1f4', padStripe: rgb(side === 1 ? primary : jersey),
    primary: rgb(primary), primaryRgb: primary, accent: rgb(accent)
  };
}

/** Pixel brush: square stamps along a segment keep every edge crisp when scaled up. */
function seg(g, x0, y0, x1, y1, w, color) {
  const dx = x1 - x0, dy = y1 - y0, n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  g.fillStyle = color;
  const half = w / 2;
  for (let i = 0; i <= n; i++) g.fillRect(Math.round(x0 + dx * i / n - half), Math.round(y0 + dy * i / n - half), w, w);
}
function disc(g, x, y, r, color) {
  g.fillStyle = color;
  const R = Math.max(.5, r);
  for (let yy = -Math.ceil(R); yy <= Math.ceil(R); yy++) {
    const half = Math.floor(Math.sqrt(Math.max(0, R * R - yy * yy)) + .35);
    if (half >= 0) g.fillRect(Math.round(x) - half, Math.round(y) + yy, half * 2 + 1, 1);
  }
}

/** Athlete pose in metres: forward (a), CCW-side (b), height (h). Returns named joints. */
function skaterPose(st, e, t) {
  const crouch = clamp(.35 + st.speed / 8.6 * .45 + st.effort * .2, .3, 1);
  const stopping = e.stopping;
  const action = String(e.action || '');
  const lean = clamp(finite(e.lean), -1, 1) * .34;
  let hipH = .92 - .14 * crouch, tilt = .22 + .5 * crouch;
  if (stopping) tilt = .05;
  if (action === 'check-contact' || action === 'brace') tilt = .85;
  if (action === 'celebrate') { tilt = .12; hipH = .9; }
  const hip = { a: -.04, b: lean * .25, h: hipH };
  const torso = .56;
  const sh = { a: hip.a + torso * Math.sin(tilt), b: hip.b + torso * Math.sin(lean), h: hip.h + torso * Math.cos(tilt) * Math.cos(lean) };
  const head = { a: sh.a + .24 * Math.sin(tilt) * .8, b: sh.b + .24 * Math.sin(lean), h: sh.h + .2 };
  const legs = [];
  const amp = clamp(st.strideAmp, 0, 1);
  for (const side of [-1, 1]) {
    const ph = st.phase + (side > 0 ? Math.PI : 0), s = Math.sin(ph);
    const push = Math.max(0, s) * amp, rec = Math.max(0, -s) * amp;
    let foot;
    if (stopping) foot = { a: .12 + side * .04, b: side * .3, h: 0 };
    else if (st.backward) foot = { a: .1 + .25 * push, b: side * (.17 + .22 * push), h: rec * .06 };
    else foot = { a: -.05 - .42 * push + .18 * rec, b: side * (.15 + .3 * push) + lean * .1, h: rec * .07 };
    const hipJ = { a: hip.a, b: hip.b + side * .11, h: hip.h };
    const knee = { a: (hipJ.a + foot.a) / 2 + .16 * crouch + (stopping ? .1 : 0), b: (hipJ.b + foot.b) / 2, h: (hipJ.h + foot.h) / 2 + .04 };
    legs.push({ side, hip: hipJ, knee, foot, bladeAlongSide: stopping });
  }
  // Stick: handedness sets the blade side; the action drives the blade path.
  const hand = e.shoots === 'R' ? 1 : -1;
  const k = clamp(finite(e.progress), 0, 1);
  let blade = { a: .62, b: hand * .3, h: .02 };
  if (e.hasBall) blade = { a: .62 + Math.cos(t * 8.5 + st.seed) * .07, b: hand * .26 + Math.sin(t * 8.5 + st.seed) * .26, h: .02 };
  if (/shot|slapShot|oneTimer|pass/.test(action)) {
    const contact = action === 'pass' ? .36 : action === 'slapShot' ? .64 : action === 'oneTimer' ? .31 : .43;
    const lift = action === 'slapShot' ? 1.55 : action === 'pass' ? .12 : .55;
    if (k < contact) { const u = k / contact; blade = { a: .62 - 1.1 * u, b: hand * (.3 + .35 * u), h: .02 + lift * Math.pow(u, 1.4) }; }
    else { const u = (k - contact) / (1 - contact); blade = { a: .62 + .45 * u, b: hand * (.3 - .5 * u), h: .02 + lift * .7 * u }; }
  }
  if (action === 'celebrate') blade = { a: .2, b: hand * .2, h: 2.25 + Math.sin(t * 6) * .12 };
  const top = { a: sh.a + .05, b: sh.b - hand * .14, h: sh.h - .22 };
  const bottom = { a: lerp(top.a, blade.a, .42), b: lerp(top.b, blade.b, .42), h: lerp(top.h, blade.h, .42) };
  if (action === 'celebrate') { top.h = sh.h + .55; top.a = sh.a + .1; bottom.h = sh.h + .9; bottom.a = .15; }
  // A skater pushing hard swings the free arm when the stick is carried one-handed.
  const freeSwing = !e.hasBall && !action.match(/shot|slap|oneTimer|pass|celebrate/) && st.speed > 4.5 && amp > .45;
  const free = freeSwing ? { a: sh.a + Math.sin(st.phase) * .3, b: sh.b - hand * .26, h: sh.h - .35 } : bottom;
  const toe = { a: blade.a + .04, b: blade.b + hand * .22, h: blade.h };
  return { hip, sh, head, legs, top, bottom, free, blade, toe, hand, freeSwing, tilt };
}

function goaliePose(st, e, t, puckSide) {
  const action = String(e.action || ''), k = clamp(finite(e.progress), 0, 1);
  const pose = { hip: { a: 0, b: 0, h: .74 }, legs: [], butterfly: false, dive: 0 };
  let flare = 0;
  if (action === 'butterfly' || action === 'save-block') flare = clamp(action === 'butterfly' ? .4 + k : 1, 0, 1);
  if (action === 'save-reach') pose.dive = puckSide * clamp(.3 + k, 0, 1);
  if (action === 'save-cover') flare = 1;
  pose.butterfly = flare > .5;
  pose.hip.h = lerp(.74, .42, flare);
  pose.hip.b = pose.dive * .45;
  for (const side of [-1, 1]) {
    const foot = flare > .5 ? { a: -.12, b: side * .7, h: .02 } : { a: .02, b: side * (.36 + flare * .3), h: 0 };
    const knee = flare > .5 ? { a: .18, b: side * .22, h: .08 } : { a: .2, b: side * .3, h: .42 };
    pose.legs.push({ side, hip: { a: 0, b: pose.hip.b + side * .16, h: pose.hip.h }, knee, foot });
  }
  pose.sh = { a: .06, b: pose.hip.b + pose.dive * .25, h: pose.hip.h + .55 };
  pose.head = { a: .1, b: pose.sh.b, h: pose.sh.h + .23 };
  const reach = pose.dive;
  pose.catcher = { a: .3, b: -.45 + (reach < 0 ? reach * .6 : 0), h: .95 + (reach < 0 ? .1 : 0) };
  pose.blocker = { a: .3, b: .45 + (reach > 0 ? reach * .6 : 0), h: .85 };
  pose.paddle = { a: .5, b: .1, h: .02 };
  if (action === 'save-cover') { pose.catcher = { a: .5, b: 0, h: .2 }; pose.head.h -= .2; }
  return pose;
}

export function createHockeyPainter(canvas) {
  const out = canvas.getContext('2d', { alpha: false });
  const buffer = document.createElement('canvas'), g = buffer.getContext('2d');
  const stage = canvas.parentElement;
  if (!document.getElementById('hb-styles')) { const style = document.createElement('style'); style.id = 'hb-styles'; style.textContent = hockeyOverlayStyles(); document.head.append(style); }
  let view = null, rinkKey = '', rink = null, wear = null, wearCtx = null, front = null, fans = [];
  let paintCount = 0, lastTime = null, lastReal = performance.now(), lastFrame = null;
  const cam = { x: 0, z: 0, vx: 0, ready: false };
  const actors = new Map();
  let particles = [], puckTrail = [];
  const history = [];          // recent snapshots for the goal replay
  let replay = null, lastPhase = '', excitement = 0, goalFlash = 0, goalSide = -1, fixtureKey = '', prevScores = null;
  const overlay = document.createElement('div');
  overlay.className = 'hb-overlay';
  overlay.innerHTML = `
    <div class="hb-replay" hidden><i></i>REPLAY</div>
    <div class="hb-strength" hidden></div>
    <div class="hb-goal" hidden><span class="hb-goal-bar"></span><div><strong>GOAL</strong><b class="hb-goal-name"></b><small class="hb-goal-team"></small></div><em class="hb-goal-score"></em></div>`;
  stage?.append(overlay);
  const ui = {
    replay: overlay.querySelector('.hb-replay'), strength: overlay.querySelector('.hb-strength'), goal: overlay.querySelector('.hb-goal'),
    goalName: overlay.querySelector('.hb-goal-name'), goalTeam: overlay.querySelector('.hb-goal-team'), goalScore: overlay.querySelector('.hb-goal-score'), goalBar: overlay.querySelector('.hb-goal-bar')
  };
  let goalCardUntil = 0;

  function layout(w, h, dpr) {
    // Fit the rink's width plus a strip of crowd; never show less than 18 m of length.
    const ppm = Math.min(w / (RINK.bz * 2 + (w > h ? 11 : 2.5)), h / (18 * KV));
    const factor = Math.max(2, Math.round(ppm * dpr / ART_PPM));
    const W = Math.ceil(w * dpr / factor), H = Math.ceil(h * dpr / factor);
    return { w, h, dpr, factor, W, H, ippm: ppm * dpr / factor, key: `${W}x${H}@${factor}` };
  }

  // ---------- static rink layer (ground, markings, walls, stands) ----------
  function buildRink(frame) {
    const v = view, m = v.ippm, teams = frame.teams || [];
    const home = kitFor(teams[0], 0), away = kitFor(teams[1], 1);
    const padTop = Math.ceil(4 * m);
    const LW = Math.ceil(ZL * 2 * m), LH = Math.ceil(XL * 2 * m * KV) + padTop;
    const layer = document.createElement('canvas'); layer.width = LW; layer.height = LH;
    const c = layer.getContext('2d');
    const img = c.createImageData(LW, LH), px = img.data;
    const rand = mulberry(hash(`${teams[0]?.id}|ice`));
    const homeRgb = home.primaryRgb, iceNoise = new Float32Array(LW * LH);
    for (let i = 0; i < iceNoise.length; i++) iceNoise[i] = rand();
    const inRink = (x, z, inset = 0) => {
      const ax = Math.abs(x), az = Math.abs(z), bx = RINK.bx - inset, bz = RINK.bz - inset, r = RINK.br - inset;
      if (ax > bx || az > bz) return false;
      if (ax > bx - r && az > bz - r) return Math.hypot(ax - (bx - r), az - (bz - r)) <= r;
      return true;
    };
    const set = (i, r, g2, b) => { px[i] = r; px[i + 1] = g2; px[i + 2] = b; px[i + 3] = 255; };
    for (let ly = 0; ly < LH; ly++) for (let lx = 0; lx < LW; lx++) {
      const i = (ly * LW + lx) * 4, z = (lx + .5) / m - ZL, x = XL - (ly - padTop + .5) / (m * KV);
      const n = iceNoise[ly * LW + lx];
      if (inRink(x, z)) {
        // Ice: cool white with a soft lighting falloff toward the boards.
        const edge = clamp(1 - Math.min(RINK.bx - Math.abs(x), RINK.bz - Math.abs(z)) / 6, 0, 1);
        let r = 232 - edge * 14 + n * 6, gg = 240 - edge * 10 + n * 5, b = 246 - edge * 4 + n * 4;
        const red = [206, 38, 58], blue = [36, 86, 196];
        let paint = null;
        const ax = Math.abs(x);
        if (Math.abs(ax - RINK.glx) < .09) paint = red;
        if (Math.abs(ax - RINK.blx) < .3) paint = blue;
        if (ax < .3) paint = (Math.floor((z + 20) / 1.2) % 2 === 0 || Math.abs(z) < 3.2) ? red : [244, 246, 248];
        if (Math.abs(Math.hypot(x, z) - 3) < .1 || Math.hypot(x, z) < .22) paint = blue;
        for (const [fx, fz] of FACEOFF_CIRCLES) {
          const d = Math.hypot(x - fx, z - fz);
          if (Math.abs(d - 2.5) < .09 || d < .22) paint = red;
          if (Math.abs(Math.abs(x - fx) - .45) < .07 && Math.abs(Math.abs(z - fz) - 2.75) < .28) paint = red;
        }
        for (const [fx, fz] of NEUTRAL_DOTS) if (Math.hypot(x - fx, z - fz) < .22) paint = red;
        if (ax < RINK.glx && ax > RINK.glx - 2.05) {
          const d = Math.hypot(ax - RINK.glx, z);
          if (d < 1.95) paint = [150, 206, 248];
          if (Math.abs(d - 1.95) < .08) paint = red;
        }
        if (ax > RINK.glx) {
          const t = (ax - RINK.glx) / (RINK.bx - RINK.glx), edgeZ = lerp(4.3, 6.1, t);
          if (Math.abs(Math.abs(z) - edgeZ) < .07) paint = red;
        }
        if (paint) { r = paint[0] + n * 6; gg = paint[1] + n * 6; b = paint[2] + n * 6; }
        set(i, r, gg, b);
      } else if (inRink(x, z, -.32)) {
        // Dasher boards seen from above: white cap with the yellow kick plate line.
        const cap = inRink(x, z, -.12);
        set(i, cap ? 238 : 214, cap ? 236 : 196, cap ? 228 : 64);
      } else {
        // Concourse and seating: tiers step outward in rows.
        const dist = Math.max(Math.abs(x) - RINK.bx, Math.abs(z) - RINK.bz, 0);
        const row = Math.floor(dist / .85), aisle = (Math.abs(Math.round(z * 1.1 + x * .3)) % 14 === 0) && dist > 1.4;
        const tone = row % 2 ? 26 : 32;
        if (dist < 1.2) set(i, 20 + n * 8, 24 + n * 8, 34 + n * 8);
        else if (aisle) set(i, 52, 56, 66);
        else set(i, tone + n * 6, tone + 4 + n * 6, tone + 14 + n * 6);
      }
    }
    c.putImageData(img, 0, 0);
    const L = (x, z, y = 0) => ({ x: (z + ZL) * m, y: (XL - x) * m * KV + padTop - y * m * KH });
    // Center ice: the home club's code inside a ring of its colour.
    const code = String(teams[0]?.code || 'CL').slice(0, 4);
    const cpx = Math.max(2, Math.round(m * .38)), centre = L(0, 0);
    pixelText(c, code, centre.x - textWidth(code, cpx) / 2, centre.y - 2.5 * cpx, rgb(homeRgb, .55), cpx);
    // Benches (left) and the penalty box (right), built into the boards.
    for (const [side, kit] of [[0, home], [1, away]]) {
      const x0 = side ? 3 : -13.5, x1 = side ? 13.5 : -3;
      const a = L(x1, -RINK.bz - .35), b = L(x0, -RINK.bz - 2.4);
      c.fillStyle = '#1a2230'; c.fillRect(Math.round(b.x), Math.round(a.y), Math.round(a.x - b.x), Math.round(b.y - a.y));
      c.fillStyle = kit.primary; c.fillRect(Math.round(a.x) - 2, Math.round(a.y), 2, Math.round(b.y - a.y));
    }
    const pb = L(2.5, RINK.bz + .35), pb2 = L(-2.5, RINK.bz + 2.2);
    c.fillStyle = '#1a2230'; c.fillRect(Math.round(pb.x), Math.round(pb.y), Math.round(pb2.x - pb.x), Math.round(pb2.y - pb.y));
    c.fillStyle = '#d23040'; c.fillRect(Math.round(pb.x), Math.round(pb.y), Math.round(pb2.x - pb.x), 1);
    // Far (north) end wall face: boards with dasher ads, then glass.
    const wall = (x, ads) => {
      const left = L(x, -RINK.bz + RINK.br * .55), right = L(x, RINK.bz - RINK.br * .55);
      const boardH = Math.max(4, Math.round(1.1 * m * KH)), glassH = Math.round(1.7 * m * KH);
      const y0 = Math.round(left.y) - boardH;
      c.fillStyle = 'rgba(190,220,240,.18)'; c.fillRect(Math.round(left.x), y0 - glassH, Math.round(right.x - left.x), glassH);
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(Math.round(left.x), y0 - glassH, Math.round(right.x - left.x), 1);
      c.fillStyle = '#e9ecef'; c.fillRect(Math.round(left.x), y0, Math.round(right.x - left.x), boardH);
      c.fillStyle = '#d8c140'; c.fillRect(Math.round(left.x), y0 + boardH - 1, Math.round(right.x - left.x), 1);
      const n = ads.length, span = (right.x - left.x) / n;
      ads.forEach(([label, bg, fg], i) => {
        const ax = Math.round(left.x + span * i + 1), aw = Math.round(span - 2);
        c.fillStyle = bg; c.fillRect(ax, y0 + 1, aw, boardH - 3);
        const tw = textWidth(label);
        if (tw < aw - 2 && boardH >= 7) pixelText(c, label, ax + (aw - tw) / 2, y0 + 1 + Math.floor((boardH - 3 - 5) / 2), fg);
      });
    };
    wall(RINK.bx, [[teams[0]?.code || 'HOME', home.primary, '#fff'], ['CYBERLIGA', '#1b2a52', '#fff'], [teams[1]?.code || 'AWAY', away.trim, '#fff']]);
    // Side-board ad panels read as colour blocks from overhead.
    for (const side of [-1, 1]) for (let i = -2; i <= 2; i++) {
      const p0 = L(i * 7 + 2.6, side * (RINK.bz + .16)), p1 = L(i * 7 - 2.6, side * (RINK.bz + .16));
      c.fillStyle = i % 2 ? home.primary : '#1b2a52';
      c.fillRect(Math.round(p0.x) - 1, Math.round(p0.y), 2, Math.round(p1.y - p0.y));
    }
    // Near (south) end wall: drawn in front of the players.
    const fl = document.createElement('canvas'); fl.width = LW; fl.height = LH;
    const f = fl.getContext('2d');
    {
      const left = L(-RINK.bx, -RINK.bz + RINK.br * .55), right = L(-RINK.bx, RINK.bz - RINK.br * .55);
      const boardH = Math.max(4, Math.round(1.1 * m * KH)), glassH = Math.round(1.7 * m * KH);
      const y0 = Math.round(left.y) - boardH;
      f.fillStyle = 'rgba(200,225,245,.16)'; f.fillRect(Math.round(left.x), y0 - glassH, Math.round(right.x - left.x), glassH);
      f.fillStyle = 'rgba(255,255,255,.3)'; f.fillRect(Math.round(left.x), y0 - glassH, Math.round(right.x - left.x), 1);
      f.fillStyle = '#2a3242'; f.fillRect(Math.round(left.x), y0, Math.round(right.x - left.x), boardH);
      f.fillStyle = '#e9ecef'; f.fillRect(Math.round(left.x), y0, Math.round(right.x - left.x), 1);
    }
    // Fans: generated once per venue, drawn live so sections can react.
    const fanRand = mulberry(hash(`${teams[0]?.id}|${teams[1]?.id}|fans`));
    fans = [];
    const skins = [[247, 214, 186], [222, 177, 140], [189, 135, 98], [140, 94, 66], [94, 64, 46]];
    const neutral = [[52, 60, 78], [180, 186, 196], [90, 98, 120], [150, 40, 50], [220, 222, 226]];
    // Rows of seats follow the rink's rounded outline, one fan every half metre.
    for (let k = 0; k < 20; k++) {
      const d = 1.9 + k * .9, bx = RINK.bx + d, bz = RINK.bz + d, r = RINK.br + d;
      const straightX = 2 * (bx - r), straightZ = 2 * (bz - r), arc = Math.PI / 2 * r;
      const total = 2 * straightX + 2 * straightZ + 4 * arc;
      for (let sPos = (k % 2) * .25; sPos < total; sPos += .5) {
        if (sPos % 11 < .7) continue; // aisles
        let u = sPos, x, z;
        if (u < straightZ) { x = bx; z = -(bz - r) + u; }
        else if ((u -= straightZ) < arc) [x, z] = [(bx - r) + Math.cos(u / r) * r, (bz - r) + Math.sin(u / r) * r];
        else if ((u -= arc) < straightX) { z = bz; x = (bx - r) - u; }
        else if ((u -= straightX) < arc) [x, z] = [-(bx - r) - Math.sin(u / r) * r, (bz - r) + Math.cos(u / r) * r];
        else if ((u -= arc) < straightZ) { x = -bx; z = (bz - r) - u; }
        else if ((u -= straightZ) < arc) [x, z] = [-(bx - r) - Math.cos(u / r) * r, -(bz - r) - Math.sin(u / r) * r];
        else if ((u -= arc) < straightX) { z = -bz; x = -(bx - r) + u; }
        else { u -= straightX; [x, z] = [(bx - r) + Math.sin(u / r) * r, -(bz - r) - Math.cos(u / r) * r]; }
        if (Math.abs(x) > XL - .3 || Math.abs(z) > ZL - .3) continue;
        if (Math.abs(z) < RINK.bz + 2.8 && Math.abs(x) < 14.2) continue; // benches and box
        if (fanRand() < .12) continue;
        const q = L(x, z, k * .32);
        const roll = fanRand(), shirt = roll < .55 ? shade(homeRgb, .8 + fanRand() * .35) : roll < .7 ? hexRgb(teams[1]?.colors?.primary, [200, 200, 210]) : neutral[(fanRand() * neutral.length) | 0];
        const dim = .6 + fanRand() * .2;
        fans.push({ lx: Math.round(q.x), ly: Math.round(q.y), shirt: rgb(shade(shirt, dim)), skin: rgb(shade(skins[(fanRand() * skins.length) | 0], dim * .9)), phase: fanRand() * 6.28, home: roll < .55, away: roll >= .55 && roll < .7 });
      }
    }
    fans.sort((a, b) => a.ly - b.ly);
    wear = document.createElement('canvas'); wear.width = LW; wear.height = LH; wearCtx = wear.getContext('2d');
    return { layer, front: fl, L, padTop, LW, LH, home, away };
  }

  // ---------- per-actor animation state ----------
  function actorState(e, dt, frame) {
    const id = e.id ?? e.name;
    let st = actors.get(id);
    const speed = Math.hypot(finite(e.vx), finite(e.vz));
    if (!st) { st = { face: Math.atan2(finite(e.vz), finite(e.vx)) || (e.team ? Math.PI : 0), phase: hash(id) % 7, strideAmp: 0, speed, effort: 0, seed: hash(id) % 11, fall: 0, x: e.x, z: e.z }; actors.set(id, st); }
    st.speed = speed;
    st.effort = lerp(st.effort, clamp(finite(e.effort), 0, 1), 1 - Math.exp(-dt * 8));
    // Facing: travel direction, the puck carrier for retreating defencemen, the puck for goalies.
    const puck = frame.projectile || { x: 0, z: 0 };
    let want = st.face;
    const carrier = e.backward && (frame.entities || []).find(o => o.hasBall);
    if (e.role === 'G') want = Math.atan2(puck.z - e.z, puck.x - e.x);
    else if (carrier) want = Math.atan2(carrier.z - e.z, carrier.x - e.x);
    else if (e.stopping && speed > .8) want = Math.atan2(e.vz, e.vx) + Math.PI / 2 * (st.seed % 2 ? 1 : -1);
    else if (speed > .7) want = Math.atan2(e.vz, e.vx);
    else if (!/fall|down|get-up/.test(String(e.action))) want = Math.atan2(puck.z - e.z, puck.x - e.x);
    st.face += wrap(want - st.face) * (1 - Math.exp(-dt * (e.role === 'G' ? 7 : 9)));
    // Stride: cadence follows ground speed; amplitude follows push effort.
    const pushing = clamp(st.effort * 1.2 + (speed > 6.5 ? .25 : 0), 0, 1);
    st.strideAmp = lerp(st.strideAmp, speed > .6 ? clamp(.25 + pushing * .75, 0, 1) : 0, 1 - Math.exp(-dt * 6));
    st.phase += (speed / 2.3 + pushing * 2.2) * Math.PI * dt;
    const down = /fall|down/.test(String(e.action)) ? 1 : e.action === 'get-up' ? 1 - clamp(finite(e.progress) * 3, 0, 1) : 0;
    st.fall = lerp(st.fall, down, 1 - Math.exp(-dt * (down > st.fall ? 9 : 4)));
    return st;
  }

  // ---------- figure drawing ----------
  function drawAthlete(e, st, kit, P, t, puckSide) {
    const f = { x: Math.cos(st.face), z: Math.sin(st.face) }, r = { x: -f.z, z: f.x };
    const isG = e.role === 'G';
    const fall = st.fall, fallDir = (st.seed % 2 ? 1 : -1);
    const W = (j) => {
      let a = j.a * SCALE, b = j.b * SCALE, h = j.h * SCALE;
      if (fall > .01) {
        // Tip the body over its skates and let it slide flat on the ice.
        const ang = fall * Math.PI / 2 * .96, ca = Math.cos(ang), sa = Math.sin(ang);
        if (fallDir > 0) { const a2 = a * ca + h * sa; h = Math.max(.04, -a * sa + h * ca); a = a2; }
        else { const b2 = b * ca + h * sa; h = Math.max(.04, -b * sa + h * ca); b = b2; }
      }
      const q = P(e.x + a * f.x + b * r.x, e.z + a * f.z + b * r.z, h);
      q.depth = -(e.x + a * f.x + b * r.x) + h * .55;
      return q;
    };
    const parts = [];
    const add = (depth, fn) => parts.push({ depth, fn });
    // Shadow first, always under everything.
    const base = P(e.x, e.z, 0);
    g.fillStyle = 'rgba(20,40,70,.22)';
    g.fillRect(Math.round(base.x - 4), Math.round(base.y - 1), 9, 3);
    if (isG) {
      const pose = goaliePose(st, e, t, puckSide);
      for (const leg of pose.legs) {
        const hip = W(leg.hip), knee = W(leg.knee), foot = W(leg.foot);
        add((hip.depth + foot.depth) / 2, () => {
          seg(g, hip.x, hip.y, knee.x, knee.y, 4, OUTLINE); seg(g, knee.x, knee.y, foot.x, foot.y, 5, OUTLINE);
          seg(g, hip.x, hip.y, knee.x, knee.y, 2, kit.pants); seg(g, knee.x, knee.y, foot.x, foot.y, 3, kit.pad);
          const mid = { x: (knee.x + foot.x) / 2, y: (knee.y + foot.y) / 2 };
          g.fillStyle = kit.padStripe; g.fillRect(Math.round(mid.x) - 1, Math.round(mid.y), 3, 1);
        });
      }
      const hip = W(pose.hip), sh = W(pose.sh), head = W(pose.head);
      const shL = W({ ...pose.sh, b: pose.sh.b - .3 }), shR = W({ ...pose.sh, b: pose.sh.b + .3 });
      add(sh.depth, () => {
        seg(g, hip.x, hip.y, sh.x, sh.y, 7, OUTLINE); seg(g, shL.x, shL.y, shR.x, shR.y, 5, OUTLINE);
        seg(g, hip.x, hip.y, sh.x, sh.y, 5, kit.jersey); seg(g, shL.x, shL.y, shR.x, shR.y, 3, kit.jersey);
        seg(g, shL.x, shL.y + 1, shR.x, shR.y + 1, 1, kit.trim);
      });
      const paddle = W(pose.paddle), blocker = W(pose.blocker), catcher = W(pose.catcher);
      add(paddle.depth, () => { seg(g, blocker.x, blocker.y, paddle.x, paddle.y, 3, OUTLINE); seg(g, blocker.x, blocker.y, paddle.x, paddle.y, 1, '#1d2430'); seg(g, paddle.x - 1, paddle.y, paddle.x + 2, paddle.y, 2, '#f1f3f6'); });
      add(blocker.depth + .1, () => { g.fillStyle = OUTLINE; g.fillRect(Math.round(blocker.x) - 2, Math.round(blocker.y) - 2, 5, 5); g.fillStyle = kit.pad; g.fillRect(Math.round(blocker.x) - 1, Math.round(blocker.y) - 1, 3, 3); });
      add(catcher.depth + .1, () => { disc(g, catcher.x, catcher.y, 2.6, OUTLINE); disc(g, catcher.x, catcher.y, 1.7, kit.glove); });
      add(head.depth + .2, () => { disc(g, head.x, head.y, 2.6, OUTLINE); disc(g, head.x, head.y, 1.8, '#e9ecef'); g.fillStyle = kit.trim; g.fillRect(Math.round(head.x) - 1, Math.round(head.y) - 2, 3, 1); g.fillStyle = '#5a6472'; if (f.x < .3) g.fillRect(Math.round(head.x) - 1, Math.round(head.y), 3, 1); });
    } else {
      const pose = skaterPose(st, e, t);
      for (const leg of pose.legs) {
        const hip = W(leg.hip), knee = W(leg.knee), foot = W(leg.foot);
        // Blade orientation: along the stride, or across it in a hockey stop.
        const dirA = leg.bladeAlongSide ? 0 : 1, dirB = leg.bladeAlongSide ? 1 : 0;
        const heel = W({ a: leg.foot.a - .12 * dirA, b: leg.foot.b - .12 * dirB, h: leg.foot.h }), toe = W({ a: leg.foot.a + .2 * dirA, b: leg.foot.b + .2 * dirB, h: leg.foot.h });
        add((hip.depth + foot.depth) / 2 - .05, () => {
          seg(g, hip.x, hip.y, knee.x, knee.y, 5, OUTLINE); seg(g, knee.x, knee.y, foot.x, foot.y, 4, OUTLINE);
          seg(g, hip.x, hip.y, knee.x, knee.y, 3, kit.pants); seg(g, knee.x, knee.y, foot.x, foot.y, 2, kit.jersey);
          seg(g, heel.x, heel.y, toe.x, toe.y, 3, OUTLINE); seg(g, heel.x, heel.y, toe.x, toe.y, 1, '#c9d2dc');
        });
      }
      const hip = W(pose.hip), sh = W(pose.sh), head = W(pose.head);
      const shL = W({ ...pose.sh, b: pose.sh.b - .26 }), shR = W({ ...pose.sh, b: pose.sh.b + .26 });
      const facingAway = f.x > .35;
      add((hip.depth + sh.depth) / 2, () => {
        seg(g, hip.x, hip.y, sh.x, sh.y, 9, OUTLINE); seg(g, shL.x, shL.y, shR.x, shR.y, 8, OUTLINE);
        seg(g, hip.x, hip.y, hip.x, hip.y, 6, kit.pants);
        seg(g, lerp(hip.x, sh.x, .25), lerp(hip.y, sh.y, .25), sh.x, sh.y, 7, kit.jersey); seg(g, shL.x, shL.y, shR.x, shR.y, 6, kit.jersey);
        seg(g, sh.x - 2, sh.y + 2, sh.x + 2, sh.y + 2, 1, kit.jerseyDark);
        g.fillStyle = kit.trim; g.fillRect(Math.round(lerp(hip.x, sh.x, .35)) - 2, Math.round(lerp(hip.y, sh.y, .35)), 4, 1);
        if (facingAway && e.number != null && fall < .3) {
          const num = String(e.number).slice(-2), tw = textWidth(num);
          const cx = lerp(hip.x, sh.x, .62), cy = lerp(hip.y, sh.y, .62);
          if (Math.abs(sh.y - hip.y) >= 4) pixelText(g, num, cx - tw / 2, cy - 2, kit.number);
        }
      });
      const top = W(pose.top), bottom = W(pose.bottom), blade = W(pose.blade), toe = W(pose.toe);
      const handTop = top, handBot = bottom;
      add(blade.depth, () => {
        seg(g, handTop.x, handTop.y, blade.x, blade.y, 1, '#1a1f28'); seg(g, blade.x, blade.y, toe.x, toe.y, 2, OUTLINE);
        seg(g, blade.x, blade.y, toe.x, toe.y, 1, '#f1f3f6');
      });
      const armColor = kit.jersey;
      add(Math.max(sh.depth, handTop.depth) + .05, () => {
        seg(g, shL.x, shL.y, handTop.x, handTop.y, 4, OUTLINE); seg(g, shL.x, shL.y, handTop.x, handTop.y, 2, armColor);
        const other = pose.freeSwing ? W(pose.free) : handBot;
        seg(g, shR.x, shR.y, other.x, other.y, 4, OUTLINE); seg(g, shR.x, shR.y, other.x, other.y, 2, armColor);
        g.fillStyle = OUTLINE; g.fillRect(Math.round(handTop.x) - 2, Math.round(handTop.y) - 2, 4, 4); g.fillRect(Math.round(other.x) - 2, Math.round(other.y) - 2, 4, 4);
        g.fillStyle = kit.glove; g.fillRect(Math.round(handTop.x) - 1, Math.round(handTop.y) - 1, 2, 2); g.fillRect(Math.round(other.x) - 1, Math.round(other.y) - 1, 2, 2);
      });
      add(head.depth + .3, () => {
        disc(g, head.x, head.y, 3, OUTLINE); disc(g, head.x, head.y, 2.1, kit.helmet);
        if (!facingAway && fall < .5) { g.fillStyle = '#e3b28c'; g.fillRect(Math.round(head.x + f.z * 1.2) - 1, Math.round(head.y) + 1, 2, 1); }
        g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(Math.round(head.x) - 1, Math.round(head.y) - 2, 1, 1);
      });
    }
    parts.sort((p, q) => p.depth - q.depth);
    for (const p of parts) p.fn();
  }

  function drawReferee(ref, P, t) {
    const b = P(ref.x, ref.z, 0), top = P(ref.x, ref.z, 1.4 * SCALE), head = P(ref.x, ref.z, 1.75 * SCALE);
    const sway = Math.sin(t * 6 + ref.x) * (Math.hypot(ref.vx || 0, ref.vz || 0) > .6 ? 1 : 0);
    g.fillStyle = 'rgba(20,40,70,.22)'; g.fillRect(Math.round(b.x - 3), Math.round(b.y - 1), 7, 2);
    seg(g, b.x - 1 + sway, b.y, top.x - 1, top.y + 6, 3, OUTLINE); seg(g, b.x + 1 - sway, b.y, top.x + 1, top.y + 6, 3, OUTLINE);
    seg(g, b.x - 1 + sway, b.y, top.x - 1, top.y + 6, 1, '#151a22'); seg(g, b.x + 1 - sway, b.y, top.x + 1, top.y + 6, 1, '#151a22');
    seg(g, top.x, top.y + 6, top.x, top.y, 6, OUTLINE);
    for (let i = -2; i <= 2; i++) { g.fillStyle = (i + 4) % 2 ? '#f2f2f2' : '#121212'; g.fillRect(Math.round(top.x) + i, Math.round(top.y) - 1, 1, 7); }
    g.fillStyle = '#ff7a1a'; g.fillRect(Math.round(top.x) - 3, Math.round(top.y) + 1, 1, 2); g.fillRect(Math.round(top.x) + 3, Math.round(top.y) + 1, 1, 2);
    disc(g, head.x, head.y, 2.2, OUTLINE); disc(g, head.x, head.y, 1.4, '#1b1f27');
  }

  function drawNet(side, P, light) {
    const gx = side * RINK.glx, back = side * (RINK.glx + RINK.netDepth), hw = RINK.nw / 2, hh = RINK.netHeight;
    const pt = (x, z, y = 0) => P(x, z, y);
    const posts = [pt(gx, -hw), pt(gx, hw), pt(gx, -hw, hh), pt(gx, hw, hh)];
    const backs = [pt(back, -hw * .8), pt(back, hw * .8), pt(lerp(gx, back, .5), -hw * .9, hh * .85), pt(lerp(gx, back, .5), hw * .9, hh * .85)];
    // Mesh: a light checker between the frame.
    const minX = Math.round(Math.min(...posts.map(p => p.x), ...backs.map(p => p.x))), maxX = Math.round(Math.max(...posts.map(p => p.x), ...backs.map(p => p.x)));
    const minY = Math.round(Math.min(...posts.map(p => p.y), ...backs.map(p => p.y))), maxY = Math.round(Math.max(...posts.map(p => p.y), ...backs.map(p => p.y)));
    g.fillStyle = 'rgba(240,244,248,.55)';
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) if ((x + y) % 2 === 0 && x > minX && x < maxX && y > minY && y < maxY) g.fillRect(x, y, 1, 1);
    if (light > 0) { g.fillStyle = `rgba(255,40,40,${.35 * light})`; g.fillRect(minX - 2, minY - 6, maxX - minX + 5, 4); }
    seg(g, backs[0].x, backs[0].y, backs[1].x, backs[1].y, 1, '#c7ccd3');
    seg(g, posts[0].x, posts[0].y, backs[0].x, backs[0].y, 1, '#c7ccd3'); seg(g, posts[1].x, posts[1].y, backs[1].x, backs[1].y, 1, '#c7ccd3');
    seg(g, posts[2].x, posts[2].y, backs[2].x, backs[2].y, 1, '#d23040'); seg(g, posts[3].x, posts[3].y, backs[3].x, backs[3].y, 1, '#d23040');
    for (const [a, b] of [[0, 2], [1, 3], [2, 3]]) { seg(g, posts[a].x, posts[a].y, posts[b].x, posts[b].y, 3, OUTLINE); }
    for (const [a, b] of [[0, 2], [1, 3], [2, 3]]) { seg(g, posts[a].x, posts[a].y, posts[b].x, posts[b].y, 1, '#e5343f'); }
  }

  // ---------- snapshots for the goal replay ----------
  function snapshot(frame) {
    return {
      time: frame.time, phase: frame.phase,
      entities: (frame.entities || []).map(e => ({ id: e.id, name: e.name, number: e.number, team: e.team, role: e.role, x: e.x, z: e.z, vx: e.vx, vz: e.vz, action: e.action, progress: e.progress, visible: e.visible, hasBall: e.hasBall, effort: e.effort, lean: e.lean, stopping: e.stopping, backward: e.backward, shoots: e.shoots, penalty: e.penalty })),
      projectile: { ...(frame.projectile || {}) },
      referee: frame.presentation?.referee ? { ...frame.presentation.referee } : null
    };
  }
  function sampleHistory(time) {
    if (!history.length) return null;
    let i = history.findIndex(s => s.time >= time);
    if (i < 0) return history[history.length - 1];
    if (i === 0) return history[0];
    const a = history[i - 1], b = history[i], k = clamp((time - a.time) / ((b.time - a.time) || 1), 0, 1);
    const byId = new Map(a.entities.map(e => [e.id, e]));
    return {
      ...b, time,
      entities: b.entities.map(e => { const o = byId.get(e.id); return o ? { ...e, x: lerp(o.x, e.x, k), z: lerp(o.z, e.z, k), vx: lerp(o.vx, e.vx, k), vz: lerp(o.vz, e.vz, k), progress: lerp(finite(o.progress), finite(e.progress), k) } : e; }),
      projectile: { ...b.projectile, x: lerp(a.projectile.x, b.projectile.x, k), z: lerp(a.projectile.z, b.projectile.z, k), y: lerp(finite(a.projectile.y), finite(b.projectile.y), k) }
    };
  }

  function paint(frame) {
    lastFrame = frame; paintCount++;
    const box = canvas.getBoundingClientRect(), w = Math.max(1, box.width), h = Math.max(1, box.height), dpr = Math.min(window.devicePixelRatio || 1, 3);
    const next = layout(w, h, dpr);
    if (!view || view.key !== next.key) { view = next; buffer.width = view.W; buffer.height = view.H; rinkKey = ''; cam.ready = false; }
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const teams = frame.teams || [];
    const key = `${view.key}|${teams.map(t => t.id).join('|')}`;
    if (key !== rinkKey) { rink = buildRink(frame); rinkKey = key; }
    const fixture = frame.fixtureId ?? teams.map(t => t.id).join('|');
    const restarted = prevScores && teams.some((tm, i) => finite(tm.score) < finite(prevScores[i]));
    if (fixture !== fixtureKey || restarted) { fixtureKey = fixture; goalCardUntil = 0; lastPhase = ''; prevScores = null; history.length = 0; replay = null; wearCtx?.clearRect(0, 0, wear.width, wear.height); actors.clear(); }
    const now = performance.now(), realDt = clamp((now - lastReal) / 1000, 0, .1); lastReal = now;
    const t = finite(frame.time), dt = lastTime === null ? 0 : clamp(t - lastTime, 0, .1); lastTime = t;

    // Record history; detect a goal and schedule its replay.
    if (!replay && (!history.length || t - history[history.length - 1].time >= 1 / 40)) history.push(snapshot(frame));
    while (history.length && t - history[0].time > 7) history.shift();
    if (frame.phase === 'GOAL_SEQ' && lastPhase !== 'GOAL_SEQ') {
      goalSide = prevScores ? teams.findIndex((tm, i) => finite(tm.score) > finite(prevScores[i])) : -1;
      const goalTime = t;
      // Live reaction with the goal graphic, then a slowed replay of the build-up.
      replay = { startAt: now + 3000, to: goalTime, clock: goalTime - 2.6, speed: .6 };
      excitement = 1; goalFlash = 1; goalCardUntil = now + 3000;
      const scorer = (frame.entities || []).find(e => e.action === 'celebrate');
      const team = scorer ? teams[scorer.team] : null;
      ui.goalName.textContent = scorer ? `${scorer.name}${scorer.number != null ? ` · #${scorer.number}` : ''}` : (frame.event?.detail || 'Goal');
      ui.goalTeam.textContent = team?.name || '';
      ui.goalScore.textContent = teams.map(tm => tm.score).join('–');
      ui.goalBar.style.background = scorer ? (scorer.team === 0 ? rink.home.primary : rink.away.primary) : '#e5343f';
    }
    if (frame.phase !== 'GOAL_SEQ') replay = null;
    lastPhase = frame.phase;
    prevScores = teams.map(tm => tm.score);

    let shown = frame, replaying = false;
    if (replay && now >= replay.startAt) {
      replay.clock += realDt * replay.speed;
      if (replay.clock <= replay.to) { const s = sampleHistory(replay.clock); if (s) { shown = { ...frame, ...s, teams: frame.teams, presentation: { ...frame.presentation, referee: s.referee } }; replaying = true; } }
    }
    ui.replay.hidden = !replaying;
    ui.goal.hidden = now > goalCardUntil;
    stage?.classList.toggle('hb-goal-live', !ui.goal.hidden);
    const strength = frame.presentation?.strength || [];
    const pp = strength.findIndex(s => /POWER PLAY/.test(String(s)));
    ui.strength.hidden = pp < 0;
    if (pp >= 0) ui.strength.textContent = `POWER PLAY · ${teams[pp]?.code || ''}`;

    // Camera: follow the puck up and down the ice with a little lead, on a damped spring.
    const m = view.ippm, W = view.W, H = view.H;
    const puck = shown.projectile || { x: 0, z: 0 };
    const viewHalfX = H / 2 / (m * KV), viewHalfZ = W / 2 / m;
    let tx = finite(puck.x) + clamp(finite(puck.vx) * .35, -6, 6);
    if (frame.phase === 'GOAL_SEQ' && !replaying) tx = finite(puck.x);
    tx = clamp(tx, -RINK.bx - 3 + viewHalfX, RINK.bx + 3 - viewHalfX);
    if (viewHalfX * 2 > RINK.bx * 2 + 6) tx = 0;
    let tz = viewHalfZ < RINK.bz + 1.5 ? clamp(finite(puck.z) * .7, -(RINK.bz + 1.5 - viewHalfZ), RINK.bz + 1.5 - viewHalfZ) : 0;
    if (!cam.ready) { cam.x = tx; cam.z = tz; cam.vx = 0; cam.ready = true; }
    const camDt = replaying ? realDt * .6 : (dt || realDt);
    const omega = 3.1, delta = tx - cam.x;
    cam.vx += (omega * omega * delta - 2 * omega * cam.vx) * camDt; cam.x += cam.vx * camDt;
    cam.z += (tz - cam.z) * (1 - Math.exp(-camDt * 3));
    const cx = Math.round(cam.x * m * KV) / (m * KV), cz = Math.round(cam.z * m) / m;
    const P = (x, z, y = 0) => ({ x: W / 2 + (z - cz) * m, y: H / 2 - (x - cx) * m * KV - y * m * KH });

    // Ground layers.
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#0d121b'; g.fillRect(0, 0, W, H);
    const ox = Math.round(W / 2 - (cz + ZL) * m), oy = Math.round(H / 2 - (XL - cx) * m * KV - rink.padTop);
    g.drawImage(rink.layer, ox, oy);
    // Skate wear accumulates on the ice through the game.
    if (!replaying && dt > 0) {
      for (const e of frame.entities || []) {
        if (e.visible === false || e.role === 'G') continue;
        const st = actors.get(e.id); if (!st) continue;
        const a = rink.L(st.x, st.z), b = rink.L(e.x, e.z);
        if (Math.hypot(b.x - a.x, b.y - a.y) < 12 && paintCount % 2 === 0) seg(wearCtx, a.x, a.y, b.x, b.y, 1, 'rgba(160,182,205,.045)');
      }
    }
    g.drawImage(wear, ox, oy);
    // Crowd: sections bounce with the game's energy; the scoring side erupts.
    excitement = Math.max(0, excitement - realDt * .12);
    goalFlash = Math.max(0, goalFlash - realDt * .5);
    const scorerTeam = goalSide;
    for (const fan of fans) {
      const sx = fan.lx + ox, sy = fan.ly + oy;
      if (sx < -2 || sy < -3 || sx > W + 2 || sy > H + 2) continue;
      const cheering = excitement > .05 && ((scorerTeam === 0 && fan.home) || (scorerTeam === 1 && fan.away));
      const bounce = cheering ? Math.round(Math.max(0, Math.sin(now / 140 + fan.phase)) * 2 * Math.min(1, excitement * 1.5)) : (Math.sin(now / 900 + fan.phase) > .97 ? 1 : 0);
      g.fillStyle = fan.shirt; g.fillRect(sx, sy - bounce, 2, 1);
      g.fillStyle = fan.skin; g.fillRect(sx, sy - 1 - bounce, 2, 1);
      if (cheering && bounce > 1) { g.fillStyle = fan.skin; g.fillRect(sx - 1, sy - 2 - bounce, 1, 1); g.fillRect(sx + 2, sy - 2 - bounce, 1, 1); }
    }

    // Sortable world: nets, athletes, referee, puck.
    const entities = (shown.entities || []).filter(e => e.visible !== false && Number.isFinite(e.x) && Number.isFinite(e.z));
    const items = [];
    for (const side of [-1, 1]) items.push({ depth: -(side * RINK.glx) - .2, draw: () => drawNet(side, P, goalFlash > 0 && Math.sign(finite(puck.x)) === side ? (Math.sin(now / 90) > 0 ? goalFlash : goalFlash * .4) : 0) });
    const puckSideFor = e => Math.sign(finite(puck.z) - e.z) || 1;
    for (const e of entities) {
      const st = actorState(e, replaying ? realDt * .6 : (dt || realDt), shown);
      const kit = e.team === 1 ? rink.away : rink.home;
      items.push({ depth: -e.x, draw: () => drawAthlete(e, st, kit, P, t, puckSideFor(e)) });
    }
    const ref = shown.presentation?.referee;
    if (ref && Number.isFinite(ref.x)) items.push({ depth: -ref.x, draw: () => drawReferee(ref, P, t) });
    items.sort((a, b) => a.depth - b.depth);
    for (const it of items) it.draw();
    for (const e of entities) { const st = actors.get(e.id); if (st) { st.x = e.x; st.z = e.z; } }

    // Spray from stops and contact, render-only.
    if (!replaying) for (const e of entities) {
      if (e.stopping || e.action === 'check-contact' || e.action === 'butterfly') {
        const st = actors.get(e.id), base = P(e.x, e.z, 0);
        for (let i = 0; i < 2; i++) { const a = (st?.seed || 1) * 1.7 + now * .013 + i * 2.1; particles.push({ x: base.x, y: base.y, vx: Math.cos(a) * 18, vy: -6 - Math.abs(Math.sin(a)) * 10, life: .35 }); }
      }
    }
    particles = particles.filter(pt => { pt.life -= realDt; pt.vy += 60 * realDt; pt.x += pt.vx * realDt; pt.y += pt.vy * realDt; if (pt.life <= 0) return false; g.fillStyle = 'rgba(245,250,255,.85)'; g.fillRect(Math.round(pt.x), Math.round(pt.y), 1, 1); return true; });
    if (particles.length > 300) particles.splice(0, particles.length - 300);

    // Puck with ground shadow and a short streak at shot speed.
    if (Number.isFinite(puck.x)) {
      const ground = P(puck.x, puck.z, 0), air = P(puck.x, puck.z, Math.max(0, finite(puck.y) - .1));
      const speed = Math.hypot(finite(puck.vx), finite(puck.vz));
      puckTrail.push({ x: air.x, y: air.y }); if (puckTrail.length > 5) puckTrail.shift();
      if (speed > 14 && !puck.ownerId) puckTrail.forEach((p2, i) => { g.fillStyle = `rgba(30,36,48,${.12 + i * .08})`; g.fillRect(Math.round(p2.x) - 1, Math.round(p2.y), 2, 1); });
      if (finite(puck.y) > .25) { g.fillStyle = 'rgba(20,40,70,.25)'; g.fillRect(Math.round(ground.x) - 1, Math.round(ground.y), 3, 1); }
      g.fillStyle = '#0a0d12'; g.fillRect(Math.round(air.x) - 1, Math.round(air.y) - 1, 3, 2);
      g.fillStyle = '#4a5260'; g.fillRect(Math.round(air.x) - 1, Math.round(air.y) - 1, 3, 1);
    }
    // Near wall and glass sit in front of everything on the ice.
    g.drawImage(rink.front, ox, oy);
    if (replaying) { g.fillStyle = 'rgba(8,12,20,.18)'; g.fillRect(0, 0, W, 3); g.fillRect(0, H - 3, W, 3); }

    out.imageSmoothingEnabled = false;
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.drawImage(buffer, 0, 0, view.W * view.factor, view.H * view.factor);
    return {
      width: w, height: h, scale: m / view.dpr * view.factor, camera: { x: cam.x, z: cam.z }, renderer: 'hockey-overhead-pixel', replaying,
      entities: entities.length, paintCount, finite: entities.every(e => Number.isFinite(e.x + e.z)) && Number.isFinite(cam.x),
      projected: entities.map(e => { const q = P(e.x, e.z, 0); return { id: e.id, x: q.x * view.factor / view.dpr, y: q.y * view.factor / view.dpr }; })
    };
  }
  return { paint, get frame() { return lastFrame; } };
}

function hockeyOverlayStyles() {
  return `
.hb-overlay{position:absolute;inset:0;pointer-events:none;z-index:1}
#arcade-root[data-sport="hockey"] .ab-channel,#arcade-root[data-sport="hockey"] .ab-venue{background:#0e1420d9;padding:5px 9px;border-radius:2px}
#arcade-root[data-sport="hockey"] .ab-stage{background:#0d121b}
.hb-replay{position:absolute;top:18px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:7px;padding:5px 12px;background:#0e1420e6;border:1px solid #ffffff1f;border-radius:2px;font:800 11px/1 var(--font-body,Manrope,Arial,sans-serif);letter-spacing:1.6px;color:#f4f6fb}
.hb-replay i{width:7px;height:7px;border-radius:50%;background:#ff3b4a;animation:hb-blink 1s steps(2) infinite}
.hb-strength{position:absolute;top:44px;right:22px;padding:5px 10px;background:#e5b63b;color:#14181f;font:800 10px/1 var(--font-body,Manrope,Arial,sans-serif);letter-spacing:1px;border-radius:2px}
.ab-stage.hb-goal-live .ab-playline,.ab-stage.hb-goal-live .ab-venue{opacity:0}
.hb-goal{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);display:flex;align-items:stretch;min-width:280px;max-width:calc(100% - 32px);background:#0e1420f2;border:1px solid #ffffff1a;box-shadow:0 14px 40px #0008;animation:hb-goal-in .45s cubic-bezier(.2,1.2,.4,1)}
.hb-goal-bar{width:8px;flex:0 0 8px}
.hb-goal>div{padding:12px 18px 12px 14px;min-width:0;flex:1}
.hb-goal strong{display:block;font:800 34px/.9 var(--font-display,"Barlow Condensed","Arial Narrow",sans-serif);letter-spacing:2px;color:#fff}
.hb-goal b{display:block;margin-top:6px;font:700 15px/1.2 var(--font-body,Manrope,Arial,sans-serif);color:#f2f4f8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hb-goal small{display:block;font:600 11px/1.4 var(--font-body,Manrope,Arial,sans-serif);color:#9aa6b8;text-transform:uppercase;letter-spacing:.6px}
.hb-goal em{display:flex;align-items:center;padding:0 18px;font:800 30px/1 var(--font-display,"Barlow Condensed",sans-serif);font-style:normal;color:#fff;border-left:1px solid #ffffff14;font-variant-numeric:tabular-nums}
.hb-goal[hidden],.hb-replay[hidden],.hb-strength[hidden]{display:none}
@keyframes hb-goal-in{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes hb-blink{50%{opacity:.25}}
@media(max-width:520px){.hb-goal{bottom:8px;min-width:0;width:calc(100% - 26px)}.hb-goal strong{font-size:26px}.hb-goal em{font-size:24px;padding:0 13px}.hb-strength{top:auto;bottom:54px;right:13px}.hb-replay{top:12px}}
@media(prefers-reduced-motion:reduce){.hb-goal{animation:none}.hb-replay i{animation:none}}`;
}
