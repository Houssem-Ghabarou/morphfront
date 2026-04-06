'use client';

import { useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import type {
  Session,
  LocalMessage,
  TableCardData,
  ChatResponse,
  VisualCard,
  Relation,
} from '@/types';

interface UseSessionReturn {
  sessions: Session[];
  currentSessionId: number | null;
  messages: LocalMessage[];
  tables: TableCardData[];
  visualCards: VisualCard[];
  relations: Relation[];
  isLoading: boolean;
  isSending: boolean;
  loadSessions: () => Promise<void>;
  createSession: () => Promise<number>;
  renameSession: (id: number, name: string) => Promise<void>;
  switchSession: (id: number) => Promise<void>;
  deleteSession: (id: number) => Promise<void>;
  sendMessage: (text: string) => Promise<ChatResponse | null>;
  updateTablePosition: (tableName: string, x: number, y: number) => void;
  addOrUpdateTable: (tableName: string, x: number, y: number) => void;
  removeTable: (tableName: string) => void;
  refreshSessionName: (id: number, name: string) => void;
  addVisualCard: (card: VisualCard) => void;
  removeVisualCard: (id: string) => void;
  updateVisualCardPosition: (id: string, x: number, y: number) => void;
}

export function useSession(): UseSessionReturn {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [tables, setTables] = useState<TableCardData[]>([]);
  const [visualCards, setVisualCards] = useState<VisualCard[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const msgIdRef = useRef(0);

  const nextId = () => String(++msgIdRef.current);

  const loadSessions = useCallback(async () => {
    try {
      const data = await api.getSessions();
      const sorted = [...data.sessions].sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      setSessions(sorted);
    } catch (err) {
      console.error('Failed to load sessions', err);
    }
  }, []);

  const createSession = useCallback(async (): Promise<number> => {
    const session = await api.createSession();
    setSessions((prev) => {
      const updated = [session, ...prev];
      return updated;
    });
    setCurrentSessionId(session.id);
    setMessages([]);
    setTables([]);
    return session.id;
  }, []);

  const switchSession = useCallback(async (id: number) => {
    setIsLoading(true);
    try {
      const detail = await api.getSession(id);
      setCurrentSessionId(id);
      setVisualCards([]);
      setRelations(detail.relations ?? []);

      const localMessages: LocalMessage[] = detail.messages.map((m) => ({
        id: String(m.id),
        role: m.role,
        text: m.text,
        warning: m.warning,
      }));
      const maxDbId =
        detail.messages.length === 0
          ? 0
          : Math.max(...detail.messages.map((m) => m.id));
      msgIdRef.current = Math.max(msgIdRef.current, maxDbId);
      setMessages(localMessages);

      const cardData: TableCardData[] = detail.sessionTables.map((t) => ({
        tableName: t.table_name,
        x: t.pos_x,
        y: t.pos_y,
      }));
      setTables(cardData);
    } catch (err) {
      console.error('Failed to switch session', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteSession = useCallback(
    async (id: number) => {
      await api.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (currentSessionId === id) {
        setCurrentSessionId(null);
        setMessages([]);
        setTables([]);
      }
    },
    [currentSessionId]
  );

  const sendMessage = useCallback(
    async (text: string): Promise<ChatResponse | null> => {
      if (!currentSessionId) return null;

      const userMsg: LocalMessage = {
        id: nextId(),
        role: 'user',
        text,
      };

      const typingMsg: LocalMessage = {
        id: nextId(),
        role: 'assistant',
        text: '',
        isTyping: true,
      };

      setMessages((prev) => [...prev, userMsg, typingMsg]);
      setIsSending(true);

      try {
        const response = await api.sendChat(text, currentSessionId);

        setMessages((prev) =>
          prev.filter((m) => !m.isTyping).concat({
            id: nextId(),
            role: 'assistant',
            text: response.message,
            warning: response.suggestion,
            isTyping: false,
            suggestions: response.action === 'plan' ? (response.suggestions ?? []) : undefined,
          })
        );

        if (response.sessionName) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === currentSessionId
                ? { ...s, name: response.sessionName! }
                : s
            )
          );
        }

        setSessions((prev) =>
          prev.map((s) =>
            s.id === currentSessionId
              ? { ...s, updated_at: new Date().toISOString() }
              : s
          )
        );

        // After any create action, refresh FK relations from the DB
        if (response.action === 'create' || response.action === 'create_many') {
          try {
            const { relations: fresh } = await api.getSessionRelations(currentSessionId);
            setRelations(fresh);
          } catch {
            // non-critical
          }
        }

        // After seed, tell every TableCard to refetch its data
        if (response.action === 'seed') {
          for (const t of tables) {
            window.dispatchEvent(
              new CustomEvent('morph:refresh', { detail: { tableName: t.tableName } })
            );
          }
        }

        return response;
      } catch (err) {
        console.error('Failed to send message', err);
        setMessages((prev) =>
          prev.filter((m) => !m.isTyping).concat({
            id: nextId(),
            role: 'assistant',
            text: 'Something went wrong. Please try again.',
            isTyping: false,
          })
        );
        return null;
      } finally {
        setIsSending(false);
      }
    },
    [currentSessionId]
  );

  const updateTablePosition = useCallback(
    (tableName: string, x: number, y: number) => {
      setTables((prev) =>
        prev.map((t) => (t.tableName === tableName ? { ...t, x, y } : t))
      );
    },
    []
  );

  const addOrUpdateTable = useCallback(
    (tableName: string, x: number, y: number) => {
      setTables((prev) => {
        const exists = prev.find((t) => t.tableName === tableName);
        if (exists) {
          return prev;
        }
        return [...prev, { tableName, x, y }];
      });
    },
    []
  );

  const removeTable = useCallback((tableName: string) => {
    setTables((prev) => prev.filter((t) => t.tableName !== tableName));
    setRelations((prev) => prev.filter((r) => r.from !== tableName && r.to !== tableName));
  }, []);

  const refreshSessionName = useCallback((id: number, name: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name } : s))
    );
  }, []);

  const renameSession = useCallback(async (id: number, name: string) => {
    await api.renameSession(id, name);
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name } : s))
    );
  }, []);

  const addVisualCard = useCallback((card: VisualCard) => {
    setVisualCards((prev) => [card, ...prev]);
  }, []);

  const removeVisualCard = useCallback((id: string) => {
    setVisualCards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const updateVisualCardPosition = useCallback((id: string, x: number, y: number) => {
    setVisualCards((prev) => prev.map((c) => c.id === id ? { ...c, x, y } : c));
  }, []);

  return {
    sessions,
    currentSessionId,
    messages,
    tables,
    visualCards,
    relations,
    isLoading,
    isSending,
    loadSessions,
    createSession,
    renameSession,
    switchSession,
    deleteSession,
    sendMessage,
    updateTablePosition,
    addOrUpdateTable,
    removeTable,
    refreshSessionName,
    addVisualCard,
    removeVisualCard,
    updateVisualCardPosition,
  };
}
