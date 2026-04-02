'use client';

import { useEffect, useState, use } from 'react';
import { api } from '@/lib/api';
import { DashboardTable } from '@/components/DashboardTable';
import type { SessionDetail, Relation } from '@/types';

interface VisualCardData {
  id: string;
  type: 'bar' | 'stat' | 'table';
  title: string;
  rows: Record<string, unknown>[];
  columns: string[];
}

function DashboardStatCard({ title, rows, columns }: { title: string; rows: Record<string, unknown>[]; columns: string[] }) {
  const firstRow = rows[0] ?? {};
  const valueCol = columns[0] ?? '';
  const value = firstRow[valueCol];
  const label = valueCol.replace(/_/g, ' ');

  return (
    <div className="rounded-xl border border-[#26263a] bg-[#1a1a28] shadow-lg overflow-hidden animate-fade-in border-t-2 border-t-violet-500">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e1e2e]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" className="shrink-0">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        <span className="text-xs text-zinc-400 truncate flex-1 font-medium">{title}</span>
      </div>
      <div className="px-5 py-5 flex flex-col gap-1">
        <span className="text-4xl font-bold text-white leading-none">
          {value === null || value === undefined ? '—' : String(value)}
        </span>
        <span className="text-xs text-zinc-500 uppercase tracking-wider capitalize mt-1">
          {label}
        </span>
      </div>
    </div>
  );
}

