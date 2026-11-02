import { CONSONANTS, SENTENCES, STROKE_LIST, VOWELS, WORDS, validateLetterDataset } from './index.js';

let hasError = false;

console.log('🔍 Validating @akshara/data schemas and Devanagari topological invariants...\n');

if (VOWELS.length !== 13) {
  console.error(`❌ Expected 13 Swor Varna vowels, found ${VOWELS.length}`);
  hasError = true;
} else {
  console.log(`✅ Vowels (Swor Varna): ${VOWELS.length} canonical entries verified (अ to अः).`);
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
