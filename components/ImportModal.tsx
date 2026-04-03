'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { api, ImportAnalysis, ColumnSuggestion, ColumnMapping } from '@/lib/api';

const PG_TYPES = ['TEXT', 'INTEGER', 'NUMERIC', 'BOOLEAN', 'DATE', 'TIMESTAMP'];

interface ImportModalProps {
  sessionId: number;
  hasExistingTables: boolean;
  onClose: () => void;
  onSuccess: (tableName: string, rowCount: number) => void;
}

function stripPrefix(name: string) {
  return name.replace(/^s\d+_/, '');
}

export function ImportModal({ sessionId, hasExistingTables, onClose, onSuccess }: ImportModalProps) {
  const [step, setStep] = useState<'upload' | 'confirm'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [description, setDescription] = useState('');
  const descriptionRef = useRef('');

  // Editable state for Flow 1
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState<ColumnSuggestion[]>([]);

  // Editable state for Flow 2
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);

  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPortalEl(document.body);
  }, []);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setError('Only CSV files are accepted.');
        return;
      }
      setError(null);
      setIsAnalyzing(true);
      try {
        const result = await api.analyzeCSV(file, sessionId, descriptionRef.current || undefined);
        setAnalysis(result);
        if (result.flow === 'new') {
          setTableName(result.tableName);
          setColumns(result.columns);
        } else {
          setMapping(result.mapping);
        }
        setStep('confirm');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Analysis failed');
      } finally {
        setIsAnalyzing(false);
      }
    },
    [sessionId]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleConfirm = async () => {
    if (!analysis) return;
    setError(null);
    setIsImporting(true);
    try {
      let result;
      if (analysis.flow === 'new') {
        result = await api.confirmImport({
          flow: 'new',
          sessionId,
          tableName,
          columns,
          headers: analysis.headers,
          rows: analysis.rows,
        });
      } else {
        result = await api.confirmImport({
          flow: 'existing',
          tableName: analysis.tableName,
          mapping,
          headers: analysis.headers,
          rows: analysis.rows,
        });
      }
      onSuccess(result.tableName, result.rowsImported);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const updateColumn = (index: number, field: 'pgName' | 'pgType', value: string) => {
    setColumns((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  const updateMapping = (index: number, tableColumn: string | null) => {
    setMapping((prev) => prev.map((m, i) => (i === index ? { ...m, tableColumn } : m)));
  };

  const unmatchedCount = mapping.filter((m) => m.tableColumn === null).length;

  if (!portalEl) return null;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex flex-col rounded-2xl border border-[#26263a] shadow-2xl"
        style={{ background: '#141420', width: 560, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 64px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#26263a]">
          <div className="flex items-center gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="text-sm font-semibold text-zinc-100">Import CSV</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/10 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {step === 'upload' && (
            <div className="flex flex-col gap-4">
              {/* Project description — only shown when canvas is empty (first import) */}
              {!hasExistingTables && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-zinc-500 uppercase tracking-wide">
                    What is this project about?{' '}
                    <span className="normal-case text-zinc-700">(optional — helps Claude name columns better)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); descriptionRef.current = e.target.value; }}
                    placeholder="e.g. I run a gym and want to track members, plans and attendance"
                    rows={2}
                    className="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a28] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-violet-500/60 resize-none leading-relaxed"
                  />
                </div>
              )}

              {/* Drop zone */}
              <div
                className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-colors cursor-pointer py-10 ${
                  isDragging
                    ? 'border-violet-500 bg-violet-600/10'
                    : 'border-[#2a2a3a] hover:border-violet-500/50 hover:bg-violet-600/5'
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-12 h-12 rounded-xl border border-[#2a2a3a] flex items-center justify-center bg-[#1a1a28]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-zinc-300">Drop a CSV file here</p>
                  <p className="text-xs text-zinc-600 mt-0.5">or click to browse · max 10 MB</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {isAnalyzing && (
                <div className="flex items-center justify-center gap-2.5 py-2 text-sm text-zinc-400">
                  <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                  Analyzing with AI…
                </div>
              )}

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>
          )}

          {step === 'confirm' && analysis?.flow === 'new' && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1.5">Table name</p>
                <input
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase())}
                  className="w-full rounded-lg border border-[#2a2a3a] bg-[#1a1a28] px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-violet-500/60"
                />
              </div>

              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Column mapping</p>
                <div className="rounded-xl border border-[#26263a] overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#26263a] bg-[#1a1a28]">
                        <th className="text-left px-3 py-2 text-zinc-500 font-medium">CSV header</th>
                        <th className="text-left px-3 py-2 text-zinc-500 font-medium">Column name</th>
                        <th className="text-left px-3 py-2 text-zinc-500 font-medium">PG type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {columns.map((col, i) => (
                        <tr key={i} className="border-b border-[#1e1e2e] last:border-0">
                          <td className="px-3 py-2 text-zinc-400 font-mono">{col.csvHeader}</td>
                          <td className="px-3 py-2">
                            <input
                              value={col.pgName}
                              onChange={(e) => updateColumn(i, 'pgName', e.target.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase())}
                              className="w-full bg-transparent font-mono text-zinc-200 focus:outline-none focus:bg-[#1a1a28] rounded px-1 py-0.5 border border-transparent focus:border-violet-500/40"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={col.pgType}
                              onChange={(e) => updateColumn(i, 'pgType', e.target.value)}
                              className="bg-[#1a1a28] border border-[#2a2a3a] rounded px-1.5 py-0.5 text-zinc-300 focus:outline-none focus:border-violet-500/60"
                            >
                              {PG_TYPES.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-xs text-zinc-600">{analysis.rows.length} rows will be imported.</p>
              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>
          )}

          {step === 'confirm' && analysis?.flow === 'existing' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#2a2a3a] bg-[#1a1a28]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
                <span className="text-xs text-zinc-300 font-mono">{stripPrefix(analysis.tableName)}</span>
                {unmatchedCount > 0 && (
                  <span className="ml-auto text-xs text-amber-400">{unmatchedCount} unmatched</span>
                )}
              </div>

              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Column mapping</p>
                <div className="rounded-xl border border-[#26263a] overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#26263a] bg-[#1a1a28]">
                        <th className="text-left px-3 py-2 text-zinc-500 font-medium">CSV column</th>
                        <th className="text-left px-3 py-2 text-zinc-500 font-medium">Maps to</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mapping.map((m, i) => {
                        const isUnmatched = m.tableColumn === null;
                        return (
                          <tr
                            key={i}
                            className={`border-b border-[#1e1e2e] last:border-0 ${isUnmatched ? 'bg-amber-500/5' : ''}`}
                          >
                            <td className={`px-3 py-2 font-mono ${isUnmatched ? 'text-amber-400' : 'text-zinc-400'}`}>
                              {m.csvHeader}
                            </td>
                            <td className="px-3 py-2">
                              <MappingSelect
                                value={m.tableColumn}
                                tableName={analysis.tableName}
                                onChange={(v) => updateMapping(i, v)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-xs text-zinc-600">{analysis.rows.length} rows will be imported.</p>
              {unmatchedCount > 0 && (
                <p className="text-xs text-amber-500/80">
                  {unmatchedCount} column{unmatchedCount > 1 ? 's' : ''} won&apos;t be imported (no match). Adjust the mapping above if needed.
                </p>
              )}
              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'confirm' && (
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[#26263a]">
            <button
              onClick={() => { setStep('upload'); setAnalysis(null); setError(null); }}
              className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-[#2a2a3a] transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={isImporting}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            >
              {isImporting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Confirm import
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, portalEl);
}

// Sub-component: dropdown that fetches existing table columns on mount
function MappingSelect({
  value,
  tableName,
  onChange,
}: {
  value: string | null;
  tableName: string;
  onChange: (v: string | null) => void;
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
      className="bg-[#1a1a28] border border-[#2a2a3a] rounded px-1.5 py-0.5 text-zinc-300 text-xs focus:outline-none focus:border-violet-500/60 min-w-[120px]"
    >
      <option value="">— skip —</option>
      {cols.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  );
}
