'use client';

import { useState, useEffect } from 'react';
import type { AnalysisCard } from '@/types';

interface AnalyticsPanelProps {
  cards: AnalysisCard[];
  onPinToCanvas: (card: AnalysisCard) => void;
  onClose: () => void;
}

/* ── tiny inline icons ─────────────────────────────────────────────── */

function IconPin() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 17v5M9 11V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v7" />
      <path d="M5 11h14l-1.5 6h-11z" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconStat() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconBar() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="12" width="4" height="9" rx="1" />
      <rect x="10" y="6" width="4" height="15" rx="1" />
      <rect x="17" y="3" width="4" height="18" rx="1" />
    </svg>
  );
}

function IconTable() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18" />
    </svg>
  );
}

/* ── stat tile ─────────────────────────────────────────────────────── */

function StatTile({
  card,
  onPin,
  onDismiss,
}: {
  card: AnalysisCard;
  onPin: () => void;
  onDismiss: () => void;
}) {
  const firstRow = card.rows[0] ?? {};
  const vals = Object.entries(firstRow);
  const mainVal = vals[0]?.[1];
  const secondaryVal = vals.length > 1 ? vals[1] : null;

  function fmt(v: unknown): string {
    if (v === null || v === undefined) return '—';
    const n = Number(v);
    if (!isNaN(n) && String(v).includes('.')) return n.toFixed(1);
    return String(v);
  }

  return (
    <div className="group relative bg-[#13131f] border border-[#1e1e30] rounded-xl p-3.5 flex flex-col gap-1.5 min-w-0 hover:border-violet-500/25 transition-colors">
      <div className="flex items-start justify-between gap-1">
        <span className="text-[10px] text-zinc-500 font-medium leading-tight line-clamp-2">
          {card.title}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={onPin} title="Pin to canvas" className="p-1 rounded-md text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors">
            <IconPin />
          </button>
          <button onClick={onDismiss} title="Dismiss" className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <IconX />
          </button>
        </div>
      </div>
      <span className="text-2xl font-bold text-white leading-none tracking-tight">
        {fmt(mainVal)}
      </span>
      {secondaryVal && (
        <span className="text-[10px] text-zinc-600">
          {secondaryVal[0].replace(/_/g, ' ')}: {fmt(secondaryVal[1])}
        </span>
      )}
    </div>
  );
}

/* ── bar chart inline ──────────────────────────────────────────────── */

