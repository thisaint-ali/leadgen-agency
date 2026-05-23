import { useState } from 'react';
import { Search, Filter, Mail, Key, Megaphone, Layout, BarChart2, Play, Loader } from 'lucide-react';
import { SYSTEM_PROMPTS } from '../agents/systemPrompts';
import { runAllAgents, isDemoMode } from '../agents/orchestrator';
import { supabase } from '../lib/supabase';
import StatusDot from './StatusDot';
import OutputPanel from './OutputPanel';

const NICHES = [
  'roofing contractors', 'foundation repair companies', 'personal injury law firms',
  'HVAC companies', 'plumbing companies', 'solar installation companies',
  'general contractors', 'window and siding companies',
];

const AGENT_META = {
  1: { name: 'Prospect Finder',    icon: Search,    wave: 1, deps: [],             color: 'emerald' },
  2: { name: 'Qualifier',          icon: Filter,    wave: 2, deps: [1],            color: 'blue' },
  3: { name: 'Outreach Writer',    icon: Mail,      wave: 3, deps: [1, 2],         color: 'violet' },
  4: { name: 'Keyword Researcher', icon: Key,       wave: 1, deps: [],             color: 'amber' },
  5: { name: 'Ad Copy Generator',  icon: Megaphone, wave: 2, deps: [4],            color: 'orange' },
  6: { name: 'LP Builder',         icon: Layout,    wave: 3, deps: [4, 5],         color: 'green' },
  7: { name: 'Campaign Auditor',   icon: BarChart2, wave: 4, deps: [1,2,3,4,5,6], color: 'gray' },
};

const WAVES = [[1, 4], [2, 5], [3, 6], [7]];
const WAVE_LABELS = ['Wave 1 — parallel', 'Wave 2 — parallel', 'Wave 3 — parallel', 'Wave 4 — sequential'];

const initState = () =>
  Object.fromEntries(Object.keys(AGENT_META).map(k => [k, { status: 'idle', output: '', error: '' }]));

const colorMap = {
  emerald: 'border-emerald-200 bg-emerald-50',
  blue:    'border-blue-200 bg-blue-50',
  violet:  'border-violet-200 bg-violet-50',
  amber:   'border-amber-200 bg-amber-50',
  orange:  'border-orange-200 bg-orange-50',
  green:   'border-green-200 bg-green-50',
  gray:    'border-gray-200 bg-gray-50',
};

const iconColorMap = {
  emerald: 'text-emerald-600',
  blue:    'text-blue-600',
  violet:  'text-violet-600',
  amber:   'text-amber-600',
  orange:  'text-orange-600',
  green:   'text-green-600',
  gray:    'text-gray-500',
};

