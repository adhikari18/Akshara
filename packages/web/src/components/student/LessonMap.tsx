'use client';

import React, { useMemo, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { getActiveChild } from '@/lib/progress';
import { speakNepaliPhonics } from '@/lib/audio';
import { useProgress } from '@/components/shell/useProgress';
import { buildLessons } from './lessons';
import { lessonDone, nextStep, practiceHref, starsByGlyph } from './studentPath';

function useLessonParam(): string | null {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('popstate', cb);
      return () => window.removeEventListener('popstate', cb);
    },
    () => new URLSearchParams(window.location.search).get('lesson'),
    () => null
  );
}

/**
 * The "Write" door. Without `?lesson=`: a winding map of lesson stops, one per row, with the
 * next stop glowing. With `?lesson=`: that lesson's few letters as big tiles. A child only ever
 * sees one lesson's letters at a time.
 */
export function LessonMap() {
  const state = useProgress();
  const child = getActiveChild(state);
  const lessons = useMemo(() => buildLessons(), []);
  const stars = useMemo(
    () => starsByGlyph(state.activity, child?.id ?? null),
    [state.activity, child]
  );
  const next = useMemo(() => nextStep(stars, lessons), [stars, lessons]);
  const lessonId = useLessonParam();
  const lesson = lessons.find((l) => l.id === lessonId);

  if (lesson) {
    return (
      <section className="mx-auto max-w-3xl space-y-5" aria-labelledby="lesson-heading">
        <Link href="/student/lessons/" className="btn bg-sunken text-ink-soft text-base">
          ◀ नक्सा • Map
        </Link>
        <h1 id="lesson-heading" className="flex items-center gap-3 text-3xl font-black text-ink">
          <span className="text-5xl" aria-hidden>
            {lesson.emoji}
          </span>
          {lesson.ne} • {lesson.title}
        </h1>
        <p className="text-base font-bold text-ink-soft">कुन अक्षर? • Tap a letter to write it.</p>
        <ul
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
          aria-label={`${lesson.title} letters`}
        >
          {lesson.glyphs.map((g) => {
            const best = stars.get(g.id) ?? 0;
            const isNext = next.glyph.id === g.id;
            return (
              <li key={g.id} className="relative">
                <Link
                  href={practiceHref(lesson, g)}
                  aria-label={`Write ${g.character}${best ? `, ${best} stars` : ''}`}
                  className={`flex aspect-square flex-col items-center justify-center rounded-[2rem] border-4 text-6xl sm:text-7xl font-black text-ink shadow-md hover:-translate-y-1 transition ${
                    best >= 2
                      ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-400/10'
                      : isNext
                        ? 'border-amber-400 bg-amber-50 dark:bg-amber-400/10 ring-4 ring-amber-300/60'
                        : 'border-line bg-card'
                  }`}
                >
                  {g.character}
                  <span className="mt-1 h-5 text-base leading-none" aria-hidden>
                    {'⭐'.repeat(best)}
                  </span>
                </Link>
                <button
                  type="button"
                  aria-label={`Hear ${g.character}`}
                  onClick={() => speakNepaliPhonics(g.phonetics.audioPrompt, g.phonetics.romanized)}
                  className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 text-white shadow"
                >
                  🔊
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl space-y-4" aria-labelledby="map-heading">
      <h1 id="map-heading" className="text-center text-3xl font-black text-ink">
        ✏️ लेखौं • Let’s write
      </h1>
      <ol className="space-y-3" aria-label="Lesson map">
        {lessons.map((l, i) => {
          const done = lessonDone(l, stars);
          const isNext = next.lesson.id === l.id;
          const learned = l.glyphs.filter((g) => (stars.get(g.id) ?? 0) >= 2).length;
          return (
            <li key={l.id} className={i % 2 ? 'sm:pl-16' : 'sm:pr-16'}>
              <Link
                href={`/student/lessons/?lesson=${l.id}`}
                aria-label={`${l.title}${done ? ', done' : isNext ? ', up next' : ''}`}
                className={`flex items-center gap-4 rounded-[2rem] border-4 p-4 shadow-md hover:-translate-y-1 transition ${
                  done
                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-400/10'
                    : isNext
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-400/10 ring-4 ring-amber-300/60 animate-pop'
                      : 'border-line bg-card'
                }`}
              >
                <span
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-900 text-4xl shadow-inner"
                  aria-hidden
                >
                  {done ? '🏆' : l.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xl sm:text-2xl font-black text-ink leading-tight">
                    {l.ne}
                  </span>
                  <span className="block text-sm font-bold text-ink-soft">{l.title}</span>
                </span>
                <span className="text-right text-sm font-black text-ink-soft" aria-hidden>
                  {learned}/{l.glyphs.length}
                  <span className="block text-2xl">
                    {l.glyphs
                      .slice(0, 3)
                      .map((g) => g.character)
                      .join(' ')}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
