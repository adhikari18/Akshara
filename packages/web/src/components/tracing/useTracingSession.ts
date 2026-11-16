'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { LetterStrokeDataset, StrokeDefinition } from '@akshara/data';
import {
  CHALK_BASE_WIDTH,
  TracingEvaluator,
  chalkWidthFor,
  type LearnerToleranceMode,
  type Point2D,
  type StrokeStepEvaluation,
  type TracingProgressSummary,
} from '@akshara/core';
import {
  playStrokeSuccessSound,
  playTopologicalWarningSound,
  playWaypointChime,
  speakNepaliPhonics,
} from '@/lib/audio';

export interface ChalkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  radius: number;
}

/**
 * The hot, per-sample state of the slate, scoped to one session. Lives in a ref — never read
 * during render — so a 120 Hz stylus doesn't re-render React 120 times a second: handlers
 * mutate it, `usePatiRenderer` paints it on the next animation frame, and React state is only
 * committed when something *meaningful* changes (see `meaningfulDigest`).
 */
export interface PatiScene {
  /** Smoothed points of the gesture currently being drawn (logical 300×300 space). */
  trail: Point2D[];
  /** Chalk dust left behind by recent samples (animated by the renderer). */
  dust: ChalkParticle[];
  /** Whether a learner gesture (pointer down → up) is in progress. */
  penDown: boolean;
  /** Evaluator output for the most recent sample. */
  lastEval: StrokeStepEvaluation | null;
  /** Evaluator progress after the most recent sample. */
  progress: TracingProgressSummary;
  /** Digest of the last state pushed to React (see `meaningfulDigest`). */
  committedDigest: string;
}

const MAX_DUST = 60;
/** Dust fades out over ~45 frames at 60 Hz. */
const DUST_FADE_PER_FRAME = 0.012;
/** Gentle downward drift per frame (chalk falls). */
const DUST_GRAVITY_PER_FRAME = 0.015;
const FRAME_MS = 1000 / 60;

/**
 * Advance chalk dust by `dtMs` (frame-rate independent) and drop particles that have faded.
 * Called by the renderer's animation loop; returns whether any dust is still alive.
 */
export function advanceDust(scene: PatiScene, dtMs: number): boolean {
  const frames = Math.min(4, Math.max(0, dtMs / FRAME_MS));
  const alive: ChalkParticle[] = [];
  for (const p of scene.dust) {
    p.x += p.vx * frames;
    p.y += p.vy * frames;
    p.vy += DUST_GRAVITY_PER_FRAME * frames;
    p.alpha -= DUST_FADE_PER_FRAME * frames;
    if (p.alpha > 0) alive.push(p);
  }
  scene.dust = alive;
  return alive.length > 0;
}

/**
 * The parts of a step that change what React shows (hint text, progress dots, mistake count).
 * Distances, tolerances and the smoothed point change every sample and are deliberately
 * excluded; the slate itself is painted from the live scene, not from React state.
 */
function meaningfulDigest(
  step: StrokeStepEvaluation | null,
  progress: TracingProgressSummary
): string {
  return [
    step ? JSON.stringify(step.hint) : '',
    step?.isOffTrack ?? false,
    step?.cornerCut ?? false,
    step?.wrongDirection ?? false,
    step?.gapBridged ?? false,
    step?.topologicalViolation ?? '',
    progress.currentStrokeIndex,
    progress.unlockedWaypointsInCurrentStroke,
    progress.isLetterComplete,
    progress.mistakeCount,
  ].join('|');
}

function createScene(evaluator: TracingEvaluator): PatiScene {
  const progress = evaluator.getProgress();
  return {
    trail: [],
    dust: [],
    penDown: false,
    lastEval: null,
    progress,
    committedDigest: meaningfulDigest(null, progress),
  };
}

