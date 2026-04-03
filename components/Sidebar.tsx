'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Session } from '@/types';

interface SidebarProps {
  sessions: Session[];
  currentSessionId: number | null;
  onNewSession: () => Promise<number>;
  onRenameSession: (id: number, name: string) => Promise<void>;
  onSelectSession: (id: number) => Promise<void>;
  onDeleteSession: (id: number) => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PINS_KEY = 'morph_pinned_projects';

function loadPinnedIds(): Set<number> {
  try {
    const raw = localStorage.getItem(PINS_KEY);
    return raw ? new Set(JSON.parse(raw) as number[]) : new Set();
  } catch {
    return new Set();
  }
}

function savePinnedIds(ids: Set<number>) {
  try {
    localStorage.setItem(PINS_KEY, JSON.stringify([...ids]));
  } catch { /* ignore quota errors */ }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const Icons = {
  Logo: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  ),
  Project: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  Plus: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  ),
  ChevronRight: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  ),
  Trash: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  ),
  Close: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
  Pin: ({ filled }: { filled?: boolean }) => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z" />
    </svg>
  ),
};

// ─── New Project modal ────────────────────────────────────────────────────────

function NewProjectModal({
  onConfirm,
  onCancel,
  isCreating,
}: {
  onConfirm: (name: string) => void;
  onCancel: () => void;
  isCreating: boolean;
}) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="w-[360px] rounded-2xl border border-[#1e1e2e] shadow-2xl animate-fade-in overflow-hidden"
        style={{ background: '#13131c' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e2e]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Icons.Project />
            </div>
            <div>
              <h2 className="text-[13px] font-semibold text-zinc-100">New Project</h2>
              <p className="text-[10px] text-zinc-600 mt-0.5">Give your workspace a name</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-all duration-150 cursor-pointer"
          >
            <Icons.Close />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4">
          <label className="block text-[11px] font-medium text-zinc-500 mb-2">Project name</label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Gym Management, CRM, Inventory…"
            maxLength={60}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d0d12] border border-[#1e1e2e] text-zinc-100 text-[13px] placeholder-zinc-700 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all duration-150"
          />
          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-2 rounded-lg text-[12px] text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all duration-150 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isCreating}
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[12px] font-medium transition-all duration-150 flex items-center gap-1.5 cursor-pointer"
            >
              {isCreating && <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />}
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ─── Session row ──────────────────────────────────────────────────────────────

