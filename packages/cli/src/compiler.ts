import type { DirectionHint, StrokeTopologyType } from '@akshara/data';
import { pathBoundingBox, pathLength, sampleEquidistant } from './geometry.js';
import { parseSvgPath, splitSubpaths, type Point, type Segment } from './svg-path.js';

// Re-use the canonical dataset types so the compiler cannot drift from @akshara/data.
export type StrokeType = StrokeTopologyType;
export type { DirectionHint };

/** Authoring input for one stroke: only the SVG path and type are mandatory. */
export interface StrokeSpec {
  type: StrokeType;
  svgPath: string;
  label?: string;
  nepaliInstruction?: string;
  englishInstruction?: string;
  directionHint?: DirectionHint;
  toleranceRadius?: number;
  /** Override the automatically chosen waypoint count (>= 3). */
  waypointCount?: number;
  /** Explicit waypoint labels (must match the sampled waypoint count). */
  waypointLabels?: string[];
}

/** Authoring input for one glyph. Extra letter metadata is passed through untouched. */
export interface GlyphSpec {
  id: string;
  character: string;
  unicode: string;
  category: 'swor' | 'vyanjan' | 'samyukta' | 'numeral';
  strokes: StrokeSpec[];
  viewBox?: { width: 300; height: 300; shirorekhaY: number; baselineY: number };
  shirorekha?: {
    enforcedLast: true;
    startX: number;
    endX: number;
    y: number;
    segments?: Array<{ startX: number; endX: number }>;
  };
  [extra: string]: unknown;
}

export interface CompileOptions {
  /** Target distance between waypoints in coordinate units. Default 45. */
  spacing?: number;
  /** Default hit radius when a stroke omits one. Default 28 (26 for stem/shirorekha). */
  toleranceRadius?: number;
  /** Fallback baseline Y when no viewBox is supplied. Default: lowest stroke point rounded. */
  baselineY?: number;
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Σ Δθ along sampled points (radians, y-down: positive = clockwise on screen). */
function turningAngle(pts: Point[]): number {
  let total = 0;
  let prev: number | null = null;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i]!.x - pts[i - 1]!.x;
    const dy = pts[i]!.y - pts[i - 1]!.y;
    if (dx === 0 && dy === 0) continue;
    const heading = Math.atan2(dy, dx);
    if (prev !== null) {
      let d = heading - prev;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d <= -Math.PI) d += 2 * Math.PI;
      if (Math.abs(d) < (150 * Math.PI) / 180) total += d; // skip cusps / retraces
    }
    prev = heading;
  }
  return total;
}

/** Infer a direction hint from stroke type and sampled geometry. */
export function inferDirectionHint(type: StrokeType, pts: Point[]): DirectionHint {
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  switch (type) {
    case 'shirorekha':
      return 'left-to-right';
    case 'stem':
      return 'top-to-bottom';
    case 'loop':
      // Summed turning angle, not shoelace area: an open loop (a stem that curls at its foot,
      // like ग) can enclose a "negative" area while still being drawn clockwise. In y-down
      // screen space a positive total turn is a clockwise visual winding.
      return turningAngle(pts) > 0 ? 'clockwise-loop' : 'counter-clockwise-loop';
    case 'diagonal':
      return last.x >= first.x ? 'diagonal-down-right' : 'diagonal-down-left';
    case 'curve':
      return 'down-and-right-curve';
  }
}

/** Number of waypoints for a stroke of the given length at the target spacing (min 3). */
export function waypointCountFor(length: number, spacing: number): number {
  return Math.max(3, Math.ceil(length / spacing) + 1);
}

/**
 * Sample waypoints for a stroke. Single-subpath strokes are sampled at equal
 * arc length. A split Shirorekha (one subpath per headline segment) is sampled
 * per subpath so every segment starts and ends on a waypoint and no waypoint
 * falls inside a gap.
 */
export function sampleStroke(segments: Segment[], count: number): Point[] {
  const subpaths = splitSubpaths(segments);
  if (subpaths.length === 1) return sampleEquidistant(segments, count);
  const lengths = subpaths.map(pathLength);
  const total = lengths.reduce((a, b) => a + b, 0);
  return subpaths.flatMap((sp, i) => {
    const n = Math.max(2, Math.round((count * lengths[i]!) / total));
    return sampleEquidistant(sp, n);
  });
}

