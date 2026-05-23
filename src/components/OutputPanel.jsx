import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function OutputPanel({ output, agentName }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!output) return null;

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white">
        <span className="text-xs font-medium text-slate-500">{agentName} output</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors"
        >
          {copied
            ? <><Check size={12} className="text-emerald-500" /> Copied</>
            : <><Copy size={12} /> Copy</>
          }
        </button>
      </div>
      <div className="p-4 max-h-80 overflow-y-auto">
        <pre className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-mono">{output}</pre>
      </div>
    </div>
  );
}
