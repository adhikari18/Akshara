'use client';

import React, { useSyncExternalStore } from 'react';
import { ChevronDown, Lightbulb } from 'lucide-react';

export interface HowToPlayStep {
  emoji: string;
  text: string;
}

interface HowToPlayProps {
  /** Stable id used to remember whether the learner collapsed this guide. */
  id: string;
  steps: HowToPlayStep[];
}

const howToListeners = new Set<() => void>();
const subscribeHowTo = (cb: () => void) => {
  howToListeners.add(cb);
  return () => {
    howToListeners.delete(cb);
  };
};
function readCollapsed(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === 'closed';
  } catch {
    return false;
  }
}

const STEP_COLORS = ['bg-amber-400', 'bg-sky-500', 'bg-emerald-500', 'bg-pink-500'];

/** Friendly, collapsible "How to play" strip shown at the top of each activity. */
export function HowToPlay({ id, steps }: HowToPlayProps) {
  const storageKey = `akshara-howto-${id}`;
  // Open by default (server snapshot); remembers if the learner collapsed it.
  const collapsed = useSyncExternalStore(
    subscribeHowTo,
    () => readCollapsed(storageKey),
    () => false
  );
  const open = !collapsed;

  const toggle = () => {
    try {
      window.localStorage.setItem(storageKey, open ? 'closed' : 'open');
    } catch {
      // ignore
    }
    howToListeners.forEach((listener) => listener());
  };

  return (
    <div className="rounded-3xl border-2 border-dashed border-amber-300 bg-amber-50/70 px-4 py-3 dark:border-amber-500/40 dark:bg-amber-500/5">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left text-sm font-extrabold text-amber-800 dark:text-amber-200"
      >
        <span className="inline-flex items-center gap-2">
          <Lightbulb className="h-5 w-5" aria-hidden />
          कसरी खेल्ने? • How to play
        </span>
        <ChevronDown
          className={`h-5 w-5 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && (
        <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in">
          {steps.map((step, idx) => (
            <li
              key={step.text}
              className="flex items-center gap-3 rounded-2xl bg-card/80 p-2.5 text-sm font-semibold text-ink"
            >
              <span className={`step-badge ${STEP_COLORS[idx % STEP_COLORS.length]}`}>
                {idx + 1}
              </span>
              <span className="text-xl" aria-hidden>
                {step.emoji}
              </span>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
