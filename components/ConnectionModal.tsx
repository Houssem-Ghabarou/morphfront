'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { ThemeVars, THEMES, inputStyle, selectStyle } from '@/components/ModalTheme';
import { useTheme } from '@/components/ThemeProvider';

type DbType = 'postgresql' | 'mysql' | 'mongodb';
type Step   = 'config' | 'discover' | 'import';

interface DiscoveredTable { tableName: string; rowCount: number; columns: { name: string; type: string }[]; sampleRows: Record<string, unknown>[]; }

interface ConnectionModalProps {
  sessionId: number;
  onClose: () => void;
  onSuccess: (tableName: string, rowCount: number) => void;
  onConnectionLinked?: () => void;
}

const DEFAULT_PORTS: Record<DbType, number> = { postgresql: 5432, mysql: 3306, mongodb: 27017 };
const DB_LABELS: Record<DbType, string>     = { postgresql: 'PostgreSQL', mysql: 'MySQL', mongodb: 'MongoDB' };

function DbIcon({ type }: { type: DbType }) {
  if (type === 'postgresql') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
    </svg>
  );
  if (type === 'mysql') return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3C7 3 3 5.69 3 9v6c0 3.31 4 6 9 6s9-2.69 9-6V9c0-3.31-4-6-9-6z"/>
      <path d="M3 9c0 3.31 4 6 9 6s9-2.69 9-6"/><path d="M3 12c0 3.31 4 6 9 6s9-2.69 9-6"/>
    </svg>
  );
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2C8 2 6 6 6 10c0 3.5 2 5.5 4 7l2 5 2-5c2-1.5 4-3.5 4-7 0-4-2-8-6-8z"/>
      <line x1="12" y1="17" x2="12" y2="22"/>
    </svg>
  );
}

function DbTypeButton({ type, selected, onClick, t }: { type: DbType; selected: boolean; onClick: () => void; t: ThemeVars }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 px-5 py-4 rounded-xl transition-all"
      style={{
        border:     `2px solid ${selected ? '#7c3aed' : t.border2}`,
        background: selected ? 'rgba(124,58,237,0.12)' : t.bg2,
        color:      selected ? '#a78bfa' : t.text2,
      }}>
      <DbIcon type={type} />
      <span className="text-sm font-medium">{DB_LABELS[type]}</span>
    </button>
  );
}

