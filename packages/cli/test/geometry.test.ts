import { describe, expect, it } from 'vitest';
import { parseSvgPath } from '../src/svg-path.js';
import { cubicArcLength, pathBoundingBox, pathLength, sampleEquidistant } from '../src/geometry.js';

describe('arc length', () => {
  it('measures straight lines exactly', () => {
    expect(pathLength(parseSvgPath('M 150 75 L 150 240'))).toBeCloseTo(165, 6);
  });

  it('measures a straight-line cubic as its chord length', () => {
    const len = cubicArcLength({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 });
    expect(len).toBeCloseTo(30, 6);
  });

  it('approximates a quarter circle Bézier to within 0.01%', () => {
    const k = 0.5522847498;
    const len = cubicArcLength({ x: 100, y: 0 }, { x: 100, y: 100 * k }, { x: 100 * k, y: 100 }, { x: 0, y: 100 });
    expect(len).toBeCloseTo((Math.PI * 100) / 2, 1);
  });
});

describe('sampleEquidistant', () => {
  it('includes exact endpoints and equal spacing on a line', () => {
    const pts = sampleEquidistant(parseSvgPath('M 55 75 L 245 75'), 4);
    expect(pts.map((p) => Math.round(p.x))).toEqual([55, 118, 182, 245]);
    expect(pts.every((p) => p.y === 75)).toBe(true);
  });

  it('spaces points evenly along a curved multi-segment path', () => {
    const segs = parseSvgPath('M 150 125 C 105 105, 72 125, 75 155 C 78 185, 112 195, 150 165');
    const pts = sampleEquidistant(segs, 6);
    expect(pts[0]).toEqual({ x: 150, y: 125 });
    expect(pts[5]!.x).toBeCloseTo(150, 3);
    expect(pts[5]!.y).toBeCloseTo(165, 3);
    // Chord distances between neighbours are roughly uniform on a gentle curve.
    const d = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i]!.x, p.y - pts[i]!.y));
    expect(Math.max(...d) / Math.min(...d)).toBeLessThan(1.6);
  });

  it('rejects invalid counts', () => {
    expect(() => sampleEquidistant(parseSvgPath('M 0 0 L 1 1'), 1)).toThrow();
  });
});

describe('pathBoundingBox', () => {
  it('bounds the ka loop within its authored extents', () => {
    const box = pathBoundingBox(parseSvgPath('M 150 125 C 105 105, 72 125, 75 155 C 78 185, 112 195, 150 165'));
    expect(box.maxX).toBeCloseTo(150, 5);
    expect(box.minX).toBeGreaterThan(70);
    expect(box.minX).toBeLessThan(80);
  });
});
