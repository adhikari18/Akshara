'use client';

import React, { useMemo, useState } from 'react';
import { CONSONANTS, type ConsonantEntry } from '@akshara/data';
import {
  MATRA_DEFINITIONS,
  fuseConsonantWithMatra,
  generateBarakhari,
  type MatraDefinition,
} from '@akshara/core';
import { ArrowRight, Layers, Sparkles, Volume2 } from 'lucide-react';
import { playStrokeSuccessSound, speakNepaliPhonics } from '@/lib/audio';

export function MatraBuilder() {
  const [selectedConsonantId, setSelectedConsonantId] = useState<string>('ka');
  const [selectedMatraId, setSelectedMatraId] = useState<string>('i');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const activeConsonant: ConsonantEntry = useMemo(
    () => CONSONANTS.find((c) => c.id === selectedConsonantId) ?? CONSONANTS[0],
    [selectedConsonantId]
  );

  const fused = useMemo(
    () => fuseConsonantWithMatra(activeConsonant, selectedMatraId),
    [activeConsonant, selectedMatraId]
  );

  const barakhariList = useMemo(() => generateBarakhari(activeConsonant), [activeConsonant]);

  const handleApplyMatra = (matraId: string) => {
    setSelectedMatraId(matraId);
    const result = fuseConsonantWithMatra(activeConsonant, matraId);
    playStrokeSuccessSound(false);
    speakNepaliPhonics(result.compositeAkshara, result.romanized);
  };

  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>, matra: MatraDefinition) => {
    e.dataTransfer.setData('text/plain', matra.id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDropOnAnvil = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const matraId = e.dataTransfer.getData('text/plain');
    if (matraId) {
      handleApplyMatra(matraId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Base Vyanjan Selector & Drag-and-Drop Matra Palette */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Base Consonant Selector */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                १. मूल व्यञ्जन छान्नुहोस् • Step 1: Choose Base Consonant (Vyanjan)
              </h3>
              <span className="text-xs text-slate-400">
                Selected: <strong className="text-white">{activeConsonant.character}</strong> (
                {activeConsonant.nepaliName})
              </span>
            </div>

            <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5 max-h-56 overflow-y-auto pr-1">
              {CONSONANTS.map((c) => {
                const active = c.id === selectedConsonantId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedConsonantId(c.id);
                      const nextFused = fuseConsonantWithMatra(c, selectedMatraId);
                      speakNepaliPhonics(nextFused.compositeAkshara, nextFused.romanized);
                    }}
                    className={`flex flex-col items-center py-2 px-1 rounded-xl border text-center transition ${
                      active
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xl font-bold">{c.character}</span>
                    <span className="text-[10px] text-slate-400">{c.romanized}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Draggable / Clickable Matra Diacritic Palette */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                २. मात्रा तान्नुहोस् वा थिच्नुहोस् • Step 2: Drag or Tap a Matra Diacritic
              </h3>
              <span className="text-[11px] text-slate-400">Drag onto the Pati Fusion Anvil ➔</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {MATRA_DEFINITIONS.map((m) => {
                const active = m.id === selectedMatraId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    draggable
                    onDragStart={(e) => handleDragStart(e, m)}
                    onClick={() => handleApplyMatra(m.id)}
                    className={`p-3 rounded-xl border text-left transition cursor-grab active:cursor-grabbing flex flex-col justify-between ${
                      active
                        ? 'bg-sky-500/20 border-sky-400 text-sky-100 shadow-md'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-sky-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-amber-300">
                        {m.matraSign ? `◌${m.matraSign}` : 'अ'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-300">
                        {m.position}
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="text-xs font-semibold text-white">{m.nameNepali}</div>
                      <div className="text-[11px] text-slate-400">
                        {m.vowelChar} • /{m.ipaSuffix || '∅'}/
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Matra Drop Zone Anvil & Topological Anatomy */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Pati Syllable Fusion Anvil (Drop Target) */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDropOnAnvil}
            className={`rounded-3xl p-6 border-2 transition shadow-xl flex flex-col items-center text-center ${
              isDragOver
                ? 'bg-amber-500/20 border-amber-400 scale-[1.01]'
                : 'bg-gradient-to-br from-slate-900 via-stone-900 to-slate-950 border-amber-500/30'
            }`}
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              अक्षर संयोजन पाटी • Drop Matra Here to Fuse
            </span>

            {/* Visual Fusion Equation */}
            <div className="flex items-center justify-center gap-3 sm:gap-4 my-2">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-slate-700 flex items-center justify-center text-3xl font-bold text-slate-200">
                  {fused.baseConsonant}
                </div>
                <span className="text-[11px] text-slate-400 mt-1">Base Vyanjan</span>
              </div>

              <span className="text-xl font-bold text-slate-500">+</span>

              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-sky-950/60 border border-sky-500/40 flex items-center justify-center text-3xl font-bold text-sky-300">
                  {fused.matraSign ? `◌${fused.matraSign}` : 'अ'}
                </div>
                <span className="text-[11px] text-sky-400 mt-1">
                  {fused.vowelChar} ({fused.position})
                </span>
              </div>

              <ArrowRight className="w-5 h-5 text-amber-400" />

              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-2xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-5xl font-bold text-amber-200 shadow-lg">
                  {fused.compositeAkshara}
                </div>
                <span className="text-xs font-mono font-bold text-emerald-300 mt-1">
                  {fused.romanized} ({fused.ipa})
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => speakNepaliPhonics(fused.compositeAkshara, fused.romanized)}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition shadow"
            >
              <Volume2 className="w-4 h-4" />
              उच्चारण सुन्नुहोस् • Speak &ldquo;{fused.compositeAkshara}&rdquo; ({fused.romanized})
            </button>

            {/* Topological Attachment Compass */}
            <div className="w-full mt-5 pt-4 border-t border-slate-800 text-left space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  Unicode Composition:
                </span>
                <span className="font-mono text-sky-300">{fused.unicodeSequence}</span>
              </div>

              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {(['left', 'top', 'bottom', 'right'] as const).map((pos) => {
                  const activePos = fused.position === pos;
                  return (
                    <div
                      key={pos}
                      className={`py-1.5 px-2 rounded-lg text-center text-[11px] font-mono uppercase border ${
                        activePos
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold'
                          : 'bg-slate-950/60 border-slate-800 text-slate-500'
                      }`}
                    >
                      {pos}
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-slate-300 bg-slate-950/80 border border-slate-800 rounded-xl p-3 mt-2 leading-relaxed">
                <strong className="text-amber-300">Placement Rule:</strong> {fused.pedagogicalNote}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Full 13-Step Barakhari (बाह्रखरी) Interactive Ribbon */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            पूर्ण बाह्रखरी तालिका • Complete 13-Step Barakhari for &ldquo;{activeConsonant.character}
            &rdquo; (Tap Any Card to Hear)
          </h3>
          <span className="text-xs text-slate-400">
            {barakhariList.map((b) => b.compositeAkshara).join(' • ')}
          </span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-13 gap-2">
          {barakhariList.map((item) => {
            const active = item.matraId === selectedMatraId;
            return (
              <button
                key={item.matraId}
                type="button"
                onClick={() => handleApplyMatra(item.matraId)}
                className={`flex flex-col items-center p-2.5 rounded-xl border transition ${
                  active
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-md'
                    : 'bg-slate-950/70 border-slate-800 text-slate-200 hover:border-amber-500/40'
                }`}
              >
                <span className="text-2xl font-bold">{item.compositeAkshara}</span>
                <span className="text-[11px] font-mono text-sky-300 mt-1">{item.romanized}</span>
                <span className="text-[10px] text-slate-500">{item.vowelChar}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
