# CYBERLIGA — Master Plan

**Vision:** A 24/7 autonomous AI sports universe built to go viral. Not a FIFA competitor —
a Marble League × Blaseball with recognizable competitors, personalities, and storylines.
Watchability > realism. The unit of growth is the 20-second clip.

**Architecture lock: ONE simulation, renderer-independent events — NOT game branches.**
The simulation (tactics, physics, refs, leagues, story) is fully decoupled from bodies.
Renderers implement one shared rig API. `blobrig.js` is the default soccer renderer during
prototyping: it loads instantly and reads clearly at broadcast distance. `humanrig.js`
and `kayrig.js` remain available as optional comparison views, labeled ROBOTS and
CHARACTERS, but are not the production character direction. Production character visuals
wait for an art bible establishing genuinely distinct silhouettes, faces, movement, and
team culture. The durable IP lives in names, behavior, stats, rivalries, and lore.

**Current strategy locks (7/9):**
- Ship one canonical soccer league before trying to make every arena equally complete.
- Other sports remain clearly labeled exhibitions while the shared application foundation is built.
- Order: source control → deterministic sim → canonical persistence → application shell → reliability → content engine.
- Blobs are the prototype default; robot and character views remain optional comparisons.
- Crypto/monetization: not before audience. Prediction points first, much later.

---

## Status (done)
- Stadium, crowd (5k instanced), jumbotron, floodlights, neon brand look
- League: 4 teams, fixtures, persistent table (localStorage), HT/FT stat cards
- Match flow: kickoff → halves → goals → slow-mo replays → cards → free kicks → penalties
  → throw-ins (overhand, jog-to-spot) → corners → goal kicks
- Physics: aerodynamic ball (Magnus/knuckle/spin bounces, speed caps), mass-based player
  collisions, shoulder duels, staggers/knockdowns, stamina
- Brains: tactics (phases, pass evaluation, off-ball runs, pressing shape), ball control
  (footfall touches, settles), dribbling skills, goalkeeper (positioning, reaction dives),
  referee (foul judgment, yellow/red, second-yellow, send-offs)
- Bodies: instant-loading glowing blobs with a shared procedural pose vocabulary; the
  skinned-human and KayKit experiments are retained off-product for future reference
- Presentation: scoreboard, ticker commentary, lower-thirds (cards/penalty/skill), GOAL
  overlay, confetti, synthesized audio (crowd bed, roar, whistle, kick thumps)
- Blob referee. Smaller ball (r=0.24). Receivers attack passes. Anti-freeze watchdogs.

## Known issues / tuning
- [x] Too many penalties → judge-rate gate + penalty downgrade (this session)
- [ ] Blob actions need clearer anticipation, contact, and follow-through
- [ ] Ref sometimes too close to play

---

## Workstream 1 — Features (gameplay events worth clipping)
- [x] Slide tackles (timed, can win ball clean or give away fouls)
- [x] Headers (jump + head crosses/corners/long balls)
- [x] GK catch-and-hold + punch-clears (uses keeper brain's catch/parry)
- [ ] Sent-off walk to the tunnel; injured limp after big fouls
- [ ] Kickoff huddle; halftime/fulltime exhausted poses; lineup handshake (later)
- [ ] Bicycle kick (rare), backheel passes (flair-gated)
- [ ] Substitutions (needs bench) — later, pairs with coaches

## Workstream 2 — Blob Motion Language
Principle: every state change blends, every major action has anticipation → contact →
follow-through, and roles remain readable without human anatomy.
- Locomotion: plant-and-cut squash, acceleration stretch, deceleration compression,
  direction-change tilt, and speed-specific bounce cadence
- Striker: settle-and-strike chains, volley snap, near-miss deflation
- Defender: low wide jockey squash, blocks, last-ditch launch
- GK: set pulse, lateral shuffle, claim, pickup, bowl-out, wall-organizing
- Referee: distinct whistle pulse, advantage lean, and point-to-spot gesture
- Crowd (per-fan program): sit/stand mix, individual jump timing, flag wavers, scarf
  holders, phone flashes, section chants (coordinated bounce), despair slump on conceding
- Celebrations: knee slide, corner-flag point, group mob with pile-on, badge tap

## Workstream 3 — Identity Before Character Models
- Preserve player names, numbers, roles, stats, behavior traits, and rivalries now
- Build a character art bible before commissioning or generating production bodies:
  silhouette families, face language, proportions, movement signatures, team culture
- Do not ship a model merely because it is technically rigged; every featured player
  must be recognizable from silhouette or motion before portraits return to center stage
- Ball: paneled texture, team-tinted trail
- Crowd recolored per fixture; coaches + benches; stadium dressing (flags, tunnel, dugouts)

## Workstream 4 — UI/UX & Broadcast
- Tension-aware camera (zoom on box entries, set-piece cams, celebration orbit)
- Lineup intro card, momentum bar, possession ticker
- Better replay direction (multiple angles, freeze-frame on contact)
- Auto-highlight clip export (the virality engine)

## Workstream 5 — Story Engine (after 1-4)
- Player form/personality stats feeding commentary
- Pre-match narrative cards, post-match recaps, season arcs
- Social layer: AI player accounts, trash talk, lore — pre-launch content bank

## Workstream 6 — Exhibition Arenas
- Hockey, basketball, baseball, and fighting remain playable experiments.
- Promote an arena into the canonical application only after it adopts the shared
  deterministic event contract, persistence, recovery, and automated test gates.
