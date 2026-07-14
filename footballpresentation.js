/**
 * CYBERLIGA football presentation primitives.
 *
 * The module has no side effects, dependencies, or external media. It is safe to
 * import in browsers, workers, SSR, and Node. Audio nodes are created only after
 * `FootballAudioDirector.unlock()` is called from a user gesture.
 *
 * Audio integration:
 *
 *   const audio = new FootballAudioDirector({ enabled: true });
 *   soundButton.addEventListener('click', () => audio.toggle());
 *   audio.updateCrowd({ phase, down, homeDefense, yardsToGoal, quarter, scoreDifferential }, dt);
 *   audio.triggerSnap();
 *   audio.triggerTackle({ intensity: 0.8, pan: -0.2 });
 *
 * Replay integration:
 *
 *   const replay = new FootballReplayBuffer({ sampleHz: 20, durationSeconds: 10 });
 *   replay.sample(simulationTime, renderSnapshot);
 *   const event = replay.markEvent('touchdown', simulationTime, { playerId });
 *   const selection = replay.selectReplay({ eventId: event.id, before: 5, after: 1 });
 *   replay.start(selection, { speed: 0.65 });
 *   replay.advance(renderDelta);
 *   renderReplayFrame(replay.currentFrame.state, replay.interpolation);
 */

const EPSILON = 1e-7;

const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
const finiteNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const normalizeEventName = (value) => String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
const compareIds = (left, right) => {
  const a = String(left), b = String(right);
  return a < b ? -1 : a > b ? 1 : 0;
};

/** Default importance used when selecting a replay without an explicit event id. */
export const FOOTBALL_REPLAY_PRIORITIES = Object.freeze({
  touchdown: 100,
  safety: 96,
  turnover: 92,
  interception: 92,
  fumble_recovery: 90,
  turnover_on_downs: 84,
  field_goal: 80,
  kick_ruling: 78,
  contested_catch: 72,
  explosive_play: 68,
  sack: 58,
  first_down: 40,
  tackle: 20,
  incomplete: 8,
});

function seededRandom(seed) {
  let state = (finiteNumber(seed, 0x7f4a7c15) >>> 0) || 0x7f4a7c15;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function fallbackClone(value, seen = new Map()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof ArrayBuffer) return value.slice(0);
  if (ArrayBuffer.isView(value)) return new value.constructor(value);
  if (value instanceof Map) {
    const copy = new Map();
    seen.set(value, copy);
    for (const [key, entry] of value) copy.set(fallbackClone(key, seen), fallbackClone(entry, seen));
    return copy;
  }
  if (value instanceof Set) {
    const copy = new Set();
    seen.set(value, copy);
    for (const entry of value) copy.add(fallbackClone(entry, seen));
    return copy;
  }
  const copy = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value) === null ? null : Object.prototype);
  seen.set(value, copy);
  for (const key of Object.keys(value)) copy[key] = fallbackClone(value[key], seen);
  return copy;
}

/** Clone replay snapshots so later simulation mutations cannot alter recorded history. */
export function cloneFootballReplayState(value) {
  if (typeof globalThis.structuredClone === 'function') {
    try { return globalThis.structuredClone(value); } catch { /* Use the portable fallback. */ }
  }
  return fallbackClone(value);
}

/**
 * Procedural Web Audio director for an American-football broadcast.
 *
 * All trigger methods return `false` until audio has been unlocked, and remain
 * harmless in headless environments. `updateCrowd()` still updates its numeric
 * state headlessly, which makes presentation state deterministic in tests.
 */
