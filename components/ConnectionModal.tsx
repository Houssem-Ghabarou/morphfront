'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { ModalTheme, ThemeVars, THEMES, ThemeToggle } from '@/components/ModalTheme';

type DbType = 'postgresql' | 'mysql' | 'mongodb';
type Step = 'config' | 'discover' | 'import';

interface DiscoveredColumn { name: string; type: string; nullable: boolean; }
interface DiscoveredTable {
  tableName: string;
  rowCount: number;
  columns: DiscoveredColumn[];
  sampleRows: Record<string, unknown>[];
}

interface ConnectionModalProps {
  sessionId: number;
  onClose: () => void;
  onSuccess: (tableName: string, rowCount: number) => void;
}

const DEFAULT_PORTS: Record<DbType, number> = { postgresql: 5432, mysql: 3306, mongodb: 27017 };

const DB_LABELS: Record<DbType, string> = { postgresql: 'PostgreSQL', mysql: 'MySQL', mongodb: 'MongoDB' };

function DbIcon({ type, size = 22 }: { type: DbType; size?: number }) {
  if (type === 'postgresql') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
  if (type === 'mysql') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3C7 3 3 5.69 3 9v6c0 3.31 4 6 9 6s9-2.69 9-6V9c0-3.31-4-6-9-6z" />
      <path d="M3 9c0 3.31 4 6 9 6s9-2.69 9-6" />
      <path d="M3 12c0 3.31 4 6 9 6s9-2.69 9-6" />
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2C8 2 6 6 6 10c0 3.5 2 5.5 4 7l2 5 2-5c2-1.5 4-3.5 4-7 0-4-2-8-6-8z" />
      <line x1="12" y1="17" x2="12" y2="22" />
    </svg>
  );
}

function DbTypeButton({ type, selected, onClick, t }: { type: DbType; selected: boolean; onClick: () => void; t: ThemeVars }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 px-5 py-4 rounded-xl border-2 transition-all"
      style={{
        borderColor: selected ? '#7c3aed' : t.border2,
        background:  selected ? 'rgba(124,58,237,0.1)' : t.bg2,
        color:       selected ? '#a78bfa' : t.text2,
      }}
    >
      <DbIcon type={type} />
      <span className="text-sm font-medium">{DB_LABELS[type]}</span>
    </button>
  );
}

