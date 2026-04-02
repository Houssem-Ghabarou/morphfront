import type { Relation } from '@/types';
import type { DataRow } from '@/types';

/**
 * Walk child → parent links until we reach ancestor.
 * Returns [child, …, ancestor] or null.
 *
 * Uses BFS: a table may have several FK columns (e.g. orders → menu_items and orders → suppliers).
 * Greedy `find(r => r.from === cur)` only followed the first edge and often missed the path to the
 * selected parent — e.g. selecting a menu item never filtered orders.
 */
export function chainFromChildToAncestor(
  child: string,
  ancestor: string,
  relations: Relation[]
): string[] | null {
  if (child === ancestor) return [child];

  const queue: string[][] = [[child]];

  while (queue.length > 0) {
    const path = queue.shift()!;
    const cur = path[path.length - 1];

    for (const rel of relations.filter((r) => r.from === cur)) {
      if (path.includes(rel.to)) continue;
      const nextPath = [...path, rel.to];
      if (rel.to === ancestor) return nextPath;
      queue.push(nextPath);
    }
  }

  return null;
}

/** Value from parent row that child[rel.on] should match (TEXT FK convention). */
export function parentLinkDisplayValue(
  parentRow: Record<string, unknown>,
  _parentTable: string,
  childFkColumn: string
): string | null {
  const fk = childFkColumn.toLowerCase();

  if (fk === 'client' || fk.endsWith('_client')) {
    const n = parentRow.name;
    if (typeof n === 'string' && n.length) return n;
  }
  if (fk.includes('training_program') && fk !== 'program') {
    const p = parentRow.program;
    if (typeof p === 'string' && p.length) return p;
  }
  if (fk.includes('supplier') || fk.includes('menu_item')) {
    const n = parentRow.name;
    if (typeof n === 'string' && n.length) return n;
  }
  if (typeof parentRow.name === 'string' && parentRow.name.length) return parentRow.name;

  const skip = new Set(['id', 'created_at', 'updated_at']);
  for (const [k, v] of Object.entries(parentRow)) {
    if (skip.has(k)) continue;
    if (typeof v === 'string' && v.length) return v;
  }
  return null;
}

export function childMatchesParentRow(
  childRow: Record<string, unknown>,
  rel: Relation,
  parentRow: Record<string, unknown>
): boolean {
  const childVal = childRow[rel.on];
  const expected = parentLinkDisplayValue(parentRow, rel.to, rel.on);
  const cv = String(childVal ?? '').trim().toLowerCase();
  if (!cv) return false;

  if (expected != null) {
    const ev = String(expected).trim().toLowerCase();
    if (cv === ev) return true;
  }

  // Fallback: FK text may match title, category, dish, etc. on the parent (not only `name`)
  const skip = new Set(['id', 'created_at', 'updated_at']);
  for (const [, v] of Object.entries(parentRow)) {
    if (typeof v === 'string' && v.trim().toLowerCase() === cv) return true;
  }
  return false;
}

export type ApiGetTable = (tableName: string) => Promise<{ rows: DataRow[] }>;

/** Filter rows in `tableName` to those linked to `selected` along FK chain (direct or multi-hop). */
export async function filterRowsForAncestorSelection(
  tableName: string,
  allRows: DataRow[],
  selected: { tableName: string; row: Record<string, unknown> },
  relations: Relation[],
  getTableData: ApiGetTable
): Promise<DataRow[]> {
  if (tableName === selected.tableName) return allRows;

  const chain = chainFromChildToAncestor(tableName, selected.tableName, relations);
  if (!chain || chain.length < 2) return allRows;

  let currentRows: DataRow[] = [selected.row];

  for (let step = chain.length - 1; step > 0; step--) {
    const childTable = chain[step - 1];
    const parentTable = chain[step];
    const rel = relations.find((r) => r.from === childTable && r.to === parentTable);
    if (!rel) return allRows;

    const childRows =
      childTable === tableName ? allRows : (await getTableData(childTable)).rows;

    const filtered = childRows.filter((cr) =>
      currentRows.some((pr) => childMatchesParentRow(cr, rel, pr))
    );
    currentRows = filtered;
    if (childTable === tableName) return filtered;
  }

  return allRows;
}
