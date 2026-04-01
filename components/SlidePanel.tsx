'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Column, Relation } from '@/types';

export interface SchemaChange {
  action: 'add' | 'rename' | 'retype';
  column: string;
  newName?: string;
  newType?: string;
}

interface SlidePanelProps {
  tableName: string;
  columns: Column[];
  prefillValues: Record<string, unknown>;
  sessionTables: string[];
  relations: Relation[];
  onConfirm: (
    tableName: string,
    values: Record<string, unknown>,
    schemaChanges: SchemaChange[]
  ) => Promise<void>;
  onCancel: () => void;
}

const PG_TYPES = ['text', 'integer', 'numeric', 'boolean', 'date', 'timestamp'] as const;

function getInputType(dataType: string): 'text' | 'number' | 'number-int' | 'checkbox' | 'date' | 'datetime-local' {
  const t = dataType.toUpperCase();
  if (t.includes('INT') || t === 'BIGINT' || t === 'SMALLINT') return 'number-int';
  if (t.includes('NUMERIC') || t.includes('DECIMAL') || t.includes('REAL') ||
      t.includes('DOUBLE') || t.includes('FLOAT')) return 'number';
  if (t === 'BOOLEAN') return 'checkbox';
  if (t === 'DATE') return 'date';
  if (t.includes('TIMESTAMP')) return 'datetime-local';
  return 'text';
}

