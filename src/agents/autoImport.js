// Auto-import: parse Agent 1 prospect list → insert into Supabase prospects table
// Uses Claude Haiku (fast + cheap) to extract structured data from free-text output

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

/**
 * Parse Agent 1's markdown output and return structured prospect objects.
 * Falls back to a basic regex parser if API is not available.
 */
async function parseProspectsFromText(text) {
  if (API_KEY && API_KEY !== 'your_anthropic_key_here') {
    try {
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
          system: 'Extract business prospect data. Return ONLY a valid JSON array, no other text.',
          messages: [{
            role: 'user',
            content: `Extract every business from this prospect list. Return a JSON array where each object has:
- company_name (string, required)
- website (string or null — include http/https if present)
- phone (string or null)
- notes (string — include score, tier, and the 1-2 sentence reason)

Text:
${text}

Return ONLY the JSON array.`,
          }],
        }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text?.trim() || '';
      // Extract JSON array even if there's surrounding text
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) return JSON.parse(match[0]);
    } catch {
      // fall through to regex parser
    }
  }

  // ── Fallback: regex extraction ──────────────────────────────────────────────
  const blocks = text.split(/\n(?=\d+\.|#+\s|\*\*[A-Z])/);
  return blocks
    .map(block => {
      const nameMatch = block.match(/\*\*([^*]+)\*\*|^#+\s+(.+)|^\d+\.\s+(.+)/m);
      const name = (nameMatch?.[1] || nameMatch?.[2] || nameMatch?.[3] || '').trim();
      const website = block.match(/https?:\/\/[^\s)]+/)?.[0] || null;
      const phone = block.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] || null;
      if (!name || name.length < 3) return null;
      return { company_name: name, website, phone, notes: block.slice(0, 300).trim() };
    })
    .filter(Boolean);
}

/**
 * Main entry: parse Agent 1 output and insert prospects into Supabase.
 * Returns { imported, skipped, prospects, error }
 */
export async function importProspectsFromAgent1(agent1Output, { niche, location, supabase }) {
  if (!agent1Output?.trim()) return { imported: 0, error: 'No output to import' };

  let parsed;
  try {
    parsed = await parseProspectsFromText(agent1Output);
  } catch (e) {
    return { imported: 0, error: `Parse failed: ${e.message}` };
  }

  if (!parsed?.length) return { imported: 0, error: 'No prospects found in output' };

  // Build rows
  const rows = parsed
    .filter(p => p.company_name?.length >= 2)
    .map(p => ({
      company_name: p.company_name,
      website: p.website || null,
      phone: p.phone || null,
      niche: niche || 'roofing contractors',
      location: location || null,
      notes: p.notes || null,
      status: 'new',
      source: 'agent_1',
    }));

  if (!rows.length) return { imported: 0, error: 'Could not extract valid company names' };

  // Insert to Supabase (or return in-memory if no Supabase)
  if (supabase) {
    const { data, error } = await supabase.from('prospects').insert(rows).select();
    if (error) return { imported: 0, error: error.message };
    return { imported: data.length, prospects: data };
  }

  return { imported: rows.length, prospects: rows, note: 'Supabase not configured — data not persisted' };
}
