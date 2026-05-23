import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const SECTIONS = [
  {
    title: 'Niche Viability Criteria',
    content: `A viable niche has: high customer LTV (roofing $8k-25k/job, PI $50k-500k/case), recurring or urgent demand, phone-based sales process, local competition without national domination, real Google search volume with commercial intent.

Best niches ranked by ease of entry + payout:
1. Roofing
2. Foundation Repair
3. Water Damage Restoration
4. HVAC
5. Personal Injury
6. Solar
7. Dental Implants
8. Med Spas`,
  },
  {
    title: 'Lead Economics',
    content: `KEY METRICS:
CPL = total ad spend ÷ leads generated
Close rate = % of leads that become paying jobs (roofing 20-35%, PI 5-15%)
ROAS = revenue generated ÷ ad spend
LTV = customer lifetime value including referrals

EXAMPLE:
Roofing client: $3k/month spend → 30 leads at $100 CPL → 8 closed at $12k avg = $96k revenue.
Your $2k retainer on $96k revenue = untouchable value proposition.`,
  },
  {
    title: 'Google Ads Campaign Structure',
    content: `CAMPAIGN TYPES:
- Search: primary weapon, captures existing demand
- LSA (Local Services Ads): underused, pay-per-lead built in, powerful for local
- Display/YouTube: retargeting only, not primary lead gen

STRUCTURE:
- 1 campaign per service line or major location
- Max 5 tightly related keywords per ad group
- 3 RSAs per ad group minimum
- Separate brand from non-brand campaigns always

BIDDING PROGRESSION:
1. Start: Manual CPC or Maximize Clicks with CPC cap
2. After 30-50 conversions: Target CPA
3. At scale: Target ROAS`,
  },
  {
    title: 'Conversion Tracking Setup',
    content: `REQUIRED BEFORE LAUNCH:
1. Google Tag Manager on every client site
2. CallRail or CallTrackingMetrics — track calls from ads AND organic
3. Form submissions as conversions — GTM trigger on thank-you page
4. Import conversions from GA4 as backup
5. Conversion window: 30 days minimum for roofing and similar niches

PRIMARY CONVERSIONS (use as bidding signal):
- Phone calls 60+ seconds
- Form submissions

SECONDARY CONVERSIONS (observation only):
- Short calls, scroll depth, page views`,
  },
  {
    title: 'Ideal Client Profile',
    content: `TARGET:
- Revenue $500k-$5M/year
- Ad budget: willing to spend $1,500-$10,000/month
- Phone-heavy sales process
- No in-house marketing or overwhelmed office manager doing it
- Owner is the decision maker
- Currently on HomeAdvisor/Angi (knows lead gen works, wants exclusivity)

STRONG SIGNALS:
- Website built before 2018 or not mobile-responsive
- No Google Ads on primary keyword search
- GBP with 50+ reviews but no ad spend
- Active Facebook but no paid digital

AVOID:
- Already running heavy ads with an agency
- Franchise with national management
- Under 2 years in business
- Owner does not believe in digital marketing`,
  },
  {
    title: 'Sales Process',
    content: `FIRST CLIENT OFFER:
Free leads trial — 5-10 leads, you cover ad spend. Removes all risk. Once they see closed jobs, retainer conversation is easy.

DISCOVERY CALL STRUCTURE:
1. Get them talking about their business first
2. Pain: "What's your biggest challenge getting new jobs right now?"
3. Current state: "What are you doing for lead gen? What's that costing?"
4. Desired state: "If you had 20 new calls/month consistently, what would that mean?"
5. Bridge: show specifically how you get them there, with numbers
6. Close: "If I can deliver that, are you ready to start this month?"

CONTRACT TERMS:
- 3-month minimum (Google Ads takes 60-90 days to optimize)
- Ad spend separate from management fee in contract
- Client owns the ad account — you get access
- 30-day out clause after initial term`,
  },
  {
    title: 'Tech Stack',
    content: `CORE:
- GoHighLevel — CRM, funnels, call tracking, client reporting, reputation management
- Google Ads — primary ad platform
- CallRail — phone lead attribution
- Google Looker Studio — client-facing dashboards (free, connect Ads + CallRail + GA4)

SCALING:
- Notion or Linear — internal project management
- Stripe — billing
- Slack — client communication (optional, professionalizes you)

SCALING TRIGGERS:
- 3 clients → part-time VA for reporting and basic optimizations
- 6 clients → junior media buyer
- 10 clients → SOPs for everything, repeatable onboarding
- 15+ clients → dedicated account manager per 5-6 clients`,
  },
];

function Section({ title, content }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-slate-800">{title}</span>
        {open
          ? <ChevronDown size={15} className="text-slate-400 flex-shrink-0" />
          : <ChevronRight size={15} className="text-slate-400 flex-shrink-0" />
        }
      </button>
      {open && (
        <div className="border-t border-slate-100 px-5 py-4 bg-slate-50">
          <pre className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed font-mono">{content}</pre>
        </div>
      )}
    </div>
  );
}

export default function Knowledge() {
  return (
    <div className="p-6 max-w-3xl mx-auto">

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Knowledge Base</h1>
        <p className="text-sm text-slate-500 mt-1">Full reference for running a Google Ads lead gen agency</p>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-3 mb-7">
        {[
          { label: 'Sections', value: '7' },
          { label: 'Top niches', value: '8' },
          { label: 'Avg client value', value: '$24k/yr' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 text-center">
            <div className="text-lg font-bold text-[#2196F3]">{value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {SECTIONS.map(s => <Section key={s.title} {...s} />)}
      </div>
    </div>
  );
}
