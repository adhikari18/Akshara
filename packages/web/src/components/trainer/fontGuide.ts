import type { Point2D } from '@akshara/core';
import type { LetterStrokeDataset } from '@akshara/data';
import type { DevanagariFont } from '@/lib/devanagariFonts';
import { glyphText } from '@/lib/devanagariFonts';
import type { GlyphGuide, GuideTrack } from './traceFit';

/** Logical slate size (matches the stroke data's 300 × 300 viewBox). */
const SIZE = 300;

/** Where a font glyph is drawn on the slate so it lines up with the letter's current strokes. */
export interface GlyphPlacement {
  text: string;
  family: string;
  fontSize: number;
  /** Baseline origin of the text, in logical units. */
  x: number;
  y: number;
}

/** Bounding box of the letter's current strokes (its waypoints), padded. */
function strokeBox(dataset: LetterStrokeDataset) {
  const xs = dataset.strokes.flatMap((s) => s.waypoints.map((w) => w.x));
  const ys = dataset.strokes.flatMap((s) => s.waypoints.map((w) => w.y));
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/**
 * Fit the font's glyph into the box of the letter's current strokes (keeping its proportions),
 * so the reference shape sits where the dots, guides and tracing data expect it.
 */
export function placeGlyph(
  ctx: CanvasRenderingContext2D,
  font: DevanagariFont,
  dataset: LetterStrokeDataset
): GlyphPlacement | null {
  const text = glyphText(font, dataset.id, dataset.character);
  if (!text) return null;
  const family = font.source === 'system' ? 'sans-serif' : `"${font.family}"`;
  const probe = 200;
  ctx.font = `${probe}px ${family}`;
  const m = ctx.measureText(text);
  const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  if (!(w > 0 && h > 0)) return null;
  const box = strokeBox(dataset);
  const boxW = Math.max(60, box.maxX - box.minX + 24);
  const boxH = Math.max(60, box.maxY - box.minY + 24);
  const scale = Math.min(boxW / w, boxH / h, (SIZE * 0.92) / w, (SIZE * 0.92) / h);
  const fontSize = probe * scale;
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  // Centre the glyph's ink box on the strokes' box
  const x = cx - ((m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2) * scale;
  const y = cy + ((m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2) * scale;
  return { text, family, fontSize, x, y };
}

/** Paint the placed glyph (faint reference) onto a 300-unit slate context. */
export function paintGlyph(
  ctx: CanvasRenderingContext2D,
  placement: GlyphPlacement,
  fill: string
): void {
  ctx.save();
  ctx.font = `${placement.fontSize}px ${placement.family}`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = fill;
  ctx.fillText(placement.text, placement.x, placement.y);
  ctx.restore();
}

/** Rasterise the glyph into a 300 × 300 ink mask (1 = ink). Null where canvases are unavailable. */
export function glyphMask(placement: GlyphPlacement): Uint8Array | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  paintGlyph(ctx, placement, '#000');
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
  const mask = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3]! > 110 ? 1 : 0;
  return mask;
}

/** Zhang–Suen thinning: reduce the ink to a one-pixel-wide centreline. */
export function skeletonize(mask: Uint8Array, size = SIZE): Uint8Array {
  const img = mask.slice();
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= size || y >= size ? 0 : img[y * size + x]!;
  let changed = true;
  while (changed) {
    changed = false;
    for (const pass of [0, 1]) {
      const remove: number[] = [];
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (!img[y * size + x]) continue;
          const p = [
            at(x, y - 1),
            at(x + 1, y - 1),
            at(x + 1, y),
            at(x + 1, y + 1),
            at(x, y + 1),
            at(x - 1, y + 1),
            at(x - 1, y),
            at(x - 1, y - 1),
          ];
          const b = p.reduce((a, v) => a + v, 0);
          if (b < 2 || b > 6) continue;
          let a = 0;
          for (let k = 0; k < 8; k++) if (p[k] === 0 && p[(k + 1) % 8] === 1) a++;
          if (a !== 1) continue;
          if (pass === 0) {
            if (p[0]! * p[2]! * p[4]! !== 0 || p[2]! * p[4]! * p[6]! !== 0) continue;
          } else if (p[0]! * p[2]! * p[6]! !== 0 || p[0]! * p[4]! * p[6]! !== 0) continue;
          remove.push(y * size + x);
        }
      }
      for (const i of remove) img[i] = 0;
      if (remove.length) changed = true;
    }
  }
  return img;
}

const NEIGHBOURS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;

/**
 * Split a skeleton into chains between its end / junction pixels, each a smoothed polyline — the
 * same "track" shape the stroke-data guide uses, so snapping and routing work unchanged.
 */
