// Report Engine — weekly reports, optimization briefs, performance tracking
// Agents used: 13 (Weekly Report Writer), 14 (Campaign Optimizer),
//              15 (Retention Agent), 16 (Upsell Agent)
// Tables: client_reports, campaign_performance

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SYSTEM_PROMPTS } from './systemPrompts';
import { fetchCampaignPerformance } from './googleAdsApi';

const API_KEY    = import.meta.env.VITE_ANTHROPIC_API_KEY;
const RESEND_KEY = import.meta.env.VITE_RESEND_API_KEY;
const DEMO_MODE  = !API_KEY || API_KEY === 'your_anthropic_key_here' || API_KEY.trim() === '';

// ─── Shared helpers ───────────────────────────────────────────────────────────
async function callClaude(systemPrompt, userContent, model = 'claude-haiku-4-20250514', maxTokens = 1500) {
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

async function sendEmail({ to, toName, subject, body }) {
  if (!RESEND_KEY || RESEND_KEY === 'your_resend_key_here') return { queued: true };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_KEY}` },
    body: JSON.stringify({
      from: 'Ali — AMA Leads <ali@amaleads.org>',
      to:   [`${toName} <${to}>`],
      subject,
      text:  body,
    }),
  });
  const data = await res.json();
  return res.ok ? { id: data.id } : { error: data.message };
}

// ─── Format micros → dollars ──────────────────────────────────────────────────
const micro2dollar = v => (Number(v) / 1_000_000).toFixed(2);

// ─── Date helpers ─────────────────────────────────────────────────────────────
function weekRange() {
  const end   = new Date();
  const start = new Date(end.getTime() - 6 * 86400000);
  const fmt   = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), label: `${fmt(start)} – ${fmt(end)}` };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE DATA
// ═══════════════════════════════════════════════════════════════════════════════

export async function syncCampaignPerformance(prospect, campaign) {
  if (!campaign?.google_ads_campaign_id) return null;

  const metrics = await fetchCampaignPerformance(campaign.google_ads_campaign_id);
  if (!metrics) return null;

  const week = weekRange();

  if (isSupabaseConfigured() && supabase) {
    const { data } = await supabase.from('campaign_performance').insert({
      prospect_id:          prospect.id,
      campaign_id:          campaign.id,
      google_ads_campaign_id: campaign.google_ads_campaign_id,
      week_start:           week.start,
      impressions:          metrics.impressions,
      clicks:               metrics.clicks,
      conversions:          metrics.conversions,
      cost_micros:          metrics.costMicros,
      avg_cpc_micros:       metrics.avgCpcMicros,
      ctr:                  metrics.ctr,
      conversion_rate:      metrics.conversionRate,
    }).select().single();
    return data;
  }
  return metrics;
}

export async function fetchPerformanceHistory(prospectId, weeks = 4) {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data } = await supabase
    .from('campaign_performance')
    .select('*')
    .eq('prospect_id', prospectId)
    .order('week_start', { ascending: false })
    .limit(weeks);
  return data || [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEEKLY REPORT (Agent 13)
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateWeeklyReport(prospect, campaign, onProgress) {
  const log = msg => onProgress?.(msg);
  const week = weekRange();

  log('Pulling campaign performance data…');
  let metrics = null;
  if (campaign?.google_ads_campaign_id) {
    metrics = await fetchCampaignPerformance(campaign.google_ads_campaign_id);
  }

  // Also get last week's data for comparison
  const history = await fetchPerformanceHistory(prospect.id, 2);
  const lastWeek = history[1] || null;

  const cost    = metrics ? micro2dollar(metrics.costMicros) : '0.00';
  const avgCpc  = metrics ? micro2dollar(metrics.avgCpcMicros) : '0.00';
  const cpl     = metrics?.conversions > 0 ? (Number(cost) / metrics.conversions).toFixed(2) : 'N/A';
  const ctr     = metrics ? (metrics.ctr * 100).toFixed(2) : '0.00';

  const prevCost = lastWeek ? micro2dollar(lastWeek.cost_micros) : null;
  const prevConv = lastWeek?.conversions ?? null;

  const prompt = `Client: ${prospect.contact_name || prospect.company_name}
Company: ${prospect.company_name}
Niche: ${prospect.niche}
Week: ${week.label}

THIS WEEK'S METRICS:
- Impressions: ${metrics?.impressions ?? 0}
- Clicks: ${metrics?.clicks ?? 0}
- Leads (conversions): ${metrics?.conversions ?? 0}
- Cost: $${cost}
- CPL: $${cpl}
- CTR: ${ctr}%
- Avg CPC: $${avgCpc}

${lastWeek ? `PRIOR WEEK COMPARISON:
- Impressions: ${lastWeek.impressions} (${getChange(metrics?.impressions, lastWeek.impressions)})
- Clicks: ${lastWeek.clicks} (${getChange(metrics?.clicks, lastWeek.clicks)})
- Leads: ${prevConv} (${getChange(metrics?.conversions, prevConv)})
- Cost: $${prevCost} (${getChange(Number(cost), Number(prevCost))})` : 'No prior week data available yet.'}`;

  log('Agent 13 writing weekly report…');

  let reportContent;
  if (DEMO_MODE) {
    await new Promise(r => setTimeout(r, 2000));
    reportContent = buildDemoWeeklyReport(prospect, week, metrics, cost, cpl, ctr);
  } else {
    reportContent = await callClaude(SYSTEM_PROMPTS[13], prompt, 'claude-haiku-4-20250514', 1200);
  }

  if (!reportContent) return { error: 'Report generation failed' };

  // Extract subject
  const subjMatch = reportContent.match(/SUBJECT:\s*(.*)/i);
  const subject   = subjMatch?.[1]?.trim() || `${prospect.company_name} — Week of ${week.label} Google Ads Report`;
  const body      = reportContent.replace(/SUBJECT:.*\n?/i, '').replace(/^---\s*\n?/m, '').trim();

  // Store report
  let reportId = null;
  if (isSupabaseConfigured() && supabase) {
    const { data } = await supabase.from('client_reports').insert({
      prospect_id:  prospect.id,
      company_name: prospect.company_name,
      report_type:  'weekly',
      period_start: week.start,
      period_end:   week.end,
      content:      reportContent,
      status:       'draft',
    }).select().single();
    reportId = data?.id;

    // Also update performance notes
    if (history[0]?.id) {
      await supabase.from('campaign_performance')
        .update({ notes: reportContent.slice(0, 500) })
        .eq('id', history[0].id);
    }
  }

  log('Report ready ✓');
  return { success: true, content: body, subject, reportId };
}

export async function sendWeeklyReport(reportId, prospect, subject, body) {
  if (!prospect.email) return { error: 'No email for prospect' };

  const result = await sendEmail({
    to:      prospect.email,
    toName:  prospect.contact_name || prospect.company_name,
    subject,
    body,
  });

  if (isSupabaseConfigured() && supabase && reportId) {
    await supabase.from('client_reports').update({
      status:  'sent',
      sent_at: new Date().toISOString(),
    }).eq('id', reportId);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// OPTIMIZATION BRIEF (Agent 14)
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateOptimizationBrief(prospect, campaign, onProgress) {
  const log = msg => onProgress?.(msg);
  const history = await fetchPerformanceHistory(prospect.id, 4);
  const week = weekRange();

  log('Agent 14 writing optimization brief…');

  const metricsText = history.map((w, i) => {
    const cost = micro2dollar(w.cost_micros);
    const cpl  = w.conversions > 0 ? (Number(cost) / w.conversions).toFixed(2) : 'N/A';
    return `Week ${i + 1} (${w.week_start}): ${w.impressions} impressions | ${w.clicks} clicks | ${w.conversions} leads | $${cost} spend | CPL $${cpl} | CTR ${(w.ctr * 100).toFixed(2)}%`;
  }).join('\n');

  const prompt = `Client: ${prospect.company_name}
Niche: ${prospect.niche} | Location: ${prospect.location}
Campaign: ${campaign?.name || 'Google Ads Campaign'}
Week of: ${week.label}

PERFORMANCE DATA (newest first):
${metricsText || 'No performance data yet — campaign may be new'}

Audit output from campaign setup:
${campaign?.audit_output?.slice(0, 800) || 'No audit data'}`;

  let brief;
  if (DEMO_MODE) {
    await new Promise(r => setTimeout(r, 1500));
    brief = buildDemoOptBrief(prospect);
  } else {
    brief = await callClaude(SYSTEM_PROMPTS[14], prompt, 'claude-haiku-4-20250514', 1000);
  }

  return { success: true, content: brief || buildDemoOptBrief(prospect) };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RETENTION ANALYSIS (Agent 15) — for underperforming clients
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateRetentionPlan(prospect, campaign, performanceIssue, onProgress) {
  const log = msg => onProgress?.(msg);
  log('Agent 15 writing retention plan…');

  const prompt = `Client: ${prospect.company_name} (${prospect.niche}, ${prospect.location})
Contact: ${prospect.contact_name || 'owner'}
Monthly retainer: $${prospect.monthly_value || 2500}
Performance issue: ${performanceIssue}`;

  let content;
  if (DEMO_MODE) {
    await new Promise(r => setTimeout(r, 1500));
    content = `CLIENT COMMUNICATION EMAIL:

SUBJECT: Update on ${prospect.company_name}'s campaign + recovery plan

Hi ${(prospect.contact_name || 'there').split(' ')[0]},

I want to be direct with you: this week's results were below where we need to be. ${performanceIssue}

Here's the specific plan for the next 2 weeks:

Week 1: Pause underperforming keywords, narrow geo-targeting to highest-converting zip codes, test 3 new ad variants with stronger CTAs.

Week 2: Reallocate budget to top-performing ad groups, add negative keywords from search term report, run a landing page conversion test.

If we don't see meaningful improvement by [date 14 days out], I'll extend your next month by 2 weeks at no charge.

Ali
AMA Leads

---

INTERNAL ANALYSIS:
Root cause: [performanceIssue]
Risk level: Medium — client is engaged and results are recoverable
Recommended action: Proactive outreach + 2-week sprint plan
Timeline: 14 days to demonstrate improvement before churn risk escalates`;
  } else {
    content = await callClaude(SYSTEM_PROMPTS[15], prompt, 'claude-sonnet-4-20250514', 1200);
  }

  return { success: true, content: content || '' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPSELL PITCH (Agent 16)
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateUpsellPitch(prospect, campaign, win, onProgress) {
  const log = msg => onProgress?.(msg);
  log('Agent 16 writing upsell pitch…');

  const history = await fetchPerformanceHistory(prospect.id, 8);
  const totalLeads = history.reduce((sum, w) => sum + (w.conversions || 0), 0);
  const totalSpend = history.reduce((sum, w) => sum + (Number(w.cost_micros) || 0), 0);

  const prompt = `Client: ${prospect.company_name} (${prospect.niche}, ${prospect.location})
Contact: ${prospect.contact_name || 'owner'}
Current retainer: $${prospect.monthly_value || 2500}
Campaign win to lead with: ${win}
Total leads delivered: ${totalLeads}
Total spend: $${micro2dollar(totalSpend)}
Weeks of data: ${history.length}`;

  let content;
  if (DEMO_MODE) {
    await new Promise(r => setTimeout(r, 1500));
    content = `CLIENT EMAIL:

SUBJECT: Scaling ${prospect.company_name}'s results — here's the opportunity

Hi ${(prospect.contact_name || 'there').split(' ')[0]},

The numbers are working — ${win}

Based on what's converting in your market, there's a clear opportunity to expand into [adjacent service] keywords. We're seeing $45-65 CPL in that segment with lower competition than your primary campaign.

Adding a second campaign at $1,000/month ad spend would realistically add 12-18 leads/month — at your close rate, that's meaningful additional revenue.

Worth 10 minutes to walk through the data?

Ali

---

INTERNAL ANALYSIS:
Upsell type: Budget increase + new campaign
Confidence: High — performance data supports expansion
Timing: Excellent — client is in the "results phase" window (weeks 6-12)
Close probability: 65%`;
  } else {
    content = await callClaude(SYSTEM_PROMPTS[16], prompt, 'claude-sonnet-4-20250514', 1200);
  }

  return { success: true, content: content || '' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPETITOR MONITORING (Agent 17)
// ═══════════════════════════════════════════════════════════════════════════════

export async function monitorCompetitors(prospect, campaign, onProgress) {
  const log = msg => onProgress?.(msg);
  log('Agent 17 scanning competitor ads…');

  const prompt = `Client: ${prospect.company_name}
Niche: ${prospect.niche}
Location: ${prospect.location}
Current keywords targeted: ${campaign?.keyword_output?.slice(0, 300) || 'standard high-intent keywords for this niche'}
Week of: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}

