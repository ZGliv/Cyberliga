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

## Six-League 100x Expansion — 2026-07-10
- Current user goal: use parallel agents to expand every product workstream, add American
  football, and materially increase teams, characters, content, and sport quality.
- Split soccer from American football in the public information architecture. Soccer keeps
  the canonical live Global Premiership; American football is a distinct sixth league,
  Continental Crush, with its own arena route.
- Rebuilt the retired league route as a responsive league atlas designed for six sports,
  eight clubs per sport, six athletes per club, daily marquee matchups, deterministic
  fixtures, rivalry metadata, story headlines, and visibly varied procedural silhouettes.
- Expanded the world proof from five leagues / ten hosts to six leagues / 48 clubs / 288
  athletes and restored the atlas as a first-class route from the globe.
- Parallel work in progress: American football arena, reusable world content module, and
  basketball/hockey quality passes. Full browser verification follows integration.
- Added `worlddata.js` as the shared identity source: six sports, 48 unique clubs in 48
  cities, 288 named tactile athletes, reciprocal rivalries, deterministic 14-round
  seasons, marquee selections, headlines, and storyline helpers.
- Expanded canonical soccer to eight clubs, four simultaneous live channels, and 6v6
  open-field matches. The atlas rosters now feed the actual match names and colors.
- Re-ran the canonical sync gate with two independent browsers frozen at the same UTC
  instant: match ID, clock, score, ball, and all 12 player records were byte-identical.
- Added the American-football arena (`football.html`): 6v6 downs/quarters/OT, run and pass
  calls, catches, interceptions, tackles, punts, field goals, touchdowns, touch controls,
  full final/rotation flow, and eight shared-world clubs.
- Basketball and hockey now have steals/blocks and one-timers/breakaways respectively,
  complete match rotation, pause/rematch/fullscreen controls, eight shared-world clubs,
  and named athletes from the same atlas data.
- Added `social.html`, a responsive deterministic World Wire with six simultaneous desks,
  trending clubs, rivalry watch, athlete focus URLs, story sharing, and a shared UTC edition.
- Desktop and 390x844 mobile visual QA passed for the six-league globe, league atlas, World
  Wire, soccer, American football, basketball, and hockey with clean console output.
- Expanded baseball and combat to eight shared-world clubs and 56 rotating fixtures while
  preserving their new clip moments: grand slams/moonshots/wall robberies and guard
  breaks/counters/knockdowns/last stands. Both passed desktop/mobile QA after integration.
- Added `moment.html`, a deterministic 1080x1920 poster maker with canonical query URLs,
  six-sport art direction, athlete/headline/score inputs, PNG export, and direct World Wire
  story-to-poster flow.
- Replaced the temporary preview process with the dependency-free project server (`npm run
  dev`) and added `npm run verify` (652 current static/data/route/schedule checks).
- Added a GitHub Actions release gate and `ops.html`, an honest read-only world-control view
  covering canonical channels, rollover, content integrity, route latency, and the explicit
  server-authority/persistence/presence gaps that remain after this expansion.

## Production Data / Virality / Character Boundary — 2026-07-10
- Added a CLI-generated Supabase migration for seasons, teams, athletes, fixtures, matches,
  ordered events, standings, media, presence aggregates, and worker health. Every exposed
  table has explicit read-only RLS; service writes and `canonical_apply_tick` are isolated.
- Added deterministic six-sport `/api/live` and `/api/league` fallbacks, browser-safe
  `/api/config`, secret-protected `/api/tick`, project-server API dispatch, and eight Node API
  tests. A disposable Postgres run proved retry idempotency and denied anonymous writes/RPC.
- Added privacy-safe match-scoped realtime presence with reconnect/backoff and honest
  `1 WATCHING · LOCAL` fallback across the world, live soccer, World Wire, Moment Maker,
  and Clip Director. No Supabase secret can enter the browser client.
- Added `clip.html`: deterministic 12-second 9:16 animation for all six sports, permanent
  story parameters, scrubbing/fullscreen, and real VP9/VP8 WebM export. World Wire and
  Moment Maker now hand the exact story state into the Clip Director.
- Added `characterlab.html` + `characterlab.js`: 12 marquee athletes, 12 distinct tactile
  body families/signature motions, match/portrait/clip contexts, deterministic URLs, and
  explicit gifts/flaws/rivalries. This remains an art-direction gate, not the live renderer.
- Rebuilt `blobrig.js` motion language with planted cuts, acceleration/braking, authored
  anticipation-contact-follow-through, four celebration rhythms, emotional reactions, and
  expanded goalkeeper behavior while preserving deterministic match state.
- Upgraded operations to probe the real API/data plane and distinguish canonical Supabase
  from deterministic fallback. CI now tests APIs and smoke-tests media/character routes.
- Verification checkpoint: 8 API tests and 747 static/data/route/RLS/media invariants pass;
  Character Lab and Clip Director passed desktop and 390x844 visual/console checks.
- External boundary: no dedicated Cyberliga Supabase project has been provisioned. The only
  visible project belongs to Parl.ai and was deliberately left untouched. Production stays
  explicitly in deterministic fallback until the target organization and cost are confirmed.
- American football checkpoint: deterministic play/outcome RNG, pre-snap formations and
  coverage reads, route/catch geometry, pocket pressure, three-beat tackles, reactive crowd/
  lights/audio, overtime/final flow, and mobile controls passed full-game and sync tests.
- Hockey checkpoint: authored pass/shot/one-timer timing, brace/contact/recovery checks,
  differentiated covers/rebounds, readable puck trail/locator, reactive camera/crowd/audio,
  and a 400-second full-game/rotation soak passed with zero console errors.
- Next active passes: football 11v11/player-count rebuild, basketball playbooks/schemes,
  then navigation/crowd/remaining-sport rotation.
