-- Cyberliga canonical league boundary.
-- Public tables contain broadcast-safe league data only. All writes are
-- reserved for the service_role, while anon/authenticated receive explicit
-- SELECT grants constrained by RLS.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;

-- Match Supabase's 2026 explicit-exposure default for future objects created
-- by the migration owner. Every object below is granted deliberately later.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.touch_updated_at() from public, anon, authenticated, service_role;

create table public.seasons (
  id bigint generated always as identity primary key,
  public_id text not null,
  sport_key text not null,
  name text not null,
  status text not null default 'draft',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  rules jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seasons_public_id_key unique (public_id),
  constraint seasons_public_id_format_check check (public_id ~ '^[a-z0-9][a-z0-9-]{2,95}$'),
  constraint seasons_sport_key_format_check check (sport_key ~ '^[a-z0-9][a-z0-9-]{1,47}$'),
  constraint seasons_status_check check (status in ('draft', 'scheduled', 'active', 'completed', 'archived')),
  constraint seasons_time_order_check check (ends_at > starts_at),
  constraint seasons_rules_object_check check (jsonb_typeof(rules) = 'object')
);

create table public.teams (
  id bigint generated always as identity primary key,
  public_id text not null,
  sport_key text not null,
  name text not null,
  code text not null,
  city text not null,
  region text not null default '',
  primary_color text not null,
  secondary_color text not null,
  accent_color text not null,
  motif text not null default '',
  texture text not null default '',
  motion_language text not null default '',
  rivalry_team_id bigint,
  active boolean not null default true,
  is_public boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teams_public_id_key unique (public_id),
  constraint teams_public_id_format_check check (public_id ~ '^[a-z0-9][a-z0-9-]{2,95}$'),
  constraint teams_sport_key_format_check check (sport_key ~ '^[a-z0-9][a-z0-9-]{1,47}$'),
  constraint teams_code_format_check check (code ~ '^[A-Z0-9]{2,8}$'),
  constraint teams_primary_color_check check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint teams_secondary_color_check check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint teams_accent_color_check check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint teams_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  constraint teams_rivalry_team_id_fkey foreign key (rivalry_team_id)
    references public.teams(id) on delete set null,
  constraint teams_rivalry_not_self_check check (rivalry_team_id is null or rivalry_team_id <> id)
);

create table public.season_teams (
  season_id bigint not null,
  team_id bigint not null,
  seed integer,
  division text not null default '',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint season_teams_pkey primary key (season_id, team_id),
  constraint season_teams_season_id_fkey foreign key (season_id)
    references public.seasons(id) on delete cascade,
  constraint season_teams_team_id_fkey foreign key (team_id)
    references public.teams(id) on delete restrict,
  constraint season_teams_seed_check check (seed is null or seed > 0)
);

create table public.athletes (
  id bigint generated always as identity primary key,
  public_id text not null,
  team_id bigint not null,
  sport_key text not null,
  display_name text not null,
  squad_number integer,
  role text not null,
  archetype text not null default '',
  temperament text not null default '',
  silhouette text not null default '',
  signature text not null default '',
  active boolean not null default true,
  is_public boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint athletes_public_id_key unique (public_id),
  constraint athletes_id_team_id_key unique (id, team_id),
  constraint athletes_public_id_format_check check (public_id ~ '^[a-z0-9][a-z0-9-]{2,127}$'),
  constraint athletes_sport_key_format_check check (sport_key ~ '^[a-z0-9][a-z0-9-]{1,47}$'),
  constraint athletes_squad_number_check check (squad_number is null or squad_number between 0 and 999),
  constraint athletes_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  constraint athletes_team_id_fkey foreign key (team_id)
    references public.teams(id) on delete restrict
);

