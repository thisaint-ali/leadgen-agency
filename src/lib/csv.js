// ─── CSV utility ──────────────────────────────────────────────────────────────
// exportToCSV(rows, filename) — download an array of objects as a CSV file
// parseCSV(text)              — parse a CSV string into an array of objects

/**
 * Export an array of objects to a downloadable CSV file.
 * @param {object[]} rows
 * @param {string}   filename  (without .csv)
 */
export function exportToCSV(rows, filename = 'export') {
  if (!rows?.length) return;

  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    // wrap in quotes if contains comma, quote, or newline
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const header = cols.map(esc).join(',');
  const body   = rows.map(r => cols.map(c => esc(r[c])).join(',')).join('\n');
  const csv    = header + '\n' + body;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Parse a CSV string (with or without a header row) into an array of objects.
 * If `headers` is provided those are used; otherwise the first row is the header.
 * @param {string}   text
 * @param {string[]} [headers]
 * @returns {object[]}
 */
export function parseCSV(text, headers = null) {
  if (!text?.trim()) return [];

  const rows = splitCSVRows(text.trim());
  if (!rows.length) return [];

  const headerRow = headers || splitCSVCells(rows[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const dataRows  = headers ? rows : rows.slice(1);

  return dataRows
    .map(row => {
      const cells = splitCSVCells(row);
      const obj   = {};
      headerRow.forEach((h, i) => {
        obj[h] = cells[i]?.trim() ?? '';
      });
      return obj;
    })
    .filter(r => Object.values(r).some(v => v !== ''));
}

/**
 * Split a CSV string into rows (respects quoted newlines).
 */
function splitCSVRows(text) {
  const rows = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuote && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if ((ch === '\n' || ch === '\r') && !inQuote) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      if (current.trim()) rows.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) rows.push(current);
  return rows;
}

/**
 * Split a single CSV row into cells.
 */
function splitCSVCells(row) {
  const cells = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuote && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === ',' && !inQuote) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

// ─── Column alias map — maps common spreadsheet headers to our schema ─────────
// Used when importing prospects from a pasted spreadsheet.
const ALIAS = {
  // company
  company:       'company_name',
  company_name:  'company_name',
  business:      'company_name',
  business_name: 'company_name',
  name:          'company_name',
  // contact
  contact:       'contact_name',
  contact_name:  'contact_name',
  owner:         'contact_name',
  person:        'contact_name',
  // email
  email:         'email',
  email_address: 'email',
  // phone
  phone:         'phone',
  phone_number:  'phone',
  mobile:        'phone',
  cell:          'phone',
  // website
  website:       'website',
  url:           'website',
  web:           'website',
  // niche
  niche:         'niche',
  industry:      'niche',
  type:          'niche',
  category:      'niche',
  // location
  location:      'location',
  city:          'location',
  area:          'location',
  region:        'location',
  state:         'location',
  // notes
  notes:         'notes',
  note:          'notes',
  comments:      'notes',
  comment:       'notes',
  // value
  monthly_value: 'monthly_value',
  retainer:      'monthly_value',
  value:         'monthly_value',
  mrr:           'monthly_value',
};

/**
 * Normalize a parsed CSV row (with potentially messy headers) into a prospect object.
 * @param {object} row
 * @param {object} [defaults]  — { niche, location } to fall back to
 * @returns {object|null}
 */
export function normalizeProspectRow(row, defaults = {}) {
  const out = {};

  for (const [key, val] of Object.entries(row)) {
    const normalized = key.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const field = ALIAS[normalized];
    if (field && val?.trim()) out[field] = val.trim();
  }

  // Apply defaults for missing required-ish fields
  if (!out.company_name) return null;
  if (!out.niche     && defaults.niche)    out.niche    = defaults.niche;
  if (!out.location  && defaults.location) out.location = defaults.location;

  return out;
}
