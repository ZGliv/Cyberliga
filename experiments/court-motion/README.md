# Cyberliga — court motion study 01

A separate, working experiment for the proposed Cyberliga overhaul. Six original animal athletes play a small autonomous passing sport on one court. This entry point is not linked from the canonical six-sport product.

```sh
PORT=4186 node server.mjs
```

Open <http://127.0.0.1:4186/experiments/court-motion/index.html>. Portrait is the primary view; landscape and desktop use a stable side camera. There are no gameplay, pause, restart, or fullscreen controls.

## What to judge

Watch an entire attack and the response after it. Can you locate the ball, understand why a pass or shot succeeds, distinguish the six athletes, and follow the change in possession? Does the next exchange hold your attention? A smooth renderer alone does not answer whether this sport will be worth watching for a season.

## Experiment rules

- Three versus three; either end has one goal. Pittsburgh attacks the negative-z end, Oakland the positive-z end.
- Carry for up to three seconds; pass to another athlete or shoot. Twelve-second team possession clock.
- A ball crossing the goal opening scores one point. There is no permanent goalkeeper or body tackling.
- Defenders can intercept passes and block shots. Misses and loose balls remain live against rebound boundaries.
- Goals and violations lead to a short restart with physical ball retrieval. Players and ball are not reset to predetermined coordinates.
- The clock shows elapsed exhibition time. This motion study continues indefinitely; finalized match length, full competition rules, and league scheduling are outside this experiment.

## Implementation

`sim.js` runs at 60 fixed ticks per second, independently of Three.js and the camera. Seeded, authored decision policies choose carries, passes and shots using available space, pressure, teammate positions and trajectory geometry. Scoring comes from ball crossings, not a preselected winner or scoring timeline. Randomness is isolated from rendering. These are game AI policies, not trained neural-network agents.

`rigs.js` builds articulated, faceted character models with jerseys, species cues, two-bone limbs, foot planting, throwing gathers and pickup crouches. These are procedurally authored runtime models. They are not generated meshes or finished production translations of the earlier concept images. The reference cast is Latch, Brunt, Zip, Nix, Toll and Sable, with proposed Kiln and Switch identities from the separate design package.

`main.js` advances sporting state and rig poses at fixed intervals, then interpolates poses for display. It adapts the camera without changing sporting state, shows the current possession and recent event, and provides deterministic test hooks. Static character pieces are combined within each articulated part to reduce drawing overhead. Graphics-context recovery restores the view automatically.

## Verification

```sh
node --test experiments/court-motion/sim.test.mjs
node /Users/Test/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js \
  --url http://127.0.0.1:4186/experiments/court-motion/index.html \
  --actions-json '{"steps":[{"buttons":[],"frames":120}]}' \
  --iterations 3 --screenshot-dir experiments/court-motion/qa/output/official
node experiments/court-motion/qa/browser-check.mjs --headed
```

`?seed=8` selects a different repeatable local contest. `window.advanceTime(ms)` switches the page into deterministic test stepping; it is a developer hook, not a viewer control. `window.render_game_to_text()` returns the simulation snapshot. `window.__courtMotionQA` exposes renderer diagnostics and the current fixed-tick poses.

See `QA.md` for recorded results and practical limits. QA images, reports and videos live in the ignored `qa/output/` directory. The test harness uses the installed workspace Playwright path; another machine must update that import or supply its own local dependency.

## Boundaries and next decision

This is a local simulation. Two viewers do not join a shared official fixture, and refreshing starts the selected seed again. There is no authoritative hosted match worker, streaming service, persistent career history, odds feed, betting, settlement, certification, audio mix, or production deployment. Existing Cyberliga release files and product invariants remain intact.

Collision avoidance is steering, not a full contact solver. Close approaches and rough animation transitions still need visual evaluation. The models demonstrate silhouettes and motion; expressive faces, polished hands, tuned animation clips, camera direction and a production asset pipeline remain substantial work.

The next product decision is whether this passing game produces enough readable decisions and memorable individual actions to pursue. If it does, refine one complete short match and commission or build a small production-quality character set before expanding teams, venues or league systems.
