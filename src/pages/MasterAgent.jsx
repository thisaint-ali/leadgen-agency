import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader, Bot, User, RefreshCw, Zap, AlertTriangle } from 'lucide-react';
import { buildMasterContext, buildMasterSystemPrompt } from '../agents/masterContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const isDemoMode = !API_KEY || API_KEY === 'your_anthropic_key_here';

const QUICK_PROMPTS = [
  'What agent is causing the most issues?',
  "What's our predicted revenue this month?",
  "How's the pipeline looking?",
  'What should I focus on to close my next client?',
  'Which integration should I connect first?',
  'What do I need to do before I can run campaigns on autopilot?',
];

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isUser ? 'bg-[#2196F3]' : 'bg-[#1B3A5C]'
      }`}>
        {isUser ? <User size={13} className="text-white" /> : <Bot size={13} className="text-white" />}
      </div>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? 'bg-[#2196F3] text-white rounded-tr-sm'
          : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
      }`}>
        {msg.content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-[#1B3A5C] flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot size={13} className="text-white" />
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StreamingBubble({ content }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-[#1B3A5C] flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot size={13} className="text-white" />
      </div>
      <div className="max-w-[80%] bg-white border border-[#2196F3]/30 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm text-slate-800">
        {content}
        <span className="inline-block w-0.5 h-4 bg-[#2196F3] ml-0.5 animate-pulse align-middle" />
      </div>
    </div>
  );
}

export default function MasterAgent() {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [streaming, setStreaming] = useState('');
  const [ctx, setCtx]           = useState(null);
  const [ctxLoading, setCtxLoading] = useState(true);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Load live context
  const loadContext = useCallback(async () => {
    setCtxLoading(true);
    const data = await buildMasterContext();
    setCtx(data);
    setCtxLoading(false);

    // Greeting message on first load
    if (messages.length === 0) {
      const p = data.pipeline;
      const greeting = data.isLive
        ? `Ready. Here's where things stand:\n\n📊 Pipeline: ${p.total} prospects · ${p.clients} active clients · $${p.mrr.toLocaleString()} MRR\n\n${p.staleProspects > 0 ? `⚠️ ${p.staleProspects} prospect${p.staleProspects > 1 ? 's' : ''} haven't been contacted in 7+ days.\n\n` : ''}Ask me anything — revenue projections, agent performance, what to focus on, or what integrations to connect next.`
        : `Ready. I'm running in demo mode (no Supabase data). I can still answer questions about how the system works and what to set up.\n\nAdd your Supabase credentials and run the schema files to see live data.`;
      setMessages([{ role: 'assistant', content: greeting }]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadContext(); }, [loadContext]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming, loading]);

  const send = async (text) => {
    const userMsg = (text || input).trim();
    if (!userMsg || loading) return;
    setInput('');

    const newMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setLoading(true);
    setStreaming('');

    if (isDemoMode) {
      await new Promise(r => setTimeout(r, 1200));
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Demo mode — I need an Anthropic API key to answer live questions.\n\nAdd VITE_ANTHROPIC_API_KEY to your .env file and restart the dev server. Once connected, I can answer questions about your pipeline, agent performance, revenue projections, and anything else about the business.`,
      }]);
      setLoading(false);
      return;
    }

    const systemPrompt = ctx ? buildMasterSystemPrompt(ctx) : 'You are the Master Agent for AMA Leads agency OS.';
    const history = newMessages.map(m => ({ role: m.role, content: m.content }));

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
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          system: systemPrompt,
          messages: history,
          stream: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      setLoading(false);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'content_block_delta' && data.delta?.text) {
                fullContent += data.delta.text;
                setStreaming(fullContent);
              }
            } catch { /* skip malformed SSE lines */ }
          }
        }
      }

      setStreaming('');
      const assistantMsg = { role: 'assistant', content: fullContent };
      setMessages(prev => [...prev, assistantMsg]);

      // Persist conversation
      if (isSupabaseConfigured() && supabase && fullContent) {
        supabase.from('master_conversations').insert([
          { role: 'user',      content: userMsg },
          { role: 'assistant', content: fullContent },
        ]).then(() => {});
      }
    } catch (err) {
      setStreaming('');
      setLoading(false);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // Stat chips from context
  const chips = ctx ? [
    { label: `${ctx.pipeline.clients} client${ctx.pipeline.clients !== 1 ? 's' : ''}`, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { label: `$${ctx.pipeline.mrr.toLocaleString()} MRR`,  color: 'text-[#2196F3] bg-blue-50 border-blue-200' },
    { label: `${ctx.pipeline.total} prospects`, color: 'text-slate-600 bg-slate-50 border-slate-200' },
    ...(ctx.agents.totalErrors > 0 ? [{ label: `${ctx.agents.totalErrors} agent error${ctx.agents.totalErrors !== 1 ? 's' : ''}`, color: 'text-red-600 bg-red-50 border-red-200' }] : []),
  ] : [];

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1B3A5C] flex items-center justify-center">
              <Bot size={17} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900">Master Agent</h1>
              <p className="text-xs text-slate-400">
                {ctxLoading ? 'Loading live data…' : ctx?.isLive ? 'Live data connected' : 'Demo mode'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Stat chips */}
            <div className="hidden md:flex items-center gap-2">
              {chips.map(c => (
                <span key={c.label} className={`text-xs font-medium px-2.5 py-1 rounded-full border ${c.color}`}>
                  {c.label}
                </span>
              ))}
            </div>
            <button
              onClick={loadContext}
              disabled={ctxLoading}
              title="Refresh live data"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={14} className={ctxLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Demo warning */}
      {isDemoMode && (
        <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-6 py-2.5">
          <div className="max-w-3xl mx-auto flex items-center gap-2.5 text-xs text-amber-800">
            <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
            <span>Demo mode — add <code className="font-mono font-semibold">VITE_ANTHROPIC_API_KEY</code> to .env to activate live chat.</span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
          {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
          {streaming && <StreamingBubble content={streaming} />}
          {loading && !streaming && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Quick prompts */}
      <div className="flex-shrink-0 border-t border-slate-100 bg-white px-6 pt-3 pb-1">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {QUICK_PROMPTS.map(p => (
              <button
                key={p}
                onClick={() => send(p)}
                disabled={loading}
                className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-slate-200 text-slate-500 hover:border-[#2196F3]/40 hover:text-[#2196F3] hover:bg-[#EEF6FE] transition-colors disabled:opacity-40"
              >
                <Zap size={11} />
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 bg-white border-t border-slate-200 px-6 pb-6 pt-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading}
              rows={1}
              placeholder="Ask anything about the business, agents, or pipeline…"
              className="flex-1 resize-none text-sm border border-slate-200 rounded-xl px-4 py-3 bg-white text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2196F3]/30 focus:border-[#2196F3] transition-colors disabled:opacity-50 leading-relaxed max-h-32 overflow-y-auto"
              style={{ height: 'auto' }}
              onInput={e => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
              }}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#2196F3] text-white flex items-center justify-center hover:bg-[#1565C0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? <Loader size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
          <p className="text-[10px] text-slate-300 mt-2 text-center">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

    </div>
  );
}
