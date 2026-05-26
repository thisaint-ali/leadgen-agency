import { useState } from 'react';
import { Search, Loader, AlertTriangle } from 'lucide-react';
import CitySearch from './CitySearch';
import { callAgent, isDemoMode } from '../agents/orchestrator';
import { SYSTEM_PROMPTS } from '../agents/systemPrompts';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import OutputPanel from './OutputPanel';

const NICHES = [
  'roofing contractors', 'foundation repair companies', 'personal injury law firms',
  'HVAC companies', 'plumbing companies', 'solar installation companies',
  'general contractors', 'window and siding companies',
];

export default function ProspectFinder() {
  const [niche, setNiche] = useState('roofing contractors');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('idle');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const search = async () => {
    if (status === 'running') return;
    setOutput('');
    setError('');

    let finalOutput = '';

    await callAgent(
      1,
      SYSTEM_PROMPTS[1],
      `Niche: ${niche}. Location: ${location}. Find real businesses to target as lead gen clients. Use web search.`,
      (id, s, out, err) => {
        setStatus(s);
        if (out) { setOutput(out); finalOutput = out; }
        if (err) setError(err);
      }
    );

    if (finalOutput && isSupabaseConfigured() && supabase) {
      await supabase.from('prospect_searches').insert({ niche, location, output: finalOutput });
    }
  };

  const inputClass = "w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3] transition-colors disabled:opacity-50 disabled:bg-slate-50";

  return (
    <div className="p-6 max-w-3xl mx-auto">

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Prospect Finder</h1>
        <p className="text-sm text-slate-500 mt-1">Find and score lead gen client targets in any niche and location</p>
      </div>

      {isDemoMode() && (
        <div className="mb-5 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
          <AlertTriangle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-amber-800">Demo mode — sample output</div>
            <div className="text-xs text-amber-700 mt-0.5">
              Returns pre-built prospect list for roofing / Fairfax, VA regardless of inputs.
              Add <code className="font-mono font-semibold">VITE_ANTHROPIC_API_KEY</code> to .env to search live.
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
        <div className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-4">Search settings</div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Niche</label>
            <select
              value={niche}
              onChange={e => setNiche(e.target.value)}
              disabled={status === 'running'}
              className={inputClass}
            >
              {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Location</label>
            <CitySearch
              value={location}
              onChange={setLocation}
              disabled={status === 'running'}
            />
          </div>
        </div>

        <button
          onClick={search}
          disabled={status === 'running'}
          className={`w-full flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-medium transition-colors ${
            status === 'running'
              ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
              : 'bg-[#2196F3] text-white hover:bg-[#1565C0]'
          }`}
        >
          {status === 'running'
            ? <><Loader size={14} className="animate-spin" /> Searching…</>
            : <><Search size={14} /> Find prospects</>
          }
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-600 border border-red-200 rounded-xl p-4 bg-red-50 mb-4">
          {error}
        </div>
      )}

      {output && (
        <>
          <OutputPanel output={output} agentName="Prospect Finder" />
          <div className="mt-2 text-xs text-slate-400 text-right">Saved to history</div>
        </>
      )}
    </div>
  );
}
