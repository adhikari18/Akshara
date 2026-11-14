import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AksharaStudioPage from '@/app/page';

describe('AksharaStudioPage', () => {
  it('opens on the Pati tracing studio', () => {
    render(<AksharaStudioPage />);
    expect(screen.getByRole('heading', { name: /Akshara/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Pati slate/ })).toBeInTheDocument();
  });

  it('navigates across all four pedagogical tabs', async () => {
    const user = userEvent.setup();
    render(<AksharaStudioPage />);

    await user.click(screen.getByRole('tab', { name: /मात्रा र बाह्रखरी/ }));
    expect(screen.getByRole('heading', { name: /Pick a letter/ })).toBeInTheDocument();
    expect(screen.getByText(/Add a matra sign/)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /शब्द र वाक्य/ }));
    expect(screen.getByText(/Can you build/)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /Make Sentences/ }));
    expect(screen.getByText(/Sentence Unscrambler/)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /वर्णमाला/ }));
    expect(screen.getByText(/Swor Varna \(13 Nepali Vowels/)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /पाटी लेखन/ }));
    expect(screen.getByRole('img', { name: /Pati slate/ })).toBeInTheDocument();
  });

  it('marks the active learning-path step as selected', async () => {
    const user = userEvent.setup();
    render(<AksharaStudioPage />);
    expect(screen.getByRole('tab', { name: /पाटी लेखन/ })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('tab', { name: /वर्णमाला/ }));
    expect(screen.getByRole('tab', { name: /वर्णमाला/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /पाटी लेखन/ })).toHaveAttribute('aria-selected', 'false');
  });

  it('opens a consonant from the alphabet gallery on the Pati slate', async () => {
    const user = userEvent.setup();
    render(<AksharaStudioPage />);
    await user.click(screen.getByRole('tab', { name: /वर्णमाला/ }));
    await user.click(screen.getByRole('button', { name: 'Trace ख' }));
    expect(screen.getByRole('img', { name: 'Pati slate for tracing ख' })).toBeInTheDocument();
  });
});
