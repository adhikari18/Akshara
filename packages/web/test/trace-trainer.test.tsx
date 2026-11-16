import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NUMERAL_DATASETS, NUMERAL_LIST, validateLetterDataset } from '@akshara/data';
import { sampleStrokePath } from '@akshara/core';
import { parseSvgPath } from '@akshara/data/svg-path';
import { TraceTrainer } from '@/components/trainer/TraceTrainer';
import {
  buildCorrectedDataset,
  fitStrokePath,
  guessStrokeType,
  simplify,
  toSvgPath,
} from '@/components/trainer/traceFit';

const two = NUMERAL_DATASETS['num-2']!;

/** Draw a gesture on the trainer slate as pointer events (logical coordinates in jsdom). */
function draw(canvas: HTMLElement, points: Array<{ x: number; y: number }>) {
  fireEvent.pointerDown(canvas, { pointerId: 1, clientX: points[0]!.x, clientY: points[0]!.y });
  for (const p of points.slice(1))
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: p.x, clientY: p.y });
  const last = points[points.length - 1]!;
  fireEvent.pointerUp(canvas, { pointerId: 1, clientX: last.x, clientY: last.y });
}

describe('traceFit', () => {
  it('turns a jittery hand-drawn arc into a short, smooth cubic path', () => {
    const arc = Array.from({ length: 80 }, (_, i) => {
      const t = (i / 79) * Math.PI;
      return { x: 150 - 80 * Math.cos(t) + (i % 2) * 1.5, y: 150 - 60 * Math.sin(t) + (i % 3) };
    });
    const path = fitStrokePath(arc, 'curve');
    const segments = parseSvgPath(path);
    expect(segments.length).toBeLessThan(arc.length / 3);
    expect(segments.length).toBeGreaterThan(2);
    expect(path.startsWith('M 70 1')).toBe(true);
    expect(path).not.toMatch(/\d\.\d/); // integer coordinates
  });

  it('writes stems and headlines as straight lines', () => {
    expect(
      fitStrokePath(
        [
          { x: 150, y: 80 },
          { x: 152, y: 150 },
          { x: 149, y: 230 },
        ],
        'stem'
      )
    ).toBe('M 150 80 L 149 230');
    expect(
      fitStrokePath(
        [
          { x: 60, y: 74 },
          { x: 150, y: 77 },
          { x: 240, y: 76 },
        ],
        'shirorekha'
      )
    ).toBe('M 60 75 L 240 75');
  });

  it('keeps only the corners of a polyline and emits a line for two points', () => {
    expect(
      simplify(
        [
          { x: 0, y: 0 },
          { x: 50, y: 0.4 },
          { x: 100, y: 0 },
        ],
        1
      )
    ).toHaveLength(2);
    expect(
      toSvgPath([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ])
    ).toBe('M 0 0 L 10 10');
  });

  it('guesses stem / diagonal / curve from the shape', () => {
    expect(
      guessStrokeType(
        [
          { x: 150, y: 80 },
          { x: 151, y: 230 },
        ],
        two
      )
    ).toBe('stem');
    expect(
      guessStrokeType(
        [
          { x: 80, y: 80 },
          { x: 220, y: 230 },
        ],
        two
      )
    ).toBe('diagonal');
    const arc = sampleStrokePath(two.strokes[0]!, 4);
    expect(guessStrokeType(arc, two)).toBe('curve');
  });

  it('builds a valid dataset from drawn strokes, keeping the glyph metadata', () => {
    const corrected = buildCorrectedDataset(two, [
      {
        points: sampleStrokePath(two.strokes[0]!, 3),
        type: 'curve',
        label: 'Whole two',
        nepaliInstruction: 'एकै पटकमा दुई लेख्नुहोस्।',
        englishInstruction: 'Write the two in one go.',
      },
    ]);
    expect(corrected.id).toBe('num-2');
    expect(corrected.character).toBe('२');
    expect(corrected.phonetics).toEqual(two.phonetics);
    expect(corrected.strokes).toHaveLength(1);
    expect(corrected.strokes[0]!.id).toBe('num-2-stroke-1');
    expect(corrected.strokes[0]!.label).toBe('Whole two');
    expect(corrected.strokes[0]!.waypoints.length).toBeGreaterThanOrEqual(3);
    expect(validateLetterDataset(corrected).errors).toEqual([]);
  });
});

