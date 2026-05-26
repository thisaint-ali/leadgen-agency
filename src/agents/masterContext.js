// Builds live context for the Master Agent from Supabase data
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getIntegrationStatus } from '../integrations/index';

const AGENT_NAMES = {
  1: 'Prospect Finder',
  2: 'Qualifier',
  3: 'Outreach Writer',
  4: 'Keyword Researcher',
  5: 'Ad Copy Generator',
  6: 'LP Builder',
  7: 'Campaign Auditor',
};

export async function buildMasterContext() {
  const integrations = getIntegrationStatus();

  if (!isSupabaseConfigured() || !supabase) {
    return buildDemoContext(integrations);
  }

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [prospectsRes, agentOutputsRes, recentErrorsRes, campaignsRes] = await Promise.all([
      supabase.from('prospects').select('status, monthly_value, created_at, last_contacted_at, niche, location'),
      supabase.from('agent_outputs').select('agent_id, agent_name, status, created_at').gte('created_at', thirtyDaysAgo),
      supabase.from('agent_outputs').select('agent_id, agent_name, status, created_at').eq('status', 'error').order('created_at', { ascending: false }).limit(10),
      supabase.from('campaigns').select('status, prospect_id, created_at').limit(50),
    ]);

    const prospects = prospectsRes.data || [];
    const agentOutputs = agentOutputsRes.data || [];
    const recentErrors = recentErrorsRes.data || [];
    const campaigns = campaignsRes.data || [];

    // Pipeline counts
    const stages = ['new', 'contacted', 'replied', 'call_booked', 'proposal', 'client', 'dead'];
    const pipelineCounts = Object.fromEntries(stages.map(s => [s, prospects.filter(p => p.status === s).length]));
    const clients = prospects.filter(p => p.status === 'client');
    const mrr = clients.reduce((sum, p) => sum + (Number(p.monthly_value) || 0), 0);

    // Avg retainer
    const avgRetainer = clients.length ? Math.round(mrr / clients.length) : 0;

    // Stale prospects (no contact in 7+ days, not new/client)
    const stale = prospects.filter(p => {
      if (['new', 'client', 'dead'].includes(p.status)) return false;
      if (!p.last_contacted_at) return true;
      const days = (Date.now() - new Date(p.last_contacted_at)) / 86400000;
      return days > 7;
    }).length;

    // Agent stats
    const agentStats = {};
    for (let i = 1; i <= 7; i++) {
      const outs = agentOutputs.filter(o => o.agent_id === i);
      const errs = outs.filter(o => o.status === 'error');
      agentStats[i] = {
        name: AGENT_NAMES[i],
        runs: outs.length,
        errors: errs.length,
        successRate: outs.length ? Math.round(((outs.length - errs.length) / outs.length) * 100) : null,
      };
    }
    const sortedByErrors = Object.values(agentStats).filter(a => a.errors > 0).sort((a, b) => b.errors - a.errors);
    const mostProblematic = sortedByErrors[0] || null;

    const totalRuns   = agentOutputs.length;
    const totalErrors = agentOutputs.filter(o => o.status === 'error').length;

    return {
      pipeline: {
        counts: pipelineCounts,
        total: prospects.length,
        mrr,
        clients: clients.length,
        avgRetainer,
        staleProspects: stale,
      },
      agents: {
        stats: agentStats,
        totalRuns,
        totalErrors,
        successRate: totalRuns ? Math.round(((totalRuns - totalErrors) / totalRuns) * 100) : null,
        mostProblematic,
      },
      campaigns: {
        total: campaigns.length,
        building: campaigns.filter(c => c.status === 'building').length,
        ready: campaigns.filter(c => c.status === 'ready').length,
      },
      integrations,
      recentErrors,
      isLive: true,
    };
  } catch {
    return buildDemoContext(integrations);
  }
}

function buildDemoContext(integrations) {
  return {
    pipeline: { counts: { new: 5, contacted: 3, replied: 1, call_booked: 1, proposal: 1, client: 2, dead: 0 }, total: 13, mrr: 4500, clients: 2, avgRetainer: 2250, staleProspects: 2 },
    agents: { stats: {}, totalRuns: 14, totalErrors: 2, successRate: 86, mostProblematic: { name: 'Qualifier', errors: 2 } },
    campaigns: { total: 2, building: 0, ready: 2 },
    integrations,
    recentErrors: [],
    isLive: false,
  };
}

