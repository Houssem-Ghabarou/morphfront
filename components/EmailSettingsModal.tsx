'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { EmailSettings } from '@/types';

interface Props {
  onClose: () => void;
}

const EMPTY: Partial<EmailSettings> = {
  provider: 'smtp',
  host: '',
  port: 587,
  secure: false,
  smtp_user: '',
  smtp_pass: '',
  from_name: '',
  from_email: '',
};

export function EmailSettingsModal({ onClose }: Props) {
  const [form, setForm] = useState<Partial<EmailSettings>>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    api
      .getEmailSettings()
      .then(({ settings }) => {
        if (settings) setForm({ ...EMPTY, ...settings });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof EmailSettings>(key: K, value: EmailSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const { settings } = await api.saveEmailSettings(form);
      setForm({ ...EMPTY, ...settings });
      setFeedback({ kind: 'ok', text: 'Settings saved.' });
    } catch (err) {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      await save();
      const res = await api.testEmail();
      if (res.ok) {
        setFeedback({
          kind: 'ok',
          text:
            res.via === 'dev'
              ? 'No SMTP configured — test email logged to the server console (dev mode).'
              : `Test email sent (${res.detail}).`,
        });
      } else {
        setFeedback({ kind: 'err', text: res.error || 'Test failed' });
      }
    } catch (err) {
      setFeedback({ kind: 'err', text: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const labelCls = 'text-[10px] font-semibold uppercase tracking-widest mb-1 block';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-muted)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Email settings</p>
              <p className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>Used by automations to send on your behalf</p>
            </div>
          </div>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded" style={{ color: 'var(--text-subtle)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {loading ? (
          <div className="p-10 flex justify-center">
            <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-3.5 max-h-[70vh] overflow-y-auto scrollbar-thin">
            <div
              className="px-3 py-2 rounded-lg text-[11px] leading-relaxed"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--text-muted)' }}
            >
              Leave the SMTP fields blank to run in <b>dev mode</b> — emails are logged to the server console instead of being sent, so you can build and test automations without credentials. Fill them in to send real mail (Gmail: host <code>smtp.gmail.com</code>, port <code>587</code>, an app password).
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={{ color: 'var(--text-subtle)' }}>From name</label>
                <input value={form.from_name ?? ''} onChange={(e) => set('from_name', e.target.value)} placeholder="Morph"
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--text)' }} />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--text-subtle)' }}>From email</label>
                <input value={form.from_email ?? ''} onChange={(e) => set('from_email', e.target.value)} placeholder="you@gmail.com"
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--text)' }} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className={labelCls} style={{ color: 'var(--text-subtle)' }}>SMTP host</label>
                <input value={form.host ?? ''} onChange={(e) => set('host', e.target.value)} placeholder="smtp.gmail.com"
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--text)' }} />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--text-subtle)' }}>Port</label>
                <input type="number" value={form.port ?? 587} onChange={(e) => set('port', Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--text)' }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={{ color: 'var(--text-subtle)' }}>SMTP user</label>
                <input value={form.smtp_user ?? ''} onChange={(e) => set('smtp_user', e.target.value)} placeholder="you@gmail.com"
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--text)' }} />
              </div>
              <div>
                <label className={labelCls} style={{ color: 'var(--text-subtle)' }}>SMTP password</label>
                <input type="password" value={form.smtp_pass ?? ''} onChange={(e) => set('smtp_pass', e.target.value)} placeholder="app password"
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--text)' }} />
              </div>
            </div>

            <label className="flex items-center gap-2 text-[11px] cursor-pointer" style={{ color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={form.secure ?? false} onChange={(e) => set('secure', e.target.checked)} />
              Use TLS/SSL (port 465)
            </label>

            {feedback && (
              <div
                className="px-3 py-2 rounded-lg text-[11px]"
                style={{
                  background: feedback.kind === 'ok' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                  border: `1px solid ${feedback.kind === 'ok' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  color: feedback.kind === 'ok' ? '#34d399' : '#f87171',
                }}
              >
                {feedback.text}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button onClick={test} disabled={testing || saving}
                className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-muted)', color: 'var(--text-muted)' }}>
                {testing ? 'Sending…' : 'Send test email'}
              </button>
              <button onClick={save} disabled={saving || testing}
                className="flex-1 py-2 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50"
                style={{ background: '#7c3aed' }}>
                {saving ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
