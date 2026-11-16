'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { getActiveChild, setActiveChild } from '@/lib/progress';
import { speakNepaliPhonics } from '@/lib/audio';
import { useProgress } from '@/components/shell/useProgress';
import { buildLessons } from './lessons';
import { nextStep, starsByGlyph } from './studentPath';

/** The three doors a child can go through. Big, few, and always the same. */
export const DOORS = [
  {
    href: '/student/lessons/',
    emoji: '✏️',
    ne: 'लेखौं',
    en: 'Write',
    tone: 'from-amber-300 to-orange-400',
  },
  { href: '/student/play/', emoji: '🎈', ne: 'खेलौं', en: 'Play', tone: 'from-pink-300 to-rose-400' },
  {
    href: '/student/watch/',
    emoji: '🎬',
    ne: 'हेरौं',
    en: 'Watch',
    tone: 'from-sky-300 to-indigo-400',
  },
];

/**
 * Student home, built for a four-year-old: pick yourself (big faces), hear a greeting, one big
 * "next" card that continues where they left off, and three doors. Nothing else on the page.
 */
export function StudentHome() {
  const state = useProgress();
  const child = getActiveChild(state);
  const lessons = useMemo(() => buildLessons(), []);
  const stars = useMemo(
    () => starsByGlyph(state.activity, child?.id ?? null),
    [state.activity, child]
  );
  const next = useMemo(() => nextStep(stars, lessons), [stars, lessons]);

  // Several children on this device and nobody picked yet: choose a face first, nothing else.
  if (state.children.length > 1 && !child) {
    return <WhoAreYou />;
  }

  const greeting = child ? `नमस्ते ${child.name}!` : 'नमस्ते!';
  const learned = [...stars.values()].filter((s) => s >= 2).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section
        className="flex flex-col items-center gap-3 text-center"
        aria-labelledby="hello-heading"
      >
        <span className="text-7xl animate-wiggle" aria-hidden>
          {child?.avatar ?? '🦉'}
        </span>
        <h1 id="hello-heading" className="text-3xl sm:text-4xl font-black text-ink">
          {greeting}
        </h1>
        <button
          type="button"
          className="btn btn-sky text-base"
          onClick={() => speakNepaliPhonics(greeting, child ? `Namaste ${child.name}` : 'Namaste')}
          aria-label="Hear the greeting"
        >
          🔊 सुन्नुहोस्
        </button>
        {learned > 0 && (
          <p className="text-sm font-bold text-ink-soft" aria-label={`${learned} letters learned`}>
            {'⭐'.repeat(Math.min(learned, 10))}
            {learned > 10 ? ` +${learned - 10}` : ''}
          </p>
        )}
        {state.children.length > 1 && child && (
          <button
            type="button"
            className="text-xs font-bold text-ink-faint underline"
            onClick={() => setActiveChild('')}
          >
            Not {child.name}? Pick another face
          </button>
        )}
      </section>

      <Link
        href={next.href}
        className="block rounded-[2rem] border-4 border-emerald-400 bg-emerald-50 dark:bg-emerald-400/10 p-5 sm:p-6 shadow-lg hover:-translate-y-1 transition"
        aria-label={`Next: write ${next.glyph.character}`}
      >
        <div className="flex items-center gap-5">
          <span className="flex h-24 w-24 sm:h-28 sm:w-28 shrink-0 items-center justify-center rounded-3xl bg-white dark:bg-slate-900 text-6xl sm:text-7xl font-black text-ink shadow-inner">
            {next.glyph.character}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-emerald-700 dark:text-emerald-300">
              {next.fresh ? 'सुरु गरौं • Let’s start!' : 'अब यो • Up next'}
            </span>
            <span className="block text-2xl sm:text-3xl font-black text-ink leading-tight">
              {next.glyph.character} लेखौं • Write {next.glyph.character}
            </span>
            <span className="block text-sm font-semibold text-ink-soft">
              {next.lesson.emoji} {next.lesson.ne} • {next.lesson.title}
            </span>
          </span>
          <span className="ml-auto text-5xl" aria-hidden>
            👉
          </span>
        </div>
      </Link>

      <nav aria-label="Student doors">
        <ul className="grid grid-cols-3 gap-3 sm:gap-4">
          {DOORS.map((d) => (
            <li key={d.href}>
              <Link
                href={d.href}
                className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-[2rem] bg-gradient-to-br ${d.tone} text-slate-900 shadow-md hover:-translate-y-1 transition`}
              >
                <span className="text-5xl sm:text-6xl" aria-hidden>
                  {d.emoji}
                </span>
                <span className="text-xl sm:text-2xl font-black">{d.ne}</span>
                <span className="text-xs sm:text-sm font-bold opacity-80">{d.en}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** Big faces only: tap who you are. */
function WhoAreYou() {
  const state = useProgress();
  return (
    <section className="mx-auto max-w-3xl space-y-5 text-center" aria-labelledby="who-heading">
      <h1 id="who-heading" className="text-3xl font-black text-ink">
        तिमी को हौ? • Who are you?
      </h1>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-4" aria-label="Who is learning">
        {state.children.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => setActiveChild(c.id)}
              className="flex w-full flex-col items-center gap-2 rounded-[2rem] border-4 border-line bg-card p-5 hover:-translate-y-1 hover:border-amber-400 transition"
            >
              <span className="text-7xl" aria-hidden>
                {c.avatar}
              </span>
              <span className="text-2xl font-black text-ink">{c.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
