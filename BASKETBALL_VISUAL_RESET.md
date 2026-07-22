# Basketball Visual Reset — Production Contract

**Status:** off-product visual lab

**Target:** one real-time, autonomous 15-second possession: New York Brownstones vs Toronto Lake Effect
**Purpose:** prove a production visual language before changing any public arena

## 1. Containment and provenance

- This lab is not a seventh mode, a redesign of all six sports, or a release candidate.
- The current classic cyan/hot-pink capsule athletes remain the public product until this lab passes every gate in §10. They are not to be incrementally replaced from an unfinished experiment.
- Generated concept art is off-product. It may communicate direction, but it is not an approved texture, background, character, venue, replay, or substitute for a working real-time shot.
- No external prompt or external artwork was used for this implementation. The production proof must be made from repository-authored geometry, materials, lighting, animation, camera, graphics, and sound logic. Any future external asset requires recorded provenance and separate approval.
- The canonical simulation, fixture identities, autonomous/view-only behavior, deterministic hooks, certified event IDs, Match Memory, and Witness Chronicle are inputs to preserve—not reasons to ship a weak picture.

## 2. Problem statement

Cyberliga currently asks deep simulation to carry a picture that reads as generic AI output. The evidence is concrete:

- Ten athletes reduce to two emissive capsule treatments, so character identity disappears at live-game scale.
- Basketball reuses non-basketball gestures: the live source calls a throw-in pose for shot windup and a header pose for rebounds and dunks.
- The ball is positioned near a holder rather than constrained to a visible hand, so catches and finishes can float or snap.
- Bright trails, halos, glow, glass panels, large type, crowd motion, and venue effects compete with the play instead of establishing a hierarchy.
- Camera and graphics celebrate semantic events that the bodies do not yet physically demonstrate.

The reset succeeds only when a muted, graphics-free viewer can read **screen → defensive delay → roll → pass → catch → rotation → contest → dunk → landing** and can identify Stoopy and Toque by silhouette.

## 3. Direction: Handmade Future Sport / Broadcast Maquette

Treat the arena as a meticulously photographed working sports maquette, not a synthetic cyberpunk scene. It should feel physically built and broadcast: simplified forms, deliberate joinery, tactile surfaces, court wear, controlled stadium light, precise body mechanics, and restrained graphics.

The visual hierarchy is fixed:

1. ball and hands;
2. feet, hips, contact, and space;
3. Stoopy and Toque silhouettes;
4. rim, court markings, and defenders;
5. crowd and venue identity;
6. graphics, only after the action is legible.

Stylization may simplify anatomy. It may never simplify causality.

## 4. Production rules

### Shape and character

- Build athletes from authored torso, pelvis, upper/lower limb, hand, and foot masses with visible joints. No single inflated capsule may serve as a finished body.
- Stoopy: low and wide center of mass; broad block-like shoulders and hips; short, forceful steps; unmistakable forward lean during the screen; heavy two-foot gather and landing. His slow second jump must be visible after the finish.
- Toque: tall, narrow vertical silhouette; long forearms; upright stalking stance; quick lateral plant and late high contest. Do not distinguish him with text, glow, or a floating marker.
- Supporting players use at least three body families and role-specific posture. They remain quieter than the principals.
- At the 48-pixel-tall black-silhouette test, at least 8/10 blind reviewers must distinguish Stoopy from Toque and correctly match each name after seeing one labeled reference card.
- Feet visibly plant before force transfers. A grounded foot may move no more than 4 output pixels across three consecutive 60 fps frames.
- During controlled possession, catch, and finish, the ball surface remains within one ball radius of the active hand surface. Ball teleportation, body intersection, and hidden catch frames are veto defects.

### Materials and color

