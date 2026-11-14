'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { computeAdaptiveTolerance, type Point2D } from '@akshara/core';
import { advanceDust, type TracingSession } from './useTracingSession';

/**
 * Logical drawing space. Stroke datasets, waypoints, the evaluator and pointer samples all
 * live in this fixed 300x300 coordinate system; only the canvas backing store scales.
 */
export const LOGICAL_SIZE = 300;
/** Cap the backing store so very large or high-DPR displays don't allocate huge bitmaps. */
const MAX_BACKING_PX = 2048;

export interface PatiRenderOptions {
  showGhostGuide: boolean;
  showWaypoints: boolean;
}

export interface PatiRenderer {
  /** Attach to the slate's <canvas>. */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Map a pointer event's client coordinates into the 300×300 logical space. */
  toLogicalPoint: (clientX: number, clientY: number) => Point2D;
}

/** Paint the whole Pati slate for the session's current state (stateless; safe to call anytime). */
function drawPati(
  canvas: HTMLCanvasElement,
  session: TracingSession,
  { showGhostGuide, showWaypoints }: PatiRenderOptions
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { evaluator } = session;
  const scene = session.getScene();
  const { lastEval } = scene; // live, per-sample (not the throttled React snapshot)
  const dataset = evaluator.getDataset();
  const progress = evaluator.getProgress();
  const activeStroke = evaluator.getCurrentStroke();

  // Map the 300x300 logical space onto the (DPI-scaled) backing store. Everything below
  // draws in logical units, so the slate is crisp at any CSS size or devicePixelRatio.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(canvas.width / LOGICAL_SIZE, 0, 0, canvas.height / LOGICAL_SIZE, 0, 0);

  // 1. Traditional Pati (पाटी) dark slate background texture
  const slateGrad = ctx.createRadialGradient(150, 150, 20, 150, 150, 220);
  slateGrad.addColorStop(0, '#1e242b');
  slateGrad.addColorStop(1, '#12161b');
  ctx.fillStyle = slateGrad;
  ctx.fillRect(0, 0, LOGICAL_SIZE, LOGICAL_SIZE);

  // Subtle slate grain grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  for (let g = 30; g < LOGICAL_SIZE; g += 30) {
    ctx.beginPath();
    ctx.moveTo(g, 0);
    ctx.lineTo(g, LOGICAL_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, g);
    ctx.lineTo(LOGICAL_SIZE, g);
    ctx.stroke();
  }

  // 2. Canonical Shirorekha headline & Baseline guide rails
  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.28)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(25, dataset.viewBox.shirorekhaY);
  ctx.lineTo(275, dataset.viewBox.shirorekhaY);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.beginPath();
  ctx.moveTo(25, dataset.viewBox.baselineY);
  ctx.lineTo(275, dataset.viewBox.baselineY);
  ctx.stroke();
  ctx.restore();

  // Label Shirorekha line
  ctx.fillStyle = 'rgba(251, 191, 36, 0.55)';
  ctx.font = '10px sans-serif';
  ctx.fillText('शिरोरेखा (Shirorekha — Draw Last)', 30, dataset.viewBox.shirorekhaY - 8);

  // 3. Ghost guides for all remaining strokes
  if (showGhostGuide) {
    dataset.strokes.forEach((stroke, idx) => {
      if (idx < progress.completedStrokeIds.length) return;
      const isCurrent = activeStroke?.id === stroke.id;

      ctx.save();
      const path = new Path2D(stroke.svgPath);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = isCurrent ? 18 : 14;
      ctx.strokeStyle = isCurrent ? 'rgba(254, 243, 199, 0.16)' : 'rgba(148, 163, 184, 0.08)';
      ctx.stroke(path);

      if (isCurrent) {
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle =
          stroke.type === 'shirorekha' ? 'rgba(251, 191, 36, 0.65)' : 'rgba(56, 189, 248, 0.65)';
        ctx.stroke(path);
      }
      ctx.restore();
    });
  }

  // 4. Completed strokes rendered in rich limestone chalk
  dataset.strokes.forEach((stroke, idx) => {
    if (idx >= progress.completedStrokeIds.length) return;
    ctx.save();
    const path = new Path2D(stroke.svgPath);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 15;
    ctx.shadowColor = 'rgba(254, 243, 199, 0.35)';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#fef3c7';
    ctx.stroke(path);
    ctx.restore();
  });

  // 5. Active learner chalk trail
  const { trail } = scene;
  if (trail.length > 1) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);
    for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 14;
    ctx.strokeStyle = lastEval?.topologicalViolation
      ? '#f87171'
      : lastEval?.isOffTrack || lastEval?.cornerCut
        ? '#fb923c'
        : '#fef08a';
    ctx.shadowColor = 'rgba(254, 240, 138, 0.45)';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.restore();
  }

  // 6. Chalk dust particles
  scene.dust.forEach((pt) => {
    ctx.save();
    ctx.fillStyle = `rgba(254, 243, 199, ${pt.alpha})`;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // 7. Numbered waypoints for the active stroke
  if (showWaypoints && activeStroke && !progress.isLetterComplete) {
    const unlockedCount = progress.unlockedWaypointsInCurrentStroke;
    activeStroke.waypoints.forEach((wp, wpIdx) => {
      const isUnlocked = wpIdx < unlockedCount;
      const isNextTarget = wpIdx === unlockedCount;

      ctx.save();
      if (isNextTarget) {
        // Adaptive tolerance radius ring
        const tolRadius =
          lastEval?.effectiveTolerance ??
          computeAdaptiveTolerance(activeStroke.toleranceRadius, evaluator.getMode());
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, tolRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(251, 191, 36, 0.10)';
        ctx.fill();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // Waypoint node circle
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, isNextTarget ? 11 : 8, 0, Math.PI * 2);
      ctx.fillStyle = isUnlocked ? '#10b981' : isNextTarget ? '#f59e0b' : 'rgba(30, 41, 59, 0.9)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = isUnlocked
        ? '#a7f3d0'
        : isNextTarget
          ? '#fef3c7'
          : 'rgba(148, 163, 184, 0.5)';
      ctx.stroke();

      // Waypoint index label
      ctx.fillStyle = isUnlocked || isNextTarget ? '#0f172a' : '#e2e8f0';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(wpIdx + 1), wp.x, wp.y);
      ctx.restore();
    });
  }
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
 * Draws a tracing session onto the Pati slate canvas.
 *
 * Painting is decoupled from React: every scene change (each pointer sample, pen lift, demo
 * tick) requests a single animation frame, so N samples between two frames cost one paint,
 * and React re-renders never trigger a second paint of the same state. While chalk dust is
 * alive the frame loop keeps running to animate it, then stops.
 */
export function usePatiRenderer(session: TracingSession, options: PatiRenderOptions): PatiRenderer {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Latest session/options for the frame loop and resize observer, without re-subscribing.
  const sessionRef = useRef(session);
  const optionsRef = useRef(options);
  const frameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) drawPati(canvas, sessionRef.current, optionsRef.current);
  }, []);

  /** Coalesce any number of change notifications into one paint on the next frame. */
  const schedule = useCallback(() => {
    if (frameRef.current !== null) return;
    const tick = (now: number) => {
      frameRef.current = null;
      const dt = lastTickRef.current ? now - lastTickRef.current : 0;
      lastTickRef.current = now;
      const dustAlive = advanceDust(sessionRef.current.getScene(), dt);
      paint();
      if (dustAlive) {
        frameRef.current = requestFrame(tick); // keep animating until the dust has settled
      } else {
        lastTickRef.current = 0;
      }
    };
    frameRef.current = requestFrame(tick);
  }, [paint]);

  useLayoutEffect(() => {
    sessionRef.current = session;
    optionsRef.current = options;
    schedule(); // React-driven changes (toggles, new letter, commits) repaint next frame
  });

  const { subscribe } = session;
  useEffect(() => subscribe(schedule), [subscribe, schedule]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelFrame(frameRef.current);
    },
    []
  );

  // DPI-aware, responsive backing store: whenever the canvas' CSS box or the display's
  // devicePixelRatio changes (window resize, browser zoom, moving to another monitor),
  // resize the bitmap to CSS size x DPR and immediately redraw. The learner's drawing is
  // preserved because the scene is fully re-rendered from session state, never from the
  // old bitmap.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const syncBackingStore = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return; // hidden tab / not laid out yet
      const dpr = window.devicePixelRatio || 1;
      const width = Math.min(MAX_BACKING_PX, Math.max(1, Math.round(rect.width * dpr)));
      const height = Math.min(MAX_BACKING_PX, Math.max(1, Math.round(rect.height * dpr)));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width; // resizing clears the bitmap...
        canvas.height = height;
      }
      paint(); // ...so redraw synchronously in the same frame (no flicker)
    };

    syncBackingStore();

    const resizeObserver = new ResizeObserver(syncBackingStore);
    resizeObserver.observe(canvas);

    // devicePixelRatio changes don't always resize the CSS box (e.g. dragging the window
    // to a monitor with a different scale factor), so watch the resolution media query too.
    let dprQuery: MediaQueryList | null = null;
    const onDprChange = () => {
      syncBackingStore();
      dprQuery?.removeEventListener('change', onDprChange);
      dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprQuery.addEventListener('change', onDprChange);
    };
    dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    dprQuery.addEventListener('change', onDprChange);

    return () => {
      resizeObserver.disconnect();
      dprQuery?.removeEventListener('change', onDprChange);
    };
  }, [paint]);

  const toLogicalPoint = useCallback((clientX: number, clientY: number): Point2D => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(LOGICAL_SIZE, ((clientX - rect.left) * LOGICAL_SIZE) / rect.width)),
      y: Math.max(0, Math.min(LOGICAL_SIZE, ((clientY - rect.top) * LOGICAL_SIZE) / rect.height)),
      timestamp: performance.now(),
    };
  }, []);

  return { canvasRef, toLogicalPoint };
}
