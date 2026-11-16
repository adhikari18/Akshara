'use client';

import React, { useSyncExternalStore } from 'react';
import { STROKE_DATASETS } from '@akshara/data';
import { TracingCanvas } from '@/components/TracingCanvas';
import { NumberStudio } from '@/components/NumberStudio';
import { VarnamalaGallery } from '@/components/VarnamalaGallery';
import { appHref } from '@/components/shell/AppShell';

/** Read a query parameter on the client (static export: there is no server to read it). */
function useQueryParam(name: string): string | null {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('popstate', cb);
      return () => window.removeEventListener('popstate', cb);
    },
    () => new URLSearchParams(window.location.search).get(name),
    () => null
  );
}

/** /student/trace/?letter=kha — the Pati slate, opened on the requested letter. */
export function TracePage() {
  const letter = useQueryParam('letter');
  const initial = letter && STROKE_DATASETS[letter] ? letter : 'ka';
  return <TracingCanvas initialLetterId={initial} />;
}

/** /student/numbers/?n=7 — number practice, opened on the requested number. */
export function NumbersPage() {
  const n = Number(useQueryParam('n'));
  const value = Number.isInteger(n) && n >= 0 && n <= 100 ? n : 1;
  return <NumberStudio key={value} initialValue={value} />;
}

/** /student/alphabet/ — the alphabet gallery; "Trace" opens the letter on the slate. */
export function AlphabetPage() {
  return (
    <VarnamalaGallery
      onTrace={(id) => window.location.assign(appHref(`/student/trace/?letter=${id}`))}
    />
  );
}
