/**
 * Shared value formatter for rendering DB values in the UI.
 * Guarantees a human-readable string — never "[object Object]" or a raw ISO timestamp.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

function formatDate(d: Date): string {
  if (isNaN(d.getTime())) return '';
  const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  // Append time only when it carries information (not midnight).
  if (d.getHours() !== 0 || d.getMinutes() !== 0) {
    return `${datePart}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  return datePart;
}

/** Postgres interval columns are parsed by the pg driver into objects like { days, hours }. */
function isIntervalLike(v: Record<string, unknown>): boolean {
  const keys = ['years', 'months', 'days', 'hours', 'minutes', 'seconds', 'milliseconds'];
  const own = Object.keys(v);
  return own.length > 0 && own.every((k) => keys.includes(k));
}

function formatInterval(v: Record<string, unknown>): string {
  const order: Array<[string, string]> = [
    ['years', 'yr'], ['months', 'mo'], ['days', 'd'],
    ['hours', 'h'], ['minutes', 'm'], ['seconds', 's'],
  ];
  const parts = order
    .filter(([k]) => Number(v[k]) > 0)
    .map(([k, label]) => `${Number(v[k])}${label}`);
  return parts.length > 0 ? parts.join(' ') : '0s';
}

/** Format any value to a display string. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) return formatDate(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (isIntervalLike(obj)) return formatInterval(obj);
    if (Array.isArray(value)) return value.map((x) => formatValue(x)).join(', ');
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }

  const str = String(value);
  if (ISO_DATE.test(str)) return formatDate(new Date(str));
  return str;
}

/** "s5_order_items" / "total_price" → "Order Items" / "Total Price". */
export function prettyHeader(col: string): string {
  return col
    .replace(/^s\d+_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