export default function AgentNetwork() {
  const [niche, setNiche] = useState('roofing contractors');
  const [location, setLocation] = useState('Fairfax, VA');
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

    // Create run record in Supabase
    const { data: runRow } = await supabase
      .from('runs')
      .insert({ niche, location, extra_context: extra || null, status: 'running' })
      .select()
      .single();

    const runId = runRow?.id;

    const finalOutputs = {};

    const wrappedStatusChange = (id, status, output = '', error = '') => {
      handleStatusChange(id, status, output, error);
      if ((status === 'done' || status === 'error') && runId) {
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

    // Mark run complete
    if (runId) {
      const hasError = Object.values(finalOutputs).some(o => o.status === 'error');
      await supabase.from('runs').update({ status: hasError ? 'error' : 'complete' }).eq('id', runId);
    }

    setRunning(false);
    setFinished(true);
  };

  const completedCount = Object.values(agentState).filter(a => a.status === 'done').length;
  const errorCount    = Object.values(agentState).filter(a => a.status === 'error').length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 font-mono">Agent Network</h1>
        <p className="text-sm text-gray-500 mt-1 font-mono">7 specialists · 4 execution waves · synchronized context</p>
      </div>

      {isDemoMode() && (
        <div className="mb-5 flex items-start gap-3 border border-amber-200 bg-amber-50 rounded-xl px-4 py-3">
          <span className="text-amber-500 font-mono text-sm mt-0.5">◈</span>
          <div>
            <div className="text-sm font-medium font-mono text-amber-800">Demo mode — sample outputs</div>
            <div className="text-xs font-mono text-amber-600 mt-0.5">
              No Anthropic API key detected. Agents will run with pre-built example outputs for roofing / Fairfax, VA.
              Add <span className="font-semibold">VITE_ANTHROPIC_API_KEY</span> to .env to run live.
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs text-gray-400 font-mono uppercase tracking-widest mb-1.5">Niche</label>
          <select
            value={niche}
            onChange={e => setNiche(e.target.value)}
            disabled={running}
            className="w-full text-sm font-mono border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-gray-400 disabled:opacity-50"
          >
            {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 font-mono uppercase tracking-widest mb-1.5">Location</label>
          <input
            value={location}
            onChange={e => setLocation(e.target.value)}
            disabled={running}
            className="w-full text-sm font-mono border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400 disabled:opacity-50"
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs text-gray-400 font-mono uppercase tracking-widest mb-1.5">Additional context</label>
        <input
          value={extra}
          onChange={e => setExtra(e.target.value)}
          disabled={running}
          placeholder="budget range, target job size, specific services..."
          className="w-full text-sm font-mono border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400 disabled:opacity-50"
        />
      </div>

      <button
        onClick={run}
        disabled={running}
        className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-gray-200 text-sm font-mono text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-6"
      >
        {running ? (
          <><Loader size={14} className="animate-spin" /> running — {completedCount}/7 complete{errorCount > 0 ? ` · ${errorCount} error` : ''}</>
        ) : (
          <><Play size={14} /> {finished ? 'run again' : 'run all agents'}</>
        )}
      </button>

      {/* Pipeline */}
      <div className="space-y-5">
        {WAVES.map((waveAgents, wi) => (
          <div key={wi}>
            <div className="flex items-center gap-3 mb-2.5">
              <span className="text-xs font-mono text-gray-400 uppercase tracking-widest whitespace-nowrap">
                {WAVE_LABELS[wi]}
              </span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className={`grid gap-3 ${waveAgents.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {waveAgents.map(id => {
                const meta = AGENT_META[id];
                const state = agentState[id];
                const Icon = meta.icon;
                const isExpanded = expanded === id;
                const isDone = state.status === 'done';
                const isError = state.status === 'error';

                return (
                  <div
                    key={id}
                    className={`rounded-xl border p-4 transition-all duration-200 ${
                      isDone ? colorMap[meta.color] : 'border-gray-100 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isDone ? 'bg-white/60' : 'bg-gray-50'
                        }`}>
                          <Icon size={15} className={isDone ? iconColorMap[meta.color] : 'text-gray-400'} />
                        </div>
                        <div>
                          <div className="text-sm font-medium font-mono text-gray-800">
                            A{id} · {meta.name}
                          </div>
                          <StatusDot status={state.status} />
                        </div>
                      </div>
                      {isDone && (
                        <button
                          onClick={() => setExpanded(isExpanded ? null : id)}
                          className="text-xs font-mono text-gray-400 hover:text-gray-700 transition-colors px-2 py-1 rounded border border-transparent hover:border-gray-200"
                        >
                          {isExpanded ? 'close' : 'view ↓'}
                        </button>
                      )}
                    </div>

                    {meta.deps.length > 0 && (
                      <div className="mt-2.5 pt-2.5 border-t border-gray-100 text-xs font-mono text-gray-400">
                        ← receives: {meta.deps.map(d => `A${d}`).join(', ')}
                      </div>
                    )}

                    {isError && (
                      <div className="mt-2.5 pt-2.5 border-t border-red-100 text-xs font-mono text-red-500">
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

      {/* Log */}
      {log.length > 0 && (
        <div className="mt-6">
          <div className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-2">Activity log</div>
          <div className="border border-gray-100 rounded-xl bg-gray-50 p-4 max-h-48 overflow-y-auto space-y-1">
            {log.map((l, i) => (
              <div key={i} className="text-xs font-mono">
                <span className="text-gray-300 mr-3">{l.t}</span>
                <span className={
                  l.msg.includes('ERROR')    ? 'text-red-500' :
                  l.msg.includes('complete') || l.msg.includes('All agents') ? 'text-emerald-600' :
                  l.msg.includes('starting') || l.msg.includes('initialized') ? 'text-amber-600' :
                  'text-gray-600'
                }>{l.msg}</span>
              </div>
            ))}
            {finished && (
              <div className="text-xs font-mono text-emerald-600 pt-1 border-t border-gray-200 mt-1">
                ■ system ready — click any agent card to view output · saved to history
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