export class FootballAudioDirector {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.masterVolume = clamp(finiteNumber(options.masterVolume, 0.72));
    this.crowdVolume = clamp(finiteNumber(options.crowdVolume, 0.42));
    this.effectsVolume = clamp(finiteNumber(options.effectsVolume, 0.82));
    this.context = options.context || null;
    this.contextFactory = typeof options.contextFactory === 'function' ? options.contextFactory : null;
    this.random = seededRandom(options.seed);
    this.unlocked = false;
    this.graphReady = false;
    this.crowdIntensity = clamp(finiteNumber(options.initialCrowd, 0.12));
    this.crowdTarget = this.crowdIntensity;
    this.crowdBoost = 0;
    this.crowdBoostDecay = 0.18;
    this.lastCrowdContext = {};
    this.masterNode = null;
    this.effectsNode = null;
    this.crowdNode = null;
    this.crowdSource = null;
    this.eventNoiseBuffer = null;
  }

  get supported() {
    return !!(this.context || this.contextFactory || globalThis.AudioContext || globalThis.webkitAudioContext);
  }

  get state() {
    return {
      supported: this.supported,
      enabled: this.enabled,
      unlocked: this.unlocked,
      contextState: this.context?.state || 'unavailable',
      crowdIntensity: this.crowdIntensity,
      crowdTarget: this.crowdTarget,
    };
  }

  async unlock() {
    if (!this.supported) return false;
    try {
      if (!this.context || this.context.state === 'closed') {
        const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
        this.context = this.contextFactory ? this.contextFactory() : new AudioContextClass();
        this.graphReady = false;
      }
      if (this.context?.state === 'suspended' && typeof this.context.resume === 'function') await this.context.resume();
      this.#ensureGraph();
      this.unlocked = !!this.context && this.context.state !== 'closed';
      this.#applyMasterVolume(0.025);
      return this.unlocked;
    } catch {
      this.unlocked = false;
      return false;
    }
  }

  /** Toggle audio, or pass a boolean to set it explicitly. Returns enabled state. */
  async toggle(force) {
    this.enabled = typeof force === 'boolean' ? force : !this.enabled;
    if (this.enabled) await this.unlock();
    this.#applyMasterVolume(0.035);
    return this.enabled;
  }

  setVolumes({ master, crowd, effects } = {}) {
    if (Number.isFinite(Number(master))) this.masterVolume = clamp(Number(master));
    if (Number.isFinite(Number(crowd))) this.crowdVolume = clamp(Number(crowd));
    if (Number.isFinite(Number(effects))) this.effectsVolume = clamp(Number(effects));
    this.#applyMasterVolume(0.04);
    this.#applyCrowdVolume(0.08);
    if (this.effectsNode && this.context) this.#setParam(this.effectsNode.gain, this.effectsVolume, this.context.currentTime, 0.05);
    return this.state;
  }

  /**
   * Update the continuous stadium bed.
   *
   * Recognized context fields: `intensity` (explicit override), `baseline`,
   * `phase`, `down`, `homeDefense`, `yardsToGoal`, `quarter`, `late`,
   * `scoreDifferential`, and `momentum`, all optional.
   */
  updateCrowd(context = {}, deltaSeconds = 1 / 60) {
    const dt = clamp(finiteNumber(deltaSeconds, 1 / 60), 0, 0.25);
    this.lastCrowdContext = { ...context };
    let target;
    if (Number.isFinite(Number(context.intensity))) {
      target = clamp(Number(context.intensity));
    } else {
      target = clamp(finiteNumber(context.baseline, 0.11));
      const phase = normalizeEventName(context.phase);
      if (['live', 'kick', 'punt'].includes(phase)) target += 0.06;
      if (context.homeDefense && Number(context.down) === 3) target += 0.18;
      if (context.homeDefense && Number(context.down) >= 4) target += 0.28;
      if (finiteNumber(context.yardsToGoal, 100) <= 20) target += 0.08;
      const closeLate = context.late || (Number(context.quarter) >= 4 && Math.abs(finiteNumber(context.scoreDifferential)) <= 8);
      if (closeLate) target += 0.12;
      target += clamp(finiteNumber(context.momentum), -0.2, 0.35);
    }
    this.crowdBoost = Math.max(0, this.crowdBoost - this.crowdBoostDecay * dt);
    this.crowdTarget = clamp(target + this.crowdBoost);
    const response = this.crowdTarget > this.crowdIntensity ? 3.4 : 0.72;
    this.crowdIntensity += (this.crowdTarget - this.crowdIntensity) * (1 - Math.exp(-response * dt));
    this.crowdIntensity = clamp(this.crowdIntensity);
    this.#applyCrowdVolume(this.crowdTarget > this.crowdIntensity ? 0.08 : 0.22);
    return this.crowdIntensity;
  }

  trigger(eventName, details = {}) {
    const method = {
      snap: 'triggerSnap',
      catch: 'triggerCatch',
      tackle: 'triggerTackle',
      whistle: 'triggerWhistle',
      kick: 'triggerKick',
      score: 'triggerScore',
      touchdown: 'triggerScore',
      turnover: 'triggerTurnover',
      interception: 'triggerTurnover',
      replay: 'triggerReplay',
    }[normalizeEventName(eventName)];
    return method ? this[method](details) : false;
  }

  triggerSnap({ pan = 0, delay = 0 } = {}) {
    if (!this.#canPlay()) return false;
    this.#noise({ delay, duration: 0.045, gain: 0.16, pan, filter: 'bandpass', frequency: 900, endFrequency: 520, q: 0.7 });
    this.#tone({ delay, duration: 0.075, gain: 0.11, pan, frequency: 115, endFrequency: 62, type: 'sine' });
    return true;
  }

  triggerCatch({ intensity = 0.65, pan = 0, delay = 0 } = {}) {
    if (!this.#canPlay()) return false;
    const strength = clamp(finiteNumber(intensity, 0.65));
    this.#noise({ delay, duration: 0.07, gain: 0.07 + strength * 0.08, pan, filter: 'lowpass', frequency: 720, endFrequency: 360 });
    this.#tone({ delay, duration: 0.09, gain: 0.045 + strength * 0.05, pan, frequency: 145, endFrequency: 86, type: 'triangle' });
    return true;
  }

  triggerTackle({ intensity = 0.7, pan = 0, delay = 0 } = {}) {
    if (!this.#canPlay()) return false;
    const strength = clamp(finiteNumber(intensity, 0.7));
    this.#noise({ delay, duration: 0.11 + strength * 0.07, gain: 0.1 + strength * 0.2, pan, filter: 'lowpass', frequency: 520 + strength * 420, endFrequency: 170, q: 0.5 });
    this.#tone({ delay, duration: 0.14 + strength * 0.06, gain: 0.09 + strength * 0.13, pan, frequency: 82 + strength * 18, endFrequency: 38, type: 'sine' });
    this.#boostCrowd(0.08 + strength * 0.18, 2.2);
    return true;
  }

  triggerWhistle({ count = 1, pan = 0, delay = 0 } = {}) {
    if (!this.#canPlay()) return false;
    const whistles = clamp(Math.round(finiteNumber(count, 1)), 1, 3);
    for (let index = 0; index < whistles; index += 1) {
      const offset = delay + index * 0.115;
      this.#tone({ delay: offset, duration: 0.19, attack: 0.012, gain: 0.075, pan, frequency: 2180, endFrequency: 2310, type: 'sine' });
      this.#tone({ delay: offset, duration: 0.17, attack: 0.01, gain: 0.04, pan, frequency: 2490, endFrequency: 2370, type: 'sine' });
    }
    return true;
  }

  triggerKick({ intensity = 0.8, pan = 0, delay = 0 } = {}) {
    if (!this.#canPlay()) return false;
    const strength = clamp(finiteNumber(intensity, 0.8));
    this.#noise({ delay, duration: 0.065, gain: 0.09 + strength * 0.12, pan, filter: 'bandpass', frequency: 680, endFrequency: 260, q: 0.6 });
    this.#tone({ delay, duration: 0.12, gain: 0.07 + strength * 0.07, pan, frequency: 105, endFrequency: 48, type: 'sine' });
    return true;
  }

  triggerScore({ intensity = 1, pan = 0, delay = 0 } = {}) {
    const strength = clamp(finiteNumber(intensity, 1));
    this.#boostCrowd(0.58 + strength * 0.25, 4.8);
    if (!this.#canPlay()) return false;
    this.#tone({ delay, duration: 0.42, gain: 0.075, pan, frequency: 220, endFrequency: 222, type: 'triangle' });
    this.#tone({ delay: delay + 0.055, duration: 0.42, gain: 0.06, pan, frequency: 277, endFrequency: 280, type: 'triangle' });
    this.#tone({ delay: delay + 0.11, duration: 0.46, gain: 0.055, pan, frequency: 330, endFrequency: 333, type: 'triangle' });
    this.#noise({ delay, duration: 0.22, gain: 0.16, pan, filter: 'lowpass', frequency: 520, endFrequency: 150 });
    return true;
  }

  triggerTurnover({ intensity = 0.9, pan = 0, delay = 0 } = {}) {
    const strength = clamp(finiteNumber(intensity, 0.9));
    this.#boostCrowd(0.4 + strength * 0.25, 3.8);
    if (!this.#canPlay()) return false;
    this.#tone({ delay, duration: 0.22, gain: 0.16, pan, frequency: 92, endFrequency: 43, type: 'sine' });
    this.#tone({ delay: delay + 0.16, duration: 0.26, gain: 0.13, pan, frequency: 116, endFrequency: 48, type: 'sine' });
    this.#noise({ delay, duration: 0.18, gain: 0.17, pan, filter: 'lowpass', frequency: 600, endFrequency: 160 });
    return true;
  }

  triggerReplay({ direction = 'in', pan = 0, delay = 0 } = {}) {
    if (!this.#canPlay()) return false;
    const entering = normalizeEventName(direction) !== 'out';
    this.#noise({
      delay,
      duration: 0.24,
      attack: 0.035,
      gain: 0.11,
      pan,
      filter: 'bandpass',
      frequency: entering ? 380 : 2100,
      endFrequency: entering ? 2400 : 330,
      q: 0.85,
    });
    return true;
  }

  /** Stop procedural sources. Pass `{ closeContext: true }` only if this class owns the context. */
  async dispose({ closeContext = false } = {}) {
    try { this.crowdSource?.stop(); } catch { /* It may already be stopped. */ }
    this.crowdSource = null;
    this.graphReady = false;
    this.unlocked = false;
    if (closeContext && this.context && typeof this.context.close === 'function' && this.context.state !== 'closed') {
      try { await this.context.close(); } catch { /* Audio cleanup must never break the game. */ }
    }
  }

  #canPlay() {
    return !!(this.enabled && this.unlocked && this.graphReady && this.context && this.context.state !== 'closed');
  }

  #ensureGraph() {
    if (this.graphReady || !this.context) return;
    const context = this.context;
    this.masterNode = context.createGain();
    this.effectsNode = context.createGain();
    this.crowdNode = context.createGain();
    const output = typeof context.createDynamicsCompressor === 'function' ? context.createDynamicsCompressor() : null;
    this.effectsNode.connect(this.masterNode);
    this.crowdNode.connect(this.masterNode);
    if (output) {
      this.masterNode.connect(output);
      output.connect(context.destination);
      if (output.threshold) output.threshold.value = -8;
      if (output.knee) output.knee.value = 12;
      if (output.ratio) output.ratio.value = 5;
    } else this.masterNode.connect(context.destination);
    this.masterNode.gain.value = this.enabled ? this.masterVolume : 0;
    this.effectsNode.gain.value = this.effectsVolume;
    this.crowdNode.gain.value = 0;

    this.eventNoiseBuffer = this.#makeNoiseBuffer(2);
    this.crowdSource = context.createBufferSource();
    this.crowdSource.buffer = this.#makeNoiseBuffer(3.25, true);
    this.crowdSource.loop = true;
    const lowpass = context.createBiquadFilter();
    const highpass = context.createBiquadFilter();
    lowpass.type = 'lowpass'; lowpass.frequency.value = 1450; lowpass.Q.value = 0.35;
    highpass.type = 'highpass'; highpass.frequency.value = 85; highpass.Q.value = 0.2;
    this.crowdSource.connect(lowpass); lowpass.connect(highpass); highpass.connect(this.crowdNode);
    this.crowdSource.start();
    this.graphReady = true;
    this.#applyCrowdVolume(0.02);
  }

  #makeNoiseBuffer(seconds, crowdColored = false) {
    const context = this.context;
    const length = Math.max(1, Math.ceil(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let low = 0;
    for (let index = 0; index < length; index += 1) {
      const white = this.random() * 2 - 1;
      low = low * 0.982 + white * 0.12;
      data[index] = crowdColored ? clamp(white * 0.28 + low * 0.9, -1, 1) : white;
    }
    return buffer;
  }

  #setParam(parameter, value, time, smoothing = 0) {
    if (!parameter) return;
    try {
      parameter.cancelScheduledValues?.(time);
      if (smoothing > 0 && typeof parameter.setTargetAtTime === 'function') parameter.setTargetAtTime(value, time, smoothing);
      else parameter.setValueAtTime?.(value, time);
    } catch { parameter.value = value; }
  }

  #applyMasterVolume(smoothing = 0.04) {
    if (!this.masterNode || !this.context) return;
    this.#setParam(this.masterNode.gain, this.enabled ? this.masterVolume : 0, this.context.currentTime, smoothing);
  }

  #applyCrowdVolume(smoothing = 0.12) {
    if (!this.crowdNode || !this.context) return;
    const shaped = 0.035 + Math.pow(this.crowdIntensity, 1.35) * 0.965;
    this.#setParam(this.crowdNode.gain, this.crowdVolume * shaped, this.context.currentTime, smoothing);
  }

  #boostCrowd(amount, decaySeconds) {
    const boost = clamp(finiteNumber(amount));
    this.crowdBoost = Math.max(this.crowdBoost, boost);
    this.crowdBoostDecay = boost / Math.max(0.1, finiteNumber(decaySeconds, 3));
  }

  #tone({ delay = 0, duration = 0.1, attack = 0.006, gain = 0.1, pan = 0, frequency = 120, endFrequency = frequency, type = 'sine' }) {
    const context = this.context;
    const start = context.currentTime + Math.max(0, delay);
    const end = start + Math.max(0.015, duration);
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(1, frequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), end);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + Math.min(attack, duration * 0.4));
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(envelope);
    this.#connectEffect(envelope, pan);
    oscillator.start(start); oscillator.stop(end + 0.025);
  }

  #noise({ delay = 0, duration = 0.1, attack = 0.004, gain = 0.1, pan = 0, filter = 'lowpass', frequency = 700, endFrequency = frequency, q = 0.5 }) {
    const context = this.context;
    const start = context.currentTime + Math.max(0, delay);
    const end = start + Math.max(0.015, duration);
    const source = context.createBufferSource();
    const filterNode = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = this.eventNoiseBuffer;
    filterNode.type = filter;
    filterNode.Q.value = q;
    filterNode.frequency.setValueAtTime(Math.max(20, frequency), start);
    filterNode.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), end);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + Math.min(attack, duration * 0.4));
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    source.connect(filterNode); filterNode.connect(envelope);
    this.#connectEffect(envelope, pan);
    const maxOffset = Math.max(0, this.eventNoiseBuffer.duration - duration - 0.01);
    source.start(start, this.random() * maxOffset, duration);
  }

  #connectEffect(node, pan) {
    const normalizedPan = clamp(finiteNumber(pan), -1, 1);
    if (typeof this.context.createStereoPanner === 'function') {
      const panner = this.context.createStereoPanner();
      panner.pan.value = normalizedPan;
      node.connect(panner); panner.connect(this.effectsNode);
    } else node.connect(this.effectsNode);
  }
}

