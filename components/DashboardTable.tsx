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
  const [selectedRows, setSelectedRows] = useState<Set<unknown>>(new Set());
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
      setSelectedRows((prev) => { const next = new Set(prev); next.delete(rowId); return next; });
      await fetchData();
    } catch (err) {
      console.error('Failed to delete row', err);
    } finally {
      setDeletingId(null);
    }
  };

  const bulkDelete = async () => {
    for (const rowId of selectedRows) {
      const row = rows.find((r) => r.id === rowId);
      if (row) await deleteRow(row);
    }
    setSelectedRows(new Set());
  };

  const exportCSV = () => {
    const cols = dataColumns.map((c) => c.column_name);
    const exportRows = selectedRows.size > 0 ? rows.filter((r) => selectedRows.has(r.id)) : rows;
    const csv = [
      cols.join(','),
      ...exportRows.map((row) =>
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
  const moduleLabel = toModuleLabel(tableName.replace(/^s\d+_/, ''));
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

  const toggleRow = (id: unknown) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedRows.size === sortedRows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(sortedRows.map((r) => r.id)));
    }
  };

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
      <div ref={cardRef} className="flex flex-col h-full animate-fade-in">
        {/* Page header */}
        <div className="shrink-0 px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">{moduleLabel}</h2>
              <p className="text-xs text-zinc-600 mt-0.5">
                {rows.length} {rows.length === 1 ? 'record' : 'records'} total
                {searchQuery && ` · ${sortedRows.length} matching`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedRows.size > 0 && (
                <>
                  <span className="text-[11px] text-violet-400 font-medium mr-1">{selectedRows.size} selected</span>
                  <button onClick={bulkDelete}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                    Delete
                  </button>
                  <button onClick={exportCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 bg-white/5 border border-[#2a2a2a] hover:border-zinc-600 hover:text-zinc-200 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Export Selected
                  </button>
                </>
              )}
              <button onClick={() => fetchData()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 bg-white/5 border border-[#2a2a2a] hover:border-zinc-600 hover:text-zinc-200 transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                Refresh
              </button>
              <button onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 bg-white/5 border border-[#2a2a2a] hover:border-zinc-600 hover:text-zinc-200 transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export
              </button>
              <button onClick={() => openModal()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 shadow-[0_2px_8px_rgba(124,58,237,0.3)] transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                Add {singularLabel}
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${moduleLabel.toLowerCase()}…`}
              className="w-full bg-[#111118] border border-[#26263a] rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-violet-500/40 transition-colors"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto scrollbar-thin mx-6 mb-6 rounded-xl border border-[#26263a] bg-[#12121c]">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-violet-500/40 border-t-violet-500 rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#16162a]">
                  <th className="w-10 px-3 py-3 border-b border-[#26263a]">
                    <input type="checkbox" checked={selectedRows.size === sortedRows.length && sortedRows.length > 0}
                      onChange={toggleAll}
                      className="w-3.5 h-3.5 rounded border-zinc-600 bg-transparent accent-violet-500 cursor-pointer" />
                  </th>
                  {dataColumns.map((col) => {
                    const isSorted = sortState?.col === col.column_name;
                    return (
                      <th key={col.column_name} onClick={() => cycleSort(col.column_name)}
                        className="text-left px-3 py-3 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-[#26263a] whitespace-nowrap cursor-pointer hover:text-zinc-200 select-none transition-colors">
                        <span className="flex items-center gap-1.5">
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
                  <th className="w-20 px-3 py-3 border-b border-[#26263a] text-right text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={dataColumns.length + 2} className="px-3 py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3f3f56" strokeWidth="1.5" className="mb-1">
                          <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/>
                        </svg>
                        <p className="text-sm text-zinc-500">{rows.length === 0 ? `No ${singularLabel.toLowerCase()} records yet` : 'No records match your search'}</p>
                        {rows.length === 0 && (
                          <button onClick={() => openModal()} className="mt-2 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                            Create your first {singularLabel.toLowerCase()}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((row, i) => {
                    const rowId = row.id;
                    const isDeleting = deletingId === rowId;
                    const isSelected = selectedRows.has(rowId);
                    return (
                      <tr
                        key={rowId != null ? String(rowId) : i}
                        onMouseEnter={() => setHoveredRowId(rowId)}
                        onMouseLeave={() => setHoveredRowId(null)}
                        className={`border-b border-[#1e1e30] transition-colors ${isDeleting ? 'opacity-40' : ''} ${isSelected ? 'bg-violet-500/8' : 'hover:bg-white/[0.02]'}`}
                      >
                        <td className="w-10 px-3 py-2.5">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleRow(rowId)}
                            className="w-3.5 h-3.5 rounded border-zinc-600 bg-transparent accent-violet-500 cursor-pointer" />
                        </td>
                        {dataColumns.map((col) => {
                          const val = row[col.column_name];
                          return (
                            <td key={col.column_name} className="px-3 py-2.5 text-zinc-300 text-[11px] whitespace-nowrap max-w-[240px] overflow-hidden text-ellipsis">
                              {val === null || val === undefined ? <span className="text-zinc-700 italic">—</span>
                                : typeof val === 'boolean' ? (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${val ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${val ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                                    {String(val)}
                                  </span>
                                ) : String(val)}
                            </td>
                          );
                        })}
                        <td className="w-20 px-3 py-2.5 text-right">
                          {isDeleting ? (
                            <div className="w-3.5 h-3.5 border border-red-500/40 border-t-red-500 rounded-full animate-spin ml-auto" />
                          ) : hoveredRowId === rowId || isSelected ? (
                            <div className="flex items-center justify-end gap-0.5">
                              <button onClick={() => openModal(row)} title="Edit"
                                className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                              </button>
                              <button onClick={() => deleteRow(row)} title="Delete"
                                className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
          )}
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
