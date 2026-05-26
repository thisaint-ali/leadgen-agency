import { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Network, Search, Target, ArrowRight, Users, DollarSign, ChevronDown } from 'lucide-react';
import ClientMap from '../components/ClientMap';

const PERIODS = [
  { id: 'week',  label: 'This week',  calc: mrr => Math.round(mrr / 4.33) },
  { id: 'month', label: 'This month', calc: mrr => mrr },
  { id: 'year',  label: 'This year',  calc: mrr => mrr * 12 },
];

const ACTION_CARDS = [
  {
    icon: Network,
    title: 'Agent Network',
    body: '7 AI specialists generate prospects, keywords, ad copy, and campaign audits simultaneously.',
    action: 'agents',
    badge: '7 agents',
  },
  {
    icon: Search,
    title: 'Prospect Finder',
    body: 'Search any niche and location for scored, ranked lead gen client targets with fit rationale.',
    action: 'prospects',
    badge: 'AI search',
  },
  {
    icon: Target,
    title: 'Knowledge Base',
    body: 'Full reference for niche selection, Google Ads setup, client qualification, and scaling.',
    action: 'knowledge',
    badge: 'reference',
  },
];

export default function Dashboard({ onNavigate }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured() || !supabase) { setLoading(false); return; }
      const { data } = await supabase
        .from('prospects')
        .select('id, company_name, location, monthly_value, status')
        .eq('status', 'client');
      setClients(data || []);
      setLoading(false);
    };
    load();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const mrr = clients.reduce((sum, c) => sum + (Number(c.monthly_value) || 0), 0);
  const activePeriod = PERIODS.find(p => p.id === period) || PERIODS[1];
  const revenue = activePeriod.calc(mrr);

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Google Ads lead generation agency</p>
      </div>

      {/* Stat counters */}
      <div className="grid grid-cols-2 gap-4 mb-7">

        {/* Active clients */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} className="text-slate-400" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Active clients</span>
          </div>
          {loading
            ? <div className="h-10 w-16 bg-slate-100 rounded-lg animate-pulse mb-1" />
            : <div className="text-5xl font-bold text-slate-900 leading-none">{clients.length}</div>
          }
          <div className="text-xs text-slate-400 mt-2">
            {loading ? '' : clients.length === 0
              ? 'No clients yet — add them in Pipeline'
              : `${clients.length} active retainer${clients.length !== 1 ? 's' : ''}`
            }
          </div>
        </div>

        {/* Revenue with period dropdown */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DollarSign size={14} className="text-slate-400" />
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Revenue</span>
            </div>

            {/* Dropdown */}
            <div className="relative" ref={dropRef}>
              <button
                onClick={() => setDropOpen(d => !d)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-100 transition-colors"
              >
                {activePeriod.label}
                <ChevronDown size={11} className={`transition-transform ${dropOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropOpen && (
                <div className="absolute right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-20 min-w-[130px]">
                  {PERIODS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setPeriod(p.id); setDropOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center justify-between ${
                        period === p.id
                          ? 'text-[#2196F3] bg-[#EEF6FE]'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {p.label}
                      {period === p.id && <span className="w-1.5 h-1.5 rounded-full bg-[#2196F3]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {loading
            ? <div className="h-10 w-28 bg-slate-100 rounded-lg animate-pulse mb-1" />
            : <div className="text-5xl font-bold text-[#2196F3] leading-none">
                ${revenue.toLocaleString()}
              </div>
          }
          <div className="text-xs text-slate-400 mt-2">
            {loading ? '' : mrr > 0
              ? `$${mrr.toLocaleString()}/mo MRR · ${activePeriod.label.toLowerCase()} view`
              : 'Set monthly value on clients in Pipeline'
            }
          </div>
        </div>
      </div>

      {/* Client map */}
      <div className="mb-7">
        <ClientMap clients={clients} />
      </div>

      {/* Quick access */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Quick access</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {ACTION_CARDS.map(({ icon: Icon, title, body, action, badge }) => (
          <div
            key={title}
            onClick={() => onNavigate(action)}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 cursor-pointer hover:border-[#2196F3]/40 hover:shadow-md transition-all duration-200"
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
            <div className="mt-4 flex items-center gap-1 text-xs font-medium text-[#2196F3]">
              Open <ArrowRight size={11} />
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
