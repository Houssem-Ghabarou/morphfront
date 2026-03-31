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

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
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
    }, 18);
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
          className="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 font-mono text-[11px] border border-violet-500/20"
        >
          {inner}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function MessageBubble({
  message,
  isLatestAssistant,
}: {
  message: LocalMessage;
  isLatestAssistant: boolean;
}) {
  const isUser = message.role === 'user';

  if (message.isTyping) {
    return (
      <div className="flex items-end gap-2 justify-start animate-fade-in">
        <div className="w-6 h-6 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center shrink-0">
          <div className="w-2 h-2 rounded-full bg-violet-500" />
        </div>
        <div className="bg-[#161616] border border-[#222] rounded-2xl rounded-bl-sm max-w-[80%]">
          <TypingIndicator />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-end gap-2 animate-fade-in ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center shrink-0 mb-0.5">
          <div className="w-2 h-2 rounded-full bg-violet-500" />
        </div>
      )}

      <div className={`flex flex-col gap-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
            isUser
              ? 'bg-violet-600 text-white rounded-br-sm'
              : 'bg-[#161616] border border-[#222] text-zinc-300 rounded-bl-sm'
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

        {message.warning && (
          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg bg-amber-500/8 border border-amber-500/15 text-[10px] text-amber-400/80 max-w-full">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span className="leading-tight">{message.warning}</span>
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-6 h-6 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0 mb-0.5">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      )}
    </div>
  );
}

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
    if (existingTables.length === 0) {
      return { x: 60, y: 60 };
    }
    const cols = 3;
    const idx = existingTables.length;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    return {
      x: 60 + col * 360,
      y: 60 + row * 320,
    };
  }, [existingTables]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !sessionId || isSending) return;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const response = await onSend(text);

    if (!response) return;

    if (response.action === 'prefill' && response.schema) {
      onPrefill(response.schema.tableName, response.schema.columns, response.values ?? {});
      return;
    }

    if (response.action === 'create' || response.action === 'alter') {
      const tableName = response.schema?.tableName;
      if (tableName) {
        const pos = getNextCardPosition();
        onTableAction(tableName, pos.x, pos.y);
      }
    }

    if (response.action === 'insert') {
      const tableName = response.schema?.tableName;
      if (tableName) {
        window.dispatchEvent(new CustomEvent('morph:refresh', { detail: { tableName } }));
      }
    }

    if (response.action === 'query' && response.rows && response.chartType) {
      onQueryResult({
        type: response.chartType,
        title: text,
        rows: response.rows,
        columns: response.columns ?? [],
        sql: response.sql,
      });
    }
  }, [input, sessionId, isSending, onSend, onTableAction, getNextCardPosition, onPrefill, onQueryResult]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  const panelHeight = isExpanded ? 380 : 220;

  return (
    <div
      className="shrink-0 border-t border-[#1a1a1a] flex flex-col"
      style={{
        height: panelHeight,
        background:
          'linear-gradient(to top, #0a0a0a 0%, rgba(10,10,10,0.97) 60%, rgba(10,10,10,0.9) 100%)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#151515] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
          <span className="text-[11px] text-zinc-500 font-medium">Chat</span>
          {sessionId && (
            <span className="text-[10px] text-zinc-700 font-mono">
              session #{sessionId}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsExpanded((e) => !e)}
          className="w-6 h-6 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-400 hover:bg-white/5 transition-colors"
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          >
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-3">
        {messages.length === 0 && !isSending && (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-zinc-700 text-center">
              Ask anything — create tables, insert data, query your schema.
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isLatestAssistant={msg.id === latestAssistantId}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-3 pb-3 pt-2 shrink-0">
        <div className="flex items-end gap-2 bg-[#111] border border-[#222] rounded-xl px-3 py-2 focus-within:border-violet-500/40 focus-within:ring-1 focus-within:ring-violet-500/20 transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={
              sessionId
                ? 'Type a prompt… (Enter to send, Shift+Enter for newline)'
                : 'Select or create a session first…'
            }
            disabled={!sessionId || isSending}
            rows={1}
            className="flex-1 bg-transparent text-xs text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none leading-relaxed disabled:opacity-40"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !sessionId || isSending}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 mb-0.5"
          >
            {isSending ? (
              <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22l-4-9-9-4 20-7z" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-[9px] text-zinc-800 text-center mt-1.5">
          Morph can make mistakes. Verify critical SQL before executing.
        </p>
      </div>
    </div>
  );
}
