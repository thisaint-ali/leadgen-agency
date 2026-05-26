-- Run this AFTER supabase-schema.sql
-- Additional tables for automation, campaigns, and Master Agent
-- ================================================

-- Email queue: outreach emails ready to send via Resend
create table if not exists email_queue (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  prospect_id uuid references prospects(id) on delete cascade,
  to_name text,
  to_email text not null,
  subject text not null,
  body text not null,
  status text default 'pending',   -- pending | sent | failed | waiting_for_api
  sent_at timestamptz,
  error text
);

-- Client campaigns: auto-built when prospect → client
create table if not exists campaigns (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  prospect_id uuid references prospects(id) on delete cascade,
  company_name text,
  niche text,
  location text,
  status text default 'building',   -- building | ready | active | paused
  keywords_output text,
  adcopy_output text,
  lp_brief_output text,
  audit_output text,
  google_ads_campaign_id text,      -- set when Google Ads API connected
  ghl_contact_id text,              -- set when GHL API connected
  ghl_funnel_id text,
  monthly_budget integer
);

-- Master agent conversation history
create table if not exists master_conversations (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  role text not null,    -- user | assistant
  content text not null
);

-- ================================================
-- RLS
-- ================================================

alter table email_queue enable row level security;
alter table campaigns enable row level security;
alter table master_conversations enable row level security;

create policy "authenticated full access" on email_queue
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated full access" on campaigns
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated full access" on master_conversations
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
