import { useState } from 'react';
import {
  Search, Filter, Mail, Key, Megaphone, Layout, BarChart2,
  Play, Loader, AlertTriangle, Download, CheckCircle2, Users, Copy,
  FileText, Send, TrendingUp, Shield, Eye, DollarSign, ChevronDown, ChevronUp, Zap,
} from 'lucide-react';
import CitySearch from './CitySearch';
import { importProspectsFromAgent1 } from '../agents/autoImport';
import { SYSTEM_PROMPTS } from '../agents/systemPrompts';
import { runAllAgents, callAgent, isDemoMode } from '../agents/orchestrator';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { parseAgent3Email, batchPersonalize } from '../agents/bigBotEngine';
import StatusDot from './StatusDot';
import OutputPanel from './OutputPanel';

// ─── Pipeline agents (A1–A7, run in waves) ────────────────────────────────────
const NICHES = [
  'roofing contractors', 'foundation repair companies', 'personal injury law firms',
  'HVAC companies', 'plumbing companies', 'solar installation companies',
  'general contractors', 'window and siding companies',
];

const AGENT_META = {
  1: { name: 'Prospect Finder',    icon: Search,    wave: 1, deps: [],             color: 'blue',   desc: 'Finds & scores 6–8 qualified local businesses' },
  2: { name: 'Qualifier',          icon: Filter,    wave: 2, deps: [1],            color: 'indigo', desc: 'Deep-qualifies top 2 prospects via web research' },
  3: { name: 'Outreach Writer',    icon: Mail,      wave: 3, deps: [1, 2],         color: 'violet', desc: '3 cold email variants + full follow-up sequence' },
  4: { name: 'Keyword Researcher', icon: Key,       wave: 1, deps: [],             color: 'orange', desc: 'Full keyword package with intent tiers & negatives' },
  5: { name: 'Ad Copy Generator',  icon: Megaphone, wave: 2, deps: [4],            color: 'amber',  desc: '3 RSA variants · 15 headlines · 4 descriptions each' },
  6: { name: 'LP Builder',         icon: Layout,    wave: 3, deps: [4, 5],         color: 'teal',   desc: 'Landing page brief ready for GoHighLevel' },
  7: { name: 'Campaign Auditor',   icon: BarChart2, wave: 4, deps: [1,2,3,4,5,6], color: 'slate',  desc: 'Integrated audit · readiness score · 30-day plan' },
};

const WAVES = [[1, 4], [2, 5], [3, 6], [7]];
const WAVE_LABELS = ['Wave 1 — parallel', 'Wave 2 — parallel', 'Wave 3 — parallel', 'Wave 4 — final'];

