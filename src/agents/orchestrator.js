import { MOCK_OUTPUTS } from './mockOutputs.js';

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

export function isDemoMode() {
  return (
    !ANTHROPIC_API_KEY ||
    ANTHROPIC_API_KEY === 'your_anthropic_key_here' ||
    ANTHROPIC_API_KEY.trim() === ''
  );
}

// Simulated delays per agent (ms) — makes demo feel realistic
const MOCK_DELAYS = { 1: 3200, 2: 4100, 3: 3800, 4: 2900, 5: 3500, 6: 4200, 7: 5000 };

// ─── Abort control — exported so AgentNetwork can cancel mid-run ─────────────
let _abortController = null;

export function abortCurrentRun() {
  if (_abortController) {
    _abortController.abort();
    _abortController = null;
  }
}

// ─── Call a single agent with timeout + abort support ────────────────────────
export async function callAgent(agentId, systemPrompt, userMessage, onStatusChange, signal = null) {
  onStatusChange(agentId, 'running');

  if (isDemoMode()) {
    await new Promise(r => setTimeout(r, MOCK_DELAYS[agentId] || 3000));
    const output = MOCK_OUTPUTS[agentId] || `[Demo] Agent ${agentId} output — add your Anthropic API key to run live.`;
    onStatusChange(agentId, 'done', output);
    return output;
  }

  // Per-agent 2-minute timeout + external abort support
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 120_000);
  if (signal) signal.addEventListener('abort', () => controller.abort());

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type':  'application/json',
        'x-api-key':     ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system:     systemPrompt,
        tools:      [{ type: 'web_search_20250305', name: 'web_search' }],
        messages:   [{ role: 'user', content: userMessage }],
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }

    const data   = await response.json();
    const output = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    onStatusChange(agentId, 'done', output);
    return output;
  } catch (error) {
    clearTimeout(timeoutId);
    const isAbort = error.name === 'AbortError';
    const msg     = isAbort ? 'Timed out after 2 minutes — try again' : error.message;
    onStatusChange(agentId, 'error', '', msg);
    return null;
  }
}

// ─── Run all 7 pipeline agents in waves ──────────────────────────────────────
export async function runAllAgents(
  { niche, location, extraContext },
  systemPrompts,
  onStatusChange,
  onLog
) {
  const ctx  = {};
  const base = `Niche: ${niche}. Location: ${location}.${extraContext ? ' Additional context: ' + extraContext : ''}`;
  const log  = (msg) => onLog(msg);

  // Abort controller for this run — lets AgentNetwork cancel via abortCurrentRun()
  _abortController = new AbortController();
  const { signal } = _abortController;

  // Wrapper that captures outputs into ctx
  const track = (id, status, output, error) => {
    onStatusChange(id, status, output, error);
    if (output) ctx[id] = output;
  };

  // ── Wave 1: Agents 1 & 4 — no dependencies ──────────────────────────────────
  log('Wave 1 starting — Agent 1 and Agent 4 running in parallel');
  await Promise.all([
    callAgent(1, systemPrompts[1],
      `${base} Find real businesses to target as lead gen clients. Use web search to verify they are real.`,
      track, signal),
    callAgent(4, systemPrompts[4],
      `${base} Build the complete keyword research package for this niche and location.`,
      track, signal),
  ]);

  // ── Wave 2: Agents 2 & 5 ────────────────────────────────────────────────────
  log('Wave 2 starting — Agent 2 and Agent 5 running in parallel');
  await Promise.all([
    callAgent(2, systemPrompts[2],
      `${base}\n\n[AGENT 1 — PROSPECT LIST]:\n${ctx[1] || 'No data from Agent 1'}\n\nQualify the top 2 prospects from this list using web search.`,
      track, signal),
    callAgent(5, systemPrompts[5],
      `${base}\n\n[AGENT 4 — KEYWORDS]:\n${ctx[4] || 'No data from Agent 4'}\n\nWrite RSA ad copy using these exact keywords and this niche.`,
      track, signal),
  ]);

  // ── Wave 3: Agents 3 & 6 ────────────────────────────────────────────────────
  log('Wave 3 starting — Agent 3 and Agent 6 running in parallel');
  await Promise.all([
    callAgent(3, systemPrompts[3],
      `${base}\n\n[AGENT 1 — PROSPECTS]:\n${ctx[1] || 'No data'}\n\n[AGENT 2 — QUALIFICATION]:\n${ctx[2] || 'No data'}\n\nWrite cold outreach for the top qualified prospect.`,
      track, signal),
    callAgent(6, systemPrompts[6],
      `${base}\n\n[AGENT 4 — KEYWORDS]:\n${ctx[4] || 'No data'}\n\n[AGENT 5 — AD COPY]:\n${ctx[5] || 'No data'}\n\nBuild the LP brief with perfect message match to these ads and keywords.`,
      track, signal),
  ]);

  // ── Wave 4: Agent 7 — integrates all outputs ─────────────────────────────────
  log('Wave 4 starting — Agent 7 integrating all outputs');
  await callAgent(7, systemPrompts[7],
    `${base}\n\n[A1 — PROSPECTS]:\n${ctx[1] || 'No data'}\n\n[A2 — QUALIFICATION]:\n${ctx[2] || 'No data'}\n\n[A3 — OUTREACH]:\n${ctx[3] || 'No data'}\n\n[A4 — KEYWORDS]:\n${ctx[4] || 'No data'}\n\n[A5 — AD COPY]:\n${ctx[5] || 'No data'}\n\n[A6 — LANDING PAGE]:\n${ctx[6] || 'No data'}\n\nReview all outputs and produce the integrated campaign assessment.`,
    track, signal);

  log('All agents complete');
  _abortController = null;
  return ctx;
}
