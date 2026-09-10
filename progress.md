Original prompt: Can you make boxing work way better? Make the actual fighting and animations and shit way better, you might need to make the characters better too /goal

## Pixel public release — 2026-09-07

- User authorized replacing the existing public Vercel version with the approved pixel direction, keeping the globe and removing old program screens. Work started in isolated `codex/arcade-public-release` from canonical `81da120`; approved feature `9902203` transplanted as `b694988`.
- Static early arena shell prevents legacy first-paint flashes. Current Home, HQ and Athlete File use matching authored sprites, phone layouts and direct current navigation. Removed public supporter drama/pick/locker/follow injections. Retired legacy guide/wire/replay/concept/lab routes redirect to Home locally and on Vercel. Deployment excludes review output and retired pages.
- Improved stable athlete identity rails, canonical venue accents, baseball camera framing during orientation changes, metadata, favicon and share card. Preserved all six engine outcomes and seeded state; new polish touches presentation only.
- Worktree audit: canonical clean; rejected root contains 38 changes and home-kill-gate two untracked duplicate files, left untouched. Remaining historical feature worktrees clean. Only the approved pixel change and this release polish are selected for integration.
- Targeted official clients and desktop/390×844/844×390 visual checks passed for Home/HQ, athlete profiles and representative broadcasts. Root gates first-paint isolation, real HUD score/event agreement, old route retirement, all-six responsive cameras and finite state before deployment. Release execution evidence is recorded in ignored output and the task.

## Six-sport arcade overhaul — 2026-09-07

- Current user request: rebuild the entire sports world with more compelling characters, smoother motion, quicker viewing and all six sports; permitted the Matt Shumer Manager Loop approach. The subsequent Higgsfield pirate-video inquiry was withdrawn and was not investigated.
- Feature worktree `arcade-sports-world`, branch `codex/arcade-sports-world`, from canonical `81da1208210027f03e0e3580526748874509df0a`. Preview port 4188. Root/rejected lineage and canonical/production remain untouched.
- Manager contract: `ARCADE_WORLD_BRIEF.md`. Three implementers connected six real engines to a shared authored pixel renderer, with independent visual review and corrections. No generated footage or replacement scripted game loops.
- Added continuous-position pixel athletes, actual projectile/strike/bat transforms, responsive cameras, shared score/event/nav presentation, and canonical club/athlete identity. Original engine timing and compatibility rigs remain internally mounted. Repeated composer draw calls are deduplicated without a second simulation clock.
- Rebuilt World/HQ presentation around the same actual athlete sprites while retaining globe interaction, six sport filters, 48 clubs, 416 athletes, 24 fixture slots, club dossiers and canonical fixture links. Pair URLs now select advertised clubs instead of silently ignoring them. Standings/scores derived from samples are labeled accordingly.
- Removed obsolete hidden basketball/hockey entry holds. Fixed hockey goalie cover release timer running after an unreachable carrier return; observed release in 0.70 seconds after the prior indefinite hold.
- QA: official web-game clients, independent live motion captures, desktop/390x844/844x390 checks, raw state/HUD alignment, canonical pair/numeric routes. Added `scripts/verify-arcade.mjs` with shared integration assertions and goalie regression. Browser artifacts under ignored `arcade-review/` and `output/`; final review/handoff records the completed checks and remaining product limits.
- This branch intentionally proposes pixel characters in place of the previous visible capsule art contract. It is a reviewable local design proposal, not a production release or a certified wagering product.
- Final corrections: continuous baseball contact preserves the seven seeded outcome/target families; bat contact and catcher crouch are visible. Legacy GPU draws are suppressed at construction while world matrices remain available. Initial paint and pre-dedup backing-store cleanup fix official-client selection of a hidden legacy canvas. Final all-six integration gate passes ordered clubs, HUD/events, navigation, finite state, overflow and goalie clear. `ARCADE_WORLD_REVIEW.md` records evidence and practical limits. No deployment.

## Arena navigation consistency pass — 2026-07-15
- Scope is task 4 only: soccer, American football, basketball, hockey, baseball, and combat arena top-left navigation.
- Replaced every arena's top-left treatment with one rounded, safe-area-aware, watch-only `← GLOBE` link to `world.html`, retaining only each sport's accent color.
- Removed the obsolete top-left `CYBERLIGA <mode>` wordmarks and exhibition-era pills; football's extra top-left `LEAGUE` link was also removed so all six arenas expose exactly one exit.
- The shared visual contract is a 42px touch target, Rajdhani 700 typography, 99px pill radius, consistent arrow text, 22px desktop inset / 10px mobile inset, visible keyboard focus, and the existing `watch-only-exit` exemption.
- First official-client run correctly caught four obsolete venue-identity writes targeting the removed DOM nodes in hoops, hockey, baseball, and combat. Removed those stale writes while retaining venue identity in the arenas, tickers, and existing venue readouts; the corrected rerun is recorded below.
- Corrected official-client rerun passed all six arenas with finite `render_game_to_text` output, `autonomous:true`, `interaction:"view-only"`, and no browser error artifacts. The 1280×720 screenshots were visually inspected for every sport.
- A separate 12-case browser matrix passed every arena at 1280×720 and 390×844: exactly one `← GLOBE` exit, exact `world.html` target, zero obsolete wordmark/era nodes, identical 97×42 desktop / 87×42 mobile geometry, Rajdhani 700 typography, pointer-enabled exit exemption, visible keyboard focus, zero scoreboard overlap, zero horizontal overflow, and zero console/page/request/HTTP errors.
- Mobile live-play screenshots were visually inspected for all six sports after their establishing sequences; the exit stays clear of every top scoreboard/round treatment and the simulations remain autonomous. No remaining task-4 TODOs.
- Added repository verifier contracts for every arena: exactly one watch-only exit, exact `← GLOBE` text and `world.html` destination, and no obsolete `wordmark` / `erapill` nodes.

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

## Home game-selector identity pass — 2026-07-15
- Scope is task 3 only: make the Home/world sport and matchup selector unmistakably sport-specific, add a canonical club crest to both sides of every fixture, and materially increase selector typography at desktop and narrow mobile widths.
- Preserve all six sports, 24 deep-linked games, globe interactions, compact horizontal rails, and a zero-horizontal-overflow document. Do not alter any arena explainer, arena scoreboard, or arena navigation.
- Implemented the selector identity layer in `world.html`: seven large sport controls now carry distinct inline SVG symbols, full sport names, and game counts; all fixture cards render two canonical `branddata.js` club crests plus enlarged codes/names and a matching sport symbol. A deterministic code/color fallback remains available if a crest cannot resolve.
- Updated compact layouts at 1200, 760, 360, and short-landscape breakpoints so the richer controls remain horizontal swipe rails. Added machine-readable crest/control counts and verifier coverage without changing any arena file.
- QA passed at 1280×720, 390×844, and stress width 320×700: every All/Soccer/American Football/Basketball/Hockey/Baseball/Combat filter returned 24/4 fixtures and 48/8 crests, respectively; all links retained the correct six arena destinations; the compact carousel reached Game 2/4; panel bounds and document overflow were clean; minimum visible sport/team type was 11/12px; and console, page, request, and HTTP errors were empty. Required-client state and screenshots are in `/tmp/cyberliga-selector-official`, `/tmp/cyberliga-selector-*.png`, with the structured matrix at `/tmp/cyberliga-selector-qa.json`.

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

