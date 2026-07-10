# CYBERLIGA — Prototype to Ship

Last updated: 2026-07-10

## V1 product definition

Ship a spectator-first web application centered on one canonical soccer league.
Everyone sees the same fixture, clock, score, standings, player history, and replay.
American football, hockey, basketball, baseball, and fighting remain labeled exhibition arenas until they
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

Expansion checkpoint completed 2026-07-10: the canonical prototype now schedules eight
soccer clubs across four simultaneous channels and renders 6v6 matches. Two fresh frozen
browsers again produced byte-identical match, clock, score, ball, and all 12 player records.

Exit gate: the same seed produces the same event sequence and final result in Node and
the browser, with no match deadlocks across the automated simulation run.

## Phase 2 — Canonical league service

- [x] Define the RLS-protected canonical schema for seasons, teams, athletes, fixtures,
  matches, ordered events, standings, media, presence aggregates, and worker health.
- [x] Add deterministic `/api/live` and `/api/league` fallbacks, a browser-safe runtime
  config endpoint, and a secret-protected idempotent `/api/tick` boundary.
- [x] Add fixture advisory locking, stable event keys/sequences, monotonic snapshots,
  and one-time standings finalization with service-role-only execution.
- [ ] Provision a dedicated Cyberliga Supabase project, apply/seed the migration, and
  configure publishable/service/cron credentials without touching unrelated projects.
- [ ] Add persistent seasons, teams, players, fixtures, matches, ordered events,
  standings, career stats, storylines, and media records.
- [ ] Add an always-on worker that claims, simulates, broadcasts, and finalizes fixtures.
- [ ] Make finalization idempotent so a result can never be counted twice.
- [ ] Stream live events to spectators and support sequence-based reconnection.
- [ ] Add a private operations view for scheduling, pausing, replaying, and inspecting.

Exit gate: two fresh browsers see the same clock, result, table, and player history;
a restarted worker resumes without corrupting or duplicating the match.

Backend checkpoint completed 2026-07-10: the migration applied cleanly to a disposable
Postgres instance; repeated final ticks produced one match, stable events, and one standings
application. Anonymous writes and RPC execution were denied. Production remains in explicitly
labeled deterministic fallback until a dedicated project is chosen and provisioned.

## Phase 3 — Application shell

- [ ] Add durable routes for live, schedule, standings, matches, replays, teams, and players.
- [ ] Add loading, offline, reconnecting, ended, and unavailable states.
- [ ] Provide accessible text alternatives for essential canvas information.
- [ ] Add social metadata, analytics, privacy/terms/contact pages, and admin authentication.
- [x] Add the first public world route: interactive globe, six-league sports network,
  honest canonical/exhibition status, mobile layout, and a Twitter/X share-card contract.
- [x] Add durable league-atlas URLs for six sports with 48 clubs, 416 athlete identities,
  deterministic fixtures, rivalries, and daily narrative hooks.
- [x] Add a shareable World Wire route with six UTC-synchronized editorial desks,
  athlete/team focus links, trending clubs, and rivalry coverage.
- [x] Add an internal Character Lab for the first twelve marquee athletes with deterministic
  match, portrait, and vertical-clip previews before any body family reaches the live product.
- [x] Add privacy-safe anonymous match presence with reconnect/backoff and an honest
  `1 WATCHING · LOCAL` state until realtime credentials are configured.
- [x] Add a responsive Broadcast Guide and a shared in-game navigation hub across all six
  arenas so live channels, leagues, stories, media tools, and operations never dead-end.

Exit gate: every important piece of league state has a permanent shareable URL, and the
core mobile experience works without relying on one browser's local storage.

## Phase 4 — Reliability and release gates

- [ ] Simulation distribution, invariant, freeze, and recovery tests.
- [x] Desktop and mobile browser smoke tests for every public route.
- [x] CI for API tests, syntax, invariant/data checks, route/API smoke tests, asset checks,
  and previews.
- [x] Add a dependency-free project preview server with local Vercel-function dispatch,
  700+ invariant checks, and a GitHub Actions application release gate.
- [ ] Error reporting, worker health checks, database backups, and rollback procedure.
- [ ] Remove production-critical model/CDN dependencies that lack controlled fallbacks.

Exit gate: 1,000 consecutive soccer matches complete, reconnect restores the correct
sequence, mobile QA passes at 390×844, and production can be rolled back safely.

## Phase 5 — Content engine and closed beta

- [ ] Select highlight windows from structured match events.
- [x] Generate deterministic 1080x1920 vertical moment posters from permanent query URLs.
- [x] Generate deterministic 12-second vertical WebM clip candidates from permanent
  story URLs with six sport-specific animated signature plays.
- [ ] Automatically generate final-score recaps, replay pages, and event-selected clips.
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
