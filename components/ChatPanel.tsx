'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
} from 'react';
import type { LocalMessage, TableCardData, ChatResponse, Column, VisualCard } from '@/types';

interface ChatPanelProps {
  messages: LocalMessage[];
  isSending: boolean;
  sessionId: number | null;
  onSend: (text: string) => Promise<ChatResponse | null>;
  onTableAction: (tableName: string, x: number, y: number) => void;
  existingTables: TableCardData[];
  onPrefill: (tableName: string, columns: Column[], values: Record<string, unknown>) => void;
  onQueryResult: (card: Omit<VisualCard, 'id' | 'x' | 'y'>) => void;
}

// Linear-style icon set for chat
const Icons = {
  Send: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
    </svg>
  ),
  ChevronUp: ({ rotated }: { rotated?: boolean }) => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: rotated ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
      <path d="M18 15l-6-6-6 6" />
    </svg>
  ),
  Sparkle: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" />
    </svg>
  ),
  Warning: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Zap: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
};

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2.5">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </div>
  );
}

function TypewriterText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = 0;
    setDisplayed('');
    const interval = setInterval(() => {
      if (indexRef.current >= text.length) {
        clearInterval(interval);
        return;
      }
      indexRef.current++;
      setDisplayed(text.slice(0, indexRef.current));
    }, 16);
    return () => clearInterval(interval);
  }, [text]);

  return <>{renderMessageText(displayed)}</>;
}

function renderMessageText(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      const inner = part.slice(1, -1);
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded-md bg-violet-500/12 text-violet-300 font-mono text-[10px] border border-violet-500/20"
        >
          {inner}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// Morph AI avatar
function MorphAvatar() {
  return (
    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(124,58,237,0.3)]">
      <Icons.Sparkle />
    </div>
  );
}