// ─── On-demand agents (A8–A17) ────────────────────────────────────────────────
const DEMAND_GROUPS = [
  {
    label: 'Outreach',
    color: 'text-violet-600',
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
    agents: [
      {
        id: 8, name: 'Email Sequencer', icon: Mail, color: 'violet',
        desc: 'Follow-up sequences (day 3, 7, 14) for non-responders',
        placeholder: 'Company: ABC Roofing\nNiche: roofing\nOriginal email sent: [paste it]\nSequence #: 2  (or 3 for breakup)',
      },
      {
        id: 9, name: 'Batch Personalizer', icon: Users, color: 'violet',
        desc: 'Unique personalized cold email for every prospect in a list',
        placeholder: '1. ABC Roofing, Austin TX\n2. XYZ HVAC, Dallas TX\n3. Premier Plumbing, Houston TX\n(paste list from Agent 1, or type manually)',
      },
    ],
  },
  {
    label: 'Sales',
    color: 'text-orange-600',
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
    agents: [
      {
        id: 10, name: 'Proposal Writer', icon: FileText, color: 'orange',
        desc: 'Full client proposal with opportunity data, numbers & next steps',
        placeholder: 'Company: ABC Roofing\nContact: John Smith\nNiche: roofing contractors\nLocation: Austin, TX\nEstimated retainer: $2,500/mo\nNotes: no Google Ads, weak 2015 website, active on Angi',
      },
      {
        id: 11, name: 'Contract Generator', icon: FileText, color: 'slate',
        desc: 'Plain-language service agreement ready to send and e-sign',
        placeholder: 'Client name: John Smith\nCompany: ABC Roofing LLC\nNiche: roofing contractors\nLocation: Austin, TX\nMonthly retainer: $2,500\nTarget leads: 20–30/month',
      },
    ],
  },
  {
    label: 'Delivery',
    color: 'text-teal-600',
    badge: 'bg-teal-50 text-teal-700 border-teal-200',
    agents: [
      {
        id: 12, name: 'Onboarding Email', icon: Send, color: 'emerald',
        desc: 'Welcome email with exact next steps, timeline & access instructions',
        placeholder: 'Client name: John Smith\nCompany: ABC Roofing\nNiche: roofing\nLocation: Austin, TX\nRetainer: $2,500/mo\nCampaign start: within 5 business days',
      },
      {
        id: 13, name: 'Weekly Reporter', icon: BarChart2, color: 'teal',
        desc: 'Client-facing performance report with what\'s working & what\'s being fixed',
        placeholder: 'Client: John Smith — ABC Roofing\nWeek: May 19–25, 2025\nImpressions: 8,420 | Clicks: 312 | Leads: 18 | CPL: $42 | Spend: $756\nPrior week: 14 leads at $51 CPL',
      },
      {
        id: 14, name: 'Campaign Optimizer', icon: TrendingUp, color: 'blue',
        desc: 'Weekly optimization brief — specific bid changes & keyword actions',
        placeholder: 'Campaign: ABC Roofing Austin\nTop keyword: "emergency roof repair" — 12 conv, $28 CPL\nWaste: "roof replacement free estimate" — 0 conv, 62 clicks\nCTR: 4.2% | Avg QS: 7.1 | Budget: $1,000/mo',
      },
      {
        id: 15, name: 'Retention Agent', icon: Shield, color: 'red',
        desc: 'Honest client communication + internal recovery plan when results dip',
        placeholder: 'Client: John Smith — ABC Roofing, Austin TX\nIssue: 4 leads this week vs 14 target\nCause: Google suspended account for billing, restored yesterday\nRisk level: client texted asking for update',
      },
      {
        id: 16, name: 'Upsell Agent', icon: DollarSign, color: 'emerald',
        desc: 'Expansion pitch with projections when the campaign is performing well',
        placeholder: 'Client: John Smith — ABC Roofing, Austin TX\nThis month: 34 leads at $31 CPL, ahead of 25-lead target\nCurrent retainer: $2,500/mo\nOpportunity: expand to Dallas OR add siding vertical',
      },
      {
        id: 17, name: 'Competitor Monitor', icon: Eye, color: 'purple',
        desc: 'Weekly intel report on competitor Google Ads in client niche + location',
        placeholder: 'Client company: ABC Roofing\nNiche: roofing contractors\nLocation: Austin, TX\nCurrent keywords: emergency roof repair, roof replacement Austin, residential roofing Austin TX',
      },
    ],
  },
];

// ─── Style maps ───────────────────────────────────────────────────────────────
const doneCardStyle = {
  blue:   { card: 'border-blue-200 bg-blue-50',     icon: 'bg-blue-100 text-blue-600' },
  indigo: { card: 'border-indigo-200 bg-indigo-50', icon: 'bg-indigo-100 text-indigo-600' },
  violet: { card: 'border-violet-200 bg-violet-50', icon: 'bg-violet-100 text-violet-600' },
  orange: { card: 'border-orange-200 bg-orange-50', icon: 'bg-orange-100 text-orange-600' },
  amber:  { card: 'border-amber-200 bg-amber-50',   icon: 'bg-amber-100 text-amber-600' },
  teal:   { card: 'border-teal-200 bg-teal-50',     icon: 'bg-teal-100 text-teal-600' },
  slate:  { card: 'border-slate-200 bg-slate-50',   icon: 'bg-slate-100 text-slate-600' },
  emerald:{ card: 'border-emerald-200 bg-emerald-50',icon: 'bg-emerald-100 text-emerald-600' },
  red:    { card: 'border-red-200 bg-red-50',       icon: 'bg-red-100 text-red-600' },
  purple: { card: 'border-purple-200 bg-purple-50', icon: 'bg-purple-100 text-purple-600' },
};

