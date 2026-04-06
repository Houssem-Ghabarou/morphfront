'use client';

import { useState } from 'react';

// ─── Variant detection ────────────────────────────────────────────────────────

type CellVariant = 'empty' | 'boolean' | 'date' | 'number' | 'tags' | 'long-text' | 'text';

function detectVariant(value: unknown, dataType: string): CellVariant {
  if (value === null || value === undefined || value === '') return 'empty';
  if (typeof value === 'boolean') return 'boolean';

  const type = dataType.toLowerCase();

  // Explicit date/timestamp column
  if (type === 'date' || type.includes('timestamp')) return 'date';

  // Numeric column
  if (typeof value === 'number') return 'number';
  if (type.includes('int') || type.includes('numeric') || type.includes('float') ||
      type.includes('decimal') || type.includes('real') || type.includes('double')) return 'number';

  const str = String(value).trim();

  // Looks like an ISO date string even if stored as text
  if (/^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]*)?$/.test(str) || /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(str)) return 'date';

  // Comma-separated list: ≥2 non-empty items, each reasonably short
  const parts = str.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2 && parts.every((p) => p.length < 60) && str.length >= 6) return 'tags';

  // Long text
  if (str.length > 72) return 'long-text';

  return 'text';
}

// ─── Tag color cycling ────────────────────────────────────────────────────────

const TAG_PALETTES = [
  'bg-violet-500/15 text-violet-300 border-violet-500/20',
  'bg-sky-500/15 text-sky-300 border-sky-500/20',
  'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  'bg-amber-500/15 text-amber-300 border-amber-500/20',
  'bg-rose-500/15 text-rose-300 border-rose-500/20',
  'bg-indigo-500/15 text-indigo-300 border-indigo-500/20',
  'bg-teal-500/15 text-teal-300 border-teal-500/20',
];

function tagColor(index: number) {
  return TAG_PALETTES[index % TAG_PALETTES.length];
}

// ─── Date formatter ───────────────────────────────────────────────────────────

function formatDate(value: string): string {
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return value;
  }
}

// ─── Expand overlay for long text ────────────────────────────────────────────

function LongTextExpand({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-lg w-full mx-4 rounded-xl bg-[#111118] border border-[#2a2a3a] shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <p className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap pr-4">{text}</p>
      </div>
    </div>
  );
}

// ─── Main CellRenderer ────────────────────────────────────────────────────────

interface CellRendererProps {
  value: unknown;
  dataType: string;
  /** compact=true for TableCard (smaller), false for DashboardTable (slightly larger) */
  compact?: boolean;
}

export function CellRenderer({ value, dataType, compact = true }: CellRendererProps) {
  const [expanded, setExpanded] = useState(false);
  const variant = detectVariant(value, dataType);

  if (variant === 'empty') {
    return <span className="text-zinc-700 italic">—</span>;
  }

  if (variant === 'boolean') {
    const bool = value === true || value === 'true';
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${
        bool
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          : 'bg-zinc-800 text-zinc-500 border-zinc-700'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${bool ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
        {bool ? 'true' : 'false'}
      </span>
    );
  }

  if (variant === 'date') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20 text-[9px] font-medium whitespace-nowrap">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        {formatDate(String(value))}
      </span>
    );
  }

  if (variant === 'number') {
    return (
      <span className="text-zinc-200 font-mono text-[11px] tabular-nums">
        {Number(value).toLocaleString()}
      </span>
    );
  }

  if (variant === 'tags') {
    const parts = String(value).split(',').map((p) => p.trim()).filter(Boolean);
    return (
      <div className="flex flex-wrap gap-0.5">
        {parts.map((tag, i) => (
          <span
            key={i}
            className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-medium border ${tagColor(i)}`}
          >
            {tag}
          </span>
        ))}
      </div>
    );
  }

  if (variant === 'long-text') {
    const str = String(value);
    const preview = str.slice(0, compact ? 48 : 60) + '…';
    return (
      <>
        <span className="text-zinc-300" style={{ fontSize: compact ? '11px' : '12px' }}>
          {preview}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
          className="ml-1 inline-flex items-center px-1 py-0.5 rounded text-[9px] text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors border border-zinc-700 hover:border-violet-500/30"
          title="View full text"
        >
          expand
        </button>
        {expanded && <LongTextExpand text={str} onClose={() => setExpanded(false)} />}
      </>
    );
  }

  // plain text
  return <span className="text-zinc-300" style={{ fontSize: compact ? '11px' : '12px' }}>{String(value)}</span>;
}
