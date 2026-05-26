// Big Bot Engine — 24/7 autonomous supervisor
// Analyzes all system data, generates actionable insights, proposes agent improvements
// Runs in-browser (BigBot.jsx) and via Supabase Edge Function (bigbot-hourly)

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SYSTEM_PROMPTS } from './systemPrompts';
import { runWeeklyReportsForAllClients, syncAllCampaignPerformance } from './reportEngine';

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

const DEMO_MODE = !API_KEY || API_KEY === 'your_anthropic_key_here' || API_KEY.trim() === '';

// ─── Main analysis run ──────────────────────────────────────────────────────────
export async function runBigBot({ trigger = 'manual', onProgress } = {}) {
  const log = (msg) => onProgress?.(msg);
  const startTime = Date.now();

  if (!isSupabaseConfigured() || !supabase) {
    return { error: 'Supabase not configured — add credentials to .env' };
  }

  // Create run log entry
  const { data: runRow } = await supabase
    .from('bigbot_runs')
    .insert({ trigger, status: 'running' })
    .select().single();
  const runId = runRow?.id;

  try {
    log('Pulling data from all systems…');

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [prospectsRes, agentOutputsRes, emailQueueRes, campaignsRes, recentInsightsRes, sequencesRes, contractsRes] =
      await Promise.all([
        supabase.from('prospects').select('*').order('updated_at', { ascending: false }),
        supabase.from('agent_outputs').select('*').gte('created_at', thirtyDaysAgo).order('created_at', { ascending: false }),
        supabase.from('email_queue').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('campaigns').select('id,status,niche,location,audit_output,created_at').order('created_at', { ascending: false }).limit(20),
        supabase.from('bigbot_insights').select('insight,title').gte('created_at', sevenDaysAgo).eq('dismissed', false),
        supabase.from('email_sequences').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('contracts').select('id,status,company_name,monthly_retainer,campaign_triggered,signed_at').order('created_at', { ascending: false }).limit(20),
      ]);

    const prospects      = prospectsRes.data || [];
    const agentOutputs   = agentOutputsRes.data || [];
    const emailQueue     = emailQueueRes.data || [];
    const campaigns      = campaignsRes.data || [];
    const recentInsights = recentInsightsRes.data || [];
    const sequences      = sequencesRes.data || [];
    const contracts      = contractsRes.data || [];

    // ── Derived stats ────────────────────────────────────────────────────────────
    const agentErrors = agentOutputs.filter(o => o.status === 'error');
    const errorsByAgent = {};
    agentErrors.forEach(e => { errorsByAgent[e.agent_name] = (errorsByAgent[e.agent_name] || 0) + 1; });

    const staleProspects = prospects.filter(p => {
      if (['new', 'client', 'dead'].includes(p.status)) return false;
      const last = p.last_contacted_at || p.updated_at;
      return (Date.now() - new Date(last)) / 86400000 > 7;
    });

    const pipelineCounts = {};
    ['new','contacted','replied','call_booked','proposal','client','dead']
      .forEach(s => { pipelineCounts[s] = prospects.filter(p => p.status === s).length; });

    const clients = prospects.filter(p => p.status === 'client');
    const mrr = clients.reduce((sum, p) => sum + (Number(p.monthly_value) || 0), 0);

    const emailSent    = emailQueue.filter(e => e.status === 'sent').length;
    const emailFailed  = emailQueue.filter(e => e.status === 'failed').length;
    const emailPending = emailQueue.filter(e => e.status === 'pending' || e.status === 'waiting_for_api').length;

    const emailSamples = emailQueue
      .filter(e => e.body)
      .slice(0, 5)
      .map(e => `Subject: ${e.subject}\nPreview: ${(e.body || '').slice(0, 150)}`)
      .join('\n---\n');

    const auditSamples = campaigns
      .filter(c => c.audit_output)
      .slice(0, 3)
      .map(c => `[${c.niche} / ${c.location}]: ${c.audit_output.slice(0, 400)}`)
      .join('\n---\n');

    const knownTitles = recentInsights.map(i => i.title).join(' | ');

    const signedContracts   = contracts.filter(c => c.status === 'signed');
    const pendingContracts  = contracts.filter(c => c.status === 'sent');
    const contractMrr       = signedContracts.reduce((s, c) => s + (Number(c.monthly_retainer) || 0), 0);
    const untriggered       = signedContracts.filter(c => !c.campaign_triggered);

    const dataContext = `BIG BOT ANALYSIS — ${new Date().toISOString()}

═══ PIPELINE ═══
Stage counts: ${JSON.stringify(pipelineCounts)}
Total prospects: ${prospects.length}
Active clients: ${clients.length}  |  MRR: $${mrr.toLocaleString()}
Stale (7+ days no contact, not new/client): ${staleProspects.length}
${staleProspects.slice(0, 8).map(p => `  • ${p.company_name} — ${p.status} — last contact ${p.last_contacted_at ? Math.round((Date.now()-new Date(p.last_contacted_at))/86400000)+'d ago' : 'never'}`).join('\n')}

═══ CONTRACTS ═══
Total: ${contracts.length}  |  Signed: ${signedContracts.length}  |  Awaiting signature: ${pendingContracts.length}
Contract MRR: $${contractMrr.toLocaleString()}
Signed with no campaign triggered: ${untriggered.length}
${untriggered.map(c => `  • ${c.company_name} — signed ${c.signed_at ? Math.round((Date.now()-new Date(c.signed_at))/86400000)+'d ago' : 'recently'}`).join('\n')}

═══ AGENT PERFORMANCE (30 days) ═══
Total runs: ${agentOutputs.length}  |  Errors: ${agentErrors.length}
Error breakdown by agent: ${JSON.stringify(errorsByAgent)}
Most recent errors: ${agentErrors.slice(0,5).map(e=>`${e.agent_name} (${new Date(e.created_at).toLocaleDateString()})`).join(', ') || 'None'}

═══ EMAIL QUEUE ═══
Sent: ${emailSent}  |  Failed: ${emailFailed}  |  Pending: ${emailPending}
Sequence emails tracked: ${sequences.length}
${emailSamples ? `\nRecent email samples:\n${emailSamples}` : '(no emails yet)'}

═══ CAMPAIGNS ═══
Total: ${campaigns.length}  |  Building: ${campaigns.filter(c=>c.status==='building').length}  |  Ready: ${campaigns.filter(c=>c.status==='ready').length}
${auditSamples ? `\nAudit excerpts:\n${auditSamples}` : '(no campaigns yet)'}

═══ RECENTLY SURFACED (skip these — already actioned) ═══
${knownTitles || 'None'}`;

    // Run automation triggers (signed contracts → campaign build, etc.)
    log('Checking automation triggers…');
    await runAutomationTriggers(log);

    log('Running Big Bot analysis…');

    if (DEMO_MODE) {
      const insights = buildDemoInsights(staleProspects, agentErrors, emailPending);
      await _storeInsights(insights, runId, startTime);
      log(`Generated ${insights.length} insights (demo mode)`);
      return { insights, runId, demo: true };
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: `You are the Big Bot — a 24/7 autonomous business supervisor for AMA Leads, a Google Ads lead gen agency. You analyze all business data and output specific, data-driven insights that help the operator take immediate action.

Output ONLY a valid JSON array. Each object:
{
  "type": "error"|"pitch"|"pipeline"|"health"|"campaign"|"optimization",
  "priority": 1|2|3,
  "title": "max 60 chars",
  "insight": "2-4 sentences, always cite specific numbers from the data",
  "action": "exact next step in 1-2 sentences",
  "agent_id": number or null
}

Priority 1 = revenue-blocking or urgent. Priority 2 = important this week. Priority 3 = improvement.

Rules:
- Cite specific numbers always (never say "some prospects" — say "3 prospects")
- Don't repeat insights from the recent list provided
- For email pitches: be blunt about weaknesses, suggest a specific rewrite angle
- For agent errors: name the exact agent and exact fix
- For pipeline: call out the specific bottleneck stage and prospect names
- For campaigns: read the audit output and find the weakest link
- Suggest agent prompt improvements only when there's a clear pattern of failure
- Generate 5-9 insights
- Return ONLY the JSON array`,
        messages: [{ role: 'user', content: dataContext }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `API ${res.status}`);
    }

    const data = await res.json();
    const raw  = data.content?.[0]?.text?.trim() || '[]';
    const match = raw.match(/\[[\s\S]*\]/);
    const insights = match ? JSON.parse(match[0]) : [];

    log(`Generated ${insights.length} insights`);
    await _storeInsights(insights, runId, startTime);
    return { insights, runId };

  } catch (err) {
    if (runId && supabase) {
      await supabase.from('bigbot_runs')
        .update({ status: 'error', duration_ms: Date.now() - startTime })
        .eq('id', runId);
    }
    return { error: err.message };
  }
}

