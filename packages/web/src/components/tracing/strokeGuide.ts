import { toDevanagariNumerals, type LetterStrokeDataset } from '@akshara/data';
import { buildStrokeReferencePath, type Point2D } from '@akshara/core';

/**
 * Colour identity of each stroke in the Stroke Order Guide (slate overlay + sidebar). The
 * Shirorekha is always amber (it is the "draw last" headline); body strokes cycle the rest.
 */
export const STROKE_GUIDE_COLORS = [
  { name: 'sky', hex: '#38bdf8', badge: 'bg-sky-400 text-sky-950' },
  { name: 'emerald', hex: '#34d399', badge: 'bg-emerald-400 text-emerald-950' },
  { name: 'pink', hex: '#f472b6', badge: 'bg-pink-400 text-pink-950' },
  { name: 'violet', hex: '#a78bfa', badge: 'bg-violet-400 text-violet-950' },
  { name: 'orange', hex: '#fb923c', badge: 'bg-orange-400 text-orange-950' },
  { name: 'teal', hex: '#2dd4bf', badge: 'bg-teal-400 text-teal-950' },
] as const;

export const SHIROREKHA_GUIDE_COLOR = {
  name: 'amber',
  hex: '#fbbf24',
  badge: 'bg-amber-400 text-amber-950',
} as const;

export type StrokeGuideColor = (typeof STROKE_GUIDE_COLORS)[number] | typeof SHIROREKHA_GUIDE_COLOR;

/** Colour for stroke `index` of a letter. */
export function strokeGuideColor(dataset: LetterStrokeDataset, index: number): StrokeGuideColor {
  const stroke = dataset.strokes[index];
  if (stroke?.type === 'shirorekha') return SHIROREKHA_GUIDE_COLOR;
  return STROKE_GUIDE_COLORS[index % STROKE_GUIDE_COLORS.length]!;
}

/** Arc-length spacing (logical px) between directional arrows along a stroke. */
export const ARROW_SPACING = 34;
/** No arrow closer than this to either end of a stroke (the start badge / end are clear enough). */
const ARROW_END_MARGIN = 16;

export interface GuideArrow {
  x: number;
  y: number;
  /** Direction of travel at this point, radians (atan2 in y-down screen space). */
  angle: number;
}

export interface StrokeGuideEntry {
  index: number;
  /** 1-based order, as Devanagari numeral (१, २, …) for the badge. */
  badge: string;
  color: StrokeGuideColor;
  /** Where the stroke starts (badge position). */
  start: Point2D;
  /** Direction arrows along the authored curve, evenly spaced by arc length. */
  arrows: GuideArrow[];
  /** Dense points along the curve, per subpath (pen lifts never bridged). */
  polylines: Point2D[][];
}

const cache = new WeakMap<LetterStrokeDataset, StrokeGuideEntry[]>();

/** Full-letter stroke order guide: colours, start badges and tangent arrows for every stroke. */
export function buildStrokeGuide(dataset: LetterStrokeDataset): StrokeGuideEntry[] {
  const cached = cache.get(dataset);
  if (cached) return cached;

  const entries = dataset.strokes.map((stroke, index): StrokeGuideEntry => {
    const ref = buildStrokeReferencePath(stroke);
    const polylines: Point2D[][] = [];
    ref.samples.forEach((p, i) => {
      const sub = ref.subpathOf[i] ?? 0;
      (polylines[sub] ??= []).push(p);
    });

    const arrows: GuideArrow[] = [];
    for (const line of polylines) {
      let travelled = 0;
      let nextArrowAt = ARROW_SPACING;
      let total = 0;
      for (let i = 1; i < line.length; i++) {
        total += Math.hypot(line[i]!.x - line[i - 1]!.x, line[i]!.y - line[i - 1]!.y);
      }
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1]!;
        const b = line[i]!;
        travelled += Math.hypot(b.x - a.x, b.y - a.y);
        if (travelled >= nextArrowAt) {
          if (travelled > ARROW_END_MARGIN && travelled < total - ARROW_END_MARGIN) {
            // Tangent from a few samples either side, so arrows don't jitter on tight curves
            const p0 = line[Math.max(0, i - 3)]!;
            const p1 = line[Math.min(line.length - 1, i + 3)]!;
            arrows.push({ x: b.x, y: b.y, angle: Math.atan2(p1.y - p0.y, p1.x - p0.x) });
          }
          nextArrowAt += ARROW_SPACING;
        }
      }
    }

    const first = stroke.waypoints[0]!;
    return {
      index,
      badge: toDevanagariNumerals(stroke.order),
      color: strokeGuideColor(dataset, index),
      start: { x: first.x, y: first.y },
      arrows,
      polylines: polylines.filter((l) => l.length > 0),
    };
  });

  cache.set(dataset, entries);
  return entries;
}
