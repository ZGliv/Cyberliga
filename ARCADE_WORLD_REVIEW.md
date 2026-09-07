# Cyberliga arcade world — review and release handoff

This feature rebuilds the visible six-sport world around authored pixel athletes and a shared broadcast presentation. It runs the existing autonomous sport engines, with their real positions, identities, decisions, scores and outcomes. It is a local product/design proposal; production was not changed.

Preview: http://127.0.0.1:4188/world.html

Branch: `codex/arcade-sports-world`, based on canonical `81da1208210027f03e0e3580526748874509df0a`. Canonical checkout and port 4173 were not modified. No Release Manager task was available in the accessible task list, so this document carries the integration handoff; the delivery message supplies the feature commit SHA.

## What changed

- Home and League HQ share a paper/blue presentation with the same actual athlete sprites used during games. The interactive globe, game network, six leagues, 48 clubs, 416 athletes, 24 fixture slots, dossiers, roster files and history navigation remain.
- Soccer, football, basketball, hockey, baseball and combat now use a shared Canvas2D view over raw engine state. Motion uses continuous world positions, stable direction changes and action-dependent pixel poses. Phone portrait follows the active area; short landscape reserves space for athletes above the far sideline.
- Scoreboards and event captions update in the same accepted frame as the engine, including deterministic stepping. Global navigation remains Home/Leagues. Sport and club links change broadcasts; no gameplay, pause, restart or fullscreen controls are exposed.
- HQ `home`/`away` links now select the advertised canonical clubs. Numeric fixture routes remain. Soccer retains a matching UTC broadcast when available and treats a custom pairing as a local fixture. Sample/generated standings are labeled and invented live fixture score labels were removed.
- Basketball/hockey immediately enter the active feed instead of freezing behind a hidden old entrance card. Original match phases and probabilities remain.
- Hockey’s goalie release timer now runs before the carrier branch returns. The previous code could retain a covered puck indefinitely while the match clock ran. An isolated regression observed release after 0.70 seconds with existing hold duration and release logic.
- Baseball contact now starts the outgoing ball at the actual incoming pitch point. The previously selected landing target and flight duration are retained. The bat reaches that recorded contact point at the event; catcher posture is distinct. Seven contact families retained RNG state, contact tick, selected outcome/quality/catch/chaser decisions, landing point and duration.

## Validation

- `npm run verify` passed, including the existing test suites and 1,564 repository checks.
- `node --test footballbrain.test.mjs footballrules.test.mjs` passed all 28 tests.
- Official web-game client ran for Home, League HQ and all six arenas, with screenshots and text state inspected. Post-fix baseball/combat captures and contact regression are recorded in `arcade-review/`.
- Independent browser review covered 1280×900, 390×844 and 844×390: no horizontal overflow, finite state and no console/page/request errors in the completed matrices. Home filters returned 24 games for All and four per sport; each HQ returned eight clubs/four channels. Actual pair/numeric route selection and time-stepping hooks were exercised.
- Final short-landscape basketball/hockey review sampled 120 frames each with no clipped athlete bounds. Natural traces included basketball scores and varied possessions; hockey goals, saves, passes, faceoffs, checks and recovery. Five-second local desktop samples rendered once per animation callback after deduplication. These are desktop Chromium measurements, not physical-phone benchmarks.
- `scripts/verify-arcade.mjs` passed all six sports, covering ordered fixture selection, visible navigation, authoritative HUD/event agreement, finite state, portrait layout and goalie release. Use `PLAYWRIGHT_MODULE` if Playwright is supplied by an external local runtime; `ARCADE_PREVIEW_URL` defaults to port 4188. `ARCADE_SPORTS` can select a comma-separated subset when diagnosing a failure. `scripts/verify-arcade-contact.mjs` preserves the seven-family baseball contact regression with pre-fix expectations.
- Some late browser launches timed out under concurrent browser load. Diagnostics also found the official capture client was choosing the hidden old canvas before the first manual frame, then waiting for a visibility timeout. Initial paint and resize cleanup now keep capture selection on the new stage. Unused legacy GPU draws are suppressed from renderer construction onward, while world-matrix updates remain. The final complete integration run passed after these corrections, with a 60-second startup allowance.

Local evidence is intentionally excluded from deployment: `output/arcade-review/` contains curated World/HQ screenshots and layout results; `output/arcade-integration/` contains the integration report and screenshots; `arcade-review/` contains the independent game traces, contact comparisons, official-client outputs and motion recordings.

## Practical limits and release decision

This intentionally changes the visible capsule art contract to pixel characters while retaining cyan/hot-pink side recognition and canonical club accents. Integration must adopt that new visual direction explicitly in the canonical release contract. The static verifier's three art/metadata assertions were updated to verify canonical schedule content and actual shared sprite identity; functional checks were retained.

The old Three.js scenes and compatibility rigs still initialize internally because their updates participate in engine timing, facing and contact transforms. Legacy GPU submissions are suppressed from construction, and duplicate composer submissions are deduplicated. A production implementation should separate simulation from those legacy scene constructors and measure real iOS/Android startup, heat and sustained frame delivery; those hardware measurements were not performed here.

Pixel poses are schematic. Dense screens can overlap; baseball's wide field view has small athletes; torso rotation and equipment gestures are not bespoke character animation. The test results establish a functioning, more coherent presentation, not that people will want to watch or wager on it. Audience watch tests and a dedicated animation pass remain the next product decision.

This branch does not add payments, odds, wagering, an operator integration, certification or a continuously authoritative server simulation of all 24 fixtures. Those remain separate work. No deployment, push or production release was performed.

## Changed-file groups

- Shared view: `arcade-broadcast.js`, `arcade-broadcast.css`.
- Six engine adapters and bounded fixes: `index.html`, `football.html`, `football.js`, `hoops.html`, `hockey.html`, `baseball.html`, `fight.html`.
- World/HQ: `world.html`, `league.html`, `league-page.js`, `arcade-world.js`, `arcade-world.css`.
- Verification/work record: `scripts/verify-arcade.mjs`, `scripts/verify-arcade-contact.mjs`, `scripts/verify.mjs`, `.gitignore`, `progress.md`, `ARCADE_WORLD_BRIEF.md`, this review.

Release Manager should review the intentional art direction and the two game fixes, integrate compatible work, and run the full canonical release gate before restarting port 4173 or deploying.
