Original prompt: Rebuild Cyberliga as a comprehensive five-sport, 40-club world using the seven uploaded concept boards as the quality and world-building reference; give every club a unique city identity, crest, uniforms, stadium, crowd culture, and premium League HQ; retire the Watch tab, move Leagues to the second navigation position, and keep combat out of the public rollout for now.

Previous original prompt preserved from the earlier work log: Can you make boxing work way better? Make the actual fighting and animations and shit way better, you might need to make the characters better too /goal

## Five-Sport World Identity Rebuild — 2026-07-13
- The seven concept boards are visual inspiration, not a seven-team canon. The rejected soccer-first 7-club / 21-kit / 49-athlete iteration remains non-canon prototype material.
- Canon for this pass is five sports, eight clubs per sport, four simultaneous fixtures per league: 40 clubs and 20 channels. Combat remains implemented but is removed from public navigation and counts.
- Product direction: Home → Leagues → Community → Replays, with live arenas as contextual actions instead of a standalone Watch destination.
- Visual direction: one city-rooted motif repeats through a native SVG crest, three authored uniform treatments, venue architecture, crowd ritual, and broadcast language; AI venue plates contain no text or logos so brand marks remain exact in code.
- Added `branddata.js` as the five-league identity manifest: 40 unique clubs with city display names, named venues, architecture, crowd rituals, competitive statements, color systems, motif-specific SVG crests, three sport-shaped kit treatments, and code-native city/stadium scenes.
- Rebuilt `league.html` as the public League HQ with five league switches, 20 live channels, all 40 club cards, deep-linked dossiers, venue/crowd/play identity, three uniform variants, complete rosters, identity-safe standings, fixtures, athlete FILE/WIRE links, and deterministic browser hooks.
- Generated five original, text-free cinematic league venue plates with GPT Image using the supplied boards as visual references, then optimized them locally under `assets/world/league-heroes/`; every club-specific crest, kit, and city treatment remains deterministic SVG/UI art rather than generated text or marks.
- Retired Watch as a public destination: `menu.html` now preserves old links while redirecting to League HQ, the public shell is Home → Leagues → Community → Replays, and the local/production root contract points to the world page. Direct legacy Combat remains available but is absent from public tabs, selectors, counts, and random content.
- Responsive browser QA covered every club at 390×844, all five league heroes, channel grids, club cards, dossiers, kit treatments, standings scrollers, mobile arena drawer, and the football offense/defense roster filters. Every page remained viewport-wide with no browser or console errors.
- Final `npm run verify` passes 9 API tests, the 7-club prototype compatibility contract, 11 deterministic soccer tests, and 1,458 repository checks across six preserved arenas, five public leagues, 40 branded clubs, 20 channels, 368 public athletes, routes, hooks, deployment config, and local assets. No deployment, staging, or commit was performed in this task.

