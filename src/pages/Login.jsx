import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-full max-w-sm px-6">
        <div className="mb-8">
          <div className="text-lg font-semibold font-mono text-gray-900">AMALeadx</div>
          <div className="text-xs font-mono text-gray-400 mt-0.5">amaleadx — owner access</div>
        </div>

        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <label className="block text-xs font-mono text-gray-400 uppercase tracking-widest mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full text-sm font-mono border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-gray-400 uppercase tracking-widest mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full text-sm font-mono border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
            />
          </div>

          {error && (
            <div className="text-xs font-mono text-red-500 border border-red-100 rounded-lg p-3 bg-red-50">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg border border-gray-200 text-sm font-mono text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 mt-2"
          >
            {loading ? 'signing in...' : 'sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