export function ConnectionModal({ sessionId, onClose, onSuccess }: ConnectionModalProps) {
  const [theme, setTheme] = useState<ModalTheme>('dark');
  const t: ThemeVars = THEMES[theme];

  const [step, setStep] = useState<Step>('config');
  const [dbType, setDbType] = useState<DbType>('postgresql');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState(DEFAULT_PORTS.postgresql);
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [ssl, setSsl] = useState(false);

  const [isTesting, setIsTesting]     = useState(false);
  const [testResult, setTestResult]   = useState<{ ok: boolean; message: string } | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [tables, setTables]           = useState<DiscoveredTable[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<Array<{ tableName: string; rowsImported: number; error?: string }> | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [portalEl, setPortalEl]       = useState<HTMLElement | null>(null);

  useEffect(() => { setPortalEl(document.body); }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleTypeChange = (tp: DbType) => {
    setDbType(tp); setPort(DEFAULT_PORTS[tp]);
    setTestResult(null); setError(null);
  };

  const connBody = () => ({ type: dbType, host, port, database, username, password, ssl });

  const handleTest = async () => {
    setIsTesting(true); setTestResult(null); setError(null);
    try {
      const res = await api.testConnection(connBody());
      setTestResult({ ok: res.ok, message: res.ok ? 'Connection successful!' : (res.error ?? 'Failed') });
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Connection failed' });
    } finally { setIsTesting(false); }
  };

  const handleDiscover = async () => {
    setIsDiscovering(true); setError(null);
    try {
      const res = await api.discoverSchemas(connBody());
      setTables(res.tables);
      setSelectedTables(new Set(res.tables.map((tb: DiscoveredTable) => tb.tableName)));
      setStep('discover');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed');
    } finally { setIsDiscovering(false); }
  };

  const toggleTable = (name: string) => {
    setSelectedTables((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  };

  const handleImport = async () => {
    if (selectedTables.size === 0) return;
    setIsImporting(true); setError(null);
    try {
      const res = await api.importFromConnection({ ...connBody(), sessionId, tables: Array.from(selectedTables) });
      setImportResults(res.results);
      setStep('import');
      for (const r of res.results) { if (!r.error) onSuccess(r.tableName, r.rowsImported); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally { setIsImporting(false); }
  };

  const canConnect = host && database && (dbType === 'mongodb' || username);

  if (!portalEl) return null;

  const STEPS: Step[] = ['config', 'discover', 'import'];
  const stepLabels = ['Configure', 'Select', 'Done'];
  const stepIdx = STEPS.indexOf(step);

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: t.overlay, backdropFilter: 'blur(2px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex flex-col rounded-2xl shadow-2xl"
        style={{ background: t.bg, border: `1px solid ${t.border}`, width: 560, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 64px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
            </svg>
            <span className="text-sm font-semibold" style={{ color: t.text1 }}>Connect Database</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} onChange={setTheme} t={t} />
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/10 transition-colors"
              style={{ color: t.text3 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
          {STEPS.map((s, i) => {
            const done   = stepIdx > i;
            const active = step === s;
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div className="h-px w-6" style={{ background: done || active ? '#7c3aed' : t.border2 }} />}
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{
                      background:  done ? '#7c3aed' : active ? 'rgba(124,58,237,0.15)' : t.bg2,
                      border:      active ? '1px solid #7c3aed' : `1px solid ${t.border2}`,
                      color:       done ? '#fff' : active ? '#a78bfa' : t.text4,
                    }}
                  >
                    {done ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : i + 1}
                  </div>
                  <span className="text-xs" style={{ color: active ? t.text1 : done ? t.text2 : t.text4 }}>{stepLabels[i]}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {/* ── STEP 1: Configure ── */}
          {step === 'config' && (
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-xs uppercase tracking-wide mb-2" style={{ color: t.text3 }}>Database type</p>
                <div className="flex gap-3">
                  {(['postgresql', 'mysql', 'mongodb'] as DbType[]).map((tp) => (
                    <DbTypeButton key={tp} type={tp} selected={dbType === tp} onClick={() => handleTypeChange(tp)} t={t} />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: t.text3 }}>Host</label>
                  <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="localhost"
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${t.inputCls}`} />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: t.text3 }}>Port</label>
                  <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${t.inputCls}`} />
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: t.text3 }}>
                  {dbType === 'mongodb' ? 'Database / Collection namespace' : 'Database name'}
                </label>
                <input value={database} onChange={(e) => setDatabase(e.target.value)}
                  placeholder={dbType === 'mongodb' ? 'my_db' : 'my_database'}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${t.inputCls}`} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: t.text3 }}>
                    Username
                    {dbType === 'mongodb' && <span className="normal-case ml-1" style={{ color: t.text4 }}>(optional)</span>}
                  </label>
                  <input value={username} onChange={(e) => setUsername(e.target.value)}
                    placeholder={dbType === 'mongodb' ? 'leave blank if open' : 'postgres'}
                    autoComplete="username"
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${t.inputCls}`} />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: t.text3 }}>
                    Password
                    {dbType === 'mongodb' && !username && <span className="normal-case ml-1" style={{ color: t.text4 }}>(optional)</span>}
                  </label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" autoComplete="current-password"
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${t.inputCls}`} />
                </div>
              </div>

              {/* SSL toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSsl(!ssl)}
                  className="relative rounded-full transition-colors"
                  style={{ width: 32, height: 18, background: ssl ? '#7c3aed' : t.border2, border: `1px solid ${ssl ? '#7c3aed' : t.border2}` }}
                >
                  <span
                    className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                    style={{ left: ssl ? 16 : 2 }}
                  />
                </button>
                <span className="text-xs" style={{ color: t.text2 }}>Use SSL/TLS</span>
              </div>

              {testResult && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs"
                  style={{
                    borderColor: testResult.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
                    background:  testResult.ok ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                    color:       testResult.ok ? '#10b981' : '#ef4444',
                  }}
                >
                  {testResult.ok ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                  )}
                  {testResult.message}
                </div>
              )}

              {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
            </div>
          )}

          {/* ── STEP 2: Discover ── */}
          {step === 'discover' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide" style={{ color: t.text3 }}>
                  {tables.length} {dbType === 'mongodb' ? 'collection' : 'table'}{tables.length !== 1 ? 's' : ''} found
                </p>
                <button onClick={() => setSelectedTables(new Set(tables.map((tb) => tb.tableName)))} className="text-xs text-violet-400 hover:text-violet-300">
                  Select all
                </button>
              </div>

              <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                {tables.map((table) => {
                  const checked = selectedTables.has(table.tableName);
                  return (
                    <button
                      key={table.tableName}
                      onClick={() => toggleTable(table.tableName)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
                      style={{
                        border:     `1px solid ${checked ? 'rgba(124,58,237,0.4)' : t.border}`,
                        background: checked ? 'rgba(124,58,237,0.06)' : t.bg2,
                      }}
                    >
                      <div
                        className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                        style={{ background: checked ? '#7c3aed' : 'transparent', border: `1px solid ${checked ? '#7c3aed' : t.border2}` }}
                      >
                        {checked && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono truncate" style={{ color: t.text1 }}>{table.tableName}</span>
                          <span className="text-[10px] shrink-0" style={{ color: t.text4 }}>{table.rowCount.toLocaleString()} rows</span>
                        </div>
                        <p className="text-[10px] truncate mt-0.5" style={{ color: t.text4 }}>
                          {table.columns.slice(0, 6).map((c) => c.name).join(', ')}
                          {table.columns.length > 6 ? ` +${table.columns.length - 6}` : ''}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
            </div>
          )}

          {/* ── STEP 3: Results ── */}
          {step === 'import' && importResults && (
            <div className="flex flex-col gap-3">
              <p className="text-xs uppercase tracking-wide" style={{ color: t.text3 }}>Import results</p>
              {importResults.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                  style={{
                    border:     `1px solid ${r.error ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
                    background: r.error ? 'rgba(239,68,68,0.05)' : 'rgba(16,185,129,0.05)',
                  }}
                >
                  {r.error ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono truncate" style={{ color: t.text1 }}>{r.tableName.replace(/^s\d+_/, '')}</p>
                    {r.error
                      ? <p className="text-[10px] text-red-400">{r.error}</p>
                      : <p className="text-[10px]" style={{ color: t.text4 }}>{r.rowsImported.toLocaleString()} rows imported</p>
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderTop: `1px solid ${t.border}` }}>
          {step === 'config' && (
            <>
              <button
                onClick={handleTest}
                disabled={!canConnect || isTesting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors hover:bg-violet-500/10"
                style={{ color: t.text2, border: `1px solid ${t.border2}` }}
              >
                {isTesting ? <div className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: `${t.text3}/30`, borderTopColor: t.text2 }} /> : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13" />
                  </svg>
                )}
                Test Connection
              </button>
              <button
                onClick={handleDiscover}
                disabled={!canConnect || isDiscovering}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
              >
                {isDiscovering
                  ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Discovering…</>
                  : <>Connect &amp; Explore <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg></>
                }
              </button>
            </>
          )}

          {step === 'discover' && (
            <>
              <button
                onClick={() => setStep('config')}
                className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-black/5"
                style={{ color: t.text2, border: `1px solid ${t.border2}` }}
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={selectedTables.size === 0 || isImporting}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
              >
                {isImporting
                  ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Importing…</>
                  : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg> Import {selectedTables.size} {dbType === 'mongodb' ? 'collection' : 'table'}{selectedTables.size !== 1 ? 's' : ''}</>
                }
              </button>
            </>
          )}

          {step === 'import' && (
            <div className="flex-1 flex justify-end">
              <button onClick={onClose} className="px-5 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, portalEl);
}
