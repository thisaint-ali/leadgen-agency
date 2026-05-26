import { ExternalLink, CheckCircle2, XCircle, Zap } from 'lucide-react';
import { INTEGRATIONS, getConnectedCount } from '../integrations/index';

const CATEGORY_ORDER = ['Core', 'Outreach', 'Ads', 'CRM / Funnels'];

function IntegrationCard({ integration }) {
  const connected = integration.connected();

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-5 transition-all ${
      connected ? 'border-emerald-200' : 'border-slate-200'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
            connected ? 'bg-emerald-50' : 'bg-slate-50'
          }`}>
            {integration.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{integration.name}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                connected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {integration.category}
              </span>
            </div>
            <div className={`flex items-center gap-1.5 mt-0.5 text-xs font-medium ${
              connected ? 'text-emerald-600' : 'text-slate-400'
            }`}>
              {connected
                ? <><CheckCircle2 size={12} /> Connected</>
                : <><XCircle size={12} /> Not connected</>
              }
            </div>
          </div>
        </div>
      </div>

      {/* What it unlocks */}
      <div className="mb-4">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Unlocks</div>
        <ul className="space-y-1.5">
          {integration.unlocks.map(u => (
            <li key={u} className="flex items-start gap-2 text-xs text-slate-600">
              <Zap size={10} className={`mt-0.5 flex-shrink-0 ${connected ? 'text-emerald-500' : 'text-slate-300'}`} />
              {u}
            </li>
          ))}
        </ul>
      </div>

      {/* Setup */}
      {!connected && (
        <div className="mb-4 bg-slate-50 rounded-lg p-3 border border-slate-100">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">How to connect</div>
          <p className="text-xs text-slate-600 leading-relaxed">{integration.setupInstructions}</p>
          <div className="mt-2 font-mono text-[11px] bg-white border border-slate-200 rounded px-2 py-1 text-slate-500">
            {integration.envKey}=your_key_here
          </div>
        </div>
      )}

      {connected && (
        <div className="mb-4 bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-100">
          <div className="text-xs text-emerald-700 font-medium">✅ Active — all features unlocked</div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <a
          href={integration.getKeyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <ExternalLink size={11} />
          {connected ? 'Manage key' : 'Get API key'}
        </a>
        <a
          href={integration.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <ExternalLink size={11} />
          Docs
        </a>
      </div>
    </div>
  );
}

export default function Integrations() {
  const connectedCount = getConnectedCount();
  const total = Object.keys(INTEGRATIONS).length;

  const byCategory = CATEGORY_ORDER.map(cat => ({
    category: cat,
    items: Object.values(INTEGRATIONS).filter(i => i.category === cat),
  })).filter(g => g.items.length > 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Integrations</h1>
        <p className="text-sm text-slate-500 mt-1">Connect APIs to unlock full automation — each one removes a manual step</p>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-slate-800">
            {connectedCount} / {total} connected
          </div>
          <div className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            connectedCount === total
              ? 'bg-emerald-100 text-emerald-700'
              : connectedCount === 0
              ? 'bg-slate-100 text-slate-500'
              : 'bg-amber-100 text-amber-700'
          }`}>
            {connectedCount === total ? 'Fully automated' : connectedCount === 0 ? 'Not started' : 'Partial automation'}
          </div>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#2196F3] to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${(connectedCount / total) * 100}%` }}
          />
        </div>
        <div className="mt-3 text-xs text-slate-400">
          {connectedCount === total
            ? 'All integrations connected. Agents handle everything automatically after a client is signed.'
            : `Add ${total - connectedCount} more connection${total - connectedCount !== 1 ? 's' : ''} to reach full autopilot mode.`
          }
        </div>
      </div>

      {/* What full automation looks like */}
      <div className="bg-[#1B3A5C] rounded-xl p-5 mb-6 text-white">
        <div className="text-xs font-semibold text-slate-300 uppercase tracking-widest mb-3">When all 4 are connected — the full flow</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { step: '1', label: 'You close client on call', sub: 'Mark as client in Pipeline' },
            { step: '2', label: 'Agents build the campaign', sub: 'Keywords → Ad copy → LP brief → Audit' },
            { step: '3', label: 'Campaign goes live', sub: 'Auto-pushed to Google Ads' },
            { step: '4', label: 'Client synced to GHL', sub: 'Contact + funnel created automatically' },
          ].map(({ step, label, sub }) => (
            <div key={step} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#2196F3] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{step}</span>
                <span className="text-sm font-medium">{label}</span>
              </div>
              <span className="text-xs text-slate-400 ml-7">{sub}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cards by category */}
      {byCategory.map(({ category, items }) => (
        <div key={category} className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{category}</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <div className={`grid gap-4 ${items.length === 1 ? 'grid-cols-1 max-w-lg' : 'grid-cols-1 md:grid-cols-2'}`}>
            {items.map(i => <IntegrationCard key={i.key} integration={i} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
