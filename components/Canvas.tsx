'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { TableCard } from '@/components/TableCard';
import { StatCard } from '@/components/StatCard';
import { BarChartCard } from '@/components/BarChartCard';
import { QueryResultCard } from '@/components/QueryResultCard';
import type { TableCardData, VisualCard } from '@/types';

interface CanvasProps {
  tables: TableCardData[];
  sessionId: number | null;
  onPositionChange: (tableName: string, x: number, y: number) => void;
  isLoading: boolean;
  visualCards: VisualCard[];
  onRemoveVisualCard: (id: string) => void;
  onVisualCardPositionChange: (id: string, x: number, y: number) => void;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 2.5;
const ZERO_OFFSET = { x: 0, y: 0 };

export function Canvas({ tables, sessionId, onPositionChange, isLoading, visualCards, onRemoveVisualCard, onVisualCardPositionChange }: CanvasProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const panStart = useRef<{ mouseX: number; mouseY: number; offsetX: number; offsetY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(offset);
  const scaleRef = useRef(scale);
  offsetRef.current = offset;
  scaleRef.current = scale;
  const newTablesRef = useRef<Set<string>>(new Set());
  const prevTableNames = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentNames = new Set(tables.map((t) => t.tableName));
    const added = new Set<string>();
    for (const name of currentNames) {
      if (!prevTableNames.current.has(name)) {
        added.add(name);
      }
    }
    prevTableNames.current = currentNames;
    if (added.size > 0) {
      newTablesRef.current = new Set([...newTablesRef.current, ...added]);
      const timer = setTimeout(() => {
        newTablesRef.current = new Set();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [tables]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const isMiddle = e.button === 1;
      const isLeftWithSpace = e.button === 0 && spaceDown;
      if (!isMiddle && !isLeftWithSpace) return;
      e.preventDefault();
      panStart.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        offsetX: offset.x,
        offsetY: offset.y,
      };
      setIsPanning(true);
    },
    [offset, spaceDown]
  );

  useEffect(() => {
    if (!isPanning) return;

    const move = (e: MouseEvent) => {
      if (!panStart.current) return;
      setOffset({
        x: panStart.current.offsetX + (e.clientX - panStart.current.mouseX),
        y: panStart.current.offsetY + (e.clientY - panStart.current.mouseY),
      });
    };

    const up = () => {
      setIsPanning(false);
      panStart.current = null;
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [isPanning]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const prevScale = scaleRef.current;
      const prevOffset = offsetRef.current;
      const zoomFactor = Math.exp(-e.deltaY * 0.0012);
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prevScale * zoomFactor));
      if (newScale === prevScale) return;

      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cx = (mx - prevOffset.x) / prevScale;
      const cy = (my - prevOffset.y) / prevScale;

      setScale(newScale);
      setOffset({
        x: mx - newScale * cx,
        y: my - newScale * cy,
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const cursor = isPanning ? 'cursor-grabbing' : spaceDown ? 'cursor-grab' : 'cursor-default';

  return (
    <div
      ref={canvasRef}
      className={`flex-1 relative overflow-hidden canvas-bg ${cursor}`}
      style={{ touchAction: 'none' }}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            <p className="text-xs text-zinc-600">Loading session…</p>
          </div>
        </div>
      ) : tables.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#111] border border-[#1e1e1e] flex items-center justify-center shadow-xl">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3f3f46" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">Your canvas is empty</p>
              <p className="text-xs text-zinc-700 mt-1">
                Type a prompt below to create your first table
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-700 bg-[#111] border border-[#1e1e1e] rounded-lg px-4 py-2">
              <span className="font-mono text-violet-500/70">Try:</span>
              <span className="italic">&ldquo;Create a customers table with name, email and plan&rdquo;</span>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className="absolute inset-0"
        style={{
          pointerEvents: 'none',
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        {tables.map((table) =>
          sessionId ? (
            <div key={table.tableName} style={{ pointerEvents: 'auto' }}>
              <TableCard
                tableName={table.tableName}
                x={table.x}
                y={table.y}
                sessionId={sessionId}
                isNew={newTablesRef.current.has(table.tableName)}
                onPositionChange={onPositionChange}
                canvasOffset={ZERO_OFFSET}
                canvasScale={scale}
              />
            </div>
          ) : null
        )}
        {visualCards.map((card) => {
          const commonProps = {
            key: card.id,
            id: card.id,
            title: card.title,
            rows: card.rows,
            columns: card.columns,
            x: card.x,
            y: card.y,
            canvasOffset: ZERO_OFFSET,
            canvasScale: scale,
            onClose: onRemoveVisualCard,
            onPositionChange: onVisualCardPositionChange,
          };
          return (
            <div key={card.id} style={{ pointerEvents: 'auto' }}>
              {card.type === 'stat' && <StatCard {...commonProps} />}
              {card.type === 'bar' && <BarChartCard {...commonProps} />}
              {card.type === 'table' && <QueryResultCard {...commonProps} />}
            </div>
          );
        })}
      </div>

      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-1 text-[10px] text-zinc-700 select-none pointer-events-none">
        <div className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
          </svg>
          Scroll to zoom · Middle-click or Space+drag to pan
        </div>
        <span className="font-mono text-zinc-600">{Math.round(scale * 100)}%</span>
      </div>
    </div>
  );
}
