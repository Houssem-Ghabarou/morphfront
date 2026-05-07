'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { api, ImportAnalysis, ColumnSuggestion, ColumnMapping } from '@/lib/api';
import { ModalTheme, ThemeVars, THEMES, ThemeToggle, inputStyle, selectStyle } from '@/components/ModalTheme';

const PG_TYPES = ['TEXT', 'INTEGER', 'NUMERIC', 'BOOLEAN', 'DATE', 'TIMESTAMP'];

interface ImportModalProps {
  sessionId: number;
  hasExistingTables: boolean;
  onClose: () => void;
  onSuccess: (tableName: string, rowCount: number) => void;
}

type FileStatus = 'pending' | 'analyzing' | 'ready' | 'error' | 'importing' | 'done';

interface FileState {
  file: File;
  status: FileStatus;
  analysis?: ImportAnalysis;
  error?: string;
  tableName?: string;
  columns?: ColumnSuggestion[];
  mapping?: ColumnMapping[];
}

function stripPrefix(name: string) { return name.replace(/^s\d+_/, ''); }

function FileStatusBadge({ status }: { status: FileStatus }) {
  const map: Record<FileStatus, { label: string; bg: string; color: string }> = {
    pending:   { label: 'Pending',   bg: 'rgba(113,113,122,0.12)', color: '#71717a' },
    analyzing: { label: 'Analyzing', bg: 'rgba(124,58,237,0.12)',  color: '#a78bfa' },
    ready:     { label: 'Ready',     bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
    error:     { label: 'Error',     bg: 'rgba(239,68,68,0.12)',   color: '#ef4444' },
    importing: { label: 'Importing', bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa' },
    done:      { label: 'Done',      bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
  };
  const { label, bg, color } = map[status];
  const spinning = status === 'analyzing' || status === 'importing';
  return (
    <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: bg, color }}>
      {spinning && <span className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin" />}
      {label}
    </span>
  );
}

export function ImportModal({ sessionId, hasExistingTables, onClose, onSuccess }: ImportModalProps) {
  const [theme, setTheme] = useState<ModalTheme>('dark');
  const t: ThemeVars = THEMES[theme];

  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [description, setDescription] = useState('');
  const descriptionRef = useRef('');
  const [files, setFiles] = useState<FileState[]>([]);
  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setPortalEl(document.body); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const analyzeFile = useCallback(async (file: File, idx: number) => {
    setFiles((prev) => prev.map((f, i) => i === idx ? { ...f, status: 'analyzing' as FileStatus, error: undefined } : f));
    try {
      const result = await api.analyzeCSV(file, sessionId, descriptionRef.current || undefined);
      setFiles((prev) => prev.map((f, i) => {
        if (i !== idx) return f;
        return {
          ...f, status: 'ready' as FileStatus, analysis: result,
          tableName: result.flow === 'new' ? result.tableName : undefined,
          columns:   result.flow === 'new' ? result.columns   : undefined,
          mapping:   result.flow === 'existing' ? result.mapping : undefined,
        };
      }));
    } catch (err) {
      setFiles((prev) => prev.map((f, i) =>
        i === idx ? { ...f, status: 'error' as FileStatus, error: err instanceof Error ? err.message : 'Analysis failed' } : f
      ));
    }
  }, [sessionId]);

  const addFiles = useCallback((incoming: File[]) => {
    const csvs = incoming.filter((f) => f.name.toLowerCase().endsWith('.csv'));
    if (!csvs.length) return;
    setFiles((prev) => {
      const start = prev.length;
      csvs.forEach((_, i) => setTimeout(() => analyzeFile(csvs[i], start + i), 0));
      return [...prev, ...csvs.map((f) => ({ file: f, status: 'pending' as FileStatus }))];
    });
  }, [analyzeFile]);

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); addFiles(Array.from(e.dataTransfer.files)); };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = ''; };
  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));
  const retryFile  = (idx: number) => analyzeFile(files[idx].file, idx);

  const updateColumn = (fi: number, ci: number, field: 'pgName' | 'pgType', val: string) =>
    setFiles((p) => p.map((f, i) => i !== fi || !f.columns ? f : { ...f, columns: f.columns.map((c, j) => j === ci ? { ...c, [field]: val } : c) }));

  const updateTableName = (fi: number, name: string) =>
    setFiles((p) => p.map((f, i) => i === fi ? { ...f, tableName: name.replace(/[^a-z0-9_]/gi, '_').toLowerCase() } : f));

  const updateMapping = (fi: number, mi: number, col: string | null) =>
    setFiles((p) => p.map((f, i) => i !== fi || !f.mapping ? f : { ...f, mapping: f.mapping.map((m, j) => j === mi ? { ...m, tableColumn: col } : m) }));

  const hasReady = files.some((f) => f.status === 'ready');
  const allDone  = files.length > 0 && files.every((f) => f.status === 'done' || f.status === 'error');

  const handleImportAll = async () => {
    setFiles((p) => p.map((f) => f.status === 'ready' ? { ...f, status: 'importing' as FileStatus } : f));
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.status !== 'ready' || !f.analysis) continue;
      try {
        let res;
        if (f.analysis.flow === 'new') {
          res = await api.confirmImport({ flow: 'new', sessionId, tableName: f.tableName ?? f.analysis.tableName, columns: f.columns ?? f.analysis.columns, headers: f.analysis.headers, rows: f.analysis.rows });
        } else {
          res = await api.confirmImport({ flow: 'existing', tableName: f.analysis.tableName, mapping: f.mapping ?? f.analysis.mapping, headers: f.analysis.headers, rows: f.analysis.rows });
        }
        setFiles((p) => p.map((pf, idx) => idx === i ? { ...pf, status: 'done' as FileStatus } : pf));
        onSuccess(res.tableName, res.rowsImported);
      } catch (err) {
        setFiles((p) => p.map((pf, idx) => idx === i ? { ...pf, status: 'error' as FileStatus, error: err instanceof Error ? err.message : 'Import failed' } : pf));
      }
    }
  };

  const goToReview = () => {
    const first = files.findIndex((f) => f.status === 'ready');
    if (first >= 0) { setActiveFileIdx(first); setStep('review'); }
  };

  const af = files[activeFileIdx];
  if (!portalEl) return null;

  // ── Shared inline style helpers ───────────────────────────────────────────
  const iStyle   = inputStyle(t);
  const sStyle   = selectStyle(t);
  const divider  = { borderColor: t.border };
  const divider2 = { borderColor: t.border2 };
  const panelBox = { background: t.bg2, border: `1px solid ${t.border}` };

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: t.overlay, backdropFilter: 'blur(2px)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative flex flex-col rounded-2xl shadow-2xl" style={{ background: t.bg, border: `1px solid ${t.border}`, width: 640, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 64px)' }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="text-sm font-semibold" style={{ color: t.text1 }}>
              Import CSV{files.length > 1 ? ` (${files.length} files)` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} onChange={setTheme} t={t} />
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors" style={{ color: t.text3 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = t.bg2)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* ── UPLOAD ── */}
          {step === 'upload' && (
            <div className="flex flex-col gap-4 px-5 py-4">
              {!hasExistingTables && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs uppercase tracking-wide" style={{ color: t.text3 }}>
                    What is this project about? <span className="normal-case" style={{ color: t.text4 }}>(optional)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); descriptionRef.current = e.target.value; }}
                    placeholder="e.g. I run a gym and want to track members, plans and attendance"
                    rows={2}
                    className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                    style={{ ...iStyle }}
                  />
                </div>
              )}

              {/* Drop zone */}
              <div
                className="relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer py-8 transition-colors"
                style={{ borderColor: isDragging ? '#7c3aed' : t.border2, background: isDragging ? 'rgba(124,58,237,0.08)' : 'transparent' }}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={panelBox}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: t.text2 }}>Drop CSV files here</p>
                  <p className="text-xs mt-0.5" style={{ color: t.text4 }}>Multiple files supported · max 10 MB each</p>
                </div>
                <input ref={fileInputRef} type="file" accept=".csv,text/csv" multiple className="hidden" onChange={handleFileChange} />
              </div>

              {files.length > 0 && (
                <div className="flex flex-col gap-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={panelBox}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" className="shrink-0">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <span className="flex-1 text-xs font-mono truncate" style={{ color: t.text2 }}>{f.file.name}</span>
                      <FileStatusBadge status={f.status} />
                      {f.status === 'error' && <button onClick={() => retryFile(i)} className="text-[10px] text-violet-400 hover:text-violet-300 underline ml-1">Retry</button>}
                      {f.status !== 'analyzing' && f.status !== 'importing' && (
                        <button onClick={() => removeFile(i)} className="w-5 h-5 flex items-center justify-center rounded" style={{ color: t.text4 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── REVIEW ── */}
          {step === 'review' && (
            <div className="flex flex-col">
              {/* Tabs */}
              <div className="flex items-center gap-1 px-4 pt-3 overflow-x-auto" style={{ borderBottom: `1px solid ${t.border}` }}>
                {files.map((f, i) => (
                  <button key={i} onClick={() => setActiveFileIdx(i)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 whitespace-nowrap transition-all"
                    style={{ borderBottomColor: i === activeFileIdx ? '#7c3aed' : 'transparent', color: i === activeFileIdx ? t.text1 : t.text3, background: i === activeFileIdx ? 'rgba(124,58,237,0.08)' : 'transparent' }}>
                    <span className="truncate max-w-[120px]">{f.file.name.replace('.csv', '')}</span>
                    <FileStatusBadge status={f.status} />
                  </button>
                ))}
              </div>

              {af && (
                <div className="px-5 py-4 flex flex-col gap-4">
                  {af.status === 'error' && (
                    <div className="flex items-center justify-between p-3 rounded-lg" style={{ border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)' }}>
                      <p className="text-xs text-red-400">{af.error}</p>
                      <button onClick={() => retryFile(activeFileIdx)} className="text-xs text-violet-400 hover:text-violet-300 underline ml-3 shrink-0">Retry</button>
                    </div>
                  )}

                  {af.status === 'analyzing' && (
                    <div className="flex items-center gap-2.5 py-6 justify-center text-sm" style={{ color: t.text2 }}>
                      <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                      Analyzing with AI…
                    </div>
                  )}

                  {(af.status === 'ready' || af.status === 'done') && af.analysis?.flow === 'new' && (
                    <>
                      <div>
                        <p className="text-xs uppercase tracking-wide mb-1.5" style={{ color: t.text3 }}>Table name</p>
                        <input
                          value={af.tableName ?? af.analysis.tableName}
                          onChange={(e) => updateTableName(activeFileIdx, e.target.value)}
                          className="w-full rounded-lg px-3 py-2 text-sm font-mono focus:outline-none"
                          style={iStyle}
                        />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide mb-2" style={{ color: t.text3 }}>Column mapping</p>
                        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
                          <table className="w-full text-xs">
                            <thead>
                              <tr style={{ ...divider, borderBottomWidth: 1, borderBottomStyle: 'solid', background: t.bg2 }}>
                                {['CSV header', 'Column name', 'PG type'].map((h) => (
                                  <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: t.text3 }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(af.columns ?? af.analysis.columns).map((col, i) => (
                                <tr key={i} style={{ borderBottom: `1px solid ${t.border}` }}>
                                  <td className="px-3 py-2 font-mono" style={{ color: t.text2 }}>{col.csvHeader}</td>
                                  <td className="px-3 py-2">
                                    <input value={col.pgName} onChange={(e) => updateColumn(activeFileIdx, i, 'pgName', e.target.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase())}
                                      className="w-full bg-transparent font-mono focus:outline-none rounded px-1 py-0.5"
                                      style={{ color: t.text1, border: `1px solid transparent` }} />
                                  </td>
                                  <td className="px-3 py-2">
                                    <select value={col.pgType} onChange={(e) => updateColumn(activeFileIdx, i, 'pgType', e.target.value)}
                                      className="rounded px-1.5 py-0.5 text-xs focus:outline-none" style={sStyle}>
                                      {PG_TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
                                    </select>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-xs mt-2" style={{ color: t.text4 }}>{af.analysis.rows.length} rows</p>
                      </div>
                    </>
                  )}

                  {(af.status === 'ready' || af.status === 'done') && af.analysis?.flow === 'existing' && (
                    <>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ ...panelBox }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                        <span className="text-xs font-mono" style={{ color: t.text2 }}>{stripPrefix(af.analysis.tableName)}</span>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide mb-2" style={{ color: t.text3 }}>Column mapping</p>
                        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
                          <table className="w-full text-xs">
                            <thead>
                              <tr style={{ borderBottom: `1px solid ${t.border}`, background: t.bg2 }}>
                                <th className="text-left px-3 py-2 font-medium" style={{ color: t.text3 }}>CSV column</th>
                                <th className="text-left px-3 py-2 font-medium" style={{ color: t.text3 }}>Maps to</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(af.mapping ?? af.analysis.mapping).map((m, i) => (
                                <tr key={i} style={{ borderBottom: `1px solid ${t.border}`, background: m.tableColumn === null ? 'rgba(245,158,11,0.05)' : undefined }}>
                                  <td className="px-3 py-2 font-mono" style={{ color: m.tableColumn === null ? '#f59e0b' : t.text2 }}>{m.csvHeader}</td>
                                  <td className="px-3 py-2">
                                    <MappingSelect value={m.tableColumn} tableName={af.analysis?.tableName ?? ''} onChange={(v) => updateMapping(activeFileIdx, i, v)} t={t} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-xs mt-2" style={{ color: t.text4 }}>{af.analysis.rows.length} rows</p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderTop: `1px solid ${t.border}` }}>
          {step === 'upload' ? (
            <>
              <span className="text-xs" style={{ color: t.text4 }}>
                {files.length === 0 ? 'No files added' : `${files.filter(f => f.status === 'ready').length} / ${files.length} ready`}
              </span>
              <button onClick={goToReview} disabled={!hasReady}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Review &amp; Import
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep('upload')}
                className="px-4 py-2 rounded-lg text-sm transition-colors"
                style={{ color: t.text2, border: `1px solid ${t.border2}`, background: 'transparent' }}>
                Back
              </button>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: t.text4 }}>
                  {files.filter(f => f.status === 'done').length}/{files.filter(f => f.status === 'ready' || f.status === 'done').length} done
                </span>
                <button onClick={handleImportAll} disabled={!hasReady || allDone}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  {files.some((f) => f.status === 'importing')
                    ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Importing…</>
                    : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Import All</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, portalEl);
}

function MappingSelect({ value, tableName, onChange, t }: { value: string | null; tableName: string; onChange: (v: string | null) => void; t: ThemeVars }) {
  const [cols, setCols] = useState<string[]>([]);
  useEffect(() => {
    api.getSchema(tableName).then((s) => setCols(s.columns.map((c) => c.column_name).filter((n) => n !== 'id' && n !== 'created_at'))).catch(() => {});
  }, [tableName]);
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}
      className="rounded px-1.5 py-0.5 text-xs focus:outline-none min-w-[120px]"
      style={selectStyle(t)}>
      <option value="">— skip —</option>
      {cols.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}
