import letterSchema from '../schema/letter.schema.json' with { type: 'json' };
import vowelsData from '../vowels.json' with { type: 'json' };
import consonantsData from '../consonants.json' with { type: 'json' };
import wordsData from '../words.json' with { type: 'json' };
import sentencesData from '../sentences.json' with { type: 'json' };

import strokeKa from '../strokes/ka.json' with { type: 'json' };
import strokeKha from '../strokes/kha.json' with { type: 'json' };
import strokeGa from '../strokes/ga.json' with { type: 'json' };
import strokeGha from '../strokes/gha.json' with { type: 'json' };
import strokeA from '../strokes/a.json' with { type: 'json' };
import strokeAa from '../strokes/aa.json' with { type: 'json' };
import strokeI from '../strokes/i.json' with { type: 'json' };
import strokeIi from '../strokes/ii.json' with { type: 'json' };
import strokeU from '../strokes/u.json' with { type: 'json' };
import strokeUu from '../strokes/uu.json' with { type: 'json' };
import strokeRi from '../strokes/ri.json' with { type: 'json' };
import strokeE from '../strokes/e.json' with { type: 'json' };
import strokeAi from '../strokes/ai.json' with { type: 'json' };
import strokeO from '../strokes/o.json' with { type: 'json' };
import strokeAu from '../strokes/au.json' with { type: 'json' };
import strokeAm from '../strokes/am.json' with { type: 'json' };
import strokeAha from '../strokes/aha.json' with { type: 'json' };

export type StrokeTopologyType = 'loop' | 'curve' | 'diagonal' | 'stem' | 'shirorekha';

export type DirectionHint =
  | 'counter-clockwise-loop'
  | 'clockwise-loop'
  | 'top-to-bottom'
  | 'left-to-right'
  | 'down-and-right-curve'
  | 'diagonal-down-right'
  | 'diagonal-down-left';

export interface WaypointDefinition {
  index: number;
  x: number;
  y: number;
  label?: string;
}

export interface StrokeDefinition {
  id: string;
  order: number;
  type: StrokeTopologyType;
  label: string;
  nepaliInstruction: string;
  englishInstruction: string;
  svgPath: string;
  directionHint: DirectionHint;
  toleranceRadius: number;
  waypoints: WaypointDefinition[];
}

/** A single continuous horizontal span of the Shirorekha headline. */
export interface ShirorekhaSegment {
  startX: number;
  endX: number;
}

export interface ShirorekhaDefinition {
  enforcedLast: boolean;
  /** Left-most X of the headline (start of the first segment when split). */
  startX: number;
  /** Right-most X of the headline (end of the last segment when split). */
  endX: number;
  y: number;
  /**
   * Optional split headline spans, ordered left to right. Letters with an open
   * upper-left loop (ख, ग, ण, थ, ध, भ, श) leave a gap in the Shirorekha.
   * When omitted, the headline is one continuous bar from startX to endX.
   */
  segments?: ShirorekhaSegment[];
}

export interface LetterStrokeDataset {
  id: string;
  character: string;
  unicode: string;
  category: 'swor' | 'vyanjan' | 'samyukta';
  varga?: string;
  phonetics: {
    romanized: string;
    ipa: string;
    nepaliName: string;
    audioPrompt: string;
    articulationTip: string;
  };
  viewBox: {
    width: number;
    height: number;
    shirorekhaY: number;
    baselineY: number;
  };
  shirorekha: ShirorekhaDefinition;
  strokes: StrokeDefinition[];
  vocabulary: Array<{
    word: string;
    romanized: string;
    meaning: string;
    emoji: string;
  }>;
}

export interface VowelEntry {
  id: string;
  order: number;
  character: string;
  unicode: string;
  romanized: string;
  ipa: string;
  nepaliName: string;
  matra: string | null;
  matraName: string;
  matraUnicode: string | null;
  matraPosition: 'inherent' | 'left' | 'right' | 'top' | 'bottom';
  sampleWord: string;
  sampleWordRomanized: string;
  sampleWordMeaning: string;
  emoji: string;
  hasStrokeData: boolean;
}

