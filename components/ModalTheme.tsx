'use client';

export type ModalTheme = 'dark' | 'dim' | 'light';

export interface ThemeVars {
  // Surfaces
  bg:      string;   // modal background
  bg2:     string;   // panel / card background
  bg3:     string;   // table-header background
  // Borders
  border:  string;
  border2: string;
  // Text
  text1:   string;   // headings / primary
  text2:   string;   // body
  text3:   string;   // muted labels
  text4:   string;   // ultra-muted / placeholders
  // Overlay
  overlay: string;
  // Input colours (all as hex/rgba — no Tailwind classes)
  inputBg:   string;
  inputBorder: string;
  inputText:   string;
  placeholder: string;
}

export const THEMES: Record<ModalTheme, ThemeVars> = {
  dark: {
    bg:      '#141420',
    bg2:     '#1a1a28',
    bg3:     '#161622',
    border:  '#26263a',
    border2: '#2a2a3a',
    text1:   '#f4f4f5',
    text2:   '#a1a1aa',
    text3:   '#71717a',
    text4:   '#3f3f46',
    overlay: 'rgba(0,0,0,0.65)',
    inputBg:     '#1a1a28',
    inputBorder: '#2a2a3a',
    inputText:   '#e4e4e7',
    placeholder: '#3f3f46',
  },
  dim: {
    bg:      '#1e1e2e',
    bg2:     '#262636',
    bg3:     '#222232',
    border:  '#30304a',
    border2: '#3a3a58',
    text1:   '#e4e4e7',
    text2:   '#a1a1aa',
    text3:   '#71717a',
    text4:   '#52525b',
    overlay: 'rgba(0,0,0,0.55)',
    inputBg:     '#262636',
    inputBorder: '#3a3a58',
    inputText:   '#d4d4d8',
    placeholder: '#52525b',
  },
  light: {
    bg:      '#ffffff',
    bg2:     '#f5f5fb',
    bg3:     '#ececf6',
    border:  '#e2e2f0',
    border2: '#d4d4e8',
    text1:   '#18181b',
    text2:   '#52525b',
    text3:   '#71717a',
    text4:   '#a1a1aa',
    overlay: 'rgba(0,0,0,0.4)',
    inputBg:     '#ffffff',
    inputBorder: '#d4d4e8',
    inputText:   '#18181b',
    placeholder: '#a1a1aa',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function inputStyle(t: ThemeVars): React.CSSProperties {
  return {
    background:  t.inputBg,
    border:      `1px solid ${t.inputBorder}`,
    color:       t.inputText,
  };
}

export function selectStyle(t: ThemeVars): React.CSSProperties {
  return {
    background:  t.inputBg,
    border:      `1px solid ${t.inputBorder}`,
    color:       t.inputText,
  };
}

// ─── ThemeToggle component ────────────────────────────────────────────────────

const LABELS: Record<ModalTheme, string> = { dark: 'Dark', dim: 'Dim', light: 'Light' };

const ICONS: Record<ModalTheme, React.ReactNode> = {
  dark: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  dim: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3zm0 2v14a7 7 0 0 1 0-14z" />
    </svg>
  ),
  light: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2"  x2="12" y2="5" />  <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" /> <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
      <line x1="2"  y1="12" x2="5"  y2="12" /> <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" /> <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
    </svg>
  ),
};

export function ThemeToggle({ theme, onChange, t }: {
  theme: ModalTheme;
  onChange: (m: ModalTheme) => void;
  t: ThemeVars;
}) {
  return (
    <div
      className="flex items-center rounded-lg overflow-hidden"
      style={{ border: `1px solid ${t.border2}`, background: t.bg2 }}
    >
      {(['dark', 'dim', 'light'] as ModalTheme[]).map((mode) => {
        const active = theme === mode;
        return (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-all"
            style={{
              color:      active ? '#7c3aed' : t.text3,
              background: active ? 'rgba(124,58,237,0.18)' : 'transparent',
              borderRight: mode !== 'light' ? `1px solid ${t.border2}` : 'none',
            }}
          >
            {ICONS[mode]}
            <span>{LABELS[mode]}</span>
          </button>
        );
      })}
    </div>
  );
}
