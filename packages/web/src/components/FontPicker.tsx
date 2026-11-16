'use client';

import React, { useEffect, useSyncExternalStore } from 'react';
import {
  DEFAULT_DISPLAY_FONT,
  UNICODE_FONTS,
  applyDisplayFont,
  getFont,
  readDisplayFont,
  saveDisplayFont,
} from '@/lib/devanagariFonts';

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Header control: which font Devanagari text is shown in across the studio. Only the Devanagari
 * characters change; English text keeps the UI font. (The Preeti-layout handwriting font cannot
 * render ordinary Unicode text, so it is offered in the Trace Trainer only.)
 */
export function FontPicker() {
  // Server snapshot is the default so the static export and hydration agree
  const fontId = useSyncExternalStore(subscribe, readDisplayFont, () => DEFAULT_DISPLAY_FONT);

  useEffect(() => {
    void applyDisplayFont(getFont(fontId));
  }, [fontId]);

  return (
    <label className="flex items-center gap-1 rounded-2xl border border-line bg-card px-2 min-h-[40px] text-sm font-bold text-ink-soft">
      <span aria-hidden>अ</span>
      <span className="sr-only">Letter font</span>
      <select
        aria-label="Letter font"
        value={fontId}
        onChange={(e) => {
          saveDisplayFont(e.target.value);
          listeners.forEach((l) => l());
        }}
        className="bg-transparent text-ink max-w-[9rem]"
      >
        {UNICODE_FONTS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
    </label>
  );
}
