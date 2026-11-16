'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  NUMERAL_LIST,
  SENTENCES,
  STROKE_LIST,
  WORDS,
  validateLetterDataset,
  type LetterStrokeDataset,
} from '@akshara/data';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? '') as T;
  } catch {
    return fallback;
  }
}

/**
 * Admin home: every glyph in the bundled content with its stroke count, data validity, whether
 * a correction is being drafted in the Trace Trainer on this device, and its chosen font.
 */
export function ContentOverview() {
  const [filter, setFilter] = useState<'all' | 'letters' | 'numbers'>('all');
  const drafts = useMemo(
    () => readJson<Record<string, unknown[]>>('akshara.trace-trainer.drafts', {}),
    []
  );
  const fonts = useMemo(
    () => readJson<Record<string, string>>('akshara.trace-trainer.fonts', {}),
    []
  );
  const rows: LetterStrokeDataset[] =
    filter === 'letters'
      ? STROKE_LIST
      : filter === 'numbers'
        ? NUMERAL_LIST
        : [...STROKE_LIST, ...NUMERAL_LIST];
  const invalid = [...STROKE_LIST, ...NUMERAL_LIST].filter((d) => !validateLetterDataset(d).valid);
  const drafted = Object.entries(drafts).filter(([, v]) => Array.isArray(v) && v.length > 0).length;

  return (
    <div className="space-y-5">
      <h1 className="text-xl sm:text-2xl font-black text-ink">सामग्री • Content</h1>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {[
          ['Letters', STROKE_LIST.length],
          ['Numerals', NUMERAL_LIST.length],
          ['Words', WORDS.length],
          ['Sentences', SENTENCES.length],
          ['Corrections in progress', drafted],
          ['Data problems', invalid.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border-2 border-line bg-card p-3">
            <dt className="text-xs font-bold text-ink-soft">{label}</dt>
            <dd className="text-2xl font-black text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <section
        className="rounded-3xl border-2 border-line bg-card p-4 space-y-3"
        aria-labelledby="glyphs-heading"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="glyphs-heading" className="font-black text-ink">
            Stroke data
          </h2>
          <div role="tablist" aria-label="Filter" className="flex gap-1">
            {(['all', 'letters', 'numbers'] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={`rounded-xl px-3 py-1 text-sm font-bold ${filter === f ? 'bg-slate-700 text-white' : 'bg-sunken text-ink-soft'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-soft">
                <th className="p-2">Glyph</th>
                <th className="p-2">Id</th>
                <th className="p-2">Category</th>
                <th className="p-2">Strokes</th>
                <th className="p-2">Data</th>
                <th className="p-2">Training font</th>
                <th className="p-2">Draft</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const v = validateLetterDataset(d);
                const draft = (drafts[d.id] as unknown[] | undefined)?.length ?? 0;
                return (
                  <tr key={d.id} className="border-t border-line">
                    <td className="p-2 text-2xl font-black text-ink">{d.character}</td>
                    <td className="p-2 font-mono text-xs text-ink-soft">{d.id}</td>
                    <td className="p-2 text-ink-soft">{d.category}</td>
                    <td className="p-2 text-ink">{d.strokes.length}</td>
                    <td className="p-2">
                      {v.valid ? (
                        <span className="text-emerald-600 font-bold">✓ valid</span>
                      ) : (
                        <span className="text-rose-600 font-bold" title={v.errors.join('\n')}>
                          ✕ {v.errors.length} issue{v.errors.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-ink-soft">{fonts[d.id] ?? '—'}</td>
                    <td className="p-2 text-ink-soft">
                      {draft ? `${draft} stroke${draft === 1 ? '' : 's'}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-faint">
          Correct a glyph&apos;s strokes in the{' '}
          <Link href="/admin/trainer/" className="font-bold underline">
            Trace Trainer
          </Link>
          , export its JSON and replace <code>packages/data/strokes/&lt;id&gt;.json</code>.
        </p>
      </section>
    </div>
  );
}
