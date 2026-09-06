#!/usr/bin/env node
// Supplementary browser checks. The official web-game client remains required.
import { chromium } from '/Users/Test/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const qaDir = path.dirname(fileURLToPath(import.meta.url));
const options = {
  url: 'http://127.0.0.1:4186/experiments/court-motion/index.html',
  out: path.join(qaDir, 'output'),
  video: false,
  headed: false,
  videoSeconds: 20,
  view: null,
  hooksOnly: false,
};
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (arg === '--video') options.video = true;
  else if (arg === '--headed') options.headed = true;
  else if (arg === '--hooks-only') options.hooksOnly = true;
  else if (['--url', '--out', '--video-seconds', '--view'].includes(arg)) {
    const value = process.argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
    if (arg === '--url') options.url = value;
    if (arg === '--out') options.out = path.resolve(value);
    if (arg === '--video-seconds') options.videoSeconds = Number(value);
    if (arg === '--view') options.view = value;
  } else if (arg === '--help') {
    console.log('node qa/browser-check.mjs [--url URL] [--out DIR] [--video] [--video-seconds 20] [--headed] [--view portrait|landscape|desktop] [--hooks-only]');
    process.exit(0);
  } else throw new Error(`Unknown argument: ${arg}`);
}
if (!Number.isFinite(options.videoSeconds) || options.videoSeconds < 5 || options.videoSeconds > 60) {
  throw new Error('--video-seconds must be between 5 and 60');
}
if (options.view && !['portrait', 'landscape', 'desktop'].includes(options.view)) throw new Error('--view must be portrait, landscape, or desktop');

const sizes = [
  { name: 'portrait-390x844', width: 390, height: 844 },
  { name: 'landscape-844x390', width: 844, height: 390 },
  { name: 'desktop-1280x900', width: 1280, height: 900 },
];
const selectedSizes = options.hooksOnly ? [] : sizes.filter((size) => !options.view || size.name.startsWith(options.view));
const report = {
  startedAt: new Date().toISOString(),
  url: options.url,
  environment: 'Desktop Chromium with resized viewports; not a physical mobile performance test.',
  cadenceScope: 'Real requestAnimationFrame callbacks during five seconds of live rendering; this is not GPU frame timing.',
  stateScope: 'All values exposed through render_game_to_text, including nonfinite values before JSON serialization when observable.',
  visualReview: 'Screenshots and videos require human/model visual inspection; geometry checks do not establish visual readability.',
  cases: [],
  failures: [],
};

function check(condition, message, target = report.failures) {
  if (!condition) target.push(message);
}

function attachErrors(page) {
  const errors = { page: [], console: [], request: [], http: [], graphics: [], warnings: [] };
  page.on('pageerror', (error) => errors.page.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.console.push(message.text());
    if (message.type() === 'warning') errors.warnings.push(message.text());
    if (/context[\s_]+lost|CONTEXT_LOST_WEBGL/i.test(message.text())) errors.graphics.push(message.text());
  });
  page.on('requestfailed', (request) => errors.request.push({ url: request.url(), reason: request.failure()?.errorText }));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.http.push({ url: response.url(), status: response.status() });
  });
  return errors;
}

async function installProbes(page) {
  await page.evaluate(() => {
    window.__motionQaRead = () => {
      const nonfinite = [];
      const walk = (value, at = '$', seen = new WeakSet()) => {
        if (typeof value === 'number' && !Number.isFinite(value)) nonfinite.push(at);
        if (!value || typeof value !== 'object' || seen.has(value)) return;
        seen.add(value);
        for (const [key, child] of Object.entries(value)) walk(child, `${at}.${key}`, seen);
      };
      // Catch NaN/Infinity before JSON.stringify would silently turn them into null.
      const stringify = JSON.stringify;
      let text;
      try {
        JSON.stringify = function (value, ...args) {
          walk(value);
          return stringify.call(this, value, ...args);
        };
        text = window.render_game_to_text();
      } finally {
        JSON.stringify = stringify;
      }
      if (typeof text !== 'string') throw new Error('render_game_to_text must return a JSON string');
      const state = JSON.parse(text);
      walk(state);
      const simulation = state.simulation || state.sim || state;
      return { state, time: simulation.time ?? state.time ?? null, nonfinite: [...new Set(nonfinite)] };
    };
  });
}

