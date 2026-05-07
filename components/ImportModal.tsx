'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { api, ImportAnalysis, ColumnSuggestion, ColumnMapping } from '@/lib/api';
import { ModalTheme, ThemeVars, THEMES, ThemeToggle } from '@/components/ModalTheme';

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

function stripPrefix(name: string) {
  return name.replace(/^s\d+_/, '');
}

function FileStatusBadge({ status }: { status: FileStatus }) {
  const configs: Record<FileStatus, { label: string; cls: string }> = {
    pending:   { label: 'Pending',   cls: 'text-zinc-500 bg-zinc-500/10' },
    analyzing: { label: 'Analyzing', cls: 'text-violet-400 bg-violet-500/10' },
    ready:     { label: 'Ready',     cls: 'text-emerald-400 bg-emerald-500/10' },
    error:     { label: 'Error',     cls: 'text-red-400 bg-red-500/10' },
    importing: { label: 'Importing', cls: 'text-blue-400 bg-blue-500/10' },
    done:      { label: 'Done',      cls: 'text-emerald-400 bg-emerald-500/10' },
  };
  const { label, cls } = configs[status];
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cls}`}>
      {status === 'analyzing' || status === 'importing' ? (
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin inline-block" />
          {label}
        </span>
      ) : label}
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
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setPortalEl(document.body); }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const analyzeFile = useCallback(async (file: File, idx: number) => {
    setFiles((prev) => prev.map((f, i) => i === idx ? { ...f, status: 'analyzing', error: undefined } : f));
    try {
      const result = await api.analyzeCSV(file, sessionId, descriptionRef.current || undefined);
      setFiles((prev) => prev.map((f, i) => {
        if (i !== idx) return f;
        return {
          ...f, status: 'ready', analysis: result,
          tableName: result.flow === 'new' ? result.tableName : undefined,
          columns:   result.flow === 'new' ? result.columns   : undefined,
          mapping:   result.flow === 'existing' ? result.mapping : undefined,
        };
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      setFiles((prev) => prev.map((f, i) => i === idx ? { ...f, status: 'error', error: msg } : f));
    }
  }, [sessionId]);

  const addFiles = useCallback((incoming: File[]) => {
    const csvFiles = incoming.filter((f) => f.name.toLowerCase().endsWith('.csv'));
    if (csvFiles.length === 0) return;
    setFiles((prev) => {
      const startIdx = prev.length;
      const newStates: FileState[] = csvFiles.map((f) => ({ file: f, status: 'pending' as FileStatus }));
      csvFiles.forEach((_, i) => setTimeout(() => analyzeFile(csvFiles[i], startIdx + i), 0));
      return [...prev, ...newStates];
    });
  }, [analyzeFile]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = '';
  };
  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setActiveFileIdx((prev) => Math.max(0, prev > idx ? prev - 1 : Math.min(prev, files.length - 2)));
  };
  const retryFile = (idx: number) => analyzeFile(files[idx].file, idx);

  const updateColumn = (fi: number, ci: number, field: 'pgName' | 'pgType', val: string) => {
    setFiles((prev) => prev.map((f, i) => {
      if (i !== fi || !f.columns) return f;
      return { ...f, columns: f.columns.map((c, j) => j === ci ? { ...c, [field]: val } : c) };
    }));
  };
  const updateTableName = (fi: number, name: string) => {
    setFiles((prev) => prev.map((f, i) =>
      i === fi ? { ...f, tableName: name.replace(/[^a-z0-9_]/gi, '_').toLowerCase() } : f
    ));
  };
  const updateMapping = (fi: number, mi: number, col: string | null) => {
    setFiles((prev) => prev.map((f, i) => {
      if (i !== fi || !f.mapping) return f;
      return { ...f, mapping: f.mapping.map((m, j) => j === mi ? { ...m, tableColumn: col } : m) };
    }));
  };

  const hasReady = files.some((f) => f.status === 'ready');
  const allReady = files.length > 0 && files.every((f) => f.status === 'ready' || f.status === 'done');

  const handleImportAll = async () => {
    setGlobalError(null);
    if (!files.some((f) => f.status === 'ready')) return;
    setFiles((prev) => prev.map((f) => f.status === 'ready' ? { ...f, status: 'importing' } : f));

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.status !== 'ready' || !f.analysis) continue;
      try {
        let result;
        if (f.analysis.flow === 'new') {
          result = await api.confirmImport({
            flow: 'new', sessionId,
            tableName: f.tableName ?? f.analysis.tableName,
            columns:   f.columns   ?? f.analysis.columns,
            headers: f.analysis.headers, rows: f.analysis.rows,
          });
        } else {
          result = await api.confirmImport({
            flow: 'existing', tableName: f.analysis.tableName,
            mapping: f.mapping ?? f.analysis.mapping,
            headers: f.analysis.headers, rows: f.analysis.rows,
          });
        }
        setFiles((prev) => prev.map((pf, idx) => idx === i ? { ...pf, status: 'done' } : pf));
        onSuccess(result.tableName, result.rowsImported);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Import failed';
        setFiles((prev) => prev.map((pf, idx) => idx === i ? { ...pf, status: 'error', error: msg } : pf));
      }
    }
  };

  const goToReview = () => {
    if (files.some((f) => f.status === 'ready')) {
      setActiveFileIdx(files.findIndex((f) => f.status === 'ready'));
      setStep('review');
    }
  };

  const activeFile = files[activeFileIdx];
  if (!portalEl) return null;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: t.overlay, backdropFilter: 'blur(2px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex flex-col rounded-2xl shadow-2xl"
        style={{ background: t.bg, border: `1px solid ${t.border}`, width: 620, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 64px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="text-sm font-semibold" style={{ color: t.text1 }}>
              Import CSV{files.length > 1 ? ` (${files.length} files)` : ''}
            </span>
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

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* ── UPLOAD STEP ── */}
          {step === 'upload' && (
            <div className="flex flex-col gap-4 px-5 py-4">
              {!hasExistingTables && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs uppercase tracking-wide" style={{ color: t.text3 }}>
                    What is this project about?{' '}
                    <span className="normal-case" style={{ color: t.text4 }}>(optional)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); descriptionRef.current = e.target.value; }}
                    placeholder="e.g. I run a gym and want to track members, plans and attendance"
                    rows={2}
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none resize-none ${t.textareaCls}`}
                  />
                </div>
              )}

              {/* Drop zone */}
              <div
                className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-colors cursor-pointer py-8 ${
                  isDragging ? 'border-violet-500 bg-violet-600/10' : 'hover:border-violet-500/50 hover:bg-violet-600/5'
                }`}
                style={{ borderColor: isDragging ? undefined : t.border2 }}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: t.bg2, border: `1px solid ${t.border}` }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
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
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: t.bg2, border: `1px solid ${t.border}` }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" className="shrink-0">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span className="flex-1 text-xs font-mono truncate" style={{ color: t.text2 }}>{f.file.name}</span>
                      <FileStatusBadge status={f.status} />
                      {f.status === 'error' && (
                        <button onClick={() => retryFile(i)} className="text-[10px] text-violet-400 hover:text-violet-300 underline ml-1">Retry</button>
                      )}
                      {f.status !== 'analyzing' && f.status !== 'importing' && (
                        <button onClick={() => removeFile(i)} className="w-5 h-5 flex items-center justify-center rounded" style={{ color: t.text4 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {globalError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{globalError}</p>}
            </div>
          )}

          {/* ── REVIEW STEP ── */}
          {step === 'review' && (
            <div className="flex flex-col gap-0">
              {/* File tabs */}
              <div className="flex items-center gap-1 px-4 pt-3 overflow-x-auto" style={{ borderBottom: `1px solid ${t.border}` }}>
                {files.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveFileIdx(i)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 whitespace-nowrap transition-colors"
                    style={{
                      borderBottomColor: i === activeFileIdx ? '#7c3aed' : 'transparent',
                      color: i === activeFileIdx ? t.text1 : t.text3,
                      background: i === activeFileIdx ? 'rgba(124,58,237,0.08)' : 'transparent',
                    }}
                  >
                    <span className="truncate max-w-[120px]">{f.file.name.replace('.csv', '')}</span>
                    <FileStatusBadge status={f.status} />
                  </button>
                ))}
              </div>

              {activeFile && (
                <div className="px-5 py-4 flex flex-col gap-4">
                  {activeFile.status === 'error' && (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                      <p className="text-xs text-red-400">{activeFile.error}</p>
                      <button onClick={() => retryFile(activeFileIdx)} className="text-xs text-violet-400 hover:text-violet-300 underline ml-3 shrink-0">Retry</button>
                    </div>
                  )}

                  {activeFile.status === 'analyzing' && (
                    <div className="flex items-center gap-2.5 py-6 justify-center text-sm" style={{ color: t.text2 }}>
                      <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                      Analyzing with AI…
                    </div>
                  )}

                  {(activeFile.status === 'ready' || activeFile.status === 'done') && activeFile.analysis?.flow === 'new' && (
                    <>
                      <div>
                        <p className="text-xs uppercase tracking-wide mb-1.5" style={{ color: t.text3 }}>Table name</p>
                        <input
                          value={activeFile.tableName ?? activeFile.analysis.tableName}
                          onChange={(e) => updateTableName(activeFileIdx, e.target.value)}
                          className={`w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none ${t.inputCls}`}
                        />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide mb-2" style={{ color: t.text3 }}>Column mapping</p>
                        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
                          <table className="w-full text-xs">
                            <thead>
                              <tr style={{ borderBottom: `1px solid ${t.border}`, background: t.bg2 }}>
                                <th className="text-left px-3 py-2 font-medium" style={{ color: t.text3 }}>CSV header</th>
                                <th className="text-left px-3 py-2 font-medium" style={{ color: t.text3 }}>Column name</th>
                                <th className="text-left px-3 py-2 font-medium" style={{ color: t.text3 }}>PG type</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(activeFile.columns ?? activeFile.analysis.columns).map((col, i) => (
                                <tr key={i} style={{ borderBottom: `1px solid ${t.border}` }}>
                                  <td className="px-3 py-2 font-mono" style={{ color: t.text2 }}>{col.csvHeader}</td>
                                  <td className="px-3 py-2">
                                    <input
                                      value={col.pgName}
                                      onChange={(e) => updateColumn(activeFileIdx, i, 'pgName', e.target.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase())}
                                      className="w-full bg-transparent font-mono focus:outline-none rounded px-1 py-0.5 border border-transparent focus:border-violet-500/40"
                                      style={{ color: t.text1 }}
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <select
                                      value={col.pgType}
                                      onChange={(e) => updateColumn(activeFileIdx, i, 'pgType', e.target.value)}
                                      className={`rounded px-1.5 py-0.5 text-xs border focus:outline-none ${t.selectCls}`}
                                    >
                                      {PG_TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
                                    </select>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-xs mt-2" style={{ color: t.text4 }}>{activeFile.analysis.rows.length} rows</p>
                      </div>
                    </>
                  )}

                  {(activeFile.status === 'ready' || activeFile.status === 'done') && activeFile.analysis?.flow === 'existing' && (
                    <>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: t.bg2, border: `1px solid ${t.border2}` }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
                        </svg>
                        <span className="text-xs font-mono" style={{ color: t.text2 }}>{stripPrefix(activeFile.analysis.tableName)}</span>
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
                              {(activeFile.mapping ?? activeFile.analysis.mapping).map((m, i) => (
                                <tr key={i} style={{ borderBottom: `1px solid ${t.border}`, background: m.tableColumn === null ? 'rgba(245,158,11,0.05)' : undefined }}>
                                  <td className="px-3 py-2 font-mono" style={{ color: m.tableColumn === null ? '#f59e0b' : t.text2 }}>{m.csvHeader}</td>
                                  <td className="px-3 py-2">
                                    <MappingSelect
                                      value={m.tableColumn}
                                      tableName={activeFile.analysis?.tableName ?? ''}
                                      onChange={(v) => updateMapping(activeFileIdx, i, v)}
                                      t={t}
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-xs mt-2" style={{ color: t.text4 }}>{activeFile.analysis.rows.length} rows</p>
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
              <div className="text-xs" style={{ color: t.text4 }}>
                {files.length === 0 ? 'No files added yet' : `${files.filter(f => f.status === 'ready').length} / ${files.length} ready`}
              </div>
              <button
                onClick={goToReview}
                disabled={!hasReady}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
              >
                Review &amp; Import
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-black/5"
                style={{ color: t.text2, border: `1px solid ${t.border2}` }}
              >
                Back
              </button>
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: t.text4 }}>
                  {files.filter(f => f.status === 'done').length} / {files.filter(f => f.status === 'ready' || f.status === 'done').length} imported
                </span>
                <button
                  onClick={handleImportAll}
                  disabled={!hasReady || files.every((f) => f.status === 'done' || f.status === 'importing')}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
                >
                  {files.some((f) => f.status === 'importing') ? (
                    <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Importing…</>
                  ) : allReady ? (
                    <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg> Import All</>
                  ) : 'Import All'}
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

function MappingSelect({ value, tableName, onChange, t }: {
  value: string | null;
  tableName: string;
  onChange: (v: string | null) => void;
  t: ThemeVars;
}) {
  const [cols, setCols] = useState<string[]>([]);
  useEffect(() => {
    api.getSchema(tableName).then((schema) => {
      const names = schema.columns
        .map((c) => c.column_name)
        .filter((n) => n !== 'id' && n !== 'created_at' && n !== 'updated_at');
      setCols(names);
    }).catch(() => {});
  }, [tableName]);

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={`rounded px-1.5 py-0.5 text-xs border focus:outline-none min-w-[120px] ${t.selectCls}`}
    >
      <option value="">— skip —</option>
      {cols.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}