export interface ConsonantEntry {
  id: string;
  order: number;
  character: string;
  unicode: string;
  romanized: string;
  ipa: string;
  nepaliName: string;
  varga: string;
  sampleWord: string;
  sampleWordRomanized: string;
  sampleWordMeaning: string;
  emoji: string;
  hasStrokeData: boolean;
}

export interface WordBuildingEntry {
  id: string;
  word: string;
  romanized: string;
  meaning: string;
  emoji: string;
  syllableCount: number;
  difficulty: 'beginner' | 'intermediate';
  aksharas: string[];
  distractors: string[];
  phoneticBreakdown: string;
}

export interface SentenceToken {
  id: string;
  text: string;
  romanized: string;
  gloss: string;
  role: 'subject' | 'object' | 'verb';
  nepaliRole: string;
}

export interface SentenceEntry {
  id: string;
  nepaliSentence: string;
  romanized: string;
  englishTranslation: string;
  englishOrder: string;
  nepaliOrder: string;
  emoji: string;
  tokens: SentenceToken[];
}

export const LETTER_SCHEMA = letterSchema;
export const VOWELS: VowelEntry[] = vowelsData as VowelEntry[];
export const CONSONANTS: ConsonantEntry[] = consonantsData as ConsonantEntry[];
export const WORDS: WordBuildingEntry[] = wordsData as WordBuildingEntry[];
export const SENTENCES: SentenceEntry[] = sentencesData as SentenceEntry[];

export const STROKE_DATASETS: Record<string, LetterStrokeDataset> = {
  ka: strokeKa as LetterStrokeDataset,
  kha: strokeKha as LetterStrokeDataset,
  ga: strokeGa as LetterStrokeDataset,
  gha: strokeGha as LetterStrokeDataset,
  a: strokeA as LetterStrokeDataset,
  aa: strokeAa as LetterStrokeDataset,
  i: strokeI as LetterStrokeDataset,
  ii: strokeIi as LetterStrokeDataset,
  u: strokeU as LetterStrokeDataset,
  uu: strokeUu as LetterStrokeDataset,
  ri: strokeRi as LetterStrokeDataset,
  e: strokeE as LetterStrokeDataset,
  ai: strokeAi as LetterStrokeDataset,
  o: strokeO as LetterStrokeDataset,
  au: strokeAu as LetterStrokeDataset,
  am: strokeAm as LetterStrokeDataset,
  aha: strokeAha as LetterStrokeDataset,
};

export const STROKE_LIST: LetterStrokeDataset[] = [
  STROKE_DATASETS.ka,
  STROKE_DATASETS.kha,
  STROKE_DATASETS.ga,
  STROKE_DATASETS.gha,
  STROKE_DATASETS.a,
  STROKE_DATASETS.aa,
  STROKE_DATASETS.i,
  STROKE_DATASETS.ii,
  STROKE_DATASETS.u,
  STROKE_DATASETS.uu,
  STROKE_DATASETS.ri,
  STROKE_DATASETS.e,
  STROKE_DATASETS.ai,
  STROKE_DATASETS.o,
  STROKE_DATASETS.au,
  STROKE_DATASETS.am,
  STROKE_DATASETS.aha,
];

/**
 * Returns the headline spans for a letter: the explicit split segments when
 * present, otherwise a single span from startX to endX.
 */
export function getShirorekhaSegments(dataset: Pick<LetterStrokeDataset, 'shirorekha'>): ShirorekhaSegment[] {
  const { shirorekha } = dataset;
  if (shirorekha.segments && shirorekha.segments.length > 0) {
    return shirorekha.segments.map((s) => ({ startX: s.startX, endX: s.endX }));
  }
  return [{ startX: shirorekha.startX, endX: shirorekha.endX }];
}