export function skeletonTracks(skel: Uint8Array, size = SIZE, minLength = 6): GuideTrack[] {
  const on = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < size && y < size && skel[y * size + x] === 1;
  const neighbours = (i: number) => {
    const x = i % size;
    const y = Math.floor(i / size);
    const out: number[] = [];
    for (const [dx, dy] of NEIGHBOURS) if (on(x + dx, y + dy)) out.push((y + dy) * size + x + dx);
    return out;
  };
  const isNode = (i: number) => neighbours(i).length !== 2;
  const visitedEdge = new Set<string>();
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const chains: number[][] = [];
  const walk = (start: number, next: number) => {
    const chain = [start, next];
    visitedEdge.add(key(start, next));
    let prev = start;
    let cur = next;
    while (!isNode(cur)) {
      const step = neighbours(cur).find((n) => n !== prev && !visitedEdge.has(key(cur, n)));
      if (step === undefined) break;
      visitedEdge.add(key(cur, step));
      chain.push(step);
      prev = cur;
      cur = step;
      if (cur === start) break; // closed loop
    }
    chains.push(chain);
  };
  const pixels: number[] = [];
  for (let i = 0; i < skel.length; i++) if (skel[i]) pixels.push(i);
  for (const i of pixels) {
    if (!isNode(i)) continue;
    for (const n of neighbours(i)) if (!visitedEdge.has(key(i, n))) walk(i, n);
  }
  // Pure loops (no end or junction pixel at all), e.g. a "०"
  for (const i of pixels) {
    const ns = neighbours(i);
    if (ns.length === 2 && !visitedEdge.has(key(i, ns[0]!))) walk(i, ns[0]!);
  }
  const polylines = mergeChains(
    chains.map((chain) =>
      chain.map((i) => ({ x: (i % size) + 0.5, y: Math.floor(i / size) + 0.5 }))
    )
  );
  return polylines
    .map((pts) => smoothChain(pts))
    .filter((pts) => pts.length >= 2 && polylineLength(pts) >= minLength)
    .map((points) => {
      const cumulative = [0];
      for (let i = 1; i < points.length; i++)
        cumulative.push(
          cumulative[i - 1]! +
            Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y)
        );
      const first = points[0]!;
      const last = points[points.length - 1]!;
      return { points, cumulative, closed: Math.hypot(first.x - last.x, first.y - last.y) < 3 };
    });
}

/**
 * Thinning leaves little pixel clusters that look like junctions but only join two chains (on a
 * staircase, or where a loop was entered). Join such pairs, so a smooth curve is one track and a
 * ring is a single closed track; real junctions (three or more chain ends) stay split.
 */
function mergeChains(input: Point2D[][]): Point2D[][] {
  // Node-to-node pixel links (inside a junction cluster) are glue, not chains of their own
  const chains = input.filter((c) => c.length >= 2 && polylineLength(c) >= 3).map((c) => [...c]);
  const near = (a: Point2D, b: Point2D) => Math.hypot(a.x - b.x, a.y - b.y) <= 3;
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < chains.length; i++) {
      for (const endI of ['start', 'end'] as const) {
        const p = endI === 'start' ? chains[i]![0]! : chains[i]![chains[i]!.length - 1]!;
        // Every chain end touching this point
        const touching: Array<{ chain: number; end: 'start' | 'end' }> = [];
        chains.forEach((c, k) => {
          if (near(c[0]!, p)) touching.push({ chain: k, end: 'start' });
          if (near(c[c.length - 1]!, p)) touching.push({ chain: k, end: 'end' });
        });
        if (touching.length !== 2 || touching[0]!.chain === touching[1]!.chain) continue;
        const [a, b] = touching as [(typeof touching)[0], (typeof touching)[0]];
        const ca = a.end === 'end' ? chains[a.chain]! : [...chains[a.chain]!].reverse();
        const cb = b.end === 'start' ? chains[b.chain]! : [...chains[b.chain]!].reverse();
        const joined = [...ca, ...cb.slice(1)];
        const keep = Math.min(a.chain, b.chain);
        const drop = Math.max(a.chain, b.chain);
        chains[keep] = joined;
        chains.splice(drop, 1);
        merged = true;
        break outer;
      }
    }
  }
  return chains;
}

function polylineLength(pts: Point2D[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++)
    total += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  return total;
}

/** Remove the pixel staircase from a chain (ends stay put, so chains still meet at junctions). */
function smoothChain(pts: Point2D[], radius = 3): Point2D[] {
  if (pts.length < 2 * radius + 1) return pts;
  return pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return p;
    const lo = Math.max(0, i - radius);
    const hi = Math.min(pts.length - 1, i + radius);
    let sx = 0;
    let sy = 0;
    for (let k = lo; k <= hi; k++) {
      sx += pts[k]!.x;
      sy += pts[k]!.y;
    }
    const n = hi - lo + 1;
    return { x: sx / n, y: sy / n };
  });
}

/** The font glyph's centreline as a snapping / routing guide, or null if it cannot be computed. */
export function buildFontGuide(placement: GlyphPlacement): GlyphGuide | null {
  const mask = glyphMask(placement);
  if (!mask || !mask.some((v) => v)) return null;
  const tracks = skeletonTracks(skeletonize(mask));
  return tracks.length ? { tracks } : null;
}
