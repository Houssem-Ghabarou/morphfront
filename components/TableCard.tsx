'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { FormModal } from '@/components/FormModal';
import { filterRowsForAncestorSelection } from '@/lib/relationFilter';
import type { SchemaColumn, DataRow, Relation } from '@/types';

export interface RowSelectionContext {
  tableName: string;
  row: Record<string, unknown>;
}

interface TableCardProps {
  tableName: string;
  x: number;
  y: number;
  sessionId: number;
  isNew?: boolean;
  onPositionChange: (tableName: string, x: number, y: number) => void;
  canvasOffset: { x: number; y: number };
  canvasScale?: number;
  relations?: Relation[];
  selectedContext?: RowSelectionContext | null;
  onRowSelect?: (row: Record<string, unknown>) => void;
}

function toModuleLabel(raw: string): string {
  return raw.replace(/^s\d+_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function toSingular(label: string): string {
  if (label.endsWith('ies')) return label.slice(0, -3) + 'y';
  if (label.endsWith('ses') || label.endsWith('xes') || label.endsWith('ches')) return label.slice(0, -2);
  if (label.endsWith('s') && !label.endsWith('ss')) return label.slice(0, -1);
  return label;
}

function ModuleIcon({ name }: { name: string }) {
  const n = name.toLowerCase();
  if (n.includes('client') || n.includes('customer') || n.includes('user') || n.includes('member') || n.includes('student') || n.includes('employee'))
    return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
  if (n.includes('meal') || n.includes('food') || n.includes('nutrition') || n.includes('calori') || n.includes('diet'))
    return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>;
  if (n.includes('order') || n.includes('sale') || n.includes('invoice') || n.includes('payment'))
    return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>;
  if (n.includes('product') || n.includes('inventory') || n.includes('stock') || n.includes('item'))
    return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>;
  if (n.includes('task') || n.includes('todo') || n.includes('project') || n.includes('program') || n.includes('course') || n.includes('assignment'))
    return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>;
}

export function TableCard({
  tableName,
  x,
  y,
  sessionId,
  relations = [],
  isNew = false,
  onPositionChange,
  canvasOffset,
  canvasScale = 1,
  selectedContext = null,
  onRowSelect,
}: TableCardProps) {
  const [columns, setColumns] = useState<SchemaColumn[]>([]);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [displayRows, setDisplayRows] = useState<DataRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add / Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingRow, setEditingRow] = useState<DataRow | null>(null);
  const [modalAnchor, setModalAnchor] = useState<DOMRect | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [deletingId, setDeletingId] = useState<unknown>(null);
  const [hoveredRowId, setHoveredRowId] = useState<unknown>(null);
  const [sortState, setSortState] = useState<{ col: string; dir: 'asc' | 'desc' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });
  const [appeared, setAppeared] = useState(!isNew);
  const dragRef = useRef<{ startMouseX: number; startMouseY: number; startCardX: number; startCardY: number } | null>(null);
  const positionRef = useRef({ x, y });

  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { setPosition({ x, y }); }, [x, y]);
  useEffect(() => {
    if (isNew) { const t = setTimeout(() => setAppeared(true), 50); return () => clearTimeout(t); }
  }, [isNew]);

  const fetchData = useCallback(async () => {
    try {
      const [schemaData, rowsData] = await Promise.all([api.getSchema(tableName), api.getTableData(tableName)]);
      setColumns(schemaData.columns);
      setRows(rowsData.rows);
    } catch (err) {
      console.error(`Failed to fetch data for ${tableName}`, err);
    } finally {
      setIsLoading(false);
    }
  }, [tableName]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    let cancelled = false;
    async function applyFilter() {
      if (!selectedContext) { setDisplayRows(rows); return; }
      if (tableName === selectedContext.tableName) { setDisplayRows(rows); return; }
      try {
        const filtered = await filterRowsForAncestorSelection(tableName, rows, selectedContext, relations, (t) => api.getTableData(t));
        if (!cancelled) setDisplayRows(filtered);
      } catch { if (!cancelled) setDisplayRows(rows); }
    }
    applyFilter();
    return () => { cancelled = true; };
  }, [rows, tableName, selectedContext, relations]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ tableName: string }>).detail;
      if (detail.tableName === tableName) fetchData();
    };
    window.addEventListener('morph:refresh', handler);
    return () => window.removeEventListener('morph:refresh', handler);
  }, [tableName, fetchData]);

  // ── Drag ────────────────────────────────────────────────────────────────────

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    dragRef.current = { startMouseX: e.clientX, startMouseY: e.clientY, startCardX: positionRef.current.x, startCardY: positionRef.current.y };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const s = canvasScale > 0 ? canvasScale : 1;
      setPosition({ x: dragRef.current.startCardX + (e.clientX - dragRef.current.startMouseX) / s, y: dragRef.current.startCardY + (e.clientY - dragRef.current.startMouseY) / s });
    };
    const onUp = async () => {
      setIsDragging(false);
      const pos = positionRef.current;
      onPositionChange(tableName, pos.x, pos.y);
      try { await api.updateTablePosition(sessionId, tableName, pos.x, pos.y); } catch { /* ignore */ }
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDragging, tableName, sessionId, onPositionChange, canvasScale]);

  // ── Delete with cascade ──────────────────────────────────────────────────────

  const deleteRow = async (row: DataRow) => {
    const rowId = row.id;
    setDeletingId(rowId);
    try {
      // Find tables that reference this table (children)
      const childRels = relations.filter((r) => r.to === tableName);
      if (childRels.length > 0) {
        // The FK stores the label value of the parent (first text column)
        const labelCol = dataColumns.find(
          (c) => c.data_type.includes('text') || c.data_type.includes('char')
        )?.column_name;
        if (labelCol && row[labelCol] != null) {
          const labelValue = String(row[labelCol]).toLowerCase();
          for (const rel of childRels) {
            try {
              const { rows: childRows } = await api.getTableData(rel.from);
              for (const cr of childRows) {
                if (cr[rel.on] != null && String(cr[rel.on]).toLowerCase() === labelValue) {
                  await api.deleteRow(rel.from, cr.id as string);
                }
              }
              // Notify child card to refresh
              window.dispatchEvent(new CustomEvent('morph:refresh', { detail: { tableName: rel.from } }));
            } catch { /* best effort */ }
          }
        }
      }
      await api.deleteRow(tableName, rowId as string);
      await fetchData();
    } catch (err) {
      console.error('Failed to delete row', err);
    } finally {
      setDeletingId(null);
    }
  };

  // ── CSV export ───────────────────────────────────────────────────────────────

  const exportCSV = () => {
    const cols = dataColumns.map((c) => c.column_name);
    const csv = [
      cols.join(','),
      ...rows.map((row) =>
        cols.map((c) => {
          const v = row[c];
          if (v === null || v === undefined) return '';
          const s = String(v);
          return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(',')
      ),
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${tableName.replace(/^s\d+_/, '')}.csv`;
    a.click();
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const dataColumns = columns.filter((c) => c.column_name !== 'id' && c.column_name !== 'created_at');
  const displayName = tableName.replace(/^s\d+_/, '');
  const moduleLabel = toModuleLabel(displayName);
  const singularLabel = toSingular(moduleLabel);
  const isFiltered = selectedContext && tableName !== selectedContext.tableName && displayRows.length !== rows.length;

  const searchedRows = searchQuery.trim()
    ? displayRows.filter((row) => dataColumns.some((col) => { const v = row[col.column_name]; return v != null && String(v).toLowerCase().includes(searchQuery.toLowerCase()); }))
    : displayRows;

  const sortedRows = sortState
    ? [...searchedRows].sort((a, b) => {
        const aStr = a[sortState.col] == null ? '' : String(a[sortState.col]);
        const bStr = b[sortState.col] == null ? '' : String(b[sortState.col]);
        const n = aStr.localeCompare(bStr, undefined, { numeric: true });
        return sortState.dir === 'asc' ? n : -n;
      })
    : searchedRows;

  const cycleSort = (col: string) => setSortState((prev) => {
    if (!prev || prev.col !== col) return { col, dir: 'asc' };
    if (prev.dir === 'asc') return { col, dir: 'desc' };
    return null;
  });

  const openModal = (row?: DataRow) => {
    const el = cardRef.current;
    if (!el) return;
    setModalAnchor(el.getBoundingClientRect());
    setEditingRow(row ?? null);
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingRow(null); setModalAnchor(null); };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <div
        ref={cardRef}
        className={`absolute select-none transition-shadow duration-200 ${isDragging ? 'shadow-2xl shadow-black/60 z-50' : 'shadow-lg z-10'} ${appeared ? 'animate-card-appear' : 'opacity-0'}`}
        style={{ left: canvasOffset.x + position.x, top: canvasOffset.y + position.y, width: Math.max(280, dataColumns.length * 100 + 60) }}
      >
        <div className="rounded-xl overflow-hidden glass-card border border-[#222]">

          {/* Header */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 cursor-grab active:cursor-grabbing border-b border-[#1e1e1e]" onMouseDown={handleMouseDown}>
            <div className="w-6 h-6 rounded-md flex items-center justify-center bg-violet-600/20 border border-violet-500/25 text-violet-400 shrink-0">
              <ModuleIcon name={displayName} />
            </div>
            <span className="flex-1 text-[12px] font-semibold text-zinc-100 truncate">{moduleLabel}</span>
            <span className="text-[10px] text-zinc-500 shrink-0">
              {isFiltered ? `${sortedRows.length} / ${rows.length}` : sortedRows.length} {rows.length === 1 ? 'record' : 'records'}
            </span>
            <button onClick={(e) => { e.stopPropagation(); setShowSearch((v) => !v); if (showSearch) setSearchQuery(''); }} title="Search"
              className={`shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors ${showSearch ? 'text-violet-400 bg-violet-500/15' : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/5'}`}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </button>
            <button onClick={(e) => { e.stopPropagation(); exportCSV(); }} title="Export CSV"
              className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-400 hover:bg-white/5 transition-colors">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
          </div>

          {/* Search bar */}
          {showSearch && (
            <div className="px-3 py-2 border-b border-[#1e1e1e]">
              <input autoFocus type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${moduleLabel.toLowerCase()}…`}
                className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-violet-500/40 transition-colors"
                onMouseDown={(e) => e.stopPropagation()} />
            </div>
          )}

          {/* Body */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-4 h-4 border border-violet-500/40 border-t-violet-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin" style={{ maxHeight: 340 }}>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0f0f0f]">
                    {dataColumns.map((col) => {
                      const isSorted = sortState?.col === col.column_name;
                      return (
                        <th key={col.column_name} onClick={() => cycleSort(col.column_name)}
                          className="text-left px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-[#1e1e1e] whitespace-nowrap cursor-pointer hover:text-zinc-300 select-none transition-colors">
                          <span className="flex items-center gap-1">
                            {col.column_name.replace(/_/g, ' ')}
                            {isSorted ? (
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-violet-400">
                                {sortState?.dir === 'asc' ? <path d="M12 5v14M5 12l7-7 7 7"/> : <path d="M12 19V5M5 12l7 7 7-7"/>}
                              </svg>
                            ) : (
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-20"><path d="M7 15l5 5 5-5M7 9l5-5 5 5"/></svg>
                            )}
                          </span>
                        </th>
                      );
                    })}
                    {/* Actions column */}
                    <th className="w-14 border-b border-[#1e1e1e]" />
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.length === 0 ? (
                    <tr>
                      <td colSpan={dataColumns.length + 1} className="px-3 py-5 text-center text-zinc-600 text-[10px]">
                        {rows.length === 0 ? `No ${singularLabel.toLowerCase()} records yet` : searchQuery ? 'No records match your search' : 'No records match the selected context'}
                      </td>
                    </tr>
                  ) : (
                    sortedRows.map((row, i) => {
                      const rowId = row.id;
                      const isDeleting = deletingId === rowId;
                      const selectedHere = selectedContext?.tableName === tableName && selectedContext.row.id != null && rowId === selectedContext.row.id;
                      return (
                        <tr
                          key={rowId != null ? String(rowId) : i}
                          onMouseEnter={() => setHoveredRowId(rowId)}
                          onMouseLeave={() => setHoveredRowId(null)}
                          onClick={(e) => { e.stopPropagation(); onRowSelect?.(row); }}
                          className={`border-b border-[#1a1a1a] transition-colors ${isDeleting ? 'opacity-40' : ''} ${selectedHere ? 'bg-violet-500/15 hover:bg-violet-500/20' : 'hover:bg-white/[0.025]'}`}
                        >
                          {dataColumns.map((col) => {
                            const val = row[col.column_name];
                            return (
                              <td key={col.column_name} className="px-3 py-2 text-zinc-300 text-[11px] whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">
                                {val === null || val === undefined ? <span className="text-zinc-700 italic">—</span>
                                  : typeof val === 'boolean' ? (
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${val ? 'bg-green-500/10 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>{String(val)}</span>
                                  ) : String(val)}
                              </td>
                            );
                          })}

                          {/* Edit / Delete actions */}
                          <td className="w-14 px-1 text-center" onClick={(e) => e.stopPropagation()}>
                            {isDeleting ? (
                              <div className="w-3 h-3 border border-red-500/40 border-t-red-500 rounded-full animate-spin mx-auto" />
                            ) : hoveredRowId === rowId ? (
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => openModal(row)} title="Edit record"
                                  className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                  </svg>
                                </button>
                                <button onClick={() => deleteRow(row)} title="Delete record"
                                  className="w-5 h-5 flex items-center justify-center rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                    <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                                  </svg>
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div className="px-3 py-2 border-t border-[#1e1e1e]">
            <button type="button" onClick={() => openModal()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-zinc-400 hover:text-violet-300 hover:bg-violet-500/10 transition-colors w-full">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Add {singularLabel}
            </button>
          </div>
        </div>
      </div>

      {showModal && modalAnchor && (
        <FormModal
          tableName={tableName}
          columns={columns}
          relations={relations}
          anchorRect={modalAnchor}
          editRow={editingRow ?? undefined}
          moduleLabel={singularLabel}
          onClose={closeModal}
          onSuccess={() => { closeModal(); fetchData(); }}
        />
      )}
    </>
  );
}
