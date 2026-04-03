'use client';

import { useState } from 'react';
import type { ChatResponse, Column } from '@/types';

interface Props {
  response: ChatResponse;
  onConfirm: () => void;
  onDiscard: () => void;
  onRefine: (text: string) => void;
  isSending: boolean;
}

function ColBadge({ col }: { col: Column }) {
  const isPk = col.name === 'id';
  const isFk = col.name.endsWith('_id');
  return (
    <div className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-white/3 transition-colors group">
      <span className={`font-mono text-[10px] ${isPk ? 'text-amber-400' : isFk ? 'text-sky-400' : 'text-zinc-300'}`}>
        {col.name}
      </span>
      {isPk && (
        <span className="text-[8px] px-1 rounded bg-amber-500/15 text-amber-400/80 border border-amber-500/20">PK</span>
      )}
      {isFk && !isPk && (
        <span className="text-[8px] px-1 rounded bg-sky-500/15 text-sky-400/80 border border-sky-500/20">FK</span>
      )}
      <span className="ml-auto text-[9px] text-zinc-600 font-mono uppercase tracking-wide">{col.type}</span>
      {col.nullable && (
        <span className="text-[8px] text-zinc-700">null</span>
      )}
    </div>
  );
}

function TablePreview({ tableName, columns }: { tableName: string; columns: Column[] }) {
  const display = tableName.replace(/^s\d+_/, '');
  return (
    <div className="rounded-xl border border-[#242438] bg-[#0f0f1a] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1e1e2e] bg-[#13131f]">
        <div className="w-2 h-2 rounded-sm bg-violet-500/60" />
        <span className="text-[11px] font-semibold text-zinc-200 tracking-tight">{display}</span>
        <span className="ml-auto text-[9px] text-zinc-600">{columns.length} cols</span>
      </div>
      <div className="px-1 py-1 max-h-[140px] overflow-y-auto scrollbar-thin">
        {columns.map((col) => (
          <ColBadge key={col.name} col={col} />
        ))}
      </div>
    </div>
  );
}

export function ConfirmActionModal({ response, onConfirm, onDiscard, onRefine, isSending }: Props) {
  const [refineText, setRefineText] = useState('');
  const [showSql, setShowSql] = useState(false);

  const tables: Array<{ tableName: string; columns: Column[] }> = [];
  if (response.action === 'create' && response.schema) {
    tables.push(response.schema);
  } else if (response.action === 'create_many' && response.schemas) {
    tables.push(...response.schemas);
  } else if (response.action === 'alter' && response.schema) {
    tables.push(response.schema);
  }

  const relations = response.relations ?? [];
  const isAlter = response.action === 'alter';

  const actionLabel = isAlter
    ? 'Alter module'
    : tables.length > 1
    ? `Create ${tables.length} modules`
    : 'Create module';

  const handleRefine = () => {
    const text = refineText.trim();
    if (!text || isSending) return;
    setRefineText('');
    onRefine(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-[248px] px-4 pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-[540px] rounded-2xl border border-violet-500/20 bg-[#0d0d14]/98 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.6),0_0_0_1px_rgba(124,58,237,0.08)] animate-fade-in overflow-hidden"
        style={{ animationDuration: '0.18s' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1a1a2a]">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <span className="text-[11px] font-semibold text-zinc-200 tracking-tight">Review AI changes</span>
          </div>
          <span className="ml-auto text-[10px] text-violet-400/70 font-medium">{actionLabel}</span>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-3 max-h-[320px] overflow-y-auto scrollbar-thin">
          {/* Tables */}
          <div className={`grid gap-2 ${tables.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {tables.map((t) => (
              <TablePreview key={t.tableName} tableName={t.tableName} columns={t.columns} />
            ))}
          </div>

          {/* Relations */}
          {relations.length > 0 && (
            <div className="rounded-xl border border-sky-500/15 bg-sky-500/4 px-3 py-2">
              <p className="text-[9px] text-sky-400/60 uppercase tracking-widest font-semibold mb-1.5">Relations</p>
              <div className="flex flex-col gap-1">
                {relations.map((r, i) => {
                  const fromDisplay = r.from.replace(/^s\d+_/, '');
                  const toDisplay = r.to.replace(/^s\d+_/, '');
                  return (
                    <div key={i} className="flex items-center gap-1.5 text-[10px]">
                      <span className="text-sky-300 font-mono">{fromDisplay}</span>
                      <span className="text-zinc-600">·</span>
                      <span className="font-mono text-zinc-500">{r.on}</span>
                      <svg width="12" height="8" viewBox="0 0 12 8" fill="none" className="text-zinc-600">
                        <path d="M0 4h10M7 1l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="text-sky-300 font-mono">{toDisplay}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SQL toggle */}
          {response.sql && (
            <div>
              <button
                onClick={() => setShowSql((v) => !v)}
                className="flex items-center gap-1.5 text-[9px] text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  style={{ transform: showSql ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                  <path d="M9 18l6-6-6-6" />
                </svg>
                <span className="font-mono uppercase tracking-wide">SQL</span>
              </button>
              {showSql && (
                <pre className="mt-1.5 px-3 py-2 rounded-lg bg-[#0a0a10] border border-[#1a1a24] text-[9px] font-mono text-zinc-500 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {response.sql}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Refine input */}
        <div className="px-4 pb-3 pt-1">
          <div className="flex items-center gap-2 bg-[#0f0f18] border border-[#1e1e2e] rounded-xl px-3 py-2 focus-within:border-violet-500/30 transition-colors">
            <input
              type="text"
              value={refineText}
              onChange={(e) => setRefineText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRefine(); }}
              placeholder="Suggest a change instead…"
              className="flex-1 bg-transparent text-[11px] text-zinc-300 placeholder-zinc-700 focus:outline-none"
              disabled={isSending}
            />
            <button
              onClick={handleRefine}
              disabled={!refineText.trim() || isSending}
              className="shrink-0 text-[10px] px-2 py-1 rounded-lg bg-violet-500/15 text-violet-400 border border-violet-500/20 hover:bg-violet-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-medium"
            >
              Refine
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-4 pb-4 pt-1">
          <button
            onClick={onDiscard}
            disabled={isSending}
            className="flex-1 py-2 rounded-xl text-[11px] font-medium text-zinc-500 border border-[#1e1e2e] hover:border-[#2a2a3a] hover:text-zinc-400 disabled:opacity-30 transition-all"
          >
            Discard
          </button>
          <button
            onClick={onConfirm}
            disabled={isSending}
            className="flex-[2] py-2 rounded-xl text-[11px] font-semibold text-white bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 disabled:opacity-30 shadow-[0_2px_8px_rgba(124,58,237,0.35)] transition-all"
          >
            Apply changes
          </button>
        </div>
      </div>
    </div>
  );
}
