'use client';

import React, { useMemo, useState } from 'react';
import { CONSONANTS, type ConsonantEntry } from '@akshara/data';
import {
  MATRA_DEFINITIONS,
  fuseConsonantWithMatra,
  generateBarakhari,
  type MatraDefinition,
} from '@akshara/core';
import { GraduationCap, Layers, Volume2 } from 'lucide-react';
import { playStrokeSuccessSound, speakNepaliPhonics } from '@/lib/audio';
import { HowToPlay } from '@/components/HowToPlay';

export function MatraBuilder() {
  const [selectedConsonantId, setSelectedConsonantId] = useState<string>('ka');
  const [selectedMatraId, setSelectedMatraId] = useState<string>('i');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const activeConsonant: ConsonantEntry = useMemo(
    () => CONSONANTS.find((c) => c.id === selectedConsonantId) ?? CONSONANTS[0],
    [selectedConsonantId]
  );

  const fused = useMemo(
    () => fuseConsonantWithMatra(activeConsonant, selectedMatraId),
    [activeConsonant, selectedMatraId]
  );

  const barakhariList = useMemo(() => generateBarakhari(activeConsonant), [activeConsonant]);

  const handleApplyMatra = (matraId: string) => {
    setSelectedMatraId(matraId);
    const result = fuseConsonantWithMatra(activeConsonant, matraId);
    playStrokeSuccessSound(false);
    speakNepaliPhonics(result.compositeAkshara, result.romanized);
  };

  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>, matra: MatraDefinition) => {
    e.dataTransfer.setData('text/plain', matra.id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDropOnAnvil = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const matraId = e.dataTransfer.getData('text/plain');
    if (matraId) {
      handleApplyMatra(matraId);
    }
  };

  return (
    <div className="space-y-5">
      <HowToPlay
        id="matra"
        steps={[
          { emoji: '🔤', text: 'Pick a letter' },
          { emoji: '🪄', text: 'Tap or drag a matra sign' },
          { emoji: '👂', text: 'Hear the new sound!' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 space-y-5">
          {/* Step 1: base consonant */}
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="section-title">
                <span className="step-badge bg-amber-400">1</span>
                अक्षर छान्नुहोस् • Pick a letter
              </h3>
              <span className="text-sm font-semibold text-ink-soft">
                You picked:{' '}
                <strong className="text-ink text-lg">{activeConsonant.character}</strong> (
                {activeConsonant.nepaliName})
              </span>
            </div>

            <div className="grid grid-cols-6 sm:grid-cols-9 gap-2 max-h-64 overflow-y-auto p-1 -m-1">
              {CONSONANTS.map((c) => {
                const active = c.id === selectedConsonantId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setSelectedConsonantId(c.id);
                      const nextFused = fuseConsonantWithMatra(c, selectedMatraId);
                      speakNepaliPhonics(nextFused.compositeAkshara, nextFused.romanized);
                    }}
                    className={`tile flex flex-col items-center py-2 ${active ? 'tile-active' : ''}`}
                  >
                    <span className="text-2xl font-black leading-tight">{c.character}</span>
                    <span className="text-[11px] font-semibold text-ink-faint">{c.romanized}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: matra palette */}
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="section-title">
                <span className="step-badge bg-sky-500">2</span>
                मात्रा थप्नुहोस् • Add a matra sign
              </h3>
              <span className="text-sm text-ink-faint">
                Tap it — or drag it onto the magic box ✨
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {MATRA_DEFINITIONS.map((m) => {
                const active = m.id === selectedMatraId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    draggable
                    aria-pressed={active}
                    data-testid="matra-card"
                    data-matra-id={m.id}
                    onDragStart={(e) => handleDragStart(e, m)}
                    onClick={() => handleApplyMatra(m.id)}
                    className={`tile p-2.5 flex flex-col items-center text-center cursor-grab active:cursor-grabbing ${
                      active
                        ? '!border-sky-400 !bg-sky-100 !text-sky-900 ring-4 ring-sky-300/40 shadow-md dark:!bg-sky-400/20 dark:!text-sky-100'
                        : ''
                    }`}
                  >
                    <span className="text-3xl font-black text-sky-600 dark:text-sky-300">
                      {m.matraSign ? `◌${m.matraSign}` : 'अ'}
                    </span>
                    <span className="text-sm font-bold mt-1">{m.vowelChar}</span>
                    <span className="text-[11px] text-ink-faint">{m.nameNepali}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Step 3: result "magic box" (drop target) */}
        <div className="lg:col-span-5">
          <div
            role="region"
            aria-label="Matra drop zone"
            data-testid="matra-anvil"
            data-drag-over={isDragOver ? 'true' : 'false'}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDropOnAnvil}
            className={`card lg:sticky lg:top-24 border-2 flex flex-col items-center text-center transition ${
              isDragOver
                ? '!border-amber-400 !bg-amber-50 dark:!bg-amber-400/10 scale-[1.02]'
                : '!border-amber-200 dark:!border-amber-400/30'
            }`}
          >
            <h3 className="section-title self-start mb-4">
              <span className="step-badge bg-emerald-500">3</span>
              हेर्नुहोस् र सुन्नुहोस् • See &amp; hear
            </h3>

            {/* Fusion equation */}
            <div className="flex items-center justify-center gap-2 sm:gap-3">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-400/15 border-2 border-amber-300 dark:border-amber-400/40 flex items-center justify-center text-4xl font-black text-amber-700 dark:text-amber-200">
                  {fused.baseConsonant}
                </div>
                <span className="text-xs font-bold text-ink-faint mt-1">letter</span>
              </div>

              <span className="text-2xl font-black text-ink-faint" aria-hidden>
                +
              </span>

              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-sky-100 dark:bg-sky-400/15 border-2 border-sky-300 dark:border-sky-400/40 flex items-center justify-center text-4xl font-black text-sky-700 dark:text-sky-200">
                  {fused.matraSign ? `◌${fused.matraSign}` : 'अ'}
                </div>
                <span className="text-xs font-bold text-ink-faint mt-1">sign</span>
              </div>

              <span className="text-2xl font-black text-ink-faint" aria-hidden>
                =
              </span>

              <div className="flex flex-col items-center">
                <div
                  key={fused.compositeAkshara}
                  className="w-24 h-24 rounded-3xl bg-emerald-100 dark:bg-emerald-400/15 border-4 border-emerald-400 flex items-center justify-center text-6xl font-black text-emerald-800 dark:text-emerald-100 shadow-lg animate-pop"
                >
                  {fused.compositeAkshara}
                </div>
                <span className="text-sm font-black text-emerald-700 dark:text-emerald-300 mt-1">
                  “{fused.romanized}”
                </span>
              </div>
            </div>

            <button
              type="button"
              aria-label={`Speak ${fused.compositeAkshara} (${fused.romanized})`}
              onClick={() => speakNepaliPhonics(fused.compositeAkshara, fused.romanized)}
              className="btn-go mt-5 !text-base !px-6"
            >
              <Volume2 className="w-5 h-5" aria-hidden />
              सुन्नुहोस् • Hear “{fused.compositeAkshara}”
            </button>

            {/* Where does the sign go? */}
            <div className="w-full mt-5 pt-4 border-t border-line text-left">
              <p className="text-sm font-bold text-ink mb-2">Where does the sign go?</p>
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    { pos: 'left', label: '⬅️ Left' },
                    { pos: 'top', label: '⬆️ Top' },
                    { pos: 'bottom', label: '⬇️ Bottom' },
                    { pos: 'right', label: '➡️ Right' },
                  ] as const
                ).map(({ pos, label }) => {
                  const activePos = fused.position === pos;
                  return (
                    <div
                      key={pos}
                      className={`py-2 px-1 rounded-xl text-center text-xs font-bold border-2 ${
                        activePos
                          ? 'border-amber-400 bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-100'
                          : 'border-line bg-sunken text-ink-faint'
                      }`}
                    >
                      {label}
                    </div>
                  );
                })}
              </div>
              <p className="text-sm text-ink-soft mt-3 leading-relaxed">{fused.pedagogicalNote}</p>

              <details className="grownups mt-3">
                <summary>
                  <GraduationCap className="w-4 h-4" aria-hidden />
                  For grown-ups: Unicode
                </summary>
                <p className="mt-2 text-xs text-ink-soft">
                  <Layers className="inline w-3.5 h-3.5 mr-1" aria-hidden />
                  {fused.unicodeSequence} • IPA {fused.ipa} • position: {fused.position}
                </p>
              </details>
            </div>
          </div>
        </div>
      </div>

      {/* Barakhari ribbon */}
      <div className="card">
        <h3 className="section-title mb-1">
          <span aria-hidden>🎵</span> बाह्रखरी • Barakhari of “{activeConsonant.character}”
        </h3>
        <p className="text-sm text-ink-soft mb-3">
          All 13 sounds of {activeConsonant.character} — tap each one and say it out loud!
        </p>

        <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-[repeat(13,minmax(0,1fr))] gap-2">
          {barakhariList.map((item) => {
            const active = item.matraId === selectedMatraId;
            return (
              <button
                key={item.matraId}
                type="button"
                aria-pressed={active}
                onClick={() => handleApplyMatra(item.matraId)}
                className={`tile flex flex-col items-center p-2 ${active ? 'tile-active' : ''}`}
              >
                <span className="text-2xl font-black">{item.compositeAkshara}</span>
                <span className="text-xs font-semibold text-ink-faint">{item.romanized}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
