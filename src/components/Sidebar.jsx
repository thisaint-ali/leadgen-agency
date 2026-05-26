import { useState } from 'react';
import { Search, Network, BookOpen, LayoutDashboard, History, LogOut, Menu, X, Briefcase, Bot, Plug, Cpu, FileText, BarChart2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getConnectedCount } from '../integrations/index';

const NAV = [
  { id: 'dashboard',     label: 'Dashboard',        icon: LayoutDashboard },
  { id: 'bigbot',        label: 'Big Bot',           icon: Cpu },
  { id: 'master',        label: 'Master Agent',      icon: Bot },
  { id: 'pipeline',      label: 'Pipeline',          icon: Briefcase },
  { id: 'contracts',     label: 'Contracts',         icon: FileText },
  { id: 'performance',   label: 'Performance',       icon: BarChart2 },
  { id: 'agents',        label: 'Agent Network',     icon: Network },
  { id: 'prospects',     label: 'Prospect Finder',   icon: Search },
  { id: 'integrations',  label: 'Integrations',      icon: Plug },
  { id: 'knowledge',     label: 'Knowledge Base',    icon: BookOpen },
  { id: 'history',       label: 'History',           icon: History },
];

function AMALeadsLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/logo.png" alt="AMA Leads" className="h-9 w-auto object-contain flex-shrink-0" />
    </div>
  );
}

export default function Sidebar({ current, onChange }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    if (isSupabaseConfigured() && supabase) {
      await supabase.auth.signOut();
    }
  };

  const connectedCount = getConnectedCount();

  const NavItems = () => (
    <nav className="space-y-0.5 flex-1 px-3">
      {NAV.map(({ id, label, icon: Icon }) => {
        const active = current === id;
        return (
          <button
            key={id}
            onClick={() => { onChange(id); setMobileOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
              active
                ? 'bg-[#2196F3] text-white shadow-sm'
                : 'text-slate-300 hover:bg-[#243E6A] hover:text-white'
            }`}
          >
            <Icon size={16} className={active ? 'text-white' : 'text-slate-400'} />
            <span className="flex-1">{label}</span>
            {id === 'integrations' && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                active ? 'bg-white/20 text-white' : connectedCount === 4 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#243E6A] text-slate-400'
              }`}>
                {connectedCount}/4
              </span>
            )}
            {id === 'master' && (
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? 'bg-white' : 'bg-emerald-400'}`} />
            )}
            {id === 'bigbot' && (
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse ${active ? 'bg-white' : 'bg-[#2196F3]'}`} />
            )}
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-[#1B3A5C] border-b border-[#243E6A] flex items-center justify-between px-4 z-40">
        <AMALeadsLogo />
        <button onClick={() => setMobileOpen(true)} className="text-slate-300 hover:text-white">
          <Menu size={20} />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div className={`lg:hidden fixed top-0 left-0 h-full w-72 bg-[#1B3A5C] z-50 flex flex-col transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'}`}>
        <div className="flex items-center justify-between p-4 border-b border-[#243E6A]">
          <AMALeadsLogo />
          <button onClick={() => setMobileOpen(false)} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 flex flex-col py-4 overflow-y-auto">
          <NavItems />
        </div>
        <div className="p-4 border-t border-[#243E6A]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-[#243E6A] hover:text-white transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-64 h-full bg-[#1B3A5C] flex-col flex-shrink-0">
        <div className="p-4 border-b border-[#243E6A]">
          <AMALeadsLogo />
        </div>

        <div className="flex-1 flex flex-col py-4 overflow-y-auto">
          <NavItems />
        </div>

        <div className="p-4 border-t border-[#243E6A] space-y-1">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-[#243E6A] hover:text-white transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}