## American Football Realism Overhaul — 2026-07-13
- Current prompt: permanently remove every 2D overhead football view; remove the three-play / "Snap the Ball" interaction; make catches, possession, running, jukes, ball flight, contact and tackles visibly believable; and make field-goal rulings agree with the kick shown.
- Audit found the local football route is entirely 2D. The deployed route also contains that same overhead renderer as a startup/failure fallback beneath remotely loaded Three.js, which explains why it can appear intermittently.
- Field goals currently pre-roll a random `good` boolean while rendering every kick on the same straight visual path with no uprights. The new ruling must be generated from the same physical crossing of the visible goalpost plane.
- Implementation direction: one local-dependency 3D broadcast renderer only; automatic situational play calling and cadence; player-level possession/contact states; and deterministic test hooks that expose ball velocity, catches, tackles, jukes, and kick crossing truth.
- Replaced the overhead game and its fallback with a single local Three.js perspective broadcast. The page now fields 22 procedural football athletes, fixed painted end zones, possession-aware field direction, broadcast cameras, visible lines/goalposts, responsive HUD and a touch/keyboard juke control. The retired play picker and manual snap button no longer exist.
- Rebuilt play execution around authoritative ball ownership and physical states: snap, carry, ballistic pass, contested catch, incompletion, interception, loose fumble, punt and kick. Receivers secure and turn upfield; defenders pursue, wrap, gang tackle, break tackles, force/recover fumbles and return turnovers; pass rushers can now sack the quarterback.
- Corrected possession/rule edges found during independent audit: punt-return fumbles and double turnovers cannot freeze or lose a new series, return tackles use the correct side/direction, goal-line contact produces touchdowns/safeties, exact gains control first downs, and pending turnovers/PATs survive an expiring quarter.
- Field goals now score only from the interpolated visible crossing at the real goal plane. Forced QA passed good, wide left, wide right, short, upright, crossbar and blocked branches; only the good kick added three points. Home and away kicks render toward their fixed physical goalposts.
- Final QA passed syntax, `git diff --check`, 1,219 repository checks, desktop/mobile Playwright branches, 390×844 no-overflow/single-WebGL assertions, fixed-direction away possession, catches, tackles, jukes, interceptions, fumbles, punts, end-of-quarter takeover, and the official game client. Final client artifacts are in `football-artifacts/final-short/`; no console-error artifact was produced.
- Follow-up prompt: remove the photographed Broadcast Coach Mode / three-card pre-snap panel completely, stop the ball from visibly spawning at a random new location after each whistle, and make the automatic game reset and overall play flow smooth.
- Reworked the between-play presentation around continuous field state. A possessed ball now remains at the exact down point through the whistle and fades out only at the end of the dead-ball beat; unowned incompletions, punts, and kicks disappear immediately after their physical outcome; the official next spot is hidden during relocation and fades back in. Same-possession players retain their whistle positions and jog into the next formation over a 0.92-second transition before the automatic cadence rather than teleporting all 22 athletes.
- Tightened routine dead time and pre-snap timing, continued tackle/fall/celebration animation through the dead-ball phase, and mapped blocking, bracing, jukes, and a tucked-football carrying pose into the shared human rig. Added reusable player motion objects, bounded the fixed-step catch-up loop, lowered excessive DPR, skipped inert crowd uploads, replaced thousands of detailed mesh-shadow draws with 22 instanced field shadows, and disposed possession-swap gear geometry correctly.
- Measured the original whistle-to-reset cut at a 21.83-yard maximum player teleport. The replacement's first visible reset frame moved only 0.076 yards, with the relocated spot ball at opacity 0; players then moved at a capped 7.2 yards/second and reached the formation before the snap. Headless rendering reported 1,135 draw calls after the shadow pass (down from 2,341 with the prior blanket mesh shadows), and possession rebuilds no longer accumulated GPU buffers.
- Follow-up browser regression passed complete catch into run-after-catch, tackle contact, juke, interception return, live fumble recovery, punt return, incomplete-ball hiding, and good/wide-left/wide-right/short/upright/crossbar/blocked field goals with zero console errors. Only the physically good goal-plane crossing scored. Syntax, `git diff --check`, the official game client, and the complete 9 API + 11 soccer + 1,219 repository verification gate remain clean.
- Deployment audit found the photographed live Vercel page is byte-identical to older commit `d7f6b2d` in a separate deployment worktree, so it still contains the retired Coach Mode panel, manual snap handlers, and the CDN-backed overhead fallback. The current workspace route contains none of those paths; publishing remains a separate release step so unrelated dirty workspace work is not accidentally included.
- Current prompt: fully build the compelling-football roadmap—adaptive strategy, authored team/player identity, consequence, broadcast rhythm, audio, replays, and persistent stories—and ensure the football is not continuously rotating.
- Started the new vertical slice by making visual rotation authoritative to ball physics: passes spiral from simulated spin, kicks/punts tumble end-over-end, loose balls tumble irregularly, carried balls stay tucked, and spotted/held/dead balls remain still. The prior renderer rotated the mesh every frame regardless of state.
- Replaced random situational calls with authored team DNA and adaptive coordinator memory. All eight clubs now favor distinct concepts, learn opponent run/vertical/screen/blitz tendencies, penalize repeated calls, remember individual line matchup edges, and expose a causal reason for each adjustment.
- Derived role-aware football traits from every athlete’s identity, signature, archetype, and flaw. Those traits now drive speed, acceleration, blocking, coverage, QB processing, ball placement, catch windows, runner vision, tackling, fatigue, wear, and game-long availability/performance loss.
- Rebuilt pass execution around an actual ordered QB progression. The quarterback confirms physical separation/leverage/safety overlap, speeds up against pressure, reaches hot/checkdown answers, scrambles through a real escape lane, throws away outside the pocket, and can escape a sack before becoming a credited runner.
- Replaced preset run targeting with continuously rescored physical creases using blocker leverage, traffic, first-contact depth, pursuit, edge force, cutback space, second-level space, and runner vision/patience. Man, zone, robber, quarters, pressure, and heavy-front calls now produce distinct coverage/rush behavior rather than every defender chasing the ball owner during the dropback.
- Added a TV-style broadcast package: bottom network scorebug, integrated down/distance/field position/play clock, consolidated lower thirds, restrained graphics, clean sideline continuity camera, procedural crowd/effect audio behind a user sound toggle, and no arcade player labels or targeting rings.
- Added deterministic recorded-state instant replay for touchdowns, turnovers, field goals, contested catches, sacks, and explosive plays. Replay freezes the live transition, renders the actual stored athlete/ball frames at broadcast speed, shows an instant-replay bug, and returns to the exact pending dead-ball state.
- Added causal pre-snap/live penalties (false start, encroachment/offsides, offensive holding, DPI), enforcement/decline logic, nullified-play stat rollback, a real 25-second play clock, explicit stopped/running game-clock states, and late-game timeout decisions. Focused brain/rules tests pass 28/28.
- Added team/player game statistics, persistent matchup records and player career totals in local storage, rivalry/last-meeting context, fatigue/contact wear across possessions, player-of-the-game selection, and play explanations built only from the resolved pressure/window/lane/contact facts.
- Closed the remaining physical-flow gaps found by independent soak QA. The quarterback and running back now converge on one exchange point, the ball visibly interpolates through the mesh, and ownership transfers only at close range. A mesh player is never treated as an advancing carrier, eliminating the old handoff teleport and phantom own-end-zone safety.
- Calibrated the run game around concept-correct geometry and visible assignments: inside zone and power stay in A/B gaps, outside zone stretches before a physical one-cut, and read option keys a deliberately unblocked edge defender whose crash/contain movement causes the keep/give. The final 100-play mixed sample averaged 4.19 yards with six losses and six 10+ gains; 100 option snaps matched the visible edge assignment on every decision.
- Corrected deep-ball lead and timing so all sampled vertical throws reached a real catch point instead of landing several yards behind the receiver. The final 40-attempt sample put every ball within the catch radius and completed 55%, while pressure, incompletions, and sacks remained live outcomes. Four-man rush speed and escape geometry now produce real but non-guaranteed sacks.
- Hardened football bookkeeping around the same physical events: fumble yardage ends at the fumble spot rather than the recovery/return spot, double turnovers finish the original ledger, return-team fumbles count against the correct club, sack-safeties remain sacks, exact unrounded gains control chain movement, penalty first downs update team/drive totals, and interceptions or large negative plays cannot be mislabeled as offensive explosives.
- Final state proofs show spotted and dead balls holding zero velocity/spin/visual rotation, carried balls staying at spin zero in a fixed tuck while following the runner's facing, and only passes, kicks, punts, or live loose balls rotating. Dead-ball sync guards prevent a moving runner from repopulating ball velocity after the whistle.
- Final browser QA passed the official game client, a 390×844 no-overflow live handoff, the user-unlocked procedural stadium sound control, a recorded-state field-goal replay whose visible x=110 crossing and `good` ruling agree, two final full-game soaks, and all 28 focused football brain/rules tests with no console errors. Repository verification remains clean at 9 API + 11 soccer tests + 1,221 contract checks. Final captures are in `football-artifacts/final-client-v2/`, `football-artifacts/final-mobile.png`, and `football-artifacts/final-field-goal-replay.png`.
- Follow-up prompt overrides the earlier spin treatment: the ball must remain completely still in every pass, catch/carry, contested catch, fumble, punt, dead-ball, spotted/pre-snap, and non-kick replay state. Rotation is now reserved for physical place kicks (field goals/PATs) and the future physical kickoff path only.
- Removed both sources of false rotation: pass/loose/punt simulation no longer accumulates spin, and the renderer no longer reorients a pass along its arc or a carried ball with the runner's facing. All non-place-kick states use one invariant zero rotation; replay snapshots store normalized zero spin plus kick-type metadata so an after-whistle replay cannot resurrect stale pass/carry/fumble rotation.
- Whistles now hide the dead ball immediately instead of leaving a detached carried mesh behind while athletes finish their fall animation. The next official spot still fades in at the deterministic line of scrimmage and remains stationary through cadence.
- Browser state-matrix QA passed spotted, pass, contested catch, run-after-catch/juke, dead/tackle, loose fumble, punt, and non-kick replay states at two sampled times each: every sample held spin 0 and visual rotation (0,0,0). The dead ball stayed invisible at opacity 0; the positive-control field goal advanced from spin/rotation 0 to 3.6. The official web-game client and reviewed pass/dead screenshots are in `football-artifacts/ball-rotation-proof/`, `football-artifacts/ball-rotation-pass.png`, and `football-artifacts/ball-rotation-dead.png` with no console errors.
- Final regression gate passes syntax, `git diff --check`, 28 focused football tests, 9 API tests, 11 soccer simulation/identity tests, and 1,235 repository contract checks.