## Arena Narrative Overlay Removal — Final QA — 2026-07-15
- Removed the shared `WHY THIS MATTERS` explainer module from all six arena documents and deleted its unused
  stylesheet/script. The release verifier now rejects either import on every arena while leaving character,
  Mythos, gameplay, and deterministic QA hooks intact.
- `npm run verify` passes 13/13 API tests and 1,209/1,209 repository checks; `git diff --check` and verifier
  syntax pass. The official web-game client produced live 1280x720 captures/state for all six arenas, all of
  which were visually inspected with no overlay or generated error artifacts.
- A separate 390x844 all-arena browser matrix confirms 6/6 HTTP 200, zero narrative panels/labels, zero
  horizontal overflow, advancing state, `autonomous:true`, `interaction:'view-only'`, and no console, page,
  or request errors. No scoreboard, selector, gameplay, or arena navigation behavior was changed.

## Six-Sport Scoreboard Fit — 2026-07-15
- User evidence showed `HAVANA SUGAR KINGS` wrapping into three vertically clipped lines while the score dash
  sat off-axis. Scope is limited to top scoreboard/fighter typography in `index.html`, `football.html`,
  `hoops.html`, `hockey.html`, `baseball.html` and `fight.html`.
- Added shared `arena-score-fit.css/js`: top-line labels are single-line, measured against their actual rendered
  box, refit after fixture mutations, webfont readiness and resizes, and expose QA metrics through
  `window.CyberligaScoreFit.state()`.
- Soccer, hoops, hockey and baseball now use a three-track tabular score readout with an optically centered drawn
  rule instead of relying on each font's en-dash baseline. Football keeps its native clock-centered TV scorebug;
  combat keeps fighter/club panels, with both surfaces using the same measured fitting contract.
- Final longest-fixture matrix passes 18/18 views across desktop, 390x844 and 320px: every visible label is
  measured, stays inside its parent, and reports zero overflow; 0→12/11, 108/117, 8/10 and 12/11 score-width
  stress keeps the drawn separator on-axis with no horizontal page overflow or console/page/request errors.
- The official web-game client passes all six arenas with finite state and no error artifacts; all six official
  desktop captures plus the narrow mobile capture set were visually inspected. Final static verification passes
  13/13 API tests and 1,257/1,257 repository checks, and `git diff --check` is clean.

## Integrated Arena UI Consistency Gate — 2026-07-15
- Reconciled the four independently owned changes on `codex/arena-ui-consistency` without restoring the deleted
  Arena Signal resources: explainer removal, fitted scoreboards, crest-rich sport/game selector, and uniform
  arena navigation now coexist on the same six-sport source snapshot.
- Required web-game client captures pass all six arenas with finite autonomous/view-only state and no generated
  error artifacts. A separate 12-case arena navigation matrix at 1280x720 and 390x844 reports exactly one
  rounded `← GLOBE` exit per arena, zero obsolete wordmarks/explainers, zero overlaps or horizontal overflow,
  and no console, page, request, or HTTP errors.
- The integrated scoreboard stress matrix passes 18/18 cases at 1280x720, 390x844, and 320x700. Every measured
  club/fighter label remains within its parent, all drawn score separators stay centered to one pixel, and the
  exact reported 848px baseball case keeps `CAPE TOWN JACKALS` and `HAVANA SUGAR KINGS` on one unclipped line.
- The integrated Home selector has seven full sport labels and distinct pictograms, 24 fixture links and 48
  canonical club crests. All and per-sport filters return 24/48 and 4/8 fixture/crest counts respectively at
  desktop, mobile, and 320px, with working arena deep links, readable type, functional swipe rails, no overflow,
  and no browser errors.
- Final exact-source gates pass 13/13 API tests, 28/28 football brain/rules tests, 10/10 Mythos tests, and
  1,263/1,263 repository checks. No canonical preview, release branch, or production deployment was changed;
  this feature snapshot is ready for Release Manager integration and the mandatory canonical release gate.
## My Signal / Live Athlete Moments — 2026-07-15
- Continued the state-of-the-art AI sports-world objective by closing the largest verified fandom-loop gap:
  My Signal now turns the shared `/api/live` ledger into a readable six-sport discovery feed and, once a
  supporter follows an athlete/club or makes a free fan call, an honestly personalized feed. It no longer
  promises evolving stories while showing only static saved-name rows.
- Added the frozen `CyberligaAthleteMoments` model. It resolves every event through the local 48-club / 416-
  athlete canon, rejects malformed, lifecycle, cross-team and unattributed data, deduplicates by match plus
  event key, derives editorial headlines from trusted identities, and emits validated player, arena and
  event-reference clip URLs. Arbitrary API copy and colors never enter the UI.
- My Signal performs one background load, then polls every five seconds only while its drawer is open and the
  document is visible. It stops while hidden/closed, retries with backoff, retains a stale in-memory snapshot
  without resetting drawer scroll/focus, reranks locally after follows/calls, and never mutates XP, awards,
  drops, activity or the persisted fan-call schema.
- Empty supporters see at most one current moment per sport under `LIVE WORLD DISCOVERY`; personalized feeds
  rank followed athletes, called sides, followed clubs, open-call matches and athlete clubs without disguising
  unrelated events as “for you.” Followed club/athlete rows now deep-link to their real League HQ or Athlete
  File instead of remaining inert.
- Provenance is explicit at the point of use. Canonical data is accepted only from the exact trusted
  `supabase` source when `canonical:true` and not degraded. Fallback, degraded, stale and offline states each
  have distinct copy. Every state repeats that the
  feed is read-only, does not score or settle calls, and has no money or prizes. Deterministic fallback remains
  visibly non-authoritative.
- Event-reference clips carry the exact fixture, event, athlete and score into the passive 12-second viewer,
  but the viewer never trusts a URL parameter as proof of authority. It labels the animation an unverified
  interpretation, not an official result or recorded footage, and exposes that same boundary through
  `render_game_to_text`.
