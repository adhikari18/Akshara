import { buildStrokeReferencePath, type Point2D } from '@akshara/core';
import type { LetterStrokeDataset, StrokeTopologyType } from '@akshara/data';
import { compileGlyph } from '@akshara/cli';

/** How a stroke was authored on the trainer slate. */
export type InputMode = 'draw' | 'points';

/**
 * A stroke authored by a native speaker: either a freehand gesture (`draw`, many raw pointer
 * points) or an ordered list of placed points (`points`) the trace must pass through in order.
 */
export interface DrawnStroke {
  points: Point2D[];
  type: StrokeTopologyType;
  label: string;
  nepaliInstruction: string;
  englishInstruction: string;
  mode?: InputMode;
  /** Snap the stroke onto the faint reference glyph where it runs close to it. */
  snap?: boolean;
}

const dist = (a: Point2D, b: Point2D) => Math.hypot(a.x - b.x, a.y - b.y);
const r = (v: number) => String(Math.round(v));

// ---------------------------------------------------------------------------------------------
// Reference glyph guide: dense polylines of the current strokes, so authored points can snap to
// and route along the real letter shape instead of a shaky hand line.
// ---------------------------------------------------------------------------------------------

export interface GuideTrack {
  points: Point2D[];
  cumulative: number[];
  closed: boolean;
}

export interface GlyphGuide {
  tracks: GuideTrack[];
}

/** Distance (logical px) within which a freehand line counts as running along the reference glyph. */
export const SNAP_DISTANCE = 16;
/** A tapped point may be a little further off: fingers are not precise. */
export const TAP_SNAP_DISTANCE = 28;
/** Once a freehand stroke is judged to follow the glyph, its points are pulled in from this far. */
const WIDE_SNAP_DISTANCE = 32;
/** Share of a freehand stroke that must run along the glyph before the whole stroke snaps. */
const SNAP_MAJORITY = 0.6;

export function buildGlyphGuide(dataset: LetterStrokeDataset): GlyphGuide {
  const tracks: GuideTrack[] = [];
  for (const stroke of dataset.strokes) {
    const ref = buildStrokeReferencePath(stroke, 1.5);
    let current: Point2D[] = [];
    let sub = ref.subpathOf[0] ?? 0;
    const flush = () => {
      if (current.length >= 2) {
        const cumulative = [0];
        for (let i = 1; i < current.length; i++)
          cumulative.push(cumulative[i - 1]! + dist(current[i - 1]!, current[i]!));
        tracks.push({
          points: current,
          cumulative,
          closed: dist(current[0]!, current[current.length - 1]!) < 6,
        });
      }
      current = [];
    };
    ref.samples.forEach((p, i) => {
      if (ref.subpathOf[i] !== sub) {
        flush();
        sub = ref.subpathOf[i]!;
      }
      current.push(p);
    });
    flush();
  }
  return { tracks };
}

interface Snap {
  point: Point2D;
  track: number;
  index: number;
  distance: number;
}

/** Nearest sample of the reference glyph to `p`, or null if none is within `maxDistance`. */
export function snapToGuide(
  guide: GlyphGuide,
  p: Point2D,
  maxDistance = SNAP_DISTANCE
): Snap | null {
  let best: Snap | null = null;
  guide.tracks.forEach((track, t) => {
    track.points.forEach((q, i) => {
      const d = dist(p, q);
      if (d <= maxDistance && (!best || d < best.distance))
        best = { point: q, track: t, index: i, distance: d };
    });
  });
  return best;
}

