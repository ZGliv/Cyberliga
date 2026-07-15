Original prompt: Can you make boxing work way better? Make the actual fighting and animations and shit way better, you might need to make the characters better too /goal

- Arena polish: hockey puck now renders true black with a separate cyan locator ring; hockey, hoops, and soccer arena return controls now read `GLOBE` and link back to the world view.
- Mobile camera pass: soccer uses an 11s overhead / 7s elevated end-zone rhythm and hockey uses 10s / 7s; goals, replays, and major hockey action hold the angle long enough to restore depth without camera rolls or roof fly-throughs. Portrait captures confirm both views at 390×844, desktop and phone-landscape remain on their authored broadcast paths, hockey restart clears any angle hold, and browser runs report no page errors.
- Corrected the hockey/hoops `GLOBE` links to use the watch-only exit exemption, so those top-left controls remain visible, focusable, and linked to `world.html` after the autonomous-broadcast guard initializes.

## Notes
- Focus scope: `fight.html`; avoid shared rig changes unless absolutely necessary so soccer/baseball/hoops/hockey are not disturbed.
- Current fight page already has strike types, arms, guard/stamina, knockdowns, ref, camera, and hit FX. Main quality gaps are visual boxing read: stance, glove paths, body selling, defensive movement, contact timing, and testing hooks.

