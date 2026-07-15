# Cyberliga spectator-product audit

Baseline: canonical release `a1ed7f4` on 2026-07-14.

## Executive verdict

Cyberliga already proves the idea: six autonomous sports, 48 clubs, recognizable league
language, a strong globe front door, and simulations that can run unattended. It is not yet a
viral spectator product or a defensible real-money event source. The current games often read as
six technically competent browser demos instead of six broadcasts from one living sports world.

The biggest problem is not a missing shader or menu. Simulation, animation, camera direction,
venue identity, crowd behavior, commentary, and persistent world state are still implemented
mostly inside six separate arena files. That makes a football route, baseball pitch, hockey check,
or basketball possession capable of being logically correct while still looking abrupt, generic,
or emotionally flat.

## Baseline scorecard (0–5)

| Sport | Sport logic | Motion/readability | Broadcast pacing | Venue/crowd identity | Viral moment density |
| --- | ---: | ---: | ---: | ---: | ---: |
| Soccer | 3.8 | 3.0 | 3.3 | 2.6 | 3.1 |
| American football | 3.7 | 2.1 | 2.7 | 2.8 | 2.5 |
| Basketball | 3.5 | 2.7 | 3.0 | 2.7 | 2.8 |
| Hockey | 3.5 | 2.7 | 3.0 | 2.8 | 3.0 |
| Baseball | 3.6 | 2.8 | 3.2 | 2.8 | 3.0 |
| Combat | 3.4 | 2.9 | 3.1 | 2.7 | 3.1 |

These scores describe the viewer experience, not code completeness. Several simulations have deep
rules and good deterministic QA, but depth that is not visible on screen does not improve a live
broadcast.

## Why it is not compelling enough yet

### 1. Correct state does not consistently become convincing motion

- Each sport owns most of its own state, movement, camera, effects, and broadcast timing.
- Important changes can still appear as position correction, target chasing, or a text result
  instead of anticipation → contact → consequence → recovery.
- Player decisions happen faster than the viewer can parse them. The broadcast needs to hold the
  setup and outcome, not simply finish the state transition.
- The shared blob rig has a useful motion vocabulary, but every arena uses a different subset and
  several sport-specific actions remain page-local approximations.

### 2. Team and city identity stops at the edge of the field

- `branddata.js` contains an authored venue, architecture line, crowd ritual, mark, environment,
  kit pattern, and identity statement for all 48 clubs.
- League HQ renders those concepts, but the playable arenas mostly consume names and colors.
- Only five league-level raster hero images exist. There is no approved per-club set of 48 stadium
  plates and 144 home/away/night uniform plates in the repository.
- A generic bowl recolored for the fixture is not the same thing as playing in THE FOLD, THE GROVE,
  BELL PARK, RAINHOUSE, or SHELL HALL.

### 3. The classic players are coherent but not yet collectible characters

- Fixed cyan versus hot-pink bodies now make every sport unmistakably Cyberliga.
- Numbers, role, equipment, club motif, and signature motion are not consistently visible from a
  broadcast camera.
- Most athletes within a team share one silhouette. The world has 416 names and traits, but a
  viewer cannot yet identify a star before reading a lower third.
- The right next step is a controlled silhouette/equipment system layered onto the classic bodies,
  not a return to the rejected generic humanoids.

### 4. Crowds are numerous but not socially alive

- Several arenas render hundreds or thousands of spectators, but many are texture dots or identical
  instances with a global bounce value.
- Reactions are often one scalar rather than section behavior: anticipation, delayed recognition,
  home/away pockets, flags, phones, coordinated rituals, despair, exits, and rivalry pressure.
- Every home club already has an authored ritual. Those rituals need to drive light, section motion,
  signage, and camera-visible choreography.

### 5. Broadcast grammar is inconsistent

- Score bugs, event cards, camera cuts, replay cadence, focus graphics, and commentary differ by
  arena in density and quality.
- A wide master shot should establish live geometry. Tighter shots should be earned by a dead ball,
  replay, individual duel, walkout, celebration, or high-leverage setup.
- Important events need the same four beats in every sport: establish, anticipate, impact, resolve.
- Automatic replays should preserve the exact simulation event and show a second useful angle, not
  merely replay decorative camera motion.

### 6. The world is not yet a single authoritative live competition

- Soccer has the strongest shared UTC/live model. The other sports still rely heavily on page-local
  fixture selection, date buckets, local storage, and independent simulation state.
