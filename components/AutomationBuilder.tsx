'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { ParsedAutomation, Automation } from '@/types';

interface Props {
  sessionId: number;
  onClose: () => void;
  onCreated: (automation: Automation) => void;
}

const EXAMPLES = [
  'Email me every Monday at 9am with a summary of last week’s orders',
  'Alert me when any product’s stock drops below 10',
  'Remind me 7 days before a contract ends',
  'Every morning at 8am, email me if any orders are still pending',
];

const TEMPLATES = ['report', 'alert', 'reminder'] as const;
const OPERATORS = ['<', '<=', '>', '>=', '=', '!='];

export function AutomationBuilder({ sessionId, onClose, onCreated }: Props) {
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [input, setInput] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<ParsedAutomation | null>(null);
  const [recipients, setRecipients] = useState('');
  const [showSql, setShowSql] = useState(false);

  const generate = async () => {
    if (!input.trim()) return;
    setParsing(true);
    setError(null);
    try {
      const { automation, defaultEmail } = await api.parseAutomation(input, sessionId);
      const ac = (automation.action_config ?? {}) as Record<string, unknown>;
      const to = Array.isArray(ac.to) && ac.to.length > 0 ? (ac.to as string[]).join(', ') : defaultEmail;
      setDraft(automation);
      setRecipients(to);
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not interpret that.');
    } finally {
      setParsing(false);
    }
  };

  const patchTrigger = (key: string, value: unknown) =>
    setDraft((d) => (d ? { ...d, trigger_config: { ...d.trigger_config, [key]: value } } : d));
  const patchAction = (key: string, value: unknown) =>
    setDraft((d) => (d ? { ...d, action_config: { ...d.action_config, [key]: value } } : d));

  const activate = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const toList = recipients.split(',').map((s) => s.trim()).filter(Boolean);
      const { automation } = await api.createAutomation({
        sessionId,
        name: draft.name,
        description: draft.description ?? null,
        enabled: true,
        trigger_type: draft.trigger_type,
        trigger_config: draft.trigger_config,
        query_sql: draft.query_sql ?? null,
        condition_expr: draft.condition_expr ?? null,
        action_type: 'send_email',
        action_config: { ...draft.action_config, to: toList },
      });
      onCreated(automation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save automation.');
      setSaving(false);
    }
  };

  const tc = (draft?.trigger_config ?? {}) as Record<string, unknown>;
  const ac = (draft?.action_config ?? {}) as Record<string, unknown>;
  const labelCls = 'text-[10px] font-semibold uppercase tracking-widest mb-1 block';
  const inputCls = 'w-full px-2.5 py-1.5 rounded-lg text-xs outline-none';
  const inputStyle = { background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--text)' } as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-muted)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {step === 'input' ? 'New automation' : 'Review & activate'}
            </p>
          </div>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded" style={{ color: 'var(--text-subtle)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="p-5 max-h-[72vh] overflow-y-auto scrollbar-thin">
          {step === 'input' ? (
            <>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Describe what you want to automate — in plain language.</p>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={3}
                placeholder="e.g. Email me every Monday with last week's sales summary"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                style={inputStyle}
                autoFocus
              />
              <div className="flex flex-wrap gap-1.5 mt-3">
                {EXAMPLES.map((ex) => (
                  <button key={ex} onClick={() => setInput(ex)}
                    className="text-[10px] px-2 py-1 rounded-full transition-colors"
                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--text-subtle)' }}>
                    {ex}
                  </button>
                ))}
              </div>
              {error && <p className="text-[11px] mt-3" style={{ color: '#f87171' }}>{error}</p>}
              <button onClick={generate} disabled={parsing || !input.trim()}
                className="w-full mt-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
                style={{ background: '#7c3aed' }}>
                {parsing ? 'Interpreting…' : 'Generate'}
              </button>
            </>
          ) : draft ? (
            <div className="flex flex-col gap-3.5">
              <div>
                <label className={labelCls} style={{ color: 'var(--text-subtle)' }}>Name</label>
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputCls} style={inputStyle} />
              </div>

              {/* Trigger */}
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-muted)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#a78bfa' }}>
                    Trigger · {draft.trigger_type.replace('_', ' ')}
                  </span>
                  {draft.trigger_label && <span className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>{draft.trigger_label}</span>}
                </div>

                {draft.trigger_type === 'schedule' && (
                  <div>
                    <label className={labelCls} style={{ color: 'var(--text-subtle)' }}>Cron expression</label>
                    <input value={(tc.cron as string) ?? ''} onChange={(e) => patchTrigger('cron', e.target.value)} className={inputCls} style={inputStyle} />
                  </div>
                )}

                {draft.trigger_type === 'threshold' && (
                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-2">
                      <label className={labelCls} style={{ color: 'var(--text-subtle)' }}>Table</label>
                      <input value={(tc.table as string) ?? ''} onChange={(e) => patchTrigger('table', e.target.value)} className={inputCls} style={inputStyle} />
                    </div>
                    <div>
                      <label className={labelCls} style={{ color: 'var(--text-subtle)' }}>Column</label>
                      <input value={(tc.column as string) ?? ''} onChange={(e) => patchTrigger('column', e.target.value)} className={inputCls} style={inputStyle} />
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <div>
                        <label className={labelCls} style={{ color: 'var(--text-subtle)' }}>Op</label>
                        <select value={(tc.operator as string) ?? '<'} onChange={(e) => patchTrigger('operator', e.target.value)} className={inputCls} style={inputStyle}>
                          {OPERATORS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls} style={{ color: 'var(--text-subtle)' }}>Val</label>
                        <input type="number" value={(tc.value as number) ?? 0} onChange={(e) => patchTrigger('value', Number(e.target.value))} className={inputCls} style={inputStyle} />
                      </div>
                    </div>
                  </div>
                )}

                {draft.trigger_type === 'date_proximity' && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className={labelCls} style={{ color: 'var(--text-subtle)' }}>Table</label>
                      <input value={(tc.table as string) ?? ''} onChange={(e) => patchTrigger('table', e.target.value)} className={inputCls} style={inputStyle} />
                    </div>
                    <div>
                      <label className={labelCls} style={{ color: 'var(--text-subtle)' }}>Date column</label>
                      <input value={(tc.column as string) ?? ''} onChange={(e) => patchTrigger('column', e.target.value)} className={inputCls} style={inputStyle} />
                    </div>
                    <div>
                      <label className={labelCls} style={{ color: 'var(--text-subtle)' }}>Days before</label>
                      <input type="number" value={(tc.days_before as number) ?? 7} onChange={(e) => patchTrigger('days_before', Number(e.target.value))} className={inputCls} style={inputStyle} />
                    </div>
                  </div>
                )}
              </div>

              {/* Action */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelCls} style={{ color: 'var(--text-subtle)' }}>Send to (comma-separated)</label>
                  <input value={recipients} onChange={(e) => setRecipients(e.target.value)} className={inputCls} style={inputStyle} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls} style={{ color: 'var(--text-subtle)' }}>Subject</label>
                  <input value={(ac.subject as string) ?? draft.name} onChange={(e) => patchAction('subject', e.target.value)} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-subtle)' }}>Email style</label>
                  <select value={(ac.template as string) ?? 'report'} onChange={(e) => patchAction('template', e.target.value)} className={inputCls} style={inputStyle}>
                    {TEMPLATES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls} style={{ color: 'var(--text-subtle)' }}>Only if data found</label>
                  <select value={draft.condition_expr ? 'yes' : 'no'} onChange={(e) => setDraft({ ...draft, condition_expr: e.target.value === 'yes' ? 'rows.length > 0' : null })} className={inputCls} style={inputStyle}>
                    <option value="yes">Yes — skip empty</option>
                    <option value="no">Always send</option>
                  </select>
                </div>
              </div>

              {/* Advanced: query SQL */}
              <div>
                <button onClick={() => setShowSql((v) => !v)} className="text-[11px] font-medium" style={{ color: 'var(--text-subtle)' }}>
                  {showSql ? '▾' : '▸'} Advanced — data query
                </button>
                {showSql && (
                  <textarea value={draft.query_sql ?? ''} onChange={(e) => setDraft({ ...draft, query_sql: e.target.value })} rows={3}
                    className="w-full mt-1.5 px-2.5 py-2 rounded-lg text-[11px] font-mono outline-none resize-none"
                    style={inputStyle} spellCheck={false} />
                )}
              </div>

              {error && <p className="text-[11px]" style={{ color: '#f87171' }}>{error}</p>}

              <div className="flex items-center gap-2 pt-1">
                <button onClick={() => setStep('input')} className="px-4 py-2 rounded-lg text-xs font-medium"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--text-muted)' }}>
                  Back
                </button>
                <button onClick={activate} disabled={saving}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
                  style={{ background: '#7c3aed' }}>
                  {saving ? 'Activating…' : 'Activate automation'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
