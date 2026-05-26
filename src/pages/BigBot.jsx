import { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, Play, RefreshCw, AlertTriangle, CheckCircle2, Clock, Zap,
         ChevronRight, X, TrendingUp, Mail, Shield, Cpu, BarChart2, Loader,
         FileText, PenLine, BarChart, Repeat, Settings, ToggleLeft, ToggleRight } from 'lucide-react';
import { runBigBot, getBigBotStatus, dismissInsight, markApplied } from '../agents/bigBotEngine';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const DEMO_MODE = !API_KEY || API_KEY === 'your_anthropic_key_here';

// ─── BigBot Config Panel ──────────────────────────────────────────────────────
const CONFIG_DEFAULTS = {
  stale_days: 7,
  check_contracts: true,
  check_stale_proposals: true,
  monday_reports: true,
  send_emails: true,
  max_emails_per_run: 10,
};

function ConfigPanel() {
  const [config,  setConfig]  = useState(CONFIG_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [open,    setOpen]    = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!isSupabaseConfigured() || !supabase) { setLoading(false); return; }
    supabase.from('bigbot_config').select('*').eq('id', 1).maybeSingle()
      .then(({ data }) => { if (data) setConfig(data); setLoading(false); });
  }, [open]);

  const toggle = async (key) => {
    const next = { ...config, [key]: !config[key] };
    setConfig(next);
    await persist(next);
  };

  const setNum = (key, val) => setConfig(c => ({ ...c, [key]: Number(val) }));

  const persist = async (cfg) => {
    if (!isSupabaseConfigured() || !supabase) return;
    setSaving(true);
    await supabase.from('bigbot_config').upsert({ id: 1, ...cfg, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const TOGGLES = [
    { key: 'check_contracts',       label: 'Check expiring contracts',  desc: 'Alerts when contracts expire within 30 days' },
    { key: 'check_stale_proposals', label: 'Flag stale proposals',      desc: 'Marks proposals with no reply in 5+ days' },
    { key: 'monday_reports',        label: 'Monday report reminders',   desc: 'Weekly nudge to run Agent 13 reports' },
    { key: 'send_emails',           label: 'Auto-send follow-up emails',desc: 'Sends queued follow-ups via Resend when connected' },
  ];

  return (
    <div className="mb-5">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3.5 shadow-sm hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings size={14} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">BigBot Settings</span>
          {saved && <span className="text-[10px] font-semibold text-emerald-600">✓ Saved</span>}
        </div>
        <span className="text-xs text-slate-400">{open ? '▲ collapse' : '▼ expand'}</span>
      </button>

      {open && (
        <div className="bg-white border border-slate-200 border-t-0 rounded-b-xl px-4 py-4 shadow-sm">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-2"><Loader size={12} className="animate-spin" /> Loading config…</div>
          ) : (
            <div className="space-y-3">
              {/* Toggles */}
              {TOGGLES.map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-slate-700">{label}</div>
                    <div className="text-xs text-slate-400">{desc}</div>
                  </div>
                  <button onClick={() => toggle(key)} className="flex-shrink-0">
                    {config[key]
                      ? <ToggleRight size={22} className="text-[#2196F3]" />
                      : <ToggleLeft size={22} className="text-slate-300" />
                    }
                  </button>
                </div>
              ))}

              {/* Numeric inputs */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Stale threshold <span className="text-slate-300 font-normal">(days)</span>
                  </label>
                  <input
                    type="number" min={1} max={30} value={config.stale_days}
                    onChange={e => setNum('stale_days', e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Max emails / run
                  </label>
                  <input
                    type="number" min={1} max={50} value={config.max_emails_per_run}
                    onChange={e => setNum('max_emails_per_run', e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3] transition-colors"
                  />
                </div>
              </div>
              <button
                onClick={() => persist(config)}
                disabled={saving}
                className="w-full h-9 rounded-lg bg-[#1B3A5C] text-white text-sm font-medium hover:bg-[#243E6A] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <><Loader size={12} className="animate-spin" /> Saving…</> : 'Save settings'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TYPE_META = {
  error:        { label: 'Agent Error',    color: 'text-red-600 bg-red-50 border-red-200',       icon: Cpu,        dot: 'bg-red-500'    },
  pitch:        { label: 'Pitch',          color: 'text-violet-600 bg-violet-50 border-violet-200', icon: Mail,     dot: 'bg-violet-500' },
  pipeline:     { label: 'Pipeline',       color: 'text-blue-600 bg-blue-50 border-blue-200',     icon: TrendingUp, dot: 'bg-blue-500'   },
  health:       { label: 'Health',         color: 'text-amber-600 bg-amber-50 border-amber-200',  icon: Shield,     dot: 'bg-amber-500'  },
  campaign:     { label: 'Campaign',       color: 'text-teal-600 bg-teal-50 border-teal-200',     icon: BarChart2,  dot: 'bg-teal-500'   },
  optimization: { label: 'Optimization',  color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: Zap, dot: 'bg-emerald-500' },
};

const PRIORITY_META = {
  1: { label: 'Urgent',    ring: 'border-red-300',    dot: 'bg-red-500'    },
  2: { label: 'Important', ring: 'border-amber-300',  dot: 'bg-amber-400'  },
  3: { label: 'Low',       ring: 'border-slate-200',  dot: 'bg-slate-300'  },
};

const FILTERS = ['All', 'Urgent', 'Pipeline', 'Agents', 'Pitch', 'Health'];

function InsightCard({ insight, onDismiss, onApply }) {
  const type  = TYPE_META[insight.type]  || TYPE_META.health;
  const pri   = PRIORITY_META[insight.priority] || PRIORITY_META[2];
  const Icon  = type.icon;

  return (
    <div className={`bg-white rounded-xl border ${pri.ring} shadow-sm p-4 transition-all`}>
      <div className="flex items-start gap-3">
        {/* Priority dot */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${pri.dot}`} />

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${type.color}`}>
                <Icon size={10} />
                {type.label}
              </span>
              {insight.agent_id && (
                <span className="text-[10px] font-medium text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-full">
                  A{insight.agent_id}
                </span>
              )}
              <span className="text-[10px] text-slate-300">
                {new Date(insight.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
            </div>
          </div>

          {/* Title */}
          <div className="text-sm font-semibold text-slate-800 mb-1">{insight.title}</div>

          {/* Insight text */}
          <div className="text-xs text-slate-500 leading-relaxed mb-2">{insight.insight}</div>

          {/* Action */}
          {insight.action && (
            <div className="flex items-start gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
              <ChevronRight size={12} className="text-[#2196F3] flex-shrink-0 mt-0.5" />
              <span className="text-xs text-slate-600 leading-relaxed">{insight.action}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => onApply(insight.id)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#2196F3] text-white hover:bg-[#1565C0] transition-colors"
            >
              <CheckCircle2 size={11} /> Mark applied
            </button>
            <button
              onClick={() => onDismiss(insight.id)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <X size={11} /> Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BigBot() {
  const [status, setStatus]           = useState(null);   // { lastRun, insights }
  const [running, setRunning]         = useState(false);
  const [progress, setProgress]       = useState([]);
  const [filter, setFilter]           = useState('All');
  const [localInsights, setLocalInsights] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const autoRanRef = useRef(false);
  const bottomRef  = useRef(null);

  const load = useCallback(async () => {
    setLoadingStatus(true);
    const s = await getBigBotStatus();
    setStatus(s);
    setLocalInsights(s?.insights || []);
    setLoadingStatus(false);
    return s;
  }, []);

  useEffect(() => {
    load().then(s => {
      if (autoRanRef.current) return;
      autoRanRef.current = true;
      const lastRun = s?.lastRun?.created_at;
      const hourAgo = Date.now() - 60 * 60 * 1000;
      if (!lastRun || new Date(lastRun) < hourAgo) {
        handleRun('auto');
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRun = async (trigger = 'manual') => {
    if (running) return;
    setRunning(true);
    setProgress([]);

    const { insights, error } = await runBigBot({
      trigger,
      onProgress: (msg) => setProgress(p => [...p, msg]),
    });

    if (error) {
      setProgress(p => [...p, `Error: ${error}`]);
    } else {
      await load();
    }
    setRunning(false);
  };

  const handleDismiss = async (id) => {
    setLocalInsights(p => p.filter(i => i.id !== id));
    await dismissInsight(id);
  };

  const handleApply = async (id) => {
    setLocalInsights(p => p.filter(i => i.id !== id));
    await markApplied(id);
  };

  // Filter
  const filtered = localInsights.filter(i => {
    if (filter === 'All')      return true;
    if (filter === 'Urgent')   return i.priority === 1;
    if (filter === 'Pipeline') return i.type === 'pipeline';
    if (filter === 'Agents')   return i.type === 'error' || i.type === 'optimization';
    if (filter === 'Pitch')    return i.type === 'pitch';
    if (filter === 'Health')   return i.type === 'health' || i.type === 'campaign';
    return true;
  });

  const urgentCount    = localInsights.filter(i => i.priority === 1).length;
  const lastRunTime    = status?.lastRun?.created_at
    ? new Date(status.lastRun.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null;
  const lastRunStatus  = status?.lastRun?.status;
  const insightsThisRun = status?.lastRun?.insights_generated || 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1B3A5C] flex items-center justify-center">
            <Bot size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Big Bot</h1>
            <p className="text-xs text-slate-400 mt-0.5">24/7 autonomous supervisor · analyzes all agents, pipeline, and pitch performance</p>
          </div>
        </div>
        <button
          onClick={() => handleRun('manual')}
          disabled={running}
          className={`flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-colors ${
            running ? 'bg-slate-100 text-slate-400' : 'bg-[#1B3A5C] text-white hover:bg-[#243E6A]'
          }`}
        >
          {running
            ? <><Loader size={13} className="animate-spin" /> Analyzing…</>
            : <><Play size={13} /> Run now</>
          }
        </button>
      </div>

      {/* Demo mode banner */}
      {DEMO_MODE && (
        <div className="mb-5 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
          <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-800">
            <span className="font-semibold">Demo mode</span> — insights are sample outputs. Add <code className="font-mono font-semibold">VITE_ANTHROPIC_API_KEY</code> to .env for live analysis. Big Bot will auto-run every hour once connected.
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          {
            label: 'Last run',
            value: loadingStatus ? '…' : lastRunTime || 'Never',
            sub: lastRunStatus === 'complete' ? 'success' : lastRunStatus === 'error' ? 'error' : lastRunStatus === 'running' ? 'running' : '—',
            icon: Clock,
            color: 'text-slate-700',
          },
          {
            label: 'Active insights',
            value: loadingStatus ? '…' : localInsights.length,
            sub: urgentCount > 0 ? `${urgentCount} urgent` : 'none urgent',
            icon: Zap,
            color: urgentCount > 0 ? 'text-red-600' : 'text-slate-700',
          },
          {
            label: 'This run',
            value: loadingStatus ? '…' : insightsThisRun,
            sub: 'insights generated',
            icon: RefreshCw,
            color: 'text-[#2196F3]',
          },
          {
            label: 'Auto-runs',
            value: '1/hr',
            sub: isSupabaseConfigured() ? 'while app open' : 'needs Supabase',
            icon: Bot,
            color: 'text-emerald-600',
          },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-3 py-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon size={12} className={color} />
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{label}</span>
            </div>
            <div className={`text-lg font-bold ${color}`}>{value}</div>
            <div className="text-[10px] text-slate-400">{sub}</div>
          </div>
        ))}
      </div>

      {/* Running progress */}
      {running && progress.length > 0 && (
        <div className="mb-5 bg-slate-900 rounded-xl p-4 space-y-1">
          {progress.map((msg, i) => (
            <div key={i} className="text-xs font-mono text-emerald-400 flex items-center gap-2">
              <span className="text-slate-600 flex-shrink-0">{new Date().toLocaleTimeString('en-US', { hour12: false })}</span>
              {msg}
            </div>
          ))}
          <div className="flex items-center gap-2 text-xs font-mono text-[#2196F3] mt-1">
            <Loader size={11} className="animate-spin" />
            <span>Working…</span>
          </div>
        </div>
      )}

      {/* Config panel */}
      <ConfigPanel />

      {/* Automation Rules */}
      <div className="mb-5">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Automation rules — always running</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            {
              icon: PenLine,
              title: 'Contract signed → Campaign build',
              desc: 'When a client signs a contract, Agent 11 triggers campaign creation and Agent 12 sends the onboarding email automatically.',
              color: 'text-violet-600',
              bg: 'bg-violet-50',
            },
            {
              icon: Mail,
              title: 'Stale prospect → Follow-up email',
              desc: 'Big Bot flags prospects with no contact in 7+ days. Agents 8 sends personalized follow-up #2 and #3 from the Pipeline page.',
              color: 'text-blue-600',
              bg: 'bg-blue-50',
            },
            {
              icon: BarChart,
              title: 'Client signed → Weekly reports',
              desc: 'Every Monday, Agent 13 pulls Google Ads data, writes a client-facing report, and sends it via Resend automatically.',
              color: 'text-teal-600',
              bg: 'bg-teal-50',
            },
            {
              icon: Repeat,
              title: 'Big Bot runs every hour',
              desc: 'Big Bot analyzes all pipeline, email, and campaign data hourly while the app is open. Deploy the Edge Function for true 24/7.',
              color: 'text-emerald-600',
              bg: 'bg-emerald-50',
            },
          ].map(({ icon: Icon, title, desc, color, bg }) => (
            <div key={title} className={`flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5`}>
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={14} className={color} />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-800 mb-0.5">{title}</div>
                <div className="text-[11px] text-slate-400 leading-relaxed">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 mb-4 shadow-sm overflow-x-auto">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              filter === f ? 'bg-[#2196F3] text-white' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            {f}
            {f === 'Urgent' && urgentCount > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filter === 'Urgent' ? 'bg-white/25' : 'bg-red-100 text-red-600'}`}>
                {urgentCount}
              </span>
            )}
            {f === 'All' && localInsights.length > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filter === 'All' ? 'bg-white/25' : 'bg-slate-100 text-slate-500'}`}>
                {localInsights.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Insights feed */}
      {loadingStatus ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-8 justify-center">
          <Loader size={13} className="animate-spin" /> Loading insights…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Bot size={28} className="mx-auto text-slate-200 mb-3" />
          <div className="text-sm font-medium text-slate-500">
            {localInsights.length === 0
              ? "Big Bot hasn't run yet"
              : `No ${filter.toLowerCase()} insights`}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {localInsights.length === 0
              ? 'Click "Run now" above — Big Bot will analyze every part of your system'
              : 'Try switching filters or run Big Bot again for fresh analysis'}
          </div>
          {localInsights.length === 0 && (
            <button
              onClick={() => handleRun()}
              disabled={running}
              className="mt-4 inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#1B3A5C] text-white text-sm font-medium hover:bg-[#243E6A] transition-colors disabled:opacity-50"
            >
              <Play size={13} /> Analyze now
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(insight => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onDismiss={handleDismiss}
              onApply={handleApply}
            />
          ))}
        </div>
      )}

      {/* 24/7 footer note */}
      <div className="mt-8 text-center">
        <div className="text-xs text-slate-300">
          Big Bot auto-runs every hour while the app is open · runs from memory when closed
        </div>
        {!DEMO_MODE && (
          <div className="text-xs text-slate-300 mt-1">
            For true 24/7 (no browser needed): deploy <code className="font-mono">supabase/functions/bigbot-hourly</code>
          </div>
        )}
      </div>

      <div ref={bottomRef} />
    </div>
  );
}
