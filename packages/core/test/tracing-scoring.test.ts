import { describe, expect, it } from 'vitest';
import { STROKE_DATASETS } from '@akshara/data';
import {
  HEADLINE_DETECTION_GEOMETRY,
  ONE_EURO_PROFILES,
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
  it('re-derives the smoothing profile unless it was given explicitly', () => {
    const evaluator = new TracingEvaluator(ka, { mode: 'child' });
    expect(evaluator.getSmoothing()).toEqual({
      kind: 'one-euro',
      profile: ONE_EURO_PROFILES.child,
    });
    evaluator.setMode('strict');
    expect(evaluator.getMode()).toBe('strict');
    expect(evaluator.getSmoothing()).toEqual({
      kind: 'one-euro',
      profile: ONE_EURO_PROFILES.strict,
    });

    const custom = { minCutoff: 3, beta: 0.1, dCutoff: 1 };
    const pinnedProfile = new TracingEvaluator(ka, { mode: 'child', oneEuro: custom });
    pinnedProfile.setMode('strict');
    expect(pinnedProfile.getSmoothing()).toEqual({ kind: 'one-euro', profile: custom });

    const legacy = new TracingEvaluator(ka, { mode: 'child', smoothingAlpha: 1 });
    legacy.setMode('strict');
    expect(legacy.getSmoothing()).toEqual({ kind: 'ema', alpha: 1 });
    expect(legacy.getSmoothingAlpha()).toBe(1);
  });

  it('applies the new smoothing to the very next sample', () => {
    const evaluator = new TracingEvaluator(ka, { mode: 'child' });
    evaluator.evaluatePointerSample({ x: 150, y: 125 });
    const childStep = evaluator.evaluatePointerSample({ x: 160, y: 125 });
    // Child profile (1 Hz at rest) smooths a sudden 10 px jump heavily…
    expect(childStep.smoothedPoint.x).toBeGreaterThan(150);
    expect(childStep.smoothedPoint.x).toBeLessThan(156);

    evaluator.setMode('strict');
    evaluator.endGesture();
    evaluator.evaluatePointerSample({ x: 150, y: 125 });
    const strictStep = evaluator.evaluatePointerSample({ x: 160, y: 125 });
    // …while the strict profile (2.5 Hz) follows it more closely
    expect(strictStep.smoothedPoint.x).toBeGreaterThan(childStep.smoothedPoint.x);
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

describe('curve fidelity (discrete Fréchet distance) alongside waypoint unlocks', () => {
  const faithfully = (mode: 'child' | 'standard' | 'strict' = 'standard') => {
    const evaluator = new TracingEvaluator(ka, { mode, smoothingAlpha: 1 });
    const steps = [];
    for (const stroke of ka.strokes) {
      for (const p of sampleStrokePath(stroke, 2)) {
        const step = evaluator.evaluatePointerSample(p);
        steps.push(step);
        if (step.strokeCompleted) break;
      }
      evaluator.endGesture();
    }
    return { evaluator, steps, progress: evaluator.getProgress() };
  };

  it('grades each stroke once, on the sample that completes it', () => {
    const { steps, progress } = faithfully();
    const graded = steps.filter((s) => s.strokeFidelity !== null);
    expect(graded).toHaveLength(ka.strokes.length);
    expect(graded.every((s) => s.strokeCompleted)).toBe(true);
    expect(progress.strokeFidelities.map((f) => f.strokeId)).toEqual(ka.strokes.map((s) => s.id));
    // A trace along the curve itself is within a couple of px of it
    for (const f of progress.strokeFidelities) {
      expect(f.frechetDistance).toBeLessThan(3);
      expect(f.excess).toBe(0);
    }
    expect(progress.meanFrechetDistance).toBeLessThan(3);
    expect(progress.accuracyScore).toBe(100);
  });

  it('catches doubling back along the curve, which nearest-point deviation cannot see', () => {
    const evaluator = new TracingEvaluator(ka, { mode: 'standard', smoothingAlpha: 1 });
    const path = sampleStrokePath(kaLoop, 2);
    const a = Math.floor(path.length * 0.3);
    const b = Math.floor(path.length * 0.6);
    // Forward to 60 %, back to 30 %, forward to the end — every point lies ON the curve
    const doubledBack = [...path.slice(0, b), ...path.slice(a, b).reverse(), ...path.slice(a)];
    let fidelity = null;
    for (const p of doubledBack) {
      const step = evaluator.evaluatePointerSample(p);
      expect(step.isOffTrack).toBe(false);
      expect(step.cornerCut).toBe(false);
      if (step.strokeCompleted) {
        fidelity = step.strokeFidelity;
        break;
      }
    }
    expect(fidelity).not.toBeNull();
    // Nearest-point metrics see nothing wrong…
    const progress = evaluator.getProgress();
    expect(progress.mistakeCount).toBe(0);
    // …but the Fréchet leash has to span the backtrack
    expect(fidelity!.frechetDistance).toBeGreaterThan(fidelity!.pathTolerance);
    expect(fidelity!.excess).toBeGreaterThan(0);
    expect(progress.accuracyScore).toBeLessThan(100);
  });

  it('does not charge for starting inside the first ring or stopping inside the last', () => {
    const evaluator = new TracingEvaluator(ka, { mode: 'child', smoothingAlpha: 1 });
    const path = sampleStrokePath(kaLoop, 2);
    const start = path[0]!;
    const end = path[path.length - 1]!;
    // Touch down 25 px to the side of dot 1 (inside its 40 px ring), walk onto the line, trace,
    // and lift as soon as the stroke completes inside the final ring.
    const approach = Array.from({ length: 6 }, (_, i) => ({
      x: start.x - 25 + (25 * i) / 5,
      y: start.y - 25 + (25 * i) / 5,
    }));
    let fidelity = null;
    for (const p of [...approach, ...path]) {
      const step = evaluator.evaluatePointerSample(p);
      if (step.strokeCompleted) {
        fidelity = step.strokeFidelity;
        break;
      }
    }
    expect(fidelity).not.toBeNull();
    expect(fidelity!.excess).toBe(0);
    expect(Math.hypot(start.x - end.x, start.y - end.y)).toBeGreaterThan(0); // sanity: open loop
  });

  it('is independent of pointer sample rate', () => {
    const path = sampleStrokePath(kaLoop, 1);
    const grades = [60, 120, 240].map((hz) => scoreStroke(atRate(path, hz)).progress);
    for (const g of grades) {
      expect(g.strokeFidelities).toHaveLength(1);
      expect(g.strokeFidelities[0]!.excess).toBe(0);
      // the 1€ filter trades a few px of lag for jitter removal; far inside the 14 px tolerance
      expect(g.strokeFidelities[0]!.frechetDistance).toBeLessThan(6);
    }
  });
});
