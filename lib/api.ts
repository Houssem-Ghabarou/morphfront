import type {
  Session,
  SessionDetail,
  ChatResponse,
  TableSchema,
  DataRow,
  Relation,
} from '@/types';

const BASE_URL = 'http://localhost:3001';

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = options?.body
    ? { 'Content-Type': 'application/json' }
    : {};
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export interface ColumnSuggestion {
  csvHeader: string;
  pgName: string;
  pgType: string;
}

export interface ColumnMapping {
  csvHeader: string;
  tableColumn: string | null;
}

export type ImportAnalysis =
  | { flow: 'new'; tableName: string; columns: ColumnSuggestion[]; headers: string[]; rows: string[][] }
  | { flow: 'existing'; tableName: string; mapping: ColumnMapping[]; headers: string[]; rows: string[][] };

export interface ImportConfirmResult {
  rowsImported: number;
  tableName: string;
}

export const api = {
  getSessions(): Promise<{ sessions: Session[] }> {
    return request('/api/sessions');
  },

  createSession(): Promise<Session> {
    return request('/api/sessions', { method: 'POST' });
  },

  getSession(id: number): Promise<SessionDetail> {
    return request(`/api/sessions/${id}`);
  },

  deleteSession(id: number): Promise<void> {
    return request(`/api/sessions/${id}`, { method: 'DELETE' });
  },

  renameSession(id: number, name: string): Promise<{ ok: boolean }> {
    return request(`/api/sessions/${id}/name`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  },

  updateTablePosition(
    sessionId: number,
    tableName: string,
    x: number,
    y: number
  ): Promise<void> {
    return request(`/api/sessions/${sessionId}/tables/${tableName}/position`, {
      method: 'PATCH',
      body: JSON.stringify({ x, y }),
    });
  },

  sendChat(message: string, sessionId: number): Promise<ChatResponse> {
    return request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message, sessionId }),
    });
  },

  getTableData(tableName: string): Promise<{ rows: DataRow[] }> {
    return request(`/api/data/${tableName}`);
  },

  insertRow(tableName: string, data: Record<string, unknown>): Promise<void> {
    return request(`/api/data/${tableName}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getSchema(tableName: string): Promise<TableSchema> {
    return request(`/api/schema/${tableName}`);
  },

  getSessionRelations(sessionId: number): Promise<{ relations: Relation[] }> {
    return request(`/api/sessions/${sessionId}/relations`);
  },

  updateRow(tableName: string, id: number | string, data: Record<string, unknown>): Promise<{ row: DataRow }> {
    return request(`/api/data/${tableName}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteRow(tableName: string, id: number | string): Promise<{ ok: boolean }> {
    return request(`/api/data/${tableName}/${id}`, { method: 'DELETE' });
  },

  alterAndInsert(
    tableName: string,
    changes: Array<{ action: string; column: string; newName?: string; newType?: string }>,
    row: Record<string, unknown>
  ): Promise<{ row: DataRow; ok: boolean }> {
    return request(`/api/data/${tableName}/schema`, {
      method: 'PATCH',
      body: JSON.stringify({ changes, row }),
    });
  },

  analyzeCSV(file: File, sessionId: number, description?: string): Promise<ImportAnalysis> {
    const form = new FormData();
    form.append('csv', file);
    const params = new URLSearchParams({ sessionId: String(sessionId) });
    if (description) params.set('description', description);
    return fetch(`${BASE_URL}/api/import/analyze?${params}`, {
      method: 'POST',
      body: form,
    }).then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => 'Unknown error');
        throw new Error(`API ${res.status}: ${text}`);
      }
      return res.json() as Promise<ImportAnalysis>;
    });
  },

  confirmImport(
    payload:
      | { flow: 'new'; sessionId: number; tableName: string; columns: ColumnSuggestion[]; headers: string[]; rows: string[][] }
      | { flow: 'existing'; tableName: string; mapping: ColumnMapping[]; headers: string[]; rows: string[][] }
  ): Promise<ImportConfirmResult> {
    return request('/api/import/confirm', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
