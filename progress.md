Original prompt: Can you make boxing work way better? Make the actual fighting and animations and shit way better, you might need to make the characters better too /goal

## Notes
- Focus scope: `fight.html`; avoid shared rig changes unless absolutely necessary so soccer/baseball/hoops/hockey are not disturbed.
- Current fight page already has strike types, arms, guard/stamina, knockdowns, ref, camera, and hit FX. Main quality gaps are visual boxing read: stance, glove paths, body selling, defensive movement, contact timing, and testing hooks.

## TODO
- Added deterministic `window.render_game_to_text` and `window.advanceTime(ms)` hooks for automated browser/game testing.
- Added boxer visuals with shoulders, trunks, belt, feet, glove detail, torso folding, and stance animation in the page-local fight rig.
- Added body shots, feints, lower-shell block logic, range falloff, body/head hit reactions, better combo queues, and tighter pocket separation.
- Verified hook-based gameplay in `/tmp/cyberliga-boxing-run`: live fight reached jabs/hooks/hits with HP/stamina/guard changes and no app error files.
- Verified desktop and mobile fast-forward screenshots with temporary Playwright. Only warnings were headless WebGL `ReadPixels` screenshot-performance messages.
- Fixed desktop Fight Night top HUD overlap at 1280px by hiding the exhibition pill before it collides with the round clock.

## Remaining
- Final `git diff --check` passed.
- Browser smoke reload passed with clean console logs.
- Production deployment succeeded and was aliased to `https://cyberliga-ten.vercel.app`.

## Baseball Pass
- Scope: `baseball.html`; make the game read better on mobile and add an obvious crowd/stadium atmosphere.
- Starting point: the page already has a working Three.js field, basic crowd texture, ball physics, announcer ticker, score HUD, and hidden `_dbg/_ff` helpers.
- Gaps to close: crowd is too flat/subtle, play outcomes need clearer visual targets, and browser/game test hooks should match the other improved pages.
- Added layered outfield/home stands, brighter crowd textures, 370 animated spectator sprites, reactive crowd surges, and visible rail/roof stadium depth.
- Added landing and fielder rings so live balls, throws, and fielding assignments read clearly on mobile.
- Added `window.render_game_to_text()` and `window.advanceTime(ms)` hooks, plus richer `_dbg()` state for automated sim checks.
- Tuned contact quality so grounders, flies, liners, and homers are tied to pitch/contact outcome instead of being flat random picks.
- Verified desktop and 390x844 mobile Browser screenshots; mobile top HUD, back button, scoreboard, count bar, sound prompt, and ticker all fit.
- Verified automated Playwright run through live ball, side changes, pitch/resolve states, and a full completed game with only headless WebGL screenshot readback warnings.

## Baseball Perfecting Pass
- Scope: continue `baseball.html` only; raise baseball-specific quality beyond first crowd/mobile pass.
- Changed baseball page club names from soccer-leaning labels to `NEON NINES` and `VOLT BATTERY`.
- Added ball ground shadow, contact flash, and swing arc so pitch/hit depth and bat impact read better.
- Tuned pitch/contact model for more balls in play, contact quality-based route pressure, catchability, infield misplays, and runner path speeds.
- Added extra-innings runner-on-second behavior and a max-inning swing-off fallback so deadlocked games do not silently feel flat.
- First tuning overshot offense; corrected homer/contact/catchability rates after a 14-1 long sim exposed arcade scoring.
- Balanced long sim completed games at 6-3 and 3-1, with extra-base threats, ground-ball throws, finals, and no app errors.
- Browser desktop and 390x844 mobile QA passed; sound prompt tap hides the prompt and mobile HUD elements fit.

## Autonomous City League Pass
- Scope: replace click-to-start fixtures with one canonical, continuously running city league; remove the country/nation competition layer from the globe and broadcast.
- Added a deterministic match simulator, persistent SQLite fixture/standings store, restart-safe scheduler, and read-only live-state API.
- Added 24 city clubs in one double round-robin major league (552 fixtures), with 12 matches playing simultaneously each round.
- Added `live.html`, an autonomous Three.js broadcast with reactive crowd, interpolated server snapshots, a live match centre, score/clock/events, sound, fullscreen, and city-club deep links.
- Refactored `world.html` to a city-only globe and removed country aggregation, country boundary rendering, and nation navigation.
- Added `window.render_game_to_text()` and `window.advanceTime(ms)` hooks for deterministic spectator/gameplay testing.
- Unit/service verification: 10 tests pass, including 1,000 simulated fixtures, two-spectator canonical state, transactional finalization, and restart persistence.

## Autonomous City League TODO
- Visual QA passed for the live stadium, reactive crowd, open 12-match drawer, city globe, and an in-progress switch from Singapore–Tokyo to Sydney–Seoul; no browser console errors were recorded.
- Restart proof passed mid-match: Singapore–Tokyo kept the same fixture ID, kickoff, and 0–2 score while its clock advanced from minute 46 to minute 50 after the process restarted.
- Two requests pinned to the same authoritative timestamp returned byte-equivalent match state.
- Production hosting needs a durable database/runtime; the current autonomous service is intentionally local and restart-safe rather than a static Vercel export.
