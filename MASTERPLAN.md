# CYBERLIGA — Master Plan

**Vision:** A 24/7 autonomous AI sports universe built to go viral. Not a FIFA competitor —
a Marble League × Blaseball with recognizable competitors, personalities, and storylines.
Watchability > realism. The unit of growth is the 20-second clip.

**Architecture lock: ONE simulation, renderer-independent events — NOT game branches.**
The simulation (tactics, physics, refs, leagues, story) is fully decoupled from bodies.
Renderers implement one shared rig API. `blobrig.js` is the default soccer renderer during
prototyping: it loads instantly and reads clearly at broadcast distance. The rejected
humanoid experiments are no longer exposed in the public application. Production character
visuals wait for an art bible establishing genuinely distinct silhouettes, faces, movement,
and team culture. The durable IP lives in names, behavior, stats, rivalries, and lore.

**Current strategy locks (7/9):**
- Ship one canonical soccer league before trying to make every arena equally complete.
- Other sports remain clearly labeled exhibitions while the shared application foundation is built.
- Order: source control → deterministic sim → canonical persistence → application shell → reliability → content engine.
- Blobs are the only public soccer renderer until a replacement cast passes the identity gate.
- OG broadcast grammar is the visual north star: wide live camera, minimal permanent HUD,
  contextual names, and motion/crowd/ball behavior carrying the spectacle.
- The public prototype now has one UTC league clock, two live channels, seeded fixed-step
  soccer, and a globe front door. This proves the shared-world experience in-browser;
  the production source of truth still moves server-side before accounts or social play.
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
- [x] Preserve 288 player names, numbers, roles, behavior traits, silhouette briefs,
  team cultures, and reciprocal rivalries in one shared content source
- Build a character art bible before commissioning or generating production bodies:
  silhouette families, face language, proportions, movement signatures, team culture
- [x] Remove the rejected portrait/character direction from every public product route
- [ ] Use GPT Image as an art-direction lab for radically different silhouette families;
  generated concepts stay off-product until one direction proves genuinely ownable
- Do not ship a model merely because it is technically rigged; every featured player
  must be recognizable from silhouette or motion before portraits return to center stage
- Ball: paneled texture, team-tinted trail
- Crowd recolored per fixture; coaches + benches; stadium dressing (flags, tunnel, dugouts)

## Workstream 4 — UI/UX & Broadcast
- [x] Restore the wide OG live camera; reserve directed shots for goals and replays
- [x] Reduce permanent match furniture to score, clock, ticker, hub link, and controls
- [x] Make player nameplates contextual to the current action
- [x] Restore the interactive globe as the public front door with live city signal arcs
- [x] Add two shareable live channels that join the same seeded UTC match in progress
- [x] Replace the character-led globe content with a six-league global sports network
- [x] Separate soccer and American football, then connect all six arenas from the map
- [x] Add a league atlas for 48 clubs, 288 athlete identities, rivalries, and schedules
- Better replay direction (multiple angles, freeze-frame on contact)
- [x] Add structured clip telemetry to baseball and combat
- [x] Add deterministic 1080x1920 poster generation with permanent story URLs
- Auto-highlight video clip export (the next virality engine boundary)

## Workstream 5 — Story Engine (after 1-4)
- [x] Add deterministic league-wide headlines, marquee logic, rivalry hooks, and season schedules
- [x] Add a six-desk World Wire with shareable team/player focus URLs
- Player form/personality stats feeding canonical commentary
- Persistent pre-match narrative cards, post-match recaps, and season arcs
- Social layer: AI player accounts, trash talk, lore — pre-launch content bank

## Workstream 6 — Exhibition Arenas
- American football, hockey, basketball, baseball, and fighting remain playable experiments.
- [x] Add a complete American-football exhibition with eight clubs and full game flow
- [x] Expand basketball and hockey mechanics, fixtures, and rosters
- Promote an arena into the canonical application only after it adopts the shared
  deterministic event contract, persistence, recovery, and automated test gates.
