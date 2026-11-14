import { describe, expect, it } from 'vitest';
import { STROKE_LIST, type StrokeDefinition } from '@akshara/data';
import {
  TracingEvaluator,
  buildStrokeReferencePath,
  pointToSegmentDistance,
  sampleStrokePath,
  type LearnerToleranceMode,
} from '../src/index.js';

const MODES: LearnerToleranceMode[] = ['child', 'standard', 'strict'];

/**
 * End-to-end smoke test: a learner who follows every stroke's authored curve must be able to
 * complete every bundled letter — in every difficulty mode and at any pointer sample density —
 * without tripping the Shirorekha detector, going off-corridor, or being flagged for a shortcut.
 */
describe('every bundled letter is traceable end-to-end along its curve', () => {
  it.each(STROKE_LIST.map((d) => [`${d.id} (${d.character})`, d] as const))(
    '%s',
    (_name, dataset) => {
      for (const mode of MODES) {
        for (const spacing of [2, 6, 12]) {
          const evaluator = new TracingEvaluator(dataset, { mode, smoothingAlpha: 1.0 });
          for (const stroke of dataset.strokes) {
            for (const point of sampleStrokePath(stroke, spacing)) {
              const step = evaluator.evaluatePointerSample(point);
              const where = `${mode} @${spacing}px ${stroke.id}`;
              expect(step.topologicalViolation, where).toBeNull();
              expect(step.isOffTrack, where).toBe(false);
              expect(step.cornerCut, where).toBe(false);
            }
            evaluator.endGesture();
          }
          const progress = evaluator.getProgress();
          expect(progress.isLetterComplete, `${mode} @${spacing}px`).toBe(true);
          expect(progress.mistakeCount).toBe(0);
          expect(progress.stars).toBe(3);
        }
      }
    }
  );
});

/** Largest gap between the straight waypoint polyline and the authored curve. */
function maxChordSagitta(stroke: StrokeDefinition): number {
  const ref = buildStrokeReferencePath(stroke);
  const { waypoints: w } = stroke;
  let max = 0;
  for (let k = 0; k < w.length - 1; k++) {
    for (let i = ref.waypointSampleIndex[k]!; i <= ref.waypointSampleIndex[k + 1]!; i++) {
      max = Math.max(max, pointToSegmentDistance(ref.samples[i]!, w[k]!, w[k + 1]!));
    }
  }
  return max;
}

/** Trace straight lines dot-to-dot; report whether a shortcut was flagged. */
function traceStraightChords(evaluator: TracingEvaluator, stroke: StrokeDefinition): boolean {
  const w = stroke.waypoints;
  let cut = evaluator.evaluatePointerSample({ x: w[0]!.x, y: w[0]!.y }).cornerCut;
  for (let k = 0; k < w.length - 1; k++) {
    for (let t = 1; t <= 10; t++) {
      const step = evaluator.evaluatePointerSample({
        x: w[k]!.x + ((w[k + 1]!.x - w[k]!.x) * t) / 10,
        y: w[k]!.y + ((w[k + 1]!.y - w[k]!.y) * t) / 10,
      });
      cut ||= step.cornerCut;
    }
  }
  evaluator.endGesture();
  return cut;
}

describe('straight dot-to-dot shortcuts across curves', () => {
  it.each(MODES)('are rejected exactly when they leave the curve (%s mode)', (mode) => {
    let caught = 0;
    for (const dataset of STROKE_LIST) {
      dataset.strokes.forEach((stroke, strokeIdx) => {
        // Fresh evaluator positioned at this stroke by faithfully tracing the earlier ones
        const evaluator = new TracingEvaluator(dataset, { mode, smoothingAlpha: 1.0 });
        for (const earlier of dataset.strokes.slice(0, strokeIdx)) {
          sampleStrokePath(earlier).forEach((p) => evaluator.evaluatePointerSample(p));
          evaluator.endGesture();
        }
        const sagitta = maxChordSagitta(stroke);
        const tolerance = evaluator.getPathTolerance(stroke);
        const cut = traceStraightChords(evaluator, stroke);

        if (sagitta > tolerance * 1.2) {
          expect(cut, `${stroke.id}: chord is ${sagitta.toFixed(1)}px off the curve`).toBe(true);
          expect(evaluator.getProgress().completedStrokeIds).not.toContain(stroke.id);
          caught += 1;
        } else if (sagitta < tolerance * 0.8) {
          // On a nearly straight segment the chord *is* the curve — no false positive.
          expect(cut, `${stroke.id}: chord is only ${sagitta.toFixed(1)}px off`).toBe(false);
        }
      });
    }
    // Sanity: the dataset really contains curves where a shortcut is detectable in every mode
    expect(caught).toBeGreaterThan(0);
  });
});
