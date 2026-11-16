import type {
  LetterStrokeDataset,
  NumberEntry,
  SentenceRole,
  StrokeDefinition,
} from '@akshara/data';
import type { SentenceFeedback, TracingHint, WordFeedback } from '@akshara/core';

/**
 * User-facing copy for the message codes emitted by @akshara/core. Core stays prose-free so
 * the same engines can later serve honorific/Vibhakti coaching or other Devanagari languages;
 * every learner-visible sentence lives here.
 *
 * Each message is bilingual: `primary` is what the child reads (Nepali), `secondary` the
 * English support line shown beneath it.
 */
export interface Bilingual {
  ne: string;
  en: string;
}

/** Stroke-level context the tracing hints are phrased against. */
export interface TracingHintContext {
  dataset: LetterStrokeDataset;
  /** The stroke the learner should draw next (null once the letter is complete). */
  currentStroke: StrokeDefinition | null;
}

export function tracingHintText(hint: TracingHint, ctx: TracingHintContext): Bilingual {
  const { dataset, currentStroke } = ctx;
  const total = dataset.strokes.length;
  const step = currentStroke
    ? {
        ne: `चरण ${currentStroke.order}/${total}: ${currentStroke.nepaliInstruction}`,
        en: currentStroke.englishInstruction,
      }
    : { ne: 'अक्षर पूरा भयो!', en: 'Letter complete!' };

  switch (hint.code) {
    case 'follow-stroke':
      return step;
    case 'start-at-first-dot':
      return {
        ne: `बिन्दु १ बाट सुरु गर्नुहोस्: ${currentStroke?.nepaliInstruction ?? ''}`.trim(),
        en: `Start at dot 1. ${currentStroke?.englishInstruction ?? ''}`.trim(),
      };
    case 'stroke-complete':
      return {
        ne: `राम्रो! अब चरण ${hint.nextStrokeOrder}: ${currentStroke?.nepaliInstruction ?? ''}`.trim(),
        en: `Great! Now line ${hint.nextStrokeOrder}: ${currentStroke?.englishInstruction ?? ''}`.trim(),
      };
    case 'letter-complete':
      return {
        ne: `स्याबास! '${dataset.character}' (${dataset.phonetics.nepaliName}) सफलतापूर्वक लेखियो!`,
        en: `Well done! You wrote ${dataset.character} (${dataset.phonetics.nepaliName}).`,
      };
    case 'off-track':
      return {
        ne: `धर्को बाहिर गयो — चम्किलो थोप्ला (${hint.dot}) पछ्याउनुहोस्।`,
        en: `Off the line — follow the glowing dot ${hint.dot}.`,
      };
    case 'corner-cut':
      return {
        ne: `छोटो बाटो नलिनुहोस् — थोप्ला ${hint.backToDot} मा फर्केर घुमाउरो धर्को पछ्याउनुहोस्।`,
        en: `Don't cut the corner — go back to dot ${hint.backToDot} and follow the curved line to dot ${hint.nextDot}.`,
      };
    case 'wrong-direction': {
      const clockwise = hint.expected === 'clockwise';
      const arrow = clockwise ? '↻' : '↺';
      return {
        ne: `उल्टो दिशामा घुम्यो! औंला उठाएर थोप्ला १ बाट फेरि सुरु गर्नुहोस् — ${
          clockwise ? 'घडीको सुई घुम्ने दिशामा' : 'घडीको सुईको उल्टो दिशामा'
        } घुमाउनुहोस् ${arrow}`,
        en: `Wrong way round! Lift your finger and start again at dot 1, going ${
          clockwise ? 'clockwise' : 'anticlockwise'
        } ${arrow}`,
      };
    }
    case 'lift-over-gap':
      return {
        ne: 'शिरोरेखाको बीचमा खाली ठाउँ छ! त्यहाँ औंला उठाउनुहोस्, अनि अर्को भागबाट फेरि सुरु गर्नुहोस्।',
        en: 'The headline has a gap! Lift your finger over it, then carry on from the other side.',
      };
    case 'shirorekha-before-body':
      return {
        ne: 'शिरोरेखा (माथिको डिको) अन्त्यमा मात्र तान्नुहोस्! पहिले अक्षरको शरीर र ठाडो धर्को पूरा गर्नुहोस्।',
        en: 'Draw the letter body and stem first — the Shirorekha top bar always comes last!',
      };
  }
}

