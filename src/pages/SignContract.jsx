// Public contract signing page — accessible at ?sign=TOKEN (no auth required)
import { useState, useEffect } from 'react';
import { CheckCircle2, FileText, Loader, AlertTriangle, X } from 'lucide-react';
import { fetchContractByToken, signContract } from '../agents/contractEngine';

export default function SignContract({ token }) {
  const [contract, setContract] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [signing,  setSigning]  = useState(false);
  const [signed,   setSigned]   = useState(false);
  const [error,    setError]    = useState(null);
  const [name,     setName]     = useState('');

  useEffect(() => {
    (async () => {
      const data = await fetchContractByToken(token);
      if (!data) {
        setError('Contract not found. This link may be expired or invalid.');
      } else if (data.status === 'signed') {
        setSigned(true);
        setContract(data);
      } else {
        setContract(data);
        setName(data.contact_name || '');
      }
      setLoading(false);
    })();
  }, [token]);

  const handleSign = async () => {
    if (!name.trim()) { setError('Please enter your name to sign.'); return; }
    setSigning(true);
    setError(null);
    const result = await signContract(token);
    if (result.error) {
      setError(result.error);
      setSigning(false);
    } else {
      setSigned(true);
      setContract(result.contract);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader size={24} className="animate-spin text-[#2196F3]" />
          <span className="text-sm text-slate-400">Loading contract…</span>
        </div>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!contract && error) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <X size={24} className="text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Contract not found</h2>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  // ── Already signed ─────────────────────────────────────────────────────────
  if (signed) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={30} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Agreement signed!</h2>
          <p className="text-sm text-slate-500 mb-4">
            Your Google Ads management agreement with AMA Leads for <strong>{contract?.company_name}</strong> is now active.
          </p>
          <div className="bg-slate-50 rounded-xl px-4 py-3 text-left text-xs text-slate-600 leading-relaxed">
            <strong>What happens next:</strong><br />
            1. You'll receive a welcome email with Google Ads access instructions within the hour.<br />
            2. Campaign build starts within 3 business days.<br />
            3. First weekly report arrives Monday morning.
          </div>
          <p className="text-xs text-slate-400 mt-5">
            Questions? Email <a href="mailto:ali@amaleads.org" className="text-[#2196F3] hover:underline">ali@amaleads.org</a>
          </p>
        </div>
      </div>
    );
  }

  // ── Sign page ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F1F5F9] py-10 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <img src="/logo.png" alt="AMA Leads" className="h-9 w-auto object-contain" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Google Ads Management Agreement</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review and sign your agreement with AMA Leads
          </p>
        </div>

        {/* Summary card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5 mb-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Agreement summary</h3>
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            <div className="text-slate-400">Client</div>
            <div className="font-medium text-slate-900">{contract.company_name}</div>
            {contract.contact_name && <>
              <div className="text-slate-400">Contact</div>
              <div className="font-medium text-slate-900">{contract.contact_name}</div>
            </>}
            <div className="text-slate-400">Monthly fee</div>
            <div className="font-bold text-[#F97316]">${contract.monthly_retainer?.toLocaleString()}/month</div>
            <div className="text-slate-400">Term</div>
            <div className="font-medium text-slate-900">Month-to-month (30-day notice)</div>
            {contract.niche && <>
              <div className="text-slate-400">Campaign niche</div>
              <div className="font-medium text-slate-900">{contract.niche}</div>
            </>}
          </div>
        </div>

        {/* Contract text */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-5 overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
            <FileText size={14} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Full agreement</span>
          </div>
          <div className="px-6 py-5 max-h-96 overflow-y-auto">
            <pre className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed font-mono">
              {contract.content}
            </pre>
          </div>
        </div>

        {/* Signing form */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5 mb-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Sign agreement</h3>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mb-4 text-sm text-red-700">
              <AlertTriangle size={13} /> {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Full name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your legal name"
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3] transition-colors"
            />
          </div>

          <div className="bg-slate-50 rounded-xl px-4 py-3 mb-4 text-xs text-slate-500 leading-relaxed">
            By clicking "Sign agreement" below, you confirm that you have read and agree to the terms of this Google Ads Management Services Agreement with AMA Leads. This constitutes a legally binding electronic signature.
          </div>

          <button
            onClick={handleSign}
            disabled={signing || !name.trim()}
            className="w-full h-12 rounded-xl bg-[#1B3A5C] text-white text-sm font-semibold hover:bg-[#243E6A] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {signing
              ? <><Loader size={15} className="animate-spin" /> Signing…</>
              : <><CheckCircle2 size={15} /> Sign agreement</>
            }
          </button>
        </div>

        <p className="text-center text-xs text-slate-400">
          Questions before signing? Email <a href="mailto:ali@amaleads.org" className="text-[#2196F3] hover:underline">ali@amaleads.org</a>
        </p>
      </div>
    </div>
  );
}
