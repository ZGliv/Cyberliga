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
  hidden:false,
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

function createPair(suffix = 'fixture', options = {}) {
  const fixtureId = `soccer-broadcast-${suffix}`;
  return {
    director: Named.create({ sportId:'soccer', fixtureId, homeTeam:home, awayTeam:away }),
    spine: Spine.create({
      sportId:'soccer', fixtureId, homeTeam:home, awayTeam:away,
      scheduleWitnessPaint(callback) { callback(); return () => {}; },
      ...options
    })
  };
}

function deferredPaintScheduler() {
  const tasks = [];
  return {
    schedule(callback) {
      const task = { callback, cancelled:false };
      tasks.push(task);
      return () => { task.cancelled = true; };
    },
    flush() {
      const ready = tasks.splice(0,tasks.length);
      ready.forEach((task) => { if (!task.cancelled) task.callback(); });
    },
    pending() { return tasks.filter((task) => !task.cancelled).length; }
  };
}

test('creates a frozen pointer-inert presentation controller only for exact fixtures', () => {
  const { spine } = createPair('exact');
  assert.ok(spine);
  assert.ok(Object.isFrozen(Spine));
  assert.ok(Object.isFrozen(spine));
  assert.equal(Spine.version, '1.2.0');
  assert.equal(Spine.create({ sportId:'soccer', fixtureId:'bad', homeTeam:{ ...home }, awayTeam:away }), null);
  assert.deepEqual(spine.state(), {
    version:'1.2.0', fixtureId:'soccer-broadcast-exact', sportId:'soccer', visible:false,
    mode:'idle', eventId:null, athleteId:null, teamId:null, remainingMs:0, queueLength:0,
    recordedFootage:false, witnessed:false, boundary:null, pointerInteractive:false
  });
  spine.destroy();
});

test('WHO TO WATCH resolves exact Founding identity after an explicit deterministic delay', () => {
  const captures = [];
  const { spine } = createPair('spotlight', { captureWitness(...args) { captures.push(args); } });
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
  assert.equal(state.witnessed, false);
  assert.equal(captures.length, 0);
  spine.destroy();
});

test('committed moments preempt spotlights and truthfully distinguish replay footage', () => {
  const captures = [];
  const { director, spine } = createPair('moment', {
    captureWitness(moment, context) { captures.push({ moment, context }); return true; }
  });
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
  assert.equal(state.witnessed, true);
  assert.equal(state.boundary, 'NOT AUTHORITATIVE · NO MONEY · NO PRIZE');
  assert.equal(findByClass(body, 'cl-spine-kicker').textContent, 'REPLAY MOMENT · GOAL');
  assert.equal(findByClass(body, 'cl-spine-title').textContent, moment.title);
  assert.equal(state.queueLength, 0);
  assert.equal(captures.length, 1);
  assert.strictEqual(captures[0].moment, moment);
  assert.strictEqual(captures[0].context.homeTeam, home);
  assert.strictEqual(captures[0].context.awayTeam, away);
  assert.deepEqual({
    sportId:captures[0].context.sportId,
    fixtureId:captures[0].context.fixtureId,
    mode:captures[0].context.mode
  }, { sportId:'soccer', fixtureId:'soccer-broadcast-moment', mode:'moment' });
  spine.tick(100);
  assert.equal(captures.length, 1);
  tickFor(spine, 4800);
  assert.equal(spine.state().visible, false);
  spine.destroy();
});

test('rejects forged and cross-fixture moments before presentation or finale', () => {
  const captures = [];
  const { director, spine } = createPair('trust', { captureWitness(moment) { captures.push(moment); return true; } });
  const legitimate = director.record({
    eventKey:'trusted-goal', kind:'goal', side:'home', team:home, athlete:home.athletes[1],
    sequence:1, clock:'70:00', score:{home:1,away:0}, leverage:.8, recordedFootage:false
  });
  const forged = {
    ...legitimate,
    id:'forged-event',
    title:'FORGED REPLAY',
    provenance:{ source:'remote', authoritative:true, wagerable:true, settles:true, recordedFootage:true }
  };
  const otherDirector = Named.create({
    sportId:'soccer', fixtureId:'soccer-broadcast-other', homeTeam:home, awayTeam:away
  });
  const otherFixture = otherDirector.record({
    eventKey:'other-goal', kind:'goal', side:'home', team:home, athlete:home.athletes[1]
  });

  assert.equal(spine.present(forged), false);
  assert.equal(spine.present(otherFixture), false);
  assert.equal(spine.finale([legitimate, forged]), false);
  assert.equal(spine.state().visible, false);
  assert.equal(captures.length, 0);
  assert.equal(spine.present(legitimate), true);
  assert.equal(spine.state().eventId, legitimate.id);
  assert.equal(spine.state().recordedFootage, false);
  assert.equal(findByClass(body, 'cl-spine-kicker').textContent, 'LIVE MOMENT · GOAL');
  assert.deepEqual(captures, [legitimate]);
  spine.destroy();
});

