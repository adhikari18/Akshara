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
}

/** Authoring input for one glyph. Extra letter metadata is passed through untouched. */
export interface GlyphSpec {
  id: string;
  character: string;
  unicode: string;
  category: 'swor' | 'vyanjan' | 'samyukta';
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

/** Signed shoelace area of a polyline closed back to its start (screen coordinates, y down). */
function signedArea(pts: Point[]): number {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
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
      // In y-down screen space a negative shoelace area is a counter-clockwise visual winding.
      return signedArea(pts) <= 0 ? 'counter-clockwise-loop' : 'clockwise-loop';
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

function waypointLabel(i: number, n: number): string {
  if (i === 0) return 'Stroke Start';
  if (i === n - 1) return 'Stroke End';
  return `Waypoint ${i}`;
}

/**
 * Compile an authoring spec into a `letter.schema.json`-shaped object:
 * samples equidistant waypoints for every stroke, infers direction hints,
 * and derives viewBox / shirorekha metadata from the geometry when absent.
 */
export function compileGlyph(spec: GlyphSpec, options: CompileOptions = {}): Record<string, unknown> {
  const spacing = options.spacing ?? 45;
  if (spec.strokes.length < 2) throw new Error(`Glyph '${spec.id}' needs at least 2 strokes.`);

  const lastIdx = spec.strokes.length - 1;
  spec.strokes.forEach((s, i) => {
    if (s.type === 'shirorekha' && i !== lastIdx) {
      throw new Error(`Glyph '${spec.id}': shirorekha stroke must be last (found at position ${i + 1}).`);
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
      directionHint: s.directionHint ?? inferDirectionHint(s.type, pts),
      toleranceRadius: s.toleranceRadius ?? options.toleranceRadius ?? (s.type === 'stem' || s.type === 'shirorekha' ? 26 : 28),
      waypoints: pts.map((p, idx) => ({ index: idx, x: round(p.x), y: round(p.y), label: waypointLabel(idx, pts.length) })),
    };
  });

  const out: Record<string, unknown> = { ...spec, strokes };

  const bar = spec.strokes[lastIdx]!.type === 'shirorekha' ? parseSvgPath(spec.strokes[lastIdx]!.svgPath) : null;
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
