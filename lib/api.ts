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
    credentials: 'include',
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

export interface AuthUser {
  id: number;
  email: string;
}

export interface SessionConnection {
  id: number;
  connection_id: number;
  imported_tables: string[];
  auto_sync_minutes: number | null;
  last_synced_at: string | null;
  name: string;
  type: string;
  host: string;
  port: number;
  database_name: string;
}

export const api = {
  register(email: string, password: string): Promise<{ user: AuthUser }> {
    return request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  login(email: string, password: string): Promise<{ user: AuthUser }> {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  logout(): Promise<{ ok: boolean }> {
    return request('/api/auth/logout', { method: 'POST' });
  },

  getMe(): Promise<{ user: AuthUser }> {
    return request('/api/auth/me');
  },

  changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean }> {
    return request('/api/auth/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

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

  getTableData(tableName: string, opts?: { page?: number; limit?: number; search?: string }): Promise<{ rows: DataRow[]; total?: number; pages?: number; page?: number }> {
    const params = new URLSearchParams();
    if (opts?.page)   params.set('page',   String(opts.page));
    if (opts?.limit)  params.set('limit',  String(opts.limit));
    if (opts?.search) params.set('search', opts.search);
    const qs = params.toString();
    return request(`/api/data/${tableName}${qs ? `?${qs}` : ''}`);
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

  dropTable(tableName: string, sessionId: number): Promise<{ ok: boolean }> {
    return request(`/api/data/${tableName}/drop?sessionId=${sessionId}`, { method: 'DELETE' });
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
      credentials: 'include',
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

  // Save connection + link to session in one shot, no re-test
  linkSession(payload: {
    type: string; host: string; port: number; database: string;
    username: string; password: string; ssl?: boolean; name: string;
    sessionId: number; importedTables: string[]; connectionString?: string;
  }): Promise<{ connection: SessionConnection }> {
    return request('/api/connections/link-session', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // ─── Session ↔ Connection linking ───────────────────────────────────────────

  getSessionConnection(sessionId: number): Promise<{ connection: SessionConnection | null }> {
    return request(`/api/sessions/${sessionId}/connection`);
  },

  saveSessionConnection(sessionId: number, connectionId: number, tables: string[]): Promise<{ ok: boolean }> {
    return request(`/api/sessions/${sessionId}/connection`, {
      method: 'POST',
      body: JSON.stringify({ connectionId, tables }),
    });
  },

  setAutoSync(sessionId: number, autoSyncMinutes: number | null): Promise<{ ok: boolean }> {
    return request(`/api/sessions/${sessionId}/connection`, {
      method: 'PATCH',
      body: JSON.stringify({ autoSyncMinutes }),
    });
  },

  syncConnection(connectionId: number, sessionId: number, tables: string[]): Promise<{
    results: Array<{ tableName: string; rowsImported: number; error?: string }>;
  }> {
    return request(`/api/connections/${connectionId}/sync`, {
      method: 'POST',
      body: JSON.stringify({ sessionId, tables }),
    });
  },

  // ─── Database connections ────────────────────────────────────────────────────

  testConnection(config: {
    type: string; host: string; port: number; database: string; username: string; password: string; ssl?: boolean; connectionString?: string;
  }): Promise<{ ok: boolean; error?: string }> {
    return request('/api/connections/test', { method: 'POST', body: JSON.stringify(config) });
  },

  discoverSchemas(config: {
    type: string; host: string; port: number; database: string; username: string; password: string; ssl?: boolean; connectionString?: string;
  }): Promise<{ tables: Array<{ tableName: string; rowCount: number; columns: Array<{ name: string; type: string; nullable: boolean }>; sampleRows: Record<string, unknown>[] }> }> {
    return request('/api/connections/discover', { method: 'POST', body: JSON.stringify(config) });
  },

  importFromConnection(payload: {
    type: string; host: string; port: number; database: string; username: string; password: string; ssl?: boolean; connectionString?: string;
    sessionId: number; tables: string[];
  }): Promise<{ results: Array<{ tableName: string; rowsImported: number; error?: string }> }> {
    return request('/api/connections/import', { method: 'POST', body: JSON.stringify(payload) });
  },

  getConnections(): Promise<{ connections: Array<{ id: number; name: string; type: string; host: string; port: number; database_name: string; username: string; ssl: boolean }> }> {
    return request('/api/connections');
  },

  saveConnection(config: {
    type: string; host: string; port: number; database: string; username: string; password: string; ssl?: boolean; name?: string;
  }): Promise<{ connection: { id: number; name: string; type: string } }> {
    return request('/api/connections', { method: 'POST', body: JSON.stringify(config) });
  },

  deleteConnection(id: number): Promise<{ ok: boolean }> {
    return request(`/api/connections/${id}`, { method: 'DELETE' });
  },
};
