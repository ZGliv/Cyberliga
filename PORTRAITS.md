# CYBERLIGA Player Portrait Generation Pack

Paste these into ChatGPT (DALL·E), Midjourney, or any image model. Generate square 1:1.
Save outputs as `portraits/<TEAM>_<NAME>.png` in this folder — the game will pick them up
in a later pass, and they're also your social avatars / player cards / Tripo3D inputs.

## LOCKED STYLE TEMPLATE (keep identical across all 28 — consistency IS the brand)

> Stylized 3D-render character portrait, premium esports broadcast quality (Arcane /
> Fortnite cinematic style), upper-body shot of a futuristic cyber-athlete, sleek
> sport-tech armor over an athletic jersey, [TEAM_KIT], jersey number [NUM] and the name
> "[NAME]" printed across the chest band, [PLAYER_LOOK], glowing visor accents in
> [GLOW_COLOR], neon stadium bokeh background in team colors, dramatic rim lighting,
> confident pose, square 1:1 character-sheet portrait, consistent series style

Team kit values:
- NEON FC → `cyan and deep-navy kit, electric cyan #00e5ff glow`
- VOLT UTD → `hot-pink and black kit, magenta #ff2d78 glow`
- GRID ROYALS → `gold and charcoal kit, amber #ffc24d glow`
- ASTRA NOVA → `violet and midnight kit, ultraviolet #8a5cff glow`

## THE 28 PLAYERS — [PLAYER_LOOK] per player

### NEON FC (cyan)
1.  #1 OKAFOR-9 (GK) — towering broad-shouldered keeper, calm unreadable expression, scarred chrome jaw plate, captain's aura
2.  #4 VEKTOR (DEF) — lean angular veteran, sharp cheekbones, short silver hair, analytical stare
3.  #5 HALCYON (DEF) — stocky tank build, friendly grin, buzzcut with glowing circuit tattoo on temple
4.  #8 SYNTH (MID) — slim graceful playmaker, heterochromatic eyes (one cyan LED), sleek dark undercut
5.  #6 AXIOM (MID) — compact muscular engine, intense brow, headband, jaw set in concentration
6.  #9 RAZOR (FWD) — explosive athletic striker, cocky half-smile, mohawk with cyan tips, lightning scar on cheek
7.  #11 PRISM (FWD) — tall elegant finisher, serene expression, long braided hair with fiber-optic strands

### VOLT UTD (pink)
8.  #1 TESLA JR (GK) — wiry acrobatic keeper, wild grin, static-charged spiky white hair
9.  #2 CIPHER (DEF) — mysterious masked defender, lower face covered by sleek respirator, hooded eyes
10. #5 ONYX (DEF) — massive immovable wall, shaved head, dark stone-like composite skin plating
11. #7 GLITCH (MID) — twitchy trickster, asymmetric haircut, holographic flicker effect on one arm, mischievous smirk
12. #8 BLITZ (MID) — square-jawed box-to-box warrior, crew cut, taped nose like a boxer
13. #10 NOVA (FWD) — radiant star player, supernova-bright eyes, flowing magenta-streaked hair, magazine-cover looks
14. #14 PULSE (FWD) — young phenom, baby-faced with braces of LED light, energetic wide eyes

### GRID ROYALS (gold)
15. #1 KILOWATT (GK) — grizzled veteran keeper, gray stubble beard, one gold prosthetic eye, weathered face
16. #3 MAINFRAME (DEF) — cerebral organizer, rectangular AR glasses, neat fade haircut, professor's calm
17. #4 TURBINE (DEF) — barrel-chested powerhouse, big laugh lines, dreadlocks tied back with gold rings
18. #7 DYNAMO (MID) — relentless runner, lean and sinewy, sweatband, hollow determined eyes
19. #10 CIRCUIT (MID) — regal playmaker, gold-leaf face paint accents, immaculate waves haircut, chin raised
20. #9 VANTA (FWD) — shadow-dark matte-black armor, only glowing amber eyes visible, menacing stillness
21. #11 HELIX (FWD) — corkscrew-agile winger, double-helix shaved pattern in hair, playful wink

### ASTRA NOVA (violet)
22. #1 ORBIT (GK) — serene spacey keeper, shaved head with constellation tattoos, floating calm expression
23. #2 QUASAR (DEF) — volatile enforcer, perpetual scowl, cracked visor he never repaired, red card history written on his face
24. #6 ZENITH (DEF) — tall noble defender, silver-white hair swept back, aristocratic features
25. #8 NEBULA (MID) — dreamy creative mind, soft features, hair like a purple galaxy cloud, distant gaze
26. #10 COMET (MID) — blazing-fast veteran, motion-blur trails in his hair design, crow's feet from squinting at speed
27. #9 STARFALL (FWD) — dramatic showman striker, theatrical expression, cape-like collar, starburst pupil implants
28. #7 LUMEN (FWD) — bioluminescent youngster, glowing freckle constellation, bright hopeful smile

## NEXT STEPS AFTER GENERATION
1. Drop the 28 PNGs in `Cyberliga/portraits/` — they wire into player profiles + future site.
2. (Optional, the 3D leap) Make a free https://tripo3d.ai or https://meshy.ai account, hand
   Claude the API key → portraits become rigged 3D bodies automatically.
3. Re-run any portrait you don't love — the template keeps the series consistent.
