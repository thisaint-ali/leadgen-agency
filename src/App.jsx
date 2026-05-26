import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Agents from './pages/Agents';
import Prospects from './pages/Prospects';
import Knowledge from './pages/Knowledge';
import History from './pages/History';
import Pipeline from './pages/Pipeline';
import MasterAgent from './pages/MasterAgent';
import Integrations from './pages/Integrations';
import BigBot from './pages/BigBot';
import Contracts from './pages/Contracts';
import Performance from './pages/Performance';
import SignContract from './pages/SignContract';
import Login from './pages/Login';

const PAGES = {
  dashboard:    Dashboard,
  bigbot:       BigBot,
  master:       MasterAgent,
  pipeline:     Pipeline,
  contracts:    Contracts,
  performance:  Performance,
  agents:       Agents,
  prospects:    Prospects,
  integrations: Integrations,
  knowledge:    Knowledge,
  history:      History,
};

// Check for contract signing token in URL
function getSignToken() {
  try {
    return new URLSearchParams(window.location.search).get('sign');
  } catch {
    return null;
  }
}

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Stable — reads window.location.search once, never changes between renders
  const signToken = getSignToken();

  useEffect(() => {
    // Skip auth setup entirely for the public signing page
    if (signToken) { setLoading(false); return; }

    // If Supabase isn't configured, skip auth entirely — go straight to app
    if (!isSupabaseConfigured() || !supabase) {
      setLoading(false);
      setSession('no-auth');
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session ?? null);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Public contract signing page (no auth required) ──────────────────────
  if (signToken) {
    return <SignContract token={signToken} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#2196F3] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-medium">Loading AMA Leads…</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  const Page = PAGES[page] || Dashboard;

  return (
    <div className="flex h-screen bg-[#F1F5F9] overflow-hidden">
      <Sidebar current={page} onChange={setPage} />
      {/* pt-14 offsets the fixed mobile top bar; lg:pt-0 removes it on desktop */}
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <Page onNavigate={setPage} />
      </main>
    </div>
  );
}
