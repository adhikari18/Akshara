import type { Point, Segment } from './svg-path.js';

// 5-point Gauss–Legendre nodes/weights on [-1, 1].
const GL_NODES = [
  0, -0.5384693101056831, 0.5384693101056831, -0.906179845938664, 0.906179845938664,
];
const GL_WEIGHTS = [
  0.5688888888888889, 0.47862867049936647, 0.47862867049936647, 0.23692688505618908,
  0.23692688505618908,
];

/** Evaluate a cubic Bézier at parameter t in [0, 1]. */
export function cubicPoint(p0: Point, c1: Point, c2: Point, p1: Point, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * c1.x + c * c2.x + d * p1.x,
    y: a * p0.y + b * c1.y + c * c2.y + d * p1.y,
  };
}

function cubicSpeed(p0: Point, c1: Point, c2: Point, p1: Point, t: number): number {
  const u = 1 - t;
  const dx = 3 * u * u * (c1.x - p0.x) + 6 * u * t * (c2.x - c1.x) + 3 * t * t * (p1.x - c2.x);
  const dy = 3 * u * u * (c1.y - p0.y) + 6 * u * t * (c2.y - c1.y) + 3 * t * t * (p1.y - c2.y);
  return Math.hypot(dx, dy);
}

/** Arc length of a cubic Bézier from t=0 to t=tEnd via Gauss–Legendre quadrature. */
export function cubicArcLength(p0: Point, c1: Point, c2: Point, p1: Point, tEnd = 1): number {
  // Subdivide so quadrature stays accurate for tight curls.
  const panels = 8;
  let total = 0;
  for (let k = 0; k < panels; k++) {
    const a = (tEnd * k) / panels;
    const b = (tEnd * (k + 1)) / panels;
    const half = (b - a) / 2;
    const mid = (a + b) / 2;
    let sum = 0;
    for (let i = 0; i < GL_NODES.length; i++) {
      sum += GL_WEIGHTS[i]! * cubicSpeed(p0, c1, c2, p1, mid + half * GL_NODES[i]!);
    }
    total += sum * half;
  }
  return total;
}

/** Length of a single normalized segment (M has zero length). */
export function segmentLength(seg: Segment): number {
  switch (seg.type) {
    case 'M':
      return 0;
    case 'L':
    case 'Z':
      return Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y);
    case 'C':
      return cubicArcLength(seg.from, seg.c1, seg.c2, seg.to);
  }
}

/** Total arc length of a parsed path. */
export function pathLength(segments: Segment[]): number {
  return segments.reduce((sum, s) => sum + segmentLength(s), 0);
}

/** Point at arc-length distance `s` along a single segment of known length. */
function pointOnSegment(seg: Segment, s: number, length: number): Point {
  if (seg.type === 'M') return seg.to;
  if (seg.type === 'L' || seg.type === 'Z') {
    const t = length === 0 ? 0 : s / length;
    return {
      x: seg.from.x + (seg.to.x - seg.from.x) * t,
      y: seg.from.y + (seg.to.y - seg.from.y) * t,
    };
  }
  if (s <= 0) return seg.from;
  if (s >= length) return seg.to;
  // Invert arc length -> t by bisection.
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (cubicArcLength(seg.from, seg.c1, seg.c2, seg.to, mid) < s) lo = mid;
    else hi = mid;
  }
  return cubicPoint(seg.from, seg.c1, seg.c2, seg.to, (lo + hi) / 2);
}

/** Point at absolute arc-length distance `s` (clamped) along the whole path. */
export function pointAtLength(segments: Segment[], s: number): Point {
  let remaining = Math.max(0, s);
  let last: Point = { x: 0, y: 0 };
  for (const seg of segments) {
    const len = segmentLength(seg);
    if (seg.type === 'M') {
      last = seg.to;
      continue;
    }
    if (remaining <= len) return pointOnSegment(seg, remaining, len);
    remaining -= len;
    last = seg.to;
  }
  return last;
}

/**
 * Sample `count` waypoints (count >= 2) at equal arc-length spacing,
 * always including the exact start and end of the path.
 */
export function sampleEquidistant(segments: Segment[], count: number): Point[] {
  if (!Number.isInteger(count) || count < 2)
    throw new Error('Waypoint count must be an integer >= 2.');
  const total = pathLength(segments);
  const pts: Point[] = [];
  for (let i = 0; i < count; i++) {
    pts.push(pointAtLength(segments, (total * i) / (count - 1)));
  }
  return pts;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Tight bounding box of the path, computed from densely sampled curve points. */
export function pathBoundingBox(segments: Segment[]): BoundingBox {
  const box: BoundingBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const add = (p: Point) => {
    box.minX = Math.min(box.minX, p.x);
    box.minY = Math.min(box.minY, p.y);
    box.maxX = Math.max(box.maxX, p.x);
    box.maxY = Math.max(box.maxY, p.y);
  };
  for (const seg of segments) {
    if (seg.type === 'M') add(seg.to);
    else if (seg.type === 'L' || seg.type === 'Z') {
      add(seg.from);
      add(seg.to);
    } else {
      for (let i = 0; i <= 64; i++) add(cubicPoint(seg.from, seg.c1, seg.c2, seg.to, i / 64));
    }
  }
  return box;
}