## TODO
- Desktop globe hover targeting fix (2026-07-13): fixture cards no longer treat both team lines as the home city; physical pointer movement over the home/away row now targets that exact endpoint. Moving DOM city labels also require real pointer movement, so a label animated beneath a stationary cursor cannot steal an in-flight target.
- Hidden city labels now have `pointer-events:none` until visibly rendered. This removes stale invisible hitboxes that could intercept the desktop cursor and snap to a city on the opposite side of the world. Exact-target QA passes home→home and away→away, a stationary cursor holds one city for four seconds with no extra snap, and hidden/visible marker hitboxes report 0 mismatches or browser errors.
- Mobile homepage selector revamp (2026-07-13): user reported that the always-open compact game browser made the globe unusable on iOS. Replaced it below 1200px with a 54–58px safe-area-aware `GAME NETWORK` dock that opens the existing sport/game rails as a bounded bottom sheet; desktop remains the original always-open right rail.
- Compact selector behavior now includes closed-state `inert`/ARIA management, 44px controls, Escape/focus restoration, dynamic sport/count copy, canvas-tap dismissal, preview/sheet collision handling, iOS momentum scrolling, safe-area sides/bottom, restored globe-label space, and a shorter landscape layout that keeps the entire fixture card visible.
- Selector QA passed at 390×844, 430×932, the reported 916×953 viewport, 844×390 landscape, and 1280×720 desktop: no document overflow or browser errors; all seven filters return 24/4 expected games; the carousel advances to Game 2/24; expanded cards stay inside the panel; desktop is visually unchanged. Final gate passes 9/9 API tests and 1005/1005 repository checks.
- World selector mobile fit pass: added a contained compact network mode through 1200px CSS viewports, with a sport picker, vertically scrollable match list, and width-safe fixture columns so narrow browser/device viewports no longer clip the desktop panel.
- Map-first follow-up: the compact mobile/tablet network is now closed by default behind a 54px floating game bar. It opens on demand as a bounded drawer, closes from its header, the map, or Escape, and keeps the globe visible as the primary mobile surface.
- Verified the map-first selector at 390×844: collapsed/open/close states, hockey filtering to four games, URL history, vertical next-match navigation, zero document overflow, and zero page/console errors all pass. Desktop at 1280×720 remains unchanged.
- Restored the user's preferred horizontal matchup carousel inside the map-first drawer: one readable fixture plus a next-card preview, touch scroll-snap, and previous/next controls, while the drawer remains collapsed behind the small Games bar by default.
- Horizontal-carousel QA passes at 390×844: the 368px drawer shows a 284px fixture plus next-card preview, Next advances exactly one card and the position counter, Baseball filters/reset to 4 games, and the page has zero overflow or console/page errors. Desktop remains unchanged.
- Simplified the opened mobile drawer to exactly two rails: `1 · SPORT` is now an always-visible horizontal sport scroller, and `2 · PICK A GAME` remains the horizontal fixture scroller. Removed the mobile network header, sport dropdown/change row, and match arrow controls; the bottom Games bar still opens/closes the compact selector.
- Two-rail QA passes at 390×844: sport rail is 780px scrollable inside 368px, game rail is 7000px for all 24 fixtures, Hockey centers its active chip and filters to four cards, direct horizontal game scrolling updates `GAME 2 / 4`, and there are no page/console errors or document overflow. Desktop remains unchanged.
- Removed the launcher/pop-up behavior entirely at the user's request. On mobile/tablet the two horizontal rails are now permanently pinned 12px above the bottom edge; there is no Games bar, collapsed state, close control, map-tap dismissal, or hidden/inert selector state.
- Always-visible two-rail QA passes at 390×844: the only rendered mobile panel children are Sport, Pick a Game, and the fixture carousel; no launcher exists, the 370×199 panel stays pinned at the bottom, Basketball filters to four games, horizontal scrolling reaches Game 2/4, and desktop/mobile remain free of overflow and page/console errors.
- Mobile globe framing: increased the phone camera distance from 8.1 to 9.25 below 700px, while preserving the 8.1 desktop camera and switching cleanly across orientation/breakpoint changes.
- Mobile globe framing QA passes at 390×844: the pulled-back globe exposes more curvature and map context above the pinned two-rail selector; all 24 fixtures/48 endpoints remain finite, the 370×199 selector is unchanged, and there are no overflow or page/console errors. Required 1280×720 capture confirms desktop framing is unchanged.
- Globe navigation/pinpoint fix: removed every pointer-hover route into `flyTo` from map labels and fixture cards; hover now only highlights a matchup. Route tubes are explicitly non-interactive/non-raycastable and render behind enlarged depth-independent beacon cores/dual rings. Front-side pins stay visible even when their text labels are suppressed around UI.
- Final globe interaction QA: at 1280×720, hovering both a visible city label and fixture card leaves rotation exactly at `(0.08, -0.82)` with `flyToActive:false`; an intentional canvas drag moves it to `(0.28, -0.40)`. Eleven pins are visible initially and 17 after the drag, while all 24 arcs report non-interactive. Pin sizing/opacity and UI-safe subduing were visually balanced at 1280, 855, and 390 widths; arcs were thinned/dimmed and clipped edge labels suppressed. No overflow or page/console errors.
- Reopened after real-device screenshots disproved the prior acceptance: manual CPU front-face culling could hide a pin over a visibly centered city, and idle globe rotation plus hover highlighting still produced perceived hover movement. Removed every hover/focus listener and idle planet rotation. Pin groups now remain submitted and use real GPU depth against the Earth, with an extra surface lift above route tubes; only labels retain front-side/UI culling.
- Corrected regression proof at 476×868: a 5+ second mouse sweep across four map regions leaves planet rotation exactly `(0.08, -0.82)` and `flyToActive:false`; a deliberate drag changes it to `(0.305, -0.43)`. Selecting Hockey and horizontally scrolling to Game 2 centers Sapporo over Japan with its selected beacon visibly rendered without a nudge. The selected state reports two pins, two front-visible pin groups and zero interactive routes. Required desktop capture, mobile screenshots, `git diff --check`, and page/console checks pass.
- Restored controlled hover snapping by explicit user preference: pin labels and fixture cards now require a 340ms mouse dwell, then take a 1350ms lock and refuse all new hover snaps while the camera is moving. Quick cursor sweeps cancel pending snaps; starting a drag cancels and temporarily locks hover intent. Idle rotation remains disabled.
- Rebuilt the compact bottom selector as a glass broadcast deck: club-color top signal, tighter section headers, larger color-aware sport tiles, clearer active states, a separated game counter, richer gradient matchup cards, stronger team typography, and multiple useful matchup previews at tablet widths without changing the two horizontal rails.
- Final hover/deck QA passes: both the DOM labels and literal 3D pin rings/heads now provide immediate visual feedback, a pointer cursor, and the same calm intent gate. A 150ms pin sweep produces zero camera moves, a 430ms deliberate dwell produces exactly one centered snap, and leaving the pointer stationary for four seconds produces no chained snaps. The 320, 476, 900, and 1180px layouts have zero document overflow; match widths adapt from one focused phone card to two-plus tablet cards, all routes remain non-interactive, keyboard fixture focus deliberately snaps, and required-client/browser checks report no page errors.
- Corrected the selector/map interaction split after user clarification: desktop fixture rows again retarget the globe immediately on mouse entry and may replace an in-flight row preview, recreating the original city-to-city bounce while browsing the list. Map labels and literal pins keep their 340ms intent gate and movement lock, and arcs remain inert. A 70ms sweep across three rows targeted all three in order and settled on the last with two selected endpoints; the separate 150ms/430ms pin test still yields zero/one snap and no browser errors.
- Removed the homepage `WATCH LIVE SOCCER` / `CHOOSE A SPORT` actions and the obsolete `hero-watch` timer dependency. Game pins now use a two-step entry flow: DOM labels are accessible preview buttons, literal canvas pins save their hit target on pointer-down and open only when the gesture stays below the drag threshold, and the responsive matchup dialog exposes one exact `WATCH GAME FULLSCREEN` arena link. Mouse, touch, keyboard, blank-click close, 30px drag rejection, live-soccer clock/href refresh, 320/476/1180/1280 layouts, direct arena navigation, the required client, 9 API tests, and all 980 project checks pass with no overflow or browser errors; route arcs remain inert.
- Made active game beacons strictly persistent at the user's request: removed viewport/header/selector group culling, disabled Earth depth occlusion for the pin meshes, and replaced the front/back binary with a smooth full-strength-to-ghost treatment that never reaches zero. Far-side ghosts stay selectable so any visible beacon can rotate forward and open its preview; no UI threshold now changes pin size or opacity. Four large rotations hold exactly 48/48 groups in ALL on desktop and mobile, while Hockey holds 8/8 before and after rotation; labels remain separately decluttered, arcs remain inert, and the required client plus all 980 checks pass without overflow or browser errors.
- Removed the pin-hover dwell and movement lock: both visible labels and literal canvas pin targets now retarget the globe synchronously, including a second target while the first flight is still active. At compact widths through 1200px the two horizontal selector rails are back directly beneath the condensed `CHOOSE A GAME` heading, while pin clicks open their matchup preview against the bottom edge. Geometry/interaction checks pass at 320×700, 476×868, 900×520, 1180×720 and 1280×720 with no overflow or browser errors; arcs remain inert, the required client passes, and all 9 API tests / 980 project checks remain green.
- Removed far-side ghost pins by restoring Earth depth testing to every beacon stem, head and ring. Back-facing markers are also excluded from canvas hit testing and `pinTargets`, so an occluded pin cannot steal hover or click input. Initial and large-rotation captures at 476×868 and 1280×720 show only surface-facing pins; front-pin instant hover still passes, all 48 groups remain available for later rotation, and arcs remain inert with no browser errors.
- Converted all six arenas to autonomous, view-only broadcasts. Soccer no longer binds story, sound, Escape or poster-download input; football removed coach calls, manual snaps, sound/fullscreen and restart controls while AI play selection/cadence/snap plus automatic next-fixture rotation remain; hoops, hockey, baseball and combat removed pause/resume, rematch, fullscreen, plan-drawer and sound-activation controls/handlers. Only ordinary Home/league navigation links and non-UI QA hooks remain. Every arena now reports `autonomous:true` / `interaction:'view-only'`; legacy P/Space/R/F/Q/1/Escape plus pointer input leave URLs unchanged, never fullscreen, expose zero control elements, and all six simulations continue advancing. Required desktop clients and 390×844 captures were visually inspected with no browser errors or overflow; 9 API tests and the updated 994-check product verifier pass.
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