- Final rebased verification passes 13/13 API tests, 10/10 athlete-moment tests and 1,294 repository checks. A 28-
  assertion deterministic browser matrix covers canonical, fallback, degraded, personalized, six-sport
  discovery, forged-copy rejection, exact routes, clip provenance, desktop and 390×844 layouts with zero
  browser/page/request errors or overflow. Stale refresh preserves scroll, closing the drawer stops polling,
  all six arena URLs load the intended matchup, and all six athlete URLs resolve without fallback.
- Independent safety and broadcast audits then caught and closed five commit-gate defects: soccer deep links
  now require the exact ordered universe pair, channel and six-minute observation window; scoreless events
  cannot create event-reference clip links; manually forged scoreless clip URLs say `CONCEPT SCORE` instead
  of inventing a referenced result; stale snapshots retain their per-moment source; and BFCache restoration
  clears/rearms the request lifecycle. Arena CTAs visibly say `MATCHUP SIM` because they open an autonomous
  client simulation, not a replay of the feed event.
- Poll rendering is now keyed by card markup. An unchanged poll preserves the exact focused DOM node; a changed
  poll restores the same event action and drawer scroll position. The post-audit 19-assertion browser matrix
  covers both paths, canonical-to-stale provenance, recovery, pagehide/pageshow, scoreless event URLs, 44px
  mobile targets and 390x844 overflow with zero console, page or request errors. Desktop, mobile and passive
  clip captures were visually inspected.
- Honest next tracks: the current local preview has no canonical backend and therefore remains a deterministic
  story feed; calls still stay open. The next high-impact product work is unifying Founding 12 visual identity
  across live arenas/profile/clips, then a named-moment autonomous replay director. Neither limitation is hidden
  or papered over by this feature.
- Release-manager audit caught one remaining score-integrity gap before integration: a present but unchanged or
  wrong-side score pair could be described as a scoring moment. Normalization now rejects every transition unless
  the attributed side increases, the opponent stays unchanged, scores remain nonnegative/monotonic, and any
  claimed positive points exactly match the attributed-side delta. The 11-test moment suite now covers unchanged,
  decreasing, opponent-only, both-sides, mismatched-points and zero-points failures plus valid away scoring and
  events that legitimately omit the optional points field; rejection occurs before headline/link construction.
- Mobile score-phase review found that the full missing-score warning lived below the first phone viewport even
  though its state and page copy were correct. The visible 12-second canvas reveal now prints `CONCEPT SCORE ·
  EVENT SCORE MISSING` itself for an event reference without a score claim, and the verifier requires both the
  canvas and page-copy warning before release.

## Founding 12 Shared Visual Identity — 2026-07-15
- Extracted the twelve authored Character Lab bodies into a frozen, deterministic `CyberligaFoundingVisual`
  renderer. Its strict preparation gate accepts only the exact canonical athlete, club, sport and body tuple;
  it owns no product data, DOM, URL, clock, storage or global randomness and publishes versioned identity keys.
- Character Lab now delegates to the shared renderer without changing its accepted art or controls. All 36
  pre/post PNG hashes—12 athletes across match, portrait and clip views at the showcase frame—match byte for
  byte, while operation digests lock all twelve bodies at three animation phases.
- Athlete Files gives only the Founding 12 a DPR-aware, reduced-motion-safe vector canvas plus readable body and
  named-signature metadata. All twelve passed the 390x844 containment/state matrix; representative desktop and
  mobile generic portraits remained pixel-identical to canonical for the other 404 athletes and never start the
  Founding animation loop.
- Moment Maker and Clip Director now resolve the same versioned identity, show the character's named signature,
  and deep-link back to the permanent Athlete File. Their exact procedural renderer remains the fallback for
  every non-Founding athlete; fixed generic Clip and Moment canvases are byte-identical to canonical.
- Clip Director retains its moving game object, impact layer, 12-second WebM path and all My Signal provenance.
  Visual review caught three bodies drawing an authored prop in addition to the moving clip ball; clips now
  suppress only that embedded prop while Character Lab, Athlete Files and posters keep the iconic full pose.
  The scoreless event warning and every `authoritative:false`, `eventDataCanonical:false`,
  `syntheticConcept:true` and `scoreVerified:false` boundary remain intact.
- Cross-surface QA passes 48/48 Founding identity cases (12 athletes × Character Lab, Athlete Files, Clip and
  Moment) with one stable identity key per athlete and zero browser/request errors. The separate Moment matrix
  passes all twelve athletes at desktop and 390x844 plus generic fallbacks with zero overflow; all twelve mobile
  posters were visually inspected.
- Exact-source gates pass 13/13 API tests, 11/11 live-moment tests, 9/9 shared-visual tests, 38/38 football and
  Mythos tests, and 1,336/1,336 repository checks. Standalone/inline syntax and `git diff --check` pass. This is
  an isolated, undeployed feature slice; it does not replace classic cyan/hot-pink live arena athletes.
- Release Manager audit removed the last two legacy creative-tool masthead destinations outside Home/Leagues
  and changed Founding Athlete Files to render only once when reduced motion is requested, waking again only
  for resize, explicit deterministic stepping, or a motion-preference change instead of repainting at 60 Hz.
- Final phone broadcast review caught Combat's outside-the-fascia camera passing behind a double-sided venue
  board during live exchanges and knockdown counts. Portrait broadcasts now retain those boards for walkouts
  but suppress them once live action begins, keeping the full cage and both cyan/pink fighters unobstructed.

## Founding 12 Live Broadcast Cues — 2026-07-15
- Added a frozen, deterministic `CyberligaFoundingLive` catalogue that translates the exact shared Founding
  identity key into one to three rear/body-attached low-poly silhouette cues. Its strict gate accepts only the
  canonical athlete object inside the canonical team and rejects generic, cloned, cross-team and forged inputs.
- `blobrig.js` merges all solids on each moving torso/head anchor into at most two meshes, reuses the athlete's
  existing classic cyan or hot-pink material, disables raycasting and shadows, and adds no textures, lights,
  particles, labels, free props, animation loops, collision surfaces, randomness or gameplay state.
- All six arenas pass the exact source athlete and team into the shared rig. Only real competitors are eligible;
  referees, officials, corner crews and synthetic identities remain excluded. Machine-readable broadcast state
  publishes the accepted identity key, body, cue/mesh/triangle budgets, classic color, side and exact lineup role.
- The two-Founder matrix passes 14/14 cases across desktop and 390x844: all twelve bodies appear in their sport,
  exact identity keys and classic side colors match, each athlete stays within three cues, two meshes and 96
  triangles, broadcasts remain autonomous/view-only, and no page, console, request, HTTP or overflow errors occur.
  Seven desktop and seven mobile captures were visually inspected for gameplay/equipment clarity and HUD safety.
