'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { NUMERAL_LIST, STROKE_LIST } from '@akshara/data';
import { FontPicker } from '@/components/FontPicker';
import { DEVANAGARI_FONTS, getFont, glyphText, loadFont } from '@/lib/devanagariFonts';

const SAMPLE_IDS = ['ka', 'kha', 'ga', 'bha', 'a', 'i', 'num-2', 'num-5', 'num-6'];
const FONT_CHOICE_KEY = 'akshara.trace-trainer.fonts';

/**
 * Admin font page: every available Devanagari font side by side on the same letters, the default
 * display font, and the per-letter training-font choices made in the Trace Trainer.
 */
export function FontManager() {
  const [ready, setReady] = useState(0);
  useEffect(() => {
    let alive = true;
    Promise.all(DEVANAGARI_FONTS.map((f) => loadFont(f))).then(
      () => alive && setReady((n) => n + 1)
    );
    return () => {
      alive = false;
    };
  }, []);
  const choices = useMemo<Record<string, string>>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(FONT_CHOICE_KEY) ?? '{}') as Record<
        string,
        string
      >;
    } catch {
      return {};
    }
    // re-read after fonts load so a choice made in another tab shows up
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  const samples = SAMPLE_IDS.map((id) =>
    [...STROKE_LIST, ...NUMERAL_LIST].find((d) => d.id === id)!
  ).filter(Boolean);

  return (
    <div className="space-y-5">
      <h1 className="text-xl sm:text-2xl font-black text-ink">फन्ट • Fonts</h1>

      <section
        className="rounded-3xl border-2 border-line bg-card p-4 space-y-2"
        aria-labelledby="display-font-heading"
      >
        <h2 id="display-font-heading" className="font-black text-ink">
          Display font
        </h2>
        <p className="text-sm text-ink-soft">
          The font Devanagari text is shown in across the app on this device (English text is not
          affected).
        </p>
        <FontPicker />
      </section>

      <section
        className="rounded-3xl border-2 border-line bg-card p-4 space-y-3"
        aria-labelledby="compare-heading"
      >
        <h2 id="compare-heading" className="font-black text-ink">
          Compare fonts
        </h2>
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-soft">
                <th className="p-2">Font</th>
                <th className="p-2">Source</th>
                {samples.map((d) => (
                  <th key={d.id} className="p-2 text-center">
                    {d.character}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DEVANAGARI_FONTS.map((font) => (
                <tr key={font.id} className="border-t border-line">
                  <td className="p-2">
                    <span className="block font-bold text-ink">{font.name}</span>
                    <span className="block text-[11px] text-ink-faint">{font.style}</span>
                  </td>
                  <td className="p-2 text-xs text-ink-soft">
                    {font.source === 'local'
                      ? 'Bundled'
                      : font.source === 'google'
                        ? 'Google Fonts'
                        : 'Device'}
                    {font.encoding === 'preeti' && ' • Preeti layout (training only)'}
                  </td>
                  {samples.map((d) => (
                    <td key={d.id} className="p-2 text-center">
                      <span
                        className="text-3xl text-ink"
                        style={
                          font.source === 'system'
                            ? undefined
                            : { fontFamily: `"${font.family}", sans-serif` }
                        }
                      >
                        {glyphText(font, d.id, d.character)}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className="rounded-3xl border-2 border-line bg-card p-4 space-y-2"
        aria-labelledby="choices-heading"
      >
        <h2 id="choices-heading" className="font-black text-ink">
          Training font per letter
        </h2>
        <p className="text-sm text-ink-soft">
          Chosen in the Trace Trainer: the font whose version of the letter is traced over when
          correcting strokes.
        </p>
        {Object.keys(choices).length === 0 ? (
          <p className="text-sm text-ink-faint">No choices yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2" aria-label="Training font choices">
            {Object.entries(choices).map(([id, fontId]) => {
              const d = [...STROKE_LIST, ...NUMERAL_LIST].find((g) => g.id === id);
              const font = getFont(fontId);
              return (
                <li key={id} className="rounded-xl bg-sunken px-3 py-2 text-sm">
                  <span className="text-xl font-black text-ink">{d?.character ?? id}</span>{' '}
                  <span className="text-ink-soft">
                    → {fontId === 'current' ? 'current stroke data' : font.name}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
