'use client';

import React, { useState, useSyncExternalStore } from 'react';

const KEY = 'akshara.grown-up-ok';
const listeners = new Set<() => void>();

function readUnlocked(): boolean {
  try {
    return window.sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function unlockGrownUpArea(): void {
  try {
    window.sessionStorage.setItem(KEY, '1');
  } catch {
    /* no storage: the gate simply asks again next time */
  }
  listeners.forEach((l) => l());
}

export function lockGrownUpArea(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function newQuestion() {
  const a = 3 + Math.floor(Math.random() * 7);
  const b = 3 + Math.floor(Math.random() * 7);
  return { a, b };
}

/**
 * "Grown-ups only" check in front of the Parent and Admin areas: a multiplication a young child
 * can't easily answer. Once passed it is remembered for this browser tab session.
 */
export function GrownUpGate({ children, area }: { children: React.ReactNode; area: string }) {
  const unlocked = useSyncExternalStore(subscribe, readUnlocked, () => false);
  const [q, setQ] = useState(newQuestion);
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);

  if (unlocked) return <>{children}</>;

  return (
    <div className="mx-auto max-w-md rounded-3xl border-2 border-line bg-card p-6 space-y-4 text-center">
      <p className="text-4xl" aria-hidden>
        🔒
      </p>
      <h1 className="text-xl font-black text-ink">ठूलाहरूका लागि मात्र • Grown-ups only</h1>
      <p className="text-sm text-ink-soft">
        The {area} area is for parents and teachers. Answer this to continue.
      </p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (Number(answer) === q.a * q.b) {
            unlockGrownUpArea();
          } else {
            setWrong(true);
            setAnswer('');
            setQ(newQuestion());
          }
        }}
      >
        <label className="block text-lg font-bold text-ink" htmlFor="gate-answer">
          What is {q.a} × {q.b}?
        </label>
        <input
          id="gate-answer"
          inputMode="numeric"
          autoComplete="off"
          value={answer}
          onChange={(e) => setAnswer(e.target.value.replace(/\D/g, ''))}
          className="w-32 rounded-xl border-2 border-line bg-sunken px-3 py-2 text-center text-xl font-black text-ink"
        />
        <div>
          <button type="submit" className="btn btn-primary">
            Continue
          </button>
        </div>
        {wrong && (
          <p role="alert" className="text-sm font-bold text-rose-600">
            Not quite — here is another one.
          </p>
        )}
      </form>
    </div>
  );
}
