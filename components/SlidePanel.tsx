'use client';

import { useState, useEffect } from 'react';
import type { Column } from '@/types';

interface SlidePanelProps {
  tableName: string;
  columns: Column[];
  prefillValues: Record<string, unknown>;
  sessionTables: string[];
  onConfirm: (tableName: string, values: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

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

export function SlidePanel({
  tableName,
  columns,
  prefillValues,
  onConfirm,
  onCancel,
}: SlidePanelProps) {
  const userColumns = columns.filter(
    (c) => c.name !== 'id' && c.name !== 'created_at' && c.name !== 'updated_at'
  );

  const [formValues, setFormValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const col of userColumns) {
      const prefill = prefillValues[col.name];
      const inputType = getInputType(col.type);
      if (inputType === 'checkbox') {
        initial[col.name] = prefill === true || prefill === 'true' || prefill === 1;
      } else {
        initial[col.name] = prefill !== undefined && prefill !== '' ? prefill : '';
      }
    }
    return initial;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleFieldChange = (colName: string, inputType: ReturnType<typeof getInputType>, value: string | boolean) => {
    setFormValues((prev) => ({
      ...prev,
      [colName]: inputType === 'number' || inputType === 'number-int'
        ? value === '' ? '' : Number(value)
        : value,
    }));
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm(tableName, formValues);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed right-0 top-0 h-screen z-50 flex flex-col"
      style={{
        width: 380,
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
          <span className="text-sm font-medium text-zinc-200">{tableName}</span>
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
          Review and confirm — the form is pre-filled from your message.
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {userColumns.map((col) => {
          const inputType = getInputType(col.type);
          const isForeignKey = col.name.endsWith('_id');
          const value = formValues[col.name];

          return (
            <div key={col.name}>
              <label className="block text-[11px] text-zinc-500 uppercase tracking-wider font-medium mb-1">
                {col.name.replace(/_/g, ' ')}
                <span className="ml-1.5 text-zinc-700 normal-case tracking-normal font-normal">
                  {col.type.toLowerCase()}
                  {!col.nullable && ' · required'}
                </span>
              </label>

              {inputType === 'checkbox' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(e) => handleFieldChange(col.name, inputType, e.target.checked)}
                    className="w-4 h-4 rounded accent-violet-500"
                  />
                  <span className="text-xs text-zinc-400">{value ? 'true' : 'false'}</span>
                </div>
              ) : (
                <input
                  type={inputType === 'number-int' ? 'number' : inputType}
                  step={inputType === 'number-int' ? '1' : inputType === 'number' ? 'any' : undefined}
                  value={value as string | number}
                  onChange={(e) => handleFieldChange(col.name, inputType, e.target.value)}
                  className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-violet-500/50 focus:outline-none w-full"
                  placeholder={isForeignKey ? 'Enter ID' : ''}
                />
              )}

              {isForeignKey && (
                <p className="mt-1 text-[10px] text-zinc-600">
                  Foreign key — enter the ID manually
                </p>
              )}
            </div>
          );
        })}
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