describe('TraceTrainer', () => {
  beforeEach(() => window.localStorage.clear());

  it('opens on the numerals and lets the author pick one', async () => {
    const user = userEvent.setup();
    render(<TraceTrainer />);
    const picker = screen.getByRole('radiogroup', { name: 'Pick a number' });
    expect(within(picker).getAllByRole('radio')).toHaveLength(NUMERAL_LIST.length);
    await user.click(screen.getByRole('radio', { name: 'Train २' }));
    expect(screen.getByRole('img', { name: 'Tracing demo for २' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Writing slate for २' })).toBeInTheDocument();
    expect(screen.getByText(/How २ is traced today/)).toBeInTheDocument();
  });

  it('records each pen-down-to-pen-up gesture as one stroke, previews it and exports JSON', async () => {
    const user = userEvent.setup();
    render(<TraceTrainer />);
    await user.click(screen.getByRole('radio', { name: 'Train २' }));
    const slate = screen.getByRole('img', { name: 'Writing slate for २' });

    // A tap is not a stroke
    draw(slate, [
      { x: 100, y: 100 },
      { x: 102, y: 101 },
    ]);
    expect(screen.queryByRole('list', { name: 'Your strokes' })).not.toBeInTheDocument();

    draw(slate, sampleStrokePath(two.strokes[0]!, 4));
    draw(slate, [
      { x: 150, y: 80 },
      { x: 150, y: 150 },
      { x: 151, y: 230 },
    ]);

    const list = screen.getByRole('list', { name: 'Your strokes' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('combobox', { name: 'Type of stroke 1' })).toHaveValue('curve');
    expect(screen.getByRole('combobox', { name: 'Type of stroke 2' })).toHaveValue('stem');

    // Preview of the corrected trace (next to the current one) and a valid export
    expect(screen.getAllByRole('img', { name: 'Tracing demo for २' })).toHaveLength(2);
    expect(screen.getByText(/Valid stroke data/)).toBeInTheDocument();
    const json = JSON.parse(screen.getByLabelText('Corrected stroke JSON').textContent ?? '');
    expect(json.id).toBe('num-2');
    expect(json.strokes).toHaveLength(2);
    expect(json.strokes[1].type).toBe('stem');
    expect(screen.getByRole('button', { name: /Download num-2.json/ })).toBeInTheDocument();

    // Undo removes the last stroke
    await user.click(screen.getByRole('button', { name: /Undo stroke/ }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  });

  it('lets the author relabel, retype and reorder strokes', async () => {
    const user = userEvent.setup();
    render(<TraceTrainer />);
    await user.click(screen.getByRole('radio', { name: 'Train ६' }));
    const slate = screen.getByRole('img', { name: 'Writing slate for ६' });
    draw(slate, [
      { x: 180, y: 90 },
      { x: 120, y: 95 },
      { x: 110, y: 140 },
      { x: 160, y: 150 },
    ]);
    draw(slate, [
      { x: 120, y: 150 },
      { x: 100, y: 200 },
      { x: 160, y: 230 },
      { x: 220, y: 200 },
    ]);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Type of stroke 1' }), 'loop');
    const label = screen.getByRole('textbox', { name: 'Label of stroke 1' });
    await user.clear(label);
    await user.type(label, 'Top hook');
    await user.click(screen.getByRole('button', { name: 'Move stroke 2 up' }));

    const json = JSON.parse(screen.getByLabelText('Corrected stroke JSON').textContent ?? '');
    expect(json.strokes[1].label).toBe('Top hook');
    expect(json.strokes[1].type).toBe('loop');
    expect(json.strokes).toHaveLength(2);
  });

  it('keeps corrections per glyph and restores them after a reload', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TraceTrainer />);
    await user.click(screen.getByRole('radio', { name: 'Train ५' }));
    draw(screen.getByRole('img', { name: 'Writing slate for ५' }), [
      { x: 90, y: 80 },
      { x: 120, y: 140 },
      { x: 170, y: 120 },
    ]);
    expect(screen.getByRole('radio', { name: 'Train ५' })).toContainElement(
      screen.getByLabelText('has a correction')
    );
    await user.click(screen.getByRole('radio', { name: 'Train ३' }));
    expect(screen.queryByRole('list', { name: 'Your strokes' })).not.toBeInTheDocument();
    unmount();

    render(<TraceTrainer />);
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Train ५' }));
    expect(
      within(screen.getByRole('list', { name: 'Your strokes' })).getAllByRole('listitem')
    ).toHaveLength(1);
  });
});