function MessageBubble({
  message,
  isLatestAssistant,
  onSuggestionClick,
}: {
  message: LocalMessage;
  isLatestAssistant: boolean;
  onSuggestionClick?: (text: string) => void;
}) {
  const isUser = message.role === 'user';

  if (message.isTyping) {
    return (
      <div className="flex items-end gap-2.5 justify-start animate-fade-in">
        <MorphAvatar />
        <div className="bg-[#17172a] border border-[#242438] rounded-2xl rounded-bl-sm">
          <TypingIndicator />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-2.5 animate-fade-in ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && <MorphAvatar />}

      <div className={`flex flex-col gap-1.5 max-w-[82%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-[12px] leading-relaxed ${
            isUser
              ? 'bg-gradient-to-br from-violet-600 to-violet-700 text-white rounded-br-sm shadow-[0_2px_8px_rgba(124,58,237,0.3)]'
              : 'bg-[#17172a] border border-[#242438] text-zinc-300 rounded-bl-sm'
          }`}
        >
          {isUser ? (
            renderMessageText(message.text)
          ) : isLatestAssistant ? (
            <TypewriterText text={message.text} />
          ) : (
            renderMessageText(message.text)
          )}
        </div>

        {/* Suggestion chips — only on plan messages */}
        {message.suggestions && message.suggestions.length > 0 && isLatestAssistant && (
          <div className="flex flex-col gap-1.5 mt-0.5 w-full">
            {message.suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => onSuggestionClick?.(s)}
                className="text-left px-3 py-2 rounded-xl text-[11px] text-violet-300 border border-violet-500/20 bg-violet-500/6 hover:bg-violet-500/14 hover:border-violet-500/45 transition-all duration-150 leading-snug group cursor-pointer"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-violet-500/60 group-hover:text-violet-400 transition-colors">
                    <Icons.Zap />
                  </span>
                  {s}
                </span>
              </button>
            ))}
          </div>
        )}

        {message.warning && (
          <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/8 border border-amber-500/15 text-[10px] text-amber-400/80 max-w-full">
            <span className="shrink-0 mt-0.5"><Icons.Warning /></span>
            <span className="leading-tight">{message.warning}</span>
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-6 h-6 rounded-lg bg-[#1e1e2e] border border-[#2a2a3e] flex items-center justify-center shrink-0">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      )}
    </div>
  );
}

// Placeholder prompts shown when chat is empty
const EMPTY_PROMPTS = [
  'Set up a CRM with clients and deals',
  'Create an inventory management system',
  'Build a project tracker with tasks',
];

export function ChatPanel({
  messages,
  isSending,
  sessionId,
  onSend,
  onTableAction,
  existingTables,
  onPrefill,
  onQueryResult,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const latestAssistantId = messages
    .filter((m) => m.role === 'assistant' && !m.isTyping)
    .slice(-1)[0]?.id;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getNextCardPosition = useCallback((): { x: number; y: number } => {
    if (existingTables.length === 0) return { x: 60, y: 60 };
    const cols = 3;
    const idx = existingTables.length;
    return { x: 60 + (idx % cols) * 360, y: 60 + Math.floor(idx / cols) * 320 };
  }, [existingTables]);

  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || !sessionId || isSending) return;
    if (!overrideText) {
      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }

    const response = await onSend(text);
    if (!response) return;

    if (response.action === 'prefill' && response.schema) {
      onPrefill(response.schema.tableName, response.schema.columns, response.values ?? {});
      return;
    }

    if (response.action === 'create' && response.schema?.tableName) {
      const pos = getNextCardPosition();
      onTableAction(response.schema.tableName, pos.x, pos.y);
    }

    if (response.action === 'create_many' && response.schemas) {
      const baseX = 60 + (existingTables.length % 3) * 380;
      const baseY = 60 + Math.floor(existingTables.length / 3) * 320;
      response.schemas.forEach((schema, i) => onTableAction(schema.tableName, baseX + i * 380, baseY));
    }

    if (response.action === 'alter' && response.schema?.tableName) {
      window.dispatchEvent(new CustomEvent('morph:refresh', { detail: { tableName: response.schema.tableName } }));
    }

    if (response.action === 'insert' && response.schema?.tableName) {
      window.dispatchEvent(new CustomEvent('morph:refresh', { detail: { tableName: response.schema.tableName } }));
    }

    if (response.action === 'query' && response.rows && response.chartType) {
      onQueryResult({ type: response.chartType, title: text, rows: response.rows, columns: response.columns ?? [], sql: response.sql });
      // Always show the raw table alongside any chart so data is never hidden
      if (response.chartType !== 'table') {
        onQueryResult({ type: 'table', title: text, rows: response.rows, columns: response.columns ?? [], sql: response.sql });
      }
    }
  }, [input, sessionId, isSending, onSend, onTableAction, getNextCardPosition, onPrefill, onQueryResult, existingTables]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  const panelHeight = isExpanded ? 400 : 240;
  const isEmpty = messages.length === 0 && !isSending;

  return (
    <div
      className="shrink-0 border-t border-[#1a1a24] flex flex-col"
      style={{
        height: panelHeight,
        background: 'linear-gradient(to top, #141420 0%, rgba(20,20,32,0.98) 70%, rgba(20,20,32,0.88) 100%)',
        backdropFilter: 'blur(16px)',
        transition: 'height 0.2s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#16162a]/60 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-md bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center">
              <Icons.Sparkle />
            </div>
            <span className="text-[11px] font-semibold text-zinc-400 tracking-tight">Morph AI</span>
          </div>
          {sessionId && (
            <span className="text-[9px] text-zinc-700 font-mono bg-[#1a1a2e] px-1.5 py-0.5 rounded">
              #{sessionId}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsExpanded((e) => !e)}
          className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-600 hover:text-zinc-400 hover:bg-white/5 transition-all duration-150"
          title={isExpanded ? 'Collapse chat' : 'Expand chat'}
        >
          <Icons.ChevronUp rotated={isExpanded} />
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-3">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-2">
            <p className="text-[11px] text-zinc-600 text-center leading-relaxed">
              Describe your business — Morph builds the modules.
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {EMPTY_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => { setInput(p); textareaRef.current?.focus(); }}
                  className="text-[10px] px-2.5 py-1 rounded-full border border-[#1e1e2e] text-zinc-600 hover:text-zinc-400 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all duration-150 cursor-pointer"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isLatestAssistant={msg.id === latestAssistantId}
              onSuggestionClick={async (text) => {
                if (isSending) return;
                const response = await onSend(text);
                if (!response) return;
                if (response.action === 'create' && response.schema?.tableName) {
                  const pos = getNextCardPosition();
                  onTableAction(response.schema.tableName, pos.x, pos.y);
                }
                if (response.action === 'create_many' && response.schemas) {
                  const baseX = 60 + (existingTables.length % 3) * 380;
                  const baseY = 60 + Math.floor(existingTables.length / 3) * 320;
                  response.schemas.forEach((schema, i) => onTableAction(schema.tableName, baseX + i * 380, baseY));
                }
              }}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-3 pb-3 pt-2 shrink-0">
        <div className="flex items-end gap-2 bg-[#13131c] border border-[#1e1e2e] rounded-xl px-3 py-2.5 focus-within:border-violet-500/40 focus-within:ring-1 focus-within:ring-violet-500/15 transition-all duration-200">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={sessionId ? 'Ask anything — build modules, query data, get insights…' : 'Select a project to start…'}
            disabled={!sessionId || isSending}
            rows={1}
            className="flex-1 bg-transparent text-[12px] text-zinc-200 placeholder-zinc-700 resize-none focus:outline-none leading-relaxed disabled:opacity-40"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || !sessionId || isSending}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-150 mb-0.5 shadow-[0_2px_6px_rgba(124,58,237,0.4)]"
          >
            {isSending ? (
              <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Icons.Send />
            )}
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-0.5">
          <p className="text-[9px] text-zinc-800">⏎ Send · ⇧⏎ Newline</p>
          <p className="text-[9px] text-zinc-800">Morph may make mistakes</p>
        </div>
      </div>
    </div>
  );
}