export interface TracingSession {
  dataset: LetterStrokeDataset;
  evaluator: TracingEvaluator;
  /** This session's live scene. Call from handlers/effects only — never during render. */
  getScene: () => PatiScene;
  /** Subscribe to every scene mutation (fires per pointer sample; renderer coalesces to rAF). */
  subscribe: (listener: () => void) => () => void;
  /** Ask the renderer to repaint (for overlays such as the demo that live outside the scene). */
  requestRepaint: () => void;
  /** Last committed evaluator output (React state: updates only on meaningful changes). */
  lastEval: StrokeStepEvaluation | null;
  /** Last committed progress (React state: updates only on meaningful changes). */
  progress: TracingProgressSummary;
  /** The stroke the learner should draw next, or null once the letter is complete. */
  currentStroke: StrokeDefinition | null;
  /** Learner touches down (ignored once the letter is complete). */
  penDown: (point: Point2D) => void;
  /** Learner moves while touching (ignored unless a gesture is in progress). */
  penMove: (point: Point2D) => void;
  /** Learner lifts the pen (ignored unless a gesture is in progress). */
  penUp: () => void;
  /** Feed one sample directly, bypassing gesture tracking. */
  feed: (point: Point2D) => StrokeStepEvaluation;
  /** Lift the chalk unconditionally: ends the evaluator gesture and clears the live trail. */
  endGesture: () => void;
  /** Wipe the slate and restart the letter. */
  reset: () => void;
}

interface SessionState {
  key: string;
  evaluator: TracingEvaluator;
  lastEval: StrokeStepEvaluation | null;
  progress: TracingProgressSummary;
}

function createSession(
  key: string,
  dataset: LetterStrokeDataset,
  mode: LearnerToleranceMode
): SessionState {
  const evaluator = new TracingEvaluator(dataset, { mode });
  return {
    key,
    evaluator,
    lastEval: null,
    progress: evaluator.getProgress(),
  };
}

function sprinkleDust(scene: PatiScene, at: Point2D): void {
  for (let i = 0; i < 2; i++) {
    scene.dust.push({
      x: at.x + (Math.random() - 0.5) * 10,
      y: at.y + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 0.6,
      vy: Math.random() * 0.8,
      alpha: 0.55,
      // Harder pressure / a flatter stylus sheds more chalk
      radius: (1 + Math.random() * 1.5) * (chalkWidthFor(at) / CHALK_BASE_WIDTH),
    });
  }
  if (scene.dust.length > MAX_DUST) scene.dust.splice(0, scene.dust.length - MAX_DUST);
}

/**
 * Headless tracing session for one letter at one difficulty: owns the core `TracingEvaluator`,
 * the chalk on the slate, pen state, and the feedback sounds. Knows nothing about canvases,
 * DOM events, or timers. Switching letter or level starts a fresh session.
 */
export interface TracingSessionOptions {
  /**
   * Speak the glyph's name when it is completed (default true). The number studio turns this
   * off for the last digit of a number so it can announce the whole number instead.
   */
  announceCompletion?: boolean;
  /**
   * Extra identity for the session: changing it starts a fresh session even for the same glyph
   * (e.g. the two १s of ११ are separate tracing tasks).
   */
  resetKey?: string;
  /** Called once when the whole glyph is completed (from the pointer event, not an effect). */
  onLetterComplete?: (progress: TracingProgressSummary) => void;
}