- A separate generic-only negative-control matrix passes 12/12 desktop/mobile cases across all six sports. Each
  selected matchup was proven to contain two non-Founding teams, emitted zero cue state, preserved the autonomous
  view-only contract and produced no browser or layout errors; the other 404 athletes never enter the cue path.
- Exact-source gates pass 13/13 API tests, 11/11 live-moment tests, 16/16 shared visual/live-cue tests, 38/38
  football/rules/Mythos tests and 1,381/1,381 repository checks. Standalone syntax and `git diff --check` pass.
  This remains an isolated, undeployed feature slice pending Release Manager integration and the canonical gate.
- Release Manager audit found that membership alone allowed a cloned team wrapper containing an exact athlete.
  The live-cue API now binds the already-loaded canonical content, character and shared-visual modules when the
  catalogue initializes; callers can no longer substitute forged dependency adapters. It resolves the team and
  athlete through that bound `CYBERLIGA_CONTENT` API and requires both objects to be reference-identical before
  any descriptor is constructed. Regressions reject cloned athletes, cloned/forged teams and forged adapters.
- The same audit found one concave Sugar backplate even though the merged-prism path intentionally uses a convex
  triangle fan. The plate is now an authored convex six-point maple silhouette and catalogue validation plus unit
  coverage reject any future non-convex solid. The corrected 16-test shared visual/live suite, all 1,381 static
  checks, standalone syntax checks and `git diff --check` pass before browser recapture.

## Match Memory Broadcast Spine — 2026-07-15
- Product and visual audits independently identified the same P0 spectator gap: simulations already know exact
  athlete identity and action causality, but normal-scale broadcasts rarely name the people responsible. The
  scoped response is a view-only broadcast spine rather than a permanent explainer panel or any gameplay input.
- Added frozen deterministic `CyberligaNamedMoments`: exact canonical fixture/team/athlete reference gates, fixed
  six-sport event vocabularies, stable local event IDs, immutable player/clip routes, twelve-candidate retention,
  a ranked top-three final memory, and explicit non-authoritative/no-wager/no-settlement provenance. It owns no
  DOM, URL state, storage, network, timers, clocks or randomness.
- Added the pointer-inert `CyberligaBroadcastSpine` state machine and responsive lower-third: Founder-first WHO TO
  WATCH, exact named athlete/team/crest/signature identity, LIVE MOMENT versus genuine buffered REPLAY MOMENT
  provenance, and a sequenced MATCH MEMORY finale. Every transient state states VIEW-ONLY/CLIENT SIM or NOT
  AUTHORITATIVE/NO MONEY/NO PRIZE and publishes deterministic QA state.
- Soccer records committed goals, exact goalkeeper saves and genuine jukes (never mislabeling a juke as a bicycle
  kick), marks only an actual replay-buffer goal as recorded footage, suppresses stale cards during canonical
  catch-up while retaining the deterministic ledger, then queues a fresh tune-in spotlight or final memory.
- Football records exact replay markers and actors for scores, takeaways, contested catches, explosive plays,
  sacks and other attributable major events. Organic full-game QA retained nine memories with zero rejects,
  real replay provenance, a top-three finale and post-game ticking; desktop and 390x844 cards were contained.
- Basketball records exact steals, blocks, dunks and threes; hockey records goals, saves and major checks; baseball
  waits for finalized grand slams, home runs, wall robberies, double plays, triples, official runs and canonical
  pitcher strikeouts; combat names exact knockdowns, finishes, decisions, counters, guard breaks, last stands and
  round winners. None claims recorded replay footage where an arena has no replay buffer.
- The six arenas all delay or suppress presentation through establishing/catch-up state, then restore a fresh
  spotlight or finale without replaying stale cards. Football's lower third clears its scorebug, existing giant
  basketball/hockey flashes yield to the identity card, and a live combat join removes the opening venue slate so
  WHO TO WATCH appears over the actual fight rather than behind walkout graphics.
- The official web-game client and exact 390x844 browser matrix produced finite state across all six broadcasts.
  Desktop and phone captures were visually inspected; the spine stayed within the viewport, pointer-inert and
  readable with no horizontal overflow, page/console/request errors, or loss of the classic cyan/pink athletes.
- Initial feature gates passed 13/13 API tests, 11/11 live-moment tests, 14/14 named-memory tests, 4/4 broadcast-spine tests,
  16/16 shared visual/live-cue tests, 28/28 football brain/rules tests and 1,442/1,442 repository checks. All inline
  and standalone module syntax plus `git diff --check` pass. This is an isolated, undeployed feature slice pending
  Release Manager integration and the complete canonical production gate.
- Independent release audit found three trust edges before integration. Event kinds now require an own-property
  vocabulary match, stable IDs length-prefix every tuple field, and a private WeakMap certificate binds each exact
  immutable moment to its canonical fixture references. The presenter rejects cloned, forged, authoritative,
  wagering, cross-fixture and false-replay objects before either a live card or finale can enter its queue.
- The same audit removed Hockey's arbitrary scorer fallback: a deflection/own goal without a causal same-team last
  touch still counts on the scoreboard but says SCORER UNCONFIRMED and creates no athlete memory or clip route.
  Basketball and Hockey final holds are now ten seconds, preserving all three 2.7-second Match Memory cards before
  fixture rotation. Focused browser QA proved all three exact IDs display through 8.25 seconds in both sports,
  rotation occurs only after ten seconds, and the unconfirmed Hockey goal records zero athlete moments.
- Repaired gates pass 15/15 named-memory tests, 5/5 broadcast-spine tests and 1,447/1,447 repository checks; the
  complete API, live-moment, shared-visual, football, syntax and diff gates remain green. The repaired slice—not
  its original pre-audit commit—is the only version eligible for Release Manager integration.
- Final presentation audit raised the provenance strip from 7–7.5px low-contrast fine print to 9px desktop and
  10px phone text at 74% white. Exact 390x844 and 1280x720 forced-moment captures show the complete no-money/no-
  prize boundary, no overflow and full card containment; the phone card remains above its ticker and safe area.
- Football now commits a surviving official moment exactly once after live-penalty adjudication. A forced
  defensive-pass-interference interception ends as an accepted FLAG with zero ledger candidates; monkey-patched
  selection and playback-start failures each preserve exactly one certified LIVE MOMENT with
  `recordedFootage:false`, no replay playback and no REPLAY label; a successful field-goal start creates exactly
  one certified `recordedFootage:true` moment, enters replay playback and shows REPLAY MOMENT. The permanent
  five-case extracted state-machine regression also covers the sub-threshold-duration failure path.
