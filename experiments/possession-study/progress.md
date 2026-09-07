Original prompt: Okay, go ahead — build one excellent 15–20 second basketball possession, rendered in the actual game engine, as a visual/motion study. The user rejected the previous animal handball prototype as glitchy and not engaging. The proposed study may be scripted initially and must demonstrate readable setup, defensive response, convincing physical action and a satisfying finish.

## Scope
- Fresh isolated branch codex/basketball-possession-study from canonical 81da120. Only experiments/possession-study files; no canonical product edits, integration or deployment.
- An explicitly choreographed, looping 3v3 basketball possession. This establishes a visual target, not evidence of autonomous decision making or wagering readiness.
- Art direction: stylized athletes, athletic proportions and recognizable silhouettes, a warm hardwood arena under broadcast lighting, a clear pick-and-roll leading to an alley-oop.
- View-only. Automatic presentation; no gameplay, pause, restart or fullscreen input.
- Use develop-web-game verification, deterministic timing hooks, continuous motion capture and portrait/landscape/desktop inspection.

## Work
- Root owns character rigs, camera, broadcast UI and integration.
- Bounded subtasks: analytic choreography; arena environment; independent animation/browser QA.

## Completed implementation
- New warm-maple arena, six stylized athletic human rigs with kit numbers and recognizable silhouettes, a choreographed pick-and-roll/lob/dunk/landing, adaptive camera and restrained broadcast UI.
- World-space ball/palm contact, actual downward rim crossing and score timing, complete prerecorded footfalls, pure timeline-based rendering and QA seek hooks. No runtime asset downloads.
- Independent actual-rig review found and prompted fixes for the contest landing reset, abrupt screen/celebration arms and a gather elbow pole singularity. Added complete footflight tracks and continuous arm weights, and changed the IK pole.
- Visual inspection prompted readable jersey decals, a portrait opening-camera shift to include corner players, a visible late defensive contest and teammate reactions. HUD result opacity follows the same timeline as the renderer.
- Eleven targeted timeline/actual-rig tests pass. Three-layout browser checks and a fresh continuous recording pass; inspected setup, catch, dunk and landing images. Final official client advanced through the full possession to13.224s, produced the correct24–23 result and was visually inspected with no errors. Saved the25.44s uncut recording as review/possession-demo.mp4.
- Preview server stopped responding during QA; restarted only the feature port4187 and reverified with agent-browser. Canonical branch, files, port4173 and production remain unchanged.

## Product limits / next decision
- This is explicitly a scripted single possession. It establishes one possible visual/motion direction; it is not evidence that autonomous players can reproduce the same quality or that viewers would wager on it.
- Residual short fast-running foot support and fast gather elbow motion are documented in QA. Physical phones and long-duration runtime performance have not been measured.
- The user should judge the actual motion. Any continuation toward a league would first need autonomous possessions reaching this standard across varied outcomes.
