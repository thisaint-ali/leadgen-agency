// Campaign Builder: auto-runs agents 4→5→6→7 when a prospect becomes a client
// Also pushes to Google Ads + GHL when those integrations are connected

import { useState } from 'react';
import { X, Loader, CheckCircle2, AlertCircle, Zap, ExternalLink } from 'lucide-react';
import { callAgent } from '../agents/orchestrator';
import { SYSTEM_PROMPTS } from '../agents/systemPrompts';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { createCampaign as createGoogleAdsCampaign, isGoogleAdsConnected } from '../integrations/googleAds';
import { syncClientToGHL, isGHLConnected } from '../integrations/ghl';

const CAMPAIGN_AGENTS = [
  { id: 4, name: 'Keyword Researcher',   desc: 'Building keyword package + ad groups + negatives' },
  { id: 5, name: 'Ad Copy Generator',    desc: 'Writing RSA headlines, descriptions, extensions'  },
  { id: 6, name: 'LP Builder',           desc: 'Creating landing page brief for GoHighLevel'       },
  { id: 7, name: 'Campaign Auditor',     desc: 'Reviewing full setup and producing 30-day plan'    },
];

function AgentRow({ agent, status, isActive }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
      status === 'done'    ? 'border-emerald-200 bg-emerald-50' :
      status === 'error'   ? 'border-red-200 bg-red-50' :
      isActive             ? 'border-[#2196F3]/30 bg-[#EEF6FE]' :
      status === 'pending' ? 'border-slate-200 bg-white' :
      'border-slate-200 bg-white opacity-50'
    }`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
        status === 'done'  ? 'bg-emerald-100 text-emerald-700' :
        status === 'error' ? 'bg-red-100 text-red-600' :
        isActive           ? 'bg-[#2196F3] text-white' :
        'bg-slate-100 text-slate-400'
      }`}>
        {status === 'done'
          ? <CheckCircle2 size={14} />
          : isActive
          ? <Loader size={12} className="animate-spin" />
          : `A${agent.id}`
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-800">{agent.name}</div>
        <div className="text-xs text-slate-500 truncate">{agent.desc}</div>
      </div>
      <div className={`text-xs font-medium flex-shrink-0 ${
        status === 'done' ? 'text-emerald-600' :
        status === 'error' ? 'text-red-500' :
        isActive ? 'text-[#2196F3]' :
        'text-slate-300'
      }`}>
        {status === 'done' ? 'Done ✓' : isActive ? 'Running…' : status === 'error' ? 'Error' : 'Waiting'}
      </div>
    </div>
  );
}