/**
 * Deterministic, simulation-time replay recorder and playback cursor.
 *
 * Call `sample(time, snapshot)` from the fixed simulation update. The buffer
 * stores at most `sampleHz` snapshots per second and never reads wall-clock
 * time. Snapshots should contain render state, not live Three.js objects.
 */
export class FootballReplayBuffer {
  constructor(options = {}) {
    this.sampleHz = clamp(finiteNumber(options.sampleHz, 20), 1, 120);
    this.durationSeconds = clamp(finiteNumber(options.durationSeconds, 10), 1, 120);
    this.sampleInterval = 1 / this.sampleHz;
    this.clone = typeof options.clone === 'function' ? options.clone : cloneFootballReplayState;
    this.defaultBefore = clamp(finiteNumber(options.before, 4.5), 0, this.durationSeconds);
    this.defaultAfter = clamp(finiteNumber(options.after, 0.75), 0, this.durationSeconds);
    this.frames = [];
    this.events = [];
    this.nextSampleTime = null;
    this.lastInputTime = null;
    this.nextEventId = 1;
    this.nextReplayId = 1;
    this.selection = null;
    this.cursor = 0;
    this.speed = 0.7;
    this.loop = false;
    this.playing = false;
    this.frameIndex = 0;
  }

  /** Record at the configured maximum rate. Pass `{ force: true }` for an exact event frame. */
  sample(timeSeconds, state, { force = false } = {}) {
    const time = finiteNumber(timeSeconds, NaN);
    if (!Number.isFinite(time)) throw new TypeError('Replay sample time must be a finite number.');
    if (this.lastInputTime !== null && time < this.lastInputTime - EPSILON) {
      throw new RangeError('Replay sample time moved backwards; call reset() when simulation time resets.');
    }
    this.lastInputTime = time;
    if (this.nextSampleTime === null) this.nextSampleTime = time;
    if (!force && time + EPSILON < this.nextSampleTime) return null;

    const frame = { time, state: this.clone(state) };
    const last = this.frames[this.frames.length - 1];
    if (last && Math.abs(last.time - time) <= EPSILON) this.frames[this.frames.length - 1] = frame;
    else this.frames.push(frame);

    if (time + EPSILON >= this.nextSampleTime) {
      const intervals = Math.floor((time - this.nextSampleTime + EPSILON) / this.sampleInterval) + 1;
      this.nextSampleTime += Math.max(1, intervals) * this.sampleInterval;
    }
    this.#trim(time);
    return frame;
  }