## 11v11 / Hoops / Broadcast Navigation — 2026-07-10
- Rebuilt American football around 22 simultaneous named athletes: 11 offensive roles and
  11 defensive roles, 13 situational offensive calls, six defensive calls, routes, protection,
  zones, man coverage, blitzes, option reads, sacks, fumbles, punts, and field goals.
- Expanded all eight football clubs to complete 22-athlete identity rosters while preserving
  the original stars and stable IDs. The shared world now contains 48 clubs and 416 athletes;
  the public API fallback, atlas, globe, World Wire, ops checks, and release verifier agree.
- Rebuilt basketball as proper 5v5 with seven authored offenses, five working coverages,
  screens/cuts/help, shot quality, steals, blocks, box-outs, rebounds, assists, fouls, free
  throws, full stats, role-specific bodies, a 400-person reactive crowd, and mobile Game Plan.
- Added `menu.html`, a responsive Broadcast Guide with four canonical UTC soccer channels,
  all six playable arenas, the next fixture window, creative tools, keyboard tuning, and
  standard permanent links.
- Added `gamehub.js` to every arena: one consistent `G`-key/mobile overlay linking the Guide,
  world, atlas, World Wire, studios, lab, ops, and all six sports without breaking game input.
- Route QA passed at 1280x720 and 390x844 with no document overflow, broken assets, or console
  errors. Football completed three automated full games including overtime; basketball
  completed a 41-possession game and exercised every play/coverage. Same-seed twin-browser
  gates were byte-identical for both upgraded arenas.
- Release gate now passes 8 API tests plus 933 static/data/route/schedule/navigation checks.

## Remaining Arenas / Living League Table — 2026-07-10
- Baseball now fields nine readable defensive roles and models six pitch types, count and
  fatigue-aware sequencing, batter/defense plans, launch angle and exit velocity, force plays,
  relay throws, throwing errors, double plays, tag-ups, sacrifice flies, and pitch workloads.
- Hockey now exposes G/C/LW/RW/LD/RD per side with four adaptive systems, controlled entries,
  offensive cycles, forechecks, neutral-zone coverages, fatigue/rolling lines, penalties,
  5v4 power plays, screened goalies, faceoffs, benches, boxes, and a responsive Game Plan.
- Combat now has four seeded archetypes with stance/guard/range/footwork identities, authored
  plans, combinations, feints, counters, clinches, targeting, stamina/guard/damage/cuts,
  knockdowns, corner adjustments, visible corner crews, and deterministic 10-point cards.
- League Atlas now loads the shared `/api/league` standings for every sport, lets users select
  clubs directly from the table, splits football rosters into all/offense/defense views, and
  gives every athlete a permanent World Wire story link.
- Football now adds a real pre-snap Coach Mode: three situational play cards/number-key calls,
  a visible cadence clock, matchup totals, user-call tracking, burst fuel, and deterministic
  complete/incomplete/interception catch helpers without changing its 11v11 contract.
- Baseball completed a 900-second three-game soak and a byte-identical 240-second twin run.
  Hockey passed forced penalty/PP/shift/one-timer/OT/final/rotation branches and a twin PP run.
  Combat passed a unanimous decision, forced TKO, three autonomous stoppages, and a byte-
  identical 30-second twin run. Desktop and 390x844 gates were clean across all three.
- Release gate now passes 8 API tests plus 943 application/data/route/navigation checks.

## American Football Ground-Up Reset
- User rejected the previous football arena as incoherent and asked for a near-total restart.
- Replaced the Three.js football implementation rather than extending its overlapping camera,
  manual-carrier controls, Coach Mode, and dense broadcast overlays.
- New foundation is a dependency-free 2D broadcast simulation: offense always travels
  left-to-right, the camera holds one field view, and line of scrimmage / line to gain /
  assignments / routes are visible before every snap.
- Rebuilt football state around possession, legal downs, distance, field position, quarters,
  first downs, turnover on downs, interceptions, fumbles, punts, field goals, touchdowns,
  halftime possession, drives, and finals.
- Rebuilt 11v11 role selection from the shared 22-player rosters and reduced interaction to
  one coherent loop: choose one of three situational calls, then snap and watch assignments.
- Added a fast synchronous time-step hook and compact text state for deterministic gameplay QA.
- Remaining gate: automated action bursts, screenshot inspection, desktop/mobile layout checks,
  complete-drive branch testing, and production deployment after corrections.
- Required web-game client completed three successive plays with coherent down/distance state:
  1-yard run to 2nd-and-9, a first down, then 6 yards to 2nd-and-4. No error artifact.
- Gameplay screenshot review confirmed clear field direction, scrimmage, line to gain, routes,
  and 22 distinct players; reduced trench-player radius and removed overlapping line-role tags.
- Full-page 1440x900 and 390x844 screenshots passed: scoreboard, situation, field, play cards,
  snap control, navigation, and mobile safe areas remain readable with no console warnings.
- Forced branches passed for a 47-yard field goal, 45-yard punt and field flip, interception,
  and goal-line completion / touchdown. Possession, field position, score, and events reconciled.

## Hockey Equipment / Crease / Arena Pass — 2026-07-10
- User request: hockey needs a comprehensive quality pass, specifically visible sticks,
  goalies who stay in net, and a much better crowd.
- Audit found the hockey simulation was already deep, but its page-local presentation still
  used unequipped shared blob rigs and a mostly flat 220-head audience treatment.
- Added page-local sticks, taped blades, gloves, goalie leg pads and blockers without changing
  the shared multi-sport rig contract. Stick pivots now sell carrying, passing and shooting.
- Rebuilt the lower bowl with 520 instanced torso/head spectators, team-colour pockets, seating
  risers and arena banners while retaining the reactive crowd-light behavior.
- Tightened goalie angle challenges and added a post-collision crease invariant so traffic can
  never push either goalie out into the slot or behind the net.
- Corrected the initial crowd column clustering into a continuous five-row bowl and reduced
  near-side spectator scale/contrast after inspecting the first desktop capture.
- Forced save, cover, breakaway, one-timer, check and goal branches all passed with no console
  errors; the one-timer produced the intended save/rebound chain and the goal entered GOAL_SEQ.