function DashboardBarChart({ title, rows, columns }: { title: string; rows: Record<string, unknown>[]; columns: string[] }) {
  const firstRow = rows[0] ?? {};
  let labelCol = columns[0] ?? '';
  let valueCol = columns[1] ?? '';

  if (columns.length >= 2) {
    const detectedLabel = columns.find((col) => typeof firstRow[col] !== 'number');
    const detectedValue = columns.find((col) => typeof firstRow[col] === 'number');
    if (detectedLabel) labelCol = detectedLabel;
    if (detectedValue) valueCol = detectedValue;
  }

  const displayRows = rows.slice(0, 10);
  const maxValue = Math.max(...displayRows.map((r) => Number(r[valueCol]) || 0), 1);

  return (
    <div className="rounded-xl border border-[#26263a] bg-[#1a1a28] shadow-lg overflow-hidden animate-fade-in">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e1e2e]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" className="shrink-0">
          <rect x="3" y="12" width="4" height="9" rx="1" />
          <rect x="10" y="6" width="4" height="15" rx="1" />
          <rect x="17" y="3" width="4" height="18" rx="1" />
        </svg>
        <span className="text-xs text-zinc-400 truncate flex-1 font-medium">{title}</span>
      </div>
      <div className="flex items-end gap-3 px-4 py-5" style={{ height: 200 }}>
        {displayRows.map((row, i) => {
          const val = Number(row[valueCol]) || 0;
          const heightPct = maxValue > 0 ? (val / maxValue) * 100 : 0;
          const heightPx = Math.max(4, (heightPct / 100) * 140);
          const labelVal = String(row[labelCol] ?? '');
          return (
            <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0" style={{ height: '100%', justifyContent: 'flex-end' }}>
              <span className="text-[10px] text-zinc-400 leading-none">{val}</span>
              <div className="bg-violet-500 rounded-t w-full min-w-[12px]" style={{ height: heightPx }} />
              <span className="text-[10px] text-zinc-500 truncate max-w-[80px] text-center w-full">{labelVal}</span>
            </div>
          );
        })}
        {displayRows.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-xs text-zinc-600">No data</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardQueryTable({ title, rows, columns }: { title: string; rows: Record<string, unknown>[]; columns: string[] }) {
  return (
    <div className="rounded-xl border border-[#26263a] bg-[#1a1a28] shadow-lg overflow-hidden animate-fade-in border-t-2" style={{ borderTopColor: '#06b6d4' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e1e2e]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" className="shrink-0">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M3 15h18M9 3v18" />
        </svg>
        <span className="text-xs text-zinc-400 truncate flex-1 font-medium">{title}</span>
        <span className="text-[10px] text-cyan-500/60 shrink-0">{rows.length} row{rows.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="overflow-auto scrollbar-thin" style={{ maxHeight: 320 }}>
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-zinc-600">No results.</div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#0f0f15]">
                {columns.map((col) => (
                  <th key={col} className="text-left px-3 py-2 text-[10px] font-semibold text-cyan-500/70 uppercase tracking-wider border-b border-[#1e1e2e] whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-[#1a1a2a] hover:bg-white/[0.02] transition-colors">
                  {columns.map((col) => (
                    <td key={col} className="px-3 py-2 text-zinc-300 font-mono whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">
                      {row[col] === null || row[col] === undefined ? <span className="text-zinc-700 italic">null</span> : String(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function DashboardView({ params }: { params: Promise<{ sessionId: string }> }) {
  const resolvedParams = use(params);
  const sessionId = Number(resolvedParams.sessionId);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [visualCards] = useState<VisualCardData[]>([]);

  useEffect(() => {
    if (!sessionId || isNaN(sessionId)) {
      setError('Invalid session ID');
      return;
    }

    (async () => {
      try {
        const detail = await api.getSession(sessionId);
        setSession(detail);
        setRelations(detail.relations ?? []);
      } catch (err) {
        console.error(err);
        setError('Failed to load session. Make sure the backend is running.');
      }
    })();
  }, [sessionId]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0d0d12] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <p className="text-sm text-zinc-400">{error}</p>
          <a href="/" className="inline-block mt-4 text-xs text-violet-400 hover:text-violet-300 transition-colors">
            Back to Morph
          </a>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0d0d12] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-xs text-zinc-600">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  const tableNames = session.sessionTables.map((t) => t.table_name);
  const stats = visualCards.filter((c) => c.type === 'stat');
  const charts = visualCards.filter((c) => c.type === 'bar');
  const queryTables = visualCards.filter((c) => c.type === 'table');

  return (
    <div className="min-h-screen bg-[#0d0d12]">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-[#1a1a24] bg-[#0a0a0f]/95 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white shadow-[0_0_12px_rgba(124,58,237,0.4)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-zinc-100">{session.name || 'Untitled Project'}</h1>
              <p className="text-[10px] text-zinc-600">Dashboard View</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] text-zinc-600 font-mono">
              {tableNames.length} module{tableNames.length !== 1 ? 's' : ''}
            </span>
            <a
              href="/"
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-violet-300 border border-[#2a2a2a] hover:border-violet-500/30 hover:bg-violet-600/10 transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Open in Editor
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {/* KPI Stats row */}
        {stats.length > 0 && (
          <section className="mb-8">
            <div className={`grid gap-4 ${stats.length === 1 ? 'grid-cols-1 max-w-xs' : stats.length === 2 ? 'grid-cols-2 max-w-xl' : stats.length === 3 ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
              {stats.map((card) => (
                <DashboardStatCard key={card.id} title={card.title} rows={card.rows} columns={card.columns} />
              ))}
            </div>
          </section>
        )}

        {/* Charts row */}
        {charts.length > 0 && (
          <section className="mb-8">
            <div className={`grid gap-4 ${charts.length === 1 ? 'grid-cols-1 max-w-lg' : 'grid-cols-1 md:grid-cols-2'}`}>
              {charts.map((card) => (
                <DashboardBarChart key={card.id} title={card.title} rows={card.rows} columns={card.columns} />
              ))}
            </div>
          </section>
        )}

        {/* Query result tables */}
        {queryTables.length > 0 && (
          <section className="mb-8">
            <div className="grid gap-4 grid-cols-1">
              {queryTables.map((card) => (
                <DashboardQueryTable key={card.id} title={card.title} rows={card.rows} columns={card.columns} />
              ))}
            </div>
          </section>
        )}

        {/* Module tables */}
        {tableNames.length > 0 && (
          <section>
            {(stats.length > 0 || charts.length > 0 || queryTables.length > 0) && (
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px flex-1 bg-[#1e1e2e]" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-700">Modules</span>
                <div className="h-px flex-1 bg-[#1e1e2e]" />
              </div>
            )}
            <div className={`grid gap-5 ${tableNames.length === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
              {tableNames.map((name) => (
                <DashboardTable key={name} tableName={name} sessionId={sessionId} relations={relations} />
              ))}
            </div>
          </section>
        )}

        {tableNames.length === 0 && stats.length === 0 && charts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#1a1a28] border border-[#26263a] flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3f3f56" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <p className="text-sm text-zinc-500">No modules configured yet</p>
            <p className="text-xs text-zinc-700 mt-1">Go to the editor to create tables and KPIs with AI</p>
            <a href="/" className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-violet-400 bg-violet-600/10 border border-violet-500/20 hover:bg-violet-600/20 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Open Editor
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
