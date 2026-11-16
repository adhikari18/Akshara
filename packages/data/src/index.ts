import letterSchema from '../schema/letter.schema.json' with { type: 'json' };
import vowelsData from '../vowels.json' with { type: 'json' };
import consonantsData from '../consonants.json' with { type: 'json' };
import wordsData from '../words.json' with { type: 'json' };
import sentencesData from '../sentences.json' with { type: 'json' };
import numbersData from '../numbers.json' with { type: 'json' };

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
   * Optional split headline spans, ordered left to right. Letters whose upper-left
   * element is detached from the headline (e.g. ध) leave a gap in the Shirorekha;
   * letters whose headline merely stops short (e.g. थ, भ) just use a partial startX/endX.
   * When omitted, the headline is one continuous bar from startX to endX.
   */
  segments?: ShirorekhaSegment[];
}

export interface LetterStrokeDataset {
  id: string;
  character: string;
  unicode: string;
  /** 'numeral' = Devanagari digit (अङ्क ० – ९), written without a Shirorekha. */
  category: 'swor' | 'vyanjan' | 'samyukta' | 'numeral';
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
  /** The headline bar. Present for every letter; absent for numerals, which have none. */
  shirorekha?: ShirorekhaDefinition;
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

/**
 * Grammatical role of a sentence token. Time and place adverbials may move within a Nepali
 * clause (आज म स्कुल जान्छु / म आज स्कुल जान्छु); the verb stays final.
 */
export type SentenceRole = 'subject' | 'object' | 'verb' | 'time' | 'place';

export interface SentenceToken {
  id: string;
  text: string;
  romanized: string;
  gloss: string;
  role: SentenceRole;
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
  /** Tokens in the canonical (taught) order. The canonical order is always acceptable. */
  tokens: SentenceToken[];
  /**
   * Further grammatical orders, as token-id sequences (e.g. a fronted time adverbial).
   * Every order must be a permutation of `tokens` and keep the verb last.
   */
  acceptableOrders?: string[][];
}

export const LETTER_SCHEMA = letterSchema;
export const VOWELS: VowelEntry[] = vowelsData as VowelEntry[];
export const CONSONANTS: ConsonantEntry[] = consonantsData as ConsonantEntry[];
export const WORDS: WordBuildingEntry[] = wordsData as WordBuildingEntry[];
export const SENTENCES: SentenceEntry[] = sentencesData as SentenceEntry[];

/** A whole number with its Devanagari numerals and Nepali name (e.g. 42 → ४२, बयालीस). */
export interface NumberEntry {
  value: number;
  /** The number written in Devanagari digits. */
  devanagari: string;
  /** The Nepali number word. Names from 11 to 99 are irregular and must be learnt, not derived. */
  nepaliName: string;
  /** A common alternative name (e.g. सुन्ना for शून्य). */
  alsoCalled?: string;
}

/** Nepali numbers 0 – 100, indexed by value (`NUMBERS[42].nepaliName === 'बयालीस'`). */
export const NUMBERS: NumberEntry[] = numbersData as NumberEntry[];

const DEVANAGARI_DIGITS = '०१२३४५६७८९';

/** Write a non-negative integer in Devanagari numerals: 42 → '४२'. */
export function toDevanagariNumerals(value: number): string {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Expected a non-negative integer, got ${value}`);
  }
  return String(value)
    .split('')
    .map((d) => DEVANAGARI_DIGITS[Number(d)])
    .join('');
}

/** The digits of a non-negative integer, most significant first: 42 → [4, 2]. */
export function digitsOf(value: number): number[] {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Expected a non-negative integer, got ${value}`);
  }
  return String(value).split('').map(Number);
}

/** Structural checks for the numbers table: 0 – 100 in order, correct numerals, unique names. */
export function validateNumbers(entries: NumberEntry[] = NUMBERS): string[] {
  const errors: string[] = [];
  if (entries.length !== 101)
    errors.push(`expected 101 entries (0 – 100), found ${entries.length}`);
  const names = new Set<string>();
  entries.forEach((entry, idx) => {
    if (entry.value !== idx) errors.push(`entry ${idx} has value ${entry.value}`);
    else if (entry.devanagari !== toDevanagariNumerals(idx)) {
      errors.push(
        `${idx} is written '${entry.devanagari}', expected '${toDevanagariNumerals(idx)}'`
      );
    }
    if (!entry.nepaliName.trim()) errors.push(`${idx} has no Nepali name`);
    else if (names.has(entry.nepaliName)) errors.push(`name '${entry.nepaliName}' is used twice`);
    names.add(entry.nepaliName);
  });
  return errors;
}

/** Every acceptable token-id order for a sentence, canonical order first. */
export function getAcceptableOrders(sentence: SentenceEntry): string[][] {
  return [sentence.tokens.map((t) => t.id), ...(sentence.acceptableOrders ?? [])];
}

