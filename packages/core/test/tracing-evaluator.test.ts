import { describe, expect, it } from 'vitest';
import { STROKE_DATASETS, STROKE_LIST, VOWELS, validateLetterDataset } from '@akshara/data';
import {
  TracingEvaluator,
  computeAdaptiveTolerance,
  distanceToSegment,
  euclideanDistance,
  isWithinWaypointTolerance,
  smoothPointerPoint,
  validateStrokeTopology,
} from '../src/index.js';

describe('TracingEvaluator & Vector Geometry Engine', () => {
  it('computes exact Euclidean distance and waypoint tolerance inequality', () => {
    const p = { x: 153, y: 129 };
    const w = { x: 150, y: 125 };
    // sqrt(3^2 + 4^2) = 5
    expect(euclideanDistance(p, w)).toBe(5);
    expect(isWithinWaypointTolerance(p, w, 5)).toBe(true);
    expect(isWithinWaypointTolerance(p, w, 4.9)).toBe(false);
  });

  it('scales tolerance adaptively for child motor jitter vs strict calligraphy mode', () => {
    const base = 28;
    const childTol = computeAdaptiveTolerance(base, 'child', 6);
    const standardTol = computeAdaptiveTolerance(base, 'standard', 6);
    const strictTol = computeAdaptiveTolerance(base, 'strict', 6);

    expect(childTol).toBeGreaterThan(standardTol);
    expect(standardTol).toBe(28);
    expect(strictTol).toBeLessThan(standardTol);
  });

  it('smooths pointer tremor using Exponential Moving Average (EMA)', () => {
    const prev = { x: 100, y: 100 };
    const jittery = { x: 120, y: 80 };
    const smoothed = smoothPointerPoint(prev, jittery, 0.5);
    expect(smoothed.x).toBe(110);
    expect(smoothed.y).toBe(90);
  });

  it('computes perpendicular point-to-segment distance accurately', () => {
    const a = { x: 55, y: 75 };
    const b = { x: 245, y: 75 };
    const p = { x: 150, y: 90 };
    expect(distanceToSegment(p, a, b)).toBe(15);
  });

  it('validates all canonical stroke datasets against Devanagari Shirorekha-last topology', () => {
    for (const dataset of STROKE_LIST) {
      const schemaCheck = validateLetterDataset(dataset);
      expect(schemaCheck.valid).toBe(true);

      const topologyCheck = validateStrokeTopology(dataset.strokes);
      expect(topologyCheck.valid).toBe(true);
    }
  });

  it('rejects malformed stroke definitions where Shirorekha is drawn before body/stem strokes', () => {
    const ka = STROKE_DATASETS.ka;
    const reversedStrokes = [...ka.strokes].reverse();
    const check = validateStrokeTopology(reversedStrokes);
    expect(check.valid).toBe(false);
    expect(check.violations.length).toBeGreaterThan(0);
  });

  it('unlocks waypoints sequentially and completes all 4 strokes of "क" (ka)', () => {
    const evaluator = new TracingEvaluator(STROKE_DATASETS.ka, {
      mode: 'standard',
      smoothingAlpha: 1.0,
    });

    // Attempting to skip directly to the last waypoint of stroke 1 should NOT unlock it
    const skipAttempt = evaluator.evaluatePointerSample({ x: 75, y: 155 });
    expect(skipAttempt.unlockedWaypointIndex).toBe(-1);

    // Traverse all 4 strokes of "क" through their canonical waypoints in order
    for (let sIdx = 0; sIdx < STROKE_DATASETS.ka.strokes.length; sIdx++) {
      const stroke = STROKE_DATASETS.ka.strokes[sIdx];
      for (let wIdx = 0; wIdx < stroke.waypoints.length; wIdx++) {
        const wp = stroke.waypoints[wIdx];
        const step = evaluator.evaluatePointerSample({ x: wp.x, y: wp.y });
        if (wIdx < stroke.waypoints.length - 1) {
          expect(step.unlockedWaypointIndex).toBe(wIdx);
          expect(step.strokeCompleted).toBe(false);
        } else {
          expect(step.strokeCompleted).toBe(true);
        }
      }
    }

    const progress = evaluator.getProgress();
    expect(progress.isLetterComplete).toBe(true);
    expect(progress.completedStrokeIds).toHaveLength(4);
    expect(progress.overallCompletionRatio).toBe(1);
    expect(progress.stars).toBe(3);
  });

  it('flags a topological warning if the learner attempts to draw the Shirorekha top bar during Stroke 1', () => {
    const evaluator = new TracingEvaluator(STROKE_DATASETS.ka, {
      mode: 'standard',
      smoothingAlpha: 1.0,
    });

    // Stroke 1 of क is the left loop starting at (150, 125).
    // If the user instead tries to trace along the top Shirorekha bar at y=75:
    const step1 = evaluator.evaluatePointerSample({ x: 65, y: 75 });
    expect(step1.topologicalViolation).not.toBeNull();
    expect(step1.topologicalViolation).toContain('शिरोरेखा');
  });

  it('traces simple palatal, labial, and retroflex Swor Varna (इ, ई, उ, ऊ, ऋ) across interpolated pointer trajectories', () => {
    const simpleVowels = ['i', 'ii', 'u', 'uu', 'ri'] as const;

    for (const id of simpleVowels) {
      const dataset = STROKE_DATASETS[id];
      expect(dataset).toBeDefined();
      expect(dataset.category).toBe('swor');

      const evaluator = new TracingEvaluator(dataset, {
        mode: 'standard',
        smoothingAlpha: 1.0,
      });

      for (const stroke of dataset.strokes) {
        for (let i = 0; i < stroke.waypoints.length - 1; i++) {
          const a = stroke.waypoints[i];
          const b = stroke.waypoints[i + 1];
          const steps = 6;
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const step = evaluator.evaluatePointerSample({
              x: a.x + (b.x - a.x) * t,
              y: a.y + (b.y - a.y) * t,
            });
            expect(step.topologicalViolation).toBeNull();
          }
        }
      }

      const progress = evaluator.getProgress();
      expect(progress.isLetterComplete).toBe(true);
      expect(progress.completedStrokeIds).toHaveLength(dataset.strokes.length);
      expect(progress.overallCompletionRatio).toBe(1);
      expect(progress.stars).toBe(3);
    }
  });

  it('validates and traces diphthong Swor Varna (ए, ऐ, ओ, औ) including top-hook Ekar and Aikar crown flags', () => {
    const diphthongVowels = ['e', 'ai', 'o', 'au'] as const;

    for (const id of diphthongVowels) {
      const dataset = STROKE_DATASETS[id];
      expect(dataset).toBeDefined();
      expect(dataset.category).toBe('swor');

      const evaluator = new TracingEvaluator(dataset, {
        mode: 'standard',
        smoothingAlpha: 1.0,
      });

      for (const stroke of dataset.strokes) {
        for (let i = 0; i < stroke.waypoints.length - 1; i++) {
          const a = stroke.waypoints[i];
          const b = stroke.waypoints[i + 1];
          const steps = 6;
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const step = evaluator.evaluatePointerSample({
              x: a.x + (b.x - a.x) * t,
              y: a.y + (b.y - a.y) * t,
            });
            expect(step.topologicalViolation).toBeNull();
          }
        }
      }

      const progress = evaluator.getProgress();
      expect(progress.isLetterComplete).toBe(true);
      expect(progress.completedStrokeIds).toHaveLength(dataset.strokes.length);
      expect(progress.overallCompletionRatio).toBe(1);
      expect(progress.stars).toBe(3);
    }
  });

  it('completes all 13 canonical Swor Varna (अ to अः) including Shirbindu (अं) and Visarga (अः)', () => {
    expect(VOWELS).toHaveLength(13);

    for (const vowel of VOWELS) {
      expect(vowel.hasStrokeData).toBe(true);
      const dataset = STROKE_DATASETS[vowel.id];
      expect(dataset).toBeDefined();
      expect(dataset.character).toBe(vowel.character);
      expect(dataset.category).toBe('swor');

      const evaluator = new TracingEvaluator(dataset, {
        mode: 'standard',
        smoothingAlpha: 1.0,
      });

      for (const stroke of dataset.strokes) {
        for (const wp of stroke.waypoints) {
          const step = evaluator.evaluatePointerSample({ x: wp.x, y: wp.y });
          expect(step.topologicalViolation).toBeNull();
        }
      }

      const progress = evaluator.getProgress();
      expect(progress.isLetterComplete).toBe(true);
      expect(progress.completedStrokeIds).toHaveLength(dataset.strokes.length);
      expect(progress.overallCompletionRatio).toBe(1);
      expect(progress.stars).toBe(3);
    }
  });
});

