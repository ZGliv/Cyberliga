# Motion study verification — 2026-09-06

## Result

The scoped motion prototype passes its simulation, fixed-pose and browser checks. It is ready for visual/product review, not production release or wagering use.

## Simulation and animation

- `node --test experiments/court-motion/sim.test.mjs experiments/court-motion/qa/pose-check.mjs`: **10/10 pass**.
- Five ten-minute headless sporting runs remain finite, bounded and active. Every athlete contributes; goals, misses, interceptions, blocks and recoveries occur. Player movement remains continuous, and scoring agrees with actual goal events.
- Identical seeds and elapsed fixed ticks give identical sporting snapshots, including after serialization/restoration.
- A 75-second comparison of the actual main-loop code under stubbed browser I/O gives identical fixed-tick poses and sporting state at 30, 60 and 120 display updates per second. Manual advancement matches the same elapsed live ticks.
- `node experiments/court-motion/qa/rig-check.mjs`: all 1,634,400 inspected transform samples are finite in the 120-second seed-7 run. Pickup crouching reduced held-ball/nearest-hand centre distances above the diagnostic 0.27 m threshold from 28 ticks to one. The remaining single tick is 0.286 m during Brunt's low recovery at 59.7167 seconds. This is a geometric diagnostic, not a claim of perfect hand contact or polished animation.

## Browser evidence

The required official web-game client ran after meaningful revisions. Final screenshots and exported state cover 2.07, 4.07 and 6.07 seconds: possession, receipt, goal and recovery. Screenshots were opened and inspected; no browser-error artifacts were produced.

Final supplementary checks used visible Chromium windows at 390×844, 844×390 and 1280×900. Each case included approximately 20 seconds of continuously rendered play and an uncut recording. All cases pass:

- One visible canvas, finite exported state and no horizontal overflow.
- In-bounds scoreboard, labels and canvas; six distinguishable athlete silhouettes.
- No visible gameplay controls. Keyboard/pointer input does not mutate a frozen sporting snapshot or enter fullscreen.
- Orientation changes preserve the sporting snapshot and reposition the camera and labels, including in deterministic test mode.
- `advanceTime(1000)` advances one second.
- No page, console, request, HTTP, graphics-context or warning entries in the final run.

During each five-second cadence sample, the renderer submitted 601 draws of the complete scene: roughly 120 scene renders per second on this desktop's visible-browser configuration. The 95th-percentile RAF interval was approximately 10.0–10.2 ms. The sporting engine and rig poses still advance at 60 Hz. These short measurements are **not physical-phone benchmarks**, GPU timings, or a promise of sustained performance on other hardware.

Earlier automated headless runs behaved differently: approximately 57/68/30 scene renders per second across the same three viewport sizes, and an initial overlapping video run lost its graphics context. This prompted batching static character geometry, avoiding redundant GPU draws during large test advances, lower pixel density and explicit recovery handling. The final visible-browser run is clean; the environment difference should not be concealed when planning physical-device testing.

A separate deliberate `WEBGL_lose_context` check verified that the restoration notice appears, the browser restores the scene automatically, the notice clears, and deterministic advancement remains valid afterward. Its restored screenshot was inspected. This expected forced interruption is recorded separately from the zero-error normal-play checks.

## Artifacts

- `qa/output/official-final/`: required-client screenshots and state.
- `qa/output/verified/`: final three-layout screenshots, continuous recordings, browser report and forced-recovery evidence.
- `review/portrait-demo.mp4`: tracked, continuous 21.6-second portrait recording of this version. Encoded from the browser recording without cuts, compositing, speed changes or generated footage.

## Remaining judgment and engineering

The procedural models are a rough runtime interpretation of the earlier character art. Close passes, pickup transitions, foot turns and landscape character scale still deserve subjective review. The sport has not been audience-tested, balanced for a season or proven commercially compelling. No physical iOS/Android device or mobile Safari testing has been performed.

No canonical arena, world, league, package, navigation or verifier file changed. The feature worktree is separate and the preview serves from that worktree on port 4186. Port 4173 and production were not changed. The full six-sport deployment gate was not run because this is an isolated, undeployed experiment; it remains mandatory before any future canonical release.
