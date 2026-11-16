'use client';

import React, { useState } from 'react';
import { STROKE_DATASETS } from '@akshara/data';
import type { LearnerToleranceMode } from '@akshara/core';
import { ChevronLeft, ChevronRight, RotateCcw, Volume2 } from 'lucide-react';
import { speakNepaliPhonics } from '@/lib/audio';
import { HowToPlay } from '@/components/HowToPlay';
import { usePatiSlate } from '@/components/tracing/usePatiSlate';
import { PatiSlate } from '@/components/tracing/PatiSlate';
import {
  LetterDeck,
  filterDeck,
  stepThroughDeck,
  type DeckCategoryFilter,
} from '@/components/tracing/LetterDeck';
import { StrokeSidebar } from '@/components/tracing/StrokeSidebar';

interface TracingCanvasProps {
  initialLetterId?: string;
}

/**
 * The letter tracing studio. Composes:
 * - `usePatiSlate` / `PatiSlate` — the traceable slate (session, renderer, "Show me" demo)
 * - `LetterDeck` / `StrokeSidebar` — the letter picker and the per-letter side panels
 */
export function TracingCanvas({ initialLetterId = 'ka' }: TracingCanvasProps = {}) {
  const [selectedLetterId, setSelectedLetterId] = useState<string>(initialLetterId);
  const [categoryFilter, setCategoryFilter] = useState<DeckCategoryFilter>('all');
  const [toleranceMode, setToleranceMode] = useState<LearnerToleranceMode>('child');

  // Follow the parent's letter (e.g. "Trace" from the alphabet page) when it changes.
  const [syncedInitialLetterId, setSyncedInitialLetterId] = useState(initialLetterId);
  if (initialLetterId !== syncedInitialLetterId) {
    setSyncedInitialLetterId(initialLetterId);
    if (STROKE_DATASETS[initialLetterId]) setSelectedLetterId(initialLetterId);
  }

  const dataset = STROKE_DATASETS[selectedLetterId] ?? STROKE_DATASETS.ka;
  const slate = usePatiSlate(dataset, toleranceMode);
  const { progress, lastEval, currentStroke } = slate.session;

  const goToLetter = (offset: number) => {
    const next = stepThroughDeck(filterDeck(categoryFilter), selectedLetterId, offset);
    if (next) setSelectedLetterId(next.id);
  };

  const hearLetter = () =>
    speakNepaliPhonics(dataset.phonetics.audioPrompt, dataset.phonetics.romanized);

  return (
    <div className="space-y-5">
      <HowToPlay
        id="tracing"
        steps={[
          { emoji: '🔤', text: 'Pick a letter' },
          { emoji: '👀', text: 'Press “Show me” to watch' },
          { emoji: '👆', text: 'Follow the dots 1, 2, 3… with your finger' },
          { emoji: '⭐', text: 'Finish every line to win stars!' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: the Pati slate */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="card !p-4 sm:!p-5">
            {/* Letter header with prev / next */}
            <div className="flex items-center justify-between gap-2 sm:gap-3 mb-4">
              <button
                type="button"
                onClick={() => goToLetter(-1)}
                aria-label="Previous letter"
                className="btn-soft !px-3"
              >
                <ChevronLeft className="w-6 h-6" aria-hidden />
              </button>

              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-2xl bg-amber-100 dark:bg-amber-400/20 border-2 border-amber-300 dark:border-amber-400/50 flex items-center justify-center text-4xl font-black text-amber-700 dark:text-amber-200">
                  {dataset.character}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-2xl font-black text-ink leading-tight">
                    {dataset.phonetics.nepaliName}
                  </h2>
                  <p className="text-sm font-bold text-ink-soft">
                    “{dataset.phonetics.romanized}”
                    <span className="hidden sm:inline">
                      {' '}
                      • {dataset.strokes.length} {dataset.strokes.length === 1 ? 'line' : 'lines'}{' '}
                      to draw
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={hearLetter}
                  aria-label={`Hear ${dataset.phonetics.nepaliName}`}
                  className="btn-go !rounded-full !px-3"
                >
                  <Volume2 className="w-5 h-5" aria-hidden />
                  <span className="hidden sm:inline">सुन्नुहोस्</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => goToLetter(1)}
                aria-label="Next letter"
                className="btn-soft !px-3"
              >
                <ChevronRight className="w-6 h-6" aria-hidden />
              </button>
            </div>

            <PatiSlate
              slate={slate}
              overlay={
                progress.isLetterComplete && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                    <div className="text-5xl mb-2 animate-pop" aria-hidden>
                      {'⭐'.repeat(Math.max(1, progress.stars))}
                    </div>
                    <div className="w-20 h-20 rounded-3xl bg-emerald-400/20 border-2 border-emerald-300/60 flex items-center justify-center text-5xl font-black text-amber-100 mb-3 animate-pop">
                      {dataset.character}
                    </div>
                    <h3 className="text-2xl font-black text-emerald-300">
                      स्याबास! {dataset.phonetics.nepaliName} पूरा भयो!
                    </h3>
                    <p className="text-sm text-slate-300 mt-1">
                      Great job! Accuracy:{' '}
                      <span className="font-bold text-amber-300">{progress.accuracyScore}%</span>
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
                      <button type="button" onClick={hearLetter} className="btn-go">
                        <Volume2 className="w-5 h-5" aria-hidden />
                        Hear it
                      </button>
                      <button type="button" onClick={slate.reset} className="btn-sky">
                        <RotateCcw className="w-5 h-5" aria-hidden />
                        फेरि लेख्नुहोस् (Again)
                      </button>
                      <button type="button" onClick={() => goToLetter(1)} className="btn-primary">
                        Next letter
                        <ChevronRight className="w-5 h-5" aria-hidden />
                      </button>
                    </div>
                  </div>
                )
              }
            />
          </div>
        </div>

        {/* Right: letter picker, level, words, grown-up details */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <LetterDeck
            filter={categoryFilter}
            onFilterChange={setCategoryFilter}
            selectedLetterId={selectedLetterId}
            onSelectLetter={setSelectedLetterId}
          />
          <StrokeSidebar
            dataset={dataset}
            mode={toleranceMode}
            onModeChange={setToleranceMode}
            progress={progress}
            lastEval={lastEval}
            currentStroke={currentStroke}
            onPickStroke={(index) => slate.demo.goToStroke(index, { play: true })}
            demoStrokeIndex={slate.demo.strokeIndex}
          />
        </div>
      </div>
    </div>
  );
}