export interface CompiledStroke {
  id: string;
  order: number;
  type: StrokeType;
  label: string;
  nepaliInstruction: string;
  englishInstruction: string;
  svgPath: string;
  directionHint: DirectionHint;
  toleranceRadius: number;
  waypoints: Array<{ index: number; x: number; y: number; label: string }>;
}

const START_LABELS: Record<StrokeType, string> = {
  loop: 'Loop Start',
  curve: 'Curve Start',
  diagonal: 'Diagonal Start',
  stem: 'Stem Top',
  shirorekha: 'Shirorekha Start',
};
const END_LABELS: Record<StrokeType, string> = {
  loop: 'Loop Closure',
  curve: 'Curve Tip',
  diagonal: 'Diagonal End',
  stem: 'Stem Foot',
  shirorekha: 'Shirorekha End',
};

function band(value: number, min: number, max: number, names: [string, string, string]): string {
  const span = max - min;
  if (span < 1) return names[1];
  const r = (value - min) / span;
  return r < 0.4 ? names[0] : r > 0.6 ? names[2] : names[1];
}

/**
 * Generate descriptive waypoint labels from stroke type and geometry, e.g.
 * "Stem Top" / "Upper Spine" / "Stem Foot", "Upper Left Arc", or
 * "Left Headline End (Gap)" for split Shirorekha boundaries.
 */
export function describeWaypoints(
  type: StrokeType,
  pts: Point[],
  subpathEnds: number[] = []
): string[] {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const last = pts.length - 1;
  const labels = pts.map((p, i) => {
    if (i === 0) return START_LABELS[type];
    if (i === last) return END_LABELS[type];
    if (type === 'stem') return `${band(p.y, minY, maxY, ['Upper', 'Middle', 'Lower'])} Spine`;
    if (type === 'shirorekha')
      return `${band(p.x, minX, maxX, ['Left', 'Center', 'Right'])} Headline`;
    const v = band(p.y, minY, maxY, ['Upper', 'Middle', 'Lower']);
    const h = band(p.x, minX, maxX, ['Left', 'Center', 'Right']);
    return v === 'Middle' && h === 'Center'
      ? 'Center Point'
      : `${v} ${h} Arc`.replace('Middle ', '').replace(' Center', '');
  });
  // Split Shirorekha: label each waypoint by its headline segment and mark the gaps.
  if (type === 'shirorekha' && subpathEnds.length > 0) {
    let seg = 0;
    for (let i = 0; i <= last; i++) {
      const isSegStart = i === 0 || subpathEnds.includes(i - 1);
      const isSegEnd = i === last || subpathEnds.includes(i);
      if (i === 0) labels[i] = START_LABELS.shirorekha;
      else if (i === last) labels[i] = END_LABELS.shirorekha;
      else if (isSegStart) labels[i] = `Segment ${seg + 1} Start (After Gap)`;
      else if (isSegEnd) labels[i] = `Segment ${seg + 1} End (Gap)`;
      else labels[i] = `Segment ${seg + 1} Headline`;
      if (isSegEnd) seg++;
    }
  }
  // Disambiguate repeated labels with a running number.
  const seen = new Map<string, number>();
  const totals = labels.reduce((m, l) => m.set(l, (m.get(l) ?? 0) + 1), new Map<string, number>());
  return labels.map((l) => {
    if ((totals.get(l) ?? 0) < 2) return l;
    const n = (seen.get(l) ?? 0) + 1;
    seen.set(l, n);
    return `${l} ${n}`;
  });
}

/**
 * Compile an authoring spec into a `letter.schema.json`-shaped object:
 * samples equidistant waypoints for every stroke, infers direction hints,
 * and derives viewBox / shirorekha metadata from the geometry when absent.
 */
