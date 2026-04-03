'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from '@/hooks/useSession';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { Canvas } from '@/components/Canvas';
import { ChatPanel } from '@/components/ChatPanel';
import { SlidePanel } from '@/components/SlidePanel';
import type { SchemaChange } from '@/components/SlidePanel';
import { AnalyticsPanel } from '@/components/AnalyticsPanel';
import { ImportModal } from '@/components/ImportModal';
import type { Column, VisualCard, AnalysisCard } from '@/types';

export default function Home() {
  const session = useSession();
  const initialized = useRef(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importToast, setImportToast] = useState<string | null>(null);

  const handleImportSuccess = useCallback((tableName: string, rowCount: number) => {
    // Reload session so the new/updated table appears on the canvas
    if (session.currentSessionId) {
      session.switchSession(session.currentSessionId).catch(console.error);
    }
    setImportToast(`${rowCount} rows imported into ${tableName.replace(/^s\d+_/, '')}`);
    setTimeout(() => setImportToast(null), 4000);
  }, [session]);

  const [prefillState, setPrefillState] = useState<{
    tableName: string;
    columns: Column[];
    values: Record<string, unknown>;
  } | null>(null);

  const [analysisCards, setAnalysisCards] = useState<AnalysisCard[] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handlePrefill = (tableName: string, columns: Column[], values: Record<string, unknown>) => {
    setPrefillState({ tableName, columns, values });
  };

  const handleAnalyze = useCallback((cards: AnalysisCard[]) => {
    setAnalysisCards(cards);
    setIsAnalyzing(false);
  }, []);

  const handleAnalyzeClick = useCallback(async () => {
    if (!session.currentSessionId || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const response = await session.sendMessage('analyze my data');
      if (response?.action === 'analyze' && response.analyses) {
        handleAnalyze(response.analyses);
      } else {
        setIsAnalyzing(false);
      }
    } catch {
      setIsAnalyzing(false);
    }
  }, [session, isAnalyzing, handleAnalyze]);

  const handleQueryToPanel = useCallback((card: Omit<VisualCard, 'id' | 'x' | 'y'>) => {
    const analysisCard: AnalysisCard = {
      title: card.title,
      sql: card.sql,
      rows: card.rows,
      columns: card.columns,
      chartType: card.type,
    };
    setAnalysisCards((prev) => [...(prev ?? []), analysisCard]);
  }, []);

  const visualCountRef = useRef(0);
  useEffect(() => { visualCountRef.current = session.visualCards.length; }, [session.visualCards.length]);

  const cardIdCounter = useRef(0);

  const handlePinToCanvas = useCallback((card: AnalysisCard) => {
    const id = `visual-${Date.now()}-${++cardIdCounter.current}`;
    const idx = visualCountRef.current++;
    const x = 60 + (idx % 3) * 380;
    const y = 60 + Math.floor(idx / 3) * 280;
    session.addVisualCard({ ...card, id, x, y, type: card.chartType });
  }, [session]);

  const handlePrefillConfirm = async (
    tableName: string,
    values: Record<string, unknown>,
    schemaChanges: SchemaChange[]
  ) => {
    if (schemaChanges.length > 0) {
      await api.alterAndInsert(tableName, schemaChanges, values);
    } else {
      await api.insertRow(tableName, values);
    }
    window.dispatchEvent(new CustomEvent('morph:refresh', { detail: { tableName } }));
    setPrefillState(null);
  };

  const handleAutoLayout = useCallback(async () => {
    const tables = session.tables;
    const visuals = session.visualCards;
    if (tables.length === 0 && visuals.length === 0) return;

    const GAP = 40;
    const TABLE_W = 340;
    const TABLE_H = 320;
    const VISUAL_W = 340;
    const VISUAL_H = 220;
    const START_X = 60;
    const START_Y = 60;

    const totalItems = tables.length + visuals.length;
    const cols = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(totalItems))));

    tables.forEach((table, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const newX = START_X + col * (TABLE_W + GAP);
      const newY = START_Y + row * (TABLE_H + GAP);
      session.updateTablePosition(table.tableName, newX, newY);
      if (session.currentSessionId) {
        api.updateTablePosition(session.currentSessionId, table.tableName, newX, newY).catch(() => {});
      }
    });

    const tableRows = Math.ceil(tables.length / cols);
    const visualStartY = START_Y + tableRows * (TABLE_H + GAP) + (tables.length > 0 ? GAP : 0);

    visuals.forEach((card, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const newX = START_X + col * (VISUAL_W + GAP);
      const newY = visualStartY + row * (VISUAL_H + GAP);
      session.updateVisualCardPosition(card.id, newX, newY);
    });
  }, [session]);

  const handleOpenDashboard = useCallback(() => {
    if (session.currentSessionId) {
      window.open(`/view/${session.currentSessionId}`, '_blank');
    }
  }, [session.currentSessionId]);

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
    <div className="flex h-screen overflow-hidden bg-[#141420]">
      <Sidebar
        sessions={session.sessions}
        currentSessionId={session.currentSessionId}
        onNewSession={session.createSession}
        onRenameSession={session.renameSession}
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
            onAutoLayout={handleAutoLayout}
            onOpenDashboard={handleOpenDashboard}
            onImportCSV={() => setImportOpen(true)}
            onAnalyzeClick={handleAnalyzeClick}
            isAnalyzing={isAnalyzing}
          />

          {importOpen && session.currentSessionId && (
            <ImportModal
              sessionId={session.currentSessionId}
              hasExistingTables={session.tables.length > 0}
              onClose={() => setImportOpen(false)}
              onSuccess={handleImportSuccess}
            />
          )}

          {importToast && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-[#0d0d12]/95 backdrop-blur-sm shadow-lg text-sm text-emerald-300">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {importToast}
              </div>
            </div>
          )}

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

          {analysisCards && (
            <AnalyticsPanel
              cards={analysisCards}
              onPinToCanvas={handlePinToCanvas}
              onClose={() => setAnalysisCards(null)}
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
          onQueryResult={handleQueryToPanel}
          onAnalyze={handleAnalyze}
        />
      </div>
    </div>
  );
}
