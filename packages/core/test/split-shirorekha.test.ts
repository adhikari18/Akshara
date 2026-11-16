import { describe, expect, it } from 'vitest';
import { STROKE_DATASETS, STROKE_LIST, getShirorekhaSegments } from '@akshara/data';
import { TracingEvaluator, sampleStrokeSubpaths } from '../src/index.js';

const dha = STROKE_DATASETS.dha!;
const headline = dha.strokes[dha.strokes.length - 1]!;
const [span1, span2] = getShirorekhaSegments(dha);

/** Position an evaluator on ध's headline by faithfully tracing the body strokes first. */
function atHeadline(mode: 'child' | 'standard' | 'strict' = 'child') {
  const evaluator = new TracingEvaluator(dha, { mode, smoothingAlpha: 1 });
  for (const stroke of dha.strokes.slice(0, -1)) {
    for (const gesture of sampleStrokeSubpaths(stroke, 3)) {
      for (const p of gesture) if (evaluator.evaluatePointerSample(p).strokeCompleted) break;
      evaluator.endGesture();
    }
  }
  expect(evaluator.getCurrentStroke()?.id).toBe(headline.id);
  return evaluator;
}

const alongHeadline = (fromX: number, toX: number, step = 3) =>
  Array.from({ length: Math.floor(Math.abs(toX - fromX) / step) + 1 }, (_, i) => ({
    x: fromX + Math.sign(toX - fromX) * i * step,
    y: 75,
  }));

describe('split Shirorekha (ध): the pen must lift over the gap', () => {
  it('has the split headline data from roadmap 1.3', () => {
    expect(getShirorekhaSegments(dha)).toHaveLength(2);
    expect(span2!.startX - span1!.endX).toBeGreaterThan(8);
    expect(sampleStrokeSubpaths(headline)).toHaveLength(2);
  });

  it('completes with no mistakes when the learner lifts over the gap', () => {
    const evaluator = atHeadline();
    let completed = false;
    for (const gesture of sampleStrokeSubpaths(headline, 3)) {
      for (const p of gesture) {
        const step = evaluator.evaluatePointerSample(p);
        expect(step.gapBridged).toBe(false);
        completed ||= step.strokeCompleted;
      }
      evaluator.endGesture();
    }
    expect(completed).toBe(true);
    expect(evaluator.getProgress().mistakeCount).toBe(0);
    expect(evaluator.getProgress().isLetterComplete).toBe(true);
  });

  it('flags one straight line dragged right across the gap, and keeps the dots locked', () => {
    const evaluator = atHeadline();
    const steps = alongHeadline(span1!.startX, span2!.endX).map((p) =>
      evaluator.evaluatePointerSample(p)
    );
    const flagged = steps.filter((s) => s.gapBridged);
    expect(flagged.length).toBeGreaterThan(0);
    expect(steps.filter((s) => s.warningOnset)).toHaveLength(1);
    expect(flagged[0]!.hint).toEqual({ code: 'lift-over-gap', gap: 1 });
    // The first flagged sample is in (or across) the gap, not on a span
    expect(flagged[0]!.smoothedPoint.x).toBeGreaterThan(span1!.endX);
    expect(steps.some((s) => s.strokeCompleted)).toBe(false);
    // Nothing unlocks after the bridge
    const unlockedAtBridge = flagged[0]!.unlockedWaypointIndex;
    expect(flagged.every((s) => s.unlockedWaypointIndex === unlockedAtBridge)).toBe(true);
    expect(evaluator.getProgress().mistakeCount).toBe(1);
  });

  it('also catches a fast pointer that jumps the gap in a single sample', () => {
    const evaluator = atHeadline('standard');
    for (const p of alongHeadline(span1!.startX, span1!.endX)) evaluator.evaluatePointerSample(p);
    const jump = evaluator.evaluatePointerSample({ x: span2!.startX + 6, y: 75 });
    expect(jump.gapBridged).toBe(true);
    expect(jump.warningOnset).toBe(true);
  });

  it('lets the learner lift, keep the first span, and finish from the other side', () => {
    const evaluator = atHeadline();
    for (const p of alongHeadline(span1!.startX, span2!.endX)) evaluator.evaluatePointerSample(p);
    expect(evaluator.getProgress().isLetterComplete).toBe(false);

    evaluator.endGesture();
    // Progress rolls back to the end of span 1 — not to zero
    const afterLift = evaluator.getProgress();
    expect(afterLift.unlockedWaypointsInCurrentStroke).toBe(2); // dots 1 and 2 (span 1's ends)
    expect(afterLift.isLetterComplete).toBe(false);

    // Touch down on the second span and draw it: the letter completes
    let completed = false;
    for (const p of alongHeadline(span2!.startX, span2!.endX)) {
      const step = evaluator.evaluatePointerSample(p);
      expect(step.gapBridged).toBe(false);
      completed ||= step.strokeCompleted;
    }
    expect(completed).toBe(true);
    expect(evaluator.getProgress().mistakeCount).toBe(1);
  });

  it('does not treat touching the span ends as bridging', () => {
    const evaluator = atHeadline();
    // Draw span 1 and overshoot its end by a couple of px (inside the slack)
    for (const p of alongHeadline(span1!.startX, span1!.endX + 3)) {
      expect(evaluator.evaluatePointerSample(p).gapBridged).toBe(false);
    }
  });

  it('ignores the gap for strokes that are not the headline', () => {
    // Crossing the gap's x-range while drawing the body is not a headline bridge
    const evaluator = new TracingEvaluator(dha, { mode: 'child', smoothingAlpha: 1 });
    const body = dha.strokes[0]!;
    for (const gesture of sampleStrokeSubpaths(body, 3)) {
      for (const p of gesture) expect(evaluator.evaluatePointerSample(p).gapBridged).toBe(false);
      evaluator.endGesture();
    }
  });
});

describe('partial headlines (थ, भ) and the premature-Shirorekha rule', () => {
  it('only counts the real span as "the headline" when checking for an early bar', () => {
    const tha = STROKE_DATASETS.tha!;
    const [span] = getShirorekhaSegments(tha);
    expect(span!.startX).toBeGreaterThan(150); // थ's bar is short, on the right
    const evaluator = new TracingEvaluator(tha, { mode: 'child', smoothingAlpha: 1 });
    // Sweeping along y = 75 well to the LEFT of थ's bar is not drawing its headline early…
    for (let x = 60; x <= 120; x += 5) {
      expect(evaluator.evaluatePointerSample({ x, y: 75 }).topologicalViolation).toBeNull();
    }
    evaluator.endGesture();
    // …but sweeping along the bar itself (before the body is done) is.
    const onBar = evaluator.evaluatePointerSample({ x: span!.startX + 10, y: 75 });
    const onBar2 = evaluator.evaluatePointerSample({ x: span!.startX + 20, y: 75 });
    expect(onBar.topologicalViolation ?? onBar2.topologicalViolation).toBe(
      'shirorekha-before-body'
    );
  });

  it('every letter with a headline has its spans inside the glyph box', () => {
    for (const d of STROKE_LIST) {
      if (!d.shirorekha) continue;
      for (const span of getShirorekhaSegments(d)) {
        expect(span.startX).toBeGreaterThanOrEqual(0);
        expect(span.endX).toBeLessThanOrEqual(300);
        expect(span.endX).toBeGreaterThan(span.startX);
      }
    }
  });
});