  record(timeSeconds, state, options) { return this.sample(timeSeconds, state, options); }

  /** Mark a confirmed simulation event. Event data is cloned immediately. */
  markEvent(type, timeSeconds, data = {}, options = {}) {
    const time = finiteNumber(timeSeconds, NaN);
    if (!Number.isFinite(time)) throw new TypeError('Replay event time must be a finite number.');
    const normalizedType = normalizeEventName(type) || 'event';
    const event = {
      id: options.id ?? this.nextEventId++,
      type: normalizedType,
      time,
      priority: finiteNumber(options.priority, FOOTBALL_REPLAY_PRIORITIES[normalizedType] ?? 25),
      replayable: options.replayable !== false,
      data: this.clone(data),
    };
    this.events.push(event);
    this.events.sort((a, b) => a.time - b.time || compareIds(a.id, b.id));
    const referenceTime = this.lastInputTime === null ? time : Math.max(time, this.lastInputTime);
    this.#trim(referenceTime);
    return event;
  }

  /**
   * Select and freeze a replay segment.
   *
   * Options: `eventId`, `types`, `minPriority`, `before`, `after`, `maxAge`,
   * and `prefer` (`"latest"` or `"priority"`). The returned frames are cloned
   * so live recording can continue without changing active playback.
   */
  selectReplay(options = {}) {
    if (!this.frames.length) return null;
    const firstTime = this.frames[0].time;
    const latestTime = this.frames[this.frames.length - 1].time;
    const allowedTypes = options.types ? new Set([].concat(options.types).map(normalizeEventName)) : null;
    const minPriority = finiteNumber(options.minPriority, -Infinity);
    const maxAge = Math.max(0, finiteNumber(options.maxAge, this.durationSeconds));
    let candidates = this.events.filter((event) => (
      event.replayable &&
      event.time >= firstTime - EPSILON &&
      event.time <= latestTime + EPSILON &&
      latestTime - event.time <= maxAge + EPSILON &&
      event.priority >= minPriority &&
      (!allowedTypes || allowedTypes.has(event.type)) &&
      (options.eventId === undefined || String(event.id) === String(options.eventId))
    ));
    const preferPriority = options.prefer === 'priority';
    candidates = candidates.sort((a, b) => preferPriority
      ? b.priority - a.priority || b.time - a.time || compareIds(b.id, a.id)
      : b.time - a.time || b.priority - a.priority || compareIds(b.id, a.id));
    const event = candidates[0];
    if (!event) return null;

    const before = clamp(finiteNumber(options.before, this.defaultBefore), 0, this.durationSeconds);
    const after = clamp(finiteNumber(options.after, this.defaultAfter), 0, this.durationSeconds);
    const startTime = Math.max(firstTime, event.time - before);
    const endTime = Math.min(latestTime, event.time + after);
    const selectedFrames = this.frames
      .filter((frame) => frame.time >= startTime - EPSILON && frame.time <= endTime + EPSILON)
      .map((frame) => ({ time: frame.time, state: this.clone(frame.state) }));
    if (!selectedFrames.length) return null;

    return {
      id: `replay-${this.nextReplayId++}`,
      event: this.clone(event),
      startTime: selectedFrames[0].time,
      endTime: selectedFrames[selectedFrames.length - 1].time,
      duration: Math.max(0, selectedFrames[selectedFrames.length - 1].time - selectedFrames[0].time),
      frames: selectedFrames,
    };
  }

