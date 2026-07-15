import assert from 'node:assert/strict';
import test from 'node:test';

class FakeClassList {
  constructor(node) { this.node = node; this.values = new Set(); }
  add(...values) { values.forEach((value) => this.values.add(value)); }
  remove(...values) { values.forEach((value) => this.values.delete(value)); }
  toggle(value, force) {
    const enabled = force == null ? !this.values.has(value) : Boolean(force);
    if (enabled) this.values.add(value); else this.values.delete(value);
    return enabled;
  }
  contains(value) { return this.values.has(value); }
}

class FakeStyle {
  constructor() { this.values = new Map(); }
  setProperty(name, value) { this.values.set(name, String(value)); }
  getPropertyValue(name) { return this.values.get(name) || ''; }
}

class FakeNode {
  constructor(tagName) {
    this.tagName = String(tagName).toUpperCase();
    this.className = '';
    this.classList = new FakeClassList(this);
    this.dataset = {};
    this.style = new FakeStyle();
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.textContent = '';
    this.innerHTML = '';
  }
  append(...nodes) {
    nodes.forEach((node) => {
      node.parentNode = this;
      this.children.push(node);
    });
  }
  appendChild(node) { this.append(node); return node; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }
}

const body = new FakeNode('body');
globalThis.window = globalThis;
globalThis.document = {
  body,
  createElement(tagName) { return new FakeNode(tagName); }
};

await import('./worlddata.js?broadcast-spine-tests');
await import('./characterdata.js?broadcast-spine-tests');
await import('./branddata.js?broadcast-spine-tests');
await import('./named-moments.js?broadcast-spine-tests');
await import('./broadcast-spine.js?broadcast-spine-tests');

const Content = globalThis.CYBERLIGA_CONTENT;
const Characters = globalThis.CyberligaCharacters;
const Named = globalThis.CyberligaNamedMoments;
const Spine = globalThis.CyberligaBroadcastSpine;
const sport = Content.getSport('soccer');
const home = sport.teams[0];
const away = sport.teams[1];
const founder = Characters.matchup(home.id, away.id, 'broadcast-test').featured[0];
const founderTeam = Content.getTeam(founder.teamId, sport.id);
const founderAthlete = Content.getAthlete(founderTeam.id, founder.id);

function findByClass(node, className) {
  if (String(node.className).split(/\s+/).includes(className)) return node;
  for (const child of node.children) {
    const found = findByClass(child, className);
    if (found) return found;
  }
  return null;
}

function tickFor(spine, milliseconds) {
  let remaining = milliseconds;
  while (remaining > 0) {
    const step = Math.min(1000, remaining);
    spine.tick(step);
    remaining -= step;
  }
}

function createPair(suffix = 'fixture') {
  const fixtureId = `soccer-broadcast-${suffix}`;
  return {
    director: Named.create({ sportId:'soccer', fixtureId, homeTeam:home, awayTeam:away }),
    spine: Spine.create({ sportId:'soccer', fixtureId, homeTeam:home, awayTeam:away })
  };
}

test('creates a frozen pointer-inert presentation controller only for exact fixtures', () => {
  const { spine } = createPair('exact');
  assert.ok(spine);
  assert.ok(Object.isFrozen(Spine));
  assert.ok(Object.isFrozen(spine));
  assert.equal(Spine.version, '1.0.0');
  assert.equal(Spine.create({ sportId:'soccer', fixtureId:'bad', homeTeam:{ ...home }, awayTeam:away }), null);
  assert.deepEqual(spine.state(), {
    version:'1.0.0', fixtureId:'soccer-broadcast-exact', sportId:'soccer', visible:false,
    mode:'idle', eventId:null, athleteId:null, teamId:null, remainingMs:0, queueLength:0,
    recordedFootage:false, boundary:null, pointerInteractive:false
  });
  spine.destroy();
});

test('WHO TO WATCH resolves exact Founding identity after an explicit deterministic delay', () => {
  const { spine } = createPair('spotlight');
  assert.equal(spine.spotlight({ team:founderTeam, athlete:founderAthlete }, { delayMs:1400, durationMs:5200 }), true);
  assert.equal(spine.spotlight({ team:founderTeam, athlete:{ ...founderAthlete } }), false);
  assert.equal(spine.state().visible, false);
  spine.tick(1000);
  assert.equal(spine.state().visible, false);
  spine.tick(400);
  const state = spine.state();
  assert.equal(state.visible, true);
  assert.equal(state.mode, 'spotlight');
  assert.equal(state.athleteId, founderAthlete.id);
  assert.equal(state.boundary, 'VIEW-ONLY · CLIENT SIM');
  assert.equal(findByClass(body, 'cl-spine-title').textContent, `#${founderAthlete.number} ${founderAthlete.name}`);
  assert.match(findByClass(body, 'cl-spine-detail').textContent, new RegExp(founder.motionName));
  spine.destroy();
});

test('committed moments preempt spotlights and truthfully distinguish replay footage', () => {
  const { director, spine } = createPair('moment');
  const athlete = home.athletes[1];
  spine.spotlight({ team:founderTeam, athlete:founderAthlete }, { delayMs:1000 });
  const moment = director.record({
    eventKey:'goal-001', kind:'goal', side:'home', team:home, athlete,
    sequence:1, clock:'88:20', score:{home:2,away:1}, leverage:.98, recordedFootage:true
  });
  assert.equal(spine.present(moment), true);
  const state = spine.state();
  assert.equal(state.mode, 'moment');
  assert.equal(state.eventId, moment.id);
  assert.equal(state.recordedFootage, true);
  assert.equal(state.boundary, 'NOT AUTHORITATIVE · NO MONEY · NO PRIZE');
  assert.equal(findByClass(body, 'cl-spine-kicker').textContent, 'REPLAY MOMENT · GOAL');
  assert.equal(findByClass(body, 'cl-spine-title').textContent, moment.title);
  assert.equal(state.queueLength, 0);
  tickFor(spine, 4800);
  assert.equal(spine.state().visible, false);
  spine.destroy();
});

test('finale deterministically sequences the supplied top three and then clears', () => {
  const { director, spine } = createPair('finale');
  const moments = ['juke','save','goal'].map((kind, index) => director.record({
    eventKey:`final-${index}`, kind, side:'home', team:home, athlete:home.athletes[index + 1],
    sequence:index + 1, clock:`8${index}:00`, score:{home:index + 1,away:0}, leverage:.8 + index * .05
  }));
  assert.equal(spine.finale(moments), true);
  assert.equal(spine.state().eventId, moments[0].id);
  assert.equal(findByClass(body, 'cl-spine-kicker').textContent, 'MATCH MEMORY 1 / 3');
  tickFor(spine, 2700);
  assert.equal(spine.state().eventId, moments[1].id);
  assert.equal(findByClass(body, 'cl-spine-kicker').textContent, 'MATCH MEMORY 2 / 3');
  tickFor(spine, 2700);
  assert.equal(spine.state().eventId, moments[2].id);
  assert.equal(findByClass(body, 'cl-spine-kicker').textContent, 'MATCH MEMORY 3 / 3');
  tickFor(spine, 2700);
  assert.equal(spine.state().visible, false);
  spine.destroy();
});
