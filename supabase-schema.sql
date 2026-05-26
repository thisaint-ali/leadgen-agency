-- Run this entire file in the Supabase SQL Editor
-- ================================================
-- TABLES
-- ================================================

create table runs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  niche text not null,
  location text not null,
  extra_context text,
  status text default 'running'
);

create table agent_outputs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  run_id uuid references runs(id) on delete cascade,
  agent_id integer not null,
  agent_name text not null,
  output text,
  status text not null
);

create table prospect_searches (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  niche text not null,
  location text not null,
  output text
);

-- Pipeline CRM: one row per prospect company
create table prospects (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  company_name text not null,
  contact_name text,
  email text,
  phone text,
  website text,
  niche text default 'roofing contractors',
  location text,
  status text default 'new',   -- new | contacted | replied | call_booked | proposal | client | dead
  notes text,
  monthly_value integer,       -- retainer value once they become a client
  source text default 'manual',
  last_contacted_at timestamptz
);

-- Outreach log: every email/call attempt
create table outreach_log (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  prospect_id uuid references prospects(id) on delete cascade,
  channel text default 'email',  -- email | call | linkedin
  subject text,
  notes text,
  outcome text default 'sent'    -- sent | replied | no_answer | bounced
);

-- ================================================
-- ROW LEVEL SECURITY
-- ================================================

alter table runs enable row level security;
alter table agent_outputs enable row level security;
alter table prospect_searches enable row level security;
alter table prospects enable row level security;
alter table outreach_log enable row level security;

-- Allow authenticated users (you) to do everything
create policy "authenticated full access" on runs
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "authenticated full access" on agent_outputs
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "authenticated full access" on prospect_searches
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "authenticated full access" on prospects
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy "authenticated full access" on outreach_log
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
