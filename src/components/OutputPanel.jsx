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

    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">

      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white">

        <span className="text-xs font-mono text-gray-500">{agentName} output</span>

        <button

          onClick={copy}

          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"

        >

          {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}

          {copied ? 'copied' : 'copy'}

        </button>

      </div>

      <div className="p-3 max-h-80 overflow-y-auto">

        <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap leading-relaxed">{output}</pre>

      </div>

    </div>

  );

}
