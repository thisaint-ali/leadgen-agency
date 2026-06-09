import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  CreditCard, DollarSign, AlertTriangle, CheckCircle2, Clock,
  XCircle, ExternalLink, Copy, Check, Loader, RefreshCw,
  Send, TrendingUp, Users, ChevronDown, ChevronUp,
} from 'lucide-react';
import { isStripeConnected, setupClientBilling, sendPaymentLink, fetchAllBilling } from '../agents/stripeEngine';

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
  pending:   { label: 'Pending',   color: 'bg-amber-100 text-amber-700',    icon: Clock        },
  active:    { label: 'Active',    color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  past_due:  { label: 'Past Due',  color: 'bg-red-100 text-red-600',         icon: AlertTriangle },
  cancelled: { label: 'Cancelled', color: 'bg-slate-100 text-slate-500',     icon: XCircle      },
};

function fmt(n) {
  return n ? `$${Number(n).toLocaleString()}` : '—';
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Stat tile ─────────────────────────────────────────────────────────────────
function StatTile({ label, value, sub, icon: Icon, color = 'text-slate-700' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3.5">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={13} className={color} />
        <span className="text-xs text-slate-400 font-medium">{label}</span>
      </div>
      <div className={`text-2xl font-bold leading-none ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

// ─── Billing card ──────────────────────────────────────────────────────────────
function BillingCard({ record, onSendLink, onSetup }) {
  const [expanded,  setExpanded]  = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [sending,   setSending]   = useState(false);
  const [sent,      setSent]      = useState(false);
  const [setting,   setSetting]   = useState(false);

  const cfg = STATUS[record.status] || STATUS.pending;
  const Icon = cfg.icon;

  const copyLink = () => {
    if (!record.stripe_checkout_url) return;
    navigator.clipboard?.writeText(record.stripe_checkout_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    setSending(true);
    await onSendLink(record);
    setSent(true);
    setSending(false);
    setTimeout(() => setSent(false), 3000);
  };

  const handleSetup = async () => {
    setSetting(true);
    await onSetup(record);
    setSetting(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-slate-900 truncate">{record.company_name}</span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                <Icon size={9} /> {cfg.label}
              </span>
            </div>
            <div className="text-xl font-bold text-[#2196F3]">{fmt(record.monthly_amount)}<span className="text-sm font-normal text-slate-400">/mo</span></div>
          </div>
          <button onClick={() => setExpanded(v => !v)} className="text-slate-400 hover:text-slate-600 mt-1">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs text-slate-500">
          <span>Last payment: <span className="font-medium text-slate-700">{fmtDate(record.last_payment_at)}</span></span>
          <span>Next invoice: <span className="font-medium text-slate-700">{fmtDate(record.next_invoice_date)}</span></span>
          {record.last_payment_amount && (
            <span>Last amount: <span className="font-medium text-slate-700">{fmt(record.last_payment_amount)}</span></span>
          )}
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-500">
            {record.stripe_customer_id && (
              <div>Stripe customer: <span className="font-mono text-slate-700">{record.stripe_customer_id}</span></div>
            )}
            {record.stripe_subscription_id && (
              <div>Subscription: <span className="font-mono text-slate-700">{record.stripe_subscription_id}</span></div>
            )}
            {record.stripe_checkout_url && (
              <div className="flex items-center gap-1.5">
                Payment link:
                <a href={record.stripe_checkout_url} target="_blank" rel="noreferrer" className="text-[#2196F3] hover:underline flex items-center gap-1">
                  Open <ExternalLink size={10} />
                </a>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
          {!record.stripe_checkout_url ? (
            <button onClick={handleSetup} disabled={setting}
              className="flex-1 flex items-center justify-center gap-2 h-8 rounded-lg bg-[#1B3A5C] text-white text-xs font-medium hover:bg-[#243E6A] transition-colors disabled:opacity-50">
              {setting ? <><Loader size={11} className="animate-spin" /> Setting up…</> : <><CreditCard size={11} /> Set up billing</>}
            </button>
          ) : (
            <>
              <button onClick={copyLink}
                className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                {copied ? <><Check size={11} className="text-emerald-500" /> Copied</> : <><Copy size={11} /> Copy link</>}
              </button>
              {sent ? (
                <div className="flex-1 flex items-center justify-center gap-1.5 h-8 text-xs font-medium text-emerald-600">
                  <Check size={11} /> Link sent!
                </div>
              ) : (
                <button onClick={handleSend} disabled={sending}
                  className="flex-1 flex items-center justify-center gap-2 h-8 rounded-lg bg-[#2196F3] text-white text-xs font-medium hover:bg-[#1565C0] transition-colors disabled:opacity-50">
                  {sending ? <><Loader size={11} className="animate-spin" /> Sending…</> : <><Send size={11} /> Email link</>}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create billing modal (for a contract without billing) ─────────────────────
function SetupModal({ contracts, onClose, onCreate }) {
  const [selected, setSelected] = useState(contracts[0]?.id || '');
  const [working,  setWorking]  = useState(false);
  const [log,      setLog]      = useState('');

  const contract = contracts.find(c => c.id === selected);

  const handle = async () => {
    if (!contract) return;
    setWorking(true);
    setLog('Creating Stripe customer + subscription…');
    const result = await onCreate(contract);
    if (result?.error) setLog(`❌ ${result.error}`);
    else { setLog('✓ Billing created!'); setTimeout(onClose, 1200); }
    setWorking(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">Set Up Client Billing</h3>
          <p className="text-xs text-slate-400 mt-0.5">Creates Stripe subscription + checkout link</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Select signed contract</label>
            <select value={selected} onChange={e => setSelected(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3]">
              {contracts.map(c => (
                <option key={c.id} value={c.id}>{c.company_name} — ${c.monthly_retainer}/mo</option>
              ))}
            </select>
          </div>
          {contract && (
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-1">
              <div>Client: <span className="font-medium">{contract.contact_name}</span></div>
              <div>Email: <span className="font-medium">{contract.contact_email || '—'}</span></div>
              <div>Amount: <span className="font-medium text-[#2196F3]">${contract.monthly_retainer}/mo</span></div>
            </div>
          )}
          {log && (
            <div className={`text-xs rounded-lg px-3 py-2 ${log.startsWith('❌') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {log}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handle} disabled={working || !contract}
              className="flex-1 h-10 rounded-xl bg-[#2196F3] text-white text-sm font-medium hover:bg-[#1565C0] transition-colors disabled:opacity-50">
              {working ? 'Creating…' : 'Create Billing'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function Billing() {
  const [records,   setRecords]   = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [filter,    setFilter]    = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    if (!isSupabaseConfigured() || !supabase) { setLoading(false); return; }
    const [billingRes, contractsRes] = await Promise.all([
      supabase.from('billing').select('*').order('created_at', { ascending: false }),
      supabase.from('contracts').select('*').eq('status', 'signed').order('signed_at', { ascending: false }),
    ]);
    setRecords(billingRes.data || []);
    setContracts(contractsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSetup = async (contract) => {
    const result = await setupClientBilling(contract, { email: contract.contact_email });
    if (result.success) await load();
    return result;
  };

  const handleSetupFromCard = async (record) => {
    // Find matching contract
    const contract = contracts.find(c => c.id === record.contract_id || c.company_name === record.company_name);
    if (!contract) return;
    return handleSetup(contract);
  };

  const handleSendLink = async (record) => {
    const contract = contracts.find(c => c.id === record.contract_id);
    if (!contract) return;
    return sendPaymentLink(contract, { email: contract.contact_email });
  };

  const handleCreateFromModal = async (contract) => {
    const result = await setupClientBilling(contract, { email: contract.contact_email });
    if (result.success) await load();
    return result;
  };

  // Signed contracts without billing records
  const contractIds = new Set(records.map(r => r.contract_id).filter(Boolean));
  const unlinked = contracts.filter(c => !contractIds.has(c.id));

  // Stats
  const mrr       = records.filter(r => r.status === 'active').reduce((s, r) => s + Number(r.monthly_amount || 0), 0);
  const active    = records.filter(r => r.status === 'active').length;
  const pending   = records.filter(r => r.status === 'pending').length;
  const pastDue   = records.filter(r => r.status === 'past_due').length;

  const filtered  = filter === 'all' ? records : records.filter(r => r.status === filter);

  const stripeOk = isStripeConnected();

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Billing</h1>
          <p className="text-sm text-slate-500 mt-1">Client subscriptions &amp; monthly retainers</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <RefreshCw size={14} /> Refresh
          </button>
          {unlinked.length > 0 && (
            <button onClick={() => setShowSetup(true)}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#2196F3] text-white text-sm font-medium hover:bg-[#1565C0] transition-colors">
              <CreditCard size={14} /> Set up billing
            </button>
          )}
        </div>
      </div>

      {/* Stripe banner */}
      {!stripeOk && (
        <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-amber-800">Stripe not connected</div>
            <div className="text-xs text-amber-700 mt-0.5">
              Add <code className="font-mono bg-amber-100 px-1 rounded">VITE_STRIPE_PUBLISHABLE_KEY</code> to your Vercel environment variables to enable payment collection.
            </div>
          </div>
        </div>
      )}

      {/* Unlinked contracts banner */}
      {unlinked.length > 0 && (
        <div className="mb-6 flex items-start gap-3 bg-[#2196F3]/5 border border-[#2196F3]/20 rounded-xl px-4 py-3">
          <CreditCard size={16} className="text-[#2196F3] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-800">
              {unlinked.length} signed contract{unlinked.length > 1 ? 's' : ''} without billing
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {unlinked.map(c => c.company_name).join(', ')}
            </div>
          </div>
          <button onClick={() => setShowSetup(true)}
            className="text-xs font-semibold text-[#2196F3] hover:text-[#1565C0] transition-colors flex-shrink-0">
            Set up →
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatTile label="Monthly Revenue" value={fmt(mrr)} sub="active subscriptions" icon={DollarSign} color="text-emerald-600" />
        <StatTile label="Active Clients"  value={active}  sub="paying subscriptions"  icon={Users}      color="text-[#2196F3]"  />
        <StatTile label="Pending Links"   value={pending} sub="awaiting first payment" icon={Clock}      color="text-amber-600"  />
        <StatTile label="Past Due"        value={pastDue} sub="need attention"         icon={AlertTriangle} color="text-red-500" />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-white border border-slate-200 rounded-xl p-1 w-fit">
        {['all', 'active', 'pending', 'past_due', 'cancelled'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${filter === f ? 'bg-[#2196F3] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {f === 'all' ? 'All' : f === 'past_due' ? 'Past Due' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader size={18} className="animate-spin mr-2 text-[#2196F3]" /> Loading billing…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <CreditCard size={36} className="mx-auto text-slate-200 mb-3" />
          <div className="text-sm font-medium text-slate-500">
            {records.length === 0 ? 'No billing records yet' : `No ${filter === 'past_due' ? 'past due' : filter} subscriptions`}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {records.length === 0 ? 'Sign a contract and set up billing to see records here' : 'Try a different filter'}
          </div>
          {unlinked.length > 0 && records.length === 0 && (
            <button onClick={() => setShowSetup(true)}
              className="mt-4 flex items-center gap-2 h-9 px-4 rounded-lg bg-[#2196F3] text-white text-sm font-medium hover:bg-[#1565C0] transition-colors mx-auto">
              <CreditCard size={14} /> Create first billing record
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(r => (
            <BillingCard
              key={r.id}
              record={r}
              onSendLink={handleSendLink}
              onSetup={handleSetupFromCard}
            />
          ))}
        </div>
      )}

      {/* Setup modal */}
      {showSetup && unlinked.length > 0 && (
        <SetupModal
          contracts={unlinked}
          onClose={() => setShowSetup(false)}
          onCreate={handleCreateFromModal}
        />
      )}
    </div>
  );
}
