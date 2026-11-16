'use client';

import React from 'react';
import { Eraser, Eye, Map, Pause, Play, SkipBack, SkipForward, Sparkles } from 'lucide-react';
import { DEMO_SPEEDS } from './useAutoDemo';
import { tracingHintText } from '@/lib/messages';
import { LOGICAL_SIZE } from './usePatiRenderer';
import type { PatiSlateController } from './usePatiSlate';

interface PatiSlateProps {
  slate: PatiSlateController;
  /** Shown over the slate (e.g. a celebration once the glyph is complete). */
  overlay?: React.ReactNode;
}

/**
 * The traceable Pati slate: hint bubble, wooden frame + canvas, stroke-progress dots,
 * "Show me" / "Wipe" controls and the guide toggles. Shared by letters and numbers.
 */
export function PatiSlate({ slate, overlay }: PatiSlateProps) {
  const {
    dataset,
    session,
    demo,
    canvasRef,
    pointerHandlers,
    reset,
    showGhostGuide,
    toggleGhostGuide,
    showWaypoints,
    toggleWaypoints,
    showStrokeGuide,
    toggleStrokeGuide,
  } = slate;
  const { progress, lastEval, currentStroke } = session;

  const hintText = tracingHintText(lastEval?.hint ?? { code: 'follow-stroke' }, {
    dataset,
    currentStroke,
  });

  const bubbleClass = lastEval?.topologicalViolation
    ? 'bubble-bad'
    : progress.isLetterComplete
      ? 'bubble-good'
      : lastEval?.isOffTrack ||
          lastEval?.cornerCut ||
          lastEval?.wrongDirection ||
          lastEval?.gapBridged
        ? 'bubble-warn'
        : 'bubble-neutral';

  return (
    <div className="flex flex-col">
      {/* Speech-bubble instruction. Its height must never change while a finger is on the slate
          (hints range from one line to eight), or the canvas would jump under the stroke:
          phones show it below the slate; wider screens reserve the tallest hint's height
          (measured over every hint for every letter and numeral at each breakpoint). */}
      <div
        className={`${bubbleClass} order-1 mt-4 sm:order-none sm:mt-0 sm:mb-4 sm:min-h-[186px] md:min-h-[138px] lg:min-h-[166px] xl:min-h-[138px]`}
        role="status"
        aria-live="polite"
        data-testid="hint-bubble"
      >
        <span className="text-3xl leading-none" aria-hidden>
          {lastEval?.topologicalViolation
            ? '🙈'
            : progress.isLetterComplete
              ? '🎉'
              : lastEval?.gapBridged
                ? '✋'
                : lastEval?.wrongDirection
                  ? '🔄'
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
            {...pointerHandlers}
            className="w-full h-full touch-none cursor-crosshair select-none"
          />
          {overlay}
        </div>

        {/* Stroke progress dots */}
        <ol className="flex items-center justify-center gap-2 mt-3" aria-label="Lines to draw">
          {dataset.strokes.map((stroke, idx) => {
            const isDone = idx < progress.completedStrokeIds.length;
            const isCurrent = !progress.isLetterComplete && idx === progress.currentStrokeIndex;
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

      {/* "Show me" replay controls + wipe */}
      <div
        className="order-2 sm:order-none flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-4"
        role="group"
        aria-label="Show me controls"
      >
        <button
          type="button"
          onClick={demo.previousStroke}
          disabled={demo.strokeIndex === null || demo.strokeIndex === 0}
          aria-label="Previous stroke"
          className="btn-soft !px-3"
        >
          <SkipBack className="w-5 h-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={demo.toggle}
          aria-pressed={demo.isPlaying}
          className="btn-sky min-w-[11rem]"
        >
          {demo.isPlaying ? (
            <Pause className="w-5 h-5" aria-hidden />
          ) : (
            <Play className="w-5 h-5" aria-hidden />
          )}
          {demo.isPlaying ? 'रोक्नुहोस् (Pause)' : 'Show me (देखाउनुहोस्)'}
        </button>
        <button
          type="button"
          onClick={demo.nextStroke}
          disabled={demo.strokeIndex !== null && demo.strokeIndex >= demo.totalStrokes - 1}
          aria-label="Next stroke"
          className="btn-soft !px-3"
        >
          <SkipForward className="w-5 h-5" aria-hidden />
        </button>
        <div className="segmented" role="radiogroup" aria-label="Demo speed">
          {DEMO_SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              role="radio"
              aria-checked={demo.speed === speed}
              onClick={() => demo.setSpeed(speed)}
              className={`segment !min-h-[36px] !px-2.5 ${demo.speed === speed ? 'segment-active' : ''}`}
            >
              {speed}×
            </button>
          ))}
        </div>
        <button type="button" onClick={reset} className="btn-soft">
          <Eraser className="w-5 h-5" aria-hidden />
          पुछ्नुहोस् (Wipe)
        </button>
      </div>
      {demo.strokeIndex !== null && (
        <p
          className="text-center text-sm font-bold text-sky-700 dark:text-sky-300 mt-2"
          aria-live="polite"
        >
          {demo.isPlaying ? '✍️ Watch:' : '⏸ Paused at'} stroke {demo.strokeIndex + 1} of{' '}
          {demo.totalStrokes}
          {dataset.strokes[demo.strokeIndex]
            ? ` — ${dataset.strokes[demo.strokeIndex]!.nepaliInstruction}`
            : ''}
        </p>
      )}

      {/* Helper switches */}
      <div className="order-2 sm:order-none flex flex-wrap items-center justify-center gap-2 mt-3">
        <button
          type="button"
          role="switch"
          aria-checked={showStrokeGuide}
          onClick={toggleStrokeGuide}
          className={`inline-flex items-center gap-2 min-h-[40px] px-3 rounded-full text-sm font-bold border-2 transition ${
            showStrokeGuide
              ? 'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-400/50 dark:bg-violet-400/10 dark:text-violet-200'
              : 'border-line bg-sunken text-ink-faint'
          }`}
        >
          <Map className="w-4 h-4" aria-hidden />
          Stroke order guide {showStrokeGuide ? 'on' : 'off'}
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={showGhostGuide}
          onClick={toggleGhostGuide}
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
          onClick={toggleWaypoints}
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
  );
}
