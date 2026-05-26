import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { exportToCSV, parseCSV, normalizeProspectRow } from '../lib/csv';
import {
  Plus, Mail, Phone, Globe, ChevronRight, Loader,
  AlertTriangle, X, Users, DollarSign, TrendingUp, Check, Zap,
  Clock, Copy, Send, FileText, PenLine, Search, Download, Upload,
  CheckSquare, Square, CalendarCheck, ChevronDown, ChevronUp,
} from 'lucide-react';
import CampaignBuilder from '../components/CampaignBuilder';
import { writeFollowUp, queueFollowUp } from '../agents/bigBotEngine';
import { generateProposal, sendProposal, generateContract, sendContractEmail } from '../agents/contractEngine';

// ─── Follow-up modal ─────────────────────────────────────────────────────────
function FollowUpModal({ prospect, onClose }) {
  const [seqNum, setSeqNum]   = useState(2);
  const [loading, setLoading] = useState(false);
  const [output, setOutput]   = useState('');
  const [queuing, setQueuing] = useState(false);
  const [queued, setQueued]   = useState(false);
  const [copied, setCopied]   = useState(false);

  const generate = async () => {
    setLoading(true); setOutput('');
    const text = await writeFollowUp(prospect, seqNum);
    setOutput(text); setLoading(false);
  };

  const handleQueue = async () => {
    if (!output) return;
    setQueuing(true);
    const subjectMatch = output.match(/SUBJECT:\s*(.*)/i);
    const emailMatch   = output.match(/EMAIL:\s*([\s\S]+)/i);
    const subject = subjectMatch?.[1]?.trim() || `Follow-up #${seqNum} — ${prospect.company_name}`;
    const body    = emailMatch?.[1]?.trim() || output;
    await queueFollowUp(prospect, subject, body, seqNum);
    setQueued(true); setQueuing(false);
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(output);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  const daysSince = prospect.last_contacted_at
    ? Math.round((Date.now() - new Date(prospect.last_contacted_at)) / 86400000)
    : null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Write Follow-up</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {prospect.company_name}{daysSince ? ` · ${daysSince}d since last contact` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="p-6">
          <div className="flex gap-2 mb-5">
            {[2, 3].map(n => (
              <button key={n} onClick={() => { setSeqNum(n); setOutput(''); setQueued(false); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${seqNum === n ? 'bg-[#2196F3] text-white border-[#2196F3]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {n === 2 ? 'Follow-up #2 (day 5-7)' : 'Final email #3 (day 12-14)'}
              </button>
            ))}
          </div>
          {!output && !loading && (
            <button onClick={generate} className="w-full h-11 rounded-xl bg-[#1B3A5C] text-white text-sm font-semibold hover:bg-[#243E6A] transition-colors">
              Generate email #{seqNum}
            </button>
          )}
          {loading && <div className="flex items-center gap-2 justify-center py-8 text-sm text-slate-400"><Loader size={15} className="animate-spin text-[#2196F3]" />Writing follow-up…</div>}
          {output && (
            <>
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-4 font-mono text-xs text-slate-700 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">{output}</div>
              {queued ? (
                <div className="flex items-center gap-2 justify-center text-sm font-medium text-emerald-600 py-2"><Check size={14} /> Queued — will send when Resend is connected</div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={handleCopy} className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                    <Copy size={13} /> {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button onClick={handleQueue} disabled={queuing} className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-[#2196F3] text-white text-sm font-medium hover:bg-[#1565C0] transition-colors disabled:opacity-50">
                    {queuing ? <><Loader size={13} className="animate-spin" /> Queuing…</> : <><Send size={13} /> Queue & Send</>}
                  </button>
                </div>
              )}
              <button onClick={() => { setOutput(''); setQueued(false); }} className="w-full mt-2 text-xs text-slate-400 hover:text-slate-600 transition-colors">↺ Regenerate</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Proposal / Contract modal ────────────────────────────────────────────────
function DealModal({ prospect, mode, onClose, onNavigateContracts }) {
  const [loading,  setLoading]  = useState(false);
  const [output,   setOutput]   = useState('');
  const [subject,  setSubject]  = useState('');
  const [contractData, setContractData] = useState(null);
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const [copied,   setCopied]   = useState(false);
  const [log,      setLog]      = useState([]);
  const addLog = msg => setLog(p => [...p, msg]);

  const generate = async () => {
    setLoading(true); setOutput(''); setLog([]);
    try {
      if (mode === 'proposal') {
        const result = await generateProposal(prospect, addLog);
        if (result.success) { setOutput(result.content); setSubject(result.subject); }
        else addLog(`❌ ${result.error}`);
      } else {
        const result = await generateContract(prospect, addLog);
        if (result.success) { setOutput(result.content); setContractData(result); }
        else addLog(`❌ ${result.error}`);
      }
    } catch (e) { addLog(`❌ Error: ${e.message}`); }
    setLoading(false);
  };

  const handleSend = async () => {
    if (!output) return;
    setSending(true);
    try {
      if (mode === 'proposal') await sendProposal(null, prospect, output, subject);
      else if (contractData) await sendContractEmail(contractData, prospect);
      setSent(true);
    } catch (e) { addLog(`❌ Send failed: ${e.message}`); }
    setSending(false);
  };

  const handleCopy = () => { navigator.clipboard?.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  const title = mode === 'proposal' ? 'Send Proposal' : 'Send Contract';
  const agentLabel = mode === 'proposal' ? 'Agent 10 — Proposal Writer' : 'Agent 11 — Contract Generator';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{prospect.company_name} · {agentLabel}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="p-6">
          {log.length > 0 && (
            <div className="bg-slate-900 rounded-xl p-3 mb-4 font-mono text-xs text-emerald-400 space-y-0.5 max-h-28 overflow-y-auto">
              {log.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}
          {!output && !loading && (
            <button onClick={generate} className="w-full h-11 rounded-xl bg-[#1B3A5C] text-white text-sm font-semibold hover:bg-[#243E6A] transition-colors">
              Generate {mode === 'proposal' ? 'proposal' : 'contract'}
            </button>
          )}
          {loading && <div className="flex items-center gap-2 justify-center py-8 text-sm text-slate-400"><Loader size={15} className="animate-spin text-[#2196F3]" />{mode === 'proposal' ? 'Writing proposal…' : 'Generating contract…'}</div>}
          {output && (
            <>
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-4 font-mono text-xs text-slate-700 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">{output}</div>
              {sent ? (
                <div className="flex items-center gap-2 justify-center text-sm font-medium text-emerald-600 py-2">
                  <Check size={14} />{mode === 'proposal' ? 'Proposal sent!' : 'Contract sent — awaiting signature'}
                </div>
              ) : (
                <div className="space-y-2">
                  {!prospect.email && (
                    <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <AlertTriangle size={12} /> No email address — add one in Pipeline to send automatically
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={handleCopy} className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                      <Copy size={13} /> {copied ? 'Copied!' : 'Copy'}
                    </button>
                    {prospect.email && (
                      <button onClick={handleSend} disabled={sending} className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-[#2196F3] text-white text-sm font-medium hover:bg-[#1565C0] transition-colors disabled:opacity-50">
                        {sending ? <><Loader size={13} className="animate-spin" /> Sending…</> : <><Send size={13} /> {mode === 'proposal' ? 'Email proposal' : 'Email contract'}</>}
                      </button>
                    )}
                  </div>
                  {mode === 'contract' && contractData?.signingToken && (
                    <button onClick={onNavigateContracts} className="w-full flex items-center justify-center gap-2 h-9 rounded-xl border border-slate-200 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors">
                      <FileText size={12} /> View all contracts →
                    </button>
                  )}
                </div>
              )}
              <button onClick={() => { setOutput(''); setLog([]); setSent(false); }} className="w-full mt-2 text-xs text-slate-400 hover:text-slate-600 transition-colors">↺ Regenerate</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tasks panel (per prospect) ───────────────────────────────────────────────
function TasksPanel({ prospectId }) {
  const [tasks,     setTasks]    = useState([]);
  const [loading,   setLoading]  = useState(true);
  const [newTitle,  setNewTitle] = useState('');
  const [newDue,    setNewDue]   = useState('');
  const [adding,    setAdding]   = useState(false);
  const [showForm,  setShowForm] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase || !prospectId) { setLoading(false); return; }
    supabase.from('tasks').select('*').eq('prospect_id', prospectId).order('due_date', { ascending: true, nullsFirst: false }).order('created_at')
      .then(({ data }) => { setTasks(data || []); setLoading(false); });
  }, [prospectId]);

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !supabase) return;
    setAdding(true);
    const payload = { prospect_id: prospectId, title: newTitle.trim(), due_date: newDue || null };
    const { data } = await supabase.from('tasks').insert(payload).select().single();
    if (data) setTasks(prev => [...prev, data]);
    setNewTitle(''); setNewDue(''); setShowForm(false); setAdding(false);
  };

  const toggleTask = async (task) => {
    if (!supabase) return;
    const patch = {
      completed:    !task.completed,
      completed_at: !task.completed ? new Date().toISOString() : null,
    };
    await supabase.from('tasks').update(patch).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...patch } : t));
  };

  const deleteTask = async (id) => {
    if (!supabase) return;
    await supabase.from('tasks').delete().eq('id', id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const pending   = tasks.filter(t => !t.completed);
  const completed = tasks.filter(t => t.completed);

  const dueSoon = (due) => {
    if (!due) return false;
    const diff = (new Date(due) - Date.now()) / 86400000;
    return diff <= 2 && diff >= -1;
  };
  const overdue = (due) => {
    if (!due) return false;
    return new Date(due) < new Date() && !isNaN(new Date(due));
  };

  if (loading) return <div className="text-xs text-slate-400 py-1 flex items-center gap-1"><Loader size={10} className="animate-spin" /> Loading tasks…</div>;

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
          <CalendarCheck size={10} />
          Tasks {pending.length > 0 && <span className="bg-[#2196F3]/10 text-[#2196F3] px-1.5 py-0.5 rounded-full font-bold">{pending.length}</span>}
        </span>
        <button onClick={() => setShowForm(v => !v)} className="text-[10px] text-[#2196F3] hover:text-[#1565C0] font-medium transition-colors">
          + Add task
        </button>
      </div>

      {/* Task list */}
      <div className="space-y-1">
        {pending.map(t => (
          <div key={t.id} className="flex items-start gap-2 group">
            <button onClick={() => toggleTask(t)} className="mt-0.5 flex-shrink-0 text-slate-300 hover:text-emerald-500 transition-colors">
              <Square size={12} />
            </button>
            <span className={`flex-1 text-xs leading-relaxed ${
              overdue(t.due_date) ? 'text-red-600' : dueSoon(t.due_date) ? 'text-amber-600' : 'text-slate-600'
            }`}>
              {t.title}
              {t.due_date && (
                <span className={`ml-1.5 text-[10px] ${overdue(t.due_date) ? 'text-red-400' : dueSoon(t.due_date) ? 'text-amber-400' : 'text-slate-300'}`}>
                  · {new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {overdue(t.due_date) && ' ⚠'}
                </span>
              )}
            </span>
            <button onClick={() => deleteTask(t.id)} className="opacity-0 group-hover:opacity-100 text-slate-200 hover:text-red-400 transition-all flex-shrink-0">
              <X size={10} />
            </button>
          </div>
        ))}
        {completed.slice(-3).map(t => (
          <div key={t.id} className="flex items-start gap-2 group opacity-40">
            <button onClick={() => toggleTask(t)} className="mt-0.5 flex-shrink-0 text-emerald-500">
              <CheckSquare size={12} />
            </button>
            <span className="flex-1 text-xs line-through text-slate-400 leading-relaxed">{t.title}</span>
            <button onClick={() => deleteTask(t.id)} className="opacity-0 group-hover:opacity-100 text-slate-200 hover:text-red-400 transition-all flex-shrink-0">
              <X size={10} />
            </button>
          </div>
        ))}
        {tasks.length === 0 && !showForm && (
          <div className="text-[11px] text-slate-300 italic">No tasks yet — add follow-up reminders</div>
        )}
      </div>

      {/* Add task form */}
      {showForm && (
        <form onSubmit={addTask} className="mt-2 flex gap-1.5 items-end">
          <div className="flex-1">
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Task description…"
              autoFocus
              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3] transition-colors"
            />
          </div>
          <input
            type="date"
            value={newDue}
            onChange={e => setNewDue(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3] transition-colors"
          />
          <button type="submit" disabled={adding || !newTitle.trim()} className="h-7 px-3 rounded-lg bg-[#2196F3] text-white text-[11px] font-semibold hover:bg-[#1565C0] transition-colors disabled:opacity-40">
            {adding ? '…' : 'Add'}
          </button>
          <button type="button" onClick={() => setShowForm(false)} className="h-7 px-2 text-slate-300 hover:text-slate-500 text-[11px] transition-colors">✕</button>
        </form>
      )}
    </div>
  );
}

// ─── CSV Import modal ─────────────────────────────────────────────────────────
function ImportModal({ onClose, onImport, defaultNiche, defaultLocation }) {
  const [text, setText]       = useState('');
  const [preview, setPreview] = useState([]);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(null);

  const handlePaste = (val) => {
    setText(val);
    setError('');
    setPreview([]);
    if (!val.trim()) return;
    const rows = parseCSV(val);
    const normalized = rows
      .map(r => normalizeProspectRow(r, { niche: defaultNiche, location: defaultLocation }))
      .filter(Boolean);
    if (!normalized.length) {
      setError('No valid rows found. Make sure the first row is a header (company, email, phone, location, niche, notes).');
      return;
    }
    setPreview(normalized.slice(0, 5));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => handlePaste(ev.target.result);
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!text.trim()) return;
    setLoading(true);
    const rows = parseCSV(text);
    const normalized = rows
      .map(r => normalizeProspectRow(r, { niche: defaultNiche, location: defaultLocation }))
      .filter(Boolean);
    const result = await onImport(normalized);
    setDone(result);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Import prospects</h3>
            <p className="text-xs text-slate-400 mt-0.5">Paste a CSV or upload a spreadsheet exported from Google Sheets / Excel</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        {done ? (
          <div className="p-6 text-center">
            <div className="text-3xl mb-3">{done.imported > 0 ? '✅' : '⚠️'}</div>
            <div className="text-sm font-semibold text-slate-800 mb-1">
              {done.imported > 0 ? `${done.imported} prospect${done.imported !== 1 ? 's' : ''} imported!` : 'No prospects imported'}
            </div>
            {done.skipped > 0 && <div className="text-xs text-slate-400">{done.skipped} rows skipped (missing company name)</div>}
            {done.error && <div className="text-xs text-red-500 mt-1">{done.error}</div>}
            <button onClick={onClose} className="mt-4 h-9 px-6 rounded-lg bg-[#2196F3] text-white text-sm font-medium hover:bg-[#1565C0] transition-colors">
              Done
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {/* Upload button */}
            <label className="flex items-center gap-2 h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer w-fit">
              <Upload size={14} /> Upload CSV file
              <input type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload} className="hidden" />
            </label>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="flex-1 h-px bg-slate-200" /></div>
              <div className="relative flex justify-center"><span className="bg-white px-2 text-xs text-slate-400">or paste below</span></div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Paste CSV / spreadsheet data</label>
              <textarea
                value={text}
                onChange={e => handlePaste(e.target.value)}
                placeholder="company,contact,email,phone,location,niche,notes&#10;ABC Roofing,John Smith,john@abc.com,(571) 555-0100,Austin TX,roofing contractors,No Google Ads&#10;XYZ HVAC,,info@xyzhvac.com,,Dallas TX,HVAC companies,"
                rows={6}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 bg-white font-mono text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3] transition-colors resize-y"
              />
              <div className="text-[10px] text-slate-400 mt-1">
                Supported columns: company / company_name, contact, email, phone, location, niche, notes, website, monthly_value. Header row required.
              </div>
            </div>

            {error && <div className="text-xs text-red-600 border border-red-200 rounded-lg px-3 py-2 bg-red-50">{error}</div>}

            {preview.length > 0 && (
              <div>
                <div className="text-xs font-medium text-slate-500 mb-1.5">Preview (first {preview.length} rows)</div>
                <div className="space-y-1.5">
                  {preview.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                      <span className="font-medium text-slate-700">{p.company_name}</span>
                      {p.email    && <span className="text-slate-400">{p.email}</span>}
                      {p.location && <span className="text-slate-400">· {p.location}</span>}
                      {p.niche    && <span className="text-slate-400">· {p.niche}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 h-10 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={loading || (!preview.length && !text.trim())}
                className="flex-1 h-10 rounded-lg bg-[#2196F3] text-white text-sm font-medium hover:bg-[#1565C0] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader size={13} className="animate-spin" />}
                {loading ? 'Importing…' : `Import${preview.length ? ` ${preview.length}+ prospects` : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stage config ──────────────────────────────────────────────────────────────
const STAGES = [
  { id: 'new',         label: 'New Lead',     color: 'slate',   next: 'contacted',   nextLabel: 'Mark contacted'   },
  { id: 'contacted',   label: 'Contacted',    color: 'blue',    next: 'replied',     nextLabel: 'Got a reply'      },
  { id: 'replied',     label: 'Replied',      color: 'amber',   next: 'call_booked', nextLabel: 'Call booked'      },
  { id: 'call_booked', label: 'Call Booked',  color: 'violet',  next: 'proposal',    nextLabel: 'Proposal sent'    },
  { id: 'proposal',    label: 'Proposal',     color: 'orange',  next: 'client',      nextLabel: 'Signed ✓'         },
  { id: 'client',      label: 'Client ✓',     color: 'emerald', next: null,          nextLabel: null               },
];

const STAGE_BADGE = {
  slate:   'bg-slate-100 text-slate-600',
  blue:    'bg-blue-100 text-blue-700',
  amber:   'bg-amber-100 text-amber-700',
  violet:  'bg-violet-100 text-violet-700',
  orange:  'bg-orange-100 text-orange-700',
  emerald: 'bg-emerald-100 text-emerald-700',
};

const NICHES = [
  'roofing contractors', 'foundation repair companies', 'personal injury law firms',
  'HVAC companies', 'plumbing companies', 'solar installation companies',
  'general contractors', 'window and siding companies',
];

function buildMailto(p) {
  const firstName = p.contact_name?.split(' ')[0] || 'there';
  const subject = `More ${p.niche || 'jobs'} from Google — free trial offer`;
  const body = `Hi ${firstName},

I run a Google Ads agency that specializes in ${p.niche || 'home services'} in ${p.location || 'your area'}.

I'd like to offer ${p.company_name} a free trial — I cover the initial ad spend, you keep every lead. No retainer required to start.

Most clients in your niche see 15–30 qualified calls within the first 30 days. If the results are real (they will be), we can talk about a monthly setup.

Worth a quick 15-minute call this week?

Ali
AMA Leads Agency
amaleads.org`;

  return `mailto:${p.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const BLANK = {
  company_name: '', contact_name: '', email: '', phone: '',
  website: '', niche: 'roofing contractors', location: '',
  notes: '', monthly_value: '',
};

// ─── ProspectCard ─────────────────────────────────────────────────────────────
function ProspectCard({ p, stage, onMove, onDelete, onFollowUp, onProposal, onContract, moving }) {
  const [showTasks, setShowTasks] = useState(false);
  const nextStage = STAGES.find(s => s.id === stage?.next);

  const daysSince = (iso) => {
    if (!iso) return null;
    const diff = Date.now() - new Date(iso).getTime();
    const d = Math.floor(diff / 86400000);
    return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`;
  };

  const isStale = !['new','client','dead'].includes(p.status) && (() => {
    const last = p.last_contacted_at || p.updated_at;
    if (!last) return true;
    return (Date.now() - new Date(last)) / 86400000 > 7;
  })();

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-900">{p.company_name}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STAGE_BADGE[stage?.color || 'slate']}`}>
              {stage?.label}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-3 mt-1 text-xs text-slate-400">
            {p.contact_name && <span>{p.contact_name}</span>}
            {p.niche && <span>{p.niche}</span>}
            {p.location && <span>{p.location}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {p.email && (
            <a href={buildMailto(p)} title="Send cold email"
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-[#EEF6FE] hover:border-[#2196F3]/40 hover:text-[#2196F3] transition-colors">
              <Mail size={12} /> Email
            </a>
          )}
          {p.phone && (
            <a href={`tel:${p.phone}`} title="Call now"
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              <Phone size={12} /> Call
            </a>
          )}
          {p.website && (
            <a href={p.website.startsWith('http') ? p.website : `https://${p.website}`} target="_blank" rel="noopener noreferrer" title="Visit website"
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 transition-colors">
              <Globe size={13} />
            </a>
          )}
        </div>
      </div>

      {p.notes && (
        <div className="mb-3 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 leading-relaxed">{p.notes}</div>
      )}
      {p.status === 'client' && p.monthly_value && (
        <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <DollarSign size={12} />${Number(p.monthly_value).toLocaleString()}/month retainer
        </div>
      )}
      {isStale && (
        <div className="mb-3 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs text-amber-700">
            <Clock size={11} className="flex-shrink-0" />
            <span>No contact in 7+ days — follow-up needed</span>
          </div>
          <button onClick={() => onFollowUp(p)} className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 transition-colors flex-shrink-0 ml-2">
            Write follow-up →
          </button>
        </div>
      )}

      {/* Tasks panel */}
      {isSupabaseConfigured() && (
        <div>
          <button
            onClick={() => setShowTasks(v => !v)}
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-[#2196F3] transition-colors font-medium"
          >
            <CalendarCheck size={10} />
            Tasks
            {showTasks ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
          {showTasks && <TasksPanel prospectId={p.id} />}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-3">
        <div className="text-xs text-slate-400">
          Added {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {p.last_contacted_at && (
            <span className="ml-2 text-[#2196F3]">· contacted {daysSince(p.last_contacted_at)}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onDelete(p.id)} className="text-xs text-slate-300 hover:text-red-400 transition-colors px-1">Remove</button>
          <div className="flex items-center gap-1.5 flex-wrap">
            {p.status === 'call_booked' && (
              <button onClick={() => onProposal?.(p)} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/20 hover:bg-[#F97316]/20 transition-colors">
                <FileText size={10} /> Send Proposal
              </button>
            )}
            {p.status === 'proposal' && (
              <button onClick={() => onContract?.(p)} className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors">
                <PenLine size={10} /> Send Contract
              </button>
            )}
            {stage?.next && (
              <button onClick={() => onMove(p.id, stage.next)} disabled={moving}
                className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-700 transition-colors disabled:opacity-50">
                {moving ? <Loader size={11} className="animate-spin" /> : <><ChevronRight size={11} /> {stage.nextLabel}</>}
              </button>
            )}
            {!stage?.next && (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><Check size={12} /> Active client</span>
                <button onClick={() => p && window.dispatchEvent(new CustomEvent('buildCampaign', { detail: p }))}
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-[#1B3A5C] text-white hover:bg-[#243E6A] transition-colors">
                  <Zap size={10} /> Build Campaign
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Pipeline({ onNavigate }) {
  const [prospects,      setProspects]      = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [tab,            setTab]            = useState('new');
  const [search,         setSearch]         = useState('');
  const [showAdd,        setShowAdd]        = useState(false);
  const [showImport,     setShowImport]     = useState(false);
  const [form,           setForm]           = useState(BLANK);
  const [saving,         setSaving]         = useState(false);
  const [movingId,       setMovingId]       = useState(null);
  const [newClient,      setNewClient]      = useState(null);
  const [followUpTarget, setFollowUpTarget] = useState(null);
  const [dealTarget,     setDealTarget]     = useState(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) { setLoading(false); return; }
    const { data } = await supabase.from('prospects').select('*').order('updated_at', { ascending: false });
    setProspects(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = (e) => setNewClient(e.detail);
    window.addEventListener('buildCampaign', handler);
    return () => window.removeEventListener('buildCampaign', handler);
  }, []);

  const addProspect = async (e) => {
    e.preventDefault();
    if (!isSupabaseConfigured() || !supabase) return;
    setSaving(true);
    const payload = { ...form, status: 'new' };
    if (!payload.monthly_value) delete payload.monthly_value;
    const { data } = await supabase.from('prospects').insert(payload).select().single();
    if (data) setProspects(p => [data, ...p]);
    setForm(BLANK); setShowAdd(false); setSaving(false); setTab('new');
  };

  // ── CSV export ─────────────────────────────────────────────────────────────
  const handleExport = () => {
    exportToCSV(
      prospects.map(p => ({
        company_name:  p.company_name,
        contact_name:  p.contact_name,
        email:         p.email,
        phone:         p.phone,
        website:       p.website,
        niche:         p.niche,
        location:      p.location,
        status:        p.status,
        monthly_value: p.monthly_value,
        notes:         p.notes,
        last_contacted: p.last_contacted_at,
        created_at:    p.created_at,
      })),
      'pipeline-prospects'
    );
  };

  // ── CSV import ─────────────────────────────────────────────────────────────
  const handleImport = async (rows) => {
    if (!isSupabaseConfigured() || !supabase || !rows.length) {
      return { imported: 0, skipped: rows.length, error: 'Supabase not connected' };
    }
    const payload = rows.map(r => ({ ...r, status: 'new' }));
    const { data, error } = await supabase.from('prospects').insert(payload).select();
    if (error) return { imported: 0, skipped: rows.length, error: error.message };
    const imported = data?.length || 0;
    if (data) setProspects(prev => [...data, ...prev]);
    return { imported, skipped: rows.length - imported };
  };

  const moveStage = async (id, nextStatus) => {
    if (!supabase) return;
    setMovingId(id);
    const patch = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
      ...(nextStatus === 'contacted' ? { last_contacted_at: new Date().toISOString() } : {}),
    };
    await supabase.from('prospects').update(patch).eq('id', id);
    setProspects(p => p.map(x => x.id === id ? { ...x, ...patch } : x));
    setMovingId(null);
    if (nextStatus === 'client') {
      const prospect = prospects.find(p => p.id === id);
      if (prospect) setNewClient({ ...prospect, ...patch });
    }
  };

  const deleteProspect = async (id) => {
    if (!supabase) return;
    await supabase.from('prospects').delete().eq('id', id);
    setProspects(p => p.filter(x => x.id !== id));
  };

  // ── Computed ───────────────────────────────────────────────────────────────
  const counts = Object.fromEntries(STAGES.map(s => [s.id, prospects.filter(p => p.status === s.id).length]));
  const mrr    = prospects.filter(p => p.status === 'client' && p.monthly_value).reduce((s, p) => s + Number(p.monthly_value), 0);

  // Apply search filter
  const baseFiltered = prospects.filter(p => p.status === tab);
  const filtered = search.trim()
    ? baseFiltered.filter(p => {
        const q = search.toLowerCase();
        return (
          p.company_name?.toLowerCase().includes(q) ||
          p.contact_name?.toLowerCase().includes(q) ||
          p.email?.toLowerCase().includes(q) ||
          p.niche?.toLowerCase().includes(q) ||
          p.location?.toLowerCase().includes(q)
        );
      })
    : baseFiltered;

  const currentStage = STAGES.find(s => s.id === tab);
  const inputClass = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3] transition-colors';

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Pipeline</h1>
          <p className="text-sm text-slate-500 mt-1">Track every prospect from cold outreach to signed client</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {prospects.length > 0 && (
            <button onClick={handleExport} className="flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              <Download size={14} /> Export
            </button>
          )}
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <Upload size={14} /> Import
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#2196F3] text-white text-sm font-medium hover:bg-[#1565C0] transition-colors">
            <Plus size={14} /> Add prospect
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total prospects',  value: prospects.length,                                                          icon: Users,      color: 'text-slate-700' },
          { label: 'Active pipeline',  value: prospects.filter(p => !['new','client'].includes(p.status)).length,        icon: TrendingUp, color: 'text-[#2196F3]' },
          { label: 'Clients signed',   value: counts['client'] || 0,                                                     icon: Check,      color: 'text-emerald-600' },
          { label: 'Monthly revenue',  value: mrr ? `$${mrr.toLocaleString()}` : '$0',                                   icon: DollarSign, color: 'text-[#F97316]' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3.5">
            <div className="flex items-center gap-2 mb-1"><Icon size={13} className={color} /><span className="text-xs text-slate-400">{label}</span></div>
            <div className={`text-xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Not connected warning */}
      {!isSupabaseConfigured() && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5 mb-5">
          <AlertTriangle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-amber-800">Supabase not connected</div>
            <div className="text-xs text-amber-700 mt-0.5">
              Pipeline requires Supabase. Add your credentials to .env — also run <code className="font-mono font-semibold">supabase-schema-v6.sql</code> to enable tasks.
            </div>
          </div>
        </div>
      )}

      {/* Search + Stage tabs row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-shrink-0 sm:w-52">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search prospects…"
            className="w-full text-sm border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3] transition-colors shadow-sm"
          />
        </div>

        {/* Stage tabs */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 flex-1 shadow-sm overflow-x-auto">
          {STAGES.map(s => (
            <button key={s.id} onClick={() => { setTab(s.id); setSearch(''); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                tab === s.id ? 'bg-[#2196F3] text-white shadow-sm' : 'text-slate-400 hover:text-slate-700'
              }`}>
              {s.label}
              {counts[s.id] > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${tab === s.id ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {counts[s.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && <div className="flex items-center gap-2 text-xs text-slate-400"><div className="w-3 h-3 border border-[#2196F3] border-t-transparent rounded-full animate-spin" />Loading pipeline…</div>}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Users size={28} className="mx-auto text-slate-200 mb-3" />
          <div className="text-sm font-medium text-slate-500">
            {search ? `No results for "${search}"` : 'No prospects in this stage'}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {search
              ? 'Try a different search term'
              : tab === 'new'
                ? 'Click "Add prospect" to get started, or import a CSV'
                : 'Move prospects forward using the stage button on each card'
            }
          </div>
          {tab === 'new' && !search && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#2196F3] text-white text-sm font-medium hover:bg-[#1565C0] transition-colors">
                <Plus size={14} /> Add first prospect
              </button>
              <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                <Upload size={14} /> Import CSV
              </button>
            </div>
          )}
        </div>
      )}

      {/* Cards */}
      <div className="space-y-3">
        {filtered.map(p => (
          <ProspectCard
            key={p.id}
            p={p}
            stage={currentStage}
            onMove={moveStage}
            onDelete={deleteProspect}
            onFollowUp={setFollowUpTarget}
            onProposal={p => setDealTarget({ prospect: p, mode: 'proposal' })}
            onContract={p => setDealTarget({ prospect: p, mode: 'contract' })}
            moving={movingId === p.id}
          />
        ))}
      </div>

      {/* Modals */}
      {newClient && <CampaignBuilder prospect={newClient} onClose={() => setNewClient(null)} onComplete={() => {}} />}
      {followUpTarget && <FollowUpModal prospect={followUpTarget} onClose={() => setFollowUpTarget(null)} />}
      {dealTarget && (
        <DealModal
          prospect={dealTarget.prospect}
          mode={dealTarget.mode}
          onClose={() => setDealTarget(null)}
          onNavigateContracts={() => { setDealTarget(null); onNavigate?.('contracts'); }}
        />
      )}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImport={handleImport}
          defaultNiche="roofing contractors"
          defaultLocation=""
        />
      )}

      {/* Add prospect modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
              <h3 className="text-base font-semibold text-slate-900">Add prospect</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-700 transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={addProspect} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Company name *</label>
                <input required value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} placeholder="Apex Roofing LLC" className={inputClass} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Contact name</label>
                  <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="John Smith" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@apex.com" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Phone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(571) 555-0100" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Website</label>
                  <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="apexroofing.com" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Niche</label>
                  <select value={form.niche} onChange={e => setForm(f => ({ ...f, niche: e.target.value }))} className={inputClass}>
                    {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Location</label>
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Found via agent run — no Google Ads showing, 4.9 stars GBP..." rows={3} className={`${inputClass} resize-none`} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 h-10 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 h-10 rounded-lg bg-[#2196F3] text-white text-sm font-medium hover:bg-[#1565C0] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <Loader size={13} className="animate-spin" />}
                  {saving ? 'Adding…' : 'Add to pipeline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
