import { CONSONANTS, VOWELS, type ConsonantEntry } from '@akshara/data';

export type MatraVisualPosition = 'inherent' | 'left' | 'right' | 'top' | 'bottom';

export interface MatraDefinition {
  id: string;
  order: number;
  vowelChar: string;
  matraSign: string | null;
  unicode: string | null;
  nameNepali: string;
  nameEnglish: string;
  romanizedSuffix: string;
  ipaSuffix: string;
  position: MatraVisualPosition;
  placementRule: string;
}

export interface FusedAksharaResult {
  consonantId: string;
  baseConsonant: string;
  matraId: string;
  matraSign: string | null;
  vowelChar: string;
  compositeAkshara: string;
  romanized: string;
  ipa: string;
  unicodeSequence: string;
  position: MatraVisualPosition;
  formulaDisplay: string;
  pedagogicalNote: string;
}

export const MATRA_DEFINITIONS: MatraDefinition[] = [
  {
    id: 'a',
    order: 1,
    vowelChar: 'अ',
    matraSign: null,
    unicode: null,
    nameNepali: 'अकार (मुक्ताक्षर)',
    nameEnglish: 'Inherent Vowel (a)',
    romanizedSuffix: 'a',
    ipaSuffix: 'ʌ',
    position: 'inherent',
    placementRule: 'Built into every base Devanagari consonant unless silenced by a Halanta (्).',
  },
  {
    id: 'aa',
    order: 2,
    vowelChar: 'आ',
    matraSign: 'ा',
    unicode: 'U+093E',
    nameNepali: 'आकार (ा)',
    nameEnglish: 'Aakar (aa)',
    romanizedSuffix: 'aa',
    ipaSuffix: 'aː',
    position: 'right',
    placementRule: 'Attaches as a full vertical stem (Khadi Pai) to the right of the base consonant.',
  },
  {
    id: 'i',
    order: 3,
    vowelChar: 'इ',
    matraSign: 'ि',
    unicode: 'U+093F',
    nameNepali: 'ह्रस्व इकार (ि)',
    nameEnglish: 'Hraswa Ikar (short i)',
    romanizedSuffix: 'i',
    ipaSuffix: 'i',
    position: 'left',
    placementRule: 'Visually stands to the LEFT of the consonant stem and arches over the Shirorekha, even though pronounced AFTER the consonant.',
  },
  {
    id: 'ii',
    order: 4,
    vowelChar: 'ई',
    matraSign: 'ी',
    unicode: 'U+0940',
    nameNepali: 'दीर्घ ईकार (ी)',
    nameEnglish: 'Dirgha Ikar (long ii)',
    romanizedSuffix: 'ii',
    ipaSuffix: 'iː',
    position: 'right',
    placementRule: 'Stands to the RIGHT of the consonant and arches back left over the Shirorekha.',
  },
  {
    id: 'u',
    order: 5,
    vowelChar: 'उ',
    matraSign: 'ु',
    unicode: 'U+0941',
    nameNepali: 'ह्रस्व उकार (ु)',
    nameEnglish: 'Hraswa Ukar (short u)',
    romanizedSuffix: 'u',
    ipaSuffix: 'u',
    position: 'bottom',
    placementRule: 'Attaches underneath the foot of the vertical stem, curling counter-clockwise to the left.',
  },
  {
    id: 'uu',
    order: 6,
    vowelChar: 'ऊ',
    matraSign: 'ू',
    unicode: 'U+0942',
    nameNepali: 'दीर्घ ऊकार (ू)',
    nameEnglish: 'Dirgha Ukar (long uu)',
    romanizedSuffix: 'uu',
    ipaSuffix: 'uː',
    position: 'bottom',
    placementRule: 'Attaches underneath the foot of the vertical stem, sweeping clockwise to the right.',
  },
  {
    id: 'ri',
    order: 7,
    vowelChar: 'ऋ',
    matraSign: 'ृ',
    unicode: 'U+0943',
    nameNepali: 'ऋकार (ृ)',
    nameEnglish: 'Rikar (vocalic ri)',
    romanizedSuffix: 'ri',
    ipaSuffix: 'ri',
    position: 'bottom',
    placementRule: 'Subscript c-shaped hook attached beneath the consonant stem.',
  },
  {
    id: 'e',
    order: 8,
    vowelChar: 'ए',
    matraSign: 'े',
    unicode: 'U+0947',
    nameNepali: 'एकार (े)',
    nameEnglish: 'Ekar (e)',
    romanizedSuffix: 'e',
    ipaSuffix: 'eː',
    position: 'top',
    placementRule: 'Single diagonal flag rising above the Shirorekha headline anchored to the vertical stem.',
  },
  {
    id: 'ai',
    order: 9,
    vowelChar: 'ऐ',
    matraSign: 'ै',
    unicode: 'U+0948',
    nameNepali: 'ऐकार (ै)',
    nameEnglish: 'Aikar (ai)',
    romanizedSuffix: 'ai',
    ipaSuffix: 'ʌi',
    position: 'top',
    placementRule: 'Double diagonal flags rising above the Shirorekha headline.',
  },
  {
    id: 'o',
    order: 10,
    vowelChar: 'ओ',
    matraSign: 'ो',
    unicode: 'U+094B',
    nameNepali: 'ओकार (ो)',
    nameEnglish: 'Okar (o)',
    romanizedSuffix: 'o',
    ipaSuffix: 'oː',
    position: 'right',
    placementRule: 'Combines a right-side vertical stem (ा) with a single top flag (े) above the Shirorekha.',
  },
  {
    id: 'au',
    order: 11,
    vowelChar: 'औ',
    matraSign: 'ौ',
    unicode: 'U+094C',
    nameNepali: 'औकार (ौ)',
    nameEnglish: 'Aukar (au)',
    romanizedSuffix: 'au',
    ipaSuffix: 'ʌu',
    position: 'right',
    placementRule: 'Combines a right-side vertical stem (ा) with double top flags (ै) above the Shirorekha.',
  },
  {
    id: 'am',
    order: 12,
    vowelChar: 'अं',
    matraSign: 'ं',
    unicode: 'U+0902',
    nameNepali: 'शिरबिन्दु (ं)',
    nameEnglish: 'Shirbindu / Anusvara (am)',
    romanizedSuffix: 'am',
    ipaSuffix: 'ʌm',
    position: 'top',
    placementRule: 'Nasal dot placed directly above the Shirorekha headline.',
  },
  {
    id: 'aha',
    order: 13,
    vowelChar: 'अः',
    matraSign: 'ः',
    unicode: 'U+0903',
    nameNepali: 'विसर्ग (ः)',
    nameEnglish: 'Visarga (aha)',
    romanizedSuffix: 'aha',
    ipaSuffix: 'ʌhʌ',
    position: 'right',
    placementRule: 'Twin vertical breath dots placed to the right of the consonant.',
  },
  {
    id: 'halanta',
    order: 14,
    vowelChar: '्',
    matraSign: '्',
    unicode: 'U+094D',
    nameNepali: 'हलन्त / खुट्टो काटेको (्)',
    nameEnglish: 'Halanta / Virama (Pure Consonant)',
    romanizedSuffix: '',
    ipaSuffix: '',
    position: 'bottom',
    placementRule: 'Diagonal stroke beneath the stem that mutes the inherent "a" vowel (खुट्टो काटेको).',
  },
];

