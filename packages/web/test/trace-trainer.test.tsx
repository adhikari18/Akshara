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
  buildGlyphGuide,
  fitCubics,
  fitStrokePath,
  guessStrokeType,
  routeThroughPoints,
  simplify,
  toSvgPath,
  type DrawnStroke,
} from '@/components/trainer/traceFit';

const stroke = (
  points: Array<{ x: number; y: number }>,
  extra: Partial<DrawnStroke> = {}
): DrawnStroke => ({
  points,
  type: 'curve',
  label: '',
  nepaliInstruction: '',
  englishInstruction: '',
  snap: false,
  ...extra,
});

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
  it('turns a jittery hand-drawn arc into one or two clean cubic arcs', () => {
    const arc = Array.from({ length: 80 }, (_, i) => {
      const t = (i / 79) * Math.PI;
      return { x: 150 - 80 * Math.cos(t) + (i % 2) * 1.5, y: 150 - 60 * Math.sin(t) + (i % 3) };
    });
    const path = fitStrokePath(stroke(arc));
    const segments = parseSvgPath(path);
    expect(segments.length).toBeLessThanOrEqual(4); // M + at most 3 cubics for a half ellipse
    expect(path.startsWith('M 70 1')).toBe(true);
    expect(path).not.toMatch(/\d\.\d/); // integer coordinates
  });

  it('fits a full circle with a handful of cubics that stay on the circle', () => {
    const circle = Array.from({ length: 120 }, (_, i) => {
      const t = (i / 119) * 2 * Math.PI;
      return { x: 150 + 60 * Math.cos(t), y: 150 + 60 * Math.sin(t) };
    });
    const cubics = fitCubics(circle, 1.5);
    expect(cubics.length).toBeLessThanOrEqual(6);
    for (const c of cubics) {
      for (const t of [0.25, 0.5, 0.75]) {
        const mt = 1 - t;
        const x =
          mt ** 3 * c[0].x + 3 * mt * mt * t * c[1].x + 3 * mt * t * t * c[2].x + t ** 3 * c[3].x;
        const y =
          mt ** 3 * c[0].y + 3 * mt * mt * t * c[1].y + 3 * mt * t * t * c[2].y + t ** 3 * c[3].y;
        expect(Math.abs(Math.hypot(x - 150, y - 150) - 60)).toBeLessThan(2.5);
      }
    }
  });

  it('writes stems and headlines as straight lines', () => {
    expect(
      fitStrokePath(
        stroke(
          [
            { x: 150, y: 80 },
            { x: 152, y: 150 },
            { x: 149, y: 230 },
          ],
          { type: 'stem' }
        )
      )
    ).toBe('M 150 80 L 149 230');
    expect(
      fitStrokePath(
        stroke(
          [
            { x: 60, y: 74 },
            { x: 150, y: 77 },
            { x: 240, y: 76 },
          ],
          { type: 'shirorekha' }
        )
      )
    ).toBe('M 60 75 L 240 75');
  });

  it('snaps a shaky freehand line onto the faint glyph', () => {
    const guide = buildGlyphGuide(two);
    const shaky = sampleStrokePath(two.strokes[0]!, 3).map((p, i) => ({
      x: p.x + (i % 2 ? 6 : -6),
      y: p.y + (i % 3 ? 4 : -5),
    }));
    const snapped = parseSvgPath(fitStrokePath(stroke(shaky, { snap: true }), guide));
    const reference = sampleStrokePath(two.strokes[0]!, 2);
    // Every end point of the fitted curve lies on the reference shape
    for (const seg of snapped) {
      if (seg.type === 'M') continue;
      const d = Math.min(...reference.map((q) => Math.hypot(q.x - seg.to.x, q.y - seg.to.y)));
      expect(d).toBeLessThan(4);
    }
  });

  it('routes placed points along the faint glyph between them (point mode)', () => {
    const guide = buildGlyphGuide(two);
    const ref = sampleStrokePath(two.strokes[0]!, 2);
    const a = ref[0]!;
    const mid = ref[Math.floor(ref.length / 2)]!;
    const b = ref[ref.length - 1]!;
    const routed = routeThroughPoints([a, mid, b], guide, true);
    expect(routed.length).toBeGreaterThan(20); // follows the curve, not a 3-point polyline
    expect(routed[0]).toEqual(ref[0]);
    // Without snapping the same three points are joined by a gentle spline that goes through them
    const unsnapped = routeThroughPoints([a, mid, b], guide, false);
    expect(unsnapped.length).toBeGreaterThan(3);
    expect(Math.min(...unsnapped.map((q) => Math.hypot(q.x - mid.x, q.y - mid.y)))).toBeLessThan(
      0.01
    );
    const tail = unsnapped[unsnapped.length - 1]!;
    expect(Math.hypot(tail.x - b.x, tail.y - b.y)).toBeLessThan(0.01);
    // The fitted path hugs the reference
    const path = fitStrokePath(stroke([a, mid, b], { mode: 'points', snap: true }), guide);
    for (const seg of parseSvgPath(path)) {
      if (seg.type === 'M') continue;
      expect(Math.min(...ref.map((q) => Math.hypot(q.x - seg.to.x, q.y - seg.to.y)))).toBeLessThan(
        4
      );
    }
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
        mode: 'draw',
        snap: true,
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
    await user.click(screen.getByRole('radio', { name: /Draw by hand/ }));
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
    await user.click(screen.getByRole('radio', { name: /Draw by hand/ }));
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

  it('builds a stroke from numbered points without handwriting (point mode)', async () => {
    const user = userEvent.setup();
    render(<TraceTrainer />);
    await user.click(screen.getByRole('radio', { name: 'Train ३' }));
    expect(screen.getByRole('radio', { name: /Place numbered points/ })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    const slate = screen.getByRole('img', { name: 'Writing slate for ३' });
    const finish = () => screen.getByRole('button', { name: /Finish stroke/ });
    expect(finish()).toBeDisabled();

    const ref = sampleStrokePath(NUMERAL_DATASETS['num-3']!.strokes[0]!, 2);
    const tap = (p: { x: number; y: number }) => {
      fireEvent.pointerDown(slate, { pointerId: 1, clientX: p.x, clientY: p.y });
      fireEvent.pointerUp(slate, { pointerId: 1, clientX: p.x, clientY: p.y });
    };
    tap(ref[0]!);
    tap(ref[Math.floor(ref.length / 3)]!);
    expect(screen.getByText(/2 points placed/)).toBeInTheDocument();
    tap(ref[Math.floor((2 * ref.length) / 3)]!);
    await user.click(screen.getByRole('button', { name: /Undo point/ }));
    expect(screen.getByText(/2 points placed/)).toBeInTheDocument();
    tap(ref[ref.length - 1]!);
    await user.click(finish());

    expect(
      within(screen.getByRole('list', { name: 'Your strokes' })).getAllByRole('listitem')
    ).toHaveLength(1);
    const json = JSON.parse(screen.getByLabelText('Corrected stroke JSON').textContent ?? '');
    expect(json.strokes).toHaveLength(1);
    // The route followed the faint ३, so the authored path is long and curved, not 3 corners
    expect(parseSvgPath(json.strokes[0].svgPath).length).toBeGreaterThan(3);
    expect(screen.getByText(/Valid stroke data/)).toBeInTheDocument();
    expect(screen.getByText(/Stroke 2: tap its first point/)).toBeInTheDocument();
  });

  it('keeps corrections per glyph and restores them after a reload', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TraceTrainer />);
    await user.click(screen.getByRole('radio', { name: 'Train ५' }));
    await user.click(screen.getByRole('radio', { name: /Draw by hand/ }));
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

describe('preview of an unfinished letter', () => {
  it('builds a draft preview (and says why it cannot be exported) when the headline is missing', async () => {
    const { STROKE_DATASETS } = await import('@akshara/data');
    const { buildPreviewDataset } = await import('@/components/trainer/traceFit');
    const bha = STROKE_DATASETS.bha!;
    const loop = sampleStrokePath(bha.strokes[0]!, 3);
    const { dataset, problem } = buildPreviewDataset(bha, [
      {
        points: [loop[0]!, loop[Math.floor(loop.length / 2)]!, loop[loop.length - 1]!],
        type: 'curve',
        mode: 'points',
        snap: true,
        label: '',
        nepaliInstruction: '',
        englishInstruction: '',
      },
    ]);
    expect(problem).toMatch(/at least 2 strokes/);
    expect(dataset.category).toBe('vyanjan');
    expect(dataset.strokes).toHaveLength(1);
    expect(dataset.strokes[0]!.waypoints.length).toBeGreaterThanOrEqual(3);
  });

  it('shows the draft preview in the trainer and holds back the export', async () => {
    const user = userEvent.setup();
    render(<TraceTrainer />);
    await user.click(screen.getByRole('tab', { name: /अक्षर • Letters/ }));
    await user.click(screen.getByRole('radio', { name: 'Train भ' }));
    const slate = screen.getByRole('img', { name: 'Writing slate for भ' });
    for (const p of [
      { x: 72, y: 80 },
      { x: 110, y: 120 },
      { x: 113, y: 148 },
    ]) {
      fireEvent.pointerDown(slate, { pointerId: 1, clientX: p.x, clientY: p.y });
      fireEvent.pointerUp(slate, { pointerId: 1, clientX: p.x, clientY: p.y });
    }
    await user.click(screen.getByRole('button', { name: /Finish stroke/ }));
    expect(screen.getAllByRole('img', { name: 'Tracing demo for भ' })).toHaveLength(2);
    expect(screen.getByText(/Not ready to export yet/)).toHaveTextContent(/Shirorekha/);
    expect(screen.getByRole('button', { name: /Download bha.json/ })).toBeDisabled();
  });
});