- A 100-second live-play goalie soak recorded zero crease violations (maximum depth 1.40m,
  maximum lateral position 2.28m), while the match produced normal shots, saves and goals.
- Desktop 1280x720 and mobile 390x844 visual checks passed; mobile had no horizontal overflow.
- Final release gate passed 8 API tests and 964 application/data/route/navigation checks.

## Soccer Spectacle / Athlete Files / Replay Center — 2026-07-10
- Canonical soccer now includes gated backheels, first-time volleys and bicycle attempts;
  authored replay/camera beats; injury limps; red-card tunnel walks; opening, restart,
  halftime and full-time rituals; tactical positional interchanges; technical areas; tighter
  referee positioning; and a compact match-plan context without replacing the classic blobs.
- Added permanent `player.html` Athlete Files for all 416 athletes with deterministic identity
  art, form, career ledgers, rivalry pressure, story headlines, teammate rails, social metadata,
  invalid-link recovery, and direct live/Atlas/Wire/Replay/poster/clip destinations.
- Added `replay.html`, a six-sport Replay Center with four current canonical soccer channels,
  deterministic exhibition recaps for the other sports, three selectable events, animated
  12-second previews, scrub/play/restart controls, permanent URLs, and explicit provenance.
- Integrated Replay Center and Athlete Files across Broadcast Guide, GameHub, League Atlas,
  World Wire, Moment Maker, Clip Director, Operations, CI route smoke tests, and verification.
- Fixed Replay Center query normalization so bare routes use the current UTC edition and
  fractional event indices safely truncate/canonicalize instead of yielding undefined events.
- Expanded league fixture responses with season/round/channel identity, form, streaks, records,
  summaries and adjacent fixture windows. A rollover regression test proves prior-season finals
  remain distinguishable from the eight current-season fixtures after standings reset.
- Three seeded soccer games reached full time (3-4, 3-3, 2-2); spectacle twin states matched.
  All 416 profiles, all six replay sports, the 2D 11v11 football reset, hockey crease/equipment,
  rank triggers, desktop/mobile routes, and navigation passed independent browser/runtime QA.
- Release candidate passes 9 API tests plus 989 application/data/route/navigation checks.

## Vercel Multi-Sport Arena Revamp — 2026-07-12
- Current user request: continue from the promising production deployment rather than the
  rejected soccer-only remake; rebuild football as a blob-character broadcast, polish the
  baseball hitter/catcher/pitch cadence, connect hockey equipment and add real shots/check
  recoveries, narrow and separate basketball bodies, and improve every arena crowd.
- Traced `https://cyberliga-ten.vercel.app` to production commit `03b9444` and created the
  isolated `codex/vercel-sports-revamp` branch/worktree from that exact source. The unrelated
  dirty soccer rebuild remains untouched in the original worktree.
- Football retains the deterministic 11v11 down/distance/play-call simulation but now renders
  a Three.js stadium with 22 padded blob athletes, routes, LOS/gain markers, ball flight and
  contact effects, crowd, stable desktop/mobile cameras, and a preserved 2D fallback. A
  negative first-frame delta that could throw the camera out of the stadium was caught during
  the second audit and fixed by clamping RAF time; delayed canvas sampling now proves real 3D
  pixels and stable camera positions.
- Baseball now has a side-on batter, hands/arms and a hand-linked bat, readable catcher/umpire
  equipment, early/late/chase/check whiffs, fouls and contact timing, slower at-bat beats, and
  explicit BALL/CALLED STRIKE/WHIFF/FOUL/CONTACT callouts. Forced outcomes, a 1200-second soak,
  desktop/mobile framing, and same-seed runs passed.
- Hockey now uses connected shaft/blade/toe assemblies and two visible gloves, favors shooting
  before crease entry, adds lifted slap shots and mph callouts, and models checked skaters
  falling, sliding, getting up, and rejoining at reduced speed. One-timers, goals, checks,
  mobile framing, and crowd placards passed forced visual QA.
- Basketball role scales are materially narrower while height remains role-specific; body-
  radius separation plus positional correction keeps live-drive opponents at least 1.026 court
  units apart in the QA scenario. Defensive rebounds now trigger EARLY DRAG / RUN WIDE LANES,
  a dashed action route shows the set, and the four-sided bowl reports 566 spectators.
- Final integration gate: `git diff --check`, 9 API tests, and all 989 project checks pass.
  Desktop browser smokes for all four arenas parse `render_game_to_text`, execute
  `advanceTime`, and open/close GameHub with no console, page, or request errors. Mobile
  football, baseball, hockey, and basketball screenshots passed without horizontal overflow.

## World Game Browser / Mobile Arena Release — 2026-07-12
- Replaced the one-link-per-sport selector with a true game browser. `ALL` is the default
  network and exposes 24 simultaneous fixtures across all six leagues; each sport tab narrows
  the drawer, globe markers, and route arcs to four selectable fixtures and eight club cities.
- Mapped all 48 clubs to their actual world cities. Every fixture card has two city endpoints
  and links directly to that matchup: canonical soccer match IDs, football fixture indices,
  and explicit basketball, hockey, baseball, and combat match indices.
- Added shareable league filters such as `world.html?sport=american-football`, browser-history
  navigation, live soccer clock refreshes, and an inspectable world state reporting 24 games /
  48 endpoints in ALL and 4 games / 8 endpoints in a league view.
- Rebuilt the mobile world layout around a compact heading, horizontally scrollable league
  rail, and contained game drawer so the globe remains visible instead of sitting beneath a
  desktop-sized hero. 360x740, 390x844, and 1280x720 checks have no page overflow or errors.
- Reframed all six playable arenas for phones: soccer uses a full portrait tactical pitch;
  football holds the full play shape and play-call controls; basketball follows a readable
  active half court; hockey keeps the full rink; baseball keeps plate-to-diamond action; and
  combat holds both fighters, the ring, HUD, and controls in one side-on frame.
- Added direct `?match=` fixture initialization to baseball, hockey, and combat while retaining
  their saved-match fallbacks. The full 12-cell arena matrix (six sports at 390x844 and
  1440x900) passed HTTP, route identity, text-state, overflow, console, and page-error checks.
