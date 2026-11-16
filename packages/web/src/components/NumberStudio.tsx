'use client';

import React, { useEffect, useRef, useState } from 'react';
import { NUMBERS, NUMERAL_LIST, digitsOf, toDevanagariNumerals } from '@akshara/data';
import type { LearnerToleranceMode, TracingProgressSummary } from '@akshara/core';
import { ChevronLeft, ChevronRight, RotateCcw, Volume2 } from 'lucide-react';
import { speakNepaliPhonics } from '@/lib/audio';
import { HowToPlay } from '@/components/HowToPlay';
import { usePatiSlate } from '@/components/tracing/usePatiSlate';
import { PatiSlate } from '@/components/tracing/PatiSlate';
import { digitDoneText, numberCompleteText, placeValueText } from '@/lib/messages';

export const MAX_NUMBER = 100;
/** Pause after finishing one digit before the slate moves on to the next. */
export const DIGIT_ADVANCE_MS = 900;

const LEVELS: Array<{ mode: LearnerToleranceMode; emoji: string; label: string }> = [
  { mode: 'child', emoji: '🐣', label: 'Easy' },
  { mode: 'standard', emoji: '🐥', label: 'Medium' },
  { mode: 'strict', emoji: '🦅', label: 'Hard' },
];

const wrap = (n: number) => ((n % (MAX_NUMBER + 1)) + MAX_NUMBER + 1) % (MAX_NUMBER + 1);

interface NumberStudioProps {
  initialValue?: number;
}

/**
 * "अङ्क • Numbers": trace any number from ० to १०० on the Pati slate. Multi-digit numbers are
 * written digit by digit, left to right (४२ = ४ then २), each digit being its own tracing task.
 * Alongside: the number's Nepali name, a place-value picture, and a ०–९९ + १०० chart.
 */
