'use client';

import { useState, useEffect, useRef } from 'react';

interface BarChartCardProps {
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

export function BarChartCard({
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
}: BarChartCardProps) {
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

  // Detect label and value columns
  const firstRow = rows[0] ?? {};
  let labelCol = columns[0] ?? '';
  let valueCol = columns[1] ?? '';

  if (columns.length >= 2) {
    const detectedLabel = columns.find((col) => typeof firstRow[col] !== 'number');
    const detectedValue = columns.find((col) => typeof firstRow[col] === 'number');
    if (detectedLabel) labelCol = detectedLabel;
    if (detectedValue) valueCol = detectedValue;
  }

  const displayRows = rows.slice(0, 8);
  const maxValue = Math.max(...displayRows.map((r) => Number(r[valueCol]) || 0), 1);

  return (
    <div
      className={`absolute select-none ${appeared ? 'animate-card-appear' : 'opacity-0'} ${isDragging ? 'z-50' : 'z-10'}`}
      style={{
        left: canvasOffset.x + position.x,
        top: canvasOffset.y + position.y,
        width: 320,
      }}
    >
      <div className="bg-[#141414] border border-[#222] rounded-xl overflow-hidden shadow-lg">
        {/* Header */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 border-b border-[#222] drag-handle cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" className="shrink-0">
            <rect x="3" y="12" width="4" height="9" rx="1" />
            <rect x="10" y="6" width="4" height="15" rx="1" />
            <rect x="17" y="3" width="4" height="18" rx="1" />
          </svg>
          <span className="text-[11px] text-zinc-400 truncate flex-1 font-medium">{title}</span>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onClose(id)}
            className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0 text-sm leading-none"
          >
            ×
          </button>
        </div>

        {/* Chart */}
        <div className="flex items-end gap-2 px-3 py-4" style={{ height: 160 }}>
          {displayRows.map((row, i) => {
            const val = Number(row[valueCol]) || 0;
            const heightPct = maxValue > 0 ? (val / maxValue) * 100 : 0;
            const heightPx = Math.max(4, (heightPct / 100) * 108);
            const labelVal = String(row[labelCol] ?? '');

            return (
              <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0" style={{ height: '100%', justifyContent: 'flex-end' }}>
                <span className="text-[10px] text-zinc-400 leading-none">{val}</span>
                <div
                  className="bg-violet-500 rounded-t w-full"
                  style={{ height: heightPx }}
                />
                <span className="text-[10px] text-zinc-500 truncate max-w-[60px] text-center w-full">{labelVal}</span>
              </div>
            );
          })}
          {displayRows.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[11px] text-zinc-600">No data</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