- Release gate passes `git diff --check`, 9 API tests, and all 989 project checks. The required
  web-game client also confirms the football league deep link exposes exactly four games and
  eight cities with no error artifact.

## Active Goal: 24/7 Multi-Sport Quality Rebuild — 2026-07-13
- Current user objective: make every arena genuinely compelling as a persistent AI sports
  broadcast, with football receiving the deepest rebuild; materially improve hockey,
  baseball, basketball, combat and soccer strategy, mechanics, pacing, animation, crowds,
  stadiums, mobile framing and tune-in continuity. The target is not a cosmetic pass.
- First football gameplay capture proved the current experience is still below that bar:
  `OPENING KICKOFF` is text followed by an instant ball-at-25 possession, touchdowns award
  seven in one step, the same high camera covers every phase, sparse point fans flank only
  the sidelines, end zones lack club identity, and routes/pursuit are linear enough that a
  viewer cannot read real coverage, return or tackle decisions.
- Football rebuild requirements now under implementation: explicit kickoff/return and PAT
  phases, six-point touchdowns, safety/touchback logic, special-team formations, readable
  pursuit/contact timing, richer football equipment on classic blob rigs, club wordmarks and
  field identity, a complete stadium bowl with scoreboards/tunnels/sidelines, and phase-aware
  broadcast cameras. Deterministic hooks and fixture deep links must remain intact.
- Parallel quality tracks own hockey/baseball and basketball/combat/soccer. Every track must
  supply live-play screenshots plus text-state evidence, forced branch tests, mobile/desktop
  layout checks and required web-game-client runs before integration.
- Completion remains open: after the parallel changes land, perform a requirement-by-
  requirement visual/gameplay audit, multi-sport soak, full project verification, commit and
  production deployment. Do not treat passing static checks as proof of game quality.

### Verified Rebuild Milestones — 2026-07-13
- Hockey now has connected shaft/hosel/blade silhouettes, visibly equipped crease-specific
  goalies, mounted goal hardware, a 7-row lower/upper bowl, lifted and aimed shots, readable
  check/fall/recovery beats, and deterministic live tune-in with `?fresh=1` as the opening-game
  escape hatch. Independent 390x844 QA caught a center-board obstruction; the portrait camera
  now hides that geometry and fills the phone with the full rink without overflow or errors.
- Basketball now reports 1,370 arena spectators, a center-hung four-face board, seven offensive
  schemes, five coverages and deterministic live tune-in. The user-requested body correction is
  measurable: shooter/guard horizontal scales are 0.43–0.54 while centers retain 1.27–1.41
  vertical scale. A forced steal holds five visible transition lanes at 2.88m minimum teammate
  separation; a clean half-court set measured 3.52m offense and 1.60m defense spacing. Desktop
  and 390x844 captures are unobstructed and the required web-game client reports no errors.
- Football's first accepted presentation frame now shows an actual kick in flight, all 22
  special-team athletes, football helmets/pads/pants, club end-zone identity, a midfield shield,
  goalposts and a complete four-sided bowl. The first roof/camera combination obscured the lower
  quarter of the desktop frame and was rejected; the corrected desktop and portrait All-22
  cameras show the complete field and both units. Normal plays, scoring branches, tune-in and
  long-run proof remain required before this track is accepted.
- Baseball's whole-play camera now holds the complete diamond, active runners and throws, while
  strikeouts lead into visible outgoing/incoming batter paths instead of instant swaps. The final
  side-on contact/bat-grip frame and long soak remain under review. Combat baseline QA exposed a
  severe desktop foreground-camera occlusion, so a clean two-fighter side broadcast is now a
  mandatory acceptance gate alongside visible contact and mid-bout tune-in.
- Hockey frequency was re-opened after an independent 300-second soak found 34 total shots but
  zero organic slap shots despite the forced branch working. Removing the unreachable carrier-
  speed gate and adding clean 7–17.5m point/circle windups corrected the real simulation: a fresh
  independent rerun produced 34 shots, nine organic slap shots and two one-timers without errors.
  Deterministic late-entry QA also joined a tied game in period three at 0:29.
- Baseball now passes the side-on contact gate with a hand-linked gold barrel crossing the body,
  plus a portrait whole-diamond view that uses the phone vertically. Forced strikeout, walk,
  third-out field flip and double-play chains all return to valid states. An independent 900-
  second run completed two three-inning games (1–3 and 5–0), entered a third game, kept all runner
  and fielder coordinates finite and emitted no errors; a late-entry re-cue landed in the top of
  the third instead of replaying first pitch.
- Combat's replacement side broadcast now holds the complete ring and both fighters on desktop
  and mobile, fades obstructing ropes/posts, keeps the referee off the punch line, and renders a
  glove trail through actual contact. Five of six sampled fixtures joined active round-two action
  (the sixth intentionally varied to a walkout); a 90-second soak stayed live and finite with
  26–27 landed punches per fighter and no errors. A separate read-only agent is now adversarially
  re-auditing hockey, baseball, basketball and combat before release.
- Football now passes its complete gameplay gate rather than only its presentation gate. The
  simulation explicitly covers kickoffs and returns, six-point touchdowns followed by PAT or
  strategic two-point tries, punts, field goals, touchbacks, safeties/free kicks, penalties and
  overtime; forced branch checks preserve airborne ball state and conversion-specific cameras.
  Four deterministic fresh games finished 3–16, 7–10, 14–7 and 13–14 (21.0 combined average,
  both clubs scoring in all four) through actual clock/drive tuning, with no injected scoring or
  browser errors. The required client also captured a live Q2 pass inside the rebuilt stadium.
- Soccer now evaluates offside at pass commitment against the receiver, ball and second-last
  defender, then only whistles once that receiver becomes involved. The resulting free kick,
  dashed offside line and broadcast callout share the same live/forced path. A compact analyst
  strip exposes possession, shots, xG and offside totals without obstructing the complete pitch
  on desktop or portrait mobile. Three independent matches reached full time with finite state,
  varied scores and no errors.
