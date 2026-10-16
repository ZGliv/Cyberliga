# Saved Cyberliga seasons

The six-sport arena presentation remains intact. A new **The season** panel in
League HQ shows a durable scheduled simulation: standings, scoring leaders,
results, upcoming fixtures, previous seasons and recorded match events.

This league engine is separate from the six browser exhibition engines. The
same 48 clubs and 416 named athletes participate, but arena scores do not settle
league results. The interface states that distinction next to the standings.
The seeded event engine has no paid inference calls. It does not yet model
injury, transfers, training, evolving player skill or a shared arena replay.

## Run locally

Requires Node 20+ and npm. From this checkout:

```sh
npm ci
npm run dev:league
```

Open `http://127.0.0.1:4173/league.html`. This starts the optional worker and web
server together; `.league-data/league.db` survives restarts. `PORT=4196` selects
another port. Ctrl+C stops both. The local database is ignored by Git, blocked
by the web server, and excluded from deployment. Back it up with a SQLite-aware
backup tool while running, or copy the database plus WAL after a clean stop.

## Hosted operation

Production `cyberliga` has its own `cyberliga-leagues` Turso resource, created
through the existing Vercel integration on the **Starter ($0/month)** plan in
`iad1`. Resource ID: `store_1EOTrtiUADNhAjv0`. It does not share another app's
tables. The integration supplies `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to
server functions. Neither is sent to browsers. `CRON_SECRET` protects the daily
`/api/season-cron` endpoint; Vercel supplies its Authorization header.

The initial production epoch is **2026-10-16 03:47:10.723 UTC**. Production was
initialized without historical fixtures or accelerated test results. Each
round takes six minutes; 14 rounds make a season. The ledger stores fixture
rosters, seeds, events and final results. A final score is immutable. Every
sport currently uses the explicit common table rule: win 3, draw 1, loss 0;
ties sort by score difference, then club name.

This is a **clock-driven simulation with catch-up**, not a continuously running
cloud process. `GET /api/seasons` advances at most four overdue rounds using
only the server clock; racing visitors serialize through a write transaction.
Current observations are throttled to one per 30 seconds. A daily Vercel cron
at `04:17 UTC` catches up with bounded transactions (maximum 480 rounds / four
minutes per invocation). Vercel Hobby does not support frequent cron schedules.
The browser shows a catching-up state if more history remains. API callers
cannot supply time, seeds, scores or database commands.

For more timely unattended updates while this Mac is awake, optionally run:

```sh
npx vercel env pull .env.league --environment production --yes
node --env-file=.env.league scripts/league-worker.mjs
```

The worker checks every 30 seconds and catches up after interruption. It uses
the same transactions as hosted visits. Do not print or commit the env file.
Read API responses explain their source and include the last observation and
heartbeat. Public readers see unavailable/stale states on database failures,
never substituted sample records. The season picker currently shows the latest
24 seasons; older fixture records remain stored. Archive pagination is a
follow-up improvement.

## Verification

```sh
npm run test:league
npm run verify
node --test footballbrain.test.mjs footballrules.test.mjs
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/verify-league-ui.mjs
```

The lifecycle tests use isolated temporary databases and accelerated clocks.
They cover all-six season rollover, 100 missed rounds, four-round catch-up caps,
independent racing clients, retry idempotency, transaction rollback, restart,
stable athlete IDs, authenticated cron and rejection of client-supplied time.
UI evidence is in ignored `output/league-ui/`; real remote checks used the
production clock without injecting results. libSQL client 0.17.0 is pinned:
0.18.0 failed the independent-client SQLite commit/rollback regression here.

Follow `AGENTS.md` for canonical integration and production deployment. Do not
deploy this feature worktree or the quarantined root lineage.