test('finale deterministically sequences the supplied top three and then clears', () => {
  const captures = [];
  const { director, spine } = createPair('finale', {
    captureWitness(moment, context) { captures.push({ moment, context }); return true; }
  });
  const moments = ['juke','save','goal'].map((kind, index) => director.record({
    eventKey:`final-${index}`, kind, side:'home', team:home, athlete:home.athletes[index + 1],
    sequence:index + 1, clock:`8${index}:00`, score:{home:index + 1,away:0}, leverage:.8 + index * .05
  }));
  assert.equal(spine.finale(moments), true);
  assert.equal(spine.state().eventId, moments[0].id);
  assert.equal(findByClass(body, 'cl-spine-kicker').textContent, 'MATCH MEMORY 1 / 3');
  assert.deepEqual(captures.map((capture) => capture.moment), moments.slice(0, 1));
  assert.equal(captures[0].context.mode, 'final');
  spine.tick(10);
  assert.equal(captures.length, 1);
  tickFor(spine, 2690);
  assert.equal(spine.state().eventId, moments[1].id);
  assert.equal(findByClass(body, 'cl-spine-kicker').textContent, 'MATCH MEMORY 2 / 3');
  assert.deepEqual(captures.map((capture) => capture.moment), moments.slice(0, 2));
  tickFor(spine, 2700);
  assert.equal(spine.state().eventId, moments[2].id);
  assert.equal(findByClass(body, 'cl-spine-kicker').textContent, 'MATCH MEMORY 3 / 3');
  assert.deepEqual(captures.map((capture) => capture.moment), moments);
  assert.ok(captures.every((capture) => capture.context.mode === 'final'));
  tickFor(spine, 2700);
  assert.equal(spine.state().visible, false);
  spine.destroy();
});

test('a hidden card is witnessed only after it is actually visible, then never twice', () => {
  const captures = [];
  const { director, spine } = createPair('visibility', {
    captureWitness(moment, context) { captures.push({ moment, context }); return true; }
  });
  const moment = director.record({
    eventKey:'visible-goal', kind:'goal', side:'away', team:away, athlete:away.athletes[2],
    sequence:1, clock:'63:11', score:{home:0,away:1}, leverage:.91
  });

  document.hidden = true;
  assert.equal(spine.present(moment), true);
  assert.equal(spine.state().visible, true);
  assert.equal(spine.state().witnessed, false);
  spine.tick(100);
  assert.equal(captures.length, 0);

  document.hidden = false;
  spine.tick(0);
  assert.equal(captures.length, 1);
  assert.strictEqual(captures[0].moment, moment);
  assert.equal(spine.state().witnessed, true);
  spine.tick(500);
  assert.equal(captures.length, 1);

  spine.clear();
  assert.equal(spine.present(moment), true);
  assert.equal(spine.state().witnessed, true);
  assert.equal(captures.length, 1);
  spine.destroy();
});

test('queued or hidden-preempted moments never become witness records', () => {
  const captures = [];
  const { director, spine } = createPair('unpainted', {
    captureWitness(moment) { captures.push(moment); return true; }
  });
  const queued = director.record({
    eventKey:'queued-save', kind:'save', side:'home', team:home, athlete:home.athletes[3]
  });
  const preemptor = director.record({
    eventKey:'preempt-goal', kind:'goal', side:'away', team:away, athlete:away.athletes[3]
  });

  assert.equal(spine.present(queued, { delayMs:1000 }), true);
  assert.equal(spine.state().visible, false);
  spine.clear();
  assert.equal(captures.length, 0);

  document.hidden = true;
  assert.equal(spine.present(queued, { mode:'final' }), true);
  assert.equal(spine.present(preemptor), true);
  assert.equal(spine.state().eventId, preemptor.id);
  spine.clear();
  document.hidden = false;
  spine.tick(0);
  assert.equal(captures.length, 0);
  spine.destroy();
});

test('uses the global witness store by default when no callback is injected', () => {
  const captures = [];
  const previousStore = globalThis.CyberligaWitnessStore;
  globalThis.CyberligaWitnessStore = {
    capturePresented(moment, context) { captures.push({ moment, context }); return true; }
  };
  try {
    const { director, spine } = createPair('default-store');
    const moment = director.record({
      eventKey:'default-store-juke', kind:'juke', side:'away', team:away, athlete:away.athletes[4]
    });
    assert.equal(spine.present(moment), true);
    assert.equal(captures.length, 1);
    assert.strictEqual(captures[0].moment, moment);
    assert.equal(captures[0].context.fixtureId, 'soccer-broadcast-default-store');
    spine.destroy();
  } finally {
    if (previousStore === undefined) delete globalThis.CyberligaWitnessStore;
    else globalThis.CyberligaWitnessStore = previousStore;
  }
});