  /** Start a selection, or pass selection options and let the buffer choose one. */
  start(selectionOrOptions = {}, playbackOptions = {}) {
    const selected = selectionOrOptions?.frames ? selectionOrOptions : this.selectReplay(selectionOrOptions);
    if (!selected?.frames?.length) return false;
    this.selection = {
      ...selected,
      event: this.clone(selected.event),
      frames: selected.frames.map((frame) => ({ time: frame.time, state: this.clone(frame.state) })),
    };
    this.cursor = this.selection.startTime;
    this.speed = clamp(finiteNumber(playbackOptions.speed, 0.7), 0.05, 4);
    this.loop = playbackOptions.loop === true;
    this.playing = true;
    this.frameIndex = 0;
    return true;
  }

  startReplay(selectionOrOptions, playbackOptions) { return this.start(selectionOrOptions, playbackOptions); }

  /** Advance replay by real/render delta seconds. Returns the current recorded frame. */
  advance(deltaSeconds) {
    if (!this.selection) return null;
    const dt = Math.max(0, finiteNumber(deltaSeconds));
    if (this.playing) {
      const start = this.selection.startTime;
      const end = this.selection.endTime;
      const duration = Math.max(0, end - start);
      this.cursor += dt * this.speed;
      if (this.cursor >= end - EPSILON) {
        if (this.loop && duration > EPSILON) this.cursor = start + ((this.cursor - start) % duration);
        else { this.cursor = end; this.playing = false; }
      }
      this.#locateFrame();
    }
    return this.currentFrame;
  }

