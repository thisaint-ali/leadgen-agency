import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Users, DollarSign, TrendingUp, Zap, Mail, FileText,
  CheckCircle2, Clock, AlertTriangle, ArrowRight, ChevronDown,
  Bot, BarChart2, Send, RefreshCw, Activity,
} from 'lucide-react';
import ClientMap from '../components/ClientMap';

const PERIODS = [
  { id: 'week',  label: 'This week',  calc: mrr => Math.round(mrr / 4.33) },
  { id: 'month', label: 'This month', calc: mrr => mrr },
  { id: 'year',  label: 'This year',  calc: mrr => mrr * 12 },
];

// ─── Mini stat tile ────────────────────────────────────────────────────────────
function StatTile({ label, value, sub, icon: Icon, color = 'text-slate-700', loading }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3.5">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={13} className={color} />
        <span className="text-xs text-slate-400 font-medium">{label}</span>
      </div>
      {loading
        ? <div className="h-7 w-20 bg-slate-100 rounded animate-pulse" />
        : <div className={`text-2xl font-bold leading-none ${color}`}>{value}</div>
      }
      {sub && <div className="text-[11px] text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

// ─── Pipeline funnel bar ───────────────────────────────────────────────────────
function FunnelBar({ stages, total }) {
  const colors = {
    new:         'bg-slate-300',
    contacted:   'bg-blue-300',
    replied:     'bg-amber-400',
    call_booked: 'bg-violet-400',
    proposal:    'bg-orange-400',
    client:      'bg-emerald-500',
  };
  const labels = {
    new: 'New', contacted: 'Contacted', replied: 'Replied',
    call_booked: 'Call', proposal: 'Proposal', client: 'Client',
  };
  return (
    <div className="flex gap-1 h-2.5 rounded-full overflow-hidden w-full">
      {stages.map(({ id, count }) => {
        const pct = total > 0 ? (count / total) * 100 : 0;
        if (pct === 0) return null;
        return (
          <div
            key={id}
            className={`${colors[id] || 'bg-slate-200'} rounded-full transition-all`}
            style={{ width: `${pct}%` }}
            title={`${labels[id]}: ${count}`}
          />
        );
      })}
    </div>
  );
}

// ─── Automation log item ───────────────────────────────────────────────────────
function AutoLogItem({ item }) {
  const icons = {
    contract_signed:        { icon: FileText,    color: 'text-violet-600 bg-violet-50' },
    email_queue_processed:  { icon: Send,        color: 'text-blue-600 bg-blue-50'    },
    proposal_generated:     { icon: FileText,    color: 'text-orange-600 bg-orange-50' },
    contract_generated:     { icon: FileText,    color: 'text-slate-600 bg-slate-50'  },
    onboarding_email_sent:  { icon: Mail,        color: 'text-emerald-600 bg-emerald-50' },
    stripe_payment_received:{ icon: DollarSign,  color: 'text-emerald-600 bg-emerald-50' },
    stripe_payment_failed:  { icon: AlertTriangle, color: 'text-red-600 bg-red-50'   },
    weekly_report_sent:     { icon: BarChart2,   color: 'text-teal-600 bg-teal-50'   },
  };
  const meta = icons[item.trigger_type] || { icon: Activity, color: 'text-slate-600 bg-slate-50' };
  const Icon = meta.icon;
  const timeAgo = (() => {
    const diff = Date.now() - new Date(item.created_at);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor(diff / 60000);
    if (h > 23) return `${Math.floor(h/24)}d ago`;
    if (h > 0)  return `${h}h ago`;
    return `${m}m ago`;
  })();

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
        <Icon size={12} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-700 leading-relaxed">{item.action_taken}</div>
        <div className="text-[10px] text-slate-400 mt-0.5">{timeAgo}</div>
      </div>
      {item.status === 'error' && (
        <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full flex-shrink-0">error</span>
      )}
    </div>
  );
}

// ─── Quick action cards ────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { id: 'bigbot',   label: 'Big Bot',       desc: 'Autonomous insights & automation',  color: 'bg-[#1B3A5C]', dot: true  },
  { id: 'pipeline', label: 'Pipeline',      desc: 'Manage prospects & clients',        color: 'bg-[#2196F3]', dot: false },
  { id: 'agents',   label: 'Agent Network', desc: 'Run all 17 AI agents',              color: 'bg-violet-600', dot: false },
  { id: 'contracts',label: 'Contracts',     desc: 'Proposals, contracts & signing',   color: 'bg-orange-500', dot: false },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

export default function Dashboard({ onNavigate }) {
  const [loading,       setLoading]       = useState(true);
  const [period,        setPeriod]        = useState('month');
  const [dropOpen,      setDropOpen]      = useState(false);
  const dropRef = useRef(null);

  // Data
  const [clients,       setClients]       = useState([]);
  const [prospects,     setProspects]     = useState([]);
  const [contracts,     setContracts]     = useState([]);
  const [emailQueue,    setEmailQueue]    = useState({ sent: 0, pending: 0, failed: 0 });
  const [automationLog, setAutomationLog] = useState([]);
  const [bigBotLast,    setBigBotLast]    = useState(null);
  const [urgentCount,   setUrgentCount]   = useState(0);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) { setLoading(false); return; }

    const [
      prospectsRes, contractsRes, emailRes,
      automationRes, bigBotRes, insightsRes,
    ] = await Promise.all([
      supabase.from('prospects').select('id,company_name,location,monthly_value,status,updated_at'),
      supabase.from('contracts').select('id,status,monthly_retainer,signed_at,campaign_triggered').order('created_at', { ascending: false }).limit(50),
      supabase.from('email_queue').select('status').limit(500),
      supabase.from('automation_log').select('*').order('created_at', { ascending: false }).limit(15),
      supabase.from('bigbot_runs').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('bigbot_insights').select('id,priority').eq('dismissed', false).limit(100),
    ]);

    const allProspects = prospectsRes.data || [];
    const allContracts = contractsRes.data || [];
    const emails       = emailRes.data || [];

    setProspects(allProspects);
    setClients(allProspects.filter(p => p.status === 'client'));
    setContracts(allContracts);
    setEmailQueue({
      sent:    emails.filter(e => e.status === 'sent').length,
      pending: emails.filter(e => ['pending','waiting_for_api'].includes(e.status)).length,
      failed:  emails.filter(e => e.status === 'failed').length,
    });
    setAutomationLog(automationRes.data || []);
    setBigBotLast(bigBotRes.data || null);
    setUrgentCount((insightsRes.data || []).filter(i => i.priority === 1).length);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Computed values ──────────────────────────────────────────────────────────
  const mrr = clients.reduce((sum, c) => sum + (Number(c.monthly_value) || 0), 0);
  const contractMrr = contracts
    .filter(c => c.status === 'signed')
    .reduce((sum, c) => sum + (Number(c.monthly_retainer) || 0), 0);
  const totalMrr = Math.max(mrr, contractMrr);

  const activePeriod = PERIODS.find(p => p.id === period) || PERIODS[1];
  const revenue = activePeriod.calc(totalMrr);

  const pipelineValue = prospects
    .filter(p => !['new','client','dead'].includes(p.status))
    .reduce((sum, p) => sum + (Number(p.monthly_value) || 2500), 0);

  const STAGE_IDS = ['new','contacted','replied','call_booked','proposal','client'];
  const stageCounts = STAGE_IDS.map(id => ({
    id,
    count: prospects.filter(p => p.status === id).length,
  }));

  const signedContracts  = contracts.filter(c => c.status === 'signed');
  const pendingContracts = contracts.filter(c => c.status === 'sent');

  const lastBotTime = bigBotLast?.created_at
    ? new Date(bigBotLast.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">AMA Leads — full automation overview</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-500 text-xs font-medium hover:bg-slate-50 transition-colors"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* ── Revenue + Clients row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-4">

        {/* MRR tile */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DollarSign size={14} className="text-slate-400" />
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Revenue</span>
            </div>
            <div className="relative" ref={dropRef}>
              <button
                onClick={() => setDropOpen(d => !d)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-100 transition-colors"
              >
                {activePeriod.label}
                <ChevronDown size={11} className={`transition-transform ${dropOpen ? 'rotate-180' : ''}`} />
              </button>
              {dropOpen && (
                <div className="absolute right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-20 min-w-[130px]">
                  {PERIODS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setPeriod(p.id); setDropOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                        period === p.id ? 'text-[#2196F3] bg-[#EEF6FE]' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {loading
            ? <div className="h-12 w-32 bg-slate-100 rounded-lg animate-pulse" />
            : <div className="text-5xl font-bold text-[#2196F3] leading-none">${revenue.toLocaleString()}</div>
          }
          <div className="text-xs text-slate-400 mt-2">
            {!loading && (totalMrr > 0
              ? `$${totalMrr.toLocaleString()}/mo MRR · ${activePeriod.label.toLowerCase()}`
              : 'No active clients yet')}
          </div>
        </div>

        {/* Clients tile */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} className="text-slate-400" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Active clients</span>
          </div>
          {loading
            ? <div className="h-12 w-16 bg-slate-100 rounded-lg animate-pulse" />
            : <div className="text-5xl font-bold text-slate-900 leading-none">{clients.length}</div>
          }
          <div className="text-xs text-slate-400 mt-2">
            {!loading && `${signedContracts.length} signed contracts · ${pendingContracts.length} awaiting sig.`}
          </div>
        </div>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatTile
          label="Pipeline value"
          value={pipelineValue ? `$${pipelineValue.toLocaleString()}` : '$0'}
          sub={`${prospects.filter(p => !['new','client','dead'].includes(p.status)).length} active prospects`}
          icon={TrendingUp}
          color="text-violet-600"
          loading={loading}
        />
        <StatTile
          label="Emails sent"
          value={emailQueue.sent}
          sub={`${emailQueue.pending} pending · ${emailQueue.failed} failed`}
          icon={Send}
          color="text-blue-600"
          loading={loading}
        />
        <StatTile
          label="Big Bot"
          value={lastBotTime || 'Never'}
          sub={urgentCount > 0 ? `${urgentCount} urgent insight${urgentCount !== 1 ? 's' : ''}` : 'all clear'}
          icon={Bot}
          color={urgentCount > 0 ? 'text-red-600' : 'text-emerald-600'}
          loading={loading}
        />
        <StatTile
          label="Contracts"
          value={contracts.length}
          sub={`${signedContracts.filter(c => !c.campaign_triggered).length} needs campaign`}
          icon={FileText}
          color="text-[#F97316]"
          loading={loading}
        />
      </div>

      {/* ── Pipeline funnel ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Pipeline funnel</span>
          <button
            onClick={() => onNavigate('pipeline')}
            className="flex items-center gap-1 text-xs text-[#2196F3] hover:underline"
          >
            Open Pipeline <ArrowRight size={10} />
          </button>
        </div>
        <FunnelBar stages={stageCounts} total={prospects.length} />
        <div className="flex gap-3 mt-3 flex-wrap">
          {stageCounts.map(({ id, count }) => {
            const labels = { new: 'New', contacted: 'Contacted', replied: 'Replied', call_booked: 'Call Booked', proposal: 'Proposal', client: 'Client' };
            const colors = { new: 'bg-slate-300', contacted: 'bg-blue-300', replied: 'bg-amber-400', call_booked: 'bg-violet-400', proposal: 'bg-orange-400', client: 'bg-emerald-500' };
            return (
              <div key={id} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className={`w-2 h-2 rounded-full ${colors[id]}`} />
                {labels[id]}: <strong className="text-slate-700">{count}</strong>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Client map ─────────────────────────────────────────────────────────── */}
      {clients.length > 0 && (
        <div className="mb-5">
          <ClientMap clients={clients} />
        </div>
      )}

      {/* ── Automation log + Big Bot alerts ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">

        {/* Automation log */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={13} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">Recent automation</span>
            </div>
            <button onClick={() => onNavigate('bigbot')} className="text-[10px] text-[#2196F3] hover:underline">view all →</button>
          </div>
          <div className="px-4 divide-y divide-slate-50">
            {loading
              ? [1,2,3].map(i => <div key={i} className="py-3 h-10 bg-slate-50 rounded animate-pulse my-1" />)
              : automationLog.length === 0
                ? <div className="py-8 text-center text-xs text-slate-400">No automation events yet</div>
                : automationLog.slice(0, 8).map(item => <AutoLogItem key={item.id} item={item} />)
            }
          </div>
        </div>

        {/* Big Bot status + alerts */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot size={13} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">Big Bot status</span>
            </div>
            <button onClick={() => onNavigate('bigbot')} className="text-[10px] text-[#2196F3] hover:underline">open →</button>
          </div>
          <div className="p-4 space-y-3">

            {/* Last run */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1.5"><Clock size={11} /> Last run</span>
              <span className="font-medium text-slate-700">{lastBotTime || 'Not run yet'}</span>
            </div>

            {/* Urgent insights */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1.5"><Zap size={11} /> Urgent insights</span>
              <span className={`font-semibold ${urgentCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {urgentCount > 0 ? `${urgentCount} need action` : 'All clear'}
              </span>
            </div>

            {/* Email queue */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1.5"><Mail size={11} /> Email queue</span>
              <span className={`font-medium ${emailQueue.pending > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                {emailQueue.pending > 0 ? `${emailQueue.pending} pending` : `${emailQueue.sent} sent`}
              </span>
            </div>

            {/* Contracts awaiting campaign */}
            {signedContracts.filter(c => !c.campaign_triggered).length > 0 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
                <span>{signedContracts.filter(c => !c.campaign_triggered).length} signed contract(s) waiting for campaign build</span>
              </div>
            )}

            {/* Automation rules active */}
            <div className="pt-1 border-t border-slate-100 space-y-1.5">
              {[
                { label: 'Email queue auto-processor', active: true },
                { label: 'Weekly reports (Mondays)', active: true },
                { label: 'Performance sync', active: true },
                { label: 'Contract → Campaign trigger', active: true },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-2 text-[11px]">
                  <CheckCircle2 size={10} className="text-emerald-500 flex-shrink-0" />
                  <span className="text-slate-500">{r.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick actions ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Quick access</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {QUICK_ACTIONS.map(({ id, label, desc, color, dot }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-left hover:border-[#2196F3]/40 hover:shadow-md transition-all"
          >
            <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center mb-3`}>
              {dot && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
            </div>
            <div className="text-sm font-semibold text-slate-900 mb-1">{label}</div>
            <div className="text-[11px] text-slate-400 leading-relaxed">{desc}</div>
          </button>
        ))}
      </div>

    </div>
  );
}
