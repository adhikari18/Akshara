import { describe, expect, it } from 'vitest';
import { NUMERAL_LIST, STROKE_DATASETS, STROKE_LIST, type StrokeDefinition } from '@akshara/data';
import {
  TracingEvaluator,
  buildStrokeReferencePath,
  cumulativeTurningProfile,
  loopWindingOf,
  sampleStrokePath,
  sampleStrokeSubpaths,
  signedTurningAngle,
  type Point2D,
} from '../src/index.js';

const deg = (r: number) => (r * 180) / Math.PI;
const ALL = [...STROKE_LIST, ...NUMERAL_LIST];

/** A circle drawn from the top; in y-down screen space `clockwise` means visually clockwise. */
function circle(cx: number, cy: number, r: number, clockwise: boolean, n = 120): Point2D[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = -Math.PI / 2 + ((clockwise ? 1 : -1) * 2 * Math.PI * i) / n;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

/** Reflect a path across the line through its first point along its initial heading. */
function mirrorAcrossStartTangent(pts: Point2D[]): Point2D[] {
  const o = pts[0]!;
  const k = pts.findIndex((p) => Math.hypot(p.x - o.x, p.y - o.y) > 8);
  const len = Math.hypot(pts[k]!.x - o.x, pts[k]!.y - o.y);
  const u = { x: (pts[k]!.x - o.x) / len, y: (pts[k]!.y - o.y) / len };
  return pts.map((p) => {
    const v = { x: p.x - o.x, y: p.y - o.y };
    const d = v.x * u.x + v.y * u.y;
    return { x: o.x + 2 * d * u.x - v.x, y: o.y + 2 * d * u.y - v.y };
  });
}

/** Faithfully trace the strokes before `strokeIdx` so the evaluator is positioned on it. */
function positionedAt(
  dataset: (typeof ALL)[number],
  strokeIdx: number,
  mode: 'child' | 'standard' | 'strict'
) {
  const evaluator = new TracingEvaluator(dataset, { mode, smoothingAlpha: 1 });
  for (const earlier of dataset.strokes.slice(0, strokeIdx)) {
    for (const gesture of sampleStrokeSubpaths(earlier, 3)) {
      for (const p of gesture) if (evaluator.evaluatePointerSample(p).strokeCompleted) break;
      evaluator.endGesture();
    }
  }
  return evaluator;
}

describe('signed turning angle Σ Δθ', () => {
  it('is +2π for a clockwise loop and −2π for a counter-clockwise one (y-down screen space)', () => {
    expect(deg(signedTurningAngle(circle(150, 150, 60, true)))).toBeCloseTo(360, -1);
    expect(deg(signedTurningAngle(circle(150, 150, 60, false)))).toBeCloseTo(-360, -1);
    expect(loopWindingOf(circle(150, 150, 60, true))).toBe('clockwise');
    expect(loopWindingOf(circle(150, 150, 60, false))).toBe('counter-clockwise');
  });

  it('is ~0 for a straight line, even with hand jitter', () => {
    const jittery = Array.from({ length: 200 }, (_, i) => ({
      x: 40 + i,
      y: 150 + (i % 2 ? 1.5 : -1.5),
    }));
    expect(Math.abs(deg(signedTurningAngle(jittery)))).toBeLessThan(10);
    expect(loopWindingOf(jittery)).toBeNull();
  });

  it('does not depend on the pointer sample rate', () => {
    // At 300 px/s round a 60 px circle (~377 px), a 240 Hz stylus gives ~300 samples and a
    // 60 Hz mouse ~75. (A very coarse polygon is a different shape: it loses up to one corner of
    // turning at its open ends, which is geometry, not rate.)
    const stylus = deg(signedTurningAngle(circle(150, 150, 60, true, 300)));
    const mouse = deg(signedTurningAngle(circle(150, 150, 60, true, 75)));
    expect(Math.abs(stylus - mouse)).toBeLessThan(6);
  });

  it('ignores the 180° cusp of an out-and-back retrace (its sign is arbitrary)', () => {
    const outAndBack = [
      ...Array.from({ length: 50 }, (_, i) => ({ x: 50 + i * 2, y: 100 })),
      ...Array.from({ length: 50 }, (_, i) => ({ x: 148 - i * 2, y: 100 })),
    ];
    expect(Math.abs(deg(signedTurningAngle(outAndBack)))).toBeLessThan(1);
  });

  it('exposes the running profile, starting at 0', () => {
    const profile = cumulativeTurningProfile(circle(150, 150, 60, true));
    expect(profile[0]).toBe(0);
    expect(deg(profile[Math.floor(profile.length / 2)]!)).toBeCloseTo(180, -1);
  });
});

describe('stroke data: loop direction hints match the authored geometry', () => {
  const strokes = ALL.flatMap((d) => d.strokes.map((s) => [`${d.character} ${s.id}`, s] as const));

  it.each(strokes.filter(([, s]) => s.directionHint.endsWith('-loop')))(
    '%s winds the way its directionHint says',
    (_name, stroke: StrokeDefinition) => {
      const ref = buildStrokeReferencePath(stroke);
      const w = ref.waypointSampleIndex;
      const winding = loopWindingOf(ref.samples.slice(w[0]!, w[w.length - 1]! + 1));
      expect(`${winding}-loop`).toBe(stroke.directionHint);
    }
  );

  it('gives every loop-typed stroke a loop direction hint', () => {
    for (const [name, s] of strokes) {
      if (s.type === 'loop') expect(s.directionHint, name).toMatch(/-loop$/);
    }
  });

  it('enforces direction on the roadmap letters क ख छ ठ ढ', () => {
    for (const id of ['ka', 'kha', 'chha', 'ttha', 'ddha']) {
      const ds = STROKE_DATASETS[id]!;
      const evaluator = new TracingEvaluator(ds);
      expect(
        ds.strokes.some((s) => evaluator.getExpectedWinding(s) !== null),
        id
      ).toBe(true);
    }
  });
});

describe('loop winding enforcement', () => {
  const MODES = ['child', 'standard', 'strict'] as const;

  it('never flags a faithful trace of any letter or numeral', () => {
    for (const mode of MODES) {
      for (const dataset of ALL) {
        const evaluator = new TracingEvaluator(dataset, { mode, smoothingAlpha: 1 });
        for (const stroke of dataset.strokes) {
          for (const gesture of sampleStrokeSubpaths(stroke, 4)) {
            for (const p of gesture) {
              const step = evaluator.evaluatePointerSample(p);
              expect(step.wrongDirection, `${mode} ${stroke.id}`).toBe(false);
              if (step.strokeCompleted) break;
            }
            evaluator.endGesture();
          }
        }
        expect(evaluator.getProgress().isLetterComplete, `${mode} ${dataset.id}`).toBe(true);
      }
    }
  });

  it('stops every loop that is curled the wrong way round, in every mode', () => {
    let tested = 0;
    for (const mode of MODES) {
      for (const dataset of ALL) {
        dataset.strokes.forEach((stroke, idx) => {
          const evaluator = positionedAt(dataset, idx, mode);
          if (!evaluator.getExpectedWinding(stroke)) return;
          tested += 1;
          // Start correctly at dot 1 but wind the opposite way
          let wrongWay = false;
          let headline = false;
          for (const p of mirrorAcrossStartTangent(sampleStrokePath(stroke, 3))) {
            const step = evaluator.evaluatePointerSample(p);
            expect(step.strokeCompleted, `${mode} ${stroke.id} must not complete`).toBe(false);
            wrongWay ||= step.wrongDirection;
            headline ||= step.topologicalViolation !== null;
            if (wrongWay) break;
          }
          // The mirror of a few strokes sweeps through the headline band, which is flagged first
          expect(wrongWay || headline, `${mode} ${stroke.id}`).toBe(true);
        });
      }
    }
    expect(tested).toBeGreaterThan(100);
  });

  it('catches क traced backward from the end of its loop, then lets the learner restart', () => {
    const ka = STROKE_DATASETS.ka!;
    const loop = ka.strokes[0]!;
    const evaluator = new TracingEvaluator(ka, { mode: 'child', smoothingAlpha: 1 });
    expect(evaluator.getExpectedWinding(loop)).toBe('counter-clockwise');

    // The loop's end lies inside dot 1's (child-size) ring, so a learner can start there…
    const backward = [...sampleStrokePath(loop, 3)].reverse();
    const steps = backward.map((p) => evaluator.evaluatePointerSample(p));
    const flagged = steps.filter((s) => s.wrongDirection);
    expect(flagged.length).toBeGreaterThan(0);
    expect(steps.filter((s) => s.warningOnset)).toHaveLength(1);
    expect(flagged[0]!.hint).toEqual({ code: 'wrong-direction', expected: 'counter-clockwise' });
    expect(flagged[0]!.turningAngle).toBeGreaterThan(0); // clockwise, against the loop
    expect(steps.some((s) => s.strokeCompleted)).toBe(false);
    // …nothing unlocks while going the wrong way
    const unlockedWhenFlagged = flagged[0]!.unlockedWaypointIndex;
    expect(flagged.every((s) => s.unlockedWaypointIndex === unlockedWhenFlagged)).toBe(true);

    // Lifting the pen restarts the stroke at dot 1; a correct trace then completes.
    evaluator.endGesture();
    expect(evaluator.getProgress().unlockedWaypointsInCurrentStroke).toBe(0);
    const forward = sampleStrokePath(loop, 3).map((p) => evaluator.evaluatePointerSample(p));
    expect(forward.some((s) => s.strokeCompleted)).toBe(true);
    expect(forward.some((s) => s.wrongDirection)).toBe(false);
    expect(evaluator.getProgress().mistakeCount).toBe(1);
  });

  it('catches ० drawn clockwise before the first dot is even passed', () => {
    const zero = NUMERAL_LIST[0]!;
    const evaluator = new TracingEvaluator(zero, { mode: 'child', smoothingAlpha: 1 });
    const stroke = zero.strokes[0]!;
    const steps = mirrorAcrossStartTangent(sampleStrokePath(stroke, 3)).map((p) =>
      evaluator.evaluatePointerSample(p)
    );
    const first = steps.findIndex((s) => s.wrongDirection);
    expect(first).toBeGreaterThan(-1);
    expect(steps[first]!.unlockedWaypointIndex).toBeLessThanOrEqual(1);
    expect(steps[first]!.hint).toEqual({ code: 'wrong-direction', expected: 'counter-clockwise' });
  });

  it('flags at the same point of the path at 60, 120 and 240 Hz', () => {
    const ka = STROKE_DATASETS.ka!;
    const path = [...sampleStrokePath(ka.strokes[0]!, 1)].reverse();
    const travelledWhenFlagged = [60, 120, 240].map((hz) => {
      const step = 300 / hz; // 300 px/s
      const evaluator = new TracingEvaluator(ka, { mode: 'child' });
      let travelled = 0;
      let next = 0;
      for (let i = 0; i < path.length; i++) {
        if (i > 0)
          travelled += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y);
        if (travelled < next && i < path.length - 1) continue;
        next += step;
        const s = evaluator.evaluatePointerSample({
          ...path[i]!,
          timestamp: (travelled / 300) * 1000,
        });
        if (s.wrongDirection) return travelled;
      }
      return Infinity;
    });
    expect(Number.isFinite(travelledWhenFlagged[0]!)).toBe(true);
    const spread = Math.max(...travelledWhenFlagged) - Math.min(...travelledWhenFlagged);
    expect(spread).toBeLessThan(15);
  });
});
