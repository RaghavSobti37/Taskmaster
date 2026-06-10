-- Taskmaster secondary store (Supabase Postgres)
-- Apply via: npm run supabase:setup

create extension if not exists pgcrypto;

create table if not exists backup_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  status text not null default 'completed',
  source_database text,
  backup_database text,
  collection_count integer not null default 0,
  total_bytes bigint not null default 0,
  collections jsonb not null default '[]'::jsonb,
  source_db_stats jsonb,
  created_at timestamptz not null default now()
);

create table if not exists backup_files (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null references backup_snapshots(snapshot_date) on delete cascade,
  collection_name text not null,
  storage_path text not null,
  document_count integer not null default 0,
  compressed_bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (snapshot_date, collection_name)
);

create table if not exists app_logs (
  id uuid primary key default gen_random_uuid(),
  mongo_id text unique,
  timestamp timestamptz not null,
  origin text,
  actor_id text,
  actor_role text,
  action_type text,
  target_entity text,
  status text,
  payload jsonb,
  execution_time_ms integer,
  user_id text,
  action text,
  details jsonb,
  target_id text,
  target_type text,
  tenant_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_logs_timestamp on app_logs (timestamp desc);
create index if not exists idx_app_logs_origin_status on app_logs (origin, status, timestamp desc);
create index if not exists idx_app_logs_tenant_created on app_logs (tenant_id, created_at desc);

create table if not exists system_logs (
  id uuid primary key default gen_random_uuid(),
  mongo_id text unique,
  timestamp timestamptz not null,
  trace_id text,
  context_id text,
  severity text not null,
  module text not null,
  message text not null,
  user_visible boolean not null default false,
  actor_id text,
  actor_name text,
  route text,
  method text,
  http_status integer,
  error_code text,
  payload jsonb,
  related_entities jsonb,
  tenant_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_system_logs_timestamp on system_logs (timestamp desc);
create index if not exists idx_system_logs_module_severity on system_logs (module, severity, timestamp desc);

create table if not exists crm_audits (
  id uuid primary key default gen_random_uuid(),
  mongo_id text unique,
  lead_id text,
  lead_row_id text,
  user_id text,
  user_role text,
  field_changed text not null,
  old_value text,
  new_value text,
  timestamp timestamptz not null,
  tenant_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_crm_audits_lead_ts on crm_audits (lead_id, timestamp desc);

create table if not exists xp_audit_logs (
  id uuid primary key default gen_random_uuid(),
  mongo_id text unique,
  user_id text not null,
  amount numeric not null,
  action text not null,
  details jsonb,
  previous_amount numeric,
  recalculated_at timestamptz,
  recalc_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_xp_audit_logs_user_created on xp_audit_logs (user_id, created_at desc);

create table if not exists qa_test_runs (
  id uuid primary key default gen_random_uuid(),
  mongo_id text unique,
  status text,
  started_at timestamptz,
  completed_at timestamptz,
  bugs_created integer default 0,
  created_artifacts jsonb,
  cleanup_results jsonb,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_qa_test_runs_status_started on qa_test_runs (status, started_at desc);

create table if not exists mail_event_tag_rollups (
  id uuid primary key default gen_random_uuid(),
  rollup_date date not null,
  user_id text not null,
  event_tag text not null default 'General',
  total_sent integer not null default 0,
  total_opens integer not null default 0,
  total_clicks integer not null default 0,
  open_rate numeric not null default 0,
  ctr numeric not null default 0,
  synced_at timestamptz not null default now(),
  unique (rollup_date, user_id, event_tag)
);

create index if not exists idx_mail_tag_rollups_user_date on mail_event_tag_rollups (user_id, rollup_date desc);

create table if not exists mail_geo_rollups (
  id uuid primary key default gen_random_uuid(),
  rollup_date date not null,
  user_id text not null,
  location text not null default 'unknown',
  city text,
  country text,
  opens integer not null default 0,
  clicks integer not null default 0,
  total integer not null default 0,
  synced_at timestamptz not null default now(),
  unique (rollup_date, user_id, location)
);

create index if not exists idx_mail_geo_rollups_user_date on mail_geo_rollups (user_id, rollup_date desc);

create table if not exists crm_stat_snapshots (
  id uuid primary key default gen_random_uuid(),
  rep_id text,
  scope_key text not null default 'global',
  metrics jsonb not null,
  updated_at timestamptz not null default now(),
  unique (rep_id, scope_key)
);

create index if not exists idx_crm_stat_snapshots_rep on crm_stat_snapshots (rep_id, updated_at desc);

create table if not exists supabase_sync_state (
  stream text primary key,
  last_synced_at timestamptz,
  last_mongo_id text,
  meta jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