/** True when the letter's Shirorekha is split into two or more spans with gaps. */
export function hasSplitShirorekha(dataset: Pick<LetterStrokeDataset, 'shirorekha'>): boolean {
  return (dataset.shirorekha.segments?.length ?? 0) > 1;
}

export interface DatasetValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a LetterStrokeDataset against Devanagari topological invariants:
 * 1. Canonical 300x300 viewBox dimensions.
 * 2. Sequential 1-based stroke ordering and 0-based waypoint indexing.
 * 3. Topological rule: loop/curve/diagonal body components come before stems,
 *    and the horizontal Shirorekha bar is strictly the final stroke.
 */
export function validateLetterDataset(dataset: LetterStrokeDataset): DatasetValidationResult {
  const errors: string[] = [];

  if (!dataset.id || !dataset.character) {
    errors.push('Missing required letter id or character.');
  }
  if (dataset.viewBox.width !== 300 || dataset.viewBox.height !== 300) {
    errors.push(`Invalid viewBox (${dataset.viewBox.width}x${dataset.viewBox.height}); expected 300x300.`);
  }
  if (!dataset.shirorekha.enforcedLast) {
    errors.push(`Letter '${dataset.id}' must enforce shirorekha.enforcedLast = true.`);
  }
  if (dataset.strokes.length < 2) {
    errors.push(`Letter '${dataset.id}' must define at least 2 strokes.`);
  }

  let seenStem = false;
  let lastStemX = -Infinity;
  dataset.strokes.forEach((stroke, idx) => {
    const expectedOrder = idx + 1;
    if (stroke.order !== expectedOrder) {
      errors.push(`Stroke '${stroke.id}' has order ${stroke.order}, expected ${expectedOrder}.`);
    }
    if (stroke.waypoints.length < 3) {
      errors.push(`Stroke '${stroke.id}' must define at least 3 waypoints.`);
    }
    stroke.waypoints.forEach((wp, wpIdx) => {
      if (wp.index !== wpIdx) {
        errors.push(`Stroke '${stroke.id}' waypoint ${wpIdx} has mismatched index ${wp.index}.`);
      }
      if (wp.x < 0 || wp.x > 300 || wp.y < 0 || wp.y > 300) {
        errors.push(`Stroke '${stroke.id}' waypoint ${wpIdx} (${wp.x}, ${wp.y}) out of 300x300 bounds.`);
      }
    });

    const isLastStroke = idx === dataset.strokes.length - 1;
    if (stroke.type === 'shirorekha' && !isLastStroke) {
      errors.push(
        `Topological violation in '${dataset.id}': Shirorekha stroke '${stroke.id}' appears at step ${stroke.order} instead of the final stroke.`
      );
    }
    if (isLastStroke && stroke.type !== 'shirorekha') {
      errors.push(
        `Topological violation in '${dataset.id}': Final stroke '${stroke.id}' has type '${stroke.type}' instead of 'shirorekha'.`
      );
    }
    if (stroke.type === 'stem') {
      seenStem = true;
      lastStemX = Math.max(lastStemX, ...stroke.waypoints.map((w) => w.x));
    }
    if ((stroke.type === 'loop' || stroke.type === 'curve' || stroke.type === 'diagonal') && seenStem) {
      const isUpperCrownMark = stroke.waypoints.every(
        (wp) => wp.y <= dataset.viewBox.shirorekhaY + 4
      );
      const isRightPostStemMark = stroke.waypoints.every((wp) => wp.x > lastStemX);
      if (!isUpperCrownMark && !isRightPostStemMark) {
        errors.push(
          `Topological violation in '${dataset.id}': Body stroke '${stroke.id}' (${stroke.type}) appears after vertical stem.`
        );
      }
    }
  });

  errors.push(...validateShirorekhaGeometry(dataset));

  return {
    valid: errors.length === 0,
    errors,
  };
}

/** Minimum horizontal gap (coordinate units) between split Shirorekha segments. */
export const MIN_SHIROREKHA_GAP = 8;
/** Allowed slack (coordinate units) when matching waypoints to headline spans. */
const SHIROREKHA_EPSILON = 2;

