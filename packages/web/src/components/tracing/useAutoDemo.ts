'use client';

import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { sampleStrokeSubpaths, type Point2D, type TracingEvaluator } from '@akshara/core';
import type { TracingSession } from './useTracingSession';

export type DemoSpeed = 0.5 | 1 | 2;
export const DEMO_SPEEDS: DemoSpeed[] = [0.5, 1, 2];

/** Chalk speed of the teacher's hand at 1× (logical px per second). */
export const DEMO_BASE_SPEED = 140;
/** Pause with the chalk lifted between strokes / subpaths (ms at 1×). */
export const DEMO_LIFT_MS = 350;
/** Spacing (logical px) of the curve samples the replay interpolates between. */
const DEMO_SAMPLE_SPACING = 2;

/** What the renderer paints for the demo on a given frame. */
export interface DemoFrame {
  /** Stroke being demonstrated. */
  strokeIndex: number;
  /** Strokes already fully replayed in this run (drawn in full in teacher chalk). */
  replayed: number[];
  /** Points of the current stroke drawn so far (per subpath, so lifts are visible). */
  drawn: Point2D[][];
  /** Where the teacher's chalk tip is, or null while lifted. */
  pen: Point2D | null;
}

export interface AutoDemo {
  isPlaying: boolean;
  /** Stroke the demo is on (0-based), or null when it has not started / was stopped. */
  strokeIndex: number | null;
  totalStrokes: number;
  speed: DemoSpeed;
  /** Live frame for the renderer. Read from effects / the paint loop only. */
  frameRef: React.RefObject<DemoFrame | null>;
  /** "Show me": resume, or start from the stroke the learner is on. */
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** Clear the replay entirely. */
  stop: () => void;
  /** Jump to a stroke (and keep playing if it was playing, or start if `play`). */
  goToStroke: (index: number, options?: { play?: boolean }) => void;
  nextStroke: () => void;
  previousStroke: () => void;
  setSpeed: (speed: DemoSpeed) => void;
}

interface Replay {
  strokeIndex: number;
  subpathIndex: number;
  /** Arc length travelled along the current subpath. */
  distance: number;
  /** Remaining lift pause (ms, already speed-scaled). */
  liftRemaining: number;
  replayed: number[];
}

/** Curve samples with cumulative arc length, per subpath of a stroke. */
interface SubpathTrack {
  points: Point2D[];
  cumulative: number[];
  length: number;
}

function buildTracks(strokes: TracingSession['dataset']['strokes']): SubpathTrack[][] {
  return strokes.map((stroke) =>
    sampleStrokeSubpaths(stroke, DEMO_SAMPLE_SPACING).map((points) => {
      const cumulative = [0];
      for (let i = 1; i < points.length; i++) {
        cumulative.push(
          cumulative[i - 1]! +
            Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y)
        );
      }
      return { points, cumulative, length: cumulative[cumulative.length - 1] ?? 0 };
    })
  );
}

/** Point `distance` px along a track (clamped). */
function pointAlong(track: SubpathTrack, distance: number): Point2D {
  const d = Math.max(0, Math.min(track.length, distance));
  let i = 1;
  while (i < track.cumulative.length - 1 && track.cumulative[i]! < d) i++;
  const a = track.points[i - 1]!;
  const b = track.points[i]!;
  const segLen = track.cumulative[i]! - track.cumulative[i - 1]!;
  const t = segLen === 0 ? 0 : (d - track.cumulative[i - 1]!) / segLen;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

const requestFrame: (cb: (now: number) => void) => number =
  typeof requestAnimationFrame === 'function'
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
const cancelFrame: (id: number) => void =
  typeof cancelAnimationFrame === 'function'
    ? (id) => cancelAnimationFrame(id)
    : (id) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>);

/**
 * "Show me": a teacher's hand replays the letter along its true Bézier curves, stroke by
 * stroke, lifting between strokes and over Shirorekha gaps. It is a pure overlay — the
 * learner's `TracingEvaluator` progress is never touched — with play/pause, step-by-stroke
 * and 0.5× / 1× / 2× speed. Switching letter or level clears it.
 */
