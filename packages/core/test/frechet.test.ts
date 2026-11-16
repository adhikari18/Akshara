import { describe, expect, it } from 'vitest';
import {
  discreteFrechetDistance,
  polylineLength,
  resampleByArcLength,
  type Point2D,
} from '../src/index.js';

const line = (x0: number, y0: number, x1: number, y1: number, n = 2): Point2D[] =>
  Array.from({ length: n }, (_, i) => ({
    x: x0 + ((x1 - x0) * i) / (n - 1),
    y: y0 + ((y1 - y0) * i) / (n - 1),
  }));

describe('resampleByArcLength', () => {
  it('spaces points equally along a polyline, keeping the exact endpoints', () => {
    // Uneven input spacing: a long first segment, then a short one
    const path: Point2D[] = [
      { x: 0, y: 0 },
      { x: 90, y: 0 },
      { x: 100, y: 0 },
    ];
    const out = resampleByArcLength(path, 6);
    expect(out).toHaveLength(6);
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out[5]).toEqual({ x: 100, y: 0 });
    for (let i = 1; i < out.length; i++) {
      expect(Math.hypot(out[i]!.x - out[i - 1]!.x, out[i]!.y - out[i - 1]!.y)).toBeCloseTo(20, 9);
    }
  });

  it('walks round corners rather than cutting them', () => {
    const corner: Point2D[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    const out = resampleByArcLength(corner, 5);
    expect(out[2]).toEqual({ x: 100, y: 0 }); // halfway along the length is the corner itself
    expect(polylineLength(out)).toBeCloseTo(200, 9);
  });

  it('makes a dense and a sparse sampling of the same path identical', () => {
    const dense = line(0, 0, 300, 120, 301);
    const sparse = line(0, 0, 300, 120, 4);
    const a = resampleByArcLength(dense, 32);
    const b = resampleByArcLength(sparse, 32);
    a.forEach((p, i) => {
      expect(p.x).toBeCloseTo(b[i]!.x, 9);
      expect(p.y).toBeCloseTo(b[i]!.y, 9);
    });
  });

  it('handles degenerate input', () => {
    expect(resampleByArcLength([], 4)).toEqual([]);
    expect(resampleByArcLength([{ x: 5, y: 5 }], 3)).toEqual([
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 5 },
    ]);
    expect(() => resampleByArcLength(line(0, 0, 1, 1), 1)).toThrow();
  });
});

describe('discreteFrechetDistance', () => {
  it('is zero for identical curves and symmetric', () => {
    const a = line(0, 0, 100, 50, 10);
    expect(discreteFrechetDistance(a, a)).toBe(0);
    const b = line(0, 10, 100, 60, 7);
    expect(discreteFrechetDistance(a, b)).toBeCloseTo(discreteFrechetDistance(b, a), 12);
  });

  it('equals the offset between two parallel lines', () => {
    expect(discreteFrechetDistance(line(0, 0, 100, 0, 11), line(0, 15, 100, 15, 11))).toBeCloseTo(
      15,
      9
    );
  });

  it('respects direction: a curve traced backwards is far from itself', () => {
    const a = line(0, 0, 100, 0, 11);
    const reversed = [...a].reverse();
    expect(discreteFrechetDistance(a, reversed)).toBe(100);
  });

  it('penalises doubling back where a nearest-point deviation would not', () => {
    const straight = line(0, 0, 100, 0, 11);
    // Goes forward to 60, back to 20, then on to 100: every point lies ON the straight line…
    const zigzag = [...line(0, 0, 60, 0, 7), ...line(50, 0, 20, 0, 4), ...line(30, 0, 100, 0, 8)];
    // …so the worst nearest-point distance is 0, but the leash must stretch across the backtrack.
    const nearest = Math.max(
      ...zigzag.map((p) => Math.min(...straight.map((q) => Math.hypot(p.x - q.x, p.y - q.y))))
    );
    expect(nearest).toBe(0);
    expect(discreteFrechetDistance(straight, zigzag)).toBeCloseTo(20, 9);
  });

  it('treats empty input as unreachable', () => {
    expect(discreteFrechetDistance([], line(0, 0, 1, 0))).toBe(Infinity);
  });
});
