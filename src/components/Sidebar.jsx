import { Search, Network, BookOpen, LayoutDashboard, History, LogOut } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const NAV = [
  { id: 'dashboard',  label: 'Dashboard',      icon: LayoutDashboard },
  { id: 'agents',     label: 'Agent Network',   icon: Network },
  { id: 'prospects',  label: 'Prospect Finder', icon: Search },
  { id: 'knowledge',  label: 'Knowledge Base',  icon: BookOpen },
  { id: 'history',    label: 'History',         icon: History },
];

export default function Sidebar({ current, onChange }) {
  const handleLogout = async () => {
    if (isSupabaseConfigured() && supabase) {
      await supabase.auth.signOut();
    }
  };

  return (
    <div className="w-52 min-h-screen border-r border-gray-100 bg-white flex flex-col py-6 px-3">
      <div className="px-3 mb-8">
        <div className="text-sm font-semibold font-mono text-gray-900">AMALeadx</div>
        <div className="text-xs text-gray-400 font-mono mt-0.5">amaleadx.vercel.app</div>
      </div>

      <nav className="space-y-0.5 flex-1">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-mono transition-colors text-left ${
              current === id
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>

      <div className="px-3 pt-6 border-t border-gray-100 space-y-3">
        <div>
          <div className="text-xs font-mono text-gray-400">Northern Virginia</div>
          <div className="text-xs font-mono text-gray-300 mt-0.5">Fairfax, VA</div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-0 py-1 text-xs font-mono text-gray-400 hover:text-gray-700 transition-colors"
        >
          <LogOut size={13} />
          sign out
        </button>
      </div>
    </div>
  );
}
