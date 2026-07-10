# Cyberliga canonical backend

This directory defines the production persistence boundary without linking to
or changing any existing Supabase project. The migration was created with the
Supabase CLI and is intentionally unseeded.

## Production environment

Configure these four variables on the server deployment:

- `CYBERLIGA_SUPABASE_URL`: the project URL, for example
  `https://<project-ref>.supabase.co`.
- `CYBERLIGA_SUPABASE_PUBLISHABLE_KEY`: a modern `sb_publishable_...` key. It
  is used for read-only REST calls and is the only key `/api/config` may expose.
- `CYBERLIGA_SUPABASE_SERVICE_ROLE_KEY`: the secret service-role key. It is
  read only by `/api/tick` and must never use a browser-prefixed variable or be
  embedded in client code.
- `CYBERLIGA_CRON_SECRET`: a long random secret sent as
  `Authorization: Bearer <secret>` (or `X-Cyberliga-Cron-Secret`) to
  `/api/tick`.

The public endpoints also recognize `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY`; the tick endpoint recognizes `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. The Cyberliga-prefixed names are recommended so
the boundary remains explicit. Legacy anon keys are not accepted; the public
API and browser presence boundary both require a modern publishable key.

## API behavior

- `GET /api/config` returns only browser-safe runtime configuration.
- `GET /api/live?sport=<sport-key>` returns the current canonical broadcast
  window.
- `GET /api/league?sport=<sport-key>` returns the active season, teams,
  athletes, table, and fixtures.
- `GET|POST /api/tick` is service-only. Repeated observations are safe:
  fixture-level advisory locking, stable event keys, ordered sequences, and a
  one-time standings guard prevent duplicate finalization.

Without Supabase read configuration, the two public data endpoints return a
deterministic six-sport local fallback marked `canonical: false`. If Supabase
is misconfigured or unavailable, they remain available with the same fallback
plus `degraded: true` and `degradedReason: canonical_backend_unavailable`;
fallback data is never represented as canonical.

## Local workflow

Discover CLI behavior before use:

```sh
npx supabase --help
npx supabase migration --help
```

With Docker available, validate the full local stack without touching a remote
project:

```sh
npx supabase start
npx supabase db reset --local
npx supabase db lint --local --schema public --level warning
```

The repository also supports dependency-free validation:

```sh
node --test api/canonical-server.test.mjs
```

Do not run `supabase link`, `supabase db push`, or apply the migration to an
existing project until the target project has been chosen and backed up.
