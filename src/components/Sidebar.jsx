import { useState } from 'react';
import { Search, Network, BookOpen, LayoutDashboard, History, LogOut, Menu, X, Briefcase } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const NAV = [
  { id: 'dashboard',  label: 'Dashboard',      icon: LayoutDashboard },
  { id: 'pipeline',   label: 'Pipeline',        icon: Briefcase },
  { id: 'agents',     label: 'Agent Network',   icon: Network },
  { id: 'prospects',  label: 'Prospect Finder', icon: Search },
  { id: 'knowledge',  label: 'Knowledge Base',  icon: BookOpen },
  { id: 'history',    label: 'History',         icon: History },
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
