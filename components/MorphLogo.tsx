'use client';

import Image from 'next/image';

/** Served from /public — reliable in dev and prod (no import/bundle edge cases). */
export const MORPH_SRC = '/morph.png';

/** Sidebar: icon crop (vibrant M) + readable UI text — full PNG wordmark is illegible on dark UI. */
export function MorphSidebarBrand() {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
        <Image
          src={MORPH_SRC}
          alt=""
          fill
          sizes="36px"
          className="object-cover object-top"
          priority
        />
      </div>
      <div className="min-w-0">
        <span className="font-semibold text-[13px] text-zinc-100 tracking-tight leading-none">
          Morph
        </span>
        <p className="text-[9px] text-zinc-600 leading-none mt-0.5">Business OS</p>
      </div>
    </div>
  );
}

/** Main project canvas (top-left) — same asset, compact. */
export function MorphCanvasBrand() {
  return (
    <div className="flex items-center gap-2 min-w-0 pointer-events-none select-none">
      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-black/90 ring-1 ring-white/10">
        <Image
          src={MORPH_SRC}
          alt=""
          fill
          sizes="32px"
          className="object-cover object-top"
        />
      </div>
      <div>
        <p className="text-[11px] font-semibold text-zinc-400 tracking-tight leading-none">Morph</p>
        <p className="text-[8px] text-zinc-600 leading-none mt-0.5">Project canvas</p>
      </div>
    </div>
  );
}

/** Chat chrome & avatars — square crop of the upper mark. */
export function MorphMark({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dim = size === 'sm' ? 16 : size === 'lg' ? 28 : 24;
  const box =
    size === 'sm' ? 'w-4 h-4 rounded-md' : size === 'lg' ? 'w-7 h-7 rounded-lg' : 'w-6 h-6 rounded-md';
  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-black/80 ring-1 ring-white/10 shadow-[0_0_8px_rgba(124,58,237,0.25)] ${box} ${className}`}
    >
      <Image
        src={MORPH_SRC}
        alt=""
        fill
        sizes={`${dim}px`}
        className="object-cover object-top"
      />
    </div>
  );
}
