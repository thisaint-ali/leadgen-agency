// Integration registry — each entry activates when its env var is present
// To connect: add the env var to .env and redeploy (or restart dev server)

export const INTEGRATIONS = {
  anthropic: {
    key: 'anthropic',
    name: 'Anthropic (Claude AI)',
    envKey: 'VITE_ANTHROPIC_API_KEY',
    category: 'Core',
    icon: '🤖',
    connected: () => {
      const k = import.meta.env.VITE_ANTHROPIC_API_KEY;
      return !!(k && k !== 'your_anthropic_key_here' && k.trim() !== '');
    },
    unlocks: [
      'All 7 AI agents',
      'Master Agent chat',
      'Auto-import prospect parsing',
      'Campaign auto-build',
    ],
    getKeyUrl: 'https://console.anthropic.com/settings/keys',
    docsUrl: 'https://docs.anthropic.com',
    setupInstructions: 'Create an API key at console.anthropic.com → Settings → API Keys. Add VITE_ANTHROPIC_API_KEY=sk-ant-... to your .env file.',
  },

  resend: {
    key: 'resend',
    name: 'Resend (Email)',
    envKey: 'VITE_RESEND_API_KEY',
    category: 'Outreach',
    icon: '✉️',
    connected: () => !!import.meta.env.VITE_RESEND_API_KEY,
    unlocks: [
      'Auto-send outreach emails from Pipeline',
      'Follow-up sequences',
      'Email delivery tracking',
      'Drip campaign queuing',
    ],
    getKeyUrl: 'https://resend.com/api-keys',
    docsUrl: 'https://resend.com/docs',
    setupInstructions: 'Sign up at resend.com, add your sending domain, create an API key. Add VITE_RESEND_API_KEY=re_... and VITE_FROM_EMAIL=you@yourdomain.com to .env.',
  },

  googleAds: {
    key: 'googleAds',
    name: 'Google Ads',
    envKey: 'VITE_GOOGLE_ADS_KEY',
    category: 'Ads',
    icon: '📈',
    connected: () => !!import.meta.env.VITE_GOOGLE_ADS_KEY,
    unlocks: [
      'Auto-create campaigns from agent output',
      'Push keywords + RSA ad copy directly',
      'Live CPL and ROAS reporting',
      'Budget pacing alerts',
    ],
    getKeyUrl: 'https://developers.google.com/google-ads/api/docs/get-started/introduction',
    docsUrl: 'https://developers.google.com/google-ads/api',
    setupInstructions: 'Apply for Google Ads API access, set up OAuth, get a developer token. Add VITE_GOOGLE_ADS_KEY to .env. Typically takes 1-3 days for approval.',
  },

  ghl: {
    key: 'ghl',
    name: 'GoHighLevel',
    envKey: 'VITE_GHL_API_KEY',
    category: 'CRM / Funnels',
    icon: '🚀',
    connected: () => !!import.meta.env.VITE_GHL_API_KEY,
    unlocks: [
      'Auto-create client contacts in GHL',
      'Push LP briefs as funnel drafts',
      'Sub-account creation per client',
      'Pipeline sync with GHL opportunities',
    ],
    getKeyUrl: 'https://app.gohighlevel.com/settings/integrations',
    docsUrl: 'https://highlevel.stoplight.io/docs/integrations',
    setupInstructions: 'In GoHighLevel: Settings → Integrations → API Keys → Create API Key. Add VITE_GHL_API_KEY and VITE_GHL_LOCATION_ID to .env.',
  },
};

export function isConnected(key) {
  return INTEGRATIONS[key]?.connected() ?? false;
}

export function getConnectedCount() {
  return Object.values(INTEGRATIONS).filter(i => i.connected()).length;
}

export function getIntegrationStatus() {
  return Object.fromEntries(
    Object.entries(INTEGRATIONS).map(([k, v]) => [k, v.connected()])
  );
}
