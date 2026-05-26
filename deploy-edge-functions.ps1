# AMA Leads — Deploy Supabase Edge Functions
# Run this once you have your API keys ready
# Usage: .\deploy-edge-functions.ps1

$PROJECT_REF = "wtwjuvtvjbdgyefawdcv"

Write-Host "AMA Leads — Supabase Edge Function Deployment" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Step 1: Login to Supabase CLI (opens browser)
Write-Host "`n[1/5] Logging into Supabase..." -ForegroundColor Yellow
npx supabase login

# Step 2: Link project
Write-Host "`n[2/5] Linking project..." -ForegroundColor Yellow
npx supabase link --project-ref $PROJECT_REF

# Step 3: Prompt for secrets
Write-Host "`n[3/5] Setting secrets..." -ForegroundColor Yellow
Write-Host "You'll need: ANTHROPIC_API_KEY, RESEND_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET"
Write-Host ""

$ANTHROPIC_KEY = Read-Host "Enter your Anthropic API key (sk-ant-...)"
$RESEND_KEY = Read-Host "Enter your Resend API key (re_...)"
$STRIPE_SECRET = Read-Host "Enter your Stripe secret key (sk_live_... or sk_test_...)"
$STRIPE_WEBHOOK = Read-Host "Enter your Stripe webhook secret (whsec_...)"

npx supabase secrets set `
    ANTHROPIC_API_KEY=$ANTHROPIC_KEY `
    RESEND_API_KEY=$RESEND_KEY `
    STRIPE_SECRET_KEY=$STRIPE_SECRET `
    STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK `
    --project-ref $PROJECT_REF

# Step 4: Deploy functions
Write-Host "`n[4/5] Deploying bigbot-hourly..." -ForegroundColor Yellow
npx supabase functions deploy bigbot-hourly --no-verify-jwt --project-ref $PROJECT_REF

Write-Host "`n     Deploying stripe-billing..." -ForegroundColor Yellow
npx supabase functions deploy stripe-billing --no-verify-jwt --project-ref $PROJECT_REF

# Step 5: Schedule BigBot cron (print SQL to run manually)
Write-Host "`n[5/5] BigBot hourly cron — run this SQL in Supabase SQL Editor:" -ForegroundColor Yellow
Write-Host ""
Write-Host @"
select cron.schedule(
  'bigbot-hourly',
  '0 * * * *',
  `$`$
  select net.http_post(
    url := 'https://$PROJECT_REF.supabase.co/functions/v1/bigbot-hourly',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  )
  `$`$
);
"@ -ForegroundColor Gray

Write-Host "`n✅ Deployment complete!" -ForegroundColor Green
Write-Host "Replace YOUR_ANON_KEY in the cron SQL with: $((Get-Content .env | Select-String 'VITE_SUPABASE_ANON_KEY=').ToString().Split('=')[1])"
