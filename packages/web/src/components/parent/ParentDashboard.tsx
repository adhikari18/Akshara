'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { NUMERAL_DATASETS, NUMERAL_LIST, STROKE_DATASETS, STROKE_LIST } from '@akshara/data';
import { summarize, type ChildProfile } from '@/lib/progress';
import { useProgress } from '@/components/shell/useProgress';

const glyphChar = (id: string) =>
  STROKE_DATASETS[id]?.character ?? NUMERAL_DATASETS[id]?.character ?? id;

function timeAgo(t: number | null): string {
  if (!t) return 'never';
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** Parent home: one card per child with their progress at a glance. */
export function ParentDashboard() {
  const state = useProgress();
  const [selected, setSelected] = useState<string | null>(null);
  const child = state.children.find((c) => c.id === selected) ?? state.children[0] ?? null;

  if (state.children.length === 0) {
    return (
      <section className="rounded-3xl border-2 border-line bg-card p-6 text-center space-y-3">
        <p className="text-4xl" aria-hidden>
          👨‍👩‍👧
        </p>
        <h1 className="text-xl font-black text-ink">No learners yet</h1>
        <p className="text-sm text-ink-soft">
          Add your child so their stars and practice are saved and show up here.
        </p>
        <Link href="/parent/children/" className="btn btn-primary">
          ➕ Add a child
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-black text-ink">प्रगति • Progress</h1>
        <div role="tablist" aria-label="Children" className="flex flex-wrap gap-2">
          {state.children.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === child?.id}
              onClick={() => setSelected(c.id)}
              className={`btn ${c.id === child?.id ? 'bg-sky-500 text-white' : 'bg-sunken text-ink-soft'}`}
            >
              {c.avatar} {c.name}
            </button>
          ))}
        </div>
      </div>
      {child && <ChildReport child={child} />}
    </div>
  );
}

function ChildReport({ child }: { child: ChildProfile }) {
  const state = useProgress();
  const s = useMemo(() => summarize(state.activity, child.id), [state.activity, child.id]);
  const maxDay = Math.max(1, ...s.last7Days.map((d) => d.count));
  const letterBest = new Map(
    s.items.filter((i) => i.kind === 'letter').map((i) => [i.itemId, i.bestStars])
  );
  const numeralBest = new Map(
    s.items.filter((i) => i.kind === 'numeral').map((i) => [i.itemId, i.bestStars])
  );

  return (
    <div className="space-y-4" aria-label={`Progress of ${child.name}`}>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Letters learned" value={`${s.lettersMastered}/${STROKE_LIST.length}`} />
        <Stat label="Numbers learned" value={`${s.numeralsMastered}/${NUMERAL_LIST.length}`} />
        <Stat
          label="Quiz answers right"
          value={s.quizAnswered ? `${Math.round((100 * s.quizCorrect) / s.quizAnswered)}%` : '—'}
        />
        <Stat label="Day streak" value={`${s.streakDays} 🔥`} />
        <Stat label="Last practised" value={timeAgo(s.lastActiveAt)} />
      </dl>

      <section
        className="rounded-3xl border-2 border-line bg-card p-4"
        aria-labelledby="week-heading"
      >
        <h2 id="week-heading" className="font-black text-ink mb-3">
          This week • यो हप्ता
        </h2>
        <ol className="flex items-end gap-2 h-32" aria-label="Activities per day, last 7 days">
          {s.last7Days.map((d) => (
            <li
              key={d.day}
              className="flex flex-1 flex-col items-center gap-1"
              aria-label={`${d.day}: ${d.count}`}
            >
              <span className="text-[10px] font-bold text-ink-soft">{d.count || ''}</span>
              <span
                className="w-full rounded-t-lg bg-sky-400"
                style={{ height: `${(d.count / maxDay) * 80 + 2}px` }}
              />
              <span className="text-[10px] text-ink-faint">
                {new Date(`${d.day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          className="rounded-3xl border-2 border-line bg-card p-4"
          aria-labelledby="practice-heading"
        >
          <h2 id="practice-heading" className="font-black text-ink mb-2">
            Needs more practice
          </h2>
          {s.needsPractice.length === 0 ? (
            <p className="text-sm text-ink-soft">
              Nothing yet — every traced letter has three stars, or none were traced.
            </p>
          ) : (
            <ul className="space-y-1">
              {s.needsPractice.map((i) => (
                <li
                  key={`${i.kind}-${i.itemId}`}
                  className="flex items-center justify-between rounded-xl bg-sunken px-3 py-2"
                >
                  <span className="text-2xl font-black text-ink">{glyphChar(i.itemId)}</span>
                  <span className="text-xs text-ink-soft">
                    {'⭐'.repeat(i.bestStars)} best • {i.attempts}{' '}
                    {i.attempts === 1 ? 'try' : 'tries'} • last {i.lastAccuracy}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          className="rounded-3xl border-2 border-line bg-card p-4"
          aria-labelledby="map-heading"
        >
          <h2 id="map-heading" className="font-black text-ink mb-2">
            Alphabet map
          </h2>
          <ul className="flex flex-wrap gap-1" aria-label="Letters and best stars">
            {[...STROKE_LIST, ...NUMERAL_LIST].map((d) => {
              const best = (d.category === 'numeral' ? numeralBest : letterBest).get(d.id) ?? 0;
              const tone =
                best >= 3
                  ? 'bg-emerald-400 text-slate-900'
                  : best === 2
                    ? 'bg-emerald-200 text-slate-900'
                    : best === 1
                      ? 'bg-amber-200 text-slate-900'
                      : 'bg-sunken text-ink-faint';
              return (
                <li
                  key={d.id}
                  aria-label={`${d.character}: ${best ? `${best} stars` : 'not practised'}`}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg font-black ${tone}`}
                >
                  {d.character}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[11px] text-ink-faint">
            Green = learned (2–3 ⭐), yellow = tried, grey = not yet.
          </p>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border-2 border-line bg-card p-3">
      <dt className="text-xs font-bold text-ink-soft">{label}</dt>
      <dd className="text-xl font-black text-ink">{value}</dd>
    </div>
  );
}
