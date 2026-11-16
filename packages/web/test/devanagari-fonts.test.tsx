import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NUMERAL_LIST, STROKE_LIST } from '@akshara/data';
import {
  DEVANAGARI_FONTS,
  PREETI_KEYS,
  UNICODE_FONTS,
  getFont,
  glyphText,
} from '@/lib/devanagariFonts';
import { skeletonTracks, skeletonize } from '@/components/trainer/fontGuide';
import { FontPicker } from '@/components/FontPicker';
import { TraceTrainer } from '@/components/trainer/TraceTrainer';

describe('Devanagari font registry', () => {
  it('offers the project handwriting font plus fonts loaded straight from Google Fonts', () => {
    const dls = getFont('dls');
    expect(dls.source).toBe('local');
    expect(dls.ref).toBe('fonts/dls-font.otf');
    expect(dls.encoding).toBe('preeti');
    const google = DEVANAGARI_FONTS.filter((f) => f.source === 'google');
    expect(google.length).toBeGreaterThanOrEqual(6);
    expect(google.map((f) => f.name)).toContain('Kalam');
  });

  it('maps every bundled letter and numeral onto the Preeti layout of the handwriting font', () => {
    const dls = getFont('dls');
    for (const d of [...STROKE_LIST, ...NUMERAL_LIST]) {
      expect(glyphText(dls, d.id, d.character), d.id).toBe(PREETI_KEYS[d.id]);
      expect(PREETI_KEYS[d.id], d.id).toBeTruthy();
    }
    // Unicode fonts draw the character itself
    expect(glyphText(getFont('kalam'), 'ka', 'क')).toBe('क');
  });

  it('never offers the Preeti-layout font for ordinary display text', () => {
    expect(UNICODE_FONTS.some((f) => f.encoding === 'preeti')).toBe(false);
  });
});

/** Rasterise a ring / bar into a mask for the skeleton tests. */
function mask(draw: (x: number, y: number) => boolean, size = 300) {
  const m = new Uint8Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) m[y * size + x] = draw(x, y) ? 1 : 0;
  return m;
}

describe('font glyph centreline', () => {
  it('thins a thick ring into one closed track along its middle', () => {
    const ring = mask((x, y) => {
      const r = Math.hypot(x - 150, y - 150);
      return r >= 52 && r <= 68;
    });
    const tracks = skeletonTracks(skeletonize(ring));
    const longest = tracks.reduce((a, b) => (b.points.length > a.points.length ? b : a));
    expect(longest.closed).toBe(true);
    for (const p of longest.points) {
      expect(Math.abs(Math.hypot(p.x - 150, p.y - 150) - 60)).toBeLessThan(3);
    }
  });

  it('thins a thick bar into a single straight track', () => {
    const bar = mask((x, y) => x >= 60 && x <= 240 && y >= 140 && y <= 158);
    const tracks = skeletonTracks(skeletonize(bar), 300, 20);
    expect(tracks).toHaveLength(1);
    const ys = tracks[0]!.points.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(4);
    expect(tracks[0]!.closed).toBe(false);
  });
});

describe('font pickers', () => {
  beforeEach(() => window.localStorage.clear());

  it('lets the header switch the Devanagari display font and remembers it', async () => {
    const user = userEvent.setup();
    render(<FontPicker />);
    const select = screen.getByRole('combobox', { name: 'Letter font' });
    expect(within(select).queryByRole('option', { name: /Durga Lal/ })).not.toBeInTheDocument();
    await user.selectOptions(select, 'kalam');
    expect(window.localStorage.getItem('akshara.display-font')).toBe('kalam');
  });

  it('lets the trainer pick, per letter, which font is the reference shape', async () => {
    const user = userEvent.setup();
    render(<TraceTrainer />);
    await user.click(screen.getByRole('radio', { name: 'Train २' }));
    const strip = screen.getByRole('radiogroup', { name: 'Reference font for २' });
    expect(within(strip).getByRole('radio', { name: 'Current stroke data' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    // The handwriting font shows its Preeti key, other fonts the Unicode character
    const dls = within(strip).getByRole('radio', { name: 'Durga Lal Shrestha' });
    expect(dls).toHaveTextContent('@');
    await user.click(dls);
    expect(dls).toHaveAttribute('aria-checked', 'true');

    // Another letter keeps its own choice
    await user.click(screen.getByRole('radio', { name: 'Train ३' }));
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Reference font for ३' })).getByRole('radio', {
        name: 'Kalam',
      })
    );
    expect(JSON.parse(window.localStorage.getItem('akshara.trace-trainer.fonts') ?? '{}')).toEqual({
      'num-2': 'dls',
      'num-3': 'kalam',
    });
    expect(screen.getByRole('button', { name: /Download font choices/ })).toBeEnabled();
  });
});
