import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SENTENCES, WORDS } from '@akshara/data';
import { WordSentenceBuilder } from '@/components/WordSentenceBuilder';

const firstWord = WORDS[0];
const firstSentence = SENTENCES[0];

/** Word tiles are buttons whose entire label is a single akshara (e.g. "घ"). */
function getAksharaTile(akshara: string): HTMLElement {
  const tile = screen.getAllByRole('button').find((b) => b.textContent?.trim() === akshara);
  if (!tile) throw new Error(`No tile button for akshara '${akshara}'`);
  return tile;
}

/** Sentence token cards show the word, its romanization and its gloss. */
function getSentenceToken(role: 'subject' | 'object' | 'verb'): HTMLElement {
  const token = firstSentence.tokens.find((t) => t.role === role)!;
  const button = screen
    .getAllByRole('button')
    .find(
      (b) => b.textContent?.includes(token.romanized) && b.textContent?.includes(`“${token.gloss}”`)
    );
  if (!button) throw new Error(`No token button for role '${role}'`);
  return button;
}

describe('WordSentenceBuilder — word tiles', () => {
  it('celebrates when the aksharas are tapped in the correct order', async () => {
    const user = userEvent.setup();
    render(<WordSentenceBuilder />);

    for (const akshara of firstWord.aksharas) {
      await user.click(getAksharaTile(akshara));
    }

    expect(screen.getByText(/स्याबास!/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`built '${firstWord.word}'`))).toBeInTheDocument();
  });

  it('flags a completed word assembled in the wrong order', async () => {
    const user = userEvent.setup();
    render(<WordSentenceBuilder />);

    for (const akshara of [...firstWord.aksharas].reverse()) {
      await user.click(getAksharaTile(akshara));
    }

    expect(screen.getByText(/क्रम मिलेन/)).toBeInTheDocument();
    expect(screen.getByText(/try again/i)).toBeInTheDocument();
  });

  it('resets picked tiles via the reset button', async () => {
    const user = userEvent.setup();
    render(<WordSentenceBuilder />);

    await user.click(getAksharaTile(firstWord.aksharas[0]));
    await user.click(screen.getAllByRole('button', { name: /Reset/ })[0]);

    expect(screen.getByText(/Select the syllable tiles in order/)).toBeInTheDocument();
  });
});

describe('WordSentenceBuilder — SOV sentence unscrambler', () => {
  it('accepts the canonical Subject + Object + Verb order', async () => {
    const user = userEvent.setup();
    render(<WordSentenceBuilder />);

    await user.click(getSentenceToken('subject'));
    await user.click(getSentenceToken('object'));
    await user.click(getSentenceToken('verb'));

    expect(screen.getByText(/उत्तम!/)).toBeInTheDocument();
    expect(screen.getByText(/Perfect SOV structure/)).toBeInTheDocument();
  });

  it('coaches a learner who falls back to English SVO order', async () => {
    const user = userEvent.setup();
    render(<WordSentenceBuilder />);

    await user.click(getSentenceToken('subject'));
    await user.click(getSentenceToken('verb'));
    await user.click(getSentenceToken('object'));

    expect(screen.getByText(/You used English SVO order/)).toBeInTheDocument();
  });

  it('lets the learner un-pick a token by tapping it again', async () => {
    const user = userEvent.setup();
    render(<WordSentenceBuilder />);

    const subject = getSentenceToken('subject');
    await user.click(subject);
    const subjectText = firstSentence.tokens.find((t) => t.role === 'subject')!.text;
    // Token now occupies slot 1
    expect(screen.getAllByText(subjectText).length).toBeGreaterThan(1);

    await user.click(subject);
    // Back to the neutral instruction state
    expect(screen.getByText(/Arrange the tiles in Nepali SOV order/)).toBeInTheDocument();
  });
});
