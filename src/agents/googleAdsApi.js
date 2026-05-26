// Google Ads API — real campaign creation
// Requires env vars: VITE_GOOGLE_ADS_DEVELOPER_TOKEN, VITE_GOOGLE_ADS_CLIENT_ID,
//   VITE_GOOGLE_ADS_CLIENT_SECRET, VITE_GOOGLE_ADS_REFRESH_TOKEN, VITE_GOOGLE_ADS_CUSTOMER_ID

const DEV_TOKEN     = import.meta.env.VITE_GOOGLE_ADS_DEVELOPER_TOKEN;
const CLIENT_ID     = import.meta.env.VITE_GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_ADS_CLIENT_SECRET;
const REFRESH_TOKEN = import.meta.env.VITE_GOOGLE_ADS_REFRESH_TOKEN;
const CUSTOMER_ID   = import.meta.env.VITE_GOOGLE_ADS_CUSTOMER_ID?.replace(/-/g, '');

const API_KEY       = import.meta.env.VITE_ANTHROPIC_API_KEY;
const DEMO_API      = !API_KEY || API_KEY === 'your_anthropic_key_here';

const GADS_BASE = `https://googleads.googleapis.com/v18/customers/${CUSTOMER_ID}`;

export function isGoogleAdsFullyConnected() {
  return !!(DEV_TOKEN && CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN && CUSTOMER_ID);
}