/** Walk the track from sample `a` to sample `b`, the short way round if the track is a closed loop. */
function walkTrack(track: GuideTrack, a: number, b: number): Point2D[] {
  const n = track.points.length;
  if (a === b) return [track.points[a]!];
  const forward = (from: number, to: number) => {
    const out: Point2D[] = [];
    for (let i = from; ; i = (i + 1) % n) {
      out.push(track.points[i]!);
      if (i === to) break;
    }
    return out;
  };
  const direct = a < b ? track.points.slice(a, b + 1) : track.points.slice(b, a + 1).reverse();
  if (!track.closed) return direct;
  // Closed loop: compare the direct span with the one that wraps past the seam
  const directLen = Math.abs(track.cumulative[b]! - track.cumulative[a]!);
  const total = track.cumulative[n - 1]!;
  if (directLen <= total - directLen) return direct;
  return a < b ? forward(b, a).reverse() : forward(a, b);
}

/**
 * Point mode: the trace runs through the placed points in order. Between two consecutive points
 * that both lie on the same piece of the reference glyph, it follows that piece exactly;
 * otherwise it goes straight.
 */
export function routeThroughPoints(
  points: Point2D[],
  guide: GlyphGuide | null,
  snap: boolean
): Point2D[] {
  if (points.length === 0) return [];
  const snaps = points.map((p) =>
    snap && guide ? snapToGuide(guide, p, TAP_SNAP_DISTANCE) : null
  );
  const anchors = points.map((p, i) => snaps[i]?.point ?? p);
  const out: Point2D[] = [anchors[0]!];
  for (let i = 1; i < points.length; i++) {
    const prev = snaps[i - 1];
    const cur = snaps[i];
    if (prev && cur && prev.track === cur.track && guide) {
      out.push(...walkTrack(guide.tracks[prev.track]!, prev.index, cur.index).slice(1));
    } else if (dist(anchors[i - 1]!, anchors[i]!) < 8) {
      // Two pieces of the glyph meeting (e.g. where one authored stroke ended and the next began)
      out.push(anchors[i]!);
    } else {
      // Off the glyph (or across two of its pieces): a gentle spline, using the neighbouring
      // points as tangent hints, so placed points never produce a sharp corner.
      const p0 = anchors[Math.max(0, i - 2)]!;
      const p3 = anchors[Math.min(anchors.length - 1, i + 1)]!;
      out.push(...catmullRomSegment(p0, anchors[i - 1]!, anchors[i]!, p3).slice(1));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Freehand clean-up
// ---------------------------------------------------------------------------------------------

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

/** Does most of a freehand line run along the reference glyph? */
export function followsGlyph(points: Point2D[], guide: GlyphGuide): boolean {
  if (points.length === 0) return false;
  const near = points.filter((p) => snapToGuide(guide, p, SNAP_DISTANCE) !== null).length;
  return near / points.length >= SNAP_MAJORITY;
}

/**
 * Pull a freehand line onto the reference glyph — but only when most of it runs along the glyph,
 * and then as a whole (from a generous distance), so a stroke is either faithfully on the letter
 * or left as drawn, never a kinked mixture of the two.
 */
export function snapPolyline(points: Point2D[], guide: GlyphGuide): Point2D[] {
  if (!followsGlyph(points, guide)) return points;
  const snapped = points.map((p) => snapToGuide(guide, p, WIDE_SNAP_DISTANCE)?.point ?? p);
  // Collapse runs of points that landed on the same glyph sample
  return snapped.filter((p, i) => i === 0 || dist(p, snapped[i - 1]!) > 0.5);
}

// ---------------------------------------------------------------------------------------------
// Least-squares cubic Bézier fitting (Schneider, "An Algorithm for Automatically Fitting
// Digitized Curves"), so a curve becomes one or two clean arcs rather than a chain of wobbles.
// ---------------------------------------------------------------------------------------------

type Cubic = [Point2D, Point2D, Point2D, Point2D];

const add = (a: Point2D, b: Point2D) => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Point2D, b: Point2D) => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Point2D, k: number) => ({ x: a.x * k, y: a.y * k });
const dot = (a: Point2D, b: Point2D) => a.x * b.x + a.y * b.y;
const norm = (a: Point2D) => {
  const n = Math.hypot(a.x, a.y);
  return n > 1e-9 ? { x: a.x / n, y: a.y / n } : { x: 1, y: 0 };
};

function bezierAt(c: Cubic, t: number): Point2D {
  const mt = 1 - t;
  return add(
    add(mul(c[0], mt * mt * mt), mul(c[1], 3 * mt * mt * t)),
    add(mul(c[2], 3 * mt * t * t), mul(c[3], t * t * t))
  );
}

function chordParams(pts: Point2D[]): number[] {
  const u = [0];
  for (let i = 1; i < pts.length; i++) u.push(u[i - 1]! + dist(pts[i - 1]!, pts[i]!));
  const total = u[u.length - 1]!;
  return u.map((v) => (total > 0 ? v / total : 0));
}

/** Least-squares cubic with fixed end points and unit end tangents t0 (leaving p0) / t1 (arriving at p3, pointing back). */
function fitSingle(pts: Point2D[], u: number[], t0: Point2D, t1: Point2D): Cubic {
  const p0 = pts[0]!;
  const p3 = pts[pts.length - 1]!;
  let c11 = 0;
  let c12 = 0;
  let c22 = 0;
  let x1 = 0;
  let x2 = 0;
  for (let i = 0; i < pts.length; i++) {
    const t = u[i]!;
    const mt = 1 - t;
    const b0 = mt * mt * mt;
    const b1 = 3 * mt * mt * t;
    const b2 = 3 * mt * t * t;
    const b3 = t * t * t;
    const a1 = mul(t0, b1);
    const a2 = mul(t1, b2);
    const tmp = sub(pts[i]!, add(mul(p0, b0 + b1), mul(p3, b2 + b3)));
    c11 += dot(a1, a1);
    c12 += dot(a1, a2);
    c22 += dot(a2, a2);
    x1 += dot(a1, tmp);
    x2 += dot(a2, tmp);
  }
  const det = c11 * c22 - c12 * c12;
  const seg = dist(p0, p3);
  let alpha1 = seg / 3;
  let alpha2 = seg / 3;
  if (Math.abs(det) > 1e-9) {
    const a1 = (x1 * c22 - x2 * c12) / det;
    const a2 = (c11 * x2 - c12 * x1) / det;
    if (a1 > seg * 0.05 && a2 > seg * 0.05 && a1 < seg * 2.5 && a2 < seg * 2.5) {
      alpha1 = a1;
      alpha2 = a2;
    }
  }
  return [p0, add(p0, mul(t0, alpha1)), add(p3, mul(t1, alpha2)), p3];
}

/** One Newton–Raphson step of re-parameterisation of each point against the fitted curve. */
function reparameterize(pts: Point2D[], c: Cubic, u: number[]): number[] {
  return u.map((t, i) => {
    if (i === 0 || i === pts.length - 1) return t;
    const q = bezierAt(c, t);
    const mt = 1 - t;
    const d1 = add(
      add(mul(sub(c[1], c[0]), 3 * mt * mt), mul(sub(c[2], c[1]), 6 * mt * t)),
      mul(sub(c[3], c[2]), 3 * t * t)
    );
    const d2 = add(
      mul(add(sub(c[2], mul(c[1], 2)), c[0]), 6 * mt),
      mul(add(sub(c[3], mul(c[2], 2)), c[1]), 6 * t)
    );
    const diff = sub(q, pts[i]!);
    const num = dot(diff, d1);
    const den = dot(d1, d1) + dot(diff, d2);
    const next = Math.abs(den) > 1e-9 ? t - num / den : t;
    return Math.min(1, Math.max(0, next));
  });
}

function maxError(pts: Point2D[], c: Cubic, u: number[]): { error: number; index: number } {
  let error = 0;
  let index = Math.floor(pts.length / 2);
  for (let i = 0; i < pts.length; i++) {
    const d = dist(bezierAt(c, u[i]!), pts[i]!);
    if (d > error) {
      error = d;
      index = i;
    }
  }
  return { error, index };
}

function tangentAt(pts: Point2D[], i: number, direction: 1 | -1): Point2D {
  const reach = Math.min(3, pts.length - 1);
  const j = Math.max(0, Math.min(pts.length - 1, i + direction * reach));
  return norm(sub(pts[j]!, pts[i]!));
}

/** Fit `pts` with as few cubics as keep every point within `tolerance`; tangents stay continuous at joins. */
export function fitCubics(
  pts: Point2D[],
  tolerance = 1.5,
  t0?: Point2D,
  t1?: Point2D,
  depth = 0
): Cubic[] {
  const start = t0 ?? tangentAt(pts, 0, 1);
  const end = t1 ?? tangentAt(pts, pts.length - 1, -1);
  if (pts.length === 2) {
    const seg = dist(pts[0]!, pts[1]!) / 3;
    return [[pts[0]!, add(pts[0]!, mul(start, seg)), add(pts[1]!, mul(end, seg)), pts[1]!]];
  }
  let u = chordParams(pts);
  let best: { cubic: Cubic; error: number; index: number } | null = null;
  for (let iter = 0; iter < 5; iter++) {
    const cubic = fitSingle(pts, u, start, end);
    const { error, index } = maxError(pts, cubic, u);
    if (!best || error < best.error) best = { cubic, error, index };
    if (error <= tolerance) return [cubic];
    u = reparameterize(pts, cubic, u);
  }
  // Never chase noise: tiny pieces are not worth another cubic
  if (depth >= 8 || pts.length < 5 || gestureLength(pts) < 14) return [best!.cubic];
  const split = Math.min(Math.max(best!.index, 2), pts.length - 3);
  const centre = norm(sub(pts[split + 1]!, pts[split - 1]!));
  return [
    ...fitCubics(pts.slice(0, split + 1), tolerance, start, mul(centre, -1), depth + 1),
    ...fitCubics(pts.slice(split), tolerance, centre, end, depth + 1),
  ];
}

/** Write cubics (and straight runs) as an integer-coordinate SVG path. */
export function cubicsToSvgPath(cubics: Cubic[]): string {
  if (cubics.length === 0) return '';
  const parts = [`M ${r(cubics[0]![0].x)} ${r(cubics[0]![0].y)}`];
  for (const c of cubics) {
    parts.push(`C ${r(c[1].x)} ${r(c[1].y)}, ${r(c[2].x)} ${r(c[2].y)}, ${r(c[3].x)} ${r(c[3].y)}`);
  }
  return parts.join(' ');
}

/** Catmull-Rom through the points as cubic Béziers (kept for sparse control points). */
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

/** The dense polyline a stroke's authored `svgPath` will be fitted to. */
export function strokeCenterline(stroke: DrawnStroke, guide: GlyphGuide | null): Point2D[] {
  const clean = stroke.points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (clean.length === 0) return [];
  const snap = stroke.snap ?? true;
  if (stroke.mode === 'points') {
    return resample(routeThroughPoints(clean, guide, snap), 2);
  }
  const dense = resample(clean, 3);
  if (snap && guide && followsGlyph(dense, guide)) {
    // The hand line runs along the glyph: keep only its corners / turning points and let the
    // trace follow the real letter between them, exactly like placed points. Jitter cannot
    // survive this — the output is the glyph's own centreline.
    const keys = simplify(smooth(dense, 2, 2), 5);
    return resample(routeThroughPoints(keys, guide, true), 2);
  }
  return smooth(dense, 2, 2);
}

/** Points along the Catmull-Rom segment p1→p2 (p0 / p3 shape the tangents). */
function catmullRomSegment(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  steps = 12
): Point2D[] {
  const out: Point2D[] = [p1];
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    const t2 = t * t;
    const t3 = t2 * t;
    out.push({
      x:
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y:
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    });
  }
  return out;
}