## Cyberliga Soccer Rebuild — 2026-07-11
- Current user goal: implement the approved soccer-first rebuild with an interactive globe and club dossier, seven cinematic city identities, 21 authored kit designs, distinctive stylized athletes, and a slower deterministic 5–6 minute 7v7 broadcast match.
- Approved product locks: globe-with-dossier homepage, stylized broadcast athletes, cinematic local city backplates, kits plus fixed athlete identity, Seoul vs Atlanta quality gate, core football laws, and a 7v7 canonical league.
- Parallel implementation ownership: `match*`/simulation, `athleterig.js`, and `home*`; root owns canonical club/fixture/kit contracts, generated/local art assets, integration, and end-to-end QA.
- Preserve the older multi-sport files as dormant experiments, but remove them from the new public soccer navigation.
- Canonical contract upgraded to `CyberligaSoccer` v2: seven locations/visual records, deterministic face/body/movement DNA for all 49 athletes, 21 unique layered kit signatures, one 300-second/60 Hz 7v7 broadcast config, and `getBroadcastState()` with three fixtures plus the bye.
- Added one shared layered kit renderer (`kittexture.js`) for Locker canvases and Three.js athlete textures, plus seven original local SVG crests.
- Generated and visually reviewed seven original stadium/city scenes from the approved reference boards, then exported 2400×1350 desktop and 1080×1350 mobile WebP assets. Added local NASA/Three globe textures and removed runtime texture CDN dependence from the new asset set.
- Added `npm run test:soccer`; current contract gate passes 7 clubs, 49 athletes, 21 unique kits, complete local art, and valid broadcast participation.
- Mobile camera follow-up: replaced the near-overhead portrait lens (17–26m high and only 2–6m behind the action) with a lower, farther-back angled lens. The wider 57–60° framing still carries a large local pack while restoring visible athlete, goal, and stadium depth.
- Verified the new phone lens at 390×844 in live play, moving play, midfield attack, and corner/restart compositions. The ball and relevant athletes stayed framed, player bodies and shadows retained clear depth, the terrace remained visible, and all browser console checks were clean. The required web-game client, soccer contract suite, soccer identity tests, syntax check, and `git diff --check` also passed.

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

