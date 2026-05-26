// Big Bot — Supabase Edge Function (Deno runtime)
// Runs every hour via pg_cron. Analyzes all system data, stores insights,
// processes email queue, and triggers weekly reports on Mondays.
//
// DEPLOY:
//   npm install -g supabase
//   supabase login
//   supabase link --project-ref wtwjuvtvjbdgyefawdcv
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase secrets set RESEND_API_KEY=re_...
//   supabase functions deploy bigbot-hourly --no-verify-jwt
//
// SCHEDULE (run in Supabase SQL Editor):
//   select cron.schedule(
//     'bigbot-hourly',
//     '0 * * * *',
//     $$
//     select net.http_post(
//       url := 'https://wtwjuvtvjbdgyefawdcv.supabase.co/functions/v1/bigbot-hourly',
//       headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_ANON_KEY"}'::jsonb,
//       body := '{}'::jsonb
//     )
//     $$
//   );

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')              || '';
const SUPABASE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')         || '';
const RESEND_API_KEY    = Deno.env.get('RESEND_API_KEY')            || '';

// ─── Type helpers ─────────────────────────────────────────────────────────────
interface Prospect   { id: string; company_name: string; status: string; monthly_value: number; last_contacted_at: string; updated_at: string; niche: string; location: string; }
interface AgentOut   { agent_id: number; agent_name: string; status: string; created_at: string; }
interface EmailRow   { id: string; status: string; subject: string; body: string; to_email: string; prospect_id: string; created_at: string; }
interface Campaign   { status: string; niche: string; location: string; audit_output: string; }
interface Insight    { title: string; }
interface Contract   { id: string; company_name: string; status: string; contact_email: string; contact_name: string; monthly_retainer: number; signing_token: string; signed_at: string; campaign_triggered: boolean; created_at: string; }
interface AIInsight  { type: string; priority: number; title: string; insight: string; action: string; agent_id: number | null; }

