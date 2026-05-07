'use client';

import { SessionConnection } from '@/lib/api';

const INTERVALS = [
  { label: 'Off',     value: null },
  { label: '5 min',  value: 5    },
  { label: '15 min', value: 15   },
  { label: '30 min', value: 30   },
  { label: '1 hr',   value: 60   },
];

const DB_TYPE_COLORS: Record<string, string> = {
  postgresql: '#10b981',
  mysql:      '#f59e0b',
  mongodb:    '#22c55e',
};

function DbIcon({ type }: { type: string }) {
  if (type === 'postgresql') return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
    </svg>
  );
  if (type === 'mysql') return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3C7 3 3 5.69 3 9v6c0 3.31 4 6 9 6s9-2.69 9-6V9c0-3.31-4-6-9-6z"/>
      <path d="M3 9c0 3.31 4 6 9 6s9-2.69 9-6"/>
    </svg>
  );
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2C8 2 6 6 6 10c0 3.5 2 5.5 4 7l2 5 2-5c2-1.5 4-3.5 4-7 0-4-2-8-6-8z"/>
    </svg>
  );
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60)  return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

interface DbSettingsPanelProps {
  connection: SessionConnection;
  isSyncing: boolean;
  lastSynced: Date | null;
  onSync: () => void;
  onAutoSyncChange: (minutes: number | null) => void;
  onClose: () => void;
}

export function DbSettingsPanel({
  connection,
  isSyncing,
  lastSynced,
  onSync,
  onAutoSyncChange,
  onClose,
}: DbSettingsPanelProps) {
  const accentColor = DB_TYPE_COLORS[connection.type] ?? '#10b981';

  return (
    <div
      className="absolute top-14 right-4 z-30 rounded-xl shadow-2xl w-72 animate-fade-in overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5" style={{ borderBottom: '1px solid var(--border-muted)' }}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `${accentColor}18`, color: accentColor }}>
            <DbIcon type={connection.type} />
          </div>
          <div>
            <p className="text-[12px] font-semibold leading-tight" style={{ color: 'var(--text)' }}>{connection.name}</p>
            <p className="text-[10px] leading-tight" style={{ color: 'var(--text-subtle)' }}>
              {connection.host} · {connection.database_name}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded transition-colors"
          style={{ color: 'var(--text-subtle)' }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="px-3.5 py-3 flex flex-col gap-3">
        {/* Tables */}
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-subtle)' }}>
            Synced tables ({connection.imported_tables.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {connection.imported_tables.map((t) => (
              <span
                key={t}
                className="text-[10px] px-2 py-0.5 rounded font-mono"
                style={{ background: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-muted)' }}
              >
                {t.replace(/^s\d+_/, '')}
              </span>
            ))}
          </div>
        </div>

        {/* Last synced */}
        <div className="flex items-center justify-between">
          <p className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>
            Last synced:{' '}
            <span style={{ color: 'var(--text-muted)' }}>
              {lastSynced ? timeAgo(lastSynced) : 'never'}
            </span>
          </p>
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
            style={{
              background: isSyncing ? 'var(--border)' : `${accentColor}18`,
              color: isSyncing ? 'var(--text-subtle)' : accentColor,
              border: `1px solid ${isSyncing ? 'var(--border)' : `${accentColor}40`}`,
              cursor: isSyncing ? 'not-allowed' : 'pointer',
            }}
          >
            {isSyncing ? (
              <div className="w-3 h-3 rounded-full border border-current/30 border-t-current animate-spin" />
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M1 4v6h6M23 20v-6h-6"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/>
              </svg>
            )}
            {isSyncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>

        {/* Auto-sync */}
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-subtle)' }}>
            Auto-sync interval
          </p>
          <div className="flex gap-1 flex-wrap">
            {INTERVALS.map(({ label, value }) => {
              const active = connection.auto_sync_minutes === value;
              return (
                <button
                  key={label}
                  onClick={() => onAutoSyncChange(value)}
                  className="px-2.5 py-1 rounded-md text-[10px] font-medium transition-all"
                  style={{
                    background: active ? 'rgba(124,58,237,0.15)' : 'var(--bg-input)',
                    color: active ? '#a78bfa' : 'var(--text-muted)',
                    border: `1px solid ${active ? 'rgba(124,58,237,0.4)' : 'var(--border-muted)'}`,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {connection.auto_sync_minutes && (
            <p className="text-[9px] mt-1.5" style={{ color: 'var(--text-subtle)' }}>
              Fetches new data every {connection.auto_sync_minutes} min · tables are replaced in full
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
