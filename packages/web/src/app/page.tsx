'use client';

import React, { useState } from 'react';
import { TracingCanvas } from '@/components/TracingCanvas';
import { MatraBuilder } from '@/components/MatraBuilder';
import { WordSentenceBuilder } from '@/components/WordSentenceBuilder';
import { VarnamalaGallery } from '@/components/VarnamalaGallery';
import { NumberStudio } from '@/components/NumberStudio';
import { VoiceSelector } from '@/components/VoiceSelector';
import { ThemeToggle } from '@/components/ThemeToggle';
import { FontPicker } from '@/components/FontPicker';
import { TracingDemoGallery } from '@/components/demo/TracingDemoGallery';
import { TraceTrainer } from '@/components/trainer/TraceTrainer';

type StudioTab = 'tracing' | 'matra' | 'sentences' | 'varnamala' | 'numbers' | 'demo' | 'trainer';

interface PathStep {
  id: StudioTab;
  emoji: string;
  nepali: string;
  english: string;
  hint: string;
  /** Tailwind classes for this step's colour identity */
  color: { badge: string; active: string };
}

const LEARNING_PATH: PathStep[] = [
  {
    id: 'tracing',
    emoji: '✏️',
    nepali: 'पाटी लेखन',
    english: 'Write Letters',
    hint: 'Trace with your finger',
    color: {
      badge: 'bg-amber-400',
      active:
        'border-amber-400 bg-amber-100 ring-amber-300/50 dark:bg-amber-400/15 dark:border-amber-400/70',
    },
  },
  {
    id: 'matra',
    emoji: '🧪',
    nepali: 'मात्रा र बाह्रखरी',
    english: 'Add Matras',
    hint: 'Mix letters + signs',
    color: {
      badge: 'bg-sky-500',
      active: 'border-sky-400 bg-sky-100 ring-sky-300/50 dark:bg-sky-400/15 dark:border-sky-400/70',
    },
  },
  {
    id: 'sentences',
    emoji: '🧩',
    nepali: 'शब्द र वाक्य',
    english: 'Build Words',
    hint: 'Words & sentences',
    color: {
      badge: 'bg-emerald-500',
      active:
        'border-emerald-400 bg-emerald-100 ring-emerald-300/50 dark:bg-emerald-400/15 dark:border-emerald-400/70',
    },
  },
  {
    id: 'varnamala',
    emoji: '📖',
    nepali: 'वर्णमाला',
    english: 'All Letters',
    hint: 'Tap to listen',
    color: {
      badge: 'bg-pink-500',
      active:
        'border-pink-400 bg-pink-100 ring-pink-300/50 dark:bg-pink-400/15 dark:border-pink-400/70',
    },
  },
  {
    id: 'numbers',
    emoji: '🔢',
    nepali: 'अङ्क',
    english: 'Numbers',
    hint: 'Trace ० to १००',
    color: {
      badge: 'bg-violet-500',
      active:
        'border-violet-400 bg-violet-100 ring-violet-300/50 dark:bg-violet-400/15 dark:border-violet-400/70',
    },
  },
  {
    id: 'demo',
    emoji: '🎬',
    nepali: 'लेखाइ डेमो',
    english: 'Tracing Demo',
    hint: 'Watch every letter',
    color: {
      badge: 'bg-teal-500',
      active:
        'border-teal-400 bg-teal-100 ring-teal-300/50 dark:bg-teal-400/15 dark:border-teal-400/70',
    },
  },
  {
    id: 'trainer',
    emoji: '🧑‍🏫',
    nepali: 'लेखाइ प्रशिक्षण',
    english: 'Trace Trainer',
    hint: 'Teach the correct strokes',
    color: {
      badge: 'bg-lime-600',
      active:
        'border-lime-500 bg-lime-100 ring-lime-300/50 dark:bg-lime-400/15 dark:border-lime-400/70',
    },
  },
];

export default function AksharaStudioPage() {
  const [activeTab, setActiveTab] = useState<StudioTab>('tracing');
  const [tracingLetterId, setTracingLetterId] = useState<string>('ka');

  const handleOpenInPati = (letterId: string) => {
    setTracingLetterId(letterId);
    setActiveTab('tracing');
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-line bg-page/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              aria-hidden
              className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-3xl font-black text-white shadow-[0_4px_0_rgb(194_65_12)] -rotate-3"
            >
              अ
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-ink leading-tight">
                Akshara <span className="text-amber-500">अक्षर</span>
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-ink-soft truncate">
                नेपाली पढ्न र लेख्न सिकौं! • Let&apos;s learn Nepali!
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <FontPicker />
            <VoiceSelector />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Learning path — big, colourful steps */}
        <nav aria-label="Learning activities">
          <div
            role="tablist"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3"
          >
            {LEARNING_PATH.map((step, idx) => {
              const active = activeTab === step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls="studio-panel"
                  onClick={() => setActiveTab(step.id)}
                  className={`group relative flex items-center gap-3 rounded-3xl border-2 p-3 sm:p-4 text-left transition ${
                    active
                      ? `${step.color.active} ring-4 shadow-md`
                      : 'border-line bg-card hover:-translate-y-0.5 hover:shadow-md'
                  }`}
                >
                  <span
                    className={`step-badge absolute -top-2 -left-2 ${step.color.badge}`}
                    aria-hidden
                  >
                    {idx + 1}
                  </span>
                  <span
                    className={`text-3xl sm:text-4xl transition ${active ? 'animate-wiggle' : 'group-hover:scale-110'}`}
                    aria-hidden
                  >
                    {step.emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base sm:text-lg font-black text-ink leading-tight">
                      {step.nepali}
                    </span>
                    <span className="block text-xs sm:text-sm font-bold text-ink-soft">
                      {step.english}
                    </span>
                    <span className="hidden sm:block text-xs text-ink-faint">{step.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <section id="studio-panel" role="tabpanel" className="animate-fade-in" key={activeTab}>
          {activeTab === 'tracing' && <TracingCanvas initialLetterId={tracingLetterId} />}
          {activeTab === 'matra' && <MatraBuilder />}
          {activeTab === 'sentences' && <WordSentenceBuilder />}
          {activeTab === 'varnamala' && <VarnamalaGallery onTrace={handleOpenInPati} />}
          {activeTab === 'numbers' && <NumberStudio />}
          {activeTab === 'demo' && <TracingDemoGallery />}
          {activeTab === 'trainer' && <TraceTrainer />}
        </section>
      </main>

      <footer className="py-6 text-center text-xs text-ink-faint">
        Akshara • MIT Open Source • Made with ❤️ for young learners
      </footer>
    </div>
  );
}
