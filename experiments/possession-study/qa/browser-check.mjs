#!/usr/bin/env node
// Independent supplementary QA; the release owner runs the official game client.
import { chromium } from '/Users/Test/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const exec = promisify(execFile);
const options = { url: null, out: fileURLToPath(new URL('./output/', import.meta.url)), headed: false, video: false, view: null };
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--headed') options.headed = true;
  else if (arg === '--video') options.video = true;
  else if (['--url', '--out', '--view'].includes(arg)) options[arg.slice(2)] = process.argv[++i];
  else throw new Error(`Unknown option ${arg}`);
}
if (!options.url) throw new Error('Pass the server URL with --url; this harness never starts a server.');
options.out = path.resolve(options.out);
const layouts = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'portrait', width: 390, height: 844 },
  { name: 'landscape', width: 844, height: 390 },
].filter(layout => !options.view || layout.name === options.view);
const beats = [0, 4, 7, 10, 11.5, 12.4, 12.72, 14, 17];
const report = { started: new Date().toISOString(), url: options.url,
  scope: 'Resized desktop Chromium, not physical mobile performance. Real rendered joint matrices plus screenshots; finite geometry alone does not establish compelling motion.',
  views: [], failures: [], visualFindings: 'Pending independent visual review.' };
const check = (ok, text, failures) => { if (!ok) failures.push(text); };

