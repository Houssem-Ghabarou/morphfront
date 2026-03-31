'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { FormModal } from '@/components/FormModal';
import type { SchemaColumn, DataRow } from '@/types';

interface TableCardProps {
  tableName: string;
  x: number;
  y: number;
  sessionId: number;
  isNew?: boolean;
  onPositionChange: (tableName: string, x: number, y: number) => void;
  canvasOffset: { x: number; y: number };
  /** CSS transform scale on the canvas layer; drag deltas are divided by this */
  canvasScale?: number;
}

export function TableCard({
  tableName,
  x,
  y,
  sessionId,
  isNew = false,
  onPositionChange,
  canvasOffset,
  canvasScale = 1,
}: TableCardProps) {
  const [columns, setColumns] = useState<SchemaColumn[]>([]);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalAnchor, setModalAnchor] = useState<DOMRect | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });
  const [appeared, setAppeared] = useState(!isNew);

  const dragRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    startCardX: number;
    startCardY: number;
  } | null>(null);

  const positionRef = useRef({ x, y });

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    setPosition({ x, y });
  }, [x, y]);

  useEffect(() => {
    if (isNew) {
      const t = setTimeout(() => setAppeared(true), 50);
      return () => clearTimeout(t);
    }
  }, [isNew]);

  const fetchData = useCallback(async () => {
    try {
      const [schemaData, rowsData] = await Promise.all([
        api.getSchema(tableName),
        api.getTableData(tableName),
      ]);
      setColumns(schemaData.columns);
      setRows(rowsData.rows);
    } catch (err) {
      console.error(`Failed to fetch data for ${tableName}`, err);
    } finally {
      setIsLoading(false);
    }
  }, [tableName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ tableName: string }>).detail;
      if (detail.tableName === tableName) {
        fetchData();
      }
    };
    window.addEventListener('morph:refresh', handler);
    return () => window.removeEventListener('morph:refresh', handler);
  }, [tableName, fetchData]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    dragRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startCardX: positionRef.current.x,
      startCardY: positionRef.current.y,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startMouseX;
      const dy = e.clientY - dragRef.current.startMouseY;
      const s = canvasScale > 0 ? canvasScale : 1;
      setPosition({
        x: dragRef.current.startCardX + dx / s,
        y: dragRef.current.startCardY + dy / s,
      });
    };

    const handleMouseUp = async () => {
      setIsDragging(false);
      const pos = positionRef.current;
      onPositionChange(tableName, pos.x, pos.y);
      try {
        await api.updateTablePosition(sessionId, tableName, pos.x, pos.y);
      } catch (err) {
        console.error('Failed to save position', err);
      }
      dragRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, tableName, sessionId, onPositionChange, canvasScale]);

  const displayColumns = columns.filter(
    (c) => c.column_name !== 'id' && c.column_name !== 'created_at'
  );

  return (
    <>
      <div
        ref={cardRef}
        className={`absolute glass-card rounded-xl overflow-hidden select-none transition-shadow duration-200 ${
          isDragging ? 'shadow-2xl shadow-black/60 z-50' : 'shadow-lg z-10'
        } ${appeared ? 'animate-card-appear' : 'opacity-0'}`}
        style={{
          left: canvasOffset.x + position.x,
          top: canvasOffset.y + position.y,
          minWidth: 280,
          maxWidth: 480,
          width: Math.max(280, displayColumns.length * 80 + 40),
        }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3 border-b border-[#222] drag-handle cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
        >
          <div className="w-5 h-5 rounded flex items-center justify-center bg-violet-600/20 border border-violet-600/30 shrink-0">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 3v18" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-zinc-200 font-mono truncate flex-1">
            {tableName}
          </span>
          <span className="text-[10px] text-zinc-600 shrink-0">
            {rows.length} row{rows.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="overflow-x-auto scrollbar-thin" style={{ maxHeight: 340 }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border border-violet-500/40 border-t-violet-500 rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#0f0f0f]">
                  {displayColumns.map((col) => (
                    <th
                      key={col.column_name}
                      className="text-left px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-[#1e1e1e] whitespace-nowrap"
                    >
                      {col.column_name}
                    </th>
                  ))}
                  {displayColumns.length === 0 && (
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-[#1e1e1e]">
                      (no columns)
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={Math.max(displayColumns.length, 1)}
                      className="px-3 py-4 text-center text-zinc-600 text-[10px]"
                    >
                      No rows yet
                    </td>
                  </tr>
                ) : (
                  rows.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-[#1a1a1a] hover:bg-white/[0.02] transition-colors"
                    >
                      {displayColumns.map((col) => {
                        const val = row[col.column_name];
                        return (
                          <td
                            key={col.column_name}
                            className="px-3 py-2 text-zinc-300 font-mono whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis"
                          >
                            {val === null || val === undefined ? (
                              <span className="text-zinc-700 italic">null</span>
                            ) : typeof val === 'boolean' ? (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                                  val
                                    ? 'bg-green-500/10 text-green-400'
                                    : 'bg-zinc-800 text-zinc-500'
                                }`}
                              >
                                {String(val)}
                              </span>
                            ) : (
                              String(val)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-3 py-2 border-t border-[#1e1e1e]">
          <button
            type="button"
            onClick={() => {
              const el = cardRef.current;
              if (!el) return;
              setModalAnchor(el.getBoundingClientRect());
              setShowModal(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-zinc-400 hover:text-violet-300 hover:bg-violet-500/10 transition-colors w-full"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Row
          </button>
        </div>
      </div>

      {showModal && modalAnchor && (
        <FormModal
          tableName={tableName}
          columns={columns}
          anchorRect={modalAnchor}
          onClose={() => {
            setShowModal(false);
            setModalAnchor(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setModalAnchor(null);
            fetchData();
          }}
        />
      )}
    </>
  );
}