export function useTracingSession(
  dataset: LetterStrokeDataset,
  mode: LearnerToleranceMode,
  { announceCompletion = true, resetKey = '', onLetterComplete }: TracingSessionOptions = {}
): TracingSession {
  const key = `${dataset.id}:${mode}:${resetKey}`;

  // Latest completion callback, reachable from long-lived closures (e.g. a running demo).
  const onLetterCompleteRef = useRef(onLetterComplete);
  useLayoutEffect(() => {
    onLetterCompleteRef.current = onLetterComplete;
  });
  const [state, setState] = useState<SessionState>(() => createSession(key, dataset, mode));

  // New letter or level → new evaluator. Done during render (React's recommended pattern for
  // resetting state on prop change) so no frame ever shows the previous letter's progress.
  let session = state;
  if (state.key !== key) {
    session = createSession(key, dataset, mode);
    setState(session);
  }
  const { evaluator } = session;

  // The scene belongs to one evaluator; a new session lazily gets a clean slate.
  const sceneRef = useRef<{ owner: TracingEvaluator | null; scene: PatiScene }>({
    owner: null,
    scene: createScene(evaluator),
  });
  const getScene = useCallback((): PatiScene => {
    if (sceneRef.current.owner !== evaluator) {
      sceneRef.current = { owner: evaluator, scene: createScene(evaluator) };
    }
    return sceneRef.current.scene;
  }, [evaluator]);

  // Scene-change listeners (the renderer). Stable across sessions.
  const listenersRef = useRef(new Set<() => void>());
  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);
  const notify = useCallback(() => {
    listenersRef.current.forEach((listener) => listener());
  }, []);

  /**
   * Record a sample's outcome on the live scene and repaint; push to React only if something
   * meaningful changed (or when `force`d, e.g. a reset).
   */
  const publish = useCallback(
    (step: StrokeStepEvaluation | null, force = false) => {
      const scene = getScene();
      const progress = evaluator.getProgress();
      scene.lastEval = step;
      scene.progress = progress;
      notify();

      const digest = meaningfulDigest(step, progress);
      if (!force && digest === scene.committedDigest) return;
      scene.committedDigest = digest;
      setState((s) => (s.evaluator === evaluator ? { ...s, lastEval: step, progress } : s));
    },
    [evaluator, getScene, notify]
  );

  const feed = useCallback(
    (point: Point2D): StrokeStepEvaluation => {
      const prevUnlocked = evaluator.getProgress().unlockedWaypointsInCurrentStroke;
      const step = evaluator.evaluatePointerSample(point);
      const progress = evaluator.getProgress();
      const scene = getScene();

      scene.trail.push(step.smoothedPoint);
      sprinkleDust(scene, step.smoothedPoint);

      if (step.warningOnset) {
        // Once per mistake (premature Shirorekha or a cut corner), not once per pointer sample
        playTopologicalWarningSound();
      } else if (
        step.topologicalViolation ||
        step.cornerCut ||
        step.wrongDirection ||
        step.gapBridged
      ) {
        // Same mistake still in progress — keep the hint on screen, but stay quiet
      } else if (step.letterCompleted) {
        scene.penDown = false;
        scene.trail = [];
        playStrokeSuccessSound(true);
        if (announceCompletion) {
          speakNepaliPhonics(dataset.phonetics.audioPrompt, dataset.phonetics.romanized);
        }
        onLetterCompleteRef.current?.(progress);
      } else if (step.strokeCompleted) {
        scene.penDown = false;
        scene.trail = [];
        playStrokeSuccessSound(false);
      } else if (progress.unlockedWaypointsInCurrentStroke > prevUnlocked) {
        playWaypointChime(progress.unlockedWaypointsInCurrentStroke);
      }

      publish(step);
      return step;
    },
    [evaluator, getScene, dataset, publish, announceCompletion]
  );

  const penDown = useCallback(
    (point: Point2D) => {
      if (evaluator.getProgress().isLetterComplete) return;
      const scene = getScene();
      scene.penDown = true;
      scene.trail = [];
      if (evaluator.getProgress().unlockedWaypointsInCurrentStroke === 0) {
        evaluator.resetCurrentStroke();
      }
      feed(point);
    },
    [evaluator, getScene, feed]
  );

  const penMove = useCallback(
    (point: Point2D) => {
      if (!getScene().penDown || evaluator.getProgress().isLetterComplete) return;
      feed(point);
    },
    [evaluator, getScene, feed]
  );

  const endGesture = useCallback(() => {
    // Don't bridge the trail to the next touch-down, and close mistake episodes
    evaluator.endGesture();
    getScene().trail = [];
    notify();
  }, [evaluator, getScene, notify]);

  const penUp = useCallback(() => {
    const scene = getScene();
    if (!scene.penDown) return;
    scene.penDown = false;
    endGesture();
  }, [getScene, endGesture]);

  const reset = useCallback(() => {
    evaluator.reset();
    const scene = getScene();
    scene.trail = [];
    scene.dust = [];
    scene.penDown = false;
    publish(null, true);
  }, [evaluator, getScene, publish]);

  const { progress } = session;
  return {
    dataset,
    evaluator,
    getScene,
    subscribe,
    requestRepaint: notify,
    lastEval: session.lastEval,
    progress,
    currentStroke: progress.isLetterComplete
      ? null
      : (dataset.strokes[progress.currentStrokeIndex] ?? null),
    penDown,
    penMove,
    penUp,
    feed,
    endGesture,
    reset,
  };
}
