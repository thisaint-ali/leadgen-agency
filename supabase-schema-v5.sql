-- Schema v5 — Email tracking, competitor reports, Stripe billing
-- Run after schema-v4.sql
-- ================================================

-- Email tracking: open/click events per queued email
create table if not exists email_tracking (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  email_queue_id uuid,
  prospect_id uuid,
  event text not null,          -- sent | opened | clicked | bounced | failed
  subject text,
  to_email text,
  metadata jsonb                -- resend message id, error details, etc.
);

-- Competitor reports: weekly snapshot of competitor ad activity per client
create table if not exists competitor_reports (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  prospect_id uuid,
  company_name text,
  niche text,
  location text,
  content text not null,        -- full Agent 17 report
  competitor_count integer default 0,
  week_start date,
  status text default 'draft'   -- draft | reviewed
);

-- Stripe billing: subscription tracking per client
create table if not exists billing (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  prospect_id uuid,
  contract_id uuid,
  company_name text,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_checkout_url text,
  monthly_amount integer,       -- in dollars
  status text default 'pending', -- pending | active | past_due | cancelled
  next_invoice_date date,
  last_payment_at timestamptz,
  last_payment_amount integer
);

-- Add stripe fields to contracts table (safe — uses if not exists equivalent)
alter table contracts add column if not exists stripe_customer_id text;
alter table contracts add column if not exists stripe_checkout_url text;

-- Add email tracking ref to email_queue
alter table email_queue add column if not exists resend_message_id text;
alter table email_queue add column if not exists sent_at timestamptz;

-- ================================================
-- RLS
-- ================================================

alter table email_tracking    enable row level security;
alter table competitor_reports enable row level security;
alter table billing           enable row level security;

create policy "authenticated full access" on email_tracking
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated full access" on competitor_reports
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "authenticated full access" on billing
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
