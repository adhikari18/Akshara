import type { Point2D } from '@akshara/core';
import type { LetterStrokeDataset, StrokeTopologyType } from '@akshara/data';
import { compileGlyph } from '@akshara/cli';

/** A stroke drawn by a native speaker on the trainer slate: raw pointer points, one pen-down to pen-up. */
export interface DrawnStroke {
  points: Point2D[];
  type: StrokeTopologyType;
  label: string;
  nepaliInstruction: string;
  englishInstruction: string;
}

const dist = (a: Point2D, b: Point2D) => Math.hypot(a.x - b.x, a.y - b.y);

/** Resample a polyline to roughly `spacing` px between points (keeps both ends). */
export function resample(points: Point2D[], spacing = 3): Point2D[] {
  if (points.length < 2) return points.map((p) => ({ ...p }));
  const out: Point2D[] = [{ ...points[0]! }];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const d = dist(a, b);
    if (d === 0) continue;
    let t = spacing - carry;
    while (t <= d) {
      out.push({ x: a.x + ((b.x - a.x) * t) / d, y: a.y + ((b.y - a.y) * t) / d });
      t += spacing;
    }
    carry = d - (t - spacing);
  }
  const last = points[points.length - 1]!;
  if (dist(out[out.length - 1]!, last) > 0.5) out.push({ ...last });
  return out;
}

/** Moving-average smoothing that leaves both end points where they are (hand tremor removal). */
export function smooth(points: Point2D[], radius = 2, passes = 2): Point2D[] {
  let pts = points.map((p) => ({ ...p }));
  for (let pass = 0; pass < passes; pass++) {
    const next = pts.map((p) => ({ ...p }));
    for (let i = 1; i < pts.length - 1; i++) {
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (let k = Math.max(0, i - radius); k <= Math.min(pts.length - 1, i + radius); k++) {
        sx += pts[k]!.x;
        sy += pts[k]!.y;
        n++;
      }
      next[i] = { x: sx / n, y: sy / n };
    }
    pts = next;
  }
  return pts;
}

/** Ramer–Douglas–Peucker simplification. */
export function simplify(points: Point2D[], epsilon = 1.5): Point2D[] {
  if (points.length < 3) return points;
  const a = points[0]!;
  const b = points[points.length - 1]!;
  const len = dist(a, b);
  let worst = 0;
  let idx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!;
    const d =
      len === 0
        ? dist(p, a)
        : Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / len;
    if (d > worst) {
      worst = d;
      idx = i;
    }
  }
  if (worst <= epsilon) return [a, b];
  return [
    ...simplify(points.slice(0, idx + 1), epsilon).slice(0, -1),
    ...simplify(points.slice(idx), epsilon),
  ];
}

const r = (v: number) => String(Math.round(v));

/** Catmull-Rom through the points, written as cubic Béziers; a two-point stroke is a straight line. */
export function toSvgPath(points: Point2D[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0]!;
    return `M ${r(p.x)} ${r(p.y)} L ${r(p.x + 1)} ${r(p.y)}`;
  }
  const parts = [`M ${r(points[0]!.x)} ${r(points[0]!.y)}`];
  if (points.length === 2) {
    parts.push(`L ${r(points[1]!.x)} ${r(points[1]!.y)}`);
    return parts.join(' ');
  }
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    parts.push(`C ${r(c1.x)} ${r(c1.y)}, ${r(c2.x)} ${r(c2.y)}, ${r(p2.x)} ${r(p2.y)}`);
  }
  return parts.join(' ');
}

/** Turn a raw drawn gesture into a clean authored `svgPath`. */
export function fitStrokePath(points: Point2D[], type: StrokeTopologyType): string {
  const clean = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (clean.length === 0) return '';
  if (type === 'stem' || type === 'shirorekha') {
    // Straight marks: a line between the ends, horizontal for the headline.
    const a = clean[0]!;
    const b = clean[clean.length - 1]!;
    if (type === 'shirorekha') {
      const y = Math.round((a.y + b.y) / 2);
      return `M ${r(Math.min(a.x, b.x))} ${y} L ${r(Math.max(a.x, b.x))} ${y}`;
    }
    return `M ${r(a.x)} ${r(a.y)} L ${r(b.x)} ${r(b.y)}`;
  }
  const dense = smooth(resample(clean, 3), 2, 2);
  const key = simplify(dense, 1.8);
  // Drop near-duplicate neighbours so the Catmull-Rom spline stays well behaved
  const spaced = key.filter((p, i) => i === 0 || i === key.length - 1 || dist(p, key[i - 1]!) >= 4);
  return toSvgPath(spaced.length >= 2 ? spaced : [key[0]!, key[key.length - 1]!]);
}

/** Total length of a drawn gesture (to ignore accidental taps). */
export function gestureLength(points: Point2D[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1]!, points[i]!);
  return total;
}

/** Guess a stroke type from its shape: straight-and-vertical → stem, straight → diagonal, else curve. */
export function guessStrokeType(
  points: Point2D[],
  dataset: LetterStrokeDataset
): StrokeTopologyType {
  if (points.length < 2) return 'curve';
  const a = points[0]!;
  const b = points[points.length - 1]!;
  const chord = dist(a, b);
  const length = gestureLength(points);
  const straight = chord > 20 && length < chord * 1.12;
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  if (straight && dy > dx * 3) return 'stem';
  if (
    straight &&
    dx > dy * 4 &&
    dataset.shirorekha &&
    Math.abs((a.y + b.y) / 2 - dataset.shirorekha.y) < 15
  ) {
    return 'shirorekha';
  }
  if (straight) return 'diagonal';
  return 'curve';
}

/**
 * Build a complete, schema-shaped dataset from the drawn strokes, keeping the glyph's metadata
 * (phonetics, vocabulary, viewBox) and re-using the original stroke texts where the author has
 * not written their own.
 */
export function buildCorrectedDataset(
  original: LetterStrokeDataset,
  drawn: DrawnStroke[]
): LetterStrokeDataset {
  const { strokes: _old, shirorekha: _sh, ...meta } = original;
  const spec = {
    ...meta,
    strokes: drawn.map((s, i) => ({
      type: s.type,
      svgPath: fitStrokePath(s.points, s.type),
      label: s.label || `Stroke ${i + 1}`,
      nepaliInstruction: s.nepaliInstruction || `चरण ${i + 1}`,
      englishInstruction: s.englishInstruction || `Stroke ${i + 1}`,
    })),
  };
  return compileGlyph(spec as never) as unknown as LetterStrokeDataset;
}
