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

## Canonical World Prototype — 2026-07-10
- Restored the globe concept as `world.html` and made it the Vercel root destination.
- Added `universe.js`: one UTC round clock, two simultaneous six-minute channels, fixed
  team/city identities, stable public match IDs, and seeded randomness.
- Soccer now joins the selected live fixture, fast-forwards from kickoff, advances at a
  fixed 30 Hz independent of renderer frame rate, holds the final result, and rolls into
  the next canonical round at the shared boundary.
- Added `render_game_to_text` and `advanceTime` hooks to soccer for deterministic QA.
- Added world and match mobile layouts, club/star dossiers, signal arcs, Twitter/X Open
  Graph metadata, and the first four marquee character/storyline briefs.
- Exact sync test passed: two isolated pages at timestamp 1783697192595 produced identical
  match ID, mode, score, clock, ball state, and all 14 player positions.
- Desktop and 390x844 world/match screenshots passed with zero console errors.
- GPT Image 2 generation attempted for Razor, Nova, Circuit, and Nebula. The API rejected
  all four before generation with `billing_hard_limit_reached`; prompts are preserved in
  `CAST_PROMPTS.jsonl`, and existing portraits remain the runtime fallback.
- Remaining production boundary: move simulation/events, persistence, results, chat, and
  audience presence to an authoritative realtime service before calling the league fully live.

## Multi-Sport World Reset — 2026-07-10
- Rejected the first public character direction and removed it from the world homepage,
  soccer view controls, retired league-hub route, and social-card plan.
- Reframed the globe as the Cyberliga sports network: Global Premiership football,
  Skyline Circuit basketball, Polar League hockey, Night Diamond baseball, and The
  Undercard combat league across ten host cities.
- Soccer remains labeled `2 LIVE` because it is the synchronized canonical simulation;
  the other four are labeled `PLAYABLE` exhibition circuits until they adopt that clock.
- All arena back links and Escape behavior now return to the world map.
- The prior four-player GPT Image prompt batch was deleted. Fresh generated concepts are
  an off-product art-direction lab until the user explicitly approves a visual language.
