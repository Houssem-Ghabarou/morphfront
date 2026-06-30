'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Automation, AutomationRun } from '@/types';
import { AutomationBuilder } from '@/components/AutomationBuilder';
import { EmailSettingsModal } from '@/components/EmailSettingsModal';

interface Props {
  sessionId: number;
  onClose: () => void;
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Best-effort human description of a trigger. */
function describeTrigger(a: Automation): string {
  const c = a.trigger_config ?? {};
  if (a.trigger_type === 'schedule' && typeof c.cron === 'string') {
    const parts = c.cron.split(' ');
    if (parts.length === 5) {
      const [min, hour, dom, , dow] = parts;
      const time = `${hour.padStart(2, '0')}:${min === '*' ? '00' : min.padStart(2, '0')}`;
      if (dow !== '*') return `Every ${DOW[Number(dow)] ?? dow} at ${time}`;
      if (dom !== '*') return `Day ${dom} of each month at ${time}`;
      return `Every day at ${time}`;
    }
    return `Cron: ${c.cron}`;
  }
  if (a.trigger_type === 'threshold') {
    return `When ${c.column} ${c.operator} ${c.value} in ${String(c.table).replace(/^s\d+_/, '')}`;
  }
  if (a.trigger_type === 'date_proximity') {
    return `${c.days_before} days before ${c.column}`;
  }
  return a.trigger_type;
}

const STATUS_COLOR: Record<string, string> = {
  success: '#34d399',
  failed: '#f87171',
  no_data: '#fbbf24',
  skipped: '#9ca3af',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function TriggerIcon({ type }: { type: string }) {
  if (type === 'schedule')
    return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (type === 'threshold')
    return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>;
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
}

export function AutomationPanel({ sessionId, onClose }: Props) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [runs, setRuns] = useState<Record<number, AutomationRun[]>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [reporting, setReporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { automations } = await api.listAutomations(sessionId);
      setAutomations(automations);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    setTimeout(() => setNotice(null), 5000);
  };

  const toggle = async (a: Automation) => {
    setAutomations((list) => list.map((x) => (x.id === a.id ? { ...x, enabled: !x.enabled } : x)));
    try {
      await api.updateAutomation(a.id, { enabled: !a.enabled });
    } catch {
      load();
    }
  };

  const runNow = async (a: Automation) => {
    setBusy(a.id);
    try {
      const { outcome } = await api.runAutomation(a.id);
      flash(outcome.status === 'failed' ? 'err' : 'ok', `${a.name}: ${outcome.actionResult}`);
      if (expanded === a.id) loadRuns(a.id);
      load();
    } catch (err) {
      flash('err', err instanceof Error ? err.message : 'Run failed');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (a: Automation) => {
    setAutomations((list) => list.filter((x) => x.id !== a.id));
    try {
      await api.deleteAutomation(a.id);
    } catch {
      load();
    }
  };

  const loadRuns = async (id: number) => {
    try {
      const { runs } = await api.getAutomationRuns(id);
      setRuns((r) => ({ ...r, [id]: runs }));
    } catch {
      /* ignore */
    }
  };

  const toggleExpand = (id: number) => {
    if (expanded === id) {
      setExpanded(null);
    } else {
      setExpanded(id);
      loadRuns(id);
    }
  };

  const sendReport = async () => {
    setReporting(true);
    try {
      const res = await api.sendReport(sessionId);
      if (res.ok) {
        flash('ok', res.via === 'dev' ? 'Report logged to server console (dev mode).' : `Report sent (${res.detail}).`);
      } else {
        flash('err', res.error || 'Could not send report');
      }
    } catch (err) {
      flash('err', err instanceof Error ? err.message : 'Could not send report');
    } finally {
      setReporting(false);
    }
  };

  return (
    <>
      {/* Click-outside overlay */}
      <div className="absolute inset-0 z-30" onClick={onClose} />

      <div
        className="absolute top-0 right-0 bottom-0 z-40 w-[360px] flex flex-col shadow-2xl animate-slide-in"
        style={{ background: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border-muted)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Automations</p>
              <p className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>{automations.length} rule{automations.length !== 1 ? 's' : ''} · runs in the background</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setSettingsOpen(true)} title="Email settings" className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-white/5" style={{ color: 'var(--text-subtle)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" /></svg>
            </button>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-white/5" style={{ color: 'var(--text-subtle)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-4 py-3 shrink-0">
          <button onClick={() => setBuilderOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-white transition-colors"
            style={{ background: '#7c3aed' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
            New automation
          </button>
          <button onClick={sendReport} disabled={reporting} title="Email a snapshot of this session now"
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--text-muted)' }}>
            {reporting ? 'Sending…' : 'Send report'}
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 pb-4">
          {loading ? (
            <div className="flex justify-center pt-10"><div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" /></div>
          ) : automations.length === 0 ? (
            <div className="text-center pt-12 px-4">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No automations yet.</p>
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-subtle)' }}>Create one to have Morph email you reports, alerts, and reminders automatically.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {automations.map((a) => (
                <div key={a.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-muted)' }}>
                  <div className="p-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: a.enabled ? 'rgba(124,58,237,0.15)' : 'var(--bg-card)', color: a.enabled ? '#a78bfa' : 'var(--text-subtle)' }}>
                        <TriggerIcon type={a.trigger_type} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold leading-tight truncate" style={{ color: 'var(--text)' }}>{a.name}</p>
                        <p className="text-[10px] mt-0.5 leading-tight" style={{ color: 'var(--text-subtle)' }}>{describeTrigger(a)}</p>
                      </div>
                      {/* Enable toggle */}
                      <button onClick={() => toggle(a)} title={a.enabled ? 'Enabled' : 'Disabled'}
                        className="shrink-0 inline-flex w-8 h-[18px] rounded-full transition-colors relative"
                        style={{ background: a.enabled ? '#7c3aed' : 'var(--border)' }}>
                        <span className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform" style={{ transform: a.enabled ? 'translateX(15px)' : 'translateX(2px)' }} />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 mt-2.5">
                      <button onClick={() => runNow(a)} disabled={busy === a.id}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors disabled:opacity-50"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-muted)', color: 'var(--text-muted)' }}>
                        {busy === a.id ? 'Running…' : 'Run now'}
                      </button>
                      <button onClick={() => toggleExpand(a.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-muted)', color: 'var(--text-muted)' }}>
                        {expanded === a.id ? 'Hide runs' : 'History'}
                      </button>
                      {a.run_count > 0 && <span className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>{a.run_count} run{a.run_count !== 1 ? 's' : ''}</span>}
                      <button onClick={() => remove(a)} title="Delete"
                        className="ml-auto w-6 h-6 flex items-center justify-center rounded-md transition-colors hover:bg-red-500/10"
                        style={{ color: 'var(--text-subtle)' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    </div>
                  </div>

                  {/* Run history */}
                  {expanded === a.id && (
                    <div className="px-3 pb-3 pt-1" style={{ borderTop: '1px solid var(--border-muted)' }}>
                      {(runs[a.id] ?? []).length === 0 ? (
                        <p className="text-[10px] pt-2" style={{ color: 'var(--text-subtle)' }}>No runs recorded yet.</p>
                      ) : (
                        <div className="flex flex-col gap-1 pt-2">
                          {(runs[a.id] ?? []).map((r) => (
                            <div key={r.id} className="flex items-center gap-2 text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_COLOR[r.status] ?? '#9ca3af' }} />
                              <span className="shrink-0" style={{ color: 'var(--text-subtle)' }}>{timeAgo(r.executed_at)}</span>
                              <span className="truncate" style={{ color: 'var(--text-muted)' }}>{r.error_message || r.action_result || r.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notice */}
        {notice && (
          <div className="px-4 py-2.5 shrink-0 text-[11px]" style={{
            borderTop: '1px solid var(--border-muted)',
            background: notice.kind === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            color: notice.kind === 'ok' ? '#34d399' : '#f87171',
          }}>
            {notice.text}
          </div>
        )}
      </div>

      {builderOpen && (
        <AutomationBuilder
          sessionId={sessionId}
          onClose={() => setBuilderOpen(false)}
          onCreated={(a) => {
            setAutomations((list) => [a, ...list]);
            setBuilderOpen(false);
            flash('ok', `"${a.name}" activated.`);
          }}
        />
      )}
      {settingsOpen && <EmailSettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  );
}