export function buildMasterSystemPrompt(ctx) {
  const { pipeline, agents, campaigns, integrations, recentErrors } = ctx;
  const { counts, mrr, clients, avgRetainer, staleProspects } = pipeline;

  const revenue = {
    week:  Math.round(mrr / 4.33),
    month: mrr,
    year:  mrr * 12,
  };

  // Projections: assume 10% pipeline → client conversion, 60-day average close
  const hotLeads = (counts.call_booked || 0) + (counts.proposal || 0);
  const projectedNewClients = Math.round(hotLeads * 0.5); // 50% close on call_booked+proposal
  const projectedMrrGrowth  = projectedNewClients * avgRetainer;

  const intLine = (key, label) => {
    const on = integrations[key];
    return `  ${on ? '✅' : '❌'} ${label}${!on ? ` — add ${Object.entries({ anthropic: 'VITE_ANTHROPIC_API_KEY', resend: 'VITE_RESEND_API_KEY', googleAds: 'VITE_GOOGLE_ADS_KEY', ghl: 'VITE_GHL_API_KEY' })[Object.keys(integrations).indexOf(key)]?.[1] || ''} to .env` : ''}`;
  };

  const agentLines = Object.values(agents.stats).length
    ? Object.values(agents.stats).map(a =>
        `  A${Object.keys(agents.stats).find(k => agents.stats[k] === a)} ${a.name}: ${a.runs} runs, ${a.errors} errors${a.successRate !== null ? `, ${a.successRate}% success` : ''}`
      ).join('\n')
    : '  No agent run data yet — run the Agent Network to populate';

  const errorLines = recentErrors.length
    ? recentErrors.slice(0, 5).map(e => `  - ${e.agent_name} failed ${new Date(e.created_at).toLocaleDateString()}`).join('\n')
    : '  None recently';

  return `You are the Master Agent for AMA Leads — a Google Ads lead generation agency. You have full real-time visibility into every part of the business and speak with authority and precision.

═══ LIVE PIPELINE ═══
  New leads:       ${counts.new || 0}
  Contacted:       ${counts.contacted || 0}
  Replied:         ${counts.replied || 0}
  Call booked:     ${counts.call_booked || 0}
  Proposal sent:   ${counts.proposal || 0}
  Active clients:  ${clients}
  Total prospects: ${pipeline.total}
  Stale (>7d no contact): ${staleProspects}

═══ REVENUE ═══
  MRR (current):         $${mrr.toLocaleString()}
  Revenue this week:     $${revenue.week.toLocaleString()}
  Revenue this month:    $${revenue.month.toLocaleString()}
  Revenue this year:     $${revenue.year.toLocaleString()} (projected)
  Avg retainer/client:   $${avgRetainer.toLocaleString()}
  Pipeline potential:    +$${projectedMrrGrowth.toLocaleString()} MRR if hot leads close (${hotLeads} in call_booked/proposal)

═══ CAMPAIGNS ═══
  Built: ${campaigns.total} | Building: ${campaigns.building} | Ready: ${campaigns.ready}

═══ AGENT PERFORMANCE (last 30 days) ═══
  Total runs:    ${agents.totalRuns}
  Total errors:  ${agents.totalErrors}
  Success rate:  ${agents.successRate !== null ? agents.successRate + '%' : 'no data yet'}
  Most issues:   ${agents.mostProblematic ? `${agents.mostProblematic.name} (${agents.mostProblematic.errors} errors)` : 'None'}
${agentLines}

═══ RECENT AGENT ERRORS ═══
${errorLines}

═══ INTEGRATIONS ═══
${intLine('anthropic', 'Anthropic API (AI agents)')}
${intLine('resend', 'Resend (email sending)')}
${intLine('googleAds', 'Google Ads API (campaign creation)')}
${intLine('ghl', 'GoHighLevel (CRM + funnels)')}

═══ AUTOMATION STATUS ═══
  ✅ Auto-import Agent 1 prospects → Pipeline
  ✅ Client trigger → auto-build campaign (agents 4/5/6/7)
  ${integrations.resend ? '✅' : '⏳'} Email queue (${integrations.resend ? 'active' : 'waiting for Resend key'})
  ${integrations.googleAds ? '✅' : '⏳'} Google Ads push (${integrations.googleAds ? 'active' : 'waiting for Google Ads key'})
  ${integrations.ghl ? '✅' : '⏳'} GHL sync (${integrations.ghl ? 'active' : 'waiting for GHL key'})

═══ YOUR RULES ═══
- Always give specific numbers, not vague answers
- When diagnosing agent failures, name the agent and the pattern of errors
- When asked about revenue, always give week/month/year breakdown
- When asked what to focus on, look at pipeline bottlenecks and stale prospects
- When asked about integrations, explain exactly what activates and how to get the key
- When asked to change something on a page or in the system, describe the exact change needed in a way the developer can implement immediately via Claude Code
- Never make up data — if something is unavailable, say so clearly
- Be direct. No fluff. This is an agency operator asking real business questions.`;
}