- Adversarial baseball review found one remaining presentation defect: a swinging third strike
  entered BATTER_CHANGE early enough to replace the outgoing hitter and bat before the visible
  follow-through. The baseball loop is reopened until the full miss is held before walk-off and
  incoming-batter staging, on both desktop and mobile.
- Baseball's reopened strikeout gate now passes. Swinging Ks retain the outgoing hitter and pitch
  plan in `STRIKEOUT_HOLD` through the authored 0.95-second finish before batter change or third-
  out side change; called-looking Ks keep the immediate transition. At maximum follow-through,
  two cyan gloves, dark bent forearms and a wrapped handle visibly connect to the orange barrel
  outside the torso on desktop and mobile. A post-fix 900-second soak completed and rotated a
  4–8 game with no invariant or browser errors; the required client has no error artifact.
- Independent release audits now pass all six sports. Hockey forced slap-shot/check/save/goal
  chains and an organic rotation; basketball used all five coverages and nine schemes before a
  35–33 rotation; combat completed seven bouts in 900 seconds with working KO/decision/contact
  branches; football reproduced all four accepted fresh finals; and soccer reached full time 2–0
  after an offside/free-kick/restart branch. No audited arena produced overflow, non-finite state,
  stalled rotation, HTTP failure, console error, page error or failed request.
- The integrated 12-cell browser matrix (six sports at 1280×720 and 390×844) reports HTTP 200,
  both required game hooks, finite state before/after deterministic time advancement, zero
  horizontal overflow and zero browser/request errors in every cell. All 12 screenshots were
  inspected. A final visual audit caught the soccer analyst strip above the Full Time headline;
  the card now owns a higher layer and suppresses the analyst/presence strips while open. Fresh
  desktop/mobile Full Time captures and the mandated soccer client confirm the correction.

## Mobile Broadcast / Game-Network Follow-up — 2026-07-13
- Current user request: materially zoom every mobile arena farther out so complete play context
  remains visible, make baseball understandable in particular, remove the obsolete bottom sport
  selector, preserve the filterable ALL/sport/individual-game network, and deploy to production.
- The screenshot mismatch is between an immutable stale `cyberliga-i1m0...` preview and the
  current `cyberliga-ten.vercel.app` production alias. Current source already contains the desired
  24-game network, seven filters, four fixtures per league and individual arena deep links; no
  bottom selector markup remains. The real mobile defect was that the seven-filter rail scrolled
  horizontally and hid Combat at first view.
- Mobile world filters now form one seven-column row at both 390×844 and 360×740: ALL, SOCCER,
  FOOT, HOOPS, HOCKEY, BASE and FIGHT are simultaneously visible, while desktop retains full
  league names. ALL reports 24 games / 48 city endpoints; FOOT selects four games / eight cities;
  individual football cards retain `football.html?fixture=N` links. Both viewports have no
  overflow or browser errors, and the required web-game client still reports all 24 fixtures.
- Parallel camera passes are active for soccer/football, baseball/hockey and basketball/combat.
  Final acceptance requires moving-play screenshots at 390×844 and 360×740, not only CSS/state
  checks, plus complete filter/deep-link interaction QA before the production commit.
- Soccer and football portrait framing now pass at both target sizes. Soccer pulls back 17.5%
  and contains both goals, touchlines and all 12 players. Football uses phase-specific wider
  All-22 cameras for ordinary plays, airborne red-zone passes, kickoffs and PATs; all 22 players
  and the relevant end-zone context remain visible, with finite state and no overflow/errors.
- Baseball now switches live balls, relay throws and side changes into a dynamically fitted
  scorebook view containing the entire diamond, nine defenders, runners, ball and throw path;
  plate/contact/strikeout shots stay close enough to read the hand-linked swing. Forced single,
  double-play, strikeout and field-flip branches plus a 300-second fresh soak passed at both sizes.
- Hockey's new portrait tactical camera contains both nets and the complete lineup continuously,
  and forced slapshot/check/goal branches remain correct. Visual acceptance is temporarily
  reopened because the first full-rink captures exposed an oversized center-ice bloom that can
  hide skaters and the puck; portrait lighting must be restrained before release.
- Hockey's reopened lighting gate now passes: portrait-only ice roughness/reflectivity and bloom
  are restrained enough to preserve the center circle, puck and every skater in default play,
  slapshots and checks at both sizes. Desktop keeps its original shinier broadcast treatment.
- Basketball now uses a fixed full-court end-line camera for transitions and a stable wide active-
  half view for settled offense, with all ten players visible instead of compressing them against
  the far baseline. Combat keeps the complete cage, both fighters and referee visible through
  exchanges and knockdowns; count/KO graphics move below the ring rather than covering contact.
  Forced transition and FIGHT→KNOCKDOWN branches passed at 390×844 and 360×740.
- An independent four-size world audit (390×844, 360×740, 768×1024 and 956×992) confirms no
  bottom strip at any breakpoint, all seven filters visible/clickable, correct active colors and
  query history, 24/4 fixture counts, internal access to final drawer cards, and successful actual
  second-card navigation into all six arenas. No viewport produced document overflow or browser,
  page, request or HTTP errors.
- The final exact-source mobile release matrix passes all 12 arena cells (six sports at 390×844
  and 360×740): HTTP 200, finite state, no horizontal overflow and no console, page or request
  errors. Every capture was visually inspected; active-play companion captures confirm full-field,
  full-court, full-rink, complete-diamond and full-cage context where phase cards intentionally
  cover the paused action in halftime/setup/between-round states.

## Hoops Inbounds / Navigation Removal / Mobile Picker — 2026-07-13
- Current combined request: show a real baseline inbound after every made basket in basketball,
  remove the floating Navigate menu completely, ensure the obsolete bottom Network sport strip is
  absent, and replace the cramped mobile world drawer with a more intuitive game-selection flow
  while leaving the accepted desktop selector unchanged.
