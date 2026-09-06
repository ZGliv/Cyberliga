# Court motion browser QA

Run this supplementary check after the local prototype server is ready:

```sh
node experiments/court-motion/qa/browser-check.mjs
```

Capture a continuous, real-time review video for each viewport:

```sh
node experiments/court-motion/qa/browser-check.mjs --video --video-seconds 20
```

The default URL is `http://127.0.0.1:4186/experiments/court-motion/index.html`. Use `--url URL`, `--out DIRECTORY`, or `--headed` to override. The script imports the already-installed Playwright runtime by its absolute local path. It does not start a server or change the application.

Use `--view portrait`, `--view landscape`, or `--view desktop` to limit live captures to one viewport. For example, `--headed --video --view portrait` captures one headed portrait video. Use `--hooks-only` to rerun just the input, orientation, and deterministic-time checks after a focused fix.

Outputs go to this folder's `output/` directory, which is covered by the repository's `output/` ignore rule. Each of the 390×844, 844×390, and 1280×900 viewport cases produces a screenshot, exported state, and five-second live requestAnimationFrame measurement. `--video` additionally saves a `.webm` per viewport. Browser/network errors and validation results are in `report.json`; failures set a nonzero process exit code.

Checks cover the broadcast metadata (`autonomous:true`, `interaction:"view-only"`), numeric state exposed by `render_game_to_text`, one visible canvas, DOM label bounds, horizontal overflow, absence of visible controls, and console/page/request/HTTP errors. A separate case exercises live keyboard/pointer input, then uses `advanceTime(0)` to freeze the simulation and compare exact state before/after keyboard/pointer input and portrait/landscape resizing. `advanceTime(1000)` must subsequently advance approximately one second. These operations occur outside the continuous review videos. Simulation time is expected in seconds at `state.time`, `state.simulation.time`, or `state.sim.time`.

The optional `window.__courtMotionQA.renderFrames` counter supplies actual application draw counts. Without it, callback cadence is reported without claiming renderer throughput. All runs use desktop Chromium at resized CSS viewports and device scale 1. They do not establish physical phone performance, battery/thermal behavior, or touch-browser compatibility.

WebGL context-loss events are captured before application code loads and fail the run even if the context later recovers. A visible `#loading` error/loading overlay also fails. Context-loss messages at any console severity count as graphics failures; other warnings remain available for review. Run this check sequentially with other browser QA to avoid competing GPU load.

Open and inspect the screenshots and motion videos. The geometry check covers DOM text, not labels drawn inside the canvas; it cannot judge ball visibility, actor overlap, foot sliding, camera occlusion, or whether a possession makes sense. The official web-game client and the simulation's independent tests remain required.
