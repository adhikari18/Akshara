import { sampleStrokeSubpaths, type Point2D } from '@akshara/core';
import type { LetterStrokeDataset } from '@akshara/data';

/** Chalk speed at 1× (logical px per second), matching the Pati slate's "Show me". */
export const DEMO_GALLERY_BASE_SPEED = 140;
/** Pen-lift pause between strokes / subpaths, in logical px of "travel" (so it scales with speed). */
export const DEMO_GALLERY_LIFT = 50;
/** Pause on the finished letter before the demo loops, in logical px of "travel". */
export const DEMO_GALLERY_HOLD = 160;

export type GallerySpeed = 0.5 | 1 | 1.5 | 2 | 3;
export const GALLERY_SPEEDS: GallerySpeed[] = [0.5, 1, 1.5, 2, 3];

interface Track {
  strokeIndex: number;
  points: Point2D[];
  cumulative: number[];
  length: number;
  /** Timeline position (in px of travel) where this subpath starts. */
  start: number;
}

/** A letter's whole demo laid out on one distance axis: subpaths separated by lifts. */
export interface DemoTimeline {
  tracks: Track[];
  /** Total timeline length including the hold at the end (one loop). */
  total: number;
  strokeCount: number;
}

export function buildDemoTimeline(dataset: LetterStrokeDataset, spacing = 2): DemoTimeline {
  const tracks: Track[] = [];
  let cursor = 0;
  dataset.strokes.forEach((stroke, strokeIndex) => {
    for (const points of sampleStrokeSubpaths(stroke, spacing)) {
      const cumulative = [0];
      for (let i = 1; i < points.length; i++) {
        cumulative.push(
          cumulative[i - 1]! +
            Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y)
        );
      }
      const length = cumulative[cumulative.length - 1] ?? 0;
      tracks.push({ strokeIndex, points, cumulative, length, start: cursor });
      cursor += length + DEMO_GALLERY_LIFT;
    }
  });
  return { tracks, total: cursor + DEMO_GALLERY_HOLD, strokeCount: dataset.strokes.length };
}

/** What to paint at a timeline position. */
export interface DemoGalleryFrame {
  /** Stroke the chalk is on (or the last one, during the final hold). */
  strokeIndex: number;
  /** Drawn polylines so far (one per subpath, including the partial current one). */
  drawn: Array<{ strokeIndex: number; points: Point2D[] }>;
  /** Chalk tip, or null while lifted. */
  pen: Point2D | null;
  /** True once every stroke has been drawn (the hold before looping). */
  finished: boolean;
}

export function demoFrameAt(timeline: DemoTimeline, position: number): DemoGalleryFrame {
  const t = Math.max(0, position);
  const drawn: DemoGalleryFrame['drawn'] = [];
  let pen: Point2D | null = null;
  let strokeIndex = 0;
  for (const track of timeline.tracks) {
    if (t < track.start) break;
    strokeIndex = track.strokeIndex;
    const along = t - track.start;
    if (along >= track.length) {
      drawn.push({ strokeIndex: track.strokeIndex, points: track.points });
      continue;
    }
    // Partial subpath: points up to `along`, plus the interpolated tip
    let i = 1;
    while (i < track.cumulative.length && track.cumulative[i]! < along) i++;
    const a = track.points[i - 1]!;
    const b = track.points[Math.min(i, track.points.length - 1)]!;
    const segStart = track.cumulative[i - 1]!;
    const segLen = (track.cumulative[i] ?? segStart) - segStart;
    const f = segLen > 0 ? (along - segStart) / segLen : 0;
    const tip = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    drawn.push({ strokeIndex: track.strokeIndex, points: [...track.points.slice(0, i), tip] });
    pen = tip;
  }
  const last = timeline.tracks[timeline.tracks.length - 1];
  const finished = !!last && t >= last.start + last.length;
  return { strokeIndex, drawn, pen, finished };
}