/**
 * Structural checks for a sentence challenge: unique token ids, exactly one verb, and every
 * acceptable order a distinct, verb-final permutation of the tokens. Returns error messages.
 */
export function validateSentenceEntry(sentence: SentenceEntry): string[] {
  const errors: string[] = [];
  const ids = sentence.tokens.map((t) => t.id);
  const idSet = new Set(ids);
  if (sentence.tokens.length < 2) errors.push('needs at least 2 tokens');
  if (idSet.size !== ids.length) errors.push('token ids must be unique');
  const verbs = sentence.tokens.filter((t) => t.role === 'verb');
  if (verbs.length !== 1) errors.push(`needs exactly one verb token (found ${verbs.length})`);
  const verbId = verbs[0]?.id;

  const seen = new Set<string>();
  getAcceptableOrders(sentence).forEach((order, idx) => {
    const label = idx === 0 ? 'canonical order' : `acceptableOrders[${idx - 1}]`;
    const isPermutation =
      order.length === ids.length &&
      order.every((id) => idSet.has(id)) &&
      new Set(order).size === order.length;
    if (!isPermutation) {
      errors.push(`${label} must use every token id exactly once`);
      return;
    }
    if (verbId && order[order.length - 1] !== verbId) {
      errors.push(`${label} must end with the verb (Nepali is verb-final)`);
    }
    const key = order.join(' ');
    if (seen.has(key)) errors.push(`${label} duplicates an earlier order`);
    seen.add(key);
  });
  return errors;
}

// Letter stroke datasets are registered in stroke-manifest.json; the import list, keyed record
// and ordered list are generated into strokes.generated.ts (see scripts/generate-stroke-index.mjs).
export {
  NUMERAL_DATASETS,
  NUMERAL_LIST,
  NUMERAL_ORDER,
  STROKE_DATASETS,
  STROKE_LIST,
  STROKE_ORDER,
} from './strokes.generated.js';

/**
 * Returns the headline spans for a letter: the explicit split segments when
 * present, otherwise a single span from startX to endX.
 */
export function getShirorekhaSegments(
  dataset: Pick<LetterStrokeDataset, 'shirorekha'>
): ShirorekhaSegment[] {
  const { shirorekha } = dataset;
  if (!shirorekha) return [];
  if (shirorekha.segments && shirorekha.segments.length > 0) {
    return shirorekha.segments.map((s) => ({ startX: s.startX, endX: s.endX }));
  }
  return [{ startX: shirorekha.startX, endX: shirorekha.endX }];
}

/** True when the letter's Shirorekha is split into two or more spans with gaps. */
export function hasSplitShirorekha(dataset: Pick<LetterStrokeDataset, 'shirorekha'>): boolean {
  return (dataset.shirorekha?.segments?.length ?? 0) > 1;
}

export const TOPOLOGY_PRIORITY: Record<StrokeTopologyType, number> = {
  loop: 1,
  curve: 1,
  diagonal: 1,
  stem: 2,
  shirorekha: 3,
};

/**
 * Enforces the Devanagari topological stroke order invariant:
 * 1. Loop / curve / diagonal body strokes must come first (priority 1).
 * 2. Vertical stems (Khadi Pai) come second (priority 2).
 * 3. Horizontal Shirorekha top bar must strictly be the final stroke (priority 3).
 *
 * Body strokes drawn after a stem are allowed only as upper-crown marks (at or
 * above the headline) or marks entirely to the right of the last stem.
 * `headlineY` defaults to the Shirorekha stroke's first waypoint (or 75).
 */
