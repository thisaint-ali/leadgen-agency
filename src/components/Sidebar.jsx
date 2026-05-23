import { useState } from 'react';
import { Search, Network, BookOpen, LayoutDashboard, History, LogOut, Menu, X, TrendingUp } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const NAV = [
  { id: 'dashboard',  label: 'Dashboard',      icon: LayoutDashboard },
  { id: 'agents',     label: 'Agent Network',   icon: Network },
  { id: 'prospects',  label: 'Prospect Finder', icon: Search },
  { id: 'knowledge',  label: 'Knowledge Base',  icon: BookOpen },
  { id: 'history',    label: 'History',         icon: History },
];

function AMALeadsLogo() {
  return (
    <div className="flex items-center gap-2.5">
      {/* Icon mark */}
      <div className="relative w-9 h-9 flex-shrink-0">
        <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          {/* Shield / pin shape */}
          <path d="M18 2L32 7.5V18C32 27 25 33.5 18 36C11 33.5 4 27 4 18V7.5L18 2Z"
            fill="#1B3A5C" stroke="#2196F3" strokeWidth="1.5"/>
          {/* Bar charts */}
          <rect x="8"  y="22" width="4" height="7" rx="1" fill="#2196F3"/>
          <rect x="14" y="17" width="4" height="12" rx="1" fill="#2196F3"/>
          <rect x="20" y="20" width="4" height="9" rx="1" fill="#2196F3"/>
          {/* Arrow */}
          <path d="M16 13L26 9L22 19" fill="#F97316"/>
        </svg>
      </div>
      {/* Wordmark */}
      <div className="leading-none">
        <span className="text-white font-bold text-base tracking-wide">AMA</span>
        <span className="text-[#2196F3] font-bold text-base tracking-wide"> Leads</span>
        <div className="text-slate-400 text-[10px] font-medium tracking-widest uppercase mt-0.5">Agency OS</div>
      </div>
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
            {label}
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
      <div className={`lg:hidden fixed top-0 left-0 h-full w-72 bg-[#1B3A5C] z-50 flex flex-col transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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
      <div className="hidden lg:flex w-64 min-h-screen bg-[#1B3A5C] flex-col flex-shrink-0">
        <div className="p-4 border-b border-[#243E6A]">
          <AMALeadsLogo />
        </div>

        <div className="flex-1 flex flex-col py-4 overflow-y-auto">
          <NavItems />
        </div>

        <div className="p-4 border-t border-[#243E6A] space-y-1">
          <div className="px-3 py-2">
            <div className="text-xs text-slate-400 font-medium">Northern Virginia</div>
            <div className="text-xs text-slate-500 mt-0.5">Fairfax, VA</div>
          </div>
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