Research competitor Google Ads activity and produce the competitor intelligence report.`;

  let content;
  if (DEMO_MODE) {
    await new Promise(r => setTimeout(r, 2000));
    content = `COMPETITOR COUNT: 6 active advertisers found

TOP COMPETITOR: Metro ${prospect.niche.split(' ')[0]} Pro — running exact match on all high-intent terms, strong "same-day" urgency angle, $49 inspection offer as lead magnet

DOMINANT AD ANGLES THIS WEEK:
- "Free estimate": used by 83% of advertisers
- "Licensed & insured": used by 67% of advertisers
- "Same-day / 24hr service": used by 50% of advertisers

GAPS IN THE MARKET (angles no one is using):
- No-contract guarantee angle — everyone locks clients in, we can differentiate
- Specific CPL/results guarantee — "X leads or your money back" not being used
- Video testimonial ads — no competitor is running video creative

RECOMMENDED COUNTER-MOVES for ${prospect.company_name}:
1. Add "No contract required" to headline 1 — none of the 6 competitors are using this
2. Test a "$0 setup fee" angle vs current "free estimate" — lower friction for first click
3. Increase bids on "[niche] near me" — top competitor is not bidding on this variant

THREAT LEVEL: Medium
Reason: Competition is stable but Metro ${prospect.niche.split(' ')[0]} Pro increased their ad spend ~30% in the last 2 weeks.`;
  } else {
    content = await callClaude(SYSTEM_PROMPTS[17], prompt, 'claude-sonnet-4-20250514', 1000);
  }

  // Count competitors from output
  const countMatch = content?.match(/COMPETITOR COUNT:\s*(\d+)/i);
  const competitorCount = countMatch ? parseInt(countMatch[1]) : 0;

  // Store in competitor_reports
  if (isSupabaseConfigured() && supabase && content) {
    await supabase.from('competitor_reports').insert({
      prospect_id:      prospect.id,
      company_name:     prospect.company_name,
      niche:            prospect.niche,
      location:         prospect.location,
      content,
      competitor_count: competitorCount,
      week_start:       new Date().toISOString().slice(0, 10),
      status:           'draft',
    });
  }

  log(`Competitor scan complete — ${competitorCount} advertisers found`);
  return { success: true, content: content || '', competitorCount };
}

export async function fetchCompetitorReports(prospectId) {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data } = await supabase
    .from('competitor_reports')
    .select('*')
    .eq('prospect_id', prospectId)
    .order('created_at', { ascending: false })
    .limit(8);
  return data || [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO WEEKLY REPORTS — runs for all active clients every Monday
// ═══════════════════════════════════════════════════════════════════════════════

export async function runWeeklyReportsForAllClients(onProgress) {
  const log = msg => onProgress?.(msg);
  if (!isSupabaseConfigured() || !supabase) return;

  log('Checking weekly reports for all clients…');

  // Get all client prospects
  const { data: clients } = await supabase
    .from('prospects')
    .select('*')
    .eq('status', 'client');

  if (!clients?.length) { log('No clients yet'); return; }

  // Get their campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .in('prospect_id', clients.map(c => c.id));

  const campaignMap = {};
  (campaigns || []).forEach(c => { campaignMap[c.prospect_id] = c; });

  // Check which clients haven't gotten a report this week
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: recentReports } = await supabase
    .from('client_reports')
    .select('prospect_id')
    .gte('created_at', weekAgo);

  const recentlyReported = new Set((recentReports || []).map(r => r.prospect_id));
  const needsReport = clients.filter(c => !recentlyReported.has(c.id));

  log(`${needsReport.length} of ${clients.length} clients need a report this week`);

  let sent = 0;
  for (const client of needsReport) {
    try {
      log(`Generating report for ${client.company_name}…`);
      const campaign = campaignMap[client.id] || null;
      const result = await generateWeeklyReport(client, campaign, log);

      if (result.success && client.email) {
        await sendWeeklyReport(result.reportId, client, result.subject, result.content);
        sent++;
        log(`✓ Report sent to ${client.company_name}`);
      } else if (result.success) {
        log(`✓ Report generated for ${client.company_name} (no email on file)`);
      }
    } catch (e) {
      log(`❌ Report failed for ${client.company_name}: ${e.message}`);
    }
  }

  log(`Weekly reports complete — ${sent} sent`);
  return { sent, total: needsReport.length };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO PERFORMANCE SYNC — pulls Google Ads metrics for all active campaigns
// ═══════════════════════════════════════════════════════════════════════════════

export async function syncAllCampaignPerformance(onProgress) {
  const log = msg => onProgress?.(msg);
  if (!isSupabaseConfigured() || !supabase) return;

  log('Syncing Google Ads performance for all campaigns…');

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*, prospects(id, company_name, email, status)')
    .eq('status', 'ready')
    .not('google_ads_campaign_id', 'is', null);

  if (!campaigns?.length) { log('No campaigns with Google Ads IDs yet'); return; }

  let synced = 0;
  for (const campaign of campaigns) {
    const prospect = campaign.prospects;
    if (!prospect) continue;
    try {
      const result = await syncCampaignPerformance(prospect, campaign);
      if (result) {
        synced++;
        log(`✓ Synced ${prospect.company_name}`);
      }
    } catch (e) {
      log(`❌ Sync failed for ${campaign.id}: ${e.message}`);
    }
  }

  log(`Performance sync complete — ${synced}/${campaigns.length} campaigns updated`);
  return { synced, total: campaigns.length };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export async function fetchReports(prospectId = null) {
  if (!isSupabaseConfigured() || !supabase) return [];
  let q = supabase.from('client_reports').select('*').order('created_at', { ascending: false }).limit(50);
  if (prospectId) q = q.eq('prospect_id', prospectId);
  const { data } = await q;
  return data || [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getChange(current, previous) {
  if (current == null || previous == null || previous === 0) return 'N/A';
  const pct = (((current - previous) / previous) * 100).toFixed(0);
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

function buildDemoWeeklyReport(prospect, week, metrics, cost, cpl, ctr) {
  return `SUBJECT: ${prospect.company_name} — Week of ${week.label} Google Ads Report