function toSnakeCase(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

interface EditableColumn {
  id: string;
  originalName: string | null;
  name: string;
  type: string;
  value: unknown;
  isNew: boolean;
  originalType?: string;
}

interface FkOption { value: string | number; label: string }

export function SlidePanel({
  tableName,
  columns,
  prefillValues,
  relations,
  onConfirm,
  onCancel,
}: SlidePanelProps) {
  const userColumns = columns.filter(
    (c) => c.name !== 'id' && c.name !== 'created_at' && c.name !== 'updated_at'
  );

  const [editableCols, setEditableCols] = useState<EditableColumn[]>(() =>
    userColumns.map((col) => {
      const inputType = getInputType(col.type);
      const prefill = prefillValues[col.name];
      let value: unknown;
      if (inputType === 'checkbox') {
        value = prefill === true || prefill === 'true' || prefill === 1;
      } else {
        value = prefill !== undefined && prefill !== '' ? prefill : '';
      }
      return {
        id: `orig-${col.name}`,
        originalName: col.name,
        name: col.name,
        type: normalizeType(col.type),
        value,
        isNew: false,
        originalType: normalizeType(col.type),
      };
    })
  );

  const [isLoading, setIsLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [fkOptions, setFkOptions] = useState<Record<string, FkOption[]>>({});

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const fkCols = userColumns.filter((col) =>
      relations.some((rel) => rel.from === tableName && rel.on === col.name)
    );
    for (const col of fkCols) {
      const rel = relations.find((r) => r.from === tableName && r.on === col.name);
      if (!rel) continue;
      const refTable = rel.to;
      Promise.all([api.getSchema(refTable), api.getTableData(refTable)])
        .then(([schema, data]) => {
          const labelCol =
            schema.columns.find(
              (c) =>
                c.column_name !== 'id' &&
                c.column_name !== 'created_at' &&
                (c.data_type.includes('char') || c.data_type.includes('text'))
            )?.column_name ??
            schema.columns.find(
              (c) => c.column_name !== 'id' && c.column_name !== 'created_at'
            )?.column_name;
          const colIsText = getInputType(col.type) === 'text';
          const options: FkOption[] = data.rows.map((row) => {
            const label = labelCol ? String(row[labelCol]) : `#${row.id}`;
            return { value: colIsText ? label : (row.id as number), label };
          });
          setFkOptions((prev) => ({ ...prev, [col.name]: options }));
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableName, relations]);

  const updateCol = useCallback((id: string, patch: Partial<EditableColumn>) => {
    setEditableCols((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const handleValueChange = useCallback((id: string, type: string, val: string | boolean) => {
    const inputType = getInputType(type);
    const parsed = (inputType === 'number' || inputType === 'number-int')
      ? (val === '' ? '' : Number(val))
      : val;
    updateCol(id, { value: parsed });
  }, [updateCol]);

  const addColumn = useCallback(() => {
    const newId = `new-${Date.now()}`;
    setEditableCols((prev) => [
      ...prev,
      { id: newId, originalName: null, name: '', type: 'text', value: '', isNew: true },
    ]);
  }, []);

  const removeColumn = useCallback((id: string) => {
    setEditableCols((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      const changes: SchemaChange[] = [];
      const row: Record<string, unknown> = {};

      for (const col of editableCols) {
        const sanitizedName = toSnakeCase(col.name);
        if (!sanitizedName) continue;

        if (col.isNew) {
          changes.push({ action: 'add', column: sanitizedName, newType: col.type });
        } else if (col.originalName && sanitizedName !== col.originalName) {
          changes.push({ action: 'rename', column: col.originalName, newName: sanitizedName });
        }

        if (!col.isNew && col.originalType && col.type !== col.originalType) {
          const nameForRetype = col.originalName && sanitizedName !== col.originalName
            ? sanitizedName
            : (col.originalName ?? sanitizedName);
          changes.push({ action: 'retype', column: nameForRetype, newType: col.type });
        }

        const inputType = getInputType(col.type);
        if ((inputType === 'number' || inputType === 'number-int') && col.value === '') {
          row[sanitizedName] = null;
        } else {
          row[sanitizedName] = col.value;
        }
      }

      await onConfirm(tableName, row, changes);
    } finally {
      setIsLoading(false);
    }
  };

  const wasModified = (col: EditableColumn) =>
    !col.isNew && (
      (col.originalName !== null && toSnakeCase(col.name) !== col.originalName) ||
      (col.originalType !== undefined && col.type !== col.originalType)
    );

  return (
    <div
      className="fixed right-0 top-0 h-screen z-50 flex flex-col"
      style={{
        width: 420,
        background: '#111',
        borderLeft: '1px solid #222',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e1e] shrink-0">
        <div className="flex items-center gap-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.8">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
          <span className="text-sm font-medium text-zinc-200">{tableName.replace(/^s\d+_/, '')}</span>
        </div>
        <button
          onClick={onCancel}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors text-base leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Subheader */}
      <div className="px-5 py-3 border-b border-[#1a1a1a] shrink-0">
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Review and confirm. You can edit column names, change types, or add new columns.
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {editableCols.map((col) => {
          const inputType = getInputType(col.type);
          const fkOpts = col.originalName ? fkOptions[col.originalName] : undefined;
          const modified = wasModified(col);

          return (
            <div
              key={col.id}
              className="rounded-lg border p-3 space-y-2"
              style={{
                borderColor: col.isNew ? 'rgba(139,92,246,0.35)' : modified ? 'rgba(245,158,11,0.3)' : '#1e1e1e',
                background: col.isNew ? 'rgba(139,92,246,0.04)' : '#0d0d0d',
              }}
            >
              {/* Column header row: name + type + badges + delete */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={col.name}
                  onChange={(e) => updateCol(col.id, { name: e.target.value })}
                  onBlur={(e) => updateCol(col.id, { name: toSnakeCase(e.target.value) })}
                  placeholder="column_name"
                  className="flex-1 bg-transparent border-b border-[#2a2a2a] focus:border-violet-500/50 text-xs text-zinc-200 font-mono px-1 py-1 focus:outline-none min-w-0"
                />
                <select
                  value={col.type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    updateCol(col.id, { type: newType });
                    if (getInputType(newType) === 'checkbox') {
                      updateCol(col.id, { type: newType, value: false });
                    } else if (col.value === true || col.value === false) {
                      updateCol(col.id, { type: newType, value: '' });
                    }
                  }}
                  className="bg-[#0a0a0a] border border-[#2a2a2a] rounded px-1.5 py-1 text-[10px] text-zinc-400 focus:border-violet-500/50 focus:outline-none shrink-0"
                >
                  {PG_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {col.isNew && (
                  <span className="text-[9px] text-violet-400 bg-violet-500/15 px-1.5 py-0.5 rounded font-medium shrink-0">new</span>
                )}
                {modified && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Modified" />
                )}
                {col.isNew && (
                  <button
                    onClick={() => removeColumn(col.id)}
                    className="w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 text-xs"
                    title="Remove column"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Value input */}
              <div>
                {fkOpts ? (
                  <select
                    value={col.value as string | number}
                    onChange={(e) => handleValueChange(col.id, col.type, e.target.value)}
                    className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-violet-500/50 focus:outline-none w-full"
                  >
                    <option value="">— select —</option>
                    {fkOpts.map((opt) => (
                      <option key={String(opt.value)} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : inputType === 'checkbox' ? (
                  <div className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      checked={Boolean(col.value)}
                      onChange={(e) => handleValueChange(col.id, col.type, e.target.checked)}
                      className="w-4 h-4 rounded accent-violet-500"
                    />
                    <span className="text-xs text-zinc-400">{col.value ? 'true' : 'false'}</span>
                  </div>
                ) : (
                  <input
                    type={inputType === 'number-int' ? 'number' : inputType}
                    step={inputType === 'number-int' ? '1' : inputType === 'number' ? 'any' : undefined}
                    value={col.value as string | number}
                    onChange={(e) => handleValueChange(col.id, col.type, e.target.value)}
                    placeholder="value"
                    className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-violet-500/50 focus:outline-none w-full"
                  />
                )}
              </div>
            </div>
          );
        })}

        {/* Add column button */}
        <button
          onClick={addColumn}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed border-[#2a2a2a] text-xs text-zinc-500 hover:text-violet-400 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Column
        </button>
      </div>

      {/* Footer buttons */}
      <div className="px-5 py-4 border-t border-[#1e1e1e] flex gap-3 shrink-0">
        <button
          onClick={handleConfirm}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
        >
          {isLoading ? (
            <div className="w-4 h-4 border border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            'Confirm & Insert'
          )}
        </button>
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 py-2 rounded-lg border border-[#2a2a2a] text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:border-[#3a3a3a] disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function normalizeType(pgType: string): string {
  const t = pgType.toLowerCase();
  if (t.includes('int')) return 'integer';
  if (t.includes('numeric') || t.includes('decimal') || t.includes('real') ||
      t.includes('double') || t.includes('float')) return 'numeric';
  if (t.includes('bool')) return 'boolean';
  if (t.includes('timestamp')) return 'timestamp';
  if (t === 'date') return 'date';
  return 'text';
}