create table public.fixtures (
  id bigint generated always as identity primary key,
  public_id text not null,
  season_id bigint not null,
  home_team_id bigint not null,
  away_team_id bigint not null,
  round_number integer not null,
  channel integer not null default 0,
  seed bigint not null,
  starts_at timestamptz not null,
  scheduled_end_at timestamptz not null,
  status text not null default 'scheduled',
  venue text not null default '',
  is_public boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fixtures_public_id_key unique (public_id),
  constraint fixtures_season_channel_starts_key unique (season_id, channel, starts_at),
  constraint fixtures_public_id_format_check check (public_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$'),
  constraint fixtures_round_number_check check (round_number > 0),
  constraint fixtures_channel_check check (channel >= 0),
  constraint fixtures_time_order_check check (scheduled_end_at > starts_at),
  constraint fixtures_distinct_teams_check check (home_team_id <> away_team_id),
  constraint fixtures_status_check check (status in ('scheduled', 'live', 'final', 'cancelled', 'postponed')),
  constraint fixtures_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  constraint fixtures_season_id_fkey foreign key (season_id)
    references public.seasons(id) on delete cascade,
  constraint fixtures_home_team_id_fkey foreign key (home_team_id)
    references public.teams(id) on delete restrict,
  constraint fixtures_away_team_id_fkey foreign key (away_team_id)
    references public.teams(id) on delete restrict,
  constraint fixtures_home_season_team_fkey foreign key (season_id, home_team_id)
    references public.season_teams(season_id, team_id) on delete restrict,
  constraint fixtures_away_season_team_fkey foreign key (season_id, away_team_id)
    references public.season_teams(season_id, team_id) on delete restrict
);

create table public.matches (
  id bigint generated always as identity primary key,
  public_id text not null,
  fixture_id bigint not null,
  status text not null default 'scheduled',
  phase text not null default 'pregame',
  revision bigint not null default 0,
  elapsed_ms bigint not null default 0,
  home_score integer not null default 0,
  away_score integer not null default 0,
  next_event_sequence bigint not null default 1,
  snapshot jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  last_tick_at timestamptz,
  finalized_at timestamptz,
  standings_applied_at timestamptz,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_public_id_key unique (public_id),
  constraint matches_fixture_id_key unique (fixture_id),
  constraint matches_status_check check (status in ('scheduled', 'live', 'final', 'cancelled')),
  constraint matches_revision_check check (revision >= 0),
  constraint matches_elapsed_ms_check check (elapsed_ms >= 0),
  constraint matches_home_score_check check (home_score >= 0),
  constraint matches_away_score_check check (away_score >= 0),
  constraint matches_next_event_sequence_check check (next_event_sequence > 0),
  constraint matches_snapshot_object_check check (jsonb_typeof(snapshot) = 'object'),
  constraint matches_finalized_shape_check check (
    (status = 'final' and finalized_at is not null and ended_at is not null)
    or (status <> 'final')
  ),
  constraint matches_fixture_id_fkey foreign key (fixture_id)
    references public.fixtures(id) on delete restrict
);

create table public.match_events (
  id bigint generated always as identity primary key,
  match_id bigint not null,
  sequence_no bigint not null,
  event_key text not null,
  event_time_ms bigint not null,
  kind text not null,
  team_id bigint,
  athlete_id bigint,
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  constraint match_events_match_sequence_key unique (match_id, sequence_no),
  constraint match_events_match_event_key_key unique (match_id, event_key),
  constraint match_events_id_match_id_key unique (id, match_id),
  constraint match_events_sequence_no_check check (sequence_no > 0),
  constraint match_events_event_time_ms_check check (event_time_ms >= 0),
  constraint match_events_event_key_check check (length(event_key) between 3 and 160),
  constraint match_events_kind_check check (kind ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint match_events_payload_object_check check (jsonb_typeof(payload) = 'object'),
  constraint match_events_athlete_requires_team_check check (athlete_id is null or team_id is not null),
  constraint match_events_match_id_fkey foreign key (match_id)
    references public.matches(id) on delete cascade,
  constraint match_events_team_id_fkey foreign key (team_id)
    references public.teams(id) on delete restrict,
  constraint match_events_athlete_team_fkey foreign key (athlete_id, team_id)
    references public.athletes(id, team_id) on delete restrict
);

create table public.standings (
  season_id bigint not null,
  team_id bigint not null,
  rank integer,
  played integer not null default 0,
  wins integer not null default 0,
  draws integer not null default 0,
  losses integer not null default 0,
  points integer not null default 0,
  score_for integer not null default 0,
  score_against integer not null default 0,
  streak text not null default '',
  form text[] not null default '{}'::text[],
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint standings_pkey primary key (season_id, team_id),
  constraint standings_rank_check check (rank is null or rank > 0),
  constraint standings_counts_check check (
    played >= 0 and wins >= 0 and draws >= 0 and losses >= 0
    and played = wins + draws + losses
    and points >= 0 and score_for >= 0 and score_against >= 0
  ),
  constraint standings_form_check check (cardinality(form) <= 8),
  constraint standings_season_id_fkey foreign key (season_id)
    references public.seasons(id) on delete cascade,
  constraint standings_team_id_fkey foreign key (team_id)
    references public.teams(id) on delete restrict,
  constraint standings_season_team_fkey foreign key (season_id, team_id)
    references public.season_teams(season_id, team_id) on delete cascade
);

create table public.media_records (
  id bigint generated always as identity primary key,
  public_id text not null,
  match_id bigint not null,
  event_id bigint,
  kind text not null,
  status text not null default 'pending',
  url text,
  poster_url text,
  duration_ms bigint,
  width integer,
  height integer,
  metadata jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_records_public_id_key unique (public_id),
  constraint media_records_public_id_format_check check (public_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$'),
  constraint media_records_kind_check check (kind in ('highlight', 'recap', 'poster', 'thumbnail', 'replay')),
  constraint media_records_status_check check (status in ('pending', 'rendering', 'ready', 'failed', 'rejected')),
  constraint media_records_duration_check check (duration_ms is null or duration_ms >= 0),
  constraint media_records_dimensions_check check (
    ((width is null) = (height is null))
    and (width is null or (width > 0 and height > 0))
  ),
  constraint media_records_ready_shape_check check (status <> 'ready' or url is not null),
  constraint media_records_metadata_object_check check (jsonb_typeof(metadata) = 'object'),
  constraint media_records_match_id_fkey foreign key (match_id)
    references public.matches(id) on delete cascade,
  constraint media_records_event_match_fkey foreign key (event_id, match_id)
    references public.match_events(id, match_id) on delete restrict
);

-- Only aggregated spectator counts enter the public schema. No viewer IDs,
-- addresses, user agents, or raw heartbeat rows are stored here.
create table public.presence_aggregates (
  match_id bigint not null,
  bucket_at timestamptz not null,
  concurrent_viewers integer not null default 0,
  peak_viewers integer not null default 0,
  reactions integer not null default 0,
  country_count integer not null default 0,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint presence_aggregates_pkey primary key (match_id, bucket_at),
  constraint presence_aggregates_bucket_check check (
    date_trunc('minute', bucket_at) = bucket_at
  ),
  constraint presence_aggregates_counts_check check (
    concurrent_viewers >= 0 and peak_viewers >= concurrent_viewers
    and reactions >= 0 and country_count >= 0
  ),
  constraint presence_aggregates_match_id_fkey foreign key (match_id)
    references public.matches(id) on delete cascade
);

create table public.heartbeat_aggregates (
  bucket_at timestamptz primary key,
  healthy_workers integer not null default 0,
  processed_matches integer not null default 0,
  tick_latency_ms_p95 integer not null default 0,
  latest_observed_at timestamptz not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint heartbeat_aggregates_bucket_check check (
    date_trunc('minute', bucket_at) = bucket_at
  ),
  constraint heartbeat_aggregates_counts_check check (
    healthy_workers >= 0 and processed_matches >= 0 and tick_latency_ms_p95 >= 0
  )
);

create table private.runtime_heartbeats (
  runtime_key text primary key,
  observed_at timestamptz not null,
  processed_fixture_count integer not null default 0,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint runtime_heartbeats_runtime_key_check check (length(runtime_key) between 3 and 96),
  constraint runtime_heartbeats_count_check check (processed_fixture_count >= 0),
  constraint runtime_heartbeats_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

-- Query-path and reciprocal FK indexes. Unique/primary-key indexes already
-- cover matches.fixture_id, events(match_id, sequence_no), standings, and
-- presence(match_id, bucket_at), so they are not duplicated.
create index seasons_public_active_sport_idx
  on public.seasons (sport_key, starts_at desc)
  where status = 'active' and is_public;
create index teams_public_sport_name_idx
  on public.teams (sport_key, name)
  where active and is_public;
create index teams_rivalry_team_id_idx on public.teams (rivalry_team_id)
  where rivalry_team_id is not null;
create index season_teams_team_id_idx on public.season_teams (team_id, season_id);
create index athletes_team_number_idx on public.athletes (team_id, squad_number)
  where active;
create index fixtures_public_live_window_idx
  on public.fixtures (starts_at, scheduled_end_at, channel)
  where status in ('scheduled', 'live') and is_public;
create index fixtures_season_starts_idx on public.fixtures (season_id, starts_at desc);
create index fixtures_season_home_team_idx on public.fixtures (season_id, home_team_id);
create index fixtures_season_away_team_idx on public.fixtures (season_id, away_team_id);
create index fixtures_home_team_id_idx on public.fixtures (home_team_id, starts_at desc);
create index fixtures_away_team_id_idx on public.fixtures (away_team_id, starts_at desc);
create index matches_public_status_tick_idx on public.matches (status, last_tick_at desc)
  where is_public;
create index matches_last_tick_at_idx on public.matches (last_tick_at desc)
  where last_tick_at is not null;
create index match_events_team_id_idx on public.match_events (team_id, occurred_at desc)
  where team_id is not null;
create index match_events_athlete_id_idx on public.match_events (athlete_id, occurred_at desc)
  where athlete_id is not null;
create index standings_season_rank_idx
  on public.standings (season_id, rank, points desc, score_for desc);
create index standings_team_id_idx on public.standings (team_id, season_id);
create index media_records_public_match_idx
  on public.media_records (match_id, published_at desc)
  where status = 'ready' and is_public;
create index media_records_event_id_idx on public.media_records (event_id)
  where event_id is not null;
create index heartbeat_aggregates_latest_idx
  on public.heartbeat_aggregates (latest_observed_at desc)
  where is_public;
create index runtime_heartbeats_observed_at_idx
  on private.runtime_heartbeats (observed_at desc);

create trigger seasons_touch_updated_at before update on public.seasons
  for each row execute function private.touch_updated_at();
create trigger teams_touch_updated_at before update on public.teams
  for each row execute function private.touch_updated_at();
create trigger season_teams_touch_updated_at before update on public.season_teams
  for each row execute function private.touch_updated_at();
create trigger athletes_touch_updated_at before update on public.athletes
  for each row execute function private.touch_updated_at();
create trigger fixtures_touch_updated_at before update on public.fixtures
  for each row execute function private.touch_updated_at();
create trigger matches_touch_updated_at before update on public.matches
  for each row execute function private.touch_updated_at();
create trigger standings_touch_updated_at before update on public.standings
  for each row execute function private.touch_updated_at();
create trigger media_records_touch_updated_at before update on public.media_records
  for each row execute function private.touch_updated_at();
create trigger presence_aggregates_touch_updated_at before update on public.presence_aggregates
  for each row execute function private.touch_updated_at();
create trigger heartbeat_aggregates_touch_updated_at before update on public.heartbeat_aggregates
  for each row execute function private.touch_updated_at();
create trigger runtime_heartbeats_touch_updated_at before update on private.runtime_heartbeats
  for each row execute function private.touch_updated_at();

-- All exposed tables are protected by RLS. Policies are SELECT-only and
-- require rows to be explicitly marked public; no public write policy exists.
alter table public.seasons enable row level security;
alter table public.teams enable row level security;
alter table public.season_teams enable row level security;
alter table public.athletes enable row level security;
alter table public.fixtures enable row level security;
alter table public.matches enable row level security;
alter table public.match_events enable row level security;
alter table public.standings enable row level security;
alter table public.media_records enable row level security;
alter table public.presence_aggregates enable row level security;
alter table public.heartbeat_aggregates enable row level security;
alter table private.runtime_heartbeats enable row level security;
alter table private.runtime_heartbeats force row level security;

create policy seasons_public_read on public.seasons
  for select to anon, authenticated using (is_public);
create policy teams_public_read on public.teams
  for select to anon, authenticated using (is_public);
create policy season_teams_public_read on public.season_teams
  for select to anon, authenticated using (is_public);
create policy athletes_public_read on public.athletes
  for select to anon, authenticated using (is_public);
create policy fixtures_public_read on public.fixtures
  for select to anon, authenticated using (is_public);
create policy matches_public_read on public.matches
  for select to anon, authenticated using (is_public);
create policy match_events_public_read on public.match_events
  for select to anon, authenticated using (is_public);
create policy standings_public_read on public.standings
  for select to anon, authenticated using (is_public);
create policy media_records_public_read on public.media_records
  for select to anon, authenticated using (is_public and status = 'ready');
create policy presence_aggregates_public_read on public.presence_aggregates
  for select to anon, authenticated using (is_public);
create policy heartbeat_aggregates_public_read on public.heartbeat_aggregates
  for select to anon, authenticated using (is_public);

revoke all on table
  public.seasons,
  public.teams,
  public.season_teams,
  public.athletes,
  public.fixtures,
  public.matches,
  public.match_events,
  public.standings,
  public.media_records,
  public.presence_aggregates,
  public.heartbeat_aggregates
from public, anon, authenticated, service_role;

grant select on table
  public.seasons,
  public.teams,
  public.season_teams,
  public.athletes,
  public.fixtures,
  public.matches,
  public.match_events,
  public.standings,
  public.media_records,
  public.presence_aggregates,
  public.heartbeat_aggregates
to anon, authenticated;

grant select, insert, update, delete on table
  public.seasons,
  public.teams,
  public.season_teams,
  public.athletes,
  public.fixtures,
  public.matches,
  public.match_events,
  public.standings,
  public.media_records,
  public.presence_aggregates,
  public.heartbeat_aggregates
to service_role;

grant usage, select on all sequences in schema public to service_role;

-- One service-only transaction owns match creation, ordered-event insertion,
-- monotonic advancement, finalization, and the one-time standings mutation.
-- Stable sequence/event keys plus the standings_applied_at guard make retries
-- idempotent, while the transaction advisory lock serializes competing workers.
create or replace function public.canonical_apply_tick(
  p_fixture_public_id text,
  p_observed_at timestamptz,
  p_snapshot jsonb,
  p_events jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fixture public.fixtures%rowtype;
  v_match public.matches%rowtype;
  v_season public.seasons%rowtype;
  v_status text;
  v_phase text;
  v_elapsed_ms bigint;
  v_revision bigint;
  v_home_score integer;
  v_away_score integer;
  v_is_public boolean;
  v_apply_standings boolean := false;
  v_home_points integer := 0;
  v_away_points integer := 0;
  v_home_result text;
  v_away_result text;
  v_win_points integer;
  v_draw_points integer;
begin
  if p_fixture_public_id is null or length(p_fixture_public_id) < 3 then
    raise exception 'fixture public id is required' using errcode = '22023';
  end if;
  if p_observed_at is null then
    raise exception 'observed_at is required' using errcode = '22023';
  end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'snapshot must be a JSON object' using errcode = '22023';
  end if;
  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    raise exception 'events must be a JSON array' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('cyberliga.fixture.' || p_fixture_public_id, 0)
  );

  select f.* into v_fixture
  from public.fixtures as f
  where f.public_id = p_fixture_public_id
  for update;

  if not found then
    raise exception 'unknown fixture: %', p_fixture_public_id using errcode = 'P0002';
  end if;
  if v_fixture.status in ('cancelled', 'postponed') then
    raise exception 'fixture % cannot advance from status %', p_fixture_public_id, v_fixture.status
      using errcode = '22023';
  end if;
  if p_observed_at < v_fixture.starts_at then
    raise exception 'fixture % has not started', p_fixture_public_id using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_events) as proposed_event(value)
    where nullif(proposed_event.value->>'teamId', '') is not null
      and not exists (
        select 1
        from public.teams as event_team
        where event_team.public_id = proposed_event.value->>'teamId'
          and event_team.id in (v_fixture.home_team_id, v_fixture.away_team_id)
      )
  ) then
    raise exception 'an event references a team outside fixture %', p_fixture_public_id
      using errcode = '23514';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_events) as proposed_event(value)
    where nullif(proposed_event.value->>'athleteId', '') is not null
      and not exists (
        select 1
        from public.athletes as event_athlete
        join public.teams as event_team on event_team.id = event_athlete.team_id
        where event_athlete.public_id = proposed_event.value->>'athleteId'
          and event_team.public_id = proposed_event.value->>'teamId'
          and event_team.id in (v_fixture.home_team_id, v_fixture.away_team_id)
      )
  ) then
    raise exception 'an event references an athlete outside fixture %', p_fixture_public_id
      using errcode = '23514';
  end if;

  select s.* into strict v_season
  from public.seasons as s
  where s.id = v_fixture.season_id;

  v_elapsed_ms := greatest(
    0,
    least(
      floor(extract(epoch from (v_fixture.scheduled_end_at - v_fixture.starts_at)) * 1000)::bigint,
      floor(extract(epoch from (p_observed_at - v_fixture.starts_at)) * 1000)::bigint
    )
  );
  v_status := case
    when p_observed_at >= v_fixture.scheduled_end_at or p_snapshot->>'status' = 'final' then 'final'
    else 'live'
  end;
  v_phase := case when v_status = 'final' then 'final' else coalesce(nullif(p_snapshot->>'phase', ''), 'live') end;
  v_revision := greatest(0, coalesce((p_snapshot->>'revision')::bigint, 0));
  v_home_score := greatest(0, coalesce((p_snapshot->>'homeScore')::integer, 0));
  v_away_score := greatest(0, coalesce((p_snapshot->>'awayScore')::integer, 0));
  v_is_public := v_fixture.is_public and v_season.is_public;

  insert into public.matches (
    public_id,
    fixture_id,
    status,
    phase,
    revision,
    elapsed_ms,
    home_score,
    away_score,
    snapshot,
    started_at,
    ended_at,
    last_tick_at,
    finalized_at,
    is_public
  ) values (
    'match-' || v_fixture.public_id,
    v_fixture.id,
    v_status,
    v_phase,
    v_revision,
    v_elapsed_ms,
    v_home_score,
    v_away_score,
    p_snapshot || jsonb_build_object('fixtureId', v_fixture.public_id),
    v_fixture.starts_at,
    case when v_status = 'final' then v_fixture.scheduled_end_at end,
    p_observed_at,
    case when v_status = 'final' then p_observed_at end,
    v_is_public
  )
  on conflict on constraint matches_fixture_id_key do update set
    status = case when public.matches.status = 'final' then 'final' else excluded.status end,
    phase = case when public.matches.status = 'final' then 'final' else excluded.phase end,
    revision = greatest(public.matches.revision, excluded.revision),
    elapsed_ms = greatest(public.matches.elapsed_ms, excluded.elapsed_ms),
    home_score = greatest(public.matches.home_score, excluded.home_score),
    away_score = greatest(public.matches.away_score, excluded.away_score),
    snapshot = case
      when public.matches.status = 'final' then public.matches.snapshot
      else excluded.snapshot
    end,
    started_at = coalesce(public.matches.started_at, excluded.started_at),
    ended_at = coalesce(public.matches.ended_at, excluded.ended_at),
    last_tick_at = greatest(public.matches.last_tick_at, excluded.last_tick_at),
    finalized_at = coalesce(public.matches.finalized_at, excluded.finalized_at),
    is_public = public.matches.is_public or excluded.is_public
  where public.matches.status <> 'final'
    and (
      public.matches.revision < excluded.revision
      or public.matches.elapsed_ms < excluded.elapsed_ms
      or public.matches.home_score < excluded.home_score
      or public.matches.away_score < excluded.away_score
      or public.matches.status <> excluded.status
      or public.matches.is_public <> (public.matches.is_public or excluded.is_public)
    );

  select m.* into strict v_match
  from public.matches as m
  where m.fixture_id = v_fixture.id
  for update;

  insert into public.match_events (
    match_id,
    sequence_no,
    event_key,
    event_time_ms,
    kind,
    team_id,
    athlete_id,
    occurred_at,
    payload,
    is_public
  )
  select
    v_match.id,
    (event_row.value->>'sequence')::bigint,
    event_row.value->>'eventKey',
    greatest(0, (event_row.value->>'elapsedMs')::bigint),
    event_row.value->>'kind',
    team_row.id,
    athlete_row.id,
    v_fixture.starts_at + make_interval(
      secs => greatest(0, (event_row.value->>'elapsedMs')::double precision) / 1000.0
    ),
    coalesce(event_row.value->'payload', '{}'::jsonb),
    v_is_public
  from jsonb_array_elements(p_events) with ordinality as event_row(value, position)
  left join public.teams as team_row
    on team_row.public_id = nullif(event_row.value->>'teamId', '')
  left join public.athletes as athlete_row
    on athlete_row.public_id = nullif(event_row.value->>'athleteId', '')
    and athlete_row.team_id = team_row.id
  where event_row.value ? 'sequence'
    and event_row.value ? 'eventKey'
    and event_row.value ? 'elapsedMs'
    and event_row.value ? 'kind'
    and (event_row.value->>'sequence')::bigint > 0
  on conflict do nothing;

  update public.matches as m set
    next_event_sequence = coalesce(
      (select max(e.sequence_no) + 1 from public.match_events as e where e.match_id = v_match.id),
      1
    )
  where m.id = v_match.id
    and m.next_event_sequence <> coalesce(
      (select max(e.sequence_no) + 1 from public.match_events as e where e.match_id = v_match.id),
      1
    );

  update public.fixtures as f set
    status = v_status
  where f.id = v_fixture.id and f.status <> v_status;

  if v_status = 'final' then
    update public.matches as m set
      standings_applied_at = coalesce(m.finalized_at, p_observed_at)
    where m.id = v_match.id
      and m.status = 'final'
      and m.standings_applied_at is null
    returning true into v_apply_standings;

    if coalesce(v_apply_standings, false) then
      v_win_points := greatest(0, coalesce((v_season.rules->>'winPoints')::integer, 3));
      v_draw_points := greatest(0, coalesce((v_season.rules->>'drawPoints')::integer, 1));
      if v_home_score > v_away_score then
        v_home_result := 'W';
        v_away_result := 'L';
        v_home_points := v_win_points;
      elsif v_away_score > v_home_score then
        v_home_result := 'L';
        v_away_result := 'W';
        v_away_points := v_win_points;
      else
        v_home_result := 'D';
        v_away_result := 'D';
        v_home_points := v_draw_points;
        v_away_points := v_draw_points;
      end if;

      insert into public.standings (season_id, team_id, is_public)
      values
        (v_fixture.season_id, v_fixture.home_team_id, v_is_public),
        (v_fixture.season_id, v_fixture.away_team_id, v_is_public)
      on conflict on constraint standings_pkey do nothing;

      update public.standings set
        played = played + 1,
        wins = wins + case when v_home_result = 'W' then 1 else 0 end,
        draws = draws + case when v_home_result = 'D' then 1 else 0 end,
        losses = losses + case when v_home_result = 'L' then 1 else 0 end,
        points = points + v_home_points,
        score_for = score_for + v_home_score,
        score_against = score_against + v_away_score,
        streak = v_home_result,
        form = (array_append(form, v_home_result))[greatest(1, cardinality(array_append(form, v_home_result)) - 7):],
        is_public = is_public or v_is_public
      where season_id = v_fixture.season_id and team_id = v_fixture.home_team_id;

      update public.standings set
        played = played + 1,
        wins = wins + case when v_away_result = 'W' then 1 else 0 end,
        draws = draws + case when v_away_result = 'D' then 1 else 0 end,
        losses = losses + case when v_away_result = 'L' then 1 else 0 end,
        points = points + v_away_points,
        score_for = score_for + v_away_score,
        score_against = score_against + v_home_score,
        streak = v_away_result,
        form = (array_append(form, v_away_result))[greatest(1, cardinality(array_append(form, v_away_result)) - 7):],
        is_public = is_public or v_is_public
      where season_id = v_fixture.season_id and team_id = v_fixture.away_team_id;
    end if;
  end if;

  insert into private.runtime_heartbeats (
    runtime_key,
    observed_at,
    processed_fixture_count,
    metadata
  ) values (
    'canonical-tick',
    p_observed_at,
    1,
    jsonb_build_object('fixtureId', v_fixture.public_id, 'status', v_status)
  )
  on conflict (runtime_key) do update set
    observed_at = greatest(private.runtime_heartbeats.observed_at, excluded.observed_at),
    processed_fixture_count = private.runtime_heartbeats.processed_fixture_count + 1,
    last_error = null,
    metadata = excluded.metadata;

  insert into public.heartbeat_aggregates (
    bucket_at,
    healthy_workers,
    processed_matches,
    tick_latency_ms_p95,
    latest_observed_at,
    is_public
  ) values (
    date_trunc('minute', p_observed_at),
    1,
    (
      select count(*)::integer
      from public.matches as observed_match
      where observed_match.last_tick_at >= date_trunc('minute', p_observed_at)
        and observed_match.last_tick_at < date_trunc('minute', p_observed_at) + interval '1 minute'
    ),
    0,
    p_observed_at,
    v_is_public
  )
  on conflict (bucket_at) do update set
    healthy_workers = greatest(public.heartbeat_aggregates.healthy_workers, 1),
    processed_matches = (
      select count(*)::integer
      from public.matches as observed_match
      where observed_match.last_tick_at >= date_trunc('minute', p_observed_at)
        and observed_match.last_tick_at < date_trunc('minute', p_observed_at) + interval '1 minute'
    ),
    latest_observed_at = greatest(public.heartbeat_aggregates.latest_observed_at, excluded.latest_observed_at),
    is_public = public.heartbeat_aggregates.is_public or excluded.is_public;

  select m.* into strict v_match
  from public.matches as m
  where m.id = v_match.id;

  return jsonb_build_object(
    'fixtureId', v_fixture.public_id,
    'matchId', v_match.public_id,
    'status', v_match.status,
    'revision', v_match.revision,
    'elapsedMs', v_match.elapsed_ms,
    'homeScore', v_match.home_score,
    'awayScore', v_match.away_score,
    'nextEventSequence', v_match.next_event_sequence,
    'finalizedAt', v_match.finalized_at,
    'standingsAppliedAt', v_match.standings_applied_at
  );
end;
$$;

revoke all on function public.canonical_apply_tick(text, timestamptz, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.canonical_apply_tick(text, timestamptz, jsonb, jsonb)
  to service_role;

comment on function public.canonical_apply_tick(text, timestamptz, jsonb, jsonb) is
  'Service-only, retry-safe canonical match advancement and finalization boundary.';