function stripTrailingVowelA(romanized: string): string {
  if (romanized.endsWith('a') && romanized.length > 1) {
    return romanized.slice(0, -1);
  }
  return romanized;
}

function stripTrailingIpaSchwa(ipa: string): string {
  const cleaned = ipa.replace(/^\/|\/$/g, '');
  if (cleaned.endsWith('ʌ') && cleaned.length > 1) {
    return cleaned.slice(0, -1);
  }
  return cleaned;
}

function formatCodepoints(str: string): string {
  return Array.from(str)
    .map((ch) => `U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`)
    .join(' + ');
}

/**
 * Fuses a base Devanagari consonant with a vowel Matra diacritic, returning the
 * composite Unicode glyph, phonetics, and topological placement guide.
 */
export function fuseConsonantWithMatra(
  consonantInput: string | ConsonantEntry,
  matraId: string
): FusedAksharaResult {
  const consonantEntry =
    typeof consonantInput === 'string'
      ? CONSONANTS.find((c) => c.id === consonantInput || c.character === consonantInput)
      : consonantInput;

  const baseConsonant = consonantEntry ? consonantEntry.character : String(consonantInput);
  const consonantId = consonantEntry ? consonantEntry.id : String(consonantInput);
  const baseRoman = consonantEntry ? stripTrailingVowelA(consonantEntry.romanized) : 'k';
  const baseIpa = consonantEntry ? stripTrailingIpaSchwa(consonantEntry.ipa) : 'k';

  const matra = MATRA_DEFINITIONS.find(
    (m) => m.id === matraId || m.matraSign === matraId || m.vowelChar === matraId
  );

  if (!matra) {
    throw new Error(`Unknown matra identifier: '${matraId}'`);
  }

  const compositeAkshara = matra.matraSign ? `${baseConsonant}${matra.matraSign}` : baseConsonant;
  const romanized = `${baseRoman}${matra.romanizedSuffix}`;
  const ipa = `/${baseIpa}${matra.ipaSuffix}/`;
  const unicodeSequence = formatCodepoints(compositeAkshara);
  const formulaDisplay = matra.matraSign
    ? `${baseConsonant} + ${matra.matraSign} (${matra.vowelChar}) = ${compositeAkshara}`
    : `${baseConsonant} + अ = ${compositeAkshara}`;

  return {
    consonantId,
    baseConsonant,
    matraId: matra.id,
    matraSign: matra.matraSign,
    vowelChar: matra.vowelChar,
    compositeAkshara,
    romanized,
    ipa,
    unicodeSequence,
    position: matra.position,
    formulaDisplay,
    pedagogicalNote: matra.placementRule,
  };
}