- Use a small tactile family: matte molded foam/urethane for bodies, dyed rubber for ball and shoe soles, woven fabric for kits, painted wood/composite for court, powder-coated metal for structure, and bare metal only for rim/fasteners.
- Preserve seams, edge wear, floor scuffs, and slight manufacturing variation where they explain construction. Do not add random texture noise.
- Working roughness range is 0.55–0.9 except the rim and genuinely wet/varnished details. Avoid mirror surfaces.
- Club colors identify venue, kit panels, numbers, and trim. In the lab, cyan and hot pink may be reduced to bounded side accents; neither may emit across an entire body.
- One emissive accent per principal is the maximum. It must remain readable with bloom disabled.

### Lighting

- One neutral hard arena key, broad soft fill from the court, and restrained back edge are the complete live-play rig.
- Fix exposure for the shot. No auto-exposure pulse, colored fog wash, animated light sweep, or lighting change during the contact chain.
- Shadows must show foot plants and vertical separation. The ball, hands, faces, and rim may not disappear into crushed blacks.
- Bloom is off for review. If later enabled, it must not enlarge any bright edge by more than 2 pixels at 1280×720.

### Crowd and venue

- Build three depth bands: readable courtside silhouettes, mid-bowl color masses, and a low-detail upper bowl. Detail and contrast fall with distance.
- Spectators must not resemble duplicated athletes. Vary seated/standing shapes, height, clothing blocks, and negative space; never move every body in phase.
- Reaction propagates from the rim-side section outward after the finish. First response begins 120–220 ms after rim contact; the opposite section peaks 450–750 ms later.
- The crowd is below player contrast during live action. Signs, flags, and ritual lighting cannot cross the court or create false ball-like highlights.

### Broadcast graphics

- During live play, show only club identities, score, game clock, and shot clock. All other tactical data remains available to test state, not on top of the shot.
- Use one type family, two weights, tabular numerals, and sentence case except team codes. No slogan wall, stacked glass cards, decorative hexadecimal data, or unexplained iconography.
- No temporary graphic appears before the ball clears the rim. The Stoop Drop lower third enters at 12.60 s, occupies the reserved safe zone, begins its deterministic exit at 14.15 s, and has exactly zero rendered opacity by 14.40 s.
- The lower third may state only certified facts bound to the exact event: `STOOPY · THE STOOP DROP`, club, score consequence, and event ID. It cannot imply money, odds, prizes, authority, or footage that does not exist.

### Camera

- Preserve screen direction for the entire possession; New York attacks the same on-screen basket throughout. Never cross the action axis.
- Start with one stable three-quarter tactical master that contains ball handler, Stoopy, Toque, screen contact, passing lane, and the complete rim. The pure timeline publishes the base beat `(3, -48, 18) → (9, 0, 3)` at 42°; the 16:9 output composes that beat through the desktop-safe master `(3, -48, 26) → (3.9, 0, 3)` at 58° so every required subject remains inside the critical-action rectangle without a near-side stand obstructing the play. Portrait remains an independently composed camera.
- One continuous motivated tightening begins at 4.80 s. It passes through the catch composition `(15, -37, 15) → (23, 0, 4.5)` at 39° and 6.10 s, reaches the finish composition `(31, -19, 5.8) → (39, 0, 7.2)` at 37° and 8.20 s, and holds that rim framing through score certification at 8.50 s. It then pulls back continuously through `(29, -24, 8.5) → (39.5, 0.3, 5.4)` at 39° and 8.80 s to the full-body landing composition `(27, -31, 13) → (39.5, 0.5, 3.2)` at 42° and 9.10 s, holding through 9.80 s. Do not cut on screen impact, catch, body contact, rim contact, score certification, or landing.
- One post-landing consequence reframe cuts at 9.80 s and holds through the payoff. It must retain Stoopy's delayed recovery and Toque's earlier readiness in the same picture; an isolating hero close-up is not allowed.
- The only other cut is the reset master at 14.50 s, after the lower-third opacity has already reached zero.
- Camera shake, whip pans, orbiting, speed ramps, depth-of-field hunting, and random cuts are prohibited. Any emphasis must come from composition and movement in the play.
- The ball must remain visible from the start of the pocket pass through rim contact. The camera cannot use an overlay or foreground object to hide a missing contact frame.

