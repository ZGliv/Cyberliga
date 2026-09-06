# Motion study verification — 2026-09-06

## Shaking correction after user review

The user correctly identified visibly unstable movement despite the initial frame-rate/replay checks. New diagnostics found actual pose discontinuities: cancelling a foot swing could move a foot 0.77 m in one tick, receiving hands changed targets abruptly at a two-metre cutoff, and shot contact could reset the jump timer at its apex. Steering and facing also repeatedly reversed small corrections.

The correction commits movement/avoidance intentions briefly, damps linear and angular acceleration, keeps defenders facing the play, finishes foot steps independently of speed, gives jumps their own continuous arc, blends arm poses and stabilizes knees/elbows through folded poses. Name labels also ease into new positions.

Matching 120-second seed-7 diagnostic runs at 60 Hz:

| Maximum single-tick displacement | Initial | Corrected |
| --- | ---: | ---: |
| Foot, world space | 0.774 m | 0.110 m |
| Hand, body space | 1.261 m | 0.133 m |
| Knee, body space | 0.739 m | 0.120 m |
| Elbow, body space | 0.743 m | 0.112 m |
| Torso translation | 0.191 m | 0.120 m |

None of those corrected pose categories has a displacement above 0.15 m in that run. The simulation's rapid heading reversals fall from 414 to 56 while total athlete travel changes by only 3.5%. These measurements support the specific jitter repair; they are not a claim of finished animation quality.

The required official client was rerun and its screenshots inspected. A new 30-second continuous portrait recording and the full portrait/landscape/desktop browser checks pass, including input immunity, resize, finite state, and zero page/console/request/HTTP/graphics errors or warnings. The user's existing in-app tab was reloaded with the correction. `qa/output/smoothing/`, `qa/output/smoothing-final/`, and `qa/output/smoothing-official/` contain current evidence. `review/portrait-demo.mp4` now contains the corrected recording.

Current regression coverage includes stable sidesteps, bounded acceleration/rapid turns, interrupted foot steps, the receiving reach threshold, jump-timer resets, deterministic replay, and pose equality across display rates. `qa/motion-check.mjs --ref=1748fc8` reproduces the initial motion diagnostic; `--ref=working` checks the current code. A ten-minute numerical motion soak was also inspected while refining the repair.

The current 120-second held-ball diagnostic remains finite with three isolated first-recovery ticks above its 0.27 m hand-centre threshold (worst 0.341 m), each lasting one tick. Catches and contact still merit production animation work. Physical-phone testing remains outstanding.

## Initial prototype verification at 1748fc8

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
- `review/portrait-demo.mp4`: tracked continuous portrait recording, updated after the shaking correction. Encoded from the browser recording without cuts, compositing, speed changes or generated footage. The initial commit retains the earlier recording for comparison.

## Remaining judgment and engineering

The procedural models are a rough runtime interpretation of the earlier character art. Close passes, pickup transitions, foot turns and landscape character scale still deserve subjective review. The sport has not been audience-tested, balanced for a season or proven commercially compelling. No physical iOS/Android device or mobile Safari testing has been performed.

No canonical arena, world, league, package, navigation or verifier file changed. The feature worktree is separate and the preview serves from that worktree on port 4186. Port 4173 and production were not changed. The full six-sport deployment gate was not run because this is an isolated, undeployed experiment; it remains mandatory before any future canonical release.
