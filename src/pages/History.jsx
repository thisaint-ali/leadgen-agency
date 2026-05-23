import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ChevronDown, ChevronRight } from 'lucide-react';
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

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={load}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
          <div>
            <div className="text-sm font-medium font-mono text-gray-800">{run.niche}</div>
            <div className="text-xs font-mono text-gray-400">{run.location} · {date}</div>
          </div>
        </div>
        <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
          run.status === 'complete' ? 'bg-emerald-50 text-emerald-600' :
          run.status === 'error'    ? 'bg-red-50 text-red-500' :
                                      'bg-amber-50 text-amber-600'
        }`}>
          {run.status}
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-3">
          {run.extra_context && (
            <div className="text-xs font-mono text-gray-500">
              <span className="text-gray-400">context:</span> {run.extra_context}
            </div>
          )}
          {loading && <div className="text-xs font-mono text-gray-400">loading outputs...</div>}
          {outputs.map(o => (
            <div key={o.id}>
              <div className="text-xs font-mono text-gray-500 mb-1">
                A{o.agent_id} · {AGENT_NAMES[o.agent_id]}
                <span className={`ml-2 ${o.status === 'done' ? 'text-emerald-500' : 'text-red-400'}`}>
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
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
          <div>
            <div className="text-sm font-medium font-mono text-gray-800">{s.niche}</div>
            <div className="text-xs font-mono text-gray-400">{s.location} · {date}</div>
          </div>
        </div>
      </button>
      {open && s.output && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
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
        <h1 className="text-xl font-semibold font-mono text-gray-900">History</h1>
        <p className="text-sm text-gray-500 font-mono mt-1">All stored runs and prospect searches</p>
      </div>

      <div className="flex gap-1 mb-5 border border-gray-100 rounded-lg p-1 w-fit">
        {[['runs', `Agent Runs (${runs.length})`], ['searches', `Prospect Searches (${searches.length})`]].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
              tab === id ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!isSupabaseConfigured() && (
        <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 mb-4">
          <span className="text-amber-500 font-mono text-sm mt-0.5">◈</span>
          <div>
            <div className="text-sm font-medium font-mono text-amber-800">Supabase not connected</div>
            <div className="text-xs font-mono text-amber-600 mt-0.5">
              History requires Supabase. Add <span className="font-semibold">VITE_SUPABASE_URL</span> and <span className="font-semibold">VITE_SUPABASE_ANON_KEY</span> to your environment variables.
            </div>
          </div>
        </div>
      )}

      {loading && <div className="text-xs font-mono text-gray-400">loading...</div>}

      {!loading && tab === 'runs' && (
        <div className="space-y-3">
          {runs.length === 0
            ? <div className="text-xs font-mono text-gray-400">no runs yet — go to Agent Network to run your first campaign</div>
            : runs.map(r => <RunRow key={r.id} run={r} />)
          }
        </div>
      )}

      {!loading && tab === 'searches' && (
        <div className="space-y-3">
          {searches.length === 0
            ? <div className="text-xs font-mono text-gray-400">no searches yet — go to Prospect Finder to search</div>
            : searches.map(s => <SearchRow key={s.id} s={s} />)
          }
        </div>
      )}
    </div>
  );
}
