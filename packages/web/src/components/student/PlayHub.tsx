'use client';

import React from 'react';
import Link from 'next/link';

export const GAMES = [
  {
    href: '/student/quiz/',
    emoji: '🎯',
    ne: 'अक्षर खोज',
    en: 'Find the letter',
    tone: 'from-rose-300 to-pink-400',
  },
  {
    href: '/student/numbers/',
    emoji: '🔢',
    ne: 'अङ्क',
    en: 'Numbers',
    tone: 'from-violet-300 to-purple-400',
  },
  {
    href: '/student/matras/',
    emoji: '🧪',
    ne: 'मात्रा',
    en: 'Letter + sign',
    tone: 'from-sky-300 to-cyan-400',
  },
  {
    href: '/student/words/',
    emoji: '🧩',
    ne: 'शब्द',
    en: 'Build words',
    tone: 'from-emerald-300 to-teal-400',
  },
  {
    href: '/student/alphabet/',
    emoji: '📖',
    ne: 'वर्णमाला',
    en: 'Listen to letters',
    tone: 'from-amber-300 to-yellow-400',
  },
];

/** The "Play" door: a handful of big game tiles, nothing more. */
export function PlayHub() {
  return (
    <section className="mx-auto max-w-3xl space-y-4" aria-labelledby="play-heading">
      <h1 id="play-heading" className="text-center text-3xl font-black text-ink">
        🎈 खेलौं • Let’s play
      </h1>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-4" aria-label="Games">
        {GAMES.map((g) => (
          <li key={g.href}>
            <Link
              href={g.href}
              className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-[2rem] bg-gradient-to-br ${g.tone} text-slate-900 shadow-md hover:-translate-y-1 transition`}
            >
              <span className="text-6xl" aria-hidden>
                {g.emoji}
              </span>
              <span className="text-xl font-black">{g.ne}</span>
              <span className="text-xs font-bold opacity-80">{g.en}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
