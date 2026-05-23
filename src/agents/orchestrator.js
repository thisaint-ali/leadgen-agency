const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

export async function callAgent(agentId, systemPrompt, userMessage, onStatusChange) {

  onStatusChange(agentId, 'running');

  try {

    const response = await fetch('https://api.anthropic.com/v1/messages', {

      method: 'POST',

      headers: {

        'Content-Type': 'application/json',

        'x-api-key': ANTHROPIC_API_KEY,

        'anthropic-version': '2023-06-01',

        'anthropic-dangerous-direct-browser-access': 'true',

      },

      body: JSON.stringify({

        model: 'claude-sonnet-4-20250514',

        max_tokens: 2000,

        system: systemPrompt,

        tools: [{ type: 'web_search_20250305', name: 'web_search' }],

        messages: [{ role: 'user', content: userMessage }],

      }),

    });

    if (!response.ok) {

      const err = await response.json();

      throw new Error(err.error?.message || `HTTP ${response.status}`);

    }

    const data = await response.json();

    const output = data.content

      .filter(b => b.type === 'text')

      .map(b => b.text)

      .join('\n')

      .trim();

    onStatusChange(agentId, 'done', output);

    return output;

  } catch (error) {

    onStatusChange(agentId, 'error', '', error.message);

    return null;

  }

}

export async function runAllAgents(

  { niche, location, extraContext },

  systemPrompts,

  onStatusChange,

  onLog

) {

  const ctx = {};

  const base = `Niche: ${niche}. Location: ${location}.${extraContext ? ' Additional context: ' + extraContext : ''}`;

  const log = (msg) => onLog(msg);

  // Wave 1: Agents 1 and 4 — no dependencies

  log('Wave 1 starting — Agent 1 and Agent 4 running in parallel');

  await Promise.all([

    callAgent(1, systemPrompts[1],

      `${base} Find real businesses to target as lead gen clients. Use web search to verify they are real.`,

      (id, status, output, error) => {

        onStatusChange(id, status, output, error);

        if (output) ctx[1] = output;

      }

    ),

    callAgent(4, systemPrompts[4],

      `${base} Build the complete keyword research package for this niche and location.`,

      (id, status, output, error) => {

        onStatusChange(id, status, output, error);

        if (output) ctx[4] = output;

      }

    ),

  ]);

  // Wave 2: Agents 2 and 5 — depend on Wave 1

  log('Wave 2 starting — Agent 2 and Agent 5 running in parallel');

  await Promise.all([

    callAgent(2, systemPrompts[2],

      `${base}\n\n[AGENT 1 — PROSPECT LIST]:\n${ctx[1] || 'No data from Agent 1'}\n\nQualify the top 2 prospects from this list using web search.`,

      (id, status, output, error) => {

        onStatusChange(id, status, output, error);

        if (output) ctx[2] = output;

      }

    ),

    callAgent(5, systemPrompts[5],

      `${base}\n\n[AGENT 4 — KEYWORDS]:\n${ctx[4] || 'No data from Agent 4'}\n\nWrite RSA ad copy using these exact keywords and this niche.`,

      (id, status, output, error) => {

        onStatusChange(id, status, output, error);

        if (output) ctx[5] = output;

      }

    ),

  ]);

  // Wave 3: Agents 3 and 6 — depend on Wave 2

  log('Wave 3 starting — Agent 3 and Agent 6 running in parallel');

  await Promise.all([

    callAgent(3, systemPrompts[3],

      `${base}\n\n[AGENT 1 — PROSPECTS]:\n${ctx[1] || 'No data'}\n\n[AGENT 2 — QUALIFICATION]:\n${ctx[2] || 'No data'}\n\nWrite cold outreach for the top qualified prospect.`,

      (id, status, output, error) => {

        onStatusChange(id, status, output, error);

        if (output) ctx[3] = output;

      }

    ),

    callAgent(6, systemPrompts[6],

      `${base}\n\n[AGENT 4 — KEYWORDS]:\n${ctx[4] || 'No data'}\n\n[AGENT 5 — AD COPY]:\n${ctx[5] || 'No data'}\n\nBuild the LP brief with perfect message match to these ads and keywords.`,

      (id, status, output, error) => {

        onStatusChange(id, status, output, error);

        if (output) ctx[6] = output;

      }

    ),

  ]);

  // Wave 4: Agent 7 — depends on all prior agents

  log('Wave 4 starting — Agent 7 integrating all outputs');

  await callAgent(7, systemPrompts[7],

    `${base}\n\n[A1 — PROSPECTS]:\n${ctx[1] || 'No data'}\n\n[A2 — QUALIFICATION]:\n${ctx[2] || 'No data'}\n\n[A3 — OUTREACH]:\n${ctx[3] || 'No data'}\n\n[A4 — KEYWORDS]:\n${ctx[4] || 'No data'}\n\n[A5 — AD COPY]:\n${ctx[5] || 'No data'}\n\n[A6 — LANDING PAGE]:\n${ctx[6] || 'No data'}\n\nReview all outputs and produce the integrated campaign assessment.`,

    (id, status, output, error) => {

      onStatusChange(id, status, output, error);

      if (output) ctx[7] = output;

    }

  );

  log('All agents complete');

  return ctx;

}
