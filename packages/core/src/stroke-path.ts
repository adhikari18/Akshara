import type { StrokeDefinition } from '@akshara/data';
import { flattenPath } from '@akshara/data/geometry';
import { parseSvgPath } from '@akshara/data/svg-path';
import type { Point2D } from './tracing-evaluator.js';

/** Spacing (logical px) between reference samples along a stroke's authored curve. */
export const REFERENCE_SAMPLE_STEP = 2;

/**
 * Dense, headless representation of a stroke's authored `svgPath`, the ground truth the learner
 * must follow. Waypoints are only sparse checkpoints on this curve.
 */
export interface StrokeReferencePath {
  /** Every sample along the curve, concatenated across subpaths, in drawing order. */
  samples: Point2D[];
  /** Index of each sample's subpath (pen-lift gaps are never treated as part of the curve). */
  subpathOf: number[];
  /** For each waypoint, the index in `samples` it sits on (monotonic non-decreasing). */
  waypointSampleIndex: number[];
}

function dist(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Shortest distance from `p` to segment `ab`. */
export function pointToSegmentDistance(p: Point2D, a: Point2D, b: Point2D): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lenSq = vx * vx + vy * vy;
  if (lenSq === 0) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / lenSq));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

/**
 * Assign each waypoint to a curve sample so that assignments are in drawing order and the
 * summed waypoint→sample distance is minimal. A greedy nearest-sample search can jump to the
 * wrong pass of a self-intersecting loop; this monotonic DP cannot.
 */
function alignWaypoints(waypoints: Point2D[], samples: Point2D[]): number[] {
  const n = samples.length;
  let prev = samples.map((s) => dist(waypoints[0]!, s));
  const choices: number[][] = [];
  for (let k = 1; k < waypoints.length; k++) {
    // best[i] = min over j <= i of prev[j], remembering the argmin for backtracking
    const bestIdx: number[] = new Array(n);
    let runIdx = 0;
    for (let i = 0; i < n; i++) {
      if (prev[i]! < prev[runIdx]!) runIdx = i;
      bestIdx[i] = runIdx;
    }
    choices.push(bestIdx);
    prev = samples.map((s, i) => dist(waypoints[k]!, s) + prev[bestIdx[i]!]!);
  }
  let idx = 0;
  for (let i = 1; i < n; i++) if (prev[i]! < prev[idx]!) idx = i;
  const result = [idx];
  for (let k = choices.length - 1; k >= 0; k--) {
    idx = choices[k]![idx]!;
    result.unshift(idx);
  }
  return result;
}

export function buildStrokeReferencePath(
  stroke: Pick<StrokeDefinition, 'svgPath' | 'waypoints'>,
  step = REFERENCE_SAMPLE_STEP
): StrokeReferencePath {
  const polylines = flattenPath(parseSvgPath(stroke.svgPath), step);
  const samples: Point2D[] = [];
  const subpathOf: number[] = [];
  polylines.forEach((line, sub) => {
    for (const p of line) {
      samples.push({ x: p.x, y: p.y });
      subpathOf.push(sub);
    }
  });
  if (samples.length === 0) {
    // Degenerate path: fall back to the waypoint polyline so evaluation still works.
    stroke.waypoints.forEach((w) => {
      samples.push({ x: w.x, y: w.y });
      subpathOf.push(0);
    });
  }
  return {
    samples,
    subpathOf,
    waypointSampleIndex: alignWaypoints(stroke.waypoints, samples),
  };
}

/** Minimum distance from `p` to the authored curve (never measures across a pen-lift gap). */
export function distanceToReferencePath(p: Point2D, ref: StrokeReferencePath): number {
  const { samples, subpathOf } = ref;
  if (samples.length === 1) return dist(p, samples[0]!);
  let min = Infinity;
  for (let i = 0; i < samples.length - 1; i++) {
    if (subpathOf[i] !== subpathOf[i + 1]) continue;
    const d = pointToSegmentDistance(p, samples[i]!, samples[i + 1]!);
    if (d < min) min = d;
  }
  return min;
}

/**
 * Points along the authored curve from the first to the last waypoint, about `spacing` px
 * apart. Intended for demos ("Show me") and tests that need a faithful trace of the stroke.
 */
export function sampleStrokePath(
  stroke: Pick<StrokeDefinition, 'svgPath' | 'waypoints'>,
  spacing = 4
): Point2D[] {
  const ref = buildStrokeReferencePath(stroke);
  const first = ref.waypointSampleIndex[0]!;
  const last = ref.waypointSampleIndex[ref.waypointSampleIndex.length - 1]!;
  const every = Math.max(1, Math.round(spacing / REFERENCE_SAMPLE_STEP));
  const wps = stroke.waypoints;
  const out: Point2D[] = [{ x: wps[0]!.x, y: wps[0]!.y }];
  for (let i = first; i <= last; i += every) out.push({ ...ref.samples[i]! });
  out.push({ ...ref.samples[last]! });
  out.push({ x: wps[wps.length - 1]!.x, y: wps[wps.length - 1]!.y });
  return out;
}