async function ready(page) {
  await page.addInitScript(() => {
    window.__motionQaContextLosses = [];
    document.addEventListener('webglcontextlost', (event) => {
      window.__motionQaContextLosses.push({ atMs: performance.now(), canvas: event.target?.id || '', message: event.statusMessage || '' });
    }, true);
  });
  await page.goto(options.url, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && typeof window.advanceTime === 'function', null, { timeout: 15000 });
  await page.locator('canvas').first().waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);
  await installProbes(page);
}

async function snapshot(page) {
  return page.evaluate(() => window.__motionQaRead());
}

function validateState(sample, label, failures) {
  check(sample.nonfinite.length === 0, `${label}: nonfinite exported state at ${sample.nonfinite.join(', ')}`, failures);
  check(sample.state.autonomous === true, `${label}: expected autonomous:true`, failures);
  check(sample.state.interaction === 'view-only', `${label}: expected interaction:'view-only'`, failures);
  check(typeof sample.time === 'number' && Number.isFinite(sample.time), `${label}: expected finite simulation time in seconds`, failures);
}

async function geometry(page) {
  return page.evaluate(() => {
    const width = innerWidth;
    const height = innerHeight;
    const box = (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom });
    const inside = (r) => r.left >= -1 && r.top >= -1 && r.right <= width + 1 && r.bottom <= height + 1;
    const visible = (element) => {
      const r = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      // aria-hidden affects assistive technology, not visual visibility.
      return r.width > 0 && r.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && !element.closest('[hidden]');
    };
    const canvases = [...document.querySelectorAll('canvas')].filter(visible).map((element) => ({
      id: element.id,
      rect: box(element.getBoundingClientRect()),
      inside: inside(element.getBoundingClientRect()),
      buffer: { width: element.width, height: element.height },
    }));
    const controls = [...document.querySelectorAll('button, input:not([type="hidden"]), select, textarea, [role="button"], [role="slider"], [role="switch"], [role="checkbox"], [contenteditable="true"]')]
      .filter(visible).map((element) => ({ tag: element.tagName, label: element.textContent.trim() || element.getAttribute('aria-label') || element.id }));
    const textOverflow = [];
    const loading = document.querySelector('#loading');
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    let textNodes = 0;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!node.textContent.trim() || !parent || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName) || !visible(parent)) continue;
      textNodes += 1;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width && rect.height && !inside(rect)) textOverflow.push({ text: node.textContent.trim().slice(0, 100), rect: box(rect) });
      }
    }
    return {
      viewport: { width, height },
      documentSize: { width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) },
      horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > width + 1,
      canvases, controls, textNodes, textOverflow,
      loadingDismissed: !loading || loading.hidden === true,
      loadingMessage: loading && !loading.hidden ? loading.textContent.trim() : null,
      contextLosses: window.__motionQaContextLosses || [],
      fullscreen: Boolean(document.fullscreenElement),
    };
  });
}

function validateGeometry(result, label, failures) {
  check(!result.horizontalOverflow, `${label}: horizontal document overflow`, failures);
  check(result.canvases.length === 1, `${label}: expected one visible game canvas, got ${result.canvases.length}`, failures);
  for (const canvas of result.canvases) {
    check(canvas.inside, `${label}: canvas ${canvas.id || '(unnamed)'} leaves viewport`, failures);
    check(canvas.buffer.width > 0 && canvas.buffer.height > 0, `${label}: zero-size canvas drawing buffer`, failures);
  }
  check(result.controls.length === 0, `${label}: interactive controls visible: ${JSON.stringify(result.controls)}`, failures);
  check(result.textOverflow.length === 0, `${label}: text labels leave viewport: ${JSON.stringify(result.textOverflow)}`, failures);
  check(!result.fullscreen, `${label}: unexpectedly entered fullscreen`, failures);
  check(result.loadingDismissed, `${label}: loading/error overlay remains visible: ${result.loadingMessage}`, failures);
  check(result.contextLosses.length === 0, `${label}: WebGL context was lost: ${JSON.stringify(result.contextLosses)}`, failures);
}