function BarChartInline({
  card,
  onPin,
  onDismiss,
}: {
  card: AnalysisCard;
  onPin: () => void;
  onDismiss: () => void;
}) {
  const firstRow = card.rows[0] ?? {};
  const labelCol = card.columns.find((c) => typeof firstRow[c] !== 'number' && isNaN(Number(firstRow[c]))) ?? card.columns[0] ?? '';
  const valueCol = card.columns.find((c) => !isNaN(Number(firstRow[c])) && c !== labelCol) ?? card.columns[1] ?? '';
  const displayRows = card.rows.slice(0, 8);
  const maxVal = Math.max(...displayRows.map((r) => Number(r[valueCol]) || 0), 1);

  return (
    <div className="group bg-[#13131f] border border-[#1e1e30] rounded-xl overflow-hidden hover:border-violet-500/25 transition-colors">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#1e1e30]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-violet-400 shrink-0"><IconBar /></span>
          <span className="text-[11px] text-zinc-300 font-medium truncate">{card.title}</span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={onPin} title="Pin to canvas" className="p-1 rounded-md text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors">
            <IconPin />
          </button>
          <button onClick={onDismiss} title="Dismiss" className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <IconX />
          </button>
        </div>
      </div>
      <div className="px-3.5 py-3 flex flex-col gap-2">
        {displayRows.map((row, i) => {
          const label = String(row[labelCol] ?? '');
          const val = Number(row[valueCol]) || 0;
          const pct = (val / maxVal) * 100;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 w-20 truncate text-right shrink-0">{label}</span>
              <div className="flex-1 h-4 bg-[#0d0d18] rounded overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-600 to-violet-500 rounded transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] text-zinc-400 font-mono w-12 text-right shrink-0">{val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── table inline ──────────────────────────────────────────────────── */

function TableInline({
  card,
  onPin,
  onDismiss,
}: {
  card: AnalysisCard;
  onPin: () => void;
  onDismiss: () => void;
}) {
  const displayRows = card.rows.slice(0, 10);

  function fmtCell(v: unknown): string {
    if (v === null || v === undefined) return '—';
    const n = Number(v);
    if (!isNaN(n) && String(v).includes('.')) return n.toFixed(1);
    return String(v);
  }

  return (
    <div className="group bg-[#13131f] border border-[#1e1e30] rounded-xl overflow-hidden hover:border-violet-500/25 transition-colors">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#1e1e30]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-cyan-400 shrink-0"><IconTable /></span>
          <span className="text-[11px] text-zinc-300 font-medium truncate">{card.title}</span>
          <span className="text-[9px] text-zinc-600 shrink-0">{card.rows.length} row{card.rows.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={onPin} title="Pin to canvas" className="p-1 rounded-md text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors">
            <IconPin />
          </button>
          <button onClick={onDismiss} title="Dismiss" className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <IconX />
          </button>
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="bg-[#0d0d18]">
              {card.columns.map((col) => (
                <th key={col} className="text-left px-3 py-1.5 text-[9px] font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap border-b border-[#1a1a2a]">
                  {col.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i} className="border-b border-[#141428] hover:bg-white/[0.015] transition-colors">
                {card.columns.map((col) => (
                  <td key={col} className="px-3 py-1.5 text-zinc-300 font-mono whitespace-nowrap">
                    {fmtCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── main panel ────────────────────────────────────────────────────── */

export function AnalyticsPanel({ cards: initialCards, onPinToCanvas, onClose }: AnalyticsPanelProps) {
  const [cards, setCards] = useState(initialCards);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);

  const dismiss = (idx: number) => {
    setCards((prev) => prev.filter((_, i) => i !== idx));
  };

  const stats = cards.map((c, i) => ({ card: c, idx: i })).filter(({ card }) => card.chartType === 'stat');
  const bars = cards.map((c, i) => ({ card: c, idx: i })).filter(({ card }) => card.chartType === 'bar');
  const tables = cards.map((c, i) => ({ card: c, idx: i })).filter(({ card }) => card.chartType === 'table');

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };

  return (
    <div
      className="absolute top-0 right-0 bottom-0 z-40 flex flex-col border-l border-[#1a1a28] shadow-2xl transition-transform duration-200 ease-out"
      style={{
        width: 400,
        background: 'linear-gradient(to bottom, #0e0e18 0%, #0b0b14 100%)',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
      }}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#1a1a28]">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center shadow-[0_0_8px_rgba(124,58,237,0.3)]">
            <IconStat />
          </div>
          <div>
            <span className="text-[12px] font-semibold text-zinc-200">Analytics</span>
            <span className="text-[10px] text-zinc-600 ml-2">{cards.length} insight{cards.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
        >
          <IconX />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-5">
        {cards.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <p className="text-[11px] text-zinc-600">All insights dismissed.</p>
            <button onClick={handleClose} className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors">
              Close panel
            </button>
          </div>
        )}

        {/* Stats section */}
        {stats.length > 0 && (
          <section>
            <h3 className="text-[9px] font-semibold text-zinc-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <IconStat /> Key Metrics
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {stats.map(({ card, idx }) => (
                <StatTile
                  key={idx}
                  card={card}
                  onPin={() => onPinToCanvas(card)}
                  onDismiss={() => dismiss(idx)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Bar charts section */}
        {bars.length > 0 && (
          <section>
            <h3 className="text-[9px] font-semibold text-zinc-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <IconBar /> Charts
            </h3>
            <div className="space-y-2.5">
              {bars.map(({ card, idx }) => (
                <BarChartInline
                  key={idx}
                  card={card}
                  onPin={() => onPinToCanvas(card)}
                  onDismiss={() => dismiss(idx)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Tables section */}
        {tables.length > 0 && (
          <section>
            <h3 className="text-[9px] font-semibold text-zinc-600 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <IconTable /> Data Tables
            </h3>
            <div className="space-y-2.5">
              {tables.map(({ card, idx }) => (
                <TableInline
                  key={idx}
                  card={card}
                  onPin={() => onPinToCanvas(card)}
                  onDismiss={() => dismiss(idx)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
