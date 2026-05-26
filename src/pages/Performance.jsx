import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { exportToCSV } from '../lib/csv';
import {
  BarChart2, Plus, X, Loader, Download, TrendingUp, TrendingDown,
  MousePointer, Eye, DollarSign, Users, AlertTriangle, Trash2,
} from 'lucide-react';

const inputClass =
  'w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3] transition-colors';

const BLANK = {
  company_name: '',
  week_start: new Date().toISOString().slice(0, 10),
  impressions: '',
  clicks: '',
  leads: '',
  spend: '',
  cpl: '',
  ctr: '',
  notes: '',
};

function delta(curr, prev) {
  if (!prev || !curr) return null;
  const pct = ((curr - prev) / prev) * 100;
  return pct;
}

function StatTile({ label, value, prev, icon: Icon, color, prefix = '', suffix = '' }) {
  const pct = prev != null ? delta(Number(value), Number(prev)) : null;
  const up = pct != null && pct >= 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={13} className={color} />
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <div className={`text-xl font-bold ${color}`}>
        {value != null ? `${prefix}${Number(value).toLocaleString()}${suffix}` : '—'}
      </div>
      {pct != null && (
        <div className={`flex items-center gap-1 text-[10px] font-semibold mt-0.5 ${up ? 'text-emerald-600' : 'text-red-500'}`}>
          {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {Math.abs(pct).toFixed(1)}% vs prev week
        </div>
      )}
    </div>
  );
}

function MetricRow({ row, onDelete }) {
  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50 transition-colors group">
      <td className="px-3 py-2.5 text-xs font-medium text-slate-700 whitespace-nowrap">{row.company_name}</td>
      <td className="px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap">{row.week_start}</td>
      <td className="px-3 py-2.5 text-xs text-slate-600 text-right">{row.impressions?.toLocaleString() ?? '—'}</td>
      <td className="px-3 py-2.5 text-xs text-slate-600 text-right">{row.clicks?.toLocaleString() ?? '—'}</td>
      <td className="px-3 py-2.5 text-xs font-semibold text-[#2196F3] text-right">{row.leads ?? '—'}</td>
      <td className="px-3 py-2.5 text-xs text-slate-600 text-right">{row.spend != null ? `$${Number(row.spend).toLocaleString()}` : '—'}</td>
      <td className="px-3 py-2.5 text-xs text-slate-600 text-right">{row.cpl != null ? `$${Number(row.cpl).toFixed(0)}` : '—'}</td>
      <td className="px-3 py-2.5 text-xs text-slate-600 text-right">{row.ctr != null ? `${Number(row.ctr).toFixed(1)}%` : '—'}</td>
      <td className="px-3 py-2.5 text-xs text-slate-400 max-w-[160px] truncate">{row.notes || ''}</td>
      <td className="px-3 py-2.5 text-right">
        <button
          onClick={() => onDelete(row.id)}
          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"
        >
          <Trash2 size={12} />
        </button>
      </td>
    </tr>
  );
}