function SessionRow({
  session,
  isActive,
  isPinned,
  isDeleting,
  onSelect,
  onDelete,
  onTogglePin,
}: {
  session: Session;
  isActive: boolean;
  isPinned: boolean;
  isDeleting: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onTogglePin: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const showActions = hovered || isActive;

  return (
    <div
      className={`sidebar-item w-full flex items-stretch gap-0.5 rounded-lg group pl-1 ${
        isActive ? 'sidebar-item-active !bg-violet-600/10' : ''
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left cursor-pointer"
      >
        <span className={`shrink-0 transition-colors duration-150 ${
          isPinned
            ? 'text-amber-400/70'
            : isActive
            ? 'text-violet-400'
            : 'text-zinc-600 group-hover:text-zinc-500'
        }`}>
          {isPinned ? <Icons.Pin filled /> : <Icons.Project />}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-medium truncate leading-tight transition-colors duration-150 ${
            isActive ? 'text-zinc-100' : 'text-zinc-400 group-hover:text-zinc-200'
          }`}>
            {session.name || 'Untitled'}
          </p>
          <p className="text-[9px] text-zinc-700 mt-0.5">{timeAgo(session.updated_at)}</p>
        </div>
      </button>

      {showActions && (
        <div className="flex items-center gap-0.5 mr-1 my-auto">
          {/* Pin / Unpin */}
          <button
            type="button"
            onClick={onTogglePin}
            title={isPinned ? 'Unpin project' : 'Pin project'}
            className={`w-6 h-6 flex items-center justify-center rounded-md transition-all duration-150 cursor-pointer ${
              isPinned
                ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                : 'text-zinc-600 hover:text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <Icons.Pin filled={isPinned} />
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-700 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 cursor-pointer"
            aria-label="Delete project"
          >
            {isDeleting ? (
              <div className="w-3 h-3 border border-zinc-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icons.Trash />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({
  sessions,
  currentSessionId,
  onNewSession,
  onRenameSession,
  onSelectSession,
  onDeleteSession,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    setPinnedIds(loadPinnedIds());
  }, []);

  const togglePin = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      savePinnedIds(next);
      return next;
    });
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setDeletingId(id);
    // Remove pin if it exists
    setPinnedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      savePinnedIds(next);
      return next;
    });
    try {
      await onDeleteSession(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateProject = async (name: string) => {
    setIsCreating(true);
    try {
      const id = await onNewSession();
      await onRenameSession(id, name);
      setShowNewModal(false);
    } finally {
      setIsCreating(false);
    }
  };

  // Sort: pinned first (preserving their original relative order), then rest by updated_at desc
  const sorted = [
    ...sessions.filter((s) => pinnedIds.has(s.id)),
    ...sessions.filter((s) => !pinnedIds.has(s.id)),
  ];

  const pinnedCount = sessions.filter((s) => pinnedIds.has(s.id)).length;
  const unpinnedCount = sorted.length - pinnedCount;

  // ── Collapsed view ──────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <>
        <div className="flex flex-col items-center py-3 w-12 shrink-0 border-r border-[#1a1a24] bg-[#0a0a0f] gap-2">
          <button
            onClick={() => setCollapsed(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all duration-150 cursor-pointer"
            title="Expand sidebar"
          >
            <Icons.ChevronRight />
          </button>
          <div className="w-px h-3 bg-[#1e1e2e]" />
          <button
            onClick={() => setShowNewModal(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 transition-all duration-150 cursor-pointer"
            title="New project"
          >
            <Icons.Plus />
          </button>
          {sorted.slice(0, 8).map((s) => {
            const isPinned = pinnedIds.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => onSelectSession(s.id)}
                title={s.name || 'Untitled'}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150 cursor-pointer ${
                  s.id === currentSessionId
                    ? 'bg-violet-600/20 text-violet-400'
                    : isPinned
                    ? 'text-amber-400/60 hover:text-amber-300 hover:bg-amber-500/10'
                    : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/5'
                }`}
              >
                {isPinned ? <Icons.Pin filled /> : <Icons.Project />}
              </button>
            );
          })}
        </div>
        {showNewModal && (
          <NewProjectModal
            onConfirm={handleCreateProject}
            onCancel={() => setShowNewModal(false)}
            isCreating={isCreating}
          />
        )}
      </>
    );
  }

  // ── Expanded view ───────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex flex-col w-[260px] shrink-0 border-r border-[#1a1a24] bg-[#0a0a0f] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#1a1a24]">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-violet-600 flex items-center justify-center text-white shadow-[0_0_10px_rgba(124,58,237,0.4)]">
              <Icons.Logo />
            </div>
            <div>
              <span className="font-semibold text-[13px] text-zinc-100 tracking-tight leading-none">Morph</span>
              <p className="text-[9px] text-zinc-600 leading-none mt-0.5">Business OS</p>
            </div>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-600 hover:text-zinc-400 hover:bg-white/5 transition-all duration-150 cursor-pointer"
            title="Collapse sidebar"
          >
            <Icons.ChevronLeft />
          </button>
        </div>

        {/* New Project button */}
        <div className="px-3 pt-3 pb-2">
          <button
            onClick={() => setShowNewModal(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-dashed border-violet-600/25 text-zinc-500 hover:text-violet-300 hover:border-violet-500/50 hover:bg-violet-500/6 text-xs font-medium transition-all duration-150 group cursor-pointer"
          >
            <span className="w-5 h-5 flex items-center justify-center rounded border border-violet-500/30 group-hover:border-violet-400/60 text-violet-500 group-hover:text-violet-400 transition-all duration-150">
              <Icons.Plus />
            </span>
            <span>New Project</span>
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-3">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-700 gap-3">
              <div className="w-10 h-10 rounded-xl border border-[#1e1e2e] flex items-center justify-center opacity-50">
                <Icons.Project />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-zinc-600">No projects yet</p>
                <p className="text-[10px] text-zinc-700 mt-0.5">Create your first project above</p>
              </div>
            </div>
          ) : (
            <ul className="space-y-px mt-1">
              {/* Pinned section label */}
              {pinnedCount > 0 && (
                <li className="px-3 pt-2 pb-1">
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-amber-400/50 flex items-center gap-1.5">
                    <Icons.Pin filled />
                    Pinned
                  </span>
                </li>
              )}

              {sorted.map((session, idx) => {
                const isPinned = pinnedIds.has(session.id);
                // Section divider between pinned and unpinned
                const showDivider = pinnedCount > 0 && unpinnedCount > 0 && idx === pinnedCount;

                return (
                  <li key={session.id}>
                    {showDivider && (
                      <div className="px-3 pt-3 pb-1">
                        <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-700">
                          Projects
                        </span>
                      </div>
                    )}
                    <SessionRow
                      session={session}
                      isActive={session.id === currentSessionId}
                      isPinned={isPinned}
                      isDeleting={deletingId === session.id}
                      onSelect={() => onSelectSession(session.id)}
                      onDelete={(e) => handleDelete(e, session.id)}
                      onTogglePin={(e) => togglePin(e, session.id)}
                    />
                  </li>
                );
              })}

              {/* No-pinned fallback section label */}
              {pinnedCount === 0 && sessions.length > 0 && (
                <li className="px-3 pt-2 pb-1">
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-700">Projects</span>
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#1a1a24] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
            <p className="text-[9px] text-zinc-700">Connected</p>
          </div>
          <p className="text-[9px] text-zinc-800 font-mono">v0.1</p>
        </div>
      </div>

      {showNewModal && (
        <NewProjectModal
          onConfirm={handleCreateProject}
          onCancel={() => setShowNewModal(false)}
          isCreating={isCreating}
        />
      )}
    </>
  );
}