function errorsFor(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(`page: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('requestfailed', request => errors.push(`request: ${request.url()} ${request.failure()?.errorText}`));
  page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
  return errors;
}
async function open(page) {
  await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__study?.seek && window.__study?.state && window.__study?.metrics && window.advanceTime && window.render_game_to_text);
  await page.evaluate(() => document.fonts.ready);
}
async function layoutState(page) {
  return page.evaluate(() => {
    const visible = element => {
      const r = element.getBoundingClientRect(), style = getComputedStyle(element);
      return r.width > 0 && r.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && !element.closest('[hidden]');
    };
    const canvas = [...document.querySelectorAll('canvas')].filter(visible);
    return {
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 1,
      canvases: canvas.map(c => { const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, inside: r.x >= -1 && r.y >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 }; }),
      controls: [...document.querySelectorAll('button,input,select,textarea,[role="button"],[role="slider"],[contenteditable="true"]')].filter(visible).map(e => e.textContent || e.id),
      fullscreen: !!document.fullscreenElement,
    };
  });
}
async function sample(page, time) {
  return page.evaluate(t => { window.__study.seek(t); return { state: window.__study.state(), metrics: window.__study.metrics(), text: JSON.parse(window.render_game_to_text()) }; }, time);
}
function point(value) {
  if (Array.isArray(value)) return value;
  if (value && ['x', 'y', 'z'].every(k => typeof value[k] === 'number')) return [value.x, value.y, value.z];
  return null;
}
function distance(a, b) { return Math.hypot(...a.map((v, i) => v - b[i])); }
function inspectSamples(samples) {
  const diagnostics = { nonfinite: [], deepestBall: Infinity, lowestSole: Infinity, contactGaps: [], worstContact: null, worstTargetError: null, unsupportedGroundedPoses: [], motion: {} };
  const prior = new Map();
  const walk = (v, at, seen = new WeakSet()) => {
    if (typeof v === 'number' && !Number.isFinite(v)) diagnostics.nonfinite.push(at);
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v); for (const [key, child] of Object.entries(v)) walk(child, `${at}.${key}`, seen);
  };
  for (const item of samples) {
    walk(item, `time=${item.time}`);
    const state = item.state, metrics = item.metrics;
    const ball = point(metrics.ball?.position || metrics.ball) || point(state.ball?.position);
    if (ball) diagnostics.deepestBall = Math.min(diagnostics.deepestBall, ball[1]);
    for (const player of metrics.players || []) {
      for (const sole of [player.leftSole, player.rightSole, player.leftSoleHeight, player.rightSoleHeight, player.soleHeights?.[0], player.soleHeights?.[1]]) {
        if (typeof sole === 'number') diagnostics.lowestSole = Math.min(diagnostics.lowestSole, sole);
      }
      const targets = state.players?.find(p => p.id === player.id);
      if (typeof player.contactError === 'number' && (!diagnostics.worstTargetError || player.contactError > diagnostics.worstTargetError.error)) diagnostics.worstTargetError = { time: item.time, player: player.id, error: player.contactError };
      if ((targets?.jump || 0) < .01 && typeof player.leftSole === 'number' && typeof player.rightSole === 'number' && Math.min(player.leftSole, player.rightSole) > .08) diagnostics.unsupportedGroundedPoses.push({ time: item.time, player: player.id, leftSole: player.leftSole, rightSole: player.rightSole });
      for (const joint of ['leftFoot', 'rightFoot', 'leftHand', 'rightHand', 'leftElbow', 'rightElbow', 'leftKnee', 'rightKnee', 'head']) {
        const p = point(player[joint]); if (!p) continue;
        const key = `${player.id}:${joint}`, old = prior.get(key);
        if (old && state.fade < .2 && old.fade < .2) {
          const step = distance(p, old.p);
          if (!diagnostics.motion[joint] || step > diagnostics.motion[joint].step) diagnostics.motion[joint] = { step, metresPerSecond: step * 30, time: item.time, player: player.id };
        }
        prior.set(key, { p, fade: state.fade });
      }
      const declaredContact = state.ball?.contact;
      if (ball && (declaredContact ? declaredContact.playerId === player.id : state.ball?.owner === player.id && /held|catch|dunk|carry|gather/i.test(state.ball.mode || ''))) {
        const hands = (declaredContact?.hand === 'left' ? [point(player.leftHand)] : declaredContact?.hand === 'right' ? [point(player.rightHand)] : [point(player.leftHand), point(player.rightHand)]).filter(Boolean);
        if (hands.length) {
          const gaps = hands.map(hand => distance(hand, ball));
          const gap = declaredContact ? Math.max(...gaps) : Math.min(...gaps);
          const contact = { time: item.time, player: player.id, gap, mode: state.ball.mode, handL: targets?.handL, handR: targets?.handR };
          if (!diagnostics.worstContact || gap > diagnostics.worstContact.gap) diagnostics.worstContact = contact;
          if (gap > .25) diagnostics.contactGaps.push(contact);
        }
      }
    }
  }
  if (!Number.isFinite(diagnostics.lowestSole)) diagnostics.lowestSole = null;
  return diagnostics;
}

await mkdir(options.out, { recursive: true });
const browser = await chromium.launch({ headless: !options.headed });
try {
  for (const size of layouts) {
    const result = { name: size.name, viewport: size, failures: [], stills: [] };
    report.views.push(result);
    const dir = path.join(options.out, size.name); await mkdir(dir, { recursive: true });
    // A clean uninterrupted live clip is separate from all deterministic seeking.
    if (options.video && size.name === 'desktop') {
      const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, recordVideo: { dir: path.join(dir, 'raw-video'), size: { width: size.width, height: size.height } } });
      const page = await context.newPage(); const errors = errorsFor(page); const video = page.video();
      try {
        await open(page);
        const before = await page.evaluate(() => window.__study.state());
        await page.waitForTimeout(24000);
        const after = await page.evaluate(() => window.__study.state());
        result.live = { before, after, errors };
      } finally { await context.close(); }
      result.video = path.join(dir, 'continuous-possession.webm'); await video.saveAs(result.video);
      check(errors.length === 0, `live recording errors: ${errors.join('; ')}`, result.failures);
      await exec('ffmpeg', ['-y', '-i', result.video, '-vf', 'fps=1/2,scale=320:-1,tile=4x3', '-frames:v', '1', path.join(dir, 'live-motion-strip.png')]);
    }
    const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1 });
    const page = await context.newPage(); const errors = errorsFor(page);
    try {
      await open(page);
      result.layout = await layoutState(page);
      check(!result.layout.overflow, 'Horizontal overflow', result.failures);
      check(result.layout.canvases.length === 1 && result.layout.canvases.every(c => c.inside), 'Canvas leaves viewport or is missing', result.failures);
      check(result.layout.controls.length === 0, 'Visible gameplay controls', result.failures);
      for (let index = 0; index < beats.length; index++) {
        const time = beats[index], data = await sample(page, time);
        const screenshot = path.join(dir, `beat-${String(index).padStart(2, '0')}-${time.toFixed(2)}.png`);
        await page.screenshot({ path: screenshot });
        result.stills.push({ time, screenshot, ...data });
      }
      await exec('ffmpeg', ['-y', '-pattern_type', 'glob', '-i', path.join(dir, 'beat-*.png'), '-vf', 'scale=320:-1,tile=3x3', '-frames:v', '1', path.join(dir, 'event-contact-strip.png')]);

      const states = await page.evaluate(() => {
        const rows = [];
        for (let frame = 0; frame < 600; frame++) {
          const time = frame / 30; window.__study.seek(time);
          rows.push({ time, state: window.__study.state(), metrics: window.__study.metrics() });
        }
        return rows;
      });
      await writeFile(path.join(dir, 'motion-samples.json'), JSON.stringify(states));
      result.motion = inspectSamples(states);
      check(result.motion.nonfinite.length === 0, 'Nonfinite state or rendered joint', result.failures);
      check(result.motion.deepestBall >= .10, `Ball goes below the floor: y=${result.motion.deepestBall}`, result.failures);
      if (result.motion.lowestSole !== null) check(result.motion.lowestSole > -.08, `Feet penetrate floor: y=${result.motion.lowestSole}`, result.failures);
      result.score = [];
      for (const time of [11.5, 12.70, 12.75, 14, 19.999, .001]) {
        const { state } = await sample(page, time); result.score.push({ time, score: state.score, ball: state.ball, fade: state.fade });
      }
      const [release, beforeRim, afterRim, reacted, fadeOut, fadeIn] = result.score;
      check(release.score?.[0] === 22 && beforeRim.score?.[0] === 22, 'Score changes before downward rim crossing', result.failures);
      check(afterRim.score?.[0] === 24 && reacted.score?.[0] === 24, 'Made dunk does not update Pittsburgh to 24', result.failures);
      check(fadeOut.fade > .9 && fadeIn.fade > .9, 'Loop discontinuity is not hidden by the fade', result.failures);

      await sample(page, 7);
      const beforeInput = await page.evaluate(() => JSON.stringify(window.__study.state()));
      const url = page.url();
      for (const key of ['Space', 'p', 'r', 'f', 'Escape', 'ArrowLeft', 'ArrowRight']) await page.keyboard.press(key);
      const canvasBox = await page.locator('canvas').boundingBox();
      // Click the rendered court as a user would. The scorebug intentionally
      // overlays its corner; locator actionability is not a gameplay contract.
      await page.mouse.click(canvasBox.x + canvasBox.width * .5, canvasBox.y + canvasBox.height * .5);
      const afterInput = await page.evaluate(() => JSON.stringify(window.__study.state()));
      check(beforeInput === afterInput && page.url() === url && !(await page.evaluate(() => !!document.fullscreenElement)), 'Input changes the view-only study', result.failures);
      await page.evaluate(() => window.advanceTime(1000));
      const advanced = await page.evaluate(() => window.__study.state());
      check(Math.abs(advanced.time - 8) < .02, `advanceTime(1000) has wrong time ${advanced.time}`, result.failures);
      result.errors = errors;
      check(errors.length === 0, errors.join('; '), result.failures);
    } catch (error) { result.failures.push(error.stack || error.message); }
    finally { await context.close(); }
    console.log(`${size.name}: ${result.failures.length ? 'FAIL' : 'PASS'} ${result.failures.join(' | ')}`);
  }
} catch (error) { report.failures.push(error.stack || error.message); }
finally {
  await browser.close();
  report.finished = new Date().toISOString();
  report.passed = !report.failures.length && report.views.length === layouts.length && report.views.every(v => !v.failures.length);
  await writeFile(path.join(options.out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`Report: ${path.join(options.out, 'report.json')}`);
  if (!report.passed) process.exitCode = 1;
}
