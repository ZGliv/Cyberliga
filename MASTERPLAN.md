# CYBERLIGA — Master Plan

**Vision:** A 24/7 autonomous AI sports universe built to go viral. Not a FIFA competitor —
a Marble League × Blaseball with real animated bodies, personalities, and storylines.
Watchability > realism. The unit of growth is the 20-second clip.

**Architecture lock (decided 6/12): ONE codebase, swappable renderer — NOT branches.**
The simulation (tactics, physics, refs, leagues, story) is fully decoupled from bodies.
Renderers implement one shared rig API: `humanrig.js` (pro/skinned humans, default),
`blobrig.js` (classic glowing athletes — instant load, used for prototyping new sports),
`kayrig.js` (KayKit fantasy characters, on disk, unused). Press V in-game or `?style=classic`
to switch. New sports get built in classic first; each gets its hyper-real pass later.
Custom/hyper-real bodies (jersey UVs with printed names, headshot renders for profiles,
merch-grade models) = a later commissioned-model or AI-3D-gen pass that drops onto the
same skeleton + API with zero sim changes. The IP lives in names/stats/lore, not meshes.

**Strategy locks (from Zack):**
- Don't publish until the whole product is done.
- Order: (1) features → (2) fewer penalties/fouls → (3) animation depth + UI/UX polish → (4) other sports.
- No second sport until the soccer template is perfect.
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
- Bodies: skinned Mixamo-skeleton humans (Soldier.glb), idle/walk/run mocap + procedural
  pose library (kick, throw-in, dive, fall/get-up, celebrate ×3, argue, 4 skill moves)
- Presentation: scoreboard, ticker commentary, lower-thirds (cards/penalty/skill), GOAL
  overlay, confetti, synthesized audio (crowd bed, roar, whistle, kick thumps)
- Human referee body. Smaller ball (r=0.24). Receivers attack passes. Anti-freeze watchdogs.

## Known issues / tuning
- [x] Too many penalties → judge-rate gate + penalty downgrade (this session)
- [ ] Motion reads "choppy/templatey" → animation-depth program below
- [ ] Ref sometimes too close to play
- [ ] VOLT pink reads red on armor tint

---

## Workstream 1 — Features (gameplay events worth clipping)
- [ ] Slide tackles (timed, can win ball clean or give away fouls)
- [ ] Headers (jump + head crosses/corners/long balls)
- [ ] GK catch-and-hold + punch-clears (uses keeper brain's catch/parry)
- [ ] Sent-off walk to the tunnel; injured limp after big fouls
- [ ] Kickoff huddle; halftime/fulltime exhausted poses; lineup handshake (later)
- [ ] Bicycle kick (rare), backheel passes (flair-gated)
- [ ] Substitutions (needs bench) — later, pairs with coaches

## Workstream 2 — Animation Depth ("smooth, not templatey")
Principle: every state change BLENDS (~0.15s), nothing snaps. Per-position, per-speed.
- Locomotion additives: turn-on-a-dime plant-and-cut, acceleration lunge, deceleration
  brake steps, lean into turns, arm pump scaling with effort, look-over-shoulder
- Outfield idle variety: hands-on-hips, bounce-on-toes, pointing/organizing teammates
- Striker: settle-and-strike chains, volley pose, near-miss head-in-hands
- Defender: jockeying stance (low, side-on), blocks, last-ditch lunge
- GK: set stance, shuffle steps, claim cross, pickup, bowl-out, wall-organizing
- Referee: card brandish (proper), whistle-to-mouth, advantage wave, pointing to spot
- Crowd (per-fan program): sit/stand mix, individual jump timing, flag wavers, scarf
  holders, phone flashes, section chants (coordinated bounce), despair slump on conceding
- Celebrations: knee slide, corner-flag point, group mob with pile-on, badge tap

## Workstream 3 — Reskin & Identity
- Near-term (materials on current body): per-team emissive armor patterns, visor colors,
  captain armband glow, GK distinct, better VOLT pink
- Next session (new rigged GLBs via Mixamo, drop onto same skeleton — zero code change):
  **Crash-test dummies** (top pick: collision comedy, IP-free) or corporate suits
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

## Workstream 6 — Other Sports (only after template is perfect)
- Hockey → basketball → football → fighting. Same skeleton/template, new pitch + rules.