- Basketball, baseball, combat, and football isolate gameplay randomness reasonably well, but visual
  randomness still leaks through global `Math.random`; hockey currently uses global randomness in
  gameplay decisions as well as effects.
- Refreshing or opening two devices is not guaranteed to reveal one authoritative basketball,
  hockey, baseball, football, or combat event history.
- Standings and history can fall back locally. That is acceptable for a prototype and unacceptable
  for a wagerable result.

### 7. The product has no trusted real-money boundary

Cyberliga must not accept real-money bets on the current client simulations. A casino-grade product
needs an independently reviewable server-authoritative event engine, versioned rules, controlled and
auditable randomness, signed event logs, immutable results, recovery from worker failure, monitoring,
market suspension rules, settlement reconciliation, and jurisdiction-specific legal/compliance work.
The wagering system must remain separate from the browser renderer. A visually excellent game is
necessary, but it cannot establish result integrity by itself.

## Sport-by-sport audit

### American football

Strengths: full 11v11 roles, legal downs, special teams, penalties, conversions, overtime, authored
play/coverage logic, complete field and deterministic tests.

Primary gaps:

- Too many players converge, stop, or rotate in ways that expose target-following rather than mass,
  leverage, momentum, and assignment handoff.
- Pre-snap intent is stronger than post-snap readability. Protection, route leverage, quarterback
  progression, catch point, block shed, and tackle finish need clearer staged motion.
- Plays spend too much time in low-information movement and too little time on an understandable
  conflict the viewer can anticipate.
- Camera and replay choices need to explain the decisive matchup, not only keep all 22 players visible.
- Sidelines and crowd should react by down, leverage, turnover threat, red zone, and home ritual.

### Soccer

Strengths: canonical clock, fixed-step simulation, offside, fouls, set pieces, goalkeeping, tactics,
spectacle actions, full-match flow, and the richest existing shared crowd module.

Primary gaps:

- Six-a-side open-field spacing can look sparse or chase-heavy instead of like an authored football
  culture with recognizable pressing, rest defense, overloads, and rotations.
- Ball receipt, shoulder checks, first touch, and pass release need stronger visual causality.
- Star behavior is data-rich but visually subtle at match distance.
- The same base stadium still carries eight cities whose written architecture and rituals are radically
  different.

### Basketball

Strengths: 5v5, real inbounds, schemes and coverages, screens, help, transition lanes, rebounds,
fouls, free throws, and a complete court view.

Primary gaps:

- Half-court actions need clearer spacing holds, screen contact, advantage creation, defensive
  rotation, and second-side decisions.
- Too many possessions can feel like agents arriving at waypoints instead of manipulating defenders.
- Shot gathers, releases, blocks, rim contact, nets, rebounds, and landings need a stronger physical
  chain.
- Crowd energy must build with runs, shot-clock pressure, dunks, blocks, rivalry, and home ritual.

### Hockey

Strengths: six visible roles per side, systems, line changes, penalties, power plays, entries, cycles,
one-timers, slap shots, checks/falls/recovery, goalies, and full-rink mobile framing.

Primary gaps:

- Global randomness in hockey decisions prevents a trustworthy identical-event replay contract.
- Carrier logic can still favor proximity to goal over a readable shot lane, screen, rebound plan, or
  weak-side option.
- Skating needs more edge, glide, stop, turn radius, collision momentum, and post-check recovery.
- Puck motion and player sticks need to remain visually connected through every carry/pass/shot.

### Baseball

Strengths: pitch sequencing, count, fatigue, side-on plate action, explicit calls, nine defenders,
batted-ball types, throws, force plays, errors, double plays, baserunning, and whole-diamond views.

Primary gaps:

- Pitch recognition and swing decision are still difficult to read before the result graphic.
- Batter stance, load, hands, barrel path, catcher receive, umpire call, and batter reaction need one
  continuous visible sentence.
- Balls in play need clearer speed/depth, fielder route choice, pickup transfer, throw urgency, and
  runner decision points.
- Ballpark dimensions, wall material, skyline, dugout, and crowd ritual need to be club-specific.

### Combat

Strengths: seeded styles, guard/range plans, feints, combinations, counters, clinches, damage, cuts,
knockdowns, scorecards, walkouts, corners, and a stable side broadcast.

Primary gaps:

- Fighters need more foot planting, weight transfer, range consequence, defensive exits, and impact
  recovery so exchanges do not resemble overlapping action timers.
