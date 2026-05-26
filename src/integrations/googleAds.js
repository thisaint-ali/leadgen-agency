// Google Ads API Integration
// Activates when VITE_GOOGLE_ADS_KEY is present in .env
// Docs: https://developers.google.com/google-ads/api

const GOOGLE_ADS_KEY = import.meta.env.VITE_GOOGLE_ADS_KEY;

export function isGoogleAdsConnected() {
  return !!GOOGLE_ADS_KEY;
}

/**
 * Create a Google Ads campaign from agent outputs.
 * Returns a stub result with the ready payload when not connected.
 */
export async function createCampaign({ company, niche, location, keywords, adCopy, monthlyBudget }) {
  const payload = { company, niche, location, keywords, adCopy, monthlyBudget };

  if (!isGoogleAdsConnected()) {
    return {
      success: false,
      stub: true,
      message: `Campaign data ready. Add VITE_GOOGLE_ADS_KEY to .env to auto-push to Google Ads.`,
      readyToActivate: payload,
    };
  }

  // ── When connected, implement the following via Google Ads API ──────────────
  // 1. POST /v17/customers/{customerId}/campaigns
  //    → MAXIMIZE_CONVERSIONS bidding, location targeting, daily budget
  // 2. POST /v17/customers/{customerId}/adGroups (one per keyword tier)
  // 3. POST /v17/customers/{customerId}/ads (RSA with headlines + descriptions)
  // 4. POST /v17/customers/{customerId}/campaignCriteria (negative keywords)
  // 5. Return { campaignId, adGroupIds, status: 'created' }
  // ────────────────────────────────────────────────────────────────────────────

  throw new Error('Google Ads API integration pending. The data is ready — add your API key to activate.');
}

/**
 * Fetch live campaign performance metrics.
 */
export async function getCampaignPerformance(campaignId) {
  if (!isGoogleAdsConnected() || !campaignId) return null;

  // TODO: Query Google Ads Reporting API
  // SELECT campaign.id, metrics.impressions, metrics.clicks,
  //        metrics.conversions, metrics.cost_micros
  // FROM campaign WHERE campaign.id = {campaignId}
  // DATE RANGE: LAST_30_DAYS
  return null;
}
