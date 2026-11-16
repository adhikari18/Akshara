import { getShirorekhaSegments, validateStrokeTopology } from '@akshara/data';
import type { LetterStrokeDataset, StrokeDefinition, WaypointDefinition } from '@akshara/data';
import { OneEuroPointFilter, type OneEuroProfile } from './one-euro-filter.js';
import {
  REFERENCE_SAMPLE_STEP,
  buildStrokeReferencePath,
  distanceToReferencePath,
  pointToSegmentDistance,
  type StrokeReferencePath,
} from './stroke-path.js';

export interface Point2D {
  x: number;
  y: number;
  /** Milliseconds (e.g. `performance.now()`), used for rate-independent filtering. */
  timestamp?: number;
  /** Stylus pressure 0 – 1 (PointerEvent.pressure; a mouse reports 0.5 while pressed). */
  pressure?: number;
  /** Stylus tilt in degrees (PointerEvent.tiltX / tiltY, −90 … 90). */
  tiltX?: number;
  tiltY?: number;
}

export type LearnerToleranceMode = 'child' | 'standard' | 'strict';

export interface TracingEvaluatorOptions {
  /**
   * Tolerance profile:
   * - 'child': 1.45x radius multiplier + motor jitter smoothing for young learners
   * - 'standard': 1.0x canonical radius
   * - 'strict': 0.75x radius for advanced calligraphy precision
   */
  mode?: LearnerToleranceMode;
  /**
   * Exponential moving average factor (0 < alpha <= 1) applied to raw pointer coordinates
   * to dampen high-frequency motor tremor in young learners.
   */
  smoothingAlpha?: number;
  /**
   * Velocity-adaptive 1€ filter tuning (the default smoother). When omitted, a per-mode profile
   * is used (see ONE_EURO_PROFILES) and follows `setMode()`. Ignored if `smoothingAlpha` is set.
   */
  oneEuro?: OneEuroProfile;
  /**
   * Maximum perpendicular deviation multiplier relative to effective tolerance radius
   * before flagging an off-corridor warning.
   */
  corridorMultiplier?: number;
  /**
   * How closely the learner must follow the authored curve *between* waypoints, as a fraction
   * of the (mode-scaled) waypoint tolerance. The next waypoint only unlocks once the trail has
   * passed within this distance of every point of the curve since the previous waypoint, so
   * straight-line shortcuts across a curve are rejected. Default 0.5.
   */
  pathToleranceRatio?: number;
}

/** Why the Shirorekha detector rejected a sample. */
export type TopologyViolationCode = 'shirorekha-before-body';

/**
 * Pedagogical feedback for one pointer sample, as a code plus parameters. Core never emits
 * user-facing prose: the UI localizes these (and can add stroke instructions from the dataset).
 */
export type TracingHint =
  | { code: 'start-at-first-dot' }
  | { code: 'follow-stroke' }
  | { code: 'off-track'; dot: number }
  | { code: 'corner-cut'; backToDot: number; nextDot: number }
  | { code: 'stroke-complete'; nextStrokeOrder: number }
  | { code: 'letter-complete' }
  | { code: 'wrong-direction'; expected: LoopWinding }
  | { code: 'lift-over-gap'; gap: number }
  | { code: TopologyViolationCode };

/**
 * Continuous curve-fidelity grade for one completed stroke: the discrete Fréchet distance
 * between the learner's whole trail and the authored curve, both resampled uniformly by arc
 * length. Complements the waypoint unlocks, which only check that each checkpoint was reached.
 */
export interface StrokeFidelity {
  strokeId: string;
  /** Discrete Fréchet distance in logical px (0 = perfect trace). */
  frechetDistance: number;
  /** The path tolerance in force for this stroke; distance up to this is free. */
  pathTolerance: number;
  /** max(0, frechetDistance − pathTolerance): the part that costs accuracy. */
  excess: number;
}

export interface StrokeStepEvaluation {
  accepted: boolean;
  strokeCompleted: boolean;
  letterCompleted: boolean;
  currentStrokeIndex: number;
  currentStrokeOrder: number;
  unlockedWaypointIndex: number;
  totalWaypointsInStroke: number;
  distanceToTargetWaypoint: number;
  effectiveTolerance: number;
  corridorDeviation: number;
  isOffTrack: boolean;
  topologicalViolation: TopologyViolationCode | null;
  /**
   * True only on the first sample of a new mistake episode (premature Shirorekha or a cut
   * corner). Use this — not `topologicalViolation` — to trigger one-shot feedback such as a
   * warning sound, so a single mistake plays one sound regardless of pointer sample rate.
   */
  warningOnset: boolean;
  /** The learner reached the next waypoint but skipped part of the curve on the way there. */
  cornerCut: boolean;
  /**
   * The learner is going round a loop the wrong way (summed turning angle opposes the authored
   * winding). Further dots stay locked until the pen lifts, which restarts the stroke at dot 1.
   */
  wrongDirection: boolean;
  /**
   * The pen was dragged across a gap in a split Shirorekha (ध) instead of being lifted. Dots
   * stay locked until the pen lifts; progress then resumes from the span before the gap.
   */
  gapBridged: boolean;
  /** Learner's signed turning angle Σ Δθ so far in this stroke, degrees (+ = clockwise). */
  turningAngle: number;
  /** Max distance from the authored curve that still counts as following it (logical px). */
  pathTolerance: number;
  /** Set on the sample that completes a stroke: how faithfully its curve was followed. */
  strokeFidelity: StrokeFidelity | null;
  hint: TracingHint;
  smoothedPoint: Point2D;
}

export interface TracingProgressSummary {
  letterId: string;
  character: string;
  currentStrokeIndex: number;
  totalStrokes: number;
  completedStrokeIds: string[];
  unlockedWaypointsInCurrentStroke: number;
  totalWaypointsInCurrentStroke: number;
  overallCompletionRatio: number;
  accuracyScore: number;
  stars: 1 | 2 | 3;
  isLetterComplete: boolean;
  /** Distinct mistakes (off-track excursions, premature Shirorekha attempts, cut corners). */
  mistakeCount: number;
  /** Curve-fidelity grade of every completed stroke, in stroke order. */
  strokeFidelities: StrokeFidelity[];
  /** Mean Fréchet distance over completed strokes (0 until the first stroke completes). */
  meanFrechetDistance: number;
}

/** Waypoint-tolerance radius multiplier per learner mode (the single source of truth). */
export const MODE_MULTIPLIERS: Record<LearnerToleranceMode, number> = {
  child: 1.45,
  standard: 1.0,
  strict: 0.75,
};

/**
 * Scoring is defined per *mistake* and per *unit of distance*, never per pointer sample, so a
 * 120 Hz stylus and a 60 Hz mouse making the same mistake receive the same score.
 */
const MISTAKE_EPISODE_PENALTY = 6;
/** Default EMA smoothing per mode: young learners get heavier tremor damping. */
/**
 * Default 1€ filter profiles. Young learners' tremor is smoothed harder at rest (lower minCutoff)
 * while beta keeps fast, confident strokes from lagging. Speeds are in logical px/s: at 300 px/s
 * the child cutoff rises from 1 Hz to ~5.5 Hz.
 */