| Time | Camera beat | Transition contract |
|---|---|---|
| 0.00–4.80 | Tactical master | Stable hold; ball handler, screen pair, Toque, passing lane, and rim all remain visible. |
| 4.80–9.80 | Motivated tightening | One continuous keyframed move through the 6.10 s catch and 8.20 s finish; preserve rim framing through 8.50 s, pull back through 8.80 s to the 9.10 s full-body landing frame, then hold. |
| 9.80–14.50 | Consequence reframe | One post-landing cut, then a stable medium hold through the lower third and its clear. |
| 14.50–15.00 | Reset master | One reset cut under the authored blackout; no action contact is concealed. |

### Audio

- Build the mix from causal layers: shoe friction, ball bounce, cloth/body contact, pass/catch, takeoff, rim/net, landing, near-crowd reaction, far-crowd response, and room tail.
- Each transient begins within ±2 frames of its visible cause at 60 fps. Contact sounds scale with visible force; no impact may be sold by sound when the bodies miss.
- Keep dribble and shoes forward before the finish. Duck neither for commentary. Crowd rise follows rim contact, not the animation state label.
- No generic trailer boom, riser, glitch, synthetic applause loop, slogan voice, or AI play-by-play is permitted in the proof.

## 5. Prohibited visual tropes

Any one of the following is grounds to reject the frame, not a note for later polish:

- full-body neon emissive capsules in the lab;
- purple/cyan gradient fog, bloom haze, holographic glass, or gratuitous scan lines;
- floating tactical arrows, orbit rings, nameplates, or particles used to explain unreadable motion;
- photoreal venue imagery behind toy-like athletes;
- generated-looking micro-detail, illegible pseudo-text, fake sponsors, or meaningless symbols;
- identical crowd bodies, synchronized bobbing, or fans brighter than players;
- impossible lens moves, camera shake on every impact, or a cut that conceals contact;
- hands that never touch the ball, sliding planted feet, interpenetrating bodies, or a rim/net that does not react;
- oversized score reactions, achievement cards, or lower thirds covering the scorer;
- “epic,” “future,” or “AI” copy used in place of a specific sporting fact.

## 6. Exact 15-second Stoop Drop beat sheet

The proof runs at 60 fps for exactly 900 frames. Timing may vary by no more than two frames in three deterministic repeats.