  stop() {
    this.playing = false;
    return this.currentFrame;
  }

  stopReplay() { return this.stop(); }

  /** Seek to absolute replay time, or pass `{ normalized: true }` for a 0–1 value. */
  seek(value, { normalized = false } = {}) {
    if (!this.selection) return null;
    const start = this.selection.startTime;
    const end = this.selection.endTime;
    const time = normalized ? start + clamp(finiteNumber(value)) * (end - start) : finiteNumber(value, start);
    this.cursor = clamp(time, start, end);
    this.#locateFrame();
    return this.currentFrame;
  }

  /** Clear recorded history, event markers, selection, and playback state. */
  reset() {
    this.frames.length = 0;
    this.events.length = 0;
    this.nextSampleTime = null;
    this.lastInputTime = null;
    this.nextEventId = 1;
    this.nextReplayId = 1;
    this.selection = null;
    this.cursor = 0;
    this.playing = false;
    this.loop = false;
    this.frameIndex = 0;
  }

  get currentFrame() {
    return this.selection?.frames[this.frameIndex] || null;
  }

  /** Neighboring frames and deterministic interpolation alpha for renderer-owned interpolation. */
  get interpolation() {
    if (!this.selection?.frames.length) return null;
    const from = this.selection.frames[this.frameIndex];
    const to = this.selection.frames[Math.min(this.frameIndex + 1, this.selection.frames.length - 1)];
    const span = to.time - from.time;
    return { from, to, alpha: span > EPSILON ? clamp((this.cursor - from.time) / span) : 0 };
  }

