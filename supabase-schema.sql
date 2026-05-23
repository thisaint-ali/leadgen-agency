-- Run this entire file in the Supabase SQL Editor

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

-- Enable Row Level Security
alter table runs enable row level security;
alter table agent_outputs enable row level security;
alter table prospect_searches enable row level security;

-- Allow authenticated users (you) to do everything
-- using() = controls SELECT/DELETE, with check() = controls INSERT/UPDATE
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
