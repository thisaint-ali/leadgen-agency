// Stripe Billing Edge Function
// Handles: create_subscription, payment_webhook
// Deploy: supabase functions deploy stripe-billing --no-verify-jwt
// Env vars needed in Supabase dashboard:
//   STRIPE_SECRET_KEY=sk_live_...
//   STRIPE_WEBHOOK_SECRET=whsec_...

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET   = Deno.env.get('STRIPE_SECRET_KEY')      || '';
const WEBHOOK_SECRET  = Deno.env.get('STRIPE_WEBHOOK_SECRET')   || '';
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')             || '';
const SUPABASE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')|| '';
// App URL for Stripe redirect after checkout — set in Supabase secrets
const APP_URL         = Deno.env.get('APP_URL') || 'https://leadgen-agency-ebon.vercel.app';

const stripeApi = async (endpoint: string, method: string, body?: Record<string, unknown>) => {
  const params = body ? new URLSearchParams(body as Record<string, string>).toString() : '';
  const res = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: method !== 'GET' ? params : undefined,
  });
  return res.json();
};

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // ── Create subscription + checkout session ────────────────────────────────
    if (body.action === 'create_subscription') {
      const { customer_email, customer_name, amount_dollars, contract_id, prospect_id, metadata } = body;

      if (!STRIPE_SECRET) {
        return new Response(JSON.stringify({ error: 'Stripe not configured — add STRIPE_SECRET_KEY to Supabase Edge Function env' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create customer
      const customer = await stripeApi('customers', 'POST', {
        email: customer_email,
        name:  customer_name,
        'metadata[contract_id]':  contract_id,
        'metadata[prospect_id]':  prospect_id,
      });

      // Create price (monthly recurring)
      const price = await stripeApi('prices', 'POST', {
        unit_amount:         String(amount_dollars * 100), // cents
        currency:            'usd',
        recurring_interval:  'month',
        'product_data[name]': `AMA Leads Management — ${customer_name}`,
      });

      // Create checkout session for subscription
      const session = await stripeApi('checkout/sessions', 'POST', {
        customer:                  customer.id,
        mode:                      'subscription',
        'line_items[0][price]':    price.id,
        'line_items[0][quantity]': '1',
        success_url:               `${APP_URL}?billing=success&company=${encodeURIComponent(customer_name)}`,
        cancel_url:                `${APP_URL}?billing=cancelled`,
        'metadata[contract_id]':   contract_id,
      });

      return new Response(JSON.stringify({
        customer_id:     customer.id,
        subscription_id: null, // created when checkout completes
        checkout_url:    session.url,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Stripe webhook (direct from Stripe, verified by signature) ───────────
    if (body.action === 'webhook') {
      // Verify webhook signature to prevent spoofed events
      const stripeSignature = req.headers.get('stripe-signature');
      if (WEBHOOK_SECRET && stripeSignature) {
        // Reconstruct the signed payload and verify HMAC
        const rawBody = JSON.stringify(body.event || body);
        const parts   = stripeSignature.split(',');
        const ts      = parts.find(p => p.startsWith('t='))?.slice(2) || '';
        const v1      = parts.find(p => p.startsWith('v1='))?.slice(3) || '';
        const payload = `${ts}.${rawBody}`;
        const key     = await crypto.subtle.importKey('raw', new TextEncoder().encode(WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const sig     = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
        const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
        if (computed !== v1) {
          return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), { status: 400 });
        }
      }
      const event = body.event;

      if (event.type === 'invoice.paid') {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const amountPaid = Math.round(invoice.amount_paid / 100); // dollars

        await supabase.from('billing').update({
          status:              'active',
          last_payment_at:     new Date().toISOString(),
          last_payment_amount: amountPaid,
          stripe_subscription_id: invoice.subscription,
        }).eq('stripe_customer_id', customerId);

        // Log automation
        await supabase.from('automation_log').insert({
          trigger_type: 'stripe_payment_received',
          trigger_data: { customer_id: customerId, amount: amountPaid },
          action_taken: `Payment of $${amountPaid} received`,
          status: 'success',
        });
      }

      if (event.type === 'invoice.payment_failed') {
        const invoice = event.data.object;
        await supabase.from('billing').update({ status: 'past_due' })
          .eq('stripe_customer_id', invoice.customer);

        await supabase.from('automation_log').insert({
          trigger_type: 'stripe_payment_failed',
          trigger_data: { customer_id: invoice.customer },
          action_taken: 'Payment failed — billing marked past_due',
          status: 'error',
        });
      }

      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
