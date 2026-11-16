'use client';

import type React from 'react';
import { useState } from 'react';
import type { LetterStrokeDataset } from '@akshara/data';
import type { LearnerToleranceMode } from '@akshara/core';
import {
  useTracingSession,
  type TracingSession,
  type TracingSessionOptions,
} from './useTracingSession';
import { usePatiRenderer } from './usePatiRenderer';
import { useAutoDemo, type AutoDemo } from './useAutoDemo';

export interface PatiSlateController {
  dataset: LetterStrokeDataset;
  session: TracingSession;
  demo: AutoDemo;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Spread onto the slate's <canvas>. */
  pointerHandlers: {
    onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
    onPointerUp: () => void;
    onPointerLeave: () => void;
  };
  /** Clear the demo and wipe the slate. */
  reset: () => void;
  showGhostGuide: boolean;
  toggleGhostGuide: () => void;
  showWaypoints: boolean;
  toggleWaypoints: () => void;
  /** Full-letter Stroke Order Guide overlay (colours, arrows, numbered starts). */
  showStrokeGuide: boolean;
  toggleStrokeGuide: () => void;
}

/**
 * Everything one Pati slate needs — tracing session, renderer, "Show me" demo, pointer
 * glue and display toggles — for any glyph: letters in the tracing studio, digits in the
 * number studio. Render it with `<PatiSlate slate={…} />`.
 */
export function usePatiSlate(
  dataset: LetterStrokeDataset,
  mode: LearnerToleranceMode,
  sessionOptions?: TracingSessionOptions
): PatiSlateController {
  const [showGhostGuide, setShowGhostGuide] = useState(true);
  const [showWaypoints, setShowWaypoints] = useState(true);
  const [showStrokeGuide, setShowStrokeGuide] = useState(false);

  const session = useTracingSession(dataset, mode, sessionOptions);
  // The demo is a visual overlay only: it reads the session but never drives the evaluator.
  const demo = useAutoDemo(session);
  const { canvasRef, toLogicalPoint } = usePatiRenderer(session, {
    showGhostGuide,
    showWaypoints,
    showStrokeGuide,
    demoFrame: demo.frameRef,
  });

  const onPointerUp = () => session.penUp();
  return {
    dataset,
    session,
    demo,
    canvasRef,
    pointerHandlers: {
      onPointerDown: (e) => {
        if (session.progress.isLetterComplete) return;
        // The learner takes over: the teacher's hand pauses, progress is untouched
        if (demo.isPlaying) demo.pause();
        e.currentTarget.setPointerCapture(e.pointerId);
        session.penDown(toLogicalPoint(e));
      },
      onPointerMove: (e) => session.penMove(toLogicalPoint(e)),
      onPointerUp,
      onPointerLeave: onPointerUp,
    },
    reset: () => {
      demo.stop();
      session.reset();
    },
    showGhostGuide,
    toggleGhostGuide: () => setShowGhostGuide((v) => !v),
    showWaypoints,
    toggleWaypoints: () => setShowWaypoints((v) => !v),
    showStrokeGuide,
    toggleStrokeGuide: () => setShowStrokeGuide((v) => !v),
  };
}
