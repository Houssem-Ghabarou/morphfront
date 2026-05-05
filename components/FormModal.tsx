'use client';

import { useState, useEffect, useRef, useLayoutEffect, useMemo, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import type { SchemaColumn, Relation, DataRow } from '@/types';

interface FkOption { value: string | number; label: string }

interface FormModalProps {
  tableName: string;
  columns: SchemaColumn[];
  relations: Relation[];
  /** LLM-detected column → source table mappings for smart dropdowns */
  columnSources?: Record<string, string>;
  onClose: () => void;
  onSuccess: () => void;
  anchorRect: DOMRect;
  /** When provided, form is in edit mode — pre-filled and calls updateRow */
  editRow?: DataRow;
  moduleLabel?: string;
}

function getInputType(dataType: string): 'text' | 'number' | 'checkbox' | 'date' | 'textarea' {
  const t = dataType.toLowerCase();
  if (t === 'boolean' || t === 'bool') return 'checkbox';
  if (t === 'date') return 'date';
  if (t.includes('timestamp')) return 'date';
  if (t.includes('int') || t.includes('float') || t.includes('numeric') || t.includes('decimal') || t.includes('real') || t.includes('double') || t.includes('serial'))
    return 'number';
  return 'text';
}

/** Normalize any date/datetime string to YYYY-MM-DD for <input type="date"> */
function toDateInputValue(val: string): string {
  if (!val) return '';
  // Already in YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

// ─── Searchable dropdown ──────────────────────────────────────────────────────

function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: FkOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [query, options]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (opt: FkOption) => {
    onChange(String(opt.value));
    setQuery('');
    setOpen(false);
  };

  const clear = () => { onChange(''); setQuery(''); };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center w-full rounded-lg bg-[#13131c] border border-[#1e1e2e] focus-within:border-violet-500/60 focus-within:ring-1 focus-within:ring-violet-500/30 transition-colors overflow-hidden">
        {value ? (
          <div className="flex items-center gap-1.5 flex-1 px-3 py-2">
            <span className="text-xs text-zinc-100 flex-1 truncate">{value}</span>
            <button type="button" onClick={clear} className="text-zinc-600 hover:text-zinc-400 shrink-0">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        ) : (
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder ?? 'Search…'}
            className="flex-1 px-3 py-2 bg-transparent text-zinc-100 text-xs placeholder-zinc-600 focus:outline-none"
          />
        )}
        <button type="button" onClick={() => { if (value) clear(); else setOpen((v) => !v); }}
          className="px-2 text-zinc-600 hover:text-zinc-400 shrink-0">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-[100] mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-[#13131c] border border-[#2a2a3a] shadow-xl">
          {filtered.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); select(opt); }}
              className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-violet-500/10 hover:text-violet-300 transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const SKIP_COLUMNS = new Set(['id', 'created_at', 'updated_at']);
const MODAL_MAX_W = 448;
const MODAL_MIN_W = 280;
const VIEW_MARGIN = 8;

export function FormModal({ tableName, columns, relations, columnSources, onClose, onSuccess, anchorRect, editRow, moduleLabel }: FormModalProps) {
  const isEditing = !!editRow;
  const editableColumns = columns.filter((c) => !SKIP_COLUMNS.has(c.column_name));

  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const init: Record<string, string | boolean> = {};
    for (const col of editableColumns) {
      if (isEditing && editRow) {
        const v = editRow[col.column_name];
        if (getInputType(col.data_type) === 'checkbox') {
          init[col.column_name] = v === true || v === 'true';
        } else {
          init[col.column_name] = v === null || v === undefined ? '' : String(v);
        }
      } else {
        init[col.column_name] = getInputType(col.data_type) === 'checkbox' ? false : '';
      }
    }
    return init;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const [fkOptions, setFkOptions] = useState<Record<string, FkOption[]>>({});

  useEffect(() => { setPortalEl(document.body); }, []);

  useLayoutEffect(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
    const panelW = Math.min(MODAL_MAX_W, Math.max(MODAL_MIN_W, anchorRect.width));
    let left = anchorRect.left + (anchorRect.width - panelW) / 2;
    left = Math.max(VIEW_MARGIN, Math.min(left, vw - panelW - VIEW_MARGIN));
    const gap = 8;
    const maxPanelH = Math.min(vh * 0.65, 560);
    let top = anchorRect.bottom + gap;
    if (top + maxPanelH > vh - VIEW_MARGIN) top = Math.max(VIEW_MARGIN, anchorRect.top - maxPanelH - gap);
    setPanelStyle({ position: 'fixed', top, left, width: panelW, maxHeight: maxPanelH, zIndex: 60 });
  }, [anchorRect]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Load FK options
  useEffect(() => {
    const fkCols = editableColumns.filter((col) =>
      relations.some((rel) => rel.from === tableName && rel.on === col.column_name)
    );
    for (const col of fkCols) {
      const rel = relations.find((r) => r.from === tableName && r.on === col.column_name);
      if (!rel) continue;
      Promise.all([api.getSchema(rel.to), api.getTableData(rel.to)])
        .then(([schema, data]) => {
          const labelCol =
            schema.columns.find((c) => c.column_name !== 'id' && c.column_name !== 'created_at' && (c.data_type.includes('char') || c.data_type.includes('text')))?.column_name ??
            schema.columns.find((c) => c.column_name !== 'id' && c.column_name !== 'created_at')?.column_name;
          const colIsText = col.data_type.includes('char') || col.data_type.includes('text');
          const options: FkOption[] = data.rows.map((row) => {
            const label = labelCol ? String(row[labelCol]) : `#${row.id}`;
            return { value: colIsText ? label : (row.id as number), label };
          });
          setFkOptions((prev) => ({ ...prev, [col.column_name]: options }));
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableName, relations]);

  // LLM-declared column sources: fetch values from the source table and expand comma-separated cells
  useEffect(() => {
    if (!columnSources) return;
    for (const [colName, sourceTable] of Object.entries(columnSources)) {
      api.getTableData(sourceTable)
        .then(({ rows }) => {
          const seen = new Set<string>();
          const options: FkOption[] = [];
          for (const row of rows) {
            for (const val of Object.values(row)) {
              if (val == null || typeof val === 'boolean') continue;
              const str = String(val).trim();
              if (!str) continue;
              const parts = str.includes(',') ? str.split(',').map((p) => p.trim()).filter(Boolean) : [str];
              for (const part of parts) {
                if (!seen.has(part)) {
                  seen.add(part);
                  options.push({ value: part, label: part });
                }
              }
            }
          }
          if (options.length > 0) {
            setFkOptions((prev) => ({ ...prev, [colName]: options }));
          }
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnSources]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      for (const col of editableColumns) {
        const val = values[col.column_name];
        const inputType = getInputType(col.data_type);
        if (inputType === 'number' && typeof val === 'string') {
          payload[col.column_name] = val === '' ? null : Number(val);
        } else if (inputType === 'checkbox') {
          payload[col.column_name] = val;
        } else {
          payload[col.column_name] = val === '' ? null : val;
        }
      }

      if (isEditing && editRow?.id != null) {
        await api.updateRow(tableName, editRow.id as string, payload);
      } else {
        await api.insertRow(tableName, payload);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEditing ? 'update' : 'insert'} record`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayName = moduleLabel ?? tableName.replace(/^s\d+_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const content = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[55] bg-black/70 backdrop-blur-md"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="glass-card rounded-xl shadow-2xl animate-fade-in overflow-hidden flex flex-col"
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 py-4 border-b border-[#1e1e2e]">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              {isEditing ? `Edit ${displayName}` : `New ${displayName}`}
            </h2>
            <p className="text-[10px] text-zinc-600 mt-0.5 font-mono">
              {tableName.replace(/^s\d+_/, '')}
              {isEditing && editRow?.id != null && ` · #${editRow.id}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 px-5 py-4">
          <div className="space-y-3 min-h-0 flex-1 overflow-y-auto scrollbar-thin">
            {editableColumns.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-4">No editable fields found.</p>
            ) : (
              editableColumns.map((col) => {
                const inputType = getInputType(col.data_type);
                const val = values[col.column_name];
                const fkOpts = fkOptions[col.column_name];
                const fieldLabel = col.column_name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

                return (
                  <div key={col.column_name}>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      <span className="text-zinc-200">{fkOpts ? fieldLabel.replace(/ Id$/, '') : fieldLabel}</span>
                      <span className="ml-2 text-[10px] text-zinc-600 font-mono">
                        {fkOpts ? 'pick or type' : col.data_type}
                      </span>
                      {col.is_nullable === 'YES' && <span className="ml-1 text-[10px] text-zinc-700">optional</span>}
                    </label>

                    {fkOpts ? (
                      <SearchableDropdown
                        options={fkOpts}
                        value={val as string}
                        onChange={(v) => setValues((prev) => ({ ...prev, [col.column_name]: v }))}
                        placeholder={`Search ${fieldLabel.toLowerCase()}…`}
                      />
                    ) : inputType === 'checkbox' ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={val as boolean}
                          onChange={(e) => setValues((prev) => ({ ...prev, [col.column_name]: e.target.checked }))}
                          className="w-4 h-4 rounded border-[#333] bg-[#1a1a1a] accent-violet-500"
                        />
                        <span className="text-xs text-zinc-400">{val ? 'true' : 'false'}</span>
                      </div>
                    ) : inputType === 'date' ? (
                      <input
                        type="date"
                        value={toDateInputValue(val as string)}
                        onChange={(e) => setValues((prev) => ({ ...prev, [col.column_name]: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-[#13131c] border border-[#1e1e2e] text-zinc-100 text-xs focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-colors [color-scheme:dark]"
                      />
                    ) : inputType === 'textarea' ? (
                      <textarea
                        value={val as string}
                        onChange={(e) => setValues((prev) => ({ ...prev, [col.column_name]: e.target.value }))}
                        placeholder={col.is_nullable === 'YES' ? 'optional' : `Enter ${fieldLabel.toLowerCase()}…`}
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg bg-[#13131c] border border-[#1e1e2e] text-zinc-100 text-xs placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-colors resize-none"
                      />
                    ) : (
                      <input
                        type={inputType}
                        value={val as string}
                        onChange={(e) => setValues((prev) => ({ ...prev, [col.column_name]: e.target.value }))}
                        placeholder={col.is_nullable === 'YES' ? 'optional' : `Enter ${fieldLabel.toLowerCase()}…`}
                        className="w-full px-3 py-2 rounded-lg bg-[#13131c] border border-[#1e1e2e] text-zinc-100 text-xs placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-colors"
                      />
                    )}
                  </div>
                );
              })
            )}

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 pt-4 mt-2 border-t border-[#222]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              {isSubmitting && <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />}
              {isEditing ? 'Save Changes' : `Add ${displayName}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (!portalEl) return null;
  return createPortal(content, portalEl);
}