- Canonical-live Soccer now advances presentation time after the simulation clock stops at full time. Browser QA
  proved ranked IDs `moment-0i9jjnh` → `moment-096us5i` → `moment-0kff8cr` at 0ms, 2,083ms and 4,845ms, then an
  idle/cleared spine at 7,542ms, without restarting or advancing the finished match and with zero browser errors.
- The final repaired gate passes all 15 named-memory, 5 spine and 5 football replay-memory regressions plus
  1,453/1,453 repository checks; 28/28 football brain/rules tests, syntax/diff checks, the current-byte football
  browser triad (including both selection and start failure) and canonical-live Soccer sequence are green.
- A final organic 900,000ms Football soak reached the 0–2 final with 16 accepted memories, zero duplicates/rejects,
  twelve retained candidates and a ranked safety/contested-catch/contested-catch top three; the finale opened on
  card 1/3 with two cards queued, exact safe provenance and no console, page or request failures.

## Witness Chronicle / My Night — 2026-07-15
- Three independent product/platform audits converged on the same highest-leverage fandom gap: Cyberliga can now
  name a decisive athlete in the live broadcast, but forgets that relationship as soon as the card clears. The
  scoped response is a device-local witness history—not authoritative career data, results, XP or wagering.
- Added pure, frozen `CyberligaWitnessChronicle`. It accepts only the exact private-certified
  `CyberligaNamedMoments` object plus exact fixture references and a `moment`/`final` presentation mode. The core
  owns no DOM, storage, clock, URL state, scheduler, network or randomness; it deterministically deduplicates and
  bounds 96 receipts / 48 kept receipts, derives athlete/team/opponent/event identity from canon, and builds an
  Athlete File chapter only from witnessed kinds and opponents.
- Persistence keeps only schema/moment/fixture/event/sport/team/athlete/kind/time/keep facts. Scores, clocks,
  replay claims, results, headlines, arbitrary copy and routes are never stored. Every load revalidates canonical
  membership and recomputes the length-framed Match Memory ID before rebuilding display copy and local routes.
  Every view states `local-witness`, `official:false`, `authoritative:false`, `wagerable:false`, `settles:false`,
  `money:false` and `prizes:false`.
- Added the versioned local adapter with same-tab change events, correct localStorage-area filtering, pre-mutation
  rebasing, delayed-event rollback rejection and an explicit durable empty reset snapshot. Multi-window storage
  regressions preserve the current two-receipt snapshot across a delayed older event. Capture/keep/remove/read
  never touch supporter XP, calls, match outcomes, standings or career stats.
- The broadcast spine retains the exact certified object privately but commits it only after a real presentation
  opportunity. Production uses a cancelable double-`requestAnimationFrame` proof; the same item must still be
  active, visible, aria-visible and in a visible document. Hide, preemption, finale replacement and destroy cancel
  the pending proof. A release audit caught and repaired the prior same-task edge where Combat could replace a
  decision card before the browser painted it; the permanent regression proves that excluded card records zero
  while each finale card records only after its scheduled paint proof.
- Release-manager trust audit found and repaired a second paint edge: hidden-tab drivers could age a card into the
  fully transparent `is-leaving` window, then let its suspended proof certify it when the tab resumed. Paint commit
  now fails closed for leaving, detached, zero-box, off-viewport, CSS-hidden or zero-opacity shells; entering the
  leaving window cancels the pending generation. Exact hidden-resume, preemption, clear and destroy regressions
  prove zero stale capture, and destroyed controllers now reset timing and refuse a finale.
- My Signal now opens with `MY NIGHT`: unread count, retained NEW state during the current open, explicit
  DEVICE-LOCAL / NOT OFFICIAL boundary, canonical athlete/team/opponent identity, 44px KEEP / ATHLETE FILE /
  12S CONCEPT / REMOVE actions and no score claim. Athlete Files insert `06 / YOUR WITNESS CHRONICLE` between
  Recent Signal and `07 / SAME COLORS`, with a local chapter and the same safe receipt controls. Actionable links
  accept only local `player.html` and `clip.html` routes.
- Official web-game QA advanced a live Soccer broadcast to certified `moment-0rmn8v9`; render state showed the
  card visible as `mode:"moment"`, spine `1.2.0`, `witnessed:true`, exact athlete/team identity and the complete
  no-authority/no-money/no-prize boundary. Three official-client state/screenshot iterations were finite and
  error-free, and the latest cyan/pink live-play capture was visually inspected.
- A six-arena browser smoke at 960x540 passed Soccer, Football, Basketball, Hockey, Baseball and Combat: Chronicle
  and Store ready, spine 1.2.0, finite state, `autonomous:true`, `interaction:"view-only"`, zero horizontal
  overflow and no console/page errors. Desktop and 390x844 My Night/Athlete chronology flows passed 1 NEW → open
  while visibly NEW → stored unread 0 → KEEP → cross-page KEPT. All actions measured 44px; phone drawer/section
  widths were exactly 390px with 390px scroll width. The four feature screenshots were visually inspected.
- Current-byte gates pass 13/13 API, 11/11 live-moment, 15/15 named-memory, 12/12 broadcast-spine, 14/14 Chronicle/
  store, 5/5 football replay-memory, 16/16 shared visual/live-cue and 28/28 football brain/rules tests, plus
  1,514/1,514 repository checks. Standalone syntax and `git diff --check` pass. This is an isolated, undeployed
  feature slice for Release Manager audit and integration.
- Next product track after this fandom loop: the audited Basketball Signature Matchup Engine, so persistent
  character memory is followed by more athlete-specific live decision-making. Official cross-device/season
  chronology remains intentionally deferred until Cyberliga has provisioned authoritative backend credentials.

## Witness Chronicle keyboard-focus release audit — 2026-07-15
- Release-manager UI audit reproduced a modal focus escape: KEEP and REMOVE synchronously rebuilt the receipt
  feed, detached the activated control and left `document.activeElement` on BODY outside the open dialog.
- My Night and Athlete File actions now use one coalesced witness-change render. KEEP restores the exact
  replacement control; successful REMOVE chooses the same action on the next then previous receipt; a final
  removal focuses the labeled My Night/Chronicle section. Failed removal retains the original action target.
  Change-event objects cannot overwrite a pending action-focus request, and the fallback sections expose a
  visible keyboard outline without entering the ordinary Tab order.
- The permanent verifier now rejects direct duplicate action renders, missing deterministic restoration and the
  event-object race. A 390x844 keyboard regression measured one feed render per action and proved the full
  same → next → previous → labeled-section sequence inside the modal; the Athlete File sequence also passed.
