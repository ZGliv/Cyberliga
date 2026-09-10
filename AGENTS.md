# Cyberliga Release Contract

## Canonical product

- The only release target is the six-sport application on branch `codex/vercel-sports-revamp`.
- Its local worktree is `/Users/Test/Desktop/Projects/Cyberliga/.codex-worktrees/vercel-sports-revamp`.
- Production is `https://cyberliga-ten.vercel.app`; the canonical local preview is `http://127.0.0.1:4173/world.html`.
- `world.html` is Home and `league.html` is Leagues. Global primary navigation exposes only those two destinations.
- The September 2026 public edition uses the pixel World, League HQ, Athlete Files and six pixel broadcasts. Retired guide, wire, replay, concept-clip, operations and laboratory URLs redirect to Home and stay excluded from deployment.
- The public UI uses the dark sports network design in `network-ui.css`, `network-world.css`, `network-league.css`, `player.css` and `arcade-broadcast.css`. Keep shared branding, self-hosted fonts, canonical club links and mobile first-fold watch access. The old `world-desk.css`, `arcade-world.css` and `league.css` layers stay excluded from deployment.
- Arena HTML loads the current shell CSS before first paint; hidden compatibility DOM must never flash during navigation.

## Quarantined lineage

- `codex/og-soccer-pass` and the root worktree at `/Users/Test/Desktop/Projects/Cyberliga` are stale/rejected product history.
- Never deploy from that branch or worktree.
- Never replace canonical arena, world, league, package, verifier, or navigation files wholesale with files from that lineage.
- Useful experiments there must be transplanted semantically onto a fresh branch/worktree created from the current canonical HEAD.

## Product invariants

- All six sports remain autonomous, view-only broadcasts with no gameplay, pause, resume, restart, or fullscreen input.
- Live athletes use the approved authored pixel renderer in `arcade-broadcast.js`, with cyan/hot-pink side signals. Club colors and authored kit motifs remain in athlete trim/equipment/identity, HUDs, venues, crowds, and league identity.
- The public world remains six sports, 48 clubs, 24 simultaneous games, and 416 athletes.
- Preserve the accepted world globe/game network, League HQ, fixture deep links, deterministic hooks, and mobile broadcast cameras.
- `branddata.js` is the 48-club venue, ritual, mark, environment and kit-pattern source of truth. Arena work must consume those identities rather than inventing a second club canon.
- Sporting decisions must use seeded, versioned randomness isolated from render-only particles, camera shake, crowd variation, and frame timing.
- Do not claim that club stadium or uniform art is AI-generated production art unless the approved source asset, prompt/model/version provenance, runtime derivative and review state exist in the repository. Procedural SVG concepts and league hero images must be labeled honestly.
- Read `SPECTATOR_AUDIT.md` before changing an arena. Preserve its physical-action, broadcast, venue, crowd, athlete, determinism, mobile and clip-readiness gates.

## Feature task workflow

1. Start from the current `codex/vercel-sports-revamp` HEAD in an isolated feature worktree.
2. Keep the feature scoped; do not deploy it.
3. Run targeted browser/game QA and commit the feature.
4. Hand the commit SHA and changed-file list to the Release Manager task.
5. The Release Manager audits all worktrees, integrates compatible commits, runs the complete gate, commits one release, restarts port 4173 from the canonical worktree, and deploys production.

## Mandatory release gate

- Canonical worktree must be clean and on `codex/vercel-sports-revamp` before deployment.
- Run `npm run verify`.
- Run `node --test footballbrain.test.mjs footballrules.test.mjs`.
- Run the official web-game client and visually inspect live desktop and 390x844 screenshots for Home, League HQ, and all six arenas.
- Confirm browser console/page/request errors are empty, state is finite, mobile has no horizontal overflow, and the authored pixel cyan/pink athlete contract is visible in every sport.
- Confirm each arena resolves the selected home club's authored venue/ritual and displays club identity on the pixel athletes without changing their cyan/pink side signal.
- Run deterministic/long-soak sport checks appropriate to the changed arena; static verification is never sufficient evidence of spectator quality.
- Run `scripts/verify-network-ui.mjs` with the configured Playwright module against the canonical preview; all six Home → match → club → athlete journeys and share fallbacks must pass.
- Confirm port 4173's process cwd is the canonical worktree.
- Commit the exact release snapshot, then run `npm run release:check`; it refuses the stale branch, wrong worktree, dirty tree, wrong Vercel project, or alternate homepage.
- Deploy to Vercel production only after all checks pass.