const initPipelineState = () =>
  Object.fromEntries(Object.keys(AGENT_META).map(k => [k, { status: 'idle', output: '', error: '' }]));

const initDemandState = () =>
  Object.fromEntries(
    DEMAND_GROUPS.flatMap(g => g.agents).map(a => [
      a.id,
      { status: 'idle', output: '', error: '', context: '', expanded: false },
    ])
  );

// ─── On-demand agent card ─────────────────────────────────────────────────────
function DemandCard({ agent, state, onContextChange, onRun, onSaveTemplate, groupBadge }) {
  const { id, name, icon: Icon, color, desc, placeholder } = agent;
  const s = doneCardStyle[color] || doneCardStyle.slate;
  const isDone    = state.status === 'done';
  const isRunning = state.status === 'running';
  const isError   = state.status === 'error';
  const isExpanded = state.expanded;
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  return (
    <div className={`rounded-xl border transition-all ${
      isDone    ? s.card :
      isError   ? 'border-red-200 bg-red-50' :
      isRunning ? 'border-[#2196F3]/30 bg-[#EEF6FE]' :
      isExpanded ? 'border-slate-300 bg-white shadow-sm' :
      'border-slate-200 bg-white hover:border-slate-300'
    }`}>
      {/* Header row */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={onContextChange.toggle}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isDone ? s.icon : isRunning ? 'bg-[#2196F3]/10 text-[#2196F3]' : 'bg-slate-100 text-slate-400'
        }`}>
          {isRunning ? <Loader size={14} className="animate-spin" /> : <Icon size={14} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">A{id}</span>
            <span className="text-sm font-semibold text-slate-800 truncate">{name}</span>
            <span className={`hidden sm:inline text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${groupBadge}`}>
              {agent.group || ''}
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-snug mt-0.5 truncate">{desc}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isDone && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
              <CheckCircle2 size={10} /> Done
            </span>
          )}
          {isError && (
            <span className="text-[10px] font-semibold text-red-600">Error</span>
          )}
          {isExpanded
            ? <ChevronUp size={14} className="text-slate-400" />
            : <ChevronDown size={14} className="text-slate-400" />
          }
        </div>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          <textarea
            value={state.context}
            onChange={e => onContextChange.set(e.target.value)}
            placeholder={placeholder}
            rows={4}
            disabled={isRunning}
            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-slate-800 placeholder-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3] resize-y disabled:opacity-50 disabled:bg-slate-50"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onRun}
              disabled={isRunning}
              className={`flex items-center gap-2 h-8 px-4 rounded-lg text-xs font-semibold transition-colors ${
                isRunning
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-[#2196F3] text-white hover:bg-[#1565C0]'
              }`}
            >
              {isRunning
                ? <><Loader size={11} className="animate-spin" /> Running…</>
                : <><Zap size={11} /> Run A{id}</>
              }
            </button>
            {isDone && (
              <button
                onClick={() => navigator.clipboard?.writeText(state.output)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 text-xs text-slate-400 hover:text-[#2196F3] hover:border-[#2196F3]/30 transition-colors"
              >
                <Copy size={10} /> Copy
              </button>
            )}
            {isDone && onSaveTemplate && (
              <button
                onClick={async () => {
                  if (saving || saved) return;
                  setSaving(true);
                  await onSaveTemplate(id, name, state.output, state.context);
                  setSaving(false);
                  setSaved(true);
                  setTimeout(() => setSaved(false), 2500);
                }}
                disabled={saving}
                className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-colors ${
                  saved
                    ? 'border-emerald-200 text-emerald-600 bg-emerald-50'
                    : 'border-slate-200 text-slate-400 hover:text-violet-600 hover:border-violet-200 hover:bg-violet-50'
                }`}
              >
                {saved ? <><CheckCircle2 size={10} /> Saved!</> : '⭐ Save template'}
              </button>
            )}
            {(isDone || isError) && (
              <button
                onClick={onContextChange.reset}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Reset
              </button>
            )}
          </div>

          {isError && (
            <div className="text-xs text-red-600 border border-red-200 rounded-lg px-3 py-2 bg-red-50">
              {state.error}
            </div>
          )}

          {isDone && state.output && (
            <OutputPanel output={state.output} agentName={name} />
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function AgentNetwork() {
  const [niche,         setNiche]         = useState('roofing contractors');
  const [location,      setLocation]      = useState('');
  const [extra,         setExtra]         = useState('');
  const [agentState,    setAgentState]    = useState(initPipelineState());
  const [demandState,   setDemandState]   = useState(initDemandState());
  const [log,           setLog]           = useState([]);
  const [expanded,      setExpanded]      = useState(null);
  const [running,       setRunning]       = useState(false);
  const [finished,      setFinished]      = useState(false);
  const [importing,     setImporting]     = useState(false);
  const [importResult,  setImportResult]  = useState(null);
  const [emailQueued,   setEmailQueued]   = useState(false);
  const [emailQueuing,  setEmailQueuing]  = useState(false);
  const [batchRunning,  setBatchRunning]  = useState(false);
  const [batchResult,   setBatchResult]   = useState(null);

  const addLog = (msg) => setLog(p => [...p, {
    t: new Date().toLocaleTimeString('en-US', { hour12: false }), msg,
  }]);

  // ── Pipeline run ──────────────────────────────────────────────────────────────
  const handleStatusChange = (id, status, output = '', error = '') => {
    setAgentState(p => ({ ...p, [id]: { status, output: output || '', error: error || '' } }));
    if (status === 'done')    addLog(`[A${id}] ${AGENT_META[id].name} — complete`);
    if (status === 'running') addLog(`[A${id}] ${AGENT_META[id].name} — started`);
    if (status === 'error')   addLog(`[A${id}] ${AGENT_META[id].name} — ERROR: ${error}`);
  };

  const run = async () => {
    if (running) return;
    setRunning(true);
    setFinished(false);
    setExpanded(null);
    setLog([]);
    setAgentState(initPipelineState());
    addLog('System initialized');

    const { data: runRow } = isSupabaseConfigured() && supabase
      ? await supabase.from('runs').insert({ niche, location, extra_context: extra || null, status: 'running' }).select().single()
      : { data: null };

    const runId = runRow?.id;
    const finalOutputs = {};

    const wrappedStatusChange = (id, status, output = '', error = '') => {
      handleStatusChange(id, status, output, error);
      if ((status === 'done' || status === 'error') && runId && isSupabaseConfigured() && supabase) {
        finalOutputs[id] = { status, output, error };
        supabase.from('agent_outputs').insert({
          run_id: runId, agent_id: id, agent_name: AGENT_META[id].name,
          output: output || null, status,
        });
      }
    };

    await runAllAgents({ niche, location, extraContext: extra }, SYSTEM_PROMPTS, wrappedStatusChange, addLog);

    if (runId && isSupabaseConfigured() && supabase) {
      const hasError = Object.values(finalOutputs).some(o => o.status === 'error');
      await supabase.from('runs').update({ status: hasError ? 'error' : 'complete' }).eq('id', runId);
    }

    setRunning(false);
    setFinished(true);
  };

  // ── On-demand agent run ───────────────────────────────────────────────────────
  const handleDemandRun = async (id) => {
    const context = demandState[id]?.context;
    setDemandState(p => ({ ...p, [id]: { ...p[id], status: 'running', output: '', error: '' } }));

    const onStatus = (agentId, status, output = '', error = '') => {
      setDemandState(p => ({ ...p, [agentId]: { ...p[agentId], status, output, error } }));
    };

    const userMsg = context?.trim()
      ? context
      : `Run this agent with your best judgment for a Google Ads agency targeting local service businesses in the US.`;

    await callAgent(id, SYSTEM_PROMPTS[id], userMsg, onStatus);
  };

  const setDemandContext = (id, value) =>
    setDemandState(p => ({ ...p, [id]: { ...p[id], context: value } }));

  const toggleDemand = (id) =>
    setDemandState(p => ({ ...p, [id]: { ...p[id], expanded: !p[id].expanded } }));

  const resetDemand = (id) =>
    setDemandState(p => ({ ...p, [id]: { ...p[id], status: 'idle', output: '', error: '' } }));

  const handleSaveTemplate = async (agentId, agentName, content, context) => {
    if (!isSupabaseConfigured() || !supabase) return;
    // Extract niche/location hints from context if present
    const nicheMatch    = context?.match(/niche:\s*([^\n]+)/i);
    const locationMatch = context?.match(/location:\s*([^\n]+)/i);
    const templateName  = `${agentName} — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    await supabase.from('agent_templates').insert({
      agent_id:   agentId,
      agent_name: agentName,
      name:       templateName,
      content,
      niche:    nicheMatch?.[1]?.trim()    || niche    || null,
      location: locationMatch?.[1]?.trim() || location || null,
    });
  };

  // ── Computed ──────────────────────────────────────────────────────────────────
  const completedCount = Object.values(agentState).filter(a => a.status === 'done').length;
  const errorCount     = Object.values(agentState).filter(a => a.status === 'error').length;

  const handleImport = async () => {
    const agent1Output = agentState[1]?.output;
    if (!agent1Output) return;
    setImporting(true);
    setImportResult(null);
    const result = await importProspectsFromAgent1(agent1Output, {
      niche, location, supabase: isSupabaseConfigured() ? supabase : null,
    });
    setImportResult(result);
    setImporting(false);
  };

  const handleQueueEmail = async () => {
    const agent3Output = agentState[3]?.output;
    if (!agent3Output) return;
    setEmailQueuing(true);
    const parsed = parseAgent3Email(agent3Output);
    if (parsed && isSupabaseConfigured() && supabase) {
      await supabase.from('email_queue').insert({
        to_name: null, to_email: null,
        subject: parsed.subject, body: parsed.body, status: 'waiting_for_api',
      });
    }
    setEmailQueued(true);
    setEmailQueuing(false);
  };

  const handleBatchPersonalize = async () => {
    const agent1Output = agentState[1]?.output;
    if (!agent1Output || batchRunning) return;
    setBatchRunning(true);
    setBatchResult(null);
    const lines = agent1Output.split('\n').filter(l => l.match(/\*\*[A-Z]/i));
    const prospectNames = lines.slice(0, 8).map(l => {
      const m = l.match(/\*\*([^*]+)\*\*/);
      return { company_name: m?.[1]?.trim() || l.trim() };
    });
    const result = await batchPersonalize(
      prospectNames.length ? prospectNames : [{ company_name: 'Target Business' }],
      niche, location
    );
    setBatchResult(result);
    setBatchRunning(false);
  };

  const inputClass = "w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3] transition-colors disabled:opacity-50 disabled:bg-slate-50";

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Agent Network</h1>
        <p className="text-sm text-slate-500 mt-1">17 agents · pipeline + on-demand · full campaign automation</p>
      </div>

      {/* Agent count overview */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 text-center">
          <div className="text-2xl font-bold text-[#2196F3]">7</div>
          <div className="text-xs text-slate-400 mt-0.5">Pipeline agents</div>
          <div className="text-[10px] text-slate-300 mt-0.5">A1–A7 · 4 waves</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 text-center">
          <div className="text-2xl font-bold text-violet-600">10</div>
          <div className="text-xs text-slate-400 mt-0.5">On-demand agents</div>
          <div className="text-[10px] text-slate-300 mt-0.5">A8–A17 · trigger anytime</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 text-center">
          <div className="text-2xl font-bold text-[#F97316]">17</div>
          <div className="text-xs text-slate-400 mt-0.5">Total specialists</div>
          <div className="text-[10px] text-slate-300 mt-0.5">full agency automation</div>
        </div>
      </div>

      {/* Demo mode banner */}
      {isDemoMode() && (
        <div className="mb-5 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
          <AlertTriangle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-amber-800">Demo mode — sample outputs</div>
            <div className="text-xs text-amber-700 mt-0.5">
              No Anthropic API key detected. Pipeline agents run with pre-built example outputs.
              Add <code className="font-mono font-semibold">VITE_ANTHROPIC_API_KEY</code> to .env to run live.
            </div>
          </div>
        </div>
      )}

      {/* ─── SECTION 1: Campaign Pipeline (A1–A7) ─────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-widest">Campaign Pipeline</span>
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400">A1–A7 · 4 waves</span>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-5">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-4">Campaign settings</div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Niche</label>
              <select value={niche} onChange={e => setNiche(e.target.value)} disabled={running} className={inputClass}>
                {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Location</label>
              <CitySearch value={location} onChange={setLocation} disabled={running} />
            </div>
          </div>
          <div className="mb-5">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Additional context</label>
            <input
              value={extra} onChange={e => setExtra(e.target.value)} disabled={running}
              placeholder="budget range, target job size, specific services..."
              className={inputClass}
            />
          </div>
          <button
            onClick={run} disabled={running}
            className={`w-full flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-medium transition-colors ${
              running ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-[#2196F3] text-white hover:bg-[#1565C0]'
            }`}
          >
            {running
              ? <><Loader size={14} className="animate-spin" /> Running — {completedCount}/7 complete{errorCount > 0 ? ` · ${errorCount} error` : ''}</>
              : <><Play size={14} /> {finished ? 'Run again' : 'Run all 7 pipeline agents'}</>
            }
          </button>
        </div>

        {/* Waves */}
        <div className="space-y-5">
          {WAVES.map((waveAgents, wi) => (
            <div key={wi}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-widest whitespace-nowrap">{WAVE_LABELS[wi]}</span>
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-300 font-medium">{waveAgents.map(id => `A${id}`).join(' + ')}</span>
              </div>
              <div className={`grid gap-3 ${waveAgents.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {waveAgents.map(id => {
                  const meta   = AGENT_META[id];
                  const state  = agentState[id];
                  const Icon   = meta.icon;
                  const isExp  = expanded === id;
                  const isDone = state.status === 'done';
                  const isErr  = state.status === 'error';
                  const isRun  = state.status === 'running';
                  const style  = doneCardStyle[meta.color];
                  return (
                    <div key={id} className={`rounded-xl border p-4 transition-all duration-200 ${
                      isDone ? style.card : isErr ? 'border-red-200 bg-red-50' :
                      isRun ? 'border-[#2196F3]/30 bg-[#EEF6FE]' : 'border-slate-200 bg-white'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isDone ? style.icon : isRun ? 'bg-[#2196F3]/10 text-[#2196F3]' : 'bg-slate-100 text-slate-400'
                          }`}>
                            <Icon size={15} />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-800">A{id} · {meta.name}</div>
                            <StatusDot status={state.status} />
                          </div>
                        </div>
                        {isDone && (
                          <button
                            onClick={() => setExpanded(isExp ? null : id)}
                            className="text-xs font-medium text-slate-400 hover:text-[#2196F3] transition-colors px-2 py-1 rounded-lg border border-transparent hover:border-slate-200 hover:bg-white"
                          >
                            {isExp ? 'Close' : 'View ↓'}
                          </button>
                        )}
                      </div>
                      {meta.deps.length > 0 && (
                        <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 text-xs text-slate-400">
                          ← receives: {meta.deps.map(d => `A${d}`).join(', ')}
                        </div>
                      )}
                      {isErr && (
                        <div className="mt-2.5 pt-2.5 border-t border-red-200 text-xs text-red-500">{state.error}</div>
                      )}
                      {isExp && isDone && <OutputPanel output={state.output} agentName={meta.name} />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Post-run actions */}
        {finished && agentState[1]?.status === 'done' && (
          <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-800">Import prospects to Pipeline</div>
              <div className="text-xs text-slate-400 mt-0.5">Agent 1 found prospects — parse and add to your CRM</div>
            </div>
            {importResult
              ? <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 flex-shrink-0"><CheckCircle2 size={14} /> {importResult.imported > 0 ? `${importResult.imported} imported` : (importResult.error || 'None found')}</span>
              : <button onClick={handleImport} disabled={importing} className="flex-shrink-0 flex items-center gap-2 h-9 px-4 rounded-lg bg-[#1B3A5C] text-white text-sm font-medium hover:bg-[#243E6A] transition-colors disabled:opacity-50">
                  {importing ? <><Loader size={13} className="animate-spin" /> Importing…</> : <><Download size={13} /> Import to Pipeline</>}
                </button>
            }
          </div>
        )}
        {finished && agentState[3]?.status === 'done' && !emailQueued && (
          <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-800">Queue outreach email</div>
              <div className="text-xs text-slate-400 mt-0.5">Add Agent 3's best variant to email queue</div>
            </div>
            <button onClick={handleQueueEmail} disabled={emailQueuing} className="flex-shrink-0 flex items-center gap-2 h-9 px-4 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-50">
              {emailQueuing ? <><Loader size={13} className="animate-spin" /> Queuing…</> : <><Mail size={13} /> Queue Email</>}
            </button>
          </div>
        )}
        {emailQueued && (
          <div className="mt-4 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-violet-600 flex-shrink-0" />
            <span className="text-sm font-medium text-violet-700">Email queued — view in Pipeline or connect Resend to send</span>
          </div>
        )}
        {finished && agentState[1]?.status === 'done' && !batchResult && (
          <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-800">Batch personalize all prospects</div>
              <div className="text-xs text-slate-400 mt-0.5">A9 writes a unique cold email for every prospect A1 found</div>
            </div>
            <button onClick={handleBatchPersonalize} disabled={batchRunning} className="flex-shrink-0 flex items-center gap-2 h-9 px-4 rounded-lg bg-[#1B3A5C] text-white text-sm font-medium hover:bg-[#243E6A] transition-colors disabled:opacity-50">
              {batchRunning ? <><Loader size={13} className="animate-spin" /> Writing…</> : <><Users size={13} /> Personalize All</>}
            </button>
          </div>
        )}
        {batchResult && (
          <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">Batch emails ready</span>
              <button onClick={() => navigator.clipboard?.writeText(batchResult)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#2196F3] transition-colors">
                <Copy size={11} /> Copy all
              </button>
            </div>
            <div className="p-4 max-h-64 overflow-y-auto">
              <pre className="text-xs text-slate-600 font-mono whitespace-pre-wrap leading-relaxed">{batchResult}</pre>
            </div>
          </div>
        )}

        {/* Activity log */}
        {log.length > 0 && (
          <div className="mt-5 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-200">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Activity log</span>
            </div>
            <div className="p-4 max-h-48 overflow-y-auto space-y-1 bg-slate-900 rounded-b-xl">
              {log.map((l, i) => (
                <div key={i} className="text-xs font-mono flex gap-3">
                  <span className="text-slate-600 flex-shrink-0">{l.t}</span>
                  <span className={
                    l.msg.includes('ERROR') ? 'text-red-400' :
                    l.msg.includes('complete') || l.msg.includes('All agents') ? 'text-emerald-400' :
                    l.msg.includes('started') ? 'text-[#2196F3]' :
                    l.msg.includes('initialized') ? 'text-[#F97316]' : 'text-slate-400'
                  }>{l.msg}</span>
                </div>
              ))}
              {finished && (
                <div className="text-xs font-mono text-emerald-400 pt-1 border-t border-slate-800 mt-1">
                  ■ All agents complete — click any card to view output · saved to history
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── SECTION 2: On-Demand Agents (A8–A17) ─────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-widest">On-Demand Agents</span>
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400">A8–A17 · trigger anytime</span>
        </div>

        <div className="space-y-6">
          {DEMAND_GROUPS.map(group => (
            <div key={group.label}>
              {/* Group label */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-semibold uppercase tracking-widest ${group.color}`}>{group.label}</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              <div className="space-y-2">
                {group.agents.map(agent => (
                  <DemandCard
                    key={agent.id}
                    agent={{ ...agent, group: group.label }}
                    state={demandState[agent.id]}
                    groupBadge={group.badge}
                    onContextChange={{
                      toggle: () => toggleDemand(agent.id),
                      set:    (v) => setDemandContext(agent.id, v),
                      reset:  () => resetDemand(agent.id),
                    }}
                    onRun={() => handleDemandRun(agent.id)}
                    onSaveTemplate={handleSaveTemplate}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
