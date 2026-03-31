import type {
  Session,
  SessionDetail,
  ChatResponse,
  TableSchema,
  DataRow,
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
};
