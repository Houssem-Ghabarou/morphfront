'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { api } from '@/lib/api';
import { DashboardTable } from '@/components/DashboardTable';
import type { SessionDetail, Relation, DataRow } from '@/types';

function toModuleLabel(raw: string): string {
  return raw.replace(/^s\d+_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function ModuleIcon({ name, size = 14 }: { name: string; size?: number }) {
  const n = name.toLowerCase();
  if (n.includes('client') || n.includes('customer') || n.includes('user') || n.includes('member') || n.includes('student') || n.includes('employee'))
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
  if (n.includes('meal') || n.includes('food') || n.includes('nutrition') || n.includes('calori') || n.includes('diet'))
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>;
  if (n.includes('order') || n.includes('sale') || n.includes('invoice') || n.includes('payment'))
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>;
  if (n.includes('product') || n.includes('inventory') || n.includes('stock') || n.includes('item'))
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>;
  if (n.includes('task') || n.includes('todo') || n.includes('project') || n.includes('program') || n.includes('course') || n.includes('assignment'))
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>;
}

interface ModuleStats {
  tableName: string;
  label: string;
  count: number;
  latestRow: DataRow | null;
}

function OverviewPage({ tableNames, stats, onSelectModule }: { tableNames: string[]; stats: ModuleStats[]; onSelectModule: (name: string) => void }) {
  const total = stats.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="shrink-0 px-6 pt-6 pb-2">
        <h2 className="text-lg font-semibold text-zinc-100">Overview</h2>
        <p className="text-xs text-zinc-600 mt-0.5">{tableNames.length} modules · {total} total records</p>
      </div>

      {/* Stats cards */}
      <div className="px-6 py-4">
        <div className={`grid gap-3 ${stats.length <= 2 ? 'grid-cols-2' : stats.length === 3 ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
          {stats.map((s) => (
            <button key={s.tableName} onClick={() => onSelectModule(s.tableName)}
              className="group text-left p-4 rounded-xl border border-[#26263a] bg-[#14141e] hover:border-violet-500/30 hover:bg-[#18182a] transition-all cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-violet-600/15 border border-violet-500/20 flex items-center justify-center text-violet-400 group-hover:bg-violet-600/25 transition-colors">
                  <ModuleIcon name={s.tableName.replace(/^s\d+_/, '')} />
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-700 group-hover:text-violet-400 transition-colors">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </div>
              <p className="text-2xl font-bold text-zinc-100">{s.count}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">{s.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Recent activity / module list */}
      <div className="flex-1 px-6 pb-6 overflow-auto">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Modules</h3>
        <div className="space-y-1.5">
          {stats.map((s) => (
            <button key={s.tableName} onClick={() => onSelectModule(s.tableName)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[#1e1e30] bg-[#12121c] hover:border-violet-500/25 hover:bg-[#16162a] transition-all group cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-violet-600/10 border border-violet-500/15 flex items-center justify-center text-violet-400 shrink-0 group-hover:bg-violet-600/20 transition-colors">
                <ModuleIcon name={s.tableName.replace(/^s\d+_/, '')} size={13} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[12px] font-medium text-zinc-200 group-hover:text-white transition-colors">{s.label}</p>
                <p className="text-[10px] text-zinc-600">{s.count} record{s.count !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                {s.latestRow && (
                  <span className="text-[10px] text-zinc-700 max-w-[140px] truncate">
                    Latest: {Object.values(s.latestRow).find((v) => typeof v === 'string' && v.length > 0) as string || '—'}
                  </span>
                )}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-700 group-hover:text-violet-400 shrink-0 transition-colors">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </div>
            </button>
          ))}
        </div>
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
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [moduleStats, setModuleStats] = useState<ModuleStats[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!sessionId || isNaN(sessionId)) { setError('Invalid session ID'); return; }
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

  const loadStats = useCallback(async (tableNames: string[]) => {
    const results: ModuleStats[] = [];
    for (const name of tableNames) {
      try {
        const { rows } = await api.getTableData(name);
        results.push({
          tableName: name,
          label: toModuleLabel(name.replace(/^s\d+_/, '')),
          count: rows.length,
          latestRow: rows.length > 0 ? rows[rows.length - 1] : null,
        });
      } catch {
        results.push({ tableName: name, label: toModuleLabel(name.replace(/^s\d+_/, '')), count: 0, latestRow: null });
      }
    }
    setModuleStats(results);
  }, []);

  useEffect(() => {
    if (!session) return;
    const names = session.sessionTables.map((t) => t.table_name);
    loadStats(names);
  }, [session, loadStats]);

  if (error) {
    return (
      <div className="h-screen bg-[#0d0d12] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <p className="text-sm text-zinc-400">{error}</p>
          <a href="/" className="inline-block mt-4 text-xs text-violet-400 hover:text-violet-300 transition-colors">Back to Morph</a>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-screen bg-[#0d0d12] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-xs text-zinc-600">Loading app…</p>
        </div>
      </div>
    );
  }

  const tableNames = session.sessionTables.map((t) => t.table_name);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d0d12]">
      {/* Sidebar */}
      <aside className={`shrink-0 flex flex-col border-r border-[#1a1a24] bg-[#0a0a0f] transition-all duration-200 ${sidebarCollapsed ? 'w-[52px]' : 'w-[220px]'}`}>
        {/* Logo header */}
        <div className={`flex items-center shrink-0 border-b border-[#1a1a24] ${sidebarCollapsed ? 'justify-center py-3' : 'gap-2.5 px-4 py-3.5'}`}>
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-white shadow-[0_0_10px_rgba(124,58,237,0.4)] shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-zinc-100 truncate">{session.name || 'Untitled'}</p>
              <p className="text-[9px] text-zinc-700">Dashboard</p>
            </div>
          )}
          {!sidebarCollapsed && (
            <button onClick={() => setSidebarCollapsed(true)}
              className="w-6 h-6 flex items-center justify-center rounded text-zinc-700 hover:text-zinc-400 hover:bg-white/5 transition-colors shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}
        </div>

        {sidebarCollapsed && (
          <button onClick={() => setSidebarCollapsed(false)}
            className="mx-auto mt-2 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-white/5 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-2">
          {/* Overview */}
          <div className={sidebarCollapsed ? 'px-1.5' : 'px-2'}>
            <button onClick={() => setActiveModule(null)}
              className={`w-full flex items-center rounded-lg transition-all mb-1 cursor-pointer ${sidebarCollapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2'} ${
                activeModule === null ? 'bg-violet-600/15 text-violet-300' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
              }`}
              title="Overview"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
              {!sidebarCollapsed && <span className="text-[11px] font-medium">Overview</span>}
            </button>
          </div>

          {/* Module separator */}
          {!sidebarCollapsed && tableNames.length > 0 && (
            <div className="px-4 pt-4 pb-1.5">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-700">Modules</span>
            </div>
          )}
          {sidebarCollapsed && tableNames.length > 0 && <div className="mx-3 my-2 h-px bg-[#1e1e2e]" />}

          {/* Module items */}
          <div className={sidebarCollapsed ? 'px-1.5 space-y-0.5' : 'px-2 space-y-0.5'}>
            {tableNames.map((name) => {
              const displayName = name.replace(/^s\d+_/, '');
              const label = toModuleLabel(displayName);
              const isActive = activeModule === name;
              const stat = moduleStats.find((s) => s.tableName === name);
              return (
                <button key={name} onClick={() => setActiveModule(name)}
                  className={`w-full flex items-center rounded-lg transition-all cursor-pointer ${sidebarCollapsed ? 'justify-center p-2' : 'gap-2.5 px-3 py-2'} ${
                    isActive ? 'bg-violet-600/15 text-violet-300' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
                  }`}
                  title={label}
                >
                  <span className={`shrink-0 ${isActive ? 'text-violet-400' : ''}`}>
                    <ModuleIcon name={displayName} size={15} />
                  </span>
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1 text-[11px] font-medium text-left truncate">{label}</span>
                      {stat && (
                        <span className={`text-[9px] font-mono shrink-0 ${isActive ? 'text-violet-400/60' : 'text-zinc-700'}`}>
                          {stat.count}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className={`shrink-0 border-t border-[#1a1a24] ${sidebarCollapsed ? 'py-2 px-1.5' : 'py-2.5 px-3'}`}>
          <a href="/"
            className={`flex items-center rounded-lg text-zinc-600 hover:text-violet-400 hover:bg-violet-500/8 transition-all ${sidebarCollapsed ? 'justify-center p-2' : 'gap-2 px-3 py-2'}`}
            title="Open in Editor"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {!sidebarCollapsed && <span className="text-[11px] font-medium">Open in Editor</span>}
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-hidden">
        {activeModule === null ? (
          <OverviewPage tableNames={tableNames} stats={moduleStats} onSelectModule={setActiveModule} />
        ) : (
          <DashboardTable key={activeModule} tableName={activeModule} sessionId={sessionId} relations={relations} />
        )}
      </main>
    </div>
  );
}
