// Stripe Engine — subscription billing for client retainers
// Uses Supabase Edge Function as backend (keeps secret key server-side)
// Tables: billing, contracts (stripe_customer_id, stripe_checkout_url)
// Env vars needed: VITE_STRIPE_PUBLISHABLE_KEY (frontend only)
//   Stripe secret key goes in Supabase Edge Function env, NOT here

import { supabase, isSupabaseConfigured } from '../lib/supabase';

const STRIPE_PK        = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON    = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isStripeConnected = () =>
  !!(STRIPE_PK && STRIPE_PK !== 'your_stripe_publishable_key');

// ─── Call Supabase Edge Function (has Stripe secret key) ─────────────────────
async function callStripeFunction(action, payload) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return { error: 'Supabase not configured' };
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-billing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json();
  return res.ok ? data : { error: data.error || 'Stripe function failed' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE BILLING for a signed contract
// ═══════════════════════════════════════════════════════════════════════════════

export async function setupClientBilling(contract, prospect) {
  if (!isStripeConnected()) {
    return { error: 'Stripe not connected — add VITE_STRIPE_PUBLISHABLE_KEY to .env' };
  }

  // Call Edge Function to create Stripe customer + subscription + checkout link
  const result = await callStripeFunction('create_subscription', {
    customer_email:  contract.contact_email || prospect.email,
    customer_name:   contract.company_name,
    amount_dollars:  contract.monthly_retainer,
    contract_id:     contract.id,
    prospect_id:     contract.prospect_id,
    metadata: {
      company:  contract.company_name,
      niche:    contract.niche,
      location: contract.location,
    },
  });

  if (result.error) return result;

  // Store in billing table
  if (isSupabaseConfigured() && supabase) {
    await supabase.from('billing').insert({
      prospect_id:           contract.prospect_id,
      contract_id:           contract.id,
      company_name:          contract.company_name,
      stripe_customer_id:    result.customer_id,
      stripe_subscription_id: result.subscription_id,
      stripe_checkout_url:   result.checkout_url,
      monthly_amount:        contract.monthly_retainer,
      status:                'pending',
      next_invoice_date:     getNextFirstOfMonth(),
    });

    // Also update the contract row with Stripe info
    await supabase.from('contracts').update({
      stripe_customer_id:  result.customer_id,
      stripe_checkout_url: result.checkout_url,
    }).eq('id', contract.id);
  }

  return {
    success:      true,
    checkoutUrl:  result.checkout_url,
    customerId:   result.customer_id,
    subscriptionId: result.subscription_id,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEND PAYMENT LINK to client
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendPaymentLink(contract, prospect) {
  // Get or create billing record
  let billing = await fetchBillingForContract(contract.id);

  if (!billing?.stripe_checkout_url) {
    const setup = await setupClientBilling(contract, prospect);
    if (setup.error) return setup;
    billing = { stripe_checkout_url: setup.checkoutUrl };
  }

  // Get Resend key
  const RESEND_KEY = import.meta.env.VITE_RESEND_API_KEY;
  if (!RESEND_KEY || RESEND_KEY === 'your_resend_key_here') {
    return { error: 'Resend not connected', checkoutUrl: billing.stripe_checkout_url };
  }

  const firstName = (contract.contact_name || 'there').split(' ')[0];
  const body = `Hi ${firstName},

Your Google Ads management agreement with AMA Leads is active. Here's your payment link to set up your monthly retainer:

${billing.stripe_checkout_url}

Monthly amount: $${contract.monthly_retainer}
First charge: today
Future charges: 1st of each month

The link is secure and takes 2 minutes to complete. Reply to this email if you have any questions.

Ali
AMA Leads`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_KEY}` },
    body: JSON.stringify({
      from: 'Ali — AMA Leads <ali@amaleads.org>',
      to:   [`${contract.contact_name || contract.company_name} <${contract.contact_email}>`],
      subject: `Set up your AMA Leads payment — ${contract.company_name}`,
      text: body,
    }),
  });

  return res.ok ? { success: true, checkoutUrl: billing.stripe_checkout_url } : { error: 'Email failed' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH BILLING DATA
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchBillingForContract(contractId) {
  if (!isSupabaseConfigured() || !supabase) return null;
  const { data } = await supabase
    .from('billing')
    .select('*')
    .eq('contract_id', contractId)
    .single();
  return data;
}

export async function fetchAllBilling() {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data } = await supabase
    .from('billing')
    .select('*')
    .order('created_at', { ascending: false });
  return data || [];
}

export async function fetchMonthlyRevenue() {
  const billing = await fetchAllBilling();
  return billing
    .filter(b => b.status === 'active')
    .reduce((sum, b) => sum + (Number(b.monthly_amount) || 0), 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLE STRIPE WEBHOOK (called by Edge Function)
// ═══════════════════════════════════════════════════════════════════════════════

export async function handlePaymentSuccess(stripeCustomerId, amountDollars) {
  if (!supabase) return;
  await supabase.from('billing').update({
    status:             'active',
    last_payment_at:    new Date().toISOString(),
    last_payment_amount: amountDollars,
    next_invoice_date:  getNextFirstOfMonth(),
  }).eq('stripe_customer_id', stripeCustomerId);
}

export async function handlePaymentFailed(stripeCustomerId) {
  if (!supabase) return;
  await supabase.from('billing').update({ status: 'past_due' })
    .eq('stripe_customer_id', stripeCustomerId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getNextFirstOfMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}