  get progress() {
    if (!this.selection) return 0;
    const duration = this.selection.endTime - this.selection.startTime;
    return duration > EPSILON ? clamp((this.cursor - this.selection.startTime) / duration) : 1;
  }

  get status() {
    return {
      sampleHz: this.sampleHz,
      recordedFrames: this.frames.length,
      markedEvents: this.events.length,
      playing: this.playing,
      speed: this.speed,
      cursor: this.cursor,
      progress: this.progress,
      replayId: this.selection?.id || null,
      eventType: this.selection?.event?.type || null,
    };
  }

  #locateFrame() {
    const frames = this.selection?.frames;
    if (!frames?.length) { this.frameIndex = 0; return; }
    let low = 0;
    let high = frames.length - 1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      if (frames[middle].time <= this.cursor + EPSILON) low = middle + 1;
      else high = middle - 1;
    }
    this.frameIndex = clamp(high, 0, frames.length - 1);
  }

  #trim(referenceTime) {
    const cutoff = referenceTime - this.durationSeconds;
    while (this.frames.length && this.frames[0].time < cutoff - EPSILON) this.frames.shift();
    const maximumFrames = Math.ceil(this.durationSeconds * this.sampleHz) + 2;
    if (this.frames.length > maximumFrames) this.frames.splice(0, this.frames.length - maximumFrames);
    const eventCutoff = this.frames.length ? this.frames[0].time - this.defaultBefore : cutoff;
    while (this.events.length && this.events[0].time < eventCutoff - EPSILON) this.events.shift();
  }
}
