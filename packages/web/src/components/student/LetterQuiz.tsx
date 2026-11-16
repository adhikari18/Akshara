'use client';

import React, { useMemo, useState } from 'react';
import { NUMERAL_LIST, STROKE_LIST, type LetterStrokeDataset } from '@akshara/data';
import {
  playStrokeSuccessSound,
  playTopologicalWarningSound,
  speakNepaliPhonics,
} from '@/lib/audio';
import { recordActivity } from '@/lib/progress';

export type QuizMode = 'picture' | 'sound' | 'number';

export const QUIZ_LENGTH = 8;

export interface QuizQuestion {
  answer: LetterStrokeDataset;
  options: LetterStrokeDataset[];
  /** Picture-word clue (picture mode). */
  word?: { word: string; emoji: string; meaning: string };
}

/** Deterministic shuffle helper (random by default; tests pass a seeded `random`). */
function shuffle<T>(items: T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** A round of questions: every answer is different; options are four distinct glyphs. */
export function buildQuiz(mode: QuizMode, random: () => number = Math.random): QuizQuestion[] {
  const pool =
    mode === 'number'
      ? NUMERAL_LIST
      : STROKE_LIST.filter((d) => mode !== 'picture' || (d.vocabulary?.length ?? 0) > 0);
  return shuffle(pool, random)
    .slice(0, QUIZ_LENGTH)
    .map((answer) => {
      const others = shuffle(
        pool.filter((d) => d.id !== answer.id),
        random
      ).slice(0, 3);
      const vocab = answer.vocabulary?.[0];
      return {
        answer,
        options: shuffle([answer, ...others], random),
        word: vocab ? { word: vocab.word, emoji: vocab.emoji, meaning: vocab.meaning } : undefined,
      };
    });
}

const MODES: Array<{ id: QuizMode; emoji: string; ne: string; en: string }> = [
  { id: 'picture', emoji: '🖼️', ne: 'चित्र हेरेर', en: 'Picture → first letter' },
  { id: 'sound', emoji: '🔊', ne: 'सुनेर', en: 'Hear → pick the letter' },
  { id: 'number', emoji: '🔢', ne: 'अङ्क', en: 'Hear → pick the number' },
];

/** Letter quiz game: eight questions, four big answer buttons, stars at the end. */
export function LetterQuiz({ random }: { random?: () => number } = {}) {
  const [mode, setMode] = useState<QuizMode | null>(null);
  const [round, setRound] = useState(0);
  const questions = useMemo(
    () => (mode ? buildQuiz(mode, random) : []),
    // A new round (or mode) draws new questions
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, round]
  );
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  const start = (m: QuizMode) => {
    setMode(m);
    setRound((r) => r + 1);
    setIndex(0);
    setPicked(null);
    setScore(0);
  };

  if (!mode) {
    return (
      <section
        className="rounded-3xl border-2 border-line bg-card p-4 sm:p-6 space-y-4"
        aria-labelledby="quiz-heading"
      >
        <h1 id="quiz-heading" className="text-xl sm:text-2xl font-black text-ink">
          🎯 प्रश्नोत्तर • Letter quiz
        </h1>
        <p className="text-sm text-ink-soft">
          Pick a game. {QUIZ_LENGTH} questions, one star for each right answer.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => start(m.id)}
              className="flex flex-col items-center gap-1 rounded-3xl border-2 border-line bg-sunken p-4 hover:-translate-y-0.5 transition"
            >
              <span className="text-4xl" aria-hidden>
                {m.emoji}
              </span>
              <span className="font-black text-ink">{m.ne}</span>
              <span className="text-xs font-bold text-ink-soft">{m.en}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  const finished = index >= questions.length;
  if (finished) {
    return (
      <section
        className="rounded-3xl border-2 border-line bg-card p-6 text-center space-y-3"
        aria-live="polite"
      >
        <p className="text-5xl" aria-hidden>
          🏆
        </p>
        <h2 className="text-2xl font-black text-ink">
          स्याबास! {score}/{questions.length}
        </h2>
        <p className="text-2xl" aria-label={`${score} stars`}>
          {'⭐'.repeat(score)}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn btn-primary" onClick={() => start(mode)}>
            Play again
          </button>
          <button
            type="button"
            className="btn bg-sunken text-ink-soft"
            onClick={() => setMode(null)}
          >
            Other games
          </button>
        </div>
      </section>
    );
  }

  const q = questions[index]!;
  const prompt = () =>
    speakNepaliPhonics(q.answer.phonetics.audioPrompt, q.answer.phonetics.romanized);
  const choose = (option: LetterStrokeDataset) => {
    if (picked) return;
    const correct = option.id === q.answer.id;
    setPicked(option.id);
    if (correct) {
      setScore((s) => s + 1);
      playStrokeSuccessSound(false);
    } else {
      playTopologicalWarningSound();
    }
    recordActivity({
      kind: 'quiz',
      itemId: q.answer.id,
      stars: correct ? 3 : 0,
      accuracy: correct ? 100 : 0,
      mistakes: correct ? 0 : 1,
    });
  };

  return (
    <section
      className="rounded-3xl border-2 border-line bg-card p-4 sm:p-6 space-y-4"
      aria-labelledby="quiz-q"
    >
      <div className="flex items-center justify-between text-sm font-bold text-ink-soft">
        <span>
          Question {index + 1}/{questions.length}
        </span>
        <span aria-label={`Score ${score}`}>⭐ {score}</span>
      </div>
      <div className="text-center space-y-2">
        {mode === 'picture' && q.word ? (
          <>
            <p className="text-7xl" aria-hidden>
              {q.word.emoji}
            </p>
            <h2 id="quiz-q" className="text-lg font-black text-ink">
              {q.word.meaning} — which letter does it start with?
            </h2>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={prompt}
              className="btn btn-sky text-lg"
              aria-label="Hear it again"
            >
              🔊 सुन्नुहोस् • Listen
            </button>
            <h2 id="quiz-q" className="text-lg font-black text-ink">
              {mode === 'number' ? 'Which number did you hear?' : 'Which letter did you hear?'}
            </h2>
          </>
        )}
      </div>
      <div role="group" aria-label="Answers" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {q.options.map((o) => {
          const isAnswer = o.id === q.answer.id;
          const state = !picked ? 'idle' : isAnswer ? 'right' : o.id === picked ? 'wrong' : 'idle';
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => choose(o)}
              disabled={!!picked}
              aria-label={`Answer ${o.character}`}
              className={`h-24 rounded-3xl border-4 text-5xl font-black transition ${
                state === 'right'
                  ? 'border-emerald-400 bg-emerald-100 dark:bg-emerald-400/20 text-ink'
                  : state === 'wrong'
                    ? 'border-rose-400 bg-rose-100 dark:bg-rose-400/20 text-ink'
                    : 'border-line bg-sunken text-ink'
              }`}
            >
              {o.character}
            </button>
          );
        })}
      </div>
      {picked && (
        <div className="text-center space-y-2" aria-live="polite">
          <p className="font-bold text-ink">
            {picked === q.answer.id
              ? 'राम्रो! Correct!'
              : `It was ${q.answer.character}${q.word ? ` — ${q.word.word}` : ''}`}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setIndex((i) => i + 1);
              setPicked(null);
            }}
          >
            {index + 1 < questions.length ? 'Next ➜' : 'See my stars'}
          </button>
        </div>
      )}
    </section>
  );
}
