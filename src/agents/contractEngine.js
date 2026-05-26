// Contract Engine — proposal generation, contract creation, signing, campaign trigger
// Agents used: 10 (Proposal Writer), 11 (Contract Generator), 12 (Onboarding Email)
// Tables: proposals, contracts, automation_log

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SYSTEM_PROMPTS } from './systemPrompts';

const API_KEY      = import.meta.env.VITE_ANTHROPIC_API_KEY;
const RESEND_KEY   = import.meta.env.VITE_RESEND_API_KEY;
const DEMO_MODE    = !API_KEY || API_KEY === 'your_anthropic_key_here' || API_KEY.trim() === '';

function generateToken() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Call Claude ─────────────────────────────────────────────────────────────
async function callClaude(systemPrompt, userContent, model = 'claude-sonnet-4-20250514', maxTokens = 2000) {
  if (DEMO_MODE) return null;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.[0]?.text?.trim() || '';
}

// ─── Send email via Resend ────────────────────────────────────────────────────
async function sendEmail({ to, toName, subject, body, from = 'ali@amaleads.org', fromName = 'Ali — AMA Leads' }) {
  if (!RESEND_KEY || RESEND_KEY === 'your_resend_key_here') {
    console.log('[contractEngine] Resend not connected — would send to:', to, 'Subject:', subject);
    return { queued: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_KEY}` },
    body: JSON.stringify({
      from: `${fromName} <${from}>`,
      to: [`${toName} <${to}>`],
      subject,
      text: body,
    }),
  });
  const data = await res.json();
  return res.ok ? { id: data.id } : { error: data.message };
}

// ─── Log automation event ─────────────────────────────────────────────────────
async function logAutomation(triggerType, triggerData, actionTaken, agentIds = [], status = 'success') {
  if (!supabase) return;
  await supabase.from('automation_log').insert({
    trigger_type: triggerType,
    trigger_data: triggerData,
    action_taken: actionTaken,
    agent_ids: agentIds,
    status,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROPOSAL
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateProposal(prospect, onProgress) {
  const log = msg => onProgress?.(msg);

  const prompt = `Company: ${prospect.company_name}
Niche: ${prospect.niche}
Location: ${prospect.location}
Contact name: ${prospect.contact_name || 'the owner'}
Estimated monthly retainer: $${prospect.monthly_value || 2500}
Notes from qualification: ${prospect.notes || 'No additional notes'}
Date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

  log('Agent 10 writing proposal…');

  let content;
  if (DEMO_MODE) {
    await new Promise(r => setTimeout(r, 2000));
    content = `SUBJECT LINE: ${prospect.company_name} — Google Ads Growth Proposal from AMA Leads

---

${prospect.company_name} — Google Ads Growth Proposal
Prepared by AMA Leads | ${new Date().toLocaleDateString()}

EXECUTIVE SUMMARY
We've identified a clear gap in ${prospect.company_name}'s digital presence — specifically the absence of paid search advertising while competitors in ${prospect.location} actively capture high-intent ${prospect.niche} searches. This proposal outlines a data-driven Google Ads strategy to generate qualified leads within 30 days.

THE OPPORTUNITY
${prospect.niche.charAt(0).toUpperCase() + prospect.niche.slice(1)} in ${prospect.location} see 800–2,400 monthly Google searches for relevant keywords. Your current digital footprint relies on organic and referral traffic, leaving paid intent traffic — the highest-converting source — entirely to competitors. We found 6 active advertisers in your market, meaning the opportunity window is open but won't stay that way.

WHAT WE'LL DO
- Month 1: Campaign build and launch — keyword research, ad copy, landing page, conversion tracking
- Ongoing: Weekly optimization, bid management, A/B testing, monthly reporting
- Guarantee: If we don't generate leads in 30 days, month 2 is free

THE NUMBERS
- Estimated monthly searches: 1,200–2,400
- Estimated CPL range: $45–$85
- Target leads per month: 15–25 at recommended budget
- Ad spend recommendation: $1,500/month (client pays Google directly)
- Management fee: $${prospect.monthly_value || 2500}/month

WHY AMA LEADS
- We specialize exclusively in ${prospect.niche} — we know your customer's search behavior cold
- Performance guarantee — if you don't get leads in 30 days, month 2 is free
- You own all campaign assets — campaigns, keywords, data — from day one

NEXT STEPS
1. Review this proposal
2. 15-minute call to confirm details
3. Sign service agreement → campaign live within 5 business days

Ali
AMA Leads
amaleads.org`;
  } else {
    content = await callClaude(SYSTEM_PROMPTS[10], prompt);
  }

  if (!content) return { error: 'Failed to generate proposal' };

  // Extract subject line
  const subjectMatch = content.match(/SUBJECT LINE:\s*(.*)/i);
  const subject = subjectMatch?.[1]?.trim() || `${prospect.company_name} — Google Ads Proposal`;

  // Store in Supabase
  let proposalId = null;
  if (isSupabaseConfigured() && supabase) {
    const { data } = await supabase.from('proposals').insert({
      prospect_id:  prospect.id,
      company_name: prospect.company_name,
      contact_name: prospect.contact_name,
      niche:        prospect.niche,
      location:     prospect.location,
      monthly_value: Number(prospect.monthly_value) || 2500,
      content,
      status: 'draft',
    }).select().single();
    proposalId = data?.id;

    await logAutomation(
      'proposal_generated',
      { prospect_id: prospect.id, company: prospect.company_name },
      `Generated proposal for ${prospect.company_name}`,
      [10]
    );
  }

  log('Proposal ready ✓');
  return { success: true, content, subject, proposalId };
}

export async function sendProposal(proposalId, prospect, proposalContent, subject) {
  if (!prospect.email) return { error: 'No email address for prospect' };

  const emailResult = await sendEmail({
    to: prospect.email,
    toName: prospect.contact_name || prospect.company_name,
    subject,
    body: proposalContent,
  });

  if (isSupabaseConfigured() && supabase && proposalId) {
    await supabase.from('proposals').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    }).eq('id', proposalId);

    await logAutomation(
      'proposal_sent',
      { prospect_id: prospect.id, proposal_id: proposalId },
      `Sent proposal email to ${prospect.email}`,
      [10]
    );
  }

  return emailResult;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRACT
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateContract(prospect, onProgress) {
  const log = msg => onProgress?.(msg);

  const retainer = Number(prospect.monthly_value) || 2500;
  const today    = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const prompt = `Client name: ${prospect.contact_name || 'Client'}
Company: ${prospect.company_name}
Niche: ${prospect.niche}
Location: ${prospect.location}
Monthly retainer: $${retainer}
Date: ${today}`;

  log('Agent 11 generating contract…');

  let content;
  if (DEMO_MODE) {
    await new Promise(r => setTimeout(r, 1500));
    content = `GOOGLE ADS MANAGEMENT SERVICES AGREEMENT

This agreement is entered into between AMA Leads ("Agency") and ${prospect.company_name} ("Client").

1. SERVICES
Agency will provide: Google Ads campaign creation, keyword research, ad copywriting, ongoing bid management, landing page strategy, and weekly performance reporting.

2. FEES
Monthly management fee: $${retainer}. Due on the 1st of each month. First payment due upon signing.
Ad spend is paid directly by Client to Google. Agency does not hold ad budgets.

3. TERM
This agreement begins on the date of signing and continues month-to-month. Either party may terminate with 30 days written notice.

4. PERFORMANCE
Agency targets 15–25 qualified leads per month at the agreed budget. Results depend on market conditions, ad spend, and website conversion rate. Agency is not liable for results outside its direct control.

5. CLIENT RESPONSIBILITIES
Client must: provide Google Ads account access within 48 hours of signing, maintain active payment method with Google, respond to Agency requests within 48 hours, maintain a functional landing page.

6. OWNERSHIP
All Google Ads assets (campaigns, keywords, audiences) belong to the Client. Agency has no claim to any assets created during the engagement.

7. CONFIDENTIALITY
Both parties agree to keep business information confidential.

8. SIGNATURES
By signing below, both parties agree to the terms of this agreement.

Agency: Ali — AMA Leads
Date: ${today}

Client: ___________________
Name: ${prospect.contact_name || ''}
Company: ${prospect.company_name}
Date: ___________________`;
  } else {
    content = await callClaude(SYSTEM_PROMPTS[11], prompt, 'claude-haiku-4-20250514', 1500);
  }

  if (!content) return { error: 'Failed to generate contract' };

  const signingToken = generateToken();

  let contractId = null;
  if (isSupabaseConfigured() && supabase) {
    const { data } = await supabase.from('contracts').insert({
      prospect_id:      prospect.id,
      company_name:     prospect.company_name,
      contact_name:     prospect.contact_name,
      contact_email:    prospect.email,
      niche:            prospect.niche,
      location:         prospect.location,
      monthly_retainer: retainer,
      content,
      signing_token:    signingToken,
      status:           'draft',
    }).select().single();
    contractId = data?.id;

    await logAutomation(
      'contract_generated',
      { prospect_id: prospect.id, company: prospect.company_name },
      `Generated contract for ${prospect.company_name} ($${retainer}/mo)`,
      [11]
    );
  }

  log('Contract ready ✓');
  return { success: true, content, signingToken, contractId, retainer };
}