/**
 * Generates the complete 13-step canonical Nepali Barakhari (बाह्रखरी) sequence for a consonant.
 */
export function generateBarakhari(consonantInput: string | ConsonantEntry): FusedAksharaResult[] {
  const barakhariIds = VOWELS.map((v) => v.id);
  return barakhariIds.map((matraId) => fuseConsonantWithMatra(consonantInput, matraId));
}

const DEVANAGARI_COMBINING_MARKS = new Set<number>([
  0x0900, 0x0901, 0x0902, 0x0903, // Chandrabindu, Anusvara, Visarga
  0x093a, 0x093b, 0x093c, // Nukta
  0x093e, 0x093f, 0x0940, 0x0941, 0x0942, 0x0943, 0x0944, 0x0945, 0x0946, 0x0947, 0x0948,
  0x0949, 0x094a, 0x094b, 0x094c, 0x094d, // Matras & Virama (Halanta)
  0x0955, 0x0956, 0x0957, 0x0962, 0x0963,
]);

const VIRAMA_CODEPOINT = 0x094d;

/**
 * Segments a Devanagari word into orthographic syllable clusters (aksharas).
 * Properly binds combining vowel matras, anusvara/visarga, and Virama conjuncts (C + ् + C).
 */
export function segmentDevanagariAksharas(word: string): string[] {
  const chars = Array.from(word.trim());
  const clusters: string[] = [];

  let current = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const cp = ch.codePointAt(0) ?? 0;

    if (ch === ' ') {
      if (current) {
        clusters.push(current);
        current = '';
      }
      continue;
    }

    if (current === '') {
      current = ch;
      continue;
    }

    const prevCp = current.codePointAt(current.length - 1) ?? 0;
    if (DEVANAGARI_COMBINING_MARKS.has(cp) || prevCp === VIRAMA_CODEPOINT) {
      current += ch;
    } else {
      clusters.push(current);
      current = ch;
    }
  }

  if (current) {
    clusters.push(current);
  }

  return clusters;
}