export default function Performance() {
  const [rows,     setRows]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showAdd,  setShowAdd]  = useState(false);
  const [form,     setForm]     = useState(BLANK);
  const [saving,   setSaving]   = useState(false);
  const [filter,   setFilter]   = useState('');   // filter by company name

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) { setLoading(false); return; }
    const { data } = await supabase
      .from('campaign_metrics')
      .select('*')
      .order('week_start', { ascending: false });
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    if (!isSupabaseConfigured() || !supabase) return;
    setSaving(true);

    const payload = { ...form };
    // convert empty strings to null for numeric fields
    ['impressions','clicks','leads','spend','cpl','ctr'].forEach(k => {
      payload[k] = payload[k] !== '' ? Number(payload[k]) : null;
    });
    if (!payload.notes) delete payload.notes;

    // Compute CPL if missing
    if (!payload.cpl && payload.spend && payload.leads) {
      payload.cpl = +(payload.spend / payload.leads).toFixed(2);
    }
    // Compute CTR if missing
    if (!payload.ctr && payload.clicks && payload.impressions) {
      payload.ctr = +((payload.clicks / payload.impressions) * 100).toFixed(2);
    }

    const { data, error } = await supabase
      .from('campaign_metrics')
      .upsert(payload, { onConflict: 'company_name,week_start', ignoreDuplicates: false })
      .select()
      .single();

    if (!error && data) {
      setRows(prev => {
        const idx = prev.findIndex(r => r.id === data.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = data;
          return updated;
        }
        return [data, ...prev];
      });
    }
    setForm(BLANK);
    setShowAdd(false);
    setSaving(false);
  };

  const deleteRow = async (id) => {
    if (!supabase) return;
    await supabase.from('campaign_metrics').delete().eq('id', id);
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const handleExport = () => {
    exportToCSV(
      rows.map(r => ({
        company:     r.company_name,
        week_start:  r.week_start,
        impressions: r.impressions,
        clicks:      r.clicks,
        leads:       r.leads,
        spend:       r.spend,
        cpl:         r.cpl,
        ctr:         r.ctr,
        notes:       r.notes,
      })),
      'campaign-metrics'
    );
  };

  // ── Derived stats (most recent week across all clients) ─────────────────────
  const companies = [...new Set(rows.map(r => r.company_name))];
  const filtered  = filter ? rows.filter(r => r.company_name === filter) : rows;

  // Totals across displayed rows
  const totals = filtered.reduce(
    (acc, r) => ({
      impressions: acc.impressions + (r.impressions || 0),
      clicks:      acc.clicks      + (r.clicks      || 0),
      leads:       acc.leads       + (r.leads        || 0),
      spend:       acc.spend       + (Number(r.spend) || 0),
    }),
    { impressions: 0, clicks: 0, leads: 0, spend: 0 }
  );

  const avgCPL = totals.leads > 0 ? (totals.spend / totals.leads) : null;

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Campaign Performance</h1>
          <p className="text-sm text-slate-500 mt-1">Manual Google Ads metrics — feeds Agent 13 (Weekly Reporter) &amp; Agent 14 (Optimizer)</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {rows.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Download size={14} /> Export CSV
            </button>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#2196F3] text-white text-sm font-medium hover:bg-[#1565C0] transition-colors"
          >
            <Plus size={14} /> Add week
          </button>
        </div>
      </div>

      {/* Not connected warning */}
      {!isSupabaseConfigured() && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5 mb-5">
          <AlertTriangle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-amber-800">Supabase not connected</div>
            <div className="text-xs text-amber-700 mt-0.5">
              Campaign metrics requires Supabase. Run <code className="font-mono font-semibold">supabase-schema-v6.sql</code> in your SQL Editor to create the table.
            </div>
          </div>
        </div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatTile label="Impressions"  value={totals.impressions || null} icon={Eye}          color="text-slate-700" />
        <StatTile label="Clicks"       value={totals.clicks      || null} icon={MousePointer} color="text-[#2196F3]" />
        <StatTile label="Leads"        value={totals.leads       || null} icon={Users}        color="text-emerald-600" />
        <StatTile label="Avg CPL"      value={avgCPL ? avgCPL.toFixed(0) : null} icon={DollarSign} color="text-[#F97316]" prefix="$" />
      </div>

      {/* Company filter */}
      {companies.length > 1 && (
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 mb-5 shadow-sm overflow-x-auto">
          <button
            onClick={() => setFilter('')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              !filter ? 'bg-[#2196F3] text-white' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            All clients
          </button>
          {companies.map(c => (
            <button
              key={c}
              onClick={() => setFilter(c === filter ? '' : c)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                filter === c ? 'bg-[#2196F3] text-white' : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-8">
          <Loader size={13} className="animate-spin text-[#2196F3]" /> Loading metrics…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <BarChart2 size={28} className="mx-auto text-slate-200 mb-3" />
          <div className="text-sm font-medium text-slate-500">No metrics yet</div>
          <div className="text-xs text-slate-400 mt-1">
            Click "Add week" to enter Google Ads data for each client. The data feeds Agent 13 &amp; 14 for automated reporting.
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-4 inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#2196F3] text-white text-sm font-medium hover:bg-[#1565C0] transition-colors"
          >
            <Plus size={14} /> Add first week
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Company','Week','Impressions','Clicks','Leads','Spend','CPL','CTR','Notes',''].map(h => (
                    <th key={h} className={`px-3 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide ${
                      ['Impressions','Clicks','Leads','Spend','CPL','CTR'].includes(h) ? 'text-right' : ''
                    }`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <MetricRow key={row.id} row={row} onDelete={deleteRow} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-400">{filtered.length} week{filtered.length !== 1 ? 's' : ''} of data</span>
            <span className="text-xs text-slate-400">Hover a row to delete · Duplicate entries update the existing row</span>
          </div>
        </div>
      )}

      {/* Agent 13/14 hint */}
      {rows.length > 0 && (
        <div className="mt-4 flex items-start gap-3 bg-[#EEF6FE] border border-[#2196F3]/20 rounded-xl px-4 py-3.5">
          <TrendingUp size={14} className="text-[#2196F3] mt-0.5 flex-shrink-0" />
          <div className="text-xs text-[#1565C0]">
            <span className="font-semibold">Tip:</span> When running Agent 13 (Weekly Reporter) or Agent 14 (Campaign Optimizer), paste the latest row's numbers into the context field on the Agent Network page for AI-generated reports.
          </div>
        </div>
      )}

      {/* ── Add week modal ─────────────────────────────────────────────────────── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
              <h3 className="text-base font-semibold text-slate-900">Add weekly metrics</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>

            <form onSubmit={save} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Client / Company *</label>
                  <input
                    required
                    value={form.company_name}
                    onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                    placeholder="ABC Roofing"
                    className={inputClass}
                    autoFocus
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Week start date *</label>
                  <input
                    required
                    type="date"
                    value={form.week_start}
                    onChange={e => setForm(f => ({ ...f, week_start: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Impressions</label>
                  <input type="number" value={form.impressions} onChange={e => setForm(f => ({ ...f, impressions: e.target.value }))} placeholder="8420" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Clicks</label>
                  <input type="number" value={form.clicks} onChange={e => setForm(f => ({ ...f, clicks: e.target.value }))} placeholder="312" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Leads (conversions)</label>
                  <input type="number" value={form.leads} onChange={e => setForm(f => ({ ...f, leads: e.target.value }))} placeholder="18" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Ad spend ($)</label>
                  <input type="number" step="0.01" value={form.spend} onChange={e => setForm(f => ({ ...f, spend: e.target.value }))} placeholder="756.00" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">CPL ($) <span className="text-slate-300 font-normal">— auto if blank</span></label>
                  <input type="number" step="0.01" value={form.cpl} onChange={e => setForm(f => ({ ...f, cpl: e.target.value }))} placeholder="42.00" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">CTR (%) <span className="text-slate-300 font-normal">— auto if blank</span></label>
                  <input type="number" step="0.01" value={form.ctr} onChange={e => setForm(f => ({ ...f, ctr: e.target.value }))} placeholder="3.70" className={inputClass} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Account suspended mid-week, restored Thursday. Exclude from lifetime avg."
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 h-10 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 h-10 rounded-lg bg-[#2196F3] text-white text-sm font-medium hover:bg-[#1565C0] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <Loader size={13} className="animate-spin" />}
                  {saving ? 'Saving…' : 'Save metrics'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
