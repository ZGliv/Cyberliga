# CYBERLIGA — Prototype to Ship

Last updated: 2026-07-09

## V1 product definition

Ship a spectator-first web application centered on one canonical soccer league.
Everyone sees the same fixture, clock, score, standings, player history, and replay.
Hockey, basketball, baseball, and fighting remain labeled exhibition arenas until they
adopt the same simulation and persistence contracts.

V1 does not require user accounts, multiplayer control, native apps, crypto, betting,
or five equally mature sports.

## Product architecture

1. A scheduler claims the next canonical fixture.
2. A deterministic, renderer-free simulation produces ordered match events from a seed.
3. The event log and authoritative result are stored transactionally.
4. A broadcast service releases those events according to their timestamps.
5. Browsers render the same event stream with Three.js and can reconnect at any event.
6. The same log produces recaps, posters, replays, and highlight candidates.

## Phase 0 — Stabilize the prototype

- [x] Create the `codex/ship-foundation` working branch.
- [x] Restore a repeatable local preview command.
- [x] Make blobs the default soccer renderer during prototyping.
- [x] Keep robot and character renderers available as clearly labeled comparison views.
- [x] Restore the OG soccer composition: wide live camera, contextual nameplates, minimal HUD,
  immediate kickoff, and current simulation mechanics underneath.
- [x] Reconcile the master plan with the product and character-direction decisions.
- [x] Commit the complete deployed prototype plus this stabilization pass.
- [ ] Configure a Git remote and push the branch.
- [ ] Tag the preserved baseline as `prototype-v1` after it is available remotely.

Exit gate: the exact product can be reproduced from Git on a clean machine.

## Phase 1 — Extract a deterministic soccer simulation

- [ ] Define `createMatch(config, seed)`, `step(ms)`, `getSnapshot()`,
  `getEvents(afterSequence)`, `serialize()`, and `restore(snapshot)`.
- [ ] Move rules, clocks, player decisions, ball state, and scoring out of the DOM.
- [ ] Replace simulation-critical `Math.random()` calls with a seeded generator.
- [ ] Make the browser renderer consume snapshots/events instead of owning league truth.
- [ ] Add accelerated tests covering at least 1,000 complete seeded matches.

Prototype checkpoint completed 2026-07-10: the browser build now derives two fixtures
from one UTC schedule, seeds each match by its public match ID, and advances at fixed 30 Hz
steps. Two isolated browser pages frozen at the same timestamp produced byte-identical
scores, clocks, ball coordinates, and all 14 player positions. This validates the product
experience, but does not replace the renderer-free Node simulation required by this phase.

Exit gate: the same seed produces the same event sequence and final result in Node and
the browser, with no match deadlocks across the automated simulation run.

## Phase 2 — Canonical league service

- [ ] Add persistent seasons, teams, players, fixtures, matches, ordered events,
  standings, career stats, storylines, and media records.
- [ ] Add an always-on worker that claims, simulates, broadcasts, and finalizes fixtures.
- [ ] Make finalization idempotent so a result can never be counted twice.
- [ ] Stream live events to spectators and support sequence-based reconnection.
- [ ] Add a private operations view for scheduling, pausing, replaying, and inspecting.

Exit gate: two fresh browsers see the same clock, result, table, and player history;
a restarted worker resumes without corrupting or duplicating the match.

## Phase 3 — Application shell

- [ ] Add durable routes for live, schedule, standings, matches, replays, teams, and players.
- [ ] Add loading, offline, reconnecting, ended, and unavailable states.
- [ ] Provide accessible text alternatives for essential canvas information.
- [ ] Add social metadata, analytics, privacy/terms/contact pages, and admin authentication.
- [x] Add the first public world route: interactive globe, live channel guide, club dossiers,
  mobile layout, and a share-card image contract for Twitter/X links.

Exit gate: every important piece of league state has a permanent shareable URL, and the
core mobile experience works without relying on one browser's local storage.

## Phase 4 — Reliability and release gates

- [ ] Simulation distribution, invariant, freeze, and recovery tests.
- [ ] Desktop and mobile browser smoke tests for every public route.
- [ ] CI for syntax, tests, asset checks, and preview deployments.
- [ ] Error reporting, worker health checks, database backups, and rollback procedure.
- [ ] Remove production-critical model/CDN dependencies that lack controlled fallbacks.

Exit gate: 1,000 consecutive soccer matches complete, reconnect restores the correct
sequence, mobile QA passes at 390×844, and production can be rolled back safely.

## Phase 5 — Content engine and closed beta

- [ ] Select highlight windows from structured match events.
- [ ] Generate final-score posters, recaps, replay pages, and vertical clip candidates.
- [ ] Add a private review queue before any automated social publishing.
- [ ] Run a continuous private season and measure load time, watch time, reconnects,
  crashes, shares, and outcome balance.

Exit gate: each completed match reliably produces a recap, poster, replay, and reviewable
highlight candidates; the canonical league runs unattended through the beta window.

## Character direction gate

Blobs remain the soccer prototype renderer until a character system proves all of the
following:

- Featured players are distinguishable from silhouette or movement alone.
- Teams have coherent but clearly different visual cultures.
- Faces, proportions, clothing, and motion are not repeated template permutations.
- The renderer preserves simulation readability and mobile performance.
- Portraits, match bodies, and social content depict the same recognizable identity.

Names, stats, behavior traits, rivalries, and storylines continue developing while visual
character production is paused; that identity work is reusable regardless of renderer.
