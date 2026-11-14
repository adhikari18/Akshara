import { describe, expect, it } from 'vitest';
import { STROKE_DATASETS } from '@akshara/data';
import {
  HEADLINE_DETECTION_GEOMETRY,
  TracingEvaluator,
  rateNormalizedAlpha,
  sampleStrokePath,
  type Point2D,
} from '../src/index.js';

const ka = STROKE_DATASETS.ka!;
const kaLoop = ka.strokes[0]!;

/** Resample a polyline at a fixed pointer rate, given a constant drawing speed (px/s). */
function atRate(path: Point2D[], hz: number, speed = 300): Point2D[] {
  const step = speed / hz;
  const out: Point2D[] = [{ ...path[0]!, timestamp: 0 }];
  let carried = 0;
  let travelled = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let d = step - carried;
    while (d <= len) {
      const t = d / len;
      travelled += step;
      out.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        timestamp: (travelled / speed) * 1000,
      });
      d += step;
    }
    carried = len - (d - step);
  }
  const last = path[path.length - 1]!;
  out.push({ ...last, timestamp: (travelled / speed) * 1000 + 1000 / hz });
  return out;
}

/** The loop of क, with a 60 px out-and-back scribble off the line halfway round. */
function loopWithExcursion(): Point2D[] {
  const path = sampleStrokePath(kaLoop, 2);
  const mid = Math.floor(path.length / 2);
  const at = path[mid]!;
  const spike = [30, 60, 30].map((dx) => ({ x: at.x - dx, y: at.y }));
  return [...path.slice(0, mid + 1), ...spike, ...path.slice(mid)];
}

function scoreStroke(points: Point2D[], mode: 'child' | 'standard' = 'standard') {
  const evaluator = new TracingEvaluator(ka, { mode });
  const steps = points.map((p) => evaluator.evaluatePointerSample(p));
  evaluator.endGesture();
  return { progress: evaluator.getProgress(), steps };
}

describe('scoring is independent of the input device sample rate', () => {
  it('rate-normalizes the smoothing alpha (two 120 Hz steps == one 60 Hz step)', () => {
    expect(rateNormalizedAlpha(0.6, 1000 / 60)).toBeCloseTo(0.6, 10);
    const a120 = rateNormalizedAlpha(0.6, 1000 / 120);
    expect(1 - (1 - a120) ** 2).toBeCloseTo(0.6, 10);
    expect(rateNormalizedAlpha(0.6, undefined)).toBe(0.6);
  });

  it('gives a clean trace the same score at 60, 120 and 240 Hz', () => {
    const path = sampleStrokePath(kaLoop, 1);
    const scores = [60, 120, 240].map((hz) => scoreStroke(atRate(path, hz)).progress);
    for (const p of scores) {
      expect(p.completedStrokeIds).toContain(kaLoop.id);
      expect(p.mistakeCount).toBe(0);
    }
    expect(new Set(scores.map((p) => p.accuracyScore)).size).toBe(1);
  });

  it('penalizes the same mistake equally on a 60 Hz mouse and a 120/240 Hz stylus', () => {
    const path = loopWithExcursion();
    const [mouse, stylus, fastStylus] = [60, 120, 240].map(
      (hz) => scoreStroke(atRate(path, hz)).progress
    );
    // The wobble is one mistake, regardless of how many samples landed off-track
    expect(mouse.mistakeCount).toBe(1);
    expect(stylus.mistakeCount).toBe(1);
    expect(fastStylus.mistakeCount).toBe(1);
    expect(mouse.accuracyScore).toBeLessThan(100);
    expect(Math.abs(stylus.accuracyScore - mouse.accuracyScore)).toBeLessThanOrEqual(1);
    expect(Math.abs(fastStylus.accuracyScore - mouse.accuracyScore)).toBeLessThanOrEqual(1);
  });

  it('treats jitter along the off-track boundary as one excursion (hysteresis)', () => {
    const evaluator = new TracingEvaluator(ka, { mode: 'standard', smoothingAlpha: 1.0 });
    const path = sampleStrokePath(kaLoop, 2);
    const mid = Math.floor(path.length / 2);
    path.slice(0, mid).forEach((p) => evaluator.evaluatePointerSample(p));
    // Hover around the corridor threshold (1.85 × 28 ≈ 52 px off the curve), flapping in and out
    const anchor = path[mid]!;
    let offTrackSamples = 0;
    for (let i = 0; i < 40; i++) {
      const step = evaluator.evaluatePointerSample({
        x: anchor.x - (i % 2 ? 50 : 55),
        y: anchor.y,
      });
      if (step.isOffTrack) offTrackSamples += 1;
    }
    expect(offTrackSamples).toBeGreaterThan(30);
    expect(evaluator.getProgress().mistakeCount).toBe(1);
  });
});