- Mobile Home, League HQ and Athlete File retained zero trigger/nav overlap and zero horizontal overflow. A
  poisoned persisted receipt rebuilt canonical text and same-origin `player.html` / `clip.html` routes, created
  no injected nodes or script effects, and both destinations opened with the expected local chronology and
  unverified animated-concept boundary.
- Official-client drawer capture `/private/tmp/cyberliga-witness-focus-official/shot-0.png` and focused mobile
  capture `/private/tmp/cyberliga-witness-focus-restored-mobile.png` were visually inspected with no browser error
  artifact. Combined current-byte gates pass `npm run verify` (including 17/17 Chronicle/store and 1,517/1,517
  verifier checks), football brain/rules 28/28, standalone syntax and `git diff --check`.

## Witness Store durability release audit — 2026-07-15
- Release review found that the original adapter mutated its live Chronicle before confirming `setItem`, ignored
  quota failures, treated an absent key as unavailable storage, and could therefore report success or resurrect a
  pre-reset receipt. Every mutation now stages a fresh revalidated model and swaps it live only after `setItem`
  returns. Quota/private-write failure preserves the prior durable model and returns failure; a successful atomic
  `setItem` still commits if only its follow-up verification read is unavailable.
- Once observed by an open Chronicle store, explicit key deletion and `localStorage.clear()`
  (`StorageEvent.key === null`) become a new empty reset epoch;
  same-tab deletion is detected on the next Chronicle read or action even though browsers emit no same-tab event.
  Old capture/keep/remove/read replay intents are discarded, and an actually current pre-clear or pre-reset
  snapshot is overwritten by the empty epoch rather than adopted. Missing storage is distinct from a failed read,
  so the next mutation starts from empty instead of rebuilding deleted receipts.
- localStorage cannot provide a synchronous multi-tab compare-and-swap. The adapter therefore publishes the
  honest contract `crossTab:"open-tab-optimistic-convergence"` and `atomic:false`: exact-base preflight and
  post-write checks retry ordinary conflicts, while a bounded commit lineage plus in-memory replay journal lets
  open tabs repair the remaining legal preflight-to-write fork after its storage event. This is not durable
  cross-tab serialization; a stale writer can still win before any open tab observes a raw clear. No receipt is
  official, authoritative, wagerable, settling, money, prize, XP,
  fan-call, standings or career-stat state.
- Independent exact-byte follow-up hardened both ordering bounds. Reset now derives its epoch from the later of
  the revalidated durable epoch and the live model epoch, so a same-tab `clear()` followed immediately by reset
  still advances even under a frozen clock. Revisions retain their bounded wrap but are ordered by modular
  distance: revision 1 succeeds MAX, delayed pre-wrap bytes fail closed, replay bases advance on the same ring,
  and an unacknowledged pre-wrap journal expires once it falls outside the 64-commit lineage window.
- Permanent regressions now cover quota rejection across capture/keep/remove/read/reset, successful-set/read-error
  semantics, explicit deletion, clear, stale reset/clear resurrection, both sides of `setItem` conflict detection,
  frozen-clock clear/reset epoch monotonicity, bounded revision wrap and journal expiry, deep freezing, and the
  exact two-tab A-preflight → B-commit → A-commit fork converging to both receipts. Current bytes pass 22/22
  Chronicle/store tests, the complete `npm run verify` gate with 1,517/1,517 repository
  checks, football brain/rules 28/28, standalone syntax and `git diff --check`.

## Home “World Desk” de-AI pass — 2026-07-23
- Scope is the canonical `world.html` Home surface only, implemented in the isolated `codex/menu-de-ai`
  worktree from canonical HEAD `7da47e3a6c8c46d0922d7377a86e84b070bfcb37`. This slice is not deployed and
  must go through Release Manager integration.
- Replaced the synthetic cyber-dashboard hierarchy with a calm sports-desk composition: one 64px masthead, the
  existing globe, and one opaque `Tonight` schedule rail. Removed the visible manifesto/proof layer, frame,
  launcher, nested mobile game carousel, separate preview modal, scanlines/glass/glow treatment, My Signal
  trigger, World Pulse, “WHY THIS MATTERS,” fake heat/local-watcher language, league/game codes and repeated
  `ENTER` actions from the resting Home screen.
- The selector preserves all seven filters, 24 game links, 48 canonical club crests, six sport destinations,
  filter/query history, Home/Leagues-only primary navigation, presence/livebridge hooks and supporter/Mythos
  state decoration. Rows now lead with ordinary sport names, title-cased full club names, canonical crests and
  truthful `Live · clock` / `On air` state. Filters are native pressed buttons in a labeled group rather than
  claiming unsupported ARIA tab behavior.
- Globe routes are quiet at rest and only the selected matchup is emphasized. Fixture focus/hover selects exactly
  its two endpoints without moving the camera. Browser QA exposed a real canvas failure where hover immediately
  moved a pin before mouse-down; hover now holds the pin still and caches its exact target, while deliberate click
  selects the fixture, scrolls it into view and starts the globe move. The compatibility hook now truthfully
  reports `preview.open:false` / `selected:true` while no modal is rendered.
- Exact 1280×720 interaction QA passed all All/Soccer/American football/Basketball/Hockey/Baseball/Combat filters:
  All returns 24 rows / 48 endpoints / 48 crests and each sport returns 4 / 8 / 8 with the correct query state.
  The rail is 410px, five fixture rows are visible, document size is exactly 1280×720, navigation is exactly Home
  and Leagues, every arena href is canonical, and console/page/request errors are empty.
- Exact 390×844 QA passed with document size 390×844, the schedule beginning at 430.45px, a 372px-wide vertical
  drawer with no horizontal overflow, 24 rows / 48 crests in All, 4 / 8 after Basketball filtering, working
  vertical scroll, no visible text below 12px, and no My Signal or World Pulse nodes. The final mobile screenshot
  is `/tmp/cyberliga-world-desk-mobile-release-v2.png`.
- Independent audits caught two hidden parity failures and both are repaired. The visually clipped presence node
  can no longer be overwritten with `1 WATCHING · LOCAL`; its accessibility-tree text is the static truthful
  `Schedule updates automatically` with no ARIA live property. At 1024×768 on a touch device, the desktop side
  rail now reports `compact:false`, computes `touch-action:pan-y`, scrolls through its 2,594px schedule and has
  zero document overflow. The Cyberliga Home link also measures a 44px touch target.
- The final canvas regression hovered New Orleans without camera motion, then clicked it to select exactly the
  New Orleans Bayou Kings–Atlanta Peaches fixture, expose the canonical `football.html?fixture=0` state, scroll
  the row, and begin the deliberate globe move; the old modal stayed hidden and browser errors were empty.