export async function sendContractEmail(contract, prospect, appUrl = window.location.origin) {
  if (!prospect.email) return { error: 'No email address for prospect' };

  const signingUrl = `${appUrl}?sign=${contract.signingToken}`;
  const firstName  = (prospect.contact_name || 'there').split(' ')[0];

  const emailBody = `Hi ${firstName},

Please review and sign your Google Ads management agreement with AMA Leads.

You can sign it here:
${signingUrl}

Agreement summary:
- Services: Google Ads campaign management for ${prospect.company_name}
- Monthly fee: $${contract.retainer}/month
- Term: Month-to-month (30-day cancellation notice)
- Campaign goes live within 5 business days of signing

If you have any questions before signing, just reply to this email.

Ali
AMA Leads
amaleads.org`;

  const result = await sendEmail({
    to:      prospect.email,
    toName:  prospect.contact_name || prospect.company_name,
    subject: `Action required: Sign your AMA Leads agreement — ${prospect.company_name}`,
    body:    emailBody,
  });

  if (isSupabaseConfigured() && supabase && contract.contractId) {
    await supabase.from('contracts').update({
      status:  'sent',
    }).eq('id', contract.contractId);

    await logAutomation(
      'contract_sent',
      { contract_id: contract.contractId, prospect_id: prospect.id },
      `Sent contract email to ${prospect.email} with signing link`,
      [11]
    );
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRACT SIGNING (public — no auth, uses token)
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchContractByToken(token) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('contracts')
    .select('*')
    .eq('signing_token', token)
    .single();
  return data;
}

export async function signContract(token) {
  if (!supabase) return { error: 'Supabase not connected' };

  const { data: contract, error } = await supabase
    .from('contracts')
    .update({
      status:    'signed',
      signed_at: new Date().toISOString(),
    })
    .eq('signing_token', token)
    .select()
    .single();

  if (error || !contract) return { error: error?.message || 'Contract not found' };

  // Log the signing event
  await logAutomation(
    'contract_signed',
    { contract_id: contract.id, company: contract.company_name },
    `Contract signed by ${contract.contact_name || contract.company_name} — campaign build triggered`,
    [12]
  );

  // Send onboarding email automatically
  try {
    await sendOnboardingEmail(contract);
  } catch (e) {
    console.error('[contractEngine] Onboarding email failed:', e.message);
  }

  return { success: true, contract };
}

// ─── Onboarding email (Agent 12) after signing ───────────────────────────────
export async function sendOnboardingEmail(contract) {
  const firstName   = (contract.contact_name || 'there').split(' ')[0];
  const startDate   = new Date();
  startDate.setDate(startDate.getDate() + 2); // 48h from now for access
  const accessDeadline = startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const campaignDate   = new Date(startDate.getTime() + 3 * 86400000)
    .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const prompt = `Client name: ${firstName}
Company: ${contract.company_name}
Niche: ${contract.niche || 'home services'}
Location: ${contract.location || ''}
Monthly retainer: $${contract.monthly_retainer}
Access deadline: ${accessDeadline}
Campaign start date: ${campaignDate}`;

  let emailBody;
  if (DEMO_MODE || !contract.contact_email) {
    emailBody = `Hi ${firstName},

Welcome aboard — excited to be working with ${contract.company_name}.

Here's exactly what happens next:

1. GOOGLE ADS ACCESS (needed by ${accessDeadline})
   Please add agency@amaleads.org as an admin on your Google Ads account. If you don't have one, I'll set it up for you — just reply and I'll send instructions.

2. CAMPAIGN TIMELINE
   Once access is confirmed: keyword research, ad copy, and campaign structure will be built by ${campaignDate}. You'll get a full walkthrough before anything goes live.

3. YOUR FIRST REPORT
   Weekly reports land every Monday morning. You'll see: impressions, clicks, leads, cost per lead, and what we're testing that week.

4. DIRECT LINE
   Reply to this email anytime. I personally review every campaign weekly.

Looking forward to driving results for ${contract.company_name}.

Ali
AMA Leads
amaleads.org

P.S. Save this email — it has your campaign timeline and the Google Ads access instructions you'll need.`;
  } else {
    const generated = await callClaude(SYSTEM_PROMPTS[12], prompt, 'claude-haiku-4-20250514', 800);
    // Extract body after EMAIL:
    const bodyMatch = generated?.match(/EMAIL:\s*([\s\S]+)/i);
    emailBody = bodyMatch?.[1]?.trim() || generated || '';
  }

  if (contract.contact_email) {
    await sendEmail({
      to:      contract.contact_email,
      toName:  contract.contact_name || contract.company_name,
      subject: `Welcome to AMA Leads — ${contract.company_name} is officially starting`,
      body:    emailBody,
    });
  }

  if (isSupabaseConfigured() && supabase) {
    await logAutomation(
      'onboarding_email_sent',
      { contract_id: contract.id, company: contract.company_name },
      `Sent onboarding email to ${contract.contact_email || '(no email)'}`,
      [12]
    );
  }

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH ALL CONTRACTS (for Contracts page)
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchContracts() {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data } = await supabase
    .from('contracts')
    .select('*')
    .order('created_at', { ascending: false });
  return data || [];
}

export async function fetchProposals() {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data } = await supabase
    .from('proposals')
    .select('*')
    .order('created_at', { ascending: false });
  return data || [];
}

// ─── Mark campaign triggered after contract signed ────────────────────────────
export async function markCampaignTriggered(contractId) {
  if (!supabase) return;
  await supabase.from('contracts').update({ campaign_triggered: true }).eq('id', contractId);
}
