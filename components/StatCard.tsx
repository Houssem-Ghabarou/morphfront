'use client';

import { useState, useEffect, useRef } from 'react';

interface StatCardProps {
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

export function StatCard({
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
}: StatCardProps) {
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
      const s = canvasScale > 0 ? canvasScale : 1;
      const newPos = {
        x: dragRef.current.startCardX + dx / s,
        y: dragRef.current.startCardY + dy / s,
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

  const firstRow = rows[0] ?? {};
  const valueCol = columns[0] ?? '';
  const value = firstRow[valueCol];
  const label = valueCol.replace(/_/g, ' ');

  return (
    <div
      className={`absolute select-none ${appeared ? 'animate-card-appear' : 'opacity-0'} ${isDragging ? 'z-50' : 'z-10'}`}
      style={{
        left: canvasOffset.x + position.x,
        top: canvasOffset.y + position.y,
        width: 200,
      }}
    >
      <div
        className="bg-[#141414] border border-[#222] rounded-xl overflow-hidden shadow-lg border-t-2 border-t-violet-500"
        style={{ borderTopColor: '#7c3aed' }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 border-b border-[#222] drag-handle cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" className="shrink-0">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
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

        {/* Body */}
        <div className="px-4 py-4 flex flex-col gap-1">
          <span className="text-3xl font-bold text-white leading-none">
            {value === null || value === undefined ? '—' : String(value)}
          </span>
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider capitalize">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