- Initial audit confirms made baskets currently pause in `MADE` and then call the generic outlet
  helper, so there is no authored inbounder, baseline setup or visible legal pass before bring-up.
  The floating Navigate pill/panel is injected by `gamehub.js` into all six arenas. The old bottom
  sport strip exists only on the immutable stale preview shown in the earlier screenshot; current
  production source has no strip markup, and the new mobile selector must keep that absence.
- Mobile world currently compresses seven sports into tiny abbreviations and stacks four tall
  fixture rows over the globe. The redesign target is a clear sport-first choice followed by one
  focused, touch/swipe-friendly matchup at a time, with all 24 games and every deep link retained.
- Hoops now authors six observable post-score beats: make, ball retrieval, baseline setup,
  inbound-ready stance, airborne pass and receiver catch. The inbounder is the only player allowed
  behind the end line; both game and shot clocks remain frozen until the catch, then BRINGUP resumes.
  Made final free throws use the same baseline restart. Forced desktop/mobile sequences scored,
  crossed the baseline, completed the pass and restarted both clocks with no overflow or errors.
- The floating Navigate implementation is removed: `gamehub.js` is now a cleanup-only compatibility
  shim that injects no DOM, CSS, shortcut, listeners or global API. All six arenas retain permanent
  Home links; desktop/mobile audits found no Navigate text or controls, and `G` is inert.
- Mobile World is now a compact two-step selector: a full-name sport chooser with game counts, then
  a one-card swipe carousel with previous/next buttons, position counter and a visible next-card
  preview. All 24 games, every league's fourth game, history state and real arena deep links passed
  at 390×844 and 360×740. Desktop selector geometry remains unchanged at 1280×720.
- Live soccer clocks now update the rendered card labels in place between round rollovers instead
  of rebuilding the carousel once per second, so an in-progress mobile swipe is not interrupted.
  The final required clients, complete two-size interaction matrix, 9 API tests and 980 application
  checks pass with no console/page/request errors or horizontal overflow.

## Phone Game Selector Refinement — 2026-07-13
- Latest request: preserve the accepted desktop game network exactly while making its phone version
  shorter, more legible and self-explanatory so it stops obscuring the globe.
- Added a phone-only (760px and below) presentation for the existing two horizontal rails. The panel
  is now 178–180px tall instead of 243px, labels both rows `SPORTS · SWIPE →` and
  `MATCHES · SWIPE →`, uses readable full sport/team labels, and intentionally exposes the next
  card as a swipe affordance. Compact labels use FOOTBALL and HOOPS instead of truncating the formal
  league names; the desktop right-side network remains visually and geometrically unchanged.
- Verified at 320×700, 390×844 and 476×900 with no document overflow or console/page errors. Sport
  filtering updates query history, colors and the result count (FOOTBALL reports 4 games), horizontal
  matchup scrolling advances the counter/current card, and arena deep links remain intact. The
  required web-game client was rerun and its desktop screenshot/state were visually inspected. Final
  regression verification passes all 9 API tests and 994 application checks.

## Baseball Header Cleanup — 2026-07-13
- Removed the complete `LIVE GAME PLAN` header overlay from baseball on desktop and mobile, including
  its pitch/intent/hitter/defense presentation, fatigue meter and visible pitch-trail row.
- The underlying autonomous scouting approach, defensive shifts, pitch intent and structured pitch
  history remain part of simulation state and `render_game_to_text`; only the obstructive HUD panel
  and its render-only DOM updates were removed.
- Required desktop client and a 390×844 mobile render show the field unobstructed, with no game-plan
  DOM, no horizontal overflow and no console/page errors. Final regression verification passes all
  9 API tests and 1,004 application checks.

## Canonical Fluorescent Athlete Integration — 2026-07-14
- Selectively transplanted the accepted original-player treatment into the current six-sport release:
  opaque emissive capsule athletes use fixed cyan (`0x00e5ff`) versus hot pink (`0xff45d6`) while club
  colors remain intact for HUDs, crowds, fields/rinks, venue identity and league branding.
- Football now uses the classic rig through an AthleteRig-compatible adapter without changing its
  current 11v11 simulation, autonomous controls or phase-aware cameras. Soccer, hockey, basketball,
  baseball and combat use the same side palette for athletes, equipment and player-attached signals;
  hockey's pale goalie equipment is darkened to prevent white bloom.
- Preserved the canonical page script envelopes and all newer camera, gamehub/watch-only, mobile and
  fixture logic. JavaScript plus all five inline arena modules pass syntax checks, and `git diff --check`
  is clean.
- Reconciled every reachable release surface against all surviving worktrees and reflogs. The only
  missing accepted visual delta was the fluorescent athlete treatment; rejected five-sport pages,
  obsolete menus, manual play controls and stale camera/simulation code remain quarantined.
- Standardized the public primary navigation to Home and Leagues, and made the watch-only guard plus
  intentional exit links consistent across all six arenas. Added repository-level release contracts
  and verifier assertions so future feature work cannot silently swap the canonical lineage, remove
  a sport, restore user controls or regress the classic palette.
- Final exact-source validation passes 9/9 API tests, 1,036/1,036 repository checks and 28/28 football
  rules/brain tests. Desktop and 390×844 mobile browser matrices cover Home, League HQ and all six
  arenas with HTTP 200, finite autonomous/view-only state, no horizontal overflow and zero console,
  page or request errors. Every final screenshot was visually inspected and shows cyan versus hot-pink
  athletes while preserving club identity in HUDs, venues and crowds.

## Spectator-Product / Living-World Pass — 2026-07-14
- Current user objective: turn the six autonomous arenas from promising simulations into compelling,
  smooth broadcasts that can sustain a viral audience and eventually support a separately governed
  casino-grade event product. Gameplay, motion causality, broadcast direction, player/kit coherence,
  club-specific venues, crowds and persistent world identity are all in scope; one reconciled release
  must be verified and deployed from the canonical worktree.
- Added `SPECTATOR_AUDIT.md`, an evidence-based baseline and exit standard. The central diagnosis is
  that 19,000+ lines of mostly page-local simulation/render/presentation code hide deep sport logic
  behind inconsistent motion and broadcast grammar. League HQ already owns 48 detailed venue/ritual/
  kit identities, but the arenas usually consume only names and colors. The repository has five
  league hero images, not a complete 48-stadium / 144-uniform approved AI asset commission.