// ─── Store insights to Supabase ─────────────────────────────────────────────────
async function _storeInsights(insights, runId, startTime) {
  if (!supabase || !insights.length) return;
  await supabase.from('bigbot_insights').insert(
    insights.map(i => ({
      type:     i.type    || 'health',
      priority: i.priority || 2,
      title:    (i.title   || 'Insight').slice(0, 120),
      insight:  i.insight  || '',
      action:   i.action   || null,
      agent_id: i.agent_id || null,
    }))
  );
  if (runId) {
    await supabase.from('bigbot_runs')
      .update({ status: 'complete', duration_ms: Date.now() - startTime, insights_generated: insights.length })
      .eq('id', runId);
  }
}

// ─── Fetch current insights + last run ─────────────────────────────────────────
export async function getBigBotStatus() {
  if (!isSupabaseConfigured() || !supabase) return null;
  const [runRes, insightRes] = await Promise.all([
    supabase.from('bigbot_runs').select('*').order('created_at', { ascending: false }).limit(1).single(),
    supabase.from('bigbot_insights').select('*').eq('dismissed', false)
      .order('priority').order('created_at', { ascending: false }).limit(60),
  ]);
  return {
    lastRun:  runRes.data  || null,
    insights: insightRes.data || [],
  };
}

export async function dismissInsight(id) {
  if (!supabase) return;
  await supabase.from('bigbot_insights').update({ dismissed: true }).eq('id', id);
}

