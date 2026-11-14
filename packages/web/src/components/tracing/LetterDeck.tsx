'use client';

import React from 'react';
import { STROKE_LIST, type LetterStrokeDataset } from '@akshara/data';

export type DeckCategoryFilter = 'all' | 'swor' | 'vyanjan';

/** Samyukta compounds (क्ष, त्र, ज्ञ) are taught as the last letters of the Vyanjan Varna deck. */
function deckCategoryOf(
  category: LetterStrokeDataset['category']
): Exclude<DeckCategoryFilter, 'all'> {
  return category === 'swor' ? 'swor' : 'vyanjan';
}

/** The letters shown for a deck filter, in teaching order. */
export function filterDeck(filter: DeckCategoryFilter): LetterStrokeDataset[] {
  return filter === 'all'
    ? STROKE_LIST
    : STROKE_LIST.filter((item) => deckCategoryOf(item.category) === filter);
}

/** The letter `offset` steps from `currentId` within `deck`, wrapping around. */
export function stepThroughDeck(
  deck: LetterStrokeDataset[],
  currentId: string,
  offset: number
): LetterStrokeDataset | null {
  if (deck.length === 0) return null;
  const from = Math.max(
    0,
    deck.findIndex((item) => item.id === currentId)
  );
  return deck[(((from + offset) % deck.length) + deck.length) % deck.length];
}

const FILTER_TABS: Array<{ id: DeckCategoryFilter; label: string; count: number }> = [
  { id: 'all', label: 'सबै All', count: STROKE_LIST.length },
  { id: 'swor', label: 'स्वर Vowels', count: filterDeck('swor').length },
  { id: 'vyanjan', label: 'व्यञ्जन Consonants', count: filterDeck('vyanjan').length },
];

interface LetterDeckProps {
  filter: DeckCategoryFilter;
  onFilterChange: (filter: DeckCategoryFilter) => void;
  selectedLetterId: string;
  onSelectLetter: (letterId: string) => void;
}

/** "Pick a letter" card: vowel/consonant filter plus the grid of letter tiles. */
export function LetterDeck({
  filter,
  onFilterChange,
  selectedLetterId,
  onSelectLetter,
}: LetterDeckProps) {
  const letters = filterDeck(filter);

  return (
    <div className="card">
      <h3 className="section-title mb-3">
        <span aria-hidden>🔤</span> अक्षर छान्नुहोस् • Pick a letter
      </h3>
      <div className="segmented mb-3" role="group" aria-label="Letter group">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={filter === tab.id}
            onClick={() => onFilterChange(tab.id)}
            className={`segment ${filter === tab.id ? 'segment-active' : ''}`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      <div
        className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-5 gap-2 max-h-72 overflow-y-auto p-1 -m-1"
        role="group"
        aria-label="Letters"
      >
        {letters.map((item) => {
          const active = item.id === selectedLetterId;
          return (
            <button
              key={item.id}
              type="button"
              data-testid="letter-tile"
              aria-pressed={active}
              aria-label={`${item.character} (${item.phonetics.romanized})`}
              onClick={() => onSelectLetter(item.id)}
              className={`tile flex flex-col items-center justify-center py-2 ${active ? 'tile-active' : ''}`}
            >
              <span className="text-2xl font-black leading-tight">{item.character}</span>
              <span className="text-[11px] font-semibold text-ink-faint">
                {item.phonetics.romanized}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
