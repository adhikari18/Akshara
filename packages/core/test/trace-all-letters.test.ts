import { describe, expect, it } from 'vitest';
import { STROKE_LIST } from '@akshara/data';
import { TracingEvaluator } from '../src/tracing-evaluator.js';

/**
 * End-to-end smoke test: a learner who follows every stroke's waypoint polyline
 * must be able to complete every bundled letter without tripping the
 * premature-Shirorekha detector or going off-corridor.
 */
describe('every bundled letter is traceable end-to-end', () => {
  it.each(STROKE_LIST.map((d) => [`${d.id} (${d.character})`, d] as const))(
    '%s',
    (_name, dataset) => {
      const evaluator = new TracingEvaluator(dataset, { mode: 'standard', smoothingAlpha: 1.0 });

      for (const stroke of dataset.strokes) {
        const wps = stroke.waypoints;
        evaluator.evaluatePointerSample({ x: wps[0]!.x, y: wps[0]!.y });
        for (let i = 0; i < wps.length - 1; i++) {
          const a = wps[i]!;
          const b = wps[i + 1]!;
          for (let s = 1; s <= 8; s++) {
            const t = s / 8;
            const step = evaluator.evaluatePointerSample({
              x: a.x + (b.x - a.x) * t,
              y: a.y + (b.y - a.y) * t,
            });
            expect(step.topologicalViolation, `${stroke.id} segment ${i}`).toBeNull();
            expect(step.isOffTrack, `${stroke.id} segment ${i}`).toBe(false);
          }
        }
      }

      const progress = evaluator.getProgress();
      expect(progress.isLetterComplete).toBe(true);
      expect(progress.completedStrokeIds).toHaveLength(dataset.strokes.length);
    }
  );
});
