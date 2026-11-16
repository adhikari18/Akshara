'use client';

import React from 'react';
import { FontPicker } from '@/components/FontPicker';
import { VoiceSelector } from '@/components/VoiceSelector';
import { lockGrownUpArea } from '@/components/shell/GrownUpGate';

/** Grown-up settings: letter font, voice, and locking the grown-up areas again. */
export function ParentSettings() {
  return (
    <div className="space-y-5">
      <h1 className="text-xl sm:text-2xl font-black text-ink">सेटिङ • Settings</h1>
      <section className="rounded-3xl border-2 border-line bg-card p-4 space-y-2">
        <h2 className="font-black text-ink">Letter font</h2>
        <p className="text-sm text-ink-soft">
          How Nepali letters look across the app on this device.
        </p>
        <FontPicker />
      </section>
      <section className="rounded-3xl border-2 border-line bg-card p-4 space-y-2">
        <h2 className="font-black text-ink">Voice</h2>
        <p className="text-sm text-ink-soft">The voice that reads letters and words aloud.</p>
        <VoiceSelector />
      </section>
      <section className="rounded-3xl border-2 border-line bg-card p-4 space-y-2">
        <h2 className="font-black text-ink">Grown-up areas</h2>
        <p className="text-sm text-ink-soft">
          The Parent and Admin areas stay open for this browser tab once unlocked.
        </p>
        <button type="button" className="btn bg-slate-700 text-white" onClick={lockGrownUpArea}>
          🔒 Lock now
        </button>
      </section>
    </div>
  );
}
