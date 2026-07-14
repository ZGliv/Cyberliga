# Cyberliga Release Contract

## Canonical product

- The only release target is the six-sport application on branch `codex/vercel-sports-revamp`.
- Its local worktree is `/Users/Test/Desktop/Projects/Cyberliga/.codex-worktrees/vercel-sports-revamp`.
- Production is `https://cyberliga-ten.vercel.app`; the canonical local preview is `http://127.0.0.1:4173/world.html`.
- `world.html` is Home and `league.html` is Leagues. Global primary navigation exposes only those two destinations.

## Quarantined lineage

- `codex/og-soccer-pass` and the root worktree at `/Users/Test/Desktop/Projects/Cyberliga` are stale/rejected product history.
- Never deploy from that branch or worktree.
- Never replace canonical arena, world, league, package, verifier, or navigation files wholesale with files from that lineage.
- Useful experiments there must be transplanted semantically onto a fresh branch/worktree created from the current canonical HEAD.

## Product invariants

- All six sports remain autonomous, view-only broadcasts with no gameplay, pause, resume, restart, or fullscreen input.
- Live athletes use the classic cyan/hot-pink capsule renderer. Club colors remain in branding, HUDs, venues, crowds, and league identity.
- The public world remains six sports, 48 clubs, 24 simultaneous games, and 416 athletes.
- Preserve the accepted world globe/game network, League HQ, fixture deep links, deterministic hooks, and mobile broadcast cameras.

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
- Confirm browser console/page/request errors are empty, state is finite, mobile has no horizontal overflow, and the classic cyan/pink athlete contract is visible in every sport.
- Confirm port 4173's process cwd is the canonical worktree.
- Deploy to Vercel production only after all checks pass.