## Basketball Player Silhouette Pass — 2026-07-13
- Current prompt: remove the cone/foot-like attachments from basketball players and revamp their appearance.
- Identified the artifacts as role-specific decorative geometry in `hoops.html`: a literal cone above shooters and three root blobs around centers' feet.
- Replaced all five role ornaments with one coherent basketball treatment: articulated arms and legs, sneakers, wrist/collar/waist trim, and restrained team-color emissive accents.
- Reduced the most extreme procedural height/width multipliers so athlete identities remain distinct without turning into distorted cones or barrels.
- Visually checked tip-off and live half-court play at 1280×720, then reduced sneaker volume and lifted arm skin tone after the first render made those details too prominent.
- Official web-game client produced a clean screenshot/state pair with no error artifact. Module syntax, `git diff --check`, 9 API tests, 11 soccer tests, and all 1,221 repository verification checks pass.

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

## Unified App Workflow / Six-Sport Gameplay Rebuild — 2026-07-10
- User identified the core product problem correctly: polished presentation is masking shallow
  gameplay, while the world, guide, leagues, community, replays, profiles, and studios still
  behave like separate microsites instead of one application.
- Began a two-wave arena rebuild with strict file ownership: soccer, American football, and
  basketball first; hockey, baseball, and combat next. Each pass must improve actual decision
  and outcome logic, visual causality, pacing, full-game balance, crowd/camera readability,
  deterministic parity, and mobile presentation rather than adding more descriptive UI.