- The required official web-game client ran against the exact accessibility/tablet/state-corrected bytes. Its
  inspected screenshot and finite state are in `/tmp/cyberliga-world-desk-official-final`; no error artifact
  was produced.
- Current-byte gates pass `npm run verify` with 13 API, 11 athlete-moment, 15 named-moment, 12 broadcast-spine,
  22 Chronicle/store, 5 football replay-memory, 16 shared-visual tests and 1,534/1,534 repository checks.
  Football brain/rules pass 28/28; standalone syntax and `git diff --check` pass.
- Remaining non-code gate: the proposed five-person, five-second comprehension test is an external audience test
  and is not self-certified here. Release Manager still needs to audit/cherry-pick this feature and run the full
  canonical six-arena production gate before any deployment.

## World Desk release-audit repairs — 2026-07-23
- Release review found that the desktop schedule hid Hockey, Baseball and Combat beyond a scrollbar-free filter
  strip. Desktop/tablet now show all seven filters in a two-row four-column grid; phone layouts retain the
  intentionally touch-scrollable horizontal rail with 48px targets.
- Soccer city-marker closures and route geometries now rebind to the current canonical matchup whenever the
  six-minute universe slot changes. The selected pin is also remapped by stable team identity, so a long-lived
  Home tab cannot open or emphasize a fixture that no longer contains the chosen club.
- Escape now closes only an actual pin selection. With the separate preview modal intentionally absent, pressing
  Escape on an ordinary filter or fixture no longer clears state or moves keyboard focus back to Home.
- Added permanent verifier contracts for all-visible desktop filters, rollover rebinding and guarded Escape
  behavior. Targeted rollover, focus and responsive browser proofs are part of the Release Manager gate.

## World Desk organic match-night follow-up — 2026-07-23
- Release review found that the first restrained pass still read like a clean fixture database: its filter strip
  clipped sports, every row repeated the same telemetry, and the globe did not explain why a matchup mattered.
  All seven filters now remain visible in a fixed two-row grid at every supported size, with 46px desktop and
  44px phone/short-landscape targets and no hidden horizontal carousel.
- The schedule is now grouped by the six canonical league names, with one shared live/on-air state in each
  league header. Compact rows contain only the two real crests, full club names and an entry chevron. The default
  lead is the real New York Brownstones–Toronto Lake Effect reciprocal rivalry: the shared Founding renderer
  draws #53 Stoopy, the copy names #3 Toque, both club cities and The Block, and the whole row remains the exact
  `hoops.html?match=1` broadcast link. Every sport deterministically receives one nonblank Founding-character lead.
- The globe and schedule now tell the same story at rest. Close rivalries frame both selected cities, labels and
  route; transoceanic fixtures keep the globe useful by focusing the featured character's city instead of
  shrinking the Earth or hiding both endpoints. Other routes disappear and other pins remain quiet. Pointer
  hover changes emphasis without moving the camera; pin click selects the exact fixture; Escape returns to the
  editorial lead; filter query back/forward state remains intact.
- Removed the entire 299-line legacy inline dashboard stylesheet and detached glass preview markup/logic rather
  than merely overriding them. The external sheet now owns the intentional matte rules, visible scrollbar,
  accessible clipped presence text and filter behavior. Consumer metadata no longer leads with “autonomous”
  technology language. The stale five-league glass-dashboard social image was replaced by an honest 1200×630
  capture of the current six-sport World Desk and Stoopy–Toque lead.
- Final visual QA passed at 1280×720, 1024×768, 390×844 and 900×520. The phone board occupies y=396.69–844,
  has zero document overflow, shows all seven 44px filters, one 123px lead and two additional 68px fixtures.
  Short landscape uses a full-height side rail from y=56–520 with two selected labels and no 84px dead zone.
  Instrumented browser runs reported no page, console, request or HTTP errors.
- The clean desktop/phone seven-filter matrix passed: All is 24 fixtures / 48 endpoints / 48 crests and every
  sport is 4 / 8 / 8, with one lead, two selected pins, nonblank procedural portrait pixels and canonical arena
  hrefs. Soccer rollover rebinds marker closures/routes by stable club identity, and guarded Escape never steals
  focus without a real selection.
- The required official client passed on exact final bytes in
  `/tmp/cyberliga-world-desk-organic-final-official`: finite 24/48/7 state, Stoopy and Toque as the lead,
  `focusMode:"match"`, two labels/two pins, zero interactive routes and no error artifact.
- Current-byte gates pass `npm run verify`: 13 API, 11 athlete-moment, 15 named-moment, 12 broadcast-spine,
  22 Chronicle/store, 5 football replay-memory, 16 shared-visual tests and 1,545/1,545 repository checks.
  Football brain/rules pass 28/28; standalone module syntax and `git diff --check` pass.
- Release integration removed a one-second refresh that overwrote the featured `vs #…` / `Rivalry` / `Featured`
  kicker with a duplicate live clock. The named-league header remains the single shared status surface, and a
  verifier regression now protects the editorial lead copy.
- The proposed social card hardcoded its capture date even though its metadata promised “Tonight.” Release
  integration recaptured the exact 1200×630 Match Night surface with the evergreen “Around the world” line,
  added descriptive OG/Twitter alt text, visually inspected the result, and pinned its audited bytes in the
  verifier so a stale dated replacement cannot silently return.

## Six-sport character and watchability pass — 2026-07-24
- Current user goal: improve the characters and gameplay of all six autonomous broadcasts as much as possible,
  making every game smoother and more entertaining to watch. This is an isolated feature branch from canonical
  `fef34ab`; it must not deploy directly.
- Baseline live desktop inspection covered Soccer, American Football, Basketball, Hockey, Baseball and Combat.
  The simulations are already mechanically richer than the earliest prototype, but athlete identity is uneven,
  cameras can lose the decisive action, transition beats sometimes look static, and several arenas spend too
  much of the frame on repeated crowd geometry or empty playing surface.
- A concrete shared identity gap is now repaired: canonical data already authors 416 names, roles, archetypes,
  temperaments, silhouettes, signatures and team motion languages, while the classic capsule renderer previously
  gave nearly everyone the same runtime-random gait. New pure `classic-character.js` creates a deterministic,
  frozen performance fingerprint for every canonical athlete. `blobrig.js` now applies it to body proportion,
  stride cadence, breathing, planting, cut response, lean, sway, action amplitude and the default celebration,
  while preserving the exact cyan/hot-pink live-player palette and existing Founding silhouette cues.
- Character tests prove hash/profile determinism, six-sport role classification, Founding motion identity,
  bounded finite renderer parameters and 416/416 distinct canonical fingerprints. No sporting outcome depends on
  this renderer-only layer.
