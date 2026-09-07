# Above the rim

A 20-second **choreographed basketball possession** rendered live in Three.js. It is a visual and animation study: its outcome and player decisions are authored, and it does not establish autonomous sporting behavior.

This is the new direction authorized after the user rejected the preceding animal/handball motion prototype. All changes live in this experiment directory on `codex/basketball-possession-study`, created from canonical `81da120`. The canonical six-sport application is unchanged.

## View

From this worktree:

```sh
PORT=4187 node server.mjs
```

Open http://127.0.0.1:4187/experiments/possession-study/index.html. The scene plays and loops automatically, with no gameplay or playback controls. Portrait has an adapted opening camera; the camera moves toward the catch and landing as the play develops. Backgrounded tabs suspend this local presentation.

`review/possession-demo.mp4` is an uncut browser recording, transcoded from the QA WebM. It includes a complete possession and loop. It is actual runtime footage; no generated images, compositing, interpolated frames or speed changes are used.

## What the viewer should be able to read

1. Hart dribbles while Brunt approaches and plants a screen.
2. Hart crosses and drives around the screen. Reed follows; Toll leaves the rim to help.
3. Brunt rolls behind the help. Hart gathers and throws a lob.
4. Brunt jumps, meets the ball with both palms, drives it down through the rim, lands and reacts.

Lob release11.50s; takeoff11.96s; catch12.40s; dunk release12.68s; downward rim crossing12.72s; landing13.08s. The score changes22–23→24–23 on the crossing. The final fade conceals the deliberate reset.

## Implementation

- `timeline.js`: stateless Hermite paths, body and arm intent, dribble/release/flight/catch contacts, score and loop timing.
- `athletes.js`: six authored stylized human athletes with kit numbers, scaled anatomy, world-space footfalls and elbow/knee IK. The complete footfall track is calculated once; rendering never replans a half-finished step.
- `arena.js`: procedural maple, paint, hoop, glass backboard, net and instanced crowd. These are original procedural assets, not claimed AI-generated or imported professional character assets.
- `main.js`: camera direction, ball rendering, deterministic time hooks, HUD, metrics and context recovery.

No external asset downloads, package changes or remote runtime dependencies were added. The existing vendored Three.js license applies to the engine. The fictional cast and club treatments here are experiment concepts, not changes to the canonical club database.

## Check

```sh
node --test experiments/possession-study/timeline.test.mjs experiments/possession-study/qa/rig-check.test.mjs
node /Users/Test/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:4187/experiments/possession-study/index.html --actions-json '{"steps":[{"buttons":[],"frames":780}]}' --iterations 1 --pause-ms 200 --headless false --screenshot-dir experiments/possession-study/qa/output/official-final
node experiments/possession-study/qa/browser-check.mjs --url http://127.0.0.1:4187/experiments/possession-study/index.html --headed --video --out experiments/possession-study/qa/output/final
```

`window.advanceTime(ms)` switches to manual time. `window.__study.seek(seconds)` can reproduce any point in the sequence; `metrics()` reports actual rendered palms, knees, elbows and feet. These are inspection hooks, not public controls. `render_game_to_text()` explicitly identifies the sequence as choreographed and nonautonomous.

See `QA.md` for actual checks and remaining limits. Viewer interest and the quality needed for an eventual autonomous league remain product questions; passing geometry checks does not answer them.