- Added a shared product shell to every non-arena support route. It provides the same Home,
  Watch, Leagues, Community, and Replay workflow, preserves the selected sport across pages,
  exposes a one-click continue-live action, and opens one six-arena switcher everywhere.
- The shared shell replaces redundant local navigation while leaving each page's useful local
  identity and status header intact. Desktop uses a persistent top bar; mobile uses a compact
  safe-area bottom dock and full-height arena switcher.
- Fixed an existing League Atlas mobile overflow caused by grid children refusing to shrink.
  All nine shell-enabled routes loaded at 390x844 with no console errors; the corrected Atlas
  has zero horizontal overflow, and desktop/mobile shell and drawer screenshots were inspected.

## Soccer Match-Flow Rebuild — 2026-07-10
- Reworked the page-local soccer loop around controlled passages rather than isolated actions:
  stable possession phases, completed-pass chains, give-and-go return runs, physical crosses,
  two-player counterpressing, separated counterattack lanes, and pressure-aware goalkeeper
  distribution now change actual positions, targets, decisions, and ball flight.
- Shot execution now reflects distance, nearby pressure and fatigue. A calibrated xG/chance
  ledger and possession/transition state are exposed through `render_game_to_text`; ball velocity
  is included so deterministic QA can reconcile what the broadcast shows.
- Added a subtle pitch-level ball locator and fading pass line, predictive live-camera lead, and
  a minimum replay-camera distance so wide play stays readable and goalmouth replays do not turn
  into body-filling closeups. Classic blobs, shared UTC channels, and the GameHub remain intact.
- Added deterministic `exhibition`, `seed`, `manual`, and `hold` query gates for full-match QA;
  they do not alter the public selector, which still joins the canonical live channel.
- The prescribed web-game client passed after both gameplay deltas with no error artifact.
  Deterministic twins were byte-identical at 90 simulated seconds. A 480-second soak reached
  full time at exactly 240.0 match seconds (1-2) with 55 completed passes, 60 controlled
  turnovers, 23 chances, and no console errors.
- Desktop gameplay captures and the 390x844 transition capture were visually inspected. Mobile
  retained zero document overflow, a readable pitch/score/context stack, and clean console logs.

## Soccer-First Visual Reset — 2026-07-10
- New product direction supersedes the six-sport handmade/blob character exploration: build one
  premium AI-native soccer league first, then earn expansion into other sports later.
- User-provided visual source of truth: Seoul Signal, Dubai Mirage, Atlanta Overdrive, Los Angeles
  Halo, Houston Apogee, Mexico City Eclipse, and Tokyo Ghostline club boards. The shared language is
  black technical material, cinematic night arenas, restrained high-energy club light, premium
  garment presentation, city-specific identity, and sharp broadcast typography.
- Character assumption for the first vertical slice: stylized but recognizably human professional
  athletes. Do not ship blobs, mascot bodies, fantasy GLBs, robots, or the tactile maquette direction.
- Required live-player contract: one consistent rig and animation skeleton with modular body/face/
  hair identity plus swappable club kit, goalkeeper kit, boots, accessories, number/name, and later
  limited-edition cosmetic variants. Simulation identity and visual loadout must remain separate.
- Scope gate: soccer only until a complete match, close-up replay, player profile, and skin swap all
  show the same athlete at acceptable visual quality and performance.
- Reset implementation started as new public files rather than another layer on the retired app.
  `home.html` will become the root, while `match.html` is a fresh autonomous 7v7 broadcast built
  around Seoul Signal vs Atlanta Overdrive and a live player-skin drawer.
- Added `soccerclubs.js`: the seven approved city clubs, 49 stable human athlete identities,
  renderer-ready home/away/third kits, and a correct seven-round schedule with one bye per club.
- Added the first new-match simulation/stadium foundation with deterministic passing, pressure,
  shots, saves, goals, celebrations, compact text state, deterministic time stepping, and skin
  switching. Athlete rendering and landing-page integration are in progress before visual QA.
- Local and Vercel root routing now targets the soccer-first home; the retired multi-sport routes
  remain present only as non-root reference implementations while the vertical slice is evaluated.
- Completed the new soccer home at desktop and mobile breakpoints: seven selectable founding clubs,
  procedural city/stadium scenes, premium kit cards, club dossiers, and direct match/Skin Lab CTAs.
