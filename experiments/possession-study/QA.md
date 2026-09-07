# Possession study — independent QA

Verified 2026-09-07 at `http://127.0.0.1:4187/experiments/possession-study/index.html` in the isolated basketball-possession-study worktree. This is a **20-second choreographed possession with zero autonomous decision-making**. These checks do not establish a playable game, an AI league, real mobile performance, or wagering readiness.

## Result

The final independent browser run passed at desktop 1280×900, portrait 390×844, and landscape 844×390. All four actual-rig regression tests passed. No browser console, page, failed-request, or HTTP errors were recorded. The canonical six-sport application was not changed or deployed by this QA task.

The browser run checks the complete scripted sequence at 30 Hz using actual rendered world matrices, score timing, the fade at the loop boundary, finite state, floor bounds, viewport overflow, absent gameplay controls, ignored keyboard/click input, and deterministic `advanceTime`. Nine event screenshots per layout cover 0, 4, 7, 10, 11.5, 12.4, 12.72, 14, and 17 seconds. The blank time-zero screenshot is the intended full fade, not a missing court.

The supplementary live recording runs uninterrupted for 24 seconds after readiness, covering a full possession and the loop reset. This is separate from all deterministic seeking. The release owner also ran the official web-game client separately: its final780-frame input-free run reached13.224s, showed the24–23 score and landing/bounce, and produced no error artifact. Its screenshot was opened and visually inspected. Seven timeline tests plus four actual-rig tests pass (11 total).

The tracked `review/possession-demo.mp4` is the complete25.44s recording including startup, transcoded to H.264 without cuts, synthetic frames, compositing, sound additions or speed changes.

## Motion and contact evidence

The Node tests use real Three.js geometry and world transforms, with only canvas painting stubbed. They sample all six rigs over 20 seconds at 120 Hz, check the earlier failure windows at 1 kHz, and compare actual poses after 30/60/120 Hz histories and out-of-order seeks.

| Check | Final measurement |
| --- | --- |
| Largest foot movement over 1/60 second | 0.110 m, Brunt left foot at 2.475 s |
| Largest foot movement over 1/120 second | 0.055 m |
| Largest hand/elbow movement over 1/120 second | 0.100 m, Brunt left elbow during takeoff |
| Declared palm contacts checked | 240 palm samples |
| Worst palm-to-ball surface deviation | 0.008 m |
| Worst explicit hand target reach error | 0 m |
| Lowest shoe sole | +0.0091 m |
| Lowest ball centre | +0.123 m, equal to ball radius |
| Actual catch pose after different refresh histories | Identical |

A hand belongs on the ball surface: the approximately 0.115 m hand-to-centre distance is not a 0.115 m contact failure. Tests compare it with the ball's 0.123 m radius and separately check whether the IK solver reaches the requested target.

The initial independent scan found three substantial defects that the app owner corrected before the final run: a 0.941 m contest-landing foot snap; 0.26–0.28 m hand jumps at screen/celebration pose changes; and a 0.390 m gather elbow flip. The retained tests cover those landing, pose-boundary, and gather failure modes. The final gather elbow remains fast, but a 1 kHz scan shows a smooth speed increase and decrease rather than a pole flip or target discontinuity.

Score stays Pittsburgh 22–Oakland 23 before the descending ball crosses the rim at 12.72 s, then becomes 24–23. The fade hides the return to the initial possession and score.

## Visual judgment and remaining limits

I inspected all three event strips, the uninterrupted recording's full-sequence strip, a denser 10 fps gather-to-dunk strip, and full-size portrait/landscape catch frames. The screen, drive, lob, airborne catch, and finish are distinguishable. The ball, Brunt's hands, and rim remain inside all three cameras at the catch and rim-crossing beats. The final portrait overview includes all six players at 4 and 7 seconds; its later close-up intentionally crops the two weak-side players. The 7/44 jersey numbers are readable in the close-up, and the result graphic appears after the finish.

Two limitations remain visible or measurable:

- Fast running occasionally lifts both rendered soles slightly despite the timeline's jump being zero. There are 23 player-samples at 120 Hz with both soles above 0.08 m; the worst lower sole is 0.107 m at Hart 8.933 s. These are brief stride/leg-reach artifacts, not the earlier large landing teleport. More grounded strides would improve polish.
- The landscape overview makes athletes and the ball smaller than portrait's close-up. The dunk remains legible, but these screenshots do not establish sustained spectator appeal or readability on every physical handset. Hardware performance, battery use, touch browser chrome, and video smoothness on real phones remain untested.

The study demonstrates a coherent authored basketball moment. It does not demonstrate emergent tactics, believable unscripted collisions, reliable arbitrary possessions, or a whole season of compelling games.

## Reproduce and inspect

Run from this worktree, with the preview already running:

```sh
node --test experiments/possession-study/qa/rig-check.test.mjs
node experiments/possession-study/qa/browser-check.mjs --url http://127.0.0.1:4187/experiments/possession-study/index.html --headed --video --out experiments/possession-study/qa/output/final
```

Final artifacts are in the ignored `qa/output/final/` directory:

- `report.json`: all three viewport results, event states and actual joint metrics.
- `rig-diagnostics.json`: the dense 120 Hz maxima and brief unsupported stride samples.
- `desktop/continuous-possession.webm`: uninterrupted live recording.
- `desktop/live-motion-strip.png` and `desktop/dunk-contact-strip.png`: full-play and dense finish strips.
- `{desktop,portrait,landscape}/event-contact-strip.png`: nine event screenshots per layout.
- `{desktop,portrait,landscape}/motion-samples.json`: 600 rendered samples per layout.

Earlier `pass-1` artifacts are diagnostic history. A portrait locator click originally hit the overlaid scorebug, and the server temporarily stopped responding before landscape navigation. The final run uses a real coordinate click on the court and completed after the server was restored; it has no failures.
