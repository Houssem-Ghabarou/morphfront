'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { TableCard } from '@/components/TableCard';
import { StatCard } from '@/components/StatCard';
import { BarChartCard } from '@/components/BarChartCard';
import { QueryResultCard } from '@/components/QueryResultCard';
import type { TableCardData, VisualCard, Relation } from '@/types';

interface CanvasProps {
  tables: TableCardData[];
  sessionId: number | null;
  onPositionChange: (tableName: string, x: number, y: number) => void;
  isLoading: boolean;
  visualCards: VisualCard[];
  onRemoveVisualCard: (id: string) => void;
  onVisualCardPositionChange: (id: string, x: number, y: number) => void;
  relations?: Relation[];
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 2.5;
const ZERO_OFFSET = { x: 0, y: 0 };

function stripPrefix(name: string) { return name.replace(/^s\d+_/, ''); }
function describe(rel: Relation) {
  const from = stripPrefix(rel.from);
  const to   = stripPrefix(rel.to);
  const col  = rel.on.replace(/_id$/, '');
  return {
    title: `${from} → ${to}`,
    body:  `Each ${from.replace(/s$/, '')} is linked to a ${to.replace(/s$/, '')} via "${col}".`,
  };
}

export function Canvas({ tables, sessionId, onPositionChange, isLoading, visualCards, onRemoveVisualCard, onVisualCardPositionChange, relations = [] }: CanvasProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  /** Click a row in any table to filter descendant tables along FK links (e.g. pick a client → meals / programs). */
  const [selectedRow, setSelectedRow] = useState<{
    tableName: string;
    row: Record<string, unknown>;
  } | null>(null);
  const [showRelations, setShowRelations] = useState(true);
  const [hoveredRel, setHoveredRel] = useState<{ index: number; x: number; y: number } | null>(null);
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
    setSelectedRow(null);
  }, [sessionId]);

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
        {/* FK relation arrows */}
        {relations.length > 0 && showRelations && (
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
          >
            <defs>
              <marker id="fk-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#7c3aed" opacity="0.7" />
              </marker>
              <marker id="fk-arrow-hover" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#a78bfa" opacity="1" />
              </marker>
            </defs>
            {relations.map((rel, i) => {
              const CARD_W = 300;
              const HEADER_H = 20;
              const from = tables.find((t) => t.tableName === rel.from);
              const to   = tables.find((t) => t.tableName === rel.to);
              if (!from || !to) return null;
              const x1 = from.x + CARD_W / 2;
              const y1 = from.y + HEADER_H;
              const x2 = to.x + CARD_W / 2;
              const y2 = to.y + HEADER_H;
              const mx = (x1 + x2) / 2;
              const d  = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
              const isHovered = hoveredRel?.index === i;
              return (
                <g key={i}>
                  {/* Invisible wide hit area */}
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={16}
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                    onMouseEnter={(e) => setHoveredRel({ index: i, x: e.clientX, y: e.clientY })}
                    onMouseMove={(e)  => setHoveredRel({ index: i, x: e.clientX, y: e.clientY })}
                    onMouseLeave={()  => setHoveredRel(null)}
                  />
                  {/* Visible arrow */}
                  <path
                    d={d}
                    fill="none"
                    stroke={isHovered ? '#a78bfa' : '#7c3aed'}
                    strokeWidth={isHovered ? 2.5 : 1.5}
                    strokeOpacity={isHovered ? 0.9 : 0.5}
                    strokeDasharray={isHovered ? '6 3' : '5 4'}
                    markerEnd={isHovered ? 'url(#fk-arrow-hover)' : 'url(#fk-arrow)'}
                    style={{ pointerEvents: 'none', transition: 'stroke 0.15s, stroke-width 0.15s, stroke-opacity 0.15s' }}
                  />
                </g>
              );
            })}
          </svg>
        )}

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
                relations={relations}
                selectedContext={selectedRow}
                onRowSelect={(row) => {
                  if (
                    selectedRow?.tableName === table.tableName &&
                    selectedRow.row.id === row.id
                  ) {
                    setSelectedRow(null);
                  } else {
                    setSelectedRow({ tableName: table.tableName, row });
                  }
                }}
              />
            </div>
          ) : null
        )}
        {visualCards.map((card) => {
          const commonProps = {
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
              {card.type === 'stat' && <StatCard key={card.id} {...commonProps} />}
              {card.type === 'bar' && <BarChartCard key={card.id} {...commonProps} />}
              {card.type === 'table' && <QueryResultCard key={card.id} {...commonProps} />}
            </div>
          );
        })}
      </div>

      {/* Relation hover tooltip */}
      {hoveredRel && relations[hoveredRel.index] && (() => {
        const { title, body } = describe(relations[hoveredRel.index]);
        return (
          <div
            className="fixed z-50 pointer-events-none"
            style={{ left: hoveredRel.x + 14, top: hoveredRel.y - 10 }}
          >
            <div
              className="rounded-xl border border-violet-500/30 shadow-2xl px-3.5 py-2.5"
              style={{ background: '#0f0f13', minWidth: 160, maxWidth: 220 }}
            >
              <p className="text-[11px] font-semibold text-violet-300 font-mono mb-1">{title}</p>
              <p className="text-[11px] text-zinc-400 leading-relaxed">{body}</p>
            </div>
          </div>
        );
      })()}

      {/* Parent row filter — FK-linked tables show only rows for the selected record */}
      {selectedRow && (
        <div className="absolute top-4 left-4 z-40 pointer-events-auto select-none max-w-[min(420px,calc(100%-8rem))]">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-violet-500/35 bg-[#0f0f13]/95 backdrop-blur-sm shadow-lg"
          >
            <div className="w-2 h-2 rounded-full bg-violet-500 shrink-0 animate-pulse" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Filter from parent</p>
              <p className="text-xs text-zinc-200 font-mono truncate">
                {stripPrefix(selectedRow.tableName)}
                {typeof selectedRow.row.name === 'string' && (
                  <span className="text-zinc-400"> · {String(selectedRow.row.name)}</span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedRow(null)}
              className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-white/10 border border-[#2a2a2a] transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Relations toggle — only shown when there are FK relations */}
      {relations.length > 0 && (
        <div className="absolute top-4 right-4 pointer-events-auto select-none">
          <button
            onClick={() => setShowRelations((v) => !v)}
            title={showRelations ? 'Hide relations' : 'Show relations'}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
              showRelations
                ? 'bg-violet-600/20 border-violet-500/40 text-violet-300 hover:bg-violet-600/30'
                : 'bg-[#111] border-[#2a2a2a] text-zinc-500 hover:border-violet-500/30 hover:text-zinc-300'
            }`}
          >
            {/* Link icon */}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span>{showRelations ? 'Relations on' : 'Relations off'}</span>
            {/* Toggle pill */}
            <span
              className={`inline-flex w-7 h-4 rounded-full transition-colors duration-200 relative ${
                showRelations ? 'bg-violet-500' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200 ${
                  showRelations ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
              />
            </span>
          </button>
        </div>
      )}

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
