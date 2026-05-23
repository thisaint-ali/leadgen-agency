import { Network, Search, Target, TrendingUp, ArrowRight } from 'lucide-react';

const STAT_CARDS = [
  { label: 'Target CPL',       value: '$80–200',  sub: 'roofing benchmark',      accent: '#2196F3' },
  { label: 'Target Retainer',  value: '$2,000',   sub: 'per client / month',     accent: '#F97316' },
  { label: 'Month 6 Goal',     value: '$20k',     sub: 'monthly revenue',        accent: '#2196F3' },
  { label: 'Pre-College Goal', value: '$40–50k',  sub: 'monthly revenue target', accent: '#F97316' },
];

const ACTION_CARDS = [
  {
    icon: Network,
    title: 'Agent Network',
    body: 'Run all 7 specialist agents simultaneously. Synchronized context flows between waves automatically.',
    action: 'agents',
    badge: '7 agents',
  },
  {
    icon: Search,
    title: 'Prospect Finder',
    body: 'Search any niche and location for scored, ranked lead gen client targets with specific fit rationale.',
    action: 'prospects',
    badge: 'AI search',
  },
  {
    icon: Target,
    title: 'Knowledge Base',
    body: 'Full reference on niche selection, Google Ads setup, client qualification, sales, and scaling.',
    action: 'knowledge',
    badge: '7 sections',
  },
  {
    icon: TrendingUp,
    title: 'Lead Economics',
    body: 'Roofing: $100–200 CPL, $8k–25k avg job. Foundation: $80–150 CPL. PI: $200–600 CPL, $50k+ case value.',
    action: null,
    badge: 'reference',
  },
];

export default function Dashboard({ onNavigate }) {
  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Page header */}
      <div className="mb-7">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          AMA Leads · Google Ads lead generation agency · Fairfax, VA
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        {STAT_CARDS.map(({ label, value, sub, accent }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">{label}</div>
            <div className="text-2xl font-bold" style={{ color: accent }}>{value}</div>
            <div className="text-xs text-slate-400 mt-1">{sub}</div>
          </div>
        ))}
      </div>

      {/* Section title */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Quick access</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {ACTION_CARDS.map(({ icon: Icon, title, body, action, badge }) => (
          <div
            key={title}
            onClick={() => action && onNavigate(action)}
            className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 ${
              action ? 'cursor-pointer hover:border-[#2196F3]/40 hover:shadow-md transition-all duration-200' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-[#EEF6FE] flex items-center justify-center">
                <Icon size={17} className="text-[#2196F3]" />
              </div>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-full">
                {badge}
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-900 mb-1.5">{title}</div>
            <p className="text-xs text-slate-500 leading-relaxed">{body}</p>
            {action && (
              <div className="mt-4 flex items-center gap-1 text-xs font-medium text-[#2196F3]">
                Open <ArrowRight size={11} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div className="mt-8 bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-[#F97316]" />
          <span className="text-xs font-semibold text-slate-700">Northern Virginia Focus</span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Primary market: Fairfax, Arlington, Alexandria, Reston, McLean, Vienna, Herndon.
          Roofing and foundation repair are the highest-opportunity niches for Q2 growth.
        </p>
      </div>

    </div>
  );
}
