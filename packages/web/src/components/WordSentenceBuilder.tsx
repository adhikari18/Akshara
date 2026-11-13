'use client';

import React, { useMemo, useState } from 'react';
import { SENTENCES, WORDS } from '@akshara/data';
import { evaluateSOVSentence, evaluateWordTiles } from '@akshara/core';
import { CheckCircle2, Puzzle, RotateCcw, Sparkles, Volume2 } from 'lucide-react';
import {
  playStrokeSuccessSound,
  playTopologicalWarningSound,
  speakNepaliPhonics,
} from '@/lib/audio';

export function WordSentenceBuilder() {
  // Word Builder State
  const [selectedWordIdx, setSelectedWordIdx] = useState<number>(0);
  const [pickedAksharas, setPickedAksharas] = useState<string[]>([]);

  // SOV Sentence Unscrambler State
  const [selectedSentenceIdx, setSelectedSentenceIdx] = useState<number>(0);
  const [pickedTokenIds, setPickedTokenIds] = useState<string[]>([]);

  const activeWord = WORDS[selectedWordIdx] ?? WORDS[0];
  const activeSentence = SENTENCES[selectedSentenceIdx] ?? SENTENCES[0];

  // Deterministic shuffled tile pool for the active word
  const wordTilePool = useMemo(() => {
    const combined = [...activeWord.aksharas, ...activeWord.distractors];
    return combined
      .map((ak, idx) => ({
        id: `${activeWord.id}-tile-${idx}`,
        akshara: ak,
        sortKey: (idx * 7 + activeWord.word.length * 3) % 11,
      }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [activeWord]);

  // Deterministic scrambled order (SVO-like or reversed) so learner unscrambles into SOV
  const scrambledSentenceTokens = useMemo(() => {
    const tokens = [...activeSentence.tokens];
    // Present in English SVO order (Subject, Verb, Object) so learner practices converting to Nepali SOV!
    if (tokens.length === 3) {
      return [tokens[0], tokens[2], tokens[1]];
    }
    return tokens;
  }, [activeSentence]);

  const wordEval = useMemo(
    () => evaluateWordTiles(activeWord, pickedAksharas),
    [activeWord, pickedAksharas]
  );

  const sentenceEval = useMemo(
    () => evaluateSOVSentence(activeSentence, pickedTokenIds),
    [activeSentence, pickedTokenIds]
  );

  const handleSelectWord = (idx: number) => {
    setSelectedWordIdx(idx);
    setPickedAksharas([]);
  };

  const handlePickAkshara = (ak: string) => {
    if (pickedAksharas.length >= activeWord.aksharas.length) return;
    const next = [...pickedAksharas, ak];
    setPickedAksharas(next);
    speakNepaliPhonics(ak);

    const res = evaluateWordTiles(activeWord, next);
    if (res.complete) {
      if (res.correct) {
        playStrokeSuccessSound(true);
        speakNepaliPhonics(activeWord.word, activeWord.romanized);
      } else {
        playTopologicalWarningSound();
      }
    }
  };

  const handleSelectSentence = (idx: number) => {
    setSelectedSentenceIdx(idx);
    setPickedTokenIds([]);
  };

  const handleToggleSentenceToken = (tokenId: string) => {
    if (pickedTokenIds.includes(tokenId)) {
      setPickedTokenIds(pickedTokenIds.filter((id) => id !== tokenId));
      return;
    }
    const token = activeSentence.tokens.find((t) => t.id === tokenId);
    if (token) {
      speakNepaliPhonics(token.text, token.romanized);
    }
    const next = [...pickedTokenIds, tokenId];
    setPickedTokenIds(next);

    const res = evaluateSOVSentence(activeSentence, next);
    if (res.complete) {
      if (res.correct) {
        playStrokeSuccessSound(true);
        speakNepaliPhonics(activeSentence.nepaliSentence, activeSentence.romanized);
      } else {
        playTopologicalWarningSound();
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: 2- & 3-Letter Noun Building Blocks */}
      <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <Puzzle className="w-4 h-4" />
              भाग १: २ र ३ अक्षरका शब्द निर्माण • Word Tile Builder
            </span>
            <button
              type="button"
              onClick={() => setPickedAksharas([])}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>

          {/* Word Selector Pills */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {WORDS.map((w, idx) => (
              <button
                key={w.id}
                type="button"
                onClick={() => handleSelectWord(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition flex items-center gap-1.5 ${
                  idx === selectedWordIdx
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-semibold'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{w.emoji}</span>
                <span>{w.word}</span>
                <span className="text-[10px] opacity-75">({w.meaning})</span>
              </button>
            ))}
          </div>

          {/* Target Word Card */}
          <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-5 text-center mb-4">
            <div className="text-4xl mb-2">{activeWord.emoji}</div>
            <div className="text-sm font-semibold text-white">
              Build the Nepali word for:{' '}
              <span className="text-amber-300">{activeWord.meaning}</span> ({activeWord.romanized})
            </div>
            <button
              type="button"
              onClick={() => speakNepaliPhonics(activeWord.word, activeWord.romanized)}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Hear Target Word ({activeWord.word})
            </button>

            {/* Assembly Slots */}
            <div className="flex items-center justify-center gap-3 mt-5">
              {activeWord.aksharas.map((_, slotIdx) => {
                const filled = pickedAksharas[slotIdx];
                const isCorrectSlot = filled === activeWord.aksharas[slotIdx];
                return (
                  <div
                    key={slotIdx}
                    className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-3xl font-bold transition ${
                      !filled
                        ? 'border-dashed border-slate-700 bg-slate-900/50 text-slate-600'
                        : isCorrectSlot
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                          : 'border-red-400 bg-red-500/20 text-red-200'
                    }`}
                  >
                    {filled ?? slotIdx + 1}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Akshara Tile Choices */}
          <div className="mb-4">
            <div className="text-xs text-slate-400 mb-2">
              तलका अक्षरहरू सही क्रममा छान्नुहोस् • Tap Akshara Tiles in Order:
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
              {wordTilePool.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => handlePickAkshara(tile.akshara)}
                  className="py-3 rounded-xl bg-slate-950 border border-slate-700 hover:border-amber-400 text-2xl font-bold text-amber-200 hover:bg-amber-500/10 transition"
                >
                  {tile.akshara}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Word Evaluation Feedback */}
        <div
          className={`p-3.5 rounded-xl border text-xs ${
            wordEval.correct
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
              : wordEval.complete
                ? 'bg-red-950/50 border-red-500/40 text-red-200'
                : 'bg-slate-950/70 border-slate-800 text-slate-300'
          }`}
        >
          <div className="font-semibold">{wordEval.feedbackNepali}</div>
          <div className="text-slate-400 mt-0.5">{wordEval.feedbackEnglish}</div>
        </div>
      </div>

      {/* Right Column: Subject-Object-Verb (SOV) Sentence Unscrambler */}
      <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sky-400">
              <Sparkles className="w-4 h-4" />
              भाग २: नेपाली वाक्य संरचना (SOV) • Sentence Unscrambler
            </span>
            <button
              type="button"
              onClick={() => setPickedTokenIds([])}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>

          {/* Sentence Selector Pills */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {SENTENCES.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelectSentence(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                  idx === selectedSentenceIdx
                    ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-semibold'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {s.emoji} वाक्य #{idx + 1}
              </button>
            ))}
          </div>

          {/* English vs Nepali SOV Grammar Prompt */}
          <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-5 mb-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-400">
                  Translate &amp; Arrange in Nepali SOV Order:
                </div>
                <div className="text-base font-bold text-white mt-0.5">
                  {activeSentence.emoji} &ldquo;{activeSentence.englishTranslation}&rdquo;
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  speakNepaliPhonics(activeSentence.nepaliSentence, activeSentence.romanized)
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition shrink-0"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Hear Sentence
              </button>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 text-slate-400">
                <strong className="text-slate-200">English (SVO):</strong>{' '}
                {activeSentence.englishOrder}
              </div>
              <div className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 text-amber-200">
                <strong className="text-amber-300">Nepali (SOV):</strong> कर्ता (S) ➔ कर्म (O) ➔ क्रिया
                (V)
              </div>
            </div>

            {/* 3 Grammatical SOV Drop Slots */}
            <div className="grid grid-cols-3 gap-2.5 mt-4">
              {(['कर्ता (Subject)', 'कर्म (Object)', 'क्रिया (Verb)'] as const).map(
                (slotLabel, slotIdx) => {
                  const tokenId = pickedTokenIds[slotIdx];
                  const token = activeSentence.tokens.find((t) => t.id === tokenId);
                  return (
                    <div
                      key={slotLabel}
                      className={`p-3 rounded-xl border-2 text-center min-h-[76px] flex flex-col items-center justify-center transition ${
                        !token
                          ? 'border-dashed border-slate-700 bg-slate-900/40'
                          : 'border-sky-400 bg-sky-500/15'
                      }`}
                    >
                      <span className="text-[10px] font-mono uppercase text-slate-400">
                        {slotIdx + 1}. {slotLabel}
                      </span>
                      {token ? (
                        <div className="mt-1">
                          <div className="text-lg font-bold text-amber-200">{token.text}</div>
                          <div className="text-[10px] text-sky-300">
                            {token.romanized} ({token.gloss})
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600 mt-1">Empty Slot</span>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* Scrambled Word Token Cards */}
          <div className="mb-4">
            <div className="text-xs text-slate-400 mb-2">
              तलका शब्दहरू नेपाली (SOV) क्रममा छान्नुहोस् • Tap Word Tiles to Arrange:
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {scrambledSentenceTokens.map((token) => {
                const isPicked = pickedTokenIds.includes(token.id);
                return (
                  <button
                    key={token.id}
                    type="button"
                    onClick={() => handleToggleSentenceToken(token.id)}
                    className={`p-3 rounded-xl border text-center transition ${
                      isPicked
                        ? 'bg-sky-500/20 border-sky-400 text-sky-200 opacity-60'
                        : 'bg-slate-950 border-slate-700 hover:border-amber-400 text-white'
                    }`}
                  >
                    <div className="text-xl font-bold text-amber-200">{token.text}</div>
                    <div className="text-xs text-slate-300 mt-0.5">{token.romanized}</div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      &ldquo;{token.gloss}&rdquo; • {token.nepaliRole}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* SOV Evaluation Feedback */}
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
            sentenceEval.correct
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
              : sentenceEval.isSVOConfusion
                ? 'bg-amber-950/60 border-amber-500/50 text-amber-200'
                : sentenceEval.complete
                  ? 'bg-red-950/50 border-red-500/40 text-red-200'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <div>
            <div className="font-semibold">{sentenceEval.feedbackNepali}</div>
            <div className="text-slate-400 mt-0.5">{sentenceEval.feedbackEnglish}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
