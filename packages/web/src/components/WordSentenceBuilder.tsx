'use client';

import React, { useMemo, useState } from 'react';
import { SENTENCES, WORDS } from '@akshara/data';
import { evaluateSOVSentence, evaluateWordTiles, scrambleSentenceTokens } from '@akshara/core';
import { ChevronRight, RotateCcw, Undo2, Volume2 } from 'lucide-react';
import {
  playStrokeSuccessSound,
  playTopologicalWarningSound,
  speakNepaliPhonics,
} from '@/lib/audio';
import { HowToPlay } from '@/components/HowToPlay';
import { sentenceFeedbackText, sentenceRoleLabel, wordFeedbackText } from '@/lib/messages';

type WordGameMode = 'words' | 'sentences';

interface WordSentenceBuilderProps {
  initialMode?: WordGameMode;
}

export function WordSentenceBuilder({ initialMode = 'words' }: WordSentenceBuilderProps = {}) {
  const [mode, setMode] = useState<WordGameMode>(initialMode);

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

  // Deterministic scramble (English-like: verb next to the subject) that is never an accepted order
  const scrambledSentenceTokens = useMemo(
    () => scrambleSentenceTokens(activeSentence),
    [activeSentence]
  );
  // One column per token, whatever the sentence length (Tailwind can't generate dynamic classes)
  const sentenceColumns = {
    gridTemplateColumns: `repeat(${activeSentence.tokens.length}, minmax(0, 1fr))`,
  };

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

  const wordText = wordFeedbackText(wordEval.feedback);
  const sentenceText = sentenceFeedbackText(sentenceEval.feedback);

  const wordBubble = wordEval.correct
    ? 'bubble-good'
    : wordEval.complete
      ? 'bubble-bad'
      : 'bubble-neutral';
  const sentenceBubble = sentenceEval.correct
    ? 'bubble-good'
    : sentenceEval.isSVOConfusion
      ? 'bubble-warn'
      : sentenceEval.complete
        ? 'bubble-bad'
        : 'bubble-neutral';

  return (
    <div className="space-y-5">
      {/* Game switcher */}
      <div className="flex justify-center">
        <div className="segmented !p-1.5" role="tablist" aria-label="Word games">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'words'}
            onClick={() => setMode('words')}
            className={`segment !text-base !px-5 ${mode === 'words' ? 'segment-active' : ''}`}
          >
            🧩 शब्द बनाउनुहोस् • Build Words
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'sentences'}
            onClick={() => setMode('sentences')}
            className={`segment !text-base !px-5 ${mode === 'sentences' ? 'segment-active' : ''}`}
          >
            📝 वाक्य बनाउनुहोस् • Make Sentences
          </button>
        </div>
      </div>

      {mode === 'words' ? (
        <>
          <HowToPlay
            id="words"
            steps={[
              { emoji: '🖼️', text: 'Look at the picture' },
              { emoji: '👂', text: 'Listen to the word' },
              { emoji: '👆', text: 'Tap the letters in order' },
            ]}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Word chooser */}
            <div className="card lg:col-span-4">
              <h3 className="section-title mb-3">
                <span aria-hidden>🗂️</span> Choose a word
              </h3>
              <div className="grid grid-cols-3 lg:grid-cols-2 gap-2">
                {WORDS.map((w, idx) => (
                  <button
                    key={w.id}
                    type="button"
                    aria-pressed={idx === selectedWordIdx}
                    aria-label={`${w.meaning} (${w.word})`}
                    onClick={() => handleSelectWord(idx)}
                    className={`tile flex flex-col items-center p-2 ${idx === selectedWordIdx ? 'tile-active' : ''}`}
                  >
                    <span className="text-3xl" aria-hidden>
                      {w.emoji}
                    </span>
                    <span className="text-xs font-bold text-ink-soft">{w.meaning}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Word Tile Builder */}
            <div className="card lg:col-span-8 flex flex-col gap-5">
              <div className="text-center">
                <div className="text-7xl mb-2 animate-pop" key={activeWord.id} aria-hidden>
                  {activeWord.emoji}
                </div>
                <p className="text-lg sm:text-xl font-extrabold text-ink">
                  Can you build{' '}
                  <span className="text-amber-600 dark:text-amber-300">“{activeWord.meaning}”</span>
                  ?
                </p>
                <button
                  type="button"
                  onClick={() => speakNepaliPhonics(activeWord.word, activeWord.romanized)}
                  className="btn-go mt-3"
                >
                  <Volume2 className="w-5 h-5" aria-hidden />
                  Hear the word
                </button>
              </div>

              {/* Slots */}
              <div className="flex items-center justify-center gap-3" aria-label="Your word">
                {activeWord.aksharas.map((_, slotIdx) => {
                  const filled = pickedAksharas[slotIdx];
                  const isCorrectSlot = filled === activeWord.aksharas[slotIdx];
                  return (
                    <div
                      key={slotIdx}
                      className={`w-20 h-20 rounded-3xl border-4 flex items-center justify-center text-4xl font-black transition ${
                        !filled
                          ? 'border-dashed border-line bg-sunken text-ink-faint'
                          : isCorrectSlot
                            ? 'border-emerald-400 bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-100 animate-pop'
                            : 'border-rose-400 bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-100 animate-wiggle'
                      }`}
                    >
                      {filled ?? slotIdx + 1}
                    </div>
                  );
                })}
              </div>

              {/* Tile choices */}
              <div>
                <p className="text-sm font-bold text-ink-soft mb-2 text-center">
                  अक्षर थिच्नुहोस् • Tap the letters in order:
                </p>
                <div className="flex flex-wrap justify-center gap-2.5">
                  {wordTilePool.map((tile) => (
                    <button
                      key={tile.id}
                      type="button"
                      onClick={() => handlePickAkshara(tile.akshara)}
                      className="tile w-16 h-16 text-3xl font-black text-amber-700 dark:text-amber-200"
                    >
                      {tile.akshara}
                    </button>
                  ))}
                </div>
              </div>

              <div className={wordBubble} role="status" aria-live="polite">
                <span className="text-2xl leading-none" aria-hidden>
                  {wordEval.correct ? '🎉' : wordEval.complete ? '🤔' : '🦉'}
                </span>
                <div className="flex-1">
                  <div className="font-extrabold">{wordText.ne}</div>
                  <div className="text-sm opacity-80 mt-0.5">{wordText.en}</div>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setPickedAksharas((prev) => prev.slice(0, -1))}
                  disabled={pickedAksharas.length === 0}
                  className="btn-soft"
                >
                  <Undo2 className="w-5 h-5" aria-hidden />
                  Undo
                </button>
                <button type="button" onClick={() => setPickedAksharas([])} className="btn-soft">
                  <RotateCcw className="w-5 h-5" aria-hidden />
                  Reset
                </button>
                {wordEval.correct && (
                  <button
                    type="button"
                    onClick={() => handleSelectWord((selectedWordIdx + 1) % WORDS.length)}
                    className="btn-primary animate-pop"
                  >
                    Next word
                    <ChevronRight className="w-5 h-5" aria-hidden />
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <HowToPlay
            id="sentences"
            steps={[
              { emoji: '📖', text: 'Read the English sentence' },
              { emoji: '🧒', text: 'Nepali puts WHO first…' },
              { emoji: '📦', text: '…then WHAT…' },
              { emoji: '🏃', text: '…and the ACTION last!' },
            ]}
          />

          <div className="card space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="section-title">
                <span aria-hidden>📝</span> Sentence Unscrambler
              </h3>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choose a sentence">
                {SENTENCES.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={idx === selectedSentenceIdx}
                    aria-label={`Sentence ${idx + 1}`}
                    onClick={() => handleSelectSentence(idx)}
                    className={`tile min-w-[44px] min-h-[44px] px-2 text-xl ${idx === selectedSentenceIdx ? 'tile-active' : ''}`}
                  >
                    {s.emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt */}
            <div className="rounded-3xl bg-sunken border border-line p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-ink-faint">Make this in Nepali:</div>
                <div className="text-xl sm:text-2xl font-black text-ink mt-0.5">
                  {activeSentence.emoji} “{activeSentence.englishTranslation}”
                </div>
                <div className="text-xs text-ink-faint mt-1">
                  English order: {activeSentence.englishOrder}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  speakNepaliPhonics(activeSentence.nepaliSentence, activeSentence.romanized)
                }
                className="btn-go shrink-0"
              >
                <Volume2 className="w-5 h-5" aria-hidden />
                Hear Sentence
              </button>
            </div>

            {/* Answer slots: one per token. Nepali is verb-final, so the last slot is the verb's. */}
            <div className="grid gap-2 sm:gap-3" style={sentenceColumns}>
              {activeSentence.tokens.map((_, slotIdx) => {
                const tokenId = pickedTokenIds[slotIdx];
                const token = activeSentence.tokens.find((t) => t.id === tokenId);
                const isLast = slotIdx === activeSentence.tokens.length - 1;
                const role = token ? sentenceRoleLabel(token.role) : null;
                const verbHint = sentenceRoleLabel('verb');
                return (
                  <div
                    key={slotIdx}
                    data-testid="sentence-slot"
                    className={`rounded-3xl border-4 p-2 sm:p-3 text-center min-h-[110px] flex flex-col items-center justify-center transition ${
                      !token
                        ? 'border-dashed border-line bg-sunken'
                        : 'border-sky-400 bg-sky-50 dark:bg-sky-400/10 animate-pop'
                    }`}
                  >
                    {role ? (
                      <span className="text-xs font-black text-ink-faint">
                        {slotIdx + 1}. {role.emoji} {role.ne} · {role.en}
                      </span>
                    ) : (
                      <span className="text-xs font-black text-ink-faint">
                        {slotIdx + 1}.{' '}
                        {isLast ? `${verbHint.emoji} ${verbHint.ne} · goes last` : ''}
                      </span>
                    )}
                    {token ? (
                      <div className="mt-1">
                        <div className="text-2xl font-black text-ink">{token.text}</div>
                        <div className="text-xs text-ink-soft">{token.romanized}</div>
                      </div>
                    ) : (
                      <span className="text-2xl text-ink-faint/50 mt-1" aria-hidden>
                        ?
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Token cards */}
            <div>
              <p className="text-sm font-bold text-ink-soft mb-2 text-center">
                शब्द थिच्नुहोस् • Tap the words (tap again to take back):
              </p>
              <div className="grid gap-2 sm:gap-3" style={sentenceColumns}>
                {scrambledSentenceTokens.map((token) => {
                  const isPicked = pickedTokenIds.includes(token.id);
                  return (
                    <button
                      key={token.id}
                      type="button"
                      aria-pressed={isPicked}
                      onClick={() => handleToggleSentenceToken(token.id)}
                      className={`tile p-3 text-center ${isPicked ? 'opacity-40 !border-sky-400' : ''}`}
                    >
                      <div className="text-2xl font-black text-amber-700 dark:text-amber-200">
                        {token.text}
                      </div>
                      <div className="text-sm font-semibold text-ink-soft">{token.romanized}</div>
                      <div className="text-xs text-ink-faint mt-0.5">
                        &ldquo;{token.gloss}&rdquo;
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={sentenceBubble} role="status" aria-live="polite">
              <span className="text-2xl leading-none" aria-hidden>
                {sentenceEval.correct
                  ? '🎉'
                  : sentenceEval.isSVOConfusion
                    ? '💡'
                    : sentenceEval.complete
                      ? '🤔'
                      : '🦉'}
              </span>
              <div className="flex-1">
                <div className="font-extrabold">{sentenceText.ne}</div>
                <div className="text-sm opacity-80 mt-0.5">{sentenceText.en}</div>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => setPickedTokenIds([])} className="btn-soft">
                <RotateCcw className="w-5 h-5" aria-hidden />
                Reset
              </button>
              {sentenceEval.correct && (
                <button
                  type="button"
                  onClick={() => handleSelectSentence((selectedSentenceIdx + 1) % SENTENCES.length)}
                  className="btn-primary animate-pop"
                >
                  Next sentence
                  <ChevronRight className="w-5 h-5" aria-hidden />
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