- Completed `athleterig.js`, a cached low-poly human rig with stable body/face/hair DNA, real garment
  material zones, numbers/crests, goalkeeper equipment, identity accessories, and authored soccer
  actions. A 14-athlete render stays near 22k triangles and supports in-place cosmetic swaps.
- Completed the first fresh autonomous match: role-correct 7v7 shapes, passes, pressure turnovers,
  shots, keeper saves, goals, celebrations, full time, reactive crowd/camera, and compact broadcast UI.
  Fixed a saved-shot state bug found by the long simulation gate and corrected formation roles.
- Required game-client gates passed for opening play, mid-match, full time, Skin Lab, and a live third-
  kit swap with no final console errors. The deterministic soak finished Seoul 3–2 Atlanta at 90:00.
- Visual captures inspected: desktop home, mobile home, live broadcast, goal close-up, skin drawer,
  applied third kit, mobile match, and mobile full-width Skin Lab. Final `npm run verify` passes 9 API
  tests plus 1,090 application/data/route/skin invariants; `git diff --check` is clean.
- Art-direction checkpoint for user review: the system is now structurally skin-ready and visually in
  the requested premium soccer language. The next iteration should react to feedback on human stylization,
  broadcast camera distance, stadium realism, and whether the first athlete close-ups are distinctive enough.

## Basketball Read-and-React Rebuild — 2026-07-10
- Replaced the common drive-or-jumper funnel with actual advantage basketball: screens can
  connect, coverages react differently, paint help triggers roller reads or weak-side kick-outs,
  and transition possessions fill lanes before flowing into a half-court call.
- All seven offenses now carry distinct geometry, tempo and glass commitments. All five
  coverages have distinct target geometry, turnover/rim/rebound traits, with visible traps,
  switches, drop depth, zone shells and help/x-out rotations.
- Added guard-led inbounds, big-to-guard defensive-rebound outlets, box-out positioning,
  scheme-specific crash rules, shooting fouls, three-shot fouls, quarter foul state, clutch
  clock management and score-aware late calls. Broadcast chalk exposes action paths, screen
  contact and help rotations without replacing the blob prototype style.
- Required client captures and live-action desktop/mobile screenshots were inspected with no
  console errors or mobile overflow. Frozen same-seed 60-second twins were byte-identical.
  Five full-game seeds completed 18–11, 30–21, 23–16, 26–21 and 26–30; forced transition and
  tied endgame/OT branches completed cleanly. Release verification passes 9 API + 1,042 checks.

## Cyberliga Soccer Rebuild — 2026-07-11
- Replaced the public product shell with a soccer-only interactive world hub: local high-resolution
  Earth textures, seven club markers, live fixture arcs, inertial mouse/touch orbit, regional zoom,
  keyboard controls, static Canvas fallback, URL/back state, responsive club locker, and mobile sheet.
- Added seven original local cinematic city/stadium backplates in desktop/mobile crops, seven local
  crests, a canonical broadcast schedule, and 21 authored kit definitions. One layered texture
  factory now drives both Locker previews and in-match materials; every kit has a unique rendered
  hash, garment grammar, design name, and stable full kit ID.
- Replaced the old match host with a deterministic 60 Hz, two-by-150-second 7v7 simulation. It now
  has deliberate acceleration/turning/decision timing, territorial phases, scored passing choices,
  compact defending, physical ball flight, timed touches/actions, keepers, stamina, contact, core
  restarts, offside, fouls, advantage, cards, penalties, stoppage, event-driven presentation, and a
  six-second replay buffer.
- Expanded all 49 deterministic athlete visual-DNA records and rebuilt the procedural runtime rig
  with faces, body ratios, hair, gaze/blink/expression, gait/braking, foot plants, sockets, contact
  markers, football actions, kit application, LOD, and disposal. Bundled local CC0 universal glTF
  models validate all 23 expected bones; an opt-in desktop adapter proves skeleton cloning, additive
  soccer poses, contact anchors, and topology-derived garment layers.
- Canonical links now use `match.html?fixture=<id>&homeKit=<full-id>&awayKit=<full-id>` while legacy
  `home`/`away` and short variant URLs remain supported. `render_game_to_text`, `advanceTime`, forced
  scenarios, deterministic hashes, snapshots, replay inspection, and reset hooks are available.
