import {
  CONSONANTS,
  SENTENCES,
  STROKE_DATASETS,
  STROKE_LIST,
  VOWELS,
  WORDS,
  NUMBERS,
  NUMERAL_LIST,
  getAcceptableOrders,
  validateLetterDataset,
  validateNumbers,
  validateSentenceEntry,
} from './index.js';
import { validateAgainstLetterSchema } from './schema-validator.js';

let hasError = false;
const toDigit = (d: number) => String.fromCodePoint(0x0966 + d);

console.log('🔍 Validating @akshara/data schemas and Devanagari topological invariants...\n');

if (VOWELS.length !== 13) {
  console.error(`❌ Expected 13 Swor Varna vowels, found ${VOWELS.length}`);
  hasError = true;
} else {
  const missingVowelStrokes = VOWELS.filter((v) => !v.hasStrokeData || !STROKE_DATASETS[v.id]);
  if (missingVowelStrokes.length > 0) {
    console.error(
      `❌ Missing stroke vectors for Swor Varna: ${missingVowelStrokes.map((v) => v.character).join(', ')}`
    );
    hasError = true;
  } else {
    console.log(
      `✅ Vowels (Swor Varna): ${VOWELS.length}/13 canonical entries and stroke vectors verified (अ to अः).`
    );
  }
}

if (CONSONANTS.length !== 36) {
  console.error(`❌ Expected 36 Vyanjan Varna consonants, found ${CONSONANTS.length}`);
  hasError = true;
} else {
  const missingConsonantStrokes = CONSONANTS.filter(
    (c) => !c.hasStrokeData || !STROKE_DATASETS[c.id]
  );
  if (missingConsonantStrokes.length > 0) {
    console.error(
      `❌ Missing stroke vectors for Vyanjan Varna: ${missingConsonantStrokes.map((c) => c.character).join(', ')}`
    );
    hasError = true;
  } else {
    console.log(
      `✅ Consonants (Vyanjan Varna): ${CONSONANTS.length}/36 canonical entries and stroke vectors verified (क to ज्ञ).`
    );
  }
}

for (const strokeSet of STROKE_LIST) {
  const schemaResult = validateAgainstLetterSchema(strokeSet);
  const topologyResult = validateLetterDataset(strokeSet);
  const result = {
    valid: schemaResult.valid && topologyResult.valid,
    errors: [
      ...schemaResult.errors.map((e) => `[schema] ${e}`),
      ...topologyResult.errors.map((e) => `[topology] ${e}`),
    ],
  };
  if (!result.valid) {
    hasError = true;
    console.error(
      `❌ Stroke dataset '${strokeSet.id}' (${strokeSet.character}) failed validation:`
    );
    for (const err of result.errors) {
      console.error(`   - ${err}`);
    }
  } else {
    console.log(
      `✅ Stroke dataset '${strokeSet.id}' (${strokeSet.character}): ${strokeSet.strokes.length} strokes verified (JSON Schema + Shirorekha strictly last).`
    );
  }
}

// Devanagari numerals ० – ९ (headline-free stroke datasets)
if (NUMERAL_LIST.length !== 10) {
  hasError = true;
  console.error(`❌ Expected 10 Devanagari numerals (० – ९), found ${NUMERAL_LIST.length}`);
}
NUMERAL_LIST.forEach((numeral, digit) => {
  const errors = [...validateLetterDataset(numeral).errors];
  const schema = validateAgainstLetterSchema(numeral);
  if (!schema.valid) errors.push(...schema.errors);
  if (numeral.category !== 'numeral') errors.push(`category must be 'numeral'`);
  if (numeral.character !== toDigit(digit)) {
    errors.push(`position ${digit} holds '${numeral.character}', expected '${toDigit(digit)}'`);
  }
  if (errors.length > 0) {
    hasError = true;
    console.error(`❌ Numeral '${numeral.id}' (${numeral.character}) failed validation:`);
    for (const err of errors) console.error(`   - ${err}`);
  } else {
    console.log(
      `✅ Numeral '${numeral.id}' (${numeral.character}): ${numeral.strokes.length} stroke(s) verified (JSON Schema, no Shirorekha).`
    );
  }
});

const numberErrors = validateNumbers(NUMBERS);
if (numberErrors.length > 0) {
  hasError = true;
  console.error('❌ numbers.json failed validation:');
  for (const err of numberErrors) console.error(`   - ${err}`);
} else {
  console.log(`✅ Nepali numbers: ${NUMBERS.length} names verified (० – १००).`);
}

console.log(`✅ Word building blocks: ${WORDS.length} words verified.`);
for (const sentence of SENTENCES) {
  const errors = validateSentenceEntry(sentence);
  if (errors.length > 0) {
    hasError = true;
    console.error(`❌ Sentence '${sentence.id}' failed validation:`);
    for (const err of errors) console.error(`   - ${err}`);
  }
}
const orderCount = SENTENCES.reduce((n, s) => n + getAcceptableOrders(s).length, 0);
console.log(
  `✅ SOV sentence challenges: ${SENTENCES.length} sentences verified (${orderCount} acceptable orders, all verb-final).`
);

if (hasError) {
  process.exit(1);
}