/** Turn an authored stroke into a clean `svgPath`. */
export function fitStrokePath(stroke: DrawnStroke, guide: GlyphGuide | null = null): string {
  const clean = stroke.points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (clean.length === 0) return '';
  if (stroke.type === 'stem' || stroke.type === 'shirorekha') {
    // Straight marks: a line between the ends, horizontal for the headline.
    const a = clean[0]!;
    const b = clean[clean.length - 1]!;
    if (stroke.type === 'shirorekha') {
      const y = Math.round((a.y + b.y) / 2);
      return `M ${r(Math.min(a.x, b.x))} ${y} L ${r(Math.max(a.x, b.x))} ${y}`;
    }
    return `M ${r(a.x)} ${r(a.y)} L ${r(b.x)} ${r(b.y)}`;
  }
  const line = strokeCenterline(stroke, guide);
  if (line.length < 2) return toSvgPath(line);
  // A straight-ish mark stays a straight line
  const key = simplify(line, 1.6);
  if (key.length === 2) return toSvgPath(key);
  return cubicsToSvgPath(fitCubics(line, 1.4));
}

/** Total length of a gesture (to ignore accidental taps). */
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
 * Build a complete, schema-shaped dataset from the authored strokes, keeping the glyph's
 * metadata (phonetics, vocabulary, viewBox) and re-using the original stroke texts where the
 * author has not written their own.
 */