export function wordFeedbackText(feedback: WordFeedback): Bilingual {
  switch (feedback.code) {
    case 'word-instructions':
      return {
        ne: 'अक्षरका टुक्राहरू जोडेर शब्द बनाउनुहोस्।',
        en: 'Select the syllable tiles in order to build the word.',
      };
    case 'word-correct':
      return {
        ne: `स्याबास! ${feedback.phoneticBreakdown} (${feedback.meaning}) सही छ!`,
        en: `Excellent! You built '${feedback.word}' (${feedback.meaning})!`,
      };
    case 'word-wrong-order':
      return {
        ne: `क्रम मिलेन — फेरि प्रयास गर्नुहोस्! सही क्रम: ${feedback.aksharas.join(' + ')}`,
        en: `Not quite in order — try again! Target: ${feedback.phoneticBreakdown}`,
      };
    case 'word-good-start':
      return {
        ne: 'राम्रो सुरुवात! अर्को अक्षर छान्नुहोस्।',
        en: 'Good start! Pick the next akshara tile.',
      };
    case 'word-tile-mismatch':
      return {
        ne: 'यो अक्षर यहाँ मिल्दैन, अर्को अक्षर प्रयास गर्नुहोस्।',
        en: 'That tile does not match this position.',
      };
  }
}

export function sentenceFeedbackText(feedback: SentenceFeedback): Bilingual {
  switch (feedback.code) {
    case 'sentence-instructions':
      return {
        ne: 'कर्ता (Subject) + कर्म (Object) + क्रिया (Verb) मिलाएर वाक्य बनाउनुहोस्।',
        en: 'Arrange the tiles in Nepali SOV order: Subject + Object + Verb.',
      };
    case 'sentence-correct':
      return feedback.alternativeOrder
        ? {
            ne: `उत्तम! "${feedback.assembledSentence}" — यो क्रम पनि सही छ, क्रिया अन्त्यमै छ!`,
            en: `Perfect! "${feedback.assembledSentence}" is correct too — the verb is still last. (${feedback.englishTranslation})`,
          }
        : {
            ne: `उत्तम! "${feedback.nepaliSentence}" — नेपाली व्याकरण अनुसार कर्ता + कर्म + क्रिया क्रम सही छ!`,
            en: `Perfect SOV structure! "${feedback.nepaliSentence}" (${feedback.englishTranslation})`,
          };
    case 'sentence-svo-confusion':
      return {
        ne: 'ध्यान दिनुहोस्: अङ्ग्रेजीमा क्रिया (Verb) बीचमा आउँछ, तर नेपालीमा क्रिया जहिले पनि वाक्यको अन्त्यमा आउँछ! (कर्ता + कर्म + क्रिया)',
        en: 'Tip: You used English SVO order (Subject-Verb-Object). In Nepali, the Verb (क्रिया) always goes at the very end (Subject-Object-Verb)!',
      };
    case 'sentence-wrong-order':
      return {
        ne: 'वाक्यको क्रम मिलेन। पहिले कर्ता (कसले?), अनि कर्म (के/कहाँ?), र अन्त्यमा क्रिया (गर्छ) राख्नुहोस्।',
        en: 'Order mismatch: start with the Subject (कर्ता), then the Object (कर्म), and place the Verb (क्रिया) last.',
      };
  }
}

const SENTENCE_ROLE_LABELS: Record<SentenceRole, Bilingual & { emoji: string }> = {
  subject: { emoji: '🧒', ne: 'कर्ता', en: 'Who?' },
  object: { emoji: '📦', ne: 'कर्म', en: 'What?' },
  verb: { emoji: '🏃', ne: 'क्रिया', en: 'Does what?' },
  time: { emoji: '⏰', ne: 'समय', en: 'When?' },
  place: { emoji: '📍', ne: 'स्थान', en: 'Where?' },
};

/** Kid-friendly label for a sentence token's grammatical role. */
export function sentenceRoleLabel(role: SentenceRole): Bilingual & { emoji: string } {
  return SENTENCE_ROLE_LABELS[role];
}

/** Shown between the digits of a multi-digit number (e.g. after ४ in ४२). */
export function digitDoneText(nextDigit: string): Bilingual {
  return {
    ne: `राम्रो! अब ${nextDigit} लेख्नुहोस्।`,
    en: `Great! Now write ${nextDigit}.`,
  };
}

/** Celebration once every digit of a number has been traced. */
export function numberCompleteText(entry: NumberEntry): Bilingual {
  return {
    ne: `स्याबास! तपाईंले ${entry.devanagari} (${entry.nepaliName}) लेख्नुभयो!`,
    en: `Well done! You wrote ${entry.value} — ${entry.nepaliName}.`,
  };
}

/** Place value in words: 42 → "४ दश + २ एकाइ" / "4 tens + 2 ones". */
export function placeValueText(value: number, toDevanagari: (n: number) => string): Bilingual {
  if (value === 100) return { ne: '१ सय', en: '1 hundred' };
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return {
    ne: `${toDevanagari(tens)} दश + ${toDevanagari(ones)} एकाइ`,
    en: `${plural(tens, 'ten')} + ${plural(ones, 'one')}`,
  };
}
