'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { sampleStrokePath, type Point2D, type TracingEvaluator } from '@akshara/core';
import type { TracingSession } from './useTracingSession';

/** Milliseconds between demo pointer samples. */
export const AUTO_DEMO_TICK_MS = 35;
/** Ticks the chalk stays lifted between strokes (~175 ms). */
const PEN_LIFT_TICKS = 5;
/** Spacing (logical px) of demo samples along each stroke's curve. */
const DEMO_SAMPLE_SPACING = 5;

export interface AutoDemo {
  isPlaying: boolean;
  /** Wipe the slate and trace the whole letter automatically ("Show me"). */
  play: () => void;
  stop: () => void;
}

/**
 * "Show me": replays the current letter through the session, stroke by stroke, following each
 * stroke's authored curve (straight dot-to-dot lines would be rejected as cut corners).
 * The demo is tied to the session it started on — switching letter or level stops it.
 */
export function useAutoDemo(session: TracingSession): AutoDemo {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Which session's evaluator the demo is driving; derived "playing" goes false automatically
  // as soon as the session is replaced, without setState-in-effect.
  const [playingOn, setPlayingOn] = useState<TracingEvaluator | null>(null);
  const isPlaying = playingOn !== null && playingOn === session.evaluator;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // A new session (letter / level change) or unmount: stop driving the old one.
  useEffect(() => clearTimer, [session.evaluator, clearTimer]);

  const stop = useCallback(() => {
    clearTimer();
    setPlayingOn(null);
  }, [clearTimer]);

  const { evaluator, dataset, reset, feed, endGesture } = session;
  const play = useCallback(() => {
    if (timerRef.current !== null) return;
    reset();
    setPlayingOn(evaluator);

    // One frame list per stroke so the chalk lifts cleanly between them.
    const strokeFrames: Point2D[][] = dataset.strokes.map((stroke) =>
      sampleStrokePath(stroke, DEMO_SAMPLE_SPACING)
    );
    let strokeIdx = 0;
    let frameIdx = 0;
    let pauseTicks = 0;

    timerRef.current = setInterval(() => {
      if (pauseTicks > 0) {
        pauseTicks -= 1;
        return;
      }
      if (strokeIdx >= strokeFrames.length) {
        stop();
        return;
      }
      const frames = strokeFrames[strokeIdx];
      const step = feed(frames[Math.min(frameIdx, frames.length - 1)]);

      if (step.letterCompleted) {
        stop();
        return;
      }
      if (step.strokeCompleted || frameIdx >= frames.length - 1) {
        endGesture();
        strokeIdx += 1;
        frameIdx = 0;
        pauseTicks = PEN_LIFT_TICKS;
        return;
      }
      frameIdx += 1;
    }, AUTO_DEMO_TICK_MS);
  }, [evaluator, dataset, reset, feed, endGesture, stop]);

  return { isPlaying, play, stop };
}
