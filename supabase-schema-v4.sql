-- Schema v4 — Contracts, Proposals, Reports, Campaign Performance
-- Run after schema-v3.sql
-- ================================================

-- Proposals: AI-generated sales proposals per prospect
create table if not exists proposals (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  prospect_id uuid,
  company_name text,
  contact_name text,
  niche text,
  location text,
  monthly_value integer,
  content text not null,          -- full proposal HTML/markdown
  status text default 'draft',    -- draft | sent | accepted | declined
  sent_at timestamptz,
  accepted_at timestamptz
);

-- Contracts: service agreements sent to clients
create table if not exists contracts (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  prospect_id uuid,
  company_name text not null,
  contact_name text,
  contact_email text,
  niche text,
  location text,
  monthly_retainer integer,
  content text not null,          -- full contract text
  signing_token text unique not null,
  status text default 'sent',     -- sent | signed | declined | expired
  signed_at timestamptz,
  campaign_triggered boolean default false
);

-- Campaign performance: weekly metrics per client
create table if not exists campaign_performance (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  prospect_id uuid,
  campaign_id uuid,               -- links to campaigns table
  google_ads_campaign_id text,
  week_start date,
  impressions integer default 0,
  clicks integer default 0,
  conversions integer default 0,
  cost_micros bigint default 0,   -- cost in micros (divide by 1,000,000 for $)
  avg_cpc_micros bigint default 0,
  ctr numeric(5,4) default 0,     -- click-through rate
  conversion_rate numeric(5,4) default 0,
  notes text                      -- AI-generated observations
);

-- Client reports: weekly/monthly reports sent to clients
create table if not exists client_reports (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  prospect_id uuid,
  company_name text,
  report_type text default 'weekly',   -- weekly | monthly
  period_start date,
  period_end date,
  content text not null,               -- full report content
  status text default 'draft',         -- draft | sent | viewed
  sent_at timestamptz
);

-- Automation log: every auto-trigger Big Bot fired
create table if not exists automation_log (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  trigger_type text not null,      -- contract_signed | stale_prospect | weekly_report | etc
  trigger_data jsonb,
  action_taken text not null,
  agent_ids integer[],
  status text default 'success'    -- success | error | skipped
);

-- ================================================
-- RLS
-- ================================================

alter table proposals          enable row level security;
alter table contracts          enable row level security;
alter table campaign_performance enable row level security;
alter table client_reports     enable row level security;
alter table automation_log     enable row level security;

create policy "authenticated full access" on proposals
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated full access" on contracts
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated full access" on campaign_performance
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated full access" on client_reports
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated full access" on automation_log
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- Contracts also need public read for the signing page (no auth)
create policy "public read by token" on contracts
  for select using (true);