// ─── Get OAuth access token from refresh token ───────────────────────────────
async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`OAuth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ─── Generic mutate call ─────────────────────────────────────────────────────
async function mutate(accessToken, resource, operations) {
  const res = await fetch(`${GADS_BASE}/${resource}:mutate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': DEV_TOKEN,
    },
    body: JSON.stringify({ operations }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Google Ads API error on ${resource}: ${data.error.message}`);
  return data;
}

// ─── Use Claude to extract structured data from agent outputs ────────────────
async function parseWithClaude(systemMsg, userMsg) {
  if (DEMO_API) return null;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-20250514',
      max_tokens: 2000,
      system: systemMsg,
      messages: [{ role: 'user', content: userMsg }],
    }),
  });
  const data = await res.json();
  const raw = data.content?.[0]?.text?.trim() || '{}';
  const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return match ? JSON.parse(match[0]) : null;
}

// ─── Parse keywords from Agent 4 output ────────────────────────────────────
async function parseKeywords(agent4Output) {
  const parsed = await parseWithClaude(
    'Extract keywords from Google Ads keyword research. Return ONLY a JSON array of objects: { "text": "keyword text", "matchType": "EXACT"|"PHRASE"|"BROAD" }. Include 10-20 highest-intent keywords (Tier 1 and 2 only). No other text.',
    agent4Output
  );
  if (parsed && Array.isArray(parsed)) return parsed.slice(0, 20);
  // Fallback: basic extraction
  const lines = agent4Output.split('\n').filter(l => l.match(/^\s*[-•*]?\s*\[?(EXACT|PHRASE|BROAD)\]?/i) || l.match(/^\s*\d+\.\s/));
  return lines.slice(0, 15).map(l => {
    const matchType = l.match(/\[?EXACT\]?/i) ? 'EXACT' : l.match(/\[?PHRASE\]?/i) ? 'PHRASE' : 'BROAD';
    const text = l.replace(/[-•*\[\]]/g, '').replace(/(EXACT|PHRASE|BROAD)/gi, '').replace(/^\d+\.\s*/, '').trim().toLowerCase().slice(0, 80);
    return text ? { text, matchType } : null;
  }).filter(Boolean);
}

// ─── Parse RSA copy from Agent 5 output ────────────────────────────────────
async function parseAdCopy(agent5Output) {
  const parsed = await parseWithClaude(
    'Extract Google RSA ad copy. Return ONLY a JSON object: { "headlines": ["h1","h2",...], "descriptions": ["d1","d2","d3","d4"] }. Headlines max 30 chars each, descriptions max 90 chars each. Take the best performing variant. Trim to fit limits. Return only the JSON object.',
    agent5Output
  );
  if (parsed?.headlines && parsed?.descriptions) {
    return {
      headlines: parsed.headlines.slice(0, 15).map(h => h.slice(0, 30)),
      descriptions: parsed.descriptions.slice(0, 4).map(d => d.slice(0, 90)),
    };
  }
  // Fallback defaults
  return {
    headlines: ['Get More Leads', 'Free Estimate Today', 'Top Rated Locally', 'Call Now Available', 'No Contract Required'],
    descriptions: ['We help local businesses grow with Google Ads. Free 30-day trial — no retainer needed.', 'Proven results for local service companies. Call today and get started.'],
  };
}

// ─── Main: create full campaign from agent outputs ───────────────────────────
export async function createGoogleAdsCampaign({
  company,
  niche,
  location,
  monthlyBudget = 1500,
  landingPageUrl = 'https://amaleads.org',
  agent4Output = '',
  agent5Output = '',
  onProgress,
}) {
  const log = (msg) => onProgress?.(msg);

  if (!isGoogleAdsFullyConnected()) {
    log('Google Ads API not configured — campaign saved as document only');
    return {
      success: false,
      stub: true,
      message: 'Add Google Ads API credentials to .env to push campaigns automatically',
    };
  }

  try {
    log('Authenticating with Google Ads…');
    const token = await getAccessToken();

    log('Parsing keywords from Agent 4…');
    const keywords = await parseKeywords(agent4Output);
    log(`Extracted ${keywords.length} keywords`);

    log('Parsing RSA copy from Agent 5…');
    const adCopy = await parseAdCopy(agent5Output);
    log(`Extracted ${adCopy.headlines.length} headlines, ${adCopy.descriptions.length} descriptions`);

    // Daily budget (monthly / 30.4)
    const dailyBudgetMicros = Math.round((monthlyBudget / 30.4) * 1_000_000);

    // 1. Create campaign budget
    log('Creating campaign budget…');
    const budgetRes = await mutate(token, 'campaignBudgets', [{
      create: {
        name: `AMA Leads — ${company} — ${new Date().toISOString().slice(0,10)}`,
        amountMicros: dailyBudgetMicros,
        deliveryMethod: 'STANDARD',
      },
    }]);
    const budgetResourceName = budgetRes.results[0].resourceName;

    // 2. Create campaign (PAUSED — review before enabling)
    log('Creating campaign…');
    const campaignRes = await mutate(token, 'campaigns', [{
      create: {
        name: `AMA Leads — ${company} — ${niche}`,
        advertisingChannelType: 'SEARCH',
        status: 'PAUSED',
        campaignBudget: budgetResourceName,
        manualCpc: { enhancedCpcEnabled: true },
        networkSettings: {
          targetGoogleSearch: true,
          targetSearchNetwork: true,
          targetContentNetwork: false,
          targetPartnerSearchNetwork: false,
        },
        geoTargetTypeSetting: {
          positiveGeoTargetType: 'PRESENCE_OR_INTEREST',
        },
      },
    }]);
    const campaignResourceName = campaignRes.results[0].resourceName;
    const campaignId = campaignResourceName.split('/').pop();

    // 3. Create ad group
    log('Creating ad group…');
    const adGroupRes = await mutate(token, 'adGroups', [{
      create: {
        name: `${niche} — High Intent`,
        campaign: campaignResourceName,
        type: 'SEARCH_STANDARD',
        status: 'ENABLED',
        cpcBidMicros: 3_000_000, // $3.00 default starting CPC
      },
    }]);
    const adGroupResourceName = adGroupRes.results[0].resourceName;

    // 4. Add keywords
    if (keywords.length > 0) {
      log(`Adding ${keywords.length} keywords…`);
      await mutate(token, 'adGroupCriteria', keywords.map(kw => ({
        create: {
          adGroup: adGroupResourceName,
          keyword: {
            text: kw.text,
            matchType: kw.matchType,
          },
          status: 'ENABLED',
        },
      })));
    }

    // 5. Create RSA
    log('Creating RSA ad…');
    await mutate(token, 'adGroupAds', [{
      create: {
        adGroup: adGroupResourceName,
        status: 'ENABLED',
        ad: {
          responsiveSearchAd: {
            headlines: adCopy.headlines.map(text => ({ text })),
            descriptions: adCopy.descriptions.map(text => ({ text })),
          },
          finalUrls: [landingPageUrl],
        },
      },
    }]);

    log(`✅ Campaign created! ID: ${campaignId} — STATUS: PAUSED (review before enabling)`);

    return {
      success: true,
      campaignId,
      campaignResourceName,
      keywordsAdded: keywords.length,
      status: 'paused',
      reviewUrl: `https://ads.google.com/aw/overview?campaignId=${campaignId}`,
    };

  } catch (err) {
    log(`❌ Google Ads error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ─── Pull campaign performance metrics ───────────────────────────────────────
export async function fetchCampaignPerformance(googleAdsCampaignId) {
  if (!isGoogleAdsFullyConnected()) return null;

  try {
    const token = await getAccessToken();
    const query = `
      SELECT
        campaign.id, campaign.name, campaign.status,
        metrics.impressions, metrics.clicks, metrics.conversions,
        metrics.cost_micros, metrics.average_cpc,
        metrics.ctr, metrics.conversions_from_interactions_rate
      FROM campaign
      WHERE campaign.id = ${googleAdsCampaignId}
        AND segments.date DURING LAST_7_DAYS
    `;
    const res = await fetch(`${GADS_BASE}/googleAds:searchStream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'developer-token': DEV_TOKEN,
      },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    if (!data[0]?.results?.[0]) return null;
    const r = data[0].results[0];
    return {
      impressions:      Number(r.metrics?.impressions     || 0),
      clicks:           Number(r.metrics?.clicks          || 0),
      conversions:      Number(r.metrics?.conversions     || 0),
      costMicros:       Number(r.metrics?.costMicros      || 0),
      avgCpcMicros:     Number(r.metrics?.averageCpc      || 0),
      ctr:              Number(r.metrics?.ctr             || 0),
      conversionRate:   Number(r.metrics?.conversionsFromInteractionsRate || 0),
    };
  } catch {
    return null;
  }
}

// ─── Enable a paused campaign (call after human review) ─────────────────────
export async function enableCampaign(campaignResourceName) {
  if (!isGoogleAdsFullyConnected()) return false;
  const token = await getAccessToken();
  await mutate(token, 'campaigns', [{
    update: { resourceName: campaignResourceName, status: 'ENABLED' },
    updateMask: 'status',
  }]);
  return true;
}
