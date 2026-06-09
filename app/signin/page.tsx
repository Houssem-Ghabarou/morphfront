'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.login(email.trim(), password);
      router.push('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg.replace(/^API \d+: /, '').replace(/^\{"error":"/, '').replace(/"\}$/, ''));
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = { background: '#0d0d12', border: '1px solid #26263a' } as const;

  return (
    <div className="min-h-screen flex bg-[#0d0d12] text-zinc-100">
      {/* ===== Left brand / hero panel (desktop only) ===== */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12"
        style={{ background: 'linear-gradient(160deg, #14101f 0%, #0d0d12 55%, #0d0d12 100%)' }}
      >
        {/* glow + grid */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 25% 15%, rgba(124,58,237,0.28) 0%, transparent 65%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative inline-flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9l4 4M13 9l-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-xl font-semibold tracking-tight">Morph</span>
        </div>

        <div className="relative">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            Turn plain language
            <br />
            into a living database.
          </h2>
          <p className="mt-4 text-zinc-400 max-w-md leading-relaxed">
            Describe what you need and Morph builds the tables, runs the SQL and lays it out on an interactive canvas — no schema design, no code.
          </p>

          <div className="mt-10 space-y-4">
            {[
              { t: 'Natural-language tables', d: 'Ask for what you want, get a real schema.' },
              { t: 'Powered by PostgreSQL', d: 'A genuine database engine under the hood.' },
              { t: 'Interactive canvas', d: 'Visualize and edit your data live.' },
            ].map((f) => (
              <div key={f.t} className="flex items-start gap-3">
                <div
                  className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.4)' }}
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6.2l2.2 2.2L9.5 3.6" stroke="#c4b5fd" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-200">{f.t}</div>
                  <div className="text-xs text-zinc-500">{f.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-zinc-600">© {new Date().getFullYear()} Morph — iMaxeam</div>
      </div>

      {/* ===== Right form panel ===== */}
      <div className="flex-1 flex items-center justify-center px-4 py-10 relative">
        <div
          className="pointer-events-none absolute inset-0 lg:hidden"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124,58,237,0.18) 0%, transparent 70%)',
          }}
        />

        <div className="w-full max-w-sm relative">
          {/* mobile logo */}
          <div className="text-center mb-8 lg:hidden">
            <div className="inline-flex items-center gap-2 mb-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9l4 4M13 9l-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-xl font-semibold text-zinc-100 tracking-tight">Morph</span>
            </div>
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-bold text-zinc-100">Welcome back</h1>
            <p className="text-sm text-zinc-500 mt-1">Sign in to your workspace to continue.</p>
          </div>

          {/* Social buttons (decorative) */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-zinc-200 transition-colors hover:bg-[#20202f]"
              style={{ background: '#15151f', border: '1px solid #26263a' }}
            >
              <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
              </svg>
              Google
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-zinc-200 transition-colors hover:bg-[#20202f]"
              style={{ background: '#15151f', border: '1px solid #26263a' }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
              </svg>
              GitHub
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1" style={{ background: '#26263a' }} />
            <span className="text-xs text-zinc-600">or continue with email</span>
            <div className="h-px flex-1" style={{ background: '#26263a' }} />
          </div>

          {/* Card */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: '#1a1a28',
              border: '1px solid #26263a',
              boxShadow: '0 0 0 1px rgba(124,58,237,0.06), 0 24px 48px rgba(0,0,0,0.5)',
            }}
          >
            {error && (
              <div
                className="mb-4 px-3 py-2.5 rounded-lg text-sm text-red-300"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-all"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
                  onBlur={(e) => (e.target.style.borderColor = '#26263a')}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-zinc-400">Password</label>
                  <span className="text-xs text-violet-400 hover:text-violet-300 cursor-pointer transition-colors">
                    Forgot password?
                  </span>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-all"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = '#7c3aed')}
                  onBlur={(e) => (e.target.style.borderColor = '#26263a')}
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
                <input type="checkbox" defaultChecked className="accent-violet-500 w-3.5 h-3.5" />
                Keep me signed in
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all mt-1"
                style={{
                  background: loading
                    ? 'rgba(124,58,237,0.5)'
                    : 'linear-gradient(135deg, #7c3aed, #a855f7)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 0 20px rgba(124,58,237,0.3)',
                }}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-zinc-500 mt-5">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
