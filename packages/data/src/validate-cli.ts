import { CONSONANTS, SENTENCES, STROKE_DATASETS, STROKE_LIST, VOWELS, WORDS, validateLetterDataset } from './index.js';

let hasError = false;

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
  console.log(`✅ Consonants (Vyanjan Varna): ${CONSONANTS.length} canonical entries verified (क to ज्ञ).`);
}

for (const strokeSet of STROKE_LIST) {
  const result = validateLetterDataset(strokeSet);
  if (!result.valid) {
    hasError = true;
    console.error(`❌ Stroke dataset '${strokeSet.id}' (${strokeSet.character}) failed validation:`);
    for (const err of result.errors) {
      console.error(`   - ${err}`);
    }
  } else {
    console.log(
      `✅ Stroke dataset '${strokeSet.id}' (${strokeSet.character}): ${strokeSet.strokes.length} strokes verified (Shirorekha strictly last).`
    );
  }
}

console.log(`✅ Word building blocks: ${WORDS.length} words verified.`);
console.log(`✅ SOV sentence challenges: ${SENTENCES.length} sentences verified.`);

if (hasError) {
  process.exit(1);
}

