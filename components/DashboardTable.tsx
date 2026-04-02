'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { FormModal } from '@/components/FormModal';
import type { SchemaColumn, DataRow, Relation } from '@/types';

interface DashboardTableProps {
  tableName: string;
  sessionId: number;
  relations?: Relation[];
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
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
  if (n.includes('meal') || n.includes('food') || n.includes('nutrition') || n.includes('calori') || n.includes('diet'))
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>;
  if (n.includes('order') || n.includes('sale') || n.includes('invoice') || n.includes('payment'))
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>;
  if (n.includes('product') || n.includes('inventory') || n.includes('stock') || n.includes('item'))
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>;
  if (n.includes('task') || n.includes('todo') || n.includes('project') || n.includes('program') || n.includes('course') || n.includes('assignment'))
    return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>;
}

export function DashboardTable({ tableName, sessionId, relations = [] }: DashboardTableProps) {
  const [columns, setColumns] = useState<SchemaColumn[]>([]);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRow, setEditingRow] = useState<DataRow | null>(null);
  const [modalAnchor, setModalAnchor] = useState<DOMRect | null>(null);
  const [deletingId, setDeletingId] = useState<unknown>(null);
  const [hoveredRowId, setHoveredRowId] = useState<unknown>(null);
  const [sortState, setSortState] = useState<{ col: string; dir: 'asc' | 'desc' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

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
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ tableName: string }>).detail;
      if (detail.tableName === tableName) fetchData();
    };
    window.addEventListener('morph:refresh', handler);
    return () => window.removeEventListener('morph:refresh', handler);
  }, [tableName, fetchData]);

  const deleteRow = async (row: DataRow) => {
    const rowId = row.id;
    setDeletingId(rowId);
    try {
      const childRels = relations.filter((r) => r.to === tableName);
      if (childRels.length > 0) {
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

  const dataColumns = columns.filter((c) => c.column_name !== 'id' && c.column_name !== 'created_at');
  const displayName = tableName.replace(/^s\d+_/, '');
  const moduleLabel = toModuleLabel(displayName);
  const singularLabel = toSingular(moduleLabel);

  const searchedRows = searchQuery.trim()
    ? rows.filter((row) => dataColumns.some((col) => { const v = row[col.column_name]; return v != null && String(v).toLowerCase().includes(searchQuery.toLowerCase()); }))
    : rows;

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

  return (
    <>
      <div ref={cardRef} className="rounded-xl overflow-hidden border border-[#26263a] bg-[#1a1a28] shadow-lg animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e1e2e]">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-600/20 border border-violet-500/25 text-violet-400 shrink-0">
            <ModuleIcon name={displayName} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[13px] font-semibold text-zinc-100 truncate block">{moduleLabel}</span>
            <span className="text-[10px] text-zinc-500">{rows.length} {rows.length === 1 ? 'record' : 'records'}</span>
          </div>
          <button onClick={() => { setShowSearch((v) => !v); if (showSearch) setSearchQuery(''); }} title="Search"
            className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${showSearch ? 'text-violet-400 bg-violet-500/15' : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/5'}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </button>
          <button onClick={exportCSV} title="Export CSV"
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-white/5 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="px-4 py-2.5 border-b border-[#1e1e2e]">
            <input autoFocus type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${moduleLabel.toLowerCase()}…`}
              className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-violet-500/40 transition-colors" />
          </div>
        )}

        {/* Body */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-violet-500/40 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin" style={{ maxHeight: 420 }}>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#0f0f15]">
                  {dataColumns.map((col) => {
                    const isSorted = sortState?.col === col.column_name;
                    return (
                      <th key={col.column_name} onClick={() => cycleSort(col.column_name)}
                        className="text-left px-3 py-2.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-[#1e1e2e] whitespace-nowrap cursor-pointer hover:text-zinc-300 select-none transition-colors">
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
                  <th className="w-16 border-b border-[#1e1e2e]" />
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={dataColumns.length + 1} className="px-3 py-8 text-center text-zinc-600 text-xs">
                      {rows.length === 0 ? `No ${singularLabel.toLowerCase()} records yet` : 'No records match your search'}
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((row, i) => {
                    const rowId = row.id;
                    const isDeleting = deletingId === rowId;
                    return (
                      <tr
                        key={rowId != null ? String(rowId) : i}
                        onMouseEnter={() => setHoveredRowId(rowId)}
                        onMouseLeave={() => setHoveredRowId(null)}
                        className={`border-b border-[#1a1a2a] transition-colors ${isDeleting ? 'opacity-40' : 'hover:bg-white/[0.025]'}`}
                      >
                        {dataColumns.map((col) => {
                          const val = row[col.column_name];
                          return (
                            <td key={col.column_name} className="px-3 py-2.5 text-zinc-300 text-[11px] whitespace-nowrap max-w-[220px] overflow-hidden text-ellipsis">
                              {val === null || val === undefined ? <span className="text-zinc-700 italic">—</span>
                                : typeof val === 'boolean' ? (
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${val ? 'bg-green-500/10 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>{String(val)}</span>
                                ) : String(val)}
                            </td>
                          );
                        })}
                        <td className="w-16 px-2 text-center">
                          {isDeleting ? (
                            <div className="w-3 h-3 border border-red-500/40 border-t-red-500 rounded-full animate-spin mx-auto" />
                          ) : hoveredRowId === rowId ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => openModal(row)} title="Edit"
                                className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                              </button>
                              <button onClick={() => deleteRow(row)} title="Delete"
                                className="w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        <div className="px-4 py-2.5 border-t border-[#1e1e2e]">
          <button type="button" onClick={() => openModal()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-violet-300 hover:bg-violet-500/10 transition-colors w-full">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Add {singularLabel}
          </button>
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
