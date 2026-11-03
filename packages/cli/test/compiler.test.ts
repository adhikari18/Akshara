import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileGlyph, describeWaypoints, inferDirectionHint, waypointCountFor, type GlyphSpec } from '../src/compiler.js';

const kaPath = fileURLToPath(new URL('../../data/strokes/ka.json', import.meta.url));
const ka = JSON.parse(readFileSync(kaPath, 'utf8'));

/** Strip hand-authored waypoints / hints so the compiler must regenerate them. */
function kaSpec(): GlyphSpec {
  return {
    id: ka.id,
    character: ka.character,
    unicode: ka.unicode,
    category: ka.category,
    phonetics: ka.phonetics,
    vocabulary: ka.vocabulary,
    strokes: ka.strokes.map((s: any) => ({ type: s.type, svgPath: s.svgPath, label: s.label })),
  };
}

describe('compileGlyph against hand-authored ka.json', () => {
  const out = compileGlyph(kaSpec()) as any;

  it('preserves stroke order, ids, types and svg paths', () => {
    expect(out.strokes.map((s: any) => s.id)).toEqual(ka.strokes.map((s: any) => s.id));
    expect(out.strokes.map((s: any) => s.svgPath)).toEqual(ka.strokes.map((s: any) => s.svgPath));
  });

  it('infers the same direction hints as the hand-authored data', () => {
    expect(out.strokes.map((s: any) => s.directionHint)).toEqual(ka.strokes.map((s: any) => s.directionHint));
  });

  it('derives viewBox and shirorekha metadata matching ka.json', () => {
    expect(out.shirorekha).toEqual(ka.shirorekha);
    expect(out.viewBox.shirorekhaY).toBe(ka.viewBox.shirorekhaY);
    expect(out.viewBox.baselineY).toBe(ka.viewBox.baselineY);
  });

  it('starts and ends every stroke on the authored endpoints', () => {
    out.strokes.forEach((s: any, i: number) => {
      const a = ka.strokes[i].waypoints;
      expect(s.waypoints[0].x).toBeCloseTo(a[0].x, 0);
      expect(s.waypoints[0].y).toBeCloseTo(a[0].y, 0);
      expect(s.waypoints.at(-1).x).toBeCloseTo(a.at(-1).x, 0);
      expect(s.waypoints.at(-1).y).toBeCloseTo(a.at(-1).y, 0);
    });
  });

  it('generates waypoints that stay within the authored tolerance of the hand-placed ones', () => {
    // Every authored waypoint must lie close to the compiled polyline.
    out.strokes.forEach((s: any, i: number) => {
      for (const w of ka.strokes[i].waypoints) {
        const nearest = Math.min(...s.waypoints.map((p: any) => Math.hypot(p.x - w.x, p.y - w.y)));
        expect(nearest).toBeLessThan(ka.strokes[i].toleranceRadius);
      }
    });
  });

  it('emits at least 3 waypoints per stroke with sequential indices', () => {
    for (const s of out.strokes) {
      expect(s.waypoints.length).toBeGreaterThanOrEqual(3);
      expect(s.waypoints.map((w: any) => w.index)).toEqual(s.waypoints.map((_: any, k: number) => k));
    }
  });
});

describe('compiler guards', () => {
  it('rejects a shirorekha that is not the final stroke', () => {
    const spec = kaSpec();
    spec.strokes.reverse();
    expect(() => compileGlyph(spec)).toThrow(/shirorekha stroke must be last/);
  });

  it('infers winding direction from loop geometry', () => {
    const ccw = [{ x: 150, y: 125 }, { x: 102, y: 118 }, { x: 75, y: 155 }, { x: 108, y: 186 }, { x: 150, y: 165 }];
    expect(inferDirectionHint('loop', ccw)).toBe('counter-clockwise-loop');
    expect(inferDirectionHint('loop', [...ccw].reverse())).toBe('clockwise-loop');
  });

  it('scales waypoint count with stroke length but never below 3', () => {
    expect(waypointCountFor(10, 45)).toBe(3);
    expect(waypointCountFor(165, 45)).toBe(5);
  });
});

