'use client';

import React, { useEffect, useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import {
  applyTheme,
  readThemePreference,
  setThemePreference,
  subscribeToSystemTheme,
  subscribeToThemePreference,
  type ThemePreference,
} from '@/lib/theme';

const OPTIONS: Array<{ id: ThemePreference; label: string; Icon: typeof Sun }> = [
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
  { id: 'auto', label: 'Auto', Icon: Monitor },
];

/** Three-way Light / Dark / Auto theme switch. "Auto" follows the device setting live. */
export function ThemeToggle() {
  // Server snapshot is "auto" so SSR and hydration match; the client then reads localStorage.
  const pref = useSyncExternalStore<ThemePreference>(
    subscribeToThemePreference,
    readThemePreference,
    () => 'auto'
  );

  // Keep <html> in sync; while on "auto", follow live OS light/dark changes.
  // Reads storage directly (not `pref`) so the hydration pass — which briefly sees the
  // server snapshot "auto" — never flips the theme the pre-paint script already applied.
  useEffect(() => {
    const current = readThemePreference();
    applyTheme(current);
    if (current !== 'auto') return;
    return subscribeToSystemTheme(() => applyTheme('auto'));
  }, [pref]);

  const choose = (next: ThemePreference) => setThemePreference(next);

  return (
    <div role="radiogroup" aria-label="Color theme" className="segmented !flex-nowrap shrink-0">
      {OPTIONS.map(({ id, label, Icon }) => {
        const active = pref === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${label} theme`}
            title={id === 'auto' ? 'Auto — match my device' : `${label} theme`}
            onClick={() => choose(id)}
            className={`segment inline-flex items-center gap-1.5 !px-2.5 ${active ? 'segment-active' : ''}`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="hidden md:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
