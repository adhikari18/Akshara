'use client';

import React, { useState } from 'react';
import { STROKE_DATASETS } from '@akshara/data';
import type { LearnerToleranceMode } from '@akshara/core';
import {
  ChevronLeft,
  ChevronRight,
  Eraser,
  Eye,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { speakNepaliPhonics } from '@/lib/audio';
import { HowToPlay } from '@/components/HowToPlay';
import { tracingHintText } from '@/lib/messages';
import { useTracingSession } from '@/components/tracing/useTracingSession';
import { LOGICAL_SIZE, usePatiRenderer } from '@/components/tracing/usePatiRenderer';
import { useAutoDemo } from '@/components/tracing/useAutoDemo';
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
 * The Pati tracing studio. Composes:
 * - `useTracingSession` — evaluator, chalk, pen state & feedback sounds (headless)
 * - `usePatiRenderer`   — paints the session onto the slate canvas
 * - `useAutoDemo`       — the "Show me" auto-trace
 * - `LetterDeck` / `StrokeSidebar` — the letter picker and the per-letter side panels
 */
export function TracingCanvas({ initialLetterId = 'ka' }: TracingCanvasProps = {}) {
  const [selectedLetterId, setSelectedLetterId] = useState<string>(initialLetterId);
  const [categoryFilter, setCategoryFilter] = useState<DeckCategoryFilter>('all');
  const [toleranceMode, setToleranceMode] = useState<LearnerToleranceMode>('child');
  const [showGhostGuide, setShowGhostGuide] = useState<boolean>(true);
  const [showWaypoints, setShowWaypoints] = useState<boolean>(true);

  // Follow the parent's letter (e.g. "Trace" from the alphabet page) when it changes.
  const [syncedInitialLetterId, setSyncedInitialLetterId] = useState(initialLetterId);
  if (initialLetterId !== syncedInitialLetterId) {
    setSyncedInitialLetterId(initialLetterId);
    if (STROKE_DATASETS[initialLetterId]) setSelectedLetterId(initialLetterId);
  }

  const dataset = STROKE_DATASETS[selectedLetterId] ?? STROKE_DATASETS.ka;
  const session = useTracingSession(dataset, toleranceMode);
  const { canvasRef, toLogicalPoint } = usePatiRenderer(session, { showGhostGuide, showWaypoints });
  const demo = useAutoDemo(session);
  const { progress, lastEval, currentStroke } = session;

  // --- Pointer glue: DOM events → logical points → session -------------------------------
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (demo.isPlaying || progress.isLetterComplete) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    session.penDown(toLogicalPoint(e.clientX, e.clientY));
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (demo.isPlaying) return;
    session.penMove(toLogicalPoint(e.clientX, e.clientY));
  };
  const handlePointerUp = () => session.penUp();

  const handleReset = () => {
    demo.stop();
    session.reset();
  };

  const goToLetter = (offset: number) => {
    const next = stepThroughDeck(filterDeck(categoryFilter), selectedLetterId, offset);
    if (next) setSelectedLetterId(next.id);
  };

  const hearLetter = () =>
    speakNepaliPhonics(dataset.phonetics.audioPrompt, dataset.phonetics.romanized);

  const hintText = tracingHintText(lastEval?.hint ?? { code: 'follow-stroke' }, {
    dataset,
    currentStroke,
  });

  const bubbleClass = lastEval?.topologicalViolation
    ? 'bubble-bad'
    : progress.isLetterComplete
      ? 'bubble-good'
      : lastEval?.isOffTrack || lastEval?.cornerCut
        ? 'bubble-warn'
        : 'bubble-neutral';

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

            {/* Speech-bubble instruction */}
            <div className={`${bubbleClass} mb-4`} role="status" aria-live="polite">
              <span className="text-3xl leading-none" aria-hidden>
                {lastEval?.topologicalViolation
                  ? '🙈'
                  : progress.isLetterComplete
                    ? '🎉'
                    : lastEval?.cornerCut
                      ? '↩️'
                      : lastEval?.isOffTrack
                        ? '🤏'
                        : '🦉'}
              </span>
              <div>
                <p className="font-extrabold text-base sm:text-lg leading-snug">{hintText.ne}</p>
                <p className="text-sm opacity-80 mt-0.5">{hintText.en}</p>
              </div>
            </div>

            {/* Wooden Pati frame + slate canvas */}
            <div className="rounded-[2rem] p-3 sm:p-4 bg-gradient-to-br from-amber-700 via-amber-800 to-amber-700 dark:from-amber-950 dark:via-stone-900 dark:to-amber-950 border-4 border-amber-900/60 shadow-xl">
              <div className="relative mx-auto w-full max-w-[min(560px,70vh)] aspect-square rounded-2xl overflow-hidden border-2 border-stone-800 shadow-inner bg-[#12161b]">
                <canvas
                  ref={canvasRef}
                  width={LOGICAL_SIZE}
                  height={LOGICAL_SIZE}
                  role="img"
                  aria-label={`Pati slate for tracing ${dataset.character}`}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  className="w-full h-full touch-none cursor-crosshair select-none"
                />

                {/* Celebration overlay */}
                {progress.isLetterComplete && (
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
                      <button type="button" onClick={handleReset} className="btn-sky">
                        <RotateCcw className="w-5 h-5" aria-hidden />
                        फेरि लेख्नुहोस् (Again)
                      </button>
                      <button type="button" onClick={() => goToLetter(1)} className="btn-primary">
                        Next letter
                        <ChevronRight className="w-5 h-5" aria-hidden />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Stroke progress dots */}
              <ol
                className="flex items-center justify-center gap-2 mt-3"
                aria-label="Lines to draw"
              >
                {dataset.strokes.map((stroke, idx) => {
                  const isDone = idx < progress.completedStrokeIds.length;
                  const isCurrent =
                    !progress.isLetterComplete && idx === progress.currentStrokeIndex;
                  return (
                    <li
                      key={stroke.id}
                      aria-label={`Line ${stroke.order}${isDone ? ' done' : isCurrent ? ' — now' : ''}`}
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black border-2 transition ${
                        isDone
                          ? 'bg-emerald-400 border-emerald-200 text-emerald-950'
                          : isCurrent
                            ? 'bg-amber-300 border-white text-amber-950 scale-110 shadow-lg'
                            : 'bg-amber-950/40 border-amber-200/30 text-amber-100/70'
                      }`}
                    >
                      {isDone ? '✓' : stroke.order}
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Main controls */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
              <button
                type="button"
                onClick={demo.play}
                disabled={demo.isPlaying}
                className="btn-sky"
              >
                <Play className="w-5 h-5" aria-hidden />
                {demo.isPlaying ? 'Watching…' : 'Show me (देखाउनुहोस्)'}
              </button>
              <button type="button" onClick={handleReset} className="btn-soft">
                <Eraser className="w-5 h-5" aria-hidden />
                पुछ्नुहोस् (Wipe)
              </button>
            </div>

            {/* Helper switches */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
              <button
                type="button"
                role="switch"
                aria-checked={showGhostGuide}
                onClick={() => setShowGhostGuide((v) => !v)}
                className={`inline-flex items-center gap-2 min-h-[40px] px-3 rounded-full text-sm font-bold border-2 transition ${
                  showGhostGuide
                    ? 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-400/50 dark:bg-sky-400/10 dark:text-sky-200'
                    : 'border-line bg-sunken text-ink-faint'
                }`}
              >
                <Eye className="w-4 h-4" aria-hidden />
                Guide lines {showGhostGuide ? 'on' : 'off'}
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={showWaypoints}
                onClick={() => setShowWaypoints((v) => !v)}
                className={`inline-flex items-center gap-2 min-h-[40px] px-3 rounded-full text-sm font-bold border-2 transition ${
                  showWaypoints
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/50 dark:bg-emerald-400/10 dark:text-emerald-200'
                    : 'border-line bg-sunken text-ink-faint'
                }`}
              >
                <Sparkles className="w-4 h-4" aria-hidden />
                Number dots {showWaypoints ? 'on' : 'off'}
              </button>
            </div>
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
          />
        </div>
      </div>
    </div>
  );
}
