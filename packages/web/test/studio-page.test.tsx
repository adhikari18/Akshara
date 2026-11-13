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

    await user.click(screen.getByRole('button', { name: /मात्रा र बाह्रखरी/ }));
    expect(screen.getByText(/Step 1: Choose Base Consonant/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /शब्द र वाक्य/ }));
    expect(screen.getByText(/Sentence Unscrambler/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /वर्णमाला/ }));
    expect(screen.getByText(/Swor Varna \(13 Nepali Vowels/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /पाटी लेखन/ }));
    expect(screen.getByRole('img', { name: /Pati slate/ })).toBeInTheDocument();
  });
});
