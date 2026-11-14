'use client';

import React from 'react';
import type { LetterStrokeDataset, StrokeDefinition } from '@akshara/data';
import {
  MODE_MULTIPLIERS,
  type LearnerToleranceMode,
  type StrokeStepEvaluation,
  type TracingProgressSummary,
} from '@akshara/core';
import { Award, GraduationCap } from 'lucide-react';
import { speakNepaliPhonics } from '@/lib/audio';

const LEVELS: Array<{ mode: LearnerToleranceMode; emoji: string; label: string }> = [
  { mode: 'child', emoji: '🐣', label: 'Easy' },
  { mode: 'standard', emoji: '🐥', label: 'Medium' },
  { mode: 'strict', emoji: '🦅', label: 'Hard' },
];

/** Level labels and their tolerance factors for the grown-ups note, sourced from core. */
const LEVEL_SCALE_SUMMARY = {
  labels: LEVELS.map((l) => l.label).join(' / '),
  factors: LEVELS.map((l) => `${MODE_MULTIPLIERS[l.mode]}×`).join(' / '),
};

interface StrokeSidebarProps {
  dataset: LetterStrokeDataset;
  mode: LearnerToleranceMode;
  onModeChange: (mode: LearnerToleranceMode) => void;
  progress: TracingProgressSummary;
  lastEval: StrokeStepEvaluation | null;
  currentStroke: StrokeDefinition | null;
}

/**
 * Everything about the current letter beside the slate: difficulty level, picture words,
 * and the collapsible "for grown-ups" stroke order and scoring details.
 */
export function StrokeSidebar({
  dataset,
  mode,
  onModeChange,
  progress,
  lastEval,
  currentStroke,
}: StrokeSidebarProps) {
  return (
    <>
      {/* Difficulty level */}
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
              onClick={() => onModeChange(level.mode)}
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

      {/* Picture words */}
      <div className="card">
        <h3 className="section-title mb-3">
          <span aria-hidden>🖼️</span> Words with “{dataset.character}”
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {dataset.vocabulary.map((vocab) => (
            <button
              key={vocab.word}
              type="button"
              onClick={() => speakNepaliPhonics(vocab.word, vocab.romanized)}
              aria-label={`Hear ${vocab.word} (${vocab.meaning})`}
              className="tile flex flex-col items-center p-2"
            >
              <span className="text-3xl" aria-hidden>
                {vocab.emoji}
              </span>
              <span className="text-lg font-black">{vocab.word}</span>
              <span className="text-xs text-ink-faint">{vocab.meaning}</span>
            </button>
          ))}
        </div>
      </div>

      {/* For teachers & parents */}
      <details className="card grownups">
        <summary>
          <GraduationCap className="w-5 h-5" aria-hidden />
          For grown-ups: letter details & scoring
        </summary>

        <div className="mt-4 space-y-4 text-sm text-ink-soft">
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-0.5 rounded-lg font-mono bg-sunken border border-line">
              IPA {dataset.phonetics.ipa}
            </span>
            <span className="px-2 py-0.5 rounded-lg font-mono bg-sunken border border-line">
              {dataset.unicode}
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-sunken border border-line">
              {dataset.varga}
            </span>
          </div>
          <p className="leading-relaxed">{dataset.phonetics.articulationTip}</p>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-ink">Stroke order</h4>
              <span className="font-mono text-xs">
                {Math.round(progress.overallCompletionRatio * 100)}% complete
              </span>
            </div>
            <ol className="space-y-1.5">
              {dataset.strokes.map((stroke, idx) => {
                const isDone = idx < progress.completedStrokeIds.length;
                return (
                  <li
                    key={stroke.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-sunken border border-line p-2"
                  >
                    <span>
                      <strong className="text-ink">
                        {isDone ? '✓' : stroke.order}. {stroke.label}
                      </strong>{' '}
                      — {stroke.englishInstruction}
                    </span>
                    <span className="text-[10px] font-mono uppercase">{stroke.type}</span>
                  </li>
                );
              })}
            </ol>
          </div>

          <div>
            <h4 className="font-bold text-ink mb-2 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" aria-hidden />
              Evaluator (score {progress.accuracyScore}%)
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-sunken border border-line p-2">
                <div className="text-[10px] uppercase">Distance</div>
                <div className="font-mono font-bold text-ink">
                  {lastEval ? `${lastEval.distanceToTargetWaypoint}px` : '—'}
                </div>
              </div>
              <div className="rounded-xl bg-sunken border border-line p-2">
                <div className="text-[10px] uppercase">Tolerance</div>
                <div className="font-mono font-bold text-ink">
                  {lastEval
                    ? `${lastEval.effectiveTolerance}px`
                    : `${currentStroke?.toleranceRadius ?? 28}px`}
                </div>
              </div>
              <div className="rounded-xl bg-sunken border border-line p-2">
                <div className="text-[10px] uppercase">Waypoints</div>
                <div className="font-mono font-bold text-ink">
                  {progress.unlockedWaypointsInCurrentStroke}/
                  {progress.totalWaypointsInCurrentStroke}
                </div>
              </div>
            </div>
            <p className="text-xs mt-2">
              Mistakes so far: <strong className="text-ink">{progress.mistakeCount}</strong>. Each
              mistake (going off the line, drawing the शिरोरेखा early, or cutting a corner) counts
              once, however long it lasts — so a mouse, finger, or 120 Hz stylus is scored the same.
            </p>
            <p className="text-xs mt-1">
              A dot unlocks only after the curve leading to it has been followed within{' '}
              {lastEval ? `${lastEval.pathTolerance.toFixed(0)} px` : 'half the width of its ring'}.
              The शिरोरेखा (headline) is always drawn last. {LEVEL_SCALE_SUMMARY.labels} scale the
              touch tolerance by {LEVEL_SCALE_SUMMARY.factors}.
            </p>
          </div>
        </div>
      </details>
    </>
  );
}
