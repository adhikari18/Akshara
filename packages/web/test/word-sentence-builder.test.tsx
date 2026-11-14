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

  it('undoes the last picked tile', async () => {
    const user = userEvent.setup();
    render(<WordSentenceBuilder />);

    const undo = screen.getByRole('button', { name: /Undo/ });
    expect(undo).toBeDisabled();
    await user.click(getAksharaTile(firstWord.aksharas[0]));
    expect(undo).toBeEnabled();
    await user.click(undo);
    expect(screen.getByText(/Select the syllable tiles in order/)).toBeInTheDocument();
  });

  it('offers the next word after a correct answer', async () => {
    const user = userEvent.setup();
    render(<WordSentenceBuilder />);

    for (const akshara of firstWord.aksharas) {
      await user.click(getAksharaTile(akshara));
    }
    await user.click(screen.getByRole('button', { name: /Next word/ }));
    expect(screen.getByRole('button', { name: new RegExp(WORDS[1].meaning) })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('resets picked tiles via the reset button', async () => {
    const user = userEvent.setup();
    render(<WordSentenceBuilder />);

    await user.click(getAksharaTile(firstWord.aksharas[0]));
    await user.click(screen.getAllByRole('button', { name: /Reset/ })[0]);

    expect(screen.getByText(/Select the syllable tiles in order/)).toBeInTheDocument();
  });
});

describe('WordSentenceBuilder — game switcher', () => {
  it('switches between the word and sentence games', async () => {
    const user = userEvent.setup();
    render(<WordSentenceBuilder />);
    expect(screen.getByText(/Can you build/)).toBeInTheDocument();
    expect(screen.queryByText(/Sentence Unscrambler/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Make Sentences/ }));
    expect(screen.getByText(/Sentence Unscrambler/)).toBeInTheDocument();
  });
});

describe('WordSentenceBuilder — SOV sentence unscrambler', () => {
  // These tests open the sentences game directly; switching is covered below.
  it('accepts the canonical Subject + Object + Verb order', async () => {
    const user = userEvent.setup();
    render(<WordSentenceBuilder initialMode="sentences" />);

    await user.click(getSentenceToken('subject'));
    await user.click(getSentenceToken('object'));
    await user.click(getSentenceToken('verb'));

    expect(screen.getByText(/उत्तम!/)).toBeInTheDocument();
    expect(screen.getByText(/Perfect SOV structure/)).toBeInTheDocument();
  });

  it('coaches a learner who falls back to English SVO order', async () => {
    const user = userEvent.setup();
    render(<WordSentenceBuilder initialMode="sentences" />);

    await user.click(getSentenceToken('subject'));
    await user.click(getSentenceToken('verb'));
    await user.click(getSentenceToken('object'));

    expect(screen.getByText(/You used English SVO order/)).toBeInTheDocument();
  });

  it('lets the learner un-pick a token by tapping it again', async () => {
    const user = userEvent.setup();
    render(<WordSentenceBuilder initialMode="sentences" />);

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

describe('WordSentenceBuilder — sentences beyond 3 tokens (M9)', () => {
  const school = SENTENCES.find((s) => s.id === 'sov-6')!;
  const tokenButton = (text: string) =>
    screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('aria-pressed') !== null && b.textContent?.startsWith(text))!;

  async function openSchoolSentence() {
    const user = userEvent.setup();
    render(<WordSentenceBuilder initialMode="sentences" />);
    await user.click(
      screen.getByRole('button', { name: `Sentence ${SENTENCES.indexOf(school) + 1}` })
    );
    return user;
  }

  it('renders one answer slot and one tile per token', async () => {
    await openSchoolSentence();
    expect(screen.getAllByTestId('sentence-slot')).toHaveLength(4);
    for (const t of school.tokens) expect(tokenButton(t.text)).toBeDefined();
  });

  it('accepts the alternative order with a fronted time adverbial', async () => {
    const user = await openSchoolSentence();
    for (const w of ['आज', 'म', 'स्कुल', 'जान्छु']) await user.click(tokenButton(w));
    expect(screen.getByText(/is correct too — the verb is still last/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next sentence/ })).toBeInTheDocument();
  });

  it('coaches English SVO order in a 4-token sentence', async () => {
    const user = await openSchoolSentence();
    for (const w of ['म', 'जान्छु', 'आज', 'स्कुल']) await user.click(tokenButton(w));
    expect(screen.getByText(/You used English SVO order/)).toBeInTheDocument();
  });
});