| Time | Sporting beat | Required visible and audible proof |
|---|---|---|
| 0.00–1.20 | Establish and two dribbles | Tactical master shows ball handler, Stoopy, Toque, screen defender, lane, and rim. Lintel retains possession through two continuous hand → floor → hand cycles: floor contacts at 0.30 and 0.90 s, hand returns at 0.60 and 1.20 s. No temporary graphics. |
| 1.20–3.00 | Stoopy sets | Stoopy widens, lowers, plants left then right foot, squares torso, and becomes still before contact. Shoes squeak separately. |
| 3.00–3.80 | Screen connects | At 3.00 s Parka reaches facing-axis surface contact with Stoopy: published depth radii 0.375 + 0.250 and center separation about 0.633 court-feet. Stoopy stays planted while Parka loses a visible lateral half-step; bodies neither overlap nor float apart. |
| 3.80–5.00 | Corner turned and roll | Lintel's shoulder clears Parka. Stoopy releases the screen, rolls, and begins presenting both hands; Toque opens from weak-side help. The camera remains master until its continuous tighten starts at 4.80 s. |
| 5.00–6.10 | Pocket pass | At 5.00 s the ball leaves Lintel's visible right hand, has no owner while airborne, follows one uninterrupted path, and remains on screen. Pass sound occurs at release. |
| 6.10–6.50 | Two-hand catch | At 6.10 s the ball meets the exact midpoint of Stoopy's left- and right-hand surface anchors. Both hands own it while the elbows yield and the ball settles; there is no hidden catch frame. |
| 6.50–6.75 | Controlled hand transfer | Stoopy retains ownership while the ball moves continuously from the two-hand midpoint to the right-hand anchor. This is a visible gather, not a teleport or new pass. |
| 6.75–7.20 | Squared gather | Ball remains on Stoopy's right hand as both feet gather in sequence and the hips compress. Catch and two footfalls are distinct. |
| 7.20–8.20 | Rise and late rotation | Stoopy drives upward from two planted feet. Toque plants laterally, raises the contest arm, and arrives late enough that the original screen remains the reason for the advantage. Flurry stays grounded and clears to the weak-side help lane, leaving Toque as the sole rim rotation instead of visually merging the two defenders. The tightening camera follows the actual ball. |
| 8.20–8.35 | Controlled rim approach | Stoopy's right hand remains the recorded owner and ball contact stays exact through the final approach. Toque contests without body intersection. |
| 8.35–8.50 | Rim crossing | At 8.35 s ball ownership releases exactly at `(42, 0, 10)`. The ball crosses the rim plane and deforms the net; the score remains 18–17 while the physical result is pending. |
| 8.50–9.10 | Certified finish and descent | At 8.50 s—and only after rim crossing—the score certifies 20–17. The rim/net responds once; the rim-side crowd begins its first physical response 150 ms after contact. Stoopy releases and descends while the camera continuously pulls back to contain both full bodies, both sets of feet, and the ball. The post-net ball deflects continuously toward the baseline, clear of Stoopy's head and torso. |
| 9.10–9.60 | Heavy landing | Stoopy lands at 9.10 s with visible compression. Toque lands, turns, and reaches ordinary second-jump readiness by 9.60 s; Stoopy does not. |
| 9.60–10.06 | Late-recovery cost | A second-effort window is visibly unavailable to Stoopy for exactly 460 ms beyond baseline. The single consequence reframe occurs after landing at 9.80 s and must keep both recoveries readable. |
| 10.06–11.60 | Rebuild base | Stoopy becomes second-jump ready at 10.06 s, rebuilds his stance, and rejoins the possession instead of freezing in a victory pose. Ball motion remains gravitational. |
| 11.60–12.60 | Arena response | Ball bounces away. Reaction propagates from the rim-side sections through the bowl while players retain individual responses; graphics remain absent. |
| 12.60–14.40 | Certified payoff | The consequence reframe keeps Stoopy and the made basket visible. The exact-event lower third enters the reserved zone, begins fading at 14.15 s, and reaches exactly zero opacity at 14.40 s; no fake replay label. |
| 14.40–14.50 | Clean hold | The graphic is visually clear while the consequence composition remains alive for 100 ms. |
| 14.50–15.00 | Reset cut | A single authored reset cut restores the tactical master under blackout and returns all ten athletes and the hidden ball to loop-start positions. |

## 7. Framing and safe zones

All bounds are inclusive and measured in final output pixels. Ball, rim, both principals, screen contact, catch, and finish must remain inside the **critical-action** rectangle. Temporary graphics use only the **post-play** rectangle and only after 12.60 s.

| Output | Critical-action rectangle | Persistent UI | Post-play graphic rectangle | Exclusion |
|---|---|---|---|---|
| Desktop 1280×720 | x 64–1216, y 92–608 | x 20–1260, y 16–76 | x 32–624, y 548–696 | No critical body part or ball behind the lower third. |
| Mobile web 390×844 | x 20–370, y 112–650 | x 12–378, y 16–92 | x 16–374, y 652–820 | Respect device safe-area insets; no horizontal scroll or clipped score. |
| Social 9:16 1080×1920 | x 108–972, y 288–1450 | x 96–984, y 220–352 | x 96–984, y 1330–1590 | Top 0–219 and bottom 1591–1919 are platform-chrome zones; no required text or action. |

