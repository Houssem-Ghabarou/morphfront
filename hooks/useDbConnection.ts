'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api, SessionConnection } from '@/lib/api';

export interface DbConnectionState {
  connection: SessionConnection | null;
  loading: boolean;
  isSyncing: boolean;
  lastSynced: Date | null;
  sync: () => Promise<void>;
  setAutoSync: (minutes: number | null) => Promise<void>;
  reload: () => Promise<void>;
}

export function useDbConnection(sessionId: number | null): DbConnectionState {
  const [connection, setConnection] = useState<SessionConnection | null>(null);
  const [loading, setLoading]       = useState(false);
  const [isSyncing, setIsSyncing]   = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) { setConnection(null); return; }
    setLoading(true);
    try {
      const { connection: conn } = await api.getSessionConnection(sessionId);
      setConnection(conn);
      if (conn?.last_synced_at) setLastSynced(new Date(conn.last_synced_at));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [sessionId]);

  // Reload whenever session changes
  useEffect(() => { load(); }, [load]);

  // Manage auto-sync interval
  useEffect(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (!connection?.auto_sync_minutes || !sessionId) return;

    const ms = connection.auto_sync_minutes * 60 * 1000;
    intervalRef.current = setInterval(async () => {
      if (!connection) return;
      try {
        await api.syncConnection(connection.connection_id, sessionId, connection.imported_tables);
        setLastSynced(new Date());
        // Dispatch event so TableCards refresh their data
        window.dispatchEvent(new CustomEvent('morph:db-synced'));
      } catch { /* silent — auto-sync failure should not interrupt the user */ }
    }, ms);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [connection?.auto_sync_minutes, connection?.connection_id, sessionId]);

  const sync = useCallback(async () => {
    if (!connection || !sessionId) return;
    setIsSyncing(true);
    try {
      await api.syncConnection(connection.connection_id, sessionId, connection.imported_tables);
      setLastSynced(new Date());
      window.dispatchEvent(new CustomEvent('morph:db-synced'));
    } finally { setIsSyncing(false); }
  }, [connection, sessionId]);

  const setAutoSync = useCallback(async (minutes: number | null) => {
    if (!sessionId) return;
    await api.setAutoSync(sessionId, minutes);
    setConnection((prev) => prev ? { ...prev, auto_sync_minutes: minutes } : prev);
  }, [sessionId]);

  return { connection, loading, isSyncing, lastSynced, sync, setAutoSync, reload: load };
}