- Real-money boundary is explicit: browser simulations are not a wagerable source of truth. A future
  betting product requires a separate server-authoritative, versioned, auditable event/RNG/logging/
  settlement platform and legal/compliance program; renderer polish cannot substitute for integrity.
- Parallel sport owners are auditing and improving football/soccer, basketball/hockey, and baseball/
  combat. Shared classic rigs now accept club color, trim, code, number, pattern and role metadata so
  cyan/pink athletes can carry readable club-authored jersey identity without reverting to generic
  humanoids or recoloring the entire player.
- The shared arena establishing system now binds the league hero, exact club venue copy, scene family,
  ritual and kit pattern into an automatic, non-interactive opening beat. Live arenas translate that
  canon into procedural architecture, fascia/signage, club crowd sections, ritual lighting and athlete
  trim; the opening card clears before the first snap, kickoff, tip, faceoff or pitch.
- Football adds four authored concepts (Counter GT, Jet Sweep, Flood Concept and Seam Shot), smoother
  motion/facing interpolation, corrected blocker assignments, less line clustering and explicit carrier,
  intended-target and coordinator-causality reads. Soccer keeps the complete pitch visible, moves all
  added architecture to the far stand, rotates venue identity with fixtures and exposes possession,
  pressure, transition and tactical causality.
- Basketball preserves a complete legal baseline inbound sequence after makes and now carries club venue,
  crowd and uniform identity through the broadcast. Hockey uses seeded gameplay randomness, more wrist/
  slap/one-timer shooting, airborne puck reads, stronger puck tracking, lane/screen/block causality and
  visible check/fall/slide/get-up recovery.
- Baseball corrects home/away presentation, makes pitcher workload/fatigue/bullpen changes real, adds
  readable pitch family/velocity/location/intent tunnels and preserves batter/catcher/umpire continuity
  through calls and swings. Combat expands athlete selection, overhand/liver attacks, clinch ownership and
  inside work, rope exits, footwork, compact club-tinted boots and impact causality while reducing bloom.
- A guarded `npm run release:check` now refuses deployment from the wrong branch, worktree, Vercel project,
  dirty tree or alternate homepage lineage. This establishes one commit as the source for both the canonical
  `127.0.0.1:4173` preview and the production Vercel alias.
- Final pre-commit verification passes 9/9 API tests, 1,108/1,108 repository checks, 28/28 football brain/
  rules tests, all arena module/standalone JavaScript syntax checks and `git diff --check`. Official web-game
  client plus 390x844 mobile captures cover all six arenas with finite autonomous/view-only state, no
  horizontal overflow and zero console, page, request or HTTP errors; every final frame was visually reviewed.
- A final independent audit caught presentation RNG advancing sporting decisions in soccer crowds, baseball
  commentary and combat commentary. Soccer now injects domain-separated simulation/presentation streams into
  tactics, ball flight, officials, control, goalkeeping, crowds and copy; baseball commentary no longer consumes
  its pitch/result stream; combat independently seeds sporting and narration streams. A behavioral twin-run gate
  varied render/presentation cadence while holding seed and simulated time constant: soccer, baseball and combat
  produced byte-identical sporting-state digests with zero browser errors.
- Honest remaining fidelity tier: live venues are branded procedural translations of the authored hero art,
  not exact image-derived 3D reconstructions; crowds are interactive instances rather than articulated people.
  Baseball still needs steals/pickoffs/bunts, combat needs deeper role-to-style motion libraries, and any
  real-money product still requires server authority, signed ledgers, independent randomness/security audits,
  risk/settlement controls, licensing, KYC/AML and responsible-gaming systems.

## Living World One-Shot Reconciliation — 2026-07-15
- Release-manager handoff: semantically integrate feature commit `fdfba0c` from
  `codex/ai-sports-world-one-shot` onto canonical spectator commit `8235a57`, rerun the complete release
  gate, restart only the canonical 4173 preview and deploy production only from the unified clean snapshot.
- The three-way audit confirms a blind cherry-pick is unsafe: both lineages changed all six arena surfaces,
  `scripts/verify.mjs` and `progress.md`, while canonical independently added the living-world venue/gameplay/
  uniform/RNG pass. Current canonical remains the source base; only compatible Mythos, My Signal, passive
  clip, attribution and pointer-inert Arena Signal semantics are being transplanted.
- Added verifier contracts for Founding 12 immutability, 15-minute Mythos continuity, free unresolved fan
  calls, no-money/no-prize disclosures, stable share/clip seeds, passive control-free viewer mode, Home +
  Leagues-only navigation and pointer-inert Arena Signal load order. These checks intentionally fail until
  each owned reconciliation track lands, preventing a partial feature from being released.
- Reconciliation preserves the canonical six current arena implementations and accepted right-side 24-game
  globe. The final integrated world adds 416 deterministic athlete profiles, 24 fixture stories, the frozen
  Founding 12, device-local My Signal follows/calls/locker, four-card League narratives, stable share seeds and
  pointer-inert arena stakes/star/live-beat ribbons without replacing gameplay, venues, cameras or uniforms.
- Personally reviewed the complete desktop/mobile artifact set: 12/12 arena captures and 10/10 World/League/
  Athlete/Character Lab/viewer captures return HTTP 200 with finite state, zero overflow and zero console/page/
  request errors. All six arenas remain autonomous/view-only; mobile ribbons are 31px; the passive story viewer
  exposes zero controls and only Home/Leagues navigation with an explicit fictional/non-authoritative label.
- Final exact-source gate passes 13/13 canonical API tests, 10/10 Mythos tests, 28/28 football brain/rules tests
  (51/51 combined), 1,225/1,225 repository checks, standalone and inline-script syntax, and `git diff --check`.
  Fan calls remain deliberately free, local and unresolved; the browser fallback is not an authoritative event
  or settlement stream and no cash, prize, wager, payout or client-result settlement surface was added.