---

${prospect.company_name} — Weekly Performance Report
${week.label}

THE NUMBERS:
| Metric       | This Week | Prior Week | Change |
|-------------|-----------|------------|--------|
| Impressions  | ${metrics?.impressions ?? 0}       | —          | —      |
| Clicks       | ${metrics?.clicks ?? 0}            | —          | —      |
| Leads        | ${metrics?.conversions ?? 0}        | —          | —      |
| CPL          | $${cpl}       | —          | —      |
| Spend        | $${cost}      | —          | —      |
| CTR          | ${ctr}%       | —          | —      |

WHAT'S WORKING:
- High-intent keywords are generating qualified calls
- CTR performing above industry average for ${prospect.niche}

WHAT WE'RE FIXING:
- Testing 2 new ad variants this week with stronger CTAs
- Adding negative keywords from search term report to reduce wasted spend

THIS WEEK'S FOCUS:
- Bid adjustments for top-converting hours (evenings, weekends)
- Landing page headline A/B test launching Thursday

MTD SUMMARY:
On pace for target lead volume at current spend level.

Questions? Reply directly to this email — I check it daily.

Ali
AMA Leads`;
}

function buildDemoOptBrief(prospect) {
  return `CAMPAIGN OPTIMIZATION BRIEF — ${prospect.company_name}
Week of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}

VERDICT: 🟡 On track — optimization needed

TOP 3 CHANGES THIS WEEK:
1. Pause broad match keywords with >50 impressions, 0 conversions — saving ~$12/day
2. Increase bids on [exact match primary keyword] by 20% — it's converting at $42 CPL vs $67 average
3. Add 8 negative keywords from search term report (irrelevant traffic segments identified)

KEYWORDS TO PAUSE:
- "affordable [niche]" — high volume, low intent, bleeding budget
- "[niche] near me" broad — converting poorly vs exact match version

KEYWORDS TO SCALE:
- "[emergency/urgent] [niche]" — 3x conversion rate of average
- "[niche] [city]" exact — best CPL in the account

NEGATIVES TO ADD:
- "free", "DIY", "how to", "youtube", "reviews", "jobs", "careers"

BID ADJUSTMENTS:
- Mobile: -20% (desktop converts 2x better for this niche)
- Evenings 6-9pm: +25% (highest conversion window)

NEW AD VARIANT TO TEST:
Test "emergency available" angle vs current "free estimate" angle in headline 1.`;
}