- Final release gate passes 9 API tests, the 7-club/49-athlete/21-kit contract, four deterministic
  simulation tests including 20 full seeded matches, 1,100 static/data/route/asset checks, syntax,
  and `git diff --check`. Independent browser QA passed desktop/mobile, WebGL/Canvas fallback,
  navigation/state, full/legacy URLs, all controls, accessibility state, and default/premium paths
  without console errors or overflow.
- Honest remaining production-art TODO: do not make the authored glTF preview the default until it
  has bespoke soccer animation clips, separate authored skinned garments, and a broader production
  face/hair library. The current preview deliberately reports these limitations, and the improved
  procedural renderer remains the safe default for matches and mobile.

## Soccer Match V3 Reset — 2026-07-11
- User rejected the rebuilt live match as visually weak, mechanically unconvincing, and essentially
  stick figures. Preserve the globe/club identity work, but treat the match as a replacement rather
  than another tuning pass.
- Forensic audit identified tracked `index.html` as the strongest older soccer iteration. Reuse its
  modular tactics, ball control/flight, dribbling, keeper, crowd, replay, camera, and presentation
  ideas; do not restore its blob renderer, unrelated clubs, CDN dependencies, or monolithic host.
- Confirmed root causes in V2: 88×56 is too empty for 7v7, the camera makes athletes only ~30px tall,
  authored GLBs are opt-in instead of live defaults, all club play styles and athlete gameplay DNA
  are ignored, replay discards actions, routine keeper claims are mislabeled as saves, and the only
  carrier choices are generic pass or straight sinusoidal carry.
- V3 implementation split into three stable owners: pure deterministic gameplay/engagement in
  `soccersim.js`, live visual/broadcast replacement in `match*`, and pure seven-club/49-player
  gameplay identity profiles in `socceridentity.js`. Final acceptance must include qualitative event
  cadence/attack-variety tests plus required screenshot inspection, not aggregate box scores alone.
- Independent close-crop review rejected the universal-model garment-shell experiment: the extracted
  shells clipped at shoulders/thighs/knees, exposed source material, flattened kit structure, and made
  the athletes read as broken superhero mannequins. That renderer is now explicitly available only via
  `?athletes=premium` for lab comparison and is never the live-match default.
- Completed the replacement procedural-broadcast athlete path: solid tapered human forms connect the
  jersey, sleeves, arms, shorts, thighs, socks and boots without spherical shoulder/knee joints; restrained
  faces and modular hair preserve deterministic identity; the same layered kit textures, crests, names and
  numbers remain live across every cosmetic variant. Desktop and mobile default to this renderer.
- Reframed ordinary play for athlete readability while preserving semantic wide views for restarts and
  event-driven duel/attack/keeper/goal/replay shots. Replay consumes the full V3 motion/action channels;
  the field and goals consume `snapshot.pitch`, preventing visual/laws drift. Camera positions are clamped
  to the clear broadcast moat; crowd geometry, end-board brightness and net density no longer dominate
  close event/replay frames.
- Official game-client captures pass without console-error artifacts. Final post-camera 1440×900 captures
  are `/tmp/cyberliga-v3-final-1440-v2/normal.png`, `/tmp/cyberliga-v3-final-1440-v2/restart.png`,
  `/tmp/cyberliga-v3-final-1440-v2/goal.png`, and `/tmp/cyberliga-v3-final-1440-v2/attack.png`; all report
  `procedural-broadcast`, 14/14 athletes ready, selected
  city art loaded, correct fixture state, and an active replay for the 1–0 goal scene.
- A later independent interval sweep found an attack lens aimed through the goal while only ~11m from
  the end terrace. Near-goal attack, live, duel, keeper, goal and replay shots now back toward midfield,
  clamp focus inside the goal line, and automatically use an elevated pitch-side angle with goal-distance
  clearance. Forced near-end attack proof is `/tmp/cyberliga-v3-camera-forced-attack-v2/shot-0.png`;
  the crowd falls from roughly 55–60% of the rejected frame to an atmospheric upper band while active
  athletes remain broadcast-readable. Goal and corner audits are in `/tmp/cyberliga-v3-goal-camera/`
  and `/tmp/cyberliga-v3-corner-camera/`, with no official-client console-error artifacts.