export async function markApplied(id) {
  if (!supabase) return;
  await supabase.from('bigbot_insights').update({ applied: true, dismissed: true }).eq('id', id);
}

// ─── Write follow-up email using Agent 8 ────────────────────────────────────────
export async function writeFollowUp(prospect, sequenceNumber, previousEmail = '') {
  const prompt = `Prospect: ${prospect.company_name} | ${prospect.niche} | ${prospect.location}
Contact: ${prospect.contact_name || 'the owner'}
Sequence number: ${sequenceNumber}
${previousEmail ? `\nOriginal email sent:\n${previousEmail}` : ''}

Write sequence email #${sequenceNumber} for this prospect.`;

  if (DEMO_MODE) {
    await new Promise(r => setTimeout(r, 1800));
    return sequenceNumber === 2
      ? `SUBJECT: Re: Google Ads for ${prospect.company_name}\nEMAIL:\nHi — wanted to circle back. Since I last reached out, we've helped a ${prospect.niche} in the area close 22 new jobs in 30 days from Google Ads alone. Worth a 10-minute call to see if the numbers work for you?\n\nAli\nAMA Leads`
      : `SUBJECT: Last note from me\nEMAIL:\nI'll stop following up after this. If you ever want to test Google Ads for ${prospect.company_name} with zero upfront risk, my offer stands — we cover the trial spend, you keep every lead.\n\nAli\nAMA Leads`;
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: 'claude-haiku-4-20250514', max_tokens: 600, system: SYSTEM_PROMPTS[8], messages: [{ role: 'user', content: prompt }] }),
  });
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || '';
}

// ─── Batch personalize all prospects using Agent 9 ──────────────────────────────
export async function batchPersonalize(prospectList, niche, location) {
  const listText = prospectList.map((p, i) => `${i+1}. ${p.company_name}${p.website ? ` (${p.website})` : ''}${p.notes ? ` — ${p.notes.slice(0,100)}` : ''}`).join('\n');
  const prompt = `Niche: ${niche} | Location: ${location}\n\nProspect list:\n${listText}\n\nWrite a personalized cold email for each business above.`;

  if (DEMO_MODE) {
    await new Promise(r => setTimeout(r, 3000));
    return prospectList.map(p =>
      `COMPANY: ${p.company_name}\nSUBJECT: Quick question about ${p.company_name}'s Google presence\nEMAIL:\nNoticed ${p.company_name} has solid reviews but no paid ads running — that's leaving calls on the table your competitors are picking up.\n\nWe run Google Ads specifically for ${niche} and offer a free trial where we cover the ad spend — you keep every lead with no retainer to start.\n\nMost clients in your niche see 15-30 qualified calls within the first 30 days.\n\nWorth a 10-minute call to see if it makes sense?\n\nAli, AMA Leads\n---`
    ).join('\n\n');
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 4000, system: SYSTEM_PROMPTS[9], messages: [{ role: 'user', content: prompt }] }),
  });
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || '';
}