export function buildCorrectedDataset(
  original: LetterStrokeDataset,
  drawn: DrawnStroke[],
  guide: GlyphGuide = buildGlyphGuide(original)
): LetterStrokeDataset {
  const { strokes: _old, shirorekha: _sh, ...meta } = original;
  const spec = {
    ...meta,
    strokes: drawn.map((s, i) => ({
      type: s.type,
      svgPath: fitStrokePath(s, guide),
      label: s.label || `Stroke ${i + 1}`,
      nepaliInstruction: s.nepaliInstruction || `चरण ${i + 1}`,
      englishInstruction: s.englishInstruction || `Stroke ${i + 1}`,
    })),
  };
  return compileGlyph(spec as never) as unknown as LetterStrokeDataset;
}

/**
 * Like `buildCorrectedDataset`, but always produces something to preview. A letter that is not
 * finished yet (no Shirorekha as its last stroke, a headline in the middle, …) cannot be compiled
 * as export-ready data; it is then built as a draft — same stroke geometry, checkpoints and
 * metadata — and `problem` says what is still missing before it can be exported.
 */
export function buildPreviewDataset(
  original: LetterStrokeDataset,
  drawn: DrawnStroke[],
  guide: GlyphGuide = buildGlyphGuide(original)
): { dataset: LetterStrokeDataset; problem: string | null } {
  try {
    return { dataset: buildCorrectedDataset(original, drawn, guide), problem: null };
  } catch (e) {
    const problem = e instanceof Error ? e.message : String(e);
    const { strokes: _old, shirorekha: _sh, ...meta } = original;
    // Compile as a headline-free glyph (no stroke-count / headline rules), then restore the
    // real category and stroke types.
    const draft = compileGlyph({
      ...meta,
      category: 'numeral',
      strokes: drawn.map((s, i) => ({
        type: s.type === 'shirorekha' ? 'curve' : s.type,
        svgPath: fitStrokePath(s, guide),
        label: s.label || `Stroke ${i + 1}`,
        nepaliInstruction: s.nepaliInstruction || `चरण ${i + 1}`,
        englishInstruction: s.englishInstruction || `Stroke ${i + 1}`,
      })),
    } as never) as unknown as LetterStrokeDataset;
    draft.category = original.category;
    draft.strokes.forEach((s, i) => {
      s.type = drawn[i]!.type;
    });
    return { dataset: draft, problem };
  }
}