export default function CampaignBuilder({ prospect, onClose, onComplete }) {
  const [agentStatuses, setAgentStatuses] = useState({
    4: 'idle', 5: 'idle', 6: 'idle', 7: 'idle',
  });
  const [outputs, setOutputs] = useState({});
  const [step, setStep] = useState('idle'); // idle | building | integrating | done | error
  const [currentAgent, setCurrentAgent] = useState(null);
  const [integrationResults, setIntegrationResults] = useState({});
  const [campaignId, setCampaignId] = useState(null);

  const setStatus = (id, status) => setAgentStatuses(p => ({ ...p, [id]: status }));

  const run = async () => {
    setStep('building');
    const ctx = {};
    const base = `Niche: ${prospect.niche || 'roofing contractors'}. Location: ${prospect.location || 'United States'}. Client: ${prospect.company_name}.`;

    // Save initial campaign record
    let dbCampaignId = null;
    if (isSupabaseConfigured() && supabase) {
      const { data } = await supabase.from('campaigns').insert({
        prospect_id: prospect.id,
        company_name: prospect.company_name,
        niche: prospect.niche,
        location: prospect.location,
        status: 'building',
      }).select().single();
      dbCampaignId = data?.id;
      setCampaignId(dbCampaignId);
    }

    // Agent 4 — Keywords
    setCurrentAgent(4);
    setStatus(4, 'running');
    ctx[4] = await callAgent(4, SYSTEM_PROMPTS[4],
      `${base} Build the complete keyword research package for this niche and location.`,
      (id, status, output) => {
        setStatus(id, status);
        if (output) ctx[4] = output;
      }
    );

    if (!ctx[4]) { setStep('error'); return; }

    // Agent 5 — Ad Copy (needs 4)
    setCurrentAgent(5);
    setStatus(5, 'running');
    ctx[5] = await callAgent(5, SYSTEM_PROMPTS[5],
      `${base}\n\n[KEYWORDS — Agent 4]:\n${ctx[4]}\n\nWrite RSA ad copy using these exact keywords.`,
      (id, status, output) => {
        setStatus(id, status);
        if (output) ctx[5] = output;
      }
    );

    // Agent 6 — LP Brief (needs 4 + 5)
    setCurrentAgent(6);
    setStatus(6, 'running');
    ctx[6] = await callAgent(6, SYSTEM_PROMPTS[6],
      `${base}\n\n[KEYWORDS]:\n${ctx[4] || ''}\n\n[AD COPY]:\n${ctx[5] || ''}\n\nBuild the full LP brief with message match to these ads.`,
      (id, status, output) => {
        setStatus(id, status);
        if (output) ctx[6] = output;
      }
    );

    // Agent 7 — Auditor (needs all)
    setCurrentAgent(7);
    setStatus(7, 'running');
    ctx[7] = await callAgent(7, SYSTEM_PROMPTS[7],
      `${base}\n\n[KEYWORDS]:\n${ctx[4] || 'No data'}\n\n[AD COPY]:\n${ctx[5] || 'No data'}\n\n[LP BRIEF]:\n${ctx[6] || 'No data'}\n\nReview all outputs and produce the integrated campaign assessment.`,
      (id, status, output) => {
        setStatus(id, status);
        if (output) ctx[7] = output;
      }
    );

    setCurrentAgent(null);

    // Save outputs to Supabase
    if (dbCampaignId && isSupabaseConfigured() && supabase) {
      await supabase.from('campaigns').update({
        keywords_output: ctx[4] || null,
        adcopy_output:   ctx[5] || null,
        lp_brief_output: ctx[6] || null,
        audit_output:    ctx[7] || null,
        status: 'ready',
        updated_at: new Date().toISOString(),
      }).eq('id', dbCampaignId);
    }

    // ── Integration push ──────────────────────────────────────────────────────
    setStep('integrating');
    const results = {};

    // Google Ads
    const gadsResult = await createGoogleAdsCampaign({
      company: prospect.company_name,
      niche: prospect.niche,
      location: prospect.location,
      keywords: ctx[4],
      adCopy: ctx[5],
      monthlyBudget: prospect.monthly_value,
    });
    results.googleAds = gadsResult;
    if (gadsResult.google_ads_campaign_id && dbCampaignId && supabase) {
      await supabase.from('campaigns').update({ google_ads_campaign_id: gadsResult.google_ads_campaign_id }).eq('id', dbCampaignId);
    }

    // GHL
    const ghlResult = await syncClientToGHL({
      name: prospect.contact_name || prospect.company_name,
      email: prospect.email,
      phone: prospect.phone,
      niche: prospect.niche,
      location: prospect.location,
      monthlyValue: prospect.monthly_value,
    });
    results.ghl = ghlResult;
    if (ghlResult.contactId && dbCampaignId && supabase) {
      await supabase.from('campaigns').update({ ghl_contact_id: ghlResult.contactId }).eq('id', dbCampaignId);
    }

    setIntegrationResults(results);
    setStep('done');
    if (onComplete) onComplete({ campaignId: dbCampaignId, outputs: ctx });
  };

  const allDone = Object.values(agentStatuses).every(s => s === 'done');

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={step === 'idle' || step === 'done' || step === 'error' ? onClose : undefined}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Build Campaign</h3>
            <p className="text-xs text-slate-400 mt-0.5">{prospect.company_name} · {prospect.niche}</p>
          </div>
          {(step === 'idle' || step === 'done' || step === 'error') && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="p-6">
          {/* Idle state */}
          {step === 'idle' && (
            <>
              <p className="text-sm text-slate-600 mb-5 leading-relaxed">
                This will automatically run agents 4–7 to build a complete Google Ads campaign for <strong>{prospect.company_name}</strong> — keywords, ad copy, landing page brief, and a full campaign audit.
              </p>
              <div className="space-y-2 mb-5">
                {CAMPAIGN_AGENTS.map(a => <AgentRow key={a.id} agent={a} status="idle" isActive={false} />)}
              </div>

              {/* Integration preview */}
              <div className="flex gap-2 mb-5">
                <div className={`flex-1 flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${isGoogleAdsConnected() ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                  {isGoogleAdsConnected() ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                  Google Ads {isGoogleAdsConnected() ? 'connected' : 'stub only'}
                </div>
                <div className={`flex-1 flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${isGHLConnected() ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                  {isGHLConnected() ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                  GHL {isGHLConnected() ? 'connected' : 'stub only'}
                </div>
              </div>

              <button
                onClick={run}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-[#1B3A5C] text-white text-sm font-semibold hover:bg-[#243E6A] transition-colors"
              >
                <Zap size={15} />
                Build campaign automatically
              </button>
            </>
          )}

          {/* Building / integrating */}
          {(step === 'building' || step === 'integrating') && (
            <>
              <div className="space-y-2 mb-4">
                {CAMPAIGN_AGENTS.map(a => (
                  <AgentRow
                    key={a.id}
                    agent={a}
                    status={agentStatuses[a.id]}
                    isActive={currentAgent === a.id}
                  />
                ))}
              </div>

              {step === 'integrating' && allDone && (
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                  <Loader size={11} className="animate-spin text-[#2196F3]" />
                  Pushing to integrations…
                </div>
              )}
            </>
          )}

          {/* Done */}
          {step === 'done' && (
            <>
              <div className="flex items-center justify-center gap-2 mb-5">
                <CheckCircle2 size={20} className="text-emerald-500" />
                <span className="text-sm font-semibold text-emerald-700">Campaign built successfully</span>
              </div>

              <div className="space-y-2 mb-5">
                {CAMPAIGN_AGENTS.map(a => (
                  <AgentRow key={a.id} agent={a} status={agentStatuses[a.id]} isActive={false} />
                ))}
              </div>

              {/* Integration results */}
              <div className="space-y-2 mb-5">
                {[
                  { key: 'googleAds', label: 'Google Ads', result: integrationResults.googleAds },
                  { key: 'ghl',       label: 'GoHighLevel', result: integrationResults.ghl },
                ].map(({ key, label, result }) => (
                  <div key={key} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
                    result?.success ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'
                  }`}>
                    {result?.success ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                    {label}: {result?.success ? 'Created ✓' : result?.message || 'Stub saved — connect API to activate'}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
                {campaignId && isSupabaseConfigured() && (
                  <button
                    onClick={onClose}
                    className="flex-1 h-10 rounded-xl bg-[#2196F3] text-white text-sm font-medium hover:bg-[#1565C0] transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink size={13} />
                    View in History
                  </button>
                )}
              </div>
            </>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="text-center py-4">
              <AlertCircle size={24} className="mx-auto text-red-400 mb-3" />
              <div className="text-sm font-medium text-red-600 mb-1">Campaign build failed</div>
              <div className="text-xs text-slate-500 mb-4">Agent 4 (Keyword Researcher) returned no output. Check your Anthropic API key.</div>
              <button onClick={run} className="h-9 px-5 rounded-xl bg-[#2196F3] text-white text-sm font-medium hover:bg-[#1565C0] transition-colors">
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
