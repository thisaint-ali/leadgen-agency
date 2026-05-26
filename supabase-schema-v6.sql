-- AMA Leads — Schema v6
-- Run this in Supabase SQL Editor → New query → Run
-- Adds: tasks, agent_templates, campaign_metrics, bigbot_config

-- ─── Tasks ────────────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id           uuid default gen_random_uuid() primary key,
  prospect_id  uuid references public.prospects(id) on delete cascade,
  title        text not null,
  due_date     date,
  completed    boolean default false,
  completed_at timestamptz,
  created_at   timestamptz default now()
);

-- ─── Agent output templates ───────────────────────────────────────────────────
create table if not exists public.agent_templates (
  id          uuid default gen_random_uuid() primary key,
  agent_id    integer not null,
  agent_name  text not null,
  name        text not null,
  content     text not null,
  niche       text,
  location    text,
  created_at  timestamptz default now()
);

-- ─── Campaign metrics (manual entry — feeds A13/A14) ─────────────────────────
create table if not exists public.campaign_metrics (
  id           uuid default gen_random_uuid() primary key,
  prospect_id  uuid references public.prospects(id) on delete set null,
  company_name text not null,
  week_start   date not null,
  impressions  integer,
  clicks       integer,
  leads        integer,
  spend        numeric(10,2),
  cpl          numeric(10,2),
  ctr          numeric(5,2),
  notes        text,
  created_at   timestamptz default now(),
  unique (prospect_id, week_start)
);

-- ─── BigBot config (singleton row) ───────────────────────────────────────────
create table if not exists public.bigbot_config (
  id                    integer primary key default 1 check (id = 1),
  stale_days            integer default 7,
  check_contracts       boolean default true,
  check_stale_proposals boolean default true,
  monday_reports        boolean default true,
  send_emails           boolean default true,
  max_emails_per_run    integer default 10,
  updated_at            timestamptz default now()
);

insert into public.bigbot_config (id) values (1) on conflict (id) do nothing;

-- ─── RLS policies ─────────────────────────────────────────────────────────────
alter table public.tasks           enable row level security;
alter table public.agent_templates enable row level security;
alter table public.campaign_metrics enable row level security;
alter table public.bigbot_config   enable row level security;

create policy if not exists "tasks_all"     on public.tasks           for all using (true) with check (true);
create policy if not exists "templates_all" on public.agent_templates for all using (true) with check (true);
create policy if not exists "metrics_all"   on public.campaign_metrics for all using (true) with check (true);
create policy if not exists "config_all"    on public.bigbot_config   for all using (true) with check (true);