// ─── Queue a follow-up email to the email_queue + email_sequences tables ────────
export async function queueFollowUp(prospect, subject, body, sequenceNumber) {
  if (!supabase) return { error: 'Supabase not configured' };
  await supabase.from('email_sequences').insert({
    prospect_id: prospect.id,
    sequence_number: sequenceNumber,
    subject,
    body,
    status: 'queued',
    scheduled_at: new Date().toISOString(),
    niche: prospect.niche,
    location: prospect.location,
  });
  const { error } = await supabase.from('email_queue').insert({
    prospect_id: prospect.id,
    to_email: prospect.email || null,
    to_name: prospect.contact_name || prospect.company_name,
    subject,
    body,
    status: prospect.email ? 'pending' : 'waiting_for_api',
  });
  return error ? { error: error.message } : { success: true };
}

// ─── Parse Agent 3 output → extract best email variant ─────────────────────────
export function parseAgent3Email(agent3Output) {
  if (!agent3Output) return null;
  // Try to extract VARIANT A (pain-led) subject + body
  const subjectMatch = agent3Output.match(/subject(?:\s+line(?:s)?)?[:\s]*1[:\s]*(.*)/im)
    || agent3Output.match(/subject[:\s]*(.*)/im);
  const bodyStart = agent3Output.search(/VARIANT A/i) > -1
    ? agent3Output.search(/VARIANT A/i)
    : 0;
  const bodySection = agent3Output.slice(bodyStart, bodyStart + 1500);
  const emailBodyMatch = bodySection.match(/EMAIL[:\s]*([\s\S]{30,600})(?:DM:|FOLLOW-UP|VARIANT B|$)/i);

  return {
    subject: subjectMatch?.[1]?.trim().replace(/["`]/g, '') || 'Quick question about your Google Ads',
    body: emailBodyMatch?.[1]?.trim() || agent3Output.slice(0, 500),
  };
}

// ─── Email queue processor — sends pending emails via Resend ───────────────────
export async function processEmailQueue(onProgress) {
  const log = msg => onProgress?.(msg);
  if (!isSupabaseConfigured() || !supabase) return;

  const RESEND_KEY = import.meta.env.VITE_RESEND_API_KEY;
  if (!RESEND_KEY || RESEND_KEY === 'your_resend_key_here') {
    log('Email queue: Resend not connected — emails stay queued');
    return { skipped: true };
  }

  // Pull pending emails (limit 20 per run to avoid rate limits)
  const { data: pending } = await supabase
    .from('email_queue')
    .select('*')
    .in('status', ['pending', 'waiting_for_api'])
    .not('to_email', 'is', null)
    .order('created_at', { ascending: true })
    .limit(20);

  if (!pending?.length) { log('Email queue: nothing to send'); return { sent: 0 }; }

  log(`Processing ${pending.length} queued emails…`);
  let sent = 0, failed = 0;

  for (const email of pending) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_KEY}` },
        body: JSON.stringify({
          from: 'Ali — AMA Leads <ali@amaleads.org>',
          to:   [`${email.to_name || ''} <${email.to_email}>`],
          subject: email.subject,
          text:  email.body,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        await supabase.from('email_queue').update({
          status:   'sent',
          sent_at:  new Date().toISOString(),
          resend_message_id: data.id || null,
        }).eq('id', email.id);

        // Log to email_tracking
        await supabase.from('email_tracking').insert({
          email_queue_id: email.id,
          prospect_id:    email.prospect_id,
          event:          'sent',
          subject:        email.subject,
          to_email:       email.to_email,
          metadata:       { resend_id: data.id },
        });
        sent++;
      } else {
        await supabase.from('email_queue').update({ status: 'failed' }).eq('id', email.id);
        await supabase.from('email_tracking').insert({
          email_queue_id: email.id,
          prospect_id:    email.prospect_id,
          event:          'failed',
          subject:        email.subject,
          to_email:       email.to_email,
          metadata:       { error: data.message },
        });
        failed++;
      }
    } catch (e) {
      await supabase.from('email_queue').update({ status: 'failed' }).eq('id', email.id);
      failed++;
    }
  }

  log(`Email queue: ${sent} sent, ${failed} failed`);

  // Log to automation_log
  await supabase.from('automation_log').insert({
    trigger_type: 'email_queue_processed',
    trigger_data: { pending: pending.length },
    action_taken: `Sent ${sent} emails, ${failed} failed`,
    status: failed === 0 ? 'success' : 'error',
  });

  return { sent, failed };
}

// ─── Automation trigger engine — called during Big Bot runs ────────────────────
// Checks for signed contracts, processes emails, runs weekly reports, syncs performance
export async function runAutomationTriggers(onProgress) {
  const log = msg => onProgress?.(msg);
  if (!isSupabaseConfigured() || !supabase) return;

  // 1. Process email queue
  await processEmailQueue(log);

  // 2. Find signed contracts that haven't triggered a campaign yet
  const { data: pendingContracts } = await supabase
    .from('contracts')
    .select('*')
    .eq('status', 'signed')
    .eq('campaign_triggered', false)
    .limit(10);

  if (pendingContracts?.length > 0) {
    log(`Found ${pendingContracts.length} signed contract(s) with no campaign yet`);
    for (const contract of pendingContracts) {
      log(`Triggering campaign build for ${contract.company_name}…`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('buildCampaign', {
          detail: {
            id:            contract.prospect_id,
            company_name:  contract.company_name,
            contact_name:  contract.contact_name,
            niche:         contract.niche,
            location:      contract.location,
            monthly_value: contract.monthly_retainer,
            email:         contract.contact_email,
          },
        }));
      }
    }
  }

  // 3. Check for prospects stuck at 'proposal' stage for 5+ days
  const { data: stuckProposals } = await supabase
    .from('prospects')
    .select('*')
    .eq('status', 'proposal')
    .lt('updated_at', new Date(Date.now() - 5 * 86400000).toISOString())
    .limit(5);

  if (stuckProposals?.length > 0) {
    log(`${stuckProposals.length} proposal(s) stuck for 5+ days — flagged`);
  }

  // 4. Run weekly reports if it's Monday (or if last run was >6 days ago)
  const isMonday = new Date().getDay() === 1;
  if (isMonday) {
    log('It\'s Monday — running weekly reports for all clients…');
    try {
      await runWeeklyReportsForAllClients(log);
    } catch (e) {
      log(`Weekly reports error: ${e.message}`);
    }
  }

  // 5. Sync campaign performance (runs every Big Bot cycle)
  try {
    await syncAllCampaignPerformance(log);
  } catch (e) {
    log(`Performance sync error: ${e.message}`);
  }
}

// ─── Demo insights when no API key ─────────────────────────────────────────────
function buildDemoInsights(staleProspects, agentErrors, emailPending) {
  return [
    {
      type: 'health', priority: 1,
      title: 'API key needed to go fully live',
      insight: 'Big Bot, all 7 agents, Master Agent chat, and auto-email sending are running in demo mode. No real prospecting, campaign builds, or outreach is happening.',
      action: 'Add VITE_ANTHROPIC_API_KEY=sk-ant-... to your .env file and restart the dev server.',
      agent_id: null,
    },
    {
      type: 'pipeline', priority: staleProspects.length > 0 ? 1 : 3,
      title: `${staleProspects.length} prospects need follow-up`,
      insight: `${staleProspects.length} prospects have been in active stages for 7+ days with no contact logged. Pipeline velocity drops sharply after the first week of silence.`,
      action: 'Use the "Write Follow-up" button in Pipeline to generate and queue sequence emails 2 and 3 for each stale prospect.',
      agent_id: 8,
    },
    {
      type: 'pitch', priority: 2,
      title: 'Test urgency framing in subject lines',
      insight: 'Current outreach emails from Agent 3 use discovery-based subject lines. A/B testing urgency and specificity ("Roofing calls from Google — 30-day trial") could meaningfully improve open rates.',
      action: 'Run Agent 3 with a modified instruction: "Write variant D using a time-limited free trial offer in the subject line." Compare reply rates.',
      agent_id: 3,
    },
    {
      type: 'optimization', priority: 2,
      title: 'Batch personalize all Agent 1 prospects',
      insight: 'Agent 3 currently writes outreach for only the top 1-2 qualified prospects. The remaining 4-6 from Agent 1\'s list get no outreach. This wastes the research done by agents 1 and 2.',
      action: 'Use "Batch Personalize" in Agent Network to generate personalized emails for all prospects in one pass.',
      agent_id: 9,
    },
    {
      type: 'health', priority: 3,
      title: 'Connect Resend to activate email sending',
      insight: `${emailPending} emails are in the queue with status "waiting_for_api". They are written and ready but cannot send without a Resend API key.`,
      action: 'Go to Integrations → Resend → follow setup instructions. Add VITE_RESEND_API_KEY to .env. All pending emails activate automatically.',
      agent_id: null,
    },
  ];
}