export function validateStrokeTopology(
  strokes: StrokeDefinition[],
  headlineY?: number,
  options: {
    /**
     * Letters must end with the Shirorekha (default). Numerals have no headline, so for them
     * a single stroke is fine and no stroke may be a Shirorekha.
     */
    requireShirorekha?: boolean;
  } = {}
): {
  valid: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  const requireShirorekha = options.requireShirorekha ?? true;

  if (strokes.length < (requireShirorekha ? 2 : 1)) {
    violations.push(
      requireShirorekha
        ? 'A Devanagari character definition must contain at least 2 strokes.'
        : 'A numeral definition must contain at least 1 stroke.'
    );
    return { valid: false, violations };
  }

  let maxPrioritySeen = 0;
  let lastStemX = -Infinity;
  const shirorekhaStroke = strokes[strokes.length - 1];
  const resolvedHeadlineY =
    headlineY ??
    (shirorekhaStroke?.type === 'shirorekha' && shirorekhaStroke.waypoints.length > 0
      ? shirorekhaStroke.waypoints[0].y
      : 75);

  strokes.forEach((stroke, index) => {
    let priority = TOPOLOGY_PRIORITY[stroke.type];
    const isLast = index === strokes.length - 1;

    if (stroke.type === 'stem') {
      lastStemX = Math.max(lastStemX, ...stroke.waypoints.map((w) => w.x));
    } else if (
      maxPrioritySeen === 2 &&
      (stroke.type === 'loop' || stroke.type === 'curve' || stroke.type === 'diagonal')
    ) {
      const isUpperCrownMark = stroke.waypoints.every((wp) => wp.y <= resolvedHeadlineY + 4);
      const isRightPostStemMark =
        stroke.waypoints.every((wp) => wp.x >= lastStemX) &&
        stroke.waypoints.some((wp) => wp.x > lastStemX);
      if (isUpperCrownMark || isRightPostStemMark) {
        priority = 2;
      }
    }

    if (priority < maxPrioritySeen) {
      violations.push(
        `Stroke ${stroke.order} ('${stroke.id}', type '${stroke.type}') violates Devanagari topological order by appearing after a higher-priority stroke stage.`
      );
    }
    if (!requireShirorekha && stroke.type === 'shirorekha') {
      violations.push(
        `Stroke ${stroke.order} ('${stroke.id}') is a Shirorekha, but numerals are written without one.`
      );
    } else if (stroke.type === 'shirorekha' && !isLast) {
      violations.push(
        `Stroke ${stroke.order} ('${stroke.id}') is a Shirorekha top bar but is not the final stroke.`
      );
    }
    if (requireShirorekha && isLast && stroke.type !== 'shirorekha') {
      violations.push(
        `Final stroke ${stroke.order} ('${stroke.id}') has type '${stroke.type}'; the Shirorekha top bar must be strictly last.`
      );
    }

    if (priority > maxPrioritySeen) {
      maxPrioritySeen = priority;
    }
  });

  return {
    valid: violations.length === 0,
    violations,
  };
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
    errors.push(
      `Invalid viewBox (${dataset.viewBox.width}x${dataset.viewBox.height}); expected 300x300.`
    );
  }
  const isNumeral = dataset.category === 'numeral';
  if (isNumeral) {
    if (dataset.shirorekha) {
      errors.push(
        `Numeral '${dataset.id}' must not define a shirorekha (numerals have no headline).`
      );
    }
  } else if (!dataset.shirorekha) {
    errors.push(`Letter '${dataset.id}' must define a shirorekha.`);
  } else if (!dataset.shirorekha.enforcedLast) {
    errors.push(`Letter '${dataset.id}' must enforce shirorekha.enforcedLast = true.`);
  }

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
        errors.push(
          `Stroke '${stroke.id}' waypoint ${wpIdx} (${wp.x}, ${wp.y}) out of 300x300 bounds.`
        );
      }
    });
  });

  const topology = validateStrokeTopology(dataset.strokes, dataset.viewBox.shirorekhaY, {
    requireShirorekha: !isNumeral,
  });
  errors.push(...topology.violations.map((v) => `Topological violation in '${dataset.id}': ${v}`));
  if (!isNumeral) errors.push(...validateShirorekhaGeometry(dataset));

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
  if (!shirorekha) {
    return dataset.category === 'numeral' ? [] : [`Letter '${id}' must define a shirorekha.`];
  }

  if (shirorekha.startX >= shirorekha.endX) {
    errors.push(
      `Letter '${id}' shirorekha startX (${shirorekha.startX}) must be less than endX (${shirorekha.endX}).`
    );
  }

  const segments = getShirorekhaSegments(dataset);
  if (shirorekha.segments) {
    if (shirorekha.segments.length < 2) {
      errors.push(
        `Letter '${id}' shirorekha.segments must contain at least 2 spans; omit it for a continuous bar.`
      );
    }
    segments.forEach((seg, i) => {
      if (seg.startX >= seg.endX) {
        errors.push(
          `Letter '${id}' shirorekha segment ${i} has startX (${seg.startX}) >= endX (${seg.endX}).`
        );
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
      errors.push(
        `Letter '${id}' first shirorekha segment must start at shirorekha.startX (${shirorekha.startX}).`
      );
    }
    if (last && last.endX !== shirorekha.endX) {
      errors.push(
        `Letter '${id}' last shirorekha segment must end at shirorekha.endX (${shirorekha.endX}).`
      );
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
      errors.push(
        `Shirorekha stroke '${stroke.id}' waypoint ${wp.index} (y=${wp.y}) is off the headline y=${shirorekha.y}.`
      );
    }
    if (!inSegment(wp.x)) {
      errors.push(
        `Shirorekha stroke '${stroke.id}' waypoint ${wp.index} (x=${wp.x}) falls outside every headline segment.`
      );
    }
  });

  if (segments.length > 1) {
    const hasWaypointAt = (x: number) =>
      stroke.waypoints.some((wp) => Math.abs(wp.x - x) <= SHIROREKHA_EPSILON);
    segments.forEach((seg, i) => {
      if (!hasWaypointAt(seg.startX) || !hasWaypointAt(seg.endX)) {
        errors.push(
          `Shirorekha stroke '${stroke.id}' must place waypoints at both ends of segment ${i} (${seg.startX}–${seg.endX}).`
        );
      }
    });
  }

  return errors;
}
