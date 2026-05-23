import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Plus, Mail, Phone, Globe, ChevronRight, Loader,
  AlertTriangle, X, Users, DollarSign, TrendingUp, Check,
} from 'lucide-react';

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

// ─── Email template (pre-fills mailto link) ────────────────────────────────────
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

// ─── Blank form ────────────────────────────────────────────────────────────────
const BLANK = {
  company_name: '', contact_name: '', email: '', phone: '',
  website: '', niche: 'roofing contractors', location: 'Fairfax, VA',
  notes: '', monthly_value: '',
};

// ─── ProspectCard ───────────────────────────────────────────────────────────────
function ProspectCard({ p, stage, onMove, onDelete, moving }) {
  const nextStage = STAGES.find(s => s.id === stage?.next);

  const daysSince = (iso) => {
    if (!iso) return null;
    const diff = Date.now() - new Date(iso).getTime();
    const d = Math.floor(diff / 86400000);
    return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`;
  };

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

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {p.email && (
            <a
              href={buildMailto(p)}
              title="Send cold email"
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-[#EEF6FE] hover:border-[#2196F3]/40 hover:text-[#2196F3] transition-colors"
            >
              <Mail size={12} /> Email
            </a>
          )}
          {p.phone && (
            <a
              href={`tel:${p.phone}`}
              title="Call now"
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Phone size={12} /> Call
            </a>
          )}
          {p.website && (
            <a
              href={p.website.startsWith('http') ? p.website : `https://${p.website}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Visit website"
              className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 transition-colors"
            >
              <Globe size={13} />
            </a>
          )}
        </div>
      </div>

      {/* Notes */}
      {p.notes && (
        <div className="mb-3 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 leading-relaxed">
          {p.notes}
        </div>
      )}

      {/* Monthly value badge (clients only) */}
      {p.status === 'client' && p.monthly_value && (
        <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <DollarSign size={12} />
          ${Number(p.monthly_value).toLocaleString()}/month retainer
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="text-xs text-slate-400">
          Added {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {p.last_contacted_at && (
            <span className="ml-2 text-[#2196F3]">
              · contacted {daysSince(p.last_contacted_at)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDelete(p.id)}
            className="text-xs text-slate-300 hover:text-red-400 transition-colors px-1"
          >
            Remove
          </button>
          {stage?.next && (
            <button
              onClick={() => onMove(p.id, stage.next)}
              disabled={moving}
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {moving
                ? <Loader size={11} className="animate-spin" />
                : <><ChevronRight size={11} /> {stage.nextLabel}</>
              }
            </button>
          )}
          {!stage?.next && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <Check size={12} /> Active client
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────
export default function Pipeline() {
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('new');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [movingId, setMovingId] = useState(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) { setLoading(false); return; }
    const { data } = await supabase
      .from('prospects')
      .select('*')
      .order('updated_at', { ascending: false });
    setProspects(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addProspect = async (e) => {
    e.preventDefault();
    if (!isSupabaseConfigured() || !supabase) return;
    setSaving(true);
    const payload = { ...form, status: 'new' };
    if (!payload.monthly_value) delete payload.monthly_value;
    const { data } = await supabase.from('prospects').insert(payload).select().single();
    if (data) setProspects(p => [data, ...p]);
    setForm(BLANK);
    setShowAdd(false);
    setSaving(false);
    setTab('new');
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
  };

  const deleteProspect = async (id) => {
    if (!supabase) return;
    await supabase.from('prospects').delete().eq('id', id);
    setProspects(p => p.filter(x => x.id !== id));
  };

  // Computed
  const counts = Object.fromEntries(STAGES.map(s => [s.id, prospects.filter(p => p.status === s.id).length]));
  const filtered = prospects.filter(p => p.status === tab);
  const currentStage = STAGES.find(s => s.id === tab);
  const mrr = prospects
    .filter(p => p.status === 'client' && p.monthly_value)
    .reduce((sum, p) => sum + Number(p.monthly_value), 0);

  const inputClass = "w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3] transition-colors";

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Pipeline</h1>
          <p className="text-sm text-slate-500 mt-1">Track every prospect from cold outreach to signed client</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#2196F3] text-white text-sm font-medium hover:bg-[#1565C0] transition-colors flex-shrink-0"
        >
          <Plus size={14} /> Add prospect
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total prospects',  value: prospects.length,                                             icon: Users,      color: 'text-slate-700' },
          { label: 'Active pipeline',  value: prospects.filter(p => !['new','client'].includes(p.status)).length, icon: TrendingUp, color: 'text-[#2196F3]' },
          { label: 'Clients signed',   value: counts['client'] || 0,                                        icon: Check,      color: 'text-emerald-600' },
          { label: 'Monthly revenue',  value: mrr ? `$${mrr.toLocaleString()}` : '$0',                      icon: DollarSign, color: 'text-[#F97316]' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3.5">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={13} className={color} />
              <span className="text-xs text-slate-400">{label}</span>
            </div>
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
              Pipeline requires Supabase. Add your credentials to .env — also run the updated <code className="font-mono font-semibold">supabase-schema.sql</code> in your SQL Editor.
            </div>
          </div>
        </div>
      )}

      {/* Stage tabs */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 mb-5 shadow-sm overflow-x-auto">
        {STAGES.map(s => (
          <button
            key={s.id}
            onClick={() => setTab(s.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              tab === s.id
                ? 'bg-[#2196F3] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            {s.label}
            {counts[s.id] > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                tab === s.id ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {counts[s.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <div className="w-3 h-3 border border-[#2196F3] border-t-transparent rounded-full animate-spin" />
          Loading pipeline…
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Users size={28} className="mx-auto text-slate-200 mb-3" />
          <div className="text-sm font-medium text-slate-500">No prospects in this stage</div>
          <div className="text-xs text-slate-400 mt-1">
            {tab === 'new'
              ? 'Click "Add prospect" to get started — pull names from your Agent Network runs'
              : 'Move prospects forward using the stage button on each card'
            }
          </div>
          {tab === 'new' && (
            <button
              onClick={() => setShowAdd(true)}
              className="mt-4 inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#2196F3] text-white text-sm font-medium hover:bg-[#1565C0] transition-colors"
            >
              <Plus size={14} /> Add first prospect
            </button>
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
            moving={movingId === p.id}
          />
        ))}
      </div>

      {/* ── Add prospect modal ───────────────────────────────────────────────── */}
      {showAdd && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowAdd(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
              <h3 className="text-base font-semibold text-slate-900">Add prospect</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={addProspect} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Company name *</label>
                <input
                  required
                  value={form.company_name}
                  onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                  placeholder="Apex Roofing LLC"
                  className={inputClass}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Contact name</label>
                  <input
                    value={form.contact_name}
                    onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                    placeholder="John Smith"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="john@apex.com"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Phone</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="(571) 555-0100"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Website</label>
                  <input
                    value={form.website}
                    onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                    placeholder="apexroofing.com"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Niche</label>
                  <select
                    value={form.niche}
                    onChange={e => setForm(f => ({ ...f, niche: e.target.value }))}
                    className={inputClass}
                  >
                    {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Location</label>
                  <input
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Found via agent run — no Google Ads showing, 4.9 stars GBP, owner is Mike..."
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 h-10 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 h-10 rounded-lg bg-[#2196F3] text-white text-sm font-medium hover:bg-[#1565C0] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
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
