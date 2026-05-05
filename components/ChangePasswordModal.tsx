'use client';

import { useState, FormEvent, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';

interface Props {
  onClose: () => void;
}

export function ChangePasswordModal({ onClose }: Props) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (next !== confirm) { setError('New passwords do not match'); return; }
    if (next.length < 6) { setError('New password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await api.changePassword(current, next);
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Something went wrong';
      setError(raw.replace(/^API \d+: /, '').replace(/^\{"error":"/, '').replace(/"\}$/, ''));
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) return null;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl p-6"
        style={{
          background: '#1a1a28',
          border: '1px solid #26263a',
          boxShadow: '0 0 0 1px rgba(124,58,237,0.08), 0 24px 48px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Change password</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Enter your current password to confirm</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {success ? (
          <div
            className="flex items-center gap-2 px-3 py-3 rounded-lg text-sm text-emerald-300"
            style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Password updated successfully
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div
                className="px-3 py-2.5 rounded-lg text-xs text-red-300"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                {error}
              </div>
            )}

            {(
              [
                { label: 'Current password', value: current, set: setCurrent, autoFocus: true },
                { label: 'New password',     value: next,    set: setNext,    autoFocus: false },
                { label: 'Confirm new password', value: confirm, set: setConfirm, autoFocus: false },
              ] as const
            ).map(({ label, value, set, autoFocus }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
                <input
                  type="password"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoFocus={autoFocus}
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-all"
                  style={{ background: '#0d0d12', border: '1px solid #26263a' }}
                  onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
                  onBlur={(e)  => (e.target.style.borderColor = '#26263a')}
                />
              </div>
            ))}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                style={{ background: '#26263a' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all cursor-pointer"
                style={{
                  background: loading ? 'rgba(124,58,237,0.5)' : 'linear-gradient(135deg,#7c3aed,#a855f7)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Saving…' : 'Update'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