export function ConnectionModal({ sessionId, onClose, onSuccess, onConnectionLinked }: ConnectionModalProps) {
  const { theme } = useTheme();
  const t: ThemeVars = THEMES[theme];

  const [step, setStep]               = useState<Step>('config');
  const [dbType, setDbType]           = useState<DbType>('postgresql');
  const [host, setHost]               = useState('localhost');
  const [port, setPort]               = useState(DEFAULT_PORTS.postgresql);
  const [database, setDatabase]       = useState('');
  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [ssl, setSsl]                 = useState(false);
  const [useSrv, setUseSrv]           = useState(false);
  const [connectionString, setConnectionString] = useState('');

  const [isTesting, setIsTesting]         = useState(false);
  const [testResult, setTestResult]       = useState<{ ok: boolean; message: string } | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [tables, setTables]               = useState<DiscoveredTable[]>([]);
  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting]     = useState(false);
  const [results, setResults]             = useState<Array<{ tableName: string; rowsImported: number; error?: string }> | null>(null);
  const [error, setError]                 = useState<string | null>(null);
  const [portalEl, setPortalEl]           = useState<HTMLElement | null>(null);

  useEffect(() => { setPortalEl(document.body); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleTypeChange = (tp: DbType) => { setDbType(tp); setPort(DEFAULT_PORTS[tp]); setTestResult(null); setError(null); if (tp !== 'mongodb') setUseSrv(false); };
  const connBody = () => useSrv
    ? { type: dbType, host: 'atlas', port: 0, database, username: '', password: '', ssl: false, connectionString }
    : { type: dbType, host, port, database, username, password, ssl };

  const handleTest = async () => {
    setIsTesting(true); setTestResult(null); setError(null);
    try {
      const r = await api.testConnection(connBody());
      setTestResult({ ok: r.ok, message: r.ok ? 'Connection successful!' : (r.error ?? 'Failed') });
    } catch (err) { setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Connection failed' }); }
    finally { setIsTesting(false); }
  };

  const handleDiscover = async () => {
    setIsDiscovering(true); setError(null);
    try {
      const r = await api.discoverSchemas(connBody());
      setTables(r.tables);
      setSelected(new Set(r.tables.map((tb: DiscoveredTable) => tb.tableName)));
      setStep('discover');
    } catch (err) { setError(err instanceof Error ? err.message : 'Discovery failed'); }
    finally { setIsDiscovering(false); }
  };

  const toggleTable = (name: string) =>
    setSelected((p) => { const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n; });

  const handleImport = async () => {
    if (!selected.size) return;
    setIsImporting(true); setError(null);
    try {
      const r = await api.importFromConnection({ ...connBody(), sessionId, tables: Array.from(selected) });

      const importedTableNames = r.results.filter((row) => !row.error).map((row) => row.tableName);

      // 1. Save + link in one call (no re-test) so dbConn.reload() finds it immediately
      if (importedTableNames.length > 0) {
        try {
          await api.linkSession({
            ...connBody(),
            name: `${dbType}@${host}/${database}`,
            sessionId,
            importedTables: importedTableNames,
          });
          onConnectionLinked?.();
        } catch (e) {
          console.error('[ConnectionModal] linkSession failed:', e);
        }
      }

      // 2. Then update UI and notify parent
      setResults(r.results);
      setStep('import');
      for (const row of r.results) { if (!row.error) onSuccess(row.tableName, row.rowsImported); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Import failed'); }
    finally { setIsImporting(false); }
  };

  const canConnect = useSrv ? (connectionString.startsWith('mongodb') && database) : (host && database && (dbType === 'mongodb' || username));

  if (!portalEl) return null;

  const iStyle  = inputStyle(t);
  const STEPS: Step[] = ['config', 'discover', 'import'];
  const SLABELS = ['Configure', 'Select', 'Done'];
  const sIdx = STEPS.indexOf(step);
  const entityWord = dbType === 'mongodb' ? 'collection' : 'table';

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: t.overlay, backdropFilter: 'blur(2px)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative flex flex-col rounded-2xl shadow-2xl" style={{ background: t.bg, border: `1px solid ${t.border}`, width: 560, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 64px)' }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
              <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
            </svg>
            <span className="text-sm font-semibold" style={{ color: t.text1 }}>Connect Database</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors" style={{ color: t.text3 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = t.bg2)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: `1px solid ${t.border}` }}>
          {STEPS.map((s, i) => {
            const done = sIdx > i; const active = step === s;
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div className="h-px w-6" style={{ background: done || active ? '#7c3aed' : t.border2 }} />}
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ background: done ? '#7c3aed' : active ? 'rgba(124,58,237,0.15)' : t.bg2, border: `1px solid ${active ? '#7c3aed' : t.border2}`, color: done ? '#fff' : active ? '#a78bfa' : t.text4 }}>
                    {done ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> : i + 1}
                  </div>
                  <span className="text-xs" style={{ color: active ? t.text1 : done ? t.text2 : t.text4 }}>{SLABELS[i]}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {/* ── STEP 1 ── */}
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

              {/* Atlas / SRV toggle — MongoDB only */}
              {dbType === 'mongodb' && (
                <div className="flex items-center gap-2">
                  <button onClick={() => { setUseSrv(!useSrv); setTestResult(null); setError(null); }} className="relative rounded-full transition-colors"
                    style={{ width: 32, height: 18, background: useSrv ? '#7c3aed' : t.border2, border: `1px solid ${useSrv ? '#7c3aed' : t.border2}` }}>
                    <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all" style={{ left: useSrv ? 16 : 2 }} />
                  </button>
                  <span className="text-xs" style={{ color: t.text2 }}>Use Atlas / SRV connection string</span>
                </div>
              )}

              {useSrv ? (
                <>
                  <div>
                    <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: t.text3 }}>Connection string</label>
                    <input
                      value={connectionString}
                      onChange={(e) => setConnectionString(e.target.value)}
                      placeholder="mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/mydb"
                      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none font-mono"
                      style={iStyle}
                    />
                    <p className="text-[11px] mt-1.5" style={{ color: t.text4 }}>
                      Replace <span className="font-mono" style={{ color: t.text3 }}>{'<db_username>'}</span> and <span className="font-mono" style={{ color: t.text3 }}>{'<db_password>'}</span> with your actual credentials.
                    </p>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: t.text3 }}>Database name</label>
                    <input value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="my_db" className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={iStyle} />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: t.text3 }}>Host</label>
                      <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="localhost" className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={iStyle} />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: t.text3 }}>Port</label>
                      <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={iStyle} />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: t.text3 }}>
                      {dbType === 'mongodb' ? 'Database namespace' : 'Database name'}
                    </label>
                    <input value={database} onChange={(e) => setDatabase(e.target.value)} placeholder={dbType === 'mongodb' ? 'my_db' : 'my_database'} className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={iStyle} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: t.text3 }}>
                        Username{dbType === 'mongodb' && <span className="normal-case ml-1" style={{ color: t.text4 }}>(optional)</span>}
                      </label>
                      <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={dbType === 'mongodb' ? 'leave blank if open' : 'postgres'} autoComplete="username" className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={iStyle} />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: t.text3 }}>
                        Password{dbType === 'mongodb' && !username && <span className="normal-case ml-1" style={{ color: t.text4 }}>(optional)</span>}
                      </label>
                      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={iStyle} />
                    </div>
                  </div>

                  {/* SSL */}
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSsl(!ssl)} className="relative rounded-full transition-colors"
                      style={{ width: 32, height: 18, background: ssl ? '#7c3aed' : t.border2, border: `1px solid ${ssl ? '#7c3aed' : t.border2}` }}>
                      <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all" style={{ left: ssl ? 16 : 2 }} />
                    </button>
                    <span className="text-xs" style={{ color: t.text2 }}>Use SSL/TLS</span>
                  </div>
                </>
              )}

              {testResult && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                  style={{ border: `1px solid ${testResult.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, background: testResult.ok ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', color: testResult.ok ? '#10b981' : '#ef4444' }}>
                  {testResult.ok
                    ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
                  {testResult.message}
                </div>
              )}
              {error && <p className="text-xs text-red-400 px-3 py-2 rounded-lg" style={{ border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)' }}>{error}</p>}
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 'discover' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide" style={{ color: t.text3 }}>
                  {tables.length} {entityWord}{tables.length !== 1 ? 's' : ''} found
                </p>
                <button onClick={() => setSelected(new Set(tables.map((tb) => tb.tableName)))} className="text-xs text-violet-400 hover:text-violet-300">Select all</button>
              </div>

              <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                {tables.map((table) => {
                  const checked = selected.has(table.tableName);
                  return (
                    <button key={table.tableName} onClick={() => toggleTable(table.tableName)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all"
                      style={{ border: `1px solid ${checked ? 'rgba(124,58,237,0.4)' : t.border}`, background: checked ? 'rgba(124,58,237,0.07)' : t.bg2 }}>
                      <div className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                        style={{ background: checked ? '#7c3aed' : 'transparent', border: `1px solid ${checked ? '#7c3aed' : t.border2}` }}>
                        {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono truncate" style={{ color: t.text1 }}>{table.tableName}</span>
                          <span className="text-[10px] shrink-0" style={{ color: t.text4 }}>{table.rowCount.toLocaleString()} rows</span>
                        </div>
                        <p className="text-[10px] truncate mt-0.5" style={{ color: t.text4 }}>
                          {table.columns.slice(0, 6).map((c) => c.name).join(', ')}{table.columns.length > 6 ? ` +${table.columns.length - 6}` : ''}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {error && <p className="text-xs text-red-400 px-3 py-2 rounded-lg" style={{ border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)' }}>{error}</p>}
            </div>
          )}

          {/* ── STEP 3 ── */}
          {step === 'import' && results && (
            <div className="flex flex-col gap-3">
              <p className="text-xs uppercase tracking-wide" style={{ color: t.text3 }}>Import results</p>
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                  style={{ border: `1px solid ${r.error ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`, background: r.error ? 'rgba(239,68,68,0.05)' : 'rgba(16,185,129,0.05)' }}>
                  {r.error
                    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono truncate" style={{ color: t.text1 }}>{r.tableName.replace(/^s\d+_/, '')}</p>
                    {r.error
                      ? <p className="text-[10px] text-red-400">{r.error}</p>
                      : <p className="text-[10px]" style={{ color: t.text4 }}>{r.rowsImported.toLocaleString()} rows imported</p>}
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
              <button onClick={handleTest} disabled={!canConnect || isTesting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                style={{ color: t.text2, border: `1px solid ${t.border2}`, background: 'transparent' }}>
                {isTesting ? <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" /> :
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07"/></svg>}
                Test Connection
              </button>
              <button onClick={handleDiscover} disabled={!canConnect || isDiscovering}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {isDiscovering ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Discovering…</>
                  : <>Connect &amp; Explore <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg></>}
              </button>
            </>
          )}
          {step === 'discover' && (
            <>
              <button onClick={() => setStep('config')} className="px-4 py-2 rounded-lg text-sm transition-colors" style={{ color: t.text2, border: `1px solid ${t.border2}`, background: 'transparent' }}>Back</button>
              <button onClick={handleImport} disabled={!selected.size || isImporting}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {isImporting ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Importing…</>
                  : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Import {selected.size} {entityWord}{selected.size !== 1 ? 's' : ''}</>}
              </button>
            </>
          )}
          {step === 'import' && (
            <div className="flex-1 flex justify-end">
              <button onClick={onClose} className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 transition-colors">Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, portalEl);
}
