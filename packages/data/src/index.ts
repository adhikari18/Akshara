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
  shirorekha: {
    enforcedLast: boolean;
    startX: number;
    endX: number;
    y: number;
  };
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
];

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

  return {
    valid: errors.length === 0,
    errors,
  };
}

