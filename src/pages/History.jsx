import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import OutputPanel from '../components/OutputPanel';

const AGENT_NAMES = {
  1: 'Prospect Finder',
  2: 'Qualifier',
  3: 'Outreach Writer',
  4: 'Keyword Researcher',
  5: 'Ad Copy Generator',
  6: 'LP Builder',
  7: 'Campaign Auditor',
};

function RunRow({ run }) {
  const [open, setOpen] = useState(false);
  const [outputs, setOutputs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    if (loaded) { setOpen(o => !o); return; }
    setOpen(true);
    setLoading(true);
    const { data } = await supabase
      .from('agent_outputs')
      .select('*')
      .eq('run_id', run.id)
      .order('agent_id');
    setOutputs(data || []);
    setLoaded(true);
    setLoading(false);
  };

  const date = new Date(run.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const statusStyle = {
    complete: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    error:    'bg-red-50 text-red-500 border border-red-200',
    running:  'bg-amber-50 text-amber-600 border border-amber-200',
  }[run.status] || 'bg-slate-100 text-slate-500';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={load}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {open
            ? <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
            : <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />
          }
          <div>
            <div className="text-sm font-semibold text-slate-800">{run.niche}</div>
            <div className="text-xs text-slate-400 mt-0.5">{run.location} · {date}</div>
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyle}`}>
          {run.status}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 space-y-3">
          {run.extra_context && (
            <div className="text-xs text-slate-500">
              <span className="text-slate-400 font-medium">Context:</span> {run.extra_context}
            </div>
          )}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="w-3 h-3 border border-[#2196F3] border-t-transparent rounded-full animate-spin" />
              Loading outputs…
            </div>
          )}
          {outputs.map(o => (
            <div key={o.id}>
              <div className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-2">
                A{o.agent_id} · {AGENT_NAMES[o.agent_id]}
                <span className={o.status === 'done' ? 'text-emerald-500' : 'text-red-400'}>
                  {o.status}
                </span>
              </div>
              {o.output && <OutputPanel output={o.output} agentName={AGENT_NAMES[o.agent_id]} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchRow({ s }) {
  const [open, setOpen] = useState(false);
  const date = new Date(s.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {open
            ? <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
            : <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />
          }
          <div>
            <div className="text-sm font-semibold text-slate-800">{s.niche}</div>
            <div className="text-xs text-slate-400 mt-0.5">{s.location} · {date}</div>
          </div>
        </div>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#EEF6FE] text-[#2196F3] border border-blue-200">
          prospect search
        </span>
      </button>
      {open && s.output && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
          <OutputPanel output={s.output} agentName="Prospect Finder" />
        </div>
      )}
    </div>
  );
}

export default function History() {
  const [runs, setRuns] = useState([]);
  const [searches, setSearches] = useState([]);
  const [tab, setTab] = useState('runs');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured() || !supabase) {
        setLoading(false);
        return;
      }
      const [{ data: r }, { data: s }] = await Promise.all([
        supabase.from('runs').select('*').order('created_at', { ascending: false }),
        supabase.from('prospect_searches').select('*').order('created_at', { ascending: false }),
      ]);
      setRuns(r || []);
      setSearches(s || []);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">History</h1>
        <p className="text-sm text-slate-500 mt-1">All stored runs and prospect searches</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-5 bg-white border border-slate-200 rounded-lg p-1 w-fit shadow-sm">
        {[['runs', `Agent Runs (${runs.length})`], ['searches', `Prospect Searches (${searches.length})`]].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-1.5 rounded text-xs font-medium transition-colors ${
              tab === id
                ? 'bg-[#2196F3] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Not connected warning */}
      {!isSupabaseConfigured() && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5 mb-5">
          <AlertTriangle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-amber-800">Supabase not connected</div>
            <div className="text-xs text-amber-700 mt-0.5">
              History requires Supabase. Add <code className="font-mono font-semibold">VITE_SUPABASE_URL</code> and{' '}
              <code className="font-mono font-semibold">VITE_SUPABASE_ANON_KEY</code> to your environment variables.
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <div className="w-3 h-3 border border-[#2196F3] border-t-transparent rounded-full animate-spin" />
          Loading…
        </div>
      )}

      {!loading && tab === 'runs' && (
        <div className="space-y-3">
          {runs.length === 0
            ? <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-sm text-slate-400">
                No runs yet — go to Agent Network to run your first campaign
              </div>
            : runs.map(r => <RunRow key={r.id} run={r} />)
          }
        </div>
      )}

      {!loading && tab === 'searches' && (
        <div className="space-y-3">
          {searches.length === 0
            ? <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-sm text-slate-400">
                No searches yet — go to Prospect Finder to search
              </div>
            : searches.map(s => <SearchRow key={s.id} s={s} />)
          }
        </div>
      )}
    </div>
  );
}
