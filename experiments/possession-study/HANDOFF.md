# Experimental handoff — do not release

Branch: `codex/basketball-possession-study`.

Base: canonical `81da1208210027f03e0e3580526748874509df0a`.

This branch adds only `experiments/possession-study/`. It contains an explicitly choreographed 20-second basketball possession authorized as a visual proof after rejection of the earlier court-motion direction. It is not proposed as a canonical arena replacement, autonomous match engine or production release.

Changed files: `CONTRACT.md`, `HANDOFF.md`, `QA.md`, `README.md`, `arena.js`, `athletes.js`, `index.html`, `main.js`, `progress.md`, `style.css`, `timeline.js`, `timeline.test.mjs`, `qa/browser-check.mjs`, `qa/rig-check.test.mjs`, and `review/possession-demo.mp4` (all under `experiments/possession-study/`).

The feature commit can be resolved with `git log -1 --format=%H codex/basketball-possession-study`. Final response records the commit ID. No Release Manager task was present in the accessible pinned/recent50 task listing; this document preserves a reviewable handoff without starting another task or integrating the experiment.

Validation: targeted timeline and actual-rig tests, official web-game client, independent three-layout browser checks and continuous runtime recording; details in `QA.md`. Full six-sport production gates are not applicable to this undeployed experiment and have not been represented as run.

Preview: http://127.0.0.1:4187/experiments/possession-study/index.html served from this feature worktree. Canonical port4173 and production are untouched.
