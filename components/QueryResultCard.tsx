'use client';

import { useState, useEffect, useRef } from 'react';

interface QueryResultCardProps {
  id: string;
  title: string;
  rows: Record<string, unknown>[];
  columns: string[];
  x: number;
  y: number;
  canvasOffset: { x: number; y: number };
  canvasScale?: number;
  onClose: (id: string) => void;
  onPositionChange: (id: string, x: number, y: number) => void;
}

export function QueryResultCard({
  id,
  title,
  rows,
  columns,
  x,
  y,
  canvasOffset,
  canvasScale = 1,
  onClose,
  onPositionChange,
}: QueryResultCardProps) {
  const [position, setPosition] = useState({ x, y });
  const [isDragging, setIsDragging] = useState(false);
  const [appeared, setAppeared] = useState(false);

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
    const t = setTimeout(() => setAppeared(true), 10);
    return () => clearTimeout(t);
  }, []);

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
      const newPos = {
        x: dragRef.current.startCardX + dx,
        y: dragRef.current.startCardY + dy,
      };
      setPosition(newPos);
      positionRef.current = newPos;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      const pos = positionRef.current;
      onPositionChange(id, pos.x, pos.y);
      dragRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, id, onPositionChange, canvasScale]);

  const cardWidth = Math.max(360, columns.length * 120);

  return (
    <div
      className={`absolute select-none ${appeared ? 'animate-card-appear' : 'opacity-0'} ${isDragging ? 'z-50' : 'z-10'}`}
      style={{
        left: canvasOffset.x + position.x,
        top: canvasOffset.y + position.y,
        width: Math.min(cardWidth, 640),
      }}
    >
      <div className="bg-[#141414] border border-[#222] rounded-xl overflow-hidden shadow-lg border-t-2" style={{ borderTopColor: '#06b6d4' }}>
        {/* Header */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 border-b border-[#222] drag-handle cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" className="shrink-0">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M3 15h18M9 3v18" />
          </svg>
          <span className="text-[11px] text-zinc-400 truncate flex-1 font-medium">{title}</span>
          <span className="text-[10px] text-cyan-500/60 shrink-0 mr-1">
            {rows.length} row{rows.length !== 1 ? 's' : ''}
          </span>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onClose(id)}
            className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0 text-sm leading-none"
          >
            ×
          </button>
        </div>

        {/* Table */}
        <div className="overflow-auto scrollbar-thin" style={{ maxHeight: 300 }}>
          {rows.length === 0 ? (
            <div className="px-4 py-6 text-center text-[11px] text-zinc-600">
              No results returned.
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#0f0f0f]">
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="text-left px-3 py-2 text-[10px] font-semibold text-cyan-500/70 uppercase tracking-wider border-b border-[#1e1e1e] whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-[#1a1a1a] hover:bg-white/[0.02] transition-colors">
                    {columns.map((col) => {
                      const val = row[col];
                      return (
                        <td
                          key={col}
                          className="px-3 py-2 text-zinc-300 font-mono whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis"
                        >
                          {val === null || val === undefined ? (
                            <span className="text-zinc-700 italic">null</span>
                          ) : (
                            String(val)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