- Repeated punch silhouettes reduce the sense of styles and adaptation.
- Ring geography, corner pressure, rope escape, clinch breaks, and referee intervention should create
  recognizable stories within a round.
- The eight intimate venue concepts need distinct materials, light, entrances, and crowd proximity.

## Shared release standard

Every sport should satisfy these gates before calling the gameplay broadcast-grade:

1. **Readable conflict:** within five seconds a viewer can identify possession/control, attacking
   direction, immediate objective, and the decisive matchup.
2. **Physical sentence:** major actions show anticipation, contact, consequence, and recovery with no
   teleport, unexplained snap, or result-only graphic.
3. **Motion continuity:** acceleration, braking, turn radius, collision impulse, and animation blending
   remain stable at 30, 60, and 120 Hz render rates.
4. **Event variety:** a 10-minute soak exercises multiple strategies and outcomes without one dominant
   loop or implausible scoring distribution.
5. **Broadcast restraint:** live play uses a stable master; cuts never hide the ball/puck or decisive
   interaction; replays show the causal moment from a useful second angle.
6. **Venue proof:** the home venue name, architecture motif, material palette, signage, field/court/rink
   dressing, and authored crowd ritual are visibly tied to the selected home club.
7. **Athlete proof:** fixed classic side colors remain, while number, role/equipment, club motif, and at
   least one player-specific movement or silhouette cue remain readable.
8. **Crowd causality:** sections react differently to buildup, miss/save, score, turnover, stoppage,
   rivalry, comeback, and final result.
9. **Deterministic evidence:** identical event seed/version produces identical sporting decisions and
   ordered outcomes; render-only randomness cannot change a result.
10. **Mobile parity:** 390×844 shows the complete relevant geometry, a readable ball/puck, essential
    score state, no horizontal overflow, and no obstructive event card.
11. **Clip test:** every completed game yields at least three self-contained 10–20 second moments with
    setup, payoff, identity, and a permanent event ID.
12. **Operational test:** finite state, no console/page/request errors, no stalled rotation, and clean
    recovery after a hidden tab or interrupted renderer.

## Asset and world-building pipeline still required

The repository needs an explicit approved asset set rather than implying that procedural concept art
is finished AI production art:

- 48 stadium/arena establishing plates, one for each home club.
- 144 uniform plates: home, away, and night for every club.
- A style-locked prompt and review sheet per league so all images share camera, material, lighting,
  texture, logo-safety, and cultural-authenticity rules.
- Runtime-friendly derivatives (AVIF/WebP), source provenance, prompt/model/version metadata, focal
  points, palette samples, and an approval state.
- In-game translation notes for geometry, materials, signage, roofline, skyline, tunnel/dugout,
  supporter sections, and the authored ritual. The raster image is reference art, not a skybox pasted
  behind a generic venue.
- A jersey translation contract mapping generated pattern, trim, crest placement, number treatment,
  and equipment color onto the classic rig at broadcast distance.

Until those assets exist, the honest product state is **authored procedural club concepts plus five
league-level generated hero images**, not 48 finished AI stadiums and 144 finished AI uniforms.

## Durable architecture required after the visual pass

1. One server-authoritative simulation/event protocol shared by all six sports.
2. Versioned events with stable IDs, timestamps, participants, preconditions, outcome, and replay data.
3. Renderer adapters that interpolate event snapshots and cannot influence sporting outcomes.
4. One broadcast director consuming event leverage and selecting cameras/replays/graphics consistently.
5. One venue/kit manifest connecting brand identity, approved image references, runtime assets, and
   procedural geometry parameters.
6. One crowd state machine driven by leverage and home ritual instead of a global excitement scalar.
7. Persistent standings, athlete form, injuries, rivalries, records, and stories derived from the same
   immutable event stream.
8. Automated soak, determinism, score-distribution, visual-regression, mobile, and performance gates.

## Scope of the current integrated pass

This release pass targets the highest-value improvements that can safely ship without replacing the
entire event architecture: smoother and more legible sport action, more varied decisions, better
camera/event pacing, club-aware venue/signage/ritual cues, stronger crowd responses, clearer equipment,
and comprehensive desktop/mobile/autonomous QA across all six arenas. The server-authoritative event
platform and complete 48-club AI asset commission remain separate production programs and must not be
misrepresented as completed by a browser-renderer pass.
