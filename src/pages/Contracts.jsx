import { useState, useEffect, useCallback } from 'react';
import {
  FileText, CheckCircle2, Clock, XCircle, Zap, ExternalLink,
  AlertTriangle, Copy, Check, Loader, ChevronDown, ChevronUp,
  DollarSign, Send, RefreshCw,
} from 'lucide-react';
import { fetchContracts, fetchProposals, markCampaignTriggered } from '../agents/contractEngine';
import { isSupabaseConfigured } from '../lib/supabase';

// ─── Status config ────────────────────────────────────────────────────────────
const CONTRACT_STATUS = {
  draft:    { label: 'Draft',    color: 'bg-slate-100 text-slate-600',    icon: FileText    },
  sent:     { label: 'Sent',     color: 'bg-blue-100 text-blue-700',      icon: Send        },
  signed:   { label: 'Signed',   color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-600',        icon: XCircle     },
  expired:  { label: 'Expired',  color: 'bg-amber-100 text-amber-700',    icon: Clock       },
};

const PROPOSAL_STATUS = {
  draft:    { label: 'Draft',    color: 'bg-slate-100 text-slate-600'    },
  sent:     { label: 'Sent',     color: 'bg-blue-100 text-blue-700'      },
  accepted: { label: 'Accepted', color: 'bg-emerald-100 text-emerald-700' },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-600'        },
};

// ─── Contract card ────────────────────────────────────────────────────────────
function ContractCard({ contract, onCampaignTrigger }) {
  const [expanded,  setExpanded]  = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [triggering, setTriggering] = useState(false);

  const status = CONTRACT_STATUS[contract.status] || CONTRACT_STATUS.draft;
  const StatusIcon = status.icon;

  const signingUrl = `${window.location.origin}?sign=${contract.signing_token}`;

  const copyLink = () => {
    navigator.clipboard?.writeText(signingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTrigger = async () => {
    setTriggering(true);
    await markCampaignTriggered(contract.id);
    // Fire the campaign builder via event (picked up by Pipeline / CampaignBuilder)
    window.dispatchEvent(new CustomEvent('buildCampaign', {
      detail: {
        id:           contract.prospect_id,
        company_name: contract.company_name,
        contact_name: contract.contact_name,
        niche:        contract.niche,
        location:     contract.location,
        monthly_value: contract.monthly_retainer,
        email:        contract.contact_email,
      },
    }));
    setTriggering(false);
    onCampaignTrigger?.();
  };

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-shadow hover:shadow-md ${
      contract.status === 'signed' ? 'border-emerald-200' : 'border-slate-200'
    }`}>
      {/* Header */}
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm font-semibold text-slate-900">{contract.company_name}</span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.color}`}>
                <StatusIcon size={9} />
                {status.label}
              </span>
              {contract.campaign_triggered && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                  Campaign sent
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-3 text-xs text-slate-400">
              {contract.contact_name && <span>{contract.contact_name}</span>}
              {contract.niche && <span>{contract.niche}</span>}
              {contract.location && <span>{contract.location}</span>}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="flex items-center gap-1 text-sm font-bold text-[#F97316]">
              <DollarSign size={13} />
              {contract.monthly_retainer?.toLocaleString()}/mo
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="flex flex-wrap gap-x-4 mt-2 text-xs text-slate-400">
          <span>Created {new Date(contract.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          {contract.signed_at && (
            <span className="text-emerald-600 font-medium">
              Signed {new Date(contract.signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Copy signing link */}
          {contract.status !== 'signed' && (
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {copied ? <><Check size={11} className="text-emerald-500" /> Copied!</> : <><Copy size={11} /> Copy signing link</>}
            </button>
          )}

          {/* Open signing page */}
          <a
            href={signingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ExternalLink size={11} /> Preview
          </a>

          {/* Trigger campaign build */}
          {contract.status === 'signed' && !contract.campaign_triggered && (
            <button
              onClick={handleTrigger}
              disabled={triggering}
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-[#1B3A5C] text-white text-xs font-medium hover:bg-[#243E6A] transition-colors disabled:opacity-50"
            >
              {triggering
                ? <><Loader size={11} className="animate-spin" /> Building…</>
                : <><Zap size={11} /> Build Campaign</>
              }
            </button>
          )}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          {expanded ? <><ChevronUp size={13} /> Hide contract</> : <><ChevronDown size={13} /> View contract</>}
        </button>
      </div>

      {/* Contract content */}
      {expanded && (
        <div className="px-5 py-4 border-t border-slate-100">
          <pre className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed font-mono bg-slate-50 rounded-lg p-4 border border-slate-100 max-h-96 overflow-y-auto">
            {contract.content}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Proposal card ────────────────────────────────────────────────────────────
function ProposalCard({ proposal }) {
  const [expanded, setExpanded] = useState(false);
  const status = PROPOSAL_STATUS[proposal.status] || PROPOSAL_STATUS.draft;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm font-semibold text-slate-900">{proposal.company_name}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.color}`}>
                {status.label}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-3 text-xs text-slate-400">
              {proposal.contact_name && <span>{proposal.contact_name}</span>}
              {proposal.niche && <span>{proposal.niche}</span>}
              {proposal.location && <span>{proposal.location}</span>}
            </div>
          </div>
          {proposal.monthly_value && (
            <div className="flex items-center gap-1 text-sm font-bold text-[#F97316] flex-shrink-0">
              <DollarSign size={13} />
              {proposal.monthly_value.toLocaleString()}/mo
            </div>
          )}
        </div>
        <div className="mt-2 text-xs text-slate-400">
          Created {new Date(proposal.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          {proposal.sent_at && <span className="ml-3 text-blue-600">Sent {new Date(proposal.sent_at).toLocaleDateString()}</span>}
        </div>
      </div>
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          {expanded ? <><ChevronUp size={13} /> Hide proposal</> : <><ChevronDown size={13} /> View proposal</>}
        </button>
      </div>
      {expanded && (
        <div className="px-5 py-4 border-t border-slate-100">
          <pre className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed font-mono bg-slate-50 rounded-lg p-4 border border-slate-100 max-h-80 overflow-y-auto">
            {proposal.content}
          </pre>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function Contracts({ onNavigate }) {
  const [tab,       setTab]       = useState('contracts');
  const [contracts, setContracts] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, p] = await Promise.all([fetchContracts(), fetchProposals()]);
    setContracts(c);
    setProposals(p);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Listen for newly built campaigns from this page's trigger
  useEffect(() => {
    const handler = () => {
      // Navigate to Pipeline to show campaign builder
      onNavigate?.('pipeline');
    };
    // We don't auto-nav — user can choose
    // window.addEventListener('buildCampaign', handler);
    // return () => window.removeEventListener('buildCampaign', handler);
  }, [onNavigate]);

  const signed   = contracts.filter(c => c.status === 'signed');
  const pending  = contracts.filter(c => c.status === 'sent');
  const totalMrr = signed.reduce((s, c) => s + (Number(c.monthly_retainer) || 0), 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Contracts & Proposals</h1>
          <p className="text-sm text-slate-500 mt-1">Track every deal from proposal to signed client</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 h-9 px-4 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total contracts', value: contracts.length,           icon: FileText,     color: 'text-slate-700' },
          { label: 'Signed',          value: signed.length,              icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Awaiting sig.',   value: pending.length,             icon: Clock,        color: 'text-blue-600' },
          { label: 'Contract MRR',    value: totalMrr ? `$${totalMrr.toLocaleString()}` : '$0', icon: DollarSign, color: 'text-[#F97316]' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3.5">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={13} className={color} />
              <span className="text-xs text-slate-400">{label}</span>
            </div>
            <div className={`text-xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Not connected warning */}
      {!isSupabaseConfigured() && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5 mb-5">
          <AlertTriangle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-amber-800">Supabase not connected</div>
            <div className="text-xs text-amber-700 mt-0.5">
              Run <code className="font-mono font-semibold">supabase-schema-v4.sql</code> in your Supabase SQL Editor, then add credentials to .env
            </div>
          </div>
        </div>
      )}

      {/* How to generate note */}
      <div className="bg-[#EEF6FE] border border-[#2196F3]/20 rounded-xl px-4 py-3 mb-5">
        <p className="text-xs text-[#1565C0]">
          <strong>To generate contracts:</strong> go to <button onClick={() => onNavigate?.('pipeline')} className="underline font-semibold">Pipeline</button> → click any prospect card → use <strong>Send Proposal</strong> or <strong>Send Contract</strong> buttons to run Agents 10 and 11 automatically.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 mb-5 shadow-sm">
        {[
          { id: 'contracts', label: `Contracts (${contracts.length})` },
          { id: 'proposals', label: `Proposals (${proposals.length})` },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === t.id ? 'bg-[#2196F3] text-white' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-slate-400 text-sm">
          <Loader size={15} className="animate-spin" />
          Loading…
        </div>
      )}

      {/* Contracts tab */}
      {!loading && tab === 'contracts' && (
        <div className="space-y-3">
          {contracts.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <FileText size={32} className="mx-auto mb-3 opacity-30" />
              <div className="text-sm font-medium">No contracts yet</div>
              <div className="text-xs mt-1">Generate your first contract in the Pipeline page</div>
              <button
                onClick={() => onNavigate?.('pipeline')}
                className="mt-4 h-9 px-5 rounded-lg bg-[#1B3A5C] text-white text-sm font-medium hover:bg-[#243E6A] transition-colors"
              >
                Go to Pipeline
              </button>
            </div>
          ) : (
            contracts.map(c => (
              <ContractCard
                key={c.id}
                contract={c}
                onCampaignTrigger={load}
              />
            ))
          )}
        </div>
      )}

      {/* Proposals tab */}
      {!loading && tab === 'proposals' && (
        <div className="space-y-3">
          {proposals.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <FileText size={32} className="mx-auto mb-3 opacity-30" />
              <div className="text-sm font-medium">No proposals yet</div>
              <div className="text-xs mt-1">Generate proposals from the Pipeline page on call-booked prospects</div>
              <button
                onClick={() => onNavigate?.('pipeline')}
                className="mt-4 h-9 px-5 rounded-lg bg-[#1B3A5C] text-white text-sm font-medium hover:bg-[#243E6A] transition-colors"
              >
                Go to Pipeline
              </button>
            </div>
          ) : (
            proposals.map(p => (
              <ProposalCard key={p.id} proposal={p} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