describe('split Shirorekha compilation', () => {
  // ध-style headline: a short bar over the upper-left loop, a gap, then the bar over the stem.
  const segments = [{ startX: 62, endX: 127 }, { startX: 165, endX: 237 }];
  const spec: GlyphSpec = {
    id: 'dha',
    character: 'ध',
    unicode: 'U+0927',
    category: 'vyanjan',
    strokes: [
      { type: 'curve', svgPath: 'M 122 78 C 98 85, 92 108, 102 122 C 110 133, 130 138, 150 140' },
      { type: 'stem', svgPath: 'M 195 75 L 195 240' },
      { type: 'shirorekha', svgPath: 'M 62 75 L 127 75 M 165 75 L 237 75' },
    ],
  };
  const out = compileGlyph(spec) as any;

  it('derives headline segments from a multi-subpath Shirorekha', () => {
    expect(out.shirorekha).toEqual({ enforcedLast: true, startX: 62, endX: 237, y: 75, segments });
  });

  it('places waypoints on both ends of each segment and none in the gap', () => {
    const xs = out.strokes.at(-1).waypoints.map((w: any) => w.x);
    for (const seg of segments) {
      expect(xs).toContain(seg.startX);
      expect(xs).toContain(seg.endX);
    }
    expect(xs.some((x: number) => x > 127 && x < 165)).toBe(false);
  });

  it('rejects multiple subpaths in non-headline strokes', () => {
    const bad: GlyphSpec = { ...spec, strokes: [{ type: 'stem', svgPath: 'M 0 0 L 0 10 M 5 0 L 5 10' }, spec.strokes.at(-1)!] };
    expect(() => compileGlyph(bad)).toThrow(/only a split Shirorekha/);
  });
});

describe('describeWaypoints', () => {
  it('labels stems, headlines and arcs descriptively', () => {
    const stem = describeWaypoints('stem', [0, 55, 110, 165].map((y) => ({ x: 150, y: 75 + y })));
    expect(stem).toEqual(['Stem Top', 'Upper Spine', 'Lower Spine', 'Stem Foot']);
    const bar = describeWaypoints('shirorekha', [55, 120, 180, 245].map((x) => ({ x, y: 75 })));
    expect(bar).toEqual(['Shirorekha Start', 'Left Headline', 'Right Headline', 'Shirorekha End']);
  });

  it('numbers duplicate labels and marks split-headline gaps', () => {
    const out = compileGlyph({
      id: 'ga', character: 'ग', unicode: 'U+0917', category: 'vyanjan',
      strokes: [
        { type: 'stem', svgPath: 'M 195 75 L 195 240' },
        { type: 'shirorekha', svgPath: 'M 60 75 L 140 75 M 170 75 L 240 75' },
      ],
    }) as any;
    const labels: string[] = out.strokes[1].waypoints.map((w: any) => w.label);
    expect(labels.some((l) => l.endsWith('End (Gap)'))).toBe(true);
    expect(labels.some((l) => l.endsWith('Start (After Gap)'))).toBe(true);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('honours explicit waypointLabels and validates their count', () => {
    const base = { id: 'x', character: 'x', unicode: 'U+0915', category: 'vyanjan' as const };
    const ok = compileGlyph({ ...base, strokes: [
      { type: 'stem', svgPath: 'M 150 75 L 150 165', waypointCount: 3, waypointLabels: ['A', 'B', 'C'] },
      { type: 'shirorekha', svgPath: 'M 55 75 L 245 75' },
    ] }) as any;
    expect(ok.strokes[0].waypoints.map((w: any) => w.label)).toEqual(['A', 'B', 'C']);
    expect(() => compileGlyph({ ...base, strokes: [
      { type: 'stem', svgPath: 'M 150 75 L 150 165', waypointCount: 3, waypointLabels: ['A'] },
      { type: 'shirorekha', svgPath: 'M 55 75 L 245 75' },
    ] })).toThrow(/waypointLabels has 1 entries/);
  });
});

describe('direction inference for small loops', () => {
  it('uses dense geometry, not the sparse waypoints, to detect winding', () => {
    const base = { id: 'dot', character: 'ङ', unicode: 'U+0919', category: 'vyanjan' as const };
    const dot = (d: string) =>
      (compileGlyph({ ...base, strokes: [{ type: 'loop', svgPath: d }, { type: 'shirorekha', svgPath: 'M 60 75 L 240 75' }] }) as any)
        .strokes[0].directionHint;
    // Top -> right -> bottom -> left is clockwise on screen; only 3 waypoints are sampled.
    expect(dot('M 210 138 C 224 138, 224 158, 210 158 C 196 158, 196 138, 210 138')).toBe('clockwise-loop');
    expect(dot('M 210 138 C 196 138, 196 158, 210 158 C 224 158, 224 138, 210 138')).toBe('counter-clockwise-loop');
  });
});
