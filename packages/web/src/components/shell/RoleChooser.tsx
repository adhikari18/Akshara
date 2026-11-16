'use client';

import React from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

const ROLES = [
  {
    href: '/student/',
    emoji: '🧒',
    ne: 'म सिक्छु',
    title: 'Student',
    text: 'Lessons, tracing letters and numbers, games and quizzes.',
    tone: 'border-amber-400 bg-amber-50 dark:bg-amber-400/10',
  },
  {
    href: '/parent/',
    emoji: '👪',
    ne: 'अभिभावक',
    title: 'Parent',
    text: "Follow your child's progress, add children, choose font and voice.",
    tone: 'border-sky-400 bg-sky-50 dark:bg-sky-400/10',
  },
  {
    href: '/admin/',
    emoji: '🛠️',
    ne: 'प्रशासक',
    title: 'Admin',
    text: 'Manage content: stroke data, the trace trainer, fonts and demos.',
    tone: 'border-slate-400 bg-slate-100 dark:bg-slate-500/15',
  },
];

/** Landing page: pick who is using Akshara. */
export function RoleChooser() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-3xl font-black text-white shadow-[0_4px_0_rgb(194_65_12)] -rotate-3"
          >
            अ
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-ink leading-tight">
              Akshara <span className="text-amber-500">अक्षर</span>
            </h1>
            <p className="text-sm font-semibold text-ink-soft">
              नेपाली पढ्न र लेख्न सिकौं! • Let&apos;s learn Nepali!
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
        <h2 className="text-xl font-black text-ink">को हुनुहुन्छ? • Who is using Akshara?</h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {ROLES.map((r) => (
            <li key={r.href}>
              <Link
                href={r.href}
                className={`flex h-full flex-col gap-2 rounded-3xl border-4 p-5 transition hover:-translate-y-1 hover:shadow-lg ${r.tone}`}
              >
                <span className="text-6xl" aria-hidden>
                  {r.emoji}
                </span>
                <span className="text-lg font-black text-ink">
                  {r.ne} • {r.title}
                </span>
                <span className="text-sm text-ink-soft">{r.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
