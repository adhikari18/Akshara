import type { Point2D } from './tracing-evaluator.js';

/**
 * Tuning of a 1€ filter (Casiez, Roussel & Vogel, CHI 2012).
 * - `minCutoff` (Hz): smoothing at rest — lower removes more jitter, adds more lag when slow.
 * - `beta`: how fast the cutoff rises with speed — higher cuts lag during quick movements.
 * - `dCutoff` (Hz): smoothing of the speed estimate itself (1 Hz is the paper's default).
 */
export interface OneEuroProfile {
  minCutoff: number;
  beta: number;
  dCutoff: number;
}

/** Sample interval assumed when a point carries no timestamp (60 Hz). */
export const DEFAULT_SAMPLE_INTERVAL_S = 1 / 60;

/** Smoothing factor of a first-order low-pass with cutoff `fc` (Hz) sampled every `dt` seconds. */
export function lowPassAlpha(cutoffHz: number, dtSeconds: number): number {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtSeconds);
}

/**
 * One-dimensional 1€ filter: an adaptive low-pass whose cutoff frequency grows with the
 * (filtered) speed of the signal — fc = minCutoff + beta · |dx|. Slow, jittery motion is
 * smoothed hard; fast, deliberate motion passes with little lag. Because it is parameterised
 * by real time, a 240 Hz stylus and a 60 Hz mouse are filtered the same way.
 */
export class OneEuroFilter {
  private previous: number | null = null;
  private previousDerivative = 0;

  constructor(private profile: OneEuroProfile) {}

  setProfile(profile: OneEuroProfile): void {
    this.profile = profile;
  }

  getProfile(): OneEuroProfile {
    return this.profile;
  }

  /** Forget history, e.g. when the pen lifts; the next sample passes through unchanged. */
  reset(): void {
    this.previous = null;
    this.previousDerivative = 0;
  }

  /** Filter one sample taken `dtSeconds` after the previous one. */
  filter(value: number, dtSeconds = DEFAULT_SAMPLE_INTERVAL_S): number {
    const dt = dtSeconds > 0 && Number.isFinite(dtSeconds) ? dtSeconds : DEFAULT_SAMPLE_INTERVAL_S;
    if (this.previous === null) {
      this.previous = value;
      this.previousDerivative = 0;
      return value;
    }
    const { minCutoff, beta, dCutoff } = this.profile;
    // 1. Estimate speed from the raw signal, smoothed at dCutoff.
    const rawDerivative = (value - this.previous) / dt;
    const dAlpha = lowPassAlpha(dCutoff, dt);
    const derivative = this.previousDerivative + dAlpha * (rawDerivative - this.previousDerivative);
    // 2. Speed-adaptive cutoff, then the actual low-pass.
    const cutoff = minCutoff + beta * Math.abs(derivative);
    const alpha = lowPassAlpha(cutoff, dt);
    const filtered = this.previous + alpha * (value - this.previous);
    this.previous = filtered;
    this.previousDerivative = derivative;
    return filtered;
  }
}

/** A 1€ filter per axis, for pointer positions. Other point fields pass through untouched. */
export class OneEuroPointFilter {
  private readonly fx: OneEuroFilter;
  private readonly fy: OneEuroFilter;

  constructor(profile: OneEuroProfile) {
    this.fx = new OneEuroFilter(profile);
    this.fy = new OneEuroFilter(profile);
  }

  setProfile(profile: OneEuroProfile): void {
    this.fx.setProfile(profile);
    this.fy.setProfile(profile);
  }

  getProfile(): OneEuroProfile {
    return this.fx.getProfile();
  }

  reset(): void {
    this.fx.reset();
    this.fy.reset();
  }

  filter(point: Point2D, dtSeconds = DEFAULT_SAMPLE_INTERVAL_S): Point2D {
    return {
      ...point,
      x: this.fx.filter(point.x, dtSeconds),
      y: this.fy.filter(point.y, dtSeconds),
    };
  }
}

/** Default chalk width in logical px (what a mouse draws: pressure 0.5, no tilt). */
export const CHALK_BASE_WIDTH = 14;
/** Stylus pressure assumed when the device reports none (PointerEvent gives a mouse 0.5). */
export const DEFAULT_PRESSURE = 0.5;

/**
 * Chalk width for a pointer sample, from stylus pressure and tilt:
 * - pressure follows a gentle curve (γ = 0.8) so a light touch still leaves a visible mark:
 *   0 → ~0.55× base, 0.5 → ~1× base (mouse), 1 → 1.35× base;
 * - a tilted stylus lays its side down and draws broader, up to 1.5× at 90°.
 * Missing or zero pressure (mouse up, devices without a sensor) counts as the default.
 */
export function chalkWidthFor(
  point: Pick<Point2D, 'pressure' | 'tiltX' | 'tiltY'>,
  base = CHALK_BASE_WIDTH
): number {
  const pressure =
    point.pressure === undefined || !(point.pressure > 0)
      ? DEFAULT_PRESSURE
      : Math.min(1, point.pressure);
  const pressureScale = 0.55 + 0.8 * Math.pow(pressure, 0.8);
  const tilt = Math.min(1, Math.hypot(point.tiltX ?? 0, point.tiltY ?? 0) / 90);
  const tiltScale = 1 + 0.5 * Math.sin((tilt * Math.PI) / 2);
  return base * pressureScale * tiltScale;
}