export function compileGlyph(
  spec: GlyphSpec,
  options: CompileOptions = {}
): Record<string, unknown> {
  const spacing = options.spacing ?? 45;
  const isNumeral = spec.category === 'numeral';
  // Letters end with their Shirorekha (so ≥ 2 strokes); headline-free numerals may be one stroke.
  const minStrokes = isNumeral ? 1 : 2;
  if (spec.strokes.length < minStrokes) {
    throw new Error(`Glyph '${spec.id}' needs at least ${minStrokes} strokes.`);
  }
  if (isNumeral && spec.strokes.some((s) => s.type === 'shirorekha')) {
    throw new Error(`Glyph '${spec.id}': numerals are written without a shirorekha stroke.`);
  }

  const lastIdx = spec.strokes.length - 1;
  spec.strokes.forEach((s, i) => {
    if (s.type === 'shirorekha' && i !== lastIdx) {
      throw new Error(
        `Glyph '${spec.id}': shirorekha stroke must be last (found at position ${i + 1}).`
      );
    }
  });

  let maxY = -Infinity;
  const strokes: CompiledStroke[] = spec.strokes.map((s, i) => {
    const segments = parseSvgPath(s.svgPath);
    const subpathCount = splitSubpaths(segments).length;
    if (subpathCount > 1 && s.type !== 'shirorekha') {
      throw new Error(
        `Stroke ${i + 1} of '${spec.id}': only a split Shirorekha may contain multiple subpaths (found ${subpathCount}).`
      );
    }
    const count = s.waypointCount ?? waypointCountFor(pathLength(segments), spacing);
    if (count < 3) throw new Error(`Stroke ${i + 1} of '${spec.id}': waypointCount must be >= 3.`);
    const pts = sampleStroke(segments, count);
    if (s.waypointLabels && s.waypointLabels.length !== pts.length) {
      throw new Error(
        `Stroke ${i + 1} of '${spec.id}': waypointLabels has ${s.waypointLabels.length} entries but ${pts.length} waypoints were sampled.`
      );
    }
    const subpathEnds: number[] = [];
    if (subpathCount > 1) {
      // Recover subpath boundaries: consecutive points that straddle a gap are far apart horizontally.
      for (let k = 0; k < pts.length - 1; k++) {
        const inGap = splitSubpaths(segments).some((sp, j, all) => {
          const next = all[j + 1];
          if (!next) return false;
          const endX = pathBoundingBox(sp).maxX;
          const startX = pathBoundingBox(next).minX;
          return Math.abs(pts[k]!.x - endX) < 0.5 && Math.abs(pts[k + 1]!.x - startX) < 0.5;
        });
        if (inGap) subpathEnds.push(k);
      }
    }
    const labels = s.waypointLabels ?? describeWaypoints(s.type, pts, subpathEnds);
    maxY = Math.max(maxY, pathBoundingBox(segments).maxY);
    const order = i + 1;
    return {
      id: `${spec.id}-stroke-${order}`,
      order,
      type: s.type,
      label: s.label ?? `Stroke ${order}`,
      nepaliInstruction: s.nepaliInstruction ?? '',
      englishInstruction: s.englishInstruction ?? '',
      svgPath: s.svgPath,
      directionHint: s.directionHint ?? inferDirectionHint(s.type, sampleEquidistant(segments, 64)),
      toleranceRadius:
        s.toleranceRadius ??
        options.toleranceRadius ??
        (s.type === 'stem' || s.type === 'shirorekha' ? 26 : 28),
      waypoints: pts.map((p, idx) => ({
        index: idx,
        x: round(p.x),
        y: round(p.y),
        label: labels[idx]!,
      })),
    };
  });

  const out: Record<string, unknown> = { ...spec, strokes };

  const bar =
    spec.strokes[lastIdx]!.type === 'shirorekha'
      ? parseSvgPath(spec.strokes[lastIdx]!.svgPath)
      : null;
  if (!spec.shirorekha && bar) {
    const box = pathBoundingBox(bar);
    const shirorekha: Record<string, unknown> = {
      enforcedLast: true,
      startX: round(box.minX),
      endX: round(box.maxX),
      y: round(box.minY),
    };
    const pieces = splitSubpaths(bar);
    if (pieces.length > 1) {
      shirorekha.segments = pieces.map((p) => {
        const b = pathBoundingBox(p);
        return { startX: round(b.minX), endX: round(b.maxX) };
      });
    }
    out.shirorekha = shirorekha;
  }
  if (!spec.viewBox && bar) {
    const box = pathBoundingBox(bar);
    const baseline = options.baselineY ?? Math.min(270, Math.max(200, Math.round(maxY)));
    out.viewBox = { width: 300, height: 300, shirorekhaY: round(box.minY), baselineY: baseline };
  }
  return out;
}