export function useAutoDemo(session: TracingSession): AutoDemo {
  const { dataset, evaluator, requestRepaint } = session;
  const tracks = useMemo(() => buildTracks(dataset.strokes), [dataset]);

  const frameRef = useRef<DemoFrame | null>(null);
  const replayRef = useRef<Replay | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);
  const speedRef = useRef<DemoSpeed>(1);
  // The frame loop re-schedules itself through this ref (always the latest `tick`).
  const tickRef = useRef<(now: number) => void>(() => {});
  const scheduleTick = useCallback(() => {
    rafRef.current = requestFrame((now) => tickRef.current(now));
  }, []);

  // Which session's evaluator the demo belongs to; derived state goes quiet when it changes.
  const [playingOn, setPlayingOn] = useState<TracingEvaluator | null>(null);
  const [positionOn, setPositionOn] = useState<{
    evaluator: TracingEvaluator;
    stroke: number;
  } | null>(null);
  const [speed, setSpeedState] = useState<DemoSpeed>(1);
  const isPlaying = playingOn === evaluator;
  const strokeIndex = positionOn?.evaluator === evaluator ? positionOn.stroke : null;

  const cancelLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTickRef.current = 0;
  }, []);

  // New letter / level or unmount: drop the replay of the old one.
  useEffect(
    () => () => {
      cancelLoop();
      replayRef.current = null;
      frameRef.current = null;
    },
    [evaluator, cancelLoop]
  );

  /** Project the replay state onto a paintable frame. */
  const publishFrame = useCallback(() => {
    const replay = replayRef.current;
    if (!replay) {
      frameRef.current = null;
      requestRepaint();
      return;
    }
    const strokeTracks = tracks[replay.strokeIndex] ?? [];
    const drawn: Point2D[][] = [];
    for (let s = 0; s < replay.subpathIndex; s++) drawn.push(strokeTracks[s]?.points ?? []);
    const current = strokeTracks[replay.subpathIndex];
    let pen: Point2D | null = null;
    if (current) {
      const upTo: Point2D[] = [];
      for (let i = 0; i < current.points.length && current.cumulative[i]! <= replay.distance; i++) {
        upTo.push(current.points[i]!);
      }
      const tip = pointAlong(current, replay.distance);
      upTo.push(tip);
      drawn.push(upTo);
      pen = replay.liftRemaining > 0 ? null : tip;
    }
    frameRef.current = {
      strokeIndex: replay.strokeIndex,
      replayed: [...replay.replayed],
      drawn,
      pen,
    };
    requestRepaint();
  }, [tracks, requestRepaint]);

  const stopLoop = useCallback(() => {
    cancelLoop();
    setPlayingOn(null);
  }, [cancelLoop]);

  const tick = useCallback(
    (now: number) => {
      rafRef.current = null;
      const replay = replayRef.current;
      if (!replay) return;
      // Time frames by Date.now() rather than the rAF argument: ms resolution is plenty for a
      // chalk hand, and it stays consistent with the timers that schedule frames where
      // requestAnimationFrame is unavailable (jsdom / fake timers in tests).
      void now;
      const stamp = Date.now();
      const dt = lastTickRef.current ? Math.max(1, Math.min(100, stamp - lastTickRef.current)) : 16;
      lastTickRef.current = stamp;

      if (replay.liftRemaining > 0) {
        replay.liftRemaining -= dt;
        if (replay.liftRemaining <= 0) {
          replay.liftRemaining = 0;
          // Advance to the next subpath / stroke after the lift
          const strokeTracks = tracks[replay.strokeIndex] ?? [];
          if (replay.subpathIndex + 1 < strokeTracks.length) {
            replay.subpathIndex += 1;
            replay.distance = 0;
          } else if (replay.strokeIndex + 1 < tracks.length) {
            replay.replayed.push(replay.strokeIndex);
            replay.strokeIndex += 1;
            replay.subpathIndex = 0;
            replay.distance = 0;
            setPositionOn({ evaluator, stroke: replay.strokeIndex });
          } else {
            // Whole letter shown: keep it on the slate, stop the hand.
            replay.replayed.push(replay.strokeIndex);
            publishFrame();
            stopLoop();
            return;
          }
        }
      } else {
        const track = tracks[replay.strokeIndex]?.[replay.subpathIndex];
        if (!track) {
          stopLoop();
          return;
        }
        replay.distance += (DEMO_BASE_SPEED * speedRef.current * dt) / 1000;
        if (replay.distance >= track.length) {
          replay.distance = track.length;
          replay.liftRemaining = DEMO_LIFT_MS / speedRef.current;
        }
      }
      publishFrame();
      scheduleTick();
    },
    [tracks, evaluator, publishFrame, stopLoop, scheduleTick]
  );
  useLayoutEffect(() => {
    tickRef.current = tick;
  });

  const startLoop = useCallback(() => {
    if (rafRef.current !== null) return;
    setPlayingOn(evaluator);
    lastTickRef.current = 0;
    scheduleTick();
  }, [evaluator, scheduleTick]);

  const positionAt = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(tracks.length - 1, index));
      // Earlier strokes are shown complete so the learner sees the letter build up in order
      replayRef.current = {
        strokeIndex: clamped,
        subpathIndex: 0,
        distance: 0,
        liftRemaining: 0,
        replayed: Array.from({ length: clamped }, (_, i) => i),
      };
      setPositionOn({ evaluator, stroke: clamped });
      publishFrame();
    },
    [tracks.length, evaluator, publishFrame]
  );

  const play = useCallback(() => {
    const replay = replayRef.current;
    const finished =
      replay && replay.replayed.length === tracks.length && replay.liftRemaining === 0;
    if (!replay || finished) {
      // Start on the stroke the learner is working on (or from the top once the letter is done)
      const progress = evaluator.getProgress();
      positionAt(progress.isLetterComplete ? 0 : progress.currentStrokeIndex);
    }
    startLoop();
  }, [tracks.length, evaluator, positionAt, startLoop]);

  const pause = useCallback(() => {
    stopLoop();
    publishFrame();
  }, [stopLoop, publishFrame]);

  const stop = useCallback(() => {
    cancelLoop();
    setPlayingOn(null);
    setPositionOn(null);
    replayRef.current = null;
    frameRef.current = null;
    requestRepaint();
  }, [cancelLoop, requestRepaint]);

  const goToStroke = useCallback(
    (index: number, options: { play?: boolean } = {}) => {
      const wasPlaying = rafRef.current !== null;
      cancelLoop();
      positionAt(index);
      if (options.play || wasPlaying) startLoop();
    },
    [cancelLoop, positionAt, startLoop]
  );

  const nextStroke = useCallback(
    () => goToStroke((replayRef.current?.strokeIndex ?? -1) + 1),
    [goToStroke]
  );
  const previousStroke = useCallback(
    () => goToStroke((replayRef.current?.strokeIndex ?? 1) - 1),
    [goToStroke]
  );

  const setSpeed = useCallback((next: DemoSpeed) => {
    speedRef.current = next;
    setSpeedState(next);
  }, []);

  return {
    isPlaying,
    strokeIndex,
    totalStrokes: dataset.strokes.length,
    speed,
    frameRef,
    play,
    pause,
    toggle: isPlaying ? pause : play,
    stop,
    goToStroke,
    nextStroke,
    previousStroke,
    setSpeed,
  };
}
