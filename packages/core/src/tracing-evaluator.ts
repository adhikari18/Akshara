import { validateStrokeTopology } from '@akshara/data';
import type { LetterStrokeDataset, StrokeDefinition, WaypointDefinition } from '@akshara/data';
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
  timestamp?: number;
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
  | { code: TopologyViolationCode };

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
  /** Max distance from the authored curve that still counts as following it (logical px). */
  pathTolerance: number;
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
const DEFAULT_SMOOTHING_ALPHA: Record<LearnerToleranceMode, number> = {
  child: 0.6,
  standard: 0.85,
  strict: 0.85,
};
/** Extra penalty per logical px drawn while off-track (a long excursion costs more than a blip). */
const OFF_TRACK_PENALTY_PER_PX = 0.1;
/** Hysteresis: an off-track excursion ends only once back within this fraction of the threshold. */
const OFF_TRACK_EXIT_RATIO = 0.8;
/** Sample interval the smoothing alpha is calibrated for (60 Hz). */
const SMOOTHING_REFERENCE_INTERVAL_MS = 1000 / 60;
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

  // Distance-weighted scoring accumulators (independent of pointer sample rate)
  private deviationWeightedSum = 0;
  private deviationLength = 0;
  private offTrackDistance = 0;
  private mistakeEpisodes = 0;

  // Episode latches: a mistake is counted (and announced) once, not once per sample
  private offTrackLatched = false;
  private topologyLatched = false;
  private cornerCutLatched = false;

  constructor(dataset: LetterStrokeDataset, options: TracingEvaluatorOptions = {}) {
    const topologyCheck = validateStrokeTopology(dataset.strokes);
    if (!topologyCheck.valid) {
      throw new Error(
        `Invalid Devanagari stroke topology for '${dataset.id}': ${topologyCheck.violations.join(' ')}`
      );
    }
    this.dataset = dataset;
    this.mode = options.mode ?? 'child';
    this.smoothingAlphaOverride = options.smoothingAlpha;
    this.headline = scaleHeadlineGeometry(dataset.viewBox);
    this.corridorMultiplier = options.corridorMultiplier ?? 1.85;
    this.pathToleranceRatio = options.pathToleranceRatio ?? 0.5;
    this.referencePaths = dataset.strokes.map((stroke) => buildStrokeReferencePath(stroke));
  }

  /**
   * Switch learner mode mid-session. Everything derived from the mode follows: waypoint
   * tolerance, path tolerance, and (unless `smoothingAlpha` was given explicitly) the
   * jitter-smoothing strength.
   */
  public setMode(mode: LearnerToleranceMode): void {
    this.mode = mode;
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
    this.resetCurrentStroke();
  }

  public resetCurrentStroke(): void {
    this.unlockedWaypointIndex = -1;
    this.strokeStartPoint = null;
    this.curveCovered = [];
    this.curveRequiredFrom = 0;
    this.endGesture();
  }

  /**
   * Call when the pen/finger lifts. The next sample then starts a fresh gesture: the trail is not
   * bridged across the lift (so tapping ahead can't "cover" the curve), smoothing restarts at the
   * new touch point, and mistake episodes close so a new attempt can be announced again.
   */
  public endGesture(): void {
    this.lastSmoothedPoint = null;
    this.lastRawPoint = null;
    this.offTrackLatched = false;
    this.topologyLatched = false;
    this.cornerCutLatched = false;
  }

  /** Distance from the authored curve that still counts as following it, for the current mode. */
  public getPathTolerance(stroke: StrokeDefinition | null = this.getCurrentStroke()): number {
    if (!stroke) return 0;
    return computeAdaptiveTolerance(stroke.toleranceRadius, this.mode, 0) * this.pathToleranceRatio;
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
  private projectOntoCurve(point: Point2D, from: number, to: number): number {
    const samples = this.referencePaths[this.currentStrokeIndex]!.samples;
    let best = Infinity;
    for (let i = from; i <= to; i++) best = Math.min(best, euclideanDistance(point, samples[i]!));
    for (let i = from; i <= to; i++) {
      if (euclideanDistance(point, samples[i]!) <= best + REFERENCE_SAMPLE_STEP) return i;
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
    if (currentStroke.type === 'shirorekha') {
      return null;
    }
    const { shirorekha } = this.dataset;
    const { bandHalfHeight, horizontalMargin, crownSlack, departureSlack, minimumSweep } =
      this.headline;
    const onHeadlineBand = (y: number) => Math.abs(y - shirorekha.y) <= bandHalfHeight;
    const nearHeadlineY = onHeadlineBand(point.y);
    const withinHeadlineX =
      point.x >= shirorekha.startX - horizontalMargin &&
      point.x <= shirorekha.endX + horizontalMargin;

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
  public evaluatePointerSample(rawPoint: Point2D): StrokeStepEvaluation {
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
        pathTolerance: 0,
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
    const smoothedPoint = smoothPointerPoint(
      previousSmoothed,
      rawPoint,
      rateNormalizedAlpha(this.getSmoothingAlpha(), intervalMs)
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
        pathTolerance,
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
    let warningOnset = false;
    if (isWithinWaypointTolerance(smoothedPoint, targetWaypoint, effectiveTolerance)) {
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

    const strokeCompleted = this.unlockedWaypointIndex >= currentStroke.waypoints.length - 1;

    if (strokeCompleted) {
      this.completedStrokeIds.push(currentStroke.id);
      this.currentStrokeIndex += 1;
      this.unlockedWaypointIndex = -1;
      this.strokeStartPoint = null;
      this.curveCovered = [];
      this.curveRequiredFrom = 0;
      this.endGesture();
    }

    const letterCompleted = this.currentStrokeIndex >= this.dataset.strokes.length;

    let hint: TracingHint = { code: 'follow-stroke' };
    if (letterCompleted) {
      hint = { code: 'letter-complete' };
    } else if (strokeCompleted) {
      hint = { code: 'stroke-complete', nextStrokeOrder: this.getCurrentStroke()!.order };
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
      pathTolerance,
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
    const accuracyScore = Math.max(
      40,
      Math.min(100, Math.round(100 - deviationPenalty - mistakePenalty))
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
    };
  }
}
