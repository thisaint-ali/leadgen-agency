# AMA Leads — Full Deployment Guide

## 1. Vercel Environment Variables

Add these in Vercel → Project → Settings → Environment Variables:

### Required (app won't function without these)
| Variable | Where to get it |
|----------|-----------------|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public key |
| `VITE_ANTHROPIC_API_KEY` | console.anthropic.com → Settings → API Keys |

### Email (enables all outreach, reports, contracts)
| Variable | Value |
|----------|-------|
| `VITE_RESEND_API_KEY` | resend.com → API Keys |
| `VITE_FROM_EMAIL` | your verified sending domain email, e.g. `ali@yourdomain.com` |
| `VITE_FROM_NAME` | e.g. `Ali — AMA Leads` |

### Google Ads (enables live campaign creation + performance sync)
All 5 required:
| Variable | Notes |
|----------|-------|
| `VITE_GOOGLE_ADS_DEVELOPER_TOKEN` | Apply at developers.google.com/google-ads/api (1-3 days) |
| `VITE_GOOGLE_ADS_CLIENT_ID` | Google Cloud Console → OAuth 2.0 Client ID |
| `VITE_GOOGLE_ADS_CLIENT_SECRET` | Same OAuth client |
| `VITE_GOOGLE_ADS_REFRESH_TOKEN` | Run OAuth flow once, store the refresh token |
| `VITE_GOOGLE_ADS_CUSTOMER_ID` | Your Google Ads customer ID (no dashes) |

### Stripe (enables client billing)
| Variable | Notes |
|----------|-------|
| `VITE_STRIPE_PUBLISHABLE_KEY` | stripe.com → Developers → API Keys → Publishable key |

### Analytics (optional)
| Variable | Value |
|----------|-------|
| `VITE_GA4_ID` | e.g. `G-XXXXXXXXXX` from Google Analytics → Admin → Data Streams |

### GoHighLevel (optional)
| Variable | Notes |
|----------|-------|
| `VITE_GHL_API_KEY` | GHL → Settings → Integrations → API Keys |
| `VITE_GHL_LOCATION_ID` | Your GHL location/sub-account ID |

---

## 2. Deploy Edge Functions to Supabase

Install Supabase CLI and deploy both functions:

```bash
npm install -g supabase
supabase login
supabase link --project-ref wtwjuvtvjbdgyefawdcv
```

### Set Edge Function secrets (server-side only — NOT in Vercel)
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set FROM_EMAIL=ali@yourdomain.com
supabase secrets set FROM_NAME="Ali — AMA Leads"
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

### Deploy the functions
```bash
supabase functions deploy bigbot-hourly --no-verify-jwt
supabase functions deploy stripe-billing --no-verify-jwt
```

---

## 3. Schedule BigBot to Run Every Hour (24/7)

Run this SQL in Supabase SQL Editor:

```sql
-- Enable pg_cron and pg_net if not already enabled
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule BigBot to run every hour
select cron.schedule(
  'bigbot-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://wtwjuvtvjbdgyefawdcv.supabase.co/functions/v1/bigbot-hourly',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_SUPABASE_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);
```

Replace `YOUR_SUPABASE_ANON_KEY` with your actual anon key.

To verify the cron is scheduled:
```sql
select * from cron.job;
```

To view run history:
```sql
select * from cron.job_run_details order by start_time desc limit 20;
```

---

## 4. Set Up Stripe Webhook

1. Go to stripe.com → Developers → Webhooks → Add endpoint
2. Endpoint URL: `https://wtwjuvtvjbdgyefawdcv.supabase.co/functions/v1/stripe-billing`
3. Select events: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`
4. Copy the webhook signing secret → add as `STRIPE_WEBHOOK_SECRET` to Supabase secrets

---

## 5. Verification Checklist

After deploying, verify each system:

- [ ] App loads at your Vercel URL
- [ ] BigBot "Run now" generates real insights (not demo mode)
- [ ] Pipeline shows prospects from Supabase
- [ ] Follow-up email sends (check email_queue in Supabase)
- [ ] Contract signing page works at `?sign=TOKEN`
- [ ] BigBot Edge Function appears in Supabase → Edge Functions → Logs
- [ ] Cron runs hourly (check cron.job_run_details)
- [ ] Stripe billing creates a checkout session (check billing table)

---

## 6. What Each Integration Unlocks

| Connected | What starts working |
|-----------|---------------------|
| Anthropic | All 17 AI agents, BigBot analysis, Master Agent |
| Resend | Outreach emails, follow-ups, contract emails, weekly reports |
| Google Ads | Live campaign creation, performance sync, CPL tracking |
| Stripe | Client subscription management, auto-billing, payment links |
| GoHighLevel | Contact creation, funnel deployment, sub-accounts |
| GA4 | Usage analytics, conversion tracking |
| BigBot cron | 24/7 automation (email queue, Monday reports, stale alerts) |