describe('topological warnings fire once per gesture', () => {
  it('announces a premature Shirorekha once, however long the learner drags along it', () => {
    const evaluator = new TracingEvaluator(ka, { mode: 'child' });
    const steps = Array.from({ length: 60 }, (_, i) =>
      evaluator.evaluatePointerSample({ x: 60 + i * 3, y: 75, timestamp: i * (1000 / 120) })
    );
    const violations = steps.filter((s) => s.topologicalViolation);
    expect(violations.length).toBeGreaterThan(30); // the hint stays visible…
    expect(steps.filter((s) => s.warningOnset)).toHaveLength(1); // …but sounds once
    expect(evaluator.getProgress().mistakeCount).toBe(1);
  });

  it('announces a fresh attempt after the pen is lifted', () => {
    const evaluator = new TracingEvaluator(ka, { mode: 'child' });
    const drag = () =>
      Array.from({ length: 20 }, (_, i) =>
        evaluator.evaluatePointerSample({ x: 60 + i * 5, y: 75 })
      );
    expect(drag().filter((s) => s.warningOnset)).toHaveLength(1);
    evaluator.endGesture();
    expect(drag().filter((s) => s.warningOnset)).toHaveLength(1);
    expect(evaluator.getProgress().mistakeCount).toBe(2);
  });

  it('costs the same whether the stylus samples at 60 or 240 Hz', () => {
    const scoreAt = (hz: number) => {
      const evaluator = new TracingEvaluator(ka, { mode: 'child' });
      const n = Math.round(hz / 2); // half a second dragging along the headline
      for (let i = 0; i < n; i++) {
        evaluator.evaluatePointerSample({
          x: 60 + (i / n) * 150,
          y: 75,
          timestamp: (i * 1000) / hz,
        });
      }
      evaluator.endGesture();
      sampleStrokePath(kaLoop).forEach((p) => evaluator.evaluatePointerSample(p));
      return evaluator.getProgress();
    };
    expect(scoreAt(240).accuracyScore).toBe(scoreAt(60).accuracyScore);
  });
});

describe('cutting corners between waypoints', () => {
  const uu = STROKE_DATASETS.uu!;
  const curl = uu.strokes[0]!; // its 4th segment bows ~46 px away from the straight chord

  it('rejects a straight shortcut across a curve, then accepts the corrected trace', () => {
    const evaluator = new TracingEvaluator(uu, { mode: 'standard', smoothingAlpha: 1.0 });
    const w = curl.waypoints;
    const steps = [];
    steps.push(evaluator.evaluatePointerSample({ x: w[0]!.x, y: w[0]!.y }));
    for (let k = 0; k < w.length - 1; k++) {
      for (let t = 1; t <= 10; t++) {
        steps.push(
          evaluator.evaluatePointerSample({
            x: w[k]!.x + ((w[k + 1]!.x - w[k]!.x) * t) / 10,
            y: w[k]!.y + ((w[k + 1]!.y - w[k]!.y) * t) / 10,
          })
        );
      }
    }
    const cut = steps.filter((s) => s.cornerCut);
    expect(cut.length).toBeGreaterThan(0);
    expect(steps.filter((s) => s.warningOnset)).toHaveLength(1);
    expect(cut[0]!.hint.code).toBe('corner-cut');
    expect(cut[0]!.hint).toMatchObject({
      backToDot: expect.any(Number),
      nextDot: expect.any(Number),
    });
    expect(evaluator.getProgress().completedStrokeIds).toHaveLength(0);

    // The learner goes back and follows the real curve: the stroke now completes.
    evaluator.endGesture();
    for (const p of sampleStrokePath(curl)) evaluator.evaluatePointerSample(p);
    expect(evaluator.getProgress().completedStrokeIds).toContain(curl.id);
    expect(evaluator.getProgress().mistakeCount).toBe(1);
  });

  it('rejects a shrunken trace that just grazes the edge of each waypoint ring (child mode)', () => {
    // Pull the loop of क ~30 px toward its centre: every waypoint is still inside its 40 px
    // child-mode ring, but the learner never draws the actual loop.
    const path = sampleStrokePath(kaLoop, 2);
    const cx = path.reduce((s, p) => s + p.x, 0) / path.length;
    const cy = path.reduce((s, p) => s + p.y, 0) / path.length;
    const shrunk = path.map((p) => {
      const d = Math.hypot(p.x - cx, p.y - cy) || 1;
      const pull = Math.min(30, d * 0.6);
      return { x: p.x - ((p.x - cx) / d) * pull, y: p.y - ((p.y - cy) / d) * pull };
    });
    const { steps, progress } = scoreStroke(shrunk, 'child');
    expect(steps.some((s) => s.cornerCut)).toBe(true);
    expect(progress.completedStrokeIds).not.toContain(kaLoop.id);
  });

  it('does not bridge the trail across a pen lift (no tapping ahead)', () => {
    const evaluator = new TracingEvaluator(uu, { mode: 'standard', smoothingAlpha: 1.0 });
    const w = curl.waypoints;
    for (const p of sampleStrokePath(curl).slice(0, 3)) evaluator.evaluatePointerSample(p);
    evaluator.endGesture();
    const tap = evaluator.evaluatePointerSample({ x: w[w.length - 1]!.x, y: w[w.length - 1]!.y });
    expect(tap.strokeCompleted).toBe(false);
    expect(evaluator.getProgress().completedStrokeIds).toHaveLength(0);
  });

  it('requires the stroke to be drawn to its end before it completes', () => {
    const evaluator = new TracingEvaluator(ka, { mode: 'child', smoothingAlpha: 1.0 });
    const path = sampleStrokePath(kaLoop, 2);
    // Stop ~30 px short of the end: inside the final 40 px ring, but the line isn't finished
    let stopAt = path.length - 1;
    const end = path[path.length - 1]!;
    while (Math.hypot(path[stopAt]!.x - end.x, path[stopAt]!.y - end.y) < 30) stopAt -= 1;
    const steps = path.slice(0, stopAt + 1).map((p) => evaluator.evaluatePointerSample(p));
    expect(steps.some((s) => s.strokeCompleted)).toBe(false);
    expect(steps.some((s) => s.cornerCut)).toBe(false); // not a mistake — just unfinished
    path.slice(stopAt + 1).forEach((p) => evaluator.evaluatePointerSample(p));
    expect(evaluator.getProgress().completedStrokeIds).toContain(kaLoop.id);
  });
});

