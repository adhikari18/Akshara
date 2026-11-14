import { getAcceptableOrders } from '@akshara/data';
import type { SentenceEntry, SentenceToken, WordBuildingEntry } from '@akshara/data';

/**
 * Feedback for the word-tile builder, as a code plus the facts needed to phrase it. Core
 * emits no user-facing prose; the UI localizes (Nepali, English, or any future language).
 */
export type WordFeedbackCode =
  | 'word-instructions'
  | 'word-correct'
  | 'word-wrong-order'
  | 'word-good-start'
  | 'word-tile-mismatch';

export interface WordFeedback {
  code: WordFeedbackCode;
  word: string;
  meaning: string;
  phoneticBreakdown: string;
  aksharas: string[];
}

export interface WordTileEvaluationResult {
  correct: boolean;
  complete: boolean;
  assembledWord: string;
  targetWord: string;
  matchedIndices: boolean[];
  feedback: WordFeedback;
}

/** Feedback for the SOV sentence unscrambler. */
export type SentenceFeedbackCode =
  'sentence-instructions' | 'sentence-correct' | 'sentence-svo-confusion' | 'sentence-wrong-order';

export interface SentenceFeedback {
  code: SentenceFeedbackCode;
  nepaliSentence: string;
  englishTranslation: string;
  /** What the learner actually built (may be a valid alternative to `nepaliSentence`). */
  assembledSentence: string;
  /** Correct, but in one of the sentence's alternative orders rather than the canonical one. */
  alternativeOrder: boolean;
}

export interface SOVSentenceEvaluationResult {
  correct: boolean;
  complete: boolean;
  assembledSentence: string;
  targetSentence: string;
  detectedPattern: string;
  isSVOConfusion: boolean;
  /** Index into `getAcceptableOrders(sentence)` that matched (0 = canonical), or -1. */
  matchedOrderIndex: number;
  feedback: SentenceFeedback;
}

/**
 * Evaluates a learner's selected akshara tile sequence against a 2- or 3-letter target noun.
 */
export function evaluateWordTiles(
  wordEntry: WordBuildingEntry,
  selectedAksharas: string[]
): WordTileEvaluationResult {
  const assembledWord = selectedAksharas.join('');
  const complete = selectedAksharas.length === wordEntry.aksharas.length;
  const matchedIndices = wordEntry.aksharas.map((target, idx) => selectedAksharas[idx] === target);
  const correct = complete && matchedIndices.every(Boolean);

  let code: WordFeedbackCode = 'word-instructions';
  if (correct) {
    code = 'word-correct';
  } else if (complete) {
    code = 'word-wrong-order';
  } else if (selectedAksharas.length > 0) {
    const partialOk = selectedAksharas.every((ak, i) => ak === wordEntry.aksharas[i]);
    code = partialOk ? 'word-good-start' : 'word-tile-mismatch';
  }

  return {
    correct,
    complete,
    assembledWord,
    targetWord: wordEntry.word,
    matchedIndices,
    feedback: {
      code,
      word: wordEntry.word,
      meaning: wordEntry.meaning,
      phoneticBreakdown: wordEntry.phoneticBreakdown,
      aksharas: [...wordEntry.aksharas],
    },
  };
}

const sameOrder = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * Evaluates a sentence unscrambler attempt against every acceptable order of the sentence
 * (any number of tokens), and detects English SVO transfer errors: the learner got everything
 * right except that the verb is not at the end.
 */
export function evaluateSOVSentence(
  sentence: SentenceEntry,
  selectedTokenIds: string[]
): SOVSentenceEvaluationResult {
  const tokenMap = new Map(sentence.tokens.map((t) => [t.id, t]));
  const selectedTokens = selectedTokenIds
    .map((id) => tokenMap.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
  const selectedIds = selectedTokens.map((t) => t.id);

  const assembledSentence = selectedTokens.map((t) => t.text).join(' ');
  const detectedPattern = selectedTokens.map((t) => t.role.toUpperCase()).join('-');
  const complete = selectedTokens.length === sentence.tokens.length;

  const orders = getAcceptableOrders(sentence);
  const matchedOrderIndex = complete ? orders.findIndex((o) => sameOrder(o, selectedIds)) : -1;
  const correct = matchedOrderIndex !== -1;

  // English SVO interference: the verb sits before the end, and moving it to the end would give
  // an acceptable order — i.e. the verb placement is the *only* mistake.
  const verbId = sentence.tokens.find((t) => t.role === 'verb')?.id;
  const verbIndex = verbId ? selectedIds.indexOf(verbId) : -1;
  const withoutVerb = (ids: readonly string[]) => ids.filter((id) => id !== verbId);
  const isSVOConfusion =
    complete &&
    !correct &&
    verbIndex !== -1 &&
    verbIndex < selectedIds.length - 1 &&
    orders.some((o) => sameOrder(withoutVerb(o), withoutVerb(selectedIds)));

  let code: SentenceFeedbackCode = 'sentence-instructions';
  if (correct) {
    code = 'sentence-correct';
  } else if (isSVOConfusion) {
    code = 'sentence-svo-confusion';
  } else if (complete) {
    code = 'sentence-wrong-order';
  }

  return {
    correct,
    complete,
    assembledSentence,
    targetSentence: sentence.nepaliSentence,
    detectedPattern,
    isSVOConfusion,
    matchedOrderIndex,
    feedback: {
      code,
      nepaliSentence: sentence.nepaliSentence,
      englishTranslation: sentence.englishTranslation,
      assembledSentence,
      alternativeOrder: matchedOrderIndex > 0,
    },
  };
}

/**
 * Deterministic scrambled presentation of a sentence's tokens that is guaranteed *not* to be
 * an acceptable order. Prefers the English-like order (verb moved right after the subject) so
 * the learner practises undoing SVO transfer; falls back to reversal, then rotations.
 */
export function scrambleSentenceTokens(sentence: SentenceEntry): SentenceToken[] {
  const canonical = sentence.tokens;
  const orders = getAcceptableOrders(sentence);
  const acceptable = (tokens: SentenceToken[]) =>
    orders.some((o) =>
      sameOrder(
        o,
        tokens.map((t) => t.id)
      )
    );

  const candidates: SentenceToken[][] = [];
  const verb = canonical.find((t) => t.role === 'verb');
  const subjectIndex = canonical.findIndex((t) => t.role === 'subject');
  if (verb && subjectIndex !== -1) {
    const rest = canonical.filter((t) => t !== verb);
    const at = rest.indexOf(canonical[subjectIndex]!) + 1;
    candidates.push([...rest.slice(0, at), verb, ...rest.slice(at)]);
  }
  candidates.push([...canonical].reverse());
  for (let shift = 1; shift < canonical.length; shift++) {
    candidates.push([...canonical.slice(shift), ...canonical.slice(0, shift)]);
  }
  return candidates.find((c) => !acceptable(c)) ?? [...canonical].reverse();
}
