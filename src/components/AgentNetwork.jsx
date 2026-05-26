import { useState } from 'react';
import { Search, Filter, Mail, Key, Megaphone, Layout, BarChart2, Play, Loader, AlertTriangle } from 'lucide-react';
import { SYSTEM_PROMPTS } from '../agents/systemPrompts';
import { runAllAgents, isDemoMode } from '../agents/orchestrator';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import StatusDot from './StatusDot';
import OutputPanel from './OutputPanel';

const NICHES = [
  'roofing contractors', 'foundation repair companies', 'personal injury law firms',
  'HVAC companies', 'plumbing companies', 'solar installation companies',
  'general contractors', 'window and siding companies',
];

const AGENT_META = {
  1: { name: 'Prospect Finder',    icon: Search,    wave: 1, deps: [],             color: 'blue' },
  2: { name: 'Qualifier',          icon: Filter,    wave: 2, deps: [1],            color: 'indigo' },
  3: { name: 'Outreach Writer',    icon: Mail,      wave: 3, deps: [1, 2],         color: 'violet' },
  4: { name: 'Keyword Researcher', icon: Key,       wave: 1, deps: [],             color: 'orange' },
  5: { name: 'Ad Copy Generator',  icon: Megaphone, wave: 2, deps: [4],            color: 'amber' },
  6: { name: 'LP Builder',         icon: Layout,    wave: 3, deps: [4, 5],         color: 'teal' },
  7: { name: 'Campaign Auditor',   icon: BarChart2, wave: 4, deps: [1,2,3,4,5,6], color: 'slate' },
};

const WAVES = [[1, 4], [2, 5], [3, 6], [7]];
const WAVE_LABELS = ['Wave 1 — parallel', 'Wave 2 — parallel', 'Wave 3 — parallel', 'Wave 4 — final'];

// done-state background per agent color
const doneCardStyle = {
  blue:   { card: 'border-blue-200 bg-blue-50',     icon: 'bg-blue-100 text-blue-600' },
  indigo: { card: 'border-indigo-200 bg-indigo-50', icon: 'bg-indigo-100 text-indigo-600' },
  violet: { card: 'border-violet-200 bg-violet-50', icon: 'bg-violet-100 text-violet-600' },
  orange: { card: 'border-orange-200 bg-orange-50', icon: 'bg-orange-100 text-orange-600' },
  amber:  { card: 'border-amber-200 bg-amber-50',   icon: 'bg-amber-100 text-amber-600' },
  teal:   { card: 'border-teal-200 bg-teal-50',     icon: 'bg-teal-100 text-teal-600' },
  slate:  { card: 'border-slate-200 bg-slate-50',   icon: 'bg-slate-100 text-slate-600' },
};

const initState = () =>
  Object.fromEntries(Object.keys(AGENT_META).map(k => [k, { status: 'idle', output: '', error: '' }]));