describe('setMode() switches every mode-derived parameter (M6)', () => {
  it('re-derives the smoothing alpha unless it was given explicitly', () => {
    const evaluator = new TracingEvaluator(ka, { mode: 'child' });
    expect(evaluator.getSmoothingAlpha()).toBe(0.6);
    evaluator.setMode('strict');
    expect(evaluator.getMode()).toBe('strict');
    expect(evaluator.getSmoothingAlpha()).toBe(0.85);

    const pinned = new TracingEvaluator(ka, { mode: 'child', smoothingAlpha: 1 });
    pinned.setMode('strict');
    expect(pinned.getSmoothingAlpha()).toBe(1);
  });

  it('applies the new smoothing to the very next sample', () => {
    const evaluator = new TracingEvaluator(ka, { mode: 'child' });
    evaluator.evaluatePointerSample({ x: 150, y: 125 });
    const childStep = evaluator.evaluatePointerSample({ x: 160, y: 125 });
    // alpha 0.6 → moves 60% of the way
    expect(childStep.smoothedPoint.x).toBeCloseTo(156, 5);

    evaluator.setMode('strict');
    evaluator.endGesture();
    evaluator.evaluatePointerSample({ x: 150, y: 125 });
    const strictStep = evaluator.evaluatePointerSample({ x: 160, y: 125 });
    // alpha 0.85 → moves 85% of the way
    expect(strictStep.smoothedPoint.x).toBeCloseTo(158.5, 5);
    expect(evaluator.getPathTolerance()).toBeLessThan(new TracingEvaluator(ka).getPathTolerance());
  });
});

describe('headline detection geometry scales with the viewBox (M5)', () => {
  it('exposes named constants authored for the 300-unit reference glyph', () => {
    expect(HEADLINE_DETECTION_GEOMETRY.referenceSize).toBe(300);
    expect(HEADLINE_DETECTION_GEOMETRY.bandHalfHeight).toBe(22);
  });

  it('detects the headline band in proportion to a scaled dataset', () => {
    // Same letter authored at 600×600: every coordinate doubled.
    const scale = (n: number) => n * 2;
    const big = {
      ...ka,
      viewBox: {
        ...ka.viewBox,
        width: 600,
        height: 600,
        shirorekhaY: scale(ka.viewBox.shirorekhaY),
        baselineY: scale(ka.viewBox.baselineY),
      },
      shirorekha: {
        ...ka.shirorekha,
        startX: scale(ka.shirorekha.startX),
        endX: scale(ka.shirorekha.endX),
        y: scale(ka.shirorekha.y),
      },
      strokes: ka.strokes.map((s) => ({
        ...s,
        toleranceRadius: scale(s.toleranceRadius),
        waypoints: s.waypoints.map((w) => ({ ...w, x: scale(w.x), y: scale(w.y) })),
      })),
    };
    const small = new TracingEvaluator(ka, { mode: 'standard', smoothingAlpha: 1 });
    const large = new TracingEvaluator(big, { mode: 'standard', smoothingAlpha: 1 });

    // 40 units below the headline is outside the 22-unit band on the 300 glyph…
    expect(small.evaluatePointerSample({ x: 65, y: 75 + 40 }).topologicalViolation).toBeNull();
    // …but 40 units is inside the 44-unit band on the 600 glyph.
    expect(large.evaluatePointerSample({ x: 130, y: 150 + 40 }).topologicalViolation).toBe(
      'shirorekha-before-body'
    );
  });
});