test('witness callback failures are isolated from the arena and attempted once', () => {
  let attempts = 0;
  const { director, spine } = createPair('failure', {
    captureWitness() { attempts += 1; throw new Error('local storage unavailable'); }
  });
  const moment = director.record({
    eventKey:'failure-save', kind:'save', side:'home', team:home, athlete:home.athletes[4]
  });
  assert.doesNotThrow(() => spine.present(moment));
  assert.equal(spine.state().witnessed, false);
  assert.doesNotThrow(() => spine.tick(100));
  assert.equal(attempts, 1);
  spine.destroy();
});

test('commits only after a paint opportunity and cancels a synchronously replaced card', () => {
  const scheduler = deferredPaintScheduler();
  const captures = [];
  const { director, spine } = createPair('paint-proof', {
    scheduleWitnessPaint: scheduler.schedule,
    captureWitness(moment, context) { captures.push({ moment, context }); return true; }
  });
  const moments = ['juke','save','goal','red_card'].map((kind,index) => director.record({
    eventKey:`paint-proof-${index}`,
    kind,
    side:index % 2 ? 'away' : 'home',
    team:index % 2 ? away : home,
    athlete:(index % 2 ? away : home).athletes[index + 1],
    sequence:index + 1,
    leverage:.7 + index * .05
  }));
  const replaced = moments[0];
  const finale = moments.slice(1);

  assert.equal(spine.present(replaced), true);
  assert.equal(captures.length, 0);
  assert.equal(spine.state().witnessed, false);
  assert.equal(spine.finale(finale), true);
  assert.equal(spine.state().eventId, finale[0].id);
  assert.equal(captures.length, 0);
  assert.equal(scheduler.pending(), 1);

  scheduler.flush();
  assert.deepEqual(captures.map((capture) => capture.moment), finale.slice(0,1));
  assert.ok(captures.every((capture) => capture.moment !== replaced));

  tickFor(spine,2700);
  assert.equal(spine.state().eventId, finale[1].id);
  assert.deepEqual(captures.map((capture) => capture.moment), finale.slice(0,1));
  scheduler.flush();
  assert.deepEqual(captures.map((capture) => capture.moment), finale.slice(0,2));

  tickFor(spine,2700);
  assert.equal(spine.state().eventId, finale[2].id);
  assert.deepEqual(captures.map((capture) => capture.moment), finale.slice(0,2));
  scheduler.flush();
  assert.deepEqual(captures.map((capture) => capture.moment), finale);
  spine.destroy();
});

test('a hidden card that ages into its fully faded leaving window is never witnessed on resume', () => {
  const scheduler = deferredPaintScheduler();
  const captures = [];
  const { director, spine } = createPair('hidden-fade', {
    scheduleWitnessPaint: scheduler.schedule,
    captureWitness(moment) { captures.push(moment); return true; }
  });
  const moment = director.record({
    eventKey:'hidden-fade-goal', kind:'goal', side:'home', team:home, athlete:home.athletes[2]
  });

  document.hidden = true;
  try {
    assert.equal(spine.present(moment), true);
    tickFor(spine, 4500);
    const shell = findByClass(body, 'cl-broadcast-spine');
    assert.equal(spine.state().remainingMs, 300);
    assert.equal(shell.classList.contains('is-visible'), true);
    assert.equal(shell.classList.contains('is-leaving'), true);
    assert.equal(scheduler.pending(), 0);

    document.hidden = false;
    scheduler.flush();
    spine.tick(0);
    scheduler.flush();
    assert.equal(captures.length, 0);
    assert.equal(spine.state().witnessed, false);
  } finally {
    document.hidden = false;
    spine.destroy();
  }
});

test('pending proofs are generation-safe across preemption, clear, and destroy', () => {
  const scheduler = deferredPaintScheduler();
  const captures = [];
  const { director, spine } = createPair('proof-lifecycle', {
    scheduleWitnessPaint: scheduler.schedule,
    captureWitness(moment) { captures.push(moment); return true; }
  });
  const first = director.record({
    eventKey:'proof-lifecycle-save', kind:'save', side:'home', team:home, athlete:home.athletes[3]
  });
  const preemptor = director.record({
    eventKey:'proof-lifecycle-goal', kind:'goal', side:'away', team:away, athlete:away.athletes[3]
  });

  assert.equal(spine.present(first, { mode:'final' }), true);
  assert.equal(spine.present(preemptor), true);
  scheduler.flush();
  assert.deepEqual(captures, [preemptor]);

  spine.clear();
  assert.equal(spine.present(first), true);
  spine.clear();
  scheduler.flush();
  assert.deepEqual(captures, [preemptor]);

  assert.equal(spine.present(first), true);
  spine.destroy();
  scheduler.flush();
  assert.deepEqual(captures, [preemptor]);
  assert.equal(spine.state().visible, false);
  assert.equal(spine.state().remainingMs, 0);
  assert.equal(spine.finale([first]), false);
});
