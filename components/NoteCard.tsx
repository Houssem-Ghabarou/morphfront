'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import type { Note } from '@/types';

export const NOTE_COLORS: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  yellow: { bg: '#fef9c3', border: '#fde047', text: '#713f12', accent: '#ca8a04' },
  pink:   { bg: '#fce7f3', border: '#f9a8d4', text: '#831843', accent: '#db2777' },
  blue:   { bg: '#dbeafe', border: '#93c5fd', text: '#1e3a8a', accent: '#2563eb' },
  green:  { bg: '#dcfce7', border: '#86efac', text: '#14532d', accent: '#16a34a' },
  purple: { bg: '#ede9fe', border: '#c4b5fd', text: '#4c1d95', accent: '#7c3aed' },
};

interface NoteCardProps {
  note: Note;
  canvasScaleRef?: React.RefObject<number>;
  onSave: (id: number, patch: Partial<Note>) => void;
  onDelete: (id: number) => void;
}

function NoteCardImpl({ note, canvasScaleRef, onSave, onDelete }: NoteCardProps) {
  const [position, setPosition] = useState({ x: note.pos_x, y: note.pos_y });
  const [content, setContent] = useState(note.content);
  const [color, setColor] = useState(note.color in NOTE_COLORS ? note.color : 'yellow');
  const [isDragging, setIsDragging] = useState(false);
  const [appeared, setAppeared] = useState(false);
  const [showColors, setShowColors] = useState(false);

  const positionRef = useRef(position);
  const dragRef = useRef<{ mx: number; my: number; cx: number; cy: number } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { const t = setTimeout(() => setAppeared(true), 10); return () => clearTimeout(t); }, []);

  // Debounced content save
  const queueContentSave = useCallback((next: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onSave(note.id, { content: next }), 600);
  }, [note.id, onSave]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { mx: e.clientX, my: e.clientY, cx: positionRef.current.x, cy: positionRef.current.y };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const s = (canvasScaleRef?.current ?? 1) > 0 ? (canvasScaleRef?.current ?? 1) : 1;
      setPosition({
        x: dragRef.current.cx + (e.clientX - dragRef.current.mx) / s,
        y: dragRef.current.cy + (e.clientY - dragRef.current.my) / s,
      });
    };
    const onUp = () => {
      setIsDragging(false);
      const pos = positionRef.current;
      onSave(note.id, { pos_x: pos.x, pos_y: pos.y });
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDragging, note.id, onSave, canvasScaleRef]);

  const c = NOTE_COLORS[color];

  return (
    <div
      className={`absolute select-none ${appeared ? 'animate-card-appear' : 'opacity-0'} ${isDragging ? 'z-50' : 'z-10'}`}
      style={{
        left: position.x,
        top: position.y,
        width: 230,
        transform: isDragging ? 'rotate(0deg) scale(1.02)' : 'rotate(-1.2deg)',
        transition: isDragging ? 'none' : 'transform 0.18s ease',
      }}
    >
      <div
        className="rounded-lg overflow-hidden flex flex-col"
        style={{
          background: c.bg,
          border: `1px solid ${c.border}`,
          boxShadow: isDragging
            ? '0 16px 36px rgba(0,0,0,0.35)'
            : '0 4px 14px rgba(0,0,0,0.22)',
        }}
      >
        {/* Drag handle / toolbar */}
        <div
          className="flex items-center justify-between px-2 py-1.5 cursor-grab active:cursor-grabbing"
          style={{ background: 'rgba(0,0,0,0.04)', borderBottom: `1px solid ${c.border}` }}
          onMouseDown={handleMouseDown}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c.accent} strokeWidth="2" strokeLinecap="round">
            <path d="M3 15h6M3 9h12M3 5h18M3 19h9" />
          </svg>
          <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
            {/* Color toggle */}
            <button
              onClick={() => setShowColors((v) => !v)}
              title="Change color"
              className="w-4 h-4 rounded-full border border-black/20"
              style={{ background: c.accent }}
            />
            <button
              onClick={() => onDelete(note.id)}
              title="Delete note"
              className="w-5 h-5 flex items-center justify-center rounded transition-colors hover:bg-black/10"
              style={{ color: c.text }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Color palette */}
        {showColors && (
          <div className="flex items-center gap-1.5 px-2 py-1.5" style={{ borderBottom: `1px solid ${c.border}` }} onMouseDown={(e) => e.stopPropagation()}>
            {Object.entries(NOTE_COLORS).map(([key, col]) => (
              <button
                key={key}
                onClick={() => { setColor(key); setShowColors(false); onSave(note.id, { color: key }); }}
                className="w-4 h-4 rounded-full border border-black/20 transition-transform hover:scale-110"
                style={{ background: col.accent, outline: key === color ? `2px solid ${col.text}` : 'none', outlineOffset: 1 }}
              />
            ))}
          </div>
        )}

        {/* Editable body */}
        <textarea
          value={content}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => { setContent(e.target.value); queueContentSave(e.target.value); }}
          onBlur={() => onSave(note.id, { content })}
          placeholder="Write a note…"
          rows={5}
          className="w-full resize-none bg-transparent outline-none px-3 py-2.5 text-[13px] leading-relaxed"
          style={{ color: c.text, minHeight: 96 }}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

export const NoteCard = memo(NoteCardImpl);