export const ONE_EURO_PROFILES: Record<LearnerToleranceMode, OneEuroProfile> = {
  child: { minCutoff: 1.0, beta: 0.015, dCutoff: 1.0 },
  standard: { minCutoff: 1.6, beta: 0.03, dCutoff: 1.0 },
  strict: { minCutoff: 2.5, beta: 0.05, dCutoff: 1.0 },
};

/** Legacy EMA smoothing per mode (used only when `smoothingAlpha` is given explicitly). */
const DEFAULT_SMOOTHING_ALPHA: Record<LearnerToleranceMode, number> = {
  child: 0.6,
  standard: 0.85,
  strict: 0.85,
};
/** Extra penalty per logical px drawn while off-track (a long excursion costs more than a blip). */
const OFF_TRACK_PENALTY_PER_PX = 0.1;
/** Hysteresis: an off-track excursion ends only once back within this fraction of the threshold. */
const OFF_TRACK_EXIT_RATIO = 0.8;
/**
 * Path tolerance is capped at this fraction of a stroke's extent (its waypoints' bounding box),
 * so tiny marks must really be traced; strokes wider than ~35 px are unaffected in every mode.
 */
const TINY_STROKE_TOLERANCE_RATIO = 0.6;
/** Floor for the capped path tolerance (logical px) so a dot is still humanly traceable. */
const MIN_PATH_TOLERANCE = 6;
/**
 * Strokes whose authored curve turns at least this much (one way) get direction enforcement:
 * the loops of क ख छ ठ, the body of ढ, ० and ४, the curls of अ and ग, …
 */
const WINDING_MIN_TURN = Math.PI;
/**
 * How much further against the authored winding than the curve itself ever turns the learner
 * may go before it counts as tracing backward. A wobble cancels itself out; going the wrong way
 * round a loop does not.
 */
const WRONG_WAY_MARGIN = Math.PI / 2;
/** Arc-length spacing (logical px) of the polylines compared by the Fréchet grade. */
const FRECHET_SAMPLE_SPACING = 4;
const FRECHET_MIN_SAMPLES = 16;
const FRECHET_MAX_SAMPLES = 128;
/** Accuracy lost per px of mean Fréchet excess beyond the path tolerance, and its cap. */
const FIDELITY_PENALTY_PER_PX = 0.5;
const FIDELITY_PENALTY_MAX = 15;
/** Sample interval the smoothing alpha is calibrated for (60 Hz). */
const SMOOTHING_REFERENCE_INTERVAL_MS = 1000 / 60;
/** Intervals shorter than this (coalesced events, synthetic tests) count as a nominal sample. */
const MIN_SMOOTHING_INTERVAL_MS = 1;
/** Gaps longer than this (e.g. a stalled event loop) are not extrapolated further. */
const SMOOTHING_MAX_INTERVAL_MS = 100;

/**
 * Geometry of the premature-Shirorekha detector, in logical units of a 300×300 glyph
 * (the canonical Akshara viewBox). The evaluator scales them to the dataset's actual viewBox.
 */
export const HEADLINE_DETECTION_GEOMETRY = {
  /** Reference glyph size the values below are authored for. */
  referenceSize: 300,
  /** Vertical half-band around the headline inside which a sample "is on the headline". */
  bandHalfHeight: 22,
  /** Horizontal slack beyond the headline's authored startX/endX. */
  horizontalMargin: 15,
  /** A stroke whose waypoints all sit at or above headline+slack is an upper-crown stroke. */
  crownSlack: 4,
  /** Horizontal distance a learner may drift from a headline-level waypoint they just left. */
  departureSlack: 35,
  /** Minimum horizontal sweep along the headline that counts as "drawing the bar". */
  minimumSweep: 45,
} as const;

interface HeadlineGeometry {
  bandHalfHeight: number;
  horizontalMargin: number;
  crownSlack: number;
  departureSlack: number;
  minimumSweep: number;
}

function scaleHeadlineGeometry(viewBox: { width: number; height: number }): HeadlineGeometry {
  const g = HEADLINE_DETECTION_GEOMETRY;
  const sy = viewBox.height / g.referenceSize;
  const sx = viewBox.width / g.referenceSize;
  return {
    bandHalfHeight: g.bandHalfHeight * sy,
    horizontalMargin: g.horizontalMargin * sx,
    crownSlack: g.crownSlack * sy,
    departureSlack: g.departureSlack * sx,
    minimumSweep: g.minimumSweep * sx,
  };
}

/**
 * Computes the Euclidean distance between two 2D points:
 * d = sqrt((x_p - x_w)^2 + (y_p - y_w)^2)
 */
export function euclideanDistance(p: Point2D, w: Point2D): number {
  const dx = p.x - w.x;
  const dy = p.y - w.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Evaluates the fundamental waypoint hit inequality:
 * sqrt((x_p - x_w)^2 + (y_p - y_w)^2) <= tolerance
 */
export function isWithinWaypointTolerance(
  pointer: Point2D,
  waypoint: Point2D,
  tolerance: number
): boolean {
  if (tolerance < 0) return false;
  return euclideanDistance(pointer, waypoint) <= tolerance;
}

/**
 * Computes the adaptive tolerance radius accounting for learner mode and optional pointer velocity/jitter.
 */
export function computeAdaptiveTolerance(
  baseTolerance: number,
  mode: LearnerToleranceMode = 'child',
  jitterEstimate = 0
): number {
  const multiplier = MODE_MULTIPLIERS[mode] ?? 1.0;
  const jitterBonus = mode === 'child' ? Math.min(12, jitterEstimate * 0.35) : 0;
  return Math.round((baseTolerance * multiplier + jitterBonus) * 100) / 100;
}

/**
 * Applies an Exponential Moving Average (EMA) low-pass filter to dampen child hand tremor.
 */
export function smoothPointerPoint(
  previous: Point2D | null,
  current: Point2D,
  alpha = 0.65
): Point2D {
  if (!previous) return { ...current };
  const clampedAlpha = Math.max(0.1, Math.min(1.0, alpha));
  return {
    x: previous.x + clampedAlpha * (current.x - previous.x),
    y: previous.y + clampedAlpha * (current.y - previous.y),
    timestamp: current.timestamp,
  };
}

/**
 * Converts a per-sample EMA alpha calibrated at 60 Hz into the alpha for an arbitrary sample
 * interval, so the filter has the same time constant on a 60 Hz mouse and a 120/240 Hz stylus:
 * alpha_dt = 1 - (1 - alpha)^(dt / 16.67ms). Without a usable interval, `alpha` is returned.
 */
export function rateNormalizedAlpha(alpha: number, intervalMs: number | undefined): number {
  if (intervalMs === undefined || !Number.isFinite(intervalMs) || intervalMs <= 0) return alpha;
  const clamped = Math.max(0.1, Math.min(1.0, alpha));
  const steps = Math.min(intervalMs, SMOOTHING_MAX_INTERVAL_MS) / SMOOTHING_REFERENCE_INTERVAL_MS;
  return 1 - Math.pow(1 - clamped, steps);
}

/**
 * Computes the shortest perpendicular distance from point P to line segment AB.
 */
export function distanceToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const lenSq = vx * vx + vy * vy;
  if (lenSq === 0) return euclideanDistance(p, a);

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / lenSq));
  const projection: Point2D = {
    x: a.x + t * vx,
    y: a.y + t * vy,
  };
  return euclideanDistance(p, projection);
}

