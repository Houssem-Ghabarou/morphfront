'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import type { SchemaColumn } from '@/types';

interface FormModalProps {
  tableName: string;
  columns: SchemaColumn[];
  onClose: () => void;
  onSuccess: () => void;
}

function getInputType(dataType: string): 'text' | 'number' | 'checkbox' {
  const t = dataType.toLowerCase();
  if (t === 'boolean' || t === 'bool') return 'checkbox';
  if (
    t.includes('int') ||
    t.includes('float') ||
    t.includes('numeric') ||
    t.includes('decimal') ||
    t.includes('real') ||
    t.includes('double') ||
    t.includes('serial')
  )
    return 'number';
  return 'text';
}

const SKIP_COLUMNS = new Set(['id', 'created_at', 'updated_at']);

export function FormModal({ tableName, columns, onClose, onSuccess }: FormModalProps) {
  const editableColumns = columns.filter((c) => !SKIP_COLUMNS.has(c.column_name));
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const init: Record<string, string | boolean> = {};
    for (const col of editableColumns) {
      init[col.column_name] =
        getInputType(col.data_type) === 'checkbox' ? false : '';
    }
    return init;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

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
      await api.insertRow(tableName, payload);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to insert row');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="glass-card rounded-xl w-full max-w-md mx-4 shadow-2xl animate-fade-in overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222]">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Add Row</h2>
            <p className="text-xs text-zinc-500 mt-0.5 font-mono">{tableName}</p>
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

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto scrollbar-thin">
          {editableColumns.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-4">No editable columns found.</p>
          ) : (
            editableColumns.map((col) => {
              const inputType = getInputType(col.data_type);
              const val = values[col.column_name];

              return (
                <div key={col.column_name}>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    <span className="text-zinc-200">{col.column_name}</span>
                    <span className="ml-2 text-[10px] text-zinc-600 font-mono">{col.data_type}</span>
                    {col.is_nullable === 'YES' && (
                      <span className="ml-1 text-[10px] text-zinc-700">nullable</span>
                    )}
                  </label>

                  {inputType === 'checkbox' ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={val as boolean}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            [col.column_name]: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 rounded border-[#333] bg-[#1a1a1a] accent-violet-500"
                      />
                      <span className="text-xs text-zinc-400">{val ? 'true' : 'false'}</span>
                    </div>
                  ) : (
                    <input
                      type={inputType}
                      value={val as string}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [col.column_name]: e.target.value,
                        }))
                      }
                      placeholder={
                        col.is_nullable === 'YES' ? 'null' : `Enter ${col.column_name}…`
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-zinc-100 text-xs placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-colors"
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
        </form>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#222]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            {isSubmitting && (
              <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
            )}
            Insert Row
          </button>
        </div>
      </div>
    </div>
  );
}