async function cadence(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const intervals = [];
    const samples = [];
    const started = performance.now();
    let previous;
    let sampleAt = -Infinity;
    const watchdog = setTimeout(() => reject(new Error('Five-second RAF measurement did not complete within 12 seconds')), 12000);
    const drawCount = () => window.__courtMotionQA?.renderFrames ?? null;
    const firstDrawCount = drawCount();
    const frame = (now) => {
      try {
        if (previous !== undefined) intervals.push(now - previous);
        previous = now;
        if (now - sampleAt >= 100) {
          samples.push(window.__motionQaRead());
          sampleAt = now;
        }
        if (now - started < 5000) return requestAnimationFrame(frame);
        clearTimeout(watchdog);
        const sorted = [...intervals].sort((a, b) => a - b);
        const percentile = (fraction) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? null;
        const elapsed = now - started;
        const lastDrawCount = drawCount();
        resolve({
          elapsedMs: elapsed,
          callbacks: intervals.length + 1,
          meanCallbacksPerSecond: intervals.length / (intervals.reduce((sum, value) => sum + value, 0) / 1000),
          medianIntervalMs: percentile(0.5), p95IntervalMs: percentile(0.95), maxIntervalMs: sorted.at(-1) ?? null,
          intervalsOver33ms: intervals.filter((value) => value > 33.34).length,
          intervalsOver100ms: intervals.filter((value) => value > 100).length,
          renderFrames: typeof firstDrawCount === 'number' && typeof lastDrawCount === 'number' ? lastDrawCount - firstDrawCount : null,
          samples,
        });
      } catch (error) { clearTimeout(watchdog); reject(error); }
    };
    requestAnimationFrame(frame);
  }));
}

async function inputSmoke(page, { manual = false } = {}) {
  if (manual) await page.evaluate(() => window.advanceTime(0));
  const before = await snapshot(page);
  const url = page.url();
  for (const key of ['Space', 'p', 'r', 'f', 'Escape', 'ArrowLeft', 'ArrowRight']) await page.keyboard.press(key);
  const canvas = page.locator('canvas').first();
  await canvas.click({ position: { x: 30, y: 30 } });
  await page.waitForTimeout(300);
  const after = await snapshot(page);
  return { beforeTime: before.time, afterTime: after.time, stateUnchanged: JSON.stringify(before.state) === JSON.stringify(after.state), urlUnchanged: page.url() === url, fullscreen: await page.evaluate(() => Boolean(document.fullscreenElement)), after };
}

