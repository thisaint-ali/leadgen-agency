-- Schema v3 — Big Bot, email sequences, agent improvements
-- Run in Supabase SQL Editor after schema-v2.sql
-- ================================================

-- Big Bot insights: AI-generated observations per analysis run
create table if not exists bigbot_insights (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  type text not null,           -- error | pitch | pipeline | health | campaign | optimization
  priority integer default 2,  -- 1=urgent  2=important  3=nice-to-have
  title text not null,
  insight text not null,
  action text,                  -- recommended next action
  agent_id integer,             -- related agent (1-9) or null
  dismissed boolean default false,
  applied boolean default false
);

-- Big Bot run log
create table if not exists bigbot_runs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  trigger text default 'manual',   -- manual | cron | auto
  duration_ms integer,
  insights_generated integer default 0,
  status text default 'running'    -- running | complete | error
);

-- Email sequences: full drip tracking per prospect
create table if not exists email_sequences (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  prospect_id uuid,                -- links to prospects table
  sequence_number integer default 1,  -- 1=initial  2=followup  3=final
  subject text,
  body text,
  status text default 'draft',    -- draft | queued | sent | replied | bounced | skipped
  scheduled_at timestamptz,
  sent_at timestamptz,
  niche text,
  location text
);

-- Agent improvements: Big Bot proposes, you approve
create table if not exists agent_improvements (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  agent_id integer not null,
  agent_name text,
  reason text not null,
  improved_prompt text not null,
  performance_data text,
  status text default 'pending'   -- pending | approved | rejected
);

-- ================================================
-- RLS — authenticated users own everything
-- ================================================

alter table bigbot_insights  enable row level security;
alter table bigbot_runs      enable row level security;
alter table email_sequences  enable row level security;
alter table agent_improvements enable row level security;

create policy "authenticated full access" on bigbot_insights
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated full access" on bigbot_runs
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated full access" on email_sequences
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated full access" on agent_improvements
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
