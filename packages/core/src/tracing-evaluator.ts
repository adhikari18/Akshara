import { validateStrokeTopology } from '@akshara/data';
import type { LetterStrokeDataset, StrokeDefinition, WaypointDefinition } from '@akshara/data';

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
  topologicalViolation: string | null;
  pedagogicalHint: string;
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
}

const MODE_MULTIPLIERS: Record<LearnerToleranceMode, number> = {
  child: 1.45,
  standard: 1.0,
  strict: 0.75,
};

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
  private readonly smoothingAlpha: number;
  private readonly corridorMultiplier: number;

  private currentStrokeIndex = 0;
  private unlockedWaypointIndex = -1;
  private completedStrokeIds: string[] = [];
  private lastSmoothedPoint: Point2D | null = null;
  private strokeStartPoint: Point2D | null = null;
  private cumulativeDeviations: number[] = [];
  private offTrackCount = 0;

  constructor(dataset: LetterStrokeDataset, options: TracingEvaluatorOptions = {}) {
    const topologyCheck = validateStrokeTopology(dataset.strokes);
    if (!topologyCheck.valid) {
      throw new Error(
        `Invalid Devanagari stroke topology for '${dataset.id}': ${topologyCheck.violations.join(' ')}`
      );
    }
    this.dataset = dataset;
    this.mode = options.mode ?? 'child';
    this.smoothingAlpha = options.smoothingAlpha ?? (this.mode === 'child' ? 0.6 : 0.85);
    this.corridorMultiplier = options.corridorMultiplier ?? 1.85;
  }

  public setMode(mode: LearnerToleranceMode): void {
    this.mode = mode;
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
    this.unlockedWaypointIndex = -1;
    this.completedStrokeIds = [];
    this.lastSmoothedPoint = null;
    this.strokeStartPoint = null;
    this.cumulativeDeviations = [];
    this.offTrackCount = 0;
  }

  public resetCurrentStroke(): void {
    this.unlockedWaypointIndex = -1;
    this.lastSmoothedPoint = null;
    this.strokeStartPoint = null;
  }

  /**
   * Detects if the learner prematurely attempts to draw the top horizontal Shirorekha bar
   * before completing the body and vertical stem strokes.
   */
  private detectPrematureShirorekhaAttempt(
    point: Point2D,
    currentStroke: StrokeDefinition
  ): string | null {
    if (currentStroke.type === 'shirorekha') {
      return null;
    }
    const { shirorekha } = this.dataset;
    const nearHeadlineY = Math.abs(point.y - shirorekha.y) <= 22;
    const withinHeadlineX =
      point.x >= shirorekha.startX - 15 && point.x <= shirorekha.endX + 15;

    // Upper-crown strokes (such as Dirgha Ikar arch hook, Ekar/Aikar flags, or Shirbindu)
    // operate at or above the Shirorekha headline by design.
    const isUpperCrownStroke = currentStroke.waypoints.every(
      (wp) => wp.y <= shirorekha.y + 4
    );
    if (isUpperCrownStroke) {
      return null;
    }

    // Strokes that themselves touch the headline (e.g. the short neck of ङ, ट, ड, or the
    // rising arm of ण) legitimately pass through the headline band. A learner who stays
    // on such a stroke's own path is not drawing the Shirorekha early.
    const touchesHeadline = currentStroke.waypoints.some(
      (wp) => Math.abs(wp.y - shirorekha.y) <= 22
    );
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
      this.unlockedWaypointIndex >= 0
        ? currentStroke.waypoints[this.unlockedWaypointIndex]
        : null;
    const targetNearHeadline = Math.abs(nextWp.y - shirorekha.y) <= 22;
    const departingHeadlineWaypoint =
      prevWp !== null &&
      Math.abs(prevWp.y - shirorekha.y) <= 22 &&
      Math.abs(point.x - prevWp.x) <= 35;

    if (nearHeadlineY && withinHeadlineX && !targetNearHeadline && !departingHeadlineWaypoint) {
      return 'शिरोरेखा (माथिको डिको) अन्त्यमा मात्र तान्नुहोस्! पहिले अक्षरको शरीर र ठाडो धर्को पूरा गर्नुहोस्। (Draw the letter body & stem first — the Shirorekha top bar comes strictly last!)';
    }

    if (
      this.strokeStartPoint &&
      nearHeadlineY &&
      Math.abs(this.strokeStartPoint.y - shirorekha.y) <= 22 &&
      point.x - this.strokeStartPoint.x > 45
    ) {
      return 'शिरोरेखा (माथिको डिको) अन्त्यमा मात्र तान्नुहोस्! पहिले अक्षरको शरीर र ठाडो धर्को पूरा गर्नुहोस्। (Draw the letter body & stem first — the Shirorekha top bar comes strictly last!)';
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
        pedagogicalHint: 'अक्षर पूरा भयो! (Character completed!)',
        smoothedPoint: rawPoint,
      };
    }

    const smoothedPoint = smoothPointerPoint(
      this.lastSmoothedPoint,
      rawPoint,
      this.smoothingAlpha
    );
    const jitterDelta = this.lastSmoothedPoint
      ? euclideanDistance(rawPoint, smoothedPoint)
      : 0;
    this.lastSmoothedPoint = smoothedPoint;

    if (!this.strokeStartPoint) {
      this.strokeStartPoint = smoothedPoint;
    }

    const effectiveTolerance = computeAdaptiveTolerance(
      currentStroke.toleranceRadius,
      this.mode,
      jitterDelta
    );

    // Check for premature Shirorekha topological violation
    const topologicalViolation = this.detectPrematureShirorekhaAttempt(
      smoothedPoint,
      currentStroke
    );
    if (topologicalViolation) {
      this.offTrackCount += 1;
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
        corridorDeviation: distanceToWaypointPolyline(smoothedPoint, currentStroke.waypoints),
        isOffTrack: true,
        topologicalViolation,
        pedagogicalHint: topologicalViolation,
        smoothedPoint,
      };
    }

    const nextWaypointIndex = this.unlockedWaypointIndex + 1;
    const targetWaypoint =
      currentStroke.waypoints[nextWaypointIndex] ??
      currentStroke.waypoints[currentStroke.waypoints.length - 1];

    const distanceToTarget = euclideanDistance(smoothedPoint, targetWaypoint);
    const corridorDeviation = distanceToWaypointPolyline(
      smoothedPoint,
      currentStroke.waypoints
    );

    const isOffTrack =
      this.unlockedWaypointIndex >= 0 &&
      corridorDeviation > effectiveTolerance * this.corridorMultiplier;

    if (isOffTrack) {
      this.offTrackCount += 1;
    } else if (this.unlockedWaypointIndex >= 0) {
      this.cumulativeDeviations.push(corridorDeviation);
    }

    // Sequential waypoint unlock check:
    // Allow unlocking the next sequential waypoint if within effectiveTolerance.
    let accepted = false;
    if (isWithinWaypointTolerance(smoothedPoint, targetWaypoint, effectiveTolerance)) {
      this.unlockedWaypointIndex = nextWaypointIndex;
      accepted = true;
    } else if (
      this.unlockedWaypointIndex >= 0 &&
      corridorDeviation <= effectiveTolerance
    ) {
      // Moving smoothly along the corridor toward the next waypoint
      accepted = true;
    }

    const strokeCompleted =
      this.unlockedWaypointIndex >= currentStroke.waypoints.length - 1;

    if (strokeCompleted) {
      this.completedStrokeIds.push(currentStroke.id);
      this.currentStrokeIndex += 1;
      this.unlockedWaypointIndex = -1;
      this.lastSmoothedPoint = null;
      this.strokeStartPoint = null;
    }

    const letterCompleted = this.currentStrokeIndex >= this.dataset.strokes.length;

    let pedagogicalHint = currentStroke.nepaliInstruction;
    if (letterCompleted) {
      pedagogicalHint = `स्याबास! '${this.dataset.character}' (${this.dataset.phonetics.nepaliName}) सफलतापूर्वक लेखियो!`;
    } else if (strokeCompleted) {
      const nextStroke = this.getCurrentStroke()!;
      pedagogicalHint = `राम्रो! अब चरण ${nextStroke.order}: ${nextStroke.nepaliInstruction}`;
    } else if (isOffTrack) {
      pedagogicalHint = `धर्को बाहिर गयो — चम्किलो थोप्ला (${nextWaypointIndex + 1}) पछ्याउनुहोस्। (Follow glowing waypoint #${nextWaypointIndex + 1})`;
    } else if (this.unlockedWaypointIndex === -1) {
      pedagogicalHint = `बिन्दु १ बाट सुरु गर्नुहोस्: ${currentStroke.nepaliInstruction}`;
    }

    return {
      accepted,
      strokeCompleted,
      letterCompleted,
      currentStrokeIndex: Math.min(
        this.currentStrokeIndex,
        this.dataset.strokes.length - 1
      ),
      currentStrokeOrder: currentStroke.order,
      unlockedWaypointIndex: this.unlockedWaypointIndex,
      totalWaypointsInStroke: currentStroke.waypoints.length,
      distanceToTargetWaypoint: Math.round(distanceToTarget * 100) / 100,
      effectiveTolerance,
      corridorDeviation: Math.round(corridorDeviation * 100) / 100,
      isOffTrack,
      topologicalViolation: null,
      pedagogicalHint,
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
      (completedWaypointsPriorStrokes + unlockedInActive) /
        Math.max(1, totalWaypointsAllStrokes)
    );

    const meanDeviation =
      this.cumulativeDeviations.length > 0
        ? this.cumulativeDeviations.reduce((a, b) => a + b, 0) /
          this.cumulativeDeviations.length
        : 0;
    const deviationPenalty = Math.min(35, meanDeviation * 0.9);
    const offTrackPenalty = Math.min(30, this.offTrackCount * 4);
    const accuracyScore = Math.max(
      40,
      Math.min(100, Math.round(100 - deviationPenalty - offTrackPenalty))
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
    };
  }
}

