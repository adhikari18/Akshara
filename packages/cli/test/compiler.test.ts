import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileGlyph, inferDirectionHint, waypointCountFor, type GlyphSpec } from '../src/compiler.js';

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