/**
 * Validates the Shirorekha headline geometry, including split/partial spans:
 * 1. Each segment has startX < endX, segments are ordered left to right and
 *    separated by a visible gap of at least MIN_SHIROREKHA_GAP units.
 * 2. Segments exactly cover the declared startX / endX extent.
 * 3. The Shirorekha stroke's svgPath has one subpath (M ...) per segment.
 * 4. Every Shirorekha waypoint lies on the headline Y and within a segment,
 *    and (for split headlines) every segment starts and ends on a waypoint.
 */
export function validateShirorekhaGeometry(dataset: LetterStrokeDataset): string[] {
  const errors: string[] = [];
  const { shirorekha } = dataset;
  const id = dataset.id;

  if (shirorekha.startX >= shirorekha.endX) {
    errors.push(`Letter '${id}' shirorekha startX (${shirorekha.startX}) must be less than endX (${shirorekha.endX}).`);
  }

  const segments = getShirorekhaSegments(dataset);
  if (shirorekha.segments) {
    if (shirorekha.segments.length < 2) {
      errors.push(`Letter '${id}' shirorekha.segments must contain at least 2 spans; omit it for a continuous bar.`);
    }
    segments.forEach((seg, i) => {
      if (seg.startX >= seg.endX) {
        errors.push(`Letter '${id}' shirorekha segment ${i} has startX (${seg.startX}) >= endX (${seg.endX}).`);
      }
      const prev = segments[i - 1];
      if (prev && seg.startX - prev.endX < MIN_SHIROREKHA_GAP) {
        errors.push(
          `Letter '${id}' shirorekha segments ${i - 1} and ${i} must be ordered with a gap of at least ${MIN_SHIROREKHA_GAP} units (got ${seg.startX - prev.endX}).`
        );
      }
    });
    const first = segments[0];
    const last = segments[segments.length - 1];
    if (first && first.startX !== shirorekha.startX) {
      errors.push(`Letter '${id}' first shirorekha segment must start at shirorekha.startX (${shirorekha.startX}).`);
    }
    if (last && last.endX !== shirorekha.endX) {
      errors.push(`Letter '${id}' last shirorekha segment must end at shirorekha.endX (${shirorekha.endX}).`);
    }
  }

  const stroke = dataset.strokes[dataset.strokes.length - 1];
  if (!stroke || stroke.type !== 'shirorekha') {
    return errors;
  }

  const subpaths = (stroke.svgPath.match(/[Mm]/g) ?? []).length;
  if (subpaths !== segments.length) {
    errors.push(
      `Shirorekha stroke '${stroke.id}' has ${subpaths} subpath(s) but the headline defines ${segments.length} segment(s).`
    );
  }

  const inSegment = (x: number) =>
    segments.some((s) => x >= s.startX - SHIROREKHA_EPSILON && x <= s.endX + SHIROREKHA_EPSILON);
  stroke.waypoints.forEach((wp) => {
    if (Math.abs(wp.y - shirorekha.y) > SHIROREKHA_EPSILON) {
      errors.push(`Shirorekha stroke '${stroke.id}' waypoint ${wp.index} (y=${wp.y}) is off the headline y=${shirorekha.y}.`);
    }
    if (!inSegment(wp.x)) {
      errors.push(`Shirorekha stroke '${stroke.id}' waypoint ${wp.index} (x=${wp.x}) falls outside every headline segment.`);
    }
  });

  if (segments.length > 1) {
    const hasWaypointAt = (x: number) => stroke.waypoints.some((wp) => Math.abs(wp.x - x) <= SHIROREKHA_EPSILON);
    segments.forEach((seg, i) => {
      if (!hasWaypointAt(seg.startX) || !hasWaypointAt(seg.endX)) {
        errors.push(`Shirorekha stroke '${stroke.id}' must place waypoints at both ends of segment ${i} (${seg.startX}–${seg.endX}).`);
      }
    });
  }

  return errors;
}