export function NumberStudio({ initialValue = 1 }: NumberStudioProps = {}) {
  const [value, setValue] = useState(() => wrap(initialValue));
  const [digitIndex, setDigitIndex] = useState(0);
  /** Bumped to retrace the same number from scratch. */
  const [attempt, setAttempt] = useState(0);
  const [mode, setMode] = useState<LearnerToleranceMode>('child');
  /** Best stars per number this visit, for the chart. */
  const [bestStars, setBestStars] = useState<Record<number, number>>({});
  /** Stars for the number just finished (shown in the celebration). */
  const [resultStars, setResultStars] = useState(0);

  const digitStarsRef = useRef<number[]>([]);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const entry = NUMBERS[value]!;
  const digits = digitsOf(value);
  const isLastDigit = digitIndex === digits.length - 1;
  const dataset = NUMERAL_LIST[digits[digitIndex]!]!;

  const clearAdvance = () => {
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  };
  useEffect(
    () => () => {
      if (advanceTimerRef.current !== null) clearTimeout(advanceTimerRef.current);
    },
    []
  );

  const hearNumber = () => speakNepaliPhonics(entry.nepaliName, String(entry.value));

  const advanceDigit = () => {
    clearAdvance();
    setDigitIndex((i) => Math.min(i + 1, digits.length - 1));
  };

  const handleGlyphComplete = (progress: TracingProgressSummary) => {
    digitStarsRef.current.push(progress.stars);
    if (!isLastDigit) {
      advanceTimerRef.current = setTimeout(advanceDigit, DIGIT_ADVANCE_MS);
      return;
    }
    const stars = Math.min(...digitStarsRef.current);
    setResultStars(stars);
    setBestStars((prev) => ({ ...prev, [value]: Math.max(prev[value] ?? 0, stars) }));
    speakNepaliPhonics(entry.nepaliName, String(entry.value));
  };

  const slate = usePatiSlate(dataset, mode, {
    resetKey: `${value}:${digitIndex}:${attempt}`,
    // Single digits are announced by name as they finish; the number's last digit is
    // announced as the whole number instead (४ … २ … बयालीस!).
    announceCompletion: !isLastDigit,
    onLetterComplete: handleGlyphComplete,
  });
  const { progress } = slate.session;

  const startNumber = (next: number) => {
    clearAdvance();
    digitStarsRef.current = [];
    setValue(wrap(next));
    setDigitIndex(0);
    setAttempt((a) => a + 1);
  };

  const showDigitDone = progress.isLetterComplete && !isLastDigit;
  const showNumberDone = progress.isLetterComplete && isLastDigit;
  const nextDigitChar =
    digits[digitIndex + 1] !== undefined ? toDevanagariNumerals(digits[digitIndex + 1]!) : '';
  const place = placeValueText(value, toDevanagariNumerals);
  const done = numberCompleteText(entry);

  return (
    <div className="space-y-5">
      <HowToPlay
        id="numbers"
        steps={[
          { emoji: '🔢', text: 'Pick a number from the chart' },
          { emoji: '👆', text: 'Trace each digit, left to right' },
          { emoji: '🧮', text: 'Count the blocks: tens and ones' },
          { emoji: '👂', text: 'Hear its Nepali name!' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: the number and its slate */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="card !p-4 sm:!p-5">
            {/* Number header with prev / next */}
            <div className="flex items-center justify-between gap-2 sm:gap-3 mb-4">
              <button
                type="button"
                onClick={() => startNumber(value - 1)}
                aria-label="Previous number"
                className="btn-soft !px-3"
              >
                <ChevronLeft className="w-6 h-6" aria-hidden />
              </button>

              <div className="flex flex-1 flex-wrap items-center justify-center gap-2 sm:gap-3 min-w-0">
                <ol className="flex items-center gap-1 sm:gap-1.5" aria-label="Digits to write">
                  {digits.map((d, idx) => {
                    const status =
                      idx < digitIndex || (idx === digitIndex && progress.isLetterComplete)
                        ? 'done'
                        : idx === digitIndex
                          ? 'now'
                          : 'next';
                    return (
                      <li
                        key={idx}
                        aria-label={`Digit ${toDevanagariNumerals(d)}: ${status}`}
                        className={`relative w-10 h-12 sm:w-14 sm:h-16 rounded-2xl border-2 flex items-center justify-center text-2xl sm:text-4xl font-black transition ${
                          status === 'done'
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-400/15 dark:border-emerald-400/50 dark:text-emerald-200'
                            : status === 'now'
                              ? 'bg-violet-100 border-violet-400 text-violet-800 ring-4 ring-violet-300/40 dark:bg-violet-400/20 dark:text-violet-100'
                              : 'bg-sunken border-line text-ink-faint'
                        }`}
                      >
                        {toDevanagariNumerals(d)}
                        {status === 'done' && (
                          <span className="absolute -top-2 -right-2 text-sm" aria-hidden>
                            ✅
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-2xl font-black text-ink leading-tight break-words">
                    {entry.nepaliName}
                  </h2>
                  <p className="text-sm font-bold text-ink-soft">
                    {entry.value}
                    {entry.alsoCalled ? ` • ${entry.alsoCalled}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={hearNumber}
                  aria-label={`Hear ${entry.nepaliName}`}
                  className="btn-go !rounded-full !px-3"
                >
                  <Volume2 className="w-5 h-5" aria-hidden />
                  <span className="hidden sm:inline">सुन्नुहोस्</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => startNumber(value + 1)}
                aria-label="Next number"
                className="btn-soft !px-3"
              >
                <ChevronRight className="w-6 h-6" aria-hidden />
              </button>
            </div>

            <PatiSlate
              slate={slate}
              overlay={
                showDigitDone ? (
                  <div className="absolute inset-x-0 bottom-0 m-3 rounded-2xl bg-slate-950/85 backdrop-blur-sm p-4 flex items-center justify-between gap-3 animate-fade-in">
                    <div className="text-left">
                      <p className="text-lg font-black text-emerald-300">
                        {digitDoneText(nextDigitChar).ne}
                      </p>
                      <p className="text-sm text-slate-300">{digitDoneText(nextDigitChar).en}</p>
                    </div>
                    <button type="button" onClick={advanceDigit} className="btn-primary shrink-0">
                      Next digit
                      <ChevronRight className="w-5 h-5" aria-hidden />
                    </button>
                  </div>
                ) : showNumberDone ? (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                    <div className="text-5xl mb-2 animate-pop" aria-hidden>
                      {'⭐'.repeat(Math.max(1, resultStars))}
                    </div>
                    <div className="px-5 h-20 rounded-3xl bg-emerald-400/20 border-2 border-emerald-300/60 flex items-center justify-center text-5xl font-black text-amber-100 mb-3 animate-pop">
                      {entry.devanagari}
                    </div>
                    <h3 className="text-2xl font-black text-emerald-300">{done.ne}</h3>
                    <p className="text-sm text-slate-300 mt-1">{done.en}</p>
                    <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
                      <button type="button" onClick={hearNumber} className="btn-go">
                        <Volume2 className="w-5 h-5" aria-hidden />
                        Hear it
                      </button>
                      <button type="button" onClick={() => startNumber(value)} className="btn-sky">
                        <RotateCcw className="w-5 h-5" aria-hidden />
                        फेरि लेख्नुहोस् (Again)
                      </button>
                      <button
                        type="button"
                        onClick={() => startNumber(value + 1)}
                        className="btn-primary"
                      >
                        Next number
                        <ChevronRight className="w-5 h-5" aria-hidden />
                      </button>
                    </div>
                  </div>
                ) : null
              }
            />
          </div>
        </div>

        {/* Right: place value, level, chart */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <PlaceValueCard value={value} label={place} />

          <div className="card">
            <h3 className="section-title mb-3">
              <span aria-hidden>🎯</span> Level
            </h3>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Difficulty">
              {LEVELS.map((level) => (
                <button
                  key={level.mode}
                  type="button"
                  role="radio"
                  aria-checked={mode === level.mode}
                  onClick={() => setMode(level.mode)}
                  className={`tile flex flex-col items-center py-2 ${mode === level.mode ? 'tile-active' : ''}`}
                >
                  <span className="text-2xl" aria-hidden>
                    {level.emoji}
                  </span>
                  <span className="text-sm font-bold">{level.label}</span>
                </button>
              ))}
            </div>
          </div>

          <NumberChart value={value} bestStars={bestStars} onPick={startNumber} />
        </div>
      </div>
    </div>
  );
}

/** Tens as rods of ten, ones as single cubes: a picture of how the number is built. */
function PlaceValueCard({ value, label }: { value: number; label: { ne: string; en: string } }) {
  const tens = value === 100 ? 0 : Math.floor(value / 10);
  const ones = value === 100 ? 0 : value % 10;
  return (
    <div className="card">
      <h3 className="section-title mb-1">
        <span aria-hidden>🧮</span> गन्नुहोस् • Count it
      </h3>
      <p className="text-sm font-bold text-ink-soft mb-3">
        {label.ne} <span className="font-semibold text-ink-faint">({label.en})</span>
      </p>
      <div
        className="flex flex-wrap items-end gap-1.5 min-h-[92px]"
        role="img"
        aria-label={`${value}: ${label.en}`}
        data-testid="place-value"
      >
        {value === 100 && (
          <div className="grid grid-cols-10 gap-[2px] p-1 rounded-lg bg-pink-100 dark:bg-pink-400/15">
            {Array.from({ length: 100 }, (_, i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-[2px] bg-pink-500" />
            ))}
          </div>
        )}
        {Array.from({ length: tens }, (_, t) => (
          <div
            key={`t${t}`}
            data-testid="ten-rod"
            className="flex flex-col gap-[2px] p-[3px] rounded-md bg-amber-100 dark:bg-amber-400/15"
          >
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className="w-2.5 sm:w-3.5 h-[6px] rounded-[2px] bg-amber-500" />
            ))}
          </div>
        ))}
        {ones > 0 && (
          // Ten-frame: ones fill two rows of five, so the group never splits across lines
          <div
            className={`grid grid-cols-5 gap-1 p-1 rounded-md bg-sky-100 dark:bg-sky-400/15 ${tens > 0 ? 'ml-2' : ''}`}
          >
            {Array.from({ length: 10 }, (_, i) =>
              i < ones ? (
                <span key={i} data-testid="one-cube" className="w-4 h-4 rounded bg-sky-500" />
              ) : (
                <span
                  key={i}
                  className="w-4 h-4 rounded border border-dashed border-sky-300 dark:border-sky-400/40"
                />
              )
            )}
          </div>
        )}
        {value === 0 && <span className="text-sm text-ink-faint">शून्य — nothing to count!</span>}
      </div>
    </div>
  );
}

/** ० – ९९ as a 10 × 10 place-value chart (each row shares its tens digit) plus १००. */
function NumberChart({
  value,
  bestStars,
  onPick,
}: {
  value: number;
  bestStars: Record<number, number>;
  onPick: (n: number) => void;
}) {
  const tile = (n: number, extra = '') => {
    const active = n === value;
    const stars = bestStars[n];
    return (
      <button
        key={n}
        type="button"
        data-testid="number-tile"
        aria-pressed={active}
        aria-label={`${toDevanagariNumerals(n)} (${n})${stars ? `, ${stars} stars` : ''}`}
        onClick={() => onPick(n)}
        className={`tile relative flex flex-col items-center justify-center py-1 ${active ? 'tile-active' : ''} ${extra}`}
      >
        <span className="text-base sm:text-lg font-black leading-tight">
          {toDevanagariNumerals(n)}
        </span>
        <span className="text-[10px] font-semibold text-ink-faint leading-none">{n}</span>
        {stars ? (
          <span className="absolute -top-1.5 -right-1 text-[11px]" aria-hidden>
            ⭐
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <div className="card">
      <h3 className="section-title mb-3">
        <span aria-hidden>🔢</span> अङ्क छान्नुहोस् • Pick a number
      </h3>
      <div className="grid grid-cols-10 gap-1" role="group" aria-label="Numbers 0 to 100">
        {Array.from({ length: 100 }, (_, n) => tile(n))}
        {tile(100, 'col-span-10 !flex-row gap-2')}
      </div>
    </div>
  );
}
