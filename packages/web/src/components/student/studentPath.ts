import type { LetterStrokeDataset } from '@akshara/data';
import type { ActivityRecord } from '@/lib/progress';
import { summarize } from '@/lib/progress';
import { buildLessons, type Lesson } from './lessons';

/** Where a glyph is practised. */
export function practiceHref(lesson: Lesson, glyph: LetterStrokeDataset): string {
  if (lesson.practice === 'numbers') {
    const n = Number(glyph.id.replace('num-', ''));
    return `/student/numbers/?n=${Number.isNaN(n) ? 1 : n}`;
  }
  return `/student/trace/?letter=${glyph.id}`;
}

/** Best stars per glyph id for one child (empty for a guest). */
export function starsByGlyph(
  activity: ActivityRecord[],
  childId: string | null
): Map<string, number> {
  const map = new Map<string, number>();
  if (!childId) return map;
  for (const item of summarize(activity, childId).items) map.set(item.itemId, item.bestStars);
  return map;
}

export interface NextStep {
  lesson: Lesson;
  glyph: LetterStrokeDataset;
  href: string;
  /** True when this is the very first thing the child does. */
  fresh: boolean;
}

/**
 * The one thing to suggest next: the first glyph on the path that is not yet learned (2+ stars).
 * Everything learned → the last lesson's last glyph, so there is always a "next".
 */
export function nextStep(stars: Map<string, number>, lessons = buildLessons()): NextStep {
  for (const lesson of lessons) {
    for (const glyph of lesson.glyphs) {
      if ((stars.get(glyph.id) ?? 0) < 2) {
        return { lesson, glyph, href: practiceHref(lesson, glyph), fresh: stars.size === 0 };
      }
    }
  }
  const lesson = lessons[lessons.length - 1]!;
  const glyph = lesson.glyphs[lesson.glyphs.length - 1]!;
  return { lesson, glyph, href: practiceHref(lesson, glyph), fresh: false };
}

/** A lesson is "done" when every glyph in it has 2+ stars. */
export function lessonDone(lesson: Lesson, stars: Map<string, number>): boolean {
  return lesson.glyphs.every((g) => (stars.get(g.id) ?? 0) >= 2);
}
