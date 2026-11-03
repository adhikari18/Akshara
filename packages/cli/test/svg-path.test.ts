import { describe, expect, it } from 'vitest';
import { parseSvgPath } from '../src/svg-path.js';

describe('parseSvgPath', () => {
  it('parses absolute M/L/C commands from the ka loop stroke', () => {
    const segs = parseSvgPath('M 150 125 C 105 105, 72 125, 75 155 C 78 185, 112 195, 150 165');
    expect(segs).toHaveLength(3);
    expect(segs[0]).toEqual({ type: 'M', to: { x: 150, y: 125 } });
    expect(segs[2]).toMatchObject({ type: 'C', to: { x: 150, y: 165 } });
  });

  it('resolves relative commands and H/V shortcuts', () => {
    const segs = parseSvgPath('m 10 10 h 20 v 30 l -5 5 z');
    expect(segs.map((s) => s.type)).toEqual(['M', 'L', 'L', 'L', 'Z']);
    expect(segs[2]).toMatchObject({ to: { x: 30, y: 40 } });
    expect(segs[4]).toMatchObject({ to: { x: 10, y: 10 } });
  });

  it('treats extra pairs after M as implicit line-tos', () => {
    const segs = parseSvgPath('M 0 0 10 0 10 10');
    expect(segs.map((s) => s.type)).toEqual(['M', 'L', 'L']);
  });

  it('reflects control points for S and elevates Q/T to cubics', () => {
    const s = parseSvgPath('M 0 0 C 0 10, 10 10, 10 0 S 20 -10, 20 0');
    expect(s[2]).toMatchObject({ type: 'C', c1: { x: 10, y: -10 } });
    const q = parseSvgPath('M 0 0 Q 30 30 60 0');
    expect(q[1]).toMatchObject({ type: 'C', c1: { x: 20, y: 20 }, c2: { x: 40, y: 20 } });
  });

  it('handles compact numbers like 1.5-2 and exponents', () => {
    const segs = parseSvgPath('M1.5-2L3e1,4');
    expect(segs[0]).toMatchObject({ to: { x: 1.5, y: -2 } });
    expect(segs[1]).toMatchObject({ to: { x: 30, y: 4 } });
  });

  it('rejects arcs and malformed input', () => {
    expect(() => parseSvgPath('M 0 0 A 5 5 0 0 1 10 10')).toThrow(/arc/i);
    expect(() => parseSvgPath('M 0 0 L 10')).toThrow();
    expect(() => parseSvgPath('10 10')).toThrow();
  });
});
