import { useState } from 'react';
import { supabase } from '../lib/supabase';

function AMALeadsLogo({ size = 'md' }) {
  const sz = size === 'lg' ? 48 : 36;
  const textSz = size === 'lg' ? 'text-xl' : 'text-base';
  const subSz = size === 'lg' ? 'text-xs' : 'text-[10px]';
  return (
    <div className="flex items-center gap-3">
      <div className={`relative flex-shrink-0`} style={{ width: sz, height: sz }}>
        <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path d="M18 2L32 7.5V18C32 27 25 33.5 18 36C11 33.5 4 27 4 18V7.5L18 2Z"
            fill="#1B3A5C" stroke="#2196F3" strokeWidth="1.5"/>
          <rect x="8"  y="22" width="4" height="7" rx="1" fill="#2196F3"/>
          <rect x="14" y="17" width="4" height="12" rx="1" fill="#2196F3"/>
          <rect x="20" y="20" width="4" height="9" rx="1" fill="#2196F3"/>
          <path d="M16 13L26 9L22 19" fill="#F97316"/>
        </svg>
      </div>
      <div className="leading-none">
        <div>
          <span className={`font-bold ${textSz} tracking-wide text-slate-900`}>AMA</span>
          <span className={`font-bold ${textSz} tracking-wide text-[#2196F3]`}> Leads</span>
        </div>
        <div className={`text-slate-400 ${subSz} font-medium tracking-widest uppercase mt-0.5`}>Agency OS</div>
      </div>
    </div>
  );
}

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
    <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Brand header */}
          <div className="bg-[#1B3A5C] px-8 py-7 flex flex-col items-center">
            <AMALeadsLogo size="lg" />
            <div
              style={{ color: 'rgba(148,163,184,0.8)' }}
              className="text-xs mt-4 tracking-wide"
            >
              Northern Virginia · Fairfax, VA
            </div>
          </div>

          {/* Form */}
          <div className="px-8 py-7">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Owner sign in</h2>
            <p className="text-xs text-slate-400 mb-6">Access your agency dashboard</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="you@amaleads.org"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3] transition-colors"
                />
              </div>

              {error && (
                <div className="text-xs text-red-600 border border-red-100 rounded-lg p-3 bg-red-50">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-lg bg-[#2196F3] text-white text-sm font-medium hover:bg-[#1565C0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-5">
          AMA Leads Agency OS · amaleads.org
        </p>
      </div>
    </div>
  );
}
