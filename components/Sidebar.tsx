'use client';

import { useState } from 'react';
import type { Session } from '@/types';

interface SidebarProps {
  sessions: Session[];
  currentSessionId: number | null;
  onNewSession: () => Promise<number>;
  onSelectSession: (id: number) => Promise<void>;
  onDeleteSession: (id: number) => Promise<void>;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function Sidebar({
  sessions,
  currentSessionId,
  onNewSession,
  onSelectSession,
  onDeleteSession,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await onDeleteSession(id);
    } finally {
      setDeletingId(null);
    }
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-4 w-14 border-r border-[#1a1a1a] bg-[#0d0d0d] gap-3">
        <button
          onClick={() => setCollapsed(false)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors"
          title="Expand sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
          </svg>
        </button>
        <button
          onClick={onNewSession}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
          title="New chat"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-[280px] shrink-0 border-r border-[#1a1a1a] bg-[#0d0d0d] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-4 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-violet-600 flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-semibold text-sm text-zinc-100 tracking-tight">Morph</span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      <div className="px-3 pt-3 pb-2">
        <button
          onClick={onNewSession}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600/10 hover:bg-violet-600/20 border border-violet-600/20 hover:border-violet-600/40 text-violet-400 hover:text-violet-300 text-sm font-medium transition-all duration-150"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-3">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-600 text-xs">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 opacity-40">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>No sessions yet</span>
          </div>
        ) : (
          <ul className="space-y-0.5 mt-1">
            {sessions.map((session) => {
              const isActive = session.id === currentSessionId;
              const isHovered = hoveredId === session.id;

              return (
                <li key={session.id}>
                  <div
                    className={`w-full flex items-stretch gap-0.5 rounded-lg transition-all duration-100 group ${
                      isActive
                        ? 'bg-white/8 text-zinc-100'
                        : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                    }`}
                    onMouseEnter={() => setHoveredId(session.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectSession(session.id)}
                      className="min-w-0 flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg text-left"
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`shrink-0 ${isActive ? 'text-violet-400' : 'text-zinc-600'}`}
                      >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate leading-tight">
                          {session.name || 'Untitled'}
                        </p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">
                          {timeAgo(session.updated_at)}
                        </p>
                      </div>
                    </button>

                    {(isHovered || isActive) && (
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, session.id)}
                        disabled={deletingId === session.id}
                        className="shrink-0 w-8 h-8 mr-1 flex items-center justify-center rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        aria-label="Delete session"
                      >
                        {deletingId === session.id ? (
                          <div className="w-3 h-3 border border-zinc-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="px-4 py-3 border-t border-[#1a1a1a]">
        <p className="text-[10px] text-zinc-700 text-center">
          Morph · LLM Business OS
        </p>
      </div>
    </div>
  );
}