Deno.serve(async (_req: Request) => {
  const startTime = Date.now();
  const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY);
  const log: string[] = [];

  // ── Create run log ──────────────────────────────────────────────────────────
  const { data: runRow } = await supabase
    .from('bigbot_runs')
    .insert({ trigger: 'cron', status: 'running' })
    .select().single();
  const runId = runRow?.id;

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString();
    const fiveDaysAgo   = new Date(Date.now() - 5  * 24 * 60 * 60 * 1000).toISOString();

    // ── Gather all data in parallel ──────────────────────────────────────────
    const [prospectsRes, agentOutputsRes, emailQueueRes, campaignsRes, recentInsightsRes, contractsRes] =
      await Promise.all([
        supabase.from('prospects').select('id,company_name,status,monthly_value,last_contacted_at,updated_at,niche,location'),
        supabase.from('agent_outputs').select('agent_id,agent_name,status,created_at').gte('created_at', thirtyDaysAgo),
        supabase.from('email_queue').select('id,status,subject,body,to_email,prospect_id,created_at').order('created_at', { ascending: false }).limit(50),
        supabase.from('campaigns').select('status,niche,location,audit_output').order('created_at', { ascending: false }).limit(10),
        supabase.from('bigbot_insights').select('title').gte('created_at', sevenDaysAgo).eq('dismissed', false),
        supabase.from('contracts').select('id,company_name,status,contact_email,contact_name,monthly_retainer,signing_token,signed_at,campaign_triggered,created_at').order('created_at', { ascending: false }).limit(50),
      ]);

    const prospects    = (prospectsRes.data    || []) as Prospect[];
    const agentOutputs = (agentOutputsRes.data || []) as AgentOut[];
    const emailQueue   = (emailQueueRes.data   || []) as EmailRow[];
    const campaigns    = (campaignsRes.data    || []) as Campaign[];
    const recentTitles = ((recentInsightsRes.data || []) as Insight[]).map(i => i.title).join(' | ');
    const contracts    = (contractsRes.data    || []) as Contract[];

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 1 — Process email queue (send pending emails via Resend)
    // ══════════════════════════════════════════════════════════════════════════

    let emailsSent = 0;
    let emailsFailed = 0;

    if (RESEND_API_KEY) {
      const pending = emailQueue.filter(e => ['pending', 'waiting_for_api'].includes(e.status)).slice(0, 10);
      log.push(`Email queue: ${pending.length} pending`);

      for (const email of pending) {
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
            body: JSON.stringify({
              from: 'Ali — AMA Leads <ali@amaleads.org>',
              to: [email.to_email],
              subject: email.subject,
              text: email.body,
            }),
          });

          const resData = await res.json() as { id?: string; error?: string };

          if (res.ok && resData.id) {
            await supabase.from('email_queue').update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              resend_message_id: resData.id,
            }).eq('id', email.id);

            await supabase.from('email_tracking').insert({
              email_queue_id: email.id,
              prospect_id: email.prospect_id,
              event: 'sent',
              subject: email.subject,
              to_email: email.to_email,
              metadata: { resend_id: resData.id },
            });

            emailsSent++;
          } else {
            await supabase.from('email_queue').update({ status: 'failed' }).eq('id', email.id);
            await supabase.from('email_tracking').insert({
              email_queue_id: email.id,
              prospect_id: email.prospect_id,
              event: 'failed',
              subject: email.subject,
              to_email: email.to_email,
              metadata: { error: resData.error || 'Resend API error' },
            });
            emailsFailed++;
          }
        } catch (_e) {
          await supabase.from('email_queue').update({ status: 'failed' }).eq('id', email.id);
          emailsFailed++;
        }
      }

      if (emailsSent > 0 || emailsFailed > 0) {
        await supabase.from('automation_log').insert({
          trigger_type: 'email_queue_processed',
          trigger_data: { sent: emailsSent, failed: emailsFailed },
          action_taken: `Sent ${emailsSent} emails${emailsFailed > 0 ? `, ${emailsFailed} failed` : ''}`,
          status: emailsFailed > 0 ? 'partial' : 'success',
        });
        log.push(`Emails sent: ${emailsSent}, failed: ${emailsFailed}`);
      }
    } else {
      log.push('Email queue: RESEND_API_KEY not set — skipping');
    }

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 2 — Trigger campaign build for newly signed contracts
    // ══════════════════════════════════════════════════════════════════════════

    const signedUntriggered = contracts.filter(c => c.status === 'signed' && !c.campaign_triggered);
    if (signedUntriggered.length > 0) {
      log.push(`Found ${signedUntriggered.length} signed contracts needing campaign build`);
      await supabase.from('bigbot_insights').insert(
        signedUntriggered.map(c => ({
          type: 'pipeline',
          priority: 1,
          title: `Build campaign for ${c.company_name}`,
          insight: `${c.company_name} signed their contract but no Google Ads campaign has been built yet. Monthly retainer: $${c.monthly_retainer}. Open the Contracts page to trigger the campaign builder.`,
          action: 'Go to Contracts → click "Build Campaign"',
          agent_id: 6,
        }))
      );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 3 — Flag stale proposals (sent 5+ days, not yet signed)
    // ══════════════════════════════════════════════════════════════════════════

    const staleContracts = contracts.filter(c =>
      c.status === 'sent' && !c.signed_at && c.created_at < fiveDaysAgo
    );
    if (staleContracts.length > 0) {
      log.push(`Stale proposals: ${staleContracts.length}`);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 4 — Monday: trigger weekly report generation for all clients
    // ══════════════════════════════════════════════════════════════════════════

    const isMonday = new Date().getDay() === 1;
    if (isMonday && ANTHROPIC_API_KEY) {
      const signedContracts = contracts.filter(c => c.status === 'signed');
      log.push(`Monday: checking weekly reports for ${signedContracts.length} clients`);

      const sevenDaysAgoDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      for (const contract of signedContracts.slice(0, 5)) { // Max 5 per run to stay within timeout
        // Check if we already sent a report this week
        const { data: recentReport } = await supabase
          .from('client_reports')
          .select('id')
          .eq('prospect_id', contract.id)
          .gte('created_at', sevenDaysAgoDate)
          .limit(1)
          .single();

        if (recentReport) continue; // Already sent this week

        try {
          // Generate weekly report via Claude Haiku
          const reportRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({
              model: 'claude-haiku-4-20250514',
              max_tokens: 1500,
              system: `You are a Google Ads account manager writing a weekly performance report for a client.
Write a professional, concise weekly report. Format with clear sections: Overview, Key Metrics, Wins, Optimizations Made, Next Week's Focus.
Keep it under 500 words. Be specific and data-driven.`,
              messages: [{
                role: 'user',
                content: `Generate a weekly report for ${contract.company_name}.
Service: Google Ads Management. Monthly retainer: $${contract.monthly_retainer}.
Week: ${new Date().toDateString()}.
Note: Live Google Ads data sync not yet configured — write a professional report explaining that the campaign is being actively managed and that detailed metrics will be shared once the reporting dashboard is connected.`,
              }],
            }),
          });

          const reportData = await reportRes.json() as { content?: Array<{ text: string }> };
          const reportContent = reportData.content?.[0]?.text || '';

          if (reportContent) {
            // Store report
            await supabase.from('client_reports').insert({
              prospect_id: contract.id,
              company_name: contract.company_name,
              report_type: 'weekly',
              content: reportContent,
              status: 'draft',
              week_start: new Date().toISOString().slice(0, 10),
            });

            // Queue email to client
            if (contract.contact_email) {
              await supabase.from('email_queue').insert({
                prospect_id: contract.id,
                to_email: contract.contact_email,
                subject: `Weekly Google Ads Report — ${contract.company_name} — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
                body: `Hi ${(contract.contact_name || 'there').split(' ')[0]},\n\nHere's your weekly Google Ads performance update:\n\n${reportContent}\n\nBest,\nAli\nAMA Leads\nali@amaleads.org`,
                status: 'pending',
              });
            }

            log.push(`Weekly report generated for ${contract.company_name}`);

            await supabase.from('automation_log').insert({
              trigger_type: 'weekly_report_generated',
              trigger_data: { company: contract.company_name, contract_id: contract.id },
              action_taken: `Weekly report generated and queued for ${contract.company_name}`,
              status: 'success',
            });
          }
        } catch (_e) {
          log.push(`Weekly report failed for ${contract.company_name}`);
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // STEP 5 — Build BigBot insights via Claude
    // ══════════════════════════════════════════════════════════════════════════

    const agentErrors: Record<string, number> = {};
    agentOutputs.filter(o => o.status === 'error').forEach(e => {
      agentErrors[e.agent_name] = (agentErrors[e.agent_name] || 0) + 1;
    });

    const staleProspects = prospects.filter(p => {
      if (['new', 'client', 'dead'].includes(p.status)) return false;
      const last = p.last_contacted_at || p.updated_at;
      return (Date.now() - new Date(last).getTime()) / 86400000 > 7;
    });

    const pipelineCounts: Record<string, number> = {};
    ['new', 'contacted', 'replied', 'call_booked', 'proposal', 'client', 'dead']
      .forEach(s => { pipelineCounts[s] = prospects.filter(p => p.status === s).length; });

    const clients = prospects.filter(p => p.status === 'client');
    const mrr = clients.reduce((sum, p) => sum + (Number(p.monthly_value) || 0), 0);

    // MRR from signed contracts
    const contractMRR = contracts
      .filter(c => c.status === 'signed')
      .reduce((sum, c) => sum + (Number(c.monthly_retainer) || 0), 0);

    const emailSamples = emailQueue.filter(e => e.body).slice(0, 4)
      .map(e => `Subject: ${e.subject}\nPreview: ${e.body.slice(0, 150)}`).join('\n---\n');

    const emailStats = {
      sent:    emailQueue.filter(e => e.status === 'sent').length,
      failed:  emailQueue.filter(e => e.status === 'failed').length,
      pending: emailQueue.filter(e => ['pending', 'waiting_for_api'].includes(e.status)).length,
    };

    const context = `BIG BOT CRON ANALYSIS — ${new Date().toISOString()}

PIPELINE: ${JSON.stringify(pipelineCounts)}
Clients: ${clients.length}  MRR (prospects): $${mrr.toLocaleString()}  MRR (contracts): $${contractMRR.toLocaleString()}
Stale prospects (7+ days no contact): ${staleProspects.length}
${staleProspects.slice(0, 6).map(p => `• ${p.company_name} — ${p.status} — ${p.last_contacted_at ? Math.round((Date.now() - new Date(p.last_contacted_at).getTime()) / 86400000) + 'd ago' : 'never contacted'}`).join('\n')}

CONTRACTS: total=${contracts.length} signed=${contracts.filter(c => c.status === 'signed').length} sent=${contracts.filter(c => c.status === 'sent').length}
Stale proposals (5+ days unsigned): ${staleContracts.length}
${staleContracts.slice(0, 3).map(c => `• ${c.company_name} — sent ${Math.round((Date.now() - new Date(c.created_at).getTime()) / 86400000)}d ago — $${c.monthly_retainer}/mo`).join('\n')}

AGENT ERRORS (30d): ${JSON.stringify(agentErrors)}
Total agent runs: ${agentOutputs.length}

EMAIL (last 50): sent=${emailStats.sent} failed=${emailStats.failed} pending=${emailStats.pending}
Just processed this run: sent=${emailsSent} failed=${emailsFailed}
${emailSamples}

CAMPAIGNS: ${campaigns.length} total
${campaigns.filter(c => c.audit_output).slice(0, 2).map(c => `[${c.niche}/${c.location}]: ${c.audit_output.slice(0, 300)}`).join('\n---\n')}

THIS RUN LOG: ${log.join(' | ')}
RECENT INSIGHT TITLES (don't repeat): ${recentTitles || 'None'}`;

    if (!ANTHROPIC_API_KEY) {
      await supabase.from('bigbot_runs').update({ status: 'error', duration_ms: Date.now() - startTime }).eq('id', runId);
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), { status: 500 });
    }

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-20250514',
        max_tokens: 2000,
        system: `You are the Big Bot — a 24/7 supervisor for AMA Leads agency. Analyze the provided data and return ONLY a valid JSON array of 4-7 insights.

Each insight object: { "type": "error"|"pitch"|"pipeline"|"health"|"campaign"|"optimization"|"billing", "priority": 1|2|3, "title": "max 60 chars", "insight": "2-4 sentences with specific numbers", "action": "exact next step", "agent_id": number|null }

Priority 1=urgent/revenue-blocking. Priority 2=this week. Priority 3=nice-to-have.
Always cite specific numbers. Don't repeat recent insights. Return ONLY the JSON array.`,
        messages: [{ role: 'user', content: context }],
      }),
    });

    const aiData = await aiRes.json() as { content?: Array<{ text: string }> };
    const raw = aiData.content?.[0]?.text?.trim() || '[]';
    const match = raw.match(/\[[\s\S]*\]/);
    const insights = match ? JSON.parse(match[0]) as AIInsight[] : [];

    if (insights.length > 0) {
      await supabase.from('bigbot_insights').insert(
        insights.map(i => ({
          type:     i.type     || 'health',
          priority: i.priority || 2,
          title:    (i.title   || 'Insight').slice(0, 120),
          insight:  i.insight  || '',
          action:   i.action   || null,
          agent_id: i.agent_id || null,
        }))
      );
    }

    // ── Finalize run ─────────────────────────────────────────────────────────
    await supabase.from('bigbot_runs').update({
      status: 'complete',
      duration_ms: Date.now() - startTime,
      insights_generated: insights.length,
    }).eq('id', runId);

    return new Response(JSON.stringify({
      ok: true,
      insights: insights.length,
      emails_sent: emailsSent,
      emails_failed: emailsFailed,
      log,
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    if (runId) await supabase.from('bigbot_runs').update({ status: 'error', duration_ms: Date.now() - startTime }).eq('id', runId);
    return new Response(JSON.stringify({ error }), { status: 500 });
  }
});
