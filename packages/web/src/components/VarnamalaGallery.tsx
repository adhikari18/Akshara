'use client';

import React from 'react';
import { CONSONANTS, VOWELS } from '@akshara/data';
import { Pencil, Volume2 } from 'lucide-react';
import { speakNepaliPhonics } from '@/lib/audio';
import { HowToPlay } from '@/components/HowToPlay';

interface VarnamalaGalleryProps {
  onTrace: (letterId: string) => void;
}

/** The full alphabet as big, tappable picture cards. */
export function VarnamalaGallery({ onTrace }: VarnamalaGalleryProps) {
  return (
    <div className="space-y-5">
      <HowToPlay
        id="varnamala"
        steps={[
          { emoji: '👆', text: 'Tap a letter to hear it' },
          { emoji: '🖼️', text: 'Look at the picture word' },
          { emoji: '✏️', text: 'Press “Trace” to write it' },
        ]}
      />

      {/* Swor Varna — vowels */}
      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="section-title">
              <span className="text-2xl" aria-hidden>
                🌸
              </span>
              स्वर वर्ण • Vowels (13)
            </h2>
            <p className="text-sm text-ink-soft">
              Swor Varna (13 Nepali Vowels: अ — अः). Tap a card to listen!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {VOWELS.map((v) => (
            <div
              key={v.id}
              className="flex flex-col rounded-3xl border-2 border-pink-200 bg-pink-50/60 p-2 transition hover:-translate-y-0.5 hover:border-pink-400 dark:border-pink-400/25 dark:bg-pink-400/5"
            >
              <button
                type="button"
                onClick={() => speakNepaliPhonics(`${v.character} — ${v.sampleWord}`, v.romanized)}
                aria-label={`Hear ${v.character} (${v.romanized}) — ${v.sampleWord}, ${v.sampleWordMeaning}`}
                className="flex flex-col items-center rounded-2xl p-2 text-center"
              >
                <span className="text-5xl font-black text-pink-600 dark:text-pink-300">
                  {v.character}
                </span>
                <span className="mt-1 text-sm font-bold text-ink-soft">{v.romanized}</span>
                <span className="mt-2 text-3xl" aria-hidden>
                  {v.emoji}
                </span>
                <span className="text-sm font-bold text-ink">{v.sampleWord}</span>
                <span className="text-xs text-ink-faint">{v.sampleWordMeaning}</span>
              </button>
              {v.hasStrokeData && (
                <button
                  type="button"
                  onClick={() => onTrace(v.id)}
                  aria-label={`Trace ${v.character}`}
                  className="mt-1 inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl bg-pink-500 px-2 text-xs font-bold text-white hover:bg-pink-400"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Trace
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Vyanjan Varna — consonants */}
      <section className="card">
        <div className="mb-4">
          <h2 className="section-title">
            <span className="text-2xl" aria-hidden>
              🌳
            </span>
            व्यञ्जन वर्ण • Consonants ({CONSONANTS.length})
          </h2>
          <p className="text-sm text-ink-soft">
            Vyanjan Varna (क — ज्ञ). Tap a card to hear its name and a picture word.
          </p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {CONSONANTS.map((c) => (
            <div
              key={c.id}
              className="flex flex-col rounded-3xl border-2 border-sky-200 bg-sky-50/60 p-2 transition hover:-translate-y-0.5 hover:border-sky-400 dark:border-sky-400/25 dark:bg-sky-400/5"
            >
              <button
                type="button"
                onClick={() => speakNepaliPhonics(`${c.character} — ${c.nepaliName}`, c.romanized)}
                aria-label={`Hear ${c.character} (${c.romanized}) — ${c.sampleWord}, ${c.sampleWordMeaning}`}
                className="relative flex flex-col items-center rounded-2xl p-2 text-center"
              >
                <Volume2 className="absolute right-1 top-1 h-4 w-4 text-sky-400" aria-hidden />
                <span className="text-5xl font-black text-sky-700 dark:text-sky-300">
                  {c.character}
                </span>
                <span className="mt-1 text-sm font-bold text-ink-soft">{c.romanized}</span>
                <span className="mt-2 text-3xl" aria-hidden>
                  {c.emoji}
                </span>
                <span className="text-sm font-bold text-ink">{c.sampleWord}</span>
                <span className="text-xs text-ink-faint">{c.sampleWordMeaning}</span>
              </button>
              {c.hasStrokeData && (
                <button
                  type="button"
                  onClick={() => onTrace(c.id)}
                  aria-label={`Trace ${c.character}`}
                  className="mt-1 inline-flex min-h-[36px] items-center justify-center gap-1 rounded-xl bg-sky-500 px-2 text-xs font-bold text-white hover:bg-sky-400"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Trace
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
