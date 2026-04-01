'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { Canvas } from '@/components/Canvas';
import { ChatPanel } from '@/components/ChatPanel';
import { SlidePanel } from '@/components/SlidePanel';
import type { Column, VisualCard } from '@/types';

export default function Home() {
  const session = useSession();
  const initialized = useRef(false);
  const [prefillState, setPrefillState] = useState<{
    tableName: string;
    columns: Column[];
    values: Record<string, unknown>;
  } | null>(null);

  const handlePrefill = (tableName: string, columns: Column[], values: Record<string, unknown>) => {
    setPrefillState({ tableName, columns, values });
  };

  const handleQueryResult = (card: Omit<VisualCard, 'id' | 'x' | 'y'>) => {
    const id = `visual-${Date.now()}`;
    const idx = session.visualCards.length;
    const x = 60 + (idx % 3) * 380;
    const y = 60 + Math.floor(idx / 3) * 280;
    session.addVisualCard({ ...card, id, x, y });
  };

  const handlePrefillConfirm = async (tableName: string, values: Record<string, unknown>) => {
    await api.insertRow(tableName, values);
    window.dispatchEvent(new CustomEvent('morph:refresh', { detail: { tableName } }));
    setPrefillState(null);
  };

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const init = async () => {
      const data = await api.getSessions();
      const sorted = [...data.sessions].sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      await session.loadSessions();

      if (sorted.length > 0) {
        await session.switchSession(sorted[0].id);
      } else {
        await session.createSession();
      }
    };

    init().catch(console.error);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">
      <Sidebar
        sessions={session.sessions}
        currentSessionId={session.currentSessionId}
        onNewSession={session.createSession}
        onSelectSession={session.switchSession}
        onDeleteSession={session.deleteSession}
      />

      <div className="flex flex-col flex-1 min-w-0 relative overflow-hidden">
        <div className="flex flex-col flex-1 relative overflow-hidden">
          <Canvas
            tables={session.tables}
            sessionId={session.currentSessionId}
            onPositionChange={session.updateTablePosition}
            isLoading={session.isLoading}
            visualCards={session.visualCards}
            onRemoveVisualCard={session.removeVisualCard}
            onVisualCardPositionChange={session.updateVisualCardPosition}
            relations={session.relations}
          />

          {prefillState && (
            <SlidePanel
              tableName={prefillState.tableName}
              columns={prefillState.columns}
              prefillValues={prefillState.values}
              sessionTables={session.tables.map((t) => t.tableName)}
              relations={session.relations}
              onConfirm={handlePrefillConfirm}
              onCancel={() => setPrefillState(null)}
            />
          )}
        </div>

        <ChatPanel
          messages={session.messages}
          isSending={session.isSending}
          sessionId={session.currentSessionId}
          onSend={session.sendMessage}
          onTableAction={session.addOrUpdateTable}
          existingTables={session.tables}
          onPrefill={handlePrefill}
          onQueryResult={handleQueryResult}
        />
      </div>
    </div>
  );
}
