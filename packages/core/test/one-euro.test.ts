import { describe, expect, it } from 'vitest';
import {
  CHALK_BASE_WIDTH,
  ONE_EURO_PROFILES,
  OneEuroFilter,
  OneEuroPointFilter,
  chalkWidthFor,
  lowPassAlpha,
} from '../src/index.js';

const child = ONE_EURO_PROFILES.child;

/** Steady-state lag (px) when following a ramp at `speed` px/s sampled at `hz`. */
function rampLag(speed: number, hz: number, profile = child): number {
  const f = new OneEuroFilter(profile);
  let out = 0;
  const n = 400;
  for (let i = 0; i < n; i++) out = f.filter((speed * i) / hz, 1 / hz);
  return (speed * (n - 1)) / hz - out;
}

describe('1€ filter (Casiez et al.)', () => {
  it('passes the first sample through and holds a constant', () => {
    const f = new OneEuroFilter(child);
    expect(f.filter(42)).toBe(42);
    for (let i = 0; i < 20; i++) expect(f.filter(42)).toBeCloseTo(42, 9);
  });

  it('low-pass alpha approaches 1 as the cutoff rises', () => {
    expect(lowPassAlpha(1, 1 / 60)).toBeLessThan(lowPassAlpha(10, 1 / 60));
    expect(lowPassAlpha(1000, 1 / 60)).toBeGreaterThan(0.99);
  });

  it('removes hand tremor at rest', () => {
    // ±3 px wobble at 15 Hz around a still point, 60 Hz sampling
    const f = new OneEuroFilter(child);
    let amplitude = 0;
    for (let i = 0; i < 300; i++) {
      const out = f.filter(3 * Math.sin((2 * Math.PI * 15 * i) / 60), 1 / 60);
      if (i > 120) amplitude = Math.max(amplitude, Math.abs(out));
    }
    expect(amplitude).toBeLessThan(0.6); // better than 5× attenuation
  });

  it('adapts to speed: lag in time shrinks as the hand moves faster', () => {
    const slowLagMs = (rampLag(50, 60) / 50) * 1000;
    const fastLagMs = (rampLag(800, 60) / 800) * 1000;
    expect(slowLagMs).toBeGreaterThan(fastLagMs * 3);
    // …and even the slow lag is a fraction of a frame's worth of travel in px
    expect(rampLag(50, 60)).toBeLessThan(4);
    expect(rampLag(800, 60)).toBeLessThan(10);
  });

  it('smooths children harder than strict mode, at the same speed', () => {
    expect(rampLag(300, 60, ONE_EURO_PROFILES.child)).toBeGreaterThan(
      rampLag(300, 60, ONE_EURO_PROFILES.strict)
    );
  });

  it('is parameterised by real time, so sample rate barely matters', () => {
    const at60 = rampLag(300, 60);
    const at240 = rampLag(300, 240);
    expect(Math.abs(at60 - at240)).toBeLessThan(3);
  });

  it('falls back to a nominal interval for zero or missing dt and resets cleanly', () => {
    const f = new OneEuroFilter(child);
    f.filter(0);
    const a = f.filter(10, 0);
    const b = new OneEuroFilter(child);
    b.filter(0);
    expect(a).toBeCloseTo(b.filter(10), 9);
    f.reset();
    expect(f.filter(99)).toBe(99);
  });

  it('filters points per axis and keeps pressure, tilt and timestamp', () => {
    const f = new OneEuroPointFilter(child);
    f.filter({ x: 0, y: 0, timestamp: 0 });
    const out = f.filter(
      { x: 10, y: -10, timestamp: 16, pressure: 0.8, tiltX: 20, tiltY: -5 },
      1 / 60
    );
    expect(out.x).toBeGreaterThan(0);
    expect(out.x).toBeLessThan(10);
    expect(out.y).toBeCloseTo(-out.x, 9);
    expect(out).toMatchObject({ timestamp: 16, pressure: 0.8, tiltX: 20, tiltY: -5 });
  });
});

describe('chalk width from stylus pressure and tilt', () => {
  it('draws the familiar width for a mouse (pressure 0.5, no tilt) and for unknown pressure', () => {
    expect(chalkWidthFor({ pressure: 0.5 })).toBeCloseTo(CHALK_BASE_WIDTH, 0);
    expect(chalkWidthFor({})).toBeCloseTo(chalkWidthFor({ pressure: 0.5 }), 9);
    expect(chalkWidthFor({ pressure: 0 })).toBeCloseTo(chalkWidthFor({ pressure: 0.5 }), 9);
  });

  it('gets thinner with a light touch and thicker when pressing hard', () => {
    const light = chalkWidthFor({ pressure: 0.1 });
    const firm = chalkWidthFor({ pressure: 1 });
    expect(light).toBeLessThan(CHALK_BASE_WIDTH);
    expect(light).toBeGreaterThan(CHALK_BASE_WIDTH * 0.5); // still visible
    expect(firm).toBeGreaterThan(CHALK_BASE_WIDTH);
    expect(firm).toBeLessThanOrEqual(CHALK_BASE_WIDTH * 1.4);
    expect(chalkWidthFor({ pressure: 2 })).toBeCloseTo(firm, 9); // clamped
  });

  it('broadens with stylus tilt, up to 1.5× when lying flat', () => {
    const upright = chalkWidthFor({ pressure: 0.5 });
    expect(chalkWidthFor({ pressure: 0.5, tiltX: 45 })).toBeGreaterThan(upright);
    expect(chalkWidthFor({ pressure: 0.5, tiltX: 90 })).toBeCloseTo(upright * 1.5, 5);
    // tilt magnitude combines both axes (60°/60° ≈ 85°) and saturates at 90°
    expect(chalkWidthFor({ pressure: 0.5, tiltX: 60, tiltY: 60 })).toBeGreaterThan(upright * 1.45);
    expect(chalkWidthFor({ pressure: 0.5, tiltX: 90, tiltY: 90 })).toBeCloseTo(upright * 1.5, 5);
  });
});
