// GoHighLevel (GHL) API Integration
// Activates when VITE_GHL_API_KEY is present in .env
// Docs: https://highlevel.stoplight.io/docs/integrations

const GHL_KEY      = import.meta.env.VITE_GHL_API_KEY;
const GHL_LOCATION = import.meta.env.VITE_GHL_LOCATION_ID;
const GHL_BASE     = 'https://services.leadconnectorhq.com';

export function isGHLConnected() {
  return !!GHL_KEY;
}

async function ghlFetch(path, options = {}) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GHL_KEY}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `GHL ${res.status}`);
  return data;
}

/**
 * Create a contact in GHL for a newly signed client.
 */
export async function createContact({ name, email, phone, niche, location }) {
  if (!isGHLConnected()) {
    return {
      success: false, stub: true,
      message: 'Add VITE_GHL_API_KEY to .env to auto-create GHL contacts.',
    };
  }
  const [firstName, ...rest] = (name || '').split(' ');
  return ghlFetch('/contacts/', {
    method: 'POST',
    body: JSON.stringify({
      locationId: GHL_LOCATION,
      firstName,
      lastName: rest.join(' '),
      email,
      phone,
      tags: ['lead-gen-client', niche, location].filter(Boolean),
      customField: { niche, location },
    }),
  });
}

/**
 * Create an opportunity (deal) in GHL.
 */
export async function createOpportunity({ contactId, title, monetaryValue }) {
  if (!isGHLConnected()) return { stub: true };
  return ghlFetch('/opportunities/', {
    method: 'POST',
    body: JSON.stringify({
      title,
      locationId: GHL_LOCATION,
      contact_id: contactId,
      monetary_value: monetaryValue,
      status: 'open',
    }),
  });
}

/**
 * Sync a signed client: create contact → create opportunity.
 * Returns stub results when not connected.
 */
export async function syncClientToGHL({ name, email, phone, niche, location, monthlyValue }) {
  if (!isGHLConnected()) {
    return {
      success: false, stub: true,
      message: 'GoHighLevel not connected. Add VITE_GHL_API_KEY to .env to auto-sync clients.',
      readyPayload: { name, email, phone, niche, location, monthlyValue },
    };
  }

  const contact = await createContact({ name, email, phone, niche, location });
  const contactId = contact?.contact?.id;

  const opportunity = contactId
    ? await createOpportunity({ contactId, title: `${name} — ${niche}`, monetaryValue: monthlyValue })
    : null;

  return { success: true, contactId, opportunityId: opportunity?.opportunity?.id };
}
