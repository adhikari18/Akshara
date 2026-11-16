import { NUMERAL_LIST, STROKE_LIST, type LetterStrokeDataset } from '@akshara/data';

export interface Lesson {
  id: string;
  emoji: string;
  title: string;
  ne: string;
  glyphs: LetterStrokeDataset[];
  /** Where a glyph of this lesson is practised. */
  practice: 'trace' | 'numbers';
}

/** Group consonants by their place of articulation (the first word of their varga). */
function vargaOf(d: LetterStrokeDataset): string {
  return (d.varga ?? '').split(/[\s(]/)[0] ?? '';
}

const CONSONANT_LESSONS: Array<{ varga: string; emoji: string; title: string; ne: string }> = [
  { varga: 'कण्ठ्य', emoji: '🗣️', title: 'Throat letters', ne: 'क वर्ग' },
  { varga: 'तालव्य', emoji: '👅', title: 'Palate letters', ne: 'च वर्ग' },
  { varga: 'मूर्धन्य', emoji: '🥁', title: 'Roof letters', ne: 'ट वर्ग' },
  { varga: 'दन्त्य', emoji: '🦷', title: 'Teeth letters', ne: 'त वर्ग' },
  { varga: 'ओष्ठ्य', emoji: '👄', title: 'Lip letters', ne: 'प वर्ग' },
  { varga: 'अन्तस्थ', emoji: '🌊', title: 'Gliding letters', ne: 'य र ल व' },
  { varga: 'ऊष्म', emoji: '💨', title: 'Breathy letters', ne: 'श ष स ह' },
];

/** The student's learning path, in teaching order. */
export function buildLessons(): Lesson[] {
  const vowels = STROKE_LIST.filter((d) => d.category === 'swor');
  const consonants = STROKE_LIST.filter((d) => d.category === 'vyanjan');
  const conjuncts = STROKE_LIST.filter((d) => d.category === 'samyukta');
  const lessons: Lesson[] = [
    {
      id: 'vowels',
      emoji: '🍎',
      title: 'Vowels',
      ne: 'स्वर वर्ण',
      glyphs: vowels,
      practice: 'trace',
    },
  ];
  for (const group of CONSONANT_LESSONS) {
    const glyphs = consonants.filter((d) => vargaOf(d) === group.varga);
    if (glyphs.length) {
      lessons.push({ id: `consonants-${group.varga}`, ...group, glyphs, practice: 'trace' });
    }
  }
  const placed = new Set(lessons.flatMap((l) => l.glyphs.map((g) => g.id)));
  const leftover = consonants.filter((d) => !placed.has(d.id));
  if (leftover.length) {
    lessons.push({
      id: 'consonants-more',
      emoji: '✨',
      title: 'More letters',
      ne: 'अरू व्यञ्जन',
      glyphs: leftover,
      practice: 'trace',
    });
  }
  if (conjuncts.length) {
    lessons.push({
      id: 'conjuncts',
      emoji: '🔗',
      title: 'Joined letters',
      ne: 'संयुक्त अक्षर',
      glyphs: conjuncts,
      practice: 'trace',
    });
  }
  lessons.push({
    id: 'numbers',
    emoji: '🔢',
    title: 'Numbers ० – ९',
    ne: 'अङ्क',
    glyphs: NUMERAL_LIST,
    practice: 'numbers',
  });
  return lessons;
}