export default function AgentNetwork() {
  const [niche, setNiche] = useState('roofing contractors');
  const [location, setLocation] = useState('');
  const [extra, setExtra] = useState('');
  const [agentState, setAgentState] = useState(initState());
  const [log, setLog] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  const addLog = (msg) => setLog(p => [...p, {
    t: new Date().toLocaleTimeString('en-US', { hour12: false }),
    msg,
  }]);

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
    setAgentState(initState());
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
          run_id: runId,
          agent_id: id,
          agent_name: AGENT_META[id].name,
          output: output || null,
          status,
        });
      }
    };

    await runAllAgents(
      { niche, location, extraContext: extra },
      SYSTEM_PROMPTS,
      wrappedStatusChange,
      addLog
    );

    if (runId && isSupabaseConfigured() && supabase) {
      const hasError = Object.values(finalOutputs).some(o => o.status === 'error');
      await supabase.from('runs').update({ status: hasError ? 'error' : 'complete' }).eq('id', runId);
    }

    setRunning(false);
    setFinished(true);
  };

  const completedCount = Object.values(agentState).filter(a => a.status === 'done').length;
  const errorCount    = Object.values(agentState).filter(a => a.status === 'error').length;

  const inputClass = "w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3] transition-colors disabled:opacity-50 disabled:bg-slate-50";

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Agent Network</h1>
        <p className="text-sm text-slate-500 mt-1">7 specialists · 4 execution waves · synchronized context</p>
      </div>

      {/* Demo mode banner */}
      {isDemoMode() && (
        <div className="mb-5 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
          <AlertTriangle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-amber-800">Demo mode — sample outputs</div>
            <div className="text-xs text-amber-700 mt-0.5">
              No Anthropic API key detected. Agents run with pre-built example outputs for roofing / Fairfax, VA.
              Add <code className="font-mono font-semibold">VITE_ANTHROPIC_API_KEY</code> to .env to run live.
            </div>
          </div>
        </div>
      )}

      {/* Controls card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
        <div className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-4">Campaign settings</div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Niche</label>
            <select
              value={niche}
              onChange={e => setNiche(e.target.value)}
              disabled={running}
              className={inputClass}
            >
              {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Location</label>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              disabled={running}
              className={inputClass}
            />
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Additional context</label>
          <input
            value={extra}
            onChange={e => setExtra(e.target.value)}
            disabled={running}
            placeholder="budget range, target job size, specific services..."
            className={inputClass}
          />
        </div>

        <button
          onClick={run}
          disabled={running}
          className={`w-full flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-medium transition-colors ${
            running
              ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
              : 'bg-[#2196F3] text-white hover:bg-[#1565C0]'
          }`}
        >
          {running ? (
            <><Loader size={14} className="animate-spin" /> Running — {completedCount}/7 complete{errorCount > 0 ? ` · ${errorCount} error` : ''}</>
          ) : (
            <><Play size={14} /> {finished ? 'Run again' : 'Run all agents'}</>
          )}
        </button>
      </div>

      {/* Pipeline */}
      <div className="space-y-6">
        {WAVES.map((waveAgents, wi) => (
          <div key={wi}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest whitespace-nowrap">
                {WAVE_LABELS[wi]}
              </span>
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-300 font-medium">
                {waveAgents.map(id => `A${id}`).join(' + ')}
              </span>
            </div>

            <div className={`grid gap-3 ${waveAgents.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {waveAgents.map(id => {
                const meta = AGENT_META[id];
                const state = agentState[id];
                const Icon = meta.icon;
                const isExpanded = expanded === id;
                const isDone = state.status === 'done';
                const isError = state.status === 'error';
                const isRunning = state.status === 'running';
                const style = doneCardStyle[meta.color];

                return (
                  <div
                    key={id}
                    className={`rounded-xl border p-4 transition-all duration-200 ${
                      isDone  ? style.card :
                      isError ? 'border-red-200 bg-red-50' :
                      isRunning ? 'border-[#2196F3]/30 bg-[#EEF6FE]' :
                      'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isDone    ? style.icon :
                          isRunning ? 'bg-[#2196F3]/10 text-[#2196F3]' :
                          'bg-slate-100 text-slate-400'
                        }`}>
                          <Icon size={15} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">
                            A{id} · {meta.name}
                          </div>
                          <StatusDot status={state.status} />
                        </div>
                      </div>
                      {isDone && (
                        <button
                          onClick={() => setExpanded(isExpanded ? null : id)}
                          className="text-xs font-medium text-slate-400 hover:text-[#2196F3] transition-colors px-2 py-1 rounded-lg border border-transparent hover:border-slate-200 hover:bg-white"
                        >
                          {isExpanded ? 'Close' : 'View ↓'}
                        </button>
                      )}
                    </div>

                    {meta.deps.length > 0 && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 text-xs text-slate-400">
                        ← receives: {meta.deps.map(d => `A${d}`).join(', ')}
                      </div>
                    )}

                    {isError && (
                      <div className="mt-2.5 pt-2.5 border-t border-red-200 text-xs text-red-500">
                        {state.error}
                      </div>
                    )}

                    {isExpanded && isDone && (
                      <OutputPanel output={state.output} agentName={meta.name} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Activity log */}
      {log.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Activity log</span>
          </div>
          <div className="p-4 max-h-48 overflow-y-auto space-y-1 bg-slate-900 rounded-b-xl">
            {log.map((l, i) => (
              <div key={i} className="text-xs font-mono flex gap-3">
                <span className="text-slate-600 flex-shrink-0">{l.t}</span>
                <span className={
                  l.msg.includes('ERROR')    ? 'text-red-400' :
                  l.msg.includes('complete') || l.msg.includes('All agents') ? 'text-emerald-400' :
                  l.msg.includes('started')  ? 'text-[#2196F3]' :
                  l.msg.includes('initialized') ? 'text-[#F97316]' :
                  'text-slate-400'
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
  );
}