await mkdir(options.out, { recursive: true });
let browser;
try {
  browser = await chromium.launch({ headless: !options.headed });
  for (const size of selectedSizes) {
    const result = { name: size.name, failures: [] };
    report.cases.push(result);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 1,
      ...(options.video ? { recordVideo: { dir: path.join(options.out, 'video-raw'), size: { width: size.width, height: size.height } } } : {}),
    });
    const page = await context.newPage();
    result.errors = attachErrors(page);
    const video = page.video();
    try {
      await ready(page);
      result.initialState = await snapshot(page);
      validateState(result.initialState, 'initial', result.failures);
      result.geometry = await geometry(page);
      validateGeometry(result.geometry, 'initial', result.failures);
      result.cadence = await cadence(page);
      for (const [index, sample] of result.cadence.samples.entries()) validateState(sample, `live sample ${index}`, result.failures);
      const first = result.cadence.samples[0];
      const last = result.cadence.samples.at(-1);
      check(last.time > first.time, 'Simulation did not advance during real RAF measurement', result.failures);
      if (options.video && options.videoSeconds > 5) await page.waitForTimeout((options.videoSeconds - 5) * 1000);
      result.liveState = await snapshot(page);
      validateState(result.liveState, 'live end', result.failures);
      result.liveGeometry = await geometry(page);
      validateGeometry(result.liveGeometry, 'live end', result.failures);
      result.screenshot = path.join(options.out, `${size.name}.png`);
      await page.screenshot({ path: result.screenshot, fullPage: false });
      await writeFile(path.join(options.out, `${size.name}.state.json`), JSON.stringify(result.liveState.state, null, 2) + '\n');
    } catch (error) {
      result.failures.push(error.stack || error.message);
    } finally {
      await context.close();
      if (video) {
        result.video = path.join(options.out, `${size.name}.webm`);
        await video.saveAs(result.video);
      }
    }
    for (const kind of ['page', 'console', 'request', 'http', 'graphics']) check(result.errors[kind].length === 0, `${kind} errors: ${JSON.stringify(result.errors[kind])}`, result.failures);
    console.log(`${size.name}: ${result.failures.length ? 'FAIL' : 'PASS'}; RAF ${result.cadence?.meanCallbacksPerSecond?.toFixed(1) ?? 'n/a'} callbacks/s`);
  }

  // Keep deterministic fast-forward and input smoke checks out of review videos.
  const hooks = { name: 'hooks-and-orientation', failures: [], steps: [] };
  report.cases.push(hooks);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  hooks.errors = attachErrors(page);
  try {
    await ready(page);
    hooks.input = await inputSmoke(page);
    check(hooks.input.urlUnchanged, 'Keyboard/pointer input changed URL', hooks.failures);
    check(!hooks.input.fullscreen, 'Keyboard/pointer input entered fullscreen', hooks.failures);
    check(hooks.input.afterTime > hooks.input.beforeTime, 'Simulation did not advance after keyboard/pointer input', hooks.failures);
    validateState(hooks.input.after, 'after input', hooks.failures);
    hooks.frozenInput = await inputSmoke(page, { manual: true });
    check(hooks.frozenInput.stateUnchanged, 'Keyboard/pointer input mutated the frozen simulation', hooks.failures);
    check(hooks.frozenInput.urlUnchanged, 'Frozen keyboard/pointer input changed URL', hooks.failures);
    check(!hooks.frozenInput.fullscreen, 'Frozen keyboard/pointer input entered fullscreen', hooks.failures);
    let previous = await snapshot(page);
    for (const size of sizes) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const current = await snapshot(page);
      const layout = await geometry(page);
      validateState(current, `resized ${size.name}`, hooks.failures);
      validateGeometry(layout, `resized ${size.name}`, hooks.failures);
      check(current.time >= previous.time, `Orientation change reset simulation time at ${size.name}`, hooks.failures);
      check(JSON.stringify(current.state) === JSON.stringify(previous.state), `Orientation change mutated frozen simulation at ${size.name}`, hooks.failures);
      hooks.steps.push({ viewport: size.name, time: current.time, geometry: layout });
      previous = current;
    }
    hooks.advance = await page.evaluate(async () => {
      const before = window.__motionQaRead();
      await window.advanceTime(1000);
      const after = window.__motionQaRead();
      return { before, after, delta: after.time - before.time };
    });
    validateState(hooks.advance.after, 'after advanceTime', hooks.failures);
    check(Math.abs(hooks.advance.delta - 1) <= 0.1, `advanceTime(1000) advanced ${hooks.advance.delta} seconds instead of approximately 1`, hooks.failures);
    hooks.geometry = await geometry(page);
    validateGeometry(hooks.geometry, 'after hooks', hooks.failures);
  } catch (error) { hooks.failures.push(error.stack || error.message); }
  finally { await context.close(); }
  for (const kind of ['page', 'console', 'request', 'http', 'graphics']) check(hooks.errors[kind].length === 0, `${kind} errors: ${JSON.stringify(hooks.errors[kind])}`, hooks.failures);
  console.log(`${hooks.name}: ${hooks.failures.length ? 'FAIL' : 'PASS'}`);
} catch (error) {
  report.failures.push(error.stack || error.message);
} finally {
  if (browser) await browser.close();
  report.finishedAt = new Date().toISOString();
  report.passed = report.failures.length === 0 && report.cases.length === selectedSizes.length + 1 && report.cases.every((result) => result.failures.length === 0);
  await writeFile(path.join(options.out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Report: ${path.join(options.out, 'report.json')}`);
  if (!report.passed) process.exitCode = 1;
}
