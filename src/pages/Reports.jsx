import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  FileText, Send, Check, Loader, RefreshCw, ChevronDown, ChevronUp,
  Plus, X, Clock, CheckCircle2, Eye, Mail, Trash2, AlertTriangle,
} from 'lucide-react';
import {
  generateWeeklyReport, generateOptimizationBrief,
  generateRetentionPlan, generateUpsellPitch,
  sendWeeklyReport,
} from '../agents/reportEngine';

const REPORT_TYPES = [
  { id: 'weekly',       label: 'Weekly Report',       agent: 13 },
  { id: 'optimization', label: 'Optimization Brief',  agent: 14 },
  { id: 'retention',    label: 'Retention Plan',      agent: 15 },
  { id: 'upsell',       label: 'Upsell Pitch',        agent: 16 },
];

const STATUS_CFG = {
  draft:  { label: 'Draft',  color: 'bg-slate-100 text-slate-600',    icon: Clock       },
  sent:   { label: 'Sent',   color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  viewed: { label: 'Viewed', color: 'bg-[#2196F3]/10 text-[#2196F3]', icon: Eye         },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Generate report modal ─────────────────────────────────────────────────────
function GenerateModal({ clients, onClose, onDone }) {
  const [clientId,    setClientId]    = useState(clients[0]?.id || '');
  const [reportType,  setReportType]  = useState('weekly');
  const [issue,       setIssue]       = useState('');
  const [working,     setWorking]     = useState(false);
  const [log,         setLog]         = useState([]);
  const [result,      setResult]      = useState(null);

  const client = clients.find(c => c.id === clientId);
  const addLog = msg => setLog(p => [...p, msg]);

  const generate = async () => {
    if (!client) return;
    setWorking(true); setLog([]); setResult(null);

    // Get campaign for this prospect
    let campaign = null;
    if (isSupabaseConfigured() && supabase) {
      const { data } = await supabase.from('campaigns').select('*').eq('prospect_id', client.id).single();
      campaign = data;
    }

    let res;
    try {
      if (reportType === 'weekly') {
        res = await generateWeeklyReport(client, campaign, addLog);
      } else if (reportType === 'optimization') {
        res = await generateOptimizationBrief(client, campaign, addLog);
      } else if (reportType === 'retention') {
        res = await generateRetentionPlan(client, campaign, issue || 'CPL above target, leads declining week over week', addLog);
      } else if (reportType === 'upsell') {
        res = await generateUpsellPitch(client, campaign, addLog);
      }
      setResult(res);
      if (res?.success) onDone?.();
    } catch (e) {
      addLog(`❌ ${e.message}`);
    }
    setWorking(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Generate Report</h3>
            <p className="text-xs text-slate-400 mt-0.5">Agents 13–16 write and store reports automatically</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {clients.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-500">
              No active clients yet. Move a prospect to "Client" status in Pipeline first.
            </div>
          ) : (
            <>
              {/* Client */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Client</label>
                <select value={clientId} onChange={e => setClientId(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3]">
                  {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>

              {/* Report type */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Report type</label>
                <div className="grid grid-cols-2 gap-2">
                  {REPORT_TYPES.map(t => (
                    <button key={t.id} onClick={() => setReportType(t.id)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-medium border text-left transition-colors ${reportType === t.id ? 'bg-[#2196F3] text-white border-[#2196F3]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      <div className={`text-[10px] mb-0.5 ${reportType === t.id ? 'text-white/70' : 'text-slate-400'}`}>Agent {t.agent}</div>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {reportType === 'retention' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Performance issue (optional)</label>
                  <textarea value={issue} onChange={e => setIssue(e.target.value)} rows={2}
                    placeholder="e.g. CPL spiked to $180, down from $90 last month…"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3]" />
                </div>
              )}

              {/* Log */}
              {log.length > 0 && (
                <div className="bg-slate-900 rounded-xl p-3 font-mono text-xs text-emerald-400 space-y-0.5 max-h-28 overflow-y-auto">
                  {log.map((l, i) => <div key={i}>{l}</div>)}
                </div>
              )}

              {/* Result */}
              {result?.content && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-xs text-slate-700 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {result.content}
                </div>
              )}

              {result?.success && (
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                  <Check size={14} /> Report saved to database
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                  {result?.success ? 'Close' : 'Cancel'}
                </button>
                {!result?.success && (
                  <button onClick={generate} disabled={working || !clientId}
                    className="flex-1 h-10 rounded-xl bg-[#2196F3] text-white text-sm font-medium hover:bg-[#1565C0] transition-colors disabled:opacity-50">
                    {working ? <span className="flex items-center justify-center gap-2"><Loader size={13} className="animate-spin" /> Generating…</span> : 'Generate'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Report card ───────────────────────────────────────────────────────────────
function ReportCard({ report, onSend, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);

  const cfg = STATUS_CFG[report.status] || STATUS_CFG.draft;
  const StatusIcon = cfg.icon;

  const typeLabel = REPORT_TYPES.find(t => t.id === report.report_type)?.label || 'Report';

  const subject = (() => {
    const match = report.content?.match(/SUBJECT:\s*(.*)/i);
    return match?.[1]?.trim() || `${report.company_name} — ${typeLabel}`;
  })();

  const preview = (report.content || '')
    .replace(/SUBJECT:.*\n?/i, '')
    .replace(/^---\s*\n?/m, '')
    .trim()
    .slice(0, 180);

  const handleSend = async () => {
    setSending(true);
    await onSend(report, subject);
    setSent(true);
    setSending(false);
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-slate-900 truncate">{report.company_name}</span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                <StatusIcon size={9} /> {cfg.label}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">{typeLabel}</span>
            </div>
            <div className="text-xs text-slate-400">
              {report.period_start && report.period_end
                ? `${fmtDate(report.period_start)} – ${fmtDate(report.period_end)}`
                : fmtDate(report.created_at)}
              {report.sent_at && <span className="ml-2">· Sent {fmtDate(report.sent_at)}</span>}
            </div>
          </div>
          <button onClick={() => setExpanded(v => !v)} className="text-slate-400 hover:text-slate-600 flex-shrink-0 mt-0.5">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {!expanded && (
          <p className="text-xs text-slate-500 mt-2 leading-relaxed line-clamp-2">{preview}…</p>
        )}

        {expanded && (
          <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3 font-mono text-xs text-slate-700 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
            {report.content}
          </div>
        )}

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
          <button onClick={() => onDelete(report.id)}
            className="flex items-center gap-1 text-xs text-slate-300 hover:text-red-400 transition-colors px-1">
            <Trash2 size={11} />
          </button>
          <div className="flex-1" />
          {sent ? (
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <Check size={11} /> Sent!
            </div>
          ) : (
            <button onClick={handleSend} disabled={sending}
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-[#2196F3] text-white text-xs font-medium hover:bg-[#1565C0] transition-colors disabled:opacity-50">
              {sending ? <><Loader size={10} className="animate-spin" /> Sending…</> : <><Mail size={10} /> {report.status === 'sent' ? 'Resend' : 'Send'}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function Reports() {
  const [reports,   setReports]   = useState([]);
  const [clients,   setClients]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showGen,   setShowGen]   = useState(false);
  const [filter,    setFilter]    = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    if (!isSupabaseConfigured() || !supabase) { setLoading(false); return; }
    const [reportsRes, clientsRes] = await Promise.all([
      supabase.from('client_reports').select('*').order('created_at', { ascending: false }),
      supabase.from('prospects').select('id,company_name,contact_name,email,niche,location').eq('status', 'client'),
    ]);
    setReports(reportsRes.data || []);
    setClients(clientsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSend = async (report, subject) => {
    // Find client email
    const client = clients.find(c => c.company_name === report.company_name) ||
      { email: null, contact_name: report.company_name };

    const body = (report.content || '')
      .replace(/SUBJECT:.*\n?/i, '')
      .replace(/^---\s*\n?/m, '')
      .trim();

    const result = await sendWeeklyReport(report.id, client, subject, body);
    if (result && !result.error) {
      setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: 'sent', sent_at: new Date().toISOString() } : r));
    }
    return result;
  };

  const handleDelete = async (id) => {
    if (!supabase) return;
    await supabase.from('client_reports').delete().eq('id', id);
    setReports(prev => prev.filter(r => r.id !== id));
  };

  // Stats
  const draftCount = reports.filter(r => r.status === 'draft').length;
  const sentCount  = reports.filter(r => r.status === 'sent').length;

  // Filter
  const filtered = reports.filter(r => {
    const statusOk = filter === 'all' || r.status === filter;
    const typeOk   = typeFilter === 'all' || r.report_type === typeFilter;
    return statusOk && typeOk;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Client Reports</h1>
          <p className="text-sm text-slate-500 mt-1">AI-generated weekly reports, optimization briefs &amp; retention plans</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setShowGen(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#2196F3] text-white text-sm font-medium hover:bg-[#1565C0] transition-colors">
            <Plus size={14} /> Generate report
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3.5">
          <div className="text-xs text-slate-400 font-medium mb-1">Total Reports</div>
          <div className="text-2xl font-bold text-slate-900">{reports.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3.5">
          <div className="text-xs text-slate-400 font-medium mb-1">Sent to Clients</div>
          <div className="text-2xl font-bold text-emerald-600">{sentCount}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3.5">
          <div className="text-xs text-slate-400 font-medium mb-1">Drafts Ready</div>
          <div className="text-2xl font-bold text-amber-600">{draftCount}</div>
        </div>
      </div>

      {/* No Resend warning */}
      {!import.meta.env.VITE_RESEND_API_KEY && (
        <div className="mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
          <span className="text-xs text-amber-700">
            <span className="font-semibold">Resend not connected</span> — reports will generate and save, but "Send" buttons won't email the client until you add <code className="font-mono bg-amber-100 px-1 rounded">VITE_RESEND_API_KEY</code> to Vercel.
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
          {['all', 'draft', 'sent'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${filter === f ? 'bg-[#2196F3] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1">
          <button onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${typeFilter === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            All types
          </button>
          {REPORT_TYPES.map(t => (
            <button key={t.id} onClick={() => setTypeFilter(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${typeFilter === t.id ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader size={18} className="animate-spin mr-2 text-[#2196F3]" /> Loading reports…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <FileText size={36} className="mx-auto text-slate-200 mb-3" />
          <div className="text-sm font-medium text-slate-500">
            {reports.length === 0 ? 'No reports generated yet' : 'No reports match your filters'}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {reports.length === 0 ? 'Click "Generate report" to write your first AI client report' : 'Try removing a filter'}
          </div>
          {reports.length === 0 && (
            <button onClick={() => setShowGen(true)}
              className="mt-4 flex items-center gap-2 h-9 px-4 rounded-lg bg-[#2196F3] text-white text-sm font-medium hover:bg-[#1565C0] transition-colors mx-auto">
              <Plus size={14} /> Generate first report
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(r => (
            <ReportCard key={r.id} report={r} onSend={handleSend} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Generate modal */}
      {showGen && (
        <GenerateModal
          clients={clients}
          onClose={() => setShowGen(false)}
          onDone={() => { setShowGen(false); load(); }}
        />
      )}
    </div>
  );
}
