import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Agents from './pages/Agents';
import Prospects from './pages/Prospects';
import Knowledge from './pages/Knowledge';
import History from './pages/History';
import Login from './pages/Login';

const PAGES = {
  dashboard: Dashboard,
  agents: Agents,
  prospects: Prospects,
  knowledge: Knowledge,
  history: History,
};

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <span className="text-xs font-mono text-gray-400">loading...</span>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  const Page = PAGES[page] || Dashboard;

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar current={page} onChange={setPage} />
      <main className="flex-1 overflow-y-auto">
        <Page onNavigate={setPage} />
      </main>
    </div>
  );
}
