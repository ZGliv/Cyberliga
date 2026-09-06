Original prompt: Go ahead — build the small autonomous motion prototype proposed in the Cyberliga redesign discussion: six representative characters, one ball, a plain court, readable mobile camera, actual passes and defensive responses with multiple outcomes.

## Scope
- Fresh branch codex/court-motion-prototype from canonical 81da120. Experimental entry point only; no canonical arena, navigation, product data, release target, or production changes.
- Compact handball-inspired three versus three. This is a motion/gameplay experiment, not a finalized sport or wagering engine.
- Geometry is authored procedurally. The earlier generated cast images are visual references, not rigged production assets or footage of this prototype.
- Apply develop-web-game skill. No gameplay or fullscreen controls because the user requires autonomous, view-only broadcasts.

## Work in progress
- Pure seeded simulation delegated to architecture_audit; renderer/UI owned by root; independent browser QA harness delegated to commercial_benchmarks.
- No content expansion, learned-policy claim, video-stream backend, real-money functionality, or deployment in this scope.

## Completed
- Implemented the isolated view-only entry point, warm procedural court, six articulated animal silhouettes, scoreboard, possession/event readouts and responsive portrait/landscape cameras.
- Added seeded autonomous passing/shooting/defending, actual flight and geometric scoring, live blocks/interceptions/recoveries and nonteleporting restarts.
- First browser pass exposed a graphics context loss during overlapping headless/video runs; optimized static geometry batching, test-step GPU submission and pixel ratio, and added context restoration. Verified recovery with an intentional context loss.
- Visual QA prompted a darker outlined ball, stronger separation, visible throwing gathers, better short-landscape framing and explicit pickup crouches.
- Independent review caught render-rate-dependent gait and frozen-resize labels. Fixed-tick pose caching/interpolation now agrees at 30/60/120 display rates; camera/labels redraw on resize without changing sporting state.
- Ten simulation/animation tests pass, including five ten-minute sporting soaks. Required official client screenshots/state inspected. Final visible-browser checks and continuous recordings pass at 390×844, 844×390 and 1280×900 with no normal-run errors or warnings.
- Saved the uncut portrait recording in review/portrait-demo.mp4. QA.md records measurements, earlier failed evidence, remaining contact/motion limitations and lack of physical-mobile testing.
- Preview runs on port4186 from this worktree. Canonical worktree remains clean on81da120; no deployment, package/shared-file changes, or port4173 restart.

## Next decision
- User should judge the actual exchange: ball legibility, movement quality, individuality and desire to keep watching. Do not expand the league or treat the experimental sport as accepted merely because engineering checks pass.
- If accepted, refine match rhythm and production-quality character/animation assets; then run sustained physical-device testing. The official hosted match/streaming/league platform remains separate future work.
