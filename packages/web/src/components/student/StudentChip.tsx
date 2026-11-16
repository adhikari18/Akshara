'use client';

import React from 'react';
import Link from 'next/link';
import { getActiveChild } from '@/lib/progress';
import { useProgress } from '@/components/shell/useProgress';

/** Header chip: who is learning (tap to switch on the student home). */
export function StudentChip() {
  const child = getActiveChild(useProgress());
  return (
    <Link
      href="/student/"
      aria-label={
        child ? `Learning as ${child.name} — switch` : 'Playing as guest — pick who is learning'
      }
      className="flex items-center gap-1 rounded-2xl border border-line bg-card px-3 min-h-[40px] text-sm font-bold text-ink"
    >
      <span aria-hidden className="text-lg">
        {child?.avatar ?? '👤'}
      </span>
      {child?.name ?? 'Guest'}
    </Link>
  );
}
