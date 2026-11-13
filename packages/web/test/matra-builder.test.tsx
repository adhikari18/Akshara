import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MatraBuilder } from '@/components/MatraBuilder';

describe('MatraBuilder', () => {
  it('shows the default का…कि fusion for the base consonant क', () => {
    render(<MatraBuilder />);

    // Default: क + ि = कि — the speak button carries the composite syllable
    expect(screen.getByRole('button', { name: /Speak[\s\S]*कि/ })).toBeInTheDocument();
    // Unicode composition formula is visible
    expect(screen.getByText(/U\+0915/)).toBeInTheDocument();
  });

  it('fuses a newly tapped matra onto the selected consonant', async () => {
    const user = userEvent.setup();
    render(<MatraBuilder />);

    // Tap the okar (ो) matra card from the palette
    const matraButtons = screen.getAllByRole('button');
    const okar = matraButtons.find(
      (b) => b.textContent?.includes('◌ो') && b.textContent?.includes('ओ')
    );
    expect(okar).toBeDefined();
    await user.click(okar!);

    expect(screen.getByRole('button', { name: /Speak[\s\S]*को/ })).toBeInTheDocument();
  });

  it('re-fuses the active matra when the base consonant changes', async () => {
    const user = userEvent.setup();
    render(<MatraBuilder />);

    // Switch base consonant to ग (ga); active matra stays ि -> गि
    const ga = screen
      .getAllByRole('button')
      .find((b) => b.textContent?.startsWith('ग') && b.textContent?.includes('ga'));
    expect(ga).toBeDefined();
    await user.click(ga!);

    expect(screen.getByRole('button', { name: /Speak[\s\S]*गि/ })).toBeInTheDocument();
  });

  it('renders the full 13-step barakhari ribbon for the active consonant', () => {
    render(<MatraBuilder />);
    // का कि की कु कू ... all derived from क
    for (const syllable of ['का', 'की', 'कु', 'कू', 'के', 'कै', 'को', 'कौ']) {
      expect(screen.getAllByText(syllable).length).toBeGreaterThan(0);
    }
  });
});
