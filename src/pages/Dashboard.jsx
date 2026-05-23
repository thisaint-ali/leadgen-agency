import { Network, Search, Target, TrendingUp } from 'lucide-react';

const CARDS = [

  { icon: Network,    title: 'Agent Network',   body: 'Run all 7 specialist agents simultaneously. Synchronized context flows between waves automatically.', action: 'agents' },

  { icon: Search,     title: 'Prospect Finder',  body: 'Search any niche and location for scored, ranked lead gen client targets with specific fit rationale.', action: 'prospects' },

  { icon: Target,     title: 'Knowledge Base',   body: 'Full reference on niche selection, Google Ads setup, client qualification, sales, and scaling.', action: 'knowledge' },

  { icon: TrendingUp, title: 'Lead Economics',   body: 'Roofing: $100-200 CPL, $8k-25k avg job. Foundation: $80-150 CPL. PI: $200-600 CPL, $50k+ case value.', action: null },

];

export default function Dashboard({ onNavigate }) {

  return (

    <div className="p-6 max-w-4xl mx-auto">

      <div className="mb-8">

        <h1 className="text-2xl font-semibold font-mono text-gray-900">AMALeadx</h1>

        <p className="text-gray-500 font-mono text-sm mt-1">Google Ads lead generation agency — Fairfax, VA</p>

      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">

        {[

          { label: 'Target CPL',      value: '$80–200',  sub: 'roofing benchmark' },

          { label: 'Target Retainer', value: '$2,000',   sub: 'per client/month' },

          { label: 'Month 6 Goal',    value: '$20k',     sub: 'monthly revenue' },

          { label: 'Pre-College Goal', value: '$40–50k', sub: 'monthly revenue' },

        ].map(({ label, value, sub }) => (

          <div key={label} className="border border-gray-100 rounded-xl p-4 bg-white">

            <div className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">{label}</div>

            <div className="text-2xl font-semibold font-mono text-gray-900">{value}</div>

            <div className="text-xs font-mono text-gray-400 mt-0.5">{sub}</div>

          </div>

        ))}

      </div>

      <div className="grid grid-cols-2 gap-4">

        {CARDS.map(({ icon: Icon, title, body, action }) => (

          <div

            key={title}

            onClick={() => action && onNavigate(action)}

            className={`border border-gray-100 rounded-xl p-4 bg-white ${action ? 'cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all' : ''}`}

          >

            <div className="flex items-center gap-2.5 mb-2">

              <Icon size={16} className="text-gray-400" />

              <span className="text-sm font-medium font-mono text-gray-800">{title}</span>

            </div>

            <p className="text-xs font-mono text-gray-500 leading-relaxed">{body}</p>

            {action && (

              <div className="mt-3 text-xs font-mono text-gray-400 hover:text-gray-700">open →</div>

            )}

          </div>

        ))}

      </div>

    </div>

  );

}