- Portrait QA then exposed the remaining landscape-camera assumption: a narrow phone could clip the ball
  and show only one or two athletes over mostly empty turf. Mobile now builds a six-player local pack and
  uses an elevated end-to-end composition along the direction of play; set pieces align the long axis from
  ball to staged runners/markers, while goal and corner fits preserve the ball below the scorebug. Held QA
  URLs snap to their deterministic composed lens instead of freezing the first 1/60s transition frame;
  live broadcasts still ease normally. Final 390×844 coverage is in `/tmp/cyberliga-v3-mobile-final-v2/`.
- The V3 gameplay layer now uses all seven club styles and all 49 athlete gameplay identities across eight
  attack patterns, scored passing choices, skills, shielding, shoulder/aerial duels, physical headers,
  volleys and long-range strikes. Goal awards require a recent replayable strike lineage; dead aerial balls
  recover, and loose passes crossing the end line become the correct corner or goal kick.
- Restart staging was rebuilt after portrait QA exposed an empty-box flaw: corners now hold near/central/
  far-post runners, top-box support, markers, zonal cover and goalkeeper; free kicks stage a wall, runners
  and outlets; goal kicks and throws stage progression/press shapes. Type-specific waits preserve those
  positions through the physical delivery.
- Added contrast-safe default kit pairing for every fixture so pale/pale and dark/dark clubs automatically
  select the strongest authored alternative. An explicitly chosen single kit remains fixed while the other
  club adapts; live Skin Drawer changes persist in the canonical URL and appear in text-state QA.
- Final local gate: 9 API tests, the 7-club/49-athlete/21-kit contract, 11 identity/simulation tests, 20/20
  mixed-frame deterministic full matches, the 21-fixture causality/diversity matrix, 1,100 repository checks,
  official-client desktop/mobile captures, syntax and `git diff --check` all pass without remote assets or
  browser console errors.

## Baseball Earned-Outcome Pass — 2026-07-13
- Current prompt: do not announce a single, double, or other result until the entire play is over; runners and defenders must visibly race and make competitive decisions instead of following a pre-announced outcome.
- Root cause confirmed: `creditHit()` currently classifies, records, and flashes the hit on the first bounce, preassigns every destination base, and only then lets the defense collect and relay the ball. A later out can therefore contradict the earlier call and corrupt the visible runner state.
- Implementation direction: keep the batted-ball description provisional, derive advancement attempts from runner speed/traits and defensive recovery time, resolve actual bag races from player/throw arrival, update occupied bases only on arrival, and make one authoritative scoring announcement after all runners and throws settle.
- Rebuilt hit resolution around provisional attempts and one post-play ruling. Batter/runner speed, depth, recovery time, receiver coverage, throw flight, leverage, and baserunning traits now determine whether runners challenge another base; occupied-base lights change only when a runner actually arrives.
- Ground-ball defenders now compare the races at home, second, and first, wait for real coverage, redirect when a runner has already won a bag, and complete double plays only through two covered throws. Outfield relays choose a genuinely contestable lead runner and use visible cutoffs.
- Fly-ball runners now retouch their original bases before any advance. Deep tag-ups remain live, trigger a cutoff/plate throw, and require visible glove-to-runner contact for a tag; the forced sacrifice-fly QA runner was thrown out at home after a real CF–SS–C relay.
- Live-ball runs are provisional until the final out is classified. A bases-loaded/two-out test had a runner cross before the force at first; the pending run was correctly nullified and the score stayed 0–0. Ordinary tag-play timing preserves runs that cross before a non-force third out.
- Result timing QA: a forced double showed no hit banner/stat/pitch result during flight, pickup, throw, or tag; the batter was tagged at second, and only then received a single plus an out. Home-run QA showed one official call at 10.7s, after wall clearance at 4.0s and completion of the base circuit.
- A forced double play recorded two distinct covered throws (fielder→second, second→first) and two outs. A forced throwing error left the ball live and loose rather than snapping it into the receiver's glove.
- Official web-game client artifacts and reviewed screenshots are in `output/web-game/baseball-earned/`. A 420-second soak completed a 3–2 game in 372 simulated seconds, began the next fixture cleanly, kept all player coordinates finite, and produced no browser errors.
- Mobile 390×844 QA caught a three-line wrap in the new `OUT STRETCHING` verdict. Long rulings now use a dedicated single-line responsive size; the corrected banner fits from x=9.4 to x=380.6 with no page overflow or console errors (`mobile-double-final-fixed.png`).
