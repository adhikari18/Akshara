import type { SentenceEntry, WordBuildingEntry } from '@akshara/data';

export interface WordTileEvaluationResult {
  correct: boolean;
  complete: boolean;
  assembledWord: string;
  targetWord: string;
  matchedIndices: boolean[];
  feedbackNepali: string;
  feedbackEnglish: string;
}

export interface SOVSentenceEvaluationResult {
  correct: boolean;
  complete: boolean;
  assembledSentence: string;
  targetSentence: string;
  detectedPattern: string;
  isSVOConfusion: boolean;
  feedbackNepali: string;
  feedbackEnglish: string;
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

  let feedbackNepali = 'अक्षरका टुक्राहरू जोडेर शब्द बनाउनुहोस्।';
  let feedbackEnglish = 'Select the syllable tiles in order to build the word.';

  if (correct) {
    feedbackNepali = `स्याबास! ${wordEntry.phoneticBreakdown} (${wordEntry.meaning}) सही छ!`;
    feedbackEnglish = `Excellent! You built '${wordEntry.word}' (${wordEntry.meaning})!`;
  } else if (complete && !correct) {
    feedbackNepali = `क्रम मिलेन — फेरि प्रयास गर्नुहोस्! सही क्रम: ${wordEntry.aksharas.join(' + ')}`;
    feedbackEnglish = `Not quite in order — try again! Target: ${wordEntry.phoneticBreakdown}`;
  } else if (selectedAksharas.length > 0) {
    const partialOk = selectedAksharas.every((ak, i) => ak === wordEntry.aksharas[i]);
    if (partialOk) {
      feedbackNepali = 'राम्रो सुरुवात! अर्को अक्षर छान्नुहोस्।';
      feedbackEnglish = 'Good start! Pick the next akshara tile.';
    } else {
      feedbackNepali = 'यो अक्षर यहाँ मिल्दैन, अर्को अक्षर प्रयास गर्नुहोस्।';
      feedbackEnglish = 'That tile does not match this position.';
    }
  }

  return {
    correct,
    complete,
    assembledWord,
    targetWord: wordEntry.word,
    matchedIndices,
    feedbackNepali,
    feedbackEnglish,
  };
}

/**
 * Evaluates a Subject-Object-Verb (SOV) sentence unscrambler attempt and detects
 * English SVO (Subject-Verb-Object) transfer errors common among diaspora learners.
 */
export function evaluateSOVSentence(
  sentence: SentenceEntry,
  selectedTokenIds: string[]
): SOVSentenceEvaluationResult {
  const tokenMap = new Map(sentence.tokens.map((t) => [t.id, t]));
  const selectedTokens = selectedTokenIds
    .map((id) => tokenMap.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  const assembledSentence = selectedTokens.map((t) => t.text).join(' ');
  const detectedPattern = selectedTokens.map((t) => t.role.toUpperCase()).join('-');
  const complete = selectedTokens.length === sentence.tokens.length;
  const correct =
    complete && selectedTokens.every((token, index) => token.id === sentence.tokens[index].id);

  // Detect English SVO interference (Subject -> Verb -> Object) instead of Nepali SOV (Subject -> Object -> Verb)
  const isSVOConfusion =
    complete &&
    selectedTokens.length === 3 &&
    selectedTokens[0].role === 'subject' &&
    selectedTokens[1].role === 'verb' &&
    selectedTokens[2].role === 'object';

  let feedbackNepali = 'कर्ता (Subject) + कर्म (Object) + क्रिया (Verb) मिलाएर वाक्य बनाउनुहोस्।';
  let feedbackEnglish = 'Arrange the tiles in Nepali SOV order: Subject + Object + Verb.';

  if (correct) {
    feedbackNepali = `उत्तम! "${sentence.nepaliSentence}" — नेपाली व्याकरण अनुसार कर्ता + कर्म + क्रिया क्रम सही छ!`;
    feedbackEnglish = `Perfect SOV structure! "${sentence.nepaliSentence}" (${sentence.englishTranslation})`;
  } else if (isSVOConfusion) {
    feedbackNepali =
      'ध्यान दिनुहोस्: अङ्ग्रेजीमा क्रिया (Verb) बीचमा आउँछ, तर नेपालीमा क्रिया जहिले पनि वाक्यको अन्त्यमा आउँछ! (कर्ता + कर्म + क्रिया)';
    feedbackEnglish =
      'Tip: You used English SVO order (Subject-Verb-Object). In Nepali, the Verb (क्रिया) always goes at the very end (Subject-Object-Verb)!';
  } else if (complete && !correct) {
    feedbackNepali = 'वाक्यको क्रम मिलेन। पहिले कर्ता (कसले?), अनि कर्म (के/कहाँ?), र अन्त्यमा क्रिया (गर्छ) राख्नुहोस्।';
    feedbackEnglish = 'Order mismatch: start with the Subject (कर्ता), then the Object (कर्म), and place the Verb (क्रिया) last.';
  }

  return {
    correct,
    complete,
    assembledSentence,
    targetSentence: sentence.nepaliSentence,
    detectedPattern,
    isSVOConfusion,
    feedbackNepali,
    feedbackEnglish,
  };
}

