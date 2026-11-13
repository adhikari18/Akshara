'use client';

import React, { useState } from 'react';
import { CONSONANTS, VOWELS } from '@akshara/data';
import { BookOpen, Feather, Layers, Puzzle, Volume2 } from 'lucide-react';
import { TracingCanvas } from '@/components/TracingCanvas';
import { MatraBuilder } from '@/components/MatraBuilder';
import { WordSentenceBuilder } from '@/components/WordSentenceBuilder';
import { VoiceSelector } from '@/components/VoiceSelector';
import { speakNepaliPhonics } from '@/lib/audio';

type StudioTab = 'tracing' | 'matra' | 'sentences' | 'varnamala';

export default function AksharaStudioPage() {
  const [activeTab, setActiveTab] = useState<StudioTab>('tracing');
  const [tracingLetterId, setTracingLetterId] = useState<string>('ka');

  const handleOpenInPati = (letterId: string) => {
    setTracingLetterId(letterId);
    setActiveTab('tracing');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#090d16] via-[#0f172a] to-[#090d16]">
      {/* Top Header */}
      <header className="border-b border-amber-500/20 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-2xl font-extrabold text-slate-950 shadow-lg shadow-amber-500/20">
              अ
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  Akshara <span className="text-amber-400 font-normal">(अक्षर)</span>
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono uppercase rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  MIT Open Source
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Tactile Devanagari Vector Stroke Tracing, Barakhari Matra Fusion &amp; SOV Sentence
                Studio
              </p>
            </div>
          </div>

          {/* 4-Stage Pedagogical Navigation Tabs & Voice Selector */}
          <div className="flex flex-wrap items-center gap-2.5">
            <nav className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('tracing')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'tracing'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Feather className="w-3.5 h-3.5" />
                1. पाटी लेखन (Pati Tracing)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('matra')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'matra'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                2. मात्रा र बाह्रखरी (Matra Fusion)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('sentences')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'sentences'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Puzzle className="w-3.5 h-3.5" />
                3. शब्द र वाक्य (Words &amp; SOV)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('varnamala')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  activeTab === 'varnamala'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                4. वर्णमाला (Full Varnamala)
              </button>
            </nav>

            <VoiceSelector />
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'tracing' && <TracingCanvas initialLetterId={tracingLetterId} />}
        {activeTab === 'matra' && <MatraBuilder />}
        {activeTab === 'sentences' && <WordSentenceBuilder />}

        {activeTab === 'varnamala' && (
          <div className="space-y-6">
            {/* Swor Varna (13 Vowels) */}
            <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-amber-300">
                    स्वर वर्ण • Swor Varna (13 Nepali Vowels: अ — अः)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Tap any vowel card to hear its pronunciation, inspect its Matra diacritic, or
                    trace it directly on the Pati slate.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  13/13 Vector Strokes Ready
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {VOWELS.map((v) => (
                  <div
                    key={v.id}
                    className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-amber-400/60 text-left transition group flex flex-col justify-between"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        speakNepaliPhonics(`${v.character} — ${v.sampleWord}`, v.romanized)
                      }
                      className="text-left w-full"
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-3xl font-bold text-amber-200 group-hover:text-amber-300">
                          {v.character}
                        </span>
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">
                          {v.matra ? `◌${v.matra}` : 'अ'}
                        </span>
                      </div>
                      <div className="mt-2">
                        <div className="text-xs font-semibold text-white">
                          {v.romanized} <span className="text-slate-400 font-mono">{v.ipa}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                          <span>{v.emoji}</span>
                          <span className="text-amber-200/90 font-medium">{v.sampleWord}</span>
                          <span>({v.sampleWordMeaning})</span>
                        </div>
                      </div>
                    </button>
                    {v.hasStrokeData && (
                      <button
                        type="button"
                        onClick={() => handleOpenInPati(v.id)}
                        className="mt-2.5 w-full py-1 px-2 rounded-lg text-[11px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition flex items-center justify-center gap-1"
                      >
                        <Feather className="w-3 h-3" />
                        पाटीमा लेख्नुहोस् (Trace)
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Vyanjan Varna (36 Consonants) */}
            <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-sky-300">
                    व्यञ्जन वर्ण • Vyanjan Varna (36 Nepali Consonants: क — ज्ञ)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Organized by Paninian articulatory Varga (Velar, Palatal, Retroflex, Dental,
                    Labial, Approximant, Sibilant &amp; Conjunct).
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-mono bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  36 Vyanjan Varna
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {CONSONANTS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      speakNepaliPhonics(`${c.character} — ${c.nepaliName}`, c.romanized)
                    }
                    className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-sky-400/60 text-left transition group flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-3xl font-bold text-white group-hover:text-amber-300">
                        {c.character}
                      </span>
                      <Volume2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400" />
                    </div>
                    <div className="mt-2">
                      <div className="text-xs font-semibold text-amber-200">{c.nepaliName}</div>
                      <div className="text-[11px] font-mono text-sky-300">
                        {c.romanized} • {c.ipa}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {c.emoji} {c.sampleWord} ({c.sampleWordMeaning})
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