- Compose the 16:9 and portrait cameras independently from the same world event. Cropping a desktop capture is not a portrait implementation.
- At contact and finish, retain at least 8% output width between every critical subject and a side edge.
- All required text meets WCAG AA contrast against its actual frame and renders at a minimum 16 CSS pixels on 390×844.

## 8. Required proof package

The lab review package contains exactly:

1. one continuous 1280×720 capture with sound;
2. one continuous 390×844 mobile-web capture with sound;
3. one native 1080×1920 social capture with sound;
4. graphics-on and graphics-off captures from the same deterministic event;
5. a contact sheet at 0.00, 0.30, 0.60, 0.90, 1.20, 3.00, 3.80, 4.80, 5.00, 6.10, 6.50, 6.75, 7.20, 8.20, 8.35, 8.50, 8.80, 9.10, 9.60, 9.80, 10.06, 11.60, 12.60, 14.15, 14.40, 14.50, and 15.00 s;
6. black 48-pixel silhouette cards for Stoopy and Toque;
7. browser state proving the same fixture, score transition, athlete IDs, event ID, and 900-frame duration in three repeats;
8. console/page/request error report and frame-time capture for each format.

Still images cannot pass the lab. The deciding artifact is the uninterrupted real-time sequence.

## 9. Blind-review rubric

Use 10 people who did not build the scene. Randomize an A/B presentation against the current public Basketball possession; match duration, resolution, and audio level. Do not reveal which is new, the design thesis, or the athlete roles before viewing. Each person watches once, then answers without replay.

| Measure | Passing result |
|---|---|
| Play comprehension | At least 8/10 independently report screen, delayed defender, roll/pass, help contest, and made dunk in the correct causal order. |
| Ball continuity | 10/10 can point to the ball carrier at catch and finish; nobody reports a float, teleport, or hidden handoff. |
| Character recognition | At least 8/10 match Stoopy and Toque from the 48-pixel silhouette cards after one labeled reference. |
| Intentional art direction | At least 8/10 choose `handmade / authored / coherent` over `generic neon / generated / asset mix`; no more than 1/10 selects the latter. |
| Broadcast clarity | At least 8/10 say the camera and graphics made the play easier—not harder—to understand. |
| Preference | At least 8/10 prefer the lab sequence to the current public sequence. |
| Pull | At least 8/10 answer yes to “Would you voluntarily watch another possession?” |

Record raw answers and participant order. Do not average away a failed row. Every row must pass.

## 10. Expansion gate

The visual reset may replace public Basketball only when all conditions below are demonstrated on current bytes:

- every beat and tolerance in §6 passes in three deterministic repeats;
- all three output formats pass §7 with no clipped action, overflow, missing glyph, console/page/request error, or frame that hides the ball;
- catch, plant, screen, contest, dunk, rim, net, landing, and crowd-latency contacts pass frame-by-frame review;
- audio synchronization remains within ±2 frames;
- p95 render frame time is at most 20 ms on the recorded desktop reference and 33.3 ms on the recorded mobile reference, with hardware and browser named in the report;
- the blind review passes every row in §9;
- the same rigs and animation system produce five additional autonomous possessions—miss, block, switch denial, pocket-pass turnover, and offensive rebound—without bespoke baked video or contact concealment;
- certified live state and rendered result agree exactly, while spectator controls remain absent;
- Release Manager confirms that the lab is isolated, provenance is complete, and the old public renderer can be restored in one commit.

Expansion order is fixed: **golden possession → five autonomous variations → one uninterrupted quarter → all Basketball fixtures → one new sport pilot**. Do not propagate this art direction to the other five sports, commission merchandise, generate social campaigns, or remove the public cyan/pink athletes before the preceding stage passes.
