-- PitchPrep schema. Run once in the Supabase SQL editor, or via `npm run db:setup` (idempotent).
-- RLS is ON for every table with no policies: browsers never touch the database directly.
-- All access goes through server routes using the service-role key, scoped by a signed workspace cookie.

create extension if not exists pgcrypto;

create table if not exists workspaces (
  id uuid primary key,
  email text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists founder_profiles (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  profile jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists briefs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  investor_name text not null,
  firm text not null,
  investor_key text not null,                -- lower(name)|lower(firm), used for cache and delta
  status text not null default 'running'
    check (status in ('running','complete','partial','unverified','failed')),
  stages jsonb not null default '[]',
  result jsonb,
  error text,
  user_context text,
  meeting_at timestamptz,
  profile_snapshot jsonb,
  parent_brief_id uuid references briefs(id) on delete set null,
  share_token text unique,
  is_seed boolean not null default false,
  latency_ms int,
  cost_usd numeric(10,5),
  tokens_in int,
  tokens_out int,
  grounded_queries int,
  claims_verified int,
  claims_dropped int,
  sources int,
  confidence text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists briefs_ws_idx on briefs (workspace_id, created_at desc);
create index if not exists briefs_key_idx on briefs (workspace_id, investor_key, created_at desc);
create index if not exists briefs_seed_idx on briefs (is_seed) where is_seed;

create table if not exists claims (
  id bigserial primary key,
  brief_id uuid not null references briefs(id) on delete cascade,
  claim_id text not null,
  section text not null,
  kind text not null,
  text text not null,
  event_date date,
  verified boolean not null,
  drop_reason text,
  judge text,
  evidence_ids text[] not null default '{}',
  quote text,
  severity text
);
create index if not exists claims_brief_idx on claims (brief_id);

create table if not exists evidence (
  id bigserial primary key,
  brief_id uuid not null references briefs(id) on delete cascade,
  evidence_id text not null,
  url text not null,
  domain text not null,
  title text,
  published_at date,
  tier int not null,
  full_fetch boolean not null,
  origin text not null
);
create index if not exists evidence_brief_idx on evidence (brief_id);

create table if not exists feedback (
  id bigserial primary key,
  brief_id uuid not null references briefs(id) on delete cascade,
  claim_id text,
  verdict text not null check (verdict in ('wrong','outdated','helpful')),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id bigserial primary key,
  at timestamptz not null default now(),
  source text not null,
  type text not null,
  brief_id uuid,
  payload jsonb not null default '{}'
);
create index if not exists events_at_idx on events (at desc);

create table if not exists rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

-- Atomic counter for rate limiting: returns the new count inside the current window.
create or replace function bump_rate(p_key text, p_window timestamptz)
returns int language plpgsql as $$
declare c int;
begin
  insert into rate_limits (key, window_start, count) values (p_key, p_window, 1)
  on conflict (key, window_start) do update set count = rate_limits.count + 1
  returning count into c;
  return c;
end $$;


-- Calendar: a secret iCal link per workspace, and the investor meetings detected from it.
create table if not exists calendar_feeds (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  ical_url text not null,
  auto_prepare boolean not null default false,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  uid text not null,
  starts_at timestamptz not null,
  title text,
  attendees jsonb not null default '[]',
  is_investor boolean not null default false,
  investor_name text,
  firm text,
  confidence text,
  brief_id uuid references briefs(id) on delete set null,
  status text not null default 'detected' check (status in ('detected','prepared','skipped')),
  created_at timestamptz not null default now(),
  unique (workspace_id, uid)
);
create index if not exists meetings_ws_idx on meetings (workspace_id, starts_at);

alter table calendar_feeds enable row level security;
alter table meetings enable row level security;


-- Pipeline: where each investor stands, plus the founder's own notes and next step.
create table if not exists investor_notes (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  investor_key text not null,                -- same key as briefs.investor_key
  investor_name text not null,
  firm text not null,
  status text not null default 'researching'
    check (status in ('researching','booked','met','followed_up','in_talks','passed')),
  notes text not null default '',
  next_step text not null default '',
  next_step_on date,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, investor_key)
);

alter table investor_notes enable row level security;

alter table workspaces enable row level security;
alter table founder_profiles enable row level security;
alter table briefs enable row level security;
alter table claims enable row level security;
alter table evidence enable row level security;
alter table feedback enable row level security;
alter table events enable row level security;
alter table rate_limits enable row level security;

-- Explicit grants, scoped to PitchPrep's own tables only (this project is shared with other apps; their grants are not touched).
grant usage on schema public to service_role;
grant all on table workspaces, founder_profiles, briefs, claims, evidence, feedback, events, rate_limits, calendar_feeds, meetings, investor_notes to service_role;
grant all on sequence claims_id_seq, evidence_id_seq, feedback_id_seq, events_id_seq to service_role;
grant execute on function bump_rate(text, timestamptz) to service_role;
