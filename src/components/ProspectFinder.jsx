import { useState } from 'react';
import { Search, Loader } from 'lucide-react';
import { callAgent } from '../agents/orchestrator';
import { SYSTEM_PROMPTS } from '../agents/systemPrompts';
import { supabase } from '../lib/supabase';
import OutputPanel from './OutputPanel';

const NICHES = [
  'roofing contractors', 'foundation repair companies', 'personal injury law firms',
  'HVAC companies', 'plumbing companies', 'solar installation companies',
  'general contractors', 'window and siding companies',
];

export default function ProspectFinder() {
  const [niche, setNiche] = useState('roofing contractors');
  const [location, setLocation] = useState('Fairfax, VA');
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

    // Save to Supabase
    if (finalOutput) {
      await supabase.from('prospect_searches').insert({
        niche,
        location,
        output: finalOutput,
      });
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 font-mono">Prospect Finder</h1>
        <p className="text-sm text-gray-500 mt-1 font-mono">Find and score lead gen client targets in any niche and location</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs text-gray-400 font-mono uppercase tracking-widest mb-1.5">Niche</label>
          <select
            value={niche}
            onChange={e => setNiche(e.target.value)}
            disabled={status === 'running'}
            className="w-full text-sm font-mono border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-gray-400"
          >
            {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 font-mono uppercase tracking-widest mb-1.5">Location</label>
          <input
            value={location}
            onChange={e => setLocation(e.target.value)}
            disabled={status === 'running'}
            className="w-full text-sm font-mono border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
          />
        </div>
      </div>

      <button
        onClick={search}
        disabled={status === 'running'}
        className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-gray-200 text-sm font-mono text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 mb-6"
      >
        {status === 'running'
          ? <><Loader size={14} className="animate-spin" /> searching...</>
          : <><Search size={14} /> find prospects</>
        }
      </button>

      {error && (
        <div className="text-xs font-mono text-red-500 border border-red-100 rounded-lg p-3 bg-red-50 mb-4">
          {error}
        </div>
      )}

      {output && (
        <>
          <OutputPanel output={output} agentName="Prospect Finder" />
          <div className="mt-2 text-xs font-mono text-gray-400">saved to history</div>
        </>
      )}
    </div>
  );
}