/**
 * Computes minimum distance from pointer P to the piecewise-linear waypoint trajectory of a stroke.
 */
export function distanceToWaypointPolyline(p: Point2D, waypoints: WaypointDefinition[]): number {
  if (waypoints.length === 0) return Infinity;
  if (waypoints.length === 1) return euclideanDistance(p, waypoints[0]);

  let minDistance = Infinity;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const d = distanceToSegment(p, waypoints[i], waypoints[i + 1]);
    if (d < minDistance) {
      minDistance = d;
    }
  }
  return minDistance;
}

/** Total length of a polyline. */
export function polylineLength(points: readonly Point2D[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += euclideanDistance(points[i - 1]!, points[i]!);
  return total;
}

/**
 * Uniform arc-length resampling: returns `count` points spaced equally along the polyline,
 * always including the exact first and last point. Removes the dependence of curve metrics on
 * pointer sample rate — a 120 Hz stylus and a 60 Hz mouse tracing the same path resample to the
 * same polyline. A degenerate (empty / zero-length) input repeats its single point.
 */
export function resampleByArcLength(points: readonly Point2D[], count: number): Point2D[] {
  if (!Number.isInteger(count) || count < 2) throw new Error('count must be an integer >= 2');
  if (points.length === 0) return [];
  const total = polylineLength(points);
  const first = points[0]!;
  if (points.length === 1 || total === 0) {
    return Array.from({ length: count }, () => ({ x: first.x, y: first.y }));
  }
  const out: Point2D[] = [{ x: first.x, y: first.y }];
  const step = total / (count - 1);
  let seg = 1;
  let segStart = 0; // arc length at points[seg - 1]
  let segLen = euclideanDistance(points[0]!, points[1]!);
  for (let i = 1; i < count - 1; i++) {
    const target = i * step;
    while (segStart + segLen < target && seg < points.length - 1) {
      segStart += segLen;
      seg += 1;
      segLen = euclideanDistance(points[seg - 1]!, points[seg]!);
    }
    const a = points[seg - 1]!;
    const b = points[seg]!;
    const t = segLen === 0 ? 0 : (target - segStart) / segLen;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  const last = points[points.length - 1]!;
  out.push({ x: last.x, y: last.y });
  return out;
}

/**
 * Discrete Fréchet distance between two polylines (Eiter & Mannila 1994): the shortest leash
 * that lets a walker on each curve reach the end, both moving forward only. Unlike a nearest-
 * point (Hausdorff-style) deviation it respects ordering, so doubling back along the curve or
 * skipping a bend shows up as a large distance. O(n·m) time, O(m) memory.
 */
export function discreteFrechetDistance(a: readonly Point2D[], b: readonly Point2D[]): number {
  if (a.length === 0 || b.length === 0) return Infinity;
  let prev = new Array<number>(b.length);
  let curr = new Array<number>(b.length);
  for (let j = 0; j < b.length; j++) {
    const d = euclideanDistance(a[0]!, b[j]!);
    prev[j] = j === 0 ? d : Math.max(prev[j - 1]!, d);
  }
  for (let i = 1; i < a.length; i++) {
    curr[0] = Math.max(prev[0]!, euclideanDistance(a[i]!, b[0]!));
    for (let j = 1; j < b.length; j++) {
      const reach = Math.min(prev[j - 1]!, prev[j]!, curr[j - 1]!);
      curr[j] = Math.max(reach, euclideanDistance(a[i]!, b[j]!));
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length - 1]!;
}

/** Visual winding of a loop as seen on screen. */
export type LoopWinding = 'clockwise' | 'counter-clockwise';

/** Resampling step (logical px) used before measuring turning, so jitter and rate don't matter. */
export const TURNING_SAMPLE_SPACING = 4;
/** Heading changes sharper than this are reversals (cusps, retraces) whose sign is arbitrary. */
const REVERSAL_ANGLE = (150 * Math.PI) / 180;

function wrapAngle(a: number): number {
  let x = a;
  while (x > Math.PI) x -= 2 * Math.PI;
  while (x <= -Math.PI) x += 2 * Math.PI;
  return x;
}

/**
 * Running total of signed turning angle (Σ Δθ, radians) along a polyline, one value per
 * resampled step. Screen space is y-down, so a **positive** total means the path turns
 * **clockwise as seen on screen**, negative means counter-clockwise. The path is first resampled
 * by arc length (`spacing` px) so pointer jitter and sample rate do not inflate the sum, and
 * near-180° reversals are ignored: doubling back along a line has no meaningful turning sign.
 */
export function cumulativeTurningProfile(
  points: readonly Point2D[],
  spacing = TURNING_SAMPLE_SPACING
): number[] {
  const length = polylineLength(points);
  if (points.length < 2 || length < spacing * 2) return [0];
  const pts = resampleByArcLength(points, Math.max(3, Math.ceil(length / spacing) + 1));
  const profile = [0];
  let total = 0;
  let prevHeading: number | null = null;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i]!.x - pts[i - 1]!.x;
    const dy = pts[i]!.y - pts[i - 1]!.y;
    if (dx === 0 && dy === 0) continue;
    const heading = Math.atan2(dy, dx);
    if (prevHeading !== null) {
      const delta = wrapAngle(heading - prevHeading);
      if (Math.abs(delta) < REVERSAL_ANGLE) total += delta;
    }
    prevHeading = heading;
    profile.push(total);
  }
  return profile;
}

/** Signed turning angle Σ Δθ along a polyline (radians; positive = clockwise on screen). */
export function signedTurningAngle(
  points: readonly Point2D[],
  spacing = TURNING_SAMPLE_SPACING
): number {
  const profile = cumulativeTurningProfile(points, spacing);
  return profile[profile.length - 1]!;
}

/**
 * Which way a loop winds on screen, or null when the path turns less than `minTurn` radians
 * overall (too straight to call). A full loop turns about ±2π.
 */
export function loopWindingOf(
  points: readonly Point2D[],
  minTurn = Math.PI / 2
): LoopWinding | null {
  const turn = signedTurningAngle(points);
  if (Math.abs(turn) < minTurn) return null;
  return turn > 0 ? 'clockwise' : 'counter-clockwise';
}

// Stroke-order validation lives in @akshara/data so dataset validation and the
// evaluator share one implementation; re-exported here for API compatibility.
export { validateStrokeTopology };

/**
 * Headless stateful evaluator for interactive Devanagari stroke tracing.
 */
export class TracingEvaluator {
  private readonly dataset: LetterStrokeDataset;
  private mode: LearnerToleranceMode;
  /** Explicit override from options; when absent the alpha is derived from the current mode. */
  private readonly smoothingAlphaOverride: number | undefined;
  private readonly oneEuroOverride: OneEuroProfile | undefined;
  private readonly pointFilter: OneEuroPointFilter;
  private readonly headline: HeadlineGeometry;
  private readonly corridorMultiplier: number;
  private readonly pathToleranceRatio: number;
  /** Dense authored curve for each stroke (index-aligned with `dataset.strokes`). */
  private readonly referencePaths: StrokeReferencePath[];

  private currentStrokeIndex = 0;
  private unlockedWaypointIndex = -1;
  private completedStrokeIds: string[] = [];
  private lastSmoothedPoint: Point2D | null = null;
  private lastRawPoint: Point2D | null = null;
  private strokeStartPoint: Point2D | null = null;

  /** Which samples of the current stroke's authored curve the learner's trail has passed near. */
  private curveCovered: boolean[] = [];
  /** First curve sample the learner is accountable for (where they started inside ring #1). */
  private curveRequiredFrom = 0;
  /** Smoothed trail of the current stroke (all gestures), graded by Fréchet distance on completion. */
  private strokeTrail: Point2D[] = [];
  private strokeFidelities: StrokeFidelity[] = [];

  // Distance-weighted scoring accumulators (independent of pointer sample rate)
  private deviationWeightedSum = 0;
  private deviationLength = 0;
  private offTrackDistance = 0;
  private mistakeEpisodes = 0;

  // Episode latches: a mistake is counted (and announced) once, not once per sample
  private offTrackLatched = false;
  private topologyLatched = false;
  private cornerCutLatched = false;

  /** Expected winding per stroke (null for strokes that don't loop), see WINDING_MIN_TURN. */
  private readonly windingRefs: Array<{
    expected: LoopWinding;
    sign: 1 | -1;
    floor: number;
  } | null>;
  // Learner's running turning angle for the current stroke (distance-gated, never across lifts)
  private turnAnchor: Point2D | null = null;
  private turnHeading: number | null = null;
  private turnTotal = 0;
  private wrongWayLatched = false;

  /** Gaps in a split Shirorekha (x-interval, and the waypoint that ends the span before it). */
  private readonly headlineGaps: Array<{ fromX: number; toX: number; afterWaypoint: number }>;
  private gapBridgedLatched = false;
  /** Index of the gap the learner bridged (to roll back to when the pen lifts). */
  private bridgedGap = -1;

  constructor(dataset: LetterStrokeDataset, options: TracingEvaluatorOptions = {}) {
    const topologyCheck = validateStrokeTopology(dataset.strokes, undefined, {
      requireShirorekha: dataset.category !== 'numeral',
    });
    if (!topologyCheck.valid) {
      throw new Error(
        `Invalid Devanagari stroke topology for '${dataset.id}': ${topologyCheck.violations.join(' ')}`
      );
    }
    this.dataset = dataset;
    this.mode = options.mode ?? 'child';
    this.smoothingAlphaOverride = options.smoothingAlpha;
    this.oneEuroOverride = options.oneEuro;
    this.pointFilter = new OneEuroPointFilter(options.oneEuro ?? ONE_EURO_PROFILES[this.mode]);
    this.headline = scaleHeadlineGeometry(dataset.viewBox);
    this.corridorMultiplier = options.corridorMultiplier ?? 1.85;
    this.pathToleranceRatio = options.pathToleranceRatio ?? 0.5;
    this.referencePaths = dataset.strokes.map((stroke) => buildStrokeReferencePath(stroke));
    this.headlineGaps = this.computeHeadlineGaps();
    this.windingRefs = this.referencePaths.map((ref) => {
      const wpIdx = ref.waypointSampleIndex;
      const profile = cumulativeTurningProfile(
        ref.samples.slice(wpIdx[0]!, wpIdx[wpIdx.length - 1]! + 1)
      );
      const total = profile[profile.length - 1]!;
      if (Math.abs(total) < WINDING_MIN_TURN) return null;
      const sign: 1 | -1 = total > 0 ? 1 : -1;
      // The most a faithful trace ever turns *against* the winding (ठ's stem curl: ~ −80°)
      const mostAgainst = Math.min(...profile.map((v) => v * sign));
      return {
        expected: sign > 0 ? 'clockwise' : 'counter-clockwise',
        sign,
        floor: mostAgainst - WRONG_WAY_MARGIN,
      };
    });
  }

  /**
   * Switch learner mode mid-session. Everything derived from the mode follows: waypoint
   * tolerance, path tolerance, and (unless `smoothingAlpha` was given explicitly) the
   * jitter-smoothing strength.
   */
  public setMode(mode: LearnerToleranceMode): void {
    this.mode = mode;
    if (!this.oneEuroOverride) this.pointFilter.setProfile(ONE_EURO_PROFILES[mode]);
  }

  /**
   * The smoother in effect: the velocity-adaptive 1€ filter by default, or the legacy EMA when
   * `smoothingAlpha` was given explicitly (alpha 1 = no smoothing, used by tests).
   */
  public getSmoothing():
    { kind: 'one-euro'; profile: OneEuroProfile } | { kind: 'ema'; alpha: number } {
    if (this.smoothingAlphaOverride !== undefined) {
      return { kind: 'ema', alpha: this.smoothingAlphaOverride };
    }
    return { kind: 'one-euro', profile: this.pointFilter.getProfile() };
  }

  /** EMA alpha in effect: the explicit option, else the default for the current mode. */
  public getSmoothingAlpha(): number {
    return this.smoothingAlphaOverride ?? DEFAULT_SMOOTHING_ALPHA[this.mode];
  }

  public getMode(): LearnerToleranceMode {
    return this.mode;
  }

  public getDataset(): LetterStrokeDataset {
    return this.dataset;
  }

  public getCurrentStroke(): StrokeDefinition | null {
    return this.dataset.strokes[this.currentStrokeIndex] ?? null;
  }

  public reset(): void {
    this.currentStrokeIndex = 0;
    this.completedStrokeIds = [];
    this.deviationWeightedSum = 0;
    this.deviationLength = 0;
    this.offTrackDistance = 0;
    this.mistakeEpisodes = 0;
    this.strokeFidelities = [];
    this.resetCurrentStroke();
  }

  public resetCurrentStroke(): void {
    this.restartStrokeAttempt();
    this.endGesture();
  }

  /** Gaps between the Shirorekha's spans, each tied to the waypoint that ends the span before it. */
  private computeHeadlineGaps(): Array<{ fromX: number; toX: number; afterWaypoint: number }> {
    const { shirorekha } = this.dataset;
    const bar = this.dataset.strokes[this.dataset.strokes.length - 1];
    if (!shirorekha || !bar || bar.type !== 'shirorekha') return [];
    const spans = getShirorekhaSegments(this.dataset);
    const gaps: Array<{ fromX: number; toX: number; afterWaypoint: number }> = [];
    for (let i = 0; i + 1 < spans.length; i++) {
      const fromX = spans[i]!.endX;
      // The waypoint sitting on the end of this span (1.3 guarantees one exists)
      let afterWaypoint = 0;
      let best = Infinity;
      bar.waypoints.forEach((wp, idx) => {
        const d = Math.abs(wp.x - fromX);
        if (d < best) {
          best = d;
          afterWaypoint = idx;
        }
      });
      gaps.push({ fromX, toX: spans[i + 1]!.startX, afterWaypoint });
    }
    return gaps;
  }

  /**
   * Did the pen-down movement a→b cross a gap of the split Shirorekha at headline height?
   * Returns the gap index, or -1. Touching the span ends themselves is fine (small slack).
   */
  private bridgedGapIndex(a: Point2D, b: Point2D): number {
    const { shirorekha } = this.dataset;
    if (!shirorekha || this.headlineGaps.length === 0) return -1;
    const onBand = (p: Point2D) => Math.abs(p.y - shirorekha.y) <= this.headline.bandHalfHeight;
    if (!onBand(a) || !onBand(b)) return -1;
    const slack = 4;
    const lo = Math.min(a.x, b.x);
    const hi = Math.max(a.x, b.x);
    return this.headlineGaps.findIndex((g) => hi > g.fromX + slack && lo < g.toX - slack);
  }

  /** Forget the current stroke's progress (dots, coverage, trail, turning) without ending the gesture. */
  private restartStrokeAttempt(): void {
    this.unlockedWaypointIndex = -1;
    this.strokeStartPoint = null;
    this.curveCovered = [];
    this.curveRequiredFrom = 0;
    this.strokeTrail = [];
    this.turnAnchor = null;
    this.turnHeading = null;
    this.turnTotal = 0;
    this.wrongWayLatched = false;
    this.gapBridgedLatched = false;
    this.bridgedGap = -1;
  }

  /** Expected winding of a stroke, or null if it is not a loop for direction purposes. */
  public getExpectedWinding(
    stroke: StrokeDefinition | null = this.getCurrentStroke()
  ): LoopWinding | null {
    if (!stroke) return null;
    const idx = this.dataset.strokes.indexOf(stroke);
    return idx === -1 ? null : (this.windingRefs[idx]?.expected ?? null);
  }

  /** Extend the learner's turning angle with a new point (distance-gated, so rate-independent). */
  private accumulateTurning(point: Point2D): void {
    if (!this.turnAnchor) {
      this.turnAnchor = point;
      return;
    }
    const dx = point.x - this.turnAnchor.x;
    const dy = point.y - this.turnAnchor.y;
    if (Math.hypot(dx, dy) < TURNING_SAMPLE_SPACING) return;
    const heading = Math.atan2(dy, dx);
    if (this.turnHeading !== null) {
      const delta = wrapAngle(heading - this.turnHeading);
      if (Math.abs(delta) < REVERSAL_ANGLE) this.turnTotal += delta;
    }
    this.turnHeading = heading;
    this.turnAnchor = point;
  }

  /**
   * Grade how faithfully the just-finished stroke followed its authored curve: both the
   * learner's trail and the reference (from where they started inside ring #1 to the end) are
   * resampled to the same number of equally spaced points, then compared by discrete Fréchet
   * distance. Rate-independent by construction.
   */
  private gradeStrokeFidelity(
    stroke: StrokeDefinition,
    referencePath: StrokeReferencePath
  ): StrokeFidelity {
    const wpIdx = referencePath.waypointSampleIndex;
    const pathTolerance = this.getPathTolerance(stroke);

    // Touching down anywhere inside ring #1 is allowed, so the walk from the touch-down point
    // to the line is free: grade from the first trail point within the path tolerance of the
    // curve. Likewise a stroke completes once the pointer enters the final ring, so the trail
    // may stop a little short of the curve's end: compare up to where the learner stopped.
    const startSegment = referencePath.samples.slice(
      wpIdx[0]!,
      wpIdx[Math.min(1, wpIdx.length - 1)]! + 1
    );
    const nearStartSegment = (p: Point2D) =>
      startSegment.some((q) => euclideanDistance(p, q) <= pathTolerance);
    let firstOnCurve = this.strokeTrail.findIndex(nearStartSegment);
    if (firstOnCurve === -1) firstOnCurve = 0;
    const trail = this.strokeTrail.slice(firstOnCurve);
    const startIndex = trail[0]
      ? this.projectOntoCurve(trail[0], wpIdx[0]!, wpIdx[Math.min(1, wpIdx.length - 1)]!)
      : wpIdx[0]!;
    const lastTrailPoint = trail[trail.length - 1];
    // For the end, ties resolve to the latest sample so a closed loop (end == start) is not
    // truncated back to where it began.
    const endIndex = lastTrailPoint
      ? this.projectOntoCurve(
          lastTrailPoint,
          wpIdx[Math.max(0, wpIdx.length - 2)]!,
          wpIdx[wpIdx.length - 1]!,
          'latest'
        )
      : wpIdx[wpIdx.length - 1]!;
    const reference = referencePath.samples.slice(startIndex, Math.max(startIndex, endIndex) + 1);
    const count = Math.max(
      FRECHET_MIN_SAMPLES,
      Math.min(FRECHET_MAX_SAMPLES, Math.ceil(polylineLength(reference) / FRECHET_SAMPLE_SPACING))
    );
    const frechetDistance = discreteFrechetDistance(
      resampleByArcLength(reference, count),
      resampleByArcLength(trail, count)
    );
    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      strokeId: stroke.id,
      frechetDistance: round(frechetDistance),
      pathTolerance: round(pathTolerance),
      excess: round(Math.max(0, frechetDistance - pathTolerance)),
    };
  }

  /**
   * Call when the pen/finger lifts. The next sample then starts a fresh gesture: the trail is not
   * bridged across the lift (so tapping ahead can't "cover" the curve), smoothing restarts at the
   * new touch point, and mistake episodes close so a new attempt can be announced again.
   */
  public endGesture(): void {
    this.lastSmoothedPoint = null;
    this.lastRawPoint = null;
    this.pointFilter.reset();
    this.offTrackLatched = false;
    this.topologyLatched = false;
    this.cornerCutLatched = false;
    // Never measure a heading change across a pen lift.
    this.turnAnchor = null;
    this.turnHeading = null;
    // Lifting after going the wrong way round restarts the stroke at dot 1.
    if (this.wrongWayLatched) this.restartStrokeAttempt();
    // Lifting after dragging across a Shirorekha gap: keep the span(s) already drawn, forget
    // anything beyond the gap, and continue from the other side.
    if (this.gapBridgedLatched) {
      const gap = this.headlineGaps[this.bridgedGap];
      if (gap) {
        this.unlockedWaypointIndex = Math.min(this.unlockedWaypointIndex, gap.afterWaypoint);
        const ref = this.referencePaths[this.currentStrokeIndex];
        if (ref && this.curveCovered.length > 0) {
          const subpathAfterGap = this.bridgedGap + 1;
          for (let i = 0; i < this.curveCovered.length; i++) {
            if ((ref.subpathOf[i] ?? 0) >= subpathAfterGap) this.curveCovered[i] = false;
          }
        }
      }
      this.gapBridgedLatched = false;
      this.bridgedGap = -1;
    }
  }

  /**
   * Distance from the authored curve that still counts as following it, for the current mode.
   * Capped relative to the stroke's own size, so a tiny mark (a bindu is a ~20 px circle) cannot
   * be "covered" by a dab or a half circle — it has to be drawn round like any other stroke.
   */
  public getPathTolerance(stroke: StrokeDefinition | null = this.getCurrentStroke()): number {
    if (!stroke) return 0;
    const xs = stroke.waypoints.map((w) => w.x);
    const ys = stroke.waypoints.map((w) => w.y);
    const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const byMode =
      computeAdaptiveTolerance(stroke.toleranceRadius, this.mode, 0) * this.pathToleranceRatio;
    return Math.min(byMode, Math.max(MIN_PATH_TOLERANCE, extent * TINY_STROKE_TOLERANCE_RATIO));
  }

  /** Mark curve samples of the current stroke that the trail segment a→b passes near. */
  private markCoverage(a: Point2D, b: Point2D): void {
    if (this.curveCovered.length === 0) return;
    const samples = this.referencePaths[this.currentStrokeIndex]!.samples;
    const tol = this.getPathTolerance();
    for (let i = this.curveRequiredFrom; i < this.curveCovered.length; i++) {
      if (!this.curveCovered[i] && pointToSegmentDistance(samples[i]!, a, b) <= tol) {
        this.curveCovered[i] = true;
      }
    }
  }

  /**
   * Where along the curve (sample index within [from, to]) the pointer currently is. Ties —
   * e.g. where a loop crosses itself — resolve to the earliest pass, which errs on the lenient
   * side (it can only delay, never invent, a corner-cut verdict).
   */
  private projectOntoCurve(
    point: Point2D,
    from: number,
    to: number,
    prefer: 'earliest' | 'latest' = 'earliest'
  ): number {
    const samples = this.referencePaths[this.currentStrokeIndex]!.samples;
    let best = Infinity;
    for (let i = from; i <= to; i++) best = Math.min(best, euclideanDistance(point, samples[i]!));
    const near = (i: number) =>
      euclideanDistance(point, samples[i]!) <= best + REFERENCE_SAMPLE_STEP;
    if (prefer === 'latest') {
      for (let i = to; i >= from; i--) if (near(i)) return i;
    } else {
      for (let i = from; i <= to; i++) if (near(i)) return i;
    }
    return from;
  }

  /**
   * Has the learner followed the authored curve far enough to unlock `targetWaypoint`?
   * - 'followed': every curve sample behind the pointer (and, for the final waypoint, all the
   *   way to the end of the stroke) has been traced within the path tolerance.
   * - 'cut': part of the curve *behind* the pointer was skipped — a shortcut.
   * - 'pending': nothing skipped yet, the learner just hasn't reached the end of the stroke.
   */
  private curveFollowStatus(
    point: Point2D,
    targetWaypoint: number
  ): 'followed' | 'cut' | 'pending' {
    if (this.curveCovered.length === 0) return 'followed';
    const idx = this.referencePaths[this.currentStrokeIndex]!.waypointSampleIndex;
    const targetSample = idx[targetWaypoint]!;
    const projected = this.projectOntoCurve(point, this.curveRequiredFrom, targetSample);
    for (let i = this.curveRequiredFrom; i <= projected; i++) {
      if (!this.curveCovered[i]) return 'cut';
    }
    if (targetWaypoint === idx.length - 1) {
      for (let i = projected + 1; i <= targetSample; i++) {
        if (!this.curveCovered[i]) return 'pending';
      }
    }
    return 'followed';
  }

  /**
   * Detects if the learner prematurely attempts to draw the top horizontal Shirorekha bar
   * before completing the body and vertical stem strokes.
   */
  private detectPrematureShirorekhaAttempt(
    point: Point2D,
    currentStroke: StrokeDefinition
  ): TopologyViolationCode | null {
    const { shirorekha } = this.dataset;
    // Numerals have no headline, so there is nothing to draw "too early".
    if (!shirorekha || currentStroke.type === 'shirorekha') {
      return null;
    }
    const { bandHalfHeight, horizontalMargin, crownSlack, departureSlack, minimumSweep } =
      this.headline;
    const onHeadlineBand = (y: number) => Math.abs(y - shirorekha.y) <= bandHalfHeight;
    const nearHeadlineY = onHeadlineBand(point.y);
    const withinHeadlineX = getShirorekhaSegments(this.dataset).some(
      (span) => point.x >= span.startX - horizontalMargin && point.x <= span.endX + horizontalMargin
    );

    // Upper-crown strokes (such as Dirgha Ikar arch hook, Ekar/Aikar flags, or Shirbindu)
    // operate at or above the Shirorekha headline by design.
    const isUpperCrownStroke = currentStroke.waypoints.every(
      (wp) => wp.y <= shirorekha.y + crownSlack
    );
    if (isUpperCrownStroke) {
      return null;
    }

    // Strokes that themselves touch the headline (e.g. the short neck of ङ, ट, ड, or the
    // rising arm of ण) legitimately pass through the headline band. A learner who stays
    // on such a stroke's own path is not drawing the Shirorekha early.
    const touchesHeadline = currentStroke.waypoints.some((wp) => onHeadlineBand(wp.y));
    if (
      touchesHeadline &&
      distanceToWaypointPolyline(point, currentStroke.waypoints) <= currentStroke.toleranceRadius
    ) {
      return null;
    }

    // Check if the current stroke's next target waypoint or just-unlocked waypoint is near the headline
    const nextWp =
      currentStroke.waypoints[Math.max(0, this.unlockedWaypointIndex + 1)] ??
      currentStroke.waypoints[0];
    const prevWp =
      this.unlockedWaypointIndex >= 0 ? currentStroke.waypoints[this.unlockedWaypointIndex] : null;
    const targetNearHeadline = onHeadlineBand(nextWp.y);
    const departingHeadlineWaypoint =
      prevWp !== null && onHeadlineBand(prevWp.y) && Math.abs(point.x - prevWp.x) <= departureSlack;

    if (nearHeadlineY && withinHeadlineX && !targetNearHeadline && !departingHeadlineWaypoint) {
      return 'shirorekha-before-body';
    }

    if (
      this.strokeStartPoint &&
      nearHeadlineY &&
      onHeadlineBand(this.strokeStartPoint.y) &&
      point.x - this.strokeStartPoint.x > minimumSweep
    ) {
      return 'shirorekha-before-body';
    }

    return null;
  }

  /**
   * Evaluates a pointer input sample (pointerdown / pointermove) against the active stroke's waypoints.
   */
  /**
   * Evaluates a pointer input sample (pointerdown / pointermove) against the active stroke's
   * waypoints. Pass `{ smooth: false }` for synthetic, noise-free input (the "Show me" demo):
   * smoothing only exists to remove hand tremor, and would merely add lag there.
   */
  public evaluatePointerSample(
    rawPoint: Point2D,
    { smooth = true }: { smooth?: boolean } = {}
  ): StrokeStepEvaluation {
    const currentStroke = this.getCurrentStroke();
    if (!currentStroke) {
      return {
        accepted: true,
        strokeCompleted: true,
        letterCompleted: true,
        currentStrokeIndex: this.dataset.strokes.length - 1,
        currentStrokeOrder: this.dataset.strokes.length,
        unlockedWaypointIndex: 0,
        totalWaypointsInStroke: 0,
        distanceToTargetWaypoint: 0,
        effectiveTolerance: 0,
        corridorDeviation: 0,
        isOffTrack: false,
        topologicalViolation: null,
        warningOnset: false,
        cornerCut: false,
        wrongDirection: false,
        gapBridged: false,
        turningAngle: 0,
        pathTolerance: 0,
        strokeFidelity: null,
        hint: { code: 'letter-complete' },
        smoothedPoint: rawPoint,
      };
    }

    const referencePath = this.referencePaths[this.currentStrokeIndex]!;
    const previousSmoothed = this.lastSmoothedPoint;
    const intervalMs =
      previousSmoothed?.timestamp !== undefined && rawPoint.timestamp !== undefined
        ? rawPoint.timestamp - previousSmoothed.timestamp
        : undefined;
    const smoothedPoint = !smooth
      ? { ...rawPoint }
      : this.smoothingAlphaOverride !== undefined
        ? smoothPointerPoint(
            previousSmoothed,
            rawPoint,
            rateNormalizedAlpha(this.smoothingAlphaOverride, intervalMs)
          )
        : this.pointFilter.filter(
            rawPoint,
            // Coalesced events can share a timestamp; a near-zero interval is treated as a
            // nominal sample (like the EMA path), not as an infinitely fast move.
            intervalMs !== undefined && intervalMs >= MIN_SMOOTHING_INTERVAL_MS
              ? Math.min(intervalMs, SMOOTHING_MAX_INTERVAL_MS) / 1000
              : undefined
          );
    const jitterDelta = previousSmoothed ? euclideanDistance(rawPoint, smoothedPoint) : 0;
    // Distance actually drawn since the last sample: the unit all scoring is weighted by.
    const stepLength = previousSmoothed ? euclideanDistance(previousSmoothed, smoothedPoint) : 0;
    this.lastSmoothedPoint = smoothedPoint;

    if (!this.strokeStartPoint) {
      this.strokeStartPoint = smoothedPoint;
    }

    // Extend the learner's trail (raw input, rate-independent: coverage is tested against the
    // trail's line segments, not its individual samples).
    const previousRaw = this.lastRawPoint;
    this.lastRawPoint = rawPoint;
    if (this.unlockedWaypointIndex >= 0) {
      this.markCoverage(previousRaw ?? rawPoint, rawPoint);
    }

    // Split Shirorekha: the pen must lift over the gap, never draw across it.
    let gapOnset = false;
    if (
      currentStroke.type === 'shirorekha' &&
      previousRaw &&
      this.unlockedWaypointIndex >= 0 &&
      !this.gapBridgedLatched
    ) {
      const gap = this.bridgedGapIndex(previousRaw, rawPoint);
      if (gap !== -1) {
        this.gapBridgedLatched = true;
        this.bridgedGap = gap;
        this.mistakeEpisodes += 1;
        gapOnset = true;
      }
    }

    const effectiveTolerance = computeAdaptiveTolerance(
      currentStroke.toleranceRadius,
      this.mode,
      jitterDelta
    );
    const pathTolerance = this.getPathTolerance(currentStroke);

    // Check for premature Shirorekha topological violation
    const topologicalViolation = this.detectPrematureShirorekhaAttempt(
      smoothedPoint,
      currentStroke
    );
    if (topologicalViolation) {
      // One mistake per gesture, however many samples the pointer spends on the headline.
      const warningOnset = !this.topologyLatched;
      if (warningOnset) {
        this.topologyLatched = true;
        this.mistakeEpisodes += 1;
      }
      const targetWp =
        currentStroke.waypoints[Math.max(0, this.unlockedWaypointIndex + 1)] ??
        currentStroke.waypoints[0];
      return {
        accepted: false,
        strokeCompleted: false,
        letterCompleted: false,
        currentStrokeIndex: this.currentStrokeIndex,
        currentStrokeOrder: currentStroke.order,
        unlockedWaypointIndex: this.unlockedWaypointIndex,
        totalWaypointsInStroke: currentStroke.waypoints.length,
        distanceToTargetWaypoint: euclideanDistance(smoothedPoint, targetWp),
        effectiveTolerance,
        corridorDeviation: distanceToReferencePath(smoothedPoint, referencePath),
        isOffTrack: true,
        topologicalViolation,
        warningOnset,
        cornerCut: false,
        wrongDirection: this.wrongWayLatched,
        gapBridged: this.gapBridgedLatched,
        turningAngle: Math.round((this.turnTotal * 180) / Math.PI),
        pathTolerance,
        strokeFidelity: null,
        hint: { code: topologicalViolation },
        smoothedPoint,
      };
    }

    const nextWaypointIndex = this.unlockedWaypointIndex + 1;
    const targetWaypoint =
      currentStroke.waypoints[nextWaypointIndex] ??
      currentStroke.waypoints[currentStroke.waypoints.length - 1];

    const distanceToTarget = euclideanDistance(smoothedPoint, targetWaypoint);
    // Deviation is measured from the authored curve, not the straight waypoint polyline.
    const corridorDeviation = distanceToReferencePath(smoothedPoint, referencePath);

    // Off-track excursions use hysteresis so jitter at the boundary is one episode, not many.
    const offTrackThreshold = effectiveTolerance * this.corridorMultiplier;
    if (this.unlockedWaypointIndex >= 0) {
      if (!this.offTrackLatched && corridorDeviation > offTrackThreshold) {
        this.offTrackLatched = true;
        this.mistakeEpisodes += 1;
      } else if (
        this.offTrackLatched &&
        corridorDeviation <= offTrackThreshold * OFF_TRACK_EXIT_RATIO
      ) {
        this.offTrackLatched = false;
      }
    }
    const isOffTrack = this.unlockedWaypointIndex >= 0 && this.offTrackLatched;

    if (isOffTrack) {
      this.offTrackDistance += stepLength;
    } else if (this.unlockedWaypointIndex >= 0) {
      this.deviationWeightedSum += corridorDeviation * stepLength;
      this.deviationLength += stepLength;
    }

    // Sequential waypoint unlock: within tolerance of the next waypoint AND the curve leading
    // to it has actually been followed (no straight-line shortcuts across a curve).
    let accepted = false;
    let cornerCut = false;
    let warningOnset = gapOnset;
    if (this.wrongWayLatched || this.gapBridgedLatched) {
      // Going round the wrong way, or dragging across a headline gap: nothing unlocks until
      // the pen lifts.
    } else if (isWithinWaypointTolerance(smoothedPoint, targetWaypoint, effectiveTolerance)) {
      const status =
        this.unlockedWaypointIndex < 0
          ? 'followed'
          : this.curveFollowStatus(rawPoint, nextWaypointIndex);
      if (status === 'followed') {
        if (this.unlockedWaypointIndex < 0) {
          // Stroke begins: the learner is accountable for the curve from where they touched
          // down inside ring #1 onward.
          const wpIdx = referencePath.waypointSampleIndex;
          this.curveCovered = new Array(referencePath.samples.length).fill(false);
          this.curveRequiredFrom = 0;
          this.curveRequiredFrom = this.projectOntoCurve(
            rawPoint,
            wpIdx[0]!,
            wpIdx[Math.min(1, wpIdx.length - 1)]!
          );
          this.markCoverage(rawPoint, rawPoint);
        }
        this.unlockedWaypointIndex = nextWaypointIndex;
        this.cornerCutLatched = false;
        accepted = true;
      } else if (status === 'cut') {
        cornerCut = true;
        if (!this.cornerCutLatched) {
          this.cornerCutLatched = true;
          this.mistakeEpisodes += 1;
          warningOnset = true;
        }
      } else {
        // 'pending': inside the final ring but the end of the stroke isn't traced yet — keep going.
        accepted = corridorDeviation <= effectiveTolerance;
      }
    } else if (this.unlockedWaypointIndex >= 0 && corridorDeviation <= effectiveTolerance) {
      // Moving smoothly along the corridor toward the next waypoint
      accepted = true;
    }

    // Once the stroke has begun, every smoothed sample belongs to its trail (across pen lifts).
    if (this.unlockedWaypointIndex >= 0) {
      this.strokeTrail.push(smoothedPoint);

      // Loop winding: Σ Δθ of the learner's path must not oppose the authored winding.
      this.accumulateTurning(smoothedPoint);
      const winding = this.windingRefs[this.currentStrokeIndex];
      if (winding && !this.wrongWayLatched && this.turnTotal * winding.sign < winding.floor) {
        this.wrongWayLatched = true;
        this.mistakeEpisodes += 1;
        warningOnset = true;
        accepted = false;
      }
    }

    const strokeCompleted =
      !this.wrongWayLatched &&
      !this.gapBridgedLatched &&
      this.unlockedWaypointIndex >= currentStroke.waypoints.length - 1;
    const wrongDirection = this.wrongWayLatched;
    const gapBridged = this.gapBridgedLatched;
    const turningAngle = Math.round((this.turnTotal * 180) / Math.PI);

    let strokeFidelity: StrokeFidelity | null = null;
    if (strokeCompleted) {
      strokeFidelity = this.gradeStrokeFidelity(currentStroke, referencePath);
      this.strokeFidelities.push(strokeFidelity);
      this.completedStrokeIds.push(currentStroke.id);
      this.currentStrokeIndex += 1;
      this.unlockedWaypointIndex = -1;
      this.strokeStartPoint = null;
      this.curveCovered = [];
      this.curveRequiredFrom = 0;
      this.strokeTrail = [];
      this.turnTotal = 0;
      this.endGesture();
    }

    const letterCompleted = this.currentStrokeIndex >= this.dataset.strokes.length;

    let hint: TracingHint = { code: 'follow-stroke' };
    if (letterCompleted) {
      hint = { code: 'letter-complete' };
    } else if (strokeCompleted) {
      hint = { code: 'stroke-complete', nextStrokeOrder: this.getCurrentStroke()!.order };
    } else if (gapBridged) {
      hint = { code: 'lift-over-gap', gap: this.bridgedGap + 1 };
    } else if (wrongDirection) {
      hint = {
        code: 'wrong-direction',
        expected: this.windingRefs[this.currentStrokeIndex]!.expected,
      };
    } else if (cornerCut) {
      // Dot numbers are 1-based as drawn on the slate: go back to the last unlocked dot.
      hint = { code: 'corner-cut', backToDot: nextWaypointIndex, nextDot: nextWaypointIndex + 1 };
    } else if (isOffTrack) {
      hint = { code: 'off-track', dot: nextWaypointIndex + 1 };
    } else if (this.unlockedWaypointIndex === -1) {
      hint = { code: 'start-at-first-dot' };
    }

    return {
      accepted,
      strokeCompleted,
      letterCompleted,
      currentStrokeIndex: Math.min(this.currentStrokeIndex, this.dataset.strokes.length - 1),
      currentStrokeOrder: currentStroke.order,
      unlockedWaypointIndex: this.unlockedWaypointIndex,
      totalWaypointsInStroke: currentStroke.waypoints.length,
      distanceToTargetWaypoint: Math.round(distanceToTarget * 100) / 100,
      effectiveTolerance,
      corridorDeviation: Math.round(corridorDeviation * 100) / 100,
      isOffTrack,
      topologicalViolation: null,
      warningOnset,
      cornerCut,
      wrongDirection,
      gapBridged,
      turningAngle,
      pathTolerance,
      strokeFidelity,
      hint,
      smoothedPoint,
    };
  }

  /**
   * Computes overall progress, accuracy score (0-100), and 1-3 star rating.
   */
  public getProgress(): TracingProgressSummary {
    const totalStrokes = this.dataset.strokes.length;
    const isLetterComplete = this.currentStrokeIndex >= totalStrokes;
    const currentStroke = this.getCurrentStroke();

    const totalWaypointsAllStrokes = this.dataset.strokes.reduce(
      (sum, s) => sum + s.waypoints.length,
      0
    );
    const completedWaypointsPriorStrokes = this.dataset.strokes
      .slice(0, this.currentStrokeIndex)
      .reduce((sum, s) => sum + s.waypoints.length, 0);
    const unlockedInActive = Math.max(0, this.unlockedWaypointIndex + 1);
    const overallCompletionRatio = Math.min(
      1,
      (completedWaypointsPriorStrokes + unlockedInActive) / Math.max(1, totalWaypointsAllStrokes)
    );

    // Mean deviation weighted by distance drawn (not by sample count) → device-independent.
    const meanDeviation =
      this.deviationLength > 0 ? this.deviationWeightedSum / this.deviationLength : 0;
    const deviationPenalty = Math.min(35, meanDeviation * 0.9);
    const mistakePenalty = Math.min(
      30,
      this.mistakeEpisodes * MISTAKE_EPISODE_PENALTY +
        this.offTrackDistance * OFF_TRACK_PENALTY_PER_PX
    );
    // Curve fidelity: only the Fréchet distance beyond the path tolerance costs points.
    const meanFrechetDistance =
      this.strokeFidelities.length > 0
        ? this.strokeFidelities.reduce((sum, f) => sum + f.frechetDistance, 0) /
          this.strokeFidelities.length
        : 0;
    const meanExcess =
      this.strokeFidelities.length > 0
        ? this.strokeFidelities.reduce((sum, f) => sum + f.excess, 0) / this.strokeFidelities.length
        : 0;
    const fidelityPenalty = Math.min(FIDELITY_PENALTY_MAX, meanExcess * FIDELITY_PENALTY_PER_PX);
    const accuracyScore = Math.max(
      40,
      Math.min(100, Math.round(100 - deviationPenalty - mistakePenalty - fidelityPenalty))
    );

    const stars: 1 | 2 | 3 = accuracyScore >= 85 ? 3 : accuracyScore >= 65 ? 2 : 1;

    return {
      letterId: this.dataset.id,
      character: this.dataset.character,
      currentStrokeIndex: Math.min(this.currentStrokeIndex, totalStrokes - 1),
      totalStrokes,
      completedStrokeIds: [...this.completedStrokeIds],
      unlockedWaypointsInCurrentStroke: unlockedInActive,
      totalWaypointsInCurrentStroke: currentStroke?.waypoints.length ?? 0,
      overallCompletionRatio: Math.round(overallCompletionRatio * 1000) / 1000,
      accuracyScore,
      stars,
      isLetterComplete,
      mistakeCount: this.mistakeEpisodes,
      strokeFidelities: [...this.strokeFidelities],
      meanFrechetDistance: Math.round(meanFrechetDistance * 100) / 100,
    };
  }
}