- Live audit found a severe Combat camera failure during a real R1 knockdown: both fighters left the desktop
  frame while the camera held an empty octagon. Football likewise held a turnover-return transition with the
  action cluster cropped to the left and a large empty midfield area. Both exact states were handed to their
  sport owners as required regression checkpoints.
- Compact-portrait inspection found a second cross-sport failure that zero document overflow had hidden: fixed
  internal HUD widths visibly clipped the away club and live situation copy in Soccer, Basketball, Hockey and
  Baseball. The exact score/event states were handed to each sport owner; final phone acceptance now requires
  both clubs, the score/clock and the bounded action label to remain inside the 390px visual safe area.
- Sport-local behavior, pacing, camera, replay and full-event improvements were implemented in parallel for
  Soccer/Football, Basketball/Hockey and Baseball/Combat, then reconciled into this single feature tree. The
  required official-client, deterministic full-event, desktop and 390x844 evidence is recorded below.
- Completed sport passes:
  - Soccer stages a readable passer/receiver/marker story with receipt and pressure lanes, a shoulder-check beat,
    focused name tags, a deterministic pass-read hook, a single bounded portrait angle and shorter dead-ball holds.
  - American Football selects the actual live or recorded subject for reads, catches, contact, loose balls and
    reverse-direction returns. Its camera, HUD badge and state telemetry now agree on the same named athlete while
    preserving the existing adjudication and truthful replay-certification path.
  - Basketball gives each role stable tendencies and adds deflections, genuine 50/50 recoveries, charges,
    athlete-weighted finishing/rebounding, faster inbounds and deterministic event-camera/outcome telemetry.
  - Hockey gives each role stable ice tendencies and separates board battles and stick lifts from rarer full body
    checks. One-timers, slap shots, blocks, goalie tracking/rebound control and stoppage pacing now use those traits.
  - Baseball adds deterministic batter/pitcher/fielding profiles, count-aware matchup reads, athlete-influenced
    recognition/barrel/range/arm decisions, result-tier presentation, sectional crowd response, a complete
    portrait-diamond camera and shorter routine transitions. Per-frame crowd colors use cached objects.
  - Combat maps all six canonical roles to distinct styles, signatures, guards and cadence; each strike exposes
    anticipation, delivery, impact, follow-through and recovery. Clinch work is scored and visible, crowd response
    is sectional, and a projected-frame safety check keeps both fighters on screen through knockdowns.
- Deterministic browser evidence on the final feature bytes:
  - Soccer same-seed full games both ended 1-3 with identical possession/shots/xG/offsides and top-three IDs.
    Football same-seed games both ended 3-22 with identical last event and top-three IDs. The forced football
    interception return and its certified replay both focus the actual carrier.
  - Basketball forced deflection and charge accounting is single-write and finite; its full game ended 26-33.
    Hockey forced board battle, stick lift and block each increment once; its full game ended 1-0 in overtime with
    exact shots-on-goal truth (`team shots = team goals + opponent saves`).
  - Baseball forced SINGLE advances LIVE to POSTPLAY and a seeded full game held a real 1-0 FINAL. Combat browser
    QA passed 25/25, including ordered signature phases, scored clinch work, desktop/mobile count framing and a
    260-second soak that completed a bout without using its 238-second per-event backstop.
- Official web-game client screenshots were visually inspected for all six sports. Direct 390x844 plus 430/433px
  audits keep scores, clubs/codes and event strips inside the visual safe area with no horizontal overflow. Every
  arena retains classic cyan/hot-pink athletes, autonomous/view-only interaction and truthful recorded-footage
  provenance. Fresh console, page and request errors are empty.
- Final local gate on current bytes: `npm run verify` PASS (122 tests plus 1,544 static/data checks);
  `node --test footballbrain.test.mjs footballrules.test.mjs` PASS 28/28; new-module syntax and `git diff --check`
  PASS. The feature remains isolated and undeployed pending Release Manager integration.

## Six-sport release-audit repairs — 2026-07-24
- Release review found a hockey scoring edge where a slow puck could cross the goal line inside the mouth and
  then be reclassified as a crease cover. Goal-line adjudication is now a pure versioned module: any valid
  crossing scores unconditionally, while a goalie may cover only on or in front of the line. Behavioral
  regressions cover both the slow-crossing goal and the pre-line save.
- A drawn basketball charge previously resumed with a live outlet pass from the foul spot. Charges now enter the
  existing dead-ball retrieval, baseline, ready and inbound-pass sequence before the new possession can advance.
  Source and browser regressions protect the staged inbound.
- The merged verifier retains the World Desk release guards and adds permanent contracts for both adjudication
  repairs. Canonical World Desk markup, styling and evergreen social-image bytes remain unchanged from the prior
  production release.


## 2026-09-10: sports network UI overhaul
- User requested a dramatic aesthetic improvement before noon while preserving the games.
- Feature branch `codex/noon-ui-overhaul` starts from canonical `41fc71e6205a2fc63abdfd47bbd428515a89229d`.
- Unified Home, League HQ, Athlete Files and all six broadcasts around self-hosted Manrope / Barlow Condensed, charcoal surfaces, cobalt branding and canonical club crests.
- Broadcast chrome now prioritizes readable scores and the game. Portrait play descriptions occupy a reserved footer below the canvas; actual game painting, sprites, simulation and seeded decisions are unchanged.
- Home preserves the globe and 24-fixture network, adds a first-fold phone watch action and native vertical schedule browsing.
- League HQ uses compact match and club grids, accessible roster/profile tabs, full football roster filters and honest venue/kit concepts in secondary detail. Removed illustrative standings from the public UI.
- Athlete Files use genuine canonical identity, real pixel portraits, named signatures, club rivalries and teammate links. Removed generated form/career statistics and fictional news presented as a feed.
- Sharing supports native share, clipboard, useful fallback copy and repeated taps without permanently changing button labels.
- Baseball synthetic depth entities keep rendering but are excluded from canonical athlete-profile recommendations; unresolved links fall back to club HQ.
- Browser evidence: `output/noon-broadcast`, `output/noon-home`, `output/noon-player-audit`, `output/noon-audit`, `output/network-ui`; League evidence additionally in `/tmp/noon-ui-audit`.
- Targeted QA: all six broadcasts × desktop/phone/landscape; 48 club identities; football offense11/defense11/full22; player long names and twelve founding characters; native/copy/unavailable/repeated sharing; six complete page journeys. No page/console/request errors or horizontal overflow.
- Release worktree inventory records all28 heads. Canonical clean; rejected root has38 pre-existing changes. Nine historical worktrees did not answer bounded filesystem status queries and are explicitly excluded from integration.
- Release Manager must integrate only this feature and run the complete canonical gate before deploying.
